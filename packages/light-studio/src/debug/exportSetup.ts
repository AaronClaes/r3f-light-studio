import type { LightSetup } from '../core/schema'
import { serializeSetup } from '../core/serialize'

/**
 * The rig exactly as it should sit on disk.
 *
 * Separate from the serialiser, which decides *what* is written, because this
 * decides how the file *looks* — and the dev-server writeback will have to
 * agree with the copy button about both.
 */
export function setupToJson(setup: LightSetup): string {
  return `${print(serializeSetup(setup), '')}\n`
}

const INDENT = '  '

/**
 * `JSON.stringify(value, null, 2)`, except that a run of numbers stays on one
 * line.
 *
 * `[4, 6, 3]` is one value — a position — and the stock printer spreads it
 * over five. This file exists to be committed and read in diffs, so that turns
 * nudging a light into a three-line change and triples the length of the rig.
 * Positions, targets, colours and shadow frusta are all short number arrays,
 * so one rule covers every case the schema has.
 *
 * Two spaces and a trailing newline otherwise, which is what an editor or a
 * formatter would settle on anyway.
 */
function print(value: unknown, indent: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    if (value.every((item) => typeof item === 'number')) return `[${value.join(', ')}]`

    const inner = indent + INDENT
    const items = value.map((item) => inner + print(item, inner))
    return `[\n${items.join(',\n')}\n${indent}]`
  }

  if (isRecord(value)) {
    // A key the serialiser left undefined has no JSON form, and the stock
    // printer drops it. Dropping it here too keeps the two in agreement.
    const entries = Object.entries(value).filter(([, item]) => item !== undefined)
    if (entries.length === 0) return '{}'

    const inner = indent + INDENT
    const lines = entries.map(
      ([key, item]) => `${inner}${JSON.stringify(key)}: ${print(item, inner)}`,
    )
    return `{\n${lines.join(',\n')}\n${indent}}`
  }

  return JSON.stringify(value) ?? 'null'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
