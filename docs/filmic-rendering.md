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

Indoors, give the capture its room: `capture({ position, box: { min, max } })`
(or `environment.box` in a look). A second LayaAir `ReflectionProbe` is then
put at the capture position with the scene probe's settings, the room as its
bounds and box projection on: what is drawn inside the box looks the capture
up where its reflected ray meets the box, so a lamp on a wall is mirrored at
its place on the wall and not as if it were infinitely far. The scene's own
probe has no place and cannot be projected; things outside the box keep it.
Drawn on desktop WebGL and WebGPU (`npm run verify:film-environment`, the
room step).

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

## Edge smoothing, texture filtering and updates in place

- `new ZhudaFilmicPipeline(camera, { msaa: true })` multisamples the camera's
  HDR target, so geometry edges are smooth in a frame that is drawn once;
  `setAntialias(on)` switches it while the pipeline runs and disposal puts the
  camera's own setting back. A film look does this through `grade.antialias`
  (`msaa` by default). The depth has one value per pixel, so under
  multisampling a pixel on an edge would get the fog of one side only: the
  stair-steps come back along outlines against the sky, and a bright
  background shows unfogged as a pale line round dark things in front of it.
  `ZhudaLightFog` therefore reads from the neighbours how much of such a pixel
  is the other side and gives that part the other side's fog
  (`setEdgeSmoothing`, which a look switches on with `msaa` and off without).
  Sixteen more texture reads a pixel in that pass; measured as a picture, not
  as a frame time.
- The pipeline writes the occlusion colour of LayaAir's `ScalableAO` (black).
  LayaAir 3.4.2 leaves it unset and its shader then reads what the last owner
  of that uniform block left behind: creases glowed in a stale colour from the
  second scene on. Any shader of your own must set every uniform it declares
  for the same reason.
- `createSurfaceTexture(..., { mipmap: true })` filters anisotropically at
  `ZHUDA_DEFAULT_ANISO` (8) unless `anisoLevel` says otherwise, and
  `ZhudaModelLibrary` gives the mipmapped textures of a loaded model the same
  (`applyZhudaAnisotropy`). Without it a floor seen along its length loses its
  detail a few metres from the camera.
- `createPrefilteredEnvironment(...).update()` and `ZhudaLightFog.setLights()`
  replace texels in the texture that was allocated once. Allocating it again
  is a WebGL error on every call, which the film host now reports
  (`takeGlErrors()`, and `glErrors` in a preview reply).
- The pipeline keeps what reaches the grade inside its lookup table. The log
  encoding of LayaAir's `ColorGradEffect` ends at a scene value of 58.85 after
  exposure; a brighter value was looked up outside the table and came out
  dark or in the wrong colour (a red lamp of `emission` 6, which is 74 in the
  scene, turned grey-green; at 8 it lost its red). One pass in front of the
  grade now scales such a colour down to `ZHUDA_GRADE_TABLE_MAX` (56) with its
  hue kept; the limit follows `setExposure`.
- For captures that average samples, `linearChain()` returns the handle a
  `ZhudaCinematicCapture` frame request takes as `linear`: samples are drawn
  scene-linear, without tone mapping and lens finish, and their average is
  drawn through both once.

## Automatic exposure, depth of field and motion blur while a game runs

Three post-process effects for a picture that is drawn once
(`packages/core/runtime3d/CameraEffects.ts`). A look builds them from
`autoExposure`, `depthOfField` and `motionBlur` and puts them after the fog
and before bloom; used alone they go into `ZhudaFilmicPipeline`'s
`sceneEffects` in that order.

- `ZhudaAutoExposure`: one pass reads the frame's brightness at 144 places
  (the mean of the logarithms, the middle counted twice) into one texel; a
  second moves "what the eye is used to" toward it by `1 - exp(-speed *
  seconds)`; a third multiplies the picture by `key / brightness`, kept
  between `min` and `max`. Nothing is read back to the CPU. The time of a
  frame comes from the caller: `ZhudaSceneLook.update(..., frameSeconds)`,
  1/60 when not given. `speed: 0` follows the frame at once; a film scene's
  frames always do, so that a still does not depend on the frames before it.
- `ZhudaDepthOfField`: the disc of a thin lens, `f² / (N (S − f))` at
  infinity and that times `(D − S) / D` at depth `D`, as a share of the
  frame's height and no larger than `maxRadius`. The picture is gathered at
  half size from 24 places on the largest disc; a place counts when its own
  disc reaches the pixel, or the pixel's disc reaches it and it lies behind,
  so a sharp thing in front keeps its edge. `setLens` pulls focus in place.
- `ZhudaMotionBlur`: from each pixel's depth and the camera of the frame
  before, where the surface was on screen; twelve places along the way
  between, over `shutter` of it and no longer than `maxLength` of the frame.
  The camera's movement only: a thing that moves by itself is not smeared.
  `update` once a frame with the camera; `resetHistory` after a cut.
- Each needs the depth texture and one or three more full-screen passes.
  Drawn through `ZhudaSceneLook` on desktop WebGL and WebGPU
  (`npm run verify:camera-effects`, and with `CAMERA_EFFECTS_RENDERER=webgpu`);
  what they cost in frame time is not measured, and no phone has drawn them.

## Clouds

`new ZhudaClouds({ coverage, baseMeters, thicknessMeters, sizeMeters,
density, wind, steps })` is a post-process effect for `sceneEffects`, first
in the list: a slab of air between two heights in which four octaves of a
computed noise say how much cloud there is. Each view ray is followed
through the slab in `steps` steps (32); at each one the cloud is lit by the
sun through what lies between it and the sun (one more lookup) and by the
sky's own light. Clouds are drawn where the ray reaches the slab before it
reaches anything solid; where nothing was drawn the depth is the far plane
and they reach `distanceMeters`. `setTime(seconds)` moves them with the
wind; the same time draws the same sky. A look has it as `clouds` and gives
it the sun's direction and light and the ambient colour; quality level 2
halves the steps, level 1 takes a third, level 0 drops it. One layer of one
kind of cloud: no shadow on the ground, no rain. Each step is about seventy
arithmetic noise lookups a pixel; the cost in frame time is not measured.
Drawn on desktop WebGL and WebGPU (`npm run verify:film-clouds`).

## Clear coat and drawn-out highlights

`createSurfaceMaterial({ type: 'pbr', clearCoat, clearCoatRoughness,
anisotropy })`, and the same three fields on a flat film material. They are
LayaAir's own (`clearCoatEnable`, `anisotropyEnable`). A clear coat puts a
sharp reflection on a rough surface: a matt ball's brightest value 27 of
255, 255 under a coat, on a spot of 14 pixels. Anisotropy, 0..1, draws the
highlight out into a band across the mesh's tangent: on a metal ball turned
on a lathe 52 by 52 pixels round, 102 by 39 at 0.45, 178 by 85 at 0.9. The
direction is the mesh's own; LayaAir's rotation of it is not exposed (a
quarter turn tilted the band and did not stand it upright). Drawn on
desktop WebGL and WebGPU (`npm run verify:film-finishes`).

## Marks on surfaces

`new ZhudaDecal(scene3D, { position, size, normal, color, opacity, roughness,
shape, edge, ragged, seed })` lays a rectangle 4 mm off a flat surface and
draws it with alpha, as a physically based surface of its own colour and
roughness: it takes the light and the shadows the surface under it takes,
and a dark smooth mark on rough ground reads as wet. Its outline is baked
when it is made into a picture of 64, 128 or 256 texels (`blob`, `patch` or
`ring`); nothing reaches the picture's border, so the rectangle itself never
shows. It casts no shadow and writes no depth. It is not projected: it does
not wrap round a corner or follow a bump. A film scene has it as a `decal`
node. Drawn on desktop WebGL and WebGPU (`npm run verify:film-decals`).

`createSurfaceMaterial({ type: 'pbr', blend: 'alpha' })` used to throw
("unknown renderMode: undefined"): LayaAir 3.4.2 names the modes of its PBR
material in `PBRRenderMode`, not on the class. It is `Fade` now, the plain
alpha blend.

## Shadows from a point light

LayaAir 3.4.2 draws no shadow for a point light: a lamp lights the far side of
a wall as brightly as the near side. `ZhudaPointShadow` adds one.

```ts
import { ZhudaPointShadow } from 'zhuda-laya-engine';

const shadow = new ZhudaPointShadow(scene3D, { resolution: 512 });
shadow.render([0, 3, 0], lamp.range); // the lamp's position and reach
// later, after the lamp or something that casts has moved:
shadow.render([0, 3, 0], lamp.range);
shadow.dispose();
```

- `render` draws the lamp's surroundings six times (the faces of a cube) into
  one texture of 3 by 2 tiles and switches the shadow on for the point light
  at exactly that position. Nothing is drawn per frame: call it again when
  the lamp or a caster has moved. Six more scene draws each time.
- Up to eight lamps in one set of pictures: `new ZhudaPointShadow(scene3D,
  { lights: 2 })`, then `render(position, range, 1)` for the second;
  `clear(1)` switches its shadow off. 12 MB of pictures per lamp at the
  default `resolution` of 512; more than four lamps default to 256 (3 MB
  each), which is what the texture has room for. A lamp that moves is drawn
  again from where it is: `render` once a frame for a lantern that is
  carried, six scene draws each time. Nothing closer to a lamp than `near` (0.5 m)
  casts, so the lamp's own head does not shade the scene.
- The edge is filtered over `softness` texels (2), and the lookup moves out
  from the surface by a texel and a half so that a floor the light grazes
  does not shade itself.
- `ZhudaEngine.boot` installs the shader patch this needs
  (`installLaya342PointShadows()`); a host that calls `Laya.init` itself must
  call it first. Without a shadow in a scene the lit shaders compile to the
  upstream code.
- One more texture is declared for lit materials: the pictures, which also
  carry the light's position and settings in their spare channels. On WebGPU
  every declared texture takes one of a shader stage's 16 samplers whether a
  scene has a shadow or not.
- In a film scene: `"castsShadow": true` on a point light.
- Drawn and checked on desktop WebGL and WebGPU (Apple M4; `npm run
  verify:film-point-shadow`, and through `npm run verify:film-webgpu`); not
  on a phone.

## Light bounced off the scene

`ZhudaProbeVolume` gives a box of the scene light bounced once off what stands
in it. Probes on a grid capture their surroundings and LayaAir's
`VolumetricGI` lights each pixel of a physically based material from the
eight probes around it, in place of the ambient light.

```ts
import { ZhudaProbeVolume } from 'zhuda-laya-engine';

const volume = new ZhudaProbeVolume(scene3D, {
  min: [-12, 0, -12],
  max: [12, 6, 12],
  // Probes inside these boxes are switched off: they would see out through back faces.
  solids: buildings.map((b) => ({ min: b.min, max: b.max })),
});
await volume.bake(); // after the level has drawn a frame or two
// ... again after the light or the level has changed; volume.dispose() at the end.
```

- About one probe every 3 m by default (`counts` sets them), at most 16 a side
  and 512 in all; six draws of `captureSize` (32) pixels each per probe.
- LayaAir reads the volume only where the scene's ambient light is a picture
  (an environment, a sky-and-ground ambient). A flat ambient colour is given
  an even picture of the same colour while the volume lasts.
- No occlusion between probes beyond the switched-off ones: light can leak
  through a wall thinner than the spacing.

Two things a volume can do since the first version:

- `visibility: true` (and `bounceLight.visibility` in a look): each probe
  also keeps how far it sees. The capture carries the distance along the
  view in its alpha (one more depth pass, no second read-back); from it a
  tile of 16 by 16 texels per probe holds the mean distance and the mean
  squared distance toward each direction, which is what LayaAir's own
  shader tests a surface against. A lamp on one side of a wall 0.3 m thick,
  probes 1.5 m apart, the floor behind the wall: 223 of 255 red without it,
  10 with it; the face of a cube toward a sunlit red wall is as red as
  before. Off by default: an existing scene bakes as it did.
- `await volume.refresh(count)` captures the next `count` probes again and
  goes round all of them call after call: a lamp that changes colour is
  taken up by the floor under it after one round. The two pictures LayaAir
  reads are rewritten in place; nothing is allocated that stays. A call
  made while another is still reading back returns 0. Six scene draws a
  probe: a few probes a second, not a few a frame. This is still light
  captured at intervals, not real-time global illumination.
