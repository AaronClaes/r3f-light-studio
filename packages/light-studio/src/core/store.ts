import { createStore } from 'zustand/vanilla'

import { createLight, uniqueId, visibleLights } from './lights'
import {
  DEFAULT_RENDERER,
  type LightConfig,
  type LightPatch,
  type LightSetup,
  type LightType,
  type RendererConfig,
  type VectorField,
} from './schema'

const HISTORY_LIMIT = 100

/** Selecting a light always starts on its own point, never on its target. */
const NO_SELECTION = { selectedId: null, selectedField: 'position' } as const

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
  /** Which of the selected light's points is being edited. */
  selectedField: VectorField
  /** Non-empty means "show only these". Never serialised. */
  soloIds: string[]
  dirty: boolean
  past: LightSetup[]
  future: LightSetup[]
  /**
   * The setup as it was when a drag or slider scrub began, or null when no
   * edit is in flight. Everything committed while this is open collapses into
   * a single undo step.
   */
  transaction: LightSetup | null

  select: (id: string | null, field?: VectorField) => void
  /**
   * Set rather than toggle, so dragging across a column of them can repeat the
   * same value over a row it has already reached without flipping it back.
   */
  setSolo: (id: string, on: boolean) => void
  clearSolo: () => void

  updateLight: (id: string, patch: LightPatch) => void
  addLight: (type: LightType) => string
  removeLight: (id: string) => void
  duplicateLight: (id: string) => string | null
  setRenderer: (patch: Partial<RendererConfig>) => void

  /** Start coalescing edits. Nested calls keep the outermost snapshot. */
  beginTransaction: () => void
  /**
   * Stop coalescing and push one history entry. Returns whether anything
   * actually changed, which tells a drag apart from a click that missed.
   */
  endTransaction: () => boolean

  /**
   * True when the gizmo took the press behind the click being handled now.
   *
   * r3f reports a click as a miss on every object it did not hit, and the
   * gizmo is not one of r3f's objects — so without this, tapping a gizmo axis
   * would clear the very selection the gizmo is attached to.
   */
  gizmoTookClick: boolean
  claimClick: () => void
  /** Reads the claim and clears it. */
  takeClick: () => boolean

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

        // Inside a transaction the history entry is pushed once, on end.
        if (state.transaction) return { setup: draft, dirty: true }

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
      ...NO_SELECTION,
      soloIds: [],
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
        set({ selectedId: id, selectedField: 'position' })
        return id
      },

      removeLight: (id) => {
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
          copy.name = `${source.name} copy`
          draft.lights.push(copy)
        })
        set({ selectedId: newId, selectedField: 'position' })
        return newId
      },

      setRenderer: (patch) =>
        commit((draft) => {
          draft.renderer = { ...DEFAULT_RENDERER, ...draft.renderer, ...patch }
        }),

      beginTransaction: () =>
        set((state) => (state.transaction ? state : { transaction: state.setup })),

      endTransaction: () => {
        const state = get()
        if (!state.transaction) return false

        // `commit` always replaces `setup` with a clone, so an unchanged
        // identity means the drag moved nothing. Don't record an empty step.
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
