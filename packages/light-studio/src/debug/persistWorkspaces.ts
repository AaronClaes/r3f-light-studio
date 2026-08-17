import { parseSetup } from '../core/parse'
import type { LightSetup } from '../core/schema'
import { serializeSetup } from '../core/serialize'
import type { Workspace } from '../core/state'
import { keyFor, readSession, writeSession } from './session'

/** Undo history is not stored: a reload has always emptied the undo stack. */

interface Stored {
  /** null means the file, which is not a stored workspace. */
  active: string | null
  workspaces: { id: string; label: string; setup: unknown }[]
}

export interface RestoredWorkspaces {
  workspaces: Workspace[]
  active: string | null
}

/** Null rather than a default, which the caller already has. */
export function readWorkspaces(id: string): RestoredWorkspaces | null {
  const raw = readSession(keyFor('workspaces', id))
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isStored(parsed)) return null

  // Parse issues are dropped: a console full of complaints about a workspace
  // you have not opened yet is worse than a quietly coerced field.
  const workspaces = parsed.workspaces.map((entry) => ({
    id: entry.id,
    label: entry.label,
    setup: parseSetup(entry.setup).setup,
    past: [],
    future: [],
  }))

  return { workspaces, active: parsed.active }
}

/** `live` is substituted in: the active workspace's parked copy is stale. */
export function writeWorkspaces(
  id: string,
  workspaces: Workspace[],
  active: string | null,
  live: LightSetup,
): void {
  const payload: Stored = {
    active,
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      label: workspace.label,
      setup: serializeSetup(workspace.id === active ? live : workspace.setup),
    })),
  }

  writeSession(keyFor('workspaces', id), JSON.stringify(payload))
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
