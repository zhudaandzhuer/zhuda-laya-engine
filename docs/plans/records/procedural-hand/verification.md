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

## Limits and decision

- No phone.
- Judged by eye and by measured proportions; not compared with a
  photograph.
- The pose is baked into the mesh: no skinning weights, no rig.
- No prints, pores or veins beyond the fixture hook's fine grain.
- About 6 s to make a hand in a browser at the default cell; it is meant to
  be made once and kept, not every frame.

Decision: **In progress** as a first hand: the generator and the mesher are
done within the scope the task names and verified on desktop; how good it
looks is the owner's to judge from the pictures.
