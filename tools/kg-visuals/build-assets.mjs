#!/usr/bin/env node
/**
 * tools/kg-visuals/build-assets.mjs — writes the All3-authored KG visual
 * assets under `src/assets/kg/` (VR3-KG-UNIFY-00).
 *
 * ONE STYLE, THREE KINDS. Every file below is orthographic technical line
 * art in the KG 400 registry's own idiom: one dark line (`#323232`, the
 * literal value of `--color-text-primary`, because an `<img>` cannot inherit
 * `currentColor`), 1.5 px stroke, round caps, no fill, no photography, no
 * manufacturer marks and NO EMBEDDED TEXT — the same file serves DE and EN.
 *
 *   pictograms  24 × 24  one per system row (site, slab, façade, roof …)
 *   miniatures  48 × 36  one per MAJOR alternative (a basement scope, a
 *                        balcony load path, a façade composition …)
 *   swatches    48 × 36  a material COLOUR or TEXTURE family — a family,
 *                        never a product: the tint is a recognisable region
 *                        of the family and the hatch carries the distinction
 *                        without colour (forced-colours users still see it)
 *
 * The script is the provenance record: re-running it reproduces every asset
 * byte for byte, and the registry (`src/config/kg-visuals.ts`) names each
 * file it consumes. Assets are decorative by policy (`alt=""`): the text
 * beside every image already names the concept.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(ROOT, 'src', 'assets', 'kg')
const INK = '#323232'

const open = (w, h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" `
  + `fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
const svg = (w, h, body) => `${open(w, h)}${body}</svg>\n`
const P = (d) => `<path d="${d}"/>`
const R = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`
const L = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}"/>`
const C = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`

/* ── pictograms 24 × 24 ─────────────────────────────────────────────────── */
const pictograms = {
  // KG 200
  site: [R(4, 9, 16, 10), P('M4 9l8-5 8 5'), R(10, 13, 4, 6), L(2, 21, 22, 21)],
  clearance: [P('M3 20h18'), P('M4 20V10h6v10'), P('M10 12l5-6 3 2-4 5'), P('M18 8l3-3'), C(7, 17, 1.2)],
  connections: [P('M12 3v6'), P('M12 9l-6 4v8'), P('M12 9l6 4v8'), P('M3 21h18'), C(12, 9, 1.6), P('M6 17h12')],
  ground: [P('M3 8h18'), P('M3 13c3-2 6 2 9 0s6 2 9 0'), P('M3 18c3-2 6 2 9 0s6 2 9 0'), P('M7 4v4M12 4v4M17 4v4')],
  // KG 300
  slab: [P('M3 12h18'), P('M5 12v4h14v-4'), P('M3 20h18'), P('M8 16v4M16 16v4'), P('M12 5v7')],
  basement: [R(4, 4, 16, 8), P('M3 12h18'), P('M6 12v8h12v-8'), P('M6 17h12'), P('M9 20v-3M15 20v-3')],
  frame: [P('M4 20V6h16v14'), P('M4 11h16M4 16h16'), P('M10 6v14M14 6v14'), P('M3 20h18')],
  balcony: [P('M3 8h18'), P('M4 8v4h16V8'), P('M6 12v6M18 12v6'), P('M8 12v6M16 12v6'), P('M7 15h10')],
  facade: [R(4, 3, 16, 18), P('M4 12h16'), R(7, 6, 3, 3), R(14, 6, 3, 3), R(7, 14, 3, 4), R(14, 14, 3, 4)],
  roof: [P('M3 12l9-8 9 8'), P('M6 10v10h12V10'), P('M10 20v-5h4v5')],
  stairs: [P('M4 20h4v-4h4v-4h4V8h4'), P('M4 20V16M20 8V4'), L(4, 20, 4, 20)],
  window: [R(4, 4, 16, 16), P('M12 4v16M4 12h16'), P('M7 7l3 3M17 7l-3 3')],
  door: [P('M6 21V4h12v17'), P('M6 21h12'), C(15, 13, 1), P('M9 21v-6')],
  fitout: [P('M3 20h18'), P('M6 20V6h6v14'), P('M12 12h6v8'), P('M9 9v.01M9 13v.01')],
  // KG 500
  path: [P('M4 21c4-6 4-12 8-18'), P('M12 21c4-6 4-12 8-18'), P('M8 9h8M6 15h8')],
  planting: [P('M12 21v-7'), P('M12 14c-4 0-6-3-6-6 3-1 6 1 6 4'), P('M12 14c4 0 6-3 6-6-3-1-6 1-6 4'), P('M12 3v3')],
  water: [P('M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z'), P('M3 21h18')],
  ramp: [P('M3 20L21 8'), P('M3 20h18'), P('M21 8v12'), P('M9 16v4M15 12v8')],
  // KG 600
  mailbox: [R(4, 8, 16, 10), P('M4 12h16'), P('M10 15h4'), P('M8 8V5h8v3'), P('M12 18v3')],
  bicycle: [C(6, 16, 3.5), C(18, 16, 3.5), P('M6 16l4-8h5l3 8'), P('M10 8h3'), P('M15 8l-4 8')],
  signage: [P('M12 21V4'), P('M6 5h12l2 3-2 3H6z'), P('M8 15h8'), P('M9 21h6')],
  // KG 700
  plans: [R(4, 3, 16, 18), P('M8 8h8M8 12h8M8 16h5'), P('M4 7h3M4 12h3M4 17h3')],
  survey: [P('M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z'), C(12, 10, 2), P('M4 21h16')],
  certificate: [R(4, 3, 16, 14), P('M8 7h8M8 10h8M8 13h4'), P('M14 17l2 4 2-2 2 2-2-4')],
}

/* ── miniatures 48 × 36 ─────────────────────────────────────────────────── */
const ground = P('M2 26h44')
const houseAbove = [P('M12 26V12h24v14'), P('M12 12l12-8 12 8')]
const miniatures = {
  // basement scope
  UG_FULL: [...houseAbove, ground, P('M14 26v7h20v-7'), P('M14 30h20'), P('M18 33v-3M30 33v-3')],
  UG_EXCLUDED: [...houseAbove, ground, P('M14 26v7h20v-7'), P('M16 28l16 4M32 28l-16 4')],
  UG_FIT_OUT_ONLY: [...houseAbove, ground, P('M14 26v7h20v-7'), P('M20 27v5M28 27v5'), P('M22 32h4')],
  // ground-floor structure
  GF_CONCRETE: [R(6, 8, 36, 20), P('M6 18h36'), P('M14 8v20M24 8v20M34 8v20'), ground],
  GF_TIMBER: [R(6, 8, 36, 20), P('M6 18h36'), P('M14 8v20M24 8v20M34 8v20'), P('M6 8l8 10M14 18l10-10M24 8l10 10M34 18l8-10'), ground],
  // balconies
  BAL_COLUMNS: [P('M6 8v20'), P('M6 14h30'), P('M12 14v-5h20v5'), P('M34 14v14'), P('M22 14v14'), ground],
  BAL_DIAGONAL: [P('M6 8v20'), P('M6 14h30'), P('M12 14v-5h20v5'), P('M36 14L20 26'), P('M28 14l-8 6'), ground],
  BAL_CANTILEVER: [P('M6 8v20'), P('M6 14h30'), P('M12 14v-5h20v5'), P('M6 17h22'), ground],
  // façade compositions — a two-storey elevation, hatched by material zone
  FAC_FULL_TIMBER: [R(8, 6, 32, 22), P('M8 17h32'), P('M12 6v22M16 6v22M20 6v22M24 6v22M28 6v22M32 6v22M36 6v22'), ground],
  FAC_FULL_RENDER: [R(8, 6, 32, 22), P('M8 17h32'), R(14, 9, 5, 5), R(29, 9, 5, 5), R(14, 20, 5, 5), R(29, 20, 5, 5), ground],
  FAC_FULL_CLINKER: [R(8, 6, 32, 22), P('M8 17h32'), P('M8 10h32M8 14h32M8 21h32M8 25h32'), P('M16 6v4M24 6v4M32 6v4M12 10v4M20 10v4M28 10v4M36 10v4M16 17v4M24 17v4M32 17v4M12 21v4M20 21v4M28 21v4M36 21v4'), ground],
  FAC_GF_RENDER_UPPER_TIMBER: [R(8, 6, 32, 22), P('M8 17h32'), P('M12 6v11M16 6v11M20 6v11M24 6v11M28 6v11M32 6v11M36 6v11'), R(14, 20, 5, 5), R(29, 20, 5, 5), ground],
  FAC_GF_RENDER_UPPER_CLINKER: [R(8, 6, 32, 22), P('M8 17h32'), P('M8 10h32M8 14h32'), P('M16 6v4M24 6v4M32 6v4M12 10v4M20 10v4M28 10v4M36 10v4'), R(14, 20, 5, 5), R(29, 20, 5, 5), ground],
  // roof axes
  ROOF_OCCUPIED: [P('M6 14h36'), P('M8 14v14h32V14'), P('M6 14v-4h36v4'), P('M14 10V7M22 10V7M30 10V7M38 10V7M10 10V7M34 10V7M18 10V7M26 10V7'), P('M20 14v14')],
  ROOF_MAINTENANCE: [P('M6 14h36'), P('M8 14v14h32V14'), P('M12 14l4-4h4'), P('M14 14v-6'), P('M20 14v14')],
  ROOF_GREEN: [P('M6 14h36'), P('M8 14v14h32V14'), P('M10 14c2-3 4-3 6 0M18 14c2-3 4-3 6 0M26 14c2-3 4-3 6 0M34 14c2-3 4-3 6 0'), P('M20 14v14')],
  ROOF_NON_GREEN: [P('M6 14h36'), P('M8 14v14h32V14'), P('M8 11h32'), P('M20 14v14')],
  // windows · frame system, format, operable share
  WIN_PVC: [R(10, 6, 28, 24), R(14, 10, 20, 16), P('M24 10v16')],
  WIN_TIMBER: [R(10, 6, 28, 24), R(14, 10, 20, 16), P('M24 10v16'), P('M10 6l4 4M38 6l-4 4M10 30l4-4M38 30l-4-4')],
  WIN_TIMBER_ALU: [R(10, 6, 28, 24), R(12, 8, 24, 20), R(15, 11, 18, 14), P('M24 11v14')],
  WIN_ALU: [R(10, 6, 28, 24), R(12, 8, 24, 20), P('M24 8v20')],
  WIN_STANDARD_FORMAT: [R(8, 6, 32, 24), R(13, 11, 8, 8), R(27, 11, 8, 8), P('M8 24h32')],
  WIN_LARGE_FORMAT: [R(8, 6, 32, 24), R(12, 9, 10, 21), R(26, 9, 10, 21), P('M8 24h32')],
  WIN_OPENING_STANDARD: [R(8, 6, 32, 24), R(13, 10, 9, 16), R(26, 10, 9, 16), P('M13 10l9 8-9 8')],
  WIN_OPENING_INCREASED: [R(8, 6, 32, 24), R(13, 10, 9, 16), R(26, 10, 9, 16), P('M13 10l9 8-9 8'), P('M35 10l-9 8 9 8')],
  // doors · entrance, apartment, internal
  DOOR_ALU_GLAZED: [R(14, 4, 20, 28), R(17, 7, 14, 22), P('M17 18h14M24 7v22'), C(29, 20, 1)],
  DOOR_ALU_OPAQUE: [R(14, 4, 20, 28), R(17, 7, 14, 22), C(29, 20, 1)],
  DOOR_TIMBER_OPAQUE: [R(14, 4, 20, 28), R(17, 7, 14, 22), P('M20 7v22M24 7v22M28 7v22'), C(30, 20, 1)],
  ADOOR_STANDARD: [R(16, 4, 16, 28), C(28, 19, 1), P('M8 32h32')],
  ADOOR_ENHANCED: [R(16, 4, 16, 28), C(28, 19, 1), P('M8 32h32'), P('M19 7v22M22 7v22'), R(26, 22, 4, 5)],
  IDOOR_STANDARD: [R(16, 4, 16, 28), C(28, 19, 1), P('M8 32h32')],
  IDOOR_ROBUST: [R(16, 4, 16, 28), R(18, 6, 12, 24), C(28, 19, 1), P('M8 32h32'), P('M16 28h16')],
  // stairs and lift shaft — read-only current solution
  STAIR_CONCRETE: [P('M6 30h6v-6h6v-6h6v-6h6V6h6'), P('M6 30V24M36 6V2'), ground],
  SHAFT_CONCRETE: [R(16, 4, 16, 28), P('M20 4v28M28 4v28'), P('M16 12h16M16 24h16'), ground],
}

/* ── swatches 48 × 36 · colour and texture FAMILIES ─────────────────────── */
// A tint is a recognisable region of the family, never a product colour; the
// hatch carries the same distinction without colour.
const swatchFill = (tint, hatch) =>
  `<rect x="1" y="1" width="46" height="34" fill="${tint}" stroke="${INK}"/>${hatch}`
const hatchV = P('M9 1v34M17 1v34M25 1v34M33 1v34M41 1v34')
const hatchH = P('M1 8h46M1 15h46M1 22h46M1 29h46')
const hatchPanel = [P('M16 1v34M32 1v34'), P('M1 18h46')].join('')
const dots = (step, r = 0.8) => {
  const out = []
  for (let y = 4; y < 35; y += step) for (let x = 4; x < 47; x += step) out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}" stroke="none"/>`)
  return out.join('')
}
const brick = (jitter) => {
  const out = [P('M1 8h46M1 15h46M1 22h46M1 29h46')]
  let odd = false
  for (let y = 1; y < 35; y += 7) {
    for (let x = odd ? 8 : 1; x < 47; x += 14) out.push(`<path d="M${x} ${y}v7"/>`)
    odd = !odd
  }
  if (jitter) out.push(P('M3 4h3M20 11h3M37 18h3M11 25h3M28 32h3'))
  return out.join('')
}
const swatches = {
  // timber colour families
  TIMBER_LIGHT: swatchFill('#e9dcc4', hatchV),
  TIMBER_WARM: swatchFill('#c9a071', hatchV),
  TIMBER_DARK: swatchFill('#6f5540', hatchV),
  TIMBER_MUTED: swatchFill('#9c9a90', hatchV),
  // render colour families
  RENDER_LIGHT: swatchFill('#f0efe9', dots(6)),
  RENDER_WARM: swatchFill('#e2cfb6', dots(6)),
  RENDER_MUTED: swatchFill('#b8c0b6', dots(6)),
  RENDER_DARK: swatchFill('#6b6d6a', dots(6)),
  // clinker colour families
  CLINKER_RED: swatchFill('#9d4b36', brick(false)),
  CLINKER_SAND: swatchFill('#d8c39c', brick(false)),
  CLINKER_GREY: swatchFill('#5a5c5e', brick(false)),
  CLINKER_VARIED: swatchFill('#b0725a', brick(true)),
  // timber texture families
  TEX_TIMBER_VERTICAL: swatchFill('#ffffff', hatchV),
  TEX_TIMBER_HORIZONTAL: swatchFill('#ffffff', hatchH),
  TEX_TIMBER_PANEL: swatchFill('#ffffff', hatchPanel),
  // render texture families
  TEX_RENDER_FINE: swatchFill('#ffffff', dots(4, 0.5)),
  TEX_RENDER_MEDIUM: swatchFill('#ffffff', dots(6, 0.8)),
  TEX_RENDER_PRONOUNCED: swatchFill('#ffffff', dots(8, 1.2)),
  // clinker texture families
  TEX_CLINKER_SMOOTH: swatchFill('#ffffff', brick(false)),
  TEX_CLINKER_LIGHT: swatchFill('#ffffff', brick(false) + P('M5 4h2M22 11h2M39 18h2M13 25h2')),
  TEX_CLINKER_PRONOUNCED: swatchFill('#ffffff', brick(true) + P('M6 3l1 2M23 10l1 2M40 17l1 2M14 24l1 2M31 31l1 2')),
}

function write(dir, name, content) {
  mkdirSync(path.join(OUT, dir), { recursive: true })
  writeFileSync(path.join(OUT, dir, `${name}.svg`), content)
}

for (const [key, parts] of Object.entries(pictograms)) write('pictograms', key, svg(24, 24, parts.join('')))
for (const [key, parts] of Object.entries(miniatures)) write('miniatures', key, svg(48, 36, parts.join('')))
for (const [key, body] of Object.entries(swatches)) write('swatches', key, svg(48, 36, body))

console.log(
  `written ${Object.keys(pictograms).length} pictograms, `
  + `${Object.keys(miniatures).length} miniatures, ${Object.keys(swatches).length} swatches → ${path.relative(ROOT, OUT)}`,
)
