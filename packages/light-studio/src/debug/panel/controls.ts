import type { LightConfig, LightPatch } from '../../core/schema'

/**
 * Presentation, which the schema does not describe: step sizes, which strings
 * are really a menu, how deep to nest. Nothing here imports leva.
 */

export type FieldValue = number | string | boolean | readonly number[]

/** A leva control, minus the plumbing the mirror adds. */
export type Control = Record<string, unknown>

/** Generic in its subject, because the environment is not a light. */
export interface Field<Subject = LightConfig, Patch = LightPatch> {
  /** Unique panel-wide: leva maps a `set` by leaf key and ignores the folder. */
  key: string
  /** Folder path, outermost first. Empty means top level. */
  path: string[]
  /**
   * Banded by group rather than counted, because leva keeps the settings a
   * folder was first created with and takes its order from the first field in
   * it. Counting would leave the transform folder wherever the previous light
   * type happened to put it.
   */
  order: number
  input: (subject: Subject) => Control
  read: (subject: Subject) => FieldValue
  patch: (subject: Subject, value: FieldValue) => Patch
}

export interface ControlContext {
  /** Step sizes and menus, keyed by field name. */
  ui: Record<string, Control>
  clamp?: [number, number]
  /** The complete set of values the field may hold, which makes it a menu. */
  options?: readonly string[]
}

const VECTOR_UI: Control = { step: 0.1 }

/** Null for a shape with no control, so a new schema field is skipped, not fatal. */
export function controlFor(
  key: string,
  fallback: unknown,
  context: ControlContext,
): Control | null {
  if (typeof fallback === 'string') {
    // Leva recognises colours by their value, so a free string needs nothing.
    return context.options ? menuFor(context.options) : {}
  }

  if (typeof fallback === 'boolean') return {}

  if (typeof fallback === 'number') {
    const range = context.clamp ? { min: context.clamp[0], max: context.clamp[1] } : {}
    return { ...context.ui[key], ...range }
  }

  // Vectors read from the same table, so a rotation in radians can ask for a
  // finer step than a position in metres.
  if (isVector(fallback)) return { ...VECTOR_UI, ...context.ui[key] }

  return null
}

/** Label-to-value is the only form that shows the empty string as anything. */
function menuFor(allowed: readonly string[]): Control {
  return {
    options: Object.fromEntries(allowed.map((value) => [value === '' ? 'none' : value, value])),
  }
}

/** A position or a target: the fields the gizmo can move. */
export function isVector(fallback: unknown): boolean {
  return Array.isArray(fallback) && fallback.length === 3
}

/** The configs are a union keyed by `type`, so a runtime key cannot index them. */
export function propertyOf(subject: object, key: string): unknown {
  return (subject as Record<string, unknown>)[key]
}

export function entriesOf(record: object): [string, unknown][] {
  return Object.entries(record)
}
