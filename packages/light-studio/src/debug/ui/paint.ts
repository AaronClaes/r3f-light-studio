import { useCallback, useEffect, useRef } from 'react'

import { useStudioStore } from '../context'

/**
 * Blender's trick for a column of toggles: press one and drag down, and every
 * row you pass takes the same value.
 *
 * It copies the value the first toggle became rather than flipping each row, so
 * dragging back corrects an overshoot. It fills in the rows between two pointer
 * positions, because a fast drag skips elements the browser never reports. The
 * whole stroke is one undo step.
 */

export type PaintColumn = 'enabled' | 'solo'

interface Stroke {
  column: PaintColumn
  value: boolean
  /** So the next move knows what it skipped over. */
  lastIndex: number
}

export interface Paint {
  press: (index: number, column: PaintColumn, value: boolean) => void
  /** One row, no stroke. The keyboard's way in. */
  set: (index: number, column: PaintColumn, value: boolean) => void
}

/** `ids` must be in the order the rows are drawn: an index is a row. */
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
      // Solo never reaches the setup, so a solo stroke opens a transaction that
      // records nothing. Intended.
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

      // Anywhere on the row, not just the 18px toggle: drifting sideways
      // mid-stroke should not break it.
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
