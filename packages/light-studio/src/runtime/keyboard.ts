const TYPED_INTO = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Whether a keypress landed somewhere it means text rather than a command.
 *
 * Shared by every binding in the studio, because they all have the same
 * problem: the panel is mostly text fields and the outliner renames in place.
 * An unmodified key would fire mid-word, and an undo would roll back the rig
 * instead of the half-typed name in front of you. A keypress that lands in a
 * field belongs to the field.
 */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return TYPED_INTO.has(target.tagName) || target.isContentEditable
}

/**
 * Physical position or produced character, either one.
 *
 * `code` alone misses Dvorak, where the OS routes Cmd+Z by character and the
 * physical key is somewhere else entirely; `key` alone misses the layouts that
 * report a modified keypress as something other than the plain letter.
 */
export function pressed(event: KeyboardEvent, code: string, key: string): boolean {
  return event.code === code || event.key.toLowerCase() === key
}
