# Route: A 3D character dressed at run time

One body, and every garment, hairstyle, pair of shoes and worn object as a model of its own on the
body's joints. Wearing a part binds it to the body's skeleton, hides what it covers (the skin under
it and the cloth of any part under it, triangle by triangle) and gives it a colour; the body's
animation poses everything. Thirty-five parts here are made by the kit under
`games/tools/characters/`; a thirty-sixth is written by another tool in the conventions of
modelling programs, to check that the run-time half takes parts from elsewhere.

- **Id:** `outfit-swap-3d`
- **Kind:** workflow
- **For:** a character whose clothes, hair and shoes are chosen and changed while the game runs: character creation, a wardrobe, equipment that shows
- **Checked on:** desktop WebGL (headless Chromium 153 on SwiftShader, Linux container); no phone, no GPU, nobody judged how it looks
- **Status:** one body with ten regions and 32 parts in eight slots (one part from another tool) built, measured, worn with real clicks, and drawn through four clips and three held extreme poses on 2026-11-25; one character on screen (draft)
- **Reference consumer:** this repository, `games/zhuda-wardrobe`
- **Engine version:** zhuda-laya-engine 1.18.0; built and run against this repository's engine

Read `game-rules-first` for how the rules are kept testable, `humanoid-from-shapes` for how the
body is made, and `clip-free-garments` for how the parts are made and measured so that nothing
comes through them.

## When to take this route

Take it when what a character wears changes at run time and the pieces are too many to bake every
combination. For a fixed cast (each hero one outfit) one mesh a character is cheaper: see
`rigged-phone-character`. For colour alone, a neutral-grey material tinted by the game is enough
(step 7). For cloth that is pulled and torn, see `layered-cloth-on-body`; nothing here simulates.

## Tools

- Engine: `ZhudaModelLibrary.instantiate(id, { independentMaterials: true })`,
  `bindZhudaSkinToSkeleton(part, body)`, `setZhudaTriangleMask(node, mask)`, `ModelInstance.find`
  and `setTint`, `ZhudaModelInspector` (`play`, `crossFade`, `setAnimationSpeed`), a film scene for
  the room, `ZhudaRuntimeProfiler`.
- Parts: `games/tools/characters/garment.mjs` (`buildGarment`) for clothes and objects,
  `parts.mjs` (`buildPart`) for the body and hair, `clip-check.mjs` and `look-check.mjs` for the
  measures, meshoptimizer's simplifier (already an engine dependency).

## Steps

1. **One skeleton, fixed for ever.** Joint names and order are the contract between the body and
   every part ever made for it. Here: 20 human joints and four more (`hair1`, `hair2` for hair down
   the back; `robeF`, `robeB` are kept for parts made before skirts followed the legs), 24 in all.
   A part may use fewer joints, never one the body lacks. Clothes need none of their own.
2. **Cut the body into regions**, each a mesh node of its own on the one skin: head, torso,
   shoulders, upper arms, forearms, hands, hips, thighs, shins, feet. Name the nodes
   `region-<name>`. Paint plain underclothes on the body so that it can be shown bare.
3. **Make the parts** by `clip-free-garments`: cloth as the body's surface moved outwards and
   skinned as the skin under it, every edge closed, one mesh a part, the body's joints in it, no
   clips; the body's file carries the clips.
4. **Slots, from the skin outwards**: shoes, bottom, top, full, waist, hair, back, hat. Of two
   parts worn together the one in the later slot is over the other.
5. **Write two lists.** `assets/wardrobe.json`: for each part its slot, triangles, whether it takes
   a colour, the regions wholly under it (`covers`), the parts it must not be worn with (`avoid`),
   and whether it passed the measure. `assets/masks.json`: for each part, what it hides of each
   region of the body and of each part that can be under it, a bit per triangle in the file's
   order. Both are written by the build that measures the parts, never by hand.
6. **Rules, pure** (`src/core/wardrobe.ts`): one part a slot; a full garment takes the place of top
   and bottom and either of them takes its place; wearing a part takes off whatever it must avoid;
   what is hidden is the union of the worn parts' masks; a look reads back from a short code (new
   slots go at the end, so an older code still reads); a seeded random look uses only parts that
   passed and never a pair to avoid.
7. **At run time**: load a part the first time it is worn, `bindZhudaSkinToSkeleton(part, body)`,
   refuse it if `report.renderers` is 0, add its node under the body's and keep it. To change a
   look: switch worn parts' nodes on and the rest off; for each region of the body switch its node
   off when every triangle is hidden, else `setZhudaTriangleMask(region, mask)`; the same for each
   worn part under another; `setTint` each tintable part with a linear colour. Guard against a
   later choice arriving while an earlier one is still loading.
8. **A part from another tool** (a modelling program, a store) is worn the same way if its joints
   carry the body's names and sit in the same places. It may have fewer joints in any order, bones
   turned along another axis, an armature turned or scaled, textures instead of vertex colours:
   `bindZhudaSkinToSkeleton` binds it through offset nodes and reports how many (`offsets`). Bind it
   right after instantiating it. It is measured like any other part; if it does not pass, list it
   so (`passes: false`) and say so in the game rather than leave it out silently.
9. **Budgets that held**: body 11,596 triangles (head 3,000, hands 1,700); parts 600 to 8,460 (a
   long robe, its loose cloth counted on both sides); a shirt, trousers, boots, belt and hair draw
   13,880 with 3,741 triangles of skin and 985 of cloth under cloth not drawn; no random look over
   25,000. Thirty-six files, 5.6 MB, vertex colours; masks 100 KB.

## Pitfalls

- **A region named like the joint under it.** The body's nodes `hips` and `head` were found before
  the joints of those names: trousers drew as a column from waist to floor and hair not at all.
  The engine call now takes the body's joints from its own skinned meshes; still name regions
  `region-…`, because `find` goes by name.
- **Bound, nothing missing, and not there.** The part from another tool reported one mesh bound to
  fourteen joints and drew nothing, twice: first because its joints rest turned and a hundred times
  larger than the body's (fixed by the offset nodes), then because its culling box was still in its
  own centimetres, a hundred metres up (fixed by moving the box). Look at the picture, not the report.
- **`material.albedoColor = …` does nothing on a glTF material** and says nothing. Use `setTint`,
  with linear values and `independentMaterials: true`.
- **A mask in the wrong order hides the wrong triangles and says nothing.** LayaAir 3.4.2 holds
  each glTF primitive last index first. `setZhudaTriangleMask` takes the file's order and turns it;
  have the recorded run read back which triangles are hidden and compare them with the file.
- **Hiding whole regions only** leaves most of the skin under a short sleeve or shorts drawn, and
  it comes through in a deep bend. Hide by triangle; switch a region off only when all of it goes.
- **Hiding under cloth that hangs** opens a hole when it swings away. Only cloth lying on the
  body, or a closed volume, hides what is under it.
- **Simplifying without locked borders** moves the edges where parts and regions meet.
- **`COLOR_0` is linear** in this engine: convert display colours when writing vertex colours.
- Loading on first wear takes a moment: show the previous look until the new one is whole.

## Engine gaps and their workarounds

- Every region and part is a draw call in every pass: one character was 65 draws with shadows.
  Nothing merges what is shown into one mesh; with many characters, bake the look.
- A masked mesh is a copy of its own, so a dressed character holds its own copy of the body's
  regions still drawn (about 0.5 MB here).
- A part's joints must be where the body's are: nothing refits a garment made for other
  proportions, and nothing checks. The body's own mesh must be in its model space. Test the joint
  lists (the reference game's tests read every file).
- No level of detail for a part, and no cloth simulation on one.
- The kit is a consumer's tool under `games/tools/characters/`, not engine API; its textured path
  (UV charts, baked maps) is not in this repository.

## Checks

- Tests: every file's joints equal the list's and every part is one skinned mesh without clips;
  slot rules; a part takes off what it must avoid; masks are of the right length and hide only
  cloth that lies on the body; triangles of 300 random looks; codes read back, older ones too; both
  measures' reports are of the files as built and pass.
- A recorded run with real clicks: each part bound with no joint missing; the triangles in fact
  hidden on ten loaded meshes are the ones the masks name; whole regions switched off are the ones
  the rules say; a part worn twice is loaded once; a pack takes long hair off; a drag turns the
  character.
- Frames standing, walking, with arms overhead, crouched, kicking, running in a robe, kicking and
  crouching in a skirt, greeting in a hat with a pack: nothing comes through
  (`games/zhuda-wardrobe/docs/evidence/hands.jpg`).
- The part from another tool: bound with as many offsets as it has joints (14), the kit's own with
  none; drawn textured on the running body; marked on the page as not passing.

## Not checked

- How it looks to a person: the figure is thin and the clothes are plain.
- A phone or a GPU; several dressed characters at once.
- A file exported by a modelling program itself. The foreign part is written by a script
  (`tools/foreign-part.py`) that follows those programs' conventions and shares no code with the
  kit; no such program was available. A real export may differ in ways the script does not.
- Animations beyond this body's clips and the three extreme poses.

## Boundaries

The engine binds, finds, tints and plays. Which parts exist, what covers what, what a slot is and
how a look is stored are the game's. Art made by this kit is placeholder.
