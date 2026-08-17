import { Environment, Lightformer } from '@react-three/drei'
import { Children, useEffect, type ReactNode } from 'react'

import type { EnvironmentConfig, EnvironmentPreset, LightformerConfig } from '../core/schema'

/**
 * The image-based half of a rig: an HDRI, shapes drawn into it, or both.
 *
 * ## Why this file exists on its own
 *
 * It is the only thing on the production path that imports drei, and through
 * drei, `three-stdlib`. Everything else in `runtime/` builds three objects r3f
 * already knows about. Keeping it in one file makes that cost something you can
 * point at, and makes it a one-line change to load it lazily later.
 *
 * ## Why the props are assembled rather than spread
 *
 * `<Environment>` is four components behind one name, and it chooses between
 * them by looking at which props you passed: `ground` first, then `map`, then
 * `children`, then the plain cube. Passing a prop that belongs to a branch you
 * did not want is not ignored — it silently picks that branch instead.
 *
 * The trap that matters here: `children` of `[]` is truthy, so a rig with an
 * HDRI and no lightformers would take the portal branch and re-render a
 * perfectly good HDRI into a 256³ cube. Hence `undefined`, never an array.
 */

interface EnvironmentRigProps {
  config: EnvironmentConfig
  /** Every lightformer in the rig that is currently reaching the scene. */
  lightformers: LightformerConfig[]
  /**
   * Whatever the app put in `<LightStudio.Environment>`, drawn into the cube
   * map beside the lightformers.
   *
   * Occluders, mostly — a dark mesh in front of a lightformer, cutting the
   * light it throws. That is the one useful thing a lightformer cannot be, and
   * it is not something the rig can hold: a mesh is geometry and a material,
   * and a material is not JSON. So it stays the app's. The editor does not
   * draw a helper for it, does not list it and cannot move it.
   */
  content?: ReactNode
  /**
   * Shows the backdrop whatever the rig says. The editor's override, so you can
   * look straight at a lightformer without committing a background to the file.
   */
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

  // `toArray` rather than `count`, because it drops the nulls and booleans a
  // `{condition && …}` leaves behind. Counting those would mount an
  // `<Environment>` around nothing and hand the scene a black cube.
  const hasContent = Children.toArray(content).length > 0

  // Ground projection wraps the environment image around the horizon, so it
  // needs one, and drei drops the children when it is on. `parseSetup` says so
  // out loud; this is where it actually happens.
  const projected = config.ground.enabled && hasImage

  // `parseSetup` warns about the lightformers this drops, but it only ever
  // sees the file, and app content arrives as a prop. Same disappearance, so
  // it gets the same warning — from here, where the prop is.
  useGroundConflictWarning(projected && hasContent)

  const shapes =
    projected || (lightformers.length === 0 && !hasContent) ? undefined : (
      <>
        {lightformers.map((light) => (
          <LightformerNode key={light.id} light={light} />
        ))}
        {content}
      </>
    )

  // Nothing to show the scene. Rendering <Environment /> anyway would send it
  // to the cube branch with no file to load.
  if (!hasImage && !shapes) return null

  if (projected) {
    return (
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
    )
  }

  return (
    <Environment
      {...source}
      {...backdrop}
      environmentIntensity={config.intensity}
      environmentRotation={config.rotation}
      // Only meaningful on the portal branch, and only passed there: the cube
      // branch forwards whatever it does not recognise onto the scene object.
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
 * The background props, or nothing at all when there is no backdrop.
 *
 * Nothing at all is the important half. drei hands every one of these to
 * `applyProps(scene, ...)` whether or not it is setting a background, and r3f's
 * `applyProps` skips a prop only when it is `undefined` — so passing
 * `backgroundBlurriness: 0` while showing no background would write a 0 over
 * whatever an app had set for a background of its own. Omitting the keys means
 * the rig does not write them, which is the most a rig that is only lighting
 * should do.
 *
 * It is not a guarantee that the app's values survive. drei snapshots them when
 * its effect runs and puts the snapshot back when the effect is torn down, so a
 * value set after `<Environment>` mounted can still be reverted from under you.
 * That is drei's, and out of reach from here.
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

/**
 * `files` beats `preset`, which is drei's own precedence — its loader checks
 * `files` first. Stated here so the panel can say the same thing.
 */
function sourceOf(
  config: EnvironmentConfig,
): { files: string } | { preset: EnvironmentPreset } | Record<string, never> {
  if (config.files !== '') return { files: config.files }
  if (config.preset !== '') return { preset: config.preset }
  return {}
}

/**
 * drei's `Lightformer` is a unit-sized mesh that its `scale` resizes, so width
 * and height go in as a scale rather than as geometry arguments — the same two
 * numbers a rectArea light takes, which is the point.
 *
 * `target` is aimed with `lookAt`, exactly as `rectArea` already is, so the
 * gizmo and the wireframe both work on it without knowing what it is.
 */
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
