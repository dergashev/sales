import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../state/store'
import {
  ANY,
  DEFAULT_PORTFOLIO_QUERY,
  LIFECYCLE_STATUSES,
  PORTFOLIO_PROJECTS,
  PORTFOLIO_SORTS,
  activeFilterCount,
  cityOptions,
  countryOptions,
  deadlineState,
  decodePortfolioQuery,
  encodePortfolioQuery,
  invalidatedCity,
  latestPresentableSnapshot,
  lifecycleStatusKey,
  lifecycleStatusTone,
  managerOptions,
  portfolioTitle,
  portfolioValue,
  selectPortfolio,
  type DeadlineState,
  type PortfolioAggregate,
  type PortfolioProject,
  type PortfolioQuery,
  type PortfolioSort,
} from '../state/projectPortfolio'
import { Button } from '../components/primitives'
import { Combobox } from '../components/controls'
import { FormField, SelectField } from '../components/designSystem'
import { EmptyState } from '../components/DataStates'
import { localizeMoneyText, useT } from '../i18n'
import { MediaFrame } from '../design-system/MediaFrame'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { projectAsset } from '../assets/project-media'
import { startContinuityTransition, useSemanticMotion } from '../design-system/motion'

/**
 * The Projects portfolio — the product's root register.
 *
 * It answers five questions without opening anything: which projects match
 * the country, city, manager or lifecycle state I need · which client
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

function formatDateTime(iso: string, language: Locale): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(intlTag(language), {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
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

export function OpportunityList() {
  const s = useStore()
  const t = useT()
  const language = s.uiLanguage as Locale
  const { reduced } = useSemanticMotion()
  const panelId = useId()
  const [query, applyQuery] = usePortfolioQuery()
  const [filtersOpen, setFiltersOpen] = useState(() => activeFilterCount(query) > 0)
  const [cityResetNotice, setCityResetNotice] = useState<string>('')
  const [announcedCount, setAnnouncedCount] = useState<number | null>(null)

  const countries = useMemo(() => countryOptions(PORTFOLIO_PROJECTS), [])
  const cities = useMemo(() => cityOptions(PORTFOLIO_PROJECTS, query.country), [query.country])
  const managers = useMemo(() => managerOptions(PORTFOLIO_PROJECTS), [])
  const shown = useMemo(() => selectPortfolio(PORTFOLIO_PROJECTS, query), [query])
  const filtersActive = activeFilterCount(query)
  const total = PORTFOLIO_PROJECTS.length

  // The result count is announced once the set has settled, never per
  // keystroke — a live region that fires on every letter is noise, not
  // access. The visible count updates immediately; only the announcement waits.
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncedCount(shown.length), 600)
    return () => window.clearTimeout(timer)
  }, [shown.length])

  const patch = (
    next: Partial<PortfolioQuery>,
    history: 'push' | 'replace' = 'push',
  ) => applyQuery({ ...query, ...next }, history)

  /**
   * Changing the country can invalidate the city. The reset is DELIBERATE
   * and announced once: the known failure class here is a dependent select
   * whose visible value and filtered state stop agreeing, and the only way
   * to be sure they agree is to clear the value in the same update that
   * changes its parent.
   */
  const changeCountry = (country: string) => {
    const stale = invalidatedCity(PORTFOLIO_PROJECTS, country, query.city)
    if (stale) {
      setCityResetNotice(t('portfolio.filter.cityReset', {
        city: stale,
        country: country === ANY ? t('portfolio.filter.any') : country,
      }))
    } else {
      setCityResetNotice('')
    }
    patch({ country, city: stale ? ANY : query.city })
  }

  const toggleStatus = (status: (typeof LIFECYCLE_STATUSES)[number], checked: boolean) => {
    patch({
      statuses: checked
        ? [...query.statuses, status]
        : query.statuses.filter((v) => v !== status),
    })
  }

  const clearAll = () => {
    setCityResetNotice('')
    applyQuery(DEFAULT_PORTFOLIO_QUERY)
  }

  const openProject = (id: string) => {
    startContinuityTransition(reduced, () => s.openOpportunity(id))
  }

  /**
   * The client view is reached through the EXISTING preflight, never around
   * it. This selects the project and the Option whose saved baseline is
   * client-valid, then opens `ClientOutputGateDialog` — the one gate in the
   * system — which re-checks the building scope and the save state itself
   * and is the only thing that may set presentation mode. Nothing here
   * decides that a client may see anything.
   */
  const openClientView = (id: string) => {
    const snapshot = latestPresentableSnapshot(s, id)
    if (!snapshot) return
    startContinuityTransition(reduced, () => {
      s.openOpportunity(id)
      s.openOption(snapshot.optionId)
      s.setGateOpen(true)
    })
  }

  const chips: Array<{ id: string; label: string; clear: () => void }> = [
    ...(query.text.trim() !== '' ? [{
      id: 'text',
      label: t('portfolio.filter.chip.text', { value: query.text.trim() }),
      clear: () => patch({ text: '' }),
    }] : []),
    ...(query.country !== ANY ? [{
      id: 'country',
      label: t('portfolio.filter.chip.country', { value: query.country }),
      clear: () => changeCountry(ANY),
    }] : []),
    ...(query.city !== ANY ? [{
      id: 'city',
      label: t('portfolio.filter.chip.city', { value: query.city }),
      clear: () => patch({ city: ANY }),
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
      <div className="a3-page px-7 py-6">
        <div className="a3-portfolio-head">
          <header className="a3-masthead a3-portfolio-headline">
            <div>
              <p className="a3-portfolio-eyebrow">
                {t('vr3.list.eyebrow', { count: total })}
              </p>
              <h1 className="a3-hero-title" tabIndex={-1} data-page-heading>
                {t('vr3.list.title')}
              </h1>
              <p className="a3-project-lede">{t('vr3.list.lead')}</p>
            </div>
          </header>
        </div>

        <div role="search" aria-label={t('portfolio.filter.legend')} className="a3-pf-toolbar mt-5">
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
                <div className="a3-pf-panel-grid">
                  <Combobox
                    id="portfolio-country"
                    label={t('portfolio.filter.country.label')}
                    value={query.country}
                    options={[
                      { value: ANY, label: t('portfolio.filter.any') },
                      ...countries.map((value) => ({ value, label: value })),
                    ]}
                    onChange={changeCountry}
                    placeholder={t('portfolio.filter.any')}
                  />
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
                </div>
                <fieldset className="a3-pf-status">
                  <legend>{t('portfolio.filter.status.legend')}</legend>
                  <div className="a3-pf-status-list">
                    {LIFECYCLE_STATUSES.map((status) => (
                      <label key={status} className="a3-pf-status-option">
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

        <div className="a3-pf-summary">
          <p className="a3-pf-count">
            {filtersActive === 0
              ? t('portfolio.result.all', { total })
              : shown.length === 0
                ? t('portfolio.result.none', { total })
                : shown.length === 1
                  ? t('portfolio.result.one', { total })
                  : t('portfolio.result.some', { count: shown.length, total })}
          </p>
        </div>
        {/* Two polite regions, two different facts. Merging them would make
            a city reset overwrite a result count that had just been read. */}
        <p className="sr-only" role="status" aria-live="polite">
          {announcedCount === null ? '' : (
            announcedCount === 1
              ? t('portfolio.result.one', { total })
              : t('portfolio.result.some', { count: announcedCount, total })
          )}
        </p>
        <p className="sr-only" role="status" aria-live="polite">{cityResetNotice}</p>

        {/* Two empty states, kept distinct. An account with no projects at
            all offers NO reset — there is nothing to reset — while a filter
            that matched nothing says so and offers exactly one way out. The
            account branch is unreachable while the register carries five
            fixtures; it is retained because it belongs to the capability,
            not to the fixture. */}
        {total === 0 ? (
          <div className="a3-empty-spec">
            <EmptyState>{t('opplist.emptyAccount.sentence')}</EmptyState>
            <p className="a3-project-lede">{t('opplist.emptyAccount.detail')}</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="a3-empty-spec">
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
          <ul className="a3-pf-list">
            {shown.map((project) => (
              /* Per-item identity: a card keeps its own boundary while the
                 set is re-ordered or narrowed, so a row that stays is seen
                 to move rather than to be replaced. */
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
                  onOpenClientView={project.displayOnly ? null : () => openClientView(project.id)}
                />
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────── card ──────────────────────────────── */

function PortfolioCard({
  project, language, onOpen, onOpenClientView,
}: {
  project: PortfolioProject
  language: Locale
  /** `null` for a display-only record: there is nothing to open. */
  onOpen: (() => void) | null
  onOpenClientView: (() => void) | null
}) {
  const s = useStore()
  const t = useT()
  const asset = projectAsset(project.heroAssetId)
  const title = portfolioTitle(project)
  const value = portfolioValue(project, s)
  const deadline = useDeadline(project.nextClientMeetingAt)

  const configureLabel = t('portfolio.card.configure')
  const clientViewLabel = t('portfolio.card.clientView')

  /**
   * The client view is never opened from here directly. A display-only
   * record has no Option at all; a real project needs a saved, client-valid
   * baseline, and the decision to show it belongs to the existing gate
   * modal — this button only says whether that gate is reachable and, when
   * it is, hands over to the project so the gate can ask its own questions.
   */
  const clientReady = !project.displayOnly
    && latestPresentableSnapshot(s, project.id) !== null

  /**
   * A display-only record states its reason ONCE, at card level, and both
   * blocked actions point at that one sentence. Passing it as each button's
   * own `disabledReason` printed it three times on one card — the same
   * duplicated-message defect this ticket removes from the account popover.
   */
  const clientViewBlockedReason = project.displayOnly
    ? undefined
    : clientReady ? undefined : t('portfolio.card.clientViewLocked')

  const displayOnlyReasonId = `${project.id}-display-only`
  const blockedBy = project.displayOnly ? displayOnlyReasonId : undefined

  const areaLabel = project.metrics.areaMetric === 'wfl'
    ? t('portfolio.card.wfl')
    : t('portfolio.card.nuf')

  return (
    <>
      <div
        className="a3-pf-media"
        /* Continuity belongs to a destination. A display-only record has
           none, so it carries no shared name and no transition can imply
           that clicking it goes somewhere. */
        style={onOpen ? { viewTransitionName: `project-media-${project.id}` } : undefined}
      >
        <MediaFrame
          ratio="card"
          state={asset ? 'loaded' : 'fallback'}
          src={asset?.url}
          alt={asset ? t(asset.altKey) : undefined}
          seed={project.id}
          sourceId={asset?.assetId}
        />
      </div>

      <div className="a3-pf-body">
        <div>
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
          <p className="a3-pf-parties">
            <span className="a3-pf-party"><b>{project.client}</b></span>
            <span className="a3-pf-party">
              {t('portfolio.filter.manager.label')}: {project.manager}
            </span>
          </p>
        </div>

        <dl className="a3-pf-metrics">
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

        <dl className="a3-pf-value">
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
        </dl>
        {/* Where the number came from, beside the number. A value's
            provenance in a separate metadata list is a value whose
            provenance nobody reads. */}
        {value.kind === 'amount' && (
          <p className="a3-pf-value-note">
            {t(value.provenance === 'syntheticPortfolioFixture'
              ? 'portfolio.card.value.synthetic'
              : 'portfolio.card.value.fromSnapshot', {
              date: formatDate(value.asOf, language),
            })}
          </p>
        )}

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
          <Button
            variant="secondary"
            disabled={!clientReady}
            disabledReason={clientViewBlockedReason}
            aria-describedby={blockedBy}
            aria-label={t('portfolio.card.actionOn', { action: clientViewLabel, name: title })}
            onClick={clientReady ? (onOpenClientView ?? undefined) : undefined}
          >
            {clientViewLabel}
          </Button>
        </div>

        {project.displayOnly && (
          <p id={displayOnlyReasonId} className="a3-pf-note">
            {t('portfolio.card.displayOnly')}
          </p>
        )}
      </div>

      <div className="a3-pf-aside">
        <div className="a3-pf-deadline" data-tone={deadline.kind === 'overdue' ? 'overdue' : deadline.kind === 'none' ? 'none' : 'scheduled'}>
          <p className="a3-pf-deadline-label">{t('portfolio.card.meeting.label')}</p>
          {deadline.kind === 'none' ? (
            <p className="a3-pf-deadline-value" data-none>
              {t('portfolio.card.meeting.none')}
            </p>
          ) : (
            <>
              <p className="a3-pf-deadline-value">
                <time dateTime={deadline.at}>{formatDateTime(deadline.at, language)}</time>
              </p>
              {deadline.kind === 'overdue' && (
                <p className="a3-pf-deadline-cue">
                  <span aria-hidden="true">!</span>
                  {t('portfolio.card.meeting.overdue')}
                </p>
              )}
              {deadline.kind === 'soon' && (
                <p className="a3-pf-deadline-cue">
                  <span aria-hidden="true">→</span>
                  {deadline.days <= 0
                    ? t('portfolio.card.meeting.today')
                    : deadline.days === 1
                      ? t('portfolio.card.meeting.tomorrow')
                      : t('portfolio.card.meeting.inDays', { count: deadline.days })}
                </p>
              )}
            </>
          )}
        </div>

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
      </div>
    </>
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

/**
 * The deadline against a clock that ticks.
 *
 * "in 5 days" is a claim about the moment it is read, so the classification
 * is recomputed on mount and once an hour afterwards. A card left open over
 * a lunch break must not still say "tomorrow" about yesterday.
 */
function useDeadline(iso: string | null): DeadlineState {
  const [now, setNow] = useState(() => Date.now())
  const timer = useRef<number>()
  useEffect(() => {
    timer.current = window.setInterval(() => setNow(Date.now()), 3_600_000)
    return () => window.clearInterval(timer.current)
  }, [])
  return useMemo(() => deadlineState(iso, now), [iso, now])
}
