import { folder, useControls, type useCreateStore } from 'leva'
import { useEffect, useRef } from 'react'

import type { LightSetup } from '../../core/schema'
import { useStudioStore } from '../context'
import type { Control, Field, FieldValue } from './controls'

/**
 * The store is the truth and leva mirrors it: controls write through store
 * actions, a subscription pushes values back.
 *
 * Everything a caller supplies is captured when the controls register, so the
 * component using this must be remounted with a `key` when it changes subject.
 */

/** Leva's store is not a React value, so it crosses the root boundary as a prop. */
export type LevaStore = ReturnType<typeof useCreateStore>

interface MirrorProps<Subject, Patch> {
  fields: Field<Subject, Patch>[]
  levaStore: LevaStore
  /**
   * Called for the current setup and, on every write, for the previous, which
   * is how a change is told from a write that missed this subject. Must be
   * stable, or the controls re-register.
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
    // Settings before deps: without a folder name leva reads argument two as
    // the deps array *or* the settings, and drops a settings object in
    // argument three without a word, spawning its own floating panel.
    { store: levaStore },
    [fields, select, write, store],
  )

  // Leva keeps whatever value a control already had, so a field two light
  // types share would still show the previous light's number.
  useEffect(() => {
    const subject = select(store.getState().setup)
    if (!subject) return

    const values: Record<string, FieldValue> = {}
    for (const field of fields) values[field.key] = field.read(subject)
    set(values as Parameters<typeof set>[0])
  }, [fields, select, set, store])

  // The gizmo, the outliner, undo, redo, reset.
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

      // The keys are only known at runtime, so leva's value types have nothing
      // to match them against.
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
 * Leva does not export its schema types, so recover one from the hook's
 * signature. Without it destructuring `set` stops compiling.
 */
type LevaSchema = ReturnType<Extract<NonNullable<Parameters<typeof useControls>[1]>, () => unknown>>

/** Flat field list into leva's nested folders. See `Field.order`. */
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
        // `folder` keeps the reference, so later fields land in it too.
        target[name] = folder(next, { collapsed: true, order })

        folders.set(key, next)
      }
      target = next
    }

    return target
  }

  for (const field of fields) {
    const control = { ...field.input(subject), ...handlers(field), order: field.order }
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
