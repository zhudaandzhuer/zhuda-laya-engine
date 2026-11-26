# Route: a 2D game or interface, end to end

A 2D game or a game's interface on the engine's Laya 2D stage: a project made by the
2D scaffold, a layout in design units that holds at any DPR, time from the runtime
session's clock, input as action ids, everything a player sees delivered as checked
prefabs, rigged characters through Spine, tile maps, ready particle effects, sound
through the one audio authority, and the build and Doctor checks that let the game
claim it is built on the engine. Mouse, touch or keys. The parts of this route are
each checked in this repository on a desktop; no game has yet been built along all of
it and run on a phone.

- **Id:** `game-2d`
- **Kind:** workflow
- **For:** Building a 2D game or a game's 2D interface on the engine: the project, the layout, time, input, prefabs, Spine characters, tile maps, ready 2D effects, audio, build and checks, in that order.
- **Checked on:** desktop WebGL (headless Chromium, SwiftShader, in a Linux container); no phone
- **Status:** the 2D scaffold builds to `engine-backed-static` and passes the source audit
  in `npm run verify` (`tests/consumer-route.test.mjs`); the ready 2D effects were drawn
  on WebGL by `npm run verify:effects-2d` on 2026-11-22 (SwiftShader, not a GPU); the
  prefab gate is checked by `npm run verify:prefab-browser`; the Spine step is the
  [spine-character](spine-character.md) route's own (desktop WebGL and WebGPU). No
  WebGPU 2D draw and no phone run belong to this route.
- **Reference consumer:** the project `node packages/compiler/zhuda-init.mjs <dir> --template 2d`
  writes, and the fixture `tests/fixtures/effects-2d.ts` for the effects; no game in this
  repository.
- **Engine version:** `zhuda-laya-engine` 1.18.0, from the commit that adds this route.

## When to take this route

- A game played on a flat stage: a puzzle, a card or board game, a slot-style reel, a
  platformer or a shooter seen from the side or above, a menu, a HUD over a 3D game.
- Art that exists as pictures, atlases, bitmap fonts and Spine rigs.
- Not for a 3D scene: take [new-game-project](new-game-project.md) then
  [good-looking-3d-scene](good-looking-3d-scene.md). Not for a one-file prototype: take
  [single-html-page](single-html-page.md). A rigged 2D character that the hand changes is
  [spine-character](spine-character.md), taken from step 6 of this one.

## Tools

- `zhuda-laya-init` (`node packages/compiler/zhuda-init.mjs`) with `--template 2d`;
  in the project `zhuda-laya-build` (`--candidate`), `zhuda-laya-accept`,
  `zhuda-laya-doctor`, `zhuda-laya-watch` (`--candidate` for the edit loop: a save
  that changes only `src/` rebuilds `app.js` alone). Node 24 or newer.
- Engine features for the project's `zhuda.config.json`: `core`, `2d`, `ui` (what the
  scaffold writes); add `spine42` for Spine 4.2 rigs and `tilemap` only for LayaAir's
  own tile maps. The ready effects need no extra feature: they draw with `2d`
  (LayaAir's own `particle2d` module is a different particle system and is not used).
- Engine draw checks: `npm run verify:effects-2d` (WebGL, `2d` browser profile; run
  `npm run build` first), `npm run verify:prefab-browser`.
- MCP: `get_agent_contract`, `list_routes`, `get_route`, `validate_particle_effect` for
  a 2D effect of the game's own.
- Outside tools: the zhuda-spine2D toolkit for rigs ([consumer tooling](../consumer-tooling.md)),
  not vendored here.

## Steps

1. **Create the project.** `node packages/compiler/zhuda-init.mjs /abs/path/my-game --template 2d`,
   then `npm install` there. Check: `zhuda.config.json` has `features: ['core','2d','ui']`
   and `prefabPreview: 'src/prefabs.ts'`; `npm run verify` passes. The pin, the required
   shape and the claim levels are [new-game-project](new-game-project.md)'s.
2. **Size in design units.** Boot once with the game's container, a `designSize`
   (1280 by 720 in the scaffold, `scaleMode` show-all) and a `dprCap`
   ([runtime sizing](../platform-adapters.md#runtime-sizing-drivers-and-recovery-170)).
   Positions are CSS design units at any DPR: never multiply by `devicePixelRatio`.
   Lay out with `computeZhudaGridLayout` and measure text with `computeZhudaTextLayout`
   or a bitmap font ([layout](../layout-and-media.md)). Check: the same layout report in
   the prefab preview and the scene.
3. **Time from the session.** The runtime session's `ZhudaLayeredClock` layers (`world`,
   `ui`, `vfx`, ...): pass `scaledDeltas` to layer timers, read a layer's delta for each
   system, and pause or slow a layer for hit-stop or a menu
   ([layered time](../combat-runtime.md#layered-time)). No `setTimeout` or
   `setInterval` drives the game.
4. **Input as action ids.** Pointers through Laya's stage events or `ZhudaPointerInput`
   (client CSS pixels, roles by pointer id, cancel on blur); keys and pads mapped to stable
   action ids pushed into one `ZhudaInputBuffer`, cleared on focus loss, round reset and
   teardown ([buffered input](../combat-runtime.md#buffered-input)). Canvas
   `touch-action: none`. Check: a press, a drag and a cancelled drag in the game's own
   test.
5. **Everything seen is a prefab first.** Panels, buttons, HUD bars, cards, symbols and
   characters go through [visual-content-prefab](visual-content-prefab.md): inventory,
   author, check alone, compose, mount the same definition. `npm run build:candidate`
   then `npm run accept:prefabs` when evidence is stale. Nine-slice frames and vector
   buttons have SDK helpers; atlases and fonts go through `AssetProvider` ids.
6. **Rigged characters.** A Spine 4.2 character takes the
   [spine-character](spine-character.md) route (`ZhudaSpineCharacter`, feature `spine42`);
   its rig and pictures stay in the game.
7. **Maps.** A tile world is a `Terrain2DSpec` drawn by `ZhudaTerrain2DRenderer` in
   chunks around the view, with blocking as tile metadata the game's rules read
   ([2D tile terrain](../terrain-shader.md#2d-tile-terrain)).
8. **Effects.** Take a ready one before making one: `new ZhudaEffect2D(layer, 'coin-burst', { x, y, scale, seed })`
   ([ready effects (2D)](../../packages/core/effects/README.md#ready-effects-2d): twenty
   presets, bursts and loops). Place it by its `origin` (a torch at the bottom of its
   flame, rain at the top of its sky) and fit it by `sizePixels`; each frame
   `update(vfxDelta)` then `render()`; dispose a burst once `seconds >= preset.seconds`;
   move a trail with `setPosition`. An effect of the game's own is a `ParticleEffectSpec`
   checked by `validateParticleEffect` and played by the same renderer; share a budget
   with `ZhudaEffectBudget` when many play at once. Check: the game's prefab or scene
   check draws it at a fixed `seek` time.
9. **Sound.** One `IframeSoundAdapter` for the whole game: unlock it on the first gesture,
   submit logical events by id on channels, stop a panel's voices when it closes
   ([audio](../audio.md)). No second `AudioContext`, no event sent to both WebAudio and
   Laya's `SoundManager`.
10. **Build and claim.** `npm run verify` in the game (build, strict types, Doctor,
    tests), then its real browser report, then a run on each target device, kept in the
    game's repository; claim only the level reached
    ([claim levels](../consumer-route.md#claim-levels)). A mini-game release continues
    with [mini-game-build](mini-game-build.md).

## Pitfalls

- **A particle picture made like a 3D texture.** Laya's 2D blending takes pictures
  premultiplied by their alpha and draws in light, encoding the result for the screen.
  Premultiplied but marked as plain data, a pixel of alpha 0.53 showed as 191 of 255
  instead of 135; made as Laya makes a loaded 2D picture (premultiplied, sRGB) it shows
  134 (measured by `verify:effects-2d`'s probe). A picture not premultiplied at all was
  not drawn here; Laya's blend table adds `lighter` as one plus one, so its transparent
  white would light the whole square.
  `ZhudaEffect2D` does this for the built-in sprites; a game's own particle pictures
  loaded through Laya's loader are made the same way.
- **A trail drawn across the screen at a restart.** A moving emitter lays particles
  along the way from where it was to where it is. `restart()` then `setPosition()`
  lays a line from the old place to the new; move it first, then `restart()`.
- **A browser check that draws yesterday's engine.** The browser SDK bundles
  `dist/sdk`: after changing engine source, `npm run build` before
  `npm run verify:effects-2d` (it drew the old texture settings once here).
- **Bursts never released.** A burst ends by itself but keeps its sprites until
  `dispose()`; dispose it after its `seconds`, or when its panel closes.
- **Double DPR scaling.** Multiplying design coordinates by `devicePixelRatio` on top
  of the runtime's own scaling draws everything twice as large on a phone; remove it
  and recapture the prefab evidence.
- **Two clocks, two audio contexts.** A `setTimeout` for a game timer or a second
  `AudioContext` for one sound escapes pause, hit-stop and teardown; use the session's
  layers and the one adapter.

## Engine gaps and their workarounds

| Gap                                                                                                          | Workaround                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| The 2D effects were drawn on WebGL only; the `2d-webgpu` profile was not drawn (no WebGPU device was at hand) | Run `verify:effects-2d`'s page on the target, or the game's own check, on each backend it ships                 |
| 2D particles are drawn in lifetime bands: colour and alpha change in steps (12 by default)                   | `lifeBands` up to 64 on `ZhudaEffect2D`, or longer fades                                                         |
| 2D particles collide only with planes, not with tiles or shapes                                              | The game's rules decide where a particle may go; kill or burst on the game's own collision with a separate emitter |
| No ready 2D effect is lit, uses a flipbook or a picture of the game's                                        | A `ParticleEffectSpec` of the game's own with its atlas (`textureRect`, `flipbook`)                             |

## Checks

- In the game: `npm run verify`; the prefab checks of every panel and effect it shows;
  its browser report; its device runs (frame time and a touch run on each target).
- In the engine: `npm run verify` (the 2D scaffold builds and passes the source audit);
  `npm run verify:effects-2d` (every ready 2D effect drawn on WebGL: drawn, the same
  bytes at the same time, loops moving, bursts gone after their seconds, a trail along
  its path, the probe's alpha, thirty made and released with no resource left);
  `npm run verify:prefab-browser`.

## Not checked

- No phone ran any part of this route; no frame rate of a 2D effect was measured.
- The ready 2D effects were drawn by SwiftShader (a software WebGL) in a container, not
  on a GPU, and not on WebGPU.
- No game has been built along the whole route; each step is checked on its own.
- The presets were looked at as stills on black and not judged in motion by a person.
- Input latency, audio unlock on a real phone browser, mini-game hosts.

## Boundaries

The engine owns the SDK (layout, clock, input buffer, prefab library and gate, Spine
wrapper, tile terrain, particles and the ready effects, the audio adapter), the
compiler and the Doctor. The game owns its rules, its art, atlases, fonts, rigs, maps,
sounds, its own effects and its devices' evidence, and none of it is copied into the
engine repository.
