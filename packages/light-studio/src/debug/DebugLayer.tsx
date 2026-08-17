import { useCreateStore } from 'leva'
import { useEffect, useState } from 'react'

import type { LightSetup } from '../core/schema'
import { createLightStudioStore, selectRenderableLights } from '../core/store'
import { LightRenderer } from '../runtime/LightRenderer'
import { RendererSettings } from '../runtime/RendererSettings'
import { describeToggleKey, useToggleKey, type ToggleKey } from '../runtime/toggleKey'
import { LightStudioStoreProvider, useStudio } from './context'
import { LightHelpers } from './helpers/LightHelpers'
import { useHistoryKeys } from './historyKeys'
import { LightGizmo } from './LightGizmo'
import { LightHandles } from './LightHandles'
import { LightPanel } from './panel/LightPanel'
import { DebugUI } from './ui/DebugUI'

interface DebugLayerProps {
  setup: LightSetup
  applyRenderer: boolean
  /** Hands the edited rig back on close, so it outlives the `debug` toggle. */
  onExit: (setup: LightSetup) => void
  /** Shows and hides the editor. `null` binds nothing. */
  toggleKey: ToggleKey | null
}

/**
 * Owns the store and renders from it. That is the only difference from the
 * production path so far — helpers, gizmos and the panel slot in here.
 */
export default function DebugLayer({ setup, applyRenderer, onExit, toggleKey }: DebugLayerProps) {
  // Lazy initialiser, not useMemo: the store is created exactly once and must
  // not re-derive from `setup`, which would discard in-progress edits.
  const [store] = useState(() => createLightStudioStore(setup))

  // Bound here rather than up in LightStudio, because the store is what holds
  // the answer and it does not exist until this chunk has loaded. Nothing is
  // lost: there is no editor to show before then either.
  useToggleKey(toggleKey, () => store.getState().toggleVisible())

  // Through the store rather than as a prop: the close button that shows this
  // is in the other React root, which renders once and would hold on to
  // whatever the first render handed it.
  const toggleHint = describeToggleKey(toggleKey)
  useEffect(() => {
    store.getState().setToggleHint(toggleHint)
  }, [store, toggleHint])

  useEffect(() => {
    return () => {
      const state = store.getState()
      // Untouched means there is nothing to hand back. It also keeps
      // StrictMode's throwaway first mount from replacing the setup with a
      // copy of itself, which would reload the store it just built.
      if (state.dirty) onExit(state.setup)
    }
  }, [store, onExit])

  useEffect(() => {
    const state = store.getState()
    if (state.dirty) {
      console.warn(
        '[LightStudio] The `setup` prop changed while you have unsaved edits. Keeping your edits — call reset() to take the new setup.',
      )
      return
    }
    state.loadSetup(setup)
  }, [store, setup])

  return (
    <LightStudioStoreProvider value={store}>
      <StudioScene applyRenderer={applyRenderer} />
    </LightStudioStoreProvider>
  )
}

function StudioScene({ applyRenderer }: { applyRenderer: boolean }) {
  const renderer = useStudio((state) => state.setup.renderer)
  const lights = useStudio(selectRenderableLights)
  const visible = useStudio((state) => state.visible)

  // Here rather than in a component of its own: it is the first thing in the
  // studio that is neither scene content nor panel, and this is the innermost
  // place that can see the store.
  useHistoryKeys(visible)

  // Created here, above both React roots, because the controls are registered
  // from this tree and the panel that shows them is rendered in the other one.
  const levaStore = useCreateStore()

  return (
    <>
      {applyRenderer && renderer ? <RendererSettings config={renderer} /> : null}
      <LightRenderer lights={lights} />

      {/* Hidden, the scene is the production one: no wireframes, no grabbable
          points, no gizmo. Unmounting them is safe — they hold nothing but
          geometry, and the store they read from lives above this. */}
      {visible ? (
        <>
          <LightHelpers />
          <LightHandles />
          <LightGizmo />
        </>
      ) : null}

      {/* Both render nothing into the scene: one registers leva controls, the
          other mounts the editor's DOM in a React root of its own. Both stay
          mounted while hidden — leva reclaims its panel into a floating root
          of its own the moment the last one unmounts, which would put a panel
          on screen at exactly the moment you asked for none. */}
      <LightPanel levaStore={levaStore} />
      <DebugUI levaStore={levaStore} />
    </>
  )
}
