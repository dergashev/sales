# -*- coding: utf-8 -*-
"""Generates src/fixtures/kg-configuration.json and PROVES its arithmetic.

Authority for every declared total: VR3-00 `06-demo-fixtures/
demo-project-fixtures.md` and the approved rail in `03-target/1440x900/
T-018.png`, both at ba0263b. The generator exists for the same reason
tools/build_fixtures.py exists: a hand-written total is a second source of
truth, and a KG split that does not sum is a release blocker (rule 32).
"""
import json, pathlib
from decimal import Decimal as D

NNBSP = ' '
OUT = pathlib.Path('src/fixtures/kg-configuration.json')

def money(x):
    return f'{D(x):.2f}'

# ── helpers ──────────────────────────────────────────────────────────────
def svc(sid, de, en, sde, sen, amount, baseline='selected', kind=None,
        building=None, depends=None, authority='sourceEvidenced'):
    s = {
        'id': sid, 'labelDe': de, 'labelEn': en,
        'summaryDe': sde, 'summaryEn': sen,
        'amount': money(amount), 'baseline': baseline,
        'kind': kind or {'kind': 'includeExclude'},
        'authority': authority,
    }
    if building: s['buildingId'] = building
    if depends: s['dependsOn'] = depends
    return s

def required(sid, de, en, sde, sen, amount, building=None, depends=None):
    return svc(sid, de, en, sde, sen, amount, baseline='notSelected',
               kind={'kind': 'requiredDecision'}, building=building,
               depends=depends, authority='assumed')

def choice(sid, de, en, sde, sen, variants, baseline_variant, depends=None):
    return {
        'id': sid, 'labelDe': de, 'labelEn': en,
        'summaryDe': sde, 'summaryEn': sen,
        'amount': money(0), 'baseline': 'selected',
        'kind': {'kind': 'singleChoice', 'baselineVariant': baseline_variant,
                 'variants': variants},
        'authority': 'assumed',
        **({'dependsOn': depends} if depends else {}),
    }

def variant(v, de, en, delta):
    return {'value': v, 'labelDe': de, 'labelEn': en, 'delta': money(delta)}

def quantity(sid, de, en, sde, sen, unit_amount, qty, unit_de, unit_en,
             baseline='selected', building=None):
    return {
        'id': sid, 'labelDe': de, 'labelEn': en,
        'summaryDe': sde, 'summaryEn': sen,
        'amount': money(D(unit_amount) * D(qty)), 'baseline': baseline,
        'kind': {'kind': 'quantity', 'unitAmount': money(unit_amount),
                 'baselineQuantity': str(qty), 'unitDe': unit_de,
                 'unitEn': unit_en, 'minQuantity': '0', 'maxQuantity': '100000'},
        'authority': 'derived',
        **({'buildingId': building} if building else {}),
    }

def group(gid, de, en, services):
    return {'id': gid, 'labelDe': de, 'labelEn': en, 'services': services}

def chapter(g, tde, ten, nde, nen, groups):
    return {'group': g, 'titleDe': tde, 'titleEn': ten,
            'scopeNoteDe': nde, 'scopeNoteEn': nen, 'groups': groups}


# The ledger row's CONCISE boundary. Separate from `scopeNote*`, which is the
# KG page's lead: a row in a table of six needs the boundary in a glance, and
# a full sentence there turned every row three lines tall.
BOUNDARIES = {'DEMO-HAPPY-01|KG_200': ('Baustelle, Baufeld und Hausanschlüsse', 'Site, clearance and utility connections'), 'DEMO-HAPPY-01|KG_300': ('Gründung, Tragwerk, Fassade, Dach', 'Foundation, structure, facade, roof'), 'DEMO-HAPPY-01|KG_400': ('Wärme, Sanitär, Elektro, Energiestandard', 'Heat, plumbing, electrical, energy standard'), 'DEMO-HAPPY-01|KG_500': ('Wege, Bepflanzung, Spielfläche', 'Paths, planting, play area'), 'DEMO-HAPPY-01|KG_600': ('Feste Ausstattung der Gemeinschaftsflächen', 'Fixed equipment for the shared areas'), 'DEMO-HAPPY-01|KG_700': ('Planung, Beratung, Nachweise', 'Design, consultancy, certification'), 'DEMO-COMPLEX-01|KG_200': ('Baustelle, Rückbau, Erschließung', 'Site, demolition, connections'), 'DEMO-COMPLEX-01|KG_300': ('Gründung, Untergeschosse, Tragwerk, Fassaden', 'Foundation, basements, structure, facades'), 'DEMO-COMPLEX-01|KG_400': ('Wärme, Lüftung, Sanitär, Elektro', 'Heat, ventilation, plumbing, electrical'), 'DEMO-COMPLEX-01|KG_500': ('Innenhof, Erschließung, Regenwasser', 'Courtyard, access, stormwater'), 'DEMO-COMPLEX-01|KG_600': ('Feste Ausstattung, Gewerbe-EG', 'Fixed equipment, commercial ground floor'), 'DEMO-COMPLEX-01|KG_700': ('Planung, Gutachten, Nachweise', 'Design, surveys, certification')}


def attach_boundaries(project_id, chapters):
    for ch in chapters:
        de, en = BOUNDARIES[f"{project_id}|{ch['group']}"]
        ch['boundaryDe'] = de
        ch['boundaryEn'] = en
    return chapters

# ── PROJECT A · DEMO-HAPPY-01 · 6.480.000 EUR net, ±5 % ──────────────────
A = [
 chapter('KG_200', 'Vorbereitende Maßnahmen', 'Preparatory works',
   'Baustelle, Baufeldfreimachung und Hausanschlüsse für den Wohnhof.',
   'Site set-up, site clearance and utility connections for the courtyard.',
   [group('a-kg200-site', 'Baustelle & Erschließung', 'Site & connections', [
     svc('a-200-01', 'Baustelleneinrichtung', 'Site set-up',
         'Einrichtung, Vorhaltung und Räumung der Baustelle.',
         'Set-up, provision and clearance of the construction site.', 68000),
     svc('a-200-02', 'Baufeldfreimachung & Rodung', 'Site clearance',
         'Oberboden abtragen, Bewuchs entfernen, Baufeld herstellen.',
         'Topsoil removal, vegetation clearance, site preparation.', 44000),
     svc('a-200-03', 'Hausanschlüsse Ver- und Entsorgung', 'Utility connections',
         'Strom, Wasser, Abwasser und Telekommunikation bis zur Gebäudekante.',
         'Power, water, sewage and telecoms up to the building edge.', 68000),
     required('a-200-90', 'Rückbau Bestandsgebäude', 'Demolition of existing structure',
         'Auf dem Grundstück steht kein Bestand — die Position ist zu entscheiden, nicht anzunehmen.',
         'No existing structure on the plot — a decision, not an assumption.', 145000),
   ])]),
 chapter('KG_300', 'Baukonstruktion', 'Building construction',
   'Gründung, Tragwerk, Fassade und Dach des Wohnhofs.',
   'Foundation, structure, facade and roof of the courtyard building.',
   [group('a-kg300-shell', 'Rohbau & Tragwerk', 'Shell & structure', [
     svc('a-300-01', 'Gründung & Bodenplatte', 'Foundation & floor slab',
         'Flachgründung ohne Untergeschoss, Sohlplatte mit Randverstärkung.',
         'Shallow foundation without basement, slab with edge reinforcement.', 520000),
     svc('a-300-02', 'Tragwerk Massivbau', 'Solid structure',
         'Stahlbeton-Decken und Mauerwerkswände, konventionell.',
         'Reinforced-concrete slabs and masonry walls, conventional.', 1760000),
   ]),
    group('a-kg300-envelope', 'Fassade & Dach', 'Facade & roof', [
     svc('a-300-03', 'Fassade Mineralputz', 'Mineral-render facade',
         'Wärmedämmverbundsystem mit mineralischem Oberputz.',
         'External insulation system with a mineral top coat.', 1180000),
     svc('a-300-04', 'Dach & Abdichtung', 'Roof & waterproofing',
         'Flachdach mit Abdichtung, Attika und Entwässerung.',
         'Flat roof with waterproofing, parapet and drainage.', 560000),
     required('a-300-90', 'Balkone & Loggien', 'Balconies & loggias',
         'Die Ansichten zeigen Balkone; der Umfang ist nicht bestätigt.',
         'The elevations show balconies; the extent is not confirmed.', 240000),
   ])]),
 chapter('KG_400', 'Technische Anlagen', 'Technical installations',
   'Wärme, Sanitär und Elektro für 18 Wohneinheiten.',
   'Heating, plumbing and electrical for 18 dwellings.',
   [group('a-kg400-heat', 'Wärme & Energiestandard', 'Heat & energy standard', [
     svc('a-400-01', 'Wärmeerzeugung Wärmepumpe', 'Heat pump plant',
         'Zentrale Sole-Wasser-Wärmepumpe mit Pufferspeicher.',
         'Central brine-water heat pump with buffer storage.', 430000),
     choice('a-400-es', 'Energiestandard', 'Energy standard',
         'Der Standard beschreibt das Gebäude; das Band verengt sich erst mit der Kundenbestätigung.',
         'The standard describes the building; the band narrows only on customer confirmation.',
         [variant('geg', 'GEG-Standard', 'GEG standard', -97000),
          variant('eh55', 'Effizienzhaus 55', 'Efficiency house 55', 0),
          variant('eh40', 'Effizienzhaus 40', 'Efficiency house 40', 97000),
          variant('eh40nh', 'Effizienzhaus 40 NH', 'Efficiency house 40 NH', 195000)],
         'eh55'),
   ]),
    group('a-kg400-services', 'Sanitär & Elektro', 'Plumbing & electrical', [
     svc('a-400-02', 'Heizflächen, Verteilung & Sanitär', 'Emitters, distribution & plumbing',
         'Fußbodenheizung, Steigleitungen und Sanitärinstallation je Wohnung.',
         'Underfloor heating, risers and per-dwelling plumbing.', 580000),
     svc('a-400-03', 'Elektro & Datennetz', 'Electrical & data',
         'Wohnungsverteilungen, Beleuchtung, Klingel- und Datennetz.',
         'Dwelling distribution boards, lighting, doorbell and data network.', 380000),
     required('a-400-90', 'Photovoltaik Dachfläche', 'Rooftop photovoltaics',
         'Die Dachfläche trägt eine Anlage; der Kunde hat sie nicht beauftragt.',
         'The roof can carry an array; the client has not commissioned one.', 165000),
   ])]),
 chapter('KG_500', 'Außenanlagen', 'External works',
   'Wege, Bepflanzung und Spielfläche im Innenhof.',
   'Paths, planting and play area in the courtyard.',
   [group('a-kg500-open', 'Freiflächen & Erschließung', 'Open space & access', [
     quantity('a-500-01', 'Wege & Platzflächen', 'Paths & paved areas',
         'Betonsteinpflaster, Zufahrt und Hauseingangsbereiche.',
         'Concrete-block paving, driveway and entrance areas.',
         320, 300, 'm²', 'm²'),
     svc('a-500-02', 'Bepflanzung & Rasen', 'Planting & lawn',
         'Rasenflächen, Sträucher und vier Hofbäume.',
         'Lawn areas, shrubs and four courtyard trees.', 74000),
     svc('a-500-03', 'Spielfläche', 'Play area',
         'Spielgeräte, Fallschutz und Einfassung nach DIN EN 1176.',
         'Play equipment, impact protection and edging to DIN EN 1176.', 58000),
     svc('a-500-04', 'Einfriedung & Müllstandplatz', 'Enclosure & refuse area',
         'Grundstückseinfriedung und überdachter Müllstandplatz.',
         'Site enclosure and a roofed refuse area.', 72000),
     required('a-500-90', 'Tiefgaragenzufahrt', 'Underground garage ramp',
         'Der Wohnhof hat kein Untergeschoss — eine Zufahrt ist zu entscheiden.',
         'The courtyard has no basement — a ramp is a decision.', 210000),
   ])]),
 chapter('KG_600', 'Ausstattung', 'Fixtures & equipment',
   'Feste Ausstattung der Gemeinschaftsflächen.',
   'Fixed equipment for the shared areas.',
   [group('a-kg600-fixed', 'Feste Ausstattung', 'Fixed equipment', [
     svc('a-600-01', 'Briefkastenanlage', 'Letterbox installation',
         'Freistehende Anlage für 18 Wohneinheiten mit Paketfach.',
         'Free-standing installation for 18 dwellings with a parcel box.', 26000),
     quantity('a-600-02', 'Fahrradabstellanlage', 'Bicycle parking',
         'Überdachte Anlehnbügel im Hofbereich.',
         'Covered leaning racks in the courtyard.', 500, 84, 'Plätze', 'spaces'),
     svc('a-600-03', 'Beschilderung & Hausnummern', 'Signage & house numbers',
         'Orientierung, Klingeltableau-Beschriftung und Hausnummern.',
         'Wayfinding, doorbell labelling and house numbers.', 32000),
     required('a-600-90', 'Kunst am Bau', 'Public art',
         'Kein Programm verlangt sie; sie ist eine Entscheidung des Bauherrn.',
         'No programme requires it; it is the client’s decision.', 48000),
   ])]),
 chapter('KG_700', 'Baunebenkosten', 'Ancillary costs',
   'Planung, Beratung und Nachweise.',
   'Design, consultancy and certification.',
   [group('a-kg700-design', 'Planung & Beratung', 'Design & consultancy', [
     svc('a-700-01', 'Objektplanung', 'Architectural design',
         'Leistungsphasen 1 bis 8 nach HOAI, Honorarzone III.',
         'HOAI work stages 1 to 8, fee zone III.', 268000),
     svc('a-700-02', 'Tragwerksplanung', 'Structural design',
         'Standsicherheitsnachweis und Ausführungsplanung.',
         'Structural verification and detailed design.', 84000),
     svc('a-700-03', 'TGA-Planung', 'Building services design',
         'Heizung, Sanitär, Elektro und Lüftung, integriert geplant.',
         'Heating, plumbing, electrical and ventilation, planned together.', 96000),
     svc('a-700-04', 'Vermessung & Baugrundgutachten', 'Survey & soil report',
         'Lage- und Höhenaufnahme, Baugrunderkundung mit Bohrprofilen.',
         'Site and level survey, soil investigation with borehole logs.', 42000),
   ]),
    group('a-kg700-certificates', 'Nachweise & Zertifikate', 'Certification', [
     choice('a-700-qng', 'QNG-Siegel', 'QNG label',
         'Das Siegel beschreibt das Nachweisverfahren, nicht das Gebäude.',
         'The label describes the verification procedure, not the building.',
         [variant('none', 'kein QNG', 'no QNG', 0),
          variant('plus', 'QNG-PLUS', 'QNG-PLUS', 92000),
          variant('premium', 'QNG-PREMIUM', 'QNG-PREMIUM', 156000)],
         'none'),
     choice('a-700-dgnb', 'DGNB-Zertifikat', 'DGNB certificate',
         'Auditierung und Dokumentation eines dritten Prüfers.',
         'Auditing and documentation by a third-party assessor.',
         [variant('none', 'keine Zertifizierung', 'no certification', 0),
          variant('silver', 'DGNB SILBER', 'DGNB SILVER', 68000),
          variant('gold', 'DGNB GOLD', 'DGNB GOLD', 124000),
          variant('platinum', 'DGNB PLATIN', 'DGNB PLATINUM', 208000)],
         'none'),
     required('a-700-90', 'Baubegleitende Qualitätssicherung', 'Construction-stage quality assurance',
         'Zusätzliche Überwachung durch einen unabhängigen Sachverständigen.',
         'Additional supervision by an independent expert.', 58000),
   ])]),
]

A_DECLARED = {'KG_200': 180000, 'KG_300': 4020000, 'KG_400': 1390000,
              'KG_500': 300000, 'KG_600': 100000, 'KG_700': 490000}

# ── PROJECT B · DEMO-COMPLEX-01 · 38.740.000 EUR net, ±6 % ───────────────
BA, BB, BC = 'B-BLDG-A', 'B-BLDG-B', 'B-BLDG-C'

B = [
 chapter('KG_200', 'Vorbereitende Maßnahmen', 'Preparatory works',
   'Baustelle, Rückbau und Erschließung für das gesamte Quartier.',
   'Site set-up, demolition and connections for the whole quarter.',
   [group('b-kg200-site', 'Baustelle, Rückbau & Erschließung', 'Site, demolition & connections', [
     svc('b-200-01', 'Baustelleneinrichtung Quartier', 'Quarter-wide site set-up',
         'Gemeinsame Einrichtung für drei Baukörper, Kran- und Lagerflächen.',
         'Shared set-up for three buildings, crane and storage areas.', 280000),
     svc('b-200-02', 'Baufeldfreimachung & Rodung', 'Site clearance',
         'Oberboden, Bewuchs und Restfundamente der Logistikfläche.',
         'Topsoil, vegetation and residual foundations of the logistics yard.', 190000),
     svc('b-200-03', 'Rückbau Ladeplatte', 'Loading-slab demolition',
         'Provisorischer Ansatz: der Lageplan zeigt die Platte, der Auftrag schweigt (B-Q-05).',
         'Provisional allowance: the site plan shows the slab, the brief is silent (B-Q-05).',
         240000, authority='assumed'),
     svc('b-200-04', 'Hausanschlüsse Ver- und Entsorgung', 'Utility connections',
         'Drei Hausanschlussräume, Fernwärmeübergabe und Löschwasser.',
         'Three service entry rooms, district-heat transfer and firefighting water.', 310000),
     quantity('b-200-05', 'Baustraße & Zufahrt', 'Site road & access',
         'Tragschicht und Verkehrsflächen während der Bauzeit.',
         'Base course and traffic areas during construction.',
         400, 250, 'm²', 'm²'),
     required('b-200-90', 'Bodenaustausch & Entsorgung', 'Soil replacement & disposal',
         'Das Baugrundgutachten liegt noch nicht vor; der Umfang ist offen.',
         'The soil report is outstanding; the extent is open.', 380000),
     required('b-200-91', 'Kampfmittelsondierung', 'Ordnance survey',
         'Für den Standort nicht angeordnet, in Leipzig aber üblich.',
         'Not ordered for this site, but common in Leipzig.', 60000),
   ])]),
 chapter('KG_300', 'Baukonstruktion', 'Building construction',
   'Gründung, Untergeschosse, Tragwerk und Fassaden von Haus A, B und C.',
   'Foundation, basements, structure and facades of buildings A, B and C.',
   [group('b-kg300-foundation', 'Gründung & Untergeschoss', 'Foundation & basement', [
     svc('b-300-01', 'Gründung Kontorhaus', 'Foundation Kontorhaus',
         'Flachgründung ohne Untergeschoss, Haus A.',
         'Shallow foundation without basement, building A.', 620000, building=BA),
     svc('b-300-02', 'Gründung Hofhaus', 'Foundation Hofhaus',
         'Gründung unter dem Vollkeller, Haus B.',
         'Foundation below the full basement, building B.', 540000, building=BB),
     svc('b-300-03', 'Gründung Stadthaus', 'Foundation Stadthaus',
         'Gründung mit Teilunterkellerung, Haus C.',
         'Foundation with partial basement, building C.', 660000, building=BC),
     svc('b-300-04', 'Untergeschoss Hofhaus', 'Basement Hofhaus',
         'Vollkeller mit 36 Stellplätzen, weiße Wanne, Haus B.',
         'Full basement with 36 parking spaces, watertight concrete, building B.',
         1180000, building=BB),
     svc('b-300-05', 'Untergeschoss Stadthaus', 'Basement Stadthaus',
         'Teilunterkellerung mit Technik und 22 Stellplätzen, Haus C (B-CF-03).',
         'Partial basement with plant room and 22 parking spaces, building C (B-CF-03).',
         860000, building=BC),
     choice('b-300-ug', 'Untergeschoss-Umfang Haus C', 'Basement extent building C',
         'FINAL-REV zeigt eine Teilunterkellerung; die aufgehobene Fassung zeigte einen Vollkeller.',
         'FINAL-REV shows a partial basement; the superseded issue showed a full one.',
         [variant('partial', 'Teilunterkellerung', 'Partial basement', 0),
          variant('full', 'Vollunterkellerung', 'Full basement', 740000)],
         'partial'),
   ]),
    group('b-kg300-structure', 'Tragwerk', 'Structure', [
     svc('b-300-06', 'Tragwerk Kontorhaus', 'Structure Kontorhaus',
         'Stahlbeton-Skelett mit Flachdecken, EG plus fünf Obergeschosse.',
         'Reinforced-concrete frame with flat slabs, ground plus five upper floors.',
         4980000, building=BA),
     svc('b-300-07', 'Tragwerk Hofhaus', 'Structure Hofhaus',
         'Wandscheiben und Massivdecken, 46 Wohneinheiten (B-CF-02).',
         'Shear walls and solid slabs, 46 dwellings (B-CF-02).', 4060000, building=BB),
     svc('b-300-08', 'Tragwerk Stadthaus', 'Structure Stadthaus',
         'Gewerbe-EG mit größerer Stützweite, sechs Wohngeschosse darüber.',
         'Commercial ground floor with a longer span, six residential floors above.',
         5320000, building=BC),
   ]),
    group('b-kg300-envelope', 'Fassade & Dach', 'Facade & roof', [
     svc('b-300-09', 'Fassade & Dach Kontorhaus', 'Facade & roof Kontorhaus',
         'Klinkervorsatzschale, Lochfassade, Retentionsdach.',
         'Brick facing, punched openings, retention roof.', 2180000, building=BA),
     svc('b-300-10', 'Fassade & Dach Hofhaus', 'Facade & roof Hofhaus',
         'Mineralputz mit Klinkersockel, begrüntes Flachdach.',
         'Mineral render with a brick plinth, green flat roof.', 1540000, building=BB),
     svc('b-300-11', 'Fassade & Dach Stadthaus', 'Facade & roof Stadthaus',
         'Klinker im EG, Putz darüber, Dachterrasse im Staffelgeschoss.',
         'Brick at ground level, render above, roof terrace on the set-back floor.',
         2040000, building=BC),
     choice('b-300-facade', 'Fassadenmaterial Quartier', 'Quarter facade material',
         'Ein Material für das Ensemble; die Ansichten zeigen den koordinierten Stand.',
         'One material for the ensemble; the elevations show the coordinated issue.',
         [variant('clinker', 'Klinker & Mineralputz', 'Brick & mineral render', 0),
          variant('render', 'Mineralputz durchgehend', 'Mineral render throughout', -620000),
          variant('timber', 'Holzschalung Obergeschosse', 'Timber cladding on upper floors', 480000)],
         'clinker'),
     required('b-300-90', 'Dachbegrünung erweitert', 'Extended green roof',
         'Über die Retentionsanforderung hinaus, gestalterisch begründet.',
         'Beyond the retention requirement, justified by design.', 260000),
     required('b-300-91', 'Mieterausbau Kontorhaus', 'Tenant fit-out Kontorhaus',
         'B-Q-02: der Auftraggeberbrief lässt Shell-and-core gegen Mieterausbau offen.',
         'B-Q-02: the client brief leaves shell-and-core versus fit-out open.',
         1240000, building=BA),
   ])]),
 chapter('KG_400', 'Technische Anlagen', 'Technical installations',
   'Wärme, Lüftung, Sanitär und Elektro für drei Baukörper mit unterschiedlicher Nutzung.',
   'Heat, ventilation, plumbing and electrical for three buildings with different uses.',
   [group('b-kg400-heat', 'Wärme & Lüftung', 'Heat & ventilation', [
     svc('b-400-01', 'Wärmeerzeugung zentral', 'Central heat generation',
         'Gemeinsamer Ambient-Loop mit Wärmepumpen in der Energiezentrale.',
         'Shared ambient loop with heat pumps in the energy centre.', 1240000),
     choice('b-400-heat', 'Wärmekonzept', 'Heat concept',
         'Ein zentraler Kreis für das Quartier oder gebäudeweise Anlagen.',
         'One central loop for the quarter or building-level plants.',
         [variant('central', 'Zentraler Ambient-Loop', 'Central ambient loop', 0),
          variant('perBuilding', 'Gebäudeweise Anlagen', 'Building-level plants', -310000)],
         'central'),
     svc('b-400-02', 'Wärmeverteilung Kontorhaus', 'Heat distribution Kontorhaus',
         'Niedertemperatur-Verteilung mit Deckensegeln, Haus A.',
         'Low-temperature distribution with ceiling sails, building A.', 520000, building=BA),
     svc('b-400-03', 'Wärmeverteilung Hofhaus', 'Heat distribution Hofhaus',
         'Fußbodenheizung und Wohnungsstationen, Haus B.',
         'Underfloor heating and dwelling stations, building B.', 460000, building=BB),
     svc('b-400-04', 'Wärmeverteilung Stadthaus', 'Heat distribution Stadthaus',
         'Getrennte Zonen für Gewerbe-EG und Wohnen, Haus C.',
         'Separate zones for the commercial ground floor and dwellings, building C.',
         580000, building=BC),
     svc('b-400-05', 'Lüftungsanlagen', 'Ventilation plants',
         'Zentrale RLT für das Kontorhaus, dezentrale Geräte im Wohnungsbau.',
         'Central AHU for the Kontorhaus, decentralised units in the dwellings.', 1720000),
     choice('b-400-es', 'Energiestandard', 'Energy standard',
         'Der Standard beschreibt das Gebäude; das Band verengt sich erst mit der Kundenbestätigung.',
         'The standard describes the building; the band narrows only on customer confirmation.',
         [variant('geg', 'GEG-Standard', 'GEG standard', -540000),
          variant('eh55', 'Effizienzhaus 55', 'Efficiency house 55', 0),
          variant('eh40', 'Effizienzhaus 40', 'Efficiency house 40', 620000),
          variant('eh40nh', 'Effizienzhaus 40 NH', 'Efficiency house 40 NH', 1180000)],
         'eh55'),
   ]),
    group('b-kg400-services', 'Sanitär & Elektro', 'Plumbing & electrical', [
     svc('b-400-06', 'Sanitärinstallation Kontorhaus', 'Plumbing Kontorhaus',
         'Sanitärkerne je Geschoss für 340 Arbeitsplätze.',
         'Sanitary cores per floor for 340 workplaces.', 640000, building=BA),
     svc('b-400-07', 'Sanitärinstallation Hofhaus', 'Plumbing Hofhaus',
         'Steigezonen und Wohnungsinstallation, 46 Einheiten.',
         'Riser zones and dwelling installation, 46 units.', 720000, building=BB),
     svc('b-400-08', 'Sanitärinstallation Stadthaus', 'Plumbing Stadthaus',
         'Wohnungsinstallation plus Gewerbeanschlüsse im EG.',
         'Dwelling installation plus commercial connections at ground level.',
         820000, building=BC),
     svc('b-400-09', 'Elektro & Datennetz Kontorhaus', 'Electrical & data Kontorhaus',
         'Bodentanks, Beleuchtung und strukturierte Verkabelung.',
         'Floor boxes, lighting and structured cabling.', 780000, building=BA),
     svc('b-400-10', 'Elektro & Datennetz Hofhaus', 'Electrical & data Hofhaus',
         'Wohnungsverteilungen, Allgemeinstrom und Klingelanlage.',
         'Dwelling boards, landlord supply and doorbell system.', 460000, building=BB),
     svc('b-400-11', 'Elektro & Datennetz Stadthaus', 'Electrical & data Stadthaus',
         'Wohnungsverteilungen plus Gewerbeunterverteilung im EG.',
         'Dwelling boards plus a commercial sub-distribution at ground level.',
         480000, building=BC),
     required('b-400-90', 'Photovoltaik Dachflächen', 'Rooftop photovoltaics',
         'Alle drei Dächer sind geeignet; das Energiekonzept fordert sie nicht.',
         'All three roofs are suitable; the energy concept does not require them.', 620000),
     quantity('b-400-91', 'E-Ladeinfrastruktur', 'EV charging infrastructure',
         'B-Q-04: Leerrohre sind im Ansatz, Ladepunkte sind zu entscheiden.',
         'B-Q-04: conduits are allowed for, charge points are a decision.',
         8000, 22, 'Ladepunkte', 'charge points', baseline='notSelected',
         building=BC),
     required('b-400-92', 'Gastronomie-Lüftung Gewerbe-EG', 'Gastronomy ventilation, commercial ground floor',
         'B-Q-01: das Nutzungskonzept nennt Gastronomie, der Auftraggeberbrief nur Gewerbe.',
         'B-Q-01: the use concept names gastronomy, the client brief only commercial.',
         420000, building=BC),
   ])]),
 chapter('KG_500', 'Außenanlagen', 'External works',
   'Innenhof, Erschließung und Regenwasser für das Quartier.',
   'Courtyard, access and stormwater for the quarter.',
   [group('b-kg500-open', 'Freiflächen & Erschließung', 'Open space & access', [
     svc('b-500-01', 'Innenhof & Aufenthaltsflächen', 'Courtyard & amenity areas',
         'Gemeinschaftlicher Hof, B-Q-07: als Quartierspaket geführt.',
         'Shared courtyard, B-Q-07: carried as a quarter-wide package.', 620000),
     svc('b-500-02', 'Wege & Platzflächen', 'Paths & paved areas',
         'Erschließung der drei Hauseingänge und der Feuerwehrzufahrt.',
         'Access to the three entrances and the fire-service route.', 380000),
     svc('b-500-03', 'Bepflanzung & Baumpflanzung', 'Planting & tree planting',
         'Hofbäume, Strauchpflanzungen und Ausgleichsflächen.',
         'Courtyard trees, shrub planting and compensation areas.', 290000),
     svc('b-500-04', 'Regenwasserbewirtschaftung', 'Stormwater management',
         'Retention, Mulden-Rigolen und Notüberlauf.',
         'Retention, swale-trench systems and emergency overflow.', 340000),
     svc('b-500-05', 'Einfriedung & Müllstandplätze', 'Enclosure & refuse areas',
         'Drei überdachte Standplätze und die Quartierseinfriedung.',
         'Three roofed refuse areas and the quarter enclosure.', 130000),
     choice('b-500-package', 'Freianlagen-Paket', 'External-works package',
         'B-Q-07 ist beantwortet: ein Quartierspaket, die Zuordnung je Haus wird abgeleitet.',
         'B-Q-07 is answered: one quarter package, the per-building share is derived.',
         [variant('quarter', 'Quartierspaket', 'Quarter package', 0),
          variant('perBuilding', 'Gebäudeweise Vergabe', 'Per-building award', 180000)],
         'quarter'),
     required('b-500-90', 'Zusätzliche Tiefgaragenrampe', 'Additional garage ramp',
         'Eine zweite Rampe für Haus C wurde erwogen, nicht beauftragt.',
         'A second ramp for building C was considered, not commissioned.', 210000),
     required('b-500-91', 'Spielfläche Quartier', 'Quarter play area',
         'Bei 94 Wohneinheiten üblich, im Auftrag nicht benannt.',
         'Usual for 94 dwellings, not named in the brief.', 120000),
   ])]),
 chapter('KG_600', 'Ausstattung', 'Fixtures & equipment',
   'Feste Ausstattung der Gemeinschafts- und Gewerbeflächen.',
   'Fixed equipment for the shared and commercial areas.',
   [group('b-kg600-fixed', 'Feste Ausstattung', 'Fixed equipment', [
     svc('b-600-01', 'Briefkastenanlagen', 'Letterbox installations',
         'Drei Anlagen mit Paketfächern für 94 Wohneinheiten und Gewerbe.',
         'Three installations with parcel boxes for 94 dwellings and commercial units.', 96000),
     quantity('b-600-02', 'Fahrradabstellanlagen', 'Bicycle parking',
         'Überdachte Anlagen im Hof und in den Untergeschossen.',
         'Covered racks in the courtyard and the basements.',
         500, 368, 'Plätze', 'spaces'),
     svc('b-600-03', 'Beschilderung & Leitsystem', 'Signage & wayfinding',
         'Quartiersorientierung, Hausnummern und Klingeltableaus.',
         'Quarter wayfinding, house numbers and doorbell panels.', 88000),
     svc('b-600-04', 'Gemeinschaftsräume Ausstattung', 'Shared-room equipment',
         'Waschräume, Fahrradwerkstatt und Kinderwagenräume.',
         'Laundry rooms, bicycle workshop and pram stores.', 152000),
     svc('b-600-05', 'Küchenausstattung Gewerbe-EG', 'Commercial ground-floor kitchen fit-out',
         'Grundausstattung für die Gewerbeeinheit, retail-only Ansatz (B-Q-01).',
         'Base equipment for the commercial unit, retail-only assumption (B-Q-01).',
         100000, authority='assumed'),
     required('b-600-90', 'Kunst am Bau', 'Public art',
         'Für private Bauherren freiwillig; hier eine Entscheidung.',
         'Voluntary for private clients; here a decision.', 190000),
   ])]),
 chapter('KG_700', 'Baunebenkosten', 'Ancillary costs',
   'Planung, Gutachten und Nachweise für drei Baukörper.',
   'Design, surveys and certification for three buildings.',
   [group('b-kg700-design', 'Planung & Beratung', 'Design & consultancy', [
     svc('b-700-01', 'Objektplanung', 'Architectural design',
         'Leistungsphasen 1 bis 8 nach HOAI für drei Baukörper, Honorarzone III.',
         'HOAI work stages 1 to 8 for three buildings, fee zone III.', 1480000),
     svc('b-700-02', 'Tragwerksplanung', 'Structural design',
         'Standsicherheit, Untergeschosse und Gewerbe-EG mit größerer Stützweite.',
         'Structural verification, basements and the longer-span commercial floor.', 420000),
     svc('b-700-03', 'TGA-Planung', 'Building services design',
         'Ambient-Loop, drei Verteilkonzepte und die Gewerbeanbindung.',
         'Ambient loop, three distribution concepts and the commercial connection.', 480000),
   ]),
    group('b-kg700-surveys', 'Gutachten & Nachweise', 'Surveys & certification', [
     svc('b-700-04', 'Vermessung', 'Survey',
         'Lage- und Höhenaufnahme des gesamten Grundstücks.',
         'Site and level survey of the entire plot.', 120000),
     svc('b-700-05', 'Baugrundgutachten', 'Soil report',
         'Erkundung für zwei Untergeschosse und die Gründung von Haus A.',
         'Investigation for two basements and building A’s foundation.', 140000),
     svc('b-700-06', 'Brandschutzkonzept', 'Fire strategy',
         'Neu zu erstellen: der vorliegende Scan ist gering erkannt (B-CF-06).',
         'To be reissued: the available scan has low recognition (B-CF-06).', 200000),
     choice('b-700-qng', 'QNG-Siegel', 'QNG label',
         'QNG-PLUS setzt den Energiestandard Effizienzhaus 40 NH voraus.',
         'QNG-PLUS requires the Efficiency house 40 NH energy standard.',
         [variant('none', 'kein QNG', 'no QNG', 0),
          variant('plus', 'QNG-PLUS', 'QNG-PLUS', 340000),
          variant('premium', 'QNG-PREMIUM', 'QNG-PREMIUM', 520000)],
         'none',
         depends={'serviceId': 'b-400-es', 'requiresVariant': 'eh40nh',
                  'appliesToVariants': ['plus', 'premium']}),
     choice('b-700-dgnb', 'DGNB-Zertifikat', 'DGNB certificate',
         'Auditierung und Dokumentation eines dritten Prüfers.',
         'Auditing and documentation by a third-party assessor.',
         [variant('none', 'keine Zertifizierung', 'no certification', 0),
          variant('silver', 'DGNB SILBER', 'DGNB SILVER', 260000),
          variant('gold', 'DGNB GOLD', 'DGNB GOLD', 460000),
          variant('platinum', 'DGNB PLATIN', 'DGNB PLATINUM', 720000)],
         'none'),
     required('b-700-90', 'Baubegleitende Qualitätssicherung', 'Construction-stage quality assurance',
         'Unabhängige Überwachung über die Objektüberwachung hinaus.',
         'Independent supervision beyond the architect’s site supervision.', 160000),
   ])]),
]

B_DECLARED = {'KG_200': 1120000, 'KG_300': 23980000, 'KG_400': 8420000,
              'KG_500': 1760000, 'KG_600': 620000, 'KG_700': 2840000}

# ── normalisation: `requiresDecision` is an axis of its own ──────────────
# The kind describes the CONTROL (include/exclude, single choice, quantity,
# read-only); `requiresDecision` describes whether the domain demands an
# explicit answer. A quantity position can be a required decision too
# (b-400-91), which a kind-shaped flag could not express.
EXPLICIT_QUANTITY_DECISIONS = {'b-400-91'}

def normalise(chapters):
    for ch in chapters:
        for g in ch['groups']:
            for s in g['services']:
                kind = s['kind']['kind']
                s['requiresDecision'] = bool(
                    kind == 'requiredDecision' or s['id'] in EXPLICIT_QUANTITY_DECISIONS)
                if kind == 'requiredDecision':
                    # The control is a two-option decision; the kind name was
                    # only carrying the requirement, which now has its own field.
                    s['kind'] = {'kind': 'includeExclude'}
    return chapters

# ── arithmetic proof ─────────────────────────────────────────────────────
def baseline_amount(s):
    """What this service contributes with the fixture's baseline decision.

    A service the domain still demands a decision on contributes NOTHING —
    exactly what it contributes once that decision is recorded as "not
    included". That identity is why the declared demonstration total is
    reachable without pre-deciding anything on the user's behalf.
    """
    if s['requiresDecision'] or s['baseline'] != 'selected':
        return D(0)
    if s['kind']['kind'] == 'singleChoice':
        base = s['kind']['baselineVariant']
        v = next(v for v in s['kind']['variants'] if v['value'] == base)
        return D(s['amount']) + D(v['delta'])
    return D(s['amount'])

def prove(name, chapters, declared, total_declared):
    by_group, selected, decisions, variants = {}, 0, 0, 0
    for ch in chapters:
        g_sum = D(0)
        for g in ch['groups']:
            for s in g['services']:
                g_sum += baseline_amount(s)
                if s['requiresDecision']:
                    decisions += 1
                elif s['kind']['kind'] == 'singleChoice':
                    variants += 1
                elif s['baseline'] == 'selected':
                    selected += 1
        by_group[ch['group']] = g_sum
        want = D(declared[ch['group']])
        if g_sum != want:
            raise SystemExit(f'{name} {ch["group"]}: baseline {g_sum} != declared {want}')
    total = sum(by_group.values(), D(0))
    if total != D(total_declared):
        raise SystemExit(f'{name}: baseline total {total} != declared {total_declared}')
    print(f'{name}: total {total} · selected {selected} · variants {variants} '
          f'· explicit decisions {decisions}')
    return by_group, total, selected, variants, decisions

normalise(A); normalise(B)
attach_boundaries('DEMO-HAPPY-01', A)
attach_boundaries('DEMO-COMPLEX-01', B)
a_groups, a_total, a_sel, a_var, a_dec = prove('DEMO-HAPPY-01', A, A_DECLARED, 6480000)
b_groups, b_total, b_sel, b_var, b_dec = prove('DEMO-COMPLEX-01', B, B_DECLARED, 38740000)

# Counts the ticket's DEMO FIXTURES section declares. A mismatch is a fixture
# defect, not a rounding question — so it fails the build, it does not warn.
for name, got, want, what in [
    ('DEMO-HAPPY-01', a_sel, 21, 'selected standard services'),
    ('DEMO-HAPPY-01', a_var, 3, 'configured variants'),
    ('DEMO-HAPPY-01', a_dec, 6, 'explicit non-selections'),
    ('DEMO-COMPLEX-01', b_sel, 43, 'selected standard services'),
    ('DEMO-COMPLEX-01', b_var, 7, 'configured variants'),
    ('DEMO-COMPLEX-01', b_dec, 11, 'explicit non-selections'),
]:
    if got != want:
        raise SystemExit(f'{name}: {got} {what}, ticket declares {want}')
print('DEMO-HAPPY-01 selected+variants =', a_sel + a_var, '(ticket: 24)')

doc = {
    '$comment': (
        'DEMO / NON-PRODUCTION PRODUCT FIXTURE (VR3-03). Every service, amount '
        'and variant below is a demonstration value: it exists to make Product '
        'behaviour legible, and it is not All3 production pricing, a quotation '
        'or calculation authority. Transcribed from the approved VR3-00 package '
        '(artifacts/VR3-00-global-design-audit/06-demo-fixtures/'
        'demo-project-fixtures.md and 03-target/1440x900/T-018.png at '
        'ba0263bfdf838cc30e4167da3b09e3f654fbf961) and PROVED by '
        'src/engine/__tests__/kgConfiguration.test.ts: every cost group’s '
        'baseline services sum to its declared subtotal, the six subtotals sum '
        'to the declared net total, and the service counts match the ticket. '
        'Bilingual copy is stored inline as labelDe/labelEn, following the '
        'released src/fixtures/scope-catalog.json precedent for a large domain '
        'catalogue; UI chrome remains i18n keys (rule 36). Amounts are decimal '
        'STRINGS, never JSON numbers. A singleChoice service carries the '
        'RELATIVE effect of each variant against its baseline variant, exactly '
        'as the released Mehrpreis/Minderpreis semantics do, so the baseline '
        'variant contributes nothing and the declared totals hold.'
    ),
    'catalogues': [
        {'projectId': 'DEMO-HAPPY-01', 'uncertaintyPercent': '5',
         'declaredNetTotal': money(a_total),
         'declaredByCostGroup': {k: money(v) for k, v in a_groups.items()},
         'chapters': A},
        {'projectId': 'DEMO-COMPLEX-01', 'uncertaintyPercent': '6',
         'declaredNetTotal': money(b_total),
         'declaredByCostGroup': {k: money(v) for k, v in b_groups.items()},
         'chapters': B},
    ],
}
OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('written', OUT, OUT.stat().st_size, 'bytes')
