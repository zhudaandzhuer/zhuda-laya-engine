# Many copies: instanced meshes and baked crowds

A scene of nodes pays for every copy every frame: a box to test against
the view, a matrix to hand over, and on WebGPU a draw. Two classes draw many
copies without a node for each, and one option switches a model's
`placements` over to the first. All of it is drawn on WebGL and on WebGPU
by `npm run verify:instanced-mesh`.

| What                 | For                                | A copy costs                        |
| -------------------- | ---------------------------------- | ----------------------------------- |
| `ZhudaInstancedMesh` | props that stand still             | nothing after it is made            |
| `instanced: true`    | the `placements` of a model        | the same                            |
| `ZhudaBakedCrowd`    | one animated character, many times | four numbers when its frame changes |

## Instanced meshes

```ts
import { ZhudaInstancedMesh, zhudaPlacementMatrices } from 'zhuda-laya-engine';

const stones = new ZhudaInstancedMesh(
  holder, // the copies are places under this node
  mesh, // a LayaAir mesh; its buffers are shared
  material, // one, or one a sub-mesh
  zhudaPlacementMatrices(places), // [x, y, z, yawDeg, scale] each
  { cellMeters: 32, castShadow: true },
);
stones.stats; // { copies, groups, drawsPerPass }
stones.dispose();
```

The copies are grouped by the square of ground they stand on (`cellMeters`
a side, at most `maxPerCell` to a group). Each group is one ordinary mesh
node whose geometry carries its copies' matrices as an instance buffer, so
the copies go through LayaAir's ordinary passes: lit, fogged, shadowed and
shadowing, in the depth texture. A group whose box is out of view is not
drawn. On WebGL the picture is the one the same copies give as nodes, bit
for bit.

- `zhudaPlacementMatrices(placements, parent?, local?)` and
  `zhudaInstanceCells(matrices, meshMin, meshMax, cellMeters, maxPerCell)`
  are plain arithmetic, for tools and tests.
- **A tint for each copy**: `tints`, four numbers a copy (a display colour
  and one spare), multiplied into the base colour. Only materials made by
  `ZhudaLitSurfaceMaterial` or `ZhudaToonMaterial` read it; any other
  material is refused with tints.
- What it gives up: a copy cannot be moved, hidden or picked by itself (make
  the instanced mesh again, or keep that prop a node). A mirrored copy
  (negative scale) is refused. A holder that moves afterwards takes the
  groups' boxes with it but not the copies, unless the mesh is made with
  `follow: true`.
- **`follow: true`**: the copies go with the holder. When it, or anything
  above it, has moved, every copy's matrix is worked out and sent again
  before the next frame is drawn, once however often it moved
  (`stones.refresh()` does it at once). For copies under something that is
  put in its place after they are made, or that moves now and then; a
  holder that moves every frame pays for every copy every frame. The
  matrices are kept for it, sixteen numbers a copy.
- A model whose own file asks for copies of a mesh
  (`EXT_mesh_gpu_instancing`) is drawn this way when it is mounted with
  `mountZhudaModel`: see [model showcase](model-showcase.md).

## A model's placements, instanced

```json
{ "name": "ferns", "asset": "set/fern.glb", "placements": [[0, 0, 0, 0, 1]], "instanced": true }
```

In a model prefab (`PrefabModelNode`) and in a film scene's model node,
`instanced: true` draws the placements of each of the model's meshes in
groups instead of making a node tree for every copy. With `lod` and
`cullMeters` the level is chosen for a group, by the middle of its box, not
for each copy (`cellMeters`, default 32, sets how fine that is). Only for
models of plain meshes: one with bones or morph targets is refused.

## Baked crowds

```ts
import { ZhudaBakedCharacter, ZhudaBakedCrowd } from 'zhuda-laya-engine';

const model = await library.instantiate('people/walker.glb'); // not put in a scene
const walker = new ZhudaBakedCharacter(model, { clips: ['Walk', 'Wave'], fps: 30 });
const crowd = new ZhudaBakedCrowd(
  holder,
  walker,
  places.map((place, i) => ({ place, clip: 'Walk', phase: i * 0.137, speed: 1 })),
);
// every frame, with the time of the clock the scene runs on
crowd.update(seconds);
crowd.setClip(12, 'Wave');
```

`ZhudaBakedCharacter` plays each clip once, a frame at a time, with
LayaAir's own animation, and writes every bone of every frame into one
texture (`layout` says where, `textureBytes` how much). `ZhudaBakedCrowd`
draws copies of the character in groups as above; each copy carries which
clip and which frame it shows. At a whole frame a copy is the picture
LayaAir's own skinning gives at that time. A character on more than 24
bones, which LayaAir cuts into pieces, is baked whole.

- What it gives up: a copy shows whole frames of one clip (no blending
  between clips or frames: bake at the rate it is seen at), nothing can be
  attached to its bones, and it is culled with its group.
- `zhudaBakedLayout` and `zhudaCrowdFrame` are the plain arithmetic.
- The model instance must stay alive while the character is used, and is
  left in the pose of the last frame written.

## Shadows from identical nodes on WebGPU

LayaAir 3.4.2 on WebGPU gathers renderers of one mesh and one material into
a batch and never draws a batch into a shadow map: two trees of one model
cast no shadow where one alone does. The engine keeps renderers that cast a
shadow out of those batches, so each casts; the price is one draw a
renderer. Many copies that cast are what `instanced: true` is for.

## What it costs

A vivo V40 (Adreno 720, WebGL), a picture of 823 by 1749, a shadowed sun,
median of 40 frames each drawn to the end:

| Scene                                      | ms a frame (runs) |
| ------------------------------------------ | ----------------- |
| floor only                                 | 7.2, 6.8, 10.1    |
| 5,000 balls as nodes                       | 33.0, 36.2, 32.6  |
| the same in 24 groups                      | 17.3, 21.8, 17.8  |
| 300 characters, a skeleton each (12 bones) | 29.4              |
| the same, baked                            | 16.3              |

Draws a frame as LayaAir counts them (scene, shadow maps), on a desktop:

| 5,000 balls | WebGL  | WebGPU       |
| ----------- | ------ | ------------ |
| as nodes    | 10, 5  | 9,024, 5,000 |
| in groups   | 47, 24 | 47, 24       |

On WebGL LayaAir batches identical nodes itself, into fewer draws than the
groups make, but gathers them again every frame. On WebGPU nodes that cast
are drawn one by one (see above). One phone, one scene.
