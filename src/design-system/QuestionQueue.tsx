import { useId, type ReactNode } from 'react'
import { useT } from '../i18n'
import { SemanticStatus, type SemanticStatusTone } from './SemanticStatus'

/**
 * QuestionQueue and QuestionItem — canonical open-question capability
 * (VR3-00 design delta: REPLACE of questions embedded near issues, because
 * a question is not a conflict and not an error).
 *
 * The single rule this capability enforces is the one the Product kept
 * getting wrong: **no universal blocking rule.** A question blocks only
 * when a domain requirement says so, and then the item cites that
 * requirement. Everything else is answerable later, and when a permitted
 * assumption exists the item says which assumption will carry into Final
 * Validation — so the user can proceed knowingly instead of guessing
 * whether an open question is safe.
 *
 * Consequently `error` is never a question's tone. An unanswered question
 * is `attention` at most, and a documented assumption is `neutral` with
 * its assumption stated.
 */

export type QuestionKind = 'question' | 'lowConfidence' | 'staleDependency'

export type QuestionStatus = 'open' | 'answered' | 'reviewRequired' | 'warning'

const STATUS_TONE: Record<QuestionStatus, SemanticStatusTone> = {
  open: 'attention',
  answered: 'ok',
  reviewRequired: 'attention',
  warning: 'attention',
}

const STATUS_KEY: Record<QuestionStatus, string> = {
  open: 'ds.question.status.open',
  answered: 'ds.question.status.answered',
  reviewRequired: 'ds.question.status.reviewRequired',
  warning: 'ds.question.status.warning',
}

const KIND_KEY: Record<QuestionKind, string> = {
  question: 'ds.question.kind.question',
  lowConfidence: 'ds.question.kind.lowConfidence',
  staleDependency: 'ds.question.kind.staleDependency',
}

export function QuestionQueue({
  heading, summary, children, note,
}: {
  heading: ReactNode
  /** States how many are open and, explicitly, how many of them block. */
  summary: ReactNode
  children: ReactNode
  /** Which assumptions carry into Final Validation. */
  note?: ReactNode
}) {
  const headingId = useId()
  return (
    <section className="a3-qq" aria-labelledby={headingId}>
      <div className="a3-qq-head">
        <h2 id={headingId} className="a3-qq-title">{heading}</h2>
        <p className="a3-qq-summary">{summary}</p>
      </div>
      <ul className="a3-qq-list">{children}</ul>
      {note ? <p className="a3-qq-note">{note}</p> : null}
    </section>
  )
}

export function QuestionItem({
  kind, status, blocking, question, scopeLabel, matters, evidenceContext,
  assumption, response, actions,
}: {
  kind: QuestionKind
  status: QuestionStatus
  /** True ONLY when a domain requirement makes this question a gate. */
  blocking: boolean
  question: string
  scopeLabel: string
  /** Why the answer matters — the consequence, not a rule id. */
  matters: string
  evidenceContext: string
  /**
   * The permitted assumption, when one exists. Its presence is the
   * difference between "you may proceed knowingly" and "you may not".
   */
  assumption?: string
  /** The recorded answer or documented assumption, once given. */
  response?: { label: string; actor: string; at: string }
  actions?: ReactNode
}) {
  const t = useT()
  const questionId = useId()
  return (
    <li className="a3-qq-item" aria-labelledby={questionId}>
      <div className="a3-qq-item-head">
        <h3 id={questionId} className="a3-qq-item-question">{question}</h3>
        <div className="a3-qq-item-marks">
          <SemanticStatus
            tone={STATUS_TONE[status]}
            label={t(STATUS_KEY[status])}
            size="compact"
          />
          <span className="a3-qq-item-kind">{t(KIND_KEY[kind])}</span>
          {/* Blocking is stated as its own fact, so a reader never has to
              infer a gate from a colour or from the mere presence of the
              item in this list. */}
          <span className="a3-qq-item-gate">
            {blocking
              ? t('ds.question.blocksProgress')
              : t('ds.question.doesNotBlock')}
          </span>
        </div>
      </div>
      <p className="a3-qq-item-scope">{scopeLabel}</p>
      <p className="a3-qq-item-matters">{matters}</p>
      <p className="a3-qq-item-evidence">{evidenceContext}</p>
      {assumption ? (
        <p className="a3-qq-item-assumption">
          <span className="a3-qq-item-assumption-flag">
            {t('ds.question.permittedAssumption')}
          </span>
          {' '}
          {assumption}
        </p>
      ) : null}
      {response ? (
        <p className="a3-qq-item-response">
          {response.label}
          {' · '}
          {t('ds.question.recordedBy', { actor: response.actor, at: response.at })}
        </p>
      ) : null}
      {actions ? <div className="a3-qq-item-actions">{actions}</div> : null}
    </li>
  )
}
