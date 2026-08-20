import type { HelperStyle } from '../runtime/helperStyle'

/** The active light. */
const DEFAULT_COLOR = '#d97706'

/** Every other light, as Blender does it. Selection reads as hue, not as fade. */
const DEFAULT_IDLE_COLOR = '#000000'

/**
 * High, because these are 1px lines: a line at a third opacity covers too
 * little of each pixel to stay readable, whatever its contrast ratio says.
 */
const DEFAULT_IDLE_OPACITY = 0.75

/**
 * Handles are drawn over the scene while the wireframes can be occluded, so
 * they carry at a little less. Scaled rather than set, to keep the relationship
 * when `idleOpacity` is overridden.
 */
const HANDLE_IDLE_SCALE = 0.8

export interface ResolvedHelperStyle {
  color: string
  idleColor: string
  idleOpacity: number
}

export function resolveHelperStyle(style: HelperStyle = {}): ResolvedHelperStyle {
  return {
    color: style.color ?? DEFAULT_COLOR,
    idleColor: style.idleColor ?? DEFAULT_IDLE_COLOR,
    idleOpacity: style.idleOpacity ?? DEFAULT_IDLE_OPACITY,
  }
}

/** The same style as the wireframes read it, dimmed. */
export function forHandles(style: ResolvedHelperStyle): ResolvedHelperStyle {
  return { ...style, idleOpacity: style.idleOpacity * HANDLE_IDLE_SCALE }
}
