export { LightStudio, type LightStudioProps } from './runtime/LightStudio'
export { type EnvironmentSlotProps } from './runtime/slots'
export { type ToggleKey } from './runtime/toggleKey'

export { parseSetup, type ParseResult } from './core/parse'
export { serializeSetup } from './core/serialize'

export {
  ENVIRONMENT_DEFAULTS,
  ENVIRONMENT_ID,
  ENVIRONMENT_PRESETS,
  LIGHT_DEFINITIONS,
  LIGHT_TYPES,
  LIGHTFORMER_FORMS,
  SCHEMA_VERSION,
  type AmbientLightConfig,
  type DirectionalLightConfig,
  type EnvironmentBackground,
  type EnvironmentConfig,
  type EnvironmentGround,
  type EnvironmentPreset,
  type HemisphereLightConfig,
  type LightConfig,
  type LightformerConfig,
  type LightformerForm,
  type LightPatch,
  type LightSetup,
  type LightType,
  type OrthographicShadowConfig,
  type PointLightConfig,
  type RectAreaLightConfig,
  type ShadowConfig,
  type ShadowFrustum,
  type SpotLightConfig,
  type Vec3,
} from './core/schema'
