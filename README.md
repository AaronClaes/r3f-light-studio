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

Press **`F2`** to bring the editor up, and again to put it away. It stays up
across reloads until you close it.

## Status

The editor lets you pick things in the rig, move them and edit every field, and
`Cmd+S` writes the result back over the file it came from. The loop is closed:
tweak the lights, save, commit the diff. Without the Vite plugin it hands the
JSON back through the clipboard instead, and edits live in memory until you
reload — surviving being put away and turning `debug` off, since neither throws
your work out.

- [x] Schema, parser and omit-defaults exporter
- [x] Zustand store with history, solo and selection
- [x] Renderer — all six light types, targets, shadows, tone mapping
- [x] Debug helpers — a wireframe per light, drawn from the config
- [x] Selection — click a light, or the point it aims at
- [x] Gizmo — drag the selected point, one undo step per drag
- [x] Properties panel — every field of the selected light
- [x] Outliner — the rig as a list, with rename, on/off and solo
- [x] Toggle key — the editor is armed by `debug`, shown by a keypress
- [x] Keyboard undo/redo
- [x] Copy the rig back out as JSON, formatted for the file it came from
- [x] Vite dev-server writeback — `Cmd+S` writes the file in place
- [ ] Fit-shadow-camera, presets, add/duplicate/delete, A/B compare

## Layout

```
apps/playground/            test scene
packages/light-studio/
  src/core/                 schema, lights, parse, serialize, store — no r3f, no UI
  src/core/save.ts          the contract the plugin and the editor both import
  src/vite/                 the dev-server plugin — Node only, never bundled
  src/runtime/              LightStudio, LightRenderer, toggleKey — the production path
  src/debug/                lazy-loaded editor chunk
  src/debug/historyKeys.ts  Cmd+Z and Cmd+Shift+Z, bound while the editor shows
  src/debug/exportSetup.ts  how the file looks — printing, not what goes in it
  src/debug/drawnLights.ts  which lights the editor draws anything for
  src/debug/helpers/        wireframes, built from the config
  src/debug/panel/          leva controls, built from the config
  src/debug/ui/             the editor's DOM — panels, outliner, drag-paint, styles
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

## Arming it, and showing it

`debug` and the toggle key answer different questions. **`debug` decides
whether the editor exists; the key decides whether you are looking at it.** A
rig you are not editing right now should not have a panel sitting over your
scene, and a rig you might edit in a moment should not cost a reload to reach
— so the usual setup is `debug={import.meta.env.DEV}` and a keypress.

Armed, the editor starts **hidden**. Put away it is not merely transparent:
the panels, the wireframes, the handles and the gizmo are all gone and the
scene renders exactly as it does in production. What stays is the store, so
every edit, your selection and even a half-typed rename are still there when
you bring it back. That is the difference from turning `debug` off, which
unmounts the chunk the store lives in and has to hand the rig back on the way
out.

**A reload is not a decision, so it does not close the editor.** Showing it
writes a flag to `sessionStorage`, and a page that finds one comes up with the
editor already open — seeded into the store before the first render, so there
is no blink. Closing it clears the flag. It is `sessionStorage` rather than
`localStorage` deliberately: this survives the dozen reloads an hour a dev
server costs you and dies with the tab, so a page opened fresh still starts
hidden and the rule above stays true for anyone who did not just close it. The
flag is keyed by the `id` prop, so two rigs on one page remember themselves
separately. Nothing else survives a reload — the edits are still in memory
only, and that is what `Cmd+S` is for.

The key is yours to pick:

```tsx
<LightStudio setup={setup} debug />                                       // F2
<LightStudio setup={setup} debug toggleKey={{ key: 'Backquote' }} />
<LightStudio setup={setup} debug toggleKey={{ modifier: 'meta', key: 'd' }} />
<LightStudio setup={setup} debug toggleKey={null} />                      // no binding
```

**F2 is the default because it is in the same place on every keyboard.**
Backtick is the older convention — the debug console since Quake — and it is
still the better key if your team is all on ANSI boards. It is a poor default,
though: on the ISO layouts most of Europe types on it moves from under Esc to
the left of Z, and on several it is a dead key you press twice. A key whose
whole job is to stay out of the way should not be one you hunt for. F2 also
has no text-field hazard at all, and nothing in any browser claims it — unlike
`Cmd+Shift+D`, which bookmarks all your tabs.

Three details in the binding are load-bearing:

- **`key` is matched against `KeyboardEvent.code` _and_ `.key`**, case
  insensitively, so `'Backquote'`, `'F2'` and `'d'` all work. Matching `code`
  is what keeps backtick working on layouts where it is a dead key — there
  `.key` arrives as `'Dead'` and a `.key`-only binding quietly stops firing.
- **A keypress inside a text field belongs to the field.** F2 is safe either
  way, but leva's panel is mostly inputs and the outliner renames in place, so
  binding a bare letter or backtick without this would close the editor
  mid-word.
- **The modifier must match exactly.** With a bare `Backquote`, Shift+`` ` ``
  types a tilde and does nothing else.

There is also an **×** in the corner of the `Lights` header, which does exactly
what the key does. Its tooltip names the binding — `Hide the studio (F2)` —
because the editor keeps everything while hidden and someone who closed it from
a button has nothing else on screen to tell them how to get it back.

**Whether the editor is showing lives in the store**, not in `<LightStudio />`.
The editor's DOM is rendered into a React root of its own exactly once, so a
callback handed in from the tree outside would freeze at that first render. The
store is the one thing that crosses the boundary, so anything the panels need
from outside — the visibility flag, the name of the toggle key — goes through
it. The binding is therefore made in the debug chunk, and a keypress in the
few milliseconds before that chunk loads does nothing; there is no editor to
show yet either.

## Undo

`Cmd+Z` and `Cmd+Shift+Z`, or `Ctrl+Z` and `Ctrl+Y`. Both platforms' modifiers
are accepted, so one build behaves natively on either. Unlike the toggle key
these are **not configurable**: undo is the one binding that is the same in
every application everywhere, so there is nothing here anyone wants to rebind.

The store has had `undo`/`redo` and a history stack since the beginning, and
every editing gesture already collapses into exactly one entry — a gizmo drag,
a slider scrub and a drag-painted row of switches are each a single step. This
is only the keyboard reaching it.

- **Bound only while the editor is on screen.** Put away, the studio is not
  what you are editing and `Cmd+Z` belongs to the app around it.
- **A keypress in a text field is the field's.** The rig does not move, and
  `preventDefault` is not called either, so the browser's own undo still works
  on the half-typed name in front of you.
- **Ignored while a drag or a slider scrub is open.** The snapshot the
  transaction took is what gets pushed when it ends, so rewinding underneath
  it would record a step that never happened.
- **`Cmd+Y` is deliberately not redo.** `Ctrl+Y` is the Windows habit, but on
  a Mac `Cmd+Y` belongs elsewhere — in Firefox it opens the history window.
- **Z is matched by physical position _and_ produced character.** `code` alone
  misses Dvorak, where the OS routes `Cmd+Z` by character and the physical key
  is somewhere else entirely.

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
mute it under someone else's solo, and its wireframe and its handles go with
it. Dimming them instead was the earlier behaviour, justified by
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

Every light has a grabbable handle, and the light you have selected gets a
second one on its target. Which handles exist is derived from the schema
rather than from a per-type switch: a light gets one for each vector field it
declares. Ambient is the exception — it has no vector fields, so it has no
handle and is selected from the outliner.

**A target only appears for the selected light.** Unselected, it is a
redundant place to click: the only useful half of that click is "select this
light", which the light's own handle and the outliner both already do. What it
costs is real — most rigs aim at the origin, so a dozen targets stack into one
bright blob there, and every one of them doubles a light's footprint on
screen. Nothing is hidden by this: the beam still runs out to the target, so
where a light points reads the same. You just pick the light up before you
move the far end of it.

The two are drawn differently, because they are different kinds of point. A
light is a dashed ring around a small diamond, borrowed from Blender's light
gizmos. A target is a bare reticle — four arms with a gap in the middle, no
ring — so the two never read as the same thing even side by side, and the
lesser of the two sits lighter on screen.

A handle billboards to the camera, so it reads as a ring from every angle
instead of collapsing into an ellipse, and holds a constant size on screen so
it stays grabbable whether you are up against a light or looking at the whole
rig. It ignores depth, so a light behind your geometry can still be picked,
and an invisible sphere slightly larger than the ring does the actual
hit-testing.

The dashes are baked into the geometry rather than drawn with
`LineDashedMaterial`. That material measures dash length in local units, and a
handle rescales every frame to hold its screen size — real dashes would stretch
and crawl as you moved the camera.

Selecting a light brightens its handles; only the one the gizmo is
driving turns white and grows. Clicking empty space deselects. The store tracks
_which_ handle is selected, not just which light, because the gizmo needs to
know whether you grabbed the light or its target.

## The gizmo

Translate only, via drei's `TransformControls`. The schema aims a light by
moving a target, so a rotate ring would be editing a field the format does not
have, and rotation is meaningless for a point light anyway. Drag the light's
handle to move it; drag the reticle that appears at its target to re-aim it.

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

Both collapse from their headers, down to a title bar each, for when you want
to look at the scene rather than at the tool. A collapsed section is **hidden,
not unmounted**: leva hands its panel back to its own floating root the moment
the last one unmounts, so collapsing the properties would otherwise spawn a
second panel in the corner. It also means a half-typed rename survives.

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

A shadow column was tried here and taken out again: three toggles in a 24px
row is more than the list can carry, and a rig is read by scanning names.
Casting is a property of a light, so it belongs in the properties panel — see
below for where it sits there.

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

The panel reads in three bands: what the light emits, then what it casts, then
where it is. **`position` and `target` are folded away under `transform`, at
the bottom**, because a light gets dragged with the gizmo far more often than
it gets typed — those numbers are for reading an exact value or nudging one,
not for aiming, so they sit below everything you actually reach for.

**`shadows` sits above the shadow folder, not inside it.** Whether a light
casts is the one shadow field worth reading at a glance, and a collapsed
folder hides it. Putting the state in the folder's own title is not an option:
leva takes a folder's title from its key and gives it no `label`, so saying
"shadow (enabled)" would mean renaming the key — which is a different folder
path, rebuilt collapsed, so the group would snap shut every time you ticked
the box inside it. Everything left in the folder is tuning you open on
purpose.

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
- **A folder keeps the settings it was first created with**, `order` included,
  and a folder's order is the order of the first field inside it. So those
  numbers are banded by group rather than counted off from the start of the
  list: a point light has four fields before its `transform` and a spot has
  six, and an order that counted would leave the folder wherever the last type
  you looked at had put it. Plain inputs do not have this problem — their
  settings are rewritten on every schema build.
- **`useControls` takes its settings before its deps**, not after. Called
  without a folder name it reads argument two as either the deps array or the
  settings, and a settings object in argument three is dropped silently. The
  symptom is a panel that works but registers into leva's global store, so
  leva's own floating panel appears on top of this one.

## Getting it back into the file

A bar under the panels. **Save** writes the file when there is a Vite plugin to
do it; **Copy JSON** is always there for when there is not.

The bar reads **Edited** whenever the rig has drifted from the file, and stops
saying so once you save or copy. Losing that word is the confirmation; the
button also flashes for a couple of seconds.

**Reset** sits next to it, and only while there is something to discard. A
reset button that is always there is a standing invitation to throw the session
away; one that arrives alongside the edits it would undo is a way out of them.
It does not ask first, because it pushes a history entry like any other change
— `Cmd+Z` brings the whole rig straight back.

Copying counts as **saving**, and that is a real decision rather than an
oversight. The paste that follows comes back in through the `setup` prop, and
the editor refuses an incoming setup while there are unsaved edits — so
staying dirty would make it reject the very file you just wrote. The cost is
that a copy you never paste leaves the editor willing to take a new setup over
the top of your edits.

**The output is shaped for a file that gets committed and read in diffs.**

- **`serializeSetup` writes only what was authored.** Anything still at its
  default is left out, so defaults stay free to change and the file stays
  about your rig rather than about the schema.
- **Short number arrays stay on one line.** `[4, 6, 3]` is one value — a
  position — and `JSON.stringify(x, null, 2)` spreads it over five. That would
  turn nudging a light into a three-line diff and roughly triple the length of
  the rig, so `exportSetup` prints it itself. Positions, targets, colours and
  shadow frusta are all short number arrays, so the one rule covers the schema.
- **Numbers in those arrays round to three decimals**, a millimetre at scene
  scale. A dragged gizmo hands the store `-6.654158442397424`, and seventeen
  digits per axis is unreadable in a file you review by hand. Scalars are left
  alone: an intensity of `0.0001` is a real value that the same rounding would
  flatten to zero.
- **Two spaces and a trailing newline**, which is where an editor or a
  formatter would land anyway.

Pasting over a hand-written file changes two things once, and then never
again: a two-line `meta` block appears, and each light's keys are reordered
into the order `LIGHT_DEFINITIONS` declares them.

The clipboard write falls back to the old select-and-`execCommand` trick.
`navigator.clipboard` exists only in a secure context, and a dev server reached
from another machine on the network is plain http — which is exactly the setup
you are in when you are tuning a scene on a phone. If both fail the button says
_See console_, and the JSON is logged there rather than lost.

## The Vite plugin

```ts
// vite.config.ts
import { lightStudio } from 'r3f-light-studio/vite'

export default defineConfig({
  plugins: [react(), lightStudio('src/lights.json')],
})
```

That is it. `Cmd+S` — or `Ctrl+S` — now writes the file, and the **Save**
button appears in the bar. Several rigs get an object, and each component names
the key it belongs to:

```ts
plugins: [lightStudio({ hero: 'src/hero.json', product: 'src/product.json' })]
```

```tsx
<LightStudio id="hero" setup={hero} debug />
```

A bare string is sugar for one target under the id a component gets when it
names none, so the single-rig case needs nothing on the component. An `id`
nobody declared gets **no Save button and a console warning** — you configured
the plugin, so a button silently missing would be the wrong answer.

**The browser never sends a path.** It sends one of the ids from your config
and the server looks the path up, so there is nothing a page can say to this
that talks it into writing somewhere it was not told about. That is worth more
than it looks: a dev server is often listening on the network and not only on
localhost. The plugin is `apply: 'serve'`, so none of it survives a build.

**Saving does not cost you your session.** The write goes to disk, Vite notices
the JSON change and pushes it back through the import, and the editor sees a
new `setup` a moment after the one it already had. Reloading on that would
clear the selection, the solo and the whole undo stack on every save. So the
incoming rig is compared — as the text that _would_ be written, since a round
trip through the file is not identity-preserving — against what was last
saved, and an exact match is recognised as the editor's own echo and ignored.
Edit the file in your editor instead and it differs, so it still loads.

Three details worth knowing:

- **It is a `fetch` to dev-server middleware, not Vite's HMR channel.** The HMR
  channel would have been tidier and does not survive publication: an installed
  package is pre-bundled out of `node_modules` and Vite gives that code no HMR
  context, so `import.meta.hot` would be undefined for exactly the people who
  install this. It works in a workspace only because the link resolves to
  source.
- **A dev server without the plugin answers `/__light-studio/targets` with
  `200 text/html`** — the SPA fallback. A status check alone would conclude the
  plugin was there, so the reply has to carry a marker before it is believed.
- **The plugin file is the one place in the package that names a `.ts`
  extension on an import.** Every other file is resolved by Vite; this one is
  loaded by Node while it reads your config, and Node will not guess at a
  missing extension.

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
