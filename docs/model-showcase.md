# Model compatibility, inspection and presentation (1.9.0)

Use the public `ZhudaModelLibrary`, `ZhudaModelInspector` and
`ZhudaAssetShowcase`. They share the existing provider, cache/lease, native
Animator and Filmic pipeline. They are a browser model-inspection foundation,
not a promise that every seller asset matches Unreal Engine or a DCC render.

For Blender/glTF axis, unit, mesh-complexity and Windows timeout guidance, see
[the model pipeline contract](model-pipeline.md).

## Import contract and diagnostics

`inspectGltfAsset(bytes)` accepts glTF JSON or GLB bytes without allocating GPU
resources. `inspectGltfDocument(document)` accepts a parsed document. Both return
an immutable `ModelCompatibilityReport` with diagnostics, source inventory,
extensions and required render inputs. This checks known **importer capabilities**;
use Khronos Validator separately for full file validation.

- `unsupported`: an error prevents ModelLibrary native allocation. Catch
  `ZhudaModelCompatibilityError` and inspect `report` / `assetId`. An unknown
  required extension is never silently accepted; do not delete required flags.
- `degraded`: an optional extension has no handler. Its fallback needs explicit
  visual acceptance. This status may also include required render inputs.
- `conditional`: implemented features require camera inputs, currently
  `opaqueColor` for transmission.
- `supported`: no known gate failed. This is **not** visual certification.

Each diagnostic includes code, severity, JSON path, extension when applicable,
message and fix hint. The source inventory lists nodes, mesh primitives,
materials, texture slots and their intended color spaces, images and animation
channels. It does not infer texture fidelity, shader correctness, license,
compression quality or GPU readiness.

Provider mode accepts self-contained GLB / embedded glTF. External buffer/image
URIs are rejected; package them into the model before publishing. Every request
retains cancellation, timeout, stale-result disposal and lease release. Direct
URL loading remains available for legacy integrations, but logical game asset
IDs belong behind AssetProvider.

## Explicit compatibility matrix

| Feature | Shipped contract | Evidence boundary |
| --- | --- | --- |
| Required / optional extensions | Unknown required rejects; optional reports loss | Valid variants fixture and deliberate declaration failures |
| Node Morph defaults | Node weights override mesh defaults; clones remain independent | Authored static and skinned native-runtime fixtures |
| Morph LINEAR / STEP / CUBICSPLINE | Native Animator; cubic tangent/value ordering and time scaling repaired in pinned adapter | Two targets, mixed translation, ordinary/skinned nodes, sampled poses; not entire animation corpus |
| Core PBR slots | Source inventory reports base-color/emissive sRGB and normal/occlusion/metallic-roughness linear semantics | Inventory check; this release does not certify pixel correctness for every PBR map |
| 11 glTF handlers below | Native implementations exist | `visualConformance: 'not-certified'`; presence is not full fidelity |
| Transmission | Requires opaque camera pass; showcase enforces mode policy | Input policy verified; complex refraction / layered transparency unverified |
| FBX / OBJ / USD | No direct public importer or lossless conversion guarantee | Export supported glTF and validate conversion loss |
| Meshopt (`EXT_meshopt_compression`, `KHR_meshopt_compression` with its COLOR filter) | Optional `ZhudaMeshoptModelDecoder`, pinned meshoptimizer 1.3.0; without it the report says `DECODER_REQUIRED` | Embedded GLB/glTF preprocessed to ordinary GLB; neutral WebGL/WebGPU fixtures verified |
| Quantized vertices (`KHR_mesh_quantization`, normalized texture coordinates and weights) | Turned into floats before native parsing (`DEQUANTIZED_ATTRIBUTES`); node transforms kept | Generated torus: same-backend pixels against the float file, WebGL and WebGPU |
| WebP / AVIF textures (`EXT_texture_webp`, `EXT_texture_avif`) | The device is asked once; AVIF, then WebP, else the fallback source loads (`IMAGE_DECODE_UNAVAILABLE`) | Lossless WebP and AVIF pictures against the PNG one in desktop Chrome; other browsers and phones not run |
| Punctual lights (`KHR_lights_punctual`) | Made on their nodes only when `instantiate(id, {lights})` asks; units mapped by `zhudaGltfLightToLaya` (`LIGHT_APPROXIMATED`) | Room against the same lights made by hand from the documented mapping; not a physical-units certification |
| Node extras and cameras | `instance.gltfNodes`; `applyZhudaGltfCamera` aims a LayaAir camera | Room camera against the hand-aimed one |
| Draco / KTX2 / material variants | No registered support in this importer | Required extension rejects; optional fallback explicitly degraded |
| HDR / GI / reflection / hair / cloth / skin | Existing engine capabilities have their own boundaries | No seller-model / UE parity or new GI certification |
| Movie / EXR / path tracing | Not delivered by showcase mode | Cinematic means real-time postprocessing only |

`gltfExtensionCapabilities` is the machine-readable handler list:
`KHR_materials_anisotropy`, `KHR_materials_clearcoat`,
`KHR_materials_emissive_strength`, `KHR_materials_ior`,
`KHR_materials_iridescence`, `KHR_materials_sheen`, `KHR_materials_specular`,
`KHR_materials_transmission`, `KHR_materials_unlit`, `KHR_materials_volume`,
`KHR_texture_transform` (`implementation: 'native'`), and
`KHR_mesh_quantization`, `EXT_texture_webp`, `EXT_texture_avif`,
`KHR_lights_punctual` (`implementation: 'engine'`: done before or around the
native importer, see [glTF intake](#gltf-intake-quantization-webpavif-lights-cameras-extras)).

`gltfAssetCapabilities` reports GLB/embedded data, quantized vertices and
WebP/AVIF textures as supported, both Meshopt names as `adapter-required`, and
external resource URLs, Draco and KTX2/Basis as unsupported. Raw
`inspectGltfAsset` still describes the native importer; it does not simulate a
registered decoder (a Meshopt file reports `DECODER_REQUIRED`). Use the optional
adapter explicitly:

```ts
import { ZhudaModelDecoderRegistry, ZhudaMeshoptModelDecoder,
  ZhudaModelLibrary, DirectoryAssetProvider } from 'zhuda-laya-engine';
const provider = new DirectoryAssetProvider({baseUrl:'./assets/'});
const decoders = new ZhudaModelDecoderRegistry({maxOutputBytes:64*1024*1024});
decoders.register(new ZhudaMeshoptModelDecoder());
const models = new ZhudaModelLibrary({provider,decoders,maxIdle:0});
const instance = await models.instantiate('models/product.glb');
// scene.addChild(instance.node);
instance.dispose(); models.dispose(); decoders.dispose(); provider.dispose();
```

The registry is borrowed by the model library and adds no cache. Shared model
requests decode once under the existing cache/lease. The adapter accepts only
embedded buffers/images and validates offsets, counts, stride/filter rules,
compressed ranges and decoded byte budgets before allocation. The resulting
GLB is checked by the native compatibility gate again; unrelated unsupported
required extensions still fail. Instance compatibility describes the decoded
GLB. Keep the source asset SHA in the provider manifest for original provenance.

The pinned decoder's WASM is embedded in the npm module; no CDN fetch or second
renderer is introduced. Package integrity and the decoder SHA are checked in
the regression suite. Generic registry descriptor hashes are declared metadata,
not authentication of third-party adapter code. Registering another adapter
does not certify its output or enable Draco/KTX2 in the importer.

Input and output byte limits are allocation controls, not measurements of total
JS/WASM/native/GPU memory. Meshopt runs CPU blocks with cancellation checks
between views; an individual synchronous WASM block cannot be preempted.
Timeout/abort promptly rejects waiting callers, retires late results and delays
adapter disposal until in-flight work and returned leases drain. Custom
adapters must release their workers/native resources and honor the signal.
Unregister/dispose is idempotent; release returned payloads explicitly.

The neutral fixture verifies exact attribute/index/morph bytes, same-backend
compressed/uncompressed pixels and 30 load/unload cycles on macOS Chrome WebGL
and hardware WebGPU. This does not certify seller models, every filter/animation
combination, Windows GPU or physical mobile. See the
[hardening verification](plans/desktop-and-agent-gates/hardening-verification.md).

## glTF intake: quantization, WebP/AVIF, lights, cameras, extras

`ZhudaModelLibrary` runs these steps before and around LayaAir 3.4.2's own
glTF parser; none patches the vendored files. Evidence:
[gltf-intake verification](plans/records/gltf-intake/verification.md).

- **Meshopt names.** `ZhudaMeshoptModelDecoder` reads `EXT_meshopt_compression`
  and the ratified `KHR_meshopt_compression`. The `COLOR` filter (stride 4 or 8)
  is accepted only under the KHR name, as the extensions specify.
- **Quantized vertices.** LayaAir copies vertex attributes into a float buffer
  unscaled. `POSITION`, `NORMAL`, `TANGENT`, `TEXCOORD_0/1`, `WEIGHTS_0` and
  morph-target deltas stored as bytes or shorts (normalized or not, sparse or
  not) are turned into floats in one pass (`dequantizeZhudaGltf`) after any
  Meshopt decode; node transforms, which carry `KHR_mesh_quantization`'s scale
  and offset, are kept. `COLOR_0` stays with the existing parse-time repair;
  `JOINTS_0` stays integer. The report says `DEQUANTIZED_ATTRIBUTES` with the
  float bytes it adds: download size stays small, GPU vertex memory becomes that
  of an unquantized export. External buffers are refused.
- **WebP and AVIF.** `probeZhudaImageDecode()` decodes a one-pixel picture of
  each once per page. A texture then loads its AVIF, else WebP, image when the
  device decodes it, else its core `source`. `inspectGltfAsset(bytes,
  {imageDecode})` reports `IMAGE_DECODE_UNAVAILABLE`: a warning (degraded) when
  the fallback loads, an error when there is none. Without a device answer, a
  picture with no fallback is named `IMAGE_DECODE_UNCHECKED`.
- **Embedded pictures.** LayaAir base64-encodes every picture stored in a GLB
  into a data URL. The engine hands the same bytes to the same Laya loader as a
  Blob URL and revokes it once the picture has loaded. Measured on one desktop
  (Apple M4, Chrome 157) with a 10.4 MB PNG, medians of five loads: 49–95 ms
  instead of 344–450 ms, and a sampled JavaScript heap peak of 0.12–0.24 MB
  instead of about 293 MB (LayaAir builds the base64 string one character at a
  time). Neither path keeps that heap afterwards. Phones are not measured. The
  texture's LayaAir URL is then a revoked Blob URL: LayaAir cannot fetch that
  picture again by URL (nothing in these runs needed to).
- **Punctual lights.** `instantiate(id, {lights: true})` (or
  `{lights: {scale}}`) adds a LayaAir light component to each node carrying a
  `KHR_lights_punctual` light. They are off by default: copies of a model would
  copy its lights. `zhudaGltfLightToLaya` holds the units: a directional
  light's lux become `scale × lux / π` (LayaAir's diffuse term has no 1/π); a
  point or spot light keeps the file's range, or `4·√(scale·cd/π)` without one,
  and an intensity that meets glTF's recommended falloff at half the range.
  LayaAir's falloff is not the inverse square: without a file range the two
  stay within about 30 % from a quarter to nine tenths of it; with one, glTF's
  window closes faster (about 0.63 at a quarter, about 2 at three quarters).
  A spot's cone is twice glTF's outer angle; LayaAir fixes its inner edge at
  half of it. The colour is encoded for LayaAir, which reads light colours as
  sRGB. No light casts a shadow; set `shadowMode` on the component. The report
  names each point and spot light `LIGHT_APPROXIMATED`, and an invalid light
  `INVALID_LIGHT` (it is not made).
- **Extras and cameras.** `instance.gltfNodes` lists every node carrying
  `extras`, a camera or a light, with the Laya node made from it in this copy
  (its name is the glTF name or LayaAir's `node_<n>`), a frozen copy of the
  extras, the camera and light definitions, and the light component when one
  was made. `applyZhudaGltfCamera(camera, data.camera, data.node)` sets a
  LayaAir camera's lens and puts it at the node's world pose; the viewport keeps
  its own aspect ratio. An invalid camera is reported `INVALID_CAMERA`. The
  source inventory also lists each node's camera and light index and each
  texture's WebP/AVIF image.

```ts
const room = await models.instantiate('rooms/lobby.glb', { lights: { scale: 0.5 } });
const shot = room.gltfNodes.find((n) => n.camera);
if (shot) applyZhudaGltfCamera(camera, shot.camera, shot.node);
const spawns = room.gltfNodes.filter((n) => (n.extras as any)?.spawn);
```

## Inspect and control a live model

```ts
import {
  ZhudaModelLibrary, ZhudaModelInspector, ZhudaAssetShowcase,
  DirectoryAssetProvider,
} from 'zhuda-laya-engine';

const provider = new DirectoryAssetProvider({baseUrl: './assets/'});
const models = new ZhudaModelLibrary({provider, maxIdle: 0});
const showcase = new ZhudaAssetShowcase({library: models, parent: scene, camera});
await showcase.load('products/example.glb', {signal, timeoutMs: 15000});
const inspector = new ZhudaModelInspector(showcase.instance!);
const report = inspector.inspect();
const animation = report.animations[0];
if (animation) inspector.play(animation.path, animation.name, {layer: animation.layer});
showcase.setMode('cinematic');
// Unmount in ownership order:
showcase.dispose();
models.dispose();
provider.dispose();
```

Inspector paths `$`, `$/0`, `$/0/1` are child-index paths in the instantiated tree,
not source glTF indices or globally unique identifiers. Names may repeat.
`inspect()` is a fresh serializable snapshot: mesh vertex/index counts, material
IDs, known glTF/unlit texture uniform dimensions, animation names/durations and
current morph values. Arbitrary custom shader uniforms are outside its texture
scope. Source inventory remains attached as `compatibility.inventory`.

`setMorphWeight(path, channel, value)` edits only that instance. Animated channels
are subsequently overwritten by native animation: pause the relevant animator
with `setAnimationSpeed(path, 0)` before manually inspecting them.
`play(path, name, {layer, normalizedTime, speed})` requests native playback;
pose evaluation happens on a subsequent native frame. It is not a synchronous,
fixed-step movie seek/export API. The inspector borrows its model and throws
when used after the model is disposed.

## Raw / Gameplay / Cinematic

The controller borrows a live Scene3D or Sprite3D parent, model library and an
exclusive camera without an existing postprocess chain or TAA. It owns its model
instance and the Filmic chain it creates; dispose it before the borrowed scene.

| Mode | Default presentation |
| --- | --- |
| `raw` | No postprocessing; opaque-color pass available |
| `gameplay` | ACES; exposure/contrast/saturation 1; AO and bloom disabled |
| `cinematic` | Existing Filmic defaults: AO, restrained bloom, ACES; TAA opt-in |

These are presentation settings, not studio/game scene generators. The consumer
provides lights, HDR environment, camera framing, scenery and product controls.
Raw retains authored PBR materials: removing light or replacing everything with
Unlit would not prove PBR fidelity. Exposure is the existing linear multiplier,
not an Unreal exposure-value equivalence.

Override each mode with `presentations: {mode: {filmic: false | FilmicOptions,
opaqueColor: boolean}}`. Raw cannot enable Filmic. Invalid settings reject before
camera mutation. Unavailable Filmic capabilities reject before releasing the old
chain. Model/material/geometry identities survive switches. The controller
restores owned camera changes on disposal and will not take over a caller's chain.

A failed or cancelled load preserves the previous model. A newer load or
`cancel()` invalidates the pending replacement. `clear()` cancels and releases
the model; `dispose()` additionally releases presentation resources. Load
transmission assets only into a mode with `opaqueColor:true`; disabling that
input for a loaded transmission asset fails without switching modes.

## HTML and evidence

Use the [Browser SDK](browser-sdk.md) **3d-gltf** profile, which includes glTF and
postProcess. The basic 3d profile intentionally retains its smaller topology.
The generated `example-3d-gltf.html` includes the neutral model, upload input,
mode/animation/morph controls and a 30-cycle check. Query selections
`?node=Probe&state=weighted&mode=raw` keep the same model definition independently
runnable. Uploads are local to the page; no server upload is performed.

Reproduce the packed public consumer (Node 24+, local Chrome):

```sh
npm run build
SHOWCASE_OUT=/tmp/zhuda-model-showcase node scripts/verify-model-showcase.mjs
```

This checks strict consumer types, public compiler/ESM/CJS entry points, native
WebGL draws, deterministic isolated replay, DPR 1/2/3, sampled animations,
mode identity, rejection/abort/timeout/stale replacement and repeated full
load/unload. References are generated from authored regression geometry and
prove repeatability, not artistic approval. See the
[verification record](plans/records/asset-showcase-hardening/verification.md).

Seller models, their source DCC/UE scene, physical iOS/Android, complex material
corpus and offline movie output remain separate acceptance work. Follow the
[Prefab gate](prefab-workflow.md) for actual product geometry, named parts and
composed environments before claiming a sale-ready presentation.

For deterministic offline poses, use `ZhudaModelAnimationSampler` instead of
assuming `inspector.play` immediately evaluates a pose. See [movie production](cinematics.md).
Version 1.13.0 also repairs the owned native KHR_materials_unlit import path on
WebGPU: getter mutation no longer leaves the linear color uniform white. The
same authored unlit glTF color is checked against WebGL in the cinematic runner.
