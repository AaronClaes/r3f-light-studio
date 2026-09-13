import { useFrame } from '@react-three/fiber'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import type { LightType, Vec3, VectorField } from '../core/schema'
import type { LightIcons } from '../runtime/helperStyle'
import { useStudio, useStudioStore } from './context'
import { useDrawnLights } from './drawnLights'
import { dashedCircle, wireCross, wireDiamond, type WirePart } from './helpers/geometry'
import { lightGlyph } from './helpers/glyphs'
import type { ResolvedHelperStyle } from './palette'
import { PICK_USER_DATA } from './PickGuard'

/** Ring radius as a fraction of the viewport height. */
const HANDLE_SIZE = 0.015
/**
 * Glyphs are drawn larger, and the pick sphere with them. A ring can be small
 * because it is one big thin circle; a pictogram has to carry a silhouette, and
 * at the ring's size a bulb is a blob and the panel's rays close up entirely.
 */
const GLYPH_SIZE = 0.028
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
export function LightHandles({ color, icons, idleColor, idleOpacity }: ResolvedHelperStyle) {
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
              icons={icons}
              id={light.id}
              idleColor={idleColor}
              idleOpacity={idleOpacity}
              point={light.position}
              type={light.type}
            />
          ) : null}
          {'target' in light && light.id === selectedId ? (
            <Handle
              color={color}
              field="target"
              icons={icons}
              id={light.id}
              idleColor={idleColor}
              idleOpacity={idleOpacity}
              point={light.target}
              type={light.type}
            />
          ) : null}
        </Fragment>
      ))}
    </>
  )
}

interface HandleProps extends ResolvedHelperStyle {
  id: string
  type: LightType
  field: VectorField
  point: Vec3
}

function Handle({ id, type, field, point, color, icons, idleColor, idleOpacity }: HandleProps) {
  const group = useRef<THREE.Group>(null)
  const store = useStudioStore()
  const { lightSelected, dragged } = useStudio((state) => ({
    lightSelected: state.selectedId === id,
    dragged: state.selectedId === id && state.selectedField === field,
  }))
  const [hovered, setHovered] = useState(false)

  // Shapes and positions, not geometries: r3f owns the geometry a handle draws,
  // so nothing here has to guess when a disposal is safe. See `Wire`.
  const art = useMemo(() => artFor(icons, field, type), [icons, field, type])

  useBillboard(group, art.filled ? GLYPH_SIZE : HANDLE_SIZE)
  usePointerCursor(hovered)

  const active = lightSelected || hovered

  return (
    <group ref={group} position={point}>
      <group scale={dragged ? SELECTED_SCALE : 1}>
        {art.filled ? (
          <Glyph
            color={active ? color : idleColor}
            opacity={active ? 1 : idleOpacity}
            shapes={art.shapes}
          />
        ) : (
          art.parts.map(({ name, positions }) => (
            <Mark
              color={active ? color : idleColor}
              key={name}
              opacity={active ? 1 : idleOpacity}
              positions={positions}
            />
          ))
        )}
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
        userData={PICK_USER_DATA}
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

/** Lines or filled shapes. A handle is drawn wholly in one mode or the other. */
type HandleArt = { filled: false; parts: WirePart[] } | { filled: true; shapes: THREE.Shape[] }

/**
 * A source is Blender's dashed ring around a diamond, or the light type's own
 * pictogram; a target is a bare reticle either way. A target is a point in
 * space rather than a light, so there is no type for a glyph to say.
 */
function artFor(icons: LightIcons, field: VectorField, type: LightType): HandleArt {
  if (field === 'target') {
    return { filled: false, parts: [{ name: 'reticle', positions: wireCross(CENTRE_RADIUS, 1) }] }
  }

  if (icons === 'glyph') {
    const glyph = lightGlyph(type)
    if (glyph) return { filled: true, shapes: glyph }
  }

  return {
    filled: false,
    parts: [
      { name: 'ring', positions: dashedCircle(1) },
      { name: 'centre', positions: wireDiamond(CENTRE_RADIUS) },
    ],
  }
}

interface PaintProps {
  color: string
  opacity: number
}

interface MarkProps extends PaintProps {
  positions: Float32Array
}

interface GlyphProps extends PaintProps {
  shapes: THREE.Shape[]
}

/** Never occluded, matching the pick sphere: what you can click, you can see. */
function Mark({ positions, color, opacity }: MarkProps) {
  return (
    <lineSegments renderOrder={1}>
      <bufferGeometry>
        <bufferAttribute args={[positions, 3]} attach="attributes-position" />
      </bufferGeometry>
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

/** The same treatment as `Mark`, filled. The billboard keeps its front to the camera. */
function Glyph({ shapes, color, opacity }: GlyphProps) {
  return (
    <mesh renderOrder={1}>
      <shapeGeometry args={[shapes]} />
      <meshBasicMaterial
        allowOverride={false}
        color={color}
        depthTest={false}
        opacity={opacity}
        toneMapped={false}
        transparent
      />
    </mesh>
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
