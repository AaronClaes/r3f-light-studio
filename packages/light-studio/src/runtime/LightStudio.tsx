import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import { visibleLights } from '../core/lights'
import { parseSetup } from '../core/parse'
import type { LightSetup } from '../core/schema'
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

  /**
   * What the editor was holding when it closed.
   *
   * The store lives inside the editor chunk, so turning `debug` off unmounts
   * it and everything in it. Without this, a switch meant to hide the UI would
   * silently throw away every edit behind it. Edits still only live in memory
   * — a reload is a reload — but they outlast the toggle.
   */
  const [edited, setEdited] = useState<LightSetup | null>(null)

  // A new rig from the outside wins over whatever the editor left behind.
  useEffect(() => {
    setEdited(null)
  }, [parsed])

  const live = edited ?? parsed

  // Solo is a way of looking at a rig rather than a property of one, so it
  // belongs to the editor. What renders here is only ever the `enabled` filter.
  const lights = useMemo(() => visibleLights(live.lights), [live.lights])

  const rig = (
    <>
      {applyRenderer && live.renderer ? <RendererSettings config={live.renderer} /> : null}
      <LightRenderer lights={lights} />
    </>
  )

  if (!debug) return rig

  // The fallback keeps the scene lit while the editor chunk loads.
  return (
    <Suspense fallback={rig}>
      <DebugLayer setup={live} onExit={setEdited} applyRenderer={applyRenderer} />
    </Suspense>
  )
}
