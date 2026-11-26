# Verification: triangle-mask

Checked on 2026-11-25 in a Linux container with no npm registry (Node 24.22.3, TypeScript 5.9.3 and
esbuild 0.28.2 in place of the pinned versions, no eslint), headless Chromium 153 on SwiftShader.

| Check                                                | Result                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --test tests/triangle-mask.test.mjs`           | 7 of 7: bits made, joined and encoded; masked triangles keep their place; the first mask copies the mesh and leaves the shared one; release frees the copy; the file's order turned by sub-mesh; a 32-bit mesh masked in place; wrong targets and lengths refused                                                                                                |
| `npm run types:generate`                             | `runtime3d/TriangleMask.d.ts` and `runtime3d/index.d.ts`, written by the generator                                                                                                                                                                                                                                                                               |
| `games/zhuda-wardrobe`, `node tools/build-parts.mjs` | 36 parts built in 67 s and measured in 40 s over 153 poses (Idle, Walk, Run, Greet and a clip of extreme poses): no skin through any of the 35 kit-made parts at 1 mm (4,284 vertices still drawn under them); of 118 overlapping pairs of kit-made parts one fails (long hair under the pack) and is listed as avoided                                          |
| `games/zhuda-wardrobe`, `node tools/look-report.mjs` | 36 parts alone and 24 sampled outfits, 1,066 views each (26 directions by 41 poses) in 401 s: kit-made, worst view 0.89 cm² seen through and 0.22 cm² of covered surface showing, limit 1 cm²; the bare body 0                                                                                                                                                   |
| The counter-example                                  | A top made the naive way by another script is measured the same: 25 vertices through up to 10.6 mm, 115 cm² seen through at its open edges; listed as not passing                                                                                                                                                                                                |
| `games/zhuda-wardrobe`, `npm run verify`             | HEALTHY, 10 tests (they read every file and both reports)                                                                                                                                                                                                                                                                                                        |
| In the browser, real clicks                          | Masks applied through `setZhudaTriangleMask` on the body's regions and on worn parts; the page reads back from each loaded mesh which triangles are not drawn, and the sums of their sides agree with the files for ten meshes; frames with arms overhead, crouched and kicking in trousers, a robe and a skirt (`games/zhuda-wardrobe/docs/evidence/hands.jpg`) |

Seen wrong first and fixed:

- The first recorded run failed its own check: the sum over every 37th triangle of the loaded mesh
  was the file's sum taken from the last triangle backwards. LayaAir reverses each primitive's
  index list; masks in the file's order would have hidden the wrong triangles with no error. The
  call now turns the order, and the run compares the hidden triangles themselves.
- A plane cutting an arm hole cut the trunk away too: tops were bibs and passed every measure.
  Found by looking at a sheet of pictures; the route now says to look.
- A wide sleeve zone took in the neck; cuffs ending at the body's true surface left slits against
  the simplified body; long triangles along limbs could not be hidden; hair following only the head
  let the neck through; a hard pouch at the hip clipped in a crouch. Each is in the route's pitfalls.

## Not checked

- `npm ci`, the pinned toolchain, eslint, CI.
- A phone or a GPU; WebGPU; more than one dressed character; a masked mesh in a baked crowd.
- A real glTF file with several primitives in one mesh (the turning by sub-mesh is tested on a fake).
- How the garments look to a person. Nothing comes through them by measure; they are plain.
- Animations other than this body's five clips; another body shape; garments modelled by hand.
- The measures themselves against a ground truth other than pictures looked at by the author.
