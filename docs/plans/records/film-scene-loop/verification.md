# Verification record: film-scene-loop

Task document: [task.md](task.md)  
Commit: the commit containing this record (base 1.17.0)  
Date: 2026-11-10

## Environment

- macOS, Google Chrome 157 headless; WebGL through ANGLE Metal on Apple M4.
- Node v26.12.0, npm 11.20.0, ffmpeg/ffprobe from Homebrew.

## Checks

| Check | Exact command or procedure | Result |
| --- | --- | --- |
| Schema, patches, camera paths, sessions, JSON-RPC data calls | `node --test tests/film-scene.test.mjs` | PASS, 5 tests: every malformed field reported with its path (including an injected `onLoad` field); patches leave the input untouched and fail as a whole; stale and missing revisions refused; LRU eviction; non-film tools still answer synchronously |
| Full gate | `npm run verify` | PASS, 357/357 |
| Lint / format | `npm run lint`, `npm run format:check` | PASS |
| End-to-end over MCP stdio | `npm run verify:film` | PASS, 14 calls (below) |
| Installed package | `npm pack`, install into a path with a space and CJK characters, run `node_modules/.bin/zhuda-laya-mcp --film-output films`, create, preview, still job, close stdin early | PASS: preview image returned, `films/packed.png` written, server answered every request before exiting |
| Moved Chrome launcher | `verify:prefab-browser`, `prefab-editor-play`, `runtime-feedback`, `procedural`, `cinematic` | PASS, all five |

### `verify:film` protocol

| Step | Result |
| --- | --- |
| `film_scene_create` | revision 0; host props `container20`, `jersey-barrier`, `pallet`; five recipes |
| `film_scene_preview` | 640×360 PNG, 4 material batches (asphalt, galvanized steel, painted steel, wood), 25 ms render |
| `film_scene_apply`, stale revision | refused: `Stale revision` |
| `film_scene_apply`, unknown prop | refused: `unknown prop rocket` |
| `film_scene_apply`, extra `script` field | refused: `unknown field` |
| `film_scene_get` | still revision 0 |
| `film_scene_apply` with `preview: true` | revision 1; image returned; 68.9 % of pixels changed (red container, barrier, lower sun) |
| `film_scene_review` | one 644×484 PNG with four labelled 320×240 shots (wide, side, low, top) |
| `film_render_job` still ×2 | 1280×720, 16 samples, 199 ms; both PNGs SHA-256 `859308f0…fdbe68` (identical) |
| `film_render_job` same name again | refused: file exists |
| `film_render_job` name `../escape` | refused before any IO |
| `film_render_job` video | 640×360, 12 fps, 2 s, 2 samples; ffprobe: h264, 24 frames |
| `film_scene_close` | closed |

## Design notes

- Every image goes through `ZhudaCinematicCapture` with
  `ZhudaPhysicalCameraRig`; previews use one sample, final renders add
  jitter and aperture samples. The runtime is paused while a renderer exists.
- The page bundles only the neutral starter props and recipes next to the
  public `3d` browser bundle; scene JSON is the only input it receives.
- The host serves three fixed files on 127.0.0.1 with a Host check.
- The headless Chrome launcher moved from `scripts/lib` into
  `packages/compiler/chrome-host.mjs` so the installed package can start it;
  the test path re-exports it.

## Limits and decision

- No sun shadows yet; with the physical sky, fog and look presets this is
  phase 2.
- Camera paths ease linearly between keys; splines and shot lists are phase 3.
- No audio in render jobs, no glTF assets in film scenes, no path tracing.
- Desktop WebGL only; WebGPU and mobile hosts are not covered.

Decision: **Implemented within scope; desktop WebGL verified.**
