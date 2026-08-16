import { useCallback, useEffect, useRef } from 'react'

import { useStudioStore } from '../context'

/**
 * Blender's trick for a column of toggles: press one and drag along the
 * column, and every row you pass takes the same value. Switching eight lights
 * off is one gesture instead of eight clicks.
 *
 * Three details make it feel right rather than chaotic:
 *
 * - It **copies** the value the first toggle became; it does not flip each row
 *   in turn. Dragging back over a row you already reached leaves it alone,
 *   which is what lets you correct an overshoot.
 * - It fills in the rows **between** two pointer positions. A fast drag skips
 *   elements entirely — the browser reports only the ones a move happens to
 *   land on — so following the events alone would leave holes in the middle.
 * - The whole stroke is **one undo step**, the same as one gizmo drag.
 */

/** Which column of toggles is being painted. `enabled` is saved; solo is not. */
export type PaintColumn = 'enabled' | 'solo'

interface Stroke {
  column: PaintColumn
  value: boolean
  /** The last row reached, so the next move knows what it skipped over. */
  lastIndex: number
}

export interface Paint {
  /** Begins a stroke on the row that was pressed, and applies it there. */
  press: (index: number, column: PaintColumn, value: boolean) => void
  /** One row, no stroke. The keyboard's way in. */
  set: (index: number, column: PaintColumn, value: boolean) => void
}

/** `ids` must be in the order the rows are drawn — an index is a row. */
export function usePaint(ids: string[]): Paint {
  const store = useStudioStore()
  const stroke = useRef<Stroke | null>(null)

  const set = useCallback(
    (index: number, column: PaintColumn, value: boolean) => {
      const id = ids[index]
      if (!id) return

      const state = store.getState()
      if (column === 'enabled') state.updateLight(id, { enabled: value })
      else state.setSolo(id, value)
    },
    [ids, store],
  )

  const press = useCallback(
    (index: number, column: PaintColumn, value: boolean) => {
      // Solo never reaches the setup, so a solo stroke opens a transaction
      // that closes having recorded nothing. That is the intended outcome.
      store.getState().beginTransaction()
      stroke.current = { column, value, lastIndex: index }
      set(index, column, value)
    },
    [set, store],
  )

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const current = stroke.current
      if (!current) return

      // Anywhere on the row counts, not just the 18px toggle: once a stroke is
      // running, drifting sideways should not break it.
      const row = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-index]')
      if (!row) return

      const index = Number(row.getAttribute('data-index'))
      if (!Number.isInteger(index) || index === current.lastIndex) return

      const from = Math.min(current.lastIndex, index)
      const to = Math.max(current.lastIndex, index)
      for (let step = from; step <= to; step += 1) set(step, current.column, current.value)
      current.lastIndex = index
    }

    const onUp = () => {
      if (!stroke.current) return
      stroke.current = null
      store.getState().endTransaction()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [set, store])

  return { press, set }
}
