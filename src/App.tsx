import { useEffect, useId, useRef, useState } from 'react'
import {
  canBeginConfiguration,
  pipelineViewForBuildingGate,
  resetDemonstration,
  useStore,
} from './state/store'
import { useT } from './i18n'
import all3Logo from '../design-system/All3Logo.png'
import { SegmentedControl } from './components/controls'
import { Button } from './components/primitives'
import { ACCOUNT_PORTRAIT_ASSET_ID, identityAsset } from './assets/identity-media'
import { ClientOutputGateDialog } from './components/ClientOutputGateDialog'
import { OfferPanel } from './components/OfferPanel'
import { CostDetails } from './screens/CostDetails'
import { PresentationShell } from './components/PresentationShell'
import { UndoToast } from './components/UndoToast'
import { JourneyRail } from './components/JourneyRail'
import { ConfigurationModeReadiness, ModeChangeNotice, S3Konfigurator } from './screens/S3Konfigurator'
import { S5Export } from './screens/S5Export'
import { S6Einstellungen } from './screens/S6Einstellungen'
import { OpportunityList } from './screens/OpportunityList'
import { ProjectHome } from './screens/ProjectHome'
import { PraesentierenStage } from './screens/PraesentierenStage'
import { LOCKED_NAV_VARIANT, hasV3Surfaces } from './lib/variantLock'
import { BASE_OPTION_AUTO_NAME } from './state/optionLifecycle'
import { OptionContextHeader, OPTION_HEADING_ATTR } from './components/OptionContextHeader'
import { OptionWorkflowNavigator } from './components/WorkflowSpine'
import { useAppRouting } from './state/useAppRouting'
import { BuildingScope } from './screens/BuildingScope'
import { KonfiguratorGate } from './screens/KonfiguratorGate'
import { demoProject } from './state/projectAnalysis'
// GOV-QA-BOUNDARY: App.tsx is the only file permitted to import Grundlagen —
// it renders the registry Gallery, and the registry is the ONLY specimen
// declaration (D-28). Reinstates the 'grundlagen' PipelineView, which
// clientProjection.ts already excluded from CLIENT_VISIBLE_PIPELINE_VIEWS
// (internal-only by construction), but which had no navigable route.
import { Grundlagen } from './screens/Grundlagen'
import {
  isClientProjection,
  isClientVisibleLevel,
  pipelineViewForOutputProfile,
} from './state/clientProjection'
import { checkCascade, checkFonts, type FontCheck } from './lib/font-check'
import { startContinuityTransition, useSemanticMotion } from './design-system/motion'

/**
 * Оболочка на всю ширину экрана, три зоны (решение PO):
 *
 *   слева — навигация (`--panel-left-width`) · по центру — рабочая область,
 *   в которой живёт выбранный экран · справа — всё, что относится к итоговой
 *   стоимости и сроку (`--panel-right-width`).
 *
 * Правая панель ПОСТОЯННА: «цена видна всегда» — механика продукта, а не
 * украшение. Прокручивается каждая зона отдельно; шапка и панели не уезжают.
 * Центровщик `max-w-content` остаётся типографическим пределом ДЛИННОГО
 * ТЕКСТА внутри рабочей области, но не клеткой для интерфейса.
 */
export function App() {
  const s = useStore()
  /**
   * The address bar, bound to the store (accepted 2026-09-06 IA audit).
   * Mounted here because `App` is the one component that outlives every
   * navigation; the hook itself owns the whole contract.
   */
  const routeNotice = useAppRouting()
  // Экран конвейера живёт в сторе: CTA глав («Varianten vergleichen»,
  // «Angebot prüfen») обязаны уметь вести к сравнению и экспорту — из
  // локального состояния App они бы этого не могли (DC-27, ревью № 13).
  const view = s.pipelineView
  const praesentation = isClientProjection(s.mode)
  /**
   * `v2` und `v3` — ONE vertical rail for the whole journey, never in the
   * client projection: that shell owns its own top bar and shows no
   * workflow. `v3` unterscheidet sich von `v2` nur in der Terminstufe.
   */
  const verticalRail = s.navVariant !== 'v1' && !praesentation
  const outputProfileView = pipelineViewForOutputProfile(s.mode, view)
  const renderedView = pipelineViewForBuildingGate(s, outputProfileView)
  /**
   * VR3-02: the Konfigurator stage renders its own GATE until the building
   * scope is saved AND the user has entered Leistungsabgrenzung. Two states,
   * one surface (T-016 locked, T-017 available-with-receipt) — and the
   * configurator itself stays unmounted behind a closed gate, so no empty
   * pricing surface can ever be read as a fact about this Option.
   */
  const konfiguratorGate = renderedView === 'konfigurator'
    && (!canBeginConfiguration(s) || !s.configurationModeChosen)

  // Класс режима на корне — токены и стили дизайн-системы адресуют его.
  useEffect(() => {
    document.documentElement.classList.toggle('mode-praesentation', praesentation)
  }, [praesentation])

  // Плотность независима от режима (D-16): класс существует в tokens.css.
  useEffect(() => {
    document.documentElement.classList.toggle('density-compact', s.density === 'kompakt')
  }, [s.density])

  // SIDEBAR 03 (backlog 2be8e69c, SB-14): `index.html`'s static `lang="de"`
  // never followed the UI locale switch — confirmed by source search, no
  // consumer anywhere in `src/**` ever wrote `document.documentElement.
  // lang`. This is the app-root, document-level counterpart to that
  // attribute; every screen's own `t()`/`tx()` calls already key off the
  // same `s.uiLanguage` field this effect reads.
  useEffect(() => {
    document.documentElement.lang = s.uiLanguage
  }, [s.uiLanguage])

  // Смена экрана/главы/Option/уровня открывает НОВЫЙ документ — с его
  // начала, а не с высоты прошлого (ревью № 13, дефект 8): экран,
  // открывшийся серединой карточек без H1, не объясняет свой вопрос.
  const mainRef = useRef<HTMLElement>(null)
  // Куда вернуть фокус после ворот, открытых из шапки.
  const modeRef = useRef<HTMLButtonElement>(null)
  const firstRender = useRef(true)
  // How many Options existed at the last reset, so an in-place list append
  // can be told apart from a navigation.
  const optionCountRef = useRef(0)
  const previousOptionLevelId = useRef<string | null>(null)
  // AUD-03/EXP-04: `activeOptionId` changes the instant an Option is
  // CREATED from the Opportunity Card (`store.ts`'s `createOption`), before
  // the user ever enters that Option's configurator — `level` stays
  // whatever it already was. Reading the raw id below treated that in-place
  // list append as "arrived at a new document" and reset scroll/focus while
  // the visible screen never changed (verified scrollTop=0 on a screen that
  // never navigated). The reset must still fire for every GENUINE option
  // transition, including switching from one option's configurator
  // straight to another's while `level` itself stays `'option'`
  // (`openOption` always keeps `level: 'option'` for that case) — so this
  // narrows the signal to "which option, if any, is the current DOCUMENT",
  // which is `null` outside `level: 'option'` regardless of how many times
  // the underlying id changes underneath.
  const optionLevelId = s.level === 'option' ? s.activeOptionId : null
  // VR3-01: the same narrowing as `optionLevelId`, for the project stages.
  const projectStageKey = s.level === 'opportunity' ? s.projectStage : null
  useEffect(() => {
    // VR3-01: switching the Understanding SECTION is deliberately not in
    // this effect's dependencies. A tab is a section of one document, not a
    // new document: WAI-ARIA keeps focus on the tab so arrow-key roving
    // works, and moving it to the page heading on every arrow press made
    // the tablist unusable (the second arrow press never reached a tab).
    //
    // The Options collection owns its own focus destination when an Option
    // has just been created — its component focuses the new row (AUD-03
    // AC-3). A reset here would take focus straight back to the page
    // heading; instrumenting `HTMLElement.focus` showed exactly that,
    // ["LI.outline-none", "H1.a3-readiness-heading"], in that order. Every
    // OTHER project-stage change is a genuine document transition and does
    // reset both.
    if (s.level === 'opportunity' && s.projectStage === 'options'
        && optionCountRef.current < s.options.length) {
      optionCountRef.current = s.options.length
      return
    }
    optionCountRef.current = s.options.length
    // jsdom не реализует scrollTo на элементах — свойство надёжнее метода.
    if (mainRef.current) mainRef.current.scrollTop = 0
    // Прокрутка возвращает НАЧАЛО документа глазам; клавиатуре и
    // скринридеру его возвращает фокус (приёмка № 17, дефект 8: после
    // перехода activeElement оставался BODY, и объявления контекста не
    // происходило). Первый рендер пропускается: там фокус ничей и
    // забирать его у пользователя не за что.
    if (firstRender.current) { firstRender.current = false; return }
    /**
     * WHICH heading, and why the order changed.
     *
     * The Option workspace now carries TWO headings in `main`: the Option
     * context header names the Option (the document you are in) and the work
     * column names the stage (the page you are on). `querySelector` returns
     * the first match in DOCUMENT order, so a combined
     * `'[data-page-heading], h1'` selector would have silently started
     * announcing the Option name on every KG chapter change and stopped
     * announcing the chapter at all. The two questions are now asked
     * separately, in priority order:
     *
     * - a change of OPTION IDENTITY (entering the workspace, or switching)
     *   is a change of document → the context header;
     * - every other route change is a change of page → the destination's own
     *   `[data-page-heading]`, exactly as before.
     */
    const identityChanged = previousOptionLevelId.current !== optionLevelId
    previousOptionLevelId.current = optionLevelId
    const root = mainRef.current
    const heading = (identityChanged
      ? root?.querySelector<HTMLElement>(`[${OPTION_HEADING_ATTR}]`)
      : null)
      ?? root?.querySelector<HTMLElement>('[data-page-heading]')
      ?? root?.querySelector<HTMLElement>('h1')
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
    // VR3-01: the PROJECT level has its own stages now (documents →
    // understanding → Option created) and its own sections within
    // Understanding. Each is a genuine document transition — the heading,
    // the primary action and the whole result hierarchy change — so scroll
    // and focus must return to the new heading exactly as they do for an
    // Option-level chapter change. Without these two dependencies, a user
    // who resolves the last blocking conflict lands on the readiness
    // surface with `activeElement` still on the conflict they just closed
    // and the viewport still deep inside the previous page.
  }, [renderedView, s.openConfiguratorStep, optionLevelId, s.level, s.mode,
    s.configurationModeChosen, s.configurationModeEditing,
    projectStageKey, s.options.length])

  // Defensive fail-closed projection: normal store transitions leave client
  // mode before changing level, but corrupted/external state still must not
  // render the private Opportunity workspace for a client.
  if (praesentation && !isClientVisibleLevel(s.level)) {
    return (
      <div className="a3-app-shell flex h-screen flex-col">
        <ViewportWarning />
        <FontRuntimeWarning />
        <AppHeader />
        <main ref={mainRef} tabIndex={-1}
              className="min-h-0 flex-1 bg-surface-default outline-none" />
      </div>
    )
  }

  // Корень продукта — список Opportunities: ни панелей, ни цены. Цена не
  // может быть показана до выбора Option, а Option появляется только после
  // карточки. Три зоны существуют внутри конвейера, а не поверх всего.
  //
  // VR3-01: the PROJECT level (`ProjectHome`) now carries its own workflow
  // spine on the left — the one journey has to survive across the Project
  // and the Option context — but still NO commercial rail. The approved
  // target frames render one because the prototype they came from mounted
  // it unconditionally; a total belongs to an Option, no Option exists at
  // this level, and the fixture invariant is explicit that no screen owns
  // an independent illustrative total. Showing a price here would be the
  // fabricated number this ticket exists to remove.
  if (s.level !== 'option') {
    return (
      <div className="a3-app-shell flex h-screen flex-col">
        <ViewportWarning />
        <FontRuntimeWarning />
        <AppHeader />
        {!praesentation && <ClientOutputGateDialog returnFocusTo={modeRef} />}
        <RouteNotice notice={routeNotice} />
        {/* `v2` puts ONE rail in the left column for the whole journey; the
            portfolio root has no journey to show and keeps the full width.
            In `v1` this wrapper is a plain single-child row and the released
            layout is byte-for-byte what it was. */}
        <div className="flex min-h-0 flex-1">
          {verticalRail && s.level !== 'liste' && <JourneyRail />}
          <main ref={mainRef} tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-surface-default outline-none">
            {s.level === 'liste' ? <OpportunityList /> : <ProjectHome />}
          </main>
        </div>
        <UndoToast />
      </div>
    )
  }

  // VO-T4: Foundations is an internal governance route, not a working
  // product surface. Its four comparable Canvas/Paper/Stage/Stage-deep
  // compositions need the complete desktop width to communicate their
  // canonical roles; the operational rail shell would reduce them to
  // unreadable narrow columns. The global header preserves the normal
  // context and exit path without presenting the obsolete work layout as
  // Design System authority.
  if (!praesentation && renderedView === 'grundlagen') {
    return (
      <div className="a3-app-shell flex h-screen flex-col">
        <ViewportWarning />
        <FontRuntimeWarning />
        <AppHeader />
        <main ref={mainRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto bg-surface-canvas outline-none">
          <GrundlagenRoute />
        </main>
        <UndoToast />
      </div>
    )
  }

  return (
    <div className="a3-app-shell flex h-screen flex-col">
      <ViewportWarning />
      <FontRuntimeWarning />
      {/* VR2-06: Present owns its complete shell (`PresentationTopBar`
          inside `PresentationShell` — brand + narrative strip + a compact
          Ansicht/mode/exit/language cluster) instead of stacking the
          generic Work `AppHeader` above a second Present-only bar. This is
          the ONLY branch that changes: `AppHeader` still renders in every
          other route (list/card/Foundations/defensive-empty), and the
          internal branch below is untouched. */}
      {!praesentation && <AppHeader />}
      {!praesentation && <ClientOutputGateDialog returnFocusTo={modeRef} />}

      {/* REDESIGN R3 WAVE 2a (877f2c2a / ce17da51): Kundenansicht no longer
          projects the working three-pane composition (Sidebar + chapter
          router + OfferPanel rail) with controls filtered out — it gets its
          own PresentationShell, a dedicated client narrative built from
          canonical primitives, reached from `resolvedViewedOptionId`
          instead of `activeOptionId`. The internal branch below is
          UNTOUCHED: same Sidebar, same chapter router, same OfferPanel
          rail, same `renderedView`/`s.pricingStarted` resolution — R4 still
          owns any recomposition of it. `mainRef`/`modeRef` are shared with
          the internal branch so App.tsx's existing scroll-reset/heading-
          focus effect (deps include `s.mode`) and the gate dialog's
          return-focus target keep working unmodified across mode entry and
          exit — no new focus-management code was needed for that half of
          the acceptance contract. */}
      {praesentation ? (
        <PresentationShell mainRef={mainRef} modeRef={modeRef} />
      ) : (
        <div className={`flex min-h-0 flex-1${renderedView === 'konfigurator' ? ' a3-config-work-shell' : ''}`}>
          {/* The same rail, carried across the seam — this is the whole
              point of `v2`: the map does not change grammar at the exact
              boundary where the reader most needs it. */}
          {verticalRail && <JourneyRail />}
          {/* THE SEAM, from the inside (accepted 2026-09-06 IA audit).
              The left rail is gone. It carried a 13-step vertical spine that
              was 2.21 viewports tall at 1440 and 2.63 at 1280, replaced the
              project rail's grammar wholesale at exactly the boundary where
              the user most needed the map, and was a third `nav` landmark
              besides. In its place the Option workspace stacks the same
              three bands the project workspace already uses: identity, one
              rail, the work. The commercial `OfferPanel` on the right is
              UNTOUCHED — "цена видна всегда" is a Product mechanic, not a
              consequence of the navigation this ticket rebuilds. */}
          <main ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto bg-surface-default outline-none">
            <div className="a3-option-shell">
              <OptionContextHeader />
              <OptionWorkflowNavigator />
              <div className="a3-option-main">
                {renderedView === 'buildingScope' && <BuildingScope />}
                {renderedView === 'konfigurator' && (konfiguratorGate ? <KonfiguratorGate /> : <S3Konfigurator />)}
                {renderedView === 'praesentieren' && <PraesentierenStage modeRef={modeRef} />}
                {renderedView === 'export' && <S5Export />}
                {renderedView === 'einstellungen' && <S6Einstellungen />}
                {/* VR3-COST-00 · the Option's complete commercial
                    explanation. A page, not a modal — which is what makes
                    Browser Back return to the exact stage and step the
                    reader came from, through the released router. */}
                {renderedView === 'kostendetails' && <CostDetails />}
              </div>
            </div>
          </main>

          {/* SIDEBAR 01 (backlog eda1e221): the rail slot below is the single
              place that resolves what `<aside>` fills the right column —
              SB-20 renders Level 1 only on Variantenvergleich/Export/
              Einstellungen (no cost-composition breakdown on a read-only
              view), and SB-27 keeps a priced offer's commercial context
              visible when "Modus ändern" is open, ADDING the notice as
              `OfferPanel`'s `footer` instead of substituting the whole panel
              for it. */}
          {(
            /* VR3-02: no rail before the Konfigurator. The commercial rail
               belongs to a legitimate price, and no price exists until the
               scope is saved and Leistungsabgrenzung has been entered; the
               completion count and the saved receipt live in the centre,
               where the decision is. */
            /* Kostendetails IS the commercial surface: the rail beside it
               would be the same figures a second time, in a third of the
               width, competing with the explanation the reader came for. */
            renderedView === 'buildingScope' || renderedView === 'kostendetails'
              || konfiguratorGate ? null
            : !s.pricingStarted
              ? <ConfigurationModeReadiness />
              : renderedView === 'konfigurator' && s.configurationModeEditing
              ? <OfferPanel variant="level1" footer={<ModeChangeNotice headingLevel={3} />} />
              : renderedView === 'export' || renderedView === 'einstellungen'
                || renderedView === 'grundlagen' || renderedView === 'praesentieren'
              ? <OfferPanel variant="level1" />
                : <OfferPanel />)}
        </div>
      )}

      <UndoToast />
    </div>
  )
}

/**
 * Шапка одна на оба уровня — списка и конвейера. Разница только в крошке:
 * на корне её нет, внутри Opportunity она называет путь и даёт выход
 * обратно. Дублировать шапку было бы вторым источником правды о том, как
 * выглядит верх продукта.
 */
/**
 * The reset — one click, no question asked.
 *
 * Deliberately unconfirmed, by the prototype owner's decision: this is a
 * demonstration tool whose content is fixtures, and a confirmation step in
 * front of "start over" costs more in a live demo than the discarded work
 * is worth. What it discards is still real (every Option built in this
 * browser) and the journal cannot bring it back, which is why the control
 * is a small, quiet glyph rather than a labelled button next to the work.
 */
function ResetControl() {
  const t = useT()
  return (
    <button
      type="button"
      className="a3-reset hit-target"
      aria-label={t('shell.reset')}
      title={t('shell.reset')}
      onClick={() => resetDemonstration()}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
        {/* A circular arrow: an open ring plus the head that says which way
            it turns. Perfect circles are the one curve rule 4 keeps. */}
        <path
          d="M20 12a8 8 0 1 1-2.34-5.66"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        <path
          d="M20 4v4.5h-4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </svg>
    </button>
  )
}

function AppHeader() {
  const s = useStore()
  const t = useT()
  const praesentation = isClientProjection(s.mode)
  // F05: the breadcrumb printed the raw fixture/option id (e.g. "DEMO-0001")
  // on every pipeline screen — an internal identifier, not the project's own
  // display label. Objects are always named by that label; when it cannot be
  // resolved (defensive: state pointing at an id the fixture no longer has),
  // fall back to the id rather than rendering nothing, but that path is not
  // reachable in the shipped fixtures.
  // VR3-01: resolved from the two-fixture project register. The previous
  // lookup pointed at `opportunities.json`, whose eight rows this ticket
  // replaced — leaving it in place would have made the F05 fallback the
  // NORMAL path and printed `DEMO-HAPPY-01` in the breadcrumb of every
  // pipeline screen, which is exactly the defect F05 removed.
  const currentOpportunity = demoProject(s.opportunityId)
  const currentOptionIndex = s.options.findIndex((o) => o.id === s.activeOptionId)
  const currentOption = currentOptionIndex >= 0 ? s.options[currentOptionIndex] : undefined
  /* One Option, one name — the breadcrumb reads what the collection, the
     rail, the header and the switcher read. */
  const currentOptionName = currentOption
    ? (hasV3Surfaces(s.navVariant) && currentOptionIndex === 0
      && currentOption.name === BASE_OPTION_AUTO_NAME
      ? t('vr3.option.baseName')
      : currentOption.name)
    : undefined
  // VR2-09 cross-route continuity: the breadcrumb's upward steps (Option →
  // Project, Project → portfolio) are the reverse of the CONTINUITY edges
  // the forward journey already animates (`OpportunityList`,
  // `OpportunityCard`), so they use the same view-transition cross-fade —
  // the brand mark is the shared anchor (`a3-brand-mark`, also carried by
  // the Present top bar). Store actions are unchanged; reduced motion or an
  // unsupporting browser applies them immediately.
  const { reduced } = useSemanticMotion()
  const navigateUp = (apply: () => void) => startContinuityTransition(reduced, apply)

  return (
    <header className="a3-global-header z-header shrink-0">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <img src={all3Logo} alt="All3" className="h-5 w-auto shrink-0 a3-brand-mark" />
        {/* VR2-01 (ACCEPT-01): auf der Liste trägt der Kopf jetzt denselben
            Pfad wie im Ziel — Sektion „Opportunities" → aktuelle Seite. Im
            Präsentationsmodus bleibt der interne Pfad ausgeblendet. */}
        {/* The root is ONE page, so the path names it once. The previous
            «Opportunities / Opportunities» was a breadcrumb with a parent
            that does not exist: it printed the section and the page under
            the same word, which tells a reader nothing and offers nowhere
            to go. Inside a project the path is real and every step up is a
            control. */}
        {s.level === 'liste' && !praesentation && (
          <nav aria-label="Pfad" className="flex flex-wrap items-center gap-2">
            <span className="a3-cap" aria-current="page">{t('vr3.list.title')}</span>
          </nav>
        )}
        {s.level !== 'liste' && !praesentation && (
          <nav aria-label="Pfad" className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateUp(() => s.backToList())}
              className="a3-linkbtn"
            >
              {t('vr3.list.title')}
            </button>
            <span aria-hidden="true" className="text-text-muted">/</span>
            {s.level === 'option' ? (
              <button
                type="button"
                onClick={() => navigateUp(() => s.backToOpportunity())}
                className="a3-linkbtn"
              >
                {currentOpportunity?.name ?? s.opportunityId}
              </button>
            ) : (
              <span className="a3-cap">{currentOpportunity?.name ?? s.opportunityId}</span>
            )}
            {s.level === 'option' && s.activeOptionId && (
              <>
                <span aria-hidden="true" className="text-text-muted">/</span>
                <span className="a3-cap">{currentOptionName ?? s.activeOptionId}</span>
              </>
            )}
          </nav>
        )}
      </div>
      <div className="a3-header-controls">
        {/* The WORK badge is gone and nothing takes its place. It stated the
            only mode this header is ever rendered in — the presentation
            shell has its own top bar — so it carried no information at any
            moment a person could read it, while spending header width and
            a second competing emphasis next to the language control. */}
        {/* Историческая справка к этому контролу: отдельный компактный
            DC-16-тег «EN · Entwurf» рядом с сегментом был снят Design
            Review (тикет REBUILD PROJECT CARD SHELL, находка UX-PC-01) —
            два независимых узла заявляли один и тот же факт одновременно
            (правило 9). Ключ `shell.en.draftOption` остаётся в словаре и
            здесь ничего не рендерит. */}
        {/* The language control is a canonical `SegmentedControl` at its
            COMPACT size, not a new miniature toggle: the visible segment is
            32 px while `.hit-target::before` keeps the 44 × 44 press and
            focus target, and each segment is at least 44 px wide so the two
            invisible zones cannot overlap (R-04, both conditions). It was
            167 × 46 px and set the header's height on its own; the account
            trigger's own 44 px now does, so the header got shorter rather
            than taller. The accessible name stays `Sprache` / `Language` —
            through the dictionary, because a hard-coded legend renders one
            language on both locales. */}
        {/* RESTART THE DEMONSTRATION.
            It exists because the prototype now REMEMBERS: analyses, Options
            and configurations survive a reload, so there has to be a way
            back to the first screen that is not "clear the browser's site
            data". A glyph rather than a word — it sits beside two other
            chrome controls and a labelled button would out-shout both —
            with the sentence as its accessible name. */}
        {!praesentation && (
          <ResetControl />
        )}
        <div className="a3-language-control">
          <SegmentedControl
            layout="inline"
            size="compact"
            legend={t('shell.language')}
            value={s.uiLanguage}
            onChange={(l) => s.setUiLanguage(l)}
            options={[
              { value: 'de', label: 'DE' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </div>
        {/* THE NAVIGATION VARIANT — a reading preference of the person, not
            a state of the project, so it sits beside the language control,
            in the same canonical control at the same compact size.
            Deliberately NOT offered in the client projection — `praesentation` renders its own top bar
            and a client has no reason to restructure the seller's
            navigation. */}
        {!praesentation && !LOCKED_NAV_VARIANT && (
          <div className="a3-navvariant-control">
            <SegmentedControl
              layout="inline"
              size="compact"
              legend={t('shell.navVariant')}
              /* The visible word is gone the same way the language
                 control's is — the segments read `v1`…`v4` and the legend
                 stays the accessible name of the fieldset. */
              legendHidden
              /* Four segments are allowed here for one reason, and the
                 control checks it: these labels are tokens, not translated
                 words, so the width risk LOCALE-004 guards against does
                 not exist. */
              tokenLabels
              value={s.navVariant}
              onChange={(v) => s.setNavVariant(v)}
              options={[
                { value: 'v1', label: 'v1' },
                { value: 'v2', label: 'v2' },
                /* `v3` navigiert wie `v2`; die Stufe „Terminplan“ zeigt dort
                   das gerechnete Bauzeit-Modell statt des geerbten
                   Phasenplans. */
                { value: 'v3', label: 'v3' },
                /* `v4` ist `v3` mit der Reise als ZWEI Ebenen: das Projekt,
                   und darunter die Option, der die späteren Stufen
                   gehören. */
                { value: 'v4', label: 'v4' },
              ]}
            />
          </div>
        )}
        {!praesentation && (
          <AccountMenu />
        )}
      </div>
    </header>
  )
}

/**
 * An address that could not be honoured, STATED.
 *
 * The audit's rule for an unknown `:optionId` is explicit: it resolves to
 * `/optionen` with a stated reason, never to a blank Configurator. A silent
 * redirect is the same defect one level up — the reader typed or followed a
 * link and the product quietly showed them somewhere else.
 */
function RouteNotice({ notice }: { notice: 'unknownProject' | 'unknownOption' | null }) {
  const t = useT()
  if (!notice) return null
  return (
    <p className="a3-route-notice" role="status">
      <span aria-hidden="true">△ </span>
      {t(`vr3.route.notice.${notice}`)}
    </p>
  )
}

function AccountMenu() {
  const s = useStore()
  const t = useT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const demoId = useId()
  const portrait = identityAsset(ACCOUNT_PORTRAIT_ASSET_ID)
  const name = t('shell.account.name')

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="a3-account">
      {/* The trigger names the signed-in person, because that is what an
          account control is FOR. «Account» named the control, not the user,
          and an `A3` monogram named the vendor. The portrait carries an
          EMPTY alt on purpose: the name stands right next to it, and an alt
          text here would make a screen reader read the same person twice.
          The identity lives in the accessible name instead, which also
          contains the visible text (WCAG 2.5.3). */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('shell.account.open', { name })}
        onClick={() => setOpen((current) => !current)}
        className="a3-account-trigger"
      >
        {portrait ? (
          <img
            src={portrait.url}
            alt=""
            width={32}
            height={32}
            className="a3-account-portrait"
          />
        ) : (
          <span aria-hidden="true" className="a3-account-portrait" />
        )}
        <span>{name}</span>
      </button>
      {open && (
        <div role="dialog" aria-label={name} className="a3-account-popover">
          <div className="a3-account-identity">
            {portrait && (
              <img
                src={portrait.url}
                alt=""
                width={40}
                height={40}
                className="a3-account-portrait"
              />
            )}
            <div>
              <p className="a3-account-name">{name}</p>
              <p className="a3-account-role">{t('shell.account.role')}</p>
            </div>
          </div>
          <hr className="a3-account-sep" />
          {/* ONE explanation, stated once. The previous popover printed the
              same unavailable-session sentence twice: as its own body and
              again as the button's `disabledReason`. Passing `disabled`
              WITHOUT `disabledReason` and pointing `aria-describedby` at
              the sentence that is already on screen keeps the reason both
              visible and announced, and keeps it singular. Nothing here
              pretends a sign-out happened: the prototype carries no session
              to end, and inventing the side effect would be a lie about
              authentication. */}
          {/* The two utility destinations the retired left rail used to
              carry. Their REACHABILITY is unchanged: both were reachable
              only from inside an Option workspace and only outside the
              client projection, and both still are — the rail they lived
              in is gone, so they moved to the one utility surface the
              header already had rather than becoming a fourth stage of a
              rail that owns neither. */}
          {s.level === 'option' && (
            <>
              <button
                type="button"
                className="a3-account-link hit-target"
                onClick={() => { setOpen(false); s.setPipelineView('einstellungen') }}
              >
                <span aria-hidden="true">⚙</span>{t('nav.einstellungen')}
              </button>
              <button
                type="button"
                className="a3-account-link hit-target"
                onClick={() => { setOpen(false); s.setPipelineView('grundlagen') }}
              >
                <span aria-hidden="true">◇</span>{t('nav.grundlagen')}
              </button>
              <hr className="a3-account-sep" />
            </>
          )}
          <p id={demoId} className="a3-account-demo">{t('shell.account.demo')}</p>
          <Button className="w-full" disabled aria-describedby={demoId}>
            {t('shell.signOut')}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Internal-only QA route (rule 3 diagnostics + the D-28 registry Gallery).
 * Computes the full FontCheck/cascade evidence Grundlagen needs to display —
 * FontRuntimeWarning above only tracks a boolean, so its effect is not
 * reused here rather than duplicated into a shared boolean that would lose
 * the detail this page exists to show.
 */
function GrundlagenRoute() {
  const [fonts, setFonts] = useState<FontCheck | null>(null)
  const [cascade, setCascade] = useState<string[] | null>(null)

  useEffect(() => {
    let active = true
    const ready = 'fonts' in document ? document.fonts.ready : Promise.resolve()
    void ready.then(() => {
      if (!active) return
      setFonts(checkFonts())
      setCascade(checkCascade())
    })
    return () => { active = false }
  }, [])

  return <Grundlagen fonts={fonts} cascade={cascade} />
}

function FontRuntimeWarning() {
  const t = useT()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    const ready = 'fonts' in document ? document.fonts.ready : Promise.resolve()
    void ready.then(() => {
      if (!active) return
      const fonts = checkFonts()
      setFailed(!fonts.ok || checkCascade().length > 0)
    })
    return () => { active = false }
  }, [])

  if (!failed) return null
  return (
    <div role="alert" className="shrink-0 border-b border-border-error bg-surface-default px-5 py-2 text-small font-medium text-text-primary">
      <span aria-hidden="true">▲ </span>{t('shell.fontWarning')}
    </div>
  )
}

function ViewportWarning() {
  const t = useT()
  return (
    <div className="a3-viewport-warning" role="status">
      <strong>{t('shell.viewport.title')}</strong>
      <span>{t('shell.viewport.body')}</span>
    </div>
  )
}
