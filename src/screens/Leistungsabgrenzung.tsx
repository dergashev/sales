import { useEffect, useRef, useState } from 'react'
import {
  KG_SCOPE_GROUPS,
  chapterOf,
  type KgScopeGroup,
} from '../engine/kgConfiguration'
import {
  kgCatalogueFor,
  kgDecidedScopeCount,
  kgScopeDecisionsComplete,
  kgScopeStatus,
  useStore,
} from '../state/store'
import { useT } from '../i18n'
import { NNBSP } from '../engine/money'
import { Button } from '../components/primitives'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { signedMoneyText } from '../design-system/CommercialNumber'
import {
  ScopeDecisionLedger,
  ScopeDecisionSummary,
  type ScopeLedgerRow,
} from '../design-system/ScopeDecisionLedger'
import { M06_ROW_MS, M06_UNLOCK_MS } from '../config/ui-policy'

/**
 * Leistungsabgrenzung — six explicit scope decisions (VR3-03, T-018–T-020).
 *
 * This screen is the product composition; the ledger itself is the canonical
 * capability. What lives HERE is the domain reading: which cost groups exist,
 * what each decision means downstream, and the one action that carries the
 * journey forward.
 *
 * THE FIRST ENTRY HAS SIX UNDECIDED ROWS AND NOTHING ELSE. No energy
 * standard, no certificates, no configuration-mode banner: the surface asks
 * one class of question, six times. Everything the old chapter also carried
 * moved to the KG it actually belongs to — Energiestandard into KG 400,
 * QNG and DGNB into KG 700 — because a decision configured in two places is
 * a decision with two answers.
 */
export function Leistungsabgrenzung() {
  const s = useStore()
  const t = useT()
  const catalogue = kgCatalogueFor(s)
  const decisions = s.kgConfig
  const decided = kgDecidedScopeCount(s)
  const total = KG_SCOPE_GROUPS.length
  const complete = kgScopeDecisionsComplete(s)
  const status = kgScopeStatus(s)

  /**
   * M-06 — THE SIXTH DECISION (VR3-03R, audit G-09).
   *
   * The announcement and the focus behaviour were already right: the polite
   * region names the unlock, and focus stays on the row the user just
   * decided. What did not exist was the visible half — probed on the exact
   * pre-remediation candidate, `document.getAnimations()` returned an empty
   * array at the moment 5/6 became 6/6. The state simply teleported.
   *
   * Two marks, two durations, both from the contract: the row that
   * completed the set resolves within 160ms, and the counter resolves
   * within 220ms alongside the journey's own unlock (owned by
   * `OptionWorkflowSpine`, which watches the same predicate rather than
   * being told).
   *
   * WHAT IS DELIBERATELY ABSENT. No celebration, no confetti, no badge
   * (rule 27 forbids all three by name). The transition says one thing —
   * "that was the last one" — and then it is gone. Under reduced motion the
   * marks are still set and the CSS durations are zero, so the end state,
   * the focus and the announcement are identical and nothing moves; the
   * meaning was never in the movement.
   */
  const previouslyComplete = useRef(complete)
  const [resolvedRowId, setResolvedRowId] = useState<string | null>(null)
  const [countResolving, setCountResolving] = useState(false)

  /**
   * Which row the sixth decision will land on.
   *
   * Recorded while five are decided, so that once six are, the row that
   * completed the set is already known. Reading it AFTER completion is
   * impossible — by then every row is decided and none of them is
   * distinguishable as the last. Watching the store rather than the click
   * keeps this true for a decision made by keyboard, by pointer, or by an
   * undo that puts the sixth back.
   */
  const previouslyUndecided = useRef<string | null>(null)
  useEffect(() => {
    if (decided !== total - 1 || !decisions) return
    previouslyUndecided.current = KG_SCOPE_GROUPS
      .find((group) => decisions.scope[group] === 'undecided') ?? null
  }, [decided, total, decisions])

  useEffect(() => {
    if (complete && !previouslyComplete.current) {
      // The sixth decision is the last row still undecided a moment ago.
      const sixth = previouslyUndecided.current
      setResolvedRowId(sixth)
      setCountResolving(true)
      const rowTimer = window.setTimeout(() => setResolvedRowId(null), M06_ROW_MS)
      const countTimer = window.setTimeout(() => setCountResolving(false), M06_UNLOCK_MS)
      previouslyComplete.current = complete
      return () => {
        window.clearTimeout(rowTimer)
        window.clearTimeout(countTimer)
      }
    }
    previouslyComplete.current = complete
    return undefined
  }, [complete])

  if (!catalogue || !decisions) return null

  /**
   * The signed effect of a scope decision, from the SAME function that will
   * compute it after the click (`outcomeOf`). A second calculator here is
   * how a promised consequence and its outcome come to disagree — the
   * defect the released preview contract was built to prevent.
   */
  const consequenceOf = (group: KgScopeGroup, value: 'included' | 'excluded') => {
    const delta = s.optionDelta({ kind: 'kgScope', group, value })
    // A signed amount, and the WORD only where there is no number to carry
    // the meaning. The released consequence contract added
    // `Mehrpreis`/`Minderpreis` beside the sign because it sat on
    // full-width option cards that stood far apart; inside a two-segment
    // control the `+`/`−` is adjacent to the figure, and the extra word
    // doubled the decision column until the ledger's own summary and
    // consequence columns fell off the 1280 composition.
    if (delta.isZero()) return t('vr3.kg.ledger.noEffect')
    return signedMoneyText(delta, s.uiLanguage)
  }

  const rows: readonly ScopeLedgerRow[] = KG_SCOPE_GROUPS.map((group) => {
    const chapter = chapterOf(catalogue, group)
    const decision = decisions.scope[group]
    return {
      id: group,
      identity: `KG${NNBSP}${group.slice(3)}`,
      meaning: t(`costGroup.${group}`),
      boundary: (s.uiLanguage === 'en' ? chapter?.boundaryEn : chapter?.boundaryDe) ?? '',
      decision,
      summary: decision === 'included'
        ? t('vr3.kg.ledger.summary.included')
        : decision === 'excluded'
          ? t('vr3.kg.ledger.summary.excluded')
          : t('vr3.kg.ledger.summary.undecided'),
      // Six blue "in progress" markers read as six links, and an included
      // group is not work in flight — it is work now REACHABLE. The
      // distinction that matters here is decided vs not, and the words carry
      // the rest (rule 8).
      downstream: decision === 'undecided'
        ? { tone: 'attention' as const, label: t('vr3.kg.ledger.downstream.required') }
        : decision === 'included'
          ? { tone: 'neutral' as const, label: t('vr3.kg.ledger.downstream.configure') }
          : { tone: 'neutral' as const, label: t('vr3.kg.ledger.downstream.skipped') },
      includeLabel: t('vr3.kg.ledger.include'),
      excludeLabel: t('vr3.kg.ledger.exclude'),
      // The consequence of each choice is visible AT ALL TIMES, never on
      // hover (R-05/OPTION-009): the user is deciding money, and a price
      // that only appears when the pointer is already on the option arrives
      // after the decision. The choice already taken says so instead of
      // repeating its own amount — that number is in the rail.
      includeConsequence: decision === 'included'
        ? t('configurator.scopeCatalog.currentChoice')
        : consequenceOf(group, 'included'),
      excludeConsequence: decision === 'excluded'
        ? t('configurator.scopeCatalog.currentChoice')
        : consequenceOf(group, 'excluded'),
    }
  })

  return (
    <div className="a3-abgrenzung">
      {/* The same stage anatomy the six KG pages use — position above name,
          lead below, state on the right. One learned header, not two. */}
      <div className="a3-kgp-head">
        <div className="a3-kgp-identity">
          <p className="a3-cap">{t('vr3.kg.ledger.stageMeta')}</p>
          <h1 className="a3-kgp-title" data-page-heading tabIndex={-1}>
            {t('chapter.scopeBoundaries')}
          </h1>
          <p className="a3-lede">{t('vr3.kg.ledger.lede')}</p>
        </div>
        <div className="a3-kgp-progress">
          {/* The canonical `n/6` readout, so the M-06 resolution lands on
              the one element that owns the count rather than on a local
              copy of it. */}
          <ScopeDecisionSummary
            decided={decided}
            total={total}
            tone={complete ? 'ok' : decided > 0 ? 'attention' : 'neutral'}
            label={t('vr3.kg.ledger.progress', { decided, total })}
            resolving={countResolving}
          />
          {status === 'recheck' && (
            <SemanticStatus
              tone="stale"
              label={t('vr3.kg.ledger.recheck')}
              reason={t('vr3.kg.ledger.recheckReason')}
            />
          )}
        </div>
      </div>

      <ScopeDecisionLedger
        rows={rows}
        caption={t('vr3.kg.ledger.caption')}
        columns={{
          group: t('vr3.kg.ledger.column.group'),
          decision: t('vr3.kg.ledger.column.decision'),
          summary: t('vr3.kg.ledger.column.summary'),
          downstream: t('vr3.kg.ledger.column.downstream'),
        }}
        decisionLegend={(row) => t('vr3.kg.ledger.decisionLegend', {
          group: row.identity, meaning: row.meaning,
        })}
        resolvedRowId={resolvedRowId}
        onDecide={(id, decision) => s.setKgScopeDecision(id as KgScopeGroup, decision)}
        onPreview={(id, decision) => s.previewOption(
          decision === null || decision === 'undecided'
            ? null
            : { kind: 'kgScope', group: id as KgScopeGroup, value: decision },
        )}
      />

      <div className="a3-abgrenzung-dock">
        <p className="a3-cap">
          {complete
            ? t('vr3.kg.ledger.footerComplete')
            : t('vr3.kg.ledger.footerIncomplete')}
        </p>
        <Button
          variant="primary"
          disabled={!complete}
          disabledReason={t('vr3.kg.ledger.blockedReason', {
            open: total - decided, total,
          })}
          onClick={() => {
            s.confirmKgScope()
            const first = KG_SCOPE_GROUPS.find((g) => decisions.scope[g] === 'included')
            if (first) s.openKgChapter(first)
          }}
        >
          {t('vr3.kg.ledger.confirm')}
        </Button>
      </div>

      {/* The completion transition is announced once, politely, and names the
          next step — the semantic half of M-06, which survives reduced
          motion because it never depended on movement. */}
      <p className="sr-only" aria-live="polite">
        {complete ? t('vr3.kg.ledger.announceComplete') : ''}
      </p>
    </div>
  )
}
