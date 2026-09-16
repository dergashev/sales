import { useId, type ReactNode } from 'react'
import { useT } from '../i18n'
import { SemanticStatus } from './SemanticStatus'
import { AuthorityTrace, type InformationAuthority } from './AuthorityTrace'

/**
 * ConflictResolver — canonical conflict-resolution capability (VR3-00
 * design delta: REFINE of the existing comparison, keeping the good
 * side-by-side evidence and adding explicit authority, chronology, impact,
 * manual entry and a reversible decision record).
 *
 * A conflict is not an alert. Three things follow from that and are built
 * in rather than left to the consumer:
 *
 * - **Comparison, not a red card.** The competing values sit next to each
 *   other with their file, revision, date and authority, so the user
 *   decides from the evidence rather than from a colour.
 * - **A recommendation is labelled as a recommendation.** The system may
 *   say which source it considers newer or signed; it never presents that
 *   as the truth, and the rejected value stays visible historically.
 * - **The decision states its consequence.** The row names the downstream
 *   values the choice changes, because a decision whose effect is invisible
 *   is a decision the user cannot take responsibly.
 */

export type ConflictSource = {
  id: string
  /** The competing value, already formatted, or a state word. */
  value: ReactNode
  unit?: ReactNode
  authority: InformationAuthority
  /** Authority in the user's terms — e.g. "current coordinated schedule". */
  authorityLabel: string
  documentLabel: string
  version: string
  issuedAt: string
  /** True when a newer document explicitly supersedes this one. */
  superseded?: boolean
  /** True when this candidate came from a low-recognition reading. */
  lowConfidence?: boolean
  /** Set on the candidate the system recommends — as a recommendation. */
  recommended?: boolean
  /** Optional evidence preview (a plan crop, a site plan). */
  preview?: ReactNode
}

export type ConflictChoiceOption = {
  id: string
  label: string
  detail: string
  selected: boolean
  onSelect: () => void
}

export function ConflictResolver({
  conceptLabel, scopeLabel, blocking, impact, sources,
  recommendation, choices, choiceLegend,
  manualEntry, confirmAction, inspectAction,
  resolved, history, reopen,
}: {
  conceptLabel: string
  /** Which project or building the conflict belongs to. */
  scopeLabel: string
  blocking: boolean
  /** Why the decision matters and which downstream values it changes. */
  impact: string
  sources: ReadonlyArray<ConflictSource>
  /** The AI recommendation, always named as one. */
  recommendation?: string
  choices: ReadonlyArray<ConflictChoiceOption>
  choiceLegend: string
  manualEntry?: ReactNode
  confirmAction: ReactNode
  inspectAction?: ReactNode
  /**
   * The recorded decision, once made.
   *
   * WITHOUT the rejected values (Owner, 16.09.2026). Sie standen unter
   * jeder entschiedenen Angabe als «Verworfen: …» — eine Zeile, die dem
   * Leser nichts sagt, was er entscheiden müsste, und die den geltenden
   * Wert genau dort mit dem nicht geltenden umstellte. Verworfen bleibt
   * verworfen: `rejectedCandidateIds` wird weiterhin gespeichert, die
   * Quellen stehen weiterhin oben in der Karte, und der Verlauf kennt die
   * Entscheidung samt Herkunft.
   */
  resolved?: {
    valueLabel: ReactNode
    actor: string
    at: string
  }
  history?: ReactNode
  /** Undo reopens the conflict; readiness re-evaluates immediately. */
  reopen?: { label: string; onSelect: () => void }
}) {
  const t = useT()
  const headingId = useId()
  const impactId = useId()
  return (
    <article
      className={resolved ? 'a3-cfr a3-cfr-resolved' : 'a3-cfr a3-cfr-open'}
      aria-labelledby={headingId}
    >
      <header className="a3-cfr-head">
        <div className="a3-cfr-identity">
          <SemanticStatus
            tone={resolved ? 'ok' : blocking ? 'attention' : 'neutral'}
            label={resolved
              ? t('ds.conflict.state.resolved')
              : blocking
                ? t('ds.conflict.state.blocking')
                : t('ds.conflict.state.nonBlocking')}
            size="compact"
          />
          <h3 id={headingId} className="a3-cfr-concept">{conceptLabel}</h3>
          <p className="a3-cfr-scope">{scopeLabel}</p>
        </div>
        <p id={impactId} className="a3-cfr-impact">{impact}</p>
      </header>

      {/* Reading order is source → value, never value → source: at 1280 the
          evidence stacks but each value stays with the document it came
          from. */}
      <ol className="a3-cfr-sources">
        {sources.map((source) => (
          <li
            key={source.id}
            className={source.recommended ? 'a3-cfr-source a3-cfr-source-newer' : 'a3-cfr-source'}
          >
            <div className="a3-cfr-source-head">
              <SemanticStatus
                tone={source.superseded ? 'stale' : source.lowConfidence ? 'attention' : 'ok'}
                label={source.authorityLabel}
                size="compact"
              />
              {source.recommended ? (
                <span className="a3-cfr-source-flag">
                  {t('ds.conflict.recommendedSource')}
                </span>
              ) : null}
              {source.superseded ? (
                <span className="a3-cfr-source-flag">
                  {t('ds.conflict.supersededSource')}
                </span>
              ) : null}
            </div>
            <AuthorityTrace
              authority={source.authority}
              evidence={{
                label: source.documentLabel,
                version: source.version,
                issuedAt: source.issuedAt,
              }}
              layout="stacked"
            >
              <span className="a3-cfr-source-value numeric">{source.value}</span>
              {source.unit ? (
                <span className="a3-cfr-source-unit">{source.unit}</span>
              ) : null}
            </AuthorityTrace>
            {source.preview ? (
              <div className="a3-cfr-source-preview">{source.preview}</div>
            ) : null}
          </li>
        ))}
      </ol>

      {resolved ? (
        <div className="a3-cfr-record">
          <h4 className="a3-cfr-record-title">{t('ds.conflict.decisionRecord')}</h4>
          <p className="a3-cfr-record-value">{resolved.valueLabel}</p>
          <p className="a3-cfr-record-meta">
            {t('ds.conflict.decidedBy', { actor: resolved.actor, at: resolved.at })}
          </p>
          {history}
          {reopen ? (
            <button
              type="button"
              className="a3-cfr-reopen hit-target"
              onClick={reopen.onSelect}
            >
              {reopen.label}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="a3-cfr-decision">
          {recommendation ? (
            <p className="a3-cfr-recommendation">
              <span className="a3-cfr-recommendation-flag">
                {t('ds.conflict.recommendationFlag')}
              </span>
              {' '}
              {recommendation}
            </p>
          ) : null}
          <fieldset className="a3-cfr-choices" aria-describedby={impactId}>
            <legend className="a3-cfr-choices-legend">{choiceLegend}</legend>
            {choices.map((choice) => (
              <label
                key={choice.id}
                className={choice.selected ? 'a3-cfr-choice a3-cfr-choice-selected' : 'a3-cfr-choice'}
              >
                <input
                  type="radio"
                  className="a3-cfr-choice-input"
                  name={headingId}
                  value={choice.id}
                  checked={choice.selected}
                  onChange={choice.onSelect}
                />
                <span className="a3-cfr-choice-label">{choice.label}</span>
                <span className="a3-cfr-choice-detail">{choice.detail}</span>
              </label>
            ))}
          </fieldset>
          {manualEntry ? (
            <div className="a3-cfr-manual">{manualEntry}</div>
          ) : null}
          <div className="a3-cfr-actions">
            {confirmAction}
            {inspectAction}
          </div>
        </div>
      )}
    </article>
  )
}
