# Verification: sky-island effects

Date: 2026-11-16
Branch: `feat/sky-island-effects` (worktree `engines/zhuda-laya-engine-island`), from `3b63fee`, uncommitted
Machine: Apple M4, macOS, Chrome 157 (headless, ANGLE Metal)

| Command | Result |
| --- | --- |
| `npm run verify` | pass: build, typecheck, declarations audit, doctor, 841 tests |
| `git diff --check` | clean |
| `npm run verify:grass` | PASS on webgl (701,048 blades; wind, shadowed grass, far cover as before) |
| `GRASS_RENDERER=webgpu npm run verify:grass` | PASS on webgpu |
| `npm run verify:film-clouds` | ok: true, no GL errors |
| `npm run verify:film-fog` | ok: true |

## Consumer draw (outside this repository)

`games/zhuda-sky-island`, built with `ZHUDA_ENGINE_ROOT` set to this worktree,
`RENDERER=webgpu` and `RENDERER=webgl`, scenario `tools/scenarios/hero.json`:
no renderer errors and no page errors on either backend. Its `evidence/`
holds the frames: the cloud sea below the island (`c-sea-day.png`,
`hero-day-*.png`), stars and rain after `lightFog.maxDistance` (`hero-night-*`,
`hero-storm-*`), and the light-fog comparison that found the problem
(`p-rain-q0.png` rain shown with no grade, `p-rain-q2.png` gone with the
grade, `p-rain-off=fog.png` back with the light fog off).

## Not verified

- No phone.
- No draw check in this repository for a cloud layer below the eye or for
  `setBenders` (the consumer's frames are the only drawn evidence); the
  engine's own draw checks were run to show nothing else changed.
- Frame cost of the benders (four more vec4s and four calls a vertex) not measured.
