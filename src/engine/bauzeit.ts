import { Decimal } from 'decimal.js'

/**
 * BAUZEIT — das Terminmodell des Phasenrechners, als reine Arithmetik.
 *
 * Dieses Modul ist die vollständige Übernahme der Rechenlogik des
 * ALL3-Bauzeit-Rechners (Prototyp „Bauzeit Calculator“) in die
 * Navigationsvariante `v3`. Es ist bewusst ein EIGENES Modul und ersetzt
 * `src/state/optionSchedule.ts` NICHT: die Variante `v2` behält den
 * bestätigbaren Phasenplan unverändert, `v3` zeigt daneben das abgeleitete
 * Modell. Zwei Modelle nebeneinander sind nur deshalb zulässig, weil sie in
 * getrennten Varianten leben und nie gleichzeitig dieselbe Zahl behaupten.
 *
 * DREI GRENZEN.
 *
 * 1. **Monate sind Zahlen, Geld ist `Decimal`.** Eine Dauer ist eine
 *    Modellgröße und wird gerundet angezeigt; ein Betrag ist eine
 *    kaufmännische Größe und darf nie durch Gleitkomma laufen.
 * 2. **Der Preis je m² gehört NICHT zu diesem Modell.** Der Rechner leitet
 *    die Vertragssumme aus BGF × Preis je m² ab; dieser Prototyp kennt die
 *    Vertragssumme bereits aus der KG-Konfiguration. Eine zweite,
 *    abweichende Gesamtsumme auf demselben Bildschirm wäre ein direkter
 *    Verstoß gegen Regel 32. Deshalb nimmt `computeBauzeit` die
 *    Vertragssumme je Gebäude als EINGABE entgegen.
 * 3. **Nichts hier rundet still.** `Gn`/`wa` (halbe Monate, aufgerundete
 *    Wochen) sind Darstellungsgrößen und stehen neben dem exakten Wert.
 */

/* ───────────────────────────────  Modell  ─────────────────────────────── */

export type BauzeitBuildingType = 'single' | 'mfh' | 'campus'
export type BauzeitGk = 'gk1' | 'gk2' | 'gk3' | 'gk4' | 'gk5'

export const BAUZEIT_TYPES: readonly BauzeitBuildingType[] = ['single', 'mfh', 'campus']
export const BAUZEIT_GKS: readonly BauzeitGk[] = ['gk1', 'gk2', 'gk3', 'gk4', 'gk5']

/** Eine Planungsstufe des Projekts. Ihre Reihenfolge ist die Anzeigeordnung. */
export const BAUZEIT_PLANNING_STAGES = ['s0', 's1', 's2', 's3', 's4'] as const
export type BauzeitPlanningStageId = (typeof BAUZEIT_PLANNING_STAGES)[number]

export type BauzeitPlanningModel = {
  enabled: boolean
  /** Vertragsunterzeichnung (fest). */
  p0: number
  /** Entwurfsplanung LP4 — Basiszeit bis zur Flächenschwelle. */
  p1Base: number
  /** Gesamt-BGF, bis zu der die Basiszeit gilt. */
  p1Threshold: number
  /** Flächenschritt oberhalb der Schwelle. */
  p1Step: number
  /** Zeitverlängerung je Flächenschritt. */
  p1StepAdd: number
  /** Genehmigungsplanung (fest). */
  p2: number
  /** Ausführungsplanung LP5 (fest), beginnt zur Hälfte von p2. */
  p3: number
  /** Versatz des Fundamentstarts gegenüber dem LP5-Start. */
  p4Offset: number
  /** Zeitversatz der Baustarts je weiterem Gebäude. */
  interval: number
}

export type BauzeitPaymentModel = {
  design: number
  shell: number
  fitout: number
  acceptance: number
}

export type BauzeitModel = {
  refArea: number
  refMonths: number
  areaPerMonth: number
  minMonths: number
  typeFactors: Readonly<Record<BauzeitBuildingType, number>>
  gkFactors: Readonly<Record<BauzeitGk, number>>
  rohbauPct: number
  ausbauPct: number
  acceptanceMonths: number
  planning: BauzeitPlanningModel
  payments: BauzeitPaymentModel
}

/** Die Kalibrierung des Rechners, unverändert übernommen. */
export const BAUZEIT_MODEL_DEFAULTS: BauzeitModel = {
  refArea: 1000,
  refMonths: 5,
  areaPerMonth: 750,
  minMonths: 3,
  typeFactors: { single: 0.85, mfh: 1, campus: 1.15 },
  gkFactors: { gk1: 0.9, gk2: 0.95, gk3: 1, gk4: 1.05, gk5: 1.15 },
  rohbauPct: 0.3,
  ausbauPct: 0.7,
  acceptanceMonths: 2,
  planning: {
    enabled: true,
    p0: 1,
    p1Base: 2.5,
    p1Threshold: 2500,
    p1Step: 750,
    p1StepAdd: 0.5,
    p2: 2,
    p3: 1.5,
    p4Offset: 1,
    interval: 3,
  },
  payments: { design: 0.1, shell: 0.4, fitout: 0.4, acceptance: 0.1 },
}

export const BAUZEIT_DEFAULT_FOUNDATION_MONTHS = 1

/** Wochen je Monat und Tage je Monat — die Konstanten des Rechners. */
const WEEKS_PER_MONTH = 4.345
const DAYS_PER_MONTH = 30.4375

export type BauzeitBuildingInput = {
  id: string
  label: string
  /** Bruttogrundfläche in m². */
  bgf: number
  type: BauzeitBuildingType
  gk: BauzeitGk
  foundationMonths: number
  /** Vertragssumme dieses Gebäudes — Eingabe, siehe Grenze 2 oben. */
  contractSum: Decimal
}

/* ────────────────────────────  Datumsrechnung  ────────────────────────── */

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) throw new Error(`Datum nicht lesbar: ${iso}`)
  return { y, m, d }
}

function toISO(y: number, m: number, d: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`
}

/** Ganze Kalendermonate addieren, Tag am Monatsende gekappt. */
export function addCalendarMonths(iso: string, months: number): string {
  const { y, m, d } = parseISO(iso)
  const index = y * 12 + (m - 1) + months
  const year = Math.floor(index / 12)
  const month = (index % 12 + 12) % 12 + 1
  return toISO(year, month, Math.min(d, lastDayOfMonth(year, month)))
}

export function addCalendarDays(iso: string, days: number): string {
  const { y, m, d } = parseISO(iso)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Ein Modellmonat-Offset als Datum: ganze Monate über den Kalender, der
 * Rest über Tage à 30,4375. Genau die Umrechnung des Rechners.
 */
export function bauzeitDate(startISO: string, months: number): string {
  const whole = Math.floor(months)
  const rest = months - whole
  return addCalendarDays(
    addCalendarMonths(startISO, whole),
    Math.round(rest * DAYS_PER_MONTH),
  )
}

/** Auf halbe Monate gerundet — die Anzeigegröße des Rechners. */
export function roundHalfMonths(months: number): number {
  return Math.round(months * 2) / 2
}

/** Aufgerundete Wochen. */
export function monthsToWeeks(months: number): number {
  return Math.ceil(months * WEEKS_PER_MONTH)
}

/* ──────────────────────────  Bauzeit je Gebäude  ──────────────────────── */

export type BauzeitOnsite = {
  /** Die reine Flächenformel, vor den Faktoren. */
  base: number
  /** Nach Typ- und Klassenfaktor, vor der Mindestbauzeit. */
  typed: number
  /** Die wirksame Bauzeit vor Ort. */
  onsite: number
  minApplied: boolean
  typeFactor: number
  gkFactor: number
}

/**
 * Die Bauzeit vor Ort eines Gebäudes.
 *
 * `refMonths + (BGF − refArea) / areaPerMonth`, multipliziert mit dem
 * Typ- und dem Gebäudeklassenfaktor, nach unten begrenzt durch die
 * Mindestbauzeit. Die Begrenzung wird mitgeteilt (`minApplied`), weil eine
 * still angehobene Dauer eine Zahl wäre, die ihre eigene Formel nicht
 * erklärt.
 */
export function bauzeitOnsite(
  building: Pick<BauzeitBuildingInput, 'bgf' | 'type' | 'gk'>,
  model: BauzeitModel,
): BauzeitOnsite {
  const bgf = Math.max(0, building.bgf || 0)
  const perMonth = Math.max(1, model.areaPerMonth)
  const base = model.refMonths + (bgf - model.refArea) / perMonth
  const typeFactor = model.typeFactors[building.type] ?? 1
  const gkFactor = model.gkFactors[building.gk] ?? 1
  const typed = base * typeFactor * gkFactor
  const onsite = Math.max(typed, model.minMonths)
  return { base, typed, onsite, minApplied: typed < model.minMonths, typeFactor, gkFactor }
}

/* ────────────────────────────  Planungsphase  ─────────────────────────── */

export type BauzeitWindow = { start: number; end: number; duration: number }

export type BauzeitPlanning = {
  enabled: boolean
  stages: Readonly<Record<BauzeitPlanningStageId, BauzeitWindow>>
  totalBgf: number
  /** Ende der Planungsphase — der Baustart des ersten Gebäudes. */
  totalMonths: number
}

const EMPTY_WINDOW: BauzeitWindow = { start: 0, end: 0, duration: 0 }

export function bauzeitPlanning(
  buildings: readonly BauzeitBuildingInput[],
  planning: BauzeitPlanningModel,
): BauzeitPlanning {
  const totalBgf = buildings.reduce((sum, b) => sum + Math.max(0, b.bgf || 0), 0)
  const foundation = buildings[0]
    ? Math.max(0, buildings[0].foundationMonths)
    : BAUZEIT_DEFAULT_FOUNDATION_MONTHS

  if (!planning.enabled) {
    return {
      enabled: false,
      stages: { s0: EMPTY_WINDOW, s1: EMPTY_WINDOW, s2: EMPTY_WINDOW, s3: EMPTY_WINDOW, s4: EMPTY_WINDOW },
      totalBgf,
      totalMonths: 0,
    }
  }

  const step = Math.max(1, planning.p1Step)
  const lp4 = Math.max(0, planning.p1Base)
    + Math.max(0, (totalBgf - planning.p1Threshold) / step) * Math.max(0, planning.p1StepAdd)

  const s0End = planning.p0
  const s1End = s0End + lp4
  const s2End = s1End + planning.p2
  const s3Start = s1End + planning.p2 / 2
  const s3End = s3Start + planning.p3
  const s4Start = s3Start + planning.p4Offset
  const s4End = s4Start + foundation

  return {
    enabled: true,
    stages: {
      s0: { start: 0, end: s0End, duration: planning.p0 },
      s1: { start: s0End, end: s1End, duration: lp4 },
      s2: { start: s1End, end: s2End, duration: planning.p2 },
      s3: { start: s3Start, end: s3End, duration: planning.p3 },
      s4: { start: s4Start, end: s4End, duration: foundation },
    },
    totalBgf,
    totalMonths: Math.max(s2End, s3End, s4End),
  }
}

/* ───────────────────────────  Das ganze Projekt  ──────────────────────── */

export type BauzeitBuildingResult = {
  building: BauzeitBuildingInput
  onsite: BauzeitOnsite
  /** Modellmonate ab Projektbeginn. */
  foundationStart: number
  start: number
  rohbauEnd: number
  finish: number
  acceptanceEnd: number
  rohbauMonths: number
  ausbauMonths: number
  foundationMonths: number
  acceptanceMonths: number
  /** Die Anzeigegrößen. */
  months: number
  weeks: number
  foundationStartDate: string
  startDate: string
  rohbauEndDate: string
  endDate: string
  acceptanceEndDate: string
  contractSum: Decimal
}

export type BauzeitPaymentKind = 'design' | 'shell' | 'fitout' | 'acceptance'

export type BauzeitPayment = {
  id: string
  kind: BauzeitPaymentKind
  buildingId: string | null
  buildingLabel: string
  month: number
  date: string
  /** Anteil als Bruch, z. B. 0,1. */
  share: number
  amount: Decimal
  basis: Decimal
  basisKind: 'project' | 'building'
}

export type BauzeitResult = {
  planning: BauzeitPlanning
  buildings: readonly BauzeitBuildingResult[]
  /** Modellmonate bis zur letzten Bauabnahme. */
  projectMonths: number
  projectMonthsRounded: number
  projectWeeks: number
  /** Der Zeitraum, auf den der Gantt skaliert. Nie null. */
  span: number
  startDate: string
  projectEndDate: string
  totalContractSum: Decimal
  payments: readonly BauzeitPayment[]
  paymentsTotal: Decimal
}

/**
 * Der ganze Terminplan.
 *
 * Reihenfolge wie im Rechner: die Planung liefert den Baustart des ersten
 * Gebäudes, jedes weitere Gebäude startet um `interval` später, die
 * Fundamentarbeiten laufen unmittelbar VOR dem Baustart des jeweiligen
 * Gebäudes, und die Bauabnahme folgt dem Ausbau.
 *
 * Die Projektdauer ist `max(Bauabnahme-Ende)` — nie die Summe der
 * Gebäudedauern (Projektregel 39).
 */
export function computeBauzeit(
  buildings: readonly BauzeitBuildingInput[],
  model: BauzeitModel,
  startISO: string,
): BauzeitResult {
  const planning = bauzeitPlanning(buildings, model.planning)
  const firstStart = planning.enabled
    ? planning.totalMonths
    : (buildings[0] ? Math.max(0, buildings[0].foundationMonths) : 0)
  const acceptance = Math.max(0, model.acceptanceMonths)

  const results: BauzeitBuildingResult[] = buildings.map((building, index) => {
    const onsite = bauzeitOnsite(building, model)
    const start = firstStart + index * model.planning.interval
    const foundationMonths = Math.max(0, building.foundationMonths)
    const foundationStart = Math.max(0, start - foundationMonths)
    const rohbauEnd = start + onsite.onsite * model.rohbauPct
    const finish = start + onsite.onsite
    const acceptanceEnd = finish + acceptance
    return {
      building,
      onsite,
      foundationStart,
      start,
      rohbauEnd,
      finish,
      acceptanceEnd,
      rohbauMonths: onsite.onsite * model.rohbauPct,
      ausbauMonths: onsite.onsite * model.ausbauPct,
      foundationMonths,
      acceptanceMonths: acceptance,
      months: roundHalfMonths(onsite.onsite),
      weeks: monthsToWeeks(onsite.onsite),
      foundationStartDate: bauzeitDate(startISO, foundationStart),
      startDate: bauzeitDate(startISO, start),
      rohbauEndDate: bauzeitDate(startISO, rohbauEnd),
      endDate: bauzeitDate(startISO, finish),
      acceptanceEndDate: bauzeitDate(startISO, acceptanceEnd),
      contractSum: building.contractSum,
    }
  })

  const projectMonths = results.length
    ? Math.max(...results.map((r) => r.acceptanceEnd))
    : planning.totalMonths
  const totalContractSum = results.reduce(
    (sum, r) => sum.plus(r.contractSum), new Decimal(0),
  )
  const payments = bauzeitPayments(results, planning, model, startISO, totalContractSum)

  return {
    planning,
    buildings: results,
    projectMonths,
    projectMonthsRounded: roundHalfMonths(projectMonths),
    projectWeeks: monthsToWeeks(projectMonths),
    span: Math.max(projectMonths, 1),
    startDate: startISO,
    projectEndDate: bauzeitDate(startISO, projectMonths),
    totalContractSum,
    payments,
    paymentsTotal: payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0)),
  }
}

/**
 * Der Zahlungsplan.
 *
 * Die Anzahlung bemisst sich EINMALIG an der Gesamtvertragssumme; alle
 * übrigen Tranchen bemessen sich an der Vertragssumme ihres Gebäudes. Diese
 * Trennung ist der Grund, warum `basisKind` mitläuft: eine Tranche, deren
 * Bemessungsgrundlage nicht danebensteht, ist ein Betrag ohne Herkunft.
 */
function bauzeitPayments(
  results: readonly BauzeitBuildingResult[],
  planning: BauzeitPlanning,
  model: BauzeitModel,
  startISO: string,
  totalContractSum: Decimal,
): readonly BauzeitPayment[] {
  const shares = model.payments
  const designMonth = planning.enabled ? planning.stages.s0.end : 0
  const payments: BauzeitPayment[] = [{
    id: 'cp-design',
    kind: 'design',
    buildingId: null,
    buildingLabel: '',
    month: designMonth,
    date: bauzeitDate(startISO, designMonth),
    share: shares.design,
    amount: totalContractSum.mul(shares.design),
    basis: totalContractSum,
    basisKind: 'project',
  }]

  for (const result of results) {
    const stages: readonly { kind: BauzeitPaymentKind; month: number; share: number }[] = [
      { kind: 'shell', month: result.rohbauEnd, share: shares.shell },
      { kind: 'fitout', month: result.finish, share: shares.fitout },
      { kind: 'acceptance', month: result.acceptanceEnd, share: shares.acceptance },
    ]
    for (const stage of stages) {
      payments.push({
        id: `cp-${stage.kind}-${result.building.id}`,
        kind: stage.kind,
        buildingId: result.building.id,
        buildingLabel: result.building.label,
        month: stage.month,
        date: bauzeitDate(startISO, stage.month),
        share: stage.share,
        amount: result.contractSum.mul(stage.share),
        basis: result.contractSum,
        basisKind: 'building',
      })
    }
  }

  return payments.sort((a, b) => a.month - b.month || a.id.localeCompare(b.id))
}

/**
 * Stimmen die Anteile? Anzahlung + gebäudebezogene Anteile müssen 100 %
 * ergeben, sonst ist der Zahlungsplan nicht die Vertragssumme.
 */
export function bauzeitSharesReconcile(payments: BauzeitPaymentModel): boolean {
  const sum = payments.design + payments.shell + payments.fitout + payments.acceptance
  return Math.abs(sum - 1) < 1e-9
}

/**
 * Die Vertragssumme je Gebäude aus EINER Gesamtsumme, verteilt nach BGF.
 *
 * Der Rest der Division geht an das flächengrößte Gebäude, damit die Summe
 * der Teile exakt die Gesamtsumme ist (Regel 32). Ohne Flächen wird
 * gleichmäßig verteilt; ohne Gebäude ist die Verteilung leer.
 */
export function allocateByBgf(
  buildings: readonly { id: string; bgf: number }[],
  total: Decimal,
): Readonly<Record<string, Decimal>> {
  if (buildings.length === 0) return {}
  const totalBgf = buildings.reduce((sum, b) => sum + Math.max(0, b.bgf || 0), 0)
  const weights = buildings.map((b) => (totalBgf > 0
    ? new Decimal(Math.max(0, b.bgf || 0)).div(totalBgf)
    : new Decimal(1).div(buildings.length)))
  const shares = buildings.map((b, i) => ({
    id: b.id,
    amount: total.mul(weights[i]!).toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    bgf: Math.max(0, b.bgf || 0),
  }))
  const assigned = shares.reduce((sum, s) => sum.plus(s.amount), new Decimal(0))
  const remainder = total.minus(assigned)
  if (!remainder.isZero()) {
    const largest = shares.reduce((a, b) => (b.bgf > a.bgf ? b : a))
    largest.amount = largest.amount.plus(remainder)
  }
  return Object.fromEntries(shares.map((s) => [s.id, s.amount]))
}
