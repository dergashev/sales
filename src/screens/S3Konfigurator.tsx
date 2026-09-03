import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useSemanticMotion } from '../design-system/motion'
import {
  KG_SCOPE_GROUPS,
  firstOutstandingKgGroup,
} from '../engine/kgConfiguration'
import {
  hasKgConfiguration,
  includedBuildingIds,
  kgCatalogueFor,
  kgConfigurationCompleteFor,
  kgDecidedScopeCount,
  kgGroupOfStep,
  kgScopeDecisionsComplete,
  useStore,
} from '../state/store'
import { NNBSP } from '../engine/money'
import { useT, useTx } from '../i18n'
import { Decimal } from 'decimal.js'
import { Button } from '../components/primitives'
import { SectionSheet } from '../components/designSystem'
import { DateField } from '../components/controls'
import { ScheduleGantt } from '../components/ScheduleGantt'
import { modelDuration, presentDuration, shiftScheduleMetrics } from '../engine/schedule'
import demo from '../fixtures/demo-0001.json'
import { bgfAboveGround } from '../engine/calculate'
import { effectiveFactValue } from '../state/buildingReview'
import { CONFIGURATOR_STEP } from '../state/chapters'
import { ActionGate } from '../design-system/ActionGate'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { Leistungsabgrenzung } from './Leistungsabgrenzung'
import { KgChapter } from './KgChapter'

/**
 * S3 Konfigurator — the stage of the Option's configuration.
 *
 * ONLY the stage: the journey lives in the left rail, the live commercial
 * result in the right one (the three-zone decision), and this screen knows
 * nothing about price beyond the preview side effects of its own controls.
 *
 * VR3-03 replaced what used to live here. Six chapter-specific compositions
 * (a KG 300 three-region stage with a facade showcase, a KG 400 option list
 * with an energy banner, a KG 700 method grid, and a shared scope-catalog
 * grammar for KG 200/500/600) are gone, together with the per-building tab
 * strip, the status strip and the total overview that belonged to them. What
 * remains is one shell that mounts one canonical surface — because the
 * ticket's outcome is that learning one cost group is learning all six.
 */

/**
 * Последствие опции для consequenceLine — видно всегда, не по hover
 * (R-05/OPTION-009). Образец контракта: `≈ +97.000 € Mehrpreis`.
 */
/**
 * The Konfigurator shell (VR3-03).
 *
 * The shell owns the STAGE, and exactly one surface is mounted in it: the
 * scope ledger, one of six identical KG pages, the schedule, or the gate that
 * explains why none of them is available yet. What it no longer owns is a
 * per-chapter composition — the six KG grammars, the building tab strip, the
 * per-building status strip and the total overview all belonged to a model in
 * which each chapter was its own design, and that model is what this ticket
 * replaces.
 *
 * FAIL-CLOSED, LIKE THE BUILDING GATE BEFORE IT. A KG chapter reached before
 * the six decisions exist, or an excluded one reached from the rail, renders
 * its own gate with the named prerequisite and the route back — never an
 * empty configuration page (T-016's principle, applied one stage later).
 */
export function S3Konfigurator() {
  const s = useStore()
  const t = useT()
  const configured = hasKgConfiguration(s)
  const currentId = s.openConfiguratorStep
  const group = kgGroupOfStep(currentId)
  const decided = kgDecidedScopeCount(s)
  const scopeComplete = kgScopeDecisionsComplete(s)
  const total = KG_SCOPE_GROUPS.length

  // VR2-09 · the DIRECTION verb: ordered progress through the configuration
  // is communicated by the entering stage arriving from the side it comes
  // from. Enter-only, so the DOM keeps the replacement semantics every
  // navigation test asserts.
  const { direction, reduced } = useSemanticMotion()
  const stageIndex = group
    ? KG_SCOPE_GROUPS.indexOf(group) + 1
    : currentId === CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE
      ? KG_SCOPE_GROUPS.length + 1
      : 0
  const previousStageIndexRef = useRef(stageIndex)
  const stageDirection = stageIndex >= previousStageIndexRef.current ? 'forward' : 'backward'
  useEffect(() => { previousStageIndexRef.current = stageIndex }, [stageIndex])

  const body = (() => {
    if (!configured) {
      // An Option with no KG configuration cannot be configured, and saying
      // so is the only honest surface. It is reachable only from a payload
      // written before this contract existed.
      return (
        <ActionGate
          status="locked"
          prerequisites={[{
            id: 'kgConfig',
            label: t('vr3.kg.gate.configurationPrereq'),
            met: false,
            detail: t('vr3.kg.gate.configurationDetail'),
          }]}
          route={{
            label: t('configurator.returnBuildingScope'),
            onSelect: () => s.setPipelineView('buildingScope'),
          }}
        >
          <h1 className="a3-hero-title" data-page-heading tabIndex={-1}>
            {t('vr3.kg.gate.configurationTitle')}
          </h1>
        </ActionGate>
      )
    }
    if (currentId === CONFIGURATOR_STEP.SCOPE_BOUNDARIES) return <Leistungsabgrenzung />
    if (currentId === CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE) return <ChapterTermine />
    if (!group) return <Leistungsabgrenzung />
    if (!scopeComplete) {
      return (
        <ActionGate
          status="locked"
          prerequisites={[{
            id: 'scopeDecisions',
            label: t('vr3.kg.gate.decisionsPrereq'),
            met: false,
            detail: t('vr3.kg.gate.decisionsDetail', { decided, total }),
          }]}
          route={{
            label: t('vr3.kg.gate.decisionsRoute'),
            onSelect: () => s.openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES),
          }}
        >
          <h1 className="a3-hero-title" data-page-heading tabIndex={-1}>
            {group
              ? `KG${NNBSP}${group.slice(3)} · ${t(`costGroup.${group}`)}`
              : t('chapter.scopeBoundaries')}
          </h1>
        </ActionGate>
      )
    }
    if (s.kgConfig?.scope[group] === 'excluded') {
      // An excluded cost group stays REACHABLE and says what it is: out of
      // scope by a decision, not missing work (T-020). Its configuration is
      // not shown, because there is none to make.
      return (
        <div className="a3-kg-skipped">
          <h1 className="a3-hero-title" data-page-heading tabIndex={-1}>
            {`KG${NNBSP}${group.slice(3)} · ${t(`costGroup.${group}`)}`}
          </h1>
          <SemanticStatus
            tone="neutral"
            label={t('vr3.kg.ledger.downstream.skipped')}
            reason={t('vr3.kg.gate.skippedReason')}
          />
          <Button onClick={() =>
            s.openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)}>
            {t('vr3.kg.gate.reopenScope')}
          </Button>
        </div>
      )
    }
    return <KgChapter />
  })()

  return (
    <div className="a3-config-work">
      <motion.div
        key={currentId}
        className="a3-config-work-body"
        variants={direction[stageDirection]}
        initial={reduced ? false : 'initial'}
        animate="animate"
      >
        {body}
      </motion.div>
    </div>
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

function buildingName(
  state: ReturnType<typeof useStore.getState>,
  buildingId: string,
): string {
  const review = state.buildingReviews[buildingId]
  return review
    ? effectiveFactValue(review.facts.documentationName) ?? buildingId
    : buildingId
}


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
 * The aggregate outstanding-work notice at the end of the chapter sequence.
 *
 * VR3-03 moved its predicate onto the canonical one. It used to combine the
 * old Scope Boundaries fingerprint with each included BUILDING's own
 * confirmation, which is a model in which a chapter was complete because it
 * had been visited and confirmed per building. Completion is now derived
 * from the domain: the six scope decisions plus every required service
 * decision, value and dependency in every included cost group
 * (`kgConfigurationCompleteFor`). It names whichever cost group is still
 * outstanding and routes there, and renders nothing once nothing is.
 */
function ConfigurationCompleteNotice() {
  const s = useStore()
  const t = useT()
  if (!hasKgConfiguration(s)) return null
  if (kgConfigurationCompleteFor(s)) return null
  const scopeComplete = kgScopeDecisionsComplete(s)
  const catalogue = kgCatalogueFor(s)
  const outstanding = catalogue && s.kgConfig
    ? firstOutstandingKgGroup(catalogue, s.kgConfig)
    : null
  return (
    <Card title={t('configurator.confirmConfig.title')}>
      <SemanticStatus
        tone="attention"
        label={t('configurator.finalGate.label')}
        reason={!scopeComplete
          ? t('vr3.kg.gate.decisionsDetail', {
            decided: kgDecidedScopeCount(s), total: KG_SCOPE_GROUPS.length,
          })
          : outstanding
            ? t('vr3.kg.gate.chapterOutstanding', {
              group: `KG${NNBSP}${outstanding.slice(3)}`,
            })
            : t('configurator.finalGate.label')}
      />
      <Button
        variant="primary"
        onClick={() => {
          if (!scopeComplete || !outstanding) {
            s.openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES)
            return
          }
          s.openKgChapter(outstanding)
        }}
      >
        {t('configurator.finalGate.action')}
      </Button>
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
