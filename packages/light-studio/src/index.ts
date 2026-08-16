export { LightStudio, type LightStudioProps } from './runtime/LightStudio'
export { type ToggleKey } from './runtime/toggleKey'

export { parseSetup, type ParseResult } from './core/parse'
export { serializeSetup } from './core/serialize'

export {
  LIGHT_DEFINITIONS,
  SCHEMA_VERSION,
  type AmbientLightConfig,
  type DirectionalLightConfig,
  type HemisphereLightConfig,
  type LightConfig,
  type LightPatch,
  type LightSetup,
  type LightType,
  type OrthographicShadowConfig,
  type PointLightConfig,
  type RectAreaLightConfig,
  type RendererConfig,
  type ShadowConfig,
  type ShadowFrustum,
  type SpotLightConfig,
  type ToneMappingName,
  type Vec3,
} from './core/schema'
