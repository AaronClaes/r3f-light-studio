import * as THREE from 'three'

import type { LightType } from '../../core/schema'

/** Enough that a rim reads as a curve at the size these are drawn. */
const ARC_STEPS = 24

const SUN_RAYS = 8

type Point = readonly [number, number]

function shapeFrom(points: readonly Point[]): THREE.Shape {
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
}

/** Corners in order, so the shape closes as a box. */
function box(left: number, bottom: number, right: number, top: number): THREE.Shape {
  return shapeFrom([
    [left, bottom],
    [right, bottom],
    [right, top],
    [left, top],
  ])
}

/** Samples `from` to `to` in radians, inclusive of both, for splicing into a polygon. */
function arc(cx: number, cy: number, radius: number, from: number, to: number): Point[] {
  const points: Point[] = []

  for (let step = 0; step <= ARC_STEPS; step += 1) {
    const angle = from + ((to - from) * step) / ARC_STEPS
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius])
  }

  return points
}

const degrees = (value: number): number => (value * Math.PI) / 180

/**
 * Tapered spokes, narrower at the tip. Each is built lying along +X and then
 * rotated, which keeps the arithmetic to one ray.
 */
function rays(
  count: number,
  inner: number,
  outer: number,
  base: number,
  tip: number,
): THREE.Shape[] {
  const shapes: THREE.Shape[] = []

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const spoke: Point[] = [
      [inner, -base],
      [outer, -tip],
      [outer, tip],
      [inner, base],
    ]

    shapes.push(shapeFrom(spoke.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos] as const)))
  }

  return shapes
}

/** A sun: a disc held clear of its own rays. */
function sun(): THREE.Shape[] {
  return [shapeFrom(arc(0, 0, 0.34, 0, Math.PI * 2)), ...rays(SUN_RAYS, 0.5, 0.92, 0.085, 0.045)]
}

/** A bulb, as one closed silhouette: glass tapering into a straight base. */
function bulb(): THREE.Shape[] {
  return [
    shapeFrom([
      ...arc(0, 0.18, 0.45, degrees(-25), degrees(205)),
      [-0.26, -0.3],
      [-0.26, -0.62],
      [0.26, -0.62],
      [0.26, -0.3],
    ]),
  ]
}

/**
 * A fixture over the light it throws. The two have to splay at very different
 * rates: made alike, they read as two stacked lampshades rather than as a
 * housing and a beam.
 */
function spot(): THREE.Shape[] {
  return [
    shapeFrom([
      [-0.22, 0.66],
      [0.22, 0.66],
      [0.36, 0.26],
      [-0.36, 0.26],
    ]),
    shapeFrom([
      [-0.26, 0.12],
      [0.26, 0.12],
      [0.74, -0.66],
      [-0.74, -0.66],
    ]),
  ]
}

/** A panel shedding light downward. Solid, where a lightformer is a frame. */
function panel(): THREE.Shape[] {
  const drops = [-0.36, 0, 0.36].map((x) => box(x - 0.055, -0.46, x + 0.055, -0.02))
  return [box(-0.62, 0.1, 0.62, 0.6), ...drops]
}

/**
 * A frame, for the one source that is a shape in the environment rather than a
 * three light. Hollow, so it never has to be told apart from `panel` by size.
 */
function frame(): THREE.Shape[] {
  const outline = box(-0.66, -0.46, 0.66, 0.46)
  outline.holes.push(
    new THREE.Path([
      new THREE.Vector2(-0.44, -0.24),
      new THREE.Vector2(0.44, -0.24),
      new THREE.Vector2(0.44, 0.24),
      new THREE.Vector2(-0.44, 0.24),
    ]),
  )
  return [outline]
}

/** Sky over ground: a dome and the horizon it sits above. */
function dome(): THREE.Shape[] {
  return [shapeFrom(arc(0, 0.04, 0.62, 0, Math.PI)), box(-0.62, -0.38, 0.62, -0.16)]
}

/**
 * `null` where a type has no place to draw one. Ambient light has no position,
 * so it never gets a handle to put a glyph on.
 */
export function lightGlyph(type: LightType): THREE.BufferGeometry | null {
  const shapes = shapesFor(type)
  return shapes ? new THREE.ShapeGeometry(shapes) : null
}

function shapesFor(type: LightType): THREE.Shape[] | null {
  switch (type) {
    case 'ambient':
      return null

    case 'hemisphere':
      return dome()

    case 'directional':
      return sun()

    case 'point':
      return bulb()

    case 'spot':
      return spot()

    case 'rectArea':
      return panel()

    case 'lightformer':
      return frame()
  }
}
