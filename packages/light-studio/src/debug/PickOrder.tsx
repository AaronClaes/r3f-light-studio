import { useStore, type FilterFunction } from '@react-three/fiber'
import { useEffect } from 'react'
import type * as THREE from 'three'

/** Marks the studio's pick geometry. A module constant, so it is written once. */
export const PICK_USER_DATA = { lsPick: true }

/**
 * Puts the studio's handles at the front of the queue for a click.
 *
 * r3f offers a click to the nearest object first and stops at the first
 * `stopPropagation`, so a mesh of the app's parked in front of a light swallows
 * the click and the handle behind it can never be grabbed.
 *
 * Reordered rather than filtered: a hit list emptied of the app's objects reads
 * to r3f as a click on nothing, and it answers that by firing `onPointerMissed`
 * on every object in the scene — which an app may well be using to clear a
 * selection of its own.
 */
export function PickOrder() {
  const store = useStore()

  useEffect(() => {
    const { events, setEvents } = store.getState()
    // Kept and called, rather than replaced: the filter is a single slot, and
    // an app is entitled to have put its own sort there.
    const previous = events.filter

    const studioFirst: FilterFunction = (items, state) => {
      const ordered = previous ? previous(items, state) : items

      // Partitioned rather than sorted, so everything the studio does not own
      // keeps its distance order and behaves exactly as it did.
      const ours = ordered.filter(isStudioPick)
      if (ours.length === 0) return ordered
      return [...ours, ...ordered.filter((item) => !isStudioPick(item))]
    }

    setEvents({ filter: studioFirst })
    return () => setEvents({ filter: previous })
  }, [store])

  return null
}

function isStudioPick(item: THREE.Intersection): boolean {
  return item.object.userData.lsPick === true
}
