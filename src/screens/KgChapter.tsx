import { useEffect, useId, useState } from 'react'
import {
  KG_SCOPE_GROUPS,
  chapterOf,
  dependencyBlocker,
  quantityProblem,
  serviceContribution,
  serviceDecision as decisionOf,
  serviceById,
  type KgScopeGroup,
  type KgService,
  type KgServiceDecisionRecord,
} from '../engine/kgConfiguration'
import {
  kgCatalogueFor,
  kgChapterProgressFor,
  kgGroupOfStep,
  useStore,
} from '../state/store'
import { useT } from '../i18n'
import { NNBSP } from '../engine/money'
import { Button } from '../components/primitives'
import { FormField } from '../components/designSystem'
import { SemanticStatus, type SemanticStatusTone } from '../design-system/SemanticStatus'
import { CommercialNumber } from '../design-system/CommercialNumber'
import {
  KGConfigurationPage,
  ServiceDecisionRow,
  ServiceDetailPanel,
  ServiceGroup,
  type ServiceDecisionControl,
} from '../design-system/KGConfiguration'

/**
 * The product composition of one KG chapter (VR3-03, T-021–T-027).
 *
 * SIX INSTANCES, ONE COMPOSITION. This file is rendered for KG 200, 300,
 * 400, 500, 600 and 700 alike; the only thing that differs is which chapter
 * of `src/fixtures/kg-configuration.json` it reads. There is deliberately no
 * `switch (group)` anywhere in it — the moment one appears, the ticket's
 * whole outcome ("one learned interaction grammar") is gone.
 */
export function KgChapter() {
  const s = useStore()
  const t = useT()
  const step = s.openConfiguratorStep
  const group = kgGroupOfStep(step)
  const catalogue = kgCatalogueFor(s)
  const decisions = s.kgConfig
  const [openDetail, setOpenDetail] = useState<string | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)

  // Walking to another chapter closes the detail that belonged to the last
  // one: a disclosure is about a row, and the row is gone.
  useEffect(() => { setOpenDetail(null); setActiveGroupId(null) }, [step])

  if (!group || !catalogue || !decisions) return null
  const chapter = chapterOf(catalogue, group)
  const progress = kgChapterProgressFor(s, group)
  if (!chapter || !progress) return null

  const en = s.uiLanguage === 'en'
  const identity = `KG${NNBSP}${group.slice(3)}`
  const serviceGroups = chapter.groups
  const currentGroupId = activeGroupId ?? serviceGroups[0]?.id ?? null

  const includedGroups = KG_SCOPE_GROUPS.filter((g) => decisions.scope[g] === 'included')
  const position = includedGroups.indexOf(group)
  const previous = position > 0 ? includedGroups[position - 1] : null
  const next = position >= 0 && position < includedGroups.length - 1
    ? includedGroups[position + 1]
    : null

  const groupProgressOf = (groupId: string) => {
    const services = serviceGroups.find((g) => g.id === groupId)?.services ?? []
    const required = services.filter((svc) => svc.requiresDecision)
    const open = required.filter((svc) => decisionOf(decisions, svc).state === 'undecided')
    return { count: required.length, outstanding: open.length }
  }

  const statusOf = (service: KgService): { tone: SemanticStatusTone; label: string } => {
    const decision = decisionOf(decisions, service)
    // `error` is reserved for something that actually FAILED (the
    // SemanticStatus contract). An unmet prerequisite and an invalid entry
    // are caveats waiting on a human — `attention` — and they are told apart
    // by their words, never by their colour (rule 8). Both still mark the row
    // `data-invalid`, because both refuse completion.
    if (dependencyBlocker(catalogue, decisions, service)) {
      return { tone: 'attention', label: t('vr3.kg.service.status.blocked') }
    }
    if (decision.state === 'selected'
      && quantityProblem(service, decision.quantity) !== null) {
      return { tone: 'attention', label: t('vr3.kg.service.status.invalid') }
    }
    if (decision.state === 'undecided') {
      return { tone: 'attention', label: t('vr3.kg.service.status.undecided') }
    }
    if (decision.state === 'notSelected') {
      return { tone: 'neutral', label: t('vr3.kg.service.status.notIncluded') }
    }
    return service.kind.kind === 'singleChoice'
      ? { tone: 'ok', label: t('vr3.kg.service.status.configured') }
      : { tone: 'ok', label: t('vr3.kg.service.status.included') }
  }

  const controlOf = (service: KgService): ServiceDecisionControl => {
    const decision = decisionOf(decisions, service)
    const write = (value: KgServiceDecisionRecord) =>
      s.setKgServiceDecision(service.id, value)
    if (service.kind.kind === 'readOnlyRequired') {
      return { kind: 'readOnly', label: t('vr3.kg.service.mandatory') }
    }
    if (service.kind.kind === 'singleChoice') {
      const variants = service.kind.variants
      return {
        kind: 'variant',
        value: decision.state === 'selected' ? decision.variant ?? null : null,
        // No per-option consequence text here: the row's own amount already
        // states the effect of the CHOSEN variant, and repeating it inside
        // every option doubled the control's width and pushed the amount
        // onto a second line for every variant service.
        options: variants.map((variant) => ({
          value: variant.value,
          label: en ? variant.labelEn : variant.labelDe,
        })),
        onDecide: (value) => write({ state: 'selected', variant: value }),
        onPreview: (value) => s.previewOption(value === null
          ? null
          : { kind: 'kgService', serviceId: service.id, value: { state: 'selected', variant: value } }),
      }
    }
    const quantity = service.kind.kind === 'quantity'
      ? decision.quantity ?? service.kind.baselineQuantity
      : undefined
    if (!service.requiresDecision) {
      // No explicit decision is demanded here, so there is no undecided
      // state to hold: one checkbox, one label, the whole truth.
      return {
        kind: 'toggle',
        checked: decision.state === 'selected',
        label: t('vr3.kg.service.includeToggle'),
        onToggle: (checked) => write(checked
          ? { state: 'selected', ...(quantity ? { quantity } : {}) }
          : { state: 'notSelected' }),
        onPreview: (checked) => s.previewOption(checked === null
          ? null
          : {
            kind: 'kgService',
            serviceId: service.id,
            value: checked
              ? { state: 'selected', ...(quantity ? { quantity } : {}) }
              : { state: 'notSelected' },
          }),
      }
    }
    return {
      kind: 'choice',
      value: decision.state === 'selected' ? 'included'
        : decision.state === 'notSelected' ? 'excluded' : null,
      includeLabel: t('vr3.kg.service.include'),
      excludeLabel: t('vr3.kg.service.exclude'),
      onDecide: (choice) => write(choice === 'included'
        ? { state: 'selected', ...(quantity ? { quantity } : {}) }
        : { state: 'notSelected' }),
      onPreview: (choice) => s.previewOption(choice === null
        ? null
        : {
          kind: 'kgService',
          serviceId: service.id,
          value: choice === 'included'
            ? { state: 'selected', ...(quantity ? { quantity } : {}) }
            : { state: 'notSelected' },
        }),
    }
  }

  const buildingNameOf = (buildingId: string | undefined) => {
    if (!buildingId) return undefined
    const building = s.scopeBuildings.find((b) => b.id === buildingId)
    return building ? t('vr3.kg.service.building', { name: building.name }) : undefined
  }

  return (
    <KGConfigurationPage
      identity={t('vr3.kg.page.identity', { group: identity })}
      title={`${identity} · ${t(`costGroup.${group}`)}`}
      lead={en ? chapter.scopeNoteEn : chapter.scopeNoteDe}
      progress={{
        tone: progress.state === 'complete' ? 'ok'
          : progress.state === 'invalid' ? 'error' : 'attention',
        label: progress.state === 'complete'
          ? t('vr3.kg.page.progressComplete')
          : t('vr3.kg.page.progress', {
            decided: progress.decidedDecisions, total: progress.requiredDecisions,
          }),
      }}
      groupNav={serviceGroups.map((serviceGroup) => {
        const counts = groupProgressOf(serviceGroup.id)
        return {
          id: serviceGroup.id,
          label: en ? serviceGroup.labelEn : serviceGroup.labelDe,
          outstanding: counts.outstanding,
          count: counts.count,
          current: serviceGroup.id === currentGroupId,
          onSelect: () => setActiveGroupId(serviceGroup.id),
        }
      })}
      context={<ChapterContext group={group} />}
      previousAction={previous && (
        <Button onClick={() => s.openKgChapter(previous)}>
          {t('vr3.kg.page.previous', { group: `KG${NNBSP}${previous.slice(3)}` })}
        </Button>
      )}
      nextAction={(
        <Button
          variant="primary"
          disabled={progress.state !== 'complete'}
          disabledReason={progress.state === 'invalid'
            ? t('vr3.kg.page.blockedInvalid')
            : t('vr3.kg.page.blockedOpen', {
              open: progress.requiredDecisions - progress.decidedDecisions,
            })}
          onClick={() => {
            if (next) s.openKgChapter(next)
            else s.openConfiguratorStepAt('commercialSchedule')
          }}
        >
          {next
            ? t('vr3.kg.page.next', { group: `KG${NNBSP}${next.slice(3)}` })
            : t('vr3.kg.page.toSchedule')}
        </Button>
      )}
    >
      {serviceGroups.map((serviceGroup) => {
        const counts = groupProgressOf(serviceGroup.id)
        return (
          <ServiceGroup
            key={serviceGroup.id}
            id={serviceGroup.id}
            label={en ? serviceGroup.labelEn : serviceGroup.labelDe}
            decisionCount={counts.count}
            decisionsLabel={t('vr3.kg.group.decisions', {
              count: serviceGroup.services.length,
            })}
          >
            {serviceGroup.services.map((service) => {
              const decision = decisionOf(decisions, service)
              const blocker = dependencyBlocker(catalogue, decisions, service)
              const problem = decision.state === 'selected'
                ? quantityProblem(service, decision.quantity)
                : null
              const contribution = serviceContribution(catalogue, decisions, service)
              const upstream = blocker ? serviceById(catalogue, blocker) : null
              const hasDetail = service.kind.kind === 'quantity'
                || blocker !== null
                || service.authority !== 'sourceEvidenced'
              return (
                <ServiceDecisionRow
                  key={service.id}
                  name={en ? service.labelEn : service.labelDe}
                  summary={en ? service.summaryEn : service.summaryDe}
                  control={controlOf(service)}
                  controlLegend={t('vr3.kg.service.legend', {
                    service: en ? service.labelEn : service.labelDe,
                  })}
                  status={statusOf(service)}
                  invalid={problem !== null || blocker !== null}
                  warning={blocker && upstream
                    ? t('vr3.kg.service.dependencyWarning', {
                      upstream: en ? upstream.labelEn : upstream.labelDe,
                    })
                    : problem
                      ? t(`vr3.kg.service.quantity.${problem}`)
                      : undefined}
                  buildingLabel={buildingNameOf(service.buildingId)}
                  authorityLabel={service.authority === 'sourceEvidenced'
                    ? undefined
                    : t(`vr3.kg.service.authority.${service.authority}`)}
                  amount={(
                    <CommercialNumber
                      // A configured variant at the project standard has no
                      // effect, and "+ 0 €" states a price where the truth is
                      // "this is the standard" — the same class as printing a
                      // zero for an absence (rule 16).
                      exact={contribution !== null && contribution.isZero()
                        ? null
                        : contribution}
                      language={s.uiLanguage}
                      signed={contribution !== null && !contribution.isZero()}
                      absentLabel={contribution !== null
                        ? t('vr3.kg.service.variantBaseline')
                        : t('vr3.kg.service.noAmount')}
                      emphasis="compact"
                    />
                  )}
                  detailToggle={hasDetail
                    ? {
                      label: openDetail === service.id
                        ? t('vr3.kg.service.detailClose')
                        : t('vr3.kg.service.detailOpen'),
                      open: openDetail === service.id,
                      onToggle: () => setOpenDetail(
                        openDetail === service.id ? null : service.id,
                      ),
                    }
                    : undefined}
                  detail={hasDetail ? (
                    <ServiceDetailPanel
                      fields={[
                        {
                          label: t('vr3.kg.service.field.authority'),
                          value: t(`vr3.kg.service.authority.${service.authority}`),
                        },
                        ...(service.buildingId
                          ? [{
                            label: t('vr3.kg.service.field.building'),
                            value: buildingNameOf(service.buildingId) ?? service.buildingId,
                          }]
                          : []),
                      ]}
                      dependency={blocker && upstream
                        ? {
                          message: t('vr3.kg.service.dependencyDetail', {
                            upstream: en ? upstream.labelEn : upstream.labelDe,
                          }),
                          action: {
                            label: t('vr3.kg.service.dependencyRoute'),
                            onSelect: () => {
                              const upstreamGroup = KG_SCOPE_GROUPS.find((g) =>
                                chapterOf(catalogue, g)?.groups.some((sg) =>
                                  sg.services.some((sv) => sv.id === upstream.id)))
                              if (upstreamGroup) {
                                s.openKgChapter(upstreamGroup)
                                setOpenDetail(upstream.id)
                              }
                            },
                          },
                        }
                        : undefined}
                    >
                      {service.kind.kind === 'quantity' && (
                        <QuantityField service={service} />
                      )}
                    </ServiceDetailPanel>
                  ) : undefined}
                />
              )
            })}
          </ServiceGroup>
        )
      })}
    </KGConfigurationPage>
  )
}

/**
 * The quantity entry of one service.
 *
 * The raw text is stored, not a parsed number: an invalid entry has to be
 * shown back to the user and it has to mark the row invalid, while the
 * COMMERCIAL result keeps the last valid basis (`serviceContribution`). A
 * field that silently swallowed the bad value would leave the user looking
 * at a total they did not ask for.
 */
function QuantityField({ service }: { service: KgService }) {
  const s = useStore()
  const t = useT()
  const id = useId()
  if (service.kind.kind !== 'quantity') return null
  const decision = s.kgConfig
    ? decisionOf(s.kgConfig, service)
    : { state: 'undecided' as const }
  const raw = decision.quantity ?? service.kind.baselineQuantity
  const problem = quantityProblem(service, raw)
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
        value={raw}
        onChange={(event) => s.setKgServiceDecision(service.id, {
          ...decision,
          state: 'selected',
          quantity: event.target.value,
        })}
      />
    </FormField>
  )
}

/**
 * The building/scope context panel.
 *
 * It exists where building ownership MATTERS and says only what the chapter
 * cannot say for itself: which buildings this Option covers, how many
 * warnings this chapter carries and whether its basis is confirmed. It is
 * not a second configuration surface — the released product's per-building
 * tab strip is deliberately absent, because the approved target composes
 * building ownership INTO the service row and a tab strip over six identical
 * pages would be the second navigation grammar this ticket removes.
 */
function ChapterContext({ group }: { group: KgScopeGroup }) {
  const s = useStore()
  const t = useT()
  const progress = kgChapterProgressFor(s, group)
  const buildings = s.scopeBuildings.filter((b) => s.scopeSelected[b.id])
  return (
    <div className="a3-kgctx">
      <h2 className="a3-kgctx-title">{t('vr3.kg.context.title')}</h2>
      <p className="a3-cap">
        {t('vr3.kg.context.buildings', { count: buildings.length })}
      </p>
      <ul className="a3-kgctx-list">
        {buildings.map((building) => (
          <li key={building.id}>{building.name}</li>
        ))}
      </ul>
      <dl className="a3-kgctx-rows">
        <div className="a3-kgctx-row">
          <dt>{t('vr3.kg.context.warnings')}</dt>
          <dd>{progress
            ? progress.invalidServiceIds.length + progress.blockedServiceIds.length
            : 0}</dd>
        </div>
        <div className="a3-kgctx-row">
          <dt>{t('vr3.kg.context.selected')}</dt>
          <dd>{progress?.selectedServiceCount ?? 0}</dd>
        </div>
      </dl>
      <SemanticStatus
        tone={s.scopeSaved ? 'ok' : 'attention'}
        label={s.scopeSaved
          ? t('vr3.kg.context.baselineConfirmed')
          : t('vr3.kg.context.baselineOpen')}
      />
    </div>
  )
}
