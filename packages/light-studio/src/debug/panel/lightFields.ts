import {
  LIGHT_DEFINITIONS,
  LIGHT_TYPES,
  type LightConfig,
  type LightEdit,
  type LightPatch,
  type LightType,
  type ShadowConfig,
  type ShadowFrustum,
} from '../../core/schema'
import {
  controlFor,
  entriesOf,
  isVector,
  propertyOf,
  type Control,
  type Field,
  type FieldValue,
} from './controls'

/** What the panel shows for a light, derived from `LIGHT_DEFINITIONS`. */

type LightField = Field<LightConfig, LightEdit>

/** Feel, not validation. The hard ranges are `LIGHT_DEFINITIONS.clamp`. */
const NUMBER_UI: Record<string, Control> = {
  intensity: { min: 0, step: 0.1 },
  distance: { min: 0, step: 0.1 },
  decay: { min: 0, step: 0.1 },
  angle: { step: 0.01 },
  penumbra: { step: 0.01 },
  width: { min: 0.01, step: 0.1 },
  height: { min: 0.01, step: 0.1 },
  // A free number invites a resolution the GPU will round anyway.
  mapSize: { options: [512, 1024, 2048, 4096] },
  bias: { step: 0.0001 },
  normalBias: { step: 0.001 },
  radius: { min: 0, step: 0.5 },
  near: { min: 0.01, step: 0.1 },
  far: { min: 0.02, step: 1 },
}

/** The outliner's: they identify a light rather than describe it. */
const IN_OUTLINER = new Set(['name', 'enabled'])

const TRANSFORM_FOLDER = 'transform'
const SHADOW_FOLDER = 'shadow'
const FRUSTUM_FOLDER = 'frustum'
/** Reads as a light property at the top level, where `enabled` would not. */
const SHADOW_TOGGLE_LABEL = 'shadows'

/** What the light is, then what it emits, then what it casts, then where it is. */
const GROUP = {
  type: 0,
  lighting: 100,
  shadows: 1000,
  shadow: 2000,
  frustum: 2500,
  transform: 3000,
}

/** Label to value, which is the only form leva reads as a menu. */
const TYPE_OPTIONS = Object.fromEntries(
  LIGHT_TYPES.map((type) => [LIGHT_DEFINITIONS[type].label, type]),
)

/** The one control that replaces the light rather than patching it. */
const TYPE_FIELD: LightField = {
  key: 'type',
  path: [],
  order: GROUP.type,
  input: (light) => ({ options: TYPE_OPTIONS, value: light.type }),
  read: (light) => light.type,
  patch: (_light, value) => ({ type: value as LightType }),
}

/** Each side with its slot in `ShadowFrustum`. */
const FRUSTUM_SIDES = [
  ['left', 0],
  ['right', 1],
  ['top', 2],
  ['bottom', 3],
] as const

export function fieldsFor(type: LightType): LightField[] {
  const definition = LIGHT_DEFINITIONS[type]
  const clamps: Record<string, [number, number]> = definition.clamp ?? {}

  const lighting: LightField[] = []
  const shadow: LightField[] = []
  const transform: LightField[] = []

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

    // By shape: a hemisphere light's `position` is a direction rather than a
    // place, but it is still the vector the gizmo moves.
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

  return [TYPE_FIELD, ...lighting, ...shadow, ...transform]
}

function shadowFields(fallback: ShadowConfig): LightField[] {
  const fields: LightField[] = []

  for (const [key, value] of entriesOf(fallback)) {
    if (key === 'frustum') {
      fields.push(...frustumFields())
      continue
    }

    const control = controlFor(key, value, { ui: NUMBER_UI })
    if (!control) continue

    // Above the folder, because a collapsed folder hides it and leva folders
    // take their title from their key, so there is nowhere else to put it.
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

/** Leva's vector inputs are 2- and 3-component, so a four-tuple becomes four numbers. */
function frustumFields(): LightField[] {
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

/** Only reached for types whose definition has a shadow. */
function shadowOf(light: LightConfig): Record<string, unknown> {
  return propertyOf(light, 'shadow') as Record<string, unknown>
}

function frustumOf(light: LightConfig): ShadowFrustum {
  return shadowOf(light).frustum as ShadowFrustum
}
