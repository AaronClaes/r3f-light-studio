import type { StudioState } from '../../core/store'
import { useStudio, useStudioStore } from '../context'

/**
 * The strip over the outliner: which version of the rig you are working in.
 *
 * First in the column because it is the outermost question — which one of these
 * am I editing — and the outliner underneath answers what is in it.
 *
 * A workspace is somewhere you work, not a copy you set aside. There is no
 * taking and no restoring: whatever you edit goes to the one you are in, and `+`
 * forks a new one from what is in front of you.
 *
 * `file` is not one of them. It is read-only, and it is the store's `baseline`
 * rather than an entry — so it cannot drift, cannot be deleted, and shows the
 * new contents the moment you save. Editing while you are on it forks, which is
 * why the strip is just `file +` until you have done something.
 *
 * Only the workspaces that exist are drawn. The first attempt was nine empty
 * numbered slots, and it could not answer the first question anyone asked of it,
 * which was what the numbers meant.
 */
export function Workspaces() {
  const store = useStudioStore()
  const ids = useStudio(selectIds)
  const onFile = useStudio((state) => state.activeWorkspace === null)

  return (
    <div className="ls-workspaces">
      {/* No × and no fork of its own: it is the one chip that is always here. */}
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

/**
 * Ids rather than whole workspaces, because `useShallow` compares element by
 * element with `Object.is` — a mapped array of fresh `{ id, label }` objects
 * would differ every render and re-render the strip on every keystroke of a
 * drag. Strings do not. Each chip reads its own label, which is a string too.
 */
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

      {/* A sibling rather than nested inside the chip: a button inside a button
          is not something a browser or a screen reader can make sense of. */}
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
