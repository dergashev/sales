import { Decimal } from 'decimal.js'
import {
  configForOption,
  eligibleClientOptions,
  latestSavedOptionVersion,
  projectionForOption,
  type OptionConfig,
  type Projection,
  type Store,
  clientSnapshotForOption,
} from './store'
import {
  clientProposal,
  type ClientProposal,
  type ClientProposalDeps,
  type ClientView,
} from './clientProposal'
import type { PortfolioProject } from './projectPortfolio'
import { isClientProjection } from './clientProjection'
import { localizeMoneyText, localizePercentText } from '../i18n'
import { NNBSP, formatDE, present, rateLabel } from '../engine/money'

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
  return s.options.flatMap((o) => {
    if (eligibleIds && !eligibleIds.has(o.id)) return []
    const cfg = configForOption(s, o.id)
    const p = projectionForOption(s, o.id)
    return cfg && p ? [{ option: o, cfg, p }] : []
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
  const name = (id: string, cfg: OptionConfig) => buildingLabel(id, cfg, tx)
  return [
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
    {
      id: 'buildings',
      group: 'UMFANG',
      label: 'Gebäude im Angebot',
      cells: cols.map((c) => perBuilding(c.cfg, (id) => name(id, c.cfg))),
    },
    {
      id: 'basement',
      group: 'UMFANG',
      label: 'Untergeschoss',
      cells: cols.map((c) =>
        perBuilding(c.cfg, (id) =>
          c.cfg.buildings[id]!.untergeschoss === 'kein_ug'
            ? `${name(id, c.cfg)}: nicht Bestandteil`
            : `${name(id, c.cfg)}: enthalten`,
        ),
      ),
    },
    {
      id: 'bgf-below',
      group: 'UMFANG',
      label: 'BGF unterirdisch (m²)',
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
      group: 'QUALITÄT',
      label: 'Energiestandard',
      cells: cols.map((c) =>
        perBuilding(
          c.cfg,
          (id) =>
            `${name(id, c.cfg)}: ${ES_LABEL[c.cfg.buildings[id]!.energiestandard]}`,
        ),
      ),
    },
    {
      id: 'building-class',
      group: 'QUALITÄT',
      label: 'Klassifikation nach MBO §2',
      cells: cols.map((c) =>
        perBuilding(c.cfg, (id) =>
          c.cfg.buildings[id]!.gebaeudeklasse.confirmed
            ? `${name(id, c.cfg)}: ✓ bestätigt`
            : `${name(id, c.cfg)}: ▲ nicht bestätigt`,
        ),
      ),
    },
  ]
}

/* ─────────────────── the CLIENT reading of the same model ──────────────── */

/**
 * One comparison column, as a CLIENT sees it: a whole `ClientProposal`.
 *
 * The rows below state exactly what the chapters state, because they read
 * the same object the chapters render. The reading this replaces built its
 * cells from `OptionConfig.buildings` — the legacy per-building map, whose
 * `stableName` is `Haus A` and which exists only in one fixture — while
 * every chapter of the same presentation read `scopeBuildings`. Two building
 * authorities in one client tree is how a client came to see `Haus A`,
 * `400,00 m²` underground and an `EH 55` standard for a project whose
 * buildings are `A · Kontorhaus`, `B · Hofhaus`, `C · Stadthaus`, whose
 * underground area is `2.220,00 m²` and which declares no energy standard
 * at all — and how the layer printed a completion date the stage
 * contradicted for the same Option.
 *
 * The internal `/vergleich` route keeps `comparisonRows` and its released
 * reading of the proposal projection: it is the preparation tier, it is not
 * client-visible, and changing what it shows is not this ticket's to do.
 * One module, one row model, one visibility rule — two declared readings,
 * and the client's is the declared client projection.
 */
export type ClientComparisonColumn = Readonly<{
  option: Readonly<{ id: string; name: string }>
  proposal: ClientProposal
}>

export type ClientComparisonDeps = Readonly<{
  t: ComparisonText
  language: 'de' | 'en'
}>

/**
 * Build a client comparison column per eligible Option.
 *
 * Only Options that pass `clientModeAvailableFor` become columns, exactly as
 * before; an Option whose projection cannot be derived is omitted rather
 * than shown with borrowed numbers.
 */
export function clientComparisonColumns(
  s: Store,
  deps: ClientProposalDeps,
  project: PortfolioProject | null,
  language: 'de' | 'en',
): readonly ClientComparisonColumn[] {
  return eligibleClientOptions(s).flatMap((option) => {
    const presented = clientSnapshotForOption(s, option.id)
    if (!presented) return []
    const view: ClientView = {
      optionName: option.name,
      savedVersion: latestSavedOptionVersion(s, option.id),
      presented,
      baseline: presented,
      projectName: project?.name ?? '',
      projectHeroAssetId: null,
      language,
    }
    try {
      return [{
        option,
        proposal: clientProposal(s, view, 'clientLiveConfiguration', deps, project),
      }]
    } catch {
      return []
    }
  })
}

/** The client rows: same model, same groups, client projection. */
export function clientComparisonRows(
  cols: readonly ClientComparisonColumn[],
  deps: ClientComparisonDeps,
): readonly ComparisonRow[] {
  const { t, language } = deps
  /**
   * Each cell is typeset HERE, by the row that knows where its value came
   * from. The render site used to apply one blanket `localizeMoneyText` to
   * the whole heterogeneous array, which re-typeset rows the projection had
   * already localised — an English reader saw `2.220.0 m²` underground —
   * and would silently break again the first time somebody added a row from
   * an already-localised field. `money` is for the engine's German output;
   * `percent` also closes the space before `%` (rule 7); everything the
   * projection localised is passed through untouched.
   */
  const money = (text: string) => localizeMoneyText(text, language)
  const percent = (text: string) => localizePercentText(text, language)
  const absent = t('vr3.client.investment.notPriced')
  const dateText = (iso: string | null) => {
    if (!iso) return absent
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return absent
    return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(d)
  }
  /** Per building, in the marks the chapters use — never a legacy id. */
  const perBuildingText = (
    col: ClientComparisonColumn,
    line: (b: ClientProposal['buildings'][number]) => string | null,
  ) => {
    const parts = col.proposal.buildings
      .map((b) => { const v = line(b); return v === null ? null : `${b.mark} · ${b.name}: ${v}` })
      .filter((v): v is string => v !== null)
    return parts.length > 0 ? parts.join(' · ') : absent
  }
  const result = t('vr3.client.varianten.group.result')
  const scope = t('vr3.client.varianten.group.scope')
  const quality = t('vr3.client.varianten.group.quality')
  return [
    {
      id: 'total',
      result: true,
      group: result,
      label: t('vr3.client.varianten.row.total'),
      cells: cols.map((c) => {
        const m = c.proposal.commercial
        return money(`${m.totalPrefix}${m.totalPrefix ? NNBSP : ''}${m.totalDisplay}${NNBSP}€`)
      }),
    },
    {
      id: 'lead-rate',
      result: true,
      group: result,
      label: t('comparison.leadRate'),
      cells: cols.map((c) =>
        `${money(c.proposal.commercial.leadRateText)} · ${c.proposal.commercial.leadRate.denominatorLabel}`),
    },
    {
      id: 'uncertainty',
      result: true,
      group: result,
      label: t('vr3.client.varianten.row.uncertainty'),
      cells: cols.map((c) => percent(`±${NNBSP}${c.proposal.commercial.uncertaintyPp}${NNBSP}%`)),
    },
    {
      id: 'bauzeit',
      result: true,
      group: result,
      label: `${t('vr3.client.schedule.duration')} · ${t('vr3.client.schedule.boundary')}`,
      cells: cols.map((c) => {
        const sch = c.proposal.schedule
        return money(`${sch.durationPrefix}${sch.durationPrefix ? NNBSP : ''}${sch.durationText}`)
      }),
    },
    {
      id: 'completion',
      result: true,
      group: result,
      label: t('vr3.client.schedule.completion'),
      cells: cols.map((c) => dateText(c.proposal.schedule.completionISO)),
    },
    {
      id: 'buildings',
      group: scope,
      label: t('vr3.client.varianten.row.buildings'),
      cells: cols.map((c) => c.proposal.buildings.length > 0
        ? c.proposal.buildings.map((b) => `${b.mark} · ${b.name}`).join(' · ')
        : absent),
    },
    {
      id: 'basement',
      group: scope,
      label: t('vr3.client.buildings.basement'),
      cells: cols.map((c) => perBuildingText(c, (b) => b.basementText)),
    },
    {
      id: 'bgf-below',
      group: scope,
      label: t('vr3.client.project.metric.bgfBelow'),
      cells: cols.map((c) => perBuildingText(c, (b) => b.bgfRSBelow)),
    },
    {
      id: 'energy-standard',
      group: quality,
      label: t('vr3.client.overview.energy'),
      cells: cols.map((c) =>
        c.proposal.overview.find((m) => m.id === 'energy')?.value ?? absent),
    },
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
