import { isRecord } from '../core/json'
import { SAVE_ROUTE, type SaveTarget } from '../core/save'

/**
 * Plain `fetch` rather than Vite's HMR channel, which does not survive
 * publication: an installed package is pre-bundled out of `node_modules` and
 * gets no HMR context, so `import.meta.hot` would be undefined.
 */

/** Null covers every way saving can be unavailable. */
export async function findSaveTarget(id: string): Promise<SaveTarget | null> {
  const targets = await fetchTargets()
  if (!targets) return null

  const path = targets[id]
  if (path === undefined) {
    // The plugin is installed, so someone meant this to work, and a missing
    // Save button gives no clue why it is missing.
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
    return null
  }

  // A dev server without the plugin answers unknown paths with index.html, and
  // some setups answer with JSON of their own.
  if (!isRecord(payload) || payload.lightStudio !== true) return null
  return isRecord(payload.targets) ? (payload.targets as Record<string, string>) : null
}

/** Resolves to an error message, or null when it worked. */
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
