/**
 * The editor's stylesheet, injected once as a `<style>` tag.
 *
 * Not a `.css` file: this package is consumed as source-or-bundle by apps that
 * should not have to remember a side-effect import, and a stylesheet emitted
 * from the debug chunk would still need one. Not inline styles either — the
 * outliner needs `:hover` and `:focus-visible`, which inline styles cannot
 * express.
 *
 * The palette is leva's dark theme, deliberately. Leva currently rents the
 * properties slot, and a column that looks like two different tools stapled
 * together is worse than either. When it is replaced these become the theme.
 */

const STYLE_ID = 'r3f-light-studio-styles'

/** Column geometry. Leva's own panel is 280px, so the slot matches it. */
const CSS = `
.ls-root {
  --ls-bg: #292d39;
  --ls-bg-sunken: #181c20;
  --ls-bg-raised: #373c4b;
  --ls-accent: #007bff;
  --ls-text: #fefefe;
  --ls-text-dim: #8c92a4;
  --ls-text-faint: #535760;
  --ls-solo: #f5a524;
  --ls-radius: 6px;
  --ls-row: 24px;

  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 280px;
  max-height: calc(100vh - 20px);
  color: var(--ls-text);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 11px;
  line-height: 1;
}

/* Put away with the toggle key. Needed explicitly: the display above beats
   the browser's own [hidden] rule, which is only display: none. */
.ls-root[hidden] { display: none; }

.ls-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--ls-bg);
  border-radius: var(--ls-radius);
  box-shadow: 0 0 9px 0 #00000088;
  overflow: hidden;
}

.ls-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  height: 28px;
  padding: 0 8px;
  background: var(--ls-bg-sunken);
  font-weight: 600;
  user-select: none;
}

/* The whole title area is the collapse control; the aside beside it is not. */
.ls-head-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ls-head-toggle:hover { color: var(--ls-text); }
.ls-head-toggle:focus-visible { outline: 1px solid var(--ls-accent); outline-offset: -2px; }

.ls-chevron {
  flex: none;
  color: var(--ls-text-dim);
  transition: transform 120ms ease;
}
.ls-chevron[data-open='true'] { transform: rotate(90deg); }

.ls-head-title {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Collapsed sections keep their body mounted — see Panel. */
.ls-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.ls-body[hidden] { display: none; }

.ls-list {
  overflow-y: auto;
  padding: 3px 0;
}

.ls-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--ls-row);
  padding: 0 8px;
  cursor: default;
  user-select: none;
}

.ls-row:hover { background: var(--ls-bg-raised); }
.ls-row[data-selected='true'] { background: var(--ls-accent); }
/* Not reaching the scene: switched off, or muted by someone else's solo. */
.ls-row[data-lit='false'] .ls-swatch,
.ls-row[data-lit='false'] .ls-name { opacity: 0.4; }

.ls-swatch {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ls-swatch-color);
  box-shadow: inset 0 0 0 1px #0006;
}

.ls-name {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ls-name-input {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0 3px;
  border: 0;
  border-radius: 2px;
  background: var(--ls-bg-sunken);
  color: var(--ls-text);
  font: inherit;
  outline: 1px solid var(--ls-accent);
}

.ls-type {
  flex: none;
  color: var(--ls-text-faint);
  font-size: 10px;
}
.ls-row[data-selected='true'] .ls-type { color: #ffffff99; }

.ls-toggle {
  display: grid;
  place-items: center;
  flex: none;
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: none;
  color: var(--ls-text-dim);
  cursor: pointer;
}
.ls-toggle:hover { background: #ffffff1a; color: var(--ls-text); }
.ls-toggle:focus-visible { outline: 1px solid var(--ls-accent); outline-offset: -1px; }
.ls-toggle[data-on='true'] { color: var(--ls-text); }
.ls-toggle[data-on='false'] { color: var(--ls-text-faint); }
.ls-toggle.ls-solo[data-on='true'] { color: var(--ls-solo); }

/*
 * How many lights the solo is showing. Just the count — the colour already
 * says which state this is, and it matches the amber of the toggles it counts.
 */
.ls-solo-badge {
  display: grid;
  place-items: center;
  flex: none;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border: 0;
  border-radius: 8px;
  background: var(--ls-solo);
  color: #241a05;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.ls-solo-badge:hover { background: #ffbb4d; }

/* Shaped like a row toggle so the header's two controls match, but it is the
   last thing on the right of the whole column rather than part of the list. */
.ls-close {
  display: grid;
  place-items: center;
  flex: none;
  width: 18px;
  height: 18px;
  margin: 0 -4px 0 0;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: none;
  color: var(--ls-text-faint);
  cursor: pointer;
}
.ls-close:hover { background: #ffffff1a; color: var(--ls-text); }
.ls-close:focus-visible { outline: 1px solid var(--ls-accent); outline-offset: -1px; }

.ls-empty {
  padding: 14px 8px;
  color: var(--ls-text-faint);
  text-align: center;
}

/*
 * Outside the panels, so collapsing them cannot take it away. Shaped like a
 * panel header rather than a panel: it is a strip of controls, not a section.
 */
.ls-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex: none;
  height: 28px;
  padding: 0 8px;
  border-radius: var(--ls-radius);
  background: var(--ls-bg);
  box-shadow: 0 0 9px 0 #00000088;
  user-select: none;
}

/* Only shown while the rig has drifted from the file, so it reads as a state
   to clear rather than a label. Losing it is the confirmation of a save. */
/* Pinned left, which is also what pushes the buttons right when it is here.
   The bar ends flush right on its own when it is not. */
.ls-state {
  margin-right: auto;
  color: var(--ls-text-dim);
}

/* Quieter than Copy on purpose: it appears next to it, and the one that
   discards your work should not be the one that draws the eye. */
.ls-reset {
  flex: none;
  height: 18px;
  margin: 0;
  padding: 0 6px;
  border: 0;
  border-radius: 3px;
  background: none;
  color: var(--ls-text-dim);
  font: inherit;
  cursor: pointer;
}
.ls-reset:hover { background: #ffffff1a; color: var(--ls-text); }
.ls-reset:focus-visible { outline: 1px solid var(--ls-accent); outline-offset: 1px; }

.ls-copy {
  flex: none;
  height: 18px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: 3px;
  background: var(--ls-bg-raised);
  color: var(--ls-text);
  font: inherit;
  cursor: pointer;
}
.ls-copy:hover { background: #454b5c; }
.ls-copy:focus-visible { outline: 1px solid var(--ls-accent); outline-offset: 1px; }
.ls-copy[data-status='copied'] { background: #2f7d52; }
.ls-copy[data-status='failed'] { background: #8a3b3b; }

/* Leva fills the slot. Kept mounted while nothing is selected: unmounting it
   hands the panel back to leva's own floating root. */
.ls-slot { overflow-y: auto; }
.ls-slot[hidden] { display: none; }

/*
 * Leva keeps a folder's separating chrome above its own divider: a border,
 * 6px of padding and a 10px margin. Collapsed, that margin reads as a hole
 * beneath whatever sits above the folder, and the panel ends on two stacked
 * ones. The border and padding stay — only the margin goes.
 *
 * Hooked to leva's wrapper class rather than its theme because the value is
 * --leva-space-md, which also sets the left and right padding on every row;
 * turning the token down would un-pad the whole panel. The :not() matches
 * leva's own selector, and .ls-root puts this one class above it — otherwise
 * the two tie on specificity and injection order decides.
 */
.ls-root .ls-slot .leva-c-PJLV:not(:first-of-type) { margin-top: 0; }
`

/**
 * Idempotent: two `<LightStudio debug />` in one app, or an HMR reload, must
 * not stack duplicate stylesheets.
 */
export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
