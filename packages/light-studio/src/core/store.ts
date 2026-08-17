import { createStore } from 'zustand/vanilla'

import { createLight, uniqueId, visibleLights } from './lights'
import type { SaveTarget } from './save'
import {
  ENVIRONMENT_ID,
  type EnvironmentConfig,
  type LightConfig,
  type LightPatch,
  type LightSetup,
  type LightType,
  type VectorField,
} from './schema'
import { serializeSetup } from './serialize'

const HISTORY_LIMIT = 100

/**
 * A place to work, and everything the editor swaps to move you to it.
 *
 * The setup is *parked* state: for whichever workspace is active it is stale,
 * because that one's live state is the store's own `setup`, `past` and `future`.
 * `park` is what puts the live state back before you leave.
 *
 * History travels with the workspace so that `Cmd+Z` in one never rewinds
 * another's work — and it is deliberately not persisted, matching a reload,
 * which has always cleared the undo stack.
 */
export interface Workspace {
  id: string
  /** What the chip says. Also what a digit key looks for. */
  label: string
  setup: LightSetup
  past: LightSetup[]
  future: LightSetup[]
}

/**
 * Writes the live state back into whichever workspace it belongs to.
 *
 * A no-op while you are on the file, because there is no entry for it: the file
 * is `baseline`, which the store has always kept. That is what makes it
 * read-only for free — it cannot drift, cannot be deleted, and shows the new
 * contents the moment you save.
 */
function park(state: StudioState): Workspace[] {
  if (state.activeWorkspace === null) return state.workspaces
  return state.workspaces.map((workspace) =>
    workspace.id === state.activeWorkspace
      ? { ...workspace, setup: state.setup, past: state.past, future: state.future }
      : workspace,
  )
}

/**
 * The next free number, rather than the count.
 *
 * Deleting workspace 1 out of `1 2` and adding another has to give 3, not a
 * second 2 — the labels are what the digit keys address, so a duplicate would
 * make one of them unreachable.
 */
function nextLabel(workspaces: Workspace[]): string {
  const used = workspaces.map((workspace) => Number(workspace.label)).filter(Number.isFinite)
  return String(Math.max(0, ...used) + 1)
}

/** A new workspace holding `setup`, appended to whatever is parked. */
function forkWith(
  state: StudioState,
  setup: LightSetup,
): { workspaces: Workspace[]; activeWorkspace: string } {
  const label = nextLabel(state.workspaces)
  const id = `w${label}`
  return {
    workspaces: [...park(state), { id, label, setup, past: [], future: [] }],
    activeWorkspace: id,
  }
}

/**
 * Whether a setup would write the same file as another.
 *
 * Compared as what the exporter would emit, for the same reason `DebugLayer`
 * does it that way: the round trip through the file is not identity-preserving,
 * and two setups that serialise the same are the same as far as the file is
 * concerned.
 */
function sameFile(a: LightSetup, b: LightSetup): boolean {
  return JSON.stringify(serializeSetup(a)) === JSON.stringify(serializeSetup(b))
}

/** Selecting a light always starts on its own point, never on its target. */
const NO_SELECTION = { selectedId: null, selectedField: 'position' } as const

function findLight(setup: LightSetup, id: string): LightConfig | undefined {
  return setup.lights.find((light) => light.id === id)
}

function takenIds(setup: LightSetup): string[] {
  // The environment answers to an id as well, so nothing else may take it.
  return [ENVIRONMENT_ID, ...setup.lights.map((light) => light.id)]
}

export interface StudioState {
  /** Working copy. Diverges from `baseline` as soon as anything is edited. */
  setup: LightSetup
  /** Last state that matches what is on disk. `reset()` returns here. */
  baseline: LightSetup
  /** A light's id, or `ENVIRONMENT_ID`. */
  selectedId: string | null
  /** Which of the selected light's points is being edited. */
  selectedField: VectorField
  /** Non-empty means "show only these". May hold `ENVIRONMENT_ID`. Never serialised. */
  soloIds: string[]
  /**
   * Shows the environment behind the scene whatever the rig says.
   *
   * An override, not the setting: `environment.background.enabled` is a real
   * field you can commit. This exists because turning the backdrop on to *look*
   * at a lightformer — which is otherwise invisible outside reflections — and
   * turning it on to *ship* it are different intentions, and only one of them
   * should dirty the file. Editor state, like solo. Never serialised.
   */
  forceBackground: boolean
  /**
   * Paints the scene in one neutral grey so you can see the light on its own.
   *
   * Colour is the loudest thing in a frame, and while you are judging where the
   * light falls it is mostly in the way — a red wall reads as a bright wall.
   * Taking it away leaves shape and shading, which is what a rig is actually
   * made of.
   *
   * A way of looking, like solo and the backdrop. Never serialised, and it
   * cannot be: the rig owns the lights and nothing else in the scene.
   */
  grey: boolean
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
  /**
   * The versions of the rig you have made, not counting the file.
   *
   * Places you work rather than copies you set aside: you are in one, and what
   * you edit goes to the one you are in. A new one forks from whatever you are
   * looking at, which is the only way to stop a look changing under you.
   *
   * Never serialised into the rig. Kept for the life of the tab, and the way to
   * keep one for longer is to switch to it and save.
   */
  workspaces: Workspace[]
  /** Id of the one you are in, or null while you are looking at the file. */
  activeWorkspace: string | null
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
  setForceBackground: (next: boolean) => void
  setGrey: (next: boolean) => void

  setVisible: (next: boolean) => void
  toggleVisible: () => void
  setToggleHint: (hint: string | null) => void
  setSaveTarget: (target: SaveTarget | null) => void

  updateLight: (id: string, patch: LightPatch) => void
  updateEnvironment: (patch: Partial<EnvironmentConfig>) => void
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

  /**
   * Fork a new workspace from whatever you are looking at, and go there.
   *
   * Returns its id. Forking rather than starting empty is the whole point: a new
   * version of the rig in front of you, so the one in front of you stops
   * changing. Editing while on the file does this for you.
   */
  addWorkspace: () => string
  /**
   * Go to a workspace, or to the file with null, parking what you are leaving.
   *
   * Not an undo step and not destructive in either direction — your work stays
   * in the workspace you did it in, along with its history. There is nothing in
   * the file to lose, which is what makes leaving it safe.
   */
  switchWorkspace: (id: string | null) => void
  /** Delete one. Deleting the one you are in puts you back on the file. */
  removeWorkspace: (id: string) => void
  /** Replace the lot. For seeding from storage on mount. */
  loadWorkspaces: (workspaces: Workspace[], activeId: string | null) => void

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

        // Editing while looking at the file needs somewhere for the edit to go,
        // and the file is not it. Forking here rather than refusing means the
        // first thing anyone does — open the editor and drag a light — works,
        // and the file stays the one thing you can always get back to.
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
      // Armed is not the same as shown: the editor exists from the moment
      // `debug` is on, and the toggle key is what puts it on screen.
      visible: false,
      toggleHint: null,
      saveTarget: null,
      workspaces: [],
      // Looking at the file, which is where there is nothing to lose.
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
          // A lightformer is drawn into the environment and nowhere else, so
          // adding one to a switched-off environment would add something that
          // cannot be seen. Same edit, same undo step.
          if (type === 'lightformer') draft.environment.enabled = true
        })
        set({ selectedId: id, selectedField: 'position' })
        return id
      },

      removeLight: (id) => {
        // An id that matches nothing would otherwise commit an identical setup
        // — a dirty flag and an undo step for a change that did not happen.
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

      addWorkspace: () => {
        const state = get()
        const fork = forkWith(state, structuredClone(state.setup))

        set({
          ...fork,
          // The setup does not change, so neither does `dirty`. Nothing moved;
          // you are simply now editing it somewhere else.
          past: [],
          future: [],
          transaction: null,
        })

        return fork.activeWorkspace
      },

      switchWorkspace: (id) =>
        set((state) => {
          if (id === state.activeWorkspace) return state

          const workspaces = park(state)

          // The file. It is `baseline` rather than an entry, and it carries no
          // history of its own because there is nothing in it you did.
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

          return {
            workspaces,
            activeWorkspace: id,
            setup: structuredClone(target.setup),
            past: target.past,
            future: target.future,
            transaction: null,
            // Measured rather than assumed: a workspace can perfectly well hold
            // exactly what is on disk, and claiming otherwise would offer a
            // Reset with nothing to reset.
            dirty: !sameFile(target.setup, state.baseline),
            // Selection and solo survive on purpose. They are ways of looking at
            // a rig rather than parts of one, and losing what you had picked
            // every time you compared two versions of it would make comparing
            // them useless.
          }
        }),

      removeWorkspace: (id) =>
        set((state) => {
          if (!state.workspaces.some((workspace) => workspace.id === id)) return state

          const kept = park(state).filter((workspace) => workspace.id !== id)
          if (id !== state.activeWorkspace) return { workspaces: kept }

          // Deleting where you are stands you back on the file, which is the one
          // place guaranteed to exist.
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
          // A new file arrived, so you are put on it. Your workspaces are
          // untouched: they are yours rather than the file's, and an edit from
          // outside is no reason to throw away the version you forked ten
          // minutes ago. Switching to one will correctly report it as drifted
          // from the new file.
          activeWorkspace: null,
        }),

      // Back to what is on disk, in whichever workspace you are standing in.
      // Not a way out of the workspace — switching does that, and switching
      // never discards anything.
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

/**
 * The environment, or null when it should not reach the scene.
 *
 * The same rule `visibleLights` applies, said for the one thing that is not in
 * the array: solo beats `enabled`, and soloing anything at all is a request to
 * see that and nothing else — including the sky.
 */
export function selectRenderableEnvironment(state: StudioState): EnvironmentConfig | null {
  const { environment } = state.setup
  if (state.soloIds.length > 0) {
    return state.soloIds.includes(ENVIRONMENT_ID) ? environment : null
  }
  return environment.enabled ? environment : null
}
