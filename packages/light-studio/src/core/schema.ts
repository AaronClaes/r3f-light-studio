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
  /**
   * The complete set of values a string field may hold. The parser rejects
   * anything else back to the default and the panel shows a menu rather than
   * a text box — both from this one list.
   */
  options?: Record<string, readonly string[]>
}

/**
 * The shapes a lightformer can take.
 *
 * drei also accepts `plane`, which builds the same `planeGeometry` as `rect`,
 * and any component you pass it. Neither belongs in a file format: one is a
 * duplicate and the other is not serialisable.
 */
export const LIGHTFORMER_FORMS = ['rect', 'circle', 'ring', 'box'] as const

export type LightformerForm = (typeof LIGHTFORMER_FORMS)[number]

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

  /**
   * A shape that exists only inside the environment map.
   *
   * Not a three light at all: it is a flat emissive mesh rendered into the
   * environment's cube map, so what it lights is reflections and ambient
   * response rather than surfaces directly. That is what studio softboxes and
   * strip lights actually are, and what a rectArea light only approximates.
   *
   * Bigger and brighter by default than the real lights above, because that is
   * what it is for — a large soft source, not a lamp.
   */
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
      /**
       * Off, matching drei. A softbox is a light source rather than a surface,
       * and tone mapping one crushes exactly the highlight it exists to make.
       */
      toneMapped: false,
    },
    options: { form: LIGHTFORMER_FORMS },
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
export type LightformerConfig = ConfigFor<'lightformer'>

export type LightConfig = { [T in LightType]: ConfigFor<T> }[LightType]

/** `Omit` collapses a union to its shared keys; this keeps the members apart. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/**
 * A partial update to one light. Because it distributes, `{ angle: 0.4 }` is
 * accepted for a spot light but there is no member that also has `groundColor`.
 */
export type LightPatch = Partial<DistributiveOmit<LightConfig, 'id' | 'type'>>

/**
 * drei's ten hosted HDRIs, fetched from its CDN at runtime.
 *
 * Written out rather than imported from drei: this is the file format, and the
 * format should not change shape because a dependency shipped an eleventh sky.
 * A preset drei drops still parses, and warns.
 */
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
 * Showing the environment behind the scene, rather than only lighting with it.
 *
 * This is the one place the rig writes something outside the lights —
 * `scene.background` — and it earns it. Without it there is no way to ship a
 * rig's environment as a backdrop: an app would have to declare the same
 * `preset` a second time in its own `<Environment background="only" />`, which
 * then silently stops matching the moment you change it here. For a rig built
 * out of lightformers it is not merely duplicated but impossible, because the
 * app cannot reproduce the cube map they are drawn into.
 *
 * `blur`, `intensity` and `rotation` are `scene.backgroundBlurriness`,
 * `backgroundIntensity` and `backgroundRotation`. They are only sent to three
 * while `enabled` — see `EnvironmentRig` for why that matters.
 */
export interface EnvironmentBackground {
  enabled: boolean
  /** 0 to 1. Above 0, three renders the background through PMREM. */
  blur: number
  intensity: number
  /** Euler radians, turning the backdrop without turning the lighting. */
  rotation: Vec3
}

/**
 * The image-based light: what the scene sees in every direction.
 *
 * Three sources, and they layer. A `preset` or `files` supplies the sky, and
 * any `lightformer` in `lights` is drawn on top of it — which is the whole
 * point, since a lightformer is how you put a softbox in an HDRI you did not
 * shoot. `ground` is the exception and does not layer: see `parseSetup`.
 */
export interface EnvironmentConfig {
  enabled: boolean
  /** Empty means none. */
  preset: '' | EnvironmentPreset
  /** A path or URL to an .hdr or .exr. Empty means none. Beats `preset`. */
  files: string
  /** Scales the environment's contribution to lighting. `scene.environmentIntensity`. */
  intensity: number
  /** Euler radians. `scene.environmentRotation`. */
  rotation: Vec3
  /** Cube render-target size for the pass that draws the lightformers. */
  resolution: number
  background: EnvironmentBackground
  ground: EnvironmentGround
}

/**
 * How the environment is addressed where a light would be addressed by its id
 * — the outliner's selection, and the studio's solo list. A light may not take
 * it; `parseSetup` renames one that tries.
 */
export const ENVIRONMENT_ID = 'environment'

export const ENVIRONMENT_DEFAULTS: EnvironmentConfig = {
  enabled: true,
  preset: '',
  files: '',
  intensity: 1,
  rotation: [0, 0, 0],
  resolution: 256,
  // Off, and at three's own values for when it is on. A rig lights a scene by
  // default; showing itself is something you ask for.
  background: { enabled: false, blur: 0, intensity: 1, rotation: [0, 0, 0] },
  // three-stdlib's own numbers, restated so the file says what it does rather
  // than leaving three fields blank and hoping the library agrees.
  ground: { enabled: false, radius: 100, height: 15, scale: 1000 },
}

/** The same role `LightDefinition.options` plays, for the one config that has no definition. */
export const ENVIRONMENT_OPTIONS: Record<string, readonly string[]> = {
  preset: ['', ...ENVIRONMENT_PRESETS],
}

/**
 * The rig, and nothing else.
 *
 * Tone mapping and exposure used to live here and no longer do: they are the
 * renderer's, which belongs to `<Canvas>`. Two owners of `gl.toneMapping` is a
 * conflict a lighting rig cannot win — see the note in `LightStudio`.
 *
 * `environment` is not optional in memory and is usually absent on disk: it
 * strips to nothing when untouched, the way every other default does. An
 * environment with no preset, no files and no lightformers renders nothing at
 * all, so a rig that never asked for one never pays for one.
 */
export interface LightSetup {
  version: number
  meta?: {
    three?: string
    generator?: string
  }
  environment: EnvironmentConfig
  lights: LightConfig[]
}
