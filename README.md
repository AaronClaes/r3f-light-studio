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

`debug` shows you the rig, lets you pick things in it and move them. Numeric
editing still needs the panel.

- [x] Schema, parser and omit-defaults exporter
- [x] Zustand store with history, solo and selection
- [x] Renderer — all six light types, targets, shadows, tone mapping
- [x] Debug helpers — a wireframe per light, drawn from the config
- [x] Selection — click a light, or the point it aims at
- [x] Gizmo — drag the selected point, one undo step per drag
- [ ] Leva panel
- [ ] Vite dev-server writeback (`Cmd+S` writes `lights.json` in place)
- [ ] Solo/mute UI, fit-shadow-camera, presets, A/B compare

## Layout

```
apps/playground/          test scene
packages/light-studio/
  src/core/               schema, lights, parse, serialize, store — no r3f, no UI
  src/runtime/            LightStudio, LightRenderer — the production path
  src/debug/              lazy-loaded editor chunk
  src/debug/helpers/      wireframes, built from the config
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

## Debug helpers

The wireframes are drawn from the config, not from three's `SpotLightHelper` and
friends. That means the debug layer never touches the rendered lights: no ref
plumbing out of `LightRenderer`, no `.update()` calls to keep in sync, and — the
reason it matters — a helper for lights that are switched off, which is what
keeps them findable. It also means the emphasis below is ours to control rather
than three's.

- **Ambient lights have no helper.** They have neither a position nor a
  direction; there is nothing honest to draw. They'll be reachable from the
  panel.
- **A spot cone ends at `distance`**, or at the target when `distance` is 0.
  A point light's `distance` draws as three faint circles.

### Emphasis

Only the selected light's helper draws at full strength, the way Blender does
it. Turning `debug` on used to light up every cone and beam at once, which is
overwhelming on a rig of any size. There are three levels:

|              | when                                                |
| ------------ | --------------------------------------------------- |
| **selected** | full strength, in the light's own colour            |
| **idle**     | visible enough to read the rig, well out of the way |
| **dimmed**   | the light is off, or muted by someone else's solo   |

Each is a multiplier over a per-role base, so a beam is always quieter than the
shape it belongs to and a falloff radius quieter still — the radius is the
biggest thing on screen and would otherwise dominate. Handles are deliberately
exempt: they stay legible at every level, because they are how you find a light
in order to select it in the first place.

## Selection

Every light has a grabbable handle, and every light that aims has a second one
on its target. Which handles exist is derived from the schema rather than from
a per-type switch: a light gets one for each vector field it declares. Ambient
is the exception — it has no vector fields, so it has no handle and will be
selected from the panel.

A handle is a dashed ring with a small diamond at its centre, borrowed from
Blender's light gizmos. It billboards to the camera, so it reads as a ring from
every angle instead of collapsing into an ellipse, and holds a constant size on
screen so it stays grabbable whether you are up against a light or looking at
the whole rig. It ignores depth, so a light behind your geometry can still be
picked, and an invisible sphere slightly larger than the ring does the actual
hit-testing.

The dashes are baked into the geometry rather than drawn with
`LineDashedMaterial`. That material measures dash length in local units, and a
handle rescales every frame to hold its screen size — real dashes would stretch
and crawl as you moved the camera.

Selecting a light brightens both of its handles; only the one the gizmo is
driving turns white and grows. Clicking empty space deselects. The store tracks
_which_ handle is selected, not just which light, because the gizmo needs to
know whether you grabbed the light or its target.

## The gizmo

Translate only, via drei's `TransformControls`. The schema aims a light by
moving a target, so a rotate ring would be editing a field the format does not
have, and rotation is meaningless for a point light anyway. Drag the light's
handle to move it; drag its target handle to re-aim it.

**A drag is one undo step.** The store has a transaction: `beginTransaction`
snapshots the setup, every edit until `endTransaction` mutates freely without
touching the history, and the single entry is pushed on release. A drag that
ends where it started records nothing at all. The Leva panel will want the
same thing when you scrub a slider.

Two details worth knowing:

- **A tap on the gizmo does not deselect.** r3f reports a click as a "miss" on
  every object it did not hit, and the gizmo is not one of r3f's objects — so
  without help, tapping an axis would clear the selection the gizmo is attached
  to. The gizmo claims the click that follows a press it did not turn into a
  drag, and the deselect handler honours that claim.
- **Deselect lives on one object, not on every handle.** `onPointerMissed`
  fires once per un-hit object, so putting it on each handle would run the
  deselect once per handle — and the gizmo's claim would be consumed by the
  first one while the rest still cleared the selection.

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

- `<OrbitControls makeDefault />` is required, or dragging the gizmo will
  orbit the camera at the same time. drei reads `makeDefault` to find the
  controls it must disable mid-drag.
- `three` and `react` are pinned through the pnpm catalog. Two copies of
  `three` break `instanceof` checks and r3f reconciliation in ways that are
  very hard to trace.
- `RectAreaLightUniformsLib` is ~247 kB of BRDF lookup tables, so it is
  imported lazily and only when a rig actually contains a rect-area light.
