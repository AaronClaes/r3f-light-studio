/** 12px glyphs for the outliner's toggle columns. */

const SVG = {
  width: 12,
  height: 12,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** Blender's outliner marks visibility with an eye; so does this. */
export function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg {...SVG} aria-hidden>
      <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4Z" />
      <circle cx="8" cy="8" r="1.9" />
      {open ? null : <path d="M2.5 13.5 13.5 2.5" />}
    </svg>
  )
}

/** Section collapse marker, pointing down when open. Rotated in CSS. */
export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className="ls-chevron" data-open={open} width="8" height="8" viewBox="0 0 8 8" aria-hidden>
      <path d="M2 0.5 6 4 2 7.5Z" fill="currentColor" />
    </svg>
  )
}

/** Solo is a filled dot rather than an eye: it is a different kind of state. */
export function SoloIcon({ on }: { on: boolean }) {
  return (
    <svg {...SVG} aria-hidden>
      <circle cx="8" cy="8" r="5" fill={on ? 'currentColor' : 'none'} />
    </svg>
  )
}
