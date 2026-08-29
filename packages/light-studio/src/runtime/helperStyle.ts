/**
 * Types only, so neither chunk gains a byte from it. The defaults and the
 * resolving live in `debug/palette.ts`, which the editor chunk owns.
 */

/**
 * How a light's handle is drawn.
 *
 * - `wireframe` is the DCC idiom: a dashed ring around a diamond, the same
 *   mark whatever the light is.
 * - `glyph` is the game-engine idiom: a filled pictogram of the light's own
 *   type, so a spot reads as a spot before you select it.
 */
export type LightIcons = 'wireframe' | 'glyph'

/** What the editor draws its helpers and handles in. Every field is optional. */
export interface HelperStyle {
  /** The active light. Default `'#d97706'`. */
  color?: string
  /** Every other light. Default `'#000000'`. */
  idleColor?: string
  /** How present the inactive lights are, 0 to 1. Default `0.75`. */
  idleOpacity?: number
  /** Default `'wireframe'`. Targets keep their reticle either way. */
  icons?: LightIcons
}
