import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import DecimalCtor, { type Decimal } from 'decimal.js'
import {
  blockedVariantReason,
  changedFromSource,
  chapterBuildingIds,
  chapterForBuilding,
  chapterRuleById,
  chapterServiceById,
  costAuthorityOf,
  dependencyBlocker,
  dependencySuspension,
  derivedValue,
  isApplicable,
  kgCascadeFor,
  kgChapterOverview,
  kgSystemProgress,
  quantityProblem,
  serviceById,
  serviceContribution,
  serviceDecision as decisionOf,
  suspensionVariantLabel,
  systemNarrative,
  systemServices,
  type KgCascade,
  type KgChapter as KgChapterData,
  type KgCostAuthority,
  type KgScopeGroup,
  type KgService,
  type KgServiceDecisionRecord,
  type KgServiceGroup,
  type KgServiceVariant,
  type KgSystemState,
} from '../engine/kgConfiguration'
import { kgCatalogueFor, responsibilityFor, useStore } from '../state/store'
import { activeDocumentCount, demoProject } from '../state/projectAnalysis'
import { CONFIGURATOR_STEP } from '../state/chapters'
import { localizeMoneyText, useT } from '../i18n'
import { NNBSP, label as moneyLabel, present } from '../engine/money'
import { Button } from '../components/primitives'
import { FormField } from '../components/designSystem'
import { CommercialNumber, signedMoneyText } from '../design-system/CommercialNumber'
import { ChoiceGroup, type ChoiceLayout, type ChoiceOption } from '../design-system/ChoiceGroup'
import { Dialog } from '../components/Dialog'
import { useSemanticMotion } from '../design-system/motion'
import {
  BemusterungBoundary,
  DecisionEditor,
  DecisionQuiet,
  DecisionRow,
  DecisionValueRows,
  EvidenceSection,
  RahmenBand,
  SystemDetailHeader,
  SystemOverviewSummary,
  SystemRow,
  SystemRuleNote,
  type DecisionRelationTone,
  type SummaryTone,
} from '../design-system/KGConfiguration'
import { kgSolutionVisual, kgSystemPictogram } from '../config/kg-visuals'
import { SegmentedControl } from '../components/controls'
import { SelectField } from '../components/designSystem'

/**
 * KG 400 as a FRIENDLY ENGINEERING-SOLUTION CONFIGURATOR (VR3-TGA-UX-00,
 * targets T-01–T-16 in `docs/audit/kg400-friendly-3bfb0bc/`).
 *
 * The question the chapter answers: *which engineering solution are we
 * proposing for this Option?* Everything VR3-TGA-01 made true stays true —
 * source baseline beside every proposal, six cost-authority states, the
 * cascade, suspension, applicability — and this composition changes only
 * where the weight sits:
 *
 * - the OVERVIEW is seven compact rows, each with a pictogram, the current
 *   solution as one strong line and one quiet line, ONE dominant state and a
 *   trustworthy local price phrase;
 * - ONE system is open at a time, as a focused workspace under its row;
 * - a DECIDED decision is a summary with `Ändern`; its alternatives are
 *   absent from the DOM until pressed; an UNRESOLVED decision opens its
 *   editor at once and commits only on `Übernehmen`;
 * - source MATCH is one quiet relation line; source DEVIATION is explicit and
 *   adjacent (`statt Kundendokument: …`) with the way back;
 * - regulation, rationale, provenance and price authority live behind ONE
 *   disclosure per decision, `Grundlage & Herkunft`.
 *
 * IT IS STILL NOT A SECOND KG PAGE. Everything here is driven by what a
 * chapter's data declares; `KgChapter.tsx` chooses this composition by
 * asking the DATA, never the cost group.
 *
 * THE OPTION STORE REMAINS THE SOLE STATE AUTHORITY. Local state here is
 * disclosure and edit mode only: which system is open, which decision is
 * being edited and its uncommitted draft, which evidence panel is open. Apply
 * writes exactly one Option-owned change through `setKgServiceDecision`, the
 * same journalled, undoable path every other surface uses.
 */

type Language = 'de' | 'en'

/** An uncommitted edit: which decision, and what the user is about to say. */
type Draft = Readonly<{ serviceId: string; value: KgServiceDecisionRecord }>

/** Money, through the product's ONE formatter (rule 7: numerals re-typeset, unit kept). */
function money(value: Decimal, language: Language): string {
  return localizeMoneyText(moneyLabel(present(value)), language)
}

/** The glyph that travels with a state's WORD. Never a colour alone (rule 8). */
const STATE_GLYPH: Record<KgSystemState | 'changed', string> = {
  decided: '✓',
  changed: '!',
  fromSource: '○',
  open: '!',
  partial: '◐',
  notApplicable: '—',
}

/** Put focus on one decision's own control, by DECISION ID, across a re-render. */
function focusDecision(id: string, prefer: 'change' | 'heading' | 'control' = 'control'): void {
  const root = document.querySelector<HTMLElement>(`[data-decision="${id}"]`)
  if (!root) return
  const target = prefer === 'change'
    ? root.querySelector<HTMLElement>('.a3-dec-change') ?? root.querySelector<HTMLElement>('[data-decision-heading]')
    : prefer === 'heading'
      ? root.querySelector<HTMLElement>('[data-decision-heading]')
      // The ANSWER first: a decision that just became required (a restored
      // dependant) has its alternatives open, and focus belongs on them, not
      // on the evidence disclosure that happens to precede them in the DOM.
      : root.querySelector<HTMLElement>('input[type="radio"]:not(:disabled)')
        ?? root.querySelector<HTMLElement>('input:not(:disabled), button')
  target?.focus()
}

/** Including a decision has to include everything it needs to be VALID (a quantity carries its quantity). */
function includeValueOf(
  service: KgService,
  current: KgServiceDecisionRecord,
  choice: 'included' | 'excluded',
): KgServiceDecisionRecord {
  if (choice === 'excluded') return { state: 'notSelected' }
  if (service.kind.kind !== 'quantity') return { state: 'selected' }
  return {
    state: 'selected',
    quantity: current.quantity ?? service.kind.baselineQuantity,
  }
}

function sameDecision(a: KgServiceDecisionRecord, b: KgServiceDecisionRecord): boolean {
  return a.state === b.state && a.variant === b.variant && a.quantity === b.quantity
}

/** The value this decision currently holds, in the reader's language, or `null`. */
function currentVariantOf(
  service: KgService, decision: KgServiceDecisionRecord,
): KgServiceVariant | null {
  if (service.kind.kind !== 'singleChoice') return null
  const wanted = decision.variant ?? service.kind.baselineVariant
  return service.kind.variants.find((v) => v.value === wanted) ?? null
}

/**
 * THE deterministic layout rule (decision pattern contract, option-count
 * rules). From option COUNT and COPY LENGTH in BOTH languages — never from
 * a per-decision flag, so feature code cannot improvise:
 *
 * - 2 short options (≤ 24 characters in DE and EN): a two-column pair;
 * - 3–4 options with readable names (≤ 40 characters): a two-column card grid
 *   where the editor is ≥ 720 px wide (the CSS container query decides), one
 *   column below;
 * - 5+ options, or any long technical name: one column, always. Never a
 *   horizontal strip.
 */
export function choiceLayoutFor(
  labels: ReadonlyArray<{ de: string; en: string }>,
): ChoiceLayout {
  const longest = Math.max(0, ...labels.flatMap((l) => [l.de.length, l.en.length]))
  if (labels.length <= 2) return longest <= 24 ? 'grid' : 'stack'
  if (labels.length <= 4) return longest <= 40 ? 'grid' : 'stack'
  return 'stack'
}

/** Does this source value actually SAY something, or does it record that the documents do not? */
function sourceUnspecified(service: KgService, en: boolean): boolean {
  const source = service.source
  if (!source) return true
  const value = en ? source.valueEn : source.valueDe
  if (value === undefined) return true
  return /^(nicht spezifiziert|nicht eindeutig|not specified|ambiguous)$/i.test(value.trim())
}

export function KgSystemChapter({ chapter, group }: {
  chapter: KgChapterData
  group: KgScopeGroup
}) {
  const s = useStore()
  const t = useT()
  const { reduced, fadeRise, transition } = useSemanticMotion()
  const en = s.uiLanguage === 'en'
  const catalogue = kgCatalogueFor(s)
  const decisions = s.kgConfig
  const responsibility = responsibilityFor(s)
  const liveId = useId()

  /**
   * ONE PAGE, ONE BUILDING AT A TIME (VR3-KG-UNIFY-00).
   *
   * A construction chapter decides PER BUILDING, and its catalogue carries
   * one system row per building. The page shows one building's rows and the
   * band chooses which; nothing here is written to the Option — the
   * building context is a view, `choicesFor()` and the Option store stay
   * the only state authority. A chapter whose groups name no building
   * (every KG but the construction one today) is unchanged by this.
   */
  const buildingIds = chapterBuildingIds(chapter)
  const [chosenBuilding, setChosenBuilding] = useState<string | null>(null)
  const landingBuilding = buildingIds.find((id) => s.scopeSelected[id]) ?? buildingIds[0] ?? null
  const activeBuilding = chosenBuilding && buildingIds.includes(chosenBuilding)
    ? chosenBuilding
    : landingBuilding
  const visible = chapterForBuilding(chapter, activeBuilding)

  /** AT MOST ONE SYSTEM OPEN AT A TIME. */
  const [openSystem, setOpenSystem] = useState<string | null>(null)
  /** AT MOST ONE DECISION IN EDIT MODE, with its uncommitted draft. */
  const [draft, setDraft] = useState<Draft | null>(null)
  const [evidenceOpen, setEvidenceOpen] = useState<string | null>(null)
  const [naOpen, setNaOpen] = useState<string | null>(null)
  const [rahmenOpen, setRahmenOpen] = useState<string | null>(null)
  const [bemOpen, setBemOpen] = useState(false)
  const [pending, setPending] = useState<
    { service: KgService; next: KgServiceDecisionRecord; cascade: KgCascade } | null
  >(null)
  /** ONE polite live region; the announcement is stored UNRESOLVED (key + service), never a sentence. */
  const [announcement, setAnnouncement] = useState<
    { key: string; service?: KgService; count: number; name?: string } | null
  >(null)
  const focusAfter = useRef<{ id: string; prefer: 'change' | 'heading' | 'control' } | null>(null)
  const pendingDecision = useRef<string | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const dialogTitleId = 'tga-cascade-title'

  const label = useCallback(
    (de: string | undefined, enText: string | undefined) => (en ? enText : de) ?? '',
    [en],
  )
  const buildingNameOf = (id: string | undefined) =>
    (id ? s.scopeBuildings.find((b) => b.id === id)?.name : undefined) ?? id ?? ''

  /**
   * On arrival, the FIRST system that still owes a decision opens itself:
   * real work is the strongest attention item, and a salesperson landing on
   * a chapter with one open question should not have to find it.
   */
  useEffect(() => {
    setDraft(null); setEvidenceOpen(null); setNaOpen(null); setRahmenOpen(null); setBemOpen(false)
    setChosenBuilding(null)
    if (!catalogue || !decisions) { setOpenSystem(null); return }
    const landing = chapterForBuilding(chapter, landingBuilding)
    const first = landing.groups.find((g) =>
      kgSystemProgress(catalogue, decisions, g).state === 'open')
    setOpenSystem(first?.id ?? null)
    // The catalogue and the decisions are derived from these three keys; a
    // change of either without them is the same Option and must not reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, s.opportunityId, s.activeOptionId])

  /** After a commit, focus lands where the contract says — across the re-render. */
  useEffect(() => {
    const wanted = focusAfter.current
    if (!wanted) return
    focusAfter.current = null
    focusDecision(wanted.id, wanted.prefer)
  }, [openSystem, announcement, pending, draft])

  if (!catalogue || !decisions) return null

  const overview = kgChapterOverview(catalogue, decisions, visible)
  const identity = `KG${NNBSP}${group.slice(3)}`

  /**
   * A building switch replaces the building-scoped rows (storyboard 7). An
   * open system stays open only where it still exists; otherwise the first
   * system of the new building that owes a decision opens, exactly as on
   * arrival. Focus is NOT moved — the user is operating the switch — and the
   * live region states the new context once.
   */
  const switchBuilding = (id: string) => {
    if (id === activeBuilding) return
    s.previewOption(null)
    setDraft(null); setEvidenceOpen(null); setNaOpen(null)
    setChosenBuilding(id)
    const next = chapterForBuilding(chapter, id)
    const first = next.groups.find((g) =>
      kgSystemProgress(catalogue, decisions, g).state === 'open')
    setOpenSystem(first?.id ?? null)
    setAnnouncement({ key: 'vr3.kg.building.announce', count: next.groups.length, name: buildingNameOf(id) })
  }

  /* ── edit mode ───────────────────────────────────────────────────────── */

  const beginEdit = (service: KgService) => {
    s.previewOption(null)
    setDraft({ serviceId: service.id, value: decisionOf(decisions, service) })
  }

  const cancelEdit = (service: KgService, editable: boolean) => {
    s.previewOption(null)
    setDraft(null)
    if (rahmenOpen && chapter.rahmen?.some((e) => e.editServiceId === service.id)) {
      setRahmenOpen(null)
      return
    }
    focusAfter.current = { id: service.id, prefer: editable ? 'change' : 'heading' }
    setDraft((current) => current) // schedule the focus effect
  }

  const setDraftValue = (service: KgService, value: KgServiceDecisionRecord) => {
    setDraft({ serviceId: service.id, value })
    // DC-28: the consequence before the commitment, through the ONE preview path.
    s.previewOption({ kind: 'kgService', serviceId: service.id, value })
  }

  /* ── committing a decision, with its cascade ─────────────────────────── */

  const commit = (service: KgService, next: KgServiceDecisionRecord, editable = true) => {
    const cascade = kgCascadeFor(catalogue, decisions, service.id, next)
    /**
     * A MATERIAL consequence is shown BEFORE it is applied. Everything else
     * simply happens: a confirmation that fires on every change stops being
     * read.
     */
    if (cascade.material) {
      pendingDecision.current = service.id
      returnFocusRef.current = document.querySelector<HTMLElement>(
        `[data-decision="${service.id}"] input:not(:disabled), [data-decision="${service.id}"] button`,
      )
      setPending({ service, next, cascade })
      return
    }
    apply(service, next, cascade, editable)
  }

  const apply = (
    service: KgService, next: KgServiceDecisionRecord, cascade: KgCascade, editable = true,
  ) => {
    s.previewOption(null)
    s.setKgServiceDecision(service.id, next)
    const moved = cascade.entries.filter((entry) => entry.effect !== 'preserve')
    setAnnouncement({
      key: moved.length === 0
        ? 'vr3.tga.cascade.announceNone'
        : moved.length === 1
          ? 'vr3.tga.cascade.announce'
          : 'vr3.tga.cascade.announcePlural',
      service,
      count: moved.length,
    })
    setDraft(null)
    if (rahmenOpen && chapter.rahmen?.some((e) => e.editServiceId === service.id)) {
      setRahmenOpen(null)
    }
    // Focus the decision that CAME BACK where one did; otherwise return to the
    // decision's own change control — the contract's "return focus".
    const restored = moved.find((e) => e.effect === 'restore')?.service.id
    focusAfter.current = restored
      ? { id: restored, prefer: 'control' }
      : { id: service.id, prefer: editable ? 'change' : 'heading' }
  }

  /* ── the words a euro is allowed to use ─────────────────────────────── */

  /** The canonical phrase of one cost authority — no component translates `noBasis` on its own. */
  const authorityPhrase = (authority: KgCostAuthority, basis?: string): string | undefined => {
    switch (authority) {
      case 'bauherr': return t('vr3.tga.price.bauherr')
      case 'bundle': return basis ? t('vr3.tga.price.bundleNamed', { basis }) : t('vr3.tga.price.bundle')
      case 'indirect': return t('vr3.tga.price.indirect')
      case 'noBasis': return t('vr3.tga.price.noBasis')
      case 'direct': return t('vr3.tga.price.direct')
      case 'none': return undefined
    }
  }

  /** What an EXCLUDED scope position says about money: never `0 €`, not automatically Bauseits. */
  const excludedPhraseOf = (service: KgService): string =>
    label(service.excludedPhraseDe, service.excludedPhraseEn) || t('vr3.tga.price.notInOffer')

  const consequenceOf = (
    variant: KgServiceVariant, service: KgService, decision: KgServiceDecisionRecord,
  ): string => {
    if (variant.excludesPosition) return excludedPhraseOf(service)
    if (variant.costAuthority) return authorityPhrase(variant.costAuthority) ?? ''
    if (variant.bundled) return t('vr3.tga.price.bundle')
    if (variant.noPriceBasis) return t('vr3.tga.price.noEffect')
    const current = decision.variant
      ?? (service.kind.kind === 'singleChoice' ? service.kind.baselineVariant : undefined)
    if (variant.value === current) return t('vr3.tga.price.baseline')
    if (Number(variant.delta) === 0) return t('vr3.tga.price.baseline')
    return signedMoneyText(new DecimalCtor(variant.delta), s.uiLanguage)
  }

  const pricePhraseOf = (service: KgService, decision: KgServiceDecisionRecord): string | undefined => {
    const authority = costAuthorityOf(service)
    if (authority === 'none') return undefined
    // A scope position the user took OUT of the offer states so in the
    // domain's words (`nicht im All3-Angebot · Verantwortung offen`).
    if (decision.state === 'notSelected' && service.kind.kind !== 'singleChoice'
      && service.excludedPhraseDe) return excludedPhraseOf(service)
    if (authority === 'bauherr') return t('vr3.tga.price.bauherr')
    const basis = label(service.costBasisDe, service.costBasisEn)
    if (authority === 'noBasis') return t('vr3.tga.price.noBasis')
    if (authority === 'bundle') {
      return basis ? t('vr3.tga.price.bundleNamed', { basis }) : t('vr3.tga.price.bundle')
    }
    if (authority === 'indirect') return t('vr3.tga.price.indirect')
    // direct
    if (service.requiresDecision && decision.state === 'undecided') {
      return t('vr3.tga.price.afterSelection')
    }
    const chosen = currentVariantOf(service, decision)
    if (chosen?.excludesPosition) return excludedPhraseOf(service)
    if (chosen?.costAuthority) return authorityPhrase(chosen.costAuthority, basis || undefined)
    if (chosen?.bundled) return t('vr3.tga.price.bundle')
    if (chosen?.noPriceBasis) return t('vr3.tga.price.noBasis')
    const blocked = dependencyBlocker(catalogue, decisions, service) !== null
    const contribution = serviceContribution(catalogue, decisions, service)
    if (blocked || contribution === null || contribution.isZero()) {
      /**
       * PRICED, BUT NOT ON THIS LINE. A decision whose money lives in its
       * alternatives (`Anlagenkonzept`) says `direkt bepreist`; a service
       * carrying a real amount that contributes nothing says which sentence
       * rule 16 has for it. Neither is `0 €`.
       */
      if (!new DecimalCtor(service.amount).isZero()) {
        return decision.state === 'notSelected'
          ? t('vr3.tga.price.notInOffer')
          : t('vr3.tga.price.notDetermined')
      }
      return t('vr3.tga.price.direct')
    }
    return `${t('vr3.tga.price.direct')} · ${money(contribution, s.uiLanguage)}`
  }

  /* ── the relation a proposal has to the client documents ────────────── */

  const relationOf = (
    service: KgService, decision: KgServiceDecisionRecord,
  ): { tone: DecisionRelationTone; label: string; detail?: string } | undefined => {
    if (service.kind.kind === 'readOnlyRequired') {
      // A DERIVED record names the decisions it follows from — so a
      // requirement never reads as a Sales question nobody answered.
      if (service.derived) {
        return { tone: 'derived', label: t('vr3.tga.relation.derivedFrom', { decisions: governorNames(service) }) }
      }
      return service.dependsOn
        ? { tone: 'derived', label: t('vr3.tga.relation.derived') }
        : { tone: 'project', label: t('vr3.tga.relation.project') }
    }
    // A CONTRADICTED answer states its unmet prerequisite on the row itself,
    // not only inside the editor — the summary is what a reader scans.
    const blocker = dependencyBlocker(catalogue, decisions, service)
    const blockedBy = blocker ? serviceById(catalogue, blocker) : null
    if (blockedBy) {
      return {
        tone: 'missing',
        label: t('vr3.kg.service.dependencyWarning', { upstream: label(blockedBy.labelDe, blockedBy.labelEn) }),
      }
    }
    const changed = changedFromSource(decisions, service)
    if (changed === true) {
      return {
        tone: 'changed',
        label: t('vr3.tga.relation.changed'),
        detail: t('vr3.tga.relation.insteadOf', {
          source: label(service.source?.valueDe, service.source?.valueEn),
        }),
      }
    }
    if (changed === false) return { tone: 'match', label: t('vr3.tga.relation.matches') }
    if (!service.source) return undefined
    // An origin with NO value is not a missing client statement: it names
    // where the proposal comes from ("Grundlage Gebäude · bestätigt",
    // "All3-Standard · Leistungsverzeichnis"), so the relation line says that,
    // quietly. Only an explicit "not specified / ambiguous" is the missing case.
    if (service.source.valueDe === undefined) {
      return { tone: 'quiet', label: label(service.source.originDe, service.source.originEn) }
    }
    if (sourceUnspecified(service, en)) {
      return decision.state === 'undecided'
        ? { tone: 'missing', label: t('vr3.tga.relation.missing') }
        : { tone: 'quiet', label: t('vr3.tga.relation.missing') }
    }
    return {
      tone: 'quiet',
      label: t('vr3.tga.relation.source', {
        source: label(service.source.valueDe, service.source.valueEn),
      }),
    }
  }

  /* ── the human-readable current value of a decision ─────────────────── */

  /** The decisions a derived record follows from, by name. */
  const governorNames = (service: KgService): string => (service.derived?.from ?? [])
    .map((id) => chapterServiceById(chapter, id))
    .filter((governor): governor is KgService => governor !== null)
    .map((governor) => label(governor.labelDe, governor.labelEn))
    .join(' · ')

  const currentOf = (service: KgService, decision: KgServiceDecisionRecord): string => {
    if (service.kind.kind === 'singleChoice') {
      if (decision.state === 'undecided') return t('vr3.tga.decision.undecided')
      const variant = currentVariantOf(service, decision)
      return variant ? label(variant.labelDe, variant.labelEn) : label(service.summaryDe, service.summaryEn)
    }
    if (service.kind.kind === 'readOnlyRequired') {
      if (service.derived) return derivedValue(catalogue, decisions, service, s.uiLanguage) ?? ''
      return label(service.source?.valueDe, service.source?.valueEn)
        || label(service.summaryDe, service.summaryEn)
    }
    if (decision.state === 'undecided') return t('vr3.tga.decision.undecided')
    // A SCOPE decision answers in the domain's own words where the catalogue
    // supplies them (`Nicht im All3-Leistungsumfang`), else the generic pair.
    if (decision.state === 'notSelected') {
      return label(service.excludeLabelDe, service.excludeLabelEn) || t('vr3.tga.decision.notIncluded')
    }
    if (service.kind.kind === 'quantity') {
      return t('vr3.tga.decision.quantityOf', {
        quantity: decision.quantity ?? service.kind.baselineQuantity,
        unit: label(service.kind.unitDe, service.kind.unitEn),
      })
    }
    return label(service.includeLabelDe, service.includeLabelEn) || t('vr3.tga.decision.included')
  }

  /* ── the editor of one decision ─────────────────────────────────────── */

  const editorOf = (service: KgService, decision: KgServiceDecisionRecord, withCancel: boolean) => {
    const current = draft?.serviceId === service.id ? draft.value : decision
    // Focus enters the alternatives only when the USER opened them (`Ändern`,
    // or the band's `ändern`); an editor that is open on arrival because the
    // decision is unresolved waits for the user to enter it — otherwise
    // arrival scrolls the page to the first open question and steals focus.
    const entered = withCancel && draft?.serviceId === service.id
    const changed = !sameDecision(current, decision)
    const complete = current.state === 'notSelected'
      || (current.state === 'selected'
        && (service.kind.kind !== 'singleChoice' || current.variant !== undefined)
        && (service.kind.kind !== 'quantity'
          || quantityProblem(service, current.quantity) === null))
    const applyDisabled = !complete || (!changed && decision.state !== 'undecided')
    const applyReason = !complete
      ? t('vr3.tga.decision.applyBlocked')
      : t('vr3.tga.decision.applyUnchanged')
    const legend = t('vr3.kg.service.legend', { service: label(service.labelDe, service.labelEn) })

    let control
    if (service.kind.kind === 'singleChoice') {
      const variants = service.kind.variants
      const layout = choiceLayoutFor(variants.map((v) => ({ de: v.labelDe, en: v.labelEn })))
      const options: ChoiceOption<string>[] = variants.map((variant) => {
        const reason = blockedVariantReason(service, variant.value, en)
        const art = kgSolutionVisual(variant.value)
        return {
          value: variant.value,
          label: label(variant.labelDe, variant.labelEn),
          description: label(variant.detailDe, variant.detailEn) || undefined,
          badge: service.all3Standard === variant.value ? t('vr3.tga.all3Standard') : undefined,
          consequence: consequenceOf(variant, service, decision),
          // Decorative by policy: the text beside it names the concept.
          media: art ? (
            <img src={art.src} alt="" width={art.width} height={art.height} loading="lazy" />
          ) : undefined,
          ...(reason ? { disabled: true, disabledReason: reason } : {}),
        }
      })
      control = (
        <ChoiceGroup
          legend={legend}
          legendHidden
          layout={layout}
          autoFocus={entered}
          value={current.state === 'selected' ? current.variant ?? null : null}
          options={options}
          onChange={(value) => setDraftValue(service, { state: 'selected', variant: value })}
          onPreview={(value) => {
            if (value === null) {
              // Leaving the option restores the DRAFT's preview, not silence.
              s.previewOption(current.state === 'undecided' ? null : {
                kind: 'kgService', serviceId: service.id, value: current,
              })
              return
            }
            s.previewOption({
              kind: 'kgService', serviceId: service.id, value: { state: 'selected', variant: value },
            })
          }}
        />
      )
    } else {
      const authority = costAuthorityOf(service)
      const includeConsequence = authority === 'direct'
        ? (new DecimalCtor(service.amount).isZero()
          ? undefined
          : signedMoneyText(new DecimalCtor(service.amount), s.uiLanguage))
        : t(`vr3.tga.price.${authority === 'bundle' ? 'bundle' : 'noBasis'}`)
      control = (
        <>
          <ChoiceGroup
            legend={legend}
            legendHidden
            layout="grid"
            autoFocus={entered}
            value={current.state === 'selected' ? 'included'
              : current.state === 'notSelected' ? 'excluded' : null}
            options={[
              {
                value: 'included' as const,
                label: label(service.includeLabelDe, service.includeLabelEn) || t('vr3.kg.service.include'),
                consequence: includeConsequence,
              },
              {
                value: 'excluded' as const,
                label: label(service.excludeLabelDe, service.excludeLabelEn) || t('vr3.kg.service.exclude'),
                consequence: excludedPhraseOf(service),
              },
            ]}
            onChange={(choice) => setDraftValue(service, includeValueOf(service, current, choice))}
            onPreview={(choice) => s.previewOption(choice === null
              ? (current.state === 'undecided' ? null : {
                kind: 'kgService', serviceId: service.id, value: current,
              })
              : { kind: 'kgService', serviceId: service.id, value: includeValueOf(service, current, choice) })}
          />
          {service.kind.kind === 'quantity' && current.state === 'selected' && (
            <QuantityDraft
              service={service}
              value={current.quantity ?? service.kind.baselineQuantity}
              onChange={(quantity) => setDraftValue(service, { state: 'selected', quantity })}
            />
          )}
        </>
      )
    }

    const blocker = dependencyBlocker(catalogue, decisions, service)
    // CATALOGUE-wide: a dependency may cross chapters (KG 700's QNG seal
    // waits on KG 400's Energieziel), and a warning that cannot name its
    // upstream is the defect the dependency contract exists to prevent.
    const upstream = blocker ? serviceById(catalogue, blocker) : null
    return (
      <DecisionEditor
        heading={t('vr3.tga.decision.validSolutions')}
        hint={t('vr3.tga.decision.chooseOne')}
        note={upstream
          ? t('vr3.kg.service.dependencyWarning', { upstream: label(upstream.labelDe, upstream.labelEn) })
          : t('vr3.tga.decision.editorNote')}
        apply={{
          label: t('vr3.tga.decision.apply'),
          onApply: () => commit(service, current, withCancel),
          disabled: applyDisabled,
          disabledReason: applyReason,
        }}
        cancel={withCancel ? {
          label: t('vr3.tga.decision.cancel'),
          onCancel: () => cancelEdit(service, true),
        } : undefined}
        onEscape={withCancel ? () => cancelEdit(service, true) : undefined}
      >
        {control}
      </DecisionEditor>
    )
  }

  /* ── the evidence disclosure of one decision ────────────────────────── */

  const evidenceOf = (service: KgService, decision: KgServiceDecisionRecord, basis?: string) => {
    const rule = service.ruleId ? chapterRuleById(chapter, service.ruleId) : null
    const authority = costAuthorityOf(service)
    const blocked = (service.blockedVariants ?? []).map((b) => {
      const variant = service.kind.kind === 'singleChoice'
        ? service.kind.variants.find((v) => v.value === b.value) : undefined
      return `${variant ? label(variant.labelDe, variant.labelEn) : b.value} — ${label(b.reasonDe, b.reasonEn)}`
    })
    const standard = service.kind.kind === 'singleChoice' && service.all3Standard
      ? service.kind.variants.find((v) => v.value === service.all3Standard) : undefined
    return (
      <>
        <EvidenceSection
          label={t('vr3.tga.evidence.source')}
          rows={[
            ...(service.source ? [
              { k: t('vr3.tga.source.label'), v: label(service.source.originDe, service.source.originEn) },
              {
                k: t('vr3.tga.evidence.sourceValue'),
                v: label(service.source.valueDe, service.source.valueEn) || t('vr3.tga.source.notSpecified'),
              },
            ] : []),
            { k: t('vr3.tga.nachweis'), v: t(`vr3.kg.service.authority.${service.authority}`) },
            ...(label(service.scopeDe, service.scopeEn)
              ? [{ k: t('vr3.tga.evidence.scope'), v: label(service.scopeDe, service.scopeEn) }] : []),
          ]}
        />
        <EvidenceSection
          label={t('vr3.tga.evidence.technical')}
          rows={[
            ...(basis ? [{ k: t('vr3.tga.rahmen.basis'), v: basis }] : []),
            ...(service.derived
              ? [{ k: t('vr3.tga.evidence.derivedFrom'), v: governorNames(service) }] : []),
            ...(label(service.whyDe, service.whyEn)
              ? [{ k: label(service.labelDe, service.labelEn), v: label(service.whyDe, service.whyEn) }] : []),
            ...(standard
              ? [{ k: t('vr3.tga.evidence.standard'), v: label(standard.labelDe, standard.labelEn) }] : []),
            ...(blocked.length > 0
              ? [{ k: t('vr3.tga.evidence.blocked'), v: blocked.join(' · ') }] : []),
          ]}
        />
        {rule && (
          <SystemRuleNote
            title={label(rule.titleDe, rule.titleEn)}
            body={label(rule.bodyDe, rule.bodyEn)}
            note={label(rule.noteDe, rule.noteEn) || undefined}
            source={label(rule.sourceDe, rule.sourceEn)}
          />
        )}
        <EvidenceSection
          label={t('vr3.tga.evidence.price')}
          rows={[
            ...(authority === 'none' ? [] : [{
              k: t('vr3.tga.price.label'),
              v: pricePhraseOf(service, decision) ?? t('vr3.tga.price.noBasis'),
            }]),
            ...(label(service.costBasisDe, service.costBasisEn)
              ? [{ k: t('vr3.tga.evidence.price'), v: label(service.costBasisDe, service.costBasisEn) }] : []),
            ...(label(service.offerNoteDe, service.offerNoteEn)
              ? [{ k: t('vr3.tga.evidence.offer'), v: label(service.offerNoteDe, service.offerNoteEn) }] : []),
          ]}
        />
      </>
    )
  }

  /* ── one decision ───────────────────────────────────────────────────── */

  const renderDecision = (service: KgService, options: { basis?: string; inRahmen?: boolean } = {}) => {
    const decision = decisionOf(decisions, service)
    const name = label(service.labelDe, service.labelEn)

    if (!isApplicable(service)) {
      return (
        <DecisionQuiet
          key={service.id}
          id={service.id}
          name={name}
          statement={`${t('vr3.tga.notApplicable')} — ${label(
            service.applicability?.reasonDe, service.applicability?.reasonEn,
          )}`}
        />
      )
    }
    /** A DECISION WHOSE PRECONDITION LAPSED SAYS SO, AND SAYS WHOSE (Acceptance ACCEPT-01). */
    const suspendedBy = dependencySuspension(catalogue, decisions, service)
    if (suspendedBy) {
      const held = suspensionVariantLabel(suspendedBy, decisions, s.uiLanguage)
      const cause = label(suspendedBy.labelDe, suspendedBy.labelEn)
      return (
        <DecisionQuiet
          key={service.id}
          id={service.id}
          name={name}
          statement={`${t('vr3.tga.notApplicable')} — ${held
            ? t('vr3.tga.suspendedBy', { decision: cause, value: held })
            : t('vr3.tga.suspendedByOpen', { decision: cause })}`}
        />
      )
    }

    const editable = service.kind.kind !== 'readOnlyRequired'
    const unresolved = editable && service.requiresDecision && decision.state === 'undecided'
    const editing = options.inRahmen ? true : draft?.serviceId === service.id
    const showEditor = editable && (unresolved || editing)
    const changed = changedFromSource(decisions, service)
    const relation = relationOf(service, decision)
    const restoreVariant = service.source?.variant
    const canRestore = changed === true && restoreVariant !== undefined
      && !blockedVariantReason(service, restoreVariant, en)

    return (
      <DecisionRow
        key={service.id}
        id={service.id}
        name={name}
        current={currentOf(service, decision)}
        relation={relation}
        price={pricePhraseOf(service, decision)}
        attention={unresolved ? 'open' : changed === true ? 'deviation' : undefined}
        muted={!editable}
        action={editable && !showEditor ? (
          <Button
            className="a3-dec-change"
            aria-label={t('vr3.tga.decision.changeOf', { decision: name })}
            onClick={() => beginEdit(service)}
          >
            {t('vr3.tga.decision.change')}
          </Button>
        ) : undefined}
        deviation={changed === true ? {
          title: t('vr3.tga.deviation.title'),
          body: t('vr3.tga.deviation.body'),
          restore: canRestore ? (
            <button
              type="button"
              className="a3-linkbtn"
              onClick={() => commit(service, { state: 'selected', variant: restoreVariant })}
            >
              {t('vr3.tga.restoreSource')}
            </button>
          ) : undefined,
        } : undefined}
        valueRows={service.valueRows ? (
          <DecisionValueRows
            rows={service.valueRows.map((row, index) => ({
              id: `${service.id}-${index}`,
              label: row.buildingId ? buildingNameOf(row.buildingId) : label(row.labelDe, row.labelEn),
              value: label(row.valueDe, row.valueEn),
              amount: row.amount !== undefined
                ? (
                  <CommercialNumber
                    exact={new DecimalCtor(row.amount)}
                    language={s.uiLanguage}
                    emphasis="compact"
                  />
                )
                : label(row.noteDe, row.noteEn) || undefined,
              ...(row.status ? {
                status: {
                  glyph: row.status === 'ok' ? '✓' : '!',
                  label: row.status === 'ok'
                    ? t('vr3.tga.system.state.decided')
                    : t('vr3.tga.notApplicable'),
                  tone: row.status,
                },
              } : {}),
              notApplicable: row.notApplicable,
            }))}
          />
        ) : undefined}
        editor={showEditor ? (
          <AnimatePresence initial={false}>
            <motion.div
              key="editor"
              variants={reduced ? undefined : fadeRise}
              initial={reduced ? false : 'hidden'}
              animate={reduced ? undefined : 'visible'}
              exit={reduced ? undefined : 'exit'}
              transition={transition('reveal')}
            >
              {editorOf(service, decision, editable && !unresolved)}
            </motion.div>
          </AnimatePresence>
        ) : undefined}
        evidence={{
          label: t('vr3.tga.evidence.toggle'),
          accessibleName: t('vr3.tga.evidence.toggleOf', { decision: name }),
          open: evidenceOpen === service.id,
          onToggle: () => setEvidenceOpen(evidenceOpen === service.id ? null : service.id),
          children: evidenceOf(service, decision, options.basis),
        }}
      />
    )
  }

  /* ── the Rahmen band ────────────────────────────────────────────────── */

  const buildings = s.scopeBuildings.filter((b) => s.scopeSelected[b.id])
  const unresolvedInterfaces = responsibility?.unresolved.length ?? 0
  // The count the Option inherited (the journalled baseline) where it is in
  // memory; otherwise the live analysis, through the SAME function the
  // baseline snapshot itself uses. Never a number authored into the fixture.
  const sourceDocumentCount = (() => {
    const project = demoProject(s.opportunityId)
    const analysis = project ? s.projectAnalyses[project.id] : undefined
    return s.projectBaseline?.documentCount
      ?? (project && analysis ? activeDocumentCount(project, analysis) : 0)
  })()

  /**
   * THE BUILDING SWITCH (DC-46): `SegmentedControl` up to three buildings,
   * `<select>` beyond (LOCALE-004). Present only where the chapter decides
   * per building and there is more than one building to decide for.
   */
  const buildingControl = buildingIds.length <= 1
    ? undefined
    : buildingIds.length <= 3
      ? (
        <SegmentedControl
          legend={t('vr3.kg.band.buildingChoose')}
          legendHidden
          layout="inline"
          size="compact"
          value={activeBuilding ?? buildingIds[0]!}
          options={buildingIds.map((id) => ({ value: id, label: buildingNameOf(id) }))}
          onChange={switchBuilding}
        />
      )
      : (
        <SelectField
          label={t('vr3.kg.band.buildingChoose')}
          value={activeBuilding ?? ''}
          onChange={(event) => switchBuilding(event.target.value)}
        >
          {buildingIds.map((id) => <option key={id} value={id}>{buildingNameOf(id)}</option>)}
        </SelectField>
      )

  const rahmenEntries = (chapter.rahmen ?? []).map((entry) => {
    const edited = entry.editServiceId ? chapterServiceById(chapter, entry.editServiceId) : null
    if (entry.derive === 'buildingScope') {
      /**
       * ONE band grammar, two chapter kinds. An Option-wide chapter (KG 400)
       * states the building scope as a fact; a PER-BUILDING chapter (KG 300)
       * states which building's rows are live and lets the user switch —
       * the same cell, so the reader finds the building in the same place
       * in every chapter.
       */
      if (buildingIds.length > 0) {
        /**
         * WORK THAT LIVES UNDER ANOTHER BUILDING IS NAMED HERE. The chapter's
         * completion counts every building while the rows show one, so a
         * `Weiter` that stays blocked by decisions the reader cannot see
         * would be a refusal without a route. The buildings still owing a
         * decision are listed beside the switch, from the same selector the
         * summary line uses.
         */
        const openElsewhere = buildingIds
          .filter((id) => id !== activeBuilding)
          .map((id) => ({ id, open: kgChapterOverview(catalogue, decisions, chapterForBuilding(chapter, id)).open }))
          .filter((entry) => entry.open > 0)
          .map((entry) => `${buildingNameOf(entry.id)} (${entry.open})`)
        return {
          id: entry.id,
          label: label(entry.labelDe, entry.labelEn),
          value: buildingNameOf(activeBuilding ?? undefined),
          meta: buildingIds.length > 1
            ? [
              t('vr3.kg.band.perBuilding', { count: buildingIds.length }),
              ...(openElsewhere.length > 0
                ? [t('vr3.kg.band.openElsewhere', { names: openElsewhere.join(' · ') })] : []),
            ].join(' · ')
            : (s.scopeSaved ? t('vr3.tga.rahmen.baselineConfirmed') : t('vr3.tga.rahmen.baselineOpen')),
          control: buildingControl,
        }
      }
      return {
        id: entry.id,
        label: label(entry.labelDe, entry.labelEn),
        value: buildings.length === 1
          ? t('vr3.tga.rahmen.buildingsOne', { name: buildings[0]!.name })
          : t('vr3.tga.rahmen.buildingsMany', { count: buildings.length }),
        meta: buildings.length === 1
          ? (s.scopeSaved ? t('vr3.tga.rahmen.baselineConfirmed') : t('vr3.tga.rahmen.baselineOpen'))
          : buildings.map((b) => b.name).join(' · '),
      }
    }
    if (entry.derive === 'sourceDocuments') {
      return {
        id: entry.id,
        label: label(entry.labelDe, entry.labelEn),
        value: t('vr3.tga.rahmen.sourceDocuments', { count: sourceDocumentCount }),
        meta: t('vr3.tga.rahmen.sourceMeta'),
      }
    }
    if (entry.derive === 'responsibility') {
      /**
       * READ-ONLY, FROM THE OWNER. The scope boundary is the one responsibility
       * fact a technical system depends on, so the band states it — and links
       * to the step that owns it rather than editing it here (one owner,
       * `responsibility-matrix-relocation-map.md`).
       */
      return {
        id: entry.id,
        label: label(entry.labelDe, entry.labelEn),
        value: responsibility
          ? label(responsibility.scopeBoundary.handoverDe, responsibility.scopeBoundary.handoverEn)
          : t('vr3.tga.source.notSpecified'),
        meta: unresolvedInterfaces > 0
          ? t(unresolvedInterfaces === 1
            ? 'vr3.responsibility.state.open' : 'vr3.responsibility.state.openPlural',
          { count: unresolvedInterfaces })
          : t('vr3.tga.rahmen.boundaryClient'),
        action: {
          label: `${t('vr3.tga.rahmen.boundaryLink')} ↗`,
          accessibleName: t('vr3.tga.rahmen.boundaryLinkOf'),
          onToggle: () => s.openConfiguratorStepAt(CONFIGURATOR_STEP.RESPONSIBILITY),
        },
      }
    }
    const shown = edited ? currentOf(edited, decisionOf(decisions, edited)) : label(entry.valueDe, entry.valueEn)
    return {
      id: entry.id,
      label: label(entry.labelDe, entry.labelEn),
      value: shown,
      meta: label(entry.metaDe, entry.metaEn) || undefined,
      ...(edited ? {
        action: {
          // The visible word IS the accessible name (label-in-name): there is
          // exactly one editable band entry, so `ändern` is unambiguous, and
          // the released suites address it by that word.
          label: rahmenOpen === entry.id ? t('vr3.tga.rahmen.close') : t('vr3.tga.rahmen.edit'),
          expanded: rahmenOpen === entry.id,
          onToggle: () => {
            if (rahmenOpen === entry.id) { s.previewOption(null); setDraft(null); setRahmenOpen(null); return }
            setRahmenOpen(entry.id)
            beginEdit(edited)
          },
        },
      } : {}),
    }
  })

  /**
   * A PER-BUILDING chapter without a Rahmen of its own still gets the two
   * discriminating facts the target's band shows — the building whose rows
   * are live and the source documents. Both are derived from the Option,
   * never authored into a catalogue.
   */
  const contextEntries = buildingIds.length === 0 ? [] : [
    {
      id: 'building',
      label: t('vr3.kg.band.building'),
      value: buildingNameOf(activeBuilding ?? undefined),
      meta: buildingIds.length > 1
        ? t('vr3.kg.band.perBuilding', { count: buildingIds.length })
        : (s.scopeSaved ? t('vr3.tga.rahmen.baselineConfirmed') : t('vr3.tga.rahmen.baselineOpen')),
      control: buildingControl,
    },
    {
      id: 'source',
      label: t('vr3.kg.band.source'),
      value: t('vr3.tga.rahmen.sourceDocuments', { count: sourceDocumentCount }),
      meta: t('vr3.tga.rahmen.sourceMeta'),
    },
  ]
  const bandEntries = chapter.rahmen ? rahmenEntries : contextEntries

  const openRahmen = (chapter.rahmen ?? []).find((e) => e.id === rahmenOpen)
  const openRahmenService = openRahmen?.editServiceId
    ? chapterServiceById(chapter, openRahmen.editServiceId) : null

  /* ── one system ─────────────────────────────────────────────────────── */

  const solutionOf = (serviceGroup: KgServiceGroup) => {
    const narrative = systemNarrative(catalogue, decisions, serviceGroup)
    const summary = label(narrative.summaryDe, narrative.summaryEn)
    const segments = summary.split(' · ').map((x) => x.trim()).filter(Boolean)
    const live = systemServices(serviceGroup).filter((service) =>
      isApplicable(service) && dependencySuspension(catalogue, decisions, service) === null)
    // The row LEADS with the current solution: the first live choice, else
    // the first live scope/quantity decision (`Im All3-Leistungsumfang`,
    // `Noch nicht entschieden`) — the collapsed row must not hide the answer
    // behind the editorial sentence. Only a row of read-only records states
    // its narrative (VR3-KG-UNIFY-00, collapsed-state contract).
    const lead = live.find((service) => service.kind.kind === 'singleChoice')
      ?? live.find((service) => service.kind.kind !== 'readOnlyRequired')
    if (!lead) {
      return { primary: segments[0] ?? summary, secondary: segments.slice(1).join(' · ') || undefined }
    }
    const leadDecision = decisionOf(decisions, lead)
    const primary = currentOf(lead, leadDecision)
    // The secondary line states OTHER live facts, never a frozen sentence
    // that could contradict the decision above it (ACCEPT-01's lesson).
    const facts: string[] = []
    for (const service of live) {
      if (service === lead || facts.length >= 2) continue
      const decision = decisionOf(decisions, service)
      if (service.kind.kind === 'singleChoice' && decision.state === 'selected') {
        facts.push(currentOf(service, decision))
      } else if (service.kind.kind !== 'singleChoice' && service.requiresDecision
        && decision.state !== 'undecided') {
        facts.push(`${label(service.labelDe, service.labelEn)} · ${currentOf(service, decision)}`)
      }
    }
    if (facts.length === 0) {
      // No further live decision to state: the lead's own differentiator, or
      // the editorial sentence minus the part the primary line already says.
      const leadVariant = leadDecision.state === 'selected' ? currentVariantOf(lead, leadDecision) : null
      const leadDetail = label(leadVariant?.detailDe, leadVariant?.detailEn)
      if (leadDetail) return { primary, secondary: leadDetail }
      const rest = segments.filter((segment) =>
        !primary.toLowerCase().startsWith(segment.toLowerCase())
        && !segment.toLowerCase().startsWith(primary.toLowerCase()))
      return { primary, secondary: rest.join(' · ') || undefined }
    }
    // ONE quiet line: a second fact that would push the row to three lines is
    // one fact too many for an overview (it stays one click away).
    const joined = facts.join(' · ')
    return { primary, secondary: joined.length > 64 && facts.length > 1 ? facts[0] : joined }
  }

  /**
   * A system whose position the user took OUT of the offer states so in the
   * row — `nicht im All3-Angebot · Verantwortung offen` — never `direkt
   * bepreist` with no figure (the words would assert a price for a position
   * that has none; rule 16). The excluding decision's own phrase is used.
   */
  const excludedPhraseOfSystem = (serviceGroup: KgServiceGroup): string | undefined => {
    const excluding = systemServices(serviceGroup).find((service) => {
      if (!isApplicable(service) || dependencySuspension(catalogue, decisions, service)) return false
      const decision = decisionOf(decisions, service)
      if (service.kind.kind === 'singleChoice') {
        return decision.state === 'selected' && Boolean(currentVariantOf(service, decision)?.excludesPosition)
      }
      return service.kind.kind !== 'readOnlyRequired' && decision.state === 'notSelected'
        && Boolean(service.excludedPhraseDe)
    })
    return excluding ? excludedPhraseOf(excluding) : undefined
  }

  const commercialOf = (progress: ReturnType<typeof kgSystemProgress>, serviceGroup: KgServiceGroup) => {
    if (progress.state === 'notApplicable') return `— ${t('vr3.tga.notApplicable')}`
    if (progress.amount === null && progress.openDecisions === 0) {
      const excluded = excludedPhraseOfSystem(serviceGroup)
      if (excluded) return excluded
    }
    /** A ZERO SUM IS NOT A PRICE (rule 16): the cost STATE is the honest answer. */
    if (progress.amount !== null && !progress.amount.isZero() && progress.costAuthority === 'direct') {
      return (
        <CommercialNumber
          exact={progress.amount}
          language={s.uiLanguage}
          emphasis="compact"
          absentLabel={t('vr3.tga.price.noBasis')}
        />
      )
    }
    if (progress.costAuthority === 'bauherr') return t('vr3.tga.price.bauherr')
    if (progress.costAuthority === 'bundle') return t('vr3.tga.price.bundle')
    if (progress.costAuthority === 'indirect') return t('vr3.tga.price.indirect')
    if (progress.costAuthority === 'direct') return t('vr3.tga.price.direct')
    return t('vr3.tga.price.noBasis')
  }

  const renderSystem = (serviceGroup: KgServiceGroup) => {
    const progress = kgSystemProgress(catalogue, decisions, serviceGroup)
    const name = label(serviceGroup.labelDe, serviceGroup.labelEn)
    const pict = kgSystemPictogram(serviceGroup)
    const pictogram = pict
      ? <img src={pict.src} alt="" width={pict.width} height={pict.height} />
      : null
    const expanded = openSystem === serviceGroup.id
    const services = systemServices(serviceGroup)

    if (progress.state === 'notApplicable') {
      const reason = label(serviceGroup.applicability?.reasonDe, serviceGroup.applicability?.reasonEn)
      const [first, ...rest] = reason.split(' · ')
      return (
        <SystemRow
          key={serviceGroup.id}
          id={serviceGroup.id}
          name={name}
          pictogram={pictogram}
          solution={{ primary: t('vr3.tga.system.state.notApplicable'), secondary: [first, ...rest].join(' · ') || undefined }}
          state="notApplicable"
          stateLabel={t('vr3.tga.system.state.notApplicable')}
          stateGlyph={STATE_GLYPH.notApplicable}
          commercial={null}
          expanded={false}
          onToggle={() => {}}
          notApplicable={{
            whyLabel: t('vr3.tga.system.why'),
            reason,
            open: naOpen === serviceGroup.id,
            onToggle: () => setNaOpen(naOpen === serviceGroup.id ? null : serviceGroup.id),
          }}
        />
      )
    }

    const deviating = progress.state === 'decided' && progress.changedFromSource > 0
    const stateKey: KgSystemState | 'changed' = deviating ? 'changed' : progress.state
    const stateLabel = progress.state === 'open'
      ? (progress.openDecisions === 1
        ? t('vr3.tga.system.state.open', { count: progress.openDecisions })
        : t('vr3.tga.system.state.openPlural', { count: progress.openDecisions }))
      : t(`vr3.tga.system.state.${stateKey}`)
    const solution = solutionOf(serviceGroup)
    const scope = label(
      systemNarrative(catalogue, decisions, serviceGroup).scopeDe,
      systemNarrative(catalogue, decisions, serviceGroup).scopeEn,
    )
    const excludedText = progress.amount === null && progress.openDecisions === 0
      ? excludedPhraseOfSystem(serviceGroup) : undefined
    const commercialText = progress.amount !== null && !progress.amount.isZero()
      && progress.costAuthority === 'direct'
      ? money(progress.amount, s.uiLanguage)
      : excludedText ? excludedText
      : progress.costAuthority === 'bundle' ? t('vr3.tga.price.bundle')
        : progress.costAuthority === 'bauherr' ? t('vr3.tga.price.bauherr')
          : progress.costAuthority === 'indirect' ? t('vr3.tga.price.indirect')
            : progress.costAuthority === 'direct' ? t('vr3.tga.price.direct')
              : t('vr3.tga.price.noBasis')

    return (
      <SystemRow
        key={serviceGroup.id}
        id={serviceGroup.id}
        name={name}
        pictogram={pictogram}
        solution={solution}
        state={progress.state}
        stateLabel={stateLabel}
        stateGlyph={STATE_GLYPH[stateKey]}
        attention={progress.state === 'open' ? 'open' : deviating ? 'deviation' : null}
        commercial={commercialOf(progress, serviceGroup)}
        expanded={expanded}
        onToggle={() => {
          if (!expanded && draft) { s.previewOption(null); setDraft(null) }
          setOpenSystem(expanded ? null : serviceGroup.id)
        }}
      >
        <motion.div
          variants={reduced ? undefined : fadeRise}
          initial={reduced ? false : 'hidden'}
          animate={reduced ? undefined : 'visible'}
          transition={transition('reveal')}
        >
          <SystemDetailHeader
            heading={t('vr3.tga.system.proposalHeading', { system: name })}
            summary={[solution.primary, solution.secondary].filter(Boolean).join(' · ')}
            badges={[scope, commercialText].filter((x): x is string => Boolean(x))}
          />
          <ul className="a3-decs">
            {services.map((service) => renderDecision(service))}
          </ul>
        </motion.div>
      </SystemRow>
    )
  }

  /* ── the summary facts ──────────────────────────────────────────────── */

  const facts: Array<{ id: string; count: number; label: string; tone?: SummaryTone }> = [
    { id: 'systems', count: visible.groups.length, label: t('vr3.tga.summary.systems') },
    { id: 'decided', count: overview.decided, label: t('vr3.tga.summary.decided'), tone: 'ok' as SummaryTone },
    { id: 'source', count: overview.fromSource, label: t('vr3.tga.summary.fromSource'), tone: 'quiet' as SummaryTone },
    { id: 'changed', count: overview.proposalChanges, label: t('vr3.tga.summary.changed'), tone: 'warn' as SummaryTone },
    { id: 'open', count: overview.open, label: t('vr3.tga.summary.open'), tone: 'warn' as SummaryTone },
    { id: 'partial', count: overview.partial, label: t('vr3.tga.summary.partial') },
    { id: 'na', count: overview.notApplicable, label: t('vr3.tga.summary.notApplicable'), tone: 'quiet' as SummaryTone },
    // A fact worth zero is not a fact — printing "0 offen" states work that
    // does not exist. The systems count is the one line that always prints.
  ].filter((fact) => fact.count > 0 || fact.id === 'systems')

  /* ── the page ───────────────────────────────────────────────────────── */

  return (
    <>
      <RahmenBand entries={bandEntries}>
        <AnimatePresence initial={false}>
          {openRahmenService && (
            <motion.ul
              key={openRahmenService.id}
              className="a3-decs a3-rahmen-open"
              variants={reduced ? undefined : fadeRise}
              initial={reduced ? false : 'hidden'}
              animate={reduced ? undefined : 'visible'}
              exit={reduced ? undefined : 'exit'}
              transition={transition('reveal')}
            >
              {renderDecision(openRahmenService, {
                basis: label(openRahmen?.basisDe, openRahmen?.basisEn) || undefined,
                inRahmen: true,
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </RahmenBand>

      <SystemOverviewSummary
        facts={facts}
        total={overview.amount === null
          ? t('vr3.tga.summary.noTotal', { group: identity })
          : t('vr3.tga.summary.total', {
            group: identity,
            amount: money(overview.amount, s.uiLanguage),
          })}
      />

      <div className="a3-systems">
        {visible.groups.map(renderSystem)}
      </div>

      {chapter.bemusterung && (
        <BemusterungBoundary
          detail={{
            label: bemOpen ? t('vr3.tga.rahmen.close') : t('vr3.tga.bemusterung.detail'),
            open: bemOpen,
            onToggle: () => setBemOpen(!bemOpen),
          }}
          title={label(chapter.bemusterung.titleDe, chapter.bemusterung.titleEn)}
          body={label(chapter.bemusterung.bodyDe, chapter.bemusterung.bodyEn)}
          decidedHeading={label(
            chapter.bemusterung.decidedHeadingDe, chapter.bemusterung.decidedHeadingEn,
          )}
          deferredHeading={label(
            chapter.bemusterung.deferredHeadingDe, chapter.bemusterung.deferredHeadingEn,
          )}
          rows={chapter.bemusterung.rows.map((row) => ({
            decided: label(row.decidedDe, row.decidedEn),
            deferred: label(row.deferredDe, row.deferredEn),
          }))}
        />
      )}

      <p className="sr-only" aria-live="polite" id={liveId}>
        {announcement
          ? t(announcement.key, {
            decision: announcement.service
              ? label(announcement.service.labelDe, announcement.service.labelEn) : '',
            count: announcement.count,
            name: announcement.name ?? '',
          })
          : ''}
      </p>

      {/* THE CONSEQUENCE DIALOGUE — what changes, before it changes. */}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (open) return
          const id = pendingDecision.current
          pendingDecision.current = null
          setPending(null)
          // A belt for `Dialog`'s braces: if the node it captured did not
          // survive the re-render, focus would land on `<body>`.
          if (id) setTimeout(() => {
            if (document.activeElement === document.body) focusDecision(id)
          }, 260)
        }}
        labelledBy={dialogTitleId}
        returnFocusTo={returnFocusRef}
      >
        {pending && (
          <div className="a3-conseq">
            <h2 id={dialogTitleId} tabIndex={-1}>
              {t('vr3.tga.cascade.title', {
                decision: label(pending.service.labelDe, pending.service.labelEn),
              })}
            </h2>
            <p className="a3-conseq-lbl">{t('vr3.tga.cascade.affected')}</p>
            {pending.cascade.entries.map((entry) => (
              <div
                className="a3-conseq-row"
                key={entry.service.id}
                data-effect={entry.effect}
              >
                <span className="a3-conseq-k">
                  <b>{`KG${NNBSP}${entry.group.slice(3)}`}</b>
                  {label(entry.service.labelDe, entry.service.labelEn)}
                </span>
                <span className="a3-conseq-v">
                  <b>{t(`vr3.tga.cascade.${entry.effect}`)}</b>
                  {entry.effect === 'preserve'
                    ? t('vr3.tga.cascade.preserveWhy')
                    : t(`vr3.tga.cascade.${entry.effect}Why`, {
                      price: entry.currentAmount === null
                        ? t('vr3.tga.price.noBasis')
                        : money(entry.currentAmount, s.uiLanguage),
                    })}
                </span>
              </div>
            ))}
            <div className="a3-conseq-acts">
              <Button
                variant="primary"
                onClick={() => {
                  const { service, next, cascade } = pending
                  setPending(null)
                  apply(service, next, cascade)
                }}
              >
                {t('vr3.tga.cascade.confirm', {
                  decision: label(pending.service.labelDe, pending.service.labelEn),
                })}
              </Button>
              <Button onClick={() => setPending(null)}>
                {t('vr3.tga.cascade.cancel')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}

/**
 * The quantity of a quantity decision, as a DRAFT field inside the editor.
 *
 * The raw text is held, not a parsed number, so an invalid entry is shown
 * back and blocks Apply — the commercial result never sees it until the
 * user commits a valid one.
 */
function QuantityDraft({ service, value, onChange }: {
  service: KgService
  value: string
  onChange: (quantity: string) => void
}) {
  const t = useT()
  const s = useStore()
  const id = useId()
  if (service.kind.kind !== 'quantity') return null
  const problem = quantityProblem(service, value)
  const unit = s.uiLanguage === 'en' ? service.kind.unitEn : service.kind.unitDe
  return (
    <FormField
      label={t('vr3.kg.service.quantityLabel', { unit })}
      htmlFor={id}
      helperText={t('vr3.kg.service.quantityHelper', {
        unitAmount: service.kind.unitAmount, unit,
      })}
      error={problem ? t(`vr3.kg.service.quantity.${problem}`) : undefined}
    >
      <input
        id={id}
        className="a3-input"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  )
}
