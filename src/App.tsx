import { useEffect, useState } from 'react'
import { checkFonts, checkCascade, type FontCheck } from './lib/font-check'
import { Diagnostics } from './components/Diagnostics'

/**
 * Шаг 1 каркаса. Единственная задача этого экрана — доказать, что основания
 * работают: фирменный шрифт применён во всех трёх местах каскада, фон белый,
 * токены читаются, фикстура загружается и её арифметика сходится.
 *
 * Это не заглушка «Hello world». Каждый пункт здесь — дефект, который уже
 * случался в проекте и стоил цикла аудита.
 */
export function App() {
  const [fonts, setFonts] = useState<FontCheck | null>(null)
  const [cascade, setCascade] = useState<string[] | null>(null)

  useEffect(() => {
    // ПОСЛЕ ready: иначе проверка ответит «нет» просто потому, что загрузка
    // не завершилась, и соврёт в безопасную сторону.
    document.fonts.ready.then(() => {
      setFonts(checkFonts())
      setCascade(checkCascade())
    })
  }, [])

  return (
    <main className="mx-auto max-w-content px-5 py-7">
      <p className="text-small font-regular text-text-secondary">
        All3 · Indicative Offer Engine · Prototyp v0.5
      </p>
      <h1 className="mt-2 text-display-numeric-narrow font-bold text-text-primary">
        Grundlagen
      </h1>
      <p className="mt-3 max-w-content text-body font-regular text-text-secondary">
        Каркас доказывает основания, а не показывает данные. Экраны продукта —
        следующий шаг.
      </p>
      <Diagnostics fonts={fonts} cascade={cascade} />
    </main>
  )
}
