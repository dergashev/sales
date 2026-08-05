import { useMemo } from 'react'
import type { FontCheck } from '../lib/font-check'
import catalog from '../fixtures/catalog.json'
import demo from '../fixtures/demo-0001.json'
import { Decimal } from 'decimal.js'

/**
 * Диагностика оснований. Пять проверок, каждая — дефект, который уже случался
 * и стоил цикла аудита. Показывается видимо: тихий провал повторил бы исходную
 * ошибку, где шрифт молча не подключился и это заметили только на макетах.
 *
 * Статус никогда не передаётся одним цветом — рядом всегда знак и подпись
 * (правило проекта 8).
 */

type Row = { name: string; ok: boolean | null; detail: string }

function useChecks(fonts: FontCheck | null, cascade: string[] | null): Row[] {
  return useMemo(() => {
    const rows: Row[] = []

    rows.push({
      name: 'Visuelt Pro — три начертания',
      ok: fonts ? fonts.ok : null,
      detail: fonts
        ? fonts.ok
          ? 'Regular, Medium, Bold доступны браузеру'
          : `недоступны: ${fonts.missing.join('; ')}`
        : 'ожидание document.fonts.ready',
    })

    rows.push({
      name: 'Каскад шрифта и белый фон',
      ok: cascade ? cascade.length === 0 : null,
      detail: cascade
        ? cascade.length === 0
          ? 'html, body и элементы форм несут font-family; подложка белая'
          : cascade.join(' · ')
        : 'ожидание',
    })

    // Токены: если переменная не разрешилась, вернётся пустая строка.
    const probe = getComputedStyle(document.documentElement)
    const accent = probe.getPropertyValue('--color-text-display-accent').trim()
    const space4 = probe.getPropertyValue('--space-4').trim()
    rows.push({
      name: 'Токены дизайн-системы читаются',
      ok: Boolean(accent && space4),
      detail: accent && space4
        ? `акцент ${accent} · шаг отступа ${space4}`
        : 'переменные не разрешились — tokens.css не подключён',
    })

    // Фикстура: не «файл есть», а «числа сходятся».
    const run = demo.runs.find((r) => r.calculationRunId === 'DEMO-RUN-0007')
    const drivers = run?.drivers ?? []
    const sum = drivers.reduce((acc, d) => acc.plus(new Decimal(d.exact)), new Decimal(0))
    const total = new Decimal(run?.total.exact ?? '0')
    rows.push({
      name: 'Сходимость драйверов с итогом',
      ok: sum.equals(total) && drivers.length > 0,
      detail: drivers.length
        ? `${drivers.length} драйвера дают ${sum.toFixed(2)}, итог ${total.toFixed(2)}`
        : 'драйверы не загрузились',
    })

    // Открытый блокер обязан закрывать все пять клиентских профилей —
    // фикстура специально воспроизводит блокирующий сценарий, а не удобный.
    const issue = demo.validationIssues[0]
    rows.push({
      name: 'Блокер выдачи закрывает пять профилей',
      ok: issue?.state === 'open' && issue.blockedOutputProfiles.length === 5,
      detail: issue
        ? `${issue.id} · ${issue.state} · ${issue.materiality} · ${issue.blockedOutputProfiles.length} профилей`
        : 'блокер не загрузился',
    })

    return rows
  }, [fonts, cascade])
}

export function Diagnostics({
  fonts,
  cascade,
}: {
  fonts: FontCheck | null
  cascade: string[] | null
}) {
  const rows = useChecks(fonts, cascade)
  const failed = rows.filter((r) => r.ok === false)

  return (
    <section className="mt-7">
      <h2 className="text-body font-bold text-text-primary">Проверка оснований</h2>

      {failed.length > 0 && (
        <p className="mt-3 border-contrast border-border-error p-4 text-body font-medium text-text-primary">
          ✗ Не выполнено: {failed.length} из {rows.length}. Продукт на таком
          основании собирать нельзя — сначала эти пункты.
        </p>
      )}

      {/* Каждая таблица — в контейнере с горизонтальной прокруткой:
          метрики шрифта не закладываются в пиксели (правило 3a). */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-border-strong text-left">
              <th className="py-3 pr-5 font-medium">Основание</th>
              <th className="py-3 pr-5 font-medium">Состояние</th>
              <th className="py-3 font-medium">Подробность</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-border-subtle align-top">
                <td className="py-3 pr-5 font-medium text-text-primary">{r.name}</td>
                <td className="py-3 pr-5 whitespace-nowrap">
                  {r.ok === null ? (
                    <span className="text-text-muted">◌ проверяется</span>
                  ) : r.ok ? (
                    <span className="text-text-primary">✓ выполнено</span>
                  ) : (
                    <span className="font-medium text-text-primary">✗ не выполнено</span>
                  )}
                </td>
                <td className="py-3 text-text-secondary">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 text-small text-text-muted">
        Фикстура: {demo.scenario.scenarioId} · прогон{' '}
        {demo.scenario.calculationRunId} · правила {catalog.rulesetVersion} ·
        Regionalfaktor {demo.scenario.regionalFactor}
      </p>
    </section>
  )
}
