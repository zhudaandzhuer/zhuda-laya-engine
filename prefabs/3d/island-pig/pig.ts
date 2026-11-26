// Zhuda or Zhuer on an island: walks about on its own, waves, sits and dozes,
// can be picked up by the scruff, swings from the hand, is thrown, falls, lands,
// swims and shakes itself dry, slides off a roof, falls off the island and drops
// back in, and sings or dances in time when the game asks. The island is given
// (PigWorld, pig-world.ts); the engine only poses the model (ZhudaAnimationBlend).
import { ZhudaAnimationBlend, ZhudaModelInspector, ZhudaSpringBones, runZhudaAfterAnimation, type ModelInstance } from 'zhuda-laya-engine';
import { add, approach, clamp, len, norm, qAxis, qFromTo, qMul, qRotate, qSlerp, scale, sub, toLaya, vec, type Q, type V3 } from '../math.ts';
import { ACTS, BASE_CLIPS, findWay, looped, standable, surfaceAt, wayLength, type Act, type PigClip, type PigOptions, type PigWorld } from './pig-world.ts';

export * from './pig-world.ts';

export type PigState = 'idle' | 'walk' | 'held' | 'fall' | 'slide' | 'land' | 'dizzy' | 'swim' | 'shake' | 'cheer' | 'act';

/** What happens to it, for the game's effects, sounds and words. */
export interface PigEvents {
  grab(at: V3): void;
  land(at: V3, speed: number, onRoof: boolean): void;
  splash(at: V3, speed: number): void;
  drip(at: V3): void;
  shake(at: V3): void;
  stars(head: V3, seconds: number): void;
  lost(at: V3): void;
  respawn(at: V3): void;
  footstep(at: V3, wet: boolean): void;
}

const GRAVITY = 9.8;
const WALK_SPEED = 1.05;
const STRIDE = 0.72; // metres a round of the walk covers

export class Pig {
  readonly root: Laya.Sprite3D;
  /** How dark the island is (0..1): the game sets it, and a character sits and dozes more at night. */
  night = 0;
  state: PigState = 'idle';
  /** Feet, world. */
  feet: V3;
  yaw = 0;
  /** The whole body's turn (tilt and yaw). */
  turn: Q = [0, 0, 0, 1];
  wet = 0;
  private readonly blend: ZhudaAnimationBlend;
  private readonly lengths = new Map<string, number>();
  private clip: PigClip = 'Idle';
  private clipTime = 0;
  private previous: PigClip | null = null;
  private previousTime = 0;
  private fade = 1;
  private stateTime = 0;
  private walkRounds = 0;
  private target: [number, number] | null = null;
  private pause = 1.5;
  // held
  private anchor: V3 = [0, 0, 0];
  private anchorGoal: V3 = [0, 0, 0];
  private anchorVel: V3 = [0, 0, 0];
  private bob: V3 = [0, 0, 0];
  private bobVel: V3 = [0, 0, 0];
  private calm = 0;
  // flight
  private middle: V3 = [0, 0, 0];
  private vel: V3 = [0, 0, 0];
  private spin = 0;
  private spinAxis: V3 = [1, 0, 0];
  private peak = 0;
  // squash: scale along up, with its own spring
  private squash = 1;
  private squashVel = 0;
  private lastStep = 0;
  private dizzyFor = 0;
  private dripClock = 0;
  private readonly rand: () => number;
  private readonly clips: PigClip[];
  /** The redesign's clips this character plays (none with performs: false). */
  readonly acts: Act[];
  private readonly SCRUFF: V3;
  private readonly MIDDLE: V3;
  private readonly HEAD: number;
  private readonly RADIUS: number;
  private readonly HANG: V3;
  private readonly HANG_LENGTH: number;
  private readonly PICK: number[];
  private readonly others: () => V3[];
  private readonly cheerChance: number;
  private readonly respawnInView: boolean;
  // acting: a clip played where it stands, for a while or until told otherwise
  private actClip: Act | null = null;
  private actFor = 0;
  private actFace: (() => number) | null = null;
  private actPhase: (() => number | null) | null = null;
  /** What to do on reaching the walk's end. */
  private after: (() => void) | null = null;
  /** The places still to pass on the way, after the current target. */
  private route: [number, number][] = [];
  /** Where a walk to act ends, and how often the way there has been planned again. */
  private goal: [number, number] | null = null;
  private replans = 0;
  /** What to do once landed from a drop on the way to act. */
  private afterLanding: (() => void) | null = null;
  private fadeSeconds = 0.25;

  /**
   * `model`: a character with the nine core clips (3d/zhuda-characters), instantiated with
   * independent materials. `world`: the island. `rand`: the game's seeded random source.
   * `face()`: where the camera is, for turning to it.
   */
  readonly model: ModelInstance;
  readonly world: PigWorld;
  private readonly events: PigEvents;
  private readonly face: () => V3;

  constructor(model: ModelInstance, world: PigWorld, events: PigEvents, rand: () => number, face: () => V3, options: PigOptions = {}) {
    this.model = model;
    this.world = world;
    this.events = events;
    this.face = face;
    this.rand = rand;
    this.root = new Laya.Sprite3D(options.name ?? 'character-holder');
    const size = options.size ?? 1;
    this.SCRUFF = scale(options.scruff ?? [0, 1.0, -0.12], size);
    this.MIDDLE = scale(options.middle ?? [0, 0.5, 0], size);
    this.HEAD = (options.head ?? 1.2) * size;
    this.RADIUS = (options.radius ?? 0.46) * size;
    this.HANG = norm(sub(this.SCRUFF, this.MIDDLE));
    this.HANG_LENGTH = len(sub(this.SCRUFF, this.MIDDLE));
    this.PICK = options.pickHeights ? options.pickHeights.map((h) => h * size) : [0.2, 0.38, 0.56, 0.74].map((k) => (k * this.HEAD) / 0.95);
    this.others = options.others ?? (() => []);
    this.cheerChance = options.cheerChance ?? 0.12;
    this.respawnInView = options.respawnInView ?? true;
    this.root.addChild(model.node);
    if (size !== 1) model.node.transform.localScale = new Laya.Vector3(size, size, size);
    const clips = new ZhudaModelInspector(model).inspect().animations;
    const first = clips.find((c) => c.name === 'Idle');
    if (!first || !BASE_CLIPS.every((name) => clips.some((c) => c.name === name)))
      throw Error('The character needs the clips ' + BASE_CLIPS.join(', ') + ' (3d/zhuda-characters)');
    this.acts = options.performs === false ? [] : (Object.keys(ACTS) as Act[]).filter((name) => clips.some((c) => c.name === name));
    this.clips = [...BASE_CLIPS, ...this.acts];
    this.blend = new ZhudaAnimationBlend(model, first.path, this.clips, first.layer);
    for (const c of this.blend.clips) this.lengths.set(c.name, c.seconds);
    const [sx, sz] = options.start ?? [0.6, 2.2];
    this.feet = [sx, world.ground(sx, sz) ?? 0, sz];
    this.yaw = options.yaw ?? Math.PI * 0.15;
    this.turn = qAxis([0, 1, 0], this.yaw);
  }

  /** Plays one of the redesign's clips where it stands: for `seconds` (Infinity: until told otherwise), turned to `face()`, in time with `phase()` (0..1 of the clip) when given. */
  act(clip: Act, seconds: number, face?: () => number, phase?: () => number | null) {
    if (!this.acts.includes(clip) || !this.calmState()) return false;
    this.target = null;
    this.after = null;
    this.actClip = clip;
    this.actFor = seconds;
    this.actFace = face ?? null;
    this.actPhase = phase ?? null;
    this.enter('act');
    this.play(clip, 0.3);
    return true;
  }

  /** Walks to (x, z) round whatever is in the way, then acts there; where no way leads (or a long one), it drops in from the sky. */
  goAct(spot: [number, number], clip: Act, seconds: number, face?: () => number, phase?: () => number | null) {
    if (!this.calmState()) return false;
    if (Math.hypot(spot[0] - this.feet[0], spot[1] - this.feet[2]) < 0.3) return this.act(clip, seconds, face, phase);
    const way = this.findWay(spot);
    // No way, or a long one: it comes down from the sky instead (a homepage visitor should not wait).
    if (!way || wayLength([this.feet[0], this.feet[2]], way) > 7) {
      this.dropAt(spot);
      this.afterLanding = () => this.act(clip, seconds, face, phase);
      return true;
    }
    this.goal = spot;
    this.replans = 0;
    this.target = way.shift()!;
    this.route = way;
    this.after = () => this.act(clip, seconds, face, phase);
    this.enter('walk');
    this.play('Walk', 0.3);
    return true;
  }

  private findWay(goal: [number, number]) {
    return findWay((x, z) => this.free(x, z, 0.22, false), [this.feet[0], this.feet[2]], goal, this.world.reach);
  }

  /** Falls from the sky onto (x, z): the way to a place no path reaches. */
  dropAt(spot: [number, number]) {
    this.afterLanding = null;
    this.after = null;
    this.target = null;
    this.route = [];
    this.middle = [spot[0], 12, spot[1]];
    this.vel = [0, -2, 0];
    this.spin = 0;
    this.turn = qAxis([0, 1, 0], this.yaw);
    this.feet = sub(this.middle, qRotate(this.turn, this.MIDDLE));
    this.peak = this.feet[1];
    this.enter('fall');
    this.play('Fall', 0.1);
    this.events.respawn([...this.middle]);
  }

  /** Stops acting (or walking to act) and stands. */
  rest(pause = 1 + this.rand() * 2) {
    this.afterLanding = null;
    if (this.state !== 'act' && !(this.state === 'walk' && this.after)) return;
    this.after = null;
    this.route = [];
    this.target = null;
    this.actClip = null;
    this.enter('idle');
    this.play('Idle', 0.4);
    this.pause = pause;
  }

  /** On its feet and not busy with being thrown about. */
  calmState() {
    return this.state === 'idle' || this.state === 'walk' || this.state === 'cheer' || this.state === 'act';
  }
  /** Coming down from the sky to act. */
  get arriving() {
    return this.afterLanding !== null;
  }
  get acting(): Act | null {
    return this.state === 'act' ? this.actClip : null;
  }
  /** Busy going somewhere to act. */
  get going() {
    return this.state === 'walk' && this.after !== null;
  }

  get head(): V3 {
    return add(this.feet, qRotate(this.turn, [0, this.HEAD, 0]));
  }
  get center(): V3 {
    return add(this.feet, qRotate(this.turn, this.MIDDLE));
  }
  get held() {
    return this.state === 'held';
  }
  /** How hard the hand is moving and swinging it (m/s), and how long it has hung still. */
  get swing() {
    return len(this.anchorVel) + 0.5 * len(this.bobVel);
  }
  get stillFor() {
    return this.calm;
  }
  /** Speed of a throw or fall, m/s. */
  get speed() {
    return len(this.vel);
  }

  /** Distance along a ray to the body, or null: four spheres from the hips to the top of the head. */
  hit(origin: V3, dir: V3): number | null {
    let best: number | null = null;
    const r = this.RADIUS;
    for (const y of this.PICK) {
      const c = add(this.feet, qRotate(this.turn, [0, y, 0]));
      const oc = sub(origin, c);
      const b = oc[0] * dir[0] + oc[1] * dir[1] + oc[2] * dir[2];
      const q = oc[0] * oc[0] + oc[1] * oc[1] + oc[2] * oc[2] - r * r;
      const disc = b * b - q;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && (best === null || t < best)) best = t;
    }
    return best;
  }

  /** The scruff, world: where a hand would take it. */
  get scruff(): V3 {
    return add(this.feet, qRotate(this.turn, this.SCRUFF));
  }

  grab() {
    this.afterLanding = null;
    this.after = null;
    this.route = [];
    this.actClip = null;
    this.anchor = this.scruff;
    this.anchorGoal = [...this.anchor];
    this.anchorVel = [0, 0, 0];
    this.bob = this.center;
    this.bobVel = [0, 0, 0];
    this.calm = 0;
    this.squashVel += 3;
    this.events.grab(this.anchor);
    this.enter('held');
    this.play('Struggle', 0.12);
  }

  /** Where the hand is now (the scruff follows it with a little lag). */
  drag(to: V3) {
    this.anchorGoal = to;
  }

  release() {
    if (this.state !== 'held') return;
    // Thrown with the hand's speed, a little of the swing on top.
    let v = add(scale(this.anchorVel, 0.9), scale(this.bobVel, 0.25));
    const s = len(v);
    if (s > 14) v = scale(v, 14 / s);
    this.vel = v;
    this.middle = [...this.bob];
    this.spin = clamp(s * 1.2, 0, 9) * (this.rand() < 0.5 ? -1 : 1);
    this.spinAxis = s > 0.5 ? norm([v[2], 0, -v[0]]) : [1, 0, 0];
    this.peak = this.feet[1];
    this.enter('fall');
    this.play('Fall', 0.15);
  }

  private enter(state: PigState) {
    this.state = state;
    this.stateTime = 0;
  }

  private play(clip: PigClip, fade = 0.25) {
    if (clip === this.clip) return;
    this.previous = this.clip;
    this.previousTime = this.clipTime;
    this.clip = clip;
    this.clipTime = 0;
    this.fade = fade > 0 ? 0 : 1;
    this.fadeSeconds = fade;
  }

  /** Whether it may stand at a place (on the island, off the pond, clear of things and, unless told not to, of the others). */
  free(x: number, z: number, margin = 0.35, others = true): boolean {
    if (!standable(this.world, x, z, margin)) return false;
    // the others: not into them (one already close may step away)
    if (others && !this.after)
      for (const o of this.others()) {
        const now = Math.hypot(this.feet[0] - o[0], this.feet[2] - o[2]);
        const then = Math.hypot(x - o[0], z - o[2]);
        if (then < 0.75 && then < now) return false;
      }
    return true;
  }

  private pickTarget() {
    for (let i = 0; i < 30; i++) {
      const a = this.rand() * Math.PI * 2,
        r = 1 + this.rand() * 4.5;
      const x = this.feet[0] + Math.cos(a) * r,
        z = this.feet[2] + Math.sin(a) * r;
      if (!this.free(x, z)) continue;
      let clear = true;
      for (let k = 1; k <= 12 && clear; k++) {
        const t = k / 12;
        clear = this.free(this.feet[0] + (x - this.feet[0]) * t, this.feet[2] + (z - this.feet[2]) * t, 0.25);
      }
      if (clear) return (this.target = [x, z]);
    }
    this.target = null;
  }

  update(dt: number, seconds: number) {
    this.stateTime += dt;
    this.clipTime += dt;
    this.wet = Math.max(0, this.wet - dt / 8);
    switch (this.state) {
      case 'idle':
      case 'cheer':
        this.stand(dt);
        this.pause -= dt;
        if (this.state === 'cheer' && this.stateTime > 1.9) this.enter('idle'), this.play('Idle');
        if (this.pause <= 0 && this.state === 'idle') {
          const r = this.rand();
          const toCamera = () => {
            const e = this.face();
            return Math.atan2(e[0] - this.feet[0], e[2] - this.feet[2]);
          };
          // At night it sits and dozes more; by day it waves at whoever is looking now and then.
          if (this.night > 0.6 && r < 0.4 && this.acts.includes('Sleep')) this.act(this.rand() < 0.5 ? 'Sit' : 'Sleep', 10 + this.rand() * 14);
          else if (r < this.cheerChance) {
            this.enter('cheer');
            this.play('Cheer', 0.2);
            this.pause = 2.5 + this.rand() * 3;
          } else if (r < 0.22 && this.acts.includes('Wave')) this.act('Wave', (this.lengths.get('Wave') ?? 1) * 2, toCamera);
          else if (r < 0.3 && this.acts.includes('Sit')) this.act('Sit', 6 + this.rand() * 8);
          else {
            this.pickTarget();
            if (this.target) this.enter('walk'), this.play('Walk', 0.3);
            else this.pause = 1;
          }
        }
        break;
      case 'walk':
        this.walk(dt);
        break;
      case 'act':
        this.stand(dt);
        if (this.actFace) this.yaw = this.yaw + (((this.actFace() - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * (1 - Math.exp(-5 * dt));
        if (this.state === 'act' && this.stateTime > this.actFor) {
          this.actClip = null;
          this.enter('idle');
          this.play('Idle', 0.4);
          this.pause = 1 + this.rand() * 2.5;
        }
        break;
      case 'held':
        this.hang(dt, seconds);
        break;
      case 'fall':
        this.fly(dt);
        break;
      case 'slide':
        this.slide(dt);
        break;
      case 'land':
        this.stand(dt);
        if (this.stateTime > (this.lengths.get('Land') ?? 1) * 0.92) {
          if (this.dizzyFor > 0) this.enter('dizzy'), this.play('Dizzy', 0.3);
          else if (this.wet > 0.5) this.enter('shake'), this.play('Shake', 0.2);
          else if (this.afterLanding) {
            const after = this.afterLanding;
            this.afterLanding = null;
            this.enter('idle');
            after();
          } else this.enter('idle'), this.play('Idle', 0.35), (this.pause = 1 + this.rand() * 2);
        }
        break;
      case 'dizzy':
        this.stand(dt);
        this.dizzyFor -= dt;
        if (Math.floor((this.stateTime - dt) * 3) !== Math.floor(this.stateTime * 3)) this.events.stars(this.head, 0.4);
        if (this.dizzyFor <= 0) this.enter('idle'), this.play('Idle', 0.5), (this.pause = 0.8);
        break;
      case 'swim':
        this.swim(dt, seconds);
        break;
      case 'shake':
        this.stand(dt);
        if (this.stateTime > 0.3 && this.stateTime < 1.3 && Math.floor((this.stateTime - dt) * 8) !== Math.floor(this.stateTime * 8)) this.events.shake(this.center);
        if (this.stateTime > (this.lengths.get('Shake') ?? 1.4)) {
          this.wet = 0;
          this.enter('cheer');
          this.play('Cheer', 0.2);
          this.pause = 3;
        }
        break;
    }
    // Dripping while wet.
    if (this.wet > 0.05 && this.state !== 'swim') {
      this.dripClock -= dt * (2 + 10 * this.wet);
      if (this.dripClock <= 0) (this.dripClock = 1), this.events.drip(add(this.feet, qRotate(this.turn, [(this.rand() - 0.5) * 0.5, 0.2 + this.rand() * 0.6, (this.rand() - 0.5) * 0.4])));
    }
    // Squash and stretch: a damped spring about 1, stretched along a fall.
    const stretchGoal = this.state === 'fall' ? 1 + clamp(Math.abs(this.vel[1]) * 0.012, 0, 0.12) : 1;
    this.squashVel += ((stretchGoal - this.squash) * 160 - this.squashVel * 11) * dt;
    this.squash += this.squashVel * dt;
    this.pose(dt);
  }

  private stand(dt: number) {
    const y = this.world.ground(this.feet[0], this.feet[2]);
    if (y === null) {
      this.middle = this.center;
      this.vel = [0, 0, 0];
      this.peak = this.feet[1];
      this.enter('fall');
      this.play('Fall');
      return;
    }
    this.feet[1] = approach(this.feet[1], y, 20, dt);
    this.turn = qSlerp(this.turn, qAxis([0, 1, 0], this.yaw), 1 - Math.exp(-8 * dt));
  }

  private walk(dt: number) {
    if (!this.target) return void (this.enter('idle'), this.play('Idle'));
    const [tx, tz] = this.target;
    const dx = tx - this.feet[0],
      dz = tz - this.feet[2];
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const turn = ((want - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.yaw += clamp(turn, -3.5 * dt, 3.5 * dt);
    const facing = Math.cos(turn);
    // Going somewhere to act it hurries; the walk cycle keeps up with the ground covered.
    const step = WALK_SPEED * (this.after ? 1.7 : 1) * dt * clamp(facing, 0.15, 1);
    const nx = this.feet[0] + Math.sin(this.yaw) * step,
      nz = this.feet[2] + Math.cos(this.yaw) * step;
    if (!this.free(nx, nz, 0.2, !this.after) || this.stateTime > (this.after ? 25 : 12)) {
      // Snagged on a corner on the way to act: plan again once, then come down from the sky.
      if (this.after && this.goal) {
        const goal = this.goal;
        const way = this.replans++ < 1 ? this.findWay(goal) : null;
        if (way) return void ((this.target = way.shift()!), (this.route = way));
        const after = this.after;
        this.dropAt(goal);
        this.afterLanding = after;
        return;
      }
      this.target = null;
      this.route = [];
      const after = this.after;
      this.after = null;
      if (after) return void after();
      this.enter('idle');
      this.play('Idle', 0.3);
      this.pause = 0.6 + this.rand();
      return;
    }
    this.feet[0] = nx;
    this.feet[2] = nz;
    this.walkRounds += step / STRIDE;
    if (Math.floor(this.walkRounds * 2) !== this.lastStep) {
      this.lastStep = Math.floor(this.walkRounds * 2);
      this.events.footstep([...this.feet], this.wet > 0.2);
    }
    this.stand(dt);
    if (d < 0.25 && this.route.length) {
      this.target = this.route.shift()!;
      return;
    }
    if (d < 0.25) {
      this.target = null;
      const after = this.after;
      this.after = null;
      if (after) return void after();
      this.enter('idle');
      this.play('Idle', 0.35);
      this.pause = 1.5 + this.rand() * 3.5;
    }
  }

  private hang(dt: number, seconds: number) {
    // The scruff follows the hand closely; its speed is what a throw takes.
    const before = this.anchor;
    const k = 1 - Math.exp(-28 * dt);
    this.anchor = add(this.anchor, scale(sub(this.anchorGoal, this.anchor), k));
    const v = scale(sub(this.anchor, before), 1 / Math.max(dt, 1e-4));
    this.anchorVel = add(scale(this.anchorVel, 0.6), scale(v, 0.4));
    // The body hangs below and swings (a pendulum, by positions, in steps).
    const steps = 4,
      h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const prev = this.bob;
      this.bobVel[1] -= GRAVITY * h;
      const damp = Math.exp(-1.6 * h);
      this.bobVel = scale(this.bobVel, damp);
      let b = add(this.bob, scale(this.bobVel, h));
      b = add(this.anchor, scale(norm(sub(b, this.anchor)), this.HANG_LENGTH));
      this.bobVel = scale(sub(b, prev), 1 / h);
      this.bob = b;
    }
    // Faces the camera while held, so its face shows; twists a little.
    const eye = this.face();
    const toward = Math.atan2(eye[0] - this.anchor[0], eye[2] - this.anchor[2]);
    const turn = ((toward - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.yaw += turn * (1 - Math.exp(-3 * dt)) + Math.sin(seconds * 2.3) * 0.4 * dt;
    const yawQ = qAxis([0, 1, 0], this.yaw);
    const down = norm(sub(this.anchor, this.bob));
    this.turn = qMul(qFromTo(qRotate(yawQ, this.HANG), down), yawQ);
    this.feet = sub(this.anchor, qRotate(this.turn, this.SCRUFF));
    // Struggles while moved or swung, gives up and dangles when left still, starts again when shaken.
    const motion = len(this.anchorVel) + 0.5 * len(this.bobVel);
    this.calm = motion < 0.6 ? this.calm + dt : Math.max(0, this.calm - dt * 4);
    if (this.calm > 1.6 && this.clip === 'Struggle') this.play('Dangle', 0.6);
    if (this.calm < 0.2 && this.clip === 'Dangle') this.play('Struggle', 0.2);
  }

  private fly(dt: number) {
    this.vel[1] -= GRAVITY * dt;
    this.vel = scale(this.vel, Math.exp(-0.15 * dt));
    this.middle = add(this.middle, scale(this.vel, dt));
    // Turns over while it flies and rights itself as it comes down.
    this.spin *= Math.exp(-1.2 * dt);
    const upright = qAxis([0, 1, 0], this.yaw);
    const tumble = qAxis(this.spinAxis, this.spin * dt);
    this.turn = qSlerp(qMul(tumble, this.turn), upright, 1 - Math.exp(-(this.vel[1] < 0 ? 3.5 : 1.2) * dt));
    this.feet = sub(this.middle, qRotate(this.turn, this.MIDDLE));
    this.peak = Math.max(this.peak, this.feet[1]);
    // Off the island: gone (into the clouds), then dropped back from the sky.
    if (this.feet[1] < this.world.lostBelow) {
      this.events.lost([...this.feet]);
      this.respawn();
      return;
    }
    const [x, , z] = this.feet;
    // The pond.
    const pond = this.world.pond;
    if (pond) {
      const inPond = pond.distance(x, z);
      const ground = this.world.ground(x, z);
      if (inPond < 1.0 && ground !== null && ground < pond.waterY && this.feet[1] < pond.waterY - 0.35) {
        this.events.splash([x, pond.waterY, z], Math.abs(this.vel[1]) + len([this.vel[0], 0, this.vel[2]]) * 0.4);
        this.feet[1] = pond.waterY - 0.6;
        this.vel = [this.vel[0] * 0.2, 0, this.vel[2] * 0.2];
        this.turn = qAxis([0, 1, 0], this.yaw);
        this.wet = 1;
        this.enter('swim');
        this.play('Walk', 0.2);
        return;
      }
    }
    const surface = surfaceAt(this.world, x, z);
    if (surface && this.feet[1] <= surface.y && this.vel[1] <= 0) {
      const fallen = this.peak - surface.y;
      this.feet[1] = surface.y;
      const speed = -this.vel[1];
      this.squashVel -= clamp(speed * 1.6, 0, 12);
      this.events.land([x, surface.y, z], speed, surface.roof);
      const roof = this.world.roof;
      if (surface.roof && roof && roof.at(x, z) !== null) {
        this.enter('slide');
        this.play('Fall', 0.1);
        this.vel = [Math.sign(x - roof.ridgeX || 1) * 1.2, 0, this.vel[2] * 0.3];
        return;
      }
      if (surface.roof) {
        // a cap: bounced off
        const cap = surface.cap ?? { x, z };
        this.vel = [(x - cap.x) * 3, 3, (z - cap.z) * 3];
        return;
      }
      this.vel = [0, 0, 0];
      this.turn = qAxis([0, 1, 0], this.yaw);
      // Off the walkable top (on the rim): step back in.
      if (this.world.inside(x, z) < 0.6) {
        const r = Math.hypot(x, z) || 1;
        const k = Math.max(0, r + this.world.inside(x, z) - 0.8) / r;
        this.feet[0] = x * k;
        this.feet[2] = z * k;
      }
      // Dropped onto its place for a show it lands on its feet, not dizzy.
      this.dizzyFor = fallen > 3.2 && !this.afterLanding ? 3.2 : 0;
      this.enter('land');
      this.play('Land', 0.06);
    }
  }

  private slide(dt: number) {
    // Down the roof's slope, away from the ridge, faster and faster; off the eave it falls.
    const ridge = this.world.roof!;
    const side = Math.sign(this.feet[0] - ridge.ridgeX) || 1;
    this.vel[0] += side * 5 * dt;
    this.feet[0] += this.vel[0] * dt;
    this.feet[2] += this.vel[2] * dt;
    const roof = ridge.at(this.feet[0], this.feet[2]);
    this.yaw = approach(this.yaw, (side * Math.PI) / 2, 4, dt);
    const tilt = qAxis([0, 0, 1], -side * 0.5);
    this.turn = qSlerp(this.turn, qMul(tilt, qAxis([0, 1, 0], this.yaw)), 1 - Math.exp(-8 * dt));
    if (roof === null) {
      this.middle = this.center;
      this.vel = [this.vel[0], 1.2, this.vel[2]];
      this.peak = this.feet[1];
      this.spin = 4 * side;
      this.spinAxis = [0, 0, 1];
      this.enter('fall');
      return;
    }
    this.feet[1] = roof;
  }

  private swim(dt: number, seconds: number) {
    // Paddles to the nearest shore, away from the pond's middle, bobbing.
    const pond = this.world.pond!;
    const [cx, cz] = pond.center;
    let dx = this.feet[0] - cx,
      dz = this.feet[2] - cz;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    const want = Math.atan2(dx, dz);
    const turn = ((want - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.yaw += clamp(turn, -2.5 * dt, 2.5 * dt);
    const speed = this.stateTime < 0.6 ? 0 : 0.65;
    this.feet[0] += Math.sin(this.yaw) * speed * dt;
    this.feet[2] += Math.cos(this.yaw) * speed * dt;
    const ground = this.world.ground(this.feet[0], this.feet[2]) ?? pond.waterY;
    const float = pond.waterY - 0.62 + 0.03 * Math.sin(seconds * 5);
    this.feet[1] = approach(this.feet[1], Math.max(float, ground), 6, dt);
    this.walkRounds += dt * 2.2;
    if (Math.floor(this.walkRounds) !== this.lastStep) {
      this.lastStep = Math.floor(this.walkRounds);
      this.events.splash([this.feet[0] + Math.sin(this.yaw) * 0.3, pond.waterY, this.feet[2] + Math.cos(this.yaw) * 0.3], 0.6);
    }
    this.turn = qSlerp(this.turn, qMul(qAxis([1, 0, 0], 0), qAxis([0, 1, 0], this.yaw)), 1 - Math.exp(-6 * dt));
    if (ground > pond.waterY + 0.02 && pond.distance(this.feet[0], this.feet[2]) > 1.05) {
      this.wet = 1;
      this.enter('shake');
      this.play('Shake', 0.25);
    }
  }

  /** Drops back in from the sky (after a fall off the island, or when the game asks). */
  respawn() {
    const span = this.world.respawnSpan,
      height = this.world.respawnHeight;
    if (this.respawnInView) {
      // Back down on the side the camera sees, not behind the house or the tree.
      const eye = this.face();
      const el = Math.hypot(eye[0], eye[2]) || 1;
      const toward = [eye[0] / el, eye[2] / el];
      let fallback: V3 | null = null;
      for (let i = 0; i < 80; i++) {
        const x = (this.rand() - 0.5) * span,
          z = (this.rand() - 0.5) * span;
        if (!this.free(x, z, 0.6)) continue;
        fallback ??= [x, height, z];
        if (x * toward[0] + z * toward[1] < 0.5) continue;
        fallback = [x, height, z];
        break;
      }
      if (fallback) this.middle = fallback;
    } else
      for (let i = 0; i < 40; i++) {
        const x = (this.rand() - 0.5) * span,
          z = (this.rand() - 0.5) * span;
        if (!this.free(x, z, 0.6)) continue;
        this.middle = [x, height, z];
        break;
      }
    this.vel = [0, -2, 0];
    this.spin = 2;
    this.spinAxis = [1, 0, 0];
    this.turn = qAxis([0, 1, 0], this.yaw);
    this.feet = sub(this.middle, qRotate(this.turn, this.MIDDLE));
    this.peak = this.feet[1];
    this.enter('fall');
    this.play('Fall', 0);
    this.events.respawn([...this.middle]);
  }

  /** Writes the pose: where the body is, its turn and squash, and the mixed clips. */
  private pose(dt: number) {
    const t = this.root.transform;
    t.position = vec(this.feet);
    t.rotation = toLaya(this.turn);
    const s = clamp(this.squash, 0.6, 1.4);
    const w = 1 / Math.sqrt(s);
    t.localScale = new Laya.Vector3(w, s, w);
    const length = this.lengths.get(this.clip) ?? 1;
    const outside = this.state === 'act' && this.actPhase ? this.actPhase() : null;
    const phase =
      outside !== null ? ((outside % 1) + 1) % 1 : this.clip === 'Walk' ? this.walkRounds % 1 : looped(this.clip) ? (this.clipTime / length) % 1 : Math.min(0.999, this.clipTime / length);
    const weights = this.clips.map((name) => (name === this.clip ? 1 : 0));
    this.blend.apply(weights, phase);
    if (this.previous && this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / Math.max(0.01, this.fadeSeconds));
      this.previousTime += dt;
      const plen = this.lengths.get(this.previous) ?? 1;
      const pt = looped(this.previous) ? this.previousTime % plen : Math.min(plen * 0.999, this.previousTime);
      this.blend.overlay(this.previous, pt, 1 - this.fade * this.fade * (3 - 2 * this.fade), ['root']);
    }
  }

  dispose() {
    this.blend.dispose();
    this.root.destroy(false);
  }
}

/**
 * Spring bones for the ears and the tail (bones ear.L → ear.L.tip, ear.R → ear.R.tip,
 * tail → tail.tip, which every 3d/zhuda-characters model has). They run after the
 * animation each frame; `dt()` is the frame's time step.
 */
export function earAndTailSprings(model: ModelInstance, dt: () => number) {
  const bone = (name: string) => model.find(name);
  const springs = new ZhudaSpringBones({
    chains: [
      { nodes: [bone('ear.L'), bone('ear.L.tip')], stiffness: 7, drag: 3.5, radius: 0.03 },
      { nodes: [bone('ear.R'), bone('ear.R.tip')], stiffness: 7, drag: 3.5, radius: 0.03 },
      { nodes: [bone('tail'), bone('tail.tip')], stiffness: 14, drag: 4, radius: 0.02 },
    ].filter((c) => c.nodes.every(Boolean)),
  });
  const stop = runZhudaAfterAnimation(model.node, () => springs.update(dt()));
  return {
    springs,
    dispose() {
      stop();
      springs.dispose();
    },
  };
}
