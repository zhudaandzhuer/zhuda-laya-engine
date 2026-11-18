# Route: a small floating island with weather, a day and a creature to pick up

A diorama a player looks at and plays with: an island 17 m across above a sea of
cloud, with a cottage and windmill, a pond, a tree, grass that the wind and a body
move, rain, storm, mist and a day that passes, and one character that walks about
and can be picked up, swung, thrown and dropped in the pond. Mouse or touch turns
the camera and grabs the character. Checked by drawing on a desktop with WebGL and
WebGPU only.

- **Status:** checked on desktop WebGL and WebGPU (Apple M4, Chrome 157 headless,
  1280 by 720), 2026-11-16; a phone's screen and touch were emulated only; not on a
  phone.
- **Reference consumer:** `games/zhuda-sky-island` (outside this repository).
- **Engine version:** 1.18.0. The consumer was built against the branch that became
  `a961cc6`; everything it uses is on `main` from that commit. Its `src` typechecks
  against the public types of `e453b60` (2026-11-18).

This route was written on 2026-11-18 from the consumer's source and its records of
2026-11-16. Apart from that typecheck, nothing was run again for it.

## When to take this route

A small outdoor scene seen whole from an orbiting camera, where the hour and the
weather change while it runs and something walks on ground the game knows the
height of: a toy, a pet scene, a home screen, a level-select island.

Not this route: ground larger than a few tens of metres (a heightfield and its
queries, [3D integration](../3d-integration.md)); a still or a film
([film scenes](../film-scenes.md)); a camera in the water
([under water](underwater.md)); a character in layered clothing
([layered cloth](layered-cloth-on-body.md)).

## Tools

- Blender, run headless (5.2.2 LTS is what the machine that built it has). The
  consumer's scripts (`tools/island.py`, `props.py`, `tree.py`, `pig-clips.py`)
  build every model; the `.glb` files and the scripts stay in the consumer.
- Plants and stones: Poly Haven models (CC0), game versions kept in the consumer.
- Sounds: the consumer's `tools/sfx.py` (numpy, seeded) and its own voice lines,
  converted to AAC with ffmpeg.
- Headless Chrome through the engine's `chrome-host.mjs`, for the scripted checks
  (see the gaps below).

## Steps

1. **A project on the consumer route.** [Consumer route](../consumer-route.md);
   features `core`, `3d`, `gltf`, `postProcess`; `renderer: "auto"`. Build with
   `zhuda-laya-engine/compiler/consumer` (`runConsumerBuild`). Check: the consumer's
   `npm run doctor`.
2. **One source for the ground.** The Blender script that shapes the island's top
   also writes its heights as data (`src/island-data.ts`: a 0.2 m grid with `null`
   off the island, the rim's radius at 128 angles, the pond's ellipse and water
   level, the path's points). `src/ground.ts` reads it: `groundAt`, `insideBy`,
   `pondDistance`, `pathDistance`. Grass, props, the character and particles all
   ask these, never the mesh. Check: `node --test tests/` (ground inside the rim,
   `null` outside, the pond's floor below its water).
3. **Models with named parts.** `ZhudaModelLibrary` on a `DirectoryAssetProvider`
   ([asset loading](../asset-loading.md)). Parts that move are their own nodes
   (`house.find('sails')`, `tree.find('canopy')`); props are clones of the nodes of
   one file. The character is loaded with `independentMaterials: true`. A failed
   download is tried again and the count that has arrived is shown.
4. **The look as a function of hour and weather.** `skyAt` in `src/sky.ts` takes
   the hour, the weather, the focus distance and the lightning's flash and returns
   a whole `ZhudaFilmLook`; the game eases three
   weather amounts (rain, storm, mist) toward the chosen weather and calls
   `look.setLook(...)` ten times a second (every frame during lightning). Every
   look has the same keys, so each call is `'updated'`, never `'rebuilt'`
   ([changing the look while it runs](../film-scenes.md#changing-the-look-while-it-runs)).
   Values that worked: shadows `distance: 28, resolution: 4096, cascades: 2`; grade
   `bloom: 0.32, ao: 0.75, aoRadius: 0.6, vignette: 0.32, grain: 0.08`; depth of
   field focused on the character (`fStop: 2.4`); `motionBlur.shutter: 0.3`;
   `screenReflections.wetness` at 0.7 of the rain. Check: the consumer's test that
   every hour and weather gives the same keys and colours within 0..1.
5. **The look on the game's scene.** A `ZhudaSceneLook` on the game's scene and
   camera, with `cameraPasses: { depth: true, opaque: true }` in its options, and
   `look.update` every frame with the eye, the target, the field of view, the
   aspect and the frame's seconds
   ([the same look in a game](../film-scenes.md#the-same-look-in-a-game)). The
   `cameraPasses` are the ones the pond reads; named here, they survive a rebuild.
6. **The sea of cloud.** A cloud layer below the eye
   ([clouds](../film-scenes.md#clouds)): `clouds.baseMeters: -90`,
   `thicknessMeters: 55`, `sizeMeters: 420`, `coverage: 0.5`, `steps: 24`,
   `density: 0.9`, `distanceMeters: 2500`. The light fog is kept near:
   `lightFog.maxDistance: 70`, with `density: 0.0045`, `falloffMeters: 40`,
   `baseY: 0`, `scatter: 0.6` and beams of `strength: 1.4` over `distance: 40` in
   `steps: 32`. The sky's `groundTint` is the blue of far land under the cloud.
   Camera `far: 600`. Check: a low camera sees cloud below the island's underside.
7. **Grass.** `ZhudaGrassField` over the island's square with `ground: groundAt`
   and a `grows` test that keeps blades off the rim (0.32 m), the path, the pond's
   shore, the house, the trunk, each prop's footprint and the fence lines
   ([grass](../grass.md)). `heightM: [0.12, 0.32]`, `widthM: 0.022`, `patchM: 3`,
   density 300 to 1100 a square metre by picture setting, `distanceM: 70`. Each
   frame: `setWind`, `update(eye, seconds)`, and `setBenders` with the character's
   feet (`radius: 0.55`, not while it flies or swims) and, after a hard landing, a
   ring of `0.3 + 1.6 * impact` that is gone in under a second
   ([bodies in the grass](../grass.md#bodies-in-the-grass)).
8. **The pond.** `ZhudaWaterSurface` a little larger than the pond (`clarity: 2.2`,
   `waveMeters: 0.45`, `waves: 0.25`, `glow: 0.25`, `foamDepth: 0.04`,
   `resolution: 512`),
   its sun from `look.towardSun` and updated with the look. `water.update`,
   `setTime` and `render()` each frame; below look level 2 the mirror is drawn
   every other frame.
9. **The character.** Clips through `ZhudaAnimationBlend`
   ([animation control](../animation-control.md)); ears and tail on
   `ZhudaSpringBones`, stepped by `runZhudaAfterAnimation`
   ([spring bones](../spring-bones.md)). The model has tip bones that deform
   nothing, so each chain has an end. The clips leave ears and tail at rest. The
   grab is the game's: a ray from the pointer, then the hand moves on a plane
   through the scruff that faces the camera, never lower than 1.08 m above the
   ground under it.
10. **Particles.** One `ZhudaParticleSystem3D` and `ZhudaLayaParticleRenderer3D`
    for each of 22 effects, textures painted from numbers in code. Rain is two
    emitters: streaks over the island (a 30 by 30 m box at 14 m, up to 6000) and
    thin near streaks in a box that goes with the eye; both face along their
    velocity (`billboard: 'velocity'`) with `stretch`. Rings on the ground and
    the pond lie flat (`billboard: 'ground'`). Stars are 650 long-lived
    particles on a dome 220 m out.
11. **Night.** Windows and the lamp share a material named `glow`, whose emission
    follows the night; three point lights, at the lamp and at the cottage's front,
    follow it too.
12. **Picture settings and the frame budget.** Four settings (`src/tiers.ts`): look
    level, pixel ratio, grass density and the share of particles. A phone starts
    low, anything else mid; `?fx=` picks one. A `ZhudaQualityGovernor` with
    `budgetMs: 1000 / 55` moves along a ladder of `{ look, renderScale }` with
    `look.setStep`: resolution first, then the look, then the grass
    ([hold the frame budget](../quality-route.md#11-hold-the-frame-budget)). It
    does not judge the first 8 s or the 2.5 s after each change, and stops once
    the player chooses a setting.
13. **Sound.** One `IframeSoundAdapter` on the same provider
    ([audio](../audio.md)): six long ambience loops as streams, sixty short sounds
    as samples loaded four at a time with the grab sound first, each tried again
    until it arrives. `unlockAudio` on the first pointer press. The voice plays at
    the character's place.
14. **A hook for checks.** `window.__ISLAND__` gives a script the pointer
    (`press`, `move`, `release`), the hour, weather and camera (`set`), the state
    and `context.renderer.errors`. A scenario file is played in headless Chrome,
    with a screenshot after each step, on both backends.
15. **Teardown.** On `pagehide`: sound, springs, character, particles, grass,
    water, look, models, library, provider, context, in that order.

## Pitfalls

- **Rain and stars vanished when the grade came on.** The light fog is laid by each
  pixel's depth and particles have none, so in front of the sky they took the
  sky's full fog. Found by drawing the same frame at look level 0, at level 2 and
  with the fog off. `lightFog.maxDistance` (70 here) keeps the fog near; the same
  setting keeps the sea of cloud from being fogged away.
- **The first visit was silent.** Sixty short sounds asked for at once, beside
  40 MB of models, passed the adapter's 15 s deadline and were not asked for
  again; a reload with a warm cache hid it. Load a few at a time, the first sound
  the player can cause first, give `sampleTimeoutMs` room (60 s) and try again.
  Long loops are streams: six decoded whole pass the adapter's budget.
- **A look that is rebuilt stutters.** Turning a part of the look on or off
  rebuilds it. Give every hour and weather the same keys and move strengths to 0
  instead, and test that.
- **The frame budget judged loading.** The first shader compiles, the first grass
  and each change of setting are slow frames that say nothing about the device.
  Wait before sampling, and again after each step.
- **No grass on a phone held upright.** The camera stands back so the island
  fits, past a short grass distance. Grass grows only on the island, so a long
  `distanceM` costs nothing more.
- **Rain streaks too faint to see.** The renderer stretches the quad along its x;
  a thin line in the texture is lost to its mipmaps. Fill the quad's width.
- **Models larger than they look.** One bevel segment instead of two took the
  cottage from 4.7 to 2.1 MB with no visible change; two unused trees were
  8.5 MB of the 42.

## Engine gaps and their workarounds

| Gap | Workaround | Plan |
| --- | --- | --- |
| Particles in front of the sky take the fog of what lies behind them | A short `lightFog.maxDistance` | none yet |
| No public entry for the headless Chrome host a consumer's scripted check needs | The consumer's `tools/play.mjs` imports `packages/compiler/chrome-host.mjs` by path (a tool, not shipped code) | none yet |
| `ZhudaSceneLook` has no call for a game's own lamps or a material's emission (a film stage has `setLight`) | LayaAir's `PointLightCom` and the material's emission strength, set by the game | none yet |

## Checks

All on 2026-11-16, Apple M4, Chrome 157 headless, in the consumer; its `evidence/`
holds the frames.

- `node tools/play.mjs tools/scenarios/hero.json` on WebGPU and on WebGL: day, the
  character held close up, storm, dusk, night and morning mist; no renderer error
  and no page error on either backend.
- Thrown from a height (dizzy), onto the roof, into the pond (splash, swim, shake
  dry), the footprint in the grass: frames `g-*`, `f-*`.
- Picture settings: mid by default on a desktop, low on an emulated phone (390 by
  844, pixel ratio 3, touch), `fx=low`, `fx=max`, and with the CPU slowed six
  times the ladder goes down to its lowest rung (60% scale); no errors.
- Sound: loads, unlocks on a trusted click and plays without errors. On an
  emulated 2.5 MB/s first visit all 66 sounds arrived in about 10 s; after a 40 s
  outage of the sound files all arrived within 45 s.
- In the engine: `npm run verify`, `verify:grass` on both backends,
  `verify:film-clouds`, `verify:film-fog`
  (`docs/plans/records/sky-island-effects/`).

## Not checked

- Any phone: frame rate, touch, sound. No frame cost was measured anywhere; the
  frame rate was only seen in headless Chrome on a desktop.
- Sound by ear (balance, tone).
- The consumer pinned to a commit of `main` and its `npm run verify` there: it
  still pins `3b63fee` and was built with `ZHUDA_ENGINE_ROOT`.
- Engine calls that came after the consumer or that it does not use:
  `ZhudaWaterSurface.setRipples` for the body in the pond (it draws rings with
  particles), `ZhudaFoliageWind` for the tree's crown (it turns the `canopy`
  node), and `ZhudaParticleSystem3D.burst(count, x, y, z)` and `aliveCount` (it
  sets the emitter's rate for one step, and reads the count through a cast).
- Meshopt-compressed models.
- No draw check in this repository shows a cloud layer below the eye or
  `setBenders`; the consumer's frames are the drawn evidence.

## Boundaries

The engine draws: the look, the cloud, the fog, the grass and its bending, the
water, the particles, and it runs spring bones, clip blending, the frame budget,
loading and sound. The consumer owns the island's shape and its height data, the
models, the character's rules (walking, being held, thrown, swimming), the
weather and the day and the look they give, the particle recipes and their
textures, the sounds and lines, the interface, the picture settings and
publishing.
