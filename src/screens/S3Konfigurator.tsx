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
  scopeBoundariesStatus,
  type ConfigurationDisplayStatus,
  type ConfigurationMode,
} from '../state/store'
import { NNBSP } from '../engine/money'
import { useT, useTx } from '../i18n'
import { incompleteReasonText } from '../i18n/reasons'
import {
  type BuildingInput,
  type CostGroup,
  type CoverageState,
} from '../engine/calculate'
import { Decimal } from 'decimal.js'
import {
  Button,
  NumericField,
  type ProvenancePresentation,
} from '../components/primitives'
import {
  Badge,
  FormField,
  NextStep,
  PageHeader,
  ReadinessChecklist,
  SectionSheet,
} from '../components/designSystem'
import { DataStateBlock } from '../components/DataStates'
import { ClientNotice } from '../components/ClientNotice'
import { RadioCardGroup, SegmentedControl, Switch } from '../components/controls'
import { optionImage } from '../assets/option-images'
import { ScheduleGantt } from '../components/ScheduleGantt'
import { OptionChapter } from './OptionChapter'
import {
  KG300_GROUPS, KG400_GROUPS, ZERT_GROUPS, COVERAGE_RATES,
} from '../engine/options'
import { ScopeCatalogChapter } from './ScopeCatalogChapter'
import {
  KG200_CATALOG_OPTIONS, KG500_CATALOG_OPTIONS, KG600_CATALOG_OPTIONS,
  KG800_CATALOG_OPTIONS,
} from '../engine/scopeCatalog'
import { RISK_ITEMS, riskDriver } from '../engine/risk'
import { presentDuration, shiftScheduleMetrics } from '../engine/schedule'
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
import {
  deriveConflictState,
  effectiveDerivedArea,
  effectiveFactValue,
  type BuildingFact,
  type FactSource,
} from '../state/buildingReview'

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
 * Имена изображений остались от снятой опции `ugVariante`: снимки сделаны
 * по TASK-18 и описывают ровно эти три состояния подвала. Соответствие
 * объявлено здесь, а не угадывается по совпадению строк.
 */
const UG_IMAGE_VALUE: Record<'vollausbau' | 'ab_decke' | 'kein_ug', string> = {
  vollausbau: 'rohbauAusbau',
  ab_decke: 'nurAusbau',
  kein_ug: 'keins',
}

const KG_LABELS: Record<CostGroup, string> = {
  KG_100: 'Grundstück', KG_200: 'Vorbereitende Maßnahmen',
  KG_300: 'Baukonstruktion', KG_400: 'Technische Anlagen',
  KG_500: 'Außenanlagen', KG_600: 'Ausstattung',
  KG_700: 'Baunebenkosten', KG_800: 'Finanzierung',
}

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
  const tx = useTx()
  if (!s.configurationModeChosen || s.configurationModeEditing) {
    return <ConfigurationModeEntry />
  }
  const workflow = activeConfiguratorWorkflow({ coverage: s.coverage, mode: s.mode })
  const currentId = nearestActiveConfiguratorStep({
    coverage: s.coverage,
    mode: s.mode,
  }, s.openConfiguratorStep)
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
    <div className="px-7 py-6">
      {/* Заголовок экрана — masthead витрины: крупный титул и мета на
          одной базовой линии, как в образце. */}
      <PageHeader
        title={tx(currentStep.label)}
        meta={t('s3.header.progress', {
          current: routeIndex + 1,
          total: workflow.length,
        })}
      />

      <ConfigurationModeContext />
      <ConfigurationScopeNavigation stepId={currentId} />

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
        <div className="py-5">
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
            <div className="grid gap-5">
              <EnergyCertBanner />
              <UndergroundFloorRecap />
              <OptionChapter groups={KG300_GROUPS}
                intro={'Von oben nach unten: erst der Umfang, dann die Konstruktion, '
                  + 'zuletzt die Oberfläche. Jede Antwort zeigt ihre Folge am Preis, '
                  + 'bevor sie gewählt wird.'} />
              <GroundRiskSection />
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
          {!totalOverview && currentId === CONFIGURATOR_STEP.ENERGY_CERTIFICATION && (
            <div className="grid gap-5">
              <ChapterEnergie />
              {/* Сертификаты — отдельная ось: EH описывает качество здания,
                  QNG и DGNB — процедуру его подтверждения (см. options.ts). */}
              <OptionChapter groups={ZERT_GROUPS}
                intro={'Zertifikate sind eine eigene Achse: der Energiestandard '
                  + 'beschreibt das Gebäude, das Siegel beschreibt das Verfahren, '
                  + 'mit dem es nachgewiesen wird.'} />
            </div>
          )}
          {!totalOverview && currentId === CONFIGURATOR_STEP.AREAS
            && <ChapterFlaechen />}
          {!totalOverview && currentId === CONFIGURATOR_STEP.KG_700_DETAILS
            && <ChapterKg700 />}
          {!totalOverview && currentId === CONFIGURATOR_STEP.KG_800_DETAILS
            && <ChapterKg800 />}
          {!totalOverview && currentId === CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE
            && <ChapterTermine />}
        </div>

        {/* Один следующий шаг всегда на экране (DC-27): маршрут, не принуждение. */}
        {!totalOverview && currentId !== CONFIGURATOR_STEP.SCOPE_BOUNDARIES && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          {previous ? (
            <Button onClick={() => s.openConfiguratorStepAt(previous.id)}>
              {t('s3.previousChapter', {
                number: routeIndex,
                title: tx(previous.label),
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
                title: tx(next.label),
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

function configuratorStepPosition(
  state: ReturnType<typeof useStore.getState>,
  stepId: ConfiguratorStepId,
): number {
  return activeConfiguratorWorkflow({ coverage: state.coverage, mode: state.mode })
    .findIndex((step) => step.id === stepId) + 1
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

function sourcePresentation(
  source: FactSource,
  t: ReturnType<typeof useT>,
): ProvenancePresentation | null {
  switch (source.kind) {
    case 'document':
      return { kind: 'document', label: t('buildingScope.provenance.document') }
    case 'customer':
      return {
        kind: 'customerConfirmed',
        label: t('buildingScope.provenance.customer'),
      }
    case 'derived':
      return { kind: 'derived', label: t('buildingScope.provenance.derived') }
    case 'unknown':
      return null
  }
}

function factPresentation<T>(
  fact: BuildingFact<T>,
  t: ReturnType<typeof useT>,
): ProvenancePresentation | null {
  if (fact.override) {
    return fact.override.actor === 'customer confirmation'
      ? { kind: 'customerConfirmed', label: t('buildingScope.provenance.customer') }
      : { kind: 'manual', label: t('buildingScope.provenance.manual') }
  }
  return sourcePresentation(fact.extracted.source, t)
}

function statusLabel(
  status: ConfigurationDisplayStatus,
  t: ReturnType<typeof useT>,
): string {
  return t(`configurator.status.${status}`)
}

function ConfigurationModeEntry() {
  const s = useStore()
  const t = useT()
  const selectedIds = includedBuildingIds(s)
  const names = buildingNames(s, selectedIds)
  const [draftMode, setDraftMode] = useState<ConfigurationMode | null>(
    s.configurationModeChosen ? s.configurationMode : null,
  )

  if (s.mode !== 'intern') {
    return (
      <div className="px-7 py-6">
        <PageHeader
          title={t('configurator.mode.title')}
          lede={t('configurator.mode.clientBlocked')}
        />
      </div>
    )
  }

  return (
    <div className="px-7 py-6">
      <PageHeader
        title={t('configurator.mode.title')}
        meta={t('configurator.mode.meta', { count: selectedIds.length })}
        lede={t('configurator.mode.lede')}
      />
      <SectionSheet>
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
      </SectionSheet>
    </div>
  )
}

function ConfigurationModeContext() {
  const s = useStore()
  const t = useT()
  const names = buildingNames(s, includedBuildingIds(s))
  const summary = s.configurationMode === 'SHARED'
    ? t('configurator.mode.currentShared', { buildings: names })
    : t('configurator.mode.currentPerBuilding')
  return (
    <section
      aria-label={t('configurator.mode.legend')}
      className="flex flex-wrap items-start justify-between gap-3 border-y border-border-subtle py-3"
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
        className="a3-tabs min-w-0 flex-1 flex-nowrap overflow-x-auto whitespace-nowrap"
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

function ConfigurationScopeNavigation({
  stepId,
}: {
  stepId: ConfiguratorStepId
}) {
  const s = useStore()
  const t = useT()
  const selectedIds = includedBuildingIds(s)
  const buildingScoped = configuratorStep(stepId).scope === 'building'
  const names = buildingNames(s, selectedIds)

  if (!buildingScoped) {
    return <p className="mt-4 text-small font-medium text-text-secondary">
      {t('configurator.scope.project')}
    </p>
  }
  if (s.configurationMode === 'SHARED') {
    return <p className="mt-4 text-small font-medium text-text-secondary">
      {t('configurator.scope.shared', { buildings: names })}
    </p>
  }

  const statuses = Object.fromEntries(selectedIds.map((id) => [
    id,
    configurationDisplayStatusFor(s, id),
  ])) as Record<string, ConfigurationDisplayStatus>
  const confirmed = selectedIds.filter((id) => statuses[id] === 'confirmed').length
  const options = [
    ...(selectedIds.length > 1 ? [{
      value: TOTAL_SCOPE,
      label: t('configurator.scope.total', { confirmed, total: selectedIds.length }),
    }] : []),
    ...selectedIds.map((id) => ({
      value: id,
      label: t('configurator.scope.building', {
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
  const tx = useTx()
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
  ).format(requiredSteps.map((step) => tx(step.label)))
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

export function ConfigurationModeReadiness() {
  const t = useT()
  return (
    <aside
      aria-label={t('buildingScope.readiness.pricingNotStarted')}
      className="flex h-full w-panel-right min-w-0 max-w-panel-right shrink-0 flex-col overflow-y-auto border-l border-border-strong bg-surface-default"
    >
      <div className="p-6">
        <h2 className="text-heading-2 font-bold text-text-primary">
          {t('buildingScope.readiness.pricingNotStarted')}
        </h2>
        <p className="mt-2 text-small text-text-secondary">
          {t('configurator.sidebar.body')}
        </p>
      </div>
    </aside>
  )
}

/**
 * Карточка раздела внутри главы: заголовок H3 из шкалы, воздух, бордер.
 * `intro` — коучинг-подсказка для sales: в презентации не существует
 * (правило 11), данные карточки остаются.
 */
function Card({ title, intro, children }: {
  title: string
  intro?: string
  children: ReactNode
}) {
  const mode = useStore().mode
  const tx = useTx()
  return (
    <SectionSheet title={tx(title)} intro={intro && mode === 'intern' ? tx(intro) : undefined}>
      <div className="mt-3">{children}</div>
    </SectionSheet>
  )
}

/**
 * Semantic step SCOPE_BOUNDARIES (Leistungsabgrenzung) — welche
 * Kostengruppen Teil des Angebots sind, plus die projektweiten
 * Anforderungen an Energiestandard und Zertifizierung. Hier beginnt die
 * Kalkulation (`pricingStarted`, building-aware-configurator-navigation).
 *
 * Reihenfolge nach DIN 276 (KG 200 · 300 · 400 · 500 · 600 · 700 · 800).
 *
 * Aktueller Vertrag (CPO, Ticket "MAKE ALL KG 200–800 SELECTABLE & ADD
 * COST-BEARING CONTENT…", 22.08.2026) — ERSETZT den früheren Vertrag
 * dieses Docblocks vollständig:
 * · ALLE SIEBEN Gruppen sind gleichrangige, echte binäre Entscheidungen:
 *   `enthalten` oder `nicht enthalten`, sonst nichts. Keine ist mandatory,
 *   keine ist gesperrt — auch KG 300/400/700 nicht mehr (das war ein
 *   älterer, inzwischen abgelöster Vertrag: "unveränderlich", gesperrte
 *   CheckboxCard-Kachel). Ausschließen behält die bisherige Konfiguration
 *   dormant (Konfiguration bleibt erhalten, siehe `configurator.scope.
 *   introBinary`).
 * · Kein drittes "noch offen"-Normalzustand mehr (D-18/D-29/SCOPE-001
 *   dadurch ausdrücklich abgelöst): Umfang startet `nicht enthalten`
 *   (Default), nicht in einer Lücke. `Gesamt netto` ist daher ein echter
 *   Gesamtpreis, sobald jede Gruppe einen bestimmten Wert trägt — nicht
 *   mehr grundsätzlich `Zwischensumme`, nur weil eine Gruppe unbesucht war.
 * · KG 200/500/600/800 tragen jetzt vollständige mehrstufige Kataloge
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

  return (
    <div className="grid gap-5">
      <Card
        title="Leistungsumfang nach DIN 276"
        intro={t('configurator.scope.introBinary')}
      >
        <div className="grid gap-5">
          {SCOPE_ORDER.map((g) => {
            const spec = COVERAGE_RATES[g]
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
                  legend={`${g.replace('_', NNBSP)} ${KG_LABELS[g]}`}
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

      <Card title="Energiestandard und Zertifizierung">
        <div className="grid gap-5">
          <EnergiestandardPicker />
          <OptionChapter groups={ZERT_GROUPS}
            intro={'Zertifikate sind eine eigene Achse: der Energiestandard '
              + 'beschreibt das Gebäude, das Siegel beschreibt das Verfahren, '
              + 'mit dem es nachgewiesen wird.'} />
        </div>
      </Card>

      <Card title="Folge für die Angebotssumme">
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
      </Card>

      <Card title="Leistungsabgrenzung bestätigen">
        <NextStep
          label={scopeStatus === 'recheck'
            ? tx('Leistungsabgrenzung erneut prüfen')
            : scopeStatus === 'confirmed'
              ? tx('Leistungsabgrenzung bestätigt.')
              : tx('Leistungsabgrenzung bestätigen')}
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

const SCOPE_ORDER: CostGroup[] =
  ['KG_200', 'KG_300', 'KG_400', 'KG_500', 'KG_600', 'KG_700', 'KG_800']

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
  return (
    <RadioCardGroup
      legend="Energiestandard"
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
          s.openConfiguratorStepAt(CONFIGURATOR_STEP.ENERGY_CERTIFICATION)}>
          {t('configurator.energy.goTo', {
            chapter: configuratorStepPosition(s, CONFIGURATOR_STEP.ENERGY_CERTIFICATION),
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
 * wurde. Diese Karte ZEIGT den bereits in Leistungsabgrenzung bestätigten
 * Zustand und verlinkt dorthin, statt ihn hier zweiten Mal editierbar zu
 * machen — funktional erfüllt das die Anforderung „sichtbar in KG 300",
 * ohne den bekannten Fehler erneut einzuführen.
 *
 * `hasParking` (Tiefgarage) hat im Store noch keinen eigenen Setter — der
 * Wert kommt ausschließlich aus der Gebäudeprüfung (Building & Scope).
 * Auch hier reine Anzeige statt einer erfundenen Mutation (siehe
 * Implementierungsbericht, bekannte Einschränkung dieses Kandidaten).
 */
function UndergroundFloorRecap() {
  const s = useStore()
  const tx = useTx()
  const t = useT()
  const { fadeRise } = useSemanticMotion()
  const b = activeBuilding(s)
  const included = b.untergeschoss !== 'kein_ug'
  return (
    <Card
      title="Untergeschoss"
      intro={'Entschieden in Leistungsabgrenzung — hier nur zur Einordnung sichtbar.'}
    >
      <p className="text-body text-text-primary">
        <span aria-hidden="true">{included ? '● ' : '▲ '}</span>
        {included ? tx('Enthalten') : tx('Nicht enthalten')}
      </p>
      <AnimatePresence initial={false} mode="wait">
        {included && (
          <motion.div
            key="ug-included-detail"
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
      <div className="mt-3">
        <Button onClick={() =>
          s.openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)}>
          {t('configurator.scopeBoundaries.goTo', {
            chapter: configuratorStepPosition(s, CONFIGURATOR_STEP.SCOPE_BOUNDARIES),
          })}
        </Button>
      </div>
    </Card>
  )
}

function derivedAboveGroundPresentation(
  state: ReturnType<typeof useStore.getState>,
  buildingId: string,
  t: ReturnType<typeof useT>,
): ProvenancePresentation | null {
  const review = state.buildingReviews[buildingId]
  if (!review) return null
  const area = effectiveDerivedArea(review, state.buildingConflicts, 'bgfRSAbove')
  if (area.basis === 'components') {
    return { kind: 'derived', label: t('buildingScope.provenance.derived') }
  }
  if (area.basis === 'resolved' && area.conflict) {
    const conflict = state.buildingConflicts[area.conflict.id]
    const selectedId = conflict ? deriveConflictState(conflict).selectedCandidateId : null
    const candidate = conflict?.candidates.find((item) => item.id === selectedId)
    if (candidate?.origin === 'manual') {
      return { kind: 'manual', label: t('buildingScope.provenance.manual') }
    }
    if (candidate) return sourcePresentation(candidate.source, t)
  }
  return factPresentation(review.facts.bgfRSAbove, t)
}

function UnavailableConfiguratorFact({
  building,
  field,
  onReview,
}: {
  building: string
  field: string
  onReview: () => void
}) {
  const t = useT()
  return (
    <DataStateBlock
      state="partial"
      sentence={t('configurator.areas.unavailable', { building, field })}
      remedy={t('configurator.areas.remedy', { building })}
      action={(
        <Button variant="secondary" onClick={onReview}>
          {t('configurator.areas.review')}
        </Button>
      )}
    />
  )
}

function ChapterFlaechen() {
  const t = useT()
  const s = useStore()
  const buildingId = s.activeBuildingId
  const review = s.buildingReviews[buildingId]
  const building = buildingName(s, buildingId)
  const aboveGround = review
    ? effectiveDerivedArea(review, s.buildingConflicts, 'bgfRSAbove')
    : null
  const aboveGroundProvenance = derivedAboveGroundPresentation(s, buildingId, t)
  const wfl = review ? effectiveFactValue(review.facts.wfl) : null
  const wflProvenance = review ? factPresentation(review.facts.wfl, t) : null
  const units = review ? effectiveFactValue(review.facts.units) : null
  const unitsProvenance = review ? factPresentation(review.facts.units, t) : null
  const reviewBuilding = () => s.setPipelineView('buildingScope')

  return (
    <div className="grid gap-5">
      <Card
        title={t('configurator.areas.title', { building })}
        intro={'Geprüfte Gebäudewerte tragen ihre Herkunft; Änderungen heben ' +
          'die Bestätigung auf und werden in Gebäude & Umfang erneut geprüft.'}
      >
        {aboveGround?.value && aboveGroundProvenance ? (
          <NumericField
            label={t('buildingScope.fact.bgfRSAbove')}
            value={aboveGround.value}
            unit="m²"
            provenance={aboveGroundProvenance}
            onCommit={(value, confirmed) => s.setBuildingFactOverride(
              buildingId,
              'bgfRSAbove',
              value,
              confirmed ? 'customer confirmation' : 'sales-user',
            )}
          />
        ) : (
          <UnavailableConfiguratorFact
            building={building}
            field={t('buildingScope.fact.bgfRSAbove')}
            onReview={reviewBuilding}
          />
        )}
        {wfl && wflProvenance ? (
          <NumericField
            label={t('buildingScope.fact.wfl')}
            value={wfl}
            unit="m²"
            provenance={wflProvenance}
            onCommit={(value, confirmed) => s.setBuildingFactOverride(
              buildingId,
              'wfl',
              value,
              confirmed ? 'customer confirmation' : 'sales-user',
            )}
          />
        ) : (
          <UnavailableConfiguratorFact
            building={building}
            field={t('buildingScope.fact.wfl')}
            onReview={reviewBuilding}
          />
        )}
        {units && unitsProvenance ? (
          <NumericField
            label={t('buildingScope.fact.units')}
            value={units}
            decimals={0}
            integer
            provenance={unitsProvenance}
            onCommit={(value, confirmed) => s.setBuildingFactOverride(
              buildingId,
              'units',
              value,
              confirmed ? 'customer confirmation' : 'sales-user',
            )}
          />
        ) : (
          <UnavailableConfiguratorFact
            building={building}
            field={t('buildingScope.fact.units')}
            onReview={reviewBuilding}
          />
        )}
      </Card>

      <Card
        title="Untergeschoss"
        intro={'Die Vorschau am Preis erscheint beim Zeigen auf eine Option — ' +
          'entschieden ist erst der Klick.'}
      >
        {/* Одно решение — один владелец. Прежде тот же выбор существовал
            ВТОРОЙ раз опцией `ugVariante` в главе KG 300, со своими
            дельтами −714 / −1190 от слитой ставки 1.190: числа расходились
            со спецификацией на 36 €/m², а два контрола над одной физической
            областью позволяли вычесть подвал дважды (ревью 26, находки 5 и
            19). Ось принадлежит уровню Building (D-11 v2), цену считает
            движок по трём ставкам каталога — а карточки с изображениями
            переехали сюда, потому что выбор объёма подвала и должен
            выглядеть выбором, а не полем формы. */}
        <RadioCardGroup
          legend="Untergeschoss"
          legendHidden
          value={activeBuilding(s).untergeschoss}
          onChange={(v) => s.setUntergeschoss(v)}
          onPreview={(v) =>
            s.previewOption(v ? { kind: 'untergeschoss', value: v } : null)}
          options={(['vollausbau', 'ab_decke', 'kein_ug'] as const).map((v) => ({
            value: v,
            title: LABEL_UG[v],
            image: optionImage('ugVariante', UG_IMAGE_VALUE[v]),
            consequence: activeBuilding(s).untergeschoss === v
              ? 'aktuelle Auswahl'
              : consequenceLabel(s.optionDelta({ kind: 'untergeschoss', value: v })),
          }))}
        />
      </Card>
    </div>
  )
}

function ChapterEnergie() {
  const tx = useTx()
  const s = useStore()
  return (
    <div className="grid gap-5">
      <Card
        title="Energiestandard"
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
    </div>
  )
}

/**
 * Semantic step COMMERCIAL_SCHEDULE — Bauzeit-Leiste (DC-19).
 *
 * Фазы берутся из метрик фикстуры, а не назначаются здесь: планирование —
 * величина уровня проекта, исполнение — уровня здания, и это разные строки
 * в `schedule.metrics`. Веха завершения — конец исполнения Haus A, то же
 * значение, что показывает герой срока в правой панели: два представления
 * одной даты обязаны приходить из одного места.
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
  const id = 'construction-start-date'
  return (
    <FormField
      label={tx('Baubeginn')}
      htmlFor={id}
      helperText={tx('Verschiebt die Termine unten; die Bauzeit selbst bleibt gleich.')}
    >
      {/* `.a3-form-field input` (components.css) trägt bereits Rahmen,
          Hit-Target-Höhe und Fokusring über den globalen `:focus-visible`-
          Token — kein eigener Wrapper, keine eigene Fokus-Klasse (Tech
          Review P1: eine `<span>`-Hülle als FormField-Kind bricht das
          `cloneElement`-Contract: `id`/`aria-describedby` landeten auf der
          Hülle statt auf dem Eingabefeld, das Feld hatte keinen
          barrierefreien Namen). Direktes `<input>`, wie jeder andere
          FormField-Aufrufer im Produkt. */}
      <input
        type="date"
        value={s.constructionStartDate ?? ''}
        onChange={(e) => s.setConstructionStartDate(e.target.value || null)}
      />
    </FormField>
  )
}

function ChapterTermine() {
  const s = useStore()
  const tx9 = useTx()
  const metrics = demo.schedule.metrics
  const planningFixture = metrics.find((m) => m.metricKey === 'project.planning')!
  const hausFixture = metrics.find((m) => m.metricKey === 'building:DEMO-B-A.execution')!
  const shifted = s.constructionStartDate
    ? shiftScheduleMetrics(
      [planningFixture, hausFixture], planningFixture.startDate, s.constructionStartDate,
    )
    : [planningFixture, hausFixture]
  const planning = shifted.find((m) => m.metricKey === planningFixture.metricKey)!
  const haus = shifted.find((m) => m.metricKey === hausFixture.metricKey)!
  // Подпись длительности исполнения — из ТОЙ ЖЕ проекции, что герой срока
  // в панели: два представления одной величины из одного места. Дата
  // Baubeginn сдвигает Kalenderdaten, nicht diese modellierte Dauer.
  const dur = s.projection().duration
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

  return (
    <div className="grid gap-5">
      <Card
        title="Bauzeit"
        intro={'Planung ist Projektgröße, Ausführung gehört zum Gebäude — deshalb ' +
          'zwei Zeilen und nicht eine. Die Fertigstellung ist dieselbe Zahl, die ' +
          'oben rechts als Kennzahl steht.'}
      >
        <ConstructionStartDateField />
        <div className="mt-4">
        <ScheduleGantt
          caption="Bauzeit nach Phasen mit Beginn, Ende, Dauer und Abhängigkeit"
          finishISO={haus.endDate}
          provenance={s.mode === 'intern'
            ? tx9('Kalender: Kalendermonate · Staffelstart aus ScheduleModel')
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
            {
              key: haus.metricKey,
              label: 'Rohbau + Ausbau',
              unit: `Haus${NNBSP}A`,
              dependency: 'nach Planung',
              startISO: haus.startDate,
              endISO: haus.endDate,
              durationLabel: `${dur.prefix}${dur.prefix ? NNBSP : ''}${dur.display} ab${NNBSP}OKBP`,
              colorVar: '--color-dataviz-category-2',
            },
          ]}
        />
        </div>
      </Card>

      {/* Последняя глава конвейера обязана называть следующий шаг (DC-27):
          продолжение в левой навигации — это поиск, а не маршрут. */}
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
    <div className="grid gap-5">
      {/* F27: die Card trug bislang denselben Titel wie das Kapitel selbst
          (chrome3.chapter.kg700 = das H1 der Seite) — Duplikat, nicht
          Struktur. Jede andere Card in diesem Screen (Untergeschoss,
          Energiestandard, Bauzeit, Baugrund & Zufahrt …) nennt ihren
          eigenen Abschnitt statt das Kapitel zu wiederholen. */}
      <Card
        title="Berechnungsart"
        intro={t('remainder5.ancillary.twoMethods')}
      >
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
        <p className="a3-cap mt-3">
          {s.kg700Mode === 'vereinfacht'
            ? t('kg700.distributionUnchanged')
            : t('kg700.separateDriverRow')}
        </p>
        {/* В режиме echt доли KG 700 внутри блока нет: она стоит своей
            позицией и живёт в водопаде, а не в разбивке блока. */}
        {p.kgSplit.KG_700 && (
          <p className="numeric mt-2 text-body text-text-primary">
            Anteil KG{NNBSP}700: {moneyLabel(present(p.kgSplit.KG_700))}
          </p>
        )}
      </Card>
    </div>
  )
}

/**
 * KG 800 (Finanzierung) — тикет "MAKE ALL KG 200–800 SELECTABLE…". Как
 * KG 700, приватная (`visibility: internalOnly`, `state/chapters.ts`) —
 * die Kundenansicht erreicht dieses Kapitel nie. Subtotal fließt trotzdem
 * immer in Gesamt netto (Anhang §11 "Client/private financing boundary").
 *
 * "Für dieses Meeting freigeben" schaltet das Recht frei, die Aufschlüsselung
 * (nicht die rohen %-Parameter) auch in der Kundenansicht zu zeigen —
 * Standard: aus (M-3: der Zustand gehört zum versendeten Snapshot). Die
 * client-seitige Recap-Oberfläche, die diesen Zustand konsumiert, ist
 * separat zu verdrahten (siehe Frontend-Handoff, bekannte Einschränkung) —
 * dieses Kapitel liefert den autoritativen Speicherort und Schalter dafür.
 */
function ChapterKg800() {
  const s = useStore()
  const t = useT()
  const p = s.projection()
  const breakdown = p.result.drivers.filter((d) => d.key.startsWith('kg800_'))
  const subtotal = breakdown.reduce((sum, d) => sum.plus(d.exact), new Decimal(0))

  return (
    <div className="grid gap-5">
      <ScopeCatalogChapter
        options={KG800_CATALOG_OPTIONS}
        introDe="Finanzierung bildet Kosten bis zum Nutzungsbeginn aus Fremdkapital, Finanzierungsnebenkosten, Bereitstellung, Bürgschaften und optional kalkulatorischem Eigenkapital ab."
        introEn="Financing estimates cost up to start of use from debt interest, financing fees, commitment charges, guarantees and optional imputed equity interest."
      />
      <Card title="Aufschlüsselung KG 800">
        {breakdown.length === 0 ? (
          <p className="a3-cap">
            {t('configurator.scopeCatalog.kg800NoBasis')}
          </p>
        ) : (
          <>
            <ul className="grid gap-1">
              {breakdown.map((d) => (
                <li key={d.key} className="flex items-center justify-between gap-3">
                  <span className="text-body text-text-primary">{d.label}</span>
                  <span className="numeric text-body text-text-primary">
                    {moneyLabel(present(d.exact))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="numeric mt-3 text-heading-3 font-bold text-text-primary">
              KG{NNBSP}800{NNBSP}Subtotal: {moneyLabel(present(subtotal))}
            </p>
          </>
        )}
        <div className="mt-4 border-t border-border-subtle pt-3">
          <Switch
            label={t('configurator.scopeCatalog.kg800RevealSwitch')}
            checked={s.kg800ClientRevealed}
            onChange={(v) => s.setKg800ClientRevealed(v)}
          />
          <p className="a3-cap mt-1">
            {t('configurator.scopeCatalog.kg800RevealHelp')}
          </p>
        </div>
      </Card>
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
  const kg300Exact = s.projection().kgSplit.KG_300

  return (
    <Card
      title="Baugrund & Zufahrt"
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
                onClick={() => s.toggleRisiko(r.id)}
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
