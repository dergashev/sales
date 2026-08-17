import { Decimal } from 'decimal.js'
import demo from '../fixtures/demo-0001.json'
import opportunities from '../fixtures/opportunities.json'
import derived from '../fixtures/derived-prototype.json'
import { useStore, wflConflict } from '../state/store'
import { NNBSP, formatDE } from '../engine/money'
import { Button } from '../components/primitives'
import { useT, useTx } from '../i18n'
import { DocumentAnalysis } from '../components/DocumentAnalysis'
import { InternalNote } from '../components/InternalNote'
import { PrerequisiteChecklist } from '../components/PrerequisiteChecklist'
import { LinkButton, PageHeader } from '../components/designSystem'
import { STAGE_TAG } from '../lib/opportunityStage'
import { S2Vorbereitung } from './S2Vorbereitung'
import { useRef, useState, type RefObject } from 'react'

/**
 * Карточка Opportunity — уровень между списком и рабочим конвейером.
 *
 * Порядок на экране повторяет порядок работы, а не структуру данных:
 * сначала анализ документов, затем его результат, затем спорное, затем
 * то, что относится ко всему проекту, и только потом — гейт создания
 * Options. Пользователь не может создать Option раньше, чем разрешит
 * конфликты и подтвердит параметры: Option, построенный на спорных
 * данных, придётся переделывать целиком.
 *
 * Цены здесь нет и быть не может: цена принадлежит Option, а Option ещё
 * не существует. Показать сумму на этом уровне значило бы пообещать
 * число, у которого нет конфигурации.
 *
 * Шапка и обзор готовности (readiness overview, ниже) — это единственный
 * слой этой карточки, добавленный тикетом REBUILD PROJECT CARD SHELL:
 * они читают уже существующие поля состояния (`wflConflict`,
 * `projectParamsConfirmed`, `options`), а не заводят новые. Обзор — это
 * навигация (переход к разделу разрешён всегда, DC-13 STEP-003), а не
 * повторение действия: единственная кнопка, которая реально что-то
 * подтверждает или решает, живёт внутри самого раздела.
 */

const D = (s: string) => new Decimal(s)
const MARK = derived.marker
const DERIVED = derived.provenanceLabel

/** Значение с обязательной пометкой происхождения (D-22). */
function Metric({ label, value, unit, note }: {
  label: string
  value: string | null
  unit?: string
  /** Заполнено только у выведенных значений: пометка приходит из данных. */
  note?: string
}) {
  const tx = useTx()
  return (
    <div className="border-b border-border-subtle py-2">
      <span className="a3-cap block">{label}</span>
      <span className="numeric block text-body text-text-primary">
        {value === null
          ? <span className="text-text-secondary">{tx('nicht erfasst')}</span>
          : <>{value}{unit ? `${NNBSP}${unit}` : ''}{note ? `${NNBSP}${MARK}` : ''}</>}
      </span>
      {note && <span className="a3-cap block">{DERIVED} · {note}</span>}
    </div>
  )
}

type StageState = 'done' | 'attention' | 'blocked'

type Stage = {
  id: string
  number: number
  title: string
  /** Видимое состояние ТЕКСТОМ (DC-13 STEP-002) — маркер его только дублирует. */
  stateText: string
  state: StageState
  current: boolean
  onOpen: () => void
}

/**
 * Обзор готовности проекта — новый экземпляр визуального контракта
 * DC-13 `WorkflowStepper` (README «Kapitel-Navigation», канон STEP-001),
 * до сих пор существовавшего только внутри `Sidebar.tsx` для глав
 * конфигуратора. Здесь переиспользуются ровно те же классы/токены
 * (`.a3-chapters` / `.a3-ch` / `.a3-n` / `.a3-done` / `.a3-cur`) и та же
 * анатомия «маркер → заголовок → состояние текстом», но не логика
 * открытия глав: переход здесь — прокрутка и фокус уже существующего
 * раздела карточки, а не другой экран.
 *
 * Прыжок к разделу разрешён всегда, независимо от состояния (STEP-003,
 * правило 12): обзор — навигация, не действие. Действие — там же, где
 * было: у своей секции.
 */
function ReadinessOverview({ label, stages }: { label: string; stages: ReadonlyArray<Stage> }) {
  return (
    <nav aria-label={label} className="mt-5">
      <ol className="a3-chapters max-w-none">
        {stages.map((stage) => (
          <li key={stage.id}>
            <button
              type="button"
              onClick={stage.onOpen}
              aria-current={stage.current ? 'step' : undefined}
              className={'a3-ch relative flex min-h-hit-target w-full items-center gap-3 text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'
                + (stage.state === 'done' ? ' a3-done' : '')
                + (stage.current ? ' a3-cur' : '')}
            >
              <span className="a3-n numeric shrink-0" aria-hidden="true">{stage.number}</span>
              <span aria-hidden="true" className="w-4 shrink-0">
                {stage.state === 'done' ? '✓' : stage.state === 'blocked' ? '○' : '▲'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body text-text-primary">{stage.title}</span>
                <span className="a3-cap block">{stage.stateText}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Фокус и прокрутка к уже существующему разделу (общая логика прыжка). */
function focusSection(ref: RefObject<HTMLElement | null>) {
  ref.current?.scrollIntoView?.({ block: 'start' })
  ref.current?.focus()
}

export function OpportunityCard() {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const meta = opportunities.items.find((o) => o.id === s.opportunityId)
  // Подготовка (вопросы, Annahmen, варианты) — уровень Opportunity, не
  // Option: она общая для всех Options этого проекта. В конвейере её нет.
  const [showVorbereitung, setShowVorbereitung] = useState(false)
  const documentSectionRef = useRef<HTMLElement>(null)
  const conflictSectionRef = useRef<HTMLElement>(null)
  const parameterSectionRef = useRef<HTMLElement>(null)
  const optionsSectionRef = useRef<HTMLElement>(null)

  if (!meta) return null

  // Кейс проработан только один: остальные честно говорят об этом здесь,
  // а не изображают анализ, которого в прототипе нет.
  if (!meta.worked) {
    return (
      <div className="px-7 py-6">
        <header className="border-b border-border-strong pb-4">
          <p className="a3-cap">{meta.city} · {meta.country} · {meta.owner}</p>
          <h1 className="mt-1 text-heading-2 font-bold text-text-primary">{meta.name}</h1>
        </header>
        <p className="mt-5 border border-border-default p-4 text-body text-text-secondary">
          <span aria-hidden="true">○ </span>
          Diese Opportunity ist im Prototyp nicht ausgearbeitet. Vollständig
          durchgerechnet ist «{opportunities.items[0]!.name}» — dort läuft die
          Dokumentanalyse, die Konfliktlösung und die Kalkulation mit echter
          Arithmetik.
        </p>
        <div className="mt-4">
          <Button onClick={() => s.backToList()}>{tx('Zurück zu den Opportunities')}</Button>
        </div>
      </div>
    )
  }

  // ── Параметры уровня проекта: суммы от сумм, никогда среднее из средних. ──
  const bs = demo.buildings
  const sum = (pick: (b: typeof bs[number]) => string | null | undefined) =>
    bs.reduce((a, b) => { const v = pick(b); return v ? a.plus(D(v)) : a }, new Decimal(0))

  const totalBgfR = sum((b) => b.areas.bgfAboveGround)
  const totalBgfS = bs.reduce((a, b) => {
    const d = (derived.buildings as Record<string, { bgfSAboveGround?: { value: string | null } }>)[b.id]
    const v = d?.bgfSAboveGround?.value
    return v ? a.plus(D(v)) : a
  }, new Decimal(0))
  const totalWfl = sum((b) => b.areas.wflWoFlV)
  const totalNuf = sum((b) => b.areas.nufDin277)
  const totalUnits = sum((b) => b.areas.wohneinheiten)
  const totalNrf = bs.reduce((a, b) => {
    const d = (derived.buildings as Record<string, { nrf?: { value: string | null } }>)[b.id]
    const v = d?.nrf?.value
    return v ? a.plus(D(v)) : a
  }, new Decimal(0))
  const conflict = wflConflict(s)

  if (showVorbereitung) {
    return (
      <div>
        <div className="px-7 pt-5">
          <Button onClick={() => setShowVorbereitung(false)}>{tx('← Zur Opportunity-Übersicht')}</Button>
        </div>
        <S2Vorbereitung openKonfigurator={() => {
          setShowVorbereitung(false)
          if (s.options.length > 0) s.openOption(s.options[0]!.id)
        }} />
      </div>
    )
  }

  const konfliktOffen = conflict.state === 'open'
  const canCreateOptions = s.canCreateOptions()
  const createOptionDisabledReason = konfliktOffen && !s.projectParamsConfirmed
    ? tx('Erst Konflikte entscheiden und Projektparameter bestätigen')
    : konfliktOffen
      ? tx('Erst Konflikte entscheiden')
      : !s.projectParamsConfirmed
        ? tx('Erst Projektparameter bestätigen')
        : undefined

  // ── Обзор готовности: abgeleitet von den bereits existierenden Feldern,
  //    keine neue Fachlogik (D-13-Vertrag, siehe `ReadinessOverview` oben). ──
  const docsNeedAttention = demo.documents.some((d) => d.parseStatus === 'failed')
  const firstOpen = konfliktOffen ? 'conflict' : !s.projectParamsConfirmed ? 'parameters' : null
  const optionsState: StageState = s.options.length > 0 ? 'done' : canCreateOptions ? 'attention' : 'blocked'
  const stages: Stage[] = [
    {
      id: 'documents',
      number: 1,
      title: tx('Dokumentgrundlage'),
      state: docsNeedAttention ? 'attention' : 'done',
      stateText: docsNeedAttention
        ? tx('Ein Dokument ist nicht lesbar')
        : tx('Analyse abgeschlossen'),
      current: false,
      onOpen: () => focusSection(documentSectionRef),
    },
    {
      id: 'conflict',
      number: 2,
      title: tx('Strittige Angaben'),
      state: konfliktOffen ? 'attention' : 'done',
      stateText: konfliktOffen ? tx('Entscheidung erforderlich') : tx('Entschieden'),
      current: firstOpen === 'conflict',
      onOpen: () => focusSection(conflictSectionRef),
    },
    {
      id: 'parameters',
      number: 3,
      title: tx('Projektparameter'),
      state: s.projectParamsConfirmed ? 'done' : 'attention',
      stateText: s.projectParamsConfirmed ? tx('Bestätigt') : tx('Bestätigung erforderlich'),
      current: firstOpen === 'parameters',
      onOpen: () => focusSection(parameterSectionRef),
    },
    {
      id: 'options',
      number: 4,
      title: tx('Opportunity Options'),
      state: optionsState,
      // Der genaue Grund steht bereits an der echten Aktion (aria-describedby
      // des Create-Buttons unten) — hier absichtlich ein anderer Wortlaut,
      // damit dieselbe Erklärung nicht doppelt und mehrdeutig im Baum steht.
      stateText: optionsState === 'done'
        ? tx('Angelegt')
        : optionsState === 'attention'
          ? tx('Bereit zum Anlegen')
          : tx('Wartet auf die Voraussetzungen oben'),
      current: optionsState === 'attention',
      onOpen: () => focusSection(optionsSectionRef),
    },
  ]

  return (
    <div className="px-7 py-6">
      <PageHeader
        title={meta.name}
        meta={
          <>
            <span>{meta.city} · {meta.country} · {meta.owner} · {meta.id}</span>
            <span className={'a3-tag ml-3 ' + (STAGE_TAG[meta.stage] ?? '')}>
              <span aria-hidden="true" className="a3-dot" />
              {tx(meta.stage)}
            </span>
          </>
        }
      />

      <ReadinessOverview label={tx('Projektstatus')} stages={stages} />

      <div className="mt-3">
        <LinkButton onClick={() => setShowVorbereitung(true)}>
          {tx('Vorbereitung öffnen')}
        </LinkButton>
      </div>

      {/* 1 · Анализ документации — верхний уровень карточки. */}
      <section
        ref={documentSectionRef}
        tabIndex={-1}
        className="a3-sheet mt-6 outline-none"
        aria-label="Dokumentanalyse"
      >
        <DocumentAnalysis
          docs={demo.documents.map((d) => ({
            file: d.file,
            pages: typeof d.pages === 'number' ? d.pages : null,
            parseStatus: d.parseStatus,
          }))}
          // Живое действие (дефект 10): ручной ввод живёт в подготовке —
          // её вопросы и Annahmen и есть форма ручного восполнения.
          onManualCapture={() => setShowVorbereitung(true)}
        />
      </section>

      {/* 2 · Спорное из документации — до параметров: параметр, выведенный
          из спорного значения, тоже спорен. */}
      <section
        ref={conflictSectionRef}
        tabIndex={-1}
        className="a3-sheet mt-6 outline-none"
        aria-label="Strittige Angaben"
      >
        <h2 className="text-heading-3 font-bold text-text-primary">
          {tx('Strittige Angaben aus der Dokumentation')}
        </h2>
        {konfliktOffen ? (
          <div className="a3-konflikt mt-3">
            <p className="text-body text-text-primary">
              <span aria-hidden="true">▲ </span>{tx('Wohnfläche WFL nach WoFlV: zwei Kandidaten.')}</p>
            {/* Кандидаты — `.a3-kv` контракта DC-32: пара «источник →
                значение» в ряд, а не список абзацев. Значения стоят рядом
                именно потому, что решение принимается их сравнением. */}
            <div className="a3-kv">
              {conflict.candidates.map((c) => (
                <span key={c.origin}>
                  <span className="a3-cap block">
                    {tx(c.origin === 'customer' ? 'Kunde' : 'Dokument')}
                  </span>
                  <span className="numeric">{formatDE(D(c.value), 2)}{NNBSP}m²</span>
                  <span className="a3-cap block">{c.source}</span>
                </span>
              ))}
            </div>
            <p className="a3-cap mt-2">{tx('Folge der Wahl: nur der Nenner der Leitkennzahl ändert sich, die Zwischensumme der kalkulierten Positionen bleibt gleich. Der nicht gewählte Kandidat bleibt als Alternative nachvollziehbar.')}</p>
            <div className="a3-row mt-3">
              <Button variant="primary" onClick={() => s.resolveWflConflict('customer')}>{tx('Kundenwert übernehmen')}</Button>
              <Button onClick={() => s.resolveWflConflict('document')}>{tx('Dokumentwert beibehalten')}</Button>
            </div>
          </div>
        ) : (
          <p className="a3-cap mt-2">
            <span aria-hidden="true">✓ </span>{tx('Alle Konflikte entschieden. Die nicht gewählte Alternative bleibt im Journal nachvollziehbar.')}</p>
        )}
      </section>

      {/* 3 · Параметры всего проекта. Суммы считаются от сумм (правило 39). */}
      <section
        ref={parameterSectionRef}
        tabIndex={-1}
        className="a3-sheet mt-6 outline-none"
        aria-label="Projektparameter"
      >
        <h2 className="text-heading-3 font-bold text-text-primary">
          {tx('Parameter des gesamten Projekts')}
        </h2>
        <div className="a3-opportunity-metrics mt-3">
          <Metric label="Gebäude im Projekt" value={String(bs.length)} />
          <Metric label={`Total BGF (R, oberirdisch)`} value={formatDE(totalBgfR, 2)} unit="m²" />
          <Metric label="Total BGF (S)" value={formatDE(totalBgfS, 2)} unit="m²"
                  note="Balkonanteil abgeleitet" />
          <Metric label="Total BGF (R+S)" value={formatDE(totalBgfR.plus(totalBgfS), 2)}
                  unit="m²" note="enthält die abgeleitete S-Fläche" />
          <Metric label="Total NRF" value={formatDE(totalNrf, 2)} unit="m²"
                  note="≈ 85 % der BGF R+S" />
          <Metric label="Total WFL nach WoFlV" value={formatDE(totalWfl, 2)} unit="m²" />
          <Metric label="Total NUF nach DIN 277" value={formatDE(totalNuf, 2)} unit="m²" />
          <Metric label="Wohneinheiten" value={formatDE(totalUnits)} />
        </div>
        {!s.projectParamsConfirmed && (
          <div className="mt-4">
            <Button variant="primary" onClick={() => s.confirmProjectParams()}>{tx('Projektparameter bestätigen')}</Button>
          </div>
        )}
        {s.projectParamsConfirmed && (
          <p className="a3-cap mt-3">
            <span aria-hidden="true">✓ </span>{tx('Projektparameter bestätigt.')}</p>
        )}
      </section>

      {/* 4 · Гейт и Options. */}
      <section
        ref={optionsSectionRef}
        tabIndex={-1}
        className="a3-sheet mt-6 outline-none"
        aria-label="Opportunity Options"
      >
        <h2 className="text-heading-3 font-bold text-text-primary">{tx('Opportunity Options')}</h2>
        <div className="mt-3">
          <PrerequisiteChecklist
            label={t('oppcard.optionsReadiness')}
            requirements={[
              {
                id: 'conflict',
                label: tx('Strittige Angaben'),
                resolved: !konfliktOffen,
                sourceLabel: tx('Strittige Angaben'),
                onOpenSource: () => focusSection(conflictSectionRef),
              },
              {
                id: 'parameters',
                label: tx('Projektparameter bestätigen'),
                resolved: s.projectParamsConfirmed,
                sourceLabel: tx('Projektparameter'),
                onOpenSource: () => focusSection(parameterSectionRef),
              },
            ]}
            createLabel={tx('Opportunity Option anlegen')}
            canCreate={canCreateOptions}
            createDisabledReason={createOptionDisabledReason}
            onCreate={() => s.createOption(`Option ${s.options.length + 1}`)}
          />
        </div>

        {s.options.length > 0 && (
          <ul className="mt-3">
            {s.options.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-2">
                <span className="text-body text-text-primary">{o.name} · {o.id}</span>
                <Button onClick={() => s.openOption(o.id)}>{tx('Öffnen')}</Button>
              </li>
            ))}
          </ul>
        )}

      </section>

      {/* Заметка — уровень проекта, не варианта: продавец записывает
          услышанное о проекте (DC-43). Не рабочий шаг подготовки — стоит
          последней, после гейта Options, а не соперничает с ним за
          внимание. В презентации компонент не рендерится вовсе, а не
          прячется (NOTE-006). */}
      <InternalNote />
    </div>
  )
}
