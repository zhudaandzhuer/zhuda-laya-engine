# Route: A low-poly rigged character from shapes, with idles that cross-fade

The result is a glTF character of at most 3,000 triangles, one mesh with one material (one draw
call) and three 512×512 textures baked from the true shape, with 20 bones and a few looping clips
that cross-fade into one another through LayaAir's Animator. There is no modelling program and no
artist: the figure is made in Node by "shapes hung on bones", and changing a number makes it
again. The reference is the "cocky stickman" (囂張小黑人), made for a colleague. It was checked
playing in the engine in headless desktop Chrome; not on a phone.

- **Id:** `low-poly-character-from-shapes`
- **Kind:** workflow
- **For:** Making, from one reference picture, a low-poly, rigged, chibi-style character GLB whose
  clips cross-fade into one another (for the Zhuda engine or for plain LayaAir 3)
- **Checked on:** headless desktop Chrome (LayaAir 3.4.2 inside Zhuda engine `def94aa`, renderer
  `auto`); the build and its tests in Node in this repository on 2026-11-26; no phone; never
  imported into the LayaAir IDE
- **Status:** the cocky stickman as it stands on 2026-11-26: 2,994 triangles (699 of them the two
  hands), one material with three 512×512 textures (base colour with the face painted in, normal,
  occlusion), 20 bones, two idles of 4 s and 3.2 s; rebuilt in this repository on 2026-11-26 (two
  runs give the same file) with `zhuda-engine-prefabs/tests/stickman.test.mjs` passing 10 of 10; overlap with
  the three-view turnaround 0.892 (front) / 0.936 (side), after the hands, feet and armpits were
  changed on purpose toward a generated high-poly model; 0 errors and 0 warnings from the Khronos
  validator; played in the engine with a continuous cross-fade and idles that take turns by
  themselves (read frame by frame on 2026-11-25, before those last changes); made for a
  colleague, who reviewed it in two rounds
- **Reference consumer:** this repository, `zhuda-engine-prefabs/3d/stickman/` (`source/stickman-def.mjs`,
  `source/build.mjs`, `source/bake.mjs`, `source/face/`, `stickman.ts`) and the viewer's
  `zhuda-engine-prefabs/viewer3d/src/presets/stickman.ts`
- **Engine version:** zhuda-laya-engine 1.18.0, `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`, for the
  run in the browser; the model was rebuilt and its tests run in this repository (2.0.0) on
  2026-11-26

## When to take this route

- You want a character of simple, rounded form (a chibi figure, a monster, a mascot) under a hard
  limit of triangles, and nobody can make it in Blender.
- You want a few clips that pass into one another (idles taking turns, changes of stance).
- It does not fit a character that needs a realistic face, folds in its clothes or painted detail
  in its textures (that is [rigged-phone-character](rigged-phone-character.md), whose surface is
  textured from picture tiles; the textures here hold one flat colour, a face mask and the shape's
  own normals and occlusion); if someone hands you a Blender file take
  [model-from-dcc](model-from-dcc.md).

## Tools

- The character kit: `games/tools/characters/` in this repository (`kit.mjs` for shapes and
  skinning, `rig` from `humanoid.mjs`, `poser` with its two-bone IK from `hero-kit.mjs`,
  `rig-glb.mjs` to write the GLB, `raster.mjs` to draw in software). The stickman's tools import
  the kit from there. Two small things in the kit were added for it: `writeRiggedGlb` in
  `rig-glb.mjs` also takes `sampler` (how the textures are sampled) and `generator`; `raster.mjs`
  has `pngBytes()` (`writePng` calls it).
- The engine's `createZhudaSdfField` and `createZhudaIsosurfaceMesh` (import `zhuda-laya-engine`
  directly in Node); `meshoptimizer` 1.3.0 and `pngjs` 7.0.0 (already installed: this repository
  depends on them).
- The turnaround: the image command of the owner's `zhuda-windows` agent skill (not in this
  repository), with gpt-image-2.6 `flare`; it spends the owner's image quota, and 2 pictures take
  about 20 seconds. An example batch file:
  `zhuda-engine-prefabs/3d/stickman/source/turnaround/turnaround-batch.json`.
- The face: `zhuda-engine-prefabs/3d/stickman/source/face/face-mask.png`, taken by
  `source/face/extract-face.mjs` from the head of a 50,000-triangle model that Hunyuan 3D (an
  outside image-to-3D tool) generated from the turnaround. The mask is in this repository; that
  model is not.
- Validation: Khronos `gltf-validator`. The run used a copy that is not in this repository: the one
  in the `node_modules` of `games/jiuye-seal-pact`, a game left on the verification repository's
  old review branch (see `docs/plans/records/repo-unification/left-behind.md`), used read-only by
  `require(<absolute path>)`. The viewer's `zhuda-engine-prefabs/viewer3d/tools/play.mjs` (real time) and
  `zhuda-engine-prefabs/tools/detplay.mjs` (virtual clock, for recording); ffmpeg.

## Steps

1. **Generate a three-view turnaround first, then measure from it.** Do not work by feel from one
   reference picture at an oblique angle (the stickman was made by feel three times, and wrong
   each time). With the image command above, generate from the reference picture a turnaround of
   "front / side (a true profile facing left) / back, orthographic, the same scale, feet on one
   line, arms in an A, pure white background" (16:9; make two and pick one). Then measure the
   silhouette's width row by row (dark pixels) and convert to metres (the pixels from sole to crown
   ÷ the height you want): the head's radius, the neck, chest width / hip width / body depth, the
   height of the crotch, the height of the shoulders, the angle of the arms away from the body, the
   length from shoulder to wrist, the thickness of the legs, the width and length of the feet; the
   boxes of the whites of the eyes (bright) and of the mouth (red) give the place of the face. The
   stickman's turnaround (`source/turnaround/01-turnaround.png`, its height taken as 1.2 m)
   measured: head radius 0.18; the body a long cylinder that widens slightly downward (chest 0.17 →
   hips 0.21, depth 0.13); crotch at 0.47; shoulders at 0.78; upper arm 33° away from the body
   and forearm 26°; shoulder to wrist 0.30; eyes about 4 cm below the centre of the head, mouth
   about 13 cm below it.
2. **The skeleton.** Write an object of the same shape as `heroRig` (`P` joint positions, `joints`,
   `R = rig(joints)`, `bind`, `lengths`) and `poser()` works on it directly. 20 bones
   (`root hips spine chest neck head` plus left and right `clav arm fore hand thigh shin foot`);
   the bind pose has the arms in an A and no bone rotated (the rotations in a pose are all about
   world axes).
3. **Shapes.** `E` (ellipsoid) and `C` (cone) hung on bones; write the left side once and `both()`
   mirrors it to the right; `blend` is the fillet; `flatten` presses a round tube into an ellipse
   (the body front to back, the legs side to side). A last, large ellipsoid with `subtract` cuts
   the soles flat. **The body with the hands is one continuous surface** (no line of intersection
   at the wrist: two meshes pushed into each other have an intersection line that turns into saw
   teeth at a low triangle count); **the head is a surface of its own** (a geodesic sphere)
   sitting on sloping shoulders.
4. **The mesh.** The body (with the hands): `meshOf(shapes, 3 mm)` → **simplify in two passes**
   (`vertex_lock` of `simplifyWithAttributes`): first lock the hands and simplify only the body,
   then lock the body and simplify only the hands (the hands' normal weight raised to 2, so that
   triangles stay at the fingertips and between the fingers). The first pass also takes triangles
   off the edge of the hands, so measure how many really remain and simplify again if that is not
   enough. **After simplifying, relax the surface** (`relaxOnSurface` in `source/surface.mjs`, 15
   rounds: a vertex moves along the surface toward the middle of its neighbours and is then put
   back on the surface of the distance field); otherwise the triangles are of uneven size and the
   outline of thin arms and legs is uneven from one stretch to the next. **The fingers are not
   relaxed** (`fixed` is given only the shapes of the fingers and thumbs; if the whole hand is
   left unrelaxed, a ring of steps appears at the wrist). **If the head is a round sphere, do not
   simplify an isosurface for it**: compute a geodesic sphere directly (each face of an
   icosahedron divided f×f, `20·f²` triangles of the same size; f = 5 is 500 triangles), with
   every vertex on the sphere and the sphere's normals as its normals. The stickman (`BUDGET` in
   the definition): the body's surface 2,494, of which the two hands were given 700 and kept 699;
   the head 500; 2,994 in all, under the limit of 3,000. The face takes no triangles (step 6).
5. **Lay it back over the turnaround, and measure part by part.** Draw the bind pose (the arms' A
   at the same angle as the turnaround's) as a silhouette in orthographic projection, lay it over
   the turnaround's front and side views and compute the overlap (intersection ÷ union), marking
   where the model has too little (blue) and too much (red) (`source/compare-turnaround.mjs`).
   **A high overlap does not mean the shape is right** (at 0.91 the shoulders were still
   coat-hanger shoulders and the hands still flat slabs): then use `source/measure-parts.mjs`,
   which prints for both sides, one row every 5 cm, the body's width, the inner and outer edges of
   the arms and the front and back edges in profile; change row by row until the difference is
   within 0.5 cm. Look at pictures through a nearly orthographic camera at the same scale (the
   viewer's `?bind=1&fov=8` with the camera far back, `S.set({ distance: 9 })`) set above and
   below the turnaround, and enlarge the details (hands, shoulders, crotch) side by side as well.
   The stickman now stands at 0.892 (front) / 0.936 (side): its hands, feet and armpits were
   afterwards changed on purpose away from the turnaround (see **Pitfalls**), which lowered the
   overlap. Row by row, the head and the body and legs from 0.65 m down are within 0.5 cm (0.6 cm
   at the foot); the shoulders at 0.70–0.85 m are 0.7–0.8 cm narrower and the arms and hands 1–2 cm
   nearer the body.
6. **The face is painted into the base-colour texture.** The head is a sphere, so a face is a
   picture looked up by direction from the centre of the head. `source/face/face-mask.png` holds
   it: red is the whites of the eyes and green the mouth, with anti-aliased edges, one cell every
   0.25°, yaw −75° to 75° and pitch −65° to 40° (`FACE_MASK` in the definition).
   `source/face/extract-face.mjs` took it from the head of the generated high-poly model: it fits
   a sphere to that head, sends a ray out from the centre in every direction, and sorts the base
   colour where the ray hits into the two channels. When the textures are baked (step 7), every
   texel on the head looks the mask up by its own direction (bilinear) and mixes the eye colour
   `#ececea` and the mouth colour `#d8462e` over the body colour. The face takes no triangles. The
   head's charts grow outward from the front of the face, so that no seam between charts cuts
   through an eye, and the face's area gets 3.5 times the usual texel density (the rest of the
   head 0.4 times).
7. **One material, three baked textures on one UV set.** `unwrap`, `tangentsOf` and `bakeMaps` in
   `source/bake.mjs`; the build needs only Node.
   - **Unwrap.** Neighbouring triangles whose normals are within 55° of the first triangle's grow
     into a chart; the chart is projected onto the plane across that normal, turned to its
     smallest bounding box and packed in rows, 8 texels apart. A triangle that would lie over
     another in its chart, or that lands close to another in the plane while far from it in space
     (the side of the body and the front of the upper arm, 9 cm apart), is moved to another chart.
     Texel density: 3.2 times at the hands, 3.5 at the face, 0.4 on the rest of the head, 1
     elsewhere. The stickman: 111 charts, 198.8 texels a metre, no texel inside two triangles
     that are not neighbours (`overlapTexels` 0 in the build report).
   - **Bake.** For every texel: its point on the low mesh, then along the low mesh's normal to the
     surface of the distance field; the field's normal there, taken into the low mesh's tangent
     space, is the normal map. Occlusion is read from the distance field outward from the low
     mesh's point along its normal, at two scales (6 mm for the gaps between the fingers, 25 mm
     for the armpits and the crotch; strength 0.75). The base colour is the body's one colour,
     with the face on the head (step 6). Empty texels are filled outward from their neighbours (16
     rounds). The normal map acts only at the hands (in full within 1 cm of the hand shapes, not
     at all beyond 3 cm), and its tilt is capped at 80°.
   - **The file.** Three PNGs of 512×512 (`BUDGET.texture`; with the hands at 3.2 times the
     density, 512 could not be told from 1,024): base colour 4,989 bytes, normal 71,755, occlusion
     71,750, in a GLB of 418,764 bytes. All three use the one UV set (the reason given in
     `build.mjs`: LayaAir 3.4.2's glTF reader takes `texCoord` 0 only), sampled linearly with
     mipmaps and clamped (`sampler` of `writeRiggedGlb`). No vertex colours (LayaAir reads
     `COLOR_0` in a different colour space; see SCN-16 in the verification records).
   - **Colour and roughness.** The body is a neutral charcoal `#404040` at roughness 0.75
     (`COLOURS`, `ROUGHNESS` in the definition). Measure the reference picture before setting
     them, and compare under the same light as the reference: in the viewer's studio look
     (`?look=studio`, the default) the body measured `#373838` on average, `#303131` in shade and
     `#414141` in light, against the turnaround's `#363635`, `#2b2b2b` and `#414040`. In the end
     go by the owner's eye: shoot several base colours and roughnesses side by side in the same
     scene for the owner to choose from
     (`STICKMAN_OUT=<another file> STICKMAN_ROUGHNESS=<n> STICKMAN_BODY=<#rrggbb> node 3d/stickman/source/build.mjs`
     writes a trial elsewhere and leaves `assets/` and the report alone). In the viewer `?maps=0`
     turns the normal and occlusion maps off on the same model; `?maps=normal` and
     `?maps=occlusion` keep one.
8. **Skin part by part.** Do not weight every bone together by the nearest shape (in the bind pose
   the arm is only a few centimetres from the waist: weighted that way, the body between 0.56 and
   0.74 m takes up to 26–37% arm weight in the build report, and the waist was pulled out into a
   lump with the hands on the hips). First see which part a vertex is nearest to (the body, the
   left and right arms, the left and right legs, the left and right feet, the left and right
   hands, each by the distance field of its own shapes); parts blend only within 1.5 cm (between
   an arm and the body 0.6 cm below the shoulder joint, so that the arm does not pull a web of
   flesh out of the armpit, and 2 cm above it); the body is shared out smoothly by height among
   hips / spine / chest / neck / head; arms and legs hand over between two bones by position
   along the chain of joints (elbow ±4.5 cm, knee ±3 cm); the top of the leg, where it enters the
   pelvis, mostly follows the pelvis. The head follows `head` 100%; a hand uses the "forearm +
   hand" shapes with a falloff of 0.015 m. The build report records the arm weight the body
   receives at each height, old against new: now 0 up to 0.62 m, 0.01 at 0.62–0.68 m and 0.124 in
   the armpit band, 0.68–0.74 m.
9. **Clips are pose functions.** `pose(t)` returns a quaternion for every bone and a `$root`
   translation. The feet are pinned in place by the two-bone IK of `poser().stand()` (for a foot
   that taps the beat, the ankle's position is computed with the heel as the pivot); the hands are
   put by `armTo` at points relative to the spine or the chest, and `handFrame` sets the hand's
   direction. Everything that changes with time must be equal at `t = 0` and at `t = the clip's
   seconds` (`ease` in and out, `bump`, sines of a whole number of turns).
10. **So that clips can cross-fade:** every clip writes the rotation of every bone and the root
    bone's translation (the sampling in `build.mjs` does not skip bones that did not move); the
    clips' feet stand in the same place; the quaternions keep the same sign from frame to frame.
11. **Write the file and the report.** `writeRiggedGlb` → `assets/stickman.glb`, in about 3
    seconds; two runs give the same file. `source/build-report.json` records the triangles by
    part and at the hands, the textures (charts, texels a metre, overlapping texels, steepest
    baked normal), how far the mesh lies from the true surface (now at most 15.3 mm inside it and
    7.8 mm outside), the arm weight on the body, the head's roundness (a triangle's centre at
    most 2.06 mm inside the sphere), and for each clip whether the feet slide (computed with
    `R.place`; left ankle and right heel 0 mm) and the loop seam (0). When the model changes,
    update `STICKMAN` in `stickman.ts` (triangles, height): a test compares it with the file and
    the report.
12. **Use it in the engine.** Load it with `ZhudaModelLibrary.instantiate(stickmanPath())` (after
    a sync the file is at `common/3d/stickman/assets/stickman.glb`) and set
    `clip.islooping = true` on both clips. On engine 2.0.0 the clips cross-fade as they are; on
    an engine before 2.0.0, or in plain LayaAir 3, first call `repairGltfCrossFade(animator)`,
    once after loading and before the first cross-fade (see **Engine gaps** below). Change clip
    with `animator.crossFade(name, seconds / the seconds of the clip now playing, 0, 0)`
    (LayaAir's transition length is a proportion, not seconds; `fadeShare` in the reference). The
    idles take turns through `StickmanIdles`: a clip plays 2 or 3 whole rounds and, at the end of
    a round, cross-fades to the other over 0.35 s.
13. **The prefab library's formalities.** Register it in `catalog.json`, write tests, add a preset
    to the viewer, `sync`, `npm run verify` on both sides, shoot `preview/`.

## Pitfalls

Entries marked "earlier attempt" describe what was tried and given up; their numbers are not the
model's present ones.

- **Working by feel from the reference picture: three versions, each the wrong shape (earlier
  attempts).** The first was a thin, long stick figure (small head, thin limbs, glossy black); the
  owner said it was not round and cute. The second became chibi but with the limbs too short. The
  third lengthened the limbs and added fingers, and the owner still said the shape was wrong. The
  reference was one screenshot at an oblique angle, in mid-run, from which the true proportions
  cannot be measured. With a turnaround generated first by gpt-image-2.6, sizes measured from its
  silhouette, and the result laid back over it for the overlap (steps 1 and 5), it matched at the
  first attempt. **Make the turnaround before anything else.**
- **Matching the turnaround was not the end (2026-11-26).** A 50,000-triangle model that Hunyuan
  3D generated from the same turnaround was the one the colleague called "like it"; what differed
  was named as "the thickness of the fingers, the thickness of the feet, and a little something
  extra in the armpit". The hands, feet and armpits were changed toward it, all in
  `source/stickman-def.mjs`: the hands 20% wider and thicker but only 7% longer along the fingers,
  and the fingers 12% thicker again; the top of the body narrowed (radius 0.071), the shoulder
  joint moved in to x = 0.09 and the fillet between arm and body cut to 0.3 cm, so that arm and
  body part at 0.72 m as on that model; the upper arm left at 0.034 (thicker, and it fuses with
  the body) and the forearm thickened to 0.036; the shins hardly tapering; the feet flat-soled, a
  little wider, with low toes. `source/measure-pair.mjs <ours.glb> <the other.glb>` compares two
  models' thickness height by height. The overlap with the turnaround fell to 0.892 / 0.936 for
  it, which was expected (narrower shoulders, larger hands).
- **The head was not round enough, and the neck showed.** With the head an isosurface mesh
  simplified to 680 triangles (an earlier attempt), the triangles were of uneven size and the
  ellipsoid's radii differed by 2%; the owner asked at a glance "is the head round enough?". It
  became a true sphere with a geodesic mesh (step 4). Then the owner wanted it "big enough that
  the neck cannot be seen": it was first enlarged to 0.195, then set lower (earlier attempts), and
  both were further from the turnaround. Now the head is as large and as high as in the turnaround
  (radius 0.18, centre at 1.016 m) and the neck is hidden by **sloping shoulders**: the shoulders
  slope down as soon as they leave the lower edge of the head, so no length of tube shows between
  head and shoulders.
- **Taking the reference picture for matt (earlier attempt).** With roughness 0.86 the highlight
  on top of the head was gone altogether. The reference's head measured 111 at the bright top and
  42 at the chin; ours 52 and 14. At 0.45 the top was 87; the dark chin is a matter of the scene
  (the reference stands on bright sand, which reflects light upward), and the viewer was given a
  ground reflection.
- **The gloss was overdone, and light was added too.** 0.45 with brightened ambient light and a
  ground reflection was called too bright; then `#1e1e22` at 0.5 under the sky's own light only
  ("keep it black, a black with some texture to it") was much blacker than the turnaround and
  bluish; `#313136` at 0.62 was tried too (earlier attempts). Finally "a colour like the
  turnaround's" was wanted. Colour = material × light: colours must be compared under the same
  light. The viewer gained a studio mode (`?look=studio`: a plain background with
  `atmosphere: false`, strong neutral ambient light, a weak sun, no vignette and no grain);
  measure the body there and match the turnaround (the present `#404040` at roughness 0.75, step
  7). Outdoor light (`?look=outdoor`) stays, to see how it looks in a game: under a strong sun the
  figure looks blacker, and that is the scene's light.
- **A lumpy body, and more visible once it was glossy.** The body was simplified automatically
  from 78,000 triangles to 1,650 (an earlier attempt), with triangles of uneven size and up to
  7.5 mm off the surface. "Regular rings per part" was tried and given up (arms, legs and body
  each a tube of ring after ring, cast onto the surface by rays): the tubes themselves were
  smooth, but junctions such as the crotch and the shoulders had problems however they were cut:
  the body's rings running into the arm grew "wings" at the shoulder, and body and legs gave saw
  teeth or an underwear line at the crotch. In the end "one continuous surface plus surface
  relaxation" (step 4) was used, which is smooth at junctions by nature.
- **A bulge at the waist (the colleague's review).** Two causes: the pelvis ellipsoid was widest
  above the crotch and pushed the body into a pear shape; and the skinning gave the waist arm
  weight (step 8). The body is now one straight-sided conical column, wider downward (radius
  0.071 at the top, 0.098 at the bottom) and flattened front to back
  (`flatten: { axis: [0, 0, 1], factor: 0.83 }`), with a flat ellipsoid under it for the hips.
- **Hands on hips looked like an old man (the colleague's review).** Hands low and toward the
  back, elbows drawn back, the upper body leaning back, knees slightly bent = holding one's back
  and stretching. A cocky hands-on-hips: the upper body upright, the chest pushed a little
  forward, the palms clasped on the sides of the waist toward the front (the hands follow
  `spine`), the elbows braced out to the sides and slightly down (an elbow tipped up lifts the
  upper arm too far and the skin hunches the shoulder), the weight on one foot. When shifting or
  raising the pelvis, watch whether the legs are long enough: if they are not, the IK is pulled
  to its limit and the foot slides (a test caught the right heel sliding 0.96 mm; sinking the body
  6 mm more cured it).
- **Too many triangles in the hands (the colleague's review).** The two hands first took 460
  triangles (15%) but are small on screen; they became simple glove hands (three fingers and a
  thumb) of 130 each, and the saving went to the body (earlier attempts). Later, against the
  turnaround, the hands were where it differed most (the turnaround has large gloves of four
  thick fingers and a thick thumb), and they became large gloves with more triangles again; the
  two now have 699. The count is set by "the fewest that match the reference picture", not by
  fewer being better.
- **A body made to the turnaround was still too human (the colleague: "the body should have none
  of a person's highs and lows; a hand run over it feels one flat surface").** A stickman's body
  is a straight-sided column, its arms and legs tubes of nearly even thickness, and the outside
  of the legs flush with the sides of the body: no chest, waist, pelvis, buttocks or shoulder
  caps. Use `measure-contour.mjs` to measure whether the silhouette's outer edge bulges or dips.
- **A web of flesh grew in the armpit.** The fillet between arm and body was too large (3.5 cm,
  an earlier attempt): the space between the A-pose arm and the body in the bind pose was filled
  in as a web, the skinning made the armpit follow the arm, and with the hands on the hips it was
  pulled into a bat's wing. The stickman's upper arm now meets the body with a fillet of 0.3 cm
  (`blend: 0.003`), and below the shoulder joint the skin between the two blends only within
  0.6 cm.
- **The junction of arm and body was ugly with the hands on the hips.** Compare with the
  turnaround in the same pose using `?bind=1` (stopped in the bind pose), to tell whether it is
  the pose or the shape. A long arm clasping the waist must push the elbow up (the distance from
  shoulder to wrist is fixed, so the elbow's height is fixed; the pole decides only which way it
  sticks out): either accept it or put the hands lower. In shape, the top of the body narrows into
  sloping shoulders and the shoulder joint moves inward and down. In skinning, the blend range is
  widened above the shoulder joint (2 cm, so that the top of the shoulder follows the arm) and
  kept small below it (0.6 cm, so that no flesh grows in the armpit).
- **The fingers were simplified away.** With the whole body simplified together, the simplifier
  keeps its triangles for large areas: of 2,000 triangles the hand was left as one pointed flake,
  and raising the normal weight near the hands six times did not keep four fingers either. A hand
  as a mesh of its own works, but the intersection line at the wrist is saw teeth at a low
  triangle count. In the end: the same surface, simplified in two passes (step 4), the hands at a
  fixed count, normal weight 2, and no surface relaxation on the fingers (relaxation lets the
  vertices between the fingers slide across, and four fingers stick together in one lump). First
  build a test bench with only the hand (isosurface → simplify to N triangles → three pictures:
  front, side and oblique) and try weights, counts and whether to relax there; it is much faster
  than trying in the whole model. Enlarge the hand in the software render to look at it
  (`node-hand.png` from `build.mjs --preview`).
- **To keep the fingers apart at a low triangle count they were made thin and spread, and then
  did not look like the reference picture (earlier attempt).** The reference has a glove with fat
  fingers held together and curled toward the palm. Fat fingers held together are kept just as
  well by the change of normal in the gaps between them (the normal weight); at about 200
  triangles a hand the fingertips close to points, and only at 300 are they round (the stickman
  now gives the two hands 700). Get the shape right by the reference picture first and then find
  the fewest triangles; do not change the shape for the sake of the count.
- **Saying "it matches" from side-by-side pictures through a perspective camera at different
  scales, and being told by the owner "not compared carefully, the gap is still large".**
  Perspective makes the head larger and the feet smaller, and at different scales nothing can be
  compared place by place; an overlap of 0.91 also hid coat-hanger shoulders, an angle at the
  elbow, a crotch 4 cm too low and a flat slab of a hand. A comparison must be at the same scale,
  nearly orthographic, and measured height by height (step 5).
- **An extra sphere at a knee or elbow bulges in a ring instead.** The end of a cone is already a
  sphere, and two cones of the same radius join smoothly; one more sphere of the same radius adds
  volume through the fillet (smooth min). Do not add one.
- **A thin dark streak baked onto the front of the upper arm (2026-11-26).** Two causes, both
  mended in `source/bake.mjs`. Triangles far apart in space lay next to each other in one chart
  (the side of the body and the front of the upper arm face nearly the same way), so sampling and
  the filling of edges carried the armpit's dark across: such triangles now go to another chart.
  And texels were filled in one pass, so that a thin triangle handled first took, through its
  margin outside its edges, texels that lie inside its neighbour: now there are two passes, first
  the texels whose centre is inside a triangle, then the margin of 1.5 texels outside its edges.
- **Baked maps: seams, tilted normals, white dots.** A normal map over the whole body shows a
  faint seam between charts on a dark surface (the tangents differ on the two sides): the low
  mesh's own normals already come from the true shape, so the map acts only at the hands. In the
  gap between two fingers a low triangle spans the gap and the walk along its normal ends on the
  side of a finger, with a normal almost at right angles to it: keep its direction and cap the
  tilt at 80°. Occlusion sampled from the point reached on the true surface jumps from texel to
  texel in narrow gaps (white dots): sample it from the low mesh's point along the low mesh's
  normal, which are continuous across charts.
- **The face as geometry on a swatch texture (earlier attempt, 2026-11-25).** The eyes and the
  mouth were patches floating 2.5 mm above the head's sphere (an angry eye: an ellipse with its
  upper half cut off by a slanting line, its outline resampled along its perimeter so that a
  straight edge has points along its middle and does not sink into the head, triangulated in
  three rings; the mouth a crescent), 164 triangles in all, on a 32×32 swatch PNG sampled NEAREST
  without mipmaps. It gave no shading between the fingers or in the armpits, and the face's
  triangles were wanted for the hands: the face went into the base-colour texture (step 6) and
  the maps were baked (step 7). That path is still in `build.mjs` behind `STICKMAN_MAPS=0`; it was
  not run with the present budgets.
- **Light from behind: the front all black, and the whites of the eyes blue.** The viewer borrowed
  the sky of `day-look`, whose morning sun is behind the character. A character preview needs the
  sun in front of the character (`azimuthDeg` 0 is light travelling toward −Z, lighting a front
  that faces +Z) and an ambient light changed to a grey with no blue cast.
- **TypeScript constructor parameter properties cannot be used in a node test.** Node's type
  stripping does not support `constructor(private readonly x)`; use ordinary fields.
- **Screenshots in real time cannot be made into a video.** Every screenshot of `play.mjs` takes
  over a thousand milliseconds while the scene's clock keeps running, so the recording has less
  than one frame a second. Record with `zhuda-engine-prefabs/tools/detplay.mjs` (a virtual clock;
  `STEP_MS=33.33` is a fixed 1/30 s per step, `VIEWPORT=720x720`, query `scene=stickman&auto=0`).
- **In the viewer's scenario, changing clip with a `fade` makes the hands jump to the bind pose.**
  `S.set({ clip, fade })` changes clip once and then cross-fades once more in the same frame. It
  is the viewer script's doing, not the model's: change clip with `S.set({ clip })` alone.
- **A cross-fade that looks like "the arms drop first, then it snaps into place" (a defect of
  LayaAir 3.4.2, closed in engine 2.0.0; it was first found by an analysis from another model,
  Gemini, that the owner passed on, after the agent building the stickman had misjudged it as a
  problem of the interpolation itself).** `laya.gltf.js` fills a clip's `_nodesDic` as "path →
  path string" (for `.lani` it is "path → node"), `Animator.crossFade` cannot find the target's
  node index from a string, and so during the transition it blends toward the bind pose and jumps
  to the target only on the last frame (measured: a jump of 35 cm in one frame). What to do on an
  engine before 2.0.0 or in plain LayaAir 3 is under **Engine gaps** below; the viewer's
  `?repair=0` leaves the correction out. **To judge whether a cross-fade is right, do not guess
  from a video: read the bones' positions frame by frame** (the viewer's `S.bones()`, recorded
  once every `requestAnimationFrame`) and see whether any frame jumps far and whether the bind
  pose is passed through on the way.

## Engine gaps and their workarounds

- **Closed in 2.0.0: reading glTF clips, LayaAir 3.4.2 cross-faded toward the bind pose.**
  `laya.gltf.js` fills `_nodesDic[path] = path` (a string); `Animator.crossFade` needs the node
  (the `.lani` reader fills `_nodesDic[path] = node`), and the Zhuda engine's own code that adds
  morph clips copied the string form, so `ZhudaModelInspector.crossFade` was wrong for glTF models
  in the same way. Since 2.0.0 the engine's glTF adapter files the nodes when it makes a clip
  (`indexLaya342ClipNodes` in `packages/core/runtime3d/Laya342GltfAdapter.ts`,
  [animation control](../animation-control.md)). On an engine before 2.0.0, or in plain LayaAir 3,
  call `repairGltfCrossFade(animator)` (`zhuda-engine-prefabs/3d/stickman/stickman.ts`) after loading; on 2.0.0
  it finds nothing to change and may stay.
- glTF has no loop flag, and a clip read by LayaAir does not necessarily loop by default: set
  `clip.islooping = true` yourself after loading.
- LayaAir's `crossFade` takes a proportion, not seconds: use `fadeShare()` (the engine's
  `ZhudaModelInspector.crossFade(path, name, { seconds })` also converts it for you).
- The engine has no tool that previews a GLB in Node: light it yourself with the character kit's
  `raster.mjs` (`build.mjs --preview`), and in the end always look at it in the viewer, drawn by
  the engine.
- The engine has no UV unwrapping and no baking of maps from a distance field: the stickman's
  own `source/bake.mjs` does both in Node (`unwrap`, `tangentsOf`, `bakeMaps`).

## Checks

The commands are written for this repository's `zhuda-engine-prefabs/`.

```sh
cd prefabs
node 3d/stickman/source/build.mjs --preview /tmp/x          # rewrites assets/stickman.glb and the report: 2994 triangles (hands 699, head 500); foot drift 0 mm; armWeightOnBody 0 up to 0.62 m
node 3d/stickman/source/compare-turnaround.mjs               # overlap with the turnaround: front 0.892, side 0.936 (rewrites source/turnaround/compare.png unless given another path)
node 3d/stickman/source/measure-parts.mjs                    # table of widths by height, turnaround beside model
node --test tests/stickman.test.mjs                           # 10 tests
npm run verify                                                # type check and the library's tests, 169 in all
cd viewer3d && npm run verify                                 # sync, build, types, Doctor, 3 tests
node tools/play.mjs scenarios/stickman.json "scene=stickman&auto=0"
```

From the repository's root, `npm run verify:library` runs the library's and both viewers' checks.

Checked on 2026-11-26 in this repository: `build.mjs` run twice gives the same `stickman.glb`,
which differs from the file built in the workspace only in its `asset.generator` label (geometry,
skin, clips and textures are byte for byte the same); `tests/stickman.test.mjs` passes 10 of 10
(one mesh, one primitive, one material with the three maps on `texCoord` 0, unit tangents, no
overlapping charts, at most 3,000 triangles, every clip turning every joint, loops closing, feet
in place, `fadeShare`, `StickmanIdles`, `repairGltfCrossFade`); the library's tests are 169 in
all; `compare-turnaround.mjs` gives 0.892 / 0.936 and `measure-parts.mjs` the rows given in step
5. The build report: 1 mesh, 1 material, 2,994 triangles, 2,413 vertices, two clips of 4 s and
3.2 s, loop seams 0, left ankle and right heel 0 mm. The Khronos validator gave 0 errors and 0
warnings on the workspace's build of 2026-11-26.

From 2026-11-25, in the viewer on engine 1.18.0 and on the model before the changes of 2026-11-26:
the viewer's verify (build, types, Doctor HEALTHY, 3 tests); the scenario read the cross-fade
frame by frame at the hand's position in both directions, at most 1.7 cm a frame and continuous
throughout; the idles changed clip by themselves; no draw errors. The previews and the cross-fade
video in `preview/` were shot again from the model of 2026-11-26.

## Not checked

- Phones (frame time, memory).
- Import into the LayaAir IDE, and LayaAir projects other than the Zhuda engine.
- The picture on WebGL and on WebGPU separately.
- The frame-by-frame reading of the cross-fade on the model of 2026-11-26 (the 1.7 cm is the
  model of 2026-11-25).
- What the normal and occlusion maps do to the picture: nothing measures it; the viewer's
  `?maps=0`, `?maps=normal` and `?maps=occlusion` switch them on the same model for a comparison
  by eye.
- Clips that travel, such as walking and running (only idles on the spot were made); the fingers
  cannot move one by one (there are no finger bones).
- Large turns of the head (over about 40°), where the junction of the head's sphere with the body
  may show.
- The number of draw calls with several characters in one scene (only one was measured).
- The trial paths in `build.mjs` that take someone else's high-poly model as the source of the
  shape (`STICKMAN_SOURCE`, `STICKMAN_SOURCE_KEEP`), and the swatch path (`STICKMAN_MAPS=0`).

## Boundaries

- A character's definition, the way it is made, its model and its helper code go in
  `zhuda-engine-prefabs/3d/<name>/`; a game takes them with `sync.mjs`.
- The character kit itself is `games/tools/characters/` in this repository; the stickman's tools
  import it from there.
- The Animator, glTF reading and the cross-fade are the engine's (LayaAir's); do not write your
  own clip blending in a game.
