import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'

import type {
  DirectionalLightConfig,
  HemisphereLightConfig,
  LightConfig,
  LightformerConfig,
  PointLightConfig,
  RectAreaLightConfig,
  SpotLightConfig,
  Vec3,
} from '../../core/schema'
import { useStudio } from '../context'
import { useDrawnLights } from '../drawnLights'
import { wireBox, wireCone, wireEllipse, wireLine, wireRectangle, wireSphere } from './geometry'

/**
 * The shapes that describe what a light *does* — where it points, how far it
 * reaches, how wide it spreads. The points you can grab are drawn separately,
 * by `LightHandles`.
 */

/** Side of the square standing in for a directional light's emitting plane. */
const PLATE_SIZE = 0.5
/** Keeps a cone from collapsing when a light sits on its own target. */
const MIN_LENGTH = 0.001

/**
 * How strongly each kind of line reads before emphasis. `primary` is the shape
 * itself, `secondary` the beam out to the target, `range` a falloff radius —
 * always the biggest thing on screen, so it stays furthest back.
 */
const ROLE = { primary: 1, secondary: 0.6, range: 0.35 }

/**
 * Only the selected light draws at full strength, the way Blender does it.
 * Everything else stays visible enough to find and read as a rig, without a
 * dozen helpers competing for attention the moment you turn `debug` on.
 *
 * There is no third level for a light that is off: it is not drawn at all.
 */
const EMPHASIS = { selected: 1, idle: 0.28 }

type Emphasis = keyof typeof EMPHASIS

function opacityOf(role: keyof typeof ROLE, emphasis: Emphasis): number {
  return ROLE[role] * EMPHASIS[emphasis]
}

/**
 * Built from the config rather than from the rendered three lights. Nothing
 * here reads the scene graph, so a helper never has to be kept in sync with a
 * light object, and a selected light draws whether or not it is switched on.
 */
export function LightHelpers() {
  const drawn = useDrawnLights()
  const selectedId = useStudio((state) => state.selectedId)

  return (
    <>
      {drawn.map((light) => (
        <LightHelper
          key={light.id}
          emphasis={light.id === selectedId ? 'selected' : 'idle'}
          light={light}
        />
      ))}
    </>
  )
}

interface HelperProps<T extends LightConfig = LightConfig> {
  light: T
  emphasis: Emphasis
}

function LightHelper({ light, emphasis }: HelperProps) {
  switch (light.type) {
    // An ambient light has neither a position nor a direction, so there is
    // nothing honest to draw for it. It is reachable from the panel instead.
    case 'ambient':
      return null

    case 'hemisphere':
      return <HemisphereHelper emphasis={emphasis} light={light} />

    case 'directional':
      return <DirectionalHelper emphasis={emphasis} light={light} />

    case 'point':
      return <PointHelper emphasis={emphasis} light={light} />

    case 'spot':
      return <SpotHelper emphasis={emphasis} light={light} />

    case 'rectArea':
      return <RectAreaHelper emphasis={emphasis} light={light} />

    case 'lightformer':
      return <LightformerHelper emphasis={emphasis} light={light} />
  }
}

function HemisphereHelper({ light, emphasis }: HelperProps<HemisphereLightConfig>) {
  // `position` is the sky direction, not a location, so the line back to the
  // origin reads as the sky-to-ground axis rather than as a beam.
  const axis = useMemo(() => wireLine(light.position, [0, 0, 0]), [light.position])

  return (
    <Wire color={light.groundColor} geometry={axis} opacity={opacityOf('secondary', emphasis)} />
  )
}

function DirectionalHelper({ light, emphasis }: HelperProps<DirectionalLightConfig>) {
  const plate = useMemo(() => wireRectangle(PLATE_SIZE, PLATE_SIZE), [])

  return (
    <>
      <Aimed position={light.position} target={light.target}>
        <Wire color={light.color} geometry={plate} opacity={opacityOf('primary', emphasis)} />
      </Aimed>
      <Beam color={light.color} emphasis={emphasis} from={light.position} to={light.target} />
    </>
  )
}

function PointHelper({ light, emphasis }: HelperProps<PointLightConfig>) {
  // `distance` of 0 means no cutoff, so there is no range to draw and the
  // handle is the whole helper.
  const range = useMemo(
    () => (light.distance > 0 ? wireSphere(light.distance) : null),
    [light.distance],
  )

  if (!range) return null

  return (
    <group position={light.position}>
      <Wire color={light.color} geometry={range} opacity={opacityOf('range', emphasis)} />
    </group>
  )
}

function SpotHelper({ light, emphasis }: HelperProps<SpotLightConfig>) {
  // The cone ends at the cutoff distance when there is one, otherwise at the
  // target, which is the only other length the setup gives us.
  const length = Math.max(
    light.distance > 0 ? light.distance : distanceBetween(light.position, light.target),
    MIN_LENGTH,
  )
  const cone = useMemo(
    () => wireCone(Math.tan(light.angle) * length, length),
    [light.angle, length],
  )

  return (
    <>
      <Aimed position={light.position} target={light.target}>
        <Wire color={light.color} geometry={cone} opacity={opacityOf('primary', emphasis)} />
      </Aimed>
      <Beam color={light.color} emphasis={emphasis} from={light.position} to={light.target} />
    </>
  )
}

function RectAreaHelper({ light, emphasis }: HelperProps<RectAreaLightConfig>) {
  const shape = useMemo(() => wireRectangle(light.width, light.height), [light.width, light.height])

  return (
    <>
      <Aimed position={light.position} target={light.target}>
        <Wire color={light.color} geometry={shape} opacity={opacityOf('primary', emphasis)} />
      </Aimed>
      <Beam color={light.color} emphasis={emphasis} from={light.position} to={light.target} />
    </>
  )
}

/**
 * The only helper that draws something the scene does not otherwise contain.
 *
 * A lightformer is a mesh inside the environment's own little scene, so nothing
 * of it appears here — you would be dragging an invisible point and judging the
 * result from a reflection. The wireframe is its actual shape and size, in the
 * place it occupies, which is what makes it aimable at all. Turning the
 * environment on as a backdrop shows you the real thing behind it.
 *
 * `ring` is drawn as two outlines because that is what drei's is: a disc with
 * the middle half of it missing.
 */
function LightformerHelper({ light, emphasis }: HelperProps<LightformerConfig>) {
  const { form, width, height } = light
  const shape = useMemo(() => formGeometry(form, width, height), [form, width, height])
  const opacity = opacityOf('primary', emphasis)

  return (
    <>
      <Aimed position={light.position} target={light.target}>
        {shape.map((geometry) => (
          <Wire color={light.color} geometry={geometry} key={geometry.uuid} opacity={opacity} />
        ))}
      </Aimed>
      <Beam color={light.color} emphasis={emphasis} from={light.position} to={light.target} />
    </>
  )
}

/** drei's ring keeps its inner edge at half the outer radius. */
const RING_INNER = 0.5

function formGeometry(
  form: LightformerConfig['form'],
  width: number,
  height: number,
): THREE.BufferGeometry[] {
  switch (form) {
    case 'circle':
      return [wireEllipse(width, height)]

    case 'ring':
      return [wireEllipse(width, height), wireEllipse(width * RING_INNER, height * RING_INNER)]

    // drei scales a unit box, so the depth is whatever the third scale axis is
    // — and the renderer passes 1, since the schema has no field for it.
    case 'box':
      return [wireBox(width, height, 1)]

    case 'rect':
      return [wireRectangle(width, height)]
  }
}

/** The line from a light to the point it aims at. */
function Beam({
  from,
  to,
  color,
  emphasis,
}: {
  from: Vec3
  to: Vec3
  color: string
  emphasis: Emphasis
}) {
  const line = useMemo(() => wireLine(from, to), [from, to])

  return <Wire color={color} geometry={line} opacity={opacityOf('secondary', emphasis)} />
}

const UP = new THREE.Vector3(0, 1, 0)

/** Places children at `position`, rotated so their -Z axis faces `target`. */
function Aimed({
  position,
  target,
  children,
}: {
  position: Vec3
  target: Vec3
  children: ReactNode
}) {
  const quaternion = useMemo(() => {
    const matrix = new THREE.Matrix4().lookAt(
      new THREE.Vector3(...position),
      new THREE.Vector3(...target),
      UP,
    )
    return new THREE.Quaternion().setFromRotationMatrix(matrix)
  }, [position, target])

  return (
    <group position={position} quaternion={quaternion}>
      {children}
    </group>
  )
}

/**
 * Draws one geometry and takes ownership of it: whatever is passed in is
 * disposed on unmount, so callers only have to `useMemo` it.
 */
function Wire({
  geometry,
  color,
  opacity,
}: {
  geometry: THREE.BufferGeometry
  color: string
  opacity: number
}) {
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <lineSegments geometry={geometry}>
      {/* Grey mode paints the scene to show you the light on it. A wireframe is
          not lit by anything and is the instrument you are reading it with. */}
      <lineBasicMaterial
        allowOverride={false}
        color={color}
        opacity={opacity}
        toneMapped={false}
        transparent={opacity < 1}
      />
    </lineSegments>
  )
}

function distanceBetween(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}
