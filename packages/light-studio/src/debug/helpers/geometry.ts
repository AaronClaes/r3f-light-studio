import * as THREE from 'three'

import type { Vec3 } from '../../core/schema'

/**
 * Directional shapes point down -Z, matching three's `lookAt`, so a group aimed
 * at the target orients them. Every builder returns vertex *pairs*.
 */

const RIM_SEGMENTS = 32
const CONE_SPOKES = 4
const RING_DASHES = 12
/** Fraction of each dash-plus-gap that is drawn. */
const RING_DASH_DUTY = 0.55
/** Enough that a dash reads as an arc rather than a chord. */
const RING_DASH_STEPS = 3

/** A face's corners, in order, so consecutive pairs are its edges. */
const BOX_CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const

/** `as const` so each arm destructures as a pair of numbers, not of maybes. */
const CROSS_ARMS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

function fromPairs(positions: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return geometry
}

/** Maps a point on the unit circle into the plane the circle should lie in. */
type Project = (x: number, y: number) => Vec3

function pushEllipse(into: number[], rx: number, ry: number, project: Project): void {
  for (let i = 0; i < RIM_SEGMENTS; i += 1) {
    const from = (i / RIM_SEGMENTS) * Math.PI * 2
    const to = ((i + 1) / RIM_SEGMENTS) * Math.PI * 2
    into.push(
      ...project(Math.cos(from) * rx, Math.sin(from) * ry),
      ...project(Math.cos(to) * rx, Math.sin(to) * ry),
    )
  }
}

function pushCircle(into: number[], radius: number, project: Project): void {
  pushEllipse(into, radius, radius, project)
}

export function wireLine(from: Vec3, to: Vec3): THREE.BufferGeometry {
  return fromPairs([...from, ...to])
}

/** Centred on the origin in the XY plane. */
export function wireRectangle(width: number, height: number): THREE.BufferGeometry {
  const x = width / 2
  const y = height / 2
  return fromPairs([-x, -y, 0, x, -y, 0, x, -y, 0, x, y, 0, x, y, 0, -x, y, 0, -x, y, 0, -x, -y, 0])
}

/** Width and height rather than a radius: a lightformer is scaled on two axes. */
export function wireEllipse(width: number, height: number): THREE.BufferGeometry {
  const positions: number[] = []
  pushEllipse(positions, width / 2, height / 2, (x, y) => [x, y, 0])
  return fromPairs(positions)
}

/** Twelve edges, centred on the origin, square to the axes. */
export function wireBox(width: number, height: number, depth: number): THREE.BufferGeometry {
  const x = width / 2
  const y = height / 2
  const z = depth / 2
  const positions: number[] = []

  // The near and far faces, then the four struts joining their corners.
  for (const face of [-z, z]) {
    BOX_CORNERS.forEach(([cx, cy], index) => {
      const [nx, ny] = BOX_CORNERS[(index + 1) % BOX_CORNERS.length] ?? BOX_CORNERS[0]
      positions.push(cx * x, cy * y, face, nx * x, ny * y, face)
    })
  }

  for (const [cx, cy] of BOX_CORNERS) {
    positions.push(cx * x, cy * y, -z, cx * x, cy * y, z)
  }

  return fromPairs(positions)
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
 * Dashes baked into the geometry, not `LineDashedMaterial`, whose dash length
 * is in local units: a handle rescales every frame, so real dashes would crawl.
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

/**
 * A reticle rather than a star: the gap is what you aim with, and it keeps the
 * arriving beam from reading as a fifth arm.
 */
export function wireCross(inner: number, outer: number): THREE.BufferGeometry {
  const positions: number[] = []

  for (const [x, y] of CROSS_ARMS) {
    positions.push(x * inner, y * inner, 0, x * outer, y * outer, 0)
  }

  return fromPairs(positions)
}

/** A square stood on its corner, in the XY plane. */
export function wireDiamond(radius: number): THREE.BufferGeometry {
  const r = radius
  return fromPairs([r, 0, 0, 0, r, 0, 0, r, 0, -r, 0, 0, -r, 0, 0, 0, -r, 0, 0, -r, 0, r, 0, 0])
}

/** Three great circles, cheaper to read than a wireframe sphere. */
export function wireSphere(radius: number): THREE.BufferGeometry {
  const positions: number[] = []
  pushCircle(positions, radius, (x, y) => [x, y, 0])
  pushCircle(positions, radius, (x, y) => [x, 0, y])
  pushCircle(positions, radius, (x, y) => [0, x, y])
  return fromPairs(positions)
}
