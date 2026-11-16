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
      createZhudaProceduralMaterial(
        bakeZhudaTextureSet(ZHUDA_STARTER_TEXTURES[name], { size: 512 }),
      ),
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

| Mask       | Use                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fbm`      | Soft variation, grime, wear. `frequency` 1..512, `octaves` 1..8                                                                                                                       |
| `cells`    | Cellular patterns. `mode`: `distance`, `edge` or `id` (one value per cell)                                                                                                            |
| `stripes`  | Ribs, corrugation, plank gaps. `profile`: `sine` or `square`                                                                                                                          |
| `bricks`   | Offset bond. `mode`: `mortar` (1 on the joints, default), `id` (one value per brick, for slab-to-slab tone and tilt) or `edge` (0 at the joint rising to 1 mid-brick, for worn edges) |
| `constant` | A flat amount                                                                                                                                                                         |

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

A tiled surface many tiles wide shows them as a grid, since every tile is the
same. `createZhudaProceduralMaterial(set, { variation: { amount: 0.5, meters: 27 } })`
lays slow changes of brightness over it (`bakeZhudaVariation`, the material's
detail map): `meters` is the size of one repeat of that picture, many tiles
and not a multiple of one. The picture repeats too, so keep `meters` large:
its own pattern shows when a view holds many repeats of it.

Baking runs on the CPU. Cost grows with `size` squared times the number of
layers; 256 or 512 is a reasonable runtime size, and larger maps are better
baked ahead of time (see the provider below).

`createZhudaProceduralMaterial(set, { tint })` uploads the maps with mipmaps
and returns a PBR material. With the default `uvUnit: 'meters'` the material
repeats every `tileMeters`, which matches the UVs from the geometry kit.
`tint` lets one baked set serve several paint colours.

### A material from one picture

`deriveZhudaPhotoMaterial(rgba, width, height, options)` turns one colour
picture of a flat surface (a photograph, or a generated picture) into the
same kind of set a recipe bakes: colour, normal, metallic-gloss and height.

```ts
const set = deriveZhudaPhotoMaterial(pixels, 1254, 1254, {
  id: 'flagstone',
  tileMeters: [3.2, 3.2],
  size: 1024,
  reliefMm: 14, // depth between the lowest and the highest point
  roughness: [0.55, 0.95], // raised and worn, low and dirty
});
```

It blends a band at each edge so the picture wraps (`seam`), evens out broad
lighting differences (`flatten`), takes relief from the fine light-and-dark
detail (`detail` sets how fine), builds the normal map from that relief and
makes low places rougher. The relief is a guess from brightness: joints,
pits and grain come out right; a dark stain or painted mark is read as a
dent. Use pictures taken or generated with flat light and no shadows, looking
straight at the surface. It is pure and deterministic, like baking a recipe.

## Geometry kit

Pure functions that return the engine's `MeshData`:
`createZhudaBoxMesh` (optional `bevel`, `origin: 'bottom'`),
`createZhudaTubeMesh`, `createZhudaRodMesh`, `createZhudaIBeamMesh`,
`transformZhudaMesh`, `mergeZhudaMeshes`, `computeZhudaMeshBounds`.

Units are metres and UVs are metres. Baked materials are normal-mapped and
need a tangent frame: `instantiateZhudaPropBatches` adds tangents itself; for
your own `MeshData` pass `tangents: computeMeshTangents(data)` before creating a
`ZhudaDynamicMesh`, otherwise the relief does not show. Triangles follow the same front-face
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
const assets = new ProceduralAssetProvider({
  fallback: new DirectoryAssetProvider({ baseUrl: 'assets/' }),
});
assets.register(
  'audio/impact.wav',
  () => renderZhudaSynthWav(ZHUDA_STARTER_SOUNDS['impact-metal']),
  'audio',
);
```

Scene code keeps loading `audio/impact.wav`. Replacing the generator with a
file later needs no change outside this registration.

## Module boot contract

`bootZhudaModules(context, modules, { show })` creates modules in order and
stores each on the context. A module may provide a `stub` (used when `create`
throws, so one failing system does not hide the others) and a `showcase` that
proves it alone. `parseZhudaRunParams` reads `seed`, `show`, `dt`, `shot` and
`bench` from the URL so a run can be repeated.

The contract reuses the engine instead of adding a second path:

| Parameter | Engine piece                                                                                                                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `?dt=`    | `createZhudaRunClock(params)` returns the engine's `ZhudaSimulationClock` with that step. Advance it from the runtime session, the only wall-clock source: `context.runtime.start((dt) => clock.advance(dt, step))`.                               |
| `?show=`  | A showcase is a function or a Prefab: `showcase: { prefab: 'yard/container', state: 'rusty' }`. Pass the scene's `ZhudaPrefabLibrary` as `prefabs` (and a `parent`), and the Prefab is instantiated alone from the same definition the scene uses. |
| `?shot=1` | Render the still through `ZhudaCinematicCapture` or `ZhudaFilmRenderer`.                                                                                                                                                                           |
| `?seed=`  | `createZhudaRandom(seed)`, below.                                                                                                                                                                                                                  |

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

Real WebGL draw (desktop Chrome, Apple M4 / ANGLE Metal, 2026-11-10): a
starter yard (7 props merged into 4 batches plus ground) renders without
errors; 512 maps upload with 10 mip levels. A flat normal-mapped panel and real
geometry with the same relief correlate at 0.986 (U / red) and 0.998
(V / green) under the same light, so the `directx` packing is decoded with the
right signs; without the normal map the panel is flat. This run found and fixed
missing tangents on prop batches.

Not yet verified: WebGPU, mobile devices, runtime baking cost on mobile
hardware, and the art quality of the starter recipes (they are samples).

## Limits

- Baking is CPU only; there is no GPU baking path.
- Masks are the five types above; there is no node graph, scratch or decal
  layer yet.
- Geometry has no UV unwrapping beyond per-face metres.
- Props carry box colliders only.

## Round and raised shapes

Two more builders in the geometry kit, pure data like the others:

- `createZhudaLatheMesh({ profile, segments })` turns an outline of
  `[radius, height]` pairs about the vertical axis. List the outline from the
  bottom up along the outside; a hollow form goes on down the inside. Corners
  sharper than `creaseDeg` (30) stay edges, the rest is smooth.
- `createZhudaExtrudeMesh({ outline, height })` raises a flat outline of
  `[x, z]` pairs. The outline may be concave; it must not cross itself.

Film scenes use them as `lathe` and `extrude` nodes.

## Holes, bevels, curves, tori and rings

- `createZhudaExtrudeMesh` takes `holes` (up to 32 outlines inside the
  outline, clear of its edges and of each other: windows, doorways, the inside
  of a letter) and `bevel` in metres with `bevelSegments` (1 cuts the edge
  off flat, 2..8 round it) and `bevelBottom`. The footprint stays the outline;
  the top is drawn in by the bevel and the holes widened by it.
  `validateZhudaExtrude` refuses a hole outside the outline or touching it or
  another hole (naming the hole), and a bevel so wide that the top would
  turn inside out or cross itself.
- `sampleZhudaCurve({ points, closed, kind }, count)` gives points evenly
  spaced along a Catmull-Rom curve through `points` (`'centripetal'` by
  default, `'chordal'` or `'uniform'`), for `createZhudaSweepMesh` or
  `createZhudaTubeMesh`. `sampleZhudaCurvePath(path, count)` does the same
  for a LayaAir `CurvePath` (Catmull-Rom, Bezier or straight runs) built in
  a game. LayaAir itself walks a spline by its control points, not by
  length; the path is read finely and the points spaced along what was
  read.
- `createZhudaCurveTubeMesh({ points, radius, closed })` is a round tube
  along such a curve, rings evenly spaced, turned as little as possible from
  one ring to the next; a closed tube's twist is spread over its length so
  its seam meets. A radius wider than the tightest bend is not checked.
- `createZhudaTorusMesh({ radius, tube })` lies flat about +Y.
- `createZhudaRingMesh({ outerRadius, innerRadius })` is a flat ring (or a
  disc) facing +Y; with `thickness` it is a closed washer or coin.

Closed shapes are watertight with outward normals (`tests/geometry-shapes.test.mjs`);
`npm run verify:geometry` draws them on WebGL and WebGPU. Arcs (a part of a
torus or ring) are not built.


## Shapes as distances, and a hand

`Isosurface.ts` builds soft bodies from signed distances, pure data like the
rest of the kit:

- `createZhudaSdfField(shapes)` takes a list of `roundCone` (a cone between
  two balls) and `ellipsoid` shapes, in order. Each may join what came before
  it with a fillet `blend` metres wide (a smooth minimum), be cut out of it
  (`subtract`), or be squeezed along one direction (`flatten`). A shape whose
  box is farther than the fillet is skipped, so a long list stays fast.
- `joinZhudaSdfFields(trunk, limbs)` joins each limb to the trunk with its
  own fillet and the limbs to each other with none: fingers touch without
  growing together.
- `createZhudaIsosurfaceMesh({ distance, min, max, cellSize })` meshes the
  surface by surface nets: one vertex a cell, moved onto the surface along
  the field's slope (`project`, three steps), normals from the field, a
  quad across every cut edge of the grid. A closed body inside the box gives
  a closed mesh wound the engine's way; a surface that reaches the box's
  side is refused. Past 65535 vertices the indices are 32-bit, and
  `splitZhudaMesh(mesh)` cuts it into chunks a `ZhudaDynamicMesh` takes.
  A sheet thinner than about three cells can pinch where both of its faces
  cross one cell.
- `removeFloating: true` keeps only the body connected (through the six
  neighbours of each grid point) to the box's floor, the body that comes
  within a cell of `min`'s height: loose specks of rock become empty before
  meshing, so nothing floats. `{ anchor: 'largest' }` keeps the largest
  body, `{ anchor: [x, y, z] }` the body at that point. Nothing on the floor,
  or an anchor point outside every body, is refused with a message.
- `volume` meshes values computed before instead of sampling `distance`
  (which, when given, still moves the vertices onto the surface and gives
  their normals; without it the volume is interpolated). The grid is
  `zhudaIsosurfaceGrid(min, max, cellSize)`: the box padded by two cells.
- `computeZhudaDensityVolume({ name, glsl, density, min, max, cellSize },
{ signal, timeoutMs })` fills that grid on the GPU where there is compute
  (`ZhudaComputePass`, WebGPU): `glsl` defines `float zhudaDensity(vec3 p)`,
  `density` is the same field in JavaScript, run instead on WebGL in slices
  of the grid (a turn for the browser between them, so a cancel or the time
  limit stops it part way) and used to check a GPU result at 64 points
  before it is accepted: a shader that did not compile, or that computes
  another field, fails the load instead of making rock. Read back once;
  cancelled, timed out or failed, the pass is released and nothing is
  returned. A rock field of 4.9 million points took about 0.3 s on WebGPU
  and 1.5 s in JavaScript on a desktop (record
  `docs/plans/records/isosurface-density/`); meshing stays on the CPU.
- `ZhudaDistanceBricks.build({ distance | volume, min, max, cellSize, band })`
  keeps the distance to the surface near it, for a camera or a character:
  bricks of 4 × 4 × 4 samples as signed bytes (`band / 127` a step) where
  the surface is within `band` (default four cells), only inside or outside
  for every other brick. `distance(x, y, z)` (trilinear; `±band` beyond the
  band; `band` outside the region), `normal`, `raycast(origin, direction,
  max)` and `sweepSphere(from, to, radius)` answer from it, and
  `queryProvider(id)` hands the same to `ZhudaSceneQueries`, so
  `resolveCameraBoom` stops short of the rock. The engine answers; sliding,
  stopping or taking damage is the game's rule. A field of distances must be
  exact outside, or at least never more than the true distance (a union of
  shapes is; `max(a, -b)` says less inside the cut). A sphere of radius 2 m
  in an 8 m box at 0.1 m, band 0.5 m: 2 796 of 19 683 bricks kept, 258 KB
  against 2.2 MB for the same samples as floats, built in about 9 ms on a
  desktop (record `docs/plans/records/distance-bricks/`).
- `createZhudaSdfUnion(shapes, { reach, cell })` is a plain union of many
  small shapes (creases, rivets) found through a grid: exact within `reach`
  of a shape, `reach` farther away (never more than the true distance). Use
  it for details cut into, or joined onto, a surface that is already there.
- `keep: { normal, offset }` keeps only the part of a shape where
  `dot(p, normal) <= offset`: a pad set deep in a body, so its face curves
  gently, without its far side standing out of the other side.
- The broad phase skips a shape only for a point outside its box. (Until
  2026-11-15 it also skipped a shape for a point inside its box whenever the
  body there was already inside, so overlapping pieces joined without a
  fillet lost the deeper one near the surface and left a pit.) A squeezed
  shape is squeezed about its own middle: a round cone's axis, an
  ellipsoid's centre.
- Each shape's distance is held at least at the distance to its box, so the
  broad phase that skips by the box never changes the field (an ellipsoid's
  distance is an estimate, and without this a surface got a step where the
  skipping started).

`createZhudaHandMesh(options)` makes a human hand from numbers on top of it:
the bones of the palm and the fingers with an adult's proportions (hand
length 0.185 m, breadth 0.082 m, scaled by `length` and `breadth`), a pose
as joint angles (`ZHUDA_HAND_RELAXED`, `ZHUDA_HAND_FLAT`, or each finger's
three bends, `spread` and `thumbOut`), flesh round each bone with a pad on
the palm side, the ball of the thumb, the heel of the hand, the web between
thumb and index, knuckles and tendons on the back, five nails seated on the
skin, and creases cut into it: across the palm side of each finger joint
(two at the middle joint), where each finger leaves the palm, the thumb's,
the three long lines of the palm, the wrist's two, and faint wrinkles over
the backs of the middle joints. Each crease is a shallow groove (0.14 to
0.5 mm deep) that fades out at its ends and darkens the skin in its bottom.
`side: 'left'` is the mirror. `build` sets what makes one adult's hand
differ beyond its size: `fingerWidth`, `taper` (how much the fingers narrow
to the tip), `fingerLength` (the fingers' share of `length`, which is kept),
`bone` (the knuckles and the joints' waist), `tendons`, `flesh`, `flush`
(pink knuckles, tips and pads), `veins` (a blue tint along the veins of the
back), and the nails: `nailFree` (how far past the tip), `nailRound` (0
square, 0.5 round, 1 almond) and `nailTone`. Each nail sits a little into
the skin, with low folds of skin along its sides and over its root, and is
white only where there is no skin under it. Two presets: `ZHUDA_HAND_MALE`
(0.192 by 0.087, broad clean fingers, short square-round nails) and
`ZHUDA_HAND_FEMALE` (0.172 by 0.071, fair skin, long straight tapering
fingers, almond nails 5.8 mm past the tips, soft tendons, pink knuckles and
tips), and a pose `ZHUDA_HAND_GRACEFUL`. The fingers' pieces are joined
without a fillet where they run in a line: a smooth union bulges where two
cones meet, and the fingers looked beaded. It returns `skin` (chunks), `nails`, where
each joint and tip ended up, and a colour a vertex: the skin's tint (paler
palm, warmer joints and tips) as a display colour, and in alpha how thin the
hand is there, for a lit surface's `subsurface`:

```ts
const hand = createZhudaHandMesh({ pose: ZHUDA_HAND_RELAXED });
const skin = new ZhudaLitSurfaceMaterial({
  name: 'GameSkin',
  material: { roughness: 0.5 },
  subsurface: { color: [1, 0.3, 0.2], wrap: 0.45, back: 1.6, power: 3, distortion: 0.25 },
  surface: `void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
    s.baseColor *= s.vertexColor.rgb;
    s.thickness = s.vertexColor.a;
  }`,
});
for (const chunk of hand.skin) new ZhudaDynamicMesh(chunk, scene).node.meshRenderer.sharedMaterial = skin.material;
```

`createZhudaHandSurfaces({ name })` gives the two lit-surface specs to draw
it with: the skin reads the tint and the thinness the mesh carries, takes
light round and through it, has faint blotches of colour and a soft network
of fine creases that fades out where it would be smaller than a pixel, in
the hand's own space: `setZhudaHandSkinSpace(skin, node.transform.worldMatrix.elements)`
whenever the hand moves, turns or scales keeps it on the hand and a faint sheen where it turns from the
eye; the nail is glossy, light wraps round it and comes through it, so a
long nail seen edge on is pale rather than a dark blade. The skin is also darker in a fine line round each nail's
root and sides.

The female preset was set against photographs the owner gave on
2026-11-15 (fair hands with long fingers and long almond nails); it is
judged by eye against them, not measured.

Measured (`tests/hand.test.mjs`): a flat hand is 186 mm long and within
3 mm of 82 across the knuckles' level (the thumb left out); the fingers keep
an adult's order of length; the skin is about 92 000 vertices in two chunks
at the default cell (0.9 mm) and takes about 6 s to make in a browser on an
Apple M4 (about 3 s in Node), so it is made once and kept. `npm run
verify:hand` draws it on WebGPU (and WebGL with `HAND_RENDERER=webgl`) from
the back, the palm, the side, three quarters, against the light and close
to the nails, and keeps the pictures. The pose is baked into the mesh: there
are no skinning weights or rig, no prints, pores or veins beyond a shader's
grain, and the look is judged by eye, not against a photograph.
