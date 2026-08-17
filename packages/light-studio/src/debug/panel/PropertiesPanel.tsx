import { useCallback, useMemo } from 'react'

import { findLight } from '../../core/lights'
import { ENVIRONMENT_ID, type LightEdit, type LightSetup, type LightType } from '../../core/schema'
import type { StudioState } from '../../core/state'
import { useStudio, useStudioStore } from '../context'
import { environmentFields } from './environmentFields'
import { useLevaMirror, type LevaStore } from './levaMirror'
import { fieldsFor } from './lightFields'

/**
 * Numeric editing for whatever is selected. Registers into a store of its own
 * rather than leva's global one, so an app already using leva keeps its panel.
 */
export function PropertiesPanel({ levaStore }: { levaStore: LevaStore }) {
  const selected = useStudio(selectSelected)
  if (!selected) return null

  if (selected === ENVIRONMENT_ID) return <EnvironmentFields levaStore={levaStore} />

  return (
    // Remounted per light: a different type means a different control list.
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
  const light = findLight(state.setup, state.selectedId)
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

  // Type-checked, because these controls outlive a swap by one notification and
  // would read fields the new type does not have.
  const select = useCallback(
    (setup: LightSetup) => {
      const light = findLight(setup, id)
      return light?.type === type ? light : undefined
    },
    [id, type],
  )

  const write = useCallback(
    (edit: LightEdit) => {
      const state = store.getState()
      if ('type' in edit) state.setLightType(id, edit.type)
      else state.updateLight(id, edit)
    },
    [store, id],
  )

  useLevaMirror({ fields, levaStore, select, write })

  return null
}

function EnvironmentFields({ levaStore }: { levaStore: LevaStore }) {
  const store = useStudioStore()
  // The environment never changes shape, so this is built once.
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
