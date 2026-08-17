import { isTyping, pressed, useKeyDown } from '../runtime/keyboard'
import { useStudioStore } from './context'

/** `active` is the editor being on screen. Put away, Cmd+Z belongs to the app. */
export function useHistoryKeys(active: boolean): void {
  const store = useStudioStore()

  useKeyDown(active, (event) => {
    // Either platform's modifier. Alt is part of none of these bindings.
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return

    const action = actionFor(event)
    if (!action) return
    if (isTyping(event.target)) return

    const state = store.getState()
    // A drag or scrub is open, and its snapshot is what gets pushed when it
    // ends. Rewinding underneath it would record a step that never happened.
    if (state.transaction) return

    event.preventDefault()
    state[action]()
  })
}

function actionFor(event: KeyboardEvent): 'undo' | 'redo' | null {
  if (pressed(event, 'KeyZ', 'z')) return event.shiftKey ? 'redo' : 'undo'
  // Ctrl+Y only. Cmd+Y is not redo on a Mac; in Firefox it opens history.
  if (event.ctrlKey && !event.metaKey && !event.shiftKey && pressed(event, 'KeyY', 'y')) {
    return 'redo'
  }
  return null
}
