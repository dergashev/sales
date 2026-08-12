import { Decimal } from 'decimal.js'
import demo from '../fixtures/demo-0001.json'
import derived from '../fixtures/derived-prototype.json'
import { activeBuilding, useStore } from '../state/store'
import { NNBSP, formatDE } from '../engine/money'
import { Button } from '../components/primitives'
import { RadioCardGroup, SegmentedControl } from '../components/controls'
import { useTx } from '../i18n'
import { copyFor } from '../i18n/internal-refs'
import { bgfAboveGround } from '../engine/calculate'
import type { BuildingInput } from '../engine/calculate'

/**
 * Глава 1 · Gebäude & Umfang — самый верхний уровень конфигурации.
 *
 * Порядок продиктован ценой ошибки: сначала решается, КАКИЕ здания входят
 * в предложение, потом — какие они, и только потом опции внутри них.
 * Обратный порядок заставил бы настраивать сервисы у здания, которое затем
 * исключат, — и вся работа по нему пропала бы.
 *
 * Оси классификации принадлежат разным уровням (D-11 v2): форма — зданию,
 * назначение и профиль — сегменту. Единого селектора «тип здания» здесь
 * нет и быть не может; здание с двумя сегментами не имеет одного типа.
 */

const D = (s: string) => new Decimal(s)
const MARK = derived.marker
const DERIVED_LABEL = derived.provenanceLabel

type DerivedEntry = { value: string | null; basis: string }
const DERIVED = derived.buildings as Record<string, Record<string, DerivedEntry | undefined>>

const FORM_LABEL: Record<BuildingInput['gebaeudeform'], string> = {
  MFH: 'Mehrfamilienhaus', EFH_ZFH: 'Ein-/Zweifamilienhaus',
  DH_REH: 'Doppel-/Reihenhaus', BUERO: 'Bürogebäude',
}
const GK_LABEL: Record<BuildingInput['gebaeudeklasse']['value'], string> = {
  GK_1_3: `GK${NNBSP}1–3`, GK_4: `GK${NNBSP}4`, GK_5: `GK${NNBSP}5`,
}
const ES_LABEL: Record<BuildingInput['energiestandard'], string> = {
  GEG: 'GEG', EH_55: `EH${NNBSP}55`, EH_40: `EH${NNBSP}40`,
}

/** Строка метрики. Выведенное значение обязано нести пометку (D-22). */
function Row({ label, value, unit, note }: {
  label: string; value: string | null; unit?: string; note?: string
}) {
  const tx = useTx()
  return (
    <tr className="border-b border-border-subtle">
      <th scope="row" className="a3-cap py-1 pr-4 text-left">{label}</th>
      <td className="numeric py-1 text-right text-body text-text-primary">
        {value === null
          ? <span className="a3-cap">{tx('nicht erfasst')}</span>
          : <>{value}{unit ? `${NNBSP}${unit}` : ''}{note ? `${NNBSP}${MARK}` : ''}</>}
      </td>
    </tr>
  )
}

export function ChapterBuildings() {
  const s = useStore()
  const tx = useTx()
  const active = activeBuilding(s)
  const fx = demo.buildings.find((b) => b.id === active.id)!
  const d = DERIVED[active.id] ?? {}
  const includedCount = Object.values(s.included).filter(Boolean).length
  const lastOne = includedCount === 1 && s.included[active.id] === true
  const client = s.mode === 'praesentation'
  const buildingName = (id: string) => client
    ? demo.buildings.find((building) => building.id === id)?.stableName ?? tx('Gebäude')
    : id
  const activeName = buildingName(active.id)

  const bgfR = D(fx.areas.bgfAboveGround!)
  const bgfS = d.bgfSAboveGround?.value ? D(d.bgfSAboveGround.value) : new Decimal(0)
  const bgfRUnter = D(fx.areas.bgfBelowGround!)

  return (
    <div className="grid gap-5">
      {/* Охват показа — DC-46. Структура экрана от него НЕ меняется:
          меняются значения и подписи (правило 38). Он стоит первым,
          потому что отвечает на вопрос «о чём сейчас числа», который
          предшествует любому решению ниже. */}
      <section className="a3-sheet">
        <h2 className="text-heading-3 font-bold text-text-primary">
          {tx('Umfang der Anzeige')}
        </h2>
        <div className="a3-scope mt-3" role="group" aria-label={tx('Umfang')}>
          <button type="button" className="a3-total"
                  aria-pressed={s.scopeBuildingId === null}
                  onClick={() => s.setScope(null)}>
            {tx('Gesamt')} · {includedCount}{NNBSP}
            {includedCount === 1 ? tx('Gebäude') : tx('Gebäude (Plural)')}
          </button>
          {Object.values(s.buildings).filter((b) => s.included[b.id]).map((b) => (
            <button key={b.id} type="button"
                    aria-pressed={s.scopeBuildingId === b.id}
                    onClick={() => s.setScope(b.id)}>
              {buildingName(b.id)}
            </button>
          ))}
        </div>
        <p className="a3-cap mt-2">
          {s.scopeBuildingId
            ? tx('Alle Zahlen rechts gelten für dieses Gebäude. Das Angebot umfasst weiterhin alle eingeschlossenen Gebäude.')
            : tx('Alle Zahlen rechts gelten für den gesamten Komplex.')}
        </p>
      </section>

      {/* Таблица комплекса — DC-47: одна строка на здание, метрики рядом.
          Она отвечает на вопрос «где деньги», который список включённости
          не отвечал: включено/исключено видно, а сравнить нечем. */}
      {includedCount > 1 && (
        <section className="a3-sheet">
          <h2 className="text-heading-3 font-bold text-text-primary">
            {tx('Gebäude im Vergleich')}
          </h2>
          <div className="a3-tbl-scroll mt-3">
            <table className="a3-kx">
              <tbody>
                <tr>
                  <th>{tx('Gebäude')}</th>
                  <th>{tx('Form')}</th>
                  <th className="a3-num">BGF</th>
                  <th className="a3-num">{tx('Energiestandard')}</th>
                </tr>
                {Object.values(s.buildings).filter((b) => s.included[b.id]).map((b) => (
                  <tr key={b.id} className="a3-krow"
                      onClick={() => s.setScope(b.id)}>
                    <td>
                      <span className="a3-gname">
                        {buildingName(b.id)}
                        {s.scopeBuildingId === b.id && (
                          <span className="a3-dash">{tx('angezeigt')}</span>
                        )}
                      </span>
                    </td>
                    <td>{tx(FORM_LABEL[b.gebaeudeform])}</td>
                    <td className="a3-num">{formatDE(bgfAboveGround(b), 2)}{NNBSP}m²</td>
                    <td className="a3-num">{ES_LABEL[b.energiestandard]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 1 · Какие здания входят в предложение. */}
      <section className="a3-sheet">
        <h2 className="text-heading-3 font-bold text-text-primary">
          {tx('Gebäude im Angebot')} · {includedCount} von {Object.keys(s.buildings).length}
        </h2>
        {s.mode === 'intern' && (
          <p className="a3-cap a3-lede mt-2">{tx('Zuerst der Umfang, dann die Ausstattung: ein Gebäude, das später herausfällt, nimmt die ganze Arbeit an seinen Optionen mit.')}</p>
        )}
        <ul className="mt-3">
          {Object.values(s.buildings).map((b) => {
            const on = s.included[b.id] === true
            const cannotRemove = on && includedCount === 1
            return (
              <li key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-3">
                <span className="text-body text-text-primary">
                  {buildingName(b.id)} · {tx(FORM_LABEL[b.gebaeudeform])}
                  {s.buildingConfirmed[b.id] && (
                    <span className="a3-cap"> · <span aria-hidden="true">✓ </span>{tx('bestätigt')}</span>
                  )}
                </span>
                <span className="a3-row">
                  <Button
                    onClick={() => s.setActiveBuilding(b.id)}
                    variant={b.id === active.id ? 'primary' : 'secondary'}
                    aria-pressed={b.id === active.id}
                  >
                    {tx('Kennzahlen ansehen')}
                  </Button>
                  <Button
                    onClick={() => s.toggleBuildingIncluded(b.id)}
                    disabled={cannotRemove}
                    disabledReason="Das letzte Gebäude kann nicht entfernt werden — ein Angebot ohne Gebäude hat keinen Preis"
                  >
                    {tx(on ? 'Aus dem Angebot nehmen' : 'In das Angebot aufnehmen')}
                  </Button>
                </span>
              </li>
            )
          })}
        </ul>
        {lastOne && (
          <p className="a3-cap mt-2">{tx('Das letzte eingeschlossene Gebäude bleibt im Angebot: ohne Gebäude gibt es keine Berechnungsbasis und damit keinen Preis.')}</p>
        )}
      </section>

      {/* 2 · Метрики выбранного здания. */}
      <section className="a3-sheet">
        <h2 className="text-heading-3 font-bold text-text-primary">
          {tx('Kennzahlen')} · {activeName}
        </h2>
        <div className="a3-tbl-scroll mt-3">
          <table className="w-full border-collapse">
            <caption className="sr-only">
              Flächen und Einheiten des Gebäudes {activeName}
            </caption>
            <tbody>
              <Row label="BGF (R, oberirdisch)" value={formatDE(bgfR, 2)} unit="m²" />
              <Row label="BGF (S, oberirdisch)"
                   value={d.bgfSAboveGround?.value ? formatDE(bgfS, 2) : null}
                   unit="m²" note={d.bgfSAboveGround?.basis} />
              <Row label="BGF (R, unterirdisch)" value={formatDE(bgfRUnter, 2)} unit="m²" />
              <Row label="BGF (S, unterirdisch)" value={null} />
              <Row label="BGF (R+S, gesamt)"
                   value={formatDE(bgfR.plus(bgfS).plus(bgfRUnter), 2)} unit="m²"
                   note={d.bgfSAboveGround?.basis ? 'enthält die abgeleitete S-Fläche' : undefined} />
              <Row label="NRF" value={d.nrf?.value ? formatDE(D(d.nrf.value), 2) : null}
                   unit="m²" note={d.nrf?.basis} />
              <Row label="NUF nach DIN 277"
                   value={fx.areas.nufDin277 ? formatDE(D(fx.areas.nufDin277), 2) : null} unit="m²" />
              <Row label="WFL nach WoFlV"
                   value={fx.areas.wflWoFlV ? formatDE(D(fx.areas.wflWoFlV), 2) : null} unit="m²" />
              <Row label="Wohneinheiten"
                   value={fx.areas.wohneinheiten ? formatDE(D(fx.areas.wohneinheiten)) : null} />
              <Row label="Vollgeschosse"
                   value={fx.areas.vollgeschosse ? formatDE(D(fx.areas.vollgeschosse)) : null} />
            </tbody>
          </table>
        </div>
        <p className="a3-cap mt-2">
          {MARK} · {DERIVED_LABEL}
        </p>
      </section>

      {/* 3 · Оси классификации — по одной на свой уровень (D-11 v2). */}
      <section className="a3-sheet">
        <h2 className="text-heading-3 font-bold text-text-primary">
          {tx('Einstufung')} · {activeName}
        </h2>
        {s.mode === 'intern' && (
          <p className="a3-cap a3-lede mt-2">{tx('Drei getrennte Achsen statt eines Sammelbegriffs: die Gebäudeform gehört zum Gebäude, Klasse und Energiestandard werden geprüft und bestätigt. Ein Gebäude mit zwei Nutzungen hat keinen einen Typ.')}</p>
        )}

        <div className="mt-3">
          <p className="a3-cap">{tx('Gebäudeform')}</p>
          <p className="mt-1 text-body text-text-primary">
            {tx(FORM_LABEL[active.gebaeudeform])}
            <span className="a3-cap"> · {tx('aus der Dokumentation übernommen')}</span>
          </p>
        </div>

        <div className="mt-4">
          <SegmentedControl
            legend={tx('Gebäudeklasse nach MBO §2')}
            value={active.gebaeudeklasse.value}
            onChange={() => {}}
            disabled
            disabledReason={copyFor(tx('Die Klasse folgt aus Geschossanzahl und Brandschutzkonzept — sie wird bestätigt, nicht gewählt (CALC-004)'), s.mode)}
            options={(['GK_1_3', 'GK_4', 'GK_5'] as const).map((v) => ({
              value: v, label: GK_LABEL[v],
            }))}
          />
          {!active.gebaeudeklasse.confirmed && (
            <div className="mt-2">
              <Button variant="primary" onClick={() => s.confirmGebaeudeklasse()}>
                {tx('Klassifikation bestätigen')}
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4">
          <RadioCardGroup
            legend="Energieeffizienzklasse"
            value={active.energiestandard}
            onChange={(v) => s.setEnergiestandard(v)}
            onPreview={(v) =>
              s.previewOption(v ? { kind: 'energiestandard', value: v } : null)}
            options={(['GEG', 'EH_55', 'EH_40'] as const).map((v) => ({
              value: v,
              title: ES_LABEL[v],
              consequence: active.energiestandard === v
                ? 'aktuelle Auswahl'
                : consequence(s.optionDelta({ kind: 'energiestandard', value: v })),
            }))}
          />
        </div>
      </section>

      {/* 4 · Подтверждение здания — шаг вниз. */}
      <section className="a3-sheet">
        {s.buildingConfirmed[active.id] ? (
          <p className="a3-cap">
            <span aria-hidden="true">✓ </span>
            Gebäudedaten {activeName} bestätigt.
            {!s.allBuildingsConfirmed() && ' Es fehlen noch andere Gebäude im Angebot.'}
          </p>
        ) : (
          <>
            <p className="a3-cap">
              Nach der Bestätigung geht es eine Ebene tiefer: zu den Leistungen
              der KG{NNBSP}300.
            </p>
            <div className="mt-2">
              <Button variant="primary" onClick={() => s.confirmBuilding(active.id)}>
                {tx('Gebäudedaten bestätigen')}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function consequence(delta: Decimal): string {
  if (delta.isZero()) return `±${NNBSP}0${NNBSP}€`
  const sign = delta.isNegative() ? '−' : '+'
  const word = delta.isNegative() ? 'Minderpreis' : 'Mehrpreis'
  return `${sign}${formatDE(delta.abs(), 0)}${NNBSP}€${NNBSP}${word}`
}
