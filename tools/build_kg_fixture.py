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
    """A position Sales configures by its DRIVING QUANTITY, not by a lump.

    THE RATE IS NOT A NEW COST. `amount` is computed here as
    `unit_amount x qty`, so a position converted from a flat `svc` to this
    helper keeps its declared euro to the cent as long as the pair
    multiplies back to the amount it had. That is the whole safety property
    of the conversion, and `kgConfiguration.test.ts` proves it per cost
    group against `declaredByCostGroup`.

    WHY THAT MATTERS HERE (task "surface KG 200/500/600 option by option").
    The ticket asked for a `ScopeCatalogChapter` over `scope-catalog.json`.
    Fresh repository truth superseded that premise: VR3-03 deleted the
    scope-catalog grammar on purpose (see the docblock at the head of
    `src/screens/S3Konfigurator.tsx`), `scopeCatalogDrivers` runs only in
    `proposalProjection`, and `proposalProjection` runs only when an Option
    has no `kgConfig` -- which no reachable Option ever is. Surfacing that
    catalogue would therefore have shipped ~20 Sales-selectable controls
    with a structurally guaranteed zero price effect, the exact defect the
    pricing-coverage invariant exists to forbid.

    So the missing DEPTH is added on the canonical live grammar instead.
    Ten KG 200/500/600 positions that were flat include/exclude rows now
    name the quantity that drives them. The unit rate is a re-expression of
    each position's OWN declared demonstration amount at a declared
    quantity -- never a rate imported from `scope-catalog.json`, whose
    KG 200/500/600 items describe the same physical scope under an
    incompatible model and would double-count it.

    PROVENANCE MOVES WITH THE SHAPE, deliberately. `svc` defaults to
    `sourceEvidenced`; this helper declares `derived`, and the ten converted
    positions therefore change authority. That is the honest direction, not a
    side effect: the old lump claimed the documents evidenced 44.000 EUR,
    while the composed value says 2.200 m2 x 20 EUR/m2 -- and the quantity is
    a declared demonstration figure, not a measurement read off a drawing.
    All five pre-existing quantity positions already declare `derived`.
    """
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

def tvar(v, de, en, delta=0, no_price_basis=False, bundled=False,
         detail_de=None, detail_en=None, cost_authority=None,
         excludes_position=False):
    """One alternative. `detail_*` is the ONE differentiator an option card
    shows under the solution name (VR3-TGA-UX-00): a technical qualifier that
    used to share the label with the human name now has its own slot, so the
    primary copy stays a name and the secondary copy stays a distinction.

    VR3-KG-UNIFY-00 adds two facts an alternative may carry: its OWN cost
    authority where it differs from the decision's, and `excludes_position`
    for the answer `Nicht im All3-Leistungsumfang`, which removes the
    position from the offer (contribution `null`, never a `direct` zero)."""
    d = {'value': v, 'labelDe': de, 'labelEn': en, 'delta': money(delta)}
    if no_price_basis: d['noPriceBasis'] = True
    if bundled: d['bundled'] = True
    if detail_de: d['detailDe'] = detail_de; d['detailEn'] = detail_en
    if cost_authority: d['costAuthority'] = cost_authority
    if excludes_position: d['excludesPosition'] = True
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
           edit=None, derive=None, basis_de=None, basis_en=None):
    """One condition everything below depends on. NOT a system.

    `basis_*` is the formal statement BEHIND the value — the statutory
    minimum behind the funding target — and it lives in the entry's own
    evidence disclosure rather than in a fifth band cell (VR3-TGA-UX-00: the
    band is orientation, the regulation is on demand).
    """
    return _attach({'id': rid, 'labelDe': de, 'labelEn': en,
                    'valueDe': value_de, 'valueEn': value_en,
                    'metaDe': meta_de, 'metaEn': meta_en},
                   {'editServiceId': edit, 'derive': derive,
                    'basisDe': basis_de, 'basisEn': basis_en})

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
        # ONE clause (VR3-TGA-UX-00): the boundary's job at the foot of the
        # chapter is "is this decided here or later?" in a glance. The full
        # decided/deferred mapping stays behind the disclosure.
        'bodyDe': ('Hier wird das System festgelegt; Produkte und Oberflächen '
                   'werden später in der Bemusterung verfeinert, nicht ersetzt.'),
        'bodyEn': ('The system is fixed here; products and finishes are refined '
                   'later in the specification stage, not replaced.'),
        'decidedHeadingDe': 'Hier bereits entschieden',
        'decidedHeadingEn': 'Already decided here',
        'deferredHeadingDe': 'Später zu bemustern',
        'deferredHeadingEn': 'To be specified later',
        'rows': [{'decidedDe': a, 'decidedEn': b, 'deferredDe': c, 'deferredEn': d}
                 for a, b, c, d in rows],
    }

# ── VR3-TGA-UX-00 · Schnittstellen & Verantwortung — its OWN catalogue block ──
# The responsibility matrix used to be the eighth "system" of KG 400: two
# read-only services (`a/b-400-13g`, `a/b-400-14`) whose value rows carried
# the four utility media. It is not an engineering system a salesperson
# configures, so it moves out of the chapter into a catalogue-level block the
# dedicated Configurator step reads. The DATA is the same data — every value,
# source, status, cost authority and offer note below is transcribed from the
# retired services, so the relocation is lossless by construction.

def medium(mid, label_de, label_en, client_de, client_en, status='ok'):
    """One utility medium: who delivers up to where, and whether it is settled."""
    return {'id': mid, 'labelDe': label_de, 'labelEn': label_en,
            'clientDe': client_de, 'clientEn': client_en, 'status': status}

def responsibility(boundary_source, connections_source, media):
    """The Option's interface & responsibility truth, seeded from the project."""
    return {
        'version': 1,
        'scopeBoundary': {
            'labelDe': 'Leistungsgrenze TGA', 'labelEn': 'MEP scope boundary',
            'summaryDe': ('Leitungsnetz bis 1,0 m außerhalb der Gebäudehülle bzw. bis zum '
                          'vereinbarten Übergabepunkt.'),
            'summaryEn': ('Pipework and cabling to 1.0 m outside the building envelope, or to '
                          'the agreed handover point.'),
            'handoverDe': 'Übergabepunkt Grundstücksgrenze',
            'handoverEn': 'Handover point at the property line',
            'scopeDe': 'gilt für die gesamte Option', 'scopeEn': 'applies to the whole Option',
            'authority': 'sourceEvidenced', 'costAuthority': 'none',
            'source': boundary_source,
        },
        'connections': {
            'labelDe': 'Hausanschlüsse', 'labelEn': 'Utility house connections',
            'summaryDe': 'Bauherr bis Grundstücksgrenze, All3 ab Übergabepunkt.',
            'summaryEn': 'Client to the property line, All3 from the handover point.',
            'all3FromDe': 'Übergabepunkt', 'all3FromEn': 'Handover point',
            'scopeDe': 'Verantwortung je Medium', 'scopeEn': 'responsibility per medium',
            'authority': 'sourceEvidenced', 'costAuthority': 'bauherr',
            'source': connections_source,
            'media': media,
            'offerNoteDe': ('Eine ungeklärte Schnittstelle wird als Bedingung ins Angebot '
                            'übernommen, nicht als Betrag und nicht als Lücke.'),
            'offerNoteEn': ('An unresolved interface enters the offer as a condition — not '
                            'as an amount and not as a gap.'),
        },
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

# ── VR3-KG-UNIFY-00 · KG 300 as a BUILDING-AWARE construction configurator ──
# Authority: docs/audit/kg-configurator-unification-5fefe67/
#   kg300-content-dictionary.md   (the 20 records D01…D20, labels, values)
#   kg300-dependency-graph.md      (UG ← building truth, D05 ← D04, D07/D08 ← D06,
#                                   roof matrix, lift ← hasLift, derived profiles)
#   kg300-decision-scope-map.md    (every record is BUILDING-scoped)
#   kg300-cost-authority-map.md    (what a euro may mean per record)
#   kg-chapter-migration-map.md    (nine system rows and their pictograms)
#
# ONE ROW PER SYSTEM PER BUILDING. A group is a system row and carries the
# building it decides for (`buildingId`); `chapterForBuilding` shows one
# building's rows at a time, so the chapter reads as nine systems and the
# building context switches whose answers they show. Ids follow
# `<a|b>-kg300-<system>-<bldg>` for rows and `<a|b>-300-<system>-<record>-<bldg>`
# for records.
#
# WHAT MOVED AND WHAT DID NOT. Every euro of the previous KG 300 is still
# here, on the record that owns it: the foundation position → D01, the
# basement position → D02, the structure position → D03, the façade(+roof)
# position → D06, the happy project's roof position → D10, the balcony
# decision → D04, `b-300-90` (extended green roof) and `b-300-91` (tenant
# fit-out) unchanged. Two superseded choices are dropped: `b-300-ug`
# (physical basement extent of Haus C — the extent is Building truth, not a
# proposal; the scope decision D02 replaces it) and `b-300-facade` (one
# material for the ensemble — D06 decides per building). Both had a baseline
# delta of 0, so the declared totals do not move.
#
# Variant VALUES are the keys of the shared visual registry
# (`src/config/kg-visuals.ts`), which keys miniatures by value: where the
# dictionary's option key differs from the registry key (UG `FULL` vs
# `UG_FULL`, balcony `COLUMNS` vs `BAL_COLUMNS`, window frame `PVC` vs
# `WIN_PVC`, …) the registry key is the value and the dictionary wording is
# the label. Colour/texture family values already equal the registry keys.

UG_CONDITION = {'fact': 'undergroundLevel', 'oneOf': ['partial', 'full'],
                'reasonDe': 'Gebäude ohne Untergeschoss',
                'reasonEn': 'building has no basement'}

INCLUDE_LABELS = dict(
    includeLabelDe='Im All3-Leistungsumfang', includeLabelEn='Included in All3 scope',
    excludeLabelDe='Nicht im All3-Leistungsumfang', excludeLabelEn='Not included in All3 scope',
    excludedPhraseDe='nicht im All3-Angebot · Verantwortung offen',
    excludedPhraseEn='not in the All3 offer · responsibility open',
)

FIT_OUT_ONLY_OFFER_DE = ('Untergeschoss: nur Ausbau durch All3. Erdarbeiten, Gründung, tragender '
                         'Rohbau, Abdichtung und äußere Öffnungen sind nicht Bestandteil des '
                         'All3-Angebots; TGA-Leistungen gemäß den separat ausgewiesenen '
                         'Systemgrenzen.')
FIT_OUT_ONLY_OFFER_EN = ('Basement: All3 fit-out only. Excavation, foundations, loadbearing shell, '
                         'waterproofing and external openings are excluded from the All3 offer; '
                         'building-services scope follows the separately stated system boundaries.')

# The five compositions and the material ZONES each one activates. D07 and
# D08 are one record each in the dictionary, with one sub-value per active
# zone; here every zone is its own service so the dependency can be stated
# in data (`requiresVariantIn`) rather than computed in a component — six
# services per building are the per-material sub-values of two records.
FACADE_ZONES = {
    'timber': ['FAC_FULL_TIMBER', 'FAC_GF_RENDER_UPPER_TIMBER'],
    'render': ['FAC_FULL_RENDER', 'FAC_GF_RENDER_UPPER_TIMBER', 'FAC_GF_RENDER_UPPER_CLINKER'],
    'clinker': ['FAC_FULL_CLINKER', 'FAC_GF_RENDER_UPPER_CLINKER'],
}
FACADE_COMPOSITIONS = [
    ('FAC_FULL_TIMBER', 'Durchgehende Holzfassade', 'Full timber façade'),
    ('FAC_FULL_RENDER', 'Durchgehende Putzfassade', 'Full rendered façade'),
    ('FAC_FULL_CLINKER', 'Durchgehende Klinkerfassade', 'Full clinker-brick façade'),
    ('FAC_GF_RENDER_UPPER_TIMBER', 'Erdgeschoss Putz · Obergeschosse Holz',
     'Rendered ground floor · timber upper floors'),
    ('FAC_GF_RENDER_UPPER_CLINKER', 'Erdgeschoss Putz · Obergeschosse Klinker',
     'Rendered ground floor · clinker-brick upper floors'),
]
COLOUR_FAMILIES = {
    'timber': ('Farbwelt Holz', 'Timber colour family', [
        ('TIMBER_LIGHT', 'Natur hell', 'Natural light'),
        ('TIMBER_WARM', 'Natur warm', 'Natural warm'),
        ('TIMBER_DARK', 'Dunkel', 'Dark'),
        ('TIMBER_MUTED', 'Deckend gedeckt', 'Muted opaque')]),
    'render': ('Farbwelt Putz', 'Render colour family', [
        ('RENDER_LIGHT', 'Hell neutral', 'Light neutral'),
        ('RENDER_WARM', 'Warm erdig', 'Warm earth'),
        ('RENDER_MUTED', 'Gedämpfte Farbe', 'Muted colour'),
        ('RENDER_DARK', 'Dunkler Akzent', 'Dark accent')]),
    'clinker': ('Farbwelt Klinker', 'Clinker colour family', [
        ('CLINKER_RED', 'Rotbraun', 'Red-brown'),
        ('CLINKER_SAND', 'Sand-Beige', 'Sand beige'),
        ('CLINKER_GREY', 'Grau-Anthrazit', 'Grey-anthracite'),
        ('CLINKER_VARIED', 'Changierend', 'Variegated')]),
}
TEXTURE_FAMILIES = {
    'timber': ('Materialausdruck Holz', 'Timber texture', [
        ('TEX_TIMBER_VERTICAL', 'Vertikale Lattung', 'Vertical slats'),
        ('TEX_TIMBER_HORIZONTAL', 'Horizontale Schalung', 'Horizontal boarding'),
        ('TEX_TIMBER_PANEL', 'Flächige Bekleidung', 'Panel expression')]),
    'render': ('Materialausdruck Putz', 'Render texture', [
        ('TEX_RENDER_FINE', 'Fein', 'Fine'),
        ('TEX_RENDER_MEDIUM', 'Mittel gekörnt', 'Medium grain'),
        ('TEX_RENDER_PRONOUNCED', 'Markant mineralisch', 'Pronounced mineral')]),
    'clinker': ('Materialausdruck Klinker', 'Clinker texture', [
        ('TEX_CLINKER_SMOOTH', 'Glatt', 'Smooth'),
        ('TEX_CLINKER_LIGHT', 'Leicht strukturiert', 'Lightly textured'),
        ('TEX_CLINKER_PRONOUNCED', 'Markant strukturiert', 'Pronounced texture')]),
}

# The roof matrix, verbatim in meaning from kg300-dependency-graph.md.
ROOF_MATRIX = {
    'ROOF_OCCUPIED|ROOF_GREEN': (
        'Intensivbegrünung oder getrennte Verkehrszonen · Verkehrslast, Entwässerung, '
        'Absturzsicherung und Pflegekonzept nachzuweisen',
        'Intensive greening or separated traffic zones · structural/traffic load, drainage, '
        'guarding and maintenance concept to be verified'),
    'ROOF_OCCUPIED|ROOF_NON_GREEN': (
        'Aufbau als genutztes Dach/Terrasse · Verkehrsfläche, Entwässerung und Absturzsicherung',
        'Occupied roof/terrace build-up · traffic surface, drainage and guarding'),
    'ROOF_MAINTENANCE|ROOF_GREEN': (
        'Regelfall Extensivbegrünung · gesättigte Last, Entwässerung, Wurzelschutz und sicherer '
        'Wartungszugang mit Absturzsicherung',
        'Normally extensive greening · saturated load, drainage, root protection and safe '
        'maintenance access with fall protection'),
    'ROOF_MAINTENANCE|ROOF_NON_GREEN': (
        'Standardaufbau ohne planmäßige Nutzung · sicherer Wartungszugang und Absturzsicherung',
        'Standard non-occupied weathering build-up · safe maintenance access and fall protection'),
}

# D16: thermal and acoustic levels follow project authority for every
# combination; large format adds fall protection/structure/installation,
# increased operable share adds the KG 400 ventilation interface.
WINDOW_MATRIX = {
    'WIN_STANDARD_FORMAT|WIN_OPENING_STANDARD': (
        'Wärmeschutz nach Energieziel (GModG), Schallschutz nach Lärmquelle, RC nach Risiko · '
        'Standardformate ohne zusätzliche Absturzsicherung · Lüftung über das Lüftungskonzept KG 400',
        'Thermal level per energy target (GModG), acoustic class per noise source, RC per risk · '
        'standard formats without additional fall protection · ventilation via the KG 400 concept'),
    'WIN_STANDARD_FORMAT|WIN_OPENING_INCREASED': (
        'Wärmeschutz nach Energieziel (GModG), Schallschutz nach Lärmquelle, RC nach Risiko · '
        'Standardformate · erhöhter Öffnungsanteil: Abstimmung mit dem Lüftungskonzept KG 400 erforderlich',
        'Thermal level per energy target (GModG), acoustic class per noise source, RC per risk · '
        'standard formats · increased operable share: coordination with the KG 400 ventilation concept required'),
    'WIN_LARGE_FORMAT|WIN_OPENING_STANDARD': (
        'Wärmeschutz nach Energieziel (GModG), Schallschutz nach Lärmquelle, RC nach Risiko · '
        'großformatige Elemente: Absturzsicherung, Statik und Einbau nachzuweisen · Lüftung über das Lüftungskonzept KG 400',
        'Thermal level per energy target (GModG), acoustic class per noise source, RC per risk · '
        'large-format elements: fall protection, structure and installation to be verified · ventilation via the KG 400 concept'),
    'WIN_LARGE_FORMAT|WIN_OPENING_INCREASED': (
        'Wärmeschutz nach Energieziel (GModG), Schallschutz nach Lärmquelle, RC nach Risiko · '
        'großformatige Elemente: Absturzsicherung, Statik und Einbau nachzuweisen · erhöhter '
        'Öffnungsanteil: Abstimmung mit dem Lüftungskonzept KG 400 erforderlich',
        'Thermal level per energy target (GModG), acoustic class per noise source, RC per risk · '
        'large-format elements: fall protection, structure and installation to be verified · '
        'increased operable share: coordination with the KG 400 ventilation concept required'),
}

# D20: entrance category × second category (apartment doors for residential
# use, internal doors for the office building, which has no apartment doors).
ENTRANCE_REQ = {
    'DOOR_ALU_GLAZED': ('Hauseingang verglast: Sicherheitsverglasung, RC-Klasse nach Risiko, '
                        'barrierefreie Durchgangsbreite, Antrieb nur bei Bedarf',
                        'Glazed entrance: safety glazing, RC class per risk, accessible clear '
                        'width, operator only where required'),
    'DOOR_ALU_OPAQUE': ('Hauseingang geschlossen: RC-Klasse nach Risiko, barrierefreie '
                        'Durchgangsbreite, Antrieb nur bei Bedarf',
                        'Opaque entrance: RC class per risk, accessible clear width, operator '
                        'only where required'),
    'DOOR_TIMBER_OPAQUE': ('Hauseingang Holz geschlossen: Witterungs- und RC-Nachweis, '
                           'barrierefreie Durchgangsbreite, Antrieb nur bei Bedarf',
                           'Opaque timber entrance: weathering and RC evidence, accessible '
                           'clear width, operator only where required'),
}
APARTMENT_REQ = {
    'ADOOR_STANDARD': ('Wohnungstüren: Brand-/Rauchschutz und Schallschutz nach Konzept, '
                       'Mindest-Barrierefreiheit',
                       'Apartment doors: fire/smoke and acoustic class per concept, minimum '
                       'accessibility'),
    'ADOOR_ENHANCED': ('Wohnungstüren: erhöhter Schall- und Einbruchschutz über den '
                       'Konzeptanforderungen, Brand-/Rauchschutz unverändert verbindlich',
                       'Apartment doors: enhanced acoustic and security performance above the '
                       'concept requirements, fire/smoke unchanged and mandatory'),
}
INTERNAL_REQ = {
    'IDOOR_STANDARD': ('Innentüren: Brand-/Rauchschutz-, Schall- und Technikraumtüren nach '
                       'Konzept ersetzen einzelne Standardtüren',
                       'Internal doors: fire/smoke, acoustic and service-room doors per concept '
                       'replace individual standard doors'),
    'IDOOR_ROBUST': ('Innentüren: robuste Objekttüren; Brand-/Rauchschutz- und Technikraumtüren '
                     'nach Konzept',
                     'Internal doors: robust contract doors; fire/smoke and service-room doors '
                     'per concept'),
}


def derived(sid, de, en, sde, sen, from_ids, by_values, fallback_de, fallback_en, **extras):
    """A READ-ONLY record whose value follows from other decisions of the
    chapter. `from_ids` are the governors in order; `by_values` maps their
    joined variant values (`ROOF_OCCUPIED|ROOF_GREEN`) to the sentence. The
    engine (`derivedValue`) reads it; nothing here is a price."""
    extras['derived'] = {
        'from': list(from_ids),
        'byValues': {k: {'valueDe': v[0], 'valueEn': v[1]} for k, v in by_values.items()},
        'fallbackDe': fallback_de, 'fallbackEn': fallback_en,
    }
    return tread(sid, de, en, sde, sen, **extras)


def orientation_rahmen():
    """The two orientation entries every non-TGA chapter shows: building scope
    and source documents, both READ from Option state, never authored here.
    They exist because a chapter that declares system rows dissolves the
    Kontext card into the Rahmen band (AC 4 of VR3-TGA-01: nothing it showed
    is lost), and a band with no entries renders nothing at all."""
    return [
        rahmen('gebaeudeumfang', 'Gebäudeumfang', 'Building scope', '', '', '', '',
               derive='buildingScope'),
        rahmen('quelle', 'Quelle', 'Source', '', '', '', '', derive='sourceDocuments'),
    ]


def kg300_chapter(tde, ten, nde, nen, groups, bem):
    ch = chapter('KG_300', tde, ten, nde, nen, groups)
    ch['rahmen'] = orientation_rahmen()
    ch['bemusterung'] = bem
    return ch


KG300_BEMUSTERUNG = bemusterung([
    ('Fassadenaufbau, Farbwelt und Materialausdruck je Materialzone',
     'Façade composition, colour and texture family per material zone',
     'Hersteller, exakter RAL-/NCS-Ton, Stein- und Beschichtungscode, Brettprofil, Körnung, Verband und Fuge',
     'Manufacturer, exact RAL/NCS shade, brick and coating code, board profile, grain, bond and joint'),
    ('Fenster-Rahmensystem, Formatpaket und Öffnungsanteil',
     'Window frame system, format package and operable share',
     'Profilserie, Glasaufbau, Beschläge, Griffe, Fensterbank, Farbe',
     'Profile series, glass build-up, hardware, handles, sill, colour'),
    ('Türsysteme und Konstruktionspakete',
     'Door systems and construction packages',
     'Türblatt, Oberfläche, Zarge, Beschläge, Zutrittstechnik, Hersteller',
     'Door leaf, finish, frame, hardware, access control, manufacturer'),
    ('Tragsystem Erdgeschoss, Balkonsystem, Dachnutzung und Begrünung',
     'Ground-floor structure, balcony system, roof use and greening',
     'Geländer und Beläge der Balkone, Pflanz- und Belagkonzept des Dachs, Systemhersteller',
     'Balcony railings and finishes, roof planting and paving concept, system manufacturer'),
    ('Treppen und Aufzugsschacht in Beton',
     'Stairs and lift shaft in concrete',
     'Oberflächen, Handläufe, Sichtbetonklasse',
     'Surfaces, handrails, exposed-concrete class'),
])


def kg300_building(p, b):
    """The nine system rows of ONE building. `b` is the building's truth as the
    generator knows it (mirrors src/fixtures/vr3-demo-projects.json) plus the
    positions the previous fixture carried for it."""
    bid, sfx = b['id'], b['sfx']
    scope = dict(scopeDe=b['scopeDe'], scopeEn=b['scopeEn'])
    origin = b['origin']
    per_building = dict(scopeDe='je Gebäude', scopeEn='per building')

    def sid(system, record):
        return f'{p}-300-{system}-{record}-{sfx}'

    def gid(system):
        return f'{p}-kg300-{system}-{sfx}'

    rows = []

    # ── D01 · Bodenplatte ────────────────────────────────────────────────
    f = b['foundation']
    d01 = tsvc(sid('slab', 'scope'), 'Bodenplatte im Leistungsumfang', 'Foundation slab in scope',
        'Gründung und Bodenplatte sind Teil des All3-Angebots.',
        'Foundation and slab are part of the All3 offer.', f['amount'],
        buildingId=bid, costAuthority='direct',
        source=src(*origin, f['valueDe'], f['valueEn']),
        whyDe=('Gründung und Bodenplatte liegen je Gebäude im oder außerhalb des All3-Umfangs. '
               'Ein Ausschluss ist nie 0 € und wird erst mit bestätigter Verantwortung „bauseits“.'),
        whyEn=('Foundation and slab are inside or outside the All3 scope per building. An '
               'exclusion is never 0 € and becomes “by client” only once responsibility is confirmed.'),
        offerNoteDe=('Bodenplatte im All3-Leistungsumfang. Bei Ausschluss: Bodenplatte nicht '
                     'Bestandteil des All3-Angebots; Ausführung durch Auftraggeber / gesondert zu klären.'),
        offerNoteEn=('Foundation slab included in the All3 scope. If excluded: foundation slab not '
                     'part of the All3 offer; execution by the client / to be clarified separately.'),
        **per_building, **INCLUDE_LABELS)
    rows.append(system(gid('slab'), 'Bodenplatte', 'Foundation slab', [d01],
        summaryDe=f"{f['valueDe']} · im All3-Leistungsumfang",
        summaryEn=f"{f['valueEn']} · included in All3 scope",
        visual='slab', buildingId=bid, costAuthority='direct', **scope))

    # ── D02 · Untergeschoss ──────────────────────────────────────────────
    has_ug = b['ug'] in ('partial', 'full')
    ug = b.get('ugPosition')
    fit_out = (tvar('UG_FIT_OUT_ONLY', 'Nur Ausbau · Rohbau ausgeschlossen',
                    'Fit-out only · structural shell excluded', b['ugFitOutDelta'],
                    detail_de='Leistungsbeginn ab OK Decke über UG',
                    detail_en='scope starts at the top of the slab above the basement')
               if b.get('ugFitOutDelta') is not None else
               tvar('UG_FIT_OUT_ONLY', 'Nur Ausbau · Rohbau ausgeschlossen',
                    'Fit-out only · structural shell excluded', no_price_basis=True,
                    detail_de='Leistungsbeginn ab OK Decke über UG',
                    detail_en='scope starts at the top of the slab above the basement'))
    ug_variants = [
        tvar('UG_FULL', 'Rohbau und Ausbau', 'Structural works and fit-out', 0,
             detail_de='Erdarbeiten, Rohbau, Abdichtung und Ausbau durch All3',
             detail_en='excavation, shell, waterproofing and fit-out by All3'),
        fit_out,
        tvar('UG_EXCLUDED', 'Nicht im All3-Leistungsumfang', 'Not included in All3 scope',
             excludes_position=True, cost_authority='noBasis',
             detail_de='Untergeschoss bleibt Gebäudebestand · Verantwortung offen',
             detail_en='basement remains part of the building · responsibility open'),
    ]
    na_ug = na(UG_CONDITION['reasonDe'], UG_CONDITION['reasonEn'])
    d02 = tchoice(sid('basement', 'scope'), 'Leistungsumfang Untergeschoss', 'Basement scope',
        ('Physisches Untergeschoss aus der Gebäudegrundlage; entschieden wird der kommerzielle '
         'Umfang von All3.'),
        ('Physical basement from the building baseline; the decision is the commercial scope '
         'of All3.'),
        ug_variants, 'UG_FULL', amount=(ug['amount'] if ug else 0),
        buildingId=bid, appliesWhen=UG_CONDITION,
        costAuthority=('direct' if ug else 'none'),
        authority=('sourceEvidenced' if ug else 'derived'),
        # parameters-t0-t1.json NEU.03 declares `ab_decke_ug` as the All3
        # default — a documented standard, not one this fixture crowns.
        # No `all3Standard` here: the T0 calculation default (NEU.03) is a
        # rate key, not a standard the approved catalogue declares, and the
        # dictionary forbids crowning one (VR3-KG-UNIFY-00 review).
        source=(src(*origin, ug['valueDe'], ug['valueEn'], 'UG_FULL') if ug
                else src(*origin, 'kein Untergeschoss', 'no basement')),
        whyDe=('Enthalten bei „nur Ausbau“: nichttragende Wände, Estrich und Ausbauoberflächen, '
               'Innentüren, ausbauseitige Brand- und Schallschutzabschlüsse. Ausgeschlossen: '
               'Erdarbeiten, Gründung, tragender Rohbau, Abdichtung, Fassade und äußere Öffnungen — '
               'der Auftraggeber übergibt einen tragfähigen, dichten Rohbau. TGA im UG folgt den '
               'eigenen Systemgrenzen der KG 400.'),
        whyEn=('Included with “fit-out only”: non-loadbearing partitions, screed and finish families, '
               'internal doors, fit-out-side fire and acoustic closures. Excluded: excavation, '
               'foundations, loadbearing shell, waterproofing, façade and external openings — the '
               'client hands over a structurally complete, watertight shell. Basement services follow '
               'the KG 400 system boundaries.'),
        offerNoteDe=FIT_OUT_ONLY_OFFER_DE, offerNoteEn=FIT_OUT_ONLY_OFFER_EN,
        **per_building,
        **({} if has_ug else {'applicability': na_ug}))
    rows.append(system(gid('basement'), 'Untergeschoss', 'Basement', [d02],
        summaryDe=(f"{ug['valueDe']} · Rohbau und Ausbau durch All3" if ug
                   else 'Gebäude ohne Untergeschoss'),
        summaryEn=(f"{ug['valueEn']} · structural works and fit-out by All3" if ug
                   else 'building has no basement'),
        visual='basement', buildingId=bid, appliesWhen=UG_CONDITION,
        costAuthority=('direct' if ug else 'none'),
        governedBy=d02['id'],
        byVariant={
            'UG_FIT_OUT_ONLY': {
                'summaryDe': 'Nur Ausbau durch All3 · Rohbau ausgeschlossen',
                'summaryEn': 'Fit-out only by All3 · structural shell excluded'},
            'UG_EXCLUDED': {
                'summaryDe': 'Untergeschoss nicht im All3-Leistungsumfang · Verantwortung offen',
                'summaryEn': 'Basement not included in All3 scope · responsibility open'},
        },
        **scope, **({} if has_ug else {'applicability': na_ug})))

    # ── D03 · Tragsystem Erdgeschoss ─────────────────────────────────────
    st = b['structure']
    d03 = tchoice(sid('frame', 'system'), 'Tragsystem Erdgeschoss', 'Ground-floor structural system',
        'Tragwerkspaket des Gebäudes; die Erdgeschoss-Entscheidung legt das System fest.',
        'The building’s structural package; the ground-floor decision fixes the system.',
        [tvar('GF_CONCRETE', 'Betontragwerk', 'Concrete structure', 0,
              detail_de='massive Decken/Wände nach Tragwerkskonzept',
              detail_en='solid slabs/walls to structural concept'),
         tvar('GF_TIMBER', 'Holztragwerk', 'Timber structure', no_price_basis=True,
              detail_de='Holz- bzw. Holz-Hybridtragwerk nach Tragwerkskonzept',
              detail_en='timber or timber-hybrid structure to structural concept')],
        'GF_CONCRETE', amount=st['amount'], buildingId=bid,
        costAuthority='direct', authority='sourceEvidenced',
        source=src(*origin, st['valueDe'], st['valueEn'], 'GF_CONCRETE'),
        whyDe=('Das Tragsystem bestimmt Fassaden-, Brandschutz-, Schall- und Installationsdetails '
               'über Fachregeln, nicht über die Oberfläche.'),
        whyEn=('The structural system constrains façade, fire, acoustic and installation details '
               'through domain rules, not through the interface.'),
        offerNoteDe='Tragsystem Erdgeschoss: Betontragwerk bzw. Holztragwerk gemäß Tragwerkskonzept.',
        offerNoteEn='Ground-floor structural system: concrete or timber structure to the structural concept.',
        **per_building)
    rows.append(system(gid('frame'), 'Tragsystem Erdgeschoss', 'Ground-floor structure', [d03],
        summaryDe=f"Betontragwerk · {st['valueDe']}",
        summaryEn=f"Concrete structure · {st['valueEn']}",
        visual='frame', buildingId=bid, costAuthority='direct',
        governedBy=d03['id'],
        byVariant={'GF_TIMBER': {
            'summaryDe': 'Holztragwerk · Holz- bzw. Holz-Hybridtragwerk nach Tragwerkskonzept',
            'summaryEn': 'Timber structure · timber or timber-hybrid structure to structural concept'}},
        **scope))

    # ── D04 + D05 · Balkone ──────────────────────────────────────────────
    bal = b['balcony']
    d04 = tsvc(sid('balcony', 'scope'), 'Balkone im Leistungsumfang', 'Balconies in scope',
        bal['summaryDe'], bal['summaryEn'], bal['amount'],
        baseline='notSelected', requiresDecision=True, authority='assumed',
        buildingId=bid, costAuthority=('direct' if bal['amount'] else 'noBasis'),
        source=src(*origin, bal['valueDe'], bal['valueEn']),
        whyDe=('Ein Ausschluss setzt das Tragsystem der Balkone aus, löscht es aber nicht; er ist '
               'nie 0 € und erst mit bestätigter Verantwortung „bauseits“.'),
        whyEn=('Exclusion suspends the balcony support system without erasing it; it is never '
               '0 € and becomes “by client” only once responsibility is confirmed.'),
        offerNoteDe=('Balkone im All3-Leistungsumfang. Bei Ausschluss wird die Position im Angebot '
                     'als Bedingung benannt, nicht als Betrag.'),
        offerNoteEn=('Balconies included in the All3 scope. If excluded, the offer states the '
                     'position as a condition, not as an amount.'),
        # Where the documents DO carry a balcony position the decision is
        # priced (Haus A, 240.000 EUR) and needs no condition. Where they do
        # not, including balconies is a required decision with no price
        # basis whatever — and the reason is exactly the one the source line
        # already states, so it is declared rather than left to be inferred
        # from a missing number.
        pricingConditionDe=(None if bal['amount'] else
                            'keine Balkonposition in den Unterlagen · '
                            'Menge und Ausführung noch nicht erfasst'),
        pricingConditionEn=(None if bal['amount'] else
                            'no balcony position in the documents · '
                            'quantity and execution not yet captured'),
        **per_building, **INCLUDE_LABELS)
    d05 = tchoice(sid('balcony', 'support'), 'Tragsystem Balkone', 'Balcony support system',
        'Lastabtrag der Balkone; nur entscheidbar, solange Balkone im Umfang sind.',
        'Load path of the balconies; decidable only while balconies are in scope.',
        [tvar('BAL_COLUMNS', 'Stützengetragene Balkone', 'Column-supported balconies',
              no_price_basis=True,
              detail_de='Lasten über Stützen vor der Fassade',
              detail_en='loads via columns in front of the façade'),
         tvar('BAL_DIAGONAL', 'Diagonal abgestützte Balkone', 'Diagonally braced balconies',
              no_price_basis=True,
              detail_de='Lasten über Diagonalen in die Fassade',
              detail_en='loads via diagonals into the façade'),
         tvar('BAL_CANTILEVER', 'Auskragende Balkone', 'Cantilevered balconies',
              no_price_basis=True,
              detail_de='Lasten über die Decke, thermisch entkoppelt',
              detail_en='loads via the slab, thermally decoupled')],
        'BAL_COLUMNS', buildingId=bid, costAuthority='noBasis',
        # A REQUIRED answer once balconies are in scope (dependency graph:
        # "included → support decision required"): including balconies opens
        # the support question and moves focus to it, instead of silently
        # crowning the first system. Suspended while balconies are out.
        requiresDecision=True,
        dependsOn={'serviceId': d04['id'], 'requiresSelected': True},
        source=src(*origin),
        whyDe=('Ein wesentlicher Kostentreiber — ohne freigegebenen systemspezifischen '
               'Tragwerkskoeffizienten gibt es keine gesonderte Preisgrundlage.'),
        whyEn=('A material cost driver — without an approved system-specific structural '
               'coefficient there is no separate price basis.'),
        # BLOCKED PRICING, declared rather than implied.
        #
        # This decision is a material cost driver whose own `whyDe` says so,
        # and all three alternatives carry `noPriceBasis`. Until this field
        # existed the option cards rendered `keine Preiswirkung` — a claim
        # that choosing between a column, a diagonal and a cantilever does
        # not move the price. It does; the product has no released
        # coefficient for it. The CONDITION is the difference between those
        # two statements, so it is named here and printed on the decision.
        #
        # The dormant `balkonTyp` rates in `derived-prototype.json`
        # (diagonal 0 / stuetzen +140 / konsole +330 EUR/m2 BGF_S) cannot be
        # adopted: their baseline is `diagonal` while this decision's is
        # `BAL_COLUMNS` (re-basing would derive a new coefficient), there is
        # no `konsole` alternative here and no `BAL_CANTILEVER` rate there,
        # and their `BGF_S` denominator is DIN 277 special-purpose floor
        # area, which decision D-26 explicitly forbade using as balcony
        # area. Naming the condition is the honest state; a re-based rate
        # would be an invented one.
        pricingConditionDe='systemspezifischer Tragwerkskoeffizient noch nicht freigegeben',
        pricingConditionEn='system-specific structural coefficient not yet approved',
        offerNoteDe='Balkone als stützengetragene, diagonal abgestützte oder auskragende Balkone gemäß Tragwerkskonzept.',
        offerNoteEn='Balconies as column-supported, diagonally braced or cantilevered balconies to the structural concept.',
        **per_building)
    rows.append(system(gid('balcony'), 'Balkone', 'Balconies', [d04, d05],
        summaryDe=bal['rowDe'], summaryEn=bal['rowEn'],
        visual='balcony', buildingId=bid,
        costAuthority=('direct' if bal['amount'] else 'noBasis'), **scope))

    # ── D06 + D07 + D08 · Fassade ────────────────────────────────────────
    fa = b['facade']
    comp_variants = [
        tvar(v, de, en, 0) if v == fa['baseline']
        else tvar(v, de, en, no_price_basis=True)
        for v, de, en in FACADE_COMPOSITIONS]
    d06 = tchoice(sid('facade', 'composition'), 'Fassadenaufbau', 'Façade composition',
        'Bestimmt die aktiven Materialzonen und damit Farbwelt und Materialausdruck.',
        'Determines the active material zones and with them colour and texture families.',
        comp_variants, fa['baseline'], amount=fa['amount'], buildingId=bid,
        costAuthority='direct',
        authority=('sourceEvidenced' if fa.get('variant') else 'assumed'),
        source=src(*origin, fa['valueDe'], fa['valueEn'], fa.get('variant')),
        whyDe=('Der Aufbau bestimmt die aktiven Materialzonen, die zulässigen Farb- und '
               'Materialfamilien und die Einbauschnittstelle der Fenster. Nur die dokumentierte '
               'Zusammensetzung ist bepreist; jede andere hat bis zur Kalibrierung keine Preisgrundlage.'),
        whyEn=('The composition determines the active material zones, the admissible colour and '
               'texture families and the window installation interface. Only the documented '
               'composition is priced; every other one has no price basis until calibrated.'),
        offerNoteDe=('Fassadenaufbau wie gewählt; Farbwelt und Materialausdruck als Familie, das '
                     'exakte Produkt folgt in der Bemusterung.'),
        offerNoteEn=('Façade composition as chosen; colour and texture as a family, the exact '
                     'product follows in the specification stage.'),
        **per_building,
        **({'costBasisDe': fa['costBasis'][0], 'costBasisEn': fa['costBasis'][1]}
           if fa.get('costBasis') else {}))
    zone_services = []
    for families, kind_de, kind_en, offer_de, offer_en, record in (
        (COLOUR_FAMILIES, 'Farbfamilie', 'colour family',
         ('Farbfamilie im vorläufigen Angebot; Hersteller, exakter RAL-/NCS-Ton sowie Stein- und '
          'Beschichtungscode folgen in der Bemusterung.'),
         ('Colour family in the preliminary offer; manufacturer, exact RAL/NCS shade, brick and '
          'coating code follow in the specification stage.'), 'colour'),
        (TEXTURE_FAMILIES, 'Materialfamilie', 'texture family',
         ('Materialfamilie im Angebot; Brettprofil, Putzkörnung, Verband, Stein/Produkt und Fuge '
          'folgen in der Bemusterung.'),
         ('Texture family in the offer; board profile, render grain, bond, brick/product and '
          'joint follow in the specification stage.'), 'texture'),
    ):
        for zone in ('timber', 'render', 'clinker'):
            de, en, values = families[zone]
            zone_services.append(tchoice(sid('facade', f'{record}-{zone}'), de, en,
                f'{kind_de} der Materialzone; aktiv nur unter einem Aufbau mit dieser Zone.',
                f'The zone’s {kind_en}; live only under a composition that has this zone.',
                [tvar(v, vde, ven, no_price_basis=True) for v, vde, ven in values],
                values[0][0], buildingId=bid, costAuthority='noBasis',
                dependsOn={'serviceId': d06['id'], 'requiresVariantIn': FACADE_ZONES[zone]},
                source=src(*origin),
                offerNoteDe=offer_de, offerNoteEn=offer_en,
                whyDe='Keine gesonderte Preisgrundlage, solange kein freigegebener Zuschlag der Familie existiert.',
                whyEn='No separate price basis until an approved surcharge for the family exists.',
                **per_building))
    rows.append(system(gid('facade'), 'Fassade', 'Façade', [d06, *zone_services],
        summaryDe=f"{fa['rowDe']} · Farbwelt und Materialausdruck als Familie",
        summaryEn=f"{fa['rowEn']} · colour and texture as a family",
        visual='facade', buildingId=bid, costAuthority='direct',
        governedBy=d06['id'],
        byVariant={v: {'summaryDe': f'{de} · Farbwelt und Materialausdruck als Familie',
                       'summaryEn': f'{en} · colour and texture as a family'}
                   for v, de, en in FACADE_COMPOSITIONS if v != fa['baseline']},
        **scope))

    # ── D09 + D10 + derived · Dach ───────────────────────────────────────
    rf = b['roof']
    d09 = tchoice(sid('roof', 'use'), 'Nutzung des Dachs', 'Roof access and use',
        'Planmäßige regelmäßige Nutzung oder nur Wartungszugang.',
        'Planned regular occupancy or maintenance access only.',
        [tvar('ROOF_OCCUPIED', 'Regelmäßig begehbar / nutzbar', 'Regularly accessible / occupied',
              no_price_basis=True,
              detail_de='Verkehrslasten, Beläge und Absturzsicherung werden abgeleitet',
              detail_en='traffic loads, surfaces and guarding are derived'),
         tvar('ROOF_MAINTENANCE', 'Nur Wartungszugang', 'Maintenance access only',
              no_price_basis=True,
              detail_de='sicherer Wartungszugang · keine planmäßige Nutzung',
              detail_en='safe maintenance access · no planned occupancy')],
        rf['use'], buildingId=bid, costAuthority='indirect',
        authority=('sourceEvidenced' if rf.get('useVariant') else 'assumed'),
        source=(src(*origin, rf['valueDe'], rf['valueEn'], rf['useVariant']) if rf.get('useVariant')
                else src(*origin)),
        whyDe=('Nicht die Frage, ob ein Techniker hinaufkommt — jedes Dach braucht sicheren '
               'Wartungszugang. Entschieden wird die planmäßige regelmäßige Nutzung; sie wirkt '
               'auf Lasten, Beläge und Absturzsicherung, ohne eigenen Betrag.'),
        whyEn=('Not whether a technician can get there — every roof needs safe maintenance '
               'access. The decision is planned regular occupancy; it affects loads, surfaces and '
               'guarding without an amount of its own.'),
        offerNoteDe='Dach regelmäßig begehbar bzw. nur Wartungszugang, wie gewählt.',
        offerNoteEn='Roof regularly accessible or maintenance access only, as chosen.',
        **per_building)
    priced_roof = rf['amount'] > 0
    green_variants = [
        tvar('ROOF_GREEN', 'Begrüntes Dach', 'Green roof',
             **({} if (rf['greening'] == 'ROOF_GREEN' and priced_roof)
                else {'bundled': True} if (rf['greening'] == 'ROOF_GREEN')
                else {'no_price_basis': True})),
        tvar('ROOF_NON_GREEN', 'Nicht begrüntes Standarddach', 'Non-green standard roof',
             **({} if (rf['greening'] == 'ROOF_NON_GREEN' and priced_roof)
                else {'bundled': True} if (rf['greening'] == 'ROOF_NON_GREEN')
                else {'no_price_basis': True})),
    ]
    d10 = tchoice(sid('roof', 'greening'), 'Dachbegrünung', 'Roof greening',
        'Unabhängig von der Nutzung; alle vier Kombinationen sind mit Bedingungen gültig.',
        'Independent of the use; all four combinations are valid with conditions.',
        green_variants, rf['greening'], amount=rf['amount'], buildingId=bid,
        costAuthority=('direct' if priced_roof else 'bundle'),
        authority='sourceEvidenced',
        source=src(*origin, rf['valueDe'], rf['valueEn'], rf['greening']),
        whyDe=(('Die Dachposition ist direkt bepreist; die Alternative hat bis zur Kalibrierung '
                'keine gesonderte Preisgrundlage.') if priced_roof else
               ('Das Geld sitzt in der Position „Fassade & Dach“ des Fassadenaufbaus; die '
                'Begrünung wird dort mitgetragen und hat keinen eigenen Betrag.')),
        whyEn=(('The roof position is directly priced; the alternative has no separate price '
                'basis until calibrated.') if priced_roof else
               ('The money sits in the façade composition’s “Façade & roof” position; greening '
                'is carried there and has no amount of its own.')),
        offerNoteDe='Begrüntes bzw. nicht begrüntes Dach und Zugangsart im Angebot; Bepflanzung, Belag und System später.',
        offerNoteEn='Green or non-green roof and access mode in the offer; planting, paving and system later.',
        **per_building,
        **({} if priced_roof else {'costBasisDe': 'Fassade & Dach', 'costBasisEn': 'Façade & roof'}))
    roof_req = derived(sid('roof', 'requirements'), 'Anforderungen Dach', 'Roof requirements',
        'Folgt aus Nutzung und Begrünung; wird geprüft, nicht gewählt.',
        'Follows from use and greening; verified, not chosen.',
        [d09['id'], d10['id']], ROOF_MATRIX,
        'folgt aus Nutzung und Begrünung', 'follows from use and greening',
        buildingId=bid, costAuthority='indirect',
        whyDe='Tragwerkslast, Entwässerung und Absturzsicherung folgen aus Nutzung und Begrünung.',
        whyEn='Structural load, drainage and fall protection follow from use and greening.',
        **per_building)
    roof_services = [d09, d10, *b.get('roofExtra', []), roof_req]
    rows.append(system(gid('roof'), 'Dach', 'Roof', roof_services,
        summaryDe=rf['rowDe'], summaryEn=rf['rowEn'],
        visual='roof', buildingId=bid,
        costAuthority=('direct' if priced_roof else 'bundle'), **scope))

    # ── D11 + D12 · Treppen & Aufzugsschacht ─────────────────────────────
    concrete = src('Gebäudebasis · All3-Produktstandard', 'Building baseline · All3 product standard',
                   'Beton · derzeit einzig verfügbares Tragsystem',
                   'Concrete · currently the only available structural system')
    d11 = tread(sid('stairs', 'construction'), 'Treppenkonstruktion', 'Stair construction',
        'Beton · derzeit einzig verfügbares Tragsystem.',
        'Concrete · currently the only available structural system.',
        buildingId=bid, costAuthority='bundle',
        costBasisDe='Tragwerkspaket', costBasisEn='Structural package',
        source=concrete,
        offerNoteDe='Treppen in Beton; Oberfläche und Handlauf folgen in der Bemusterung.',
        offerNoteEn='Stairs in concrete; surface and handrail follow in the specification stage.',
        **per_building)
    if b['lift']:
        d12 = tread(sid('stairs', 'lift-shaft'), 'Aufzugsschacht', 'Lift shaft',
            'Beton · derzeit einzig verfügbares Tragsystem.',
            'Concrete · currently the only available structural system.',
            buildingId=bid, costAuthority='bundle',
            costBasisDe='Tragwerkspaket', costBasisEn='Structural package',
            source=concrete,
            whyDe='Die Aufzugsanlage selbst wird in KG 400 entschieden; hier steht nur der Schacht.',
            whyEn='The lift equipment itself is decided in KG 400; only the shaft is stated here.',
            **per_building)
        stairs_summary = ('Treppen und Aufzugsschacht in Beton · im Tragwerkspaket',
                          'Stairs and lift shaft in concrete · in the structural package')
    else:
        d12 = tread(sid('stairs', 'lift-shaft'), 'Aufzugsschacht', 'Lift shaft',
            'Entsteht, sobald das Gebäude einen Aufzug erhält.',
            'Appears once the building has a lift.',
            buildingId=bid, costAuthority='none',
            applicability=na('kein Aufzug im Gebäude', 'no lift in the building'),
            source=src('KG 400 · Aufzüge & Sonderanlagen', 'KG 400 · Lifts & special systems',
                       'kein Aufzug', 'no lift'),
            **per_building)
        stairs_summary = ('Treppen in Beton · kein Aufzugsschacht · im Tragwerkspaket',
                          'Stairs in concrete · no lift shaft · in the structural package')
    rows.append(system(gid('stairs'), 'Treppen & Aufzugsschacht', 'Stairs & lift shaft', [d11, d12],
        summaryDe=stairs_summary[0], summaryEn=stairs_summary[1],
        visual='stairs', buildingId=bid, costAuthority='bundle', **scope))

    # ── D13 – D16 · Fenster ──────────────────────────────────────────────
    win_origin = (f"{origin[0]} · Fensterkonzept nicht spezifiziert",
                  f"{origin[1]} · window concept not specified")
    frames = [
        ('WIN_PVC', 'Kunststoff', 'PVC', 'Mehrkammerprofil, wartungsarm',
         'multi-chamber profile, low maintenance'),
        ('WIN_TIMBER', 'Holz', 'Timber', 'Holzprofil innen und außen',
         'timber profile inside and out'),
        ('WIN_TIMBER_ALU', 'Holz-Aluminium', 'Timber-aluminium',
         'Holz innen, Aluminium-Deckschale außen', 'timber inside, aluminium cladding outside'),
        ('WIN_ALU', 'Aluminium', 'Aluminium', 'thermisch getrenntes Aluminiumprofil',
         'thermally broken aluminium profile'),
    ]
    d13 = tchoice(sid('window', 'frame'), 'Fenster-Rahmensystem', 'Window frame system',
        'Rahmenfamilie; Hersteller, Profil und Beschlag folgen in der Bemusterung.',
        'Frame family; manufacturer, profile and hardware follow in the specification stage.',
        [tvar(v, de, en, no_price_basis=True, detail_de=dde, detail_en=den)
         for v, de, en, dde, den in frames],
        b['windowFrame'], buildingId=bid, costAuthority='noBasis',
        source=src(*win_origin),
        whyDe=('Rahmensystem, Elementgröße und Fassadenschnittstelle werden fachlich geprüft; bis '
               'zur All3-Kalibrierung keine gesonderte Preisgrundlage.'),
        whyEn=('Frame system, element size and façade interface are domain-validated; no separate '
               'price basis until All3 calibration.'),
        offerNoteDe='Rahmenfamilie im Angebot; Hersteller, Profil, Farbe, Fensterbank und Beschlag später.',
        offerNoteEn='Frame family in the offer; manufacturer, profile, colour, sill and hardware later.',
        **per_building)
    d14 = tchoice(sid('window', 'format'), 'Fensterformat', 'Window format package',
        'Formatpaket; exakte Maße bleiben Planungsdaten.',
        'Format package; exact dimensions remain planning data.',
        [tvar('WIN_STANDARD_FORMAT', 'Überwiegend Standardformate', 'Predominantly standard formats',
              no_price_basis=True,
              detail_de='Lochfenster in Regelgrößen', detail_en='punched windows in standard sizes'),
         tvar('WIN_LARGE_FORMAT', 'Erhöhter Anteil bodentiefer / großformatiger Elemente',
              'Increased share of floor-to-ceiling / large-format elements',
              no_price_basis=True,
              detail_de='Absturzsicherung, Statik und Einbau werden geprüft',
              detail_en='fall protection, structure and installation are checked')],
        'WIN_STANDARD_FORMAT', buildingId=bid, costAuthority='noBasis',
        source=src(*win_origin),
        whyDe='Großformate lösen Statik-, Absturz-, Einbau- und Fassadenprüfungen aus.',
        whyEn='Large formats trigger structural, fall-protection, installation and façade checks.',
        offerNoteDe='Formatpaket im Angebot; Maße, Teilungen und Flügelschema später.',
        offerNoteEn='Format package in the offer; dimensions, divisions and sash schedule later.',
        **per_building)
    d15 = tchoice(sid('window', 'opening'), 'Öffnungsanteil Fenster', 'Operable window share',
        'Anteil öffenbarer Elemente; Dreh-Kipp/fest/Schiebe wird später abgeleitet.',
        'Share of operable elements; tilt-turn/fixed/sliding is derived later.',
        [tvar('WIN_OPENING_STANDARD', 'Standard-Öffnungsanteil', 'Standard operable share',
              no_price_basis=True,
              detail_de='Dreh-Kipp-Anteil nach Lüftungskonzept',
              detail_en='tilt-turn share to the ventilation concept'),
         tvar('WIN_OPENING_INCREASED', 'Erhöhter Öffnungsanteil', 'Increased operable share',
              no_price_basis=True,
              detail_de='mehr öffenbare Elemente · Schnittstelle Lüftung KG 400',
              detail_en='more operable elements · interface with KG 400 ventilation')],
        'WIN_OPENING_STANDARD', buildingId=bid, costAuthority='noBasis',
        source=src(*win_origin),
        whyDe='Darf dem Lüftungskonzept der KG 400 nicht widersprechen; die KG 400 wird hier nie beschrieben.',
        whyEn='Must not conflict with the KG 400 ventilation concept; KG 400 is never written here.',
        offerNoteDe='Öffnungspaket im Angebot; Flügelbild und Beschlag später.',
        offerNoteEn='Opening package in the offer; sash pattern and hardware later.',
        **per_building)
    d16 = derived(sid('window', 'requirements'), 'Anforderungen Fenster', 'Window requirements',
        'Wärme-, Schall-, Sicherheits-, Brand- und Absturzanforderungen aus Projektautorität.',
        'Thermal, acoustic, security, fire and fall-protection requirements from project authority.',
        [d14['id'], d15['id']], WINDOW_MATRIX,
        'folgt aus Format und Öffnungsanteil', 'follows from format and operable share',
        buildingId=bid, costAuthority='indirect',
        whyDe=('Die Anforderungen folgen aus Energieziel, Lärmquelle, Risiko, Brandschutzkonzept und '
               'Gebäudeprogramm. Der außenliegende Sonnenschutz gehört dem sommerlichen Komfort in '
               'KG 400 und wird hier nur gelesen, nie ein zweites Mal entschieden.'),
        whyEn=('Requirements follow from the energy target, noise source, risk, fire concept and '
               'building programme. External shading belongs to summer comfort in KG 400 and is '
               'read here, never decided a second time.'),
        **per_building)
    frame_label = {v: (de, en) for v, de, en, _, _ in frames}[b['windowFrame']]
    rows.append(system(gid('window'), 'Fenster', 'Windows', [d13, d14, d15, d16],
        summaryDe=f'{frame_label[0]} · Standardformate · Standard-Öffnungsanteil',
        summaryEn=f'{frame_label[1]} · standard formats · standard operable share',
        visual='window', buildingId=bid, costAuthority='noBasis',
        governedBy=d13['id'],
        byVariant={v: {'summaryDe': f'{de} · Standardformate · Standard-Öffnungsanteil',
                       'summaryEn': f'{en} · standard formats · standard operable share'}
                   for v, de, en, _, _ in frames if v != b['windowFrame']},
        **scope))

    # ── D17 – D20 · Türen ────────────────────────────────────────────────
    door_origin = (f"{origin[0]} · Türkonzept nicht spezifiziert",
                   f"{origin[1]} · door concept not specified")
    d17 = tchoice(sid('door', 'entrance'), 'Hauseingangstür-System', 'Building entrance door system',
        'System des gemeinsamen Hauseingangs; Türblatt und Zutrittstechnik später.',
        'System of the common entrance; leaf design and access control later.',
        [tvar('DOOR_ALU_GLAZED', 'Aluminium · verglast', 'Aluminium · glazed', no_price_basis=True,
              detail_de='Sicherheitsverglasung nach Anforderungsprofil',
              detail_en='safety glazing to the requirement profile'),
         tvar('DOOR_ALU_OPAQUE', 'Aluminium · geschlossen', 'Aluminium · opaque', no_price_basis=True,
              detail_de='geschlossenes Türblatt, Aluminiumrahmen',
              detail_en='opaque leaf, aluminium frame'),
         tvar('DOOR_TIMBER_OPAQUE', 'Holz / Holz-Aluminium · geschlossen',
              'Timber / timber-aluminium · opaque', no_price_basis=True,
              detail_de='geschlossenes Türblatt in Holz bzw. Holz-Aluminium',
              detail_en='opaque leaf in timber or timber-aluminium')],
        'DOOR_ALU_GLAZED', buildingId=bid, costAuthority='noBasis',
        source=src(*door_origin),
        whyDe='Das Anforderungsprofil steuert Verglasung, Wärme, Sicherheit, Barrierefreiheit und Antrieb.',
        whyEn='The requirement profile governs glazing, thermal, security, accessibility and operator.',
        offerNoteDe='System und verglast/geschlossen im Angebot; Türblatt, Hersteller, Farbe, Griff und Zutrittstechnik später.',
        offerNoteEn='System and glazed/opaque state in the offer; leaf, manufacturer, colour, handle and access control later.',
        **per_building)
    d18 = tchoice(sid('door', 'apartment'), 'Wohnungseingangstür-Paket', 'Apartment entrance door package',
        'Leistungspaket der Wohnungstüren; Brand-/Rauchschutz und Barrierefreiheit sind nie optional.',
        'Performance package of the apartment doors; fire/smoke and accessibility are never optional.',
        [tvar('ADOOR_STANDARD', 'Projektstandard · Anforderungen gemäß Konzept',
              'Project standard · requirements to project concept', no_price_basis=True),
         tvar('ADOOR_ENHANCED', 'Erhöhter Schall- und Einbruchschutz',
              'Enhanced acoustic and security performance', no_price_basis=True,
              detail_de='nur oberhalb, nie unterhalb der Konzeptanforderungen',
              detail_en='only above, never below the concept requirements')],
        'ADOOR_STANDARD', buildingId=bid, costAuthority='noBasis',
        source=src(*door_origin),
        whyDe='Ein erhöhtes Paket ist nur oberhalb der abgeleiteten Anforderungen wählbar.',
        whyEn='An enhanced package may be chosen only above the derived requirements.',
        offerNoteDe='Paket und Leistung im Angebot; Oberfläche, Furnier, Griff und Hersteller später.',
        offerNoteEn='Package and performance in the offer; finish, veneer, handle and manufacturer later.',
        **per_building,
        **({} if b['residential'] else {
            'applicability': na('keine Wohnnutzung im Gebäude', 'no residential use in the building')}))
    d19 = tchoice(sid('door', 'internal'), 'Innentür-Konstruktionspaket', 'Internal door construction package',
        'Konstruktionspaket; Anzahl und Sonder-/Funktionstüren kommen aus der Planung.',
        'Construction package; counts and special/functional doors come from planning.',
        [tvar('IDOOR_STANDARD', 'Standard-Holzwerkstofftür', 'Standard timber-based door',
              no_price_basis=True),
         tvar('IDOOR_ROBUST', 'Robuste Objekttür', 'Robust contract door', no_price_basis=True,
              detail_de='stoßfeste Kanten und Oberflächen für hohe Beanspruchung',
              detail_en='impact-resistant edges and surfaces for heavy use')],
        'IDOOR_STANDARD', buildingId=bid, costAuthority='noBasis',
        source=src(*door_origin),
        whyDe='Sonder- und Funktionstüren ersetzen einzelne Türen nach Anforderungsprofil, nicht nach Wahl.',
        whyEn='Special and functional doors replace individual doors per the requirement profile, not by choice.',
        offerNoteDe='Konstruktionspaket in KG 300; Oberfläche, Zarge, Griff und Hersteller in KG 600/Bemusterung.',
        offerNoteEn='Construction package in KG 300; finish, frame, handle and manufacturer in KG 600/specification.',
        **per_building)
    second = (d18, APARTMENT_REQ) if b['residential'] else (d19, INTERNAL_REQ)
    d20 = derived(sid('door', 'requirements'), 'Anforderungen Sonder- und Funktionstüren',
        'Special and functional door requirements',
        'Brand-, Rauch-, Schall-, RC-, Barrierefreiheits- und Antriebsanforderungen je Türkategorie.',
        'Fire, smoke, acoustic, RC, accessibility and operator requirements per door category.',
        [d17['id'], second[0]['id']],
        {f'{ev}|{sv}': (f'{ENTRANCE_REQ[ev][0]} · {second[1][sv][0]}',
                        f'{ENTRANCE_REQ[ev][1]} · {second[1][sv][1]}')
         for ev in ENTRANCE_REQ for sv in second[1]},
        'folgt aus Türsystemen und Nutzungskonzept', 'follows from door systems and use concept',
        buildingId=bid, costAuthority='indirect',
        whyDe=('Aus Brandschutz-, Schallschutz-, Barrierefreiheits-, Sicherheits- und Betriebskonzept '
               'abgeleitet; ein Antrieb erscheint nur, wenn er gefordert oder mit Autorität '
               'vorgeschlagen ist.'),
        whyEn=('Derived from the fire, acoustic, accessibility, security and operations concepts; an '
               'operator appears only when required or deliberately proposed with authority.'),
        **per_building)
    rows.append(system(gid('door'), 'Türen', 'Doors', [d17, d18, d19, d20],
        summaryDe=('Hauseingang Aluminium verglast · Wohnungstüren Projektstandard · Innentüren Standard'
                   if b['residential'] else
                   'Hauseingang Aluminium verglast · Innentüren Standard · keine Wohnungstüren'),
        summaryEn=('Aluminium glazed entrance · project-standard apartment doors · standard internal doors'
                   if b['residential'] else
                   'Aluminium glazed entrance · standard internal doors · no apartment doors'),
        visual='door', buildingId=bid, costAuthority='noBasis', **scope))

    rows.extend(b.get('extraRows', []))
    return rows


def attach_questions(chapters):
    """The Sales QUESTION each chapter answers, as its lede (`questionDe/En`)."""
    for ch in chapters:
        ch['questionDe'], ch['questionEn'] = KG_QUESTIONS[ch['group']]
    return chapters


KG_QUESTIONS = {
    'KG_200': ('Welche vorbereitenden Maßnahmen und Erschließungsleistungen bieten wir an?',
               'Which preparatory and enabling works are we offering?'),
    'KG_300': ('Welche Baukonstruktionslösung schlagen wir für diese Option vor?',
               'Which construction solution are we proposing for this Option?'),
    'KG_400': ('Welche technische Lösung schlagen wir für diese Option vor?',
               'Which engineering solution are we proposing for this Option?'),
    'KG_500': ('Welche Außenanlagen gehören zum Angebot?',
               'Which external works are part of the offer?'),
    'KG_600': ('Welche feste Ausstattung liefern wir mit?',
               'Which fixed equipment do we supply?'),
    'KG_700': ('Welche Planungs- und Nachweisleistungen enthält das Angebot?',
               'Which design and certification services does the offer include?'),
}

# ── PROJECT A · DEMO-HAPPY-01 · 6.480.000 EUR net, ±5 % ──────────────────
A = [
 chapter('KG_200', 'Vorbereitende Maßnahmen', 'Preparatory works',
   'Baustelle, Baufeldfreimachung und Hausanschlüsse für den Wohnhof.',
   'Site set-up, site clearance and utility connections for the courtyard.',
   # VR3-KG-UNIFY-00: the same four services, regrouped into SYSTEM ROWS per
   # kg-chapter-migration-map.md (Site setup · Site clearance & existing
   # structures · Connections & access). No ground-risk service exists for
   # the happy project, so that row is not emitted — never an empty row.
   [system('a-kg200-site', 'Baustelleneinrichtung', 'Site setup', [
     svc('a-200-01', 'Baustelleneinrichtung', 'Site set-up',
         'Einrichtung, Vorhaltung und Räumung der Baustelle.',
         'Set-up, provision and clearance of the construction site.', 68000),
   ],
     summaryDe='Einrichtung, Vorhaltung und Räumung der Baustelle im Paket',
     summaryEn='Set-up, provision and clearance of the site in the package',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='site', costAuthority='direct'),
    system('a-kg200-clearance', 'Baufeld & Bestand', 'Site clearance & existing structures', [
     quantity('a-200-02', 'Baufeldfreimachung & Rodung', 'Site clearance',
         'Oberboden abtragen, Bewuchs entfernen, Baufeld herstellen.',
         'Topsoil removal, vegetation clearance, site preparation.',
         20, 2200, 'm²', 'm²'),
     required('a-200-90', 'Rückbau Bestandsgebäude', 'Demolition of existing structure',
         'Auf dem Grundstück steht kein Bestand — die Position ist zu entscheiden, nicht anzunehmen.',
         'No existing structure on the plot — a decision, not an assumption.', 145000),
   ],
     summaryDe='2.200 m² Baufeldfreimachung · Rückbau Bestand zu entscheiden',
     summaryEn='2,200 m² site clearance · demolition of existing structure to decide',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='clearance', costAuthority='direct'),
    system('a-kg200-connections', 'Erschließung & Hausanschlüsse', 'Connections & access', [
     quantity('a-200-03', 'Hausanschlüsse Ver- und Entsorgung', 'Utility connections',
         'Strom, Wasser, Abwasser und Telekommunikation bis zur Gebäudekante.',
         'Power, water, sewage and telecoms up to the building edge.',
         17000, 4, 'Anschlüsse', 'connections'),
   ],
     summaryDe='4 Anschlüsse: Strom, Wasser, Abwasser und Telekommunikation',
     summaryEn='4 connections: power, water, sewage and telecoms',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='connections', costAuthority='direct'),
   ]),
 # VR3-KG-UNIFY-00: KG 300 rebuilt as the building-aware construction
 # configurator (see the KG 300 block above). The four former positions
 # (a-300-01 foundation 520.000 · a-300-02 structure 1.760.000 · a-300-03
 # façade 1.180.000 · a-300-04 roof 560.000) and the balcony decision
 # (a-300-90, 240.000, undecided) now live on D01/D03/D06/D10/D04 of
 # A-BLDG-01. KG 300 stays 4.020.000.
 kg300_chapter('Baukonstruktion', 'Building construction',
   'Gründung, Tragwerk, Fassade und Dach des Wohnhofs.',
   'Foundation, structure, facade and roof of the courtyard building.',
   kg300_building('a', dict(
     id='A-BLDG-01', sfx='b01',
     scopeDe='Lindenhof · gilt für 1 Gebäude', scopeEn='Lindenhof · applies to 1 building',
     origin=('Grundlage Gebäude · bestätigt', 'Building baseline · confirmed'),
     ug='none', residential=True,
     # KG 400 `a-400-30`: building height 11,4 m — below the lift requirement.
     lift=False,
     windowFrame='WIN_PVC',
     foundation=dict(amount=520000,
       valueDe='Flachgründung ohne Untergeschoss, Sohlplatte mit Randverstärkung',
       valueEn='Shallow foundation without basement, slab with edge reinforcement'),
     ugFitOutDelta=None,
     structure=dict(amount=1760000,
       valueDe='Stahlbeton-Decken und Mauerwerkswände, konventionell',
       valueEn='Reinforced-concrete slabs and masonry walls, conventional'),
     balcony=dict(amount=240000,
       summaryDe='Die Ansichten zeigen Balkone; der Umfang ist nicht bestätigt.',
       summaryEn='The elevations show balconies; the extent is not confirmed.',
       valueDe='Balkone in den Ansichten · Umfang nicht bestätigt',
       valueEn='Balconies in the elevations · extent not confirmed',
       rowDe='Balkone zu entscheiden · die Ansichten zeigen Balkone',
       rowEn='Balconies to decide · the elevations show balconies'),
     facade=dict(amount=1180000, baseline='FAC_FULL_RENDER', variant='FAC_FULL_RENDER',
       valueDe='Wärmedämmverbundsystem mit mineralischem Oberputz',
       valueEn='External insulation system with a mineral top coat',
       rowDe='Durchgehende Putzfassade', rowEn='Full rendered façade'),
     roof=dict(use='ROOF_MAINTENANCE', greening='ROOF_NON_GREEN', amount=560000,
       valueDe='Flachdach mit Abdichtung, Attika und Entwässerung',
       valueEn='Flat roof with waterproofing, parapet and drainage',
       rowDe='Flachdach nicht begrünt · nur Wartungszugang',
       rowEn='Non-green flat roof · maintenance access only'),
   )),
   KG300_BEMUSTERUNG),
 tga_chapter('KG_400', 'Technische Anlagen', 'Technical installations',
   'Wärme, Sanitär und Elektro für 18 Wohneinheiten.',
   'Heating, plumbing and electrical for 18 dwellings.',
   [
    # ── 1 · Wärme ────────────────────────────────────────────────────────
    system('a-kg400-heat', 'Wärme', 'Heat', [
      tchoice('a-400-01', 'Wärmeerzeuger', 'Heat generator',
        'Bestimmt die Warmwasserbereitung und die § 14a-Bewertung.',
        'Determines domestic hot water and the § 14a assessment.',
        [tvar('WE_LW_WP', 'Luft/Wasser-Wärmepumpe', 'Air-to-water heat pump', 0,
              detail_de='Außenluft als Wärmequelle · elektrisch',
              detail_en='outdoor air as heat source · electric'),
         tvar('WE_FW', 'Fernwärme-Übergabestation', 'District heating transfer station', -64000,
              detail_de='Anschluss an das Fernwärmenetz',
              detail_en='connection to the district-heating network'),
         tvar('WE_SW_WP', 'Sole/Wasser-Wärmepumpe (Erdsonde)', 'Brine-to-water (ground-source) heat pump',
              no_price_basis=True,
              detail_de='Erdwärme über Sonden',
              detail_en='ground heat via boreholes'),
         tvar('WE_GAS_BW', 'Gas-Brennwert in EE-Hybrid', 'Gas condensing in RE-hybrid',
              no_price_basis=True,
              detail_de='Gaskessel mit erneuerbarem Anteil',
              detail_en='gas boiler with a renewable share'),
         tvar('WE_BIOMASSE', 'Biomasse/Pellet-Kessel', 'Biomass/pellet boiler',
              no_price_basis=True,
              detail_de='Holzpellets als Brennstoff',
              detail_en='wood pellets as fuel')],
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
        [tvar('WL_ABLUFT_DACH', 'Zentrale Abluftanlage', 'Central extract-air system', 0,
              detail_de='Abluft über Dach · Nachströmung über Außenluftdurchlässe (ALD)',
              detail_en='extract over roof · supply through outdoor-air inlets (ALD)'),
         tvar('WL_DEZ_WRG', 'Dezentrale Lüftung mit Wärmerückgewinnung',
              'Decentralised ventilation with heat recovery', 132000,
              detail_de='raumweise Geräte in der Außenwand',
              detail_en='room-by-room units in the external wall'),
         tvar('WL_ZENTRAL_WRG', 'Zentrale Lüftung mit Wärmerückgewinnung',
              'Central ventilation with heat recovery', 132000,
              detail_de='Zentralgerät und Kanalnetz',
              detail_en='central unit and duct network'),
         tvar('WL_FENSTER', 'Freie/Fensterlüftung', 'Natural/window ventilation',
              no_price_basis=True,
              detail_de='nur bei nachgewiesener Zulässigkeit',
              detail_en='only where admissibility is demonstrated')],
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
      summaryDe='Zentrale Abluftanlage · ALD-Nachströmung',
      summaryEn='Central extract-air system · outdoor-air inlets (ALD)',
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
   ],
   [
    rahmen('energieziel', 'Energieziel', 'Energy target', '', '',
           'Förderziel · Annahme', 'Funding target · assumption', edit='a-400-es',
           basis_de=('Gesetzlicher Mindeststandard: GModG § 10 · Niedrigstenergiegebäude '
                     '· aus Bauantragsdatum abgeleitet'),
           basis_en=('Statutory minimum: GModG § 10 · nearly zero-energy building · '
                     'derived from the building-application date')),
    rahmen('gebaeudeumfang', 'Gebäudeumfang', 'Building scope', '', '', '', '',
           derive='buildingScope'),
    rahmen('quelle', 'Quelle', 'Source', '', '', '', '',
           derive='sourceDocuments'),
    # READ from the Option's responsibility owner, never authored here: the
    # band shows the boundary CONSEQUENCE and links to the step that owns it.
    rahmen('leistungsgrenze', 'Leistungsgrenze', 'Scope boundary', '', '', '', '',
           derive='responsibility'),
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
   # VR3-KG-UNIFY-00: the same five services, regrouped into SYSTEM ROWS per
   # kg-chapter-migration-map.md (Access & hardscape · Landscape & play ·
   # Water & boundaries · Garage access). No amount, kind or id changed.
   [system('a-kg500-path', 'Wege & Platzflächen', 'Access & hardscape', [
     quantity('a-500-01', 'Wege & Platzflächen', 'Paths & paved areas',
         'Betonsteinpflaster, Zufahrt und Hauseingangsbereiche.',
         'Concrete-block paving, driveway and entrance areas.',
         320, 300, 'm²', 'm²'),
   ],
     summaryDe='300 m² Betonsteinpflaster, Zufahrt und Hauseingangsbereiche',
     summaryEn='300 m² concrete-block paving, driveway and entrance areas',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='path', costAuthority='direct'),
    system('a-kg500-planting', 'Bepflanzung & Spiel', 'Landscape & play', [
     quantity('a-500-02', 'Bepflanzung & Rasen', 'Planting & lawn',
         'Rasenflächen, Sträucher und vier Hofbäume.',
         'Lawn areas, shrubs and four courtyard trees.',
         100, 740, 'm²', 'm²'),
     quantity('a-500-03', 'Spielfläche', 'Play area',
         'Spielgeräte, Fallschutz und Einfassung nach DIN EN 1176.',
         'Play equipment, impact protection and edging to DIN EN 1176.',
         400, 145, 'm²', 'm²'),
   ],
     summaryDe='740 m² Rasen, Sträucher und vier Hofbäume · 145 m² Spielfläche',
     summaryEn='740 m² lawn, shrubs and four courtyard trees · 145 m² play area',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='planting', costAuthority='direct'),
    system('a-kg500-water', 'Einfriedung & Regenwasser', 'Water & boundaries', [
     svc('a-500-04', 'Einfriedung & Müllstandplatz', 'Enclosure & refuse area',
         'Grundstückseinfriedung und überdachter Müllstandplatz.',
         'Site enclosure and a roofed refuse area.', 72000),
   ],
     summaryDe='Grundstückseinfriedung und überdachter Müllstandplatz',
     summaryEn='Site enclosure and a roofed refuse area',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='water', costAuthority='direct'),
    system('a-kg500-ramp', 'Tiefgaragenzufahrt', 'Garage access', [
     required('a-500-90', 'Tiefgaragenzufahrt', 'Underground garage ramp',
         'Der Wohnhof hat kein Untergeschoss — eine Zufahrt ist zu entscheiden.',
         'The courtyard has no basement — a ramp is a decision.', 210000),
   ],
     summaryDe='Zufahrt zu entscheiden · der Wohnhof hat kein Untergeschoss',
     summaryEn='Ramp to decide · the courtyard has no basement',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='ramp', costAuthority='direct'),
   ]),
 chapter('KG_600', 'Ausstattung', 'Fixtures & equipment',
   'Feste Ausstattung der Gemeinschaftsflächen.',
   'Fixed equipment for the shared areas.',
   # VR3-KG-UNIFY-00: the same four services, regrouped into SYSTEM ROWS per
   # kg-chapter-migration-map.md (Building equipment · Shared-use equipment ·
   # Wayfinding & art). No amount, kind or id changed.
   [system('a-kg600-mailbox', 'Gebäudeausstattung', 'Building equipment', [
     svc('a-600-01', 'Briefkastenanlage', 'Letterbox installation',
         'Freistehende Anlage für 18 Wohneinheiten mit Paketfach.',
         'Free-standing installation for 18 dwellings with a parcel box.', 26000),
   ],
     summaryDe='Briefkastenanlage für 18 Wohneinheiten mit Paketfach',
     summaryEn='Letterbox installation for 18 dwellings with a parcel box',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='mailbox', costAuthority='direct'),
    system('a-kg600-bicycle', 'Gemeinschaftsausstattung', 'Shared-use equipment', [
     quantity('a-600-02', 'Fahrradabstellanlage', 'Bicycle parking',
         'Überdachte Anlehnbügel im Hofbereich.',
         'Covered leaning racks in the courtyard.', 500, 84, 'Plätze', 'spaces'),
   ],
     summaryDe='84 überdachte Fahrradplätze im Hofbereich',
     summaryEn='84 covered bicycle spaces in the courtyard',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='bicycle', costAuthority='direct'),
    system('a-kg600-signage', 'Leitsystem & Kunst', 'Wayfinding & art', [
     svc('a-600-03', 'Beschilderung & Hausnummern', 'Signage & house numbers',
         'Orientierung, Klingeltableau-Beschriftung und Hausnummern.',
         'Wayfinding, doorbell labelling and house numbers.', 32000),
     required('a-600-90', 'Kunst am Bau', 'Public art',
         'Kein Programm verlangt sie; sie ist eine Entscheidung des Bauherrn.',
         'No programme requires it; it is the client’s decision.', 48000),
   ],
     summaryDe='Beschilderung und Hausnummern im Paket · Kunst am Bau zu entscheiden',
     summaryEn='Signage and house numbers in the package · public art to decide',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='signage', costAuthority='direct'),
   ]),
 chapter('KG_700', 'Baunebenkosten', 'Ancillary costs',
   'Planung, Beratung und Nachweise.',
   'Design, consultancy and certification.',
   # VR3-KG-UNIFY-00: the same seven services, regrouped into SYSTEM ROWS per
   # kg-chapter-migration-map.md (Design team · Surveys & concepts ·
   # Certification & quality). Internal-only visibility, amounts and
   # dependency rules unchanged.
   [system('a-kg700-plans', 'Planungsteam', 'Design team', [
     svc('a-700-01', 'Objektplanung', 'Architectural design',
         'Leistungsphasen 1 bis 8 nach HOAI, Honorarzone III.',
         'HOAI work stages 1 to 8, fee zone III.', 268000),
     svc('a-700-02', 'Tragwerksplanung', 'Structural design',
         'Standsicherheitsnachweis und Ausführungsplanung.',
         'Structural verification and detailed design.', 84000),
     svc('a-700-03', 'TGA-Planung', 'Building services design',
         'Heizung, Sanitär, Elektro und Lüftung, integriert geplant.',
         'Heating, plumbing, electrical and ventilation, planned together.', 96000),
   ],
     summaryDe='Objekt-, Tragwerks- und TGA-Planung · Leistungsphasen 1 bis 8',
     summaryEn='Architectural, structural and services design · work stages 1 to 8',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='plans', costAuthority='direct'),
    system('a-kg700-survey', 'Gutachten & Konzepte', 'Surveys & concepts', [
     svc('a-700-04', 'Vermessung & Baugrundgutachten', 'Survey & soil report',
         'Lage- und Höhenaufnahme, Baugrunderkundung mit Bohrprofilen.',
         'Site and level survey, soil investigation with borehole logs.', 42000),
   ],
     summaryDe='Vermessung und Baugrundgutachten mit Bohrprofilen',
     summaryEn='Survey and soil report with borehole logs',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='survey', costAuthority='direct'),
    system('a-kg700-certificate', 'Nachweise & Qualität', 'Certification & quality', [
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
   ],
     summaryDe='kein QNG · keine DGNB-Zertifizierung · Qualitätssicherung zu entscheiden',
     summaryEn='no QNG · no DGNB certification · quality assurance to decide',
     scopeDe='gilt für den gesamten Wohnhof', scopeEn='applies to the whole courtyard',
     visual='certificate', costAuthority='direct'),
   ]),
]

A_DECLARED = {'KG_200': 180000, 'KG_300': 4020000, 'KG_400': 1390000,
              'KG_500': 300000, 'KG_600': 100000, 'KG_700': 490000}

# ── PROJECT B · DEMO-COMPLEX-01 · 38.740.000 EUR net, ±6 % ───────────────
BA, BB, BC = 'B-BLDG-A', 'B-BLDG-B', 'B-BLDG-C'

B = [
 chapter('KG_200', 'Vorbereitende Maßnahmen', 'Preparatory works',
   'Baustelle, Rückbau und Erschließung für das gesamte Quartier.',
   'Site set-up, demolition and connections for the whole quarter.',
   # VR3-KG-UNIFY-00: the same seven services, regrouped into SYSTEM ROWS per
   # kg-chapter-migration-map.md (Site setup · Site clearance & existing
   # structures · Connections & access · Ground risks). No amount, kind or id
   # changed.
   [system('b-kg200-site', 'Baustelleneinrichtung', 'Site setup', [
     svc('b-200-01', 'Baustelleneinrichtung Quartier', 'Quarter-wide site set-up',
         'Gemeinsame Einrichtung für drei Baukörper, Kran- und Lagerflächen.',
         'Shared set-up for three buildings, crane and storage areas.', 280000),
     quantity('b-200-05', 'Baustraße & Zufahrt', 'Site road & access',
         'Tragschicht und Verkehrsflächen während der Bauzeit.',
         'Base course and traffic areas during construction.',
         400, 250, 'm²', 'm²'),
   ],
     summaryDe='Gemeinsame Einrichtung für drei Baukörper · 250 m² Baustraße',
     summaryEn='Shared set-up for three buildings · 250 m² site road',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='site', costAuthority='direct'),
    system('b-kg200-clearance', 'Baufeld & Bestand', 'Site clearance & existing structures', [
     quantity('b-200-02', 'Baufeldfreimachung & Rodung', 'Site clearance',
         'Oberboden, Bewuchs und Restfundamente der Logistikfläche.',
         'Topsoil, vegetation and residual foundations of the logistics yard.',
         20, 9500, 'm²', 'm²'),
     svc('b-200-03', 'Rückbau Ladeplatte', 'Loading-slab demolition',
         'Provisorischer Ansatz: der Lageplan zeigt die Platte, der Auftrag schweigt (B-Q-05).',
         'Provisional allowance: the site plan shows the slab, the brief is silent (B-Q-05).',
         240000, authority='assumed'),
   ],
     summaryDe='9.500 m² Baufeldfreimachung · Rückbau Ladeplatte als provisorischer Ansatz (B-Q-05)',
     summaryEn='9,500 m² site clearance · loading-slab demolition as a provisional allowance (B-Q-05)',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='clearance', costAuthority='direct'),
    system('b-kg200-connections', 'Erschließung & Hausanschlüsse', 'Connections & access', [
     svc('b-200-04', 'Hausanschlüsse Ver- und Entsorgung', 'Utility connections',
         'Drei Hausanschlussräume, Fernwärmeübergabe und Löschwasser.',
         'Three service entry rooms, district-heat transfer and firefighting water.', 310000),
   ],
     summaryDe='Drei Hausanschlussräume, Fernwärmeübergabe und Löschwasser',
     summaryEn='Three service entry rooms, district-heat transfer and firefighting water',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='connections', costAuthority='direct'),
    system('b-kg200-ground', 'Baugrundrisiken', 'Ground risks', [
     required('b-200-90', 'Bodenaustausch & Entsorgung', 'Soil replacement & disposal',
         'Das Baugrundgutachten liegt noch nicht vor; der Umfang ist offen.',
         'The soil report is outstanding; the extent is open.', 380000),
     required('b-200-91', 'Kampfmittelsondierung', 'Ordnance survey',
         'Für den Standort nicht angeordnet, in Leipzig aber üblich.',
         'Not ordered for this site, but common in Leipzig.', 60000),
   ],
     summaryDe='Bodenaustausch und Kampfmittelsondierung zu entscheiden · Baugrundgutachten steht aus',
     summaryEn='Soil replacement and ordnance survey to decide · soil report outstanding',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='ground', costAuthority='direct'),
   ]),
 # VR3-KG-UNIFY-00: KG 300 rebuilt as the building-aware construction
 # configurator (see the KG 300 block above). Every former position keeps its
 # euro on the record that owns it: foundations b-300-01/02/03 → D01,
 # basements b-300-04/05 → D02, structures b-300-06/07/08 → D03, façade & roof
 # b-300-09/10/11 → D06 (with D10 carried in that bundle), b-300-90 and
 # b-300-91 unchanged. Dropped with a baseline delta of 0: `b-300-ug` (the
 # physical extent of Haus C is Building truth, `undergroundLevel: partial`,
 # not a proposal) and `b-300-facade` (D06 decides per building). KG 300
 # stays 23.980.000.
 kg300_chapter('Baukonstruktion', 'Building construction',
   'Gründung, Untergeschosse, Tragwerk und Fassaden von Haus A, B und C.',
   'Foundation, basements, structure and facades of buildings A, B and C.',
   [*kg300_building('b', dict(
     id=BA, sfx='ba', scopeDe='Haus A · Kontorhaus', scopeEn='Building A · Kontorhaus',
     origin=('Grundlage Gebäude · Haus A', 'Building baseline · building A'),
     ug='none', residential=False,
     # KG 400 `b-400-27`: 1 Personenaufzug per building.
     lift=True,
     windowFrame='WIN_TIMBER_ALU',
     foundation=dict(amount=620000,
       valueDe='Flachgründung ohne Untergeschoss', valueEn='Shallow foundation without basement'),
     ugFitOutDelta=None,
     structure=dict(amount=4980000,
       valueDe='Stahlbeton-Skelett mit Flachdecken, EG plus fünf Obergeschosse',
       valueEn='Reinforced-concrete frame with flat slabs, ground plus five upper floors'),
     balcony=dict(amount=0,
       summaryDe='Die Unterlagen führen keine Balkonposition; der Umfang ist zu entscheiden.',
       summaryEn='The documents carry no balcony position; the scope is to decide.',
       valueDe='keine Balkonposition in den Unterlagen', valueEn='no balcony position in the documents',
       rowDe='Balkone zu entscheiden · keine Position in den Unterlagen',
       rowEn='Balconies to decide · no position in the documents'),
     facade=dict(amount=2180000, baseline='FAC_FULL_CLINKER', variant='FAC_FULL_CLINKER',
       valueDe='Klinkervorsatzschale, Lochfassade, Retentionsdach',
       valueEn='Brick facing, punched openings, retention roof',
       rowDe='Durchgehende Klinkerfassade', rowEn='Full clinker-brick façade',
       costBasis=('Fassade & Dach', 'Façade & roof')),
     roof=dict(use='ROOF_MAINTENANCE', greening='ROOF_NON_GREEN', amount=0,
       valueDe='Retentionsdach', valueEn='Retention roof',
       rowDe='Retentionsdach nicht begrünt · nur Wartungszugang · in „Fassade & Dach“',
       rowEn='Non-green retention roof · maintenance access only · in “Façade & roof”'),
     extraRows=[
       system('b-kg300-fitout-ba', 'Mieterausbau', 'Tenant fit-out', [
         _attach(required('b-300-91', 'Mieterausbau Kontorhaus', 'Tenant fit-out Kontorhaus',
             'B-Q-02: der Auftraggeberbrief lässt Shell-and-core gegen Mieterausbau offen.',
             'B-Q-02: the client brief leaves shell-and-core versus fit-out open.',
             1240000, building=BA), {'costAuthority': 'direct'}),
       ],
         summaryDe='Shell-and-core gegen Mieterausbau offen (B-Q-02) · zu entscheiden',
         summaryEn='Shell-and-core versus tenant fit-out open (B-Q-02) · to decide',
         scopeDe='Haus A · Kontorhaus', scopeEn='Building A · Kontorhaus',
         visual='fitout', buildingId=BA, costAuthority='direct'),
     ],
   )),
    *kg300_building('b', dict(
     id=BB, sfx='bb', scopeDe='Haus B · Hofhaus', scopeEn='Building B · Hofhaus',
     origin=('Grundlage Gebäude · Haus B', 'Building baseline · building B'),
     ug='full', residential=True, lift=True,
     windowFrame='WIN_TIMBER_ALU',
     foundation=dict(amount=540000,
       valueDe='Gründung unter dem Vollkeller', valueEn='Foundation below the full basement'),
     ugPosition=dict(amount=1180000,
       valueDe='Vollkeller mit 36 Stellplätzen, weiße Wanne',
       valueEn='Full basement with 36 parking spaces, watertight concrete'),
     # FIT_OUT_ONLY delta DERIVED from the released rate keys, not invented:
     # (abDecke 350 − vollausbau 1.100) €/m² × BGF below ground 980 m²
     # (catalog.json `costFactors.untergeschoss`, vr3-demo-projects.json
     # B-BLDG-B `bgfRSBelow`) = −735.000 €; the fit-out-only position stays
     # positive (1.180.000 − 735.000 = 445.000), so the derivation is coherent
     # with the declared demonstration amount.
     ugFitOutDelta=-735000,
     structure=dict(amount=4060000,
       valueDe='Wandscheiben und Massivdecken, 46 Wohneinheiten (B-CF-02)',
       valueEn='Shear walls and solid slabs, 46 dwellings (B-CF-02)'),
     balcony=dict(amount=0,
       summaryDe='Die Unterlagen führen keine Balkonposition; der Umfang ist zu entscheiden.',
       summaryEn='The documents carry no balcony position; the scope is to decide.',
       valueDe='keine Balkonposition in den Unterlagen', valueEn='no balcony position in the documents',
       rowDe='Balkone zu entscheiden · keine Position in den Unterlagen',
       rowEn='Balconies to decide · no position in the documents'),
     # A brick PLINTH is a detail of a rendered façade, not a composition of
     # its own: the source maps to the full rendered façade.
     facade=dict(amount=1540000, baseline='FAC_FULL_RENDER', variant='FAC_FULL_RENDER',
       valueDe='Mineralputz mit Klinkersockel, begrüntes Flachdach',
       valueEn='Mineral render with a brick plinth, green flat roof',
       rowDe='Durchgehende Putzfassade', rowEn='Full rendered façade',
       costBasis=('Fassade & Dach', 'Façade & roof')),
     roof=dict(use='ROOF_MAINTENANCE', greening='ROOF_GREEN', amount=0,
       valueDe='begrüntes Flachdach', valueEn='green flat roof',
       rowDe='Begrüntes Flachdach · nur Wartungszugang · erweiterte Begrünung zu entscheiden',
       rowEn='Green flat roof · maintenance access only · extended greening to decide'),
     roofExtra=[
       _attach(required('b-300-90', 'Dachbegrünung erweitert', 'Extended green roof',
           'Über die Retentionsanforderung hinaus, gestalterisch begründet.',
           'Beyond the retention requirement, justified by design.', 260000, building=BB),
           {'costAuthority': 'direct'}),
     ],
   )),
    *kg300_building('b', dict(
     id=BC, sfx='bc', scopeDe='Haus C · Stadthaus', scopeEn='Building C · Stadthaus',
     origin=('Grundlage Gebäude · Haus C', 'Building baseline · building C'),
     ug='partial', residential=True, lift=True,
     windowFrame='WIN_TIMBER_ALU',
     foundation=dict(amount=660000,
       valueDe='Gründung mit Teilunterkellerung', valueEn='Foundation with partial basement'),
     ugPosition=dict(amount=860000,
       valueDe='Teilunterkellerung mit Technik und 22 Stellplätzen (B-CF-03)',
       valueEn='Partial basement with plant room and 22 parking spaces (B-CF-03)'),
     # NOT derivable here: (350 − 1.100) €/m² × 1.240 m² = −930.000 € would
     # leave a NEGATIVE fit-out-only position (860.000 − 930.000), which
     # proves the declared demonstration amount is not on the rate basis.
     # Mixing the two bases would invent a number, so the alternative states
     # `keine gesonderte Preisgrundlage`.
     ugFitOutDelta=None,
     structure=dict(amount=5320000,
       valueDe='Gewerbe-EG mit größerer Stützweite, sechs Wohngeschosse darüber',
       valueEn='Commercial ground floor with a longer span, six residential floors above'),
     balcony=dict(amount=0,
       summaryDe='Die Unterlagen führen keine Balkonposition; der Umfang ist zu entscheiden.',
       summaryEn='The documents carry no balcony position; the scope is to decide.',
       valueDe='keine Balkonposition in den Unterlagen', valueEn='no balcony position in the documents',
       rowDe='Balkone zu entscheiden · keine Position in den Unterlagen',
       rowEn='Balconies to decide · no position in the documents'),
     # The documented composition (clinker BELOW, render above) is none of the
     # five: source stated in words, no `variant` — the "other" case.
     facade=dict(amount=2040000, baseline='FAC_GF_RENDER_UPPER_CLINKER', variant=None,
       valueDe='Klinker im EG, Putz darüber', valueEn='Brick at ground level, render above',
       rowDe='Erdgeschoss Putz · Obergeschosse Klinker',
       rowEn='Rendered ground floor · clinker-brick upper floors',
       costBasis=('Fassade & Dach', 'Façade & roof')),
     roof=dict(use='ROOF_OCCUPIED', useVariant='ROOF_OCCUPIED', greening='ROOF_NON_GREEN', amount=0,
       valueDe='Dachterrasse im Staffelgeschoss', valueEn='Roof terrace on the set-back floor',
       rowDe='Dachterrasse im Staffelgeschoss · regelmäßig begehbar · nicht begrünt',
       rowEn='Roof terrace on the set-back floor · regularly accessible · non-green'),
   ))],
   KG300_BEMUSTERUNG),
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
      # THE OVERVIEW LINE FOLLOWS THE DECISION THAT GOVERNS IT.
      #
      # Both sentences above assert a SHARED plant, and the overview is where
      # this chapter states the configuration (AC 15). Once `Anlagenkonzept`
      # can say otherwise, a frozen sentence makes the row contradict the
      # decision three lines below it — the combination AC 16 forbids, found
      # by the Acceptance audit. The baseline variant keeps the editorial
      # sentence verbatim, so nothing moves until the user moves it.
      governedBy='b-400-heat',
      byVariant={
        'perBuilding': {
          'summaryDe': ('Je Gebäude eine eigene Anlage · Niedertemperatur-Verteilung '
                        'je Nutzung'),
          'summaryEn': 'One plant per building · low-temperature distribution per use',
          'scopeDe': 'Anlage je Gebäude · Verteilung je Gebäude',
          'scopeEn': 'plant per building · distribution per building',
        },
      },
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
      summaryDe='Zentral je Gebäude · Zirkulation erforderlich',
      summaryEn='Central per building · circulation required',
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
   ],
   [
    rahmen('energieziel', 'Energieziel', 'Energy target', '', '',
           'Förderziel · Annahme', 'Funding target · assumption', edit='b-400-es',
           basis_de=('Gesetzlicher Mindeststandard: GModG § 10 · Niedrigstenergiegebäude '
                     '· aus Bauantragsdatum abgeleitet'),
           basis_en=('Statutory minimum: GModG § 10 · nearly zero-energy building · '
                     'derived from the building-application date')),
    rahmen('gebaeudeumfang', 'Gebäudeumfang', 'Building scope', '', '', '', '',
           derive='buildingScope'),
    rahmen('quelle', 'Quelle', 'Source', '', '', '', '',
           derive='sourceDocuments'),
    rahmen('leistungsgrenze', 'Leistungsgrenze', 'Scope boundary', '', '', '', '',
           derive='responsibility'),
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
   # VR3-KG-UNIFY-00: the same eight services, regrouped into SYSTEM ROWS per
   # kg-chapter-migration-map.md (Access & hardscape · Landscape & play ·
   # Water & boundaries · Garage access). No amount, kind or id changed.
   [system('b-kg500-path', 'Wege & Platzflächen', 'Access & hardscape', [
     quantity('b-500-02', 'Wege & Platzflächen', 'Paths & paved areas',
         'Erschließung der drei Hauseingänge und der Feuerwehrzufahrt.',
         'Access to the three entrances and the fire-service route.',
         380, 1000, 'm²', 'm²'),
   ],
     summaryDe='1.000 m² Erschließung der drei Hauseingänge und der Feuerwehrzufahrt',
     summaryEn='1,000 m² access to the three entrances and the fire-service route',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='path', costAuthority='direct'),
    system('b-kg500-planting', 'Innenhof, Bepflanzung & Spiel', 'Landscape & play', [
     quantity('b-500-01', 'Innenhof & Aufenthaltsflächen', 'Courtyard & amenity areas',
         'Gemeinschaftlicher Hof, B-Q-07: als Quartierspaket geführt.',
         'Shared courtyard, B-Q-07: carried as a quarter-wide package.',
         200, 3100, 'm²', 'm²'),
     quantity('b-500-03', 'Bepflanzung & Baumpflanzung', 'Planting & tree planting',
         'Hofbäume, Strauchpflanzungen und Ausgleichsflächen.',
         'Courtyard trees, shrub planting and compensation areas.',
         100, 2900, 'm²', 'm²'),
     choice('b-500-package', 'Freianlagen-Paket', 'External-works package',
         'B-Q-07 ist beantwortet: ein Quartierspaket, die Zuordnung je Haus wird abgeleitet.',
         'B-Q-07 is answered: one quarter package, the per-building share is derived.',
         [variant('quarter', 'Quartierspaket', 'Quarter package', 0),
          variant('perBuilding', 'Gebäudeweise Vergabe', 'Per-building award', 180000)],
         'quarter'),
     required('b-500-91', 'Spielfläche Quartier', 'Quarter play area',
         'Bei 94 Wohneinheiten üblich, im Auftrag nicht benannt.',
         'Usual for 94 dwellings, not named in the brief.', 120000),
   ],
     summaryDe='3.100 m² Innenhof und 2.900 m² Bepflanzung als Quartierspaket (B-Q-07) · Spielfläche zu entscheiden',
     summaryEn='3,100 m² courtyard and 2,900 m² planting as a quarter package (B-Q-07) · play area to decide',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='planting', costAuthority='direct'),
    system('b-kg500-water', 'Regenwasser & Einfriedung', 'Water & boundaries', [
     quantity('b-500-04', 'Regenwasserbewirtschaftung', 'Stormwater management',
         'Retention, Mulden-Rigolen und Notüberlauf.',
         'Retention, swale-trench systems and emergency overflow.',
         100, 3400, 'm²', 'm²'),
     svc('b-500-05', 'Einfriedung & Müllstandplätze', 'Enclosure & refuse areas',
         'Drei überdachte Standplätze und die Quartierseinfriedung.',
         'Three roofed refuse areas and the quarter enclosure.', 130000),
   ],
     summaryDe='3.400 m² Retention, Mulden-Rigolen und Notüberlauf · drei Müllstandplätze und Einfriedung',
     summaryEn='3,400 m² retention, swale-trench systems and overflow · three refuse areas and enclosure',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='water', costAuthority='direct'),
    system('b-kg500-ramp', 'Tiefgaragenzufahrt', 'Garage access', [
     required('b-500-90', 'Zusätzliche Tiefgaragenrampe', 'Additional garage ramp',
         'Eine zweite Rampe für Haus C wurde erwogen, nicht beauftragt.',
         'A second ramp for building C was considered, not commissioned.', 210000),
   ],
     summaryDe='Zweite Rampe für Haus C zu entscheiden · erwogen, nicht beauftragt',
     summaryEn='Second ramp for building C to decide · considered, not commissioned',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='ramp', costAuthority='direct'),
   ]),
 chapter('KG_600', 'Ausstattung', 'Fixtures & equipment',
   'Feste Ausstattung der Gemeinschafts- und Gewerbeflächen.',
   'Fixed equipment for the shared and commercial areas.',
   # VR3-KG-UNIFY-00: the same six services, regrouped into SYSTEM ROWS per
   # kg-chapter-migration-map.md (Building equipment · Shared-use equipment ·
   # Wayfinding & art). No amount, kind or id changed.
   [system('b-kg600-mailbox', 'Gebäudeausstattung', 'Building equipment', [
     quantity('b-600-01', 'Briefkastenanlagen', 'Letterbox installations',
         'Drei Anlagen mit Paketfächern für 94 Wohneinheiten und Gewerbe.',
         'Three installations with parcel boxes for 94 dwellings and commercial units.',
         32000, 3, 'Anlagen', 'installations'),
   ],
     summaryDe='Drei Briefkastenanlagen mit Paketfächern für 94 Wohneinheiten und Gewerbe',
     summaryEn='Three letterbox installations with parcel boxes for 94 dwellings and commercial units',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='mailbox', costAuthority='direct'),
    system('b-kg600-bicycle', 'Gemeinschaftsausstattung', 'Shared-use equipment', [
     quantity('b-600-02', 'Fahrradabstellanlagen', 'Bicycle parking',
         'Überdachte Anlagen im Hof und in den Untergeschossen.',
         'Covered racks in the courtyard and the basements.',
         500, 368, 'Plätze', 'spaces'),
     svc('b-600-04', 'Gemeinschaftsräume Ausstattung', 'Shared-room equipment',
         'Waschräume, Fahrradwerkstatt und Kinderwagenräume.',
         'Laundry rooms, bicycle workshop and pram stores.', 152000),
     svc('b-600-05', 'Küchenausstattung Gewerbe-EG', 'Commercial ground-floor kitchen fit-out',
         'Grundausstattung für die Gewerbeeinheit, retail-only Ansatz (B-Q-01).',
         'Base equipment for the commercial unit, retail-only assumption (B-Q-01).',
         100000, authority='assumed'),
   ],
     summaryDe='368 Fahrradplätze · Gemeinschaftsräume · Gewerbeküche als retail-only Ansatz (B-Q-01)',
     summaryEn='368 bicycle spaces · shared rooms · commercial kitchen as a retail-only assumption (B-Q-01)',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='bicycle', costAuthority='direct'),
    system('b-kg600-signage', 'Leitsystem & Kunst', 'Wayfinding & art', [
     svc('b-600-03', 'Beschilderung & Leitsystem', 'Signage & wayfinding',
         'Quartiersorientierung, Hausnummern und Klingeltableaus.',
         'Quarter wayfinding, house numbers and doorbell panels.', 88000),
     required('b-600-90', 'Kunst am Bau', 'Public art',
         'Für private Bauherren freiwillig; hier eine Entscheidung.',
         'Voluntary for private clients; here a decision.', 190000),
   ],
     summaryDe='Quartiersorientierung und Hausnummern im Paket · Kunst am Bau zu entscheiden',
     summaryEn='Quarter wayfinding and house numbers in the package · public art to decide',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='signage', costAuthority='direct'),
   ]),
 chapter('KG_700', 'Baunebenkosten', 'Ancillary costs',
   'Planung, Gutachten und Nachweise für drei Baukörper.',
   'Design, surveys and certification for three buildings.',
   # VR3-KG-UNIFY-00: the same nine services, regrouped into SYSTEM ROWS per
   # kg-chapter-migration-map.md (Design team · Surveys & concepts ·
   # Certification & quality). Internal-only visibility, amounts and the
   # QNG → Energieziel dependency rule unchanged.
   [system('b-kg700-plans', 'Planungsteam', 'Design team', [
     svc('b-700-01', 'Objektplanung', 'Architectural design',
         'Leistungsphasen 1 bis 8 nach HOAI für drei Baukörper, Honorarzone III.',
         'HOAI work stages 1 to 8 for three buildings, fee zone III.', 1480000),
     svc('b-700-02', 'Tragwerksplanung', 'Structural design',
         'Standsicherheit, Untergeschosse und Gewerbe-EG mit größerer Stützweite.',
         'Structural verification, basements and the longer-span commercial floor.', 420000),
     svc('b-700-03', 'TGA-Planung', 'Building services design',
         'Ambient-Loop, drei Verteilkonzepte und die Gewerbeanbindung.',
         'Ambient loop, three distribution concepts and the commercial connection.', 480000),
   ],
     summaryDe='Objekt-, Tragwerks- und TGA-Planung für drei Baukörper · Leistungsphasen 1 bis 8',
     summaryEn='Architectural, structural and services design for three buildings · work stages 1 to 8',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='plans', costAuthority='direct'),
    system('b-kg700-survey', 'Gutachten & Konzepte', 'Surveys & concepts', [
     svc('b-700-04', 'Vermessung', 'Survey',
         'Lage- und Höhenaufnahme des gesamten Grundstücks.',
         'Site and level survey of the entire plot.', 120000),
     svc('b-700-05', 'Baugrundgutachten', 'Soil report',
         'Erkundung für zwei Untergeschosse und die Gründung von Haus A.',
         'Investigation for two basements and building A’s foundation.', 140000),
     svc('b-700-06', 'Brandschutzkonzept', 'Fire strategy',
         'Neu zu erstellen: der vorliegende Scan ist gering erkannt (B-CF-06).',
         'To be reissued: the available scan has low recognition (B-CF-06).', 200000),
   ],
     summaryDe='Vermessung, Baugrundgutachten und neu zu erstellendes Brandschutzkonzept (B-CF-06)',
     summaryEn='Survey, soil report and a fire strategy to be reissued (B-CF-06)',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='survey', costAuthority='direct'),
    system('b-kg700-certificate', 'Nachweise & Qualität', 'Certification & quality', [
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
   ],
     summaryDe='kein QNG · keine DGNB-Zertifizierung · Qualitätssicherung zu entscheiden',
     summaryEn='no QNG · no DGNB certification · quality assurance to decide',
     scopeDe='gilt für das gesamte Quartier', scopeEn='applies to the whole quarter',
     visual='certificate', costAuthority='direct'),
   ]),
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

def attach_orientation(chapters):
    """Every chapter that declares system rows but no Rahmen of its own gets
    the two orientation entries (building scope, source documents). KG 400
    already declares its own band; KG 300 declares it in `kg300_chapter`."""
    for ch in chapters:
        if 'rahmen' not in ch:
            ch['rahmen'] = orientation_rahmen()
    return chapters

normalise(A); normalise(B)
attach_boundaries('DEMO-HAPPY-01', A)
attach_boundaries('DEMO-COMPLEX-01', B)
attach_questions(A); attach_questions(B)
attach_orientation(A); attach_orientation(B)
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
#
# VR3-TGA-UX-00 moved two more: `Leistungsgrenze TGA` and `Hausanschlüsse`
# (read-only, selected, worth nothing) left KG 400 for the catalogue's own
# `responsibility` block, so A 31 → 29 and B 48 → 46 selected services. No
# amount moved with them.
#
# VR3-KG-UNIFY-00 rebuilt KG 300 into the 20 audited construction records PER
# BUILDING (kg300-content-dictionary.md). Before: A carried 4 selected
# positions + 1 explicit decision, B 11 selected + 2 variants + 2 explicit
# decisions. Now each building carries 6 selected records (foundation scope,
# stair construction, lift shaft, roof/window/door requirement profiles),
# 18 configured variants (basement scope, GF structure, balcony support,
# façade composition, 3 colour + 3 texture families, roof use, roof greening,
# window frame/format/opening, entrance/apartment/internal door) and 1 explicit
# decision (balconies in scope); B keeps `b-300-90`/`b-300-91` as explicit
# decisions. So A 29/11/7 → 31/29/7 and B 46/10/11 → 53/62/14. The two
# superseded choices (`b-300-ug`, `b-300-facade`) had baseline deltas of 0 and
# every former position keeps its euro, so NO TOTAL MOVED: A 4.020.000 and
# B 23.980.000 for KG 300, 6.480.000 and 38.740.000 overall.
for name, got, want, what in [
    ('DEMO-HAPPY-01', a_sel, 31, 'selected standard services'),
    ('DEMO-HAPPY-01', a_var, 28, 'configured variants'),
    ('DEMO-HAPPY-01', a_dec, 8, 'explicit non-selections'),
    ('DEMO-COMPLEX-01', b_sel, 53, 'selected standard services'),
    ('DEMO-COMPLEX-01', b_var, 59, 'configured variants'),
    ('DEMO-COMPLEX-01', b_dec, 17, 'explicit non-selections'),
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
    'Aufzüge & Sonderanlagen',
]
# VR3-TGA-UX-00: `Schnittstellen & Verantwortung` is no longer a system of
# KG 400. It is the catalogue's own `responsibility` block, read by the
# dedicated Configurator step, and proved separately below.
RESPONSIBILITY_MEDIA = ['potableWater', 'foulWater', 'electricityLv', 'telecommunications']

def prove_responsibility(name, block):
    ids = [m['id'] for m in block['connections']['media']]
    if ids != RESPONSIBILITY_MEDIA:
        raise SystemExit(f'{name} responsibility media: {ids} != {RESPONSIBILITY_MEDIA}')
    for m in block['connections']['media']:
        if m['status'] not in ('ok', 'attention'):
            raise SystemExit(f"{name} {m['id']}: status {m['status']} is not ok|attention")
    # The Bauherr's side of the handover never becomes an All3 amount.
    if block['connections']['costAuthority'] != 'bauherr':
        raise SystemExit(f'{name}: house connections must stay Bauherr-owned')
    if block['scopeBoundary']['costAuthority'] != 'none':
        raise SystemExit(f'{name}: the scope boundary carries no cost authority')

def variant_values(s):
    return [v['value'] for v in s['kind']['variants']]

def prove_choice_integrity(name, services):
    """The rules every decision layer shares (VR3-TGA-01, extended to KG 300
    by VR3-KG-UNIFY-00). Stated once, applied to every chapter that declares
    alternatives."""
    # Every alternative must state what its euro is allowed to mean. A
    # variant that is neither priced, nor bundled, nor explicitly without a
    # price basis, nor the answer that removes the position would render a
    # bare "± 0 €" — the one thing the audit's cost-authority rule forbids.
    for s in services:
        if s['kind']['kind'] != 'singleChoice':
            continue
        base = s['kind']['baselineVariant']
        for v in s['kind']['variants']:
            priced = D(v['delta']) != 0
            if not (priced or v.get('noPriceBasis') or v.get('bundled')
                    or v.get('excludesPosition') or v['value'] == base):
                raise SystemExit(
                    f"{name} {s['id']}/{v['value']}: an alternative with no cost "
                    'language would render a bare zero')
            if v.get('excludesPosition') and priced:
                raise SystemExit(
                    f"{name} {s['id']}/{v['value']}: an excluded position cannot carry a delta")
    # A REQUIRED decision that is entirely without a price basis is BLOCKED
    # PRICING, and blocked pricing has to say what is blocking it. Without
    # the condition the surface can only report the absence of a price,
    # which reads as "this choice does not cost anything" — the opposite of
    # true for a decision the catalogue itself calls a cost driver.
    for s in services:
        if not s.get('requiresDecision'):
            continue
        if s.get('costAuthority') != 'noBasis':
            continue
        if not (s.get('pricingConditionDe') and s.get('pricingConditionEn')):
            raise SystemExit(
                f"{name} {s['id']}: a required decision with no price basis must "
                'declare pricingConditionDe/En — blocked pricing states its condition')
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
        if variant not in variant_values(s):
            raise SystemExit(
                f"{name} {s['id']}: source variant {variant} is not an alternative")
    # The All3 standard is a MARKER inside the choice set, never a selection
    # and never a fourth state.
    for s in services:
        std = s.get('all3Standard')
        if std is None:
            continue
        if std not in variant_values(s):
            raise SystemExit(
                f"{name} {s['id']}: All3 standard {std} is not an alternative")
    # A blocked alternative must be shown WITH ITS REASON, and it must be a
    # real alternative rather than a value invented to be refused.
    for s in services:
        for b in s.get('blockedVariants', []):
            if b['value'] not in variant_values(s):
                raise SystemExit(
                    f"{name} {s['id']}: blocks {b['value']}, which is not an alternative")

def prove_tga(name, chapters):
    ch = next(c for c in chapters if c['group'] == 'KG_400')
    names = [g['labelDe'] for g in ch['groups']]
    if names != TGA_SYSTEMS:
        raise SystemExit(f'{name} KG 400 systems: {names} != {TGA_SYSTEMS}')
    for field in ('rahmen', 'bemusterung', 'rules'):
        if not ch.get(field):
            raise SystemExit(f'{name} KG 400 declares no {field}')
    services = [s for g in ch['groups'] for s in g['services']]
    prove_choice_integrity(name, services)
    configurable = [s for s in services if s['kind']['kind'] == 'singleChoice']
    print(f'{name} KG 400: {len(ch["groups"])} systems · {len(services)} decisions · '
          f'{len(configurable)} with alternatives')

prove_tga('DEMO-HAPPY-01', A)
prove_tga('DEMO-COMPLEX-01', B)

# ── VR3-KG-UNIFY-00 · what the KG 300 chapter must be ────────────────────
# Nine system rows per building, in the order of kg-chapter-migration-map.md;
# every row building-scoped; the dependency graph of kg300-dependency-graph.md
# stated in data; every alternative with its cost language; no window or door
# alternative priced before the commercial owner calibrates one.
KG300_SYSTEMS = [
    'Bodenplatte', 'Untergeschoss', 'Tragsystem Erdgeschoss', 'Balkone', 'Fassade',
    'Dach', 'Treppen & Aufzugsschacht', 'Fenster', 'Türen',
]
KG300_VISUALS = ['slab', 'basement', 'frame', 'balcony', 'facade', 'roof', 'stairs', 'window', 'door']

def prove_kg300(name, chapters, buildings):
    ch = next(c for c in chapters if c['group'] == 'KG_300')
    for field in ('rahmen', 'bemusterung', 'questionDe', 'questionEn'):
        if not ch.get(field):
            raise SystemExit(f'{name} KG 300 declares no {field}')
    services = [s for g in ch['groups'] for s in g['services']]
    by_id = {s['id']: s for s in services}
    # Every KG 300 group is a system row of ONE building.
    for g in ch['groups']:
        if not g.get('buildingId'):
            raise SystemExit(f"{name} {g['id']}: a KG 300 system row without a building")
        for field in ('summaryDe', 'summaryEn', 'scopeDe', 'scopeEn', 'visual'):
            if not g.get(field):
                raise SystemExit(f"{name} {g['id']}: system row declares no {field}")
        for s in g['services']:
            if s.get('buildingId') != g['buildingId']:
                raise SystemExit(f"{name} {s['id']}: service building differs from its row")
    # The nine systems exist, in order, for every building.
    for b in buildings:
        rows = [g for g in ch['groups'] if g['buildingId'] == b]
        names = [g['labelDe'] for g in rows][:len(KG300_SYSTEMS)]
        if names != KG300_SYSTEMS:
            raise SystemExit(f'{name} KG 300 {b}: {names} != {KG300_SYSTEMS}')
        visuals = [g['visual'] for g in rows][:len(KG300_VISUALS)]
        if visuals != KG300_VISUALS:
            raise SystemExit(f'{name} KG 300 {b}: visuals {visuals} != {KG300_VISUALS}')
        # Basement rows follow the Building's `undergroundLevel`, live.
        ug_row = rows[1]
        if ug_row.get('appliesWhen') != UG_CONDITION:
            raise SystemExit(f"{name} {ug_row['id']}: basement row declares no appliesWhen")
        if any(s.get('appliesWhen') != UG_CONDITION for s in ug_row['services']):
            raise SystemExit(f"{name} {ug_row['id']}: basement decision declares no appliesWhen")
        # Balcony support exists only while balconies are in scope.
        scope_svc, support_svc = rows[3]['services'][:2]
        dep = support_svc.get('dependsOn') or {}
        if not (dep.get('serviceId') == scope_svc['id'] and dep.get('requiresSelected')
                and scope_svc['requiresDecision']):
            raise SystemExit(f"{name} {support_svc['id']}: support does not depend on inclusion")
        # Six colour/texture services follow the composition's material zones.
        composition, *zones = rows[4]['services']
        if len(zones) != 6:
            raise SystemExit(f"{name} {rows[4]['id']}: {len(zones)} zone services, not 6")
        for z in zones:
            dep = z.get('dependsOn') or {}
            allowed = dep.get('requiresVariantIn') or []
            if dep.get('serviceId') != composition['id'] or not allowed:
                raise SystemExit(f"{name} {z['id']}: zone service does not follow the composition")
            if not set(allowed) <= set(variant_values(composition)):
                raise SystemExit(f"{name} {z['id']}: requires a composition that does not exist")
    # Derived records name governors that exist, are choices, and whose
    # variants the sentence keys are built from.
    for s in services:
        d = s.get('derived')
        if not d:
            continue
        if s['kind']['kind'] != 'readOnlyRequired' or s['authority'] != 'derived':
            raise SystemExit(f"{name} {s['id']}: a derived record must be read-only and derived")
        governors = [by_id.get(g) for g in d['from']]
        if any(g is None or g['kind']['kind'] != 'singleChoice' for g in governors):
            raise SystemExit(f"{name} {s['id']}: derived from a governor that is not a choice")
        for key in d['byValues']:
            parts = key.split('|')
            if len(parts) != len(governors) or any(
                    part not in variant_values(g) for part, g in zip(parts, governors)):
                raise SystemExit(f"{name} {s['id']}: byValues key {key} names no governor variant")
    prove_choice_integrity(name, services)
    # Window and door alternatives carry NO delta until the commercial owner
    # calibrates one (kg300-cost-authority-map.md: `noBasis`, safe numeric=false).
    for g in ch['groups']:
        if g['visual'] not in ('window', 'door'):
            continue
        for s in g['services']:
            if s['kind']['kind'] != 'singleChoice':
                continue
            if s.get('costAuthority') != 'noBasis':
                raise SystemExit(f"{name} {s['id']}: window/door decision is not noBasis")
            for v in s['kind']['variants']:
                if D(v['delta']) != 0:
                    raise SystemExit(f"{name} {s['id']}/{v['value']}: a priced window/door alternative")
    # Every KG 300 decision states its cost language explicitly.
    for s in services:
        if not s.get('costAuthority'):
            raise SystemExit(f"{name} {s['id']}: a KG 300 record without cost authority")
    configurable = [s for s in services if s['kind']['kind'] == 'singleChoice']
    print(f'{name} KG 300: {len(ch["groups"])} system rows · {len(buildings)} buildings · '
          f'{len(services)} records · {len(configurable)} with alternatives')

prove_kg300('DEMO-HAPPY-01', A, ['A-BLDG-01'])
prove_kg300('DEMO-COMPLEX-01', B, [BA, BB, BC])

RESP_A = responsibility(
    src('All3-Standard · Leistungsverzeichnis', 'All3 standard · scope schedule',
        'Übergabepunkt Grundstücksgrenze', 'Handover point at the property line'),
    src('01_Auftraggeberbrief.pdf · S. 7', '01_Auftraggeberbrief.pdf · p. 7'),
    [medium('potableWater', 'Trinkwasser', 'Potable water',
            'Bauherr bis Grundstücksgrenze', 'Client to the property line'),
     medium('foulWater', 'Schmutzwasser / Kanal', 'Foul water / sewer',
            'Bauherr bis Grundstücksgrenze', 'Client to the property line'),
     medium('electricityLv', 'Strom (NS-Netz)', 'Electricity (LV grid)',
            'Bauherr bis Grundstücksgrenze', 'Client to the property line'),
     medium('telecommunications', 'Telekommunikation', 'Telecommunications',
            'Glasfaser gesichert', 'Fibre secured')])
RESP_B = responsibility(
    src('All3-Standard · Leistungsverzeichnis', 'All3 standard · scope schedule',
        'Übergabepunkt Grundstücksgrenze', 'Handover point at the property line'),
    src('01_Auftraggeberbrief.pdf · S. 12', '01_Auftraggeberbrief.pdf · p. 12'),
    [medium('potableWater', 'Trinkwasser', 'Potable water',
            'Bauherr bis Grundstücksgrenze', 'Client to the property line'),
     medium('foulWater', 'Schmutzwasser / Kanal', 'Foul water / sewer',
            'Bauherr bis Grundstücksgrenze', 'Client to the property line'),
     medium('electricityLv', 'Strom (NS-Netz)', 'Electricity (LV grid)',
            'Bauherr bis Grundstücksgrenze', 'Client to the property line'),
     medium('telecommunications', 'Telekommunikation', 'Telecommunications',
            'Glasfaser in Planung/Ausbau — Verfügbarkeit offen',
            'Fibre planned/under rollout — availability open', status='attention')])
prove_responsibility('DEMO-HAPPY-01', RESP_A)
prove_responsibility('DEMO-COMPLEX-01', RESP_B)

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
        'variant contributes nothing and the declared totals hold. A quantity '
        'service prices as unitAmount x quantity, and its declared `amount` '
        'is exactly unitAmount x baselineQuantity — that identity is what '
        'lets a flat position become Sales-configurable without moving a '
        'declared subtotal, and it is enforced per position by '
        'src/engine/__tests__/pricingCoverage.invariant.test.ts.'
    ),
    'catalogues': [
        {'projectId': 'DEMO-HAPPY-01', 'uncertaintyPercent': '5',
         'declaredNetTotal': money(a_total),
         'declaredByCostGroup': {k: money(v) for k, v in a_groups.items()},
         'chapters': A, 'responsibility': RESP_A},
        {'projectId': 'DEMO-COMPLEX-01', 'uncertaintyPercent': '6',
         'declaredNetTotal': money(b_total),
         'declaredByCostGroup': {k: money(v) for k, v in b_groups.items()},
         'chapters': B, 'responsibility': RESP_B},
    ],
}
OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('written', OUT, OUT.stat().st_size, 'bytes')
