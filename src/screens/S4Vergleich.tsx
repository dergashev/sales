import { useMemo, useState } from 'react'
import { Decimal } from 'decimal.js'
import { useStore } from '../state/store'
import { calculateBuilding, type BuildingInput } from '../engine/calculate'
import { withRegionalFactor } from '../state/catalog'
import { NNBSP, present, rate, formatDE } from '../engine/money'
import { Button } from '../components/primitives'

/**
 * S4 Variantenvergleich — до четырёх вариантов, по умолчанию только различия.
 *
 * Колонки считаются живым движком от текущего состояния, а не читаются из
 * фикстуры: тесты уже доказали, что движок фикстуру воспроизводит, и второй
 * источник значений здесь был бы вторым источником правды.
 *
 * Дельты названы явно «zur Vergleichsbasis» — роли колонок независимы
 * (VARIANT-001): звезда зарезервирована за целевым оффером и не означает
 * базу сравнения. Интервал одинаков во всех колонках, потому что опция
 * варианта подтверждением параметра не является (D-19) — отдельные значения
 * для прогонов вариантов фикстура не объявляет, и выдумывать их нельзя.
 */

type VariantDef = {
  name: string
  patch: Partial<BuildingInput>
  roles: string[]
}

const VARIANTS: VariantDef[] = [
  { name: 'Basis', patch: {}, roles: ['Vergleichsbasis', '★ Zielangebot'] },
  { name: 'Ohne UG', patch: { untergeschoss: 'kein_ug' }, roles: [] },
  { name: 'EH 40', patch: { energiestandard: 'EH_40' }, roles: [] },
]

export function S4Vergleich() {
  const s = useStore()
  const [showAll, setShowAll] = useState(false)
  const p = s.projection()

  const cols = useMemo(() => VARIANTS.map((v) => {
    const input: BuildingInput = { ...s.building, ...v.patch }
    const res = calculateBuilding(input, withRegionalFactor(s.regionalfaktorActive), s.coverage)
    return { def: v, input, res, wflRate: rate(res.total.exact, s.fields.wfl.value, 'WFL_WOFLV') }
  }), [s.building, s.coverage, s.fields.wfl.value, s.regionalfaktorActive])

  const base = cols[0]!

  type Row = {
    label: string
    group: string
    cells: string[]
    differs: boolean
    warn?: boolean
  }

  const money = (d: Decimal) => {
    const pr = present(d)
    return `${pr.prefix}${pr.prefix ? NNBSP : ''}${pr.display}`
  }
  const delta = (d: Decimal) => {
    if (d.isZero()) return '—'
    const pr = present(d.abs())
    const sign = d.isNegative() ? '−' : '+'
    return `${sign}${NNBSP}${pr.prefix ? pr.prefix + NNBSP : ''}${pr.display}`
  }

  const rows: Row[] = [
    {
      group: 'ERGEBNIS', label: `Zwischensumme der kalkulierten Positionen (€)`,
      cells: cols.map((c) => money(c.res.total.exact)), differs: true,
    },
    {
      group: 'ERGEBNIS', label: 'Delta zur Vergleichsbasis (€)',
      cells: cols.map((c) => delta(c.res.total.exact.minus(base.res.total.exact))),
      differs: true,
    },
    {
      group: 'ERGEBNIS', label: '€/m² WFL nach WoFlV',
      cells: cols.map((c) => `${c.wflRate.prefix}${c.wflRate.prefix ? NNBSP : ''}${c.wflRate.display}`),
      differs: true,
    },
    {
      group: 'ERGEBNIS', label: 'Schätzunsicherheit',
      cells: cols.map(() => `±${NNBSP}${p.uncertaintyPp}${NNBSP}%`), differs: false,
    },
    {
      group: 'ERGEBNIS', label: 'Bauzeit (ab OKBP)',
      cells: cols.map(() => `${p.duration.prefix}${p.duration.prefix ? NNBSP : ''}${p.duration.display}`),
      differs: false,
    },
    {
      group: 'ERGEBNIS', label: 'Fertigstellung',
      cells: cols.map(() => formatDate(p.duration.completionDate)), differs: false,
    },
    {
      group: 'UMFANG', label: 'Untergeschoss',
      cells: cols.map((c) => c.input.untergeschoss === 'kein_ug'
        ? 'nicht Bestandteil' : 'Vollständiger UG-Bau inkl. Gründung'),
      differs: true,
    },
    {
      group: 'UMFANG', label: 'BGF unterirdisch (m²)',
      cells: cols.map((c) => c.input.untergeschoss === 'kein_ug'
        ? '0,00' : formatDE(c.input.bgfBelowGround, 2)),
      differs: true,
    },
    {
      group: 'UMFANG', label: 'Tiefgarage im Untergeschoss',
      cells: cols.map((c) => c.input.untergeschoss === 'kein_ug'
        ? 'nicht Bestandteil' : 'enthalten'),
      differs: true,
    },
    {
      group: 'QUALITÄT', label: 'Energiestandard',
      cells: cols.map((c) => c.input.energiestandard.replace('_', NNBSP)), differs: true,
    },
    {
      group: 'QUALITÄT', label: 'Gebäudeklasse',
      cells: cols.map(() => `GK${NNBSP}5`), differs: false,
    },
    {
      group: 'QUALITÄT', label: 'Klassifikation nach MBO §2',
      cells: cols.map(() => s.building.gebaeudeklasse.confirmed
        ? '✓ bestätigt' : '▲ nicht bestätigt'),
      differs: false,
      warn: !s.building.gebaeudeklasse.confirmed,
    },
  ]

  // «Различается» — вычисляется из ячеек, а не объявляется: строка с
  // одинаковыми значениями во всех колонках различием не является.
  const visible = rows.filter((r) => {
    const actuallyDiffers = new Set(r.cells).size > 1
    return showAll || actuallyDiffers
  })

  const groups = [...new Set(visible.map((r) => r.group))]

  return (
    <div className="px-7 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border-strong pb-3">
        <h1 className="text-heading-2 font-bold text-text-primary">
          Variantenvergleich · Haus{NNBSP}A · DEMO-SC-01
        </h1>
        <Button onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>
          {showAll ? 'nur Unterschiede' : 'alle Zeilen anzeigen'}
        </Button>
      </header>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-body">
          <caption className="sr-only">Vergleich der Varianten</caption>
          <thead>
            <tr className="border-b border-border-strong text-left">
              <th className="py-2 pr-4 font-medium">
                {showAll ? 'alle Zeilen' : 'nur Unterschiede'}
              </th>
              {cols.map((c) => (
                <th key={c.def.name} className="py-2 pr-4 text-right font-medium">
                  {c.def.name}
                  {c.def.roles.length > 0 && (
                    <span className="block text-small font-regular text-text-secondary">
                      {c.def.roles.join(' · ')}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRows key={g} group={g} rows={visible.filter((r) => r.group === g)} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-small text-text-muted">
        Schätzunsicherheit ist in allen Spalten gleich: eine Options-Wahl ist
        keine Parameterbestätigung (D-19), und eigene Werte für
        Varianten-Läufe erklärt die Fixture nicht — sie zu erfinden wäre
        derselbe Fehler wie ein ausgedachter Token (R-25). Bauzeit hängt nur
        von BGF oberirdisch, Form und GK{NNBSP}Zeit ab — daher eine
        Fertigstellung für alle drei.
      </p>
      <p className="mt-2 text-small text-text-muted">
        Rollen sind unabhängige Text-Badges: ★ markiert das Zielangebot,
        Deltas rechnen zur benannten Vergleichsbasis (VARIANT-001, XSC-08).
      </p>
    </div>
  )
}

function GroupRows({ group, rows }: { group: string; rows: Array<{ label: string; cells: string[]; warn?: boolean }> }) {
  if (!rows.length) return null
  return (
    <>
      <tr>
        <th colSpan={4} scope="colgroup"
            className="border-b border-border-subtle pt-4 pb-1 text-left text-small font-medium text-text-secondary">
          {group}
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={r.label} className="border-b border-border-subtle">
          <th scope="row" className="py-2 pr-4 text-left font-regular text-text-secondary">
            {r.label}
          </th>
          {r.cells.map((c, i) => (
            <td key={i} className={'numeric py-2 pr-4 text-right ' +
              (r.warn ? 'text-text-primary' : 'text-text-primary')}>
              {c}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}
