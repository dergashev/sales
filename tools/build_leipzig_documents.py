#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generator of the Leipzig demonstration document pack.

WHAT THIS IS
------------
`design-system/assets/documents/leipzig/*.pdf` is a pack of twelve synthetic,
internally authored German construction-project documents for the demo project
`DEMO-COMPLEX-01` ("Quartier Am Güterbogen", Leipzig, three buildings). They
replace the previous fixture situation in which 36 document records all reused
six schematic SVG images: the demo needs documents an evidence item can cite by
page and clause, not thumbnails.

This script is the SINGLE SOURCE of the pack. Never hand-edit a generated PDF
and never hand-edit `design-system/assets/documents/manifest.json`; change this
file and re-run it:

    python3 tools/build_leipzig_documents.py

NUMERIC AUTHORITY
-----------------
Every area, unit count, workplace count, parking count and site-area statement
is read at generation time from `src/fixtures/vr3-demo-projects.json`
(`DEMO-COMPLEX-01.buildings[].metrics`) and from that project's `schedule`
block. No figure is typed twice. Per-storey decompositions are declared in this
file (the fixture holds no per-storey data) and every one of them is asserted to
sum EXACTLY to the fixture total it decomposes; the assertions run on every
build, so a fixture change that breaks a decomposition fails the build instead
of shipping a document that contradicts the baseline.

Where the fixture holds `null` the document says so in words ("entfällt") and
never prints a zero. Where the fixture holds "0.00" (the Kontorhaus has no
basement, so its below-grade BGF is a real zero, not a missing value) the
document prints 0,00 m² together with the words that explain it.

DETERMINISM
-----------
Byte-stable across runs: no `datetime.now()`, no randomness, PDF creation date
pinned to each document's own issue date, producer/creator strings fixed. Two
consecutive runs must produce identical sha256 sums.

TYPOGRAPHY
----------
Core PDF fonts only (Helvetica, Courier) - nothing is embedded, least of all
the product's brand font. Core fonts are Latin-1, which does not contain
U+202F NARROW NO-BREAK SPACE; the repository nevertheless requires exactly that
character between a number and its unit (CLAUDE.md rule 7, README §1.9). So the
pack renders the separator through code 0x7F, which
  * is remapped by an /Encoding /Differences entry to the glyph `space`, so it
    prints as a normal, unbreakable word space, and
  * is remapped by a /ToUnicode CMap to U+202F, so every extractor (pypdf,
    PyMuPDF, pdf.js) reads back the required narrow no-break space.
U+00A0 never appears in the corpus. Everything else stays inside Latin-1, and
`_assert_latin1` fails the build on the first character that does not (so no
en dash, no typographic quotes, no euro sign - none of which these technical
documents need).

Rules that shaped the drawing: no rounded corners, no gradients, no shadows -
hairlines, rectangles and type only, black/grey plus one grey accent for rules.
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import Align, XPos, YPos
from fpdf.fonts import CORE_FONTS_CHARWIDTHS
from fpdf.output import OutputProducer, PDFContentStream, PDFFont
from fpdf.syntax import Name, PDFArray, PDFObject

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------

REPO = Path(__file__).resolve().parents[1]
FIXTURE = REPO / "src" / "fixtures" / "vr3-demo-projects.json"
OUT_DIR = REPO / "design-system" / "assets" / "documents" / "leipzig"
MANIFEST = REPO / "design-system" / "assets" / "documents" / "manifest.json"
GENERATOR_REL = "tools/build_leipzig_documents.py"

PROJECT_ID = "DEMO-COMPLEX-01"

# --------------------------------------------------------------------------
# The narrow no-break space, smuggled through a Latin-1 core font
# --------------------------------------------------------------------------

NNBSP_CODE = 0x7F
NB = chr(NNBSP_CODE)  # written into every "number + unit" pair

for _table in CORE_FONTS_CHARWIDTHS.values():
    # Lay out the separator with the metric of the glyph it actually prints,
    # so right-aligned numeric columns stay flush.
    _table[NB] = _table[" "]


class _NarrowSpaceEncoding(PDFObject):
    """WinAnsiEncoding with code 0x7F redirected to the `space` glyph."""

    def __init__(self) -> None:
        super().__init__()
        self.type = Name("Encoding")
        self.base_encoding = Name("WinAnsiEncoding")
        self.differences = PDFArray([str(NNBSP_CODE), "/space"])


def _to_unicode_cmap() -> str:
    entries = [
        f"<{code:02X}> <{(0x202F if code == NNBSP_CODE else code):04X}>"
        for code in range(0x20, 0x100)
    ]
    blocks = []
    for start in range(0, len(entries), 100):
        chunk = entries[start : start + 100]
        blocks.append(f"{len(chunk)} beginbfchar\n" + "\n".join(chunk) + "\nendbfchar\n")
    return (
        "/CIDInit /ProcSet findresource begin\n"
        "12 dict begin\n"
        "begincmap\n"
        "/CIDSystemInfo <</Registry (Adobe) /Ordering (UCS) /Supplement 0>> def\n"
        "/CMapName /Adobe-Identity-UCS def\n"
        "/CMapType 2 def\n"
        "1 begincodespacerange\n<00> <FF>\nendcodespacerange\n"
        + "".join(blocks)
        + "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend"
    )


_ORIGINAL_ADD_FONTS = OutputProducer._add_fonts


def _add_fonts_with_narrow_space(self):  # noqa: ANN001, ANN201
    result = _ORIGINAL_ADD_FONTS(self)
    for obj in list(self.pdf_objs):
        if isinstance(obj, PDFFont) and str(obj.subtype) == "Type1":
            encoding = _NarrowSpaceEncoding()
            self._add_pdf_obj(encoding, "fonts")
            obj.encoding = encoding
            cmap = PDFContentStream(_to_unicode_cmap())
            self._add_pdf_obj(cmap, "fonts")
            obj.to_unicode = cmap
    return result


OutputProducer._add_fonts = _add_fonts_with_narrow_space

# --------------------------------------------------------------------------
# Formatting
# --------------------------------------------------------------------------

MONTHS_DE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
]

M2 = "m²"
M3 = "m³"


def _assert_latin1(text: str) -> str:
    try:
        text.encode("latin-1")
    except UnicodeEncodeError as exc:  # pragma: no cover - build guard
        bad = text[exc.start : exc.end]
        raise SystemExit(
            f"Core PDF fonts are Latin-1 only; {bad!r} is not. Text: {text!r}"
        ) from exc
    return text


def lbl(text: str) -> str:
    """Resolve the {NB} placeholder used inside declared labels."""
    return text.format(NB=NB)


def de(value: float, decimals: int = 2) -> str:
    """German grouped number: 1.234,56 (no unit)."""
    formatted = f"{value:,.{decimals}f}"
    return formatted.replace(",", "#").replace(".", ",").replace("#", ".")


def qty(value: float, unit: str, decimals: int = 2) -> str:
    """Number and unit joined by the narrow no-break space."""
    return f"{de(value, decimals)}{NB}{unit}"


def sqm(value: str | float | None, *, absent: str = "entfällt") -> str:
    """A fixture area string as a printable m² figure, or the absent wording."""
    if value is None:
        return absent
    return qty(float(value), M2)


def cnt(value: int | None, unit: str, *, absent: str = "entfällt") -> str:
    if value is None:
        return absent
    return f"{de(value, 0)}{NB}{unit}"


def dmy(iso_or_date) -> str:
    d = date.fromisoformat(iso_or_date) if isinstance(iso_or_date, str) else iso_or_date
    return f"{d.day:02d}.{d.month:02d}.{d.year}"


def dmy_long(iso_or_date) -> str:
    d = date.fromisoformat(iso_or_date) if isinstance(iso_or_date, str) else iso_or_date
    return f"{d.day}.{NB}{MONTHS_DE[d.month - 1]}{NB}{d.year}"


# --------------------------------------------------------------------------
# Fixture
# --------------------------------------------------------------------------


def load_project() -> dict:
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    for project in data["projects"]:
        if project["id"] == PROJECT_ID:
            return project
    raise SystemExit(f"{PROJECT_ID} not found in {FIXTURE}")


PROJECT = load_project()
BUILDINGS = {b["id"]: b for b in PROJECT["buildings"]}
A = BUILDINGS["B-BLDG-A"]
B = BUILDINGS["B-BLDG-B"]
C = BUILDINGS["B-BLDG-C"]
ORDER = [A, B, C]
SCHEDULE = PROJECT["schedule"]

PROJECT_NAME = PROJECT["name"]
CLIENT = PROJECT["client"]
ADDRESS = (
    f"{PROJECT['portfolio']['addressLine']}, "
    f"{PROJECT['portfolio']['postcode']}{NB}{PROJECT['city']}"
)

USAGE_DE = {
    "vr3.building.usage.office": "100 Prozent Büro",
    "vr3.building.usage.residential": "100 Prozent Wohnen",
    "vr3.building.usage.mixed": "Erdgeschoss Gewerbe · Obergeschosse Wohnen",
}
STOREYS_DE = {
    "vr3.building.storeys.bA": "EG + 5 OG",
    "vr3.building.storeys.bB": "UG + EG + 4 OG",
    "vr3.building.storeys.bC": "Teil-UG + EG + 6 OG",
}
UNDERGROUND_DE = {
    "none": "kein Untergeschoss",
    "full": "vollflächiges Untergeschoss",
    "partial": "Teil-Untergeschoss",
}


def usage(building: dict) -> str:
    return USAGE_DE[building["usageKey"]]


def storeys(building: dict) -> str:
    return STOREYS_DE[building["storeysKey"]]


def underground(building: dict) -> str:
    return UNDERGROUND_DE[building["undergroundLevel"]]


def m(building: dict, key: str):
    return building["metrics"][key]


def fnum(building: dict, key: str) -> float:
    value = m(building, key)
    if value is None:
        raise SystemExit(f"{building['id']}.{key} is null in the fixture")
    return float(value)


def total(key: str) -> float:
    return sum(fnum(b, key) for b in ORDER)


def total_optional(key: str) -> float:
    return sum(float(m(b, key)) for b in ORDER if m(b, key) is not None)


def total_counts(key: str) -> int:
    return sum(int(m(b, key)) for b in ORDER if m(b, key) is not None)


def check(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"fixture consistency failed: {message}")


# Fixture-internal consistency, asserted before a single page is drawn.
for _b in ORDER:
    check(
        abs(fnum(_b, "bgfRAbove") + fnum(_b, "bgfSAbove") - fnum(_b, "bgfRSAbove")) < 1e-6,
        f"{_b['id']}: bgfRAbove + bgfSAbove != bgfRSAbove",
    )
    check(
        abs(fnum(_b, "bgfRBelow") + fnum(_b, "bgfSBelow") - fnum(_b, "bgfRSBelow")) < 1e-6,
        f"{_b['id']}: bgfRBelow + bgfSBelow != bgfRSBelow",
    )
    check(
        abs(fnum(_b, "bgfRSAbove") + fnum(_b, "bgfRSBelow") - fnum(_b, "bgfRSTotal")) < 1e-6,
        f"{_b['id']}: bgfRSAbove + bgfRSBelow != bgfRSTotal",
    )
    check(m(_b, "siteArea") is None, f"{_b['id']}: siteArea is no longer null")

SUM_RS_ABOVE = total("bgfRSAbove")
SUM_RS_BELOW = total("bgfRSBelow")
SUM_RS_TOTAL = total("bgfRSTotal")
SUM_R_ABOVE = total("bgfRAbove")
SUM_S_ABOVE = total("bgfSAbove")
SUM_R_BELOW = total("bgfRBelow")
SUM_S_BELOW = total("bgfSBelow")
SUM_WFL = total_optional("wfl")
SUM_NUF = total_optional("nuf")
SUM_COMMERCIAL = total_optional("commercialNuf")
SUM_UNITS = total_counts("units")
SUM_WORKPLACES = total_counts("workplaces")
SUM_PARKING = total_counts("parkingSpaces")

check(abs(SUM_RS_ABOVE + SUM_RS_BELOW - SUM_RS_TOTAL) < 1e-6, "project BGF sums")

# --------------------------------------------------------------------------
# Per-storey decompositions (declared here, asserted against the fixture)
# --------------------------------------------------------------------------

# Kontorhaus (B-BLDG-A): EG + 5 OG, no basement.
# label, BGF R, BGF S, NUF, workplaces
A_STOREYS = [
    ("Erdgeschoss", 1000.00, 30.00, 700.00, 40),
    ("1.{NB}Obergeschoss", 964.00, 36.00, 732.00, 60),
    ("2.{NB}Obergeschoss", 964.00, 36.00, 732.00, 60),
    ("3.{NB}Obergeschoss", 964.00, 36.00, 732.00, 60),
    ("4.{NB}Obergeschoss", 964.00, 36.00, 732.00, 60),
    ("5.{NB}Obergeschoss", 964.00, 36.00, 732.00, 60),
]

# Hofhaus (B-BLDG-B): UG + EG + 4 OG.
# label, BGF R, BGF S, WFL, units
B_STOREYS = [
    ("Erdgeschoss", 940.00, 20.00, 650.00, 8),
    ("1.{NB}Obergeschoss", 920.00, 40.00, 690.00, 10),
    ("2.{NB}Obergeschoss", 920.00, 40.00, 690.00, 10),
    ("3.{NB}Obergeschoss", 920.00, 40.00, 690.00, 10),
    ("4.{NB}Obergeschoss", 920.00, 40.00, 690.00, 8),
]
B_BASEMENT = ("Untergeschoss", 980.00, 0.00)

# Stadthaus (B-BLDG-C): Teil-UG + EG + 6 OG, ground floor commercial.
# label, BGF R, BGF S, WFL, commercial NUF, units
C_STOREYS = [
    ("Erdgeschoss", 1020.00, 30.00, 0.00, 920.00, 0),
    ("1.{NB}Obergeschoss", 900.00, 35.00, 660.00, 0.00, 10),
    ("2.{NB}Obergeschoss", 900.00, 35.00, 660.00, 0.00, 10),
    ("3.{NB}Obergeschoss", 870.00, 35.00, 630.00, 0.00, 9),
    ("4.{NB}Obergeschoss", 870.00, 35.00, 630.00, 0.00, 9),
    ("5.{NB}Obergeschoss", 830.00, 35.00, 570.00, 0.00, 6),
    ("6.{NB}Obergeschoss", 790.00, 35.00, 470.00, 0.00, 4),
]
C_BASEMENT = ("Teil-Untergeschoss", 1240.00, 0.00)


WFL_MEAN_B = float(m(B, "wfl")) / int(m(B, "units"))
WFL_MEAN_C = float(m(C, "wfl")) / int(m(C, "units"))
NUF_PER_WORKPLACE = float(m(A, "nuf")) / int(m(A, "workplaces"))

# --------------------------------------------------------------------------
# Room and apartment schedules per storey
# --------------------------------------------------------------------------
# The fixture holds no room-level data. These schedules are declared here and
# asserted to sum EXACTLY to the storey figure they decompose, which in turn
# sums to the fixture total. The apartment type mix of a building is DERIVED
# from these schedules, never declared twice.

# Kontorhaus: room schedules, NUF per DIN 277 (technical and circulation areas
# are not NUF and therefore not listed).
A_ROOMS = {
    "Erdgeschoss": [
        ("R-0.01", "Empfang und Anmeldung", 60.00),
        ("R-0.02", "Wartezone", 45.00),
        ("R-0.03", "Konferenzraum 1, teilbar", 70.00),
        ("R-0.04", "Konferenzraum 2, teilbar", 70.00),
        ("R-0.05", "Schulungsraum", 85.00),
        ("R-0.06", "Besprechungsraum klein", 30.00),
        ("R-0.07", "Fahrradabstellanlage", 120.00),
        ("R-0.08", "Umkleiden und Duschen", 55.00),
        ("R-0.09", "Teeküche Erdgeschoss", 25.00),
        ("R-0.10", "Kopier- und Lagerzone", 40.00),
        ("R-0.11", "Poststelle", 30.00),
        ("R-0.12", "Sanitärräume Erdgeschoss", 70.00),
    ],
    "1.{NB}Obergeschoss": [
        ("R-1.01", "Besprechungsraum 1", 28.00),
        ("R-1.02", "Besprechungsraum 2", 28.00),
        ("R-1.03", "Besprechungsraum 3", 28.00),
        ("R-1.04", "Besprechungsraum 4", 28.00),
        ("R-1.05", "Arbeitsplatzzone Nord", 420.00),
        ("R-1.06", "Fokusraum 1", 15.00),
        ("R-1.07", "Fokusraum 2", 15.00),
        ("R-1.08", "Teeküche und Kopierzone", 50.00),
        ("R-1.09", "Garderobe und Nebenzone", 40.00),
        ("R-1.10", "Lagerraum", 20.00),
        ("R-1.11", "Sanitärräume", 60.00),
    ],
    "2.{NB}Obergeschoss": [
        ("R-2.01", "Arbeitsplatzzone offen", 520.00),
        ("R-2.02", "Fokusraum 1", 16.00),
        ("R-2.03", "Fokusraum 2", 16.00),
        ("R-2.04", "Fokusraum 3", 16.00),
        ("R-2.05", "Ruheraum", 24.00),
        ("R-2.06", "Teeküche mit Sitzgruppe", 40.00),
        ("R-2.07", "Kopierzone", 20.00),
        ("R-2.08", "Lagerraum", 20.00),
        ("R-2.09", "Sanitärräume", 60.00),
    ],
    "3.{NB}Obergeschoss": [
        ("R-3.01", "Teamflaeche A", 140.00),
        ("R-3.02", "Teamflaeche B", 140.00),
        ("R-3.03", "Teamflaeche C", 140.00),
        ("R-3.04", "Teamflaeche D", 140.00),
        ("R-3.05", "Nebenzone A und B", 24.00),
        ("R-3.06", "Nebenzone C und D", 24.00),
        ("R-3.07", "Teeküche", 30.00),
        ("R-3.08", "Lagerraum", 34.00),
        ("R-3.09", "Sanitärräume", 60.00),
    ],
    "4.{NB}Obergeschoss": [
        ("R-4.01", "Arbeitsplatzzone", 480.00),
        ("R-4.02", "Besprechungsraum 1", 32.00),
        ("R-4.03", "Besprechungsraum 2", 32.00),
        ("R-4.04", "Besprechungsraum 3", 32.00),
        ("R-4.05", "Fokusraum 1 und 2", 32.00),
        ("R-4.06", "Teeküche", 30.00),
        ("R-4.07", "Lagerraum", 34.00),
        ("R-4.08", "Sanitärräume", 60.00),
    ],
    "5.{NB}Obergeschoss": [
        ("R-5.01", "Arbeitsplatzzone", 440.00),
        ("R-5.02", "Besprechungsraum 1", 34.00),
        ("R-5.03", "Besprechungsraum 2", 34.00),
        ("R-5.04", "Fokusraum 1 und 2", 32.00),
        ("R-5.05", "Vorraum Dachterrasse", 80.00),
        ("R-5.06", "Teeküche", 32.00),
        ("R-5.07", "Lagerraum", 20.00),
        ("R-5.08", "Sanitärräume", 60.00),
    ],
}

# Hofhaus: apartment schedules, WFL per WoFlV.
B_APARTMENTS = {
    "Erdgeschoss": [
        ("W-0.01", 2, 56.00), ("W-0.02", 2, 58.00), ("W-0.03", 3, 72.00),
        ("W-0.04", 3, 76.00), ("W-0.05", 3, 80.00), ("W-0.06", 4, 94.00),
        ("W-0.07", 4, 98.00), ("W-0.08", 5, 116.00),
    ],
    "1.{NB}Obergeschoss": [
        ("W-1.01", 1, 40.00), ("W-1.02", 2, 54.00), ("W-1.03", 2, 56.00),
        ("W-1.04", 2, 58.00), ("W-1.05", 3, 70.00), ("W-1.06", 3, 74.00),
        ("W-1.07", 3, 78.00), ("W-1.08", 3, 82.00), ("W-1.09", 3, 86.00),
        ("W-1.10", 4, 92.00),
    ],
    "2.{NB}Obergeschoss": [
        ("W-2.01", 1, 42.00), ("W-2.02", 2, 52.00), ("W-2.03", 2, 56.00),
        ("W-2.04", 2, 60.00), ("W-2.05", 3, 72.00), ("W-2.06", 3, 74.00),
        ("W-2.07", 3, 76.00), ("W-2.08", 3, 82.00), ("W-2.09", 3, 84.00),
        ("W-2.10", 4, 92.00),
    ],
    "3.{NB}Obergeschoss": [
        ("W-3.01", 1, 38.00), ("W-3.02", 2, 54.00), ("W-3.03", 2, 58.00),
        ("W-3.04", 2, 62.00), ("W-3.05", 3, 70.00), ("W-3.06", 3, 72.00),
        ("W-3.07", 3, 78.00), ("W-3.08", 3, 80.00), ("W-3.09", 3, 82.00),
        ("W-3.10", 4, 96.00),
    ],
    "4.{NB}Obergeschoss": [
        ("W-4.01", 1, 44.00), ("W-4.02", 3, 76.00), ("W-4.03", 3, 80.00),
        ("W-4.04", 3, 84.00), ("W-4.05", 4, 92.00), ("W-4.06", 4, 96.00),
        ("W-4.07", 4, 100.00), ("W-4.08", 5, 118.00),
    ],
}

# Stadthaus: apartment schedules, WFL per WoFlV. The ground floor is commercial.
C_APARTMENTS = {
    "1.{NB}Obergeschoss": [
        ("W-1.01", 1, 38.00), ("W-1.02", 1, 42.00), ("W-1.03", 2, 52.00),
        ("W-1.04", 2, 56.00), ("W-1.05", 2, 60.00), ("W-1.06", 3, 70.00),
        ("W-1.07", 3, 74.00), ("W-1.08", 3, 78.00), ("W-1.09", 3, 82.00),
        ("W-1.10", 4, 108.00),
    ],
    "2.{NB}Obergeschoss": [
        ("W-2.01", 1, 40.00), ("W-2.02", 2, 54.00), ("W-2.03", 2, 58.00),
        ("W-2.04", 2, 58.00), ("W-2.05", 2, 62.00), ("W-2.06", 3, 68.00),
        ("W-2.07", 3, 72.00), ("W-2.08", 3, 76.00), ("W-2.09", 3, 80.00),
        ("W-2.10", 4, 92.00),
    ],
    "3.{NB}Obergeschoss": [
        ("W-3.01", 1, 40.00), ("W-3.02", 2, 56.00), ("W-3.03", 2, 60.00),
        ("W-3.04", 3, 70.00), ("W-3.05", 3, 74.00), ("W-3.06", 3, 74.00),
        ("W-3.07", 3, 78.00), ("W-3.08", 3, 82.00), ("W-3.09", 4, 96.00),
    ],
    "4.{NB}Obergeschoss": [
        ("W-4.01", 1, 42.00), ("W-4.02", 2, 54.00), ("W-4.03", 2, 58.00),
        ("W-4.04", 3, 68.00), ("W-4.05", 3, 72.00), ("W-4.06", 3, 76.00),
        ("W-4.07", 3, 80.00), ("W-4.08", 3, 80.00), ("W-4.09", 4, 100.00),
    ],
    "5.{NB}Obergeschoss": [
        ("W-5.01", 2, 60.00), ("W-5.02", 4, 92.00), ("W-5.03", 4, 96.00),
        ("W-5.04", 4, 100.00), ("W-5.05", 4, 104.00), ("W-5.06", 5, 118.00),
    ],
    "6.{NB}Obergeschoss": [
        ("W-6.01", 5, 112.00), ("W-6.02", 5, 116.00), ("W-6.03", 5, 120.00),
        ("W-6.04", 5, 122.00),
    ],
}

# Stadthaus ground floor: commercial units, NUF per DIN 277.
C_COMMERCIAL = [
    ("G-0.01", "Gewerbeeinheit 1, zum Grünzug", 320.00),
    ("G-0.02", "Gewerbeeinheit 2, zum Grünzug", 300.00),
    ("G-0.03", "Gewerbeeinheit 3, Ecklage", 240.00),
    ("G-0.04", "Anlieferungs- und Abfallraum, gemeinsam", 60.00),
]

ROOM_TYPE_DE = {1: "1{NB}Zimmer", 2: "2{NB}Zimmer", 3: "3{NB}Zimmer",
                4: "4{NB}Zimmer", 5: "5{NB}Zimmer"}


def _apartment_mix(schedules: dict) -> list[tuple[str, int, float, float]]:
    """Derive the apartment type mix from the per-storey schedules."""
    buckets: dict[int, list[float]] = {}
    for rows in schedules.values():
        for _, rooms, wfl in rows:
            buckets.setdefault(rooms, []).append(wfl)
    return [
        (ROOM_TYPE_DE[rooms], len(areas), min(areas), max(areas))
        for rooms, areas in sorted(buckets.items())
    ]


for _label, _entry in zip([e[0] for e in A_STOREYS], A_STOREYS):
    check(
        round(sum(r[2] for r in A_ROOMS[_label]), 2) == _entry[3],
        f"Kontorhaus room schedule {_label} does not sum to the storey NUF",
    )
for _entry in B_STOREYS:
    rows = B_APARTMENTS[_entry[0]]
    check(round(sum(r[2] for r in rows), 2) == _entry[3],
          f"Hofhaus apartment schedule {_entry[0]} does not sum to the storey WFL")
    check(len(rows) == _entry[4],
          f"Hofhaus apartment schedule {_entry[0]} has the wrong unit count")
for _entry in C_STOREYS[1:]:
    rows = C_APARTMENTS[_entry[0]]
    check(round(sum(r[2] for r in rows), 2) == _entry[3],
          f"Stadthaus apartment schedule {_entry[0]} does not sum to the storey WFL")
    check(len(rows) == _entry[5],
          f"Stadthaus apartment schedule {_entry[0]} has the wrong unit count")
check(round(sum(r[2] for r in C_COMMERCIAL), 2) == C_STOREYS[0][4],
      "Stadthaus commercial schedule does not sum to the commercial NUF")

B_MIX = _apartment_mix(B_APARTMENTS)
C_MIX = _apartment_mix(C_APARTMENTS)

check(sum(r[1] for r in B_MIX) == int(m(B, "units")), "Hofhaus derived mix count")
check(sum(r[1] for r in C_MIX) == int(m(C, "units")), "Stadthaus derived mix count")
check(
    round(sum(r[2] for rows in B_APARTMENTS.values() for r in rows), 2)
    == float(m(B, "wfl")),
    "Hofhaus apartment schedules do not sum to the building WFL",
)
check(
    round(sum(r[2] for rows in C_APARTMENTS.values() for r in rows), 2)
    == float(m(C, "wfl")),
    "Stadthaus apartment schedules do not sum to the building WFL",
)

# Storey heights. Not fixture metrics (the fixture carries no height value), so
# these are declared here and used consistently by documents 03 to 06.
HEIGHTS = {
    "B-BLDG-A": {"eg": 4.00, "og": 3.50, "clear_eg": 3.20, "clear_og": 2.85, "ug": None},
    "B-BLDG-B": {"eg": 3.40, "og": 3.00, "clear_eg": 2.60, "clear_og": 2.55, "ug": 2.60},
    "B-BLDG-C": {"eg": 4.20, "og": 3.00, "clear_eg": 3.60, "clear_og": 2.55, "ug": 2.60},
}
BUILDING_HEIGHT = {
    "B-BLDG-A": 4.00 + 5 * 3.50,
    "B-BLDG-B": 3.40 + 4 * 3.00,
    "B-BLDG-C": 4.20 + 6 * 3.00,
}

# --------------------------------------------------------------------------
# Schedule arithmetic, derived from the fixture schedule block
# --------------------------------------------------------------------------


def half_month_date(offset: int) -> date:
    """Offset 0 is the construction start; a step is half a month.

    Even offsets land on the 15th, odd offsets on the last day of the month.
    Offset 37 therefore resolves to 30.09.2028, exactly as the fixture's own
    `totalHalfMonths` asserts.
    """
    start = date.fromisoformat(SCHEDULE["constructionStartDate"])
    months = offset // 2
    year = start.year + (start.month - 1 + months) // 12
    month = (start.month - 1 + months) % 12 + 1
    if offset % 2 == 0:
        return date(year, month, 15)
    if month == 12:
        return date(year, 12, 31)
    return date(year, month + 1, 1) - timedelta(days=1)


check(
    half_month_date(SCHEDULE["totalHalfMonths"]).isoformat()
    == SCHEDULE["plannedCompletionDate"],
    "half-month arithmetic does not reproduce plannedCompletionDate",
)

PHASE_LABELS = {
    "planning": "Planung und Genehmigung",
    "tender": "Vergabe und Mobilisierung",
    "execution:B-BLDG-A": "Ausführung Kontorhaus (B-BLDG-A)",
    "execution:B-BLDG-B": "Ausführung Hofhaus (B-BLDG-B)",
    "execution:B-BLDG-C": "Ausführung Stadthaus (B-BLDG-C)",
    "handover": "Abnahme und Übergabe",
}


def phase_windows() -> list[dict]:
    ends: dict[str, int] = {}
    windows = []
    for phase in SCHEDULE["phases"]:
        predecessor = phase["dependsOn"]
        begin = 0 if predecessor is None else ends[predecessor] - phase["leadHalfMonths"]
        end = begin + phase["durationHalfMonths"]
        ends[phase["id"]] = end
        windows.append(
            {
                "id": phase["id"],
                "label": PHASE_LABELS[phase["id"]],
                "begin": half_month_date(begin),
                "end": half_month_date(end),
                "months": phase["durationHalfMonths"] / 2,
                "dependsOn": predecessor,
                "lead": phase["leadHalfMonths"] / 2,
                "question": phase["dependencyQuestionId"],
            }
        )
    return windows


PHASES = phase_windows()
check(
    PHASES[-1]["end"].isoformat() == SCHEDULE["plannedCompletionDate"],
    "last phase does not end on plannedCompletionDate",
)
TOTAL_MONTHS = SCHEDULE["totalHalfMonths"] / 2
START_DATE = date.fromisoformat(SCHEDULE["constructionStartDate"])
END_DATE = date.fromisoformat(SCHEDULE["plannedCompletionDate"])

# --------------------------------------------------------------------------
# Page geometry and renderer
# --------------------------------------------------------------------------

PAGE_W, PAGE_H = 210.0, 297.0
ML = 20.0                 # left margin
TEXT_W = 148.0            # body column width
MARGIN_X = ML + TEXT_W + 3.0   # marginal tag column
RIGHT_EDGE = 194.0        # header/footer rule right edge
TOP_RULE = 20.0
BODY_TOP = 24.5
FOOT_RULE = 272.0
BODY_BOTTOM = 269.0

LH = 5.0                  # body line height
CELL_PT = 9.2             # type size inside tables
CELL_LH = 4.6             # line height inside a wrapping table cell
COL_TEXT = (35, 35, 35)
COL_GREY = (110, 110, 110)
COL_RULE = (168, 168, 168)
COL_ACCENT = (85, 85, 85)  # the single accent used for structural rules

FILL_LOG: list = []

DEMO_LINE = "DEMO · synthetisches Beispieldokument · keine Vergabegrundlage"
AUTHOR = "All3 · Produktteam Sales Platform 2.0 (synthetisch erzeugt)"


class Doc:
    """One document of the pack: fixed page count, hand-placed content."""

    def __init__(self, spec: dict) -> None:
        self.spec = spec
        self.anchors: list[dict] = []
        self.pdf = FPDF(orientation="P", unit="mm", format="A4")
        self.pdf.set_auto_page_break(False)
        self.pdf.set_margins(ML, BODY_TOP, PAGE_W - ML - TEXT_W)
        self.pdf.set_title(_assert_latin1(f"{spec['title']} · {spec['revision']}"))
        self.pdf.set_author(_assert_latin1(AUTHOR))
        self.pdf.set_subject(
            _assert_latin1(
                f"{PROJECT_NAME} · {PROJECT['city']} · synthetisches Demonstrationsdokument"
            )
        )
        self.pdf.set_keywords(
            _assert_latin1(
                f"{spec['id']} · {spec['planNumber']} · DEMO · keine Vergabegrundlage"
            )
        )
        self.pdf.set_creator("All3 Sales Platform 2.0 document fixture generator")
        self.pdf.set_producer("All3 Sales Platform 2.0 document fixture generator")
        issued = date.fromisoformat(spec["issuedAt"])
        self.pdf.set_creation_date(
            datetime(issued.year, issued.month, issued.day, 9, 0, 0, tzinfo=timezone.utc)
        )
        self.pdf.set_lang("de-DE")

    # -- infrastructure ----------------------------------------------------

    @property
    def page_no(self) -> int:
        return self.pdf.page_no()

    def _hairline(self, y: float, x0: float = ML, x1: float = RIGHT_EDGE,
                  width: float = 0.15, color=COL_RULE) -> None:
        self.pdf.set_draw_color(*color)
        self.pdf.set_line_width(width)
        self.pdf.line(x0, y, x1, y)

    def _header(self) -> None:
        pdf = self.pdf
        pdf.set_text_color(*COL_TEXT)
        pdf.set_font("Helvetica", "B", 9.2)
        pdf.set_xy(ML, 12.6)
        pdf.cell(110, 4.8, _assert_latin1(self.spec["title"]), align="L")
        pdf.set_font("Helvetica", "", 8.8)
        pdf.set_xy(RIGHT_EDGE - 64, 12.6)
        blatt = (
            f"{self.spec['revision']} · Blatt {self.page_no}"
            f"{NB}von{NB}{self.spec['pages']}"
        )
        pdf.cell(64, 4.8, _assert_latin1(blatt), align="R")
        self._hairline(TOP_RULE, width=0.3, color=COL_ACCENT)

    def _footer(self) -> None:
        pdf = self.pdf
        self._hairline(FOOT_RULE)
        pdf.set_font("Helvetica", "", 6.9)
        pdf.set_text_color(*COL_GREY)
        left = (
            f"{PROJECT_NAME} · {PROJECT['city']} · Plan-Nr. {self.spec['planNumber']}"
            f" · Ausgabe {dmy(self.spec['issuedAt'])}"
        )
        pdf.set_xy(ML, FOOT_RULE + 1.4)
        pdf.cell(120, 3.4, _assert_latin1(left), align="L")
        pdf.set_xy(RIGHT_EDGE - 60, FOOT_RULE + 1.4)
        pdf.cell(60, 3.4, _assert_latin1(f"{self.spec['id']} · {AUTHOR_SHORT}"), align="R")
        pdf.set_xy(ML, FOOT_RULE + 5.0)
        pdf.cell(RIGHT_EDGE - ML, 3.4, _assert_latin1(DEMO_LINE), align="L")
        pdf.set_text_color(*COL_TEXT)

    def page(self) -> None:
        if self.pdf.page_no() > 0:
            self._end_page()
        self.pdf.add_page()
        self._header()
        self._footer()
        self.pdf.set_xy(ML, BODY_TOP)

    def _end_page(self) -> None:
        y = self.pdf.get_y()
        FILL_LOG.append((self.spec["file"], self.page_no, round(y, 1)))
        if y > BODY_BOTTOM:
            raise SystemExit(
                f"{self.spec['file']}: page {self.page_no} overflows "
                f"(y={y:.1f} > {BODY_BOTTOM})"
            )

    def finish(self) -> None:
        self._end_page()
        if self.pdf.page_no() != self.spec["pages"]:
            raise SystemExit(
                f"{self.spec['file']}: produced {self.pdf.page_no()} pages, "
                f"declared {self.spec['pages']}"
            )

    # -- blocks ------------------------------------------------------------

    def gap(self, h: float = 2.0) -> None:
        self.pdf.set_y(self.pdf.get_y() + h)

    def rule(self, h_before: float = 1.6, h_after: float = 2.2) -> None:
        self.gap(h_before)
        self._hairline(self.pdf.get_y(), x1=ML + TEXT_W)
        self.gap(h_after)

    def h1(self, text: str) -> None:
        pdf = self.pdf
        pdf.set_x(ML)
        pdf.set_font("Helvetica", "B", 14.0)
        pdf.multi_cell(TEXT_W, 6.8, _assert_latin1(text), align="L",
                       new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.gap(1.6)

    def h2(self, text: str) -> None:
        pdf = self.pdf
        self.gap(1.4)
        pdf.set_x(ML)
        pdf.set_font("Helvetica", "B", 11.4)
        pdf.multi_cell(TEXT_W, 5.6, _assert_latin1(text), align="L",
                       new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.gap(0.8)

    def clause(self, number: str, title: str) -> None:
        pdf = self.pdf
        self.gap(1.6)
        pdf.set_x(ML)
        pdf.set_font("Helvetica", "B", 10.4)
        pdf.multi_cell(TEXT_W, 5.3, _assert_latin1(f"{number}   {title}"), align="L",
                       new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.gap(0.5)

    def p(self, text: str) -> None:
        pdf = self.pdf
        pdf.set_x(ML)
        pdf.set_font("Helvetica", "", 10.2)
        pdf.multi_cell(TEXT_W, LH, _assert_latin1(text), align="L",
                       new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.gap(1.0)

    def small(self, text: str) -> None:
        pdf = self.pdf
        pdf.set_x(ML)
        pdf.set_font("Helvetica", "", 8.8)
        pdf.set_text_color(*COL_GREY)
        pdf.multi_cell(TEXT_W, 4.4, _assert_latin1(text), align="L",
                       new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_text_color(*COL_TEXT)
        self.gap(1.0)

    def bullets(self, items: list[str], marker: str = "-") -> None:
        pdf = self.pdf
        pdf.set_font("Helvetica", "", 10.2)
        for item in items:
            y = pdf.get_y()
            pdf.set_xy(ML + 1.5, y)
            pdf.cell(4.5, LH, marker, align="L")
            pdf.set_xy(ML + 6.0, y)
            pdf.multi_cell(TEXT_W - 6.0, LH, _assert_latin1(item), align="L",
                           new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.gap(1.0)

    def numbered(self, start: str, items: list[str]) -> None:
        """Numbered clauses like 4.1, 4.2 ... with `start` = "4"."""
        pdf = self.pdf
        for index, item in enumerate(items, start=1):
            label = f"{start}.{index}"
            y = pdf.get_y()
            pdf.set_font("Helvetica", "B", 10.2)
            pdf.set_xy(ML, y)
            pdf.cell(13.0, LH, _assert_latin1(label), align="L")
            pdf.set_font("Helvetica", "", 10.2)
            pdf.set_xy(ML + 13.0, y)
            pdf.multi_cell(TEXT_W - 13.0, LH, _assert_latin1(item), align="L",
                           new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.gap(0.7)
        self.gap(0.6)

    def kv(self, rows: list[tuple[str, str]], key_w: float = 60.0) -> None:
        pdf = self.pdf
        for key, value in rows:
            y = pdf.get_y()
            pdf.set_font("Helvetica", "", 10.2)
            pdf.set_text_color(*COL_GREY)
            pdf.set_xy(ML, y)
            pdf.cell(key_w, LH, _assert_latin1(key), align="L")
            pdf.set_text_color(*COL_TEXT)
            pdf.set_font("Helvetica", "B", 10.2)
            pdf.set_xy(ML + key_w, y)
            pdf.multi_cell(TEXT_W - key_w, LH, _assert_latin1(value), align="L",
                           new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.gap(1.4)

    def table(
        self,
        headers: list[str],
        rows: list[list[str]],
        widths: list[float],
        aligns: list[str],
        total: list[str] | None = None,
        caption: str | None = None,
        row_h: float = 5.4,
    ) -> None:
        pdf = self.pdf
        assert abs(sum(widths) - TEXT_W) < 0.51, (sum(widths), self.spec["file"])
        if caption:
            pdf.set_x(ML)
            pdf.set_font("Helvetica", "B", 9.4)
            pdf.multi_cell(TEXT_W, 4.9, _assert_latin1(caption), align="L",
                           new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.gap(0.6)
        # header
        self._hairline(pdf.get_y(), x1=ML + TEXT_W, width=0.3, color=COL_ACCENT)
        self.gap(0.6)
        y = pdf.get_y()
        pdf.set_font("Helvetica", "B", 9.0)
        x = ML
        for head, width, align in zip(headers, widths, aligns):
            pdf.set_xy(x, y)
            pdf.multi_cell(width, 4.5, _assert_latin1(head), align=align,
                           new_x=XPos.RIGHT, new_y=YPos.TOP)
            x += width
        head_lines = max(
            len(pdf.multi_cell(w, 4.5, _assert_latin1(h), align=a, dry_run=True,
                               output="LINES"))
            for h, w, a in zip(headers, widths, aligns)
        )
        pdf.set_y(y + head_lines * 4.5 + 0.9)
        self._hairline(pdf.get_y(), x1=ML + TEXT_W)
        self.gap(0.5)
        # body
        pdf.set_font("Helvetica", "", CELL_PT)
        for row in rows:
            self._table_row(row, widths, aligns, row_h)
        if total is not None:
            self._hairline(pdf.get_y() + 0.3, x1=ML + TEXT_W)
            self.gap(0.9)
            pdf.set_font("Helvetica", "B", CELL_PT)
            self._table_row(total, widths, aligns, row_h)
        self._hairline(pdf.get_y() + 0.3, x1=ML + TEXT_W, width=0.3, color=COL_ACCENT)
        self.gap(2.6)

    def _table_row(self, row: list[str], widths: list[float], aligns: list[str],
                   row_h: float) -> None:
        """One table row whose cells wrap; the row grows with its tallest cell."""
        pdf = self.pdf
        counts = []
        for cell, width, align in zip(row, widths, aligns):
            counts.append(
                len(
                    pdf.multi_cell(
                        width, CELL_LH, _assert_latin1(cell), align=align,
                        dry_run=True, output="LINES",
                    )
                )
                or 1
            )
        lines = max(counts)
        height = row_h if lines <= 1 else lines * CELL_LH + 1.6
        y = pdf.get_y()
        x = ML
        for cell, width, align in zip(row, widths, aligns):
            pdf.set_xy(x, y)
            pdf.multi_cell(width, CELL_LH, _assert_latin1(cell), align=align,
                           new_x=XPos.RIGHT, new_y=YPos.TOP)
            x += width
        pdf.set_y(y + height)

    # -- evidence anchors --------------------------------------------------

    def mark(self, suffix: str, label_de: str, label_en: str, dy: float = 0.0) -> None:
        """Register an evidence anchor and print its marginal tag."""
        anchor_id = f"{self.spec['id']}-{suffix}"
        for label in (label_de, label_en):
            if len(label) > 60:
                raise SystemExit(f"{anchor_id}: label longer than 60 chars: {label!r}")
            if label.endswith("."):
                raise SystemExit(f"{anchor_id}: label must not end with a period")
        for existing in self.anchors:
            if existing["id"] == anchor_id:
                raise SystemExit(f"duplicate anchor id {anchor_id}")
            if existing["labelDe"] == label_de:
                raise SystemExit(f"duplicate anchor label {label_de} in {anchor_id}")
        self.anchors.append(
            {
                "id": anchor_id,
                "page": self.page_no,
                "labelDe": label_de,
                "labelEn": label_en,
            }
        )
        pdf = self.pdf
        y = pdf.get_y() + dy
        pdf.set_font("Courier", "", 6.8)
        pdf.set_text_color(*COL_GREY)
        pdf.text(MARGIN_X, y + 3.2, _assert_latin1(anchor_id))
        self._hairline(y + 4.4, x0=MARGIN_X, x1=MARGIN_X + 20.6, width=0.15)
        pdf.set_text_color(*COL_TEXT)
        pdf.set_font("Helvetica", "", 10.2)


AUTHOR_SHORT = "All3 DEMO"


# --------------------------------------------------------------------------
# Document register
# --------------------------------------------------------------------------
# Chronology: one credible story, all issue dates in 2026 and all strictly
# before the project's own portfolio.updatedAt (29.08.2026). The client brief
# opens the pack; the area reconciliation and the TGA requirements carry Rev C
# and close it.

DOC_SPECS = [
    {
        "id": "LEI-DOC-01",
        "file": "01_Projektbeschreibung_Quartier_RevB.pdf",
        "title": "Projektbeschreibung Quartier Am Güterbogen",
        "documentType": "projectDescription",
        "revision": "Rev B",
        "pages": 6,
        "issuedAt": "2026-03-24",
        "planNumber": "AGB-PB-001",
        "projectLevel": True,
        "buildingIds": ["B-BLDG-A", "B-BLDG-B", "B-BLDG-C"],
        "intendedUse": "evidence-source",
    },
    {
        "id": "LEI-DOC-02",
        "file": "02_Lageplan_RevC.pdf",
        "title": "Lageplan und Erschließungskonzept",
        "documentType": "sitePlan",
        "revision": "Rev C",
        "pages": 2,
        "issuedAt": "2026-04-08",
        "planNumber": "AGB-LP-002",
        "projectLevel": True,
        "buildingIds": ["B-BLDG-A", "B-BLDG-B", "B-BLDG-C"],
        "intendedUse": "evidence-source",
    },
    {
        "id": "LEI-DOC-03",
        "file": "03_Grundrisse_Kontorhaus_RevB.pdf",
        "title": "Grundrisse Kontorhaus (B-BLDG-A)",
        "documentType": "floorPlans",
        "revision": "Rev B",
        "pages": 8,
        "issuedAt": "2026-05-12",
        "planNumber": "AGB-A-GR-003",
        "projectLevel": False,
        "buildingIds": ["B-BLDG-A"],
        "intendedUse": "evidence-source",
    },
    {
        "id": "LEI-DOC-04",
        "file": "04_Grundrisse_Hofhaus_RevB.pdf",
        "title": "Grundrisse Hofhaus (B-BLDG-B)",
        "documentType": "floorPlans",
        "revision": "Rev B",
        "pages": 10,
        "issuedAt": "2026-05-12",
        "planNumber": "AGB-B-GR-004",
        "projectLevel": False,
        "buildingIds": ["B-BLDG-B"],
        "intendedUse": "evidence-source",
    },
    {
        "id": "LEI-DOC-05",
        "file": "05_Grundrisse_Stadthaus_RevC.pdf",
        "title": "Grundrisse Stadthaus (B-BLDG-C)",
        "documentType": "floorPlans",
        "revision": "Rev C",
        "pages": 10,
        "issuedAt": "2026-06-03",
        "planNumber": "AGB-C-GR-005",
        "projectLevel": False,
        "buildingIds": ["B-BLDG-C"],
        "intendedUse": "evidence-source",
    },
    {
        "id": "LEI-DOC-06",
        "file": "06_Schnitte_und_Ansichten_RevB.pdf",
        "title": "Schnitte und Ansichten Quartier",
        "documentType": "sectionElevation",
        "revision": "Rev B",
        "pages": 6,
        "issuedAt": "2026-06-17",
        "planNumber": "AGB-SA-006",
        "projectLevel": False,
        "buildingIds": ["B-BLDG-A", "B-BLDG-B", "B-BLDG-C"],
        "intendedUse": "evidence-source",
    },
    {
        "id": "LEI-DOC-07",
        "file": "07_Flaechenberechnung_DIN277_WoFlV_RevC.pdf",
        "title": "Flächenberechnung nach DIN 277 und WoFlV",
        "documentType": "areaSchedule",
        "revision": "Rev C",
        "pages": 8,
        "issuedAt": "2026-07-22",
        "planNumber": "AGB-FB-007",
        "projectLevel": True,
        "buildingIds": ["B-BLDG-A", "B-BLDG-B", "B-BLDG-C"],
        "intendedUse": "evidence-source",
    },
    {
        "id": "LEI-DOC-08",
        "file": "08_Baubeschreibung_RevB.pdf",
        "title": "Baubeschreibung Quartier Am Güterbogen",
        "documentType": "buildingDescription",
        "revision": "Rev B",
        "pages": 12,
        "issuedAt": "2026-07-08",
        "planNumber": "AGB-BB-008",
        "projectLevel": True,
        "buildingIds": ["B-BLDG-A", "B-BLDG-B", "B-BLDG-C"],
        "intendedUse": "evidence-source",
    },
    {
        "id": "LEI-DOC-09",
        "file": "09_TGA_Anforderungen_RevC.pdf",
        "title": "TGA-Anforderungen Quartier Am Güterbogen",
        "documentType": "technicalConcept",
        "revision": "Rev C",
        "pages": 10,
        "issuedAt": "2026-08-19",
        "planNumber": "AGB-TGA-009",
        "projectLevel": True,
        "buildingIds": ["B-BLDG-A", "B-BLDG-B", "B-BLDG-C"],
        "intendedUse": "evidence-source",
    },
    {
        "id": "LEI-DOC-10",
        "file": "10_Schnittstellen_Hausanschluesse_RevB.pdf",
        "title": "Schnittstellen und Hausanschlüsse",
        "documentType": "interfaces",
        "revision": "Rev B",
        "pages": 5,
        "issuedAt": "2026-08-05",
        "planNumber": "AGB-SS-010",
        "projectLevel": True,
        "buildingIds": ["B-BLDG-A", "B-BLDG-B", "B-BLDG-C"],
        "intendedUse": "evidence-source",
    },
    {
        "id": "LEI-DOC-11",
        "file": "11_Terminrahmen_RevB.pdf",
        "title": "Terminrahmen Quartier Am Güterbogen",
        "documentType": "schedule",
        "revision": "Rev B",
        "pages": 4,
        "issuedAt": "2026-08-26",
        "planNumber": "AGB-TR-011",
        "projectLevel": True,
        "buildingIds": ["B-BLDG-A", "B-BLDG-B", "B-BLDG-C"],
        "intendedUse": "evidence-source",
    },
    {
        "id": "LEI-DOC-12",
        "file": "12_Planungsanforderungen_und_Freigaben_RevB.pdf",
        "title": "Planungsanforderungen und Freigaben",
        "documentType": "planningRequirements",
        "revision": "Rev B",
        "pages": 6,
        "issuedAt": "2026-09-02",
        "planNumber": "AGB-PA-012",
        "projectLevel": True,
        "buildingIds": ["B-BLDG-A", "B-BLDG-B", "B-BLDG-C"],
        "intendedUse": "evidence-source",
    },
]

SPEC_BY_ID = {spec["id"]: spec for spec in DOC_SPECS}

# --------------------------------------------------------------------------
# Re-sent copies
# --------------------------------------------------------------------------
# A client folder contains the same file twice more often than it contains a
# wrong one: a plan is forwarded a second time under the name the mail client
# gave it. That record is NOT a thirteenth authored document — it is the same
# bytes, arriving twice, and the pack declares it as such. The manifest keeps
# its "twelve authored files" statement literally true and lists the re-sent
# copy separately, pointing at the file it duplicates; nothing is generated
# for it, because generating a second, subtly different PDF would make the
# register's «inhaltsgleiches Doppel» a lie.
DUPLICATE_SPECS = [
    {
        "id": "LEI-DOC-13",
        "duplicateOf": "LEI-DOC-03",
        # The name the client's mail client produced on the second send.
        "uploadName": "Grundrisse Kontorhaus (1).pdf",
        "receivedAt": "2026-05-19",
    },
]


def cover(doc: Doc, rows: list[tuple[str, str]]) -> None:
    """Standard identification block at the top of sheet 1."""
    doc.h1(doc.spec["title"])
    doc.small(
        f"{PROJECT_NAME} · {ADDRESS} · Bauherr {CLIENT} · "
        f"Verfasser {AUTHOR} · Ausgabe {dmy_long(doc.spec['issuedAt'])}"
    )
    doc.kv(rows)


def building_row(building: dict) -> list[str]:
    return [
        building["id"],
        building["name"],
        usage(building),
        storeys(building),
        underground(building),
    ]



def room_schedule(doc: Doc, label: str, rows: list, total_label: str,
                  caption: str) -> None:
    """Room schedule of one storey; the sum row is the storey figure."""
    doc.table(
        ["Raum-Nr.", "Bezeichnung", "NUF"],
        [[number, name, de(value)] for number, name, value in rows],
        [24.0, 94.0, 30.0],
        ["L", "L", "R"],
        total=["", total_label, de(round(sum(r[2] for r in rows), 2))],
        caption=caption,
    )


def apartment_schedule(doc: Doc, rows: list, total_label: str,
                       caption: str) -> None:
    """Apartment schedule of one storey; the sum row is the storey WFL."""
    doc.table(
        ["Wohnung", "Wohnungstyp", "WFL nach WoFlV"],
        [[number, lbl(ROOM_TYPE_DE[rooms]), de(wfl)] for number, rooms, wfl in rows],
        [30.0, 78.0, 40.0],
        ["L", "L", "R"],
        total=["", total_label, de(round(sum(r[2] for r in rows), 2))],
        caption=caption,
    )


# --------------------------------------------------------------------------
# 01 Projektbeschreibung (6 Blatt)
# --------------------------------------------------------------------------


def build_01(doc: Doc) -> None:
    s = doc.spec

    doc.page()
    cover(
        doc,
        [
            ("Dokument", f"{s['title']} · {s['revision']}"),
            ("Plan-Nr.", s["planNumber"]),
            ("Projekt", f"{PROJECT_NAME} · {PROJECT['region']}"),
            ("Bauherr", CLIENT),
            ("Gebäude", "3 (Kontorhaus, Hofhaus, Stadthaus)"),
            ("Leistungsstand", "Vorplanung, Grundlage der indikativen Angebotserstellung"),
        ],
    )
    doc.clause("1", "Zweck und Geltung")
    doc.p(
        "Diese Projektbeschreibung fasst die vom Auftraggeber übergebenen Vorgaben für das "
        "Quartier Am Güterbogen zusammen und bildet die textliche Grundlage für die "
        "Angebotskalkulation. Sie beschreibt Nutzungen, Prioritäten und Zieltermine; "
        "Flächen sind ausschließlich in der Flächenberechnung nach DIN 277 und WoFlV "
        "verbindlich geführt und werden hier nicht zweitgeführt."
    )
    doc.p(
        "Bei Widerspruch zwischen dieser Beschreibung und einer herausgegebenen Zeichnung "
        "gilt die Zeichnung. Bei Widerspruch zwischen dieser Beschreibung und der "
        "Flächenberechnung gilt die Flächenberechnung. Beide Vorrangregeln sind zwischen "
        "Auftraggeber und Planungsbeteiligten abgestimmt und gelten für alle Revisionen."
    )
    doc.clause("2", "Revisionsverzeichnis")
    doc.table(
        ["Revision", "Datum", "Änderung", "Status"],
        [
            ["Rev A", "17.03.2026", "Erstfassung nach Auftaktgespräch", "überholt"],
            ["Rev A.1", "20.03.2026", "Nutzungsverteilung Stadthaus präzisiert", "überholt"],
            [
                "Rev B",
                dmy(s["issuedAt"]),
                "Prioritäten und Zieltermine bestätigt, Flächen ausgegliedert",
                "gültig",
            ],
        ],
        [22.0, 22.0, 84.0, 20.0],
        ["L", "L", "L", "L"],
    )
    doc.small(
        "Rev B ersetzt Rev A und Rev A.1 vollständig. Angaben aus überholten Revisionen "
        "sind nicht heranzuziehen, auch wenn sie in Umlaufmappen weiter vorliegen."
    )

    doc.page()
    doc.h2("3   Standort und Quartierskonzept")
    doc.clause("3.1", "Lage")
    doc.p(
        f"Das Vorhaben liegt an der Adresse {ADDRESS} am nördlichen Rand eines früheren "
        "Güterbahn- und Logistikareals. Das Areal ist an drei Seiten von Bestandsbebauung "
        "gefasst, im Süden grenzt es an den ehemaligen Gleisbogen, der als Grünzug "
        "entwickelt wird. Die städtebauliche Figur ist ein geschlossener Block mit "
        "durchgestecktem Hof."
    )
    doc.clause("3.2", "Bestand und Vorbelastung")
    doc.p(
        "Die vorhandenen Hallenfundamente und Gleisreste werden im Rahmen der "
        "Baufeldfreimachung zurückgebaut. Der Auftraggeber führt die Baufeldfreimachung "
        "einschließlich Kampfmittelfreigabe und Bodenaustausch als eigenes Vorlos; sie ist "
        "nicht Bestandteil der hier beschriebenen Leistung. Die Übergabe des Baufeldes "
        "erfolgt geräumt, eben und tragfähig."
    )
    doc.clause("3.3", "Quartiersidee")
    doc.p(
        "Drei Häuser mit eigener Adresse und eigenem Erschließungskern bilden den Block: "
        "ein Bürohaus an der lauten Nordkante, ein reines Wohnhaus am geschützten Hof und "
        "ein gemischt genutztes Haus an der südlichen Ecke, das das Erdgeschoss zum Grünzug "
        "öffnet. Die Häuser sind konstruktiv und brandschutztechnisch getrennt und werden "
        "als drei Bauwerke geführt, auch wenn das Untergeschoss des Hofhauses und das "
        "Teil-Untergeschoss des Stadthauses baulich benachbart liegen."
    )
    doc.clause("3.4", "Freianlagen")
    doc.p(
        "Der Innenhof wird als gemeinschaftliche Fläche mit Spiel- und Aufenthaltsbereichen "
        "ausgebildet, die Dachflächen der Wohnhäuser erhalten extensive Begrünung mit "
        "Retentionsaufbau. Die Freianlagenplanung ist ein eigenes Los und wird in dieser "
        "Beschreibung nur insoweit erwähnt, wie sie Schnittstellen zum Hochbau erzeugt: "
        "Hofentwässerung, Anschlusshöhen der Eingänge und Zufahrt zur Tiefgarage."
    )
    doc.clause("3.5", "Nachbarschaft und Rücksichtnahme")
    doc.p(
        "Die Bestandsbebauung im Westen wird während der Ausführung durchgängig bewohnt. "
        "Der Auftraggeber verlangt ein Baustellenkonzept, das Erschütterungen und "
        "Staubemission begrenzt und die Zufahrt ausschließlich über die Nordkante führt. "
        "Die Anforderung wirkt auf Baustelleneinrichtung und Bauzeit und ist in der "
        "Baubeschreibung sowie im Terminrahmen berücksichtigt."
    )

    doc.page()
    doc.h2("4   Gebäude und Nutzungen")
    doc.p(
        "Die drei Häuser werden mit den folgenden Kennungen geführt. Die Kennung ist in "
        "allen Unterlagen des Projekts identisch zu verwenden; Hausnummern und Bauteilnamen "
        "sind keine Kennungen."
    )
    doc.mark("A01", "Gebäudekennungen und Zuordnung der drei Häuser",
             "Building identifiers and assignment of the three buildings")
    doc.table(
        ["Kennung", "Name", "Nutzung", "Geschosse", "Untergeschoss"],
        [building_row(b) for b in ORDER],
        [24.0, 24.0, 46.0, 26.0, 28.0],
        ["L", "L", "L", "L", "L"],
    )
    doc.mark("A02", "Nutzungsverteilung je Gebäude",
             "Use distribution per building")
    doc.clause("4.1", "Kontorhaus (B-BLDG-A)")
    doc.p(
        f"Bürohaus mit {usage(A).lower()}. {storeys(A)}, {underground(A)}. Das Erdgeschoss "
        "nimmt Empfang, Konferenzzone und Nebenräume auf, die Obergeschosse sind als "
        "Regelgeschosse für flexible Bürostrukturen ausgelegt. Der Auftraggeber gibt eine "
        f"Zielbelegung von {cnt(m(A, 'workplaces'), 'Arbeitsplätzen')} vor."
    )
    doc.clause("4.2", "Hofhaus (B-BLDG-B)")
    doc.p(
        f"Wohnhaus mit {usage(B).lower()} am Innenhof. {storeys(B)}, {underground(B)}. "
        f"Der Wohnungsschlüssel ist auf {cnt(m(B, 'units'), 'Wohneinheiten')} abgestimmt, "
        "das Untergeschoss nimmt Stellplätze, Abstellräume und die Hausanschlussräume auf."
    )
    doc.clause("4.3", "Stadthaus (B-BLDG-C)")
    doc.p(
        f"Gemischt genutztes Haus: {usage(C)}. {storeys(C)}, {underground(C)}. Das "
        "Erdgeschoss ist zum Grünzug orientiert und für kleinteilige gewerbliche Nutzung "
        "vorgesehen; die Obergeschosse sind Wohnungen mit "
        f"{cnt(m(C, 'units'), 'Wohneinheiten')}. Das Untergeschoss ist bewusst nur "
        "teilweise unterbaut, weil die südliche Baugrenze eine durchgehende Unterbauung "
        "nicht zulässt."
    )
    doc.clause("4.4", "Was hier nicht geführt wird")
    doc.p(
        "Flächenangaben, Stellplatzzahlen und Wohnungszahlen sind in dieser Beschreibung "
        "nur als Zielgrößen genannt, soweit sie eine Vorgabe des Auftraggebers sind. "
        "Verbindlich sind die Grundrisse der jeweiligen Häuser und die Flächenberechnung; "
        "im Konfliktfall gilt die in Abschnitt 1 festgelegte Vorrangregel."
    )

    doc.page()
    doc.h2("5   Prioritäten des Auftraggebers")
    doc.p(
        "Die folgenden Prioritäten sind im Auftaktgespräch und im Nachtrag zum "
        "Auftraggeberbrief festgehalten und in dieser Reihenfolge zu gewichten. Sie sind "
        "die Entscheidungsgrundlage, wenn Termin, Kosten und Ausführungsqualität in "
        "Konflikt geraten."
    )
    doc.mark("A03", "Prioritätenreihenfolge des Auftraggebers",
             "Client priority order")
    doc.numbered(
        "5",
        [
            "Termintreue der Gesamtfertigstellung. Der Auftraggeber hat Vermietungszusagen "
            "für das Kontorhaus, die an das Fertigstellungsdatum gebunden sind. Eine "
            "Verschiebung der Gesamtfertigstellung ist die teuerste Abweichung.",
            "Wohnungsanzahl und Wohnungsschlüssel. Die Anzahl der Wohneinheiten und die "
            "Verteilung der Wohnungsgrößen sind Teil der Finanzierungsannahme und dürfen "
            "nicht zur Optimierung anderer Ziele reduziert werden.",
            "Energetischer Standard und Förderfähigkeit. Der Wohnungsbau ist "
            "förderfähig auszubilden; der dafür erforderliche Standard hat Vorrang vor "
            "Ausbauwünschen.",
            "Holzbauanteil und Sichtholz im Wohnungsbau. Der Auftraggeber wünscht einen "
            "erkennbaren Holzbauanteil, insbesondere sichtbare Deckenuntersichten in den "
            "Wohnungen des Hofhauses.",
            "Ausbaustandard der Gewerbeeinheiten. Das Erdgeschoss des Stadthauses wird "
            "als Rohbau plus Basisausbau übergeben; der mieterspezifische Ausbau ist nicht "
            "Teil dieser Leistung.",
            "Gestaltqualität der Fassade zum Grünzug. Die Südfassade des Stadthauses ist "
            "das Gesicht des Quartiers und wird gegenüber der Hofseite höherwertig "
            "ausgebildet.",
        ],
    )
    doc.clause("5.7", "Umgang mit Konflikten zwischen Prioritäten")
    doc.p(
        "Ein Zielkonflikt wird nicht planerisch aufgelöst, sondern dem Auftraggeber mit "
        "Mengen- und Terminfolge vorgelegt. Entscheidungen werden schriftlich festgehalten "
        "und erzeugen eine neue Revision der betroffenen Unterlage."
    )
    doc.clause("5.8", "Bekannte Zielkonflikte")
    doc.bullets(
        [
            "Termintreue gegen Holzbauanteil: der Vorfertigungsgrad verkürzt die "
            "Ausführung, verlängert aber die Werkplanung vor Ausführungsbeginn.",
            "Förderfähigkeit gegen Dachbegrünung: ein höherer energetischer Standard "
            "verlangt Photovoltaik auf den Wohnhäusern, die geforderte Retention und "
            "Begrünung belegt dieselbe Fläche.",
            "Sichtholz gegen Brandschutz in der Gebäudeklasse 5: sichtbare "
            "Deckenuntersichten setzen eine Abstimmung mit der Behörde voraus.",
            "Gestaltqualität der Südfassade gegen Kosten: die Klinkerschale ist die "
            "teuerste Fassade des Quartiers.",
        ]
    )

    doc.page()
    doc.h2("6   Zieltermine")
    doc.mark("A04", "Zieltermine Baubeginn und Gesamtfertigstellung",
             "Target dates for construction start and overall completion")
    doc.kv(
        [
            ("Baubeginn (Ziel)", dmy_long(SCHEDULE["constructionStartDate"])),
            ("Gesamtfertigstellung (Ziel)", dmy_long(SCHEDULE["plannedCompletionDate"])),
            ("Gesamtdauer", f"{de(TOTAL_MONTHS, 1)}{NB}Monate"),
            ("Übergabeform (Basis)", "eine Übergabe des gesamten Quartiers"),
        ]
    )
    doc.p(
        "Der Baubeginn setzt die Baufeldfreimachung durch den Auftraggeber sowie die "
        "Baugenehmigung voraus. Der Terminrahmen mit Phasen, Abhängigkeiten und Vorläufen "
        "ist gesondert geführt; diese Beschreibung nennt nur die beiden Ecktermine, an die "
        "der Auftraggeber gebunden ist."
    )
    doc.clause("6.1", "Bindung der Ecktermine")
    doc.p(
        "Beide Ecktermine sind Zieltermine im Sinne der Angebotsgrundlage und werden erst "
        "mit der Beauftragung Vertragstermine. Zwischentermine für einzelne Häuser sind "
        "nicht vereinbart; eine abschnittsweise Übergabe ist ausdrücklich offen und in "
        "Abschnitt 8 als offener Punkt geführt."
    )
    doc.h2("7   Wirtschaftliche Rahmenbedingungen")
    doc.clause("7.1", "Vergabeform")
    doc.p(
        "Vorgesehen ist die Beauftragung einer Gesamtleistung Rohbau und Ausbau je Haus mit "
        "gemeinsamer Baustelleneinrichtung. Die Freianlagen, die Baufeldfreimachung und die "
        "Hausanschlüsse der Medienträger bleiben eigene Lose des Auftraggebers."
    )
    doc.clause("7.2", "Preisbasis und Nebenkosten")
    doc.p(
        "Die Angebotserstellung erfolgt auf Preisbasis des Ausgabedatums dieser Revision "
        "ohne Berücksichtigung eines Regionalfaktors. Baunebenkosten, Grundstück und "
        "Finanzierung sind nicht Bestandteil der beauftragten Leistung."
    )
    doc.clause("7.3", "Förderkulisse")
    doc.p(
        "Der Auftraggeber prüft eine Förderung für den Wohnungsbau. Die Anforderungen an "
        "den energetischen Standard und an die Nachhaltigkeitszertifizierung sind in den "
        "Planungsanforderungen geführt; sie sind zum Stand dieser Revision Absicht und "
        "keine bestätigte Förderzusage."
    )

    doc.page()
    doc.h2("8   Offene Punkte und Annahmen")
    doc.p(
        "Die folgenden Punkte sind zum Ausgabedatum dieser Revision nicht entschieden. "
        "Jeder Punkt nennt die getroffene Annahme, damit kalkuliert werden kann, und die "
        "Stelle, an der die Entscheidung nachzutragen ist."
    )
    doc.mark("A05", "Offene Punkte und getroffene Annahmen",
             "Open points and the assumptions taken")
    doc.table(
        ["Punkt", "Sachstand", "Annahme für die Kalkulation"],
        [
            [
                "Übergabeform",
                "offen (B-Q-08)",
                "eine Übergabe zum Gesamtfertigstellungstermin",
            ],
            [
                "Telekommunikations-\nanbindung",
                "offen, widersprüchlich",
                "Leerrohrtrasse bis Hausanschlussraum, aktive Technik bauseits nicht "
                "enthalten",
            ],
            [
                "Regionalfaktor",
                "nicht aktiviert",
                "Kalkulation auf Bundesdurchschnitt",
            ],
            [
                "Gewerbemieter Stadthaus",
                "nicht benannt",
                "Basisausbau ohne mieterspezifische Technik",
            ],
            [
                "Förderzusage Wohnungsbau",
                "in Prüfung",
                "energetischer Standard nach Planungsanforderungen",
            ],
        ],
        [34.0, 34.0, 80.0],
        ["L", "L", "L"],
    )
    doc.small(
        "Die offenen Punkte sind bewusst als Annahme kalkuliert und nicht ausgeschlossen. "
        "Wird ein Punkt anders entschieden, ist die Mengen- und Terminfolge fortzuschreiben."
    )
    doc.h2("9   Mitgeltende Unterlagen")
    doc.table(
        ["Plan-Nr.", "Unterlage", "Revision"],
        [
            [spec["planNumber"], spec["title"], spec["revision"]]
            for spec in DOC_SPECS
            if spec["id"] != "LEI-DOC-01"
        ],
        [26.0, 96.0, 26.0],
        ["L", "L", "L"],
    )


# --------------------------------------------------------------------------
# 02 Lageplan (2 Blatt)
# --------------------------------------------------------------------------


def build_02(doc: Doc) -> None:
    s = doc.spec

    doc.page()
    cover(
        doc,
        [
            ("Dokument", f"{s['title']} · {s['revision']}"),
            ("Plan-Nr.", s["planNumber"]),
            ("Maßstab der Zeichnung", "1:500 (zeichnerischer Teil, gesondertes Blatt)"),
            ("Höhenbezug", "Normalhöhennull, Bezugspunkt siehe Abschnitt 4"),
        ],
    )
    doc.clause("1", "Grundstück und Flurstücke")
    doc.p(
        "Das Vorhaben liegt auf einem zusammenhängenden Baufeld am nördlichen Rand des "
        "früheren Güterareals. Das Baufeld ist aus mehreren Flurstücken zusammengelegt; die "
        "Vereinigung ist beim Auftraggeber in Bearbeitung und zum Ausgabedatum dieser "
        "Revision nicht im Liegenschaftskataster vollzogen."
    )
    doc.mark("A01", "Grundstücksfläche: kein bestätigter Wert",
             "Site area: no confirmed value available")
    doc.p(
        "Eine vermessungsrechtlich bestätigte Grundstücksfläche liegt daher nicht vor. Die "
        "Grundstücksfläche wird in diesem Lageplan bewusst nicht beziffert und ist auch "
        "keinem der drei Gebäude zugeordnet: sie entfällt auf Gebäudeebene, weil das "
        "Quartier auf einem gemeinsamen Baufeld steht und eine Teilung nicht vorgesehen "
        "ist. Der Wert ist nach Vollzug der Vereinigung nachzutragen; bis dahin darf keine "
        "Ersatzzahl gebildet werden."
    )
    doc.small(
        "Hinweis für die Weiterverarbeitung: fehlender Wert bedeutet fehlender Wert. Eine "
        "Grundstücksfläche von null ist an dieser Stelle sachlich falsch und ausdrücklich "
        "nicht gemeint."
    )
    doc.clause("2", "Gebäudekennungen im Lageplan")
    doc.mark("A02", "Gebäudekennungen und Lage im Baufeld",
             "Building identifiers and position in the site")
    doc.table(
        ["Kennung", "Name", "Lage im Baufeld", "Adresse / Eingang"],
        [
            [A["id"], A["name"], "Nordkante, zur Bahntrasse", "Haupteingang Nord"],
            [B["id"], B["name"], "Westflügel am Innenhof", "Eingang Hof, zwei Treppenhäuser"],
            [C["id"], C["name"], "Südostecke, zum Grünzug", "Eingang Süd, Gewerbe zum Grünzug"],
        ],
        [24.0, 24.0, 48.0, 52.0],
        ["L", "L", "L", "L"],
    )
    doc.p(
        "Die Kennungen sind identisch mit der Projektbeschreibung und mit den Grundrissen "
        "der einzelnen Häuser. Abweichende Bauteilbezeichnungen aus früheren Revisionen "
        "(Haus 1 bis Haus 3) sind nicht mehr zu verwenden."
    )

    doc.page()
    doc.h2("3   Zufahrt, Erschließung und Andienung")
    doc.mark("A03", "Zufahrt und äußere Erschließung",
             "Access and external site connection")
    doc.numbered(
        "3",
        [
            "Die einzige Zufahrt zum Baufeld liegt an der Nordkante. Sie dient im Betrieb "
            "als Zufahrt zur Tiefgarage des Hofhauses und als Andienung für das Kontorhaus.",
            "Die Tiefgaragenzufahrt wird als einspurige Rampe mit Ausweichbucht ausgebildet "
            "und erschließt das Untergeschoss des Hofhauses; das Teil-Untergeschoss des "
            "Stadthauses wird über eine innere Verbindung angebunden.",
            "Der Innenhof ist nicht befahrbar. Feuerwehraufstellflächen liegen an der "
            "Nordkante und am südlichen Grünzug; die Rettungswege der Wohngeschosse sind "
            "über die jeweiligen Treppenräume geführt.",
            "Die Abfallsammlung erfolgt in einem eingehausten Standplatz an der Nordkante. "
            "Eine Andienung durch den Hof ist ausgeschlossen.",
            "Die Höhenlage der Eingänge folgt dem Bestandsniveau der Nordkante; zum Grünzug "
            "im Süden wird die Differenz über eine Freitreppe und eine Rampe abgefangen.",
        ],
    )
    doc.h2("4   Baustellenlogistik")
    doc.mark("A04", "Baustelleneinrichtung und Logistikflächen",
             "Site setup and logistics areas")
    doc.p(
        "Die Baustelleneinrichtung liegt vollständig innerhalb des Baufeldes. Eine "
        "Inanspruchnahme öffentlicher Flächen ist nicht vorgesehen und wäre gesondert zu "
        "beantragen."
    )
    doc.table(
        ["Fläche", "Lage", "Nutzung", "Verfügbar"],
        [
            ["BE-Fläche 1", "Nordkante", "Kran, Container, Anlieferung", "gesamte Bauzeit"],
            ["BE-Fläche 2", "Baufeld Süd", "Vormontage Holzbauelemente", "bis Baubeginn Stadthaus"],
            ["Lagerfläche", "Innenhof", "Zwischenlager, witterungsgeschützt", "bis Beginn Freianlagen"],
            ["Zufahrt", "Nordkante", "einzige Zu- und Abfahrt", "gesamte Bauzeit"],
        ],
        [26.0, 30.0, 62.0, 30.0],
        ["L", "L", "L", "L"],
    )
    doc.p(
        "Die Anlieferung der vorgefertigten Holzbauelemente erfolgt just in time; die "
        "Vormontagefläche im südlichen Baufeld steht nur bis zum Baubeginn des Stadthauses "
        "zur Verfügung. Diese Einschränkung wirkt auf die Reihenfolge der Häuser und ist im "
        "Terminrahmen berücksichtigt."
    )
    doc.clause("5", "Offene Punkte dieses Blattes")
    doc.bullets(
        [
            "Vereinigung der Flurstücke und damit die Grundstücksfläche: offen, siehe "
            "Abschnitt 1.",
            "Lage der Medienübergabepunkte: in Abstimmung mit den Netzbetreibern, geführt "
            "in den Schnittstellen und Hausanschlüssen.",
            "Endgültige Lage des Abfallstandplatzes: abhängig von der Freianlagenplanung.",
        ]
    )


# --------------------------------------------------------------------------
# 03 Grundrisse Kontorhaus (8 Blatt)
# --------------------------------------------------------------------------

A_STOREY_TEXT = {
    "Erdgeschoss": (
        "Empfangs- und Konferenzzone",
        "Das Erdgeschoss nimmt Empfang, Wartezone, zwei teilbare Konferenzräume, einen "
        "Schulungsraum sowie die zentralen Nebenräume auf. Die gewerbliche Andienung "
        "erfolgt von der Nordkante, die Fahrradabstellanlage mit Umkleide und Duschen liegt "
        "an der Hofseite. Das Vordach über dem Haupteingang ist als überdeckte, nicht "
        "allseitig umschlossene Fläche in der BGF S geführt.",
        [
            "Empfang und Wartezone mit Sichtbezug zum Hof",
            "zwei teilbare Konferenzräume, zusammenschaltbar",
            "Schulungsraum mit eigener Erschließung",
            "Fahrradabstellanlage, Umkleiden, Duschen",
            "Hausanschlussraum und Technikzentrale",
        ],
    ),
    "1.{NB}Obergeschoss": (
        "Regelgeschoss mit Besprechungsband",
        "Das erste Obergeschoss ist ein Regelgeschoss. An der ruhigen Hofseite liegt ein "
        "durchgehendes Besprechungsband mit vier Räumen, die Nordseite nimmt die "
        "Arbeitsplätze auf. Die Loggia an der Ostecke ist überdeckt und nicht allseitig "
        "umschlossen und daher in der BGF S geführt.",
        [
            "vier Besprechungsräume an der Hofseite",
            "offene Arbeitsplatzzone an der Nordseite",
            "Teeküche und Kopierzone am Kern",
            "Loggia Ostecke, in BGF S geführt",
        ],
    ),
    "2.{NB}Obergeschoss": (
        "Regelgeschoss, offene Struktur",
        "Das zweite Obergeschoss ist als offene Struktur ohne Besprechungsband ausgelegt "
        "und nimmt die größte zusammenhängende Arbeitsplatzzone des Hauses auf. Die "
        "Trennwände sind als Systemwände geplant und ohne Eingriff in das Tragwerk "
        "versetzbar.",
        [
            "offene Arbeitsplatzzone über die gesamte Gebäudetiefe",
            "zwei Fokusräume und ein Ruheraum am Kern",
            "Teeküche mit Sitzgruppe an der Ostecke",
            "Systemtrennwände, versetzbar",
        ],
    ),
    "3.{NB}Obergeschoss": (
        "Regelgeschoss mit Teamflächen",
        "Das dritte Obergeschoss ist in vier Teamflächen gegliedert, die jeweils über eine "
        "eigene Nebenzone verfügen. Die Aufteilung ist ein Nutzerwunsch und ändert die "
        "Fläche gegenüber dem Regelgeschoss nicht.",
        [
            "vier Teamflächen mit eigener Nebenzone",
            "zentrale Kommunikationstreppe zum vierten Obergeschoss",
            "Serverraum mit eigener Kühlung",
            "Loggia Ostecke, in BGF S geführt",
        ],
    ),
    "4.{NB}Obergeschoss": (
        "Regelgeschoss",
        "",
        [],
    ),
    "5.{NB}Obergeschoss": (
        "Regelgeschoss, Anschluss Dachterrasse",
        "",
        [],
    ),
}


def _a_row(entry) -> list[str]:
    label, r, sfl, nuf, workplaces = entry
    return [
        lbl(label),
        de(r),
        de(sfl),
        de(r + sfl),
        de(nuf),
        de(workplaces, 0),
    ]


def build_03(doc: Doc) -> None:
    s = doc.spec
    h = HEIGHTS["B-BLDG-A"]

    doc.page()
    cover(
        doc,
        [
            ("Gebäude", f"{A['name']} · {A['id']}"),
            ("Nutzung", usage(A)),
            ("Geschosse", storeys(A)),
            ("Untergeschoss", underground(A)),
            ("BGF R+S oberirdisch", sqm(m(A, "bgfRSAbove"))),
            ("NUF nach DIN 277", sqm(m(A, "nuf"))),
            ("Arbeitsplätze (Zielbelegung)", cnt(m(A, "workplaces"), "Stück")),
        ],
    )
    doc.mark("A01", "Geschossigkeit Kontorhaus", "Kontorhaus storey configuration")
    doc.clause("1", "Geschossigkeit und Aufbau")
    doc.p(
        f"Das Kontorhaus ist mit {storeys(A)} geplant: ein Erdgeschoss mit "
        f"{qty(h['eg'], 'm')} Geschosshöhe und fünf Obergeschosse mit je "
        f"{qty(h['og'], 'm')}. Die Regelgeschosse sind gleich groß und unterscheiden sich "
        "nur in der Ausbauzonierung."
    )
    doc.mark("A02", "Kontorhaus ohne Untergeschoss", "Kontorhaus without basement")
    doc.clause("2", "Untergeschoss")
    doc.p(
        f"Das Kontorhaus hat {underground(A)}. Die unterirdische Bruttogrundfläche beträgt "
        f"deshalb {sqm(m(A, 'bgfRSBelow'))} - das ist ein echter Nullwert und keine "
        "fehlende Angabe. Technikzentrale und Hausanschlussraum liegen im Erdgeschoss an "
        "der Nordkante, die Entwässerung wird über eine Hebeanlage geführt."
    )
    doc.clause("3", "Blattverzeichnis")
    doc.table(
        ["Blatt", "Inhalt", "Bezug"],
        [
            ["1", "Gebäudedaten, Geschossigkeit, Blattverzeichnis", "dieses Blatt"],
            ["2", "Grundriss Erdgeschoss", "Raumprogramm, Kerne"],
            ["3", "Grundriss 1. Obergeschoss", "Regelgeschoss"],
            ["4", "Grundriss 2. Obergeschoss", "Regelgeschoss"],
            ["5", "Grundriss 3. Obergeschoss", "Regelgeschoss"],
            ["6", "Grundrisse 4. und 5. Obergeschoss", "Regelgeschosse"],
            ["7", "Flächenübersicht je Geschoss", "BGF R, BGF S, NUF"],
            ["8", "Arbeitsplätze, Erschließung, Revisionshinweise", "Belegung"],
        ],
        [14.0, 88.0, 46.0],
        ["L", "L", "L"],
    )

    # Sheets 2 to 5: EG and the first three upper floors, one page each.
    for index in range(0, 4):
        entry = A_STOREYS[index]
        label = lbl(entry[0])
        title, body, program = A_STOREY_TEXT[entry[0]]
        doc.page()
        doc.h2(f"{index + 4}   {label} - {title}")
        doc.p(body)
        doc.h2("Raumprogramm")
        doc.bullets(program)
        doc.table(
            ["Kenngröße", "Wert", "Bemerkung"],
            [
                ["BGF R (umschlossen, überdeckt)", sqm(entry[1]), "DIN 277-1, Bereich R"],
                ["BGF S (überdeckt, offen)", sqm(entry[2]),
                 "Vordach bzw. Loggia" if entry[2] else "keine offene Fläche"],
                ["BGF R+S", sqm(entry[1] + entry[2]), "Summe des Geschosses"],
                ["NUF nach DIN 277", sqm(entry[3]), "ohne Verkehrs- und Technikfläche"],
                ["Arbeitsplätze", cnt(entry[4], "Stück"), "Zielbelegung des Geschosses"],
                ["Geschosshöhe", qty(h["eg"] if index == 0 else h["og"], "m"),
                 "Rohbaumaß, lichte Höhe siehe Schnitte"],
            ],
            [56.0, 32.0, 60.0],
            ["L", "R", "L"],
        )
        room_schedule(
            doc,
            label,
            A_ROOMS[entry[0]],
            "Summe NUF des Geschosses",
            f"Raumliste {label} · Nutzungsfläche nach DIN 277 in m²; Verkehrs- und "
            "Technikflächen sind keine NUF und nicht aufgeführt",
        )
        if index == 0:
            doc.clause("4.1", "Erschließungskerne")
            doc.p(
                "Das Haus hat zwei Kerne in Stahlbeton, über alle Geschosse "
                "durchgesteckt. Der Nordkern nimmt Treppenraum, zwei Aufzüge und die "
                "Steigezonen für Elektro und Daten auf, der Ostkern den zweiten "
                "Treppenraum, einen Lastenaufzug und die Steigezonen für Heizung, "
                "Sanitär und Lüftung."
            )
        else:
            doc.clause(f"{index + 4}.1", "Abweichung zum Regelgeschoss")
            doc.p(
                "Die Fläche entspricht dem Regelgeschoss. Abweichungen betreffen "
                "ausschließlich die Ausbauzonierung und die Lage der Systemtrennwände; "
                "Tragwerk, Kerne und Fassade sind unverändert."
            )

    doc.page()
    doc.h2("8   4. und 5. Obergeschoss")
    doc.p(
        "Die beiden obersten Regelgeschosse sind flächengleich mit den unteren "
        "Regelgeschossen. Das fünfte Obergeschoss erhält den Anschluss an die Dachterrasse "
        "über dem Ostkern."
    )
    doc.table(
        ["Geschoss", "BGF R", "BGF S", "BGF R+S", "NUF", "Arbeitsplätze"],
        [_a_row(A_STOREYS[4]), _a_row(A_STOREYS[5])],
        [40.0, 22.0, 20.0, 22.0, 22.0, 22.0],
        ["L", "R", "R", "R", "R", "R"],
        caption="Angaben in m², Arbeitsplätze in Stück",
    )
    room_schedule(
        doc,
        lbl(A_STOREYS[4][0]),
        A_ROOMS[A_STOREYS[4][0]],
        "Summe NUF 4. Obergeschoss",
        "Raumliste 4. Obergeschoss · NUF nach DIN 277 in m²",
    )
    room_schedule(
        doc,
        lbl(A_STOREYS[5][0]),
        A_ROOMS[A_STOREYS[5][0]],
        "Summe NUF 5. Obergeschoss",
        "Raumliste 5. Obergeschoss · NUF nach DIN 277 in m²",
    )
    doc.clause("8.1", "Dachterrasse und Dachtechnik")
    doc.p(
        "Die Dachterrasse über dem Ostkern ist nicht überdeckt und nach DIN 277-1 nicht "
        "Teil der Bruttogrundfläche. Die Lüftungszentrale steht in einer eingehausten "
        "Technikfläche über dem Nordkern, außerhalb der Geschossebene; die Zuordnung ist "
        "mit der Flächenberechnung abgestimmt."
    )

    doc.page()
    doc.h2("9   Flächenübersicht je Geschoss")
    doc.mark("A03", "BGF R+S oberirdisch Kontorhaus",
             "Above-grade BGF R+S for the Kontorhaus")
    doc.table(
        ["Geschoss", "BGF R", "BGF S", "BGF R+S", "NUF", "Arbeitsplätze"],
        [_a_row(entry) for entry in A_STOREYS],
        [40.0, 22.0, 20.0, 22.0, 22.0, 22.0],
        ["L", "R", "R", "R", "R", "R"],
        total=[
            "Summe oberirdisch",
            de(fnum(A, "bgfRAbove")),
            de(fnum(A, "bgfSAbove")),
            de(fnum(A, "bgfRSAbove")),
            de(float(m(A, "nuf"))),
            de(int(m(A, "workplaces")), 0),
        ],
        caption="Angaben in m², Arbeitsplätze in Stück",
    )
    doc.mark("A04", "Aufteilung der BGF in Bereich R und Bereich S",
             "Split of BGF into region R and region S")
    doc.clause("9.1", "Aufteilung nach Bereichen")
    doc.p(
        f"Von der oberirdischen Bruttogrundfläche von {sqm(m(A, 'bgfRSAbove'))} sind "
        f"{sqm(m(A, 'bgfRAbove'))} allseitig umschlossen und überdeckt (Bereich R) und "
        f"{sqm(m(A, 'bgfSAbove'))} überdeckt, aber nicht allseitig umschlossen (Bereich S). "
        "Der Bereich S umfasst das Vordach am Haupteingang und die Loggien an der Ostecke."
    )
    doc.clause("9.2", "Unterirdische Flächen")
    doc.p(
        f"Unterirdisch sind {sqm(m(A, 'bgfRBelow'))} im Bereich R und "
        f"{sqm(m(A, 'bgfSBelow'))} im Bereich S ausgewiesen, zusammen "
        f"{sqm(m(A, 'bgfRSBelow'))}. Die Nullwerte folgen unmittelbar daraus, dass das Haus "
        "kein Untergeschoss hat."
    )
    doc.mark("A05", "NUF nach DIN 277 Kontorhaus", "NUF per DIN 277 for the Kontorhaus")
    doc.clause("9.3", "Nutzungsfläche")
    doc.p(
        f"Die Nutzungsfläche nach DIN 277 beträgt {sqm(m(A, 'nuf'))}. Das entspricht einem "
        f"Anteil von {de(float(m(A, 'nuf')) / fnum(A, 'bgfRSTotal') * 100, 1)}{NB}% der "
        "Bruttogrundfläche des Hauses. Verkehrsflächen, Technikflächen und "
        "Konstruktionsflächen sind darin nicht enthalten."
    )
    doc.clause("9.4", "Gesamt")
    doc.kv(
        [
            ("BGF R+S oberirdisch", sqm(m(A, "bgfRSAbove"))),
            ("BGF R+S unterirdisch", sqm(m(A, "bgfRSBelow"))),
            ("BGF R+S gesamt", sqm(m(A, "bgfRSTotal"))),
            ("NUF nach DIN 277", sqm(m(A, "nuf"))),
            ("Wohnfläche nach WoFlV", sqm(m(A, "wfl"))),
            ("Gewerbefläche (NUF)", sqm(m(A, "commercialNuf"))),
        ]
    )
    doc.small(
        "Wohnfläche und Gewerbefläche entfallen: das Kontorhaus hat keine Wohnnutzung und "
        "keine gesondert ausgewiesene Gewerbeeinheit. Es wird an dieser Stelle kein "
        "Nullwert ausgewiesen, weil die Bezugsgröße für dieses Haus nicht existiert."
    )

    doc.page()
    doc.h2("10   Arbeitsplätze und Erschließung")
    doc.mark("A06", "Arbeitsplätze je Geschoss und Zielbelegung",
             "Workplaces per storey and target occupancy")
    doc.table(
        ["Geschoss", "Arbeitsplätze", "NUF", "NUF je Arbeitsplatz"],
        [
            [
                lbl(entry[0]),
                de(entry[4], 0),
                de(entry[3]),
                de(entry[3] / entry[4], 2),
            ]
            for entry in A_STOREYS
        ],
        [46.0, 30.0, 34.0, 38.0],
        ["L", "R", "R", "R"],
        total=[
            "Summe",
            de(int(m(A, "workplaces")), 0),
            de(float(m(A, "nuf"))),
            de(NUF_PER_WORKPLACE, 2),
        ],
        caption="Flächen in m², Arbeitsplätze in Stück",
    )
    doc.p(
        f"Die Zielbelegung des Hauses beträgt {cnt(m(A, 'workplaces'), 'Arbeitsplätze')} "
        f"bei einer Nutzungsfläche von {sqm(m(A, 'nuf'))}, im Mittel "
        f"{qty(NUF_PER_WORKPLACE, M2)} je Arbeitsplatz. Die Zahl ist eine Vorgabe des "
        "Auftraggebers und keine aus der Fläche abgeleitete Größe; sie bestimmt die Mengen "
        "für Sanitärobjekte, Lüftungsluftmengen und Elektroausstattung."
    )
    doc.clause("10.1", "Erschließung und Rettungswege")
    doc.bullets(
        [
            "zwei notwendige Treppenräume, Nordkern und Ostkern, über alle Geschosse "
            "durchgesteckt",
            "zwei Personenaufzüge im Nordkern, ein Lastenaufzug im Ostkern",
            "Rettungsweglängen nach Landesbauordnung eingehalten, Nachweis im "
            "Brandschutzkonzept",
            f"Gebäudehöhe {qty(BUILDING_HEIGHT['B-BLDG-A'], 'm')} über Geländeoberkante, "
            "damit Gebäudeklasse 5",
        ]
    )
    doc.clause("10.2", "Revisionshinweise und überholte Angaben")
    doc.table(
        ["Angabe", "überholter Wert", "gültiger Wert", "Quelle des gültigen Werts"],
        [
            [
                "Geschossanzahl",
                "EG + 6 OG (Scan Brandschutz)",
                storeys(A),
                "dieses Blatt, Abschnitt 1",
            ],
            [
                "NUF",
                f"{de(4520.0)}{NB}{M2} (Büroflächenliste V1)",
                sqm(m(A, "nuf")),
                "Flächenberechnung Rev C",
            ],
        ],
        [26.0, 46.0, 30.0, 46.0],
        ["L", "L", "R", "L"],
    )
    doc.small(
        "Die überholten Werte sind hier nur genannt, damit ein Leser eine ältere Unterlage "
        "zuordnen kann. Sie sind keine Alternative und nicht zu verwenden."
    )


# --------------------------------------------------------------------------
# 04 Grundrisse Hofhaus (10 Blatt)
# --------------------------------------------------------------------------

B_STOREY_TEXT = {
    "Erdgeschoss": (
        "Wohnungen am Hof, Nebenräume, Zugänge",
        "Das Erdgeschoss nimmt acht Wohnungen mit Terrasse zum Hof auf. An der Nordseite "
        "liegen die gemeinschaftlichen Nebenräume: Waschküche, Kinderwagen- und "
        "Fahrradabstellraum sowie der Zugang zum Untergeschoss. Die Terrassen sind nicht "
        "überdeckt und deshalb nicht Teil der Bruttogrundfläche; der überdeckte Laubengang "
        "an der Nordseite ist in der BGF S geführt.",
        [
            "acht Wohnungen, davon zwei barrierefrei erreichbar",
            "Waschküche und Trockenraum",
            "Kinderwagen- und Fahrradabstellraum, direkt vom Hof erreichbar",
            "Zugang Untergeschoss über beide Treppenräume",
        ],
    ),
    "1.{NB}Obergeschoss": (
        "Regelgeschoss, zehn Wohnungen",
        "Das erste Obergeschoss ist das erste von drei gleich belegten Regelgeschossen mit "
        "je zehn Wohnungen. Die Wohnungen sind über zwei Treppenräume erschlossen; die "
        "Loggien zum Hof sind überdeckt und in der BGF S geführt.",
        [
            "zehn Wohnungen je Geschoss, zwei Treppenräume",
            "Loggien zum Hof, in BGF S geführt",
            "Abstellräume der Wohnungen innerhalb der Wohnfläche",
            "Steigezonen in den Treppenraumkernen",
        ],
    ),
    "2.{NB}Obergeschoss": (
        "Regelgeschoss, zehn Wohnungen",
        "Das zweite Obergeschoss ist flächen- und belegungsgleich mit dem ersten "
        "Obergeschoss. Abweichend liegt hier der Anschluss der Aufzugsüberfahrt des "
        "westlichen Treppenraums, der die Deckenöffnung im Kern vergrößert; die "
        "Wohnfläche bleibt unverändert.",
        [
            "zehn Wohnungen, Belegung wie erstes Obergeschoss",
            "Aufzugsüberfahrt westlicher Kern",
            "Loggien zum Hof, in BGF S geführt",
        ],
    ),
    "3.{NB}Obergeschoss": (
        "Regelgeschoss, zehn Wohnungen",
        "Das dritte Obergeschoss ist das oberste Regelgeschoss mit zehn Wohnungen. Die "
        "Wohnungen an der Südwestecke erhalten wegen der Verschattung durch die "
        "Bestandsbebauung eine geänderte Fensteraufteilung; Fläche und Zuschnitt bleiben "
        "unverändert.",
        [
            "zehn Wohnungen, oberstes Regelgeschoss",
            "geänderte Fensteraufteilung Südwestecke",
            "Steigezonen wie Regelgeschoss",
        ],
    ),
}


def _b_row(entry) -> list[str]:
    label, r, sfl, wfl, units = entry
    return [lbl(label), de(r), de(sfl), de(r + sfl), de(wfl), de(units, 0)]


def build_04(doc: Doc) -> None:
    h = HEIGHTS["B-BLDG-B"]

    doc.page()
    cover(
        doc,
        [
            ("Gebäude", f"{B['name']} · {B['id']}"),
            ("Nutzung", usage(B)),
            ("Geschosse", storeys(B)),
            ("Untergeschoss", underground(B)),
            ("BGF R+S oberirdisch", sqm(m(B, "bgfRSAbove"))),
            ("BGF R+S unterirdisch", sqm(m(B, "bgfRSBelow"))),
            ("Wohnfläche nach WoFlV", sqm(m(B, "wfl"))),
            ("Wohneinheiten", cnt(m(B, "units"), "Stück")),
            ("Stellplätze im Untergeschoss", cnt(m(B, "parkingSpaces"), "Stück")),
        ],
    )
    doc.mark("A01", "Geschossigkeit Hofhaus", "Hofhaus storey configuration")
    doc.clause("1", "Geschossigkeit und Aufbau")
    doc.p(
        f"Das Hofhaus ist mit {storeys(B)} geplant: ein vollflächiges Untergeschoss, ein "
        f"Erdgeschoss mit {qty(h['eg'], 'm')} Geschosshöhe und vier Obergeschosse mit je "
        f"{qty(h['og'], 'm')}. Die drei mittleren Obergeschosse sind Regelgeschosse mit "
        "gleicher Belegung, das vierte Obergeschoss ist um zwei Wohnungen reduziert und "
        "erhält Dachterrassen."
    )
    doc.mark("A02", "Vollflächiges Untergeschoss Hofhaus",
             "Hofhaus full-footprint basement")
    doc.clause("1.1", "Umfang des Untergeschosses")
    doc.p(
        f"Das Untergeschoss ist {underground(B)}: es reicht unter den gesamten "
        "Gebäudeumriss und ist nicht auf einen Teilbereich beschränkt. Der Umfang "
        "bestimmt Erdarbeiten, Abdichtung, Tragwerk und die Größe der Stellplatzanlage "
        "und ist deshalb in Abschnitt 3 gesondert nachgewiesen."
    )
    doc.clause("2", "Blattverzeichnis")
    doc.table(
        ["Blatt", "Inhalt", "Bezug"],
        [
            ["1", "Gebäudedaten, Geschossigkeit, Blattverzeichnis", "dieses Blatt"],
            ["2", "Grundriss Untergeschoss", "Stellplätze, Nebenräume"],
            ["3", "Grundriss Erdgeschoss", "Wohnungen, Nebenräume"],
            ["4", "Grundriss 1. Obergeschoss", "Regelgeschoss"],
            ["5", "Grundriss 2. Obergeschoss", "Regelgeschoss"],
            ["6", "Grundriss 3. Obergeschoss", "Regelgeschoss"],
            ["7", "Grundriss 4. Obergeschoss", "Dachterrassen"],
            ["8", "Wohnungsschlüssel", "Wohnungsmix"],
            ["9", "Flächenübersicht je Geschoss", "BGF R, BGF S, WFL"],
            ["10", "Erschließung, Kerne, Revisionshinweise", "Nachweise"],
        ],
        [14.0, 88.0, 46.0],
        ["L", "L", "L"],
    )

    doc.page()
    doc.h2("3   Untergeschoss")
    doc.p(
        "Das Untergeschoss ist vollflächig unter dem Gebäudeumriss ausgebildet und nimmt "
        "die Stellplatzanlage, die Abstellräume der Wohnungen, die Hausanschlussräume und "
        "die Technikzentrale auf. Die Zufahrt erfolgt über die Rampe an der Nordkante."
    )
    doc.mark("A03", "BGF R+S unterirdisch Hofhaus",
             "Below-grade BGF R+S for the Hofhaus")
    doc.table(
        ["Kenngröße", "Wert", "Bemerkung"],
        [
            ["BGF R unterirdisch", sqm(m(B, "bgfRBelow")), "allseitig umschlossen"],
            ["BGF S unterirdisch", sqm(m(B, "bgfSBelow")), "keine offene überdeckte Fläche"],
            ["BGF R+S unterirdisch", sqm(m(B, "bgfRSBelow")), "Summe Untergeschoss"],
            ["lichte Höhe", qty(h["ug"], "m"), "unter Unterzug und Leitungen"],
        ],
        [56.0, 32.0, 60.0],
        ["L", "R", "L"],
    )
    doc.mark("A04", "Stellplätze im Untergeschoss Hofhaus",
             "Parking spaces in the Hofhaus basement")
    doc.clause("3.1", "Stellplatzanlage")
    doc.p(
        f"Die Stellplatzanlage umfasst {cnt(m(B, 'parkingSpaces'), 'Stellplätze')}, davon "
        "zwei mit vergrößerter Breite für barrierefreie Nutzung. Die Anlage ist als "
        "Senkrechtaufstellung an einer mittigen Fahrgasse organisiert. Die Anzahl ist eine "
        "Vorgabe aus der Stellplatzsatzung und der Abstimmung mit dem Auftraggeber; sie ist "
        "nicht aus der Wohnungsanzahl abgeleitet."
    )
    doc.clause("3.2", "Nebenräume")
    doc.bullets(
        [
            "Abstellraum je Wohnung, außerhalb der Wohnfläche",
            "Hausanschlussraum Fernwärme mit direkter Zugänglichkeit von außen",
            "Hausanschlussraum Strom und Zählerplatz",
            "Hausanschlussraum Wasser mit Wasserzähler und Druckerhöhung",
            "Technikzentrale Lüftung für Tiefgaragenentlüftung",
            "Leerrohrtrasse für Telekommunikation bis zum Hausanschlussraum",
        ]
    )
    doc.clause("3.3", "Abdichtung und Entwässerung")
    doc.p(
        "Das Untergeschoss wird gegen von außen drückendes Wasser abgedichtet. Der "
        "Bemessungswasserstand ist aus dem Bodengutachten des Auftraggebers übernommen. Die "
        "Entwässerung der Rampe erfolgt über eine Pumpstation mit Rückstauverschluss."
    )
    doc.clause("3.4", "Brandschutz im Untergeschoss")
    doc.p(
        "Die Stellplatzanlage bildet einen eigenen Brandabschnitt. Die Decke zur "
        "Wohnnutzung ist eine Stahlbetondecke mit einer Feuerwiderstandsdauer von 90 "
        "Minuten. Die Abstellräume der Wohnungen sind von der Stellplatzanlage "
        "brandschutztechnisch getrennt und über den Treppenraum erschlossen."
    )
    doc.clause("3.5", "Anbindung an das Stadthaus")
    doc.p(
        "Das Teil-Untergeschoss des Stadthauses wird über eine innere Verbindung an diese "
        "Stellplatzanlage angebunden; eine zweite Rampe entsteht nicht. Die Verbindung "
        "durchdringt die Trennwand zwischen den beiden Bauwerken und erhält eine "
        "Abschlusstür mit Feuerwiderstand."
    )

    for index in range(0, 4):
        entry = B_STOREYS[index]
        label = lbl(entry[0])
        title, body, program = B_STOREY_TEXT[entry[0]]
        doc.page()
        doc.h2(f"{index + 4}   {label} - {title}")
        doc.p(body)
        doc.h2("Raumprogramm")
        doc.bullets(program)
        doc.table(
            ["Kenngröße", "Wert", "Bemerkung"],
            [
                ["BGF R (umschlossen, überdeckt)", sqm(entry[1]), "DIN 277-1, Bereich R"],
                ["BGF S (überdeckt, offen)", sqm(entry[2]),
                 "Laubengang bzw. Loggien"],
                ["BGF R+S", sqm(entry[1] + entry[2]), "Summe des Geschosses"],
                ["Wohnfläche nach WoFlV", sqm(entry[3]), "Wohnungen dieses Geschosses"],
                ["Wohneinheiten", cnt(entry[4], "Stück"), "Belegung des Geschosses"],
                ["Geschosshöhe", qty(h["eg"] if index == 0 else h["og"], "m"),
                 "Rohbaumaß, lichte Höhe siehe Schnitte"],
            ],
            [56.0, 32.0, 60.0],
            ["L", "R", "L"],
        )
        apartment_schedule(
            doc,
            B_APARTMENTS[entry[0]],
            "Summe WFL des Geschosses",
            f"Wohnungsliste {label} · Wohnfläche nach WoFlV in m²",
        )
        if index == 0:
            doc.clause("4.1", "Barrierefreiheit im Erdgeschoss")
            doc.p(
                "Zwei der acht Wohnungen im Erdgeschoss sind barrierefrei erreichbar und "
                "barrierefrei nutzbar. Die Zugänge liegen schwellenlos am Laubengang, die "
                "Bäder sind mit bodengleicher Dusche und ausreichender Bewegungsfläche "
                "geplant. Die Anforderung folgt aus der Landesbauordnung und ist im "
                "Nachweis zur Barrierefreiheit geführt."
            )
        else:
            doc.clause(f"{index + 4}.1", "Abweichung zum Regelgeschoss")
            doc.p(
                "Fläche und Wohnungszuschnitt entsprechen dem Regelgeschoss. Abweichungen "
                "betreffen die im Raumprogramm genannten Punkte und wirken nicht auf die "
                "Wohnfläche."
            )

    doc.page()
    doc.h2("8   4. Obergeschoss")
    entry = B_STOREYS[4]
    doc.p(
        "Das vierte Obergeschoss ist das oberste Wohngeschoss. Es nimmt acht statt zehn "
        "Wohnungen auf, weil an der Südost- und an der Nordwestecke je eine Dachterrasse "
        "aus dem Baukörper geschnitten ist. Die Bruttogrundfläche bleibt gegenüber dem "
        "Regelgeschoss unverändert, weil die Terrassen überdeckt sind, soweit sie in der "
        "BGF S geführt werden, und im Übrigen nicht überdeckt und damit nicht Teil der "
        "Bruttogrundfläche."
    )
    doc.table(
        ["Kenngröße", "Wert", "Bemerkung"],
        [
            ["BGF R", sqm(entry[1]), "wie Regelgeschoss"],
            ["BGF S", sqm(entry[2]), "überdeckte Terrassenanteile und Loggien"],
            ["BGF R+S", sqm(entry[1] + entry[2]), "Summe des Geschosses"],
            ["Wohnfläche nach WoFlV", sqm(entry[3]), "acht Wohnungen"],
            ["Wohneinheiten", cnt(entry[4], "Stück"), "zwei weniger als im Regelgeschoss"],
        ],
        [56.0, 32.0, 60.0],
        ["L", "R", "L"],
    )
    apartment_schedule(
        doc,
        B_APARTMENTS[B_STOREYS[4][0]],
        "Summe WFL des Geschosses",
        "Wohnungsliste 4. Obergeschoss · Wohnfläche nach WoFlV in m²",
    )
    doc.clause("8.1", "Dachterrassen")
    doc.p(
        "Die beiden Dachterrassen sind den angrenzenden Wohnungen zugeordnet und über eine "
        "Schwelle von höchstens zwei Zentimetern erreichbar. Der Aufbau ist als "
        "Plattenbelag auf Stelzlagern über der Abdichtung geplant. Die nicht überdeckten "
        "Anteile werden nach WoFlV mit einem Viertel ihrer Fläche auf die Wohnfläche "
        "angerechnet; der Ansatz ist in der Flächenberechnung dokumentiert."
    )
    doc.clause("8.2", "Anschluss an das Dach")
    doc.p(
        "Über dem vierten Obergeschoss liegt das begrünte Flachdach mit Retentionsaufbau. "
        "Die Lüftungsgeräte der Wohnungslüftung stehen in einer eingehausten Technikfläche "
        "über dem östlichen Treppenraum."
    )

    doc.page()
    doc.h2("9   Wohnungsschlüssel")
    doc.mark("A05", "Wohneinheiten und Wohnungsschlüssel Hofhaus",
             "Residential units and unit mix for the Hofhaus")
    doc.table(
        ["Wohnungstyp", "Anzahl", "WFL von", "WFL bis", "Anteil"],
        [
            [
                lbl(label),
                de(number, 0),
                de(low),
                de(high),
                f"{de(number / int(m(B, 'units')) * 100, 1)}{NB}%",
            ]
            for label, number, low, high in B_MIX
        ],
        [40.0, 22.0, 28.0, 28.0, 30.0],
        ["L", "R", "R", "R", "R"],
        total=["Summe", de(int(m(B, "units")), 0), "", "", f"100,0{NB}%"],
        caption="Wohnflächen in m² je Wohnung, Anzahl in Stück",
    )
    doc.p(
        f"Der Wohnungsschlüssel führt {cnt(m(B, 'units'), 'Wohneinheiten')} mit einer "
        f"Wohnfläche von zusammen {sqm(m(B, 'wfl'))}. Im Mittel ergibt das "
        f"{qty(WFL_MEAN_B, M2)} je Wohnung. Der Mittelwert ist eine abgeleitete Größe und "
        "keine Vorgabe; verbindlich sind die Anzahl der Wohnungen und die Gesamtwohnfläche."
    )
    doc.clause("9.1", "Bindung des Wohnungsschlüssels")
    doc.p(
        "Anzahl und Verteilung der Wohnungen sind Teil der Finanzierungsannahme des "
        "Auftraggebers und stehen in der Prioritätenliste an zweiter Stelle. Eine Änderung "
        "des Schlüssels ist eine Auftraggeberentscheidung und erzeugt eine neue Revision "
        "dieses Blattes."
    )
    doc.clause("9.2", "Barrierefreie Wohnungen")
    doc.p(
        "Zwei Wohnungen im Erdgeschoss sind barrierefrei nutzbar. Weitere Wohnungen sind "
        "über die Aufzüge stufenlos erreichbar, erfüllen aber nicht alle Anforderungen an "
        "die barrierefreie Nutzbarkeit."
    )
    doc.clause("9.3", "Herkunft des Schlüssels")
    doc.p(
        "Der Schlüssel ist aus den Wohnungslisten der Blätter 3 bis 7 aggregiert: Anzahl "
        "und Wohnflächenbereich je Wohnungstyp ergeben sich unmittelbar aus den dort "
        "geführten Einzelwohnungen. Eine gesonderte Vorgabe des Wohnungsmixes ohne "
        "Deckung in den Grundrissen besteht nicht."
    )
    doc.clause("9.4", "Abstellräume")
    doc.p(
        "Jeder Wohnung ist ein Abstellraum im Untergeschoss zugeordnet. Diese Räume liegen "
        "außerhalb der Wohnfläche und sind in den Wohnungslisten nicht enthalten; sie "
        "sind Teil der unterirdischen Bruttogrundfläche."
    )

    doc.page()
    doc.h2("10   Flächenübersicht je Geschoss")
    doc.mark("A06", "BGF R+S oberirdisch Hofhaus", "Above-grade BGF R+S for the Hofhaus")
    doc.table(
        ["Geschoss", "BGF R", "BGF S", "BGF R+S", "WFL", "WE"],
        [_b_row(entry) for entry in B_STOREYS],
        [40.0, 22.0, 20.0, 24.0, 24.0, 18.0],
        ["L", "R", "R", "R", "R", "R"],
        total=[
            "Summe oberirdisch",
            de(fnum(B, "bgfRAbove")),
            de(fnum(B, "bgfSAbove")),
            de(fnum(B, "bgfRSAbove")),
            de(float(m(B, "wfl"))),
            de(int(m(B, "units")), 0),
        ],
        caption="Flächen in m², Wohneinheiten in Stück",
    )
    doc.mark("A07", "Wohnfläche nach WoFlV Hofhaus", "Living area per WoFlV for the Hofhaus")
    doc.table(
        ["Bezugsgröße", "Wert", "Norm"],
        [
            ["BGF R+S oberirdisch", sqm(m(B, "bgfRSAbove")), "DIN 277-1"],
            ["BGF R+S unterirdisch", sqm(m(B, "bgfRSBelow")), "DIN 277-1"],
            ["BGF R+S gesamt", sqm(m(B, "bgfRSTotal")), "DIN 277-1"],
            ["Wohnfläche", sqm(m(B, "wfl")), "WoFlV"],
            ["Nutzungsfläche NUF", sqm(m(B, "nuf")), "DIN 277-1"],
            ["Gewerbefläche (NUF)", sqm(m(B, "commercialNuf")), "DIN 277-1"],
        ],
        [56.0, 42.0, 50.0],
        ["L", "R", "L"],
    )
    doc.small(
        "Für das Hofhaus wird keine Nutzungsfläche und keine Gewerbefläche ausgewiesen: das "
        "Haus ist reine Wohnnutzung, die Bezugsgröße existiert für dieses Gebäude nicht. "
        "Ein Nullwert wäre eine andere Aussage und ist nicht gemeint."
    )
    doc.clause("10.1", "Bezug der Aufstellung")
    doc.p(
        "Die geschossweisen Werte dieser Aufstellung sind identisch mit den Werten auf den "
        "Blättern 3 bis 7. Die Summenzeile ist die verbindliche Gebäudesumme und stimmt "
        "mit der Flächenberechnung nach DIN 277 und WoFlV überein."
    )
    doc.clause("10.2", "Verhältnis Wohnfläche zu Bruttogrundfläche")
    doc.p(
        f"Die Wohnfläche entspricht {de(float(m(B, 'wfl')) / fnum(B, 'bgfRSAbove') * 100, 1)}"
        f"{NB}% der oberirdischen Bruttogrundfläche. Die Differenz entsteht aus "
        "Treppenräumen, Laubengang, Abstellräumen außerhalb der Wohnungen, Steigezonen und "
        "Konstruktionsfläche."
    )

    doc.page()
    doc.h2("11   Erschließung, Kerne und Nachweise")
    doc.clause("11.1", "Kerne")
    doc.p(
        "Das Hofhaus hat zwei Treppenraumkerne in Stahlbeton, jeweils mit notwendigem "
        "Treppenraum, Aufzug und Steigezonen für Heizung, Sanitär, Elektro und Daten. Beide "
        "Kerne reichen vom Untergeschoss bis über das vierte Obergeschoss und tragen die "
        "Aussteifung des Gebäudes."
    )
    doc.clause("11.2", "Rettungswege")
    doc.bullets(
        [
            "zwei notwendige Treppenräume, unabhängig erreichbar",
            "Laubengang im Erdgeschoss als zweiter Rettungsweg der Erdgeschosswohnungen",
            f"Gebäudehöhe {qty(BUILDING_HEIGHT['B-BLDG-B'], 'm')} über Geländeoberkante, "
            "damit Gebäudeklasse 5",
            "Feuerwehraufstellfläche an der Nordkante, Anleiterbarkeit der Hoffassade "
            "nicht erforderlich",
        ]
    )
    doc.clause("11.3", "Mitgeltende Nachweise")
    doc.bullets(
        [
            "Brandschutzkonzept, geführt in der Baubeschreibung",
            "Schallschutznachweis für Wohnungstrenndecken und Treppenraumwände",
            "Nachweis Barrierefreiheit für die zwei Erdgeschosswohnungen",
            "Wohnflächenberechnung nach WoFlV, geführt in der Flächenberechnung",
        ]
    )
    doc.clause("11.4", "Revisionshinweise und überholte Angaben")
    doc.table(
        ["Angabe", "überholter Wert", "gültiger Wert", "Quelle des gültigen Werts"],
        [
            [
                "Wohneinheiten",
                "48 (Entwurf Baubeschreibung)",
                cnt(m(B, "units"), "Stück"),
                "dieses Blatt, Abschnitt 9",
            ],
            [
                "Untergeschoss",
                "Teilunterkellerung (Vorentwurf)",
                underground(B),
                "dieses Blatt, Abschnitt 3",
            ],
        ],
        [26.0, 46.0, 28.0, 48.0],
        ["L", "L", "R", "L"],
    )
    doc.small(
        "Die überholten Werte sind nur zur Zuordnung älterer Unterlagen genannt und sind "
        "keine Alternative zum gültigen Wert."
    )
    doc.clause("11.5", "Aufzüge")
    doc.p(
        "Beide Kerne erhalten je einen Aufzug, der vom Untergeschoss bis in das vierte "
        "Obergeschoss führt. Die Kabinenmaße erlauben den Transport einer Krankentrage. "
        "Die Aufzugsüberfahrt liegt innerhalb der eingehausten Dachtechnikfläche."
    )


# --------------------------------------------------------------------------
# 05 Grundrisse Stadthaus (10 Blatt)
# --------------------------------------------------------------------------


def _c_row(entry) -> list[str]:
    label, r, sfl, wfl, gewerbe, units = entry
    return [
        lbl(label),
        de(r),
        de(sfl),
        de(r + sfl),
        de(wfl) if wfl else "entfällt",
        de(gewerbe) if gewerbe else "entfällt",
        de(units, 0) if units else "entfällt",
    ]


def _c_storey_page(doc: Doc, index: int, section: int, title: str, body: str,
                   program: list[str], extra_title: str, extra_body: str) -> None:
    entry = C_STOREYS[index]
    h = HEIGHTS["B-BLDG-C"]
    doc.page()
    doc.h2(f"{section}   {lbl(entry[0])} - {title}")
    doc.p(body)
    doc.h2("Raumprogramm")
    doc.bullets(program)
    doc.table(
        ["Kenngröße", "Wert", "Bemerkung"],
        [
            ["BGF R (umschlossen, überdeckt)", sqm(entry[1]), "DIN 277-1, Bereich R"],
            ["BGF S (überdeckt, offen)", sqm(entry[2]), "Loggien und Laubengang"],
            ["BGF R+S", sqm(entry[1] + entry[2]), "Summe des Geschosses"],
            ["Wohnfläche nach WoFlV", sqm(entry[3]) if entry[3] else "entfällt",
             "Wohnungen dieses Geschosses" if entry[3] else "keine Wohnnutzung"],
            ["Gewerbefläche (NUF)", sqm(entry[4]) if entry[4] else "entfällt",
             "Gewerbeeinheiten" if entry[4] else "keine Gewerbenutzung"],
            ["Wohneinheiten", cnt(entry[5], "Stück") if entry[5] else "entfällt",
             "Belegung des Geschosses" if entry[5] else "keine Wohnungen"],
            ["Geschosshöhe", qty(h["eg"] if index == 0 else h["og"], "m"), "Rohbaumaß"],
        ],
        [56.0, 32.0, 60.0],
        ["L", "R", "L"],
    )
    if index == 0:
        room_schedule(
            doc,
            lbl(entry[0]),
            C_COMMERCIAL,
            "Summe Gewerbefläche des Geschosses",
            "Einheitenliste Erdgeschoss · Nutzungsfläche nach DIN 277 in m²",
        )
    else:
        apartment_schedule(
            doc,
            C_APARTMENTS[entry[0]],
            "Summe WFL des Geschosses",
            f"Wohnungsliste {lbl(entry[0])} · Wohnfläche nach WoFlV in m²",
        )
    doc.clause(f"{section}.1", extra_title)
    doc.p(extra_body)


def build_05(doc: Doc) -> None:
    h = HEIGHTS["B-BLDG-C"]

    doc.page()
    cover(
        doc,
        [
            ("Gebäude", f"{C['name']} · {C['id']}"),
            ("Nutzung", usage(C)),
            ("Geschosse", storeys(C)),
            ("Untergeschoss", underground(C)),
            ("BGF R+S oberirdisch", sqm(m(C, "bgfRSAbove"))),
            ("BGF R+S unterirdisch", sqm(m(C, "bgfRSBelow"))),
            ("Wohnfläche nach WoFlV", sqm(m(C, "wfl"))),
            ("Gewerbefläche (NUF)", sqm(m(C, "commercialNuf"))),
            ("Wohneinheiten", cnt(m(C, "units"), "Stück")),
            ("Stellplätze im Teil-Untergeschoss", cnt(m(C, "parkingSpaces"), "Stück")),
        ],
    )
    doc.mark("A01", "Geschossigkeit Stadthaus", "Stadthaus storey configuration")
    doc.clause("1", "Geschossigkeit und Nutzungsverteilung")
    doc.p(
        f"Das Stadthaus ist mit {storeys(C)} geplant. Das Erdgeschoss ist mit "
        f"{qty(h['eg'], 'm')} Geschosshöhe für gewerbliche Nutzung ausgelegt, die sechs "
        f"Obergeschosse mit je {qty(h['og'], 'm')} nehmen Wohnungen auf. Die "
        f"Nutzungsverteilung ist damit: {usage(C)}."
    )
    doc.mark("A02", "Umfang des Teil-Untergeschosses Stadthaus",
             "Extent of the partial basement in the Stadthaus")
    doc.clause("1.1", "Umfang des Untergeschosses")
    doc.p(
        f"Das Stadthaus hat ein {underground(C)}. Die südliche Baugrenze zum Grünzug lässt "
        "eine durchgehende Unterbauung nicht zu; das Untergeschoss liegt deshalb nur unter "
        "dem nördlichen und westlichen Gebäudeteil. Der Umfang ist bestätigt und ersetzt "
        "die frühere Annahme eines vollflächigen Untergeschosses."
    )
    doc.clause("2", "Blattverzeichnis")
    doc.table(
        ["Blatt", "Inhalt", "Bezug"],
        [
            ["1", "Gebäudedaten, Geschossigkeit, Blattverzeichnis", "dieses Blatt"],
            ["2", "Grundriss Teil-Untergeschoss", "Stellplätze, Technik"],
            ["3", "Grundriss Erdgeschoss", "Gewerbe"],
            ["4", "Grundriss 1. Obergeschoss", "Wohnen"],
            ["5", "Grundriss 2. Obergeschoss", "Wohnen"],
            ["6", "Grundrisse 3. und 4. Obergeschoss", "Wohnen"],
            ["7", "Grundriss 5. Obergeschoss", "Wohnen, Rücksprung"],
            ["8", "Grundriss 6. Obergeschoss", "Staffelgeschoss"],
            ["9", "Flächenübersicht je Geschoss", "BGF, WFL, Gewerbe"],
            ["10", "Wohnungsschlüssel, Revisionshinweise", "Wohnungsmix"],
        ],
        [14.0, 88.0, 46.0],
        ["L", "L", "L"],
    )

    doc.page()
    doc.h2("3   Teil-Untergeschoss")
    doc.p(
        "Das Teil-Untergeschoss liegt unter dem nördlichen und westlichen Gebäudeteil und "
        "ist über eine innere Verbindung an die Stellplatzanlage des Hofhauses angebunden. "
        "Eine eigene Rampe hat das Stadthaus nicht."
    )
    doc.mark("A03", "BGF R+S unterirdisch Stadthaus",
             "Below-grade BGF R+S for the Stadthaus")
    doc.table(
        ["Kenngröße", "Wert", "Bemerkung"],
        [
            ["BGF R unterirdisch", sqm(m(C, "bgfRBelow")), "allseitig umschlossen"],
            ["BGF S unterirdisch", sqm(m(C, "bgfSBelow")), "keine offene überdeckte Fläche"],
            ["BGF R+S unterirdisch", sqm(m(C, "bgfRSBelow")), "Summe Teil-Untergeschoss"],
            ["lichte Höhe", qty(h["ug"], "m"), "unter Unterzug und Leitungen"],
            ["Anteil an der Grundfläche", f"{de(fnum(C, 'bgfRBelow') / C_STOREYS[0][1] * 100, 0)}"
             f"{NB}%", "bezogen auf die BGF R des Erdgeschosses"],
        ],
        [56.0, 32.0, 60.0],
        ["L", "R", "L"],
    )
    doc.mark("A04", "Stellplätze im Teil-Untergeschoss Stadthaus",
             "Parking spaces in the Stadthaus partial basement")
    doc.clause("3.1", "Stellplatzanlage")
    doc.p(
        f"Im Teil-Untergeschoss sind {cnt(m(C, 'parkingSpaces'), 'Stellplätze')} "
        "angeordnet, davon einer mit vergrößerter Breite. Die geringere Anzahl gegenüber "
        "dem Hofhaus folgt unmittelbar aus dem reduzierten Umfang der Unterbauung."
    )
    doc.clause("3.2", "Nebenräume und Technik")
    doc.bullets(
        [
            "Abstellräume der Wohnungen, außerhalb der Wohnfläche",
            "Hausanschlussraum Fernwärme mit Übergabestation für Wohnen und Gewerbe",
            "Zählerplatz Strom, getrennt für Wohnnutzung und Gewerbenutzung",
            "Technikfläche für die Lüftungsanlage der Gewerbeeinheiten",
            "Leerrohrtrasse Telekommunikation bis zum Hausanschlussraum",
        ]
    )
    doc.clause("3.3", "Anschluss an das nicht unterbaute Feld")
    doc.p(
        "Im südlichen, nicht unterbauten Feld wird die Gründung als Streifen- und "
        "Einzelfundament ausgeführt. Der Übergang zwischen unterbautem und nicht "
        "unterbautem Bereich erhält eine Setzungsfuge über alle Geschosse. Die Fuge ist in "
        "den Schnitten dargestellt und im Tragwerkskonzept nachgewiesen."
    )
    doc.clause("3.4", "Wirkung des reduzierten Umfangs")
    doc.p(
        "Der reduzierte Umfang der Unterbauung wirkt auf Erdarbeiten, Abdichtung, "
        "Tragwerk und Stellplatzanzahl gleichzeitig. Er ist deshalb kein "
        "Detailmerkmal der Grundrissdarstellung, sondern eine Festlegung mit "
        "Mengenwirkung; die frühere Annahme eines vollflächigen Untergeschosses ist mit "
        "Rev C endgültig ersetzt."
    )
    doc.clause("3.5", "Brandschutz und Trennung")
    doc.p(
        "Das Teil-Untergeschoss bildet mit der Stellplatzanlage des Hofhauses einen "
        "gemeinsamen Brandabschnitt; die Verbindungstür ist als Abschluss mit "
        "Feuerwiderstand ausgebildet. Die Decke zur Gewerbenutzung im Erdgeschoss ist eine "
        "Stahlbetondecke mit 90 Minuten Feuerwiderstandsdauer."
    )

    _c_storey_page(
        doc, 0, 4, "Gewerbeflächen zum Grünzug",
        "Das Erdgeschoss ist zum südlichen Grünzug orientiert und für kleinteilige "
        "gewerbliche Nutzung ausgelegt. Vorgesehen sind drei Einheiten, die zu zwei "
        "Einheiten zusammengeschaltet werden können. Die Einheiten sind vom Grünzug direkt "
        "zugänglich; die Anlieferung erfolgt über die Nordkante.",
        [
            "drei Gewerbeeinheiten, zusammenschaltbar zu zwei Einheiten",
            "Windfang und Sanitärkern je Einheit",
            "gemeinsamer Anlieferungs- und Abfallraum an der Nordseite",
            "Wohnungszugang und Treppenraum getrennt von den Gewerbeeinheiten",
            "Vordach zum Grünzug, in BGF S geführt",
        ],
        "Gewerbefläche und Ausbaustandard",
        f"Die Gewerbefläche beträgt {sqm(m(C, 'commercialNuf'))} als Nutzungsfläche nach "
        "DIN 277. Die Einheiten werden als Rohbau mit Basisausbau übergeben: Bodenaufbau "
        "ohne Belag, Wände gespachtelt, Sanitärkern fertig, Elektro bis Unterverteilung, "
        "Lüftung bis Anschlusspunkt. Der mieterspezifische Ausbau ist nicht Teil dieser "
        "Leistung.",
    )
    doc.mark("A05", "Gewerbefläche NUF im Erdgeschoss Stadthaus",
             "Commercial NUF on the Stadthaus ground floor", dy=-6.0)

    _c_storey_page(
        doc, 1, 5, "Wohnen, erstes Wohngeschoss",
        "Das erste Obergeschoss ist das unterste Wohngeschoss. Zehn Wohnungen sind um den "
        "zentralen Treppenraum organisiert; die Wohnungen zum Grünzug erhalten Loggien, die "
        "Wohnungen zur Nordkante eine geschlossene Fassade mit Schalldämmlüftern.",
        [
            "zehn Wohnungen, davon vier zum Grünzug",
            "Loggien an der Südfassade, in BGF S geführt",
            "Schalldämmlüfter an der Nordfassade",
            "Trennung der Steigezonen Wohnen und Gewerbe",
        ],
        "Schallschutz zur Gewerbenutzung",
        "Die Decke über dem Erdgeschoss trennt Gewerbe- von Wohnnutzung und ist als "
        "Trenndecke mit erhöhten Anforderungen an den Luft- und Trittschallschutz "
        "ausgebildet. Die Anforderung ist in der Baubeschreibung geführt und wirkt auf den "
        "Deckenaufbau des gesamten Geschosses.",
    )

    _c_storey_page(
        doc, 2, 6, "Wohnen, Regelgeschoss",
        "Das zweite Obergeschoss ist flächen- und belegungsgleich mit dem ersten "
        "Obergeschoss. Es ist das zweite von zwei Geschossen mit der vollen Grundfläche; ab "
        "dem dritten Obergeschoss tritt die Nordfassade zurück.",
        [
            "zehn Wohnungen, Belegung wie erstes Obergeschoss",
            "volle Grundfläche ohne Rücksprung",
            "Loggien an der Südfassade, in BGF S geführt",
        ],
        "Übergang zum Rücksprung",
        "Die Decke über dem zweiten Obergeschoss nimmt den Rücksprung der Nordfassade "
        "auf. Der zurücktretende Bereich wird als nicht überdeckte Terrasse ausgebildet "
        "und ist deshalb nicht Teil der Bruttogrundfläche des dritten Obergeschosses.",
    )

    doc.page()
    doc.h2("7   3. und 4. Obergeschoss")
    doc.p(
        "Das dritte und das vierte Obergeschoss sind flächen- und belegungsgleich und "
        "liegen hinter dem Rücksprung der Nordfassade. Sie unterscheiden sich nur durch "
        "die Zuordnung der nicht überdeckten Terrassen auf dem Rücksprung, die nach WoFlV "
        "mit einem Viertel ihrer Fläche angerechnet werden."
    )
    doc.table(
        ["Geschoss", "BGF R", "BGF S", "BGF R+S", "WFL", "WE"],
        [
            [lbl(C_STOREYS[3][0]), de(C_STOREYS[3][1]), de(C_STOREYS[3][2]),
             de(C_STOREYS[3][1] + C_STOREYS[3][2]), de(C_STOREYS[3][3]),
             de(C_STOREYS[3][5], 0)],
            [lbl(C_STOREYS[4][0]), de(C_STOREYS[4][1]), de(C_STOREYS[4][2]),
             de(C_STOREYS[4][1] + C_STOREYS[4][2]), de(C_STOREYS[4][3]),
             de(C_STOREYS[4][5], 0)],
        ],
        [40.0, 22.0, 20.0, 24.0, 24.0, 18.0],
        ["L", "R", "R", "R", "R", "R"],
        caption="Flächen in m², Wohneinheiten in Stück",
    )
    apartment_schedule(
        doc,
        C_APARTMENTS[C_STOREYS[3][0]],
        "Summe WFL 3. Obergeschoss",
        "Wohnungsliste 3. Obergeschoss · Wohnfläche nach WoFlV in m²",
    )
    apartment_schedule(
        doc,
        C_APARTMENTS[C_STOREYS[4][0]],
        "Summe WFL 4. Obergeschoss",
        "Wohnungsliste 4. Obergeschoss · Wohnfläche nach WoFlV in m²",
    )
    doc.clause("7.1", "Wohnungszuschnitte hinter dem Rücksprung")
    doc.p(
        "Die Wohnungen an der Nordseite sind einseitig orientiert und erhalten eine "
        "Grundrisstiefe von höchstens zehn Metern, damit die Belichtung des Wohnraums "
        "gesichert bleibt. Die Wohnungen an der Südseite sind durchgesteckt und über die "
        "Loggia zum Grünzug orientiert."
    )

    _c_storey_page(
        doc, 5, 8, "Wohnen, zweiter Rücksprung",
        "Im fünften Obergeschoss tritt zusätzlich die Westfassade zurück. Das Geschoss "
        "nimmt sechs Wohnungen auf, alle mit Loggia oder Terrasse. Die Grundfläche ist "
        "gegenüber dem vierten Obergeschoss weiter reduziert.",
        [
            "sechs Wohnungen, alle mit Loggia oder Terrasse",
            "zweiter Rücksprung an der Westfassade",
            "Aufzug bis in das sechste Obergeschoss durchgeführt",
        ],
        "Auswirkung des Rücksprungs auf die Fläche",
        "Der zweite Rücksprung reduziert die Bruttogrundfläche und die Wohnfläche des "
        "Geschosses. Die zurücktretende Fläche wird als nicht überdeckte Terrasse des "
        "sechsten Obergeschosses nutzbar und ist dort nicht Teil der Bruttogrundfläche.",
    )

    _c_storey_page(
        doc, 6, 9, "Staffelgeschoss",
        "Das sechste Obergeschoss ist ein Staffelgeschoss mit vier Wohnungen. Es liegt "
        "vollständig innerhalb der Umrisse des fünften Obergeschosses und ist an drei "
        "Seiten von Dachterrassen umgeben. Die Dachfläche über dem Staffelgeschoss ist "
        "begrünt.",
        [
            "vier Wohnungen mit umlaufender Dachterrasse",
            "Technikfläche der Wohnungslüftung eingehaust auf dem Dach",
            "Absturzsicherung als geschlossene Attika",
        ],
        "Höhenlage und Gebäudeklasse",
        f"Die Oberkante des Staffelgeschosses liegt bei "
        f"{qty(BUILDING_HEIGHT['B-BLDG-C'], 'm')} über Geländeoberkante. Das Gebäude ist "
        "damit der Gebäudeklasse 5 zugeordnet; die daraus folgenden Anforderungen an "
        "Tragwerk und Brandschutz sind in der Baubeschreibung geführt.",
    )

    doc.page()
    doc.h2("10   Flächenübersicht je Geschoss")
    doc.mark("A06", "BGF R+S oberirdisch Stadthaus",
             "Above-grade BGF R+S for the Stadthaus")
    doc.table(
        ["Geschoss", "BGF R", "BGF S", "BGF R+S", "WFL", "Gewerbe", "WE"],
        [_c_row(entry) for entry in C_STOREYS],
        [34.0, 20.0, 18.0, 22.0, 20.0, 20.0, 14.0],
        ["L", "R", "R", "R", "R", "R", "R"],
        total=[
            "Summe oberirdisch",
            de(fnum(C, "bgfRAbove")),
            de(fnum(C, "bgfSAbove")),
            de(fnum(C, "bgfRSAbove")),
            de(float(m(C, "wfl"))),
            de(float(m(C, "commercialNuf"))),
            de(int(m(C, "units")), 0),
        ],
        caption="Flächen in m², Wohneinheiten in Stück",
    )
    doc.mark("A07", "Wohnfläche nach WoFlV Stadthaus",
             "Living area per WoFlV for the Stadthaus")
    doc.table(
        ["Bezugsgröße", "Wert", "Norm"],
        [
            ["BGF R+S oberirdisch", sqm(m(C, "bgfRSAbove")), "DIN 277-1"],
            ["BGF R+S unterirdisch", sqm(m(C, "bgfRSBelow")), "DIN 277-1"],
            ["BGF R+S gesamt", sqm(m(C, "bgfRSTotal")), "DIN 277-1"],
            ["Wohnfläche", sqm(m(C, "wfl")), "WoFlV"],
            ["Gewerbefläche (NUF)", sqm(m(C, "commercialNuf")), "DIN 277-1"],
            ["Nutzungsfläche NUF gesamt", sqm(m(C, "nuf")), "DIN 277-1"],
        ],
        [56.0, 42.0, 50.0],
        ["L", "R", "L"],
    )
    doc.small(
        "Eine Gesamtnutzungsfläche über alle Geschosse wird für das Stadthaus nicht "
        "ausgewiesen: das Haus ist gemischt genutzt, die Wohngeschosse werden nach WoFlV "
        "geführt und die Gewerbefläche nach DIN 277. Eine Addition beider Bezugsgrößen "
        "wäre normativ unzulässig und ist nicht gemeint."
    )
    doc.clause("10.1", "Verhältnis der Flächen")
    doc.p(
        f"Die Wohnfläche entspricht "
        f"{de(float(m(C, 'wfl')) / fnum(C, 'bgfRSAbove') * 100, 1)}{NB}% der "
        f"oberirdischen Bruttogrundfläche, die Gewerbefläche "
        f"{de(float(m(C, 'commercialNuf')) / fnum(C, 'bgfRSAbove') * 100, 1)}{NB}%. Der "
        "gegenüber dem Hofhaus niedrigere Wohnflächenanteil folgt aus dem gewerblich "
        "genutzten Erdgeschoss, aus den beiden Rücksprüngen und aus der größeren "
        "Geschosshöhe des Erdgeschosses."
    )
    doc.clause("10.2", "Wirkung der Rücksprünge")
    doc.p(
        "Die Bruttogrundfläche nimmt von unten nach oben ab: die beiden unteren "
        "Wohngeschosse tragen die volle Grundfläche, das dritte und vierte Obergeschoss "
        "liegen hinter dem Rücksprung der Nordfassade, das fünfte zusätzlich hinter dem "
        "Rücksprung der Westfassade, das sechste ist Staffelgeschoss. Diese Staffelung "
        "erklärt die ungleiche Verteilung der Wohnungen über die Geschosse."
    )

    doc.page()
    doc.h2("11   Wohnungsschlüssel")
    doc.mark("A08", "Wohneinheiten und Wohnungsschlüssel Stadthaus",
             "Residential units and unit mix for the Stadthaus")
    doc.table(
        ["Wohnungstyp", "Anzahl", "WFL von", "WFL bis", "Anteil"],
        [
            [
                lbl(label),
                de(number, 0),
                de(low),
                de(high),
                f"{de(number / int(m(C, 'units')) * 100, 1)}{NB}%",
            ]
            for label, number, low, high in C_MIX
        ],
        [40.0, 22.0, 28.0, 28.0, 30.0],
        ["L", "R", "R", "R", "R"],
        total=["Summe", de(int(m(C, "units")), 0), "", "", f"100,0{NB}%"],
        caption="Wohnflächen in m² je Wohnung, Anzahl in Stück",
    )
    doc.p(
        f"Der Schlüssel führt {cnt(m(C, 'units'), 'Wohneinheiten')} mit einer Wohnfläche "
        f"von zusammen {sqm(m(C, 'wfl'))}, im Mittel {qty(WFL_MEAN_C, M2)} je Wohnung. Die "
        "Verteilung ist wegen der beiden Rücksprünge ungleichmäßig über die Geschosse: "
        "die unteren Wohngeschosse tragen zehn Wohnungen, das Staffelgeschoss vier."
    )
    doc.clause("11.1", "Revisionshinweise und überholte Angaben")
    doc.table(
        ["Angabe", "überholter Wert", "gültiger Wert", "Quelle des gültigen Werts"],
        [
            [
                "Untergeschoss",
                "vollflächiges Untergeschoss (Rev A)",
                underground(C),
                "dieses Blatt, Abschnitt 3",
            ],
            [
                "Gewerbefläche",
                f"{de(1080.0)}{NB}{M2} (Grundriss EG V2)",
                sqm(m(C, "commercialNuf")),
                "dieses Blatt, Abschnitt 4",
            ],
        ],
        [26.0, 46.0, 28.0, 48.0],
        ["L", "L", "R", "L"],
    )
    doc.small(
        "Rev C ersetzt Rev A und Rev B vollständig. Die überholten Werte sind nur zur "
        "Zuordnung älterer Unterlagen genannt."
    )
    doc.clause("11.2", "Herkunft des Schlüssels")
    doc.p(
        "Der Schlüssel ist aus den Wohnungslisten der Blätter 4 bis 8 aggregiert. Der hohe "
        "Anteil großer Wohnungen in den oberen Geschossen folgt aus den Rücksprüngen: das "
        "Staffelgeschoss trägt ausschließlich Wohnungen mit fünf Zimmern."
    )
    doc.clause("11.3", "Offene Punkte dieses Blattes")
    doc.bullets(
        [
            "Zuschnitt der Gewerbeeinheiten: abhängig vom Mieter, Zusammenschaltung "
            "vorgehalten",
            "Nutzung des südlichen, nicht unterbauten Feldes durch die Freianlagen: in "
            "Abstimmung",
        ]
    )


# --------------------------------------------------------------------------
# 06 Schnitte und Ansichten (6 Blatt)
# --------------------------------------------------------------------------


def build_06(doc: Doc) -> None:
    doc.page()
    cover(
        doc,
        [
            ("Dokument", f"{doc.spec['title']} · {doc.spec['revision']}"),
            ("Plan-Nr.", doc.spec["planNumber"]),
            ("Maßstab der Zeichnung", "1:100 (zeichnerischer Teil, gesonderte Blätter)"),
            ("Höhenbezug", "Normalhöhennull, Bezugspunkt Nordkante"),
            ("Gebäude", "Kontorhaus, Hofhaus, Stadthaus"),
        ],
    )
    doc.clause("1", "Höhenbezug und Nullpunkt")
    doc.p(
        "Der Nullpunkt der Höhenangaben liegt auf der Oberkante des fertigen Fußbodens im "
        "Erdgeschoss des Kontorhauses. Alle Höhenangaben dieses Dokuments beziehen sich auf "
        "diesen Punkt. Die Geländeoberkante an der Nordkante liegt zwei Zentimeter darunter, "
        "die Geländeoberkante am südlichen Grünzug rund einen Meter tiefer; die Differenz "
        "wird im Freiraum über Freitreppe und Rampe abgefangen."
    )
    doc.mark("A01", "Geschosshöhen und Gebäudehöhen der drei Häuser",
             "Storey and building heights of the three buildings")
    doc.clause("2", "Geschoss- und Gebäudehöhen")
    doc.table(
        ["Gebäude", "Geschosshöhe EG", "Geschosshöhe OG", "lichte Höhe OG", "Gebäudehöhe"],
        [
            [
                b["name"],
                qty(HEIGHTS[b["id"]]["eg"], "m"),
                qty(HEIGHTS[b["id"]]["og"], "m"),
                qty(HEIGHTS[b["id"]]["clear_og"], "m"),
                qty(BUILDING_HEIGHT[b["id"]], "m"),
            ]
            for b in ORDER
        ],
        [30.0, 30.0, 30.0, 28.0, 30.0],
        ["L", "R", "R", "R", "R"],
    )
    doc.p(
        "Die Gebäudehöhe ist als Höhe der Oberkante des obersten Geschossfußbodens über "
        "der mittleren Geländeoberkante angegeben. Alle drei Häuser liegen über dreizehn "
        "Metern und sind damit der Gebäudeklasse 5 zugeordnet."
    )
    doc.clause("3", "Blattverzeichnis")
    doc.table(
        ["Blatt", "Inhalt"],
        [
            ["1", "Höhenbezug, Geschosshöhen, Blattverzeichnis"],
            ["2", "Schnitt A-A Kontorhaus"],
            ["3", "Schnitt B-B Hofhaus mit Untergeschoss"],
            ["4", "Schnitt C-C Stadthaus mit Teil-Untergeschoss"],
            ["5", "Ansichten und Fassadenaufbau"],
            ["6", "Dach, Dachaufbauten, Revisionshinweise"],
        ],
        [14.0, 134.0],
        ["L", "L"],
    )

    doc.page()
    doc.h2("4   Schnitt A-A Kontorhaus")
    doc.p(
        f"Der Schnitt A-A verläuft in Nord-Süd-Richtung durch den Nordkern des Kontorhauses. "
        f"Er zeigt {storeys(A)} über einer Bodenplatte ohne Untergeschoss. Die "
        f"Geschosshöhe im Erdgeschoss beträgt {qty(HEIGHTS['B-BLDG-A']['eg'], 'm')}, in "
        f"den Obergeschossen {qty(HEIGHTS['B-BLDG-A']['og'], 'm')}."
    )
    doc.table(
        ["Ebene", "Höhe über Nullpunkt", "Bemerkung"],
        [
            ["Oberkante Bodenplatte", qty(-0.30, "m"), "Rohbeton unter Bodenaufbau"],
            ["Erdgeschoss, OK Fertigfußboden", qty(0.00, "m"), "Nullpunkt des Projekts"],
            ["1. Obergeschoss", qty(4.00, "m"), "OK Fertigfußboden"],
            ["2. Obergeschoss", qty(7.50, "m"), "OK Fertigfußboden"],
            ["3. Obergeschoss", qty(11.00, "m"), "OK Fertigfußboden"],
            ["4. Obergeschoss", qty(14.50, "m"), "OK Fertigfußboden"],
            ["5. Obergeschoss", qty(18.00, "m"), "OK Fertigfußboden"],
            ["Oberkante Attika", qty(22.40, "m"), "einschließlich Absturzsicherung"],
        ],
        [56.0, 42.0, 50.0],
        ["L", "R", "L"],
    )
    doc.clause("4.1", "Aufbau der Geschossdecken")
    doc.p(
        "Die Geschossdecken sind als Holz-Beton-Verbunddecken mit einer Gesamtdicke von "
        "rund dreißig Zentimetern geplant. Der Deckenaufbau nimmt die Lüftungsleitungen "
        "der Bürogeschosse in einer abgehängten Decke von fünfundzwanzig Zentimetern auf; "
        "die lichte Höhe in den Obergeschossen beträgt damit "
        f"{qty(HEIGHTS['B-BLDG-A']['clear_og'], 'm')}."
    )
    doc.clause("4.2", "Gründung")
    doc.p(
        "Das Kontorhaus wird auf einer Bodenplatte mit örtlichen Verstärkungen unter den "
        "Kernen gegründet. Eine Tiefgründung ist nach dem Bodengutachten des Auftraggebers "
        "nicht erforderlich. Die Bodenplatte liegt vollständig oberhalb des "
        "Bemessungswasserstandes."
    )
    doc.clause("4.3", "Attika und Dachrand")
    doc.p(
        "Die Attika ist über die gesamte Gebäudehöhe hinweg durchgehend gedämmt und "
        "schließt mit einer Oberkante von 22,40{NB}m über dem Nullpunkt ab. Der Dachrand "
        "nimmt die Notentwässerung über Attikaausläufe auf; die Photovoltaikanlage steht "
        "aufgestellt und ohne Durchdringung der Abdichtung auf dem Dach."
    )
    doc.clause("4.4", "Vertikale Erschließung im Schnitt")
    doc.p(
        "Der Schnitt zeigt den Nordkern mit dem notwendigen Treppenraum und den beiden "
        "Personenaufzügen über alle sechs Geschosse. Der Aufzugsüberfahrt und der "
        "Triebwerksraum liegen innerhalb der eingehausten Dachtechnikfläche; eine "
        "Überdachaufbaute über die Attika hinaus entsteht dadurch nicht."
    )

    doc.page()
    doc.h2("5   Schnitt B-B Hofhaus")
    doc.p(
        f"Der Schnitt B-B verläuft in Ost-West-Richtung durch beide Treppenräume des "
        f"Hofhauses und zeigt {storeys(B)}. Das Untergeschoss ist vollflächig unter dem "
        "Gebäudeumriss ausgebildet und in diesem Schnitt in seiner gesamten Breite "
        "dargestellt."
    )
    doc.table(
        ["Ebene", "Höhe über Nullpunkt", "Bemerkung"],
        [
            ["Oberkante Bodenplatte Untergeschoss", qty(-3.30, "m"), "Rohbeton"],
            ["Untergeschoss, OK Fertigfußboden", qty(-3.00, "m"), "Stellplatzebene"],
            ["Erdgeschoss, OK Fertigfußboden", qty(0.00, "m"), "Wohnungen und Nebenräume"],
            ["1. Obergeschoss", qty(3.40, "m"), "OK Fertigfußboden"],
            ["2. Obergeschoss", qty(6.40, "m"), "OK Fertigfußboden"],
            ["3. Obergeschoss", qty(9.40, "m"), "OK Fertigfußboden"],
            ["4. Obergeschoss", qty(12.40, "m"), "OK Fertigfußboden"],
            ["Oberkante Attika", qty(16.20, "m"), "einschließlich Absturzsicherung"],
        ],
        [56.0, 42.0, 50.0],
        ["L", "R", "L"],
    )
    doc.clause("5.1", "Untergeschoss und Abdichtung")
    doc.p(
        f"Die lichte Höhe im Untergeschoss beträgt {qty(HEIGHTS['B-BLDG-B']['ug'], 'm')} "
        "unter Unterzügen und Leitungen. Die Außenwände und die Bodenplatte sind als "
        "wasserundurchlässige Konstruktion gegen von außen drückendes Wasser ausgebildet. "
        "Die Rampe erhält eine Pumpstation mit Rückstauverschluss."
    )
    doc.clause("5.2", "Decke über dem Untergeschoss")
    doc.p(
        "Die Decke über dem Untergeschoss ist eine Stahlbetondecke und bildet die "
        "brandschutztechnische Trennung zwischen Stellplatzanlage und Wohnnutzung. Ab dem "
        "Erdgeschoss werden die Geschossdecken als Holz-Beton-Verbunddecken mit sichtbarer "
        "Holzuntersicht in den Wohnräumen ausgeführt."
    )
    doc.clause("5.3", "Höhenlage der Erdgeschosswohnungen")
    doc.p(
        "Die Erdgeschosswohnungen liegen auf dem Nullniveau des Projekts und sind über den "
        "Laubengang schwellenlos erreichbar. Die Terrassen zum Hof liegen zwei Zentimeter "
        "unter dem Fertigfußboden; die Höhendifferenz zum Hofniveau wird im Freiraum "
        "abgefangen und ist mit der Freianlagenplanung abzustimmen."
    )
    doc.clause("5.4", "Dachanschluss")
    doc.p(
        "Über dem vierten Obergeschoss liegt das begrünte Flachdach mit Retentionsaufbau. "
        "Die Attika ist so hoch geführt, dass eine zusätzliche Absturzsicherung für "
        "Wartungsarbeiten entfällt. Die Lüftungsgeräte der Wohnungslüftung stehen in einer "
        "eingehausten Technikfläche über dem östlichen Treppenraum."
    )

    doc.page()
    doc.h2("6   Schnitt C-C Stadthaus")
    doc.mark("A02", "Umfang der Unterbauung im Schnitt Stadthaus",
             "Extent of the basement shown in the Stadthaus section")
    doc.p(
        f"Der Schnitt C-C verläuft in Nord-Süd-Richtung durch das Stadthaus und ist der "
        "Nachweisschnitt für den Umfang der Unterbauung. Er zeigt links den unterbauten "
        "nördlichen Gebäudeteil und rechts das nicht unterbaute südliche Feld mit "
        f"Streifenfundamenten. Das Haus hat damit {underground(C)}; ein vollflächiges "
        "Untergeschoss ist ausdrücklich nicht dargestellt und nicht geplant."
    )
    doc.table(
        ["Ebene", "Höhe über Nullpunkt", "Bemerkung"],
        [
            ["Oberkante Bodenplatte Teil-UG", qty(-3.30, "m"), "nur nördlicher Bereich"],
            ["Teil-Untergeschoss, OK Fertigfußboden", qty(-3.00, "m"), "Stellplatzebene"],
            ["Erdgeschoss, OK Fertigfußboden", qty(0.00, "m"), "Gewerbe"],
            ["1. Obergeschoss", qty(4.20, "m"), "erstes Wohngeschoss"],
            ["3. Obergeschoss", qty(10.20, "m"), "erster Rücksprung Nordfassade"],
            ["5. Obergeschoss", qty(16.20, "m"), "zweiter Rücksprung Westfassade"],
            ["6. Obergeschoss", qty(19.20, "m"), "Staffelgeschoss"],
            ["Oberkante Attika Staffelgeschoss", qty(22.60, "m"), "geschlossene Attika"],
        ],
        [56.0, 42.0, 50.0],
        ["L", "R", "L"],
    )
    doc.clause("6.1", "Setzungsfuge")
    doc.p(
        "Zwischen unterbautem und nicht unterbautem Bereich verläuft eine Setzungsfuge "
        "über alle Geschosse bis über das Dach. Die Fuge ist beidseitig gedämmt, luft- und "
        "schlagregendicht ausgebildet und in der Fassade als Schattennut sichtbar."
    )
    doc.clause("6.2", "Rücksprünge")
    doc.p(
        "Der Schnitt zeigt beide Rücksprünge: die Nordfassade tritt über dem zweiten "
        "Obergeschoss zurück, die Westfassade über dem vierten. Die entstehenden "
        "Terrassenflächen sind nicht überdeckt und daher nicht Teil der "
        "Bruttogrundfläche; ihre Anrechnung auf die Wohnfläche ist in der "
        "Flächenberechnung dokumentiert."
    )
    doc.clause("6.3", "Gründung im nicht unterbauten Feld")
    doc.p(
        "Im südlichen Feld wird die Gründung als Streifen- und Einzelfundament ausgeführt. "
        "Der Schnitt zeigt den Übergang zwischen Bodenplatte und Streifenfundament sowie "
        "die durchgehende Setzungsfuge. Die Nahleitung der Fernwärme durchdringt die Fuge "
        "und erhält an dieser Stelle einen Dehnungsausgleich."
    )
    doc.clause("6.4", "Erdgeschoss Gewerbe im Schnitt")
    doc.p(
        f"Die Geschosshöhe des Erdgeschosses beträgt "
        f"{qty(HEIGHTS['B-BLDG-C']['eg'], 'm')} und ist gegenüber den Wohngeschossen "
        "erhöht, damit die Gewerbeeinheiten eine Lüftungsverteilung unter der Decke "
        "aufnehmen können. Die Decke über dem Erdgeschoss ist die Trenndecke zwischen "
        "Gewerbe- und Wohnnutzung mit der höchsten Schallschutzanforderung des Projekts."
    )

    doc.page()
    doc.h2("7   Ansichten und Fassadenaufbau")
    doc.mark("A03", "Fassadenaufbau und Materialität je Haus",
             "Facade build-up and materials per building")
    doc.table(
        ["Ansicht", "Gebäude", "Aufbau", "Oberfläche"],
        [
            ["Nord", A["name"], "Holzrahmen mit hinterlüfteter Bekleidung",
             "Faserzementtafel, grau"],
            ["Ost / West", A["name"], "Holzrahmen mit Putzträgerplatte",
             "Mineralputz, hellgrau"],
            ["Hof", B["name"], "Holzrahmen mit hinterlüfteter Bekleidung",
             "Lärche, vorvergraut"],
            ["Nord / West", B["name"], "Holzrahmen mit Putzträgerplatte",
             "Mineralputz, warmweiß"],
            ["Süd (Grünzug)", C["name"], "Holzrahmen mit vorgesetzter Klinkerschale",
             "Klinker, rot-braun gemischt"],
            ["Nord / Hof", C["name"], "Holzrahmen mit Putzträgerplatte",
             "Mineralputz, hellgrau"],
        ],
        [24.0, 26.0, 58.0, 40.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("7.1", "Hierarchie der Fassaden")
    doc.p(
        "Die Südfassade des Stadthauses ist die repräsentative Fassade des Quartiers und "
        "erhält eine vorgesetzte Klinkerschale auf einer Konsolkonstruktion. Alle übrigen "
        "Fassaden sind als hinterlüftete Holzrahmenkonstruktion oder als "
        "Putzträgerkonstruktion geplant. Die Hierarchie folgt der sechsten Priorität des "
        "Auftraggebers."
    )
    doc.clause("7.2", "Fenster und Sonnenschutz")
    doc.p(
        "Die Fenster sind als Holz-Aluminium-Fenster mit Dreifachverglasung geplant. Der "
        "außenliegende Sonnenschutz ist an der Süd- und Westfassade als Raffstore, an der "
        "Nordfassade der Wohngeschosse als Rollo ausgeführt. Die Bürogeschosse des "
        "Kontorhauses erhalten durchgehend Raffstoren mit Windwächter."
    )
    doc.clause("7.3", "Erschütterungs- und Schallschutz an der Nordkante")
    doc.p(
        "Die Nordfassade liegt zur Bahntrasse. Die Wohngeschosse des Stadthauses erhalten "
        "dort eine geschlossene Fassade mit Schalldämmlüftern, das Kontorhaus eine "
        "Verglasung mit erhöhtem Schalldämmmaß. Der Nachweis ist Teil der Baubeschreibung."
    )
    doc.clause("7.4", "Fugen und Anschlüsse in der Ansicht")
    doc.p(
        "Die Setzungsfuge des Stadthauses ist in der Süd- und in der Nordansicht als "
        "Schattennut sichtbar und läuft über alle Geschosse bis über die Attika. Die "
        "Elementstöße der Holzrahmenkonstruktion sind hinter der Bekleidung verdeckt und "
        "erscheinen in der Ansicht nicht."
    )
    doc.clause("7.5", "Öffnungsanteile")
    doc.p(
        "Der Öffnungsanteil der Fassaden ist an der Nordkante bewusst niedrig gehalten und "
        "an der Süd- und Hofseite höher. Die Verteilung folgt der Schallbelastung und dem "
        "sommerlichen Wärmeschutz; sie ist Grundlage der Nachweise in der Bauphysik."
    )

    doc.page()
    doc.h2("8   Dach und Dachaufbauten")
    doc.mark("A04", "Dachaufbau, Begrünung und Aufbauten",
             "Roof build-up, greening and rooftop plant")
    doc.table(
        ["Gebäude", "Dachform", "Aufbau", "Aufbauten"],
        [
            [A["name"], "Flachdach", "Abdichtung, Kies, Photovoltaik aufgestellt",
             "Lüftungszentrale über Nordkern"],
            [B["name"], "Flachdach", "Abdichtung, Retentionsschicht, extensive Begrünung",
             "Lüftungsgeräte über Ostkern"],
            [C["name"], "Flachdach in zwei Ebenen",
             "Abdichtung, Retentionsschicht, extensive Begrünung",
             "Lüftungsgeräte über Staffelgeschoss"],
        ],
        [26.0, 26.0, 56.0, 40.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("8.1", "Retention und Entwässerung")
    doc.p(
        "Die Dächer der Wohnhäuser erhalten einen Retentionsaufbau mit gedrosseltem "
        "Ablauf. Die zulässige Einleitmenge ist eine Vorgabe des Entsorgungsträgers und "
        "wird über Drosselschächte im Freiraum eingehalten. Die Notentwässerung erfolgt "
        "über Attikaausläufe auf die eigene Grundstücksfläche."
    )
    doc.clause("8.2", "Photovoltaik")
    doc.p(
        "Auf dem Dach des Kontorhauses ist eine aufgestellte Photovoltaikanlage geplant. "
        "Die Wohnhäuser erhalten wegen der Begrünung und der Retention keine Anlage. Die "
        "elektrische Einbindung ist in den TGA-Anforderungen geführt."
    )
    doc.clause("8.3", "Revisionshinweise und überholte Angaben")
    doc.table(
        ["Angabe", "überholter Wert", "gültiger Wert", "Quelle"],
        [
            [
                "Unterbauung Stadthaus",
                "vollflächig (Schnitt C-C Rev A)",
                underground(C),
                "Blatt 4 dieses Dokuments",
            ],
            [
                "Dachform Stadthaus",
                "Flachdach einebenig",
                "Flachdach in zwei Ebenen",
                "Blatt 6, Abschnitt 8",
            ],
        ],
        [30.0, 46.0, 34.0, 38.0],
        ["L", "L", "L", "L"],
    )
    doc.small(
        "Rev B ersetzt Rev A vollständig. Die überholten Angaben sind nur zur Zuordnung "
        "älterer Blätter genannt."
    )
    doc.clause("8.4", "Zugänglichkeit der Dachflächen")
    doc.p(
        "Alle Dachflächen sind über die Treppenräume erreichbar; Außenleitern sind nicht "
        "vorgesehen. Die Wartungswege auf den begrünten Dächern werden als Plattenweg "
        "ausgebildet, damit die Retentionsschicht nicht befahren wird."
    )


# --------------------------------------------------------------------------
# 07 Flächenberechnung nach DIN 277 und WoFlV (8 Blatt)
# --------------------------------------------------------------------------


def _area_sheet(doc: Doc, building: dict, section: int, storey_rows, basement,
                anchor: tuple[str, str, str], notes: list[str]) -> None:
    doc.page()
    doc.h2(f"{section}   {building['name']} ({building['id']})")
    doc.kv(
        [
            ("Nutzung", usage(building)),
            ("Geschosse", storeys(building)),
            ("Untergeschoss", underground(building)),
        ],
        key_w=44.0,
    )
    doc.mark(anchor[0], anchor[1], anchor[2])
    doc.table(
        ["Bereich", "BGF R", "BGF S", "BGF R+S"],
        storey_rows,
        [58.0, 30.0, 30.0, 30.0],
        ["L", "R", "R", "R"],
        total=[
            "Summe des Gebäudes",
            de(fnum(building, "bgfRAbove") + fnum(building, "bgfRBelow")),
            de(fnum(building, "bgfSAbove") + fnum(building, "bgfSBelow")),
            de(fnum(building, "bgfRSTotal")),
        ],
        caption="Angaben in m², gerundet auf zwei Dezimalstellen",
    )
    doc.clause(f"{section}.1", "Abgleich mit der Grundrissunterlage")
    doc.bullets(notes)
    doc.clause(f"{section}.2", "Kontrollrechnung")
    doc.p(
        "Die Summe des Gebäudes ist aus den geschossweisen Einzelwerten dieser "
        "Aufstellung gebildet. Bereich R und Bereich S werden getrennt summiert und erst "
        "danach addiert; die oberirdischen und die unterirdischen Anteile werden getrennt "
        "geführt und nicht unter einer gemeinsamen Bezeichnung zusammengefasst. Jede "
        "Summe dieses Blattes ist damit aus den darüber stehenden Zeilen nachrechenbar."
    )
    doc.clause(f"{section}.3", "Grundlage der Aufstellung")
    doc.p(
        "Grundlage sind die herausgegebenen Grundrisse dieses Gebäudes in ihrer jeweils "
        "aktuellen Revision. Ältere Revisionen sind nicht eingearbeitet. Eine neue "
        "Grundrissrevision erzeugt zwingend eine neue Revision dieser Flächenberechnung; "
        "eine Teilfortschreibung einzelner Zeilen ist nicht zulässig."
    )


def build_07(doc: Doc) -> None:
    doc.page()
    cover(
        doc,
        [
            ("Dokument", f"{doc.spec['title']} · {doc.spec['revision']}"),
            ("Plan-Nr.", doc.spec["planNumber"]),
            ("Normbezug BGF und NUF", "DIN 277-1:2021-08"),
            ("Normbezug Wohnfläche", "Wohnflächenverordnung (WoFlV)"),
            ("Grundlage", "herausgegebene Grundrisse Kontorhaus, Hofhaus, Stadthaus"),
        ],
    )
    doc.clause("1", "Zweck und Geltung")
    doc.p(
        "Diese Flächenberechnung ist die einzige verbindliche Quelle für Flächen des "
        "Quartiers. Sie führt die Bruttogrundfläche nach DIN 277-1, die Nutzungsfläche nach "
        "DIN 277-1 und die Wohnfläche nach WoFlV je Gebäude und für das Gesamtprojekt "
        "zusammen. Andere Unterlagen dürfen Flächen nennen, sind im Konfliktfall aber "
        "dieser Berechnung untergeordnet."
    )
    doc.clause("2", "Normbezug und Bereichsgliederung")
    doc.p(
        "Die Bruttogrundfläche wird nach DIN 277-1:2021-08 in die Bereiche R und S "
        "gegliedert. Bereich R umfasst überdeckte und allseitig umschlossene Grundflächen, "
        "Bereich S überdeckte, aber nicht allseitig umschlossene Grundflächen wie Vordächer, "
        "Laubengänge und Loggien. Nicht überdeckte Flächen wie Terrassen und Dachterrassen "
        "sind nach dieser Norm nicht Bestandteil der Bruttogrundfläche."
    )
    doc.clause("3", "Revisionsverzeichnis")
    doc.table(
        ["Revision", "Datum", "Änderung", "Status"],
        [
            ["Rev A", "18.04.2026", "Erstaufstellung aus Vorentwurf", "überholt"],
            [
                "Rev B",
                "26.05.2026",
                "Übernahme der Grundrisse Kontorhaus und Hofhaus",
                "überholt",
            ],
            [
                "Rev C",
                dmy(doc.spec["issuedAt"]),
                "Stadthaus Rev C eingearbeitet, Gesamtsumme neu abgestimmt",
                "gültig",
            ],
        ],
        [22.0, 22.0, 84.0, 20.0],
        ["L", "L", "L", "L"],
    )
    doc.small(
        "Rev C ist die erste Revision, in der alle drei Häuser mit ihrer jeweils "
        "aktuellen Grundrissrevision eingearbeitet sind."
    )

    doc.page()
    doc.h2("4   Methodik und Abgrenzungen")
    doc.clause("4.1", "Ermittlung der Bruttogrundfläche")
    doc.p(
        "Die Bruttogrundfläche wird geschossweise aus den Außenmaßen der herausgegebenen "
        "Grundrisse ermittelt, gemessen an der Außenkante der Rohbaukonstruktion. "
        "Konstruktionsflächen sind enthalten. Aufzugsschächte werden in jedem Geschoss "
        "einmal angesetzt, Installationsschächte ebenfalls."
    )
    doc.clause("4.2", "Ermittlung der Nutzungsfläche")
    doc.p(
        "Die Nutzungsfläche nach DIN 277-1 enthält nur die tatsächlich der Zwecknutzung "
        "dienenden Flächen. Verkehrsflächen, Technikflächen und Konstruktionsflächen sind "
        "nicht enthalten. Für Bürogeschosse wird die Nutzungsfläche geschossweise "
        "ermittelt, für Gewerbeeinheiten je Einheit."
    )
    doc.clause("4.3", "Ermittlung der Wohnfläche")
    doc.p(
        "Die Wohnfläche wird nach WoFlV je Wohnung ermittelt. Raumteile mit einer Höhe "
        "unter zwei Metern treten in diesem Projekt nicht auf. Loggien, Balkone, Terrassen "
        "und Dachterrassen werden mit einem Viertel ihrer Fläche angerechnet; dieser "
        "Ansatz ist mit dem Auftraggeber abgestimmt und einheitlich angewendet."
    )
    doc.clause("4.4", "Was diese Berechnung nicht ausweist")
    doc.bullets(
        [
            "Keine Summe aus Wohnfläche und Nutzungsfläche. Die beiden Bezugsgrößen "
            "folgen unterschiedlichen Normen; eine gemeinsame Summe wäre keine normative "
            "Fläche und ist deshalb nicht gebildet.",
            "Keine Grundstücksfläche. Die Vereinigung der Flurstücke ist nicht vollzogen, "
            "ein bestätigter Wert liegt nicht vor, siehe Abschnitt 10.",
            "Keine Mietfläche nach gif-Richtlinie. Eine Mietflächenermittlung ist nicht "
            "Bestandteil dieser Berechnung.",
            "Keine nicht überdeckten Freiflächen als Bruttogrundfläche. Terrassen und "
            "Dachterrassen sind ausschließlich über die WoFlV-Anrechnung erfasst.",
        ]
    )
    doc.clause("4.5", "Rundung")
    doc.p(
        "Alle Flächen sind auf zwei Dezimalstellen geführt. Summen sind aus den "
        "gerundeten Einzelwerten gebildet, damit jede Summe im Dokument nachrechenbar "
        "ist. Eine abweichende Rundung in älteren Unterlagen ist keine Abweichung der "
        "Fläche."
    )

    _area_sheet(
        doc, A, 5,
        [[lbl(entry[0]), de(entry[1]), de(entry[2]), de(entry[1] + entry[2])]
         for entry in A_STOREYS]
        + [["Untergeschoss", de(fnum(A, "bgfRBelow")), de(fnum(A, "bgfSBelow")),
            de(fnum(A, "bgfRSBelow"))]],
        None,
        ("A01", "BGF R+S gesamt Kontorhaus", "Total BGF R+S for the Kontorhaus"),
        [
            f"Oberirdisch {sqm(m(A, 'bgfRSAbove'))}, unterirdisch "
            f"{sqm(m(A, 'bgfRSBelow'))}, gesamt {sqm(m(A, 'bgfRSTotal'))}.",
            f"Die unterirdischen Nullwerte folgen daraus, dass das Haus "
            f"{underground(A)} hat; sie sind ein echter Nullwert und keine fehlende "
            "Angabe.",
            f"Nutzungsfläche nach DIN 277: {sqm(m(A, 'nuf'))}, abgestimmt mit der "
            "Büroflächenliste V2.",
            f"Wohnfläche nach WoFlV: {sqm(m(A, 'wfl'))} - das Haus hat keine Wohnnutzung.",
            f"Gewerbefläche als Nutzungsfläche: {sqm(m(A, 'commercialNuf'))} - die "
            "Büronutzung wird nicht als Gewerbefläche im Sinne dieser Aufstellung geführt.",
        ],
    )

    _area_sheet(
        doc, B, 6,
        [[lbl(entry[0]), de(entry[1]), de(entry[2]), de(entry[1] + entry[2])]
         for entry in B_STOREYS]
        + [[B_BASEMENT[0], de(B_BASEMENT[1]), de(B_BASEMENT[2]),
            de(B_BASEMENT[1] + B_BASEMENT[2])]],
        B_BASEMENT,
        ("A02", "BGF R+S gesamt Hofhaus", "Total BGF R+S for the Hofhaus"),
        [
            f"Oberirdisch {sqm(m(B, 'bgfRSAbove'))}, unterirdisch "
            f"{sqm(m(B, 'bgfRSBelow'))}, gesamt {sqm(m(B, 'bgfRSTotal'))}.",
            f"Wohnfläche nach WoFlV: {sqm(m(B, 'wfl'))} auf "
            f"{cnt(m(B, 'units'), 'Wohneinheiten')}.",
            f"Nutzungsfläche nach DIN 277: {sqm(m(B, 'nuf'))} - für ein reines Wohnhaus "
            "wird diese Bezugsgröße nicht geführt.",
            f"Gewerbefläche: {sqm(m(B, 'commercialNuf'))} - keine Gewerbeeinheit im Haus.",
            f"Stellplätze im Untergeschoss: {cnt(m(B, 'parkingSpaces'), 'Stück')}, "
            "flächenmäßig in der unterirdischen Bruttogrundfläche enthalten.",
        ],
    )

    _area_sheet(
        doc, C, 7,
        [[lbl(entry[0]), de(entry[1]), de(entry[2]), de(entry[1] + entry[2])]
         for entry in C_STOREYS]
        + [[C_BASEMENT[0], de(C_BASEMENT[1]), de(C_BASEMENT[2]),
            de(C_BASEMENT[1] + C_BASEMENT[2])]],
        C_BASEMENT,
        ("A03", "BGF R+S gesamt Stadthaus", "Total BGF R+S for the Stadthaus"),
        [
            f"Oberirdisch {sqm(m(C, 'bgfRSAbove'))}, unterirdisch "
            f"{sqm(m(C, 'bgfRSBelow'))}, gesamt {sqm(m(C, 'bgfRSTotal'))}.",
            f"Wohnfläche nach WoFlV: {sqm(m(C, 'wfl'))} auf "
            f"{cnt(m(C, 'units'), 'Wohneinheiten')} in den Obergeschossen.",
            f"Gewerbefläche als Nutzungsfläche nach DIN 277: "
            f"{sqm(m(C, 'commercialNuf'))} im Erdgeschoss.",
            f"Nutzungsfläche insgesamt: {sqm(m(C, 'nuf'))} - für ein gemischt genutztes "
            "Haus wird keine gemeinsame Nutzungsfläche über Wohn- und Gewerbeteil "
            "gebildet.",
            f"Stellplätze im Teil-Untergeschoss: {cnt(m(C, 'parkingSpaces'), 'Stück')}.",
        ],
    )

    doc.page()
    doc.h2("8   Projektsummen Bruttogrundfläche")
    doc.mark("A04", "Summe BGF R+S oberirdisch Projekt",
             "Project sum of above-grade BGF R+S")
    doc.table(
        ["Gebäude", "BGF R+S oberirdisch", "BGF R+S unterirdisch", "BGF R+S gesamt"],
        [
            [b["name"], de(fnum(b, "bgfRSAbove")), de(fnum(b, "bgfRSBelow")),
             de(fnum(b, "bgfRSTotal"))]
            for b in ORDER
        ],
        [46.0, 34.0, 34.0, 34.0],
        ["L", "R", "R", "R"],
        total=["Summe Quartier", de(SUM_RS_ABOVE), de(SUM_RS_BELOW), de(SUM_RS_TOTAL)],
        caption="Angaben in m²",
    )
    doc.mark("A05", "Summe BGF R+S unterirdisch Projekt",
             "Project sum of below-grade BGF R+S")
    doc.clause("8.1", "Aufteilung der Projektsumme nach Bereichen")
    doc.table(
        ["Bereich", "oberirdisch", "unterirdisch", "gesamt"],
        [
            ["Bereich R (umschlossen, überdeckt)", de(SUM_R_ABOVE), de(SUM_R_BELOW),
             de(SUM_R_ABOVE + SUM_R_BELOW)],
            ["Bereich S (überdeckt, offen)", de(SUM_S_ABOVE), de(SUM_S_BELOW),
             de(SUM_S_ABOVE + SUM_S_BELOW)],
        ],
        [46.0, 34.0, 34.0, 34.0],
        ["L", "R", "R", "R"],
        total=["Summe R+S", de(SUM_RS_ABOVE), de(SUM_RS_BELOW), de(SUM_RS_TOTAL)],
        caption="Angaben in m²",
    )
    doc.mark("A06", "Summe BGF R+S gesamt Projekt", "Project total BGF R+S")
    doc.clause("8.2", "Führende Bezugsgröße des Quartiers")
    doc.p(
        f"Die führende Bezugsgröße für das Gesamtquartier ist die oberirdische "
        f"Bruttogrundfläche R+S mit {sqm(SUM_RS_ABOVE)}. Die unterirdische Fläche von "
        f"{sqm(SUM_RS_BELOW)} wird gesondert geführt und nicht unter der Bezeichnung "
        "oberirdisch mitgezählt. Die Gesamtfläche R+S beträgt "
        f"{sqm(SUM_RS_TOTAL)}."
    )
    doc.small(
        f"Nachrechenbar: {de(SUM_RS_ABOVE)} + {de(SUM_RS_BELOW)} = {de(SUM_RS_TOTAL)}. "
        f"Je Gebäude: {de(fnum(A, 'bgfRSTotal'))} + {de(fnum(B, 'bgfRSTotal'))} + "
        f"{de(fnum(C, 'bgfRSTotal'))} = {de(SUM_RS_TOTAL)}."
    )
    doc.clause("8.3", "Verteilung auf die drei Gebäude")
    doc.p(
        f"Das Stadthaus trägt mit {sqm(m(C, 'bgfRSTotal'))} den größten Anteil "
        f"({de(fnum(C, 'bgfRSTotal') / SUM_RS_TOTAL * 100, 1)}{NB}%), das Kontorhaus "
        f"{sqm(m(A, 'bgfRSTotal'))} ({de(fnum(A, 'bgfRSTotal') / SUM_RS_TOTAL * 100, 1)}"
        f"{NB}%) und das Hofhaus {sqm(m(B, 'bgfRSTotal'))} "
        f"({de(fnum(B, 'bgfRSTotal') / SUM_RS_TOTAL * 100, 1)}{NB}%). Die unterirdischen "
        "Anteile entstehen ausschließlich in Hofhaus und Stadthaus."
    )
    doc.clause("8.4", "Keine Unqualifizierte Gesamtangabe")
    doc.p(
        "Eine Gesamtfläche ohne Angabe des Bezugs wird in dieser Berechnung nicht "
        "verwendet. Jede Summe nennt Bereich, Lage und Norm; die Bezeichnung oberirdisch "
        "umfasst niemals unterirdische Anteile."
    )

    doc.page()
    doc.h2("9   Nutzungsflächen und Wohnflächen")
    doc.mark("A07", "Summe Wohnfläche nach WoFlV Projekt",
             "Project sum of living area per WoFlV")
    doc.table(
        ["Gebäude", "WFL nach WoFlV", "NUF nach DIN 277", "Gewerbe-NUF"],
        [
            [b["name"], sqm(m(b, "wfl")), sqm(m(b, "nuf")), sqm(m(b, "commercialNuf"))]
            for b in ORDER
        ],
        [46.0, 34.0, 34.0, 34.0],
        ["L", "R", "R", "R"],
        total=["Summe Quartier", de(SUM_WFL), de(SUM_NUF), de(SUM_COMMERCIAL)],
        caption="Angaben in m²; entfällt bedeutet, dass die Bezugsgröße für dieses Gebäude "
                "nicht existiert",
    )
    doc.mark("A08", "Summe NUF nach DIN 277 Projekt",
             "Project sum of NUF per DIN 277")
    doc.clause("9.1", "Wohnfläche")
    doc.p(
        f"Die Wohnfläche des Quartiers beträgt {sqm(SUM_WFL)} und entsteht aus dem Hofhaus "
        f"mit {sqm(m(B, 'wfl'))} und dem Stadthaus mit {sqm(m(C, 'wfl'))}. Das Kontorhaus "
        "trägt keine Wohnfläche bei; die Bezugsgröße existiert dort nicht und ist deshalb "
        "nicht mit null angesetzt."
    )
    doc.clause("9.2", "Nutzungsfläche")
    doc.p(
        f"Die Nutzungsfläche nach DIN 277 beträgt {sqm(SUM_NUF)} und entsteht "
        f"ausschließlich aus dem Kontorhaus. Für das Hofhaus und das Stadthaus wird keine "
        "Gesamtnutzungsfläche geführt, weil die dortige Wohnnutzung nach WoFlV bilanziert "
        "wird."
    )
    doc.mark("A09", "Summe Gewerbefläche NUF Projekt",
             "Project sum of commercial NUF")
    doc.clause("9.3", "Gewerbefläche")
    doc.p(
        f"Die Gewerbefläche des Quartiers beträgt {sqm(SUM_COMMERCIAL)} und liegt "
        "vollständig im Erdgeschoss des Stadthauses. Die Bürofläche des Kontorhauses wird "
        "nicht als Gewerbefläche geführt, sondern als Nutzungsfläche der Büronutzung."
    )
    doc.clause("9.4", "Führende Kennzahl je Nutzung")
    doc.p(
        "Für die Wohnnutzung ist die Wohnfläche nach WoFlV die führende Bezugsgröße, für "
        "die Büronutzung die Nutzungsfläche nach DIN 277 und für die Gewerbenutzung die "
        "Nutzungsfläche der Gewerbeeinheiten. Jede Kennzahl nennt ihren Normbezug, damit "
        "sie nicht mit einer anderen verwechselt wird."
    )
    doc.clause("9.5", "Keine gemeinsame Summe")
    doc.p(
        f"Eine Summe aus {sqm(SUM_WFL)} Wohnfläche und {sqm(SUM_NUF)} Nutzungsfläche wird "
        "ausdrücklich nicht gebildet. Die Bezugsgrößen folgen verschiedenen Normen; eine "
        "Addition ergäbe keine normative Fläche und wäre für einen Vergleich mit "
        "Kennwerten nicht verwendbar."
    )

    doc.page()
    doc.h2("10   Mengen, Grundstücksfläche und Vermerke")
    doc.clause("10.1", "Abgeleitete Mengen")
    doc.table(
        ["Menge", A["name"], B["name"], C["name"], "Quartier"],
        [
            ["Wohneinheiten", sqm(None), cnt(m(B, "units"), "St."),
             cnt(m(C, "units"), "St."), cnt(SUM_UNITS, "St.")],
            ["Arbeitsplätze", cnt(m(A, "workplaces"), "St."), sqm(None), sqm(None),
             cnt(SUM_WORKPLACES, "St.")],
            ["Stellplätze", sqm(None), cnt(m(B, "parkingSpaces"), "St."),
             cnt(m(C, "parkingSpaces"), "St."), cnt(SUM_PARKING, "St.")],
        ],
        [34.0, 30.0, 28.0, 28.0, 28.0],
        ["L", "R", "R", "R", "R"],
        caption="Angaben in Stück; entfällt bedeutet, dass die Menge für dieses Gebäude "
                "nicht existiert",
    )
    doc.mark("A10", "Grundstücksfläche ohne bestätigten Wert",
             "Site area without a confirmed value")
    doc.clause("10.2", "Grundstücksfläche")
    doc.p(
        "Die Grundstücksfläche ist in dieser Berechnung nicht ausgewiesen. Die Vereinigung "
        "der Flurstücke zu einem Baufeld ist beim Auftraggeber in Bearbeitung und nicht "
        "vollzogen; ein vermessungsrechtlich bestätigter Wert liegt nicht vor. Die Fläche "
        "ist auch keinem der drei Gebäude zugeordnet und entfällt daher auf Gebäudeebene. "
        "Ein Ersatzwert oder ein Nullwert darf an dieser Stelle nicht eingesetzt werden."
    )
    doc.clause("10.3", "Überholte Angaben")
    doc.table(
        ["Angabe", "überholter Wert", "gültiger Wert", "Grund der Änderung"],
        [
            [
                "Gesamt-BGF R+S",
                f"{de(19710.0)}{NB}{M2} (Flächenliste FINAL)",
                f"{de(SUM_RS_TOTAL)}{NB}{M2}",
                "Stadthaus Rev C, Teil-Untergeschoss statt Vollunterkellerung",
            ],
            [
                "NUF Kontorhaus",
                f"{de(4520.0)}{NB}{M2} (Büroflächenliste V1)",
                f"{de(float(m(A, 'nuf')))}{NB}{M2}",
                "Technikflächen aus der Nutzungsfläche herausgenommen",
            ],
            [
                "Gewerbefläche Stadthaus",
                f"{de(1080.0)}{NB}{M2} (Grundriss EG V2)",
                f"{de(float(m(C, 'commercialNuf')))}{NB}{M2}",
                "Sanitärkerne und Anlieferungsraum als Nebenfläche geführt",
            ],
        ],
        [30.0, 42.0, 26.0, 50.0],
        ["L", "L", "R", "L"],
    )
    doc.clause("10.4", "Abstimmungsvermerke")
    doc.bullets(
        [
            "Der Ansatz für Loggien, Balkone und Terrassen nach WoFlV mit einem Viertel "
            "der Fläche ist mit dem Auftraggeber abgestimmt.",
            "Die Zuordnung der eingehausten Dachtechnikflächen außerhalb der "
            "Geschossebene ist mit der Tragwerks- und der TGA-Planung abgestimmt.",
            "Die Aufteilung der Bruttogrundfläche in die Bereiche R und S ist je Geschoss "
            "aus den herausgegebenen Grundrissen übernommen und nicht pauschaliert.",
        ]
    )


# --------------------------------------------------------------------------
# 08 Baubeschreibung (12 Blatt)
# --------------------------------------------------------------------------


def build_08(doc: Doc) -> None:
    doc.page()
    cover(
        doc,
        [
            ("Dokument", f"{doc.spec['title']} · {doc.spec['revision']}"),
            ("Plan-Nr.", doc.spec["planNumber"]),
            ("Geltung", "alle drei Gebäude, soweit nicht gebäudeweise unterschieden"),
            ("Leistungsstand", "Vorplanung, Grundlage der Angebotskalkulation"),
        ],
    )
    doc.clause("1", "Zweck und Geltung")
    doc.p(
        "Diese Baubeschreibung beschreibt Konstruktion, Materialien, Gebäudehülle und "
        "Ausbaustandard des Quartiers. Sie gilt für alle drei Gebäude; abweichende "
        "Anforderungen sind gebäudeweise gekennzeichnet. Flächen und Mengen werden hier "
        "nicht geführt, sondern in der Flächenberechnung und in den Grundrissen."
    )
    doc.clause("2", "Gliederung")
    doc.table(
        ["Blatt", "Abschnitt"],
        [
            ["2", "3   Konstruktionssystem"],
            ["3", "4   Gründung und Untergeschosse"],
            ["4", "5   Tragwerk und Materialien Holzbau"],
            ["5", "6   Decken und Verbundkonstruktion"],
            ["6", "7   Gebäudehülle und Fassade"],
            ["7", "8   Dach und Abdichtung"],
            ["8", "9   Fenster, Türen und Sonnenschutz"],
            ["9", "10   Brandschutz"],
            ["10", "11   Schall- und Erschütterungsschutz"],
            ["11", "12   Ausbaustandard"],
            ["12", "13   Baustelleneinrichtung und Qualitätssicherung"],
        ],
        [16.0, 132.0],
        ["L", "L"],
    )
    doc.clause("2.1", "Revisionsverzeichnis")
    doc.table(
        ["Revision", "Datum", "Änderung", "Status"],
        [
            ["Rev A", "22.06.2026", "Erstfassung", "überholt"],
            [
                "Rev B",
                dmy(doc.spec["issuedAt"]),
                "Brandschutz und Schallschutz präzisiert, Wohnungsanzahl korrigiert",
                "gültig",
            ],
        ],
        [22.0, 22.0, 84.0, 20.0],
        ["L", "L", "L", "L"],
    )
    doc.small(
        "Rev A nannte für das Hofhaus 48 Wohneinheiten. Gültig sind "
        f"{cnt(m(B, 'units'), 'Wohneinheiten')} nach dem koordinierten Wohnungsschlüssel; "
        "die Angabe aus Rev A ist überholt."
    )

    doc.page()
    doc.h2("3   Konstruktionssystem")
    doc.mark("A01", "Konstruktionssystem der drei Gebäude",
             "Structural system of the three buildings")
    doc.p(
        "Alle drei Gebäude werden als Holz-Hybridbauten ausgeführt: Untergeschosse, "
        "Bodenplatten und Erschließungskerne in Stahlbeton, aufgehende Konstruktion und "
        "Decken in Holz- beziehungsweise Holz-Beton-Verbundbauweise. Die Kerne übernehmen "
        "die horizontale Aussteifung."
    )
    doc.table(
        ["Bauteil", "Kontorhaus", "Hofhaus", "Stadthaus"],
        [
            ["Untergeschoss", "entfällt", "Stahlbeton, wasserundurchlässig",
             "Stahlbeton, wasserundurchlässig"],
            ["Bodenplatte", "Stahlbeton", "Stahlbeton", "Stahlbeton"],
            ["Erschließungskerne", "Stahlbeton, zwei Kerne", "Stahlbeton, zwei Kerne",
             "Stahlbeton, ein Kern"],
            ["Außenwände", "Holzrahmen", "Holzrahmen", "Holzrahmen"],
            ["Innenwände tragend", "Brettsperrholz", "Brettsperrholz", "Brettsperrholz"],
            ["Decken", "Holz-Beton-Verbund", "Holz-Beton-Verbund",
             "Holz-Beton-Verbund"],
            ["Stützen", "Buchen-Furnierschichtholz", "entfällt",
             "Buchen-Furnierschichtholz im Erdgeschoss"],
        ],
        [30.0, 38.0, 40.0, 40.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("3.1", "Vorfertigung")
    doc.p(
        "Außenwände und Innenwände werden als Elemente vorgefertigt und mit Fenstern, "
        "Bekleidungsunterkonstruktion und Leerrohren angeliefert. Der Vorfertigungsgrad "
        "bestimmt die Anlieferungslogistik und ist mit der Vormontagefläche im südlichen "
        "Baufeld abgestimmt."
    )
    doc.clause("3.2", "Toleranzen und Maßgenauigkeit")
    doc.p(
        "Die Maßgenauigkeit der Stahlbetonkerne bestimmt die Passung der Holzelemente. "
        "Die Kerne werden mit erhöhter Genauigkeit ausgeführt und vor dem Aufstellen der "
        "Holzkonstruktion aufgemessen. Ein Ausgleich am Element ist nicht vorgesehen."
    )
    doc.clause("3.3", "Aussteifung")
    doc.p(
        "Die horizontale Aussteifung aller drei Gebäude läuft über die Stahlbetonkerne. "
        "Die Holzkonstruktion trägt vertikal und leitet Horizontallasten über die "
        "Deckenscheiben in die Kerne. Beim Stadthaus mit nur einem Kern wird die "
        "Aussteifung zusätzlich über zwei ausgesteifte Wandscheiben an der Nordseite "
        "sichergestellt."
    )
    doc.clause("3.4", "Trennung der Bauwerke")
    doc.p(
        "Die drei Häuser sind konstruktiv getrennt und werden als eigene Bauwerke "
        "geführt. Die Trennung verläuft als durchgehende Fuge über alle Geschosse "
        "einschließlich der benachbarten Untergeschosse von Hofhaus und Stadthaus."
    )

    doc.page()
    doc.h2("4   Gründung und Untergeschosse")
    doc.clause("4.1", "Gründung")
    doc.p(
        "Die Gründung erfolgt nach dem Bodengutachten des Auftraggebers als Flachgründung. "
        "Das Kontorhaus erhält eine Bodenplatte mit örtlichen Verstärkungen unter den "
        "Kernen. Hofhaus und Stadthaus erhalten im unterbauten Bereich eine durchgehende "
        "Bodenplatte, das Stadthaus im nicht unterbauten südlichen Feld Streifen- und "
        "Einzelfundamente."
    )
    doc.clause("4.2", "Wasserundurchlässige Konstruktion")
    doc.p(
        "Die Untergeschosse von Hofhaus und Stadthaus werden als wasserundurchlässige "
        "Konstruktion gegen von außen drückendes Wasser ausgeführt. Die Nutzungsklasse "
        "erlaubt Feuchtstellen an der Innenoberfläche in Nebenräumen, nicht in "
        "Technikräumen und nicht in den Abstellräumen der Wohnungen."
    )
    doc.clause("4.3", "Setzungsfuge Stadthaus")
    doc.p(
        "Zwischen unterbautem und nicht unterbautem Bereich des Stadthauses verläuft eine "
        "Setzungsfuge über alle Geschosse. Die Fuge wird beidseitig gedämmt, luftdicht und "
        "schlagregendicht ausgebildet und in der Fassade als Schattennut geführt."
    )
    doc.clause("4.4", "Umfang der Untergeschosse")
    doc.table(
        ["Gebäude", "Untergeschoss", "BGF R+S unterirdisch", "Nutzung"],
        [
            [b["name"], underground(b), sqm(m(b, "bgfRSBelow")),
             nutzung]
            for b, nutzung in zip(
                ORDER,
                [
                    "keine unterirdische Nutzung",
                    "Stellplätze, Abstellräume, Technik",
                    "Stellplätze, Abstellräume, Technik",
                ],
            )
        ],
        [26.0, 40.0, 34.0, 48.0],
        ["L", "L", "R", "L"],
    )
    doc.clause("4.5", "Entwässerung der Untergeschosse")
    doc.p(
        "Die Rampe des Hofhauses erhält eine Pumpstation mit Rückstauverschluss. Die "
        "Bodenabläufe der Stellplatzanlagen werden über einen Abscheider geführt. Die "
        "Entwässerung des Kontorhauses erfolgt über eine Hebeanlage im Erdgeschoss, weil "
        "das Haus kein Untergeschoss hat."
    )

    doc.page()
    doc.h2("5   Tragwerk und Materialien Holzbau")
    doc.mark("A02", "Materialien und Güten des Holzbaus",
             "Timber materials and strength grades")
    doc.table(
        ["Bauteil", "Material", "Güte / Ausführung", "Sichtbarkeit"],
        [
            ["Außenwandelemente", "Konstruktionsvollholz Fichte", "C24, technisch getrocknet",
             "bekleidet"],
            ["Tragende Innenwände", "Brettsperrholz Fichte", "CLT, fünflagig",
             "teilweise sichtbar"],
            ["Deckenelemente", "Brettsperrholz Fichte", "CLT, fünf- bis siebenlagig",
             "Untersicht sichtbar im Wohnungsbau"],
            ["Stützen", "Furnierschichtholz Buche", "hohe Festigkeit, kleiner Querschnitt",
             "sichtbar im Erdgeschoss"],
            ["Träger", "Brettschichtholz Fichte", "GL24h", "bekleidet"],
            ["Verbindungsmittel", "Stahl, verzinkt", "Vollgewindeschrauben, Winkel",
             "verdeckt"],
        ],
        [30.0, 34.0, 44.0, 40.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("5.1", "Sichtholz im Wohnungsbau")
    doc.p(
        "Der Auftraggeber verlangt sichtbare Deckenuntersichten in den Wohnungen des "
        "Hofhauses. Die Untersichten werden in Sichtqualität ausgeführt, ohne Anstrich und "
        "ohne Bekleidung. Die Anforderung wirkt auf die Leitungsführung: Elektroleitungen "
        "werden in der Trennwand und im Bodenaufbau geführt, nicht in der Decke."
    )
    doc.clause("5.2", "Feuchteschutz während der Bauzeit")
    doc.p(
        "Die Holzkonstruktion wird während der Montage witterungsgeschützt ausgeführt. "
        "Vorgesehen ist eine Kombination aus abschnittsweiser Einhausung und sofortiger "
        "Aufbringung der Behelfsabdichtung auf den Deckenelementen. Der Feuchtegehalt der "
        "Bauteile wird vor dem Schließen der Konstruktion dokumentiert."
    )
    doc.clause("5.3", "Nachweise")
    doc.bullets(
        [
            "Standsicherheitsnachweis nach Eurocode 5 einschließlich Aussteifung über die "
            "Stahlbetonkerne",
            "Nachweis der Deckenschwingung für Wohnungs- und Bürodecken",
            "Nachweis des konstruktiven Holzschutzes ohne chemischen Holzschutz",
            "Nachweis der Feuerwiderstandsdauer der tragenden Holzbauteile",
        ]
    )

    doc.page()
    doc.h2("6   Decken und Verbundkonstruktion")
    doc.clause("6.1", "Aufbau der Verbunddecke")
    doc.p(
        "Die Geschossdecken sind Holz-Beton-Verbunddecken: Brettsperrholzelement als "
        "Zugzone, aufbetonierte Ortbetonschicht als Druckzone, Verbund über "
        "Vollgewindeschrauben. Die Konstruktion erreicht die erforderlichen Spannweiten, "
        "begrenzt die Deckenschwingung und trägt zum Schallschutz bei."
    )
    doc.table(
        ["Kenngröße", "Wohnungsbau", "Bürogeschosse", "Bemerkung"],
        [
            ["Brettsperrholz", "140 mm", "160 mm", "fünf- bis siebenlagig"],
            ["Ortbetonschicht", "80 mm", "100 mm", "bewehrt, Verbund geschraubt"],
            ["Bodenaufbau", "80 mm", "70 mm", "Estrich auf Trittschalldämmung"],
            ["Gesamtdicke", "300 mm", "330 mm", "ohne abgehängte Decke"],
            ["abgehängte Decke", "keine", "250 mm", "nur Bürogeschosse"],
        ],
        [34.0, 32.0, 32.0, 50.0],
        ["L", "R", "R", "L"],
    )
    doc.clause("6.2", "Deckenschwingung")
    doc.p(
        "Die Decken werden für eine erhöhte Anforderung an das Schwingungsverhalten "
        "nachgewiesen. Für die Bürogeschosse ist die Anforderung wegen der offenen "
        "Struktur und der großen Spannweite maßgebend; im Wohnungsbau bestimmt die "
        "Wohnungstrenndecke den Aufbau."
    )
    doc.clause("6.3", "Decke über der Stellplatzanlage")
    doc.p(
        "Die Decke über den Stellplatzanlagen ist eine Stahlbetondecke. Sie trennt die "
        "Stellplatznutzung brandschutztechnisch von der Wohnnutzung und nimmt die Lasten "
        "der Freianlagen im Hofbereich auf."
    )
    doc.clause("6.4", "Öffnungen und Durchdringungen")
    doc.p(
        "Durchdringungen der Verbunddecke werden in der Werkplanung festgelegt und im "
        "Element vorgefertigt. Nachträgliche Durchbrüche in der Zugzone sind nicht "
        "zulässig. Die Steigezonen liegen ausschließlich in den Kernen und in den dafür "
        "vorgesehenen Schächten."
    )
    doc.clause("6.5", "Verbundfuge und Ausführungsfolge")
    doc.p(
        "Die Ortbetonschicht wird auf das verlegte Brettsperrholzelement aufgebracht; die "
        "Verbundmittel sind vor dem Betonieren gesetzt. Die Ausführungsfolge verlangt, "
        "dass ein Geschoss vor der Montage des nächsten ausbetoniert und ausgehärtet ist. "
        "Diese Folge bestimmt den Takt der Rohbauphase."
    )

    doc.page()
    doc.h2("7   Gebäudehülle und Fassade")
    doc.mark("A03", "Aufbau der Gebäudehülle und Fassadenmaterial",
             "Envelope build-up and facade material")
    doc.table(
        ["Gebäude / Seite", "Aufbau", "Oberfläche", "U-Wert Ziel"],
        [
            [f"{A['name']}, Nord", "Holzrahmen, hinterlüftet",
             "Faserzementtafel", f"0,16{NB}W/(m²K)"],
            [f"{A['name']}, übrige", "Holzrahmen, Putzträgerplatte",
             "Mineralputz", f"0,16{NB}W/(m²K)"],
            [f"{B['name']}, Hof", "Holzrahmen, hinterlüftet",
             "Lärche vorvergraut", f"0,15{NB}W/(m²K)"],
            [f"{B['name']}, übrige", "Holzrahmen, Putzträgerplatte",
             "Mineralputz", f"0,15{NB}W/(m²K)"],
            [f"{C['name']}, Süd", "Holzrahmen, Klinkerschale auf Konsolen",
             "Klinker rot-braun", f"0,15{NB}W/(m²K)"],
            [f"{C['name']}, übrige", "Holzrahmen, Putzträgerplatte",
             "Mineralputz", f"0,15{NB}W/(m²K)"],
        ],
        [38.0, 44.0, 34.0, 32.0],
        ["L", "L", "L", "R"],
    )
    doc.clause("7.1", "Luftdichtheit")
    doc.p(
        "Die luftdichte Ebene liegt auf der Innenseite der Holzrahmenkonstruktion und wird "
        "im Element vorgefertigt. Anschlüsse an Kerne, Decken und Fenster werden mit "
        "vorkomprimierten Bändern und Klebebändern ausgeführt. Für jedes Gebäude ist eine "
        "Luftdichtheitsmessung vorgesehen."
    )
    doc.clause("7.2", "Wärmebrücken")
    doc.p(
        "Auskragende Bauteile werden thermisch getrennt. Die Loggien sind als vorgestellte "
        "Konstruktion ohne durchgehende Betonplatte geplant. Die Attiken erhalten eine "
        "durchgehende Dämmung; der Wärmebrückenzuschlag wird gebäudeweise nachgewiesen."
    )
    doc.clause("7.3", "Klinkerschale Südfassade Stadthaus")
    doc.p(
        "Die Klinkerschale wird auf einer Konsolkonstruktion vor der Holzrahmenwand "
        "abgetragen. Die Konsolen werden in die Verbunddecke eingebunden. Die Schale ist "
        "hinterlüftet und erhält an jedem Geschoss eine Entwässerungsebene."
    )
    doc.clause("7.4", "Holzbekleidung Hoffassade")
    doc.p(
        "Die Hoffassade des Hofhauses erhält eine hinterlüftete Bekleidung aus Lärche in "
        "vorvergrauter Ausführung ohne Anstrich. Der konstruktive Holzschutz wird über "
        "Abstand zum Terrain, Tropfkanten und hinterlüftete Ebene sichergestellt; ein "
        "chemischer Holzschutz ist ausgeschlossen."
    )
    doc.page()
    doc.h2("8   Dach und Abdichtung")
    doc.clause("8.1", "Dachaufbau")
    doc.table(
        ["Gebäude", "Aufbau von innen nach außen", "Dämmung", "Oberfläche"],
        [
            [A["name"],
             "Verbunddecke, Dampfsperre, Dämmung, Abdichtung",
             "260 mm", "Kies, Photovoltaik aufgestellt"],
            [B["name"],
             "Verbunddecke, Dampfsperre, Dämmung, Abdichtung, Retention",
             "280 mm", "extensive Begrünung"],
            [C["name"],
             "Verbunddecke, Dampfsperre, Dämmung, Abdichtung, Retention",
             "280 mm", "extensive Begrünung, zwei Ebenen"],
        ],
        [26.0, 60.0, 22.0, 40.0],
        ["L", "L", "R", "L"],
    )
    doc.clause("8.2", "Abdichtung")
    doc.p(
        "Die Dachabdichtung wird zweilagig bituminös ausgeführt, unter der Begrünung mit "
        "wurzelfester oberer Lage. Über der Holzkonstruktion wird eine "
        "Behelfsabdichtung unmittelbar nach der Montage aufgebracht; sie bleibt als "
        "zusätzliche Sicherungsebene im Aufbau."
    )
    doc.clause("8.3", "Retention und Notentwässerung")
    doc.p(
        "Die Dächer der Wohnhäuser erhalten eine Retentionsschicht mit gedrosseltem "
        "Ablauf. Die zulässige Einleitmenge ist eine Vorgabe des Entsorgungsträgers. Die "
        "Notentwässerung erfolgt über Attikaausläufe auf die eigene Fläche und ist von der "
        "Hauptentwässerung getrennt."
    )
    doc.clause("8.4", "Absturzsicherung und Wartung")
    doc.p(
        "Die Attiken der Wohnhäuser sind so hoch ausgeführt, dass eine Absturzsicherung "
        "für Wartungsarbeiten entbehrlich ist. Auf dem Kontorhaus wird wegen der "
        "Photovoltaikanlage ein Anschlagpunktsystem vorgesehen. Der Zugang erfolgt über "
        "die Treppenräume, nicht über Außenleitern."
    )
    doc.clause("8.5", "Dachaufbauten")
    doc.p(
        "Die eingehausten Technikflächen auf den Dächern sind konstruktiv Teil des "
        "Dachaufbaus und liegen außerhalb der Geschossebene. Ihre flächenmäßige "
        "Behandlung ist mit der Flächenberechnung abgestimmt und dort dokumentiert."
    )

    doc.page()
    doc.h2("9   Fenster, Türen und Sonnenschutz")
    doc.clause("9.1", "Fenster")
    doc.table(
        ["Bauteil", "Ausführung", "Verglasung", "Anforderung"],
        [
            ["Fenster Wohnen", "Holz-Aluminium", "Dreifachverglasung",
             f"Uw 0,90{NB}W/(m²K)"],
            ["Fenster Büro", "Holz-Aluminium", "Dreifachverglasung, Sonnenschutzglas",
             f"Uw 0,90{NB}W/(m²K)"],
            ["Fenster Nordfassade Wohnen", "Holz-Aluminium, festverglast mit Lüfter",
             "Dreifachverglasung, Schallschutz", f"Rw 42{NB}dB"],
            ["Pfosten-Riegel Erdgeschoss", "Aluminium, thermisch getrennt",
             "Dreifachverglasung", f"Ucw 1,20{NB}W/(m²K)"],
        ],
        [40.0, 42.0, 40.0, 26.0],
        ["L", "L", "L", "R"],
    )
    doc.clause("9.2", "Türen")
    doc.bullets(
        [
            "Wohnungseingangstüren als Funktionstüren mit Anforderung an Schall-, "
            "Einbruch- und Rauchschutz",
            "Treppenraumtüren als Rauchschutztüren mit Feststellanlage, soweit "
            "brandschutztechnisch gefordert",
            "Türen der Technikräume und Hausanschlussräume abschließbar, Schließanlage "
            "getrennt von der Wohnnutzung",
            "Gewerbeeinheiten mit eigener Außentür je Einheit, barrierefrei erreichbar",
        ]
    )
    doc.clause("9.3", "Sonnenschutz")
    doc.p(
        "Der außenliegende Sonnenschutz ist an Süd- und Westfassaden als Raffstore "
        "ausgeführt, an der Nordfassade der Wohngeschosse als Rollo. Die Bürogeschosse des "
        "Kontorhauses erhalten durchgehend Raffstoren mit Windwächter und einer "
        "Ansteuerung über die Gebäudeautomation."
    )
    doc.clause("9.4", "Sommerlicher Wärmeschutz")
    doc.p(
        "Der Nachweis des sommerlichen Wärmeschutzes wird gebäudeweise geführt. Für die "
        "Bürogeschosse ist die Kombination aus Sonnenschutzglas, Raffstore und "
        "Nachtlüftung über die Lüftungsanlage maßgebend, für die Wohnungen die "
        "Kombination aus außenliegendem Sonnenschutz und Querlüftbarkeit."
    )

    doc.page()
    doc.h2("10   Brandschutz")
    doc.mark("A04", "Brandschutzanforderungen und Gebäudeklasse",
             "Fire protection requirements and building class")
    doc.p(
        "Alle drei Gebäude sind der Gebäudeklasse 5 zugeordnet, weil die Höhe des obersten "
        "Geschossfußbodens über dreizehn Metern liegt. Daraus folgen die Anforderungen an "
        "die Feuerwiderstandsdauer der tragenden Bauteile, an die Ausbildung der "
        "Treppenräume und an die Verwendung brennbarer Baustoffe."
    )
    doc.table(
        ["Bauteil", "Anforderung", "Ausführung"],
        [
            ["Tragende Bauteile", "feuerwiderstandsfähig 90 Minuten",
             "Holzbauteile mit Abbrandbemessung und Bekleidung"],
            ["Wohnungstrennwände", "feuerwiderstandsfähig 90 Minuten, raumabschließend",
             "Brettsperrholz mit beidseitiger Bekleidung"],
            ["Treppenraumwände", "feuerwiderstandsfähig, nichtbrennbar",
             "Stahlbetonkern"],
            ["Decke über Stellplatzanlage", "feuerwiderstandsfähig 90 Minuten",
             "Stahlbetondecke"],
            ["Fassadenoberfläche", "schwerentflammbar",
             "Faserzement, Mineralputz, Klinker; Lärche mit Sonderregelung"],
            ["Installationsschächte", "eigene Brandabschnitte",
             "Schachtwände nichtbrennbar, Abschottungen geprüft"],
        ],
        [36.0, 54.0, 58.0],
        ["L", "L", "L"],
    )
    doc.clause("10.1", "Holzbau in Gebäudeklasse 5")
    doc.p(
        "Die sichtbaren Holzoberflächen im Wohnungsbau setzen eine Sonderregelung voraus, "
        "die mit der Brandschutzplanung und der Genehmigungsbehörde abzustimmen ist. Die "
        "Abstimmung ist zum Ausgabedatum dieser Revision nicht abgeschlossen; die "
        "Kalkulation geht von der Zulässigkeit sichtbarer Deckenuntersichten in den "
        "Wohnungen aus."
    )
    doc.clause("10.2", "Löschwasser und Zugänglichkeit")
    doc.p(
        "Die Löschwasserversorgung erfolgt über das öffentliche Netz. Feuerwehr"
        "aufstellflächen liegen an der Nordkante und am südlichen Grünzug. Der Innenhof "
        "ist nicht befahrbar; die Anleiterbarkeit der Hoffassaden ist nicht erforderlich, "
        "weil jede Nutzungseinheit über zwei unabhängige Rettungswege verfügt."
    )

    doc.page()
    doc.h2("11   Schall- und Erschütterungsschutz")
    doc.mark("A05", "Schallschutzanforderungen je Bauteil",
             "Acoustic requirements per building element")
    doc.table(
        ["Bauteil", "Anforderung", "Nachweis"],
        [
            ["Wohnungstrenndecke", f"R'w 57{NB}dB, L'nw 46{NB}dB",
             "erhöhter Schallschutz, Verbunddecke mit Estrich"],
            ["Wohnungstrennwand", f"R'w 57{NB}dB",
             "Brettsperrholz mit zweischaliger Vorsatzschale"],
            ["Decke Gewerbe zu Wohnen", f"R'w 62{NB}dB, L'nw 43{NB}dB",
             "Trenndecke Stadthaus, erhöhte Anforderung"],
            ["Treppenraumwand", f"R'w 57{NB}dB", "Stahlbetonkern"],
            ["Außenbauteil Nordfassade", f"Rw 42{NB}dB",
             "Schallschutzverglasung mit Schalldämmlüfter"],
            ["Außenbauteil übrige", f"Rw 35{NB}dB", "Standardverglasung"],
        ],
        [40.0, 44.0, 64.0],
        ["L", "L", "L"],
    )
    doc.clause("11.1", "Erhöhter Schallschutz im Wohnungsbau")
    doc.p(
        "Der Auftraggeber verlangt für die Wohnungstrennbauteile den erhöhten "
        "Schallschutz. Die Anforderung ist im Holzbau maßgebend für den Deckenaufbau: die "
        "Ortbetonschicht der Verbunddecke und der schwimmende Estrich sind für die "
        "Trittschalldämmung erforderlich und können nicht entfallen."
    )
    doc.clause("11.2", "Trennung zur Gewerbenutzung")
    doc.p(
        "Die Decke über dem Erdgeschoss des Stadthauses trennt Gewerbe- von Wohnnutzung. "
        "Sie erhält die höchste Anforderung des Projekts. Haustechnische Anlagen der "
        "Gewerbeeinheiten werden körperschallentkoppelt aufgestellt; die Lüftungsanlage "
        "der Gewerbeeinheiten steht im Untergeschoss und nicht im Erdgeschoss."
    )
    doc.clause("11.3", "Erschütterungen aus der Bahntrasse")
    doc.p(
        "Die Nordkante liegt an der Bahntrasse. Nach der Vormessung des Auftraggebers "
        "sind sekundäre Luftschall- und Erschütterungsimmissionen zu erwarten, die "
        "unterhalb der Anhaltswerte liegen. Eine elastische Gebäudelagerung ist nicht "
        "vorgesehen. Eine Nachmessung nach Fertigstellung ist vereinbart."
    )
    doc.clause("11.4", "Baulärm")
    doc.p(
        "Die Bestandsbebauung im Westen bleibt bewohnt. Erschütterungsintensive Verfahren "
        "sind ausgeschlossen; die Baustellenlogistik ist so organisiert, dass die "
        "Anlieferung ausschließlich über die Nordkante erfolgt."
    )

    doc.page()
    doc.h2("12   Ausbaustandard")
    doc.mark("A06", "Ausbaustandard nach Nutzungsart",
             "Fit-out standard by type of use")
    doc.table(
        ["Bauteil", "Wohnen", "Büro", "Gewerbe Erdgeschoss"],
        [
            ["Bodenbelag", "Parkett Eiche, Fliesen im Bad", "Teppichfliese, Kautschuk",
             "Estrich ohne Belag"],
            ["Wandoberfläche", "Q3 gestrichen", "Q3 gestrichen", "Q2 gespachtelt"],
            ["Deckenuntersicht", "Sichtholz, unbehandelt", "abgehängt, Akustik",
             "Rohdecke sichtbar"],
            ["Sanitärobjekte", "vollständig", "vollständig", "Sanitärkern vollständig"],
            ["Küche", "Anschlüsse vorbereitet", "Teeküche je Geschoss", "Anschluss vorbereitet"],
            ["Elektro", "Wohnungsverteiler, Auslässe komplett",
             "Bodentank, Unterverteilung je Geschoss", "Unterverteilung je Einheit"],
            ["Lüftung", "dezentral je Wohnung", "zentral je Geschoss",
             "Anschlusspunkt je Einheit"],
        ],
        [28.0, 40.0, 40.0, 40.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("12.1", "Übergabestandard der Gewerbeeinheiten")
    doc.p(
        "Die Gewerbeeinheiten im Erdgeschoss des Stadthauses werden als Rohbau mit "
        "Basisausbau übergeben. Der mieterspezifische Ausbau ist ausdrücklich nicht Teil "
        "der Leistung. Diese Abgrenzung folgt der fünften Priorität des Auftraggebers und "
        "ist bei der Bewertung der Gewerbefläche zu berücksichtigen."
    )
    doc.clause("12.2", "Barrierefreiheit")
    doc.p(
        "Zwei Wohnungen im Erdgeschoss des Hofhauses sind barrierefrei nutzbar. Alle "
        "Gewerbeeinheiten sind barrierefrei erreichbar. Die Bürogeschosse sind über die "
        "Aufzüge stufenlos erreichbar; Sanitärräume für Menschen mit Behinderung sind je "
        "Geschoss vorgesehen."
    )
    doc.clause("12.3", "Oberflächen und Materialwahl")
    doc.p(
        "Für alle Innenraumoberflächen gilt eine Positivliste emissionsarmer Materialien. "
        "Lösemittelhaltige Kleber und Beschichtungen sind ausgeschlossen. Die Vorgabe "
        "folgt aus der angestrebten Zertifizierung und ist nachträglich nicht heilbar; sie "
        "ist deshalb in jede Leistungsbeschreibung des Ausbaus aufzunehmen."
    )
    doc.clause("12.4", "Schnittstelle zum Mieterausbau")
    doc.p(
        "Der Übergang zwischen Grundausbau und Mieterausbau ist je Gewerbeeinheit an "
        "einem definierten Punkt festgelegt: Bodenaufbau bis Estrich, Wände bis "
        "Spachtelung, Sanitärkern vollständig, Elektro bis Unterverteilung, Lüftung bis "
        "Anschlusspunkt mit Volumenstromregler. Leistungen jenseits dieses Punktes sind "
        "nicht enthalten und auch nicht vorgehalten."
    )

    doc.page()
    doc.h2("13   Baustelleneinrichtung und Qualitätssicherung")
    doc.clause("13.1", "Baustelleneinrichtung")
    doc.p(
        "Die Baustelleneinrichtung liegt vollständig im Baufeld. Ein Turmdrehkran an der "
        "Nordkante bedient das Kontorhaus und das Hofhaus, ein Mobilkran wird für die "
        "Montage der Holzelemente des Stadthauses eingesetzt. Die Vormontagefläche im "
        "südlichen Baufeld steht nur bis zum Baubeginn des Stadthauses zur Verfügung."
    )
    doc.clause("13.2", "Reihenfolge der Häuser")
    doc.p(
        "Die Reihenfolge folgt der Verfügbarkeit der Vormontagefläche und dem "
        "Terminrahmen: das Hofhaus beginnt zuerst, weil sein vollflächiges Untergeschoss "
        "die Baugrube eröffnet; Kontorhaus und Stadthaus folgen zeitgleich zwei Wochen "
        "später. Das Stadthaus hat die längste Ausführungsdauer und endet zuletzt. Die "
        "genaue Staffelung ist im Terminrahmen geführt."
    )
    doc.clause("13.3", "Qualitätssicherung")
    doc.bullets(
        [
            "Aufmaß der Stahlbetonkerne vor Montage der Holzelemente, dokumentiert",
            "Feuchtemessung der Holzbauteile vor dem Schließen der Konstruktion",
            "Luftdichtheitsmessung je Gebäude vor Fertigstellung des Ausbaus",
            "Erstprüfung der Abschottungen in den Installationsschächten",
            "Nachmessung der Erschütterungsimmissionen nach Fertigstellung",
        ]
    )
    doc.clause("13.4", "Mitgeltende Unterlagen")
    doc.table(
        ["Plan-Nr.", "Unterlage", "Revision"],
        [
            [spec["planNumber"], spec["title"], spec["revision"]]
            for spec in DOC_SPECS
            if spec["id"] in ("LEI-DOC-03", "LEI-DOC-04", "LEI-DOC-05", "LEI-DOC-06",
                              "LEI-DOC-07", "LEI-DOC-09", "LEI-DOC-12")
        ],
        [26.0, 96.0, 26.0],
        ["L", "L", "L"],
    )
    doc.small(
        "Diese Baubeschreibung führt keine Flächen und keine Mengen. Bei Bedarf ist die "
        "Flächenberechnung Rev C heranzuziehen."
    )


# --------------------------------------------------------------------------
# 09 TGA-Anforderungen (10 Blatt)
# --------------------------------------------------------------------------

CHARGING_POINTS = 12
CHARGING_POWER_KW = 11.0


def build_09(doc: Doc) -> None:
    doc.page()
    cover(
        doc,
        [
            ("Dokument", f"{doc.spec['title']} · {doc.spec['revision']}"),
            ("Plan-Nr.", doc.spec["planNumber"]),
            ("Geltung", "alle drei Gebäude, Anlagen der Kostengruppe 400"),
            ("Wärmeerzeugung", "Fernwärme, kein eigener Erzeuger"),
            ("Normbezug", "GEG, DIN 1946-6, DIN EN 12831, DIN 18015, VDI 6023"),
        ],
    )
    doc.clause("1", "Zweck und Geltung")
    doc.p(
        "Dieses Dokument beschreibt die Anforderungen an die technische "
        "Gebäudeausrüstung. Es ist die Quelle für die Anlagenentscheidungen der "
        "Kostengruppe 400 und für die Leistungsbeschreibung der TGA-Vergabe. Jede "
        "Anforderung ist einem Abschnitt zugeordnet, damit eine Entscheidung auf die "
        "Anforderung verweisen kann, aus der sie folgt."
    )
    doc.clause("2", "Revisionsverzeichnis")
    doc.table(
        ["Revision", "Datum", "Änderung", "Status"],
        [
            ["Rev A", "12.06.2026", "Erstfassung Energiekonzept", "überholt"],
            ["Rev B", "21.07.2026", "Lüftung und Sanitär ergänzt", "überholt"],
            [
                "Rev C",
                dmy(doc.spec["issuedAt"]),
                "Ladeinfrastruktur, Messkonzept und Schnittstellen ergänzt",
                "gültig",
            ],
        ],
        [22.0, 22.0, 84.0, 20.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("3", "Gliederung und Abgrenzung")
    doc.table(
        ["Blatt", "Abschnitt", "Kostengruppe"],
        [
            ["2", "4   Wärmeversorgung und Hausanschluss Fernwärme", "KG 410 / KG 420"],
            ["3", "5   Wärmeverteilung und Übergabestationen", "KG 420"],
            ["4", "6   Lüftung Wohnnutzung", "KG 430"],
            ["5", "7   Lüftung Gewerbenutzung Erdgeschoss", "KG 430"],
            ["6", "8   Sanitärtechnik", "KG 410"],
            ["7", "9   Elektrotechnik und Ladeinfrastruktur", "KG 440 / KG 450"],
            ["8", "10   Verantwortung für die Hausanschlüsse", "KG 410 bis KG 460"],
            ["9", "11   Messkonzept und Gebäudeautomation", "KG 480"],
            ["10", "12   Telekommunikation und offene Punkte", "KG 450"],
        ],
        [14.0, 96.0, 38.0],
        ["L", "L", "L"],
    )
    doc.small(
        "Nicht Bestandteil dieses Dokuments: Aufzugsanlagen (KG 460 wird nur bei den "
        "Hausanschlüssen berührt), Küchentechnik der Gewerbeeinheiten und "
        "mieterspezifische Anlagen."
    )

    doc.page()
    doc.h2("4   Wärmeversorgung und Hausanschluss Fernwärme")
    doc.mark("A01", "Fernwärme-Hausanschluss und Übergabegrenze",
             "District heating connection and handover boundary")
    doc.p(
        "Die Wärmeversorgung aller drei Gebäude erfolgt über Fernwärme. Ein eigener "
        "Wärmeerzeuger ist nicht vorgesehen; Gaskessel, Wärmepumpe und "
        "Blockheizkraftwerk sind ausdrücklich ausgeschlossen. Der Anschluss wird über eine "
        "gemeinsame Hausanschlussleitung in das Untergeschoss des Hofhauses geführt."
    )
    doc.h2("Übergabegrenze")
    doc.p(
        "Die Übergabegrenze liegt an den Anschlussflanschen der Hausanschlussstation im "
        "Hausanschlussraum Fernwärme des Hofhauses. Alles vor der Übergabegrenze "
        "einschließlich Hausanschlussleitung, Absperrarmaturen und Wärmemengenzähler des "
        "Versorgers ist Leistung des Netzbetreibers und nicht Bestandteil dieser Vergabe. "
        "Alles nach der Übergabegrenze ist Leistung der TGA-Vergabe."
    )
    doc.table(
        ["Position", "vor der Übergabegrenze", "nach der Übergabegrenze"],
        [
            ["Hausanschlussleitung", "Netzbetreiber", "entfällt"],
            ["Absperrarmaturen Hausanschluss", "Netzbetreiber", "entfällt"],
            ["Wärmemengenzähler des Versorgers", "Netzbetreiber", "entfällt"],
            ["Hausanschlussstation, Sekundärseite", "entfällt", "TGA-Vergabe"],
            ["Verteilung in die drei Gebäude", "entfällt", "TGA-Vergabe"],
            ["Unterzähler je Nutzungseinheit", "entfällt", "TGA-Vergabe"],
        ],
        [56.0, 46.0, 46.0],
        ["L", "L", "L"],
    )
    doc.clause("4.1", "Anschlussleistung")
    doc.p(
        "Die Anschlussleistung wird nach DIN EN 12831 gebäudeweise ermittelt und im "
        "Rahmen des Anschlussantrags mit dem Netzbetreiber abgestimmt. Der Antrag ist "
        "Aufgabe des Auftraggebers; die Bemessungsgrundlage liefert die TGA-Planung."
    )
    doc.clause("4.2", "Verfügbarkeit des Anschlusses")
    doc.p(
        "Die Verfügbarkeit der Fernwärme am Baufeld ist durch eine Auskunft des "
        "Netzbetreibers bestätigt. Der Anschlusstermin ist mit dem Terminrahmen "
        "abzustimmen; er liegt auf dem kritischen Weg der Inbetriebnahme."
    )

    doc.page()
    doc.h2("5   Wärmeverteilung und Übergabestationen")
    doc.mark("A02", "Wärmeverteilung und Übergabestationen je Einheit",
             "Heat distribution and per-unit transfer stations")
    doc.p(
        "Von der Hausanschlussstation im Hofhaus wird die Wärme über eine erdverlegte "
        "Nahleitung in das Stadthaus und über eine Trasse im Erdgeschoss in das Kontorhaus "
        "verteilt. Jedes Gebäude erhält eine eigene Verteilstation mit Absperrung, "
        "Regelung und Wärmemengenzähler."
    )
    doc.table(
        ["Gebäude", "Anschluss", "Übergabe an die Einheit", "Anzahl Stationen"],
        [
            [A["name"], "Trasse Erdgeschoss", "Geschossverteilung, Heizkreise",
             cnt(6, "Stück")],
            [B["name"], "Hausanschlussstation direkt",
             "Wohnungsstation je Wohnung",
             cnt(int(m(B, "units")), "Stück")],
            [C["name"], "erdverlegte Nahleitung",
             "Wohnungsstation je Wohnung, Station je Gewerbeeinheit",
             cnt(int(m(C, "units")) + 3, "Stück")],
        ],
        [26.0, 34.0, 60.0, 28.0],
        ["L", "L", "L", "R"],
    )
    doc.clause("5.1", "Wohnungsstationen")
    doc.p(
        "Die Wohnungen erhalten Wohnungsstationen mit Trinkwassererwärmung im "
        "Durchflussprinzip. Damit entfallen Trinkwasserspeicher in den Wohnungen und die "
        "Zirkulationsleitung endet an der Station. Die Lösung folgt aus der Anforderung "
        "an die Trinkwasserhygiene nach VDI 6023."
    )
    doc.clause("5.2", "Wärmeübergabe im Kontorhaus")
    doc.p(
        "Im Kontorhaus wird die Wärme geschossweise verteilt. Die Beheizung erfolgt über "
        "Heizkörper an der Fassade, die Bürogeschosse erhalten keine Fußbodenheizung. "
        "Die Lüftungsanlage übernimmt keine Heizlast."
    )
    doc.clause("5.3", "Wärmeübergabe im Wohnungsbau")
    doc.p(
        "Die Wohnungen erhalten Fußbodenheizung als Flächenheizung mit "
        "Einzelraumregelung. Die niedrige Systemtemperatur ist Voraussetzung für die "
        "Anforderung an den Primärenergiebedarf und ist mit dem Deckenaufbau abgestimmt."
    )
    doc.clause("5.4", "Trassen und Durchdringungen")
    doc.p(
        "Die Nahleitung zwischen Hofhaus und Stadthaus verläuft im nicht unterbauten "
        "südlichen Feld und durchdringt die Setzungsfuge. Die Durchdringung erhält einen "
        "Dehnungsausgleich; die Ausführung ist mit der Tragwerksplanung abgestimmt."
    )

    doc.page()
    doc.h2("6   Lüftung Wohnnutzung")
    doc.p(
        "Die Wohnungen erhalten eine dezentrale Wohnungslüftung mit Wärmerückgewinnung. "
        "Je Wohnung wird ein Lüftungsgerät in der Abstellnische oder im Bad installiert, "
        "die Luftführung erfolgt im Bodenaufbau und in der Trennwand, nicht in der "
        "sichtbaren Holzdecke."
    )
    doc.table(
        ["Kenngröße", "Anforderung", "Bemerkung"],
        [
            ["Lüftungskonzept", "nach DIN 1946-6", "Nachweis je Wohnung"],
            ["System", "dezentral je Wohnung, mit Wärmerückgewinnung",
             "kein zentrales Gerät je Gebäude"],
            ["Wärmerückgewinnungsgrad", f"mindestens 80{NB}%", "Prüfwert des Gerätes"],
            ["Luftführung", "Bodenaufbau und Trennwand",
             "Sichtholzdecke bleibt durchdringungsfrei"],
            ["Außenluftdurchlass", "Fassade, schallgedämmt",
             "Nordfassade mit erhöhter Anforderung"],
            ["Wartung", "Filterwechsel aus der Wohnung",
             "kein Zugang über Gemeinschaftsflächen erforderlich"],
        ],
        [40.0, 56.0, 52.0],
        ["L", "L", "L"],
    )
    doc.clause("6.1", "Zusammenhang mit dem Sichtholz")
    doc.p(
        "Die Anforderung an die sichtbare Holzuntersicht in den Wohnungen schließt "
        "Lüftungsleitungen in der Decke aus. Deshalb ist die dezentrale Lösung gewählt "
        "worden: ein zentrales System hätte horizontale Verteilleitungen in der "
        "Deckenebene erfordert."
    )
    doc.clause("6.2", "Tiefgaragenlüftung")
    doc.p(
        "Die Stellplatzanlagen im Hofhaus und im Stadthaus erhalten eine maschinelle "
        "Entlüftung mit Kohlenmonoxidüberwachung. Die Anlage steht in der Technikzentrale "
        "des Untergeschosses; die Ausblasöffnung liegt an der Nordkante."
    )
    doc.clause("6.3", "Entlüftung der Nebenräume")
    doc.p(
        "Abstellräume, Müllraum und Fahrradräume werden über Außenwandöffnungen "
        "belüftet. Die Waschküche des Hofhauses erhält eine maschinelle Entlüftung mit "
        "Feuchteschaltung."
    )

    doc.page()
    doc.h2("7   Lüftung Gewerbenutzung Erdgeschoss")
    doc.mark("A03", "Lüftungsanforderung Gewerbe im Erdgeschoss",
             "Ventilation requirement for the commercial ground floor")
    doc.p(
        f"Die Gewerbeeinheiten im Erdgeschoss des Stadthauses mit zusammen "
        f"{sqm(m(C, 'commercialNuf'))} Nutzungsfläche erhalten eine zentrale "
        "Lüftungsanlage mit Wärmerückgewinnung. Eine dezentrale Lösung ist hier "
        "ausdrücklich nicht zugelassen: die Einheiten sollen zusammenschaltbar bleiben und "
        "eine gastronomische Nutzung ist nicht ausgeschlossen."
    )
    doc.table(
        ["Kenngröße", "Anforderung", "Bemerkung"],
        [
            ["System", "zentrale Anlage mit Wärmerückgewinnung",
             "ein Gerät für alle drei Einheiten"],
            ["Aufstellort", "Technikfläche im Teil-Untergeschoss",
             "körperschallentkoppelt aufgestellt"],
            ["Auslegung", f"{de(30, 0)}{NB}m³/(h·m²) auf die Nutzungsfläche",
             "erhöhter Ansatz wegen möglicher Gastronomie"],
            ["Abluftführung", "Schacht bis über Dach", "getrennt von der Wohnnutzung"],
            ["Übergabe je Einheit", "Anschlusspunkt mit Absperrung und Volumenstromregler",
             "mieterspezifische Verteilung nicht enthalten"],
            ["Brandschutz", "Absperrvorrichtungen an den Brandabschnittsgrenzen",
             "Decke zu Wohnen ist Brandabschnittsgrenze"],
        ],
        [34.0, 60.0, 54.0],
        ["L", "L", "L"],
    )
    doc.clause("7.1", "Grund der zentralen Lösung")
    doc.p(
        "Der Auftraggeber verlangt, dass die Gewerbeeinheiten zu zwei Einheiten "
        "zusammengeschaltet werden können. Eine dezentrale Lösung je Einheit wäre bei "
        "Zusammenschaltung umzubauen. Zusätzlich verlangt eine mögliche gastronomische "
        "Nutzung eine Abluftführung über Dach, die nur zentral wirtschaftlich ist."
    )
    doc.clause("7.2", "Abgrenzung zur Mieterleistung")
    doc.p(
        "Die Anlage wird bis zum Anschlusspunkt je Einheit ausgeführt. Die Verteilung "
        "innerhalb der Einheit, Küchenabluft und Kälteerzeugung für den Mieter sind nicht "
        "Bestandteil der Leistung. Diese Abgrenzung ist mit dem Übergabestandard der "
        "Gewerbeeinheiten in der Baubeschreibung abgestimmt."
    )
    doc.clause("7.3", "Kälte")
    doc.p(
        "Eine Kälteerzeugung ist im Grundausbau nicht vorgesehen. Für eine spätere "
        "Nachrüstung werden Stellflächen im Teil-Untergeschoss und Trassen bis in das "
        "Erdgeschoss freigehalten."
    )

    doc.page()
    doc.h2("8   Sanitärtechnik")
    doc.mark("A04", "Trinkwasser, Abwasser und Trinkwasserhygiene",
             "Domestic water, drainage and water hygiene")
    doc.p(
        "Die Trinkwasserversorgung erfolgt über je einen Hausanschluss pro Gebäude. Die "
        "Trinkwassererwärmung liegt in den Wohnungsstationen beziehungsweise in den "
        "Übergabestationen der Gewerbeeinheiten; zentrale Speicher sind nicht vorgesehen."
    )
    doc.table(
        ["Gebäude", "Hausanschluss Wasser", "Erwärmung", "Besonderheit"],
        [
            [A["name"], "Erdgeschoss, Nordkante", "zentral je Geschoss",
             "Hebeanlage, kein Untergeschoss"],
            [B["name"], "Untergeschoss, Hausanschlussraum",
             "Wohnungsstation je Wohnung", "Druckerhöhung erforderlich"],
            [C["name"], "Teil-Untergeschoss, Hausanschlussraum",
             "Wohnungsstation, Gewerbestation",
             "getrennte Zählung Wohnen und Gewerbe"],
        ],
        [26.0, 44.0, 40.0, 38.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("8.1", "Trinkwasserhygiene")
    doc.p(
        "Die Anforderungen nach VDI 6023 werden durch das Durchflussprinzip und durch die "
        "Vermeidung von Stagnationsstrecken erfüllt. Die Leitungen werden erst kurz vor "
        "der Übergabe befüllt; die Spülprotokolle sind Teil der Dokumentation."
    )
    doc.clause("8.2", "Abwasser")
    doc.p(
        "Schmutzwasser und Regenwasser werden getrennt geführt. Die Regenwasserableitung "
        "erfolgt gedrosselt über den Retentionsaufbau der Dächer. Die "
        "Stellplatzentwässerung wird über einen Abscheider geführt. Die Anschlusspunkte "
        "an das öffentliche Netz sind in den Schnittstellen geführt."
    )
    doc.clause("8.3", "Löschwasser")
    doc.p(
        "Die Löschwasserversorgung erfolgt über Hydranten im öffentlichen Netz. "
        "Wandhydranten sind in den Treppenräumen der drei Gebäude vorgesehen. Eine "
        "Löschwasseranlage mit Vorlagebehälter ist nicht erforderlich."
    )
    doc.clause("8.4", "Sanitärobjekte und Mengen")
    doc.p(
        f"Die Mengen der Sanitärobjekte folgen den Nutzungsmengen: "
        f"{cnt(SUM_UNITS, 'Wohneinheiten')} mit je einem Bad und, ab drei Zimmern, einem "
        f"zusätzlichen Gäste-WC; {cnt(int(m(A, 'workplaces')), 'Arbeitsplätze')} im "
        "Kontorhaus mit geschossweisen Sanitärräumen; je Gewerbeeinheit ein Sanitärkern. "
        "Eine Änderung der Wohnungs- oder Arbeitsplatzanzahl wirkt unmittelbar auf diese "
        "Mengen."
    )
    doc.clause("8.5", "Dämmung und Schallschutz der Leitungen")
    doc.p(
        "Abwasserleitungen in Wohnungstrennwänden und in Schächten neben Wohnräumen "
        "werden körperschallentkoppelt befestigt und schallgedämmt. Die Anforderung folgt "
        "aus dem erhöhten Schallschutz und ist bei der Schachtbemessung berücksichtigt."
    )

    doc.page()
    doc.h2("9   Elektrotechnik und Ladeinfrastruktur")
    doc.p(
        "Jedes Gebäude erhält einen eigenen Stromhausanschluss mit Zählerplatz. Die "
        "Zählung ist für Wohnnutzung, Gewerbenutzung und Allgemeinstrom getrennt. Die "
        "Elektroinstallation folgt DIN 18015; die Ausstattung der Wohnungen entspricht "
        "der Ausstattungsstufe 2."
    )
    doc.mark("A05", "Ladeinfrastruktur: Anzahl und Mengenautorität",
             "Charging infrastructure: quantity and quantity authority")
    doc.h2("Ladeinfrastruktur")
    doc.table(
        ["Anforderung", "Wert", "Autorität der Menge"],
        [
            ["Ladepunkte, betriebsfertig",
             cnt(CHARGING_POINTS, "Stück"),
             "Auftraggeber, Vorgabe aus dem Auftraggeberbrief"],
            ["Ladeleistung je Punkt", f"{de(CHARGING_POWER_KW, 0)}{NB}kW, Wechselstrom",
             "Auftraggeber"],
            ["Verteilung auf die Gebäude",
             f"{cnt(8, 'Stück')} Hofhaus, {cnt(4, 'Stück')} Stadthaus",
             "TGA-Planung, abgeleitet aus der Stellplatzverteilung"],
            ["Leerrohrvorbereitung",
             f"alle {cnt(SUM_PARKING, 'Stellplätze')} des Quartiers",
             "Auftraggeber, Vorgabe zur Nachrüstbarkeit"],
            ["Lastmanagement", "erforderlich, dynamisch",
             "TGA-Planung, aus der Anschlussleistung"],
            ["Abrechnung", "je Ladepunkt, eichrechtskonform",
             "Auftraggeber"],
        ],
        [40.0, 50.0, 58.0],
        ["L", "L", "L"],
    )
    doc.clause("9.1", "Warum die Anzahl nicht abgeleitet wird")
    doc.p(
        f"Die Anzahl von {cnt(CHARGING_POINTS, 'Ladepunkten')} ist eine Vorgabe des "
        f"Auftraggebers und wird ausdrücklich nicht aus der Stellplatzanzahl von "
        f"{cnt(SUM_PARKING, 'Stellplätzen')} abgeleitet. Eine Änderung der "
        "Stellplatzanzahl ändert die Anzahl der Ladepunkte nicht; eine Änderung der "
        "Vorgabe des Auftraggebers ändert sie. Die Leerrohrvorbereitung dagegen folgt der "
        "Stellplatzanzahl, weil sie die Nachrüstbarkeit aller Plätze sichern soll."
    )
    doc.clause("9.2", "Photovoltaik und Eigenverbrauch")
    doc.p(
        "Die Photovoltaikanlage auf dem Kontorhaus wird auf den Allgemeinstrom des "
        "Kontorhauses geführt. Eine Einbindung in die Ladeinfrastruktur der Wohnhäuser "
        "ist nicht vorgesehen, weil die Gebäude getrennte Hausanschlüsse haben."
    )
    doc.clause("9.3", "Allgemeine Elektroinstallation")
    doc.p(
        "Die Wohnungen erhalten je einen Wohnungsverteiler mit Reserveplätzen, "
        "Auslässe nach der Ausstattungsstufe 2 und eine Vorbereitung für eine "
        "Wohnungsstation der Gebäudekommunikation. Die Bürogeschosse erhalten je "
        "Geschoss eine Unterverteilung und eine Bodentankinstallation im Raster der "
        "Systemtrennwände."
    )

    doc.page()
    doc.h2("10   Verantwortung für die Hausanschlüsse")
    doc.mark("A06", "Verantwortung und Beantragung der Hausanschlüsse",
             "Responsibility and application for house connections")
    doc.p(
        "Die Hausanschlüsse aller Medien werden vom Auftraggeber beantragt und von den "
        "Netzbetreibern hergestellt. Die TGA-Vergabe stellt die Hausanschlussräume, die "
        "Durchführungen und die Anlagen hinter der Übergabegrenze bereit."
    )
    doc.table(
        ["Medium", "Beantragung", "Herstellung", "ab Übergabegrenze"],
        [
            ["Fernwärme", "Auftraggeber", "Netzbetreiber", "TGA-Vergabe"],
            ["Strom", "Auftraggeber", "Netzbetreiber", "TGA-Vergabe"],
            ["Trinkwasser", "Auftraggeber", "Versorger", "TGA-Vergabe"],
            ["Abwasser", "Auftraggeber", "Entsorgungsträger", "TGA-Vergabe"],
            ["Telekommunikation", "offen, siehe Abschnitt 12", "offen",
             "Leerrohr durch TGA-Vergabe"],
        ],
        [34.0, 34.0, 40.0, 40.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("10.1", "Bauseitige Vorleistungen")
    doc.bullets(
        [
            "Hausanschlussräume mit Mindestmaßen, direkt von außen zugänglich, "
            "abschließbar",
            "Mauer- und Wanddurchführungen dicht gegen von außen drückendes Wasser",
            "Erdarbeiten und Leerrohre auf dem Grundstück bis zur Grundstücksgrenze",
            "Potentialausgleich und Erdung im Hausanschlussraum",
        ]
    )
    doc.clause("10.2", "Terminliche Bindung")
    doc.p(
        "Die Anschlusstermine der Netzbetreiber liegen auf dem kritischen Weg der "
        "Inbetriebnahme. Eine Verzögerung der Beantragung durch den Auftraggeber wirkt "
        "unmittelbar auf den Fertigstellungstermin. Die Abhängigkeit ist im Terminrahmen "
        "genannt."
    )
    doc.clause("10.3", "Provisorien in der Bauzeit")
    doc.p(
        "Baustrom und Bauwasser werden über gesonderte Anschlüsse bereitgestellt. Eine "
        "Nutzung der endgültigen Hausanschlüsse für die Bauzeit ist nicht vorgesehen."
    )
    doc.clause("10.4", "Anforderungen an die Hausanschlussräume")
    doc.table(
        ["Raum", "Gebäude", "Lage", "Anforderung"],
        [
            ["Fernwärme", B["name"], "Untergeschoss, vom Hof zugänglich",
             "gemeinsame Station für das Quartier"],
            ["Strom", "alle drei", "je Gebäude, siehe Blatt 4 der Schnittstellen",
             "getrennte Zählerplätze je Nutzungsart"],
            ["Wasser", "alle drei", "je Gebäude", "Druckerhöhung im Hofhaus"],
            ["Telekommunikation", "alle drei", "je Gebäude",
             "Umfang offen, siehe Abschnitt 12"],
        ],
        [30.0, 26.0, 50.0, 42.0],
        ["L", "L", "L", "L"],
    )

    doc.page()
    doc.h2("11   Messkonzept und Gebäudeautomation")
    doc.mark("A07", "Messkonzept, Zählung und Gebäudeautomation",
             "Metering concept and building automation")
    doc.p(
        "Das Messkonzept trennt Wohnnutzung, Gewerbenutzung und Allgemeinstrom "
        "vollständig. Jede Nutzungseinheit erhält eigene Zähler für Wärme, Trinkwasser "
        "und Strom. Die Zähler sind fernauslesbar."
    )
    doc.table(
        ["Medium", "Zählung", "Auslesung", "Zweck"],
        [
            ["Wärme", "je Nutzungseinheit und je Gebäude", "fernauslesbar, bussystembasiert",
             "Betriebskostenabrechnung"],
            ["Trinkwasser", "je Nutzungseinheit, kalt und warm", "fernauslesbar",
             "Betriebskostenabrechnung"],
            ["Strom Wohnen", "je Wohnung", "Messstellenbetreiber", "Endkundenabrechnung"],
            ["Strom Gewerbe", "je Gewerbeeinheit", "Messstellenbetreiber",
             "Endkundenabrechnung"],
            ["Allgemeinstrom", "je Gebäude", "Messstellenbetreiber",
             "Betriebskostenabrechnung"],
            ["Ladepunkte", "je Ladepunkt, eichrechtskonform", "Backend des Betreibers",
             "Abrechnung Ladestrom"],
        ],
        [30.0, 44.0, 42.0, 32.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("11.1", "Gebäudeautomation")
    doc.p(
        "Eine Gebäudeautomation wird für das Kontorhaus und für die technischen Anlagen "
        "der Untergeschosse vorgesehen: Regelung der Lüftungsanlagen, Ansteuerung des "
        "Sonnenschutzes, Überwachung der Tiefgaragenentlüftung und der Pumpstationen, "
        "Störmeldung auf eine gemeinsame Aufschaltung. Die Wohnungen erhalten keine "
        "Gebäudeautomation; die Einzelraumregelung ist autark."
    )
    doc.clause("11.2", "Anforderung an die Schnittstelle")
    doc.p(
        "Die Gebäudeautomation ist mit einem offenen, herstellerneutralen Bussystem "
        "auszuführen. Eine herstellergebundene Lösung ist nicht zugelassen, weil der "
        "Auftraggeber die Betriebsführung ausschreiben will."
    )
    doc.clause("11.3", "Übergabe der Daten")
    doc.p(
        "Zählerstände und Störmeldungen sind an einer Stelle je Gebäude zusammenzuführen "
        "und an den Betreiber zu übergeben. Die Datenanbindung setzt die "
        "Telekommunikationsanbindung voraus, die zum Ausgabedatum dieser Revision nicht "
        "geklärt ist."
    )

    doc.page()
    doc.h2("12   Telekommunikation und offene Punkte")
    doc.mark("A08", "Telekommunikationsschnittstelle ist offen",
             "Telecommunications interface remains open")
    doc.p(
        "Die Telekommunikationsanbindung des Quartiers ist zum Ausgabedatum dieser "
        "Revision OFFEN. Es liegt keine entschiedene Vorgabe vor, und die vorhandenen "
        "Angaben widersprechen sich: der Auftraggeberbrief nennt eine Anbindung durch den "
        "Auftraggeber, die Auskunft des Netzbetreibers setzt eine bauseitige "
        "Leerrohrtrasse und einen Übergabepunkt je Gebäude voraus, und für die "
        "Datenanbindung der Gebäudeautomation ist keine Verantwortung benannt."
    )
    doc.table(
        ["Frage", "Sachstand", "Wirkung, wenn nicht entschieden"],
        [
            ["Wer beantragt den Anschluss?", "offen, widersprüchlich",
             "kein Anschlusstermin, Risiko für die Inbetriebnahme"],
            ["Ein Übergabepunkt oder drei?", "offen",
             "Leerrohrtrasse und Hausanschlussräume nicht endgültig bemessen"],
            ["Aktive Technik bauseits?", "offen",
             "Technikfläche und Stromversorgung nicht gesichert"],
            ["Datenanbindung Gebäudeautomation", "offen",
             "Fernauslesung der Zähler nicht möglich"],
        ],
        [46.0, 34.0, 68.0],
        ["L", "L", "L"],
    )
    doc.clause("12.1", "Annahme für die Kalkulation")
    doc.p(
        "Bis zur Entscheidung wird angenommen: eine bauseitige Leerrohrtrasse von der "
        "Grundstücksgrenze bis in den Hausanschlussraum je Gebäude, ein Übergabepunkt je "
        "Gebäude, keine aktive Technik im Leistungsumfang. Diese Annahme ist ausdrücklich "
        "keine Entscheidung und ersetzt sie nicht."
    )
    doc.clause("12.2", "Weitere offene Punkte dieses Dokuments")
    doc.bullets(
        [
            "Anschlussleistung Fernwärme: Antrag beim Netzbetreiber noch nicht gestellt.",
            "Kälteerzeugung Gewerbe: nicht im Grundausbau, Nachrüstbarkeit vorgehalten.",
            "Betriebsführung der Gebäudeautomation: Ausschreibung durch den Auftraggeber "
            "geplant, Anforderungen an die Schnittstelle sind gesetzt.",
        ]
    )
    doc.small(
        "Die offene Telekommunikationsschnittstelle ist zusätzlich in den Schnittstellen "
        "und Hausanschlüssen geführt. Beide Dokumente beschreiben denselben offenen Punkt "
        "und widersprechen sich nicht."
    )


# --------------------------------------------------------------------------
# 10 Schnittstellen und Hausanschlüsse (5 Blatt)
# --------------------------------------------------------------------------


def build_10(doc: Doc) -> None:
    doc.page()
    cover(
        doc,
        [
            ("Dokument", f"{doc.spec['title']} · {doc.spec['revision']}"),
            ("Plan-Nr.", doc.spec["planNumber"]),
            ("Geltung", "alle drei Gebäude, alle Medien"),
            ("Bezug", "TGA-Anforderungen Rev C, Lageplan Rev C"),
        ],
    )
    doc.clause("1", "Zweck")
    doc.p(
        "Dieses Dokument legt fest, wer welches Medium beantragt, herstellt und betreibt, "
        "und wo die Übergabepunkte liegen. Es ist die Quelle für die "
        "Verantwortungszuordnung und für die Prüfung, ob eine Leistung im Angebot "
        "enthalten ist oder nicht."
    )
    doc.mark("A01", "Verantwortungsmatrix der Medien",
             "Responsibility matrix for the utilities")
    doc.clause("2", "Verantwortungsmatrix")
    doc.table(
        ["Medium", "Beantragung", "Herstellung bis Übergabe", "Anlage ab Übergabe",
         "Betrieb"],
        [
            ["Fernwärme", "Auftraggeber", "Netzbetreiber", "TGA-Vergabe", "Betreiber"],
            ["Strom", "Auftraggeber", "Netzbetreiber", "TGA-Vergabe",
             "Messstellenbetreiber"],
            ["Trinkwasser", "Auftraggeber", "Versorger", "TGA-Vergabe", "Betreiber"],
            ["Abwasser", "Auftraggeber", "Entsorgungsträger", "TGA-Vergabe", "Betreiber"],
            ["Regenwasser", "Auftraggeber", "Entsorgungsträger",
             "TGA-Vergabe und Freianlagen", "Betreiber"],
            ["Telekommunikation", "offen", "offen", "nur Leerrohr", "offen"],
        ],
        [28.0, 26.0, 34.0, 34.0, 26.0],
        ["L", "L", "L", "L", "L"],
    )
    doc.clause("2.1", "Lesart der Matrix")
    doc.p(
        "Beantragung meint den Antrag beim Netzbetreiber einschließlich der Beibringung "
        "der Bemessungsgrundlagen. Herstellung bis Übergabe meint die Leitung vom Netz "
        "bis zur Übergabegrenze im Hausanschlussraum. Anlage ab Übergabe meint alle "
        "Anlagenteile hinter der Übergabegrenze."
    )
    doc.clause("2.2", "Bauseitige Vorleistungen für alle Medien")
    doc.bullets(
        [
            "Hausanschlussraum je Medium und Gebäude, von außen zugänglich und "
            "abschließbar",
            "dichte Wand- und Bodendurchführungen, geeignet für von außen drückendes "
            "Wasser",
            "Erdarbeiten und Schutzrohre auf dem Grundstück bis zur Grundstücksgrenze",
            "Potentialausgleich, Erdung und Blitzschutzanschluss",
        ]
    )

    doc.page()
    doc.h2("3   Wärme: Übergabepunkt und Trassen")
    doc.mark("A02", "Übergabepunkt Fernwärme im Hofhaus",
             "District heating handover point in the Hofhaus")
    doc.p(
        "Das Quartier erhält einen gemeinsamen Fernwärme-Hausanschluss. Der Übergabepunkt "
        "liegt im Hausanschlussraum Fernwärme im Untergeschoss des Hofhauses, an den "
        "Anschlussflanschen der Hausanschlussstation. Kontorhaus und Stadthaus werden von "
        "dort aus versorgt."
    )
    doc.table(
        ["Gegenstand", "Festlegung"],
        [
            ["Anzahl Hausanschlüsse", cnt(1, "Stück") + " für das gesamte Quartier"],
            ["Ort des Übergabepunktes",
             f"Hausanschlussraum Fernwärme, Untergeschoss {B['name']}"],
            ["Technische Grenze", "Anschlussflansche der Hausanschlussstation"],
            ["Zählung durch den Versorger", "ein Wärmemengenzähler am Übergabepunkt"],
            ["Unterzählung", "je Gebäude und je Nutzungseinheit, Leistung der TGA-Vergabe"],
            ["Trasse zum Stadthaus", "erdverlegte Nahleitung durch das nicht unterbaute Feld"],
            ["Trasse zum Kontorhaus", "Trasse im Erdgeschoss, oberhalb der Bodenplatte"],
        ],
        [56.0, 92.0],
        ["L", "L"],
    )
    doc.clause("3.1", "Folge des gemeinsamen Anschlusses")
    doc.p(
        "Ein gemeinsamer Anschluss verlangt eine Unterzählung je Gebäude, damit die "
        "Betriebskosten gebäudeweise abgerechnet werden können. Die Unterzähler sind "
        "Leistung der TGA-Vergabe und im Messkonzept geführt."
    )
    doc.clause("3.2", "Zugänglichkeit")
    doc.p(
        "Der Hausanschlussraum ist vom Hof direkt zugänglich und wird nicht über die "
        "Stellplatzanlage erschlossen. Diese Anforderung des Netzbetreibers bestimmt die "
        "Lage des Raumes im Untergeschoss."
    )
    doc.clause("3.3", "Risiko des gemeinsamen Anschlusses")
    doc.p(
        "Ein gemeinsamer Anschluss bündelt das Risiko: eine Störung an der "
        "Hausanschlussstation betrifft alle drei Gebäude. Der Auftraggeber hat diese "
        "Lösung wegen der geringeren Anschlusskosten gewählt. Eine Redundanz ist nicht "
        "vorgesehen."
    )
    doc.clause("3.4", "Terminliche Bindung")
    doc.p(
        "Der Anschlusstermin des Netzbetreibers muss vor der Abnahmephase liegen, weil "
        "die Einregulierung der Heizungsanlagen und die Beheizung während des Ausbaus die "
        "Fernwärme voraussetzen. Der Antrag ist Aufgabe des Auftraggebers."
    )

    doc.page()
    doc.h2("4   Strom: Übergabepunkte und Zählerplätze")
    doc.mark("A03", "Übergabepunkte Strom je Gebäude",
             "Electricity handover points per building")
    doc.p(
        "Anders als bei der Fernwärme erhält jedes Gebäude einen eigenen "
        "Stromhausanschluss. Der Übergabepunkt liegt jeweils an den "
        "Hausanschlusskästen im Hausanschlussraum Strom des Gebäudes."
    )
    doc.table(
        ["Gebäude", "Ort des Übergabepunktes", "Zählerplatz", "Getrennte Zählung"],
        [
            [A["name"], "Hausanschlussraum Erdgeschoss, Nordkante", "Erdgeschoss",
             "Allgemeinstrom, Mietflächen"],
            [B["name"], "Hausanschlussraum Untergeschoss", "Untergeschoss",
             "Wohnungen, Allgemeinstrom, Ladepunkte"],
            [C["name"], "Hausanschlussraum Teil-Untergeschoss", "Teil-Untergeschoss",
             "Wohnungen, Gewerbe, Allgemeinstrom, Ladepunkte"],
        ],
        [24.0, 46.0, 26.0, 52.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("4.1", "Anschlussleistung und Lastmanagement")
    doc.p(
        "Die Anschlussleistung der Wohnhäuser wird durch die Ladeinfrastruktur bestimmt. "
        "Ein dynamisches Lastmanagement ist gefordert, damit die Anschlussleistung nicht "
        "auf die Summe der Ladeleistungen bemessen werden muss. Die Anforderung ist in "
        "den TGA-Anforderungen geführt."
    )
    doc.clause("4.2", "Photovoltaik")
    doc.p(
        "Die Photovoltaikanlage auf dem Kontorhaus wird auf den Allgemeinstrom dieses "
        "Gebäudes geführt. Eine gebäudeübergreifende Nutzung ist wegen der getrennten "
        "Hausanschlüsse nicht vorgesehen und würde eine eigene Kundenanlage erfordern."
    )
    doc.clause("4.3", "Blitzschutz und Potentialausgleich")
    doc.p(
        "Jedes Gebäude erhält eine äußere Blitzschutzanlage mit Fundamenterder. Der "
        "Potentialausgleich wird im Hausanschlussraum zusammengeführt. Die Anbindung der "
        "Klinkerschale des Stadthauses an den Potentialausgleich ist gesondert "
        "nachzuweisen."
    )
    doc.clause("4.4", "Zählerplätze und Messstellenbetrieb")
    doc.p(
        "Die Zählerplätze werden nach den technischen Anschlussbedingungen des "
        "Netzbetreibers errichtet und dem Messstellenbetreiber übergeben. Die Zähler selbst "
        "sind nicht Bestandteil der Vergabe. Für die Ladepunkte ist eine "
        "eichrechtskonforme Messung je Ladepunkt gefordert, die vom Betreiber der "
        "Ladeinfrastruktur verantwortet wird."
    )

    doc.page()
    doc.h2("5   Wasser, Abwasser und Löschwasser")
    doc.mark("A04", "Übergabepunkte Wasser und Abwasser",
             "Water and drainage handover points")
    doc.table(
        ["Medium", "Anzahl Anschlüsse", "Übergabepunkt", "Besonderheit"],
        [
            ["Trinkwasser", cnt(3, "Stück"), "Hausanschlussraum Wasser je Gebäude",
             "Druckerhöhung im Hofhaus"],
            ["Schmutzwasser", cnt(3, "Stück"), "Revisionsschacht auf dem Grundstück",
             "Hebeanlage im Kontorhaus"],
            ["Regenwasser", cnt(2, "Stück"), "Drosselschacht auf dem Grundstück",
             "gedrosselte Einleitung, Retention"],
            ["Löschwasser", "über öffentliche Hydranten", "kein eigener Anschluss",
             "Wandhydranten in den Treppenräumen"],
        ],
        [28.0, 32.0, 50.0, 38.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("5.1", "Gedrosselte Einleitung")
    doc.p(
        "Die zulässige Einleitmenge für Regenwasser ist eine Vorgabe des "
        "Entsorgungsträgers. Die Einhaltung erfolgt über den Retentionsaufbau der Dächer "
        "und über Drosselschächte im Freiraum. Die Schnittstelle zwischen Hochbau und "
        "Freianlagen liegt am Anschluss der Dachabläufe an die Grundleitung."
    )
    doc.clause("5.2", "Stellplatzentwässerung")
    doc.p(
        "Die Bodenabläufe der Stellplatzanlagen werden über einen Abscheider in das "
        "Schmutzwassernetz geführt. Die Rampe des Hofhauses erhält eine Pumpstation mit "
        "Rückstauverschluss. Die Wartung des Abscheiders ist Aufgabe des Betreibers."
    )
    doc.clause("5.3", "Schnittstelle zu den Freianlagen")
    doc.p(
        "Die Grundleitungen außerhalb der Gebäudeaußenkante sind Leistung der "
        "Freianlagen. Übergabepunkt ist der erste Revisionsschacht außerhalb der "
        "Gebäudeaußenkante. Die Höhenlage der Anschlusspunkte ist mit der "
        "Freianlagenplanung abzustimmen."
    )
    doc.clause("5.4", "Rückstauebene")
    doc.p(
        "Die Rückstauebene liegt auf der Höhe der Straßenoberkante an der Nordkante. "
        "Alle Entwässerungspunkte unterhalb dieser Ebene, insbesondere die "
        "Stellplatzanlagen und die Rampe, werden über Hebeanlagen mit "
        "Rückstauverschluss entwässert."
    )
    doc.clause("5.5", "Löschwasser im Betrieb")
    doc.p(
        "Die Wandhydranten in den Treppenräumen werden aus dem Trinkwassernetz gespeist "
        "und über eine Sicherungseinrichtung getrennt. Die jährliche Prüfung ist Aufgabe "
        "des Betreibers."
    )

    doc.page()
    doc.h2("6   Telekommunikation: offener Punkt")
    doc.mark("A05", "Konflikt der Telekommunikationsschnittstelle",
             "Conflict in the telecommunications interface")
    doc.p(
        "Die Telekommunikationsschnittstelle ist der einzige offene Punkt dieses "
        "Dokuments und gleichzeitig ein Widerspruch zwischen zwei Quellen. Der Punkt ist "
        "nicht entschieden; er wird hier ausdrücklich als OFFEN geführt und nicht durch "
        "eine Festlegung ersetzt."
    )
    doc.table(
        ["Quelle", "Aussage", "Folge"],
        [
            ["Auftraggeberbrief",
             "Anbindung wird durch den Auftraggeber beauftragt",
             "kein Leistungsanteil, keine bauseitige Technikfläche"],
            ["Auskunft des Netzbetreibers",
             "bauseitige Leerrohrtrasse und Übergabepunkt je Gebäude erforderlich",
             "Leerrohr, Hausanschlussraum und Stromversorgung erforderlich"],
            ["TGA-Anforderungen Rev C",
             "Datenanbindung der Gebäudeautomation erforderlich, Verantwortung nicht "
             "benannt",
             "Fernauslesung der Zähler ohne Anbindung nicht möglich"],
        ],
        [34.0, 62.0, 52.0],
        ["L", "L", "L"],
    )
    doc.clause("6.1", "Was entschieden werden muss")
    doc.numbered(
        "6.1",
        [
            "Wer beantragt den Anschluss beim Netzbetreiber, und bis wann?",
            "Ein gemeinsamer Übergabepunkt für das Quartier oder ein Übergabepunkt je "
            "Gebäude?",
            "Ist aktive Technik im Hausanschlussraum bauseits vorzuhalten, und wer stellt "
            "die Stromversorgung dafür?",
            "Wer verantwortet die Datenanbindung der Gebäudeautomation?",
        ],
    )
    doc.clause("6.2", "Annahme bis zur Entscheidung")
    doc.p(
        "Kalkuliert wird eine bauseitige Leerrohrtrasse von der Grundstücksgrenze bis in "
        "den Hausanschlussraum je Gebäude sowie ein Übergabepunkt je Gebäude, ohne aktive "
        "Technik. Diese Annahme ist identisch mit der Annahme in den TGA-Anforderungen "
        "Rev C; die beiden Dokumente widersprechen sich nicht."
    )
    doc.clause("6.3", "Terminfolge")
    doc.p(
        "Die Anbindung liegt auf dem Weg zur Inbetriebnahme: ohne Datenanbindung ist die "
        "Fernauslesung der Zähler und die Störmeldung der Gebäudeautomation nicht "
        "funktionsfähig. Eine Entscheidung ist vor Beginn der Ausbauphase erforderlich."
    )


# --------------------------------------------------------------------------
# 11 Terminrahmen (4 Blatt)
# --------------------------------------------------------------------------


def build_11(doc: Doc) -> None:
    doc.page()
    cover(
        doc,
        [
            ("Dokument", f"{doc.spec['title']} · {doc.spec['revision']}"),
            ("Plan-Nr.", doc.spec["planNumber"]),
            ("Geltung", "gesamtes Quartier, alle drei Gebäude"),
            ("Grundlage", "Zieltermine des Auftraggebers, Projektbeschreibung Rev B"),
        ],
    )
    doc.mark("A01", "Zieltermin Baubeginn", "Target date for construction start")
    doc.clause("1", "Ecktermine")
    doc.kv(
        [
            ("Baubeginn", dmy_long(START_DATE)),
            ("Gesamtfertigstellung", dmy_long(END_DATE)),
            ("Gesamtdauer", f"{de(TOTAL_MONTHS, 1)}{NB}Monate"),
            ("Übergabeform (Basis)", "eine Übergabe des gesamten Quartiers"),
            ("Rasterung des Rahmens", "Halbmonate, jeweils zum 15. und zum Monatsende"),
        ]
    )
    doc.mark("A02", "Zieltermin Gesamtfertigstellung",
             "Target date for overall completion")
    doc.p(
        f"Der Terminrahmen beginnt am {dmy(START_DATE)} und endet am {dmy(END_DATE)}. Die "
        f"Gesamtdauer beträgt {de(TOTAL_MONTHS, 1)}{NB}Monate. Der Rahmen ist in "
        "Halbmonaten gerastert; jede Phase beginnt und endet zum 15. eines Monats oder "
        "zum Monatsende. Diese Rasterung ist bewusst gewählt, damit Vorläufe und "
        "Überlappungen eindeutig sind."
    )
    doc.clause("1.1", "Voraussetzungen des Baubeginns")
    doc.bullets(
        [
            "Baugenehmigung liegt vor",
            "Baufeldfreimachung durch den Auftraggeber abgeschlossen, Baufeld geräumt und "
            "tragfähig übergeben",
            "Kampfmittelfreigabe erteilt",
            "Vereinigung der Flurstücke vollzogen oder Baubeginn davon unabhängig "
            "freigegeben",
        ]
    )
    doc.clause("1.2", "Bindung der Ecktermine")
    doc.p(
        "Beide Ecktermine sind Zieltermine der Angebotsgrundlage und werden erst mit der "
        "Beauftragung Vertragstermine. Die Termintreue der Gesamtfertigstellung ist die "
        "erste Priorität des Auftraggebers."
    )

    doc.page()
    doc.h2("2   Phasen")
    doc.mark("A03", "Phasen des Terminrahmens", "Phases of the schedule frame")
    doc.table(
        ["Phase", "Beginn", "Ende", "Dauer"],
        [
            [phase["label"], dmy(phase["begin"]), dmy(phase["end"]),
             f"{de(phase['months'], 1)}{NB}Monate"]
            for phase in PHASES
        ],
        [62.0, 28.0, 28.0, 30.0],
        ["L", "R", "R", "R"],
    )
    doc.clause("2.1", "Planung und Genehmigung")
    doc.p(
        f"Die Planungsphase läuft {de(PHASES[0]['months'], 1)}{NB}Monate und umfasst die "
        "Fortschreibung der Ausführungsplanung, die Werkplanung des Holzbaus und die "
        "Freigaben. Der Vorfertigungsgrad des Holzbaus verlangt, dass die Werkplanung "
        "eines Hauses vor Beginn seiner Ausführung abgeschlossen ist."
    )
    doc.clause("2.2", "Vergabe und Mobilisierung")
    doc.p(
        f"Die Vergabephase läuft {de(PHASES[1]['months'], 1)}{NB}Monate und überlappt die "
        f"Planungsphase um {de(PHASES[1]['lead'], 1)}{NB}Monate. In dieser Zeit werden die "
        "Lose vergeben, die Baustelleneinrichtung aufgebaut und die Vormontagefläche im "
        "südlichen Baufeld eingerichtet."
    )
    doc.clause("2.3", "Ausführung der drei Häuser")
    doc.p(
        "Die drei Häuser werden gestaffelt ausgeführt. Die Staffelung folgt der "
        "Verfügbarkeit der Vormontagefläche und dem Kran: das Hofhaus beginnt zuerst, "
        "Kontorhaus und Stadthaus folgen zeitgleich, das Stadthaus hat die längste "
        "Ausführungsdauer und endet zuletzt."
    )
    doc.clause("2.4", "Reihenfolge und Vorlauf der Häuser")
    doc.p(
        "Die Ausführung des Hofhauses beginnt am frühesten, weil sein Untergeschoss die "
        "Baugrube für das Quartier eröffnet. Kontorhaus und Stadthaus folgen mit dem in "
        "Abschnitt 3 genannten Vorlauf und beginnen am selben Tag. Die Vormontagefläche im "
        "südlichen Baufeld steht nur bis zum Baubeginn des Stadthauses zur Verfügung; das "
        "ist der Grund, weshalb das Stadthaus die längste Ausführungsdauer hat und "
        "zuletzt fertig wird."
    )
    doc.clause("2.5", "Abnahme und Übergabe")
    doc.p(
        f"Die Abnahme- und Übergabephase läuft {de(PHASES[5]['months'], 1)}{NB}Monate und "
        "folgt der Ausführung des Stadthauses. Sie umfasst die technische Abnahme, die "
        "Einregulierung der Anlagen, die Spülung und Beprobung der Trinkwasseranlagen und "
        "die Übergabe der Dokumentation."
    )

    doc.page()
    doc.h2("3   Abhängigkeiten und Vorläufe")
    doc.mark("A04", "Abhängigkeiten und Vorläufe der Phasen",
             "Phase dependencies and declared overlaps")
    doc.table(
        ["Phase", "hängt ab von", "Vorlauf", "Bedeutung des Vorlaufs"],
        [
            [
                phase["label"],
                PHASE_LABELS[phase["dependsOn"]] if phase["dependsOn"] else "keine",
                f"{de(phase['lead'], 1)}{NB}Monate" if phase["dependsOn"] else "entfällt",
                "Überlappung mit dem Vorgänger" if phase["lead"] else "kein Vorlauf",
            ]
            for phase in PHASES
        ],
        [44.0, 44.0, 24.0, 36.0],
        ["L", "L", "R", "L"],
    )
    doc.clause("3.1", "Lesart des Vorlaufs")
    doc.p(
        "Der Vorlauf ist die erklärte Überlappung mit dem Vorgänger: die Phase beginnt um "
        "den Vorlauf früher als das Ende des Vorgängers. Ein Vorlauf von null bedeutet, "
        "dass die Phase erst nach dem Ende des Vorgängers beginnt."
    )
    doc.clause("3.2", "Kritischer Weg")
    doc.p(
        f"Der kritische Weg führt über die Ausführung des Stadthauses mit "
        f"{de(PHASES[4]['months'], 1)}{NB}Monaten und die anschließende Übergabe. Das "
        "Stadthaus ist das letzte Haus und hat die längste Ausführungsdauer; jede "
        "Verzögerung dort wirkt unmittelbar auf die Gesamtfertigstellung."
    )
    doc.clause("3.3", "Externe Abhängigkeiten")
    doc.table(
        ["Abhängigkeit", "Verantwortung", "Wirkung bei Verzug"],
        [
            ["Baufeldfreimachung und Kampfmittelfreigabe", "Auftraggeber",
             "Baubeginn verschiebt sich vollständig"],
            ["Baugenehmigung", "Auftraggeber und Behörde",
             "Baubeginn verschiebt sich vollständig"],
            ["Anschlusstermine der Netzbetreiber", "Auftraggeber",
             "Inbetriebnahme und Übergabe verschieben sich"],
            ["Entscheidung Telekommunikation", "Auftraggeber",
             "Fernauslesung und Störmeldung nicht funktionsfähig"],
            ["Verfügbarkeit der Vormontagefläche", "Freianlagenplanung",
             "Staffelung der Häuser muss geändert werden"],
        ],
        [56.0, 40.0, 52.0],
        ["L", "L", "L"],
    )

    doc.page()
    doc.h2("4   Offene Abhängigkeit B-Q-08")
    doc.mark("A05", "Offene Frage B-Q-08 zur Übergabeform",
             "Open question B-Q-08 on the handover form")
    doc.p(
        "Die Übergabeform ist nicht entschieden. Die Frage ist unter der Kennung B-Q-08 "
        "geführt und lautet: wünscht der Auftraggeber eine Übergabe des gesamten "
        "Quartiers oder mehrere Bauabschnitte mit getrennten Übergaben?"
    )
    doc.table(
        ["Gegenstand", "Inhalt"],
        [
            ["Kennung", "B-Q-08"],
            ["Frage", "eine Übergabe oder mehrere Bauabschnitte?"],
            ["Sachstand", "OFFEN, keine herausgegebene Vorgabe"],
            ["Betroffene Phase", PHASE_LABELS["handover"]],
            ["Annahme für die Kalkulation",
             f"eine Übergabe zum {dmy(END_DATE)}"],
            ["Wirkung, wenn anders entschieden",
             "Terminlogik, Baustelleneinrichtung und Abnahmeaufwand ändern sich"],
        ],
        [40.0, 108.0],
        ["L", "L"],
    )
    doc.clause("4.1", "Warum die Frage terminwirksam ist")
    doc.p(
        "Bei einer Übergabe folgt die Abnahmephase der Ausführung des letzten Hauses. Bei "
        "mehreren Bauabschnitten wären Abnahmen je Haus erforderlich, die "
        "Baustelleneinrichtung müsste über die Teilübergaben hinweg betrieben werden und "
        "die Nutzung eines übergebenen Hauses neben einer laufenden Baustelle wäre "
        "gesondert zu organisieren. Beides wirkt auf Dauer und Aufwand."
    )
    doc.clause("4.2", "Annahmen des Terminrahmens")
    doc.bullets(
        [
            "eine Übergabe des gesamten Quartiers zum Gesamtfertigstellungstermin",
            "durchgehende Baustelleneinrichtung über die gesamte Bauzeit",
            "keine Nutzung eines Hauses vor der Gesamtübergabe",
            "Anschlusstermine der Netzbetreiber liegen vor der Abnahmephase",
        ]
    )
    doc.clause("4.3", "Meilensteine")
    doc.table(
        ["Meilenstein", "Termin", "Bezug"],
        [
            ["Baubeginn", dmy(START_DATE), "Ecktermin"],
            ["Ende Planung und Genehmigung", dmy(PHASES[0]["end"]), "Phase 1"],
            ["Beginn Ausführung Kontorhaus", dmy(PHASES[2]["begin"]), "Phase 3"],
            ["Ende Ausführung Stadthaus", dmy(PHASES[4]["end"]), "kritischer Weg"],
            ["Beginn Abnahme und Übergabe", dmy(PHASES[5]["begin"]), "Phase 6"],
            ["Gesamtfertigstellung", dmy(END_DATE), "Ecktermin"],
        ],
        [64.0, 34.0, 50.0],
        ["L", "R", "L"],
    )


# --------------------------------------------------------------------------
# 12 Planungsanforderungen und Freigaben (6 Blatt)
# --------------------------------------------------------------------------


def build_12(doc: Doc) -> None:
    doc.page()
    cover(
        doc,
        [
            ("Dokument", f"{doc.spec['title']} · {doc.spec['revision']}"),
            ("Plan-Nr.", doc.spec["planNumber"]),
            ("Geltung", "gesamtes Quartier, alle Planungsbeteiligten"),
            ("Energetischer Standard (Absicht)", "Effizienzhaus 55, Wohnhäuser"),
            ("Zertifizierung (Absicht)", "QNG-PLUS Wohnen, DGNB Gold Kontorhaus"),
        ],
    )
    doc.clause("1", "Zweck")
    doc.p(
        "Dieses Dokument fasst die Anforderungen an die Planung sowie die Freigabe- und "
        "Entscheidungswege zusammen. Es unterscheidet ausdrücklich zwischen Anforderung, "
        "Absicht und Zusage: eine Absicht ist kalkulationsrelevant, aber nicht "
        "verbindlich, solange sie nicht freigegeben ist."
    )
    doc.mark("A01", "Gestaltungsvorgaben des Auftraggebers",
             "Client design requirements")
    doc.clause("2", "Gestaltungsvorgaben")
    doc.table(
        ["Vorgabe", "Anforderung", "Verbindlichkeit"],
        [
            ["Fassadenhierarchie",
             "Südfassade Stadthaus höherwertig, Klinkerschale",
             "Anforderung"],
            ["Sichtholz im Wohnungsbau",
             "sichtbare Deckenuntersichten in den Wohnungen des Hofhauses",
             "Anforderung"],
            ["Materialität Hoffassade",
             "Holzbekleidung, vorvergraut, keine Anstriche",
             "Anforderung"],
            ["Dachbegrünung",
             "extensive Begrünung mit Retention auf den Wohnhäusern",
             "Anforderung"],
            ["Photovoltaik",
             "aufgestellte Anlage auf dem Kontorhaus",
             "Absicht"],
            ["Farbigkeit",
             "zurückhaltend, keine Signalfarben an den Fassaden",
             "Anforderung"],
        ],
        [34.0, 76.0, 38.0],
        ["L", "L", "L"],
    )
    doc.clause("2.1", "Konflikt zwischen Gestaltung und Brandschutz")
    doc.p(
        "Die Holzbekleidung der Hoffassade und die sichtbaren Deckenuntersichten setzen "
        "in der Gebäudeklasse 5 eine Abstimmung mit der Genehmigungsbehörde voraus. Die "
        "Abstimmung ist nicht abgeschlossen. Die Kalkulation geht von der Zulässigkeit "
        "aus; eine Ablehnung würde Bekleidungen oder eine andere Materialwahl erfordern."
    )

    doc.page()
    doc.h2("3   Leistungsphasen und Planungsstand")
    doc.mark("A02", "Leistungsphasen und geforderter Planungsstand",
             "Design stages and required design status")
    doc.table(
        ["Leistungsphase", "Stand", "Verantwortung", "Bemerkung"],
        [
            ["LPH 1 Grundlagenermittlung", "abgeschlossen", "Auftraggeber",
             "Auftraggeberbrief und Nachtrag"],
            ["LPH 2 Vorplanung", "abgeschlossen", "Planungsteam",
             "Grundlage dieser Unterlagen"],
            ["LPH 3 Entwurfsplanung", "in Bearbeitung", "Planungsteam",
             "Freigabe durch den Auftraggeber offen"],
            ["LPH 4 Genehmigungsplanung", "nicht begonnen", "Planungsteam",
             "setzt Freigabe LPH 3 voraus"],
            ["LPH 5 Ausführungsplanung", "nicht begonnen", "Planungsteam",
             "Werkplanung Holzbau je Haus vor Ausführungsbeginn"],
            ["LPH 6 bis 7 Vergabe", "nicht begonnen", "Auftraggeber",
             "Losaufteilung nach Projektbeschreibung"],
        ],
        [42.0, 26.0, 30.0, 50.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("3.1", "Werkplanung Holzbau")
    doc.p(
        "Der Vorfertigungsgrad des Holzbaus verlangt, dass die Werkplanung eines Hauses "
        "vor Beginn seiner Ausführung vollständig abgeschlossen und freigegeben ist. "
        "Nachträgliche Änderungen an vorgefertigten Elementen sind nicht möglich. Diese "
        "Bedingung bestimmt die Länge der Planungsphase im Terminrahmen."
    )
    doc.clause("3.2", "Freigabe als Voraussetzung")
    doc.p(
        "Jede Leistungsphase setzt die schriftliche Freigabe der vorangehenden voraus. Eine "
        "Vorwegnahme einzelner Leistungen ohne Freigabe ist zulässig, geht aber zu Lasten "
        "des Vorwegnehmenden und begründet keinen Anspruch auf Übernahme des Ergebnisses."
    )
    doc.clause("3.3", "Fachplanungen")
    doc.bullets(
        [
            "Tragwerksplanung einschließlich Holzbau und Nachweis der Deckenschwingung",
            "TGA-Planung nach den TGA-Anforderungen Rev C",
            "Bauphysik: Wärmeschutz, Schallschutz, sommerlicher Wärmeschutz, "
            "Luftdichtheitskonzept",
            "Brandschutzplanung einschließlich Abstimmung der Sichtholzflächen",
            "Freianlagenplanung als eigenes Los des Auftraggebers",
        ]
    )

    doc.page()
    doc.h2("4   Energetische Anforderungen")
    doc.mark("A03", "Energetischer Standard GEG und Effizienzhaus",
             "Energy standard per GEG and Effizienzhaus level")
    doc.p(
        "Grundlage ist das Gebäudeenergiegesetz. Über die gesetzliche Anforderung hinaus "
        "verfolgt der Auftraggeber für die Wohnhäuser den Standard Effizienzhaus 55 als "
        "Voraussetzung der Förderfähigkeit. Für das Kontorhaus ist Effizienzgebäude 55 "
        "vorgesehen, ohne Förderabsicht."
    )
    doc.table(
        ["Gebäude", "Gesetzlicher Rahmen", "Angestrebter Standard", "Verbindlichkeit"],
        [
            [A["name"], "GEG, Nichtwohngebäude", "Effizienzgebäude 55", "Absicht"],
            [B["name"], "GEG, Wohngebäude", "Effizienzhaus 55", "Anforderung"],
            [C["name"], "GEG, gemischt genutzt",
             "Effizienzhaus 55 für den Wohnteil", "Anforderung"],
        ],
        [26.0, 40.0, 48.0, 34.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("4.1", "Effizienzhaus 40 als geprüfte Alternative")
    doc.p(
        "Der Auftraggeber lässt prüfen, ob für die Wohnhäuser der Standard Effizienzhaus "
        "40 erreichbar ist. Aus heutiger Sicht wären dafür eine stärkere Dämmung der "
        "Gebäudehülle, eine verbesserte Wärmerückgewinnung der Wohnungslüftung und eine "
        "Photovoltaikanlage auf den Wohnhäusern erforderlich. Die Photovoltaik "
        "widerspricht der geforderten Dachbegrünung mit Retention; der Zielkonflikt ist "
        "nicht aufgelöst."
    )
    doc.clause("4.2", "Wirkung auf die Anlagentechnik")
    doc.p(
        "Der angestrebte Standard ist mit Fernwärme, Wohnungsstationen, "
        "Fußbodenheizung und dezentraler Wohnungslüftung mit Wärmerückgewinnung "
        "erreichbar. Ein Wechsel des Standards würde die Anlagentechnik und die "
        "Gebäudehülle gemeinsam betreffen."
    )
    doc.clause("4.3", "Nachweisführung")
    doc.p(
        "Die Nachweise werden gebäudeweise geführt. Für das Stadthaus wird der Wohnteil "
        "getrennt vom Gewerbeteil bilanziert, weil die Nutzungen unterschiedlichen "
        "Anforderungen unterliegen."
    )
    doc.clause("4.4", "Was den Standard festlegt")
    doc.p(
        "Der energetische Standard ist eine Entscheidung des Auftraggebers und keine "
        "Ableitung aus der Planung. Solange er nicht festgelegt ist, wird mit "
        "Effizienzhaus 55 für die Wohnhäuser kalkuliert. Eine Festlegung auf Effizienzhaus "
        "40 wäre eine Änderung der Gebäudehülle und der Anlagentechnik und erzeugt neue "
        "Revisionen der Baubeschreibung und der TGA-Anforderungen."
    )

    doc.page()
    doc.h2("5   Qualitätssiegel Nachhaltiges Gebäude")
    doc.mark("A04", "QNG-Absicht für die Wohnhäuser",
             "QNG intent for the residential buildings")
    doc.p(
        "Für die Wohnhäuser verfolgt der Auftraggeber das Qualitätssiegel Nachhaltiges "
        "Gebäude in der Stufe QNG-PLUS. Das Siegel ist Voraussetzung für die angestrebte "
        "Förderung. Zum Ausgabedatum dieser Revision ist die Absicht erklärt, aber kein "
        "Zertifizierungsverfahren beauftragt."
    )
    doc.table(
        ["Anforderung", "Inhalt", "Stand"],
        [
            ["Ökobilanz", "Nachweis der Treibhausgasemissionen über den Lebenszyklus",
             "Absicht, Holzbau begünstigt den Nachweis"],
            ["Schadstoffvermeidung", "Positivliste für Innenraummaterialien",
             "Anforderung, in der Baubeschreibung verankert"],
            ["Barrierefreiheit", "Mindestanteil barrierefrei nutzbarer Wohnungen",
             "zwei Wohnungen im Hofhaus nachgewiesen"],
            ["Innenraumluftqualität", "Messung nach Fertigstellung",
             "Absicht, Messung noch nicht vergeben"],
            ["Nachhaltige Materialwahl", "Holz aus zertifizierter Forstwirtschaft",
             "Anforderung"],
        ],
        [36.0, 62.0, 50.0],
        ["L", "L", "L"],
    )
    doc.clause("5.1", "Wirkung auf die Ausschreibung")
    doc.p(
        "Die Schadstoffvermeidung und die zertifizierte Holzherkunft sind in die "
        "Leistungsbeschreibungen aufzunehmen, weil sie nachträglich nicht heilbar sind. "
        "Die übrigen Anforderungen sind Nachweise und wirken auf die Dokumentation."
    )
    doc.clause("5.2", "Abhängigkeit von der Förderzusage")
    doc.p(
        "Entfällt die Förderabsicht, entfällt auch die Notwendigkeit des Siegels. Die "
        "Anforderungen an Materialwahl und Schadstoffvermeidung bleiben davon unberührt, "
        "weil der Auftraggeber sie unabhängig fordert."
    )
    doc.clause("5.3", "Nachweise und Fristen")
    doc.p(
        "Die Ökobilanz und der Nachweis der Materialherkunft sind während der Ausführung "
        "zu erheben und lassen sich nachträglich nicht rekonstruieren. Die Messung der "
        "Innenraumluftqualität erfolgt nach Fertigstellung und vor der Übergabe; sie ist "
        "im Terminrahmen der Abnahmephase zu berücksichtigen."
    )

    doc.page()
    doc.h2("6   DGNB-Zertifizierung Kontorhaus")
    doc.mark("A05", "DGNB-Absicht für das Kontorhaus",
             "DGNB intent for the Kontorhaus")
    doc.p(
        "Für das Kontorhaus verfolgt der Auftraggeber eine Zertifizierung nach DGNB in "
        "der Auszeichnungsstufe Gold. Anlass ist die Vermietungssituation: die "
        "Mietinteressenten fragen ein Zertifikat nach. Die Absicht ist erklärt, das "
        "Verfahren ist nicht angemeldet."
    )
    doc.table(
        ["Kriteriengruppe", "Schwerpunkt", "Wirkung auf die Planung"],
        [
            ["Ökologische Qualität", "Ökobilanz, Materialrisiken",
             "Holzbau und Materialpositivliste"],
            ["Ökonomische Qualität", "Lebenszykluskosten, Flexibilität",
             "versetzbare Systemtrennwände, offene Struktur"],
            ["Soziokulturelle Qualität", "Innenraumkomfort, Tageslicht",
             "Sonnenschutz, Lüftung, Akustikdecken"],
            ["Technische Qualität", "Gebäudehülle, Rückbaubarkeit",
             "Luftdichtheitsmessung, trennbare Verbindungen"],
            ["Prozessqualität", "Nachweisführung und Dokumentation",
             "Dokumentationspflichten in der Ausschreibung"],
        ],
        [36.0, 50.0, 62.0],
        ["L", "L", "L"],
    )
    doc.clause("6.1", "Rückbaubarkeit der Verbunddecke")
    doc.p(
        "Die Holz-Beton-Verbunddecke ist über Vollgewindeschrauben verbunden und damit "
        "grundsätzlich trennbar. Der Nachweis der Rückbaubarkeit ist für die technische "
        "Qualität relevant und in der Werkplanung zu dokumentieren."
    )
    doc.clause("6.2", "Abgrenzung zum Wohnungsbau")
    doc.p(
        "Die Wohnhäuser werden nicht nach DGNB zertifiziert. Für sie gilt das "
        "Qualitätssiegel Nachhaltiges Gebäude. Eine doppelte Zertifizierung ist nicht "
        "vorgesehen."
    )
    doc.clause("6.3", "Wirkung auf die Ausschreibung")
    doc.p(
        "Die Kriterien wirken auf die Leistungsbeschreibungen: die Materialpositivliste, "
        "die Dokumentation der Herkunftsnachweise und die Aufnahme der "
        "Luftdichtheitsmessung in den Leistungsumfang sind vor der Vergabe zu setzen. "
        "Nachträglich sind diese Nachweise nicht heilbar."
    )
    doc.clause("6.4", "Kosten- und Terminwirkung")
    doc.p(
        "Die Zertifizierung erzeugt Aufwand für Nachweisführung und Dokumentation, nicht "
        "für zusätzliche Bauleistung: der angestrebte Standard folgt bereits aus der "
        "Holzbauweise, der Gebäudehülle und der Anlagentechnik. Ein Verfahren muss "
        "spätestens mit Beginn der Ausführungsplanung angemeldet sein, weil sonst "
        "Nachweise fehlen, die nur während der Ausführung erhoben werden können."
    )

    doc.page()
    doc.h2("7   Freigaben und Entscheidungswege")
    doc.mark("A06", "Freigabeprozess und Entscheidungswege",
             "Approval process and decision paths")
    doc.table(
        ["Gegenstand", "Entscheidung durch", "Form", "Folge"],
        [
            ["Entwurfsplanung LPH 3", "Auftraggeber", "schriftliche Freigabe",
             "Beginn Genehmigungsplanung"],
            ["Änderung des Wohnungsschlüssels", "Auftraggeber", "schriftliche Weisung",
             "neue Revision der Grundrisse"],
            ["Energetischer Standard", "Auftraggeber", "schriftliche Festlegung",
             "Anpassung Hülle und Anlagentechnik"],
            ["Zertifizierungsabsicht", "Auftraggeber", "Beauftragung des Verfahrens",
             "Dokumentationspflichten in der Vergabe"],
            ["Sichtholz in Gebäudeklasse 5", "Genehmigungsbehörde", "Abstimmung",
             "Materialwahl oder Bekleidung"],
            ["Übergabeform B-Q-08", "Auftraggeber", "schriftliche Festlegung",
             "Terminlogik und Baustelleneinrichtung"],
            ["Telekommunikationsanbindung", "Auftraggeber", "schriftliche Festlegung",
             "Leerrohr, Technikfläche, Fernauslesung"],
        ],
        [40.0, 32.0, 34.0, 42.0],
        ["L", "L", "L", "L"],
    )
    doc.clause("7.1", "Wirkung einer Entscheidung")
    doc.p(
        "Jede Entscheidung wird schriftlich festgehalten und erzeugt eine neue Revision "
        "der betroffenen Unterlage. Eine mündliche Festlegung ist keine Freigabe. "
        "Unterlagen, die eine überholte Entscheidung tragen, werden als überholt "
        "gekennzeichnet und nicht zurückgezogen, damit die Zuordnung älterer Umlaufmappen "
        "möglich bleibt."
    )
    doc.clause("7.2", "Offene Freigaben zum Ausgabedatum")
    doc.bullets(
        [
            "Freigabe der Entwurfsplanung LPH 3: offen",
            "Festlegung des energetischen Standards Effizienzhaus 55 oder 40: offen",
            "Beauftragung der Zertifizierungsverfahren QNG und DGNB: offen",
            "Abstimmung der Sichtholzflächen mit der Genehmigungsbehörde: offen",
            "Festlegung der Übergabeform B-Q-08: offen",
            "Festlegung der Telekommunikationsanbindung: offen",
        ]
    )


# --------------------------------------------------------------------------
# Build, verify, manifest
# --------------------------------------------------------------------------

BUILDERS = {
    "LEI-DOC-01": build_01,
    "LEI-DOC-02": build_02,
    "LEI-DOC-03": build_03,
    "LEI-DOC-04": build_04,
    "LEI-DOC-05": build_05,
    "LEI-DOC-06": build_06,
    "LEI-DOC-07": build_07,
    "LEI-DOC-08": build_08,
    "LEI-DOC-09": build_09,
    "LEI-DOC-10": build_10,
    "LEI-DOC-11": build_11,
    "LEI-DOC-12": build_12,
}

EXPECTED_ANCHORS = {
    "LEI-DOC-01": 5,
    "LEI-DOC-02": 4,
    "LEI-DOC-03": 6,
    "LEI-DOC-04": 7,
    "LEI-DOC-05": 8,
    "LEI-DOC-06": 4,
    "LEI-DOC-07": 10,
    "LEI-DOC-08": 6,
    "LEI-DOC-09": 8,
    "LEI-DOC-10": 5,
    "LEI-DOC-11": 5,
    "LEI-DOC-12": 6,
}

# The six TGA anchors consumed downstream by KG400 and the TGA procurement export.
TGA_DOWNSTREAM_ANCHORS = [
    "LEI-DOC-09-A01",  # Fernwaerme connection and handover boundary
    "LEI-DOC-09-A03",  # ventilation requirement, commercial ground floor
    "LEI-DOC-09-A05",  # charging requirement: quantity and quantity authority
    "LEI-DOC-09-A06",  # house-connection responsibility
    "LEI-DOC-09-A07",  # metering and controls
    "LEI-DOC-09-A08",  # open telecommunications interface
]

# Fixed authoring date of the pack; never `datetime.now()`.
PACK_CREATED_AT = "2026-09-08"

LICENCE = (
    "in-house - All3 owns the asset. Synthetic demonstration material, authored "
    "internally from the demo fixture. Approved use: internal Product work, "
    "implementation, test fixtures and clearly labelled client-demo environments. "
    "Never a tender, contract or valuation basis; no external publication without "
    "legal and brand approval."
)

MANIFEST_COMMENT = (
    "DEMO / NON-PRODUCTION. Twelve synthetic German construction-project documents "
    "for the demo project DEMO-COMPLEX-01 (Leipzig, three buildings), authored "
    "internally by All3 from the values in src/fixtures/vr3-demo-projects.json. No "
    "client material, no externally licensed content, no real organisation other "
    "than the fixture's invented client. Approved for internal Product work, test "
    "fixtures and clearly labelled client-demo environments; NEVER a tender, "
    "contract or valuation basis. Every page carries a visible DEMO marking. "
    "Generated file - do not hand-edit: change the generator and re-run it."
)


def verify_pdf(path: Path, spec: dict) -> dict:
    import pypdf

    reader = pypdf.PdfReader(str(path))
    pages = len(reader.pages)
    if pages != spec["pages"]:
        raise SystemExit(f"{path.name}: {pages} pages, declared {spec['pages']}")
    narrow = 0
    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if len(text.strip()) < 400:
            raise SystemExit(
                f"{path.name}: page {index} carries only "
                f"{len(text.strip())} extractable characters"
            )
        if " " in text:
            raise SystemExit(f"{path.name}: page {index} contains U+00A0")
        if DEMO_LINE not in text:
            raise SystemExit(f"{path.name}: page {index} misses the DEMO marking")
        narrow += text.count(" ")
    if narrow == 0:
        raise SystemExit(f"{path.name}: no U+202F narrow no-break space found")
    data = path.read_bytes()
    return {
        "pages": pages,
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "narrowSpaces": narrow,
    }


def build_all() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    entries = []
    anchor_total = 0
    report = []

    for spec in DOC_SPECS:
        doc = Doc(spec)
        BUILDERS[spec["id"]](doc)
        doc.finish()
        path = OUT_DIR / spec["file"]
        doc.pdf.output(str(path))

        if len(doc.anchors) != EXPECTED_ANCHORS[spec["id"]]:
            raise SystemExit(
                f"{spec['id']}: {len(doc.anchors)} anchors, "
                f"expected {EXPECTED_ANCHORS[spec['id']]}"
            )
        for anchor in doc.anchors:
            if not 1 <= anchor["page"] <= spec["pages"]:
                raise SystemExit(f"{anchor['id']}: page {anchor['page']} out of range")

        stats = verify_pdf(path, spec)
        anchor_total += len(doc.anchors)
        report.append((spec["file"], stats, doc.anchors))

        entries.append(
            {
                "id": spec["id"],
                "file": f"leipzig/{spec['file']}",
                "title": spec["title"],
                "documentType": spec["documentType"],
                "revision": spec["revision"],
                "pages": spec["pages"],
                "issuedAt": spec["issuedAt"],
                "origin": "internal synthetic",
                "author": AUTHOR,
                "createdAt": PACK_CREATED_AT,
                "approvedClientDemoUse": True,
                "licence": LICENCE,
                "intendedUse": spec["intendedUse"],
                "demoFixture": True,
                "projectLevel": spec["projectLevel"],
                "buildingIds": spec["buildingIds"],
                "planNumber": spec["planNumber"],
                "source": (
                    "authored by All3 for the Leipzig demo fixture; every figure is read "
                    f"at build time from {FIXTURE.relative_to(REPO).as_posix()} "
                    f"({PROJECT_ID})"
                ),
                "sourceService": "inhouse-generator",
                "sourceUrl": GENERATOR_REL,
                "retrievedAt": PACK_CREATED_AT,
                "sha256": stats["sha256"],
                "bytes": stats["bytes"],
                "anchors": doc.anchors,
            }
        )

    for anchor_id in TGA_DOWNSTREAM_ANCHORS:
        known = {a["id"] for entry in entries for a in entry["anchors"]}
        if anchor_id not in known:
            raise SystemExit(f"downstream TGA anchor {anchor_id} is missing")

    by_id = {entry["id"]: entry for entry in entries}
    duplicates = []
    for spec in DUPLICATE_SPECS:
        source = by_id.get(spec["duplicateOf"])
        if source is None:
            raise SystemExit(f"{spec['id']}: duplicates unknown {spec['duplicateOf']}")
        duplicates.append(
            {
                "id": spec["id"],
                "duplicateOf": source["id"],
                # Same file, same sha256, same page count: that is what makes
                # it a duplicate rather than a revision.
                "file": source["file"],
                "uploadName": spec["uploadName"],
                "receivedAt": spec["receivedAt"],
                "sha256": source["sha256"],
                "bytes": source["bytes"],
                "pages": source["pages"],
                "origin": "internal synthetic",
                "author": AUTHOR,
                "createdAt": PACK_CREATED_AT,
                "approvedClientDemoUse": True,
                "licence": LICENCE,
                "demoFixture": True,
            }
        )

    manifest = {
        "$comment": MANIFEST_COMMENT,
        "generator": GENERATOR_REL,
        "project": {
            "id": PROJECT_ID,
            "name": PROJECT_NAME,
            "city": PROJECT["city"],
            "buildingIds": [b["id"] for b in ORDER],
        },
        "documents": entries,
        "duplicates": duplicates,
        "anchorCount": anchor_total,
        "tgaDownstreamAnchors": TGA_DOWNSTREAM_ANCHORS,
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    total_bytes = sum(stats["bytes"] for _, stats, _ in report)
    print(f"{'file':52s} {'pages':>5s} {'bytes':>8s} {'anchors':>7s} {'U+202F':>7s}")
    for file_name, stats, anchors in report:
        print(
            f"{file_name:52s} {stats['pages']:5d} {stats['bytes']:8d} "
            f"{len(anchors):7d} {stats['narrowSpaces']:7d}"
        )
    print(f"{'TOTAL':52s} {sum(s['pages'] for _, s, _ in report):5d} {total_bytes:8d} "
          f"{anchor_total:7d}")
    print(f"\nmanifest: {MANIFEST.relative_to(REPO).as_posix()} · anchorCount={anchor_total}")
    for file_name, stats, _ in report:
        print(f"{stats['sha256']}  {file_name}")
    import os
    if os.environ.get("FILL_REPORT"):
        print("\n-- fill report (y at end of page, limit 269) --")
        for file_name, page, y in FILL_LOG:
            flag = "SPARSE" if y < 200 else ""
            print(f"{file_name:48s} p{page:<3d} {y:6.1f} {flag}")


if __name__ == "__main__":
    build_all()
