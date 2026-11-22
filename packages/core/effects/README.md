# Effects and visual migration SDK

These APIs coordinate application-owned effects. Scenes, texture assets, Spine runtime adapters, editors and gameplay remain in the consuming application.

## Ready effects (3D)

`ZHUDA_EFFECT_PRESETS_3D` holds eighteen effects as data (campfire, torch, smoke-column, steam, sparks, explosion, hit, magic-aura, heal, portal, fireflies, rain, snow, dust-motes, falling-leaves, petals, bubbles, embers), each a `ParticleEffectSpec3D` in metres and seconds on the eleven built-in sprites (`ZHUDA_EFFECT_SPRITES`, baked by `bakeZhudaEffectSprite`: no file is loaded). `new ZhudaEffect3D(scene3D, 'campfire', { position, yawDeg, scale, seed })` owns the emitters, their textures and renderers: `update(dt)` and `render(camera)` in a game, `seek(seconds)` for a film (the same time is the same state), `dispose()` at the end. A film scene places one with an `effect` node ([film scenes](../../../docs/film-scenes.md)). `npm run verify:film-effects` draws every preset.

## Ready effects (2D)

`ZHUDA_EFFECT_PRESETS_2D` holds twenty effects for a 2D game or interface, each a `ParticleEffectSpec` in pixels and seconds on canvas axes (+Y down) on the same built-in sprites:

| Kind  | Presets                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| burst | coin-burst, level-up, hit-spark, explosion, smoke-puff, confetti, landing-dust, click-ripple                                                     |
| loop  | sparkle, torch, campfire, magic-aura, heal, rain, snow, falling-leaves, petals, bubbles, embers, sparkle-trail (emits along the way it is moved) |

Each has a `description`, a `kind`, `sizePixels` (the box it fills at scale 1), `origin` (where its x, y lies in that box, as fractions from the top left: a torch's at the bottom of its flame, rain's at the top of its sky) and `seconds` (a burst is over by then; a loop has settled). No preset holds more than 1,000 particles.

```ts
import { ZhudaEffect2D } from 'zhuda-laya-engine';

// A burst where the player tapped: it ends by itself; dispose it then.
const coins = new ZhudaEffect2D(layer, 'coin-burst', { x: 320, y: 400, scale: 0.8, seed: 1 });
// A trail: move it each frame; it emits along the way it went.
const trail = new ZhudaEffect2D(layer, 'sparkle-trail', { x: 0, y: 0 });

// The game's frame, from its clock (session.layers.scaledDeltas):
coins.update(dt);
coins.render();
trail.setPosition(pointer.x, pointer.y);
trail.update(dt);
trail.render();
if (coins.seconds >= coins.preset.seconds) coins.dispose();
// A replay or a test: the same time is the same picture.
coins.seek(0.4);
```

`ZhudaEffect2D` runs the preset on the engine's own 2D particles (`ZhudaParticleSystem`, `ZhudaLayaParticleRenderer`): one Sprite under the parent, one under that for each emitter in the preset's order (later ones drawn over earlier ones), the sprites baked once as premultiplied sRGB textures, as Laya makes a loaded 2D picture. `update(dt)` lets it run (each emitter catches up at most a quarter of a second at once), `seek(seconds)` steps it from its start at 120 Hz, `stop()` lets a loop end, `restart()` begins again (move it first to begin elsewhere with no trail between), `scaleZhudaEffect2D` and the `scale` option multiply every length, `dispose()` releases its sprites and textures and never the parent. A preset of one's own is checked by `validateZhudaEffectPreset2D` and may use any built-in sprite.

`npm run verify:effects-2d` draws every preset on WebGL (`2d` browser profile; run `npm run build` first): each changes the picture, the same time drawn twice is the same bytes, a loop moves, a burst leaves nothing at its `seconds`, a moved trail draws along its path, one soft sprite shows its own alpha with both blends, and thirty made and released leave no resource.

| API                      | Contract and limits                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ZhudaVfxMaterial`       | 3D particle material with mask, noise dissolve/edge emission, UV scrolling/distortion, scene-color refraction and soft-depth intersections. Texture keys must resolve before construction.                                                                                                                                                                                                                          |
| `ZhudaVfxCamera`         | Enables the depth/opaque passes required by soft particles/refraction and optionally adds Laya Bloom. One owner per camera; dispose restores borrowed state and removes the owned effect. Load `postProcess` for Bloom.                                                                                                                                                                                             |
| `ZhudaEffectDirector`    | Serializable linear parameter tracks, start/stop/event cues and named attachments. Bindings connect to game objects, audio or a Spine bone. Rotation is a 2D angle in radians; full quaternion skeletal retargeting is outside this API.                                                                                                                                                                            |
| `ZhudaParticleEventLink` | Collision/death events burst a separate bounded world-space child emitter. The application updates both systems; links do not own their simulators.                                                                                                                                                                                                                                                                 |
| `ZhudaEffectBudget`      | Allocates a global particle/coverage allowance by priority, visibility and distance. Coverage is a caller-provided estimate, not a GPU overdraw measurement. Apply each allocation to `particleLimit` and emission intensity. Existing particles drain naturally when limits drop.                                                                                                                                  |
| `ZhudaRuntimeProfiler`   | Counts draws and triangles (WebGL: a context's draw methods; WebGPU: every render pass's draws, with `attachWebGPU`) and stores frame/CPU timings supplied by the application. GPU time is optional (`enableGpuTiming`: a WebGL 2 timer query, or WebGPU timestamps summed over render passes) and absent until the GPU has answered; WebGL1 extension draw methods are not intercepted. Dispose restores wrappers. |

## Material and camera integration

```ts
import {
  ZhudaParticleSystem3D,
  ZhudaLayaParticleRenderer3D,
  ZhudaVfxCamera,
} from 'zhuda-laya-engine';

// Boot Laya 3D and resolve textures before creating renderers.
const passes = new ZhudaVfxCamera(camera, { softParticles: true, refraction: true });
const system = new ZhudaParticleSystem3D({
  id: 'impact',
  texture: 'atlas',
  seed: 42,
  maxParticles: 256,
  space: 'world',
  blend: 'alpha',
  shape: { type: 'point' },
  rate: 0,
  lifetime: 0.8,
  speed: [1, 3],
  size: [0.1, 0.3],
  direction: { x: 0, y: 1, z: 0 },
  spread: 0.8,
  flipbook: { columns: 4, rows: 4, cycles: 1, loop: false },
  material: { version: 1, noiseTexture: 'noise', dissolve: 0.3, softDistance: 0.2 },
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
