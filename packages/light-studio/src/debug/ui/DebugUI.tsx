import { LevaPanel, type useCreateStore } from 'leva'
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'

import { LIGHT_DEFINITIONS, type LightType } from '../../core/schema'
import type { StudioState } from '../../core/store'
import { LightStudioStoreProvider, useStudio, useStudioStore } from '../context'
import { Outliner } from './Outliner'
import { injectStyles } from './styles'

/**
 * The editor's DOM: an outliner over a properties panel, docked right.
 *
 * ## Why this mounts its own React root
 *
 * `<LightStudio />` lives inside `<Canvas>`, so the reconciler around it is
 * r3f's — it builds THREE objects, and a `<div>` in that tree throws.
 * `createPortal` does not help, because a portal still renders through the
 * reconciler it was created under. drei's `<Html>` solves this the same way:
 * a second React root over a real DOM node.
 *
 * The two roots share state without ceremony because the studio store is a
 * vanilla zustand store behind a context rather than a hook — the same store
 * object is simply provided to both trees.
 */

/** Leva's store is not a React value, so it crosses the root boundary as a prop. */
type LevaStore = ReturnType<typeof useCreateStore>

export function DebugUI({ levaStore }: { levaStore: LevaStore }) {
  const store = useStudioStore()

  useEffect(() => {
    injectStyles()

    const container = document.createElement('div')
    container.className = 'ls-root'
    document.body.appendChild(container)

    const root = createRoot(container)
    // Rendered once. Everything inside reads the store directly, so there is
    // nothing for the outer tree to push in on re-render.
    root.render(
      <LightStudioStoreProvider value={store}>
        <StudioUI levaStore={levaStore} />
      </LightStudioStoreProvider>,
    )

    return () => {
      container.remove()
      // Unmounting inline would land inside the outer root's commit, which
      // React refuses to do synchronously.
      queueMicrotask(() => root.unmount())
    }
  }, [store, levaStore])

  return null
}

function StudioUI({ levaStore }: { levaStore: LevaStore }) {
  const selected = useStudio(selectSelected)

  return (
    <>
      <Outliner />

      <section className="ls-panel">
        <header className="ls-head">
          <span className="ls-head-title">{selected ? selected.name || selected.id : 'Light'}</span>
          {selected ? (
            <span className="ls-type">{LIGHT_DEFINITIONS[selected.type].label}</span>
          ) : null}
        </header>

        {selected ? null : <p className="ls-empty">Select a light to edit it.</p>}

        {/* Hidden rather than unmounted: leva hands the panel back to its own
            floating root the moment the last one unmounts. */}
        <div className="ls-slot" hidden={!selected}>
          <LevaPanel store={levaStore} fill flat titleBar={false} hideCopyButton />
        </div>
      </section>
    </>
  )
}

function selectSelected(state: StudioState): { id: string; name: string; type: LightType } | null {
  const light = state.setup.lights.find((candidate) => candidate.id === state.selectedId)
  return light ? { id: light.id, name: light.name, type: light.type } : null
}
