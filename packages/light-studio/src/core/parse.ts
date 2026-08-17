import { uniqueId } from './lights'
import {
  LIGHT_DEFINITIONS,
  SCHEMA_VERSION,
  type LightConfig,
  type LightSetup,
  type LightType,
} from './schema'

export interface ParseResult {
  setup: LightSetup
  /** Recoverable problems. Fatal input yields an empty setup plus one issue. */
  issues: string[]
}

type UnknownRecord = Record<string, unknown>

/** String fields that must hold a hex colour rather than arbitrary text. */
const COLOR_FIELDS = new Set(['color', 'groundColor'])

const HEX = /^#[0-9a-f]{6}$/i
const SHORT_HEX = /^#[0-9a-f]{3}$/i

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  const expanded = SHORT_HEX.test(trimmed)
    ? `#${trimmed
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')}`
    : trimmed
  return HEX.test(expanded) ? expanded.toLowerCase() : fallback
}

/**
 * Coerces one field against its default. The default's runtime type is the
 * schema — a number default means the field must be a finite number, an array
 * default fixes the length, a record default recurses.
 */
function coerceField(key: string, value: unknown, fallback: unknown): unknown {
  if (typeof fallback === 'number') return isFiniteNumber(value) ? value : fallback

  if (typeof fallback === 'boolean') return typeof value === 'boolean' ? value : fallback

  if (typeof fallback === 'string') {
    if (COLOR_FIELDS.has(key)) return hexColor(value, fallback)
    return typeof value === 'string' && value.length > 0 ? value : fallback
  }

  if (Array.isArray(fallback)) {
    if (!Array.isArray(value) || value.length !== fallback.length) return [...fallback]
    return fallback.map((item, index) => (isFiniteNumber(value[index]) ? value[index] : item))
  }

  if (isRecord(fallback)) {
    const source = isRecord(value) ? value : {}
    const out: UnknownRecord = {}
    for (const [nestedKey, nestedFallback] of Object.entries(fallback)) {
      out[nestedKey] = coerceField(nestedKey, source[nestedKey], nestedFallback)
    }
    return out
  }

  return fallback
}

function isLightType(value: unknown): value is LightType {
  return typeof value === 'string' && value in LIGHT_DEFINITIONS
}

function parseLight(raw: UnknownRecord, index: number, issues: string[]): LightConfig | null {
  const type = raw.type
  if (!isLightType(type)) {
    issues.push(`lights[${index}]: unknown light type ${JSON.stringify(type)} — skipped.`)
    return null
  }

  const definition = LIGHT_DEFINITIONS[type]

  let id: string
  if (typeof raw.id === 'string' && raw.id.length > 0) {
    id = raw.id
  } else {
    id = type
    issues.push(`lights[${index}]: missing id — using ${JSON.stringify(id)}.`)
  }

  const light: UnknownRecord = { id, type }
  for (const [key, fallback] of Object.entries(definition.defaults)) {
    light[key] = coerceField(key, raw[key], fallback)
  }

  for (const [key, [min, max]] of Object.entries(definition.clamp ?? {})) {
    const value = light[key]
    if (isFiniteNumber(value)) light[key] = Math.min(max, Math.max(min, value))
  }

  return light as LightConfig
}

/**
 * Turns a JSON import, a hand-edited file or an older export into a fully
 * populated setup. Never throws — malformed input yields issues and defaults.
 */
export function parseSetup(input: unknown): ParseResult {
  const issues: string[] = []

  if (!isRecord(input)) {
    return {
      setup: { version: SCHEMA_VERSION, lights: [] },
      issues: ['Setup must be an object.'],
    }
  }

  const version = isFiniteNumber(input.version) ? input.version : SCHEMA_VERSION
  if (version > SCHEMA_VERSION) {
    issues.push(
      `Setup is version ${version} but this build understands ${SCHEMA_VERSION}. Unknown fields will be dropped on export.`,
    )
  }

  // Said out loud rather than dropped in silence. A file written by an older
  // build can still carry one, and the next save would quietly delete settings
  // someone committed on purpose — while the scene kept using them, because
  // whatever `<Canvas>` says is still in force.
  if (input.renderer !== undefined) {
    issues.push(
      '`renderer` is no longer part of a setup and will be dropped on the next save. Tone mapping and exposure belong to <Canvas gl={{ ... }} />.',
    )
  }

  if (!Array.isArray(input.lights)) {
    issues.push('`lights` is missing or not an array — treating the setup as empty.')
  }
  const rawLights = Array.isArray(input.lights) ? input.lights : []

  const lights: LightConfig[] = []
  const seen = new Set<string>()

  for (const [index, raw] of rawLights.entries()) {
    if (!isRecord(raw)) {
      issues.push(`lights[${index}]: not an object — skipped.`)
      continue
    }

    const light = parseLight(raw, index, issues)
    if (!light) continue

    const id = uniqueId(light.id, seen)
    if (id !== light.id) {
      issues.push(
        `Duplicate light id ${JSON.stringify(light.id)} — renamed to ${JSON.stringify(id)}.`,
      )
      light.id = id
    }
    seen.add(id)
    lights.push(light)
  }

  return {
    setup: {
      version: SCHEMA_VERSION,
      ...(isRecord(input.meta) ? { meta: input.meta as LightSetup['meta'] } : {}),
      lights,
    },
    issues,
  }
}
