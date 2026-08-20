import { TransformControls } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { findLight } from '../core/lights'
import type { LightPatch, LightSetup, Vec3, VectorField } from '../core/schema'
import type { StudioState } from '../core/state'
import { useKeepMaterial } from '../runtime/keepMaterial'
import { useRedraw } from '../runtime/redraw'
import { useStudio, useStudioStore } from './context'

/** Translate only: the schema aims a light by moving a target, not by rotating it. */
export function LightGizmo() {
  const store = useStudioStore()
  const selection = useStudio(selectDraggable)
  const redraw = useRedraw()

  // TransformControls needs a real node to attach to; the store holds arrays.
  const proxy = useMemo(() => new THREE.Object3D(), [])
  const dragging = useRef(false)

  const { id, field } = selection ?? {}

  // three-stdlib builds the gizmo's materials, so they are marked from here.
  const arrows = useRef<THREE.Group>(null)
  useKeepMaterial(arrows, id)

  useEffect(() => {
    if (id === undefined || field === undefined) return

    // While dragging the gizmo owns the proxy. Undo and the panel have to move it.
    const follow = (state: StudioState) => {
      if (dragging.current) return
      const point = pointOf(state.setup, id, field)
      if (!point) return

      // Compared rather than written blind: this runs on every store change,
      // and a frame is only owed when the point actually moved.
      const [x, y, z] = point
      if (proxy.position.x === x && proxy.position.y === y && proxy.position.z === z) return

      proxy.position.set(x, y, z)
      redraw()
    }

    follow(store.getState())
    return store.subscribe(follow)
  }, [store, proxy, redraw, id, field])

  if (id === undefined || field === undefined) return null

  const writePoint = () => {
    const { x, y, z } = proxy.position
    const point: Vec3 = [x, y, z]
    const patch: LightPatch = field === 'target' ? { target: point } : { position: point }
    store.getState().updateLight(id, patch)
  }

  return (
    <>
      <primitive object={proxy} />
      {/* A group only so there is something to walk: drei mounts the controls
          as a primitive, with the gizmo hanging off it as an ordinary child. */}
      <group ref={arrows}>
        <TransformControls
          mode="translate"
          object={proxy}
          onMouseDown={() => {
            dragging.current = true
            store.getState().setGizmoDragging(true)
            store.getState().beginTransaction()
          }}
          onMouseUp={() => {
            dragging.current = false
            store.getState().setGizmoDragging(false)
            // A drag moves too far for r3f to call it a click, so there is
            // nothing to claim. A tap does produce one.
            const moved = store.getState().endTransaction()
            if (!moved) store.getState().claimClick()
          }}
          onObjectChange={writePoint}
          space="world"
        />
      </group>
    </>
  )
}

/** Primitives only, so a drag re-renders on selection changes and not per frame. */
function selectDraggable(state: StudioState): { id: string; field: VectorField } | null {
  const { selectedId, selectedField } = state
  if (selectedId === null) return null
  if (!pointOf(state.setup, selectedId, selectedField)) return null
  return { id: selectedId, field: selectedField }
}

function pointOf(setup: LightSetup, id: string, field: VectorField): Vec3 | null {
  const light = findLight(setup, id)
  if (!light) return null
  if (field === 'target') return 'target' in light ? light.target : null
  return 'position' in light ? light.position : null
}
