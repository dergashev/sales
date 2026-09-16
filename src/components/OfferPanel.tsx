import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { hasV3Surfaces } from '../lib/variantLock'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Decimal } from 'decimal.js'
import {
  commercialSnapshot, includedBuildingIds, kgCatalogueFor,
  projectProjection, translatedChangeLabel, useStore,
  bauzeitResultFor,
} from '../state/store'
import { optionCommercialProjection } from '../state/optionCommercialProjection'
import type { PriceChange } from '../state/store'
import { effectiveFactValue } from '../state/buildingReview'
import {
  commercialComposition,
  commercialCompleteness,
  railCompositionSplit,
  selectedCommercialEffects,
  type SelectedCommercialEffect,
} from '../state/commercialProjection'
import { KG_DECIDED_SCOPE_GROUPS } from '../engine/kgConfiguration'
import derivedFx from '../fixtures/derived-prototype.json'
import {
  NNBSP, present, label as moneyLabel,
} from '../engine/money'
import type { CostGroup } from '../engine/calculate'
import { isScopeUniverseEmpty } from '../engine/calculate'
import { translatedDriverLabel } from '../state/clientProjection'
import { CONFIGURATOR_STEP } from '../state/chapters'
import { optionNav } from '../state/optionLifecycle'
import { Button } from './primitives'
import { DataStateBlock, PartialState } from './DataStates'
import { useLocalNumber } from '../lib/localNumber'
import { useT, useTx, localizeMoneyText, localizePercentText } from '../i18n'
import type { UiLanguage } from '../i18n'
import { useSemanticMotion } from '../design-system/motion'
import { CommercialRailStatus } from '../design-system/CommercialRail'
import { DELTA_CHIP_MS, TOAST_EXIT_MS } from '../config/ui-policy'

/**
 * THE COMMERCIAL COCKPIT — the Configurator's right rail (VR3-COST-00).
 *
 * WHAT THIS REPLACED, AND WHY IT IS NOT A REDESIGN OF A WORKING THING.
 *
 * The rail was a 256–272 px column carrying thirteen jobs. Its pinned band
 * measured 553 px — 66 % of the rail at 1440 and 75 % at 1280 — because the
 * Design System's height budget was switched off on exactly this surface, so
 * its first viewport held three stacked heroes and an activity card and none
 * of the cost composition, none of the selected priced choices and no route
 * to the detail. Every committed decision displaced the content below it by
 * 57–81 px and moved the reading anchor by 28 px, and a SECOND shift landed
 * four seconds later when an in-flow change marker expired. The whole cost
 * explanation lived in a modal 2.07 viewport heights tall on the simple
 * fixture, behind fourteen nested provenance popovers.
 *
 * NONE OF THAT WAS A DENSITY PROBLEM. It was an absent-destination problem,
 * and the answer is two deliberate levels and no third:
 *
 * ```
 * LEVEL 1  the rail        — configure the Option
 * LEVEL 2  /kostendetails  — understand and explain the number
 * ```
 *
 * FOUR BLOCKS, IN A FIXED ORDER, and nothing may be inserted between them:
 *
 * ```
 * 1  the current commercial result
 * 2  Auswahl mit Preiswirkung        (the live selection basket)
 * 3  Kostengruppen nach DIN 276      (top level only)
 * 4  Alle Kostendetails
 * ```
 *
 * IT CALCULATES NOTHING. Ten commercial calculations used to live in this
 * file — including a second copy of the Regionalfaktor counterfactual and a
 * second completeness recount. They are gone: every number here comes from
 * `commercialSnapshot`, and every classification from the pure selectors in
 * `state/commercialProjection.ts`. The rail is a projection of the released
 * commercial authority, and a projection cannot disagree with its source.
 *
 * TWO CONCEPTS THAT MUST NEVER MERGE. Block 2 answers *which of my choices
 * matter commercially*; it does NOT sum to the total, because the total also
 * contains base, fact-derived and non-configurable cost. Block 3 answers
 * *where is the money*; it DOES reconcile, and rule 35's arithmetic invariant
 * stays attached to it. They never share a row rhythm, an alignment or a name.
 *
 * GEOMETRY IS A CONTRACT, NOT AN OUTCOME. The band is capped by
 * `--size-rail-band-budget` on every surface. Block 2 occupies a reserved
 * slot sized for three rows plus the overflow line, so 0/1/2/3/more all leave
 * the DIN composition and the CTA exactly where they were. The committed
 * change swaps INTO the commercial-basis line's own reserved slot for four
 * seconds — it never enters the flow, and it never replaces a persistent
 * commercial fact for longer than that.
 */

/**
 * Последний показанный дельта-чип — чтобы содержимое пережило гашение.
 *
 * AUD-01 (EXP-01): `last` used to latch FOREVER once `current` had ever been
 * truthy. `clearAfterMs` makes it self-clear once its own exit window has
 * genuinely elapsed, so content survives only for as long as its exit
 * animation needs it to.
 */
function useLastValue<T>(current: T | null, clearAfterMs = Infinity): T | null {
  const [last, setLast] = useState<T | null>(current)
  useEffect(() => {
    if (current) {
      setLast(current)
      return
    }
    if (!Number.isFinite(clearAfterMs)) return
    if (clearAfterMs <= 0) {
      setLast(null)
      return
    }
    const id = window.setTimeout(() => setLast(null), clearAfterMs)
    return () => window.clearTimeout(id)
  }, [current, clearAfterMs])
  return current ?? last
}

/** Пометка выведенной величины — из данных, не из разметки (D-22). */
const MARK = derivedFx.marker

/**
 * SIDEBAR 03 (SB-14) locale-aware wrappers around `engine/money.ts`'s
 * exported formatters. They re-typeset the ALREADY-DECIDED numeral each
 * formatter produces; they never re-derive a rounding rule.
 */
function moneyOut(d: ReturnType<typeof present>, lang: UiLanguage, unit = '€'): string {
  return localizeMoneyText(moneyLabel(d, unit), lang)
}
function signedOut(d: Decimal, lang: UiLanguage): string {
  return localizeMoneyText(signed(d), lang)
}
function percentOut(value: number, lang: UiLanguage): string {
  return localizePercentText(`${Math.round(value)}${NNBSP}%`, lang)
}

/**
 * The German display name for a narrowed building (SIDEBAR 02, SB-09/SB-10).
 * Not intern-gated: the salesperson must be able to state the scope out loud
 * in every mode (rule 8/38).
 */
function buildingScopeLabel(
  s: ReturnType<typeof useStore.getState>,
  id: string,
): string {
  const review = s.buildingReviews[id]
  return review ? effectiveFactValue(review.facts.documentationName) ?? id : id
}

/**
 * The word that states an effect's price authority — one dictionary, shared
 * with the KG chapter that produces the axis (`vr3.tga.price.*`).
 *
 * A state is a WORD, never a colour and never a substituted `0 €` (rule 8,
 * Cost Driver contract §4). `unknown` is deliberately a state of its own: a
 * missing authority is not evidence of direct pricing.
 */
export function effectStateLabel(
  effect: Pick<SelectedCommercialEffect,
    'authority' | 'negative' | 'exact' | 'bundleLabelDe' | 'bundleLabelEn'
    | 'zeroQuantity'>,
  t: (key: string, values?: Readonly<Record<string, string | number>>) => string,
  lang: UiLanguage,
): string | null {
  // A quantity of zero is not "no price effect": the rate is known and there
  // is simply nothing to apply it to. It says what the chapter says.
  if (effect.zeroQuantity) return t('vr3.tga.price.notDetermined')
  switch (effect.authority) {
    case 'direct': {
      if (effect.exact === null) return null
      if (effect.exact.isNegative()) return t('commercial.state.reduction')
      if (effect.exact.isZero()) return t('commercial.state.noPriceEffect')
      return null
    }
    case 'bundle': {
      const basis = lang === 'en' ? effect.bundleLabelEn : effect.bundleLabelDe
      return basis
        ? t('vr3.tga.price.bundleNamed', { basis })
        : t('vr3.tga.price.bundle')
    }
    case 'indirect': return t('vr3.tga.price.indirect')
    case 'noBasis': return t('vr3.tga.price.noBasis')
    case 'bauherr': return t('commercial.authority.bauseits')
    case 'none': return null
    default: return t('commercial.authority.unknown')
  }
}

/**
 * SIDEBAR 01 · the band's degrade ladder, now able to move BOTH WAYS.
 *
 * The released ladder could only ratchet up: once a narrow viewport had
 * hidden the provenance trigger it stayed hidden after the viewport widened
 * again, because nothing ever measured whether the content had come to fit.
 * A degradation that cannot be undone is a permanent loss dressed as an
 * adaptation (audit A-8).
 *
 * `settled` bounds the loop: the ladder is allowed a small number of
 * adjustments per reset key, so a content/box pair that would oscillate
 * between two levels comes to rest at the safer one instead of re-rendering
 * forever. A width change resets both, which is the "must react to relevant
 * width changes" half of the same requirement.
 */
/**
 * What the change slot and the live region both say about ONE committed
 * change, in the current language.
 *
 * Two render sites used to inline the same three-way expression, and both
 * fell back to `activeDelta.label` — German prose composed in the store —
 * whenever a change could not be expressed as a plain `PriceChange`. The
 * store now always carries the decision as a `change` and its automatic
 * consequence as a translatable `noteKey`, so the fallback is genuinely
 * last-resort rather than the ordinary path for a KG 700 toggle.
 */
function changeText(
  delta: { label: string, change?: PriceChange, noteKey?: string },
  t: (key: string, values?: Record<string, string | number>) => string,
  tx: (deText: string) => string,
  lang: UiLanguage,
): string {
  const head = delta.change
    ? translatedChangeLabel(delta.change, t, tx, lang)
    : delta.label
  return delta.noteKey ? `${head} · ${t(delta.noteKey)}` : head
}

const MAX_DEGRADE = 2
const DEGRADE_SLACK_PX = 12
const DEGRADE_MAX_ADJUSTMENTS = 6

function useBandDegradeLadder(resetKey: string) {
  const ref = useRef<HTMLDivElement>(null)
  const [level, setLevel] = useState(0)
  const adjustments = useRef(0)

  useLayoutEffect(() => {
    adjustments.current = 0
    setLevel(0)
  }, [resetKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      adjustments.current = 0
      setLevel(0)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (adjustments.current >= DEGRADE_MAX_ADJUSTMENTS) return
    const overflows = el.scrollHeight > el.clientHeight + 1
    if (overflows && level < MAX_DEGRADE) {
      adjustments.current += 1
      setLevel(level + 1)
      return
    }
    if (!overflows && level > 0
      && el.scrollHeight + DEGRADE_SLACK_PX <= el.clientHeight) {
      adjustments.current += 1
      setLevel(level - 1)
    }
  })

  return { ref, level }
}

/**
 * `variant`:
 * - `'full'` — the complete commercial cockpit (the Configurator's own rail).
 * - `'level1'` — the commercial result and its two secondary facts only, for
 *   read-oriented views (Export, Einstellungen, Präsentieren) and for the
 *   mode-change screen, which composes it ALONGSIDE its notice rather than
 *   substituting for it (SB-27).
 */
export function OfferPanel(
  { variant = 'full', footer }: { variant?: 'full' | 'level1'; footer?: ReactNode } = {},
) {
  const s = useStore()
  /**
   * ONE snapshot for the whole rail (VR3-03R rework, QA-01) — the result and
   * the projection it was derived from, frozen together, so the rail can
   * never render two instants at once.
   */
  const snapshot = commercialSnapshot(s)
  const p = snapshot.projection
  const commercial = snapshot.result
  /**
   * B2 · requirement 9 — the rail's area metrics, from the SNAPSHOT's own
   * result rather than from a fresh derivation, so the rail still renders
   * exactly one instant (QA-01) while gaining the segment denominators.
   *
   * What this replaces: a single `p.leadRate`, which for any complex fell
   * back to BGF above ground, so a mixed-use Option's WFL and commercial
   * NUF were unreachable on every internal surface.
   */
  const areaProjection = optionCommercialProjection(
    s, snapshot.result, kgCatalogueFor(s), s.kgConfig,
  )
  const t = useT()
  const tx = useTx()
  const lang: UiLanguage = s.uiLanguage
  const { reduced } = useSemanticMotion()

  const railHeadingId = useId()
  const amountHeadingId = useId()
  const effectsHeadingId = useId()
  const compositionHeadingId = useId()

  const num = useLocalNumber()
  /**
   * THE RAIL'S BAUZEIT UNDER `v3` — the Terminplan the user is actually
   * looking at, not the released fixture window.
   *
   * The released fact is a FIXTURE building-execution window (`≈ 7,5 Monate ·
   * Fertigstellung 28.01.2028`, `proposalDuration`), and `v3`'s schedule
   * stage computes the whole project from the ported phase model (`16,5
   * Monate`, planning included). Two answers to one question stood on one
   * screen, and the rail's was the one a seller quotes.
   *
   * It is the DISPLAY that is redirected, nothing else: `p.duration` still
   * feeds the client proposal, the comparison and the export, which read the
   * released schedule. That split is the honest description of a prototype
   * whose new schedule engine is not yet the source for the offer artefacts
   * — it is a stopgap and it is meant to disappear when `v3` becomes the
   * schedule, not a second permanent model.
   */
  const bauzeit = hasV3Surfaces(s.navVariant) ? bauzeitResultFor(s) : null

  const buildingIds = includedBuildingIds(s)
  const completeness = commercialCompleteness(commercial)
  const composition = commercialComposition(commercial)
  /* Only the three groups this pipeline asks about get a row; the rest of
     the baseline cost is one collapsed line, so the table still reconciles
     with its own subtotal (rule 32). */
  const { decided: compositionRows, rest: baselineRest } =
    railCompositionSplit(composition, KG_DECIDED_SCOPE_GROUPS)
  const effects = useMemo(
    // Ranking recomputes only when the committed commercial state moves:
    // `version` increments exactly on a settled change that moved the total.
    // Never on hover, never on preview, never on an unrelated re-render.
    () => selectedCommercialEffects(commercial, buildingIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commercial.version, commercial, buildingIds.join('|')],
  )

  // An exact zero can be a legitimate explicit exclusion outcome. It becomes
  // unavailable presentation only when the run is incomplete because scope
  // decisions are still unknown (rule 16).
  const priceUnavailable = p.result.total.exact.isZero()
    && p.result.completeness === 'incomplete'
    && Object.values(s.coverage).includes('unknown')
  const scopeEmpty = isScopeUniverseEmpty(s.coverage)

  const multiBuildingScope = buildingIds.length > 1
  const scopeTagLabel = s.scopeBuildingId
    ? buildingScopeLabel(s, s.scopeBuildingId)
    : t('offerPanel.scope.wholeComplex')
  const wholeOfferTotal = (multiBuildingScope && s.scopeBuildingId)
    ? projectProjection(s).result.total : null

  /* ── the committed change, in the commercial-basis line's own slot ────── */
  useEffect(() => {
    if (!s.activeDelta) return
    const timer = setTimeout(() => s.clearDelta(), DELTA_CHIP_MS)
    return () => clearTimeout(timer)
  }, [s.activeDelta])
  const shownDelta = useLastValue(s.activeDelta, reduced ? 0 : TOAST_EXIT_MS)
  const shownPreview = useLastValue(s.preview, reduced ? 0 : TOAST_EXIT_MS)
  const changeActive = !!s.activeDelta && !priceUnavailable

  /**
   * Which rows the last committed change moved — the same before/after diff
   * the released rail used, kept because the emphasis is IN PLACE and costs
   * no geometry: a background swap on the affected effect row and the
   * affected KG amount, for the change's own four-second life.
   */
  const previousAmounts = useRef<Record<string, string>>({})
  const changedKeys = new Set<string>()
  if (s.activeDelta) {
    for (const row of compositionRows) {
      const before = previousAmounts.current[row.group]
      const now = row.exact ? row.exact.toString() : ''
      if (before !== undefined && before !== now) changedKeys.add(row.group)
    }
    for (const effect of effects.all) {
      const before = previousAmounts.current[effect.key]
      const now = effect.exact ? effect.exact.toString() : ''
      if (before !== undefined && before !== now) changedKeys.add(effect.key)
    }
  }
  useEffect(() => {
    if (s.activeDelta) return
    const next: Record<string, string> = {}
    for (const row of compositionRows) next[row.group] = row.exact ? row.exact.toString() : ''
    for (const effect of effects.all) {
      next[effect.key] = effect.exact ? effect.exact.toString() : ''
    }
    previousAmounts.current = next
  })

  const { ref: bandRef, level: degradeLevel } = useBandDegradeLadder([
    priceUnavailable, scopeEmpty, s.mode, p.result.total.display,
    completeness.includedGroups, completeness.openDecisions,
    scopeTagLabel, multiBuildingScope, lang,
  ].join('|'))

  // D-22: the mark travels WITH the value, so the legend is owed only where
  // a value the RAIL renders carries it. The KG 300 subgroup rows that used
  // to force it are on Kostendetails § C now, and § G carries the legend
  // there — a permanent footnote in the rail for a mark the rail does not
  // print is two lines of a compact column spent on nothing.
  const hasDerivedMarker = effects.ranked.some((e) => e.label.includes(MARK))

  const openCostDetails = () => s.setPipelineView('kostendetails')

  const groupLabel = (group: CostGroup) =>
    `${group.replace('_', NNBSP)} ${t(`costGroup.${group}`)}`

  return (
    <aside
      aria-label={t('offerPanel.heading')}
      className={'a3-rail a3-cockpit flex h-full min-w-0 shrink-0 flex-col overflow-y-auto '
        + 'border-l border-border-strong bg-surface-default'
        + (s.pipelineView === 'konfigurator' ? ' a3-config-work-rail' : '')
        + (variant === 'level1' ? ' a3-cockpit-level1' : '')}
    >
      <h2 id={railHeadingId} className="a3-visually-hidden">{t('offerPanel.heading')}</h2>

      {/* ONE polite live region for the whole rail. A committed change is
          announced once, as one sentence, and a superseded announcement is
          REPLACED rather than queued — five simultaneous status regions is
          how a screen-reader user came to hear one decision five times. */}
      <div aria-live="polite" className="a3-visually-hidden">
        {changeActive && s.activeDelta && t('offerPanel.liveAnnouncement', {
          change: changeText(s.activeDelta, t, tx, lang),
          delta: signedOut(s.activeDelta.deltaExact, lang),
          total: moneyOut(p.result.total, lang),
        })}
      </div>

      {/* ═══ 1 · THE CURRENT COMMERCIAL RESULT ═══════════════════════════ */}
      <div className="a3-rail-sticky-top">
        <div className="a3-rail-band-budget" ref={bandRef}>
          {scopeEmpty ? (
            <DataStateBlock
              state="empty"
              sentence={t('offerPanel.empty.sentence')}
              detail={t('offerPanel.empty.detail')}
              action={(
                <Button
                  variant="secondary"
                  onClick={() => {
                    s.setPipelineView('konfigurator')
                    s.openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
                  }}
                >
                  {t('offerPanel.empty.action')}
                </Button>
              )}
            />
          ) : (<>
            {/* The scope expression, first, so the eye meets it before the
                amount (rule 38: structure does not change with scope). */}
            {multiBuildingScope && degradeLevel < 2 && (
              <p className="a3-cockpit-sig">{scopeTagLabel}</p>
            )}
            {/* The commercial signature. ALWAYS, and always immediately above
                the amount: `Gesamt netto · <scope>` and `Zwischensumme der
                kalkulierten Positionen` are different commercial claims, and
                a bare `Gesamt` is the Unqualified Total R-18 forbids. */}
            <h3 id={amountHeadingId} className="a3-cockpit-sig">
              {tx(p.result.totalLabel)}
            </h3>
            {priceUnavailable ? (
              <div className="a3-cockpit-hero-absent">
                <PartialState
                  label={t('money.priceNotDetermined')}
                  consequence={p.result.totalLabel}
                />
              </div>
            ) : (
              <p className="a3-cockpit-hero" aria-labelledby={amountHeadingId}>
                {p.result.total.prefix && (
                  <span aria-hidden="true">{p.result.total.prefix}{NNBSP}</span>
                )}
                {/* M-07: the total is REPLACED, never rolled. A number
                    counting through three values on its way to a fourth
                    states three amounts that are not true. */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={p.result.total.display}
                    initial={reduced ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduced ? 0 : 0.14 }}
                  >
                    {localizeMoneyText(p.result.total.display, lang)}
                  </motion.span>
                </AnimatePresence>
                <span className="a3-cockpit-unit">{NNBSP}€</span>
              </p>
            )}

            {/* CONFIDENCE · HIGH · ± 10–12 % — the owner's design, asked
                for verbatim and reaffirmed after the objection below, in the
                slot the retired `± 5 % · netto · Herkunft` line held. Same
                reserved height, so nothing under it moves (rule 24). No
                trigger and no link: it is a readout.

                BOTH VALUES ARE MOCKED, deliberately and visibly here rather
                than quietly in a fixture. `confidence` is not a quantity this
                product computes, and as a FIELD it is forbidden:
                `data-model.md` calls a single confidence grade the SOURCE-001
                blocker and models six independent axes instead, and the
                glossary forbids translating `Schätzunsicherheit` as
                "confidence". The interval is likewise not the calculated one
                (`p.uncertaintyPp`, ± 5 % for this fixture). Nothing reads
                these two strings — no calculation, no artefact, no export —
                so the mock stays a mock; when a real measure exists, this is
                the one place to replace.

                The word carries the state and the colour only repeats it
                (rule 8), so it survives grayscale; a rectangle with an accent
                edge, never a pill (rule 4).

                WHAT LEFT WITH THE OLD LINE, stated rather than discovered
                later: it held the workspace's only Herkunft-Popover for the
                total, and rule 40 asks the deactivated Regionalfaktor to
                appear there as well as in the Kostentreiber. The Kostentreiber
                row still carries it; the popover half of that rule has no
                surface in the rail until the affordance is re-homed. */}
            {!priceUnavailable && (
              <div className="a3-cockpit-quality">
                <p className="a3-cockpit-quality-k">{t('offerPanel.basis.title')}</p>
                <p className="a3-cockpit-quality-v">
                  <span className="a3-cockpit-quality-level">
                    {t('offerPanel.basis.level')}
                  </span>
                  <span className="numeric">
                    {localizePercentText(`±${NNBSP}10–12${NNBSP}%`, lang)}
                  </span>
                </p>
              </div>
            )}

            {/* THE CHANGE-FEEDBACK REGION — PRE-RESERVED, so it is empty and
                silent most of the time and costs the same height either way.
                A committed change renders here for four seconds, names its
                reference, and expires without a second wave: the box it
                leaves behind is the box it arrived in. */}
            <div className="a3-cockpit-changeslot">
              {/* GEIST-VORSCHAU LIVES IN THE BOX THAT IS ALREADY RESERVED.
                  It used to hang in the zero-height overlay anchor below the
                  pinned band, which was right while Level 2 underneath was a
                  single expandable list: the overlay covered it whole. The
                  cockpit's Level 2 is the secondary facts — three rows of
                  24/24/48 px — and a 40 px opaque overlay starting 12 px
                  into them cut the first rate's ascenders off above itself
                  and the second rate in half below: two mutilated lines
                  around a floating sentence, which is what «broken and
                  overlapping» means.
                  The chip's box next door was reserved for exactly this
                  kind of feedback, so the preview takes that box too and
                  still shifts no layout (rule 24): the reservation is the
                  one that was already there, which is also what SB-02
                  forbade ADDING, not what it forbade using.
                  BOTH are therefore rendered unconditionally and share one
                  grid cell — the ORDER between them is a layer, not a
                  render condition. The result of a committed click sits on
                  top and the hover hypothesis below it (tokens
                  `--layer-change-result` > `--layer-change-preview`,
                  components.css). Reason: the reader's mouse travels to the
                  NEXT option the moment it clicked, and under the previous
                  priority (preview > chip) that travel both covered and
                  extinguished a result nobody had finished reading. The
                  chip keeps its own four-second life (DC-2) and the preview
                  keeps its 200 ms intent delay and secondary colour
                  (DC-28); only who occludes whom changed.
                  intern-only at the RENDER, not only at the setter: a mode
                  switch with a preview open must not leave a hypothetical
                  price beside the real one in the client's view. */}
              {s.mode === 'intern' && (
                <p
                  className={'a3-preview numeric' + (s.preview ? ' a3-show' : '')}
                  aria-hidden={s.preview ? undefined : true}
                >
                  {shownPreview && (<>
                    <span className="a3-preview-line">
                      {tx('Vorschau')} · {translatedChangeLabel(shownPreview.change, t, tx, lang)}
                    </span>
                    <span className="a3-preview-line">
                      {shownPreview.futureTotal.prefix && (
                        <span aria-hidden="true">{shownPreview.futureTotal.prefix}{NNBSP}</span>
                      )}
                      {localizeMoneyText(shownPreview.futureTotal.display, lang)}{NNBSP}€
                      {' · '}
                      {signedOut(shownPreview.deltaExact, lang)}
                      {NNBSP}{t('offerPanel.preview.vsCurrent')}
                    </span>
                  </>)}
                </p>
              )}
              {changeActive && shownDelta && (
                <p
                  className="a3-cockpit-change"
                  data-direction={shownDelta.deltaExact.isZero() ? 'neutral'
                    : shownDelta.deltaExact.isNegative() ? 'decrease' : 'increase'}
                >
                  {changeText(shownDelta, t, tx, lang)}
                  {' · '}
                  <b>{signedOut(shownDelta.deltaExact, lang)}</b>{' '}
                  <span className="a3-cockpit-ref">
                    {t('commercial.change.against', {
                      reference: t('commercial.change.currentState'),
                    })}
                  </span>
                </p>
              )}
            </div>
          </>)}
        </div>
      </div>

      {/* ── secondary commercial facts: compact, never a second hero ────── */}
      {!scopeEmpty && !priceUnavailable && (
        <div className="a3-cockpit-facts">
          {/* One row per APPLICABLE metric, in the projection's own order:
              the segment Leitkennzahlen first, the construction scale last.
              WFL and NUF are separate rows because they are separate
              measurements — there is no row here that could hold a blended
              denominator (rule 39, R-11, DATA-001). */}
          {areaProjection.metrics.map((metric) => (
            <div className="a3-cockpit-fact" key={metric.id} data-metric={metric.id}>
              <span className="a3-cockpit-fact-v">
                {metric.rate.prefix && (
                  <span aria-hidden="true">{metric.rate.prefix}{NNBSP}</span>
                )}
                {localizeMoneyText(metric.rate.display, lang)}{NNBSP}€/m²
                {/* The rate NEVER appears without its denominator: `€/m²`
                    alone is not a commercial statement, it is half of one.
                    On the SAME line, at caption size, because the brief
                    budgets this fact at 20 px — a second line here is a line
                    the DIN composition loses. */}
                <span className="a3-cockpit-fact-k">
                  {tx(metric.rate.denominatorLabel)}
                </span>
              </span>
            </div>
          ))}
          {/*
            NO ENERGY ROW HERE, and the reason is a measured one.

            Requirement 9 puts the Energy standard on the Option SUMMARIES,
            and it is there: the Option card, Validate and the complete cost
            detail all state it. This rail is not a summary — it is the
            compact live cockpit, under a height budget the released suite
            enforces to the pixel ("a committed change costs ZERO downstream
            geometry"). An energy row breaks that, and not hypothetically:
            the variant names differ in length (`Effizienzhaus 55` against
            `Gesetzlicher Mindeststandard`), the longer one wraps in a
            320 px column, and the browser suite caught the rail growing
            27 px the first time a change was committed. Truncating it into
            an ellipsis would trade a layout defect for an ambiguous one.
          */}
          {/* A segment that applies and has no area keeps its norm on screen.
              `—` would read as "residential only" on a mixed-use Option. */}
          {areaProjection.gaps.map((gap) => (
            <div className="a3-cockpit-fact" key={`gap-${gap.id}`}>
              <span className="a3-cockpit-fact-k">
                {tx(gap.denominatorLabel)}
                {NNBSP}
                ·
                {NNBSP}
                {t('b2.metric.denominatorUnknown')}
              </span>
            </div>
          ))}
          <div className="a3-cockpit-fact">
            <span className="a3-cockpit-fact-v">
              <span aria-hidden="true">{'≈'}{NNBSP}</span>
              {bauzeit
                ? num(bauzeit.projectMonthsRounded,
                  bauzeit.projectMonthsRounded % 1 === 0 ? 0 : 1)
                : localizeMoneyText(
                  p.duration.display.replace(`${NNBSP}Monate`, ''), lang,
                )}
              {NNBSP}{t('offerPanel.duration.unit')}
              <span className="a3-cockpit-fact-k">
                {t('schedule.completionFromOkbp', {
                  date: formatDate(
                    bauzeit ? bauzeit.projectEndDate : p.duration.completionDate,
                    lang,
                  ),
                })}
              </span>
            </span>
          </div>
          {wholeOfferTotal && (
            <div className="a3-cockpit-fact">
              <span className="a3-cockpit-fact-k">
                {t('offerPanel.scope.offerTotalLabel')}
              </span>
              <span className="a3-cockpit-fact-k">
                {wholeOfferTotal.prefix && (
                  <span aria-hidden="true">{wholeOfferTotal.prefix}{NNBSP}</span>
                )}
                {localizeMoneyText(wholeOfferTotal.display, lang)}{NNBSP}€
              </span>
            </div>
          )}
        </div>
      )}

      {variant === 'full' && !scopeEmpty && (<>
        {/* The trust state, immediately under the number it qualifies. These
            are persistent states, not transient feedback: they appear when
            the product genuinely cannot vouch for the figure, and they stay
            until it can. */}
        {commercial.trust.status === 'stale' && (
          <div className="a3-cockpit-sect">
            <CommercialRailStatus
              tone="stale"
              label={commercial.trust.reason === 'persistence'
                ? t('vr3.rail.status.unsavedLabel')
                : t('vr3.rail.status.staleLabel')}
              reason={commercial.trust.reason === 'persistence'
                ? t('vr3.rail.status.unsavedReason')
                : t('vr3.rail.status.staleReason')}
              recovery={(
                <Button variant="secondary" onClick={() => s.retryCommercialResult()}>
                  {t('vr3.rail.status.retry')}
                </Button>
              )}
            />
          </div>
        )}
        {!commercial.reconciles && (
          <div className="a3-cockpit-sect">
            <CommercialRailStatus
              tone="error"
              label={t('vr3.rail.status.reconcileFailed')}
              reason={t('vr3.rail.status.reconcileDrift', {
                drift: commercial.reconciliationDrift.toFixed(2),
              })}
            />
          </div>
        )}

        {/* ═══ 2 · AUSWAHL MIT PREISWIRKUNG ═════════════════════════════ */}
        <section className="a3-cockpit-sect" aria-labelledby={effectsHeadingId}>
          <h3 id={effectsHeadingId}>{t('commercial.effects.heading')}</h3>
          <ul className="a3-cockpit-effects" aria-label={t('commercial.effects.listLabel')}>
            {effects.ranked.length === 0 ? (
              <li className="a3-cockpit-effects-empty">
                {t('commercial.effects.empty')}
              </li>
            ) : effects.ranked.map((effect) => (
              <li key={effect.key}>
                <EffectRow
                  effect={effect}
                  changed={changedKeys.has(effect.key)}
                  buildingIds={buildingIds}
                  lang={lang}
                  t={t}
                  onNavigate={(destination) => {
                    const nav = optionNav(destination)
                    s.setPipelineView(nav.view)
                    if (nav.step) s.openConfiguratorStepAt(nav.step)
                  }}
                />
              </li>
            ))}
          </ul>
          {/* The overflow line belongs to the LIST it overflows, which is
              where the approved target puts it (T-01/T-03/T-06, directly
              under the three rows) and where it can be read at all: moved
              below the DIN table it lands under a note about cost-group
              shares and stops naming which list has more.

              It is TEXT, not a second link. The target draws `Kostendetails`
              here as a link to the same page the CTA below already goes to,
              and a second 44 × 44 press target (rule 23 / R-04) inside a
              compact stack is the collision that rule refuses. The count is
              information; `Alle Kostendetails` is the one control that acts
              on it.

              The BOX is always present — the block's height must not depend
              on whether anything is hidden — and it carries text only when
              something actually is. `+ 0 weitere` never appears, because
              zero hidden entries is not an overflow. */}
          <p className="a3-cockpit-more">
            {effects.hiddenCount > 0 && (
              effects.hiddenWithoutAmountCount > 0
                ? t('commercial.effects.moreWithoutAmount', {
                  count: effects.hiddenCount,
                  without: effects.hiddenWithoutAmountCount,
                })
                : t('commercial.effects.more', { count: effects.hiddenCount })
            )}
          </p>
        </section>

        {/* ═══ 3 · KOSTENGRUPPEN NACH DIN 276 ═══════════════════════════ */}
        <section className="a3-cockpit-sect" aria-labelledby={compositionHeadingId}>
          <h3 id={compositionHeadingId}>{t('commercial.din.heading')}</h3>
          <table className="a3-cockpit-kg">
            <caption className="a3-visually-hidden">{t('commercial.din.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('commercial.din.colGroup')}</th>
                <th scope="col" className="a3-cockpit-num">{t('commercial.din.colAmount')}</th>
                <th scope="col" className="a3-cockpit-num">{t('commercial.din.colShare')}</th>
              </tr>
            </thead>
            <tbody>
              {compositionRows.map((row) => (
                <tr key={row.group} data-changed={changedKeys.has(row.group)}>
                  <th scope="row">{groupLabel(row.group)}</th>
                  {row.exact !== null ? (<>
                    <td className="a3-cockpit-num">{moneyOut(present(row.exact), lang)}</td>
                    <td className="a3-cockpit-share">
                      {row.sharePercent === null ? '' : percentOut(row.sharePercent, lang)}
                    </td>
                  </>) : (
                    /* UNKNOWN ≠ ZERO · NOT IN SCOPE ≠ ZERO · NO PRICE BASIS
                       ≠ ZERO. Each states its own case in words; none of them
                       is ever rendered as `0 €`. */
                    <td className="a3-cockpit-state" colSpan={2}>
                      {row.state === 'excluded' ? t('commercial.din.excluded')
                        : row.state === 'undecided' ? t('commercial.din.undecided')
                          : t('money.priceNotDetermined')}
                    </td>
                  )}
                </tr>
              ))}
              {baselineRest ? (
                <tr>
                  <th scope="row">{t('commercial.din.baselineRest')}</th>
                  <td className="a3-cockpit-num">
                    {moneyOut(present(baselineRest.exact), lang)}
                  </td>
                  <td className="a3-cockpit-share">
                    {baselineRest.sharePercent === null
                      ? ''
                      : percentOut(baselineRest.sharePercent, lang)}
                  </td>
                </tr>
              ) : null}
              <tr className="a3-cockpit-kg-total">
                <th scope="row">{tx(composition.totalLabel)}</th>
                <td className="a3-cockpit-num" colSpan={2}>
                  {priceUnavailable
                    ? t('money.priceNotDetermined')
                    : moneyOut(p.result.total, lang)}
                </td>
              </tr>
            </tbody>
          </table>
          {/* The percentage basis is stated ONCE, under the table — never
              repeated on every row. */}
          <p className="a3-cockpit-note">
            {composition.coverage === 'subtotal'
              ? t('commercial.din.noteSubtotal')
              : t('commercial.din.noteTotal')}
            {hasDerivedMarker && <>{' · '}{t('offerPanel.derivedMarker.legend')}</>}
          </p>
        </section>

        {/* ═══ 4 · ALLE KOSTENDETAILS ═══════════════════════════════════
            ONE control, ONE destination. Everything the rail cannot hold —
            the rest of the selected effects, the ledger, provenance, the
            history — is behind this single button, exactly as the target
            draws it. */}
        <div className="a3-cockpit-cta">
          <button type="button" onClick={openCostDetails}>
            {t('commercial.cta.costDetails')}
          </button>
        </div>

      </>)}
      {footer}
    </aside>
  )
}

/**
 * One selected commercial effect.
 *
 * THE VALUE IS THE CURRENT CONTRIBUTION, unsigned: `430.000 €`, never
 * `+ 430.000 €`. The `+`/`−` glyph is reserved for CHANGE — the change slot,
 * the preview, the Cost Details delta column — and for a contribution whose
 * own value is negative, which also carries the word `Minderung` so the
 * direction never depends on the glyph alone (rule 8).
 *
 * THE WHOLE ROW IS THE LINK where a destination resolves, and plain text
 * where none does — so a dead `Zur Entscheidung` is impossible by
 * construction rather than by review. Navigation goes through `optionNav`,
 * the one destination table the router, the card and the switcher all
 * resolve through; never a DOM anchor, never `scrollIntoView`.
 */
function EffectRow({
  effect, changed, buildingIds, lang, t, onNavigate,
}: {
  effect: SelectedCommercialEffect
  changed: boolean
  buildingIds: readonly string[]
  lang: UiLanguage
  t: (key: string, values?: Readonly<Record<string, string | number>>) => string
  onNavigate: (destination: NonNullable<SelectedCommercialEffect['destination']>) => void
}) {
  const name = translatedDriverLabel(
    { key: bareKey(effect.key, buildingIds), label: effect.label }, t, lang,
  )
  const state = effectStateLabel(effect, t, lang)
  const amount = effect.exact === null
    ? null
    : effect.exact.isNegative()
      ? signedOut(effect.exact, lang)
      : moneyOut(present(effect.exact), lang)
  const body = (<>
    <span className="a3-cockpit-effect-name">
      {name}
      {effect.destination && (
        <span className="a3-cockpit-effect-arrow" aria-hidden="true">{' ›'}</span>
      )}
      {state && <span className="a3-cockpit-effect-state">{state}</span>}
    </span>
    <span className="a3-cockpit-effect-amount">{amount ?? ''}</span>
  </>)
  if (!effect.destination) {
    return (
      <div className="a3-cockpit-effect" data-changed={changed}>{body}</div>
    )
  }
  const destination = effect.destination
  return (
    <button
      type="button"
      className="a3-cockpit-effect"
      data-changed={changed}
      aria-label={t('commercial.effects.toDecisionNamed', { decision: name })}
      onClick={() => onNavigate(destination)}
    >
      {body}
    </button>
  )
}

function bareKey(key: string, buildingIds: readonly string[]): string {
  if (buildingIds.length <= 1) return key
  const id = buildingIds.find((candidate) => key.startsWith(`${candidate}:`))
  return id ? key.slice(id.length + 1) : key
}

/**
 * Знаковая денежная величина. Порядок — `≈ + 97.000 €`: префикс округления
 * стоит ДО знака, потому что приблизительность относится к величине целиком.
 * ОДИН форматтер на все места.
 */
// F-38: exported so BuildingScope's readiness journal disclosure can format
// event deltas identically instead of a second, divergence-prone formatter.
export function signed(d: Decimal): string {
  if (d.isZero()) return `±${NNBSP}0${NNBSP}€`
  const pr = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${NNBSP}${pr.display}${NNBSP}€`
}

/**
 * SIDEBAR 03 (SB-14): `de` keeps the existing `DD.MM.YYYY` display; `en`
 * formats the same ISO date through `Intl.DateTimeFormat`.
 */
export function formatDate(iso: string, lang: UiLanguage): string {
  const [y, m, d] = iso.split('-')
  if (lang !== 'en') return `${d}.${m}.${y}`
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(`${y}-${m}-${d}T00:00:00Z`))
}
