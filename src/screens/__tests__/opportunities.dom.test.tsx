import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../App'
import { __resetStoreForTests, useStore } from '../../state/store'

/**
 * Корень продукта: Opportunities, поиск, фильтры, гейт создания Options.
 * Проверяется то, что отличает уровень от экрана: до Option цены нет,
 * а до разрешённых конфликтов нет Option.
 */
beforeEach(() => __resetStoreForTests())

describe('Уровень Opportunities', () => {
  it('корень показывает список без панели цены', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Opportunities' })).toBeInTheDocument()
    // Цена принадлежит Option, а Option ещё не выбран.
    expect(screen.queryByRole('complementary', { name: 'Angebot' })).not.toBeInTheDocument()
    expect(screen.getByText(/8 von 8 Opportunities/)).toBeInTheDocument()
  })

  it('фильтр сужает множество и сообщает, сколько спрятал', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByLabelText('Land'), 'Schweiz')
    expect(screen.getByText(/2 von 8 Opportunities/)).toBeInTheDocument()
    // Активный фильтр виден и снимается по одному.
    await user.click(screen.getByRole('button', { name: /Filter entfernen: Land/ }))
    expect(screen.getByText(/8 von 8 Opportunities/)).toBeInTheDocument()
  })

  it('поиск ищет по имени, городу и владельцу', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Opportunities durchsuchen'), 'Probe')
    expect(screen.getByText(/2 von 8 Opportunities/)).toBeInTheDocument()
  })

  it('пустой результат объясняет себя, а не просто пустеет', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('Opportunities durchsuchen'), 'zzz')
    expect(screen.getByText(/Keine Opportunity entspricht den Filtern/)).toBeInTheDocument()
  })

  it('Option нельзя создать, пока конфликт не решён и параметры не приняты', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))

    const create = screen.getByRole('button', { name: 'Opportunity Option anlegen' })
    expect(create).toHaveAttribute('aria-disabled', 'true')
    expect(useStore.getState().canCreateOptions()).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Kundenwert übernehmen' }))
    expect(useStore.getState().canCreateOptions()).toBe(false)   // параметры ещё нет
    await user.click(screen.getByRole('button', { name: 'Projektparameter bestätigen' }))
    expect(useStore.getState().canCreateOptions()).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Opportunity Option anlegen' }))
    expect(useStore.getState().options).toHaveLength(1)
    // Панель цены появляется только внутри Option.
    await user.click(screen.getByRole('button', { name: 'Öffnen' }))
    expect(screen.getByRole('complementary', { name: 'Angebot' })).toBeInTheDocument()
  })

  it('выведенные значения несут пометку происхождения (D-22)', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Musterprojekt Nordfeld öffnen/ }))
    const params = screen.getByLabelText('Projektparameter')
    // Пометка приходит из данных, а не дописана в разметке.
    expect(within(params).getAllByText(/nicht kalibriert/).length).toBeGreaterThanOrEqual(3)
    expect(within(params).getByText(/Total BGF \(S\)/)).toBeInTheDocument()
  })

  it('EN переключает содержимое экранов, не только хром (ревью № 13, дефект 2)', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Переключатель языка — в шапке; словарь = поставка Codex + локальное
    // дополнение для строк, созданных после поставки.
    // Подпись переключателя называет частичность ДО клика: «EN · Entwurf».
    expect(screen.getByText(/EN ist noch ein Entwurf/)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /EN/ }))
    expect(screen.getByText('Root · all opportunities')).toBeInTheDocument()
    // Немецкая строка поискового лейбла исчезла — заменена переводом.
    expect(screen.queryByText('Opportunities durchsuchen')).toBeNull()
    // Немецкий остаётся источником: переключение обратно восстанавливает.
    await user.click(screen.getByRole('radio', { name: /^DE$/ }))
    expect(screen.getByText('Wurzel · alle Opportunities')).toBeInTheDocument()
  })

  it('непроработанная Opportunity говорит это до расчёта, а не показывает выдумку', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Musterquartier Südhang öffnen/ }))
    expect(screen.getByText(/im Prototyp nicht ausgearbeitet/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Projektparameter')).not.toBeInTheDocument()
  })
})
