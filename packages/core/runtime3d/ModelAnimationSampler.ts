import type { ModelInstance } from "./Assets.ts";
import { ZhudaModelInspector } from "./ModelInspector.ts";

// Version-pinned LayaAir 3.4.2 bridge. Native evaluators retain all interpolation,
// quaternion, skin/morph and property bindings. No state-machine tick or events.
type NativeState = Laya.AnimatorState & { _currentFrameIndices: Int16Array };
type NativePlay = Laya.AnimatorPlayState & {
  _duration: number;
  _normalizedPlayTime: number;
  _elapsedTime: number;
  _lastElapsedTime: number;
};
const owners = new WeakSet<Laya.Animator>();
export class ZhudaModelAnimationSampler {
  readonly durationSeconds: number;
  private readonly animator: Laya.Animator;
  private readonly layer: Laya.AnimatorControllerLayer;
  private readonly state: NativeState;
  private readonly evaluator: Laya.WebAnimatorEvaluator;
  private readonly applier: Laya.WebAnimatorApplier;
  private readonly play: NativePlay;
  private readonly task: Laya.LayerTask;
  private readonly previousSpeed: number;
  private mark = 0;
  private disposed = false;
  constructor(
    instance: ModelInstance,
    path: string,
    name: string,
    layerIndex = 0,
  ) {
    const l = (globalThis as unknown as { Laya: typeof Laya }).Laya;
    const animator = new ZhudaModelInspector(instance)
      .node(path)
      .getComponent(l.Animator);
    if (
      !animator ||
      !Number.isInteger(layerIndex) ||
      layerIndex < 0 ||
      layerIndex >= animator.controllerLayerCount ||
      owners.has(animator)
    )
      throw Error("Missing or owned animation sampler target");
    const layer = animator.getControllerLayer(layerIndex),
      state = layer.getAnimatorState(name) as NativeState;
    if (
      !state?.clip ||
      layer.blendingMode !== l.AnimatorControllerLayer.BLENDINGMODE_OVERRIDE
    )
      throw Error("Sampling requires a named override animation");
    const duration = state.clip.duration() * (state.clipEnd - state.clipStart);
    if (!Number.isFinite(duration) || duration <= 0)
      throw Error("Invalid animation duration");
    const native = animator as unknown as {
      _bindContext: Laya.AnimatorBindContext;
    };
    l.prepareStateOwners(native._bindContext, state);
    this.animator = animator;
    this.layer = layer;
    this.state = state;
    this.durationSeconds = duration;
    this.evaluator = new l.WebAnimatorEvaluator();
    this.applier = new l.WebAnimatorApplier();
    this.play = new l.AnimatorPlayState() as NativePlay;
    this.task = new l.LayerTask();
    this.task.type = l.LayerTaskType.Normal;
    this.task.state = state;
    this.task.playState = this.play;
    this.task.weight = 1;
    this.previousSpeed = animator.speed;
    animator.speed = 0;
    owners.add(animator);
  }
  /** Absolute clip-local seconds. Clamps by default; explicit loop wraps endpoint. */
  sample(seconds: number, loop = false): void {
    if (this.disposed || this.animator.destroyed)
      throw Error("Disposed animation sampler");
    if (!Number.isFinite(seconds) || seconds < 0 || typeof loop !== "boolean")
      throw Error("Invalid animation sample time");
    const time = loop
      ? seconds % this.durationSeconds
      : Math.min(seconds, this.durationSeconds);
    this.state._currentFrameIndices.fill(-1);
    Object.assign(this.play, {
      _duration: this.durationSeconds,
      _normalizedPlayTime: time / this.durationSeconds,
      _elapsedTime: time,
      _lastElapsedTime: -Infinity,
    });
    this.evaluator.evaluateLayer(this.task, this.layer);
    this.applier.applyNormal(this.task, this.layer, true, --this.mark);
  }
  /** Restore native playback speed. The last sampled pose remains until next tick. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    owners.delete(this.animator);
    if (!this.animator.destroyed) this.animator.speed = this.previousSpeed;
  }
}
