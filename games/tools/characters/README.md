# Character kit

Tools for making a rigged, animated character from signed-distance shapes with the engine's public
API (`createZhudaSdfField`, `createZhudaIsosurfaceMesh`), in Node, with no modelling program. They
were written in the owner's verification repository for its beasts, bosses and heroes; the part
that needs nothing but the engine is here, and `games/zhuda-wardrobe` is built with it.

| File | What it is |
| --- | --- |
| `kit.mjs` | Vectors, noise, the two shapes (`E` ellipsoid, `C` round cone on a joint), mirroring, `skinner` (weights from the nearest parts' joints), `sampleClips` (poses to animation tracks at 30 a second) |
| `rig-glb.mjs` | `writeRiggedGlb`: a skinned, animated `.glb`, every primitive a mesh node of its own on one skin |
| `humanoid.mjs`, `hero-kit.mjs` | A human skeleton by height (`heroRig`: 20 joints and up to four of your own), a head with a face, hands, hair caps, hanging panels, poses with two-bone IK, material zones |
| `avatar-kit.mjs` | Open hands, bands laid on a surface, walking and running gaits (`motion`), neutral grey for parts a game tints |
| `fast-field.mjs`, `owner.mjs`, `detail.mjs` | A faster distance field for many shapes, which shape a surface point belongs to, small surface detail |
| `parts.mjs` | `buildPart`: one part of a character (a region of the body, hair) cut from the surface, simplified to a budget with its open edges kept, skinned, written as its own `.glb` |
| `garment.mjs` | `buildGarment`: a garment or worn object from a few numbers. Cloth is the body's surface moved outwards inside a `zone`, skinned as the skin under it; loose cloth is a `volume` (a skirt's bell, a pouch) that follows the legs softly and has both sides; every edge ends in a face that reaches the skin. `coverOf` says exactly what lies under it |
| `clip-check.mjs` | Whether anything comes through: `loadModel`, `posesOf`, `checkPair` (a part against the body, or one part against another, in every pose), `coverMasks` and `maskWhere` (what need not be drawn under a part), `folds`. Skins in Node as the engine does when a part is bound |
| `raster.mjs`, `look-check.mjs` | What would be on the screen: an orthographic rasteriser with a depth buffer (`look`, `picture`, `writePng`), and `lookCheck`, which counts from 26 directions the pixels one sees through and the covered surface that shows |
| `islands.mjs` | Separate pieces of a mesh, and `withoutScraps` to drop the stray ones a mesher leaves where shapes cross |
| `motion-audit.mjs` | What a character's `.glb` says about how it will move, against the bar of the route `high-quality-character`: keys a second, whether hair, cloth and tails move inside the clips, how each loop closes and how long it is, pops, twist and corrective bones, joints on a vertex. A command (`node motion-audit.mjs model.glb`, exit 1 when a must fails) and `auditCharacter(bytes, options)`. It reads names and numbers; nothing is drawn |
| `blender/raise-rig.py` | Blender headless: adds twist bones to the limbs named (weights shared out along the limb, keyed in every clip), swings the hair, cloth and tail chains named on springs and writes them into the clips (loops run until they repeat), and writes every clip dense over a whole number of frames. `blender/examples/` holds the two configurations it was checked with |
| `mesh-skin.mjs` | A skeleton for a mesh that was not made here (a generator's, a scan's): `readGlbMesh` (one primitive with its material and images), `weld` (a texture seam is one place), `connected` (the pieces), `skinByDistance` (weights from the bones' places: reach, which bones a place may take, loose pieces that move whole, four joints a vertex), `shareAlongLimb` (twist joints) |
| `rig-motion.mjs` | Clips in Node for a skeleton written by `rig-glb.mjs`: turns, `reach` (a leg or an arm that reaches a place), `twistAbout`, `worldPose`, `skinPoints`, `swingChains` (hair and cloth swung on springs into the keys; a loop is run until it repeats; `lies` keeps hair on the back), `toAnimations`, `fadeStep` (what a cross-fade does to the joints' places). The Node form of what `blender/raise-rig.py` does |
| `quick.mjs` | `quickGlb`: a whole definition as one vertex-coloured model, for looking at shapes and clips while working |

Checked here: `games/zhuda-wardrobe/tools/build-parts.mjs` builds a body, three hairstyles and 32
garments and objects with these files in about 70 seconds and measures them in 40 more (153 poses:
no skin through any of them at 1 mm); `tools/look-report.mjs` looks at each and at 24 outfits from
26 directions (no view over 1 cm² of hole or of covered surface showing); the game's tests read
every file and both reports back. The route is `docs/routes/clip-free-garments.md`.

How a garment that cannot clip is made, in short:

1. cloth at its thickness from the body, each vertex with the weights of the skin under it;
2. every edge closed by a face reaching into the skin; loose cloth following the legs, both sides;
3. simplified with `Regularize`, so that no triangle runs the length of a limb;
4. what is under the cloth not drawn (a mask, a bit per triangle), from the garment's own fields;
5. measured twice, by surfaces and by pixels, in poses beyond the game's clips, before it is listed.

Not here: the textured path (automatic UV charts, per-texel baking of colour, normal and ORM maps,
levels of detail), which needs xatlas and other tools and stays in the verification repository;
the route `rigged-phone-character` describes it. `hero-kit.mjs` still carries settings for that path.

## Cutting clothes from real measurements

- `tape.mjs` measures a mesh as a tailor would: `slice` (the points where it crosses a plane),
  `girth` (the length round them), `level` (round a height), `round` (round a limb), `extreme`.
- `garment.mjs` also has `volume.tube` (a straight tube: a trouser leg below the knee),
  `volume.bell({ power })` (a squared oval: a trunk is flatter than an ellipse), `solid.lathe` and
  `solid.block` (hard objects with edges, each on one joint: `item.solids`), `standsOut` (the
  body's vertices outside loose cloth at rest) and `coverOf({ looseHem })` (what is just above a
  hem stays drawn).
- `games/zhuda-wardrobe/tools/{reference,measure,catalogue}.mjs` show the whole way: a real size
  chart and real garment sheets, a body measured against them, cuts read off the body, and the
  made garments measured again. Route: `docs/routes/clip-free-garments.md`.

