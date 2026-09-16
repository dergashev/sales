import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { projectBaselineChangesSinceConfirmation, useStore } from '../state/store'
import {
  ANY,
  DEFAULT_PORTFOLIO_QUERY,
  PORTFOLIO_PROJECTS,
  PORTFOLIO_SORTS,
  activeFilterCount,
  cityOptions,
  clientOptions,
  decodePortfolioQuery,
  encodePortfolioQuery,
  managerOptions,
  portfolioPage,
  portfolioTitle,
  portfolioUnitValue,
  portfolioValue,
  resolveProjectLifecycles,
  selectPortfolio,
  type PortfolioAggregate,
  type PortfolioProject,
  type PortfolioQuery,
  type PortfolioRow,
  type PortfolioSort,
} from '../state/projectPortfolio'
import {
  LIFECYCLE_STATUSES,
  lifecycleStatusKey,
  lifecycleStatusTone,
  loadedOptionFacts,
  type LifecycleStatus,
} from '../state/projectLifecycle'
import { Button } from '../components/primitives'
import { Combobox } from '../components/controls'
import { FormField, SelectField } from '../components/designSystem'
import { EmptyState } from '../components/DataStates'
import { localizeMoneyText, useT } from '../i18n'
import { Pagination } from '../design-system/Pagination'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { startContinuityTransition, useSemanticMotion } from '../design-system/motion'

/**
 * The Projects portfolio — the product's root register.
 *
 * It answers five questions without opening anything: which projects match
 * the city, client, manager or lifecycle state I need · which client
 * meeting is next · what is this project's scale and latest value · can I
 * continue configuring it · is a client-ready presentation available.
 *
 * Four properties are structural, not stylistic:
 *
 * 1. **Five cards, two journeys.** Three records are `displayOnly` and live
 *    in a separate register (`projectPortfolio.ts`) that the workflow layer
 *    has never heard of. They cannot navigate because there is nothing to
 *    navigate TO — not because a handler declines. `onOpen` is simply never
 *    passed, the media carries no continuity name, and both actions are
 *    natively blocked with one card-level reason.
 * 2. **The next client meeting is the loudest thing on the card.** It is the
 *    presentation deadline, and it is the only fact on this screen that
 *    makes somebody act today. It gets its own column, a heading-size value,
 *    an accent rule, an exact localized date and time in a `<time>` element,
 *    a plain-language cue when it is close, and words — not colour — when it
 *    is overdue. When nothing is booked it says so and keeps its space: a
 *    collapsed row would make "no meeting" and "meeting not loaded" look
 *    identical.
 * 3. **The register never prices anything.** The value comes from the latest
 *    saved, presentation-eligible Option snapshot, or it says the price has
 *    not been determined. It is never 0 and it is never a sum of areas.
 * 4. **Search, filters and sort survive a reload.** They live in the URL, so
 *    back, forward and a copied link all restore the same register. Nothing
 *    else in this product uses the URL yet; this screen owns that little bit
 *    of it and touches no other state.
 *
 * Documentation state left this card deliberately. A document count answers
 * "how much did the analysis have to read", which matters INSIDE a project
 * and tells a portfolio manager nothing about which project to open next.
 */

/* ─────────────────────── URL as the register's state ────────────────── */

/**
 * The query, mirrored in `location.search`.
 *
 * Discrete choices push a history entry (Back undoes the filter you just
 * applied — the behaviour a person expects). Typing replaces it, because a
 * history entry per keystroke turns Back into a spell-checker.
 */
function usePortfolioQuery(): [
  PortfolioQuery,
  (next: PortfolioQuery, history?: 'push' | 'replace') => void,
] {
  const [query, setQuery] = useState<PortfolioQuery>(() => (
    typeof window === 'undefined'
      ? DEFAULT_PORTFOLIO_QUERY
      : decodePortfolioQuery(window.location.search)
  ))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => setQuery(decodePortfolioQuery(window.location.search))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const apply = useCallback((next: PortfolioQuery, history: 'push' | 'replace' = 'push') => {
    setQuery(next)
    if (typeof window === 'undefined') return
    const search = encodePortfolioQuery(next)
    const url = `${window.location.pathname}${search ? `?${search}` : ''}`
    if (history === 'push') window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
  }, [])

  return [query, apply]
}

/* ───────────────────────────── formatting ───────────────────────────── */

type Locale = 'de' | 'en'

function intlTag(language: Locale): string {
  return language === 'de' ? 'de-DE' : 'en-GB'
}

function formatDate(iso: string, language: Locale): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(intlTag(language), {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date)
}

/** Narrow no-break space between number and unit (rule 7), never a plain one. */
const NNBSP = ' '

function formatArea(value: string, language: Locale): string {
  const amount = new Intl.NumberFormat(intlTag(language), {
    maximumFractionDigits: 0,
  }).format(Number(value))
  return `${amount}${NNBSP}m²`
}

function formatCount(value: string | number, language: Locale): string {
  return new Intl.NumberFormat(intlTag(language)).format(Number(value))
}

/* ─────────────────────────────── screen ─────────────────────────────── */

export function OpportunityList({
  projects = PORTFOLIO_PROJECTS,
}: {
  /**
   * The register to show. Defaults to the canonical one; the parameter
   * exists so a test can prove the >10 pagination contract, which the
   * shipped five-project register cannot reach on its own. Product code
   * never passes it.
   */
  projects?: readonly PortfolioProject[]
} = {}) {
  const s = useStore()
  const t = useT()
  const language = s.uiLanguage as Locale
  const { reduced, fadeOnly } = useSemanticMotion()
  const panelId = useId()
  const [query, applyQuery] = usePortfolioQuery()
  const [filtersOpen, setFiltersOpen] = useState(() => activeFilterCount(query) > 0)
  const [announcement, setAnnouncement] = useState('')
  const countRef = useRef<HTMLParagraphElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const cities = useMemo(() => cityOptions(projects), [projects])
  const clients = useMemo(() => clientOptions(projects), [projects])
  const managers = useMemo(() => managerOptions(projects), [projects])

  /**
   * RESOLVE the lifecycle, then filter, then sort, then slice.
   *
   * This is the one place a status is produced, and everything below reads
   * the rows it returns — the cards, the status filter's results and the
   * count sentence. The register cannot show a status its filter would
   * disagree with, because there is no second value to disagree with.
   *
   * The Option facts are the OPEN project's only (`loadedOptionFacts`
   * returns `null` when no project is open): per-project storage means no
   * other project's Options are in memory, and the derivation treats an
   * absent fact as absent rather than as satisfied.
   */
  const baselineChanges = projectBaselineChangesSinceConfirmation(s)
  const rows = useMemo(() => resolveProjectLifecycles(projects, {
    analyses: s.projectAnalyses,
    readiness: s.projectReadiness,
    options: loadedOptionFacts({
      opportunityId: s.opportunityId,
      savedOptionVersions: s.savedOptionVersions,
      projectBaseline: s.projectBaseline,
      baselineChangesSinceConfirmation: baselineChanges,
    }),
  }), [
    projects, s.projectAnalyses, s.projectReadiness, s.opportunityId,
    s.savedOptionVersions, s.projectBaseline, baselineChanges,
  ])

  // Filter → sort the WHOLE result set → slice. Never the other way round.
  const shown = useMemo(() => selectPortfolio(rows, query), [rows, query])
  const page = portfolioPage(shown, query.page)
  const filtersActive = activeFilterCount(query)
  const total = projects.length

  /**
   * The one live count sentence, and the one thing announced about it.
   *
   * Paginated, the count IS the range — `1–10 von 23 Treffern · 48 im
   * Register` — because a reader on page 2 needs to know where they are,
   * not only how many matched. Unpaginated it is the four phrasings the
   * register has always had.
   */
  const countText = page.paginated
    ? (filtersActive > 0
      ? t('portfolio.result.page.filtered', {
        from: page.from, to: page.to, shown: page.total, total,
      })
      : t('portfolio.result.page.all', { from: page.from, to: page.to, total }))
    : filtersActive === 0
      ? t('portfolio.result.all', { total })
      : page.total === 0
        ? t('portfolio.result.none', { total })
        : page.total === 1
          ? t('portfolio.result.one', { total })
          : t('portfolio.result.some', { count: page.total, total })

  // The count is announced once the set has SETTLED, never per keystroke —
  // a live region that fires on every letter is noise, not access. The
  // visible line updates immediately; only the announcement waits. A page
  // change flows through the same region and the same settle, so there is
  // still exactly one voice for "what is in this list now".
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncement(countText), 600)
    return () => window.clearTimeout(timer)
  }, [countText])

  /**
   * Every query change except a page change returns to page 1.
   *
   * Enforced HERE, in the one function every control patches through,
   * rather than at each call site: a reset rule spread over six handlers is
   * a reset rule that one later control forgets, and the symptom — an empty
   * page 3 of a set that now has four matches — looks like a data bug.
   */
  const patch = (
    next: Partial<PortfolioQuery>,
    history: 'push' | 'replace' = 'push',
  ) => {
    const changesPageOnly = Object.keys(next).every((key) => key === 'page')
    applyQuery({ ...query, ...next, ...(changesPageOnly ? null : { page: 1 }) }, history)
  }

  /**
   * A page change: new rows, focus on the count, the list back in view.
   *
   * Focus goes to the count line because that is the sentence which just
   * changed meaning, and it is deliberately NOT a tab stop (`tabIndex=-1`)
   * — pagination must not buy its focus management with a permanent extra
   * stop in everybody else's keyboard path. `preventScroll` keeps that
   * focus from yanking the viewport to the page head; the scroll target is
   * the RESULT LIST, which is what the reader is actually returning to.
   */
  const goToPage = (next: number) => {
    patch({ page: next })
    countRef.current?.focus({ preventScroll: true })
    // Optional by design, not by accident: a non-browser host (jsdom, a
    // print pass) has no scrolling to do, and the focus move above is the
    // behaviour, not this.
    listRef.current?.scrollIntoView?.({
      block: 'start', behavior: reduced ? 'auto' : 'smooth',
    })
  }

  const toggleStatus = (status: LifecycleStatus, checked: boolean) => {
    patch({
      statuses: checked
        ? [...query.statuses, status]
        : query.statuses.filter((v) => v !== status),
    })
  }

  const clearAll = () => {
    applyQuery(DEFAULT_PORTFOLIO_QUERY)
  }

  const openProject = (id: string) => {
    startContinuityTransition(reduced, () => s.openOpportunity(id))
  }

  const chips: Array<{ id: string; label: string; clear: () => void }> = [
    ...(query.text.trim() !== '' ? [{
      id: 'text',
      label: t('portfolio.filter.chip.text', { value: query.text.trim() }),
      clear: () => patch({ text: '' }),
    }] : []),
    ...(query.city !== ANY ? [{
      id: 'city',
      label: t('portfolio.filter.chip.city', { value: query.city }),
      clear: () => patch({ city: ANY }),
    }] : []),
    ...(query.client !== ANY ? [{
      id: 'client',
      label: t('portfolio.filter.chip.client', { value: query.client }),
      clear: () => patch({ client: ANY }),
    }] : []),
    ...(query.manager !== ANY ? [{
      id: 'manager',
      label: t('portfolio.filter.chip.manager', { value: query.manager }),
      clear: () => patch({ manager: ANY }),
    }] : []),
    ...query.statuses.map((status) => ({
      id: `status-${status}`,
      label: t('portfolio.filter.chip.status', { value: t(lifecycleStatusKey(status)) }),
      clear: () => toggleStatus(status, false),
    })),
  ]

  return (
    <div className="a3-opportunities-canvas">
      <div className="a3-page px-7 py-5">
        {/* ONE head band, full width, two facts on one baseline: what this
            page is, and what is currently in it. The lede paragraph that
            used to sit here was fixture commentary read once ever and paid
            for on every visit; its one durable fact — that this is
            demonstration data — survives in the count line, which is also
            the only counter on the page. Two counters, one of which stops
            being true the moment a filter is applied, is the "one fact, two
            places" class this repository has been bitten by before. */}
        <header className="a3-portfolio-head">
          <h1 className="a3-portfolio-title" tabIndex={-1} data-page-heading>
            {t('vr3.list.title')}
          </h1>
          <p className="a3-pf-count" ref={countRef} tabIndex={-1}>
            {t('portfolio.result.line', {
              marker: t('portfolio.result.marker'), count: countText,
            })}
          </p>
        </header>

        <div role="search" aria-label={t('portfolio.filter.legend')} className="a3-pf-toolbar">
          <div className="a3-pf-toolbar-row">
            <FormField
              htmlFor="portfolio-search"
              label={t('portfolio.filter.search.label')}
            >
              <input
                id="portfolio-search"
                type="search"
                value={query.text}
                placeholder={t('portfolio.filter.search.placeholder')}
                onChange={(event) => patch({ text: event.target.value }, 'replace')}
              />
            </FormField>
            <SelectField
              id="portfolio-sort"
              label={t('portfolio.filter.sort.label')}
              value={query.sort}
              onChange={(event) => patch({ sort: event.target.value as PortfolioSort })}
            >
              {PORTFOLIO_SORTS.map((sort) => (
                <option key={sort} value={sort}>{t(`portfolio.sort.${sort}`)}</option>
              ))}
            </SelectField>
            <Button
              variant="secondary"
              aria-expanded={filtersOpen}
              aria-controls={panelId}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersActive > 0
                ? t('portfolio.filter.toggleCount', { count: filtersActive })
                : t('portfolio.filter.toggle')}
            </Button>
          </div>

          {/* DISCLOSURE: the panel reveals downward from the control that
              owns it and collapses back into it, so the relationship stays
              readable. Interruptible by construction — `AnimatePresence`
              reverses a running reveal instead of queueing behind it. */}
          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                id={panelId}
                className="a3-pf-panel"
                initial={reduced ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reduced ? { opacity: 1, height: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: reduced ? 0 : 0.2, ease: [0.25, 0.6, 0.3, 1] }}
                style={{ overflow: 'hidden' }}
              >
                {/* ONE grid — the comboboxes and the status set share it
                    instead of a grid stacked above a fieldset. That single
                    change is most of the panel's 196 → 138 px: the status
                    options are no longer paying for a row of their own. */}
                <div className="a3-pf-panel-grid">
                  <Combobox
                    id="portfolio-city"
                    label={t('portfolio.filter.city.label')}
                    value={query.city}
                    options={[
                      { value: ANY, label: t('portfolio.filter.any') },
                      ...cities.map((value) => ({ value, label: value })),
                    ]}
                    onChange={(city) => patch({ city })}
                    placeholder={t('portfolio.filter.any')}
                  />
                  <Combobox
                    id="portfolio-client"
                    label={t('portfolio.filter.client.label')}
                    value={query.client}
                    options={[
                      { value: ANY, label: t('portfolio.filter.any') },
                      ...clients.map((value) => ({ value, label: value })),
                    ]}
                    onChange={(client) => patch({ client })}
                    placeholder={t('portfolio.filter.any')}
                  />
                  <Combobox
                    id="portfolio-manager"
                    label={t('portfolio.filter.manager.label')}
                    value={query.manager}
                    options={[
                      { value: ANY, label: t('portfolio.filter.any') },
                      ...managers.map((value) => ({ value, label: value })),
                    ]}
                    onChange={(manager) => patch({ manager })}
                    placeholder={t('portfolio.filter.any')}
                  />
                  <fieldset className="a3-pf-status">
                    <legend>{t('portfolio.filter.status.legend')}</legend>
                    <div className="a3-pf-status-list">
                      {LIFECYCLE_STATUSES.map((status) => (
                        <label key={status} className="a3-pf-status-option hit-target">
                          <input
                            type="checkbox"
                            checked={query.statuses.includes(status)}
                            onChange={(event) => toggleStatus(status, event.target.checked)}
                          />
                          <span>{t(lifecycleStatusKey(status))}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {chips.length > 0 && (
            <div className="a3-pf-chips" role="group" aria-label={t('portfolio.filter.activeLegend')}>
              {chips.map((chip) => (
                <span key={chip.id} className="a3-pf-chip">
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    className="a3-pf-chip-remove"
                    aria-label={t('portfolio.filter.chip.remove', { label: chip.label })}
                    onClick={chip.clear}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </span>
              ))}
              <Button variant="ghost" onClick={clearAll}>
                {t('portfolio.filter.clearAll')}
              </Button>
            </div>
          )}
        </div>

        {/* Two polite regions, two different facts. Merging them would make
            a city reset overwrite a result count that had just been read. */}
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

        {/* Two empty states, kept distinct. An account with no projects at
            all offers NO reset — there is nothing to reset — while a filter
            that matched nothing says so and offers exactly one way out. The
            account branch is unreachable while the register carries five
            fixtures; it is retained because it belongs to the capability,
            not to the fixture. */}
        <div className="a3-pf-results" ref={listRef}>
          {total === 0 ? (
            <div className="a3-pf-empty">
              <EmptyState>{t('opplist.emptyAccount.sentence')}</EmptyState>
              <p className="a3-project-lede">{t('opplist.emptyAccount.detail')}</p>
            </div>
          ) : page.total === 0 ? (
            <div className="a3-pf-empty">
              <EmptyState
                action={(
                  <Button variant="secondary" onClick={clearAll}>
                    {t('portfolio.filter.clearAll')}
                  </Button>
                )}
              >
                {t('portfolio.empty.filtered')}
              </EmptyState>
              <p className="a3-project-lede">{t('portfolio.empty.filtered.detail')}</p>
            </div>
          ) : (
            /**
             * TWO different changes, two different meanings.
             *
             * A PAGE change is a REPLACEMENT: different records, same
             * position in the register. Keying the list on the page number
             * swaps the whole list and fades the new one in (`fadeOnly`) —
             * it must NOT animate as though rows physically re-ordered,
             * because they did not.
             *
             * A FILTER or SORT change is a RE-ORDERING of one set, so the
             * key is unchanged and `layout="position"` on each row lets a
             * record that survives be SEEN to move rather than be replaced.
             *
             * Deliberately no `AnimatePresence` here: an exiting page would
             * keep the previous ten cards in the DOM beside the new ten,
             * which is a duplicate register for a reader using a screen
             * reader and a delayed one for everybody else. The old page
             * leaves at once; the new one arrives explained.
             */
            <motion.ul
              key={page.page}
              className="a3-pf-list"
              variants={reduced ? undefined : fadeOnly}
              initial={reduced ? false : 'hidden'}
              animate={reduced ? undefined : 'visible'}
            >
              {page.rows.map((project) => (
                <motion.li
                  key={project.id}
                  layout={reduced ? false : 'position'}
                  transition={{ duration: reduced ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
                  className="a3-pf-card"
                  data-display-only={project.displayOnly || undefined}
                >
                  <PortfolioCard
                    project={project}
                    language={language}
                    onOpen={project.displayOnly ? null : () => openProject(project.id)}
                  />
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>

        {/* Controls only exist once there is something to page THROUGH: at
            ten matches or fewer the register is pixel-identical to the one
            without pagination at all. Neither empty state renders them. */}
        {page.paginated ? (
          <Pagination
            page={page.page}
            pageCount={page.pageCount}
            onPageChange={goToPage}
            ariaLabel={t('portfolio.pagination.label')}
            rangeLabel={t('portfolio.pagination.range', {
              from: page.from, to: page.to, total: page.total,
            })}
            pageButtonLabel={(n) => t('portfolio.pagination.page', { page: n })}
          />
        ) : null}
      </div>
    </div>
  )
}

/* ──────────────────────────────── card ──────────────────────────────── */

function PortfolioCard({
  project, language, onOpen,
}: {
  project: PortfolioRow
  language: Locale
  /** `null` for a display-only record: there is nothing to open. */
  onOpen: (() => void) | null
}) {
  const s = useStore()
  const t = useT()
  const title = portfolioTitle(project)
  const value = portfolioValue(project, s)
  const unitValue = portfolioUnitValue(value, project.metrics)

  const configureLabel = t('portfolio.card.configure')

  const displayOnlyReasonId = `${project.id}-display-only`
  const blockedBy = project.displayOnly ? displayOnlyReasonId : undefined

  const areaLabel = project.metrics.areaMetric === 'wfl'
    ? t('portfolio.card.wfl')
    : t('portfolio.card.nuf')

  /**
   * The RATE has a label of its own, and it says «cost».
   *
   * It used to borrow the area's label, on the theory that the number
   * («3.327 €/m²») carried the numerator. It does not when there is no
   * number: a card whose rate cannot be computed printed
   * `NUF nach DIN 277 · Preis nicht ermittelt` — an AREA that reads as
   * unmeasured — directly above a second cell with the same label and the
   * area's actual value. Two cells, one label, contradictory values.
   *
   * The label names the cost and nothing else (owner, 16.09.2026): the
   * denominator is written out in full one cell away, on the area this card
   * reports, so naming it twice on one card named nothing new and made the
   * shorter, more important word («Kosten») the tail of a standard's name.
   * Worth knowing: rule 39 requires a rate to name its denominator with its
   * norm, and this card now leans on the neighbouring cell for that. It is a
   * register of the reader's own projects, not a client deliverable — in the
   * offer itself the rate keeps its norm.
   */
  const rateLabel = t('portfolio.card.rate')

  return (
    <>
      <div className="a3-pf-body">
        <div className="a3-pf-identity">
          <div className="a3-pf-status-line">
            <SemanticStatus
              tone={lifecycleStatusTone(project.lifecycleStatus)}
              label={t(lifecycleStatusKey(project.lifecycleStatus))}
            />
          </div>
          <h2 className="a3-pf-title" lang={language}>
            {onOpen ? (
              <button type="button" className="a3-linkbtn" onClick={onOpen}>{title}</button>
            ) : title}
          </h2>
          {/* Client and manager on ONE line. Neither field is deleted —
              the two 20 px rows they used to occupy become one, because
              «who is this for» and «who owns it» are read together. */}
          <p className="a3-pf-parties">
            <span className="a3-pf-party"><b>{project.client}</b></span>
            <span className="a3-pf-party-sep" aria-hidden="true">·</span>
            <span className="a3-pf-party">
              {t('portfolio.filter.manager.label')}: {project.manager}
            </span>
          </p>
        </div>

        {/* The value leads the row, in the row's own format. */}
        <dl className="a3-pf-metrics">
          <div className="a3-pf-metric">
            <dt>
              {value.kind === 'amount' && value.coverage === 'subtotal'
                ? t('portfolio.card.value.subtotal')
                : t('portfolio.card.value')}
            </dt>
            <dd className="numeric" data-unknown={value.kind === 'notCalculated' || undefined}>
              {value.kind === 'notCalculated'
                ? t('portfolio.card.value.notCalculated')
                : `${localizeMoneyText(value.display, language)}${NNBSP}€`}
            </dd>
          </div>
          {/* The rate beside the total, in the same format. A total alone
              cannot answer «are we competitive»: €2.000/m² of housing and
              €2.000/m² of a 200-unit commercial block are different
              propositions, and the reader compares the RATE. Its label
              names the area it was divided by (rule 39) — the same area
              two cells further along, never a second, unnamed one. */}
          <div className="a3-pf-metric">
            <dt>{rateLabel}</dt>
            <dd className="numeric" data-unknown={unitValue.kind !== 'amount' || undefined}>
              {unitValue.kind === 'amount'
                ? `${formatCount(unitValue.value, language)}${NNBSP}€`
                : t('portfolio.card.value.notCalculated')}
            </dd>
          </div>
          <div className="a3-pf-metric">
            <dt>{t('portfolio.card.buildings')}</dt>
            <dd className="numeric">{formatCount(project.metrics.buildingCount, language)}</dd>
          </div>
          <AggregateMetric
            label={t('portfolio.card.bgf')}
            aggregate={project.metrics.bgfRSTotal}
            render={(v) => formatArea(v, language)}
          />
          <AggregateMetric
            label={areaLabel}
            aggregate={project.metrics.area}
            render={(v) => formatArea(v, language)}
          />
          <AggregateMetric
            label={t('portfolio.card.units')}
            aggregate={project.metrics.residentialUnits}
            render={(v) => formatCount(v, language)}
          />
        </dl>

        {/* The demonstration marker rides IN this row, not above it. The
            row already wraps, so one short caption beside two 44 px buttons
            costs zero rows — where the old full-width sentence cost 20 px
            plus a 16 px gap on three cards out of five. It is still the
            `aria-describedby` target of both blocked buttons: it is the
            reason they are inert, not decoration. */}
        <div className="a3-pf-actions">
          <Button
            variant="primary"
            disabled={!onOpen}
            aria-describedby={blockedBy}
            aria-label={t('portfolio.card.actionOn', { action: configureLabel, name: title })}
            onClick={onOpen ?? undefined}
          >
            {configureLabel}
          </Button>
          {project.displayOnly && (
            <p id={displayOnlyReasonId} className="a3-pf-note">
              {t('portfolio.card.displayOnly')}
            </p>
          )}
        </div>
      </div>

      {/* `align-content: space-between`: the meeting pinned to the top,
          the record dates pinned to the bottom, air between them. The
          column used to be `align-content: start` inside a border, which
          rendered 57–70 % emptiness as a tall box with its content
          stranded at the top — the register's single largest visual
          defect, present on the overdue card too. */}
      <div className="a3-pf-aside">
        {/* Both dates kept, both demoted to caption rows — label left,
            value right, 64 px → 32 px. No record is removed; two
            record-keeping dates simply stop outweighing the one fact that
            makes somebody act today. */}
        {/* ONE bottom band. The record dates and the CRM cross-references are
            both record-keeping metadata and they read as one block, so the
            aside still has exactly two children and `space-between` still
            means "urgency at the top, bookkeeping at the bottom" — adding a
            third child would have stranded the dates in mid-column. */}
        <div className="a3-pf-aside-meta">
          <dl className="a3-pf-dates">
            <div className="a3-pf-date">
              <dt>{t('portfolio.card.created')}</dt>
              <dd><time dateTime={project.createdAt}>{formatDate(project.createdAt, language)}</time></dd>
            </div>
            <div className="a3-pf-date">
              <dt>{t('portfolio.card.updated')}</dt>
              <dd><time dateTime={project.updatedAt}>{formatDate(project.updatedAt, language)}</time></dd>
            </div>
          </dl>

          <ProjectIntegrationLinks projectTitle={title} />
        </div>
      </div>
    </>
  )
}

/* ───────────────────── CRM placeholders on the card ─────────────────── */

/** The systems a project is cross-referenced in. Closed set, one label each. */
const INTEGRATION_TARGETS = [
  { id: 'hubspot', labelKey: 'portfolio.card.integrations.hubspot' },
  { id: 'missionControl', labelKey: 'portfolio.card.integrations.missionControl' },
] as const

/**
 * `Project in HubSpot` and `Project in Mission Control` — the two CRM
 * cross-references the register was asked for.
 *
 * They are DELIBERATELY inert, and inert in a way a reader can tell apart
 * from broken. Three properties make that true:
 *
 * 1. **They are real, enabled controls.** A disabled button would say "this
 *    project is not in HubSpot", which is a claim about the data. The truth
 *    is about the ENVIRONMENT — no integration is connected in a
 *    demonstration — so the control works, and what it returns is that
 *    sentence.
 * 2. **They write nothing.** No navigation, no history entry, no URL change,
 *    no store write, no journal event. The acknowledgement is component
 *    state that expires; nothing about the project or its Option can be
 *    different afterwards. That is the whole reason this is a placeholder
 *    and not a stub of an integration.
 * 3. **The acknowledgement has a reserved slot.** It appears in space the
 *    card already paid for, so pressing a metadata button never reflows the
 *    register — the same reservation rule the delta chip lives by.
 *
 * Tertiary weight comes from the canonical `ghost` Button variant, which
 * also carries the 44 px pointer and focus target. No local button.
 */
function ProjectIntegrationLinks({ projectTitle }: { projectTitle: string }) {
  const t = useT()
  const { reduced, fadeOnly } = useSemanticMotion()
  const [acknowledged, setAcknowledged] = useState<string>('')

  // The acknowledgement is transient by construction: it expires, and the
  // timer is cleared on unmount so a card that leaves the page (a filter, a
  // page change) cannot set state after it is gone.
  useEffect(() => {
    if (acknowledged === '') return
    const timer = window.setTimeout(() => setAcknowledged(''), 6000)
    return () => window.clearTimeout(timer)
  }, [acknowledged])

  const notice = t('portfolio.card.integrations.notConnected')

  return (
    <div className="a3-pf-links" role="group" aria-label={t('portfolio.card.integrations.legend')}>
      <p className="a3-pf-links-legend">{t('portfolio.card.integrations.legend')}</p>
      <div className="a3-pf-links-row">
        {INTEGRATION_TARGETS.map((target) => {
          const label = t(target.labelKey)
          return (
            <Button
              key={target.id}
              variant="ghost"
              className="a3-pf-link"
              aria-label={t('portfolio.card.actionOn', { action: label, name: projectTitle })}
              /* Re-pressing the same button must re-announce. Restating the
                 sentence on an unchanged string would be silent in a live
                 region, so the target id makes each press a new value while
                 the SENTENCE stays the one string above. */
              onClick={() => setAcknowledged(
                acknowledged === target.id ? `${target.id} ` : target.id,
              )}
            >
              {label}
            </Button>
          )
        })}
      </div>
      {/* Reserved slot: present in the layout whether or not it has words. */}
      <div className="a3-pf-links-notice">
        <AnimatePresence initial={false}>
          {acknowledged !== '' && (
            <motion.p
              key={acknowledged}
              variants={reduced ? undefined : fadeOnly}
              initial={reduced ? false : 'hidden'}
              animate={reduced ? undefined : 'visible'}
              exit={reduced ? undefined : 'hidden'}
            >
              {notice}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {acknowledged !== '' ? notice : ''}
      </p>
    </div>
  )
}

/**
 * A metric that may not be fully known.
 *
 * `incomplete` prints words and the two counts, never the partial sum: a
 * number under the label "Total NUF" claims the project total, and the
 * sources do not support that claim.
 */
function AggregateMetric({
  label, aggregate, render,
}: {
  label: string
  aggregate: PortfolioAggregate
  render: (value: string) => string
}) {
  const t = useT()
  return (
    <div className="a3-pf-metric">
      <dt>{label}</dt>
      <dd className="numeric" data-unknown={aggregate.kind !== 'exact' || undefined}>
        {aggregate.kind === 'exact' ? render(aggregate.value)
          : aggregate.kind === 'incomplete'
            ? t('portfolio.card.incomplete', {
              known: aggregate.knownCount, total: aggregate.applicableCount,
            })
            : t('portfolio.card.unknown')}
      </dd>
    </div>
  )
}

