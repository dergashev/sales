import { useStore } from '../state/store'
import { GENERATED_DE, GENERATED_EN } from './generated'

/**
 * i18n по правилу 36: тексты интерфейса — только по ключам из словарей,
 * `de` — источник и fallback. Конкатенация переводов запрещена: каждая
 * строка — целый ключ.
 *
 * Границы (D-13, D-24, LOCALE-001):
 * - язык UI ≠ язык артефактов: артефакт может быть немецким при английском
 *   интерфейсе (D-13), но текст интерфейса вокруг него обязан быть
 *   английским;
 * - **D-20 отменён решением D-24**: guidance переводится наравне с хромом.
 *   Прежняя редакция этого докстринга утверждала обратное — «EN-guidance
 *   не переводится и не выдумывается»; правило сменилось, а комментарий
 *   остался, и это ровно тот класс «документ пережил своё правило»,
 *   против которого написан реестр решений.
 *
 * Числа сюда не входят по построению: они форматируются только через
 * `formatDE`/`Intl` (правило 7/36) и в словаре не существуют.
 */

export type UiLanguage = 'de' | 'en'

const de = {
  'nav.projekte': 'Projekte',
  'nav.vorbereitung': 'Vorbereitung',
  'nav.buildingScope': 'Gebäude & Umfang',
  'nav.konfigurator': 'Konfigurator',
  'nav.vergleich': 'Variantenvergleich',
  'nav.export': 'Export',
  'nav.einstellungen': 'Einstellungen',
  'nav.grundlagen': 'Grundlagen',
  'nav.tour': 'Rundgang durch das Werkzeug',
  'shell.prototypeNote': 'Prototyp · Arithmetik echt, Parsing simuliert',
  'shell.account': 'Account',
  'shell.accountUnavailable': 'Keine verifizierte Sitzungsidentität verfügbar.',
  'shell.signOut': 'Abmelden',
  'shell.optionSwitcher': 'Opportunity Option',
  'shell.sidebar.workflow': 'Aktuelle Option',
  'shell.sidebar.outputs': 'Ausgabe',
  'shell.fontWarning': 'Visuelt Pro konnte nicht zuverlässig geladen werden. Darstellung vor der Präsentation prüfen.',
  'configurator.scope.introBinary': 'Legen Sie für jede Kostengruppe fest, ob sie im Angebot enthalten ist. Ihre Konfiguration bleibt beim Ausschließen erhalten.',
  'configurator.scope.changed': 'Der Leistungsumfang hat sich seit der letzten Bestätigung geändert.',
  'configurator.scope.confirmAndContinueHelp': 'Bestätigen Sie den Umfang und fahren Sie mit der ersten enthaltenen Kostengruppe fort.',
  'configurator.scope.continue': 'Weiter zur Konfiguration',
  'configurator.scope.confirmAndContinue': 'Umfang bestätigen und weiter',
  'configurator.scopeCatalog.currentChoice': 'aktuelle Auswahl',
  'configurator.scopeCatalog.assumption': 'Annahme — noch nicht bestätigt',
  'configurator.scopeCatalog.quantityLabel': 'Menge für diese Position',
  'configurator.scopeCatalog.guaranteeAmountLabel': 'Bürgschaftssumme',
  'configurator.scopeCatalog.footnote': '⚙ · für den Prototyp abgeleitet, nicht kalibriert. Die Preiswirkung erscheint sofort in der Angebotsspalte rechts und im Kostentreiber.',
  'configurator.scopeCatalog.kg800RevealSwitch': 'Für dieses Meeting freigeben',
  'configurator.scopeCatalog.kg800RevealHelp': 'Zeigt die Finanzierungsaufschlüsselung auch in der Kundenansicht — Standard: privat.',
  'configurator.scopeCatalog.kg800NoBasis': 'Für KG 800 liegt noch keine Berechnungsgrundlage vor — dazu muss der vorausgehende Angebotsblock (KG 100–700) einen positiven Betrag ergeben.',
  'kg700.all3UnavailableReason':
    'All3-Verfahren ist erst verfügbar, wenn KG 300 und KG 400 beide enthalten sind.',
  'shell.mode.intern': 'Intern',
  'shell.mode.praesentation': 'Präsentation',
  'shell.mode.blockedReason':
    'Zuerst mindestens ein Gebäude auswählen und jedes gewählte Gebäude bestätigen.',
  'shell.mode.legend': 'Modus',
  // VR2-01 (ACCEPT-01) · Modus-Tag im Kopf (Arbeitsmodus). Markenkurzform,
  // in beiden Sprachen gleich (wie im genehmigten Ziel).
  'shell.mode.work': 'WORK',
  'shell.profile.legend': 'Ansicht',
  'shell.profile.internal': 'Vorbereitung',
  'shell.profile.client': 'Kundenansicht',
  'shell.profile.check': 'Kundenansicht prüfen',
  'shell.profile.exit': 'Beenden',
  'shell.profile.clientIndicator': 'Kundenansicht — der Kunde sieht diesen Bildschirm',
  'shell.profile.internalIndicator': 'Vorbereitung — nur intern sichtbar',
  'shell.viewport.title': 'Bildschirm zu klein',
  'shell.viewport.body': 'Für diese Arbeitsansicht sind mindestens 1280 px Breite erforderlich.',
  'comparison.differencesHint': 'Zuerst erscheinen Unterschiede und Ergebniswerte.',
  'comparison.allHint': 'Alle Vergleichszeilen sind sichtbar.',
  'comparison.leadRate': 'Leitkennzahl',
  // ACCEPTANCE REMEDIATION (cycle 2, ACCEPT-01): approved target's decision
  // headline replaces the generic screen name as H1 — "Entscheiden, nicht
  // nur vergleichen." is the literal approved copy (TARGET-comparison-1440/
  // 1280.png), a UI framing string like any other H1, not a guidance/
  // Annahmen text and not a commercial/recommendation semantic.
  'comparison.headline': 'Entscheiden, nicht nur vergleichen.',
  // Eyebrow line above the headline (project context + Option count) —
  // moved out of PageHeader's baseline `meta` slot so it leads the first
  // viewport per the approved target, instead of trailing the title.
  'comparison.optionCountSingular': '{n} Option',
  'comparison.optionCountPlural': '{n} Optionen',
  // Explains the deliberate horizontal-overflow affordance (components.css
  // `--cmp-visible-cols`: the first three Options always fit; a fourth+
  // remains reachable by scrolling) — only shown once a fourth Option is
  // actually one scroll away, so the number is never speculative.
  'comparison.overflowHint': '{n}. Option horizontal ergänzbar',
  'shell.variant': 'Variante «Basis»',
  'shell.phase.vorbereitung': 'Vorbereitung',
  'common.undo': 'Rückgängig',
  'common.close': 'Schließen',
  'common.showOrigin': 'Herkunft anzeigen',
  'provenance.accessibleLabel': 'Herkunft: {label}',
  'provenance.accessibleLabelWithDetail': 'Herkunft: {label} · {detail}',
  'common.loading': 'Wird geladen',
  'common.fieldLoading': 'Feld wird geladen',
  'configurator.schedule.dateInvalid': 'Ungültiges Datum — Format TT.MM.JJJJ',
  'designSystem.workflowStepper.state.upcoming': 'ausstehend',
  'designSystem.workflowStepper.state.current': 'aktuell',
  'designSystem.workflowStepper.state.done': 'erledigt',
  'designSystem.workflowStepper.state.attention': 'benötigt Aufmerksamkeit',
  'designSystem.workflowStepper.state.blocked': 'blockiert',
  'designSystem.workflowStepper.state.skipped': 'übersprungen',
  'designSystem.workflowStepper.position': 'Schritt {n} von {total}',
  'designSystem.workflowStepper.why': 'Warum?',
  'common.fulfilled': 'Erfüllt',
  'common.open': 'Offen',
  'designSystem.readinessSummary': '{done} von {total} Punkten bereit',
  'oppcard.prerequisitesSummary': '{done} von {total} Voraussetzungen erfüllt',
  'oppcard.prerequisites.fulfilledStale': 'Erfüllt · nicht mehr aktuell',
  // DC-13, Screen-reader-Klausel: позиция шага — целой фразой, а не одной
  // цифрой. Ключ с параметрами, потому что правило 36 запрещает собирать
  // перевод конкатенацией.
  'oppcard.stepPosition': 'Schritt {n} von {total}',
  'oppcard.customerEvidence': 'vom Kunden bestätigt am {date}',
  'oppcard.baseline.title': 'Projektgrundlage',
  'oppcard.baseline.intro':
    'Gemeinsame Basis für alle Opportunity Options dieses Projekts.',
  'oppcard.baseline.primaryFacts': 'Zentrale Projektdaten',
  // REDESIGN R2 §3 "COMPARISON SIGNAL": OptionCard's delta caption at ≥2
  // options — `{baseline}` is the same array-order Option name
  // S4Vergleich.tsx already calls "Vergleichsbasis" (VARIANT-001).
  'option.deltaVsBaseline': 'Unterschied zu {baseline}',
  'oppcard.baseline.bgfBreakdown': 'Bruttogeschossfläche (BGF)',
  'oppcard.baseline.confirmConsequence':
    'Mit der Bestätigung wird diese Grundlage für Opportunity Options freigegeben.',
  'oppcard.baseline.confirmed': 'Bestätigt · Projektgrundlage aktuell',
  'oppcard.baseline.confirmedStale': 'Bestätigt · nicht mehr aktuell',
  'oppcard.baseline.stale':
    'Geändert seit der Bestätigung: {changes}. Die bestätigte Grundlage bleibt erhalten und muss erneut geprüft werden.',
  'oppcard.baseline.reconfirm': 'Erneut bestätigen',
  'oppcard.baseline.stepStale': 'Geändert · erneut bestätigen',
  'oppcard.baseline.preparationSummary':
    'Vorbereitung · Offene Fragen: {questions} · Aktive Annahmen: {assumptions}',
  'oppcard.baseline.bgfEquation':
    'BGF R plus BGF S ergibt BGF R+S; die NRF wird daraus abgeleitet.',
  // VR2-02 (Project remediation, cycle 7): approved target's centre-stage
  // "Projektgrundlage · Vorschau" block — a compact preview of the SAME
  // baseline data the full breakdown below already computes (`totalBgfR`,
  // `bs.length`), with a wayfinding link into that section rather than a
  // second calculation.
  'oppcard.baseline.previewEyebrow': 'Projektgrundlage · Vorschau',
  'oppcard.baseline.previewSummary': '{count} Gebäude · {bgf} m² BGF oberirdisch',
  'oppcard.baseline.previewCta': 'Grundlage ansehen',
  // VR2-02 (Project remediation, cycle 8, explicit Product directive):
  // approved target's literal centre-stage heading/subheading — passed as
  // `DocumentAnalysis`'s `heading`/`subheading` override, its registered
  // canonical name (ANALYSIS-001) stays the component's own default.
  'oppcard.evidence.heading': 'Dokumente & Evidenz',
  'oppcard.evidence.subheading':
    'Analyseergebnis, Planversion und fehlende Angaben in einer Arbeitsansicht.',
  // VR2-02 (Project remediation, cycle 9, explicit Product directive):
  // compact failed-row remedy disclosure — cause/consequence text stays
  // always visible, the two remedy CONTROLS (ANALYSIS-005) move behind
  // this trigger instead of consuming their own row in the resting state.
  'oppcard.evidence.remedyDisclosure': 'Beheben',
  // VR2-02 — Projekt-Identitätsband oben auf der Projekt-Workspace-Seite
  // (ersetzt die schmale Seitenspalte) und die Entscheidungs-zuerst-Karte,
  // die den aktuellen Schritt zusammenfasst, ohne die im Stepper verborgene
  // `<details>`-Begründung zu duplizieren.
  'oppcard.identity.eyebrow': 'Opportunity',
  'oppcard.identity.factDocuments': 'Dokumente',
  'oppcard.nextDecision.eyebrow': 'Nächste Entscheidung',
  // Acceptance remediation (cycle 4): headline names the actual topic
  // ("WFL nach WoFlV" — fixed regulatory denominator name, kept literal in
  // EN too, see i18n/index.ts's own DENOMINATOR NAMES note) instead of a
  // generic phrase; body shortened to the target's own "Folge" consequence
  // line, now that the real candidate values render above it.
  'oppcard.nextDecision.conflict.headline': 'WFL nach WoFlV',
  'oppcard.nextDecision.conflict.body':
    'Folge: Leitkennzahl ändert sich. Die Zwischensumme bleibt gleich.',
  'oppcard.nextDecision.conflict.cta': 'Konflikt entscheiden',
  'oppcard.nextDecision.baseline.headline': 'Projektgrundlage bestätigen',
  'oppcard.nextDecision.baseline.body':
    'Alle Konflikte sind entschieden. Die Bestätigung setzt das Anlegen von Opportunity Options frei.',
  'oppcard.nextDecision.baseline.cta': 'Projektgrundlage öffnen',
  'oppcard.nextDecision.options.headline': 'Opportunity Option anlegen',
  'oppcard.nextDecision.options.body':
    'Die Projektgrundlage ist bestätigt. Als Nächstes entsteht die erste Opportunity Option.',
  'oppcard.nextDecision.options.cta': 'Zu Opportunity Options',
  // QA rework (VR2-02, QA-01): distinct copy for "at least one Opportunity
  // Option already exists" — the previous single "options" copy above kept
  // claiming the first Option was still pending after Option 1 was created.
  'oppcard.nextDecision.optionsExist.headline': 'Projektentscheidungen abgeschlossen',
  'oppcard.nextDecision.optionsExist.body':
    'Alle Konflikte sind entschieden, die Projektgrundlage ist bestätigt und mindestens eine Opportunity Option ist angelegt. Weitere Arbeit findet in der jeweiligen Option statt.',
  'oppcard.nextDecision.optionsExist.cta': 'Opportunity Options öffnen',
  // Acceptance remediation (cycle 1): the near-blank "nicht ausgearbeitet"
  // explainer stayed hardcoded German even in EN mode.
  'oppcard.notWorked.explainer':
    'Diese Opportunity ist im Prototyp nicht ausgearbeitet. Vollständig durchgerechnet ist «{name}» — dort läuft die Dokumentanalyse, die Konfliktlösung und die Kalkulation mit echter Arithmetik.',
  // Acceptance remediation (cycle 1): approved target's persistent bottom
  // action dock — literal target copy for the conflict-open state.
  'oppcard.actionDock.conflict.summary': '1 Entscheidung bis zur Projektgrundlage',
  'oppcard.actionDock.conflict.cta': 'WFL-Konflikt entscheiden',
  // Acceptance remediation (cycle 4): the WorkflowStepper's rationale/state
  // strings are now ALWAYS visible (no longer behind a "Warum?" disclosure)
  // — none of these had EN coverage in the generated reverse-lookup
  // dictionary (they were never exercised in EN before, since a disclosure
  // interaction was required to see them).
  // Acceptance remediation (cycle 5): the fifth Auditor pass isolated the
  // remaining vertical gap to "long rationale paragraphs" wrapping to two
  // lines inside each step chip — the approved target's own visible
  // rationale is a single terse phrase ("1 Entscheidung erforderlich" is
  // the target's LITERAL step-2 text). Shortened to that register. No
  // information is lost from the strip as a whole: the dropped consequence
  // clauses ("blockiert die Projektgrundlage" / "blockiert das Anlegen…")
  // remain expressed by the blocked steps' own always-visible
  // blockedReason texts ("Erst Konflikte entscheiden", "Erst Konflikte
  // entscheiden und Projektparameter bestätigen") on the very same strip,
  // and in full prose inside the corresponding sections below. The
  // shell-test's exact-string assertions are updated with the same change
  // — its real invariants (exactly one current step, position as a whole
  // screen-reader phrase, state carried by text rather than colour) are
  // untouched.
  'oppcard.stage.documents.attention': '1 Dokument nicht lesbar',
  'oppcard.stage.documents.done': 'Analyse abgeschlossen',
  'oppcard.stage.conflict.open': '1 Entscheidung erforderlich',
  'oppcard.stage.conflict.done': 'Entschieden',
  'oppcard.stage.baseline.confirmed': 'Bestätigt',
  'oppcard.stage.baseline.attention': 'Bestätigung erforderlich',
  'oppcard.stage.options.done': 'Angelegt',
  'oppcard.stage.options.ready': 'Bereit zum Anlegen',
  'oppcard.stage.options.waiting': 'Wartet auf die Voraussetzungen oben',
  'oppcard.stage.options.blockedBoth': 'Erst Konflikte und Grundlage klären',
  // Acceptance remediation (cycle 4): NextDecisionCard's compact WFL value
  // labels — dedicated keys instead of reusing `tx("Dokument"/"Kunde")`,
  // which resolved to the WRONG (lowercase, different-context) EN string
  // via the generated reverse lookup (`s2.data.origin.document/customer`
  // → "document"/"client", meant for an inline sentence elsewhere).
  'oppcard.nextDecision.conflict.document': 'Dokument',
  'oppcard.nextDecision.conflict.customer': 'Kunde',
  // Acceptance remediation (cycle 5): the approved target's decision rail
  // shows recommendation context directly below the WFL card ("Empfehlung"
  // + the GK status line + a "Klassifikation prüfen" link) — summary text
  // is the target's own literal wording, the full canonical fallback-rule
  // prose stays untouched in "Offene Fragen & Annahmen" below.
  'oppcard.rail.recommendation.title': 'Empfehlung',
  'oppcard.rail.recommendation.gkSummary':
    'Gebäudeklasse noch nicht bestätigt. Vorläufig GK 5 · Prüfung erforderlich.',
  'oppcard.rail.recommendation.cta': 'Klassifikation prüfen',
  'buildingScope.gate.navigationReason':
    'Zuerst jede gewählte Gebäudegrundlage bestätigen und den Gebäudeumfang speichern.',
  'buildingScope.title': 'Gebäude & Umfang',
  'buildingScope.meta':
    'Vor dem Konfigurator · {confirmed} von {selected} gewählten Gebäuden bestätigt',
  'buildingScope.lede':
    'Legen Sie den Angebotsumfang fest und prüfen Sie die Gebäudedaten, bevor die Konfiguration und Kalkulation beginnen.',
  'buildingScope.selection.title': 'Gebäude im Angebot',
  'buildingScope.selection.intro':
    'Wählen Sie alle Gebäude, die Bestandteil dieser Option sein sollen. Abgewählte Gebäude behalten ihre Angaben.',
  'buildingScope.selection.dataLabel': 'Gefundene Gebäude',
  'buildingScope.selection.manageOpen': 'Gebäude verwalten',
  'buildingScope.selection.manageClose': 'Verwaltung schließen',
  'buildingScope.review.title': 'Gebäudedaten prüfen',
  'buildingScope.review.intro':
    'Prüfen und bestätigen Sie jedes gewählte Gebäude einzeln. Unbekannte optionale Angaben bleiben ausdrücklich sichtbar.',
  'buildingScope.review.empty':
    'Noch kein Gebäude ausgewählt. Wählen Sie oben mindestens ein Gebäude für diese Option aus.',
  'buildingScope.fact.name': 'Bezeichnung aus der Dokumentation',
  'buildingScope.fact.address': 'Adresse',
  'buildingScope.fact.form': 'Gebäudeform',
  'buildingScope.fact.class': 'Gebäudeklasse nach MBO §2',
  'buildingScope.fact.bgfRAbove': 'BGF R · oberirdisch',
  'buildingScope.fact.bgfSAbove': 'BGF S · oberirdisch',
  'buildingScope.fact.bgfRSAbove': 'BGF R+S · oberirdisch',
  'buildingScope.fact.bgfRBelow': 'BGF R · unterirdisch',
  'buildingScope.fact.bgfSBelow': 'BGF S · unterirdisch',
  'buildingScope.fact.bgfRSBelow': 'BGF R+S · unterirdisch',
  'buildingScope.fact.bgfRSTotal': 'BGF R+S · gesamt',
  'buildingScope.fact.wfl': 'WFL nach WoFlV',
  'buildingScope.fact.nuf': 'NUF nach DIN 277',
  'buildingScope.fact.units': 'Einheiten',
  // #16 Part 8: single user-facing storey count, no more UG/EG/OG/SG
  // breakdown — value updated in place, key kept stable (used as the
  // `DecimalFactField` label + aria-label suffix + conflict heading).
  'buildingScope.fact.storeys': 'Anzahl Geschosse',
  // F21: "○ " marks a missing value as visually distinct from a populated
  // one (rule 8 — not by colour alone); it reuses the same hollow-circle
  // glyph the product already uses for "blocked/not-selectable" elsewhere
  // (ReadinessOverview, the empty-account state).
  'buildingScope.value.notCaptured': '○ Nicht erfasst',
  'buildingScope.value.addressMissing': 'Adresse nicht erfasst',
  'buildingScope.value.formMissing': 'Gebäudeform nicht erfasst',
  'buildingScope.value.classMissing': 'Gebäudeklasse nicht erfasst',
  'buildingScope.value.storeysMissing': 'Geschossstruktur nicht erfasst',
  'buildingScope.value.conflictOpen':
    'Konflikt offen — wählen Sie unten eine belastbare Angabe.',
  'buildingScope.form.mfh': 'Mehrfamilienhaus',
  'buildingScope.form.efh': 'Ein-/Zweifamilienhaus',
  'buildingScope.form.row': 'Doppel-/Reihenhaus',
  'buildingScope.form.office': 'Bürogebäude',
  'buildingScope.class.gk13': 'GK 1–3',
  'buildingScope.class.gk4': 'GK 4',
  'buildingScope.class.gk5': 'GK 5',
  'buildingScope.class.helper':
    'Die Gebäudebestätigung umfasst auch die angezeigte Einstufung nach MBO §2.',
  'buildingScope.provenance.document': 'Dokument',
  'buildingScope.provenance.derived': 'Abgeleitet',
  'buildingScope.provenance.customer': 'Vom Kunden bestätigt',
  'buildingScope.provenance.manual': 'Manuell bearbeitet',
  'buildingScope.status.confirmed': 'Bestätigt',
  'buildingScope.status.conflict': 'Konflikt offen',
  'buildingScope.status.conflictResolved': 'Konflikt gelöst',
  'buildingScope.status.open': 'Noch nicht bestätigt',
  'buildingScope.announcement.added': '{building} zum Angebot hinzugefügt.',
  'buildingScope.announcement.removed': '{building} aus dem Angebot entfernt.',
  'buildingScope.announcement.confirmed': '{building} bestätigt.',
  'buildingScope.announcement.invalidated':
    'Bestätigung aufgehoben – Angaben geändert: {building}.',
  'buildingScope.recovery.title':
    'Konfigurationsbestätigung aufgehoben: {buildings}.',
  'buildingScope.recovery.detail':
    'Die betroffenen Gebäudedaten sind nicht mehr bestätigt. Andere gültige Konfigurationsarbeit bleibt gespeichert.',
  'buildingScope.recovery.remedy':
    'Angaben prüfen und das Gebäude erneut bestätigen. Danach die betroffene Konfiguration erneut bestätigen.',
  'buildingScope.tabs.label': 'Gewählte Gebäude',
  'buildingScope.tabs.first': 'Zum ersten Gebäude-Tab',
  'buildingScope.tabs.last': 'Zum letzten Gebäude-Tab',
  'buildingScope.tabs.current': 'Wird gerade geprüft',
  'buildingScope.readiness.primaryAction': 'Primäre Aktion',
  'buildingScope.group.identity': 'Identität & Nutzung',
  'buildingScope.group.above': 'Flächen oberirdisch',
  'buildingScope.group.below': 'Flächen unterirdisch',
  'buildingScope.group.total': 'Flächen',
  'buildingScope.group.storeys': 'Geometrie & Geschosse',
  'buildingScope.headline.one': 'Ein Gebäude. Eine klare Grundlage.',
  'buildingScope.headline.two': 'Zwei Gebäude. Eine klare Grundlage.',
  'buildingScope.headline.three': 'Drei Gebäude. Eine klare Grundlage.',
  'buildingScope.headline.many': '{count} Gebäude. Eine klare Grundlage.',
  'buildingScope.areas.above': 'Flächen oberirdisch',
  'buildingScope.areas.below': 'Flächen unterirdisch',
  'buildingScope.areas.totals': 'Summen und Nutzflächen',
  'buildingScope.sectionStatus.notReviewed': 'Noch nicht geprüft',
  'buildingScope.sectionStatus.needsAttention': 'Handlungsbedarf',
  'buildingScope.sectionStatus.ready': 'Bereit zur Bestätigung',
  'buildingScope.sectionStatus.confirmed': 'Bestätigt',
  'buildingScope.sectionStatus.changed': 'Geändert · erneut bestätigen',
  'buildingScope.group.decisions': 'Entscheidungen',
  'buildingScope.conflicts.none': 'Keine Konflikte für die angezeigten Angaben.',
  'buildingScope.conflicts.open':
    'Die Angaben widersprechen sich. Wählen Sie vor der Bestätigung eine belastbare Quelle.',
  'buildingScope.conflicts.resolved':
    'Konflikt gelöst. Die nicht gewählte Angabe bleibt nachvollziehbar.',
  'buildingScope.conflicts.authoritative': 'Für dieses Angebot übernommen',
  'buildingScope.conflicts.choose': 'Diese Angabe übernehmen',
  'buildingScope.confirm.section': 'Gebäude bestätigen',
  'buildingScope.confirm.missingWarning':
    '{count} optionale Angaben sind nicht erfasst. Sie bleiben als Hinweis sichtbar und verhindern die Bestätigung nicht.',
  'buildingScope.confirm.confirmed': 'Gebäude bestätigt',
  'buildingScope.confirm.includesClass':
    'Die Bestätigung gilt für alle angezeigten Angaben einschließlich der Gebäudeklasse nach MBO §2.',
  // F-36: "1 offene Konflikte" was a grammar mistake (adjective/noun agree
  // in the singular too) — a dedicated singular phrase, not a `{count}` word
  // swap, since German declension changes more than the noun's ending.
  'buildingScope.confirm.conflictReasonOne':
    'Zuerst 1 offenen Konflikt für dieses Gebäude entscheiden.',
  'buildingScope.confirm.conflictReason':
    'Zuerst {count} offene Konflikte für dieses Gebäude entscheiden.',
  'buildingScope.confirm.sectionsReason':
    'Erst die markierten Abschnitte prüfen — sie benötigen noch eine Angabe oder eine Entscheidung.',
  'buildingScope.confirm.action': 'Gebäude bestätigen',
  'buildingScope.action.apply': 'Angabe übernehmen',
  'buildingScope.action.reset': 'Auf Quellenwert zurücksetzen',
  'buildingScope.action.editSection': 'Abschnitt bearbeiten',
  'buildingScope.action.doneEditingSection': 'Fertig',
  'buildingScope.validation.textRequired':
    'Eine leere Angabe wird nicht übernommen. Der bisherige Wert bleibt erhalten.',
  'buildingScope.validation.number': 'Nur Zahlen eingeben — nicht übernommen.',
  'buildingScope.validation.positive':
    'Der Wert muss größer als null sein — nicht übernommen.',
  'buildingScope.validation.integer': 'Nur ganze Einheiten eingeben — nicht übernommen.',
  'buildingScope.readiness.title': 'Bereit für den Konfigurator?',
  'buildingScope.readiness.selection': 'Mindestens ein Gebäude ausgewählt',
  'buildingScope.readiness.selectedCount': '{count} Gebäude ausgewählt',
  'buildingScope.readiness.selectionMissing': 'Mindestens ein Gebäude auswählen.',
  'buildingScope.readiness.conflictOpen': 'Konflikt entscheiden und Gebäude bestätigen',
  'buildingScope.readiness.openConfigurator': 'Konfigurator öffnen',
  'buildingScope.readiness.reviewNext': 'Nächstes offenes Gebäude prüfen',
  'buildingScope.readiness.pricingNotStarted': 'Kalkulation noch nicht gestartet',
  'buildingScope.readiness.pricingExplanation':
    'Die nächsten Schritte werden nach der Gebäudebestätigung im Konfigurator freigeschaltet.',
  'buildingScope.clientGate.hidden':
    'Interne Bearbeitungshinweise und Quellenreferenzen werden in der Kundenansicht ausgeblendet.',
  'configurator.mode.title': 'Konfigurationsmodus wählen',
  'configurator.mode.meta': 'Vor dem ersten Schritt · {count} Gebäude bestätigt',
  'configurator.mode.lede':
    'Legen Sie fest, ob die Anforderungen gemeinsam oder je Gebäude bearbeitet werden.',
  'configurator.mode.legend': 'Konfigurationsmodus',
  'configurator.mode.shared.title': 'Gemeinsam konfigurieren',
  'configurator.mode.shared.description':
    'Anforderungen einmal für alle ausgewählten Gebäude erfassen. Gebäudedaten, Mengen und Kosten bleiben getrennt.',
  'configurator.mode.shared.consequence': '1 Durchlauf · {buildings}',
  'configurator.mode.perBuilding.title': 'Je Gebäude konfigurieren',
  'configurator.mode.perBuilding.description':
    'Anforderungen für jedes Gebäude separat erfassen. Änderungen bleiben auf das gewählte Gebäude begrenzt.',
  'configurator.mode.perBuilding.consequence': '{count} Durchläufe · Reihenfolge frei',
  'configurator.mode.perBuilding.consequenceOne': '1 Durchlauf · Reihenfolge frei',
  'configurator.mode.oneBuildingHint':
    'Bei einem Gebäude führen beide Modi aktuell zu einem Durchlauf. Die Wahl bleibt erhalten, wenn später ein weiteres Gebäude hinzukommt.',
  'configurator.mode.start': 'Konfiguration starten',
  'configurator.mode.startReason': 'Zuerst einen Konfigurationsmodus auswählen.',
  'configurator.mode.back': 'Zurück zu Gebäude & Umfang',
  'configurator.mode.currentShared': 'Gemeinsame Konfiguration · gilt für {buildings}',
  'configurator.mode.currentPerBuilding': 'Konfiguration je Gebäude',
  'configurator.mode.retained': 'Die Auswahl des jeweils anderen Modus bleibt gespeichert.',
  'configurator.mode.edit': 'Modus ändern',
  'configurator.mode.clientBlocked':
    'Den Konfigurationsmodus zuerst in der Vorbereitung festlegen.',
  'configurator.scope.legend': 'Konfigurationsumfang',
  'configurator.scope.selectLabel': 'Konfigurationsumfang auswählen',
  'configurator.scope.first': 'Zum ersten Konfigurationsumfang',
  'configurator.scope.last': 'Zum letzten Konfigurationsumfang',
  'pricing.total.buildingScope': 'Gesamt netto · Grundleistung All3 · {building}',
  'configurator.scope.total': 'Gesamt · {confirmed} von {total} bestätigt',
  'configurator.scope.building': '{building} · {status}',
  'configurator.scope.project': 'Gilt für den gesamten Komplex',
  'configurator.scope.shared': 'Gemeinsame Konfiguration · gilt für {buildings}',
  'configurator.scopeBoundaries.goTo':
    'Zu Kapitel {chapter} · Leistungsabgrenzung',
  'configurator.scopeBoundaries.servicingIntro':
    'Erschließung gehört zu KG 200 — die Entscheidung über den Umfang fällt in Kapitel {chapter}, hier steht ihr Stand.',
  'configurator.scopeBoundaries.servicingStatus':
    'Erschließung · KG 200 im Angebot: {status}',
  'configurator.scopeBoundaries.assumptionAction':
    'Entscheidung im Konfigurator · «{chapterName}»',
  'configurator.energy.goTo':
    'Zu «{chapterName}»',
  'configurator.returnBuildingScope': 'Zu Gebäude & Umfang',
  'configurator.scope.single': 'Konfiguration für {building} · {status}',
  'configurator.scope.announcement': '{scope} ausgewählt. Status: {status}.',
  'configurator.status.open': 'Unvollständig',
  'configurator.status.ready': 'Bereit zum Bestätigen',
  'configurator.status.confirmed': 'Bestätigt',
  'configurator.status.recheck': 'Erneut prüfen',
  'configurator.status.openDetail':
    'Diese Gebäudeschritte vollständig durchgehen: {steps}.',
  'configurator.status.readyDetail':
    'Alle erforderlichen Gebäudeschritte wurden durchgegangen. Die Konfiguration kann bestätigt werden.',
  'configurator.status.confirmedDetail': 'Die sichtbare Konfiguration ist bestätigt.',
  'configurator.status.recheckDetail':
    'Gebäudeangaben oder Konfigurationswerte haben sich geändert. Vor der Bestätigung erneut prüfen.',
  'configurator.status.confirmBuilding': 'Konfiguration für {building} bestätigen',
  'configurator.status.confirmShared': 'Gemeinsame Konfiguration bestätigen',
  'configurator.areas.title': 'Flächen · {building}',
  'configurator.areas.unavailable':
    '{field} ist für {building} noch nicht belastbar verfügbar.',
  'configurator.areas.remedy':
    'Die Angabe für {building} in Gebäude & Umfang prüfen oder ergänzen.',
  'configurator.areas.review': 'In Gebäude & Umfang prüfen',
  'configurator.areas.goTo': 'Zu «{chapterName}»',
  'configurator.underground.title': 'Untergeschoss · {building}',
  'configurator.underground.decidedIn':
    'Entschieden in Flächen im Detail — hier nur zur Einordnung sichtbar.',
  'configurator.schedule.completionOwner':
    'Fertigstellung bestimmt durch {building}.',
  'configurator.hint.dismiss': 'Verstanden',
  'configurator.mode.readiness.preserved': 'Kalkulation vorhanden',
  'configurator.mode.readiness.preservedBody':
    'Die bestehende Konfiguration bleibt erhalten und wird nach der Bestätigung des Modus fortgesetzt.',
  'configurator.finalGate.label': 'Konfiguration noch nicht vollständig bestätigt',
  'configurator.finalGate.scopeBoundariesOutstanding':
    'Die Leistungsabgrenzung ist noch nicht bestätigt.',
  'configurator.finalGate.buildingsOutstanding': 'Noch zu bestätigen: {buildings}.',
  'configurator.finalGate.action': 'Jetzt bestätigen',
  'configurator.finalGate.exportBlockedReason':
    'Export ist gesperrt, bis die Konfiguration vollständig bestätigt ist.',
  'offerPanel.empty.sentence': 'Noch keine Kostengruppe im Angebot enthalten.',
  'offerPanel.empty.detail':
    'Legen Sie in der Leistungsabgrenzung mindestens eine Kostengruppe fest, um eine Kalkulation zu erhalten.',
  'offerPanel.empty.action': 'Leistungsabgrenzung öffnen',
  'configurator.scope.emptyDetail':
    'Wählen Sie oben mindestens eine Kostengruppe, um eine Kalkulation zu erhalten.',
  'configurator.overview.title': 'Konfigurationsstand',
  'configurator.overview.label': 'Konfigurationsstand aller Gebäude',
  'configurator.sidebar.title': 'Vor der Kalkulation',
  'configurator.sidebar.body':
    'Die Kalkulation beginnt erst in der Leistungsabgrenzung. Die Moduswahl allein erzeugt noch keinen Preis.',
  'journal.empty': 'Journal: noch keine übernommenen Änderungen',
  // F-38: Building & Scope has no Option yet, so there is no "seit
  // Erstellung der Option" reference point — a plain event count instead.
  'journal.buildingScope.summaryOne': 'Journal: 1 Ereignis in der Vorbereitung',
  'journal.buildingScope.summary': 'Journal: {count} Ereignisse in der Vorbereitung',
  'shell.en.draftActive': 'EN: Entwurf — Übersetzung noch nicht vollständig',
  'shell.en.draftHint': 'EN ist noch ein Entwurf: die Übersetzung wird gerade vervollständigt',
  // Подпись сегмента языка — такой же текст интерфейса, как и рядом стоявший
  // (и Design Review UX-PC-01 снятый) тег. Целым ключом, а не «EN · » +
  // перевод: правило 36 запрещает собирать перевод конкатенацией, а сырой
  // литерал оставлял немецкое «Entwurf» на английском пути.
  'shell.en.draftOption': 'EN · Entwurf',
  // Opportunities-Root-Shell (TASK 02): Titel geht jetzt durch einen echten
  // Schlüssel statt eines literalen JSX-Strings (Rule 36/DC-45), und das
  // Ergebnis-Resümee ersetzt die frühere, sachlich falsche Behauptung
  // „sortiert nach Reihenfolge der Übergabe aus HubSpot" — kein Ranking ist
  // hinterlegt, also wird keins behauptet (genehmigter Decision Brief,
  // Backlog 161c0b7b).
  'opplist.title': 'Opportunities',
  // VR2-01 · editorial portfolio header (VO-T1). „mit Termin" zählt nur
  // Zeilen mit hinterlegtem `meetingAt` — kein Datumsfenster behauptet
  // (`meetingAt` ist Freitext, kein echtes Datum, keine Dringlichkeit,
  // genehmigter Decision Brief 161c0b7b).
  'opplist.eyebrow': 'Portfolio',
  'opplist.portfolioSummary': '{projects} Projekte · {termine} mit Termin',
  'opplist.resultSummary.total': '{count} Opportunities',
  'opplist.resultSummary.filtered': '{shown} von {total} Opportunities',
  // TASK 04 (backlog `e2337966`): echte Wörterbucheinträge statt der
  // tx()-Brücke, die nur gegen den generierten Codex-Korpus rückwärts
  // sucht und bei neuen, nirgends sonst vorkommenden Wörtern schweigend
  // unübersetzt bleibt (live reproduziert: „versendet" blieb im EN-Modus
  // deutsch, siehe Docstring von OpportunityList).
  'opplist.sort.legend': 'Sortierung',
  'opplist.sort.recommended': 'Empfohlen',
  'opplist.sort.name': 'Name',
  'opplist.sort.status': 'Status',
  'opplist.filter.status.label': 'Lifecycle-Status',
  'opplist.filter.actionableOnly.label': 'Nur aktionsfähige zeigen',
  'opplist.filter.includeExcluded.label': 'Pausiert, signiert, verloren einschließen',
  'opplist.filter.country.chip': 'Land: {value}',
  'opplist.filter.city.chip': 'Stadt: {value}',
  'opplist.filter.owner.chip': 'Owner: {value}',
  'opplist.filter.status.chip': 'Status: {value}',
  // VR2-01 · Termin-Präsenzfilter (kein Datums-Ranking, Contract 161c0b7b).
  'opplist.filter.termin.label': 'Termin',
  'opplist.filter.termin.all': 'alle Termine',
  'opplist.filter.termin.mit': 'mit Termin',
  'opplist.filter.termin.ohne': 'ohne Termin',
  'opplist.filter.termin.chip': 'Termin: {value}',
  'opplist.filter.actionableOnly.chip': 'Nur aktionsfähige',
  'opplist.filter.includeExcluded.chip': 'Inkl. pausiert/signiert/verloren',
  'opplist.filter.search.chip': 'Suche: {value}',
  'opplist.emptyAccount.sentence': 'Es sind noch keine Opportunities vorhanden.',
  'opplist.emptyAccount.detail':
    'Neue Opportunities erscheinen hier automatisch, sobald sie aus HubSpot übernommen werden.',
  // F-39: `documentsLabel` is genuinely plural in German too ("1 Dokumente"
  // was wrong) — DE needs the same singular/plural split as EN, even though
  // "Gebäude" itself happens to be invariant.
  'opplist.card.buildingLabel': 'Gebäude',
  'opplist.card.buildingsLabel': 'Gebäude',
  'opplist.card.documentLabel': 'Dokument',
  'opplist.card.documentsLabel': 'Dokumente',
  'opplist.media.identityGraphic': 'Projektidentität · keine Aufnahme',
  // VR2-01 (header/media hierarchy rework): the fallback identity graphic
  // carried zero project-specific information — every card showed the same
  // generic building icon with no caption, so nothing distinguished one
  // project's "no photo" card from another's (approved target names the
  // project directly on/under the fallback art). `MediaFrame`'s own
  // `fallbackLabel` prop already exists for exactly this; OpportunityList
  // was simply not passing it.
  'opplist.media.fallbackCaption': 'Projektidentität · {name}',
  // VR2-01 (Acceptance remediation, cycle 3): credit lines for the three
  // opportunities the approved VO-T1 target names as photographed —
  // matches the target's own credit-chip wording (target-source.html),
  // adapted to MediaFrame's canonical below-frame caption placement.
  'opplist.media.credit.nordfeld': 'Projektbild · Nordfeld',
  'opplist.media.credit.westpark': 'Ansicht Hof · Musterhöfe',
  'opplist.media.credit.seeblick': 'Projektvisualisierung · Seeblick',
  'opplist.media.photoAlt': 'Zwei Mehrfamilienhäuser mit Holz- und Klinkerfassade an einem gemeinsamen Hof',
  // Kanonisches Label je HubSpot-Lifecycle-Stadium (STAGE_LABEL_KEY in
  // OpportunityList) — ersetzt `tx(o.stage)` für den Status-Tag, das
  // Status-Select und den Status-Filter-Chip. `ruhend`/`gewonnen`/
  // `verloren` haben noch keine Fixture-Zeile (Data-Model-Lücke,
  // Decision Brief `161c0b7b` §13), sind aber vorwärtskompatibel benannt.
  'opplist.stage.neuAusHubspot': 'neu aus HubSpot',
  'opplist.stage.inVorbereitung': 'in Vorbereitung',
  'opplist.stage.versendet': 'versendet',
  'opplist.stage.ruhend': 'ruhend',
  'opplist.stage.gewonnen': 'gewonnen',
  'opplist.stage.verloren': 'verloren',
  // Task 05 rework (QA AC-2, live EN walkthrough): these short UI strings
  // have no Codex delivery covering their exact text, so `tx()`'s reverse
  // lookup against the generated dictionary always fell through to raw
  // German. Hand-authored here, following the same convention as the rest
  // of this dictionary, instead of hand-editing the generated file.
  'configurator.scope.confirmHeading': 'Leistungsabgrenzung bestätigen',
  'configurator.scope.recheckTag': 'Leistungsabgrenzung erneut prüfen',
  'configurator.scope.confirmedTag': 'Leistungsabgrenzung bestätigt.',
  'chapter.scopeBoundaries': 'Leistungsabgrenzung',
  'chapter.kg200Details': 'Vorbereitende Maßnahmen KG 200',
  'chapter.kg300Details': 'Leistungen KG 300',
  'chapter.kg400Details': 'Technik KG 400',
  'chapter.kg500Details': 'Außenanlagen KG 500',
  'chapter.kg600Details': 'Ausstattung KG 600',
  'chapter.energyCertification': 'Energie & Zertifikate',
  'chapter.areas': 'Flächen im Detail',
  'chapter.kg700Details': 'Baunebenkosten KG 700',
  'chapter.kg800Details': 'Finanzierung KG 800',
  'chapter.commercialSchedule': 'Termine',
  'costGroup.KG_100': 'Grundstück',
  'costGroup.KG_200': 'Vorbereitende Maßnahmen',
  'costGroup.KG_300': 'Baukonstruktion',
  'costGroup.KG_400': 'Technische Anlagen',
  'costGroup.KG_500': 'Außenanlagen',
  'costGroup.KG_600': 'Ausstattung',
  'costGroup.KG_700': 'Baunebenkosten',
  'costGroup.KG_800': 'Finanzierung',
  // SIDEBAR 03 FOLLOW-UP (backlog 5ec7e9cf, AC-2): the KG 300 subgroup
  // labels are engine-sourced strings (`src/engine/risk.ts` KG300_SUBGROUPS,
  // fixture `derived-prototype.json` kg300Split.shares) rendered directly
  // at OfferPanel.tsx with no translation lookup — 8 fixed, stable ids,
  // never building-prefixed (`splitKg300()` is a static structural split,
  // not a per-building Driver), so a direct key→label dictionary is enough;
  // no `withoutBuildingPrefix()` needed, unlike `translatedDriverLabel`.
  'kg300Subgroup.KG_310': 'Baugrube · Erdbau',
  'kg300Subgroup.KG_320': 'Gründung · Unterbau',
  'kg300Subgroup.KG_330': 'Außenwände · Vertikale Baukonstruktionen',
  'kg300Subgroup.KG_340': 'Innenwände · Vertikale Baukonstruktionen',
  'kg300Subgroup.KG_350': 'Decken · Horizontale Baukonstruktionen',
  'kg300Subgroup.KG_360': 'Dächer',
  'kg300Subgroup.KG_370': 'Infrastrukturanlagen · Einbauten',
  'kg300Subgroup.KG_390': 'Sonstige Maßnahmen für Baukonstruktionen',
  'offerPanel.journal.priceChangePrefix': 'Preisänderung seit Erstellung der Option:',
  'offerPanel.journal.changeSingular': 'übernommene Änderung',
  'offerPanel.journal.changePlural': 'übernommene Änderungen',
  'driver.baseServiceSpecialAreas': 'Grundleistung · überdeckte Sonderflächen',
  'driver.fireResistanceEnclosure': 'Feuerwiderstand und Kapselung',
  'driver.basementShellAndFitOut': 'Untergeschoss · Rohbau und Ausbau',
  'driver.basementFitOutOnly': 'Untergeschoss · nur Ausbau',
  'driver.undergroundGarage': 'Tiefgarage · Lüftung, OS-Beschichtung, Tore',
  'configurator.scopeBoundaries.title': 'Leistungsumfang nach DIN 276',
  'configurator.basement.title': 'Untergeschoss',
  'configurator.energy.title': 'Energiestandard',
  'configurator.schedule.title': 'Bauzeit',
  'configurator.confirmConfig.title': 'Konfiguration bestätigen',
  'configurator.kg700.calcMethod.title': 'Berechnungsart',
  'configurator.workstage.primaryDecisions': 'Primäre Entscheidungen',
  'configurator.workstage.secondaryDecisions': 'Weitere Entscheidungen',
  'configurator.workstage.showAllDecisions': 'Alle {count} anzeigen',
  'configurator.workstage.selectionImpact': 'Auswirkung der aktuellen Auswahl',
  'configurator.workstage.buildingContext': 'Gebäudekontext',
  'configurator.workstage.currentKg300': 'KG 300 aktuell',
  'configurator.kg700.methodQuestion': 'Wie werden die Baunebenkosten ausgewiesen?',
  'configurator.kg700.wholeComplex': 'Gesamter Komplex',
  'configurator.kg700.impact': 'Auswirkung',
  'configurator.kg700.decisionSet': 'Berechnungsart gewählt',
  'configurator.kg700.decisionSetDetail': 'Die aktuelle Berechnungsart ist festgelegt. Das nächste Kapitel ist erreichbar.',
  'configurator.kg700.clientRepresentation': 'Kundendarstellung',
  'configurator.kg700.included': 'enthalten',
  'configurator.kg800.breakdown.title': 'Aufschlüsselung KG 800',
  'configurator.groundAccess.title': 'Baugrund & Zufahrt',
  // Task 05 rework cycle 3 (QA AC-2, offer rail): the "noch offen" variant
  // of the KG 300/400 excluded-adjustment driver row has no Codex delivery
  // covering its exact text (only the "ausgeschlossen" variant does, via
  // domain5.driver.kg300Excluded/kg400Excluded) — hand-authored here rather
  // than in generated.ts for the same reason as the block above. The
  // "Kostengruppen nach DIN 276" region heading and the "Ausgeschlossen"
  // driver-list heading also have no exact Codex match (only longer
  // suffixed variants exist), so both move from tx()'s silent-miss reverse
  // lookup to a real dictionary key.
  'driver.kg300Unresolved': 'KG 300 · Baukonstruktionen (noch offen)',
  'driver.kg400Unresolved': 'KG 400 · Technische Anlagen (noch offen)',
  'offer.costGroups.regionHeading': 'Kostengruppen nach DIN 276',
  'offer.drivers.excludedHeading': 'Ausgeschlossen',
  // SIDEBAR 02 (backlog 41b8ab39): scope must be a first-class, always-first
  // fact in the rail (SB-09/SB-10), separate from the amount's own
  // commercial name (`p.result.totalLabel`, unchanged) — see OfferPanel.tsx.
  'offerPanel.scope.wholeComplex': 'Gesamt · gesamter Komplex',
  'offerPanel.scope.offerTotalLabel': 'Angebot gesamt',
  // AC-3: completeness line, derived from `s.coverage` +
  // `p.result.incompleteReasons` — no engine change, only a new read of
  // already-existing data (see OfferPanel.tsx).
  'offerPanel.completeness.line':
    '{decided} von {total} Kostengruppen entschieden · {priced} kalkuliert · {unpriced} ohne Preisansatz',
  // SB-25/AC-10: non-colour-only transient marker on a row whose amount
  // changed after the last decision, including cascaded rows.
  'offer.drivers.changedMarker': 'geändert',
  // SB-26/AC-11: appended to the delta chip only when its total movement
  // differs from a single row's own contribution (a cascade occurred).
  'offer.delta.totalQualifier': 'insgesamt',
  // SB-32/AC-12: extends the KG table's existing rounding note to also name
  // the percentage column's independent rounding (replaces the literal
  // `tx()` call on the shorter Codex-delivered sentence, same reason
  // `driver.kg300Unresolved` etc. above moved to a real dictionary key).
  'offer.kgTable.roundingNote':
    'Zeilen und Prozentanteile werden unabhängig gerundet; die Prüfung läuft über exakte Werte.',
  // SB-08/AC-2: `{label}` is always `tx(p.result.totalLabel)` — the exact
  // same translated string as the hero and the KG total row, never a
  // second hardcoded commercial claim (replaces a literal `tx()` call on a
  // fixed "…Zwischensumme der kalkulierten Positionen" sentence that could
  // never read "Gesamt netto" even when coverage was complete).
  'offer.drivers.reconciliationCaption':
    'Kostentreiber: Beiträge summieren sich exakt zur {label}.',
  // VR3-03: an Option whose six scope decisions are all still open has no
  // contribution yet. An empty table is not "no cost drivers exist" — it is
  // "no decision has produced one", and the row has to say which.
  'offer.drivers.noneYet':
    'Noch kein Kostentreiber: die Leistungsabgrenzung ist noch offen.',
  /* ── VR3-03 · unified Konfigurator (T-018–T-028) ──────────────────── */
  'vr3.kg.ledger.stageMeta':
    'Konfigurator · Schritt 1',
  'vr3.kg.ledger.lede':
    'Treffen Sie für jede DIN-276-Kostengruppe eine ausdrückliche Entscheidung. „Noch offen“ ist nicht dasselbe wie bewusst ausgeschlossen.',
  'vr3.kg.ledger.caption':
    'Leistungsabgrenzung: sechs Kostengruppen, je eine ausdrückliche Entscheidung.',
  'vr3.kg.ledger.column.group':
    'Kostengruppe',
  'vr3.kg.ledger.column.decision':
    'Entscheidung',
  'vr3.kg.ledger.column.summary':
    'Bedeutung für den Umfang',
  'vr3.kg.ledger.column.downstream':
    'Folge',
  'vr3.kg.ledger.include':
    'enthalten',
  'vr3.kg.ledger.noEffect':
    'ohne Preiswirkung',
  'vr3.kg.ledger.exclude':
    'nicht enthalten',
  'vr3.kg.ledger.decisionLegend':
    'Entscheidung {group} {meaning}',
  'vr3.kg.ledger.progress':
    '{decided} von {total} entschieden',
  'vr3.kg.ledger.summary.included':
    'Im Angebotsumfang',
  'vr3.kg.ledger.summary.excluded':
    'Bewusst ausgeschlossen',
  'vr3.kg.ledger.summary.undecided':
    'Noch offen',
  'vr3.kg.ledger.downstream.configure':
    'Konfiguration erforderlich',
  'vr3.kg.ledger.downstream.skipped':
    'Nicht im Umfang · übersprungen',
  'vr3.kg.ledger.downstream.required':
    'Entscheidung erforderlich',
  'vr3.kg.ledger.footerIncomplete':
    'Die Konfiguration der Kostengruppen bleibt gesperrt, bis alle sechs Entscheidungen ausdrücklich getroffen sind.',
  'vr3.kg.ledger.footerComplete':
    'Jede Kostengruppe hat ein bewusstes Ergebnis. Die enthaltenen Gruppen können jetzt konfiguriert werden.',
  'vr3.kg.ledger.confirm':
    'Umfang bestätigen und weiter',
  'vr3.kg.ledger.blockedReason':
    'Noch {open} von {total} Kostengruppen ohne Entscheidung.',
  'vr3.kg.ledger.announceComplete':
    'Alle sechs Kostengruppen sind entschieden. Die erste enthaltene Kostengruppe ist verfügbar.',
  'vr3.kg.ledger.recheck':
    'Erneut bestätigen',
  'vr3.kg.ledger.recheckReason':
    'Der Umfang hat sich seit der letzten Bestätigung geändert.',
  'vr3.kg.page.identity':
    'Konfigurator · {group}',
  'vr3.kg.page.progress':
    '{decided} von {total} entschieden',
  'vr3.kg.page.progressComplete':
    'Vollständig',
  'vr3.kg.page.previous':
    'Zurück zu {group}',
  'vr3.kg.page.next':
    'Weiter zu {group}',
  'vr3.kg.page.toSchedule':
    'Weiter zum Terminplan',
  'vr3.kg.page.blockedOpen':
    'Noch {open} Entscheidungen in dieser Kostengruppe offen.',
  'vr3.kg.page.blockedInvalid':
    'Eine Position dieser Kostengruppe ist ungültig oder wartet auf eine andere Entscheidung.',
  'vr3.kg.group.decisions':
    '{count} Positionen',
  'vr3.kg.service.include':
    'aufnehmen',
  'vr3.kg.service.includeToggle':
    'im Angebot',
  'vr3.kg.service.exclude':
    'nicht aufnehmen',
  'vr3.kg.service.legend':
    'Entscheidung {service}',
  'vr3.kg.service.mandatory':
    'verpflichtend enthalten',
  'vr3.kg.service.variantBaseline':
    'Projektstandard',
  'vr3.kg.service.noAmount':
    'kein Betrag',
  'vr3.kg.service.status.included':
    'Enthalten',
  'vr3.kg.service.status.configured':
    'Konfiguriert',
  'vr3.kg.service.status.notIncluded':
    'Nicht aufgenommen',
  'vr3.kg.service.status.undecided':
    'Entscheidung offen',
  'vr3.kg.service.status.invalid':
    'Eingabe ungültig',
  'vr3.kg.service.status.blocked':
    'Voraussetzung fehlt',
  'vr3.kg.service.detailOpen':
    'Details öffnen',
  'vr3.kg.service.detailClose':
    'Details schließen',
  'vr3.kg.service.building':
    'Gebäude {name}',
  'vr3.kg.service.authority.sourceEvidenced':
    'aus der Dokumentation belegt',
  'vr3.kg.service.authority.derived':
    'aus Mengen abgeleitet',
  'vr3.kg.service.authority.assumed':
    'Annahme — noch nicht bestätigt',
  'vr3.kg.service.field.authority':
    'Herkunft',
  'vr3.kg.service.field.building':
    'Gebäude',
  'vr3.kg.service.dependencyWarning':
    'Diese Position setzt {upstream} voraus.',
  'vr3.kg.service.dependencyDetail':
    'Solange {upstream} nicht entsprechend entschieden ist, trägt diese Position nichts zum Angebot bei.',
  'vr3.kg.service.dependencyRoute':
    'Voraussetzung öffnen',
  'vr3.kg.service.quantityLabel':
    'Menge in {unit}',
  'vr3.kg.service.quantityHelper':
    'Ansatz {unitAmount} € je {unit}.',
  'vr3.kg.service.quantity.notANumber':
    'Bitte eine Zahl eintragen. Bis dahin rechnet das Angebot mit der letzten gültigen Menge.',
  'vr3.kg.service.quantity.belowMinimum':
    'Die Menge kann nicht kleiner als null sein. Bis zur Korrektur gilt die letzte gültige Menge.',
  'vr3.kg.service.quantity.aboveMaximum':
    'Die Menge liegt über dem zulässigen Bereich. Bis zur Korrektur gilt die letzte gültige Menge.',
  'vr3.kg.context.title':
    'Kontext',
  'vr3.kg.context.buildings':
    'Option mit {count} Gebäuden',
  'vr3.kg.context.warnings':
    'Hinweise',
  'vr3.kg.context.selected':
    'Aufgenommene Positionen',
  'vr3.kg.context.baselineConfirmed':
    'Gebäudegrundlage bestätigt',
  'vr3.kg.context.baselineOpen':
    'Gebäudegrundlage offen',
  'vr3.journal.kgScopeConfirmed':
    'Leistungsabgrenzung bestätigt',
  'vr3.kg.gate.configurationTitle':
    'Konfiguration nicht verfügbar',
  'vr3.kg.gate.configurationPrereq':
    'Leistungsabgrenzung dieser Option',
  'vr3.kg.gate.configurationDetail':
    'Diese Option wurde vor dem aktuellen Konfigurationsvertrag angelegt und trägt keine Kostengruppen-Entscheidungen. Legen Sie den Gebäudeumfang erneut fest, um die Konfiguration zu beginnen.',
  'vr3.kg.gate.decisionsPrereq':
    'Sechs ausdrückliche Kostengruppen-Entscheidungen',
  'vr3.kg.gate.decisionsDetail':
    'Erst {decided} von {total} Kostengruppen sind entschieden.',
  'vr3.kg.gate.decisionsRoute':
    'Zur Leistungsabgrenzung',
  'vr3.kg.gate.skippedReason':
    'Diese Kostengruppe wurde bewusst ausgeschlossen. Es gibt hier nichts zu konfigurieren — die Entscheidung bleibt im Angebot sichtbar.',
  'vr3.kg.gate.reopenScope':
    'Leistungsabgrenzung öffnen',
  'vr3.kg.gate.chapterOutstanding':
    'In {group} sind noch Entscheidungen offen.',
  'vr3.kg.gate.scheduleReason':
    'Erst wenn jede enthaltene Kostengruppe vollständig ist, wird der Terminplan verfügbar.',
  'vr3.rail.scope.heading':
    'Enthaltener Umfang',
  'vr3.rail.scope.included':
    'Kostengruppen enthalten',
  'vr3.rail.scope.includedValue':
    '{included} von {total}',
  'vr3.rail.scope.excluded':
    'bewusst ausgeschlossen',
  'vr3.rail.scope.undecided':
    'noch offen',
  'vr3.rail.scope.services':
    'aufgenommene Positionen',
  'vr3.rail.scope.openDecisions':
    'offene Entscheidungen',
  'vr3.rail.change.heading':
    'Zuletzt geändert',
  'vr3.rail.change.noEffect':
    'ohne Preiswirkung',
  'vr3.rail.status.subtotal':
    'Zwischensumme',
  'vr3.rail.status.subtotalUndecided':
    'Noch {undecided} Kostengruppen ohne Entscheidung — die Summe nennt nur die kalkulierten Positionen.',
  'vr3.rail.status.subtotalOpenDecisions':
    'Noch {open} offene Entscheidungen — die Summe nennt nur die kalkulierten Positionen.',
  'vr3.rail.status.reconcileFailed':
    'Zusammensetzung stimmt nicht',
  'vr3.rail.status.reconcileDrift':
    'Die Kostengruppen summieren sich nicht zur ausgewiesenen Summe. Abweichung {drift}.',
  // SIDEBAR 03 (backlog 2be8e69c, SB-16): the ghost preview's "gegenüber
  // aktuellem Stand" suffix was a hardcoded literal, invisible to `tx()`'s
  // whole-string lookup once interpolated between other fragments.
  'offerPanel.preview.vsCurrent': 'gegenüber aktuellem Stand',
  // SB-15: one shared legend for every `⚙` occurrence in the rail (recap/
  // composition rows, driver rows, KG 300 subgroups) — lives once in the
  // Level 3 disclosure, not repeated per row. Core clause only, reused from
  // `derived-prototype.json.provenanceLabel` / `configurator.scopeCatalog.
  // footnote` — the rail drops that key's second sentence ("… erscheint …
  // in der Angebotsspalte rechts"), written for the centre pane and
  // self-referential if repeated inside the rail itself.
  'offerPanel.derivedMarker.legend': '⚙ · für den Prototyp abgeleitet, nicht kalibriert.',
  // SB-14: OriginPopover/basis-row labels the Codex delivery (`generated.ts`)
  // does not cover — `panel.rate`/`panel.quantity` compose with a live
  // denominator, `panel.decreased` is `driverLabel`'s own direction word,
  // `panel.scopeLabel` names an assigned scope (the unresolved case already
  // has its own delivered key, `panel.scopeAllocationUnresolved`).
  'panel.rate': 'Satz',
  'panel.quantity': 'Menge · {denominator}',
  'panel.decreased': 'senkt',
  'panel.scopeLabel': 'Scope · {scope}',
  // SIDEBAR 03 rework (QA finding): the sr-only driver-row accessible name
  // (DRIVER-004) spelled the rounded/exact-value connector words as bare
  // German literals even in EN — the values themselves already went through
  // `localizeMoneyText`, only these two words were missed.
  'panel.rounded': 'rund',
  'panel.exact': 'exakt',
  // SB-29: the rail's new heading root (`<h2>`, replacing the plain
  // `aria-label="Angebot"` that carried no heading semantics at all) and
  // the two Level 1 metric groups that must become independently
  // heading-reachable.
  'offerPanel.heading': 'Angebot',
  'offerPanel.heading.leadRate': 'Leitkennzahl',
  'offerPanel.heading.duration': 'Bauzeit',
  // SB-33: OKBP itself is a protected glossary term (LOCALE-009,
  // `output-model.md`) and stays literal in every locale — only its gloss
  // is new, moved into the Bauzeit hero's existing Herkunft popover rather
  // than inlined on the space-constrained Level 1 hero.
  'offerPanel.duration.okbpGloss': 'Oberkante Bodenplatte',
  // Local short form for the "Nicht enthalten / noch offen" caption
  // (`COVERAGE_SHORT`) — every other coverage state's short form already
  // equals the delivered `coverage.*` key verbatim; only `notApplicable`'s
  // abbreviation ("n. a.") differs from the delivered full phrase ("nicht
  // anwendbar") and needs its own key to keep the existing DE visual text
  // unchanged while still being real EN, not a silent fallback.
  'panel.coverage.notApplicableShort': 'n. a.',
  // SB-06 companion follow-through: the excluded-groups summary line has no
  // Codex match once the coverage short forms are interpolated into it.
  'offerPanel.notIncluded.clientNotice':
    'Nicht alle Kostengruppen sind Bestandteil dieses Angebots; die Abgrenzung steht in der Leistungsübersicht.',
  'offerPanel.riskSurcharges.label': 'Risikozuschläge',
  // SB-14 companion: the Bauzeit hero's own unit word and rounding
  // disclosure sentence were hardcoded literals with no `t()`/`tx()` call
  // at all (unlike the caption line, which already has a Codex-delivered
  // key, `schedule.completionFromOkbp`).
  'offerPanel.duration.unit': 'Monate',
  'offerPanel.duration.roundingDisclosure':
    'Anzeige weicht vom Modellwert ab; exakt {value}',
  // SB-17: the scoped `aria-live` announcement — the amount and the change,
  // not the ~40-word hero band it used to sit on.
  'offerPanel.liveAnnouncement': '{change} · {delta} · neuer Betrag {total}',
  'panel.regionalFactorDeactivated': 'deaktiviert',
  // SB-14 companion (live Playwright finding): no Codex-delivered key
  // matches this exact composed heading; `tx()`'s reverse lookup never
  // matched once combined with the toggle glyph.
  'offerPanel.kg300Subgroups.toggle': 'KG 300 Untergruppen',
  'offerPanel.kg300Subgroups.caption': 'KG 300 Untergruppen, Risikobasis',
  // #16 Part 24/AC-24: trigger for the "Learn More / See Details" dialog.
  // Deliberately does NOT start with "Details" (unlike every per-row
  // OriginPopover trigger, `panel.details` = "Details") — the two triggers
  // open materially different surfaces (one row's origin vs. the whole
  // calculation) and must stay tellable apart, incl. by an accessible-name
  // prefix match.
  'offerPanel.details.trigger': 'Alle Details ansehen',
  'presentation.building.story': 'Gebäudestory',
  'presentation.building.confirmed': 'Bestätigt',
  'presentation.building.notCaptured': 'Nicht erfasst',
  'presentation.building.fullBasement': 'Vollausbau',
  'presentation.building.partialBasement': 'Rohbau ab Decke',
  'presentation.building.noBasement': 'Kein Untergeschoss',
  'presentation.building.underground': 'Untergeschoss',
  'presentation.commercialConsequence': 'Kommerzielle Folge',
  'presentation.commercialConsequenceCopy': 'Die Fertigstellung richtet sich nach dem längsten Bauabschnitt.',
  'presentation.schedule.durationFromOkbp': 'Bauzeit ab OKBP',
  'presentation.nav.project': 'Projekt',
  'presentation.nav.building': 'Gebäude',
  'presentation.nav.result': 'Ergebnis',
  'presentation.nav.schedule': 'Zeitplan',
  'presentation.nav.options': 'Optionen',
  'presentation.nav.nextStep': 'Nächster Schritt',
  'presentation.nextStep.continue': 'Weiter zu Optionen',
  'presentation.nextStep.title': 'Angebot vorbereiten',
  'presentation.nextStep.copy': 'Die Präsentationsansicht bleibt unverändert. Die Arbeitsoption bleibt getrennt.',
  'presentation.nextStep.artifacts': 'Enthaltene Artefakte',
  'presentation.artifact.offer': 'Angebotspräsentation',
  'presentation.artifact.cost': 'Kostenübersicht',
  'presentation.artifact.scope': 'Leistungsumfang',
  // VR2-07 — Angebotsumfang gallery (cycle 4): the gallery now lists the
  // REAL, seller-selected `offerDraft.attachments` against the shared
  // `OFFER_ARTIFACTS` catalog (`config/offer-artifacts.ts`) instead of a
  // fixed literal three-item array — title comes from the catalog's own
  // label via `tx()` (same pattern S5Export's checklist already uses for
  // the identical label), only the per-artifact description and the one
  // honest, non-fabricated format tag live here as translation keys.
  'presentation.artifact.title.praesentation': 'Angebotspräsentation (PDF)',
  'presentation.artifact.title.leistungen': 'Leistungen — enthalten / nicht enthalten',
  'presentation.artifact.title.ssl': 'Schnittstellenmatrix (SSL)',
  'presentation.artifact.title.baubeschreibung': 'Baubeschreibung',
  'presentation.artifact.title.kg': 'Kostenübersicht DIN 276',
  'presentation.artifact.title.vertrag': 'Vertragsvorlagen für die Rechtsabteilung',
  'presentation.artifact.description.praesentation': 'Projekt, Gebäude, Ergebnis, Zeitplan & Optionen',
  'presentation.artifact.description.leistungen': 'Enthalten, nicht enthalten, Schnittstellen',
  'presentation.artifact.description.ssl': 'Technische Schnittstellen zwischen den Gewerken',
  'presentation.artifact.description.baubeschreibung': 'Bauliche und technische Ausführung des Projekts',
  'presentation.artifact.description.kg': 'KG-Struktur und kommerzielle Treiber',
  'presentation.artifact.description.vertrag': 'Rechtliche Vorlagen für den Vertragsabschluss',
  'presentation.artifact.meta': 'PDF',
  'presentation.artifact.costUnavailable': 'Vorschau nicht verfügbar — Gesamtpreis noch nicht ermittelt',
  'presentation.artifact.dialogScope': 'Gebäude',
  'presentation.flow.offerEyebrow': 'Ihr indikatives Angebot',
  'presentation.flow.offerTitle': '{project} bekommt kommerzielle Kontur.',
  'presentation.flow.offerTitleFallbackSubject': 'Ihr Projekt',
  'presentation.flow.prepare': 'Angebot prüfen & senden →',
  'presentation.flow.discountNotice': 'Interne Rabatteinstellungen bleiben in der Vorbereitung und sind hier nicht sichtbar.',
  'presentation.flow.galleryEyebrow': 'Angebotsumfang',
  'presentation.flow.galleryHeadline': 'Diese Unterlagen gehen an Ihren Kunden.',
  'presentation.flow.galleryEmpty': 'Für dieses Angebot sind aktuell keine Artefakte ausgewählt.',
  'presentation.commercial.topDriver': 'Größter Treiber',
  'presentation.flow.send.title': 'Bereit zum Senden',
  'presentation.flow.send.copy': 'Prüfen Sie Empfänger, kommerzielle Zusammenfassung und Artefakte ein letztes Mal.',
  'presentation.flow.recipient': 'Empfänger',
  'presentation.flow.recipientValue': 'An: {email} (aus HubSpot)',
  'presentation.flow.noRecipient': 'Noch kein Empfänger hinterlegt',
  'presentation.flow.subject': 'Betreff',
  'presentation.flow.language': 'Sprache',
  'presentation.flow.german': 'Deutsch',
  'presentation.flow.english': 'Englisch',
  'presentation.flow.summary': 'Kommerzielle Zusammenfassung',
  'presentation.flow.immutable': 'Der Versand speichert eine unveränderliche Version. Spätere Änderungen verändern diese Version nicht.',
  'presentation.flow.sendAction': 'Angebot senden',
  'presentation.flow.sentTitle': 'Angebot gesendet',
  'presentation.flow.deliveredTitle': 'Angebot wurde zugestellt.',
  'presentation.flow.sentCopy': 'Die Zustellung wird geprüft.',
  'presentation.flow.deliveredCopy': 'Die Zustellung wird in diesem Prototyp simuliert.',
  'presentation.flow.sentAt': 'Gesendet am',
  'presentation.flow.deliveredAt': 'Zugestellt am',
  'presentation.flow.version': 'Gesendete Version',
  'presentation.flow.deliveryState': 'Zustellstatus',
  'presentation.flow.pending': 'Ausstehend',
  'presentation.flow.confirmed': 'Bestätigt (simuliert)',
  'presentation.flow.openSent': 'Gesendetes Angebot öffnen',
  'presentation.flow.newVersion': 'Neue Version erstellen',
  'presentation.flow.back': 'Zurück zur Präsentation',
  'presentation.flow.backToDelivery': 'Zurück zum Zustellstatus',
  'presentation.flow.snapshotTitle': 'Gesendetes Angebot',
  'presentation.flow.snapshotCopy': 'Diese unveränderliche Version bleibt auch nach späteren Änderungen am Projekt erhalten.',
  'presentation.flow.justNow': 'Gerade eben',
  // VR2-08 — Send review / Delivered (new keys, added alongside the
  // existing presentation.flow.* entries above; those stay in place and
  // some of them (offerEyebrow, recipient, subject, language, summary,
  // sentAt, version, openSent, newVersion, backToDelivery, snapshotTitle,
  // snapshotCopy, immutable, pending, justNow) are reused as-is.
  'presentation.flow.send.eyebrow': 'Finale Prüfung',
  'presentation.flow.recipientLabel': 'An',
  'presentation.flow.subjectValue': 'Indikatives Angebot · {project}',
  'presentation.flow.completion': 'Fertigstellung',
  'presentation.flow.priceUnavailableReason': 'Gesamtpreis noch nicht ermittelt — Angebot kann nicht gesendet werden',
  'presentation.flow.artifactsHeading': '{count} Artefakte',
  'presentation.flow.openOffer': 'Angebot öffnen',
  'presentation.flow.immutableDetail': 'Spätere Projektänderungen verändern dieses Angebot nicht.',
  'presentation.flow.reviewedSummary': 'Empfänger & {count} Artefakte geprüft',
  'presentation.flow.reviewedSummaryDetail': 'Snapshot wird beim Versand unveränderlich gespeichert.',
  'presentation.flow.sendingLabel': 'Wird gesendet …',
  'presentation.flow.sendFailedTitle': 'Senden fehlgeschlagen',
  'presentation.flow.sendFailedCopy': 'Der Versand konnte nicht abgeschlossen werden. Es wurde kein Snapshot gespeichert.',
  'presentation.flow.retryAction': 'Erneut versuchen',
  'presentation.flow.deliveredEyebrow': 'Versand abgeschlossen',
  'presentation.flow.sentEyebrow': 'Versand läuft',
  'presentation.flow.statusDelivered': 'zugestellt',
  'presentation.flow.statusSent': 'gesendet',
  'presentation.flow.snapshotId': 'Snapshot-ID',
  'presentation.flow.snapshotRef': 'Snapshot #{id}',
  'presentation.flow.deliveryProofAction': 'Versandnachweis',
  'presentation.flow.deliveryProofTitle': 'Versandnachweis',
  'presentation.flow.deliveryProofIntro': 'Gesendet und zugestellt sind zwei getrennte Ereignisse — die Zustellung wird erst nach der Annahme durch den Provider bestätigt.',
  'presentation.flow.deliveryProofSentRow': 'Gesendet',
  'presentation.flow.deliveryProofDeliveredRow': 'Zugestellt',
  // VR2-06 — Present narrative shell (identity/scope/commercial/timeline/
  // options/next-step), one full-bleed page per chapter.
  'presentation.ansicht.legend': 'Ansicht',
  'presentation.identity.eyebrow': 'Indikatives Angebot · {date}',
  'presentation.identity.buildingCount': 'Gebäude',
  'presentation.scope.eyebrow': 'Gebäudestory',
  'presentation.scope.position': '{n} von {total}',
  'presentation.scope.included': 'Eingeschlossen',
  'presentation.scope.previous': '← {building}',
  'presentation.scope.next': '{building} →',
  'presentation.scope.continueTo': 'Weiter · {section} →',
  'presentation.commercial.eyebrow': '{option} · Gesamt netto',
  'presentation.commercial.driversTitle': 'Was den Preis bestimmt',
  'presentation.commercial.driversSum': 'Summe der Treiber entspricht dem Gesamtergebnis:',
  'presentation.timeline.headline': 'Vom OKBP zur Übergabe.',
  'presentation.timeline.eyebrow': 'Terminrahmen · {option}',
  'presentation.timeline.intro': 'Die Fertigstellung richtet sich nach dem längsten Bauabschnitt.',
  'presentation.timeline.planningPhase': 'Planung',
  'presentation.timeline.wholeProject': 'Gesamtprojekt',
  'presentation.timeline.afterPlanning': 'nach Planung',
  'presentation.timeline.incomplete': 'Termindaten unvollständig — der Zeitplan erscheint, sobald das Terminmodell Daten liefert.',
  'presentation.options.eyebrow': 'Drei Wege für {project}',
  'presentation.options.headline': 'Was soll im Vordergrund stehen?',
  'presentation.options.view': 'Option ansehen',
  'presentation.options.present': '{option} präsentieren',
  'presentation.options.viewing': 'Wird präsentiert',
  'presentation.options.fact.building': 'Gebäude',
  'presentation.options.fact.duration': 'Bauzeit',
  'presentation.nextStep.eyebrow': 'Empfohlener nächster Schritt',
  'presentation.nextStep.headline': '{option} als Grundlage bestätigen.',
  'presentation.nextStep.confirmationLabel': 'Was bestätigt wird',
  'presentation.nextStep.confirmationValue': '{option} · {total} netto · Schätzunsicherheit ±{pp}%',
  'presentation.nextStep.workingOptionNotice': 'Die Ansicht ändert nur die Präsentation. Die aktive Arbeitsoption bleibt {option}.',
  // VR2-00: Grundlagen ist eine interne QA-/Design-System-Oberfläche, kein
  // Produkt. Kennzeichnung und Diagnose stehen in den Produktsprachen
  // (de Quelle, en Übersetzung), nicht in interner Entwicklersprache — es
  // gibt keine untranslatierte Diagnose im sichtbaren Shell (Regel 36).
  'grundlagen.specimen.badge': 'Intern · QA-Spezimen',
  'grundlagen.specimen.headline': 'Interne QA-Oberfläche — kein Produkt',
  'grundlagen.specimen.body':
    'Dieser Bildschirm ist ein internes Design-System-Spezimen für die Qualitätssicherung. Er ist keine Produkt- oder Kundenoberfläche und zählt nicht als Nachweis für Produkt-Adoption.',
  'diagnostics.title': 'Prüfung der Grundlagen',
  'diagnostics.failed':
    'Nicht erfüllt: {failed} von {total}. Auf dieser Grundlage darf das Produkt nicht zusammengestellt werden — zuerst diese Punkte.',
  'diagnostics.col.check': 'Grundlage',
  'diagnostics.col.state': 'Zustand',
  'diagnostics.col.detail': 'Detail',
  'diagnostics.state.checking': '◌ wird geprüft',
  'diagnostics.state.ok': '✓ erfüllt',
  'diagnostics.state.fail': '✗ nicht erfüllt',
  'diagnostics.check.fonts': 'Visuelt Pro — drei Schnitte',
  'diagnostics.check.cascade': 'Font-Kaskade und weißer Hintergrund',
  'diagnostics.check.tokens': 'Design-System-Tokens lesbar',
  'diagnostics.check.drivers': 'Kostentreiber summieren zum Ergebnis',
  'diagnostics.check.blocker': 'Ausgabe-Blocker sperrt fünf Profile',
  'diagnostics.detail.fonts.ok': 'Regular, Medium, Bold im Browser verfügbar',
  'diagnostics.detail.fonts.missing': 'nicht verfügbar: {missing}',
  'diagnostics.detail.fonts.waiting': 'warten auf document.fonts.ready',
  'diagnostics.detail.cascade.ok':
    'html, body und Formularelemente tragen font-family; Hintergrund weiß',
  'diagnostics.detail.cascade.waiting': 'warten',
  'diagnostics.detail.tokens.ok': 'Akzent {accent} · Abstandsschritt {space}',
  'diagnostics.detail.tokens.fail':
    'Variablen nicht aufgelöst — tokens.css nicht eingebunden',
  'diagnostics.detail.drivers.ok': '{count} Treiber ergeben {sum}, Ergebnis {total}',
  'diagnostics.detail.drivers.fail': 'Treiber nicht geladen',
  'diagnostics.detail.blocker.ok': '{id} · {state} · {materiality} · {count} Profile',
  'diagnostics.detail.blocker.fail': 'Blocker nicht geladen',
  'diagnostics.fixture':
    'Fixture: {scenario} · Lauf {run} · Regeln {rules} · Regionalfaktor {factor}',
  // VR2-00 remediation: enum/status values are localised so the visible
  // diagnostics carry no raw mixed-language tokens (state/materiality/factor).
  // Display labels only — the underlying fixture data is unchanged.
  'diagnostics.value.regionalFactor.active': 'aktiv',
  'diagnostics.value.regionalFactor.inactive': 'inaktiv',
  'diagnostics.value.issueState.open': 'offen',
  'diagnostics.value.issueState.resolved': 'gelöst',
  'diagnostics.value.materiality.material': 'wesentlich',
  'diagnostics.value.materiality.warning': 'Warnung',
  // ── VR3-01 · project fixtures, documentation analysis and readiness ──
  'ds.semanticStatus.meaning.neutral': 'noch nichts geschehen',
  'ds.semanticStatus.meaning.progress': 'läuft',
  'ds.semanticStatus.meaning.ok': 'abgeschlossen',
  'ds.semanticStatus.meaning.attention': 'benötigt eine Entscheidung',
  'ds.semanticStatus.meaning.error': 'fehlgeschlagen',
  'ds.semanticStatus.meaning.stale': 'muss erneut geprüft werden',
  'ds.semanticStatus.meaning.unknown': 'nicht bekannt',
  'ds.authority.sourceEvidenced': 'aus Quelle belegt',
  'ds.authority.aiInferred': 'automatisch abgeleitet',
  'ds.authority.assumed': 'angenommen',
  'ds.authority.derived': 'berechnet',
  'ds.authority.userEntered': 'manuell erfasst',
  'ds.authority.confirmed': 'bestätigt',
  'ds.authority.overridden': 'überschrieben',
  'ds.authority.historical': 'historisch',
  'ds.authority.stale': 'nicht mehr aktuell',
  'ds.authority.unknown': 'unbekannt',
  'ds.authority.confirmedBy': 'bestätigt von {actor} am {at}',
  'ds.authority.overrodeValue': 'ersetzt {previous} · Begründung: {reason} · {actor}, {at}',
  'ds.processingJob.state.notStarted': 'Nicht gestartet',
  'ds.processingJob.state.running': 'Läuft',
  'ds.processingJob.state.partialFailure': 'Teilweise fehlgeschlagen',
  'ds.processingJob.state.complete': 'Abgeschlossen',
  'ds.processingJob.heading': '{done} von {total} Dateien verarbeitet',
  'ds.processingJob.progressText': '{done} von {total} Dateien · {percent} Prozent',
  'ds.processingJob.overallProgress': 'Gesamtfortschritt',
  'ds.processingJob.nowProcessing': 'Wird gerade verarbeitet',
  'ds.documentRow.progressLabel': 'Verarbeitungsfortschritt für {file}',
  'ds.documentRow.stateOf': ' — Status von {file}',
  'ds.documentRow.actionOn': '{action} · {file}',
  'ds.documentRow.inspect': 'Details ansehen',
  'ds.actionGate.status.available': 'Verfügbar',
  'ds.actionGate.status.locked': 'Gesperrt',
  'ds.actionGate.status.busy': 'Wird ausgeführt',
  'ds.actionGate.status.error': 'Fehlgeschlagen',
  'ds.actionGate.retry': 'Erneut versuchen',
  'ds.conflict.state.resolved': 'Entschieden',
  'ds.conflict.state.blocking': 'Blockierende strittige Angabe',
  'ds.conflict.state.nonBlocking': 'Strittige Angabe',
  'ds.conflict.recommendedSource': 'Neuere Quelle',
  'ds.conflict.supersededSource': 'Ersetzt',
  'ds.conflict.decisionRecord': 'Entscheidung',
  'ds.conflict.decidedBy': 'entschieden von {actor} am {at}',
  'ds.conflict.recommendationFlag': 'Systemvorschlag',
  'ds.question.status.open': 'Offen',
  'ds.question.status.answered': 'Beantwortet',
  'ds.question.status.reviewRequired': 'Prüfung erforderlich',
  'ds.question.status.warning': 'Annahme dokumentiert',
  'ds.question.kind.question': 'Offene Frage',
  'ds.question.kind.lowConfidence': 'Geringe Erkennung',
  'ds.question.kind.staleDependency': 'Veraltete Grundlage',
  'ds.question.blocksProgress': 'blockiert den Fortschritt',
  'ds.question.doesNotBlock': 'blockiert nicht',
  'ds.question.permittedAssumption': 'Zulässige Annahme',
  'ds.question.recordedBy': 'erfasst von {actor} am {at}',
  'vr3.project.type.mfh': 'Mehrfamilienhaus · Neubau',
  'vr3.project.type.quarter': 'Quartier · Büro, Wohnen, Mischnutzung',
  'vr3.project.DEMO-HAPPY-01.description': 'Eine ruhige fünfgeschossige Hofbebauung mit 18 Wohnungen, wiederkehrendem Planungsraster und konventioneller Bauweise. Die vollständig herausgegebene Dokumentation erlaubt den direkten Weg von der Analyse zur Option.',
  'vr3.project.DEMO-HAPPY-01.listStatus': 'Beispiel ohne Konflikte',
  'vr3.project.DEMO-HAPPY-01.understanding': 'Ein Standard-Mehrfamilienhaus ohne Untergeschoss, vollständige Geometrie und eindeutige Quellenzuordnung.',
  'vr3.project.DEMO-COMPLEX-01.description': 'Umbau eines früheren Logistikrands zu einem dichten Hofensemble. Eine lange, widersprüchliche Revisionsgeschichte, gemischte Scanqualität und geänderte Kundenvorgaben erzeugen nachvollziehbare Konflikte, die vor dem Anlegen einer Option entschieden werden müssen.',
  'vr3.project.DEMO-COMPLEX-01.listStatus': 'Prüfung erforderlich',
  'vr3.project.DEMO-COMPLEX-01.understanding': 'Drei Gebäude mit unterschiedlicher Nutzung, Geschossigkeit und Untergeschoss-Situation.',
  'vr3.building.usage.residentialMfh': '100 Prozent Wohnen · Mehrfamilienhaus',
  'vr3.building.usage.office': '100 Prozent Büro',
  'vr3.building.usage.residential': '100 Prozent Wohnen',
  'vr3.building.usage.mixed': 'Erdgeschoss Gewerbe · Obergeschosse Wohnen',
  'vr3.building.storeys.a1': 'EG + 3 OG + DG',
  'vr3.building.storeys.bA': 'EG + 5 OG',
  'vr3.building.storeys.bB': 'UG + EG + 4 OG',
  'vr3.building.storeys.bC': 'Teil-UG + EG + 6 OG',
  /* VR3-02 — Option-Gebäudeumfang und Konfigurator-Gate. */
  'vr3.scope.eyebrow.review': 'Optionsgrundlage · Prüfung erforderlich',
  'vr3.scope.eyebrow.saved': 'Optionsgrundlage · Gespeichert',
  'vr3.scope.eyebrow.noBaseline': 'Optionsgrundlage · Nicht übernommen',
  'vr3.scope.noBaseline.heading': 'Diese Option hat keine Projektgrundlage',
  'vr3.scope.noBaseline.explanation':
    'Der Gebäudeumfang einer Option wird beim Anlegen aus der bestätigten '
    + 'Projektgrundlage übernommen. Diese Option ist ohne eine solche Grundlage '
    + 'entstanden, deshalb gibt es hier nichts zu prüfen.',
  'vr3.scope.noBaseline.absenceTitle': 'Keine Gebäude übernommen',
  'vr3.scope.noBaseline.absenceDetail':
    'Legen Sie die Option aus dem Projekt neu an. Vorhandene Optionen bleiben erhalten.',
  'vr3.scope.noBaseline.action': 'Zum Projekt',
  'vr3.scope.progress': '{confirmed} von {total} bestätigt',
  'vr3.scope.lead.single':
    'Prüfen Sie die Kennwerte und die Herkunft dieses Gebäudes und bestätigen Sie die Grundlage.',
  'vr3.scope.lead.multi':
    'Legen Sie fest, was diese Option umfasst, prüfen Sie je Gebäude Kennwerte '
    + 'und Herkunft und bestätigen Sie jede Grundlage einzeln.',
  'vr3.scope.selection.legend': 'Gebäude im Angebotsumfang',
  'vr3.scope.building': 'Gebäude {mark}',
  'vr3.scope.selectAction': 'Im Angebotsumfang führen',
  'vr3.scope.reviewAction': 'Grundlage prüfen',
  'vr3.scope.selected': 'Im Umfang',
  'vr3.scope.notSelected': 'Nicht im Umfang',
  'vr3.scope.status.confirmed': 'Grundlage bestätigt',
  'vr3.scope.status.stale': 'Erneut prüfen',
  'vr3.scope.status.open': 'Prüfung offen',
  'vr3.scope.status.unselected': 'Nicht im Umfang',
  'vr3.scope.empty':
    'Kein Gebäude im Umfang. Wählen Sie mindestens ein Gebäude, um seine Grundlage zu prüfen.',
  'vr3.scope.selectedTotal': 'Gewählter Umfang: {value} m² BGF R+S',
  'vr3.scope.unit.area': 'm²',
  'vr3.scope.metric.storeys': 'Geschosse',
  'vr3.scope.metric.underground': 'Untergeschoss',
  'vr3.scope.metric.bgfRAbove': 'BGF R oberirdisch',
  'vr3.scope.metric.bgfSAbove': 'BGF S oberirdisch',
  'vr3.scope.metric.bgfRBelow': 'BGF R unterirdisch',
  'vr3.scope.metric.bgfRSTotal': 'BGF R+S gesamt',
  'vr3.scope.metric.wfl': 'Wohnfläche nach WoFlV',
  'vr3.scope.metric.nuf': 'NUF nach DIN 277',
  'vr3.scope.metric.commercialNuf': 'NUF Gewerbe',
  'vr3.scope.metric.units': 'Wohneinheiten',
  'vr3.scope.metric.workplaces': 'Arbeitsplätze',
  'vr3.scope.metric.parkingSpaces': 'Stellplätze',
  'vr3.scope.metric.siteArea': 'Grundstücksfläche',
  'vr3.scope.underground.none': 'Kein UG',
  'vr3.scope.underground.partial': 'Teil-UG',
  'vr3.scope.underground.full': 'UG',
  'vr3.scope.evidence.planSet': 'Planwerk',
  'vr3.scope.evidence.section': 'Schnitt',
  'vr3.scope.baseline.title': 'Grundlage · {building}',
  'vr3.scope.baseline.authority': 'Herkunft: {authority}',
  'vr3.scope.edit.open': 'Ändern',
  'vr3.scope.edit.revert': 'Quellwert',
  'vr3.scope.edit.commit': 'Wert übernehmen',
  'vr3.scope.edit.cancel': 'Abbrechen',
  'vr3.scope.edit.reasonLabel': 'Begründung',
  'vr3.scope.edit.consequenceTitle': 'Das ändert die Mengenbasis der Kostengruppen',
  'vr3.scope.edit.consequenceDetail':
    'Der bisherige Quellwert bleibt in der Historie. Die Grundlage muss danach erneut '
    + 'bestätigt werden.',
  'vr3.scope.edit.error.empty': 'Bitte einen Wert eingeben.',
  'vr3.scope.edit.error.notANumber': 'Bitte eine Zahl eingeben, zum Beispiel 3.410,00.',
  'vr3.scope.edit.error.negative': 'Eine Fläche oder Anzahl kann nicht negativ sein.',
  'vr3.scope.edit.error.notAnInteger': 'Bitte eine ganze Anzahl eingeben.',
  'vr3.scope.edit.error.tooLarge': 'Der Wert liegt außerhalb des zulässigen Bereichs.',
  'vr3.scope.edit.error.reason': 'Bitte begründen, warum der Quellwert ersetzt wird.',
  'vr3.scope.confirm.action': 'Gebäudegrundlage bestätigen',
  'vr3.scope.confirm.blockedByEdit': 'Erst die offene Änderung übernehmen oder abbrechen.',
  'vr3.scope.confirmed.label': 'Grundlage bestätigt',
  'vr3.scope.confirmed.meta': '{actor} · {at}',
  'vr3.scope.stale.building':
    'Die Angaben von {building} haben sich seit der Bestätigung geändert. '
    + 'Bitte prüfen und erneut bestätigen.',
  'vr3.scope.stale.scope':
    'Der gespeicherte Gebäudeumfang beschreibt nicht mehr die aktuelle Auswahl. '
    + 'Der Konfigurator ist bis zum erneuten Speichern gesperrt.',
  'vr3.scope.removal.title': '{building} aus dem Umfang nehmen?',
  'vr3.scope.removal.detail':
    'Die Bestätigung dieses Gebäudes und der gespeicherte Umfang verlieren ihre Gültigkeit. '
    + 'Kennwerte und Herkunft bleiben erhalten.',
  'vr3.scope.removal.confirm': 'Aus dem Umfang nehmen',
  'vr3.scope.removal.cancel': 'Im Umfang lassen',
  'vr3.scope.prereq.selection': 'Mindestens ein Gebäude im Umfang',
  'vr3.scope.prereq.selectionDetail': 'Wählen Sie mindestens ein Gebäude aus.',
  'vr3.scope.prereq.building': 'Grundlage bestätigt: {building}',
  'vr3.scope.prereq.buildingDetail': 'Kennwerte prüfen und Grundlage bestätigen.',
  'vr3.scope.gate.route': 'Zu {building}',
  'vr3.scope.save.action': 'Gebäudeumfang speichern',
  'vr3.scope.save.busy': 'Gebäudeumfang wird gespeichert',
  'vr3.scope.save.retry': 'Erneut speichern',
  'vr3.scope.save.blocked.one': 'Noch eine Gebäudegrundlage offen.',
  'vr3.scope.save.blocked.many': 'Noch {count} Gebäudegrundlagen offen.',
  'vr3.scope.save.alreadySaved': 'Der aktuelle Umfang ist bereits gespeichert.',
  'vr3.scope.error.changed':
    'Der Umfang hat sich während des Speicherns geändert. Auswahl und Änderungen sind erhalten '
    + 'geblieben; bitte erneut speichern.',
  'vr3.scope.announce.saving': 'Gebäudeumfang wird gespeichert.',
  'vr3.scope.announce.saved': 'Gebäudeumfang gespeichert. Der Konfigurator ist jetzt verfügbar.',
  'vr3.scope.announce.confirmed': 'Grundlage bestätigt: {building}.',
  'vr3.scope.announce.edited': '{metric} von {building} überschrieben.',
  'vr3.scope.announce.reverted': '{metric} von {building} auf den Quellwert zurückgesetzt.',
  'vr3.scope.announce.removed': '{building} aus dem Angebotsumfang genommen.',
  'vr3.konfigurator.eyebrow': 'Workflow-Gate',
  'vr3.konfigurator.heading.locked': 'Konfigurator gesperrt',
  'vr3.konfigurator.heading.available': 'Konfigurator verfügbar',
  'vr3.konfigurator.lead.locked':
    'Das System weiß, was fehlt, und führt direkt dorthin. Eine ausgegraute Navigation '
    + 'wäre keine Erklärung.',
  'vr3.konfigurator.lead.available':
    'Die Optionsgrundlage ist bestätigt und gespeichert. Die Leistungsabgrenzung ist '
    + 'der einzige nächste Schritt.',
  'vr3.konfigurator.prereq.scope': 'Gebäude & Umfang gespeichert',
  'vr3.konfigurator.blockedReason':
    'Der Konfigurator öffnet, sobald der Gebäudeumfang gespeichert ist.',
  'vr3.konfigurator.prereq.buildingDetail': '{building} braucht noch Prüfung und Bestätigung.',
  'vr3.konfigurator.prereq.saveDetail': 'Den bestätigten Gebäudeumfang speichern.',
  'vr3.konfigurator.receipt.title.one': 'Eine Gebäudegrundlage bestätigt und gespeichert',
  'vr3.konfigurator.receipt.title.many': '{count} Gebäudegrundlagen bestätigt und gespeichert',
  'vr3.konfigurator.receipt.next':
    'Nächster Schritt: für alle sechs Kostengruppen entscheiden, ob sie enthalten sind.',
  'vr3.konfigurator.receipt.buildings': 'Gebäude im Umfang',
  'vr3.konfigurator.receipt.bgf': 'BGF R+S gesamt',
  'vr3.konfigurator.receipt.savedAt': 'Gespeichert am',
  'vr3.konfigurator.route.building': '{building} prüfen',
  'vr3.konfigurator.route.scope': 'Zu Gebäude & Umfang',
  'vr3.konfigurator.start': 'Leistungsabgrenzung starten',
  'vr3.journal.buildingConfirmed': 'Gebäude {building} bestätigt',
  'vr3.journal.scopeBuildingAdded': '{building} in den Angebotsumfang aufgenommen',
  'vr3.journal.scopeBuildingRemoved': '{building} aus dem Angebotsumfang genommen',
  'vr3.journal.scopeBuildingConfirmed': 'Gebäudegrundlage {building} bestätigt',
  'vr3.journal.scopeMetricEdited': '{building}: {metric} überschrieben',
  'vr3.journal.scopeMetricReverted': '{building}: {metric} auf Quellwert zurückgesetzt',
  'vr3.journal.buildingScopeSaved': 'Gebäudeumfang gespeichert · {count} Gebäude',
  'vr3.building.underground.none': 'kein Untergeschoss',
  'vr3.building.underground.partial': 'Teil-Untergeschoss',
  'vr3.building.underground.full': 'Untergeschoss vorhanden',
  'vr3.docType.clientBrief': 'Kundenvorgabe',
  'vr3.docType.clientBriefAddendum': 'Nachtrag zur Kundenvorgabe',
  'vr3.docType.projectDescription': 'Projektbeschreibung',
  'vr3.docType.areaSchedule': 'Flächenliste',
  'vr3.docType.floorPlan': 'Grundriss',
  'vr3.docType.floorPlans': 'Grundrisse',
  'vr3.docType.floorPlanTypicalOg': 'Grundriss Regelgeschoss',
  'vr3.docType.floorPlanDuplicate': 'Grundriss · Doppel',
  'vr3.docType.elevations': 'Ansichten',
  'vr3.docType.section': 'Schnitt',
  'vr3.docType.fireStrategy': 'Brandschutzkonzept',
  'vr3.docType.buildingDescription': 'Baubeschreibung',
  'vr3.docType.useConcept': 'Nutzungskonzept',
  'vr3.docType.sitePlan': 'Freianlagenplan',
  'vr3.docType.technicalConcept': 'Technisches Konzept',
  'vr3.recognition.high': 'hohe Erkennung',
  'vr3.recognition.medium': 'mittlere Erkennung',
  'vr3.recognition.low': 'geringe Erkennung',
  'vr3.recognition.veryLow': 'sehr geringe Erkennung',
  'vr3.medium.nativePdf': 'natives PDF',
  'vr3.medium.vector': 'Vektorplan',
  'vr3.medium.converted': 'konvertiert',
  'vr3.medium.raster': 'Rasterbild',
  'vr3.medium.skewedScan': 'verzerrter Scan',
  'vr3.medium.faintScan': 'blasser Scan',
  'vr3.medium.compressedRaster': 'stark komprimiertes Rasterbild',
  'vr3.medium.croppedScan': 'beschnittener Scan',
  'vr3.sourceAuthority.confirmedClientInstruction': 'bestätigte Kundenvorgabe',
  'vr3.sourceAuthority.issuedArchitecturalDrawing': 'herausgegebener Architektenplan',
  'vr3.sourceAuthority.historicalClientInstruction': 'historische Kundenvorgabe',
  'vr3.sourceAuthority.currentClientInstruction': 'aktuelle Kundenvorgabe',
  'vr3.sourceAuthority.currentDescriptionBelowDrawings': 'aktuelle Beschreibung · rangiert unter den Plänen',
  'vr3.sourceAuthority.coordinatedSchedulePending': 'koordinierte Flächenliste · Bestätigung offen',
  'vr3.sourceAuthority.supersededArchitecturalDrawing': 'ersetzter Architektenplan',
  'vr3.sourceAuthority.currentIssuedArchitecturalDrawing': 'aktueller herausgegebener Architektenplan',
  'vr3.sourceAuthority.supersededDisciplineSchedule': 'ersetzte Fachliste',
  'vr3.sourceAuthority.currentCoordinatedSchedule': 'aktuelle koordinierte Liste',
  'vr3.sourceAuthority.supportingTechnicalDocument': 'unterstützendes Fachdokument',
  'vr3.sourceAuthority.duplicateNoAdditionalAuthority': 'Doppel · keine zusätzliche Autorität',
  'vr3.sourceAuthority.currentIssuedGeometryCrossCheck': 'aktueller Plan · nur Geometrieabgleich',
  'vr3.sourceAuthority.supportingArchitecturalEvidence': 'unterstützender Planbeleg',
  'vr3.sourceAuthority.currentDescriptionConflicting': 'aktuelle Beschreibung · widersprüchliches Feld',
  'vr3.sourceAuthority.historicalEvidenceOnly': 'nur historischer Beleg',
  'vr3.sourceAuthority.currentIssuedLowRecognition': 'aktueller Plan · geringe Erkennung',
  'vr3.sourceAuthority.currentDisciplineConcept': 'aktuelles Fachkonzept',
  'vr3.sourceAuthority.currentSiteEvidence': 'aktueller Freianlagenbeleg',
  'vr3.sourceAuthority.currentTechnicalConceptStale': 'aktuelles Fachkonzept mit veralteten Eingangswerten',
  'vr3.doc.issue.b01': 'Frühe Zielflächen',
  'vr3.doc.issue.b02': 'Formulierung zur Mischnutzung unvollständig',
  'vr3.doc.issue.b03': 'Satz zum Untergeschoss von Gebäude C abgeschnitten',
  'vr3.doc.issue.b04': 'Summe weicht von der Plansumme ab',
  'vr3.doc.issue.b05': 'Alte Kernanordnung',
  'vr3.doc.issue.b07': 'Geschossbezeichnung 5 als S gelesen',
  'vr3.doc.issue.b10': 'NUF 4.520 m² widerspricht V2',
  'vr3.doc.issue.b11': 'NUF 4.360 m²',
  'vr3.doc.issue.b12': 'Erkennung verwechselt 5 und 6 Geschosse · handschriftliche Notiz',
  'vr3.doc.issue.b13': 'Inhaltsgleiches Doppel unter anderem Dateinamen',
  'vr3.doc.issue.b14': '42 Stellplätze',
  'vr3.doc.issue.b15': '36 Stellplätze · grösserer Technikraum',
  'vr3.doc.issue.b16': '8 Wohnungen',
  'vr3.doc.issue.b17': '7 Wohnungen',
  'vr3.doc.issue.b20': 'Maßstabsangabe fehlt',
  'vr3.doc.issue.b21': 'Untergeschosshöhe unlesbar · Erkennung teilweise fehlgeschlagen',
  'vr3.doc.issue.b22': 'WFL 3.410 m²',
  'vr3.doc.issue.b23': 'Nennt 48 Wohnungen · widerspricht Plänen und Liste',
  'vr3.doc.issue.b24': 'Nordkante fehlt · Gebäudebezeichnung nicht vorhanden · Erkennung fehlgeschlagen',
  'vr3.doc.issue.b25': 'Vollständiges Untergeschoss dargestellt',
  'vr3.doc.issue.b26': 'Teil-Untergeschoss · 22 Stellplätze',
  'vr3.doc.issue.b27': 'Einzelhandel 1.080 m²',
  'vr3.doc.issue.b28': 'Gewerbe-NUF 920 m²',
  'vr3.doc.issue.b29': 'Fünf Wohngeschosse',
  'vr3.doc.issue.b30': 'Gebäude als „Haus 3“ bezeichnet',
  'vr3.doc.issue.b31': 'Höhenmaß 22,8 oder 23,8 nicht eindeutig',
  'vr3.doc.issue.b32': 'Vollständiges Untergeschoss dargestellt',
  'vr3.doc.issue.b33': 'Teil-Untergeschoss dargestellt',
  'vr3.doc.issue.b34': 'Nennt das Erdgeschoss „Einzelhandel und Gastronomie“ · Kundenvorgabe sagt Gewerbe',
  'vr3.doc.issue.b35': 'Gebäudebezeichnungen A, B und C eindeutig',
  'vr3.doc.issue.b36': 'Heiztabelle nutzt alte Flächen von B und C',
  'vr3.conflict.B-CF-01.concept': 'Gesamt-BGF des Projekts',
  'vr3.conflict.B-CF-01.matters': 'Die Gesamt-BGF bestimmt die kommerzielle Größenordnung des gesamten Angebots.',
  'vr3.conflict.B-CF-01.affects': 'Wirkt auf alle Kostengruppen und die Gesamtsumme.',
  'vr3.conflict.B-CF-02.concept': 'Wohnungsanzahl Gebäude B',
  'vr3.conflict.B-CF-02.matters': 'Die Wohnungsanzahl bestimmt Mengen für Wohnungsausbau, Sanitär und Elektro.',
  'vr3.conflict.B-CF-02.affects': 'Wirkt auf Mengen der Wohnungsleistungen.',
  'vr3.conflict.B-CF-03.concept': 'Umfang des Untergeschosses in Gebäude C',
  'vr3.conflict.B-CF-03.matters': 'Der Umfang des Untergeschosses bestimmt Erdarbeiten, Tragwerk, Technik und Stellplätze.',
  'vr3.conflict.B-CF-03.affects': 'Wirkt auf KG 200, KG 300, KG 400 und die Stellplätze.',
  'vr3.conflict.B-CF-03.candidate.full': 'Vollständiges Untergeschoss',
  'vr3.conflict.B-CF-03.candidate.partial': 'Teil-Untergeschoss',
  'vr3.conflict.B-CF-04.concept': 'Gewerbefläche Gebäude C',
  'vr3.conflict.B-CF-04.matters': 'Die Gewerbefläche bestimmt Nutzungsverteilung und Ausbaustandard im Erdgeschoss.',
  'vr3.conflict.B-CF-04.affects': 'Wirkt auf Nutzungsverteilung und Kosten.',
  'vr3.conflict.B-CF-05.concept': 'NUF Gebäude A',
  'vr3.conflict.B-CF-05.matters': 'Die Nutzungsfläche bestimmt die Mengen für den Büroausbau.',
  'vr3.conflict.B-CF-05.affects': 'Wirkt auf Mengen des Büroausbaus.',
  'vr3.conflict.B-CF-06.concept': 'Geschossanzahl Gebäude A aus Scan',
  'vr3.conflict.B-CF-06.matters': 'Die Geschossanzahl bestimmt Gebäudeklasse und die daraus folgenden Brandschutzleistungen.',
  'vr3.conflict.B-CF-06.affects': 'Wirkt auf Klassifikation und Brandschutzleistungen.',
  'vr3.conflict.B-CF-06.candidate.six': '6 Obergeschosse',
  'vr3.conflict.B-CF-06.candidate.five': '5 Obergeschosse',
  'vr3.question.B-Q-01.question': 'Ist die Gewerbefläche im Erdgeschoss von C nur Einzelhandel oder Einzelhandel und Gastronomie?',
  'vr3.question.B-Q-01.matters': 'Ändert Annahmen zu Lüftung, Sanitär und Ausbau.',
  'vr3.question.B-Q-01.evidence': 'Nutzungskonzept gegen allgemeine Kundenformulierung.',
  'vr3.question.B-Q-01.response': 'Basis: nur Einzelhandel · Gastronomie als Szenario vermerkt.',
  'vr3.question.B-Q-02.question': 'Umfasst Gebäude A den Mieterausbau oder nur Rohbau und Kern?',
  'vr3.question.B-Q-02.matters': 'Wesentlicher Umfangseffekt auf KG 300 und KG 400.',
  'vr3.question.B-Q-02.evidence': 'Nachtrag zur Kundenvorgabe unvollständig.',
  'vr3.question.B-Q-02.response': 'Annahme: Rohbau und Kern · Kundenbestätigung angefordert.',
  'vr3.question.B-Q-03.question': 'Sind 36 Tiefgaragenstellplätze für B endgültig?',
  'vr3.question.B-Q-03.matters': 'Wirkt auf KG 300, KG 400 und KG 500.',
  'vr3.question.B-Q-03.evidence': 'Alter Plan nennt 42 · aktueller Plan nennt 36.',
  'vr3.question.B-Q-03.response': 'Aus der Quelle beantwortet: 36 bestätigt.',
  'vr3.question.B-Q-04.question': 'Sind die 22 Stellplätze unter Gebäude C einzeln für Ladeinfrastruktur vorbereitet?',
  'vr3.question.B-Q-04.matters': 'Bestimmt den Ansatz für die Elektroinfrastruktur.',
  'vr3.question.B-Q-04.evidence': 'Der Plan zeigt die Stellplätze · das Fachkonzept schweigt dazu.',
  'vr3.question.B-Q-04.response': 'Leerrohrreserve enthalten · Ladehardware ausgeschlossen.',
  'vr3.question.B-Q-05.question': 'Gehört der Rückbau der früheren Ladeplatte zum Auftragsumfang?',
  'vr3.question.B-Q-05.matters': 'Wirkt auf den Umfang von KG 200 und auf das Terminrisiko.',
  'vr3.question.B-Q-05.evidence': 'Der Freianlagenplan zeigt die Platte · die Vorgabe erwähnt keinen Rückbau.',
  'vr3.question.B-Q-05.response': 'Vorsorglicher Ansatz enthalten.',
  'vr3.question.B-Q-06.question': 'Welche Fassadenzertifizierung gilt für Gebäude A?',
  'vr3.question.B-Q-06.matters': 'Bestimmt Beschaffung und technische Spezifikation.',
  'vr3.question.B-Q-06.evidence': 'Der Brandschutzscan hat eine geringe Erkennung.',
  'vr3.question.B-Q-06.response': 'Geprüfte Ausgabe des Brandschutzplaners vor dem endgültigen Angebot erforderlich.',
  'vr3.question.B-Q-07.question': 'Dürfen die Freianlagen von Gebäude B mit dem gemeinsamen Hofpaket zusammengefasst werden?',
  'vr3.question.B-Q-07.matters': 'Vermeidet eine Doppelzählung in KG 500.',
  'vr3.question.B-Q-07.evidence': 'Der Freianlagenplan fasst die Zonen zusammen.',
  'vr3.question.B-Q-07.response': 'Gemeinsames Projektpaket · Anteil von B wird abgeleitet.',
  'vr3.question.B-Q-08.question': 'Möchte der Kunde eine Übergabe oder mehrere Bauabschnitte?',
  'vr3.question.B-Q-08.matters': 'Wirkt auf Terminlogik und Baustelleneinrichtung.',
  'vr3.question.B-Q-08.evidence': 'Keine herausgegebene Vorgabe.',
  'vr3.question.B-Q-08.response': 'Basis: eine Übergabe · abweichendes Szenario im Kundenmodus verfügbar.',
  'vr3.question.B-DS-01.question': 'Die Höhe von Gebäude C liest sich als 22,8 oder 23,8 Meter.',
  'vr3.question.B-DS-01.matters': 'Wirkt auf die Klassifikation und ihre Prüfung.',
  'vr3.question.B-DS-01.evidence': 'Ansichten mit geringer Erkennung gegen den aktuellen Schnitt.',
  'vr3.question.B-DS-01.response': 'Manuell 22,8 Meter aus dem Schnitt erfasst · manuell erfasst und aus Quelle belegt.',
  'vr3.question.B-DS-02.question': 'Das Energiekonzept nutzt ältere Flächen von B und C.',
  'vr3.question.B-DS-02.matters': 'Technikmengen könnten zu niedrig angesetzt sein.',
  'vr3.question.B-DS-02.evidence': 'Fachkonzept gegen die aktuellen Pläne.',
  'vr3.question.B-DS-02.response': 'Mengen aus den bestätigten aktuellen Flächen neu ermittelt.',
  'vr3.gate.reason.blockingConflicts': 'Gesperrt: {count} blockierende strittige Angaben entscheiden. Offene Fragen bleiben separat prüfbar.',
  'vr3.gate.reason.blockingQuestions': 'Gesperrt: {count} Fragen sind fachlich als blockierend eingestuft und brauchen eine Antwort.',
  'vr3.gate.reason.staleBaseline': 'Gesperrt: {count} bestätigte Werte müssen nach der Dokumentänderung erneut geprüft werden.',
  'vr3.gate.reason.incompleteBaseline': 'Gesperrt: die erforderliche Projektgrundlage ist noch nicht vollständig.',
  'vr3.gate.reason.analysisNotStarted': 'Gesperrt: die Dokumentanalyse wurde noch nicht gestartet.',
  'vr3.gate.reason.analysisRunning': 'Gesperrt: die Dokumentanalyse läuft noch.',
  'vr3.asset.alt.A-PROJECT-HERO': 'Fünfgeschossiges Mehrfamilienhaus mit warmer Mineralfassade an einem bepflanzten Innenhof',
  'vr3.asset.alt.A-PLAN-EG': 'Schematischer Grundriss Erdgeschoss mit vier Wohnungen und mittigem Erschließungskern',
  'vr3.asset.alt.A-ELEVATIONS': 'Schematische Ansichten Nord und Ost des Wohnhofs',
  'vr3.asset.alt.A-SECTION-AA': 'Schematischer Schnitt A-A durch den Wohnhof ohne Untergeschoss',
  'vr3.asset.alt.B-PROJECT-HERO': 'Quartier mit drei unterschiedlichen Baukörpern um einen begrünten Innenhof',
  'vr3.asset.alt.B-BLDG-A-KONTORHAUS': 'Sechsgeschossiges Bürogebäude mit tiefer Rasterfassade, ohne Untergeschoss',
  'vr3.asset.alt.B-BLDG-B-HOFHAUS': 'Fünfgeschossiges Wohnhaus am Hof mit Klinkerfassade, Balkonen und Tiefgaragenzufahrt',
  'vr3.asset.alt.B-BLDG-C-STADTHAUS': 'Siebengeschossiges Wohn- und Geschäftshaus mit verglaster Gewerbezone im Erdgeschoss',
  'vr3.asset.alt.B-SITE-PLAN': 'Lageplan des Quartiers mit den beschrifteten Baukörpern A, B und C um den Innenhof',
  'vr3.asset.alt.B-PLAN-A': 'Schematischer Bürogrundriss des Kontorhauses',
  'vr3.asset.alt.B-PLAN-B': 'Schematischer Wohnungsgrundriss des Hofhauses mit Untergeschoss',
  'vr3.asset.alt.B-PLAN-C': 'Schematischer Grundriss des Stadthauses mit teilweisem Untergeschoss',
  'vr3.asset.alt.B-ELEVATIONS': 'Vergleichende Ansichten der drei Baukörper des Quartiers',
  'vr3.asset.alt.B-SECTION': 'Schnitt durch Hofhaus und Stadthaus mit Untergeschoss- und Geschossnachweis',
  'vr3.option.rename': 'Umbenennen',
  'vr3.option.nameLabel': 'Name der Option',
  'vr3.option.nameTaken': 'Der Name «{name}» wird bereits verwendet · anderen Namen wählen',
  'vr3.option.state.sent': 'Versendet',
  'vr3.option.state.inProgress': 'In Arbeit',
  'vr3.option.state.new': 'Neu',
  'vr3.option.lastChanged': 'Zuletzt geändert',
  'vr3.list.empty.filtered': 'Keine Opportunity entspricht der Suche.',
  'vr3.option.error.gateClosed': 'Die Option wurde nicht angelegt: eine Voraussetzung hat sich geändert, während die Aktion lief. Die Projektgrundlage und alle Entscheidungen sind unverändert.',
  'vr3.option.error.baseline': 'Die Option wurde nicht angelegt: die Projektgrundlage ließ sich nicht festschreiben. Alle Entscheidungen und Konfliktlösungen sind unverändert.',
  'vr3.list.eyebrow': 'Demonstrationsportfolio · {count} Projekte',
  'vr3.list.eyebrowOne': 'Demonstrationsportfolio · 1 Projekt',
  'opplist.filter.city.label': 'Stadt',
  'opplist.empty.filtered.reset': 'Alle Filter zurücksetzen',
  'vr3.list.card.actionOn': '{action} · {name}',
  'vr3.list.title': 'Projekte',
  'vr3.list.lead': 'Zwei vollständige Beispiele: ein klarer Weg zum indikativen Angebot und eine bewusst realistische Informationslage.',
  'vr3.list.filterToggle': 'Filtern und sortieren',
  'vr3.list.card.documentation': 'Dokumentation',
  'vr3.list.card.documentationComplete': 'Vollständig',
  'vr3.journal.rerunAnalysis': 'Dokumentanalyse erneut ausgeführt · {project}',
  'vr3.journal.documentReplaced': 'Dokument ersetzt · {document} → {file}',
  'vr3.journal.documentRemoved': 'Dokument entfernt · {document}',
  'vr3.journal.conflictResolved': 'Strittige Angabe entschieden · {conflict}',
  'vr3.journal.conflictReopened': 'Strittige Angabe zurückgestellt · {conflict}',
  'vr3.journal.questionAnswered': 'Offene Frage {question} · Antwort erfasst',
  'vr3.journal.questionAssumed': 'Offene Frage {question} · Annahme dokumentiert',
  'vr3.journal.optionCreated': 'Opportunity Option «{option}» angelegt',
  'vr3.journal.optionRenamed': 'Opportunity Option «{previous}» in «{next}» umbenannt',
  'vr3.journal.projectBaselineConfirmed': 'Projektparameter bestätigt (Gebäude, Flächen, Einheiten)',
  'vr3.list.card.analysis': 'Dokumentanalyse',
  'vr3.list.card.openConflicts': 'Offene strittige Angaben',
  'vr3.list.card.blockingConflicts': 'Blockierende strittige Angaben',
  'vr3.list.card.recognitionWarnings': 'Erkennungshinweise',
  'vr3.list.card.facts': '{buildings} · {documents}',
  'vr3.list.card.buildingsOne': '1 Gebäude',
  'vr3.list.card.buildingsMany': '{count} Gebäude',
  'vr3.list.card.documentsMany': '{count} Dokumente',
  'vr3.list.card.openProject': 'Projekt öffnen',
  'vr3.list.card.reviewProject': 'Projekt prüfen',
  'vr3.list.card.units': '{count} Wohnungen',
  'vr3.analysis.eyebrow.notStarted': 'Dokumentation vorhanden · Analyse nicht gestartet',
  'vr3.analysis.eyebrow.running': 'Dokumentanalyse · {done} von {total} Dateien',
  'vr3.analysis.notStarted.lead': 'Die {count} Projektdokumente liegen bereit. Die Analyse liest, klassifiziert und vergleicht sie und gibt danach erkannte Werte, Gebäude, Fragen, strittige Angaben und die Projektreife frei.',
  'vr3.analysis.notStarted.absenceTitle': 'Noch keine Analyseergebnisse',
  'vr3.analysis.notStarted.absenceDetail': 'Werte, strittige Angaben und Fragen entstehen erst, wenn die Analyse Belege erzeugt hat. Vorher existieren sie nicht und werden deshalb auch nicht als leere Übersicht angezeigt.',
  'vr3.analysis.start': 'Dokumentanalyse starten',
  'vr3.analysis.inspectDocuments': '{count} Dokumente ansehen',
  'vr3.analysis.inventoryTitle': '{count} Dokumente in der Warteschlange',
  'vr3.analysis.inventoryLead': 'Grundrisse, Ansichten, Schnitte und Beschreibungen — gezählt aus dem Dokumentenregister selbst.',
  'vr3.analysis.tally.floorPlan': 'Grundrisse · {count}',
  'vr3.analysis.tally.elevations': 'Ansichten · {count}',
  'vr3.analysis.tally.section': 'Schnitte · {count}',
  'vr3.analysis.tally.other': 'Weitere Unterlagen · {count}',
  'vr3.analysis.title.running.clean': 'Das Projekt wird verstanden',
  'vr3.analysis.title.running.complex': 'Revisionen und Belege werden verglichen',
  'vr3.analysis.title.attention': 'Ein Dokument braucht Aufmerksamkeit',
  'vr3.analysis.title.complete': 'Alle Dokumente sind verarbeitet',
  'vr3.analysis.lead.complete':
    'Der Verlauf jeder Datei bleibt einsehbar. Belege ersetzen oder erneut lesen ist weiterhin möglich; betroffene bestätigte Werte werden danach zur erneuten Prüfung markiert.',
  'vr3.analysis.retryPolicy':
    'Erneut lesen behält die bereits verarbeiteten Dateien; ersetzen verknüpft alten und neuen Beleg.',
  'vr3.analysis.lead.running': 'Jede Datei behält ihren eigenen Verarbeitungsstand; ein Hinweis löscht keine erfolgreichen Belege.',
  'vr3.analysis.lead.attention': 'Die Analyse kann weiterlaufen. Entscheiden oder ersetzen Sie diese Datei, bevor Sie sich auf die betroffenen Werte verlassen.',
  'vr3.analysis.phase.QUEUED': 'In der Warteschlange',
  'vr3.analysis.phase.READING': 'Wird gelesen',
  'vr3.analysis.phase.CLASSIFYING': 'Wird klassifiziert',
  'vr3.analysis.phase.EXTRACTING': 'Werte werden ausgelesen',
  'vr3.analysis.phase.CROSS_CHECKING': 'Wird gegengeprüft',
  'vr3.analysis.outcome.PROCESSED': 'Verarbeitet',
  'vr3.analysis.outcome.WARNING': 'Hinweis',
  'vr3.analysis.outcome.LOW_CONFIDENCE': 'Geringe Erkennung',
  'vr3.analysis.outcome.FAILED': 'Fehlgeschlagen',
  'vr3.analysis.outcome.REMOVED': 'Entfernt',
  'vr3.analysis.next': 'Danach: dokumentübergreifender Vergleich, dann das Projektverständnis',
  'vr3.analysis.filter.legend': 'Dateien filtern',
  'vr3.analysis.filter.all': 'Alle Dateien',
  'vr3.analysis.filter.attention': 'Brauchen Aufmerksamkeit',
  'vr3.analysis.filter.processed': 'Verarbeitet',
  'vr3.analysis.filterNotice': 'Der Filter ändert nur die angezeigten Zeilen. Die Gesamtzahlen oben bleiben unverändert.',
  'vr3.analysis.cancel': 'Analyse anhalten',
  'vr3.analysis.resume': 'Analyse fortsetzen',
  'vr3.analysis.rerun': 'Analyse erneut ausführen',
  'vr3.analysis.action.retry': 'Erneut lesen',
  'vr3.analysis.action.replace': 'Datei ersetzen',
  'vr3.analysis.action.remove': 'Entfernen',
  'vr3.analysis.action.inspect': 'Beleg ansehen',
  'vr3.analysis.replacementSuffix': 'ersetzt durch {file}',
  'vr3.analysis.removeConfirm': 'Dokument {file} wirklich entfernen? Die Entfernung wird im Journal festgehalten und kann rückgängig gemacht werden.',
  'vr3.analysis.failureTitle': '{file} konnte nicht erkannt werden',
  'vr3.analysis.failureDetail': 'Betroffen: {affected}. Die übrigen {remaining} Dateien bleiben nutzbar, deshalb läuft die Analyse weiter.',
  'vr3.analysis.failureAffectedC': 'Geschosshöhen von Gebäude C und der Nachweis des Teil-Untergeschosses',
  'vr3.analysis.announce.started': 'Dokumentanalyse gestartet',
  'vr3.analysis.announce.file': '{file} · {state}',
  'vr3.analysis.announce.complete': 'Analyse abgeschlossen. Das Projektverständnis ist verfügbar.',
  'vr3.analysis.lineage.supersedes': 'ersetzt {file}',
  'vr3.analysis.lineage.supersededBy': 'ersetzt durch {file}',
  'vr3.analysis.lineage.duplicateOf': 'inhaltsgleiches Doppel von {file}',
  'vr3.analysis.association.project': 'Projektebene',
  'vr3.analysis.association.buildings': 'Gebäude {names}',
  'vr3.understanding.eyebrow': 'Analyse abgeschlossen · Projektverständnis verfügbar',
  'vr3.understanding.lead.clean': 'Der kürzeste sichere Weg ist offen: die erkannte Grundlage prüfen und dann die Option anlegen.',
  'vr3.understanding.lead.complex': 'Die Analyse ist stimmig genug für eine Prüfung, aber noch nicht sicher für eine Option.',
  'vr3.understanding.tab.overview': 'Übersicht',
  'vr3.understanding.tab.conflicts': 'Strittige Angaben · {count}',
  'vr3.understanding.tab.questions': 'Offene Fragen · {count}',
  'vr3.understanding.tablist': 'Bereiche des Projektverständnisses',
  'vr3.understanding.metric.buildings': 'Gebäude',
  'vr3.understanding.metric.units': 'Wohnungen',
  'vr3.understanding.metric.bgf': 'BGF R+S',
  'vr3.understanding.metric.documents': 'Dokumente',
  'vr3.understanding.metric.blockingConflicts': 'Blockierende strittige Angaben',
  'vr3.understanding.understoodTitle': 'Was das System verstanden hat',
  'vr3.understanding.valuesExtracted': '{count} Werte ausgelesen',
  'vr3.understanding.valuesAttention': '{count} brauchen Aufmerksamkeit',
  'vr3.understanding.row.sourceEvidence': 'Aus Quelle belegt',
  'vr3.understanding.row.aiInferred': 'Automatisch abgeleitet',
  'vr3.understanding.row.manualConfirmed': 'Manuell oder bestätigt',
  'vr3.understanding.row.values': '{count} Werte',
  'vr3.understanding.buildingsTitle': 'Erkannte Gebäude',
  'vr3.understanding.buildingEvidence': 'Belege: {files}',
  'vr3.understanding.terminalSummary': '{processed} verarbeitet · {warning} Hinweise · {lowConfidence} geringe Erkennung · {failed} fehlgeschlagen',
  'vr3.understanding.evidenceTitle': 'Belege und Dokumentenverlauf',
  'vr3.understanding.conflictsIntro': '{count} blockierende strittige Angaben. Jede zeigt die konkurrierenden Quellen, ihre Autorität und die Folge der Entscheidung.',
  'vr3.understanding.conflictsResolvedIntro': 'Alle blockierenden strittigen Angaben sind entschieden. Die Entscheidungen bleiben nachvollziehbar und umkehrbar.',
  'vr3.understanding.questionsIntro': '{open} offene Fragen · {blocking} davon blockieren · {assumptions} mit zulässiger Annahme.',
  'vr3.understanding.questionsNote': 'Diese Annahmen werden in die finale Prüfung übernommen und dort erneut ausgewiesen.',
  'vr3.understanding.questionsTitle': 'Fragen, keine Fehler',
  'vr3.understanding.conflictsTitle': 'Strittige Angaben entscheiden',
  'vr3.understanding.recordAnswer': 'Antwort erfassen',
  'vr3.understanding.acceptAssumption': 'Annahme dokumentieren',
  'vr3.understanding.inspectEvidence': 'Belege ansehen',
  'vr3.understanding.conflictChoiceLegend': 'Welcher Wert gilt?',
  'vr3.understanding.conflictChoiceCandidate': '{value} übernehmen',
  'vr3.understanding.conflictChoiceRecommended': 'Systemvorschlag',
  'vr3.understanding.conflictChoiceRecommendedValue': 'Empfohlener Wert',
  'vr3.understanding.conflictChoiceOlder': 'Ältere Quelle',
  'vr3.understanding.conflictChoiceSuperseded': 'Ersetzte Quelle',
  'vr3.understanding.conflictConfirm': 'Entscheidung bestätigen',
  'vr3.understanding.conflictInspect': 'Beide Quellen ansehen',
  'vr3.understanding.conflictReopen': 'Entscheidung zurücknehmen',
  'vr3.understanding.conflictRejected': 'Verworfen: {values}',
  'vr3.understanding.conflictScopeProject': 'Projektebene',
  'vr3.understanding.conflictScopeBuilding': 'Gebäude {name}',
  'vr3.understanding.staleNotice': '{count} bestätigte Werte sind nach einer Dokumentänderung erneut zu prüfen. Manuelle Werte und der Entscheidungsverlauf bleiben erhalten.',
  'vr3.readiness.eyebrow.review': 'Prüfung erforderlich',
  'vr3.readiness.eyebrow.ready': 'Projekt bereit',
  'vr3.readiness.title.ready': 'Alle blockierenden strittigen Angaben sind entschieden.',
  'vr3.readiness.lead.ready': 'Fragen, die offen bleiben dürfen, sind dokumentiert. Das Projekt hat damit eine belastbare Grundlage für die Option.',
  'vr3.readiness.row.analysisComplete': 'Analyse abgeschlossen',
  'vr3.readiness.row.blockingConflicts': 'Blockierende strittige Angaben',
  'vr3.readiness.row.resolvedConflicts': 'Entschiedene strittige Angaben',
  'vr3.readiness.row.decidedOf': '{decided} von {total}',
  'vr3.readiness.row.requiredInformation': 'Erforderliche Angaben',
  'vr3.readiness.row.requiredInformationComplete': 'Vollständig',
  'vr3.readiness.row.requiredInformationReview': 'Zu prüfen',
  'vr3.readiness.row.projectBaseline': 'Projektgrundlage',
  'vr3.readiness.row.projectBaselineConfirmed': 'Bestätigt',
  'vr3.readiness.row.projectBaselineOpen': 'Noch nicht bestätigt',
  'vr3.readiness.row.openQuestions': 'Offene Fragen',
  'vr3.readiness.row.openQuestionsValue': '{open} · {blocking} blockierend',
  'vr3.readiness.createOption': 'Option anlegen',
  'vr3.readiness.creatingOption.baseline': 'Projektgrundlage wird festgeschrieben …',
  'vr3.readiness.creatingOption.option': 'Option wird angelegt …',
  'vr3.readiness.announce.creating': 'Option wird angelegt. Die Projektgrundlage wird zuerst festgeschrieben.',
  'vr3.readiness.routeToConflicts': 'Zu den strittigen Angaben',
  'vr3.readiness.routeToQuestions': 'Zu den offenen Fragen',
  'vr3.readiness.routeToAnalysis': 'Zur Dokumentanalyse',
  'vr3.readiness.prereq.analysis': 'Dokumentanalyse abgeschlossen',
  'vr3.readiness.prereq.conflicts': 'Keine blockierenden strittigen Angaben',
  'vr3.readiness.prereq.baseline': 'Erforderliche Projektgrundlage vollständig',
  'vr3.readiness.prereq.conflictsDetail': 'Noch offen: {count}',
  'vr3.readiness.prereq.baselineDetail': '{done} von {total} Angaben',
  'vr3.readiness.alternative': 'Offene Fragen ohne Blockierung können auch später beantwortet werden; die dokumentierten Annahmen laufen sichtbar mit.',
  'vr3.readiness.optionCreated': 'Option angelegt',
  'vr3.readiness.optionCreatedLead': 'Nur Gebäude und Umfang ist jetzt verfügbar. Bestätigen Sie die Gebäudegrundlage, um den Konfigurator freizugeben.',
  'vr3.readiness.openOption': 'Option öffnen',
  'vr3.spine.label': 'Projekt- und Optionsverlauf',
  'vr3.spine.step.documents': 'Dokumente',
  'vr3.spine.step.understanding': 'Projektverständnis',
  'vr3.spine.step.createOption': 'Option anlegen',
  'vr3.spine.step.buildingScope': 'Gebäude und Umfang',
  'vr3.spine.step.scopeBoundaries': 'Leistungsabgrenzung',
  'vr3.spine.step.schedule': 'Terminplan',
  'vr3.spine.step.finalValidation': 'Finale Prüfung',
  'vr3.spine.reason.documentsNotStarted': 'Analyse noch nicht gestartet',
  'vr3.spine.reason.needsAnalysis': 'Dokumentanalyse fehlt',
  'vr3.spine.reason.needsReadiness': 'Projekt noch nicht bereit',
  'vr3.spine.reason.needsOption': 'Option fehlt',
  'vr3.spine.reason.needsBuildingScope': 'Gebäudeumfang noch nicht gespeichert',
  'vr3.spine.reason.locked': 'Voraussetzung fehlt',
  'vr3.spine.reason.needsScopeDecisions': 'Leistungsabgrenzung noch offen',
  'vr3.option.created.heading': '«{option}» ist bereit für ihre Grundlage',
  'vr3.option.created.lead':
    'Nur Gebäude & Umfang ist jetzt verfügbar. Wählen und bestätigen Sie die '
    + 'Gebäudegrundlage, um den Konfigurator freizugeben.',
  'vr3.option.created.nextLabel': 'Nächster Schritt: Gebäude & Umfang',
  'vr3.option.created.nextDetail':
    'Konfigurator, Terminplan, finale Prüfung und Kundenmodus bleiben gesperrt, '
    + 'bis ihre Voraussetzungen erfüllt sind.',
  'vr3.option.created.action': 'Gebäude & Umfang festlegen',
  'vr3.spine.projectLabel': 'Projekt',
  'vr3.evidence.assetCaption': '{label} · Demonstrationsbeleg',
  'vr3.evidence.failedPreview': 'Vorschau nicht verfügbar: der Scan ist beschnitten und die Erkennung ist fehlgeschlagen.',
} as const

export type MessageKey = keyof typeof de

/**
 * Локальный словарь оболочки. EN здесь полный: остаток перевода живёт в
 * поставках Codex, а не в этой таблице, и меряется обходом DOM
 * (`src/i18n/__tests__/en-remainder.dom.test.tsx`).
 */
const en: Partial<Record<MessageKey, string>> = {
  // VR2-00: internal Grundlagen QA surface — product-locale EN so nothing
  // in the visible specimen shell reads as untranslated diagnostic content.
  'grundlagen.specimen.badge': 'Internal · QA specimen',
  'grundlagen.specimen.headline': 'Internal QA surface — not a product',
  'grundlagen.specimen.body':
    'This screen is an internal design-system specimen for quality assurance. It is not a product or client surface and does not count as evidence of product adoption.',
  'diagnostics.title': 'Foundation checks',
  'diagnostics.failed':
    'Not met: {failed} of {total}. The product must not be assembled on this basis — resolve these first.',
  'diagnostics.col.check': 'Check',
  'diagnostics.col.state': 'State',
  'diagnostics.col.detail': 'Detail',
  'diagnostics.state.checking': '◌ checking',
  'diagnostics.state.ok': '✓ met',
  'diagnostics.state.fail': '✗ not met',
  'diagnostics.check.fonts': 'Visuelt Pro — three weights',
  'diagnostics.check.cascade': 'Font cascade and white background',
  'diagnostics.check.tokens': 'Design-system tokens resolve',
  'diagnostics.check.drivers': 'Cost drivers sum to the total',
  'diagnostics.check.blocker': 'Output blocker closes five profiles',
  'diagnostics.detail.fonts.ok': 'Regular, Medium, Bold available to the browser',
  'diagnostics.detail.fonts.missing': 'unavailable: {missing}',
  'diagnostics.detail.fonts.waiting': 'awaiting document.fonts.ready',
  'diagnostics.detail.cascade.ok':
    'html, body and form elements carry font-family; background white',
  'diagnostics.detail.cascade.waiting': 'awaiting',
  'diagnostics.detail.tokens.ok': 'Accent {accent} · spacing step {space}',
  'diagnostics.detail.tokens.fail':
    'variables did not resolve — tokens.css not loaded',
  'diagnostics.detail.drivers.ok': '{count} drivers total {sum}, result {total}',
  'diagnostics.detail.drivers.fail': 'drivers did not load',
  'diagnostics.detail.blocker.ok': '{id} · {state} · {materiality} · {count} profiles',
  'diagnostics.detail.blocker.fail': 'blocker did not load',
  'diagnostics.fixture':
    'Fixture: {scenario} · run {run} · rules {rules} · Regional factor {factor}',
  'diagnostics.value.regionalFactor.active': 'active',
  'diagnostics.value.regionalFactor.inactive': 'inactive',
  'diagnostics.value.issueState.open': 'open',
  'diagnostics.value.issueState.resolved': 'resolved',
  'diagnostics.value.materiality.material': 'material',
  'diagnostics.value.materiality.warning': 'warning',
  'nav.projekte': 'Projects',
  'nav.vorbereitung': 'Preparation',
  'nav.buildingScope': 'Building & scope',
  'nav.konfigurator': 'Configurator',
  'nav.vergleich': 'Variant comparison',
  'nav.export': 'Export',
  'nav.einstellungen': 'Settings',
  'nav.grundlagen': 'Foundations',
  'nav.tour': 'Tour of the tool',
  'shell.prototypeNote': 'Prototype · arithmetic real, parsing simulated',
  'shell.account': 'Account',
  'shell.accountUnavailable': 'No verified session identity is available.',
  'shell.signOut': 'Sign out',
  'shell.optionSwitcher': 'Opportunity option',
  'shell.sidebar.workflow': 'Current option',
  'shell.sidebar.outputs': 'Output',
  'shell.fontWarning': 'Visuelt Pro could not be loaded reliably. Check the presentation before sharing.',
  'configurator.scope.introBinary': 'Choose whether each cost group is included in the offer. Its configuration is retained when excluded.',
  'configurator.scope.changed': 'The scope has changed since it was last confirmed.',
  'configurator.scope.confirmAndContinueHelp': 'Confirm the scope and continue to the first included cost group.',
  'configurator.scope.continue': 'Continue to configuration',
  'configurator.scope.confirmAndContinue': 'Confirm scope and continue',
  'configurator.scopeCatalog.currentChoice': 'current selection',
  'configurator.scopeCatalog.assumption': 'Assumption — not yet confirmed',
  'configurator.scopeCatalog.quantityLabel': 'Quantity for this item',
  'configurator.scopeCatalog.guaranteeAmountLabel': 'Guaranteed amount',
  'configurator.scopeCatalog.footnote': '⚙ · derived for the prototype, not calibrated. The price effect appears immediately in the offer column on the right and in the cost drivers.',
  'configurator.scopeCatalog.kg800RevealSwitch': 'Reveal for this meeting',
  'configurator.scopeCatalog.kg800RevealHelp': 'Shows the financing breakdown in client view too — default: private.',
  'configurator.scopeCatalog.kg800NoBasis': 'KG 800 has no calculation basis yet — the preceding offer block (KG 100–700) must total a positive amount first.',
  'kg700.all3UnavailableReason':
    'The All3 method is available only when both KG 300 and KG 400 are included.',
  'shell.mode.intern': 'Internal',
  'shell.mode.praesentation': 'Presentation',
  'shell.mode.blockedReason':
    'Confirm every selected building baseline first and save the building scope.',
  'shell.mode.legend': 'Mode',
  'shell.mode.work': 'WORK',
  'shell.profile.legend': 'View',
  'shell.profile.internal': 'Preparation',
  'shell.profile.client': 'Client view',
  'shell.profile.check': 'Review client view',
  'shell.profile.exit': 'Exit',
  'shell.profile.clientIndicator': 'Client view — the client can see this screen',
  'shell.profile.internalIndicator': 'Preparation — visible internally only',
  'shell.viewport.title': 'Screen too small',
  'shell.viewport.body': 'This workspace requires a screen width of at least 1280 px.',
  'comparison.differencesHint': 'Differences and result values are shown first.',
  'comparison.allHint': 'All comparison rows are visible.',
  'comparison.leadRate': 'Lead rate',
  'comparison.headline': "Decide, don't just compare.",
  'comparison.optionCountSingular': '{n} Option',
  'comparison.optionCountPlural': '{n} Options',
  'comparison.overflowHint': 'Option {n} reachable by scrolling',
  'shell.variant': 'Variant “Basis”',
  'shell.phase.vorbereitung': 'Preparation',
  'common.undo': 'Undo',
  'common.close': 'Close',
  'common.showOrigin': 'Show origin',
  'provenance.accessibleLabel': 'Origin: {label}',
  'provenance.accessibleLabelWithDetail': 'Origin: {label} · {detail}',
  'common.loading': 'Loading',
  'common.fieldLoading': 'Field is loading',
  'configurator.schedule.dateInvalid': 'Invalid date — use DD.MM.YYYY',
  'designSystem.workflowStepper.state.upcoming': 'upcoming',
  'designSystem.workflowStepper.state.current': 'current',
  'designSystem.workflowStepper.state.done': 'complete',
  'designSystem.workflowStepper.state.attention': 'needs attention',
  'designSystem.workflowStepper.state.blocked': 'blocked',
  'designSystem.workflowStepper.state.skipped': 'skipped',
  'designSystem.workflowStepper.position': 'Step {n} of {total}',
  'designSystem.workflowStepper.why': 'Why?',
  'common.fulfilled': 'Complete',
  'common.open': 'Open',
  'designSystem.readinessSummary': '{done} of {total} points ready',
  'oppcard.prerequisitesSummary': '{done} of {total} prerequisites complete',
  'oppcard.prerequisites.fulfilledStale': 'Complete · no longer current',
  'oppcard.stepPosition': 'Step {n} of {total}',
  'oppcard.customerEvidence': 'confirmed by customer on {date}',
  'oppcard.baseline.title': 'Project baseline',
  'oppcard.baseline.intro':
    'Shared basis for all Opportunity Options in this project.',
  'oppcard.baseline.primaryFacts': 'Core project facts',
  'option.deltaVsBaseline': 'Difference to {baseline}',
  'oppcard.baseline.bgfBreakdown': 'Gross floor area (GFA)',
  'oppcard.baseline.confirmConsequence':
    'Confirming releases this baseline for Opportunity Options.',
  'oppcard.baseline.confirmed': 'Confirmed · project baseline current',
  'oppcard.baseline.confirmedStale': 'Confirmed · no longer current',
  'oppcard.baseline.stale':
    'Changed since confirmation: {changes}. The confirmed baseline is retained and must be reviewed again.',
  'oppcard.baseline.reconfirm': 'Confirm again',
  'oppcard.baseline.stepStale': 'Changed · confirm again',
  'oppcard.baseline.preparationSummary':
    'Preparation · Open questions: {questions} · Active assumptions: {assumptions}',
  'oppcard.baseline.bgfEquation':
    'GFA R plus GFA S equals GFA R+S; NFA is derived from that total.',
  'oppcard.baseline.previewEyebrow': 'Project baseline · preview',
  'oppcard.baseline.previewSummary': '{count} buildings · {bgf} m² GFA above ground',
  'oppcard.baseline.previewCta': 'View baseline',
  'oppcard.evidence.heading': 'Documents & evidence',
  'oppcard.evidence.subheading':
    'Analysis result, drawing version and missing details in one working view.',
  'oppcard.evidence.remedyDisclosure': 'Fix',
  'oppcard.identity.eyebrow': 'Opportunity',
  'oppcard.identity.factDocuments': 'Documents',
  'oppcard.nextDecision.eyebrow': 'Next decision',
  'oppcard.nextDecision.conflict.headline': 'WFL nach WoFlV',
  'oppcard.nextDecision.conflict.body':
    'Consequence: the lead metric denominator changes. The subtotal stays the same.',
  'oppcard.nextDecision.conflict.cta': 'Decide the conflict',
  'oppcard.nextDecision.baseline.headline': 'Confirm the project baseline',
  'oppcard.nextDecision.baseline.body':
    'All conflicts are decided. Confirming releases Opportunity Options for creation.',
  'oppcard.nextDecision.baseline.cta': 'Open the project baseline',
  'oppcard.nextDecision.options.headline': 'Create an Opportunity Option',
  'oppcard.nextDecision.options.body':
    'The project baseline is confirmed. Next, the first Opportunity Option is created.',
  'oppcard.nextDecision.options.cta': 'Go to Opportunity Options',
  'oppcard.nextDecision.optionsExist.headline': 'Project decisions complete',
  'oppcard.nextDecision.optionsExist.body':
    'All conflicts are decided, the project baseline is confirmed, and at least one Opportunity Option exists. Further work continues inside that Option.',
  'oppcard.nextDecision.optionsExist.cta': 'Open Opportunity Options',
  'oppcard.notWorked.explainer':
    'This opportunity is not worked out in the prototype. «{name}» is the fully calculated one — document analysis, conflict resolution and calculation run there with real arithmetic.',
  'oppcard.actionDock.conflict.summary': '1 decision before the project baseline',
  'oppcard.actionDock.conflict.cta': 'Decide the WFL conflict',
  'oppcard.stage.documents.attention': '1 document not readable',
  'oppcard.stage.documents.done': 'Analysis complete',
  'oppcard.stage.conflict.open': '1 decision required',
  'oppcard.stage.conflict.done': 'Decided',
  'oppcard.stage.baseline.confirmed': 'Confirmed',
  'oppcard.stage.baseline.attention': 'Confirmation required',
  'oppcard.stage.options.done': 'Created',
  'oppcard.stage.options.ready': 'Ready to create',
  'oppcard.stage.options.waiting': 'Waiting on the prerequisites above',
  'oppcard.stage.options.blockedBoth': 'Resolve conflicts and baseline first',
  'oppcard.nextDecision.conflict.document': 'Document',
  'oppcard.nextDecision.conflict.customer': 'Client',
  'oppcard.rail.recommendation.title': 'Recommendation',
  'oppcard.rail.recommendation.gkSummary':
    'Building class not yet confirmed. Provisionally GK 5 · review required.',
  'oppcard.rail.recommendation.cta': 'Review classification',
  'buildingScope.gate.navigationReason':
    'Confirm every selected building baseline first and save the building scope.',
  'buildingScope.title': 'Building & scope',
  'buildingScope.meta':
    'Before the Configurator · {confirmed} of {selected} selected buildings confirmed',
  'buildingScope.lede':
    'Set the offer scope and review the building data before configuration and pricing begin.',
  'buildingScope.selection.title': 'Buildings in the offer',
  'buildingScope.selection.intro':
    'Select every building that should be part of this option. Deselected buildings retain their data.',
  'buildingScope.selection.dataLabel': 'Discovered buildings',
  'buildingScope.selection.manageOpen': 'Manage buildings',
  'buildingScope.selection.manageClose': 'Close management',
  'buildingScope.review.title': 'Review building data',
  'buildingScope.review.intro':
    'Review and confirm each selected building separately. Unknown optional data remains explicit.',
  'buildingScope.review.empty':
    'No building selected yet. Select at least one building above for this option.',
  'buildingScope.fact.name': 'Documentation name',
  'buildingScope.fact.address': 'Address',
  'buildingScope.fact.form': 'Building form',
  'buildingScope.fact.class': 'Building class under MBO §2',
  'buildingScope.fact.bgfRAbove': 'GFA R · above ground',
  'buildingScope.fact.bgfSAbove': 'GFA S · above ground',
  'buildingScope.fact.bgfRSAbove': 'GFA R+S · above ground',
  'buildingScope.fact.bgfRBelow': 'GFA R · below ground',
  'buildingScope.fact.bgfSBelow': 'GFA S · below ground',
  'buildingScope.fact.bgfRSBelow': 'GFA R+S · below ground',
  'buildingScope.fact.bgfRSTotal': 'GFA R+S · total',
  'buildingScope.fact.wfl': 'Living area under WoFlV',
  'buildingScope.fact.nuf': 'Usable area under DIN 277',
  'buildingScope.fact.units': 'Units',
  'buildingScope.fact.storeys': 'Number of storeys',
  'buildingScope.value.notCaptured': '○ Not captured',
  'buildingScope.value.addressMissing': 'Address not captured',
  'buildingScope.value.formMissing': 'Building form not captured',
  'buildingScope.value.classMissing': 'Building class not captured',
  'buildingScope.value.storeysMissing': 'Storey structure not captured',
  'buildingScope.value.conflictOpen':
    'Conflict open — select a reliable value below.',
  'buildingScope.form.mfh': 'Multi-family building',
  'buildingScope.form.efh': 'Single-/two-family building',
  'buildingScope.form.row': 'Semi-detached/terraced building',
  'buildingScope.form.office': 'Office building',
  'buildingScope.class.gk13': 'Class 1–3',
  'buildingScope.class.gk4': 'Class 4',
  'buildingScope.class.gk5': 'Class 5',
  'buildingScope.class.helper':
    'The building confirmation also covers the displayed classification under MBO §2.',
  'buildingScope.provenance.document': 'Document',
  'buildingScope.provenance.derived': 'Derived',
  'buildingScope.provenance.customer': 'Client-confirmed',
  'buildingScope.provenance.manual': 'Manually edited',
  'buildingScope.status.confirmed': 'Confirmed',
  'buildingScope.status.conflict': 'Conflict open',
  'buildingScope.status.conflictResolved': 'Conflict resolved',
  'buildingScope.status.open': 'Not yet confirmed',
  'buildingScope.announcement.added': '{building} added to the offer.',
  'buildingScope.announcement.removed': '{building} removed from the offer.',
  'buildingScope.announcement.confirmed': '{building} confirmed.',
  'buildingScope.announcement.invalidated':
    'Confirmation removed — data changed: {building}.',
  'buildingScope.recovery.title':
    'Configuration confirmation removed: {buildings}.',
  'buildingScope.recovery.detail':
    'The affected building data is no longer confirmed. Other valid configuration work remains saved.',
  'buildingScope.recovery.remedy':
    'Review the data and confirm the building again. Then reconfirm the affected configuration.',
  'buildingScope.tabs.label': 'Selected buildings',
  'buildingScope.tabs.first': 'Go to first building tab',
  'buildingScope.tabs.last': 'Go to last building tab',
  'buildingScope.tabs.current': 'Currently reviewing',
  'buildingScope.readiness.primaryAction': 'Primary action',
  'buildingScope.group.identity': 'Identity & use',
  'buildingScope.group.above': 'Above-ground areas',
  'buildingScope.group.below': 'Below-ground areas',
  'buildingScope.group.total': 'Areas',
  'buildingScope.group.storeys': 'Geometry & storeys',
  'buildingScope.headline.one': 'One building. One clear foundation.',
  'buildingScope.headline.two': 'Two buildings. One clear foundation.',
  'buildingScope.headline.three': 'Three buildings. One clear foundation.',
  'buildingScope.headline.many': '{count} buildings. One clear foundation.',
  'buildingScope.areas.above': 'Above-ground areas',
  'buildingScope.areas.below': 'Below-ground areas',
  'buildingScope.areas.totals': 'Totals and usable areas',
  'buildingScope.sectionStatus.notReviewed': 'Not reviewed',
  'buildingScope.sectionStatus.needsAttention': 'Needs attention',
  'buildingScope.sectionStatus.ready': 'Ready to confirm',
  'buildingScope.sectionStatus.confirmed': 'Confirmed',
  'buildingScope.sectionStatus.changed': 'Changed · reconfirm',
  'buildingScope.group.decisions': 'Decisions',
  'buildingScope.conflicts.none': 'No conflicts for the displayed data.',
  'buildingScope.conflicts.open':
    'The values conflict. Select a reliable source before confirming.',
  'buildingScope.conflicts.resolved':
    'Conflict resolved. The unselected value remains traceable.',
  'buildingScope.conflicts.authoritative': 'Adopted for this offer',
  'buildingScope.conflicts.choose': 'Use this value',
  'buildingScope.confirm.section': 'Confirm building',
  'buildingScope.confirm.missingWarning':
    '{count} optional values have not been captured. They remain visible as a warning and do not prevent confirmation.',
  'buildingScope.confirm.confirmed': 'Building confirmed',
  'buildingScope.confirm.includesClass':
    'Confirmation covers all displayed data, including the building class under MBO §2.',
  'buildingScope.confirm.conflictReasonOne':
    'Resolve 1 open conflict for this building first.',
  'buildingScope.confirm.conflictReason':
    'Resolve {count} open conflicts for this building first.',
  'buildingScope.confirm.sectionsReason':
    'Review the flagged sections first — they still need a value or a decision.',
  'buildingScope.confirm.action': 'Confirm building',
  'buildingScope.action.apply': 'Apply value',
  'buildingScope.action.reset': 'Reset to source value',
  'buildingScope.action.editSection': 'Edit section',
  'buildingScope.action.doneEditingSection': 'Done',
  'buildingScope.validation.textRequired':
    'An empty value is not applied. The previous value remains unchanged.',
  'buildingScope.validation.number': 'Enter numbers only — not applied.',
  'buildingScope.validation.positive':
    'The value must be greater than zero — not applied.',
  'buildingScope.validation.integer': 'Enter whole units only — not applied.',
  'buildingScope.readiness.title': 'Ready for the Configurator?',
  'buildingScope.readiness.selection': 'At least one building selected',
  'buildingScope.readiness.selectedCount': '{count} buildings selected',
  'buildingScope.readiness.selectionMissing': 'Select at least one building.',
  'buildingScope.readiness.conflictOpen': 'Resolve conflict and confirm building',
  'buildingScope.readiness.openConfigurator': 'Open Configurator',
  'buildingScope.readiness.reviewNext': 'Review next open building',
  'buildingScope.readiness.pricingNotStarted': 'Pricing has not started',
  'buildingScope.readiness.pricingExplanation':
    'The next steps become available in the Configurator after building confirmation.',
  'buildingScope.clientGate.hidden':
    'Internal editing guidance and source references are hidden in client view.',
  'configurator.mode.title': 'Choose configuration mode',
  'configurator.mode.meta': 'Before the first step · {count} buildings confirmed',
  'configurator.mode.lede':
    'Choose whether requirements are handled together or separately for each building.',
  'configurator.mode.legend': 'Configuration mode',
  'configurator.mode.shared.title': 'Configure together',
  'configurator.mode.shared.description':
    'Capture requirements once for all selected buildings. Building data, quantities and costs remain separate.',
  'configurator.mode.shared.consequence': '1 run · {buildings}',
  'configurator.mode.perBuilding.title': 'Configure per building',
  'configurator.mode.perBuilding.description':
    'Capture requirements separately for each building. Changes remain limited to the selected building.',
  'configurator.mode.perBuilding.consequence': '{count} runs · any order',
  'configurator.mode.perBuilding.consequenceOne': '1 run · any order',
  'configurator.mode.oneBuildingHint':
    'With one building, both modes currently produce one run. The choice is retained if another building is added later.',
  'configurator.mode.start': 'Start configuration',
  'configurator.mode.startReason': 'Select a configuration mode first.',
  'configurator.mode.back': 'Back to Building & scope',
  'configurator.mode.currentShared': 'Shared configuration · applies to {buildings}',
  'configurator.mode.currentPerBuilding': 'Configuration per building',
  'configurator.mode.retained': 'The other mode’s choices remain saved.',
  'configurator.mode.edit': 'Change mode',
  'configurator.mode.clientBlocked':
    'Choose the configuration mode in Preparation first.',
  'configurator.scope.legend': 'Configuration scope',
  'configurator.scope.selectLabel': 'Select configuration scope',
  'configurator.scope.first': 'Go to first configuration scope',
  'configurator.scope.last': 'Go to last configuration scope',
  'pricing.total.buildingScope': 'Net total · All3 core service · {building}',
  'configurator.scope.total': 'Total · {confirmed} of {total} confirmed',
  'configurator.scope.building': '{building} · {status}',
  'configurator.scope.project': 'Applies to the entire complex',
  'configurator.scope.shared': 'Shared configuration · applies to {buildings}',
  'configurator.scopeBoundaries.goTo':
    'Go to chapter {chapter} · Scope boundaries',
  'configurator.scopeBoundaries.servicingIntro':
    'Site servicing belongs to KG 200 — its scope is decided in chapter {chapter}; its current status is shown here.',
  'configurator.scopeBoundaries.servicingStatus':
    'Site servicing · KG 200 in the offer: {status}',
  'configurator.scopeBoundaries.assumptionAction':
    'Decide in the configurator · «{chapterName}»',
  'configurator.energy.goTo':
    'Go to «{chapterName}»',
  'configurator.returnBuildingScope': 'Go to Building & Scope',
  'configurator.scope.single': 'Configuration for {building} · {status}',
  'configurator.scope.announcement': '{scope} selected. Status: {status}.',
  'configurator.status.open': 'Incomplete',
  'configurator.status.ready': 'Ready to confirm',
  'configurator.status.confirmed': 'Confirmed',
  'configurator.status.recheck': 'Review again',
  'configurator.status.openDetail':
    'Complete these building steps: {steps}.',
  'configurator.status.readyDetail':
    'All required building steps have been reviewed. The configuration can be confirmed.',
  'configurator.status.confirmedDetail': 'The visible configuration is confirmed.',
  'configurator.status.recheckDetail':
    'Building data or configuration values changed. Review them again before confirming.',
  'configurator.status.confirmBuilding': 'Confirm configuration for {building}',
  'configurator.status.confirmShared': 'Confirm shared configuration',
  'configurator.areas.title': 'Areas · {building}',
  'configurator.areas.unavailable':
    '{field} is not yet reliably available for {building}.',
  'configurator.areas.remedy':
    'Review or add the value for {building} in Building & scope.',
  'configurator.areas.review': 'Review in Building & scope',
  'configurator.areas.goTo': 'Go to «{chapterName}»',
  'configurator.underground.title': 'Underground floor · {building}',
  'configurator.underground.decidedIn':
    'Decided in Areas in detail — shown here for context only.',
  'configurator.schedule.completionOwner':
    'Completion date is determined by {building}.',
  'configurator.hint.dismiss': 'Got it',
  'configurator.mode.readiness.preserved': 'Calculation available',
  'configurator.mode.readiness.preservedBody':
    'The existing configuration is preserved and resumes once the mode is confirmed.',
  'configurator.finalGate.label': 'Configuration not fully confirmed yet',
  'configurator.finalGate.scopeBoundariesOutstanding':
    'Scope Boundaries has not been confirmed yet.',
  'configurator.finalGate.buildingsOutstanding': 'Still to confirm: {buildings}.',
  'configurator.finalGate.action': 'Confirm now',
  'configurator.finalGate.exportBlockedReason':
    'Export is locked until the configuration is fully confirmed.',
  'offerPanel.empty.sentence': 'No cost group is included in the offer yet.',
  'offerPanel.empty.detail':
    'Select at least one cost group in Scope Boundaries to get a calculation.',
  'offerPanel.empty.action': 'Open Scope Boundaries',
  'configurator.scope.emptyDetail':
    'Select at least one cost group above to get a calculation.',
  'configurator.overview.title': 'Configuration status',
  'configurator.overview.label': 'Configuration status for all buildings',
  'configurator.sidebar.title': 'Before pricing',
  'configurator.sidebar.body':
    'Pricing starts only in Scope boundaries. The mode choice alone does not create a price.',
  'journal.empty': 'Journal: no adopted changes yet',
  'journal.buildingScope.summaryOne': 'Journal: 1 event during preparation',
  'journal.buildingScope.summary': 'Journal: {count} events during preparation',
  'shell.en.draftActive': 'EN: draft — translation not yet complete',
  'shell.en.draftHint': 'EN is still a draft: the translation is being completed',
  'shell.en.draftOption': 'EN · Draft',
  'opplist.title': 'Opportunities',
  'opplist.eyebrow': 'Portfolio',
  'opplist.portfolioSummary': '{projects} projects · {termine} with appointment',
  'opplist.resultSummary.total': '{count} Opportunities',
  'opplist.resultSummary.filtered': '{shown} of {total} Opportunities',
  'opplist.sort.legend': 'Sort',
  'opplist.sort.recommended': 'Recommended',
  'opplist.sort.name': 'Name',
  'opplist.sort.status': 'Status',
  'opplist.filter.status.label': 'Lifecycle status',
  'opplist.filter.actionableOnly.label': 'Show actionable only',
  'opplist.filter.includeExcluded.label': 'Include on hold, signed, lost',
  'opplist.filter.country.chip': 'Country: {value}',
  'opplist.filter.city.chip': 'City: {value}',
  'opplist.filter.owner.chip': 'Owner: {value}',
  'opplist.filter.status.chip': 'Status: {value}',
  'opplist.filter.termin.label': 'Appointment',
  'opplist.filter.termin.all': 'All appointments',
  'opplist.filter.termin.mit': 'With appointment',
  'opplist.filter.termin.ohne': 'Without appointment',
  'opplist.filter.termin.chip': 'Appointment: {value}',
  'opplist.filter.actionableOnly.chip': 'Actionable only',
  'opplist.filter.includeExcluded.chip': 'Incl. on hold/signed/lost',
  'opplist.filter.search.chip': 'Search: {value}',
  'opplist.emptyAccount.sentence': 'There are no Opportunities yet.',
  'opplist.emptyAccount.detail':
    'New Opportunities appear here automatically once they arrive from HubSpot.',
  'opplist.card.buildingLabel': 'building',
  'opplist.card.buildingsLabel': 'buildings',
  'opplist.card.documentLabel': 'document',
  'opplist.card.documentsLabel': 'documents',
  'opplist.media.identityGraphic': 'Project identity · no image',
  'opplist.media.fallbackCaption': 'Project identity · {name}',
  'opplist.media.credit.nordfeld': 'Project photo · Nordfeld',
  'opplist.media.credit.westpark': 'Courtyard view · Musterhöfe',
  'opplist.media.credit.seeblick': 'Project view · Seeblick',
  'opplist.media.photoAlt': 'Two apartment buildings with timber and brick facades around a shared courtyard',
  'opplist.stage.neuAusHubspot': 'new from HubSpot',
  'opplist.stage.inVorbereitung': 'in preparation',
  'opplist.stage.versendet': 'sent',
  'opplist.stage.ruhend': 'on hold',
  'opplist.stage.gewonnen': 'contract signed',
  'opplist.stage.verloren': 'lost',
  'configurator.scope.confirmHeading': 'Confirm scope boundaries',
  'configurator.scope.recheckTag': 'Review scope boundaries again',
  'configurator.scope.confirmedTag': 'Scope boundaries confirmed.',
  'chapter.scopeBoundaries': 'Scope boundaries',
  'chapter.kg200Details': 'Preliminary measures · KG 200',
  'chapter.kg300Details': 'KG 300 services',
  'chapter.kg400Details': 'KG 400 technical systems',
  'chapter.kg500Details': 'External works · KG 500',
  'chapter.kg600Details': 'Fit-out · KG 600',
  'chapter.energyCertification': 'Energy & certificates',
  'chapter.areas': 'Areas in detail',
  'chapter.kg700Details': 'Ancillary construction costs · KG 700',
  'chapter.kg800Details': 'Financing · KG 800',
  'chapter.commercialSchedule': 'Schedule',
  'costGroup.KG_100': 'Land',
  'costGroup.KG_200': 'Preliminary measures',
  'costGroup.KG_300': 'Building construction',
  'costGroup.KG_400': 'Technical systems',
  'costGroup.KG_500': 'External works',
  'costGroup.KG_600': 'Fit-out',
  'costGroup.KG_700': 'Ancillary construction costs',
  'costGroup.KG_800': 'Financing',
  // SIDEBAR 03 FOLLOW-UP (backlog 5ec7e9cf, AC-2) — DIN 276-1:2018 elemental
  // classification English terminology, kept accurate to the German source
  // (not marketing paraphrase); the `KG 3xx`/`KG_3xx` identifier itself
  // stays untranslated at the render site per LOCALE-009.
  'kg300Subgroup.KG_310': 'Excavation · earthworks',
  'kg300Subgroup.KG_320': 'Foundations · substructure',
  'kg300Subgroup.KG_330': 'Exterior walls · vertical structural elements',
  'kg300Subgroup.KG_340': 'Interior walls · vertical structural elements',
  'kg300Subgroup.KG_350': 'Floor slabs · horizontal structural elements',
  'kg300Subgroup.KG_360': 'Roofs',
  'kg300Subgroup.KG_370': 'Infrastructure installations · fixtures',
  'kg300Subgroup.KG_390': 'Other structural measures',
  'offerPanel.journal.priceChangePrefix': 'Price change since the option was created:',
  'offerPanel.journal.changeSingular': 'change applied',
  'offerPanel.journal.changePlural': 'changes applied',
  'driver.baseServiceSpecialAreas': 'Core service · covered special-use areas',
  'driver.fireResistanceEnclosure': 'fire resistance and enclosure',
  'driver.basementShellAndFitOut': 'Basement · shell and fit-out',
  'driver.basementFitOutOnly': 'Basement · fit-out only',
  'driver.undergroundGarage': 'Underground garage · ventilation, floor coating, doors',
  'configurator.scopeBoundaries.title': 'Scope of services per DIN 276',
  'configurator.basement.title': 'Basement',
  'configurator.energy.title': 'Energy standard',
  'configurator.schedule.title': 'Construction period',
  'configurator.confirmConfig.title': 'Confirm configuration',
  'configurator.kg700.calcMethod.title': 'Calculation method',
  'configurator.workstage.primaryDecisions': 'Primary decisions',
  'configurator.workstage.secondaryDecisions': 'Further decisions',
  'configurator.workstage.showAllDecisions': 'Show all {count}',
  'configurator.workstage.selectionImpact': 'Current selection impact',
  'configurator.workstage.buildingContext': 'Building context',
  'configurator.workstage.currentKg300': 'Current KG 300',
  'configurator.kg700.methodQuestion': 'How are ancillary construction costs shown?',
  'configurator.kg700.wholeComplex': 'Whole complex',
  'configurator.kg700.impact': 'Impact',
  'configurator.kg700.decisionSet': 'Calculation method selected',
  'configurator.kg700.decisionSetDetail': 'The current calculation method is set. The next chapter is available.',
  'configurator.kg700.clientRepresentation': 'Client representation',
  'configurator.kg700.included': 'included',
  'configurator.kg800.breakdown.title': 'KG 800 breakdown',
  'configurator.groundAccess.title': 'Ground conditions & access',
  'driver.kg300Unresolved': 'KG 300 · building construction (unresolved)',
  'driver.kg400Unresolved': 'KG 400 · technical systems (unresolved)',
  'offer.costGroups.regionHeading': 'Cost groups under DIN 276',
  'offer.drivers.excludedHeading': 'Excluded',
  'offerPanel.scope.wholeComplex': 'Total · whole complex',
  'offerPanel.scope.offerTotalLabel': 'Whole offer total',
  'offerPanel.completeness.line':
    '{decided} of {total} cost groups decided · {priced} calculated · {unpriced} without a price basis',
  'offer.drivers.changedMarker': 'changed',
  'offer.delta.totalQualifier': 'total',
  'offer.kgTable.roundingNote':
    'Rows and percentage shares are rounded independently; the check runs on exact values.',
  'offer.drivers.reconciliationCaption':
    'Cost drivers: contributions sum exactly to the {label}.',
  'offer.drivers.noneYet':
    'No cost driver yet: the scope decisions are still open.',
  /* ── VR3-03 · unified Konfigurator (T-018–T-028) ──────────────────── */
  'vr3.kg.ledger.stageMeta':
    'Configurator · step 1',
  'vr3.kg.ledger.lede':
    'Make one explicit decision for every DIN 276 cost group. “Still open” is not the same as intentionally excluded.',
  'vr3.kg.ledger.caption':
    'Scope boundaries: six cost groups, one explicit decision each.',
  'vr3.kg.ledger.column.group':
    'Cost group',
  'vr3.kg.ledger.column.decision':
    'Decision',
  'vr3.kg.ledger.column.summary':
    'Meaning for the scope',
  'vr3.kg.ledger.column.downstream':
    'Consequence',
  'vr3.kg.ledger.include':
    'included',
  'vr3.kg.ledger.noEffect':
    'no price effect',
  'vr3.kg.ledger.exclude':
    'not included',
  'vr3.kg.ledger.decisionLegend':
    'Decision {group} {meaning}',
  'vr3.kg.ledger.progress':
    '{decided} of {total} decided',
  'vr3.kg.ledger.summary.included':
    'In the offer scope',
  'vr3.kg.ledger.summary.excluded':
    'Intentionally excluded',
  'vr3.kg.ledger.summary.undecided':
    'Still open',
  'vr3.kg.ledger.downstream.configure':
    'Configuration required',
  'vr3.kg.ledger.downstream.skipped':
    'Out of scope · skipped',
  'vr3.kg.ledger.downstream.required':
    'Decision required',
  'vr3.kg.ledger.footerIncomplete':
    'Cost-group configuration stays locked until all six decisions are explicit.',
  'vr3.kg.ledger.footerComplete':
    'Every cost group has a deliberate outcome. The included groups can now be configured.',
  'vr3.kg.ledger.confirm':
    'Confirm scope and continue',
  'vr3.kg.ledger.blockedReason':
    '{open} of {total} cost groups still have no decision.',
  'vr3.kg.ledger.announceComplete':
    'All six cost groups are decided. The first included cost group is available.',
  'vr3.kg.ledger.recheck':
    'Confirm again',
  'vr3.kg.ledger.recheckReason':
    'The scope has changed since it was last confirmed.',
  'vr3.kg.page.identity':
    'Configurator · {group}',
  'vr3.kg.page.progress':
    '{decided} of {total} decided',
  'vr3.kg.page.progressComplete':
    'Complete',
  'vr3.kg.page.previous':
    'Back to {group}',
  'vr3.kg.page.next':
    'Continue to {group}',
  'vr3.kg.page.toSchedule':
    'Continue to the schedule',
  'vr3.kg.page.blockedOpen':
    '{open} decisions in this cost group are still open.',
  'vr3.kg.page.blockedInvalid':
    'One position in this cost group is invalid or waiting on another decision.',
  'vr3.kg.group.decisions':
    '{count} positions',
  'vr3.kg.service.include':
    'include',
  'vr3.kg.service.includeToggle':
    'in the offer',
  'vr3.kg.service.exclude':
    'do not include',
  'vr3.kg.service.legend':
    'Decision {service}',
  'vr3.kg.service.mandatory':
    'mandatory, always included',
  'vr3.kg.service.variantBaseline':
    'Project standard',
  'vr3.kg.service.noAmount':
    'no amount',
  'vr3.kg.service.status.included':
    'Included',
  'vr3.kg.service.status.configured':
    'Configured',
  'vr3.kg.service.status.notIncluded':
    'Not included',
  'vr3.kg.service.status.undecided':
    'Decision open',
  'vr3.kg.service.status.invalid':
    'Entry invalid',
  'vr3.kg.service.status.blocked':
    'Prerequisite missing',
  'vr3.kg.service.detailOpen':
    'Open details',
  'vr3.kg.service.detailClose':
    'Close details',
  'vr3.kg.service.building':
    'Building {name}',
  'vr3.kg.service.authority.sourceEvidenced':
    'evidenced by the documentation',
  'vr3.kg.service.authority.derived':
    'derived from quantities',
  'vr3.kg.service.authority.assumed':
    'assumption — not yet confirmed',
  'vr3.kg.service.field.authority':
    'Authority',
  'vr3.kg.service.field.building':
    'Building',
  'vr3.kg.service.dependencyWarning':
    'This position requires {upstream}.',
  'vr3.kg.service.dependencyDetail':
    'Until {upstream} is decided accordingly, this position contributes nothing to the offer.',
  'vr3.kg.service.dependencyRoute':
    'Open the prerequisite',
  'vr3.kg.service.quantityLabel':
    'Quantity in {unit}',
  'vr3.kg.service.quantityHelper':
    'Rate {unitAmount} € per {unit}.',
  'vr3.kg.service.quantity.notANumber':
    'Enter a number. Until then the offer uses the last valid quantity.',
  'vr3.kg.service.quantity.belowMinimum':
    'The quantity cannot be below zero. The last valid quantity applies until it is corrected.',
  'vr3.kg.service.quantity.aboveMaximum':
    'The quantity is above the permitted range. The last valid quantity applies until it is corrected.',
  'vr3.kg.context.title':
    'Context',
  'vr3.kg.context.buildings':
    'Option covering {count} buildings',
  'vr3.kg.context.warnings':
    'Notices',
  'vr3.kg.context.selected':
    'Included positions',
  'vr3.kg.context.baselineConfirmed':
    'Building baseline confirmed',
  'vr3.kg.context.baselineOpen':
    'Building baseline open',
  'vr3.journal.kgScopeConfirmed':
    'Scope boundaries confirmed',
  'vr3.kg.gate.configurationTitle':
    'Configuration unavailable',
  'vr3.kg.gate.configurationPrereq':
    'This Option’s scope boundaries',
  'vr3.kg.gate.configurationDetail':
    'This Option was created before the current configuration contract and carries no cost-group decisions. Define the building scope again to begin configuring it.',
  'vr3.kg.gate.decisionsPrereq':
    'Six explicit cost-group decisions',
  'vr3.kg.gate.decisionsDetail':
    'Only {decided} of {total} cost groups are decided.',
  'vr3.kg.gate.decisionsRoute':
    'Go to the scope boundaries',
  'vr3.kg.gate.skippedReason':
    'This cost group was intentionally excluded. There is nothing to configure here — the decision stays visible in the offer.',
  'vr3.kg.gate.reopenScope':
    'Open the scope boundaries',
  'vr3.kg.gate.chapterOutstanding':
    '{group} still has open decisions.',
  'vr3.kg.gate.scheduleReason':
    'The schedule becomes available once every included cost group is complete.',
  'vr3.rail.scope.heading':
    'Included scope',
  'vr3.rail.scope.included':
    'cost groups included',
  'vr3.rail.scope.includedValue':
    '{included} of {total}',
  'vr3.rail.scope.excluded':
    'intentionally excluded',
  'vr3.rail.scope.undecided':
    'still open',
  'vr3.rail.scope.services':
    'included positions',
  'vr3.rail.scope.openDecisions':
    'open decisions',
  'vr3.rail.change.heading':
    'Last change',
  'vr3.rail.change.noEffect':
    'no price effect',
  'vr3.rail.status.subtotal':
    'Subtotal',
  'vr3.rail.status.subtotalUndecided':
    '{undecided} cost groups still have no decision — the sum names only the priced positions.',
  'vr3.rail.status.subtotalOpenDecisions':
    '{open} decisions are still open — the sum names only the priced positions.',
  'vr3.rail.status.reconcileFailed':
    'Composition does not add up',
  'vr3.rail.status.reconcileDrift':
    'The cost groups do not sum to the stated total. Drift {drift}.',
  'offerPanel.preview.vsCurrent': 'vs. the current state',
  'offerPanel.derivedMarker.legend': '⚙ · derived for the prototype, not calibrated.',
  'panel.rate': 'Rate',
  'panel.quantity': 'Quantity · {denominator}',
  'panel.decreased': 'decreased',
  'panel.scopeLabel': 'Scope · {scope}',
  'panel.rounded': 'approx.',
  'panel.exact': 'exact',
  'offerPanel.heading': 'Offer',
  'offerPanel.heading.leadRate': 'Lead metric',
  'offerPanel.heading.duration': 'Construction period',
  'offerPanel.duration.okbpGloss': 'top of the foundation slab',
  'panel.coverage.notApplicableShort': 'n/a',
  'offerPanel.notIncluded.clientNotice':
    'Not every cost group is part of this offer; the boundary is stated in the scope overview.',
  'offerPanel.riskSurcharges.label': 'Risk surcharges',
  'offerPanel.duration.unit': 'months',
  'offerPanel.duration.roundingDisclosure':
    'Display differs from the model value; exact {value}',
  'offerPanel.liveAnnouncement': '{change} · {delta} · new amount {total}',
  'panel.regionalFactorDeactivated': 'deactivated',
  'offerPanel.kg300Subgroups.toggle': 'KG 300 subgroups',
  'offerPanel.kg300Subgroups.caption': 'KG 300 subgroups, risk basis',
  'offerPanel.details.trigger': 'Show all details',
  'presentation.building.story': 'Building story',
  'presentation.building.confirmed': 'Confirmed',
  'presentation.building.notCaptured': 'Not captured',
  'presentation.building.fullBasement': 'Full fit-out',
  'presentation.building.partialBasement': 'Structure from ceiling level',
  'presentation.building.noBasement': 'No basement',
  'presentation.building.underground': 'Basement',
  'presentation.commercialConsequence': 'Commercial consequence',
  'presentation.commercialConsequenceCopy': 'Completion follows the longest construction section.',
  'presentation.schedule.durationFromOkbp': 'Construction period from OKBP',
  'presentation.nav.project': 'Project',
  'presentation.nav.building': 'Building',
  'presentation.nav.result': 'Result',
  'presentation.nav.schedule': 'Schedule',
  'presentation.nav.options': 'Options',
  'presentation.nav.nextStep': 'Next step',
  'presentation.nextStep.continue': 'Continue to options',
  'presentation.nextStep.title': 'Prepare offer',
  'presentation.nextStep.copy': 'The presentation stays unchanged. The working option remains separate.',
  'presentation.nextStep.artifacts': 'Included artifacts',
  'presentation.artifact.offer': 'Offer presentation',
  'presentation.artifact.cost': 'Cost overview',
  'presentation.artifact.scope': 'Scope overview',
  'presentation.artifact.title.praesentation': 'Offer presentation (PDF)',
  'presentation.artifact.title.leistungen': 'Scope — included / excluded',
  'presentation.artifact.title.ssl': 'Interface matrix (SSL)',
  'presentation.artifact.title.baubeschreibung': 'Construction description',
  'presentation.artifact.title.kg': 'Cost overview (DIN 276)',
  'presentation.artifact.title.vertrag': 'Contract templates for legal review',
  'presentation.artifact.description.praesentation': 'Project, building, result, schedule & options',
  'presentation.artifact.description.leistungen': 'Included, excluded, interfaces',
  'presentation.artifact.description.ssl': 'Technical interfaces between the trades',
  'presentation.artifact.description.baubeschreibung': 'Structural and technical execution of the project',
  'presentation.artifact.description.kg': 'Cost-group structure and commercial drivers',
  'presentation.artifact.description.vertrag': 'Legal templates for contract execution',
  'presentation.artifact.meta': 'PDF',
  'presentation.artifact.costUnavailable': 'Preview unavailable — total price not yet determined',
  'presentation.artifact.dialogScope': 'Building',
  'presentation.flow.offerEyebrow': 'Your indicative offer',
  'presentation.flow.offerTitle': '{project} takes commercial shape.',
  'presentation.flow.offerTitleFallbackSubject': 'Your project',
  'presentation.flow.prepare': 'Review & send offer →',
  'presentation.flow.discountNotice': 'Internal discount settings stay in preparation and are not shown here.',
  'presentation.flow.galleryEyebrow': 'Offer scope',
  'presentation.flow.galleryHeadline': 'These documents go to your client.',
  'presentation.flow.galleryEmpty': 'No deliverables are currently selected for this offer.',
  'presentation.commercial.topDriver': 'Biggest driver',
  'presentation.flow.send.title': 'Ready to send',
  'presentation.flow.send.copy': 'Review the recipient, commercial summary and deliverables one last time.',
  'presentation.flow.recipient': 'Recipient',
  'presentation.flow.recipientValue': 'To: {email} (from HubSpot)',
  'presentation.flow.noRecipient': 'No recipient saved yet',
  'presentation.flow.subject': 'Subject',
  'presentation.flow.language': 'Language',
  'presentation.flow.german': 'German',
  'presentation.flow.english': 'English',
  'presentation.flow.summary': 'Commercial summary',
  'presentation.flow.immutable': 'Sending saves an immutable version. Later changes do not alter this version.',
  'presentation.flow.sendAction': 'Send offer',
  'presentation.flow.sentTitle': 'Offer sent',
  'presentation.flow.deliveredTitle': 'Your offer has been delivered.',
  'presentation.flow.sentCopy': 'Delivery is being checked.',
  'presentation.flow.deliveredCopy': 'Delivery is simulated in this prototype.',
  'presentation.flow.sentAt': 'Sent at',
  'presentation.flow.deliveredAt': 'Delivered at',
  'presentation.flow.version': 'Sent version',
  'presentation.flow.deliveryState': 'Delivery status',
  'presentation.flow.pending': 'Pending',
  'presentation.flow.confirmed': 'Confirmed (simulated)',
  'presentation.flow.openSent': 'Open sent offer',
  'presentation.flow.newVersion': 'Create new version',
  'presentation.flow.back': 'Back to presentation',
  'presentation.flow.backToDelivery': 'Back to delivery status',
  'presentation.flow.snapshotTitle': 'Sent offer',
  'presentation.flow.snapshotCopy': 'This immutable version remains unchanged even when the project changes later.',
  'presentation.flow.justNow': 'Just now',
  // VR2-08 — Send review / Delivered (new keys, added alongside the
  // existing presentation.flow.* entries above; those stay in place and
  // some of them (offerEyebrow, recipient, subject, language, summary,
  // sentAt, version, openSent, newVersion, backToDelivery, snapshotTitle,
  // snapshotCopy, immutable, pending, justNow) are reused as-is.
  'presentation.flow.send.eyebrow': 'Final review',
  'presentation.flow.recipientLabel': 'To',
  'presentation.flow.subjectValue': 'Indicative offer · {project}',
  'presentation.flow.completion': 'Completion',
  'presentation.flow.priceUnavailableReason': 'Total price not yet determined — the offer cannot be sent',
  'presentation.flow.artifactsHeading': '{count} deliverables',
  'presentation.flow.openOffer': 'Open offer',
  'presentation.flow.immutableDetail': 'Later project changes do not alter this offer.',
  'presentation.flow.reviewedSummary': 'Recipient & {count} deliverables reviewed',
  'presentation.flow.reviewedSummaryDetail': 'Sending saves the snapshot immutably.',
  'presentation.flow.sendingLabel': 'Sending …',
  'presentation.flow.sendFailedTitle': 'Sending failed',
  'presentation.flow.sendFailedCopy': 'Sending could not be completed. No snapshot was saved.',
  'presentation.flow.retryAction': 'Try again',
  'presentation.flow.deliveredEyebrow': 'Send complete',
  'presentation.flow.sentEyebrow': 'Sending in progress',
  'presentation.flow.statusDelivered': 'delivered',
  'presentation.flow.statusSent': 'sent',
  'presentation.flow.snapshotId': 'Snapshot ID',
  'presentation.flow.snapshotRef': 'Snapshot #{id}',
  'presentation.flow.deliveryProofAction': 'Delivery proof',
  'presentation.flow.deliveryProofTitle': 'Delivery proof',
  'presentation.flow.deliveryProofIntro': 'Sent and delivered are two separate events — delivery is confirmed only once the provider has accepted it.',
  'presentation.flow.deliveryProofSentRow': 'Sent',
  'presentation.flow.deliveryProofDeliveredRow': 'Delivered',
  'presentation.ansicht.legend': 'Viewing',
  'presentation.identity.eyebrow': 'Indicative offer · {date}',
  'presentation.identity.buildingCount': 'Buildings',
  'presentation.scope.eyebrow': 'Building story',
  'presentation.scope.position': '{n} of {total}',
  'presentation.scope.included': 'Included',
  'presentation.scope.previous': '← {building}',
  'presentation.scope.next': '{building} →',
  'presentation.scope.continueTo': 'Continue · {section} →',
  'presentation.commercial.eyebrow': '{option} · Net total',
  'presentation.commercial.driversTitle': 'What determines the price',
  'presentation.commercial.driversSum': 'Sum of the drivers matches the total result:',
  'presentation.timeline.headline': 'From OKBP to handover.',
  'presentation.timeline.eyebrow': 'Schedule · {option}',
  'presentation.timeline.intro': 'Completion follows the longest construction section.',
  'presentation.timeline.planningPhase': 'Planning',
  'presentation.timeline.wholeProject': 'Whole project',
  'presentation.timeline.afterPlanning': 'after planning',
  'presentation.timeline.incomplete': 'Schedule data incomplete — the timeline appears as soon as the schedule model provides data.',
  'presentation.options.eyebrow': 'Three paths for {project}',
  'presentation.options.headline': 'What should take centre stage?',
  'presentation.options.view': 'View option',
  'presentation.options.present': 'Present {option}',
  'presentation.options.viewing': 'Now presenting',
  'presentation.options.fact.building': 'Buildings',
  'presentation.options.fact.duration': 'Construction period',
  'presentation.nextStep.eyebrow': 'Recommended next step',
  'presentation.nextStep.headline': 'Confirm {option} as the basis.',
  'presentation.nextStep.confirmationLabel': 'What gets confirmed',
  'presentation.nextStep.confirmationValue': '{option} · {total} net · Estimate uncertainty ±{pp}%',
  'presentation.nextStep.workingOptionNotice': 'This view only changes the presentation. The active working option stays {option}.',
  // ── VR3-01 · project fixtures, documentation analysis and readiness ──
  'ds.semanticStatus.meaning.neutral': 'nothing has happened yet',
  'ds.semanticStatus.meaning.progress': 'in progress',
  'ds.semanticStatus.meaning.ok': 'complete',
  'ds.semanticStatus.meaning.attention': 'needs a decision',
  'ds.semanticStatus.meaning.error': 'failed',
  'ds.semanticStatus.meaning.stale': 'must be reviewed again',
  'ds.semanticStatus.meaning.unknown': 'not known',
  'ds.authority.sourceEvidenced': 'source evidenced',
  'ds.authority.aiInferred': 'AI inferred',
  'ds.authority.assumed': 'assumed',
  'ds.authority.derived': 'derived',
  'ds.authority.userEntered': 'user entered',
  'ds.authority.confirmed': 'confirmed',
  'ds.authority.overridden': 'overridden',
  'ds.authority.historical': 'historical',
  'ds.authority.stale': 'stale',
  'ds.authority.unknown': 'unknown',
  'ds.authority.confirmedBy': 'confirmed by {actor} on {at}',
  'ds.authority.overrodeValue': 'replaces {previous} · reason: {reason} · {actor}, {at}',
  'ds.processingJob.state.notStarted': 'Not started',
  'ds.processingJob.state.running': 'Running',
  'ds.processingJob.state.partialFailure': 'Partial failure',
  'ds.processingJob.state.complete': 'Complete',
  'ds.processingJob.heading': '{done} of {total} files processed',
  'ds.processingJob.progressText': '{done} of {total} files · {percent} per cent',
  'ds.processingJob.overallProgress': 'overall progress',
  'ds.processingJob.nowProcessing': 'Now processing',
  'ds.documentRow.progressLabel': 'Processing progress for {file}',
  'ds.documentRow.stateOf': ' — state of {file}',
  'ds.documentRow.actionOn': '{action} · {file}',
  'ds.documentRow.inspect': 'Inspect',
  'ds.actionGate.status.available': 'Available',
  'ds.actionGate.status.locked': 'Locked',
  'ds.actionGate.status.busy': 'In progress',
  'ds.actionGate.status.error': 'Failed',
  'ds.actionGate.retry': 'Try again',
  'ds.conflict.state.resolved': 'Resolved',
  'ds.conflict.state.blocking': 'Blocking conflict',
  'ds.conflict.state.nonBlocking': 'Conflict',
  'ds.conflict.recommendedSource': 'Newer source',
  'ds.conflict.supersededSource': 'Superseded',
  'ds.conflict.decisionRecord': 'Decision record',
  'ds.conflict.decidedBy': 'decided by {actor} on {at}',
  'ds.conflict.recommendationFlag': 'System recommendation',
  'ds.question.status.open': 'Open',
  'ds.question.status.answered': 'Answered',
  'ds.question.status.reviewRequired': 'Review required',
  'ds.question.status.warning': 'Assumption documented',
  'ds.question.kind.question': 'Open question',
  'ds.question.kind.lowConfidence': 'Low recognition',
  'ds.question.kind.staleDependency': 'Stale dependency',
  'ds.question.blocksProgress': 'blocks progress',
  'ds.question.doesNotBlock': 'does not block',
  'ds.question.permittedAssumption': 'Permitted assumption',
  'ds.question.recordedBy': 'recorded by {actor} on {at}',
  'vr3.project.type.mfh': 'Apartment building · new build',
  'vr3.project.type.quarter': 'Urban quarter · office, residential, mixed use',
  'vr3.project.DEMO-HAPPY-01.description': 'A calm five-level courtyard residence with 18 apartments, a repeatable planning grid and conventional construction. Complete issued documentation supports a direct analysis-to-Option journey.',
  'vr3.project.DEMO-HAPPY-01.listStatus': 'Client ready example',
  'vr3.project.DEMO-HAPPY-01.understanding': 'One standard apartment building, no basement, complete geometry and unambiguous source attribution.',
  'vr3.project.DEMO-COMPLEX-01.description': 'Conversion of a former logistics-edge site into a dense courtyard ensemble. A long, inconsistent revision history, mixed scan quality and changing client instructions create traceable conflicts that must be resolved before an Option can be created.',
  'vr3.project.DEMO-COMPLEX-01.listStatus': 'Review required',
  'vr3.project.DEMO-COMPLEX-01.understanding': 'Three buildings with distinct use, storeys and underground conditions.',
  'vr3.building.usage.residentialMfh': '100 per cent residential · apartment building',
  'vr3.building.usage.office': '100 per cent office',
  'vr3.building.usage.residential': '100 per cent residential',
  'vr3.building.usage.mixed': 'Ground floor commercial · upper floors residential',
  'vr3.building.storeys.a1': 'GF + 3 upper floors + roof floor',
  'vr3.building.storeys.bA': 'GF + 5 upper floors',
  'vr3.building.storeys.bB': 'Basement + GF + 4 upper floors',
  'vr3.building.storeys.bC': 'Partial basement + GF + 6 upper floors',
  /* VR3-02 — Option building scope and the Configurator gate. */
  'vr3.scope.eyebrow.review': 'Option baseline · review required',
  'vr3.scope.eyebrow.saved': 'Option baseline · saved',
  'vr3.scope.eyebrow.noBaseline': 'Option baseline · not inherited',
  'vr3.scope.noBaseline.heading': 'This Option has no project baseline',
  'vr3.scope.noBaseline.explanation':
    'An Option inherits its building scope from the confirmed project baseline when it '
    + 'is created. This Option was created without one, so there is nothing here to review.',
  'vr3.scope.noBaseline.absenceTitle': 'No buildings inherited',
  'vr3.scope.noBaseline.absenceDetail':
    'Create the Option again from the project. Existing Options are kept.',
  'vr3.scope.noBaseline.action': 'Go to the project',
  'vr3.scope.progress': '{confirmed} of {total} confirmed',
  'vr3.scope.lead.single':
    'Check this building\u2019s metrics and their authority, then confirm the baseline.',
  'vr3.scope.lead.multi':
    'Choose what this Option covers, verify each building\u2019s metrics and authority, '
    + 'then confirm every baseline individually.',
  'vr3.scope.selection.legend': 'Buildings in the offer scope',
  'vr3.scope.building': 'Building {mark}',
  'vr3.scope.selectAction': 'Keep in the offer scope',
  'vr3.scope.reviewAction': 'Review baseline',
  'vr3.scope.selected': 'In scope',
  'vr3.scope.notSelected': 'Not in scope',
  'vr3.scope.status.confirmed': 'Baseline confirmed',
  'vr3.scope.status.stale': 'Recheck required',
  'vr3.scope.status.open': 'Review open',
  'vr3.scope.status.unselected': 'Not in scope',
  'vr3.scope.empty':
    'No building in scope. Select at least one building to review its baseline.',
  'vr3.scope.selectedTotal': 'Selected scope: {value} m² gross floor area R+S',
  'vr3.scope.unit.area': 'm²',
  'vr3.scope.metric.storeys': 'Storeys',
  'vr3.scope.metric.underground': 'Basement',
  'vr3.scope.metric.bgfRAbove': 'BGF R above grade',
  'vr3.scope.metric.bgfSAbove': 'BGF S above grade',
  'vr3.scope.metric.bgfRBelow': 'BGF R below grade',
  'vr3.scope.metric.bgfRSTotal': 'BGF R+S total',
  'vr3.scope.metric.wfl': 'Living area per WoFlV',
  'vr3.scope.metric.nuf': 'Usable floor area per DIN 277',
  'vr3.scope.metric.commercialNuf': 'Commercial usable area',
  'vr3.scope.metric.units': 'Residential units',
  'vr3.scope.metric.workplaces': 'Workplaces',
  'vr3.scope.metric.parkingSpaces': 'Parking spaces',
  'vr3.scope.metric.siteArea': 'Site area',
  'vr3.scope.underground.none': 'No basement',
  'vr3.scope.underground.partial': 'Partial basement',
  'vr3.scope.underground.full': 'Basement',
  'vr3.scope.evidence.planSet': 'Plan set',
  'vr3.scope.evidence.section': 'Section',
  'vr3.scope.baseline.title': 'Baseline · {building}',
  'vr3.scope.baseline.authority': 'Authority: {authority}',
  'vr3.scope.edit.open': 'Change',
  'vr3.scope.edit.revert': 'Source value',
  'vr3.scope.edit.commit': 'Apply value',
  'vr3.scope.edit.cancel': 'Cancel',
  'vr3.scope.edit.reasonLabel': 'Reason',
  'vr3.scope.edit.consequenceTitle': 'This changes the cost-group quantity bases',
  'vr3.scope.edit.consequenceDetail':
    'The previous source value stays in the history. The baseline has to be confirmed again '
    + 'afterwards.',
  'vr3.scope.edit.error.empty': 'Please enter a value.',
  'vr3.scope.edit.error.notANumber': 'Please enter a number, for example 3,410.00.',
  'vr3.scope.edit.error.negative': 'An area or a count cannot be negative.',
  'vr3.scope.edit.error.notAnInteger': 'Please enter a whole number.',
  'vr3.scope.edit.error.tooLarge': 'The value is outside the permitted range.',
  'vr3.scope.edit.error.reason': 'Please state why the source value is being replaced.',
  'vr3.scope.confirm.action': 'Confirm building baseline',
  'vr3.scope.confirm.blockedByEdit': 'Apply or cancel the open change first.',
  'vr3.scope.confirmed.label': 'Baseline confirmed',
  'vr3.scope.confirmed.meta': '{actor} · {at}',
  'vr3.scope.stale.building':
    'The values of {building} have changed since it was confirmed. Please review and '
    + 'confirm it again.',
  'vr3.scope.stale.scope':
    'The saved building scope no longer describes the current selection. The Configurator '
    + 'stays locked until it is saved again.',
  'vr3.scope.removal.title': 'Remove {building} from the scope?',
  'vr3.scope.removal.detail':
    'This building\u2019s confirmation and the saved scope both lose their validity. '
    + 'Metrics and authority are kept.',
  'vr3.scope.removal.confirm': 'Remove from scope',
  'vr3.scope.removal.cancel': 'Keep in scope',
  'vr3.scope.prereq.selection': 'At least one building in scope',
  'vr3.scope.prereq.selectionDetail': 'Select at least one building.',
  'vr3.scope.prereq.building': 'Baseline confirmed: {building}',
  'vr3.scope.prereq.buildingDetail': 'Verify the metrics and confirm the baseline.',
  'vr3.scope.gate.route': 'Go to {building}',
  'vr3.scope.save.action': 'Save building scope',
  'vr3.scope.save.busy': 'Saving the building scope',
  'vr3.scope.save.retry': 'Save again',
  'vr3.scope.save.blocked.one': 'One building baseline still open.',
  'vr3.scope.save.blocked.many': '{count} building baselines still open.',
  'vr3.scope.save.alreadySaved': 'The current scope is already saved.',
  'vr3.scope.error.changed':
    'The scope changed while it was being saved. Every selection and edit was kept; '
    + 'please save again.',
  'vr3.scope.announce.saving': 'Saving the building scope.',
  'vr3.scope.announce.saved': 'Building scope saved. The Configurator is now available.',
  'vr3.scope.announce.confirmed': 'Baseline confirmed: {building}.',
  'vr3.scope.announce.edited': '{metric} of {building} overridden.',
  'vr3.scope.announce.reverted': '{metric} of {building} reset to the source value.',
  'vr3.scope.announce.removed': '{building} removed from the offer scope.',
  'vr3.konfigurator.eyebrow': 'Workflow gate',
  'vr3.konfigurator.heading.locked': 'Configurator locked',
  'vr3.konfigurator.heading.available': 'Configurator available',
  'vr3.konfigurator.lead.locked':
    'The system knows what is missing and provides a direct recovery path. Disabled '
    + 'navigation would not be the explanation.',
  'vr3.konfigurator.lead.available':
    'The Option baseline is confirmed and saved. Scope boundaries is the only current '
    + 'next step.',
  'vr3.konfigurator.prereq.scope': 'Building & scope saved',
  'vr3.konfigurator.blockedReason':
    'The Configurator opens as soon as the building scope is saved.',
  'vr3.konfigurator.prereq.buildingDetail': '{building} still needs review and confirmation.',
  'vr3.konfigurator.prereq.saveDetail': 'Save the confirmed building scope.',
  'vr3.konfigurator.receipt.title.one': 'One building baseline confirmed and saved',
  'vr3.konfigurator.receipt.title.many': '{count} building baselines confirmed and saved',
  'vr3.konfigurator.receipt.next':
    'Next step: decide for all six cost groups whether they are in scope.',
  'vr3.konfigurator.receipt.buildings': 'Buildings in scope',
  'vr3.konfigurator.receipt.bgf': 'BGF R+S total',
  'vr3.konfigurator.receipt.savedAt': 'Saved on',
  'vr3.konfigurator.route.building': 'Review {building}',
  'vr3.konfigurator.route.scope': 'Go to Building & scope',
  'vr3.konfigurator.start': 'Start scope boundaries',
  'vr3.journal.buildingConfirmed': 'Building {building} confirmed',
  'vr3.journal.scopeBuildingAdded': '{building} added to the offer scope',
  'vr3.journal.scopeBuildingRemoved': '{building} removed from the offer scope',
  'vr3.journal.scopeBuildingConfirmed': 'Building baseline {building} confirmed',
  'vr3.journal.scopeMetricEdited': '{building}: {metric} overridden',
  'vr3.journal.scopeMetricReverted': '{building}: {metric} reset to the source value',
  'vr3.journal.buildingScopeSaved': 'Building scope saved · {count} buildings',
  'vr3.building.underground.none': 'no basement',
  'vr3.building.underground.partial': 'partial basement',
  'vr3.building.underground.full': 'basement',
  'vr3.docType.clientBrief': 'Client brief',
  'vr3.docType.clientBriefAddendum': 'Client brief addendum',
  'vr3.docType.projectDescription': 'Project description',
  'vr3.docType.areaSchedule': 'Area schedule',
  'vr3.docType.floorPlan': 'Floor plan',
  'vr3.docType.floorPlans': 'Floor plans',
  'vr3.docType.floorPlanTypicalOg': 'Floor plan, typical upper floor',
  'vr3.docType.floorPlanDuplicate': 'Floor plan duplicate',
  'vr3.docType.elevations': 'Elevations',
  'vr3.docType.section': 'Section',
  'vr3.docType.fireStrategy': 'Fire strategy',
  'vr3.docType.buildingDescription': 'Building description',
  'vr3.docType.useConcept': 'Use concept',
  'vr3.docType.sitePlan': 'Site and landscape plan',
  'vr3.docType.technicalConcept': 'Technical concept',
  'vr3.recognition.high': 'high recognition',
  'vr3.recognition.medium': 'medium recognition',
  'vr3.recognition.low': 'low recognition',
  'vr3.recognition.veryLow': 'very low recognition',
  'vr3.medium.nativePdf': 'native PDF',
  'vr3.medium.vector': 'vector drawing',
  'vr3.medium.converted': 'converted',
  'vr3.medium.raster': 'raster image',
  'vr3.medium.skewedScan': 'skewed scan',
  'vr3.medium.faintScan': 'faint scan',
  'vr3.medium.compressedRaster': 'heavily compressed raster',
  'vr3.medium.croppedScan': 'cropped scan',
  'vr3.sourceAuthority.confirmedClientInstruction': 'confirmed client instruction',
  'vr3.sourceAuthority.issuedArchitecturalDrawing': 'issued architectural drawing',
  'vr3.sourceAuthority.historicalClientInstruction': 'historical client instruction',
  'vr3.sourceAuthority.currentClientInstruction': 'current client instruction',
  'vr3.sourceAuthority.currentDescriptionBelowDrawings': 'current description, ranked below the issued drawings',
  'vr3.sourceAuthority.coordinatedSchedulePending': 'coordinated schedule, confirmation pending',
  'vr3.sourceAuthority.supersededArchitecturalDrawing': 'superseded architectural drawing',
  'vr3.sourceAuthority.currentIssuedArchitecturalDrawing': 'current issued architectural drawing',
  'vr3.sourceAuthority.supersededDisciplineSchedule': 'superseded discipline schedule',
  'vr3.sourceAuthority.currentCoordinatedSchedule': 'current coordinated schedule',
  'vr3.sourceAuthority.supportingTechnicalDocument': 'supporting technical document',
  'vr3.sourceAuthority.duplicateNoAdditionalAuthority': 'duplicate, no additional authority',
  'vr3.sourceAuthority.currentIssuedGeometryCrossCheck': 'current issued drawing, geometry cross-check only',
  'vr3.sourceAuthority.supportingArchitecturalEvidence': 'supporting architectural evidence',
  'vr3.sourceAuthority.currentDescriptionConflicting': 'current description, conflicting field',
  'vr3.sourceAuthority.historicalEvidenceOnly': 'historical evidence only',
  'vr3.sourceAuthority.currentIssuedLowRecognition': 'current issued drawing, low recognition',
  'vr3.sourceAuthority.currentDisciplineConcept': 'current discipline concept',
  'vr3.sourceAuthority.currentSiteEvidence': 'current site evidence',
  'vr3.sourceAuthority.currentTechnicalConceptStale': 'current technical concept with stale inputs',
  'vr3.doc.issue.b01': 'Early target areas',
  'vr3.doc.issue.b02': 'Mixed-use wording incomplete',
  'vr3.doc.issue.b03': 'Building C basement sentence truncated',
  'vr3.doc.issue.b04': 'Total differs from drawing sum',
  'vr3.doc.issue.b05': 'Old core layout',
  'vr3.doc.issue.b07': 'Floor 5 label read as S',
  'vr3.doc.issue.b10': 'NUF 4,520 m² conflicts with V2',
  'vr3.doc.issue.b11': 'NUF 4,360 m²',
  'vr3.doc.issue.b12': 'Recognition confuses 5 and 6 storeys · handwritten note',
  'vr3.doc.issue.b13': 'Exact content duplicate under a different filename',
  'vr3.doc.issue.b14': '42 parking spaces',
  'vr3.doc.issue.b15': '36 spaces · larger plant room',
  'vr3.doc.issue.b16': '8 apartments',
  'vr3.doc.issue.b17': '7 apartments',
  'vr3.doc.issue.b20': 'Scale metadata missing',
  'vr3.doc.issue.b21': 'Basement height unreadable · partial recognition failure',
  'vr3.doc.issue.b22': 'WFL 3,410 m²',
  'vr3.doc.issue.b23': 'States 48 apartments · conflicts with plans and schedule',
  'vr3.doc.issue.b24': 'North edge missing · building label absent · recognition failed',
  'vr3.doc.issue.b25': 'Full basement shown',
  'vr3.doc.issue.b26': 'Partial basement · 22 spaces',
  'vr3.doc.issue.b27': 'Retail 1,080 m²',
  'vr3.doc.issue.b28': 'Commercial NUF 920 m²',
  'vr3.doc.issue.b29': 'Five residential upper floors',
  'vr3.doc.issue.b30': 'Building named “Haus 3”',
  'vr3.doc.issue.b31': 'Height dimension 22.8 or 23.8 is ambiguous',
  'vr3.doc.issue.b32': 'Full basement shown',
  'vr3.doc.issue.b33': 'Partial basement shown',
  'vr3.doc.issue.b34': 'Calls the ground floor “retail and gastronomy” · the client brief says commercial',
  'vr3.doc.issue.b35': 'Building labels A, B and C are clear',
  'vr3.doc.issue.b36': 'Heating table uses old B and C areas',
  'vr3.conflict.B-CF-01.concept': 'Project total BGF',
  'vr3.conflict.B-CF-01.matters': 'The total BGF determines the commercial scale of the whole offer.',
  'vr3.conflict.B-CF-01.affects': 'Affects all cost groups and the total.',
  'vr3.conflict.B-CF-02.concept': 'Building B unit count',
  'vr3.conflict.B-CF-02.matters': 'The unit count drives residential fit-out, sanitary and electrical quantities.',
  'vr3.conflict.B-CF-02.affects': 'Affects residential service quantities.',
  'vr3.conflict.B-CF-03.concept': 'Building C basement extent',
  'vr3.conflict.B-CF-03.matters': 'The basement extent determines earthworks, structure, building services and parking.',
  'vr3.conflict.B-CF-03.affects': 'Affects KG 200, KG 300, KG 400 and parking.',
  'vr3.conflict.B-CF-03.candidate.full': 'Full basement',
  'vr3.conflict.B-CF-03.candidate.partial': 'Partial basement',
  'vr3.conflict.B-CF-04.concept': 'Building C commercial area',
  'vr3.conflict.B-CF-04.matters': 'The commercial area determines use allocation and ground-floor fit-out standard.',
  'vr3.conflict.B-CF-04.affects': 'Affects use allocation and cost.',
  'vr3.conflict.B-CF-05.concept': 'Building A NUF',
  'vr3.conflict.B-CF-05.matters': 'The usable area determines office fit-out quantities.',
  'vr3.conflict.B-CF-05.affects': 'Affects office fit-out quantities.',
  'vr3.conflict.B-CF-06.concept': 'Building A storey count from scan',
  'vr3.conflict.B-CF-06.matters': 'The storey count determines the building class and the fire-safety services that follow from it.',
  'vr3.conflict.B-CF-06.affects': 'Affects classification and fire-safety services.',
  'vr3.conflict.B-CF-06.candidate.six': '6 upper storeys',
  'vr3.conflict.B-CF-06.candidate.five': '5 upper storeys',
  'vr3.question.B-Q-01.question': 'Is the ground-floor commercial space in C retail only, or retail and gastronomy?',
  'vr3.question.B-Q-01.matters': 'Changes ventilation, sanitary and fit-out assumptions.',
  'vr3.question.B-Q-01.evidence': 'Use concept against the general client wording.',
  'vr3.question.B-Q-01.response': 'Baseline: retail only · gastronomy flagged as a scenario.',
  'vr3.question.B-Q-02.question': 'Does Building A include tenant fit-out, or shell and core only?',
  'vr3.question.B-Q-02.matters': 'Material scope effect on KG 300 and KG 400.',
  'vr3.question.B-Q-02.evidence': 'Client addendum incomplete.',
  'vr3.question.B-Q-02.response': 'Assumption: shell and core · client confirmation requested.',
  'vr3.question.B-Q-03.question': 'Are 36 underground parking spaces for B final?',
  'vr3.question.B-Q-03.matters': 'Affects KG 300, KG 400 and KG 500.',
  'vr3.question.B-Q-03.evidence': 'The old drawing states 42 · the current drawing states 36.',
  'vr3.question.B-Q-03.response': 'Answered from source: 36 confirmed.',
  'vr3.question.B-Q-04.question': 'Are the 22 spaces below Building C individually prepared for charging infrastructure?',
  'vr3.question.B-Q-04.matters': 'Determines the electrical infrastructure allowance.',
  'vr3.question.B-Q-04.evidence': 'The drawing shows the spaces · the technical concept is silent.',
  'vr3.question.B-Q-04.response': 'Conduit reserve included · charger hardware excluded.',
  'vr3.question.B-Q-05.question': 'Is demolition of the former loading slab in contractor scope?',
  'vr3.question.B-Q-05.matters': 'Affects KG 200 scope and schedule risk.',
  'vr3.question.B-Q-05.evidence': 'The site plan shows the slab · the brief omits its removal.',
  'vr3.question.B-Q-05.response': 'Provisional allowance included.',
  'vr3.question.B-Q-06.question': 'Which facade certification applies to Building A?',
  'vr3.question.B-Q-06.matters': 'Determines procurement and technical specification.',
  'vr3.question.B-Q-06.evidence': 'The fire-strategy scan has low recognition.',
  'vr3.question.B-Q-06.response': 'A verified fire-consultant issue is required before the final offer.',
  'vr3.question.B-Q-07.question': 'May Building B landscape works be shared with the central courtyard package?',
  'vr3.question.B-Q-07.matters': 'Avoids a double count in KG 500.',
  'vr3.question.B-Q-07.evidence': 'The landscape drawing groups the zones.',
  'vr3.question.B-Q-07.response': 'Shared project package · B allocation is derived.',
  'vr3.question.B-Q-08.question': 'Does the client want a single handover or phased handovers?',
  'vr3.question.B-Q-08.matters': 'Affects the schedule narrative and preliminaries.',
  'vr3.question.B-Q-08.evidence': 'No issued instruction.',
  'vr3.question.B-Q-08.response': 'Baseline: single handover · an alternate scenario is available in Client Mode.',
  'vr3.question.B-DS-01.question': 'Building C height reads as 22.8 or 23.8 metres.',
  'vr3.question.B-DS-01.matters': 'Affects classification and its review.',
  'vr3.question.B-DS-01.evidence': 'Low-recognition elevations against the current section.',
  'vr3.question.B-DS-01.response': 'Manually entered 22.8 metres from the section · user entered and source evidenced.',
  'vr3.question.B-DS-02.question': 'The energy concept uses older B and C areas.',
  'vr3.question.B-DS-02.matters': 'Building-services quantities may be understated.',
  'vr3.question.B-DS-02.evidence': 'The technical concept against the current drawings.',
  'vr3.question.B-DS-02.response': 'Quantities recalculated from the confirmed current areas.',
  'vr3.gate.reason.blockingConflicts': 'Locked: resolve {count} blocking conflicts. Open questions remain separately reviewable.',
  'vr3.gate.reason.blockingQuestions': 'Locked: {count} questions are classified as blocking and need an answer.',
  'vr3.gate.reason.staleBaseline': 'Locked: {count} confirmed values must be reviewed again after the document change.',
  'vr3.gate.reason.incompleteBaseline': 'Locked: the required project baseline is not complete yet.',
  'vr3.gate.reason.analysisNotStarted': 'Locked: document analysis has not been started yet.',
  'vr3.gate.reason.analysisRunning': 'Locked: document analysis is still running.',
  'vr3.asset.alt.A-PROJECT-HERO': 'Five-storey apartment building with a warm mineral facade on a planted courtyard',
  'vr3.asset.alt.A-PLAN-EG': 'Schematic ground-floor plan with four apartments and a central circulation core',
  'vr3.asset.alt.A-ELEVATIONS': 'Schematic north and east elevations of the courtyard residence',
  'vr3.asset.alt.A-SECTION-AA': 'Schematic section A-A through the courtyard residence, no basement',
  'vr3.asset.alt.B-PROJECT-HERO': 'Urban quarter with three distinct buildings around a planted courtyard',
  'vr3.asset.alt.B-BLDG-A-KONTORHAUS': 'Six-storey office building with a deep grid facade, no basement',
  'vr3.asset.alt.B-BLDG-B-HOFHAUS': 'Five-storey courtyard residential building with a brick facade, balconies and an underground-garage entry',
  'vr3.asset.alt.B-BLDG-C-STADTHAUS': 'Seven-storey mixed-use building with a glazed commercial ground floor',
  'vr3.asset.alt.B-SITE-PLAN': 'Site plan of the quarter with buildings A, B and C labelled around the courtyard',
  'vr3.asset.alt.B-PLAN-A': 'Schematic office floor plan of the Kontorhaus',
  'vr3.asset.alt.B-PLAN-B': 'Schematic apartment floor plan of the Hofhaus with its basement',
  'vr3.asset.alt.B-PLAN-C': 'Schematic floor plan of the Stadthaus with its partial basement',
  'vr3.asset.alt.B-ELEVATIONS': 'Comparative elevations of the quarter’s three buildings',
  'vr3.asset.alt.B-SECTION': 'Section through the Hofhaus and the Stadthaus showing basement and storey evidence',
  'vr3.option.rename': 'Rename',
  'vr3.option.nameLabel': 'Option name',
  'vr3.option.nameTaken': 'The name «{name}» is already in use · choose another name',
  'vr3.option.state.sent': 'Sent',
  'vr3.option.state.inProgress': 'In progress',
  'vr3.option.state.new': 'New',
  'vr3.option.lastChanged': 'Last changed',
  'vr3.list.empty.filtered': 'No opportunity matches the search.',
  'vr3.option.error.gateClosed': 'The Option was not created: a prerequisite changed while the action was running. The project baseline and every decision are unchanged.',
  'vr3.option.error.baseline': 'The Option was not created: the project baseline could not be committed. Every decision and conflict resolution is unchanged.',
  'vr3.list.eyebrow': 'Demonstration portfolio · {count} projects',
  'vr3.list.eyebrowOne': 'Demonstration portfolio · 1 project',
  'opplist.filter.city.label': 'City',
  'opplist.empty.filtered.reset': 'Reset all filters',
  'vr3.list.card.actionOn': '{action} · {name}',
  'vr3.list.title': 'Projects',
  'vr3.list.lead': 'Two complete examples: one clean route to an indicative offer, and one deliberate real-world information challenge.',
  'vr3.list.filterToggle': 'Filter and sort',
  'vr3.list.card.documentation': 'Documentation',
  'vr3.list.card.documentationComplete': 'Complete',
  'vr3.journal.rerunAnalysis': 'Document analysis re-run · {project}',
  'vr3.journal.documentReplaced': 'Document replaced · {document} → {file}',
  'vr3.journal.documentRemoved': 'Document removed · {document}',
  'vr3.journal.conflictResolved': 'Conflict resolved · {conflict}',
  'vr3.journal.conflictReopened': 'Conflict reopened · {conflict}',
  'vr3.journal.questionAnswered': 'Open question {question} · answer recorded',
  'vr3.journal.questionAssumed': 'Open question {question} · assumption documented',
  'vr3.journal.optionCreated': 'Opportunity option «{option}» created',
  'vr3.journal.optionRenamed': 'Opportunity option «{previous}» renamed to «{next}»',
  'vr3.journal.projectBaselineConfirmed': 'Project parameters confirmed (buildings, areas, units)',
  'vr3.list.card.analysis': 'Document analysis',
  'vr3.list.card.openConflicts': 'Open conflicts',
  'vr3.list.card.blockingConflicts': 'Blocking conflicts',
  'vr3.list.card.recognitionWarnings': 'Recognition warnings',
  'vr3.list.card.facts': '{buildings} · {documents}',
  'vr3.list.card.buildingsOne': '1 building',
  'vr3.list.card.buildingsMany': '{count} buildings',
  'vr3.list.card.documentsMany': '{count} documents',
  'vr3.list.card.openProject': 'Open project',
  'vr3.list.card.reviewProject': 'Review project',
  'vr3.list.card.units': '{count} apartments',
  'vr3.analysis.eyebrow.notStarted': 'Documentation available · analysis not started',
  'vr3.analysis.eyebrow.running': 'Document analysis · {done} of {total} files',
  'vr3.analysis.notStarted.lead': 'The {count} project documents are ready. Analysis will read, classify and cross-check them, then unlock recognised values, buildings, questions, conflicts and project readiness.',
  'vr3.analysis.notStarted.absenceTitle': 'No analysis results yet',
  'vr3.analysis.notStarted.absenceDetail': 'Values, conflicts and questions only exist once the analysis has produced evidence. Before that they do not exist, and they are therefore not shown as an empty overview either.',
  'vr3.analysis.start': 'Start document analysis',
  'vr3.analysis.inspectDocuments': 'Inspect {count} documents',
  'vr3.analysis.inventoryTitle': '{count} documents queued for analysis',
  'vr3.analysis.inventoryLead': 'Floor plans, elevations, sections and descriptions — counted from the document register itself.',
  'vr3.analysis.tally.floorPlan': 'Floor plans · {count}',
  'vr3.analysis.tally.elevations': 'Elevations · {count}',
  'vr3.analysis.tally.section': 'Sections · {count}',
  'vr3.analysis.tally.other': 'Further documents · {count}',
  'vr3.analysis.title.running.clean': 'Understanding the project',
  'vr3.analysis.title.running.complex': 'Cross-checking revisions and evidence',
  'vr3.analysis.title.attention': 'A document needs attention',
  'vr3.analysis.title.complete': 'Every document has been processed',
  'vr3.analysis.lead.complete':
    'Each file keeps its own history. Replacing or re-reading a source stays available; the confirmed values it affects are then marked for review.',
  'vr3.analysis.retryPolicy':
    'Retry keeps the files already processed; replacing links the old and the new evidence.',
  'vr3.analysis.lead.running': 'Each file keeps its own processing state; a warning does not erase successful evidence.',
  'vr3.analysis.lead.attention': 'The analysis can continue. Resolve or replace this file before relying on the affected values.',
  'vr3.analysis.phase.QUEUED': 'Queued',
  'vr3.analysis.phase.READING': 'Reading',
  'vr3.analysis.phase.CLASSIFYING': 'Classifying',
  'vr3.analysis.phase.EXTRACTING': 'Extracting',
  'vr3.analysis.phase.CROSS_CHECKING': 'Cross-checking',
  'vr3.analysis.outcome.PROCESSED': 'Processed',
  'vr3.analysis.outcome.WARNING': 'Warning',
  'vr3.analysis.outcome.LOW_CONFIDENCE': 'Low confidence',
  'vr3.analysis.outcome.FAILED': 'Failed',
  'vr3.analysis.outcome.REMOVED': 'Removed',
  'vr3.analysis.next': 'Next: cross-document comparison, then project understanding',
  'vr3.analysis.filter.legend': 'Filter files',
  'vr3.analysis.filter.all': 'All files',
  'vr3.analysis.filter.attention': 'Need attention',
  'vr3.analysis.filter.processed': 'Processed',
  'vr3.analysis.filterNotice': 'The filter only changes which rows are listed. The overall counts above stay unchanged.',
  'vr3.analysis.cancel': 'Pause analysis',
  'vr3.analysis.resume': 'Resume analysis',
  'vr3.analysis.rerun': 'Re-run analysis',
  'vr3.analysis.action.retry': 'Retry',
  'vr3.analysis.action.replace': 'Replace file',
  'vr3.analysis.action.remove': 'Remove',
  'vr3.analysis.action.inspect': 'Inspect evidence',
  'vr3.analysis.replacementSuffix': 'replaced by {file}',
  'vr3.analysis.removeConfirm': 'Really remove document {file}? The removal is recorded in the journal and can be undone.',
  'vr3.analysis.failureTitle': '{file} could not be recognised',
  'vr3.analysis.failureDetail': 'Affected: {affected}. The other {remaining} files remain usable, so the analysis continues.',
  'vr3.analysis.failureAffectedC': 'Building C storey heights and the partial-basement evidence',
  'vr3.analysis.announce.started': 'Document analysis started',
  'vr3.analysis.announce.file': '{file} · {state}',
  'vr3.analysis.announce.complete': 'Analysis complete. Project understanding is available.',
  'vr3.analysis.lineage.supersedes': 'supersedes {file}',
  'vr3.analysis.lineage.supersededBy': 'superseded by {file}',
  'vr3.analysis.lineage.duplicateOf': 'exact duplicate of {file}',
  'vr3.analysis.association.project': 'Project level',
  'vr3.analysis.association.buildings': 'Buildings {names}',
  'vr3.understanding.eyebrow': 'Analysis complete · project understanding available',
  'vr3.understanding.lead.clean': 'The shortest safe path is available: review the extracted baseline, then create the Option.',
  'vr3.understanding.lead.complex': 'The analysis is coherent enough to review, but not yet safe for an Option.',
  'vr3.understanding.tab.overview': 'Overview',
  'vr3.understanding.tab.conflicts': 'Conflicts · {count}',
  'vr3.understanding.tab.questions': 'Open questions · {count}',
  'vr3.understanding.tablist': 'Project understanding sections',
  'vr3.understanding.metric.buildings': 'Buildings',
  'vr3.understanding.metric.units': 'Apartments',
  'vr3.understanding.metric.bgf': 'BGF R+S',
  'vr3.understanding.metric.documents': 'Documents',
  'vr3.understanding.metric.blockingConflicts': 'Blocking conflicts',
  'vr3.understanding.understoodTitle': 'What the system understood',
  'vr3.understanding.valuesExtracted': '{count} values extracted',
  'vr3.understanding.valuesAttention': '{count} require attention',
  'vr3.understanding.row.sourceEvidence': 'Source evidence',
  'vr3.understanding.row.aiInferred': 'AI inferred',
  'vr3.understanding.row.manualConfirmed': 'Manual or confirmed',
  'vr3.understanding.row.values': '{count} values',
  'vr3.understanding.buildingsTitle': 'Recognised buildings',
  'vr3.understanding.buildingEvidence': 'Evidence: {files}',
  'vr3.understanding.terminalSummary': '{processed} processed · {warning} warnings · {lowConfidence} low confidence · {failed} failed',
  'vr3.understanding.evidenceTitle': 'Evidence and document history',
  'vr3.understanding.conflictsIntro': '{count} blocking conflicts. Each one shows the competing sources, their authority and the consequence of the decision.',
  'vr3.understanding.conflictsResolvedIntro': 'Every blocking conflict is resolved. The decisions stay traceable and reversible.',
  'vr3.understanding.questionsIntro': '{open} open questions · {blocking} of them block · {assumptions} with a permitted assumption.',
  'vr3.understanding.questionsNote': 'These assumptions carry into Final Validation and are stated again there.',
  'vr3.understanding.questionsTitle': 'Questions, not errors',
  'vr3.understanding.conflictsTitle': 'Conflict resolution',
  'vr3.understanding.recordAnswer': 'Record answer',
  'vr3.understanding.acceptAssumption': 'Document assumption',
  'vr3.understanding.inspectEvidence': 'Inspect evidence',
  'vr3.understanding.conflictChoiceLegend': 'Which value applies?',
  'vr3.understanding.conflictChoiceCandidate': 'Use {value}',
  'vr3.understanding.conflictChoiceRecommended': 'System recommendation',
  'vr3.understanding.conflictChoiceRecommendedValue': 'Recommended value',
  'vr3.understanding.conflictChoiceOlder': 'Older source',
  'vr3.understanding.conflictChoiceSuperseded': 'Superseded source',
  'vr3.understanding.conflictConfirm': 'Confirm resolution',
  'vr3.understanding.conflictInspect': 'Inspect both sources',
  'vr3.understanding.conflictReopen': 'Reopen decision',
  'vr3.understanding.conflictRejected': 'Rejected: {values}',
  'vr3.understanding.conflictScopeProject': 'Project level',
  'vr3.understanding.conflictScopeBuilding': 'Building {name}',
  'vr3.understanding.staleNotice': '{count} confirmed values must be reviewed again after a document change. Manual values and the decision history are preserved.',
  'vr3.readiness.eyebrow.review': 'Review required',
  'vr3.readiness.eyebrow.ready': 'Project ready',
  'vr3.readiness.title.ready': 'All blocking conflicts are resolved.',
  'vr3.readiness.lead.ready': 'Questions that are permitted to remain open are documented. The project now has a reliable basis for the Option.',
  'vr3.readiness.row.analysisComplete': 'Analysis complete',
  'vr3.readiness.row.blockingConflicts': 'Blocking conflicts',
  'vr3.readiness.row.resolvedConflicts': 'Resolved conflicts',
  'vr3.readiness.row.decidedOf': '{decided} of {total}',
  'vr3.readiness.row.requiredInformation': 'Required information',
  'vr3.readiness.row.requiredInformationComplete': 'Complete',
  'vr3.readiness.row.requiredInformationReview': 'Review',
  'vr3.readiness.row.projectBaseline': 'Project baseline',
  'vr3.readiness.row.projectBaselineConfirmed': 'Confirmed',
  'vr3.readiness.row.projectBaselineOpen': 'Not confirmed yet',
  'vr3.readiness.row.openQuestions': 'Open questions',
  'vr3.readiness.row.openQuestionsValue': '{open} · {blocking} blocking',
  'vr3.readiness.createOption': 'Create Option',
  'vr3.readiness.creatingOption.baseline': 'Committing the project baseline …',
  'vr3.readiness.creatingOption.option': 'Creating Option …',
  'vr3.readiness.announce.creating': 'Creating the Option. The project baseline is committed first.',
  'vr3.readiness.routeToConflicts': 'Go to the conflicts',
  'vr3.readiness.routeToQuestions': 'Go to the open questions',
  'vr3.readiness.routeToAnalysis': 'Go to document analysis',
  'vr3.readiness.prereq.analysis': 'Document analysis complete',
  'vr3.readiness.prereq.conflicts': 'No blocking conflicts',
  'vr3.readiness.prereq.baseline': 'Required project baseline complete',
  'vr3.readiness.prereq.conflictsDetail': 'Still open: {count}',
  'vr3.readiness.prereq.baselineDetail': '{done} of {total} fields',
  'vr3.readiness.alternative': 'Open questions that do not block can be answered later; the documented assumptions travel along visibly.',
  'vr3.readiness.optionCreated': 'Option created',
  'vr3.readiness.optionCreatedLead': 'Only Buildings & scope is available now. Confirm the building baseline to unlock the Configurator.',
  'vr3.readiness.openOption': 'Open Option',
  'vr3.spine.label': 'Project and Option journey',
  'vr3.spine.step.documents': 'Documents',
  'vr3.spine.step.understanding': 'Project understanding',
  'vr3.spine.step.createOption': 'Create Option',
  'vr3.spine.step.buildingScope': 'Buildings and scope',
  'vr3.spine.step.scopeBoundaries': 'Scope decisions',
  'vr3.spine.step.schedule': 'Schedule',
  'vr3.spine.step.finalValidation': 'Final validation',
  'vr3.spine.reason.documentsNotStarted': 'Analysis not started yet',
  'vr3.spine.reason.needsAnalysis': 'Document analysis missing',
  'vr3.spine.reason.needsReadiness': 'Project not ready yet',
  'vr3.spine.reason.needsOption': 'Option missing',
  'vr3.spine.reason.needsBuildingScope': 'Building scope not saved yet',
  'vr3.spine.reason.locked': 'Prerequisite missing',
  'vr3.spine.reason.needsScopeDecisions': 'Scope boundaries still open',
  'vr3.option.created.heading': '\u201c{option}\u201d is ready for its baseline',
  'vr3.option.created.lead':
    'Only Building & scope is available now. Select and confirm the building '
    + 'baseline to unlock the Configurator.',
  'vr3.option.created.nextLabel': 'Next step: Building & scope',
  'vr3.option.created.nextDetail':
    'Configurator, schedule, final validation and Client Mode stay locked until '
    + 'their prerequisites are satisfied.',
  'vr3.option.created.action': 'Define buildings & scope',
  'vr3.spine.projectLabel': 'Project',
  'vr3.evidence.assetCaption': '{label} · demonstration evidence',
  'vr3.evidence.failedPreview': 'Preview unavailable: the scan is cropped and recognition failed.',
}

/**
 * Порядок поиска: локальный словарь (хром оболочки) → сгенерированный из
 * поставки Codex (434 ключа, состояние draft). Непереведённое падает в
 * de — честный fallback внутреннего пространства.
 */
export type MessageValues = Readonly<Record<string, string | number>>

function interpolate(
  message: string,
  lang: UiLanguage,
  values?: MessageValues,
): string {
  if (!values) return message
  const numberFormat = new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB')
  return message.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (placeholder, name: string) => {
    const value = values[name]
    if (value === undefined) return placeholder
    return typeof value === 'number' ? numberFormat.format(value) : value
  })
}

export function translate(
  key: MessageKey | string,
  lang: UiLanguage,
  values?: MessageValues,
): string {
  let message: string
  if (lang === 'en') {
    const hit = en[key as MessageKey] ?? GENERATED_EN[key]
    if (hit !== undefined) return interpolate(hit, lang, values)
  }
  message = de[key as MessageKey] ?? GENERATED_DE[key] ?? key
  return interpolate(message, lang, values)
}

/**
 * SIDEBAR 03 (backlog 2be8e69c, SB-14). Money/rate numerals in the offer
 * rail are decided once, in `engine/money.ts`'s `present()`/`rate()`
 * (rounding step, whether the `≈` prefix applies) — `src/engine/**` is out
 * of this task's scope, and re-deriving that rounding decision here would
 * be exactly the duplicated-calculation-logic this project forbids copying
 * into React. `formatDE()` (money.ts) already bakes the DECIDED, ROUNDED
 * value into a German-punctuated numeral string (`.` thousands, `,`
 * decimal); this function re-typesets THAT numeral for `en` through
 * `Intl.NumberFormat` — inverse-parsing a string back to the number it
 * already represents is not re-deciding a rounding rule. German-punctuated
 * DENOMINATOR NAMES (`WFL nach WoFlV`, `BGF oberirdisch`, …) and the
 * glossary term `OKBP` are untouched by design (LOCALE-009: normative
 * denominators/glossary terms are never machine-translated) — this
 * function only matches NUMERALS, never letters.
 */
const GERMAN_NUMERAL = /-?\d{1,3}(?:\.\d{3})*(?:,\d+)?/g

export function localizeMoneyText(text: string, lang: UiLanguage): string {
  if (lang !== 'en') return text
  return text.replace(GERMAN_NUMERAL, (match) => {
    const negative = match.startsWith('-')
    const unsigned = negative ? match.slice(1) : match
    const [intPart, fracPart] = unsigned.split(',')
    const digits = intPart!.replace(/\./g, '')
    const value = Number(fracPart ? `${digits}.${fracPart}` : digits)
    if (!Number.isFinite(value)) return match
    const out = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: fracPart ? fracPart.length : 0,
      maximumFractionDigits: fracPart ? fracPart.length : 0,
    }).format(value)
    return negative ? `-${out}` : out
  })
}

/**
 * Rule 7: DE `19 %` (narrow no-break space before the sign) vs EN `19%`
 * (no separator at all). Applied on top of `localizeMoneyText` so a
 * percent value's own digits (e.g. a rounded `17,5`) get the same
 * numeral re-typesetting as money/rate values.
 */
export function localizePercentText(text: string, lang: UiLanguage): string {
  if (lang !== 'en') return text
  return localizeMoneyText(text, lang).replace(/ %/g, '%')
}

/**
 * Перевод произвольной НЕМЕЦКОЙ строки по обратному индексу поставки.
 * Мост на время перевода экранов: строки, чей немецкий текст совпадает
 * со значением ключа Codex, получают английский без ручного переноса на
 * ключи. Несовпавшие остаются немецкими — это видимый остаток работы,
 * а не скрытый.
 */
/**
 * Локального дополнения больше нет: поставка № 3 забрала все строки хрома
 * (включая пять, где черновик Claude разошёлся с каноном терминологии, —
 * канон победил: KG — неизменяемый DIN-идентификатор). Источник EN —
 * ТОЛЬКО поставки Codex; появление новых строк между поставками честно
 * остаётся немецким до следующего задания копирайта.
 */

const DE_TO_KEY = new Map(Object.entries(GENERATED_DE).map(([k, v]) => [v, k]))

export function translateText(deText: string, lang: UiLanguage): string {
  if (lang !== 'en') return deText
  const trimmed = deText.trim()
  const narrowedTotalPrefix = 'Gesamt netto · Grundleistung All3 · '
  if (trimmed.startsWith(narrowedTotalPrefix)) {
    return translate('pricing.total.buildingScope', lang, {
      building: trimmed.slice(narrowedTotalPrefix.length),
    })
  }
  const key = DE_TO_KEY.get(trimmed)
  return key ? (GENERATED_EN[key] ?? deText) : deText
}

/** Хук: словарная функция текущего языка UI. */
export function useT(): (key: MessageKey | string, values?: MessageValues) => string {
  const lang = useStore().uiLanguage
  return (key, values) => translate(key, lang, values)
}

/** Хук моста: перевод немецкой строки, если она есть в поставке Codex. */
export function useTx(): (deText: string) => string {
  const lang = useStore().uiLanguage
  return (deText) => translateText(deText, lang)
}
