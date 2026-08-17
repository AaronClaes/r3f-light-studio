/** The on-disk format. Every light type is described once, in `LIGHT_DEFINITIONS`. */

export const SCHEMA_VERSION = 1

export type Vec3 = [x: number, y: number, z: number]

export type ShadowFrustum = [left: number, right: number, top: number, bottom: number]

export interface ShadowConfig {
  enabled: boolean
  /** Square, in pixels. */
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
  /** Every value the field may hold. Drives both the parser and the panel's menu. */
  options?: Record<string, readonly string[]>
}

/** drei also takes `plane` (the same geometry as `rect`) and any component. Neither is JSON. */
export const LIGHTFORMER_FORMS = ['rect', 'circle', 'ring', 'box'] as const

export type LightformerForm = (typeof LIGHTFORMER_FORMS)[number]

/** Preserves the exact shape of `defaults` while typing `clamp` uniformly. */
function define<Defaults extends Record<string, unknown>>(
  definition: LightDefinition<Defaults>,
): LightDefinition<Defaults> {
  return definition
}

/** Intensities assume physically-correct lighting (three >= r155). */
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
      /** Sky direction, normalised by three. Not a location. */
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
      /** Cone half-angle, in radians. */
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

  /** Not a three light: an emissive mesh drawn into the environment's cube map. */
  lightformer: define({
    label: 'Lightformer',
    defaults: {
      ...COMMON,
      intensity: 2,
      position: [0, 3, 3] as Vec3,
      target: [0, 0, 0] as Vec3,
      width: 4,
      height: 4,
      form: 'rect' as LightformerForm,
      /** Off, matching drei. Tone mapping a source crushes the highlight it makes. */
      toneMapped: false,
    },
    options: { form: LIGHTFORMER_FORMS },
  }),
}

export type LightType = keyof typeof LIGHT_DEFINITIONS

/** Definition order, which is also the add menu's. */
export const LIGHT_TYPES = Object.keys(LIGHT_DEFINITIONS) as LightType[]

/** The fields a light can expose as a draggable point. Not every type has both. */
export type VectorField = 'position' | 'target'

type ConfigFor<T extends LightType> = {
  /** Never an array index: it has to survive a reorder. */
  id: string
  type: T
} & (typeof LIGHT_DEFINITIONS)[T]['defaults']

export type AmbientLightConfig = ConfigFor<'ambient'>
export type HemisphereLightConfig = ConfigFor<'hemisphere'>
export type DirectionalLightConfig = ConfigFor<'directional'>
export type PointLightConfig = ConfigFor<'point'>
export type SpotLightConfig = ConfigFor<'spot'>
export type RectAreaLightConfig = ConfigFor<'rectArea'>
export type LightformerConfig = ConfigFor<'lightformer'>

export type LightConfig = { [T in LightType]: ConfigFor<T> }[LightType]

/** `Omit` collapses a union to its shared keys; this keeps the members apart. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** Distributes, so `{ angle }` is accepted but no member also has `groundColor`. */
export type LightPatch = Partial<DistributiveOmit<LightConfig, 'id' | 'type'>>

/** What the panel writes: fields, or the swap that replaces the light entirely. */
export type LightEdit = LightPatch | { type: LightType }

/** drei's hosted HDRIs. Written out, so the format does not move when drei ships an eleventh. */
export const ENVIRONMENT_PRESETS = [
  'apartment',
  'city',
  'dawn',
  'forest',
  'lobby',
  'night',
  'park',
  'studio',
  'sunset',
  'warehouse',
] as const

export type EnvironmentPreset = (typeof ENVIRONMENT_PRESETS)[number]

/** Projects the environment onto a dome, so the floor reflects it. */
export interface EnvironmentGround {
  enabled: boolean
  radius: number
  height: number
  scale: number
}

/**
 * The one place the rig writes outside the lights. An app cannot reproduce this
 * itself for a rig built out of lightformers: it has no access to their cube map.
 */
export interface EnvironmentBackground {
  enabled: boolean
  /** `scene.backgroundBlurriness`, 0 to 1. Above 0, three renders through PMREM. */
  blur: number
  /** `scene.backgroundIntensity`. */
  intensity: number
  /** `scene.backgroundRotation`, Euler radians. Turns the backdrop, not the lighting. */
  rotation: Vec3
}

export interface EnvironmentConfig {
  enabled: boolean
  /** Empty means none. */
  preset: '' | EnvironmentPreset
  /** A path or URL to an .hdr or .exr. Empty means none. Beats `preset`. */
  files: string
  /** `scene.environmentIntensity`. */
  intensity: number
  /** `scene.environmentRotation`, Euler radians. */
  rotation: Vec3
  /** Cube render-target size for the pass that draws the lightformers. */
  resolution: number
  background: EnvironmentBackground
  /** Does not layer with the rest: see `checkEnvironment`. */
  ground: EnvironmentGround
}

/** How the environment is addressed where a light would be addressed by its id. */
export const ENVIRONMENT_ID = 'environment'

export const ENVIRONMENT_DEFAULTS: EnvironmentConfig = {
  enabled: true,
  preset: '',
  files: '',
  intensity: 1,
  rotation: [0, 0, 0],
  resolution: 256,
  background: { enabled: false, blur: 0, intensity: 1, rotation: [0, 0, 0] },
  // three-stdlib's own numbers, restated so the file says what it does.
  ground: { enabled: false, radius: 100, height: 15, scale: 1000 },
}

/** `LightDefinition.options`, for the one config with no definition. */
export const ENVIRONMENT_OPTIONS: Record<string, readonly string[]> = {
  preset: ['', ...ENVIRONMENT_PRESETS],
}

/** Tone mapping and exposure are not here: they belong to `<Canvas>`. */
export interface LightSetup {
  version: number
  meta?: {
    three?: string
    generator?: string
  }
  environment: EnvironmentConfig
  lights: LightConfig[]
}
