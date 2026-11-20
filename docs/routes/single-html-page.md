# Route: a single HTML page that loads the real runtime

One HTML file that loads the engine's published browser bundle from a fixed URL
with an integrity hash and uses the public API under the `Zhuda` namespace: no npm,
no TypeScript build. For prototypes, embeds and pages an agent writes in one piece.
The bundles are built and drawn on a desktop.

- **Id:** `single-html-page`
- **Kind:** workflow
- **For:** A prototype, demo or embed that must be one HTML file: which template to start from, how the runtime is loaded and pinned, and what such a page does not prove.
- **Checked on:** desktop WebGL; desktop WebGPU (the WebGPU profiles); no phone
- **Status:** the bundles and their example pages are built and drawn by
  `npm run verify:browser-sdk`, `verify:branding` and `verify:webgpu` on a desktop;
  a packed install produces byte-identical bundles.
- **Reference consumer:** `examples/browser-sdk/2d.html` and `3d.html` in this
  repository; the hosted entry at `game.qianlongxundao.com/play/zhuda-engine-sdk/`.
- **Engine version:** the release named first in
  [browser-sdk-releases.json](../browser-sdk-releases.json).

## When to take this route

Only when a single HTML file is asked for. A game that will be delivered takes
[new-game-project](new-game-project.md): a booting page is browser-runtime evidence,
not a passed consumer Doctor.

## Tools

- The templates `examples/browser-sdk/2d.html` and `3d.html`.
- `npm run build:browser` in the engine, or `zhuda-laya-browser-sdk --out <dir>`
  from an installed package; profiles `2d`, `3d`, `3d-gltf` and their `-webgpu`
  forms.
- Editor types: `/// <reference types="zhuda-laya-engine/browser" />`.

## Steps

The guide, with the pinned URLs, is [Browser SDK](../browser-sdk.md).

1. **Copy a template** (2D or 3D). Keep its script URL at the full fixed version,
   with `integrity` and `crossorigin`.
2. **Use `Zhuda` only.** Read the public declarations before calling an API. One
   runtime: no second Laya, no other renderer, no class of your own named like the
   engine's.
3. **Pick the profile the page needs**: `3d-gltf` for models and post-processing;
   the plain `3d` profile is smaller and has neither.
4. **Keep the engine's contracts**: logical time, input, audio and release work as
   in a project; the game and an isolated preview share one prefab definition.
5. **Serve it over HTTP** from a host whose content policy allows the script source.

## Pitfalls

- **A sandbox that blocks the script source** (a canvas, an artifact, an embed):
  the SDK cannot get round a content security policy; use an allowed attachment or
  a plain HTTP preview.
- **It is not an offline file**: the HTML is one file, the SDK comes from the network.
- **A moving version**: without the fixed version URL and its hash the page changes
  when the SDK does.
- **No Worker in the hosted sandbox**: `ZhudaWorkerFrameDriver` falls back to
  `requestAnimationFrame` there, or is used on a page that allows Workers.
- **Overwriting a release directory**: the build refuses a directory that holds
  different output; use a new one.

## Engine gaps and their workarounds

The Doctor checks npm and TypeScript consumers; it does not pass a plain HTML page
as a whole. For delivery move the page into a project
([new-game-project](new-game-project.md)).

## Checks

`npm run verify:browser-sdk`, `npm run verify:branding`, `npm run verify:webgpu`
(each builds the current source into a fresh directory unless `SDK_BROWSER_DIR` or
`WEBGPU_BROWSER_DIR` names a release to check).

## Not checked

Windows hardware and phones for the hosted bundles; every audio and background
policy inside the hosted sandbox. The example page's buttons do not stand for a
game's acceptance.

## Boundaries

The engine publishes versioned bundles; the release directory is not a game's asset
store. A game's own assets go through its `AssetProvider`.
