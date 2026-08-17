/**
 * Talking to the dev-server plugin.
 *
 * Plain `fetch` on the same origin rather than Vite's HMR channel, which would
 * have been the tidier choice but does not survive publication: an installed
 * package is pre-bundled out of `node_modules`, and Vite gives that code no
 * HMR context at all, so `import.meta.hot` would be undefined for exactly the
 * people who install this. It works in a workspace only because the link
 * resolves to source. A request to the origin the page came from does not care
 * where the code was resolved from.
 */

import { SAVE_ROUTE, type SaveTarget } from '../core/save'

/**
 * What the plugin will let us write under `id`, or null if it will not.
 *
 * Null covers every way this can be unavailable — no plugin, not a Vite dev
 * server, an id nobody declared — because the button that depends on it just
 * needs to know whether to exist.
 */
export async function findSaveTarget(id: string): Promise<SaveTarget | null> {
  const targets = await fetchTargets()
  if (!targets) return null

  const path = targets[id]
  if (path === undefined) {
    // Worth saying out loud. The plugin is installed, so someone meant for
    // this to work, and a missing Save button gives no clue why it does not.
    console.warn(
      `[LightStudio] No save target named "${id}". vite.config declares: ${
        Object.keys(targets).join(', ') || 'nothing'
      }.`,
    )
    return null
  }

  return { id, path }
}

async function fetchTargets(): Promise<Record<string, string> | null> {
  let payload: unknown
  try {
    const response = await fetch(`${SAVE_ROUTE}/targets`)
    if (!response.ok) return null
    payload = await response.json()
  } catch {
    // No dev server, no plugin, offline, or the SPA fallback served HTML that
    // did not parse. All the same answer: you cannot save from here.
    return null
  }

  // A dev server without the plugin answers unknown paths with index.html, and
  // some setups answer with JSON of their own. The marker is what tells our
  // plugin apart from whatever else replied.
  if (!isRecord(payload) || payload.lightStudio !== true) return null
  return isRecord(payload.targets) ? (payload.targets as Record<string, string>) : null
}

/** Writes the file. Resolves to an error message, or null when it worked. */
export async function saveSetup(id: string, json: string): Promise<string | null> {
  try {
    const response = await fetch(`${SAVE_ROUTE}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, json }),
    })

    if (response.ok) return null

    const payload: unknown = await response.json().catch(() => null)
    if (isRecord(payload) && typeof payload.error === 'string') return payload.error
    return `The dev server answered ${response.status}.`
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
