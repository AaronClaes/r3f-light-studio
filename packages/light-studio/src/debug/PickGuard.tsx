import { useStore, type FilterFunction } from '@react-three/fiber'
import { useEffect } from 'react'
import type * as THREE from 'three'

/** Marks the studio's pick geometry. A module constant, so it is written once. */
export const PICK_USER_DATA = { lsPick: true }

/**
 * Gives the studio the whole scene's pointer while the editor is open.
 *
 * Ranking the studio's handles above the app's objects was not enough, because
 * ordering only settles a click:
 *
 * - An app that drags on `pointerdown` was never asking about the click. The
 *   handles carry no `onPointerDown`, so first place in the queue stops nothing
 *   and the object behind starts dragging regardless.
 * - Once anything has captured the pointer, r3f refuses to honour anyone else's
 *   `stopPropagation` for the rest of that gesture — so a handle cannot even
 *   claim the click that follows a drag someone else began.
 * - The gizmo's arrows are not in the running at all. r3f raycasts only objects
 *   that carry its own handlers, and drei mounts `TransformControls` without
 *   any, so an arrow can never appear in the list this function sorts. Pressing
 *   one goes straight through to whatever is behind it.
 *
 * So the app's objects are dropped rather than reordered, and nothing of theirs
 * is hit while the editor is open. That leaves the handles and the gizmo
 * uncontested. Put the studio away and the app has its scene back untouched —
 * the toggle is the whole of the opt-out.
 */
export function PickGuard() {
  const store = useStore()

  useEffect(() => {
    const { events, setEvents } = store.getState()
    // Kept to put back, not to call: by the time an app's own sort would have
    // had something to say, there is nothing of the app's left to sort.
    const previous = events.filter

    const studioOnly: FilterFunction = (items) => items.filter(isStudioPick)

    setEvents({ filter: studioOnly })
    return () => setEvents({ filter: previous })
  }, [store])

  return null
}

function isStudioPick(item: THREE.Intersection): boolean {
  return item.object.userData.lsPick === true
}
