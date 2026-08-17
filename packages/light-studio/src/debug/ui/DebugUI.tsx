import { LevaPanel } from 'leva'
import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'

import { findLight } from '../../core/lights'
import { ENVIRONMENT_ID, LIGHT_DEFINITIONS } from '../../core/schema'
import type { StudioState } from '../../core/state'
import { LightStudioStoreProvider, useStudio, useStudioStore } from '../context'
import type { LevaStore } from '../panel/levaMirror'
import { Footer } from './Footer'
import { Outliner } from './Outliner'
import { Panel } from './Panel'
import { injectStyles } from './styles'
import { Workspaces } from './Workspaces'

/**
 * A React root of its own, because `<LightStudio />` lives inside `<Canvas>`,
 * where the reconciler builds THREE objects and a `<div>` throws. `createPortal`
 * does not help: a portal renders through the reconciler it was created under.
 */
export function DebugUI({ levaStore }: { levaStore: LevaStore }) {
  const store = useStudioStore()
  const visible = useStudio((state) => state.visible)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    injectStyles()

    const container = document.createElement('div')
    container.className = 'ls-root'
    container.hidden = true
    document.body.appendChild(container)
    containerRef.current = container

    const root = createRoot(container)
    // Rendered once: everything inside reads the store directly.
    root.render(
      <LightStudioStoreProvider value={store}>
        <StudioUI levaStore={levaStore} />
      </LightStudioStoreProvider>,
    )

    return () => {
      containerRef.current = null
      container.remove()
      // Unmounting inline would land inside the outer root's commit, which
      // React refuses to do synchronously.
      queueMicrotask(() => root.unmount())
    }
  }, [store, levaStore])

  // On the container, not by unmounting: the tree owns state worth keeping, and
  // leva's panel has to stay mounted regardless.
  useEffect(() => {
    const container = containerRef.current
    if (container) container.hidden = !visible
  }, [visible])

  return null
}

function StudioUI({ levaStore }: { levaStore: LevaStore }) {
  const selected = useStudio(selectSelected)

  return (
    <>
      <Workspaces />

      <Outliner />

      <Panel
        title={selected?.title ?? 'Light'}
        aside={selected?.label ? <span className="ls-type">{selected.label}</span> : null}
      >
        {selected ? null : <p className="ls-empty">Select a light to edit it.</p>}

        {/* Hidden rather than unmounted, for the same reason as above. */}
        <div className="ls-slot" hidden={!selected}>
          <LevaPanel store={levaStore} fill flat titleBar={false} hideCopyButton />
        </div>
      </Panel>

      <Footer />
    </>
  )
}

/** The environment gets no type label: "Environment" twice is worse than once. */
function selectSelected(state: StudioState): { title: string; label: string | null } | null {
  if (state.selectedId === ENVIRONMENT_ID) return { title: 'Environment', label: null }

  const light = findLight(state.setup, state.selectedId)
  if (!light) return null
  return { title: light.name || light.id, label: LIGHT_DEFINITIONS[light.type].label }
}
