import type { SaveTarget } from './save'
import type { EnvironmentConfig, LightPatch, LightSetup, LightType, VectorField } from './schema'

/**
 * `setup` is parked and stale for whichever workspace is active, because that
 * one's live state is the store's own. `park` writes it back.
 */
export interface Workspace {
  id: string
  /** What the chip says, and what a digit key looks for. */
  label: string
  setup: LightSetup
  past: LightSetup[]
  future: LightSetup[]
}

/** The live half of the state, which is what `park` writes back. */
export interface LiveWorkspace {
  workspaces: Workspace[]
  /** null while you are on the file. */
  activeWorkspace: string | null
  setup: LightSetup
  past: LightSetup[]
  future: LightSetup[]
}

export interface StudioState extends LiveWorkspace {
  /** What is on disk. `reset()` returns here, and the file workspace is this. */
  baseline: LightSetup
  /** A light's id, or `ENVIRONMENT_ID`. */
  selectedId: string | null
  selectedField: VectorField
  /** Non-empty means "show only these". May hold `ENVIRONMENT_ID`. Never serialised. */
  soloIds: string[]
  /** Not `background.enabled`: an override that leaves the file alone. Never serialised. */
  forceBackground: boolean
  /** Never serialised, and cannot be: the rig owns the lights, not the scene. */
  grey: boolean
  /**
   * Here rather than in a prop because the editor's DOM is a React root of its
   * own, rendered exactly once, so anything pushed in from outside would freeze.
   */
  visible: boolean
  toggleHint: string | null
  /** null when there is nowhere to write. */
  saveTarget: SaveTarget | null
  dirty: boolean
  /** Open during a drag or scrub. Everything committed while it is collapses to one step. */
  transaction: LightSetup | null
  /**
   * r3f reports a click as a miss on every object it did not hit, and the gizmo
   * is not one of its objects, so without this a tap on an axis would clear the
   * selection the gizmo is attached to.
   */
  gizmoTookClick: boolean

  select: (id: string | null, field?: VectorField) => void
  /** Set rather than toggle, so a drag down a column can repeat a value safely. */
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

  /** Nested calls keep the outermost snapshot. */
  beginTransaction: () => void
  /** Returns whether anything changed, which tells a drag from a click that missed. */
  endTransaction: () => boolean

  claimClick: () => void
  /** Reads the claim and clears it. */
  takeClick: () => boolean

  addWorkspace: () => string
  /** null goes to the file. Parks whatever you are leaving. */
  switchWorkspace: (id: string | null) => void
  removeWorkspace: (id: string) => void
  /** For seeding from storage on mount. */
  loadWorkspaces: (workspaces: Workspace[], activeId: string | null) => void

  undo: () => void
  redo: () => void
  /** Call after a successful save: the working copy becomes the new baseline. */
  markSaved: () => void
  loadSetup: (setup: LightSetup) => void
  reset: () => void
}
