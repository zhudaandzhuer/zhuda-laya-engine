# Route: a model from Blender or another DCC tool into a game or a film

A glTF 2.0 model exported from Blender (or any DCC tool), inspected before it is
mounted, made lighter where it is drawn many times or far away, checked alone and
then in the scene. It keeps a valid boot from being mistaken for a correct asset.
Importer and draws checked on a desktop with both backends.

- **Id:** `model-from-dcc`
- **Kind:** workflow
- **For:** Bringing a modelled character, prop, building or tree into the engine: export settings, inspection, skins and animation clips, levels of detail, and the checks before it is mounted.
- **Checked on:** desktop WebGL; desktop WebGPU; no phone
- **Status:** the importer, the inspector, instancing, levels and skins are drawn by
  `npm run verify:model-showcase`, `verify:gltf-intake`, `verify:gltf-instancing`,
  `verify:prefab-models` and `verify:film-model` on an Apple M4. An outside review's
  phone-budget characters (skins of 36 and 40 joints among them) load and play every
  clip on both backends on the same machine; no phone.
- **Reference consumer:** the outside review's models (`VerifyZhuda`,
  `deliverables/beasts-hd`, `bosses-hd`, `props-hd`, outside this repository).
- **Engine version:** 1.18.0 (this checkout).

## When to take this route

For every authored model. For geometry made by a program (props from parameters,
boxes, lathes, terrain) take [film-as-data](film-as-data.md) or
[procedural assets](../procedural-assets.md) instead. For a 2D character take
[spine-character](spine-character.md). A VRM 1.0 avatar (`.vrm`) is a model from
a DCC tool too: load it this way, then give it to `ZhudaVrm` ([VRM](../vrm.md)).

## Tools

- Blender 4.x or 5.x with its glTF exporter; the Khronos glTF Validator.
- `inspectGltfAsset` (public SDK); MCP `get_model_capabilities`.
- `zhuda-laya-lod` (lighter versions, splitting a large mesh), `zhuda-laya-crown`
  (shade inside a tree's crown): [model levels](../model-lod.md).
- The model inspector page (`examples/model-inspector`, Browser SDK profile
  `3d-gltf`).

## Steps

1. **Export glTF 2.0 or GLB**: Y up, metres, rotation and scale applied, the
   intended origin, embedded buffers and images. Record the exporter's axis, unit
   and scale beside the asset's SHA
   ([model pipeline](../model-pipeline.md#coordinate-and-unit-contract)).
2. **Inspect before mounting**: `inspectGltfAsset(bytes)`; fix anything
   `unsupported`; read `inventory.summary` (meshes, primitives, triangles,
   materials, textures, animations). Run the Khronos Validator.
3. **Check what the importer supports** in the
   [compatibility matrix](../model-showcase.md#explicit-compatibility-matrix):
   extensions, quantization, WebP/AVIF/KTX 2 textures, lights, second texture
   coordinates.
4. **Skins.** Any joint count loads; over 24 joints a skin is drawn in several
   pieces, and the engine orders its triangles at load so the pieces are few. No
   tool has to be run on the asset.
5. **Make it lighter where it is many or far**: `zhuda-laya-lod model.glb --ratio
0.4,0.15`; levels in a model prefab or `lod` on `mountZhudaModel`; `cullMeters`,
   `castShadow: false` and `cellMeters` on a film scene's model node; `placements`
   for copies.
6. **Draw it alone** (model prefab or the inspector) at DPR 1, 2 and 3 on WebGL and
   WebGPU; then raw, gameplay and cinematic presentation with the same instance.
7. **Mount it in the scene** and repeat the camera, lights, shadows, transparency
   and animation checks there. In a film scene: a `model` node with `animation`
   and `motion` ([film scenes](../film-scenes.md#characters-clips-movement-and-lights-that-follow)).
8. **Baked light** for static models: a lightmap through the second UV set
   ([film scenes](../film-scenes.md#models-and-baked-global-illumination)).

## Pitfalls

- **Rotating the root again** in the game after the exporter converted the axes: an
  upright character lies on its side.
- **`COLOR_0` is read as glTF says, linear.** A model with shade baked into vertex
  colours as display values draws brighter than in older engine versions.
- **Many tiny meshes.** 105 small meshes cost more to parse and upload than one of
  the same triangle count; join where nothing has to be selected alone.
- **External buffers and images** are rejected in provider mode: pack them into the
  GLB.
- **`supported` is not visual approval**: it says the importer's gates passed.
- **A pose is not evaluated the moment a clip is played**: for an exact pose use
  `ZhudaModelAnimationSampler` ([cinematics](../cinematics.md#exact-model-poses)).

## Engine gaps and their workarounds

- A skin of more than 24 joints is not one draw (no bone texture): the load-time
  ordering keeps the pieces few (a boss of 40 joints: 47 draws to 7).
- `zhuda-laya-lod` does not write KTX 2: use `gltf-transform` for it
  ([KTX 2 textures](../basis-textures.md)).
- The engine never merges meshes by itself (names, sockets, materials and animation
  ownership would change): join them in the DCC tool.

## Checks

`npm run verify:model-showcase`, `verify:gltf-intake`, `verify:gltf-instancing`,
`verify:prefab-models`, `verify:film-model`, `verify:film-animation`,
`verify:film-model-distance`, `verify:vrm` (a VRM 1.0 avatar, WebGL); on WebGPU
through `npm run verify:film-webgpu`.

## Not checked

No phone frame rate for any model. Seller assets, a large corpus of complex
materials, Windows hardware and parity with another engine are separate acceptance
work ([3D acceptance](../3d-acceptance.md)).

## Boundaries

The source file, its materials, the authored scene and the approved pictures belong
to the consumer. No game model is copied into the engine repository to make a check
pass.
