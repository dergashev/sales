# Остаток перевода EN — инвентарь для задания копирайта № 2

Метод: tools/i18n_remainder.py (грубая экстракция, признак немецкой
лексики; ложные срабатывания возможны и отсеиваются при взятии в
работу). Покрытие: значения GENERATED_DE + локальный словарь +
LOCAL_TEXT_EN. Всё в таблице останется немецким на EN.

**Строк: 67 в 17 файлах.**

| файл | немецкая строка |
|---|---|
| `src/App.tsx` | All3 |
| `src/App.tsx` | Opportunities |
| `src/App.tsx` | · Indicative Offer Engine |
| `src/components/ClientOutputGateDialog.tsx` | Array.from( dialog.querySelectorAll |
| `src/components/ClientOutputGateDialog.tsx` | Escape |
| `src/components/ClientOutputGateDialog.tsx` | Tab |
| `src/components/ClientOutputGateDialog.tsx` | void returnFocusTo: React.RefObject |
| `src/components/DocumentAnalysis.tsx` | diesen Dateien |
| `src/components/DocumentAnalysis.tsx` | dieser Datei |
| `src/components/InternalNote.tsx` | wird |
| `src/components/OriginPopover.tsx` | Array.from(dialog.querySelectorAll |
| `src/components/OriginPopover.tsx` | Escape |
| `src/components/OriginPopover.tsx` | Tab |
| `src/components/ScheduleGantt.tsx` | (days(from, to) / span) * 100 const finishMonth = Math.round(days(start, finishISO) / DAYS_PER_MONTH) // Ось: отметка каждые 3 месяца от начала эпохи. const ticks: number[] = [] for (let m = 0; m * DAYS_PER_MONTH |
| `src/components/UndoToast.tsx` | Escape |
| `src/components/controls.tsx` | Escape |
| `src/components/controls.tsx` | ` (LOCALE-004), контрол этого не поддерживает. * Подпись — состояние, не действие (LAYOUT-008): `Kompakt`, не * `Kompakt umschalten`. */ export function SegmentedControl |
| `src/components/controls.tsx` | `/`role="switch"`, не * кнопки с ролью** (RADIO-001 прямо запрещает role=radio без полного * клавиатурного контракта — стрелки у нативной radio-группы двигают фокус * И выбирают бесплатно и правильно). * * Носитель выбора — бордер `--color-selection-border` + видимый ✓ + * `aria-checked`; заливка `--color-surface-selected` только поддерживает * (gate 21: в forced-colors фон исчезает). Оранжевого здесь не существует * (R-01). */ const FOCUS_RING = 'peer-focus-visible:outline peer-focus-visible:outline-2 ' + 'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring' /* ── SegmentedControl ──────────────────────────────────────────────────── */ export type Segment |
| `src/components/controls.tsx` | void options: Array |
| `src/components/primitives.tsx` | Enter |
| `src/components/primitives.tsx` | Escape |
| `src/components/primitives.tsx` | `, что заблокированная не теряет фокус, и что причина блокировки * достижима. Смена вида кнопки в системе приходит сюда сама. * * Зона нажатия 44 px тоже пришла из системы (`.a3-btn::before`), поэтому * локальный HIT здесь снят: два псевдоэлемента на одном контроле — это * две зоны нажатия, а не одна надёжная. */ export const Button = forwardRef |
| `src/screens/ChapterBuildings.tsx` | const FORM_LABEL: Record |
| `src/screens/Grundlagen.tsx` | Button |
| `src/screens/Grundlagen.tsx` | NumericField (DC-4) |
| `src/screens/Grundlagen.tsx` | OriginPopover (DC-21) |
| `src/screens/Grundlagen.tsx` | ProvenanceChip (DC-1) |
| `src/screens/Grundlagen.tsx` | RadioCardGroup |
| `src/screens/Grundlagen.tsx` | SegmentedControl |
| `src/screens/Grundlagen.tsx` | Switch |
| `src/screens/Grundlagen.tsx` | UncertaintyBadge (DC-3) |
| `src/screens/OpportunityList.tsx` | && { label: `Suche: ${q.trim()}`, clear: () => setQ( |
| `src/screens/OpportunityList.tsx` | Opportunities |
| `src/screens/OptionChapter.tsx` | Standard |
| `src/screens/S2Vorbereitung.tsx` | ('Projektdaten') const tablist = useRef |
| `src/screens/S2Vorbereitung.tsx` | Abgrenzung ist der Leistungsübersicht zu entnehmen. |
| `src/screens/S2Vorbereitung.tsx` | Anforderungen an Tragwerk und Kapselung und damit den Preis |
| `src/screens/S2Vorbereitung.tsx` | ArrowLeft |
| `src/screens/S2Vorbereitung.tsx` | ArrowRight |
| `src/screens/S2Vorbereitung.tsx` | Das Angebot umfasst die Kostengruppen 300 und 400 nach DIN 276. |
| `src/screens/S2Vorbereitung.tsx` | Deckungsentscheidung vor: sie ist weder eingeschlossen noch |
| `src/screens/S2Vorbereitung.tsx` | Die Gebäudeklasse ist noch nicht bestätigt. Die Geschossanzahl ist |
| `src/screens/S2Vorbereitung.tsx` | Die Kostengruppen 100, 200, 600 und 800 sind nicht enthalten. Für die |
| `src/screens/S2Vorbereitung.tsx` | End |
| `src/screens/S2Vorbereitung.tsx` | Enter |
| `src/screens/S2Vorbereitung.tsx` | Für die Kalkulation ist vorläufig GK 5 hinterlegt, Stand |
| `src/screens/S2Vorbereitung.tsx` | Home |
| `src/screens/S2Vorbereitung.tsx` | Kostengruppe 500 (Außenanlagen und Freiflächen) liegt noch keine |
| `src/screens/S2Vorbereitung.tsx` | ausgeschlossen und bislang unbewertet. Solange dieser Zustand besteht, |
| `src/screens/S2Vorbereitung.tsx` | erfolgt über das Brandschutzkonzept und die zugehörigen Nachweise. |
| `src/screens/S2Vorbereitung.tsx` | lediglich Prüfauslöser und kein Nachweis; die Einstufung nach MBO §2 |
| `src/screens/S2Vorbereitung.tsx` | und keinen Gesamtpreis aus (R-18, CALC-006). Die vollständige |
| `src/screens/S2Vorbereitung.tsx` | verändern; mit Vorlage des Brandschutzkonzepts bestätigen wir sie. |
| `src/screens/S2Vorbereitung.tsx` | weist das Angebot eine «Zwischensumme der kalkulierten Positionen» |
| `src/screens/S2Vorbereitung.tsx` | «Prüfung erforderlich». Die endgültige Einstufung kann die |
| `src/screens/S3Konfigurator.tsx` | Der Baugrund entscheidet über Gründung und KG 320. Ohne |
| `src/screens/S3Konfigurator.tsx` | Erschließung gehört zu KG 200 — die Entscheidung über den |
| `src/screens/S3Konfigurator.tsx` | Gutachten bleibt er ein benanntes Risiko — kein Preisbestandteil |
| `src/screens/S3Konfigurator.tsx` | Umfang fällt in Kapitel 3, hier steht ihr Stand. |
| `src/screens/S3Konfigurator.tsx` | und keine stillschweigende Annahme. |
| `src/screens/S4Vergleich.tsx` | Option |
| `src/screens/S5Export.tsx` | ('compose') const [body, setBody] = useState( 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unser indikatives ' + 'Angebot für das Musterprojekt Nordfeld.\n\nMit freundlichen Grüßen', ) // Открытые решения по покрытию — то же множество, что делает итог // промежуточным: список Recap не может разойтись с подписью итога. const offen = (Object.keys(s.coverage) as Array |
| `src/screens/S5Export.tsx` | Angebot für das Musterprojekt Nordfeld.\n\nMit freundlichen Grüßen |
| `src/screens/S5Export.tsx` | Musterprojekt Nordfeld |
| `src/screens/S5Export.tsx` | Preisänderung |
| `src/screens/S5Export.tsx` | Preisänderungen |
| `src/screens/S5Export.tsx` | Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unser indikatives |
