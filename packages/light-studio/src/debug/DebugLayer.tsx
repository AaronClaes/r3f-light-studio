import { useCreateStore } from 'leva'
import { useEffect, useState, type ReactNode } from 'react'

import type { LightSetup } from '../core/schema'
import {
  createLightStudioStore,
  selectRenderableEnvironment,
  selectRenderableLights,
} from '../core/store'
import type { HelperStyle } from '../runtime/helperStyle'
import { LightRenderer } from '../runtime/LightRenderer'
import { describeToggleKey, useToggleKey, type ToggleKey } from '../runtime/toggleKey'
import { LightStudioStoreProvider, useStudio } from './context'
import { EditorCamera } from './EditorCamera'
import { setupToJson } from './exportSetup'
import { GreyMode } from './GreyMode'
import { LightHelpers } from './helpers/LightHelpers'
import { useHistoryKeys } from './historyKeys'
import { LightGizmo } from './LightGizmo'
import { LightHandles } from './LightHandles'
import { useLightKeys } from './lightKeys'
import { forHandles, resolveHelperStyle } from './palette'
import { PropertiesPanel } from './panel/PropertiesPanel'
import { readVisible, writeVisible } from './persistVisible'
import { readWorkspaces, writeWorkspaces } from './persistWorkspaces'
import { findSaveTarget } from './save'
import { DebugUI } from './ui/DebugUI'
import { useWorkspaceKeys } from './workspaceKeys'

/** Long enough to swallow a drag, short enough that a reload never loses one. */
const WRITE_DELAY = 400

interface DebugLayerProps {
  setup: LightSetup
  /** Hands the edited rig back on close, so it outlives the `debug` toggle. */
  onExit: (setup: LightSetup) => void
  toggleKey: ToggleKey | null
  saveId: string
  environmentContent: ReactNode
  helpers?: HelperStyle
}

/** Owns the store and renders from it. Otherwise the production path. */
export default function DebugLayer({
  setup,
  onExit,
  toggleKey,
  saveId,
  environmentContent,
  helpers,
}: DebugLayerProps) {
  // Lazy initialiser, not useMemo: re-deriving from `setup` would discard
  // in-progress edits.
  const [store] = useState(() => {
    const created = createLightStudioStore(setup)
    // Seeded before anything can subscribe, so an editor that was open before
    // the reload is open on the first frame rather than blinking into place.
    if (readVisible(saveId)) created.setState({ visible: true })
    const stored = readWorkspaces(saveId)
    if (stored) created.getState().loadWorkspaces(stored.workspaces, stored.active)
    return created
  })

  // On every change rather than on unload: a dev server reload is not always a
  // clean teardown, and this is one boolean.
  useEffect(() => {
    return store.subscribe((state, previous) => {
      if (state.visible !== previous.visible) writeVisible(saveId, state.visible)
    })
  }, [store, saveId])

  // Debounced, unlike the flag above: the trigger is every keystroke and every
  // frame of a drag.
  useEffect(() => {
    let timer: number | undefined

    const unsubscribe = store.subscribe((state, previous) => {
      if (
        state.setup === previous.setup &&
        state.workspaces === previous.workspaces &&
        state.activeWorkspace === previous.activeWorkspace
      ) {
        return
      }

      clearTimeout(timer)
      timer = window.setTimeout(() => {
        const current = store.getState()
        writeWorkspaces(saveId, current.workspaces, current.activeWorkspace, current.setup)
      }, WRITE_DELAY)
    })

    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [store, saveId])

  // Bound here rather than in LightStudio, where the store does not exist yet.
  useToggleKey(toggleKey, () => store.getState().toggleVisible())

  // Through the store rather than as a prop: the close button lives in the
  // other React root, which renders once.
  const toggleHint = describeToggleKey(toggleKey)
  useEffect(() => {
    store.getState().setToggleHint(toggleHint)
  }, [store, toggleHint])

  useEffect(() => {
    let current = true
    void findSaveTarget(saveId).then((target) => {
      if (current) store.getState().setSaveTarget(target)
    })
    return () => {
      current = false
    }
  }, [store, saveId])

  useEffect(() => {
    return () => {
      const state = store.getState()
      // The `dirty` check also stops StrictMode's throwaway first mount from
      // replacing the setup with a copy of itself.
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

    // Our own write coming back: saving rewrites the file and Vite pushes it
    // through the import. Reloading on that would clear the selection, solo and
    // undo stack on every save. Compared as text, since the round trip is not
    // identity-preserving.
    if (setupToJson(setup) === setupToJson(state.baseline)) return

    state.loadSetup(setup)
  }, [store, setup])

  return (
    <LightStudioStoreProvider value={store}>
      <StudioScene environmentContent={environmentContent} helpers={helpers} />
    </LightStudioStoreProvider>
  )
}

function StudioScene({
  environmentContent,
  helpers,
}: {
  environmentContent: ReactNode
  helpers?: HelperStyle
}) {
  const lights = useStudio(selectRenderableLights)
  const environment = useStudio(selectRenderableEnvironment)
  const forceBackground = useStudio((state) => state.forceBackground)
  const visible = useStudio((state) => state.visible)
  const freeCamera = useStudio((state) => state.freeCamera)

  // Not memoised: it spreads into primitives, so a fresh object costs nothing.
  const style = resolveHelperStyle(helpers)

  useHistoryKeys(visible)
  useLightKeys(visible)
  useWorkspaceKeys(visible)

  // Created above both React roots: the controls are registered from this tree
  // and the panel showing them is rendered in the other one.
  const levaStore = useCreateStore()

  return (
    <>
      {/* Put the studio away and the override goes with it. A backdrop the rig
          asked for stays, because that one is the rig. */}
      <LightRenderer
        environment={environment}
        environmentContent={environmentContent}
        forceBackground={visible && forceBackground}
        lights={lights}
      />

      {/* Safe to unmount: they hold nothing but geometry. */}
      {visible ? (
        <>
          {freeCamera ? <EditorCamera /> : null}
          <GreyMode />
          <LightHelpers {...style} />
          <LightHandles {...forHandles(style)} />
          <LightGizmo />
        </>
      ) : null}

      {/* Both stay mounted while hidden, or leva reclaims its panel into a
          floating root at exactly the moment you asked for none. */}
      <PropertiesPanel levaStore={levaStore} />
      <DebugUI levaStore={levaStore} />
    </>
  )
}
