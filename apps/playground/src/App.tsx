import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { LightStudio } from 'r3f-light-studio'
import { useEffect, useRef, type CSSProperties } from 'react'
import type { Group, Mesh } from 'three'

import setup from './lights.json'

export function App() {
  return (
    <>
      {/* Tone mapping and exposure are the canvas's, not the rig's. r3f
          already defaults to ACESFilmic; only the exposure is ours. */}
      <Canvas shadows camera={{ position: [6, 4, 8], fov: 40 }} gl={{ toneMappingExposure: 1.1 }}>
        {/* makeDefault is what lets the studio's gizmos suspend orbiting while
            you drag a light. Without it the camera fights the gizmo. */}
        <OrbitControls makeDefault target={[0, 0.8, 0]} />

        {/* Armed for the whole session; the toggle key is what shows it. */}
        <LightStudio setup={setup} debug>
          {/* Where meshes go that the rig cannot describe — occluders in front
              of a lightformer, or a room to bounce off. A mesh is geometry and
              a material, and a material is not JSON, so it lives here and the
              editor leaves it alone. Empty for now.

              Worth knowing before you put something in: the environment is
              rendered from a single point at the origin, so a mesh only blocks
              what it covers *from there*, not from your camera. */}
          <LightStudio.Environment />
        </LightStudio>

        <Subjects />
      </Canvas>

      {/* The editor starts hidden and nothing on screen says it is there. */}
      <p style={panelStyle}>
        Press <kbd style={kbdStyle}>F2</kbd> for the light studio
      </p>
    </>
  )
}

/** Shapes chosen to read lighting: a curve, a hard edge, and a floor to catch shadows. */
function Subjects() {
  /**
   * Contact shadows are a plane showing a shadow texture, so the studio's grey
   * mode — which replaces every material that lets it — would paint over them
   * with the rest of the scene. They are a lighting cue rather than a surface
   * being lit, which is exactly what `allowOverride` is for. Any app material
   * can say the same.
   */
  const shadows = useRef<Group>(null)
  useEffect(() => {
    shadows.current?.traverse((object) => {
      const material = (object as Mesh).material
      if (material && !Array.isArray(material)) material.allowOverride = false
    })
  }, [])

  return (
    <>
      <mesh castShadow receiveShadow position={[0, 1, 0]}>
        <torusKnotGeometry args={[0.6, 0.22, 160, 32]} />
        <meshStandardMaterial color="#c9c9cf" metalness={0.35} roughness={0.28} />
      </mesh>

      <mesh castShadow receiveShadow position={[-1.9, 0.5, 0.6]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8a8a92" roughness={0.7} />
      </mesh>

      <mesh castShadow receiveShadow position={[1.8, 0.45, 1.1]}>
        <sphereGeometry args={[0.45, 48, 48]} />
        <meshStandardMaterial color="#d8d8de" metalness={0.1} roughness={0.15} />
      </mesh>

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#26262b" roughness={0.9} />
      </mesh>

      <ContactShadows
        ref={shadows}
        position={[0, 0.001, 0]}
        opacity={0.5}
        scale={16}
        blur={2.4}
        far={6}
      />
    </>
  )
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 16,
  left: 16,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  margin: 0,
  padding: '8px 12px',
  borderRadius: 8,
  background: 'rgba(20,20,24,0.8)',
  color: '#e8e8ee',
  font: '13px ui-sans-serif, system-ui, sans-serif',
  userSelect: 'none',
}

const kbdStyle: CSSProperties = {
  padding: '1px 6px',
  borderRadius: 4,
  background: '#ffffff1a',
  font: '12px ui-monospace, monospace',
}
