import { LIGHT_DEFINITIONS, type LightConfig, type LightType } from './schema'

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

export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/**
 * Which lights actually reach the scene. Solo is an editor concept and beats
 * `enabled`; production passes no solo ids and gets the plain `enabled` filter.
 */
export function visibleLights(
  lights: LightConfig[],
  soloIds: readonly string[] = [],
): LightConfig[] {
  if (soloIds.length > 0) return lights.filter((light) => soloIds.includes(light.id))
  return lights.filter((light) => light.enabled)
}
