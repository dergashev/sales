import type { SchedulePhaseEdit } from './optionSchedule'
import type {
  KgCatalogue, KgDecisions, KgScopeGroup, KgServiceDecisionRecord,
} from '../engine/kgConfiguration'
import { serviceById, serviceDecision } from '../engine/kgConfiguration'

/**
 * VR3-05 — the CLIENT PRESENTATION SCENARIO: a temporary what-if branch of
 * exactly one saved Option.
 *
 * ## Why this module exists at all
 *
 * A presenter in front of a client must be able to ask "and what if we did
 * it the other way?" and get a real number back. The number has to be real —
 * the same canonical calculator the Konfigurator and the Commercial Rail use
 * — and the saved Option has to remain exactly as saved, because it is the
 * client's baseline (M-3) and the internal working state at the same time.
 *
 * Those two requirements decide the whole design:
 *
 *   SCENARIO = ONE `sourceOptionId` + A SERIALISABLE CHANGE SET
 *
 * and nothing else. There is no second copy of the configuration living in
 * the store, no draft Option, no "presentation overrides" written onto the
 * Option's own fields. A scenario is a LIST OF CHANGES, and the scenario's
 * numbers are derived by applying that list to a COPY of the source config
 * and running the canonical derivation over the copy (`store.ts`,
 * `clientScenarioSnapshot`).
 *
 * The consequence is the invariant the ticket asks for, for free rather than
 * by discipline: *the saved baseline is byte-equivalent before and after
 * unsaved scenario editing*, because unsaved scenario editing never writes
 * to it. And *revert produces zero delta and the original exact result*,
 * because reverting is `changes = []` and the derivation over a config with
 * no changes applied IS the baseline derivation, the same code on the same
 * input.
 *
 * The alternative — mutate the Option, remember the old values, restore them
 * on revert — was rejected for the reason the VR3-03R remediation recorded
 * one ticket earlier: *a rule that lives in each action's memory is a rule
 * the next action forgets*. A restore-list has to be correct at every exit
 * (revert, exit-to-preparation, mode switch, option switch, reload, a
 * calculation failure mid-edit); a change-list has nothing to restore.
 *
 * ## Why the decisions are catalogue rows and not new prices
 *
 * Every supported what-if in `PRESENTATION_DECISIONS` points at a service or
 * a schedule phase THAT ALREADY EXISTS in the project's canonical fixture.
 * `b-400-heat` is a `singleChoice` whose `perBuilding` variant carries
 * `-310000.00`; `b-400-92` is a 420.000 € service the fixture leaves
 * unselected because the project's own open question B-Q-01 says the
 * retail-only reading is the baseline. This module therefore invents no
 * pricing semantics whatsoever — it declares WHICH canonical decisions are
 * client-readable, and the delta is whatever the canonical calculator says
 * it is. A hard-coded `+420.000` here would have been a second source of
 * truth about a number the catalogue already owns, which is the defect class
 * `src/state/catalog.ts` was written to close.
 *
 * ## What a decision may NOT be
 *
 * Not the internal Konfigurator with a dark theme on it. The allowlist is
 * deliberately short and each entry is a question a client can answer in a
 * meeting. A decision that needs the internal service ledger to be
 * understood does not belong here; it belongs in preparation.
 */

/* ─────────────────────────────── changes ─────────────────────────────── */

/**
 * One recorded what-if, addressed by the decision that produced it.
 *
 * `decisionId` is the IDENTITY of the change, not a label: choosing a second
 * value on the same decision REPLACES the first rather than stacking, so the
 * change count is the number of decisions the presenter moved away from the
 * baseline and never a click count. Every field is a plain string or boolean
 * — the change set is serialisable by construction, which is what lets the
 * same list describe the scenario, the export's authority statement and the
 * new Option's configuration.
 */
export type ScenarioChange =
  | Readonly<{
    decisionId: string
    kind: 'serviceVariant'
    serviceId: string
    variant: string
  }>
  | Readonly<{
    decisionId: string
    kind: 'serviceSelection'
    serviceId: string
    selected: boolean
  }>
  | Readonly<{
    decisionId: string
    kind: 'phaseDependency'
    phaseId: string
    dependsOn: string
  }>

/**
 * The presentation scenario itself.
 *
 * `sourceOptionId` is singular on purpose (the ticket's numerical invariant:
 * "derived from exactly one saved `sourceOptionId`"). A scenario that could
 * straddle two Options would have no baseline to be a delta against and no
 * single Option to save as a descendant of.
 */
export type ClientScenario = Readonly<{
  sourceOptionId: string
  changes: readonly ScenarioChange[]
}>

export function emptyScenario(sourceOptionId: string): ClientScenario {
  return { sourceOptionId, changes: [] }
}

export function scenarioIsBaseline(scenario: ClientScenario | null): boolean {
  return !scenario || scenario.changes.length === 0
}

export function scenarioChangeCount(scenario: ClientScenario | null): number {
  return scenario ? scenario.changes.length : 0
}

/* ────────────────────────────── decisions ────────────────────────────── */

/** The narrative section a decision is asked in. */
export type PresentationSectionId =
  | 'project' | 'buildings' | 'scope' | 'services' | 'schedule' | 'investment'

export type PresentationDecisionOption = Readonly<{
  /** Stable, locale-free identity — used in the DOM, the change set and tests. */
  value: string
  labelKey: string
}>

/**
 * How a decision reads its current value out of a configuration and writes a
 * change back into one.
 *
 * The maps are `value → catalogue address` rather than the other way round
 * so that the option list stays the single declaration of what may be
 * chosen: a value with no entry here cannot be applied, which makes an
 * unsupported change unrepresentable rather than merely unused.
 */
export type PresentationDecisionTarget =
  | Readonly<{
    kind: 'serviceVariant'
    serviceId: string
    /** Decision value → the catalogue variant it selects. */
    variantOf: Readonly<Record<string, string>>
  }>
  | Readonly<{
    kind: 'serviceSelection'
    serviceId: string
    /** The decision value that means "this service is selected". */
    selectedValue: string
    /** The decision value that means "this service is not selected". */
    unselectedValue: string
  }>
  | Readonly<{
    kind: 'phaseDependency'
    phaseId: string
    /** Decision value → the phase id the handover then waits for. */
    dependsOnOf: Readonly<Record<string, string>>
  }>

export type PresentationDecision = Readonly<{
  id: string
  section: PresentationSectionId
  titleKey: string
  options: readonly PresentationDecisionOption[]
  /** The client-readable consequence of the CHOSEN value, by value. */
  consequenceKeyOf: Readonly<Record<string, string>>
  /**
   * The cost group whose INCLUSION this decision presupposes.
   *
   * A what-if about heating cannot be offered when the Option excluded
   * KG 400 — the alternative would price nothing and the narrative would
   * assert a choice the scope already answered. `null` for decisions that
   * do not depend on a cost group.
   */
  requiresGroup: KgScopeGroup | null
  /**
   * A documented open question this decision leaves unresolved.
   *
   * Present only where the project's own fixture records one (B-Q-08 for the
   * handover). It is what turns the phased-handover scenario into a scenario
   * WITH A WARNING rather than a silent re-plan — the warning is the
   * project's question, quoted, not a rule this module invented.
   */
  openQuestionId: string | null
  target: PresentationDecisionTarget
}>

/**
 * The supported what-ifs, per project catalogue.
 *
 * Keyed by `KgCatalogue.projectId` because a decision is only meaningful
 * against the catalogue that contains its service: `b-400-heat` does not
 * exist in project A, and offering project B's questions on project A would
 * be an empty control with a client watching.
 */
const PRESENTATION_DECISIONS: Readonly<Record<string, readonly PresentationDecision[]>> = {
  'DEMO-HAPPY-01': [
    {
      id: 'energyStandard',
      section: 'services',
      titleKey: 'vr3.client.decision.energyStandard.title',
      options: [
        { value: 'eh55', labelKey: 'vr3.client.decision.energyStandard.eh55' },
        { value: 'eh40', labelKey: 'vr3.client.decision.energyStandard.eh40' },
        { value: 'eh40nh', labelKey: 'vr3.client.decision.energyStandard.eh40nh' },
      ],
      consequenceKeyOf: {
        eh55: 'vr3.client.decision.energyStandard.consequence.eh55',
        eh40: 'vr3.client.decision.energyStandard.consequence.eh40',
        eh40nh: 'vr3.client.decision.energyStandard.consequence.eh40nh',
      },
      requiresGroup: 'KG_400',
      openQuestionId: null,
      target: {
        kind: 'serviceVariant',
        serviceId: 'a-400-es',
        variantOf: { eh55: 'eh55', eh40: 'eh40', eh40nh: 'eh40nh' },
      },
    },
    {
      id: 'photovoltaics',
      section: 'services',
      titleKey: 'vr3.client.decision.photovoltaics.title',
      options: [
        { value: 'without', labelKey: 'vr3.client.decision.photovoltaics.without' },
        { value: 'with', labelKey: 'vr3.client.decision.photovoltaics.with' },
      ],
      consequenceKeyOf: {
        without: 'vr3.client.decision.photovoltaics.consequence.without',
        with: 'vr3.client.decision.photovoltaics.consequence.with',
      },
      requiresGroup: 'KG_400',
      openQuestionId: null,
      target: {
        kind: 'serviceSelection',
        serviceId: 'a-400-90',
        selectedValue: 'with',
        unselectedValue: 'without',
      },
    },
  ],
  'DEMO-COMPLEX-01': [
    {
      id: 'heatStrategy',
      section: 'services',
      titleKey: 'vr3.client.decision.heatStrategy.title',
      options: [
        { value: 'central', labelKey: 'vr3.client.decision.heatStrategy.central' },
        { value: 'perBuilding', labelKey: 'vr3.client.decision.heatStrategy.perBuilding' },
      ],
      consequenceKeyOf: {
        central: 'vr3.client.decision.heatStrategy.consequence.central',
        perBuilding: 'vr3.client.decision.heatStrategy.consequence.perBuilding',
      },
      requiresGroup: 'KG_400',
      openQuestionId: null,
      target: {
        kind: 'serviceVariant',
        serviceId: 'b-400-heat',
        variantOf: { central: 'central', perBuilding: 'perBuilding' },
      },
    },
    {
      id: 'gastronomyReadiness',
      section: 'services',
      titleKey: 'vr3.client.decision.gastronomy.title',
      options: [
        { value: 'retailOnly', labelKey: 'vr3.client.decision.gastronomy.retailOnly' },
        { value: 'gastronomyReady', labelKey: 'vr3.client.decision.gastronomy.ready' },
      ],
      consequenceKeyOf: {
        retailOnly: 'vr3.client.decision.gastronomy.consequence.retailOnly',
        gastronomyReady: 'vr3.client.decision.gastronomy.consequence.ready',
      },
      requiresGroup: 'KG_400',
      openQuestionId: null,
      target: {
        kind: 'serviceSelection',
        serviceId: 'b-400-92',
        selectedValue: 'gastronomyReady',
        unselectedValue: 'retailOnly',
      },
    },
    {
      id: 'handoverSequence',
      section: 'schedule',
      titleKey: 'vr3.client.decision.handover.title',
      options: [
        { value: 'single', labelKey: 'vr3.client.decision.handover.single' },
        { value: 'phased', labelKey: 'vr3.client.decision.handover.phased' },
      ],
      consequenceKeyOf: {
        single: 'vr3.client.decision.handover.consequence.single',
        phased: 'vr3.client.decision.handover.consequence.phased',
      },
      requiresGroup: null,
      // B-Q-08 — "single or phased handover?" — is OPEN in the project's own
      // fixture. Choosing `phased` does not answer it; it plans against an
      // unanswered question, and the presentation says so.
      openQuestionId: 'B-Q-08',
      target: {
        kind: 'phaseDependency',
        phaseId: 'handover',
        dependsOnOf: {
          single: 'execution:B-BLDG-C',
          phased: 'execution:B-BLDG-A',
        },
      },
    },
  ],
}

/** Every declared decision of a catalogue, before availability is applied. */
export function declaredPresentationDecisions(
  catalogue: KgCatalogue | null,
): readonly PresentationDecision[] {
  if (!catalogue) return []
  return PRESENTATION_DECISIONS[catalogue.projectId] ?? []
}

/* ─────────────────────────── reading a config ────────────────────────── */

/**
 * The structural slice of an Option a scenario may touch.
 *
 * Structural rather than `Pick<OptionConfig, …>` so this module does not
 * import the store: the store imports it, and the dependency has to point
 * one way. The two fields are the whole surface — a scenario cannot reach
 * building scope, pricing mode, discount or the review, and the type is
 * where that boundary is enforced rather than a comment.
 */
export type ScenarioConfigSlice = {
  kgConfig: KgDecisions | null
  scheduleEdits: Readonly<Record<string, SchedulePhaseEdit>>
  schedulePhases: readonly { id: string; dependsOn: string | null }[]
}

/**
 * The value a decision currently has in a configuration, or `null` when the
 * configuration cannot express it (no catalogue, service absent, phase gone).
 *
 * `null` is a real answer and the caller renders the decision as unavailable
 * rather than guessing a default — the same rule `projectAsset` follows for a
 * missing asset.
 */
export function decisionValueIn(
  decision: PresentationDecision,
  config: ScenarioConfigSlice,
  catalogue: KgCatalogue | null,
): string | null {
  const target = decision.target
  if (target.kind === 'phaseDependency') {
    const phase = config.schedulePhases.find((p) => p.id === target.phaseId)
    if (!phase) return null
    const edit = config.scheduleEdits[target.phaseId]
    const dependsOn = edit && 'dependsOn' in edit ? edit.dependsOn ?? null : phase.dependsOn
    const hit = Object.entries(target.dependsOnOf)
      .find(([, phaseId]) => phaseId === dependsOn)
    return hit ? hit[0] : null
  }
  if (!catalogue || !config.kgConfig) return null
  const service = serviceById(catalogue, target.serviceId)
  if (!service) return null
  const record = serviceDecision(config.kgConfig, service)
  if (target.kind === 'serviceSelection') {
    if (record.state === 'undecided') return null
    return record.state === 'selected' ? target.selectedValue : target.unselectedValue
  }
  const variant = record.variant
    ?? (service.kind.kind === 'singleChoice' ? service.kind.baselineVariant : null)
  if (!variant) return null
  const hit = Object.entries(target.variantOf).find(([, v]) => v === variant)
  return hit ? hit[0] : null
}

/**
 * The decisions this Option can actually be asked, in narrative order.
 *
 * A decision survives when its cost group is INCLUDED and its current value
 * is readable. Both filters are about honesty rather than tidiness: an
 * excluded KG makes the alternative price nothing, and an unreadable value
 * would render a control with no selected option in front of a client.
 */
export function availablePresentationDecisions(
  catalogue: KgCatalogue | null,
  config: ScenarioConfigSlice,
): readonly PresentationDecision[] {
  return declaredPresentationDecisions(catalogue).filter((decision) => {
    if (decision.requiresGroup) {
      const scope = config.kgConfig?.scope[decision.requiresGroup]
      if (scope !== 'included') return false
    }
    return decisionValueIn(decision, config, catalogue) !== null
  })
}

/* ─────────────────────────── writing a change ────────────────────────── */

function changeFor(
  decision: PresentationDecision, value: string,
): ScenarioChange | null {
  const target = decision.target
  if (target.kind === 'serviceVariant') {
    const variant = target.variantOf[value]
    return variant
      ? { decisionId: decision.id, kind: 'serviceVariant', serviceId: target.serviceId, variant }
      : null
  }
  if (target.kind === 'serviceSelection') {
    if (value !== target.selectedValue && value !== target.unselectedValue) return null
    return {
      decisionId: decision.id,
      kind: 'serviceSelection',
      serviceId: target.serviceId,
      selected: value === target.selectedValue,
    }
  }
  const dependsOn = target.dependsOnOf[value]
  return dependsOn
    ? { decisionId: decision.id, kind: 'phaseDependency', phaseId: target.phaseId, dependsOn }
    : null
}

/**
 * The change set after the presenter chooses `value` on `decision`.
 *
 * Choosing the BASELINE value removes the decision's change rather than
 * recording a change back to where we started. That is what makes "number of
 * changes" mean *how far this scenario is from the saved Option* — the
 * quantity the scenario bar shows and the revert dialog counts — instead of
 * how many times somebody pressed something. It also makes hand-reverting
 * one decision produce the exact baseline result, by the same argument that
 * makes `revert` produce it: an empty change list is not a restored state,
 * it is the absence of a scenario.
 */
export function withDecision(
  scenario: ClientScenario,
  decision: PresentationDecision,
  value: string,
  baseline: ScenarioConfigSlice,
  catalogue: KgCatalogue | null,
): ClientScenario {
  const without = scenario.changes.filter((c) => c.decisionId !== decision.id)
  if (value === decisionValueIn(decision, baseline, catalogue)) {
    return { ...scenario, changes: without }
  }
  const change = changeFor(decision, value)
  if (!change) return scenario
  return { ...scenario, changes: [...without, change] }
}

/** The value a decision holds in the scenario: its change, else the baseline. */
export function scenarioDecisionValue(
  scenario: ClientScenario | null,
  decision: PresentationDecision,
  baseline: ScenarioConfigSlice,
  catalogue: KgCatalogue | null,
): string | null {
  const change = scenario?.changes.find((c) => c.decisionId === decision.id)
  if (!change) return decisionValueIn(decision, baseline, catalogue)
  const target = decision.target
  if (change.kind === 'serviceVariant' && target.kind === 'serviceVariant') {
    const hit = Object.entries(target.variantOf).find(([, v]) => v === change.variant)
    return hit ? hit[0] : null
  }
  if (change.kind === 'serviceSelection' && target.kind === 'serviceSelection') {
    return change.selected ? target.selectedValue : target.unselectedValue
  }
  if (change.kind === 'phaseDependency' && target.kind === 'phaseDependency') {
    const hit = Object.entries(target.dependsOnOf)
      .find(([, phaseId]) => phaseId === change.dependsOn)
    return hit ? hit[0] : null
  }
  return null
}

/* ──────────────────────────── applying them ──────────────────────────── */

/**
 * A COPY of `config` with the scenario's changes applied.
 *
 * Pure and total: it never mutates its argument, and a change naming a
 * service the catalogue does not have is dropped rather than written as a
 * decision record for a service that does not exist. The result is a plain
 * configuration — the canonical derivation cannot tell it apart from a saved
 * one, which is precisely the requirement ("every scenario result uses the
 * same canonical calculator and result model").
 */
export function applyScenarioChanges<C extends ScenarioConfigSlice>(
  config: C,
  changes: readonly ScenarioChange[],
  catalogue: KgCatalogue | null,
): C {
  if (changes.length === 0) return config
  let services: Record<string, KgServiceDecisionRecord> | null = null
  let edits: Record<string, SchedulePhaseEdit> | null = null
  for (const change of changes) {
    if (change.kind === 'phaseDependency') {
      if (!config.schedulePhases.some((p) => p.id === change.phaseId)) continue
      edits = edits ?? { ...config.scheduleEdits }
      edits[change.phaseId] = { ...edits[change.phaseId], dependsOn: change.dependsOn }
      continue
    }
    if (!config.kgConfig || !catalogue) continue
    const service = serviceById(catalogue, change.serviceId)
    if (!service) continue
    services = services ?? { ...config.kgConfig.services }
    const previous = services[change.serviceId] ?? serviceDecision(config.kgConfig, service)
    services[change.serviceId] = change.kind === 'serviceVariant'
      // A variant choice does not decide INCLUSION: a `singleChoice` service
      // that the Option left unselected stays unselected, and the variant is
      // recorded for when it is not. Forcing `selected` here would let a
      // what-if about HOW something is done silently answer WHETHER it is.
      ? { ...previous, variant: change.variant }
      : { ...previous, state: change.selected ? 'selected' : 'notSelected' }
  }
  if (!services && !edits) return config
  return {
    ...config,
    ...(services && config.kgConfig
      ? { kgConfig: { ...config.kgConfig, services } }
      : {}),
    ...(edits ? { scheduleEdits: edits } : {}),
  }
}

/**
 * The open questions this scenario leaves unanswered, by decision.
 *
 * Only for decisions the scenario actually moved: the baseline's own
 * relationship to B-Q-08 is the Option's business and was settled when it was
 * saved. A scenario that re-plans against an open question has to say so
 * (the ticket's "phased-handover scenario with warning"), and this is where
 * the presentation learns which warning to show.
 */
export function scenarioOpenQuestions(
  scenario: ClientScenario | null,
  decisions: readonly PresentationDecision[],
): readonly PresentationDecision[] {
  if (!scenario) return []
  return decisions.filter((d) => d.openQuestionId !== null
    && scenario.changes.some((c) => c.decisionId === d.id))
}
