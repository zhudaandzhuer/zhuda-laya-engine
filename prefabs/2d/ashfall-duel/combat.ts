/**
 * 「灰燼之庭」 duel rules: modes (title demo, duel, paused, victory, defeat), the warden's
 * behaviour (approach, wind-up, gauntlet bash, stagger, knock-back), light and charged
 * cuts on the engine's frame-data state machine, input buffering, stamina, the 0.32 s
 * input window, damage, hit-stop, the dent spring and the backstep. Advance it with
 * step(dt) at a fixed 1/120 s; read `view` to draw and drain `events` for dust and sound.
 * Uses the engine's ZhudaActionStateMachine and ZhudaInputBuffer (values), nothing that draws.
 */
import {
  ZhudaActionStateMachine,
  ZhudaInputBuffer,
  type ZhudaActionFrameSpec,
} from "zhuda-laya-engine";
import { Footwork, PoseTrack } from "../cel-motion/cel-motion.ts";
import { CELS } from "./motion-cels.ts";
import {
  BASH_POSES,
  BLADE_LENGTH,
  CHARGED_POSES,
  FLOOR,
  KNIGHT,
  KNIGHT_SCALE,
  RAD,
  STAGGER_POSES,
  SWING_POSES,
  WARDEN,
  WARDEN_SCALE,
  FlexibleBlade,
  clamp,
  curve,
  fixed,
  intersectsPlate,
  mix,
  pin,
  plantBlade,
  poseAt,
  smooth,
  wardenSurface,
  type Blade,
  type Point,
  type Pose,
} from "./motion.ts";

export type Mode = "title" | "duel" | "paused" | "victory" | "defeat";
export type EventKind = "impact" | "hurt" | "step" | "swing" | "evade";
export interface CombatEvent extends Point {
  kind: EventKind;
  strength: number;
}
export interface Actor {
  x: number;
  y: number;
  pose: Pose;
}
export interface Dent extends Point {
  displacement: number;
}
export interface View {
  knight: Actor;
  warden: Actor;
  blade: Blade;
  dent: Dent;
  shake: number;
}

const spec = (
  id: string,
  count: number,
  from: number,
  until: number
): ZhudaActionFrameSpec => ({
  id,
  frameRate: 60,
  frameCount: count,
  startup: { from: 0, until: from },
  active: { from, until },
  recovery: { from: until, until: count },
  events: [{ id: "release", frame: from }],
  cancelWindows: [
    { from: until - 1, until: count, actions: ["evade"] },
    { from: Math.ceil(count * 0.7), until: count, actions: ["cut"] },
  ],
});

const lightSpec = spec("cut", 30, 7, 19);
const heavySpec = spec("charged-cut", 48, 13, 32);
const bashSpec = spec("bash", 72, 39, 49);
const dodgeSpec = spec("evade", 30, 3, 20);

function drivePulse(time: number, start: number, end: number): number {
  return Math.sin(Math.PI * clamp((time - start) / (end - start), 0, 1)) ** 2;
}

export class Duel {
  mode: Mode = "title";
  heroHp = 100;
  foeHp = 100;
  stamina = 100;
  time = 0;
  elapsed = 0;
  direction = 0;
  hold = false;
  charge = 0;
  aim = 0;
  hits = 0;
  lastDamage = 0;
  outcomeTime = 0;
  wardAction = "guard";
  readonly events: CombatEvent[] = [];
  readonly input = new ZhudaInputBuffer({ window: 0.32, capacity: 2 });
  readonly steel = new FlexibleBlade();
  view!: View;

  private heroX = 404;
  private foeX = 855;
  private heroFeet = new Footwork(1, 156, 215);
  private foeFeet = new Footwork(-1, 132, 109);
  private knightTrack = new PoseTrack(KNIGHT, CELS.knight.edges, KNIGHT_SCALE);
  private wardenTrack = new PoseTrack(WARDEN, CELS.warden.edges, WARDEN_SCALE);
  private attackSerial = 0;
  private attackGroup = "cut";
  private heldAim = 0;
  private swingStartAngle = -48;
  private plantedBoot: number | undefined;
  private attacks = {
    cut: new ZhudaActionStateMachine(lightSpec),
    charged: new ZhudaActionStateMachine(heavySpec),
  };
  private attack: ZhudaActionStateMachine | null = null;
  private bash = new ZhudaActionStateMachine(bashSpec);
  private dodge = new ZhudaActionStateMachine(dodgeSpec);
  private power = 0;
  private swingPoses = SWING_POSES;
  private queuedPower = 0;
  private queuedAim = 0;
  private usedStrike = false;
  private usedBash = false;
  private chargeAtStart = 0;
  private foeStun = 0;
  private stunLength = 0.54;
  private heroStun = 0;
  private cooldown = 1.1;
  private knockback = 0;
  private freeze = 0;
  private dentPosition = 0;
  private dentVelocity = 0;
  private hitAim = 0;
  private hitOffset: Point = { x: 0, y: 0 };
  private shake = 0;
  private regenDelay = 0;
  private titleTime = 0;

  constructor() {
    this.reset();
    this.mode = "title";
  }

  private emit(kind: EventKind, point: Point, strength: number): void {
    this.events.push({ kind, ...point, strength });
  }

  private advanceDemo(dt: number): void {
    // Attract mode queues a real swing and uses the same collision and spring as player input.
    const previous = this.titleTime;
    this.titleTime = (this.titleTime + dt) % 4.6;
    if (previous < 0.95 && this.titleTime >= 0.95) {
      this.hold = true;
      this.charge = 0;
      this.heldAim = 0.04;
    }
    if (previous < 1.53 && this.titleTime >= 1.53) this.queueStrike();
  }

  reset(): void {
    this.clearInputs();
    this.mode = "duel";
    this.heroHp = this.foeHp = this.stamina = 100;
    this.time =
      this.elapsed =
      this.hits =
      this.lastDamage =
      this.outcomeTime =
        0;
    this.heroX = 397;
    this.foeX = 882;
    this.heroFeet.reset();
    this.foeFeet.reset();
    this.knightTrack.reset();
    this.wardenTrack.reset();
    this.usedStrike = this.usedBash = false;
    this.plantedBoot = undefined;
    this.titleTime = 0;
    this.attack = null;
    this.bash.reset();
    this.dodge.reset();
    this.foeStun =
      this.heroStun =
      this.freeze =
      this.knockback =
      this.shake =
        0;
    this.dentPosition =
      this.dentVelocity =
      this.power =
      this.aim =
      this.hitAim =
        0;
    this.hitOffset = { x: 0, y: 0 };
    this.cooldown = 1.15;
    this.regenDelay = 0;
    this.wardAction = "guard";
    this.steel.reset();
    this.events.length = 0;
    this.view = this.combatView(0);
  }

  clearInputs(): void {
    this.direction = 0;
    this.hold = false;
    this.charge = 0;
    this.input.clear();
  }

  pause(): void {
    if (this.mode === "duel") {
      this.mode = "paused";
      this.clearInputs();
    } else if (this.mode === "paused") this.mode = "duel";
  }

  setAim(point?: Point): void {
    if (!point) {
      this.heldAim = 0;
      return;
    }
    const { warden } = this.view;
    const middle = wardenSurface(warden.pose, warden.x, warden.y, 0);
    this.heldAim =
      Math.abs(point.x - middle.x) < 150
        ? clamp((point.y - middle.y) / 72, -1, 1)
        : 0;
  }

  press(point?: Point): void {
    if (this.mode === "title") this.reset();
    if (this.mode !== "duel" || this.hold) return;
    this.setAim(point);
    this.hold = true;
    this.charge = 0;
  }

  release(point?: Point): void {
    if (this.mode !== "duel" || !this.hold) return;
    if (point) this.setAim(point);
    this.queueStrike();
  }

  cancelCharge(): void {
    this.hold = false;
    this.charge = 0;
  }

  private queueStrike(): void {
    this.input.consume("cut", this.time);
    this.queuedAim = this.heldAim;
    this.queuedPower = clamp((this.charge - 0.17) / 0.58, 0, 1);
    this.chargeAtStart = this.charge;
    this.input.push("cut", this.time);
    this.hold = false;
    this.charge = 0;
  }

  evade(): void {
    if (this.mode === "duel") {
      this.input.consume("evade", this.time);
      this.input.push("evade", this.time);
    }
  }

  private beginActions(): void {
    if (this.heroStun > 0 || this.dodge.isPlaying) return;
    if (
      (!this.attack || this.attack.canCancelInto("evade")) &&
      this.stamina >= 19 &&
      this.input.consume("evade", this.time)
    ) {
      this.attack = null;
      this.hold = false;
      this.charge = 0;
      this.stamina -= 19;
      this.regenDelay = 0.42;
      this.input.consume("cut", this.time);
      this.dodge.play();
      this.emit("evade", { x: this.heroX, y: FLOOR }, 0.7);
      return;
    }
    if (
      (this.attack && !this.attack.canCancelInto("cut")) ||
      !this.input.has("cut", this.time)
    )
      return;
    const cost = 14 + this.queuedPower * 15;
    if (this.stamina < cost) return;
    this.input.consume("cut", this.time);
    this.power = this.queuedPower;
    this.aim = this.queuedAim;
    this.stamina -= cost;
    this.regenDelay = 0.44;
    this.attack =
      this.chargeAtStart >= 0.34 ? this.attacks.charged : this.attacks.cut;
    this.attackGroup = "cut" + ++this.attackSerial;
    this.swingStartAngle = this.steel.angle / RAD;
    const charged = this.attack === this.attacks.charged;
    this.swingPoses = charged ? CHARGED_POSES : SWING_POSES;
    if (this.foeX - this.heroX < 355) {
      this.swingPoses = charged
        ? [
            [0, 3],
            [0.1, 3],
            [0.43, 4],
            [0.6, 4],
            [0.78, 6],
            [1, 0],
          ]
        : [
            [0, 0],
            [0.13, 0],
            [0.44, 4],
            [0.61, 4],
            [0.78, 6],
            [1, 0],
          ];
    }
    this.attack.play();
    this.usedStrike = false;
  }

  private advanceActors(dt: number): void {
    const preview = this.mode === "title";
    const heroStart = this.heroX,
      foeStart = this.foeX;
    let heroMotion = 0,
      foeMotion = 0,
      heroWalk = 0,
      foeWalk = 0;
    const gap = this.foeX - this.heroX;
    if (this.heroStun > 0) heroMotion = -105;
    else if (this.dodge.isPlaying) {
      heroMotion = -562 * Math.sin(this.dodge.normalizedTime * Math.PI);
    } else if (this.attack) {
      const phase = this.attack.normalizedTime;
      heroWalk =
        this.direction *
        215 *
        (0.12 + 0.88 * smooth(clamp((phase - 0.55) / 0.32, 0, 1)));
      const lunge = drivePulse(phase, 0.19, 0.61);
      if (!preview)
        heroMotion =
          (150 + 80 * this.power) *
          lunge *
          smooth(clamp((gap - 294) / 52, 0, 1));
    } else {
      heroWalk = this.direction * (this.hold ? 78 : 215);
    }
    if (this.foeStun > 0) {
      foeMotion = this.knockback;
      this.knockback *= Math.exp(-7 * dt);
    } else if (this.bash.isPlaying) {
      foeMotion = -465 * drivePulse(this.bash.normalizedTime, 0.3, 0.72);
    } else if (preview) {
      foeWalk = clamp((431 - gap) * 2.3, -109, 92);
    } else {
      this.cooldown -= dt;
      if (gap > 320 || gap < 279)
        foeWalk = gap < 279 ? 92 : gap > 460 ? -109 : -80;
      if (gap < 323 && this.cooldown <= 0) {
        this.bash.play();
        this.usedBash = false;
        foeWalk = 0;
      }
    }
    const heroTravel = this.heroFeet.move(heroWalk, dt);
    const foeTravel = this.foeFeet.move(foeWalk, dt);
    this.foeX = clamp(foeStart + foeTravel + foeMotion * dt, 322, 1154);
    this.heroX = clamp(
      heroStart + heroTravel + heroMotion * dt,
      137,
      this.foeX - 201
    );
    this.foeX = Math.max(this.foeX, this.heroX + 201);
    // An action impulse or the arena edge must not rotate a walking foot through the ground.
    const walked = (actual: number, wanted: number) =>
      Math.sign(wanted) *
      clamp(actual * Math.sign(wanted), 0, Math.abs(wanted));
    this.plantedBoot = this.heroFeet.travel(
      walked(this.heroX - heroStart, heroTravel),
      dt
    );
    this.foeFeet.travel(walked(this.foeX - foeStart, foeTravel), dt);
  }

  private combatView(dt: number): View {
    let hero = this.heroFeet.walkPose(),
      foe = this.foeFeet.walkPose(),
      heroY = FLOOR,
      foeY = FLOOR;
    if (this.heroHp <= 0) {
      hero = fixed(7);
      heroY += Math.min(29, this.outcomeTime * 35);
    } else if (this.heroStun > 0)
      hero = poseAt(
        [
          [0, 0],
          [0.16, 7],
          [0.58, 7],
          [1, 0],
        ],
        1 - this.heroStun / 0.43
      );
    else if (this.dodge.isPlaying) {
      const u = this.dodge.normalizedTime;
      hero = poseAt(
        [
          [0, 0],
          [0.22, 7],
          [0.6, 7],
          [1, 0],
        ],
        u
      );
      heroY -= Math.sin(u * Math.PI) * 13;
    } else if (this.attack)
      hero = poseAt(
        this.swingPoses,
        this.attack.normalizedTime,
        KNIGHT,
        KNIGHT_SCALE
      );
    else if (this.hold)
      hero = poseAt(
        [
          [0, 0],
          [0.52, 2],
          [1, 3],
        ],
        clamp(this.charge / 0.44, 0, 1)
      );
    if (this.foeHp <= 0)
      foe = poseAt(
        [
          [0, 5],
          [0.21, 6],
          [0.42, 6],
          [0.85, 7],
          [1, 7],
        ],
        clamp(this.outcomeTime, 0, 1)
      );
    else if (this.foeStun > 0)
      foe = poseAt(
        STAGGER_POSES,
        1 - this.foeStun / this.stunLength,
        WARDEN,
        WARDEN_SCALE
      );
    else if (this.bash.isPlaying)
      foe = poseAt(BASH_POSES, this.bash.normalizedTime, WARDEN, WARDEN_SCALE);
    hero = this.heroFeet.shape(
      hero,
      KNIGHT,
      KNIGHT_SCALE,
      this.time,
      !this.attack
    );
    foe = this.foeFeet.shape(
      foe,
      WARDEN,
      WARDEN_SCALE,
      this.time,
      !this.bash.isPlaying
    );
    if (this.attack && hero.joints) {
      const phase = this.attack.normalizedTime;
      if (hero.a === 3 && hero.b === 4) {
        const arc = Math.sin(Math.PI * hero.t) ** 2;
        hero.joints[2].x += 17 * arc;
        hero.joints[2].y -= 26 * arc;
        hero.joints[8].y -= 13 * arc;
      }
      const reach = this.foeX - this.heroX - 93;
      const retract =
        Math.max(0, hero.joints[2].x - reach) * drivePulse(phase, 0.26, 0.79);
      hero.joints[2].x -= retract;
      hero.joints[8].x -= retract * 0.55;
    }
    const heroState =
      this.heroHp <= 0
        ? "down"
        : this.heroStun > 0
        ? "hurt"
        : this.dodge.isPlaying
        ? "evade"
        : this.attack
        ? this.attackGroup
        : this.hold
        ? "raise"
        : "footwork";
    const foeState =
      this.foeHp <= 0
        ? "down"
        : this.foeStun > 0
        ? "hurt"
        : this.bash.isPlaying
        ? "bash"
        : "footwork";
    hero = this.knightTrack.sample(heroState, hero, dt);
    foe = this.wardenTrack.sample(foeState, foe, dt);
    const hand = pin(KNIGHT, hero, 2, KNIGHT_SCALE);
    const grip = { x: this.heroX + hand.x, y: heroY + hand.y };
    const target = wardenSurface(foe, this.foeX, foeY, this.hitAim);
    return {
      knight: { x: this.heroX, y: heroY, pose: hero },
      warden: { x: this.foeX, y: foeY, pose: foe },
      blade: { grip, angle: this.steel.angle, bend: this.steel.bend },
      dent: {
        x: target.x + this.hitOffset.x,
        y: target.y + this.hitOffset.y,
        displacement: this.dentPosition,
      },
      shake: this.shake,
    };
  }

  private swordAngle(view: View): number {
    if (!this.attack) {
      if (this.heroStun > 0 || this.dodge.isPlaying) return -66 * RAD;
      const lift = this.hold ? smooth(clamp(this.charge / 0.44, 0, 1)) : 0;
      return mix(-48, -145, lift) * RAD;
    }
    const u = this.attack.normalizedTime;
    const target = wardenSurface(view.warden.pose, this.foeX, FLOOR, this.aim);
    const low = clamp(
      Math.atan2(
        target.y - view.blade.grip.y,
        Math.max(32, target.x - view.blade.grip.x)
      ) / RAD,
      -39,
      20
    );
    const start = this.swingStartAngle;
    const heavy = this.attack === this.attacks.charged;
    const chamber = heavy ? 0.16 : 0.13;
    return (
      curve(
        [
          [0, start],
          [chamber, heavy ? -145 : Math.min(start, -77)],
          [0.34, heavy ? -101 : -46],
          [0.425, low - 21],
          [0.495, low + 3],
          [0.58, low + 13],
          [0.73, 24],
          [0.88, -13],
          [1, -48],
        ],
        u
      ) * RAD
    );
  }

  private connect(point: Point): void {
    this.usedStrike = true;
    this.hits++;
    this.lastDamage = Math.round(16 + 20 * this.power);
    if (this.mode !== "title")
      this.foeHp = Math.max(0, this.foeHp - this.lastDamage);
    this.hitAim = this.aim;
    const at = wardenSurface(
      this.view.warden.pose,
      this.foeX,
      FLOOR,
      this.hitAim
    );
    this.hitOffset = { x: point.x - at.x, y: point.y - at.y };
    this.stunLength = 0.43 + 0.27 * this.power;
    this.foeStun = this.stunLength;
    this.knockback = 145 + 220 * this.power;
    this.bash.reset();
    this.cooldown = 0.29;
    this.dentPosition = 8 + 12 * this.power;
    this.dentVelocity = 210 + 120 * this.power;
    this.steel.velocity -= 170 + 230 * this.power;
    this.freeze = 0.043 + 0.052 * this.power;
    this.shake = 2.2 + 3.1 * this.power;
    this.emit("impact", point, 0.62 + 0.5 * this.power);
    this.emit(
      "step",
      { x: this.foeX - 60, y: FLOOR },
      0.43 + 0.25 * this.power
    );
    if (this.foeHp === 0) {
      this.mode = "victory";
      this.outcomeTime = 0;
      this.clearInputs();
    }
  }

  private holdContact(): void {
    if (!this.attack || !this.usedStrike) return;
    const phase = this.attack.normalizedTime;
    if (phase >= 0.73) return;
    const { blade, dent } = this.view;
    const target = { x: dent.x + dent.displacement, y: dent.y };
    const distance = Math.hypot(
      target.x - blade.grip.x,
      target.y - blade.grip.y
    );
    const separation = smooth(clamp((distance - BLADE_LENGTH) / 18, 0, 1));
    const release = Math.max(
      separation,
      smooth(clamp((phase - 0.55) / 0.18, 0, 1))
    );
    const compression =
      (13 + this.power * 23) * Math.min(1, Math.abs(dent.displacement) / 10);
    const contact = plantBlade(
      blade.grip,
      target,
      this.steel.bend - compression
    );
    contact.angle = mix(contact.angle, blade.angle, release);
    contact.bend = mix(contact.bend, blade.bend, release);
    contact.touching = release < 0.5;
    this.view.blade = contact;
  }

  private updateBlade(dt: number): void {
    const requested = this.swordAngle(this.view);
    const angle = this.attack
      ? requested
      : mix(this.steel.angle, requested, 1 - Math.exp(-24 * dt));
    if (!this.attack || this.attack.phase === "startup") {
      this.steel.trackStraight(angle, dt);
    } else {
      const driving =
        this.attack.active && !this.usedStrike && angle > this.steel.angle;
      this.steel.step(angle, dt, this.power, driving);
    }
    this.view.blade.angle = this.steel.angle;
    this.view.blade.bend = this.steel.bend;
  }

  private enemyContact(): void {
    if (
      !this.bash.active ||
      this.usedBash ||
      (this.dodge.active && this.dodge.isPlaying)
    )
      return;
    const fist = pin(WARDEN, this.view.warden.pose, 2, WARDEN_SCALE);
    const chest = pin(KNIGHT, this.view.knight.pose, 1, KNIGHT_SCALE);
    const gap = this.foeX + fist.x - (this.heroX + chest.x);
    if (gap > 69) return;
    this.usedBash = true;
    this.heroHp = Math.max(0, this.heroHp - 24);
    this.heroStun = 0.43;
    this.shake = 3.4;
    this.freeze = 0.055;
    this.attack = null;
    this.cancelCharge();
    this.input.clear();
    this.emit(
      "hurt",
      { x: this.heroX + chest.x + 18, y: FLOOR + chest.y },
      0.77
    );
    if (this.heroHp === 0) {
      this.mode = "defeat";
      this.outcomeTime = 0;
    }
  }

  step(dt: number): void {
    if (this.mode === "paused") return;
    if (this.mode === "title") this.advanceDemo(dt);
    this.time += dt;
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }
    this.shake *= Math.exp(-17 * dt);
    this.dentVelocity +=
      (-560 * this.dentPosition - 15 * this.dentVelocity) * dt;
    this.dentPosition += this.dentVelocity * dt;
    if (this.mode === "victory" || this.mode === "defeat") {
      this.outcomeTime += dt;
      this.attack?.advance(dt);
      this.view = this.combatView(dt);
      this.updateBlade(dt);
      this.holdContact();
      return;
    }
    this.elapsed += dt;
    if (
      this.hold &&
      (!this.attack || this.attack.normalizedTime > 0.55) &&
      !this.dodge.isPlaying &&
      this.heroStun === 0
    )
      this.charge = Math.min(0.85, this.charge + dt);
    this.beginActions();
    if (this.attack) {
      for (const ev of this.attack.advance(dt))
        if (ev.id === "release")
          this.emit(
            "swing",
            { x: this.heroX, y: FLOOR - 201 },
            0.6 + 0.38 * this.power
          );
      if (this.attack.isComplete) this.attack = null;
    }
    if (this.bash.isPlaying) {
      this.bash.advance(dt);
      if (this.bash.isComplete) this.cooldown = 0.83;
    }
    this.dodge.advance(dt);
    this.heroStun = Math.max(0, this.heroStun - dt);
    this.foeStun = Math.max(0, this.foeStun - dt);
    this.advanceActors(dt);
    this.regenDelay -= dt;
    if (
      this.regenDelay <= 0 &&
      !this.hold &&
      !this.attack &&
      !this.dodge.isPlaying
    )
      this.stamina = Math.min(100, this.stamina + 29 * dt);
    this.view = this.combatView(dt);
    this.updateBlade(dt);
    if (this.plantedBoot !== undefined) {
      const boot = pin(
        KNIGHT,
        this.view.knight.pose,
        this.plantedBoot,
        KNIGHT_SCALE
      );
      this.emit("step", { x: this.heroX + boot.x, y: FLOOR - 2 }, 0.34);
    }
    if (this.attack?.active && !this.usedStrike) {
      const point = intersectsPlate(
        this.view.blade,
        wardenSurface(this.view.warden.pose, this.foeX, FLOOR, this.aim)
      );
      if (point) this.connect(point);
    }
    if (this.mode === "duel" && this.bash.isPlaying) this.enemyContact();
    this.wardAction =
      this.foeStun > 0
        ? "stagger"
        : this.bash.isPlaying
        ? this.bash.phase
        : Math.abs(this.foeFeet.speed) > 2
        ? "advance"
        : "guard";
    // Keep the actual contact frame and pose during hit-stop, including the first indentation.
    this.view.dent.displacement = this.dentPosition;
    if (this.freeze > 0 && this.usedStrike) {
      const contact = wardenSurface(
        this.view.warden.pose,
        this.foeX,
        FLOOR,
        this.hitAim
      );
      this.view.dent.x = contact.x + this.hitOffset.x;
      this.view.dent.y = contact.y + this.hitOffset.y;
    }
    this.holdContact();
  }
}
