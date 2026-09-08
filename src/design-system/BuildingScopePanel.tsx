import { useId, type ReactNode } from 'react'
import { useT } from '../i18n'
import { SemanticStatus, type SemanticStatusTone } from './SemanticStatus'

/**
 * BuildingScopePanel — the canonical building-scope capability
 * (VR3-00 design delta: REFINE of "generic cards for building selection"
 * into "selection, identity image, metrics, provenance, edit and
 * per-building confirmation").
 *
 * ONE SYSTEM, TWO DENSITIES.
 *
 * The delta's reason for this capability existing is a single sentence:
 * "one- and multi-building cases need different density within one system".
 * A single building is a review, not a comparison — a one-row multi-select
 * table is a ceremony that asks the user to choose from a set of one. Three
 * buildings ARE a comparison, and the thing being compared is identity: use,
 * basement situation, storeys and scale. So the identity strip is the same
 * component in both cases and only its `density` differs, which is why a
 * project that gains a building does not gain a different screen.
 *
 * A METRIC NEVER LEAVES ITS BUILDING.
 *
 * Every value, every provenance line and every edit control renders inside
 * the baseline of exactly one named building, and that building's name is
 * in the accessible name of every control that acts on it. This is the
 * defect the capability exists to make structurally impossible: an area
 * read under the wrong identity is a commercial error, not a layout one.
 */

export type BuildingScopeDensity = 'single' | 'comparison'

/**
 * The stage shell. It owns the hierarchy — what the stage is, how far it has
 * got, and what it asks — and nothing else; the selection strip, the
 * baseline and the gate are composed in as slots by the product, which is
 * what keeps this a capability rather than a screen.
 */
export function BuildingScopePanel({
  eyebrow, heading, progress, lead, selection, baseline, gate, notice,
}: {
  eyebrow: string
  heading: ReactNode
  /** "0 von 3 bestätigt" — the completion count, always visible. */
  progress: string
  lead: ReactNode
  selection: ReactNode
  baseline: ReactNode
  gate?: ReactNode
  /** A stale or recovery message that concerns the whole scope. */
  notice?: ReactNode
}) {
  return (
    <div className="a3-bsp">
      <div className="a3-bsp-head">
        <div className="a3-bsp-head-copy">
          <p className="a3-bsp-eyebrow">{eyebrow}</p>
          <h1 className="a3-bsp-heading" tabIndex={-1} data-page-heading>{heading}</h1>
        </div>
        <p className="a3-bsp-progress">{progress}</p>
      </div>
      <p className="a3-bsp-lead">{lead}</p>
      {notice ? <div className="a3-bsp-notice">{notice}</div> : null}
      <div className="a3-bsp-selection">{selection}</div>
      <div className="a3-bsp-baseline">{baseline}</div>
      {gate ? <div className="a3-bsp-gate">{gate}</div> : null}
    </div>
  )
}

/**
 * The identity strip. A `group` of checkboxes, not a tablist: selection and
 * review focus are different questions, and a tab that also removes a
 * building from the offer would collapse them into one control.
 */
export function BuildingIdentityGroup({
  label, density, children,
}: {
  label: string
  density: BuildingScopeDensity
  children: ReactNode
}) {
  return (
    <fieldset
      className={density === 'single'
        ? 'a3-bsp-identities a3-bsp-identities-single'
        : 'a3-bsp-identities a3-bsp-identities-comparison'}
    >
      <legend className="sr-only">{label}</legend>
      {children}
    </fieldset>
  )
}

/**
 * The scope state of one building — the DECISION, not its bookkeeping.
 *
 * `included` / `excluded` / `reviewRequired` are the three the audit asked
 * for (Product Owner requirement 11), and the fourth exists because the
 * Product genuinely has it: a building that IS in scope and whose baseline
 * is already trusted is a different sentence from one still owing a
 * confirmation, and collapsing them would hide the only progress this
 * screen makes.
 */
export type BuildingScopeState =
  /** In the offer, baseline confirmed and current. */
  | 'confirmed'
  /** In the offer, baseline still owes a confirmation. */
  | 'included'
  /** In the offer, and something about it needs a human. */
  | 'reviewRequired'
  /** Deliberately not in the offer. */
  | 'excluded'

const SCOPE_TONE: Record<BuildingScopeState, SemanticStatusTone> = {
  confirmed: 'ok',
  included: 'neutral',
  reviewRequired: 'attention',
  excluded: 'unknown',
}

const SCOPE_KEY: Record<BuildingScopeState, string> = {
  confirmed: 'vr3.scope.state.confirmed',
  included: 'vr3.scope.state.included',
  reviewRequired: 'vr3.scope.state.reviewRequired',
  excluded: 'vr3.scope.state.excluded',
}

/**
 * One FULLY-WRITTEN class name per state, for the reason `WorkflowNavigator`
 * already records: `verify.py`'s DS-CLASS-EXISTS greps source for literal
 * `a3-*` names, and an interpolated suffix leaves it only the bare prefix to
 * match — so the styling of a state could go missing silently. It caught
 * exactly that here.
 */
const SCOPE_CLASS: Record<BuildingScopeState, string> = {
  confirmed: 'a3-sbc-confirmed',
  included: 'a3-sbc-included-open',
  reviewRequired: 'a3-sbc-reviewRequired',
  excluded: 'a3-sbc-excluded-state',
}

/** Icon plus text, never colour alone (rule 8) — one glyph per state. */
const SCOPE_GLYPH: Record<BuildingScopeState, string> = {
  confirmed: '✓',
  included: '■',
  reviewRequired: '!',
  excluded: '□',
}

/**
 * SelectableBuildingCard — the decision that controls the whole offer, drawn
 * like one (B2, Product Owner requirement 11;
 * navigation-and-blocker-patterns.md "Selectable building card").
 *
 * WHAT WAS WRONG. The released card put a small native checkbox beside the
 * words `Im Angebot`, with the confirmation state as a quiet chip on the
 * same line. The audit measured the consequence and named it precisely:
 * "inclusion is not visually dominant enough for a decision that controls
 * the whole offer", at 1440 and at 1280, and for a single building as much
 * as for three. Nothing was hidden — it was simply the quietest element on a
 * card whose entire purpose is that one choice.
 *
 * WHAT THIS IS. A COMPOUND, not a bag of booleans. Its parts are named
 * (`SelectionControl`, identity, `ScopeState`, `BaselineSummary`,
 * `OpenBaseline`) and each renders one fact, so a caller cannot produce a
 * card whose border says one thing and whose text says another: the border,
 * the checkbox, the glyph and the words all read the same `state`.
 *
 * The native checkbox REMAINS the semantic control. It is not replaced by a
 * styled div, a switch or a card-level click handler that fakes one — the
 * platform's own checked semantics are what assistive technology and forced
 * colours rely on. What changes is its size and its company: the whole
 * selection row is its label, so the target is the row rather than a 16 px
 * square, and nested links and buttons stop the toggle (rule 26) so
 * `Open baseline` never silently removes a building from the offer.
 *
 * ONE AND MANY. The composition does not change between a single building
 * and a complex; only its density does. A project that gains a building does
 * not gain a different screen, and a single-building Option still requires
 * an explicit included state rather than inheriting one.
 */
export function SelectableBuildingCard({
  name, designation, meta, media, state, onToggle, selectLabel,
  summary, reason, onOpenBaseline, openLabel, openAccessibleLabel, reviewing,
}: {
  /** The building's own name — "Kontorhaus". */
  name: string
  /** Its place in the project — "Gebäude A". Never the name on its own. */
  designation: string
  /** Use and basement situation, as words. */
  meta: string
  media?: ReactNode
  state: BuildingScopeState
  onToggle: () => void
  /** Accessible name of the selection control — contains the identity. */
  selectLabel: string
  /** The two or three numbers that make this building recognisable. */
  summary?: ReactNode
  /** Why this building needs a human, when it does. */
  reason?: string
  /** Opening this building's baseline. */
  onOpenBaseline?: () => void
  openLabel?: string
  /** Full accessible name; the visible label stays short (WCAG 2.5.3). */
  openAccessibleLabel?: string
  reviewing?: boolean
}) {
  const t = useT()
  const inputId = useId()
  const reasonId = useId()
  const included = state !== 'excluded'
  const classes = [
    'a3-sbc',
    included ? 'a3-sbc-included' : 'a3-sbc-excluded',
    SCOPE_CLASS[state],
    reviewing ? 'a3-sbc-reviewing' : '',
  ].filter(Boolean).join(' ')
  return (
    <div className={classes} data-scope-state={state}>
      {/* THE SELECTION ROW IS THE CONTROL. A `<label>` wrapping the whole
          row makes the row the checkbox's hit area, so the target is the
          decision and not a 16 px square — without inventing a click
          handler beside the native input, which is what would have
          desynchronised pointer from keyboard. */}
      <label className="a3-sbc-select" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          className="a3-sbc-input"
          checked={included}
          onChange={onToggle}
          aria-label={selectLabel}
          aria-describedby={reason ? reasonId : undefined}
        />
        <span className="a3-sbc-select-mark" aria-hidden="true">
          {included ? '✓' : ''}
        </span>
        <span className="a3-sbc-select-text">
          {t(included ? 'vr3.scope.selected' : 'vr3.scope.notSelected')}
        </span>
        <span className="a3-sbc-state">
          <SemanticStatus
            tone={SCOPE_TONE[state]}
            label={`${SCOPE_GLYPH[state]} ${t(SCOPE_KEY[state])}`}
            size="compact"
          />
        </span>
      </label>
      {media ? <div className="a3-sbc-media">{media}</div> : null}
      <div className="a3-sbc-body">
        <p className="a3-sbc-name">
          <span className="a3-sbc-designation">{designation}</span>
          <span aria-hidden="true" className="a3-sbc-sep"> · </span>
          <span className="a3-sbc-proper">{name}</span>
        </p>
        <p className="a3-sbc-meta">{meta}</p>
        {summary ? <div className="a3-sbc-summary">{summary}</div> : null}
        {reason ? <p className="a3-sbc-reason" id={reasonId}>{reason}</p> : null}
        {onOpenBaseline && openLabel ? (
          <button
            type="button"
            className="a3-sbc-open hit-target"
            /* Rule 26: a control inside a clickable container never
               actuates the container. Without this, opening a baseline
               would toggle the building out of the offer. */
            onClick={(event) => { event.stopPropagation(); onOpenBaseline() }}
            aria-pressed={reviewing === undefined ? undefined : Boolean(reviewing)}
            aria-label={openAccessibleLabel}
          >
            {openLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The selected building's baseline. Its heading NAMES the building, so the
 * table below it can never be read as belonging to another one, and the
 * whole sheet carries that building's overall authority.
 */
export function BuildingBaselineSheet({
  title, authorityLabel, rows, notice, actions, describedBy,
}: {
  title: ReactNode
  /** The building's overall information authority, as a word. */
  authorityLabel: ReactNode
  rows: ReactNode
  /** The consequence of an edit in flight, or a stale warning. */
  notice?: ReactNode
  actions: ReactNode
  describedBy?: string
}) {
  const headingId = useId()
  return (
    <section className="a3-bsp-baseline-sheet" aria-labelledby={headingId}>
      <div className="a3-bsp-baseline-head">
        <h2 className="a3-bsp-baseline-title" id={headingId}>{title}</h2>
        <p className="a3-bsp-baseline-authority">{authorityLabel}</p>
      </div>
      <dl className="a3-bsp-baseline-rows" aria-describedby={describedBy}>{rows}</dl>
      {notice ? <div className="a3-bsp-baseline-notice">{notice}</div> : null}
      <div className="a3-bsp-baseline-actions">{actions}</div>
    </section>
  )
}

/**
 * One baseline row: the fact, its value with its unit, and where the value
 * comes from. Three columns because those are three different questions,
 * and the provenance column is what makes the value inspectable without a
 * popover the user has to discover.
 */
export function BuildingBaselineRow({
  label, value, unit, provenance, control, invalid, actions,
}: {
  label: ReactNode
  /** Already formatted by the caller's canonical formatter. */
  value?: ReactNode
  unit?: ReactNode
  /**
   * Where the value comes from — rendered in its own column and bound to
   * the value by `aria-describedby`, so the value and its authority stay
   * ONE object without the value having to be printed a second time inside
   * the provenance envelope.
   */
  provenance: ReactNode
  /** An editor replacing the value in place, when the row is being edited. */
  control?: ReactNode
  /**
   * The row is carrying an invalid entry. It marks the ROW; the message
   * itself belongs to the field, which owns it and associates it with the
   * input — printing it here as well was the same sentence twice.
   */
  invalid?: boolean
  /** Edit / revert affordances for this fact. */
  actions?: ReactNode
}) {
  const provenanceId = useId()
  return (
    <div className={invalid ? 'a3-bsp-row a3-bsp-row-invalid' : 'a3-bsp-row'}>
      <dt className="a3-bsp-row-label">{label}</dt>
      <dd className="a3-bsp-row-value" aria-describedby={provenanceId}>
        {control ?? (
          <>
            <span className="numeric a3-bsp-row-number">{value}</span>
            {unit ? <span className="a3-bsp-row-unit">{unit}</span> : null}
          </>
        )}
      </dd>
      <dd className="a3-bsp-row-provenance" id={provenanceId}>
        {provenance}
        {actions ? <span className="a3-bsp-row-actions">{actions}</span> : null}
      </dd>
    </div>
  )
}

/**
 * The compact provenance line: authority as a word, the evidence that
 * supports it, and — when a value was replaced by hand — everything the
 * override kept. It never repeats the value: the row already carries it,
 * and printing it twice is the duplicated label this system avoids.
 */
export function BuildingBaselineProvenance({
  authority, evidence, override, stale,
}: {
  authority: { tone: SemanticStatusTone; label: string }
  evidence?: string
  override?: { previous: string; reason: string; actor: string; at: string; label: string }
  stale?: string
}) {
  return (
    <>
      <SemanticStatus tone={authority.tone} label={authority.label} size="compact" />
      {evidence ? <span className="a3-bsp-row-evidence">{evidence}</span> : null}
      {override ? <span className="a3-bsp-row-override">{override.label}</span> : null}
      {stale ? <span className="a3-bsp-row-stale">{stale}</span> : null}
    </>
  )
}
