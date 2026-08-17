import { useCreateStore } from 'leva'
import { useEffect, useState, type ReactNode } from 'react'

import type { LightSetup } from '../core/schema'
import {
  createLightStudioStore,
  selectRenderableEnvironment,
  selectRenderableLights,
} from '../core/store'
import { LightRenderer } from '../runtime/LightRenderer'
import { describeToggleKey, useToggleKey, type ToggleKey } from '../runtime/toggleKey'
import { LightStudioStoreProvider, useStudio } from './context'
import { setupToJson } from './exportSetup'
import { GreyMode } from './GreyMode'
import { LightHelpers } from './helpers/LightHelpers'
import { useHistoryKeys } from './historyKeys'
import { LightGizmo } from './LightGizmo'
import { LightHandles } from './LightHandles'
import { useLightKeys } from './lightKeys'
import { PropertiesPanel } from './panel/PropertiesPanel'
import { readVisible, writeVisible } from './persistVisible'
import { readWorkspaces, writeWorkspaces } from './persistWorkspaces'
import { findSaveTarget } from './save'
import { DebugUI } from './ui/DebugUI'
import { useWorkspaceKeys } from './workspaceKeys'

interface DebugLayerProps {
  setup: LightSetup
  /** Hands the edited rig back on close, so it outlives the `debug` toggle. */
  onExit: (setup: LightSetup) => void
  /** Shows and hides the editor. `null` binds nothing. */
  toggleKey: ToggleKey | null
  /** Which target the dev-server plugin should write this rig to. */
  saveId: string
  /**
   * Whatever the app put in `<LightStudio.Environment>`. Passed straight
   * through: it is the app's, so the editor neither draws it nor edits it.
   */
  environmentContent: ReactNode
}

/**
 * Owns the store and renders from it. That is the only difference from the
 * production path so far — helpers, gizmos and the panel slot in here.
 */
export default function DebugLayer({
  setup,
  onExit,
  toggleKey,
  saveId,
  environmentContent,
}: DebugLayerProps) {
  // Lazy initialiser, not useMemo: the store is created exactly once and must
  // not re-derive from `setup`, which would discard in-progress edits.
  const [store] = useState(() => {
    const created = createLightStudioStore(setup)
    // Seeded before anything can subscribe, so an editor that was open before
    // the reload is open on the first frame rather than blinking into place.
    if (readVisible(saveId)) created.setState({ visible: true })
    // Null means nothing stored, and the store's own single `file` workspace
    // holding this setup is already the right fresh start.
    const stored = readWorkspaces(saveId)
    if (stored) created.getState().loadWorkspaces(stored.workspaces, stored.active)
    return created
  })

  // Written back on every change rather than on unload: a dev server reload is
  // not always a clean teardown, and this is one boolean.
  useEffect(() => {
    return store.subscribe((state, previous) => {
      if (state.visible !== previous.visible) writeVisible(saveId, state.visible)
    })
  }, [store, saveId])

  /**
   * The workspaces, debounced.
   *
   * Unlike the visibility flag this cannot be written on every change: what you
   * edit now belongs to the workspace you are in, so the trigger is every
   * keystroke and every frame of a drag. Coalescing to one write after the
   * movement stops keeps a slider scrub from serialising the whole rig sixty
   * times a second, and a reload is never close enough behind an edit to notice.
   */
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

  // Asked once, on mount: whether there is a dev-server plugin willing to
  // write this rig, and where. The Save button exists only if there is.
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

    // Our own write, coming back. Saving rewrites the file, Vite notices and
    // pushes the JSON through the import, and this effect sees a new setup a
    // moment after the one it already has. Reloading on that would clear the
    // selection, the solo and the whole undo stack every time you hit save.
    //
    // Compared as the text that would be written rather than by identity,
    // because the round trip through the file is not identity-preserving. A
    // genuine outside edit differs and still loads; an outside edit that
    // happens to match is a no-op worth skipping anyway.
    if (setupToJson(setup) === setupToJson(state.baseline)) return

    state.loadSetup(setup)
  }, [store, setup])

  return (
    <LightStudioStoreProvider value={store}>
      <StudioScene environmentContent={environmentContent} />
    </LightStudioStoreProvider>
  )
}

function StudioScene({ environmentContent }: { environmentContent: ReactNode }) {
  const lights = useStudio(selectRenderableLights)
  const environment = useStudio(selectRenderableEnvironment)
  const forceBackground = useStudio((state) => state.forceBackground)
  const visible = useStudio((state) => state.visible)

  // Here rather than in a component of their own: they are the things in the
  // studio that are neither scene content nor panel, and this is the innermost
  // place that can see the store.
  useHistoryKeys(visible)
  useLightKeys(visible)
  useWorkspaceKeys(visible)

  // Created here, above both React roots, because the controls are registered
  // from this tree and the panel that shows them is rendered in the other one.
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

      {/* Hidden, the scene is the production one: no wireframes, no grabbable
          points, no gizmo. Unmounting them is safe — they hold nothing but
          geometry, and the store they read from lives above this. */}
      {visible ? (
        <>
          <GreyMode />
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
      <PropertiesPanel levaStore={levaStore} />
      <DebugUI levaStore={levaStore} />
    </>
  )
}

/** Long enough to swallow a drag, short enough that a reload never loses one. */
const WRITE_DELAY = 400
