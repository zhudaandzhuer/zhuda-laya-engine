# Filmic surfaces and HDR rendering

These APIs expose the bundled LayaAir 3.4.2 PBR, HDR and post-processing renderer to independent TypeScript projects. Art, HDRs, models and scenery belong to the consuming project.

## Lit shader hooks

Use `ZhudaLitSurfaceMaterial` when a procedural surface needs native lights, environment reflections, shadow reception/casting, fog and depth normals. `ZhudaShaderMaterial` remains useful for explicitly unlit effects and sky materials.

```ts
import { ZhudaLitSurfaceMaterial, ZhudaDynamicMesh, computeMeshTangents } from 'zhuda-laya-engine';

const surface = new ZhudaLitSurfaceMaterial({
  name: 'ZhudaWetStone',
  normalConvention: 'opengl', // +Y maps; native Laya defaults to DirectX -Y
  material: {
    color: [1, 1, 1, 1],
    roughness: 0.8,
    metallic: 0,
    textures: { albedo, normal, metallicGloss },
    clearCoat: 0.15,
    clearCoatRoughness: 0.2,
  },
  uniforms: { u_ZhudaWet: { type: 'float', value: 0.4 } },
  surface: `void zhudaSurface(inout ZhudaLitSurface s,
      vec2 uv, vec3 worldPosition, vec3 worldNormal) {
    s.baseColor *= mix(1.0, .65, u_ZhudaWet);
    s.roughness = mix(s.roughness, .16, u_ZhudaWet);
  }`,
});
surface.set('u_ZhudaWet', 0.7);
const mesh = new ZhudaDynamicMesh(
  {
    ...geometry,
    tangents: computeMeshTangents(geometry),
  },
  scene,
);
mesh.node.meshRenderer.sharedMaterial = surface.material;
mesh.node.meshRenderer.castShadow = true;
mesh.node.meshRenderer.receiveShadow = true;
```

The hook receives **scene-linear** `baseColor` and HDR `emission`, plus `metallic`, `roughness` and `occlusion`. It modifies surface response before native PBR lighting. It does not change alpha, replace normals or inject arbitrary lighting; vertices move only through the vertex hook below, which every pass runs. The normal convention applies to both color and depth-normal passes. Tangent frames derive from UVs, including rotated/mirrored UVs; a degenerate UV has a stable fallback, but cannot describe a meaningful normal-map orientation.

Color/albedo and emission textures must be uploaded with the appropriate sRGB flag; normal and packed data maps stay linear. Native `metallicGloss` uses metallic in **R** and smoothness in **A**. `packMetallicRoughness` converts glTF G-roughness/B-metallic RGBA bytes. Smoothness is also multiplied by the material smoothness factor. Uniform names use the `u_Zhuda` prefix; typed texture uniforms must have a binding. Shader names are immutable contracts; changing GLSL, normal convention or uniform declarations requires a new name. Validation is structural; actual GPU compilation requires a draw.

`surface.dispose()` destroys its material after detaching borrowed textures. Destroy meshes/instances first; the caller owns textures. Shader registrations/program caches persist in the native runtime, so use stable shader names rather than generating one per instance.

### Vertex hook: wind, sway and waves

`vertex` is an optional second function body that moves vertices in world space. It runs in the forward pass, the shadow caster and the depth-normal pass, so a blade that bends also bends its shadow and its ambient occlusion:

```ts
const grass = new ZhudaLitSurfaceMaterial({
  name: 'ZhudaGameGrassWind',
  uniforms: {
    u_ZhudaTime: { type: 'float', value: 0 },
    u_ZhudaWind: { type: 'vec2', value: [0.6, 0.2] },
  },
  vertex: `void zhudaVertex(inout vec3 positionWS, inout vec3 normalWS,
      vec2 uv, vec3 originWS) {
    float sway = sin(u_ZhudaTime * 1.7 + originWS.x * 0.3 + originWS.z * 0.2);
    positionWS.xz += u_ZhudaWind * sway * uv.y * uv.y; // tips move, roots stay
  }`,
  surface: `void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {}`,
  material: { color: [0.3, 0.55, 0.2, 1], roughness: 0.8, doubleSided: true },
});
runtime.start(() => grass.set('u_ZhudaTime', performance.now() / 1000));
```

- `positionWS` and `normalWS` are world space and may both be changed; the normal is renormalised and the tangent frame re-orthogonalised after the hook. `uv` is `vec2(0)` on meshes without UVs. `originWS` is the object's world origin, a cheap per-instance phase.
- The body may declare helper functions and read the material's `u_Zhuda` uniforms. It may not declare uniforms, attributes or varyings, `#include` or `#version`, define `main`, or write `gl_Position`/`gl_PointSize` (`validateZhudaLitVertexHook` lists the problems; the constructor throws on them).
- Bounds are the mesh's own. For a hook that moves the surface, grow them with `mesh.padBounds(meters)` on a `ZhudaDynamicMesh` (the padding stays when vertices change), or culling clips the moved geometry.
- `material.doubleSided: true` draws both faces. (Before 1.18.0 a lit material came out one-sided whatever it declared.) The back face is lit with the flipped normal; there is no option yet to light both faces alike.
- Without `vertex` the passes are the native programs byte for byte. The hook is part of the shader name's contract like `surface`.
- Verified by `npm run verify:live-look`: a hooked plate and its shadow move together on a real GPU.

## Lens finish

`ZhudaLensFinish({ grain, vignette, fringe })` is one post-process effect for
the end of the chain: pass `[finish.effect]` as `finishEffects` to
`ZhudaFilmicPipeline` (after tone mapping, in display space) and call
`setFrame(width, height, frameNumber)` before each frame; the grain is a
function of the pixel and that frame number, so it does not change between
renders of the same frame. `dispose()` it after the pipeline.

## Environment captured from the scene

`new ZhudaEnvironmentProbe(scene).capture({ position, reflection, ambient })`
renders the scene's surroundings from one point (six views with a Laya
camera into a half-float target), convolves them on the CPU and applies the
result through `createPrefilteredEnvironment`: glossy surfaces reflect the
scene and unlit surfaces get its ambient light. Call it after the scene has
drawn a frame, and again when the surroundings change; `dispose()` restores
the previous ambient mode. `prefilterZhudaEnvironment(cubePicture)` is the
pure part (GGX mip chain and nine ambient colours in Laya's convention,
which mirrors X) for tools that have their own cube picture. One probe:
reflections are exact at its position only.

## Offline convolved HDR environments

```ts
import { createPrefilteredEnvironment } from 'zhuda-laya-engine';
const lighting = createPrefilteredEnvironment(descriptor, float32Pixels);
lighting.apply(scene);
```

The descriptor contains a power-of-two `size`, a complete mip list `{ size, offset, elements }` and 27 finite, RGB-interleaved `ambientSH` values. Offsets/counts are **float32 elements, not bytes**. Each mip contains RGBA, in WebGL cube face order +X, -X, +Y, -Y, +Z, -Z. Values are nonnegative scene-linear radiance; no sRGB/gamma/RGBD packing. Each subsequent side halves to 1. The factory explicitly enables trilinear filtering so fractional roughness LODs interpolate between the supplied GGX levels. The upload requires float textures and float linear filtering; unsupported capabilities fail explicitly.

Generate GGX-convolved specular mips for Laya's native perceptual roughness lookup `mip = maxMip * r * (2-r)`. A raw resized image pyramid is not a convolved light source. Native diffuse SH evaluates:

```
SH0 + SH1*y + SH2*z + SH3*x + SH4*x*y + SH5*y*z
    + SH6*(3*z*z-1) + SH7*z*x + SH8*(x*x-y*y)
```

Native IBL mirrors world X before sampling/evaluation; the offline producer must account for this for both the cube and SH. A producer stores diffuse irradiance divided by pi and the matching shadow-light direction. The sky, IBL orientation and direct sun must agree. `lighting.dispose()` destroys the owned cube; detach it from scenes or destroy those scenes first.

## HDR camera pipeline

```ts
import { ZhudaFilmicPipeline } from 'zhuda-laya-engine';
const film = new ZhudaFilmicPipeline(camera, {
  exposure: 1.45,
  contrast: 1.01,
  saturation: 0.94,
  aoIntensity: 0.3,
  aoRadius: 0.55,
  bloomIntensity: 0.08,
  temporalAA: true,
});
film.resetHistory(); // camera cut, teleport or seek; ordinary motion retains history
// Before destroying the camera:
film.dispose();
```

The pipeline owns HDR, high-quality scalable AO, bloom, ACES/color grading and optional native TAA. Exposure is the native **linear multiplier**, not an EV count. It rejects a pre-existing post-process chain and requires a half-float render target. It restores the camera's HDR, MSAA and depth settings on disposal and releases owned LUT/material/shader-data allocations. Cleanup uses a version-pinned adapter because LayaAir 3.4.2 effect `release()` only detaches several allocations. Native camera targets and shared render-target pools belong to the camera/runtime; dispose the camera when its scene ends. Do not externally replace or mutate ownership of the chain while using the wrapper.

## Horizontal planar reflection

`ZhudaPlanarReflection(scene, { width, height, planeY, excludedLayer })` owns a mirrored camera and half-float target. `update(eye, target, fovDegrees, sourceAspect?)` returns four column-major view-projection columns for projected texture sampling. The source aspect can differ from the target's aspect. It mirrors the camera position and target and keeps +Y up (with a flipped up, Laya 3.4.2 draws no geometry from the camera); the returned matrix is that camera's own, so projected sampling is exact. Set the main surface and all unwanted geometry to the excluded layer. `dispose()` destroys both owned objects.

`ZhudaReflectiveSurface(scene, { position, size, strength, wetness, roughness, ripple, patternMeters, resolution, layer })` is the ready-made consumer: it owns the mirrored camera, a rectangle mesh and an additive material that adds the reflection on top of whatever is drawn underneath (Fresnel, puddles against damp areas, blur and break-up on damp areas). Call `update(eye, target, fovDegrees, aspect)` when the main camera moves; call `render()` only for frames drawn outside the engine's frame loop. `zhudaMirrorProjection` is the pure matrix it samples with.

`ZhudaLightFog({ density, falloffMeters, baseY, color, scatter, maxDistance })` is height fog lit by point lights, as one post-process effect: pass `[fog.effect]` as `sceneEffects` to `ZhudaFilmicPipeline` (it runs after ambient occlusion and before bloom, in linear HDR, and switches the camera depth texture on), call `setLights` with up to 128 lights (each with a `range` beyond which rays get no glow) and `update(eye, target, fovDegrees, aspect)` when the camera moves, and `dispose()` it after the pipeline. Extinction and the glow from each light are closed-form along the view ray (`zhudaFogOpticalDepth`, `zhudaFogAirlight`); there is no ray marching and no shadowing inside the fog.

This is a real second scene render, with its associated rendering cost. It handles **horizontal planes only**, has no general oblique clipping plane and no rough-reflection convolution. Geometry below the plane must be excluded by the consumer to prevent it occluding the reflected scene. Reflecting surfaces must be excluded to prevent feedback. The consumer owns Fresnel, edge masks, transparency and any ripple distortion. This API does not implement screen-space reflections or general global illumination.

## Quality acceptance

The first consumer checks actual PBR factor/texture bindings, camera cuts, movement, shadow-only pixel differences, reflected-camera pose, reflection-target pixel differences and lighting A/B outside UI. It replaces and draws 30 post-processing chains and checks that resource counts settle. Unit and strict public-type checks accompany real WebGL rendering; counts and screenshot byte differences alone do not establish visual quality.

The current consumer remains a first visual slice. Its screenshot review still identifies weak architecture/material variation and reconstructed vehicle surfaces. It does not establish Unreal parity, Lumen/Nanite equivalence, a completed AAA game or a mobile performance result.
