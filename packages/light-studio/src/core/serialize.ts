import {
  ENVIRONMENT_DEFAULTS,
  LIGHT_DEFINITIONS,
  SCHEMA_VERSION,
  type LightConfig,
  type LightSetup,
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
 * Everything in `source` that differs from `defaults`, and nothing else.
 *
 * Iterates the defaults' keys rather than the source's, so a stray property
 * picked up somewhere along the way can never reach the file. A group whose
 * every member is a default is left out whole — an untouched `shadow` or
 * `ground` is a key that never appears.
 */
function stripAgainst(source: UnknownRecord, defaults: UnknownRecord): UnknownRecord {
  const out: UnknownRecord = {}

  for (const [key, fallback] of Object.entries(defaults)) {
    const value = source[key]

    if (isRecord(fallback)) {
      const nested = stripAgainst(isRecord(value) ? value : {}, fallback)
      if (Object.keys(nested).length > 0) out[key] = nested
      continue
    }

    if (!isUnchanged(value, fallback)) out[key] = value
  }

  return out
}

function stripDefaults(light: LightConfig): UnknownRecord {
  return {
    id: light.id,
    type: light.type,
    ...stripAgainst(light as UnknownRecord, LIGHT_DEFINITIONS[light.type].defaults),
  }
}

/**
 * Writes only what was actually authored, so diffs stay small and defaults
 * remain free to change without rewriting existing files.
 *
 * The environment goes the same way and one step further: a rig that never
 * touched it writes no `environment` key at all, rather than an empty object
 * in every file in the project.
 */
export function serializeSetup(setup: LightSetup, threeVersion?: string): UnknownRecord {
  const environment = stripAgainst(
    setup.environment as unknown as UnknownRecord,
    ENVIRONMENT_DEFAULTS as unknown as UnknownRecord,
  )

  return {
    version: SCHEMA_VERSION,
    meta: {
      ...(threeVersion ? { three: threeVersion } : {}),
      generator: 'r3f-light-studio',
    },
    ...(Object.keys(environment).length > 0 ? { environment } : {}),
    lights: setup.lights.map(stripDefaults),
  }
}
