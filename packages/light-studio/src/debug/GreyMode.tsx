import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Color, DoubleSide, MeshStandardMaterial } from 'three'

import { useStudio } from './context'

/**
 * Paints the scene one neutral grey while the toggle is on.
 *
 * `scene.overrideMaterial` rather than walking the graph and swapping: it is a
 * single property with nothing to remember and nothing to put back, and a mesh
 * the app mounts while grey is on is covered without anyone noticing it arrived.
 *
 * What it does *not* cover is as important. The environment is a scene of its
 * own — drei portals the lightformers and anything in `<LightStudio.Environment>`
 * into one — so they are never overridden, which is right: they are emitters,
 * not surfaces you are judging. The wireframes, the handles and the gizmo opt
 * out through `allowOverride`, and so does the projected ground.
 */
export function GreyMode() {
  const scene = useThree((state) => state.scene)
  const grey = useStudio((state) => state.grey)

  const material = useMemo(() => makeGrey(), [])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    if (!grey) return

    // Restored rather than nulled: an app is free to have one of its own, and
    // this is a switch you flick, not a claim on the property.
    const previous = scene.overrideMaterial
    scene.overrideMaterial = material
    return () => {
      scene.overrideMaterial = previous
    }
  }, [grey, material, scene])

  return null
}

/**
 * The grey card, at 18% reflectance — the mid grey every other trade meters
 * against, and dark enough that a highlight still has somewhere to go.
 *
 * Half rough, because the two extremes each hide half the answer: mirror-smooth
 * is all reflection and no form, fully matte kills the speculars, and where a
 * source lands on a surface is exactly what you are looking for.
 *
 * `DoubleSide` because a plane whose back is turned would vanish entirely, and
 * a diagnostic view that deletes geometry is worse than one that shows a face
 * the app would have culled. Cards, cloth and foliage are all built this way.
 */
function makeGrey(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(0.18, 0.18, 0.18),
    metalness: 0,
    roughness: 0.5,
    side: DoubleSide,
  })
}
