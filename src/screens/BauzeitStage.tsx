import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Decimal } from 'decimal.js'
import {
  bauzeitResultFor,
  bauzeitStartFor,
  optionScheduleStageFor,
  scheduleReadyToConfirmFor,
  useStore,
} from '../state/store'
import {
  bauzeitScopeBuildings,
} from '../state/optionBauzeit'
import {
  BAUZEIT_GKS,
  BAUZEIT_PLANNING_STAGES,
  BAUZEIT_TYPES,
  bauzeitSharesReconcile,
  roundHalfMonths,
} from '../engine/bauzeit'
import type {
  BauzeitBuildingResult,
  BauzeitBuildingType,
  BauzeitPaymentKind,
  BauzeitPlanningStageId,
} from '../engine/bauzeit'
import { NNBSP } from '../engine/money'
import { CONFIGURATOR_STEP } from '../state/chapters'
import { useT, useUiLanguage } from '../i18n'
import type { UiLanguage } from '../i18n'
import { useLocalNumber } from '../lib/localNumber'
import { Button } from '../components/primitives'
import { DateField, Switch } from '../components/controls'
import { SemanticStatus, type SemanticStatusTone } from '../design-system/SemanticStatus'
import type { ScheduleStage as ScheduleStageState } from '../state/optionSchedule'

/**
 * VR3 · Variante `v3` — die Terminstufe als BAUZEIT-RECHNER.
 *
 * Dieselbe Stufe wie in `v2`, mit demselben Kopf, derselben Sperre davor
 * und derselben Bestätigung danach — aber mit dem gerechneten Modell aus
 * `src/engine/bauzeit.ts` statt des geerbten Fixture-Phasenplans. Die
 * Termine sind hier ABGELEITET: BGF, Gebäudetyp, Gebäudeklasse und die
 * Fundamentdauer sind die Eingaben, alles Übrige ist Folge.
 *
 * ZWEI ABWEICHUNGEN VOM RECHNER, beide benannt.
 *
 * 1. **Die Vertragssumme kommt aus der Option, nicht aus einem Preis je m².**
 *    Der Rechner leitet sie aus BGF × Preis ab; hier steht die Summe der
 *    KG-Konfiguration bereits fest, und eine zweite Gesamtsumme daneben
 *    wäre ein Verstoß gegen Regel 32. Die Aufteilung auf die Gebäude erfolgt
 *    nach BGF, der Rest auf das flächengrößte Gebäude — die Summe der Teile
 *    ist exakt die Gesamtsumme.
 * 2. **Kein CSV, kein Drucken, keine Sprachumschaltung im Bildschirm.** Die
 *    Anwendung hat für alle drei bereits eigene Orte; ein zweiter wäre eine
 *    zweite Bedienung derselben Sache.
 */
/**
 * Der Zahlungsplan ist vorübergehend ausgeblendet (Owner, 16.09.2026).
 * Auf `true` setzen bringt die Tabelle unverändert zurück.
 */
const SHOW_PAYMENT_PLAN = false

export function BauzeitStage() {
  const s = useStore()
  const t = useT()
  const lang = useUiLanguage()
  const num = useLocalNumber()
  const heading = useRef<HTMLHeadingElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const model = s.bauzeitModel
  const startISO = bauzeitStartFor(s)
  const result = useMemo(() => bauzeitResultFor(s), [s])
  const scopeBuildings = bauzeitScopeBuildings(s)
  const stage = optionScheduleStageFor(s)
  const readyToConfirm = scheduleReadyToConfirmFor(s)

  const date = (iso: string) => formatDate(iso, lang)
  const money = (value: Decimal) =>
    `${num(value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString(), 0)}${NNBSP}€`
  /**
   * Eine Dauer in Monaten.
   *
   * Die Einzahl ist ein eigener Schlüssel und keine abgeschnittene Mehrzahl:
   * `1 months` ist im Englischen schlicht falsch, und im Deutschen ist die
   * Abkürzung zufällig gleich — ein Zufall, auf den sich kein Text stützen
   * darf.
   */
  const months = (value: number) => {
    const rounded = roundHalfMonths(value)
    return `${num(rounded, rounded % 1 === 0 ? 0 : 1)}${NNBSP}`
      + t(rounded === 1 ? 'bz.unit.month' : 'bz.unit.months')
  }
  const weeks = (value: number) => `${num(value, 0)}${NNBSP}${t('bz.unit.weeks')}`
  const percentOf = (share: number) => `${num(Math.round(share * 100), 0)}${NNBSP}%`

  const span = result.span
  const left = (month: number) => `${clampPercent((month / span) * 100)}%`
  const width = (duration: number) =>
    `${clampPercent((Math.max(duration, 0) / span) * 100)}%`

  /**
   * Die Monatsachse — JEDER Monat, ohne Ausnahme (Owner, 16.09.2026).
   *
   * Vorher richtete sich der Abstand nach der Projektdauer (jeder zweite,
   * jeder dritte Monat), damit die Beschriftungen einander nicht überlagern.
   * Das löste die Überlagerung, indem es die Achse ausdünnte — der Leser
   * musste die Monate dazwischen zählen. Jetzt trägt die BREITE die Last:
   * die Zahl der Marken geht als `--a3-bz-months` an das Raster, das daraus
   * seine Mindestbreite rechnet; passt sie nicht ins Panel, scrollt der
   * Gantt waagerecht, und die Namensspalte bleibt dabei stehen.
   */
  const axisMonths = useMemo(() => {
    const list: number[] = []
    for (let m = 0; m <= Math.ceil(span); m += 1) list.push(m)
    return list
  }, [span])

  const sharesOk = bauzeitSharesReconcile(model.payments)
  const nextPayment = result.payments.find((payment) => payment.date >= todayISO())
  const stageStatus = STAGE_STATUS[stage]

  const planningRows = model.planning.enabled
    ? BAUZEIT_PLANNING_STAGES.map((id) => ({ id, window: result.planning.stages[id] }))
      .filter((row) => row.window.duration > 0)
    : []

  return (
    <div className="py-6">
      <div className="a3-kgp-head">
        <div className="a3-kgp-identity">
          <h1 className="a3-kgp-title" data-page-heading tabIndex={-1} ref={heading}>
            {t('bz.heading')}
          </h1>
          <p className="a3-lede">{t('bz.lead')}</p>
        </div>
        <div className="a3-kgp-progress">
          <SemanticStatus
            tone={stageStatus.tone}
            label={t(stageStatus.labelKey)}
            reason={stageStatus.reasonKey ? t(stageStatus.reasonKey) : undefined}
          />
        </div>
      </div>

      <div className="a3-bz">
        {/* ── Die zwei Stellschrauben, VOR dem Ergebnis ────────────────── */}
        {/* Sie stehen zuoberst, weil sie die Eingabe sind und alles Weitere
            die Folge: der Projektbeginn und die Frage, ob die Planungsphase
            mitzählt, sind die einzigen zwei Eingaben auf Projektebene, und
            ein Ergebnis vor seinen Eingaben zu lesen heisst, zweimal zu
            lesen. Alles Weitere ist Kalibrierung und gehört in die
            Modelleinstellungen — eine dritte Stellschraube hier hätte
            behauptet, sie sei von gleichem Rang. */}
        <section className="a3-bz-panel a3-bz-params" aria-labelledby="bz-params-title">
          <h2 className="a3-sched-panel-title" id="bz-params-title">
            {t('bz.params.title')}
          </h2>
          <div className="a3-bz-params-row">
            <DateField
              label={t('bz.field.start')}
              name="bauzeit-start"
              value={localDate(startISO)}
              onCommit={(value) => s.setScheduleStart(value ? localIso(value) : null)}
            />
            <Switch
              label={t('bz.field.planningEnabled')}
              checked={model.planning.enabled}
              onChange={(next) => s.setBauzeitModel({ planning: { enabled: next } })}
            />
          </div>
        </section>

        {/* ── Das Ergebnis ─────────────────────────────────────────────── */}
        <section className="a3-bz-panel" aria-labelledby="bz-result-title">
          <h2 className="a3-sched-panel-title" id="bz-result-title">
            {t('bz.result.title')}
          </h2>
          <dl className="a3-bz-readouts">
            <div className="a3-bz-readout">
              <dt>{t('bz.result.duration')}</dt>
              <dd className="numeric">
                {months(result.projectMonths)}
                {` · `}
                {weeks(result.projectWeeks)}
              </dd>
              <p className="a3-sched-field-hint">
                {model.planning.enabled
                  ? t('bz.result.durationSplit', {
                    planning: months(result.planning.totalMonths),
                    construction: months(result.projectMonths - result.planning.totalMonths),
                  })
                  : t('bz.result.durationNoPlanning')}
              </p>
            </div>
            <div className="a3-bz-readout">
              <dt>{t('bz.result.completion')}</dt>
              <dd className="numeric">{date(result.projectEndDate)}</dd>
            </div>
            <div className="a3-bz-readout">
              <dt>{t('bz.result.buildings')}</dt>
              <dd className="numeric">{num(result.buildings.length, 0)}</dd>
            </div>
            <div className="a3-bz-readout">
              <dt>{t('bz.result.planningTotal')}</dt>
              <dd className="numeric">
                {model.planning.enabled ? months(result.planning.totalMonths) : t('bz.none')}
              </dd>
            </div>
            {/* KEINE VERTRAGSSUMME HIER (owner's decision, 15.09). Dieser
                Abschnitt beantwortet WANN, nicht WIE VIEL — der Betrag steht
                bereits als Hero in der Leiste und, aufgeteilt, in jeder
                Zahlungsrate darunter. Als Rechengröße bleibt er unberührt:
                die Raten werden weiterhin aus ihm nach BGF verteilt. */}
          </dl>
        </section>

        {/* ── Der Gantt ─────────────────────────────────────────────────── */}
        <section className="a3-bz-panel" aria-labelledby="bz-gantt-title">
          <h2 className="a3-sched-panel-title" id="bz-gantt-title">{t('bz.gantt.title')}</h2>
          <div className="a3-bz-gantt-scroll">
            <div
              className="a3-bz-gantt"
              style={{ '--a3-bz-months': axisMonths.length } as CSSProperties}
            >
              {planningRows.map(({ id, window }) => (
                <div className="a3-bz-grow" key={id}>
                  {/* Die Dauer steht UNTER der Phase, nicht in einer eigenen
                      Spalte: sie ist eine Eigenschaft dieser Zeile und nicht
                      eine dritte Größe neben ihr. */}
                  <span className="a3-bz-grow-head">
                    <span className="a3-bz-grow-label">{t(PLANNING_LABEL_KEY[id])}</span>
                    <span className="a3-bz-grow-duration numeric">
                      {months(window.duration)}
                    </span>
                  </span>
                  <span className="a3-sched-track">
                    <span
                      className={`a3-sched-bar a3-bz-bar-${id}`}
                      style={{ left: left(window.start), width: width(window.duration) }}
                    />
                  </span>
                </div>
              ))}

              {result.buildings.map((building) => (
                <BuildingGanttRows
                  key={building.building.id}
                  building={building}
                  left={left}
                  width={width}
                  months={months}
                  t={t}
                />
              ))}

              {/* Die Zahlungsmeilensteine als eigene Zeile: ein Marker auf
                  einem Balken würde behaupten, die Zahlung gehöre zur Dauer. */}
              <div className="a3-bz-grow" key="payments">
                <span className="a3-bz-grow-head">
                  <span className="a3-bz-grow-label">{t('bz.gantt.payments')}</span>
                  <span className="a3-bz-grow-duration numeric">
                    {t('bz.gantt.paymentsCount', { count: num(result.payments.length, 0) })}
                  </span>
                </span>
                <span className="a3-sched-track a3-bz-milestones">
                  {result.payments.map((payment) => (
                    <span
                      key={payment.id}
                      className={`a3-bz-milestone a3-bz-milestone-${payment.kind}`}
                      style={{ left: left(payment.month) }}
                      title={`${t(PAYMENT_LABEL_KEY[payment.kind])} · ${date(payment.date)}`}
                    >
                      <span className="sr-only">
                        {`${t(PAYMENT_LABEL_KEY[payment.kind])} · ${date(payment.date)} · ${money(payment.amount)}`}
                      </span>
                    </span>
                  ))}
                </span>
              </div>

              {/* Die Monatsachse ganz unten, damit sie unter allen Zeilen steht. */}
              <div className="a3-bz-grow a3-bz-axis-row">
                <span className="a3-bz-grow-head">
                  <span className="a3-bz-grow-label">{t('bz.gantt.axis')}</span>
                </span>
                <span className="a3-bz-axis">
                  {axisMonths.map((month) => (
                    <span className="a3-bz-tick" key={month} style={{ left: left(month) }}>
                      <span className="a3-bz-tick-month numeric">{`M${month}`}</span>
                      <span className="a3-bz-tick-date">
                        {formatMonth(addMonthsISO(startISO, month), lang)}
                      </span>
                    </span>
                  ))}
                </span>
              </div>
            </div>
          </div>

          {/* Die Legende: die Farbe erklärt sich, statt gedeutet zu werden.
              Jede Marke trägt ihren Namen daneben — Farbe allein sagt in
              diesem Produkt nie etwas aus (Regel 8). */}
          <ul className="a3-bz-legend">
            {GANTT_LEGEND.map((entry) => (
              <li className="a3-bz-legend-item" key={entry.className}>
                <span className={`a3-bz-swatch ${entry.className}`} aria-hidden="true" />
                {t(entry.labelKey)}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Die Gebäude ───────────────────────────────────────────────── */}
        <section className="a3-bz-panel" aria-labelledby="bz-buildings-title">
          <h2 className="a3-sched-panel-title" id="bz-buildings-title">
            {t('bz.buildings.title', { count: num(scopeBuildings.length, 0) })}
          </h2>
          {scopeBuildings.length === 0 ? (
            <p className="a3-sched-field-hint">{t('bz.buildings.empty')}</p>
          ) : (
            <div className="a3-bz-cards">
              {result.buildings.map((entry) => {
                return (
                  <article className="a3-bz-card" key={entry.building.id}>
                    <h3 className="a3-bz-card-title">{entry.building.label}</h3>

                    {/* KEINE EINGABEFELDER MEHR IN DER KARTE (owner's
                        decision, 15.09). Fläche, Typ, Klasse und
                        Fundamentdauer wurden hier ein zweites Mal gestellt —
                        Fläche und Nutzung gehören dem Gebäude der Option, und
                        eine Karte, die dieselbe Größe noch einmal abfragt,
                        macht aus einer Ableitung eine zweite Wahrheit. Die
                        Werte selbst sind unberührt: das Modell rechnet
                        weiterhin mit ihnen, und die Karte zeigt, was daraus
                        folgt. */}
                    <dl className="a3-bz-facts">
                      <div>
                        <dt>{t('bz.card.onsite')}</dt>
                        <dd className="numeric">
                          {`${months(entry.onsite.onsite)} · ${weeks(entry.weeks)}`}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('bz.card.window')}</dt>
                        <dd className="numeric">
                          {`${date(entry.startDate)} → ${date(entry.endDate)}`}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('bz.card.split')}</dt>
                        <dd className="numeric">
                          {t('bz.card.splitValue', {
                            rohbau: months(entry.rohbauMonths),
                            ausbau: months(entry.ausbauMonths),
                          })}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('bz.phase.foundation')}</dt>
                        <dd className="numeric">
                          {`${months(entry.foundationMonths)} · ${date(entry.foundationStartDate)} → ${date(entry.startDate)}`}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('bz.phase.acceptance')}</dt>
                        <dd className="numeric">
                          {`${months(entry.acceptanceMonths)} → ${date(entry.acceptanceEndDate)}`}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('bz.card.contractSum')}</dt>
                        <dd className="numeric">{money(entry.contractSum)}</dd>
                      </div>
                    </dl>

                    <details className="a3-bz-why">
                      <summary className="a3-disclosure-button hit-target">
                        {t('bz.card.why')}
                      </summary>
                      <table className="a3-sched-table">
                        <caption className="sr-only">
                          {t('bz.card.whyCaption', { building: entry.building.label })}
                        </caption>
                        <tbody>
                          <tr>
                            <th scope="row">{t('bz.why.base')}</th>
                            <td className="numeric">{months(entry.onsite.base)}</td>
                            <td>{t('bz.why.baseExplain', {
                              ref: num(model.refMonths, Number.isInteger(model.refMonths) ? 0 : 1),
                              area: num(model.refArea, 0),
                              perMonth: num(model.areaPerMonth, 0),
                            })}</td>
                          </tr>
                          <tr>
                            <th scope="row">{t('bz.why.type')}</th>
                            <td className="numeric">{`× ${num(entry.onsite.typeFactor, 2)}`}</td>
                            <td>{t(TYPE_LABEL_KEY[entry.building.type])}</td>
                          </tr>
                          <tr>
                            <th scope="row">{t('bz.why.gk')}</th>
                            <td className="numeric">{`× ${num(entry.onsite.gkFactor, 2)}`}</td>
                            <td>{entry.building.gk.toUpperCase()}</td>
                          </tr>
                          <tr>
                            <th scope="row">{t('bz.why.result')}</th>
                            <td className="numeric">{months(entry.onsite.onsite)}</td>
                            <td>
                              {entry.onsite.minApplied
                                ? t('bz.why.minApplied', { min: months(model.minMonths) })
                                : t('bz.why.resultExplain')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </details>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Der Zahlungsplan ──────────────────────────────────────────── */}
        {/* VORÜBERGEHEND AUSGEBLENDET (Entscheidung des Owners, 16.09.2026).
            Nicht entfernt: der Plan wird aus `result.payments` weiterhin
            berechnet, die Summe bleibt Teil des Modells, und die Tabelle
            kehrt zurück, sobald die Entscheidung fällt. Ein Flag statt einer
            Löschung, damit hier nichts nachgebaut werden muss — und damit
            sichtbar bleibt, dass die Zeilen existieren und nur nicht
            gezeigt werden. */}
        {SHOW_PAYMENT_PLAN && (
          <section className="a3-bz-panel" aria-labelledby="bz-payments-title">
            <h2 className="a3-sched-panel-title" id="bz-payments-title">
              {t('bz.payments.title', { count: num(result.payments.length, 0) })}
            </h2>
            {!sharesOk && (
              <div className="a3-sched-notice">
                <SemanticStatus
                  as="div"
                  tone="attention"
                  label={t('bz.payments.sharesWarning')}
                  reason={t('bz.payments.sharesReason')}
                />
              </div>
            )}
            <div className="a3-bz-table-scroll">
              <table className="a3-sched-table">
                <caption className="sr-only">{t('bz.payments.caption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('bz.payments.milestone')}</th>
                    <th scope="col">{t('bz.payments.building')}</th>
                    <th scope="col">{t('bz.payments.due')}</th>
                    <th scope="col">{t('bz.payments.share')}</th>
                    <th scope="col">{t('bz.payments.basis')}</th>
                    <th scope="col">{t('bz.payments.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.payments.map((payment) => (
                    <tr key={payment.id}>
                      <th scope="row">
                        {t(PAYMENT_LABEL_KEY[payment.kind])}
                        {nextPayment?.id === payment.id && (
                          <span className="a3-bz-next">{t('bz.payments.next')}</span>
                        )}
                      </th>
                      <td>
                        {payment.buildingId === null
                          ? t('bz.payments.basisProject')
                          : payment.buildingLabel}
                      </td>
                      <td className="numeric">{date(payment.date)}</td>
                      <td className="numeric">{percentOf(payment.share)}</td>
                      <td className="numeric">{money(payment.basis)}</td>
                      <td className="numeric">{money(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={5}>{t('bz.payments.total')}</th>
                    <td className="numeric">{money(result.paymentsTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* ── Die Kalibrierung ──────────────────────────────────────────── */}
        <section className="a3-bz-panel">
          <details
            className="a3-sched-deps-disclosure"
            open={settingsOpen}
            onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
          >
            <summary className="a3-disclosure-button hit-target">
              {t('bz.settings.title')}
            </summary>
            <div className="a3-bz-settings">
              <fieldset className="a3-bz-fieldset">
                <legend>{t('bz.settings.formula')}</legend>
                <NumberField
                  id="bz-refArea" label={t('bz.settings.refArea')} unit={t('bz.unit.area')}
                  value={model.refArea} format={num}
                  onCommit={(v) => s.setBauzeitModel({ refArea: v })}
                />
                <NumberField
                  id="bz-refMonths" label={t('bz.settings.refMonths')} unit={t('bz.unit.months')}
                  value={model.refMonths} format={num}
                  onCommit={(v) => s.setBauzeitModel({ refMonths: v })}
                />
                <NumberField
                  id="bz-areaPerMonth" label={t('bz.settings.areaPerMonth')} unit={t('bz.unit.area')}
                  value={model.areaPerMonth} format={num}
                  onCommit={(v) => s.setBauzeitModel({ areaPerMonth: v })}
                />
                <NumberField
                  id="bz-minMonths" label={t('bz.settings.minMonths')} unit={t('bz.unit.months')}
                  value={model.minMonths} format={num}
                  onCommit={(v) => s.setBauzeitModel({ minMonths: v })}
                />
              </fieldset>

              <fieldset className="a3-bz-fieldset">
                <legend>{t('bz.settings.typeFactors')}</legend>
                {BAUZEIT_TYPES.map((type) => (
                  <NumberField
                    key={type} id={`bz-type-factor-${type}`}
                    label={t(TYPE_LABEL_KEY[type])}
                    value={model.typeFactors[type]} decimals={2} format={num}
                    onCommit={(v) => s.setBauzeitModel({ typeFactors: { [type]: v } })}
                  />
                ))}
              </fieldset>

              <fieldset className="a3-bz-fieldset">
                <legend>{t('bz.settings.gkFactors')}</legend>
                {BAUZEIT_GKS.map((gk) => (
                  <NumberField
                    key={gk} id={`bz-gk-factor-${gk}`} label={gk.toUpperCase()}
                    value={model.gkFactors[gk]} decimals={2} format={num}
                    onCommit={(v) => s.setBauzeitModel({ gkFactors: { [gk]: v } })}
                  />
                ))}
              </fieldset>

              <fieldset className="a3-bz-fieldset">
                <legend>{t('bz.settings.planning')}</legend>
                <NumberField
                  id="bz-p0" label={t('bz.stage.s0')} unit={t('bz.unit.months')}
                  value={model.planning.p0} format={num}
                  onCommit={(v) => s.setBauzeitModel({ planning: { p0: v } })}
                />
                <NumberField
                  id="bz-p1Base" label={t('bz.settings.p1Base')} unit={t('bz.unit.months')}
                  value={model.planning.p1Base} decimals={1} format={num}
                  onCommit={(v) => s.setBauzeitModel({ planning: { p1Base: v } })}
                />
                <NumberField
                  id="bz-p1Threshold" label={t('bz.settings.p1Threshold')} unit={t('bz.unit.area')}
                  value={model.planning.p1Threshold} format={num}
                  onCommit={(v) => s.setBauzeitModel({ planning: { p1Threshold: v } })}
                />
                <NumberField
                  id="bz-p1Step" label={t('bz.settings.p1Step')} unit={t('bz.unit.area')}
                  value={model.planning.p1Step} format={num}
                  onCommit={(v) => s.setBauzeitModel({ planning: { p1Step: v } })}
                />
                <NumberField
                  id="bz-p1StepAdd" label={t('bz.settings.p1StepAdd')} unit={t('bz.unit.months')}
                  value={model.planning.p1StepAdd} decimals={1} format={num}
                  onCommit={(v) => s.setBauzeitModel({ planning: { p1StepAdd: v } })}
                />
                <NumberField
                  id="bz-p2" label={t('bz.stage.s2')} unit={t('bz.unit.months')}
                  value={model.planning.p2} decimals={1} format={num}
                  onCommit={(v) => s.setBauzeitModel({ planning: { p2: v } })}
                />
                <NumberField
                  id="bz-p3" label={t('bz.stage.s3')} unit={t('bz.unit.months')}
                  value={model.planning.p3} decimals={1} format={num}
                  onCommit={(v) => s.setBauzeitModel({ planning: { p3: v } })}
                />
                <NumberField
                  id="bz-p4Offset" label={t('bz.settings.p4Offset')} unit={t('bz.unit.months')}
                  value={model.planning.p4Offset} decimals={1} format={num}
                  onCommit={(v) => s.setBauzeitModel({ planning: { p4Offset: v } })}
                />
                {/* Der Zeitversatz stand früher bei den Projektparametern.
                    Er ist aber eine Annahme über Ressourcen und Baukolonnen,
                    also Kalibrierung — und hier verschwindet er nicht,
                    sondern steht bei seinesgleichen. */}
                <NumberField
                  id="bz-interval" label={t('bz.field.interval')} unit={t('bz.unit.months')}
                  value={model.planning.interval} format={num}
                  onCommit={(v) => s.setBauzeitModel({ planning: { interval: v } })}
                />
              </fieldset>

              <fieldset className="a3-bz-fieldset">
                <legend>{t('bz.settings.phases')}</legend>
                <NumberField
                  id="bz-rohbau" label={t('bz.settings.rohbauPct')} unit="%"
                  value={model.rohbauPct * 100} format={num}
                  onCommit={(v) => s.setBauzeitModel({
                    rohbauPct: v / 100, ausbauPct: 1 - v / 100,
                  })}
                />
                <NumberField
                  id="bz-ausbau" label={t('bz.settings.ausbauPct')} unit="%"
                  value={model.ausbauPct * 100} format={num}
                  onCommit={(v) => s.setBauzeitModel({
                    ausbauPct: v / 100, rohbauPct: 1 - v / 100,
                  })}
                />
                <NumberField
                  id="bz-acceptance" label={t('bz.phase.acceptance')} unit={t('bz.unit.months')}
                  value={model.acceptanceMonths} decimals={1} format={num}
                  onCommit={(v) => s.setBauzeitModel({ acceptanceMonths: v })}
                />
              </fieldset>

              <fieldset className="a3-bz-fieldset">
                <legend>{t('bz.settings.payments')}</legend>
                {(['design', 'shell', 'fitout', 'acceptance'] as const).map((kind) => (
                  <NumberField
                    key={kind} id={`bz-pay-${kind}`}
                    label={t(PAYMENT_SHARE_LABEL_KEY[kind])} unit="%"
                    value={model.payments[kind] * 100} format={num}
                    onCommit={(v) => s.setBauzeitModel({ payments: { [kind]: v / 100 } })}
                  />
                ))}
              </fieldset>

              <div className="a3-bz-fieldset">
                <Button variant="secondary" onClick={() => s.resetBauzeitModel()}>
                  {t('bz.settings.reset')}
                </Button>
              </div>
            </div>
          </details>
        </section>

        <div className="a3-sched-actions">
          <Button
            variant="primary"
            disabled={!readyToConfirm}
            disabledReason={readyToConfirm ? undefined : t('bz.confirm.blocked')}
            onClick={() => s.confirmSchedule()}
          >
            {t('bz.confirm')}
          </Button>
          {stage === 'CONFIRMED' && (
            <Button
              variant="secondary"
              onClick={() => s.openConfiguratorStepAt(CONFIGURATOR_STEP.FINAL_VALIDATION)}
            >
              {t('bz.toValidation')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────  Bausteine  ────────────────────────────── */

/**
 * Die drei Zeilen eines Gebäudes: Fundament, Bau (Rohbau + Ausbau in EINEM
 * Balken mit sichtbarer Teilung) und Bauabnahme. Der geteilte Balken ist
 * Absicht — Rohbau und Ausbau sind eine zusammenhängende Bauzeit vor Ort,
 * und zwei getrennte Balken würden eine Unterbrechung behaupten, die es
 * nicht gibt.
 */
function BuildingGanttRows({ building, left, width, months, t }: {
  building: BauzeitBuildingResult
  left: (month: number) => string
  width: (duration: number) => string
  months: (value: number) => string
  t: (key: string, values?: Record<string, string | number>) => string
}) {
  const onsite = building.onsite.onsite
  return (
    <>
      <div className="a3-bz-grow a3-bz-grow-building">
        <span className="a3-bz-grow-head">
          <span className="a3-bz-grow-label">{building.building.label}</span>
        </span>
        <span className="a3-sched-track" />
      </div>
      <div className="a3-bz-grow">
        <span className="a3-bz-grow-head a3-bz-grow-sub">
          <span className="a3-bz-grow-label">{t('bz.phase.foundation')}</span>
          <span className="a3-bz-grow-duration numeric">
            {months(building.foundationMonths)}
          </span>
        </span>
        <span className="a3-sched-track">
          <span
            className="a3-sched-bar a3-bz-bar-foundation"
            style={{ left: left(building.foundationStart), width: width(building.foundationMonths) }}
          />
        </span>
      </div>
      <div className="a3-bz-grow">
        <span className="a3-bz-grow-head a3-bz-grow-sub">
          <span className="a3-bz-grow-label">{t('bz.phase.construction')}</span>
          <span className="a3-bz-grow-duration numeric">{months(onsite)}</span>
        </span>
        {/* Rohbau und Ausbau sind ZWEI Abschnitte EINES Balkens, in den
            beiden Farben des Referenzgantts. Ein Trennstrich hätte gesagt,
            wo geteilt wird, aber nicht, was die Teile sind. */}
        <span className="a3-sched-track">
          <span
            className="a3-sched-bar a3-bz-bar-shell"
            style={{ left: left(building.start), width: width(building.rohbauMonths) }}
          />
          <span
            className="a3-sched-bar a3-bz-bar-fitout"
            style={{ left: left(building.rohbauEnd), width: width(building.ausbauMonths) }}
          />
        </span>
      </div>
      <div className="a3-bz-grow">
        <span className="a3-bz-grow-head a3-bz-grow-sub">
          <span className="a3-bz-grow-label">{t('bz.phase.acceptance')}</span>
          <span className="a3-bz-grow-duration numeric">
            {months(building.acceptanceMonths)}
          </span>
        </span>
        <span className="a3-sched-track">
          <span
            className="a3-sched-bar a3-bz-bar-acceptance"
            style={{ left: left(building.finish), width: width(building.acceptanceMonths) }}
          />
        </span>
      </div>
    </>
  )
}

/**
 * Ein Zahlenfeld des Modells.
 *
 * Es übernimmt den Wert erst beim Verlassen und verwirft alles, was keine
 * Zahl ist — der Terminplan darf sich nicht bewegen, weil jemand einen
 * Buchstaben getippt hat. Deutsches und englisches Dezimalzeichen gelten
 * beide.
 */
function NumberField({ id, label, hint, unit, value, decimals = 0, format, onCommit }: {
  id: string
  label: string
  hint?: string
  unit?: string
  value: number
  decimals?: number
  format: (value: string | number, decimals?: number) => string
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? format(value, decimals || (Number.isInteger(value) ? 0 : 1))
  const commit = () => {
    if (draft === null) return
    const parsed = parseNumber(draft)
    setDraft(null)
    if (parsed !== null && parsed !== value) onCommit(parsed)
  }
  return (
    <div className="a3-sched-field">
      <label className="a3-sched-field-label" htmlFor={id}>{label}</label>
      <span className="a3-sched-field-control">
        <input
          id={id}
          className="a3-sched-field-input numeric hit-target"
          type="text"
          inputMode="decimal"
          value={shown}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') setDraft(null)
          }}
        />
        {unit && <span className="a3-sched-field-unit">{unit}</span>}
      </span>
      {hint && <p className="a3-sched-field-hint">{hint}</p>}
    </div>
  )
}

/* ───────────────────────────────  Tabellen  ───────────────────────────── */

/**
 * Die Legende des Gantts — die Phasen in der Reihenfolge, in der sie im
 * Plan vorkommen, mit derselben Farbe wie die Balken.
 */
const GANTT_LEGEND: readonly { className: string; labelKey: string }[] = [
  { className: 'a3-bz-bar-s0', labelKey: 'bz.stage.s0' },
  { className: 'a3-bz-bar-s1', labelKey: 'bz.stage.s1' },
  { className: 'a3-bz-bar-s2', labelKey: 'bz.stage.s2' },
  { className: 'a3-bz-bar-s3', labelKey: 'bz.stage.s3' },
  { className: 'a3-bz-bar-foundation', labelKey: 'bz.phase.foundation' },
  { className: 'a3-bz-bar-shell', labelKey: 'bz.legend.shell' },
  { className: 'a3-bz-bar-fitout', labelKey: 'bz.legend.fitout' },
  { className: 'a3-bz-bar-acceptance', labelKey: 'bz.phase.acceptance' },
  { className: 'a3-bz-milestone-legend', labelKey: 'bz.gantt.payments' },
]

const PLANNING_LABEL_KEY: Readonly<Record<BauzeitPlanningStageId, string>> = {
  s0: 'bz.stage.s0',
  s1: 'bz.stage.s1',
  s2: 'bz.stage.s2',
  s3: 'bz.stage.s3',
  s4: 'bz.stage.s4',
}

const TYPE_LABEL_KEY: Readonly<Record<BauzeitBuildingType, string>> = {
  single: 'bz.type.single',
  mfh: 'bz.type.mfh',
  campus: 'bz.type.campus',
}

const PAYMENT_LABEL_KEY: Readonly<Record<BauzeitPaymentKind, string>> = {
  design: 'bz.payment.design',
  shell: 'bz.payment.shell',
  fitout: 'bz.payment.fitout',
  acceptance: 'bz.payment.acceptance',
}

const PAYMENT_SHARE_LABEL_KEY: Readonly<Record<BauzeitPaymentKind, string>> = {
  design: 'bz.settings.pctDesign',
  shell: 'bz.settings.pctShell',
  fitout: 'bz.settings.pctFitout',
  acceptance: 'bz.settings.pctAcceptance',
}

const STAGE_STATUS: Readonly<Record<ScheduleStageState, {
  tone: SemanticStatusTone; labelKey: string; reasonKey?: string
}>> = {
  NO_SCHEDULE: { tone: 'unknown', labelKey: 'vr3.schedule.state.none' },
  INCOMPLETE: { tone: 'neutral', labelKey: 'vr3.schedule.state.incomplete' },
  INVALID: { tone: 'error', labelKey: 'vr3.schedule.state.invalid' },
  WARNING: { tone: 'attention', labelKey: 'vr3.schedule.state.warning' },
  READY_TO_CONFIRM: {
    tone: 'attention', labelKey: 'vr3.schedule.state.confirmationRequired',
  },
  CONFIRMED: {
    tone: 'ok',
    labelKey: 'vr3.schedule.state.confirmed',
    reasonKey: 'vr3.schedule.state.confirmedReason',
  },
  STALE: {
    tone: 'stale',
    labelKey: 'vr3.schedule.state.stale',
    reasonKey: 'vr3.schedule.state.staleReason',
  },
}

/* ───────────────────────────────  Helfer  ─────────────────────────────── */

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function parseNumber(raw: string): number | null {
  const normalised = raw.trim().replace(/[\s  .]/g, '').replace(',', '.')
  if (normalised === '' || !/^-?\d+(\.\d+)?$/.test(normalised)) return null
  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

function formatDate(iso: string, lang: UiLanguage): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(y!, m! - 1, d!))
}

function formatMonth(iso: string, lang: UiLanguage): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    month: 'short', year: '2-digit',
  }).format(new Date(y!, m! - 1, d!))
}

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const index = y! * 12 + (m! - 1) + months
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(Math.min(d!, last))}`
}

function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function localIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function todayISO(): string {
  return localIso(new Date())
}
