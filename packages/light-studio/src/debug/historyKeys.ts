import { useEffect } from 'react'

import { isTyping } from '../runtime/keyboard'
import { useStudioStore } from './context'

/**
 * Cmd+Z and Cmd+Shift+Z, plus Ctrl+Y for the Windows habit.
 *
 * Fixed rather than configurable, unlike the toggle key. Undo is the one
 * binding that is the same in every application on every platform, so there is
 * nothing here for a user to want to change — and Z, unlike backtick, sits in
 * roughly the same place on the layouts that move things around.
 *
 * `active` is the editor being on screen. Put away, the studio is not what you
 * are editing and Cmd+Z belongs to the app around it.
 */
export function useHistoryKeys(active: boolean): void {
  const store = useStudioStore()

  useEffect(() => {
    if (!active) return

    const onKeyDown = (event: KeyboardEvent) => {
      // Either platform's modifier, so one build behaves natively on a Mac and
      // on Windows. Alt is part of none of these bindings.
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return

      const action = actionFor(event)
      if (!action) return
      // Undo inside a text field is the field's, not the rig's.
      if (isTyping(event.target)) return

      const state = store.getState()
      // A drag or a slider scrub is still open, and the snapshot it took is
      // what gets pushed when it ends. Rewinding underneath it would record a
      // step that never happened.
      if (state.transaction) return

      event.preventDefault()
      state[action]()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, store])
}

function actionFor(event: KeyboardEvent): 'undo' | 'redo' | null {
  if (pressed(event, 'KeyZ', 'z')) return event.shiftKey ? 'redo' : 'undo'
  // Ctrl+Y only. Cmd+Y is not redo on a Mac — in Firefox it opens the history
  // window — so claiming it would take a shortcut the user meant for elsewhere.
  if (event.ctrlKey && !event.metaKey && !event.shiftKey && pressed(event, 'KeyY', 'y')) {
    return 'redo'
  }
  return null
}

/**
 * Physical position or produced character, either one.
 *
 * `code` alone misses Dvorak, where the OS routes Cmd+Z by character and the
 * physical key is somewhere else entirely; `key` alone misses the layouts that
 * report a modified keypress as something other than the plain letter.
 */
function pressed(event: KeyboardEvent, code: string, key: string): boolean {
  return event.code === code || event.key.toLowerCase() === key
}
