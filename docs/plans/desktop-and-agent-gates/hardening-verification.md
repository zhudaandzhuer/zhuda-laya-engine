# Verification: desktop, sequence and asset hardening

Status: PASS for the stated macOS scope; Windows and physical mobile UNAVAILABLE
Task: [hardening-task.md](hardening-task.md)
Baseline: `70e35f9`; validation against the 1.12.0 working tree.
Date: 2026-11-05

## Environment

macOS Darwin 27.0.0, Node v26.12.0, Chrome 156.0.8078.80, DPR 2,
800x600 CSS viewport, localhost. WebGPU adapter: Apple / metal-3,
`isFallbackAdapter:false`, `WebGPURenderEngine`, no validation errors.
Desktop packaging used Node 24 LTS and Electron 36.9.5 on darwin-arm64.
The packaged host used its own `app.asar/web` with no `ZHUDA_WEB_ROOT` and a
working directory outside the checkout. It reported `packaged:true` and passed.

## Checks

| Check | Command | Result | Artifact |
| --- | --- | --- | --- |
| Full regression | `npm run verify` | PASS: 245 tests, zero declaration diagnostics, Doctor healthy | `/tmp/zhuda-next-round-verify.log` |
| Public consumer | `node scripts/verify-next-round.mjs` | PASS on both backends | `/tmp/zhuda-next-round-hardening/evidence/results.json` |
| Package boundary | Same command | Strict declarations (`skipLibCheck:false`), packed ESM/CJS exports and both public compiler builds pass | temporary consumer under the evidence root |
| WebGL/WebGPU | Same command | Exact compressed/uncompressed neutral-model screenshot equality, 30 load/unload cycles per backend, corrupt-model rejection, chunk-provider load and camera sequence | `*-reference.png`, `*-meshopt.png`, `*-sequence.json` |
| PNG sequence regression | Same command, including the packed `zhuda-sequence-check` CLI with `--reference` | PASS: t=0/0.5/1, all 3 frames per backend have zero different pixels at channel tolerance 2; deliberately substituted frame rejects | `*-comparison.json`, `*-reference-sequence.json` |
| Browser distribution | `node packages/compiler/browser-sdk.mjs --out /tmp/zhuda-next-round-hardening/browser-1.12.0` | PASS: six profiles, fixed SHA/SRI and third-party notices | `browser-1.12.0/sdk-manifest.json` |
| Browser WebGPU | `WEBGPU_BROWSER_DIR=/tmp/zhuda-next-round-hardening/browser-1.12.0 node scripts/verify-webgpu.mjs --out /tmp/zhuda-next-round-hardening/browser-evidence` | PASS: 2d, 3d and 3d-gltf WebGPU; 30 cycles, shader/particle draw and model presentation modes | `browser-evidence/results.json` |
| Desktop development host | `ZHUDA_WEB_ROOT=/tmp/zhuda-next-round-hardening/consumer/dist/webgpu ZHUDA_WINDOWS_WEBGPU_OUT=/tmp/zhuda-next-round-hardening/electron-dev npm run verify` in the host directory | PASS: hardware WebGPU | `electron-dev/report.json` |
| Packaged desktop host | Staging and Forge commands below; packaged executable `--verify` | PASS on macOS: embedded assets, hardware WebGPU, no fallback/renderer errors, `packaged:true` | `electron-packaged/report.json`; `/tmp/zhuda-electron-package.log` |
| Windows physical GPU | Installed host `--verify` on Windows | UNAVAILABLE here | Windows agent must attach report |
| Desktop staging | `node --test tests/desktop-host.test.mjs` | PASS; self-contained files, path and directory-index symlink rejection | test output |
| Published package contents | `npm pack --dry-run --json` | PASS: public ESM/CJS, decoder types, CLI, license and host source included; local desktop web/out/node_modules excluded | package manifest |
| Local Markdown and whitespace | Local target resolution; `git diff --check` | PASS | terminal output |

All shortened artifact paths above are below `/tmp/zhuda-next-round-hardening/`.
The independent runner creates a separate packed consumer; compiler dependency
packages are linked from the pinned installation. It does not import engine
source paths. Evidence records baseline commit plus `workingTree:true` and the
tested tarball SHA-256:
`544033866e4e99aac4b5b5cf6453d371d0d6567c8633499aaac3a4b3b00c6e14`.
Later documentation-only edits change the tarball hash; the runtime is unchanged.
The containing Git commit identifies the final sources and declarations.

Reproduce the packaged macOS smoke with Node 24 on PATH:

```sh
cd examples/windows-webgpu
ZHUDA_WEB_ROOT=/tmp/zhuda-next-round-hardening/consumer/dist/webgpu npm run stage
npm exec electron-forge package -- --platform=darwin --arch=arm64
env -u ZHUDA_WEB_ROOT \
  ZHUDA_WINDOWS_WEBGPU_OUT=/tmp/zhuda-next-round-hardening/electron-packaged \
  ./out/zhuda-windows-webgpu-host-darwin-arm64/zhuda-windows-webgpu-host.app/Contents/MacOS/zhuda-windows-webgpu-host --verify
```

The final smoke also ran this executable by absolute path with cwd `/tmp`.
Node 26's Forge attempt exited without an App artifact and was not counted as
a package success; the Node 24 run produced and executed the actual App.
Windows uses `npm run package` / installed EXE as documented in the host README.

## Lifecycle and evidence

Provider tests cover shared requests with independent abort, immutable manifests,
unknown/malformed ranges, checksum failures, stream bounds without Content-Length,
ignored cancellation, deadlines, disposal and 30 copied-output checks.
Decoder tests cover hung adapters, late release, invalid output, outstanding
leases during unregister, idempotent retirement, malformed limits, real pinned
Meshopt decoding and 30 repeated decodes. Individual synchronous WASM blocks
cannot be interrupted mid-call; outputs are bounded and checked between views.
Timeline tests cover finite values, vector dimensions, immutable inputs, exact
step-key boundaries, finite interpolation across large opposite values and
stalled recording callbacks. The sequence gate rejects invalid settings,
missing diagnostics/SHA/times, symlink escape, absent reference approval and
oversized PNG data/dimensions. Approval metadata is not authenticated identity.

The source neutral model is `tests/fixtures/gltf-review/node-weights.gltf`, named
node `Probe`, authored morph state. The same definition is compressed by
`tests/fixtures/meshopt.mjs` and loaded through the public library. Both raw and
compressed versions are rendered in isolation by the same consumer scene.
No consumer game asset was copied into the engine. Hashes and actual renderer
identity are recorded by the runner. References prove compression regression
only; they are not artistic approval or a full material conformance corpus.
Visual inspection of the final first/last WebGPU captures confirms the visible
white morph triangle and its camera-relative movement. Source JSON SHA-256 is
`1eec5c007b74d3bb2291b951a34c11d677f75b9a0d1377b83251fac42dbcad45`;
compressed fixture SHA-256 is
`1a62384493c112d46cbb6806ad54a1823345e207670d4e0d779ddcd036911137`.

Resource snapshots after warmup and cycle 30 match on both backends: zero model
cache entries/references/instances and meshes; 12 textures, 4 render targets,
0 clips, 5 materials (22 counted engine resources). The reported 11,187,508 bytes
are the existing estimator, not measured total GPU/driver/WASM/native memory.

## Limits and remaining roadmap

Windows hardware/installed EXE, physical iOS/Android and seller-model acceptance
remain UNAVAILABLE. Meshopt is an explicit optional embedded-model adapter;
Draco, KTX2/Basis and external URI resolution remain unsupported. No HLOD,
compute/indirect culling, render-thread migration, WebXR session/stereo pipeline,
physical-camera effects or accumulated offline video export has been shipped.
Those require distinct renderer/device fixtures and measurements. Slot
RNG/payout/RGS/wallet/certification remain consumer/domain responsibilities.
The sequence validator verifies evidence integrity and, with an approved
reference, PNG regression. Artistic review remains separate. Browser 1.12.0
artifacts were built and measured locally; existing hosted immutable URLs are
not silently rewritten or claimed to serve this release.

This is a tested foundation release, not completion of every speculative item
in the attached five-domain roadmap. See the original [task](task.md) and the
[asset delivery production gates](../asset-packaging.md) for follow-up criteria.
