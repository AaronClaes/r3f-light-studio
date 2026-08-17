import { useCallback, useEffect, useRef, useState } from 'react'

import { isTyping, useKeyDown } from '../../runtime/keyboard'
import { useStudio, useStudioStore } from '../context'
import { setupToJson } from '../exportSetup'
import { saveSetup } from '../save'
import { MOD } from './platform'

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

const SAVE_KEY_LABEL = `${MOD}+S`

/** Whether the rig has drifted from the file, and how to get it back into one. */
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
      // The JSON is the work, so it goes somewhere it can still be got at.
      console.warn(`[LightStudio] Could not reach the clipboard. The setup is:\n${json}`)
      copyFlash.flash('failed')
      return
    }

    // Copying counts as saving: the paste arrives back through `setup`, and
    // DebugLayer refuses an incoming setup while there are unsaved edits.
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

    // Before the file comes back through the import: recognising its own write
    // is what keeps a save from clearing the selection and the undo stack.
    store.getState().markSaved()
    saveFlash.flash('saved')
  }, [store, saveFlash])

  useSaveKey(visible && saveTarget !== null, save)

  return (
    <footer className="ls-footer">
      {/* Only while there is something to undo. It pushes a history entry,
          which is why it does not ask first. */}
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

      {/* Kept even when saving works: the one way out that needs no dev server. */}
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

/** The timer is a ref, so pressing twice restarts the confirmation. */
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
 * Only bound while there is somewhere to write, since otherwise Cmd+S is the
 * browser's. `preventDefault` is half the point: without it the browser offers
 * to write the page to your downloads.
 */
function useSaveKey(active: boolean, onSave: () => void): void {
  useKeyDown(active, (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
    if (event.code !== 'KeyS' && event.key.toLowerCase() !== 's') return
    if (isTyping(event.target)) return

    event.preventDefault()
    onSave()
  })
}

/**
 * `navigator.clipboard` needs a secure context, and a dev server reached from
 * another machine is plain http, which is exactly the phone-and-tablet case.
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
  // Off-screen rather than hidden: a field that is not displayed cannot be
  // selected, and the copy needs a real selection.
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
