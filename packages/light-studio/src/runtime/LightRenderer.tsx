import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type {
  DirectionalLightConfig,
  LightConfig,
  OrthographicShadowConfig,
  PointLightConfig,
  RectAreaLightConfig,
  ShadowConfig,
  SpotLightConfig,
  Vec3,
} from '../core/schema'

/**
 * Turns a setup into r3f elements. Deliberately dumb: no store, no editor
 * state. This is the code path that runs in production.
 */
export function LightRenderer({ lights }: { lights: LightConfig[] }) {
  useRectAreaLightUniforms(lights.some((light) => light.type === 'rectArea'))

  return (
    <>
      {lights.map((light) => (
        <LightNode key={light.id} light={light} />
      ))}
    </>
  )
}

function LightNode({ light }: { light: LightConfig }) {
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

/**
 * three resolves a light's aim from its target's world matrix, so the target
 * has to be a real node in the scene graph. Creating it here is what lets the
 * schema store a plain `[x, y, z]` instead of an Object3D reference.
 */
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
 * Applied imperatively rather than through r3f's dashed props because resizing
 * a shadow map is not a plain assignment: the existing render target has to be
 * disposed or three keeps rendering at the old resolution and leaks the
 * texture.
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

/**
 * RectAreaLight renders black until its BRDF lookup tables are initialised.
 * They are ~247 kB, so they load lazily and only when a rig contains one.
 */
function useRectAreaLightUniforms(needed: boolean): void {
  useEffect(() => {
    if (!needed || rectAreaUniformsRequested) return
    rectAreaUniformsRequested = true
    void import('three/examples/jsm/lights/RectAreaLightUniformsLib.js').then((module) => {
      module.RectAreaLightUniformsLib.init()
    })
  }, [needed])
}
