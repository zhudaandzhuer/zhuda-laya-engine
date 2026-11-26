# Route: A humanoid character made from shapes

A person built in Node with no modelling program: ellipsoids and round cones on the joints of a
skeleton, joined into one surface, meshed, cut into parts, skinned and animated by poses, written
as `.glb`. It is how the wardrobe's body and hair are made, and the untextured half of how the
verification repository made its heroes. What the figure wears is made from it by
`clip-free-garments`.

- **Id:** `humanoid-from-shapes`
- **Kind:** workflow
- **For:** making a rigged, animated human figure and what it wears from code, as vertex-coloured models a game can load, tint and dress
- **Checked on:** desktop WebGL (headless Chromium 153 on SwiftShader, Linux container); no phone, no GPU, nobody judged how it looks
- **Status:** a body in ten regions and three hairstyles built in about ten seconds and drawn through four clips on 2026-11-25; the textured path is not in this repository (draft)
- **Reference consumer:** this repository, `games/tools/characters/` and `games/zhuda-wardrobe/tools/`
- **Engine version:** zhuda-laya-engine 1.18.0; built and run against this repository's engine

## When to take this route

Take it for stand-in characters, crowds of simple figures, or a character that must be regenerated
from data. It gives smooth, simple forms: no sculpted folds, no painted textures. For a model made
in Blender take `model-from-dcc`; for textured creatures with levels of detail read
`rigged-phone-character`; to dress the result at run time take `outfit-swap-3d`.

## Tools

- Engine: `createZhudaSdfField`, `createZhudaIsosurfaceMesh`; meshoptimizer's simplifier.
- `games/tools/characters/`: `kit.mjs` (shapes, `skinner`, `sampleClips`), `hero-kit.mjs`
  (`heroRig`, `head`, `hairCap`, `hangingPanel`, `ring`, pose tools), `avatar-kit.mjs`
  (`relaxedHand`, `motion`, `neutralGrey`), `parts.mjs` (`buildPart`), `rig-glb.mjs`.
- Node 24. A tool here imports the engine by its own name: a file inside the repository resolves
  `zhuda-laya-engine` to this checkout's build, so build the engine first.

## Steps

1. **A skeleton by height**: `heroRig({ H, shoulder, hip, hand, extras })` gives 20 joints in an
   A-pose (arms 50° below level) and named points (`P.shoulder`, `P.elbow`, `P.hip`...). Add at most
   four joints of your own for hair and hanging cloth; 24 keeps to the phone budget used here.
2. **Shapes on joints**: `E(joint, centre, radii)` and `C(joint, a, b, ra, rb)`, each with a `blend`
   (the fillet where it meets its neighbours) and a tag for colour. Write the left side and mirror
   it with `both`. The head with its face is `head(rig, face)`, a hand `relaxedHand`.
3. **Mesh** the whole definition with `createZhudaIsosurfaceMesh` at a 6 mm cell (about 100,000
   triangles for a 1.68 m figure, two seconds).
4. **Cut and simplify** (`buildPart`): triangles go to the part or region whose shape they lie on;
   each is simplified to its budget with open edges locked and the simplifier's `Regularize` (a
   limb, flat along its length, is otherwise left with triangles 20 cm long, which bend badly and
   cannot be hidden under a cuff). Budgets used: head 3,000, hands 1,700, the body 11,596 in all.
   A part built on shapes it does not keep (hair on a head) is meshed alone and reaches 5 mm into
   them, so that no slit shows along its edge.
5. **Skin**: a vertex follows the joints of the nearest shapes, up to four, falling off over 24 mm
   (`skinner`). A shape marked `rigid` follows its own joint only; shapes sharing a `skinGroup`
   (hair) are skinned among themselves, except where they lie within 1 cm of the body: there they
   take the skin's weights, easing to their own by 3 cm (the neck turns under hair at the nape).
6. **Colour** per vertex from the definition's `paint`, written linear. Parts a game will tint are
   painted a neutral grey (`neutralGrey`) so that a material colour multiplies cleanly.
7. **Clips are poses**: a function from time to a pose, sampled 30 times a second. `motion(rig)`
   gives standing, hanging arms and walking and running gaits with feet planted by two-bone IK;
   `hangFollow` keeps hair hanging. Add a clip of poses no game clip reaches (its name starting
   with `_`): what the figure wears is measured in them.
8. **Write** with `writeRiggedGlb`: every part a mesh node of its own on one skin, `partNames` for
   nodes a game will look up.

## Pitfalls

- A cell too coarse for fingers and the face: 6 mm is the coarsest that kept them.
- Thin flattened shapes laid on a surface count as "nearest" centimetres past their edge; `owner.mjs`
  exists for that, and `buildPart` uses it.
- Several primitives in one mesh whose vertex attributes differ are not all drawn by this engine:
  the writer gives each its own node.
- Clip values are rotations about world axes at each joint (joints are not turned in the bind
  pose): a pose written for another rig's local axes will not carry over.
- Hair and cloth on their own joints need those joints in the body's file too, or a part cannot be
  bound to it.

## Engine gaps and their workarounds

- The mesher takes one box and refuses one the surface leaves: no meshing of a part alone.
- No UV unwrapping or baking in the engine: textured characters need the path that stayed in the
  verification repository (xatlas, per-texel baking), described in `rigged-phone-character`.
- No preview of a `.glb` from Node: look at it in a game page or with the model editor.

## Checks

- `node games/zhuda-wardrobe/tools/build-parts.mjs`: 13 files, 21 s; the game's tests read each
  back (joints, skinned meshes, triangles, clips).
- Drawn standing, walking, running and greeting in `games/zhuda-wardrobe`.

## Not checked

- Whether the figure reads as a good character: nobody judged it, and it is plainly a stand-in.
- The eleven heroes and two avatars of the verification repository were not rebuilt here; numbers
  quoted from them elsewhere are theirs.
- Bodies of other builds (male, child, heavy): one female figure of 1.68 m was made.

## Boundaries

The engine provides the distance field, the mesher and the loader. The shapes, the skeleton, the
clips and the kit that turns them into files are the consumer's.
