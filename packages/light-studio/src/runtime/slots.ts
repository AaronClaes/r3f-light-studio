import { Children, Fragment, isValidElement, type ReactNode } from 'react'

/**
 * Children of `<LightStudio>` are a routing table, not a payload.
 *
 * The alternative was to let bare children mean "put these in the
 * environment", which spends the slot on one meaning — and on a surprising
 * one. Children of a component normally render where the component is, so a
 * mesh put there expecting the scene would instead land in an offscreen cube
 * camera and never be seen. A named slot says where its contents go, and
 * leaves room for a second slot to be added without changing what the first
 * one meant.
 *
 * There is exactly one slot so far.
 */

export interface EnvironmentSlotProps {
  /**
   * Drawn into the environment's cube map, beside the rig's own lightformers.
   *
   * Occluders, mostly: a dark mesh in front of a lightformer to cut the light
   * it throws, which is the one thing a lightformer cannot be. The rig cannot
   * describe these — a mesh is geometry and a material, and a material is not
   * JSON — so they stay the app's, and the editor leaves them alone.
   */
  children?: ReactNode
}

/**
 * The marker. It is read by `splitSlots` and never rendered, so reaching its
 * body means it was put somewhere nothing is looking.
 */
export function StudioEnvironment(_props: EnvironmentSlotProps): null {
  throw new Error(
    '[LightStudio] <LightStudio.Environment> has to be inside <LightStudio>. Anywhere else there is no environment for its children to go into.',
  )
}

StudioEnvironment.displayName = 'LightStudio.Environment'

export interface Slots {
  /** The contents of `<LightStudio.Environment>`; null when there was none. */
  environment: ReactNode
  /** A finished sentence per child that went nowhere, ready to warn about. */
  strays: string[]
}

export function splitSlots(children: ReactNode): Slots {
  let environment: ReactNode = null
  let found = false
  const strays: string[] = []

  const collect = (nodes: ReactNode): void => {
    Children.forEach(nodes, (child) => {
      // `{showFlags && <LightStudio.Environment>…</LightStudio.Environment>}`
      // arrives here as a null when the condition is false. That is a slot you
      // chose not to pass, not a child that went astray.
      if (child === null || child === undefined || typeof child === 'boolean') return

      if (!isValidElement(child)) {
        strays.push(`${describe(child)} ${STRAY_ADVICE}`)
        return
      }

      // `Children` flattens arrays but not fragments, which is the usual way a
      // compound component loses a slot someone wrapped in one. Descending
      // costs three lines and means the wart is not ours.
      if (child.type === Fragment) {
        collect((child.props as { children?: ReactNode }).children)
        return
      }

      if (child.type === StudioEnvironment) {
        if (found) {
          strays.push('A second <LightStudio.Environment> was ignored — put everything in one.')
          return
        }
        found = true
        environment = (child.props as EnvironmentSlotProps).children ?? null
        return
      }

      strays.push(`${describe(child)} ${STRAY_ADVICE}`)
    })
  }

  collect(children)

  return { environment, strays }
}

const STRAY_ADVICE =
  'is not a slot LightStudio renders, so it was dropped. Render it in your scene, or wrap it in <LightStudio.Environment> to draw it into the rig’s environment.'

function describe(child: ReactNode): string {
  if (!isValidElement(child)) {
    return typeof child === 'string' ? `The text ${JSON.stringify(child.trim())}` : 'That child'
  }

  const { type } = child
  if (typeof type === 'string') return `<${type}>`

  const named = type as { displayName?: string; name?: string }
  return `<${named.displayName ?? named.name ?? 'Component'}>`
}
