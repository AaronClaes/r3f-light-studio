import { useState, type CSSProperties, type KeyboardEvent } from 'react'

import { LIGHT_DEFINITIONS, type LightType } from '../../core/schema'
import type { StudioState } from '../../core/store'
import { useStudio, useStudioStore } from '../context'
import { EyeIcon, SoloIcon } from './icons'
import { usePaint, type Paint, type PaintColumn } from './paint'
import { Panel } from './Panel'

/**
 * The rig, as a list.
 *
 * This is where you find a light and say what you want to see, which is why it
 * owns the three things that are about a light rather than about its lighting:
 * its name, whether it is on, and whether you are looking at it alone. The
 * properties panel gets everything else.
 *
 * It also makes ambient lights reachable. They have no position, so no handle,
 * so before this the only way to select one was a dropdown.
 */

export function Outliner() {
  const ids = useStudio(selectIds)
  const soloIds = useStudio((state) => state.soloIds)
  const selectedId = useStudio((state) => state.selectedId)
  const store = useStudioStore()

  /** The row whose name is being typed into, if any. */
  const [renaming, setRenaming] = useState<string | null>(null)
  const paint = usePaint(ids)

  const soloing = soloIds.length > 0

  return (
    <Panel
      title="Lights"
      aside={
        soloing ? (
          <button
            type="button"
            className="ls-solo-badge"
            onClick={() => store.getState().clearSolo()}
            title={`Showing only ${soloIds.length} of the lights. Click to show all.`}
          >
            {soloIds.length}
          </button>
        ) : null
      }
    >
      {ids.length === 0 ? (
        <p className="ls-empty">No lights in this setup.</p>
      ) : (
        <div className="ls-list">
          {ids.map((id, index) => (
            <LightRow
              key={id}
              id={id}
              index={index}
              selected={id === selectedId}
              soloed={soloIds.includes(id)}
              soloing={soloing}
              renaming={renaming === id}
              onRename={setRenaming}
              paint={paint}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

interface LightRowProps {
  id: string
  /** Its place in the list, which is how a drag knows what it passed over. */
  index: number
  selected: boolean
  soloed: boolean
  /** Whether anything at all is soloed, which is what mutes the other rows. */
  soloing: boolean
  renaming: boolean
  onRename: (id: string | null) => void
  paint: Paint
}

function LightRow({
  id,
  index,
  selected,
  soloed,
  soloing,
  renaming,
  onRename,
  paint,
}: LightRowProps) {
  const store = useStudioStore()
  const row = useStudio((state) => rowFor(state, id))
  if (!row) return null

  const { name, type, color, enabled } = row

  return (
    <div
      className="ls-row"
      data-index={index}
      data-selected={selected}
      // Solo beats `enabled`, the same rule the renderer uses.
      data-lit={soloing ? soloed : enabled}
      style={{ '--ls-swatch-color': color } as CSSProperties}
      onPointerDown={() => store.getState().select(id)}
    >
      <span className="ls-swatch" />

      {renaming ? (
        <NameInput
          value={name}
          onCommit={(next) => {
            if (next !== name) store.getState().updateLight(id, { name: next })
            onRename(null)
          }}
          onCancel={() => onRename(null)}
        />
      ) : (
        // On the name and not on the row: double-clicking a toggle is how you
        // switch something off and straight back on again, and that should
        // not drop you into renaming.
        <span className="ls-name" onDoubleClick={() => onRename(id)} title="Double-click to rename">
          {name || id}
        </span>
      )}

      <span className="ls-type">{LIGHT_DEFINITIONS[type].label}</span>

      <Toggle
        column="enabled"
        index={index}
        on={enabled}
        paint={paint}
        title={
          enabled
            ? 'Switch this light off — drag down the column for several'
            : 'Switch this light on — drag down the column for several'
        }
      >
        <EyeIcon open={enabled} />
      </Toggle>

      <Toggle
        className="ls-solo"
        column="solo"
        index={index}
        on={soloed}
        paint={paint}
        title="Solo — show only this light. Never saved to the file."
      >
        <SoloIcon on={soloed} />
      </Toggle>
    </div>
  )
}

function Toggle({
  on,
  title,
  className = '',
  column,
  index,
  paint,
  children,
}: {
  on: boolean
  title: string
  className?: string
  column: PaintColumn
  index: number
  paint: Paint
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`ls-toggle ${className}`}
      data-on={on}
      title={title}
      aria-pressed={on}
      onPointerDown={(event) => {
        // The row selects on pointer-down, and toggling should not also select.
        event.stopPropagation()
        paint.press(index, column, !on)
      }}
      onClick={(event) => {
        // A click synthesised by Enter or Space reports `detail` 0. Anything
        // else is the click behind a press that was handled above.
        if (event.detail === 0) paint.set(index, column, !on)
      }}
    >
      {children}
    </button>
  )
}

/** Uncontrolled while open, so the store sees one edit instead of one per key. */
function NameInput({
  value,
  onCommit,
  onCancel,
}: {
  value: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(value)

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onCommit(draft.trim())
    if (event.key === 'Escape') onCancel()
  }

  return (
    <input
      className="ls-name-input"
      value={draft}
      // The field only exists because it was just double-clicked, so taking
      // focus is finishing that gesture rather than stealing it.
      ref={(node) => node?.select()}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => onCommit(draft.trim())}
      onPointerDown={(event) => event.stopPropagation()}
    />
  )
}

/**
 * Selectors are shallow-compared, so they have to bottom out in primitives.
 * A list of whole lights would be a fresh array of fresh objects on every
 * store write — never equal to the last one, which React reports as an
 * unstable snapshot and refuses to render.
 *
 * Hence ids here and one flat row per light below: the list only re-renders
 * when a light is added, removed or reordered, and editing one light
 * re-renders one row.
 */
function selectIds(state: StudioState): string[] {
  return state.setup.lights.map((light) => light.id)
}

interface Row {
  name: string
  type: LightType
  color: string
  enabled: boolean
}

function rowFor(state: StudioState, id: string): Row | null {
  const light = state.setup.lights.find((candidate) => candidate.id === id)
  if (!light) return null
  return { name: light.name, type: light.type, color: light.color, enabled: light.enabled }
}
