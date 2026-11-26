# Verification: light shafts that do not redraw for every step of a game's sun

Base commit `45f8664` plus the changes of this record (committed after these runs). Desktop: macOS 27, Apple M4,
headless Chrome through the repository's `chromeFixture`, 2026-11-16. Phone:
vivo V40 (V2348, Android 16), Chrome 157, WebGPU, over wireless ADB with the
page served from the Mac through `adb reverse` (a secure `localhost` page, as
the published HTTPS site is).

Evidence, kept outside the repository: `EV` =
`<workspace>/audits/shaft-sun-turn-2026-11-16/`.

| Command                                                                                        | Result                                                              | Artifact                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------ |
| `node --test tests/light-fog.test.mjs`                                                         | PASS, 5                                                             | —                              |
| `npm run verify:shaft-turn` (WebGL, `canvas: webgl2`)                                          | PASS                                                                | `EV/desktop-webgl/`            |
| `SHAFT_TURN_RENDERER=webgpu npm run verify:shaft-turn` (`canvas: webgpu`)                      | PASS                                                                | `EV/desktop-webgpu/`           |
| The same check with `LightFog.ts` of `45f8664` (rebuilt `dist/sdk`, then restored and rebuilt) | FAIL as it should: redrawn 0.3 degrees on; 60 pictures in 60 frames | `EV/desktop-webgl-before-fix/` |
| `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`                   | PASS: 849 of 849; lint, format and whitespace clean                 | —                              |

## The desktop check

A long dark wall in the eastern sun at 30 degrees, black fog with shafts, a
game's look (`ZhudaSceneLook`, `moved` refresh), the look changed in place
(`setLook` returned `updated` every time).

|                                                                 | WebGL | WebGPU |
| --------------------------------------------------------------- | ----- | ------ |
| Pictures drawn for a 0.3 degree turn                            | 0     | 0      |
| Pictures drawn for a 3 degree climb in 60 frames                | 6     | 6      |
| Mean brightness difference, kept picture against a fresh one    | 0.045 | 0.041  |
| The same between two fresh frames (step noise alone)            | 0.045 | 0.043  |
| Ray just under the shade line, 30.3 degrees (kept), red channel | 9.0   | 8.5    |
| The same ray with the sun at 40 degrees (fresh picture)         | 107.5 | 107.4  |

## On the phone (consumer game, medium setting)

`games/zhuda-spacetime-3d`, built against this checkout with
`ZHUDA_ENGINE_ROOT` (not published). `gpuCost(2, 40)` is the game's own check:
frames drawn back to back while walking, the GPU made to finish.

Before the change, one load, parts taken away live (`EV/v40/phone-parts-*.log`):

| Frame at level 2                                   | ms         |
| -------------------------------------------------- | ---------- |
| As shipped                                         | 84–86      |
| No clouds; no auto exposure; no motion blur (each) | 82–84      |
| Shadows 4096 to 2048, 4 to 1 cascade, or every 3rd | 78–84      |
| Shaft steps 32 to 16, or quarter size              | 82–84      |
| Fog without shafts                                 | 42–43      |
| Clock stopped                                      | 49–56      |
| Clock stopped, fog without shafts                  | 43–49      |
| Level 1 (no shafts) / level 0                      | 33–36 / 21 |

The HUD showed 11 to 12 frames a second and the quality governor's lower
resolutions (85, 70, 60 %) did not change it. WebGL on the same phone was
slower still (140–230 ms, `EV/v40/phone-measure-3.log`). The foliage of
`45f8664` costs nothing measurable there (81 ms with it, 80.6 without, 80.7
without wind; `EV/v40/phone-measure-1.log`).

After the change (`EV/v40/phone-parts-fixed.log`): 49–51 ms with the clock
running, 45–48 without shafts, 48–52 with the clock stopped. Frames a second
counted by `requestAnimationFrame` over 3 s with the player standing: 22.5
with the clock running, 24.1 stopped (`EV/v40/phone-profile.log`). The HUD,
36 s after load as a player sees it: 14 at first, then 19 to 21 once the
governor settled at 60 %.

The remaining time is JavaScript on the main thread: a 6 s CPU profile is
fully busy, led by Laya's `_preUpdatePre`, `_commonCullByDirectLightShadow`,
WebGPU `submit`, camera culling and bind groups
(`EV/v40/profile-*.cpuprofile`).

## Not verified

- iPhone; the V40 on WebGL after the change.
- The long frame of a redraw (about 40 ms on the V40) still comes about once
  a second in this game (its sun turns about half a degree a second); not
  measured as a stutter.
