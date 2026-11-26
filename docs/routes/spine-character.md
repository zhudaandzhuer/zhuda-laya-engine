# Route: a hand-driven Spine character from generated art

A 2D character (here a pair of legs in sheer tights under a pleated skirt) made from
generated or painted art with the zhuda-spine2D toolkit, drawn by the engine's `spine42`
feature, and changed by the player's hand: a pleat of the skirt follows the finger by IK
while Spine 4.2 physics carries the rest and swings it back; a leg's nylon is pulled
toward the finger by a bone that carries a mesh; a hard pull tears it by swapping
attachments. Mouse or touch.

- **Id:** `spine-character`
- **Kind:** scene
- **For:** A 2D character from generated or painted art, rigged with zhuda-spine2D, that the hand changes: cloth lifted by IK and swung by Spine physics, a layer torn by swapping attachments.
- **Checked on:** desktop WebGL; desktop WebGPU; no phone
- **Status:** checked on desktop WebGL and WebGPU (Chrome, Apple M4), 2026-11-15, as the game
  `stocking-tear-2d`. Real touch was checked on a vivo V40 with an earlier, shader-drawn version
  of the same scene only; this Spine version was not run on a phone (see **Not checked**).
  Re-checked on 2026-11-26 as the prefab module `2d/spine-tights` on this repository's engine
  (2.0.0 and what came after it): desktop WebGL on the graphics card with a real mouse.
- **Reference consumer:** the prefab library's module `zhuda-engine-prefabs/2d/spine-tights/`, opened by
  `zhuda-engine-prefabs/viewer2d` at `?scene=spine-tights`. It was the game `stocking-tear-2d`, which left the
  game centre workspace on 2026-11-25; its rig, its driver and everything the rig was made from
  were moved into the library on 2026-11-26. The files named below are the module's:
  `source/spine/outfit/` (`make_parts.py`, `make_tights.py`, `rig.py`), `spine-tights.ts`,
  `assets/` (the exported rig), `source/HANDOFF-2026-11-15.md`.
- **Engine version:** made on `zhuda-laya-engine` 1.18.0 with `ZhudaSpineCharacter` from the
  commit that adds this route; the module runs on 2.0.0 and after (re-checked at `e4ba0212` with
  this module's own commit on top).

## When to take this route

- A flat character or garment, seen from one side, that the player handles: a skirt or
  cape that is lifted and swings, a layer pulled and torn, hair or ribbons that react.
- Art that exists as pictures (generated, painted, photographed): each part a picture
  with real alpha, everything the motion reveals painted in.
- Not for a turning, deep or lit-from-anywhere body: see
  [layered cloth on a modelled body](layered-cloth-on-body.md). Not for UI or effects
  without a skeleton: see [prefab workflow](../prefab-workflow.md).

## Tools

| Tool | Version | Where from | Licence and what may be committed |
| --- | --- | --- | --- |
| zhuda-spine2D | 2.7.0 (`f751584`) | github.com/zhudaandzhuer/zhuda-spine2D | Clone it beside the consumer; never vendor it into the engine. It carries Spine Runtimes 4.2.119 under the Spine Runtimes License: whoever ships a Spine rig needs their own Spine Editor licence. Commit the rig's sources and its exported JSON, atlas and PNG in the consumer. |
| Playwright Core + Chrome | any recent | an existing install (`PLAYWRIGHT_MODULE=…/playwright-core/index.mjs`, `CHROME_PATH=…`) | Only for the toolkit's native captures. |
| An image model | gpt-image-2.6 was used | the consumer's own account | Its pictures belong in the consumer. |

The kit's own route is its `SKILL.md`; read it first. One command surface:
`python3 spk.py build|check|stress|shot|sheet|play <project>`.

## Steps

1. **Parts in the art's pixels.** One canvas (the picture's size), each part a PNG with
   real alpha at its place, listed in `parts/manifest.json` back to front (the kit's
   `docs/10-art.md`). Cut a figure out of a photo by its difference from the background
   **and** a flood fill from inside the figure: floor reflections pass any colour test
   but are islands. Leave the background out of the rig; the game draws it.
2. **Rig (`rig.py`).** Cloth: parallel bone chains from its seam to its hem driving one
   mesh (`W.sheet`), `rig.physics_chain` on each chain, and a two-bone `rig.ik` from each
   chain's last two bones to a free `grab_N` bone with `mix=0`. A layer that is pulled: a
   mesh weighted to one bone per pull site (a narrow weight across the body, longer along
   it). Changes the hand makes (holes, stages): extra slots whose attachments are
   `active=False`.
3. **Check natively.** `spk build`, `spk check` (no error), `spk stress` and look at
   every pose. A stress pose per hand action (pull, lift, each attachment) shows what the
   game will do before the game exists.
4. **Load it in the consumer.** Feature `spine42` (with `core`, `2d`);
   `await Laya.loader.load('x.json', Laya.Loader.SPINE)`;
   `new ZhudaSpineCharacter({ parent, templet, animation: 'idle' })`; call
   `character.update()` from `context.runtime.start`. The character's node is the canvas:
   scale and place its parent, not the node.
5. **Drive it by hand.** Pointer to canvas with `stageToCanvas`; find what is under the
   finger with `boneTipCanvas` / `boneCanvas`; for cloth, `moveBoneTo('grab_N', …)` and
   ease `setIkMix('grab_N_ik', …)` to 1 while held and back to 0 when let go (about 0.2 s:
   the physics then carries the swing); for a pulled layer, `nudgeBone('pull_…', dx, dy)`
   each frame from the consumer's own spring; tears with `setAttachment(slot, name|null)`.

## Pitfalls

- **Spine physics never steps.** LayaAir's `Spine2DRenderNode.physicsUpdate` defaults to 0
  (none): the 27 physics constraints of the reference rig were inert and the skirt snapped
  back. `ZhudaSpineCharacter` sets 2 (update) and keeps it.
- **Bone and attachment changes do not show.** The fast render path draws from caches.
  Set `useFastRender = false` and no cache (done by `ZhudaSpineCharacter`).
- **Nothing is drawn, or it is drawn elsewhere.** LayaAir draws the skeleton's bounds
  (the JSON's `skeleton.x/y/width/height`) with their top-left at the node and moves the
  skeleton itself (`skeleton.x/y`); a node placed at the skeleton's origin draws off
  screen. Bone world positions have that offset in them. Use the class's canvas
  conversions; never add or subtract by hand.
- **A seam round every opaque patch over a semi-transparent layer.** LayaAir blends a
  semi-transparent dark layer (sheer nylon) differently from the display values a patch
  is baked in, and no single gamma made them meet. Make each change a decal that is fully
  transparent outside what it changes (here: the bare skin where a hole opened, and
  extra nylon at its rolled lip), so it blends the same way as what it lies on.
- **Alpha darkens at the edges.** LayaAir assumes premultiplied alpha after a templet is
  applied, and its `templet.checkPremultipliedAlpha()` said true for an atlas written
  `pma:false`; zhuda-spine2D exports straight alpha. The class uses straight alpha unless
  told `premultipliedAlpha: true`, and keeps it.
- **`bone.worldRotationX` is undefined** in spine-core 4.2 (it is a method,
  `getWorldRotationX()`); a tip computed from it is NaN. Use `localToWorld` (as
  `boneTipCanvas` does).
- **Captures fail on a 404.** The kit's native capture fails every shot when the browser
  asks for `/favicon.ico`; tell its capture to ignore that request.
- **Generated art is refused.** An image model may refuse some edits of a body
  (here: adding tights to a photo of legs). Do not word around a refusal: draw that layer
  from data (the tights here are a photographed nylon swatch's transmission spread over
  the legs).

## Engine gaps and their workarounds

| Gap | Workaround in the reference consumer |
| --- | --- |
| No public loader for Spine assets through `AssetProvider` | `Laya.loader.load(url, Laya.Loader.SPINE)` in the consumer |
| No hand for a rig's pull sites and cloth chains (springs, IK mixes, tear stages) | Since 2026-11-26 a prefab module for this rig's naming: `createSpineTights` in `zhuda-engine-prefabs/2d/spine-tights/spine-tights.ts` (`pull_<site>`, `tear_<site>`, `lip_<site>`, `pleat<i>_3`, `grab<i>`, `grab<i>_ik`) |
| Spine physics in LayaAir is not compared with spine-webgl's | Checked by eye in both; tune strength and inertia in the game |

## Checks

As the game, 2026-11-15:

- Native: `spk check` (structure, weights, loop seam, physics), `spk stress` sheets
  looked at pose by pose.
- In the game, desktop: a real mouse drag on a leg (stretch held, then torn), on the
  skirt (lifted held, then let go: swing), on WebGL and on WebGPU; read back
  `character.diagnostics()` (`physicsUpdate` 2, `useFastRender` false, the skeleton
  offset).
- Engine: `tests/spine-character.test.mjs` (settings, canvas conversions, refusals,
  disposal), `tests/public-spine-character-types.test.mjs` (a strict consumer), the
  SDK export check in `tests/compiler-and-mcp.test.mjs`.

As the prefab module, 2026-11-26 (Apple M4, Chrome 158 on the graphics card, this repository at
`e4ba0212` with the module on top; pictures in `zhuda-engine-prefabs/2d/spine-tights/preview/`, the record in
`local-results/hosiery-modules/`):

- `zhuda-engine-prefabs/2d/spine-tights/source/look-book.mjs` through `games/tools/shot.mjs --gpu --hook
  __SCENE__` (WebGL, 600 × 900), every step read from the page's hook: no renderer, page or input
  error. A pull of 60 canvas pixels carried the nylon 55 and tore nothing; let go it was within
  0.1 pixels of its place 0.9 s later. Two drags on one knee: a small hole, then a large one. The
  middle pleat's hem went from (515, 565) to (559, 277) while held (its IK mix 1, the others 0;
  the pleats at the two ends moved 11 and 23 pixels after it) and was back inside the range of
  its idle sway 0.7 s after it was let go. Two taps on the background mended everything.
- The game's sources, unchanged, build against this engine. The game and the module were
  photographed in three still states (whole, ten small holes, ten large): below the skirt's
  edge no pixel differs by more than 8 of 255. The skirt sways by itself, so the two were not
  caught at one moment: 17 to 18% of each frame differs, all of it on the skirt and its edge.
- `zhuda-engine-prefabs/tests/spine-tights.test.mjs`, eight tests without a browser: the exported rig holds
  every bone, constraint, slot, attachment and atlas region the driver names; the tear sites
  mirror and lie on the legs; the driver on a stand-in for `ZhudaSpineCharacter` (pull, two tear
  stages, the skirt's IK, mending).
- `zhuda-engine-prefabs/viewer2d` with the feature `spine42` added: `npm run verify`; its four other presets
  draw the same pictures with and without the feature (42 pictures of their scenarios; the few
  that differ are animated screens that also differ between two runs of one build).

## Not checked

- This Spine version on a phone (the V40 was in use by another project when it was
  ready); its frame rate and its 2048 x 4096 atlas's memory on a phone.
- The module on WebGPU: `zhuda-engine-prefabs/viewer2d` is WebGL only. The game ran on WebGPU on 2026-11-15.
- Spine physics in LayaAir against spine-webgl's, number for number.
- Multi-touch (two hands on the skirt), more than one character.
- Any rig not made with zhuda-spine2D (bounds other than its canvas convention).
- The three scripts of `source/spine/outfit/` were not run again (they need the toolkit): the
  rig, its atlas and its parts are the game's, byte for byte.
- No person has looked at the module's pictures.

## Boundaries

- The prefab module owns this rig: the art and what it was generated from, the rig sources and
  export, the springs and thresholds of the hand. A game takes them with `zhuda-prefabs-sync` and
  writes its own rules (what a tear means, when).
- Another character is a consumer's own: its art, its rig sources and export.
- Engine: `ZhudaSpineCharacter` (renderer settings, canvas conversions, bone, IK and
  attachment access, disposal) and the `spine42` topology.
- The toolkit stays its own repository; this route pins the version it was checked with. It
  carries the Spine Runtimes under their own licence (see Tools): whoever ships a Spine rig needs
  their own Spine Editor licence.
