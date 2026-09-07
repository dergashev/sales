import type { CostGroup, Coverage } from '../engine/calculate'
import {
  isVisibleInOutputProfile,
  type OutputMode,
  type ProjectionVisibility,
} from './clientProjection'

/**
 * Semantic identities for the Configurator workflow.
 *
 * A step's displayed number is always derived from its position in the active
 * workflow. These identities, rather than historical chapter numbers, are the
 * authority used by navigation, rendering, completion, focus and persistence.
 */
export const CONFIGURATOR_STEP = {
  SCOPE_BOUNDARIES: 'scopeBoundaries',
  KG_200_DETAILS: 'kg200Details',
  KG_300_DETAILS: 'kg300Details',
  KG_400_DETAILS: 'kg400Details',
  KG_500_DETAILS: 'kg500Details',
  KG_600_DETAILS: 'kg600Details',
  ENERGY_CERTIFICATION: 'energyCertification',
  AREAS: 'areas',
  KG_700_DETAILS: 'kg700Details',
  KG_800_DETAILS: 'kg800Details',
  /**
   * VR3-TGA-UX-00 — `Schnittstellen & Verantwortung`, a dedicated step
   * between the last cost group and the schedule. It is NOT a cost group:
   * it carries the Option's interface/responsibility truth (scope boundary,
   * handover point, four utility media), which used to be misclassified as
   * the eighth "system" of KG 400. Language-independent identity; the
   * translated label is a dictionary key and the URL slug is `verantwortung`.
   */
  RESPONSIBILITY: 'responsibility',
  COMMERCIAL_SCHEDULE: 'commercialSchedule',
  FINAL_VALIDATION: 'finalValidation',
} as const

export type ConfiguratorStepId =
  typeof CONFIGURATOR_STEP[keyof typeof CONFIGURATOR_STEP]

export type ConfiguratorStepScope = 'project' | 'building'

type StepApplicability =
  | { kind: 'required' }
  | { kind: 'includedKg'; group: CostGroup }

export type ConfiguratorStep = Readonly<{
  id: ConfiguratorStepId
  label: string
  scope: ConfiguratorStepScope
  visibility: ProjectionVisibility
  applicability: StepApplicability
}>

export type ConfiguratorWorkflowContext = Readonly<{
  coverage: Coverage
  mode: OutputMode
}>

/**
 * The only ordered Configurator registry.
 *
 * KG 200/300/400/500/600/700/800 chapters are conditional on the active
 * Option's explicit Scope Boundaries decisions and follow DIN 276 order
 * among themselves. `commercial/schedule` is the only required non-KG
 * configuration area and keeps its established position after the KG
 * chapters.
 *
 * KG 200/500/600 (ticket "MAKE ALL KG 200–800 SELECTABLE & ADD COST-BEARING
 * CONTENT…") reuse this exact mechanism instead of a parallel navigation
 * model. `scope: 'project'` (matching KG 700's own precedent): none of
 * their quantity drivers has a genuine per-building home in the existing
 * data model — site preparation, external works and equipment are
 * configured once for the whole complex, not duplicated per building tab.
 *
 * Ticket "Rebuild Project Card Workflow" removes three former steps from
 * this registry, superseding the sources named in each case:
 * - `ENERGY_CERTIFICATION` ("Energie & Zertifikate", Task 03) — its
 *   editable content (Energiestandard/QNG/DGNB + customer confirmation)
 *   moved into `ChapterUmfang` (Scope Boundaries); there is now exactly
 *   one editable location instead of two.
 * - `AREAS` ("Flächen im Detail", Task 02) — Building Scope remains the
 *   authoritative editing location for building area values; a mandatory
 *   Configurator step duplicating that is no longer required.
 * - `KG_800_DETAILS` ("Finanzierung KG 800", ticket "MAKE ALL KG 200–800
 *   SELECTABLE…") — KG 800 is no longer a supported commercial group in
 *   this workflow. `coverage.KG_800` is permanently forced to `excluded`
 *   (`store.ts`'s `migrateCoverage`/`setCoverage`), so this step is
 *   structurally unreachable even before its removal here; removing the
 *   entry also stops it appearing in any all-steps enumeration.
 *
 * The `CONFIGURATOR_STEP` identities for the three removed steps are kept
 * (a `ConfiguratorStepId` union member, not a removed export) purely so
 * `stepIdFromLegacyChapter` below still type-checks against historical
 * persisted numeric chapter references; they no longer appear in
 * `CONFIGURATOR_STEPS` and must never be reintroduced there.
 */
export const CONFIGURATOR_STEPS: readonly ConfiguratorStep[] = [
  {
    id: CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
    label: 'Leistungsabgrenzung',
    scope: 'project',
    visibility: 'clientSafe',
    applicability: { kind: 'required' },
  },
  {
    id: CONFIGURATOR_STEP.KG_200_DETAILS,
    label: 'Vorbereitende Maßnahmen KG 200',
    scope: 'project',
    visibility: 'clientSafe',
    applicability: { kind: 'includedKg', group: 'KG_200' },
  },
  {
    id: CONFIGURATOR_STEP.KG_300_DETAILS,
    label: 'Leistungen KG 300',
    // VR3-03: project-scoped, like the other five. The approved target
    // composes building ownership INTO the service row (each service names
    // its building) and into the page's context panel; a per-building tab
    // strip over six identical pages would be the second navigation grammar
    // this ticket removes. Rule 38 is satisfied by the row, not by tabs.
    scope: 'project',
    visibility: 'clientSafe',
    applicability: { kind: 'includedKg', group: 'KG_300' },
  },
  {
    id: CONFIGURATOR_STEP.KG_400_DETAILS,
    label: 'Technik KG 400',
    scope: 'project',
    visibility: 'clientSafe',
    applicability: { kind: 'includedKg', group: 'KG_400' },
  },
  {
    id: CONFIGURATOR_STEP.KG_500_DETAILS,
    label: 'Außenanlagen KG 500',
    scope: 'project',
    visibility: 'clientSafe',
    applicability: { kind: 'includedKg', group: 'KG_500' },
  },
  {
    id: CONFIGURATOR_STEP.KG_600_DETAILS,
    label: 'Ausstattung KG 600',
    scope: 'project',
    visibility: 'clientSafe',
    applicability: { kind: 'includedKg', group: 'KG_600' },
  },
  {
    id: CONFIGURATOR_STEP.KG_700_DETAILS,
    label: 'Baunebenkosten KG 700',
    scope: 'project',
    visibility: 'internalOnly',
    applicability: { kind: 'includedKg', group: 'KG_700' },
  },
  {
    /**
     * VR3-TGA-UX-00 — the interim Responsibility Matrix step. Position is
     * final (after KG 700, before the schedule); the composition is the
     * INTERIM / STRUCTURAL TARGET, not the final matrix design, which is a
     * future user-led target. `required` because every Option has a scope
     * boundary; `clientSafe` because the boundary and the house connections
     * are exactly the interface facts a client offer states. It gates
     * nothing: the schedule keeps its own released prerequisite.
     */
    id: CONFIGURATOR_STEP.RESPONSIBILITY,
    label: 'Schnittstellen & Verantwortung',
    scope: 'project',
    visibility: 'clientSafe',
    applicability: { kind: 'required' },
  },
  {
    // Task 03 (deep-coherence audit, F-27): the chapter's only content is
    // the Bauzeit schedule — Rabatt/Kommerzielles lives in Export (S5),
    // never here. "Termine & Kommerzielles" asserted content this chapter
    // does not own; the title now names exactly what it shows.
    id: CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE,
    label: 'Terminplan',
    scope: 'project',
    visibility: 'clientSafe',
    applicability: { kind: 'required' },
  },
  {
    /**
     * VR3-04 — FINAL VALIDATION, the last preparation stage.
     *
     * `internalOnly` by contract, not by taste: this is the seller's own
     * review of the Option before it becomes a client baseline, and its
     * content includes the permitted warnings, the open assumptions and the
     * reconciliation of the result. None of that belongs in a client
     * projection, and `isVisibleInOutputProfile` is what keeps it out —
     * hiding it in presentation mode with a conditional would be the
     * "suppressible field" the output model forbids.
     */
    id: CONFIGURATOR_STEP.FINAL_VALIDATION,
    label: 'Finale Prüfung',
    scope: 'project',
    visibility: 'internalOnly',
    applicability: { kind: 'required' },
  },
]

const STEP_BY_ID = new Map(CONFIGURATOR_STEPS.map((step) => [step.id, step]))

export function configuratorStep(id: ConfiguratorStepId): ConfiguratorStep {
  const step = STEP_BY_ID.get(id)
  if (!step) throw new Error(`unknown Configurator step: ${id}`)
  return step
}

export function isConfiguratorStepId(value: unknown): value is ConfiguratorStepId {
  return typeof value === 'string' && STEP_BY_ID.has(value as ConfiguratorStepId)
}

/**
 * VR3-03: EVERY cost-group step is applicable, always.
 *
 * Applicability used to mean "this cost group is `included`", so an excluded
 * KG stopped existing: it left the navigation, `nearestActiveConfiguratorStep`
 * snapped away from it, and a user could not reach the stage that would have
 * explained why it was skipped. That is the defect the audit recorded as
 * "Excluded KGs disappear and resemble missing work" (D-016), and the target
 * answers it directly — an excluded KG stays visible as OUT OF SCOPE /
 * SKIPPED throughout navigation and review.
 *
 * The scope decision is now a STATE of the step (undecided / in scope / out
 * of scope), rendered as such by the journey spine and by the step's own
 * surface. `coverage` is kept in the signature: the output-profile filter
 * below is the only remaining reason a step may be absent, and callers pass
 * one context object.
 */
export function isConfiguratorStepApplicable(
  step: ConfiguratorStep,
  _coverage: Coverage,
): boolean {
  return step.applicability.kind === 'required'
    || step.applicability.kind === 'includedKg'
}

export function activeConfiguratorWorkflow(
  context: ConfiguratorWorkflowContext,
): readonly ConfiguratorStep[] {
  return CONFIGURATOR_STEPS.filter((step) =>
    isConfiguratorStepApplicable(step, context.coverage)
      && isVisibleInOutputProfile(context.mode, step.visibility))
}

export function activeBuildingConfiguratorSteps(
  context: ConfiguratorWorkflowContext,
): readonly ConfiguratorStep[] {
  return activeConfiguratorWorkflow(context).filter((step) => step.scope === 'building')
}

export function isBuildingScopedConfiguratorStep(id: ConfiguratorStepId): boolean {
  return configuratorStep(id).scope === 'building'
}

/**
 * Keeps navigation valid when an output profile or a future scope condition
 * removes the current step. Prefer the next semantic step, then the previous.
 */
export function nearestActiveConfiguratorStep(
  context: ConfiguratorWorkflowContext,
  current: ConfiguratorStepId,
): ConfiguratorStepId {
  const active = activeConfiguratorWorkflow(context)
  if (active.some((step) => step.id === current)) return current
  const currentIndex = CONFIGURATOR_STEPS.findIndex((step) => step.id === current)
  const next = active.find((step) =>
    CONFIGURATOR_STEPS.findIndex((candidate) => candidate.id === step.id) > currentIndex)
  return next?.id ?? active.at(-1)?.id ?? CONFIGURATOR_STEP.SCOPE_BOUNDARIES
}

/**
 * Read-only migration for v1 proposal payloads. These numbers are never used
 * as current workflow authority; only previously persisted building progress
 * can contain them.
 *
 * Chapters 4 (`ENERGY_CERTIFICATION`) and 5 (`AREAS`) no longer exist as
 * Configurator steps (see the `CONFIGURATOR_STEPS` docblock above); a v1
 * payload naming either now lands on `SCOPE_BOUNDARIES`, the safe current
 * home for both the energy/certification decisions and the Configurator
 * entry point, rather than resolving to a step id `CONFIGURATOR_STEPS` no
 * longer contains.
 */
export function stepIdFromLegacyChapter(value: number): ConfiguratorStepId | null {
  return ({
    1: CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
    2: CONFIGURATOR_STEP.KG_300_DETAILS,
    3: CONFIGURATOR_STEP.KG_400_DETAILS,
    4: CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
    5: CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
    7: CONFIGURATOR_STEP.KG_700_DETAILS,
    8: CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE,
  } as Partial<Record<number, ConfiguratorStepId>>)[value] ?? null
}
