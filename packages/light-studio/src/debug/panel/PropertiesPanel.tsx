import { useCallback, useMemo } from 'react'

import { ENVIRONMENT_ID, type LightSetup, type LightType } from '../../core/schema'
import type { StudioState } from '../../core/store'
import { useStudio, useStudioStore } from '../context'
import { environmentFields } from './environmentFields'
import { fieldsFor } from './fields'
import { useLevaMirror, type LevaStore } from './levaMirror'

/**
 * Numeric editing for whatever is selected: a light, or the environment.
 *
 * Which light, what it is called and whether it is on belong to the outliner.
 * This is only the lighting.
 *
 * Registers into a store of its own rather than leva's global one, so an app
 * that already uses leva keeps its own panel where it put it.
 */
export function PropertiesPanel({ levaStore }: { levaStore: LevaStore }) {
  const selected = useStudio(selectSelected)
  if (!selected) return null

  if (selected === ENVIRONMENT_ID) return <EnvironmentFields levaStore={levaStore} />

  return (
    // Remounted per light: the control list is built once, from the schema,
    // and a different type means a different list.
    <LightFields
      key={`${selected.id}:${selected.type}`}
      id={selected.id}
      levaStore={levaStore}
      type={selected.type}
    />
  )
}

type Selection = { id: string; type: LightType } | typeof ENVIRONMENT_ID | null

function selectSelected(state: StudioState): Selection {
  if (state.selectedId === ENVIRONMENT_ID) return ENVIRONMENT_ID
  const light = state.selectedId ? lightIn(state.setup, state.selectedId) : undefined
  return light ? { id: light.id, type: light.type } : null
}

function LightFields({
  id,
  type,
  levaStore,
}: {
  id: string
  type: LightType
  levaStore: LevaStore
}) {
  const store = useStudioStore()
  const fields = useMemo(() => fieldsFor(type), [type])

  const select = useCallback((setup: LightSetup) => lightIn(setup, id), [id])
  const write = useCallback(
    (patch: Parameters<StudioState['updateLight']>[1]) => store.getState().updateLight(id, patch),
    [store, id],
  )

  useLevaMirror({ fields, levaStore, select, write })

  return null
}

function EnvironmentFields({ levaStore }: { levaStore: LevaStore }) {
  const store = useStudioStore()
  // There is one environment and it never changes shape, so unlike the light
  // fields this list is built once for the life of the studio.
  const fields = useMemo(() => environmentFields(), [])

  const select = useCallback((setup: LightSetup) => setup.environment, [])
  const write = useCallback(
    (patch: Parameters<StudioState['updateEnvironment']>[0]) =>
      store.getState().updateEnvironment(patch),
    [store],
  )

  useLevaMirror({ fields, levaStore, select, write })

  return null
}

function lightIn(setup: LightSetup, id: string) {
  return setup.lights.find((light) => light.id === id)
}
