# WebGPU delivery (1.11.0)

The public compiler and browser SDK can select the real LayaAir 3.4.2 WebGPU
backend. WebGL remains the default build. Renderer selection is independent of
feature selection: enabling `3d` alone does not enable WebGPU.

## Consumer route

Start with the [canonical consumer](consumer-route.md). In `zhuda.config.json`:

```json
{
  "entry": "src/Main.ts",
  "features": ["core", "2d", "3d", "ui", "gltf", "postProcess"],
  "renderer": "webgpu",
  "prefabPreview": "src/prefabs.ts"
}
```

```ts
import { ZhudaEngine } from 'zhuda-laya-engine';
const cancellation = new AbortController();
const context = await ZhudaEngine.boot({
  container: '#game',
  width: 1280,
  height: 720,
  dprCap: 2,
  renderer: 'webgpu',
  features: ['core', '2d', '3d', 'ui', 'gltf', 'postProcess'],
  signal: cancellation.signal,
  bootTimeoutMs: 30000,
  clearInput: () => inputBuffer.clear(),
  onContextLost: () => requestFreshRuntimeRealm(),
});
console.log(context.renderer);
```

The input buffer and `requestFreshRuntimeRealm` are consumer-owned references;
use the existing `ZhudaInputBuffer` / `ZhudaRuntimeHost` contracts. An omitted
boot `renderer` uses the one loaded by the compiler. An explicit value must match.
Changing only the boot option cannot turn a WebGL build into WebGPU.

The compiler packages the GPU backend and both GLSL → SPIR-V / WGSL compiler
JS/WASM dependencies under relative `libs/` URLs. The loader verifies SHA-256
before starting upstream WASM initialization and owns fetch cancellation. It
uses no external CDN. Keep the WASM files in the ZIP and serve them as
`application/wasm`. CSP must allow WebAssembly compilation, typically through
`script-src 'wasm-unsafe-eval'`; this does not authorize changing a host's policy.

The official Prefab preview uses the same selected backend and provider as the
consumer build. Its report includes the requested and actual renderer. Rebuild
and recapture affected evidence when switching backends; old WebGL pixels do
not certify WebGPU. Candidate/release gates remain unchanged.

## Single HTML

Use `zhuda-laya-browser-sdk --profile 3d-webgpu --out ./sdk-gpu` or the
`2d-webgpu` / `3d-gltf-webgpu` profiles. The default browser build produces all
six WebGL/WebGPU variants. Each GPU bundle embeds both compiler WASM binaries;
one fixed script URL and SRI cover the complete runtime. The additional compiler
payload is approximately 5.94 MB before base64 encoding, excluding JS/runtime.

```js
const context = await Zhuda.ZhudaEngine.boot({
  container: '#game',
  renderer: 'webgpu',
  features: [...ZhudaBundle.features],
});
```

See [fixed URLs and HTML templates](browser-sdk.md). One page loads exactly one
bundle. Do not mix WebGL and WebGPU libraries or load a second renderer after
partial initialization. For fallback, offer a separately built WebGL URL in a
fresh page/iframe. No automatic downgrade is performed: `fallbackReason` remains
`null`, and a failed WebGPU request rejects instead of returning WebGL success.

## Diagnostics and lifecycle

`context.renderer` records `requested`, `selected`, `nativeEngine`, `status`,
actual adapter identity, enabled device features, up to 64 GPU validation errors,
and loss reason/message. Adapter strings may be redacted by the browser. This
release's verifier rejects fallback/software adapters for hardware acceptance.

WebGPU requires a secure context and an available compatible GPU adapter. Missing
API, denied adapter, wrong bundle, missing/corrupt compiler, timeout and abort
are failures. `bootTimeoutMs` defaults to 30 seconds. Failed/late initialization
cannot attach a root Scene, and a late device is destroyed.

Device loss stops the existing runtime/input and the native renderer, then calls
`onContextLost` once. Release scene resources, save consumer state and recreate
the realm. `dispose()` releases the GPU device and canvas configuration. A retired
WebGPU realm cannot boot again because upstream Laya caches global init state;
use `ZhudaRuntimeHost` or reload. Shared WASM modules also end with that realm.
A browser may complete an already-started native compile after cancellation;
its result cannot mount a retired session. Game time still uses the existing clock.

Two upstream seams are contained in engine adapters: swallowed shader-compiler
failures are surfaced, and pending scene removals invalidate skipped WebGPU cull
frames before destroyed render elements can be reused. Vendor artifacts stay
unmodified and their source/hash/notices are pinned in
[`webgpu-provenance.json`](../vendor/laya-3.4.2/webgpu-provenance.json).

## Film scenes

[Film scenes](film-scenes.md) render on WebGPU with `--film-renderer webgpu`:
models with lightmaps, the reflector, light fog, animation, the environment
probe, looks, mixed lighting, water, placements, stills and MP4. More upstream seams are
contained in `WebGPU342Adapters.ts` for it, and apply to every WebGPU scene
(listed below):

- A camera or shadow light that moved is culled in the same frame. Upstream
  defers that by up to two frames, which drew the previous view after a cut, a
  probe face or a mirrored camera.
- Half-float render targets are read back whole (`readLaya342FloatTarget`).
  The upstream read-back returns every other row for 16-bit formats.
- The glTF PBR depth-normal pass no longer takes the fog define. Upstream
  fails to compile it once a fogged scene draws a glTF model with ambient
  occlusion.
- Hand-drawn passes (mirrors, depth pictures, captures) first give renderers
  added since the last frame their reflection probe
  (`prepareLaya342ManualDraw`). Upstream does that only in the scene's own
  update; a new renderer drawn by hand first was compiled without the probe's
  uniform block, the probe's uniforms went into the shared material map, and
  every pass of that shader compiled afterwards failed ("nameless block
  contains a member that already has a name", "u_IBLTex_Texture:
  redefinition"). Scenery loaded while a game runs hit this.
- A shader the compiler rejects is recorded in `context.renderer.errors` with
  the compiler's message and the source lines it points at.
- Batches copy 32-bit index buffers as 32-bit. Upstream reads every index
  buffer as 16-bit when it merges a batch, so a mesh with more than 65 535
  vertices drawn more than once came out as a fan of shards.

Custom surface shaders must sample textures in uniform control flow (no
`return` or `discard` before a sample): WGSL rejects the shader otherwise and
the film host reports the device's message.

## Evidence and platform boundaries

Measured on macOS Chrome 156, Apple Metal hardware WebGPU:

- Independent packed consumer build, Doctor, strict types and public ESM/CJS.
- Same 2D text/icon and 3D PBR Prefab definitions: preview/Scene exact replay at
  emulated DPR 1/2/3, mouse coordinates, container resize and focus handling.
- Thirty resource cycles, actual device destruction and fresh-page recovery.
- Browser bundles: glTF/Morph, Raw/Gameplay/Cinematic (AO/Bloom/ACES), neutral
  custom surface shader and seeded 3D particles. No GPU validation errors.
- Missing GPU/adapter/compiler, timeout, pre-abort and late device cancellation.
- Published fixed SDK: all 16 payload hashes, six profiles through cross-origin
  SRI and the existing opaque-origin sandbox; hardware WebGPU and its shaders
  also pass on the hosted release without changing server CSP.

Cross-backend images may differ because of shader conversion and driver precision;
exact preview/Scene comparisons are **within** a backend. These neutral fixtures
are not certification of every material, Spine asset, physics plugin, shadow
configuration, device, performance target or long session. The existing
`ZhudaRuntimeProfiler` GPU timer uses WebGL queries; its WebGL GPU timing is not
WebGPU timing. WebGPU resource figures are estimates, not driver memory readings.

**Windows Chrome/Edge use this same browser WebGPU path, but actual Windows GPU
acceptance remains UNAVAILABLE until run on the target machine.** Native EXE,
Electron/WebView2 packaging, signing and Steam are separate, unverified work.
Physical iOS/Android and other browsers are also unverified in this release.

Run on a Windows GPU machine (Node 24+, Chrome, or set `CHROME_BIN` to Edge):

```powershell
npm install
npm run build
npm run build:browser
$env:WEBGPU_BROWSER_OUT = "$PWD\webgpu-evidence"
npm run verify:webgpu
```

Or test a fixed hosted release with
`node scripts/verify-webgpu.mjs --url https://host/fixed-release/ --out ./evidence`.
The script records OS, browser, adapter, actual backend, images, resource cycles
and errors; it fails on software adapters or WebGL fallback. Preserve the report
with the target GPU/driver and `chrome://gpu` / `edge://gpu` information. Windows
CI checks compilation and contracts, not hardware rendering. See the
[verification record](plans/records/webgpu-delivery/verification.md).
The [Windows/Linux CI run](https://github.com/zhudaandzhuer/zhuda-laya-engine/actions/runs/41995476456)
passes both jobs, including pinned vendor-byte checks on Windows.

## Packaged Windows application

The repository includes an Electron host at
[`examples/windows-webgpu`](../examples/windows-webgpu/). It serves a consumer's
already-built `dist/web` through a secure `app://bundle` origin, preserving
relative WASM/fetch/provider paths in the packaged app. On a Windows GPU host,
run its `npm run verify` before `npm run package`; the report fails on WebGL,
software adapters, fallback or renderer validation errors. This is a packaged
entry check. A Windows driver, WebView2 or signed installer is accepted only
after a real target-machine report is attached.
