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

export function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg {...SVG} aria-hidden>
      <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4Z" />
      <circle cx="8" cy="8" r="1.9" />
      {open ? null : <path d="M2.5 13.5 13.5 2.5" />}
    </svg>
  )
}

/** Rotated in CSS. */
export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className="ls-chevron" data-open={open} width="8" height="8" viewBox="0 0 8 8" aria-hidden>
      <path d="M2 0.5 6 4 2 7.5Z" fill="currentColor" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg {...SVG} aria-hidden>
      <path d="M4 4 12 12M12 4 4 12" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg {...SVG} aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

export function DuplicateIcon() {
  return (
    <svg {...SVG} aria-hidden>
      <rect x="6" y="6" width="7.5" height="7.5" rx="1.25" />
      <path d="M10 6V3.75A1.25 1.25 0 0 0 8.75 2.5h-5A1.25 1.25 0 0 0 2.5 3.75v5A1.25 1.25 0 0 0 3.75 10H6" />
    </svg>
  )
}

/** A bin, not an X: the X in the header is a few pixels away and is reversible. */
export function TrashIcon() {
  return (
    <svg {...SVG} aria-hidden>
      <path d="M3 4.5h10M6.5 4.5V3a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1.5" />
      <path d="M4.5 4.5 5.1 13a.5.5 0 0 0 .5.5h4.8a.5.5 0 0 0 .5-.5l.6-8.5" />
    </svg>
  )
}

/** A framed horizon, not an eye: this only decides whether you can look at it. */
export function BackdropIcon() {
  return (
    <svg {...SVG} aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 9.5h12" />
      <circle cx="5.75" cy="6.25" r="1.25" />
    </svg>
  )
}

/** The grey ball with a terminator across it. */
export function GreyIcon() {
  return (
    <svg {...SVG} aria-hidden>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M10.9 12.7A5.5 5.5 0 0 0 10.9 3.3a7 7 0 0 1 0 9.4Z" fill="currentColor" />
    </svg>
  )
}

export function SoloIcon({ on }: { on: boolean }) {
  return (
    <svg {...SVG} aria-hidden>
      <circle cx="8" cy="8" r="5" fill={on ? 'currentColor' : 'none'} />
    </svg>
  )
}
