import { useEffect, useRef, useState } from 'react'

import { LIGHT_DEFINITIONS, LIGHT_TYPES } from '../../core/schema'
import { useStudioStore } from '../context'
import { PlusIcon } from './icons'

/**
 * Positioned `fixed` off the button's own rect: the panel clips its overflow
 * for its rounded corners, so a menu taller than the panel would be cut off.
 */
export function AddMenu() {
  const store = useStudioStore()
  const [at, setAt] = useState<{ top: number; right: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!at) return

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) setAt(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAt(null)
    }
    // The anchor was measured once. Close rather than chase it.
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
