# Backend delivery: one page for WebGPU and WebGL

A page that starts WebGPU where the browser has a real adapter and WebGL
everywhere else, and says why; WebGPU shader compilers that are downloaded
once for an origin; and what each bundle weighs. Drawn in a real browser by
`npm run verify:backend-delivery`.

| What                                      | How                                                       |
| ----------------------------------------- | --------------------------------------------------------- |
| One page, the right backend               | `zhuda-loader.js`, or `"renderer": "auto"` in a build     |
| Why the page is on WebGL                  | `context.renderer.fallbackReason`                         |
| A WebGPU that loaded and did not start    | `ZhudaLoader.retry(reason)` / `retryZhudaBackend`         |
| A game's own "WebGPU off" setting         | `prefer: 'webgl'` / `window.ZhudaBackendPrefer`           |
| Compilers fetched, and kept by their hash | consumer builds; `zhuda-laya-browser-sdk --wasm external` |

## Why it is a loader and not a fallback

A realm holds one backend. LayaAir's libraries for the two cannot be loaded
together, and a realm that started WebGPU cannot start anything again. So
nothing falls back after the fact: the page asks the browser first and then
loads the libraries of one backend only. `ZhudaEngine.boot` is as strict as
before: a WebGPU request that fails rejects, it does not return WebGL.

The loader is a script of its own, 5.3 KB (2.2 KB gzipped), that needs
neither LayaAir nor the engine. It asks `navigator.gpu.requestAdapter()`
(no device is made), chooses, and adds the scripts of one backend to the
page in their order.

## A single HTML page

`zhuda-laya-browser-sdk` writes `zhuda-loader.js` beside the bundles, and an
`example-<profile>-auto.html` for each pair of them.

```html
<script src="zhuda-loader.js" integrity="sha384-…" crossorigin="anonymous"></script>
<script>
  ZhudaLoader.load({
    webgpu: [{ src: 'zhuda-3d-webgpu.js', integrity: 'sha384-…' }],
    webgl: [{ src: 'zhuda-3d.js', integrity: 'sha384-…' }],
  }).then(async (backend) => {
    // backend.backend: 'webgpu' | 'webgl'; backend.fallbackReason: why not WebGPU
    try {
      const context = await Zhuda.ZhudaEngine.boot({
        container: '#game',
        features: [...ZhudaBundle.features],
      });
      console.log(context.renderer.selected, context.renderer.fallbackReason);
    } catch (error) {
      // WebGPU loaded and did not start: the page again, on WebGL.
      if (!ZhudaLoader.retry(String(error))) showTheError(error);
    }
  });
</script>
```

The integrity values are in `sdk-manifest.json` (`loader` and each profile).
The loader is part of a build of the SDK from this version on; the hosted
release recorded in `browser-sdk-releases.json` (1.17.0) does not have it.

## A consumer build

```json
{ "renderer": "auto", "features": ["core", "2d", "3d", "ui"] }
```

The build copies the libraries of both backends and puts one loader call
where the library tags were; the game's `app.js` runs after the libraries of
the backend that was chosen. The game boots without a `renderer`:

```ts
import { ZhudaEngine, retryZhudaBackend } from 'zhuda-laya-engine';

try {
  const context = await ZhudaEngine.boot({ container: '#game', features });
  report(context.renderer.selected, context.renderer.fallbackReason);
} catch (error) {
  if (!retryZhudaBackend(String(error))) showTheError(error);
}
```

- `payload-manifest.json` and `consumer-build.json` say `"renderer": "auto"`
  and list what each backend loads under `backends`.
- The Doctor reads both orders out of the loader call and audits each.
- The prefab preview, and so the prefab evidence, is built on WebGL. Evidence
  is for one backend, as before: WebGL pixels do not certify WebGPU.
- The mini-game route stays WebGL only.
- The game's script runs after the browser has answered (0.1 to 50 ms
  measured; three seconds at most), so it can run after `DOMContentLoaded`.

## How it chooses

`chooseZhudaBackend(facts, options, retry)` is the whole decision, with
nothing asked of the browser: the same facts give the same answer.

| The browser                                     | Backend | `fallbackReason`           |
| ----------------------------------------------- | ------- | -------------------------- |
| a hardware adapter                              | WebGPU  | `null`                     |
| the page is not HTTPS or localhost              | WebGL   | `insecure-context`         |
| no `navigator.gpu`                              | WebGL   | `no-webgpu-api`            |
| no adapter                                      | WebGL   | `no-adapter`               |
| an adapter that draws on the CPU                | WebGL   | `software-adapter`         |
| `requestAdapter` throws                         | WebGL   | `adapter-error: <message>` |
| no answer in `timeoutMs` (default 3000)         | WebGL   | `adapter-timeout`          |
| the WebGPU bundle does not load                 | WebGL   | `bundle-failed: <address>` |
| the page before this one called `retry`         | WebGL   | `retry: <reason>`          |
| the page said `prefer: 'webgl'` (nothing asked) | WebGL   | `null`                     |

`allowSoftware: true` takes a CPU adapter for WebGPU. The reason is on
`globalThis.ZhudaBackend` (with what the browser said and how long it took)
and in `context.renderer.fallbackReason`. It is `null` on WebGPU and on a
page built for one backend.

## When WebGPU is chosen and does not work

- **Its first script does not load** (network, a wrong integrity): nothing
  of WebGPU has run, so the same page loads WebGL (`bundle-failed`).
- **A later library does not load** (a consumer build): the realm holds half
  a backend. `load()` rejects with `code: 'ZHUDA_LOADER_PARTIAL'`; the
  page a build writes then loads itself again on WebGL.
- **It loads and does not start** (no device, the compilers do not arrive,
  the device is lost): the game calls `ZhudaLoader.retry(reason)` or
  `retryZhudaBackend(reason)`. The page is loaded again and the loader takes
  WebGL without asking the browser, with `retry: <reason>`.

A retry holds for one load: the reason travels in the page's session storage
and is removed when it is read. It returns `false` and does nothing on a
page that is already on WebGL (so it cannot loop) and on a page without
session storage (a sandboxed frame), where the game shows its own message.

## A game's own setting

Which backend a player wants is the game's setting, not the engine's. A
game that offers "WebGPU off" stores that itself and tells the loader:

```html
<script>
  if (localStorage.getItem('my-game.webgpu') === 'off') window.ZhudaBackendPrefer = 'webgl';
</script>
<!-- ZHUDA_LIBS -->
```

(`prefer: 'webgl'` in a hand-written `ZhudaLoader.load`.) The browser is
then not asked, and `fallbackReason` is `null`: WebGL was chosen, not fallen
back to.

## The shader compilers

WebGPU needs two WebAssembly compilers (GLSL to SPIR-V, SPIR-V to WGSL),
5.9 MB together. There are two ways they travel:

- **In the bundle** (the browser SDK's default): one file under one
  integrity value. The bundle is 11.8 MB (3.4 MB gzipped) for `3d-webgpu`.
- **Beside it** (`zhuda-laya-browser-sdk --wasm external`, and every
  consumer build): fetched when the renderer starts, checked against the
  SHA-256 pinned in the bundle, and kept in the origin's Cache Storage under
  that hash.

Kept by hash, they are downloaded once for an origin: a new release of a
game or of the SDK, at a new address, finds them. What comes out of the
cache is checked like what comes off the network; an entry that fails is
deleted and fetched. A page without Cache Storage (a sandboxed frame, an
insecure page) fetches every time and starts all the same.

`context.renderer.compilers` says where they came from and how long it took
until both were ready:

| Where the compilers came from               | `from`    | ms until ready (desktop, localhost) |
| ------------------------------------------- | --------- | ----------------------------------- |
| in the bundle (7.9 MB of text to decode)    | `inline`  | 196, 210, 199                       |
| the network, first visit                    | `network` | 49, 36, 35                          |
| the cache, a later visit at another address | `cache`   | 11, 12, 11                          |

## What travels

Bytes, and what a server sends with gzip (level 9) or Brotli (quality 9):

| File                                   |      Bytes |      gzip |    Brotli |
| -------------------------------------- | ---------: | --------: | --------: |
| `zhuda-2d.js`                          |  2,225,690 |   649,435 |   574,502 |
| `zhuda-3d.js`                          |  2,987,324 |   835,095 |   727,636 |
| `zhuda-3d-gltf.js`                     |  3,147,172 |   872,780 |   758,643 |
| `zhuda-2d-webgpu.js`                   | 10,805,360 | 3,190,851 | 2,643,048 |
| `zhuda-3d-webgpu.js`                   | 11,830,201 | 3,407,335 | 2,817,110 |
| `zhuda-3d-gltf-webgpu.js`              | 11,990,049 | 3,445,818 | 2,847,565 |
| `zhuda-loader.js`                      |      5,297 |     2,200 |     2,071 |
| `zhuda-3d-webgpu.js`, compilers beside |  3,907,207 |   949,121 |   817,526 |
| `shader_compiler_web.wasm`             |  2,714,840 |   818,287 |   686,670 |
| `nagabind_bg.wasm`                     |  3,227,417 |   887,047 |   723,783 |

With the loader a phone without WebGPU downloads 0.84 MB (gzip) for 3D and
nothing of the other 3.4 MB. A WebGPU page with its compilers beside it
downloads 2.65 MB the first time (0.75 MB less than with them inside) and
0.95 MB on every later release.

## `ui` in the 3D bundles

The 3D profiles carry LayaAir's UI library (`laya.ui.js`). The 3D bundle
with that library cut out starts, runs its 30 load and release cycles and
draws the same picture; it is 110,855 bytes smaller, 24,707 gzipped (3 % of
the bundle). The profiles were left as they are: a page that uses
`Laya.Button` or `Laya.Image` with the 3D bundle would break for 25 KB. A
consumer build already chooses: leave `"ui"` out of `features`.

## Limits

- One desktop GPU (Apple M4, Chrome). Which backend a phone's browser gets,
  and how long its compilers take, was not measured: no phone was reachable.
- The insecure-context row is unit-tested, not drawn: the check's pages are
  on localhost.
- No SDK release was published with the loader; `--publish` was not run.
- The time until a page is ready was not compared between the two ways the
  compilers travel beyond the compilers' own time above.
- WebGPU on Windows, Android and iOS stays as `docs/webgpu.md` says.
