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
import type { ResolvedHelperStyle } from '../palette'
import { wireBox, wireCone, wireEllipse, wireLine, wireRectangle, wireSphere } from './geometry'

/**
 * What a light *does*: where it points, how far it reaches, how wide it
 * spreads. The grabbable points are `LightHandles`.
 *
 * Built from the config rather than from the rendered three lights, so nothing
 * has to be kept in sync and a light that is off still draws when selected.
 */

/** Side of the square standing in for a directional light's emitting plane. */
const PLATE_SIZE = 0.5
/** Keeps a cone from collapsing when a light sits on its own target. */
const MIN_LENGTH = 0.001
/** drei's ring keeps its inner edge at half the outer radius. */
const RING_INNER = 0.5

/** `range` is always the biggest thing on screen, so it stays furthest back. */
const ROLE = { primary: 1, secondary: 0.6, range: 0.35 }

function opacityOf(role: keyof typeof ROLE, fade: number): number {
  return ROLE[role] * fade
}

export function LightHelpers({ color, idleColor, idleOpacity }: ResolvedHelperStyle) {
  const drawn = useDrawnLights()
  const selectedId = useStudio((state) => state.selectedId)

  return (
    <>
      {drawn.map((light) => {
        const selected = light.id === selectedId
        return (
          <LightHelper
            color={selected ? color : idleColor}
            fade={selected ? 1 : idleOpacity}
            key={light.id}
            light={light}
          />
        )
      })}
    </>
  )
}

interface HelperProps<T extends LightConfig = LightConfig> {
  light: T
  fade: number
  color: string
}

function LightHelper({ light, fade, color }: HelperProps) {
  switch (light.type) {
    // No position and no direction, so there is nothing honest to draw.
    case 'ambient':
      return null

    case 'hemisphere':
      return <HemisphereHelper color={color} fade={fade} light={light} />

    case 'directional':
      return <DirectionalHelper color={color} fade={fade} light={light} />

    case 'point':
      return <PointHelper color={color} fade={fade} light={light} />

    case 'spot':
      return <SpotHelper color={color} fade={fade} light={light} />

    case 'rectArea':
      return <RectAreaHelper color={color} fade={fade} light={light} />

    case 'lightformer':
      return <LightformerHelper color={color} fade={fade} light={light} />
  }
}

function HemisphereHelper({ light, fade, color }: HelperProps<HemisphereLightConfig>) {
  // `position` is the sky direction, so this is the sky-to-ground axis.
  const axis = useMemo(() => wireLine(light.position, [0, 0, 0]), [light.position])

  return <Wire color={color} geometry={axis} opacity={opacityOf('secondary', fade)} />
}

function DirectionalHelper({ light, fade, color }: HelperProps<DirectionalLightConfig>) {
  const plate = useMemo(() => wireRectangle(PLATE_SIZE, PLATE_SIZE), [])

  return (
    <>
      <Aimed position={light.position} target={light.target}>
        <Wire color={color} geometry={plate} opacity={opacityOf('primary', fade)} />
      </Aimed>
      <Beam color={color} fade={fade} from={light.position} to={light.target} />
    </>
  )
}

function PointHelper({ light, fade, color }: HelperProps<PointLightConfig>) {
  // `distance` of 0 means no cutoff, so there is no range to draw.
  const range = useMemo(
    () => (light.distance > 0 ? wireSphere(light.distance) : null),
    [light.distance],
  )

  if (!range) return null

  return (
    <group position={light.position}>
      <Wire color={color} geometry={range} opacity={opacityOf('range', fade)} />
    </group>
  )
}

function SpotHelper({ light, fade, color }: HelperProps<SpotLightConfig>) {
  // The cutoff distance when there is one, otherwise the target: the only
  // other length the setup gives us.
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
        <Wire color={color} geometry={cone} opacity={opacityOf('primary', fade)} />
      </Aimed>
      <Beam color={color} fade={fade} from={light.position} to={light.target} />
    </>
  )
}

function RectAreaHelper({ light, fade, color }: HelperProps<RectAreaLightConfig>) {
  const shape = useMemo(() => wireRectangle(light.width, light.height), [light.width, light.height])

  return (
    <>
      <Aimed position={light.position} target={light.target}>
        <Wire color={color} geometry={shape} opacity={opacityOf('primary', fade)} />
      </Aimed>
      <Beam color={color} fade={fade} from={light.position} to={light.target} />
    </>
  )
}

/**
 * The lightformer's mesh lives in the environment's own scene, so without this
 * you would be dragging an invisible point and judging it from a reflection.
 */
function LightformerHelper({ light, fade, color }: HelperProps<LightformerConfig>) {
  const { form, width, height } = light
  const shape = useMemo(() => formGeometry(form, width, height), [form, width, height])
  const opacity = opacityOf('primary', fade)

  return (
    <>
      <Aimed position={light.position} target={light.target}>
        {shape.map((geometry) => (
          <Wire color={color} geometry={geometry} key={geometry.uuid} opacity={opacity} />
        ))}
      </Aimed>
      <Beam color={color} fade={fade} from={light.position} to={light.target} />
    </>
  )
}

function formGeometry(
  form: LightformerConfig['form'],
  width: number,
  height: number,
): THREE.BufferGeometry[] {
  switch (form) {
    case 'circle':
      return [wireEllipse(width, height)]

    // drei's ring is a disc with the middle half missing.
    case 'ring':
      return [wireEllipse(width, height), wireEllipse(width * RING_INNER, height * RING_INNER)]

    // The schema has no depth, so the renderer passes 1 for the third axis.
    case 'box':
      return [wireBox(width, height, 1)]

    case 'rect':
      return [wireRectangle(width, height)]
  }
}

function Beam({ from, to, color, fade }: { from: Vec3; to: Vec3; color: string; fade: number }) {
  const line = useMemo(() => wireLine(from, to), [from, to])

  return <Wire color={color} geometry={line} opacity={opacityOf('secondary', fade)} />
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

/** Disposes the geometry it is given, so callers only have to `useMemo` it. */
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
      {/* The instrument you read the light with, not something lit by it. */}
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
