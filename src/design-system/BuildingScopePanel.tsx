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

export type BuildingIdentityStatus = 'confirmed' | 'stale' | 'open' | 'unselected'

const STATUS_TONE: Record<BuildingIdentityStatus, SemanticStatusTone> = {
  confirmed: 'ok',
  stale: 'stale',
  open: 'neutral',
  unselected: 'unknown',
}

const STATUS_KEY: Record<BuildingIdentityStatus, string> = {
  confirmed: 'vr3.scope.status.confirmed',
  stale: 'vr3.scope.status.stale',
  open: 'vr3.scope.status.open',
  unselected: 'vr3.scope.status.unselected',
}

/**
 * One building's identity: what it looks like, what it is called, what it is
 * for, and whether it is in scope.
 *
 * The image supports recognition — three buildings on one screen are told
 * apart by their facades long before their names are read — and it NEVER
 * replaces a label: the name, the use and the basement situation are text,
 * present whether the image loads or not.
 */
export function BuildingIdentityCard({
  name, designation, meta, media, selected, status, onToggle, onReview, reviewing,
  reviewLabel, reviewAccessibleLabel, selectLabel,
}: {
  /** The building's own name — "Kontorhaus". */
  name: string
  /** Its place in the project — "Gebäude A". Never the name on its own. */
  designation: string
  /** Use and basement situation, as words. */
  meta: string
  media?: ReactNode
  selected: boolean
  status: BuildingIdentityStatus
  onToggle: () => void
  /** Opening this building's baseline. Absent when it is the only one. */
  onReview?: () => void
  reviewing?: boolean
  reviewLabel?: string
  /** Full accessible name; the visible label stays short (WCAG 2.5.3). */
  reviewAccessibleLabel?: string
  /** Accessible name of the selection control — contains the identity. */
  selectLabel: string
}) {
  const t = useT()
  const inputId = useId()
  const classes = [
    'a3-bsp-identity',
    selected ? 'a3-bsp-identity-selected' : 'a3-bsp-identity-excluded',
    reviewing ? 'a3-bsp-identity-reviewing' : '',
  ].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      {media ? <div className="a3-bsp-identity-media">{media}</div> : null}
      <div className="a3-bsp-identity-body">
        {/* Selection and confirmation are two different facts and both are
            visible — but they belong on one line: they answer "is it in the
            offer" and "is its baseline trusted" about the SAME building, and
            stacking them made the identity card taller than the baseline it
            introduces. */}
        <div className="a3-bsp-identity-select">
          <input
            id={inputId}
            type="checkbox"
            className="a3-bsp-identity-input hit-target"
            checked={selected}
            onChange={onToggle}
            aria-label={selectLabel}
          />
          <label className="a3-bsp-identity-select-label" htmlFor={inputId}>
            {t(selected ? 'vr3.scope.selected' : 'vr3.scope.notSelected')}
          </label>
          <span className="a3-bsp-identity-status">
            <SemanticStatus
              tone={STATUS_TONE[status]}
              label={t(STATUS_KEY[status])}
              size="compact"
            />
          </span>
        </div>
        <p className="a3-bsp-identity-name">
          <span className="a3-bsp-identity-designation">{designation}</span>
          <span aria-hidden="true" className="a3-bsp-identity-sep"> · </span>
          <span className="a3-bsp-identity-proper">{name}</span>
        </p>
        <p className="a3-bsp-identity-meta">{meta}</p>
        {onReview && reviewLabel ? (
          <button
            type="button"
            className="a3-bsp-identity-review hit-target"
            onClick={onReview}
            aria-pressed={Boolean(reviewing)}
            aria-label={reviewAccessibleLabel}
          >
            {reviewLabel}
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
