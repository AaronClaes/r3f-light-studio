import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'

import { visibleLights } from '../core/lights'
import { parseSetup } from '../core/parse'
import { DEFAULT_SAVE_ID } from '../core/save'
import type { LightSetup } from '../core/schema'
import type { HelperStyle } from './helperStyle'
import { LightRenderer } from './LightRenderer'
import { splitSlots, StudioEnvironment } from './slots'
import { DEFAULT_TOGGLE_KEY, type ToggleKey } from './toggleKey'

/** Separate chunk, so no editor code reaches a production bundle. */
const DebugLayer = lazy(() => import('../debug/DebugLayer'))

export interface LightStudioProps {
  /** Accepts `unknown` because this is usually a raw JSON import. */
  setup: unknown
  /**
   * Arms the editor; `toggleKey` is what puts it on screen. Leave off in
   * production. Once shown it stays shown across reloads, for the life of the tab.
   */
  debug?: boolean
  /** Defaults to F2. `null` binds nothing. */
  toggleKey?: ToggleKey | null
  /**
   * Which file the dev-server plugin writes back to, and the name anything else
   * kept per-rig is stored under. Only needed when `lightStudio()` in your Vite
   * config was given an object of several rigs.
   */
  id?: string
  /**
   * What the editor draws its helpers and handles in, for when the defaults are
   * lost against your scene. The active light takes `color`, every other one
   * `idleColor`.
   */
  helpers?: HelperStyle
  /** Slots, not scene content. Anything but `<LightStudio.Environment>` is dropped. */
  children?: ReactNode
}

/**
 * Lights, and only lights. Tone mapping and exposure belong to `<Canvas>`:
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
  helpers,
  children,
}: LightStudioProps) {
  const { setup: parsed, issues } = useMemo(() => parseSetup(setup), [setup])
  const { environment: content, strays } = useMemo(() => splitSlots(children), [children])

  useEffect(() => {
    for (const issue of issues) console.warn(`[LightStudio] ${issue}`)
  }, [issues])

  useEffect(() => {
    for (const stray of strays) console.warn(`[LightStudio] ${stray}`)
  }, [strays])

  /**
   * What the editor was holding when it closed. The store lives in the editor
   * chunk, so without this turning `debug` off would discard every edit.
   */
  const [edited, setEdited] = useState<LightSetup | null>(null)

  // A new rig from the outside wins over whatever the editor left behind.
  useEffect(() => {
    setEdited(null)
  }, [parsed])

  const live = edited ?? parsed

  // Solo belongs to the editor, so this is only the `enabled` filter.
  const lights = useMemo(() => visibleLights(live.lights), [live.lights])
  const environment = live.environment.enabled ? live.environment : null

  const rig = (
    <LightRenderer environment={environment} environmentContent={content} lights={lights} />
  )

  if (!debug) return rig

  // Mounted whether or not it is shown, so the store outlives a keypress and
  // the chunk is already there when you ask for it.
  return (
    <Suspense fallback={rig}>
      <DebugLayer
        environmentContent={content}
        helpers={helpers}
        onExit={setEdited}
        saveId={id}
        setup={live}
        toggleKey={toggleKey}
      />
    </Suspense>
  )
}

/**
 * Puts its children in the rig's environment, next to its lightformers, for
 * what the JSON cannot describe. A marker: `LightStudio` reads it out of its
 * children and renders the contents itself.
 *
 * ```tsx
 * <LightStudio setup={rig} debug>
 *   <LightStudio.Environment>
 *     <mesh position={[0, 3, 1]}>
 *       <planeGeometry args={[2, 4]} />
 *       <meshBasicMaterial color="black" />
 *     </mesh>
 *   </LightStudio.Environment>
 * </LightStudio>
 * ```
 */
LightStudio.Environment = StudioEnvironment
