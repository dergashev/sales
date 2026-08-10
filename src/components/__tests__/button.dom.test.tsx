import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../primitives'

const COMPONENT_CSS = readFileSync(resolve('design-system/components.css'), 'utf8')
const TOKENS_CSS = readFileSync(resolve('design-system/tokens.css'), 'utf8')

function luminance(hex: string): number {
  const channels = hex.match(/[\da-f]{2}/gi)!.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

function contrast(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (light! + 0.05) / (dark! + 0.05)
}

describe('Button · A11Y-001', () => {
  it('loading сохраняет focus и enabled-пару, сообщает процесс и подавляет повторную активацию', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <Button
        variant="primary"
        loading
        loadingLabel="Option wird erstellt …"
        onClick={onClick}
      >Opportunity Option anlegen</Button>,
    )

    const loading = screen.getByRole('button', { name: 'Option wird erstellt …' })
    loading.focus()
    expect(loading).toHaveFocus()
    expect(loading).toHaveAttribute('aria-busy', 'true')
    expect(loading).toHaveAttribute('aria-disabled', 'true')
    expect(loading).toHaveAttribute('data-loading', 'true')
    expect(loading).not.toHaveAttribute('disabled')
    expect(loading.querySelector('.a3-btn-spinner')).toHaveAttribute('aria-hidden', 'true')

    await user.click(loading)
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    fireEvent.click(loading)
    expect(onClick).not.toHaveBeenCalled()
    expect(loading).toHaveFocus()

    rerender(
      <Button
        variant="primary"
        loading={false}
        loadingLabel="Option wird erstellt …"
        onClick={onClick}
      >Opportunity Option anlegen</Button>,
    )

    const ready = screen.getByRole('button', { name: 'Opportunity Option anlegen' })
    expect(ready).toBe(loading)
    expect(ready).not.toHaveAttribute('aria-busy')
    expect(ready).not.toHaveAttribute('aria-disabled')
    expect(ready).toHaveFocus()
    await user.click(ready)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled остаётся фокусируемым, связывает видимую причину и не активируется', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Button disabled disabledReason="Erst Konflikte entscheiden" onClick={onClick}>
        Opportunity Option anlegen
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Opportunity Option anlegen' })
    const reason = screen.getByText('Erst Konflikte entscheiden')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toHaveAttribute('disabled')
    expect(button).toHaveAttribute('aria-describedby', reason.id)

    button.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
    expect(button).toHaveFocus()
  })

  it('unterdrückt autorepeat bei einer sonst aktiven Taste', () => {
    render(<Button variant="primary">Angebot prüfen</Button>)
    const button = screen.getByRole('button', { name: 'Angebot prüfen' })
    expect(fireEvent.keyDown(button, { key: 'Enter', repeat: true })).toBe(false)
    expect(fireEvent.keyDown(button, { key: ' ', repeat: true })).toBe(false)
  })

  it('bindet alle sichtbaren Zustände an die freigegebenen semantischen Tokens', () => {
    expect(TOKENS_CSS).toContain('--primitive-color-orange-700: #C94700')
    expect(TOKENS_CSS).toContain('--primitive-color-orange-800: #B83F00')
    expect(TOKENS_CSS).toContain('--primitive-color-orange-900: #A63800')
    expect(TOKENS_CSS).toContain('--color-action-primary-text:   var(--primitive-color-white)')
    expect(contrast('#C94700', '#FFFFFF')).toBeCloseTo(4.79, 2)
    expect(contrast('#B83F00', '#FFFFFF')).toBeCloseTo(5.60, 2)
    expect(contrast('#A63800', '#FFFFFF')).toBeCloseTo(6.59, 2)

    expect(COMPONENT_CSS).toContain('background:var(--color-action-primary-bg)')
    expect(COMPONENT_CSS).toContain('background:var(--color-action-primary-hover)')
    expect(COMPONENT_CSS).toContain('background:var(--color-action-primary-pressed)')
    expect(COMPONENT_CSS).toContain('var(--color-action-disabled-border)')
    expect(COMPONENT_CSS).toContain('.a3-btn[data-loading="true"]')
    expect(COMPONENT_CSS).toContain('animation:a3-btn-spin 800ms linear infinite')
    expect(COMPONENT_CSS.toUpperCase()).not.toContain('#FD5E00')

    expect(TOKENS_CSS).toMatch(
      /:focus-visible\s*\{[^}]*outline:[^;]*var\(--color-focus-ring\)[^}]*box-shadow:[^;]*var\(--color-focus-separator\)/s,
    )
    expect(COMPONENT_CSS).toMatch(
      /@media\s*\(prefers-reduced-motion:reduce\)[\s\S]*animation:none!important/,
    )
  })
})
