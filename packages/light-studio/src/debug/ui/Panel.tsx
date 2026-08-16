import { useState, type ReactNode } from 'react'

import { ChevronIcon } from './icons'

/**
 * One titled section of the column, collapsible from its header.
 *
 * The body is hidden rather than unmounted. Leva hands its panel back to its
 * own floating root the moment the last one unmounts, so collapsing the
 * properties section would spawn a second panel in the corner of the screen —
 * and it keeps a half-typed rename in the outliner from being thrown away.
 */
export function Panel({
  title,
  aside,
  children,
}: {
  title: string
  /** Sits at the right of the header, outside the collapse button. */
  aside?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <section className="ls-panel">
      <header className="ls-head">
        <button
          type="button"
          className="ls-head-toggle"
          aria-expanded={open}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          <ChevronIcon open={open} />
          <span className="ls-head-title">{title}</span>
        </button>
        {aside}
      </header>

      <div className="ls-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
