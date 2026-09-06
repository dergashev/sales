import { Decimal } from 'decimal.js'
import type { Driver } from '../engine/calculate'
import { kgCatalogues, serviceById as kgServiceById } from '../engine/kgConfiguration'

/**
 * Authoritative boundary for the live client projection.
 *
 * Client mode is an allowlisted product projection, not a CSS variant. Every
 * route, chapter, level transition, and internal-only action consults this
 * module so a newly added navigation path cannot silently fall back to the
 * private workspace.
 */

export type OutputMode = 'intern' | 'praesentation'

export type PipelineView =
  | 'buildingScope' | 'konfigurator' | 'praesentieren' | 'vergleich' | 'export'
  | 'einstellungen' | 'grundlagen'

export type ProductLevel = 'liste' | 'opportunity' | 'option'

export type ProjectionVisibility = 'clientSafe' | 'internalOnly'

const CLIENT_VISIBLE_PIPELINE_VIEWS = new Set<PipelineView>([
  'buildingScope',
  'konfigurator',
  'vergleich',
  'export',
])

export function isClientProjection(mode: OutputMode): boolean {
  return mode === 'praesentation'
}

export function isVisibleInOutputProfile(
  mode: OutputMode,
  visibility: ProjectionVisibility,
): boolean {
  return visibility === 'clientSafe' || !isClientProjection(mode)
}

export function isClientVisiblePipelineView(view: PipelineView): boolean {
  return CLIENT_VISIBLE_PIPELINE_VIEWS.has(view)
}

export function pipelineViewForOutputProfile(
  mode: OutputMode,
  view: PipelineView,
): PipelineView {
  return isClientProjection(mode) && !isClientVisiblePipelineView(view)
    ? 'konfigurator'
    : view
}

export function isClientVisibleLevel(level: ProductLevel): boolean {
  return level === 'option'
}

/** Leaving the option workspace always leaves the client projection first. */
export function modeForLevelTransition(
  mode: OutputMode,
  nextLevel: ProductLevel,
): OutputMode {
  return isClientProjection(mode) && !isClientVisibleLevel(nextLevel) ? 'intern' : mode
}

const KG800_PRIVATE_DRIVER_PREFIX = 'kg800_'

/**
 * KG 800's financing breakdown is private by default (QA finding, ticket
 * "MAKE ALL KG 200-800 SELECTABLE…"): the itemized debt/fee/commitment
 * lines must stay internal unless a seller explicitly reveals them for the
 * current meeting via `kg800ClientRevealed`.
 *
 * The AMOUNT is not hidden — it is a real, already-calculated part of every
 * total shown to the client (rule 16: no fabricated zero, no hidden gap).
 * Only the ITEMIZATION is gated: the three `kg800_*` driver rows collapse
 * into one aggregate `KG 800 · Finanzierung` row whenever the breakdown must
 * stay private, so any client-visible driver list still sums exactly to the
 * same total (rule 32) instead of silently dropping money or contradicting
 * the hero figure.
 *
 * Every OfferPanel surface that renders `Driver[]` (the recap "Im Angebot
 * gewählt" list, the Herkunft origin popover, and the Kostentreiber table)
 * must read through this projection instead of the raw engine drivers —
 * that is the actual privacy boundary, not the KG 800 chapter being absent
 * from client-facing navigation (which only hides the chapter, not these
 * three other surfaces that independently render the full driver list).
 */
export function projectDriversForClient(
  drivers: readonly Driver[],
  mode: OutputMode,
  kg800ClientRevealed: boolean,
): Driver[] {
  if (!isClientProjection(mode) || kg800ClientRevealed) return [...drivers]
  const hidden = drivers.filter((d) => d.key.startsWith(KG800_PRIVATE_DRIVER_PREFIX))
  if (hidden.length === 0) return [...drivers]
  const visible = drivers.filter((d) => !d.key.startsWith(KG800_PRIVATE_DRIVER_PREFIX))
  const sum = hidden.reduce((acc, d) => acc.plus(d.exact), new Decimal(0))
  return [
    ...visible,
    {
      key: 'kg800_aggregate',
      origin: 'decision',
      block: 'separatePosition',
      exact: sum,
      label: 'KG 800 · Finanzierung',
      scopeRefs: ['KG 800'],
      basis: null,
    },
  ]
}

/**
 * Task 05 rework (QA AC-2): the engine's `Driver.label` is a fixed German
 * sentence (calculation-domain data, no i18n hook access there) — `tx()`'s
 * reverse lookup only matches WHOLE strings against the Codex delivery, so
 * every composed/interpolated driver label (energy standard code, building
 * class number, basement variant) fell through untranslated in EN mode.
 * `d.key` already carries the same semantic identity the label was built
 * from, so it is used here to recover a translatable form instead of
 * parsing the German text back apart. Reuses the Codex-delivered
 * `driver.*` keys where an exact concept match exists; the remainder are
 * hand-authored (see `src/i18n/index.ts`) because no delivery covers this
 * exact composed text.
 */
export function translatedDriverLabel(
  d: Pick<Driver, 'key' | 'label'>,
  t: (key: string, values?: Readonly<Record<string, string | number>>) => string,
  lang: 'de' | 'en' = 'de',
): string {
  /**
   * A KG service driver is a LOOKUP, not a reverse index.
   *
   * `kgDrivers` builds its label from `labelDe`, and this function's
   * fall-through returned that German string verbatim — so the rail's
   * `Im Angebot gewählt` recap listed `Wärmeerzeuger`, `Wärmeverteilung &
   * Sanitärinstallation` and `Elektroinstallation & Datennetz` to an English
   * reader. The catalogue stores both languages beside each other, exactly as
   * `translatedChangeLabel` already relies on, so the right label is one
   * lookup away and needs no delivery key at all.
   *
   * Pre-existing, and it grew with VR3-TGA-01: KG 400 now contributes named
   * engineering decisions to that list rather than three generic positions.
   */
  if (d.key.startsWith('kg_')) {
    const serviceId = d.key.slice(3)
    for (const catalogue of kgCatalogues()) {
      const service = kgServiceById(catalogue, serviceId)
      if (service) return lang === 'en' ? service.labelEn : service.labelDe
    }
  }
  if (d.key === 'basis') return t('driver.baseService')
  if (d.key === 'basis_s') return t('driver.baseServiceSpecialAreas')
  if (d.key.startsWith('gebaeudeform_')) return t('driver.buildingForm')
  const gkMatch = /^gebaeudeklasse_GK_(.+)$/.exec(d.key)
  if (gkMatch) {
    return `${t('driver.buildingClass', { class: gkMatch[1]! })}`
      + ` · ${t('driver.fireResistanceEnclosure')}`
  }
  const ehMatch = /^energiestandard_(.+)$/.exec(d.key)
  if (ehMatch) {
    return t('driver.energyStandard', { standard: ehMatch[1]!.replace(/_/g, ' ') })
  }
  if (d.key === 'untergeschoss_vollausbau') return t('driver.basementShellAndFitOut')
  if (d.key.startsWith('untergeschoss_')) return t('driver.basementFitOutOnly')
  if (d.key === 'tiefgarage_zuschlag') return t('driver.undergroundGarage')
  if (d.key === 'regionalfaktor') return t('driver.regionalFactor')
  if (d.key === 'kg800_aggregate') return `KG 800 · ${t('costGroup.KG_800')}`
  // Task 05 rework cycle 3 (QA AC-2, offer rail): the KG 300/400
  // excluded-adjustment rows (store.ts, `kgXXX_excluded_adjustment`) were
  // missing from this key-pattern match entirely and fell through to raw
  // German — the most material of the three cycle-3 findings, since KG
  // 300/400 start excluded by default (every fresh option shows this row).
  // Two states share one key, distinguished by the German label content
  // (the only signal this function receives, by design — see JSDoc above):
  // the resolved "ausgeschlossen" form has an exact Codex match, the rarer
  // unresolved "noch offen" form does not and is hand-authored instead.
  if (d.key === 'kg300_excluded_adjustment') {
    return d.label.endsWith('(noch offen)')
      ? t('driver.kg300Unresolved')
      : t('domain5.driver.kg300Excluded')
  }
  if (d.key === 'kg400_excluded_adjustment') {
    return d.label.endsWith('(noch offen)')
      ? t('driver.kg400Unresolved')
      : t('domain5.driver.kg400Excluded')
  }
  return d.label
}
