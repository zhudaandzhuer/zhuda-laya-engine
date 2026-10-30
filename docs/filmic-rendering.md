# Filmic surfaces and HDR rendering

These APIs expose the bundled LayaAir 3.4.2 PBR, HDR and post-processing renderer to independent TypeScript projects. The reference consumer is [HARBOR / 01](https://github.com/zhudaandzhuer/zhuda-neon-racer/blob/main/src/VisualSlice.ts). Its art, HDRs, vehicle and scenery belong to that game repository.

## Lit shader hooks

Use `ZhudaLitSurfaceMaterial` when a procedural surface needs native lights, environment reflections, shadow reception/casting, fog and depth normals. `ZhudaShaderMaterial` remains useful for explicitly unlit effects and sky materials.

```ts
import {
  ZhudaLitSurfaceMaterial,
  ZhudaDynamicMesh,
  computeMeshTangents,
} from "zhuda-laya-engine";

const surface = new ZhudaLitSurfaceMaterial({
  name: "WetStone",
  normalConvention: "opengl", // +Y maps; native Laya defaults to DirectX -Y
  material: {
    color: [1, 1, 1, 1],
    roughness: 0.8,
    metallic: 0,
    textures: { albedo, normal, metallicGloss },
    clearCoat: 0.15,
    clearCoatRoughness: 0.2,
  },
  uniforms: { u_ZhudaWet: { type: "float", value: 0.4 } },
  surface: `void zhudaSurface(inout ZhudaLitSurface s,
      vec2 uv, vec3 worldPosition, vec3 worldNormal) {
    s.baseColor *= mix(1.0, .65, u_ZhudaWet);
    s.roughness = mix(s.roughness, .16, u_ZhudaWet);
  }`,
});
surface.set("u_ZhudaWet", 0.7);
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

The hook receives **scene-linear** `baseColor` and HDR `emission`, plus `metallic`, `roughness` and `occlusion`. It modifies surface response before native PBR lighting. It does not displace vertices, change alpha, replace normals or inject arbitrary lighting. This bounded contract keeps shadow and depth-normal passes consistent. The normal convention applies to both color and depth-normal passes. Tangent frames derive from UVs, including rotated/mirrored UVs; a degenerate UV has a stable fallback, but cannot describe a meaningful normal-map orientation.

Color/albedo and emission textures must be uploaded with the appropriate sRGB flag; normal and packed data maps stay linear. Native `metallicGloss` uses metallic in **R** and smoothness in **A**. `packMetallicRoughness` converts glTF G-roughness/B-metallic RGBA bytes. Smoothness is also multiplied by the material smoothness factor. Uniform names use the `u_Zhuda` prefix; typed texture uniforms must have a binding. Shader names are immutable contracts; changing GLSL, normal convention or uniform declarations requires a new name. Validation is structural; actual GPU compilation requires a draw.

`surface.dispose()` destroys its material after detaching borrowed textures. Destroy meshes/instances first; the caller owns textures. Shader registrations/program caches persist in the native runtime, so use stable shader names rather than generating one per instance.

## Offline convolved HDR environments

```ts
import { createPrefilteredEnvironment } from "zhuda-laya-engine";
const lighting = createPrefilteredEnvironment(descriptor, float32Pixels);
lighting.apply(scene);
```

The descriptor contains a power-of-two `size`, a complete mip list `{ size, offset, elements }` and 27 finite, RGB-interleaved `ambientSH` values. Offsets/counts are **float32 elements, not bytes**. Each mip contains RGBA, in WebGL cube face order +X, -X, +Y, -Y, +Z, -Z. Values are nonnegative scene-linear radiance; no sRGB/gamma/RGBD packing. Each subsequent side halves to 1. The factory explicitly enables trilinear filtering so fractional roughness LODs interpolate between the supplied GGX levels. The upload requires float textures and float linear filtering; unsupported capabilities fail explicitly.

Generate GGX-convolved specular mips for Laya's native perceptual roughness lookup `mip = maxMip * r * (2-r)`. A raw resized image pyramid is not a convolved light source. Native diffuse SH evaluates:

```
SH0 + SH1*y + SH2*z + SH3*x + SH4*x*y + SH5*y*z
    + SH6*(3*z*z-1) + SH7*z*x + SH8*(x*x-y*y)
```

Native IBL mirrors world X before sampling/evaluation; the offline producer must account for this for both the cube and SH. The consumer's [preparation script](https://github.com/zhudaandzhuer/zhuda-neon-racer/blob/main/scripts/prepare-visual.py) supplies a reproducible example. It stores diffuse irradiance divided by pi and the matching shadow-light direction. The sky, IBL orientation and direct sun must agree. `lighting.dispose()` destroys the owned cube; detach it from scenes or destroy those scenes first.

## HDR camera pipeline

```ts
import { ZhudaFilmicPipeline } from "zhuda-laya-engine";
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

`ZhudaPlanarReflection(scene, { width, height, planeY, excludedLayer })` owns a mirrored camera and half-float target. `update(eye, target, fovDegrees, sourceAspect?)` returns four column-major view-projection columns for projected texture sampling. The source aspect can differ from the target's aspect. It mirrors the camera position, target and up vector; set the main surface and all unwanted geometry to the excluded layer. `dispose()` destroys both owned objects.

This is a real second scene render, with its associated rendering cost. It handles **horizontal planes only**, has no general oblique clipping plane and no rough-reflection convolution. Geometry below the plane must be excluded by the consumer to prevent it occluding the reflected scene. Reflecting surfaces must be excluded to prevent feedback. The consumer owns Fresnel, edge masks, transparency and any ripple distortion. This API does not implement screen-space reflections or general global illumination.

## Quality acceptance

The first consumer checks actual PBR factor/texture bindings, camera cuts, movement, shadow-only pixel differences, reflected-camera pose, reflection-target pixel differences and lighting A/B outside UI. It replaces and draws 30 post-processing chains and checks that resource counts settle. Unit and strict public-type checks accompany real WebGL rendering; counts and screenshot byte differences alone do not establish visual quality.

The current consumer remains a first visual slice. Its screenshot review still identifies weak architecture/material variation and reconstructed vehicle surfaces. It does not establish Unreal parity, Lumen/Nanite equivalence, a completed AAA game or a mobile performance result.
