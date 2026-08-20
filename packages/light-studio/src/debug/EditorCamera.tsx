import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree, type Camera } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import * as THREE from 'three'

import { useStudio } from './context'

/**
 * Controls of the editor's own, so editing is never boxed in by the limits the
 * app puts on its camera.
 *
 * Three things this deliberately does not do, each of them measured rather than
 * reasoned about:
 *
 * It does not swap `state.camera`. drei's controls take their camera from there
 * when given no `camera` prop, so swapping it rebuilds the app's controls bound
 * to ours, limits and all, and its `makeDefault` re-runs and wins.
 *
 * It does not claim `state.controls` with `makeDefault`. That is the app's
 * handle on its own controls, and apps call their library's own methods through
 * it: `setBoundary` on a camera-controls instance is not a thing an
 * `OrbitControls` can answer to.
 *
 * It does not trust `enabled` alone. drei's `CameraControls` calls
 * `controls.update(delta)` every frame without checking it, so a disabled
 * camera-controls still drags the camera back to where it thinks it should be.
 */
export function EditorCamera() {
  const get = useThree((state) => state.get)
  const gizmoDragging = useStudio((state) => state.gizmoDragging)
  const ours = useRef<ComponentRef<typeof OrbitControls>>(null)

  /**
   * Read while rendering. An effect here would run after our own controls' own
   * effects, and we want the app's state as it was before we arrived.
   */
  const [app] = useState(() => {
    const state = get()
    return { camera: state.camera, controls: state.controls as Controls | null }
  })

  /** Skipped when the app never called `makeDefault`, where we cannot find it. */
  useLayoutEffect(() => {
    const controls = app.controls
    if (!controls) return

    const wasEnabled = controls.enabled
    controls.enabled = false

    // The camera is ours while we are mounted, so their update is a no-op. Held
    // as an own property shadowing the prototype's, and dropped on the way out.
    const owned = Object.hasOwn(controls, 'update')
    const previous = controls.update
    controls.update = noUpdate

    return () => {
      if (owned) controls.update = previous
      else delete controls.update
      if (typeof wasEnabled === 'boolean') controls.enabled = wasEnabled
    }
  }, [app.controls])

  /**
   * Handing the camera back exactly as we found it is what saves us from
   * resyncing their controls on the way out: every library caches the pose it
   * last set, and putting the camera back makes that cache true again. It also
   * keeps the camera inside limits it would otherwise be snapped into.
   */
  useLayoutEffect(() => {
    const camera = app.camera
    const position = camera.position.clone()
    const quaternion = camera.quaternion.clone()
    const zoom = camera.zoom

    return () => {
      camera.position.copy(position)
      camera.quaternion.copy(quaternion)
      camera.zoom = zoom
      camera.updateProjectionMatrix()
    }
  }, [app.camera])

  /**
   * Per frame rather than on the flag changing, because drei's
   * `TransformControls` writes `enabled` on whatever sits in `state.controls`
   * when a gizmo drag ends, and there is no ordering to rely on between its
   * listener and ours. One boolean compare, and it heals whoever flipped it.
   */
  useFrame(() => {
    const controls = app.controls
    if (controls?.enabled) controls.enabled = false
    if (ours.current) ours.current.enabled = !gizmoDragging
  })

  const target = useMemo(() => targetFor(app.camera, app.controls), [app.camera, app.controls])

  // No `makeDefault`, so the app keeps its own controls on `state.controls`.
  // The gizmo is suspended by `gizmoDragging` above instead.
  return <OrbitControls camera={app.camera} ref={ours} target={target} />
}

function noUpdate(): boolean {
  return false
}

/** Only what every controls library agrees on, plus the two ways to read a pivot. */
interface Controls {
  enabled?: boolean
  update?: (delta?: number) => unknown
  target?: THREE.Vector3
  getTarget?: (out: THREE.Vector3) => THREE.Vector3
}

/**
 * What the editor orbits around. Worth asking the app's controls for: start on
 * the wrong pivot and the first drag swings the view away from what you were
 * looking at.
 */
function targetFor(camera: Camera, controls: Controls | null): THREE.Vector3 {
  if (typeof controls?.getTarget === 'function') return controls.getTarget(new THREE.Vector3())
  if (controls?.target instanceof THREE.Vector3) return controls.target.clone()

  // Nothing to ask. Straight ahead, as far off as the camera is from the origin,
  // so a camera already pointed at the origin pivots on it.
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  return camera.position.clone().addScaledVector(forward, camera.position.length() || 1)
}
