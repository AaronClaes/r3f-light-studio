/**
 * The contract between the dev-server plugin and the editor.
 *
 * Both ends need these and neither can import the other: the plugin is Node
 * code that reads the filesystem, the editor is browser code that must never
 * pull `node:fs` into a bundle. Here, where there is nothing but constants and
 * a shape, they can agree.
 */

/** Where the plugin listens. Namespaced so an app route cannot collide. */
export const SAVE_ROUTE = '/__light-studio'

/**
 * The id a `<LightStudio />` uses when it does not name one, and the id a
 * bare-string plugin config registers its single file under.
 */
export const DEFAULT_SAVE_ID = 'default'

export interface SaveTarget {
  id: string
  /** Where the plugin will write, relative to the Vite root. Shown in the UI. */
  path: string
}
