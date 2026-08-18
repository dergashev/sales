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
  KG_300_DETAILS: 'kg300Details',
  KG_400_DETAILS: 'kg400Details',
  ENERGY_CERTIFICATION: 'energyCertification',
  AREAS: 'areas',
  KG_700_DETAILS: 'kg700Details',
  COMMERCIAL_SCHEDULE: 'commercialSchedule',
} as const

export type ConfiguratorStepId =
  typeof CONFIGURATOR_STEP[keyof typeof CONFIGURATOR_STEP]

export type ConfiguratorStepScope = 'project' | 'building'

type StepApplicability =
  | { kind: 'required' }
  | { kind: 'mandatoryKg'; group: Extract<CostGroup, 'KG_300' | 'KG_400' | 'KG_700'> }
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
 * KG 300/400/700 remain active because the released domain contract makes
 * them mandatory. Energy/certification, areas and commercial/schedule are
 * required non-KG configuration areas. The former Ground step is absent: its
 * KG-200 status is a Scope Boundaries fact, not a second configuration task.
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
    id: CONFIGURATOR_STEP.KG_300_DETAILS,
    label: 'Leistungen KG 300',
    scope: 'building',
    visibility: 'clientSafe',
    applicability: { kind: 'mandatoryKg', group: 'KG_300' },
  },
  {
    id: CONFIGURATOR_STEP.KG_400_DETAILS,
    label: 'Technik KG 400',
    scope: 'building',
    visibility: 'clientSafe',
    applicability: { kind: 'mandatoryKg', group: 'KG_400' },
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
    applicability: { kind: 'mandatoryKg', group: 'KG_700' },
  },
  {
    id: CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE,
    label: 'Termine & Kommerzielles',
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
    case 'mandatoryKg':
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
