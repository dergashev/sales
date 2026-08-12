import { useId, useRef, useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog, type DialogHandle } from '../Dialog'
import { PrintFlow } from '../PrintFlow'
import { Button } from '../primitives'
import { __resetStoreForTests, useStore } from '../../state/store'

beforeEach(() => __resetStoreForTests())

function NestedDialogs() {
  const [first, setFirst] = useState(false)
  const [second, setSecond] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstTitleRef = useRef<HTMLHeadingElement>(null)
  const secondTitleRef = useRef<HTMLHeadingElement>(null)
  const firstDialogRef = useRef<DialogHandle>(null)
  const firstTitleId = useId()
  const secondTitleId = useId()
  return (
    <>
      <Button ref={triggerRef} onClick={() => setFirst(true)}>Ersten Dialog öffnen</Button>
      <Dialog
        ref={firstDialogRef}
        open={first}
        onOpenChange={setFirst}
        labelledBy={firstTitleId}
        initialFocusRef={firstTitleRef}
        returnFocusTo={triggerRef}
      >
        <h2 ref={firstTitleRef} id={firstTitleId} tabIndex={-1}>Erster Dialog</h2>
        <Button onClick={() => setSecond(true)}>Zweiten Dialog öffnen</Button>
        <Button onClick={() => firstDialogRef.current?.close()}>Ersten schließen</Button>
      </Dialog>
      <Dialog
        open={second}
        onOpenChange={setSecond}
        labelledBy={secondTitleId}
        initialFocusRef={secondTitleRef}
      >
        <h2 ref={secondTitleRef} id={secondTitleId} tabIndex={-1}>Zweiter Dialog</h2>
        <Button onClick={() => setSecond(false)}>Zweiten schließen</Button>
      </Dialog>
    </>
  )
}

function PrintHarness() {
  const store = useStore()
  const triggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Button ref={triggerRef} onClick={() => store.setPrintOpen(true)}>
        Druckansicht öffnen
      </Button>
      <PrintFlow returnFocusTo={triggerRef} />
    </>
  )
}

describe('Dialog · shared modal lifecycle', () => {
  it('keeps background inert through exit, traps both Tab directions, and restores focus', async () => {
    const user = userEvent.setup()
    const { container } = render(<PrintHarness />)
    const trigger = screen.getByRole('button', { name: 'Druckansicht öffnen' })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: /Drucken/ })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(container.inert).toBe(true)
    expect(within(dialog).getByRole('heading', { name: /Drucken/ })).toHaveFocus()

    await user.tab({ shift: true })
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toHaveFocus()
    await user.tab()
    expect(within(dialog).getByRole('button', { name: 'Druckauftrag starten' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(container.inert).toBe(true)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Drucken/ })).toBeNull())
    expect(container.inert).toBe(false)
    expect(trigger).toHaveFocus()
  })

  it('Escape closes only the topmost layer and returns to its initiator', async () => {
    const user = userEvent.setup()
    render(<NestedDialogs />)
    const firstTrigger = screen.getByRole('button', { name: 'Ersten Dialog öffnen' })
    await user.click(firstTrigger)
    const secondTrigger = screen.getByRole('button', { name: 'Zweiten Dialog öffnen' })
    await user.click(secondTrigger)
    expect(screen.getByRole('dialog', { name: 'Zweiter Dialog' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Zweiter Dialog' })).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Erster Dialog' })).toBeInTheDocument()
    expect(secondTrigger).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Erster Dialog' })).toBeNull())
    expect(firstTrigger).toHaveFocus()
  })
})
