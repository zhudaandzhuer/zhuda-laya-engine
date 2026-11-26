// Petals, motes in the sun, fireflies and stars, on the engine's 3D particles.
// Sprites are painted here from numbers (no image files).
import { ZhudaLayaParticleRenderer3D, ZhudaParticleSystem3D, type ParticleEmitterSpec3D } from 'zhuda-laya-engine';
import { TREES, groundAt, insideBy } from './land.ts';
import { FAR } from './far.ts';
import { random, type V3 } from '../math.ts';

type Paint = (u: number, v: number) => [number, number, number, number];
function sprite(size: number, paint: Paint) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const c = paint(((x + 0.5) / size) * 2 - 1, ((y + 0.5) / size) * 2 - 1);
      for (let k = 0; k < 4; k++) data[(y * size + x) * 4 + k] = Math.round(Math.min(1, Math.max(0, c[k])) * 255);
    }
  const texture = new Laya.Texture2D(size, size, Laya.TextureFormat.R8G8B8A8, true, false, false);
  texture.setPixelsData(data, false, false);
  texture.wrapModeU = texture.wrapModeV = Laya.WrapMode.Clamp;
  return texture;
}
const textures = () => ({
  petal: sprite(64, (u, v) => {
    // a heart-tipped oval
    const w = 0.62 * Math.sqrt(Math.max(0, 1 - v * v)) * (1 - 0.2 * v);
    const notch = v < -0.55 && Math.abs(u) < 0.12 * (-v - 0.55) * 4 ? 0 : 1;
    return [1, 1, 1, Math.abs(u) < w ? notch : 0];
  }),
  mote: sprite(64, (u, v) => [1, 1, 1, Math.exp(-(u * u + v * v) * 9)]),
});
type Textures = ReturnType<typeof textures>;
type Spec = Omit<ParticleEmitterSpec3D, 'texture' | 'seed' | 'id'> & { texture: keyof Textures };

class Emitter {
  readonly system: ZhudaParticleSystem3D;
  readonly renderer: ZhudaLayaParticleRenderer3D;
  opacity = 1;
  constructor(id: string, spec: Spec, parent: Laya.Sprite3D, tex: Textures, seed: number) {
    this.system = new ZhudaParticleSystem3D({ ...spec, id, seed } as ParticleEmitterSpec3D);
    this.renderer = new ZhudaLayaParticleRenderer3D(this.system, parent, (key: string) => tex[key as keyof Textures]);
    this.system.play(true);
  }
}

export class GardenFx {
  private readonly tex = textures();
  private readonly layer = new Laya.Sprite3D('fx');
  private readonly rand = random(17);
  private readonly all: Emitter[] = [];
  private readonly petals: Emitter;
  private readonly violet: Emitter;
  private readonly motes: Emitter;
  private readonly fireflies: Emitter;
  private readonly sky: Emitter;
  private readonly mist: Emitter;
  private readonly carry = new Map<Emitter, number>();
  private readonly blossom = TREES.filter((t) => t.kind !== 'green');
  budget = 1;
  night = 0;
  sun = 1;
  wind: [number, number] = [0.5, 0.2];

  constructor(scene: Laya.Scene3D) {
    scene.addChild(this.layer);
    const make = (id: string, spec: Spec) => {
      const e = new Emitter(id, spec, this.layer, this.tex, 1 + this.all.length * 7919);
      this.all.push(e);
      return e;
    };
    const petal = (a: string, b: string): Spec => ({
      texture: 'petal', maxParticles: 900, space: 'world', blend: 'alpha', billboard: 'camera',
      shape: { type: 'point' }, direction: { x: 0, y: -1, z: 0 }, spread: 1, rate: 0, lifetime: [7, 11], speed: [0.1, 0.4],
      acceleration: { x: 0.3, y: -0.35, z: 0.1 }, drag: 0.7, turbulence: { strength: 1.2, frequency: 0.7 },
      size: [0.06, 0.11], rotation: [0, 6.28], angularVelocity: [-3, 3],
      alphaOverLife: [{ time: 0, value: 0 }, { time: 0.05, value: 1 }, { time: 0.92, value: 1 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: a }, { time: 1, color: b }],
    });
    this.petals = make('petals', petal('#ffd2e2', '#ff9fc2'));
    this.violet = make('violet', petal('#e2d2ff', '#b99cf0'));
    this.motes = make('motes', {
      texture: 'mote', maxParticles: 400, space: 'world', blend: 'additive', billboard: 'camera',
      shape: { type: 'point' }, direction: { x: 0, y: 1, z: 0 }, spread: 3, rate: 0, lifetime: [5, 8], speed: [0.02, 0.08],
      turbulence: { strength: 0.15, frequency: 0.5 }, size: [0.02, 0.04],
      alphaOverLife: [{ time: 0, value: 0 }, { time: 0.3, value: 0.6 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#fff3d6' }, { time: 1, color: '#ffe2a8' }],
    });
    this.fireflies = make('fireflies', {
      texture: 'mote', maxParticles: 300, space: 'world', blend: 'additive', billboard: 'camera',
      shape: { type: 'point' }, direction: { x: 0, y: 1, z: 0 }, spread: 3, rate: 0, lifetime: [4, 7], speed: [0.05, 0.25],
      turbulence: { strength: 0.7, frequency: 0.6 }, size: [0.07, 0.12],
      alphaOverLife: [{ time: 0, value: 0 }, { time: 0.2, value: 1 }, { time: 0.4, value: 0.3 }, { time: 0.6, value: 1 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#e2ff8a' }, { time: 1, color: '#ffe066' }],
    });
    this.sky = make('sky', {
      texture: 'mote', maxParticles: 800, space: 'world', blend: 'additive', billboard: 'camera',
      shape: { type: 'point' }, direction: { x: 0, y: 1, z: 0 }, spread: 0, rate: 0, lifetime: [4000, 6000], speed: 0, size: [2.2, 5],
      alphaOverLife: [{ time: 0, value: 1 }, { time: 1, value: 1 }],
      colorOverLife: [{ time: 0, color: '#dfe8ff' }, { time: 1, color: '#fff2dc' }],
    });
    // Haze lying on the sea round the feet of the far islands, and in banks between them.
    this.mist = make('mist', {
      texture: 'mote', maxParticles: 400, space: 'world', blend: 'alpha', billboard: 'camera',
      shape: { type: 'point' }, direction: { x: 1, y: 0, z: 0 }, spread: 0, rate: 0, lifetime: [4000, 6000], speed: 0, size: [60, 130],
      alphaOverLife: [{ time: 0, value: 0.1 }, { time: 1, value: 0.1 }],
      colorOverLife: [{ time: 0, color: '#ffffff' }, { time: 1, color: '#ffffff' }],
    });
    for (const island of FAR)
      for (let k = 0; k < 7; k++) {
        const a = island.angle + (this.rand() - 0.5) * (island.radius / island.distance) * 3.4,
          d = island.distance - island.radius * (0.5 + 0.7 * this.rand());
        this.mist.system.burst(1, Math.cos(a) * d, 2 + this.rand() * 14, Math.sin(a) * d);
      }
    for (let k = 0; k < 50; k++) {
      const a = this.rand() * Math.PI * 2,
        d = 330 + this.rand() * 420;
      this.mist.system.burst(1, Math.cos(a) * d, 2 + this.rand() * 12, Math.sin(a) * d);
    }
    for (let i = 0; i < 700; i++) {
      const a = this.rand() * Math.PI * 2,
        up = Math.asin(0.04 + this.rand() * 0.96);
      this.sky.system.burst(1, Math.cos(a) * Math.cos(up) * 380, Math.sin(up) * 380, Math.sin(a) * Math.cos(up) * 380);
    }
  }

  private due(e: Emitter, perSecond: number, dt: number) {
    const n = (this.carry.get(e) ?? 0) + perSecond * dt;
    const whole = Math.floor(n);
    this.carry.set(e, n - whole);
    return whole;
  }

  update(dt: number, eye: V3, near: V3, camera: Laya.Camera) {
    const b = this.budget;
    const windy = Math.hypot(this.wind[0], this.wind[1]);
    // Petals from the crowns of the blossom trees within sight of where the player is.
    const close = this.blossom.filter((t) => Math.hypot(t.x - near[0], t.z - near[2]) < 34);
    const fall = (e: Emitter, kinds: string[]) => {
      const trees = close.filter((t) => kinds.includes(t.kind));
      if (!trees.length) return;
      const n = this.due(e, Math.min(110, trees.length * 9) * (0.6 + windy) * b, dt);
      for (let i = 0; i < n; i++) {
        const t = trees[Math.floor(this.rand() * trees.length)];
        const a = this.rand() * Math.PI * 2,
          r = Math.sqrt(this.rand()) * t.crown;
        e.system.burst(1, t.x + Math.cos(a) * r, (groundAt(t.x, t.z) ?? 0) + t.height - t.crown * 0.3 + this.rand() * t.crown * 0.6, t.z + Math.sin(a) * r);
      }
      (e.system.spec as { acceleration?: unknown }).acceleration = { x: this.wind[0] * 0.7, y: -0.35, z: this.wind[1] * 0.7 };
    };
    fall(this.petals, ['pink', 'rose']);
    fall(this.violet, ['violet']);
    const around = (e: Emitter, perSecond: number, lo: number, hi: number, reach: number) => {
      const n = this.due(e, perSecond, dt);
      for (let i = 0; i < n; i++) {
        const x = near[0] + (this.rand() - 0.5) * reach,
          z = near[2] + (this.rand() - 0.5) * reach;
        if (insideBy(x, z) < 6) continue;
        e.system.burst(1, x, (groundAt(x, z) ?? 0) + lo + this.rand() * (hi - lo), z);
      }
    };
    around(this.motes, 50 * this.sun * (1 - this.night) * b, 0.3, 3.5, 30);
    around(this.fireflies, 45 * this.night * b, 0.25, 1.8, 44);
    for (const e of this.all) e.system.update(dt);
    this.sky.opacity = Math.max(0, this.night * 1.25 - 0.25);
    this.mist.opacity = 1 - 0.8 * this.night;
    for (const e of this.all) e.renderer.render(camera, e.opacity);
    void eye;
  }

  get alive() {
    let n = 0;
    for (const e of this.all) n += e.system.aliveCount;
    return n - this.sky.system.aliveCount - this.mist.system.aliveCount;
  }

  dispose() {
    for (const e of this.all) {
      e.system.stop(true);
      e.renderer.dispose();
    }
    this.layer.destroy(true);
    for (const t of Object.values(this.tex)) t.destroy();
  }
}
