# Canonical consumer route

This is the shortest supported path for a game project that uses
`zhuda-laya-engine`. The engine repository owns the SDK, compiler, types,
diagnostics and neutral fixtures. The consumer repository owns game rules,
network authority, art, models, textures, audio, prefabs, scenes and deploy
configuration.

## Start from a consumer checkout

Keep the game outside the engine checkout. From a cloned engine repository,
the starter command creates the required files and pins the current commit:

```sh
# run from a cloned engine checkout after its npm install
node packages/compiler/zhuda-init.mjs /absolute/path/to/my-game
cd /absolute/path/to/my-game
npm install
npm run verify
```

When the CLI is installed from a package without a Git checkout, pass an exact
version or commit-pinned Git specification:

```sh
node /absolute/path/to/zhuda-laya-engine/packages/compiler/zhuda-init.mjs \
  /absolute/path/to/my-game \
  --engine github:zhudaandzhuer/zhuda-laya-engine#<commit-sha>
```

The generated `package.json` must keep `zhuda-laya-engine` at an exact version
or a Git URL ending in a commit SHA. `workspace:`, `file:`, `link:`, ranges,
branches and `latest` are not reproducible consumer pins.

## Required shape

```text
my-game/
  package.json             # exact engine pin and verify scripts
  zhuda.config.json        # src/Main.ts, dist/web, selected features
  public/index.html        # consumer DOM plus both ZHUDA markers
  src/Main.ts              # public SDK import and ZhudaEngine.boot
  assets/                  # consumer-owned logical assets, if any
  dist/                    # generated and ignored
```

`public/index.html` keeps these markers exactly once. The consumer owns the
surrounding HTML, CSS and DOM; `runConsumerBuild` injects the ordered Laya
libraries and the bundled entry at those locations:

```html
<!-- ZHUDA_LIBS -->
<!-- ZHUDA_ENTRY -->
```

`src/Main.ts` imports from the public package root, boots one runtime session,
creates the scene through public contracts, and starts the runtime. Use the
consumer's real container and explicit DPR configuration. Do not deep-import
`packages/core`, `vendor` or engine source files.

## Verification order

Run these commands in the consumer repository:

```sh
npm run build       # independent consumer build and dist/game.zip
npm run typecheck   # strict consumer declarations
npm run doctor      # public boundary, pin, boot and HTML checks
npm test            # consumer tests
npm run verify      # all of the above
```

The generated `dist/consumer-build.json` and `dist/web/payload-manifest.json`
record the build payload and its fingerprint. They do not claim that a browser
rendered a frame. Add the real browser/WebGL report, then the target device
reports, to the consumer repository before calling a result accepted.

See [consumer tooling](consumer-tooling.md) for staged publication, asset allowlists,
shared preview provider factories and measured viewport/DPR evidence. Existing
schema 1 Prefab evidence must be regenerated with the schema 2 checker.

## Visual route

For new or changed visual content, use the same definition in isolation and in
the scene:

1. Inventory source models, textures, atlases, Spine data and presentation
   states in the consumer repository.
2. Author a consumer-owned prefab with stable logical asset IDs.
3. Run the isolated prefab preview and select the named child/state with
   deterministic inputs.
4. Compare the actual draw to the approved reference and record source hashes,
   dependency revisions, environment and diff.
5. Compose only passing children into the panel, verify the panel, then mount
   that exact definition in the scene.

Use [`prefab-workflow.md`](prefab-workflow.md) for the evidence schema and
`zhuda-prefab-check` for the real desktop WebGL comparison. A validator,
fingerprint or static Doctor result cannot establish mobile support or game
performance.

Doctor defaults to the current working directory, prints the resolved target,
and fails when no application sources are found. `--project /path/to/game`
selects an explicit target. HEALTHY only covers the reported static checks.

## What the Doctor rejects

The consumer guard is deliberately strict about false engine integrations. It
reports the file and line for:

- missing or unpinned `zhuda-laya-engine` dependency;
- missing public SDK import or missing `ZhudaEngine.boot`/
  `ZhudaRuntimeHost` entry;
- private engine imports, copied `packages/core`, or `Laya: any`;
- Three.js imports, CDN scripts or renderer construction in consumer source;
- inline `ZhudaEngine`, `Zhuda3D`, `ZhudaCameraRig` or Laya facade classes;
- missing consumer HTML, required markers or configured entry.

Procedural geometry is valid engine usage when it is created through the public
Zhuda/Laya runtime. It still does not satisfy the Prefab evidence gate when the
visual route requires authored source assets.

Use input buffers, layered clocks and action frame contracts where the game
needs their behavior; exporting combat APIs does not make them mandatory for a
slot or static UI. Original sample/BGM playback uses IframeSoundAdapter with provider-backed
loadSample/playSample ([audio contract](audio.md)). Do not create a second mixer.

## Claim levels

Use precise labels in README files and reports:

| Level | Evidence | Allowed claim |
| --- | --- | --- |
| Prototype | Source exists, no consumer gate | “prototype” |
| Engine-backed | pinned SDK, public import, build, Doctor and tests | “built with zhuda-laya-engine” |
| Prefab-qualified | isolated prefab and composed-scene evidence pass | “uses verified consumer prefabs” |
| Device-accepted | target browser/device reports pass | claim only the measured device/browser scope |

Do not call a Three.js mock, a hand-written Zhuda facade or a screenshot-only
prototype “powered by zhuda-laya-engine”.
