import { Environment, Lightformer } from '@react-three/drei'
import { Children, useEffect, useRef, type ReactNode } from 'react'
import type { Group } from 'three'

import type { EnvironmentConfig, EnvironmentPreset, LightformerConfig } from '../core/schema'
import { useKeepMaterial } from './keepMaterial'

/**
 * On its own because it is the only thing on the production path that imports
 * drei, and through drei `three-stdlib`.
 *
 * `<Environment>` is four components behind one name and picks between them by
 * which props it was given: `ground` first, then `map`, then `children`, then
 * the plain cube. `children` of `[]` is truthy, so a rig with an HDRI and no
 * lightformers would re-render a good HDRI into a 256³ cube. Hence the props
 * are assembled, and `shapes` is `undefined` rather than an empty array.
 */

interface EnvironmentRigProps {
  config: EnvironmentConfig
  /** Every lightformer currently reaching the scene. */
  lightformers: LightformerConfig[]
  /** The app's, drawn into the cube map beside the lightformers. */
  content?: ReactNode
  forceBackground?: boolean
}

export function EnvironmentRig({
  config,
  lightformers,
  content = null,
  forceBackground = false,
}: EnvironmentRigProps) {
  const source = sourceOf(config)
  const hasImage = 'files' in source || 'preset' in source
  const backdrop = backdropOf(config, forceBackground)

  // `toArray` drops the nulls a `{condition && …}` leaves behind. Counting
  // those would hand the scene a black cube.
  const hasContent = Children.toArray(content).length > 0

  const projected = config.ground.enabled && hasImage

  // `parseSetup` warns about the lightformers this drops, but it only sees the
  // file. App content arrives as a prop, so it gets the same warning here.
  useGroundConflictWarning(projected && hasContent)

  // The projected ground is the only thing drei puts in the real scene, and it
  // is the environment rather than anything the rig lights.
  const ground = useRef<Group>(null)
  useKeepMaterial(ground, projected && JSON.stringify(source))

  const shapes =
    projected || (lightformers.length === 0 && !hasContent) ? undefined : (
      <>
        {lightformers.map((light) => (
          <LightformerNode key={light.id} light={light} />
        ))}
        {content}
      </>
    )

  // Rendering <Environment /> anyway would take the cube branch with no file.
  if (!hasImage && !shapes) return null

  if (projected) {
    return (
      <group ref={ground}>
        <Environment
          {...source}
          {...backdrop}
          environmentIntensity={config.intensity}
          environmentRotation={config.rotation}
          ground={{
            radius: config.ground.radius,
            height: config.ground.height,
            scale: config.ground.scale,
          }}
        />
      </group>
    )
  }

  return (
    <Environment
      {...source}
      {...backdrop}
      environmentIntensity={config.intensity}
      environmentRotation={config.rotation}
      // Only meaningful on the portal branch: the cube branch forwards what it
      // does not recognise onto the scene object.
      {...(shapes ? { resolution: config.resolution } : {})}
    >
      {shapes}
    </Environment>
  )
}

function useGroundConflictWarning(conflicted: boolean): void {
  useEffect(() => {
    if (!conflicted) return
    console.warn(
      '[LightStudio] Ground projection is on, so drei renders the ground instead of the environment’s children — nothing in <LightStudio.Environment> is reaching the cube map. Switch ground projection off to get it back.',
    )
  }, [conflicted])
}

/**
 * Nothing at all when there is no backdrop, and that is the important half:
 * drei hands every one of these to `applyProps(scene, ...)`, which only skips
 * `undefined`, so a `backgroundBlurriness: 0` would overwrite the app's.
 */
function backdropOf(config: EnvironmentConfig, forced: boolean) {
  const { enabled, blur, intensity, rotation } = config.background
  if (!enabled && !forced) return {}

  return {
    background: true,
    backgroundBlurriness: blur,
    backgroundIntensity: intensity,
    backgroundRotation: rotation,
  }
}

/** `files` beats `preset`, which is drei's own precedence. */
function sourceOf(
  config: EnvironmentConfig,
): { files: string } | { preset: EnvironmentPreset } | Record<string, never> {
  if (config.files !== '') return { files: config.files }
  if (config.preset !== '') return { preset: config.preset }
  return {}
}

/** drei's `Lightformer` is a unit mesh, so width and height go in as a scale. */
function LightformerNode({ light }: { light: LightformerConfig }) {
  return (
    <Lightformer
      color={light.color}
      form={light.form}
      intensity={light.intensity}
      position={light.position}
      scale={[light.width, light.height, 1]}
      target={light.target}
      toneMapped={light.toneMapped}
    />
  )
}
