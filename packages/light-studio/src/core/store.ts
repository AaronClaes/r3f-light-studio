import { createStore } from 'zustand/vanilla'

import { convertLight, createLight, findLight, uniqueId, visibleLights } from './lights'
import {
  ENVIRONMENT_ID,
  LIGHT_DEFINITIONS,
  type EnvironmentConfig,
  type LightConfig,
  type LightSetup,
} from './schema'
import type { StudioState } from './state'
import { forkWith, park, sameFile } from './workspaces'

const HISTORY_LIMIT = 100

const NO_SELECTION = { selectedId: null, selectedField: 'position' } as const

function takenIds(setup: LightSetup): string[] {
  return [ENVIRONMENT_ID, ...setup.lights.map((light) => light.id)]
}

export type LightStudioStore = ReturnType<typeof createLightStudioStore>

/** One per `<LightStudio />`, so two studios never share a selection. */
export function createLightStudioStore(initial: LightSetup) {
  return createStore<StudioState>()((set, get) => {
    /** Single write path, so undo never misses an action. */
    const commit = (mutate: (draft: LightSetup) => void) =>
      set((state) => {
        const draft = structuredClone(state.setup)
        mutate(draft)

        // An edit made on the file needs somewhere to go, and the file is not
        // it. Forking keeps the file the one thing you can always get back to.
        const fork = state.activeWorkspace === null ? forkWith(state, draft) : null

        // Inside a transaction the history entry is pushed once, on end.
        if (state.transaction) return { ...fork, setup: draft, dirty: true }

        return {
          ...fork,
          setup: draft,
          past: [...state.past, state.setup].slice(-HISTORY_LIMIT),
          future: [],
          dirty: true,
        }
      })

    return {
      setup: structuredClone(initial),
      baseline: structuredClone(initial),
      ...NO_SELECTION,
      soloIds: [],
      forceBackground: false,
      grey: false,
      visible: false,
      toggleHint: null,
      saveTarget: null,
      workspaces: [],
      activeWorkspace: null,
      dirty: false,
      past: [],
      future: [],
      transaction: null,
      gizmoTookClick: false,

      select: (id, field = 'position') =>
        set(id === null ? NO_SELECTION : { selectedId: id, selectedField: field }),

      setSolo: (id, on) =>
        set((state) => {
          if (state.soloIds.includes(id) === on) return state
          return {
            soloIds: on ? [...state.soloIds, id] : state.soloIds.filter((solo) => solo !== id),
          }
        }),

      clearSolo: () => set({ soloIds: [] }),

      setForceBackground: (next) => set({ forceBackground: next }),

      setGrey: (next) => set({ grey: next }),

      setVisible: (next) => set({ visible: next }),
      toggleVisible: () => set((state) => ({ visible: !state.visible })),
      setToggleHint: (hint) => set({ toggleHint: hint }),
      setSaveTarget: (target) => set({ saveTarget: target }),

      updateLight: (id, patch) =>
        commit((draft) => {
          const light = findLight(draft, id)
          if (light) Object.assign(light, patch)
        }),

      updateEnvironment: (patch) =>
        commit((draft) => {
          Object.assign(draft.environment, patch)
        }),

      addLight: (type) => {
        const id = uniqueId(type, takenIds(get().setup))
        commit((draft) => {
          draft.lights.push(createLight(type, id))
          // A lightformer is drawn into the environment and nowhere else.
          if (type === 'lightformer') draft.environment.enabled = true
        })
        set({ selectedId: id, selectedField: 'position' })
        return id
      },

      setLightType: (id, type) => {
        const light = findLight(get().setup, id)
        if (!light || light.type === type) return

        commit((draft) => {
          draft.lights = draft.lights.map((one) => (one.id === id ? convertLight(one, type) : one))
          if (type === 'lightformer') draft.environment.enabled = true
        })

        // The gizmo has nothing to grab once the target is gone.
        if (get().selectedId === id && !('target' in LIGHT_DEFINITIONS[type].defaults)) {
          set({ selectedField: 'position' })
        }
      },

      removeLight: (id) => {
        // Otherwise an id matching nothing commits an identical setup: a dirty
        // flag and an undo step for a change that did not happen.
        if (!findLight(get().setup, id)) return

        commit((draft) => {
          draft.lights = draft.lights.filter((light) => light.id !== id)
        })
        set((state) => ({
          ...(state.selectedId === id ? NO_SELECTION : {}),
          soloIds: state.soloIds.filter((solo) => solo !== id),
        }))
      },

      duplicateLight: (id) => {
        const source = findLight(get().setup, id)
        if (!source) return null

        const newId = uniqueId(`${id}-copy`, takenIds(get().setup))
        commit((draft) => {
          const copy = structuredClone(source)
          copy.id = newId
          // An unnamed light falls back to its id, so ` copy` would show a
          // leading space rather than the copy's own id.
          copy.name = source.name ? `${source.name} copy` : ''
          draft.lights.push(copy)
        })
        set({ selectedId: newId, selectedField: 'position' })
        return newId
      },

      beginTransaction: () =>
        set((state) => (state.transaction ? state : { transaction: state.setup })),

      endTransaction: () => {
        const state = get()
        if (!state.transaction) return false

        // `commit` always clones, so an unchanged identity means nothing moved.
        if (state.transaction === state.setup) {
          set({ transaction: null })
          return false
        }

        set({
          transaction: null,
          past: [...state.past, state.transaction].slice(-HISTORY_LIMIT),
          future: [],
        })
        return true
      },

      claimClick: () => set({ gizmoTookClick: true }),

      takeClick: () => {
        if (!get().gizmoTookClick) return false
        set({ gizmoTookClick: false })
        return true
      },

      addWorkspace: () => {
        const state = get()
        const fork = forkWith(state, structuredClone(state.setup))

        // The setup does not change, so neither does `dirty`.
        set({ ...fork, past: [], future: [], transaction: null })

        return fork.activeWorkspace
      },

      switchWorkspace: (id) =>
        set((state) => {
          if (id === state.activeWorkspace) return state

          const workspaces = park(state)

          if (id === null) {
            return {
              workspaces,
              activeWorkspace: null,
              setup: structuredClone(state.baseline),
              past: [],
              future: [],
              transaction: null,
              dirty: false,
            }
          }

          const target = workspaces.find((workspace) => workspace.id === id)
          if (!target) return state

          // Selection and solo survive: they are ways of looking at a rig.
          return {
            workspaces,
            activeWorkspace: id,
            setup: structuredClone(target.setup),
            past: target.past,
            future: target.future,
            transaction: null,
            // Measured, because a workspace can hold exactly what is on disk.
            dirty: !sameFile(target.setup, state.baseline),
          }
        }),

      removeWorkspace: (id) =>
        set((state) => {
          if (!state.workspaces.some((workspace) => workspace.id === id)) return state

          const kept = park(state).filter((workspace) => workspace.id !== id)
          if (id !== state.activeWorkspace) return { workspaces: kept }

          // Deleting where you are stands you back on the file.
          return {
            workspaces: kept,
            activeWorkspace: null,
            setup: structuredClone(state.baseline),
            past: [],
            future: [],
            transaction: null,
            dirty: false,
          }
        }),

      loadWorkspaces: (workspaces, activeId) =>
        set((state) => {
          const active = workspaces.find((workspace) => workspace.id === activeId) ?? null

          return {
            workspaces,
            activeWorkspace: active?.id ?? null,
            setup: structuredClone(active?.setup ?? state.baseline),
            past: [],
            future: [],
            transaction: null,
            dirty: active ? !sameFile(active.setup, state.baseline) : false,
          }
        }),

      undo: () =>
        set((state) => {
          const previous = state.past.at(-1)
          if (!previous) return state
          return {
            setup: previous,
            past: state.past.slice(0, -1),
            future: [state.setup, ...state.future].slice(0, HISTORY_LIMIT),
            dirty: true,
          }
        }),

      redo: () =>
        set((state) => {
          const next = state.future[0]
          if (!next) return state
          return {
            setup: next,
            past: [...state.past, state.setup].slice(-HISTORY_LIMIT),
            future: state.future.slice(1),
            dirty: true,
          }
        }),

      markSaved: () =>
        set((state) => ({
          baseline: structuredClone(state.setup),
          dirty: false,
        })),

      loadSetup: (setup) =>
        set({
          setup: structuredClone(setup),
          baseline: structuredClone(setup),
          dirty: false,
          past: [],
          future: [],
          transaction: null,
          ...NO_SELECTION,
          soloIds: [],
          // Workspaces are untouched: an edit from outside is no reason to
          // throw one away.
          activeWorkspace: null,
        }),

      reset: () =>
        set((state) => ({
          setup: structuredClone(state.baseline),
          past: [...state.past, state.setup].slice(-HISTORY_LIMIT),
          future: [],
          dirty: false,
        })),
    }
  })
}

export function selectRenderableLights(state: StudioState): LightConfig[] {
  return visibleLights(state.setup.lights, state.soloIds)
}

/** Soloing anything at all hides the sky too. */
export function selectRenderableEnvironment(state: StudioState): EnvironmentConfig | null {
  const { environment } = state.setup
  if (state.soloIds.length > 0) {
    return state.soloIds.includes(ENVIRONMENT_ID) ? environment : null
  }
  return environment.enabled ? environment : null
}
