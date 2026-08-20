/**
 * Types only, so neither chunk gains a byte from it. The defaults and the
 * resolving live in `debug/palette.ts`, which the editor chunk owns.
 */

/** What the editor draws its helpers and handles in. Every field is optional. */
export interface HelperStyle {
  /** The active light. Default `'#d97706'`. */
  color?: string
  /** Every other light. Default `'#000000'`. */
  idleColor?: string
  /** How present the inactive lights are, 0 to 1. Default `0.75`. */
  idleOpacity?: number
}
