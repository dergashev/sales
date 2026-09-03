import { beforeEach, describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InternalNote } from '../InternalNote'
import { __resetStoreForTests, useStore } from '../../state/store'
import {
  completeBuildingScope,
  completeKgConfiguration,
  enterOptionWorkspace,
  saveOptionBaseline,
} from '../../test/offer-option'

/**
 * Заметка (DC-43) не теряется при быстром уходе.
 *
 * Тихая запись через 900 мс простоя — механика: подтверждение приходит
 * Speicher-Chip-ом, а не тостом. Но cleanup гасил оба таймера, ничего не
 * записав, и уйти быстрее паузы значило потерять набранное (сплошное ревью
 * 26, находка 3). Комментарий в коде при этом утверждал обратное — что
 * черновик живёт в сторе.
 *
 * Тест намеренно НЕ ждёт паузу: он проверяет ровно ту ветку, где её не
 * дождались.
 */

beforeEach(() => __resetStoreForTests())

describe('DC-43: набранное переживает уход с экрана', () => {
  it('размонтирование до паузы дописывает черновик, а не гасит его', async () => {
    const user = userEvent.setup()
    const view = render(<InternalNote />)
    const field = view.container.querySelector('textarea')!
    await user.type(field, 'Kunde nennt Fertigstellung Q3')

    expect(useStore.getState().noteText).toBe('')
    view.unmount()
    expect(useStore.getState().noteText).toBe('Kunde nennt Fertigstellung Q3')
  })

  it('переход в презентацию убирает поле — и тоже дописывает', async () => {
    // VR3-04: entering the client profile requires a valid SAVED baseline
    // (audit F-002), so this preamble walks the real journey rather than
    // confirming one building. The subject is unchanged — the note field
    // disappears in the client profile and the draft is flushed on the way
    // out — but the transition that triggers it is now a gate with a
    // prerequisite, and a preamble that could not satisfy it would be
    // testing a mode change that never happened.
    enterOptionWorkspace('DEMO-HAPPY-01')
    completeBuildingScope('SHARED')
    completeKgConfiguration()
    saveOptionBaseline()

    const user = userEvent.setup()
    render(<InternalNote />)
    const field = document.querySelector('textarea')!
    await user.type(field, 'Nachbargrundstück gehört dem Kunden')

    act(() => { useStore.getState().setMode('praesentation') })
    // Поле исчезает, компонент остаётся смонтированным: cleanup
    // размонтирования тут не сработал бы вовсе.
    expect(document.querySelector('textarea')).toBeNull()
    expect(useStore.getState().noteText).toBe('Nachbargrundstück gehört dem Kunden')
  })

  it('состоявшаяся запись не дублируется уходом', async () => {
    const user = userEvent.setup()
    const view = render(<InternalNote />)
    await user.type(document.querySelector('textarea')!, 'Kurz')
    await act(async () => { await new Promise((r) => setTimeout(r, 1000)) })
    const after = useStore.getState().journal.length
    view.unmount()
    expect(useStore.getState().journal.length).toBe(after)
  })
})
