/**
 * Injected as a style tag rather than a `.css` file, so apps consuming this as
 * source need no side-effect import. The palette is leva's dark theme, since
 * leva rents the properties slot.
 */

const STYLE_ID = 'r3f-light-studio-styles'

/** 280px matches leva's own panel width. */
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

/* Explicit, because the display above beats the browser's own [hidden] rule. */
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

/* Named ls-ws because the properties panel already owns ls-slot. */
.ls-workspaces {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: none;
  padding: 4px;
  background: var(--ls-bg);
  border-radius: var(--ls-radius);
  box-shadow: 0 0 9px 0 #00000088;
}

.ls-ws,
.ls-ws-add {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  border: 1px solid var(--ls-text-faint);
  border-radius: 3px;
  background: var(--ls-bg-sunken);
  color: var(--ls-text-dim);
  font: inherit;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.ls-ws:hover,
.ls-ws-add:hover { background: var(--ls-bg-raised); color: var(--ls-text); }

.ls-ws[data-active='true'] {
  background: var(--ls-accent);
  border-color: var(--ls-accent);
  color: var(--ls-text);
}

.ls-ws:focus-visible,
.ls-ws-add:focus-visible { outline: 1px solid var(--ls-accent); outline-offset: 1px; }

/* Dashed: the one chip that is not a place you can be. */
.ls-ws-add { border-style: dashed; color: var(--ls-text-faint); }

/* Set apart, because it is not a workspace. */
.ls-ws-file { margin-right: 3px; border-style: dotted; }

/* Anchors the × without taking a column of its own. */
.ls-ws-cell { position: relative; display: flex; }

/* Positioned siblings with no z-index paint in document order, so the next
   chip would cover the × overhanging it. */
.ls-ws-cell:hover,
.ls-ws-cell:focus-within { z-index: 1; }

.ls-ws-clear {
  position: absolute;
  top: -5px;
  right: -5px;
  display: none;
  width: 11px;
  height: 11px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--ls-bg-raised);
  color: var(--ls-text-dim);
  font: inherit;
  font-size: 9px;
  line-height: 1;
  cursor: pointer;
}

/* :focus-visible is what makes it reachable by keyboard. */
.ls-ws-cell:hover .ls-ws-clear,
.ls-ws-clear:focus-visible { display: flex; align-items: center; justify-content: center; }
.ls-ws-clear:hover { background: var(--ls-solo); color: #000; }

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

/* The title area collapses; the aside beside it does not. */
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

/* Collapsed sections keep their body mounted: see Panel. */
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

/* Sky over ground, since the environment has no colour of its own. */
.ls-swatch-env { background: linear-gradient(#7fa8d6, #6b5c4a); }

/* No hover-swap: its one action is always on show. */
.ls-row-env .ls-backdrop { margin-left: 4px; }

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

/* These take the type label's place: six controls do not fit in 280px. Shown
   on the selected row too, since that is the one the keyboard acts on. */
.ls-row-actions {
  display: none;
  gap: 2px;
  flex: none;
}
.ls-row:hover .ls-row-actions,
.ls-row:focus-within .ls-row-actions,
.ls-row[data-selected='true'] .ls-row-actions { display: flex; }

.ls-row:hover .ls-type,
.ls-row:focus-within .ls-type,
.ls-row[data-selected='true'] .ls-type { display: none; }

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
/* Keeps its state and its tooltip, and has nothing left to toggle. */
.ls-toggle:disabled { cursor: default; }
.ls-toggle:disabled:hover { background: none; }
.ls-toggle:focus-visible { outline: 1px solid var(--ls-accent); outline-offset: -1px; }
.ls-toggle[data-on='true'] { color: var(--ls-text); }
.ls-toggle[data-on='false'] { color: var(--ls-text-faint); }
.ls-toggle.ls-solo[data-on='true'] { color: var(--ls-solo); }

/* After the .ls-toggle rules, which it ties with on specificity. */
.ls-delete:hover { background: #8a3b3b; color: var(--ls-text); }

/* How many lights the solo is showing. */
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

/* Grey mode and close. Shaped like a row toggle, but owned by the panel. */
.ls-icon {
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
  color: var(--ls-text-faint);
  cursor: pointer;
}
.ls-icon:hover { background: #ffffff1a; color: var(--ls-text); }
.ls-icon:focus-visible { outline: 1px solid var(--ls-accent); outline-offset: -1px; }
.ls-icon[data-on='true'] { color: var(--ls-text); }

/* Sits out at the panel's edge, being last in the column. */
.ls-close { margin-right: -4px; }

/* The wrapper only exists to anchor the menu. */
.ls-add-wrap { display: flex; flex: none; }
.ls-add {
  display: grid;
  place-items: center;
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
.ls-add:hover { background: #ffffff1a; color: var(--ls-text); }
.ls-add:focus-visible { outline: 1px solid var(--ls-accent); outline-offset: -1px; }
.ls-add[aria-expanded='true'] { background: #ffffff1a; color: var(--ls-text); }

/* Fixed, placed from the button's rect: the panel clips its overflow. */
.ls-menu {
  position: fixed;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-width: 120px;
  padding: 3px;
  border-radius: var(--ls-radius);
  background: var(--ls-bg);
  box-shadow: 0 0 9px 0 #00000088;
}

.ls-menu-item {
  height: 22px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: 3px;
  background: none;
  color: var(--ls-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.ls-menu-item:hover { background: var(--ls-accent); }
.ls-menu-item:focus-visible { outline: 1px solid var(--ls-accent); outline-offset: -1px; }

.ls-empty {
  padding: 14px 8px;
  color: var(--ls-text-faint);
  text-align: center;
}

/* Outside the panels, so collapsing them cannot take it away. */
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

/* Pinned left, which is what pushes the buttons right when it is here. */
.ls-state {
  margin-right: auto;
  color: var(--ls-text-dim);
}

/* Quieter than Copy: the one that discards your work should not draw the eye. */
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

.ls-save {
  flex: none;
  height: 18px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: 3px;
  background: var(--ls-accent);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.ls-save:hover { background: #3395ff; }
.ls-save:focus-visible { outline: 1px solid var(--ls-text); outline-offset: 1px; }
.ls-save[data-status='saved'] { background: #2f7d52; }
.ls-save[data-status='failed'] { background: #8a3b3b; }

/* Isolated because leva layers its own insides, a row at z-index 100 and a
   popin at 10000, which otherwise compete with ours in the same stacking
   context. Better than outbidding numbers leva can change. */
.ls-slot { overflow-y: auto; isolation: isolate; }
.ls-slot[hidden] { display: none; }

/* Leva puts a 10px margin above a folder's divider, which reads as a hole when
   collapsed. Hooked to the wrapper class rather than the theme, because the
   token is --leva-space-md and that also pads every row. .ls-root is what wins
   the specificity tie against leva's own selector. */
.ls-root .ls-slot .leva-c-PJLV:not(:first-of-type) { margin-top: 0; }
`

/** Idempotent: two studios in one app, or an HMR reload, must not stack sheets. */
export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
