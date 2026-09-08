import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Color, DoubleSide, MeshStandardMaterial } from 'three'

import { useRedraw } from '../runtime/redraw'
import { useStudio } from './context'

/**
 * `scene.overrideMaterial` rather than walking the graph: nothing to put back,
 * and a mesh the app mounts while grey is on is covered too.
 *
 * Lightformers are missed because drei portals them into a scene of their own.
 * The wireframes, handles, gizmo and projected ground opt out via `allowOverride`.
 */
export function GreyMode() {
  const scene = useThree((state) => state.scene)
  const grey = useStudio((state) => state.grey)
  const redraw = useRedraw()

  useEffect(() => {
    if (!grey) return

    // Built here rather than memoised: the material must not outlive the effect
    // that installed it, and it must not be disposed while the effect is live.
    // StrictMode's mount-cleanup-mount cycle breaks any arrangement where those
    // two lifetimes are kept apart, and a disposed override material takes down
    // every mesh in the scene, not just the studio's own.
    const material = makeGrey()

    // Restored rather than nulled: an app may have one of its own.
    const previous = scene.overrideMaterial
    scene.overrideMaterial = material
    redraw()
    return () => {
      scene.overrideMaterial = previous
      material.dispose()
      redraw()
    }
  }, [grey, redraw, scene])

  return null
}

/**
 * An 18% grey card, half rough so neither reflection nor form hides the other.
 * `DoubleSide` because a diagnostic view that deletes the back of a plane is
 * worse than one that shows a face the app would have culled.
 */
function makeGrey(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(0.18, 0.18, 0.18),
    metalness: 0,
    roughness: 0.5,
    side: DoubleSide,
  })
}
