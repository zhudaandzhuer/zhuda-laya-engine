# Verification record: procedural-hand

Task document: `docs/plans/records/procedural-hand/task.md`\
Commit: `da15e03` (code, on top of `ed1ddbc`), pushed to GitHub `main` on the owner's word on 2026-11-15\
Date: 2026-11-15

## Environment

- macOS on Apple M4; Chrome through `scripts/lib/chrome-fixture.mjs`
  (WebGPU: "WebGPU adapter apple / metal-3"; WebGL: "ANGLE Metal Renderer:
  Apple M4").
- Node 26.12.0, npm.
- 640 x 800 CSS pixels, DPR 1, local loopback server.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Gate | `npm run verify` (build, typecheck, declarations, doctor, all tests) | PASS, 811 of 811 (first round), 813 of 813 (second round) | log outside the repository |
| Lint, format | `npm run lint`, `npm run format:check`, `git diff --check` | PASS | console |
| Unit | `node --test tests/isosurface.test.mjs tests/hand.test.mjs` | PASS, 15 of 15 (first round), 17 of 17 (second) | console |
| Draw, WebGPU | `npm run verify:hand` | PASS: no page, console, GPU or renderer error; every view covers 0.08..0.6 of the picture | `$TMPDIR/zhuda-hand/evidence/*.png`, `report.json` |
| Draw, WebGL | `HAND_RENDERER=webgl npm run verify:hand` | PASS, the same | as above |

What the unit tests measured:

- The mesher on a ball of 0.1 m at a 5 mm cell: every vertex within 0.01 mm
  of the sphere, every normal within 0.999 of the true one, every edge used
  once each way (closed, one winding), the engine's winding on more than
  99 % of the triangles (the rest are slivers of no area). The same shapes
  give the same mesh. The broad phase gives the same distance as the plain
  sum at 200 points. Above 65535 vertices the mesh is cut into chunks with
  every triangle kept.
- The hand, flat: 186.0 mm long and 79.7 mm across the knuckles' level for
  185 and 82 asked; 161.0 and within 3 mm of 74 for a smaller hand. With the
  fingers together the tips run middle, ring, index, little; the little
  tip is within 12 mm of the ring finger's end joint; the thumb's tip is
  below the index's knuckle. The skin is closed, in one chunk of about
  61 000 vertices; the palm's thinness reads below 0.3 and a finger's more
  than one and a half times that. Each nail is within 12 mm of its end bone.
  The left hand's tips are the right's mirrored exactly. A relaxed pose
  brings every fingertip more than 10 mm toward the palm.
- The nails: no edge open; 10 of about 180 000 edges are pinched (a plate
  0.6 mm thick meshed at 0.26 mm can have both its faces cross one cell).

Pictures (both backends, the same to the eye): from the back and the palm
relaxed, from the thumb's side, three quarters, from the back and the palm
flat, against a light from behind, and close to the nails, with a sheet of
all of them. They were looked at after each of five rounds of changes to the
proportions (thumb direction, joints, nails, the web, the palm's hollow);
the last round is the one recorded.

## Lifecycle and failure cases

Pure data: no load, no cancellation, no GPU owner. Refusals tested: every
option of the hand and of the shapes, a surface that reaches the box's
side, no surface, a vertex budget passed. The fixture destroys its meshes,
pipeline and materials.

## Second round (same day): creases, tendons, the field's step

Asked for: "先繼續修手" (keep fixing the hand). Changed:

- Creases cut into the skin (finger joints, where the fingers leave the
  palm, the thumb, the palm's three lines, the wrist, wrinkles over the
  middle joints), each a shallow groove that fades at its ends and darkens
  its bottom; tendons on the back of the hand; a smaller hollow and pad in
  the palm, a fuller ball of the thumb, a narrower heel on the little
  finger's side, the thumb a little less far out when flat; the default
  cell 0.9 mm (two chunks).
- `createZhudaSdfUnion`: about 450 crease capsules made the hand take
  15.7 s in Node when every point near the surface asked all of them;
  through a grid it is about 3 s.
- A step in the palm near the wrist (white specks in the picture) was traced
  to the broad phase: the ellipsoid's distance is an estimate that fell
  below its box's distance, so skipping by the box changed the field. Each
  shape's distance is now held at least at its box's; the palm's profile
  is smooth across that place, and a test asserts both the bound and that a
  field with skipping equals one without.
- A crease whose end landed on `sin(π·13/13)`, which is -3e-16 in floating
  point, made a NaN; the fade is clamped at 0.
- Palm lines stop where they run past the palm's edge instead of being
  seated by a search that started outside the body.

Checks after it: unit 17 of 17; `npm run verify:hand` on WebGPU and on
WebGL, both clean (about 6.2 to 6.6 s to make each hand in the page); the
skin at a 1.6 mm cell (one chunk) has no open edge and 10 of about 150 000
edges pinched (where fingers touch or a crease is narrower than a cell); at
the default cell the only open edges are along the cut between the two
chunks.

## Third round (same day): a man's hand and a woman's

Asked for: a finer man's hand and a fair woman's hand ("一個細緻男人的手，
和一個白皙女人的手"), then photographs of women's hands as the reference
(long straight fingers, long almond nails, fair pink skin). Changed:

- `build` options and the presets `ZHUDA_HAND_MALE`, `ZHUDA_HAND_FEMALE`,
  the pose `ZHUDA_HAND_GRACEFUL`; `length` is kept whatever the fingers'
  share of it.
- Fingers: two cones a bone with a waist by `bone`, no lumps at the joints,
  pads that stay under the finger. A measurement of the middle finger's
  width along its length showed it 1.5 mm wider where two cones met: a
  smooth union bulges there. Pieces in a line are now joined without a
  fillet; the width falls steadily from 15.4 to 10 mm (one 0.14 mm rise at a
  joint). A test pins the bulge.
- Nails: square, round or almond free edge; past the tip by `nailFree`;
  seated 0.08 mm into the skin with folds along the sides and over the root;
  white only where there is no skin under them.
- Colour: the palm's and the fingers' rules blended where they meet (a hard
  seam showed at the base of each finger); knuckle flush fading along the
  bone, not in rings; veins as a tint, the arch across the back curved and
  fainter (a straight one read as a band).
- The palm-side creases of the fingers wrap 46 to 52 degrees each way, not
  62 to 72: wrapped further they notched the outline seen from the back.
  The thumb's knuckle creases no longer wrap toward the web (they cut a dark
  hole there).
- The draw: a light grey ground, a soft key light with its shadow, the two
  hands from six views each, the fixture yielding between hands (four hands
  without a pause held the page past the driver's 20 s limit).

Checks after it: `npm run verify` 816 of 816; unit 20 of 20; `npm run verify:hand` on WebGPU and WebGL,
both clean; each hand 3.6 to 5 s to make on WebGPU's page, 5.2 to 7.4 s on
WebGL's.

Seen and not mended in this round: a single dark speck on the male ring
finger in the back view (traced and mended in the fourth round, below: it
was not the shadow map).

## Fourth round (same day): the speck, two bugs under it, the skin and nails

Asked for: "去解決剩餘的，要產出真正的品質", and whether the Sand3D repository
has a hand. Sand3D (`Sandflow-ai/sand3d`, Apache-2.0) writes hard-surface
objects as Python over Blender; its 170 files have no hand, body or face.

- The dark speck on the male ring finger stayed with the light's shadow off,
  so it was not the shadow. It sat where the ring finger's field was not
  monotonic. Two engine bugs, both in `Isosurface.ts`:
  - the broad phase skipped a shape for a point inside its box when the
    body was already inside there (box distance 0 is not below a negative
    distance), so where two cones of a finger overlapped without a fillet
    the deeper one was dropped near the surface: a pit;
  - a squeezed shape was squeezed about the middle of its box, which for a
    cone with two radii is off its axis, so two cones in a line were
    squeezed about different planes.
  A test compares a field with skipping against one without at points
  inside overlapping squeezed cones; it fails on the old code and passes now.
- Nails: the root shows (from 6 to 10 % of the end bone), the sides curve a
  little more than the skin so they tuck in, a round root, a pinker bed,
  a creamy free edge, and a darker line in the skin round each nail. A
  measurement showed the bed was there all along (14.8 mm of a 16.9 mm end
  segment on the female middle finger, 0.2 mm above the skin); it did not
  read because its colour was the skin's.
- `createZhudaHandSurfaces`: the skin and nail specs in the engine, with the
  fine creasing faded by the pixel's footprint. A first version with pores
  and a finer layer broke into dark dots; they were taken out.
- The palm's hollow shallower and wider; the female wrist no longer leaves a
  ledge under the heel of the hand.

Checks after it: `npm run verify` 818 of 818; unit 22 of 22; `npm run verify:hand` on WebGPU and WebGL,
both clean; each hand 2.8 to 3.8 s to make in the page on either backend.

## Fifth round (same day): side views, the back of the hand

Asked for: "繼續優化，不要急著推" (keep refining; no push).

- Long nails, seen from the side, were dark blades running straight out:
  past the flesh they now curve on down (a C), are 0.2 mm thicker, and the
  nail takes light through it (`back`, `thickness` 1) and round it.
- The thumb's nail was a plate over most of the thumb's back: it is
  narrower and starts further from the joint.
- A soft band across the back of both hands was where the tendons ended
  just under the skin; they now run on toward the wrist and sink under it.
- A dark notch between the male ring and little knuckles was the start of a
  vein at full strength; each vein now fades in and out at its ends.
- The heel of the hand on the little finger's side stands out less; the
  skin has a faint sheen.

Checks after it: `npm run verify` 818 of 818; unit 22 of 22; `npm run verify:hand` on WebGPU and WebGL,
both clean; each hand 2.6 to 3.7 s to make in the page. Nothing pushed.

## Sixth round (same day): the pattern follows a turn, the palm, speed

Asked for: "繼續優化" (keep refining).

- The skin's fine pattern was in world space less an origin, so it slid over
  a hand that turned. It is now in the hand's own space: the skin takes the
  world-to-hand transform as three vec4 rows (a lit surface has no mat4
  uniform), set by `setZhudaHandSkinSpace(skin, worldMatrix)`; a test turns,
  scales and moves a hand and gets a point back to within 1e-12.
- The female preset's tendons stand out a little more (as in the owner's
  photographs); the pad under the knuckles is flatter and the hollow of the
  palm higher and shorter: the dark crescent and the edge across the lower
  palm are gone.
- The mesher takes the field's slope from four samples (a tetrahedron)
  instead of six, stops stepping a vertex once it is on the surface, and
  uses the last slope as the normal when the vertex has moved less than a
  fiftieth of a cell since: about 11 samples a vertex instead of 27. A hand
  takes 1.9 to 2.7 s in the page (was 2.6 to 3.7), 2.1 to 2.75 s in Node.

Checks after it: `npm run verify` 819 of 819; unit 23 of 23; `npm run verify:hand` on WebGPU and WebGL,
both clean. Nothing pushed.

## Seventh round (same day): the palm and the back of the hand

Asked for: "繼續修外觀", then "手掌和手背 都要修好" (fix both the palm and
the back of the hand).

- Measured, not guessed: the trunk's width along the hand and its thickness
  at its middle (back and palm side), for both presets.
  - The little finger's edge was 30.6 mm wide at the wrist's bones, 29.8 at
    40 mm, 34.8 at the knuckle: the wrist's bones were wider than the hand
    above them (the bulge, then a waist). They are narrower now, and the
    heel is placed so the edge widens steadily (female 22.6 to 35.2 mm,
    male 28.4 to 42.2 mm). A test asserts it for both presets.
  - The palm side dropped 14 mm from the heel to the middle of the palm:
    the middle was a pit, not a cup. A pad of flesh across the palm, down to
    the heel, leaves a cup of about 2 mm (female palm about 25 mm thick at its
    middle, male about 32 mm, measured before the last small change to the pad).
- The back: tendons stand out a little more for every build; the wrist is
  deeper from back to palm and its end sits under the heel, so the heel no
  longer overhangs it as a ledge seen from the side.
- Nails: the thumb's plate curves more; the nail is paler toward its sides;
  the light through a nail takes the bed's pink (a pale one washed it out).
- The female preset is 0.071 across (0.074 before), nearer the owner's
  photographs.

Checks after it: `npm run verify` 820 of 820; unit 24 of 24; `npm run verify:hand` on WebGPU and WebGL,
both clean. Nothing pushed.

## Eighth round (same day): the owner's two marked places

The owner marked two places: the female hand's little-finger edge was
irregular; on the male palm the outline under the thumb was unnatural and
the flesh at the lower left (the heel on the little finger's side) was not.

- The little finger's edge, measured every 2 mm: it rose in two plateaus
  (34.4 mm from y 28 to 42, 35.6 from 52 to 60), the heel and the little
  finger's palm bone pushing it out in turn. One smooth piece now runs
  along that edge from the wrist to short of the knuckle, the heel is
  narrower and stands toward the palm side instead of outward, and the
  little finger joins with a fuller fillet: the edge now widens steadily
  (female 28.2 to 41.6 mm from y 2 to 90).
- The thumb's side: it ran from the wrist to the thumb as a straight line,
  so the thumb looked stuck on. The ball of the thumb bulges out further;
  its inner edge stops at the life line (past it, it had filled the valley
  between the two balls of the hand and left a straight step across the
  heel).
- The middle of the palm: the pad there is now deep and wide, so its face is
  a gentle curve (a thin wide one was flat and its lower end a lip).
- Tendons: each is two cones joined without a fillet, the pair joined to the
  palm with a narrow one (4 mm). A cone whose rounded end stood behind the
  knuckle showed as a knob; two cones joined with a fillet bulged where they
  met; one long slim ellipsoid broke down (the ellipsoid's distance is an
  estimate, poor at 13 to 1); a 9 mm fillet swelled the skin round each
  tendon into a cord.
- How thick the hand is a vertex (for light through the skin) is now the
  shorter of the line along the normal and the line straight through the
  hand: along the normal alone, the heel's slope sent it lengthwise through
  the wrist, and the palm's glow stopped at the heel in a straight edge.

Checked and not the cause of the lighter patch on the male palm: the key
light's shadow, the ambient occlusion, the colour a vertex, the faint colour
blotches, the split of the skin into two meshes (the palm is all in one).
What remains of it is the shape: the palm is nearly flat down to about
36 mm above the wrist and the heel rises 7 mm below that, and the light
catches the bend. It is fainter; it is not gone.

Checks after it: `npm run verify` 820 of 820; unit 24 of 24; `npm run verify:hand` on WebGPU and WebGL,
both clean. Nothing pushed.

## Ninth round (same day): the palm, again

Asked for: "再調掌心" (the palm again: the lighter patch at the lower left).

- Measured the palm's height down three lines (x = 0, 12 and 24 mm), every
  4 mm. Down the middle it was flat at -13.5 mm from 80 mm above the wrist
  to 40, then fell 6.6 mm in the next 16 (0.5 mm a millimetre at 28): the
  heel's pads all ended along one line at about 30 mm, on every line.
- Causes, one after another:
  - the hollow cut into the palm: deep enough to show, it also reached the
    heel's pads (which stand further out) and its fillet carved a line
    across the palm above the heel, whatever its size. There is no cut now;
    the cup is the middle pad sitting lower than the pads round it;
  - a thin wide pad in the middle of the palm had a flat face. The middle
    pad and a new broad rise over the heel are deep wide ellipsoids, sized
    so the palm turns onto the heel gradually from about 56 mm down;
  - set that deep, they stood out through the back of the hand (a hump, and
    bands in the side view). `Isosurface.ts` shapes take `keep` (a
    half-space): each keeps only its palm side; the cut lies inside the
    hand.
- After it, every line falls smoothly (at most about 0.35 mm a millimetre),
  the middle line lower than the ones beside it (male at 40 mm: -17.7 down
  the middle, -21.4 at x = 12): a cup. Thickness: about 32 mm through the
  middle of the male palm, 37 through its little finger's side, 40 at the
  wrist; the back of the hand as before.
- The thinness a vertex blends to the line straight through the hand only
  on the palm's side, and only as the skin turns to face front: switched on
  at once (and on the back too), it made bands down the side.

Seen and left: a very faint line along the back edge in the side view.

Checks after it: `npm run verify` 821 of 821; unit 25 of 25; `npm run verify:hand` on WebGPU and WebGL,
both clean. Nothing pushed.

## Limits and decision

- No phone.
- Judged by eye and by measured proportions; not compared with a
  photograph.
- The pose is baked into the mesh: no skinning weights, no rig.
- No prints, pores or veins beyond the fixture hook's fine grain.
- About 2 to 3 s to make a hand in a browser at the default cell; it is
  meant to be made once and kept, not every frame.
- The female preset matches the owner's photographs by eye only.

Decision: **In progress** as a first hand: the generator and the mesher are
done within the scope the task names and verified on desktop; how good it
looks is the owner's to judge from the pictures.

## Committed (2026-11-15, rounds two to nine)

Committed on top of `552736a` (implementation routes and `ZhudaSpineCharacter`) by another
session at the owner's word, the hand's own session having left the work uncommitted after round
nine. Before it: `npm run verify` 830 of 830, Doctor HEALTHY; `npm run lint`, `npm run
format:check`, `git diff --check` clean; `npm run verify:hand` on WebGPU and on WebGL, no page,
console, renderer or GPU error. The uncommitted state was first kept as branch
`backup/procedural-hand-wip-20261115` (removed once the commit was checked identical). Pushed on the owner's word ("Push it").
