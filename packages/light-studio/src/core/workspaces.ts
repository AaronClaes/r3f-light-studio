import type { LightSetup } from './schema'
import { serializeSetup } from './serialize'
import type { LiveWorkspace, Workspace } from './state'

/** A no-op on the file, which is `baseline` rather than an entry. */
export function park(state: LiveWorkspace): Workspace[] {
  if (state.activeWorkspace === null) return state.workspaces
  return state.workspaces.map((workspace) =>
    workspace.id === state.activeWorkspace
      ? { ...workspace, setup: state.setup, past: state.past, future: state.future }
      : workspace,
  )
}

/** The next free number, not the count: a digit key addresses the label. */
function nextLabel(workspaces: Workspace[]): string {
  const used = workspaces.map((workspace) => Number(workspace.label)).filter(Number.isFinite)
  return String(Math.max(0, ...used) + 1)
}

export function forkWith(
  state: LiveWorkspace,
  setup: LightSetup,
): { workspaces: Workspace[]; activeWorkspace: string } {
  const label = nextLabel(state.workspaces)
  const id = `w${label}`
  return {
    workspaces: [...park(state), { id, label, setup, past: [], future: [] }],
    activeWorkspace: id,
  }
}

/** Compared as what the exporter emits, because the round trip is not identity-preserving. */
export function sameFile(a: LightSetup, b: LightSetup): boolean {
  return JSON.stringify(serializeSetup(a)) === JSON.stringify(serializeSetup(b))
}
