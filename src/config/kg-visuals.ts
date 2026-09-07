import {
  KG400_SOLUTION_ILLUSTRATIONS,
  KG400_SYSTEM_PICTOGRAMS,
  systemKeyOf as kg400SystemKeyOf,
  type Kg400Visual,
} from './kg400-solution-visuals'
import site from '../assets/kg/pictograms/site.svg'
import clearance from '../assets/kg/pictograms/clearance.svg'
import connections from '../assets/kg/pictograms/connections.svg'
import ground from '../assets/kg/pictograms/ground.svg'
import slab from '../assets/kg/pictograms/slab.svg'
import basement from '../assets/kg/pictograms/basement.svg'
import frame from '../assets/kg/pictograms/frame.svg'
import balcony from '../assets/kg/pictograms/balcony.svg'
import facade from '../assets/kg/pictograms/facade.svg'
import roof from '../assets/kg/pictograms/roof.svg'
import stairs from '../assets/kg/pictograms/stairs.svg'
import window from '../assets/kg/pictograms/window.svg'
import door from '../assets/kg/pictograms/door.svg'
import fitout from '../assets/kg/pictograms/fitout.svg'
import pathway from '../assets/kg/pictograms/path.svg'
import planting from '../assets/kg/pictograms/planting.svg'
import water from '../assets/kg/pictograms/water.svg'
import ramp from '../assets/kg/pictograms/ramp.svg'
import mailbox from '../assets/kg/pictograms/mailbox.svg'
import bicycle from '../assets/kg/pictograms/bicycle.svg'
import signage from '../assets/kg/pictograms/signage.svg'
import plans from '../assets/kg/pictograms/plans.svg'
import survey from '../assets/kg/pictograms/survey.svg'
import certificate from '../assets/kg/pictograms/certificate.svg'
import UG_FULL from '../assets/kg/miniatures/UG_FULL.svg'
import UG_EXCLUDED from '../assets/kg/miniatures/UG_EXCLUDED.svg'
import UG_FIT_OUT_ONLY from '../assets/kg/miniatures/UG_FIT_OUT_ONLY.svg'
import GF_CONCRETE from '../assets/kg/miniatures/GF_CONCRETE.svg'
import GF_TIMBER from '../assets/kg/miniatures/GF_TIMBER.svg'
import BAL_COLUMNS from '../assets/kg/miniatures/BAL_COLUMNS.svg'
import BAL_DIAGONAL from '../assets/kg/miniatures/BAL_DIAGONAL.svg'
import BAL_CANTILEVER from '../assets/kg/miniatures/BAL_CANTILEVER.svg'
import FAC_FULL_TIMBER from '../assets/kg/miniatures/FAC_FULL_TIMBER.svg'
import FAC_FULL_RENDER from '../assets/kg/miniatures/FAC_FULL_RENDER.svg'
import FAC_FULL_CLINKER from '../assets/kg/miniatures/FAC_FULL_CLINKER.svg'
import FAC_GF_RENDER_UPPER_TIMBER from '../assets/kg/miniatures/FAC_GF_RENDER_UPPER_TIMBER.svg'
import FAC_GF_RENDER_UPPER_CLINKER from '../assets/kg/miniatures/FAC_GF_RENDER_UPPER_CLINKER.svg'
import ROOF_OCCUPIED from '../assets/kg/miniatures/ROOF_OCCUPIED.svg'
import ROOF_MAINTENANCE from '../assets/kg/miniatures/ROOF_MAINTENANCE.svg'
import ROOF_GREEN from '../assets/kg/miniatures/ROOF_GREEN.svg'
import ROOF_NON_GREEN from '../assets/kg/miniatures/ROOF_NON_GREEN.svg'
import WIN_PVC from '../assets/kg/miniatures/WIN_PVC.svg'
import WIN_TIMBER from '../assets/kg/miniatures/WIN_TIMBER.svg'
import WIN_TIMBER_ALU from '../assets/kg/miniatures/WIN_TIMBER_ALU.svg'
import WIN_ALU from '../assets/kg/miniatures/WIN_ALU.svg'
import WIN_STANDARD_FORMAT from '../assets/kg/miniatures/WIN_STANDARD_FORMAT.svg'
import WIN_LARGE_FORMAT from '../assets/kg/miniatures/WIN_LARGE_FORMAT.svg'
import WIN_OPENING_STANDARD from '../assets/kg/miniatures/WIN_OPENING_STANDARD.svg'
import WIN_OPENING_INCREASED from '../assets/kg/miniatures/WIN_OPENING_INCREASED.svg'
import DOOR_ALU_GLAZED from '../assets/kg/miniatures/DOOR_ALU_GLAZED.svg'
import DOOR_ALU_OPAQUE from '../assets/kg/miniatures/DOOR_ALU_OPAQUE.svg'
import DOOR_TIMBER_OPAQUE from '../assets/kg/miniatures/DOOR_TIMBER_OPAQUE.svg'
import ADOOR_STANDARD from '../assets/kg/miniatures/ADOOR_STANDARD.svg'
import ADOOR_ENHANCED from '../assets/kg/miniatures/ADOOR_ENHANCED.svg'
import IDOOR_STANDARD from '../assets/kg/miniatures/IDOOR_STANDARD.svg'
import IDOOR_ROBUST from '../assets/kg/miniatures/IDOOR_ROBUST.svg'
import TIMBER_LIGHT from '../assets/kg/swatches/TIMBER_LIGHT.svg'
import TIMBER_WARM from '../assets/kg/swatches/TIMBER_WARM.svg'
import TIMBER_DARK from '../assets/kg/swatches/TIMBER_DARK.svg'
import TIMBER_MUTED from '../assets/kg/swatches/TIMBER_MUTED.svg'
import RENDER_LIGHT from '../assets/kg/swatches/RENDER_LIGHT.svg'
import RENDER_WARM from '../assets/kg/swatches/RENDER_WARM.svg'
import RENDER_MUTED from '../assets/kg/swatches/RENDER_MUTED.svg'
import RENDER_DARK from '../assets/kg/swatches/RENDER_DARK.svg'
import CLINKER_RED from '../assets/kg/swatches/CLINKER_RED.svg'
import CLINKER_SAND from '../assets/kg/swatches/CLINKER_SAND.svg'
import CLINKER_GREY from '../assets/kg/swatches/CLINKER_GREY.svg'
import CLINKER_VARIED from '../assets/kg/swatches/CLINKER_VARIED.svg'
import TEX_TIMBER_VERTICAL from '../assets/kg/swatches/TEX_TIMBER_VERTICAL.svg'
import TEX_TIMBER_HORIZONTAL from '../assets/kg/swatches/TEX_TIMBER_HORIZONTAL.svg'
import TEX_TIMBER_PANEL from '../assets/kg/swatches/TEX_TIMBER_PANEL.svg'
import TEX_RENDER_FINE from '../assets/kg/swatches/TEX_RENDER_FINE.svg'
import TEX_RENDER_MEDIUM from '../assets/kg/swatches/TEX_RENDER_MEDIUM.svg'
import TEX_RENDER_PRONOUNCED from '../assets/kg/swatches/TEX_RENDER_PRONOUNCED.svg'
import TEX_CLINKER_SMOOTH from '../assets/kg/swatches/TEX_CLINKER_SMOOTH.svg'
import TEX_CLINKER_LIGHT from '../assets/kg/swatches/TEX_CLINKER_LIGHT.svg'
import TEX_CLINKER_PRONOUNCED from '../assets/kg/swatches/TEX_CLINKER_PRONOUNCED.svg'

/**
 * THE shared KG visual registry (VR3-KG-UNIFY-00, `KGSystemVisual`).
 *
 * KG 400 proved the shape — a typed, language-neutral manifest that components
 * consume through two functions and never branch on an id to pick an image
 * (`kg400-solution-visuals.ts`). Six chapters now share the composition, so
 * the SHAPE is generalised here while every domain keeps its own entries:
 * KG 400's registry stays where it is and is merged in; the construction,
 * site, external-works, equipment and planning drawings live under
 * `src/assets/kg/`, produced by `tools/kg-visuals/build-assets.mjs`, which is
 * their provenance record.
 *
 * Three kinds, one style (orthographic technical line art, one dark line,
 * no text, no photography, no manufacturer marks):
 *
 * - a SYSTEM PICTOGRAM (24 px) per overview row, keyed by the group's
 *   declared `visual` — or, for a group that declares none, by the suffix of
 *   its id (`a-kg400-heat` → `heat`), which is how KG 400 has always resolved;
 * - a SOLUTION MINIATURE (48 × 36) for a MAJOR alternative, keyed by the
 *   variant's stable `value`;
 * - a MATERIAL SWATCH (48 × 36) for a colour or texture FAMILY, keyed the
 *   same way. A swatch shows a region of the family and carries its
 *   distinction in a hatch as well as a tint, so forced-colours users see the
 *   difference too. The family's NAME is the text beside it, always.
 *
 * Every image is decorative by policy (`alt=""`): the adjacent text names the
 * concept, and a missing entry or a failed load changes nothing about
 * selection, validity, price or accessibility.
 */

export type KgVisualKind = 'pictogram' | 'illustration' | 'swatch'

export type KgVisual = Readonly<{
  id: string
  kind: KgVisualKind
  src: string
  width: number
  height: number
  altPolicy: 'decorative'
  licence: 'All3 · internal · authored'
  author: string
  provenance: string
}>

const LICENCE = 'All3 · internal · authored' as const
const AUTHOR = 'All3 Design System · VR3-KG-UNIFY-00'
const PROVENANCE = 'authored technical line art · tools/kg-visuals/build-assets.mjs · no external source'

function pictogram(id: string, src: string): KgVisual {
  return { id, kind: 'pictogram', src, width: 24, height: 24, altPolicy: 'decorative', licence: LICENCE, author: AUTHOR, provenance: PROVENANCE }
}
function illustration(id: string, src: string): KgVisual {
  return { id, kind: 'illustration', src, width: 48, height: 36, altPolicy: 'decorative', licence: LICENCE, author: AUTHOR, provenance: PROVENANCE }
}
function swatch(id: string, src: string): KgVisual {
  return { id, kind: 'swatch', src, width: 48, height: 36, altPolicy: 'decorative', licence: LICENCE, author: AUTHOR, provenance: PROVENANCE }
}

/** A KG 400 entry, read through the shared type. Same bytes, same policy. */
function fromKg400(visual: Kg400Visual): KgVisual {
  return {
    id: visual.id,
    kind: visual.kind,
    src: visual.src,
    width: visual.width,
    height: visual.height,
    altPolicy: visual.altPolicy,
    licence: visual.licence,
    author: visual.author,
    provenance: visual.provenance,
  }
}

const withKg400 = (entries: Readonly<Record<string, Kg400Visual>>) =>
  Object.fromEntries(Object.entries(entries).map(([key, visual]) => [key, fromKg400(visual)]))

/** System pictograms by `visual` key — the KG 400 seven plus the five other chapters'. */
export const KG_SYSTEM_PICTOGRAMS: Readonly<Record<string, KgVisual>> = {
  ...withKg400(KG400_SYSTEM_PICTOGRAMS),
  site: pictogram('site', site),
  clearance: pictogram('clearance', clearance),
  connections: pictogram('connections', connections),
  ground: pictogram('ground', ground),
  slab: pictogram('slab', slab),
  basement: pictogram('basement', basement),
  frame: pictogram('frame', frame),
  balcony: pictogram('balcony', balcony),
  facade: pictogram('facade', facade),
  roof: pictogram('roof', roof),
  stairs: pictogram('stairs', stairs),
  window: pictogram('window', window),
  door: pictogram('door', door),
  fitout: pictogram('fitout', fitout),
  path: pictogram('path', pathway),
  planting: pictogram('planting', planting),
  water: pictogram('water', water),
  ramp: pictogram('ramp', ramp),
  mailbox: pictogram('mailbox', mailbox),
  bicycle: pictogram('bicycle', bicycle),
  signage: pictogram('signage', signage),
  plans: pictogram('plans', plans),
  survey: pictogram('survey', survey),
  certificate: pictogram('certificate', certificate),
}

/**
 * Solution miniatures and material swatches by variant `value`. The whitelist
 * IS the contract: an alternative absent here renders typography only.
 */
export const KG_SOLUTION_VISUALS: Readonly<Record<string, KgVisual>> = {
  ...withKg400(KG400_SOLUTION_ILLUSTRATIONS),
  UG_FULL: illustration('UG_FULL', UG_FULL),
  UG_EXCLUDED: illustration('UG_EXCLUDED', UG_EXCLUDED),
  UG_FIT_OUT_ONLY: illustration('UG_FIT_OUT_ONLY', UG_FIT_OUT_ONLY),
  GF_CONCRETE: illustration('GF_CONCRETE', GF_CONCRETE),
  GF_TIMBER: illustration('GF_TIMBER', GF_TIMBER),
  BAL_COLUMNS: illustration('BAL_COLUMNS', BAL_COLUMNS),
  BAL_DIAGONAL: illustration('BAL_DIAGONAL', BAL_DIAGONAL),
  BAL_CANTILEVER: illustration('BAL_CANTILEVER', BAL_CANTILEVER),
  FAC_FULL_TIMBER: illustration('FAC_FULL_TIMBER', FAC_FULL_TIMBER),
  FAC_FULL_RENDER: illustration('FAC_FULL_RENDER', FAC_FULL_RENDER),
  FAC_FULL_CLINKER: illustration('FAC_FULL_CLINKER', FAC_FULL_CLINKER),
  FAC_GF_RENDER_UPPER_TIMBER: illustration('FAC_GF_RENDER_UPPER_TIMBER', FAC_GF_RENDER_UPPER_TIMBER),
  FAC_GF_RENDER_UPPER_CLINKER: illustration('FAC_GF_RENDER_UPPER_CLINKER', FAC_GF_RENDER_UPPER_CLINKER),
  ROOF_OCCUPIED: illustration('ROOF_OCCUPIED', ROOF_OCCUPIED),
  ROOF_MAINTENANCE: illustration('ROOF_MAINTENANCE', ROOF_MAINTENANCE),
  ROOF_GREEN: illustration('ROOF_GREEN', ROOF_GREEN),
  ROOF_NON_GREEN: illustration('ROOF_NON_GREEN', ROOF_NON_GREEN),
  WIN_PVC: illustration('WIN_PVC', WIN_PVC),
  WIN_TIMBER: illustration('WIN_TIMBER', WIN_TIMBER),
  WIN_TIMBER_ALU: illustration('WIN_TIMBER_ALU', WIN_TIMBER_ALU),
  WIN_ALU: illustration('WIN_ALU', WIN_ALU),
  WIN_STANDARD_FORMAT: illustration('WIN_STANDARD_FORMAT', WIN_STANDARD_FORMAT),
  WIN_LARGE_FORMAT: illustration('WIN_LARGE_FORMAT', WIN_LARGE_FORMAT),
  WIN_OPENING_STANDARD: illustration('WIN_OPENING_STANDARD', WIN_OPENING_STANDARD),
  WIN_OPENING_INCREASED: illustration('WIN_OPENING_INCREASED', WIN_OPENING_INCREASED),
  DOOR_ALU_GLAZED: illustration('DOOR_ALU_GLAZED', DOOR_ALU_GLAZED),
  DOOR_ALU_OPAQUE: illustration('DOOR_ALU_OPAQUE', DOOR_ALU_OPAQUE),
  DOOR_TIMBER_OPAQUE: illustration('DOOR_TIMBER_OPAQUE', DOOR_TIMBER_OPAQUE),
  ADOOR_STANDARD: illustration('ADOOR_STANDARD', ADOOR_STANDARD),
  ADOOR_ENHANCED: illustration('ADOOR_ENHANCED', ADOOR_ENHANCED),
  IDOOR_STANDARD: illustration('IDOOR_STANDARD', IDOOR_STANDARD),
  IDOOR_ROBUST: illustration('IDOOR_ROBUST', IDOOR_ROBUST),
  TIMBER_LIGHT: swatch('TIMBER_LIGHT', TIMBER_LIGHT),
  TIMBER_WARM: swatch('TIMBER_WARM', TIMBER_WARM),
  TIMBER_DARK: swatch('TIMBER_DARK', TIMBER_DARK),
  TIMBER_MUTED: swatch('TIMBER_MUTED', TIMBER_MUTED),
  RENDER_LIGHT: swatch('RENDER_LIGHT', RENDER_LIGHT),
  RENDER_WARM: swatch('RENDER_WARM', RENDER_WARM),
  RENDER_MUTED: swatch('RENDER_MUTED', RENDER_MUTED),
  RENDER_DARK: swatch('RENDER_DARK', RENDER_DARK),
  CLINKER_RED: swatch('CLINKER_RED', CLINKER_RED),
  CLINKER_SAND: swatch('CLINKER_SAND', CLINKER_SAND),
  CLINKER_GREY: swatch('CLINKER_GREY', CLINKER_GREY),
  CLINKER_VARIED: swatch('CLINKER_VARIED', CLINKER_VARIED),
  TEX_TIMBER_VERTICAL: swatch('TEX_TIMBER_VERTICAL', TEX_TIMBER_VERTICAL),
  TEX_TIMBER_HORIZONTAL: swatch('TEX_TIMBER_HORIZONTAL', TEX_TIMBER_HORIZONTAL),
  TEX_TIMBER_PANEL: swatch('TEX_TIMBER_PANEL', TEX_TIMBER_PANEL),
  TEX_RENDER_FINE: swatch('TEX_RENDER_FINE', TEX_RENDER_FINE),
  TEX_RENDER_MEDIUM: swatch('TEX_RENDER_MEDIUM', TEX_RENDER_MEDIUM),
  TEX_RENDER_PRONOUNCED: swatch('TEX_RENDER_PRONOUNCED', TEX_RENDER_PRONOUNCED),
  TEX_CLINKER_SMOOTH: swatch('TEX_CLINKER_SMOOTH', TEX_CLINKER_SMOOTH),
  TEX_CLINKER_LIGHT: swatch('TEX_CLINKER_LIGHT', TEX_CLINKER_LIGHT),
  TEX_CLINKER_PRONOUNCED: swatch('TEX_CLINKER_PRONOUNCED', TEX_CLINKER_PRONOUNCED),
}

/**
 * The pictogram of one system row: its declared `visual`, else the KG 400
 * suffix rule. A group that resolves to neither renders no image, by design.
 */
export function kgSystemPictogram(group: { id: string; visual?: string }): KgVisual | null {
  return KG_SYSTEM_PICTOGRAMS[group.visual ?? kg400SystemKeyOf(group.id)] ?? null
}

/** The miniature or swatch of one alternative, by its stable value. */
export function kgSolutionVisual(variantValue: string): KgVisual | null {
  return KG_SOLUTION_VISUALS[variantValue] ?? null
}
