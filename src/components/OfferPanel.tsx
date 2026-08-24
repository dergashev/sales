import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Decimal } from 'decimal.js'
import {
  activeBuilding, includedBuildingIds, projectProjection, translatedChangeLabel, useStore,
} from '../state/store'
import { effectiveFactValue } from '../state/buildingReview'
import { CATALOG } from '../state/catalog'
import { splitKg300 } from '../engine/risk'
import derivedFx from '../fixtures/derived-prototype.json'
import {
  NNBSP, present, rateLabel, formatDE, DENOMINATOR_LABEL, label as moneyLabel,
} from '../engine/money'
import type { CostGroup, CoverageState, Driver, DriverBasis, IncompleteReason } from '../engine/calculate'
import { isScopeUniverseEmpty, SCOPE_BOUNDARIES_DECIDABLE_GROUPS } from '../engine/calculate'
import { projectDriversForClient, translatedDriverLabel } from '../state/clientProjection'
import { CONFIGURATOR_STEP } from '../state/chapters'
import { Button, useCountUp } from './primitives'
import { OriginPopover } from './OriginPopover'
import { ClientNotice } from './ClientNotice'
import { DataStateBlock, PartialState } from './DataStates'
import { EstimateUncertaintyBadge } from './EstimateUncertaintyBadge'
import { useT, useTx, localizeMoneyText, localizePercentText } from '../i18n'
import type { UiLanguage } from '../i18n'
import { useSemanticMotion } from '../design-system/motion'
import { DELTA_CHIP_MS } from '../config/ui-policy'

/**
 * Правая панель оффера — постоянная зона всего приложения.
 *
 * «Цена видна всегда» — механика продукта: клиент видит последствие каждого
 * решения немедленно, на каком бы экране ни шла работа. Токен ширины
 * `--panel-right-width` существует в дизайн-системе именно для этой панели.
 *
 * Состав по контрактам: три со-главных героя (DC-38: тотал 64 — единственный
 * оранжевый, ведущая ставка 48, Bauzeit 48 с абсолютной датой), интервал
 * (DC-3), зарезервированный слот дельта-чипа (DC-2 — появление не сдвигает
 * вёрстку), Kostentreiber (DC-44 — обязателен после каждой калькуляции,
 * правило 35), разбивка KG, гейт с причиной и следующим шагом (DC-33) и
 * журнал сессии с подписью DC-12.
 */

/**
 * Последний показанный дельта-чип — чтобы содержимое пережило гашение.
 *
 * Приёмка № 17 нашла чип НЕВИДИМЫМ: `.a3-show` ставился через
 * `requestAnimationFrame` после монтирования, а rAF не выполняется в
 * неактивной вкладке — чип оставался с `opacity: 0`. Класс состояния,
 * зависящий от кадра анимации, — это не «отложенный старт транзишна», а
 * условие, которого может не наступить.
 *
 * Правильная анатомия контракта DC-2 та же, что в витрине: элемент
 * `.a3-delta` живёт в слоте ПОСТОЯННО, а появление и уход — это класс
 * `.a3-show` на нём. Стартовое состояние существует, потому что элемент
 * существовал раньше класса; кадр анимации ни при чём. Содержимое
 * сохраняется на время ухода — иначе чип гас бы пустым.
 */
function useLastValue<T>(current: T | null): T | null {
  const [last, setLast] = useState<T | null>(current)
  useEffect(() => {
    if (current) setLast(current)
  }, [current])
  return current ?? last
}

/** Пометка выведенной величины — из данных, не из разметки (D-22). */
const MARK = derivedFx.marker

/**
 * SIDEBAR 03 (SB-14): every other coverage short-form already equals the
 * Codex-delivered `coverage.*` key verbatim (`enthalten`/`nicht enthalten`/
 * `auf Anfrage`/`noch offen`) — only `notApplicable`'s abbreviation ("n. a.")
 * intentionally differs from the delivered full phrase ("nicht anwendbar"),
 * so it keeps its own local key rather than losing the abbreviation.
 */
const COVERAGE_SHORT_KEY: Record<CoverageState, string> = {
  included: 'coverage.included', excluded: 'coverage.excluded',
  onRequest: 'coverage.onRequest', unknown: 'coverage.unknown',
  notApplicable: 'panel.coverage.notApplicableShort',
}

/**
 * SIDEBAR 03 (SB-14) locale-aware wrappers around `engine/money.ts`'s
 * exported formatters. `src/engine/**` stays untouched (out of scope) —
 * these re-typeset the ALREADY-DECIDED numeral each formatter produces via
 * `localizeMoneyText`/`localizePercentText` (see `src/i18n/index.ts`); they
 * never re-derive a rounding rule. `signed()`/`label()`/`rateLabel()`
 * themselves stay untouched too — `signed()` is shared with
 * BuildingScope.tsx and must not change for that consumer.
 */
function moneyOut(d: ReturnType<typeof present>, lang: UiLanguage, unit = '€'): string {
  return localizeMoneyText(moneyLabel(d, unit), lang)
}
function rateOut(r: Parameters<typeof rateLabel>[0], lang: UiLanguage): string {
  return localizeMoneyText(rateLabel(r), lang)
}
function signedOut(d: Decimal, lang: UiLanguage): string {
  return localizeMoneyText(signed(d), lang)
}
function percentOut(value: Decimal, decimals: number, lang: UiLanguage): string {
  return localizePercentText(`${value.toFixed(decimals)}${NNBSP}%`, lang)
}

/**
 * Task 02 (deep-coherence audit, F-01): a per-building driver's `exact`
 * contribution is already correctly computed per building — only its
 * ATTRIBUTION was invisible. `store.ts`'s `computeProjection` already
 * prefixes every driver's `key` with its building id
 * (`${list[i].id}:${d.key}`) whenever more than one building is included;
 * this reads that same prefix back to resolve a display name, intern-mode
 * only. Client-facing `scopeRefs` (R-25) are unrelated and unchanged — this
 * never runs when `s.mode !== 'intern'`.
 */
function driverBuildingLabel(
  s: ReturnType<typeof useStore.getState>,
  key: string,
): string | null {
  if (s.mode !== 'intern') return null
  const ids = includedBuildingIds(s)
  if (ids.length <= 1) return null
  const id = ids.find((candidate) => key.startsWith(`${candidate}:`))
  if (!id) return null
  const review = s.buildingReviews[id]
  return review ? effectiveFactValue(review.facts.documentationName) ?? id : id
}

/**
 * SIDEBAR 02 (backlog 41b8ab39, SB-09/SB-10, AC-1): the display name for a
 * single narrowed building — same resolution as `driverBuildingLabel` above
 * (documentation name, falling back to the raw id), but usable regardless
 * of `s.mode` since the scope tag itself is not intern-only (the salesperson
 * must be able to state the scope out loud in every mode, rule 8/38).
 */
function buildingScopeLabel(
  s: ReturnType<typeof useStore.getState>,
  id: string,
): string {
  const review = s.buildingReviews[id]
  return review ? effectiveFactValue(review.facts.documentationName) ?? id : id
}

type ContributionRow = {
  key: string
  label: string
  exact: Decimal
  buildingLabel: string | null
}

/**
 * SIDEBAR 03 (backlog 2be8e69c, SB-13). Shared by the Level 2 group
 * children list and the loose-contribution recap fallback — both render
 * per-building `Driver[]` and both hit the same defect: `driverBuildingLabel`
 * correctly returns `null` in Kundenansicht (R-25), which collapses two
 * different buildings' identical-label contributions (e.g. two buildings
 * both choosing "Energiestandard EH 55") into a byte-identical duplicate
 * row with no way to tell them apart. In Kundenansicht only, same-label
 * siblings are aggregated into ONE row summing their exact contributions
 * (Decimal addition is associative — rule 32 reconciliation is unaffected)
 * instead of exposing which building chose it. Vorbereitung is unchanged:
 * per-building rows, unaggregated, exactly as before this task.
 */
function clientSafeContributionRows(
  items: readonly Driver[],
  labelFor: (d: Driver) => string,
  s: ReturnType<typeof useStore.getState>,
): ContributionRow[] {
  const rows: ContributionRow[] = items.map((d) => ({
    key: d.key,
    label: labelFor(d),
    exact: d.exact,
    buildingLabel: driverBuildingLabel(s, d.key),
  }))
  if (s.mode === 'intern') return rows
  const byLabel: Record<string, ContributionRow> = {}
  for (const row of rows) {
    const existing = byLabel[row.label]
    if (existing) existing.exact = existing.exact.plus(row.exact)
    else byLabel[row.label] = { ...row }
  }
  return Object.values(byLabel)
}

/**
 * SIDEBAR 01 (backlog eda1e221) - `variant`:
 * - `'full'` (default) - Level 1 + Level 2 + Level 3, the Configurator's own
 *   rail.
 * - `'level1'` - Level 1 only, a compact orientation strip. Used on
 *   Variantenvergleich/Export/Einstellungen (SB-20, no full breakdown on a
 *   read-only view) and from `ConfigurationModeReadiness` when a priced
 *   offer opens "Modus ändern" (SB-27: the commercial context stays visible,
 *   the mode-change notice is added beside it, not substituted for it).
 *
 * `footer`: SB-27 — rendered inside this same `<aside>`, after the rail
 * content, so the mode-change notice (`ModeChangeNotice`, S3Konfigurator.tsx)
 * sits beside the commercial context instead of replacing it — one rail
 * column, not two stacked asides.
 */
export function OfferPanel(
  { variant = 'full', footer }: { variant?: 'full' | 'level1'; footer?: ReactNode } = {},
) {
  const s = useStore()
  const p = s.projection()
  const t = useT()
  const tx = useTx()
  // SIDEBAR 03 (backlog 2be8e69c, SB-14): the single locale read every
  // numeral/date wrapper below keys off. `document.documentElement.lang`
  // itself is kept in sync with this same field at the app root (App.tsx),
  // not here — the rail only needs the value, not the side effect.
  const lang: UiLanguage = s.uiLanguage
  // SIDEBAR 03 (SB-29): heading ids for the Level 1 metric groups the rail
  // had no heading for at all (the audit's own two-`h2` measurement no
  // longer applies — SIDEBAR 01 already removed both of those in favour of
  // `aria-label`s that carry no heading semantics; this restores exactly
  // one non-skipping hierarchy under a new rail-root `h2`).
  const railHeadingId = useId()
  const amountHeadingId = useId()
  const leadRateHeadingId = useId()
  const durationHeadingId = useId()
  const compositionHeadingId = useId()
  const { reduced } = useSemanticMotion()
  const [journalOpen, setJournalOpen] = useState(false)
  // SIDEBAR 01: Level 2 (die Kostenzusammensetzung) ist per Vertrag "expanded
  // by default" - kein eigenes äußeres Toggle mehr (vormals `kgOpen`/
  // `treiberOpen`, beide entfernt, siehe Level-2-Abschnitt unten). Nur
  // Level 3 ("Nachweise & Verlauf") bleibt disclosure, gemeinsam mit dem
  // KG-300-Untergruppen-Twist, der jetzt DORT lebt statt in der Level-2-
  // Zeile selbst (Report §8: "KG 300 Untergruppen" ist Level-3-Inhalt).
  const [level3Open, setLevel3Open] = useState(false)
  const [kg300Open, setKg300Open] = useState(false)
  // SIDEBAR 01 (backlog eda1e221, SB-03): which Level 2 DIN-276 group rows
  // currently have their merged contribution-decision children open —
  // independent per group, all collapsed by default (test hint: "one KG
  // group expanded" exercises exactly this).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  // Правило 24: чип «долетает» до журнала — при уходе чипа журнал вспыхивает
  // один раз. Цветовой transition, не кейфрейм (правило 20); гаснет при
  // prefers-reduced-motion (правило 21).
  const [journalFlash, setJournalFlash] = useState(false)
  const prevDelta = useRef(s.activeDelta)

  useEffect(() => {
    if (!s.activeDelta) return
    const t = setTimeout(() => s.clearDelta(), DELTA_CHIP_MS)
    return () => clearTimeout(t)
  }, [s.activeDelta])

  useEffect(() => {
    const was = prevDelta.current
    prevDelta.current = s.activeDelta
    if (was && !s.activeDelta && !reduced) {
      setJournalFlash(true)
      const t = setTimeout(() => setJournalFlash(false), 600)
      return () => clearTimeout(t)
    }
  }, [s.activeDelta, reduced])

  const totalCount = useCountUp(
    new Decimal(p.result.total.display.replace(/\./g, '')), 0,
  )
  // An exact zero can be a legitimate explicit exclusion outcome. It becomes
  // unavailable presentation only when the run is incomplete because scope
  // decisions are still unknown. The calculation remains unchanged; this is
  // the rule-16 presentation boundary that prevents a fabricated zero hero.
  const priceUnavailable = p.result.total.exact.isZero()
    && p.result.completeness === 'incomplete'
    && Object.values(s.coverage).includes('unknown')
  // Task 03 (deep-coherence audit, F-10): a fresh option starts with every
  // KG group at its determinate `excluded` default (22.08.2026 binary-scope
  // contract) — a fully DECIDED, `complete` scope with a real total of
  // exactly zero. `priceUnavailable` above only catches the older
  // unknown-coverage case; this catches the newer one, and neither may be
  // collapsed into the other (they name different facts: no decision yet,
  // vs. every decision already made and none of them `included`).
  const scopeEmpty = isScopeUniverseEmpty(s.coverage)

  // SIDEBAR 02 (backlog 41b8ab39, SB-09/SB-10, AC-1): the scope expression is
  // a NEW, separate, always-first element — it must never be folded into
  // `p.result.totalLabel`'s one string (that string stays identical in the
  // hero, the drivers sum row, the KG total row and every caption, per
  // AC-2/SB-08). It only renders when there is genuine scope ambiguity to
  // resolve (more than one building included) — same guard
  // `driverBuildingLabel` already uses, so a single-building project keeps
  // its current, already-unambiguous structure (rule 38: structure does not
  // change with scope).
  const multiBuildingScope = includedBuildingIds(s).length > 1
  const scopeTagLabel = s.scopeBuildingId
    ? buildingScopeLabel(s, s.scopeBuildingId)
    : t('offerPanel.scope.wholeComplex')
  // The offer-wide total, independent of the DC-46 reading lens (same
  // exported helper `projectTotal`'s toast/undo copy already relies on —
  // "the complete sold option, independent of the Configurator reading
  // lens"). Computed only when actually needed: a building subtotal is on
  // screen (`s.scopeBuildingId` narrowed) and there is more than one
  // building, otherwise the hero's own total already IS the offer total.
  const wholeOfferTotal = (multiBuildingScope && s.scopeBuildingId)
    ? projectProjection(s).result.total : null

  // AC-3: completeness line. `SCOPE_BOUNDARIES_DECIDABLE_GROUPS` and
  // `s.coverage` are the same authority `isScopeUniverseEmpty` above already
  // reads; `includedUnpriced` reasons are the same typed signal
  // `deriveCompleteness` (engine) already produces per building, now also
  // fed by `computeProjection`'s option-level scope-catalog check
  // (state/store.ts) — no new completeness mechanism, only a new read of
  // the existing one.
  const decidedGroups = SCOPE_BOUNDARIES_DECIDABLE_GROUPS
    .filter((g) => s.coverage[g] !== 'unknown').length
  const includedGroups = SCOPE_BOUNDARIES_DECIDABLE_GROUPS
    .filter((g) => s.coverage[g] === 'included').length
  const unpricedGroups = new Set(
    p.result.incompleteReasons
      .filter((r): r is Extract<IncompleteReason, { code: 'includedUnpriced' }> =>
        r.code === 'includedUnpriced')
      .flatMap((r) => r.groups),
  )
  const pricedGroups = includedGroups - unpricedGroups.size

  // SB-25/SB-26/AC-10/AC-11: one shared before/after diff drives both the
  // per-row changed marker AND whether the top-level chip needs to name
  // itself "insgesamt" (total movement, not just the driver's own
  // contribution) — a single decision that also moves other rows by
  // cascade (e.g. excluding KG 400 moves KG 700) is exactly the case where
  // more than one key changes here. `prevAmounts` only refreshes while NO
  // delta is in flight, so the comparison always spans "before this
  // decision" → "after it", the same window the delta chip itself is
  // visible for (`s.activeDelta`, rule 24/29's existing 8 s slot) — no new
  // timer.
  const prevAmounts = useRef<Record<string, Decimal>>({})
  const changedKeys = new Set<string>()
  if (s.activeDelta) {
    for (const [g, v] of Object.entries(p.kgSplit)) {
      if (v !== undefined && !v.equals(prevAmounts.current[g] ?? v)) changedKeys.add(g)
    }
  }
  useEffect(() => {
    if (s.activeDelta) return
    const next: Record<string, Decimal> = {}
    for (const [g, v] of Object.entries(p.kgSplit)) {
      if (v !== undefined) next[g] = v
    }
    prevAmounts.current = next
  })
  // More than one Level 2 row moved: the decision had a cascade
  // (KG 400 excluded also moved KG 700/KG 800) — the top-level chip's total
  // movement is no longer just "this row's own contribution" and must name
  // itself accordingly (SB-26/AC-11). Wrapped in an object so the existing
  // `useLastValue` idiom (falsy-gated) can correctly latch a `false` value
  // for the chip's whole fade-out window, exactly like `shownDelta` itself.
  const deltaHasCascade = changedKeys.size > 1

  const shownDelta = useLastValue(s.activeDelta)
  // `useLastValue` latches via a `useEffect` keyed on referential identity
  // — a fresh `{ cascade }` object literal constructed inline on every
  // render would change identity every render even when `deltaHasCascade`
  // itself does not, firing that effect (and therefore `setState`) on
  // every render and looping. `useMemo` keyed on the primitive boolean
  // keeps the same reference across renders where nothing changed.
  const cascadeFlag = useMemo(
    () => (s.activeDelta ? { cascade: deltaHasCascade } : null),
    [s.activeDelta, deltaHasCascade],
  )
  const shownCascade = useLastValue(cascadeFlag)
  const shownPreview = useLastValue(s.preview)
  const blocked = !activeBuilding(s).gebaeudeklasse.confirmed

  // SIDEBAR 01 (backlog eda1e221, SB-01/AC-1/AC-2) - the pinned Level 1
  // header has a hard CSS budget (`--size-rail-header-budget`,
  // `.a3-rail-header-budget{max-height;overflow:hidden}`). When content
  // would overflow that budget, degradable elements step down BEFORE the
  // amount/name/completeness ever clip: step 1 hides the three "Herkunft
  // anzeigen" origin-popover triggers, step 2 drops the uncertainty range's
  // money edges (kept as the `compact` ±pp presentation, DC-3's other
  // released variant — the ticket's own KEEP-list requires ±pp to stay),
  // step 3 drops the leadRate hero's secondary-rate/per-unit context line
  // (both explicitly "MAKE CONTEXTUAL" in the ticket, not "KEEP ALWAYS
  // VISIBLE"). Amount/name/completeness/Bauzeit+Fertigstellung never drop.
  //
  // SIDEBAR 02 (backlog 41b8ab39, SB-09/AC-1) added step 4, discovered by
  // live Playwright measurement, not anticipated at design time: a real
  // two-building fixture with a full DIN-276 scope at 1280×800 (the
  // narrower required viewport — `--size-rail-header-budget` clamps to
  // 320 px there vs 360 px at 1440) leaves steps 1–3 with less spare
  // capacity than the new scope tag's own minimal footprint (16 px
  // line-height + 4 px margin) costs — measured live: without step 4, the
  // Bauzeit hero's "Fertigstellung" date (rule 31: never renders at
  // footnote size, never disappears) was itself clipped by 16 of its own
  // 20 px, not merely the new tag's context. The new tag is genuinely new
  // content with no such protection; step 4 hides IT, never Bauzeit,
  // resolving the conflict in favour of the older, established invariant.
  // This is a real last resort, not the common case: single-building
  // projects never render the tag at all, and every multi-building state
  // this task could reach in its own required viewports/states short of
  // this specific dense combination stops at step 3.
  const budgetRef = useRef<HTMLDivElement>(null)
  const [degradeLevel, setDegradeLevel] = useState<0 | 1 | 2 | 3 | 4>(0)
  const degradeResetKey = [
    priceUnavailable, scopeEmpty, s.mode, p.leadRate.display, p.duration.display,
    p.result.total.display, t('common.showOrigin'), scopeTagLabel, multiBuildingScope,
  ].join('|')
  useLayoutEffect(() => { setDegradeLevel(0) }, [degradeResetKey])
  useLayoutEffect(() => {
    const el = budgetRef.current
    if (!el) return
    if (degradeLevel < 4 && el.scrollHeight > el.clientHeight + 1) {
      setDegradeLevel((d) => (d < 4 ? ((d + 1) as 0 | 1 | 2 | 3 | 4) : d))
    }
  })

  // Сессионная дельта (DC-12, CALC-014): сумма точных дельт журнала —
  // undo несёт отрицание, поэтому простая сумма и есть «к базе», без
  // второго источника в виде запомненного базового итога.
  const ctxJournal = s.journal.filter((e) => e.optionId === s.activeOptionId)
  const sessionDelta = ctxJournal.reduce(
    (acc, e) => (e.deltaExact ? acc.plus(e.deltaExact) : acc),
    new Decimal(0),
  )
  // «übernommene Änderungen» — это изменения ЦЕНЫ, а не все события журнала.
  // Прежде считалась длина журнала, и отправка оффера увеличивала счётчик
  // изменения цены, ничего не изменив: подпись утверждала неправду о деньгах.
  const priceChangeCount = ctxJournal.filter((e) => e.deltaExact !== null).length

  // KG 800's itemized financing breakdown is private-by-default (QA
  // finding on ae2eb8f): every surface below that lists individual
  // `Driver[]` rows must read through this projection, not the raw engine
  // drivers, or the three `kg800_*` lines leak into Kundenansicht even
  // though the KG 800 chapter itself is correctly absent from client nav.
  const clientSafeDrivers = projectDriversForClient(
    p.result.drivers, s.mode, s.kg800ClientRevealed,
  )
  // SIDEBAR 03 (backlog 2be8e69c, SB-15): `⚙` is baked directly into a
  // driver's `label` at the engine (`scopeCatalog.ts`'s `evidenceMark`,
  // out of this task's scope) whenever `evidenceClass !== 'R'`, and every
  // KG 300 risk-basis subgroup row carries it unconditionally (D-22). One
  // shared legend covers every occurrence in the rail, gated on whether
  // any currently-rendered surface actually carries the marker.
  const hasDerivedMarker = clientSafeDrivers.some((d) => d.label.includes(MARK))
    || !!p.kgSplit.KG_300

  // «Корзина»: вклады, рождённые РЕШЕНИЯМИ, — по признаку самого вклада,
  // а не по префиксу ключа. Приёмка № 17 показала цену догадки: фильтр по
  // `opt_/cov_/kg700_` пропускал выбор подвала, и панель говорила
  // «Standardumfang» при изменившейся сумме.
  const decisions = clientSafeDrivers.filter((d) => d.origin === 'decision')
  // Task 04 (F-11, rule 32): `kg300_excluded_adjustment`/`kg400_excluded_
  // adjustment` (store.ts, Product Decision e2dac9b5) are a NEGATIVE
  // correction representing a group the seller REMOVED from scope — the
  // audit found this exact contribution listed under "Im Angebot gewählt"
  // ("KG 300 … ausgeschlossen ≈ −4.437.000 €"), reading as a charge for
  // something explicitly excluded. Split by these two known, explicit
  // adjustment keys (the only ones this shape exists for) rather than by
  // sign — an ordinary money-saving CHOICE (e.g. a cheaper facade) is also
  // negative and belongs in "gewählt", not "Ausgeschlossen".
  const chosen = decisions.filter((d) =>
    d.key !== 'kg300_excluded_adjustment' && d.key !== 'kg400_excluded_adjustment')
  const excludedAdjustments = decisions.filter((d) =>
    d.key === 'kg300_excluded_adjustment' || d.key === 'kg400_excluded_adjustment')
  const notIncluded = (Object.keys(s.coverage) as CostGroup[]).filter(
    (g) => ['unknown', 'onRequest', 'excluded'].includes(s.coverage[g]),
  )

  // Task 04 (F-12, rule 32): Risikozuschläge (`block: 'surcharge'`) sind
  // additiv NACH dem Bauwerk-Block (calculation-spec §2) — real im
  // gedruckten Total enthalten, aber keiner DIN-276-Gruppe zugeordnet.
  // Eigene Summenzeile statt Einfaltung in KG 300: `splitKg300()` liest
  // dieselbe KG-300-Zahl für die Untergruppen-Aufklappung, und eine
  // eingefaltete Zulage würde dort strukturell auf alle Untergruppen
  // verteilt, statt auf die eine, für die sie tatsächlich gilt.
  const riskSurchargeSum = p.result.drivers
    .filter((d) => d.block === 'surcharge')
    .reduce((sum, d) => sum.plus(d.exact), new Decimal(0))

  // SIDEBAR 01 (backlog eda1e221, SB-03): the Level 2 DIN-276 rows a
  // decision/excluded-adjustment attaches to. `chosen`/`excludedAdjustments`
  // must stay reachable even when their target group's row happens not to
  // render (F-11's scenario: excluding KG 300 from coverage removes its row
  // from the table entirely — unchanged, pre-existing behavior — but the
  // exclusion's own negative money adjustment still needs a place to live,
  // exactly as it did in the old standalone recap). `looseChosen`/
  // `looseExcluded` below catch anything no rendered group's children list
  // claimed, so nothing the former recap showed can silently disappear.
  const kgRows = (Object.entries(p.kgSplit)
    .filter((e): e is [string, Decimal] => e[1] !== undefined
      && s.coverage[e[0] as CostGroup] === 'included'))
  const groupChildrenFor = (group: CostGroup) => (
    group === 'KG_300' ? chosen.filter((d) => d.scopeRefs.includes('KG 300'))
      : group === 'KG_400' ? []
      : chosen.filter((d) => d.scopeRefs.includes(group.replace('_', ' ')))
  )
  const groupExcludedFor = (group: CostGroup) => excludedAdjustments.filter((d) =>
    (group === 'KG_300' && d.key === 'kg300_excluded_adjustment')
    || (group === 'KG_400' && d.key === 'kg400_excluded_adjustment'))
  const attributedKeys = new Set(kgRows.flatMap(([g]) => {
    const group = g as CostGroup
    return [...groupChildrenFor(group), ...groupExcludedFor(group)].map((d) => d.key)
  }))
  const looseChosen = chosen.filter((d) => !attributedKeys.has(d.key))
  const looseExcluded = excludedAdjustments.filter((d) => !attributedKeys.has(d.key))

  return (
    <aside
      aria-label="Angebot"
      // SIDEBAR 01 (backlog eda1e221, SB-19/SB-28, AC-8): `a3-rail` carries
      // `scroll-padding-top: var(--size-rail-header-budget)` so
      // `scrollIntoView`/keyboard focus on a Level 2/3 row lands inside the
      // readable window, never underneath the pinned header — the token
      // matches the budget `.a3-rail-header-budget` is capped to, so the
      // two can never drift apart.
      className="a3-rail flex h-full w-panel-right min-w-0 max-w-panel-right shrink-0 flex-col overflow-y-auto border-l border-border-strong bg-surface-default"
    >
      {/* SIDEBAR 03 (backlog 2be8e69c, SB-29): the rail's own heading root.
          `aria-label="Angebot"` above already names the `<aside>` landmark
          for assistive tech that reads landmarks — it is not a heading and
          never appears in heading-list navigation, which is exactly what
          SB-29 measured missing. Visually hidden (`.a3-visually-hidden`,
          already this file's own convention for the KG tables' captions
          just below) so it adds a real heading without adding visible
          chrome or spending any of the pinned header's fully-committed
          budget (SIDEBAR 01 authority, not reopened here) — it sits OUTSIDE
          `.a3-rail-sticky-top`/`.a3-rail-header-budget` entirely. */}
      <h2 id={railHeadingId} className="a3-visually-hidden">{t('offerPanel.heading')}</h2>
      {/* Task 04 (F-13, STEP-005): «Липкий контекст цены реализуется, а не
          декларируется рядом» — герой DC-38 + Geist-Vorschau + Delta-Chip
          остаются видимыми, пока остальная рельса (Recap, Kostentreiber,
          KG-Tabelle, Journal) под ними прокручивается. `<aside>` — уже
          собственный независимый скролл-контейнер (не документ — F-13's
          page-level-scroll устранён в tokens.css/`.a3-app-shell`); этот
          блок — прямой flex-потомок `<aside>`, `position:sticky` поэтому
          закрепляется относительно ЕГО скролла, не документа. */}
      <div className="a3-rail-sticky-top">
        {/* SIDEBAR 03 (backlog 2be8e69c, SB-17): `aria-live="polite"` used to
            sit on this whole wrapper — total, range, uncertainty, `netto`,
            3 provenance triggers, lead rate + denominator + secondary rate,
            Bauzeit + datum + completion date, the preview slot and the
            change slot all re-announced together on every recalculation
            (~40 words). Scoped down to exactly the amount and the change:
            a dedicated, visually hidden region that only carries content
            while a change is active (`s.activeDelta`), built from the same
            already-localized strings the visible amount/chip render below
            (never re-reads the DOM, never duplicates a value the visible
            hero doesn't already have). */}
        <div aria-live="polite" className="a3-visually-hidden">
          {!priceUnavailable && s.activeDelta && t('offerPanel.liveAnnouncement', {
            change: s.activeDelta.change
              ? translatedChangeLabel(s.activeDelta.change, t) : s.activeDelta.label,
            delta: signedOut(s.activeDelta.deltaExact, lang),
            total: moneyOut(p.result.total, lang),
          })}
        </div>
        {/* SIDEBAR 01 (backlog eda1e221, SB-01/SB-02, AC-1/AC-2/AC-4) - the
            sticky wrapper itself no longer carries the height budget: it
            only establishes the sticky positioning/stacking context. The
            budgeted content lives in `.a3-rail-header-budget` (hard
            `max-height`+`overflow:hidden`, `ref={budgetRef}` feeds the
            degrade-level measurement above), and the change-slot anchor
            below it is a zero-height sibling so the ghost/delta slots
            overlay Level 2 instead of permanently reserving pinned height
            (SB-02) — see `.a3-change-slot-anchor` in components.css. */}
        <div className="a3-rail-header-budget" ref={budgetRef}>
        {/* ── Герой №1: тотал — единственный оранжевый (DC-38) ───────────
            Кегли, цвет и выравнивание по базовой линии приходят из системы
            (`.a3-hb-total .a3-hb-num` = 64 px accent, `.a3-hb-unit` = 24 px):
            иерархия метрик принадлежит дизайну, а не этому файлу. */}
        {/* SIDEBAR 02 (backlog 41b8ab39, SB-09/SB-10, AC-1): the scope
            expression — a NEW, separate element, always first, so the eye
            meets it before the amount. Reuses the canonical `.a3-mtag`
            small-bold-caps tag (already used for "Im Angebot gewählt" /
            "Kostenzusammensetzung") rather than a new local primitive.
            Renders identically in the empty and priced states below (one
            story, rule 38: structure does not change with scope).
            Deliberately a SIBLING of `.a3-heroband`, not a child: that
            container is `display:flex;flex-wrap:wrap` with its own
            `row-gap` (SIDEBAR 01 contract above) — a child forced onto its
            own row by `w-full` still pays that row-gap a second time
            (measured live: 12 px extra at 1280×800, on top of its own
            16 px line-height + 4 px margin, tipping an already
            fully-committed budget into a 37 px clip). As an independent
            block sibling it costs only its own line-height + margin.
            `degradeLevel < 4`: the true last resort (see the degrade
            ladder docblock above) — sacrifices this tag, never Bauzeit's
            "Fertigstellung" date, in the one dense combination measured
            where the budget cannot hold both. */}
        {multiBuildingScope && degradeLevel < 4 && (
          <p className="a3-mtag">{scopeTagLabel}</p>
        )}
        {/* Герои — в ленте контракта (.a3-heroband): базовая линия и
            переносы принадлежат системе, не этому файлу (дефект 17). */}
        <div className="a3-heroband">
        {scopeEmpty ? (
          /* Task 03 (F-10): a genuinely empty Declared Pricing Scope never
             renders as a qualified 0-€ hero with a band, rate and
             completion date — it names the actual state and its one next
             step (rule 16, rule 30 `empty`). */
          <DataStateBlock
            state="empty"
            sentence={t('offerPanel.empty.sentence')}
            detail={t('offerPanel.empty.detail')}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  s.setPipelineView('konfigurator')
                  s.openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
                }}
              >
                {t('offerPanel.empty.action')}
              </Button>
            }
          />
        ) : (<>
        <div className="a3-hb a3-hb-total">
          {/* SB-29: the amount's own existing visible label promoted to a
              real heading — no new copy, same class, same text. */}
          <h3 id={amountHeadingId} className="a3-hb-cap">{tx(p.result.totalLabel)}</h3>
          {priceUnavailable ? (
            <PartialState
              label={t('money.priceNotDetermined')}
              consequence={p.result.totalLabel}
            />
          ) : (
            <p className="a3-hb-num numeric" aria-labelledby={amountHeadingId}>
              {p.result.total.prefix && (
                <span aria-hidden="true">{p.result.total.prefix}{NNBSP}</span>
              )}
              {localizeMoneyText(totalCount, lang)}
              <span className="a3-hb-unit">{NNBSP}€</span>
            </p>
          )}
        {/* Интервал — полосой с денежными краями (DC-3): «± 22 %» отвечает
            «насколько точно», края отвечают «сколько это в деньгах», и на
            переговорах спрашивают второе. */}
        {/* SIDEBAR 01 (backlog eda1e221, SB-01, AC-1/AC-2/AC-4): degrade
            step 2 — over the header budget, the range drops its money
            edges and keeps only the named ±pp (DC-3's `compact`
            presentation, the same component's other released variant, not
            a new one). Amount/name/completeness never degrade. At this
            step the range and the completeness ("netto") line also merge
            onto one line: once the range is `compact` and the Herkunft
            trigger (degrade step 1, already active whenever step 2 is) is
            gone, both are short text fragments — sharing a line costs
            nothing semantically and saves a full line's height inside the
            hard budget. */}
        {!priceUnavailable && (degradeLevel < 2 ? (
          <div className="mt-2">
            <EstimateUncertaintyBadge
              presentation="range" totalExact={p.result.total.exact} pp={p.uncertaintyPp}
            />
          </div>
        ) : (
          <p className="a3-cap mt-1">
            <EstimateUncertaintyBadge presentation="compact" pp={p.uncertaintyPp} />
            {' · '}{t('money.net')}
          </p>
        ))}
        {/* SIDEBAR 01 degrade step 1: the three "Herkunft anzeigen" origin
            triggers (this one, the leadRate's below, and the duration's)
            are the first thing to give way over budget — the amount/rate/
            duration values themselves stay, only their origin-popover
            entry point steps back. Once step 2 is also active the
            completeness line above already carries "netto" merged with
            the range, so this whole line — text plus trigger — only
            exists pre-step-2. */}
        {!priceUnavailable && degradeLevel < 2 && <p className="a3-cap mt-1">
          {t('money.net')}
          {degradeLevel < 1 && (<>
          {' · '}
          {/* DC-21 moneyOrigin: цепочка драйверов + округление + runRef.
              Regionalfaktor в Herkunft — «deaktiviert» (правило 40). */}
          <OriginPopover
            rows={[
              ...clientSafeDrivers.map((d) => ({
                label: translatedDriverLabel(d, t),
                value: moneyOut(present(d.exact), lang),
              })),
              ...(!s.regionalfaktorActive
                ? [{
                    label: t('driver.regionalFactor'),
                    value: t('panel.regionalFactorDeactivated'),
                    muted: true,
                  }]
                : []),
              {
                label: t('origin.exactValue'),
                value: `${localizeMoneyText(formatDE(p.result.total.exact, 2), lang)}${NNBSP}€`,
                strong: true,
              },
            ]}
            rounding={p.result.total.disclosure}
            runRef={s.mode === 'intern'
              ? 'Regelsatz RS-2026.2 · DEMO-SC-01 · DEMO-RUN-0007 · authoritative · 04.08.2026'
              : null}
            // Task 04 (F-35, rail a11y): 3 Hero-Trigger tragen alle den
            // sichtbaren Text „Herkunft anzeigen" — eigenes Accessible Name
            // pro Metrik, damit sie in einer Screenreader-Buttonliste
            // unterscheidbar bleiben.
            accessibleName={`${t('common.showOrigin')} · ${tx(p.result.totalLabel)}`}
          />
          </>)}
        </p>}
        </div>

        {/* ── Герои №2 и №3: ведущая ставка и срок, чёрные (DC-38) ─────── */}
        {/* Структура системы: ЧИСЛО в `.a3-hb-num`, единица в `.a3-hb-unit`,
            знаменатель в `.a3-hb-cap`. Прежде сюда клалась вся строка
            `≈ 2.545 €/m² WFL nach WoFlV` целиком — а `.a3-hb-num` несёт
            `white-space: nowrap`, и в флекс-строке минимальная ширина
            элемента равна min-content. Панель раздувалась далеко за свои
            400 px и съедала рабочую область. Дефект структурный: класс
            применён не к тому, для чего объявлен. */}
        {!priceUnavailable && <div className="a3-hb">
          {/* SB-29: Leitkennzahl becomes its own heading-reachable group —
              visually hidden (`.a3-visually-hidden`, this file's own KG-
              table-caption convention): the sighted hero is unchanged (it
              never had a caption above the rate before), only heading-list
              navigation gains a new anchor. Placed INSIDE the pinned
              `.a3-rail-header-budget` (unlike the rail-root heading above,
              which sits outside it) — a visible line here would compete
              with the degrade ladder's already fully-committed budget
              (SIDEBAR 01/02 authority, not reopened). */}
          <h3 id={leadRateHeadingId} className="a3-visually-hidden">
            {t('offerPanel.heading.leadRate')}
          </h3>
          <p className="a3-hb-num numeric" aria-labelledby={leadRateHeadingId}>
            {p.leadRate.prefix && (
              <span aria-hidden="true">{p.leadRate.prefix}{NNBSP}</span>
            )}
            {localizeMoneyText(p.leadRate.display, lang)}
            <span className="a3-hb-unit">{NNBSP}€/m²</span>
          </p>
          <span className="a3-hb-cap">{tx(p.leadRate.denominatorLabel)}</span>
        {/* SIDEBAR 01 degrade step 3: the secondary-rate/per-unit context
            line is "MAKE CONTEXTUAL" in the ticket's own KEEP/CONTEXTUAL
            split (not "KEEP ALWAYS VISIBLE"), so it is the last thing to
            give way before Bauzeit+Fertigstellung would otherwise clip. */}
        {degradeLevel < 3 && <p className="a3-cap numeric mt-1" style={{ overflowWrap: 'anywhere' }}>
          {/* SIDEBAR 01 (backlog eda1e221, SB-04): the secondary BGF rate is
              the same quantity as the lead rate whenever the scope is a
              complex (leadRate falls back to `rate(total, bgf,
              'BGF_ABOVE_GROUND')` — store.ts computeProjection — the exact
              same call as `secondaryRateBgf`); rendering it a second time
              here is the literal duplicate the audit found. It renders
              only when it names a different denominator. */}
          {p.secondaryRateBgf.denominatorType !== p.leadRate.denominatorType && (
            <>{rateOut(p.secondaryRateBgf, lang)}{' · '}</>
          )}
          {p.perUnit && <>{rateOut(p.perUnit, lang)}{' · '}</>}
          {degradeLevel < 1 && (
          /* DC-21 rateOrigin: знаменатель называет норматив, деление показано. */
          <OriginPopover
            rows={[
              {
                label: t('panel.exactTotalNumerator'),
                value: `${localizeMoneyText(formatDE(p.leadRate.numerator, 0), lang)}${NNBSP}€`,
              },
              {
                label: t('origin.denominator', { denominator: p.leadRate.denominatorLabel }),
                value: `${localizeMoneyText(formatDE(p.leadRate.denominator, 2), lang)}${NNBSP}m²`,
              },
              {
                label: t('origin.exactQuotient'),
                value: `${localizeMoneyText(formatDE(p.leadRate.exact, 2), lang)}${NNBSP}€/m²`,
                strong: true,
              },
            ]}
            rounding={p.leadRate.disclosure}
            runRef={s.mode === 'intern'
              ? 'Regelsatz RS-2026.2 · DEMO-SC-01 · DEMO-RUN-0007 · authoritative · 04.08.2026'
              : null}
            accessibleName={`${t('common.showOrigin')} · ${tx(p.leadRate.denominatorLabel)}`}
          />
          )}
        </p>}
        </div>}

        <div className="a3-hb">
          {/* SB-29: Bauzeit becomes its own heading-reachable group —
              visually hidden, same reasoning as the Leitkennzahl heading
              above: this hero never had a caption above the number before
              ("ab OKBP · Fertigstellung …" already names it below), and
              this line sits inside the pinned budget where a new visible
              line would compete with the degrade ladder. */}
          <h3 id={durationHeadingId} className="a3-visually-hidden">
            {t('offerPanel.heading.duration')}
          </h3>
          <p className="a3-hb-num numeric" aria-labelledby={durationHeadingId}>
            {p.duration.prefix && <span aria-hidden="true">{p.duration.prefix}{NNBSP}</span>}
            {localizeMoneyText(p.duration.display.replace(`${NNBSP}Monate`, ''), lang)}
            <span className="a3-hb-unit">{NNBSP}{t('offerPanel.duration.unit')}</span>
          </p>
          <span className="a3-hb-cap">
            {/* SB-33: `OKBP` is a protected glossary term (LOCALE-009) and
                stays literal in every locale — `schedule.completionFromOkbp`
                (Codex delivery) already translates only the words around
                it; its plain-language gloss ("Oberkante Bodenplatte") moves
                into the popover right below rather than inlining on this
                budget-constrained hero (SIDEBAR 01 authority, not reopened
                here). */}
            {t('schedule.completionFromOkbp', { date: formatDate(p.duration.completionDate, lang) })}
            {degradeLevel < 1 && (<>
            {' · '}
            {/* DC-21 durationOrigin: срок — такая же расчётная величина, как
                деньги, и обязан объяснять себя. Вариант поповера называет
                основание длительности и соглашение о границах интервала —
                «дни» и «рабочие дни» это разные числа. */}
            <OriginPopover
              rows={[
                { label: t('panel.exactModelValue'), value: p.duration.exactMonths
                    ? `${localizeMoneyText(formatDE(p.duration.exactMonths, 4), lang)}${NNBSP}${t('offerPanel.duration.unit')}`
                    : '—' },
                { label: t('panel.displayPolicy'), value: p.duration.policy === 'halfMonthRounded'
                    ? t('panel.roundedHalfMonths') : t('panel.wholeCalendarMonths') },
                { label: t('panel.durationBasis'), value: t('panel.calendarDays') },
                { label: 'OKBP', value: t('offerPanel.duration.okbpGloss') },
                { label: t('s4.row.completion'), value: formatDate(p.duration.completionDate, lang), strong: true },
              ]}
              rounding={p.duration.prefix
                ? t('offerPanel.duration.roundingDisclosure', {
                    value: `${p.duration.exactMonths
                      ? localizeMoneyText(formatDE(p.duration.exactMonths, 4), lang) : '—'}`
                      + `${NNBSP}${t('offerPanel.duration.unit')}`,
                  })
                : null}
              runRef={s.mode === 'intern' ? t('panel.scheduleMethodRun') : null}
              accessibleName={`${t('common.showOrigin')} · ${t('offerPanel.heading.duration')}`}
            />
            </>)}
          </span>
        </div>
        </>)}
        </div>
        </div>

        {/* Раньше здесь стояла отдельная строка `DEMO-SC-01 · DEMO-RUN-0007`
            (F05): фикстурный run-id в самой коммерчески заметной зоне
            экрана, дублирующий то, что уже доступно через `Herkunft
            anzeigen` (DC-21 `OriginPopover` выше). Убрано целиком —
            стоящий слой не место для внутренней трассировки прогона, даже
            в режиме Vorbereitung; кто ищет происхождение числа, находит
            его в поповере. */}

        {/* SIDEBAR 01 (backlog eda1e221, SB-02): the ghost and delta slots
            below no longer live inside `.a3-rail-header-budget` — they
            share this zero-height anchor, positioned after it inside the
            same sticky wrapper, and overlay Level 2's top edge only while
            showing (rule 24: appearance must not shift Level 1's own box
            height — AC-4 verifies this via before/after
            `getBoundingClientRect`). Ghost (pre-commit hover, intern-only)
            and delta (post-commit, 8 s) are mutually exclusive in time
            (DC-28 clears the preview at commit), so sharing one anchor is
            safe; each keeps its own distinct border/motion identity. */}
        <div className="a3-change-slot-anchor">
        {/* ── Слот призрака (DC-28) — СОБСТВЕННЫЙ, не общий с дельта-чипом.
            Анатомия контракта: префикс «Vorschau ·», будущее значение,
            дельта к названной базе, ссылка на прогон превью. Высота
            зарезервирована: появление призрака не двигает вёрстку.
            Task 04 (F-03, P0): весь слот — intern-only, не только
            Δ-подстрока. Прежде гейтилась лишь строка Δ (строка 394 ниже);
            заголовок и будущее значение призрака рендерились и в
            `mode-praesentation`, поэтому гипотетическая цена оказывалась
            рядом с настоящей в начатом Kundenansicht. `s.preview` может
            остаться установленным после переключения режима (само
            состояние не сбрасывается сменой режима) — гейт на рендере,
            а не только на сеттере, поэтому клиентский вид не зависит от
            того, что произошло до переключения. */}
        {/* Призрак — тот же приём, что у чипа: элемент постоянен, появление
            и уход несёт `.a3-show` контракта, а не framer-motion. Утилита
            паддинга снята: вид принадлежит системе (NO-VISUAL-UTILITY).
            SIDEBAR 03 (SB-30): the DC-28 preview cluster's old class names
            (bare "ghost", "ghost" + "-slot", "ghost" + "-line") are renamed
            to `.a3-preview`/`.a3-preview-slot`/`.a3-preview-line` — the old
            bare class collided with the `.a3-btn.a3-ghost` tertiary button
            variant (`document.querySelectorAll('.a3-ghost')` returned
            both). Canonical source: components.css. */}
        {s.mode === 'intern' && <div className="a3-preview-slot">
          <p className={'a3-preview numeric' + (s.preview ? ' a3-show' : '')}
             aria-hidden={s.preview ? undefined : true}>
            {shownPreview && (<>
              {/* Три смысловые строки призрака — `.a3-preview-line`
                  контракта: слот резервирует высоту самого высокого
                  состояния (решение TASK-22, вариант 2), и строки обязаны
                  быть объявлены, а не получаться из утилит. */}
              <span className="a3-preview-line">
                {tx('Vorschau')} · {translatedChangeLabel(shownPreview.change, t)}
              </span>
              <span className="a3-preview-line">
                {shownPreview.futureTotal.prefix && (
                  <span aria-hidden="true">{shownPreview.futureTotal.prefix}{NNBSP}</span>
                )}
                {localizeMoneyText(shownPreview.futureTotal.display, lang)}{NNBSP}€
                {/* Δ bleibt intern-only (Regel 11: Δ-Werte im
                    Präsentationsmodus ausgeblendet). F05: früher
                    `gegenüber DEMO-VV-0003` — ein fixer Fixture-Bezeichner
                    ohne echten Bezug zur angezeigten Option; die Differenz
                    zum aktuellen Stand ist ohne ihn genauso verständlich. */}
                {s.mode === 'intern' && <>
                  {' · '}
                  {signedOut(shownPreview.deltaExact, lang)}{NNBSP}{t('offerPanel.preview.vsCurrent')}
                </>}
              </span>
              {/* Неполнота будущего прогона называется, а не подразумевается. */}
              {shownPreview.futureLabel !== 'Gesamt netto · Grundleistung All3' && (
                <span className="a3-preview-line">
                  {tx('Vorschau')} · {tx(shownPreview.futureLabel)}
                </span>
              )}
            </>)}
          </p>
        </div>}

        {/* ── Слот дельта-чипа: зарезервирован, появление не двигает ────── */}
        {/* Чип живёт в слоте постоянно и ОДНОЙ строкой (`.a3-delta` —
            inline-flex витрины): двухстрочный распирал зарезервированную
            высоту слота и сдвигал вёрстку на 27 px — ровно то, против чего
            слот и существует (правило 24, приёмка № 17). */}
        {s.mode === 'intern' && <div className="a3-delta-slot">
          <p
            aria-hidden={s.activeDelta ? undefined : true}
            className={'a3-delta numeric' +
              (s.activeDelta ? ' a3-show' : '') +
              /* Ровно один класс направления (контракт DC-2). */
              (shownDelta?.deltaExact.isNegative() ? ' a3-saving' : ' a3-cost')}
          >
            {shownDelta && (<>
              <span>
                {shownDelta.change ? translatedChangeLabel(shownDelta.change, t) : shownDelta.label}
              </span>
              <span className="font-medium">
                {signedOut(shownDelta.deltaExact, lang)}
                {/* SB-26/AC-11: named only when the total movement actually
                    differs from a single row's own contribution (a cascade
                    happened) — say nothing extra otherwise (progressive
                    disclosure, rule 9: one way to emphasise a fragment). */}
                {shownCascade?.cascade && <> {t('offer.delta.totalQualifier')}</>}
                {/* Δ-проценты — только внутренние (правило 11). Task 04
                    (F-30): процент от нулевой базы не определён — вместо
                    ложного «(+ 0,00 %)» рядом с реальной ненулевой дельтой
                    строка процента просто отсутствует (rule 30). */}
                {s.mode === 'intern' && shownDelta.percent !== null
                  && <> ({signedPercent(shownDelta.percent, lang)})</>}
              </span>
            </>)}
          </p>
        </div>}
        </div>
      </div>

      {/* SIDEBAR 01 (backlog eda1e221, SB-20): Variantenvergleich, Export
          and Einstellungen render Level 1 only — a compact orientation
          strip, no cost-composition breakdown on a read-only view — inside
          the same clamp()-bounded rail width as the Configurator. The
          mode-change screen (SB-27) composes this same `variant="level1"`
          alongside its own notice rather than substituting for it (see
          `ConfigurationModeReadiness` in S3Konfigurator.tsx). */}
      {variant === 'full' && (<>
      {/* Task 04 (F-13): der Rest der Rail — Recap/Kostentreiber/KG-Tabelle
          — bleibt der normal scrollende Bereich UNTER dem sticky Block
          oben; eigenes horizontales Padding, da es nicht mehr im selben
          Container wie der Header steckt. */}
      <div className="flex-1 px-5 pb-5">
        {/* SIDEBAR 02 (backlog 41b8ab39, SB-10/AC-1, AC-3): the offer-total
            secondary line and the completeness line live HERE, immediately
            below the pinned header — not inside `.a3-rail-header-budget` —
            deliberately. That budget is a hard, already fully-committed
            ceiling (SIDEBAR 01, `--size-rail-header-budget`, "fit the
            budget, never raise it"): measured live, a real two-building
            fixture with a full DIN-276 scope leaves the pinned header's
            three degrade steps with zero spare capacity even before this
            task's own always-visible scope tag. Placing this content as
            the FIRST thing in the rail's normal (non-clipped) scroll flow
            keeps it genuinely "visible on screen" without scrolling (the
            scrollable region starts immediately below the sticky header,
            well inside the rail's own client height) without silently
            reopening SIDEBAR 01's budget contract to make room for it. */}
        {!scopeEmpty && !priceUnavailable && wholeOfferTotal && (
          <p className="a3-cap numeric">
            {t('offerPanel.scope.offerTotalLabel')}
            {': '}
            {wholeOfferTotal.prefix && (
              <span aria-hidden="true">{wholeOfferTotal.prefix}{NNBSP}</span>
            )}
            {wholeOfferTotal.display}{NNBSP}€
          </p>
        )}
        {!scopeEmpty && !priceUnavailable && (
          <p className={'a3-cap' + (wholeOfferTotal ? ' mt-1' : '')}>
            {t('offerPanel.completeness.line', {
              decided: decidedGroups,
              total: SCOPE_BOUNDARIES_DECIDABLE_GROUPS.length,
              priced: pricedGroups,
              unpriced: unpricedGroups.size,
            })}
          </p>
        )}
        {/* ── Level 2 · Kostenzusammensetzung (SIDEBAR 01, backlog eda1e221,
            SB-03) — ONE merged DIN-276-keyed list, expanded by default (no
            outer toggle). It replaces the two lists that used to duplicate
            each other 11/15 rows apart (the "Im Angebot gewählt" recap and
            the Kostentreiber driver table, audit finding 4): each group row
            now expands to its own contributing decisions as children —
            that IS the former recap, merged into its group instead of
            repeated separately. Group amounts/labels themselves are
            unchanged (SIDEBAR 02 owns the KG-content defects SB-05/SB-06);
            only the container merges.
            Uses the table's OWN canonical disclosure primitives
            (`.a3-expand`/`.a3-twistbtn`/`.a3-open`/`.a3-kg-child`, DC-5,
            already the KG 300 subgroup's mechanism below) rather than the
            design system's generic `DisclosureRow`: that component always
            wraps `cells` in its own unstyled `<td>` and cannot carry this
            table's `.a3-num` right-align/tabular-numeral class on the cell
            itself — using it here would misalign every numeric column.
            CANONICAL DESIGN SYSTEM GAP (not fixed by this task, SIDEBAR 03
            owns the rail's canonical contract): `DisclosureRow` has no way
            to style its own cells. */}
        {/* SB-29: the section's own `aria-label` is replaced by a real
            heading (`aria-labelledby`) — the visible caption already below
            becomes that heading, no new copy, no visual change. */}
        <section aria-labelledby={compositionHeadingId} className="mt-4">
          <h3 id={compositionHeadingId} className="a3-mtag">{t('offer.costGroups.regionHeading')}</h3>
          {/* SIDEBAR 02 (backlog 41b8ab39, SB-07): an empty Declared
              Pricing Scope tells the SAME story here as Level 1's own
              `DataStateBlock` above (rule 16/30 `empty`) — reusing the
              identical sentence, not a second wording — instead of still
              rendering a priced KG table, a `0 €` total row and a recap of
              contributions that do not belong to any scope currently in
              the offer. */}
          {scopeEmpty ? (
            <p className="a3-cap mt-1">{t('offerPanel.empty.sentence')}</p>
          ) : (<>
          <div className="a3-tbl-scroll mt-1">
            <table className="a3-kg w-full border-collapse">
              <caption className="a3-visually-hidden">{tx('Kostengruppen nach DIN 276, vereinfachte Verteilung')}</caption>
              <tbody>
                {kgRows.map(([g, v]) => {
                    const group = g as CostGroup
                    const rowLabel = <>{g.replace('_', NNBSP)} {t(`costGroup.${group}`)}</>
                    const children = [...groupChildrenFor(group), ...groupExcludedFor(group)]
                    const isOpen = !!openGroups[g]
                    const childrenId = `kg-children-${g}`
                    // SB-06/AC-4: an included group with no price basis
                    // (typically KG 500) never prints a bare `0 €`/`0 %` —
                    // same row-level swap the whole-panel `priceUnavailable`
                    // guard already uses for oberirdisch/unterirdisch/total.
                    const rowUnpriced = unpricedGroups.has(group)
                    // SB-25/AC-10: non-colour-only transient marker on every
                    // Level 2 row whose amount changed after the last
                    // decision, including rows changed only by cascade.
                    const rowChanged = changedKeys.has(g)
                    return (
                      <Fragment key={g}>
                        <tr className={children.length > 0 ? 'a3-expand' + (isOpen ? ' a3-open' : '') : ''}>
                          <td>
                            {children.length > 0 ? (
                              <button type="button" className="a3-twistbtn"
                                      aria-expanded={isOpen}
                                      aria-controls={childrenId}
                                      onClick={() => setOpenGroups((prev) => ({ ...prev, [g]: !prev[g] }))}>
                                {rowLabel}
                              </button>
                            ) : rowLabel}
                            {rowChanged && (
                              <span className="a3-tag a3-blue ml-2">
                                {t('offer.drivers.changedMarker')}
                              </span>
                            )}
                          </td>
                          <td className="a3-num">
                            {rowUnpriced ? t('money.priceNotDetermined') : moneyOut(present(v), lang)}
                          </td>
                          <td className="a3-num">
                            {rowUnpriced ? '' : percentOut(v.div(p.result.total.exact).mul(100), 0, lang)}
                          </td>
                        </tr>
                        {children.length > 0 && isOpen && (
                          <tr className="a3-kg-child">
                            <td id={childrenId} colSpan={3}>
              <ul>
                                {/* SB-13 (see `clientSafeContributionRows` above): aggregated in
                                    Kundenansicht only, once R-25 has stripped the building suffix
                                    that would otherwise disambiguate two same-label siblings. */}
                                {clientSafeContributionRows(children, (d) => {
                                  const isExcluded = d.key === 'kg300_excluded_adjustment'
                                    || d.key === 'kg400_excluded_adjustment'
                                  return (isExcluded ? `${t('offer.drivers.excludedHeading')} · ` : '')
                                    + translatedDriverLabel(d, t)
                                }, s).map((row) => (
                                  <li key={row.key}
                                      className="flex justify-between gap-2 border-b border-border-subtle py-1 text-small">
                                    <span className="text-text-secondary">
                                      {row.label}
                                      {row.buildingLabel && <span className="block text-text-secondary">· {row.buildingLabel}</span>}
                                    </span>
                                    <span className="numeric shrink-0 text-text-primary">
                                      {signedOut(row.exact, lang)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                {/* SIDEBAR 02 (backlog 41b8ab39, SB-05): the former
                    `oberirdisch`/`unterirdisch` pair is REMOVED here.
                    `p.aboveGround` is scope-invariant while `p.belowGround
                    = total − aboveGround` is a residual, not a decidable
                    DIN 276 cost group — a residual computed this way goes
                    negative under a physical label whenever `total <
                    aboveGround` (any partial/empty/small scope), and it
                    cannot be made non-negative for arbitrary scope without
                    a calculation-semantics change (`src/engine/**`, out of
                    scope for this task). Assumption to confirm with
                    Product/QA (not verified either way here): that the
                    rail does not need this above/below-ground split for
                    sales conversations — flagged as a known non-blocking
                    risk in the handoff, not silently decided. */}
                {/* Task 04 (F-12 companion, rule 32): siehe Kommentar bei
                    `riskSurchargeSum` oben — eigene Zeile statt Einfaltung
                    in KG 300. */}
                {!riskSurchargeSum.isZero() && (
                  <tr>
                    <td>{t('offerPanel.riskSurcharges.label')}</td>
                    <td className="a3-num">{moneyOut(present(riskSurchargeSum), lang)}</td>
                    <td className="a3-num">
                      {percentOut(riskSurchargeSum.div(p.result.total.exact).mul(100), 0, lang)}
                    </td>
                  </tr>
                )}
                {/* Task 04 (F-12 companion, rule 32): Rabatt ist keine
                    DIN-276-Gruppe, aber ein realer, im Total bereits
                    enthaltener Abzug — ohne eigene Zeile summierten die
                    KG-Zeilen auf `beforeDiscount`, nicht auf den
                    gedruckten `total`. Eigene Prozentspalte (kein
                    `colSpan`, anders als oberirdisch/unterirdisch oben,
                    die dieselbe Summe nur re-gliedern): nur so bleibt die
                    100-%-Summe der Spalte exakt. */}
                {p.discountDriver && (
                  <tr>
                    <td>{translatedDriverLabel(p.discountDriver, t)}</td>
                    {/* SB-23: one signed-money formatter everywhere — this
                        used to compose the sign BEFORE `moneyLabel()`'s own
                        `≈` prefix (`− ≈ 910.000 €`), the exact inverted
                        order the normative formatter below forbids.
                        `signed()` is already correct and already used
                        for the recap/KG-children rows a few lines above. */}
                    <td className="a3-num">
                      {signedOut(p.discountDriver.exact, lang)}
                    </td>
                    <td className="a3-num">
                      −{NNBSP}
                      {percentOut(p.discountDriver.exact.abs().div(p.result.total.exact).mul(100), 0, lang)}
                    </td>
                  </tr>
                )}
                {/* TotalRow name = hero name (SIDEBAR 01 target IA §8):
                    unchanged, both already read `p.result.totalLabel`. */}
                <tr className="a3-total">
                  <td>{tx(p.result.totalLabel)}</td>
                  <td className="a3-num" colSpan={2}>
                    {priceUnavailable ? t('money.priceNotDetermined') : moneyOut(p.result.total, lang)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* SB-32/AC-12: extended to also name the % column's own
              independent rounding (real dictionary key, same reason
              `driver.kg300Unresolved` etc. moved off `tx()`'s reverse
              lookup — this exact longer sentence has no Codex delivery).
              SB-18: `--color-text-muted` (#8C8C8C, 3,36:1 on white at this
              14px size — the rail's only AA contrast failure, measured
              across all 52 leaf nodes) swapped for `--color-text-secondary`
              (#6B6B6B, 5,47:1 — already passes) at this one instance;
              `components-core.md` now documents the token's minimum
              compliant size canonically (SB-21) so the class of defect
              doesn't recur silently elsewhere. */}
          <p className="mt-2 text-small text-text-secondary">{t('offer.kgTable.roundingNote')}</p>
          {/* SIDEBAR 01 (backlog eda1e221, SB-03/F-11): a decision or
              excluded-adjustment whose target group's row does not
              currently render (e.g. the group itself was excluded from
              coverage) still needs a visible home — the former standalone
              recap's exact fallback shape, kept reachable rather than
              silently dropped when no group disclosure claims it. */}
          {(looseChosen.length > 0 || looseExcluded.length > 0) && (
            <section aria-label="Im Angebot gewählt" className="a3-recap mt-4">
              {looseChosen.length > 0 && (
                <>
                  <p className="a3-mtag">{tx('Im Angebot gewählt')}</p>
                  <ul>
                    {/* SB-13: same aggregation as the Level 2 children list above. */}
                    {clientSafeContributionRows(looseChosen, (d) => translatedDriverLabel(d, t), s).map((row) => (
                      <li key={row.key}
                          className="flex justify-between gap-2 border-b border-border-subtle py-1 text-small">
                        <span className="text-text-secondary">
                          {row.label}
                          {row.buildingLabel && <span className="block text-text-secondary">· {row.buildingLabel}</span>}
                        </span>
                        <span className="numeric shrink-0 text-text-primary">{signedOut(row.exact, lang)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {looseExcluded.length > 0 && (
                <div className={looseChosen.length > 0 ? 'mt-3 border-t border-border-subtle pt-2' : ''}>
                  <p className="a3-mtag">{t('offer.drivers.excludedHeading')}</p>
                  <ul>
                    {clientSafeContributionRows(looseExcluded, (d) => translatedDriverLabel(d, t), s).map((row) => (
                      <li key={row.key}
                          className="flex justify-between gap-2 border-b border-border-subtle py-1 text-small">
                        <span className="text-text-secondary">{row.label}</span>
                        <span className="numeric shrink-0 text-text-primary">{signedOut(row.exact, lang)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
          </>)}
        </section>

        {/* ── Level 3 · Nachweise & Verlauf (SIDEBAR 01) — collapsed by
            default, reached deliberately: Kostentreiber's driver-bar detail
            + benchmark (DC-44), the KG 300 Untergruppen breakdown (moved out
            of the Level-2 row itself — target IA report §8), and the
            session journal (no inner scroll any more, AC-7). `<aside>` is
            the rail's only scroll owner (SB-19); this content simply keeps
            flowing in the rail's own scroll. */}
        <section aria-label="Nachweise & Verlauf" className="mt-5 border-t border-border-subtle pt-4">
          {/* SB-29: demoted from `h2` to `h3` — it now sits one level under
              the new rail-root `h2` ("Angebot") instead of being the rail's
              only heading. No visual change (same classes). */}
          <h3 className="text-small font-bold text-text-primary">
            <button
              type="button"
              aria-expanded={level3Open}
              onClick={() => setLevel3Open((v) => !v)}
              className="a3-journal-disclose outline-none before:absolute before:left-1/2 before:top-1/2 before:min-h-hit-target before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <span aria-hidden="true">{level3Open ? '▾ ' : '▸ '}</span>
              {tx('Nachweise & Verlauf')}
            </button>
          </h3>
          {/* SB-07: the driver list is the same "priced contributions
              exist" story as the KG table above — empty scope replaces it
              with the identical empty sentence rather than "10 Beiträge ·
              Summe = 0 €" next to a real, non-zero list of contributions
              that net out to zero only because every one of them is
              excluded. Only the driver-detail content (benchmark, driver
              table, KG 300 subgroups) is replaced — the "Nicht enthalten"
              notice and the session journal further down stay reachable
              regardless of scope, they are not part of this story. */}
          {!level3Open && (
            <p className="a3-cap numeric mt-1">
              {scopeEmpty ? t('offerPanel.empty.sentence') : (<>
                {clientSafeDrivers.length}{NNBSP}{t('remainder5.offer.contributionsSum')}{NNBSP}
                {priceUnavailable ? t('money.priceNotDetermined') : moneyOut(p.result.total, lang)}
              </>)}
            </p>
          )}
          {level3Open && (<div className="a3-drivers mt-2">
          {scopeEmpty ? (
            <p className="a3-cap">{t('offerPanel.empty.sentence')}</p>
          ) : (<>
          {/* SIDEBAR 03 (backlog 2be8e69c, SB-12): the mandatory Kostentreiber
              benchmark (rule 35) used to print a permanent apology plus the
              internal snapshot id `BM-BKI-2026Q1-SYNTH` in every mode — no
              calibrated BKI median exists in any fixture/catalog source
              (confirmed by source search across `src/fixtures/**` and
              `src/state/catalog.ts`), so making the comparison "truthful"
              would require inventing a number (forbidden: calculationSensitive
              =false, rule 16). T04-AC4's own accepted resolution was
              "truthful or gone" — with no real median to compare against,
              "gone" is the only compliant choice; removed entirely, both
              modes, closing the AC that `76f0bd46` left unmet on release. */}
          <div className="a3-tbl-scroll mt-2">
            <table className="a3-driver-table">
              <caption className="sr-only">
                {t('offer.drivers.reconciliationCaption', { label: tx(p.result.totalLabel) })}
              </caption>
              <tbody>
                {(() => {
                  // Бар относителен наибольшему вкладу ПО МОДУЛЮ: экономящий
                  // драйвер такой же полноправный, как удорожающий (DRIVER-004).
                  const max = clientSafeDrivers.reduce(
                    (m, d) => (d.exact.abs().gt(m) ? d.exact.abs() : m),
                    clientSafeDrivers[0]!.exact.abs(),
                  )
                  return clientSafeDrivers.map((d) => {
                    const senkt = d.exact.isNegative()
                    const richtung = t(senkt ? 'panel.decreased' : 'panel.increased')
                    const shown = present(d.exact.abs())
                    const scopeLabel = d.scopeRefs.length > 0
                      ? d.scopeRefs.join(`${NNBSP}· `)
                      : t('panel.allocationUnresolved')
                    // Task 02 (F-01): same building-attribution rule as the
                    // Level 2 group children above — intern-mode only,
                    // never part of `scopeLabel`/`d.scopeRefs` (R-25 stays
                    // exactly as-is for Kundenansicht).
                    const buildingLabel = driverBuildingLabel(s, d.key)
                    return (
                      <tr key={d.key} {...(s.mode === 'intern' ? { 'data-driver-id': d.key } : {})}
                          className={'a3-drv'
                            + (d.origin === 'base' ? ' a3-base' : '')
                            + (senkt ? ' a3-minus' : '')}>
                        <th scope="row" className="py-2 pr-3 text-left font-regular text-text-secondary">
                          {/* Доступное имя строки называет направление словом,
                              округление и точное значение (DRIVER-004). */}
                          <span className="sr-only">
                            {driverLabel(d, d.basis, t, lang)}
                            {buildingLabel ? `, ${buildingLabel}` : ''}, {richtung},
                            rund {localizeMoneyText(shown.display, lang)} Euro, exakt {localizeMoneyText(formatDE(d.exact.abs(), 2), lang)} Euro
                          </span>
                          <span aria-hidden="true">{driverLabel(d, d.basis, t, lang)}</span>
                          <span aria-hidden="true" className="a3-driver-direction">
                            {richtung}
                            {' · '}
                            {scopeLabel}
                            {buildingLabel && <>{' · '}{buildingLabel}</>}
                          </span>
                        </th>
                        <td className="a3-bar-cell" aria-hidden="true">
                          <div
                            className="a3-bar"
                            style={{ width: `${shown.exact.div(max).mul(100).toNumber()}%` }}
                          />
                        </td>
                        <td className="a3-val">
                          {/* SB-23: same fix as the discount row above —
                              this used to compose the sign BEFORE
                              `moneyLabel()`'s own `≈` prefix
                              (`−≈ 1.386.000 €`), reusing `signed()`
                              (already the file's one normative formatter)
                              instead of a second, inverted-order
                              composition. */}
                          <span aria-hidden="true">
                            {signedOut(d.exact, lang)}
                          </span>
                          {/* Раскрытие строки — переход к DC-21, а не своё
                              состояние. Настоящая кнопка: невидимый клик по
                              строке как единственная affordance запрещён
                              (DRIVER-006). */}
                          <span className="mt-1 block font-regular">
                            <OriginPopover
                              triggerLabel="Details"
                              rows={[
                                ...basisRows(d.basis, t, lang),
                                {
                                  label: t('panel.scopeLabel', { scope: scopeLabel }),
                                  value: richtung,
                                  muted: d.scopeRefs.length === 0,
                                },
                                {
                                  label: t('panel.exactContribution'),
                                  value: `${senkt ? '−' : '+'}${NNBSP}${localizeMoneyText(formatDE(d.exact.abs(), 2), lang)}${NNBSP}€`,
                                  strong: true,
                                },
                              ]}
                              rounding={shown.disclosure}
                              runRef={s.mode === 'intern' ? `Beitrags-ID ${d.key}` : null}
                              // Task 04 (F-35, rail a11y): 12+ Zeilen teilten
                              // sich vorher den sichtbaren Text „Details" als
                              // einziges Accessible Name — nicht
                              // unterscheidbar in einer Screenreader-
                              // Buttonliste. Derselbe Text, der schon die
                              // sr-only-Zeile der Zeile selbst benennt
                              // (oben), macht auch diesen Trigger eindeutig.
                              accessibleName={`Details · ${driverLabel(d, d.basis, t, lang)}`
                                + (buildingLabel ? `, ${buildingLabel}` : '')}
                            />
                          </span>
                        </td>
                      </tr>
                    )
                  })
                })()}
                {/* Неактивный фактор — строкой (DRIVER-002, CALC-009, D-15):
                    формулировка называет базу применения. 0 € без статуса
                    запрещён; величина из каталога, не из константы экрана. */}
                {/* SB-14 (localization only — AC-4/PD-2 unchanged: this row's
                    VISIBILITY in Kundenansicht is exactly as before, only its
                    text now goes through `t()`). */}
                {!s.regionalfaktorActive && (
                  <tr className="a3-drv a3-inactive">
                    <td colSpan={3}>
                      {t('offer.drivers.regionalInactive', {
                        amount: priceUnavailable
                          ? t('money.priceNotDetermined')
                          : moneyOut(present(
                            p.result.bauwerk.mul(CATALOG.regionalFactor.value.minus(1)),
                          ), lang),
                      })}
                    </td>
                  </tr>
                )}
                <tr className="a3-drv a3-sum">
                  <th scope="row" className="text-left">
                    {tx(p.result.totalLabel)}
                  </th>
                  <td aria-hidden="true" />
                  <td className="a3-val">
                    {priceUnavailable ? t('money.priceNotDetermined') : moneyOut(p.result.total, lang)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* KG 300 Untergruppen — moved here from the Level-2 row itself
              (target IA report §8): the row's own disclosure now carries
              its DIN-276 decisions (Level 2 merge, SB-03), so the
              percentage-derived risk-basis subgroups get their own nested
              twist in Level 3 instead of competing for the same toggle. */}
          {p.kgSplit.KG_300 && (
            <div className="mt-4">
              <button type="button" className="a3-twistbtn"
                      aria-expanded={kg300Open}
                      onClick={() => setKg300Open((v2) => !v2)}>
                <span aria-hidden="true">{kg300Open ? '▾' : '▸'}</span>
                {' '}{tx('KG 300 Untergruppen')}
              </button>
              {kg300Open && (
                <div className="a3-tbl-scroll mt-2">
                  <table className="a3-kg w-full border-collapse">
                    <caption className="a3-visually-hidden">{tx('KG 300 Untergruppen, Risikobasis')}</caption>
                    <tbody>
                      {splitKg300(p.kgSplit.KG_300).map((sub) => (
                        <tr key={sub.id} className="a3-kg-child a3-muted">
                          <td>{sub.id.replace('_', NNBSP)} {sub.label} {MARK}</td>
                          <td className="a3-num">{moneyOut(present(sub.exact), lang)}</td>
                          <td className="a3-num" />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {/* SIDEBAR 03 (backlog 2be8e69c, SB-15): one shared legend for
              EVERY `⚙` occurrence in the rail (this KG 300 subgroup column
              above, the composition/driver rows wherever `derivedFx.marker`
              appears) — D-22 requires the marker itself to travel WITH the
              value, so it is not stripped from the client profile; it is
              disclosed once here rather than repeated per row. Core clause
              only (reused from `derived-prototype.json.provenanceLabel`),
              not the centre pane's longer sentence — that sentence names
              "die Angebotsspalte rechts", self-referential if repeated
              inside the rail itself. */}
          {hasDerivedMarker && (
            <p className="a3-cap mt-2">{MARK} {t('offerPanel.derivedMarker.legend')}</p>
          )}
          </>)}
          {/* "Nicht enthalten / noch offen" stays Level-3 (disclosure-
              reached) content, not part of the always-expanded Level 2 list:
              it used to sit behind the KG table's own collapsed-by-default
              toggle, and moving it into the always-expanded Level 2 would
              have surfaced this DC-7 client notice unconditionally even for
              a fully decided binary scope (deliberately `excluded` groups,
              not merely undecided ones) — a regression the existing test
              suite (scenario.dom.test.tsx) already guards against. */}
          {notIncluded.length > 0 && (
            <ClientNotice clientText={t('offerPanel.notIncluded.clientNotice')}>
              <p className="a3-cap mt-2">
                ▸ {tx('Nicht enthalten / noch offen')}:{' '}
                {notIncluded.map((g) =>
                  `${g.replace('_', NNBSP)}${NNBSP}${t(COVERAGE_SHORT_KEY[s.coverage[g]])}`).join(' · ')}
              </p>
            </ClientNotice>
          )}
          {/* ── Журнал сессии (DC-12): внутренний след, не часть клиентской
              проекции. DC-22 в шапке является единственной точкой входа.
              SIDEBAR 01 (backlog eda1e221, SB-19): journal is Level 3
              content (target IA report §8) reached through the same
              `level3Open` disclosure as the driver detail above it — its
              own `<ol>` no longer carries an inner `max-height`/scroll of
              its own; `<aside>` is the rail's single scroll owner. ── */}
          {s.mode === 'intern' && <div className="mt-4 border-t border-border-subtle pt-4">
            {blocked && <div className="a3-warn-prep mb-3">
              <p className="text-small text-text-primary">
                <span aria-hidden="true">▲ </span>
                {t('offer.gate.blocked')}
              </p>
              <div className="mt-2">
                <Button variant="primary" onClick={() => s.confirmGebaeudeklasse()}>
                  {t('offer.gate.confirmClassification')}
                </Button>
              </div>
            </div>}
            <div className={'a3-journal-spec transition-colors duration-base ' +
              (journalFlash ? 'bg-surface-subtle' : '')}>
              <button
                type="button"
                onClick={() => setJournalOpen((v) => !v)}
                aria-expanded={journalOpen}
                className="a3-journal-disclose outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <span aria-hidden="true">{journalOpen ? '▾ ' : '▸ '}</span>
                {/* SIDEBAR 01 rework (backlog eda1e221, AC-6 regression):
                    `.a3-journal-disclose` is `display:flex;justify-content:
                    space-between` — every OTHER call site (Level 3's own
                    "Nachweise & Verlauf" toggle above, BuildingScope.tsx's
                    journal toggle) passes exactly two flex children (the
                    icon, then one content node), so the content is treated
                    as a single block that wraps normally. This button
                    instead passed the label as several SIBLING JSX
                    expressions (prefix text, the delta span, suffix text) —
                    each becomes its own anonymous flex item, and
                    `space-between` spreads them across one unwrapped row
                    instead of letting the sentence wrap as ordinary text.
                    At the rail's previous fixed 520px width the combined
                    items happened to still fit; at this task's own
                    440-480px clamp() they no longer do (QA: aside.
                    scrollWidth > clientWidth at both 1280 and 1440, journal
                    text visibly clipped mid-word). Wrapping the whole label
                    in one span restores the same two-child contract every
                    other disclosure button already relies on — the
                    sentence now wraps inside its own box like normal text,
                    with no candidate-owned or canonical CSS change. */}
                <span>
                {priceChangeCount === 0
                  ? t('journal.empty')
                  // F05: früher `... Vergleichsbasis DEMO-VV-0003:` — der Fixture-
                  // Bezeichner der Vergleichsbasis stand in der Journal-
                  // Aufklapp-Zeile selbst, nicht nur hinter einer Ablage.
                  // Task 04 (F-30): das unbenannte Wort „Vergleichsbasis" allein
                  // liest sich wie ein Vergleich gegen einen externen Zielwert;
                  // `sessionDelta` ist tatsächlich die Summe der Preis-Journal-
                  // einträge SEIT ERSTELLUNG DIESER OPTION — bei einer frisch
                  // erstellten Option (Startzustand: alle KG ausgeschlossen)
                  // rechnerisch identisch zum leeren Angebot, aber das ist ein
                  // benannter, definierter Bezug, keine unbenannte Lücke.
                  : <>{t('offerPanel.journal.priceChangePrefix')}{' '}
                      <span className="numeric font-medium text-text-primary">
                        {signedOut(sessionDelta, lang)}
                      </span>{' '}{t('money.net')} · {priceChangeCount}{NNBSP}
                      {priceChangeCount === 1
                        ? t('offerPanel.journal.changeSingular')
                        : t('offerPanel.journal.changePlural')}</>}
                </span>
              </button>

              {journalOpen && ctxJournal.length > 0 && (
                <ol className="a3-journal-items">
                  {[...ctxJournal].reverse().map((e) => (
                    <li key={e.seq}>
                      <span className="numeric">{e.seq}</span>
                      <span>{e.label}</span>
                      <span className="numeric">
                        {e.deltaExact ? signedOut(e.deltaExact, lang) : '—'}
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-2">
                <Button onClick={() => s.undo()}
                        disabled={!s.canUndo()}
                        disabledReason={t('journal.undoUnavailable')}>
                  {t('common.undo')}
                </Button>
              </div>
            </div>
          </div>}
          </div>)}
        </section>
      </div>
      </>)}
      {footer}
    </aside>
  )
}

/**
 * Подпись драйвера по DC-44: где вклад — произведение, формула называется
 * прямо в строке (`Basis 2.000,00 m² × 1.545 €/m² BGF oberirdisch`).
 * Количества — из состояния, ставки — из каталога: собственных чисел у
 * подписи нет.
 */
/**
 * Строки происхождения по типу основания вклада (DC-21).
 *
 * Ветка выбирается по `kind`, а не по «заполнено ли поле»: прежняя версия
 * решала по одному `appliedTo` и на вкладах «ставка × количество» печатала
 * количество в квадратных метрах со знаком евро, а следом падала на
 * отсутствующем множителе. Единица берётся из основания, а не назначается
 * здесь.
 */
// SIDEBAR 03 (SB-14): every row label here used to be a hardcoded German
// literal, invisible to `tx()`'s whole-string lookup once composed with a
// live value — `basisRows`/`driverLabel` now take `t`/`lang` explicitly
// (both are module-level, outside the component's hook scope) and route
// every label through the dictionary (most already exist in the Codex
// delivery: `panel.appliedTo`, `panel.factor`, `panel.rate`; `panel.
// quantity` is a local addition for the one composition the delivery
// doesn't cover). `denom` (`DENOMINATOR_LABEL`) stays a literal glossary
// term in every locale (LOCALE-009) — only the label AROUND it translates.
function basisRows(
  basis: DriverBasis | null,
  t: (key: string, values?: Record<string, string | number>) => string,
  lang: UiLanguage,
) {
  if (!basis) return []
  if (basis.kind === 'factor') {
    return [
      { label: t('panel.appliedTo'), value: `${localizeMoneyText(formatDE(basis.appliedTo, 2), lang)}${NNBSP}€` },
      { label: t('panel.factor'), value: localizeMoneyText(formatDE(basis.factor, 2), lang) },
    ]
  }
  const denom = DENOMINATOR_LABEL[basis.denominator]
  return [
    { label: t('panel.quantity', { denominator: denom }), value: `${localizeMoneyText(formatDE(basis.quantity, 2), lang)}${NNBSP}m²` },
    { label: t('panel.rate'), value: `${localizeMoneyText(formatDE(basis.rate, 2), lang)}${NNBSP}€/m²` },
  ]
}

function driverLabel(
  d: Pick<Driver, 'key' | 'label'>,
  basis: DriverBasis | null,
  t: (key: string, values?: Record<string, string | number>) => string,
  lang: UiLanguage,
): string {
  // Base identity through the same structural, key-based lookup the Level 2
  // children list already uses (`translatedDriverLabel`, clientProjection.
  // ts) — replaces the old `tx(engineLabel)` whole-string reverse lookup,
  // which never matched once the quantity/rate suffix below was appended
  // to it before translation was attempted.
  const base = translatedDriverLabel(d, t)
  // Суффикс «количество × ставка» выводится ИЗ ОСНОВАНИЯ вклада, а не по
  // списку ключей. Прежняя редакция перечисляла два ключа поимённо и брала
  // ставку из каталога напрямую — второй источник той же величины, который
  // разошёлся бы при первой правке ставки и промолчал бы о третьем ключе.
  if (basis?.kind === 'rate') {
    return `${base} · ${localizeMoneyText(formatDE(basis.quantity, 2), lang)}${NNBSP}m² × `
      + `${localizeMoneyText(formatDE(basis.rate, 0), lang)}${NNBSP}€/m²${NNBSP}`
      + DENOMINATOR_LABEL[basis.denominator]
  }
  return base
}

/**
 * Знаковая денежная величина. Порядок — `≈ + 97.000 €`: префикс округления
 * стоит ДО знака, потому что приблизительность относится к величине целиком,
 * а не к её направлению (образец DC-12/DC-29).
 *
 * Форматтер ОДИН на все места. Прежде их было два: общий ставил знак перед
 * `≈`, правильный жил только в подписи журнала — и дельта-чип с превью
 * показывали порядок, которого норматив не знает. Два форматтера одной
 * величины расходятся всегда, вопрос только в том, когда это заметят.
 */
// F-38: exported so BuildingScope's readiness journal disclosure can format
// event deltas identically instead of a second, divergence-prone formatter.
export function signed(d: Decimal): string {
  if (d.isZero()) return `±${NNBSP}0${NNBSP}€`
  const pr = present(d.abs())
  const sign = d.isNegative() ? '−' : '+'
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${NNBSP}${pr.display}${NNBSP}€`
}

function signedPercent(d: Decimal, lang: UiLanguage): string {
  const rounded = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  const differs = !rounded.equals(d)
  const sign = d.isNegative() ? '−' : '+'
  const suffix = lang === 'de' ? `${NNBSP}%` : '%'
  return `${sign}${NNBSP}${differs ? '≈' + NNBSP : ''}`
    + `${localizeMoneyText(formatDE(rounded.abs(), 2), lang)}${suffix}`
}

/**
 * SIDEBAR 03 (SB-14): `de` keeps the existing `DD.MM.YYYY` display exactly
 * as before (zero regression risk to already-passing DE behaviour); `en`
 * formats the same ISO date through `Intl.DateTimeFormat` instead of
 * reusing the DE-ordered digits — no rounding/precision decision is
 * involved in a calendar date, so this is not a `src/engine/**` concern.
 */
function formatDate(iso: string, lang: UiLanguage): string {
  const [y, m, d] = iso.split('-')
  if (lang !== 'en') return `${d}.${m}.${y}`
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(`${y}-${m}-${d}T00:00:00Z`))
}
