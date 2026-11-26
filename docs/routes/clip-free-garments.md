# Route: Garments and objects made in number that nothing comes through

A catalogue of clothes and objects for one body, each a line of numbers (where it starts and ends,
how thick, what hangs from it), built by one tool and passed through two measures before it is
listed: the body must stay under it in every pose, and looked at from all round it must show no
hole and nothing that it covers. Thirty-two items made this way, with three hairstyles, are in the
reference game; all pass, and of their 118 overlapping pairs one is kept apart.

- **Id:** `clip-free-garments`
- **Kind:** workflow
- **For:** many garments, shoes and worn objects for one skeleton, made by a tool and not by hand, that may be combined freely and must not clip in any animation
- **Checked on:** the two measures run in Node (no browser); the result drawn in headless Chromium 153 on SwiftShader (Linux container); no phone, no GPU, nobody judged how it looks
- **Status:** 31 kit-made parts on a body with a real size chart's measurements, built and measured in 153 poses on 2026-11-25; one character, one body shape (draft)
- **Reference consumer:** this repository, `games/zhuda-wardrobe` (`tools/catalogue.mjs`, `tools/build-parts.mjs`, `tools/look-report.mjs`)
- **Engine version:** zhuda-laya-engine 1.18.0 with `setZhudaTriangleMask`; built and run against this repository's engine

Read `outfit-swap-3d` for how parts are worn at run time and `humanoid-from-shapes` for how the
body is made. This route is what lies between: how a part is made so that it cannot clip, and how
that is shown.

## When to take this route

Take it when the garments are many, are combined by the player, and are made by a tool from the
body's own shape. It needs the body as shapes (signed distances), so it fits a body made by
`humanoid-from-shapes`. For garments modelled by hand in another program, take only steps 6 to 9:
the measures and the masks work on any `.glb` on the body's skeleton, and say what does not pass.
For cloth that should swing, flutter or tear, see `layered-cloth-on-body`; nothing here simulates.

## Tools

- `games/tools/characters/garment.mjs`: `buildGarment`, `zone`, `volume`, `coverOf`.
- `games/tools/characters/clip-check.mjs`: `loadModel`, `posesOf`, `checkPair`, `coverMasks`,
  `maskWhere`, `folds`. Skins every model in Node exactly as the engine does when a part is bound.
- `games/tools/characters/look-check.mjs` and `raster.mjs`: `lookCheck`, `dressed`, `picture`: an
  orthographic rasteriser with a depth buffer, for looking without a browser.
- `games/tools/characters/islands.mjs`: stray scraps of triangles.
- Engine: `setZhudaTriangleMask(node, mask)` hides triangles of a drawn mesh;
  `bindZhudaSkinToSkeleton` wears the part.
- meshoptimizer's simplifier with `Regularize` (already an engine dependency).

## Steps

1. **Cloth is the body's surface moved outwards.** A garment is the surface at its thickness from
   the body, kept inside a zone: a slab for the trunk, capsules round the limbs, planes where cuffs
   and hems are cut. Nothing is modelled; a tee is `{ hem: 0.955, sleeve: 'short', collar: 'crew' }`.
   Thickness sets what lies over what, and must differ by 5 mm or more between layers worn together:
   shoes 6 mm, bottoms 11, tops 17, whole garments 22, a belt 27.
2. **Each vertex of the cloth takes the weights of the skin under it**: step from the vertex down
   the body's distance to the surface, and take the body's weights there. Cloth and skin then move
   as one, in any pose of any animation, and the garment needs no joint of its own.
3. **Loose cloth is a volume added to that** (the bell of a skirt, a pouch). It takes the weights
   the body would have at the cloth's own place, more softly, among the joints named for it (a
   skirt: hips and legs, never a hand hanging beside it), blended into the skin's weights over the
   3 cm where it leaves the body. The half of a skirt before a thigh follows that thigh. Give loose
   cloth both sides (two triangles for one): in a high kick some of it turns over.
4. **Close every edge.** Mesh the garment alone, as a solid that reaches 5 mm into the skin: a cuff
   then ends in a face that passes into the arm, and a skirt in a face from hem to legs. Nobody sees
   into a sleeve or up a skirt, and the garment with the body in it is one closed solid. Drop the
   face inside the body and any scrap of fewer than 12 triangles.
5. **Simplify for skinning, not for looks.** Use the simplifier's `Regularize` with locked borders,
   on the body as on the parts. Without it a limb, flat along its length, is left with triangles
   20 cm long: they cannot be hidden under a cuff that ends halfway along them, and they bend badly.
6. **Hide what is covered** instead of hoping it stays under. The tool that made a garment can say
   exactly what lies under its cloth (`coverOf`): every triangle of the body, and of thinner cloth
   on the body, whose three corners are 3 mm under the surface and 8 mm inside its edges gets a bit
   in a mask. At run time the union of the worn parts' masks is applied with
   `setZhudaTriangleMask`; a region wholly hidden is switched off. Loose cloth of an inner part is
   never hidden (it swings away from what was over it), and only a closed volume hides what is in
   it. For a part made elsewhere, `coverMasks` measures the same from the two surfaces.
7. **Measure one: does anything come through.** For each part against the body, and each pair of
   parts that can be worn together, in every second frame of every clip and of a clip of poses no
   game clip reaches (arms overhead with a twist, a deep crouch, a high kick): each vertex still
   drawn that lay under the outer cloth at rest must stay under it. It has come through when it is
   outside both the triangle that was over it at rest and the cloth nearest to it in the pose, by
   more than 1 mm, and that nearest cloth is not an open edge or the face a cuff ends in. A part
   that fails stops the build; a pair that fails is written into both parts' `avoid` and the game
   does not let them be worn together.
8. **Measure two: what would be on the screen.** Skin every part of a whole outfit in a pose,
   rasterise it from 26 directions with back faces culled as a graphics card culls them, and count
   two kinds of pixel: one whose nearest surface faces away (a hole: one sees through), and one
   whose nearest surface is skin or inner cloth at a place the garment over it covers. Every part
   alone and a seeded sample of whole outfits; the limit is 1 cm² in the worst single view.
9. **Look at a sheet of pictures** from the same rasteriser before trusting either number: a zone
   written wrongly gives a garment that passes every measure and is a bib.
10. **Hard objects only where the body does not bend** (a hat on the head, a pack on the chest),
    each wholly on one joint. Anything else worn on the body (a pouch on a belt at the hip) is a
    loose volume: it gives with what is under it.
11. **Record what was measured** beside the parts (`docs/evidence/clip-report.json`,
    `look-report.json`) and let the game's tests read it: a part whose triangle count is not the
    report's was rebuilt without being measured.

### Cut it from a real garment, not from an idea of one

The first catalogue passed both measures and was wrong: nobody had compared it with anything. A
tape (`games/tools/characters/tape.mjs`: cut the mesh with a plane, take the length round the cut)
showed a bust 76 % of a real one, a neck 68 %, a T-shirt that followed the waist in like a wetsuit
and ended at the waist, trouser legs that narrowed to the ankle, a 26 cm skirt. So:

1. **Give the body a real size chart's measurements first.** Take a published table (here ASTM
   D5585 size 8), measure the figure the way the table says, and move the shapes until every
   girth and height is within a few per cent. Clothes cut for a body that is too thin cannot have
   real proportions.
2. **Read the garment's numbers from real specification sheets**, with their sources and ranges,
   into one file (`tools/reference.mjs` in the game): length from the shoulder's high point, ease,
   neck width and drops, sleeve length and opening, inseam, leg opening, skirt length and sweep.
   Look at photographs for what a table does not say (a T-shirt hangs straight from the bust and
   the shoulder blades; a trouser leg is a tube).
3. **Read positions off the body, never type them.** The catalogue asks the body's own distance
   field how far it reaches at a height in a direction, so a changed body needs no new numbers.
4. **Cloth that hangs is loose cloth**: a top is a squared oval at each height, as far out as the
   body is anywhere above and straight between what holds it out (`drape`); a trouser leg below
   the knee is a straight tube (`volume.tube`). It moves with the skin under it (the skin's own
   softness), or what is worn under it comes through in a deep bend.
5. **A hard object is a solid with edges** (`solid.lathe`, `solid.block`), at a real one's size:
   a cone for a conical hat, a rounded box for a pack. Soft shapes make everything a ball.
6. **Measure the made garment with the same tape** and list what is outside the real range. Three
   things are, here; the test names them, so that neither a regression nor a quiet fix passes.

What this cost: loose cloth has two sides (a long-sleeved top, trousers and boots draw about 3,200
triangles more than the bare body, where cloth on the skin cost under 2,000); and four cuts at real
lengths (a 43 cm skirt, tops to the middle of the thigh) failed measure two in the split kick and
were left out of the catalogue.

## Pitfalls

- **Zones that leave a seam.** A sleeve's capsule only a little wider than the arm hole the trunk
  leaves: the two met in a thin band under the arm, where faces were taken for cut edges and skin
  was left drawn. Overlap zones deeply. And a wide capsule from the shoulder took in the neck: cut
  it by a plane.
- **A plane across the whole body.** An arm hole cut by a plane through the shoulder cut the
  trunk away below it too, leaving a bib; every measure passed. Limit a cut to the limb it is for.
- **The body drawn is not the body shaped.** Simplified to a tenth of its triangles it lies up to
  4 mm inside its true surface; a cuff ending at the true surface left a slit all round.
- **Measuring against one triangle** counts cloth sliding (a neck in a collar, a boot below a hem)
  as coming through; **measuring against the nearest cloth** counts a crease closing (a sleeve's
  underside on the ribs). Each alone gave false alarms in dozens; a vertex is through when both say so.
- **A hard object across a joint** (a pouch at the hip) came through whatever was under it at 11 mm
  in a crouch, wherever it was moved. As a soft volume it passes with every part.
- **Hair that follows only the head**: the neck turns under it and came through at 5.7 mm with the
  head turned 35 degrees. Where hair lies within 1 cm of the skin it now takes the skin's weights,
  easing to its own joints by 3 cm.
- **The triangle order of a loaded mesh is not the file's.** LayaAir 3.4.2 reads each glTF
  primitive last index first; a mask applied in the file's order hid the wrong triangles and drew
  no error. `setZhudaTriangleMask` turns it; the reference run reads back which triangles are
  hidden and compares them with the file.
- **A skirt as panels on joints of its own** needs those joints driven in every clip; as a bell
  following the legs it needs nothing, and does not gape.

- **Skin outside loose cloth at rest is found by no pose check.** A skirt's oval fitted to the
  front, the back and the side left the fronts of the thighs outside it; they were never under
  the cloth, so nothing paired them with it, and no pixel was a hole. Only the picture showed it.
  Fit the oval to every direction, and count the body's vertices outside it at rest
  (`standsOut`, measure three).
- **A hard object covers nothing, so the measures never look at it.** A bun stood through the
  cone of the hat. Check what is worn with a solid against it at rest, or keep the two apart.
- **A new body changes which triangles the simplifier keeps**, and a margin of a millimetre flips.
  Give loose cloth a few millimetres over what lies under it rather than tuning one vertex.
- **What is just above a hem is lifted out from under it in a stride**; if it was not drawn, it is
  missing. Keep the last 3 cm above a hem drawn (`coverOf`, `looseHem`).

- **Do not shade by distance to a zone's boundary.** It is a distance in space, not along the
  cloth to its rim: where a zone only encloses a limb its boundary runs close to the surface, and
  a "trim" painted by it came out as dark patches on the seat of trousers and the hips of a dress.
  No measure sees colour; a person looking at a graphics card's picture did. A band on vertex
  colours is ragged anyway (it follows the triangles): leave ribs and stitching to a texture.
- **The corner at a cut comes out of the mesher rounded and ragged.** Moving every vertex near a
  cut onto the cut straightens a hem at rest and turns faces over at the corner: the pixel
  measure found slivers on five parts. Not solved here.
- **The face that closes a hem moves with the leg, the hem with the hips**: in a stride it hangs
  below the hem as teeth. Not solved here.

## Engine gaps and their workarounds

- The makers and the measures are consumer tools under `games/tools/characters/`, not engine API,
  and they are tied to bodies made of the kit's shapes. Only the mask is in the engine.
- A masked mesh is a copy of its own (LayaAir cannot share vertices between index lists): about
  0.5 MB a dressed character here. A mesh with more than 65,535 vertices is masked in place.
- Masks are a bit per triangle per pair of parts: 85 KB of JSON for 32 parts. A catalogue of
  hundreds wants them packed or made on demand.
- Loose cloth with both sides costs its triangles twice: the long robe is 8,460.
- Nothing simulates: a skirt follows the legs and does not swing after them.
- One body. A garment is built for the shape it was offset from; another build of body needs the
  catalogue built again (a few seconds a part), not refitted.

## Checks

- Measure one, 153 poses (four game clips and the extreme poses): of 3,189 skin vertices still
  drawn under the 31 kit-made parts none is through at 1 mm; of 91 overlapping pairs of kit-made
  parts one fails (a high collar under long hair, 2.5 mm) and is kept apart. Eight more pairs are
  kept apart by their cut and not by the measure (a belt under a top that hangs over it, a bun
  under a conical hat, long hair where a pack is).
- Measure two, 26 directions by 41 poses for each of the 32 parts alone and 24 sampled outfits:
  worst view seen through 0.89 cm², worst covered surface showing 0.78 cm².
- Measure three, at rest: none of the body's vertices stands out of the loose cloth of the 17
  parts that hang round it; nothing worn with the hat or the pack stands through them (22 pairs).
- Against reality (`npm run measure` in the game): the body's 13 girths are within 6 % of ASTM
  D5585 size 8; 19 of 22 measurements of the T-shirt, trousers, skirts, hat and pack are inside
  the ranges real ones are made in. Outside: the T-shirt's hem is 1.14 of its chest round (real
  0.9 to 1.05) and both skirts have 13.3 cm of ease at the hips (real 4 to 10).
- The counter-example: a top made the naive way by another script (the body's surface pushed out
  16 mm, weights copied, edges open) is measured the same: 21 vertices through, up to 8.5 mm, and
  150 cm² seen through at its open edges. It is listed as not passing and marked in the game.
- In the browser, with real clicks: the triangles hidden on the loaded meshes are the ones the
  masks name (read back from ten meshes and compared with the files); pictures of a shirt, trousers,
  boots and belt with arms overhead, crouched and kicking, and of skirts and a robe in the same
  (`games/zhuda-wardrobe/docs/evidence/hands.jpg`, `outfits.png`).
- The game's tests read both reports and fail if a kit-made part does not pass or was rebuilt
  without being measured.

## Not checked

- How it looks to a person. The garments are plain: no folds, seams, buttons or texture, collars
  are rough, the figure is thin. "Nothing comes through" is measured; "looks good" is not.
- A phone or a GPU. The pictures are software WebGL and a rasteriser written for the measure.
- Animations other than this body's five clips: a clip that bends further than the extreme poses
  is outside what was measured. Add its poses to the measure before using it.
- Garments from a modelling program, measured as made by hand: none was available. The one foreign
  part is a script's.
- Self-crossing of cloth where creases close (an armpit, the back of a knee): the cloth there
  folds into itself as the skin does; it is counted (`foldedCm2`) and not judged.
- Whether hard objects overlap each other at rest (a bun inside a hat): looked at, not measured.
- Other body shapes, and more than one character on screen.

## Boundaries

The engine hides triangles and binds parts. What a garment is, how it is made, what counts as
coming through and which parts may be worn together belong to the game and its tools. The
numbers are this body's and these clips'; another body or another set of animations is measured
again.
