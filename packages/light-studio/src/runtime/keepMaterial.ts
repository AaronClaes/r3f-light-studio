import { useLayoutEffect, type RefObject } from 'react'
import type { Object3D } from 'three'

/**
 * Keeps everything under `ref` out of `scene.overrideMaterial`, for materials we
 * do not author: three-stdlib builds the gizmo's, drei the projected ground's.
 * Ours set `allowOverride` where they are written.
 *
 * `token` is whatever changes when the subtree does, because a ref is already
 * the same object on the render that mounts children under it.
 */
export function useKeepMaterial(ref: RefObject<Object3D | null>, token: unknown): void {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return

    root.traverse((object) => {
      const material = (object as { material?: unknown }).material
      if (!material) return
      for (const one of Array.isArray(material) ? material : [material]) {
        ;(one as { allowOverride?: boolean }).allowOverride = false
      }
    })
  }, [ref, token])
}
