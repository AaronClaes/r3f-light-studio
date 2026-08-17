import { useLayoutEffect, type RefObject } from 'react'
import type { Object3D } from 'three'

/**
 * Keeps everything under `ref` out of `scene.overrideMaterial`.
 *
 * Three gates the override on `material.allowOverride`, which is how it keeps
 * its own background mesh out of one. Anything drawn to be *looked at* rather
 * than lit belongs on the same side of that line, and this is the escape hatch
 * for the ones whose materials we do not author — three-stdlib builds the
 * gizmo's, drei builds the projected ground's. Ours say so where they are
 * written, which needs no hook at all.
 *
 * `token` is whatever changes when the subtree does, because a ref alone cannot
 * say when it filled up: it is already the same object on the render that mounts
 * children under it. Pass the thing they depend on — the selected light, whether
 * the ground is projected — and the walk happens again once they are there.
 *
 * A walk is enough where a subscription is not needed: these materials are built
 * by their constructors and then mutated in place rather than replaced, so there
 * is nothing later to catch.
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
