# Zhuda Web Static Asset Editor

`zhuda-prefab-editor` is the engine-provided local editor for a consumer's
2D `.lh` Prefab or `.ls` Scene. It uses the same public `ZhudaPrefab` hydrator
as an isolated preview and the runtime, so an artist can adjust the source that
the game will actually instantiate.

## Start it

Run this from the consumer project:

```sh
npx zhuda-prefab-editor \
  --project /absolute/path/to/game \
  --prefab assets/prefabs/rocket.lh \
  --host 127.0.0.1 \
  --port 8891
```

To edit a Scene, pass its `.ls` path instead:

```sh
npx zhuda-prefab-editor \
  --project /absolute/path/to/game \
  --prefab assets/scenes/slot-machine.ls \
  --host 127.0.0.1 \
  --port 8891
```

Open `http://127.0.0.1:8891/`. The page loads the pinned LayaAir 3.4.2
libraries from the engine, boots a real WebGL canvas at the asset's authored
`designCanvas` size, and displays the selected `.lh` or `.ls` hierarchy. The left panel selects named nodes, the right panel edits
common 2D properties, and dragging a node changes its design/CSS-pixel
position. `Ctrl/Cmd-S` saves; `Undo`, `Redo` and `Reload` are available in the
top bar. The toolbar wraps to the actual available editor width. Narrow Editor
views stack the preview above vertically scrollable hierarchy, Inspector and
Assets panels. Agent View uses the full remaining area below the toolbar.
The canvas fits its preview panel while retaining design coordinates; resizing
an embedded pane or changing toolbar/help height also recomputes the fit. Use `Agent View` (or open `/?view=agent`) to
hide the side panels and fit the complete Prefab into one screenshot for visual
review. The selected-node outline follows the node's local rectangle through every
ancestor's translation, scale, rotation and pivot, including mirrored parents.
The editor fits the container while the runtime owns Retina backing pixels;
canvas artwork and DOM overlays share the actual displayed canvas rectangle. The yellow cross marks that node's anchor/pivot and the
Inspector repeats `Size`, `Anchor` (normalized 0–1) and `Pivot` (design pixels).
Dragging converts the cursor into the selected node's parent coordinates, so a
nested object stays attached to the grabbed point. Pointer cancellation, lost
capture or focus loss restores the position from before the gesture; other
pointers do not take over an active drag.

The lower **Assets** workspace reads the same consumer `assets/` directory. Its
left side is a folder tree; its right side shows file cards with type, size and
SHA-256-backed metadata. Selecting a `.lh` Prefab or `.ls` Scene opens that
definition in the same editor URL (`?prefab=...`), so the hierarchy, Inspector
and preview always refer to the selected source. Other files remain available
as inspectable project assets and are served through the existing safe
`/__project/` route. The engine never copies those assets into its repository.

## Interactive Play preview

**Agent View** controls the layout. **Play / Stop** controls interaction in both
Agent and Editor View. Play creates a disposable instance from your current edit
snapshot, hides the selection/pivot overlays and disables Inspector edits,
editing drag, Save, Reload and Undo/Redo. Clicks and drags then reach the consumer
controller. Stop (or Escape) disposes the controller and restores your existing
unsaved edits and history. Runtime changes made during Play are never serialized
back into the authored Prefab.

To enable Play, put a consumer-owned `zhuda.editor.ts`, `zhuda.editor.mjs` or
`zhuda.editor.js` at the selected project root. Alternatively pass an explicit
project-relative module:

```sh
npx zhuda-prefab-editor --project /absolute/game \
  --prefab assets/prefabs/panel.lh \
  --preview-controller src/editor-preview.ts
```

Export `mount(context)` from that module:

```ts
import type { ZhudaPrefabEditorPreviewContext } from 'zhuda-laya-engine';

export function mount(ctx: ZhudaPrefabEditorPreviewContext) {
  const button = ctx.find('Button');
  const label = ctx.find<Laya.Text>('Label');
  ctx.root.mouseEnabled = true;
  button.mouseEnabled = true;
  ctx.listen(button, 'click', () => { label.text = 'Clicked'; });
}
```

The context exposes the live `root`, `stage`, `canvas`, existing managed
`runtime`, source `assetPath`, `signal`, named `find`, logical `assetUrl`, scoped
`listen` and `onDispose`. A mount may return a `{ dispose() }` controller or a
Promise of one. Register every resource with `onDispose` immediately, before
awaiting work; honor `signal`. Stop, mount failure, the 15-second mount deadline,
page hide and late asynchronous completion all retire owned resources. Page
restoration returns to Edit. Restart the editor after changing controller code.

The controller and editor import the same public SDK module and use one engine
session; a controller must not call `ZhudaEngine.boot` or import engine internals.
Use the existing `IframeSoundAdapter` for audio, with one mixer/playback authority
and explicit disposal. The module is trusted consumer project code; its resources
and external side effects belong to that consumer. Keep startup side effects
inside `mount`, and do not save source files from a preview controller.

Play stays disabled when no controller is configured. The engine supplies the
interaction host; the consumer supplies the behavior for each supported asset.
It does not automatically launch the game's Main, wallet/RGS or other scenes.
The sound-panel adapter of a game, for example, belongs in that game project,
with its sound assets and rules outside this engine repository.

## Save and safety behavior

The server exposes only the selected project-relative Prefab and project assets
needed for the preview. It rejects traversal, symlink escapes, malformed JSON,
unsupported static node types, duplicate child names, non-finite values and
stale `baseRevision` writes. A save is validated, written to a temporary file,
synced, and atomically renamed. The previous valid bytes are retained at
`<prefab>.bak`. A failed save leaves the source untouched.

The source file keeps logical `skin` and `textureId` values. The editor maps
those IDs to local preview URLs only in an in-memory clone, so browser URLs are
never written into the consumer Prefab. The preview uses design coordinates;
the canvas backing resolution may scale with DPR without changing the saved
layout values.

The editor uses the minimal `core + 2d + ui` runtime profile and loads only
`laya.core.js`, `laya.webgl_2D.js` and `laya.ui.js`. It must run in its own page
or an iframe. If a page already initialized another Laya runtime, boot fails
with `ZHUDA_FOREIGN_LAYA_REALM` and points to `ZhudaRuntimeHost`; a second
renderer is never silently attached to the existing stage.

## Supported scope

The editor currently edits generic 2D `Sprite`, `Text`, `Label`, `Image`,
`Box` and `Scene` hierarchies in both `.lh` and `.ls` files. For a real 3D asset
workspace use [`zhuda-model-editor`](model-editor.md): it accepts self-contained
`.glb`/`.gltf`, uses the public model library and shows the live Sprite3D
hierarchy, importer inventory, materials, animation and Raw/Gameplay/Cinematic
presentation modes. It intentionally does not write arbitrary 3D transforms
back to a DCC scene; model authoring remains in the consumer/DCC pipeline.

The 2D editor does not claim to edit Spine timelines or particle graphs. Those
assets continue to use their isolated preview and evidence workflow.

After saving, run the consumer's normal `zhuda-prefab-check` and Scene evidence
checks. The editor is a development tool and does not replace those gates.


## Browser coordinate regression

From the engine checkout, run:

```sh
EDITOR_EVIDENCE_DIR=/tmp/zhuda-prefab-editor npm run verify:prefab-editor
```

The test launches disposable Chrome profiles and a temporary project containing
neutral image Prefabs and Scenes. It compares actual screenshot pixel bounds,
all four selection corners and the pivot against independently composed source
transforms. It checks DPR 1 / 1.5 / 2, resize, Editor / Agent View, actual desktop
page zoom at 80% / 125% / 150%, translated/rotated/scaled/reflected parents,
cursor tracking throughout dragging, undo/redo, backup/save/reload and cancelled
or competing pointers. The same command runs in CI and uploads its JSON report
and screenshots. Loading successfully or having no runtime exceptions does not
satisfy these position assertions. Physical devices and other browser engines
still require separate acceptance.


Run `npm run verify:prefab-editor-play` for the independent Play regression. It
checks real native clicks and drags at DPR 1 / 1.5 / 2, Agent View/resize, edit
isolation, history restoration, 30 start/stop cycles, page hide/restore, failing
and timed-out mounts, and non-cooperative late completion. Unit tests also check
scoped listener cleanup and the strict public consumer controller types.


Run `npm run verify:prefab-editor-responsive` for the full editor layout gate.
It checks that toolbar actions are visible and reachable, panels remain
accessible without horizontal overflow, and actual image pixels at all four
canvas corners remain visible. Coverage includes widths 320–1440, a 240px-high
window, DPR 1 / 1.5 / 2, actual Chrome zoom 125% / 150% / 200%, host/container
width changes without an outer window resize, dynamic toolbar height and native
Play clicks after fitting. This checks the surrounding editor UI as well as
the canvas; canvas coordinate tests alone do not prove toolbar visibility.
