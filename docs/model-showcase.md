# Model compatibility, inspection and presentation (1.9.0)

Use the public `ZhudaModelLibrary`, `ZhudaModelInspector` and
`ZhudaAssetShowcase`. They share the existing provider, cache/lease, native
Animator and Filmic pipeline. They are a browser model-inspection foundation,
not a promise that every seller asset matches Unreal Engine or a DCC render.

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
| Meshopt (`EXT_meshopt_compression`) | Optional `ZhudaMeshoptModelDecoder`, pinned meshoptimizer 1.3.0 | Embedded GLB/glTF preprocessed to ordinary GLB; neutral WebGL/WebGPU fixture verified |
| Draco / KTX2 / material variants | No registered support in this importer | Required extension rejects; optional fallback explicitly degraded |
| HDR / GI / reflection / hair / cloth / skin | Existing engine capabilities have their own boundaries | No seller-model / UE parity or new GI certification |
| Movie / EXR / path tracing | Not delivered by showcase mode | Cinematic means real-time postprocessing only |

`gltfExtensionCapabilities` is the machine-readable handler list:
`KHR_materials_anisotropy`, `KHR_materials_clearcoat`,
`KHR_materials_emissive_strength`, `KHR_materials_ior`,
`KHR_materials_iridescence`, `KHR_materials_sheen`, `KHR_materials_specular`,
`KHR_materials_transmission`, `KHR_materials_unlit`, `KHR_materials_volume`,
`KHR_texture_transform`.

`gltfAssetCapabilities` reports GLB/embedded data as supported, Meshopt as
`adapter-required`, and external resource URLs, Draco and KTX2/Basis as
unsupported. Raw `inspectGltfAsset` still describes the native importer; it does
not simulate a registered decoder. Use the optional adapter explicitly:

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
