# Model levels of detail

A phone draws about a million triangles in five milliseconds (measured on a
vivo V40, Adreno 720; see the record below). A scanned tree is 20 000 to
80 000 triangles: a stand of them is the whole frame budget, and again in
every split of the shadow map. `zhuda-laya-lod` makes the lighter versions a
model prefab's `lod` levels draw further off.

```sh
npx zhuda-laya-lod assets/nature/jacaranda_tree.glb --ratio 0.4,0.15,0.05
# jacaranda_tree.lod1.glb: 30904 of 77575 triangles (asked 0.4), 3743 KB of 5864 KB
# jacaranda_tree.lod2.glb: 11418 of 77575 triangles (asked 0.15), 2834 KB of 5864 KB
# jacaranda_tree.lod3.glb: 3749 of 77575 triangles (asked 0.05), 2412 KB of 5864 KB
```

Then name them in the prefab, each from the distance it takes over:

```ts
{ name: 'trees', asset: 'nature/jacaranda_tree.glb', placements,
  lod: [['nature/jacaranda_tree.lod1.glb', 18], ['nature/jacaranda_tree.lod2.glb', 40]] }
```

## A model that is one mesh a street long

A model is drawn whole whenever any of it is in view, and whole again in
every split of the shadow map it reaches. A row of houses exported as one
mesh 80 m long is therefore drawn five times a frame with four splits,
wherever the camera looks. Measured on the phone: of 24 ms of shadows in a
town street, 22 were the town's own dozen large meshes.

```sh
npx zhuda-laya-lod assets/city/main-w.glb --split 16
# main-w.cells.glb: 6932 KB
#   main-w: 51213 triangles in 8 squares
```

Every mesh is cut into squares of land that many metres across (x and z, in
the mesh's own units); each square becomes a mesh and a node under the node
that held the whole, so the file is used in place of the original and
nothing else changes. A triangle goes to the square its middle lies in.
Skinned meshes are left whole. More squares are more draws: cut to about the
size of what should be left out together (a house, not a brick).

Ground and paving shade nothing: give their prefab node `castShadow: false`
(`mountZhudaModel` takes the same option) and they are not drawn into the
shadow map at all. They still take shadows.

## What simplifying does

- **Solid surfaces** (a trunk, a rock, a wall) are simplified with
  meshoptimizer until they have the share asked for or would stand further
  from the original than `--error` (a share of the mesh's size, default 0.02).
- **A surface that is all seams** (faceted, or with a UV island a triangle)
  does not give way; it is simplified again with vertices joined across seams.
  Its normals and UVs can smear a little where that happens.
- **Leaf cards** (a part with an alpha-tested material whose pieces share no
  vertex) cannot be simplified without tearing. A share of the cards is
  dropped, the same ones every run, and the rest grow about their middles
  (at most 1.8 times) so the crown stays as full.
- Vertex data is written again without the vertices nothing uses, so the file
  shrinks as well.
- `--textures 1024,512` makes the pictures inside each level no larger than
  that many pixels a side (one size for every level, or one for each).
  Pictures are most of a model's bytes; without this a lighter version is
  barely a smaller file.
- Materials, nodes, skins, joints, morph targets and animations are kept.

`simplifyGlb(bytes, { ratio, error, cards })` in
`packages/compiler/model-lod.mjs` is the same thing as a function; it returns
the new file and, part by part, what was done.

## Limits

- Build-time only; nothing is simplified while a game runs.
- One mesh at a time: it does not merge parts or materials, and it does not
  make impostors (a picture of the tree on a card) for the far distance.
- Sparse accessors are refused. Meshes that are not triangle lists, and
  positions that are not 32-bit floats, are left as they are.
- How a lighter version looks is for a person to judge: draw it at the
  distance it will be used. The numbers say nothing about that.
