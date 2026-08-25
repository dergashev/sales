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
  COMMERCIAL_SCHEDULE: 'commercialSchedule',
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
    scope: 'building',
    visibility: 'clientSafe',
    applicability: { kind: 'includedKg', group: 'KG_300' },
  },
  {
    id: CONFIGURATOR_STEP.KG_400_DETAILS,
    label: 'Technik KG 400',
    scope: 'building',
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
    // Task 03 (deep-coherence audit, F-27): the chapter's only content is
    // the Bauzeit schedule — Rabatt/Kommerzielles lives in Export (S5),
    // never here. "Termine & Kommerzielles" asserted content this chapter
    // does not own; the title now names exactly what it shows.
    id: CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE,
    label: 'Termine',
    scope: 'project',
    visibility: 'clientSafe',
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

export function isConfiguratorStepApplicable(
  step: ConfiguratorStep,
  coverage: Coverage,
): boolean {
  switch (step.applicability.kind) {
    case 'required':
      return true
    case 'includedKg':
      return coverage[step.applicability.group] === 'included'
  }
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
