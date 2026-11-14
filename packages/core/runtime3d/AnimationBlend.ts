/**
 * Several clips of one model at once: a walk and a run mixed by how fast
 * the character goes, kept in step so the same foot comes down together;
 * and one clip laid over the rest on some of the bones (a wave over a
 * walk). LayaAir's animator plays one clip, or fades from one to another;
 * this poses the bones itself from as many clips as it is given, with
 * LayaAir's own evaluation of each.
 *
 * Only positions, rotations and scales of nodes are mixed (what a skeleton
 * is made of). Anything else a clip animates (a material's number, a morph
 * weight) is left alone. Nothing here keeps time: the caller says where in
 * the round the blend is.
 */
import type { ModelInstance } from './Assets.ts';
import { zhudaNormalizeWeights } from './AnimationBlendMath.ts';
import { claimZhudaAnimator, releaseZhudaAnimator } from './ModelAnimationSampler.ts';
import { ZhudaModelInspector } from './ModelInspector.ts';

interface ClipSlot {
  name: string;
  seconds: number;
  state: any;
  play: any;
  task: any;
}
interface Mixed {
  owner: any;
  kind: 'position' | 'rotation' | 'scale' | 'euler';
  x: number;
  y: number;
  z: number;
  w: number;
  weight: number;
  stamp: number;
}

const runtime = () => (globalThis as any).Laya;

export class ZhudaAnimationBlend {
  /** The clips, in the order their weights are given in. */
  readonly clips: readonly { name: string; seconds: number }[];
  private readonly animator: any;
  private readonly layer: any;
  private readonly slots: ClipSlot[];
  private readonly evaluator: any;
  private readonly mixed = new Map<any, Mixed>();
  private readonly previousSpeed: number;
  private stamp = 0;
  private disposed = false;

  /**
   * @param path the node that carries the animator (`$` is the model's root).
   * @param clips names of the clips to mix, at least one.
   */
  constructor(instance: ModelInstance, path: string, clips: readonly string[], layerIndex = 0) {
    const l = runtime();
    const animator: any = new ZhudaModelInspector(instance).node(path).getComponent(l.Animator);
    if (
      !animator ||
      !Number.isInteger(layerIndex) ||
      layerIndex < 0 ||
      layerIndex >= animator.controllerLayerCount
    )
      throw Error('Animation blend: no animator on that node and layer');
    if (
      !Array.isArray(clips) ||
      !clips.length ||
      clips.length > 32 ||
      new Set(clips).size !== clips.length
    )
      throw Error('Animation blend: 1..32 clips, each named once');
    const layer = animator.getControllerLayer(layerIndex);
    const slots = clips.map((name) => {
      const state = layer.getAnimatorState(name);
      if (!state?.clip) throw Error(`Animation blend: the model has no clip ${name}`);
      const seconds = state.clip.duration() * (state.clipEnd - state.clipStart);
      if (!(seconds > 0)) throw Error(`Animation blend: clip ${name} has no length`);
      const play = new l.AnimatorPlayState();
      const task = new l.LayerTask();
      task.type = l.LayerTaskType.Normal;
      task.state = state;
      task.playState = play;
      task.weight = 1;
      return { name, seconds, state, play, task };
    });
    claimZhudaAnimator(animator);
    for (const slot of slots) l.prepareStateOwners(animator._bindContext, slot.state);
    this.animator = animator;
    this.layer = layer;
    this.slots = slots;
    this.clips = slots.map(({ name, seconds }) => ({ name, seconds }));
    this.evaluator = new l.WebAnimatorEvaluator();
    this.previousSpeed = animator.speed;
    // LayaAir's own playback would pose the bones after this did.
    animator.speed = 0;
  }

  private evaluate(slot: ClipSlot, seconds: number) {
    const time = Math.min(Math.max(seconds, 0), slot.seconds);
    slot.state._currentFrameIndices.fill(-1);
    Object.assign(slot.play, {
      _duration: slot.seconds,
      _normalizedPlayTime: time / slot.seconds,
      _elapsedTime: time,
      _lastElapsedTime: -Infinity,
    });
    this.evaluator.evaluateLayer(slot.task, this.layer);
  }
  private kind(type: number): Mixed['kind'] | null {
    const types = runtime().KeyFrameValueType;
    return type === types.Position
      ? 'position'
      : type === types.Rotation
        ? 'rotation'
        : type === types.Scale
          ? 'scale'
          : type === types.RotationEuler
            ? 'euler'
            : null;
  }
  /** Adds `weight` of a clip's evaluated values into the mix; `inside` limits it to some nodes. */
  private gather(slot: ClipSlot, weight: number, inside?: (owner: any) => boolean) {
    const values = slot.state._realtimeDatas;
    const owners = slot.state._nodeOwners;
    for (let i = 0; i < owners.length; i++) {
      const owner = owners[i];
      if (!owner?.propertyOwner) continue;
      const kind = this.kind(owner.type);
      if (!kind || (inside && !inside(owner))) continue;
      const value = values[i];
      let entry = this.mixed.get(owner);
      if (!entry)
        this.mixed.set(
          owner,
          (entry = { owner, kind, x: 0, y: 0, z: 0, w: 0, weight: 0, stamp: -1 }),
        );
      if (entry.stamp !== this.stamp) {
        entry.stamp = this.stamp;
        entry.x = entry.y = entry.z = entry.w = entry.weight = 0;
      }
      let share = weight;
      // A rotation and its negative are one turn: add them on the same side.
      if (
        kind === 'rotation' &&
        entry.x * value.x + entry.y * value.y + entry.z * value.z + entry.w * value.w < 0
      )
        share = -weight;
      entry.x += value.x * share;
      entry.y += value.y * share;
      entry.z += value.z * share;
      if (kind === 'rotation') entry.w += value.w * share;
      entry.weight += weight;
    }
  }
  /** Writes the mix to the nodes; what a clip left out is made up with the node's own rest value. */
  private write(total: number) {
    for (const entry of this.mixed.values()) {
      if (entry.stamp !== this.stamp) continue;
      const { owner, kind } = entry;
      const target = owner.propertyOwner;
      const rest = owner.defaultValue;
      const missing = Math.max(0, total - entry.weight);
      let { x, y, z, w } = entry;
      if (missing > 1e-9 && rest) {
        const sign =
          kind === 'rotation' && x * rest.x + y * rest.y + z * rest.z + w * rest.w < 0 ? -1 : 1;
        x += rest.x * missing * sign;
        y += rest.y * missing * sign;
        z += rest.z * missing * sign;
        if (kind === 'rotation') w += rest.w * missing * sign;
      }
      if (kind === 'rotation') {
        const length = Math.hypot(x, y, z, w);
        if (!(length > 1e-12)) continue;
        const value = target.localRotation;
        value.x = x / length;
        value.y = y / length;
        value.z = z / length;
        value.w = w / length;
        target.localRotation = value;
        continue;
      }
      const name =
        kind === 'position'
          ? 'localPosition'
          : kind === 'scale'
            ? 'localScale'
            : 'localRotationEuler';
      const value = target[name];
      value.x = x / total;
      value.y = y / total;
      value.z = z / total;
      target[name] = value;
    }
  }
  private alive() {
    if (this.disposed || this.animator.destroyed) throw Error('Disposed animation blend');
  }

  /**
   * Poses the model from every clip at once. `weights` is one number a clip
   * (made to add up to 1). `phase` is where in the round the blend is,
   * 0..1: each clip is read at that share of its own length, so clips of
   * different lengths stay in step. A clip with no weight is not read.
   */
  apply(weights: readonly number[], phase: number): void {
    this.alive();
    if (weights.length !== this.slots.length)
      throw Error('Animation blend: a weight for each clip');
    if (!Number.isFinite(phase)) throw Error('Animation blend: phase must be finite');
    const normal = zhudaNormalizeWeights([...weights]);
    const at = phase - Math.floor(phase);
    this.stamp++;
    this.slots.forEach((slot, i) => {
      if (!(normal[i] > 0)) return;
      this.evaluate(slot, at * slot.seconds);
      this.gather(slot, normal[i]);
    });
    this.write(1);
  }

  /**
   * Lays one clip over the pose the model has now, on the nodes named in
   * `under` and everything below them (an arm, the spine upward), by
   * `weight` 0..1. Call after `apply`. The clip is read at `seconds`.
   */
  overlay(clip: string, seconds: number, weight: number, under: readonly string[]): void {
    this.alive();
    const slot = this.slots.find((candidate) => candidate.name === clip);
    if (!slot) throw Error(`Animation blend: ${clip} is not one of its clips`);
    if (!Number.isFinite(seconds) || seconds < 0) throw Error('Animation blend: seconds 0 or more');
    if (!(weight >= 0 && weight <= 1)) throw Error('Animation blend: weight 0..1');
    if (!Array.isArray(under) || !under.length)
      throw Error('Animation blend: name the nodes it lies over');
    if (weight === 0) return;
    const names = new Set(under);
    const inside = (owner: any) => {
      for (let node = owner.propertyOwner?.owner ?? owner.propertyOwner; node; node = node.parent)
        if (names.has(node.name)) return true;
      return false;
    };
    this.stamp++;
    this.evaluate(
      slot,
      seconds % slot.seconds || (seconds > 0 && seconds % slot.seconds === 0 ? slot.seconds : 0),
    );
    this.gather(slot, weight, inside);
    // The rest of each node is the pose it has now.
    for (const entry of this.mixed.values()) {
      if (entry.stamp !== this.stamp) continue;
      const target = entry.owner.propertyOwner;
      const now =
        entry.kind === 'rotation'
          ? target.localRotation
          : entry.kind === 'position'
            ? target.localPosition
            : entry.kind === 'scale'
              ? target.localScale
              : target.localRotationEuler;
      const rest = 1 - weight;
      const sign =
        entry.kind === 'rotation' &&
        entry.x * now.x + entry.y * now.y + entry.z * now.z + entry.w * now.w < 0
          ? -1
          : 1;
      entry.x += now.x * rest * sign;
      entry.y += now.y * rest * sign;
      entry.z += now.z * rest * sign;
      if (entry.kind === 'rotation') entry.w += now.w * rest * sign;
      entry.weight = 1;
    }
    this.write(1);
  }

  /** Gives the animator back to LayaAir's own playback. The last pose stays until it plays. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    releaseZhudaAnimator(this.animator);
    if (!this.animator.destroyed) this.animator.speed = this.previousSpeed;
  }
}
