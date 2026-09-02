import { useT } from '../i18n'

/**
 * SemanticStatus — canonical state mark (VR3-00 design delta: REFINE of the
 * previous badge/chip family into one capability with icon, label, optional
 * reason and screen-reader text, where colour is supplementary).
 *
 * Two rules are structural, not stylistic:
 *
 * 1. **Colour never carries the meaning** (rule 8). Every tone renders a
 *    non-colour glyph AND a word. Remove the stylesheet and the state is
 *    still readable.
 * 2. **A question is not an error.** `error` is reserved for something that
 *    actually failed. A question, an assumption or a low-confidence
 *    observation uses `attention` / `unknown` — the recorded defect this
 *    capability exists to prevent is a red card standing in for an open
 *    question.
 *
 * The glyph vocabulary is shared with the existing canonical families on
 * purpose: `▲` means "stale/derived" here exactly as it does in
 * `DataStates`/`ProvenanceChip`, and attention is `!`, never `▲`.
 */

export type SemanticStatusTone =
  /** Nothing has happened yet. Absence, not zero. */
  | 'neutral'
  /** Work is genuinely in flight. */
  | 'progress'
  /** Complete and trustworthy. */
  | 'ok'
  /** Needs a human decision or carries a caveat. Not an error. */
  | 'attention'
  /** Something actually failed. */
  | 'error'
  /** Was trustworthy; newer evidence means it must be reviewed again. */
  | 'stale'
  /** No value is known. Never rendered as 0. */
  | 'unknown'

const GLYPH: Record<SemanticStatusTone, string> = {
  neutral: '○',
  progress: '◐',
  ok: '✓',
  attention: '!',
  error: '✗',
  stale: '▲',
  unknown: '?',
}

// One fully written class name per tone rather than an interpolated suffix:
// tools/verify.py's DS-CLASS-EXISTS gate greps source statically, and an
// interpolated class leaves only the bare prefix for it to match.
const TONE_CLASS: Record<SemanticStatusTone, string> = {
  neutral: 'a3-sst-neutral',
  progress: 'a3-sst-progress',
  ok: 'a3-sst-ok',
  attention: 'a3-sst-attention',
  error: 'a3-sst-error',
  stale: 'a3-sst-stale',
  unknown: 'a3-sst-unknown',
}

const TONE_MEANING_KEY: Record<SemanticStatusTone, string> = {
  neutral: 'ds.semanticStatus.meaning.neutral',
  progress: 'ds.semanticStatus.meaning.progress',
  ok: 'ds.semanticStatus.meaning.ok',
  attention: 'ds.semanticStatus.meaning.attention',
  error: 'ds.semanticStatus.meaning.error',
  stale: 'ds.semanticStatus.meaning.stale',
  unknown: 'ds.semanticStatus.meaning.unknown',
}

export function SemanticStatus({
  tone, label, reason, size = 'default', as: Root = 'span',
}: {
  tone: SemanticStatusTone
  /** The state, as a word. Required — the glyph never stands alone. */
  label: string
  /**
   * Why the state holds. Rendered visibly when present, because a state
   * the user cannot explain is a state they cannot act on (rule 12).
   */
  reason?: string
  /** `compact` is for dense table rows; the anatomy does not change. */
  size?: 'default' | 'compact'
  as?: 'span' | 'div'
}) {
  const t = useT()
  const sizeClass = size === 'compact' ? 'a3-sst-compact' : 'a3-sst-default'
  return (
    <Root className={`a3-sst ${TONE_CLASS[tone]} ${sizeClass}`}>
      <span className="a3-sst-glyph" aria-hidden="true">{GLYPH[tone]}</span>
      <span className="a3-sst-label">{label}</span>
      {/* The tone's own meaning, for a reader who cannot see the mark and
          for whom the product-specific label alone may be ambiguous. */}
      <span className="sr-only"> · {t(TONE_MEANING_KEY[tone])}</span>
      {reason ? <span className="a3-sst-reason">{reason}</span> : null}
    </Root>
  )
}
