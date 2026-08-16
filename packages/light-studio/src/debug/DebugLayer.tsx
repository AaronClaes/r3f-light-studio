import { useEffect, useState } from 'react'

import type { LightSetup } from '../core/schema'
import { createLightStudioStore, selectRenderableLights } from '../core/store'
import { LightRenderer } from '../runtime/LightRenderer'
import { RendererSettings } from '../runtime/RendererSettings'
import { LightStudioStoreProvider, useStudio } from './context'
import { LightHelpers } from './helpers/LightHelpers'

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

  return (
    <>
      {applyRenderer && renderer ? <RendererSettings config={renderer} /> : null}
      <LightRenderer lights={lights} />
      <LightHelpers />
    </>
  )
}
