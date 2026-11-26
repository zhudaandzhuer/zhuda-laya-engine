// A walking capsule: where a character ends up when it tries to go somewhere.
//
// The game stays the authority on movement: it gives the world (a ground height and solids, the
// same as WalkGrid.ts), says where the character wants to go this step, and may put the character
// anywhere it likes afterwards. This only answers "given that world and that wish, where does a
// capsule of this size end up": it slides along what is solid, takes steps it can take, refuses
// slopes that are too steep, falls off what it walks off, and lands. It reads no input, owns no
// node and keeps no clock: call `move` from the game's own fixed step.
import type { Vec3 } from './Math3D.ts';
import { zhudaSolidBlocks, type ZhudaSolid } from './WalkGrid.ts';

export interface ZhudaCharacterWorld {
  /** The ground's height under a point, or null where there is none (outside the map, a pit). */
  ground(x: number, z: number): number | null;
  /** What the capsule cannot pass through. Read on every move: the game may change the list. */
  solids?: readonly ZhudaSolid[];
}
export interface ZhudaCharacterControllerOptions {
  world: ZhudaCharacterWorld;
  /** Where the feet start. */
  position: Vec3;
  radius?: number;
  height?: number;
  /** The highest rise taken in one stride, and the deepest drop that is still walking, not falling. */
  maxStep?: number;
  /** The steepest ground climbed, in degrees. Going down is not limited. */
  maxSlopeDeg?: number;
  /** Metres per second squared, downwards. */
  gravity?: number;
  /** Metres per second upwards when a jump starts. */
  jumpSpeed?: number;
  maxFallSpeed?: number;
  /** Where there is no ground: 'block' treats it as a wall (the edge of the map), 'fall' lets the character walk off. */
  noGround?: 'block' | 'fall';
}
export interface ZhudaCharacterMove {
  /** How far the feet moved in this call. */
  moved: Vec3;
  grounded: boolean;
  /** Something solid, a step too high, a slope too steep or the map's edge shortened the move. */
  blocked: boolean;
  /** It touched ground in this call after being in the air. */
  landed: boolean;
  /** It left the ground in this call without jumping (walked off an edge). */
  fellOff: boolean;
  jumped: boolean;
}

const finite = (...values: number[]) => values.every(Number.isFinite);

export class ZhudaCharacterController {
  readonly radius: number;
  readonly height: number;
  readonly maxStep: number;
  readonly maxSlopeDeg: number;
  gravity: number;
  jumpSpeed: number;
  maxFallSpeed: number;
  /** The feet. Set it through `teleport`, which also settles `grounded`. */
  readonly position: Vec3;
  /** Metres per second upwards (negative while falling). */
  velocityY = 0;
  grounded = false;
  private readonly world: ZhudaCharacterWorld;
  private readonly noGround: 'block' | 'fall';
  private readonly slopeLimit: number;

  constructor(options: ZhudaCharacterControllerOptions) {
    const { world, position } = options ?? ({} as ZhudaCharacterControllerOptions);
    if (!world || typeof world.ground !== 'function')
      throw Error('Invalid character world: ground(x, z)');
    this.radius = options.radius ?? 0.3;
    this.height = options.height ?? 1.7;
    this.maxStep = options.maxStep ?? 0.35;
    this.maxSlopeDeg = options.maxSlopeDeg ?? 50;
    this.gravity = options.gravity ?? 20;
    this.jumpSpeed = options.jumpSpeed ?? 7;
    this.maxFallSpeed = options.maxFallSpeed ?? 40;
    this.noGround = options.noGround ?? 'block';
    if (
      !finite(
        this.radius,
        this.height,
        this.maxStep,
        this.maxSlopeDeg,
        this.gravity,
        this.jumpSpeed,
        this.maxFallSpeed,
      )
    )
      throw Error('Invalid character controller: numbers');
    if (
      !(this.radius > 0) ||
      !(this.height >= this.radius * 2) ||
      this.maxStep < 0 ||
      !(this.maxSlopeDeg > 0 && this.maxSlopeDeg < 90)
    )
      throw Error(
        'Invalid character controller: radius above 0, height at least two radii, maxStep, maxSlopeDeg between 0 and 90',
      );
    if (this.gravity < 0 || this.jumpSpeed < 0 || !(this.maxFallSpeed > 0))
      throw Error('Invalid character controller: gravity, jumpSpeed, maxFallSpeed');
    if (!['block', 'fall'].includes(this.noGround))
      throw Error("Invalid character controller: noGround 'block' or 'fall'");
    this.world = world;
    this.slopeLimit = Math.tan((this.maxSlopeDeg * Math.PI) / 180);
    this.position = { x: 0, y: 0, z: 0 };
    this.teleport(position);
  }

  /** Puts the feet somewhere. On the ground if they are within a step of it, else in the air. */
  teleport(position: Vec3): void {
    if (!position || !finite(position.x, position.y, position.z))
      throw Error('Invalid character position');
    ((this.position.x = position.x),
      (this.position.y = position.y),
      (this.position.z = position.z));
    this.velocityY = 0;
    const ground = this.world.ground(position.x, position.z);
    this.grounded = ground !== null && Math.abs(position.y - ground) <= this.maxStep + 1e-6;
    if (this.grounded) this.position.y = ground as number;
  }

  /**
   * One step of `dt` seconds. `wish` is the speed wanted over the ground, in metres per second
   * on x and z; the game has already turned its input, its speed and its states into it.
   */
  move(
    dt: number,
    wish: { x: number; z: number },
    options: { jump?: boolean } = {},
  ): ZhudaCharacterMove {
    if (!Number.isFinite(dt) || dt < 0 || dt > 1)
      throw Error('Invalid character step: seconds, 0 to 1');
    if (!wish || !finite(wish.x, wish.z)) throw Error('Invalid character wish: speed on x and z');
    const start = { ...this.position },
      wasGrounded = this.grounded;
    let blocked = false,
      jumped = false;
    // Over the ground, in strides of at most half a radius: nothing thinner than that is jumped through.
    const distance = Math.hypot(wish.x, wish.z) * dt;
    const strides = Math.max(1, Math.ceil(distance / (this.radius * 0.5)));
    for (let k = 0; k < strides && distance > 0; k++) {
      const dx = (wish.x * dt) / strides,
        dz = (wish.z * dt) / strides;
      // The whole stride; if that is refused, along one axis and then the other: a slide along a wall.
      if (this.stride(dx, dz)) continue;
      blocked = true;
      const first = Math.abs(dx) >= Math.abs(dz) ? this.stride(dx, 0) : this.stride(0, dz);
      if (!first) Math.abs(dx) >= Math.abs(dz) ? this.stride(0, dz) : this.stride(dx, 0);
    }
    // Up and down.
    if (options.jump && this.grounded) {
      this.velocityY = this.jumpSpeed;
      this.grounded = false;
      jumped = true;
    }
    const ground = this.world.ground(this.position.x, this.position.z);
    if (this.grounded) {
      if (ground === null || this.position.y - ground > this.maxStep + 1e-6) this.grounded = false;
      else this.position.y = ground;
    }
    if (!this.grounded) {
      this.velocityY = Math.max(-this.maxFallSpeed, this.velocityY - this.gravity * dt);
      this.position.y += this.velocityY * dt;
      if (ground !== null && this.velocityY <= 0 && this.position.y <= ground) {
        this.position.y = ground;
        this.velocityY = 0;
        this.grounded = true;
      }
    }
    return {
      moved: {
        x: this.position.x - start.x,
        y: this.position.y - start.y,
        z: this.position.z - start.z,
      },
      grounded: this.grounded,
      blocked,
      landed: !wasGrounded && this.grounded,
      fellOff: wasGrounded && !this.grounded && !jumped,
      jumped,
    };
  }

  /** Tries one stride over the ground. Moves and returns true, or leaves the feet where they are. */
  private stride(dx: number, dz: number): boolean {
    if (dx === 0 && dz === 0) return true;
    let x = this.position.x + dx,
      z = this.position.z + dz;
    const feet = this.position.y;
    // Out of every solid that stands in the way, a few times: two solids in a corner both push.
    const solids = (this.world.solids ?? []).filter((solid) =>
      zhudaSolidBlocks(solid, feet, this.height, this.grounded ? this.maxStep : 0),
    );
    for (let pass = 0; pass < 4; pass++) {
      let pushed = false;
      for (const solid of solids) {
        const out = pushOut(solid, x, z, this.radius);
        if (out) ((x = out.x), (z = out.z), (pushed = true));
      }
      if (!pushed) break;
      if (pass === 3) return false;
    }
    // A push may only shorten a stride or turn it along a wall, never send the feet backwards or
    // much further than they asked to go (round a pillar the way out is a little longer than the way in).
    const gx = x - this.position.x,
      gz = z - this.position.z,
      asked = Math.hypot(dx, dz);
    if (gx * dx + gz * dz <= 1e-12 || Math.hypot(gx, gz) > asked * 1.25 + 1e-9) return false;
    const ground = this.world.ground(x, z);
    if (ground === null) {
      if (this.noGround === 'block') return false;
    } else if (this.grounded) {
      const rise = ground - feet;
      if (rise > this.maxStep + 1e-6) return false;
      if (rise > 0) {
        // A slope is ground that goes on rising steeply: over the next radius and the one after.
        // (A kerb or a stair's riser rises once and is level again: that is a step, taken above.)
        const length = Math.hypot(gx, gz),
          ux = (gx / length) * this.radius,
          uz = (gz / length) * this.radius;
        const near = this.world.ground(this.position.x + ux, this.position.z + uz),
          far = this.world.ground(this.position.x + ux * 2, this.position.z + uz * 2);
        if (
          near !== null &&
          far !== null &&
          (near - feet) / this.radius > this.slopeLimit &&
          (far - near) / this.radius > this.slopeLimit
        )
          return false;
      }
    } else if (ground > feet + 1e-6) return false; // in the air, into the side of higher ground
    this.position.x = x;
    this.position.z = z;
    return true;
  }
}

/** Where a circle of `radius` at (x, z) must go to be clear of a solid's footprint, or null if it is clear. */
function pushOut(
  solid: ZhudaSolid,
  x: number,
  z: number,
  radius: number,
): { x: number; z: number } | null {
  if (solid.kind === 'cylinder') {
    const dx = x - solid.center.x,
      dz = z - solid.center.z,
      d = Math.hypot(dx, dz),
      reach = solid.radius + radius;
    // (A hair inside counts as clear: a point just put on the edge reads as a hair inside it.)
    if (d >= reach - 1e-9) return null;
    if (d < 1e-9) return { x: solid.center.x + reach, z };
    return { x: solid.center.x + (dx / d) * reach, z: solid.center.z + (dz / d) * reach };
  }
  const nearX = Math.min(Math.max(x, solid.min.x), solid.max.x),
    nearZ = Math.min(Math.max(z, solid.min.z), solid.max.z);
  const dx = x - nearX,
    dz = z - nearZ,
    d = Math.hypot(dx, dz);
  if (d >= radius - 1e-9) return null;
  if (d > 1e-9) return { x: nearX + (dx / d) * radius, z: nearZ + (dz / d) * radius };
  // The middle is inside the box: out through the nearest side.
  const sides = [
    [x - solid.min.x, -1, 0],
    [solid.max.x - x, 1, 0],
    [z - solid.min.z, 0, -1],
    [solid.max.z - z, 0, 1],
  ].sort((a, b) => a[0] - b[0])[0];
  return { x: x + sides[1] * (sides[0] + radius), z: z + sides[2] * (sides[0] + radius) };
}
