import { useEffect, useId, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { useTx } from '../i18n'

/**
 * DC-43 · InternalNote — Notiz. Плюс DC-30 · AutosaveChip как её
 * подтверждение: правило 34 связывает их прямо — «тихая запись с
 * подтверждением только через Speicher-Chip».
 *
 * Почему заметка вообще существует. Продавец на встрече записывает то, что
 * услышал, и это не должно превращаться в отдельный ритуал: ни модалки, ни
 * кнопки «Сохранить», ни тоста. Поле, в которое пишут, и чип, который
 * говорит, что записано, — весь интерфейс.
 *
 * Контрактные требования, которые легко потерять:
 * - **в клиентских профилях заметки не существует** (`NOTE-006`, R-17,
 *   D-12): не скрыта стилем, а отсутствует в дереве. Здесь это
 *   `mode === 'praesentation' → null` — компонент не рендерится вовсе;
 * - видимая метка обязательна, placeholder её не заменяет (`NOTE-001`);
 * - мета-строка называет автора, время и видимость (`NOTE-002`);
 * - нейтральный статус синка выражается ТЕКСТОМ, а не серой точкой
 *   (`NOTE-007`);
 * - уход с экрана сохраняет черновик и не теряет его молча (`NOTE-004`).
 *
 * Симуляция названа: синка с HubSpot в прототипе нет, есть таймер и
 * события журнала `note.created` / `note.synced_to_hubspot` (правило 34).
 * Дефектом была бы симуляция, выданная за реализацию.
 */

/** Пауза без ввода, после которой запись считается состоявшейся. */
const IDLE_MS = 900
/** Симуляция круга до CRM. */
const SYNC_MS = 1200

type SyncState = 'leer' | 'entwurf' | 'wird' | 'ok' | 'fehler'

export function InternalNote() {
  const s = useStore()
  const tx = useTx()
  const fieldId = useId()
  const helpId = useId()
  const [text, setText] = useState(s.noteText)
  const [state, setState] = useState<SyncState>(s.noteText ? 'ok' : 'leer')
  const idle = useRef<ReturnType<typeof setTimeout>>()
  const sync = useRef<ReturnType<typeof setTimeout>>()
  /** Набранное, чья запись ещё не состоялась. `null` — ждать нечего. */
  const pending = useRef<string | null>(null)

  /**
   * Досрочная запись набранного.
   *
   * Комментарий прежней редакции утверждал «черновик переживает уход с
   * экрана: он живёт в сторе» — и это было неправдой ровно в том случае,
   * ради которого писалось: в сторе он оказывался только через 900 мс
   * простоя, а cleanup гасил оба таймера, ничего не записав. Уйти быстрее
   * паузы — и текста нет (сплошное ревью 26, находка 3). Здесь черновик
   * действительно переживает уход, потому что уход его дописывает.
   */
  const flush = () => {
    clearTimeout(idle.current)
    clearTimeout(sync.current)
    const v = pending.current
    pending.current = null
    // Действие берётся из `getState()`, а не из замыкания рендера: cleanup с
    // пустым списком зависимостей помнит стор на момент монтирования.
    if (v !== null) useStore.getState().saveNote(v)
  }
  const flushRef = useRef(flush)
  flushRef.current = flush

  useEffect(() => () => flushRef.current(), [])

  // Переход в презентацию убирает поле с экрана, не размонтируя компонент, —
  // для набранного это тот же уход, и он тоже обязан дописать.
  const hidden = s.mode === 'praesentation'
  useEffect(() => {
    if (hidden) flushRef.current()
  }, [hidden])

  if (hidden) return null

  const onChange = (v: string) => {
    setText(v)
    setState('entwurf')
    pending.current = v
    clearTimeout(idle.current)
    clearTimeout(sync.current)
    idle.current = setTimeout(() => {
      // Тихая запись: событие журнала есть, тоста нет.
      pending.current = null
      s.saveNote(v)
      setState('wird')
      sync.current = setTimeout(() => {
        s.markNoteSynced()
        setState('ok')
      }, SYNC_MS)
    }, IDLE_MS)
  }

  /** Статус синка — ясный текст (NOTE-007), не необъяснённая точка. */
  const chipText: Record<SyncState, string> = {
    leer: '→ CRM · noch keine Änderungen',
    entwurf: '→ CRM · Entwurf, noch nicht gespeichert',
    wird: '→ HubSpot · wird synchronisiert',
    ok: '✓ synchronisiert · HubSpot-Projektkarte',
    fehler: 'Fehler · erneut versuchen',
  }

  return (
    /* Секция принадлежит САМОМУ компоненту: обёртка снаружи оставалась в
       дереве доступности пустой при `praesentation` — заметка была
       «скрыта», а контракт требует, чтобы её не существовало (NOTE-006).
       Приёмка волны C поймала именно оболочку, а не содержимое. */
    <section className="a3-notecard a3-sheet mt-6" aria-label="Interne Notiz">
      {/* Видимая метка обязательна: placeholder подсказывает назначение,
          но подписью не является (NOTE-001). */}
      <label htmlFor={fieldId}><b>{tx('Interne Notiz')}</b></label>
      <span className="a3-cap" id={helpId}>
        {tx('Nur intern · synchronisiert in die HubSpot-Projektkarte · in Kundenprofilen vollständig ausgeblendet.')}
      </span>
      <textarea
        id={fieldId}
        aria-describedby={helpId}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        // F42: this used to near-duplicate the caption above (both said
        // "Nur intern … HubSpot-Projektkarte") — the caption already covers
        // visibility/sync, so the placeholder now hints at CONTENT instead.
        placeholder={tx('z. B. besprochene Sonderwünsche, offene Rückfragen')}
      />
      {/* Мета-строка: кто, когда, кому видно (NOTE-002). */}
      <span className="a3-cap">
        {tx('Verfasser')}: M.{' '}Musterfrau · {tx('Sichtbarkeit')}:{' '}
        {tx('nur internes Arbeitsumfeld')}
        {s.noteSavedAt && <> · {tx('zuletzt gespeichert')} {s.noteSavedAt}</>}
      </span>
      {/* Speicher-Chip (DC-30) — единственное подтверждение записи. */}
      <span className={'a3-chip-src a3-savechip' + (state === 'wird' ? ' a3-busy' : '')}
            role="status" aria-live="polite">
        <span aria-hidden="true" className="a3-dot" />
        {tx(chipText[state])}
      </span>
    </section>
  )
}
