import { Decimal } from 'decimal.js'
import {
  BAUZEIT_DEFAULT_FOUNDATION_MONTHS,
  BAUZEIT_MODEL_DEFAULTS,
  allocateByBgf,
  computeBauzeit,
} from '../engine/bauzeit'
import type {
  BauzeitBuildingInput,
  BauzeitBuildingType,
  BauzeitGk,
  BauzeitModel,
  BauzeitResult,
} from '../engine/bauzeit'
import type { BuildingScopeState, ScopeBuilding } from './optionBuildingScope'
import { scopeMetricValue } from './optionBuildingScope'

/**
 * VR3 · `v3` — die EINGABEN des Bauzeit-Rechners, aus der Option gelesen.
 *
 * Der Rechner kennt je Gebäude vier Größen: BGF, Gebäudetyp, Gebäudeklasse
 * und die Dauer der Fundamentarbeiten. Die Option kennt davon genau eine
 * sicher — die BGF; die übrigen leitet dieses Modul aus der Nutzung und der
 * Geschossigkeit VOR und lässt sie ausdrücklich überschreiben.
 *
 * Der Vorschlag ist als Vorschlag sichtbar und nicht als Tatsache: ein
 * abgeleiteter Gebäudetyp, der sich als bestätigter Wert ausgibt, wäre
 * genau der Fehler, den Regel 16 („Unbekannt ist nicht Null“) meint.
 */

export type BauzeitBuildingParamEdit = {
  bgf?: number
  type?: BauzeitBuildingType
  gk?: BauzeitGk
  foundationMonths?: number
}

/** Eine Änderung an der Kalibrierung. Untergruppen werden flach gemischt. */
export type BauzeitModelPatch = Partial<Omit<BauzeitModel, 'planning' | 'payments' | 'typeFactors' | 'gkFactors'>> & {
  planning?: Partial<BauzeitModel['planning']>
  payments?: Partial<BauzeitModel['payments']>
  typeFactors?: Partial<BauzeitModel['typeFactors']>
  gkFactors?: Partial<BauzeitModel['gkFactors']>
}

export function applyBauzeitModelPatch(
  model: BauzeitModel, patch: BauzeitModelPatch,
): BauzeitModel {
  return {
    ...model,
    ...patch,
    planning: { ...model.planning, ...patch.planning },
    payments: { ...model.payments, ...patch.payments },
    typeFactors: { ...model.typeFactors, ...patch.typeFactors },
    gkFactors: { ...model.gkFactors, ...patch.gkFactors },
  }
}

/* ────────────────────────  Vorschläge aus der Option  ─────────────────── */

/**
 * Der vorgeschlagene Gebäudetyp.
 *
 * Wohnen ist ein Mehrfamilienhaus; Büro und gemischte Nutzung tragen den
 * Komplexitätsfaktor des Rechners. Der Vorschlag ist überschreibbar — er
 * ersetzt keine Klassifikation, er schlägt eine Kalibrierung vor.
 */
export function proposedBauzeitType(building: ScopeBuilding): BauzeitBuildingType {
  if (building.usageKey.endsWith('office') || building.usageKey.endsWith('mixed')) {
    return 'campus'
  }
  return 'mfh'
}

/**
 * Die vorgeschlagene Gebäudeklasse aus der Geschossigkeit.
 *
 * Die Klasse folgt in der MBO der HÖHE des obersten Geschosses, die dieser
 * Prototyp nicht führt; deshalb ist die Ableitung eine ausdrückliche Tabelle
 * über die bekannten Geschossbeschreibungen und kein gerechnetes Ergebnis.
 * Was nicht in der Tabelle steht, bleibt `gk3` — der neutrale Faktor 1,00.
 */
const PROPOSED_GK: Readonly<Record<string, BauzeitGk>> = {
  'vr3.building.storeys.a1': 'gk4',
  'vr3.building.storeys.bA': 'gk5',
  'vr3.building.storeys.bB': 'gk5',
  'vr3.building.storeys.bC': 'gk5',
}

export function proposedBauzeitGk(building: ScopeBuilding): BauzeitGk {
  return PROPOSED_GK[building.storeysKey] ?? 'gk3'
}

export type BauzeitParamOrigin = 'proposed' | 'edited'

export type BauzeitBuildingParams = {
  bgf: number
  type: BauzeitBuildingType
  gk: BauzeitGk
  foundationMonths: number
  origin: Readonly<Record<'bgf' | 'type' | 'gk' | 'foundationMonths', BauzeitParamOrigin>>
}

export type BauzeitInputState = Pick<
  BuildingScopeState, 'scopeBuildings' | 'scopeSelected' | 'scopeEdits'
> & {
  bauzeitModel: BauzeitModel
  bauzeitBuildingParams: Readonly<Record<string, BauzeitBuildingParamEdit>>
}

/** Die Gebäude, die der Terminplan rechnet: die AUSGEWÄHLTEN, in Reihenfolge. */
export function bauzeitScopeBuildings(state: BauzeitInputState): readonly ScopeBuilding[] {
  return state.scopeBuildings.filter((building) => state.scopeSelected[building.id])
}

export function bauzeitBuildingParams(
  state: BauzeitInputState, building: ScopeBuilding,
): BauzeitBuildingParams {
  const edit = state.bauzeitBuildingParams[building.id] ?? {}
  const baselineBgf = Number(scopeMetricValue(state, building, 'bgfRSTotal') ?? '0')
  return {
    bgf: edit.bgf ?? (Number.isFinite(baselineBgf) ? baselineBgf : 0),
    type: edit.type ?? proposedBauzeitType(building),
    gk: edit.gk ?? proposedBauzeitGk(building),
    foundationMonths: edit.foundationMonths ?? BAUZEIT_DEFAULT_FOUNDATION_MONTHS,
    origin: {
      bgf: edit.bgf === undefined ? 'proposed' : 'edited',
      type: edit.type === undefined ? 'proposed' : 'edited',
      gk: edit.gk === undefined ? 'proposed' : 'edited',
      foundationMonths: edit.foundationMonths === undefined ? 'proposed' : 'edited',
    },
  }
}

/**
 * Die Rechnereingaben, einschließlich der Vertragssumme je Gebäude.
 *
 * Die Gesamtsumme kommt von AUSSEN — aus der KG-Konfiguration der Option —
 * und wird nach BGF verteilt. Der Rechner würde sie aus einem Preis je m²
 * ableiten; das täte hier eine zweite, abweichende Gesamtsumme auf, und
 * genau das verbietet Regel 32.
 */
export function bauzeitInputs(
  state: BauzeitInputState, totalContractSum: Decimal,
): readonly BauzeitBuildingInput[] {
  const buildings = bauzeitScopeBuildings(state)
  const params = buildings.map((building) => ({
    building,
    params: bauzeitBuildingParams(state, building),
  }))
  const allocation = allocateByBgf(
    params.map(({ building, params: p }) => ({ id: building.id, bgf: p.bgf })),
    totalContractSum,
  )
  return params.map(({ building, params: p }) => ({
    id: building.id,
    label: building.name,
    bgf: p.bgf,
    type: p.type,
    gk: p.gk,
    foundationMonths: p.foundationMonths,
    contractSum: allocation[building.id] ?? new Decimal(0),
  }))
}

export function bauzeitResult(
  state: BauzeitInputState, totalContractSum: Decimal, startISO: string,
): BauzeitResult {
  return computeBauzeit(bauzeitInputs(state, totalContractSum), state.bauzeitModel, startISO)
}

export const BAUZEIT_INITIAL_STATE = {
  bauzeitModel: BAUZEIT_MODEL_DEFAULTS,
  bauzeitBuildingParams: {} as Readonly<Record<string, BauzeitBuildingParamEdit>>,
}
