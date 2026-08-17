/**
 * Shared by the dev-server plugin and the editor, neither of which can import
 * the other: one is Node code, the other must never pull `node:fs` into a bundle.
 */

/** Namespaced so an app route cannot collide. */
export const SAVE_ROUTE = '/__light-studio'

export const DEFAULT_SAVE_ID = 'default'

export interface SaveTarget {
  id: string
  /** Relative to the Vite root. Shown in the UI. */
  path: string
}
