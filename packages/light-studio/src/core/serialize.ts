import { isRecord, type UnknownRecord } from './json'
import {
  ENVIRONMENT_DEFAULTS,
  LIGHT_DEFINITIONS,
  SCHEMA_VERSION,
  type LightConfig,
  type LightSetup,
} from './schema'

function isUnchanged(value: unknown, fallback: unknown): boolean {
  if (Array.isArray(value) && Array.isArray(fallback)) {
    return value.length === fallback.length && value.every((v, i) => Object.is(v, fallback[i]))
  }
  return Object.is(value, fallback)
}

/** Iterates the defaults' keys, so a stray property can never reach the file. */
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

/** Writes only what was authored, so diffs stay small and defaults stay free to change. */
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
