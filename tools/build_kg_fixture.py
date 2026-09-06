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


# ── VR3-TGA-01 · KG 400 decision layer ───────────────────────────────────
# These helpers exist so the eight TGA systems are DATA, not a second page.
# `KgChapter.tsx` renders one composition for all six KG chapters and is
# forbidden a `switch (group)`; a chapter that declares none of the fields
# below therefore renders exactly as it did before.

def _attach(obj, extras):
    for key, value in extras.items():
        if value is not None:
            obj[key] = value
    return obj

def src(origin_de, origin_en, value_de=None, value_en=None, variant=None):
    """What the CLIENT DOCUMENTS said. Never overwritten by a proposal."""
    d = {'originDe': origin_de, 'originEn': origin_en}
    if value_de is not None:
        d['valueDe'] = value_de
        d['valueEn'] = value_en
    if variant is not None:
        d['variant'] = variant
    return d

def na(reason_de, reason_en, state='notApplicable'):
    """Applicability is a statement WITH A CAUSE, never an option `Keine ...`."""
    return {'state': state, 'reasonDe': reason_de, 'reasonEn': reason_en}

def blocked(value, reason_de, reason_en):
    """A valid alternative that is not available HERE, shown with its reason."""
    return {'value': value, 'reasonDe': reason_de, 'reasonEn': reason_en}

def row(value_de, value_en, building=None, label_de=None, label_en=None,
        amount=None, note_de=None, note_en=None, status=None,
        not_applicable=None):
    """One row of a value set inside ONE decision — never n separate rows.

    `amount` is a NUMBER the UI formats. A pre-formatted "520.000 EUR" here
    would be a second formatter deciding separators for a locale the fixture
    cannot see — including rule 7's narrow no-break space.
    """
    d = {'valueDe': value_de, 'valueEn': value_en}
    if building: d['buildingId'] = building
    if label_de: d['labelDe'] = label_de; d['labelEn'] = label_en
    if amount is not None: d['amount'] = money(amount)
    if note_de: d['noteDe'] = note_de; d['noteEn'] = note_en
    if status: d['status'] = status
    if not_applicable: d['notApplicable'] = True
    return d

def tvar(v, de, en, delta=0, no_price_basis=False, bundled=False):
    d = {'value': v, 'labelDe': de, 'labelEn': en, 'delta': money(delta)}
    if no_price_basis: d['noPriceBasis'] = True
    if bundled: d['bundled'] = True
    return d

def tchoice(sid, de, en, sde, sen, variants, baseline_variant, amount=0, **extras):
    """A real engineering choice: alternatives, an All3 standard, a source."""
    s = {
        'id': sid, 'labelDe': de, 'labelEn': en,
        'summaryDe': sde, 'summaryEn': sen,
        'amount': money(amount), 'baseline': 'selected',
        'kind': {'kind': 'singleChoice', 'baselineVariant': baseline_variant,
                 'variants': variants},
        'authority': extras.pop('authority', 'assumed'),
    }
    return _attach(s, extras)

def tsvc(sid, de, en, sde, sen, amount=0, baseline='selected',
         authority='sourceEvidenced', kind=None, **extras):
    s = {
        'id': sid, 'labelDe': de, 'labelEn': en,
        'summaryDe': sde, 'summaryEn': sen,
        'amount': money(amount), 'baseline': baseline,
        'kind': kind or {'kind': 'includeExclude'},
        'authority': authority,
    }
    return _attach(s, extras)

def tread(sid, de, en, sde, sen, **extras):
    """A DERIVED value: read-only, never re-asked, always names its cause."""
    extras.setdefault('authority', 'derived')
    return tsvc(sid, de, en, sde, sen, 0,
                kind={'kind': 'readOnlyRequired'}, **extras)

def system(gid, de, en, services, **extras):
    """A group that is also a SYSTEM ROW in the overview."""
    return _attach({'id': gid, 'labelDe': de, 'labelEn': en,
                    'services': services}, extras)

def rahmen(rid, de, en, value_de, value_en, meta_de, meta_en,
           edit=None, derive=None):
    """One condition everything below depends on. NOT a system."""
    return _attach({'id': rid, 'labelDe': de, 'labelEn': en,
                    'valueDe': value_de, 'valueEn': value_en,
                    'metaDe': meta_de, 'metaEn': meta_en},
                   {'editServiceId': edit, 'derive': derive})

def rule(rid, title_de, title_en, body_de, body_en, source_de, source_en,
         note_de=None, note_en=None):
    """A cross-system rule stated ONCE and referenced, never restated."""
    return _attach({'id': rid, 'titleDe': title_de, 'titleEn': title_en,
                    'bodyDe': body_de, 'bodyEn': body_en,
                    'sourceDe': source_de, 'sourceEn': source_en},
                   {'noteDe': note_de, 'noteEn': note_en})

def bemusterung(rows):
    return {
        'titleDe': 'Spätere Bemusterung',
        'titleEn': 'Later specification',
        'bodyDe': ('In dieser Kostengruppe ist der Systemstandard festgelegt. '
                   'Produkt- und Oberflächenauswahl folgt in der Bemusterung — '
                   'sie verfeinert diese Entscheidungen, sie ersetzt sie nicht.'),
        'bodyEn': ('This cost group fixes the system standard. Product and '
                   'finish selection follows in the specification stage — it '
                   'refines these decisions, it does not replace them.'),
        'decidedHeadingDe': 'Hier bereits entschieden',
        'decidedHeadingEn': 'Already decided here',
        'deferredHeadingDe': 'Später zu bemustern',
        'deferredHeadingEn': 'To be specified later',
        'rows': [{'decidedDe': a, 'decidedEn': b, 'deferredDe': c, 'deferredEn': d}
                 for a, b, c, d in rows],
    }

def tga_chapter(g, tde, ten, nde, nen, groups, rahmen_entries, rules, bem):
    ch = chapter(g, tde, ten, nde, nen, groups)
    ch['rahmen'] = rahmen_entries
    ch['rules'] = rules
    ch['bemusterung'] = bem
    return ch


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

# ── PROJECT A · DEMO-HAPPY-01 · 6.480.000 EUR net, ±5 % ──────────────────
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
 tga_chapter('KG_400', 'Technische Anlagen', 'Technical installations',
   'Wärme, Sanitär und Elektro für 18 Wohneinheiten.',
   'Heating, plumbing and electrical for 18 dwellings.',
   [
    # ── 1 · Wärme ────────────────────────────────────────────────────────
    system('a-kg400-heat', 'Wärme', 'Heat', [
      tchoice('a-400-01', 'Wärmeerzeuger', 'Heat generator',
        'Bestimmt die Warmwasserbereitung und die § 14a-Bewertung.',
        'Determines domestic hot water and the § 14a assessment.',
        [tvar('WE_LW_WP', 'Luft/Wasser-Wärmepumpe', 'Air-to-water heat pump', 0),
         tvar('WE_FW', 'Fernwärme-Übergabestation', 'District heating transfer station', -64000),
         tvar('WE_SW_WP', 'Sole/Wasser-Wärmepumpe (Erdsonde)', 'Brine-to-water (ground-source) heat pump',
              no_price_basis=True),
         tvar('WE_GAS_BW', 'Gas-Brennwert in EE-Hybrid', 'Gas condensing in RE-hybrid',
              no_price_basis=True),
         tvar('WE_BIOMASSE', 'Biomasse/Pellet-Kessel', 'Biomass/pellet boiler',
              no_price_basis=True)],
        'WE_LW_WP', amount=430000,
        all3Standard='WE_LW_WP',
        authority='sourceEvidenced',
        costAuthority='direct',
        source=src('03_Energiekonzept.pdf · S. 12', '03_Energiekonzept.pdf · p. 12',
                   'Fernwärme-Übergabestation', 'District heating transfer station', 'WE_FW'),
        whyDe=('Kein gesetzlicher Anlagentyp vorgeschrieben — § 71 GModG ist entfallen. '
               'Bestimmt Warmwasserbereitung und die § 14a-Bewertung.'),
        whyEn=('No statutory plant type applies — § 71 GModG has been repealed. '
               'Determines domestic hot water and the § 14a assessment.'),
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        ruleId='p14a',
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.1 Heizung.',
        offerNoteEn='Appears in the offer, section 3.1 Heating.'),
      tsvc('a-400-02', 'Wärmeverteilung & Sanitärinstallation',
        'Heat distribution & plumbing',
        'Fußbodenheizung, Steigleitungen und Sanitärinstallation je Wohnung.',
        'Underfloor heating, risers and per-dwelling plumbing.', 580000,
        costAuthority='direct',
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        source=src('Grundlage Gebäude · bestätigt', 'Building baseline · confirmed')),
      tchoice('a-400-04', 'Wärmeabgabe', 'Heat emission',
        'Bestimmt, ob ein wassergeführter Handtuchheizkörper möglich ist.',
        'Determines whether a hydronic towel radiator is possible.',
        [tvar('WA_FBH_EL_BAD', 'Fußbodenheizung + el. Zusatzheizkörper Bad',
              'Underfloor heating + electric supplementary radiator (bathroom)',
              no_price_basis=True),
         tvar('WA_FBH', 'Fußbodenheizung', 'Underfloor heating', no_price_basis=True),
         tvar('WA_KOMBI', 'Kombiniert (Fußbodenheizung + Heizkörper)',
              'Combined (underfloor heating + radiators)', no_price_basis=True),
         tvar('WA_HK', 'Heizkörper', 'Radiators', no_price_basis=True)],
        'WA_FBH_EL_BAD',
        all3Standard='WA_FBH_EL_BAD',
        costAuthority='noBasis',
        costBasisDe='in der Wärmeverteilung enthalten',
        costBasisEn='included in the heat distribution position',
        whyDe='Bestimmt durch den Wärmeerzeuger.',
        whyEn='Determined by the heat generator.',
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        source=src('Aus dem Wärmeerzeuger abgeleitet', 'Derived from the heat generator'),
        offerNoteDe=('Die Wärmeabgabe ist in der Wärmeverteilung enthalten und ändert die '
                     'Angebotssumme nicht. Die Entscheidung wird trotzdem im Angebot '
                     'beschrieben, Abschnitt 3.1 Heizung.'),
        offerNoteEn=('Heat emission is included in the heat distribution position and does '
                     'not change the offer total. The decision is still described in the '
                     'offer, section 3.1 Heating.'),
        dependsOn={'serviceId': 'a-400-01', 'requiresSelected': True}),
      tchoice('a-400-16', 'Handtuchheizkörper', 'Towel radiator',
        'Farbe und Bauform folgen in der Bemusterung.',
        'Colour and form follow in the specification stage.',
        [tvar('HHK_ELEKTRO', 'Elektrischer Handtuchheizkörper', 'Electric towel radiator',
              no_price_basis=True),
         tvar('HHK_WW', 'Warmwasser-Handtuchheizkörper', 'Hydronic towel radiator',
              no_price_basis=True),
         tvar('HHK_KEIN', 'Kein Handtuchheizkörper', 'No towel radiator',
              no_price_basis=True)],
        'HHK_ELEKTRO',
        all3Standard='HHK_ELEKTRO',
        costAuthority='noBasis',
        scopeDe='je Wohnungstyp', scopeEn='per dwelling type',
        blockedVariants=[blocked('HHK_WW',
          'nicht wählbar — die gewählte Wärmeabgabe führt keinen Heizkreis ins Bad',
          'not selectable — the chosen heat emission carries no wet circuit into the bathroom')],
        offerNoteDe='Farbe und Bauform folgen in der Bemusterung.',
        offerNoteEn='Colour and form follow in the specification stage.'),
      tread('a-400-03m', 'Wärmemengenzähler', 'Heat meter',
        'Fernauslesbar nach § 5 Abs. 2 HeizkostenV.',
        'Remotely readable per § 5 (2) HeizkostenV.',
        costAuthority='noBasis',
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        whyDe='Für einen Neubau ist die Fernauslesbarkeit vorgeschrieben.',
        whyEn='Remote readability is mandatory for a new build.',
        source=src('§ 5 Abs. 2 HeizkostenV', '§ 5 (2) HeizkostenV',
                   'fernauslesbar (Funk)', 'remotely readable (wireless)')),
      # Rendered in the RAHMEN band, not inside a system: it is a condition
      # everything below depends on, and the audit splits it from the
      # statutory minimum, which is derived and never a choice.
      tchoice('a-400-es', 'Energieziel', 'Energy target',
        'Förderziel, nicht der gesetzliche Mindeststandard.',
        'Funding target, not the statutory minimum.',
        [tvar('geg', 'Gesetzlicher Mindeststandard', 'Statutory minimum', -97000),
         tvar('eh55', 'Effizienzhaus 55', 'Efficiency House 55', 0),
         tvar('eh40', 'Effizienzhaus 40', 'Efficiency House 40', 97000),
         tvar('eh40nh', 'Effizienzhaus 40 NH', 'Efficiency House 40 NH', 195000)],
        'eh55',
        surface='rahmen',
        costAuthority='direct',
        source=src('03_Energiekonzept.pdf · S. 4', '03_Energiekonzept.pdf · p. 4'),
        whyDe=('Förderziel nach KfW 297/298 — vorbehaltlich verfügbarer Bundesmittel, '
               'kein Rechtsanspruch. Der gesetzliche Mindeststandard wird davon nicht '
               'berührt.'),
        whyEn=('Funding target per KfW 297/298 — subject to available federal funds, no '
               'legal entitlement. The statutory minimum is unaffected by it.'),
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 1.4 Wärmeschutz.',
        offerNoteEn='Appears in the offer, section 1.4 Thermal protection.'),
    ],
      summaryDe='Luft/Wasser-Wärmepumpe · Fußbodenheizung · fernauslesbarer Zähler',
      summaryEn='Air-to-water heat pump · underfloor heating · remotely readable meter',
      scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
      costAuthority='direct'),

    # ── 2 · Trinkwasser & Warmwasser ─────────────────────────────────────
    system('a-kg400-water', 'Trinkwasser & Warmwasser', 'Potable water & DHW', [
      tchoice('a-400-07', 'Warmwasserbereitung', 'Domestic hot water generation',
        'Bestimmt, ob eine Zirkulation erforderlich ist.',
        'Determines whether circulation is required.',
        [tvar('WW_ZENTRAL_WP', 'Zentral: Wärmepumpe + Warmwasserspeicher',
              'Central: heat pump + DHW cylinder', bundled=True),
         tvar('WW_DEZ_FWST', 'Dezentral: Wohnungs-Frischwasserstationen',
              'Decentralised fresh-water stations', no_price_basis=True),
         tvar('WW_FW_KOMPAKT', 'Fernwärme-Kompaktstation (Wohnungsstation)',
              'District-heating compact station (flat station)', no_price_basis=True)],
        'WW_ZENTRAL_WP',
        all3Standard='WW_ZENTRAL_WP',
        costAuthority='bundle',
        costBasisDe='in der Wärmeverteilung & Sanitärinstallation enthalten',
        costBasisEn='included in heat distribution & plumbing',
        whyDe=('Ausgelegt auf 60/55 °C nach DVGW W 551:2004-04. '
               'Bestimmt durch den Wärmeerzeuger.'),
        whyEn=('Designed to 60/55 °C per DVGW W 551:2004-04. '
               'Determined by the heat generator.'),
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        source=src('03_Energiekonzept.pdf · S. 14', '03_Energiekonzept.pdf · p. 14',
                   'Zentrale Warmwasserbereitung', 'Central DHW generation',
                   'WW_ZENTRAL_WP'),
        dependsOn={'serviceId': 'a-400-01', 'requiresSelected': True},
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.2 Wasser.',
        offerNoteEn='Appears in the offer, section 3.2 Water.'),
      tread('a-400-08', 'Zirkulation Warmwasser', 'DHW circulation',
        'Zirkulation erforderlich — Folge der zentralen Warmwasserbereitung.',
        'Circulation required — a consequence of central DHW generation.',
        costAuthority='bundle',
        costBasisDe='in der Wärmeverteilung & Sanitärinstallation enthalten',
        costBasisEn='included in heat distribution & plumbing',
        whyDe=('Eine Hygienefolge, kein Schalter: bei zentraler Warmwasserbereitung '
               'ist die Zirkulation nach DVGW W 551 erforderlich.'),
        whyEn=('A hygiene consequence, not a toggle: central DHW generation requires '
               'circulation per DVGW W 551.'),
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        source=src('Aus der Warmwasserbereitung abgeleitet',
                   'Derived from the DHW generation decision')),
      tchoice('a-400-13', 'Dusche', 'Shower',
        'Barrierefrei nach DIN 18040-2.', 'Step-free per DIN 18040-2.',
        [tvar('DU_BODENGLEICH', 'Bodengleiche Dusche', 'Floor-level (curbless) shower',
              no_price_basis=True),
         tvar('DU_WANNE', 'Duschwanne (flach)', 'Flat shower tray', no_price_basis=True),
         tvar('DU_BADEWANNE', 'Badewanne', 'Bathtub', no_price_basis=True)],
        'DU_BODENGLEICH',
        all3Standard='DU_BODENGLEICH',
        costAuthority='noBasis',
        scopeDe='je Wohnungstyp', scopeEn='per dwelling type',
        whyDe='Die Barrierefreiheit nach DIN 18040-2 hängt an dieser Entscheidung.',
        whyEn='Step-free access per DIN 18040-2 depends on this decision.',
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.6 Sanitär.',
        offerNoteEn='Appears in the offer, section 3.6 Sanitary.'),
    ],
      summaryDe='Zentral: Wärmepumpe + Warmwasserspeicher · Zirkulation erforderlich',
      summaryEn='Central: heat pump + DHW cylinder · circulation required',
      scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
      costAuthority='bundle'),

    # ── 3 · Lüftung & sommerlicher Komfort ───────────────────────────────
    system('a-kg400-air', 'Lüftung & sommerlicher Komfort',
      'Ventilation & summer comfort', [
      tchoice('a-400-18', 'Wohnungslüftung', 'Dwelling ventilation',
        'Das Lüftungskonzept nach DIN 1946-6 bestimmt die zulässigen Lösungen.',
        'The DIN 1946-6 ventilation concept determines the admissible solutions.',
        [tvar('WL_ABLUFT_DACH', 'Zentrale Abluftanlage über Dach, ALD-Nachströmung',
              'Central exhaust system over roof, outdoor-air-inlet supply', 0),
         tvar('WL_DEZ_WRG', 'Dezentrale Lüftung mit Wärmerückgewinnung',
              'Decentralised ventilation with heat recovery', 132000),
         tvar('WL_ZENTRAL_WRG', 'Zentrale Lüftung mit Wärmerückgewinnung',
              'Central ventilation with heat recovery', 132000),
         tvar('WL_FENSTER', 'Freie/Fensterlüftung', 'Natural/window ventilation',
              no_price_basis=True)],
        'WL_ABLUFT_DACH',
        requiresDecision=True,
        all3Standard='WL_ABLUFT_DACH',
        costAuthority='direct',
        whyDe=('Lüftungskonzept nach DIN 1946-6:2019-12 · Energieziel EH 55 verlangt '
               'Wärmerückgewinnung · DIN 18017-3:2022-05 für innenliegende Bäder'),
        whyEn=('Ventilation concept per DIN 1946-6:2019-12 · energy target EH 55 requires '
               'heat recovery · DIN 18017-3:2022-05 for internal bathrooms'),
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        source=src('05_Lueftungskonzept.pdf · S. 3', '05_Lueftungskonzept.pdf · p. 3'),
        blockedVariants=[blocked('WL_FENSTER',
          ('nicht zulässig — das Lüftungskonzept weist den Feuchteschutz nicht '
           'nutzerunabhängig nach'),
          ('not admissible — the ventilation concept does not demonstrate moisture '
           'protection independently of the user'))],
        offerNoteDe=('Wirkt sich auf das Angebot aus, Abschnitt 3.7 Lüftung. Das '
                     'Lüftungskonzept selbst ist eine eigene Planungsleistung.'),
        offerNoteEn=('Appears in the offer, section 3.7 Ventilation. The ventilation '
                     'concept itself is a separate design service.')),
      tread('a-400-08s', 'Sommerlicher Wärmeschutz', 'Summer thermal protection',
        'Vereinfachter Nachweis über Sonneneintragskennwert · DIN 4108-2:2013-02.',
        'Simplified solar-gain-factor verification · DIN 4108-2:2013-02.',
        costAuthority='noBasis',
        whyDe='Aus der Gebäudehülle abgeleitet. Wird hier nicht entschieden, nur angezeigt.',
        whyEn='Derived from the building envelope. Shown here, not decided here.',
        scopeDe='aus Projekt übernommen', scopeEn='taken from the project',
        source=src('Grundlage Gebäude · Hüllcluster', 'Building baseline · envelope cluster')),
      tchoice('a-400-17', 'Dunstabzug', 'Cooker extraction',
        'Keine Außenwanddurchdringung.', 'No external wall penetration.',
        [tvar('UMLUFT', 'Umluft (Aktivkohlefilter)', 'Recirculation (charcoal filter)',
              no_price_basis=True),
         tvar('ABLUFT', 'Abluft (Mauerkasten/Schacht)', 'Exhaust air (wall vent/duct)',
              no_price_basis=True)],
        'UMLUFT',
        all3Standard='UMLUFT',
        costAuthority='noBasis',
        scopeDe='je Wohnungstyp', scopeEn='per dwelling type'),
      tread('a-400-19', 'Tiefgaragen-/UG-Lüftung', 'Underground garage ventilation',
        'Entsteht automatisch, sobald die Gebäudegrundlage eine Tiefgarage enthält.',
        'Appears automatically once the building baseline includes an underground garage.',
        costAuthority='none',
        applicability=na('keine Tiefgarage und kein Untergeschoss im Projektumfang',
                         'no underground garage and no basement in the project scope')),
    ],
      summaryDe='Lüftungskonzept nach DIN 1946-6 liegt vor · 2 Lösungen zulässig',
      summaryEn='DIN 1946-6 ventilation concept on file · 2 admissible solutions',
      scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
      costAuthority='direct'),

    # ── 4 · Elektro & Energie ────────────────────────────────────────────
    system('a-kg400-power', 'Elektro & Energie', 'Electrical & on-site energy', [
      tsvc('a-400-03', 'Elektroinstallation & Datennetz', 'Electrical & data installation',
        'Wohnungsverteilungen, Beleuchtung, Klingel- und Datennetz.',
        'Dwelling distribution boards, lighting, doorbell and data network.', 380000,
        costAuthority='direct',
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        source=src('Grundlage Gebäude · bestätigt', 'Building baseline · confirmed')),
      tchoice('a-400-21', 'Ausstattungswert Elektro', 'Electrical equipment level',
        'Nach DIN 18015-2.', 'Per DIN 18015-2.',
        [tvar('AW1', 'AW1 — Mindestausstattung', 'AW1 — minimum equipment',
              no_price_basis=True),
         tvar('AW2', 'AW2 — Standardausstattung', 'AW2 — standard equipment',
              no_price_basis=True),
         tvar('AW3', 'AW3 — Komfortausstattung', 'AW3 — comfort equipment',
              no_price_basis=True)],
        'AW2',
        all3Standard='AW2',
        costAuthority='noBasis',
        costBasisDe='in der Elektroinstallation enthalten',
        costBasisEn='included in the electrical installation position',
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        source=src('DIN 18015-2 · All3-Standard', 'DIN 18015-2 · All3 standard',
                   'AW2 — Standardausstattung', 'AW2 — standard equipment', 'AW2'),
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.8 Elektro.',
        offerNoteEn='Appears in the offer, section 3.8 Electrical.'),
      tsvc('a-400-90', 'Photovoltaikanlage', 'Photovoltaic system',
        'Einspeisung auf 60 % begrenzt, bis Messstelle und Steuerung geprüft sind.',
        'Feed-in limited to 60 % until the metering point and control are verified.',
        165000, baseline='notSelected', authority='assumed',
        kind={'kind': 'requiredDecision'},
        costAuthority='direct',
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        whyDe=('Eine bundesweite Pflicht zur Solarenergie besteht für neue '
               'Wohngebäude erst ab 2030. Landesrecht ist gesondert zu prüfen.'),
        whyEn=('A federal obligation to install solar energy arises for new residential '
               'buildings only from 2030. State law is checked separately.'),
        source=src('01_Auftraggeberbrief.pdf · S. 2', '01_Auftraggeberbrief.pdf · p. 2',
                   'Nicht spezifiziert', 'Not specified'),
        ruleId='p14a',
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.13 Photovoltaik.',
        offerNoteEn='Appears in the offer, section 3.13 Photovoltaics.'),
      tread('a-400-22', 'E-Mobilitäts-Infrastruktur', 'E-mobility infrastructure',
        'GEIG § 6 greift erst über fünf Stellplätzen.',
        'GEIG § 6 applies only above five parking spaces.',
        costAuthority='none',
        applicability=na('4 Stellplätze im Projektumfang — GEIG § 6 greift erst über fünf',
                         '4 parking spaces in scope — GEIG § 6 applies only above five')),
    ],
      summaryDe='Ausstattungswert AW2 · PV möglich, nicht beauftragt · keine Stellplätze > 5',
      summaryEn='Equipment level AW2 · PV possible, not commissioned · no more than 5 spaces',
      scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
      costAuthority='direct'),

    # ── 5 · Entwässerung ─────────────────────────────────────────────────
    system('a-kg400-drain', 'Entwässerung', 'Drainage', [
      tread('a-400-11', 'Rückstausicherung', 'Backwater protection',
        'Entsteht, sobald ein Untergeschoss unter der Rückstauebene entwässert wird.',
        'Appears once a basement drains below the backwater level.',
        costAuthority='none',
        applicability=na('kein UG · Rückstauebene nicht berührt',
                         'no basement · backwater level not affected')),
      tread('a-400-11r', 'Regenwasserentsorgung', 'Stormwater disposal',
        'Kommunale Vorgabe: Einleitung in die Mischkanalisation.',
        'Municipal requirement: discharge to the combined sewer.',
        costAuthority='noBasis',
        scopeDe='gilt für die gesamte Option', scopeEn='applies to the whole Option',
        source=src('Entwässerungssatzung der Gemeinde', 'Municipal drainage by-law',
                   'Mischkanalisation vorhanden', 'Combined sewer available')),
    ],
      summaryDe='kein UG · Rückstauebene nicht berührt · Mischkanalisation vorhanden',
      summaryEn='no basement · backwater level not affected · combined sewer available',
      applicability=na('kein UG · Rückstauebene nicht berührt · Mischkanalisation vorhanden',
                       'no basement · backwater level not affected · combined sewer available'),
      costAuthority='none'),

    # ── 6 · Kommunikation & Zutritt ──────────────────────────────────────
    system('a-kg400-comms', 'Kommunikation & Zutritt', 'Communications & access', [
      tchoice('a-400-29', 'Zutrittssystem', 'Access control',
        'Leser und Oberfläche folgen in der Bemusterung.',
        'Readers and finish follow in the specification stage.',
        [tvar('ZK_MECH', 'Mechanische Schließanlage', 'Mechanical master-key system',
              no_price_basis=True),
         tvar('ZK_RFID', 'Elektronisch (RFID/Transponder)', 'Electronic (RFID/transponder)',
              no_price_basis=True),
         tvar('ZK_SMART', 'Smartphone-/App-Zutritt', 'Smartphone/app-based access',
              no_price_basis=True)],
        'ZK_MECH',
        all3Standard='ZK_MECH',
        costAuthority='noBasis',
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        source=src('01_Auftraggeberbrief.pdf · S. 5', '01_Auftraggeberbrief.pdf · p. 5',
                   'Mechanische Schließanlage', 'Mechanical master-key system', 'ZK_MECH'),
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 2.11 Zutritt.',
        offerNoteEn='Appears in the offer, section 2.11 Access.'),
      tread('a-400-25', 'Gebäudeverkabelung', 'In-building cabling',
        'Glasfaser bis in die Wohnung (FTTH).', 'Fibre to the dwelling (FTTH).',
        costAuthority='noBasis',
        scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
        whyDe='Folgt aus der gesicherten FTTH-Verfügbarkeit am Grundstück.',
        whyEn='Follows from secured FTTH availability at the site.',
        source=src('Grundlage Projekt · Telekommunikation',
                   'Project baseline · telecommunications',
                   'FTTH/Glasfaser gesichert', 'FTTH/fibre secured')),
    ],
      summaryDe='FTTH gesichert · mechanische Schließanlage',
      summaryEn='FTTH secured · mechanical master-key system',
      scopeDe='gilt für 1 Gebäude', scopeEn='applies to 1 building',
      costAuthority='noBasis'),

    # ── 7 · Aufzüge & Sonderanlagen ──────────────────────────────────────
    system('a-kg400-lift', 'Aufzüge & Sonderanlagen', 'Lifts & special systems', [
      tread('a-400-30', 'Aufzugsantrieb', 'Lift drive',
        'Entsteht, sobald die Gebäudehöhe die Aufzugspflicht auslöst.',
        'Appears once the building height triggers the lift requirement.',
        costAuthority='none',
        applicability=na('Gebäudehöhe 11,4 m — unter der Aufzugspflicht (MBO § 39 Abs. 4)',
                         'building height 11.4 m — below the lift requirement (MBO § 39 (4))')),
    ],
      summaryDe='Gebäudehöhe 11,4 m — unter der Aufzugspflicht (MBO § 39 Abs. 4)',
      summaryEn='building height 11.4 m — below the lift requirement (MBO § 39 (4))',
      applicability=na('Gebäudehöhe 11,4 m — unter der Aufzugspflicht (MBO § 39 Abs. 4)',
                       'building height 11.4 m — below the lift requirement (MBO § 39 (4))'),
      costAuthority='none'),

    # ── 8 · Schnittstellen & Verantwortung ───────────────────────────────
    system('a-kg400-scope', 'Schnittstellen & Verantwortung',
      'Interfaces & responsibility', [
      tread('a-400-13g', 'Leistungsgrenze TGA', 'MEP scope boundary',
        'Leitungsnetz bis 1,0 m außerhalb der Gebäudehülle bzw. bis zum vereinbarten Übergabepunkt.',
        'Pipework and cabling to 1.0 m outside the building envelope, or to the agreed handover point.',
        authority='sourceEvidenced',
        costAuthority='none',
        scopeDe='gilt für die gesamte Option', scopeEn='applies to the whole Option',
        source=src('All3-Standard · Leistungsverzeichnis', 'All3 standard · scope schedule',
                   'Übergabepunkt Grundstücksgrenze', 'Handover point at the property line')),
      tread('a-400-14', 'Hausanschlüsse', 'Utility house connections',
        'Bauherr bis Grundstücksgrenze, All3 ab Übergabepunkt.',
        'Client to the property line, All3 from the handover point.',
        authority='sourceEvidenced',
        costAuthority='bauherr',
        scopeDe='Verantwortung je Medium', scopeEn='responsibility per medium',
        source=src('01_Auftraggeberbrief.pdf · S. 7', '01_Auftraggeberbrief.pdf · p. 7'),
        valueRows=[
          row('Bauherr bis Grundstücksgrenze', 'Client to the property line',
              label_de='Trinkwasser', label_en='Potable water', status='ok'),
          row('Bauherr bis Grundstücksgrenze', 'Client to the property line',
              label_de='Schmutzwasser / Kanal', label_en='Foul water / sewer', status='ok'),
          row('Bauherr bis Grundstücksgrenze', 'Client to the property line',
              label_de='Strom (NS-Netz)', label_en='Electricity (LV grid)', status='ok'),
          row('Glasfaser gesichert', 'Fibre secured',
              label_de='Telekommunikation', label_en='Telecommunications', status='ok'),
        ],
        offerNoteDe=('Eine ungeklärte Schnittstelle wird als Bedingung ins Angebot '
                     'übernommen, nicht als Betrag und nicht als Lücke.'),
        offerNoteEn=('An unresolved interface enters the offer as a condition — not as '
                     'an amount and not as a gap.')),
    ],
      summaryDe='Leistungsgrenze bestätigt · 4 Hausanschlüsse beim Bauherrn',
      summaryEn='Scope boundary confirmed · 4 house connections with the client',
      scopeDe='gilt für die gesamte Option', scopeEn='applies to the whole Option',
      costAuthority='bauherr'),
   ],
   [
    rahmen('energieziel', 'Energieziel', 'Energy target', '', '',
           'Förderziel · Annahme', 'Funding target · assumption', edit='a-400-es'),
    rahmen('mindeststandard', 'Gesetzlicher Mindeststandard', 'Statutory minimum',
           'GModG § 10 · Niedrigstenergiegebäude', 'GModG § 10 · nearly zero-energy building',
           'aus Bauantragsdatum abgeleitet', 'derived from the building-application date'),
    rahmen('gebaeudeumfang', 'Gebäudeumfang', 'Building scope', '', '', '', '',
           derive='buildingScope'),
    rahmen('leistungsgrenze', 'Leistungsgrenze All3', 'All3 scope boundary',
           'ab Übergabepunkt Grundstücksgrenze', 'from the handover point at the property line',
           'Hausanschlüsse: Bauherr', 'House connections: client'),
   ],
   [
    rule('p14a', '§ 14a EnWG · steuerbare Verbrauchseinrichtungen',
         '§ 14a EnWG · controllable consumption devices',
         ('Diese Option enthält steuerbare Verbrauchseinrichtungen. Die garantierte '
          'Leistung wird gemeinsam bemessen, nicht je Gerät. Der Netzanschluss ist '
          'entsprechend auszulegen.'),
         ('This Option contains controllable consumption devices. The guaranteed power '
          'is measured jointly, not per device. The grid connection is sized '
          'accordingly.'),
         'BNetzA BK6-22-300, Anlage 1 · Ziffer 2.4.1',
         'BNetzA BK6-22-300, annex 1 · clause 2.4.1'),
   ],
   bemusterung([
     ('Bodengleiche Dusche · barrierefrei nach DIN 18040-2',
      'Floor-level shower · step-free per DIN 18040-2',
      'Duschabtrennung, Ablaufrinne, Sanitärkeramik',
      'Shower enclosure, drainage channel, sanitary ceramics'),
     ('Ausstattungswert Elektro AW2 · DIN 18015-2',
      'Electrical equipment level AW2 · DIN 18015-2',
      'Schalterprogramm, Farbe, KNX-Raumcontroller',
      'Switch range, colour, KNX room controller'),
     ('Zutritt mechanisch · Schließanlage',
      'Mechanical access · master-key system',
      'Zylinder, Oberfläche, Türsprech-Innenstation',
      'Cylinders, finish, intercom indoor station'),
     ('Handtuchheizkörper elektrisch', 'Electric towel radiator',
      'Farbe, Bauform', 'Colour, form'),
   ])),
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

# ── PROJECT B · DEMO-COMPLEX-01 · 38.740.000 EUR net, ±6 % ───────────────
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
 tga_chapter('KG_400', 'Technische Anlagen', 'Technical installations',
   'Wärme, Lüftung, Sanitär und Elektro für drei Baukörper mit unterschiedlicher Nutzung.',
   'Heat, ventilation, plumbing and electrical for three buildings with different uses.',
   [
    # ── 1 · Wärme ────────────────────────────────────────────────────────
    system('b-kg400-heat', 'Wärme', 'Heat', [
      # The SCOPE decision comes first in its system: it decides how many
      # heat generators the Option contains, so every row below it depends
      # on the answer.
      tchoice('b-400-heat', 'Anlagenkonzept', 'Plant concept',
        'Bestimmt, wie viele Wärmeerzeuger die Option enthält.',
        'Determines how many heat generators the Option contains.',
        [tvar('central', 'Gemeinsame Anlage für alle 3 Gebäude',
              'One shared plant for all 3 buildings', 0),
         tvar('perBuilding', 'Je Gebäude eine eigene Anlage',
              'One plant per building', -310000)],
        'central',
        all3Standard='central',
        costAuthority='direct',
        scopeDe='betrifft alle 3 Gebäude', scopeEn='affects all 3 buildings',
        whyDe=('Bestimmt, wie viele Wärmeerzeuger die Option enthält. Änderung wirkt '
               'auf Wärmeerzeuger und Warmwasserbereitung.'),
        whyEn=('Determines how many heat generators the Option contains. A change '
               'affects the heat generator and domestic hot water.'),
        source=src('04_Quartierskonzept.pdf · S. 9', '04_Quartierskonzept.pdf · p. 9',
                   'Gemeinsame Energiezentrale', 'Shared energy centre', 'central'),
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.1 Heizung.',
        offerNoteEn='Appears in the offer, section 3.1 Heating.'),
      tsvc('b-400-01', 'Wärmeerzeuger', 'Heat generator',
        'Gemeinsamer Ambient-Loop mit Wärmepumpen (Energiezentrale).',
        'Shared ambient loop with heat pumps (energy centre).', 1240000,
        costAuthority='direct',
        scopeDe='1 gemeinsame Anlage', scopeEn='1 shared plant',
        whyDe=('Kein gesetzlicher Anlagentyp vorgeschrieben — § 71 GModG ist entfallen. '
               'Bestimmt Warmwasserbereitung und die § 14a-Bewertung.'),
        whyEn=('No statutory plant type applies — § 71 GModG has been repealed. '
               'Determines domestic hot water and the § 14a assessment.'),
        source=src('04_Quartierskonzept.pdf · S. 11', '04_Quartierskonzept.pdf · p. 11',
                   'Gemeinsamer Ambient-Loop', 'Shared ambient loop'),
        ruleId='p14a',
        # THE P0-1 REGRESSION GUARD, expressed as data.
        # Measured on 06a4acf: switching the concept to per-building changed
        # ZERO rows and left this shared plant included at + 1.240.000 EUR.
        # The dependency makes that combination unrepresentable rather than
        # merely discouraged.
        dependsOn={'serviceId': 'b-400-heat', 'requiresVariant': 'central'},
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.1 Heizung.',
        offerNoteEn='Appears in the offer, section 3.1 Heating.'),
      # THREE BUILDINGS, ONE DECISION (AC 25). This replaces three
      # near-identical services whose only difference was a building name.
      tsvc('b-400-02', 'Wärmeverteilung', 'Heat distribution',
        'Drei Werte, weil die Nutzung je Baukörper unterschiedlich ist.',
        'Three values, because the use differs per building.', 1560000,
        costAuthority='direct',
        scopeDe='je Gebäude', scopeEn='per building',
        source=src('Grundlage Gebäude · bestätigt', 'Building baseline · confirmed'),
        valueRows=[
          row('Niedertemperatur-Verteilung mit Deckensegeln',
              'Low-temperature distribution with ceiling sails',
              building='B-BLDG-A', amount=520000),
          row('Fußbodenheizung und Wohnungsstationen',
              'Underfloor heating and dwelling stations',
              building='B-BLDG-B', amount=460000),
          row('Getrennte Zonen für Gewerbe-EG und Wohnen',
              'Separate zones for the commercial ground floor and dwellings',
              building='B-BLDG-C', amount=580000),
        ]),
      tread('b-400-05e', 'Einzelraumregelung · hydraulischer Abgleich',
        'Individual room control · hydraulic balancing',
        'Raumthermostat (einfach) · hydraulischer Abgleich mit raumweiser Heizlastberechnung.',
        'Simple room thermostat · hydraulic balancing with room-by-room heat load calculation.',
        costAuthority='bundle',
        costBasisDe='in der Wärmeverteilung enthalten',
        costBasisEn='included in the heat distribution position',
        scopeDe='gilt für alle 3 Gebäude', scopeEn='applies to all 3 buildings',
        whyDe=('GModG § 63 und § 60c — für Gebäude ab 6 Wohn-/Nutzungseinheiten '
               'gesetzlich, keine Zusatzleistung.'),
        whyEn=('GModG § 63 and § 60c — statutory for buildings with 6 or more '
               'dwelling/usage units, not an extra.'),
        source=src('GModG § 63 · § 60c', 'GModG § 63 · § 60c')),
      tchoice('b-400-es', 'Energieziel', 'Energy target',
        'Förderziel, nicht der gesetzliche Mindeststandard.',
        'Funding target, not the statutory minimum.',
        [tvar('geg', 'Gesetzlicher Mindeststandard', 'Statutory minimum', -540000),
         tvar('eh55', 'Effizienzhaus 55', 'Efficiency House 55', 0),
         tvar('eh40', 'Effizienzhaus 40', 'Efficiency House 40', 620000),
         tvar('eh40nh', 'Effizienzhaus 40 NH', 'Efficiency House 40 NH', 1180000)],
        'eh55',
        surface='rahmen',
        costAuthority='direct',
        source=src('03_Energiekonzept.pdf · S. 6', '03_Energiekonzept.pdf · p. 6'),
        whyDe=('Förderziel nach KfW 297/298 — vorbehaltlich verfügbarer Bundesmittel, '
               'kein Rechtsanspruch. Der gesetzliche Mindeststandard wird davon nicht '
               'berührt.'),
        whyEn=('Funding target per KfW 297/298 — subject to available federal funds, no '
               'legal entitlement. The statutory minimum is unaffected by it.'),
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 1.4 Wärmeschutz.',
        offerNoteEn='Appears in the offer, section 1.4 Thermal protection.'),
    ],
      summaryDe='Gemeinsamer Ambient-Loop · Niedertemperatur-Verteilung je Nutzung',
      summaryEn='Shared ambient loop · low-temperature distribution per use',
      scopeDe='gemeinsame Anlage · Verteilung je Gebäude',
      scopeEn='shared plant · distribution per building',
      costAuthority='direct'),

    # ── 2 · Trinkwasser & Warmwasser ─────────────────────────────────────
    system('b-kg400-water', 'Trinkwasser & Warmwasser', 'Potable water & DHW', [
      tchoice('b-400-07', 'Warmwasserbereitung', 'Domestic hot water generation',
        'Bestimmt, ob eine Zirkulation erforderlich ist.',
        'Determines whether circulation is required.',
        [tvar('WW_ZENTRAL_WP', 'Zentral je Gebäude: Wärmepumpe + Warmwasserspeicher',
              'Central per building: heat pump + DHW cylinder', bundled=True),
         tvar('WW_DEZ_FWST', 'Dezentral: Wohnungs-Frischwasserstationen',
              'Decentralised fresh-water stations', no_price_basis=True),
         tvar('WW_FW_KOMPAKT', 'Fernwärme-Kompaktstation (Wohnungsstation)',
              'District-heating compact station (flat station)', no_price_basis=True)],
        'WW_ZENTRAL_WP',
        all3Standard='WW_ZENTRAL_WP',
        costAuthority='bundle',
        costBasisDe='in der Sanitärinstallation enthalten',
        costBasisEn='included in the plumbing position',
        whyDe=('Zirkulation 60/55 °C nach DVGW W 551:2004-04. '
               'Bestimmt durch den Wärmeerzeuger.'),
        whyEn=('Circulation at 60/55 °C per DVGW W 551:2004-04. '
               'Determined by the heat generator.'),
        scopeDe='je Gebäude', scopeEn='per building',
        source=src('03_Energiekonzept.pdf · S. 16', '03_Energiekonzept.pdf · p. 16',
                   'Zentrale Warmwasserbereitung je Gebäude',
                   'Central DHW generation per building', 'WW_ZENTRAL_WP'),
        dependsOn={'serviceId': 'b-400-01', 'requiresSelected': True},
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.2 Wasser.',
        offerNoteEn='Appears in the offer, section 3.2 Water.'),
      tsvc('b-400-06', 'Sanitärinstallation', 'Plumbing installation',
        'Drei Werte, weil die Nutzung je Baukörper unterschiedlich ist.',
        'Three values, because the use differs per building.', 2180000,
        costAuthority='direct',
        scopeDe='je Gebäude', scopeEn='per building',
        source=src('Grundlage Gebäude · bestätigt', 'Building baseline · confirmed'),
        valueRows=[
          row('Sanitärkerne je Geschoss für 340 Arbeitsplätze',
              'Sanitary cores per floor for 340 workplaces',
              building='B-BLDG-A', amount=640000),
          row('Steigezonen und Wohnungsinstallation, 46 Einheiten',
              'Riser zones and dwelling installation, 46 units',
              building='B-BLDG-B', amount=720000),
          row('Wohnungsinstallation plus Gewerbeanschlüsse im EG',
              'Dwelling installation plus commercial connections at ground level',
              building='B-BLDG-C', amount=820000),
        ]),
      tread('b-400-08', 'Zirkulation Warmwasser', 'DHW circulation',
        'Zirkulation erforderlich — Folge der zentralen Warmwasserbereitung.',
        'Circulation required — a consequence of central DHW generation.',
        costAuthority='bundle',
        costBasisDe='in der Sanitärinstallation enthalten',
        costBasisEn='included in the plumbing position',
        whyDe=('Eine Hygienefolge, kein Schalter: bei zentraler Warmwasserbereitung '
               'ist die Zirkulation nach DVGW W 551 erforderlich.'),
        whyEn=('A hygiene consequence, not a toggle: central DHW generation requires '
               'circulation per DVGW W 551.'),
        scopeDe='je Gebäude', scopeEn='per building',
        source=src('Aus der Warmwasserbereitung abgeleitet',
                   'Derived from the DHW generation decision')),
    ],
      summaryDe='Zentral je Gebäude · Zirkulation 60/55 °C nach DVGW W 551:2004-04',
      summaryEn='Central per building · circulation at 60/55 °C per DVGW W 551:2004-04',
      scopeDe='je Gebäude', scopeEn='per building',
      costAuthority='direct'),

    # ── 3 · Lüftung & sommerlicher Komfort ───────────────────────────────
    system('b-kg400-air', 'Lüftung & sommerlicher Komfort',
      'Ventilation & summer comfort', [
      tsvc('b-400-05', 'Lüftungsanlagen', 'Ventilation plants',
        'Zentrale RLT für das Kontorhaus, dezentrale Geräte im Wohnungsbau.',
        'Central AHU for the Kontorhaus, decentralised units in the dwellings.', 1720000,
        costAuthority='direct',
        scopeDe='je Gebäude', scopeEn='per building',
        whyDe=('Lüftungskonzept nach DIN 1946-6:2019-12 · Energieziel EH 55 verlangt '
               'Wärmerückgewinnung · DIN 18017-3:2022-05 für innenliegende Bäder'),
        whyEn=('Ventilation concept per DIN 1946-6:2019-12 · energy target EH 55 requires '
               'heat recovery · DIN 18017-3:2022-05 for internal bathrooms'),
        source=src('05_Lueftungskonzept.pdf · S. 5', '05_Lueftungskonzept.pdf · p. 5'),
        valueRows=[
          row('Zentrale RLT-Anlage', 'Central air-handling unit', building='B-BLDG-A'),
          row('Dezentrale Lüftung mit Wärmerückgewinnung',
              'Decentralised ventilation with heat recovery', building='B-BLDG-B'),
          row('Dezentrale Lüftung mit Wärmerückgewinnung',
              'Decentralised ventilation with heat recovery', building='B-BLDG-C'),
        ],
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.7 Lüftung.',
        offerNoteEn='Appears in the offer, section 3.7 Ventilation.'),
      tsvc('b-400-92', 'Gastronomie-Lüftung Gewerbe-EG',
        'Gastronomy ventilation, commercial ground floor',
        'Das Nutzungskonzept nennt Gastronomie, der Auftraggeberbrief nur Gewerbe.',
        'The use concept names gastronomy, the client brief only commercial use.',
        420000, baseline='notSelected', authority='assumed',
        kind={'kind': 'requiredDecision'},
        costAuthority='direct',
        scopeDe='betrifft 1 von 3 Gebäuden', scopeEn='affects 1 of 3 buildings',
        source=src('B-Q-01 · Konflikt aus der Dokumentenanalyse',
                   'B-Q-01 · conflict from the document analysis',
                   'Nicht eindeutig', 'Not unambiguous'),
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.7 Lüftung.',
        offerNoteEn='Appears in the offer, section 3.7 Ventilation.'),
      tread('b-400-08s', 'Sommerlicher Wärmeschutz', 'Summer thermal protection',
        'Thermische Gebäudesimulation für das Kontorhaus · DIN 4108-2:2013-02.',
        'Thermal building simulation for the Kontorhaus · DIN 4108-2:2013-02.',
        costAuthority='noBasis',
        scopeDe='aus Projekt übernommen', scopeEn='taken from the project',
        whyDe='Aus der Gebäudehülle abgeleitet. Wird hier nicht entschieden, nur angezeigt.',
        whyEn='Derived from the building envelope. Shown here, not decided here.',
        source=src('Grundlage Gebäude · Hüllcluster', 'Building baseline · envelope cluster')),
    ],
      summaryDe='Zentrale RLT Kontorhaus · dezentrale WRG Hofhaus und Stadthaus',
      summaryEn='Central AHU Kontorhaus · decentralised heat recovery Hofhaus and Stadthaus',
      scopeDe='je Gebäude', scopeEn='per building',
      costAuthority='direct'),

    # ── 4 · Elektro & Energie ────────────────────────────────────────────
    system('b-kg400-power', 'Elektro & Energie', 'Electrical & on-site energy', [
      tsvc('b-400-09', 'Elektroinstallation & Datennetz', 'Electrical & data installation',
        'Drei Werte, weil die Nutzung je Baukörper unterschiedlich ist.',
        'Three values, because the use differs per building.', 1720000,
        costAuthority='direct',
        scopeDe='je Gebäude', scopeEn='per building',
        source=src('Grundlage Gebäude · bestätigt', 'Building baseline · confirmed'),
        valueRows=[
          row('Bodentanks, Beleuchtung und strukturierte Verkabelung',
              'Floor boxes, lighting and structured cabling',
              building='B-BLDG-A', amount=780000),
          row('Wohnungsverteilungen, Allgemeinstrom und Klingelanlage',
              'Dwelling boards, landlord supply and doorbell system',
              building='B-BLDG-B', amount=460000),
          row('Wohnungsverteilungen plus Gewerbeunterverteilung im EG',
              'Dwelling boards plus a commercial sub-distribution at ground level',
              building='B-BLDG-C', amount=480000),
        ]),
      tchoice('b-400-21', 'Ausstattungswert Elektro', 'Electrical equipment level',
        'Nach DIN 18015-2.', 'Per DIN 18015-2.',
        [tvar('AW1', 'AW1 — Mindestausstattung', 'AW1 — minimum equipment',
              no_price_basis=True),
         tvar('AW2', 'AW2 — Standardausstattung', 'AW2 — standard equipment',
              no_price_basis=True),
         tvar('AW3', 'AW3 — Komfortausstattung', 'AW3 — comfort equipment',
              no_price_basis=True)],
        'AW2',
        all3Standard='AW2',
        costAuthority='noBasis',
        costBasisDe='in der Elektroinstallation enthalten',
        costBasisEn='included in the electrical installation position',
        scopeDe='gilt für 3 Gebäude', scopeEn='applies to 3 buildings',
        source=src('DIN 18015-2 · All3-Standard', 'DIN 18015-2 · All3 standard',
                   'AW2 — Standardausstattung', 'AW2 — standard equipment', 'AW2')),
      # GEIG: a STATUTORY BASELINE, not a preference. Split from the
      # optional upgrade below, which is where a real choice exists.
      tread('b-400-22', 'Leitungsinfrastruktur je Stellplatz',
        'Cabling infrastructure per parking space',
        'Erforderlich · GEIG § 6 · 46 Stellplätze · Bauantrag vor 01.01.2027.',
        'Required · GEIG § 6 · 46 parking spaces · building application before 01/01/2027.',
        authority='sourceEvidenced',
        costAuthority='bundle',
        costBasisDe='in der Elektroinstallation enthalten',
        costBasisEn='included in the electrical installation position',
        scopeDe='gilt für 3 Gebäude', scopeEn='applies to 3 buildings',
        whyDe=('Ab Bauantrag 01.01.2027 gilt: 50 % Vorverkabelung je Stellplatzgruppe '
               'und mindestens ein errichteter Ladepunkt — Leerrohre genügen dann nicht '
               'mehr. Für dieses Projekt gilt das noch nicht.'),
        whyEn=('From a building application dated 01/01/2027: 50 % pre-wiring per parking '
               'group and at least one built charge point — conduits will no longer '
               'suffice. That does not yet apply to this project.'),
        source=src('GEIG § 6', 'GEIG § 6')),
      tsvc('b-400-91', 'Ladepunkte', 'Charge points',
        'Optionale Erweiterung über die gesetzliche Grundausstattung hinaus.',
        'Optional extension beyond the statutory baseline.',
        176000, baseline='notSelected', authority='derived',
        kind={'kind': 'quantity', 'unitAmount': money(8000), 'baselineQuantity': '22',
              'unitDe': 'Ladepunkte', 'unitEn': 'charge points',
              'minQuantity': '0', 'maxQuantity': '100000'},
        costAuthority='direct',
        scopeDe='gilt für 3 Gebäude', scopeEn='applies to 3 buildings',
        source=src('B-Q-04 · Konflikt aus der Dokumentenanalyse',
                   'B-Q-04 · conflict from the document analysis',
                   'Nicht spezifiziert', 'Not specified'),
        ruleId='p14a',
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.8 Elektro.',
        offerNoteEn='Appears in the offer, section 3.8 Electrical.'),
      tsvc('b-400-90', 'Photovoltaikanlage', 'Photovoltaic system',
        'Einspeisung auf 60 % begrenzt, bis Messstelle und Steuerung geprüft sind.',
        'Feed-in limited to 60 % until the metering point and control are verified.',
        620000, baseline='notSelected', authority='assumed',
        kind={'kind': 'requiredDecision'},
        costAuthority='direct',
        scopeDe='gemeinsame Anlage', scopeEn='shared installation',
        whyDe=('Eine bundesweite Pflicht zur Solarenergie besteht für neue '
               'Wohngebäude erst ab 2030. Landesrecht ist gesondert zu prüfen.'),
        whyEn=('A federal obligation to install solar energy arises for new residential '
               'buildings only from 2030. State law is checked separately.'),
        source=src('03_Energiekonzept.pdf · S. 21', '03_Energiekonzept.pdf · p. 21',
                   'Nicht spezifiziert', 'Not specified'),
        ruleId='p14a',
        valueRows=[
          row('aus Dachfläche abgeleitet · 186 kWp',
              'derived from the roof area · 186 kWp',
              label_de='PV-Leistung', label_en='PV capacity',
              note_de='abgeleitet', note_en='derived'),
          row('Gemeinschaftliche Gebäudeversorgung schließt den Mieterstromzuschlag aus',
              'Communal building supply excludes the tenant-electricity surcharge',
              label_de='PV-Vermarktung', label_en='PV energy model',
              note_de='ohne Preisgrundlage', note_en='no price basis'),
          row('teilt die Preisgrundlage der PV-Anlage',
              'shares the price basis of the PV system',
              label_de='Batteriespeicher', label_en='Battery storage',
              note_de='im Bündel', note_en='bundled'),
        ],
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 3.13 Photovoltaik.',
        offerNoteEn='Appears in the offer, section 3.13 Photovoltaics.'),
    ],
      summaryDe='AW2 · PV offen · E-Ladeinfrastruktur gesetzlich erforderlich',
      summaryEn='AW2 · PV open · EV cabling infrastructure required by law',
      scopeDe='gilt für 3 Gebäude', scopeEn='applies to 3 buildings',
      costAuthority='direct'),

    # ── 5 · Entwässerung ─────────────────────────────────────────────────
    system('b-kg400-drain', 'Entwässerung', 'Drainage', [
      tread('b-400-11', 'Rückstausicherung', 'Backwater protection',
        'Abwasserhebeanlage für fäkalienhaltiges Abwasser unter der Rückstauebene.',
        'Sewage lifting station for foul water below the backwater level.',
        costAuthority='noBasis',
        scopeDe='betrifft 1 von 3 Gebäuden', scopeEn='affects 1 of 3 buildings',
        whyDe=('DIN 1986-100:2016-12 · DIN EN 12056-4. Ein Rückstauverschluss ist nur '
               'bei untergeordneter Nutzung und weiteren Bedingungen zulässig, die im '
               'Angebot nicht bewertet werden können.'),
        whyEn=('DIN 1986-100:2016-12 · DIN EN 12056-4. A backwater valve is admissible '
               'only for subordinate use and under further conditions that an offer '
               'cannot assess.'),
        source=src('Grundlage Gebäude · Untergeschosse',
                   'Building baseline · basement levels'),
        valueRows=[
          row('Entwässerung unter der Rückstauebene · Abwasserhebeanlage',
              'Drainage below the backwater level · sewage lifting station',
              building='B-BLDG-B',
              note_de='ohne Preisgrundlage', note_en='no price basis'),
          row('kein UG — nicht anwendbar', 'no basement — not applicable',
              building='B-BLDG-A', not_applicable=True),
          row('kein UG — nicht anwendbar', 'no basement — not applicable',
              building='B-BLDG-C', not_applicable=True),
        ]),
      tread('b-400-11r', 'Regenwasserentsorgung', 'Stormwater disposal',
        'Kommunale Vorgabe: Einleitung in Kanal, gedrosselt · Mischkanalisation.',
        'Municipal requirement: throttled discharge to the sewer · combined system.',
        costAuthority='noBasis',
        scopeDe='gilt für die gesamte Option', scopeEn='applies to the whole Option',
        whyDe=('Projektvorgabe aus der Entwässerungssatzung. Bestimmt das '
               'Regenwassermanagement und muss mit der Dachretention übereinstimmen.'),
        whyEn=('A project requirement from the municipal drainage by-law. It determines '
               'stormwater management and must agree with the roof retention.'),
        source=src('Entwässerungssatzung der Gemeinde', 'Municipal drainage by-law')),
      tread('b-400-19', 'Tiefgaragen-Einfahrtstor', 'Underground garage entrance gate',
        'Entsteht automatisch, sobald die Gebäudegrundlage eine Tiefgarage enthält.',
        'Appears automatically once the building baseline includes an underground garage.',
        costAuthority='none',
        applicability=na('keine Tiefgarage im Projektumfang',
                         'no underground garage in the project scope')),
    ],
      summaryDe='Rückstausicherung nur Hofhaus · Kontorhaus und Stadthaus ohne UG',
      summaryEn='Backwater protection Hofhaus only · Kontorhaus and Stadthaus without basement',
      scopeDe='1 von 3 Gebäuden', scopeEn='1 of 3 buildings',
      applicability=na('nur das Hofhaus hat ein Untergeschoss',
                       'only the Hofhaus has a basement', state='partial'),
      costAuthority='noBasis'),

    # ── 6 · Kommunikation & Zutritt ──────────────────────────────────────
    system('b-kg400-comms', 'Kommunikation & Zutritt', 'Communications & access', [
      tchoice('b-400-29', 'Zutrittssystem', 'Access control',
        'Leser und Oberfläche folgen in der Bemusterung.',
        'Readers and finish follow in the specification stage.',
        [tvar('ZK_MECH', 'Mechanische Schließanlage', 'Mechanical master-key system',
              no_price_basis=True),
         tvar('ZK_RFID', 'Elektronisch (RFID/Transponder)', 'Electronic (RFID/transponder)',
              no_price_basis=True),
         tvar('ZK_SMART', 'Smartphone-/App-Zutritt', 'Smartphone/app-based access',
              no_price_basis=True)],
        'ZK_RFID',
        all3Standard='ZK_MECH',
        costAuthority='noBasis',
        scopeDe='gilt für 3 Gebäude', scopeEn='applies to 3 buildings',
        source=src('01_Auftraggeberbrief.pdf · S. 9', '01_Auftraggeberbrief.pdf · p. 9',
                   'Elektronische Zugangskontrolle', 'Electronic access control',
                   'ZK_RFID'),
        offerNoteDe='Wirkt sich auf das Angebot aus, Abschnitt 2.11 Zutritt.',
        offerNoteEn='Appears in the offer, section 2.11 Access.'),
      tread('b-400-25', 'Gebäudeverkabelung', 'In-building cabling',
        'Glasfaser bis in die Wohnung (FTTH), je Gebäude.',
        'Fibre to the dwelling (FTTH), per building.',
        costAuthority='noBasis',
        scopeDe='gilt für 3 Gebäude', scopeEn='applies to 3 buildings',
        source=src('Grundlage Projekt · Telekommunikation',
                   'Project baseline · telecommunications',
                   'Glasfaser in Planung/Ausbau', 'Fibre planned/under rollout')),
    ],
      summaryDe='FTTH je Gebäude · elektronische Zugangskontrolle',
      summaryEn='FTTH per building · electronic access control',
      scopeDe='gilt für 3 Gebäude', scopeEn='applies to 3 buildings',
      costAuthority='noBasis'),

    # ── 7 · Aufzüge & Sonderanlagen ──────────────────────────────────────
    system('b-kg400-lift', 'Aufzüge & Sonderanlagen', 'Lifts & special systems', [
      tread('b-400-27', 'Anzahl Aufzüge', 'Number of lifts',
        'Aus der Gebäudegrundlage abgeleitet · elektrisch maschinenraumlos (MRL).',
        'Derived from the building baseline · electric, machine-room-less (MRL).',
        costAuthority='noBasis',
        scopeDe='je Gebäude', scopeEn='per building',
        whyDe=('Die Aufzugspflicht folgt aus der Gebäudehöhe (MBO § 39 Abs. 4), '
               'nicht aus der Geschosszahl.'),
        whyEn=('The lift requirement follows from the building height (MBO § 39 (4)), '
               'not from the number of storeys.'),
        source=src('Grundlage Gebäude · Höhe', 'Building baseline · height'),
        valueRows=[
          row('1 Personenaufzug', '1 passenger lift', building='B-BLDG-A'),
          row('1 Personenaufzug', '1 passenger lift', building='B-BLDG-B'),
          row('1 Personenaufzug', '1 passenger lift', building='B-BLDG-C'),
        ]),
    ],
      summaryDe='3 Aufzüge aus der Gebäudegrundlage',
      summaryEn='3 lifts from the building baseline',
      scopeDe='je Gebäude', scopeEn='per building',
      costAuthority='noBasis'),

    # ── 8 · Schnittstellen & Verantwortung ───────────────────────────────
    system('b-kg400-scope', 'Schnittstellen & Verantwortung',
      'Interfaces & responsibility', [
      tread('b-400-13g', 'Leistungsgrenze TGA', 'MEP scope boundary',
        'Leitungsnetz bis 1,0 m außerhalb der Gebäudehülle bzw. bis zum vereinbarten Übergabepunkt.',
        'Pipework and cabling to 1.0 m outside the building envelope, or to the agreed handover point.',
        authority='sourceEvidenced',
        costAuthority='none',
        scopeDe='gilt für die gesamte Option', scopeEn='applies to the whole Option',
        source=src('All3-Standard · Leistungsverzeichnis', 'All3 standard · scope schedule',
                   'Übergabepunkt Grundstücksgrenze', 'Handover point at the property line')),
      tread('b-400-14', 'Hausanschlüsse', 'Utility house connections',
        'Bauherr bis Grundstücksgrenze, All3 ab Übergabepunkt.',
        'Client to the property line, All3 from the handover point.',
        authority='sourceEvidenced',
        costAuthority='bauherr',
        scopeDe='Verantwortung je Medium', scopeEn='responsibility per medium',
        source=src('01_Auftraggeberbrief.pdf · S. 12', '01_Auftraggeberbrief.pdf · p. 12'),
        valueRows=[
          row('Bauherr bis Grundstücksgrenze', 'Client to the property line',
              label_de='Trinkwasser', label_en='Potable water', status='ok'),
          row('Bauherr bis Grundstücksgrenze', 'Client to the property line',
              label_de='Schmutzwasser / Kanal', label_en='Foul water / sewer', status='ok'),
          row('Bauherr bis Grundstücksgrenze', 'Client to the property line',
              label_de='Strom (NS-Netz)', label_en='Electricity (LV grid)', status='ok'),
          row('Glasfaser in Planung/Ausbau — Verfügbarkeit offen',
              'Fibre planned/under rollout — availability open',
              label_de='Telekommunikation', label_en='Telecommunications',
              status='attention'),
        ],
        offerNoteDe=('Eine ungeklärte Schnittstelle wird als Bedingung ins Angebot '
                     'übernommen, nicht als Betrag und nicht als Lücke.'),
        offerNoteEn=('An unresolved interface enters the offer as a condition — not as '
                     'an amount and not as a gap.')),
    ],
      summaryDe='Leistungsgrenze bestätigt · Telekommunikation ungeklärt',
      summaryEn='Scope boundary confirmed · telecommunications unresolved',
      scopeDe='gilt für die gesamte Option', scopeEn='applies to the whole Option',
      costAuthority='bauherr'),
   ],
   [
    rahmen('energieziel', 'Energieziel', 'Energy target', '', '',
           'Förderziel · Annahme', 'Funding target · assumption', edit='b-400-es'),
    rahmen('mindeststandard', 'Gesetzlicher Mindeststandard', 'Statutory minimum',
           'GModG § 10 · Niedrigstenergiegebäude', 'GModG § 10 · nearly zero-energy building',
           'aus Bauantragsdatum abgeleitet', 'derived from the building-application date'),
    rahmen('gebaeudeumfang', 'Gebäudeumfang', 'Building scope', '', '', '', '',
           derive='buildingScope'),
    rahmen('leistungsgrenze', 'Leistungsgrenze All3', 'All3 scope boundary',
           'ab Übergabepunkt Grundstücksgrenze', 'from the handover point at the property line',
           '1 Schnittstelle ungeklärt', '1 interface unresolved'),
   ],
   [
    rule('p14a', '§ 14a EnWG · steuerbare Verbrauchseinrichtungen',
         '§ 14a EnWG · controllable consumption devices',
         ('Diese Option enthält steuerbare Verbrauchseinrichtungen: Wärmepumpe · '
          'Wallboxen · Batteriespeicher. Die garantierte Leistung wird gemeinsam '
          'bemessen, nicht je Gerät. Der Netzanschluss ist entsprechend auszulegen.'),
         ('This Option contains controllable consumption devices: heat pump · wallboxes · '
          'battery storage. The guaranteed power is measured jointly, not per device. '
          'The grid connection is sized accordingly.'),
         'BNetzA BK6-22-300, Anlage 1 · Ziffer 2.4.1 · § 19 Abs. 2 NAV',
         'BNetzA BK6-22-300, annex 1 · clause 2.4.1 · § 19 (2) NAV',
         note_de=('Die Summen-Bemessungsleistung der Ladeeinrichtungen überschreitet '
                  '12 kVA — die Inbetriebnahme bedarf der Zustimmung des Netzbetreibers '
                  '(§ 19 Abs. 2 NAV). Diese Zustimmung ist nicht Bestandteil des Angebots.'),
         note_en=('The combined rated power of the charging equipment exceeds 12 kVA — '
                  'commissioning requires the grid operator\'s consent (§ 19 (2) NAV). '
                  'That consent is not part of the offer.')),
   ],
   bemusterung([
     ('Ausstattungswert Elektro AW2 · DIN 18015-2',
      'Electrical equipment level AW2 · DIN 18015-2',
      'Schalterprogramm, Farbe, KNX-Raumcontroller',
      'Switch range, colour, KNX room controller'),
     ('Zutritt elektronisch · RFID/Transponder',
      'Electronic access · RFID/transponder',
      'Leser, Oberfläche, Türsprech-Innenstation',
      'Readers, finish, intercom indoor station'),
     ('Einzelraumregelung Raumthermostat', 'Individual room control, room thermostat',
      'Smart-Home-Raumregler, KNX', 'Smart-home room controller, KNX'),
   ])),
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
                    s.get('requiresDecision')
                    or kind == 'requiredDecision'
                    or s['id'] in EXPLICIT_QUANTITY_DECISIONS)
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
#
# VR3-TGA-01 moved these. KG 400 was rebuilt from three inclusion checkboxes
# into the eight canonical TGA systems, so the chapter now carries real
# engineering alternatives where it carried none, and the complex project's
# nine near-identical per-building rows became three decisions that state
# their scope once. The VR3-03 numbers (A 21/3/6, B 43/7/11) described the
# superseded shape and are recorded here so the change is legible rather than
# silently absorbed.
for name, got, want, what in [
    ('DEMO-HAPPY-01', a_sel, 31, 'selected standard services'),
    ('DEMO-HAPPY-01', a_var, 11, 'configured variants'),
    ('DEMO-HAPPY-01', a_dec, 7, 'explicit non-selections'),
    ('DEMO-COMPLEX-01', b_sel, 48, 'selected standard services'),
    ('DEMO-COMPLEX-01', b_var, 10, 'configured variants'),
    ('DEMO-COMPLEX-01', b_dec, 11, 'explicit non-selections'),
]:
    if got != want:
        raise SystemExit(f'{name}: {got} {what}, ticket declares {want}')

# ── VR3-TGA-01 · what the KG 400 chapter must be ─────────────────────────
# These prove the CONTENT MODEL, not only the arithmetic: a KG 400 that adds
# up correctly while offering no technical alternative is exactly the defect
# the TGA audit measured, and the sums above cannot see it.
TGA_SYSTEMS = [
    'Wärme', 'Trinkwasser & Warmwasser', 'Lüftung & sommerlicher Komfort',
    'Elektro & Energie', 'Entwässerung', 'Kommunikation & Zutritt',
    'Aufzüge & Sonderanlagen', 'Schnittstellen & Verantwortung',
]

def prove_tga(name, chapters):
    ch = next(c for c in chapters if c['group'] == 'KG_400')
    names = [g['labelDe'] for g in ch['groups']]
    if names != TGA_SYSTEMS:
        raise SystemExit(f'{name} KG 400 systems: {names} != {TGA_SYSTEMS}')
    for field in ('rahmen', 'bemusterung', 'rules'):
        if not ch.get(field):
            raise SystemExit(f'{name} KG 400 declares no {field}')
    services = [s for g in ch['groups'] for s in g['services']]
    # Every alternative must state what its euro is allowed to mean. A
    # variant that is neither priced, nor bundled, nor explicitly without a
    # price basis would render a bare "± 0 €" — the one thing the audit's
    # cost-authority rule forbids outright.
    for s in services:
        if s['kind']['kind'] != 'singleChoice':
            continue
        base = s['kind']['baselineVariant']
        for v in s['kind']['variants']:
            priced = D(v['delta']) != 0
            if not (priced or v.get('noPriceBasis') or v.get('bundled')
                    or v['value'] == base):
                raise SystemExit(
                    f"{name} {s['id']}/{v['value']}: an alternative with no cost "
                    'language would render a bare zero')
    # A source baseline must never be merged into the proposal: where a
    # decision names the variant its documents specified, that variant has to
    # exist in the choice set, or "restore the documented solution" is a
    # button that cannot work.
    for s in services:
        variant = (s.get('source') or {}).get('variant')
        if variant is None:
            continue
        if s['kind']['kind'] != 'singleChoice':
            raise SystemExit(f"{name} {s['id']}: a source variant on a non-choice")
        if variant not in [v['value'] for v in s['kind']['variants']]:
            raise SystemExit(
                f"{name} {s['id']}: source variant {variant} is not an alternative")
    # The All3 standard is a MARKER inside the choice set, never a selection
    # and never a fourth state.
    for s in services:
        std = s.get('all3Standard')
        if std is None:
            continue
        if std not in [v['value'] for v in s['kind']['variants']]:
            raise SystemExit(
                f"{name} {s['id']}: All3 standard {std} is not an alternative")
    # A blocked alternative must be shown WITH ITS REASON, and it must be a
    # real alternative rather than a value invented to be refused.
    for s in services:
        for b in s.get('blockedVariants', []):
            if b['value'] not in [v['value'] for v in s['kind']['variants']]:
                raise SystemExit(
                    f"{name} {s['id']}: blocks {b['value']}, which is not an alternative")
    configurable = [s for s in services if s['kind']['kind'] == 'singleChoice']
    print(f'{name} KG 400: {len(ch["groups"])} systems · {len(services)} decisions · '
          f'{len(configurable)} with alternatives')

prove_tga('DEMO-HAPPY-01', A)
prove_tga('DEMO-COMPLEX-01', B)

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
