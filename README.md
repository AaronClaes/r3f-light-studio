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

`debug` shows you the rig, lets you pick things in it, move them and edit every
field. What it cannot do yet is save — the edits live in memory until you
reload.

- [x] Schema, parser and omit-defaults exporter
- [x] Zustand store with history, solo and selection
- [x] Renderer — all six light types, targets, shadows, tone mapping
- [x] Debug helpers — a wireframe per light, drawn from the config
- [x] Selection — click a light, or the point it aims at
- [x] Gizmo — drag the selected point, one undo step per drag
- [x] Properties panel — every field of the selected light
- [x] Outliner — the rig as a list, with rename, on/off and solo
- [ ] Vite dev-server writeback (`Cmd+S` writes `lights.json` in place)
- [ ] Keyboard undo/redo
- [ ] Fit-shadow-camera, presets, add/duplicate/delete, A/B compare

## Layout

```
apps/playground/            test scene
packages/light-studio/
  src/core/                 schema, lights, parse, serialize, store — no r3f, no UI
  src/runtime/              LightStudio, LightRenderer — the production path
  src/debug/                lazy-loaded editor chunk
  src/debug/drawnLights.ts  which lights the editor draws anything for
  src/debug/helpers/        wireframes, built from the config
  src/debug/panel/          leva controls, built from the config
  src/debug/ui/             the editor's DOM — outliner, drag-paint, stylesheet
```

`core/schema.ts` describes each light type exactly once, in `LIGHT_DEFINITIONS`.
The TypeScript types, the parser's coercion, the serialiser's default-stripping,
which handles a light gets and which controls the panel shows all derive from
that one object, so adding a light type means editing a single place.

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
plumbing out of `LightRenderer`, no `.update()` calls to keep in sync, and a
helper that can be drawn for a light that is switched off — which is what makes
selecting one from the outliner useful. It also means the emphasis below is
ours to control rather than three's.

- **Ambient lights have no helper.** They have neither a position nor a
  direction; there is nothing honest to draw. They are reachable from the
  outliner.
- **A spot cone ends at `distance`**, or at the target when `distance` is 0.
  A point light's `distance` draws as three faint circles.

### What gets drawn

A light that is not lighting anything is not drawn at all. Switch it off, or
mute it under someone else's solo, and its wireframe and both of its handles
go with it. Dimming them instead was the earlier behaviour, justified by
keeping an off light findable — the outliner does that now, and a rig of faint
shapes for things that are doing nothing is just noise.

**The selected light is the exception, and is always drawn.** Selecting an
off light has to show you where it is, or the gizmo would attach to a point
with nothing to grab.

### Emphasis

Of what is drawn, only the selected light draws at full strength, the way
Blender does it. Turning `debug` on used to light up every cone and beam at
once, which is overwhelming on a rig of any size.

|              | when                                                |
| ------------ | --------------------------------------------------- |
| **selected** | full strength, in the light's own colour            |
| **idle**     | visible enough to read the rig, well out of the way |

Each is a multiplier over a per-role base, so a beam is always quieter than the
shape it belongs to and a falloff radius quieter still — the radius is the
biggest thing on screen and would otherwise dominate. Handles are deliberately
exempt: they stay legible at both levels, because they are how you find a light
in order to select it in the first place.

## Selection

Every light has a grabbable handle, and every light that aims has a second one
on its target. Which handles exist is derived from the schema rather than from
a per-type switch: a light gets one for each vector field it declares. Ambient
is the exception — it has no vector fields, so it has no handle and is
selected from the outliner.

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
ends where it started records nothing at all. Scrubbing a slider in the
properties panel works the same way.

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

## The editor UI

Two panels in a column on the right, after Blender: an **outliner** listing the
rig, and a **properties** panel for whichever light is selected. Splitting them
is what keeps either one legible — a ten-light rig shown as ten folders of
controls is a wall, and a property inspector on its own gives you nowhere to
see the rig as a whole.

### It mounts its own React root

`<LightStudio />` is used inside `<Canvas>`, so the reconciler around it is
r3f's: it builds THREE objects, and a `<div>` in that tree throws.
`createPortal` does not help either, because a portal still renders through the
reconciler that created it. So the editor does what drei's `<Html>` does —
opens a second React root on a real DOM node.

The two roots share state without any plumbing because the studio store is a
vanilla zustand store behind a context rather than a hook. The same object is
provided to both trees.

### The outliner

One row per light: a colour swatch, its name, its type, and two toggles. It
owns the three things that are about a light rather than about its lighting —
its name (double-click to rename), whether it is **on**, and whether you are
looking at it **alone**.

The two toggles are deliberately not the same kind of thing, and are drawn
differently to say so. `enabled` is a schema field and is written to the file.
Solo is a way of looking at a rig, lives only in the store and never
serialises, so it is amber and the header grows a badge that clears it.

**Press a toggle and drag along the column** to set every row you pass, the way
Blender's outliner works. Three things make the gesture behave:

- It **copies** the value the first toggle became rather than flipping each row
  in turn, so dragging back over a row you have already reached leaves it
  alone. That is what lets you correct an overshoot without undoing your work.
- It fills in the rows **between** two pointer positions. A fast drag skips
  elements outright — the browser reports only the ones a move happens to land
  on — so following the events alone would leave holes in the middle of a
  stroke.
- The whole stroke is **one undo step**, bracketed by the same store
  transaction a gizmo drag uses. A solo stroke opens one too, and closes having
  recorded nothing, because solo never reaches the setup.

The store has `setSolo(id, on)` rather than a toggle for exactly this reason: a
stroke has to be able to repeat a value over a row without flipping it back.

It is also how you reach an ambient light. They have no position, so no handle,
so before this the only way to select one was a dropdown.

### The properties panel

Which controls appear is derived from `LIGHT_DEFINITIONS` the same way the
handles are — a field is in the panel because the schema says the light has it.
What the schema does not say is how a field should _read_, so step sizes, the
menu of shadow-map resolutions and the nesting of the shadow settings live in
`debug/panel/fields.ts`. Ranges are the exception: `clamp` in the schema marks
the values three actually misbehaves outside of, and those become hard limits.

Leva renders it, filled into the slot rather than floating, with a store of its
own so an app that already uses leva keeps its own panel where it put it.
Leva is a tenant here, not the architecture: `fields.ts` describes controls and
imports nothing from it, which is the seam a different widget library would
slot into.

**The store owns the values; leva mirrors them.** Every control writes through a
store action, and a store subscription pushes values back into leva. Leva can
own its own state, but then a gizmo drag would not move the numbers and undo
would not move either. Two details make the mirror safe:

- Leva reports a change whether it came from the panel or from a `set` call, so
  the write-back path checks `fromPanel` and ignores its own echo. It also
  ignores the one `initial` call leva makes on mount, which would otherwise
  record an edit nobody made just for selecting a light.
- The control under the pointer is skipped while it is being dragged, so the
  mirror never fights a scrub in progress.

**Scrubbing a slider is one undo step**, the same as one gizmo drag — leva's
`onEditStart`/`onEditEnd` bracket the store transaction.

Two leva quirks worth knowing, because both look like bugs in this package:

- **Leva keeps whatever value a control path already had**, and every light
  type shares `intensity`, `color` and `position`. Rebuilding the schema does
  not reset them and neither does remounting, so on every selection change the
  panel writes all of its values over the ones the previous light left behind.
  Field order needs the same treatment — each control carries an explicit
  `order`, because leva otherwise lays a folder out in the order its controls
  first appeared and the fields shuffle as you click between types.
- **`useControls` takes its settings before its deps**, not after. Called
  without a folder name it reads argument two as either the deps array or the
  settings, and a settings object in argument three is dropped silently. The
  symptom is a panel that works but registers into leva's global store, so
  leva's own floating panel appears on top of this one.

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
- The editor renders **fixed to the viewport**, not inside your layout. Two
  `<LightStudio debug />` in one app would stack two columns on top of each
  other; the store is per-instance but the screen is not.
- The stylesheet is **injected as a `<style>` tag**, so there is no CSS file to
  import. It only ships in the debug chunk.
- `three` and `react` are pinned through the pnpm catalog. Two copies of
  `three` break `instanceof` checks and r3f reconciliation in ways that are
  very hard to trace.
- `RectAreaLightUniformsLib` is ~247 kB of BRDF lookup tables, so it is
  imported lazily and only when a rig actually contains a rect-area light.
