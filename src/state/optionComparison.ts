import { Decimal } from 'decimal.js'
import {
  configForOption,
  eligibleClientOptions,
  projectionForOption,
  type OptionConfig,
  type Projection,
  type Store,
  clientSnapshotForOption,
  type ClientScenarioSnapshot,
} from './store'
import { isClientProjection } from './clientProjection'
import { NNBSP, formatDE, present, rateLabel, rateUnit } from '../engine/money'

/**
 * D-20 — ОДИН источник сравнения Options.
 *
 * Сравнение существовало в продукте ДВАЖДЫ: экран `S4Vergleich` считал его
 * из `configForOption`/`projectionForOption`, а клиентский слой строил своё,
 * другое сравнение из `latestSavedOptionVersion`. Два авторитета на одно
 * число — это дефект, а не дублирование кода: расхождение между ними
 * невидимо, пока клиент не увидит третью цифру.
 *
 * Здесь живёт единственная модель строк сравнения. Проектный маршрут
 * `/projekt/:projectId/vergleich` и клиентский слой «Varianten» читают
 * ровно её. Это ЧИСТОЕ извлечение: расчёт, набор строк, их порядок, имена
 * групп, правило видимости и формулировки не изменены ни на символ.
 *
 * Модуль намеренно не знает про React: `t`/`tx` приходят параметрами, а не
 * хуками, — иначе селектор нельзя было бы вызвать из теста и из клиентской
 * выдачи.
 */

/**
 * ACCEPTANCE REMEDIATION (cycle 2, ACCEPT-02): the shell (components.css
 * `--cmp-visible-cols`) always fits exactly three Option columns at the
 * full container width, at any supported viewport — a fourth+ Option is
 * the first one that ever needs the horizontal scrollport. Exported so
 * every consumer agrees on when a scrollport is needed.
 */
export const COMPARISON_VISIBLE_COLUMN_LIMIT = 3

export const ES_LABEL: Record<string, string> = {
  GEG: 'GEG',
  EH_55: `EH${NNBSP}55`,
  EH_40: `EH${NNBSP}40`,
}

/**
 * Narrowest slice that actually works.
 *
 * `keyof OptionConfig` is what `configForOption`/`projectionForOption`
 * demand (the active Option is read from the flat fields, the others from
 * `optionConfigs`); `options` + `savedOptionVersions` is what
 * `eligibleClientOptions` demands; `mode` decides the client projection and
 * `viewedOptionId`/`activeOptionId` resolve which Option is presented.
 * Dropping any one of them silently changes which columns exist, so the
 * list is derived from the callees rather than from what today's screen
 * happens to touch.
 */
export type ComparisonStoreSlice = Pick<
  Store,
  | 'mode'
  | 'options'
  | 'savedOptionVersions'
  | 'viewedOptionId'
  | 'activeOptionId'
  | 'optionConfigs'
  | keyof OptionConfig
>

export type ComparisonColumn = Readonly<{
  option: Readonly<{ id: string; name: string }>
  cfg: OptionConfig
  p: Projection
  /**
   * The canonical commercial derivation of this Option — the reading every
   * client chapter renders. `null` when it cannot be derived (or when the
   * slice handed in is too narrow to derive it); the client rows then state
   * the missing basis, never a number from another engine.
   */
  snapshot: ClientScenarioSnapshot | null
}>

/** A per-cell secondary line (today: the saved-state sub-caption). */
export type ComparisonSub = Readonly<{ text: string; save: boolean }> | null

export type ComparisonRow = Readonly<{
  /** Stable identity for React keys and for tests. */
  id: string
  label: string
  group: string
  /** Result rows are always shown, differing or not — a comparison that
   * hides the price because both Options cost the same is not a comparison. */
  result?: boolean
  cells: readonly string[]
  subCells?: readonly ComparisonSub[]
}>

export type ComparisonText = (
  key: string,
  values?: Readonly<Record<string, string | number>>,
) => string

export type ComparisonRowDeps = Readonly<{
  t: ComparisonText
  tx: (deText: string) => string
  client: boolean
  /** Client rows typeset dates for this locale; internal rows stay `de`. */
  language?: 'de' | 'en'
}>

/* ─────────────────────────── formatting helpers ────────────────────────── */

export function money(d: Decimal): string {
  const pr = present(d)
  return `${pr.prefix}${pr.prefix ? NNBSP : ''}${pr.display}`
}

export function delta(d: Decimal): string {
  if (d.isZero()) return '—'
  const pr = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  return `${sign}${NNBSP}${pr.prefix ? pr.prefix + NNBSP : ''}${pr.display}`
}

export function perBuilding(
  cfg: OptionConfig,
  f: (id: string) => string,
): string {
  return Object.keys(cfg.buildings)
    .filter((id) => cfg.included[id])
    .map(f)
    .join(' · ')
}

/**
 * QA (Rebuild Configurator Workspace, AC-11): falling back to the raw `id`
 * whenever `client` was false leaked fixture ids (e.g. "DEMO-B-A") into
 * Vorbereitung, which is still human-facing, just not the final client
 * artifact. `stableName` is fixture-level data (present in every mode),
 * so resolve it unconditionally — never the raw id.
 */
export function buildingLabel(
  id: string,
  config: OptionConfig,
  tx: (deText: string) => string,
): string {
  return config.buildings[id]?.stableName ?? tx('Gebäude')
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/* ──────────────────────────────── selectors ────────────────────────────── */

/**
 * The Options that may be compared, in display order.
 *
 * REDESIGN R3: only client-eligible Options (the PD-3 export-readiness
 * signal — `eligibleClientOptions`) may become a column/selectable Option
 * in Kundenansicht. Vorbereitung keeps seeing every created Option,
 * ready or not — that is exactly what preparation work is for.
 */
export function comparisonColumns(
  s: ComparisonStoreSlice,
): readonly ComparisonColumn[] {
  const eligibleIds = isClientProjection(s.mode)
    ? new Set(eligibleClientOptions(s).map((o) => o.id))
    : null
  // The canonical snapshot needs the whole store; a narrower slice (tests,
  // the project-tier route's Pick) gets `null` and the internal rows below
  // keep their released reading of `p`.
  const full = 'snapshots' in s ? (s as Store) : null
  return s.options.flatMap((o) => {
    if (eligibleIds && !eligibleIds.has(o.id)) return []
    const cfg = configForOption(s, o.id)
    const p = projectionForOption(s, o.id)
    const snapshot = full ? clientSnapshotForOption(full, o.id) : null
    return cfg && p ? [{ option: o, cfg, p, snapshot }] : []
  })
}

/**
 * Every row, in canonical order. `client` drops internal-only rows.
 *
 * VR2-05: the total + its delta live in the column header itself (DC-11
 * anatomy: `columnHeader → cell → value.numeric → delta`), directly under
 * Option identity — one coherent price/consequence scan path instead of a
 * duplicate body row. That pair is therefore presentation of the column,
 * not a row of this model.
 */
export function comparisonRows(
  cols: readonly ComparisonColumn[],
  deps: ComparisonRowDeps,
): readonly ComparisonRow[] {
  const { t, tx, client } = deps
  const language = deps.language ?? 'de'
  const name = (id: string, cfg: OptionConfig) => buildingLabel(id, cfg, tx)
  /**
   * The RESULT rows. In front of a client they read the canonical commercial
   * derivation — the same object the chapters render — so the layer and the
   * stage cannot state two totals for one Option. The internal route keeps
   * its released reading of the proposal projection (`p`), which is the
   * documented two-engine state of the preparation tier and not this
   * module's to change. A client column without a snapshot states the
   * missing basis; it never borrows the other engine's number.
   */
  const absent = t('vr3.client.investment.notPriced')
  const clientDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(d)
  }
  const resultRows: ComparisonRow[] = client
    ? [
      {
        id: 'total',
        result: true,
        group: t('vr3.client.varianten.group.result'),
        label: t('vr3.client.varianten.row.total'),
        cells: cols.map((c) => c.snapshot
          ? `${c.snapshot.result.total.prefix}${c.snapshot.result.total.prefix ? NNBSP : ''}`
            + `${c.snapshot.result.total.display}${NNBSP}€`
          : absent),
      },
      {
        id: 'lead-rate',
        result: true,
        group: t('vr3.client.varianten.group.result'),
        label: t('comparison.leadRate'),
        cells: cols.map((c) => c.snapshot
          ? `${rateUnit(c.snapshot.result.leadRate)} · ${c.snapshot.result.leadRate.denominatorLabel}`
          : absent),
      },
      {
        id: 'uncertainty',
        result: true,
        group: t('vr3.client.varianten.group.result'),
        label: t('vr3.client.varianten.row.uncertainty'),
        cells: cols.map((c) => c.snapshot
          ? `±${NNBSP}${c.snapshot.result.uncertaintyPp}${NNBSP}%`
          : absent),
      },
      {
        id: 'bauzeit',
        result: true,
        group: t('vr3.client.varianten.group.result'),
        label: `${t('vr3.client.schedule.duration')} · ${t('vr3.client.schedule.boundary')}`,
        cells: cols.map((c) => c.snapshot
          ? `${c.snapshot.projection.duration.prefix}${c.snapshot.projection.duration.prefix ? NNBSP : ''}`
            + t('vr3.client.schedule.durationValue', {
              months: c.snapshot.projection.duration.display.replace(/[\s\u202f\u00a0]*Monate$/, ''),
            })
          : absent),
      },
      {
        id: 'completion',
        result: true,
        group: t('vr3.client.varianten.group.result'),
        label: t('vr3.client.schedule.completion'),
        cells: cols.map((c) => clientDate(c.snapshot?.projection.duration.completionDate)),
      },
    ]
    : [
      {
        // Each Option can carry a different building set and therefore a
        // different typed denominator. The denominator travels with its cell;
        // a shared row label may never borrow it from the base column.
        id: 'lead-rate',
        result: true,
        group: 'ERGEBNIS',
        label: t('comparison.leadRate'),
        cells: cols.map((c) => rateLabel(c.p.leadRate)),
      },
      {
        id: 'uncertainty',
        result: true,
        group: 'ERGEBNIS',
        label: 'Schätzunsicherheit',
        cells: cols.map((c) => `±${NNBSP}${c.p.uncertaintyPp}${NNBSP}%`),
      },
      {
        id: 'bauzeit',
        result: true,
        group: 'ERGEBNIS',
        label: 'Bauzeit (ab OKBP)',
        cells: cols.map(
          (c) =>
            `${c.p.duration.prefix}${c.p.duration.prefix ? NNBSP : ''}${c.p.duration.display}`,
        ),
      },
      {
        id: 'completion',
        result: true,
        group: 'ERGEBNIS',
        label: 'Fertigstellung',
        cells: cols.map((c) => formatDate(c.p.duration.completionDate)),
      },
    ]
  const groupScope = client ? t('vr3.client.varianten.group.scope') : 'UMFANG'
  const groupQuality = client ? t('vr3.client.varianten.group.quality') : 'QUALITÄT'
  return [
    ...resultRows,
    {
      id: 'buildings',
      group: groupScope,
      label: client ? t('vr3.client.varianten.row.buildings') : 'Gebäude im Angebot',
      cells: cols.map((c) => perBuilding(c.cfg, (id) => name(id, c.cfg))),
    },
    {
      id: 'basement',
      group: groupScope,
      label: client ? t('vr3.client.buildings.basement') : 'Untergeschoss',
      cells: cols.map((c) =>
        perBuilding(c.cfg, (id) =>
          c.cfg.buildings[id]!.untergeschoss === 'kein_ug'
            ? `${name(id, c.cfg)}: ${client ? t('vr3.client.buildings.basement.none') : 'nicht Bestandteil'}`
            : `${name(id, c.cfg)}: ${client ? t('vr3.client.buildings.basement.present') : 'enthalten'}`,
        ),
      ),
    },
    {
      id: 'bgf-below',
      group: groupScope,
      label: client ? t('vr3.client.project.metric.bgfBelow') : 'BGF unterirdisch (m²)',
      cells: cols.map((c) =>
        formatDE(
          Object.keys(c.cfg.buildings)
            .filter(
              (id) =>
                c.cfg.included[id] &&
                c.cfg.buildings[id]!.untergeschoss !== 'kein_ug',
            )
            .reduce(
              (a, id) => a.plus(c.cfg.buildings[id]!.bgfBelowGround),
              new Decimal(0),
            ),
          2,
        ),
      ),
    },
    ...(!client
      ? [
          {
            id: 'kg-700',
            group: 'UMFANG',
            label: 'KG 700',
            cells: cols.map((c) =>
              c.cfg.kg700Mode === 'hoaiAho'
                ? 'nach HOAI und AHO als eigene Position'
                : 'im All3-Verfahren 70/22/8 verteilt',
            ),
          },
        ]
      : []),
    {
      id: 'energy-standard',
      group: groupQuality,
      label: client ? t('vr3.client.overview.energy') : 'Energiestandard',
      cells: cols.map((c) =>
        perBuilding(
          c.cfg,
          (id) =>
            `${name(id, c.cfg)}: ${ES_LABEL[c.cfg.buildings[id]!.energiestandard]}`,
        ),
      ),
    },
    ...(client ? [] : [{
      id: 'building-class',
      group: groupQuality,
      label: 'Klassifikation nach MBO §2',
      cells: cols.map((c) =>
        perBuilding(c.cfg, (id) =>
          c.cfg.buildings[id]!.gebaeudeklasse.confirmed
            ? `${name(id, c.cfg)}: ✓ bestätigt`
            : `${name(id, c.cfg)}: ▲ nicht bestätigt`,
        ),
      ),
    }]),
  ]
}

/**
 * The visibility rule, unchanged.
 *
 * «Различается» — вычисляется из ячеек, а не объявляется: строка с
 * одинаковыми значениями во всех колонках различием не является.
 */
export function visibleComparisonRows(
  rows: readonly ComparisonRow[],
  showAll: boolean,
): readonly ComparisonRow[] {
  return rows.filter(
    (r) => showAll || new Set(r.cells).size > 1 || r.result === true,
  )
}

/** Distinct group names of the given rows, in first-appearance order. */
export function comparisonGroups(
  rows: readonly ComparisonRow[],
): readonly string[] {
  return [...new Set(rows.map((r) => r.group))]
}
