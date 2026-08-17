import type { ReactNode } from 'react'

import type { Paint, PaintColumn } from './paint'

/**
 * Stops the press reaching the row, because pressing delete should not first
 * select the light it is about to remove. `on` makes it a toggle rather than an
 * action; `Toggle` below is the same button wired into the column-drag.
 */
export function RowAction({
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
  children: ReactNode
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

export function Toggle({
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
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`ls-toggle ${className}`}
      data-on={on}
      title={title}
      aria-pressed={on}
      onPointerDown={(event) => {
        event.stopPropagation()
        paint.press(index, column, !on)
      }}
      onClick={(event) => {
        // `detail` 0 is Enter or Space. Anything else is the click behind the
        // press already handled above.
        if (event.detail === 0) paint.set(index, column, !on)
      }}
    >
      {children}
    </button>
  )
}
