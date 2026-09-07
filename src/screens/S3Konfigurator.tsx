import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSemanticMotion } from '../design-system/motion'
import { KG_SCOPE_GROUPS } from '../engine/kgConfiguration'
import {
  hasKgConfiguration,
  kgDecidedScopeCount,
  kgGroupOfStep,
  kgScopeDecisionsComplete,
  useStore,
} from '../state/store'
import { NNBSP } from '../engine/money'
import { useT } from '../i18n'
import { Button } from '../components/primitives'
import { CONFIGURATOR_STEP } from '../state/chapters'
import { ActionGate } from '../design-system/ActionGate'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { Leistungsabgrenzung } from './Leistungsabgrenzung'
import { KgChapter } from './KgChapter'
import { ResponsibilityStage } from './ResponsibilityStage'
import { ScheduleStage } from './ScheduleStage'
import { FinalValidation } from './FinalValidation'

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
    : currentId === CONFIGURATOR_STEP.RESPONSIBILITY
      ? KG_SCOPE_GROUPS.length + 1
      : currentId === CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE
        ? KG_SCOPE_GROUPS.length + 2
        : currentId === CONFIGURATOR_STEP.FINAL_VALIDATION
          ? KG_SCOPE_GROUPS.length + 3
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
    if (currentId === CONFIGURATOR_STEP.RESPONSIBILITY) {
      // VR3-TGA-UX-00: behind the same six-decision gate as the cost groups,
      // for the same reason — the interface matrix describes an Option whose
      // scope exists. It is not a cost group, so it never reads `kgConfig.scope`.
      return scopeComplete ? <ResponsibilityStage /> : (
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
            {t('vr3.responsibility.heading')}
          </h1>
        </ActionGate>
      )
    }
    if (currentId === CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE) return <ScheduleStage />
    if (currentId === CONFIGURATOR_STEP.FINAL_VALIDATION) return <FinalValidation />
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

/*
 * VR3-04 also removed `useFadingHint` and `Card` from this shell.
 *
 * They were the L3 guidance layer (F-40): a coaching intro that faded after
 * three showings. Their ONLY consumers were `ChapterTermine` and
 * `ConfigurationCompleteNotice`, both replaced above, so the mechanism had
 * no remaining caller and dead code in a shell this central is worse than a
 * named absence.
 *
 * WHAT IS LOST, STATED PLAINLY: the schedule's coaching hint no longer
 * fades — `ScheduleStage` carries a permanent lede instead ("Dates, phases
 * and dependencies…", the approved frame's own sentence), which is an
 * explanation of the stage rather than a coach mark for a first visit. That
 * is a deliberate trade, not an oversight: the fading-hint contract was
 * flagged as a CANONICAL DESIGN SYSTEM GAP when it was written, and
 * re-creating a product-local copy of a missing capability on a new surface
 * would be adding the second copy rather than closing the gap.
 */

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

/*
 * VR3-04 removed `ChapterTermine` and `ConfigurationCompleteNotice` from
 * this shell.
 *
 * `ChapterTermine` was the schedule: a read-only fixture Gantt plus one
 * date field, mounted as a chapter of the configuration. It is replaced by
 * `ScheduleStage` — a stage with a phase model, dependencies, validation
 * and a confirmation of its own — because "Schedule and configuration
 * completion responsibilities are mixed" was this ticket's own problem
 * statement (audit F-011).
 *
 * `ConfigurationCompleteNotice` was the aggregate outstanding-work notice
 * that lived at the end of that chapter. Its job — name the outstanding
 * cost group and route there — is now done by `ScheduleStage`'s own
 * `ActionGate`, which is the stage the outstanding work actually blocks.
 * Two surfaces stating one prerequisite is two places for it to drift.
 */

/**
 * Semantic step KG_700_DETAILS — preparation, not negotiation (Punkt 12).
 *
 * Клиент видит, что KG 700 включена, и её долю в смете. Каким способом
 * она посчитана — HOAI и AHO собственной ставкой или распределением
 * 70/22/8 — внутреннее решение: клиенту оно ничего не объясняет, а
 * продавцу даёт другую цену. Поэтому в презентации глава не существует
 * (правило 11), а не показывается свёрнутой.
 */
