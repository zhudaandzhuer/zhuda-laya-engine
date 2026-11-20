# Agent task: ready 3D effects and picture materials

Status: Implemented within scope ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-21

## Source requirement

The owner asked (2026-11-21) whether the engine has a default asset library.
It had three props, five recipes and ten example prefabs. On that answer:
"把沒用都吸移除，然後將素材貼圖 粒子特效 3特效都做好來；生成更多貼圖，各種資產的
貼圖，方便沒取用": take out what is of no use, make textures, particle effects
and 3D effects ready to use, and generate more textures of many kinds so they
are easy to take.

## Goal

An agent building a scene has effects it can place by name and can use a
texture picture as a material, without the engine repository carrying
megabytes of art.

## Change

- **Sprites made by a program** (`packages/core/effects/EffectSprites.ts`):
  eleven white shapes with alpha (`soft`, `disc`, `ring`, `spark`, `streak`,
  `smoke`, `flame`, `flake`, `leaf`, `petal`, `bubble`), baked by
  `bakeZhudaEffectSprite(id, size)`. No file is shipped.
- **Eighteen effects as data** (`EffectPresets.ts`, `ZHUDA_EFFECT_PRESETS_3D`):
  campfire, torch, smoke-column, steam, sparks, explosion, hit, magic-aura,
  heal, portal, fireflies, rain, snow, dust-motes, falling-leaves, petals,
  bubbles, embers. Each is a `ParticleEffectSpec3D` in metres and seconds with
  a kind (`loop` or `burst`), its size and its time.
- **A player** (`Effect3D.ts`, `ZhudaEffect3D`): owns a preset's emitters,
  textures and renderers; `update` and `render` for a game, `seek(seconds)`
  for a film (stepped at 120 Hz from its start, so a time is a state),
  `scaleZhudaEffect3D` for a size, `dispose`.
- **A film scene's `effect` node**: `preset`, `position`, `yawDeg`, `scale`,
  `startSec`, `seed`; at most 32 a scene.
- **A film material that is a picture** (`{ picture, normal, tileMeters,
  roughness, metallic, tint, normalConvention, normalStrength }`): a `.png`
  or `.jpg` among the scene's assets as the surface's colour, loaded through
  the film assets' picture cache and released with the stage.
- The pictures themselves (48 tileable sets generated with an image model)
  are **not** in this repository: they are in the owner's workspace
  (`ZhudaGameCenter/commonAssets/`) and are served to a scene with
  `--film-assets`.

## Invariants

- Nothing binary is added to the repository or the package.
- The existing particle system, its descriptors and its renderers are used
  as they are; no second particle system.
- A scene without the new node and material mounts as before.
- Pictures go through `AssetProvider` and the film assets' cache with its
  lease, cancellation and release; a failed load releases what was loaded.
- An effect has an explicit release path (`dispose`), and a film effect's
  state depends only on shot time.

## Non-goals

- **Removing built-in assets.** All eleven files under `assets/` are read by
  tests, the showcase or the guides (3 to 10 references each); none is
  unused. Which of them the owner means to drop was not decided: nothing
  was removed.
- Ready 2D effects: the 2D system has descriptors and renderers, no presets.
- Lit or shadow-casting particles, soft particles (fading where they meet
  geometry), and effects that light the scene.
- Roughness, metallic or height pictures for a picture material; triplanar
  projection, `detail` and `variation` for it.
- More starter props.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`,
   `git diff --check`.
2. `npm run verify:film-effects` and `npm run verify:film-picture-material`
   (both new) on WebGL, and in `npm run verify:film-webgpu`.
3. Neighbours on WebGL: `verify:film`, `verify:film-look`,
   `verify:film-terrain`, `verify:film-grass`, `verify:film-cutout`,
   `verify:film-model`.

## Unverified limits

See the [verification](verification.md).

## Rollback

`b63cc20` is the last commit without these. The effects are one commit and
the picture material another; each can be reverted alone.
