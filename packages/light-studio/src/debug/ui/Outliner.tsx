import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

import { ENVIRONMENT_ID, LIGHT_DEFINITIONS, LIGHT_TYPES, type LightType } from '../../core/schema'
import type { StudioState } from '../../core/store'
import { useStudio, useStudioStore } from '../context'
import {
  BackdropIcon,
  CloseIcon,
  DuplicateIcon,
  EyeIcon,
  PlusIcon,
  SoloIcon,
  TrashIcon,
} from './icons'
import { usePaint, type Paint, type PaintColumn } from './paint'
import { Panel } from './Panel'
import { MOD } from './platform'

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
  const toggleHint = useStudio((state) => state.toggleHint)
  const store = useStudioStore()

  /** The row whose name is being typed into, if any. */
  const [renaming, setRenaming] = useState<string | null>(null)
  const paint = usePaint(ids)

  const soloing = soloIds.length > 0

  return (
    <Panel
      title="Lights"
      aside={
        <>
          {soloing ? (
            <button
              type="button"
              className="ls-solo-badge"
              onClick={() => store.getState().clearSolo()}
              title={`Showing only ${soloIds.length} of the lights. Click to show all.`}
            >
              {soloIds.length}
            </button>
          ) : null}

          <AddMenu />

          {/* On the top panel's header, so it reads as the corner of the whole
              column rather than of the light list. Naming the key matters: the
              editor keeps everything while hidden, and someone who closed it
              from here has nothing else to tell them how to get it back. */}
          <button
            type="button"
            className="ls-close"
            onClick={() => store.getState().setVisible(false)}
            title={toggleHint ? `Hide the studio (${toggleHint})` : 'Hide the studio'}
            aria-label="Hide the studio"
          >
            <CloseIcon />
          </button>
        </>
      }
    >
      <div className="ls-list">
        {/* Above the lights and always there. It is the one part of a rig you
            cannot add or remove — every setup has an environment, most of them
            switched off doing nothing — so it is a fixture rather than a row. */}
        <EnvironmentRow
          selected={selectedId === ENVIRONMENT_ID}
          soloed={soloIds.includes(ENVIRONMENT_ID)}
          soloing={soloing}
        />

        {ids.length === 0 ? (
          <p className="ls-empty">No lights yet — add one with +.</p>
        ) : (
          ids.map((id, index) => (
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
          ))
        )}
      </div>
    </Panel>
  )
}

/**
 * The image-based light, as a row.
 *
 * Shaped like a light's but not one: nothing to rename, nothing to duplicate,
 * nothing to delete. What it has instead is the backdrop toggle, in the slot a
 * light spends on its type label — and permanently, not on hover, because a
 * lightformer is invisible until you switch it on and a control you cannot see
 * is no help finding that out.
 */
function EnvironmentRow({
  selected,
  soloed,
  soloing,
}: {
  selected: boolean
  soloed: boolean
  soloing: boolean
}) {
  const store = useStudioStore()
  const enabled = useStudio((state) => state.setup.environment.enabled)
  const committed = useStudio((state) => state.setup.environment.background.enabled)
  const forced = useStudio((state) => state.forceBackground)

  return (
    <div
      className="ls-row ls-row-env"
      data-lit={soloing ? soloed : enabled}
      data-selected={selected}
      onPointerDown={() => store.getState().select(ENVIRONMENT_ID)}
    >
      <span className="ls-swatch ls-swatch-env" />
      <span className="ls-name">Environment</span>

      {/* An override, and only an override. Whether the backdrop ships is
          `background.enabled` in the properties panel; this is for looking at
          a lightformer without committing anything. With the rig already
          showing one there is nothing left for it to do, so it says so
          instead of offering a switch that cannot switch anything off. */}
      <RowAction
        className="ls-backdrop"
        disabled={committed}
        on={committed || forced}
        title={
          committed
            ? 'The rig shows the environment behind the scene — switch that off under backdrop, below.'
            : 'Show the environment behind the scene while you work, so you can see what is in it. Never saved to the file.'
        }
        onPress={() => store.getState().setForceBackground(!forced)}
      >
        <BackdropIcon />
      </RowAction>

      <RowAction
        on={enabled}
        title={enabled ? 'Switch the environment off' : 'Switch the environment on'}
        onPress={() => store.getState().updateEnvironment({ enabled: !enabled })}
      >
        <EyeIcon open={enabled} />
      </RowAction>

      <RowAction
        className="ls-solo"
        on={soloed}
        title="Solo — show only the environment. Never saved to the file."
        onPress={() => store.getState().setSolo(ENVIRONMENT_ID, !soloed)}
      >
        <SoloIcon on={soloed} />
      </RowAction>
    </div>
  )
}

/**
 * The + in the header, and the list of types it opens.
 *
 * A menu rather than six buttons on the panel: adding a light is rare next to
 * tuning one, and a permanent strip of types would spend the column's width on
 * the thing you do least. What is added lands on its type's default position —
 * `[5, 5, 5]` for a directional, not the origin — selected, with the gizmo on
 * it, so the next thing you do can be dragging it.
 *
 * Positioned `fixed` off the button's own rect: the panel clips its overflow to
 * keep the list's corners round, and a menu longer than a short panel would be
 * cut off by it.
 */
function AddMenu() {
  const store = useStudioStore()
  const [at, setAt] = useState<{ top: number; right: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!at) return

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) setAt(null)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setAt(null)
    }
    // The anchor is measured once, and the panel is pinned to a corner of a
    // window that just changed size. Close rather than chase it.
    const onResize = () => setAt(null)

    // Capture, so a press on something that stops propagation still shuts this.
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [at])

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (at) return setAt(null)
    const rect = event.currentTarget.getBoundingClientRect()
    setAt({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }

  return (
    <div className="ls-add-wrap" ref={root}>
      <button
        type="button"
        className="ls-add"
        onClick={toggle}
        title="Add a light"
        aria-label="Add a light"
        aria-expanded={at !== null}
        aria-haspopup="menu"
      >
        <PlusIcon />
      </button>

      {at ? (
        <div className="ls-menu" role="menu" style={{ top: at.top, right: at.right }}>
          {LIGHT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="menuitem"
              className="ls-menu-item"
              onClick={() => {
                store.getState().addLight(type)
                setAt(null)
              }}
            >
              {LIGHT_DEFINITIONS[type].label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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

      {/* The type label and the two actions share one slot: 280px does not
          have room for both, and the label is the more expendable of them —
          the swatch, the name and the panel below all say what this is. Swapped
          in CSS on hover and on the selected row, so the actions are on the
          row they act on and you never aim at a button that just appeared
          somewhere else. */}
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

/**
 * A button in a row that acts on that row alone.
 *
 * It stops the press reaching the row: pressing delete should not first select
 * the light it is about to remove, and there is no reason for duplicate to
 * move your selection either — `duplicateLight` selects the copy anyway.
 *
 * `on` makes it a toggle rather than an action, which is what the environment
 * row's three are. Without it there is no pressed state to report and none to
 * colour. The light rows' eye and solo are `Toggle` instead, which is the same
 * button wired into the column-drag.
 */
function RowAction({
  className = '',
  title,
  on,
  disabled = false,
  onPress,
  children,
}: {
  className?: string
  title: string
  on?: boolean
  disabled?: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`ls-toggle ${className}`}
      data-on={on}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={on}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onPress}
    >
      {children}
    </button>
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
