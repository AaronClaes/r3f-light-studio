import { folder, useControls, type useCreateStore } from 'leva'
import { useEffect, useRef } from 'react'

import type { LightSetup } from '../../core/schema'
import { useStudioStore } from '../context'
import type { Control, Field, FieldValue } from './fields'

/**
 * Keeps a set of leva controls and the studio store in step, in both
 * directions.
 *
 * The store is the source of truth and leva mirrors it: every control writes
 * through a store action, and a store subscription pushes values back. That is
 * the only arrangement where the panel, the gizmo and undo/redo agree — drag a
 * handle and the numbers move, hit undo and both move back.
 *
 * Generic in what it is editing, because a light and the environment need the
 * identical treatment and only differ in where they are found and how they are
 * written. Everything a caller supplies is captured when the controls are
 * registered, so the component using this must be remounted — with a `key` —
 * when it changes subject.
 */

/** Leva's store is not a React value, so it crosses the root boundary as a prop. */
export type LevaStore = ReturnType<typeof useCreateStore>

interface MirrorProps<Subject, Patch> {
  fields: Field<Subject, Patch>[]
  levaStore: LevaStore
  /**
   * Finds the subject in a setup. Called for the current one and, on every
   * store write, for the previous — which is how a change is told from a
   * write that did not touch this subject.
   *
   * Must be stable: `useCallback` it, or the controls re-register.
   */
  select: (setup: LightSetup) => Subject | undefined
  /** Must be stable, for the same reason. */
  write: (patch: Patch) => void
}

export function useLevaMirror<Subject, Patch>({
  fields,
  levaStore,
  select,
  write,
}: MirrorProps<Subject, Patch>): void {
  const store = useStudioStore()
  /** The control currently under the pointer, which must not be written to. */
  const editing = useRef<string | null>(null)

  const [, set] = useControls(
    () => {
      const subject = select(store.getState().setup)
      if (!subject) return {}

      return schemaFor(fields, subject, (field) => ({
        onChange: (value: FieldValue, _path: string, context: ChangeContext) => {
          // The initial call just reports the value the schema was built from,
          // and a programmatic set is this panel catching up to the store.
          // Writing either back would record an edit nobody made.
          if (context.initial || !context.fromPanel) return

          const current = select(store.getState().setup)
          if (current) write(field.patch(current, value))
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
    [fields, select, write, store],
  )

  // Leva keeps whatever value a control already had, so every field two light
  // types share — `intensity`, `position`, `color` — would still be showing
  // the numbers of the light you looked at before this one. The schema alone
  // cannot fix that; the values have to be written over it.
  useEffect(() => {
    const subject = select(store.getState().setup)
    if (!subject) return

    const values: Record<string, FieldValue> = {}
    for (const field of fields) values[field.key] = field.read(subject)
    set(values as Parameters<typeof set>[0])
  }, [fields, select, set, store])

  // Everything that edits this subject from somewhere else — the gizmo, the
  // outliner, undo, redo, reset — arrives here.
  useEffect(() => {
    return store.subscribe((state, previous) => {
      const subject = select(state.setup)
      if (!subject) return
      const before = select(previous.setup)

      const changed: Record<string, FieldValue> = {}
      for (const field of fields) {
        // Writing to the control being dragged would fight the drag.
        if (field.key === editing.current) continue

        const value = field.read(subject)
        if (before && same(field.read(before), value)) continue
        changed[field.key] = value
      }

      // Same reason as the cast in `schemaFor`: the keys are only known at
      // runtime, so leva's value types have nothing to match them against.
      if (Object.keys(changed).length > 0) set(changed as Parameters<typeof set>[0])
    })
  }, [fields, select, set, store])
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
function schemaFor<Subject, Patch>(
  fields: Field<Subject, Patch>[],
  subject: Subject,
  handlers: (field: Field<Subject, Patch>) => Control,
): LevaSchema {
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
    const control = { ...field.input(subject), ...handlers(field), order: field.order }
    // Assembled from a runtime field list, so there is nothing static for
    // leva's control types to check it against.
    folderAt(field.path, field.order)[field.key] = control as LevaSchema[string]
  }

  return root
}

function same(a: FieldValue, b: FieldValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index])
  }
  return a === b
}
