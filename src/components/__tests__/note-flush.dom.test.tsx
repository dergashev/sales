import { beforeEach, describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InternalNote } from '../InternalNote'
import { __resetStoreForTests, useStore } from '../../state/store'

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
    useStore.getState().openOpportunity('DEMO-0001')
    useStore.getState().resolveWflConflict('customer')
    useStore.getState().confirmProjectParams()
    useStore.getState().createOption('Basis')
    useStore.getState().openOption('OPT-01')
    useStore.getState().confirmBuilding(useStore.getState().activeBuildingId)

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
