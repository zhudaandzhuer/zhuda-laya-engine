# Verification record: basis-textures

Task document: `docs/plans/records/basis-textures/task.md`\
Commit: the commit that adds this file, on top of `8353e06`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
  Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback. Phone: vivo V40 (V2348), Android 16,
  Adreno 720, Chrome 156, WebGL 2, driven through its Chrome debugging port.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `8353e06`; no consumer.
- DPR, viewport and network mode: DPR 1; 480 by 300; loopback (the phone
  through `adb reverse`).
- Evidence (outside the repository): `batch2-evidence/basis-textures/` in the
  session's notes folder: the three reports and their pictures.

## Checks

| Check | Exact command or procedure | Result |
| --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 646 of 646 (7 in `tests/basis-texture.test.mjs`, 3 in `tests/gltf-basisu.test.mjs`, the consumer build test extended) |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS |
| Basis textures, WebGL | `npm run verify:basis-textures` | PASS |
| Basis textures, WebGPU | `BASIS_RENDERER=webgpu npm run verify:basis-textures` | PASS |
| Basis textures, phone | the check's page served to the phone | drawn and measured (below); no assertion script on the phone |
| Other real draws, WebGL | shader-warm-up, gltf-intake, physical-surfaces, specular-aa, shadow-updates, render-scale, live-look, camera-effects, film-water, film-reflector, film-point-shadow, film-model, prefab-models, film-finishes, film-highlights, grass, geometry | PASS, 17 of 17 |
| Other real draws, WebGPU | the same seventeen, `verify:film-webgpu` (20 film verifications) and, after `npm run build:browser`, `verify:webgpu` (the three WebGPU pages of the browser SDK) | PASS, 19 of 19 |

## The files

No encoder is installed and none is vendored, so the check makes its own
KTX 2 files (`tests/helpers/ktx2-fixture.mjs`): UASTC payloads in which every
4 by 4 block is one colour (UASTC mode 8), with the hints a transcoder uses
for ETC1 and ETC2 worked out for each colour, mip levels made by averaging
blocks, with and without alpha, plain and Zstandard, and one whose levels
are each a single colour. The bit layout was taken from the Basis Universal
source and is held to the vendored transcoder by the unit tests: transcoded
to RGBA the files come back as their pixels exactly; to ETC2 and BC1, decoded
by the test's own decoders, within 8 of 255 at every level.

They prove the path (header, target, transcode, container, upload, sampling,
levels). They say nothing of an encoder's quality, of ETC1S, of how long a
real texture takes to transcode, or of real file sizes.

## Results

All three devices report ASTC, ETC2 and S3TC with sRGB (the Adreno 720
too). Every target, against the same pixels uploaded uncompressed with mip
levels made by the graphics card, over the pixels of a plane drawn 3.5
times enlarged (mean and worst difference of a channel, of 255):

| Target | Desktop WebGL | Desktop WebGPU | vivo V40 |
| --- | --- | --- | --- |
| `astc-4x4` (the choice on all three) | 0, 0 | 0, 0 | 0, 0 |
| `etc2-rgb` / `etc2-rgba` | 0.52, 8 / 0.48, 8 | 0.52, 8 / 0.48, 8 | 0.53, 9 / 0.49, 9 |
| `bc1` / `bc3` | 0.30, 6 / 0.27, 6 | 0.30, 6 / 0.27, 6 | 0.28, 6 / 0.25, 6 |
| `rgba8` | 0, 0 | 0, 0 | 0, 0 |

- **The file's own levels are sampled.** The file whose levels are each one
  colour, drawn at four texels to a pixel: `[35,199,35]` on desktop WebGL,
  `[35,197,51]` on WebGPU, `[36,199,36]` on the phone, for every block
  format (level 2 is green, `[30,200,30]`); with `rgba8`, whose levels the
  graphics card makes, `[71,67,69]`. Asserted both ways.
- **Zstandard** file: the same numbers as the plain one.
- **30 by 18**: uploaded as `rgba8`, equal to its pixels; a block format
  forced on it is refused ("multiples of four (30 by 18)").
- **In a model** (a GLB plane, `KHR_texture_basisu` required, against the
  same GLB with a PNG of the same pixels): ASTC, difference 0 on all three.
  A GLB with a KTX 2 image and a fallback PNG of another picture: with a
  transcoder the KTX 2 picture (difference 0); without, the fallback
  (difference 160 from the first picture) and `warning:
  BASIS_TRANSCODER_MISSING`. The KTX-2-only GLB without a transcoder:
  `ZhudaModelCompatibilityError` with `error: BASIS_TRANSCODER_MISSING`.
- **A 1024 by 1024 map**, bytes on the graphics card: 1 398 128 as ASTC with
  its eleven levels; 5 592 404 uncompressed with levels. Time from bytes to
  a texture: 1.6 ms (desktop WebGL), 2.0 ms (WebGPU), 5.8 ms (phone);
  LayaAir's loader took 5.1, 4.7 and 15.2 ms for the same picture as a PNG.
  The KTX 2 time is that of one-colour blocks, which transcode fastest.
- **Start-up of the transcoder** (script, WebAssembly, hash, start): 48 ms,
  367 ms (WebGPU page) and 85 ms.
- Refused with the reason: bytes that are not KTX 2; a file cut short
  ("level 0 lies outside the file"); a KTX 2 file of another colour model
  ("without a Basis payload").
- No page, console, renderer or GPU error or warning in the desktop runs;
  no page error on the phone.

## Found while drawing

- **S3TC colour maps with mip levels were filtered on encoded values and
  drawn too dark.** LayaAir gives an S3TC texture the graphics card's sRGB
  decoding only when it has no mip levels, and otherwise converts in the
  shader with a power of 2.2. Against the reference: flat dark colours off
  by 7 (26 drawn as 19), block edges off by up to 43, 0.5 % of all values
  more than 12 off. For the one call that makes a Basis texture, which
  brings its own levels, the engine answers LayaAir's question with what the
  graphics card can do: worst 6, mean 0.30.
- **LayaAir's WebGPU backend reports no block format** because it asks the
  device for no compressed-texture feature. The engine's device request now
  adds the ones the adapter has; ASTC, ETC2 and S3TC then upload and draw.
- **S3TC through LayaAir's DDS path does not take a size that is not a
  multiple of four** (mean difference 26.8 of 255 when forced); ASTC and
  ETC2 did. Such sizes are uploaded as RGBA for every format, and a forced
  block format is refused.
- **A PNG through `Laya.loader.load(url, TEXTURE2D)` is not the picture of
  its pixels uploaded as an sRGB texture** (mean 38 of 255 apart, enlarged
  to a texel a pixel). Not looked into: the PNG is in the check for its time
  and its size only. A model's PNG, which the glTF loader brings in with
  its slot's settings, matched (difference 0).

## Lifecycle and failure cases

Unit-tested: the header reader against cut, edited and foreign files; the
target for each combination of support, kind, alpha, colour space and size;
the transcoder's start-up refusing bytes of another hash before they run,
a factory that gives something else, a cancelled signal and a start-up that
never ends (`TimeoutError`); a disposed transcoder; the KTX 1 and DDS
containers field by field where LayaAir reads them; the texture made
through LayaAir's parsers with the mip, sRGB and anisotropy settings; in a
model, one texture for a picture used by several slots, the slot's colour
space and sampler, and an empty slot with a warning when there is no
transcoder or the bytes are refused; the consumer build copying the
transcoder and its licence only when asked and refusing a value that is not
true or false.

## Limits and decision

- **No real texture was drawn.** Everything above is one-colour blocks. An
  encoder's UASTC modes 0 to 18 other than 8, ETC1S (BasisLZ) files and
  their alpha slices, and normal maps go through the transcoder's own code,
  which is its authors'; none was run here. Quality against a source
  picture is not measured.
- Transcoding time and file size of real textures: not measured.
- One desktop GPU and one phone, both with ASTC: ETC2 and S3TC were drawn
  by forcing them. A device with only S3TC (most Windows desktops), with
  only ETC2, or with no block format was not run; `rgba8` was drawn by
  forcing it.
- GPU memory is computed from the format and the size, not read from the
  driver.
- WebGPU on a phone, other browsers, mini-game hosts: not run. A mini-game
  host must be given the factory and the bytes itself; none was tried.
- Not built: an encoder or a `--ktx2` output of `zhuda-laya-lod`, BC7,
  PVRTC, ETC1-only devices, cube/array/volume/HDR, a worker, external KTX 2
  images of a `.gltf`.
- The transcoder's licence text in `vendor/basis/LICENSE.txt` is the
  Apache-2.0 text; the copyright notice is in the provenance file.

Decision: **Implemented within scope**. Not Accepted: no consumer has
shipped a KTX 2 texture, and no encoder's output has been drawn.
