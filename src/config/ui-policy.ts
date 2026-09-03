/**
 * Политики интерфейса — величины, которые управляют ПОВЕДЕНИЕМ, а не видом.
 *
 * Почему отдельный модуль, а не `tokens.css`. Раздел 13 норматива (R-15)
 * держит в токенах только визуальный слой; business state, policy и domain
 * живут в контрактах данных и политик. Окно отмены — политика безопасности
 * (`SAFETY-001`): она отвечает «сколько времени у пользователя есть, чтобы
 * передумать», а не «как это выглядит». Первая редакция положила её в
 * `tokens.css`, и `npm run verify` справедливо не принял место хранения —
 * наличие ADR-заготовки этого не отменяет.
 *
 * У каждого значения назван документ-источник. Значение без источника здесь
 * появиться не может: это ровно тот класс, за который аудит отклонял партии
 * (величина живёт в двух местах, сверяет их только удача).
 */

/**
 * Окно отмены у тоста DC-29. Источник: `CLAUDE.md` правило 29 и
 * `design-system/README.md` §DC-29 — «8 с» названы словами в обоих.
 * [provisional] Формальное утверждение — за владельцем (`adr-drafts-260806.md`).
 */
export const UNDO_WINDOW_MS = 8000

/**
 * Уход тоста. Источник: `CLAUDE.md` правило 20 и `design-system/README.md`
 * §5 — «выход = fade 120 мс». Величина нужна коду, а не только стилю:
 * после ухода содержимое обязано ПЕРЕСТАТЬ существовать, иначе невидимые
 * кнопки остаются в порядке обхода и принимают клики (сплошное ревью 26,
 * находка 31).
 */
export const TOAST_EXIT_MS = 120

/**
 * Время жизни дельта-чипа до ухода в журнал (DC-2, правило 24).
 * Источник: `design-system/README.md` §5 «Bewegung erklärt Geld».
 */
export const DELTA_CHIP_MS = 4000

/**
 * Симуляция доставки письма в S5. Не политика продукта, а объявленная
 * механика прототипа: подпись у статуса называет её симуляцией.
 */
export const DELIVERY_SIMULATION_MS = 2500

/**
 * VR2-08 — kurze, echte «wird gesendet»-Zwischenphase im Präsentations-
 * Versandfluss (Regel 25: kein erfundener Prozentwert, nur ein
 * indeterminate `Button`-Loading-Zustand), zwischen dem Klick auf "Angebot
 * jetzt senden" und dem eigentlichen Commit (`sendOfferForOption`). Bewusst
 * kürzer und von `DELIVERY_SIMULATION_MS` unterschieden: dort simuliert der
 * Prototyp die Zustellzeit NACH einem bereits erfolgten Versand, hier die
 * kurze Übermittlung selbst, bevor der unveränderliche Snapshot entsteht.
 */
export const SEND_COMMIT_SIMULATION_MS = 500

/**
 * M-06 — die Auflösung der sechsten Leistungsabgrenzungs-Entscheidung.
 *
 * Quelle: `vr3-03a-review/07-canonical-konfigurator-contract.md` §"M-06 —
 * scope completion", wortwörtlich: "The sixth decision resolves in no more
 * than 160ms; `6/6 entschieden` and first-included-KG availability resolve
 * within 220ms."
 *
 * Warum als POLITIK und nicht als Token: die beiden Werte steuern, WIE
 * LANGE ein einmaliger Zustandswechsel als solcher markiert bleibt, und der
 * Code muss sie kennen — die Markierung muss danach VERSCHWINDEN, sonst ist
 * eine dauerhafte Betonung daraus geworden, und genau das verbietet der
 * Vertrag ("Remove=Generic celebration or decorative motion"). Die
 * tatsächliche Dauer der Bewegung bleibt bei den kanonischen Tokens
 * (`--motion-feedback` 120 ms für die Zeile, `--motion-reveal` 200 ms für
 * Zähler und Freischaltung) — beide liegen innerhalb der genannten
 * Obergrenzen, deshalb entsteht hier kein neuer Zeitwert im Visuellen.
 *
 * `prefers-reduced-motion` nullt die Tokens, nicht diese Zahlen: der
 * Endzustand, der Fokus und die Ansage sind identisch, nur ohne Bewegung
 * (Regel 21, Vertrag §"Reduced motion").
 */
export const M06_ROW_MS = 160
export const M06_UNLOCK_MS = 220
