import { useTx } from '../i18n'
import { Diagnostics } from '../components/Diagnostics'
import type { FontCheck } from '../lib/font-check'
import { Gallery } from '../design-system/Gallery'

/**
 * Grundlagen — внутренняя QA-страница (в навигации помечена QA).
 *
 * Две задачи:
 * 1. Диагностика шрифта и каскада (правило 3 требует рантайм-проверку).
 * 2. Показ галереи образцов — правило 30 требует от каждого data-компонента
 *    пять состояний данных плюс оси stale/permission, и здесь они видны
 *    глазами, а не только объявлены в контракте.
 *
 * **Собственной разметки образцов у страницы больше нет** (решение D-28).
 * Прежде она была второй рукописной витриной: те же компоненты, нарисованные
 * заново утилитами, — и потому выглядевшие иначе, чем дизайн-система. Причина
 * была не в дисциплине: компонент состоит из разметки, поведения и стиля,
 * система поставляла один стиль, а две трети каждый потребитель писал сам.
 * Теперь объявление образца одно — `src/design-system/registry.tsx`, — и эта
 * страница его только показывает.
 */
export function Grundlagen({ fonts, cascade }: {
  fonts: FontCheck | null
  cascade: string[] | null
}) {
  const tx = useTx()

  return (
    <div className="px-7 py-6">
      <header className="border-b border-border-strong pb-4">
        <p className="a3-cap">{tx('QA · intern')}</p>
        <h1 className="mt-1 text-heading-2 font-bold text-text-primary">
          {tx('Grundlagen')}
        </h1>
      </header>

      <Diagnostics fonts={fonts} cascade={cascade} />

      <Gallery />
    </div>
  )
}
