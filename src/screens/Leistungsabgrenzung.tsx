import { useEffect, useRef, useState } from 'react'
import {
  KG_DECIDED_SCOPE_GROUPS,
  chapterOf,
  groupOfService,
  requiredUpstreamVariant,
  serviceDecision as kgServiceDecision,
  variantBlocker,
  type KgScopeAxis,
  type KgScopeGroup,
  type KgService,
} from '../engine/kgConfiguration'
import {
  kgCatalogueFor,
  kgDecidedScopeCount,
  kgScopeDecisionsComplete,
  kgScopeStatus,
  useStore,
} from '../state/store'
import { selectedBgfRSTotal } from '../state/optionBuildingScope'
import { useLocalNumber } from '../lib/localNumber'
import { axisServices } from '../state/optionCommercialProjection'
import { ChoiceGroup } from '../design-system/ChoiceGroup'
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
 * THE FIRST ENTRY HAS SIX UNDECIDED ROWS AND NOTHING DECIDED. The ledger
 * asks one class of question, six times, and nothing above it competes with
 * that.
 *
 * BELOW IT SIT THE THREE OPTION-LEVEL AXES (B2, Product Owner requirement
 * 14): Energiestandard, QNG and DGNB. The previous revision of this
 * docblock recorded the opposite arrangement — "moved to the KG it actually
 * belongs to — Energiestandard into KG 400, QNG and DGNB into KG 700 —
 * because a decision configured in two places is a decision with two
 * answers". The diagnosis was right and the conclusion was one step short:
 * moving a decision to where its MONEY lands is not the same as moving it to
 * where it is TAKEN. KG 300, KG 400, the cost detail, the exports and the
 * client projection all read these three values, so a decision reachable
 * only from inside one of its consumers is a scope decision the user cannot
 * find until they are already pricing.
 *
 * There is still exactly ONE editable location, which is what that earlier
 * reasoning was protecting: the axes write the same `setKgServiceDecision`
 * their cost chapters wrote, and those chapters now show the value
 * read-only with the route back here.
 */
export function Leistungsabgrenzung() {
  const s = useStore()
  const t = useT()
  const num = useLocalNumber()
  const catalogue = kgCatalogueFor(s)
  const decisions = s.kgConfig
  const decided = kgDecidedScopeCount(s)
  // Three asked groups, not six — `KG_DECIDED_SCOPE_GROUPS` is the one
  // declaration of which they are, and the count below reads the same list
  // the ledger renders.
  const total = KG_DECIDED_SCOPE_GROUPS.length
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
    previouslyUndecided.current = KG_DECIDED_SCOPE_GROUPS
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

  /**
   * What the STANDING decision is worth, as the mirror of undoing it.
   *
   * `optionDelta` answers "what would change if you chose this", which is
   * zero for the choice already taken. The amount a reader wants there is
   * the group's own weight in the offer, and that is exactly the delta of
   * the opposite move with its sign turned around — same function, same
   * arithmetic, no second calculator.
   */
  const standingAmountOf = (group: KgScopeGroup, opposite: 'included' | 'excluded') => {
    const delta = s.optionDelta({ kind: 'kgScope', group, value: opposite })
    if (delta.isZero()) return t('vr3.kg.ledger.noEffect')
    return signedMoneyText(delta.negated(), s.uiLanguage)
  }

  const rows: readonly ScopeLedgerRow[] = KG_DECIDED_SCOPE_GROUPS.map((group) => {
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
      // after the decision.
      //
      // THE CHOSEN OPTION SHOWS A NUMBER TOO, in the same slot. It used to
      // print «aktuelle Wahl» there — a word where both neighbours carry an
      // amount, so the one line a reader compares changed KIND depending on
      // what was already decided, and the slot's height changed with it. The
      // figure is what this group is worth inside the offer, derived from
      // the delta of LEAVING it (`−4.020.000 €` → `+4.020.000 €`) rather
      // than from a second calculator: the preview function stays the single
      // source of every amount on this screen.
      includeConsequence: decision === 'included'
        ? standingAmountOf(group, 'excluded')
        : consequenceOf(group, 'included'),
      excludeConsequence: decision === 'excluded'
        ? standingAmountOf(group, 'included')
        : consequenceOf(group, 'excluded'),
    }
  })

  return (
    <div className="a3-abgrenzung">
      {/* The same stage anatomy the six KG pages use — position above name,
          lead below, state on the right. One learned header, not two. */}
      <div className="a3-kgp-head">
        <div className="a3-kgp-identity">
          <h1 className="a3-kgp-title" data-page-heading tabIndex={-1}>
            {t('chapter.scopeBoundaries')}
          </h1>
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

      {/* THE BASE THIS OPTION IS CALCULATED FROM — visible, and changeable.
          A single-building Option has its base confirmed with the Option
          itself and therefore has no `Gebäude & Umfang` row in the rail. A
          settlement nobody can see or revisit would be worse than the two
          clicks it replaced, so the fact is stated here, where the first
          real decision is made. */}
      {s.scopeBuildings.length === 1 && s.scopeSaved && (
        <div className="a3-abgrenzung-base">
          <p className="a3-abgrenzung-base-fact">
            <span className="a3-cap">{t('vr3.scope.base.label')}</span>
            {' '}
            <span>{s.scopeBuildings[0]!.name}</span>
            {' · '}
            <span className="numeric">
              {num(selectedBgfRSTotal(s), 0)}
              {NNBSP}
              m² BGF R+S
            </span>
          </p>
        </div>
      )}

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

      {/* B2 · requirement 14 — the three Option-level axes, decided HERE and
          read by KG 300/400, the cost detail, the exports and the client
          projection. They sit after the six inclusion decisions because they
          are decisions ABOUT the included scope, not a seventh inclusion. */}
      <ScopeAxisSection />

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
            // The first ASKED group — confirming the scope must land on a
            // page the rail actually offers.
            const first = KG_DECIDED_SCOPE_GROUPS
              .find((g) => decisions.scope[g] === 'included')
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

/* ─────────────────── Energie & Zertifizierung (B2, req 14) ─────────────── */

/**
 * The Option's three scope-decision AXES, in the one place they are decided.
 *
 * The audit found the Energy target editable inside KG 400 and both
 * certifications inside KG 700 — a decision configured where its
 * consequences land rather than where it is taken, and one the whole Option
 * is prepared under. What made that possible to fix without inventing a
 * second store is that these are already KG catalogue services: this section
 * writes the SAME `setKgServiceDecision` those chapters wrote, so there is
 * one fact, one journal event and one undo — the chapters simply stop
 * offering to change it and route here instead.
 *
 * Energy is ONE mutually exclusive axis by construction: a `ChoiceGroup` is
 * a native radio group, so `geg`, `eh55`, `eh40` and `eh40nh` cannot be held
 * together. QNG and DGNB are INDEPENDENT axes and may coexist — they are two
 * separate groups, which is the same reason `options.ts` gives for keeping
 * them apart from the energy standard: EH describes the building's energy
 * quality, QNG and DGNB describe the procedure that certifies it, and
 * neither follows from the other.
 */
function ScopeAxisSection() {
  const s = useStore()
  const t = useT()
  const catalogue = kgCatalogueFor(s)
  const decisions = s.kgConfig
  if (!catalogue || !decisions) return null

  const axes: readonly KgScopeAxis[] = ['energy', 'qng', 'dgnb']
  const services = axes
    .map((axis) => ({ axis, service: axisServices(catalogue, axis)[0] ?? null }))
    .filter((entry): entry is { axis: KgScopeAxis; service: KgService } =>
      entry.service !== null && entry.service.kind.kind === 'singleChoice')

  if (services.length === 0) return null

  return (
    <section className="a3-axes" aria-labelledby="scope-axes-heading">
      <div className="a3-axes-head">
        <h2 className="a3-axes-title" id="scope-axes-heading">
          {t('b2.axes.heading')}
        </h2>
        <p className="a3-axes-lede">{t('b2.axes.lede')}</p>
      </div>
      <div className="a3-axes-list">
        {services.map(({ axis, service }) => (
          <ScopeAxis key={axis} axis={axis} service={service} />
        ))}
      </div>
    </section>
  )
}

function ScopeAxis({ axis, service }: { axis: KgScopeAxis; service: KgService }) {
  const s = useStore()
  const t = useT()
  const catalogue = kgCatalogueFor(s)
  const decisions = s.kgConfig
  if (!catalogue || !decisions || service.kind.kind !== 'singleChoice') return null

  const en = s.uiLanguage === 'en'
  // Captured once: the narrowing is lost inside the closures below, and a
  // non-null assertion per call site would be four chances to get it wrong.
  const kind = service.kind
  const decision = kgServiceDecision(decisions, service)
  const current = decision.state === 'selected'
    ? decision.variant ?? kind.baselineVariant
    : kind.baselineVariant
  const ownGroup = groupOfService(catalogue, service.id)
  const groupDecision = ownGroup ? decisions.scope[ownGroup] : 'included'
  const groupName = ownGroup ? `KG${NNBSP}${ownGroup.slice(3)}` : ''

  /**
   * The consequence of each alternative, from the SAME preview function that
   * will compute it after the click. A second calculator here is how a
   * promised consequence and its outcome come to disagree — the released
   * contract the ledger above already follows.
   */
  const consequenceOf = (variant: string) => {
    // The chosen variant says nothing here: the fill, the ✓ and the weight
    // already say it is chosen, and «aktuelle Wahl» was a third carrier of
    // the same fact competing with the amounts beside it (rule 9).
    if (variant === current) return undefined
    const delta = s.optionDelta({
      kind: 'kgService',
      serviceId: service.id,
      value: { state: 'selected', variant },
    })
    return delta.isZero() ? undefined : signedMoneyText(delta, s.uiLanguage)
  }

  /**
   * Why a choice is unavailable, and what would enable it. Never one without
   * the other (rule 12): a greyed-out certificate that does not say
   * "requires Effizienzhaus 40 NH" states that something is impossible and
   * nothing else.
   */
  const unavailability = (variant: string): { reason: string } | null => {
    // A cost-bearing variant of a cost group that is out of scope cannot be
    // reached, and the row above on this same screen is the way in.
    if (variant !== kind.baselineVariant && groupDecision !== 'included') {
      return {
        reason: t(groupDecision === 'excluded'
          ? 'b2.axes.blocked.groupExcluded'
          : 'b2.axes.blocked.groupUndecided', { group: groupName }),
      }
    }
    const blocker = variantBlocker(catalogue, decisions, service, variant)
    if (!blocker) return null
    const required = requiredUpstreamVariant(catalogue, service)
    if (!required) return { reason: t('b2.axes.blocked.generic') }
    return {
      reason: t('b2.axes.blocked.requiresVariant', {
        service: en ? required.service.labelEn : required.service.labelDe,
        variant: required.variant
          ? (en ? required.variant.labelEn : required.variant.labelDe)
          : t('b2.axes.blocked.selected'),
      }),
    }
  }

  /**
   * THE ENABLING ACTION. Offered only when this screen can actually perform
   * it — the upstream axis is on this same screen, so setting it is one
   * click rather than a route to somewhere else and back.
   */
  const enabling = (() => {
    /**
     * ONLY when the upstream AXIS is what is missing.
     *
     * The browser caught this: with KG 700 still undecided, every priced
     * QNG variant is unreachable for that reason, and the offer to set the
     * Energy target would have unblocked nothing — a recovery that does not
     * recover is worse than none, because the user spends the click and the
     * choice is still refused. The group decision is the earlier
     * prerequisite and the row above on this same screen is its route, so
     * this action waits until that one is settled.
     */
    if (groupDecision !== 'included') return null
    const required = requiredUpstreamVariant(catalogue, service)
    if (!required?.variant) return null
    const upstreamAxis = required.service.scopeAxis
    if (!upstreamAxis) return null
    const state = kgServiceDecision(decisions, required.service)
    if (state.variant === required.variant.value) return null
    const anyBlocked = kind.variants.some((v) => unavailability(v.value) !== null)
    if (!anyBlocked) return null
    return {
      label: t('b2.axes.enable', {
        service: en ? required.service.labelEn : required.service.labelDe,
        variant: en ? required.variant.labelEn : required.variant.labelDe,
      }),
      onSelect: () => s.setKgServiceDecision(required.service.id, {
        state: 'selected', variant: required.variant!.value,
      }),
    }
  })()

  return (
    <div className="a3-axis" data-axis={axis}>
      <ChoiceGroup
        legend={en ? service.labelEn : service.labelDe}
        layout="stack"
        value={current}
        options={kind.variants.map((variant) => {
          const blocked = unavailability(variant.value)
          return {
            value: variant.value,
            label: en ? variant.labelEn : variant.labelDe,
            consequence: blocked ? undefined : consequenceOf(variant.value),
            badge: variant.value === kind.baselineVariant
              ? t('b2.axes.baselineBadge')
              : undefined,
            disabled: Boolean(blocked),
            disabledReason: blocked?.reason,
          }
        })}
        onChange={(variant) => s.setKgServiceDecision(service.id, {
          state: 'selected', variant,
        })}
        onPreview={(variant) => s.previewOption(variant === null
          ? null
          : {
            kind: 'kgService',
            serviceId: service.id,
            value: { state: 'selected', variant },
          })}
        footer={(
          <>
            <p className="a3-axis-summary">{en ? service.summaryEn : service.summaryDe}</p>
            {enabling ? (
              <Button variant="ghost" onClick={enabling.onSelect}>
                {enabling.label}
              </Button>
            ) : null}
          </>
        )}
      />
    </div>
  )
}
