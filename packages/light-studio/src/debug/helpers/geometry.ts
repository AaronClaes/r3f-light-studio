import * as THREE from 'three'

import type { Vec3 } from '../../core/schema'

/**
 * Line geometries for the debug helpers.
 *
 * Shapes with a direction are authored pointing down -Z, matching three's
 * `lookAt` convention, so a group aimed at the light's target orients them.
 *
 * Every builder returns vertex *pairs*, for `<lineSegments>`.
 */

const RIM_SEGMENTS = 32
const CONE_SPOKES = 4
const RING_DASHES = 12
/** Fraction of each dash-plus-gap that is drawn. */
const RING_DASH_DUTY = 0.55
/** Segments per dash — enough that a dash reads as an arc, not a chord. */
const RING_DASH_STEPS = 3

function fromPairs(positions: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

/** Maps a point on the unit circle into the plane the circle should lie in. */
type Project = (x: number, y: number) => Vec3

function pushCircle(into: number[], radius: number, project: Project): void {
  for (let i = 0; i < RIM_SEGMENTS; i += 1) {
    const from = (i / RIM_SEGMENTS) * Math.PI * 2
    const to = ((i + 1) / RIM_SEGMENTS) * Math.PI * 2
    into.push(
      ...project(Math.cos(from) * radius, Math.sin(from) * radius),
      ...project(Math.cos(to) * radius, Math.sin(to) * radius),
    )
  }
}

export function wireLine(from: Vec3, to: Vec3): THREE.BufferGeometry {
  return fromPairs([...from, ...to])
}

/** Centred on the origin in the XY plane, so an aimed group faces it at the target. */
export function wireRectangle(width: number, height: number): THREE.BufferGeometry {
  const x = width / 2
  const y = height / 2
  return fromPairs([-x, -y, 0, x, -y, 0, x, -y, 0, x, y, 0, x, y, 0, -x, y, 0, -x, y, 0, -x, -y, 0])
}

/** Apex at the origin, opening toward -Z. */
export function wireCone(radius: number, length: number): THREE.BufferGeometry {
  const positions: number[] = []
  pushCircle(positions, radius, (x, y) => [x, y, -length])

  for (let i = 0; i < CONE_SPOKES; i += 1) {
    const angle = (i / CONE_SPOKES) * Math.PI * 2
    positions.push(0, 0, 0, Math.cos(angle) * radius, Math.sin(angle) * radius, -length)
  }

  return fromPairs(positions)
}

/**
 * A ring of short arcs with gaps between them, in the XY plane.
 *
 * The dashes are baked into the geometry rather than drawn with
 * `LineDashedMaterial`, whose dash length is measured in local units — a handle
 * rescales every frame to hold its size on screen, which would make real dashes
 * stretch and crawl as you move the camera.
 */
export function dashedCircle(radius: number): THREE.BufferGeometry {
  const positions: number[] = []
  const dashSweep = ((Math.PI * 2) / RING_DASHES) * RING_DASH_DUTY

  for (let dash = 0; dash < RING_DASHES; dash += 1) {
    const start = (dash / RING_DASHES) * Math.PI * 2

    for (let step = 0; step < RING_DASH_STEPS; step += 1) {
      const from = start + (step / RING_DASH_STEPS) * dashSweep
      const to = start + ((step + 1) / RING_DASH_STEPS) * dashSweep
      positions.push(
        Math.cos(from) * radius,
        Math.sin(from) * radius,
        0,
        Math.cos(to) * radius,
        Math.sin(to) * radius,
        0,
      )
    }
  }

  return fromPairs(positions)
}

/** A square stood on its corner, in the XY plane. */
export function wireDiamond(radius: number): THREE.BufferGeometry {
  const r = radius
  return fromPairs([r, 0, 0, 0, r, 0, 0, r, 0, -r, 0, 0, -r, 0, 0, 0, -r, 0, 0, -r, 0, r, 0, 0])
}

/** Three great circles — cheaper to read than a wireframe sphere. */
export function wireSphere(radius: number): THREE.BufferGeometry {
  const positions: number[] = []
  pushCircle(positions, radius, (x, y) => [x, y, 0])
  pushCircle(positions, radius, (x, y) => [x, 0, y])
  pushCircle(positions, radius, (x, y) => [0, x, y])
  return fromPairs(positions)
}
