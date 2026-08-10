import { useEffect, useRef, useState } from 'react'
import { activeBuilding, useStore } from './state/store'
import { useT } from './i18n'
import { checkFonts, checkCascade, type FontCheck } from './lib/font-check'
import { SegmentedControl } from './components/controls'
import { Sidebar } from './components/Sidebar'
import { ClientOutputGateDialog } from './components/ClientOutputGateDialog'
import { GuidedTour } from './components/GuidedTour'
import { OfferPanel } from './components/OfferPanel'
import { UndoToast } from './components/UndoToast'
import { S3Konfigurator } from './screens/S3Konfigurator'
import { S4Vergleich } from './screens/S4Vergleich'
import { S5Export } from './screens/S5Export'
import { S6Einstellungen } from './screens/S6Einstellungen'
import { Grundlagen } from './screens/Grundlagen'
import { OpportunityList } from './screens/OpportunityList'
import { OpportunityCard } from './screens/OpportunityCard'

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
  const praesentation = s.mode === 'praesentation'
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
  const modeRef = useRef<HTMLElement>(null)
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
    mainRef.current?.focus()
  }, [view, s.openChapter, s.activeOptionId, s.level])

  // Корень продукта — список Opportunities: ни панелей, ни цены. Цена не
  // может быть показана до выбора Option, а Option появляется только после
  // карточки. Три зоны существуют внутри конвейера, а не поверх всего.
  // Список и карточка живут БЕЗ панелей: три зоны существуют внутри
  // конвейера, то есть внутри Option, а не поверх всего продукта.
  if (s.level !== 'option') {
    return (
      <div className="flex h-screen flex-col bg-surface-canvas">
        <AppHeader t={t} />
        <ClientOutputGateDialog returnFocusTo={modeRef} />
        <main ref={mainRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto bg-surface-default outline-none">
          {s.level === 'liste' ? <OpportunityList /> : <OpportunityCard />}
        </main>
        <UndoToast />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-surface-canvas">
      <AppHeader t={t} />

      <div className="flex min-h-0 flex-1">
        <Sidebar />

        <main ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto bg-surface-default outline-none">
          {view === 'konfigurator' && <S3Konfigurator />}
          {view === 'vergleich' && <S4Vergleich />}
          {view === 'export' && <S5Export />}
          {view === 'einstellungen' && <S6Einstellungen />}
          {view === 'grundlagen' && <Grundlagen fonts={fonts} cascade={cascade} />}
        </main>

        <OfferPanel />
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
function AppHeader({ t }: { t: (k: Parameters<ReturnType<typeof useT>>[0]) => string }) {
  const s = useStore()
  const praesentation = s.mode === 'praesentation'
  const modeBlocked = !activeBuilding(s).gebaeudeklasse.confirmed

  return (
    <header className="z-header flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-strong bg-surface-default px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-body text-text-primary">
          <span className="font-bold">All3</span>
          <span className="text-text-secondary"> · Indicative Offer Engine</span>
        </p>
        {s.level !== 'liste' && (
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
      <div className="flex flex-wrap items-center gap-4">
        {/* Режим показа (правило 11). Вход в презентацию гейтуется
            открытым material-блокером (R-07) — заблокированный контрол
            объясняет почему (правило 12). */}
        {/* Вход в клиентский вид идёт ЧЕРЕЗ ворота (DC-33), а не мимо:
            прямой `setMode` в шапке обходил единственную модалку системы —
            продавец попадал к клиенту, не увидев, что перестанет быть
            видимым (приёмка волны C). Выход обратно прямой: возвращаться
            во внутреннее пространство нечем гейтовать. */}
        <SegmentedControl
          layout="inline"
          legend={t('shell.mode.legend')}
          value={s.mode}
          onChange={(m) => (m === 'praesentation'
            ? s.setGateOpen(true)
            : s.setMode(m))}
          options={[
            { value: 'intern', label: t('shell.mode.intern') },
            {
              value: 'praesentation',
              label: t('shell.mode.praesentation'),
              disabled: modeBlocked,
              disabledReason: modeBlocked ? t('shell.mode.blockedReason') : undefined,
            },
          ]}
        />
        {/* EN честно назван ЧАСТИЧНЫМ до переключения (приёмка № 17,
            дефект 2). Причина теперь ОДНА и временная: перевод ещё не
            доставлен целиком. Решение PO D-24 отменило D-20 — английская
            версия обязана быть английской, включая guidance; пометка
            снимается поставкой № 4, а не остаётся навсегда. */}
        <SegmentedControl
          layout="inline"
          legend="Sprache"
          value={s.uiLanguage}
          onChange={(l) => s.setUiLanguage(l)}
          helperText={s.uiLanguage === 'en'
            ? t('shell.en.draftActive')
            : t('shell.en.draftHint')}
          options={[
            { value: 'de', label: 'DE' },
            { value: 'en', label: 'EN · Entwurf' },
          ]}
        />
        {!praesentation && (
          <p className="text-small text-text-secondary">
            {t('shell.prototypeNote')}
          </p>
        )}
      </div>
    </header>
  )
}
