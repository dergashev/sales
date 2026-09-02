import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { writeFileSync } from 'node:fs'
import { __resetStoreForTests, useStore } from '../../state/store'
import { CONFIGURATOR_STEPS } from '../../state/chapters'
import { GENERATED_DE } from '../generated'

/**
 * Остаток немецкого на английском пути — замер ПО DOM, а не по исходнику.
 *
 * Почему переписано. `tools/i18n_remainder.py` читает строковые литералы
 * `.tsx` и потому меряет то, что написано, а не то, что видно: он дал
 * «2 строки» там, где живой проход Codex нашёл 202. Расхождение на два
 * порядка — дефект инструмента, а не спор о числе: сканер не видел
 * значений фикстур, подписей движка, конкатенаций и fallback-веток
 * словаря, то есть ровно тех мест, где немецкий и остаётся.
 *
 * Здесь измеряется то же, что видит пользователь: текстовые узлы живого
 * дерева на `uiLanguage = en`.
 *
 * **Бюджет — не порог качества, а храповик.** Он фиксирует достигнутое и
 * может только уменьшаться: любое новое немецкое место валит тест, а
 * снижение бюджета требует правки этой строки, то есть осознанного шага.
 * Поднять его молча нельзя — в этом весь смысл.
 */

/**
 * Достигнутый остаток. Уменьшать можно; увеличивать — только вместе с
 * названной причиной, и это единственный законный случай роста.
 *
 * 77 → 80 (07.08): глава 3 переведена с сегментных переключателей на
 * карточки объёма — три новых пояснения у карточек.
 * 80 → 83 (07.08): глава 1 получила переключатель охвата DC-46 и таблицу
 * комплекса DC-47 — подписи охвата и заголовки таблицы.
 * Немецкий — язык-источник, поэтому новая копия сначала появляется на
 * нём; шесть строк уходят в поставку № 5. Храповик сработал дважды и оба
 * раза не дал росту пройти молча — в этом и была его цель.
 * 83 → 76 (07.08): подписи движка (итог, знаменатель ставки), названия
 * артефактов, провенанс и «alle» в фильтрах проведены через мост.
 * 76 → 78 (07.08): поток печати DC-42 — заголовок и пояснение о том, что
 * профиль clientPrint имеет собственную проверку.
 * 78 → 49 (07.08): подключена поставка № 5 (927 ключей) и проведены через
 * мост ссылки на документы, скидка, метки конфликта, легенды и пометка EN.
 * Непереведённых осталось ДВА фрагмента; остальные 47 — строки, которые
 * DOM отдаёт кусками из-за конкатенации, и лечатся они не переводом, а
 * целыми ключами (правило 36 требует именно этого).
 * 49 → 51 (10.08): подвал разделён на режим отделки и надбавку за паркинг
 * (сплошное ревью 26, находки 6 и 7). Появились два новых немецких
 * названия вклада — «Untergeschoss · Rohbau und Ausbau» и «Tiefgarage ·
 * Lüftung, OS-Beschichtung, Tore»; прежнее «Untergeschoss inkl. Tiefgarage»
 * описывало единственный случай и вместе с ним ушло. Немецкий — язык-
 * источник, поэтому новая копия сначала появляется на нём; обе строки
 * стоят в `docs/audit/i18n-en-worklist.md` в разделе «перевода нет» и
 * уходят в поставку № 6. Собрать их из уже переведённых кусков нельзя:
 * правило 36 запрещает переводить конкатенацией.
 * 51 → 44 (14.08): золотой путь снова подтверждает режим конфигуратора
 * перед обходом глав. Бюджет теперь фиксирует все восемь живых глав,
 * а не один и тот же экран выбора режима восемь раз.
 * 44 → 48 (14.08, тикет d21f8d48): глава 2 «Leistungsabgrenzung»
 * перестроена как Scope Boundaries — шесть карт KG по DIN 276 вместо
 * восьми переключателей, включая новую подпись раздела, пояснение о
 * неизменяемости KG 300/400/700, и подтверждение с инвалидацией. Пять
 * новых непереведённых фрагментов: заголовок карты «Energiestandard und
 * Zertifizierung», вступление «Sechs Kostengruppen bestimmen...»,
 * описание «Immer Bestandteil des Angebots...» и текст подтверждения
 * («Leistungsabgrenzung bestätigen», «Erst nach Bestätigung...»).
 * Немецкий — язык-источник, поэтому новая копия появляется на нём первой;
 * все пять стоят в следующей поставке копирайта.
 * 48 → 52 (17.08, KG300/400/700 + Construction Period): KG 300 zeigt jetzt
 * einen Energie-/Zertifikat-Kontext-Banner und eine schreibgeschützte
 * Untergeschoss-Zusammenfassung (Details bleiben in Leistungsabgrenzung —
 * kein zweiter Eigentümer derselben Entscheidung, siehe Kommentar bei
 * `UndergroundFloorRecap`); Construction Period bekam ein Baubeginn-Feld.
 * Vier neue unübersetzte Fragmente: der Banner-Disclaimer, die
 * Untergeschoss-Einleitung, die Tiefgarage-Zeile und der Baubeginn-
 * Hilfetext. Deutsch ist Quellsprache, daher erscheint der neue Text zuerst
 * darin; alle vier stehen in der nächsten Copy-Lieferung
 * (`docs/audit/i18n-en-worklist.md`).
 * 52 → 57 (17.08, REBUILD PROJECT CARD SHELL): новый обзор готовности
 * Opportunity (DC-13-контракт, четыре стадии) добавил текстовые состояния
 * стадий. Пять новых непереведённых фрагментов: «Bereit zum Anlegen»,
 * «Bestätigt», «Bestätigung erforderlich», «Ein Dokument ist nicht
 * lesbar», «Wartet auf die Voraussetzungen oben». Немецкий — язык-
 * источник, поэтому новая копия появляется на нём первой; все пять стоят
 * в следующей поставке копирайта.
 */
const BUDGET = 57

/**
 * Немецкая лексика: умляуты и частотные служебные слова. Нормативные имена
 * (`WoFlV`, `DIN`, `MBO`, `GEG`, `KG`, `BGF`, `WFL`, `NUF`, `HOAI`, `AHO`,
 * `QNG`, `DGNB`) немецкими текстами не являются — это идентификаторы, и
 * они остаются немецкими по решению D-24.
 */
const GERMAN = /[äöüÄÖÜß]|\b(der|die|das|und|oder|nicht|kein|keine|mit|ohne|für|nach|aus|bei|wird|werden|ist|sind|noch|schon|nur|alle|des|dem|den|im|zum|zur|vom|auf|über|unter|wie|wenn|dann|hier|jetzt|Angebot|Gebäude|Kunde|Preis|Auswahl|Werte|Datei|Frage|Zuschlag|Offen|Erfüllt|Punkten|Voraussetzungen)\b/

const DE_TO_KEY = new Set(Object.values(GENERATED_DE))
const REPORT = 'docs/audit/i18n-en-remainder-dom.md'

const NORMATIVE = /^(WoFlV|DIN\b|MBO|GEG|EH\b|GK\b|KG\b|BGF|WFL|NUF|NRF|HOAI|AHO|QNG|DGNB|OKBP|CRM|HubSpot|All3|DEMO-|OPT-|SNAP-|RS\b)/

function germanFragments(): string[] {
  const out: string[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement
    if (!el) continue
    // Невидимое пользователю не считается: sr-only объявляет то же самое,
    // а aria-hidden не читается вовсе.
    if (el.closest('[aria-hidden="true"], .sr-only, .a3-visually-hidden')) continue
    const text = (n.textContent ?? '').trim()
    if (text.length < 3) continue
    if (NORMATIVE.test(text)) continue
    if (GERMAN.test(text)) out.push(text)
  }
  return [...new Set(out)]
}

beforeEach(() => __resetStoreForTests())

describe('Остаток немецкого на английском пути (D-24)', () => {
  it(`не превышает бюджет ${BUDGET} фрагментов и не растёт`, async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('radio', { name: /EN/ })[0]!)

    const seen = new Set<string>()
    germanFragments().forEach((f) => seen.add(f))

    // Золотой путь: корень → проект → конвейер → главы → сравнение.
    // Anchor auf «öffnen» (wie im Rest der Suite, z. B. opportunities.dom.
    // test.tsx): der Kartentitel selbst ist ebenfalls ein fokussierbarer
    // primaryDestination-Button mit demselben Namensanteil (CARD-001) —
    // ohne Anker matchen beide.
    // VR3-01: das saubere Demonstrationsprojekt heißt jetzt «Wohnhof
    // Lindenhain», und der Projekt-Bildschirm ist ein Zustandsautomat —
    // deshalb werden BEIDE Projektzustände abgetastet: vor der
    // Dokumentanalyse (`PrerequisiteState`) und nach ihr (Projektreife mit
    // dem Option-Gate). Das ist derselbe Umfang wie früher, als die
    // Opportunity Card vor und nach der Konfliktlösung gemessen wurde.
    // The accessible name is a real key now, so it is English on the EN
    // path ("Open project · Wohnhof Lindenhain") — which is the whole point of this
    // walk. Matching the project name alone keeps the query locale-neutral.
    // The card's stretched title and its CTA both name the project (the
    // title IS the primary destination, CARD-001). Either opens it; the
    // CTA is the one the accessible-name walk cares about.
    await user.click(screen.getByRole('button', { name: 'Open project · Wohnhof Lindenhain' }))
    germanFragments().forEach((f) => seen.add(f))

    act(() => {
      const s = useStore.getState()
      s.seedProjectCheckpoint('DEMO-HAPPY-01')
      s.resolveWflConflict('customer')
      s.confirmProjectParams()
    })
    // Sample the same gate after readiness as well: the status labels and
    // whole count sentence change only in this state.
    germanFragments().forEach((f) => seen.add(f))

    act(() => {
      const s = useStore.getState()
      s.createOption('Basis')
      s.openOption('OPT-01')
      s.confirmBuilding(s.activeBuildingId)
      s.setPipelineView('konfigurator')
      s.confirmConfigurationMode('PER_BUILDING')
    })
    for (const step of CONFIGURATOR_STEPS) {
      act(() => useStore.getState().openConfiguratorStepAt(step.id))
      germanFragments().forEach((f) => seen.add(f))
    }
    for (const view of ['vergleich', 'export'] as const) {
      act(() => useStore.getState().setPipelineView(view))
      germanFragments().forEach((f) => seen.add(f))
    }

    const rest = [...seen].sort()

    // Артефакт замера: каждый фрагмент помечен ПРИЧИНОЙ остатка. Это
    // разделяет работу машинно, а не на глаз: «в словаре есть» — строка
    // не проходит через мост и правится в `src`; «в словаре нет» — она
    // уходит в следующую поставку копирайта.
    const known = rest.filter((f) => DE_TO_KEY.has(f))
    const unknown = rest.filter((f) => !DE_TO_KEY.has(f))
    writeFileSync(REPORT, [
      '# Остаток немецкого на английском пути — замер по DOM',
      '',
      'Сгенерировано `src/i18n/__tests__/en-remainder.dom.test.tsx`.',
      'Метод: обход текстовых узлов живого дерева при `uiLanguage = en`',
      'по золотому пути. Заменил сканер исходника, который давал 2 вместо',
      '202: он мерил написанное, а не увиденное.',
      '',
      `**Всего ${rest.length}** · перевод есть, мост не подключён: ${known.length}`,
      `· перевода нет (в поставку копирайта): ${unknown.length}`,
      '',
      '## Перевод есть — строка не проходит через мост (правится в src)',
      '',
      ...known.map((f) => `- ${f}`),
      '',
      '## Перевода нет — в следующую поставку копирайта',
      '',
      ...unknown.map((f) => `- ${f}`),
      '',
    ].join('\n'), 'utf-8')

    expect(rest.length).toBeLessThanOrEqual(BUDGET)
  })
})
