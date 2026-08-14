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
  'shell.mode.intern': 'Intern',
  'shell.mode.praesentation': 'Präsentation',
  'shell.mode.blockedReason':
    'Zuerst mindestens ein Gebäude auswählen und jedes gewählte Gebäude bestätigen.',
  'shell.mode.legend': 'Modus',
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
  'common.fulfilled': 'Erfüllt',
  'common.open': 'Offen',
  'designSystem.readinessSummary': '{done} von {total} Punkten bereit',
  'oppcard.prerequisitesSummary': '{done} von {total} Voraussetzungen erfüllt',
  'oppcard.resolveConflictingInformation': 'Strittige Angaben jetzt entscheiden',
  'oppcard.confirmProjectParametersNow': 'Projektparameter jetzt bestätigen',
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
  'buildingScope.fact.storeys': 'Geschossstruktur',
  'buildingScope.value.notCaptured': 'Nicht erfasst',
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
  'buildingScope.tabs.label': 'Gewählte Gebäude',
  'buildingScope.tabs.first': 'Zum ersten Gebäude-Tab',
  'buildingScope.tabs.last': 'Zum letzten Gebäude-Tab',
  'buildingScope.group.identity': 'Identität',
  'buildingScope.group.above': 'Flächen oberirdisch',
  'buildingScope.group.below': 'Flächen unterirdisch',
  'buildingScope.group.total': 'Gesamt, Nutzung und Einheiten',
  'buildingScope.group.storeys': 'Geschossstruktur',
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
  'buildingScope.confirm.conflictReason':
    'Zuerst {count} offene Konflikte für dieses Gebäude entscheiden.',
  'buildingScope.confirm.action': 'Gebäude bestätigen',
  'buildingScope.action.apply': 'Angabe übernehmen',
  'buildingScope.action.reset': 'Auf Quellenwert zurücksetzen',
  'buildingScope.validation.textRequired':
    'Eine leere Angabe wird nicht übernommen. Der bisherige Wert bleibt erhalten.',
  'buildingScope.validation.number': 'Nur Zahlen eingeben — nicht übernommen.',
  'buildingScope.validation.positive':
    'Der Wert muss größer als null sein — nicht übernommen.',
  'buildingScope.validation.integer': 'Nur ganze Einheiten eingeben — nicht übernommen.',
  'buildingScope.validation.storeys':
    'Mindestens eine Geschossart muss eine Anzahl größer als null haben.',
  'buildingScope.storeys.ug': 'Untergeschosse (UG)',
  'buildingScope.storeys.eg': 'Erdgeschosse (EG)',
  'buildingScope.storeys.og': 'Obergeschosse (OG)',
  'buildingScope.storeys.sg': 'Staffelgeschosse (SG)',
  'buildingScope.storeys.manualContext': 'Manuell strukturierte Geschossangabe',
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
  'configurator.scope.single': 'Konfiguration für {building} · {status}',
  'configurator.scope.announcement': '{scope} ausgewählt. Status: {status}.',
  'configurator.status.open': 'Offen',
  'configurator.status.ready': 'Bereit',
  'configurator.status.confirmed': 'Bestätigt',
  'configurator.status.recheck': 'Erneut prüfen',
  'configurator.status.openDetail':
    'Die Gebäudeschritte 1, 3, 4 und 5 noch vollständig durchgehen.',
  'configurator.status.readyDetail':
    'Alle erforderlichen Gebäudeschritte wurden durchgegangen. Die Konfiguration kann bestätigt werden.',
  'configurator.status.confirmedDetail': 'Die sichtbare Konfiguration ist bestätigt.',
  'configurator.status.recheckDetail':
    'Gebäudeangaben oder Konfigurationswerte haben sich geändert. Vor der Bestätigung erneut prüfen.',
  'configurator.status.confirmBuilding': 'Konfiguration für {building} bestätigen',
  'configurator.status.confirmShared': 'Gemeinsame Konfiguration bestätigen',
  'configurator.overview.title': 'Konfigurationsstand',
  'configurator.overview.label': 'Konfigurationsstand aller Gebäude',
  'configurator.sidebar.title': 'Vor der Kalkulation',
  'configurator.sidebar.body':
    'Die Kalkulation beginnt erst in der Leistungsabgrenzung. Die Moduswahl allein erzeugt noch keinen Preis.',
  'journal.empty': 'Journal: noch keine übernommenen Änderungen',
  'shell.en.draftActive': 'EN: Entwurf — Übersetzung noch nicht vollständig',
  'shell.en.draftHint': 'EN ist noch ein Entwurf: die Übersetzung wird gerade vervollständigt',
} as const

export type MessageKey = keyof typeof de

/**
 * Локальный словарь оболочки. EN здесь полный: остаток перевода живёт в
 * поставках Codex, а не в этой таблице, и меряется обходом DOM
 * (`src/i18n/__tests__/en-remainder.dom.test.tsx`).
 */
const en: Partial<Record<MessageKey, string>> = {
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
  'shell.mode.intern': 'Internal',
  'shell.mode.praesentation': 'Presentation',
  'shell.mode.blockedReason':
    'Select at least one building and confirm every selected building first.',
  'shell.mode.legend': 'Mode',
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
  'common.fulfilled': 'Complete',
  'common.open': 'Open',
  'designSystem.readinessSummary': '{done} of {total} points ready',
  'oppcard.prerequisitesSummary': '{done} of {total} prerequisites complete',
  'oppcard.resolveConflictingInformation': 'Resolve conflicting information now',
  'oppcard.confirmProjectParametersNow': 'Confirm project parameters now',
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
  'buildingScope.fact.storeys': 'Storey structure',
  'buildingScope.value.notCaptured': 'Not captured',
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
  'buildingScope.tabs.label': 'Selected buildings',
  'buildingScope.tabs.first': 'Go to first building tab',
  'buildingScope.tabs.last': 'Go to last building tab',
  'buildingScope.group.identity': 'Identity',
  'buildingScope.group.above': 'Above-ground areas',
  'buildingScope.group.below': 'Below-ground areas',
  'buildingScope.group.total': 'Total, use and units',
  'buildingScope.group.storeys': 'Storey structure',
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
  'buildingScope.confirm.conflictReason':
    'Resolve {count} open conflicts for this building first.',
  'buildingScope.confirm.action': 'Confirm building',
  'buildingScope.action.apply': 'Apply value',
  'buildingScope.action.reset': 'Reset to source value',
  'buildingScope.validation.textRequired':
    'An empty value is not applied. The previous value remains unchanged.',
  'buildingScope.validation.number': 'Enter numbers only — not applied.',
  'buildingScope.validation.positive':
    'The value must be greater than zero — not applied.',
  'buildingScope.validation.integer': 'Enter whole units only — not applied.',
  'buildingScope.validation.storeys':
    'At least one storey type must have a count greater than zero.',
  'buildingScope.storeys.ug': 'Basement storeys (UG)',
  'buildingScope.storeys.eg': 'Ground storeys (EG)',
  'buildingScope.storeys.og': 'Upper storeys (OG)',
  'buildingScope.storeys.sg': 'Setback storeys (SG)',
  'buildingScope.storeys.manualContext': 'Manually structured storey data',
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
  'configurator.scope.single': 'Configuration for {building} · {status}',
  'configurator.scope.announcement': '{scope} selected. Status: {status}.',
  'configurator.status.open': 'Open',
  'configurator.status.ready': 'Ready',
  'configurator.status.confirmed': 'Confirmed',
  'configurator.status.recheck': 'Review again',
  'configurator.status.openDetail':
    'Complete building steps 1, 3, 4 and 5.',
  'configurator.status.readyDetail':
    'All required building steps have been reviewed. The configuration can be confirmed.',
  'configurator.status.confirmedDetail': 'The visible configuration is confirmed.',
  'configurator.status.recheckDetail':
    'Building data or configuration values changed. Review them again before confirming.',
  'configurator.status.confirmBuilding': 'Confirm configuration for {building}',
  'configurator.status.confirmShared': 'Confirm shared configuration',
  'configurator.overview.title': 'Configuration status',
  'configurator.overview.label': 'Configuration status for all buildings',
  'configurator.sidebar.title': 'Before pricing',
  'configurator.sidebar.body':
    'Pricing starts only in Scope boundaries. The mode choice alone does not create a price.',
  'journal.empty': 'Journal: no adopted changes yet',
  'shell.en.draftActive': 'EN: draft — translation not yet complete',
  'shell.en.draftHint': 'EN is still a draft: the translation is being completed',
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
