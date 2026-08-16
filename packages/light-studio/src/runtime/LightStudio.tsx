import { lazy, Suspense, useEffect, useMemo } from 'react'

import { visibleLights } from '../core/lights'
import { parseSetup } from '../core/parse'
import { LightRenderer } from './LightRenderer'
import { RendererSettings } from './RendererSettings'

/** Separate chunk, so no editor code reaches a production bundle. */
const DebugLayer = lazy(() => import('../debug/DebugLayer'))

export interface LightStudioProps {
  /** The rig. Accepts `unknown` because this is usually a raw JSON import. */
  setup: unknown
  /** Opens the editor. Leave off in production. */
  debug?: boolean
  /** Set false to keep your own tone mapping and exposure. */
  applyRenderer?: boolean
}

export function LightStudio({ setup, debug = false, applyRenderer = true }: LightStudioProps) {
  const { setup: parsed, issues } = useMemo(() => parseSetup(setup), [setup])

  useEffect(() => {
    for (const issue of issues) console.warn(`[LightStudio] ${issue}`)
  }, [issues])

  const lights = useMemo(() => visibleLights(parsed.lights), [parsed.lights])

  const rig = (
    <>
      {applyRenderer && parsed.renderer ? <RendererSettings config={parsed.renderer} /> : null}
      <LightRenderer lights={lights} />
    </>
  )

  if (!debug) return rig

  // The fallback keeps the scene lit while the editor chunk loads.
  return (
    <Suspense fallback={rig}>
      <DebugLayer setup={parsed} applyRenderer={applyRenderer} />
    </Suspense>
  )
}
