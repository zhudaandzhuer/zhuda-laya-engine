# 2D particles and ribbon trails

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

This module implements 2D CPU particles and mesh trails. It does not implement 3D billboards, collision, flipbook animation, bloom, heat distortion or a graphical node editor. Such features require additional rendering/asset workflows. Large translucent sprites can be GPU fill-rate limited even with few draw calls.

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
