// The island's particle effects, on the engine's 3D particle simulator and renderer.
// Sprites are drawn here from numbers (no image files).
import { ZhudaLayaParticleRenderer3D, ZhudaParticleSystem3D, type ParticleEmitterSpec3D } from 'zhuda-laya-engine';
import { groundAt, pondDistance, POND, TREE, WATER_Y } from './ground.ts';
import { random, type V3 } from '../math.ts';

type Paint = (u: number, v: number) => [number, number, number, number];

function sprite(size: number, paint: Paint) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
      const i = (y * size + x) * 4;
      data[i] = Math.round(Math.min(1, Math.max(0, r)) * 255);
      data[i + 1] = Math.round(Math.min(1, Math.max(0, g)) * 255);
      data[i + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255);
      data[i + 3] = Math.round(Math.min(1, Math.max(0, a)) * 255);
    }
  const texture = new Laya.Texture2D(size, size, Laya.TextureFormat.R8G8B8A8, true, false, false);
  texture.setPixelsData(data, false, false);
  texture.wrapModeU = texture.wrapModeV = Laya.WrapMode.Clamp;
  return texture;
}

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const vnoise = (x: number, y: number) => {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy),
    b = hash(ix + 1, iy),
    c = hash(ix, iy + 1),
    d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x: number, y: number) => vnoise(x, y) * 0.5 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.2;

function makeTextures() {
  const white = (a: number): [number, number, number, number] => [1, 1, 1, a];
  return {
    soft: sprite(128, (u, v) => white(Math.exp(-(u * u + v * v) * 4.5))),
    // The renderer stretches the quad along its x, and a streak is a few pixels wide:
    // fill the quad's width (a thin line in the texture would be lost to its mipmaps).
    streak: sprite(128, (u, v) => white(Math.sqrt(Math.max(0, 1 - v * v)) * (1 - Math.abs(u) ** 2) * (0.6 + 0.4 * (1 - u) * 0.5))),
    ring: sprite(128, (u, v) => {
      const r = Math.hypot(u, v);
      return white(Math.exp(-((r - 0.78) ** 2) * 90) * (r < 1 ? 1 : 0));
    }),
    star: sprite(128, (u, v) => {
      const a = Math.atan2(v, u),
        r = Math.hypot(u, v);
      const edge = 0.45 + 0.4 * Math.pow(Math.abs(Math.cos(2.5 * a)), 3);
      const inside = r < edge ? 1 : Math.exp(-(r - edge) * 30);
      return [1, 0.92 + 0.08 * (1 - r), 0.55 + 0.45 * (1 - r), inside];
    }),
    spark: sprite(128, (u, v) => white(Math.max(Math.exp(-u * u * 200) * Math.exp(-v * v * 3), Math.exp(-v * v * 200) * Math.exp(-u * u * 3), Math.exp(-(u * u + v * v) * 20)))),
    leaf: sprite(128, (u, v) => {
      // a pointed oval with a midrib, light toward the tip
      const w = 0.55 * Math.sqrt(Math.max(0, 1 - v * v)) * (1 - 0.25 * v);
      const inside = Math.abs(u) < w ? 1 : 0;
      const rib = Math.exp(-u * u * 900) * 0.25;
      return [1 - rib, 1 - rib, 1 - rib, inside * (0.95 - 0.2 * Math.abs(u / Math.max(w, 0.01)))];
    }),
    petal: sprite(128, (u, v) => white(Math.hypot(u * 1.4, v) < 0.85 ? 1 : 0)),
    smoke: sprite(128, (u, v) => {
      const r = Math.hypot(u, v);
      const n = fbm(u * 3 + 10, v * 3 + 3);
      return white(Math.max(0, 1 - r * (1.15 - 0.5 * n)) ** 1.5 * (0.5 + 0.7 * n));
    }),
    cloud: sprite(128, (u, v) => {
      const r = Math.hypot(u, v * 1.6);
      const n = fbm(u * 2.2 + 5, v * 2.2 + 1);
      const a = Math.max(0, 1 - r * (1.3 - 0.6 * n)) ** 1.2;
      // lit from above: white tops, blue-grey undersides
      const top = Math.min(1, Math.max(0, 0.5 - v * 0.7 + (n - 0.5) * 0.8));
      return [0.72 + 0.28 * top, 0.76 + 0.24 * top, 0.86 + 0.14 * top, a];
    }),
    drop: sprite(128, (u, v) => {
      const r = Math.hypot(u * 1.4, (v + 0.2) * (v < -0.2 ? 0.7 : 1));
      return [0.9, 0.95, 1, r < 0.8 ? 0.9 - 0.4 * r : 0];
    }),
    heart: sprite(128, (u, v) => {
      const x = u * 1.25,
        y = -v * 1.25 + 0.25;
      const f = (x * x + y * y - 1) ** 3 - x * x * y * y * y;
      return [1, 0.4, 0.55, f < 0 ? 1 : 0];
    }),
    mote: sprite(128, (u, v) => white(Math.exp(-(u * u + v * v) * 9))),
  };
}

type Textures = ReturnType<typeof makeTextures>;
type Spec = Omit<ParticleEmitterSpec3D, 'texture' | 'seed' | 'id'> & { texture: keyof Textures };

class Emitter {
  readonly system: ZhudaParticleSystem3D;
  readonly renderer: ZhudaLayaParticleRenderer3D;
  opacity = 1;
  constructor(id: string, spec: Spec, parent: Laya.Sprite3D, textures: Textures, seed: number) {
    this.system = new ZhudaParticleSystem3D({ ...spec, id, seed, texture: spec.texture } as ParticleEmitterSpec3D);
    this.renderer = new ZhudaLayaParticleRenderer3D(this.system, parent, (key: string) => textures[key as keyof Textures]);
  }
  /** A burst at a place: the spec's bursts, played from there. */
  burst(at: V3, strength = 1) {
    this.system.intensity = Math.min(2, Math.max(0, strength));
    this.system.stop();
    this.system.setTransform(at[0], at[1], at[2]);
    this.system.play();
    this.system.update(1 / 120);
  }
}

export class IslandFx {
  private readonly textures = makeTextures();
  private readonly layer = new Laya.Sprite3D('fx');
  private readonly rand = random(17);
  private readonly all: Emitter[] = [];
  readonly rain: Emitter;
  readonly nearRain: Emitter;
  readonly splashes: Emitter;
  readonly ripples: Emitter;
  readonly dust: Emitter;
  readonly shock: Emitter;
  readonly droplets: Emitter;
  readonly waterRing: Emitter;
  readonly drips: Emitter;
  readonly shakeDrops: Emitter;
  readonly stars: Emitter;
  readonly sparks: Emitter;
  readonly smoke: Emitter;
  readonly leaves: Emitter;
  readonly fireflies: Emitter;
  readonly motes: Emitter;
  readonly clouds: Emitter;
  readonly hearts: Emitter;
  readonly speed: Emitter;
  readonly sweat: Emitter;
  readonly poof: Emitter;
  readonly sky: Emitter;
  /** 0..1 each, set by the weather. */
  rainAmount = 0;
  /** Share of the particles the picture setting allows, 0..1. */
  budget = 1;
  night = 0;
  sun = 1;
  windX = 0.6;
  windZ = 0.2;
  chimney: V3 = [0, 0, 0];

  constructor(scene: Laya.Scene3D) {
    scene.addChild(this.layer);
    const make = (id: string, spec: Spec) => {
      const e = new Emitter(id, spec, this.layer, this.textures, 1 + this.all.length * 7919);
      this.all.push(e);
      return e;
    };
    const fade = (peak = 1, at = 0.15) => [
      { time: 0, value: 0 },
      { time: at, value: peak },
      { time: 1, value: 0 },
    ];
    this.rain = make('rain', {
      texture: 'streak', maxParticles: 6000, space: 'world', blend: 'alpha', billboard: 'velocity',
      shape: { type: 'box', width: 30, height: 0.2, depth: 30 }, direction: { x: 0.08, y: -1, z: 0.03 }, spread: 0.02,
      rate: 0, lifetime: [1.25, 1.45], speed: [11, 13], size: [0.022, 0.03], stretch: 26,
      alphaOverLife: [{ time: 0, value: 0 }, { time: 0.08, value: 0.55 }, { time: 0.92, value: 0.55 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#eef3f8' }, { time: 1, color: '#f4f7fb' }],
    });
    this.nearRain = make('nearRain', {
      texture: 'streak', maxParticles: 2400, space: 'world', blend: 'alpha', billboard: 'velocity',
      shape: { type: 'box', width: 8, height: 0.2, depth: 8 }, direction: { x: 0.08, y: -1, z: 0.03 }, spread: 0.02,
      rate: 0, lifetime: [0.55, 0.65], speed: [12, 14], size: [0.007, 0.01], stretch: 60,
      alphaOverLife: [{ time: 0, value: 0 }, { time: 0.1, value: 0.38 }, { time: 0.9, value: 0.38 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#f2f6fa' }, { time: 1, color: '#f2f6fa' }],
    });
    this.splashes = make('splashes', {
      texture: 'ring', maxParticles: 600, space: 'world', blend: 'alpha', billboard: 'ground',
      shape: { type: 'point' }, direction: { x: 0, y: 1, z: 0 }, spread: 0, rate: 0, lifetime: [0.18, 0.3], speed: 0, size: [0.08, 0.14],
      sizeOverLife: [{ time: 0, value: 0.3 }, { time: 1, value: 1.2 }], alphaOverLife: [{ time: 0, value: 0.55 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#e8eef5' }, { time: 1, color: '#e8eef5' }],
    });
    this.ripples = make('ripples', {
      texture: 'ring', maxParticles: 400, space: 'world', blend: 'alpha', billboard: 'ground',
      shape: { type: 'point' }, direction: { x: 0, y: 1, z: 0 }, spread: 0, rate: 0, lifetime: [0.7, 1.1], speed: 0, size: [0.25, 0.45],
      sizeOverLife: [{ time: 0, value: 0.1 }, { time: 1, value: 1.3 }], alphaOverLife: [{ time: 0, value: 0.5 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#dfe9f2' }, { time: 1, color: '#dfe9f2' }],
    });
    this.dust = make('dust', {
      texture: 'smoke', maxParticles: 200, space: 'world', blend: 'alpha', billboard: 'camera',
      shape: { type: 'sphere', radius: 0.25 }, direction: { x: 0, y: 1, z: 0 }, spread: 1.45, rate: 0, bursts: [{ time: 0, count: 26 }], duration: 0.05,
      lifetime: [0.6, 1.2], speed: [1.2, 3.2], drag: 3.5, acceleration: { x: 0, y: 0.4, z: 0 }, size: [0.25, 0.45],
      rotation: [0, 6.28], angularVelocity: [-1.5, 1.5],
      sizeOverLife: [{ time: 0, value: 0.5 }, { time: 1, value: 2.2 }], alphaOverLife: fade(0.55, 0.08),
      colorOverLife: [{ time: 0, color: '#b9a585' }, { time: 1, color: '#d9cfbe' }],
    });
    this.shock = make('shock', {
      texture: 'ring', maxParticles: 8, space: 'world', blend: 'alpha', billboard: 'ground',
      shape: { type: 'point' }, direction: { x: 0, y: 1, z: 0 }, spread: 0, rate: 0, bursts: [{ time: 0, count: 1 }], duration: 0.05,
      lifetime: 0.45, speed: 0, size: 2.2, sizeOverLife: [{ time: 0, value: 0.15 }, { time: 1, value: 1 }],
      alphaOverLife: [{ time: 0, value: 0.6 }, { time: 1, value: 0 }], colorOverLife: [{ time: 0, color: '#fff6e0' }, { time: 1, color: '#fff6e0' }],
    });
    this.droplets = make('droplets', {
      texture: 'drop', maxParticles: 400, space: 'world', blend: 'alpha', billboard: 'velocity',
      shape: { type: 'sphere', radius: 0.35, surface: true }, direction: { x: 0, y: 1, z: 0 }, spread: 0.6, rate: 0, bursts: [{ time: 0, count: 70 }], duration: 0.05,
      lifetime: [0.6, 1.1], speed: [2.5, 6], acceleration: { x: 0, y: -9.8, z: 0 }, size: [0.05, 0.11], stretch: 2,
      alphaOverLife: [{ time: 0, value: 0.9 }, { time: 0.8, value: 0.7 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#eef6ff' }, { time: 1, color: '#cfe3f2' }],
      collision: { planes: [{ normal: { x: 0, y: 1, z: 0 }, offset: WATER_Y }], killOnCollision: true },
    });
    this.waterRing = make('waterRing', {
      texture: 'ring', maxParticles: 24, space: 'world', blend: 'alpha', billboard: 'ground',
      shape: { type: 'point' }, direction: { x: 0, y: 1, z: 0 }, spread: 0, rate: 0, bursts: [{ time: 0, count: 1 }, { time: 0.18, count: 1 }, { time: 0.4, count: 1 }], duration: 0.5,
      lifetime: [1.2, 1.6], speed: 0, size: 2.6, sizeOverLife: [{ time: 0, value: 0.12 }, { time: 1, value: 1 }],
      alphaOverLife: [{ time: 0, value: 0.75 }, { time: 1, value: 0 }], colorOverLife: [{ time: 0, color: '#f4f9ff' }, { time: 1, color: '#f4f9ff' }],
    });
    this.drips = make('drips', {
      texture: 'drop', maxParticles: 120, space: 'world', blend: 'alpha', billboard: 'velocity',
      shape: { type: 'point' }, direction: { x: 0, y: -1, z: 0 }, spread: 0.2, rate: 0, bursts: [{ time: 0, count: 1 }], duration: 0.02,
      lifetime: 0.5, speed: [0.2, 0.6], acceleration: { x: 0, y: -9.8, z: 0 }, size: [0.035, 0.05], stretch: 2,
      alphaOverLife: [{ time: 0, value: 0.8 }, { time: 1, value: 0.5 }], colorOverLife: [{ time: 0, color: '#eef6ff' }, { time: 1, color: '#eef6ff' }],
    });
    this.shakeDrops = make('shakeDrops', {
      texture: 'drop', maxParticles: 300, space: 'world', blend: 'alpha', billboard: 'velocity',
      shape: { type: 'sphere', radius: 0.4, surface: true }, direction: { x: 0, y: 0.3, z: 0 }, spread: 3.1, rate: 0, bursts: [{ time: 0, count: 16 }], duration: 0.02,
      lifetime: [0.35, 0.6], speed: [2.5, 4.5], acceleration: { x: 0, y: -9.8, z: 0 }, size: [0.04, 0.07], stretch: 2.5,
      alphaOverLife: [{ time: 0, value: 0.9 }, { time: 1, value: 0 }], colorOverLife: [{ time: 0, color: '#f0f8ff' }, { time: 1, color: '#d8eaf6' }],
    });
    this.stars = make('stars', {
      texture: 'star', maxParticles: 80, space: 'world', blend: 'additive', billboard: 'camera',
      shape: { type: 'sphere', radius: 0.3, surface: true }, direction: { x: 0, y: 1, z: 0 }, spread: 1.4, rate: 0, bursts: [{ time: 0, count: 4 }], duration: 0.02,
      lifetime: [0.7, 1.0], speed: [0.4, 0.9], drag: 1.5, turbulence: { strength: 1.5, frequency: 3 }, size: [0.12, 0.2],
      rotation: [0, 6.28], angularVelocity: [-4, 4],
      sizeOverLife: [{ time: 0, value: 0.3 }, { time: 0.2, value: 1 }, { time: 1, value: 0.6 }], alphaOverLife: fade(1, 0.1),
      colorOverLife: [{ time: 0, color: '#ffe680' }, { time: 1, color: '#ffb347' }],
    });
    this.sparks = make('sparks', {
      texture: 'spark', maxParticles: 120, space: 'world', blend: 'additive', billboard: 'camera',
      shape: { type: 'sphere', radius: 0.15 }, direction: { x: 0, y: 1, z: 0 }, spread: 3.1, rate: 0, bursts: [{ time: 0, count: 18 }], duration: 0.02,
      lifetime: [0.3, 0.6], speed: [1.5, 3.5], drag: 4, size: [0.12, 0.22], rotation: [0, 6.28],
      sizeOverLife: [{ time: 0, value: 1 }, { time: 1, value: 0.2 }], alphaOverLife: [{ time: 0, value: 1 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#fffbe8' }, { time: 1, color: '#ffd27a' }],
    });
    this.smoke = make('smoke', {
      texture: 'smoke', maxParticles: 80, space: 'world', blend: 'alpha', billboard: 'camera',
      shape: { type: 'sphere', radius: 0.12 }, direction: { x: 0, y: 1, z: 0 }, spread: 0.25, rate: 5,
      lifetime: [4, 6], speed: [0.45, 0.7], acceleration: { x: 0.25, y: 0.05, z: 0.08 }, size: [0.3, 0.45],
      rotation: [0, 6.28], angularVelocity: [-0.4, 0.4],
      sizeOverLife: [{ time: 0, value: 0.6 }, { time: 1, value: 4.2 }], alphaOverLife: [{ time: 0, value: 0 }, { time: 0.1, value: 0.4 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#d8d6d2' }, { time: 1, color: '#eeeeee' }],
    });
    this.leaves = make('leaves', {
      texture: 'leaf', maxParticles: 120, space: 'world', blend: 'alpha', billboard: 'camera',
      shape: { type: 'point' }, direction: { x: 0, y: -1, z: 0 }, spread: 1, rate: 0, lifetime: [6, 9], speed: [0.1, 0.4],
      acceleration: { x: 0.3, y: -0.45, z: 0.1 }, drag: 0.6, turbulence: { strength: 1.4, frequency: 0.8 },
      size: [0.07, 0.12], rotation: [0, 6.28], angularVelocity: [-3, 3],
      alphaOverLife: [{ time: 0, value: 0 }, { time: 0.05, value: 1 }, { time: 0.9, value: 1 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#6f9a2c' }, { time: 0.5, color: '#9fb03a' }, { time: 1, color: '#c99a3a' }],
      collision: { planes: [{ normal: { x: 0, y: 1, z: 0 }, offset: 0.02 }], restitution: 0, friction: 1 },
    });
    this.fireflies = make('fireflies', {
      texture: 'mote', maxParticles: 160, space: 'world', blend: 'additive', billboard: 'camera',
      shape: { type: 'point' }, direction: { x: 0, y: 1, z: 0 }, spread: 3, rate: 0, lifetime: [3, 5], speed: [0.05, 0.2],
      turbulence: { strength: 0.6, frequency: 0.7 }, size: [0.06, 0.1],
      alphaOverLife: [{ time: 0, value: 0 }, { time: 0.2, value: 1 }, { time: 0.4, value: 0.3 }, { time: 0.6, value: 1 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#d8ff7a' }, { time: 1, color: '#ffe066' }],
    });
    this.motes = make('motes', {
      texture: 'mote', maxParticles: 260, space: 'world', blend: 'additive', billboard: 'camera',
      shape: { type: 'point' }, direction: { x: 0, y: 1, z: 0 }, spread: 3, rate: 0, lifetime: [5, 8], speed: [0.02, 0.08],
      turbulence: { strength: 0.15, frequency: 0.5 }, acceleration: { x: 0.05, y: 0.01, z: 0 }, size: [0.018, 0.035],
      alphaOverLife: fade(0.7, 0.3), colorOverLife: [{ time: 0, color: '#fff3d6' }, { time: 1, color: '#ffe2a8' }],
    });
    this.clouds = make('clouds', {
      texture: 'cloud', maxParticles: 160, space: 'world', blend: 'alpha', billboard: 'camera',
      shape: { type: 'point' }, direction: { x: 1, y: 0, z: 0.3 }, spread: 0.2, rate: 0, lifetime: [40, 60], speed: [0.25, 0.5],
      size: [10, 18], rotation: [0, 6.28], angularVelocity: [-0.02, 0.02],
      alphaOverLife: [{ time: 0, value: 0 }, { time: 0.2, value: 0.85 }, { time: 0.8, value: 0.85 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#ffffff' }, { time: 1, color: '#f3f6fa' }],
    });
    this.hearts = make('hearts', {
      texture: 'heart', maxParticles: 30, space: 'world', blend: 'alpha', billboard: 'camera',
      shape: { type: 'sphere', radius: 0.2 }, direction: { x: 0, y: 1, z: 0 }, spread: 0.6, rate: 0, bursts: [{ time: 0, count: 3 }], duration: 0.02,
      lifetime: [1.1, 1.5], speed: [0.6, 1.0], drag: 1.2, size: [0.16, 0.24],
      sizeOverLife: [{ time: 0, value: 0.2 }, { time: 0.2, value: 1.1 }, { time: 1, value: 0.9 }], alphaOverLife: fade(1, 0.1),
      colorOverLife: [{ time: 0, color: '#ffffff' }, { time: 1, color: '#ffffff' }],
    });
    this.speed = make('speed', {
      texture: 'streak', maxParticles: 200, space: 'world', blend: 'additive', billboard: 'velocity',
      shape: { type: 'sphere', radius: 0.45, surface: true }, direction: { x: 0, y: 1, z: 0 }, spread: 0.1, rate: 0, rateOverDistance: 6,
      lifetime: [0.25, 0.4], speed: [0.05, 0.2], size: [0.03, 0.05], stretch: 14,
      alphaOverLife: [{ time: 0, value: 0.55 }, { time: 1, value: 0 }], colorOverLife: [{ time: 0, color: '#ffffff' }, { time: 1, color: '#dfe8ff' }],
    });
    this.sweat = make('sweat', {
      texture: 'drop', maxParticles: 40, space: 'world', blend: 'alpha', billboard: 'camera',
      shape: { type: 'point' }, direction: { x: 0, y: 1, z: 0 }, spread: 1.1, rate: 0, bursts: [{ time: 0, count: 2 }], duration: 0.02,
      lifetime: 0.6, speed: [1, 1.6], acceleration: { x: 0, y: -6, z: 0 }, size: [0.07, 0.1],
      alphaOverLife: [{ time: 0, value: 0.95 }, { time: 1, value: 0 }], colorOverLife: [{ time: 0, color: '#bfe3ff' }, { time: 1, color: '#bfe3ff' }],
    });
    this.poof = make('poof', {
      texture: 'cloud', maxParticles: 60, space: 'world', blend: 'alpha', billboard: 'camera',
      shape: { type: 'sphere', radius: 0.6 }, direction: { x: 0, y: 1, z: 0 }, spread: 3.1, rate: 0, bursts: [{ time: 0, count: 18 }], duration: 0.02,
      lifetime: [0.8, 1.4], speed: [1.5, 3], drag: 3, size: [1, 1.8], rotation: [0, 6.28],
      sizeOverLife: [{ time: 0, value: 0.4 }, { time: 1, value: 1.6 }], alphaOverLife: fade(0.9, 0.05),
      colorOverLife: [{ time: 0, color: '#ffffff' }, { time: 1, color: '#f0f0f5' }],
    });
    this.sky = make('sky', {
      texture: 'mote', maxParticles: 700, space: 'world', blend: 'additive', billboard: 'camera',
      shape: { type: 'point' }, direction: { x: 0, y: 1, z: 0 }, spread: 0, rate: 0, lifetime: [400, 600], speed: 0, size: [1.4, 3.2],
      alphaOverLife: [{ time: 0, value: 0 }, { time: 0.02, value: 1 }, { time: 0.98, value: 1 }, { time: 1, value: 0 }],
      colorOverLife: [{ time: 0, color: '#dfe8ff' }, { time: 1, color: '#fff2dc' }],
    });
    for (const e of [this.rain, this.nearRain, this.splashes, this.ripples, this.smoke, this.leaves, this.fireflies, this.motes, this.clouds, this.speed, this.sky]) e.system.play(true);
    for (let i = 0; i < 650; i++) {
      // a dome of stars far off, mostly above the horizon
      const a = this.rand() * Math.PI * 2,
        up = Math.asin(-0.15 + this.rand() * 1.15);
      const r = 220;
      const ss = this.sky.system;
      ss.setTransform(Math.cos(a) * Math.cos(up) * r, Math.sin(up) * r, Math.sin(a) * Math.cos(up) * r);
      (ss.spec as { rate: number }).rate = 120;
      ss.update(1 / 120);
      (ss.spec as { rate: number }).rate = 0;
    }


  }

  private spawnCloud(age = 0) {
    const a = this.rand() * Math.PI * 2,
      r = 6 + this.rand() * 42;
    const s = this.clouds.system;
    s.setTransform(Math.cos(a) * r, -7.5 - this.rand() * 4 - r * 0.05, Math.sin(a) * r);
    // The rate is 0: one step at 120 a second emits exactly one, here.
    const spec = s.spec as { rate: number };
    spec.rate = 120;
    s.update(1 / 120);
    spec.rate = 0;
    void age;
  }

  /** Emits `count` particles of a rate-free emitter at places `where` picks. */
  private scatter(e: Emitter, count: number, where: () => V3 | null) {
    const s = e.system as unknown as { spec: { rate: number } };
    for (let i = 0; i < count; i++) {
      const p = where();
      if (!p) continue;
      e.system.setTransform(p[0], p[1], p[2]);
      s.spec.rate = 120;
      e.system.update(1 / 120);
      s.spec.rate = 0;
    }
  }

  private carry = new Map<Emitter, number>();
  private due(e: Emitter, perSecond: number, dt: number) {
    const n = (this.carry.get(e) ?? 0) + perSecond * dt;
    const whole = Math.floor(n);
    this.carry.set(e, n - whole);
    return whole;
  }

  private onIsland(): V3 | null {
    const x = (this.rand() - 0.5) * 15,
      z = (this.rand() - 0.5) * 15;
    const y = groundAt(x, z);
    if (y === null) return null;
    return [x, (pondDistance(x, z) < 0.95 && y < WATER_Y ? WATER_Y : y) + 0.03, z];
  }

  update(dt: number, eye: V3, camera: Laya.Camera, seconds: number) {
    const wind = Math.hypot(this.windX, this.windZ);
    // Rain: a box of streaks that goes with the eye, slanted by the wind.
    const rain = this.rainAmount;
    const b = this.budget;
    const rs = this.rain.system as unknown as { spec: ParticleEmitterSpec3D };
    rs.spec.rate = 4200 * rain * b;
    const ns = this.nearRain.system as unknown as { spec: ParticleEmitterSpec3D };
    ns.spec.rate = 3400 * rain * (0.5 + 0.5 * b);
    ns.spec.direction = rs.spec.direction;
    this.nearRain.system.setTransform(eye[0], eye[1] + 4.5, eye[2]);
    rs.spec.direction = { x: this.windX * 0.12, y: -1, z: this.windZ * 0.12 };
    // Over the island and the near air: streaks show against the island and its cliffs.
    this.rain.system.setTransform(eye[0] * 0.25, 14, eye[2] * 0.25);
    this.scatter(this.splashes, this.due(this.splashes, 420 * rain * b, dt), () => this.onIsland());
    this.scatter(this.ripples, this.due(this.ripples, 70 * rain * (0.5 + 0.5 * b), dt), () => {
      const [cx, cz] = POND.center;
      const a = this.rand() * Math.PI * 2,
        r = Math.sqrt(this.rand());
      const x = cx + Math.cos(a) * r * POND.radii[0] * 0.95,
        z = cz + Math.sin(a) * r * POND.radii[1] * 0.95;
      return pondDistance(x, z) < 0.95 ? [x, WATER_Y + 0.012, z] : null;
    });
    // Leaves from the tree's crown, more in wind.
    this.scatter(this.leaves, this.due(this.leaves, 0.8 + 5 * wind + 6 * rain, dt), () => {
      const a = this.rand() * Math.PI * 2,
        r = Math.sqrt(this.rand()) * 2.6;
      return [TREE.center[0] + Math.cos(a) * r, 3.4 + this.rand() * 2.4, TREE.center[1] + Math.sin(a) * r];
    });
    const ls = this.leaves.system as unknown as { spec: ParticleEmitterSpec3D };
    ls.spec.acceleration = { x: this.windX * 0.6, y: -0.45, z: this.windZ * 0.6 };
    // Fireflies by night, motes in the sun.
    this.scatter(this.fireflies, this.due(this.fireflies, 22 * this.night * (1 - rain) * b, dt), () => {
      const p = this.onIsland();
      return p ? [p[0], p[1] + 0.2 + this.rand() * 1.4, p[2]] : null;
    });
    this.scatter(this.motes, this.due(this.motes, 40 * this.sun * (1 - rain) * (1 - this.night) * b, dt), () => {
      const p = this.onIsland();
      return p ? [p[0], p[1] + 0.3 + this.rand() * 3.5, p[2]] : null;
    });

    // Chimney smoke, bent by the wind.
    const ss = this.smoke.system as unknown as { spec: ParticleEmitterSpec3D };
    ss.spec.acceleration = { x: this.windX * 0.5, y: 0.05, z: this.windZ * 0.5 };
    this.smoke.system.setTransform(this.chimney[0], this.chimney[1], this.chimney[2]);
    for (const e of this.all) {
      if (e === this.splashes || e === this.ripples || e === this.leaves || e === this.fireflies || e === this.motes) {
        e.system.update(dt);
      } else e.system.update(dt);
    }
    const nightDim = 1 - 0.75 * this.night;
    this.clouds.opacity = nightDim * (1 - 0.3 * rain);
    this.smoke.opacity = 0.9 * nightDim + 0.1;
    this.rain.opacity = 0.7 + 0.3 * nightDim;
    this.sky.opacity = Math.max(0, this.night * 1.2 - 0.2) * (1 - rain) * (0.85 + 0.15 * Math.sin(seconds * 3));
    for (const e of this.all) e.renderer.render(camera, e.opacity);
    void seconds;
  }

  get alive() {
    let n = 0;
    for (const e of this.all) n += (e.system as unknown as { aliveCount: number }).aliveCount ?? 0;
    return n;
  }

  dispose() {
    for (const e of this.all) {
      e.system.stop(true);
      e.renderer.dispose();
    }
    this.layer.destroy(true);
    for (const t of Object.values(this.textures)) t.destroy();
  }
}
