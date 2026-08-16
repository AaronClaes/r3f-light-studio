import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'

import { visibleLights } from '../../core/lights'
import type {
  DirectionalLightConfig,
  HemisphereLightConfig,
  LightConfig,
  PointLightConfig,
  RectAreaLightConfig,
  SpotLightConfig,
  Vec3,
} from '../../core/schema'
import { useStudio } from '../context'
import { wireCone, wireLine, wireRectangle, wireSphere } from './geometry'

/**
 * The shapes that describe what a light *does* — where it points, how far it
 * reaches, how wide it spreads. The points you can grab are drawn separately,
 * by `LightHandles`, so nothing here needs to know about selection.
 */

/** Side of the square standing in for a directional light's emitting plane. */
const PLATE_SIZE = 0.5
/** Keeps a cone from collapsing when a light sits on its own target. */
const MIN_LENGTH = 0.001

/**
 * `primary` is the shape you look at, `secondary` the beams that would
 * otherwise crowd it, `range` a falloff radius — always the biggest thing on
 * screen, so it stays out of the way. `dimmed` is a light that is off, or muted
 * by a solo: still drawn, because you need to be able to find it again.
 */
const OPACITY = { primary: 1, secondary: 0.35, range: 0.12, dimmed: 0.12 }

/**
 * Built from the config rather than from the rendered three lights. Nothing
 * here reads the scene graph, so the helpers also work for lights that are
 * switched off — which is what makes them findable again.
 */
export function LightHelpers() {
  const lights = useStudio((state) => state.setup.lights)
  const soloIds = useStudio((state) => state.soloIds)

  const lit = useMemo(
    () => new Set(visibleLights(lights, soloIds).map((light) => light.id)),
    [lights, soloIds],
  )

  return (
    <>
      {lights.map((light) => (
        <LightHelper key={light.id} dimmed={!lit.has(light.id)} light={light} />
      ))}
    </>
  )
}

interface HelperProps<T extends LightConfig = LightConfig> {
  light: T
  dimmed: boolean
}

function LightHelper({ light, dimmed }: HelperProps) {
  switch (light.type) {
    // An ambient light has neither a position nor a direction, so there is
    // nothing honest to draw for it. It is reachable from the panel instead.
    case 'ambient':
      return null

    case 'hemisphere':
      return <HemisphereHelper dimmed={dimmed} light={light} />

    case 'directional':
      return <DirectionalHelper dimmed={dimmed} light={light} />

    case 'point':
      return <PointHelper dimmed={dimmed} light={light} />

    case 'spot':
      return <SpotHelper dimmed={dimmed} light={light} />

    case 'rectArea':
      return <RectAreaHelper dimmed={dimmed} light={light} />
  }
}

function HemisphereHelper({ light, dimmed }: HelperProps<HemisphereLightConfig>) {
  // `position` is the sky direction, not a location, so the line back to the
  // origin reads as the sky-to-ground axis rather than as a beam.
  const axis = useMemo(() => wireLine(light.position, [0, 0, 0]), [light.position])

  return <Wire color={light.groundColor} geometry={axis} opacity={secondary(dimmed)} />
}

function DirectionalHelper({ light, dimmed }: HelperProps<DirectionalLightConfig>) {
  const plate = useMemo(() => wireRectangle(PLATE_SIZE, PLATE_SIZE), [])

  return (
    <>
      <Aimed position={light.position} target={light.target}>
        <Wire color={light.color} geometry={plate} opacity={primary(dimmed)} />
      </Aimed>
      <Beam color={light.color} dimmed={dimmed} from={light.position} to={light.target} />
    </>
  )
}

function PointHelper({ light }: HelperProps<PointLightConfig>) {
  // `distance` of 0 means no cutoff, so there is no range to draw and the
  // handle is the whole helper.
  const range = useMemo(
    () => (light.distance > 0 ? wireSphere(light.distance) : null),
    [light.distance],
  )

  if (!range) return null

  return (
    <group position={light.position}>
      <Wire color={light.color} geometry={range} opacity={OPACITY.range} />
    </group>
  )
}

function SpotHelper({ light, dimmed }: HelperProps<SpotLightConfig>) {
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
        <Wire color={light.color} geometry={cone} opacity={primary(dimmed)} />
      </Aimed>
      <Beam color={light.color} dimmed={dimmed} from={light.position} to={light.target} />
    </>
  )
}

function RectAreaHelper({ light, dimmed }: HelperProps<RectAreaLightConfig>) {
  const shape = useMemo(() => wireRectangle(light.width, light.height), [light.width, light.height])

  return (
    <>
      <Aimed position={light.position} target={light.target}>
        <Wire color={light.color} geometry={shape} opacity={primary(dimmed)} />
      </Aimed>
      <Beam color={light.color} dimmed={dimmed} from={light.position} to={light.target} />
    </>
  )
}

/** The line from a light to the point it aims at. */
function Beam({
  from,
  to,
  color,
  dimmed,
}: {
  from: Vec3
  to: Vec3
  color: string
  dimmed: boolean
}) {
  const line = useMemo(() => wireLine(from, to), [from, to])

  return <Wire color={color} geometry={line} opacity={secondary(dimmed)} />
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
      <lineBasicMaterial
        color={color}
        opacity={opacity}
        toneMapped={false}
        transparent={opacity < 1}
      />
    </lineSegments>
  )
}

function primary(dimmed: boolean): number {
  return dimmed ? OPACITY.dimmed : OPACITY.primary
}

function secondary(dimmed: boolean): number {
  return dimmed ? OPACITY.dimmed : OPACITY.secondary
}

function distanceBetween(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}
