import { isRecord } from '../core/json'
import type { LightSetup } from '../core/schema'
import { serializeSetup } from '../core/serialize'

/** How the file looks, where `serializeSetup` decides what is in it. */
export function setupToJson(setup: LightSetup): string {
  return `${print(serializeSetup(setup), '')}\n`
}

const INDENT = '  '

/**
 * `JSON.stringify(value, null, 2)`, except a run of numbers stays on one line.
 * The stock printer spreads `[4, 6, 3]` over five, which turns nudging a light
 * into a three-line diff.
 */
function print(value: unknown, indent: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    if (value.every((item) => typeof item === 'number')) {
      return `[${value.map(round).join(', ')}]`
    }

    const inner = indent + INDENT
    const items = value.map((item) => inner + print(item, inner))
    return `[\n${items.join(',\n')}\n${indent}]`
  }

  if (isRecord(value)) {
    // The stock printer drops undefined keys, so this agrees with it.
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

/**
 * A millimetre at scene scale. Only numbers inside arrays go through this: an
 * intensity of `0.0001` is a real value that rounding would flatten to zero.
 */
function round(value: number): number {
  if (!Number.isFinite(value)) return value
  const rounded = Math.round(value * 1000) / 1000
  // `Math.round(-0.0004 * 1000) / 1000` is -0, which prints as "-0".
  return Object.is(rounded, -0) ? 0 : rounded
}
