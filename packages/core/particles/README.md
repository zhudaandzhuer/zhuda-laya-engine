# 2D / 3D particles and ribbon trails

The public ESM/CJS SDK exports a renderer-independent CPU simulator, Laya 3.4.2 textured mesh renderers, world-space trail history and an attack/sustain/release envelope. Scenes, texture assets, presets and gameplay belong to the consuming application.

## Minimal integration

```ts
import { ZhudaParticleSystem, ZhudaLayaParticleRenderer, validateParticleEffect } from 'zhuda-laya-engine';
import type { ParticleEffectSpec } from 'zhuda-laya-engine';

const effect: ParticleEffectSpec = {
  schemaVersion: 1,
  emitters: [{
    id: 'example', texture: 'external-texture-key', maxParticles: 256, seed: 42,
    space: 'world', blend: 'alpha', shape: { type: 'point' }, rate: 30,
    lifetime: [0.5, 1], speed: [20, 50], angle: [-1.8, -1.3], size: [8, 16],
    sizeOverLife: [{ time: 0, value: 0.5 }, { time: 1, value: 1.5 }],
    alphaOverLife: [{ time: 0, value: 0 }, { time: 0.1, value: 0.8 }, { time: 1, value: 0 }],
    colorOverLife: [{ time: 0, color: '#ffffff' }, { time: 1, color: '#8899aa' }]
  }]
};
const issues = validateParticleEffect(effect);
if (issues.length) throw new Error(issues.join('\n'));

// Boot Laya and load textures before constructing renderers.
const system = new ZhudaParticleSystem(effect.emitters[0]);
const renderer = new ZhudaLayaParticleRenderer(system, parentSprite, key => loadedTextures.get(key));
system.setTransform(100, 200, 0);
system.play();
// In the application's update loop:
system.update(deltaSeconds);
renderer.render();
// Graceful stop: continue update/render until aliveCount is zero.
system.stop();
// Immediate teardown: system.stop(true); renderer.dispose();
```

The application owns scheduling. Update each simulator once per application tick and submit each renderer once per rendered frame. `dispose()` destroys only its own sprite, never shared textures or the parent. Detach/dispose renderers when leaving a scene.

## Descriptor contract

Units are pixels, seconds and radians. Angles follow canvas axes: +X right, +Y down. Ranges are a number or `[min, max]`; curves linearly interpolate ordered keys with normalized life `time` in 0..1. Color keys use `#rrggbb`. Size curves multiply the initial size; alpha curves stay within 0..1.

Shapes are `point`, `box` (width/height), and `circle` (radius, optional edge). `rate` emits per second; `rateOverDistance` emits per pixel along interpolated emitter movement. Optional `bursts: [{time,count}]` are relative to `play()`. Optional `duration` stops emission; `loop` repeats that duration. Looping durations must be at least 1/120 second. Bursts beyond duration are rejected. No duration means indefinite emission, regardless of `loop`.

Other optional controls: rotation/angularVelocity ranges, acceleration, exponential drag, deterministic sinusoidal turbulence, stretch along the quad's X axis, velocity alignment, size/alpha/color over life. `intensity` scales emission (clamped 0..2), without changing already emitted particles. Use independent seeds for independent emitters.

`space: 'world'` leaves old particles at their world positions when the emitter moves or turns. `local` particles follow the current emitter transform. Coordinates in both modes are relative to the renderer parent's coordinate system; the parent is responsible for camera transforms. Acceleration and turbulence use the chosen simulation space.

`play()` starts a new emission cycle while retaining living particles and PRNG state. `play(true)` clears the simulation and resets its seed. `clear()` resets pool/time/seed while preserving the emitting flag. `stop()` drains naturally; `stop(true)` clears immediately. Update stopped systems to age out their particles. `forEach` borrows pooled state; use `snapshot()` only when a retained copy is needed.

Validation checks descriptor structure and numeric constraints. It does not resolve texture keys or verify appearance. MCP `validate_particle_effect` accepts `{effect: descriptor}` with the same validation and has no scene or filesystem dependency.

## Timing, capacity and rendering

Simulation uses a fixed 1/120 second step. Identical seeds and sampled input sequences produce repeatable simulation; a moving emitter's path must also be sampled consistently. Each `update` accepts at most 0.25 seconds; `droppedSeconds` reports excess elapsed time. This bounds catch-up work after a suspended tab and intentionally does not fast-forward missed time.

Each emitter preallocates at most `maxParticles` (1..16383) objects. Excess emissions increment `droppedParticles`. Capacity bounds CPU work for oversized bursts as well as memory. Integrators should bound aggregate emitter budgets for their target devices.

The Laya renderer groups particles into lifetime bands (default 12, configurable 1..64), without a sprite per particle. Position, rotation and size update per particle; alpha and color use each band's midpoint, so these curves are quantized. More bands trade CPU/storage for smoother color/alpha. Buffers cost approximately `76 × capacity × lifeBands` bytes, plus the particle pool and runtime mesh storage. A submitted mesh is not necessarily a WebGL draw call; Laya may combine compatible meshes. `submittedBatches` reports submissions only.

Texture resolution is supplied externally. Particle renderers use the texture UV rectangle and render a square quad before stretch; author transparent margins and aspect into the texture or the stretch parameter. Do not mutate a live descriptor; construct a new simulator/renderer after editing it. Pool storage and precomputed bands are sized at construction.

This module implements 2D and 3D CPU particles, billboards and mesh trails. It does not implement collision, flipbook animation, bloom, heat distortion or a graphical node editor. Such features require additional rendering/asset workflows. Large translucent sprites can be GPU fill-rate limited even with few draw calls.

## World-space ribbons and envelopes

```ts
import { ZhudaRibbonTrail, ZhudaLayaRibbonRenderer, ZhudaEffectEnvelope } from 'zhuda-laya-engine';
const trail = new ZhudaRibbonTrail({
  maxPoints: 128, lifetime: 0.8, width: 20, minDistance: 2, teleportDistance: 200
});
const ribbon = new ZhudaLayaRibbonRenderer(trail, parentSprite, fullRibbonTexture);
const envelope = new ZhudaEffectEnvelope(0.15, 0.45);
envelope.start();
envelope.update(deltaSeconds);
system.intensity = envelope.value;
trail.update(deltaSeconds, emitterX, emitterY, shouldAddPoints);
ribbon.render();
// On stop: envelope.stop(); system.stop(); continue updating particles and trail.
```

Trail history uses a bounded ring buffer. Points expire by age; short movements are ignored; teleports break the path. The mesh follows the stored path with bounded width, preventing unbounded spikes at sharp turns. The optional width curve multiplies width; its default tapers from 1 to 0. Use a full, untrimmed texture: U is normalized point age (0 fresh, 1 expired), V crosses the width. Transparent edges and an age fade belong in that texture. Ribbon textures currently do not support atlas regions. Continue `update(..., false)` after stopping so old points expire. `clear()` resets immediately; `dispose()` releases the renderer sprite.

`ZhudaEffectEnvelope` exposes idle/attack/sustain/release. `start(strength)` and `stop()` can interrupt a transition; `setStrength(0..2)` adjusts the sustain target. It controls intensity or other application parameters; it does not implicitly stop or clear simulators.

## Verification

`tests/particles.test.mjs` checks 30/60/120 fps replay, capacity/recycling, moving emitter spaces, distance emission, non-integral duration loops, graceful drain, invalid input, bounded catch-up, curved trails/teleports/expiry, envelopes and renderer ownership. Public SDK integration tests check ESM and CJS exports; browser/scene validation belongs in the consuming application.

## 3D simulation and rendering

`ZhudaParticleSystem3D` uses XYZ scene units, seconds and radians. A descriptor has `schemaVersion: 1, dimension: 3`, a `direction: {x,y,z}` and cone half-angle `spread` (0..PI). Shapes are point, XYZ box and sphere (optional surface sampling). Directions are sampled uniformly within the cone. The timing, curves, pool capacity and stop/replay rules above also apply in 3D. `validateParticleEffect3D` checks the 3D descriptor; MCP selects it when `dimension` is 3.

`setTransform(x,y,z,quaternion?,velocity?)` normalizes a finite nonzero quaternion. World particles receive the emitter orientation at birth; local particles retain local coordinates and follow the current transform during rendering. Acceleration and turbulence operate in the selected simulation space. `velocityInheritance` (0..2) adds supplied world emitter velocity at birth for world particles. The integrator must supply velocity; the simulator does not estimate it from noisy transforms. `billboard` selects camera, projected velocity or world XZ ground alignment. For 3D use `billboard: 'velocity'` instead of the inherited 2D `alignToVelocity` setting.

```ts
import { ZhudaParticleSystem3D, ZhudaLayaParticleRenderer3D } from 'zhuda-laya-engine';
const system = new ZhudaParticleSystem3D({
  id: 'xyz', texture: 'external-key', seed: 7, maxParticles: 256,
  space: 'world', blend: 'additive', shape: {type: 'sphere', radius: .1},
  direction: {x: 0, y: 0, z: 1}, spread: .15,
  rate: 40, lifetime: [.2, .5], speed: [2, 4], size: [.05, .2], billboard: 'velocity'
});
// Boot the core + 3d features and load WebGL 3D modules before construction.
const renderer = new ZhudaLayaParticleRenderer3D(system, identitySceneRoot, resolveTexture);
system.play();
system.setTransform(x, y, z, orientation, velocity);
system.update(deltaSeconds);
renderer.render(camera);
```

The scene parent must have an identity world transform: geometry is submitted in world coordinates. The Laya 3.4.2 adapter uses its version-specific `PrimitiveMesh._createMesh` helper and `UnlitMaterial`, depth tests against opaque scene geometry (LEQUAL), disables transparent depth writes and renders both faces. Alpha particles sort back to front within each emitter; sorting across emitters or intersecting translucent surfaces is approximate. Additive particles do not require sorting. Each emitter is one mesh submission; actual draw calls depend on the scene/runtime. `ZhudaParticleMesh3D` also exposes renderer-independent POSITION(3), COLOR(4), UV(2) geometry.

Textures must be full, untrimmed `Texture2D` or full 2D textures backed by one. Atlas regions are unsupported by the 3D adapter. Upload straight alpha textures for SRC_ALPHA blending; repeat U for scrolling paths. Textures remain owned by the application. Each billboard reserves `156 * maxParticles` bytes of typed geometry (144 vertex + 12 index bytes per particle), in addition to the CPU pool, sorting references and native mesh storage. Buffers remain capacity sized; inactive triangles are degenerate. Large transparent surfaces may be limited by GPU fill rate.

## 3D historical trails and authored flow paths

`ZhudaRibbonTrail3D` stores world XYZ history, uses scene-unit widths and distances, and supports the same expiry and teleport behavior as its 2D counterpart. Call `update(dt,x,y,z,emitting)` and submit through `ZhudaLayaRibbonRenderer3D(trail, identitySceneRoot, texture, color?, blend?)`. Normals face the camera and preserve orientation across neighboring segments. Each historical point uses 72 vertex bytes plus approximately 12 index bytes; unused indices are degenerate to prevent triangles connecting to unused origin vertices.

`ZhudaRibbonPath3D` accepts an application-authored XYZ centerline, useful for flows along any moving surface. The application supplies curved world points through `setPoints(points, widthDirections?)`; optional per-point width directions keep the band aligned to an authored surface instead of facing the camera. Directions are projected perpendicular to the tangent and normalized; the engine contains no vehicle or gameplay geometry. Width, alpha and color curves use normalized arc length. `visibleStart` and `visibleEnd` define a normalized reveal window; positive `edgeFade` softens both boundaries. Increasing `visibleEnd` reveals from the first point; increasing `visibleStart` erases in the same direction. `uvTiles` and `uvOffset` animate texture flow independently of reveal. Reuse supplied point objects to avoid application allocations. Clear a path or pass zero renderer opacity when invisible. Authored paths also reserve arc-length storage and optional width direction objects, in addition to the geometry buffers. Renderer disposal detaches shared textures before Laya material destruction so dependency cleanup cannot destroy application textures.

```ts
const flow = new ZhudaRibbonPath3D({maxPoints: 64, width: .4,
  alphaOverPath: [{time: 0, value: 0}, {time: .15, value: 1}, {time: 1, value: 0}]
});
flow.setPoints(applicationWorldPoints);
flow.visibleEnd = revealProgress;
flow.uvOffset = -elapsedSeconds;
const ribbon = new ZhudaLayaRibbonRenderer3D(flow, identitySceneRoot, fullFlowTexture);
ribbon.render(camera, strength);
```

`tests/particles3d.test.mjs` checks XYZ replay, quaternion/local/world transforms, inherited velocity, pooling, duration/distance emission, billboard sorting, partial ribbon indices, bounded reveal geometry and renderer ownership. Browser appearance and target-device performance require application verification.
