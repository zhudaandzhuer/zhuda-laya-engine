# Procedural assets

Build surfaces, props and sound effects from data instead of files. Everything
here is deterministic: the same recipe and seed give the same bytes in Node, a
Worker and a browser, so a result can be fingerprinted and compared.

The engine owns the mechanisms below. Which recipes and props a game uses, and
what a surface tag means, stay in the consumer repository. A few neutral
samples ship in `zhuda-laya-engine/demo` (`ZHUDA_STARTER_TEXTURES`,
`ZHUDA_STARTER_PROPS`, `ZHUDA_STARTER_SOUNDS`).

```ts
import {
  bakeZhudaTextureSet,
  createZhudaProceduralMaterial,
  ZhudaPropRegistry,
  mergeZhudaPlacedProps,
  instantiateZhudaPropBatches,
  type ZhudaProceduralMaterial,
} from 'zhuda-laya-engine';
import { ZHUDA_STARTER_TEXTURES, ZHUDA_STARTER_PROPS } from 'zhuda-laya-engine/demo';

const props = new ZhudaPropRegistry();
for (const definition of ZHUDA_STARTER_PROPS) props.register(definition);

const placed = [
  props.place('container20', { position: [0, 0, 0], seed: 1 }),
  props.place('container20', { position: [0, 0, 3], yawDeg: 180, seed: 2 }),
  props.place('pallet', { position: [5, 0, 1], yawDeg: 30 }),
];

const materials = new Map<string, ZhudaProceduralMaterial>();
const materialFor = (name: string) => {
  if (!materials.has(name))
    materials.set(
      name,
      createZhudaProceduralMaterial(bakeZhudaTextureSet(ZHUDA_STARTER_TEXTURES[name], { size: 512 })),
    );
  return materials.get(name)!.material;
};

// One mesh per material, however many props were placed.
const yard = instantiateZhudaPropBatches(mergeZhudaPlacedProps(placed), materialFor, scene);
const colliders = placed.flatMap((prop) => prop.colliders); // world-space boxes with a surface tag
```

Release what you create: `yard.dispose()` and each material's `dispose()`.

## Texture recipes

A `ZhudaTextureRecipe` is JSON: a base surface (`color` in linear RGB,
`roughness`, `metallic`) and up to 32 ordered layers. A layer is selected by a
mask and may change colour, roughness, metallic and relief (`heightMm`).
`tileMeters` is the real size of one tile, so texel density stays physical.

| Mask | Use |
| --- | --- |
| `fbm` | Soft variation, grime, wear. `frequency` 1..512, `octaves` 1..8 |
| `cells` | Cellular patterns. `mode`: `distance`, `edge` or `id` (one value per cell) |
| `stripes` | Ribs, corrugation, plank gaps. `profile`: `sine` or `square` |
| `bricks` | Offset bond; the mask is 1 on the mortar |
| `constant` | A flat amount |

Every mask repeats exactly over the tile, so baked maps wrap without a seam.
Frequencies and counts must be integers for that reason. `range: [lo, hi]`
remaps a mask with a smooth step; reverse the two values to invert it.
`within` multiplies a second mask in (for example rust only where grime is).

`bakeZhudaTextureSet(recipe, { size })` returns three RGBA8 maps in the
engine's existing texture contract:

- `albedo`: sRGB colour.
- `normal`: tangent space, derived from the relief. Default convention is
  `directx` (-Y), which is what Laya's native materials expect.
- `metallicGloss`: Laya packing, R = metallic and A = smoothness.

`fingerprintZhudaTextureSet(set)` gives a short stable hash for evidence.
`validateZhudaTextureRecipe(recipe)` lists every problem; the MCP tool
`validate_texture_recipe` exposes the same check to agents.

Baking runs on the CPU. Cost grows with `size` squared times the number of
layers; 256 or 512 is a reasonable runtime size, and larger maps are better
baked ahead of time (see the provider below).

`createZhudaProceduralMaterial(set, { tint })` uploads the maps with mipmaps
and returns a PBR material. With the default `uvUnit: 'meters'` the material
repeats every `tileMeters`, which matches the UVs from the geometry kit.
`tint` lets one baked set serve several paint colours.

## Geometry kit

Pure functions that return the engine's `MeshData`:
`createZhudaBoxMesh` (optional `bevel`, `origin: 'bottom'`),
`createZhudaTubeMesh`, `createZhudaRodMesh`, `createZhudaIBeamMesh`,
`transformZhudaMesh`, `mergeZhudaMeshes`, `computeZhudaMeshBounds`.

Units are metres and UVs are metres. Triangles follow the same front-face
winding as the terrain meshes. `mergeZhudaMeshes` splits its output at 65,535
vertices so each chunk fits one `ZhudaDynamicMesh`.

## Props

A `ZhudaPropDefinition` has an `id`, a nominal `size` in metres, `defaults`
and `build(params, random)`. `build` returns named parts (mesh plus logical
material name), box colliders with a `surface` tag, and optional sockets. The
origin of a prop is the middle of its underside.

`ZhudaPropRegistry` checks every build: unknown parameters, missing surface
tags and geometry that leaves the declared size are errors. The size check is
there to catch a prop authored at the wrong scale.

`place(id, { position, yawDeg, seed })` moves parts, sockets and colliders
into world space. Colliders stay axis-aligned: a box rotated to an oblique
angle is cut into up to ten slices along its long side. Feed the boxes to the
consumer's own collision or query code.

`mergeZhudaPlacedProps` groups all parts by material and merges each group.
Variation that changes the material name (a different paint) costs a batch;
use `tint` on a shared texture set when colour is the only difference.

## Sound recipes

`ZhudaSynthRecipe` layers `noise` (white, pink, brown) and `tone` (sine,
square, saw, triangle, optional glide) with an attack/hold/release envelope
and one-pole low-pass and high-pass filters. `renderZhudaSynth` returns mono
samples normalised to `peak`; `renderZhudaSynthWav` wraps them as 16-bit PCM.
Play the result through the existing sample path. Do not open another
`AudioContext`.

## Generated assets behind the provider

`ProceduralAssetProvider` implements `AssetProvider`. Register a generator per
logical ID and pass a `fallback` provider for everything else:

```ts
const assets = new ProceduralAssetProvider({ fallback: new DirectoryAssetProvider({ baseUrl: 'assets/' }) });
assets.register('audio/impact.wav', () => renderZhudaSynthWav(ZHUDA_STARTER_SOUNDS['impact-metal']), 'audio');
```

Scene code keeps loading `audio/impact.wav`. Replacing the generator with a
file later needs no change outside this registration.

## Module boot contract

`bootZhudaModules(context, modules, { show })` creates modules in order and
stores each on the context. A module may provide a `showcase` (an isolated
scene that proves it alone) and a `stub` (used when `create` throws, so one
failing system does not hide the others). `parseZhudaRunParams` reads `seed`,
`show`, `dt`, `shot` and `bench` from the URL so a capture can be repeated.

## Seeds

`createZhudaRandom(seed)` is the random source. `fork(label)` gives an
independent stream that depends only on the parent seed and the label, so
adding draws elsewhere never reshuffles existing content.

## Verification scope

Covered by `tests/procedural-assets.test.mjs` and
`tests/procedural-starter.test.mjs` in Node: determinism, exact tiling of
every mask, the normal direction and channel packing, mesh winding and
bounds, prop validation and placement, collider slicing, merging, WAV
structure, provider limits and cancellation, and the boot contract. The
renderer hand-off is tested against a stand-in for the Laya classes.

Not yet verified: a real WebGL or WebGPU draw of a baked material or a merged
prop batch, the look of any starter recipe, mip and tiling behaviour on a
device, and performance of runtime baking on mobile hardware. Treat those as
open until a browser run records them.

## Limits

- Baking is CPU only; there is no GPU baking path.
- Masks are the five types above; there is no node graph, scratch or decal
  layer yet.
- Geometry has no lathe, extrusion or UV unwrapping beyond per-face metres.
- Props carry box colliders only.
