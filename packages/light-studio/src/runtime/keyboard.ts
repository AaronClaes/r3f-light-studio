import { useEffect, useRef } from 'react'

const TYPED_INTO = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** A keypress that lands in a field belongs to the field. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return TYPED_INTO.has(target.tagName) || target.isContentEditable
}

/** `code` alone misses Dvorak; `key` alone misses layouts that remap modified presses. */
export function pressed(event: KeyboardEvent, code: string, key: string): boolean {
  return event.code === code || event.key.toLowerCase() === key
}

/** Never rebound for a new callback, so handlers do not have to be memoised. */
export function useKeyDown(active: boolean, onKeyDown: (event: KeyboardEvent) => void): void {
  const latest = useRef(onKeyDown)
  useEffect(() => {
    latest.current = onKeyDown
  })

  useEffect(() => {
    if (!active) return

    const handle = (event: KeyboardEvent) => latest.current(event)
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [active])
}
