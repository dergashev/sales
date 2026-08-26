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
          <div className="a3-grid-host a3-specimen-grid mt-4">
            {group.specimens.map((s) => (
              <section key={s.id} className="a3-sheet" data-specimen={s.id}>
                <h3 className="text-heading-3 font-bold text-text-primary">
                  {s.title}
                </h3>
                <p className="a3-specimen-meta">
                  {s.contractId} · {s.maturity}
                  {s.blockedVariants.length > 0
                    ? ` · blockiert: ${s.blockedVariants.join(', ')}`
                    : ''}
                </p>
                {s.note && <p className="a3-cap a3-lede mt-1">{tx(s.note)}</p>}
                <details className="a3-specimen-contract">
                  <summary>Vertrag und Evidenz</summary>
                  <p>{s.requirements.join(' · ') || 'Keine Requirement-ID'}</p>
                  <p>{s.evidence}</p>
                  <p>
                    Datenzustände: {Object.entries(s.dataStates)
                      .map(([state, support]) => `${state}: ${support}`)
                      .join(' · ')}
                  </p>
                  {/* REDESIGN R1 (efcbdaf3), merged DS-Task-1 defect: every
                      specimen has always DECLARED interactionStates, but the
                      Gallery never rendered them — inspectable nowhere,
                      registry entries `blockedVariants:[]` looked identical
                      to a specimen with no interaction states at all.
                      Composed contracts get the same treatment: which
                      canonical primitives a domain specimen reuses was also
                      declared-but-invisible. */}
                  <p>
                    Interaktionszustände: {s.interactionStates.length > 0
                      ? s.interactionStates.join(' · ')
                      : 'keine (statisches Layout)'}
                  </p>
                  {s.composedContracts.length > 0 && (
                    <p>Zusammengesetzt aus: {s.composedContracts.join(' · ')}</p>
                  )}
                </details>
                <div className="mt-3">{s.render()}</div>
              </section>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
