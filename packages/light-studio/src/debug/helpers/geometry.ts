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

export function wireOctahedron(radius: number): THREE.BufferGeometry {
  const solid = new THREE.OctahedronGeometry(radius)
  const edges = new THREE.EdgesGeometry(solid)
  solid.dispose()
  return edges
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

/** Three great circles — cheaper to read than a wireframe sphere. */
export function wireSphere(radius: number): THREE.BufferGeometry {
  const positions: number[] = []
  pushCircle(positions, radius, (x, y) => [x, y, 0])
  pushCircle(positions, radius, (x, y) => [x, 0, y])
  pushCircle(positions, radius, (x, y) => [0, x, y])
  return fromPairs(positions)
}
