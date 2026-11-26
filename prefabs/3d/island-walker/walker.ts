// A character that walks where it is steered, on any island's ground: the world it
// walks on is given (WalkWorld: the ground's height and where it may stand), so the
// same walker goes on the garden island or any other. The engine poses the model
// (ZhudaAnimationBlend): Idle and Walk, with Walk's speed matched to the feet, and
// an act (Wave, Bow, Sit, Talk, Point, ReachLeft, ReachRight, Cheer) laid over Idle
// while it stands, when the model has the clip.
//
//   const walker = new Walker(await models.instantiate(characterPath('zhuda'), { independentMaterials: true }), island, island.start);
//   scene.addChild(walker.root);
//   runtime.start((dt) => walker.update(dt, input.stick(follow.orbit.yaw)));
import { ZhudaAnimationBlend, ZhudaModelInspector, type ModelInstance } from 'zhuda-laya-engine';
import { approach, clamp, type V3 } from '../math.ts';
import { slide, type WalkWorld } from './walk-world.ts';

export type { WalkWorld } from './walk-world.ts';

/** Top walking speed, metres a second. */
export const WALK_SPEED = 3.1;

export class Walker {
  readonly root = new Laya.Sprite3D('walker');
  feet: V3;
  yaw = Math.PI;
  speed = 0;
  private readonly blend: ZhudaAnimationBlend;
  private readonly names: string[];
  private readonly lengths = new Map<string, number>();
  private walkPhase = 0;
  private idleTime = 0;
  private moving = 0;
  /** A place to walk to on its own (for checks and for a tap on the ground). */
  goal: [number, number] | null = null;
  /** A clip to act with while it stands (null: idle). */
  act: string | null = null;
  private actTime = 0;
  private actBlend = 0;
  private lastAct: string | null = null;

  private readonly world: WalkWorld;

  /** `world`: the ground; `start`: x and z to stand at; `size`: the model's scale. The model needs the clips Idle and Walk. */
  constructor(model: ModelInstance, world: WalkWorld, start: readonly [number, number], size = 1) {
    this.world = world;
    this.root.addChild(model.node);
    if (size !== 1) model.node.transform.localScale = new Laya.Vector3(size, size, size);
    const clips = new ZhudaModelInspector(model).inspect().animations;
    const first = clips.find((c) => c.name === 'Idle');
    if (!first || !clips.some((c) => c.name === 'Walk')) throw Error('The character needs the clips Idle and Walk');
    // Idle and Walk first; then the clips it can act with, where the model has them.
    this.names = ['Idle', 'Walk', ...['Wave', 'Bow', 'Sit', 'Talk', 'Point', 'ReachLeft', 'ReachRight', 'Cheer'].filter((name) => clips.some((c) => c.name === name))];
    this.blend = new ZhudaAnimationBlend(model, first.path, this.names, first.layer);
    for (const c of this.blend.clips) this.lengths.set(c.name, c.seconds);
    this.feet = [start[0], world.groundAt(start[0], start[1]) ?? 0, start[1]];
  }

  /** Puts the character at a place at once (x, z), on the ground there. */
  place(x: number, z: number) {
    this.feet = [x, this.world.groundAt(x, z) ?? 0, z];
  }

  /** `stick`: where to go, in the world's x and z, length 0..1 (WalkInput.stick gives it). */
  update(dt: number, stick: readonly [number, number]) {
    let [sx, sz] = stick;
    if (this.goal && Math.hypot(sx, sz) < 0.05) {
      const dx = this.goal[0] - this.feet[0],
        dz = this.goal[1] - this.feet[2];
      const d = Math.hypot(dx, dz);
      if (d < 0.25) this.goal = null;
      else (sx = dx / d), (sz = dz / d);
    } else if (Math.hypot(sx, sz) > 0.05) this.goal = null;
    const push = clamp(Math.hypot(sx, sz), 0, 1);
    this.speed = approach(this.speed, push * WALK_SPEED, 8, dt);
    if (push > 0.05) {
      const want = Math.atan2(sx, sz);
      let turn = want - this.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      this.yaw += turn * (1 - Math.exp(-10 * dt));
      const step = this.speed * dt;
      const nx = this.feet[0] + Math.sin(this.yaw) * step,
        nz = this.feet[2] + Math.cos(this.yaw) * step;
      // Slide along what cannot be walked: try the whole step, then each axis alone.
      const to = slide(this.world, this.feet[0], this.feet[2], nx, nz);
      if (to) (this.feet[0] = to[0]), (this.feet[2] = to[1]);
      else this.speed = 0;
    }
    const ground = this.world.groundAt(this.feet[0], this.feet[2]) ?? 0;
    this.feet[1] = approach(this.feet[1], ground, 14, dt);
    this.moving = approach(this.moving, this.speed > 0.25 ? 1 : 0, 9, dt);
    this.walkPhase = (this.walkPhase + (this.speed * dt) / 1.45) % 1;
    this.idleTime += dt;
    const t = this.root.transform;
    t.position = new Laya.Vector3(this.feet[0], this.feet[1], this.feet[2]);
    t.rotationEuler = new Laya.Vector3(0, (this.yaw * 180) / Math.PI, 0);
    const walking = this.moving > 0.5;
    const idleLength = this.lengths.get('Idle') ?? 1;
    // An act: its clip takes over from Idle while the character stands, and gives way to walking.
    const acting = this.act && this.names.includes(this.act) && !walking ? this.act : null;
    if (acting !== this.lastAct) {
      if (acting) this.actTime = 0;
      this.lastAct = acting ?? this.lastAct;
    }
    this.actBlend = approach(this.actBlend, acting ? 1 : 0, 6, dt);
    if (acting) this.actTime += dt;
    const weights = this.names.map((name) => (name === (walking ? 'Walk' : 'Idle') ? 1 : 0));
    this.blend.apply(weights, walking ? this.walkPhase : (this.idleTime / idleLength) % 1);
    this.blend.overlay(walking ? 'Idle' : 'Walk', walking ? this.idleTime % idleLength : this.walkPhase * (this.lengths.get('Walk') ?? 1), walking ? 1 - this.moving : this.moving, ['root']);
    if (this.lastAct && this.actBlend > 0.01) {
      const length = this.lengths.get(this.lastAct) ?? 1;
      const looped = ['Wave', 'Talk', 'Cheer'].includes(this.lastAct);
      this.blend.overlay(this.lastAct, looped ? this.actTime % length : Math.min(length * 0.999, this.actTime), this.actBlend, ['root']);
    }
  }

  get head(): V3 {
    return [this.feet[0], this.feet[1] + 1.2, this.feet[2]];
  }

  dispose() {
    this.blend.dispose();
    this.root.destroy(true);
  }
}
