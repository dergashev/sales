import heat from '../assets/kg400/systems/heat.svg'
import water from '../assets/kg400/systems/water.svg'
import air from '../assets/kg400/systems/air.svg'
import power from '../assets/kg400/systems/power.svg'
import drain from '../assets/kg400/systems/drain.svg'
import comms from '../assets/kg400/systems/comms.svg'
import lift from '../assets/kg400/systems/lift.svg'
import heatPumpAir from '../assets/kg400/solutions/heat-pump-air.svg'
import districtHeating from '../assets/kg400/solutions/district-heating.svg'
import heatPumpGround from '../assets/kg400/solutions/heat-pump-ground.svg'
import gasHybrid from '../assets/kg400/solutions/gas-hybrid.svg'
import biomass from '../assets/kg400/solutions/biomass.svg'
import ventExtract from '../assets/kg400/solutions/vent-extract.svg'
import ventDecentral from '../assets/kg400/solutions/vent-decentral.svg'
import ventCentralHr from '../assets/kg400/solutions/vent-central-hr.svg'
import ventWindow from '../assets/kg400/solutions/vent-window.svg'
import underfloor from '../assets/kg400/solutions/underfloor.svg'
import underfloorPlus from '../assets/kg400/solutions/underfloor-plus.svg'
import combined from '../assets/kg400/solutions/combined.svg'
import radiators from '../assets/kg400/solutions/radiators.svg'
import dhwCentral from '../assets/kg400/solutions/dhw-central.svg'
import dhwDecentral from '../assets/kg400/solutions/dhw-decentral.svg'
import dhwCompact from '../assets/kg400/solutions/dhw-compact.svg'
import plantCentral from '../assets/kg400/solutions/plant-central.svg'
import plantPerBuilding from '../assets/kg400/solutions/plant-per-building.svg'

/**
 * KG 400 solution visuals — the ONE typed registry (VR3-TGA-UX-00, selected
 * HYBRID model, `kg400-visual-language-study.md`).
 *
 * Two kinds of image, two jobs, one style:
 *
 * - a SYSTEM PICTOGRAM on every overview row (24 px), keyed by the system's
 *   stable identity — the suffix of its group id (`a-kg400-heat` → `heat`),
 *   so both demonstration catalogues resolve to the same seven drawings;
 * - a SOLUTION ILLUSTRATION (48 × 36) only for MAJOR, visually distinguishable
 *   alternatives, keyed by the variant's stable `value`. Abstract controls
 *   (equipment levels, access systems, towel radiators, showers) deliberately
 *   have none: a drawing there adds recognition cost, not recognition.
 *
 * WHAT AN IMAGE IS ALLOWED TO BE HERE. Supportive, never state, never proof
 * and never the only identifier: every option renders its full name,
 * differentiator, states and price phrase identically without it, so a
 * missing entry or a failed load changes nothing about selection, validity,
 * price or accessibility. All images are DECORATIVE (`alt=""`) because the
 * adjacent text already names the concept — the alt policy is recorded per
 * entry so a future informative image cannot inherit it silently.
 *
 * STYLE AND PROVENANCE. One All3-owned technical line-illustration system:
 * orthographic schematic line art, one dark line (`--color-text-primary`,
 * literal in the asset because an `<img>` cannot inherit `currentColor`),
 * no fill, no photography, no manufacturer marks, no embedded text — so the
 * same file serves DE and EN. Authored for this ticket; licence and author
 * are recorded on every entry. No hot links.
 *
 * Components consume this registry through `systemPictogram()` and
 * `solutionIllustration()`; no JSX anywhere branches on a variant id to pick
 * an image.
 */

export type Kg400VisualKind = 'pictogram' | 'illustration'

export type Kg400Visual = Readonly<{
  id: string
  kind: Kg400VisualKind
  src: string
  width: number
  height: number
  /** `decorative`: adjacent text names the concept, so the image is `alt=""`. */
  altPolicy: 'decorative'
  licence: 'All3 · internal · authored'
  author: 'All3 Design System · VR3-TGA-UX-00'
  provenance: 'authored technical line art · no external source'
}>

const LICENCE = 'All3 · internal · authored' as const
const AUTHOR = 'All3 Design System · VR3-TGA-UX-00' as const
const PROVENANCE = 'authored technical line art · no external source' as const

function pictogram(id: string, src: string): Kg400Visual {
  return {
    id, kind: 'pictogram', src, width: 24, height: 24,
    altPolicy: 'decorative', licence: LICENCE, author: AUTHOR, provenance: PROVENANCE,
  }
}

function illustration(id: string, src: string): Kg400Visual {
  return {
    id, kind: 'illustration', src, width: 48, height: 36,
    altPolicy: 'decorative', licence: LICENCE, author: AUTHOR, provenance: PROVENANCE,
  }
}

/** The seven canonical systems, by the stable suffix of their group id. */
export const KG400_SYSTEM_PICTOGRAMS: Readonly<Record<string, Kg400Visual>> = {
  heat: pictogram('heat', heat),
  water: pictogram('water', water),
  air: pictogram('air', air),
  power: pictogram('power', power),
  drain: pictogram('drain', drain),
  comms: pictogram('comms', comms),
  lift: pictogram('lift', lift),
}

/**
 * Major alternatives, by variant `value`. The whitelist IS the contract: an
 * alternative absent here renders typography only, by design.
 */
export const KG400_SOLUTION_ILLUSTRATIONS: Readonly<Record<string, Kg400Visual>> = {
  // heat generators
  WE_LW_WP: illustration('WE_LW_WP', heatPumpAir),
  WE_FW: illustration('WE_FW', districtHeating),
  WE_SW_WP: illustration('WE_SW_WP', heatPumpGround),
  WE_GAS_BW: illustration('WE_GAS_BW', gasHybrid),
  WE_BIOMASSE: illustration('WE_BIOMASSE', biomass),
  // dwelling ventilation
  WL_ABLUFT_DACH: illustration('WL_ABLUFT_DACH', ventExtract),
  WL_DEZ_WRG: illustration('WL_DEZ_WRG', ventDecentral),
  WL_ZENTRAL_WRG: illustration('WL_ZENTRAL_WRG', ventCentralHr),
  WL_FENSTER: illustration('WL_FENSTER', ventWindow),
  // heat emission
  WA_FBH: illustration('WA_FBH', underfloor),
  WA_FBH_EL_BAD: illustration('WA_FBH_EL_BAD', underfloorPlus),
  WA_KOMBI: illustration('WA_KOMBI', combined),
  WA_HK: illustration('WA_HK', radiators),
  // domestic hot water
  WW_ZENTRAL_WP: illustration('WW_ZENTRAL_WP', dhwCentral),
  WW_DEZ_FWST: illustration('WW_DEZ_FWST', dhwDecentral),
  WW_FW_KOMPAKT: illustration('WW_FW_KOMPAKT', dhwCompact),
  // plant concept (complex project)
  central: illustration('central', plantCentral),
  perBuilding: illustration('perBuilding', plantPerBuilding),
}

/** `a-kg400-heat` → `heat`. Both catalogues share the seven identities. */
export function systemKeyOf(groupId: string): string {
  const marker = groupId.lastIndexOf('kg400-')
  return marker === -1 ? groupId : groupId.slice(marker + 'kg400-'.length)
}

export function systemPictogram(groupId: string): Kg400Visual | null {
  return KG400_SYSTEM_PICTOGRAMS[systemKeyOf(groupId)] ?? null
}

export function solutionIllustration(variantValue: string): Kg400Visual | null {
  return KG400_SOLUTION_ILLUSTRATIONS[variantValue] ?? null
}
