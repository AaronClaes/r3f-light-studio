import { useEffect } from 'react'

import { isTyping, pressed } from '../runtime/keyboard'
import { useStudioStore } from './context'

/**
 * A digit goes to the workspace whose chip says that digit. `0` is the file.
 *
 * Addressed by the label rather than by position, so the key matches what is on
 * screen: delete workspace 1 out of `1 2` and `2` still goes to the chip marked
 * 2. A digit with no chip does nothing, which is why there is no key for creating
 * one — a key that silently invented a workspace would be a key you pressed by
 * accident. Editing while on the file creates one, and that is deliberate rather
 * than accidental.
 *
 * Bare digits are safe to claim because `isTyping` gives them straight back to
 * any field, and the panel is mostly fields. Outside one, a digit means nothing
 * else in the editor.
 *
 * `active` is the editor being on screen, the same rule as the history and light
 * keys. Put away, the studio is not what you are editing and a digit belongs to
 * the app around it.
 */
export function useWorkspaceKeys(active: boolean): void {
  const store = useStudioStore()

  useEffect(() => {
    if (!active) return

    const onKeyDown = (event: KeyboardEvent) => {
      // A digit typed into a rename or a leva number input is a digit.
      if (isTyping(event.target)) return
      // Cmd+1 switches browser tabs and Alt+digit reaches a menu. Shift is not
      // part of this binding either, now that nothing needs a second gesture.
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return

      const digit = digitFor(event)
      if (digit === null) return

      const state = store.getState()
      // Mid-drag, the snapshot the transaction took is what gets pushed when it
      // ends. Swapping the whole setup underneath it would record a step that
      // never happened, and park a rig caught halfway through a gesture.
      if (state.transaction) return

      // 0 is the file, which is not a workspace and so is not looked up.
      if (digit === 0) {
        event.preventDefault()
        state.switchWorkspace(null)
        return
      }

      const wanted = state.workspaces.find((workspace) => workspace.label === String(digit))
      if (!wanted) return

      event.preventDefault()
      state.switchWorkspace(wanted.id)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, store])
}

/**
 * Which digit was pressed, or null for any other key.
 *
 * Both the physical key and the character it produced, for the same reason
 * `pressed` checks both: on a layout where a digit needs Shift the code is what
 * identifies it, and on a numpad the character is.
 */
function digitFor(event: KeyboardEvent): number | null {
  for (let digit = 0; digit <= 9; digit++) {
    if (pressed(event, `Digit${digit}`, String(digit))) return digit
  }
  return null
}
