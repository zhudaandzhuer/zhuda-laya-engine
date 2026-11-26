# Route: a new game project on the engine

A game repository of its own that pins the engine, imports only its public SDK,
builds by itself and passes the engine's Doctor. Whatever the game is (2D, 3D, a
slot, an action game), this is how its project starts and how it is verified.
Checked by the engine's own tests on a desktop; each game records its own devices.

- **Id:** `new-game-project`
- **Kind:** workflow
- **For:** Starting any game or app on the engine: the project's shape, its engine pin, its build and the checks that let it claim to be built with the engine.
- **Checked on:** desktop (macOS, Linux and Windows in CI); no phone
- **Status:** the scaffold, the consumer build and the Doctor are exercised by
  `npm run verify` in this repository on every change; a generated project's
  `npm run verify` passes on macOS, Linux and Windows CI.
- **Reference consumer:** the project `zhuda-laya-init` writes; any game under
  `games/` in the owner's workspace follows it.
- **Engine version:** 1.18.0 (this checkout).

## When to take this route

Always, for a game that will be delivered: take it first, then the route for the
scene. Not for a one-file prototype (take [single-html-page](single-html-page.md)),
not for a film or a still (take [film-as-data](film-as-data.md)), and not for work
on the engine itself (read `AGENTS.md`).

## Tools

- `zhuda-laya-init` (`node packages/compiler/zhuda-init.mjs`): writes the project.
- In the project: `zhuda-laya-build`, `zhuda-laya-doctor`, `zhuda-laya-accept`,
  `zhuda-laya-watch`. Node 24 or newer. For the edit loop run
  `zhuda-laya-watch --candidate`: a save that changes only `src/` rebuilds `app.js`
  alone and reloads the page
  ([rules](../consumer-tooling.md#the-watcher-saves-that-change-only-scripts)).
- MCP: `get_agent_contract`, `list_routes`, `get_route`.

## Steps

1. **Create the project outside the engine checkout.**
   `node packages/compiler/zhuda-init.mjs /absolute/path/to/my-game`, then
   `npm install` there. From an installed package pass
   `--engine github:zhudaandzhuer/zhuda-laya-engine#<commit-sha>`. Check:
   `package.json` holds the engine at an exact version or a Git URL ending in a
   commit SHA (no range, branch, `latest`, `file:`, `link:` or `workspace:`).
2. **Keep the required shape.** `package.json`, `zhuda.config.json`,
   `public/index.html` with `<!-- ZHUDA_LIBS -->` and `<!-- ZHUDA_ENTRY -->` once
   each, `src/Main.ts`, `assets/`. See
   [consumer route](../consumer-route.md#required-shape).
3. **Boot through the public SDK.** `src/Main.ts` imports from
   `zhuda-laya-engine`, boots one runtime session (`ZhudaEngine.boot`) on the game's
   real container with an explicit DPR, builds the scene through public contracts
   and starts the runtime. Check: `npm run typecheck`.
4. **Verify in order.** `npm run build`, `npm run typecheck`, `npm run doctor`,
   `npm test`; `npm run verify` runs all four. Check: the Doctor prints HEALTHY for
   the target it names.
5. **Visual content goes through prefabs.** Take
   [visual-content-prefab](visual-content-prefab.md); when its evidence is missing
   or stale use `npm run build:candidate` then `npm run accept:prefabs`.
6. **Add the real browser report, then the device reports**, to the game's
   repository, and claim only the level reached
   ([claim levels](../consumer-route.md#claim-levels)).
7. **Copy the engine's rules into the game's own `AGENTS.md`**: the adoption text in
   [prefab workflow](../prefab-workflow.md) and the route you take for the scene.

## Pitfalls

- **A pin that moves.** A branch name or a range builds today and differs
  tomorrow; the Doctor rejects it. Pin a commit SHA.
- **Deep imports and facades.** Importing `packages/core` or `vendor`, declaring
  `Laya: any`, writing a `ZhudaEngine` class of one's own, or drawing with Three.js
  all fail the Doctor with file and line.
- **A build is not a drawn frame.** `dist/consumer-build.json` and the payload
  manifest say what was built, not that a browser rendered it.
- **Stale engine build in a workspace.** A game that builds against a local engine
  checkout uses that checkout's `dist/sdk`: rebuild the engine after pulling it.
- **Removing the release gate to get a preview.** Use `--candidate` instead.

## Engine gaps and their workarounds

None recorded for the project shape. A missing public API is reported with a
failing consumer fixture, not worked around by vendoring the engine.

## Checks

- In the game: `npm run verify` (build, strict types, Doctor, tests).
- In the engine: `npm run verify` covers the scaffold and the consumer build;
  `npm run verify:webgpu-consumer` a WebGPU consumer.
- Device acceptance is the game's: a frame-time recording and a touch run on each
  target, kept in the game's repository.

## Not checked

- No phone and no mini-game host is checked by this route: see
  [mini-game-build](mini-game-build.md) for packaging.
- HEALTHY covers the Doctor's static checks only: not rendering, not performance.

## Boundaries

The engine owns the SDK, compiler, types, diagnostics and neutral fixtures. The game
owns its rules, network authority, art, models, textures, audio, prefabs, scenes and
deployment, and none of it is copied into the engine repository.
