import { createStore } from 'zustand/vanilla'

import { createLight, uniqueId, visibleLights } from './lights'
import type { SaveTarget } from './save'
import type { LightConfig, LightPatch, LightSetup, LightType, VectorField } from './schema'

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
  /**
   * Whether the editor is on screen.
   *
   * Not a property of the rig, but it lives here anyway: the editor's DOM is
   * rendered into a React root of its own exactly once, so a callback pushed
   * in from the tree outside would freeze at that first render. Everything in
   * that root reads this store instead, and hiding is now something the toggle
   * key and a button in the panel can both ask for.
   */
  visible: boolean
  /**
   * What to call the toggle key on screen, or null when nothing is bound.
   *
   * Here for the same reason as `visible`: the close button needs it, the
   * close button lives in the other root, and the store is the only thing that
   * crosses. Hiding the editor from a button without saying how to get it back
   * is a dead end.
   */
  toggleHint: string | null
  /**
   * Where the dev-server plugin will write, or null when there is nowhere.
   *
   * Crosses into the panels for the same reason as the two above. Null is the
   * answer for every way saving can be unavailable — no plugin, no dev server,
   * an id nobody declared — because the button only needs to know whether to
   * exist.
   */
  saveTarget: SaveTarget | null
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

  setVisible: (next: boolean) => void
  toggleVisible: () => void
  setToggleHint: (hint: string | null) => void
  setSaveTarget: (target: SaveTarget | null) => void

  updateLight: (id: string, patch: LightPatch) => void
  addLight: (type: LightType) => string
  removeLight: (id: string) => void
  duplicateLight: (id: string) => string | null

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
      // Armed is not the same as shown: the editor exists from the moment
      // `debug` is on, and the toggle key is what puts it on screen.
      visible: false,
      toggleHint: null,
      saveTarget: null,
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

      setVisible: (next) => set({ visible: next }),
      toggleVisible: () => set((state) => ({ visible: !state.visible })),
      setToggleHint: (hint) => set({ toggleHint: hint }),
      setSaveTarget: (target) => set({ saveTarget: target }),

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
          // An unnamed light shows its id in the outliner, so naming its copy
          // ` copy` would give it a leading space instead of falling back to
          // the id the way every other unnamed light does.
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
