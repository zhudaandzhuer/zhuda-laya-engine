# Verification record: backend-delivery

Task document: `docs/plans/records/backend-delivery/task.md`\
Commit: the commit that adds this file, on top of `6fa11e7`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`. WebGPU: adapter apple / metal-3, not a fallback.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `6fa11e7`; the consumer is the
  neutral fixture of `tests/fixtures/webgpu`, built by the check.
- DPR, viewport and network mode: DPR 1, 1000 by 900, loopback, every
  response `no-store`.
- Evidence (outside the repository): `batch2-evidence/backend-delivery/` in
  the session's notes folder: the check's report and pictures, and the
  sweep's logs.

## Checks

| Check                                     | Exact command or procedure                                                                | Result                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                                                          | PASS, 714 of 714 (10 in `tests/backend-delivery.test.mjs`) |
| Format, lint, whitespace                  | `npm run format:check`, `npm run lint`, `git diff --check`                                | PASS                                                       |
| Backend delivery in a browser             | `npm run verify:backend-delivery`                                                         | PASS: 15 page cases, 5 compiler cases, 6 consumer cases    |
| The same page on a phone                  | the auto page in Chrome on the vivo V40                                                   | UNAVAILABLE: the phone was not reachable over ADB          |
| The older draws, WebGL                    | the 39 film, look, effect and model draws, and the eleven that run on one backend         | PASS, 51 of 51                                             |
| The older draws, WebGPU                   | the same 39 with the WebGPU switch (every one starts through the changed compiler loader) | PASS, 39 of 39                                             |

The eleven are the nine of `records/lighting-depth/verification.md`,
`verify-browser-sdk` and `verify-branding-browser`; the WebGL run also
holds `verify-backend-delivery` itself.

## What is drawn

Nothing is checked in. The check builds the browser distribution twice
(compilers inside, compilers beside) and a consumer project with
`"renderer": "auto"`, serves them from one local server that logs every
request, and opens the pages in a fresh browser whose `navigator.gpu` is
left alone or made to answer in a given way before the page's first script.
A page counts as drawn when more than 2 % of its canvas differs from the
canvas's corner; the pictures were looked at.

## Results

- **Each pair of bundles as one page** (`example-2d-auto.html`,
  `example-3d-auto.html`, `example-3d-gltf-auto.html`). With the real
  browser: WebGPU (`WebGPURenderEngine`, a hardware adapter),
  `fallbackReason` `null`, the WebGPU bundle requested once and the WebGL
  bundle not at all. Without `navigator.gpu`: WebGL, `no-webgpu-api`, the
  WebGL bundle once and the WebGPU bundle not at all. Both run their 30
  load and release cycles with the same resource counts before and after,
  and draw the same picture. The browser took 24 to 50 ms to answer about
  its adapter.
- **Every other answer**, on the 3D page: no adapter `no-adapter`; an
  adapter that draws on the CPU `software-adapter`; `requestAdapter`
  rejecting `adapter-error: blocked by the check`; never answering
  `adapter-timeout` after 3001 ms. In each the page is on WebGL and the
  WebGPU bundle was not requested. `?prefer=webgl`: WebGL, `fallbackReason`
  `null`, the adapter not asked for.
- **A WebGPU bundle that does not load.** Answered with 404, and served with
  one byte more than its integrity allows: the same page comes up on WebGL
  with `bundle-failed: zhuda-3d-webgpu.js`, each bundle requested once.
- **A WebGPU that loads and does not start** (the loader's question is
  answered, the engine's is not): the page is requested twice, comes up on
  WebGL with `retry: Could not get WebGPU device`, and the second load did
  not ask the browser.
- **Nothing below WebGL**: with the WebGL bundle missing the page shows
  `ZHUDA_LOADER: zhuda-3d.js did not load (address, network, integrity)`.
- **The one-backend pages** load no loader and report `fallbackReason`
  `null`, as before.
- **Compilers that are fetched.** First page: both `.wasm` files requested,
  `compilers.from` `network`. The same distribution at another address in
  the same browser: neither requested, `from` `cache`, the picture drawn.
  With one cache entry overwritten by three bytes: that one requested again
  and the start succeeds; the cache holds two entries afterwards. A page
  with an origin of its own (`Content-Security-Policy: sandbox
allow-scripts`, origin `null`): WebGPU starts, both files requested on each
  of two loads. Compilers inside the bundle: none requested, `from`
  `inline`.
- **Time until both compilers are ready** (three runs): inside the bundle
  196, 210 and 199 ms; fetched from localhost 49, 36 and 35 ms; from the
  cache 11, 12 and 11 ms.
- **A consumer build with `"renderer": "auto"`.** The Doctor passes both
  library orders. Real browser: WebGPU, the WebGPU libraries and both
  `.wasm` files requested, no WebGL library; ready 679 ms after the
  navigation began. Without `navigator.gpu`: WebGL, `no-webgpu-api`, no
  WebGPU library and no `.wasm`; ready after 299 ms. With
  `window.ZhudaBackendPrefer = 'webgl'`: WebGL, `null`, the adapter not
  asked for. A second load of the WebGPU page in one browser: compilers
  from the cache, ready after 420 ms. The game's start failing on WebGPU,
  and a WebGPU library answered with 404 after others had run: the page is
  requested twice and comes up on WebGL with `retry: …`. `app.js` is
  requested once in each.
- **Sizes** (bytes, gzip 9, Brotli 9): `zhuda-2d.js` 2,225,690 / 649,435 /
  574,502; `zhuda-3d.js` 2,987,324 / 835,095 / 727,636; `zhuda-3d-gltf.js`
  3,147,172 / 872,780 / 758,643; `zhuda-2d-webgpu.js` 10,805,360 /
  3,190,851 / 2,643,048; `zhuda-3d-webgpu.js` 11,830,201 / 3,407,335 /
  2,817,110; `zhuda-3d-gltf-webgpu.js` 11,990,049 / 3,445,818 / 2,847,565;
  `zhuda-loader.js` 5,297 / 2,200 / 2,071. With the compilers beside it:
  `zhuda-3d-webgpu.js` 3,907,207 / 949,121 / 817,526,
  `shader_compiler_web.wasm` 2,714,840 / 818,287 / 686,670,
  `nagabind_bg.wasm` 3,227,417 / 887,047 / 723,783.
- **3D without `ui`.** `zhuda-3d.js` with `laya.ui.js` cut out of it starts,
  runs its 30 cycles and draws the same picture with no page error. It is
  110,855 bytes smaller, 24,707 gzipped, 21,445 with Brotli. The profiles
  were not changed.

## Found on the way

- The engine's coded error for a missing adapter (`WEBGPU_ADAPTER`) does
  not reach the page: LayaAir catches what its adapter request throws and
  rejects with its own "Could not get WebGPU device". The retry's reason is
  whatever the failed start said.
- On WebGL `context.renderer.nativeEngine` is the minified name of
  LayaAir's engine class (`Le`), not a name a person can read. Left as it
  is.
- Carrying the compilers as text costs about 0.2 s at every start on this
  desktop (7.9 MB decoded), against 12 ms from the cache.
- The Doctor counted an auto page's one script tag (the loader) as its
  library list and passed it without looking. It now reads both orders out
  of the loader call.

## Unverified limits

- No phone: which backend the V40's Chrome is given, whether WebGPU starts
  on its Adreno 720, and how long its compilers take either way.
- One desktop GPU and one browser. Safari and Firefox were not opened.
- `insecure-context` is unit-tested only.
- No SDK release was published with the loader, and `--publish` was not
  run with the changed record code; the record's reading and pinning are
  unit-tested.
- The hosted site's headers for `.wasm` files (CORS, MIME) were not looked
  at: `--wasm external` on that host is untried.
- The time a real network takes: every number above is loopback.
- The prefab preview of an auto build is WebGL; WebGPU pixels of an auto
  build are not certified by its prefab evidence.
