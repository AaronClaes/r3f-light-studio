import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import { visibleLights } from '../core/lights'
import { parseSetup } from '../core/parse'
import { DEFAULT_SAVE_ID } from '../core/save'
import type { LightSetup } from '../core/schema'
import { LightRenderer } from './LightRenderer'
import { DEFAULT_TOGGLE_KEY, type ToggleKey } from './toggleKey'

/** Separate chunk, so no editor code reaches a production bundle. */
const DebugLayer = lazy(() => import('../debug/DebugLayer'))

export interface LightStudioProps {
  /** The rig. Accepts `unknown` because this is usually a raw JSON import. */
  setup: unknown
  /**
   * Makes the editor available. Leave off in production.
   *
   * It starts hidden: this arms the editor, `toggleKey` is what puts it on
   * screen. A rig you are not editing right now should not have a panel
   * sitting over your scene.
   *
   * Once shown, it stays shown across reloads for the life of the tab.
   */
  debug?: boolean
  /** Shows and hides the editor. Defaults to F2; `null` binds nothing. */
  toggleKey?: ToggleKey | null
  /**
   * Which file the dev-server plugin writes this rig back to.
   *
   * Only needed when `lightStudio()` in your Vite config was given an object
   * of several rigs — the key you gave it goes here. A plugin configured with
   * a single path needs nothing.
   *
   * It also names this rig for anything else kept per-rig, which so far means
   * whether the editor was open when the tab last reloaded.
   */
  id?: string
}

/**
 * Lights, and only lights.
 *
 * Tone mapping and exposure were once part of a setup and applied to the
 * renderer from here. They are gone: `gl.toneMapping` has exactly one sensible
 * owner and it is `<Canvas>`. Reaching in from a component that mounts and
 * unmounts meant restoring a value captured on mount, which is already stale
 * if the app changed its own in between — and an `applyRenderer` escape hatch
 * only made the conflict optional rather than absent.
 *
 * ```tsx
 * <Canvas gl={{ toneMappingExposure: 1.1 }}>
 * ```
 */
export function LightStudio({
  setup,
  debug = false,
  toggleKey = DEFAULT_TOGGLE_KEY,
  id = DEFAULT_SAVE_ID,
}: LightStudioProps) {
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
  // belongs to the editor. What renders here is only ever the `enabled` filter
  // — which the environment gets too, for the same reason.
  const lights = useMemo(() => visibleLights(live.lights), [live.lights])
  const environment = live.environment.enabled ? live.environment : null

  const rig = <LightRenderer environment={environment} lights={lights} />

  if (!debug) return rig

  // Mounted whether or not it is shown, so the store outlives a keypress and
  // the chunk is already there when you ask for it. The fallback keeps the
  // scene lit while that chunk loads. Whether it is shown is the store's
  // business now — it starts hidden, and disarming discards the store with it,
  // so arming again starts from the same place.
  return (
    <Suspense fallback={rig}>
      <DebugLayer onExit={setEdited} saveId={id} setup={live} toggleKey={toggleKey} />
    </Suspense>
  )
}
