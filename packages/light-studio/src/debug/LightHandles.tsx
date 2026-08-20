import { useFrame } from '@react-three/fiber'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import type { Vec3, VectorField } from '../core/schema'
import { useStudio, useStudioStore } from './context'
import { useDrawnLights } from './drawnLights'
import { dashedCircle, wireCross, wireDiamond } from './helpers/geometry'
import type { ResolvedHelperStyle } from './palette'

/** Ring radius as a fraction of the viewport height. */
const HANDLE_SIZE = 0.015
/** The centre marker, relative to the ring. */
const CENTRE_RADIUS = 0.3
/** The pick sphere covers the ring from any angle, with a little margin. */
const PICK_SCALE = 1.3
const SELECTED_SCALE = 1.25

/**
 * One grabbable point per light, plus one on the selected light's target.
 *
 * Targets are only drawn for the selected light: most rigs aim at the origin,
 * so a dozen of them stack into one blob there, and the beam already shows
 * where a light points.
 */
export function LightHandles({ color, idleColor, idleOpacity }: ResolvedHelperStyle) {
  const lights = useDrawnLights()
  const selectedId = useStudio((state) => state.selectedId)
  const store = useStudioStore()

  return (
    <>
      {/* One deselect target for the whole studio. r3f fires `onPointerMissed`
          per object a click did not hit, and this group has no geometry, so it
          gets one miss per click rather than one per handle. */}
      <group
        onPointerMissed={() => {
          // A tap on the gizmo arrives here as a miss too.
          if (store.getState().takeClick()) return
          store.getState().select(null)
        }}
      />
      {lights.map((light) => (
        <Fragment key={light.id}>
          {'position' in light ? (
            <Handle
              color={color}
              field="position"
              id={light.id}
              idleColor={idleColor}
              idleOpacity={idleOpacity}
              point={light.position}
            />
          ) : null}
          {'target' in light && light.id === selectedId ? (
            <Handle
              color={color}
              field="target"
              id={light.id}
              idleColor={idleColor}
              idleOpacity={idleOpacity}
              point={light.target}
            />
          ) : null}
        </Fragment>
      ))}
    </>
  )
}

interface HandleProps extends ResolvedHelperStyle {
  id: string
  field: VectorField
  point: Vec3
}

function Handle({ id, field, point, color, idleColor, idleOpacity }: HandleProps) {
  const group = useRef<THREE.Group>(null)
  const store = useStudioStore()
  const { lightSelected, dragged } = useStudio((state) => ({
    lightSelected: state.selectedId === id,
    dragged: state.selectedId === id && state.selectedField === field,
  }))
  const [hovered, setHovered] = useState(false)

  const marks = useMemo(() => marksFor(field), [field])
  useEffect(() => {
    return () => {
      for (const mark of marks) mark.dispose()
    }
  }, [marks])

  useBillboard(group, HANDLE_SIZE)
  usePointerCursor(hovered)

  const active = lightSelected || hovered

  return (
    <group ref={group} position={point}>
      <group scale={dragged ? SELECTED_SCALE : 1}>
        {marks.map((mark) => (
          <Mark
            color={active ? color : idleColor}
            geometry={mark}
            key={mark.uuid}
            opacity={active ? 1 : idleOpacity}
          />
        ))}
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
        {/* Not `visible={false}`, which would leave the raycast. Writing
            neither colour nor depth renders nothing and stays pickable, and
            `allowOverride` keeps grey mode from making it an opaque ball. */}
        <meshBasicMaterial allowOverride={false} colorWrite={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** A source is Blender's dashed ring around a diamond; a target is a bare reticle. */
function marksFor(field: VectorField): THREE.BufferGeometry[] {
  if (field === 'target') return [wireCross(CENTRE_RADIUS, 1)]
  return [dashedCircle(1), wireDiamond(CENTRE_RADIUS)]
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
        allowOverride={false}
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

/** Constant size on screen and square to the camera, so the ring stays a ring. */
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
