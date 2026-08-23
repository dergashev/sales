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
 * among themselves. Energy/certification, areas and commercial/schedule are
 * required non-KG configuration areas and keep their established position
 * between the building-construction and building-nebenkosten KG chapters.
 *
 * KG 200/500/600/800 (ticket "MAKE ALL KG 200–800 SELECTABLE & ADD
 * COST-BEARING CONTENT…") reuse this exact mechanism instead of a parallel
 * navigation model. `scope: 'project'` for all four (matching KG 700's own
 * precedent): none of their quantity drivers has a genuine per-building home
 * in the existing data model — site preparation, external works, equipment
 * and financing are configured once for the whole complex, not duplicated
 * per building tab. The former note "the Ground step is absent: KG-200
 * status is a Scope Boundaries fact, not a second configuration task" no
 * longer applies now that KG 200 carries a real multi-option catalog
 * (6 options) rather than a single flat rate — the same reasoning that
 * already gave KG 300/400/700 their own detail chapter now applies to it.
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
    id: CONFIGURATOR_STEP.ENERGY_CERTIFICATION,
    label: 'Energie & Zertifikate',
    scope: 'building',
    visibility: 'clientSafe',
    applicability: { kind: 'required' },
  },
  {
    id: CONFIGURATOR_STEP.AREAS,
    label: 'Flächen im Detail',
    scope: 'building',
    visibility: 'clientSafe',
    applicability: { kind: 'required' },
  },
  {
    id: CONFIGURATOR_STEP.KG_700_DETAILS,
    label: 'Baunebenkosten KG 700',
    scope: 'project',
    visibility: 'internalOnly',
    applicability: { kind: 'includedKg', group: 'KG_700' },
  },
  {
    id: CONFIGURATOR_STEP.KG_800_DETAILS,
    label: 'Finanzierung KG 800',
    scope: 'project',
    visibility: 'internalOnly',
    applicability: { kind: 'includedKg', group: 'KG_800' },
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
 */
export function stepIdFromLegacyChapter(value: number): ConfiguratorStepId | null {
  return ({
    1: CONFIGURATOR_STEP.SCOPE_BOUNDARIES,
    2: CONFIGURATOR_STEP.KG_300_DETAILS,
    3: CONFIGURATOR_STEP.KG_400_DETAILS,
    4: CONFIGURATOR_STEP.ENERGY_CERTIFICATION,
    5: CONFIGURATOR_STEP.AREAS,
    7: CONFIGURATOR_STEP.KG_700_DETAILS,
    8: CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE,
  } as Partial<Record<number, ConfiguratorStepId>>)[value] ?? null
}
