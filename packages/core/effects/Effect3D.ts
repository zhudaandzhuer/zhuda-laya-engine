/**
 * One ready effect in a 3D scene: a preset's emitters, their built-in
 * sprites and their renderers, owned and released together.
 *
 * A game lets it run: `update(deltaSeconds)` then `render(camera)` each frame.
 * A film asks for a moment: `seek(seconds)` puts it exactly where it is that
 * long after its start, the same whichever moments were asked before (it is
 * stepped at 120 Hz from its start, and from the start again when time goes
 * back), so a frame drawn twice is the same frame.
 */
import { ZhudaParticleSystem3D } from '../particles/ParticleSystem3D.ts';
import { ZhudaLayaParticleRenderer3D } from '../particles/LayaParticleRenderer3D.ts';
import type { ParticleEffectSpec3D, ParticleEmitterSpec3D } from '../particles/ParticleTypes3D.ts';
import { createSurfaceTexture } from '../runtime3d/Surfaces.ts';
import {
  bakeZhudaEffectSprite,
  ZHUDA_EFFECT_SPRITES,
  type ZhudaEffectSpriteId,
} from './EffectSprites.ts';
import {
  ZHUDA_EFFECT_PRESETS_3D,
  validateZhudaEffectPreset3D,
  type ZhudaEffectPreset3D,
} from './EffectPresets.ts';

export interface ZhudaEffect3DOptions {
  /** Where its origin is, metres (default the world's origin). */
  position?: readonly [number, number, number];
  /** Turned about the vertical, degrees. */
  yawDeg?: number;
  /** Every length of the preset times this, 0.05..50 (default 1). */
  scale?: number;
  /** Added to the emitters' seeds: two copies with different seeds do not move alike. */
  seed?: number;
  /** The side of the sprites' pictures in pixels: 32, 64, 128 (default) or 256. */
  spriteSize?: number;
}

type Range = number | [number, number];
const scaled = (range: Range, k: number): Range =>
  typeof range === 'number' ? range * k : [range[0] * k, range[1] * k];

/** A preset's effect with every length multiplied by `scale`: sizes, speeds, shapes, forces. Pure. */
export function scaleZhudaEffect3D(
  effect: ParticleEffectSpec3D,
  scale: number,
): ParticleEffectSpec3D {
  if (!(Number.isFinite(scale) && scale >= 0.05 && scale <= 50))
    throw Error('Effect scale: use 0.05..50');
  if (scale === 1) return JSON.parse(JSON.stringify(effect));
  return {
    ...effect,
    emitters: effect.emitters.map((e) => {
      const shape =
        e.shape.type === 'box'
          ? {
              ...e.shape,
              width: e.shape.width * scale,
              height: e.shape.height * scale,
              depth: e.shape.depth * scale,
            }
          : e.shape.type === 'sphere'
            ? { ...e.shape, radius: e.shape.radius * scale }
            : e.shape;
      return {
        ...JSON.parse(JSON.stringify(e)),
        shape,
        speed: scaled(e.speed as Range, scale),
        size: scaled(e.size as Range, scale),
        ...(e.acceleration
          ? {
              acceleration: {
                x: e.acceleration.x * scale,
                y: e.acceleration.y * scale,
                z: e.acceleration.z * scale,
              },
            }
          : {}),
        ...(e.turbulence
          ? { turbulence: { ...e.turbulence, strength: e.turbulence.strength * scale } }
          : {}),
      } as ParticleEmitterSpec3D;
    }),
  };
}

const STEP = 1 / 120;

export class ZhudaEffect3D {
  readonly preset: ZhudaEffectPreset3D;
  /** The effect as it runs: the preset's, scaled and seeded. */
  readonly effect: ParticleEffectSpec3D;
  private readonly systems: ZhudaParticleSystem3D[] = [];
  private readonly renderers: ZhudaLayaParticleRenderer3D[] = [];
  private readonly textures = new Map<string, any>();
  private steps = 0;
  private disposed = false;

  constructor(
    parent: unknown,
    preset: string | ZhudaEffectPreset3D,
    options: ZhudaEffect3DOptions = {},
  ) {
    const found = typeof preset === 'string' ? ZHUDA_EFFECT_PRESETS_3D[preset] : preset;
    if (!found)
      throw Error(
        `Unknown effect preset ${String(preset)}; known: ${Object.keys(ZHUDA_EFFECT_PRESETS_3D).sort().join(', ')}`,
      );
    const issues = validateZhudaEffectPreset3D(found);
    if (issues.length) throw Error('Effect preset: ' + issues.join('; '));
    for (const emitter of found.effect.emitters)
      if (!(emitter.texture in ZHUDA_EFFECT_SPRITES))
        throw Error(
          `Effect emitter ${emitter.id}: texture ${emitter.texture} is not a built-in sprite (${Object.keys(ZHUDA_EFFECT_SPRITES).join(', ')})`,
        );
    const seed = options.seed ?? 0;
    if (!(Number.isInteger(seed) && seed >= 0)) throw Error('Effect seed: a whole number from 0');
    const position = options.position ?? [0, 0, 0];
    if (position.length !== 3 || !position.every((n) => Number.isFinite(n)))
      throw Error('Effect position: [x, y, z] in metres');
    this.preset = found;
    this.effect = scaleZhudaEffect3D(found.effect, options.scale ?? 1);
    for (const emitter of this.effect.emitters) emitter.seed += seed * 7919;
    const half = (((options.yawDeg ?? 0) * Math.PI) / 180) * 0.5;
    const rotation = { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
    const size = options.spriteSize ?? 128;
    try {
      for (const emitter of this.effect.emitters) {
        if (!this.textures.has(emitter.texture))
          this.textures.set(
            emitter.texture,
            createSurfaceTexture(
              size,
              size,
              bakeZhudaEffectSprite(emitter.texture as ZhudaEffectSpriteId, size),
              'color',
              { mipmap: true },
            ),
          );
        const system = new ZhudaParticleSystem3D(emitter);
        system.setTransform(position[0], position[1], position[2], rotation);
        system.play();
        this.systems.push(system);
        this.renderers.push(
          new ZhudaLayaParticleRenderer3D(system, parent, (key) => this.textures.get(key)),
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
    return this.steps * STEP;
  }

  /** Lets it run on by `deltaSeconds` (a game's frame). */
  update(deltaSeconds: number): void {
    if (this.disposed) return;
    if (!(Number.isFinite(deltaSeconds) && deltaSeconds >= 0))
      throw Error('Effect update: seconds from 0');
    this.advance(Math.round((this.seconds + deltaSeconds) / STEP));
  }

  /** Puts it where it is `seconds` after its start; a negative time is before it began (nothing). */
  seek(seconds: number): void {
    if (this.disposed) return;
    if (!Number.isFinite(seconds)) throw Error('Effect seek: a time in seconds');
    const target = Math.max(0, Math.round(seconds / STEP));
    if (seconds < 0 || target < this.steps) this.restart();
    if (seconds >= 0) this.advance(target);
  }

  /** Back to its start: no particle alive, the same random numbers again. */
  restart(): void {
    for (const system of this.systems) system.play(true);
    this.steps = 0;
  }

  private advance(target: number): void {
    for (; this.steps < target; this.steps++)
      for (const system of this.systems) system.update(STEP);
  }

  /** Builds the particles' meshes for this camera; call once a drawn frame. */
  render(camera: unknown, opacity = 1): void {
    if (this.disposed) return;
    for (const renderer of this.renderers) renderer.render(camera, opacity);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const renderer of this.renderers) renderer.dispose();
    for (const system of this.systems) system.stop(true);
    for (const texture of this.textures.values()) texture.destroy?.();
    this.textures.clear();
  }
}
