import {
  DEFAULT_RENDERER,
  LIGHT_DEFINITIONS,
  SCHEMA_VERSION,
  type LightConfig,
  type LightSetup,
  type RendererConfig,
} from './schema'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUnchanged(value: unknown, fallback: unknown): boolean {
  if (Array.isArray(value) && Array.isArray(fallback)) {
    return value.length === fallback.length && value.every((v, i) => Object.is(v, fallback[i]))
  }
  return Object.is(value, fallback)
}

/**
 * Iterates the definition's keys rather than the light's, so a stray property
 * picked up somewhere along the way can never reach the file.
 */
function stripDefaults(light: LightConfig): UnknownRecord {
  const defaults = LIGHT_DEFINITIONS[light.type].defaults
  const source = light as UnknownRecord
  const out: UnknownRecord = { id: light.id, type: light.type }

  for (const [key, fallback] of Object.entries(defaults)) {
    const value = source[key]

    if (isRecord(fallback)) {
      const nested: UnknownRecord = {}
      const nestedSource = isRecord(value) ? value : {}
      for (const [nestedKey, nestedFallback] of Object.entries(fallback)) {
        if (!isUnchanged(nestedSource[nestedKey], nestedFallback)) {
          nested[nestedKey] = nestedSource[nestedKey]
        }
      }
      if (Object.keys(nested).length > 0) out[key] = nested
      continue
    }

    if (!isUnchanged(value, fallback)) out[key] = value
  }

  return out
}

function isDefaultRenderer(renderer: RendererConfig | undefined): boolean {
  if (!renderer) return true
  return (
    renderer.toneMapping === DEFAULT_RENDERER.toneMapping &&
    renderer.exposure === DEFAULT_RENDERER.exposure
  )
}

/**
 * Writes only what was actually authored, so diffs stay small and defaults
 * remain free to change without rewriting existing files.
 */
export function serializeSetup(setup: LightSetup, threeVersion?: string): UnknownRecord {
  return {
    version: SCHEMA_VERSION,
    meta: {
      ...(threeVersion ? { three: threeVersion } : {}),
      generator: 'r3f-light-studio',
    },
    ...(isDefaultRenderer(setup.renderer) ? {} : { renderer: setup.renderer }),
    lights: setup.lights.map(stripDefaults),
  }
}
