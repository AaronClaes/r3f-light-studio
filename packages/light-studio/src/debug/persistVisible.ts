/**
 * Remembers whether the editor was on screen, for the life of the tab.
 *
 * A refresh is not a decision. You reload a dev server dozens of times an hour
 * and having to reach for F2 after every one of them is friction with nothing
 * on the other side of it.
 *
 * `sessionStorage`, not `localStorage`: this survives a reload and dies with
 * the tab, so a page opened fresh still starts hidden. That keeps the rule the
 * rest of the studio is built on — `debug` arms the editor, the toggle key
 * shows it — true for anyone who did not just close it a minute ago.
 */

const PREFIX = 'r3f-light-studio:visible'

/** Scoped by id, so two rigs on one page remember themselves separately. */
function keyFor(id: string): string {
  return `${PREFIX}:${id}`
}

export function readVisible(id: string): boolean {
  const storage = session()
  if (!storage) return false

  try {
    return storage.getItem(keyFor(id)) === 'true'
  } catch {
    // Same reasons as `session()`. Hidden is the safe answer either way.
    return false
  }
}

export function writeVisible(id: string, visible: boolean): void {
  const storage = session()
  if (!storage) return

  try {
    // An absent key means the default, which is hidden — so closing clears
    // rather than leaving a `false` behind for the tab to carry around.
    if (visible) storage.setItem(keyFor(id), 'true')
    else storage.removeItem(keyFor(id))
  } catch {
    // Nothing to do and nothing worth saying: failing to remember a panel is
    // not a problem the person editing lights can act on.
  }
}

/**
 * `sessionStorage`, or null when there isn't one.
 *
 * Absent when rendered on a server, and *present but throwing* in a sandboxed
 * iframe or with site data blocked — the property access itself is what raises
 * there, which is why this is a function and not a module-level constant.
 */
function session(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}
