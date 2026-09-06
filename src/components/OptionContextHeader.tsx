import { useEffect, useId, useRef, useState } from 'react'
import { configForOption, useStore } from '../state/store'
import { scopeSelectedIds } from '../state/optionBuildingScope'
import {
  optionLifecycleState,
  optionOpenDestination,
  orderedOptions,
} from '../state/optionLifecycle'
import { optionLifecycleBadge } from './optionLabels'
import { demoProject, projectBaselineDrifted } from '../state/projectAnalysis'
import { Button } from './primitives'
import { useT } from '../i18n'
import { startContinuityTransition, useSemanticMotion } from '../design-system/motion'

/**
 * The Option context header — WHICH Option this work belongs to, on screen
 * the whole time it is being done.
 *
 * Accepted 2026-09-06 IA audit, "Configurator entry". The measured defect it
 * closes: `activeOptionId` was never rendered anywhere in the Option
 * workspace except as the value of an unlabelled `<select>` in a rail that is
 * now gone, and no Configurator surface named the Option it was mutating. A
 * seller with three Options could not tell, from the KG 400 page, which one
 * they were pricing.
 *
 * It is a PRODUCT COMPOSITION, not a canonical component: it composes the
 * released `Button` plus a switcher built from real controls, and it declares
 * no new Design System capability. It is also deliberately NOT a `nav`
 * landmark — at most two of those are allowed on screen (`Pfad` and the one
 * workflow rail), and a third would make the map harder to read, not easier.
 *
 * PROJECT IDENTITY IS NOT REPEATED HERE. The breadcrumb already carries
 * `Projekte / Wohnhof Lindenhain / Option 2`; this band carries the Option.
 *
 * WHY THE OPTION NAME IS NOT AN `h1`. The ticket's sketch calls it one, and
 * the first candidate obeyed literally — which put TWO `h1`s in one document
 * (this band and the work column's own page title) and broke every released
 * `getByRole('heading', { level: 1 })` contract in the browser suite, with
 * strict-mode violations rather than a debate. The product already has a
 * settled answer for a context band: `ProjectContextBar` renders the project
 * name as a `<p>` and lets the work column own the heading, because the band
 * is CONTEXT and the page title is the TASK. This follows it. Everything the
 * requirement was for survives: the section carries the Option name as its
 * accessible name, focus lands here on a switch, and a reader is told which
 * Option they are in before anything else on the screen.
 */

export const OPTION_HEADING_ATTR = 'data-option-heading'

function timeOfDay(iso: string, language: 'de' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export function baselineDate(iso: string, language: 'de' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(iso))
}

/**
 * Which day's project understanding this Option rests on, and whether the
 * understanding has moved since (scope addition B, CPO 2026-09-06).
 *
 * DISCLOSURE ONLY. An Option inherits the baseline BY VALUE at creation,
 * deliberately, under M-1/M-3 — a later re-analysis must never move an
 * Option's commercial base. That behaviour is correct and is unchanged here;
 * what was missing is that the user could not SEE it, and therefore assumed
 * every Option tracked the latest understanding. The drift line is
 * informational: no warning treatment, no lock, no gate, no predicate reads
 * it, and it is absent in `mode: 'praesentation'` because it is internal
 * orientation and not a client-facing warning (D-16/DC-7).
 */
export function useBaselineDisclosure(): {
  date: string | null
  drifted: boolean
} {
  const s = useStore()
  const baseline = s.projectBaseline
  const project = demoProject(s.opportunityId)
  const analysis = project ? s.projectAnalyses[project.id] : undefined
  if (!baseline) return { date: null, drifted: false }
  return {
    date: baseline.at,
    drifted: Boolean(project && analysis)
      && projectBaselineDrifted(project!, analysis!, baseline),
  }
}

export function OptionContextHeader() {
  const s = useStore()
  const t = useT()
  const nameId = useId()
  const headingRef = useRef<HTMLParagraphElement>(null)
  const { reduced } = useSemanticMotion()
  const optionId = s.activeOptionId
  const option = s.options.find((o) => o.id === optionId)
  const disclosure = useBaselineDisclosure()

  /**
   * Switching Option is a change of DOCUMENT, so focus follows it here — the
   * rail and the work column re-scope at the same moment and a keyboard user
   * would otherwise be left on a control that now belongs to something else.
   * Entering the workspace for the first time lands here too; App's own
   * scroll/focus reset owns every other route change, and takes focus to the
   * destination's own heading rather than back to this one.
   */
  const previous = useRef<string | null>(optionId)
  useEffect(() => {
    if (previous.current !== null && previous.current !== optionId && optionId) {
      headingRef.current?.focus({ preventScroll: true })
    }
    previous.current = optionId
  }, [optionId])

  if (!option || !optionId) return null

  const lifecycle = optionLifecycleState(s, optionId)
  const destination = optionOpenDestination(s, optionId)
  const badge = lifecycle ? optionLifecycleBadge(t, lifecycle, destination) : null
  const config = configForOption(s, optionId)
  const buildingCount = config ? scopeSelectedIds(config).length : 0
  const lastEvent = s.journal.filter((event) => event.optionId === optionId).at(-1)

  const facts = [
    // The lifecycle word already NAMES the stage where the distinction
    // matters (`In Arbeit · Kalkulieren`), so the stage is not stated twice.
    badge ? badge.label : null,
    buildingCount > 0
      ? t(buildingCount === 1
        ? 'vr3.option.meta.buildingsOne'
        : 'vr3.option.meta.buildings', { count: buildingCount })
      : null,
    lastEvent
      ? t('vr3.option.meta.changed', { at: timeOfDay(lastEvent.at, s.uiLanguage) })
      : null,
    disclosure.date
      ? t('vr3.option.meta.baseline', {
        date: baselineDate(disclosure.date, s.uiLanguage),
      })
      : null,
  ].filter((entry): entry is string => Boolean(entry))

  return (
    <section className="a3-optctx" aria-labelledby={nameId}>
      <div className="a3-optctx-identity">
        <p
          ref={headingRef}
          id={nameId}
          tabIndex={-1}
          {...{ [OPTION_HEADING_ATTR]: true }}
          className="a3-optctx-name"
        >
          {option.name}
        </p>
        <p className="a3-optctx-meta">{facts.join(' · ')}</p>
        {disclosure.drifted && (
          /* NEUTRAL. Not a warning, not a lock, not a gate — the Product
             deliberately holds no cross-option invalidation (M-1/M-3), and
             inventing one here would contradict a standing invariant. */
          <p className="a3-optctx-note">{t('vr3.option.baselineMoved')}</p>
        )}
      </div>
      <div className="a3-optctx-actions">
        <Button
          variant="secondary"
          onClick={() => startContinuityTransition(reduced, () => s.openOptionsStage())}
        >
          {t('vr3.option.allOptions')}
        </Button>
        <OptionSwitcher />
      </div>
    </section>
  )
}

/**
 * `Option wechseln` — every Option with its state and its resume point,
 * BEFORE the choice is made.
 *
 * It calls the released `openOption`, which is the internal preparation
 * navigation primitive and is unchanged. It has nothing to do with
 * `setViewedOption`: in `mode: 'praesentation'` this whole header is not
 * rendered at all, and `PresentationShell` keeps its own client-safe
 * switcher. That boundary was recorded as a QA rework on the now-retired
 * left rail — an interactive internal switcher on a client surface silently
 * flipped `activeOptionId` while presenting — and it is why the control
 * lives here, in a band the client projection never renders.
 */
function OptionSwitcher() {
  const s = useStore()
  const t = useT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const { reduced } = useSemanticMotion()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (s.options.length < 2) return null
  const rows = orderedOptions(s)

  return (
    <div ref={rootRef} className="a3-optsw">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className="a3-optsw-trigger hit-target"
        onClick={() => setOpen((current) => !current)}
      >
        {t('vr3.option.switch')}
        <span aria-hidden="true" className="a3-optsw-caret">▾</span>
      </button>
      {open && (
        <ul id={listId} role="menu" className="a3-optsw-menu">
          {rows.map((row) => {
            const entry = row.state
              ? optionLifecycleBadge(t, row.state, row.destination)
              : null
            const active = row.id === s.activeOptionId
            return (
              <li key={row.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  aria-current={active ? 'true' : undefined}
                  className={`a3-optsw-item hit-target${active ? ' a3-optsw-current' : ''}`}
                  onClick={() => {
                    setOpen(false)
                    if (!active) {
                      startContinuityTransition(reduced, () => s.openOption(row.id))
                    }
                  }}
                >
                  <span className="a3-optsw-name">{row.name}</span>
                  <span className="a3-optsw-state">
                    <span aria-hidden="true">{entry ? `${entry.sign} ` : ''}</span>
                    {entry ? entry.label : ''}
                    {active ? ` · ${t('vr3.option.activeMarker')}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
