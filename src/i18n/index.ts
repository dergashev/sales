import { useStore } from '../state/store'
import { GENERATED_DE, GENERATED_EN } from './generated'

/**
 * i18n по правилу 36: тексты интерфейса — только по ключам из словарей,
 * `de` — источник и fallback. Конкатенация переводов запрещена: каждая
 * строка — целый ключ.
 *
 * Границы (D-13, D-24, LOCALE-001):
 * - язык UI ≠ язык артефактов: артефакт может быть немецким при английском
 *   интерфейсе (D-13), но текст интерфейса вокруг него обязан быть
 *   английским;
 * - **D-20 отменён решением D-24**: guidance переводится наравне с хромом.
 *   Прежняя редакция этого докстринга утверждала обратное — «EN-guidance
 *   не переводится и не выдумывается»; правило сменилось, а комментарий
 *   остался, и это ровно тот класс «документ пережил своё правило»,
 *   против которого написан реестр решений.
 *
 * Числа сюда не входят по построению: они форматируются только через
 * `formatDE`/`Intl` (правило 7/36) и в словаре не существуют.
 */

export type UiLanguage = 'de' | 'en'

const de = {
  'nav.projekte': 'Projekte',
  'nav.vorbereitung': 'Vorbereitung',
  'nav.konfigurator': 'Konfigurator',
  'nav.vergleich': 'Variantenvergleich',
  'nav.export': 'Export',
  'nav.einstellungen': 'Einstellungen',
  'nav.grundlagen': 'Grundlagen',
  'nav.tour': 'Rundgang durch das Werkzeug',
  'shell.prototypeNote': 'Prototyp · Arithmetik echt, Parsing simuliert',
  'shell.mode.intern': 'Intern',
  'shell.mode.praesentation': 'Präsentation',
  'shell.mode.blockedReason':
    'Erst nach bestätigter Klassifikation (offener Blocker DEMO-VI-0001)',
  'shell.mode.legend': 'Modus',
  'shell.variant': 'Variante «Basis»',
  'shell.phase.vorbereitung': 'Vorbereitung',
  'common.undo': 'Rückgängig',
  'common.close': 'Schließen',
  'common.showOrigin': 'Herkunft anzeigen',
  'common.loading': 'Wird geladen',
  'common.fieldLoading': 'Feld wird geladen',
  'common.fulfilled': 'Erfüllt',
  'common.open': 'Offen',
  'designSystem.readinessSummary': '{done} von {total} Punkten bereit',
  'oppcard.prerequisitesSummary': '{done} von {total} Voraussetzungen erfüllt',
  'oppcard.resolveConflictingInformation': 'Strittige Angaben jetzt entscheiden',
  'oppcard.confirmProjectParametersNow': 'Projektparameter jetzt bestätigen',
  'journal.empty': 'Journal: noch keine übernommenen Änderungen',
  'shell.en.draftActive': 'EN: Entwurf — Übersetzung noch nicht vollständig',
  'shell.en.draftHint': 'EN ist noch ein Entwurf: die Übersetzung wird gerade vervollständigt',
} as const

export type MessageKey = keyof typeof de

/**
 * Локальный словарь оболочки. EN здесь полный: остаток перевода живёт в
 * поставках Codex, а не в этой таблице, и меряется обходом DOM
 * (`src/i18n/__tests__/en-remainder.dom.test.tsx`).
 */
const en: Partial<Record<MessageKey, string>> = {
  'nav.projekte': 'Projects',
  'nav.vorbereitung': 'Preparation',
  'nav.konfigurator': 'Configurator',
  'nav.vergleich': 'Variant comparison',
  'nav.export': 'Export',
  'nav.einstellungen': 'Settings',
  'nav.grundlagen': 'Foundations',
  'nav.tour': 'Tour of the tool',
  'shell.prototypeNote': 'Prototype · arithmetic real, parsing simulated',
  'shell.mode.intern': 'Internal',
  'shell.mode.praesentation': 'Presentation',
  'shell.mode.blockedReason':
    'Available after the classification is confirmed (open blocker DEMO-VI-0001)',
  'shell.mode.legend': 'Mode',
  'shell.variant': 'Variant “Basis”',
  'shell.phase.vorbereitung': 'Preparation',
  'common.undo': 'Undo',
  'common.close': 'Close',
  'common.showOrigin': 'Show origin',
  'common.loading': 'Loading',
  'common.fieldLoading': 'Field is loading',
  'common.fulfilled': 'Complete',
  'common.open': 'Open',
  'designSystem.readinessSummary': '{done} of {total} points ready',
  'oppcard.prerequisitesSummary': '{done} of {total} prerequisites complete',
  'oppcard.resolveConflictingInformation': 'Resolve conflicting information now',
  'oppcard.confirmProjectParametersNow': 'Confirm project parameters now',
  'journal.empty': 'Journal: no adopted changes yet',
  'shell.en.draftActive': 'EN: draft — translation not yet complete',
  'shell.en.draftHint': 'EN is still a draft: the translation is being completed',
}

/**
 * Порядок поиска: локальный словарь (хром оболочки) → сгенерированный из
 * поставки Codex (434 ключа, состояние draft). Непереведённое падает в
 * de — честный fallback внутреннего пространства.
 */
export type MessageValues = Readonly<Record<string, string | number>>

function interpolate(
  message: string,
  lang: UiLanguage,
  values?: MessageValues,
): string {
  if (!values) return message
  const numberFormat = new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB')
  return message.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, name: string) => {
    const value = values[name]
    if (value === undefined) return placeholder
    return typeof value === 'number' ? numberFormat.format(value) : value
  })
}

export function translate(
  key: MessageKey | string,
  lang: UiLanguage,
  values?: MessageValues,
): string {
  let message: string
  if (lang === 'en') {
    const hit = en[key as MessageKey] ?? GENERATED_EN[key]
    if (hit !== undefined) return interpolate(hit, lang, values)
  }
  message = de[key as MessageKey] ?? GENERATED_DE[key] ?? key
  return interpolate(message, lang, values)
}

/**
 * Перевод произвольной НЕМЕЦКОЙ строки по обратному индексу поставки.
 * Мост на время перевода экранов: строки, чей немецкий текст совпадает
 * со значением ключа Codex, получают английский без ручного переноса на
 * ключи. Несовпавшие остаются немецкими — это видимый остаток работы,
 * а не скрытый.
 */
/**
 * Локального дополнения больше нет: поставка № 3 забрала все строки хрома
 * (включая пять, где черновик Claude разошёлся с каноном терминологии, —
 * канон победил: KG — неизменяемый DIN-идентификатор). Источник EN —
 * ТОЛЬКО поставки Codex; появление новых строк между поставками честно
 * остаётся немецким до следующего задания копирайта.
 */

const DE_TO_KEY = new Map(Object.entries(GENERATED_DE).map(([k, v]) => [v, k]))

export function translateText(deText: string, lang: UiLanguage): string {
  if (lang !== 'en') return deText
  const trimmed = deText.trim()
  const key = DE_TO_KEY.get(trimmed)
  return key ? (GENERATED_EN[key] ?? deText) : deText
}

/** Хук: словарная функция текущего языка UI. */
export function useT(): (key: MessageKey | string, values?: MessageValues) => string {
  const lang = useStore().uiLanguage
  return (key, values) => translate(key, lang, values)
}

/** Хук моста: перевод немецкой строки, если она есть в поставке Codex. */
export function useTx(): (deText: string) => string {
  const lang = useStore().uiLanguage
  return (deText) => translateText(deText, lang)
}
