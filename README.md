# r3f-light-studio

A `<LightStudio />` component for react-three-fiber. One JSON file describes your
whole lighting rig; the component renders it in production and, with `debug`,
turns into an editor for it.

Scope is deliberately narrow: **only the lights you pass in**. Not a scene
editor (that's [Triplex](https://triplex.dev)), not an animation tool (that's
[Theatre.js](https://www.theatrejs.com)).

```tsx
import setup from './lights.json'

export function Scene() {
  return (
    <Canvas shadows>
      <OrbitControls makeDefault />
      <LightStudio setup={setup} debug={import.meta.env.DEV} />
      <YourScene />
    </Canvas>
  )
}
```

## Status

Step 1 of 4. The schema, store and renderer are done and verified; the editor
UI is not built yet.

- [x] Schema, parser and omit-defaults exporter
- [x] Zustand store with history, solo and selection
- [x] Renderer — all six light types, targets, shadows, tone mapping
- [ ] Debug layer — helpers, selection, TransformControls, Leva panel
- [ ] Vite dev-server writeback (`Cmd+S` writes `lights.json` in place)
- [ ] Solo/mute UI, fit-shadow-camera, presets, A/B compare

## Layout

```
apps/playground/          test scene
packages/light-studio/
  src/core/               schema, lights, parse, serialize, store — no r3f, no UI
  src/runtime/            LightStudio, LightRenderer — the production path
  src/debug/              lazy-loaded editor chunk
```

`core/schema.ts` describes each light type exactly once, in `LIGHT_DEFINITIONS`.
The TypeScript types, the parser's coercion, the serialiser's default-stripping
and the editor's future field list all derive from that one object, so adding a
light type means editing a single place.

Two rules keep this honest:

1. `core` never imports Leva or drei.
2. `runtime` reaches `debug` only through `React.lazy`, so nothing in the
   editor can reach a production bundle. Verified in the build output — the
   debug chunk is emitted separately.

## Why the schema isn't three's `toJSON`

`Object3D.toJSON()` is a wire format. It stores transforms as 16-float
matrices, colours as integers, and regenerates UUIDs on every export, so every
save produces a full-file diff. It also references a light's `target` by UUID,
which means a target missing from the exported graph silently reloads at the
origin rather than erroring.

This file is committed, hand-edited and reviewed, so it uses named vectors and
hex strings instead. What it _does_ borrow from three: property names and units
verbatim (`intensity`, `decay`, `penumbra`, `normalBias`, `mapSize`), and the
omit-defaults discipline from `LightShadow.toJSON` — exports contain only what
was actually authored.

An `Object3D`-format export is a possible v2 feature, as a one-way adapter.

## Schema notes

- **Aiming is a point, not a rotation.** Directional and spot lights store
  `target: [x, y, z]`. The `Object3D` three needs is created and parented for
  you. Rotating a light to aim it is unintuitive and rotation is meaningless
  for point lights.
- **Shadow shape follows the shadow camera.** Directional lights carry
  orthographic `frustum` bounds; point and spot lights use a perspective shadow
  camera and have no `frustum` field at all.
- **Intensities assume physically-correct lighting** (three >= r155). Point and
  spot values are in the tens, not around 1.
- **Tone mapping and exposure are applied by default**, and restored on
  unmount. Pass `applyRenderer={false}` if your app manages its own.
- **Solo is not in the schema.** It's a way of looking at a rig, not a property
  of one, so it lives in the store and never serialises.
- Defaults are omitted on write. `parseSetup` fills them back in and never
  throws — malformed input yields warnings, not a black scene.

## Commands

```bash
pnpm dev         # playground on :5173
pnpm check       # lint + format:check + typecheck
pnpm build
```

Tooling is [oxc](https://oxc.rs) — `oxlint` and `oxfmt` in place of ESLint and
Prettier — plus `tsc` for typechecking, which oxc does not replace. The
`react-perf` plugin is off: its no-new-array/object-as-prop rules fire on
essentially every r3f element (`args={[...]}`, `position={[...]}`).

## Gotchas

- `<OrbitControls makeDefault />` is required for the (upcoming) gizmos to
  suspend orbiting mid-drag.
- `three` and `react` are pinned through the pnpm catalog. Two copies of
  `three` break `instanceof` checks and r3f reconciliation in ways that are
  very hard to trace.
- `RectAreaLightUniformsLib` is ~247 kB of BRDF lookup tables, so it is
  imported lazily and only when a rig actually contains a rect-area light.
