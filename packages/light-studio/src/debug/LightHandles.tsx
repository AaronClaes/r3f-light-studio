import { useFrame } from '@react-three/fiber'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import type { Vec3, VectorField } from '../core/schema'
import { useStudio, useStudioStore } from './context'
import { wireOctahedron } from './helpers/geometry'

/** Handle radius as a fraction of the viewport height. */
const HANDLE_SIZE = 0.013
/** The pick sphere is bigger than the marker — thin lines are hard to hit. */
const PICK_SCALE = 1.8
/** The selected handle grows, so you can tell it apart at a glance. */
const SELECTED_SCALE = 1.4
const SELECTED_COLOR = '#ffffff'
const IDLE_OPACITY = 0.55

/**
 * The grabbable points of the rig: one per light, plus one on the target of
 * every light that aims. Clicking selects; clicking nothing deselects.
 *
 * Which points exist is derived from the schema rather than from a per-type
 * switch — a light has a handle for each vector field it actually declares.
 */
export function LightHandles() {
  const lights = useStudio((state) => state.setup.lights)

  return (
    <>
      {lights.map((light) => (
        <Fragment key={light.id}>
          {'position' in light ? (
            <Handle color={light.color} field="position" id={light.id} point={light.position} />
          ) : null}
          {'target' in light ? (
            <Handle color={light.color} field="target" id={light.id} point={light.target} />
          ) : null}
        </Fragment>
      ))}
    </>
  )
}

interface HandleProps {
  id: string
  field: VectorField
  point: Vec3
  color: string
}

function Handle({ id, field, point, color }: HandleProps) {
  const group = useRef<THREE.Group>(null)
  const store = useStudioStore()
  const selected = useStudio((state) => state.selectedId === id && state.selectedField === field)
  const [hovered, setHovered] = useState(false)

  const marker = useMemo(() => wireOctahedron(1), [])
  useEffect(() => () => marker.dispose(), [marker])

  useScreenSize(group, HANDLE_SIZE)
  usePointerCursor(hovered)

  return (
    <group ref={group} position={point}>
      <lineSegments renderOrder={1} scale={selected ? SELECTED_SCALE : 1}>
        <primitive attach="geometry" object={marker} />
        {/* Never occluded: the pick sphere ignores depth too, so a handle you
            can click is always a handle you can see. */}
        <lineBasicMaterial
          color={selected ? SELECTED_COLOR : color}
          depthTest={false}
          opacity={selected || hovered ? 1 : IDLE_OPACITY}
          toneMapped={false}
          transparent
        />
      </lineSegments>

      <mesh
        onClick={(event) => {
          event.stopPropagation()
          store.getState().select(id, field)
        }}
        onPointerMissed={() => store.getState().select(null)}
        onPointerOut={() => setHovered(false)}
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
        }}
        scale={PICK_SCALE}
      >
        <sphereGeometry args={[1, 12, 8]} />
        {/* Not `visible={false}`, which would take it out of the raycast.
            Writing neither colour nor depth renders nothing but stays pickable. */}
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Reused across every handle; `useFrame` callbacks never overlap. */
const worldPosition = new THREE.Vector3()

/**
 * Holds an object at a constant size on screen, so handles stay grabbable
 * whether you are up against a light or looking at the whole rig.
 */
function useScreenSize(ref: React.RefObject<THREE.Object3D | null>, fraction: number): void {
  useFrame(({ camera }) => {
    const object = ref.current
    if (!object) return

    if (camera instanceof THREE.PerspectiveCamera) {
      object.getWorldPosition(worldPosition)
      const distance = camera.position.distanceTo(worldPosition)
      // Half the frustum height at that distance, doubled: the visible height.
      const visibleHeight = 2 * distance * Math.tan((camera.fov * Math.PI) / 360)
      object.scale.setScalar(visibleHeight * fraction)
    } else if (camera instanceof THREE.OrthographicCamera) {
      object.scale.setScalar(((camera.top - camera.bottom) / camera.zoom) * fraction)
    }
  })
}

function usePointerCursor(active: boolean): void {
  useEffect(() => {
    if (!active) return

    const previous = document.body.style.cursor
    document.body.style.cursor = 'pointer'
    return () => {
      document.body.style.cursor = previous
    }
  }, [active])
}
