import { useMemo } from 'react'

import { visibleLights } from '../core/lights'
import type { LightConfig } from '../core/schema'
import { useStudio } from './context'

/**
 * Which lights the editor draws wireframes and handles for. The selected light
 * is always drawn, or the gizmo would attach to a point with nothing to grab.
 */
export function useDrawnLights(): LightConfig[] {
  const lights = useStudio((state) => state.setup.lights)
  const soloIds = useStudio((state) => state.soloIds)
  const selectedId = useStudio((state) => state.selectedId)

  return useMemo(() => {
    const lit = new Set(visibleLights(lights, soloIds).map((light) => light.id))
    return lights.filter((light) => lit.has(light.id) || light.id === selectedId)
  }, [lights, soloIds, selectedId])
}
