import { create } from 'zustand'
import { Decimal } from 'decimal.js'
import demo from '../fixtures/demo-0001.json'
import catalog from '../fixtures/catalog.json'
import {
  calculateBuilding, kgSplitVereinfacht,
  type BuildingInput, type Catalog, type Coverage, type CoverageState,
  type CostGroup, type BuildingResult,
} from '../engine/calculate'
import { present, rate, type Rate } from '../engine/money'
import { modelDuration, presentDuration, type DurationDisplay } from '../engine/schedule'

/**
 * Состояние = журнал событий + проекция (M-4).
 *
 * Данные не могут измениться без события. Из одного журнала производятся
 * четыре вещи: история варианта, сессионная сводка, undo и метрики.
 * Альтернатива — четыре отдельных механизма, которые расходятся между собой;
 * один журнал делает расхождение невозможным.
 *
 * Поэтому здесь нет сеттеров, меняющих значение напрямую. Есть `apply`,
 * который принимает событие, дописывает его в журнал и пересчитывает
 * проекцию. Undo — обратное событие, а не откат состояния.
 */

const D = (s: string) => new Decimal(s)

export type EventKind =
  | 'value.edited' | 'value.confirmed'
  | 'option.selected' | 'coverage.changed'
  | 'document.activated' | 'conflict.resolved'
  | 'undo'

export type JournalEvent = {
  seq: number
  kind: EventKind
  /** Человекочитаемая подпись — она же строка журнала сессии. */
  label: string
  /** Точная денежная дельта события. Null, если событие не меняет цену. */
  deltaExact: Decimal | null
  at: string
  /** Для отмены: обратное применение. */
  inverse?: () => void
}

export type Provenance = 'aus Dokument' | 'vom Kunden bestätigt' | 'abgeleitet' | 'manuell erfasst'

export type FieldState = {
  value: Decimal
  provenance: Provenance
}

const CATALOG: Catalog = {
  kBase: D(catalog.kBase.value),
  costFactors: {
    gebaeudeklasse: Object.fromEntries(
      Object.entries(catalog.costFactors.gebaeudeklasse).map(([k, v]) => [k, D(v)]),
    ),
    energiestandard: Object.fromEntries(
      Object.entries(catalog.costFactors.energiestandard).map(([k, v]) => [k, D(v)]),
    ),
    gebaeudeform: Object.fromEntries(
      Object.entries(catalog.costFactors.gebaeudeform).map(([k, v]) => [k, D(v)]),
    ),
    untergeschoss: {
      vollausbauMitTiefgarage: D(catalog.costFactors.untergeschoss.vollausbauMitTiefgarage),
    },
  },
  regionalFactor: { active: false, value: D(catalog.regionalFactor.value) },
}

/** Покрытие фикстуры: KG 500 неизвестно — именно поэтому итог промежуточный. */
const INITIAL_COVERAGE: Coverage = {
  KG_100: 'notApplicable', KG_200: 'excluded',
  KG_300: 'included', KG_400: 'included', KG_500: 'unknown',
  KG_600: 'notApplicable', KG_700: 'included', KG_800: 'notApplicable',
}

const fx = demo.buildings[0]!

const INITIAL_BUILDING: BuildingInput = {
  id: fx.id, gebaeudeform: 'MFH',
  gebaeudeklasse: { value: 'GK_5', confirmed: false },
  energiestandard: 'EH_55',
  bgfAboveGround: D(fx.areas.bgfAboveGround!),
  bgfBelowGround: D(fx.areas.bgfBelowGround!),
  untergeschoss: 'vollausbau', hasParking: true,
}

export type Projection = {
  result: BuildingResult
  kgSplit: ReturnType<typeof kgSplitVereinfacht>
  /** Ведущая ставка сегмента (D-11 v2): у Haus A единственный сегмент Wohnen. */
  leadRate: Rate
  secondaryRateBgf: Rate
  perUnit: Rate
  duration: DurationDisplay
  aboveGround: ReturnType<typeof present>
  belowGround: ReturnType<typeof present>
  /** Интервал точности. Сужается ПОДТВЕРЖДЕНИЕМ, не выбором опции (D-19). */
  uncertaintyPp: number
}

type Store = {
  building: BuildingInput
  coverage: Coverage
  fields: { wfl: FieldState; bgfOber: FieldState; we: FieldState }
  journal: JournalEvent[]
  /** Ответ на вопрос об энергостандарте — подтверждение, не выбор (D-19). */
  esConfirmed: boolean
  /** Открытый конфликт значения WFL: Dokument 1.500,00 против Kunde 1.560,00. */
  wflConflictOpen: boolean
  /** Активная версия планов этажей. Выбор — решение sales, не дата (VERSION-002). */
  activeGrundrisse: 'V2' | 'V1'
  /** Дельта-чип живёт 4 секунды, потом уезжает в журнал (DC-2). */
  activeDelta: { label: string; deltaExact: Decimal; percent: Decimal } | null
  openChapter: number

  projection: () => Projection
  apply: (e: Omit<JournalEvent, 'seq' | 'at'>) => void
  editField: (key: 'wfl' | 'bgfOber' | 'we', value: Decimal, confirmed: boolean) => void
  setEnergiestandard: (v: BuildingInput['energiestandard']) => void
  setUntergeschoss: (v: BuildingInput['untergeschoss']) => void
  setCoverage: (g: CostGroup, s: CoverageState) => void
  confirmGebaeudeklasse: () => void
  confirmEnergiestandardAnswer: () => void
  resolveWflConflict: (candidate: 'document' | 'customer') => void
  activateGrundrisse: (v: 'V2' | 'V1') => void
  clearDelta: () => void
  openChapterAt: (n: number) => void
  undo: () => void
}

function computeProjection(
  s: Pick<Store, 'building' | 'coverage' | 'fields' | 'esConfirmed'>,
): Projection {
  const result = calculateBuilding(s.building, CATALOG, s.coverage)
  const total = result.total.exact
  const noUg = calculateBuilding(
    { ...s.building, untergeschoss: 'kein_ug' }, CATALOG, s.coverage,
  )
  const ug = total.minus(noUg.total.exact)

  const duration = presentDuration(
    {
      metricKey: `building:${s.building.id}.execution`,
      kind: 'buildingExecution',
      startDate: '2027-04-04', endDate: '2027-11-19', durationBasis: 'calendarDay',
    },
    modelDuration(s.building.bgfAboveGround, D('1.00'), D('1.15')),
  )

  // Интервал: базовые 22 пункта минус объявленные фикстурой сужения.
  // Фикстура задаёт Δ ровно для двух подтверждений: WFL −5 Pp и
  // Energiestandard −4 Pp (DEMO-SC-02). Δ остальных параметров фикстурой
  // не объявлены, и выдумывать их нельзя (R-25) — подтверждение bgfOber
  // поэтому интервал не сужает, и это честно, а не забыто. Выбор опции
  // не сужает ничего: он не подтверждение (D-19).
  const narrowing =
    (s.fields.wfl.provenance === 'vom Kunden bestätigt' ? 5 : 0) +
    (s.esConfirmed ? 4 : 0)

  return {
    result,
    kgSplit: kgSplitVereinfacht(total),
    leadRate: rate(total, s.fields.wfl.value, 'WFL_WOFLV'),
    secondaryRateBgf: rate(total, s.fields.bgfOber.value, 'BGF_ABOVE_GROUND'),
    perUnit: rate(total, s.fields.we.value, 'WOHNEINHEITEN'),
    duration,
    aboveGround: present(noUg.total.exact),
    belowGround: present(ug),
    uncertaintyPp: 22 - narrowing,
  }
}

export const useStore = create<Store>((set, get) => ({
  building: INITIAL_BUILDING,
  coverage: INITIAL_COVERAGE,
  fields: {
    wfl: { value: D(fx.areas.wflWoFlV!), provenance: 'aus Dokument' },
    bgfOber: { value: D(fx.areas.bgfAboveGround!), provenance: 'aus Dokument' },
    we: { value: D(fx.areas.wohneinheiten!), provenance: 'aus Dokument' },
  },
  journal: [],
  esConfirmed: false,
  wflConflictOpen: true,
  activeGrundrisse: 'V2',
  activeDelta: null,
  openChapter: 3,

  projection: () => computeProjection(get()),

  apply: (e) => {
    const { journal } = get()
    set({
      journal: [
        ...journal,
        { ...e, seq: journal.length + 1, at: new Date().toISOString() },
      ],
    })
  },

  editField: (key, value, confirmed) => {
    const before = get().projection().result.total.exact
    const prev = get().fields[key]
    set((s) => ({
      fields: {
        ...s.fields,
        [key]: {
          value,
          provenance: confirmed ? 'vom Kunden bestätigt' : 'manuell erfasst',
        },
      },
      // Площадь надземная участвует в расчёте — остальные только в знаменателях.
      building: key === 'bgfOber' ? { ...s.building, bgfAboveGround: value } : s.building,
    }))
    const after = get().projection().result.total.exact
    const delta = after.minus(before)
    get().apply({
      kind: confirmed ? 'value.confirmed' : 'value.edited',
      label: `${LABELS[key]} ${prev.value.toFixed(2)} → ${value.toFixed(2)}`,
      deltaExact: delta.isZero() ? null : delta,
      inverse: () => set((s) => ({
        fields: { ...s.fields, [key]: prev },
        building: key === 'bgfOber'
          ? { ...s.building, bgfAboveGround: prev.value } : s.building,
      })),
    })
    if (!delta.isZero()) {
      set({
        activeDelta: {
          label: `${LABELS[key]} geändert`,
          deltaExact: delta,
          percent: delta.div(before).mul(100),
        },
      })
    }
  },

  setEnergiestandard: (v) => {
    const s = get()
    const before = s.projection().result.total.exact
    const prev = s.building.energiestandard
    set({ building: { ...s.building, energiestandard: v } })
    const after = get().projection().result.total.exact
    const delta = after.minus(before)
    get().apply({
      kind: 'option.selected',
      label: `Energiestandard ${prev.replace('_', ' ')} → ${v.replace('_', ' ')}`,
      deltaExact: delta,
      inverse: () => set((st) => ({ building: { ...st.building, energiestandard: prev } })),
    })
    set({
      activeDelta: {
        label: `Energiestandard ${prev.replace('_', ' ')} → ${v.replace('_', ' ')}`,
        deltaExact: delta,
        percent: delta.div(before).mul(100),
      },
    })
  },

  setUntergeschoss: (v) => {
    const s = get()
    const before = s.projection().result.total.exact
    const prev = s.building.untergeschoss
    set({ building: { ...s.building, untergeschoss: v } })
    const after = get().projection().result.total.exact
    const delta = after.minus(before)
    get().apply({
      kind: 'option.selected',
      label: `Untergeschoss ${LABEL_UG[prev]} → ${LABEL_UG[v]}`,
      deltaExact: delta,
      inverse: () => set((st) => ({ building: { ...st.building, untergeschoss: prev } })),
    })
    set({
      activeDelta: {
        label: `Untergeschoss ${LABEL_UG[v]}`,
        deltaExact: delta,
        percent: delta.div(before).mul(100),
      },
    })
  },

  setCoverage: (g, st) => {
    const s = get()
    const prev = s.coverage[g]
    set({ coverage: { ...s.coverage, [g]: st } })
    get().apply({
      kind: 'coverage.changed',
      label: `${g} ${COVERAGE_LABEL[prev]} → ${COVERAGE_LABEL[st]}`,
      deltaExact: null,
      inverse: () => set((x) => ({ coverage: { ...x.coverage, [g]: prev } })),
    })
  },

  confirmGebaeudeklasse: () => {
    const s = get()
    set({
      building: {
        ...s.building,
        gebaeudeklasse: { ...s.building.gebaeudeklasse, confirmed: true },
      },
    })
    get().apply({
      kind: 'value.confirmed',
      label: 'Gebäudeklasse nach MBO §2 bestätigt',
      deltaExact: null,
      inverse: () => set((x) => ({
        building: {
          ...x.building,
          gebaeudeklasse: { ...x.building.gebaeudeklasse, confirmed: false },
        },
      })),
    })
  },

  confirmEnergiestandardAnswer: () => {
    if (get().esConfirmed) return
    set({ esConfirmed: true })
    get().apply({
      kind: 'value.confirmed',
      label: 'Energiestandard vom Kunden bestätigt',
      deltaExact: null,
      inverse: () => set({ esConfirmed: false }),
    })
  },

  resolveWflConflict: (candidate) => {
    const s = get()
    if (!s.wflConflictOpen) return
    // Решение конфликта объясняет последствие ДО выбора: меняется только
    // знаменатель ведущей ставки, тотал не меняется (фикстура DEMO-CONF-0001).
    if (candidate === 'customer') {
      s.editField('wfl', D('1560.00'), true)
    } else {
      // Документное значение остаётся авторитетным; подтверждение клиентом
      // самого факта проверки — тоже событие.
      set((x) => ({
        fields: { ...x.fields, wfl: { ...x.fields.wfl, provenance: 'vom Kunden bestätigt' } },
      }))
    }
    set({ wflConflictOpen: false })
    get().apply({
      kind: 'conflict.resolved',
      label: candidate === 'customer'
        ? 'WFL-Konflikt: Kundenwert 1.560,00 m² übernommen'
        : 'WFL-Konflikt: Dokumentwert 1.500,00 m² beibehalten',
      deltaExact: null,
      inverse: () => set({ wflConflictOpen: true }),
    })
  },

  activateGrundrisse: (v) => {
    const s = get()
    if (s.activeGrundrisse === v) return
    const prev = s.activeGrundrisse
    set({ activeGrundrisse: v })
    get().apply({
      kind: 'document.activated',
      label: `Grundrisse: Version ${v} aktiviert (vorher ${prev})`,
      deltaExact: null,
      inverse: () => set({ activeGrundrisse: prev }),
    })
  },

  clearDelta: () => set({ activeDelta: null }),
  openChapterAt: (n) => set({ openChapter: n }),

  undo: () => {
    const { journal } = get()
    const last = [...journal].reverse().find((e) => e.kind !== 'undo' && e.inverse)
    if (!last) return
    last.inverse!()
    // Отмена — обратное СОБЫТИЕ журнала, а не откат состояния: иначе история
    // перестала бы объяснять расхождение двух состояний (M-4).
    get().apply({
      kind: 'undo',
      label: `Rückgängig: ${last.label}`,
      deltaExact: last.deltaExact ? last.deltaExact.negated() : null,
    })
  },
}))

const LABELS: Record<'wfl' | 'bgfOber' | 'we', string> = {
  wfl: 'Wohnfläche WFL nach WoFlV',
  bgfOber: 'BGF oberirdisch',
  we: 'Wohneinheiten',
}

const LABEL_UG: Record<BuildingInput['untergeschoss'], string> = {
  kein_ug: 'nicht Bestandteil',
  ab_decke: 'Leistungsbeginn ab OK Decke über UG',
  vollausbau: 'vollständig inkl. Gründung',
}

const COVERAGE_LABEL: Record<CoverageState, string> = {
  included: 'enthalten',
  excluded: 'nicht enthalten',
  onRequest: 'auf Anfrage',
  unknown: 'noch offen',
  notApplicable: 'nicht anwendbar',
}

export { LABEL_UG, COVERAGE_LABEL, LABELS }
