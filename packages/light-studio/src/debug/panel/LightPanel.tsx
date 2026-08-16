import { folder, useControls, type useCreateStore } from 'leva'
import { useEffect, useMemo, useRef } from 'react'

import type { LightConfig, LightSetup, LightType } from '../../core/schema'
import type { StudioState } from '../../core/store'
import { useStudio, useStudioStore } from '../context'
import { fieldsFor, type Control, type Field, type FieldValue } from './fields'

/**
 * Numeric editing for the selected light.
 *
 * The store is the source of truth and leva mirrors it: every control writes
 * through a store action, and a store subscription pushes values back. That is
 * the only arrangement where the panel, the gizmo and undo/redo agree — drag a
 * handle and the numbers move, hit undo and both move back.
 *
 * Which light, what it is called and whether it is on belong to the outliner.
 * This is only the lighting.
 *
 * Registers into a store of its own rather than leva's global one, so an app
 * that already uses leva keeps its own panel where it put it.
 */

type LevaStore = ReturnType<typeof useCreateStore>

export function LightPanel({ levaStore }: { levaStore: LevaStore }) {
  const selected = useStudio(selectSelected)
  if (!selected) return null

  return (
    // Remounted per light: the control list is built once, from the schema,
    // and a different type means a different list.
    <LightFields
      key={`${selected.id}:${selected.type}`}
      id={selected.id}
      type={selected.type}
      levaStore={levaStore}
    />
  )
}

function selectSelected(state: StudioState): { id: string; type: LightType } | null {
  const light = state.selectedId ? lightIn(state.setup, state.selectedId) : undefined
  return light ? { id: light.id, type: light.type } : null
}

interface LightFieldsProps {
  id: string
  type: LightType
  levaStore: LevaStore
}

function LightFields({ id, type, levaStore }: LightFieldsProps) {
  const store = useStudioStore()
  const fields = useMemo(() => fieldsFor(type), [type])
  /** The control currently under the pointer, which must not be written to. */
  const editing = useRef<string | null>(null)

  const [, set] = useControls(
    () => {
      const light = lightIn(store.getState().setup, id)
      if (!light) return {}

      return schemaFor(fields, light, (field) => ({
        onChange: (value: FieldValue, _path: string, context: ChangeContext) => {
          // The initial call just reports the value the schema was built from,
          // and a programmatic set is this panel catching up to the store.
          // Writing either back would record an edit nobody made.
          if (context.initial || !context.fromPanel) return

          const current = lightIn(store.getState().setup, id)
          if (current) store.getState().updateLight(id, field.patch(current, value))
        },

        // Scrubbing a slider is one undo step, the same as one gizmo drag.
        onEditStart: () => {
          editing.current = field.key
          store.getState().beginTransaction()
        },
        onEditEnd: () => {
          editing.current = null
          store.getState().endTransaction()
        },
      }))
    },
    // Settings before deps, and not the other way round: without a folder name
    // leva reads argument two as the deps array *or* the settings, and a
    // settings object in argument three is dropped without a word. Dropped, it
    // registers into leva's global store and spawns leva's floating panel.
    { store: levaStore },
    [fields, id, store],
  )

  // Leva keeps whatever value a control already had, so every field two light
  // types share — `intensity`, `position`, `color` — would still be showing
  // the numbers of the light you looked at before this one. The schema alone
  // cannot fix that; the values have to be written over it.
  useEffect(() => {
    const light = lightIn(store.getState().setup, id)
    if (!light) return

    const values: Record<string, FieldValue> = {}
    for (const field of fields) values[field.key] = field.read(light)
    set(values as Parameters<typeof set>[0])
  }, [fields, id, set, store])

  // Everything that edits this light from somewhere else — the gizmo, the
  // outliner, undo, redo, reset — arrives here.
  useEffect(() => {
    return store.subscribe((state, previous) => {
      const light = lightIn(state.setup, id)
      if (!light) return
      const before = lightIn(previous.setup, id)

      const changed: Record<string, FieldValue> = {}
      for (const field of fields) {
        // Writing to the control being dragged would fight the drag.
        if (field.key === editing.current) continue

        const value = field.read(light)
        if (before && same(field.read(before), value)) continue
        changed[field.key] = value
      }

      // Same reason as the cast in `schemaFor`: the keys are only known at
      // runtime, so leva's value types have nothing to match them against.
      if (Object.keys(changed).length > 0) set(changed as Parameters<typeof set>[0])
    })
  }, [fields, id, set, store])

  return null
}

interface ChangeContext {
  /** Leva reports the schema's own value once, on mount. */
  initial: boolean
  /** False when the value came from `set` rather than from the panel. */
  fromPanel: boolean
}

/**
 * Leva does not export its schema types from the package root, so recover one
 * from the hook's own signature. Worth the indirection: without it the whole
 * `useControls` return type degrades and destructuring `set` stops compiling.
 */
type LevaSchema = ReturnType<Extract<NonNullable<Parameters<typeof useControls>[1]>, () => unknown>>

type Handlers = (field: Field) => Control

/**
 * Lays the flat field list out into leva's nested folders.
 *
 * Every control carries its place as an explicit `order`, and a folder takes
 * the order of the first field inside it. Leva otherwise lays a folder out in
 * the order its controls first appeared, and the ones a previous light already
 * created keep their old slots — so the fields would shuffle as you clicked
 * between light types. See `Field.order` for why those numbers are banded
 * rather than counted.
 */
function schemaFor(fields: Field[], light: LightConfig, handlers: Handlers): LevaSchema {
  const root: LevaSchema = {}
  const folders = new Map<string, LevaSchema>()

  const folderAt = (path: string[], order: number): LevaSchema => {
    let target = root
    let key = ''

    for (const name of path) {
      key = key === '' ? name : `${key}.${name}`
      let next = folders.get(key)
      if (!next) {
        next = {}
        // `folder` keeps the reference, so later fields land in it too. Its
        // order is the first field inside it, which is where the schema puts
        // the whole group.
        target[name] = folder(next, { collapsed: true, order })
        folders.set(key, next)
      }
      target = next
    }

    return target
  }

  for (const field of fields) {
    const control = { ...field.input(light), ...handlers(field), order: field.order }
    // Assembled from a runtime field list, so there is nothing static for
    // leva's control types to check it against.
    folderAt(field.path, field.order)[field.key] = control as LevaSchema[string]
  }

  return root
}

function lightIn(setup: LightSetup, id: string): LightConfig | undefined {
  return setup.lights.find((light) => light.id === id)
}

function same(a: FieldValue, b: FieldValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index])
  }
  return a === b
}
