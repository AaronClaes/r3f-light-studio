import {
  LIGHT_DEFINITIONS,
  type LightConfig,
  type LightPatch,
  type LightType,
  type ShadowConfig,
  type ShadowFrustum,
} from '../../core/schema'

/**
 * What the panel shows for a light, derived from `LIGHT_DEFINITIONS` rather
 * than written out per type: a field appears here because the schema says the
 * light has it. Add a field to a light type and it shows up in the panel.
 *
 * What the schema does *not* say is how a field should read — step sizes,
 * which numbers are really a menu, how deep to nest the shadow settings. That
 * is presentation, so it lives here and not in `core`.
 *
 * Nothing in this file imports leva. It describes controls; `LightPanel`
 * translates them.
 */

export type FieldValue = number | string | boolean | readonly number[]

/** A leva control, minus the plumbing the panel adds. */
export type Control = Record<string, unknown>

export interface Field {
  /**
   * Unique across the whole panel, not just its folder. Leva maps a `set` call
   * by leaf key alone and ignores the folder the control sits in, so a
   * shadow's `bias` and a light's `bias` would be one control.
   */
  key: string
  /** Folder path, outermost first. Empty means top level. */
  path: string[]
  /** The control, with its current value read off `light`. */
  input: (light: LightConfig) => Control
  read: (light: LightConfig) => FieldValue
  /** The store update for a new value. Reads `light` for fields it merges into. */
  patch: (light: LightConfig, value: FieldValue) => LightPatch
}

/**
 * How each number reads in the panel. Steps, and the floors that are physical
 * rather than three's — these are feel, not validation. The only hard ranges
 * are `LIGHT_DEFINITIONS.clamp`, and those win.
 */
const NUMBER_UI: Record<string, Control> = {
  intensity: { min: 0, step: 0.1 },
  distance: { min: 0, step: 0.1 },
  decay: { min: 0, step: 0.1 },
  angle: { step: 0.01 },
  penumbra: { step: 0.01 },
  width: { min: 0.01, step: 0.1 },
  height: { min: 0.01, step: 0.1 },
  // Shadow maps are square powers of two; a free number here just invites a
  // resolution the GPU will round anyway.
  mapSize: { options: [512, 1024, 2048, 4096] },
  bias: { step: 0.0001 },
  normalBias: { step: 0.001 },
  radius: { min: 0, step: 0.5 },
  near: { min: 0.01, step: 0.1 },
  far: { min: 0.02, step: 1 },
}

const VECTOR_UI: Control = { step: 0.1 }

/**
 * Fields the outliner owns. They identify a light rather than describe its
 * lighting, and a row that both names a light and is the thing you click is
 * clearer than a name box somewhere else.
 */
const IN_OUTLINER = new Set(['name', 'enabled'])

const SHADOW_FOLDER = 'shadow'
const FRUSTUM_FOLDER = 'frustum'

/** Each side with its slot in `ShadowFrustum`, so the order is stated once. */
const FRUSTUM_SIDES = [
  ['left', 0],
  ['right', 1],
  ['top', 2],
  ['bottom', 3],
] as const

export function fieldsFor(type: LightType): Field[] {
  const definition = LIGHT_DEFINITIONS[type]
  const clamps: Record<string, [number, number]> = definition.clamp ?? {}
  const fields: Field[] = []

  for (const [key, fallback] of entriesOf(definition.defaults)) {
    if (IN_OUTLINER.has(key)) continue

    if (key === 'shadow') {
      fields.push(...shadowFields(fallback as ShadowConfig))
      continue
    }

    const control = controlFor(key, fallback, clamps[key])
    if (!control) continue

    fields.push({
      key,
      path: [],
      input: (light) => ({ ...control, value: propertyOf(light, key) }),
      read: (light) => propertyOf(light, key) as FieldValue,
      patch: (_light, value) => ({ [key]: value }) as LightPatch,
    })
  }

  return fields
}

function shadowFields(fallback: ShadowConfig): Field[] {
  const fields: Field[] = []

  for (const [key, value] of entriesOf(fallback)) {
    if (key === 'frustum') {
      fields.push(...frustumFields())
      continue
    }

    const control = controlFor(key, value)
    if (!control) continue

    fields.push({
      key: `shadow-${key}`,
      path: [SHADOW_FOLDER],
      input: (light) => ({ ...control, label: key, value: shadowOf(light)[key] }),
      read: (light) => shadowOf(light)[key] as FieldValue,
      patch: (light, next) => ({ shadow: { ...shadowOf(light), [key]: next } }) as LightPatch,
    })
  }

  return fields
}

/**
 * The orthographic shadow camera's bounds. Leva's vector inputs are 2- and
 * 3-component, so a four-tuple becomes four numbers rather than one control.
 */
function frustumFields(): Field[] {
  return FRUSTUM_SIDES.map(([side, index]) => ({
    key: `frustum-${side}`,
    path: [SHADOW_FOLDER, FRUSTUM_FOLDER],
    input: (light: LightConfig) => ({ step: 0.5, label: side, value: frustumOf(light)[index] }),
    read: (light: LightConfig) => frustumOf(light)[index],
    patch: (light: LightConfig, value: FieldValue) => {
      const frustum = [...frustumOf(light)] as ShadowFrustum
      frustum[index] = value as number
      return { shadow: { ...shadowOf(light), frustum } } as LightPatch
    },
  }))
}

/**
 * Picks a control from the shape of the field's default. Returns null for a
 * shape with no control, so a field added to the schema without one is left
 * out of the panel rather than crashing it.
 */
function controlFor(key: string, fallback: unknown, clamp?: [number, number]): Control | null {
  if (typeof fallback === 'boolean' || typeof fallback === 'string') return {}

  if (typeof fallback === 'number') {
    const range = clamp ? { min: clamp[0], max: clamp[1] } : {}
    return { ...NUMBER_UI[key], ...range }
  }

  // Positions and targets. Colours are strings, and leva recognises them by
  // their value, so they need nothing here.
  if (Array.isArray(fallback) && fallback.length === 3) return { ...VECTOR_UI }

  return null
}

/**
 * The config types are a union keyed by `type`, so a key only known at runtime
 * cannot index them, and a patch built from one cannot be narrowed back to a
 * member. Both casts are contained here and in the `patch` builders above.
 */
function propertyOf(light: LightConfig, key: string): unknown {
  return (light as unknown as Record<string, unknown>)[key]
}

function entriesOf(record: object): [string, unknown][] {
  return Object.entries(record)
}

/** Only reached for the types whose definition has a shadow, so it is present. */
function shadowOf(light: LightConfig): Record<string, unknown> {
  return propertyOf(light, 'shadow') as Record<string, unknown>
}

function frustumOf(light: LightConfig): ShadowFrustum {
  return shadowOf(light).frustum as ShadowFrustum
}
