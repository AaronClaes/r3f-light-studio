/**
 * The on-disk format.
 *
 * Each light type is described exactly once, in `LIGHT_DEFINITIONS`. Its
 * TypeScript type, the parser's coercion, the serialiser's default-stripping
 * and (later) the editor's field list all derive from that one object, so
 * adding a light type means editing a single place.
 */

export const SCHEMA_VERSION = 1

export type Vec3 = [x: number, y: number, z: number]

/** Orthographic shadow-camera bounds. */
export type ShadowFrustum = [left: number, right: number, top: number, bottom: number]

export interface ShadowConfig {
  enabled: boolean
  /** Square shadow map resolution, in pixels. */
  mapSize: number
  bias: number
  normalBias: number
  radius: number
  near: number
  far: number
}

/** Directional lights project shadows through an orthographic camera. */
export interface OrthographicShadowConfig extends ShadowConfig {
  frustum: ShadowFrustum
}

const SHADOW: ShadowConfig = {
  enabled: false,
  mapSize: 1024,
  bias: -0.0001,
  normalBias: 0.02,
  radius: 1,
  near: 0.5,
  far: 60,
}

const ORTHOGRAPHIC_SHADOW: OrthographicShadowConfig = {
  ...SHADOW,
  frustum: [-10, 10, 10, -10],
}

const COMMON = { name: '', enabled: true, color: '#ffffff' }

interface LightDefinition<Defaults extends Record<string, unknown>> {
  label: string
  /** Doubles as the field list: a light has exactly these keys, plus id and type. */
  defaults: Defaults
  /** Inclusive ranges for fields three misbehaves outside of. */
  clamp?: Record<string, [min: number, max: number]>
}

/** Preserves the exact shape of `defaults` while typing `clamp` uniformly. */
function define<Defaults extends Record<string, unknown>>(
  definition: LightDefinition<Defaults>,
): LightDefinition<Defaults> {
  return definition
}

/**
 * Intensities assume physically-correct lighting (three >= r155), which is why
 * point and spot values are in the tens rather than around 1.
 */
export const LIGHT_DEFINITIONS = {
  ambient: define({
    label: 'Ambient',
    defaults: { ...COMMON, intensity: 0.3 },
  }),

  hemisphere: define({
    label: 'Hemisphere',
    defaults: {
      ...COMMON,
      intensity: 1,
      /** Direction of the sky colour, normalised by three. Not a location. */
      position: [0, 1, 0] as Vec3,
      groundColor: '#444444',
    },
  }),

  directional: define({
    label: 'Directional',
    defaults: {
      ...COMMON,
      intensity: 1,
      position: [5, 5, 5] as Vec3,
      target: [0, 0, 0] as Vec3,
      shadow: ORTHOGRAPHIC_SHADOW,
    },
  }),

  point: define({
    label: 'Point',
    defaults: {
      ...COMMON,
      intensity: 10,
      position: [0, 2, 0] as Vec3,
      /** 0 means no cutoff. */
      distance: 0,
      decay: 2,
      shadow: SHADOW,
    },
  }),

  spot: define({
    label: 'Spot',
    defaults: {
      ...COMMON,
      intensity: 20,
      position: [0, 4, 0] as Vec3,
      target: [0, 0, 0] as Vec3,
      distance: 0,
      decay: 2,
      /** Cone half-angle in radians. */
      angle: Math.PI / 6,
      penumbra: 0.2,
      shadow: SHADOW,
    },
    clamp: { angle: [0, Math.PI / 2], penumbra: [0, 1] },
  }),

  rectArea: define({
    label: 'Rect area',
    defaults: {
      ...COMMON,
      intensity: 5,
      position: [0, 2, 2] as Vec3,
      target: [0, 0, 0] as Vec3,
      width: 2,
      height: 2,
    },
  }),
}

export type LightType = keyof typeof LIGHT_DEFINITIONS

/**
 * Every type, in the order they are defined above, which is also the order the
 * add menu offers them. Derived rather than written out, so a seventh light
 * type appears in the menu by being defined.
 */
export const LIGHT_TYPES = Object.keys(LIGHT_DEFINITIONS) as LightType[]

/** The fields a light can expose as a point you drag. Not every type has both. */
export type VectorField = 'position' | 'target'

type ConfigFor<T extends LightType> = {
  /** Stable across exports and readable in a diff. Never an array index. */
  id: string
  type: T
} & (typeof LIGHT_DEFINITIONS)[T]['defaults']

export type AmbientLightConfig = ConfigFor<'ambient'>
export type HemisphereLightConfig = ConfigFor<'hemisphere'>
export type DirectionalLightConfig = ConfigFor<'directional'>
export type PointLightConfig = ConfigFor<'point'>
export type SpotLightConfig = ConfigFor<'spot'>
export type RectAreaLightConfig = ConfigFor<'rectArea'>

export type LightConfig = { [T in LightType]: ConfigFor<T> }[LightType]

/** `Omit` collapses a union to its shared keys; this keeps the members apart. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * A partial update to one light. Because it distributes, `{ angle: 0.4 }` is
 * accepted for a spot light but there is no member that also has `groundColor`.
 */
export type LightPatch = Partial<DistributiveOmit<LightConfig, 'id' | 'type'>>

/**
 * The rig, and nothing else.
 *
 * Tone mapping and exposure used to live here and no longer do: they are the
 * renderer's, which belongs to `<Canvas>`. Two owners of `gl.toneMapping` is a
 * conflict a lighting rig cannot win — see the note in `LightStudio`.
 */
export interface LightSetup {
  version: number
  meta?: {
    three?: string
    generator?: string
  }
  lights: LightConfig[]
}
