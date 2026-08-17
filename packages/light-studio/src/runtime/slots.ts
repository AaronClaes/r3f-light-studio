import { Children, Fragment, isValidElement, type ReactNode } from 'react'

/**
 * Children of `<LightStudio>` are a routing table, not a payload: a mesh put
 * there expecting the scene would land in an offscreen cube camera instead.
 */

export interface EnvironmentSlotProps {
  /** Drawn into the environment's cube map, beside the rig's own lightformers. */
  children?: ReactNode
}

/** Read by `splitSlots` and never rendered, so reaching its body is a mistake. */
export function StudioEnvironment(_props: EnvironmentSlotProps): null {
  throw new Error(
    '[LightStudio] <LightStudio.Environment> has to be inside <LightStudio>. Anywhere else there is no environment for its children to go into.',
  )
}

StudioEnvironment.displayName = 'LightStudio.Environment'

export interface Slots {
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
      // A slot you chose not to pass: `{flag && <LightStudio.Environment>…}`.
      if (child === null || child === undefined || typeof child === 'boolean') return

      if (!isValidElement(child)) {
        strays.push(`${describe(child)} ${STRAY_ADVICE}`)
        return
      }

      // `Children` flattens arrays but not fragments, which is the usual way a
      // compound component loses a slot someone wrapped in one.
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
