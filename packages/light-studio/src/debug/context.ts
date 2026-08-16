import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import type { LightStudioStore, StudioState } from '../core/store'

const StoreContext = createContext<LightStudioStore | null>(null)

export const LightStudioStoreProvider = StoreContext.Provider

export function useStudioStore(): LightStudioStore {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('useStudioStore must be used inside a <LightStudio debug /> subtree.')
  }
  return store
}

/**
 * Always shallow-compares, so a selector that builds a new array each call
 * cannot cause an infinite render loop. Shallow equality on a primitive is
 * `Object.is`, so this is safe for scalar selectors too.
 */
export function useStudio<T>(selector: (state: StudioState) => T): T {
  return useStore(useStudioStore(), useShallow(selector))
}
