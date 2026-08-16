import { useFrame } from '@react-three/fiber'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import type { Vec3, VectorField } from '../core/schema'
import { useStudio, useStudioStore } from './context'
import { dashedCircle, wireDiamond } from './helpers/geometry'

/** Ring radius as a fraction of the viewport height. */
const HANDLE_SIZE = 0.015
/** The centre marker, relative to the ring. */
const CENTRE_RADIUS = 0.3
/** The pick sphere covers the ring from any angle, with a little margin. */
const PICK_SCALE = 1.3
/** The handle being dragged grows, so you can tell it apart at a glance. */
const SELECTED_SCALE = 1.25
const SELECTED_COLOR = '#ffffff'
/** Handles stay findable even when their light's helper has receded. */
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
  const store = useStudioStore()

  return (
    <>
      {/*
        One deselect target for the whole studio. r3f fires `onPointerMissed`
        on every object a click did not hit, so putting it on each handle would
        run it once per handle. This group has no geometry and so is never hit,
        which means it receives exactly one miss per click.
      */}
      <group
        onPointerMissed={() => {
          // A tap on the gizmo also arrives here as a miss. That click belongs
          // to the gizmo, and must not clear the selection it is attached to.
          if (store.getState().takeClick()) return
          store.getState().select(null)
        }}
      />
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
  // Both of a light's handles brighten when it is selected; only the one being
  // dragged turns white and grows.
  const { lightSelected, dragged } = useStudio((state) => ({
    lightSelected: state.selectedId === id,
    dragged: state.selectedId === id && state.selectedField === field,
  }))
  const [hovered, setHovered] = useState(false)

  const ring = useMemo(() => dashedCircle(1), [])
  const centre = useMemo(() => wireDiamond(CENTRE_RADIUS), [])
  useEffect(() => {
    return () => {
      ring.dispose()
      centre.dispose()
    }
  }, [ring, centre])

  useBillboard(group, HANDLE_SIZE)
  usePointerCursor(hovered)

  const markColor = dragged ? SELECTED_COLOR : color
  const opacity = lightSelected || hovered ? 1 : IDLE_OPACITY

  return (
    <group ref={group} position={point}>
      <group scale={dragged ? SELECTED_SCALE : 1}>
        <Mark color={markColor} geometry={ring} opacity={opacity} />
        <Mark color={markColor} geometry={centre} opacity={opacity} />
      </group>

      <mesh
        onClick={(event) => {
          event.stopPropagation()
          store.getState().select(id, field)
        }}
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

/** Never occluded, matching the pick sphere: what you can click, you can see. */
function Mark({
  geometry,
  color,
  opacity,
}: {
  geometry: THREE.BufferGeometry
  color: string
  opacity: number
}) {
  return (
    <lineSegments geometry={geometry} renderOrder={1}>
      <lineBasicMaterial
        color={color}
        depthTest={false}
        opacity={opacity}
        toneMapped={false}
        transparent
      />
    </lineSegments>
  )
}

/** Reused across every handle; `useFrame` callbacks never overlap. */
const worldPosition = new THREE.Vector3()

/**
 * Holds a handle at a constant size on screen and square to the camera, so the
 * ring reads as a ring from every angle instead of collapsing to an ellipse,
 * and stays grabbable whether you are up against a light or seeing the whole
 * rig at once.
 */
function useBillboard(ref: React.RefObject<THREE.Object3D | null>, fraction: number): void {
  useFrame(({ camera }) => {
    const object = ref.current
    if (!object) return

    object.quaternion.copy(camera.quaternion)

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
