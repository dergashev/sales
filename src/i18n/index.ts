import { useStore } from '../state/store'
import { GENERATED_DE, GENERATED_EN } from './generated'

/**
 * i18n по правилу 36: тексты интерфейса — только по ключам из словарей,
 * `de` — источник и fallback. Конкатенация переводов запрещена: каждая
 * строка — целый ключ.
 *
 * Границы (D-13, D-20, LOCALE-001):
 * - язык UI ≠ язык артефактов: словарь переводит ХРОМ интерфейса (навигация,
 *   кнопки, служебные подписи), а клиентское содержимое (подписи итога из
 *   движка, Annahmen, Kostentreiber-строки) живёт на языке артефакта и
 *   переключается отдельной настройкой, которой в прототипе нет;
 * - EN-guidance не переведён и не выдумывается: guidance-ключи в `en`
 *   отсутствуют, показывается de-fallback (D-20).
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
  'journal.empty': 'Journal: noch keine übernommenen Änderungen',
} as const

export type MessageKey = keyof typeof de

/**
 * EN — частичный по построению: непереведённый ключ честно падает в de.
 * Guidance-ключей здесь не будет никогда (D-20).
 */
const en: Partial<Record<MessageKey, string>> = {
  'nav.projekte': 'Projects',
  'nav.vorbereitung': 'Preparation',
  'nav.konfigurator': 'Configurator',
  'nav.vergleich': 'Variant comparison',
  'nav.export': 'Export',
  'nav.einstellungen': 'Settings',
  'nav.grundlagen': 'Foundations',
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
  'journal.empty': 'Journal: no adopted changes yet',
}

/**
 * Порядок поиска: локальный словарь (хром оболочки) → сгенерированный из
 * поставки Codex (434 ключа, состояние draft). Непереведённое падает в
 * de — честный fallback внутреннего пространства.
 */
export function translate(key: MessageKey | string, lang: UiLanguage): string {
  if (lang === 'en') {
    const hit = en[key as MessageKey] ?? GENERATED_EN[key]
    if (hit !== undefined) return hit
  }
  return de[key as MessageKey] ?? GENERATED_DE[key] ?? key
}

/**
 * Перевод произвольной НЕМЕЦКОЙ строки по обратному индексу поставки.
 * Мост на время перевода экранов: строки, чей немецкий текст совпадает
 * со значением ключа Codex, получают английский без ручного переноса на
 * ключи. Несовпавшие остаются немецкими — это видимый остаток работы,
 * а не скрытый.
 */
/**
 * Дополнение моста для строк, созданных ПОСЛЕ поставки Codex (перестройка
 * сценария 06.08 переименовала главы и добавила уровни). EN здесь — хром
 * интерфейса, не guidance (D-20 не нарушен); при следующем задании
 * копирайта эти строки уходят в поставку, а дополнение сокращается.
 */
const LOCAL_TEXT_EN: Record<string, string> = {
  'Gebäude & Umfang': 'Buildings & scope',
  'Leistungen KG 300': 'Services CG 300',
  'Technik KG 400': 'Building services CG 400',
  'Energie & Zertifikate': 'Energy & certificates',
  'Flächen im Detail': 'Areas in detail',
  'Baunebenkosten KG 700': 'Incidental costs CG 700',
  'Ausbau & Technik': 'Fit-out & services',
  'Projektverständnis': 'Project understanding',
}

const DE_TO_KEY = new Map(Object.entries(GENERATED_DE).map(([k, v]) => [v, k]))

export function translateText(deText: string, lang: UiLanguage): string {
  if (lang !== 'en') return deText
  const trimmed = deText.trim()
  const local = LOCAL_TEXT_EN[trimmed]
  if (local) return local
  const key = DE_TO_KEY.get(trimmed)
  return key ? (GENERATED_EN[key] ?? deText) : deText
}

/** Хук: словарная функция текущего языка UI. */
export function useT(): (key: MessageKey | string) => string {
  const lang = useStore().uiLanguage
  return (key) => translate(key, lang)
}

/** Хук моста: перевод немецкой строки, если она есть в поставке Codex. */
export function useTx(): (deText: string) => string {
  const lang = useStore().uiLanguage
  return (deText) => translateText(deText, lang)
}
