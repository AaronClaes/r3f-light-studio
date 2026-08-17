import { isRecord } from './json'
import { LIGHT_DEFINITIONS, type LightConfig, type LightSetup, type LightType } from './schema'

export function createLight<T extends LightType>(
  type: T,
  id: string,
): Extract<LightConfig, { type: T }> {
  return {
    id,
    type,
    ...structuredClone(LIGHT_DEFINITIONS[type].defaults),
  } as Extract<LightConfig, { type: T }>
}

/**
 * Retypes a light, keeping every field the two types share. What the new type
 * does not have is dropped, what it adds starts at its default.
 */
export function convertLight(light: LightConfig, type: LightType): LightConfig {
  const defaults = structuredClone(LIGHT_DEFINITIONS[type].defaults) as Record<string, unknown>
  const source = light as unknown as Record<string, unknown>

  const next: Record<string, unknown> = { id: light.id, type }
  for (const [key, fallback] of Object.entries(defaults)) {
    next[key] = carry(source[key], fallback)
  }
  next.intensity = scaleIntensity(light.intensity, light.type, type)

  return next as LightConfig
}

/** Only where the shapes agree, which merges `shadow` key by key. */
function carry(value: unknown, fallback: unknown): unknown {
  if (isRecord(fallback)) {
    if (!isRecord(value)) return fallback
    return Object.fromEntries(
      Object.entries(fallback).map(([key, nested]) => [key, carry(value[key], nested)]),
    )
  }

  if (Array.isArray(fallback)) {
    return Array.isArray(value) && value.length === fallback.length ? [...value] : fallback
  }

  return typeof value === typeof fallback ? value : fallback
}

/**
 * Relative to each type's own default, because the units are not comparable: a
 * directional at 1 carried straight into a point light lands at 1 candela and
 * the scene goes black. `toPrecision` is float noise, not rounding.
 */
function scaleIntensity(value: number, from: LightType, to: LightType): number {
  const before = LIGHT_DEFINITIONS[from].defaults.intensity
  const after = LIGHT_DEFINITIONS[to].defaults.intensity
  if (before === 0) return after
  return Number((value * (after / before)).toPrecision(6))
}

export function findLight(setup: LightSetup, id: string | null): LightConfig | undefined {
  if (id === null) return undefined
  return setup.lights.find((light) => light.id === id)
}

export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/** Solo beats `enabled`. Production passes no solo ids. */
export function visibleLights(
  lights: LightConfig[],
  soloIds: readonly string[] = [],
): LightConfig[] {
  if (soloIds.length > 0) return lights.filter((light) => soloIds.includes(light.id))
  return lights.filter((light) => light.enabled)
}
