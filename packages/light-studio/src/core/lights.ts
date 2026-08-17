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
