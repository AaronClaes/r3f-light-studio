import { useEffect } from 'react'

import { ENVIRONMENT_ID } from '../core/schema'
import { isTyping, pressed } from '../runtime/keyboard'
import { useStudioStore } from './context'

/**
 * Cmd+D to duplicate the selected light, Delete or Backspace to remove it.
 *
 * Both go through the store's single write path, so both are one undo step and
 * neither asks you to confirm anything — Cmd+Z is a better answer to a mistaken
 * delete than a dialog is to every deliberate one.
 *
 * `active` is the editor being on screen, the same rule as the history keys.
 * Put away, the studio is not what you are editing and Delete belongs to the
 * app around it.
 */
export function useLightKeys(active: boolean): void {
  const store = useStudioStore()

  useEffect(() => {
    if (!active) return

    const onKeyDown = (event: KeyboardEvent) => {
      // Renaming a light in the outliner is exactly the case this protects:
      // Backspace there is a character, and Cmd+D is nothing at all.
      if (isTyping(event.target)) return

      const state = store.getState()
      // Mid-drag, the snapshot the transaction took is what gets pushed when it
      // ends. Adding or removing a light underneath it would record a step that
      // never happened.
      if (state.transaction) return

      // Both keys act on a light, and the environment is the one thing you can
      // select that is not one. There is only ever the one, so there is nothing
      // to copy and nothing to remove.
      const selected = state.selectedId === ENVIRONMENT_ID ? null : state.selectedId

      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        if (!pressed(event, 'KeyD', 'd')) return
        // Claimed whether or not anything is selected. While the editor is
        // showing, Cmd+D means duplicate here, and a browser that bookmarked
        // the page instead on the one press that found no selection would be
        // the worse surprise.
        event.preventDefault()
        if (selected) state.duplicateLight(selected)
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      // Nothing selected is nothing to delete, and Backspace still means
      // whatever it meant to the app around us.
      if (!selected) return

      event.preventDefault()
      state.removeLight(selected)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, store])
}
