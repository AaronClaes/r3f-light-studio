import { createStore } from 'zustand/vanilla'

import { createLight, uniqueId, visibleLights } from './lights'
import {
  DEFAULT_RENDERER,
  type LightConfig,
  type LightPatch,
  type LightSetup,
  type LightType,
  type RendererConfig,
} from './schema'

const HISTORY_LIMIT = 100

function findLight(setup: LightSetup, id: string): LightConfig | undefined {
  return setup.lights.find((light) => light.id === id)
}

function takenIds(setup: LightSetup): string[] {
  return setup.lights.map((light) => light.id)
}

export interface StudioState {
  /** Working copy. Diverges from `baseline` as soon as anything is edited. */
  setup: LightSetup
  /** Last state that matches what is on disk. `reset()` returns here. */
  baseline: LightSetup
  selectedId: string | null
  /** Non-empty means "show only these". Never serialised. */
  soloIds: string[]
  dirty: boolean
  past: LightSetup[]
  future: LightSetup[]

  select: (id: string | null) => void
  toggleSolo: (id: string) => void
  clearSolo: () => void

  updateLight: (id: string, patch: LightPatch) => void
  addLight: (type: LightType) => string
  removeLight: (id: string) => void
  duplicateLight: (id: string) => string | null
  setRenderer: (patch: Partial<RendererConfig>) => void

  undo: () => void
  redo: () => void
  /** Call after a successful save; the working copy becomes the new baseline. */
  markSaved: () => void
  loadSetup: (setup: LightSetup) => void
  reset: () => void
}

export type LightStudioStore = ReturnType<typeof createLightStudioStore>

/** One store per `<LightStudio />` — two studios must not share selection. */
export function createLightStudioStore(initial: LightSetup) {
  return createStore<StudioState>()((set, get) => {
    /** Single write path, so undo never misses an action. */
    const commit = (mutate: (draft: LightSetup) => void) =>
      set((state) => {
        const draft = structuredClone(state.setup)
        mutate(draft)
        return {
          setup: draft,
          past: [...state.past, state.setup].slice(-HISTORY_LIMIT),
          future: [],
          dirty: true,
        }
      })

    return {
      setup: structuredClone(initial),
      baseline: structuredClone(initial),
      selectedId: null,
      soloIds: [],
      dirty: false,
      past: [],
      future: [],

      select: (id) => set({ selectedId: id }),

      toggleSolo: (id) =>
        set((state) => ({
          soloIds: state.soloIds.includes(id)
            ? state.soloIds.filter((solo) => solo !== id)
            : [...state.soloIds, id],
        })),

      clearSolo: () => set({ soloIds: [] }),

      updateLight: (id, patch) =>
        commit((draft) => {
          const light = findLight(draft, id)
          if (light) Object.assign(light, patch)
        }),

      addLight: (type) => {
        const id = uniqueId(type, takenIds(get().setup))
        commit((draft) => {
          draft.lights.push(createLight(type, id))
        })
        set({ selectedId: id })
        return id
      },

      removeLight: (id) => {
        commit((draft) => {
          draft.lights = draft.lights.filter((light) => light.id !== id)
        })
        set((state) => ({
          selectedId: state.selectedId === id ? null : state.selectedId,
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
          copy.name = `${source.name} copy`
          draft.lights.push(copy)
        })
        set({ selectedId: newId })
        return newId
      },

      setRenderer: (patch) =>
        commit((draft) => {
          draft.renderer = { ...DEFAULT_RENDERER, ...draft.renderer, ...patch }
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
          selectedId: null,
          soloIds: [],
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
