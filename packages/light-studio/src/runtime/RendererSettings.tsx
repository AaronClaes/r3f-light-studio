import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

import type { RendererConfig, ToneMappingName } from '../core/schema'

const TONE_MAPPING: Record<ToneMappingName, THREE.ToneMapping> = {
  None: THREE.NoToneMapping,
  Linear: THREE.LinearToneMapping,
  Reinhard: THREE.ReinhardToneMapping,
  Cineon: THREE.CineonToneMapping,
  ACESFilmic: THREE.ACESFilmicToneMapping,
  AgX: THREE.AgXToneMapping,
  Neutral: THREE.NeutralToneMapping,
}

/** Restores the host's previous values on unmount. */
export function RendererSettings({ config }: { config: RendererConfig }) {
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    const previousToneMapping = gl.toneMapping
    const previousExposure = gl.toneMappingExposure

    gl.toneMapping = TONE_MAPPING[config.toneMapping]
    gl.toneMappingExposure = config.exposure
    invalidate()

    return () => {
      gl.toneMapping = previousToneMapping
      gl.toneMappingExposure = previousExposure
      invalidate()
    }
  }, [gl, invalidate, config.toneMapping, config.exposure])

  return null
}
