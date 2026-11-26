# Verification: skin-binding

Checked on 2026-11-25 in a Linux container with no npm registry (Node 24.22.3, TypeScript 5.9.3 and
esbuild 0.28.2 in place of the pinned versions, no eslint), headless Chromium 153 on SwiftShader.

| Check                                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --test tests/skin-binding.test.mjs`       | 6 of 6: joints matched by name in the part's own order and to the body's root; a body mesh node named like a joint is not taken for it; bare joints matched by node name; a missing joint binds nothing and is named; a part resting turned and in centimetres is bound through an offset node, its vertex lands where the body's would at rest and after the joint moves, its culling box is in the body's metres, and releasing removes the node; a part on the body's own skeleton, standing elsewhere in the scene, gets no offset |
| `npm run types:generate`                        | `runtime3d/SkinBinding.d.ts` and `runtime3d/index.d.ts`, written by the generator                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `games/zhuda-wardrobe`, `npm run verify`        | HEALTHY, 7 tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| The kit's own parts in the browser, real clicks | nine parts worn in turn, each bound to 24 joints with none missing and no offsets; jacket, skirt, boots and hair follow the body through Idle, Walk, Run and Greet (`games/zhuda-wardrobe/docs/evidence/hands.jpg`, `hands.log.json`)                                                                                                                                                                                                                                                                                                  |
| A part from another tool, in the browser        | `games/zhuda-wardrobe/tools/foreign-part.py` (no code shared with the kit) writes a top in centimetres, z up, bones turned, 14 of the body's 24 joints in another order, textured. Worn with real clicks: 14 joints, 14 offsets, none missing; drawn on the running body (`hands.jpg`, last frame)                                                                                                                                                                                                                                     |

Three things were seen wrong in the browser first and tested after:

- The first version matched by node name alone: the trousers drew as a column and the hair did not
  draw, because the body's region nodes `hips` and `head` were found before the joints of those names.
- The part from another tool reported as bound and drew nothing: its joints rest turned and a
  hundred times larger than the body's. Hence the offset nodes.
- With the offsets it still drew nothing: its culling box was in its own centimetres, a hundred
  metres up. Hence the box moved into the body's space.

## Not checked

- `npm ci`, the pinned toolchain, eslint, CI.
- A phone or a GPU; WebGPU; more than one dressed character.
- A file exported by a modelling program itself: none was available, and the script only follows
  such programs' conventions.
- A body whose own mesh is not in its model space; a part bound while already posed; a part made
  for other proportions.
- A sample backend or a baked crowd using a bound part.
