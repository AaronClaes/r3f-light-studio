import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import type { StudioState } from '../core/state'
import type { LightStudioStore } from '../core/store'

const StoreContext = createContext<LightStudioStore | null>(null)

export const LightStudioStoreProvider = StoreContext.Provider

export function useStudioStore(): LightStudioStore {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('useStudioStore must be used inside a <LightStudio debug /> subtree.')
  }
  return store
}

/** Always shallow, so a selector that builds a new object cannot loop forever. */
export function useStudio<T>(selector: (state: StudioState) => T): T {
  return useStore(useStudioStore(), useShallow(selector))
}
