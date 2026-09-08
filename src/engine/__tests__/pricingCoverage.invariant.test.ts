import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import catalogFixture from '../../fixtures/catalog.json'
import {
  costAuthorityOf,
  initialDecisions,
  kgCatalogues,
  quantityProblem,
  rendersAmount,
  serviceContribution,
  type KgCostAuthority,
  type KgDecisions,
  type KgScopeGroup,
  type KgService,
  type KgServiceVariant,
} from '../kgConfiguration'
import {
  ALL_OPTION_GROUPS,
  KG300_GROUPS,
  KG400_GROUPS,
  ZERT_GROUPS,
  type OptionGroup,
} from '../options'
import {
  RISK_ITEMS,
  resolveRiskBasis,
  riskOutcome,
  type Kg200Basis,
  type RiskBases,
  type RiskItem,
} from '../risk'
import {
  ALL_SCOPE_CATALOG_OPTIONS,
  KG200_CATALOG_OPTIONS,
  KG500_CATALOG_OPTIONS,
  KG600_CATALOG_OPTIONS,
  KG800_CATALOG_OPTIONS,
  SCOPE_QUANTITY_UNIT,
  defaultScopeCatalogSelections,
  scopeCatalogDriver,
  scopeCatalogOutcome,
  unpricedScopeCatalogPositions,
  type ScopeCatalogOutcome,
  type ScopeOption,
  type ScopeQuantityKey,
  type ScopeVariant,
} from '../scopeCatalog'

/**
 * KEINE STILLE NULL — jede angebotene Auswahl erklärt ihre Preiswirkung.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DER SATZ, DEN DIESE DATEI MASCHINELL DURCHSETZT
 *
 *   Jede *angebotene* Auswahl hat einen EXPLIZITEN, nachvollziehbaren
 *   Preiswirkungs-Zustand. Keine angebotene Auswahl darf einen stillen,
 *   impliziten oder undefinierten Zustand „keine Wirkung“ erreichen; ein
 *   UNBEKANNTER Preis wird niemals als Null dargestellt (Projektregel 16);
 *   und ein echter Kostentreiber rendert niemals ein blankes
 *   „keine Preiswirkung“.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * WARUM DIESER INVARIANT EXISTIERT — der Defektklasse, nicht dem Symptom
 * nach benannt.
 *
 * Die drei Zustände „kostet nichts“, „kostet woanders“ und „wir wissen es
 * noch nicht“ sind DREI verschiedene kaufmännische Aussagen, und genau
 * eine von ihnen darf als Zahl erscheinen. Das Produkt hat sie über Jahre
 * hinweg an mehreren Stellen auf denselben Ausdruck abgebildet:
 *
 *  · `engine/risk.ts` gab `Decimal | undefined` zurück, und die aufrufende
 *    Stelle schrieb `if (d) push(d)`. Der von `calculation-spec` §1.4
 *    erklärte Treiber `Bestandsgebäude / Abbruchumfang unklar` hat die Basis
 *    `KG_200` — die weder `kg300Exact` noch eine Untergruppe von
 *    `splitKg300` ist. Er konnte den Preis in KEINEM Produktzustand
 *    verändern, und nichts sagte das. Vier der sechs Treiber der
 *    Spezifikation existierten im Datensatz überhaupt nicht: der
 *    Einstellungsbildschirm nannte sechs, der Motor kannte zwei.
 *  · `engine/scopeCatalog.ts` gab `Driver | null` zurück und benutzte
 *    dasselbe `null` für den bewussten Null-Tarif („Baufreies Grundstück“ —
 *    ein echter, GERECHNETER 0 €) und für die fehlende Menge (Preis
 *    UNBEKANNT). Eine eingeschlossene Position mit 12 €/t Bodenabfuhr fiel
 *    still aus der Summe, und die Zusammenfassung nannte das Ergebnis
 *    vollständig, weil eine Nachbarposition derselben Gruppe eine
 *    abgeleitete Menge hatte und die Gruppensumme daher nicht Null war.
 *  · Die Oberfläche druckte `keine Preiswirkung` für eine Alternative, die
 *    lediglich KEINE eigene Preisgrundlage hat. Das ist eine positive
 *    Behauptung („beide Lösungen kosten gleich viel“) über eine Tatsache,
 *    die niemand gemessen hat. Die kanonische Formulierung aus
 *    Projektregel 16 ist `Preis nicht ermittelt`.
 *
 * Der gemeinsame Nenner: **ein Zustand ohne eigenen Namen ist ein Zustand,
 * den niemand prüfen kann.** Diese Datei gibt jedem Zustand einen Namen,
 * ordnet jede Auswahlfläche des Produkts in genau EINEN Topf und läuft
 * dabei über die ECHTEN Fixtures — nie über eine abgeschriebene Id-Liste,
 * die ein neuer Eintrag umgehen könnte.
 *
 * WIE DIESE SUITE SCHEITERT. Wird morgen eine Auswahl eingeführt, deren
 * Preiswirkung nicht erklärt ist, dann fällt sie hier durch und die
 * Fehlermeldung nennt Projekt, Kapitel, System, Entscheidung und Variante.
 * Das ist der ganze Zweck: der Defekt war nie schwer zu beheben, er war
 * unsichtbar. Damit auch niemand glauben muss, dass die Prüfung überhaupt
 * scheitern KANN, testet jeder Abschnitt sein eigenes Prädikat
 * zusätzlich negativ, gegen ein synthetisch verletzendes Objekt.
 */

/* ═════════════════════════════════════════════════════════════════════════
 * DAS KLASSIFIKATIONSMODELL
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Genau vier Töpfe, und jede Auswahlfläche liegt in genau einem.
 *
 * Der fünfte Wert ist kein Topf, sondern die VERLETZUNG: `IMPLICIT_NO_EFFECT`
 * ist der Zustand, den es nach diesem Invariant nicht geben darf. Er wird
 * hier benannt, damit die Klassifikationsfunktionen ihn ZURÜCKGEBEN können
 * statt zu werfen — eine Liste von Verletzungen ist eine brauchbare
 * Fehlermeldung, eine Ausnahme beim ersten Treffer ist es nicht.
 */
type PriceEffectBucket =
  /** Sales-wählbarer Kontrollpunkt, dessen Auswahl den Angebotsbetrag bewegen kann. */
  | 'PRICED_SELECTABLE'
  /**
   * Berechtigt ohne Euro — aber der Zustand ist ERKLÄRT und belegt:
   * `bundle`, `bauherr`, `indirect`, `noBasis` (Preisbildung blockiert), ein
   * bewusster Null-Tarif des Katalogs, oder eine Baseline-Variante, deren
   * Standard bereits im Ansatz steckt.
   */
  | 'EXPLICIT_NON_PRICED'
  /** Kein aktueller Sales-wählbarer, bepreister Kontrollpunkt. */
  | 'READ_ONLY_CONTEXT'
  /** Nicht anwendbar — mit Ursache, nie als Option `Keine …` angeboten. */
  | 'NON_APPLICABLE'

/** Nicht klassifizierbar = der verbotene Zustand. Siehe `PriceEffectBucket`. */
type BucketOrViolation = PriceEffectBucket | 'IMPLICIT_NO_EFFECT'

/**
 * Die geschlossene Menge der Kostenautoritäten (`calculate.ts`
 * `CostAuthority`), hier als LAUFZEITWERTE.
 *
 * Der Typ allein prüft nichts an einer Fixture: `kg-configuration.json`
 * wird per `as unknown as` in die Typen gegossen, ein Tippfehler
 * (`"bundled"` statt `"bundle"`) ist damit typisiert und trotzdem falsch.
 * `costAuthorityOf` gibt ihn unverändert weiter, und die Oberfläche fällt
 * in ihren `default`-Zweig — also genau in einen impliziten Zustand ohne
 * Namen. Diese Liste ist die einzige Stelle, an der das auffällt.
 */
const DECLARED_COST_AUTHORITIES: readonly KgCostAuthority[] = [
  'direct', 'bundle', 'indirect', 'noBasis', 'bauherr', 'none',
]

/** Die Auswahlarten, die Sales tatsächlich als Kontrollpunkt bedient. */
const SELECTABLE_KG_KINDS: readonly KgService['kind']['kind'][] = [
  'singleChoice', 'includeExclude', 'quantity',
]

/* ═════════════════════════════════════════════════════════════════════════
 * PRÄDIKATE — je Fläche eines, jedes einzeln negativ getestet
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Trägt diese Variante eine Aussage über Geld?
 *
 * Sechs Wege, und alle sechs sind eine EXPLIZITE Erklärung:
 *  1. `delta !== '0.00'` — sie bewegt den Betrag, sie ist bepreist;
 *  2. `noPriceBasis` — es gibt keine eigene Preisgrundlage (nicht Null!);
 *  3. `bundled` — bepreist, aber innerhalb einer anderen Position;
 *  4. `excludesPosition` — die Position verlässt das All3-Angebot;
 *  5. `costAuthority` — die Variante nennt ihre Autorität selbst;
 *  6. sie IST die Baseline — der Standard steckt bereits im Ansatz, und
 *     `± 0 €` bedeutet hier tatsächlich „messbar gleich wie der Ansatz“.
 *
 * Keiner der sechs ⇒ `delta` ist `0.00`, weil niemand etwas eingetragen
 * hat. Das ist die stille Null, die dieser Invariant verbietet.
 */
function kgVariantDeclaresItsMoney(
  variant: KgServiceVariant, baselineVariant: string,
): boolean {
  return variant.delta !== '0.00'
    || variant.noPriceBasis === true
    || variant.bundled === true
    || variant.excludesPosition === true
    || variant.costAuthority !== undefined
    || variant.value === baselineVariant
}

/**
 * Der Topf einer KG-Entscheidung.
 *
 * `'none'` ist der einzige heikle Fall: die Autorität bedeutet „diese Zeile
 * hat überhaupt keine kaufmännische Dimension“. Für eine `readOnlyRequired`-
 * Zeile ist das per Definition wahr. Für einen SALES-WÄHLBAREN Kontrollpunkt
 * wäre es dagegen genau der verbotene Zustand — es sei denn, die
 * Entscheidung erklärt, dass sie hier nicht anwendbar ist
 * (`applicability` als Katalogaussage oder `appliesWhen` als aus dem
 * Gebäude abgeleitete Aussage). Dann ist `'none'` die Ursache-behaftete
 * Nichtanwendbarkeit und kein Loch.
 *
 * Bewusst STRUKTURELL formuliert und nicht als Id-Ausnahmeliste: eine neue
 * Entscheidung, die ohne Anwendbarkeitsaussage auf `'none'` fällt, wird
 * gemeldet — auch wenn sie noch niemand kennt.
 */
function kgServiceBucket(service: KgService): BucketOrViolation {
  const authority = costAuthorityOf(service)
  if (!DECLARED_COST_AUTHORITIES.includes(authority)) return 'IMPLICIT_NO_EFFECT'
  if (!SELECTABLE_KG_KINDS.includes(service.kind.kind)) return 'READ_ONLY_CONTEXT'
  if (authority === 'none') {
    const declaresNonApplicability =
      service.applicability !== undefined || service.appliesWhen !== undefined
    return declaresNonApplicability ? 'NON_APPLICABLE' : 'IMPLICIT_NO_EFFECT'
  }
  return authority === 'direct' ? 'PRICED_SELECTABLE' : 'EXPLICIT_NON_PRICED'
}

/** Die Zustände, die `resolveRiskBasis` überhaupt zurückgeben darf. */
const DECLARED_RISK_BASIS_KINDS: readonly string[] = [
  'resolved', 'noCost', 'outOfScope', 'notDetermined', 'unknownBase',
]

/**
 * Ist die Basis dieses Treibers vom Motor auflösbar?
 *
 * `unknownBase` heißt: die Fixture erklärt eine Basis, die der Motor nicht
 * kennt. Vor der Typisierung war dieser Zustand nicht ausdrückbar — der
 * Treiber verschwand einfach. Genau so ist der `KG_200`-Treiber der
 * Spezifikation über sechs Releases hinweg wirkungslos geblieben.
 */
function riskBasisIsResolvable(risk: RiskItem, bases: RiskBases): boolean {
  return resolveRiskBasis(risk, bases).kind !== 'unknownBase'
}

/** Die Ergebnisarten, die `scopeCatalogOutcome` überhaupt liefern darf. */
const DECLARED_SCOPE_OUTCOME_KINDS: readonly string[] = [
  'priced', 'noCost', 'notDetermined',
]
const DECLARED_SCOPE_NO_COST_REASONS: readonly string[] = ['zeroRate', 'zeroQuantity']

/**
 * Ist dieses Katalogergebnis ein ERKLÄRTER Zustand?
 *
 * Drei Bedingungen, und die dritte ist die eigentliche Regel 16:
 *  · die Art gehört zur deklarierten Union — kein `default`-Zweig irgendwo;
 *  · `noCost` nennt seinen Grund aus der geschlossenen Menge;
 *  · `priced` trägt einen Betrag ungleich Null. Ein bepreistes Ergebnis mit
 *    `exact === 0` wäre die stille Null in ihrer reinsten Form: sie sieht
 *    wie ein gerechneter Wert aus und ist keiner.
 */
function scopeOutcomeIsDeclared(outcome: ScopeCatalogOutcome): boolean {
  if (!DECLARED_SCOPE_OUTCOME_KINDS.includes(outcome.kind)) return false
  if (outcome.kind === 'noCost') {
    return DECLARED_SCOPE_NO_COST_REASONS.includes(outcome.reason)
  }
  if (outcome.kind === 'notDetermined') {
    return outcome.quantityKey === null
      || Object.prototype.hasOwnProperty.call(SCOPE_QUANTITY_UNIT, outcome.quantityKey)
  }
  return !outcome.driver.exact.isZero()
}

/**
 * Bewegt jede NICHT-Standard-Auswahl dieser Gruppe den Preis?
 *
 * Die Modellaussage von `engine/options.ts`: der Basistarif beschreibt den
 * STANDARDUMFANG, deshalb hat die Standardauswahl den Tarif `0` und erzeugt
 * gar keinen Beitrag. Diese Null ist die erklärte Baseline. Jede ANDERE
 * Auswahl ist definitionsgemäß eine Abweichung vom Standard — und eine
 * Abweichung mit Tarif `0` behauptete, die Abweichung sei kostenneutral,
 * ohne dass irgendwo eine Messung dazu existiert.
 */
function optionGroupDeclaresItsMoney(group: OptionGroup): boolean {
  const fallback = group.choices.find((choice) => choice.value === group.default)
  if (!fallback) return false
  if (!new Decimal(fallback.rate).isZero()) return false
  return group.choices.every((choice) => choice.value === group.default
    || !new Decimal(choice.rate).isZero())
}

/* ═════════════════════════════════════════════════════════════════════════
 * FLÄCHE 1 · KG-Katalog-Entscheidungen (`src/fixtures/kg-configuration.json`)
 * ═══════════════════════════════════════════════════════════════════════ */

type KgWalkRow = {
  where: string
  service: KgService
}

/**
 * Jede Entscheidung beider Demonstrationsprojekte, mit ihrem Weg.
 *
 * Der Weg wird mitgeführt, damit eine Verletzung als
 * `DEMO-COMPLEX-01 · KG_400 · Wärme · b-400-01` gemeldet wird und nicht als
 * nackte Id, die man erst suchen muss. Der Durchlauf ist ein eigener, weil
 * `allServices()` den Kontext abflacht — der folgende Test beweist, dass er
 * dieselbe Menge trifft.
 */
function walkKgServices(): KgWalkRow[] {
  const rows: KgWalkRow[] = []
  for (const catalogue of kgCatalogues()) {
    for (const chapter of catalogue.chapters) {
      for (const group of chapter.groups) {
        for (const service of group.services) {
          rows.push({
            where: `${catalogue.projectId} · ${chapter.group} · ${group.id} · ${service.id}`,
            service,
          })
        }
      }
    }
  }
  return rows
}

const KG_SERVICES = walkKgServices()

describe('Fläche 1 · KG-Entscheidungen erklären jede Preiswirkung', () => {
  it('der Durchlauf erfasst wirklich JEDE Entscheidung beider Kataloge — sechs Kapitel, beide Projekte', () => {
    // Ohne diesen Test wäre alles Folgende so vollständig wie mein
    // Schleifenkopf, und ein Kapitel, das nicht besucht wird, ist von jedem
    // Invariant befreit. Deshalb wird die Menge gegen den kanonischen
    // Akzessor des Motors gehalten, nicht gegen eine erwartete Zahl.
    const canonical = kgCatalogues()
      .flatMap((c) => c.chapters.flatMap((ch) => ch.groups.flatMap((g) => g.services)))
    expect(KG_SERVICES).toHaveLength(canonical.length)
    expect(KG_SERVICES.length).toBeGreaterThan(100)
    expect(kgCatalogues().map((c) => c.projectId))
      .toEqual(['DEMO-HAPPY-01', 'DEMO-COMPLEX-01'])
    for (const catalogue of kgCatalogues()) {
      expect(catalogue.chapters.map((chapter) => chapter.group)).toEqual([
        'KG_200', 'KG_300', 'KG_400', 'KG_500', 'KG_600', 'KG_700',
      ])
    }
  })

  it('jede Entscheidung löst zu einer DEKLARIERTEN Kostenautorität auf — kein siebter Zustand', () => {
    const undeclared = KG_SERVICES
      .filter(({ service }) => !DECLARED_COST_AUTHORITIES.includes(costAuthorityOf(service)))
      .map(({ where, service }) => `${where} → ${costAuthorityOf(service)}`)
    expect(undeclared).toEqual([])
  })

  it('jede in der Fixture GESCHRIEBENE Kostenautorität gehört der geschlossenen Union — auf jeder der drei Ebenen', () => {
    // `as unknown as` beim Fixture-Import macht jeden Tippfehler typisiert.
    // Geprüft werden alle drei Ebenen, die eine Autorität erklären dürfen:
    // System (Gruppe), Entscheidung (Service) und Variante.
    const strays: string[] = []
    const check = (value: string | undefined, where: string) => {
      if (value === undefined) return
      if (!DECLARED_COST_AUTHORITIES.includes(value as KgCostAuthority)) {
        strays.push(`${where} → "${value}"`)
      }
    }
    for (const catalogue of kgCatalogues()) {
      for (const chapter of catalogue.chapters) {
        for (const group of chapter.groups) {
          check(group.costAuthority, `${catalogue.projectId} · ${group.id} (System)`)
          for (const service of group.services) {
            check(service.costAuthority, `${catalogue.projectId} · ${service.id}`)
            if (service.kind.kind !== 'singleChoice') continue
            for (const variant of service.kind.variants) {
              check(variant.costAuthority, `${catalogue.projectId} · ${service.id} · ${variant.value}`)
            }
          }
        }
      }
    }
    expect(strays).toEqual([])
  })

  it('keine Entscheidung landet im verbotenen Topf IMPLICIT_NO_EFFECT', () => {
    const violations = KG_SERVICES
      .map(({ where, service }) => ({ where, bucket: kgServiceBucket(service) }))
      .filter((row) => row.bucket === 'IMPLICIT_NO_EFFECT')
      .map((row) => row.where)
    expect(violations).toEqual([])
  })

  it('die Klassifikation ist nicht leerlaufend — alle vier Töpfe sind auf echten Daten belegt', () => {
    // Ein Invariant, der alles durchlässt, weil jede Zeile in einen
    // Sammeltopf fällt, ist kein Invariant. Deshalb wird hier bewiesen,
    // dass die Töpfe unterscheiden: sowohl bepreiste als auch erklärt
    // unbepreiste als auch reine Kontextzeilen als auch nicht anwendbare
    // Zeilen existieren in den Fixtures.
    const tally = new Map<BucketOrViolation, number>()
    for (const { service } of KG_SERVICES) {
      const bucket = kgServiceBucket(service)
      tally.set(bucket, (tally.get(bucket) ?? 0) + 1)
    }
    expect(tally.get('PRICED_SELECTABLE') ?? 0).toBeGreaterThan(0)
    expect(tally.get('EXPLICIT_NON_PRICED') ?? 0).toBeGreaterThan(0)
    expect(tally.get('READ_ONLY_CONTEXT') ?? 0).toBeGreaterThan(0)
    expect(tally.get('NON_APPLICABLE') ?? 0).toBeGreaterThan(0)
    expect(tally.get('IMPLICIT_NO_EFFECT') ?? 0).toBe(0)
  })

  it('jede Variante einer singleChoice-Entscheidung trägt eine Aussage über Geld', () => {
    const silent: string[] = []
    let variantCount = 0
    for (const { where, service } of KG_SERVICES) {
      if (service.kind.kind !== 'singleChoice') continue
      const { baselineVariant, variants } = service.kind
      // Die Baseline muss überhaupt existieren, sonst ist der sechste Weg
      // („sie IST die Baseline“) eine Erklärung, die auf nichts zeigt, und
      // jede `± 0 €`-Variante wäre über einen kaputten Verweis entschuldigt.
      expect(variants.map((variant) => variant.value), `${where}: baselineVariant`)
        .toContain(baselineVariant)
      for (const variant of variants) {
        variantCount += 1
        if (!kgVariantDeclaresItsMoney(variant, baselineVariant)) {
          silent.push(`${where} · ${variant.value} (delta=${variant.delta})`)
        }
      }
    }
    expect(variantCount).toBeGreaterThan(200)
    expect(silent).toEqual([])
  })

  it('eine PFLICHT-Entscheidung ohne Preisgrundlage nennt die BEDINGUNG, die den Preis blockiert', () => {
    // `costAuthority: 'noBasis'` sagt nur, dass kein Euro behauptet werden
    // darf. Für eine Entscheidung, die der Katalog selbst einen wesentlichen
    // Kostentreiber nennt, ist das zu wenig: das Fehlen einer Zahl liest
    // sich als „diese Wahl ist kostenlos“, solange die Bedingung nicht
    // genannt wird. `Tragsystem Balkone` ist der Fall, der dieses Feld
    // erzwungen hat — drei Alternativen, alle `noPriceBasis`, ein `whyDe`,
    // das mit „Ein wesentlicher Kostentreiber“ beginnt, und eine
    // Optionskarte, die `keine Preiswirkung` sagte.
    //
    // `tools/build_kg_fixture.py` (`prove_choice_integrity`) weigert sich,
    // eine solche Zeile zu BAUEN. Diese Prüfung ist der Zwilling zur
    // Lesezeit: sie gilt auch für eine Fixture, die nicht neu gebaut wurde.
    const speechless: string[] = []
    let required = 0
    for (const { where, service } of KG_SERVICES) {
      if (!service.requiresDecision) continue
      if (costAuthorityOf(service) !== 'noBasis') continue
      required += 1
      if (!service.pricingConditionDe || !service.pricingConditionEn) {
        speechless.push(where)
      }
    }
    // Nicht leerlaufend: es gibt solche Entscheidungen überhaupt.
    expect(required).toBeGreaterThan(0)
    expect(speechless).toEqual([])
  })

  it('eine ausgeschlossene Position trägt niemals eine Delta — ausgeschlossen UND bepreist ist ein Widerspruch', () => {
    // `excludesPosition` entfernt die Position aus dem All3-Angebot. Eine
    // Delta daneben behauptete gleichzeitig, die Position sei nicht im
    // Angebot und verändere den Angebotsbetrag. Genau diese Prüfung ist im
    // Fixture-Generator unerreichbar geworden (sie steht hinter einem
    // `raise SystemExit`, `tools/build_kg_fixture.py` ≈ Z. 2814) — hier
    // wird sie unabhängig davon gehalten.
    const contradictions: string[] = []
    let excluded = 0
    for (const { where, service } of KG_SERVICES) {
      if (service.kind.kind !== 'singleChoice') continue
      for (const variant of service.kind.variants) {
        if (!variant.excludesPosition) continue
        excluded += 1
        if (variant.delta !== '0.00') {
          contradictions.push(`${where} · ${variant.value} (delta=${variant.delta})`)
        }
      }
    }
    expect(excluded).toBeGreaterThan(0)
    expect(contradictions).toEqual([])
  })

  it('ein Euro wird genau dann gerendert, wenn die Autorität `direct` ist — für jede echte Entscheidung', () => {
    // `rendersAmount` ist die verbindliche Regel des Audits als Prädikat:
    // kein `+ €` ohne echte Kostenautorität für genau diese Beziehung.
    // Geprüft wird sie hier gegen die 196 echten Entscheidungen, damit die
    // Paarung nicht nur im Quelltext, sondern auf den Daten gilt.
    const mismatched = KG_SERVICES
      .filter(({ service }) => rendersAmount(service) !== (costAuthorityOf(service) === 'direct'))
      .map(({ where }) => where)
    expect(mismatched).toEqual([])
    // Und beide Antworten kommen wirklich vor — sonst prüfte die Zeile oben
    // eine Tautologie auf einer einfarbigen Menge.
    expect(KG_SERVICES.some(({ service }) => rendersAmount(service))).toBe(true)
    expect(KG_SERVICES.some(({ service }) => !rendersAmount(service))).toBe(true)
  })

  it('SELBSTTEST · das Prädikat lehnt eine synthetisch stille Variante ab und akzeptiert jede der sechs Erklärungen', () => {
    const baseVariant = {
      value: 'ALT', labelDe: 'Alternative', labelEn: 'Alternative', delta: '0.00',
    } as const

    // Die Verletzung: eine Nicht-Baseline-Alternative mit `± 0 €` und ohne
    // ein einziges erklärendes Feld. Genau diese Zeile hätte im Prototyp
    // `keine Preiswirkung` gedruckt.
    expect(kgVariantDeclaresItsMoney(baseVariant, 'STD')).toBe(false)

    // Und alle sechs legitimen Wege werden erkannt — sonst wäre das
    // Prädikat streng, aber falsch, und der Invariant würde echte Daten
    // ablehnen statt Defekte.
    expect(kgVariantDeclaresItsMoney({ ...baseVariant, delta: '-735000.00' }, 'STD')).toBe(true)
    expect(kgVariantDeclaresItsMoney({ ...baseVariant, noPriceBasis: true }, 'STD')).toBe(true)
    expect(kgVariantDeclaresItsMoney({ ...baseVariant, bundled: true }, 'STD')).toBe(true)
    expect(kgVariantDeclaresItsMoney({ ...baseVariant, excludesPosition: true }, 'STD')).toBe(true)
    expect(kgVariantDeclaresItsMoney({ ...baseVariant, costAuthority: 'noBasis' }, 'STD')).toBe(true)
    expect(kgVariantDeclaresItsMoney(baseVariant, 'ALT')).toBe(true)
  })

  it('SELBSTTEST · der Topf-Klassifizierer meldet eine wählbare Entscheidung ohne kaufmännische Dimension', () => {
    const silentService: KgService = {
      id: 'synthetic-silent', labelDe: 'Synthetisch', labelEn: 'Synthetic',
      summaryDe: '—', summaryEn: '—', amount: '0.00', baseline: 'notSelected',
      requiresDecision: true, authority: 'assumed',
      kind: { kind: 'includeExclude' },
    }
    // Wählbar, Betrag 0, keine erklärte Autorität, keine Anwendbarkeits-
    // aussage: der verbotene Zustand.
    expect(costAuthorityOf(silentService)).toBe('none')
    expect(kgServiceBucket(silentService)).toBe('IMPLICIT_NO_EFFECT')

    // Dieselbe Zeile mit Ursache ist nicht anwendbar — und legitim.
    expect(kgServiceBucket({
      ...silentService,
      applicability: {
        state: 'notApplicable',
        reasonDe: 'kein Untergeschoss', reasonEn: 'no basement',
      },
    })).toBe('NON_APPLICABLE')

    // Und eine reine Kontextzeile ohne Geld ist ebenfalls legitim.
    expect(kgServiceBucket({ ...silentService, kind: { kind: 'readOnlyRequired' } }))
      .toBe('READ_ONLY_CONTEXT')

    // Ein siebter Autoritätswert fällt auf — auch wenn er typisiert ist.
    expect(kgServiceBucket({
      ...silentService, costAuthority: 'bundled' as unknown as KgCostAuthority,
    })).toBe('IMPLICIT_NO_EFFECT')
  })
})

/* ═════════════════════════════════════════════════════════════════════════
 * FLÄCHE 2 · Zertifikate (`ZERT_GROUPS`)
 * ═══════════════════════════════════════════════════════════════════════ */

describe('Fläche 2 · Zertifikate — jede Nicht-Standard-Auswahl bewegt den Preis', () => {
  it('die Zertifikatsgruppen existieren und erreichen den Betrag über `optionDrivers`', () => {
    expect(ZERT_GROUPS.length).toBeGreaterThan(0)
    // `ALL_OPTION_GROUPS` ist die Liste, über die `optionDrivers` läuft.
    // Steht eine Zertifikatsgruppe nicht darin, kann sie den Preis nicht
    // bewegen — und dann wäre der folgende Tarif-Vertrag eine Aussage über
    // eine Gruppe, die niemand rechnet.
    for (const group of ZERT_GROUPS) {
      expect(ALL_OPTION_GROUPS.map((g) => g.id)).toContain(group.id)
    }
  })

  it('jede Nicht-Standard-Auswahl trägt einen Tarif ungleich Null; die Null der Standardauswahl ist die erklärte Baseline', () => {
    const violations: string[] = []
    for (const group of ZERT_GROUPS) {
      if (!optionGroupDeclaresItsMoney(group)) {
        const fallback = group.choices.find((c) => c.value === group.default)
        violations.push(
          `${group.id}: default=${group.default} (${fallback?.rate ?? 'FEHLT'}) · `
          + group.choices.map((c) => `${c.value}:${c.rate}`).join(' '),
        )
      }
    }
    expect(violations).toEqual([])
    // Nicht leerlaufend: es gibt überhaupt Nicht-Standard-Auswahlen.
    expect(ZERT_GROUPS.every((g) => g.choices.length > 1)).toBe(true)
  })

  it('SELBSTTEST · das Prädikat lehnt eine Zertifikatsgruppe mit kostenneutraler Abweichung ab', () => {
    const broken: OptionGroup = {
      id: 'synthetic-zert', label: 'Synthetisch', question: 'Synthetisch?',
      denominator: 'BGF_ABOVE_GROUND', default: 'keins', documented: false,
      choices: [
        { value: 'keins', label: 'kein Siegel', rate: '0', basis: 'Basisrate' },
        // Die Verletzung: eine Abweichung vom Standard, die behauptet,
        // kostenneutral zu sein, ohne dass es dafür eine Grundlage gibt.
        { value: 'gold', label: 'GOLD', rate: '0', basis: 'ohne Grundlage' },
      ],
    }
    expect(optionGroupDeclaresItsMoney(broken)).toBe(false)
    // Dieselbe Gruppe mit echtem Tarif besteht.
    expect(optionGroupDeclaresItsMoney({
      ...broken,
      choices: [broken.choices[0]!, { ...broken.choices[1]!, rate: '62' }],
    })).toBe(true)
    // Und eine Gruppe, deren Standardauswahl gar nicht existiert, ebenfalls
    // nicht: dann zeigt die erklärte Baseline auf nichts.
    expect(optionGroupDeclaresItsMoney({ ...broken, default: 'gibtEsNicht' })).toBe(false)
  })
})

/* ═════════════════════════════════════════════════════════════════════════
 * FLÄCHE 3 · Risikotreiber (`RISK_ITEMS`)
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Die vier Zustände der KG-200-Basis, über die jeder Treiber laufen muss.
 *
 * KG 200 ist die einzige Basis mit eigenem Zustand: sie gehört nicht zum
 * Block `Bauwerk`, sondern erscheint durch eine Einschlussentscheidung.
 * Drei Antworten, und keine davon ist Null — `notIncluded` ist eine
 * entschiedene kaufmännische Lage, `notDetermined` ist eine Lücke, und
 * `amount` mit Betrag 0 ist ein gerechneter Nullwert.
 */
const KG200_STATES: ReadonlyArray<{ name: string; state: Kg200Basis }> = [
  { name: 'amount>0', state: { kind: 'amount', exact: new Decimal('412000.00') } },
  { name: 'amount=0', state: { kind: 'amount', exact: new Decimal(0) } },
  { name: 'notIncluded', state: { kind: 'notIncluded' } },
  { name: 'notDetermined', state: { kind: 'notDetermined' } },
]

/** Repräsentative KG 300 aus dem Kontrollbeispiel `calculation-spec` §6.1. */
const KG300_REPRESENTATIVE = new Decimal('2672484.50')

/** Der Text, den `catalog.json` für einen Treiber druckt. */
function catalogLabelOf(risk: RiskItem): string {
  // Der Parametercode ist in `derived-prototype.json` ein eigenes Feld und
  // in `catalog.json` an den Text angehängt. Dass beide dasselbe MEINEN,
  // ist genau die Stelle, an der „eine Sache, zwei Kataloge“ auseinander
  // laufen kann — also wird die Abbildung erklärt, nicht geraten.
  return risk.sourceParameter ? `${risk.label} (\`${risk.sourceParameter}\`)` : risk.label
}

/** Die Basisschreibweise, die `catalog.json` druckt (`KG 320` statt `KG_320`). */
function catalogBaseOf(risk: RiskItem): string {
  return risk.base.replace('_', ' ')
}

/** Der Prozentwert, den `catalog.json` druckt (`4` statt `0.04`). */
function catalogRatePercentOf(risk: RiskItem): string {
  return new Decimal(risk.rate).mul(100).toString()
}

const CATALOG_RISK_DRIVERS = catalogFixture.internalConfig.riskDrivers

describe('Fläche 3 · Risikotreiber — sechs erklärte Treiber, jeder mit auflösbarer Basis', () => {
  it('alle SECHS Treiber der `calculation-spec` §1.4 existieren im Motor', () => {
    // Der pinierte Defekt: der Einstellungsbildschirm nannte sechs, der
    // Motor kannte zwei, und vier erklärte Treiber konnten den Preis unter
    // keinen Umständen verändern. Sechs ist keine abgeschriebene Zahl,
    // sondern der Umfang der Spezifikationstabelle §1.4.
    expect(RISK_ITEMS).toHaveLength(6)
    expect(CATALOG_RISK_DRIVERS).toHaveLength(6)
    expect(new Set(RISK_ITEMS.map((risk) => risk.id)).size).toBe(6)
  })

  it('jeder Treiber erklärt eine Basis, die der Motor AUFLÖSEN kann — über alle vier KG-200-Zustände', () => {
    const unresolvable: string[] = []
    for (const risk of RISK_ITEMS) {
      for (const { name, state } of KG200_STATES) {
        const bases: RiskBases = { kg300Exact: KG300_REPRESENTATIVE, kg200: state }
        const resolution = resolveRiskBasis(risk, bases)
        if (!DECLARED_RISK_BASIS_KINDS.includes(resolution.kind)) {
          unresolvable.push(`${risk.id} · kg200=${name} → undeklariert "${resolution.kind}"`)
        }
        if (!riskBasisIsResolvable(risk, bases)) {
          unresolvable.push(`${risk.id} · kg200=${name} → unknownBase "${risk.base}"`)
        }
      }
    }
    expect(unresolvable).toEqual([])
  })

  it('der KG-200-Treiber bewegt den Preis, sobald die Gruppe einen Betrag hat — und sagt sonst, WARUM nicht', () => {
    // Der eigentliche Defekt dieser Fläche, als Arithmetik. `KG_200` ist
    // weder `kg300Exact` noch eine Untergruppe von `splitKg300`; unter der
    // alten Signatur verschwand der Treiber still.
    const kg200Drivers = RISK_ITEMS.filter((risk) => risk.base === 'KG_200')
    expect(kg200Drivers.length).toBeGreaterThan(0)
    for (const risk of kg200Drivers) {
      const amount = new Decimal('412000.00')
      const resolved = riskOutcome(risk, {
        kg300Exact: KG300_REPRESENTATIVE, kg200: { kind: 'amount', exact: amount },
      })
      expect(resolved.basis.kind).toBe('resolved')
      expect(resolved.driver).not.toBeNull()
      expect(resolved.driver!.exact.toFixed(2))
        .toBe(amount.mul(new Decimal(risk.rate)).toFixed(2))

      // Die drei Nicht-Beträge sind BENANNTE Zustände, nicht Null.
      expect(riskOutcome(risk, {
        kg300Exact: KG300_REPRESENTATIVE, kg200: { kind: 'notIncluded' },
      }).basis).toEqual({ kind: 'outOfScope', reason: 'kg200NotIncluded' })
      expect(riskOutcome(risk, {
        kg300Exact: KG300_REPRESENTATIVE, kg200: { kind: 'notDetermined' },
      }).basis).toEqual({ kind: 'notDetermined', reason: 'kg200NotDetermined' })
      expect(riskOutcome(risk, {
        kg300Exact: KG300_REPRESENTATIVE, kg200: { kind: 'amount', exact: new Decimal(0) },
      }).basis).toEqual({ kind: 'noCost', reason: 'baseZero' })
    }
  })

  it('ein Treiber erzeugt genau dann einen Beitrag, wenn seine Basis aufgelöst ist — und niemals einen Beitrag von Null', () => {
    const violations: string[] = []
    for (const risk of RISK_ITEMS) {
      for (const { name, state } of KG200_STATES) {
        const outcome = riskOutcome(risk, {
          kg300Exact: KG300_REPRESENTATIVE, kg200: state,
        })
        const resolved = outcome.basis.kind === 'resolved'
        if (resolved !== (outcome.driver !== null)) {
          violations.push(`${risk.id} · kg200=${name}: Basis ${outcome.basis.kind}, `
            + `Beitrag ${outcome.driver === null ? 'fehlt' : 'existiert'}`)
        }
        if (outcome.driver && outcome.driver.exact.isZero()) {
          violations.push(`${risk.id} · kg200=${name}: Beitrag von Null`)
        }
        if (outcome.driver) {
          // Der Beitrag ist Basis × Satz, exakt — nicht „ungefähr von KG 300“.
          // Ein Prozentsatz auf den falschen Nenner ist dieselbe Klasse wie
          // DATA-001, wo ober- und unterirdische Fläche unter der Beschriftung
          // `oberirdisch` addiert wurden.
          const basis = outcome.basis
          expect(basis.kind).toBe('resolved')
          if (basis.kind === 'resolved') {
            expect(outcome.driver.exact.toFixed(6))
              .toBe(basis.exact.mul(new Decimal(risk.rate)).toFixed(6))
          }
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('die sechs Treiber stimmen FELD FÜR FELD mit `catalog.json` überein — die zweite Stelle, die sie druckt', () => {
    // „Eine Sache, zwei Kataloge“: `internalConfig.riskDrivers` ist die
    // Liste, die der Einstellungsbildschirm rendert, `risiken.items` die,
    // die der Motor rechnet. Solange beide getrennt gepflegt werden, kann
    // der Bildschirm einen Satz nennen, den niemand anwendet — der Anwender
    // sieht `+5 %` und die Zahl bewegt sich nicht.
    const engineByLabel = new Map(RISK_ITEMS.map((risk) => [catalogLabelOf(risk), risk]))
    const catalogByLabel = new Map(CATALOG_RISK_DRIVERS.map((row) => [row.label, row]))

    // Erst die Mengen — ein Treiber, der nur auf einer Seite existiert, ist
    // der schlimmste Fall und wird als solcher gemeldet.
    expect([...engineByLabel.keys()].sort()).toEqual([...catalogByLabel.keys()].sort())

    const mismatches: string[] = []
    for (const [label, risk] of engineByLabel) {
      const row = catalogByLabel.get(label)!
      if (row.base !== catalogBaseOf(risk)) {
        mismatches.push(`${risk.id} · base: Motor "${catalogBaseOf(risk)}" ≠ Katalog "${row.base}"`)
      }
      if (row.ratePercent !== catalogRatePercentOf(risk)) {
        mismatches.push(`${risk.id} · rate: Motor "${catalogRatePercentOf(risk)} %" `
          + `≠ Katalog "${row.ratePercent} %"`)
      }
    }
    expect(mismatches).toEqual([])
  })

  it('SELBSTTEST · eine synthetisch unbekannte Basis wird als `unknownBase` gemeldet, nicht verschluckt', () => {
    const strayBase: RiskItem = {
      id: 'RISK-SYNTHETIC', label: 'Synthetischer Treiber',
      labelEn: 'Synthetic driver', kategorie: 'Test', kategorieEn: 'Test',
      wahrscheinlichkeit: 'mittel',
      // Die Verletzung: eine Basis, die der Motor nicht kennt. Genau so war
      // `KG_200` sechs Releases lang wirkungslos.
      base: 'KG_450', rate: '0.04',
      remedy: '—', remedyEn: '—',
    }
    const bases: RiskBases = {
      kg300Exact: KG300_REPRESENTATIVE, kg200: { kind: 'amount', exact: new Decimal(1) },
    }
    expect(resolveRiskBasis(strayBase, bases)).toEqual({ kind: 'unknownBase', declared: 'KG_450' })
    expect(riskBasisIsResolvable(strayBase, bases)).toBe(false)
    // Und der Beitrag fehlt — aber jetzt SICHTBAR, mit genanntem Zustand.
    expect(riskOutcome(strayBase, bases).driver).toBeNull()
  })
})

/* ═════════════════════════════════════════════════════════════════════════
 * FLÄCHE 4 · Leistungsumfang-Kataloge KG 200 / 500 / 600
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * AUSNAHMELISTE 1 — Kataloge, die NICHT über `scopeCatalogOutcome` laufen.
 *
 * Jeder Eintrag nennt seinen Grund, und der letzte Test dieses Abschnitts
 * prüft, dass der Grund noch gilt. Eine Ausnahme, die niemand mehr braucht,
 * ist genauso ein Defekt wie eine fehlende Prüfung — sie befreit still eine
 * Fläche, die inzwischen bepreist ist.
 */
const SCOPE_CATALOGUES_NOT_ROUTED_THROUGH_OUTCOME = [
  {
    kg: 'KG_800' as const,
    /**
     * KG 800 (Finanzierung) ist keine Position mit Menge × Satz: die
     * Varianten tragen Monate, Prozentsätze und einen zweiten Satz
     * (`rate2`, Bereitstellungszins) und werden von `calculateKg800`
     * gelesen, nicht von `scopeCatalogOutcome`. Zusätzlich ist KG 800 als
     * Leistungsabgrenzungs-Entscheidung zurückgezogen (Ticket „Rebuild
     * Project Card Workflow“): die Deckung wird auf `excluded` gezwungen.
     * Die Ausnahme gilt also für den ROUTING-Weg, nicht für die Bepreisung.
     */
    options: KG800_CATALOG_OPTIONS,
  },
]

/** Die drei Kataloge, deren Ergebnis `scopeCatalogOutcome` verantwortet. */
const ROUTED_SCOPE_CATALOGUES: ReadonlyArray<{ name: string; options: ScopeOption[] }> = [
  { name: 'KG200_CATALOG_OPTIONS', options: KG200_CATALOG_OPTIONS },
  { name: 'KG500_CATALOG_OPTIONS', options: KG500_CATALOG_OPTIONS },
  { name: 'KG600_CATALOG_OPTIONS', options: KG600_CATALOG_OPTIONS },
]

/**
 * Vier Mengenlagen, über die JEDE Variante laufen muss.
 *
 * Der pinierte Defekt lebte genau in der Differenz zwischen zwei von
 * ihnen: „Menge fehlt noch“ und „Menge ist Null“ ergaben dasselbe `null`.
 * Ein Test, der nur die vollständige Lage prüft, hätte ihn nie gesehen.
 */
const QUANTITY_SCENARIOS: ReadonlyArray<{
  name: string
  quantityOf: (key: ScopeQuantityKey) => Decimal | null
  kg300Plus400: Decimal
}> = [
  {
    name: 'keine Menge verfügbar · KG 300+400 unbekannt',
    quantityOf: () => null,
    kg300Plus400: new Decimal(0),
  },
  {
    name: 'keine Menge verfügbar · KG 300+400 bekannt',
    quantityOf: () => null,
    kg300Plus400: new Decimal('10000000.00'),
  },
  {
    name: 'Menge im Projekt gleich Null · KG 300+400 unbekannt',
    quantityOf: () => new Decimal(0),
    kg300Plus400: new Decimal(0),
  },
  {
    name: 'alles bekannt und positiv',
    quantityOf: () => new Decimal(40),
    kg300Plus400: new Decimal('10000000.00'),
  },
]

/** Der Topf einer Katalogvariante in der vollständig bekannten Lage. */
function scopeVariantBucket(
  option: ScopeOption, variant: ScopeVariant,
): BucketOrViolation {
  const scenario = QUANTITY_SCENARIOS[QUANTITY_SCENARIOS.length - 1]!
  const outcome = scopeCatalogOutcome(
    option, variant, scenario.quantityOf, scenario.kg300Plus400,
  )
  if (!scopeOutcomeIsDeclared(outcome)) return 'IMPLICIT_NO_EFFECT'
  if (outcome.kind === 'priced') return 'PRICED_SELECTABLE'
  // `noCost` ist der bewusste Null-Tarif des Katalogs, `notDetermined` die
  // erklärte Lücke — beide sind ein ERKLÄRTER Zustand ohne Euro.
  return 'EXPLICIT_NON_PRICED'
}

describe('Fläche 4 · Leistungsumfang-Kataloge — jedes Ergebnis ist ein deklarierter Zustand', () => {
  it('jede Option jedes Katalogs liefert in JEDER Mengenlage einen deklarierten Zustand', () => {
    const violations: string[] = []
    let checked = 0
    for (const { name: catalogueName, options } of ROUTED_SCOPE_CATALOGUES) {
      expect(options.length, `${catalogueName} ist leer`).toBeGreaterThan(0)
      for (const option of options) {
        for (const variant of option.variants) {
          for (const scenario of QUANTITY_SCENARIOS) {
            checked += 1
            const outcome = scopeCatalogOutcome(
              option, variant, scenario.quantityOf, scenario.kg300Plus400,
            )
            const where = `${catalogueName} · ${option.id} · ${variant.value} `
              + `· [${scenario.name}]`
            if (!scopeOutcomeIsDeclared(outcome)) {
              violations.push(`${where} → ${JSON.stringify(outcome.kind)}`)
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(300)
    expect(violations).toEqual([])
  })

  it('ein `notDetermined` erzeugt NIEMALS einen Beitrag, und ein Beitrag ist niemals Null', () => {
    // Die zwei Hälften der Regel 16 auf dieser Fläche: „unbekannt“ darf
    // nicht zu einer Zahl werden, und eine Zahl darf nicht Null sein und
    // trotzdem wie ein Ergebnis aussehen.
    const violations: string[] = []
    for (const { name: catalogueName, options } of ROUTED_SCOPE_CATALOGUES) {
      for (const option of options) {
        for (const variant of option.variants) {
          for (const scenario of QUANTITY_SCENARIOS) {
            const outcome = scopeCatalogOutcome(
              option, variant, scenario.quantityOf, scenario.kg300Plus400,
            )
            const driver = scopeCatalogDriver(
              option, variant, scenario.quantityOf, scenario.kg300Plus400,
            )
            const where = `${catalogueName} · ${option.id} · ${variant.value} `
              + `· [${scenario.name}]`
            if (outcome.kind === 'notDetermined' && driver !== null) {
              violations.push(`${where}: notDetermined, aber ein Beitrag existiert`)
            }
            if (outcome.kind === 'noCost' && driver !== null) {
              violations.push(`${where}: noCost, aber ein Beitrag existiert`)
            }
            if (outcome.kind === 'priced' && driver === null) {
              violations.push(`${where}: bepreist, aber kein Beitrag`)
            }
            if (driver !== null && driver.exact.isZero()) {
              violations.push(`${where}: Beitrag von Null`)
            }
          }
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('eine nicht ermittelte Position wird BERICHTET — `unpricedScopeCatalogPositions` ist der Weg, auf dem sie sichtbar wird', () => {
    // Vorher war das Kriterium gruppenweise und griff nur bei einer
    // NULL-Gruppensumme. KG 200 rechnet zwei Positionen aus abgeleiteten
    // Größen (Gebäudezahl, Pauschale), die Gruppensumme war also nicht Null
    // — und die zwei übrigen eingeschlossenen Positionen mit Tarif
    // (12 €/t Bodenabfuhr, 30 €/m² private Infrastruktur) fielen still weg,
    // während die Zusammenfassung den Betrag vollständig nannte.
    for (const { name: catalogueName, options } of ROUTED_SCOPE_CATALOGUES) {
      const selections = defaultScopeCatalogSelections(options)
      for (const scenario of QUANTITY_SCENARIOS) {
        const reported = unpricedScopeCatalogPositions(
          options, selections, scenario.quantityOf, scenario.kg300Plus400,
        )
        // Die Berichtsliste ist genau die Menge der `notDetermined`-Ergebnisse
        // der ausgewählten Varianten — kein Eintrag zu viel, keiner zu wenig.
        const expected = options.filter((option) => {
          const variant = option.variants.find((v) => v.value === selections[option.id])
          if (!variant) return false
          return scopeCatalogOutcome(
            option, variant, scenario.quantityOf, scenario.kg300Plus400,
          ).kind === 'notDetermined'
        }).map((option) => option.id)
        expect(reported.map((row) => row.optionId), `${catalogueName} · ${scenario.name}`)
          .toEqual(expected)
        for (const row of reported) {
          // Jeder Bericht sagt, WAS fehlt — sonst kann die Oberfläche die
          // Lücke nicht in Worte fassen und fällt auf einen Platzhalter
          // zurück, der wieder wie „nichts“ aussieht.
          expect(row.labelDe.length).toBeGreaterThan(0)
          expect(row.labelEn.length).toBeGreaterThan(0)
          expect(row.variantLabelDe.length).toBeGreaterThan(0)
          if (row.quantityKey !== null) {
            expect(SCOPE_QUANTITY_UNIT).toHaveProperty(row.quantityKey)
          }
        }
      }
    }
  })

  it('in der vollständig bekannten Lage bleibt keine ausgewählte Position unermittelt', () => {
    // Die Gegenprobe zum Test darüber: wäre die Berichtsliste immer voll
    // oder immer leer, prüfte sie nichts. Hier ist sie leer, weil jede
    // Menge bekannt ist — und im ersten Szenario oben ist sie es nicht.
    const last = QUANTITY_SCENARIOS[QUANTITY_SCENARIOS.length - 1]!
    const first = QUANTITY_SCENARIOS[0]!
    let reportedInFirst = 0
    for (const { options } of ROUTED_SCOPE_CATALOGUES) {
      const selections = defaultScopeCatalogSelections(options)
      expect(unpricedScopeCatalogPositions(
        options, selections, last.quantityOf, last.kg300Plus400,
      )).toEqual([])
      reportedInFirst += unpricedScopeCatalogPositions(
        options, selections, first.quantityOf, first.kg300Plus400,
      ).length
    }
    expect(reportedInFirst).toBeGreaterThan(0)
  })

  it('jede Katalogvariante liegt in einem Topf, keine im verbotenen — und beide legitimen Töpfe sind belegt', () => {
    const tally = new Map<BucketOrViolation, number>()
    const violations: string[] = []
    for (const { name: catalogueName, options } of ROUTED_SCOPE_CATALOGUES) {
      for (const option of options) {
        for (const variant of option.variants) {
          const bucket = scopeVariantBucket(option, variant)
          tally.set(bucket, (tally.get(bucket) ?? 0) + 1)
          if (bucket === 'IMPLICIT_NO_EFFECT') {
            violations.push(`${catalogueName} · ${option.id} · ${variant.value}`)
          }
        }
      }
    }
    expect(violations).toEqual([])
    expect(tally.get('PRICED_SELECTABLE') ?? 0).toBeGreaterThan(0)
    expect(tally.get('EXPLICIT_NON_PRICED') ?? 0).toBeGreaterThan(0)
  })

  it('AUSNAHMELISTE · KG 800 ist der einzige nicht geroutete Katalog, und der Grund gilt noch', () => {
    const routedIds = new Set(
      ROUTED_SCOPE_CATALOGUES.flatMap(({ options }) => options.map((o) => o.id)),
    )
    const exemptGroups = new Set<ScopeOption['kg']>(
      SCOPE_CATALOGUES_NOT_ROUTED_THROUGH_OUTCOME.map((entry) => entry.kg),
    )

    // 1. Kein Katalog entzieht sich unbemerkt: jede Option, die `engine`
    //    überhaupt kennt, ist entweder geroutet oder namentlich befreit.
    const unaccounted = ALL_SCOPE_CATALOG_OPTIONS
      .filter((option) => !routedIds.has(option.id) && !exemptGroups.has(option.kg))
      .map((option) => `${option.kg} · ${option.id}`)
    expect(unaccounted).toEqual([])

    // 2. Keine befreite Option ist in Wahrheit doch geroutet — sonst wäre
    //    sie zweimal erklärt und einmal ungeprüft.
    for (const entry of SCOPE_CATALOGUES_NOT_ROUTED_THROUGH_OUTCOME) {
      // 3. STALENESS: eine Ausnahme für einen leeren Katalog befreit nichts
      //    und muss verschwinden.
      expect(entry.options.length, `Ausnahme ${entry.kg} ist veraltet: Katalog leer`)
        .toBeGreaterThan(0)
      for (const option of entry.options) {
        expect(option.kg).toBe(entry.kg)
        expect(routedIds.has(option.id)).toBe(false)
      }
    }

    // 4. Die drei gerouteten Kataloge enthalten ausschließlich ihre eigene KG.
    expect(new Set(KG200_CATALOG_OPTIONS.map((o) => o.kg))).toEqual(new Set(['KG_200']))
    expect(new Set(KG500_CATALOG_OPTIONS.map((o) => o.kg))).toEqual(new Set(['KG_500']))
    expect(new Set(KG600_CATALOG_OPTIONS.map((o) => o.kg))).toEqual(new Set(['KG_600']))
  })

  it('SELBSTTEST · das Prädikat lehnt einen bepreisten Beitrag von Null und eine undeklarierte Ergebnisart ab', () => {
    const syntheticOption: ScopeOption = {
      id: 'synthetic-01', kg: 'KG_500',
      labelDe: 'Synthetische Position', labelEn: 'Synthetic position',
      questionDe: 'Synthetisch?', questionEn: 'Synthetic?',
      basis: { kind: 'perQuantity', quantityKey: 'surface_parking_spaces' },
      default: '01',
      variants: [{
        value: '01', labelDe: 'Standard', labelEn: 'Standard',
        summaryDe: '—', summaryEn: '—',
        characteristicsDe: [], characteristicsEn: [],
        rate: '7500', evidenceClass: 'D',
      }],
    }
    const variant = syntheticOption.variants[0]!

    // Eine echte Lücke: Tarif vorhanden, Menge unbekannt. Der Zustand ist
    // `notDetermined`, es gibt KEINEN Beitrag, und die Position wird
    // berichtet — das ist die geforderte Sichtbarkeit.
    const gap = scopeCatalogOutcome(syntheticOption, variant, () => null, new Decimal(0))
    expect(gap.kind).toBe('notDetermined')
    expect(scopeCatalogDriver(syntheticOption, variant, () => null, new Decimal(0))).toBeNull()
    expect(unpricedScopeCatalogPositions(
      [syntheticOption], { 'synthetic-01': '01' }, () => null, new Decimal(0),
    ).map((row) => row.optionId)).toEqual(['synthetic-01'])
    expect(scopeOutcomeIsDeclared(gap)).toBe(true)

    // Die Verletzung 1: ein „bepreistes“ Ergebnis mit Betrag Null. So sieht
    // eine stille Null aus, die sich als gerechneter Wert ausgibt.
    const priced = scopeCatalogOutcome(
      syntheticOption, variant, () => new Decimal(20), new Decimal(0),
    )
    expect(priced.kind).toBe('priced')
    expect(scopeOutcomeIsDeclared(priced)).toBe(true)
    if (priced.kind === 'priced') {
      expect(scopeOutcomeIsDeclared({
        kind: 'priced', driver: { ...priced.driver, exact: new Decimal(0) },
      })).toBe(false)
    }

    // Die Verletzung 2: eine Ergebnisart, die es in der Union nicht gibt —
    // genau der `default`-Zweig, in den eine Oberfläche stumm fällt.
    expect(scopeOutcomeIsDeclared(
      { kind: 'silentZero' } as unknown as ScopeCatalogOutcome,
    )).toBe(false)

    // Die Verletzung 3: `noCost` mit einem Grund, den niemand erklärt hat.
    expect(scopeOutcomeIsDeclared(
      { kind: 'noCost', reason: 'weilEsSoIst' } as unknown as ScopeCatalogOutcome,
    )).toBe(false)
  })
})

/* ═════════════════════════════════════════════════════════════════════════
 * FLÄCHE 5 · die ruhenden KG-300-/KG-400-Gruppen aus `engine/options.ts`
 * ═══════════════════════════════════════════════════════════════════════ */

const SRC_ROOT = path.resolve(__dirname, '..', '..')

/** Jede Quelldatei unter `src`, ohne Testdateien. */
function productSources(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (statSync(full).isDirectory()) {
        // Eine Testdatei ist keine Sales-Fläche. Sie wird bewusst nicht
        // gescannt — sonst wäre diese Datei selbst ihr erster Treffer, und
        // die Ausnahmeliste unten müsste einen Eintrag tragen, der über
        // Produktverhalten nichts aussagt.
        if (entry === '__tests__' || entry === 'node_modules') continue
        walk(full)
        continue
      }
      if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
    }
  }
  walk(SRC_ROOT)
  return out
}

/**
 * Kommentare sind Prosa, nicht Code.
 *
 * Ohne diese Maske meldet der Scanner jeden Docblock, der einen Mutator
 * ZITIERT (`store.ts` tut das dreimal), als lebenden Aufruf — und ein
 * Scanner, der Prosa anzeigt, ist ein Scanner, den man abzuschalten lernt.
 * Ersetzt statt entfernt, damit Zeilennummern erhalten bleiben.
 */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (line, lead: string) =>
      lead + ' '.repeat(line.length - lead.length))
}

/**
 * AUSNAHMELISTE 2 — Verzeichnisse, die den Mutator `setKg300` nennen dürfen.
 *
 * Ein Eintrag pro Grund, und der letzte Test prüft, dass jeder Eintrag
 * WIRKLICH noch etwas trifft. Eine Ausnahme, die auf nichts mehr zeigt,
 * verbreitert das Loch für eine künftige Fläche, ohne dass es auffällt.
 */
const SETTER_HOME_DIRECTORIES = [
  {
    prefix: 'state/',
    /**
     * Der Mutator selbst gehört ins Journal-tragende Zustandsmodul: dort
     * ist er deklariert (`Store`-Schnittstelle) und implementiert. Eine
     * Nennung hier ist der Wohnort, keine Aufrufstelle.
     */
    reason: 'Deklaration und Implementierung des Mutators im zustandsführenden Modul',
  },
]

function filesReferencing(needle: string): string[] {
  return productSources()
    .filter((file) => withoutComments(readFileSync(file, 'utf8')).includes(needle))
    .map((file) => path.relative(SRC_ROOT, file))
}

/* ═════════════════════════════════════════════════════════════════════════
 * FLÄCHE 6 · DIE MENGENGETRIEBENEN KG-200/500/600-POSITIONEN
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Die zehn Positionen, die diese Aufgabe von einer PAUSCHALE zu einer
 * MENGE gemacht hat — namentlich, damit ein späteres Zurückflachen auffällt.
 *
 * WARUM DIESE LISTE ABGESCHRIEBEN IST UND DIE ANDEREN NICHT. Der Rest
 * dieser Datei liest bewusst über die echten Fixtures, damit ein neuer
 * Eintrag die Prüfung nicht umgehen kann. Hier ist die Frage aber eine
 * andere: nicht «erfüllt jede Mengenposition den Vertrag» (das prüft der
 * erste Test unten über ALLE), sondern «sind diese zehn Positionen
 * überhaupt noch Mengenpositionen». Eine Liste, die aus den Daten
 * abgeleitet wird, kann diese Frage nicht stellen — sie würde stillschweigend
 * mitschrumpfen. Der `expectedAmount` steht daneben, weil die ganze
 * Sicherheitseigenschaft der Umstellung genau dieses Produkt ist.
 */
const QUANTIFIED_SCOPE_POSITIONS: ReadonlyArray<{
  id: string; project: string; group: KgScopeGroup
  unitAmount: string; baselineQuantity: string; expectedAmount: string
}> = [
  { id: 'a-200-02', project: 'DEMO-HAPPY-01', group: 'KG_200', unitAmount: '20.00', baselineQuantity: '2200', expectedAmount: '44000.00' },
  { id: 'a-200-03', project: 'DEMO-HAPPY-01', group: 'KG_200', unitAmount: '17000.00', baselineQuantity: '4', expectedAmount: '68000.00' },
  { id: 'a-500-02', project: 'DEMO-HAPPY-01', group: 'KG_500', unitAmount: '100.00', baselineQuantity: '740', expectedAmount: '74000.00' },
  { id: 'a-500-03', project: 'DEMO-HAPPY-01', group: 'KG_500', unitAmount: '400.00', baselineQuantity: '145', expectedAmount: '58000.00' },
  { id: 'b-200-02', project: 'DEMO-COMPLEX-01', group: 'KG_200', unitAmount: '20.00', baselineQuantity: '9500', expectedAmount: '190000.00' },
  { id: 'b-500-01', project: 'DEMO-COMPLEX-01', group: 'KG_500', unitAmount: '200.00', baselineQuantity: '3100', expectedAmount: '620000.00' },
  { id: 'b-500-02', project: 'DEMO-COMPLEX-01', group: 'KG_500', unitAmount: '380.00', baselineQuantity: '1000', expectedAmount: '380000.00' },
  { id: 'b-500-03', project: 'DEMO-COMPLEX-01', group: 'KG_500', unitAmount: '100.00', baselineQuantity: '2900', expectedAmount: '290000.00' },
  { id: 'b-500-04', project: 'DEMO-COMPLEX-01', group: 'KG_500', unitAmount: '100.00', baselineQuantity: '3400', expectedAmount: '340000.00' },
  { id: 'b-600-01', project: 'DEMO-COMPLEX-01', group: 'KG_600', unitAmount: '32000.00', baselineQuantity: '3', expectedAmount: '96000.00' },
]

/** Jede Mengenposition beider Kataloge, mit ihrem Projekt und ihrer KG. */
function quantityServices(): Array<{
  project: string; group: KgScopeGroup; service: KgService
  kind: Extract<KgService['kind'], { kind: 'quantity' }>
}> {
  const out: Array<{
    project: string; group: KgScopeGroup; service: KgService
    kind: Extract<KgService['kind'], { kind: 'quantity' }>
  }> = []
  for (const catalogue of kgCatalogues()) {
    for (const chapter of catalogue.chapters) {
      for (const serviceGroup of chapter.groups) {
        for (const service of serviceGroup.services) {
          if (service.kind.kind !== 'quantity') continue
          out.push({
            project: catalogue.projectId, group: chapter.group, service,
            kind: service.kind,
          })
        }
      }
    }
  }
  return out
}

/**
 * Der Vertrag EINER Mengenposition, als Prädikat statt als Erwartung.
 *
 * `amount` ist der deklarierte Betrag, aus dem die Kapitelsumme gebildet
 * ist. Eine Mengenposition rechnet ihn aber nicht mehr ab, sondern
 * `unitAmount × Menge`. Fallen die beiden auseinander, dann verschiebt die
 * BASISLAGE Geld — und genau das darf die Umstellung von einer Pauschale
 * auf eine Menge nicht tun.
 */
function quantityPositionViolations(
  kind: Extract<KgService['kind'], { kind: 'quantity' }>, amount: string,
): string[] {
  const problems: string[] = []
  const product = new Decimal(kind.unitAmount).mul(new Decimal(kind.baselineQuantity))
  if (!product.equals(new Decimal(amount))) {
    problems.push(`Basislage verschiebt Geld: ${kind.unitAmount} × ${kind.baselineQuantity}`
      + ` = ${product.toFixed(2)}, deklariert ${amount}`)
  }
  if (new Decimal(kind.unitAmount).lte(0)) problems.push('Satz ist nicht positiv')
  if (!kind.unitDe.trim() || !kind.unitEn.trim()) problems.push('Einheit fehlt in einer Sprache')
  return problems
}

describe('Fläche 6 · mengengetriebene KG-200/500/600-Positionen bewegen echtes Geld', () => {
  it('jede Mengenposition multipliziert exakt auf ihren deklarierten Betrag zurück', () => {
    const rows = quantityServices()
    // Nicht leerlaufend: findet der Sweep nichts, prüft dieser Test nichts.
    expect(rows.length).toBeGreaterThanOrEqual(QUANTIFIED_SCOPE_POSITIONS.length)
    const violations = rows.flatMap(({ project, group, service, kind }) =>
      quantityPositionViolations(kind, service.amount)
        .map((problem) => `${project} · ${group} · ${service.id}: ${problem}`))
    expect(violations).toEqual([])
  })

  it('die zehn neu bespielten Positionen SIND Mengenpositionen — und tragen genau ihren alten Betrag', () => {
    const byId = new Map(quantityServices().map((row) => [`${row.project}|${row.service.id}`, row]))
    const missing: string[] = []
    for (const expected of QUANTIFIED_SCOPE_POSITIONS) {
      const row = byId.get(`${expected.project}|${expected.id}`)
      if (!row) {
        missing.push(`${expected.project} · ${expected.id}: keine Mengenposition mehr`)
        continue
      }
      expect(row.group, `${expected.id} hat die Kostengruppe gewechselt`).toBe(expected.group)
      expect(row.kind.unitAmount).toBe(expected.unitAmount)
      expect(row.kind.baselineQuantity).toBe(expected.baselineQuantity)
      // Der eigentliche Satz dieser Aufgabe: der Betrag ist UNVERÄNDERT.
      expect(row.service.amount).toBe(expected.expectedAmount)
    }
    expect(missing).toEqual([])
  })

  it('eine Mengenposition liefert in JEDER Mengenlage einen Betrag — nie `null`, nie eine stille Null', () => {
    // Die vier Lagen, in denen eine Menge stehen kann. Die dritte und
    // vierte sind der Grund für den Test: eine ungültige oder fehlende
    // Eingabe darf die Position nicht aus der Summe fallen lassen, denn
    // dann wäre der Gesamtbetrag still kleiner geworden.
    const ENTRIES = ['4711', '', '   ', 'zwölf'] as const
    const violations: string[] = []
    let checked = 0
    for (const catalogue of kgCatalogues()) {
      const base = initialDecisions(catalogue)
      for (const { service, kind } of quantityServices()
        .filter((row) => row.project === catalogue.projectId)) {
        for (const entry of ENTRIES) {
          const decisions: KgDecisions = {
            ...base,
            services: {
              ...base.services,
              [service.id]: { state: 'selected', quantity: entry },
            },
          }
          const contribution = serviceContribution(catalogue, decisions, service)
          checked += 1
          if (contribution === null) {
            violations.push(`${service.id} · «${entry}»: Beitrag ist null`)
            continue
          }
          const problem = quantityProblem(service, entry)
          // Eine ungültige Eingabe rechnet mit der letzten GÜLTIGEN Menge
          // weiter (der Basislage) und sagt das in der Zeile. Sie rechnet
          // nicht mit null, und sie rechnet nicht mit dem, was dasteht.
          const expected = problem
            ? new Decimal(kind.unitAmount).mul(new Decimal(kind.baselineQuantity))
            : new Decimal(kind.unitAmount).mul(new Decimal(entry))
          if (!contribution.equals(expected)) {
            violations.push(`${service.id} · «${entry}»: ${contribution.toFixed(2)}`
              + ` statt ${expected.toFixed(2)}`)
          }
          if (contribution.isZero()) {
            violations.push(`${service.id} · «${entry}»: stille Null`)
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
    expect(violations).toEqual([])
  })

  it('jede Mengenposition nennt ihre Einheit in BEIDEN Sprachen — sonst liest EN die deutsche', () => {
    const violations = quantityServices()
      .filter(({ kind }) => !kind.unitDe.trim() || !kind.unitEn.trim())
      .map(({ project, service }) => `${project} · ${service.id}`)
    expect(violations).toEqual([])
    expect(quantityServices().length).toBeGreaterThan(0)
  })

  it('SELBSTTEST · das Prädikat lehnt eine Umstellung ab, die die Basislage verschiebt', () => {
    // Genau der Fehler, den die Umstellung machen könnte: eine hübsche
    // runde Menge zu einem Satz, der nicht mehr auf den Betrag zurückführt.
    expect(quantityPositionViolations(
      { kind: 'quantity', unitAmount: '20.00', baselineQuantity: '2200', unitDe: 'm²', unitEn: 'm²', minQuantity: '0', maxQuantity: '100000' },
      '44000.00',
    )).toEqual([])
    expect(quantityPositionViolations(
      { kind: 'quantity', unitAmount: '21.00', baselineQuantity: '2200', unitDe: 'm²', unitEn: 'm²', minQuantity: '0', maxQuantity: '100000' },
      '44000.00',
    )).not.toEqual([])
    expect(quantityPositionViolations(
      { kind: 'quantity', unitAmount: '20.00', baselineQuantity: '2200', unitDe: 'm²', unitEn: '', minQuantity: '0', maxQuantity: '100000' },
      '44000.00',
    )).not.toEqual([])
  })
})

/* ═════════════════════════════════════════════════════════════════════════
 * FLÄCHE 7 · DER LEGACY-KATALOG BLEIBT UNERREICHBAR
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * WARUM KG 200/500/600 NICHT über `scope-catalog.json` bespielt wurde.
 *
 * Das Ticket verlangte ein `ScopeCatalogChapter` über `engine/scopeCatalog.ts`.
 * Die Repository-Wahrheit widerlegte die Prämisse, und zwar strukturell:
 *
 *  1. `scopeCatalogDrivers` läuft AUSSCHLIESSLICH in `proposalProjection`.
 *  2. `proposalProjection` läuft nur, wenn eine Option KEIN `kgConfig` hat.
 *  3. Die Beiträge verlangen zusätzlich `coverage[KG] === 'included'`.
 *  4. Der einzige Produktivschreiber von `'included'` ist
 *     `setKgScopeDecision`, dessen erste Zeile bei fehlendem `kgConfig`
 *     zurückkehrt. `setCoverage` hat keinen einzigen Produktivaufrufer.
 *
 * (2) und (4) schließen einander aus. Der Katalog kann in KEINEM
 * erreichbaren Produktzustand einen Euro bewegen. Ein Kapitel darüber hätte
 * rund zwanzig Sales-wählbare Kontrollpunkte mit garantiert null
 * Preiswirkung ausgeliefert — genau der Zustand, den Fläche 1 bis 4
 * verbieten.
 *
 * Deshalb prüft diese Fläche das, was die Entscheidung TRÄGT: solange der
 * Katalog keine Oberfläche hat, ist er kein Sales-wählbarer Kontrollpunkt.
 * Baut jemand morgen doch eine, fällt dieser Test — und zwingt damit, den
 * Katalog im selben Schritt auch BEPREISBAR zu machen, statt still eine
 * wirkungslose Auswahl auszuliefern.
 */
const SCOPE_CATALOG_MUTATORS = ['setScopeCatalogChoice', 'setScopeCatalogQuantity'] as const

describe('Fläche 7 · der Legacy-Leistungsumfang-Katalog ist keine Sales-Fläche', () => {
  it('KEINE `.tsx`-Fläche ruft einen Katalog-Mutator — der strukturelle Beweis', () => {
    for (const mutator of SCOPE_CATALOG_MUTATORS) {
      const callers = filesReferencing(mutator)
      // Nicht leerlaufend: findet der Scanner gar nichts, wurde der Mutator
      // umbenannt und diese ganze Fläche ist neu zu bewerten.
      expect(callers.length, `${mutator} existiert nicht mehr unter diesem Namen`)
        .toBeGreaterThan(0)
      expect(
        callers.filter((file) => file.endsWith('.tsx')),
        `${mutator} hat eine Oberfläche bekommen — dann muss der Katalog im
         selben Schritt einen erreichbaren Preisweg bekommen (Fläche 4)`,
      ).toEqual([])
      expect(
        callers.filter((file) => !file.startsWith('state/')),
        `${mutator} wird außerhalb des zustandsführenden Moduls genannt`,
      ).toEqual([])
    }
  })

  it('`scopeCatalogDrivers` wird von keiner Oberfläche gerufen — der Preisweg bleibt im Zustandsmodul', () => {
    const callers = filesReferencing('scopeCatalogDrivers')
    expect(callers.length).toBeGreaterThan(0)
    expect(callers.filter((file) => file.endsWith('.tsx'))).toEqual([])
  })

  it('die KG-200/500/600-Tiefe liegt statt dessen im LEBENDEN Katalog — und ist dort wirklich angekommen', () => {
    // Die Gegenprobe zur Ausnahme: der Legacy-Katalog ist unerreichbar, ALSO
    // muss die Konfigurierbarkeit woanders liegen. Läge sie nirgends, wäre
    // die Ausnahme oben eine Ausrede statt einer Begründung.
    const byGroup = new Map<KgScopeGroup, number>()
    for (const { group } of quantityServices()) {
      byGroup.set(group, (byGroup.get(group) ?? 0) + 1)
    }
    for (const group of ['KG_200', 'KG_500', 'KG_600'] as const) {
      expect(byGroup.get(group) ?? 0, `${group} hat keine einzige Mengenposition`)
        .toBeGreaterThan(0)
    }
  })
})

describe('Fläche 5 · die ruhenden KG-300-/400-Gruppen sind KEIN Sales-wählbarer Kontrollpunkt', () => {
  const DORMANT_GROUPS: OptionGroup[] = [...KG300_GROUPS, ...KG400_GROUPS]

  it('die Zertifikatsgruppen sind wirklich DISJUNKT von den ruhenden Gruppen — die Ausklammerung ist geprüft, nicht behauptet', () => {
    const zertIds = new Set(ZERT_GROUPS.map((group) => group.id))
    const overlap = DORMANT_GROUPS.filter((group) => zertIds.has(group.id)).map((g) => g.id)
    expect(overlap).toEqual([])
    expect(DORMANT_GROUPS.length).toBeGreaterThan(0)
    // Und zusammen sind es genau die Gruppen, über die `optionDrivers` läuft
    // — es gibt keine dritte, unklassifizierte Herkunft.
    expect(new Set(ALL_OPTION_GROUPS.map((g) => g.id)))
      .toEqual(new Set([...DORMANT_GROUPS, ...ZERT_GROUPS].map((g) => g.id)))
  })

  it('KEINE `.tsx`-Fläche ruft `setKg300` — das ist der STRUKTURELLE Beweis, nicht ein Kommentar', () => {
    // Der Topf `READ_ONLY_CONTEXT` ist eine Aussage über das Produkt, und
    // eine Aussage über das Produkt gehört nicht in einen Kommentar. Sie
    // wird hier aus dem Quellbaum gelesen: eine Auswahl, für die es keinen
    // Kontrollpunkt gibt, kann von Sales nicht gewählt werden.
    const callers = filesReferencing('setKg300')
    const tsxCallers = callers.filter((file) => file.endsWith('.tsx'))
    expect(tsxCallers).toEqual([])

    const strays = callers.filter((file) =>
      !SETTER_HOME_DIRECTORIES.some((entry) => file.startsWith(entry.prefix)))
    expect(strays).toEqual([])
  })

  it('die ruhenden Gruppen liegen in READ_ONLY_CONTEXT — der Topf wird BERECHNET, nicht behauptet', () => {
    // Wird der Mutator morgen von einer Oberfläche aufgerufen, liefert
    // diese Funktion `PRICED_SELECTABLE`, der Test fällt, und die Gruppen
    // müssen dieselbe Prüfung bestehen wie jede andere bepreiste Fläche.
    const bucketOfDormantGroups = (): PriceEffectBucket =>
      filesReferencing('setKg300').some((file) => file.endsWith('.tsx'))
        ? 'PRICED_SELECTABLE'
        : 'READ_ONLY_CONTEXT'
    expect(bucketOfDormantGroups()).toBe('READ_ONLY_CONTEXT')
    expect(bucketOfDormantGroups()).not.toBe('PRICED_SELECTABLE')
  })

  it('sie erfüllen den Tarif-Vertrag trotzdem — ein Erwachen wäre eine Umklassifizierung, kein Defekt', () => {
    // Bewusst geprüft, obwohl der Topf keinen Euro verlangt: solange die
    // Daten den strengeren Vertrag ohnehin halten, ist der Weg zurück in
    // die Oberfläche frei, und die Ausnahme von Fläche 5 bleibt eine
    // Aussage über die OBERFLÄCHE, nicht über die Datenqualität.
    const violations = DORMANT_GROUPS
      .filter((group) => !optionGroupDeclaresItsMoney(group))
      .map((group) => `${group.id}: ` + group.choices.map((c) => `${c.value}:${c.rate}`).join(' '))
    expect(violations).toEqual([])
  })

  it('AUSNAHMELISTE · jeder erlaubte Wohnort des Mutators trifft wirklich noch etwas', () => {
    const callers = filesReferencing('setKg300')
    // Nicht leerlaufend: findet der Scanner GAR NICHTS, dann prüft der Test
    // oben nichts — etwa weil der Mutator umbenannt wurde. Dann ist diese
    // ganze Fläche neu zu bewerten.
    expect(callers.length).toBeGreaterThan(0)
    for (const entry of SETTER_HOME_DIRECTORIES) {
      expect(
        callers.filter((file) => file.startsWith(entry.prefix)),
        `Ausnahme "${entry.prefix}" ist veraltet (${entry.reason})`,
      ).not.toEqual([])
    }
  })
})

/* ═════════════════════════════════════════════════════════════════════════
 * DIE VERBOTENE FORMULIERUNG
 * ═══════════════════════════════════════════════════════════════════════ */

const I18N_INDEX = path.join(SRC_ROOT, 'i18n', 'index.ts')

/**
 * Die Zeilen EINES Wörterbuchs, gelesen aus der Quelle.
 *
 * `de` und `en` sind absichtlich nicht exportiert, und die Frage hier ist
 * wörtlich „enthält diese Datei eine Zeile mit diesem Wert“ — dieselbe
 * Form, die `i18n/__tests__/vr3-en-completeness.test.ts` schon benutzt.
 */
function dictionaryBlock(which: 'de' | 'en'): string {
  const text = readFileSync(I18N_INDEX, 'utf8')
  const pattern = which === 'de'
    ? /^const de = \{$([\s\S]*?)^\} as const$/m
    : /^const en: Partial<Record<MessageKey, string>> = \{$([\s\S]*?)^\}$/m
  const block = text.match(pattern)
  expect(block, `das ${which}-Wörterbuch muss seine literale Deklarationsform behalten`)
    .not.toBeNull()
  return block![1]!
}

/** Die Zeilen des Namensraums `vr3.tga.price.*` in einem Wörterbuchblock. */
function priceNamespaceRows(block: string): Array<[string, string]> {
  const rows: Array<[string, string]> = []
  const row = /^\s*'(vr3\.tga\.price\.[^']+)':\s*'((?:[^'\\]|\\.)*)'/gm
  let match: RegExpExecArray | null
  while ((match = row.exec(block)) !== null) rows.push([match[1]!, match[2]!])
  return rows
}

/**
 * Die Formulierungen, die auf dieser Fläche nicht mehr existieren dürfen.
 *
 * `keine Preiswirkung` ist eine POSITIVE Behauptung: zwei Lösungen kosten
 * messbar gleich viel. Für 92,7 % der Optionszeilen der Quelle gibt es
 * überhaupt keine Kostenoption — dort ist die Aussage nicht bloß unbelegt,
 * sie ist falsch. Die kanonische Formulierung der Projektregel 16 ist
 * `Preis nicht ermittelt`.
 *
 * Bewusst NICHT geprüft werden `vr3.kg.ledger.noEffect` und
 * `vr3.rail.change.noEffect`: dort wurde eine Delta tatsächlich GERECHNET
 * und ist Null. Das ist der einzige Fall, in dem „keine Preiswirkung“ die
 * Wahrheit sagt, und diese beiden Schlüssel müssen weiter funktionieren.
 */
const RETIRED_PRICE_PHRASES = [
  { phrase: 'keine Preiswirkung', locale: 'de' as const },
  { phrase: 'no price effect', locale: 'en' as const },
]

function retiredPhraseHits(
  locale: 'de' | 'en', rows: ReadonlyArray<[string, string]>,
): string[] {
  return rows.flatMap(([key, value]) => RETIRED_PRICE_PHRASES
    .filter((entry) => entry.locale === locale && value.includes(entry.phrase))
    .map((entry) => `${locale} · ${key} = "${value}" (enthält "${entry.phrase}")`))
}

describe('die verbotene Formulierung — ein echter Kostentreiber sagt nie „keine Preiswirkung“', () => {
  it('der Namensraum `vr3.tga.price.*` ist in beiden Sprachen überhaupt lesbar', () => {
    // Ändert sich die Deklarationsform der Wörterbücher, liest der Scanner
    // einen leeren Block und BESTEHT — die schlimmste Art des Bestehens.
    expect(priceNamespaceRows(dictionaryBlock('de')).length).toBeGreaterThan(5)
    expect(priceNamespaceRows(dictionaryBlock('en')).length).toBeGreaterThan(5)
  })

  it('kein Schlüssel in `vr3.tga.price.*` trägt „keine Preiswirkung“ oder „no price effect“', () => {
    const hits = [
      ...retiredPhraseHits('de', priceNamespaceRows(dictionaryBlock('de'))),
      ...retiredPhraseHits('en', priceNamespaceRows(dictionaryBlock('en'))),
    ]
    expect(hits).toEqual([])
  })

  it('`vr3.tga.price.notDetermined` existiert in beiden Sprachen und trägt die Formulierung der Regel 16', () => {
    const de = new Map(priceNamespaceRows(dictionaryBlock('de')))
    const en = new Map(priceNamespaceRows(dictionaryBlock('en')))
    expect(de.get('vr3.tga.price.notDetermined')).toBe('Preis nicht ermittelt')
    expect(en.get('vr3.tga.price.notDetermined')).toBe('price not determined')
  })

  it('SELBSTTEST · der Scanner findet die Formulierung, wenn sie da ist', () => {
    const synthetic = [
      "  'vr3.tga.price.noEffect': 'keine Preiswirkung',",
      "  'vr3.tga.price.notDetermined': 'Preis nicht ermittelt',",
      "  'vr3.kg.ledger.noEffect': 'keine Preiswirkung',",
    ].join('\n')
    const rows = priceNamespaceRows(synthetic)
    // Nur der `vr3.tga.price.*`-Namensraum wird gelesen — die Ledger-Zeile
    // ist der legitime, GERECHNETE Nullwert und darf nicht mitgefangen werden.
    expect(rows.map(([key]) => key)).toEqual([
      'vr3.tga.price.noEffect', 'vr3.tga.price.notDetermined',
    ])
    expect(retiredPhraseHits('de', rows)).toHaveLength(1)
    // Und ohne die Formulierung schweigt der Scanner.
    expect(retiredPhraseHits('de', priceNamespaceRows(
      "  'vr3.tga.price.notDetermined': 'Preis nicht ermittelt',",
    ))).toEqual([])
  })
})
