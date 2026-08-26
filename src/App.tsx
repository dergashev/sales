import { useEffect, useRef, useState } from 'react'
import { pipelineViewForBuildingGate, useStore } from './state/store'
import opportunities from './fixtures/opportunities.json'
import { useT } from './i18n'
import all3Logo from '../design-system/All3Logo.png'
import { SegmentedControl } from './components/controls'
import { Button } from './components/primitives'
import { Sidebar } from './components/Sidebar'
import { ClientOutputGateDialog } from './components/ClientOutputGateDialog'
import { OfferPanel } from './components/OfferPanel'
import { UndoToast } from './components/UndoToast'
import { ConfigurationModeReadiness, ModeChangeNotice, S3Konfigurator } from './screens/S3Konfigurator'
import { S4Vergleich } from './screens/S4Vergleich'
import { S5Export } from './screens/S5Export'
import { S6Einstellungen } from './screens/S6Einstellungen'
import { OpportunityList } from './screens/OpportunityList'
import { OpportunityCard } from './screens/OpportunityCard'
import { BuildingScope, BuildingScopeReadiness } from './screens/BuildingScope'
import {
  isClientProjection,
  isClientVisibleLevel,
  pipelineViewForOutputProfile,
} from './state/clientProjection'
import { checkCascade, checkFonts } from './lib/font-check'

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
  // Экран конвейера живёт в сторе: CTA глав («Varianten vergleichen»,
  // «Angebot prüfen») обязаны уметь вести к сравнению и экспорту — из
  // локального состояния App они бы этого не могли (DC-27, ревью № 13).
  const view = s.pipelineView
  const praesentation = isClientProjection(s.mode)
  const outputProfileView = pipelineViewForOutputProfile(s.mode, view)
  const renderedView = pipelineViewForBuildingGate(s, outputProfileView)

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
  useEffect(() => {
    // jsdom не реализует scrollTo на элементах — свойство надёжнее метода.
    if (mainRef.current) mainRef.current.scrollTop = 0
    // Прокрутка возвращает НАЧАЛО документа глазам; клавиатуре и
    // скринридеру его возвращает фокус (приёмка № 17, дефект 8: после
    // перехода activeElement оставался BODY, и объявления контекста не
    // происходило). Первый рендер пропускается: там фокус ничей и
    // забирать его у пользователя не за что.
    if (firstRender.current) { firstRender.current = false; return }
    const heading = mainRef.current?.querySelector<HTMLElement>('[data-page-heading], h1')
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
  }, [renderedView, s.openConfiguratorStep, optionLevelId, s.level, s.mode,
    s.configurationModeChosen, s.configurationModeEditing])

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
  // Список и карточка живут БЕЗ панелей: три зоны существуют внутри
  // конвейера, то есть внутри Option, а не поверх всего продукта.
  if (s.level !== 'option') {
    return (
      <div className="a3-app-shell flex h-screen flex-col">
        <ViewportWarning />
        <FontRuntimeWarning />
        <AppHeader />
        {!praesentation && <ClientOutputGateDialog returnFocusTo={modeRef} />}
        <main ref={mainRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto bg-surface-default outline-none">
          {s.level === 'liste' ? <OpportunityList /> : <OpportunityCard />}
        </main>
        <UndoToast />
      </div>
    )
  }

  return (
    <div className="a3-app-shell flex h-screen flex-col">
      <ViewportWarning />
      <FontRuntimeWarning />
      <AppHeader />
      {!praesentation && <ClientOutputGateDialog returnFocusTo={modeRef} />}

      <div className="flex min-h-0 flex-1">
        <Sidebar modeRef={modeRef} />

        <main ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto bg-surface-default outline-none">
          {renderedView === 'buildingScope' && <BuildingScope />}
          {renderedView === 'konfigurator' && <S3Konfigurator />}
          {renderedView === 'vergleich' && <S4Vergleich />}
          {renderedView === 'export' && <S5Export />}
          {renderedView === 'einstellungen' && <S6Einstellungen />}
        </main>

        {/* SIDEBAR 01 (backlog eda1e221): the rail slot below is the single
            place that resolves what `<aside>` fills the right column —
            SB-20 renders Level 1 only on Variantenvergleich/Export/
            Einstellungen (no cost-composition breakdown on a read-only
            view), and SB-27 keeps a priced offer's commercial context
            visible when "Modus ändern" is open, ADDING the notice as
            `OfferPanel`'s `footer` instead of substituting the whole panel
            for it. */}
        {renderedView === 'buildingScope' ? <BuildingScopeReadiness />
          : !s.pricingStarted
            || renderedView === 'konfigurator' && !s.configurationModeChosen
            ? <ConfigurationModeReadiness />
            : renderedView === 'konfigurator' && s.configurationModeEditing
            ? <OfferPanel variant="level1" footer={<ModeChangeNotice headingLevel={3} />} />
            : renderedView === 'vergleich' || renderedView === 'export' || renderedView === 'einstellungen'
            ? <OfferPanel variant="level1" />
            : <OfferPanel />}
      </div>

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
function AppHeader() {
  const s = useStore()
  const praesentation = isClientProjection(s.mode)
  // F05: the breadcrumb printed the raw fixture/option id (e.g. "DEMO-0001")
  // on every pipeline screen — an internal identifier, not the project's own
  // display label. Objects are always named by that label; when it cannot be
  // resolved (defensive: state pointing at an id the fixture no longer has),
  // fall back to the id rather than rendering nothing, but that path is not
  // reachable in the shipped fixtures.
  const currentOpportunity = opportunities.items.find((o) => o.id === s.opportunityId)
  const currentOption = s.options.find((o) => o.id === s.activeOptionId)

  return (
    <header className="a3-global-header z-header shrink-0">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <img src={all3Logo} alt="All3" className="h-7 w-auto shrink-0" />
        {s.level !== 'liste' && !praesentation && (
          <nav aria-label="Pfad" className="flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className="text-text-muted">/</span>
            <button
              type="button"
              onClick={() => s.backToList()}
              className="a3-linkbtn"
            >
              Opportunities
            </button>
            <span aria-hidden="true" className="text-text-muted">/</span>
            {s.level === 'option' ? (
              <button
                type="button"
                onClick={() => s.backToOpportunity()}
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
                <span className="a3-cap">{currentOption?.name ?? s.activeOptionId}</span>
              </>
            )}
          </nav>
        )}
      </div>
      <div className="a3-header-controls">
        {/* EN честно назван ЧАСТИЧНЫМ до переключения (приёмка № 17,
            дефект 2). Причина теперь ОДНА и временная: перевод ещё не
            доставлен целиком. Решение PO D-24 отменило D-20 — английская
            версия обязана быть английской, включая guidance; пометка
            снимается поставкой № 4, а не остаётся навсегда.
            Тикет REBUILD PROJECT CARD SHELL, пункт 5: полное предложение
            выше делало общий заголовок шире базовой ширины на каждом
            экране (замер Tech Review на 1280 px). Полный текст никуда не
            делся — он доступен ассистивным технологиям через `sr-only`
            рядом в потоке документа (не через `aria-describedby` на
            `SegmentedControl`: канонический компонент не принимает этот
            проп, и расширять его API ради одного места использования не
            требуется). Видимый след — только подпись самого сегмента:
            «EN · Entwurf» / «EN · Draft» через словарный ключ целиком
            (`shell.en.draftOption`, правило 36 — не конкатенация), видна
            ПОСТОЯННО, до и после переключения. Design Review (тикет REBUILD
            PROJECT CARD SHELL, находка UX-PC-01) снял отдельный компактный
            DC-16-тег, который раньше дублировал ровно то же слово рядом с
            уже видимой подписью сегмента: два независимых узла заявляли
            один и тот же факт одновременно, что нарушало правило 9 (один
            способ выделения на фрагмент). Отсутствие тега не роняет ни
            видимую, ни ассистивную информацию — обе остаются на своих
            местах. */}
        <div className="a3-language-control">
          <SegmentedControl
            layout="inline"
            legend="Sprache"
            value={s.uiLanguage}
            onChange={(l) => s.setUiLanguage(l)}
            options={[
              { value: 'de', label: 'DE' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </div>
        {!praesentation && (
          <AccountMenu />
        )}
      </div>
    </header>
  )
}

function AccountMenu() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

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
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-hit-target items-center gap-2 rounded-control px-2 text-small font-medium text-text-primary outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-subtle">A3</span>
        <span>{t('shell.account')}</span>
      </button>
      {open && (
        <div role="dialog" aria-label={t('shell.account')} className="absolute right-0 z-popover mt-2 w-56 rounded-card border border-border-strong bg-surface-default p-3 shadow-elevated">
          <p className="text-small font-medium text-text-primary">{t('shell.account')}</p>
          <p className="mt-1 text-small text-text-secondary">{t('shell.accountUnavailable')}</p>
          <Button className="mt-3 w-full" disabled disabledReason={t('shell.accountUnavailable')}>
            {t('shell.signOut')}
          </Button>
        </div>
      )}
    </div>
  )
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
