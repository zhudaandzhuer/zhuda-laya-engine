# three.js gap audit

Status: Proposed (a measured comparison and a plan; nothing here is built by this document)  
Owner: Engine/toolchain  
Last reviewed: 2026-11-14

## Source requirement

Owner's goal of 2026-11-14: surpass three.js in every respect, taking over
what three.js does better.

## Method

A workflow of 25 agents, read-only, on 2026-11-14:

- eight readers, one an area, each listing what three.js r187 (npm `three`
  0.187.0, `films/compare-three/node_modules/three`) ships and what this
  engine and the vendored LayaAir 3.4.2 have, with file paths and symbols;
- two skeptics an area, one trying to show the engine already has each
  claimed gap, the other checking that three.js really ships it (core or
  `examples/jsm`, not a third-party library) and whether it is WebGPU/TSL
  only;
- one planner, from the verified findings.

Every finding was checked by both skeptics. 12 verdicts changed
in verification; none stayed disputed. The full findings with evidence and
objections are outside the repository (`EV/findings.json`, `EV/plan.md`,
`EV` = `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/threejs-gap-audit/`).

## Result

225 findings; 138 where three.js is better.

| Area | three.js better | parity | engine better |
| --- | --- | --- | --- |
| Animation, geometry and scene objects | 13 | 8 | 9 |
| Developer experience and ecosystem | 14 | 3 | 11 |
| Lights, shadows and environment lighting | 13 | 9 | 3 |
| Materials and shading | 22 | 5 | 3 |
| Post-processing | 18 | 7 | 4 |
| Runtime and performance features | 16 | 3 | 6 |
| WebGPU and shader authoring | 21 | 5 | 3 |
| glTF and asset loading | 21 | 4 | 4 |

Verdicts changed by the skeptics:

- `materials/core-pbr-brdf`: parity -> threejs-better (engine-has-it)
- `loading/texture-transform`: parity -> threejs-better (engine-has-it)
- `loading/compressed-texture-containers`: parity -> threejs-better (engine-has-it)
- `lighting/many-lights-clustered`: engine-better -> parity (threejs-ships-it)
- `lighting/shadow-caching`: threejs-better -> parity (engine-has-it)
- `lighting/environment-intensity-rotation`: threejs-better -> parity (engine-has-it)
- `post/depth-of-field`: threejs-better -> parity (threejs-ships-it)
- `post/light-fog-godrays`: engine-better -> parity (engine-has-it)
- `animation/sweeps-curves-lathe`: threejs-better -> parity (engine-has-it)
- `dx/tests-and-verification`: engine-better -> parity (engine-has-it)
- `runtime/mrt`: threejs-better -> parity (engine-has-it)
- `runtime/collision-queries`: parity -> threejs-better (threejs-ships-it)

## Limits

- Read from source only. Nothing was drawn or timed for this audit; the
  plan's packages carry their own evidence.
- "Importance" is the agents' judgement for web and phone games.
- three.js was read at r187 only; LayaAir at the vendored 3.4.2.

## Plan (as written by the planner; WP numbers are referred to by later records)


Scope: the findings' `finalVerdict`. Where a finding was disputed, I used the corrected verdict. I re-checked some claims myself in the worktree, read-only:

- `laya.d3.js` `set anisotropyRotation(e){e=Math.max(Math.min(e,1),0)`: confirmed.
- `specularAA(` occurs once in `laya.d3.js`, the definition only, so nothing calls it.
- `Scene3D.shadowMapFrequency` / `_ShadowMapupdateFrequency` exists.
- `u_GIRotate` is a scene uniform.
- `laya.postProcess.js` always calls `_lutBuilderMat.removeDefine(l.SHADERDEFINE_CUSTOMLUT)`.
- The camera's `clientWidth` uses `Config3D.pixelRatio`.
- `ShaderVariantCollection.compileAll()` exists.
- `laya.gltf.js` `createDefaultMaterial` does `new r.Material; a.setShaderName(t.ShaderName)` with `ShaderName="glTFPBR"`.
- `laya.core.js` contains `"ktx2 !"`.
- `packages/core/TopologyGraph.ts:304` declares `providesGlobals: ['Laya.TrailSprite3D']` and `:360` declares `['Laya.IKConstraint']`. Neither global exists: 0 hits in `laya.trail3D.js` and `laya.ik.js`.
- `packages/compiler/browser-sdk.mjs:23` gives the `'3d'` profile `['core','2d','3d','ui']`.
- `docs/quality-route.md:253` is the "Not built yet" list.
- `scripts/` holds 41 `verify-*.mjs` scripts, including `verify-webgpu.mjs`, `verify-film-webgpu.mjs`, `verify-film-finishes.mjs` and `verify-quality-route.mjs`.

## 1. Gaps that stand (three.js better)

"TSL" means the three.js capability exists only on its WebGPURenderer/TSL path. "3rd-party" means three.js does not ship it.

### Materials and shading

| Capability | three.js evidence | Engine state | Imp. | Effort |
|---|---|---|---|---|
| Geometric specular AA, material dithering | `lights_physical_fragment.glsl.js:7-13` geometryRoughness; `Material.js:399` dithering | `specularAA()` defined in `laya.d3.js` but never called; no dither | high | small |
| Toon / cel shading with ramp | `MeshToonMaterial.gradientMap`, `OutlineEffect.js` | 0 hits for toon/gradientMap in Laya and engine | high | medium |
| Lit-surface hook scope (alpha, normal, lighting term, MRT outputs) | `NodeMaterial.js` about 20 slots (TSL) | `ZhudaLitSurface` has baseColor/metallic/roughness/occlusion/emission only | high | medium |
| Matcap | `MeshMatcapMaterial.js` | none | medium | small |
| Sheen authoring | `MeshPhysicalMaterial.sheen*` | Laya `DEFINE_SHEEN` shader complete; reachable only through glTF | medium | small |
| Anisotropy rotation and direction map | `anisotropyRotation` (any angle), `anisotropyMap` | Laya setter clamps rotation to 0..1 rad; engine exposes strength only | medium | small |
| Transmission authoring, transmissive-behind-transmissive | `transmissionRenderTarget` with back-face pass | glTFPBR `DEFINE_TRANSMISSION` via glTF only; transparent queue; no back-face pre-pass | medium | medium |
| Subsurface (skin, wax) | `MeshSSSNodeMaterial` (TSL); WebGL example shader only | `ZHUDA_TRANSLUCENT` back-lit lobe only (Laya342Adapters.ts:208-235) | medium | medium |
| Alpha hash | `alphahash_pars_fragment.glsl.js` | none | medium | small |
| Alpha to coverage | `WebGLState.js:786`, `WebGPUPipelineUtils.js:212` | no render-state flag in Laya | medium | medium (vendor) |
| Bump/parallax | `bumpmap_pars_fragment`, `displacementmap_*` | Laya `PARALLAXTEXTURE` setter is dead (no `#ifdef`) | medium | medium |
| Wide lines in pixel width, dashed 1px lines | `lines/LineMaterial.js` worldUnits, `LineDashedMaterial` | ribbons do world width and dash by texture; no screen-width line | medium | medium |
| Standalone light billboard/sprite, points | `Sprite.js`, `PointsMaterial` | `Laya.UI3D` billboard (render-to-texture, heavy, not wrapped); no `gl_PointSize` | medium | small |
| ior/specular, iridescence, volume authoring | `MeshPhysicalMaterial` | glTFPBR uniforms via glTF only | low | small |
| Shadow catcher, normal material, clipping planes | `ShadowMaterial`, `MeshNormalMaterial`, `Material.clippingPlanes` | none | low | small–medium |
| Dispersion, rough diffuse (EON), retroreflectivity | `USE_DISPERSION`, `BRDF_EON` | 0 hits | low | medium |
| Node material system | TSL `NodeMaterial` (TSL) | GLSL string hooks only | medium | large |

### glTF and asset loading

| Capability | three.js evidence | Engine state | Imp. | Effort |
|---|---|---|---|---|
| KTX2/Basis | `KTX2Loader.js`, `libs/basis/` | `"ktx2 !"` throw; `KHR_texture_basisu` 'unsupported' | high | medium |
| Mesh quantization | `GLTFMeshQuantizationExtension` | `fillMeshBuffers` copies raw floats; rejected | high | medium |
| Meshopt breadth (KHR name, COLOR filter, workers, fallback) | `GLTFMeshoptCompression` ×2 | EXT only, no COLOR, main thread, embedded only | high | small |
| Embedded image decode | Blob + `createImageBitmap` | base64 data URL on main thread | medium | small |
| EXT_texture_webp/avif | `GLTFTextureWebPExtension`/`AVIF` | not read | medium | small |
| texCoord > 0 / transform texCoord | `texture.channel` | Laya warns "non 0 uv channel unsupported" | medium | small |
| KHR_lights_punctual | `GLTFLightsExtension` | 0 hits | medium | small |
| EXT_mesh_gpu_instancing | `GLTFMeshGpuInstancing` | none | medium | small |
| Node extras, cameras, multiple scenes | `assignExtrasToUserData`, `loadCamera` | extras only for targetNames; default scene only | medium | small |
| Draco | `DRACOLoader.js` | 'unsupported' | medium | medium |
| UltraHDR gain map | `UltraHDRLoader.js` | none | medium | small |
| .cube/.3dl LUT | `LUTCubeLoader.js` + `LUTPass` | no loader; `CUSTOMLUT` path dormant | medium | small |
| Containers: .pvr, DDS DX10/BC6H/BC7 | `PVRLoader`, `DDSLoader` | `_parsePVR` throws "Not implemented."; no DX10 | medium | small (use KTX1) |
| Skinning > 24 bones per draw | `Skeleton.boneTexture` | `splitSubMeshByBonesCount` at 24 | medium | large |
| EXR, FBX, USD, splats (TSL), other formats, exporters, extra material extensions (dispersion, diffuse_roughness, EXT bump) | add-ons in `examples/jsm/loaders`, `exporters` | none | low | medium–large |

### Lights, shadows and environment

| Capability | three.js evidence | Engine state | Imp. | Effort |
|---|---|---|---|---|
| Runtime GPU PMREM, half-float environment | `PMREMGenerator.js` (HalfFloatType) | CPU prefilter; needs `R32G32B32A32` + float linear filtering or throws | high | medium |
| HDRI (.hdr equirect) lighting | `scene.environment` + PMREM | `look.panorama` png/jpg only, backdrop only; `decodeRadianceHdr` used for lightmaps only | high | small |
| Point-light shadows that follow moving objects, >8 lights | `PointLightShadow` per frame | `ZhudaPointShadow`: 8 lights, redrawn only on `render()` | high | medium |
| Physical falloff, penumbra, photometric units | `LightUtils.js:13`, `SpotLight.penumbra` | Laya fitted curve; inner cone fixed at half the angle | medium | medium |
| Several shadowed spot lights | per-light `SpotLightShadow` | one `_mainSpotLight` | medium | large |
| Contact / screen-space shadows | `SSSNode.js` (TSL), `ShadowMesh.js` | none | medium | medium |
| Rect area lights (LTC) | `RectAreaLight` + `RectAreaLightTexturesLib` | `AreaLightCom` bake-only | medium | medium |
| Shadow filter radius, VSM | `ShadowFilterNode.js`, `VSMShadowMap` | Hard/SoftLow/SoftHigh only | medium | small |
| Studio environment (RoomEnvironment) | `environments/RoomEnvironment.js` | hemisphere cube only | medium | small |
| Background blur, 3-axis rotation | `Scene.backgroundBlurriness`, `backgroundRotation` | yaw and exposure only | low | small |
| Cookies, IES (TSL), realtime GI/VXGI/SSGI (TSL) | `SpotLight.map`; `IESSpotLight`; `vxgi/` | none | low | medium–large |

### Post-processing

| Capability | three.js evidence | Engine state | Imp. | Effort |
|---|---|---|---|---|
| Quality upscaler (EASU+RCAS, TAAU) | `FSR1Node.js`, `TAAUNode.js` (TSL) | `dprCap` step only; `Config3D.pixelRatio` unused | high | medium |
| Selection outline | `OutlinePass.js`, `OutlineNode` | none | high | medium |
| GTAO with denoise | `GTAOPass.js`, `GTAONode` | Laya ScalableAO | high | medium |
| SMAA | `SMAAPass.js` | FXAA/MSAA only | medium | medium |
| RCAS sharpen | `SharpenNode.js` (TSL) | inside Laya TAA only | medium | small |
| External LUT | `LUTPass.js`, `Lut3DNode` | none | medium | small |
| AgX / Neutral tone mapping | `constants.js` operators | Laya ACES only | medium | small |
| Material-aware SSR | `SSRNode.js` (TSL) | uniform-wetness SSR; Laya GBuffer unused | medium | large |
| TAA with per-object velocity | `TRAANode`, `VelocityNode` (TSL) | Laya motion vectors from camera only; zero for BONE/GPU_INSTANCE | medium | large |
| OIT | `OITPassNode.js` (TSL) | none | medium | large |
| Pass graph with MRT inputs | `EffectComposer`, `mrt()` (TSL) | fixed chain, colour + depth only | medium | large |
| Per-object motion blur (TSL), denoisers, pixelation, stylized effects, transitions | `tsl/display/*`, `postprocessing/*` | none | low | small–large |

### WebGPU and shader authoring

| Capability | three.js evidence | Engine state | Imp. | Effort |
|---|---|---|---|---|
| Automatic WebGL2 fallback | `WebGPURenderer` `getFallback` | throws `WEBGPU_UNAVAILABLE`; one backend per realm | high | medium |
| WGSL without about 1.7 MB gzip WASM | `WGSLNodeBuilder.js` | glslang + naga WASM, about 5.9 MB raw | high | large |
| Async compile / warm-up | `compileAsync`, `createRenderPipelineAsync`, `KHR_parallel_shader_compile` | sync; `ShaderVariantCollection` unused | high | medium |
| Public compute and storage buffers | `ComputeNode`, `StorageBufferNode` | Laya internal WebGPU-only `ComputeShader`, `DeviceBuffer` | high | medium |
| Uniform types (int, mat, cube, 3D, arrays) | `UniformNode`, `uniformArray` | spec allows float/vec2-4/texture2D only | medium | small |
| Public GLSL function library | `MaterialXNoise`, `tsl/math` | noise private per feature | medium | medium |
| WebGPU GPU timestamps | `TimestampQueryPool` | Laya `WebGPUTimingHelper` uncalled; profiler is WebGL-only | medium | small |
| Occlusion queries | `Renderer.isOccluded` | 0 hits | medium | medium/large |
| Render bundles | `BundleGroup.js` (WebGPU) | Laya bundle manager stubbed | low–medium | large |
| WebGPU compat mode | `featureLevel:'compatibility'` | not requested | medium | medium |
| Storage textures, atomics, subgroups, indirect API, MRT outputs from custom shaders, readback | TSL/WebGPU | Laya internals only | medium/low | medium |
| Compute on WebGL2 | transform-feedback emulation | none | medium | large |

### Animation, geometry, scene objects, runtime

| Capability | three.js evidence | Engine state | Imp. | Effort |
|---|---|---|---|---|
| Weighted N-clip blending | `setEffectiveWeight`, `PropertyMixer` | one state per layer; no blend tree | high | medium |
| Node-free instancing with per-instance colour | `InstancedMesh.setColorAt` | one Laya node per copy; `DrawMeshInstancedCMD` unused | high | medium |
| Multi-draw batching (WebGL) | `BatchedMesh`, `WEBGL_multi_draw` | Laya static batch unused (culls ranges but one draw per range); WebGPU auto-merge only | medium | medium |
| Projected decals | `DecalGeometry.js` | flat-plane `ZhudaDecal` | medium | medium |
| Extrude with holes and bevel | `ExtrudeGeometry.js` | single outline | medium | small |
| Surface sampling, weld, crease | `MeshSurfaceSampler`, `BufferGeometryUtils` | none | medium | medium |
| Mesh-triangle picking and collision without physics | `Mesh.raycast`, `Octree.js` | AABB/heightfield/providers only | medium | small |
| Retargeting | `SkeletonUtils.retarget` | none | medium | large |
| Positional audio | `PositionalAudio.js` HRTF panner | none | medium | small |
| Context-loss in-place restore | `WebGLRenderer` restore | whole-realm replacement | medium | large |
| Directional shadow caching (per-light) | `LightShadow.autoUpdate` | Laya `shadowMapFrequency` / `Stat.enableShadow` exist, not exposed | medium | small |
| Debug helpers, transform gizmo, camera controls, tweak UI, inspector (TSL) | `src/helpers`, `controls/`, `inspector/` | PixelLine primitives, Laya `Stat.show`, IK debug draw | medium | small–medium |
| Shader error excerpts on WebGL | `WebGLProgram.js` handleSource | WebGPU excerpts only (Renderer.ts:148-170) | medium | small |
| Bundle size / tree-shaking | ESM, about 210 KB gzip comparable app | about 765 KB gzip `3d-gltf` | high | large |
| Primitives (torus etc.), 3D text, fat lines, generators (TSL), occlusion culling, meshlets (TSL), WebXR, offscreen worker, multiview | `geometries/`, `generators/`, `pipelines/` | none or partial | low | small–large |

## 2. Work packages, in order

Proof convention for every package:

- A `node --test` unit test in `tests/<name>.test.mjs` covering validation, defaults and the failing path.
- A real draw in `scripts/verify-<name>.mjs` on desktop WebGL and desktop WebGPU, in the style of `verify-film-finishes.mjs` / `verify-film-webgpu.mjs`, with a reference PNG and `measureZhudaFrame` metrics.
- `npm run verify`.
- For speed packages, a vivo V40 record next to `docs/plans/records/phone-cost/verification.md`.

WebGPU hardware evidence exists only for Apple M4. Every other device stays UNAVAILABLE until it is run.

### WP0. Housekeeping (hours)

- Goal: correct `TopologyGraph.ts:304` (`Laya.TrailSprite3D` → `Laya.TrailRenderer`) and `:360` (`Laya.IKConstraint` → a real export such as `Laya.IK_Comp`).
- Also update the stale MCP guardrail `GUARD_SCENE_QUALITY_ROUTE` (point-light shadows).
- Proof: a resolve_topology test that checks every `providesGlobals` against the loaded lib.
- Risk: none.

### WP1. Phone frame cost: shadow caching and render scale (WebGL + WebGPU)

- Goal: cut the measured 3.5–6.7 ms shadow cost and the 40–64 ms look-level-2 frames.
- Build:
  - (a) `look.shadows.update: 'every' | 'interval' | 'onDemand'` in `film/FilmScene.ts` / `FilmStage.ts`, mapped to Laya `Scene3D.shadowMapFrequency` plus a `Stat.enableShadow` dirty toggle. It already exists; it only needs exposing.
  - (b) A `renderScale` knob (0.5–1) on `ZhudaQualityGovernor` and `LookQuality.ts`, through `Config3D.pixelRatio` or a camera render target.
  - (c) An EASU+RCAS pass as a `MaterialPostProcessEffect` in `finishEffects`, next to `EdgeSmoothing.ts`. It also covers the standalone sharpen gap.
- three.js ships EASU/RCAS/TAAU only on WebGPU/TSL.
- Proof:
  - unit: governor steps through scale levels;
  - draw: a static and a moving caster (shadow stays correct on non-skipped frames), and 0.67× scale with sharp edges against a native-resolution reference;
  - phone: ms per frame before and after on the V40.
- Risk:
  - Laya deletes the "Shadow" uniform map on skipped frames (`preDrawUniformMaps.delete("Shadow")`), which may drop shadows on receivers. Needs a draw check.
  - Whether `pixelRatio` output fills the canvas is unverified.

### WP2. Specular AA and material dithering

- Goal: stop specular sparkle on dense normal maps on phones.
- Build:
  - A text patch, like `installLaya342Translucency`, that calls Laya's existing `specularAA(perceptualRoughness, normalWS)` in the PBR surface init (PBR, glTFPBR, `ZhudaLitSurface`) under a `ZHUDA_SPECULAR_AA` define.
  - An optional `ZHUDA_DITHER` 8-bit dither in the lit fragment.
- Proof:
  - unit: the patch anchor is found exactly once;
  - draw: a high-frequency normal-mapped sphere (temporal flicker metric across sub-pixel camera jitter, `hardEdgeShare`) on both backends.
- Risk: the anchor string may change with any Laya upgrade, and the WebGPU uniform-control-flow rule applies to the `dFdx` usage.

### WP3. Shader warm-up

- Goal: no first-draw hitch at scene mount, LOD switch or quality-level change.
- Build: a `zhudaWarmUp(scene, {levels})` that records `ShaderVariantCollection` entries per material and quality level at build or capture time and calls `compileAll()` behind `MiniGameSplash`. Fallback: draw every variant once into a 1×1 target.
- Proof:
  - unit: variant list is deterministic;
  - draw: first-frame time after mount with and without warm-up on both backends;
  - phone: longest frame during a mount and level switch.
- Risk: synchronous compile moves the hitch into the splash. True async compile needs vendor patches (`KHR_parallel_shader_compile`, `createRenderPipelineAsync`): a later, larger package.

### WP4. glTF intake quick wins (all small, in `Laya342GltfAdapter.ts`, `MeshoptModelDecoder.ts`, `ModelCompatibility.ts`)

- Embedded images through `Blob` + object URL, or `createImageBitmap`, instead of the base64 data URL.
- `EXT_texture_webp` / `EXT_texture_avif` source resolution, keeping the optional fallback.
- Meshopt: add the `KHR_meshopt_compression` name and the COLOR filter (`meshopt_decodeFilterColor`); optional `useWorkers`.
- `KHR_mesh_quantization`: dequantize normalized accessors to float in the existing pre-parse pass.
- `KHR_lights_punctual` mapped to Laya Directional/Point/Spot.
- Node extras and cameras attached to named nodes.
- `EXT_mesh_gpu_instancing` emitted as `ModelPlacements`. This needs a quaternion placement form.
- texCoord 1 for AO/lightmap slots, where Laya allows it.
- Proof:
  - unit: one fixture per extension, with compatibility report codes;
  - draw: `verify-model-showcase.mjs` fixtures on both backends;
  - phone: mount-time peak memory for a GLB with embedded textures.
- Risk: AVIF decode varies by device. Dequantize raises GPU memory back to float.

### WP5. KTX2/Basis

- Goal: GPU-compressed textures on phones.
- Build:
  - A pinned `basis_transcoder` WASM as a `'ktx2-basis'` adapter in `ZhudaModelDecoderRegistry` (format already reserved in `ModelDecoder.ts`).
  - Choose the target from `RenderCapable.COMPRESS_TEXTURE_ASTC/ETC/S3TC/PVRTC`; upload via `Texture2D.setKTXData`-style data.
  - Patch `loadTextureFromInfo` to read `extensions.KHR_texture_basisu.source`.
  - Later: a `--ktx2` output in `zhuda-laya-lod`.
- Proof:
  - unit: transcode fixture, integrity hash, timeout and abort;
  - draw: textured model on both backends;
  - phone: GPU memory (`Stat` `M_Texture2D`) and upload time against PNG.
- Risk: Laya has no BC7 enum (desktop falls back to DXT). Each mini-game host needs its own format check. Adds a WASM payload.

### WP6. Environment lighting

- Build:
  - (a) An HDRI environment: `decodeRadianceHdr` → equirect-to-cube → `prefilterZhudaEnvironment` → `createPrefilteredEnvironment.apply`, plus an HDR panorama sky.
  - (b) Expose `Scene3D.GIRotate` as `environment.rotationDeg` (exists in Laya).
  - (c) RGBM or half-float fallback when float32 or float-linear filtering is missing, covering `Filmic.ts:144` and `ProbeVolume.ts:484`; an SH-only hemisphere fallback.
  - (d) A procedural studio room cube.
  - (e) Background blur from a prefiltered mip.
  - (f) Later: a GPU prefilter pass into half-float cube faces.
- Proof:
  - unit: equirect sampling, SH rotation;
  - draw: chrome and rough spheres under an HDRI on both backends, rotated against unrotated;
  - phone: with float filtering forced off.
- Risk: CPU prefilter time at large sizes; the phone float capability spread is unknown.

### WP7. Material authoring surface (exposes shader paths LayaAir already has)

- Build:
  - A `SurfaceMaterialSpec` kind `'physical'` that builds `new Laya.Material()` + `setShaderName('glTFPBR')`, as in `laya.gltf.js` `createDefaultMaterial`, with:
    - sheen,
    - iridescence,
    - ior/specular,
    - transmission + volume (requires `configureSurfacePasses({opaqueColor})`),
    - clearcoat maps and normal scale,
    - `anisotropyRotation` written by `shaderData.setNumber` (bypassing the 0..1 clamp) plus `anisotropyTexture`.
  - Widen `ZhudaLitSurface` with `alpha`, `normalTS` and an alpha-hash cutout mode, in `LitSurfaceTemplates.ts`.
- Proof:
  - unit: spec validation and uniform mapping;
  - draw: cloth sheen, brushed disc at 0/45/90°, glass over a checker, on both backends (extend `verify-film-finishes.mjs`).
- Risk:
  - glTFPBR is registered only when `laya.gltf.js` is loaded (a topology dependency).
  - The opaque pass on WebGPU is unverified.
  - Transmissive-behind-transmissive needs a back-face pass (medium, separate).

### WP8. Stylized shading and highlight

- Build:
  - `ZhudaToonMaterial`: a lit template with ramp-quantized N·L that reads Laya light uniforms and shadow, plus an inverted-hull outline pass from the same spec.
  - A matcap recipe and a normal-view recipe in `ShaderMaterials.ts` `shaderRecipes`.
  - A selection-outline post effect: selected renderers drawn to a layer-masked mask target, then an edge pass with visible and hidden colours.
- Proof:
  - unit: ramp validation;
  - draw: a toon character with shadows, multiple lights and an outline on both backends; outline pulse on a selected prop.
- Risk: the toon template must follow Laya's clustered light loop; the WebGPU 16-sampler limit.

### WP9. Instancing and crowds

- Build:
  - A node-free `ZhudaInstancedRenderer` over `DrawMeshInstancedCMD` + `MaterialInstancePropertyBlock` (≤1024 per command, per-instance colour/tint), grouped per `--split` cell. Used by `ModelPlacements` in a new `instanced` mode.
  - A typed wrapper for `SimpleSkinnedMeshRenderer` (`SIMPLEBONE` + `GPU_INSTANCE`, `u_SimpleAnimatorTexture`) with a build-time glTF-to-animation-texture baker in `packages/compiler`.
- Proof:
  - unit: chunking and bounds per cell;
  - draw: 5,000 props and 500 baked characters on both backends with draw counts (`Stat` `CT_Instancing_DrawCall`);
  - phone: CPU ms against node-per-copy.
- Risk: culling granularity is per command; the baker format is undocumented upstream.

### WP10. Animation control

- Build:
  - A typed `crossFade` on the model controller.
  - An N-clip weighted blend evaluator (1D/2D blend space) on the `WebAnimatorEvaluator` path that `ModelAnimationSampler` uses.
  - Wrappers for `AvatarMask` and the Laya IK solvers (`IK_FABRIK_Solver`, `IK_TwoBoneChain`, `IK_Lookat`) with foot-on-terrain fixtures.
- Proof:
  - unit: weight normalization, deterministic sampling;
  - draw: walk/run blend sheet and IK feet on a slope on both backends.
- Risk: depends on Laya 3.4.2 private fields (`_currentFrameIndices`); IK is undrawn so far.

### WP11. Post quality set

- Build:
  - A `.cube` parser + 3D LUT pass (or enable the dormant `CUSTOMLUT` path).
  - AgX/Neutral tone mapping, by running `ColorGradEffect` with `ToneMappingType.None` while keeping the range clamp.
  - Validated look fields for white balance, lift/gamma/gain and bloom softKnee/dirt/anamorphic.
  - A Laya `LensFlareEffect` wrapper.
  - GTAO from the existing DepthNormals texture.
  - SMAA (area and search textures, three passes).
- Proof:
  - unit: `.cube` parsing (size, domain), option validation;
  - draw: colour charts and AO crease scene on both backends;
  - phone: SMAA ms against FXAA.
- Risk: grade-range clamp interplay; SMAA texture licence and provenance must be recorded.

### WP12. Backend delivery

- Build:
  - A pre-boot loader page (browser-sdk template plus compiler option) that probes `navigator.gpu.requestAdapter()` and loads exactly one of the existing WebGL/WebGPU bundles, recording `fallbackReason`.
  - Lazy-load and cache the WebGPU WASM.
  - Check whether `'ui'` can leave the 3D profiles (`browser-sdk.mjs:23`).
- Proof:
  - unit: loader decision table;
  - draw: `verify-webgpu.mjs` with and without `navigator.gpu`;
  - size: report gzip per profile.
- Risk: keeps the one-backend-per-realm rule; '2d' is probably needed by 3D (render device), so only 'ui' is a candidate.

### WP13. Lighting depth

- Build:
  - Inverse-square windowed falloff and a spot penumbra uniform through the `PointShadow.ts` text-patch method.
  - A point-shadow redraw policy (one light's faces per frame, dirty flags).
  - A shadow softness radius on Laya's tent filter.
  - Contact shadows as a depth march toward the sun in `sceneEffects`.
  - Cascade blending.
  - Later: an LTC rect-area light, a spot-shadow atlas reusing the point-shadow atlas, cookies.
- Proof: draw a lamp-post scene with lux-like units and a moving caster under a point light on both backends; phone ms for contact shadows.
- Risk: uniform-block layout (`PointShadow.ts:50-55`); the 16-sampler limit on WebGPU.

### WP14. Small game services

- Spatial audio: a `spatial` option on `playSample` (PannerNode between voice gain and channel gain, `setListener(pose)`), keeping one AudioContext. Gain-only fallback where a host lacks PannerNode.
- A triangle BVH `QueryProvider` for mesh picking without Bullet.
- Extrude holes and bevel, a Catmull-Rom feed from Laya `CurvePath` into sweep/tube, torus and ring primitives.
- Proof: unit tests for each; a draw for the geometry; an audio graph test with OfflineAudioContext.
- Risk: low.

### WP15. Developer tooling

- Build:
  - Expose `Laya.Stat.show` as a debug overlay.
  - A WebGPU timestamp path in `ZhudaRuntimeProfiler` via Laya `WebGPUTimingHelper`, plus a WebGPU draw counter.
  - PixelLine helpers: axes, grid, bounds, light and camera frustum, skeleton (reuse `laya.ik.js` `Skeleton3D`), shadow-map viewer.
  - WebGL shader-error source excerpts matching the WebGPU ones.
  - A transform gizmo for the model and film editors.
- Proof: unit tests for error excerpt formatting; draw helper sheets on both backends.
- Risk: low.

### WP16. WebGPU-only depth (later; three.js equivalents are mostly WebGPU/TSL too)

- Public `ZhudaComputePass` and storage buffers over Laya `ComputeShader` / `DeviceBuffer`, with a declared CPU or vertex fallback on WebGL.
- Wider uniform types (int, mat4, cube, 3D, arrays) in `validateShaderSpec`.
- A public `ZhudaCommon.glsl` include (noise, hash, triplanar).
- `opaqueMRT` GBuffer wiring so SSR reads roughness and normals.
- Per-object velocity for TAA and motion blur.
- Proof: compute particle fixture on WebGPU; an explicit UNAVAILABLE result on WebGL.
- Risk: vendor maturity; skipped-cull history on Laya WebGPU.

## 3. Gaps not worth closing (now)

- **FBX, OBJ, USD, other formats, runtime exporters:** games ship GLB. Use build-time conversion if needed.
- **Gaussian splats, VXGI, SSGI, IES, multiview, WebXR, offscreen-worker rendering:** WebGPU-only or too heavy for phones, or outside the targets. Laya's DOM-bound runtime blocks the worker.
- **A full TSL-equivalent node system:** large. Widening the hooks (WP7, WP16) covers game needs.
- **Render bundles, meshlets, Hi-Z, compute on WebGL2:** WebGPU-only or large. Phones and mini-game hosts mostly run WebGL.
- **Skinning above 24 bones:** a large vendor shader change. Author fewer than 24 bones per material region, or use baked instancing (WP9).
- **In-place context-loss restore:** make realm restart faster instead.
- **Dispersion, EON diffuse, retroreflectivity, EXR, 3D extruded text, pixelation/stylized/transition presets, tweak UI:** low value for games; add individual presets only on request.
- **OIT:** it touches Laya's transparent queue, so the cost is large. Revisit after alpha hash (WP7) and TAA.
- **KHR_materials_variants:** neither stack ships it. Use `independentMaterials` plus a mapping table.

## 4. Where the engine is already ahead

- **Materials:** detail maps; ready VFX material (dissolve, soft, refraction); procedural and photo PBR recipes.
- **Assets:** asset delivery with integrity, limits and leases; glTF preflight report; model template lifecycle; build-time LOD/split tool.
- **Lighting:** box-projected reflection probes; directional HDR lightmaps; lit height fog with shafts on both backends.
- **Post:** GPU auto-exposure; volumetric clouds; accumulated film capture; quality governor with frame metrics.
- **Shaders and WebGPU:** portable GLSL on both backends; backend diagnostics; shader spec validation.
- **Animation:** state machine, avatar masks, IK solvers and baked skinned instancing come from vendored LayaAir and are not yet wrapped. Action frame data, crowd animation LOD and particles/trails are the engine's own.
- **Scene and runtime:** grass fields; LOD generation and runtime LOD; Bullet physics shipped with the engine; audio lifecycle; runtime lifecycle and clocks; mini-game platforms.
- **Developer experience:** strict TS types; docs; examples; Laya stat counters; editors; MCP tools; CLI/doctor; visual regression gate; pinned single-HTML SDK.

## 5. Uncertain

- Whether `Config3D.pixelRatio` (or a smaller camera target) fills the canvas correctly on both backends. Not run.
- Whether `shadowMapFrequency` > 1 keeps receivers shadowed on skipped frames (the "Shadow" uniform map is deleted). Not run.
- Whether Laya's opaque-colour pass works for transmission on WebGPU. Whether the `CUSTOMLUT` branch works if the define is kept.
- Phone support for float32 + float linear filtering (environment, probes, clustered lights). Only one Adreno 720 is on record. Clustered binning is CPU work every frame, with unmeasured phone cost.
- Patch anchors for `specularAA` across PBR, glTFPBR and `ZhudaLitSurface`. The exact insertion point was not checked.
- Robustness of Laya's WebGPU GPU batching and culling beyond the two patched bugs. three.js WebGPU maturity was not measured.
- The cost of the `UI3D` billboard, the Shuriken `particle3d` path and `SimpleSkinnedMeshRenderer`: undocumented here, never drawn.
- Whether the `'2d'` module can leave 3D profiles. Probably not (render device), so only `'ui'` is a candidate.
- AVIF and KTX2 target formats on each mini-game host; WebGPU on Windows, Android and iOS. All UNAVAILABLE.
