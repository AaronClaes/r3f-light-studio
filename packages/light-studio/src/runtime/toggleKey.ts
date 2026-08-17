import { useEffect, useRef } from 'react'

import { isTyping } from './keyboard'

/**
 * The key that shows and hides the editor.
 *
 * `debug` decides whether the editor exists at all; this decides whether you
 * are looking at it. They are separate because a rig you are not editing right
 * now should not have a panel sitting over your scene.
 */
export interface ToggleKey {
  /**
   * Held alongside the key. `meta` is Command on a Mac and the Windows key
   * elsewhere. Omit it for a bare keypress.
   */
  modifier?: 'meta' | 'ctrl' | 'alt' | 'shift'
  /**
   * Matched case-insensitively against both `KeyboardEvent.code` and `.key`,
   * so `'Backquote'`, `'F2'` and `'d'` all work.
   *
   * Matching `code` as well as `key` is what keeps the binding alive on
   * layouts where backtick is a dead key — there `.key` arrives as `'Dead'`
   * and a `.key`-only binding would silently stop working.
   */
  key: string
}

/**
 * F2, because it is in the same place on every keyboard.
 *
 * Backtick is the older convention — the debug console since Quake — but it
 * only sits under Esc on ANSI boards. On the ISO layouts most of Europe types
 * on it moves to the left of Z, and on several it is a dead key you have to
 * press twice. A key you have to hunt for is a bad default for a key whose
 * whole job is to be out of the way until you want it.
 */
export const DEFAULT_TOGGLE_KEY: ToggleKey = { key: 'F2' }

/**
 * How to name the binding on screen, or null when there is nothing to name.
 *
 * The close button needs this. Hiding the editor from a button and giving no
 * clue how to get it back is a dead end, and only the binding knows the answer.
 */
export function describeToggleKey(binding: ToggleKey | null): string | null {
  if (!binding) return null

  const raw = binding.key.toLowerCase()
  // A single character is a letter to be capitalised; anything longer is
  // already a name — 'F2', 'Escape' — and should be left as it was written.
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

/** Binds `onToggle` to a keypress. Pass `null` to bind nothing at all. */
export function useToggleKey(binding: ToggleKey | null, onToggle: () => void): void {
  // The listener is bound to the binding, not to the callback, which is a new
  // function on every render of the component that owns the state.
  const latest = useRef(onToggle)
  useEffect(() => {
    latest.current = onToggle
  })

  const key = binding?.key
  const modifier = binding?.modifier

  useEffect(() => {
    if (!key) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!heldExactly(event, modifier)) return
      if (!matches(event, key)) return
      if (isTyping(event.target)) return

      event.preventDefault()
      latest.current()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, modifier])
}

function matches(event: KeyboardEvent, key: string): boolean {
  const wanted = key.toLowerCase()
  return event.code.toLowerCase() === wanted || event.key.toLowerCase() === wanted
}

/**
 * The named modifier down and the others up.
 *
 * Exact rather than lenient so that a binding stays one gesture: with a bare
 * `Backquote`, Shift+` types a tilde and does not also toggle the editor.
 */
function heldExactly(event: KeyboardEvent, modifier: ToggleKey['modifier']): boolean {
  return (
    event.metaKey === (modifier === 'meta') &&
    event.ctrlKey === (modifier === 'ctrl') &&
    event.altKey === (modifier === 'alt') &&
    event.shiftKey === (modifier === 'shift')
  )
}
