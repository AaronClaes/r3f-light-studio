import { ContactShadows, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { LightStudio } from 'r3f-light-studio'
import type { CSSProperties } from 'react'
import { BoxGeometry, Color, MeshBasicMaterial } from 'three'

import setup from './lights.json'

const box = new BoxGeometry()
const white = new MeshBasicMaterial({ color: new Color(1, 1, 1) })

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
          {/* A room, built the way a drei studio rig is: white boxes standing
              around the subject to bounce and to block, with the emitters in
              among them. None of this can live in the rig — a mesh is geometry
              and a material, and a material is not JSON — so it stays here,
              and the editor leaves it alone.

              Worth knowing: the environment is rendered from a single point at
              the origin, so a box only blocks what it covers *from there*, not
              from your camera. Shared `box` and `white` instances because
              every one of these is the same geometry and the same material. */}
          <LightStudio.Environment>
            <mesh
              geometry={box}
              material={white}
              castShadow
              receiveShadow
              position={[-1.706, -1.0, 2.846]}
              rotation={[0, -0.195, 0]}
              scale={[2.328, 2.905, 4.651]}
            />
            <mesh
              geometry={box}
              material={white}
              castShadow
              receiveShadow
              position={[-7.607, -0.754, -1.758]}
              rotation={[0, 0.994, 0]}
              scale={[1.97, 1.534, 3.955]}
            />
            <mesh
              geometry={box}
              material={white}
              castShadow
              receiveShadow
              position={[5.167, -0.16, 6.803]}
              rotation={[0, 0.561, 0]}
              scale={[3.927, 6.285, 3.687]}
            />
            <mesh
              geometry={box}
              material={white}
              castShadow
              receiveShadow
              position={[-2.017, 0.018, 6.124]}
              rotation={[0, 0.333, 0]}
              scale={[2.002, 4.566, 2.064]}
            />
            <mesh
              geometry={box}
              material={white}
              castShadow
              receiveShadow
              position={[4.291, -0.356, -2.621]}
              rotation={[0, -0.286, 0]}
              scale={[1.546, 1.552, 1.496]}
            />
            <mesh
              geometry={box}
              material={white}
              castShadow
              position={[-0.193, -0.369, -3.547]}
              rotation={[0, 0.516, 0]}
              scale={[1.875, 1.487, 1.986]}
            />
            <Lightformer
              form="box"
              intensity={5.2}
              position={[-4, 1, 3]}
              scale={1}
              target={false}
              color="#FFFFFF"
              light={{
                intensity: 4.8,
                distance: 48,
                decay: 0.5,
              }}
            />
            <Lightformer
              form="box"
              intensity={1.4}
              position={[1, -2, 1]}
              scale={1}
              target={false}
              color="#FFFFFF"
              light={{
                intensity: 2.1,
                distance: 25,
                decay: 0.2,
              }}
            />
            <Lightformer
              form="box"
              intensity={2}
              position={[-11, -1, 2]}
              scale={1}
              target={false}
              color="#FFFFFF"
              light={{
                intensity: 0,
                distance: 10,
                decay: 0,
              }}
            />

            <spotLight
              position={[-5, 9, -21]}
              angle={0.2}
              penumbra={0.48}
              intensity={1.5}
              decay={0.2}
              color="#FFFFFF"
            />
            <spotLight
              position={[8, 3, 19]}
              angle={0.7}
              penumbra={0.57}
              intensity={1.4}
              decay={0.1}
              color="#FFFFFF"
            />
          </LightStudio.Environment>
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

      <ContactShadows position={[0, 0.001, 0]} opacity={0.5} scale={16} blur={2.4} far={6} />
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
