import { TransformControls } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { LightPatch, LightSetup, Vec3, VectorField } from '../core/schema'
import type { StudioState } from '../core/store'
import { useStudio, useStudioStore } from './context'

/**
 * Drags the selected point.
 *
 * Translate only: the schema aims a light by moving a target, so a rotate ring
 * would be editing something the format has no field for. Point lights have no
 * meaningful rotation at all.
 */
export function LightGizmo() {
  const store = useStudioStore()
  const selection = useStudio(selectDraggable)

  // TransformControls needs a real node in the scene graph to attach to, and
  // the store holds plain arrays. This object is the bridge between the two.
  const proxy = useMemo(() => new THREE.Object3D(), [])
  const dragging = useRef(false)

  const { id, field } = selection ?? {}

  useEffect(() => {
    if (id === undefined || field === undefined) return

    // While dragging, the gizmo owns the proxy — writing to it here would
    // fight the drag. Every other change (undo, the panel) has to move it.
    const follow = (state: StudioState) => {
      if (dragging.current) return
      const point = pointOf(state.setup, id, field)
      if (point) proxy.position.set(...point)
    }

    follow(store.getState())
    return store.subscribe(follow)
  }, [store, proxy, id, field])

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
      <TransformControls
        mode="translate"
        object={proxy}
        onMouseDown={() => {
          // One undo step per drag, not one per frame.
          dragging.current = true
          store.getState().beginTransaction()
        }}
        onMouseUp={() => {
          dragging.current = false
          // A drag moves the pointer far enough that r3f never calls it a
          // click, so there is nothing to claim. A tap does produce one.
          const moved = store.getState().endTransaction()
          if (!moved) store.getState().claimClick()
        }}
        onObjectChange={writePoint}
        space="world"
      />
    </>
  )
}

/**
 * The selected handle, when it is one you can actually drag. Returns only
 * primitives so a re-render happens on selection changes and not on every
 * frame of a drag.
 */
function selectDraggable(state: StudioState): { id: string; field: VectorField } | null {
  const { selectedId, selectedField } = state
  if (selectedId === null) return null
  if (!pointOf(state.setup, selectedId, selectedField)) return null
  return { id: selectedId, field: selectedField }
}

function pointOf(setup: LightSetup, id: string, field: VectorField): Vec3 | null {
  const light = setup.lights.find((candidate) => candidate.id === id)
  if (!light) return null
  if (field === 'target') return 'target' in light ? light.target : null
  return 'position' in light ? light.position : null
}
