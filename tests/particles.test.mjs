import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaParticleSystem } from '../packages/core/particles/ParticleSystem.ts';
import { ZhudaRibbonTrail } from '../packages/core/particles/RibbonTrail.ts';
import { ZhudaEffectEnvelope } from '../packages/core/particles/EffectEnvelope.ts';
import { validateParticleEffect, sampleParticleColor } from '../packages/core/particles/ParticleTypes.ts';
import { ZhudaLayaParticleRenderer } from '../packages/core/particles/LayaParticleRenderer.ts';

const emitter = (overrides = {}) => ({ id: 'fixture', texture: 'neutral', maxParticles: 128, seed: 42,
  space: 'world', blend: 'alpha', shape: { type: 'point' }, rate: 30,
  lifetime: [0.5, 1], speed: [10, 30], angle: [-0.5, 0.5], size: [2, 5], ...overrides });
const advance = (system, frames, dt) => { for (let i = 0; i < frames; i++) system.update(dt); };

test('seeded fixed-step simulation is identical at 30, 60 and 120fps and after replay', () => {
  const systems = [30, 60, 120].map(fps => {
    const s = new ZhudaParticleSystem(emitter({ turbulence: { strength: 12, frequency: 4 } }));
    s.play(); advance(s, fps * 2, 1 / fps); return s;
  });
  assert.deepEqual(systems[0].snapshot(), systems[1].snapshot());
  assert.deepEqual(systems[1].snapshot(), systems[2].snapshot());
  const before = systems[0].snapshot();
  systems[0].play(true); advance(systems[0], 60, 1 / 30);
  assert.deepEqual(systems[0].snapshot(), before);
});

test('pool budgets bound oversized bursts and recycling returns capacity', () => {
  const s = new ZhudaParticleSystem(emitter({ maxParticles: 8, lifetime: 0.1, rate: 0 }));
  s.burst(1_000_000); assert.equal(s.aliveCount, 8); assert.equal(s.droppedParticles, 999992);
  s.update(0.2); assert.equal(s.aliveCount, 0);
  s.burst(8); assert.equal(s.aliveCount, 8);
});

test('world particles retain old positions while emitter turns and local particles retain local coordinates', () => {
  for (const space of ['world', 'local']) {
    const s = new ZhudaParticleSystem(emitter({ space, speed: 0, rate: 0 }));
    s.setTransform(10, 20); s.burst(1);
    s.setTransform(100, 200, Math.PI / 2); s.update(1 / 60);
    assert.equal(s.snapshot()[0].x, space === 'world' ? 10 : 0);
    assert.equal(s.snapshot()[0].y, space === 'world' ? 20 : 0);
  }
});

test('distance emission fills the travelled path and stop drains rather than hiding particles', () => {
  const s = new ZhudaParticleSystem(emitter({ speed: 0, rate: 0, rateOverDistance: 0.1, lifetime: 1 }));
  s.setTransform(0, 0); s.play(); s.setTransform(100, 0); s.update(0.1);
  assert.equal(s.aliveCount, 10);
  assert.ok(new Set(s.snapshot().map(p => Math.round(p.x))).size > 5);
  s.stop(); assert.equal(s.aliveCount, 10);
  advance(s, 120, 1 / 120); assert.equal(s.aliveCount, 0);
});

test('timed bursts respect duration and repeat exactly once per cycle', () => {
  const s = new ZhudaParticleSystem(emitter({ rate: 0, lifetime: 5, duration: 0.25, loop: true,
    bursts: [{ time: 0, count: 2 }, { time: 0.125, count: 3 }] }));
  s.play(); advance(s, 60, 1 / 120);
  assert.equal(s.aliveCount, 10);
});

test('non-integral loop periods retain emission time and final distance emission respects duration', () => {
  const s = new ZhudaParticleSystem(emitter({ rate: 120, lifetime: 5, duration: 0.013, loop: true, maxParticles: 512 }));
  s.play(); advance(s, 120, 1 / 120); assert.equal(s.aliveCount, 120);
  const d = new ZhudaParticleSystem(emitter({ rate: 0, speed: 0, lifetime: 5, duration: .025, rateOverDistance: 1 }));
  d.setTransform(0, 0); d.play(); d.setTransform(100, 0); d.update(.1);
  assert.equal(d.aliveCount, 25);
  assert.throws(() => new ZhudaParticleSystem(emitter({ loop: true, duration: .001 })), /looping duration/);
});

test('invalid JSON descriptors fail before allocating pools or invoking Laya', () => {
  const value = { schemaVersion: 1, emitters: [emitter({ maxParticles: 0, lifetime: -1,
    alphaOverLife: [{ time: 0.5, value: 1 }, { time: 0.2, value: 2 }] })] };
  assert.ok(validateParticleEffect(value).length >= 3);
  assert.throws(() => new ZhudaParticleSystem(value.emitters[0]), /ZhudaParticles/);
  assert.deepEqual(validateParticleEffect(null).length, 1);
  assert.equal(sampleParticleColor([{ time: 0, color: '#000000' }, { time: 1, color: '#ffffff' }], 0.5), '#808080');
});

test('long frame gaps report dropped time and do not create an unbounded catch-up loop', () => {
  const s = new ZhudaParticleSystem(emitter()); s.play(); s.update(20);
  assert.ok(Math.abs(s.time - 0.25) < 1e-8);
  assert.equal(s.droppedSeconds, 19.75);
});

test('ribbon stores the curved path, bounds widths, survives repeated points, breaks teleports and expires', () => {
  const trail = new ZhudaRibbonTrail({ maxPoints: 8, lifetime: 0.5, width: 10, minDistance: 1, teleportDistance: 100 });
  for (let i = 0; i < 6; i++) trail.update(0.02, i * 10, i * i);
  const points = trail.snapshot();
  trail.update(0, 50, 25); assert.equal(trail.pointCount, 6);
  const mesh = trail.buildMesh(); assert.equal(mesh.indexCount, 30);
  for (let i = 0; i < mesh.pointCount; i++) {
    assert.ok(Math.hypot(mesh.vertices[i * 4] - points[i].x, mesh.vertices[i * 4 + 1] - points[i].y) <= 5.001);
  }
  assert.ok([...mesh.vertices].every(Number.isFinite));
  trail.update(0.01, 1000, 1000); assert.equal(trail.pointCount, 1);
  trail.update(1, 1000, 1000, false); assert.equal(trail.pointCount, 0);
});

test('envelope can interrupt attack, release smoothly, then restart', () => {
  const envelope = new ZhudaEffectEnvelope(0.2, 0.4);
  envelope.start(); envelope.update(0.1); assert.equal(envelope.value, 0.5);
  envelope.stop(); envelope.update(0.2); assert.equal(envelope.value, 0.25);
  envelope.update(0.2); assert.equal(envelope.phase, 'idle'); assert.equal(envelope.value, 0);
  envelope.start(0.8); envelope.update(0.2); assert.equal(envelope.phase, 'sustain'); assert.equal(envelope.value, 0.8);
});

test('renderer submits textured batches, handles local transform and disposes only its own nodes', () => {
  const calls = [];
  class Sprite {
    graphics = { clear() { calls.length = 0; }, drawTriangles(...args) { calls.push(args); } };
    destroy() { this.destroyed = true; }
  }
  const previous = globalThis.Laya; globalThis.Laya = { Sprite };
  try {
    const s = new ZhudaParticleSystem(emitter({ rate: 0, speed: 0, size: 4, space: 'local' }));
    s.setTransform(100, 200); s.burst(20);
    const renderer = new ZhudaLayaParticleRenderer(s, { addChild() {} }, () => ({}));
    renderer.render(); assert.equal(calls.length, 1); assert.equal(calls[0][5].length, 120);
    assert.equal(calls[0][3][0], 98); assert.equal(calls[0][3][1], 198);
    renderer.dispose(); assert.equal(renderer.node.destroyed, true);
  } finally { globalThis.Laya = previous; }
});
