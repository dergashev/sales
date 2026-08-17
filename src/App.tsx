import { useEffect, useRef, useState, type RefObject } from 'react'
import { pipelineViewForBuildingGate, useStore } from './state/store'
import { useT } from './i18n'
import { checkFonts, checkCascade, type FontCheck } from './lib/font-check'
import { SegmentedControl } from './components/controls'
import { OutputProfileSwitch } from './components/designSystem'
import { Sidebar } from './components/Sidebar'
import { ClientOutputGateDialog } from './components/ClientOutputGateDialog'
import { GuidedTour } from './components/GuidedTour'
import { OfferPanel } from './components/OfferPanel'
import { UndoToast } from './components/UndoToast'
import { ConfigurationModeReadiness, S3Konfigurator } from './screens/S3Konfigurator'
import { S4Vergleich } from './screens/S4Vergleich'
import { S5Export } from './screens/S5Export'
import { S6Einstellungen } from './screens/S6Einstellungen'
import { Grundlagen } from './screens/Grundlagen'
import { OpportunityList } from './screens/OpportunityList'
import { OpportunityCard } from './screens/OpportunityCard'
import { BuildingScope, BuildingScopeReadiness } from './screens/BuildingScope'
import {
  isClientProjection,
  isClientVisibleLevel,
  pipelineViewForOutputProfile,
} from './state/clientProjection'

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
  const [fonts, setFonts] = useState<FontCheck | null>(null)
  const [cascade, setCascade] = useState<string[] | null>(null)
  const praesentation = isClientProjection(s.mode)
  const outputProfileView = pipelineViewForOutputProfile(s.mode, view)
  const renderedView = pipelineViewForBuildingGate(s, outputProfileView)
  const t = useT()

  useEffect(() => {
    // Диагностика шрифта не имеет права ронять приложение: `document.fonts`
    // существует не везде (jsdom, старые движки), а само приложение от неё
    // не зависит — она только сообщает о провале загрузки. Прежняя редакция
    // падала целиком там, где FontFaceSet отсутствует.
    if (!document.fonts?.ready) {
      setCascade(checkCascade())
      return
    }
    document.fonts.ready.then(() => {
      setFonts(checkFonts())
      setCascade(checkCascade())
    })
  }, [])

  // Класс режима на корне — токены и стили дизайн-системы адресуют его.
  useEffect(() => {
    document.documentElement.classList.toggle('mode-praesentation', praesentation)
  }, [praesentation])

  // Плотность независима от режима (D-16): класс существует в tokens.css.
  useEffect(() => {
    document.documentElement.classList.toggle('density-compact', s.density === 'kompakt')
  }, [s.density])

  // Смена экрана/главы/Option/уровня открывает НОВЫЙ документ — с его
  // начала, а не с высоты прошлого (ревью № 13, дефект 8): экран,
  // открывшийся серединой карточек без H1, не объясняет свой вопрос.
  const mainRef = useRef<HTMLElement>(null)
  // Куда вернуть фокус после ворот, открытых из шапки.
  const modeRef = useRef<HTMLButtonElement>(null)
  const firstRender = useRef(true)
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
  }, [renderedView, s.openChapter, s.activeOptionId, s.level, s.mode,
    s.configurationModeChosen, s.configurationModeEditing])

  // Defensive fail-closed projection: normal store transitions leave client
  // mode before changing level, but corrupted/external state still must not
  // render the private Opportunity workspace for a client.
  if (praesentation && !isClientVisibleLevel(s.level)) {
    return (
      <div className="a3-app-shell flex h-screen flex-col">
        <ViewportWarning />
        <AppHeader t={t} modeRef={modeRef} />
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
        <AppHeader t={t} modeRef={modeRef} />
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
      <AppHeader t={t} modeRef={modeRef} />
      {!praesentation && <ClientOutputGateDialog returnFocusTo={modeRef} />}

      <div className="flex min-h-0 flex-1">
        <Sidebar />

        <main ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto bg-surface-default outline-none">
          {renderedView === 'buildingScope' && <BuildingScope />}
          {renderedView === 'konfigurator' && <S3Konfigurator />}
          {renderedView === 'vergleich' && <S4Vergleich />}
          {renderedView === 'export' && <S5Export />}
          {renderedView === 'einstellungen' && <S6Einstellungen />}
          {renderedView === 'grundlagen' && <Grundlagen fonts={fonts} cascade={cascade} />}
        </main>

        {renderedView === 'buildingScope' ? <BuildingScopeReadiness />
          : !s.pricingStarted
            || renderedView === 'konfigurator'
              && (!s.configurationModeChosen || s.configurationModeEditing)
            ? <ConfigurationModeReadiness />
            : <OfferPanel />}
      </div>

      <GuidedTour />
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
function AppHeader({
  t,
  modeRef,
}: {
  t: (k: Parameters<ReturnType<typeof useT>>[0]) => string
  modeRef: RefObject<HTMLButtonElement>
}) {
  const s = useStore()
  const praesentation = isClientProjection(s.mode)
  const buildingGateBlocked = s.level !== 'option' || !s.canBeginConfiguration()
  const configurationGateBlocked = s.level === 'option'
    && (!s.configurationModeChosen || s.configurationModeEditing)
  const modeBlocked = buildingGateBlocked || configurationGateBlocked
  const modeBlockedReason = buildingGateBlocked
    ? t('shell.mode.blockedReason')
    : configurationGateBlocked
      ? t('configurator.mode.clientBlocked')
      : undefined

  return (
    <header className="a3-global-header z-header shrink-0">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-body text-text-primary">
          <span className="font-bold">All3</span>
          <span className="text-text-secondary"> · Indicative Offer Engine</span>
        </p>
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
            <span className="a3-cap">{s.opportunityId}</span>
            {s.level === 'option' && s.activeOptionId && (
              <>
                <span aria-hidden="true" className="text-text-muted">/</span>
                <span className="a3-cap">{s.activeOptionId}</span>
              </>
            )}
          </nav>
        )}
      </div>
      <div className="a3-header-controls">
        {/* Режим показа (правило 11). Вход в презентацию гейтуется
            открытым material-блокером (R-07) — заблокированный контрол
            объясняет почему (правило 12). */}
        {/* Вход в клиентский вид идёт ЧЕРЕЗ ворота (DC-33), а не мимо:
            прямой `setMode` в шапке обходил единственную модалку системы —
            продавец попадал к клиенту, не увидев, что перестанет быть
            видимым (приёмка волны C). Выход обратно прямой: возвращаться
            во внутреннее пространство нечем гейтовать. */}
        {(s.level === 'option' || praesentation) && (
          <OutputProfileSwitch
            mode={s.mode}
            blocked={modeBlocked}
            blockedReason={modeBlockedReason}
            checkButtonRef={modeRef}
            onCheck={() => s.setGateOpen(true)}
            onExit={() => s.setMode('intern')}
          />
        )}
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
            требуется); видимый след ограничен коротким статус-тегом DC-16
            (нейтральный namespace `environment`, цвет не назначен
            намеренно — README §DC-16), который показывается только пока
            EN действительно активен: до переключения кнопка сегмента сама
            уже называет «EN · Entwurf». */}
        <div className="a3-language-control">
          <SegmentedControl
            layout="inline"
            legend="Sprache"
            value={s.uiLanguage}
            onChange={(l) => s.setUiLanguage(l)}
            options={[
              { value: 'de', label: 'DE' },
              { value: 'en', label: 'EN · Entwurf' },
            ]}
          />
          {/* Носитель статуса — подпись тега (правило 8), не цвет и не точка:
              `.a3-dot` определён только внутри `.a3-badge` и `.a3-chip-src`,
              в `.a3-tag` он оставался пустым узлом нулевого размера. */}
          {s.uiLanguage === 'en' && (
            <span className="a3-tag">{t('shell.en.draftTag')}</span>
          )}
          <p className="sr-only">
            {s.uiLanguage === 'en' ? t('shell.en.draftActive') : t('shell.en.draftHint')}
          </p>
        </div>
      </div>
    </header>
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
