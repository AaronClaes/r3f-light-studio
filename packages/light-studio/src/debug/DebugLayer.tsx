import { useCreateStore } from 'leva'
import { useEffect, useState } from 'react'

import type { LightSetup } from '../core/schema'
import { createLightStudioStore, selectRenderableLights } from '../core/store'
import { LightRenderer } from '../runtime/LightRenderer'
import { RendererSettings } from '../runtime/RendererSettings'
import { LightStudioStoreProvider, useStudio } from './context'
import { LightHelpers } from './helpers/LightHelpers'
import { LightGizmo } from './LightGizmo'
import { LightHandles } from './LightHandles'
import { LightPanel } from './panel/LightPanel'
import { DebugUI } from './ui/DebugUI'

interface DebugLayerProps {
  setup: LightSetup
  applyRenderer: boolean
}

/**
 * Owns the store and renders from it. That is the only difference from the
 * production path so far — helpers, gizmos and the panel slot in here.
 */
export default function DebugLayer({ setup, applyRenderer }: DebugLayerProps) {
  // Lazy initialiser, not useMemo: the store is created exactly once and must
  // not re-derive from `setup`, which would discard in-progress edits.
  const [store] = useState(() => createLightStudioStore(setup))

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

  // Created here, above both React roots, because the controls are registered
  // from this tree and the panel that shows them is rendered in the other one.
  const levaStore = useCreateStore()

  return (
    <>
      {applyRenderer && renderer ? <RendererSettings config={renderer} /> : null}
      <LightRenderer lights={lights} />
      <LightHelpers />
      <LightHandles />
      <LightGizmo />
      {/* Both render nothing into the scene: one registers leva controls, the
          other mounts the editor's DOM in a React root of its own. */}
      <LightPanel levaStore={levaStore} />
      <DebugUI levaStore={levaStore} />
    </>
  )
}
