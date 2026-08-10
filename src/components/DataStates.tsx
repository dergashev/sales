import { useTx } from '../i18n'

/**
 * Семь состояний данных (правило 30) как КОМПОНЕНТЫ, а не как разметка
 * галереи.
 *
 * До D-28 эти образцы были нарисованы прямо в QA Foundation:
 * `<p className="border border-border-default p-3 …">`. То есть витрина
 * состояний существовала во второй, рукописной копии — и выглядела иначе,
 * чем дизайн-система, ровно потому, что была другой разметкой. Продукт при
 * этом рисовал те же состояния в третий раз, каждый экран по-своему.
 *
 * Здесь разметка одна. Знак рядом с текстом обязателен (правило 8): статус
 * никогда не передаётся только цветом.
 *
 * **Контрактного класса у этих блоков пока нет.** `DC-24 EmptyState`
 * объявлен в README, но `components.css` его не несёт, а `design-system/**`
 * — чужая зона: изобретать там имена нельзя (`PROTOCOL` §2-bis). Поэтому
 * вид пока собран токенами, как и был, и запрошен заданием № 30. Порядок
 * именно такой, а не обратный: сначала убрана ВТОРАЯ разметка, потом первая
 * получит контракт. Обратный порядок оставил бы копию жить дальше.
 */

const BOX = 'border p-3 text-body'

export function EmptyState({ children }: { children: string }) {
  const tx = useTx()
  return (
    <p className={`${BOX} border-border-default text-text-secondary`}>
      <span aria-hidden="true">○ </span>{tx(children)}
    </p>
  )
}

/**
 * Частичные данные: величина без расчётной базы. Ноль запрещён
 * (правило 16), поэтому состояние называет отсутствие расчёта и его
 * следствие для итога — оба, а не одно.
 */
export function PartialState({ label, consequence }: {
  label: string
  consequence: string
}) {
  const tx = useTx()
  return (
    <p className={`numeric ${BOX} border-border-default text-text-primary`}>
      {tx(label)}
      <span className="mt-1 block text-small text-text-secondary">
        {tx(consequence)}
      </span>
    </p>
  )
}

/** Ошибка — всегда втроём: причина, следствие, средство (STATE-005). */
export function ErrorState({ cause, remedy }: {
  cause: string
  remedy: string
}) {
  const tx = useTx()
  return (
    <div className="border-contrast border-border-error p-3">
      <p className="text-body text-text-primary">
        <span aria-hidden="true">✗ </span>{tx(cause)}
      </p>
      <p className="a3-cap mt-1">{tx(remedy)}</p>
    </div>
  )
}

/** Устаревшее несёт свой возраст, а не выглядит актуальным. */
export function StaleState({ children }: { children: string }) {
  const tx = useTx()
  return (
    <p className={`${BOX} border-border-warning text-text-primary`}>
      <span aria-hidden="true">▲ </span>{tx(children)}
    </p>
  )
}

/**
 * Объяснение отсутствия по правам. Недоступное по правам ОТСУТСТВУЕТ в
 * дереве (R-17) — этот компонент не способ показать скрытое, а способ
 * назвать причину там, где называть уместно.
 */
export function PermissionState({ children }: { children: string }) {
  const tx = useTx()
  return (
    <p className={`${BOX} border-border-default text-text-secondary`}>
      <span aria-hidden="true">○ </span>{tx(children)}
    </p>
  )
}
