import { isTyping, pressed, useKeyDown } from '../runtime/keyboard'
import { useStudioStore } from './context'

/**
 * A digit goes to the chip that says that digit, `0` to the file. By label
 * rather than position, so the key matches what is on screen. A digit with no
 * chip does nothing: a key that invented a workspace would be one you hit by
 * accident.
 */
export function useWorkspaceKeys(active: boolean): void {
  const store = useStudioStore()

  useKeyDown(active, (event) => {
    if (isTyping(event.target)) return
    // Cmd+1 switches browser tabs and Alt+digit reaches a menu.
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return

    const digit = digitFor(event)
    if (digit === null) return

    const state = store.getState()
    // Swapping the setup mid-drag would park a half-finished gesture.
    if (state.transaction) return

    if (digit === 0) {
      event.preventDefault()
      state.switchWorkspace(null)
      return
    }

    const wanted = state.workspaces.find((workspace) => workspace.label === String(digit))
    if (!wanted) return

    event.preventDefault()
    state.switchWorkspace(wanted.id)
  })
}

function digitFor(event: KeyboardEvent): number | null {
  for (let digit = 0; digit <= 9; digit++) {
    if (pressed(event, `Digit${digit}`, String(digit))) return digit
  }
  return null
}
