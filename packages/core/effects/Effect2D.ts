/**
 * One ready effect on a 2D display list: a preset's emitters, their built-in
 * sprites and their renderers, owned and released together. It runs on the
 * engine's 2D particle system (`ZhudaParticleSystem`) and its Laya renderer
 * (`ZhudaLayaParticleRenderer`); it adds no simulation of its own.
 *
 * A game lets it run: `update(deltaSeconds)` then `render()` each frame, and
 * `setPosition` to move it (a trail follows). A replay or a test asks for a
 * moment: `seek(seconds)` puts it exactly where it is that long after its
 * start at its present position, the same whichever moments were asked
 * before (it is stepped at 120 Hz from its start, and from the start again
 * when time goes back).
 *
 * Coordinates are the parent's pixels (+Y down). The effect makes one Sprite
 * under the parent, and one Sprite for each emitter under that, in the
 * preset's order: later emitters are drawn over earlier ones.
 */
import { ZhudaParticleSystem } from '../particles/ParticleSystem.ts';
import { ZhudaLayaParticleRenderer } from '../particles/LayaParticleRenderer.ts';
import type { ParticleEffectSpec, ParticleEmitterSpec } from '../particles/ParticleTypes.ts';
import {
  bakeZhudaEffectSprite,
  ZHUDA_EFFECT_SPRITES,
  ZHUDA_EFFECT_SPRITE_SIZES,
  type ZhudaEffectSpriteId,
} from './EffectSprites.ts';
import {
  ZHUDA_EFFECT_PRESETS_2D,
  validateZhudaEffectPreset2D,
  type ZhudaEffectPreset2D,
} from './EffectPresets2D.ts';

export interface ZhudaEffect2DOptions {
  /** Where its origin is, in the parent's pixels (default 0, 0). */
  x?: number;
  y?: number;
  /** Turned clockwise on the screen, degrees (default 0). */
  rotationDeg?: number;
  /** Every length of the preset times this, 0.05..50 (default 1). */
  scale?: number;
  /** Added to the emitters' seeds: two copies with different seeds do not move alike. */
  seed?: number;
  /** The side of the sprites' pictures in pixels: 32, 64 (default), 128 or 256. */
  spriteSize?: number;
  /** Bands of a particle's life its colour and alpha are drawn in, 1..64 (default 12). */
  lifeBands?: number;
}

type Range = number | [number, number];
const scaled = (range: Range, k: number): Range =>
  typeof range === 'number' ? range * k : [range[0] * k, range[1] * k];

/**
 * A 2D effect with every length multiplied by `scale`: sizes, speeds,
 * shapes, forces and collision planes; emission along a path keeps the same
 * count for the same path drawn bigger. Times and counts are unchanged. Pure.
 */
export function scaleZhudaEffect2D(effect: ParticleEffectSpec, scale: number): ParticleEffectSpec {
  if (!(Number.isFinite(scale) && scale >= 0.05 && scale <= 50))
    throw Error('Effect scale: use 0.05..50');
  const copy: ParticleEffectSpec = JSON.parse(JSON.stringify(effect));
  if (scale === 1) return copy;
  return {
    ...copy,
    emitters: copy.emitters.map((e): ParticleEmitterSpec => {
      const shape =
        e.shape.type === 'box'
          ? { ...e.shape, width: e.shape.width * scale, height: e.shape.height * scale }
          : e.shape.type === 'circle'
            ? { ...e.shape, radius: e.shape.radius * scale }
            : e.shape;
      return {
        ...e,
        shape,
        speed: scaled(e.speed, scale),
        size: scaled(e.size, scale),
        ...(e.acceleration
          ? { acceleration: { x: e.acceleration.x * scale, y: e.acceleration.y * scale } }
          : {}),
        ...(e.turbulence
          ? { turbulence: { ...e.turbulence, strength: e.turbulence.strength * scale } }
          : {}),
        ...(e.rateOverDistance !== undefined
          ? { rateOverDistance: e.rateOverDistance / scale }
          : {}),
        ...(e.collision
          ? {
              collision: {
                ...e.collision,
                planes: e.collision.planes.map((p) => ({ ...p, offset: p.offset * scale })),
                ...(e.collision.radius !== undefined ? { radius: e.collision.radius * scale } : {}),
              },
            }
          : {}),
      };
    }),
  };
}

const STEP = ZhudaParticleSystem.STEP;

export class ZhudaEffect2D {
  readonly preset: ZhudaEffectPreset2D;
  /** The effect as it runs: the preset's, scaled and seeded. */
  readonly effect: ParticleEffectSpec;
  /** The Sprite it draws in, a child of the parent; its own, released by `dispose`. */
  readonly node: any;
  private readonly systems: ZhudaParticleSystem[] = [];
  private readonly renderers: ZhudaLayaParticleRenderer[] = [];
  private readonly textures = new Map<string, { texture: any; bitmap: any }>();
  private disposed = false;

  constructor(
    parent: unknown,
    preset: string | ZhudaEffectPreset2D,
    options: ZhudaEffect2DOptions = {},
  ) {
    const found = typeof preset === 'string' ? ZHUDA_EFFECT_PRESETS_2D[preset] : preset;
    if (!found)
      throw Error(
        `Unknown 2D effect preset ${String(preset)}; known: ${Object.keys(ZHUDA_EFFECT_PRESETS_2D).sort().join(', ')}`,
      );
    const issues = validateZhudaEffectPreset2D(found);
    if (issues.length) throw Error('2D effect preset: ' + issues.join('; '));
    for (const emitter of found.effect.emitters)
      if (!(emitter.texture in ZHUDA_EFFECT_SPRITES))
        throw Error(
          `Effect emitter ${emitter.id}: texture ${emitter.texture} is not a built-in sprite (${Object.keys(ZHUDA_EFFECT_SPRITES).join(', ')})`,
        );
    const seed = options.seed ?? 0;
    if (!(Number.isInteger(seed) && seed >= 0)) throw Error('Effect seed: a whole number from 0');
    const x = options.x ?? 0,
      y = options.y ?? 0,
      rotation = ((options.rotationDeg ?? 0) * Math.PI) / 180;
    if (![x, y, rotation].every(Number.isFinite))
      throw Error('Effect position: finite x, y (pixels) and rotationDeg');
    const size = options.spriteSize ?? 64;
    if (!(ZHUDA_EFFECT_SPRITE_SIZES as readonly number[]).includes(size))
      throw Error(`Effect sprite size: use ${ZHUDA_EFFECT_SPRITE_SIZES.join(', ')}`);
    const l = (globalThis as any).Laya;
    if (!l?.Sprite || !l?.Texture || !l?.Texture2D || !l?.TextureFormat)
      throw Error('[ZhudaEffect2D] Laya must be booted before an effect is made.');
    if (!parent || typeof (parent as any).addChild !== 'function')
      throw Error('[ZhudaEffect2D] The parent is a Laya Sprite (a node with addChild).');
    this.preset = found;
    this.effect = scaleZhudaEffect2D(found.effect, options.scale ?? 1);
    for (const emitter of this.effect.emitters) emitter.seed += seed * 7919;
    this.node = new l.Sprite();
    this.node.name = 'Effect2D';
    this.node.mouseEnabled = false;
    (parent as any).addChild(this.node);
    try {
      for (const emitter of this.effect.emitters) {
        if (!this.textures.has(emitter.texture))
          this.textures.set(
            emitter.texture,
            spriteTexture(l, emitter.texture as ZhudaEffectSpriteId, size),
          );
        const system = new ZhudaParticleSystem(emitter);
        system.setTransform(x, y, rotation);
        system.play();
        this.systems.push(system);
        this.renderers.push(
          new ZhudaLayaParticleRenderer(
            system,
            this.node,
            (key) => this.textures.get(key)?.texture,
            options.lifeBands ?? 12,
          ),
        );
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  /** Particles alive now, over all emitters. */
  get aliveCount(): number {
    return this.systems.reduce((sum, system) => sum + system.aliveCount, 0);
  }

  /** Seconds since its start, as far as it has been stepped. */
  get seconds(): number {
    return this.systems[0]?.time ?? 0;
  }

  /** Whether any emitter still emits (a burst stops by itself; `stop` stops a loop). */
  get emitting(): boolean {
    return this.systems.some((system) => system.emitting);
  }

  /**
   * Moves its origin (pixels of the parent) and turns it. Particles already
   * out stay where they are; a trail fills the way between the last
   * position and this one at the next `update`. To begin again somewhere
   * else with no trail between, move it and then `restart`.
   */
  setPosition(x: number, y: number, rotationDeg?: number): void {
    if (this.disposed) return;
    const rotation =
      rotationDeg === undefined
        ? this.systems[0]?.transform.rotation
        : (rotationDeg * Math.PI) / 180;
    for (const system of this.systems) system.setTransform(x, y, rotation ?? 0);
  }

  /**
   * Lets it run on by `deltaSeconds` (a game's frame). Each emitter keeps its
   * own 120 Hz steps and catches up at most a quarter of a second at once,
   * as `ZhudaParticleSystem` does.
   */
  update(deltaSeconds: number): void {
    if (this.disposed) return;
    if (!(Number.isFinite(deltaSeconds) && deltaSeconds >= 0))
      throw Error('Effect update: seconds from 0');
    for (const system of this.systems) system.update(deltaSeconds);
  }

  /** Puts it where it is `seconds` after its start; a negative time is before it began (nothing). */
  seek(seconds: number): void {
    if (this.disposed) return;
    if (!Number.isFinite(seconds)) throw Error('Effect seek: a time in seconds');
    const target = Math.max(0, Math.round(seconds / STEP));
    let steps = Math.round(this.seconds / STEP);
    if (seconds < 0 || target < steps) {
      this.restart();
      steps = 0;
    }
    if (seconds < 0) return;
    for (; steps < target; steps++) for (const system of this.systems) system.update(STEP);
  }

  /** Back to its start: no particle alive, the same random numbers again, emitting. */
  restart(): void {
    if (this.disposed) return;
    for (const system of this.systems) system.play(true);
  }

  /** Stops emitting; what is out lives on unless `clear`. A loop ends this way. */
  stop(clear = false): void {
    if (this.disposed) return;
    for (const system of this.systems) system.stop(clear);
  }

  /** Builds the particles' quads; call once a drawn frame. */
  render(opacity = 1): void {
    if (this.disposed) return;
    for (const renderer of this.renderers) renderer.render(opacity);
  }

  /** Releases its sprites, renderers and pictures; the parent is left as it is. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const renderer of this.renderers) renderer.dispose();
    for (const system of this.systems) system.stop(true);
    if (this.node && !this.node.destroyed) this.node.destroy(true);
    for (const { texture, bitmap } of this.textures.values()) {
      texture.destroy?.();
      if (!bitmap.destroyed) bitmap.destroy?.();
    }
    this.textures.clear();
  }
}

/**
 * A built-in sprite as a Laya 2D texture, made as Laya makes a loaded 2D
 * picture: its colour multiplied by its alpha (Laya's 2D blending expects it;
 * `lighter` adds the colour as it is) and marked sRGB. Laya draws 2D in light
 * and encodes the result for the screen, so an sRGB picture shows its bytes:
 * a sprite pixel of alpha a over black shows a, as in a canvas. Marked as
 * plain data it would show brighter (0.53 as 0.75, measured).
 */
function spriteTexture(l: any, id: ZhudaEffectSpriteId, size: number) {
  const rgba = bakeZhudaEffectSprite(id, size);
  for (let i = 0; i < rgba.length; i += 4) rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3];
  const bitmap = new l.Texture2D(size, size, l.TextureFormat.R8G8B8A8, true, false, true, true);
  try {
    bitmap.setPixelsData(rgba, false, false);
    return { bitmap, texture: new l.Texture(bitmap) };
  } catch (error) {
    bitmap.destroy?.();
    throw error;
  }
}
