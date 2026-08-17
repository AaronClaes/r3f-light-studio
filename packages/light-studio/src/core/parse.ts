import { isFiniteNumber, isRecord, type UnknownRecord } from './json'
import { uniqueId } from './lights'
import {
  ENVIRONMENT_DEFAULTS,
  ENVIRONMENT_ID,
  ENVIRONMENT_OPTIONS,
  LIGHT_DEFINITIONS,
  SCHEMA_VERSION,
  type EnvironmentConfig,
  type LightConfig,
  type LightSetup,
  type LightType,
} from './schema'

export interface ParseResult {
  setup: LightSetup
  /** Recoverable problems. Fatal input yields an empty setup plus one issue. */
  issues: string[]
}

const COLOR_FIELDS = new Set(['color', 'groundColor'])

const HEX = /^#[0-9a-f]{6}$/i
const SHORT_HEX = /^#[0-9a-f]{3}$/i

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

/** The default's runtime type is the schema. */
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

/** Runs after `coerceField`, so a value that fails here was spelled out on purpose. */
function applyOptions(
  target: UnknownRecord,
  options: Record<string, readonly string[]>,
  defaults: UnknownRecord,
  where: string,
  issues: string[],
): void {
  for (const [key, allowed] of Object.entries(options)) {
    const value = target[key]
    if (typeof value === 'string' && allowed.includes(value)) continue

    issues.push(
      `${where}: ${JSON.stringify(value)} is not a ${key} this build knows — using ${JSON.stringify(defaults[key])}.`,
    )
    target[key] = defaults[key]
  }
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

  if (definition.options) {
    applyOptions(light, definition.options, definition.defaults, `lights[${index}]`, issues)
  }

  return light as LightConfig
}

/** Absent means every default, not "no environment". */
function parseEnvironment(raw: unknown, issues: string[]): EnvironmentConfig {
  const source = isRecord(raw) ? raw : {}
  const out: UnknownRecord = {}

  for (const [key, fallback] of Object.entries(ENVIRONMENT_DEFAULTS)) {
    out[key] = coerceField(key, source[key], fallback)
  }

  applyOptions(
    out,
    ENVIRONMENT_OPTIONS,
    ENVIRONMENT_DEFAULTS as unknown as UnknownRecord,
    'environment',
    issues,
  )

  return out as unknown as EnvironmentConfig
}

/** Legal files that still do not do what they look like. */
function checkEnvironment(
  environment: EnvironmentConfig,
  lights: LightConfig[],
  issues: string[],
): void {
  const lightformers = lights.filter((light) => light.type === 'lightformer').length

  if (environment.ground.enabled && environment.preset === '' && environment.files === '') {
    issues.push(
      'Ground projection has nothing to project: it needs the environment to have a `preset` or `files`.',
    )
  }

  if (lightformers === 0) return

  const source = `${lightformers} lightformer${lightformers === 1 ? '' : 's'}`

  // drei's <Environment> picks one branch from the props it was given, and
  // `ground` is first: it renders the dome and drops the children.
  if (environment.ground.enabled) {
    issues.push(
      `Ground projection replaces ${source}: drei's <Environment> renders one or the other. Turn the environment's ground off to see them.`,
    )
  }

  if (!environment.enabled) {
    issues.push(`The environment is switched off, so ${source} will not light anything.`)
  }
}

/** Never throws: malformed input yields issues and defaults. */
export function parseSetup(input: unknown): ParseResult {
  const issues: string[] = []

  if (!isRecord(input)) {
    return {
      setup: {
        version: SCHEMA_VERSION,
        environment: structuredClone(ENVIRONMENT_DEFAULTS),
        lights: [],
      },
      issues: ['Setup must be an object.'],
    }
  }

  const version = isFiniteNumber(input.version) ? input.version : SCHEMA_VERSION
  if (version > SCHEMA_VERSION) {
    issues.push(
      `Setup is version ${version} but this build understands ${SCHEMA_VERSION}. Unknown fields will be dropped on export.`,
    )
  }

  // An older build's file can still carry one, and the next save would quietly
  // delete settings someone committed on purpose.
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
  // Seeded with the environment's id, so `uniqueId` moves a light out of its way.
  const seen = new Set<string>([ENVIRONMENT_ID])

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
        light.id === ENVIRONMENT_ID
          ? `lights[${index}]: ${JSON.stringify(ENVIRONMENT_ID)} is reserved for the environment — renamed to ${JSON.stringify(id)}.`
          : `Duplicate light id ${JSON.stringify(light.id)} — renamed to ${JSON.stringify(id)}.`,
      )
      light.id = id
    }
    seen.add(id)
    lights.push(light)
  }

  const environment = parseEnvironment(input.environment, issues)
  checkEnvironment(environment, lights, issues)

  return {
    setup: {
      version: SCHEMA_VERSION,
      ...(isRecord(input.meta) ? { meta: input.meta as LightSetup['meta'] } : {}),
      environment,
      lights,
    },
    issues,
  }
}
