import { parseSetup } from '../core/parse'
import type { LightSetup } from '../core/schema'
import { serializeSetup } from '../core/serialize'
import type { Workspace } from '../core/store'

/**
 * Keeps the workspaces for the life of the tab.
 *
 * `sessionStorage`, for the same reason `persistVisible` uses it: a reload is
 * not a decision. You refresh a dev server dozens of times an hour, and losing
 * every version of the rig you had on the go would make them no use for the
 * thing they are for.
 *
 * Dying with the tab is the other half of that, and it is deliberate. A
 * workspace is somewhere you are working now. The way to keep one for longer is
 * to switch to it and save, which puts it in the file — where an unnamed,
 * invisible copy from three weeks ago, stale against a rig that has since moved
 * on, never could.
 *
 * Undo history is not stored. A reload has always emptied the undo stack and
 * there is no reason for a workspace to be the exception. Neither is the file,
 * which is `baseline` and comes back through the `setup` prop anyway.
 */

const PREFIX = 'r3f-light-studio:workspaces'

/** Scoped by id, so two rigs on one page keep their own. */
function keyFor(id: string): string {
  return `${PREFIX}:${id}`
}

interface Stored {
  /** null means the file, which is not a stored workspace. */
  active: string | null
  workspaces: { id: string; label: string; setup: unknown }[]
}

export interface RestoredWorkspaces {
  workspaces: Workspace[]
  active: string | null
}

/**
 * What was stored, or null when there is nothing usable.
 *
 * Null rather than a default, because the caller already has the only sensible
 * default — no workspaces, standing on the file — and building a second one here
 * would mean two places deciding what a fresh start looks like.
 */
export function readWorkspaces(id: string): RestoredWorkspaces | null {
  const storage = session()
  if (!storage) return null

  let raw: string | null
  try {
    raw = storage.getItem(keyFor(id))
  } catch {
    // Same reasons as `session()`. A fresh start is the safe answer either way.
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isStored(parsed)) return null

  const workspaces: Workspace[] = []
  for (const entry of parsed.workspaces) {
    // Issues are dropped rather than warned about. `parseSetup` coerces
    // anything it does not recognise back to a default, and a console full of
    // complaints about a workspace you have not opened yet is worse than one
    // that has quietly lost a field nobody was going to keep.
    workspaces.push({
      id: entry.id,
      label: entry.label,
      setup: parseSetup(entry.setup).setup,
      past: [],
      future: [],
    })
  }

  return { workspaces, active: parsed.active }
}

/**
 * The live setup belongs to the active workspace, whose parked copy is stale
 * while you are working in it — so it is substituted in here rather than the
 * store being made to write to itself on every keystroke.
 */
export function writeWorkspaces(
  id: string,
  workspaces: Workspace[],
  active: string | null,
  live: LightSetup,
): void {
  const storage = session()
  if (!storage) return

  const payload: Stored = {
    active,
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      label: workspace.label,
      setup: serializeSetup(workspace.id === active ? live : workspace.setup),
    })),
  }

  try {
    storage.setItem(keyFor(id), JSON.stringify(payload))
  } catch {
    // Quota, a sandboxed iframe, blocked site data. Nothing to do and nothing
    // worth saying: failing to remember a workspace is not a problem the person
    // editing lights can act on, and they still work for this page.
  }
}

function isStored(value: unknown): value is Stored {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { active?: unknown; workspaces?: unknown }
  if (candidate.active !== null && typeof candidate.active !== 'string') return false
  if (!Array.isArray(candidate.workspaces)) return false

  return candidate.workspaces.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false
    const workspace = entry as { id?: unknown; label?: unknown }
    return typeof workspace.id === 'string' && typeof workspace.label === 'string'
  })
}

/**
 * `sessionStorage`, or null when there isn't one.
 *
 * Absent when rendered on a server, and *present but throwing* in a sandboxed
 * iframe or with site data blocked — the property access itself is what raises
 * there, which is why this is a function and not a module-level constant.
 */
function session(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}
