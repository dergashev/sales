import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  activeBuilding,
  BUILDING_SCOPED_CHAPTERS,
  configurationDisplayStatusFor,
  includedBuildingIds,
  useStore,
  COVERAGE_LABEL,
  LABEL_UG,
  scopeBoundariesStatus,
  SCOPE_BOUNDARIES_DECIDABLE_GROUPS,
  type ConfigurationDisplayStatus,
  type ConfigurationMode,
} from '../state/store'
import { NNBSP } from '../engine/money'
import { useT, useTx } from '../i18n'
import { incompleteReasonText } from '../i18n/reasons'
import type { BuildingInput } from '../engine/calculate'
import type { CostGroup, CoverageState } from '../engine/calculate'
import { Decimal } from 'decimal.js'
import {
  Button,
  NumericField,
  type ProvenancePresentation,
} from '../components/primitives'
import {
  Badge,
  NextStep,
  PageHeader,
  ReadinessChecklist,
  SectionSheet,
} from '../components/designSystem'
import { DataStateBlock } from '../components/DataStates'
import { ClientNotice } from '../components/ClientNotice'
import { CheckboxCard, RadioCardGroup, SegmentedControl } from '../components/controls'
import { optionImage } from '../assets/option-images'
import { ScheduleGantt } from '../components/ScheduleGantt'
import { OptionChapter } from './OptionChapter'
import {
  KG300_GROUPS, KG400_GROUPS, ZERT_GROUPS, COVERAGE_RATES,
} from '../engine/options'
import { RISK_ITEMS, riskDriver } from '../engine/risk'
import demo from '../fixtures/demo-0001.json'
import { present, label as moneyLabel } from '../engine/money'
import {
  CLIENT_VISIBLE_CHAPTERS,
  chapterForOutputProfile,
  isClientProjection,
  isVisibleInOutputProfile,
} from '../state/clientProjection'
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

export const CHAPTERS = [
  'Leistungen KG 300', 'Leistungsabgrenzung', 'Technik KG 400',
  'Energie & Zertifikate', 'Flächen im Detail', 'Baugrund & Erschließung',
  'Baunebenkosten KG 700', 'Termine & Kommerzielles',
] as const

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
  const tx = useTx()
  const client = isClientProjection(s.mode)
  if (!s.configurationModeChosen || s.configurationModeEditing) {
    return <ConfigurationModeEntry />
  }
  const n = chapterForOutputProfile(s.mode, s.openChapter)
  const title = CHAPTERS[n - 1] ?? CHAPTERS[0]
  const chapterRoute: readonly number[] = client
    ? CLIENT_VISIBLE_CHAPTERS
    : [1, 2, 3, 4, 5, 6, 7, 8]
  const routeIndex = chapterRoute.indexOf(n)
  const previous = routeIndex > 0 ? chapterRoute[routeIndex - 1] : null
  const next = routeIndex >= 0 && routeIndex < chapterRoute.length - 1
    ? chapterRoute[routeIndex + 1]
    : null
  const buildingScoped = BUILDING_SCOPED_CHAPTERS.includes(
    n as typeof BUILDING_SCOPED_CHAPTERS[number],
  )
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
        title={tx(title)}
        meta={<>Kapitel {routeIndex + 1}{NNBSP}von{NNBSP}{chapterRoute.length} · Konfigurator</>}
      />

      <ConfigurationModeContext />
      <ConfigurationScopeNavigation chapter={n} />

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
          {!totalOverview && n === 1 && <OptionChapter groups={KG300_GROUPS}
            intro={'Von oben nach unten: erst der Umfang, dann die Konstruktion, '
              + 'zuletzt die Oberfläche. Jede Antwort zeigt ihre Folge am Preis, '
              + 'bevor sie gewählt wird.'} />}
          {!totalOverview && n === 2 && <ChapterUmfang />}
          {!totalOverview && n === 3 && <OptionChapter groups={KG400_GROUPS}
            intro={'Technische Anlagen nach DIN 276. Die Wahl der Erzeugung und der Lüftung entscheidet mit, welcher Energiestandard überhaupt erreichbar bleibt.'} />}
          {!totalOverview && n === 4 && (
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
          {!totalOverview && n === 5 && <ChapterFlaechen />}
          {!totalOverview && n === 6 && <ChapterBaugrund />}
          {!totalOverview && n === 7 && <ChapterKg700 />}
          {!totalOverview && n === 8 && <ChapterTermine />}
          {!totalOverview && ![1, 2, 3, 4, 5, 6, 7, 8].includes(n)
            && <ChapterParked title={title} />}
        </div>

        {/* Один следующий шаг всегда на экране (DC-27): маршрут, не принуждение. */}
        {!totalOverview && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          {previous ? (
            <Button onClick={() => s.openChapterAt(previous)}>
              ← Kapitel {routeIndex}: {tx(CHAPTERS[previous - 1]!)}
            </Button>
          ) : <span />}
          {next && (
            <Button
              variant={confirmationAvailable ? 'secondary' : 'primary'}
              onClick={() => s.openChapterAt(next)}
            >
              Weiter · Kapitel {routeIndex + 2}: {tx(CHAPTERS[next - 1]!)}
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
              description: t('configurator.mode.shared.description'),
              consequence: t('configurator.mode.shared.consequence', {
                buildings: names,
              }),
            },
            {
              value: 'PER_BUILDING',
              title: t('configurator.mode.perBuilding.title'),
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
          <Button onClick={() => s.setPipelineView('buildingScope')}>
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
  chapter,
}: {
  chapter: number
}) {
  const s = useStore()
  const t = useT()
  const selectedIds = includedBuildingIds(s)
  const buildingScoped = BUILDING_SCOPED_CHAPTERS.includes(
    chapter as typeof BUILDING_SCOPED_CHAPTERS[number],
  )
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
  const ids = includedBuildingIds(s)
  const status = visibleConfigurationStatus(s, ids)
  const building = buildingName(s, s.activeBuildingId)
  const detail = t(`configurator.status.${status}Detail`)
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
 * Глава 2 · Leistungsabgrenzung («Scope Boundaries», ticket d21f8d48) —
 * welche Kostengruppen Teil des Angebots sind, plus die projektweiten
 * Anforderungen an Energiestandard und Zertifizierung. Hier beginnt die
 * Kalkulation (`pricingStarted`, building-aware-configurator-navigation).
 *
 * Reihenfolge nach DIN 276 (KG 200 · 300 · 400 · 500 · 600 · 700), nicht
 * nach Entscheidungsart getrennt:
 * · KG 300, 400, 700 — Kern des Angebots, unveränderlich: ohne sie gibt es
 *   kein Angebot; bei KG 700 ist nur die Berechnungsart verhandelbar, und
 *   die ist intern (KG-700-Modus). Gezeigt als gesperrte CheckboxCard-
 *   Kachel (`mandatory`, components-core.md §CheckboxCard, OPTION-002/
 *   OPTION-005) — **nicht** `disabled`: eine wie abgeschaltet wirkende
 *   Pflichtposition wäre in einer Live-Präsentation ein Vertrauensproblem
 *   (Product Decision Brief auf diesem Ticket, RESOLVED DECISION #3;
 *   CPO-Vorgabe). Echte Ab-/Anwahl für diese drei würde eine neue,
 *   nicht autorisierte Kalkulations-Änderung voraussetzen (NON-GOAL "New
 *   pricing rules") und ist bewusst nicht Teil dieses Tickets.
 * · KG 200, 500, 600 — echte Entscheidung, ändert den Preis. Drei Zustände
 *   statt einer Checkbox, weil «nicht enthalten» eine Entscheidung ist und
 *   «noch offen» eine Lücke (D-18, SCOPE-001); solange eine Lücke bleibt,
 *   weist das Angebot eine Zwischensumme statt eines Gesamtpreises aus
 *   (R-18/CALC-006).
 * · KG 100 (Grundstück) und KG 800 (Finanzierung) liegen außerhalb dieses
 *   sechsteiligen Kartensatzes (Ticket-Vorgabe) und bleiben `notApplicable`.
 *
 * "Zeitwirkung" wird nicht erfunden: engine/schedule.ts hängt ausschließlich
 * von BGF, Gebäudeform und Gebäudeklasse ab, nicht von der Abdeckung
 * einzelner Kostengruppen — eine KG-Zeitwirkung wäre eine neue Formel ohne
 * Quelle (D-22 erlaubt Ableitung, nicht Erfindung ohne jede Basis).
 */
function ChapterUmfang() {
  const s = useStore()
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

  return (
    <div className="grid gap-5">
      <Card
        title="Leistungsumfang nach DIN 276"
        intro={'Sechs Kostengruppen bestimmen den Angebotsumfang. KG 300, 400 '
          + 'und 700 sind Kern des Angebots und nicht abwählbar — ohne sie '
          + 'gibt es kein Angebot; bei KG 700 ist nur die Berechnungsart '
          + 'verhandelbar, und die ist intern. KG 200, 500 und 600 sind '
          + 'echte Entscheidungen: «noch offen» ist eine Lücke, keine '
          + 'Entscheidung, und verhindert den Gesamtpreis, solange sie offen bleibt.'}
      >
        <div className="grid gap-5">
          {SCOPE_ORDER.map((g) => {
            if (MANDATORY_SCOPE_GROUPS.has(g)) {
              const share = p.kgSplit[g as 'KG_300' | 'KG_400' | 'KG_700']
              return (
                <CheckboxCard
                  key={g}
                  legend={`${g.replace('_', NNBSP)} ${KG_LABELS[g]}`}
                  options={[{
                    value: g,
                    title: tx(`${g.replace('_', NNBSP)} ${KG_LABELS[g]}`),
                    image: optionImage('scopeBoundaries', g),
                    // Geldwert und Übersetzung bleiben getrennte Textknoten
                    // (nicht verkettet, Regel 36/CALC-007): eine Verkettung
                    // von Zahl und Wort würde pro Kostengruppe einen eigenen,
                    // nie wiederverwendbaren „Rest" erzeugen.
                    description: tx('Immer Bestandteil des Angebots · kein Einfluss auf die Bauzeit — keine Auswahl.'),
                    consequence: share ? moneyLabel(present(share)) : tx('im Kostenwasserfall ausgewiesen'),
                    checked: true,
                    onChange: () => {},
                    mandatory: true,
                    mandatoryReason: 'Kern des Angebots',
                  }]}
                />
              )
            }
            const spec = COVERAGE_RATES[g]
            // Последствие приходит из ТОЙ ЖЕ проекции, что и клик: и охват
            // считается по ВСЕМ включённым зданиям, а не по активному.
            // Прежде плитка умножала ставку на площадь активного здания и
            // обещала +230.000 €, тогда как итог менялся на +368.000 €
            // (сплошное ревью 26, находка 13; предложение № 1 исследования
            // рычага). Второй калькулятор последствия расходится молча.
            const outcome = (v: CoverageState) =>
              s.coverage[g] === v ? null : s.outcomeOf({ kind: 'coverage', group: g, value: v })
            const tile = (v: CoverageState, title: string, zero: string) => ({
              value: v,
              title,
              description: v === 'included' && spec ? `${tx(spec.basis)} ⚙` : undefined,
              consequence: s.coverage[g] === v
                ? tx('aktuelle Auswahl')
                : consequenceLabel(outcome(v)!.delta, zero),
            })
            return (
              <RadioCardGroup
                key={g}
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
                  {
                    value: 'unknown' as const,
                    title: tx(COVERAGE_LABEL.unknown),
                    description: tx('Lücke, keine Entscheidung: das Angebot weist keinen Gesamtpreis aus'),
                    consequence: s.coverage[g] === 'unknown'
                      ? tx('aktuelle Auswahl')
                      : tx('Zwischensumme statt Gesamtpreis'),
                  },
                ]}
              />
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
        {scopeStatus === 'confirmed' ? (
          <p className="a3-cap">
            <span aria-hidden="true">✓ </span>
            {tx('Leistungsabgrenzung bestätigt.')}
          </p>
        ) : (
          <NextStep
            label={scopeStatus === 'recheck'
              ? tx('Leistungsabgrenzung erneut prüfen')
              : tx('Leistungsabgrenzung bestätigen')}
            description={scopeStatus === 'recheck'
              ? tx('KG 200/500/600, Energiestandard oder Zertifizierung haben sich seit der letzten Bestätigung geändert.')
              : tx('Erst nach Bestätigung gilt die nachfolgende Konfiguration als abschließbar.')}
            action={tx('Bestätigen')}
            onAction={() => s.confirmScopeBoundaries()}
          />
        )}
      </Card>
    </div>
  )
}

const SCOPE_ORDER: CostGroup[] =
  ['KG_200', 'KG_300', 'KG_400', 'KG_500', 'KG_600', 'KG_700']
// Tech Review P2 (ticket d21f8d48): derived from the store's single
// canonical decidable-groups list, not a second independently named set —
// the two could otherwise drift apart silently.
const MANDATORY_SCOPE_GROUPS = new Set<CostGroup>(
  SCOPE_ORDER.filter((g) => !(SCOPE_BOUNDARIES_DECIDABLE_GROUPS as readonly CostGroup[]).includes(g)),
)

/**
 * Energiestandard-Auswahl, extrahiert aus `ChapterEnergie` (unten), damit
 * Leistungsabgrenzung dieselbe Kachel-Auswahl zeigen kann, OHNE die
 * bestehende Kunden-Bestätigung (`esConfirmed`) zu duplizieren — die bleibt
 * ausschließlich in "Energie & Zertifikate" (Kapitel 4).
 */
function EnergiestandardPicker() {
  const s = useStore()
  const LABEL_ES: Record<BuildingInput['energiestandard'], string> = {
    GEG: 'GEG-Standard', EH_55: `Effizienzhaus${NNBSP}55`, EH_40: `Effizienzhaus${NNBSP}40`,
    EH_40_NH: `Effizienzhaus${NNBSP}40${NNBSP}NH (QNG)`,
  }
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
 * Глава 9 · Termine — Bauzeit-Leiste (DC-19).
 *
 * Фазы берутся из метрик фикстуры, а не назначаются здесь: планирование —
 * величина уровня проекта, исполнение — уровня здания, и это разные строки
 * в `schedule.metrics`. Веха завершения — конец исполнения Haus A, то же
 * значение, что показывает герой срока в правой панели: два представления
 * одной даты обязаны приходить из одного места.
 */
function ChapterTermine() {
  const s = useStore()
  const tx9 = useTx()
  const metrics = demo.schedule.metrics
  const planning = metrics.find((m) => m.metricKey === 'project.planning')!
  const haus = metrics.find((m) => m.metricKey === 'building:DEMO-B-A.execution')!
  // Подпись длительности исполнения — из ТОЙ ЖЕ проекции, что герой срока
  // в панели: два представления одной величины из одного места.
  const dur = s.projection().duration

  return (
    <div className="grid gap-5">
      <Card
        title="Bauzeit"
        intro={'Planung ist Projektgröße, Ausführung gehört zum Gebäude — deshalb ' +
          'zwei Zeilen und nicht eine. Die Fertigstellung ist dieselbe Zahl, die ' +
          'oben rechts als Kennzahl steht.'}
      >
        <ScheduleGantt
          caption="Bauzeit nach Phasen mit Beginn, Ende, Dauer und Abhängigkeit"
          finishISO={haus.endDate}
          provenance={s.mode === 'intern'
            ? tx9('Kalender: Kalendermonate · Staffelstart aus ScheduleModel · DEMO-SC-01')
            : undefined}
          phases={[
            {
              key: planning.metricKey,
              label: 'Planung',
              unit: 'Gesamtprojekt',
              dependency: 'Planungsbeginn',
              startISO: planning.startDate,
              endISO: planning.endDate,
              durationLabel: `3${NNBSP}Monate`,
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
 * Глава 8 · KG 700 — настройка ПОДГОТОВКИ, не переговоров (пункт 12).
 *
 * Клиент видит, что KG 700 включена, и её долю в смете. Каким способом
 * она посчитана — HOAI и AHO собственной ставкой или распределением
 * 70/22/8 — внутреннее решение: клиенту оно ничего не объясняет, а
 * продавцу даёт другую цену. Поэтому в презентации глава не существует
 * (правило 11), а не показывается свёрнутой.
 */
function ChapterKg700() {
  const tx = useTx()
  const s = useStore()
  const p = s.projection()

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
      <Card
        title={`Baunebenkosten KG${NNBSP}700`}
        intro={'Zwei Verfahren mit unterschiedlichem Ergebnis. Das All3-Verfahren '
          + 'verteilt die bereits berechnete Summe und ändert den Gesamtbetrag '
          + 'nicht; HOAI und AHO rechnen die Nebenkosten als eigene Position '
          + 'hinzu. Der Kunde sieht in beiden Fällen dieselbe Aussage: '
          + 'KG 700 ist enthalten.'}
      >
        <SegmentedControl
          legend="Berechnungsart KG 700"
          value={s.kg700Mode}
          onChange={(m) => s.setKg700Mode(m)}
          options={[
            { value: 'vereinfacht', label: 'All3-Verfahren 70/22/8' },
            { value: 'hoaiAho', label: 'nach HOAI und AHO' },
          ]}
        />
        <p className="a3-cap mt-3">
          {s.kg700Mode === 'vereinfacht'
            ? 'Der Gesamtbetrag bleibt unverändert — 70/22/8 verteilt, was bereits gerechnet ist.'
            : 'Die Nebenkosten kommen als eigene Zeile im Kostentreiber hinzu.'}
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
 * Честное состояние непроработанной главы (правило 30): прототип объявляет
 * границу своего объёма, вместо того чтобы показать пустоту или выдумку.
 */
/**
 * Глава 7 · Baugrund & Erschließung — глава ДАННЫХ, не выбора (дефект 4
 * ревью № 13: раньше здесь стояло «не проработано» посреди золотого пути).
 *
 * Содержание строго из источников: риск Baugrund — типизированная запись
 * фикстуры (категория · вероятность · Kostenwirkung +4 % auf KG 320,
 * calculation-spec §«Baugrundgutachten liegt nicht vor»); риск НЕ входит
 * в цену — он ось риска, не неопределённости, и до появления Gutachten
 * остаётся названным риском (CALC-001: оси не смешиваются). По
 * Erschließung документация фикстуры фактов не содержит — пустота названа
 * с источником, решение о KG 200 живёт в главе 3 и здесь только
 * показывается со ссылкой.
 */
function ChapterBaugrund() {
  const s = useStore()
  const tx = useTx()
  const kg200 = s.coverage.KG_200
  const kg300Exact = s.projection().kgSplit.KG_300

  return (
    <div className="grid gap-5">
      <Card
        title="Baugrund"
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

      <Card
        title="Erschließung"
        intro={'Erschließung gehört zu KG 200 — die Entscheidung über den '
          + 'Umfang fällt in Kapitel 3, hier steht ihr Stand.'}
      >
        {/* Пустота названа с источником (правило 30): факта нет в
            документации, и это не то же самое, что «его нет». */}
        <p className="a3-cap">
          <span aria-hidden="true">○ </span>{tx('Die Dokumentation der Opportunity enthält keine Angaben zur Erschließung — kein Wert wird angenommen.')}</p>
        <p className="mt-3 text-body text-text-primary">
          KG{NNBSP}200 im Angebot: {COVERAGE_LABEL[kg200]}
        </p>
        <div className="mt-2">
          <Button onClick={() => s.openChapterAt(3)}>{tx('Zu Kapitel 3 · Leistungsabgrenzung')}</Button>
        </div>
      </Card>
    </div>
  )
}

function ChapterParked({ title }: { title: string }) {
  const tx = useTx()
  return (
    <div className="a3-sheet">
      <p className="text-body text-text-primary">
        <span aria-hidden="true">○ </span>
        Kapitel «{title}» ist im Prototyp nicht ausgearbeitet.
      </p>
      <p className="mt-2 max-w-content text-small text-text-secondary">{tx('Die Kalkulation der Fixture hängt an den Kapiteln 2–4; dieses Kapitel zeigt im Prototyp bewusst keinen erfundenen Inhalt. Der volle Kapitelumfang ist in der Screen-Map spezifiziert.')}</p>
    </div>
  )
}
