import { AnimatePresence, motion } from 'framer-motion'
import { hasV3Surfaces } from '../lib/variantLock'
import {
  useCallback, useEffect, useId, useMemo, useRef, useState,
} from 'react'
import {
  configForOption,
  latestSavedOptionVersion,
  optionCommercialProjectionFor,
  useStore,
} from '../state/store'
import { scopeSelectedIds } from '../state/optionBuildingScope'
import {
  optionDisplayName,
  orderedOptions,
  type OrderedOption,
} from '../state/optionLifecycle'
import {
  OPTIONS_PAGE_SIZE,
  decodeOptionsPage,
  encodeOptionsPage,
  optionsPage,
} from '../state/projectOptionsView'
import {
  optionLifecycleBadge,
  optionOpenActionLabel,
} from '../components/optionLabels'
import { Pagination } from '../design-system/Pagination'
import { ProjectReadiness } from '../design-system/ActionGate'
import { Button } from '../components/primitives'
import { Decimal } from 'decimal.js'
import { label as moneyLabel, present } from '../engine/money'
import { useT, useTx, localizeMoneyText } from '../i18n'
import { Badge, FormField } from '../components/designSystem'
import { useBaselineDisclosure, baselineDate } from '../components/OptionContextHeader'
import { CreateOptionButton } from '../components/OptionCreation'
import { startContinuityTransition, useSemanticMotion } from '../design-system/motion'
import { OptionMetricSummary } from '../design-system/OptionMetricSummary'
import { useOptionMetricLabels } from '../components/optionMetrics'
import type { FixtureProject, ProjectAnalysis } from '../state/projectAnalysis'

/**
 * `Optionen` — the HOME of every Option of a project.
 *
 * Accepted 2026-09-06 Project → Option → Configurator IA audit, target frames
 * T-02, T-03 and T-05. What it replaces was measured, not disliked: the
 * collection had no destination at all. It rendered inside
 * `projectStage: 'createOption'`, so the home of every Option was a surface
 * named after the act of creating one, returning to a project landed there,
 * `activeOptionId` was never referenced in this file (verified by DOM probe
 * with three Options — no `aria-current` on any card), `Preis nicht ermittelt`
 * was the visually dominant element of every card, Options 2+ printed
 * `Unterschied zu Option 1 · —`, and the heading read `Opportunity Options`
 * in untranslated English inside the `de` locale.
 *
 * Four properties define the surface now:
 *
 * 1. **The active Option is visible.** `● Aktiv` plus `aria-current="page"`,
 *    driven by `activeOptionId` and NEVER by `resolvedViewedOptionId()` —
 *    the presented Option is a client-mode selection and has no business
 *    marking internal preparation work.
 * 2. **Every action names its destination**, from the one deterministic
 *    function the store's own `openOption` navigates by.
 * 3. **Order is work, not chronology alone.** Incomplete first, then most
 *    recently changed — so the active Option is on the first screen.
 * 4. **A number is a commitment.** The metric is the SAVED version's total
 *    with its own Declared Pricing Scope label (R-18); an Option that has
 *    never been saved says `Preis nicht ermittelt`, quietly, as a secondary
 *    line rather than as the loudest thing on the card.
 */

/**
 * A SAVED total, formatted by the canonical formatter from the value that
 * was committed.
 *
 * `totalDisplay` on a saved version is the bare numeral the user read; the
 * unit and the approximation mark belong to `label(present(...))`, which is
 * the one place in this product that decides both. Re-deriving them from
 * `totalExact` through that function means the card cannot print `6.480.000`
 * where every other surface prints `6.480.000 €`, and cannot drop an `≈`
 * that the rounding rule says is owed.
 */
function savedTotal(exact: string, language: 'de' | 'en'): string {
  return localizeMoneyText(moneyLabel(present(new Decimal(exact))), language)
}

function dayStamp(iso: string, language: 'de' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(iso))
}

function timeStamp(iso: string, language: 'de' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

/* ────────────────────────────── one Option ───────────────────────────── */

function OptionRow({
  row, active, justCreated,
}: {
  row: OrderedOption
  active: boolean
  justCreated: boolean
}) {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const { fadeRise, reduced } = useSemanticMotion()
  const [renaming, setRenaming] = useState(false)
  /* The base Option is read under its own label while it still carries the
     placeholder name, so everything that shows or edits a name shows THAT. */
  const v3 = hasV3Surfaces(s.navVariant)
  const deletable = s.optionDeleteBlock(row.id) === null
  const name = v3 ? optionDisplayName(row, t('vr3.option.baseName')) : row.name
  const [draftName, setDraftName] = useState(name)
  const [renameError, setRenameError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const nameFieldId = useId()
  const nameId = useId()
  const disclosure = useBaselineDisclosure()
  const metricLabels = useOptionMetricLabels()
  const projection = optionCommercialProjectionFor(s, row.id)

  useEffect(() => {
    if (!renaming) return
    nameInputRef.current?.focus()
    nameInputRef.current?.select()
  }, [renaming])

  function commitRename() {
    const next = draftName.trim()
    if (!next || next === name) {
      setRenaming(false)
      setRenameError(null)
      setDraftName(name)
      return
    }
    if (s.options.some((o) => o.id !== row.id && o.name === next)) {
      setRenameError(t('vr3.option.nameTaken', { name: next }))
      return
    }
    setRenaming(false)
    setRenameError(null)
    s.renameOption(row.id, next)
  }

  // M-3: a sent Option is an immutable snapshot and cannot be renamed. The
  // same field that names the snapshot answers "was this ever sent?".
  const sent = s.snapshots.some((snapshot) => snapshot.optionId === row.id)
  const config = configForOption(s, row.id)
  const buildings = config
    ? scopeSelectedIds(config)
      .map((id) => config.scopeBuildings.find((b) => b.id === id)?.name)
      .filter((name): name is string => Boolean(name))
    : []
  const saved = latestSavedOptionVersion(s, row.id)
  const badge = row.state ? optionLifecycleBadge(t, row.state, row.destination) : null

  const facts = [
    buildings.length > 0
      ? t(buildings.length === 1
        ? 'vr3.option.meta.buildingsOne'
        : 'vr3.option.meta.buildings', { count: buildings.length })
      : null,
    buildings.length > 0 && buildings.length <= 3 ? buildings.join(' · ') : null,
    // Scope addition B: WHICH day's understanding this Option rests on. An
    // Option inherits the baseline by value at creation (M-1/M-3) and that is
    // correct — what was missing is that nobody could see it.
    disclosure.date
      ? t('vr3.option.meta.baseline', {
        date: baselineDate(disclosure.date, s.uiLanguage),
      })
      : null,
    saved
      ? t('vr3.option.meta.savedTotal', {
        date: dayStamp(saved.savedAt, s.uiLanguage),
        version: saved.version,
        label: tx(saved.result.totalLabel),
        total: savedTotal(saved.result.totalExact, s.uiLanguage),
      })
      : null,
    /**
     * `noch nicht konfiguriert` is a claim about the OPTION, not about the
     * journal, so it is made from the lifecycle state. The journal is
     * session state and does not survive a reload; saying "not configured
     * yet" merely because no event is in memory contradicted the badge
     * beside it, which reads the persisted configuration and correctly said
     * `In Arbeit · Kalkulieren` — observed live after a reload at 1280.
     */
    row.lastChangedAt
      ? t('vr3.option.meta.changed', {
        at: timeStamp(row.lastChangedAt, s.uiLanguage),
      })
      : row.state === 'NEW' ? t('vr3.option.meta.notConfigured') : null,
  ].filter((entry): entry is string => Boolean(entry))

  const open = () => startContinuityTransition(reduced, () => s.openOption(row.id))

  return (
    <motion.li
      data-option-id={row.id}
      tabIndex={-1}
      variants={fadeRise}
      initial={justCreated ? 'hidden' : false}
      animate="visible"
      aria-current={active ? 'page' : undefined}
      aria-labelledby={nameId}
      className={`a3-optrow${v3 && row.isBase ? ' a3-optrow-base' : ''}${
        active ? ' a3-optrow-active' : ''}${justCreated ? ' a3-flash' : ''}`}
    >
      <div className="a3-optrow-head">
        <div className="a3-optrow-identity">
          {renaming ? (
            <FormField
              label={t('vr3.option.nameLabel')}
              htmlFor={nameFieldId}
              error={renameError}
            >
              <input
                ref={nameInputRef}
                id={nameFieldId}
                value={draftName}
                onChange={(event) => {
                  setDraftName(event.target.value)
                  setRenameError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') { event.preventDefault(); commitRename() }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setDraftName(name)
                    setRenameError(null)
                    setRenaming(false)
                  }
                }}
                onBlur={commitRename}
              />
            </FormField>
          ) : (
            <h2 id={nameId} className="a3-optrow-name">{name}</h2>
          )}
          <span className="a3-optrow-badges">
            {active && (
              <Badge sign="●">{t('vr3.option.activeMarker')}</Badge>
            )}
            {badge && <Badge sign={badge.sign}>{badge.label}</Badge>}
          </span>
        </div>
        <div className="a3-optrow-value">
          {/* B2 · requirement 9 — ONE shared projection, so this card, the
              Offer panel, Calculate, the cost detail and the exports state
              the same money over the same denominators. What used to stand
              here was the SAVED version's receipt, which is a different
              claim: it stated a committed total beside a stage that had
              since moved, and it could not carry a segment metric or the
              Energy standard at all. The saved receipt is still on the card
              — as the dated fact it is, in the meta line below.

              `null` keeps the released absence: an Option whose result
              cannot be derived says so and never prints a zero (rule 16). */}
          {projection ? (
            <OptionMetricSummary
              projection={projection}
              language={s.uiLanguage}
              variant="card"
              labels={metricLabels}
            />
          ) : (
            <>
              <span className="a3-optrow-valuelabel">{t('vr3.rail.status.subtotal')}</span>
              {/* Quiet, secondary, and never the loudest thing on the card. */}
              <span className="a3-optrow-pending">{t('money.priceNotDetermined')}</span>
            </>
          )}
        </div>
      </div>
      <p className="a3-optrow-meta">{facts.join(' · ')}</p>
      {disclosure.drifted && (
        /* Scope addition B, second half. NEUTRAL and informational: no
           warning treatment, no lock, no gate, no stage state changes, and
           no predicate reads it. The Product deliberately holds no
           cross-option invalidation (M-1/M-3, audit OPT-12) and this line
           does not introduce one — it states the truth the Product already
           holds instead of letting the reader assume the opposite. */
        <p className="a3-optrow-note">{t('vr3.option.baselineMoved')}</p>
      )}
      {/* THE ACT FIRST, IN THE DOM AND ON THE SCREEN.
          `Rename` used to come first in source order and therefore first in
          the tab order, so the keyboard reached the housekeeping control
          before the one action the row exists for. Reversing them here —
          rather than with `row-reverse` in CSS — keeps reading order,
          focus order and visual order the same thing. */}
      <div className="a3-optrow-actions">
        <Button variant={active ? 'primary' : 'secondary'} onClick={open}>
          {optionOpenActionLabel(t, row.state, row.destination)}
        </Button>
        {!sent && !renaming && (
          <Button
            variant="ghost"
            onClick={() => { setDraftName(name); setRenaming(true) }}
          >
            {t('vr3.option.rename')}
          </Button>
        )}
        {/* Deleting is offered only where it is ALLOWED: never on the base
            Option the others depart from, never on one that was already
            sent (its snapshot is immutable, M-3). A control that is drawn
            and then refuses would have to explain itself on every row it
            can never act on. Undo is the journal's (DC-29). */}
        {v3 && !renaming && deletable && (
          <Button variant="ghost" onClick={() => s.deleteOption(row.id)}>
            {t('vr3.option.delete')}
          </Button>
        )}
      </div>
    </motion.li>
  )
}

/* ────────────────────────── the Optionen surface ──────────────────────── */

export function OptionsWorkspace({
  project, analysis, justCreatedOptionId,
}: {
  project: FixtureProject
  analysis: ProjectAnalysis
  justCreatedOptionId: string | null
}) {
  const s = useStore()
  const t = useT()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(() => (
    typeof window === 'undefined' ? 1 : decodeOptionsPage(window.location.search)
  ))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => setPage(decodeOptionsPage(window.location.search))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const goToPage = useCallback((next: number) => {
    setPage(next)
    if (typeof window === 'undefined') return
    const search = encodeOptionsPage(next, window.location.search)
    const url = `${window.location.pathname}${search ? `?${search}` : ''}`
    window.history.pushState(null, '', url)
  }, [])

  const rows = useMemo(() => orderedOptions(s), [s])
  const view = optionsPage(rows, page, OPTIONS_PAGE_SIZE)
  const v3 = hasV3Surfaces(s.navVariant)

  /**
   * A newly created Option takes focus, on its own row.
   *
   * The list is ordered base-first and then by creation, so a new Option is
   * the LAST row — which is a page of its own once the collection is longer
   * than one page. The page follows the new row before focus looks for it;
   * without that, focus would search a page the row is not on.
   */
  useEffect(() => {
    if (!justCreatedOptionId) return
    const at = hasV3Surfaces(s.navVariant)
      ? rows.findIndex((row) => row.id === justCreatedOptionId)
      : -1
    if (at >= 0) {
      const target = Math.floor(at / OPTIONS_PAGE_SIZE) + 1
      if (target !== page) { goToPage(target); return }
    }
    // The row is addressed by its OPTION, not by a forwarded ref: the row is
    // a `motion.li`, and framer-motion attaches an external ref through its
    // own effect, so a parent effect can observe it still `null` on the very
    // commit that first renders the new row — which is precisely the commit
    // that has to move focus.
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-option-id="${justCreatedOptionId}"]`,
    )
    row?.scrollIntoView?.({ block: 'nearest' })
    row?.focus()
  }, [justCreatedOptionId, rows, page, goToPage, s.navVariant])

  const empty = rows.length === 0

  return (
    <div className="a3-options">
      {!empty && (
        <div className="a3-options-head">
          <h1
            ref={headingRef}
            tabIndex={-1}
            data-page-heading
            className="a3-options-title"
          >
            {t('vr3.options.stage')}
            <span className="a3-options-count">
              {' · '}
              <span className="numeric">{rows.length}</span>
            </span>
          </h1>
          <div className="a3-options-head-actions">
            {/* A cross-Option destination of the PROJECT, beside the action
                that makes the Options it compares — the two answers to
                "what now" stand together instead of one of them living as
                a link under the fold. */}
            {v3 && rows.length > 1 && (
              <Button variant="secondary" onClick={() => s.openComparison()}>
                {t('nav.vergleich')}
              </Button>
            )}
            <CreateOptionButton
              project={project}
              analysis={analysis}
              variant="secondary"
              label={t('vr3.options.createFurther')}
            />
          </div>
        </div>
      )}

      {empty ? (
        /* The canonical readiness capability, on the surface it was built
           for: "the project's lifecycle and next action as the first
           hierarchy on the page", with exactly one primary action and no
           result anatomy mounted behind zeros. It owns the `h1` in this
           branch, which is why the collection's own head is not rendered
           above it — one page, one title. */
        <ProjectReadiness
          eyebrow={t('vr3.options.stage')}
          heading={t('vr3.options.emptyHeading')}
          explanation={t('vr3.options.emptyLead')}
          rows={[]}
          action={(
            <CreateOptionButton
              project={project}
              analysis={analysis}
              variant="primary"
              label={t('vr3.readiness.createOption')}
            />
          )}
        />
      ) : (
        <>
          <ul ref={listRef} className="a3-options-list">
            <AnimatePresence initial={false}>
              {view.rows.map((row) => (
                <OptionRow
                  key={row.id}
                  row={row}
                  active={row.id === s.activeOptionId}
                  justCreated={row.id === justCreatedOptionId}
                />
              ))}
            </AnimatePresence>
          </ul>

          {view.paginated && (
            <Pagination
              page={view.page}
              pageCount={view.pageCount}
              onPageChange={goToPage}
              ariaLabel={t('vr3.options.pagesLabel')}
              rangeLabel={t('vr3.options.range', {
                from: (view.page - 1) * OPTIONS_PAGE_SIZE + 1,
                to: Math.min(view.page * OPTIONS_PAGE_SIZE, view.total),
                total: view.total,
              })}
              pageButtonLabel={(n) => t('vr3.options.pageLabel', { n })}
            />
          )}

          {/* A cross-Option destination of the PROJECT, offered where the
              collection is — never a numbered step beneath a rail. In `v3`
              it stands in the head beside «create», so it is not repeated
              here. */}
          {!v3 && rows.length > 1 && (
            <p className="a3-options-links">
              <button
                type="button"
                className="a3-linkbtn hit-target"
                onClick={() => s.openComparison()}
              >
                {t('nav.vergleich')}
              </button>
            </p>
          )}
        </>
      )}
    </div>
  )
}
