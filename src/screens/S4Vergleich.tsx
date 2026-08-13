import { useRef, useState } from 'react'
import { Decimal } from 'decimal.js'
import {
  configForOption, projectionForOption, useStore, type OptionConfig,
} from '../state/store'
import { NNBSP, present, formatDE, rateLabel } from '../engine/money'
import { Button } from '../components/primitives'
import { Badge, NextStep, PageHeader } from '../components/designSystem'
import { useSemanticMotion } from '../design-system/motion'
import { useT, useTx } from '../i18n'
import { copyFor } from '../i18n/internal-refs'
import { isClientProjection, isVisibleInOutputProfile } from '../state/clientProjection'

/**
 * S4 Variantenvergleich — созданные Opportunity Options рядом.
 *
 * Колонка = Option. До ревью № 13 здесь стояли три ЗАШИТЫХ сценария
 * (Basis / Ohne UG / EH 40) — пользователь видел интерфейс сравнения, но
 * сравнивал не то, что создал. Теперь каждая колонка считается живым
 * движком из конфигурации своей Option (`projectionForOption`), и второй
 * источник значений не существует.
 *
 * Дельты названы явно «zur Vergleichsbasis» — роли колонок независимы
 * (VARIANT-001): звезда зарезервирована за целевым оффером и базу
 * сравнения не означает. Интервал точности у каждой Option свой: он
 * сужается подтверждениями, а подтверждения принадлежат Option (D-19).
 */

const ES_LABEL: Record<string, string> = {
  GEG: 'GEG', EH_55: `EH${NNBSP}55`, EH_40: `EH${NNBSP}40`,
}

export function S4Vergleich() {
  const s = useStore()
  const tx = useTx()
  const t = useT()
  const [showAll, setShowAll] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { reduced: reducedMotion } = useSemanticMotion()
  const client = isClientProjection(s.mode)

  const cols = s.options.flatMap((o) => {
    const cfg = configForOption(s, o.id)
    const p = projectionForOption(s, o.id)
    return cfg && p ? [{ option: o, cfg, p }] : []
  })

  if (cols.length === 0) {
    // В конвейер без Option не попасть, но состояние обязано объяснить
    // себя, а не рендерить пустую таблицу (правило 30: empty — не пропуск).
    return (
      <div className="px-7 py-6">
        <p className="text-body text-text-secondary">
          <span aria-hidden="true">○ </span>{tx('Noch keine Opportunity Option angelegt. Optionen entstehen auf der Opportunity-Karte, nachdem Konflikte gelöst und Parameter bestätigt sind.')}</p>
      </div>
    )
  }

  const base = cols[0]!

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
  const perBuilding = (cfg: OptionConfig, f: (id: string) => string) =>
    Object.keys(cfg.buildings).filter((id) => cfg.included[id]).map(f).join(' · ')
  const buildingLabel = (id: string, config: OptionConfig) => client
    ? config.buildings[id]?.stableName ?? tx('Gebäude')
    : id

  type Sub = { text: string; save: boolean } | null
  type Row = { label: string; group: string; cells: string[]; subCells?: Sub[] }

  const rows: Row[] = [
    {
      group: 'ERGEBNIS', label: `${tx(base.p.result.totalLabel)} (€)`,
      cells: cols.map((c) => money(c.p.result.total.exact)),
      // Дельта к базе — подстрочник той же ячейки (.a3-d контракта DC-11),
      // экономия получает .a3-save; отдельная строка дельты не существует.
      subCells: cols.map((c, i) => i === 0 ? null : ({
        text: `${delta(c.p.result.total.exact.minus(base.p.result.total.exact))} gegenüber ${base.option.name}`,
        save: c.p.result.total.exact.lt(base.p.result.total.exact),
      })),
    },
    {
      // Each Option can carry a different building set and therefore a
      // different typed denominator. The denominator travels with its cell;
      // a shared row label may never borrow it from the base column.
      group: 'ERGEBNIS', label: t('comparison.leadRate'),
      cells: cols.map((c) => rateLabel(c.p.leadRate)),
    },
    {
      group: 'ERGEBNIS', label: 'Schätzunsicherheit',
      cells: cols.map((c) => `±${NNBSP}${c.p.uncertaintyPp}${NNBSP}%`),
    },
    {
      group: 'ERGEBNIS', label: 'Bauzeit (ab OKBP)',
      cells: cols.map((c) => `${c.p.duration.prefix}${c.p.duration.prefix ? NNBSP : ''}${c.p.duration.display}`),
    },
    {
      group: 'ERGEBNIS', label: 'Fertigstellung',
      cells: cols.map((c) => formatDate(c.p.duration.completionDate)),
    },
    {
      group: 'UMFANG', label: 'Gebäude im Angebot',
      cells: cols.map((c) => perBuilding(c.cfg, (id) => buildingLabel(id, c.cfg))),
    },
    {
      group: 'UMFANG', label: 'Untergeschoss',
      cells: cols.map((c) => perBuilding(c.cfg, (id) =>
        c.cfg.buildings[id]!.untergeschoss === 'kein_ug'
          ? `${buildingLabel(id, c.cfg)}: nicht Bestandteil`
          : `${buildingLabel(id, c.cfg)}: enthalten`)),
    },
    {
      group: 'UMFANG', label: 'BGF unterirdisch (m²)',
      cells: cols.map((c) => formatDE(
        Object.keys(c.cfg.buildings)
          .filter((id) => c.cfg.included[id] && c.cfg.buildings[id]!.untergeschoss !== 'kein_ug')
          .reduce((a, id) => a.plus(c.cfg.buildings[id]!.bgfBelowGround), new Decimal(0)),
        2)),
    },
    ...(!client ? [{
      group: 'UMFANG', label: 'KG 700',
      cells: cols.map((c) => c.cfg.kg700Mode === 'hoaiAho'
        ? 'nach HOAI und AHO als eigene Position'
        : 'im All3-Verfahren 70/22/8 verteilt'),
    }] : []),
    {
      group: 'QUALITÄT', label: 'Energiestandard',
      cells: cols.map((c) => perBuilding(c.cfg, (id) =>
        `${buildingLabel(id, c.cfg)}: ${ES_LABEL[c.cfg.buildings[id]!.energiestandard]}`)),
    },
    {
      group: 'QUALITÄT', label: 'Klassifikation nach MBO §2',
      cells: cols.map((c) => perBuilding(c.cfg, (id) =>
        c.cfg.buildings[id]!.gebaeudeklasse.confirmed
          ? `${buildingLabel(id, c.cfg)}: ✓ bestätigt`
          : `${buildingLabel(id, c.cfg)}: ▲ nicht bestätigt`)),
    },
  ]

  // «Различается» — вычисляется из ячеек, а не объявляется: строка с
  // одинаковыми значениями во всех колонках различием не является.
  const visible = rows.filter((r) => showAll || new Set(r.cells).size > 1
    || r.group === 'ERGEBNIS')
  const groups = [...new Set(visible.map((r) => r.group))]

  return (
    <div className="px-7 py-6">
      <PageHeader
        title={tx('Variantenvergleich')}
        meta={<>{cols.length}{NNBSP}{cols.length === 1 ? 'Option' : 'Optionen'}
          {!client && <> · DEMO-SC-01</>}</>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-text-secondary">
          {t(showAll ? 'comparison.allHint' : 'comparison.differencesHint')}
        </p>
        <Button onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>
          {tx(showAll ? 'nur Unterschiede' : 'alle Zeilen anzeigen')}
        </Button>
      </div>

      {cols.length === 1 && isVisibleInOutputProfile(s.mode, 'internalOnly') && (
        <div className="mt-4"><NextStep
          description={tx('Zum Vergleichen braucht es eine zweite Option. Sie entsteht auf der Opportunity-Karte — mit eigener Konfiguration, unabhängig von dieser.')}
          action={tx('Zur Opportunity-Karte')}
          onAction={() => { if (s.opportunityId) s.openOpportunity(s.opportunityId) }}
        /></div>
      )}

      {cols.length > 1 && <div className="a3-comparison-controls mt-4" aria-label={tx('Vergleich horizontal steuern')}>
        <Button onClick={() => scrollRef.current?.scrollTo({ left: 0, behavior: reducedMotion ? 'auto' : 'smooth' })}>
          {tx('Zum Zeilenanfang')}
        </Button>
        <Button onClick={() => scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: reducedMotion ? 'auto' : 'smooth' })}>
          {tx('Zum Zeilenende')}
        </Button>
      </div>}

      <div ref={scrollRef} className="a3-comparison-scroll mt-3" role="region"
           aria-label={tx('Horizontal scrollbarer Variantenvergleich')} tabIndex={0}>
        <table className="a3-cmp border-collapse">
          <caption className="sr-only">{tx('Vergleich der Opportunity Options')}</caption>
          <thead>
            <tr>
              <th>
                {showAll ? 'alle Zeilen' : 'nur Unterschiede'}
              </th>
              {cols.map((c, i) => (
                <th key={c.option.id} className={`a3-num${c.option.id === s.activeOptionId ? ' a3-target' : ''}`}>
                  {c.option.name}
                  <span className="mt-1 flex flex-wrap justify-end gap-1 text-small font-regular text-text-secondary">
                    {!client && <span>{c.option.id}</span>}
                    {i === 0 && <Badge sign="B">{tx('Vergleichsbasis')}</Badge>}
                    {c.option.id === s.activeOptionId && <Badge sign="●">{tx('in Arbeit')}</Badge>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRows key={g} group={g} span={cols.length + 1}
                         rows={visible.filter((r) => r.group === g)} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-small text-text-muted">
        {copyFor(tx('Jede Spalte wird live aus der Konfiguration ihrer Option gerechnet — es gibt keinen zweiten Zahlenbestand. Die Schätzunsicherheit gehört der Option: sie verengt sich durch Bestätigungen, nicht durch Options-Wahl (D-19).'), s.mode)}
      </p>
      <p className="mt-2 text-small text-text-muted">
        {copyFor(tx('Rollen sind unabhängige Text-Badges: Deltas rechnen zur benannten Vergleichsbasis (VARIANT-001, XSC-08).'), s.mode)}
      </p>

      {cols.length > 1 && (
        <div className="mt-5"><NextStep
          description={tx('Die aktive Option ist verglichen — weiter zur Prüfung und zum Versand des Angebots.')}
          action={tx('Angebot prüfen und exportieren')}
          onAction={() => s.setPipelineView('export')}
        /></div>
      )}
    </div>
  )
}

function GroupRows({ group, span, rows }: {
  group: string
  span: number
  rows: Array<{
    label: string
    cells: string[]
    subCells?: Array<{ text: string; save: boolean } | null>
  }>
}) {
  if (!rows.length) return null
  return (
    <>
      <tr className="a3-comparison-group">
        <th colSpan={span} scope="colgroup" className="text-small">
          {group}
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={r.label}>
          <th scope="row" className="text-text-secondary">{r.label}</th>
          {r.cells.map((c, i) => (
            <td key={i} className="a3-num">
              {c}
              {r.subCells?.[i] && (
                <span className={'a3-d' + (r.subCells[i]!.save ? ' a3-save' : '')}>
                  {r.subCells[i]!.text}
                </span>
              )}
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
