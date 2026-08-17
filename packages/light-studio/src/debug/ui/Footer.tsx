import { useCallback, useEffect, useRef, useState } from 'react'

import { isTyping } from '../../runtime/keyboard'
import { useStudio, useStudioStore } from '../context'
import { setupToJson } from '../exportSetup'
import { saveSetup } from '../save'

/**
 * The bar under the panels: whether the rig has drifted from the file, and how
 * to get it back into one.
 *
 * Outside both panels rather than in either header, because it is about the
 * whole rig and it has to survive collapsing them.
 */
export function Footer() {
  const dirty = useStudio((state) => state.dirty)
  const visible = useStudio((state) => state.visible)
  const saveTarget = useStudio((state) => state.saveTarget)
  const store = useStudioStore()

  const copyFlash = useFlash<CopyStatus>('idle')
  const saveFlash = useFlash<SaveStatus>('idle')

  const copy = async () => {
    const json = setupToJson(store.getState().setup)

    if (!(await writeToClipboard(json))) {
      // The JSON is the work. Losing it to a failed clipboard write would be
      // worse than the failure, so it goes somewhere it can still be got at.
      console.warn(`[LightStudio] Could not reach the clipboard. The setup is:\n${json}`)
      copyFlash.flash('failed')
      return
    }

    // Copying counts as saving. The paste that follows arrives back through
    // the `setup` prop, and DebugLayer refuses an incoming setup while there
    // are unsaved edits — so staying dirty here would reject the very file you
    // just wrote. The cost is that a copy you never paste leaves the editor
    // willing to take a new setup over the top of your edits.
    store.getState().markSaved()
    copyFlash.flash('copied')
  }

  const save = useCallback(async () => {
    const state = store.getState()
    const target = state.saveTarget
    if (!target) return

    const error = await saveSetup(target.id, setupToJson(state.setup))
    if (error) {
      console.warn(`[LightStudio] Could not write ${target.path}. ${error}`)
      saveFlash.flash('failed')
      return
    }

    // Before the file finds its way back through the import, not after.
    // DebugLayer compares whatever arrives against the baseline this sets, and
    // recognising its own write is what keeps a save from clearing the
    // selection and the undo stack.
    store.getState().markSaved()
    saveFlash.flash('saved')
  }, [store, saveFlash])

  // Only while the editor is on screen and there is somewhere to write. Put
  // away, Cmd+S is the browser's, and taking it to do nothing would be worse
  // than not taking it.
  useSaveKey(visible && saveTarget !== null, save)

  return (
    <footer className="ls-footer">
      {/* Both only while there is something to say or undo. A Reset that is
          always there is a permanent invitation to throw the session away;
          one that appears with the edits it would discard is a way out of
          them. It pushes a history entry like any other change, so Cmd+Z
          brings the rig straight back — which is why it does not ask. */}
      {dirty ? (
        <>
          <span className="ls-state">Edited</span>
          <button
            type="button"
            className="ls-reset"
            onClick={() => store.getState().reset()}
            title="Put every light back to the file. Undoable."
          >
            Reset
          </button>
        </>
      ) : null}

      {/* Kept even when saving works. Not everyone editing a rig is on a Vite
          dev server — a Storybook, a deployed preview, someone else's app —
          and this is the one way out that needs nothing installed. */}
      <button
        type="button"
        className="ls-copy"
        data-status={copyFlash.status}
        onClick={copy}
        title="Copy the rig as JSON, to paste over the file."
      >
        {COPY_LABELS[copyFlash.status]}
      </button>

      {saveTarget ? (
        <button
          type="button"
          className="ls-save"
          data-status={saveFlash.status}
          onClick={save}
          title={`Write ${saveTarget.path} (${SAVE_KEY_LABEL})`}
        >
          {SAVE_LABELS[saveFlash.status]}
        </button>
      ) : null}
    </footer>
  )
}

type CopyStatus = 'idle' | 'copied' | 'failed'
type SaveStatus = 'idle' | 'saved' | 'failed'

const COPY_LABELS: Record<CopyStatus, string> = {
  idle: 'Copy JSON',
  copied: 'Copied',
  failed: 'See console',
}

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle: 'Save',
  saved: 'Saved',
  failed: 'Failed',
}

/**
 * A label that says what just happened and then goes back to saying what the
 * button does.
 *
 * The timer is a ref rather than an effect on the status, so pressing twice
 * inside the two seconds restarts the confirmation instead of inheriting what
 * was left of the first one's.
 */
function useFlash<T extends string>(idle: T) {
  const [status, setStatus] = useState<T>(idle)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const flash = useCallback(
    (next: T) => {
      clearTimeout(timer.current)
      setStatus(next)
      timer.current = window.setTimeout(() => setStatus(idle), 2000)
    },
    [idle],
  )

  return { status, flash }
}

/**
 * Cmd+S, or Ctrl+S. Both are accepted so one build behaves natively on either
 * platform, and `preventDefault` is the point as much as the save is — the
 * alternative is the browser offering to write the page to your downloads.
 */
function useSaveKey(active: boolean, onSave: () => void): void {
  const latest = useRef(onSave)
  useEffect(() => {
    latest.current = onSave
  })

  useEffect(() => {
    if (!active) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      if (event.code !== 'KeyS' && event.key.toLowerCase() !== 's') return
      if (isTyping(event.target)) return

      event.preventDefault()
      latest.current()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])
}

/** Only ever shown in a tooltip, so a cheap platform guess is good enough. */
const SAVE_KEY_LABEL = /mac/i.test(navigator.platform) ? 'Cmd+S' : 'Ctrl+S'

/**
 * The clipboard API, then the old selection trick.
 *
 * `navigator.clipboard` exists only in a secure context, and a dev server
 * reached from another machine on the network is plain http — which is exactly
 * the setup you are in when you are tuning a scene on a phone or a tablet.
 * `execCommand` is deprecated and is still the only thing that works there.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return copyBySelection(text)
  }
}

function copyBySelection(text: string): boolean {
  const field = document.createElement('textarea')
  field.value = text
  // Off-screen rather than hidden: the selection has to be a real one for the
  // copy to take, and a field that is not displayed cannot be selected.
  field.style.cssText = 'position:fixed;top:-9999px;opacity:0'
  document.body.appendChild(field)
  field.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}
