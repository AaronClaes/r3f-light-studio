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
 * `dimmed` is a light that is off, or muted by someone else's solo.
 */
const EMPHASIS = { selected: 1, idle: 0.28, dimmed: 0.12 }

type Emphasis = keyof typeof EMPHASIS

function opacityOf(role: keyof typeof ROLE, emphasis: Emphasis): number {
  return ROLE[role] * EMPHASIS[emphasis]
}

/**
 * Built from the config rather than from the rendered three lights. Nothing
 * here reads the scene graph, so the helpers also work for lights that are
 * switched off — which is what makes them findable again.
 */
export function LightHelpers() {
  const lights = useStudio((state) => state.setup.lights)
  const soloIds = useStudio((state) => state.soloIds)
  const selectedId = useStudio((state) => state.selectedId)

  const lit = useMemo(
    () => new Set(visibleLights(lights, soloIds).map((light) => light.id)),
    [lights, soloIds],
  )

  return (
    <>
      {lights.map((light) => (
        <LightHelper
          key={light.id}
          emphasis={emphasisOf(light.id, selectedId, lit)}
          light={light}
        />
      ))}
    </>
  )
}

function emphasisOf(id: string, selectedId: string | null, lit: ReadonlySet<string>): Emphasis {
  if (id === selectedId) return 'selected'
  return lit.has(id) ? 'idle' : 'dimmed'
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
      <lineBasicMaterial
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
