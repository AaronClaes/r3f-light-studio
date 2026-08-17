import { useState, type ReactNode } from 'react'

import { ChevronIcon } from './icons'

/**
 * The body is hidden rather than unmounted: leva reclaims its panel into a
 * floating root of its own the moment the last one unmounts.
 */
export function Panel({
  title,
  aside,
  children,
}: {
  title: string
  /** Right of the header, outside the collapse button. */
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
