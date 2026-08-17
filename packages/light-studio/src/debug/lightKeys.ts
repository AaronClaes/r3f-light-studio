import { ENVIRONMENT_ID } from '../core/schema'
import { isTyping, pressed, useKeyDown } from '../runtime/keyboard'
import { useStudioStore } from './context'

/** Cmd+D duplicates the selected light, Delete or Backspace removes it. */
export function useLightKeys(active: boolean): void {
  const store = useStudioStore()

  useKeyDown(active, (event) => {
    if (isTyping(event.target)) return

    const state = store.getState()
    if (state.transaction) return

    // The environment is the one thing you can select that is not a light.
    const selected = state.selectedId === ENVIRONMENT_ID ? null : state.selectedId

    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
      if (!pressed(event, 'KeyD', 'd')) return
      // Claimed even with nothing selected: a browser bookmarking the page on
      // the one press that found no selection would be the worse surprise.
      event.preventDefault()
      if (selected) state.duplicateLight(selected)
      return
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key !== 'Delete' && event.key !== 'Backspace') return
    // Backspace with nothing selected still means what it meant to the app.
    if (!selected) return

    event.preventDefault()
    state.removeLight(selected)
  })
}
