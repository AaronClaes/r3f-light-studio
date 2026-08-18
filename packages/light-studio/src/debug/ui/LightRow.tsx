import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

import { findLight } from '../../core/lights'
import { LIGHT_DEFINITIONS, type LightType } from '../../core/schema'
import type { StudioState } from '../../core/state'
import { useStudio, useStudioStore } from '../context'
import { DuplicateIcon, EyeIcon, SoloIcon, TrashIcon } from './icons'
import type { Paint } from './paint'
import { MOD } from './platform'
import { RowAction, Toggle } from './RowButtons'

interface LightRowProps {
  id: string
  /** How a column drag knows which rows it passed over. */
  index: number
  selected: boolean
  soloed: boolean
  /** Whether anything at all is soloed, which is what mutes the other rows. */
  soloing: boolean
  renaming: boolean
  onRename: (id: string | null) => void
  paint: Paint
}

export function LightRow({
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
        // On the name, not the row: double-clicking a toggle is how you switch
        // something off and straight back on again.
        <span className="ls-name" onDoubleClick={() => onRename(id)} title="Double-click to rename">
          {name || id}
        </span>
      )}

      {/* Shares its slot with the row actions, swapped in CSS: 280px has no
          room for both, and the swatch and the panel already say what this is. */}
      <span className="ls-type">{LIGHT_DEFINITIONS[type].label}</span>

      <div className="ls-row-actions">
        <RowAction
          className="ls-duplicate"
          title={`Duplicate this light (${MOD}+D)`}
          onPress={() => store.getState().duplicateLight(id)}
        >
          <DuplicateIcon />
        </RowAction>
        <RowAction
          className="ls-delete"
          title="Remove this light (Delete). Undoable."
          onPress={() => store.getState().removeLight(id)}
        >
          <TrashIcon />
        </RowAction>
      </div>

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
  const input = useRef<HTMLInputElement>(null)

  // On open only. A ref callback runs again on every render, so each keystroke
  // reselected the name and the next one typed over it.
  useEffect(() => {
    input.current?.select()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onCommit(draft.trim())
    if (event.key === 'Escape') onCancel()
  }

  return (
    <input
      className="ls-name-input"
      value={draft}
      ref={input}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => onCommit(draft.trim())}
      onPointerDown={(event) => event.stopPropagation()}
    />
  )
}

interface Row {
  name: string
  type: LightType
  color: string
  enabled: boolean
}

/** Flat primitives, so editing one light re-renders one row. See `selectIds`. */
function rowFor(state: StudioState, id: string): Row | null {
  const light = findLight(state.setup, id)
  if (!light) return null
  return { name: light.name, type: light.type, color: light.color, enabled: light.enabled }
}
