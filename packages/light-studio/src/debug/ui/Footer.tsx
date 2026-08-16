import { useEffect, useRef, useState } from 'react'

import { useStudio, useStudioStore } from '../context'
import { setupToJson } from '../exportSetup'

/**
 * The bar under the panels: whether the rig has drifted from the file, and how
 * to get it back into one.
 *
 * Outside both panels rather than in either header, because it is about the
 * whole rig and it has to survive collapsing them. It is also where the
 * dev-server save will go, which is why it is a bar and not a button.
 */
export function Footer() {
  const dirty = useStudio((state) => state.dirty)
  const store = useStudioStore()
  const [status, setStatus] = useState<Status>('idle')

  // Held in a ref rather than driven by an effect on `status`, so a second
  // copy within the two seconds restarts the confirmation instead of
  // inheriting what is left of the first one's timer.
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const flash = (next: Status) => {
    clearTimeout(timer.current)
    setStatus(next)
    timer.current = window.setTimeout(() => setStatus('idle'), 2000)
  }

  const copy = async () => {
    const json = setupToJson(store.getState().setup)

    if (!(await writeToClipboard(json))) {
      // The JSON is the work. Losing it to a failed clipboard write would be
      // worse than the failure, so it goes somewhere it can still be got at.
      console.warn(`[LightStudio] Could not reach the clipboard. The setup is:\n${json}`)
      flash('failed')
      return
    }

    // Copying counts as saving. The paste that follows arrives back through
    // the `setup` prop, and DebugLayer refuses an incoming setup while there
    // are unsaved edits — so staying dirty here would reject the very file you
    // just wrote. The cost is that a copy you never paste leaves the editor
    // willing to take a new setup over the top of your edits.
    store.getState().markSaved()
    flash('copied')
  }

  return (
    <footer className="ls-footer">
      {dirty ? <span className="ls-state">Edited</span> : null}
      <button type="button" className="ls-copy" data-status={status} onClick={copy}>
        {LABELS[status]}
      </button>
    </footer>
  )
}

type Status = 'idle' | 'copied' | 'failed'

const LABELS: Record<Status, string> = {
  idle: 'Copy JSON',
  copied: 'Copied',
  failed: 'See console',
}

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
