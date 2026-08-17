import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

import type {
  DirectionalLightConfig,
  EnvironmentConfig,
  LightConfig,
  LightformerConfig,
  OrthographicShadowConfig,
  PointLightConfig,
  RectAreaLightConfig,
  ShadowConfig,
  SpotLightConfig,
  Vec3,
} from '../core/schema'
import { EnvironmentRig } from './EnvironmentRig'

/** Everything that becomes a three light. A lightformer becomes a mesh instead. */
type DirectLight = Exclude<LightConfig, LightformerConfig>

interface LightRendererProps {
  lights: LightConfig[]
  /** null when there is none, or it is switched off. */
  environment?: EnvironmentConfig | null
  environmentContent?: ReactNode
  /** The editor's override, which shows the backdrop whatever the rig says. */
  forceBackground?: boolean
}

/**
 * The production path: no store, no editor state. Lightformers are split out
 * because they are meshes in the environment's cube map, so they have to be
 * children of `<Environment>`.
 */
export function LightRenderer({
  lights,
  environment = null,
  environmentContent = null,
  forceBackground = false,
}: LightRendererProps) {
  useRectAreaLightUniforms(lights.some((light) => light.type === 'rectArea'))

  const lightformers: LightformerConfig[] = []
  const direct: DirectLight[] = []
  for (const light of lights) {
    if (light.type === 'lightformer') lightformers.push(light)
    else direct.push(light)
  }

  return (
    <>
      {direct.map((light) => (
        <LightNode key={light.id} light={light} />
      ))}

      {environment ? (
        <EnvironmentRig
          config={environment}
          content={environmentContent}
          forceBackground={forceBackground}
          lightformers={lightformers}
        />
      ) : null}
    </>
  )
}

function LightNode({ light }: { light: DirectLight }) {
  switch (light.type) {
    case 'ambient':
      return <ambientLight color={light.color} intensity={light.intensity} />

    case 'hemisphere':
      return (
        <hemisphereLight
          color={light.color}
          groundColor={light.groundColor}
          intensity={light.intensity}
          position={light.position}
        />
      )

    case 'directional':
      return <DirectionalLightNode light={light} />

    case 'point':
      return <PointLightNode light={light} />

    case 'spot':
      return <SpotLightNode light={light} />

    case 'rectArea':
      return <RectAreaLightNode light={light} />
  }
}

function DirectionalLightNode({ light }: { light: DirectionalLightConfig }) {
  const ref = useRef<THREE.DirectionalLight>(null)
  const target = useAimTarget(light.target)
  useShadowConfig(ref, light.shadow)

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={ref}
        castShadow={light.shadow.enabled}
        color={light.color}
        intensity={light.intensity}
        position={light.position}
        target={target}
      />
    </>
  )
}

function PointLightNode({ light }: { light: PointLightConfig }) {
  const ref = useRef<THREE.PointLight>(null)
  useShadowConfig(ref, light.shadow)

  return (
    <pointLight
      ref={ref}
      castShadow={light.shadow.enabled}
      color={light.color}
      decay={light.decay}
      distance={light.distance}
      intensity={light.intensity}
      position={light.position}
    />
  )
}

function SpotLightNode({ light }: { light: SpotLightConfig }) {
  const ref = useRef<THREE.SpotLight>(null)
  const target = useAimTarget(light.target)
  useShadowConfig(ref, light.shadow)

  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={ref}
        angle={light.angle}
        castShadow={light.shadow.enabled}
        color={light.color}
        decay={light.decay}
        distance={light.distance}
        intensity={light.intensity}
        penumbra={light.penumbra}
        position={light.position}
        target={target}
      />
    </>
  )
}

function RectAreaLightNode({ light }: { light: RectAreaLightConfig }) {
  const ref = useRef<THREE.RectAreaLight>(null)
  const [x, y, z] = light.position
  const [tx, ty, tz] = light.target

  // RectAreaLight has no `.target`; it is aimed by rotating the light itself.
  useEffect(() => {
    ref.current?.lookAt(tx, ty, tz)
  }, [tx, ty, tz, x, y, z])

  return (
    <rectAreaLight
      ref={ref}
      color={light.color}
      height={light.height}
      intensity={light.intensity}
      position={light.position}
      width={light.width}
    />
  )
}

/** three aims from the target's world matrix, so it has to be a real node. */
function useAimTarget(position: Vec3): THREE.Object3D {
  const target = useMemo(() => new THREE.Object3D(), [])
  const [x, y, z] = position

  useEffect(() => {
    target.position.set(x, y, z)
    target.updateMatrixWorld()
  }, [target, x, y, z])

  return target
}

type ShadowCastingLight = THREE.DirectionalLight | THREE.PointLight | THREE.SpotLight

/**
 * Imperative rather than r3f's dashed props: resizing a shadow map has to
 * dispose the old render target, or three keeps the old resolution and leaks it.
 */
function useShadowConfig(
  ref: React.RefObject<ShadowCastingLight | null>,
  config: ShadowConfig | OrthographicShadowConfig,
): void {
  const { mapSize, bias, normalBias, radius, near, far } = config
  const [left, right, top, bottom] = 'frustum' in config ? config.frustum : [0, 0, 0, 0]

  useEffect(() => {
    const light = ref.current
    if (!light) return

    const shadow = light.shadow

    if (shadow.mapSize.width !== mapSize || shadow.mapSize.height !== mapSize) {
      shadow.mapSize.set(mapSize, mapSize)
      shadow.map?.dispose()
      shadow.map = null
    }

    shadow.bias = bias
    shadow.normalBias = normalBias
    shadow.radius = radius

    const camera = shadow.camera
    camera.near = near
    camera.far = far

    if (camera instanceof THREE.OrthographicCamera) {
      camera.left = left
      camera.right = right
      camera.top = top
      camera.bottom = bottom
    }

    camera.updateProjectionMatrix()
    shadow.needsUpdate = true
  }, [ref, mapSize, bias, normalBias, radius, near, far, left, right, top, bottom])
}

let rectAreaUniformsRequested = false

/** RectAreaLight renders black without these, and they are ~247 kB. */
function useRectAreaLightUniforms(needed: boolean): void {
  useEffect(() => {
    if (!needed || rectAreaUniformsRequested) return
    rectAreaUniformsRequested = true
    void import('three/examples/jsm/lights/RectAreaLightUniformsLib.js').then((module) => {
      module.RectAreaLightUniformsLib.init()
    })
  }, [needed])
}
