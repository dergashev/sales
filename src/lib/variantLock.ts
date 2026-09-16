/**
 * EIN AUSGELIEFERTER STAND MIT NUR EINER NAVIGATION.
 *
 * `navVariant` ist eine Nutzereinstellung: wer im Prototyp arbeitet, schaltet
 * zwischen `v1`, `v2` und `v3` um, und die Wahl überlebt den Reload. Für eine
 * VERÖFFENTLICHTE Fassung ist das keine Einstellung, sondern eine Falle —
 * wer auf `v1` landet, sieht den freigegebenen Stand und hält ihn für das,
 * was gezeigt werden sollte.
 *
 * `VITE_NAV_VARIANT` sperrt die Variante zur BAUZEIT: der Store startet auf
 * ihr, unabhängig vom gespeicherten Wert, und der Umschalter wird nicht
 * gerendert. Ohne die Variable ändert sich nichts — Entwicklung und
 * Testlauf sehen exakt das bisherige Verhalten, weil dort `undefined` steht.
 */
export type NavVariant = 'v1' | 'v2' | 'v3' | 'v4'

/**
 * `v4` ist `v3` PLUS eine andere Navigation — kein zweiter Produktstand.
 *
 * Jede Oberfläche, die `v3` eingeführt hat, gilt dort unverändert weiter;
 * unterschiedlich ist nur, wie die Reise dargestellt wird. Deshalb fragt der
 * Produktcode nach dieser Funktion und nicht nach dem Namen der Variante:
 * sonst müsste jede `v3`-Stelle bei jeder weiteren Variante erneut angefasst
 * werden, und genau so entstehen Varianten, die in der Hälfte der Fälle
 * zurückfallen.
 */
export function hasV3Surfaces(variant: NavVariant): boolean {
  return variant === 'v3' || variant === 'v4'
}

const RAW = (import.meta.env?.VITE_NAV_VARIANT ?? '') as string

export const LOCKED_NAV_VARIANT: NavVariant | null =
  RAW === 'v1' || RAW === 'v2' || RAW === 'v3' || RAW === 'v4' ? RAW : null
