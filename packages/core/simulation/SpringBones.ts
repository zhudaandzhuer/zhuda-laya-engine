/**
 * Spring bones: chains of bones that lag, swing and settle behind what they
 * hang from (hair, a tail, a skirt's hem, an earring). Each joint of a chain
 * is a point at the end of a bone of fixed length, moved by Verlet
 * integration, pulled back toward where its bone would point at rest, and
 * kept out of bodies.
 *
 * Plain arithmetic: no LayaAir, no timer, no random number. Time comes in as
 * deltas of the engine's clock, spent in fixed steps (`ZhudaFixedStep`, as a
 * cloth's); the same deltas and the same anchors give the same chains to
 * the last bit. `ZhudaSpringBones` (runtime3d) turns a model's bones by it.
 */
import { zhudaQuatFromTo, zhudaQuatMultiply, zhudaQuatRotate } from '../runtime3d/Ik.ts';
import {
  ZhudaFixedStep,
  prepareZhudaTable,
  validateZhudaCollider,
  zhudaColliderDepth,
  type ZhudaCollider,
  type ZhudaSimVec3,
  type ZhudaTablePrepared,
} from './ParticleCore.ts';

export type ZhudaSimQuat = readonly [number, number, number, number];

/** A chain as it is at rest, bone by bone from the one nearest what it hangs from. */
export interface ZhudaSpringChainRest {
  /** Each bone's rotation in its parent's space at rest (x, y, z, w). */
  rotations: readonly ZhudaSimQuat[];
  /** The way from each bone's joint to the next, in the bone's own space, a unit. */
  axes: readonly ZhudaSimVec3[];
  /** Each bone's length, metres. */
  lengths: readonly number[];
}

export interface ZhudaSpringChainOptions {
  /** How fast a bone comes back to where it points at rest, a second (default 10; 0 to 1000). 0: a rope. */
  stiffness?: number;
  /** How fast a joint loses its speed, a second (default 4; 0 to 100). */
  drag?: number;
  /** Metres a second a second (default 0, -9.81, 0). */
  gravity?: ZhudaSimVec3;
  /** How far outside a body a joint is kept, metres (default 0.02; 0 to 1). */
  radius?: number;
}

export interface ZhudaSpringBoneOptions {
  /** Seconds a step (default 1/120; 1/1000 to 1/10). */
  step?: number;
  /** The most steps one `advance` runs; time over that is dropped (default 8; 1 to 64). */
  maxSteps?: number;
}

const finite3 = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const finite4 = (v: unknown): v is [number, number, number, number] =>
  Array.isArray(v) && v.length === 4 && v.every(Number.isFinite);
const ranged = (name: string, value: unknown, fallback: number, min: number, max: number) => {
  if (value === undefined) return fallback;
  if (!(Number.isFinite(value) && (value as number) >= min && (value as number) <= max))
    throw Error(`Invalid ${name}: ${min} to ${max}`);
  return value as number;
};
const unitQuat = (q: ZhudaSimQuat): [number, number, number, number] => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!(l > 1e-9)) throw Error('A rotation may not be all zeros');
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};

interface Chain {
  bones: number;
  rest: [number, number, number, number][];
  axes: [number, number, number][];
  lengths: number[];
  stiffness: number;
  drag: number;
  gravity: [number, number, number];
  radius: number;
  /** The joints after the first: three numbers each, where they are and where they were. */
  tails: Float64Array;
  previous: Float64Array;
  /** Where the joints were before the last step, for how fast they really move. */
  before: Float64Array;
  /** Each bone's rotation in the world, four numbers each: what the owner turns its bones to. */
  rotations: Float64Array;
  /** Where the chain hangs from, and how what it hangs from is turned: this frame's and the last's. */
  anchor: Float64Array;
  anchorWas: Float64Array;
  turn: Float64Array;
  turnWas: Float64Array;
  placed: boolean;
}

export interface ZhudaSpringBoneReport {
  chains: number;
  bones: number;
  colliders: number;
  steps: number;
  dropped: number;
  pendingSeconds: number;
  /** Joints deeper inside a body than a tenth of a millimetre. */
  inside: number;
  /** Half the sum of the squares of the joints' speeds over the last step. */
  kineticEnergy: number;
}

/**
 * Chains of spring bones in motion. Each frame the owner says where each
 * chain hangs from (`setAnchor`), hands over the clock's delta (`advance`)
 * and reads each bone's rotation in the world (`rotations`).
 */
export class ZhudaSpringBoneSolver {
  readonly step: number;
  readonly maxSteps: number;
  private readonly clock: ZhudaFixedStep;
  private readonly chains = new Map<number, Chain>();
  private readonly bodies = new Map<number, ZhudaCollider>();
  private readonly tables = new Map<number, ZhudaTablePrepared>();
  private readonly scratch = new Float64Array(6);
  private next = 1;
  private disposed = false;

  constructor(options: ZhudaSpringBoneOptions = {}) {
    if (options === null || typeof options !== 'object') throw Error('Invalid spring bone options');
    for (const key of Object.keys(options))
      if (!['step', 'maxSteps'].includes(key)) throw Error(`Unknown spring bone option: ${key}`);
    this.clock = new ZhudaFixedStep({
      step: options.step ?? 1 / 120,
      maxSteps: options.maxSteps ?? 8,
    });
    this.step = this.clock.step;
    this.maxSteps = this.clock.maxSteps;
  }

  private alive() {
    if (this.disposed) throw Error('Disposed spring bones');
  }
  private chain(id: number): Chain {
    const chain = this.chains.get(id);
    if (!chain) throw Error(`No chain ${id}`);
    return chain;
  }

  /** Adds a chain; returns a number to name it by. It is placed by its first `setAnchor`. */
  addChain(rest: ZhudaSpringChainRest, options: ZhudaSpringChainOptions = {}): number {
    this.alive();
    const bones = rest?.lengths?.length;
    if (
      !Number.isInteger(bones) ||
      bones < 1 ||
      bones > 256 ||
      rest.rotations?.length !== bones ||
      rest.axes?.length !== bones
    )
      throw Error('Invalid chain: 1 to 256 bones, a rotation, an axis and a length for each');
    for (const key of Object.keys(options))
      if (!['stiffness', 'drag', 'gravity', 'radius'].includes(key))
        throw Error(`Unknown chain option: ${key}`);
    const axes: [number, number, number][] = [],
      rotations: [number, number, number, number][] = [];
    for (let i = 0; i < bones; i++) {
      if (!finite4(rest.rotations[i])) throw Error(`Invalid chain: rotations[${i}]`);
      if (!finite3(rest.axes[i])) throw Error(`Invalid chain: axes[${i}]`);
      const l = Math.hypot(rest.axes[i][0], rest.axes[i][1], rest.axes[i][2]);
      if (!(l > 1e-9)) throw Error(`Invalid chain: axes[${i}] is not a direction`);
      if (!(Number.isFinite(rest.lengths[i]) && rest.lengths[i] > 1e-6 && rest.lengths[i] <= 1000))
        throw Error(`Invalid chain: lengths[${i}] (metres, more than 0)`);
      axes.push([rest.axes[i][0] / l, rest.axes[i][1] / l, rest.axes[i][2] / l]);
      rotations.push(unitQuat(rest.rotations[i]));
    }
    if (options.gravity !== undefined && !finite3(options.gravity))
      throw Error('Invalid gravity: three finite numbers');
    const id = this.next++;
    this.chains.set(id, {
      bones,
      rest: rotations,
      axes,
      lengths: [...rest.lengths],
      stiffness: ranged('stiffness', options.stiffness, 10, 0, 1000),
      drag: ranged('drag', options.drag, 4, 0, 100),
      gravity: options.gravity
        ? [options.gravity[0], options.gravity[1], options.gravity[2]]
        : [0, -9.81, 0],
      radius: ranged('radius', options.radius, 0.02, 0, 1),
      tails: new Float64Array(bones * 3),
      previous: new Float64Array(bones * 3),
      before: new Float64Array(bones * 3),
      rotations: new Float64Array(bones * 4),
      anchor: new Float64Array(3),
      anchorWas: new Float64Array(3),
      turn: Float64Array.of(0, 0, 0, 1),
      turnWas: Float64Array.of(0, 0, 0, 1),
      placed: false,
    });
    return id;
  }
  removeChain(id: number) {
    this.alive();
    if (!this.chains.delete(id)) throw Error(`No chain ${id}`);
  }

  /**
   * Where a chain hangs from this frame: its first joint's place in the
   * world, and the rotation in the world of what that joint's bone is a
   * child of. The first time, the chain is laid out at rest there.
   */
  setAnchor(id: number, position: ZhudaSimVec3, parentRotation: ZhudaSimQuat) {
    this.alive();
    const chain = this.chain(id);
    if (!finite3(position)) throw Error('Invalid anchor: three finite numbers');
    if (!finite4(parentRotation)) throw Error('Invalid anchor: a rotation of four finite numbers');
    const turn = unitQuat(parentRotation);
    chain.anchorWas.set(chain.anchor);
    chain.turnWas.set(chain.turn);
    chain.anchor.set(position);
    chain.turn.set(turn);
    if (!chain.placed) {
      chain.anchorWas.set(chain.anchor);
      chain.turnWas.set(chain.turn);
      this.layOut(chain);
    }
  }

  /** A chain put back at rest where it hangs now, still: after what it hangs from was put elsewhere at once. */
  reset(id?: number) {
    this.alive();
    for (const chain of id === undefined ? this.chains.values() : [this.chain(id)])
      if (chain.placed) {
        chain.anchorWas.set(chain.anchor);
        chain.turnWas.set(chain.turn);
        this.layOut(chain);
      }
    if (id === undefined) this.clock.reset();
  }

  private layOut(chain: Chain) {
    let parent: [number, number, number, number] = [
      chain.turn[0],
      chain.turn[1],
      chain.turn[2],
      chain.turn[3],
    ];
    let head: [number, number, number] = [chain.anchor[0], chain.anchor[1], chain.anchor[2]];
    for (let i = 0; i < chain.bones; i++) {
      const world = zhudaQuatMultiply(parent, chain.rest[i]);
      const way = zhudaQuatRotate(world, chain.axes[i]);
      head = [
        head[0] + way[0] * chain.lengths[i],
        head[1] + way[1] * chain.lengths[i],
        head[2] + way[2] * chain.lengths[i],
      ];
      chain.tails.set(head, i * 3);
      chain.previous.set(head, i * 3);
      chain.rotations.set(world, i * 4);
      parent = world;
    }
    chain.placed = true;
    // Where it is laid out may be inside a body (hair on a back): it is moved
    // out of it there and then, with no motion, gravity or pull, so that it
    // does not start by being thrown out.
    for (let i = 0; i < 400 && this.bodies.size; i++) {
      this.stepChain(chain, 1, true);
      let moved = 0;
      for (let k = 0; k < chain.tails.length; k++)
        moved = Math.max(moved, Math.abs(chain.tails[k] - chain.before[k]));
      chain.previous.set(chain.tails);
      if (moved < 1e-7) break;
    }
    chain.before.set(chain.tails);
  }

  /** Each bone's rotation in the world (x, y, z, w), four numbers a bone, the first bone first. */
  rotations(id: number): Float64Array {
    return this.chain(id).rotations;
  }
  /** Where each joint after the first is, three numbers each. */
  tails(id: number): Float64Array {
    return this.chain(id).tails;
  }

  addCollider(collider: ZhudaCollider): number {
    this.alive();
    const issues = validateZhudaCollider(collider);
    if (issues.length) throw Error(`Invalid collider: ${issues.join('; ')}`);
    const id = this.next++;
    this.bodies.set(id, collider);
    return id;
  }
  /** Puts another body in a body's place: it moved. */
  setCollider(id: number, collider: ZhudaCollider) {
    this.alive();
    if (!this.bodies.has(id)) throw Error(`No collider ${id}`);
    const issues = validateZhudaCollider(collider);
    if (issues.length) throw Error(`Invalid collider: ${issues.join('; ')}`);
    this.bodies.set(id, collider);
  }
  removeCollider(id: number) {
    this.alive();
    if (!this.bodies.delete(id)) throw Error(`No collider ${id}`);
    this.tables.delete(id);
  }

  /**
   * Takes a delta of the clock, in seconds, and runs the whole steps it
   * holds. Across those steps each chain's anchor goes evenly from where
   * it was at the last `advance` to where `setAnchor` put it. Zero changes
   * nothing.
   */
  advance(deltaSeconds: number): { steps: number; dropped: number } {
    this.alive();
    const before = this.clock.dropped;
    const steps = this.clock.take(deltaSeconds);
    if (steps) {
      for (const [id, body] of this.bodies)
        if (body.type === 'table')
          this.tables.set(id, prepareZhudaTable(body, this.tables.get(id)));
      for (let s = 1; s <= steps; s++)
        for (const chain of this.chains.values())
          if (chain.placed) this.stepChain(chain, s / steps);
      for (const chain of this.chains.values()) {
        chain.anchorWas.set(chain.anchor);
        chain.turnWas.set(chain.turn);
      }
    }
    return { steps, dropped: this.clock.dropped - before };
  }

  private stepChain(chain: Chain, share: number, quiet = false) {
    const dt = this.step,
      keep = Math.exp(-chain.drag * dt),
      pull = 1 - Math.exp(-chain.stiffness * dt),
      { tails, previous, anchor, anchorWas, turn, turnWas, gravity } = chain;
    // Where the chain hangs from at this step, between the last frame's place and this one's.
    let hx = anchorWas[0] + (anchor[0] - anchorWas[0]) * share,
      hy = anchorWas[1] + (anchor[1] - anchorWas[1]) * share,
      hz = anchorWas[2] + (anchor[2] - anchorWas[2]) * share;
    const same =
      turnWas[0] * turn[0] + turnWas[1] * turn[1] + turnWas[2] * turn[2] + turnWas[3] * turn[3] < 0
        ? -1
        : 1;
    let parent = unitQuat([
      turnWas[0] * same + (turn[0] - turnWas[0] * same) * share,
      turnWas[1] * same + (turn[1] - turnWas[1] * same) * share,
      turnWas[2] * same + (turn[2] - turnWas[2] * same) * share,
      turnWas[3] * same + (turn[3] - turnWas[3] * same) * share,
    ]);
    const out = this.scratch;
    chain.before.set(tails);
    for (let i = 0; i < chain.bones; i++) {
      const k = i * 3,
        length = chain.lengths[i];
      const rest = zhudaQuatMultiply(parent, chain.rest[i]);
      const restWay = zhudaQuatRotate(rest, chain.axes[i]);
      // It keeps its motion (less the drag) and takes gravity...
      let x = tails[k],
        y = tails[k + 1],
        z = tails[k + 2];
      if (!quiet) {
        x += (x - previous[k]) * keep + gravity[0] * dt * dt;
        y += (y - previous[k + 1]) * keep + gravity[1] * dt * dt;
        z += (z - previous[k + 2]) * keep + gravity[2] * dt * dt;
        // ...is pulled toward where its bone points at rest...
        x += (hx + restWay[0] * length - x) * pull;
        y += (hy + restWay[1] * length - y) * pull;
        z += (hz + restWay[2] * length - z) * pull;
      }
      // ...stays a bone's length from its joint (a bone does not stretch), and out of the
      // bodies: where it is inside one it slides round its joint, away from the body, a
      // little at a time, until it is out.
      let fromX = 0,
        fromY = 0,
        fromZ = 0;
      for (let pass = 0; pass < 12; pass++) {
        let dx = x - hx,
          dy = y - hy,
          dz = z - hz;
        let far = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!(far > 1e-12)) {
          dx = restWay[0];
          dy = restWay[1];
          dz = restWay[2];
          far = 1;
        }
        dx /= far;
        dy /= far;
        dz /= far;
        x = hx + dx * length;
        y = hy + dy * length;
        z = hz + dz * length;
        if (pass === 0) {
          fromX = x;
          fromY = y;
          fromZ = z;
        }
        // The body it is deepest in, and which way that body faces there.
        let deepest = 1e-6,
          nx = 0,
          ny = 0,
          nz = 0;
        for (const [id, body] of this.bodies) {
          const depth = zhudaColliderDepth(body, chain.radius, x, y, z, out, this.tables.get(id));
          if (depth > deepest) {
            deepest = depth;
            nx = out[3];
            ny = out[4];
            nz = out[5];
          }
        }
        if (deepest <= 1e-6 || pass === 11) break;
        // The part of that way that lies round the joint...
        const along = nx * dx + ny * dy + nz * dz;
        let tx = nx - dx * along,
          ty = ny - dy * along,
          tz = nz - dz * along;
        let round = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (round < 1e-6) {
          // ...or, met straight on, any way round: the same one every time.
          const ax = Math.abs(dy) < 0.9 ? 0 : 1,
            ay = Math.abs(dy) < 0.9 ? 1 : 0;
          tx = dy * 0 - dz * ay;
          ty = dz * ax - dx * 0;
          tz = dx * ay - dy * ax;
          round = Math.sqrt(tx * tx + ty * ty + tz * tz);
          tx /= round;
          ty /= round;
          tz /= round;
          round = 0.2;
        } else {
          tx /= round;
          ty /= round;
          tz /= round;
        }
        const move = (deepest / Math.max(round, 0.2)) * 1.2;
        x += tx * move;
        y += ty * move;
        z += tz * move;
      }
      // What a body moved it by is not motion of its own: it does not spring away from a body.
      previous[k] = tails[k] + (x - fromX);
      previous[k + 1] = tails[k + 1] + (y - fromY);
      previous[k + 2] = tails[k + 2] + (z - fromZ);
      tails[k] = x;
      tails[k + 1] = y;
      tails[k + 2] = z;
      // The bone is turned from where it points at rest to where its joint is.
      const way: [number, number, number] = [
        (x - hx) / length,
        (y - hy) / length,
        (z - hz) / length,
      ];
      const world = unitQuat(zhudaQuatMultiply(zhudaQuatFromTo(restWay, way), rest));
      chain.rotations.set(world, i * 4);
      parent = world;
      hx = x;
      hy = y;
      hz = z;
    }
  }

  /** How many joints are inside a body grown by their chain's radius by more than `tolerance` metres. */
  countInside(tolerance = 1e-4): number {
    this.alive();
    let inside = 0;
    for (const chain of this.chains.values())
      for (let i = 0; i < chain.bones; i++)
        for (const [id, body] of this.bodies)
          if (
            zhudaColliderDepth(
              body,
              chain.radius,
              chain.tails[i * 3],
              chain.tails[i * 3 + 1],
              chain.tails[i * 3 + 2],
              undefined,
              this.tables.get(id),
            ) > tolerance
          ) {
            inside++;
            break;
          }
    return inside;
  }

  inspect(): ZhudaSpringBoneReport {
    this.alive();
    let bones = 0,
      energy = 0;
    for (const chain of this.chains.values()) {
      bones += chain.bones;
      for (let k = 0; k < chain.bones * 3; k++) {
        const v = (chain.tails[k] - chain.before[k]) / this.step;
        energy += 0.5 * v * v;
      }
    }
    return {
      chains: this.chains.size,
      bones,
      colliders: this.bodies.size,
      steps: this.clock.steps,
      dropped: this.clock.dropped,
      pendingSeconds: this.clock.pendingSeconds,
      inside: this.countInside(),
      kineticEnergy: energy,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.chains.clear();
    this.bodies.clear();
    this.tables.clear();
  }
}
