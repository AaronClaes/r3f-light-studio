/** `sessionStorage`, not `localStorage`: this survives a reload and dies with the tab. */

const PREFIX = 'r3f-light-studio'

/** Scoped by rig id, so two studios on one page keep their own. */
export function keyFor(scope: string, id: string): string {
  return `${PREFIX}:${scope}:${id}`
}

export function readSession(key: string): string | null {
  try {
    // Absent on a server, and present but throwing in a sandboxed iframe or
    // with site data blocked, where the property access itself raises.
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

/** Null clears the key, so an absent key always means the default. */
export function writeSession(key: string, value: string | null): void {
  try {
    if (typeof sessionStorage === 'undefined') return
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    // Quota, a sandboxed iframe, blocked site data. Not worth a warning.
  }
}
