import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { CONFIGURATOR_STEP, CONFIGURATOR_STEPS } from '../../state/chapters'
import { __resetStoreForTests, useStore } from '../../state/store'

/**
 * Единица стоит рядом с числом ровно один раз — на всех главах.
 *
 * Повод конкретный: `moneyLabel` возвращает строку СО знаком валюты, а два
 * шаблона на карточках охвата добавляли второй, и продавец видел
 * `+ 124.000 € € Mehrpreis`. Дефект пережил ревью компонентов и поставку
 * копирайта: поставка № 5 перенесла текст в словарь дословно и пометила
 * «дефектный двойной знак валюты», то есть каждый слой считал его чужим.
 *
 * Поэтому тест не про два исправленных места, а про инвариант: обход всех
 * глав и поиск удвоения. Такой тест растёт вместе с интерфейсом, тогда как
 * две точечные проверки отстали бы от третьего случая.
 */

beforeEach(() => __resetStoreForTests())

/** Знак валюты дважды подряд — через любой пробел или без него. */
const DOUBLED = /€[\s  ]*€/

async function enterPipeline(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
  await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
  await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
  await user.click(screen.getByRole('button', { name: 'Öffnen' }))
  await user.click(screen.getByRole('button', { name: 'Gebäude bestätigen' }))
  await user.click(screen.getByRole('button', { name: 'Konfigurator öffnen' }))
  await user.click(screen.getByRole('radio', { name: 'Je Gebäude konfigurieren' }))
  await user.click(screen.getByRole('button', { name: 'Konfiguration starten' }))
}

describe('единицы: знак валюты не удваивается', () => {
  it('ни одна глава конвейера не показывает «€ €»', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)

    for (const step of CONFIGURATOR_STEPS) {
      act(() => useStore.getState().openConfiguratorStepAt(step.id))
      const text = document.body.textContent ?? ''
      expect(DOUBLED.test(text), `глава ${step.label}`).toBe(false)
    }
  })

  it('карточки охвата называют цену включения с одним знаком валюты', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterPipeline(user)
    // Scope Boundaries by IDENTITY, not a literal chapter number — this is
    // the chapter whose coverage tiles show `Mehrpreis`/`Minderpreis`.
    act(() => useStore.getState()
      .openConfiguratorStepAt(CONFIGURATOR_STEP.SCOPE_BOUNDARIES))

    const text = document.body.textContent ?? ''
    // Последствие на плитке обязано существовать — иначе тест доказывал бы
    // отсутствие удвоения отсутствием текста.
    expect(text).toMatch(/Mehrpreis|gegenüber Aufnahme/)
    expect(DOUBLED.test(text)).toBe(false)
  })
})
