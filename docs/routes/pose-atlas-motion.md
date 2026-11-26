# Route: Continuous motion from a generated pose atlas (joint pins, baked in-betweens, masks)

Turns one AI-generated atlas of "eight full-body poses of the same character" into motion in a
game that is continuous and does not jump: measure ten joint pins, write move timetables, bake the
in-between cels between two poses offline with optical flow (poses that overlap, such as an arm
crossing the helmet, get layered masks as well), and at run time change picture along the baked
in-betweens while a mesh deforms with the joints. The knight (69 in-between cels) and the warden
(61) of Ashfall Duel (灰燼之庭) were made this way; the run-time part is `prefabs/2d/cel-motion`.
Checked on desktop only.

- **Id:** `pose-atlas-motion`
- **Kind:** workflow
- **For:** You have (or will generate) a key-pose atlas of a realistic 2D character and want it
  continuous in a game while it walks, attacks, is hit and is interrupted, without a skeleton or
  Spine
- **Checked on:** desktop WebGL (Apple M4, headless Chrome 158 on macOS); the bake was run on a Mac
  (Python 3.9, OpenCV 5.0.0, NumPy 2.0.2, Pillow 11.3.0), but its result differs from what the
  original author made on Windows; no phone
- **Status:** 2026-11-25: the run-time part (`2d/cel-motion`) is pixel for pixel the same in
  Ashfall Duel as in the original game, and 3 + 15 tests pass; the bake script runs to the end on
  the Mac in about 5 seconds, and its output differs from the shipped in-betweens (see
  **Pitfalls**)
- **Reference consumer:** this repository, `prefabs/2d/cel-motion/` (`cel-motion.ts`,
  `cel-sprite.ts`, `preview/pins.jpg`, `preview/strip-3-4.jpg`),
  `prefabs/2d/ashfall-duel/source/tools/bake-transitions.py`, `prefabs/2d/ashfall-duel/motion.ts`
  (the two characters' joint tables and move timetables),
  `prefabs/2d/ashfall-duel/source/ART.md` (the image prompts)
- **Engine version:** zhuda-laya-engine 1.18.0, `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`

## When to take this route

- It fits: a side-view character facing one way, realistic or painterly, whose motion is "changing
  among a few poses" (stand, walk, raise, swing, be hit, fall); pictures that are generated and
  not cut into parts.
- It does not fit:
  - Parts pulled by the hand, cloth with physics: take [spine-character](spine-character.md)
    (zhuda-spine2D).
  - Turning round, several directions, or a great many poses: every further direction is a whole
    atlas and bake of its own.
  - Cartoon or flat characters that can simply be drawn frame by frame: a sequence of frames is
    quicker.
- When the character is made and is to go into a duel: [side-view-duel](side-view-duel.md).

## Tools

- Pictures: the image command of the owner's `zhuda-windows` agent skill (not in this repository),
  with gpt-image-2.6 (generating single pictures on the Mac itself has been retired). The original
  author used ImageGen; the prompts are in full in `prefabs/2d/ashfall-duel/source/ART.md`.
- The bake: `prefabs/2d/ashfall-duel/source/tools/bake-transitions.py`. It needs Python 3 with
  Pillow, NumPy and OpenCV (`cv2.DISOpticalFlow`, `inpaint`, `distanceTransform`), and Node 24
  (to read the joint tables in `motion.ts`).
- Run time: `2d/cel-motion` (`node prefabs/scripts/sync.mjs <game dir> 2d/cel-motion` from a
  checkout of this repository, or from the game
  `node node_modules/zhuda-laya-engine/prefabs/scripts/sync.mjs . 2d/cel-motion`), the engine's
  prefabs (`ZhudaPrefabLibrary`, `.lh` scenes) and `zhuda-laya-accept`.
- Looking: any image tool that can lay points over a picture; `prefabs/2d/cel-motion/preview/pins.jpg`
  and `strip-3-4.jpg` were overlaid with PIL.

## Steps

1. **Generate the atlas.** One truly transparent RGBA picture, 4 columns × 2 rows, eight full-body
   poses of the same character: the same design, the same proportions, the same light, feet on one
   baseline, space left between the cells, no grid lines and no text. One fixed facing (the knight
   faces right, the warden left). **Do not paint a weapon that must deform into the picture**: in
   every pose the knight holds only the grip and the guard, and the game draws the long sword
   separately (only then can it bend). Key 0 is the ready stance and key 1 a stride (`Footwork`
   swings between 0 and 1); the rest follow the moves (the knight: ready, advance, wound up at the
   shoulder, raised high, start of the swing, full extension, recovery, off balance; the warden:
   guard, stride, wind-up, gauntlet lunge, braced for a blow, under pressure, leaning back,
   kneeling). Two reference pictures: one for pose and silhouette, one for materials. Save as WebP
   at the original size (the knight 1536×1024, the warden 1774×887).
2. **Measure the key poses.** One `frame(box, origin, ...pins)` for each: the atlas box (pixel
   edges), **its own** sole origin (a shared origin makes the figure jump when the pose changes),
   and ten pins in a fixed order: helmet, breastplate, weapon hand, front boot, rear boot, belt,
   front knee, rear knee, elbow, hem of the cloak (`PIN`). Look at them laid over the picture (as
   `preview/pins.jpg` does).
3. **Write the move timetables.** `[time 0..1, key pose][]`, for example the light slash
   `[0,0],[0.13,0],[0.35,4],[0.52,5],[0.61,5],[0.78,6],[1,0]`; the same key pose twice in a row is
   a hold. `poseAt()` keeps its speed through a key pose in the middle (the tangent is the
   harmonic mean of the slopes on the two sides) and stops where the direction reverses.
4. **Decide which pairs to bake.** Every pair a timetable passes through, and every pair an
   interruption will walk, needs in-betweens. `PoseTrack` walks only baked pairs; poses that are
   not joined directly are reached by way of others (shortest path, a pair's length = its cel
   count + 1), and if the target pair is not baked it throws `缺少動作影格 a-b` ("motion cels a-b
   are missing"). Ashfall Duel: the knight has 10 pairs and 69 cels (0-1, 0-2, 2-3, 3-4, 0-4, 4-5,
   5-6, 0-6, 4-6, 0-7), the warden 9 pairs and 61 cels. Each pair has 5–13 divisions (the third
   number in `CLIPS` is the number of divisions; the cels are one fewer).
5. **Give the bake its guide points.** Measured by hand in the script for each character: the
   shoulder in every key pose (`SHOULDERS`), and the far hand and far elbow (`FAR_ARM`). For poses
   in which the arm crosses the helmet (the knight's 0, 2, 3 and 4, used in 0→2 and 3→4), draw
   three polygons as well (`ARM_LAYERS`: upper arm, forearm, torso): the arm layers turn rigidly
   (scale limited to 0.92–1.08, the upper arm's angle to ±0.65 rad), the part of the torso under
   the arm is filled in with Telea inpainting (radius 6), and the armour's detail changes over
   only between t 0.34 and 0.66.
6. **Bake.** What the script does (the values are all its own): each key pose is first scaled to
   0.78 and put on a 380×352 canvas with the soles at (178, 335); the joint guide points drive a
   moving-least-squares similarity transform on a 3 px grid (weights `(9 + d²)^−1.65`) that aligns
   both pictures to the shape between the two; DIS optical flow (MEDIUM, finest level) in both
   directions, clamped to ±15 px; each in-between cel samples colour only once; the silhouette is
   blended by signed distance (±13 px); the largest connected piece is cut out (alpha > 0.13,
   dilated 7 px); the cels are packed by shelves into pages 2048 wide, 2 px apart; they are saved
   as WebP (quality 88, method 5, alpha quality 95) and the index
   `{ scale, <character>: { pages, edges } }` is written. Run it inside the module:
   `python3 2d/<module>/source/tools/bake-transitions.py` (it writes `motion-cels.ts` and
   `assets/art/*-motion-*.webp`).
7. **Into the prefab.** A character is one Sprite node with, under it, `Art` (the key-pose atlas)
   and one hidden `Motion0`, `Motion1`… for each page; the prefab's `textures` lists them all.
   `CelSprite` only reads these textures (an example: `prefabs/2d/ashfall-duel/assets/courtyard.lh`).
8. **The order at run time.** The target pose (from a timetable or `Footwork.walkPose()`) →
   `Footwork.shape()` (planting the feet, rise and fall, breathing) → the move's own adjustments
   (for example the wrist lifted while the sword is raised) →
   `PoseTrack.sample(move name, pose, dt)` (when the move name changes, the hand-over takes
   0.105 s, walking along the in-betweens at 36–140 cels a second) → `CelSprite.draw()`: it takes
   cel `round(t × (count − 1))` of that pair (the two ends are the key poses); an in-between cel's
   pins are the joints interpolated at the bake scale, placed on its anchor; the mesh is 16×20,
   its weights `1 / (90 + d²)^1.65` normalised, and screen scale / bake scale = the mesh's scale.
9. **Check.** Tests: every pair is interrupted once in each direction, only registered pairs are
   walked, and the target is reached (the last test of `tests/ashfall-duel.test.mjs`, and
   `tests/cel-motion.test.mjs`); look at each strip of in-betweens laid out in a row; compare each
   character alone as a prefab (Ashfall Duel: the knight 0, the warden 0 and loaded and unloaded
   30 times in a row); interrupt every move in the game and watch for a jump.

## Pitfalls

- **Running the bake again does not give the same set of in-betweens.** Run again on 2026-11-25 on
  the Mac (OpenCV 5.0.0), 113 of the 130 cels had a different crop box and the knight's first page
  went from 1776 high to 2048 high; the pictures are close but not the same set. There are at
  least two causes: a different OpenCV version; and the `knight.webp` and `warden.webp` that are
  kept (in the module and in the git bundle) are lossy WebP (`VP8 ` + `ALPH`), while the script's
  comment says the end frames come from the original lossless transparent pictures, which were not
  kept. → The in-between pages and the index are always replaced together and shipped together;
  after a new bake, look at every strip again and shoot the prefab references and the previews
  again. **If you have the lossless originals, keep them with the atlas.**
- **A double image where the arm crosses the helmet.** Optical flow draws half of each picture's
  arm. → Those pairs use the layered masks (step 5). The first few cels of the knight's 3→4 still
  show the shadow of two sets of arms (cels 1–5 of `preview/strip-3-4.jpg`); in the game each
  stays for about one frame.
- **The whole character jumps when the pose changes.** The key poses shared one origin. → Measure
  each key pose's own sole origin.
- **What must bend cannot bend once it is painted into the picture.** → Draw the weapon separately
  (Ashfall Duel's sword is a strip of triangles in 24 segments) and leave only the grip in the
  picture.
- **An interrupted move jumps straight to the new pose.** A cross-fade shows two half-transparent
  figures. → `PoseTrack` walks there along the baked in-betweens, and the joints hand over in
  0.105 s.

## Engine gaps and their workarounds

| Gap | Workaround |
| --- | --- |
| The engine's 2D characters are Spine only; there is no "atlas of key poses plus in-betweens" | `prefabs/2d/cel-motion` (`PoseTrack`, `Footwork`, `CelSprite`) |
| No tool that bakes in-betweens offline | `prefabs/2d/ashfall-duel/source/tools/bake-transitions.py` (the characters' data is written into the script; another character means changing it) |
| No component that deforms a picture by a mesh | `CelSprite` draws a mesh of 17×21 vertices every frame with Laya's `graphics.drawTriangles` |

## Checks

The commands are written for this repository's `prefabs/`; the results are those of 2026-11-25,
from before the library moved into this repository.

```sh
cd prefabs && node --test tests/cel-motion.test.mjs tests/ashfall-duel.test.mjs
# The bake (try it in a copy: it overwrites motion-cels.ts and assets/art/*-motion-*.webp):
python3 2d/ashfall-duel/source/tools/bake-transitions.py
# One character alone: add node: "<character node>" to the prefab's prefabChecks, then npx zhuda-laya-accept
```

2026-11-25: the 18 tests passed; the knight and the warden, each compared alone as a prefab,
differed by 0 pixels; the bake runs to the end on the Mac with a different result (above).

## Not checked

- No third character has been made by this route: the two characters of Ashfall Duel were made by
  the original author, and this route was put together from that author's code, scripts and
  records.
- The bake cannot reproduce the shipped in-betweens on that Mac; the original author's Python and
  OpenCV versions were not recorded.
- The quality of the in-betweens was judged by eye only (`preview/strip-3-4.jpg`), not measured.
- No phone; the memory and load time on a phone of the in-between pages (two pages 2048 wide for
  each character) were not measured.

## Boundaries

- The game: the character's atlas, joint tables, move timetables, the bake's guide points and
  masks, the in-between pages and index, the lossless originals.
- The prefab library (`prefabs/`): `2d/cel-motion` (motion and drawing at run time) and the bake
  script (for now in `2d/ashfall-duel/source/tools/`, with the characters' data written into it).
- The engine: prefab loading and comparison, Laya's drawing. To build this into the engine (for
  example a general atlas-character component), move it from `2d/cel-motion`.
