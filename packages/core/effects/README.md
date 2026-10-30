# Effects and visual migration SDK

These APIs coordinate application-owned effects. Scenes, texture assets, Spine runtime adapters, editors and gameplay remain in the consuming application. The separate [Particle Lab workbench](https://zhudaandzhuer.github.io/zhuda-particle-lab/capabilities.html) exercises the public SDK in real Laya 3.4.2 WebGL.

| API | Contract and limits |
| --- | --- |
| `ZhudaVfxMaterial` | 3D particle material with mask, noise dissolve/edge emission, UV scrolling/distortion, scene-color refraction and soft-depth intersections. Texture keys must resolve before construction. |
| `ZhudaVfxCamera` | Enables the depth/opaque passes required by soft particles/refraction and optionally adds Laya Bloom. One owner per camera; dispose restores borrowed state and removes the owned effect. Load `postProcess` for Bloom. |
| `ZhudaEffectDirector` | Serializable linear parameter tracks, start/stop/event cues and named attachments. Bindings connect to game objects, audio or a Spine bone. Rotation is a 2D angle in radians; full quaternion skeletal retargeting is outside this API. |
| `ZhudaParticleEventLink` | Collision/death events burst a separate bounded world-space child emitter. The application updates both systems; links do not own their simulators. |
| `ZhudaEffectBudget` | Allocates a global particle/coverage allowance by priority, visibility and distance. Coverage is a caller-provided estimate, not a GPU overdraw measurement. Apply each allocation to `particleLimit` and emission intensity. Existing particles drain naturally when limits drop. |
| `ZhudaRuntimeProfiler` | Intercepts core WebGL draw methods, counts triangle submissions and stores frame/CPU timings supplied by the application. GPU time is explicitly `null`; WebGL1 extension draw methods are not intercepted. Dispose restores wrappers. |

## Material and camera integration

```ts
import { ZhudaParticleSystem3D, ZhudaLayaParticleRenderer3D, ZhudaVfxCamera } from 'zhuda-laya-engine';

// Boot Laya 3D and resolve textures before creating renderers.
const passes = new ZhudaVfxCamera(camera, {softParticles: true, refraction: true});
const system = new ZhudaParticleSystem3D({
  id: 'impact', texture: 'atlas', seed: 42, maxParticles: 256,
  space: 'world', blend: 'alpha', shape: {type: 'point'},
  rate: 0, lifetime: .8, speed: [1, 3], size: [.1, .3],
  direction: {x: 0, y: 1, z: 0}, spread: .8,
  flipbook: {columns: 4, rows: 4, cycles: 1, loop: false},
  material: {version: 1, noiseTexture: 'noise', dissolve: .3, softDistance: .2}
});
const renderer = new ZhudaLayaParticleRenderer3D(system, identitySceneRoot, resolveTexture);
system.burst(32);
// Application tick: system.update(dt); renderer.render(camera);
// Teardown: renderer.dispose(); passes.dispose();
```

Particle collision planes use `dot(position, normal) >= offset` as free space in the simulator's world/local space. Set restitution, friction, radius or kill-on-collision explicitly. This is bounded plane collision, not mesh collision, a fluid simulation or rigid-body physics. Flipbooks support rectangular atlas cells; trimmed/rotated atlas packing needs an exporter-side bake. Transparent sorting across intersecting emitters remains approximate. Refraction samples opaque scene color and cannot refract another transparent effect. Bloom, depth and scene-color copies add rendering passes and must be budgeted on target devices.

## Timelines and budgets

Bind a timeline target to `reset`, `start`, `stop`, `setParameter` and optionally `setTransform`; bind an attachment source to `resolveAnchor`. Call `director.update(dt)` before simulator updates so attachment motion is sampled consistently. `seek(t)` resets bindings and evaluates tracks/cues, suppressing external event cues by default. It does not integrate particle history: deterministic particle seeking requires the application to replay fixed simulation steps, as the workbench does.

```ts
const allocations = budget.allocate(requests);
for (const a of allocations) {
  const system = systemsById.get(a.id);
  system.particleLimit = a.particleLimit;
  system.intensity = a.emissionScale;
}
// Feed measured frame intervals to observeFrame to enable hysteresis-based quality changes.
```

## Unity visual conversion

`convertUnityVisualMaterial` accepts normalized exporter data and maps Standard/URP Lit metallic-smoothness properties and supported texture semantics to `PBRStandardMaterial`; known Unlit shaders map to `UnlitMaterial`. Custom shaders require an explicit `VfxMaterialSpec`. Unknown shaders block conversion. This API does not parse Unity `.mat` YAML or translate arbitrary shader graphs; the exporter must normalize properties, texture channels and color space. `instantiateMigratedMaterial` resolves application textures; use `disposeMigratedMaterial` to detach borrowed textures before destruction.

`convertUnityAnimationCurve` adaptively bakes unweighted Hermite tangents into linear timeline keys. Weighted and non-finite/step tangents require an exporter-side bake. Baking has depth/key limits and fails instead of silently exceeding them.

`compareVisualFrames` compares aligned RGBA silhouettes by overlap and centroid. Supply transparent-background captures or foreground alpha masks at matching viewports/times; opaque full-scene screenshots make alpha overlap uninformative. It tolerates color changes and rejects empty fixtures. Silhouette agreement alone cannot validate internal detail, timing or every Unity presentation: compare representative animation frames and inspect the rendered result.
