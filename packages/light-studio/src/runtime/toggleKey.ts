import { isTyping, useKeyDown } from './keyboard'

export interface ToggleKey {
  /** `meta` is Command on a Mac. Omit for a bare press. */
  modifier?: 'meta' | 'ctrl' | 'alt' | 'shift'
  /**
   * Matched case-insensitively against both `code` and `key`, so `'Backquote'`,
   * `'F2'` and `'d'` all work. `code` is what keeps it alive where backtick is
   * a dead key and `key` arrives as `'Dead'`.
   */
  key: string
}

/** Backtick moves to the left of Z on ISO layouts, and is a dead key on several. */
export const DEFAULT_TOGGLE_KEY: ToggleKey = { key: 'F2' }

export function describeToggleKey(binding: ToggleKey | null): string | null {
  if (!binding) return null

  const raw = binding.key.toLowerCase()
  // A single character is a letter to capitalise; longer is already a name.
  const key =
    KEY_LABELS[raw] ?? (binding.key.length === 1 ? binding.key.toUpperCase() : binding.key)

  return binding.modifier ? `${MODIFIER_LABELS[binding.modifier]}+${key}` : key
}

const KEY_LABELS: Record<string, string> = {
  backquote: '`',
  escape: 'Esc',
  space: 'Space',
}

const MODIFIER_LABELS: Record<NonNullable<ToggleKey['modifier']>, string> = {
  meta: 'Cmd',
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
}

/** Pass `null` to bind nothing at all. */
export function useToggleKey(binding: ToggleKey | null, onToggle: () => void): void {
  useKeyDown(binding !== null, (event) => {
    if (!binding) return
    if (!heldExactly(event, binding.modifier)) return
    if (!matches(event, binding.key)) return
    if (isTyping(event.target)) return

    event.preventDefault()
    onToggle()
  })
}

function matches(event: KeyboardEvent, key: string): boolean {
  const wanted = key.toLowerCase()
  return event.code.toLowerCase() === wanted || event.key.toLowerCase() === wanted
}

/** Exact, so a bare `Backquote` binding lets Shift+` type a tilde and nothing else. */
function heldExactly(event: KeyboardEvent, modifier: ToggleKey['modifier']): boolean {
  return (
    event.metaKey === (modifier === 'meta') &&
    event.ctrlKey === (modifier === 'ctrl') &&
    event.altKey === (modifier === 'alt') &&
    event.shiftKey === (modifier === 'shift')
  )
}
