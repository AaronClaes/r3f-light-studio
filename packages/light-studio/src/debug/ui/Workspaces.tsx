import type { StudioState } from '../../core/state'
import { useStudio, useStudioStore } from '../context'

/**
 * Which version of the rig you are working in. `file` is not one of them: it is
 * `baseline` rather than an entry, so it cannot drift or be deleted, and
 * editing while on it forks.
 */
export function Workspaces() {
  const store = useStudioStore()
  const ids = useStudio(selectIds)
  const onFile = useStudio((state) => state.activeWorkspace === null)

  return (
    <div className="ls-workspaces">
      {/* No ×: it is the one chip that is always here. */}
      <button
        type="button"
        className="ls-ws ls-ws-file"
        data-active={onFile}
        onClick={() => store.getState().switchWorkspace(null)}
        title="The rig as the file has it (press 0). Read-only — editing here starts a new workspace."
      >
        file
      </button>

      {ids.map((id) => (
        <Chip key={id} id={id} />
      ))}

      <button
        type="button"
        className="ls-ws-add"
        onClick={() => store.getState().addWorkspace()}
        title="Fork a new workspace from what you are looking at, so this stops changing"
      >
        +
      </button>
    </div>
  )
}

/** Ids, not whole workspaces: fresh objects would re-render on every keystroke. */
function selectIds(state: StudioState): string[] {
  return state.workspaces.map((workspace) => workspace.id)
}

function Chip({ id }: { id: string }) {
  const store = useStudioStore()
  const label = useStudio(
    (state) => state.workspaces.find((workspace) => workspace.id === id)?.label ?? '',
  )
  const active = useStudio((state) => state.activeWorkspace === id)

  return (
    <span className="ls-ws-cell">
      <button
        type="button"
        className="ls-ws"
        data-active={active}
        onClick={() => store.getState().switchWorkspace(id)}
        title={`Workspace ${label} (press ${label}). Switching never discards anything.`}
      >
        {label}
      </button>

      {/* A sibling, because a button inside a button is not valid HTML. */}
      <button
        type="button"
        className="ls-ws-clear"
        onClick={() => store.getState().removeWorkspace(id)}
        title={`Delete workspace ${label}`}
      >
        ×
      </button>
    </span>
  )
}
