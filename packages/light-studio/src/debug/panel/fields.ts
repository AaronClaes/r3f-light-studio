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

/**
 * One control, and everything needed to keep it and the store in step.
 *
 * Generic in what it edits because the environment is not a light and needs
 * exactly the same treatment. Both default to the light case, which is most of
 * them.
 */
export interface Field<Subject = LightConfig, Patch = LightPatch> {
  /**
   * Unique across the whole panel, not just its folder. Leva maps a `set` call
   * by leaf key alone and ignores the folder the control sits in, so a
   * shadow's `bias` and a light's `bias` would be one control.
   */
  key: string
  /** Folder path, outermost first. Empty means top level. */
  path: string[]
  /**
   * Where it sits in the panel.
   *
   * Banded by group rather than counted off from the start of the list. Leva
   * keeps the settings a folder was first created with, and a folder takes its
   * order from the first field inside it — so "how many fields come before
   * this one" would leave the transform folder wherever some other light type
   * happened to put it. A point light has four fields before its transform, a
   * spot has six, and switching between them would shuffle the panel.
   */
  order: number
  /** The control, with its current value read off `subject`. */
  input: (subject: Subject) => Control
  read: (subject: Subject) => FieldValue
  /** The store update for a new value. Reads `subject` for fields it merges into. */
  patch: (subject: Subject, value: FieldValue) => Patch
}

/**
 * How each number reads in the panel. Steps, and the floors that are physical
 * rather than three's — these are feel, not validation. The only hard ranges
 * are `LIGHT_DEFINITIONS.clamp`, and those win.
 *
 * One table per subject rather than one for the studio: these are keyed by
 * leaf name, and a light's `height` in metres and a ground projection's in
 * tens of metres want nothing like the same step.
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

/**
 * Last in the panel, and collapsed. A light gets dragged with the gizmo far
 * more often than it gets typed, so these numbers are for reading an exact
 * value or nudging one by a known amount rather than for aiming — which puts
 * them below everything you actually reach for.
 */
const TRANSFORM_FOLDER = 'transform'

const SHADOW_FOLDER = 'shadow'
const FRUSTUM_FOLDER = 'frustum'
/** Reads as a light property at the top level, where `enabled` would not. */
const SHADOW_TOGGLE_LABEL = 'shadows'

/**
 * The bands the panel is laid out in: what the light emits, then what it
 * casts, then where it is. Spaced far enough apart that a group's own fields
 * can never run into the next one.
 */
const GROUP = {
  lighting: 0,
  shadows: 1000,
  shadow: 2000,
  frustum: 2500,
  transform: 3000,
}

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

  // Three groups. `GROUP` decides where each lands; the list is concatenated
  // to match so that reading this function tells you the shape of the panel.
  const lighting: Field[] = []
  const shadow: Field[] = []
  const transform: Field[] = []

  for (const [key, fallback] of entriesOf(definition.defaults)) {
    if (IN_OUTLINER.has(key)) continue

    if (key === 'shadow') {
      shadow.push(...shadowFields(fallback as ShadowConfig))
      continue
    }

    const control = controlFor(key, fallback, {
      ui: NUMBER_UI,
      clamp: clamps[key],
      options: definition.options?.[key],
    })
    if (!control) continue

    // Grouped by shape, the same way the control itself is chosen. A
    // hemisphere light's `position` is a sky direction rather than a place,
    // but it is still the vector the gizmo moves, so it belongs with them.
    const vector = isVector(fallback)
    const bucket = vector ? transform : lighting

    bucket.push({
      key,
      path: vector ? [TRANSFORM_FOLDER] : [],
      order: (vector ? GROUP.transform : GROUP.lighting) + bucket.length,
      input: (light) => ({ ...control, value: propertyOf(light, key) }),
      read: (light) => propertyOf(light, key) as FieldValue,
      patch: (_light, value) => ({ [key]: value }) as LightPatch,
    })
  }

  return [...lighting, ...shadow, ...transform]
}

function shadowFields(fallback: ShadowConfig): Field[] {
  const fields: Field[] = []

  for (const [key, value] of entriesOf(fallback)) {
    if (key === 'frustum') {
      fields.push(...frustumFields())
      continue
    }

    const control = controlFor(key, value, { ui: NUMBER_UI })
    if (!control) continue

    // Whether a light casts at all sits above the folder rather than inside
    // it. It is the one shadow field you want to read at a glance, and a
    // collapsed folder hides it — leva folders take their title from their
    // key and have no label, so there is nowhere to put it in the header.
    // Everything else in here is tuning you only look at once you care.
    const tuning = key !== 'enabled'

    fields.push({
      key: `shadow-${key}`,
      path: tuning ? [SHADOW_FOLDER] : [],
      order: tuning ? GROUP.shadow + fields.length : GROUP.shadows,
      input: (light) => ({
        ...control,
        label: tuning ? key : SHADOW_TOGGLE_LABEL,
        value: shadowOf(light)[key],
      }),
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
    order: GROUP.frustum + index,
    input: (light: LightConfig) => ({ step: 0.5, label: side, value: frustumOf(light)[index] }),
    read: (light: LightConfig) => frustumOf(light)[index],
    patch: (light: LightConfig, value: FieldValue) => {
      const frustum = [...frustumOf(light)] as ShadowFrustum
      frustum[index] = value as number
      return { shadow: { ...shadowOf(light), frustum } } as LightPatch
    },
  }))
}

export interface ControlContext {
  /** Step sizes and menus, keyed by field name. See `NUMBER_UI`. */
  ui: Record<string, Control>
  clamp?: [number, number]
  /** The complete set of values the field may hold, which makes it a menu. */
  options?: readonly string[]
}

/**
 * Picks a control from the shape of the field's default. Returns null for a
 * shape with no control, so a field added to the schema without one is left
 * out of the panel rather than crashing it.
 */
export function controlFor(
  key: string,
  fallback: unknown,
  context: ControlContext,
): Control | null {
  if (typeof fallback === 'string') {
    // Colours are strings too, and leva recognises those by their value, so a
    // field with no fixed set of values needs nothing here.
    return context.options ? menuFor(context.options) : {}
  }

  if (typeof fallback === 'boolean') return {}

  if (typeof fallback === 'number') {
    const range = context.clamp ? { min: context.clamp[0], max: context.clamp[1] } : {}
    return { ...context.ui[key], ...range }
  }

  // A vector reads from the same table as a number does, so a rotation in
  // radians can ask for a finer step than a position in metres.
  if (isVector(fallback)) return { ...VECTOR_UI, ...context.ui[key] }

  return null
}

/**
 * Leva reads a record of options as label to value, which is the only form
 * that can show the empty string as something other than a blank row.
 */
function menuFor(allowed: readonly string[]): Control {
  return {
    options: Object.fromEntries(allowed.map((value) => [value === '' ? 'none' : value, value])),
  }
}

/** A position or a target: the three-component fields the gizmo can move. */
export function isVector(fallback: unknown): boolean {
  return Array.isArray(fallback) && fallback.length === 3
}

/**
 * The config types are a union keyed by `type`, so a key only known at runtime
 * cannot index them, and a patch built from one cannot be narrowed back to a
 * member. Both casts are contained here and in the `patch` builders above.
 */
export function propertyOf(subject: object, key: string): unknown {
  return (subject as Record<string, unknown>)[key]
}

export function entriesOf(record: object): [string, unknown][] {
  return Object.entries(record)
}

/** Only reached for the types whose definition has a shadow, so it is present. */
function shadowOf(light: LightConfig): Record<string, unknown> {
  return propertyOf(light, 'shadow') as Record<string, unknown>
}

function frustumOf(light: LightConfig): ShadowFrustum {
  return shadowOf(light).frustum as ShadowFrustum
}
