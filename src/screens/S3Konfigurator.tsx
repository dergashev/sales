import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSemanticMotion } from '../design-system/motion'
import {
  activeBuilding,
  choicesFor,
  configurationDisplayStatusFor,
  includedBuildingIds,
  useStore,
  COVERAGE_LABEL,
  LABEL_UG,
  MANDATORY_COST_GROUPS,
  scopeBoundariesStatus,
  type ConfigurationDisplayStatus,
  type ConfigurationMode,
} from '../state/store'
import { NNBSP } from '../engine/money'
import { useT, useTx } from '../i18n'
import { incompleteReasonText } from '../i18n/reasons'
import {
  bgfAboveGround,
  isScopeUniverseEmpty,
  type BuildingInput,
  type CostGroup,
  type CoverageState,
} from '../engine/calculate'
import { Decimal } from 'decimal.js'
import { Button } from '../components/primitives'
import {
  Badge,
  NextStep,
  PageHeader,
  ReadinessChecklist,
  SectionSheet,
} from '../components/designSystem'
import { ClientNotice } from '../components/ClientNotice'
import { CheckboxCard, DateField, RadioCardGroup, SegmentedControl } from '../components/controls'
import { optionImage } from '../assets/option-images'
import { ScheduleGantt } from '../components/ScheduleGantt'
import { OptionChapter } from './OptionChapter'
import {
  KG300_GROUPS, KG400_GROUPS, ZERT_GROUPS, COVERAGE_RATES,
} from '../engine/options'
import { ScopeCatalogChapter } from './ScopeCatalogChapter'
import {
  KG200_CATALOG_OPTIONS, KG500_CATALOG_OPTIONS, KG600_CATALOG_OPTIONS,
} from '../engine/scopeCatalog'
import { RISK_ITEMS, riskDriver } from '../engine/risk'
import { modelDuration, presentDuration, shiftScheduleMetrics } from '../engine/schedule'
import demo from '../fixtures/demo-0001.json'
import { present, label as moneyLabel } from '../engine/money'
import { isVisibleInOutputProfile } from '../state/clientProjection'
import {
  activeBuildingConfiguratorSteps,
  activeConfiguratorWorkflow,
  CONFIGURATOR_STEP,
  configuratorStep,
  nearestActiveConfiguratorStep,
  type ConfiguratorStepId,
} from '../state/chapters'
import { effectiveFactValue } from '../state/buildingReview'

/**
 * S3 Konfigurator — рабочая область главы. ТОЛЬКО она: навигация по главам
 * живёт в левом сайдбаре оболочки, живой оффер — в правой панели (решение
 * PO о трёх зонах). Экран не знает о цене ничего, кроме превью-побочных
 * эффектов своих контролов.
 *
 * Механики здесь:
 * - Geist-Vorschau (DC-28): hover/focus на опции через 200 мс показывает
 *   последствие у цены в правой панели; клик — фиксация и волна.
 * - Опция выделяется бордером выделения И знаком ✓ — не только цветом
 *   (правило 8).
 * - Непроработанная глава — честное состояние с объяснением, не пустота
 *   (правило 30): прототип говорит «этого нет», а не молчит.
 *
 * Экран показан во ВНУТРЕННЕМ режиме: в фикстуре открыт блокер DEMO-VI-0001
 * (класс здания не подтверждён по MBO §2), клиентские профили закрыты
 * гейтом в правой панели.
 */

/**
 * Последствие опции для consequenceLine — видно всегда, не по hover
 * (R-05/OPTION-009). Образец контракта: `≈ +97.000 € Mehrpreis`.
 */
function consequenceLabel(delta: Decimal, zero?: string): string {
  if (delta.isZero()) return zero ?? `±${NNBSP}0${NNBSP}€`
  const pr = present(delta.abs())
  const sign = delta.isNegative() ? '−' : '+'
  const word = delta.isNegative() ? 'Minderpreis' : 'Mehrpreis'
  return `${pr.prefix ? pr.prefix + NNBSP : ''}${sign}${pr.display}${NNBSP}€${NNBSP}${word}`
}

export function S3Konfigurator() {
  const s = useStore()
  const t = useT()
  // Product Orchestration Contract "Rebuild Project Card Workflow" Part 11:
  // Configuration Mode is chosen INSIDE Scope Boundaries, not on a separate
  // full-page gate before it. While no mode is confirmed (or the seller is
  // actively changing it via `beginConfigurationModeEdit`), the Configurator
  // is forced onto the Scope Boundaries step — `ChapterUmfang` itself shows
  // the mode choice first and reveals the rest of Scope Boundaries only once
  // `modeConfirmed` is true. This preserves every existing invariant around
  // `openConfiguratorStep`/`pricingStarted` unchanged: it is a display-time
  // override, not a change to persisted navigation state.
  const modeConfirmed = s.configurationModeChosen && !s.configurationModeEditing
  const workflow = activeConfiguratorWorkflow({ coverage: s.coverage, mode: s.mode })
  const currentId = modeConfirmed
    ? nearestActiveConfiguratorStep({
        coverage: s.coverage,
        mode: s.mode,
      }, s.openConfiguratorStep)
    : CONFIGURATOR_STEP.SCOPE_BOUNDARIES
  const currentStep = configuratorStep(currentId)
  const routeIndex = workflow.findIndex((step) => step.id === currentId)
  const previous = routeIndex > 0 ? workflow[routeIndex - 1] : null
  const next = routeIndex >= 0 && routeIndex < workflow.length - 1
    ? workflow[routeIndex + 1]
    : null
  const buildingScoped = currentStep.scope === 'building'
  const selectedIds = includedBuildingIds(s)
  const totalOverview = buildingScoped
    && s.configurationMode === 'PER_BUILDING'
    && selectedIds.length > 1
    && s.scopeBuildingId === null
  const buildingTabPanel = buildingScoped && s.configurationMode === 'PER_BUILDING'
  const activeScopeValue = totalOverview ? TOTAL_SCOPE : s.activeBuildingId
  const visibleStatus = buildingScoped && !totalOverview
    ? visibleConfigurationStatus(s, selectedIds)
    : null
  const confirmationAvailable = s.mode === 'intern'
    && (visibleStatus === 'ready' || visibleStatus === 'recheck')

  return (
    <div className="a3-config-work">
      {/* Заголовок экрана — masthead витрины: крупный титул и мета на
          одной базовой линии, как в образце. */}
      <PageHeader
        className="a3-config-header"
        title={t(`chapter.${currentStep.id}`)}
        meta={t('s3.header.progress', {
          current: routeIndex + 1,
          total: workflow.length,
        })}
      />

      {modeConfirmed && <ConfigurationModeContext buildingScoped={buildingScoped} />}
      {modeConfirmed && <ConfigurationScopeNavigation stepId={currentId} />}

      <div
        role={buildingTabPanel ? 'tabpanel' : undefined}
        id={buildingTabPanel ? configurationPanelId(activeScopeValue) : undefined}
        aria-labelledby={buildingTabPanel ? configurationTabId(activeScopeValue) : undefined}
      >
        {buildingScoped && !totalOverview && <ConfigurationStatusStrip />}

        {/* Ширина содержимого не ограничивается: центровщик остаётся пределом
            ДЛИННОГО ТЕКСТА (он стоит на абзацах внутри карточек), а не клеткой
            для рабочей области — аудит верно указал, что здесь он обнимал всю
            главу целиком. */}
        <div className="a3-config-work-body">
          {totalOverview && <ConfigurationOverview />}
          {/* Rendering follows semantic step identity. Display numbers come
              only from the active workflow above. */}
          {!totalOverview && currentId === CONFIGURATOR_STEP.SCOPE_BOUNDARIES
            && <ChapterUmfang />}
          {!totalOverview && currentId === CONFIGURATOR_STEP.KG_200_DETAILS && (
            <ScopeCatalogChapter
              options={KG200_CATALOG_OPTIONS}
              introDe="Vorbereitende Maßnahmen definieren Rückbau, Bodenrisiken, Erschließung und temporäre Maßnahmen, die nötig sind, bevor das Gebäude regulär umgesetzt werden kann."
              introEn="Preparatory measures cover demolition, soil risk, utility connections and temporary works required before normal building delivery can proceed."
            />
          )}
          {!totalOverview && currentId === CONFIGURATOR_STEP.KG_300_DETAILS && (
            <div className="a3-config-kg300-stage">
              <div className="a3-config-kg300-decisions">
                <Kg300PrimaryDecisions />
                <section className="a3-config-kg300-secondary">
                  <div className="a3-config-decision-heading">
                    <h2>{t('configurator.workstage.secondaryDecisions')}</h2>
                  </div>
                  <OptionChapter
                    groups={KG300_GROUPS.filter((group) =>
                      group.id !== 'fassade')}
                    intro=""
                    variant="workstage"
                  />
                </section>
              </div>
              <aside className="a3-config-kg300-context" aria-label={t('configurator.workstage.buildingContext')}>
                <Kg300WorkContext />
              </aside>
              <div className="a3-config-kg300-guidance">
                <EnergyCertBanner />
                <GroundRiskSection />
              </div>
            </div>
          )}
          {!totalOverview && currentId === CONFIGURATOR_STEP.KG_400_DETAILS && (
            <div className="grid gap-5">
              <EnergyCertBanner />
              <OptionChapter groups={KG400_GROUPS}
                intro={'Technische Anlagen nach DIN 276. Die Wahl der Erzeugung und der Lüftung entscheidet mit, welcher Energiestandard überhaupt erreichbar bleibt.'} />
            </div>
          )}
          {!totalOverview && currentId === CONFIGURATOR_STEP.KG_500_DETAILS && (
            <ScopeCatalogChapter
              options={KG500_CATALOG_OPTIONS}
              introDe="Außenanlagen bestimmen Beläge, Begrünung, Regenwassermanagement, Mobilität und Aufenthaltsqualität rund um das Gebäude."
              introEn="External works define surfaces, landscape, stormwater strategy, mobility and outdoor amenity around the building."
            />
          )}
          {!totalOverview && currentId === CONFIGURATOR_STEP.KG_600_DETAILS && (
            <ScopeCatalogChapter
              options={KG600_CATALOG_OPTIONS}
              introDe="Ausstattung ergänzt das fertige Gebäude um Küchen, Möblierung, Geräte, IT-Ausstattung, Orientierung und optional Kunst."
              introEn="Equipment adds kitchens, furniture, devices, IT equipment, wayfinding and optional art to the completed building."
            />
          )}
          {!totalOverview && currentId === CONFIGURATOR_STEP.KG_700_DETAILS
            && <ChapterKg700 />}
          {!totalOverview && currentId === CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE
            && <ChapterTermine />}
        </div>

        {/* Один следующий шаг всегда на экране (DC-27): маршрут, не принуждение. */}
        {!totalOverview && currentId !== CONFIGURATOR_STEP.SCOPE_BOUNDARIES && <footer className="a3-config-action-dock">
          {previous ? (
            <Button onClick={() => s.openConfiguratorStepAt(previous.id)}>
              {t('s3.previousChapter', {
                number: routeIndex,
                title: t(`chapter.${previous.id}`),
              })}
            </Button>
          ) : <span />}
          {next && (
            <Button
              variant={confirmationAvailable ? 'secondary' : 'primary'}
              onClick={() => s.openConfiguratorStepAt(next.id)}
            >
              {t('s3.nextChapter', {
                number: routeIndex + 2,
                title: t(`chapter.${next.id}`),
              })}
            </Button>
          )}
        </footer>}
      </div>
    </div>
  )
}

function buildingName(
  state: ReturnType<typeof useStore.getState>,
  buildingId: string,
): string {
  const review = state.buildingReviews[buildingId]
  return review
    ? effectiveFactValue(review.facts.documentationName) ?? buildingId
    : buildingId
}

function buildingNames(
  state: ReturnType<typeof useStore.getState>,
  buildingIds: string[],
): string {
  return new Intl.ListFormat(state.uiLanguage === 'de' ? 'de-DE' : 'en-GB', {
    style: 'long',
    type: 'conjunction',
  }).format(buildingIds.map((id) => buildingName(state, id)))
}

function statusLabel(
  status: ConfigurationDisplayStatus,
  t: ReturnType<typeof useT>,
): string {
  return t(`configurator.status.${status}`)
}

/**
 * Configuration Mode choice — Product Orchestration Contract "Rebuild
 * Project Card Workflow" Part 11: this used to be `ConfigurationModeEntry`,
 * a full-page gate rendered instead of the Configurator whenever no mode
 * was chosen yet. It is now the first section of `ChapterUmfang` (Scope
 * Boundaries) itself, so Configurator entry always lands on Scope
 * Boundaries (Part 10) and the mode decision reads as part of it rather
 * than a separate screen. Same store actions
 * (`confirmConfigurationMode`/`beginConfigurationModeEdit`), same draft-mode
 * local state, same content — only where it mounts changed.
 */
function ConfigurationModeSection() {
  const s = useStore()
  const t = useT()
  const selectedIds = includedBuildingIds(s)
  const names = buildingNames(s, selectedIds)
  const [draftMode, setDraftMode] = useState<ConfigurationMode | null>(
    s.configurationModeChosen ? s.configurationMode : null,
  )

  if (s.mode !== 'intern') {
    return (
      <SectionSheet title={t('configurator.mode.title')}>
        <p className="text-body text-text-secondary">{t('configurator.mode.clientBlocked')}</p>
      </SectionSheet>
    )
  }

  return (
    <SectionSheet
      title={t('configurator.mode.title')}
      intro={t('configurator.mode.lede')}
    >
      <p className="a3-cap">
        {t('configurator.mode.meta', { count: selectedIds.length })}
      </p>
      <div className="mt-3">
        <RadioCardGroup
          legend={t('configurator.mode.legend')}
          value={draftMode}
          onChange={setDraftMode}
          options={[
            {
              value: 'SHARED',
              title: t('configurator.mode.shared.title'),
              image: optionImage('configurationMode', 'SHARED'),
              description: t('configurator.mode.shared.description'),
              consequence: t('configurator.mode.shared.consequence', {
                buildings: names,
              }),
            },
            {
              value: 'PER_BUILDING',
              title: t('configurator.mode.perBuilding.title'),
              image: optionImage('configurationMode', 'PER_BUILDING'),
              description: t('configurator.mode.perBuilding.description'),
              consequence: selectedIds.length === 1
                ? t('configurator.mode.perBuilding.consequenceOne')
                : t('configurator.mode.perBuilding.consequence', {
                    count: selectedIds.length,
                  }),
            },
          ]}
        />
        {selectedIds.length === 1 && (
          <p className="mt-4 text-small text-text-secondary">
            {t('configurator.mode.oneBuildingHint')}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-start gap-3">
          <Button
            variant="primary"
            disabled={draftMode === null}
            disabledReason={draftMode === null
              ? t('configurator.mode.startReason')
              : undefined}
            onClick={() => draftMode && s.confirmConfigurationMode(draftMode)}
          >
            {t('configurator.mode.start')}
          </Button>
          {/* F11: the default `secondary` variant's solid 1px black border
              visually outweighed the forward action while it sits disabled
              (before a mode is chosen) — back/cancel must never outweigh the
              workflow-forward action beside it (ACTION-001,
              components-core.md). */}
          <Button variant="ghost" onClick={() => s.setPipelineView('buildingScope')}>
            {t('configurator.mode.back')}
          </Button>
        </div>
      </div>
    </SectionSheet>
  )
}

/**
 * Task 03 (deep-coherence audit, F-25): the SINGLE mode-banner renderer.
 * `ConfigurationScopeNavigation` used to restate this exact sentence on
 * every SHARED building-scoped chapter (`configurator.mode.currentShared`
 * and `configurator.scope.shared` are byte-identical strings) and every
 * project-scoped chapter got its own separate "gilt für den gesamten
 * Komplex" banner beneath this one — two banners, back to back, on every
 * chapter. This component now owns the scope statement outright; its
 * wording already varies by the current chapter's level so the other
 * component never needs to repeat it.
 */
function ConfigurationModeContext({ buildingScoped }: { buildingScoped: boolean }) {
  const s = useStore()
  const t = useT()
  const names = buildingNames(s, includedBuildingIds(s))
  const summary = !buildingScoped
    ? t('configurator.scope.project')
    : s.configurationMode === 'SHARED'
      ? t('configurator.mode.currentShared', { buildings: names })
      : t('configurator.mode.currentPerBuilding')
  return (
    <section
      aria-label={t('configurator.mode.legend')}
      className="a3-config-scope-band"
    >
      <p className="text-body text-text-primary">
        <strong>{summary}</strong>
        <span className="mt-1 block text-small font-normal text-text-secondary">
          {t('configurator.mode.retained')}
        </span>
      </p>
      {s.mode === 'intern' && (
        <Button variant="ghost" onClick={() => s.beginConfigurationModeEdit()}>
          {t('configurator.mode.edit')}
        </Button>
      )}
    </section>
  )
}

const TOTAL_SCOPE = '__TOTAL__'

type ConfigurationScopeOption = {
  value: string
  label: string
  /**
   * Task 04 (F-18, 1280 shell): the DC-46 tab strip must show all tabs of
   * a 2-building project untruncated at 1280 px — the full-sentence
   * `label` ("Gesamt · 0 von 2 bestätigt" / "Haus A · Unvollständig")
   * alone needed 624 px against a ≤400 px host even after the shell ADR
   * revision widened the workspace. `label` stays the compact VISIBLE
   * text; when set, `accessibleLabel` carries the full sentence as the
   * tab's accessible name — no information is dropped, only its visible
   * density changes.
   */
  accessibleLabel?: string
}

function configurationTabId(value: string): string {
  return `configurator-scope-tab-${value.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function configurationPanelId(value: string): string {
  return `configurator-scope-panel-${value.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

export function ConfigurationScopeTabs({
  legend,
  value,
  options,
  onChoose,
}: {
  legend: string
  value: string
  options: ConfigurationScopeOption[]
  onChoose: (value: string) => void
}) {
  const t = useT()
  const tablistRef = useRef<HTMLDivElement>(null)
  const optionSignature = options.map((option) => option.value).join('|')
  const valueAvailable = options.some((option) => option.value === value)
  const [focusedValue, setFocusedValue] = useState(value)

  useEffect(() => {
    if (valueAvailable) setFocusedValue(value)
  }, [optionSignature, value, valueAvailable])

  // F07-class defect: the selected tab could be off-screen at rest (e.g.
  // right after entering the chapter) with only the scroll arrows hinting
  // that more exists — reachable, but not identifiable at a glance (AC-03).
  // Bring the actually-selected tab into view whenever it changes, not only
  // when the user reaches it via the arrow/keyboard path.
  useEffect(() => {
    if (!valueAvailable) return
    const index = options.findIndex((option) => option.value === value)
    if (index < 0) return
    const tabs = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs?.[index]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [optionSignature, value, valueAvailable])

  const moveFocus = (index: number) => {
    const option = options[index]
    if (!option) return
    setFocusedValue(option.value)
    const tabs = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs?.[index]?.focus()
    tabs?.[index]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = Math.max(
      options.findIndex((option) => option.value === focusedValue),
      0,
    )
    const last = options.length - 1
    const next = event.key === 'ArrowRight' ? (current + 1) % options.length
      : event.key === 'ArrowLeft'
        ? (current - 1 + options.length) % options.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? last
            : null
    if (next !== null) {
      event.preventDefault()
      moveFocus(next)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onChoose(options[current]!.value)
    }
  }

  return (
    <div className="flex min-w-0 items-stretch gap-1">
      {options.length > 1 && (
        <Button
          variant="ghost"
          aria-label={t('configurator.scope.first')}
          onClick={() => moveFocus(0)}
        >
          ←
        </Button>
      )}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label={legend}
        aria-orientation="horizontal"
        className="a3-tabs a3-tabs-compact min-w-0 flex-1 flex-nowrap overflow-x-auto whitespace-nowrap"
        onKeyDown={handleKeyDown}
      >
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={configurationTabId(option.value)}
            aria-selected={option.value === value}
            aria-controls={configurationPanelId(option.value)}
            aria-posinset={index + 1}
            aria-setsize={options.length}
            aria-label={option.accessibleLabel}
            tabIndex={option.value === focusedValue ? 0 : -1}
            onFocus={() => setFocusedValue(option.value)}
            onClick={() => {
              setFocusedValue(option.value)
              onChoose(option.value)
            }}
            className="shrink-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            {option.label}
          </button>
        ))}
      </div>
      {options.length > 1 && (
        <Button
          variant="ghost"
          aria-label={t('configurator.scope.last')}
          onClick={() => moveFocus(options.length - 1)}
        >
          →
        </Button>
      )}
    </div>
  )
}

/**
 * Task 03 (F-25): pure scope NAVIGATION now — the mode/scope statement
 * itself belongs solely to `ConfigurationModeContext`. Only PER_BUILDING
 * building-scoped chapters have an actual functional widget here (the
 * building tabs); every other combination has nothing left to add beside
 * the singular mode banner above.
 */
function ConfigurationScopeNavigation({
  stepId,
}: {
  stepId: ConfiguratorStepId
}) {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const selectedIds = includedBuildingIds(s)
  const buildingScoped = configuratorStep(stepId).scope === 'building'

  if (!buildingScoped || s.configurationMode === 'SHARED') return null

  const statuses = Object.fromEntries(selectedIds.map((id) => [
    id,
    configurationDisplayStatusFor(s, id),
  ])) as Record<string, ConfigurationDisplayStatus>
  const confirmed = selectedIds.filter((id) => statuses[id] === 'confirmed').length
  // Task 04 (F-18, 1280 shell): visible label stays compact (fraction /
  // ✓·○ status glyph — the SAME glyph vocabulary the rest of the product
  // already uses for this exact confirmed/not-confirmed distinction, not
  // a new one); `accessibleLabel` keeps the original full sentence as the
  // tab's accessible name, so no information is lost for assistive tech.
  const options = [
    ...(selectedIds.length > 1 ? [{
      value: TOTAL_SCOPE,
      label: `${tx('Gesamt')} · ${confirmed}/${selectedIds.length}`,
      accessibleLabel: t('configurator.scope.total', { confirmed, total: selectedIds.length }),
    }] : []),
    ...selectedIds.map((id) => ({
      value: id,
      label: `${statuses[id] === 'confirmed' ? '✓' : '○'} ${buildingName(s, id)}`,
      accessibleLabel: t('configurator.scope.building', {
        building: buildingName(s, id),
        status: statusLabel(statuses[id]!, t),
      }),
    })),
  ]
  const value = s.scopeBuildingId
    ?? (selectedIds.length > 1 ? TOTAL_SCOPE : selectedIds[0]!)
  const choose = (next: string) => {
    const buildingId = next === TOTAL_SCOPE ? null : next
    s.setConfigurationScope(buildingId)
  }

  return (
    <div className="mt-4 min-w-0">
      <ConfigurationScopeTabs
        legend={t('configurator.scope.legend')}
        value={value}
        options={options}
        onChoose={choose}
      />
    </div>
  )
}

function visibleConfigurationStatus(
  state: ReturnType<typeof useStore.getState>,
  ids: string[],
): ConfigurationDisplayStatus {
  if (state.configurationMode === 'PER_BUILDING') {
    return configurationDisplayStatusFor(state, state.activeBuildingId)
  }
  const statuses = ids.map((id) => configurationDisplayStatusFor(state, id))
  if (statuses.includes('recheck')) return 'recheck'
  if (statuses.includes('open')) return 'open'
  if (statuses.every((status) => status === 'confirmed')) return 'confirmed'
  return 'ready'
}

function ConfigurationStatusStrip() {
  const s = useStore()
  const t = useT()
  const ids = includedBuildingIds(s)
  const status = visibleConfigurationStatus(s, ids)
  const building = buildingName(s, s.activeBuildingId)
  const requiredSteps = activeBuildingConfiguratorSteps({
    coverage: s.coverage,
    mode: 'intern',
  })
  const requiredStepNames = new Intl.ListFormat(
    s.uiLanguage === 'de' ? 'de-DE' : 'en-GB',
    { style: 'long', type: 'conjunction' },
  ).format(requiredSteps.map((step) => t(`chapter.${step.id}`)))
  const detail = status === 'open'
    ? t('configurator.status.openDetail', { steps: requiredStepNames })
    : t(`configurator.status.${status}Detail`)
  const action = s.configurationMode === 'SHARED'
    ? t('configurator.status.confirmShared')
    : t('configurator.status.confirmBuilding', { building })
  const actionable = s.mode === 'intern' && (status === 'ready' || status === 'recheck')

  if (actionable) {
    return (
      <section className="mt-5" aria-label={statusLabel(status, t)}>
        <NextStep
          label={statusLabel(status, t)}
          description={detail}
          action={action}
          onAction={() => s.confirmVisibleConfiguration()}
        />
      </section>
    )
  }

  return (
    <section
      className="mt-5 border-y border-border-subtle py-4"
      aria-label={statusLabel(status, t)}
    >
      <Badge sign={status === 'confirmed' ? '✓' : '○'}>
        {statusLabel(status, t)}
      </Badge>
      <p className="mt-2 text-small text-text-secondary">{detail}</p>
    </section>
  )
}

function ConfigurationOverview() {
  const s = useStore()
  const t = useT()
  const ids = includedBuildingIds(s)
  return (
    <SectionSheet title={t('configurator.overview.title')}>
      <ReadinessChecklist
        label={t('configurator.overview.label')}
        items={ids.map((id) => {
          const status = configurationDisplayStatusFor(s, id)
          return {
            id,
            label: buildingName(s, id),
            ready: status === 'confirmed',
            detail: statusLabel(status, t),
          }
        })}
      />
    </SectionSheet>
  )
}

/**
 * Task 03 (deep-coherence audit, F-24): this panel used to state "Kalkulation
 * noch nicht gestartet" unconditionally, including on re-entering mode
 * choice/edit with an option that already has a full existing calculation
 * (`pricingStarted === true`) — false. The heading now reads the actual
 * state and names that the existing configuration is preserved instead.
 */
/**
 * SIDEBAR 01 (backlog eda1e221, SB-27): the notice content on its own, no
 * `<aside>` wrapper — reused two ways: standalone inside
 * `ConfigurationModeReadiness`'s own rail (when there is no existing
 * calculation to preserve visibly) and as `OfferPanel`'s `footer` when a
 * priced offer opens "Modus ändern" (App.tsx), so the commercial context
 * stays visible and the notice is added beside it, not substituted for it.
 */
export function ModeChangeNotice({ headingLevel = 2 as 2 | 3 }: { headingLevel?: 2 | 3 } = {}) {
  const t = useT()
  const started = useStore().pricingStarted
  const headingKey = started
    ? 'configurator.mode.readiness.preserved'
    : 'buildingScope.readiness.pricingNotStarted'
  const bodyKey = started
    ? 'configurator.mode.readiness.preservedBody'
    : 'configurator.sidebar.body'
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div className="p-6">
      <Heading className="text-heading-2 font-bold text-text-primary">
        {t(headingKey)}
      </Heading>
      <p className="mt-2 text-small text-text-secondary">
        {t(bodyKey)}
      </p>
    </div>
  )
}

export function ConfigurationModeReadiness() {
  const t = useT()
  const started = useStore().pricingStarted
  const headingKey = started
    ? 'configurator.mode.readiness.preserved'
    : 'buildingScope.readiness.pricingNotStarted'
  return (
    <aside
      aria-label={t(headingKey)}
      className="flex h-full w-panel-right min-w-0 max-w-panel-right shrink-0 flex-col overflow-y-auto border-l border-border-strong bg-surface-default"
    >
      <ModeChangeNotice />
    </aside>
  )
}

const HINT_STORAGE_PREFIX = 'all3.hints.v1.'
const HINT_MAX_SHOWS = 3

/**
 * Task 03 (deep-coherence audit, F-40): guidance-system.md §2 L3 layer —
 * a contextual hint shows on first visit, closes, and fades after three
 * shows (a per-user counter), never as permanent furniture. This is a
 * small product-local composition, not a new canonical primitive: no
 * dismissable/fading contextual-hint contract exists yet in the Design
 * System (CANONICAL DESIGN SYSTEM GAP, non-blocking — flagged, not
 * invented here). The counter lives in its own localStorage namespace,
 * deliberately separate from `all3.proposal.v1.*` (`persistence.ts`): it
 * is a per-viewer UI preference, never proposal/commercial state.
 *
 * Known limitation: guidance-system.md also expects a hint to stay
 * reachable again via "?" after it fades. No such help affordance exists
 * anywhere in the product yet (not just for chapter intros) — building one
 * is a larger, cross-cutting feature outside this task's owned findings.
 */
function useFadingHint(id: string): { visible: boolean; dismiss: () => void } {
  const [count, setCount] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem(HINT_STORAGE_PREFIX + id)
      return raw === null ? 0 : Number(raw)
    } catch {
      return 0
    }
  })
  useEffect(() => {
    if (count >= HINT_MAX_SHOWS) return
    try {
      window.localStorage.setItem(HINT_STORAGE_PREFIX + id, String(count + 1))
    } catch {
      // Storage unavailable (private mode, quota) — the hint simply shows
      // every visit instead of fading; never block the chapter on this.
    }
    // Runs once per mount (per `id`): this records "this hint was shown",
    // it does not react to `count` changing again within the same mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  const dismiss = () => {
    setCount(HINT_MAX_SHOWS)
    try {
      window.localStorage.setItem(HINT_STORAGE_PREFIX + id, String(HINT_MAX_SHOWS))
    } catch {
      // See above — dismiss still hides it for this render either way.
    }
  }
  return { visible: count < HINT_MAX_SHOWS, dismiss }
}

/**
 * Карточка раздела внутри главы: заголовок H3 из шкалы, воздух, бордер.
 * `intro` — коучинг-подсказка для sales: в презентации не существует
 * (правило 11); данные карточки остаются. Больше не постоянная мебель
 * (F-40): затухает после трёх показов или закрывается вручную.
 */
function Card({ title, intro, children }: {
  title: string
  intro?: string
  children: ReactNode
}) {
  const mode = useStore().mode
  const t = useT()
  const tx = useTx()
  const hint = useFadingHint(title)
  const showIntro = Boolean(intro) && mode === 'intern' && hint.visible
  return (
    <SectionSheet
      title={tx(title)}
      intro={showIntro ? (
        <>
          {tx(intro!)}
          {' '}
          <Button variant="ghost" onClick={hint.dismiss}>
            {t('configurator.hint.dismiss')}
          </Button>
        </>
      ) : undefined}
    >
      <div className="mt-3">{children}</div>
    </SectionSheet>
  )
}

/**
 * Semantic step SCOPE_BOUNDARIES (Leistungsabgrenzung) — welche
 * Kostengruppen Teil des Angebots sind, die Konfigurationsmodus-Wahl, plus
 * die projektweiten Anforderungen an Energiestandard und Zertifizierung.
 * Hier beginnt die Kalkulation (`pricingStarted`,
 * building-aware-configurator-navigation).
 *
 * Reihenfolge nach DIN 276 (KG 200 · 300 · 400 · 500 · 600 · 700).
 *
 * Aktueller Vertrag (CPO, Ticket "Rebuild Project Card Workflow") — ERSETZT
 * den Vertrag der 22.08.2026-Ticket-Revision dieses Docblocks für drei
 * Gruppen und ergänzt ihn um Modus/Energie:
 * · KG 300/400/700 sind MANDATORY: immer `included`, keine Kachel zum
 *   Ausschließen (`store.ts`'s `MANDATORY_COST_GROUPS`/`setCoverage`
 *   verweigern jede andere Wertänderung). Sie erscheinen als eine einzelne,
 *   gesperrte, angehakte `CheckboxCard`-Kachel mit `■ Pflicht` — genau der
 *   Vertrag, den die 22.08.2026-Revision als "abgelöst" beschrieb, jetzt
 *   wiederhergestellt, weil diese Aufgabe ihn explizit erneut fordert.
 * · KG 200/500/600 bleiben echte binäre Enthalten/Nicht-enthalten-
 *   Entscheidungen, Default `nicht enthalten`, keine Vorauswahl.
 * · KG 800 ist keine Scope-Boundaries-Entscheidung mehr: keine Kachel, keine
 *   Zeile, keine deaktivierte Karte. `coverage.KG_800` bleibt dauerhaft
 *   `excluded` (dormant, siehe `migrateCoverage`) — bestehende Daten werden
 *   nicht gelöscht, nur nie wieder aktiv.
 * · Konfigurationsmodus (SHARED/PER_BUILDING) wird HIER gewählt
 *   (`ConfigurationModeSection`), nicht mehr auf einem vorgeschalteten
 *   Vollbild-Gate — bis er bestätigt ist, zeigt dieser Schritt nur die
 *   Moduswahl.
 * · Energiestandard/QNG/DGNB (früher "Energie & Zertifikate", eigenes
 *   Kapitel) werden HIER editiert — die einzige verbleibende
 *   Bearbeitungsstelle; KG 300/400 zeigen weiterhin nur den
 *   schreibgeschützten Kontext (`EnergyCertBanner`).
 * · KG 200/500/600 tragen vollständige mehrstufige Kataloge
 *   (`ScopeCatalogChapter`, eigene `_DETAILS`-Kapitel) statt einer flachen
 *   Einzelrate — dieselbe dynamische DIN-Reihenfolge-Navigation, die
 *   KG 300/400/700 bereits nutzten (`state/chapters.ts`).
 * · KG 100 (Grundstück) bleibt außerhalb dieses Tickets und `notApplicable`.
 *
 * "Zeitwirkung" wird nicht erfunden: engine/schedule.ts hängt ausschließlich
 * von BGF, Gebäudeform und Gebäudeklasse ab, nicht von der Abdeckung
 * einzelner Kostengruppen — eine KG-Zeitwirkung wäre eine neue Formel ohne
 * Quelle (D-22 erlaubt Ableitung, nicht Erfindung ohne jede Basis).
 */
function ChapterUmfang() {
  const s = useStore()
  const t = useT()
  const tx = useTx()

  // Part 11: Configuration Mode is chosen as the first Scope Boundaries
  // decision. Until it is confirmed, nothing else on this step is shown —
  // KG inclusion, energy standard and certification all depend on a
  // building-aware calculation that only starts once the mode is set
  // (`confirmConfigurationMode` is what flips `pricingStarted`).
  if (!(s.configurationModeChosen && !s.configurationModeEditing)) {
    return <ConfigurationModeSection />
  }

  const p = s.projection()
  // A complex projection can carry the same project-level gap once per
  // building. The scope card presents that decision once, so its notice must
  // do the same (and must not emit duplicate React keys).
  const incompleteReasons = [...new Map(p.result.incompleteReasons.map((reason) => [
    reason.code + ('groups' in reason ? reason.groups.join() : ''),
    reason,
  ])).values()]
  const scopeStatus = scopeBoundariesStatus(s)
  const nextStep = activeConfiguratorWorkflow({ coverage: s.coverage, mode: s.mode })[1]
  const scopeEmpty = isScopeUniverseEmpty(s.coverage)

  return (
    <div className="grid gap-5">
      <Card
        title={t('configurator.scopeBoundaries.title')}
        intro={t('configurator.scope.introBinary')}
      >
        <div className="grid gap-5">
          {SCOPE_ORDER.map((g) => {
            const spec = COVERAGE_RATES[g]
            if ((MANDATORY_COST_GROUPS as readonly CostGroup[]).includes(g)) {
              // Part 12: mandatory groups appear "clearly as included, not
              // unresolved" — the canonical locked/checked tile
              // (`CheckboxCard.mandatory`) already built for exactly this
              // presentation (OPTION-002/OPTION-005), just reconnected to
              // Scope Boundaries KG inclusion instead of the product-local
              // option it originally shipped for.
              return (
                <CheckboxCard
                  key={g}
                  legend={`${g.replace('_', NNBSP)} ${t(`costGroup.${g}`)}`}
                  options={[{
                    value: 'included',
                    title: tx(COVERAGE_LABEL.included),
                    image: optionImage('scopeBoundaries', g),
                    description: spec ? `${tx(spec.basis)} ⚙` : undefined,
                    consequence: tx('aktuelle Auswahl'),
                    checked: true,
                    onChange: () => {},
                    mandatory: true,
                    mandatoryReason: 'Kern des Angebots',
                  }]}
                />
              )
            }
            // Последствие приходит из ТОЙ ЖЕ проекции, что и клик: и охват
            // считается по ВСЕМ включённым зданиям, а не по активному.
            // Прежде плитка умножала ставку на площадь активного здания и
            // обещала +230.000 €, тогда как итог менялся на +368.000 €
            // (сплошное ревью 26, находка 13; предложение № 1 исследования
            // рычага). Второй калькулятор последствия расходится молча.
            const outcome = (v: CoverageState) =>
              s.coverage[g] === v ? null : s.outcomeOf({ kind: 'coverage', group: g, value: v })
            const tile = (v: Extract<CoverageState, 'included' | 'excluded'>, title: string, zero: string) => ({
              value: v,
              title,
              image: optionImage('scopeBoundaries', g),
              description: v === 'included' && spec ? `${tx(spec.basis)} ⚙` : undefined,
              consequence: s.coverage[g] === v
                ? tx('aktuelle Auswahl')
                : consequenceLabel(outcome(v)!.delta, zero),
            })
            return (
              <div key={g}>
                <RadioCardGroup
                  legend={`${g.replace('_', NNBSP)} ${t(`costGroup.${g}`)}`}
                  value={s.coverage[g]}
                  onChange={(v) => s.setCoverage(g, v as CoverageState)}
                  onPreview={(v) => s.previewOption(
                    v ? { kind: 'coverage', group: g, value: v as CoverageState } : null,
                  )}
                  options={[
                    tile('included', tx(COVERAGE_LABEL.included),
                         tx('ohne Preisansatz im indikativen Angebot')),
                    tile('excluded', tx(COVERAGE_LABEL.excluded),
                         tx('Entscheidung, keine Lücke: die Summe bleibt vollständig')),
                  ]}
                />
                {g === 'KG_200' && (
                  <p data-testid="kg-200-servicing-status"
                     className="a3-cap mt-2">
                    {t('configurator.scopeBoundaries.servicingStatus', {
                      status: tx(COVERAGE_LABEL[s.coverage.KG_200]),
                    })}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Part 11/14: Energiestandard/QNG/DGNB editing moves here from the
          former standalone "Energie & Zertifikate" chapter (Task 03 had
          made that chapter the single editable owner with this step
          read-only; this ticket reverses that direction by explicit newer
          authority). KG 300/400 keep showing the read-only
          `EnergyCertBanner` context — unchanged, still correct once this is
          the one editable source it links to. */}
      <Card
        title={t('configurator.energy.title')}
        intro={'Die Wahl einer Option ist keine Bestätigung: das Unsicherheitsband ' +
          'verengt sich erst, wenn der Kunde den Standard bestätigt.'}
      >
        <EnergiestandardPicker />
        {!s.esConfirmed && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
            <p className="a3-cap">{tx('Standard gewählt, vom Kunden noch nicht bestätigt — Band unverändert.')}</p>
            <Button onClick={() => s.confirmEnergiestandardAnswer()}>{tx('Vom Kunden bestätigt')}</Button>
          </div>
        )}
        {s.esConfirmed && (
          <p className="mt-4 border-t border-border-subtle pt-3 text-small text-text-secondary">
            <span aria-hidden="true">✓ </span>
            Vom Kunden bestätigt — Unsicherheitsband um 4{NNBSP}Prozentpunkte verengt.
          </p>
        )}
      </Card>
      {/* Zertifikate sind eine eigene Achse: der Energiestandard beschreibt
          das Gebäude, das Siegel beschreibt das Verfahren, mit dem es
          nachgewiesen wird (see options.ts). */}
      <OptionChapter groups={ZERT_GROUPS}
        intro={'Zertifikate sind eine eigene Achse: der Energiestandard '
          + 'beschreibt das Gebäude, das Siegel beschreibt das Verfahren, '
          + 'mit dem es nachgewiesen wird.'} />

      <Card title={t('coverage.effectOnTotal')}>
        {scopeEmpty ? (
          // Task 03 (F-10): every KG group is at its determinate `excluded`
          // default — a genuinely empty scope, not an open decision. Never
          // assert a Gesamtpreis (or a Zwischensumme, which still implies
          // at least one calculated position) over nothing.
          <p className="text-body text-text-primary">
            <span aria-hidden="true">○ </span>
            {t('offerPanel.empty.sentence')}
            <span className="mt-1 block text-small font-normal text-text-secondary">
              {t('configurator.scope.emptyDetail')}
            </span>
          </p>
        ) : (<>
          <p className="text-body text-text-primary">{tx(p.result.totalLabel)}</p>
          {p.result.completeness === 'incomplete' && (
            /* Правило 11: у клиента предупреждение свёрнуто в нейтральную
               точку, у продавца остаётся списком причин, с которым можно
               работать. Существенная проблема сюда не попадает по
               построению: с ней клиентский вид не открывается вовсе. */
            <ClientNotice clientText="Einzelne Kostengruppen sind noch nicht entschieden — das Angebot weist deshalb eine Zwischensumme aus.">
              <ul className="mt-2">
                {incompleteReasons.map((r) => (
                  <li key={r.code + ('groups' in r ? r.groups.join() : '')}
                      className="a3-cap">
                    <span aria-hidden="true">○ </span>
                    {tx(incompleteReasonText(r, s.mode))}
                  </li>
                ))}
              </ul>
            </ClientNotice>
          )}
          {p.result.completeness === 'complete' && (
            <p className="a3-cap mt-2">
              <span aria-hidden="true">✓ </span>{tx('Alle Deckungsentscheidungen getroffen und keine offenen wesentlichen Punkte — das Angebot weist einen Gesamtpreis aus.')}</p>
          )}
        </>)}
      </Card>

      <Card title={t('configurator.scope.confirmHeading')}>
        <NextStep
          label={scopeStatus === 'recheck'
            ? t('configurator.scope.recheckTag')
            : scopeStatus === 'confirmed'
              ? t('configurator.scope.confirmedTag')
              : t('configurator.scope.confirmHeading')}
          description={scopeStatus === 'recheck'
            ? t('configurator.scope.changed')
            : t('configurator.scope.confirmAndContinueHelp')}
          action={scopeStatus === 'confirmed'
            ? t('configurator.scope.continue')
            : t('configurator.scope.confirmAndContinue')}
          onAction={() => {
            if (scopeStatus !== 'confirmed') s.confirmScopeBoundaries()
            if (nextStep) s.openConfiguratorStepAt(nextStep.id)
          }}
        />
      </Card>
    </div>
  )
}

// KG 800 removed ("Rebuild Project Card Workflow" Part 13): no tile, no
// disabled placeholder — see the `ChapterUmfang` docblock above.
const SCOPE_ORDER: CostGroup[] =
  ['KG_200', 'KG_300', 'KG_400', 'KG_500', 'KG_600', 'KG_700']

/**
 * Energiestandard-Auswahl, extrahiert aus `ChapterEnergie` (unten), damit
 * Leistungsabgrenzung dieselbe Kachel-Auswahl zeigen kann, OHNE die
 * bestehende Kunden-Bestätigung (`esConfirmed`) zu duplizieren — die bleibt
 * ausschließlich im Schritt "Energie & Zertifikate".
 */
/**
 * Modulweite Beschriftung, damit `EnergiestandardPicker` UND der neue
 * `EnergyCertBanner` (KG 300/400) dieselbe Quelle zeigen — zwei Kopien
 * derselben Zuordnung hätten genau die Klasse von Fehler zugelassen, die
 * dieser Datei-Kopfkommentar an anderer Stelle beschreibt (ein Fakt, zwei
 * Namen).
 */
const LABEL_ES: Record<BuildingInput['energiestandard'], string> = {
  GEG: 'GEG-Standard', EH_55: `Effizienzhaus${NNBSP}55`, EH_40: `Effizienzhaus${NNBSP}40`,
  EH_40_NH: `Effizienzhaus${NNBSP}40${NNBSP}NH (QNG)`,
}

function EnergiestandardPicker() {
  const s = useStore()
  const tx = useTx()
  return (
    <RadioCardGroup
      legend={tx('Energiestandard')}
      legendHidden
      value={activeBuilding(s).energiestandard}
      onChange={(v) => s.setEnergiestandard(v)}
      onPreview={(v) =>
        s.previewOption(v ? { kind: 'energiestandard', value: v } : null)}
      options={(['GEG', 'EH_55', 'EH_40', 'EH_40_NH'] as const).map((v) => ({
        value: v,
        title: LABEL_ES[v],
        consequence: activeBuilding(s).energiestandard === v
          ? 'aktuelle Auswahl'
          : consequenceLabel(s.optionDelta({ kind: 'energiestandard', value: v })),
      }))}
    />
  )
}

function certLabel(groupId: 'qng' | 'dgnb', value: string): string {
  const group = ZERT_GROUPS.find((g) => g.id === groupId)
  return group?.choices.find((c) => c.value === value)?.label ?? value
}

/**
 * KG 300/400 (тикет): контекстная шапка глав — уже выбранный
 * Energiestandard и Zertifikat плюс явное предупреждение о фильтрации.
 * Тот же композиционный приём, что у `ConfigurationModeContext` (полоса
 * border-y выше содержимого главы, жирная строка + пояснение вторым
 * рядом) — второго варианта «полосы контекста» в системе не заводится.
 *
 * Значение читается из текущего состояния здания напрямую, а не из факта
 * посещения главы 4: Energiestandard уже имеет T0-умолчание и уже
 * редактируется в главе 2 (`EnergiestandardPicker`, см. комментарий выше),
 * поэтому баннер корректен независимо от порядка обхода глав (D-08 —
 * данные не бывают «ещё не существующими», только неподтверждёнными).
 */
function EnergyCertBanner() {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const b = activeBuilding(s)
  const chosen = choicesFor(s, b.id)
  const qng = chosen['qng'] ?? 'keins'
  const dgnb = chosen['dgnb'] ?? 'keins'
  const certParts = [
    qng !== 'keins' ? `QNG ${certLabel('qng', qng)}` : null,
    dgnb !== 'keins' ? `DGNB ${certLabel('dgnb', dgnb)}` : null,
  ].filter((v): v is string => v !== null)
  return (
    <section
      aria-label={tx('Energie- und Zertifizierungskontext')}
      className="flex flex-wrap items-start justify-between gap-3 border-y border-border-subtle py-3"
    >
      <p className="text-body text-text-primary">
        <strong>
          {tx('Energiestandard')}: {LABEL_ES[b.energiestandard]}
          {certParts.length > 0 && <> · {tx('Zertifikat')}: {certParts.join(' · ')}</>}
        </strong>
        <span className="mt-1 block text-small font-normal text-text-secondary">
          {tx('Die folgenden Auswahlmöglichkeiten sind bereits auf diesen Standard abgestimmt.')}
        </span>
      </p>
      {s.mode === 'intern' && (
        <Button variant="ghost" onClick={() =>
          s.openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)}>
          {t('configurator.energy.goTo', {
            chapterName: t('chapter.scopeBoundaries'),
          })}
        </Button>
      )}
    </section>
  )
}

/**
 * KG 300 (тикет), Punkte 3–4 «Underground floor» / «Underground-floor use»:
 * bewusst KEINE zweite interaktive Kontrolle. Der Kommentar bei der
 * `Untergeschoss`-Kachel in `ChapterUmfang` (Leistungsabgrenzung) nennt den
 * Grund konkret: dieselbe Wahl existierte einst ein zweites Mal als
 * `ugVariante` in KG 300 und führte zu einer echten Doppelabrechnung des
 * Untergeschosses — Zahlen wichen 36 €/m² von der Spezifikation ab (Review
 * 26, Befunde 5 und 19), behoben, indem „ein Entschluss — ein Eigentümer"
 * wurde. Diese Karte ZEIGT den bereits getroffenen Zustand und verlinkt zu
 * seinem Eigentümer, statt ihn hier zweiten Mal editierbar zu machen —
 * funktional erfüllt das die Anforderung „sichtbar in KG 300", ohne den
 * bekannten Fehler erneut einzuführen.
 *
 * "Rebuild Project Card Workflow" Part 16: the former owner, the standalone
 * "Flächen im Detail" Configurator chapter, is removed. `BuildingScope.tsx`
 * is now the sole editable owner of the Untergeschoss decision (the same
 * per-building surface that already owns every other building-level fact
 * this recap could point to), and the link below routes there.
 *
 * `hasParking` (Tiefgarage) hat im Store noch keinen eigenen Setter — der
 * Wert kommt ausschließlich aus der Gebäudeprüfung (Building & Scope).
 * Auch hier reine Anzeige statt einer erfundenen Mutation (siehe
 * Implementierungsbericht, bekannte Einschränkung dieses Kandidaten).
 *
 * Task 02 (F-01/F-15): in SHARED mode this recap now renders one line per
 * INCLUDED building instead of only `activeBuildingId`'s — Untergeschoss is
 * always a per-building fact, never part of `sharedConfiguration`, so an
 * unnamed single line silently misrepresented whichever other building
 * wasn't currently active. PER_BUILDING mode is unchanged: its own tab
 * already names the building unambiguously.
 */
function UndergroundFloorRecap() {
  const s = useStore()
  const tx = useTx()
  const t = useT()
  const { fadeRise } = useSemanticMotion()
  const ids = s.configurationMode === 'SHARED'
    ? includedBuildingIds(s)
    : [s.activeBuildingId]
  const multi = ids.length > 1
  return (
    <Card
      title={t('configurator.basement.title')}
      intro={t('configurator.underground.decidedIn')}
    >
      <div className="grid gap-4">
        {ids.map((id) => {
          const b = s.buildings[id]!
          const included = b.untergeschoss !== 'kein_ug'
          return (
            <div key={id} className={multi ? 'border-b border-border-subtle pb-4 last:border-0 last:pb-0' : undefined}>
              {multi && (
                <p className="text-small font-medium text-text-primary">
                  {t('configurator.underground.title', { building: buildingName(s, id) })}
                </p>
              )}
              <p className={'text-body text-text-primary' + (multi ? ' mt-1' : '')}>
                <span aria-hidden="true">{included ? '● ' : '▲ '}</span>
                {included ? tx('Enthalten') : tx('Nicht enthalten')}
              </p>
              <AnimatePresence initial={false} mode="wait">
                {included && (
                  <motion.div
                    key={`ug-included-detail-${id}`}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={fadeRise}
                  >
                    <p className="a3-cap mt-1">{LABEL_UG[b.untergeschoss]}</p>
                    <p className="a3-cap mt-2">
                      {b.hasParking
                        ? tx('Tiefgarage im Untergeschoss enthalten.')
                        : tx('Keine Tiefgarage im Untergeschoss.')}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
      <div className="mt-3">
        {/* "Flächen im Detail" (the former sole owner of this decision) was
            removed by "Rebuild Project Card Workflow" Part 16; Building
            Scope is now the authoritative editing location, matching every
            other building-level fact this product already routes there. */}
        <Button onClick={() => s.setPipelineView('buildingScope')}>
          {t('configurator.areas.review')}
        </Button>
      </div>
    </Card>
  )
}

/**
 * The basement belongs to Building & Scope.  KG 300 makes that consequential
 * decision prominent, but deliberately routes edits back to its sole owner so
 * this chapter cannot recreate the historic double-calculation control.
 */
function Kg300PrimaryDecisions() {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const building = activeBuilding(s)
  const hasBasement = building.untergeschoss !== 'kein_ug'

  return (
    <section className="a3-config-kg300-primary">
      <div className="a3-config-decision-heading">
        <h2>{t('configurator.workstage.primaryDecisions')}</h2>
        <p>{t('configurator.workstage.selectionImpact')}</p>
      </div>
      <div className="a3-config-kg300-primary-grid">
        <section className="a3-config-kg300-basement" aria-labelledby="kg300-basement-decision">
          <p className="a3-meta">{t('configurator.basement.title')}</p>
          <h3 id="kg300-basement-decision">
            {hasBasement ? tx('Untergeschoss · Rohbau und Ausbau') : tx('Kein Untergeschoss')}
          </h3>
          <p>{hasBasement ? LABEL_UG[building.untergeschoss] : tx('ohne unterirdische Flächen')}</p>
        </section>
        <OptionChapter
          groups={KG300_GROUPS.filter((group) => group.id === 'fassade')}
          intro=""
          variant="workstage"
          footnote="hide"
        />
      </div>
    </section>
  )
}

/**
 * KG 300's compact work-stage context. It reads the same selected option,
 * building metrics and projection that own the live controls; it never adds
 * a second calculation or a Configurator-side building mutation.
 */
function Kg300WorkContext() {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const building = activeBuilding(s)
  const selected = choicesFor(s, building.id)
  const facadeGroup = KG300_GROUPS.find((group) => group.id === 'fassade')
  const facadeValue = selected.fassade ?? facadeGroup?.default ?? 'timber'
  const facadeChoice = facadeGroup?.choices.find((choice) => choice.value === facadeValue)
  const media = optionImage('fassade', facadeValue)
  const projection = s.projection()

  return (
    <>
      {media && (
        <figure className="a3-config-selection-visual">
          <img src={media.url} alt="" width={480} height={320} />
          <figcaption>{facadeChoice ? tx(facadeChoice.label) : facadeValue}</figcaption>
        </figure>
      )}

      <section className="a3-config-selection-impact" aria-labelledby="kg300-selection-impact">
        <p id="kg300-selection-impact" className="a3-meta">
          {t('configurator.workstage.selectionImpact')}
        </p>
        <p className="a3-config-selection-name">
          {facadeChoice ? tx(facadeChoice.label) : facadeValue}
        </p>
        {projection.kgSplit.KG_300 && (
          <p className="numeric a3-config-selection-value">
            <span>{t('configurator.workstage.currentKg300')}</span>
            {moneyLabel(present(projection.kgSplit.KG_300))}
          </p>
        )}
      </section>

      <section className="a3-config-building-context" aria-labelledby="kg300-building-context">
        <h2 id="kg300-building-context">{t('configurator.workstage.buildingContext')}</h2>
        <div className="a3-config-building-context-list">
          {includedBuildingIds(s).map((id) => {
            const item = s.buildings[id]!
            const totalBgf = bgfAboveGround(item).plus(item.bgfBelowGround)
            return (
              <div key={id}>
                <span>{buildingName(s, id)}</span>
                <strong className="numeric">{present(totalBgf).display}{NNBSP}m² BGF R+S</strong>
              </div>
            )
          })}
        </div>
        <UndergroundFloorRecap />
      </section>
    </>
  )
}

/**
 * Semantic step COMMERCIAL_SCHEDULE — Bauzeit-Leiste (DC-19).
 *
 * Фазы берутся из метрик фикстуры, а не назначаются здесь: планирование —
 * величина уровня проекта, исполнение — уровня здания, и это разные строки
 * в `schedule.metrics`. Веха завершения — самый поздний конец исполнения
 * СРЕДИ ВСЕХ включённых зданий (rule 39: max, не одно случайно выбранное
 * здание), то же значение, что показывает герой срока в правой панели: два
 * представления одной даты обязаны приходить из одного места.
 *
 * Task 02 (deep-coherence audit, F-17): прежде здесь была ровно одна строка
 * исполнения, жёстко привязанная к `building:DEMO-B-A.execution` —
 * фикстура уже содержала `building:DEMO-B-B.execution`
 * (до 2028-01-04, позже Haus A), но эта глава её не читала, и Haus B не
 * существовал в расписании вовсе. Теперь одна строка исполнения на КАЖДОЕ
 * включённое здание, с его собственным именем.
 */
/**
 * Construction Period (тикет): Baubeginn wählen. Verschiebt NUR den Anker
 * des `ScheduleModel` (`shiftScheduleMetrics`, `engine/schedule.ts`) — keine
 * neue Dauerformel, `dur`/`durationLabel` bleiben unverändert, weil die
 * Modell-Dauer nur von `BGF oberirdisch`/`Form`/`GK` abhängt (§4), nicht vom
 * Kalenderdatum. Erste Produktion des kontraktierten `FormField`-Varianten
 * `date` (components-core.md §FormField) — bislang ungenutzt im Produkt.
 */
function ConstructionStartDateField() {
  const s = useStore()
  const tx = useTx()
  const value = s.constructionStartDate
    ? new Date(`${s.constructionStartDate}T00:00:00`)
    : null

  // The store owns an ISO date-only string. Never serialize through UTC:
  // `toISOString()` can shift the selected calendar day for local timezones.
  const toLocalIsoDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return (
      <DateField
        label={tx('Baubeginn')}
        name="construction-start-date"
      helperText={tx('Verschiebt die Termine unten; die Bauzeit selbst bleibt gleich.')}
      value={value}
      onCommit={(date) => s.setConstructionStartDate(date ? toLocalIsoDate(date) : null)}
    />
  )
}

// Task 02: one execution color per included building, cycling the same
// dataviz category scale planning already uses category-1 from.
const EXECUTION_COLOR_VARS = [
  '--color-dataviz-category-2', '--color-dataviz-category-3',
]

function ChapterTermine() {
  const s = useStore()
  const tx9 = useTx()
  const t = useT()
  const metrics = demo.schedule.metrics
  const planningFixture = metrics.find((m) => m.metricKey === 'project.planning')!
  const includedIds = includedBuildingIds(s)
  const executionFixtures = includedIds.map((id) => ({
    id,
    fixture: metrics.find((m) => m.metricKey === `building:${id}.execution`)!,
  }))
  const shifted = s.constructionStartDate
    ? shiftScheduleMetrics(
      [planningFixture, ...executionFixtures.map((e) => e.fixture)],
      planningFixture.startDate,
      s.constructionStartDate,
    )
    : [planningFixture, ...executionFixtures.map((e) => e.fixture)]
  const planning = shifted.find((m) => m.metricKey === planningFixture.metricKey)!
  const executions = executionFixtures.map(({ id, fixture }) => ({
    id,
    metric: shifted.find((m) => m.metricKey === fixture.metricKey)!,
  }))
  // Rule 39: die Fertigstellung des Komplexes ist das SPÄTESTE Bauende
  // unter allen einbezogenen Gebäuden — nie ein einzelnes, zufällig
  // zuerst in der Liste stehendes Gebäude (F-17). Dieselbe Auswahl trifft
  // `computeProjection`'s Held-Dauer; beide lesen dieselbe Fixture.
  const latestExecution = executions.reduce((latest, current) => (
    current.metric.endDate > latest.metric.endDate ? current : latest
  ))
  // Planung: 3 Monate ist eine feste Katalogkonstante (calculation-spec §4),
  // unabhängig vom Anker. Aber ein verschobener Baubeginn kann die
  // Kalendergrenze aus einem GANZEN Kalendermonat herausschieben (Tech
  // Review P2, D-17): dann ist die Anzeige nicht mehr exakt und braucht das
  // `≈`-Präfix — genau das, was `presentDuration` bereits für die
  // Ausführung leistet, hier auf die feste Planungsdauer angewendet statt
  // eine zweite Rundungsregel zu erfinden.
  const planningDuration = presentDuration(
    {
      metricKey: planning.metricKey,
      kind: 'planning',
      startDate: planning.startDate,
      endDate: planning.endDate,
      durationBasis: 'calendarDay',
    },
    // Tech Review P3: die Katalogkonstante steht schon in der Fixture
    // (`project.planning.wholeCalendarMonths`) — hier nochmal `3` zu
    // schreiben hieße, denselben Fakt an zwei Stellen zu pflegen.
    new Decimal(planningFixture.wholeCalendarMonths!),
  )
  // Task 02: die Modell-Dauer je Zeile kommt aus dem BGF oberirdisch DIESES
  // Gebäudes — nie aus der Projekt-Summe (die bleibt für den Held reserviert,
  // s. computeProjection). Sonst trüge Haus B die Dauer-Schätzung, die auf
  // der BGF-Summe beider Gebäude beruht, statt auf seiner eigenen.
  const executionDurations = Object.fromEntries(executions.map(({ id, metric }) => [
    id,
    presentDuration(
      { ...metric, kind: 'buildingExecution', durationBasis: 'calendarDay' },
      modelDuration(bgfAboveGround(s.buildings[id]!), new Decimal('1.00'), new Decimal('1.15')),
    ),
  ]))

  return (
    <div className="grid gap-5">
      <Card
        title={t('configurator.schedule.title')}
        intro={'Planung ist Projektgröße, Ausführung gehört zum Gebäude — deshalb ' +
          'mehrere Zeilen und nicht eine. Die Fertigstellung ist dieselbe Zahl, die ' +
          'oben rechts als Kennzahl steht.'}
      >
        <ConstructionStartDateField />
        <div className="mt-4">
        <ScheduleGantt
          caption="Bauzeit nach Phasen mit Beginn, Ende, Dauer und Abhängigkeit"
          finishISO={latestExecution.metric.endDate}
          provenance={s.mode === 'intern'
            ? tx9('Kalender: Kalendermonate · Baubeginn aus dem Bauzeitplan')
            : undefined}
          phases={[
            {
              key: planning.metricKey,
              label: 'Planung',
              unit: 'Gesamtprojekt',
              dependency: 'Planungsbeginn',
              startISO: planning.startDate,
              endISO: planning.endDate,
              durationLabel: `${planningDuration.prefix}${planningDuration.prefix ? NNBSP : ''}${planningDuration.display}`,
              colorVar: '--color-dataviz-category-1',
            },
            ...executions.map(({ id, metric }, index) => {
              const dur = executionDurations[id]!
              return {
                key: metric.metricKey,
                label: 'Rohbau + Ausbau',
                unit: buildingName(s, id),
                dependency: 'nach Planung',
                startISO: metric.startDate,
                endISO: metric.endDate,
                durationLabel: `${dur.prefix}${dur.prefix ? NNBSP : ''}${dur.display} ab${NNBSP}OKBP`,
                colorVar: EXECUTION_COLOR_VARS[index % EXECUTION_COLOR_VARS.length]!,
              }
            }),
          ]}
        />
        </div>
        {s.mode === 'intern' && executions.length > 1 && (
          <p className="a3-cap mt-3">
            {t('configurator.schedule.completionOwner', {
              building: buildingName(s, latestExecution.id),
            })}
          </p>
        )}
      </Card>

      {/* Task 03 (deep-coherence audit, F-16/AC4): the confirm CTA is the
          last step of the chapter sequence — this project-scoped chapter
          previously said nothing about it, so "Nächster Schritt" below
          looked like the genuine end of the road even with 0 of N
          buildings confirmed. Silent while everything is already
          confirmed (rule 30: `ready` needs no separate status surface). */}
      <ConfigurationCompleteNotice />

      {/* Последняя глава конвейера обязана называть следующий шаг (DC-27):
          продолжение в левой навигации — это поиск, а не маршрут. Task 03
          (PD-3=yes): confirmation gates EXPORT, not this comparison step —
          comparing variants before confirming remains a legitimate, lower-
          stakes exploratory action. */}
      <div className="a3-nextstep">
        <p className="a3-mtag">{tx9('Nächster Schritt')}</p>
        <p className="text-body text-text-primary">
          {tx9('Die Konfiguration ist durchlaufen — weiter zum Vergleich der Optionen nebeneinander.')}
        </p>
        <div className="mt-2">
          <Button variant="primary" onClick={() => s.setPipelineView('vergleich')}>
            {tx9('Varianten vergleichen')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Task 03 (deep-coherence audit, F-16/AC4): the aggregate confirm CTA at
 * the end of the chapter sequence. `configurationComplete()` already
 * combines Scope Boundaries confirmation with every included building's
 * own confirmation (`ConfigurationStatusStrip`, rendered earlier per
 * building) — this does not duplicate that derivation or its confirm
 * action, it names whichever prerequisite is still outstanding and routes
 * there. Renders nothing once everything is already confirmed.
 */
function ConfigurationCompleteNotice() {
  const s = useStore()
  const t = useT()
  const scopeStatus = scopeBoundariesStatus(s)
  const scopeMissing = scopeStatus !== 'confirmed'
  const outstandingBuildings = includedBuildingIds(s)
    .filter((id) => configurationDisplayStatusFor(s, id) !== 'confirmed')

  if (!scopeMissing && outstandingBuildings.length === 0) return null

  return (
    <Card title={t('configurator.confirmConfig.title')}>
      <NextStep
        label={t('configurator.finalGate.label')}
        description={scopeMissing
          ? t('configurator.finalGate.scopeBoundariesOutstanding')
          : t('configurator.finalGate.buildingsOutstanding', {
              buildings: buildingNames(s, outstandingBuildings),
            })}
        action={t('configurator.finalGate.action')}
        onAction={() => {
          if (scopeMissing) {
            s.openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
            return
          }
          if (s.configurationMode === 'PER_BUILDING') {
            s.setConfigurationScope(outstandingBuildings[0]!)
          }
          // Energie & Zertifikate (the former first building-scoped step)
          // was removed by "Rebuild Project Card Workflow" Part 15; KG 300
          // is now the first building-scoped chapter and, since it is
          // mandatory, is always applicable — the same "land on a real
          // building-scoped chapter" outcome this gate always intended.
          s.openConfiguratorStepAt(CONFIGURATOR_STEP.KG_300_DETAILS)
        }}
      />
    </Card>
  )
}

/**
 * Semantic step KG_700_DETAILS — preparation, not negotiation (Punkt 12).
 *
 * Клиент видит, что KG 700 включена, и её долю в смете. Каким способом
 * она посчитана — HOAI и AHO собственной ставкой или распределением
 * 70/22/8 — внутреннее решение: клиенту оно ничего не объясняет, а
 * продавцу даёт другую цену. Поэтому в презентации глава не существует
 * (правило 11), а не показывается свёрнутой.
 */
function ChapterKg700() {
  const tx = useTx()
  const t = useT()
  const s = useStore()
  const p = s.projection()
  const all3Available = s.coverage.KG_300 === 'included'
    && s.coverage.KG_400 === 'included'

  if (s.mode === 'praesentation') {
    return (
      <div className="a3-sheet">
        <p className="text-body text-text-secondary">
          <span aria-hidden="true">○ </span>{tx('Die Berechnungsart der Baunebenkosten ist eine interne Einstellung und im Präsentationsmodus nicht verfügbar.')}</p>
        <p className="a3-cap mt-2">
          Für den Kunden gilt unverändert: KG{NNBSP}700 ist im Angebot
          enthalten, ihr Anteil steht in der Kostenübersicht.
        </p>
      </div>
    )
  }

  return (
    <div className="a3-config-kg700-stage">
      <section className="a3-config-kg700-method" aria-labelledby="kg700-method-question">
        <div className="a3-config-kg700-method-heading">
          <p className="a3-meta">{t('configurator.kg700.calcMethod.title')}</p>
          <h2 id="kg700-method-question">{t('configurator.kg700.methodQuestion')}</h2>
          <span>{t('configurator.kg700.wholeComplex')}</span>
        </div>
        <div className="a3-config-kg700-decision">
          <SegmentedControl
            legend={t('kg700.calculationMethod')}
            value={s.kg700Mode}
            onChange={(m) => s.setKg700Mode(m)}
            options={[
              {
                value: 'vereinfacht',
                label: t('kg700.all3Method'),
                disabled: !all3Available,
                disabledReason: t('kg700.all3UnavailableReason'),
              },
              { value: 'hoaiAho', label: t('kg700.hoaiAhoMethod') },
            ]}
          />
          <div className="a3-config-kg700-impact">
            <p className="a3-cap">
              {s.kg700Mode === 'vereinfacht'
                ? t('kg700.distributionUnchanged')
                : t('kg700.separateDriverRow')}
            </p>
            {/* В режиме echt доли KG 700 внутри блока нет: она стоит своей
                позицией и живёт в водопаде, а не в разбивке блока. */}
            {p.kgSplit.KG_700 && (
              <p className="numeric mt-3 text-body text-text-primary">
                Anteil KG{NNBSP}700: {moneyLabel(present(p.kgSplit.KG_700))}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="a3-config-kg700-result-grid">
        <section className="a3-config-kg700-results" aria-labelledby="kg700-impact">
          <h2 id="kg700-impact">{t('configurator.kg700.impact')}</h2>
          <dl>
            <div>
              <dt>{tx(p.result.totalLabel)}</dt>
              <dd className="numeric">{moneyLabel(present(p.result.total.exact))}</dd>
            </div>
            {p.kgSplit.KG_700 && (
              <div>
                <dt>KG{NNBSP}700</dt>
                <dd className="numeric">{moneyLabel(present(p.kgSplit.KG_700))}</dd>
              </div>
            )}
            <div>
              <dt>{t('configurator.kg700.clientRepresentation')}</dt>
              <dd>{t('configurator.kg700.included')}</dd>
            </div>
          </dl>
        </section>
        <section className="a3-config-kg700-readiness" aria-labelledby="kg700-readiness">
          <h2 id="kg700-readiness">{t('configurator.kg700.decisionSet')}</h2>
          <p>{t('configurator.kg700.decisionSetDetail')}</p>
        </section>
      </div>
    </div>
  )
}

/**
 * KG 300 (тикет), Punkt 9 «Ground Conditions & Access»: дословно тот же
 * приём accept/ignore, что уже жил в главе «Baugrund & Erschließung» —
 * `s.risikoAktiv`/`s.toggleRisiko`/`s.outcomeOf({kind:'risiko',...})`
 * без изменений, риск остаётся НАЗВАННЫМ независимо от состояния (кнопка
 * не выключает риск из реальности, только из сметы). Секция переехала в
 * KG 300 по требованию тикета; сама механика — уже согласованная,
 * production-проверенная, коммерческая логика не меняется.
 */
function GroundRiskSection() {
  const s = useStore()
  const tx = useTx()
  const t = useT()
  const kg300Exact = s.projection().kgSplit.KG_300

  return (
    <Card
      title={t('configurator.groundAccess.title')}
      intro={'Der Baugrund entscheidet über Gründung und KG 320. Ohne '
        + 'Gutachten bleibt er ein benanntes Risiko — kein Preisbestandteil '
        + 'und keine stillschweigende Annahme.'}
    >
      {/* Типизированные риски фикстуры: категория · вероятность ·
          ставка · НАЗВАННАЯ база. Надбавка — реальные деньги (D-02),
          и её сумма считается от своей группы затрат, а не «примерно
          от KG 300»: для этого и появился третий уровень KG. */}
      {RISK_ITEMS.map((r) => {
        const d = riskDriver(r, kg300Exact)
        const on = s.risikoAktiv[r.id] === true
        return (
          <div key={r.id} className="a3-konflikt mt-3">
            <p className="text-body text-text-primary">
              <span aria-hidden="true">{on ? '● ' : '▲ '}</span>
              {tx(r.label)}
            </p>
            <div className="a3-kv">
              <span>
                <span className="a3-cap block">{tx('Kategorie')}</span>
                {tx(r.kategorie)}
              </span>
              <span>
                <span className="a3-cap block">{tx('Wahrscheinlichkeit')}</span>
                {tx(r.wahrscheinlichkeit)}
              </span>
              <span>
                <span className="a3-cap block">
                  {tx('Zuschlag')} · {(Number(r.rate) * 100).toFixed(0)}{NNBSP}%
                  {' '}{tx('auf')} {r.base.replace('_', NNBSP)}
                </span>
                <span className="numeric">
                  {d ? moneyLabel(present(d.exact)) : '—'}
                </span>
              </span>
            </div>
            <p className="a3-cap mt-2">
              {on
                ? tx('Im Angebot enthalten. Der Zuschlag ist die Rechnung für ein fehlendes Dokument und entfällt, sobald es vorliegt.')
                : tx('Noch nicht im Angebot. Die Schätzunsicherheit bleibt davon unberührt: sie ist Statistik und wird nicht addiert.')}
            </p>
            <p className="a3-cap mt-1">
              <span aria-hidden="true">→ </span>{tx(r.remedy)}
            </p>
            {/* Последствие видно ДО клика и приходит из той же проекции
                (R-05, предложение № 1 исследования рычага). Прежде у
                надбавки будущего итога не было вовсе: сумма самой
                надбавки есть, а «сколько станет» продавец складывал
                в голове. */}
            <p className="a3-cap mt-1 numeric">
              {consequenceLabel(
                s.outcomeOf({ kind: 'risiko', id: r.id, active: !on }).delta,
              )}
            </p>
            <div className="a3-row mt-3">
              <Button
                variant={on ? 'secondary' : 'primary'}
                // Task 04 (F-03, P0): Klick war bisher nur Commit — ein
                // schon ausgelöstes Preview blieb stehen, bis ein separates
                // mouseleave/blur folgte (der Button behält den Fokus nach
                // dem Klick nativ). Commit löscht die Vorschau jetzt selbst,
                // wie in RadioCardGroup (controls.tsx).
                onClick={() => { s.toggleRisiko(r.id); s.previewOption(null) }}
                onMouseEnter={() =>
                  s.previewOption({ kind: 'risiko', id: r.id, active: !on })}
                onMouseLeave={() => s.previewOption(null)}
                onFocus={() =>
                  s.previewOption({ kind: 'risiko', id: r.id, active: !on })}
                onBlur={() => s.previewOption(null)}
              >
                {on ? tx('Zuschlag entfernen') : tx('Zuschlag anwenden')}
              </Button>
              {isVisibleInOutputProfile(s.mode, 'internalOnly') && (
                <Button onClick={() => s.opportunityId && s.openOpportunity(s.opportunityId)}>
                  {tx('Frage an den Kunden · in der Vorbereitung')}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </Card>
  )
}
