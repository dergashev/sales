import { useTx } from '../i18n'
import { SPECIMEN_GROUPS } from './registry'

/**
 * Галерея образцов. **Своей разметки образцов у неё нет** — она обходит
 * реестр (решение D-28).
 *
 * Это и есть механизм, которого не хватало. Прежде галерея рисовала
 * образцы сама, витрина рисовала их же по-своему, и «дизайн-система —
 * источник компонентов» оставалось намерением: сравнить две рукописные
 * разметки было нечем, а детекторы классов проверяют одну треть
 * компонента из трёх.
 *
 * Обрамление образца (рамка, заголовок, подпись) — единственное, что
 * галерея рисует; и это не образец, а его витринная оправа.
 */
export function Gallery() {
  const tx = useTx()
  return (
    <>
      {SPECIMEN_GROUPS.map((group) => (
        <section key={group.id} aria-label={group.title}>
          <h2 className="mt-7 text-heading-3 font-bold text-text-primary">
            {tx(group.title)}
          </h2>
          {group.intro && (
            <p className="mt-1 max-w-content text-small text-text-secondary">
              {tx(group.intro)}
            </p>
          )}
          <div className="a3-grid-host mt-4 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(38ch,1fr))]">
            {group.specimens.map((s) => (
              <section key={s.id} className="a3-sheet" data-specimen={s.id}>
                <h3 className="text-heading-3 font-bold text-text-primary">
                  {s.title}
                </h3>
                {s.note && <p className="a3-cap a3-lede mt-1">{tx(s.note)}</p>}
                <div className="mt-3">{s.render()}</div>
              </section>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
