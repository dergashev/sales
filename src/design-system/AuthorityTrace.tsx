import { useId, type ReactNode, type RefObject } from 'react'
import { useT } from '../i18n'
import { SemanticStatus, type SemanticStatusTone } from './SemanticStatus'

/**
 * AuthorityTrace and MetricReadout — canonical information-authority
 * capabilities (VR3-00 design delta: MERGE of the scattered
 * source/provenance snippets into one value envelope, and REFINE of the
 * metric cards into a compact readout with unit, precision and an
 * authority slot).
 *
 * The contract is one sentence: **the visible value and its authority are
 * one object.** A number rendered without its authority is a claim the
 * Product cannot support, and the states below are not interchangeable —
 * an assumption presented as source evidence is a commercial defect, not a
 * styling detail.
 *
 * Two prohibitions are load-bearing:
 * - `unknown` is never rendered as `0` unless Product authority defines
 *   zero (CLAUDE.md rule 16, information-authority pattern).
 * - newer conflicting evidence marks a confirmed value `stale`; it never
 *   silently overwrites it (M-1/D-08).
 */

export type InformationAuthority =
  | 'sourceEvidenced'
  | 'aiInferred'
  | 'assumed'
  | 'derived'
  | 'userEntered'
  | 'confirmed'
  | 'overridden'
  | 'historical'
  | 'stale'
  | 'unknown'

const AUTHORITY_KEY: Record<InformationAuthority, string> = {
  sourceEvidenced: 'ds.authority.sourceEvidenced',
  aiInferred: 'ds.authority.aiInferred',
  assumed: 'ds.authority.assumed',
  derived: 'ds.authority.derived',
  userEntered: 'ds.authority.userEntered',
  confirmed: 'ds.authority.confirmed',
  overridden: 'ds.authority.overridden',
  historical: 'ds.authority.historical',
  stale: 'ds.authority.stale',
  unknown: 'ds.authority.unknown',
}

const AUTHORITY_TONE: Record<InformationAuthority, SemanticStatusTone> = {
  sourceEvidenced: 'ok',
  aiInferred: 'attention',
  assumed: 'attention',
  derived: 'neutral',
  userEntered: 'neutral',
  confirmed: 'ok',
  /* A value a person typed is DECIDED, not a caveat. It carried the
     attention tone while the only overrides in the product came from the
     fixture and meant «somebody changed this, look at it»; now that a reader
     can enter one themselves, the row they just settled must not come back
     wearing an alarm. Complete and attributable — the same tone as a
     confirmation, distinguished by its own label and by the displaced value
     printed underneath. */
  overridden: 'ok',
  historical: 'neutral',
  stale: 'stale',
  unknown: 'unknown',
}

// Static class per authority (DS-CLASS-EXISTS greps literals — see
// SemanticStatus for the full reasoning).
const AUTHORITY_CLASS: Record<InformationAuthority, string> = {
  sourceEvidenced: 'a3-aut-source',
  aiInferred: 'a3-aut-inferred',
  assumed: 'a3-aut-assumed',
  derived: 'a3-aut-derived',
  userEntered: 'a3-aut-user',
  confirmed: 'a3-aut-confirmed',
  overridden: 'a3-aut-overridden',
  historical: 'a3-aut-historical',
  stale: 'a3-aut-stale',
  unknown: 'a3-aut-unknown',
}

export function authorityLabelKey(authority: InformationAuthority): string {
  return AUTHORITY_KEY[authority]
}

export type AuthorityEvidence = {
  /** File, drawing or instruction the value comes from. */
  label: string
  /** Version/revision, so a later FINAL-REV does not read as older. */
  version?: string
  /** Issue date — a date is evidence, never a decision on its own. */
  issuedAt?: string
}

/**
 * The value envelope. `children` is the value itself, so the value and its
 * authority cannot drift apart into two independently rendered things.
 */
export function AuthorityTrace({
  authority, evidence, confirmation, override, freshness, children, layout = 'inline',
  onOpenEvidence, openEvidenceLabel, evidenceRef, evidenceOpen,
}: {
  authority: InformationAuthority
  evidence?: AuthorityEvidence
  /** Who confirmed it and when — human truth is attributable or absent. */
  confirmation?: { actor: string; at: string }
  /** A manual override keeps the value it replaced, plus the reason. */
  override?: { previous: string; reason: string; actor: string; at: string }
  /** Set when newer evidence exists: the value needs review, not replacing. */
  freshness?: { staleReason: string }
  children: ReactNode
  layout?: 'inline' | 'stacked'
  /**
   * Opens the cited document. Given one, the FILE NAME itself becomes the
   * control — the citation is the thing a reader points at when they want to
   * see the source, and a separate button beside it was a second name for
   * the same act. Only the name is the control: a version and an issue date
   * are facts about the file, not two more ways to open it.
   */
  onOpenEvidence?: () => void
  /** Accessible name for that control — it must say WHICH file it opens. */
  openEvidenceLabel?: string
  /** Focus returns here when the surface the control opened is closed. */
  evidenceRef?: RefObject<HTMLButtonElement>
  /** Whether the surface it controls is currently open. */
  evidenceOpen?: boolean
}) {
  const t = useT()
  const detailId = useId()
  const effective: InformationAuthority = freshness ? 'stale' : authority
  const layoutClass = layout === 'stacked' ? 'a3-aut-stacked' : 'a3-aut-inline'
  const hasDetail = Boolean(evidence || confirmation || override || freshness)
  return (
    <span className={`a3-aut ${AUTHORITY_CLASS[effective]} ${layoutClass}`}>
      <span className="a3-aut-value" aria-describedby={hasDetail ? detailId : undefined}>
        {children}
      </span>
      <span className="a3-aut-meta" id={hasDetail ? detailId : undefined}>
        <SemanticStatus
          tone={AUTHORITY_TONE[effective]}
          label={t(AUTHORITY_KEY[effective])}
          size="compact"
        />
        {evidence ? (
          <span className="a3-aut-evidence">
            {onOpenEvidence ? (
              <button
                ref={evidenceRef}
                type="button"
                className="a3-aut-evidence-link hit-target"
                aria-expanded={evidenceOpen}
                aria-label={openEvidenceLabel}
                onClick={onOpenEvidence}
              >
                {evidence.label}
              </button>
            ) : evidence.label}
            {evidence.version ? ` · ${evidence.version}` : ''}
            {evidence.issuedAt ? ` · ${evidence.issuedAt}` : ''}
          </span>
        ) : null}
        {confirmation ? (
          <span className="a3-aut-confirmation">
            {t('ds.authority.confirmedBy', {
              actor: confirmation.actor, at: confirmation.at,
            })}
          </span>
        ) : null}
        {override ? (
          <span className="a3-aut-override">
            {t('ds.authority.overrodeValue', {
              previous: override.previous, reason: override.reason,
              actor: override.actor, at: override.at,
            })}
          </span>
        ) : null}
        {freshness ? (
          <span className="a3-aut-freshness">{freshness.staleReason}</span>
        ) : null}
      </span>
    </span>
  )
}

/**
 * MetricReadout — one labelled number with its unit and, where trust or
 * action depends on it, its authority. `emphasis` is the segment-leading
 * figure; `compact` is the dense in-row form. The unit is a separate
 * element at a smaller size on the same baseline (rule 31), never
 * concatenated into the value string (rule 36).
 */
export function MetricReadout({
  label, value, unit, variant = 'default', authority, note, operator,
}: {
  label: ReactNode
  /** Already formatted for the locale by the caller's canonical formatter. */
  value: ReactNode
  unit?: ReactNode
  variant?: 'compact' | 'default' | 'emphasis'
  /** Rendered only when authority changes trust or action, never as decor. */
  authority?: InformationAuthority
  note?: ReactNode
  /** Arithmetic operator shown BEFORE this readout in an equation row. */
  operator?: '+' | '=' | '−'
}) {
  const t = useT()
  const variantClass = variant === 'emphasis'
    ? 'a3-mro-emphasis'
    : variant === 'compact' ? 'a3-mro-compact' : 'a3-mro-default'
  return (
    <div className={`a3-mro ${variantClass}`}>
      {operator ? (
        <span className="a3-mro-operator" aria-hidden="true">{operator}</span>
      ) : null}
      <dt className="a3-mro-label">{label}</dt>
      <dd className="a3-mro-value">
        <span className="numeric">{value}</span>
        {unit ? <span className="a3-mro-unit">{unit}</span> : null}
        {authority ? (
          <span className="a3-mro-authority">
            <SemanticStatus
              tone={AUTHORITY_TONE[authority]}
              label={t(AUTHORITY_KEY[authority])}
              size="compact"
            />
          </span>
        ) : null}
        {note ? <span className="a3-mro-note">{note}</span> : null}
      </dd>
    </div>
  )
}
