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
top bar. The canvas automatically fits the available CSS viewport while
retaining design coordinates. Use `Agent View` (or open `/?view=agent`) to
hide the side panels and fit the complete Prefab into one screenshot for visual
review. The selected-node outline is computed from the node's size, scale and
anchor/pivot, so a centered image is outlined around its real bounds instead of
from its `x/y` origin. The yellow cross marks that node's anchor/pivot and the
Inspector repeats `Size`, `Anchor` (normalized 0–1) and `Pivot` (design pixels).

The lower **Assets** workspace reads the same consumer `assets/` directory. Its
left side is a folder tree; its right side shows file cards with type, size and
SHA-256-backed metadata. Selecting a `.lh` Prefab or `.ls` Scene opens that
definition in the same editor URL (`?prefab=...`), so the hierarchy, Inspector
and preview always refer to the selected source. Other files remain available
as inspectable project assets and are served through the existing safe
`/__project/` route. The engine never copies those assets into its repository.

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
