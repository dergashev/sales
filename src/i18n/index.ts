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
    'Zuerst mindestens ein Gebäude auswählen und jedes gewählte Gebäude bestätigen.',
  'buildingScope.title': 'Gebäude & Umfang',
  'buildingScope.meta':
    'Vor dem Konfigurator · {confirmed} von {selected} gewählten Gebäuden bestätigt',
  'buildingScope.lede':
    'Legen Sie den Angebotsumfang fest und prüfen Sie die Gebäudedaten, bevor die Konfiguration und Kalkulation beginnen.',
  'buildingScope.selection.title': 'Gebäude im Angebot',
  'buildingScope.selection.intro':
    'Wählen Sie alle Gebäude, die Bestandteil dieser Option sein sollen. Abgewählte Gebäude behalten ihre Angaben.',
  'buildingScope.selection.dataLabel': 'Gefundene Gebäude',
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
  'buildingScope.group.identity': 'Identität',
  'buildingScope.group.above': 'Flächen oberirdisch',
  'buildingScope.group.below': 'Flächen unterirdisch',
  'buildingScope.group.total': 'Flächen',
  'buildingScope.group.storeys': 'Geschossstruktur',
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
  'presentation.flow.offerEyebrow': 'Ihr indikatives Angebot',
  'presentation.flow.offerTitle': 'Das Angebot bekommt kommerzielle Kontur.',
  'presentation.flow.offerIntro': 'Die wichtigsten Größen auf einen Blick.',
  'presentation.flow.total': 'Gesamt netto',
  'presentation.flow.prepare': 'Angebot prüfen und senden',
  'presentation.flow.send.title': 'Bereit zum Senden',
  'presentation.flow.send.copy': 'Prüfen Sie Empfänger, Sprache und die drei enthaltenen Artefakte.',
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
  'presentation.flow.deliveredTitle': 'Angebot zugestellt (simuliert)',
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
    'Select at least one building and confirm every selected building first.',
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
    'Select at least one building and confirm every selected building first.',
  'buildingScope.title': 'Building & scope',
  'buildingScope.meta':
    'Before the Configurator · {confirmed} of {selected} selected buildings confirmed',
  'buildingScope.lede':
    'Set the offer scope and review the building data before configuration and pricing begin.',
  'buildingScope.selection.title': 'Buildings in the offer',
  'buildingScope.selection.intro':
    'Select every building that should be part of this option. Deselected buildings retain their data.',
  'buildingScope.selection.dataLabel': 'Discovered buildings',
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
  'buildingScope.group.identity': 'Identity',
  'buildingScope.group.above': 'Above-ground areas',
  'buildingScope.group.below': 'Below-ground areas',
  'buildingScope.group.total': 'Areas',
  'buildingScope.group.storeys': 'Storey structure',
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
  'presentation.flow.offerEyebrow': 'Your indicative offer',
  'presentation.flow.offerTitle': 'The offer takes commercial shape.',
  'presentation.flow.offerIntro': 'The most important figures at a glance.',
  'presentation.flow.total': 'Net total',
  'presentation.flow.prepare': 'Review and send offer',
  'presentation.flow.send.title': 'Ready to send',
  'presentation.flow.send.copy': 'Review the recipient, language and three included artifacts.',
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
  'presentation.flow.deliveredTitle': 'Offer delivered (simulated)',
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
 * Rule 7: DE `19 %` (narrow no-break space before the sign) vs EN `19%`
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
