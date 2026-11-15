/**
 * Spring bones on a model: chains of LayaAir nodes (a model's bones, each a
 * child of the one before) turned by a `ZhudaSpringBoneSolver`. The first
 * node of a chain swings from where its parent holds it; the last node is
 * the chain's end and is not turned itself.
 *
 * It has no timer: each frame, once the animation has posed the model, it
 * is given the delta of a layer of the engine's clock (`update(seconds)` or
 * `updateFrom(session.layers)`). `runZhudaAfterAnimation` is the place to
 * call it from while a clip plays.
 */
import {
  ZhudaSpringBoneSolver,
  type ZhudaSpringBoneOptions,
  type ZhudaSpringChainOptions,
} from '../simulation/SpringBones.ts';
import type { ZhudaCollider } from '../simulation/ParticleCore.ts';
import type { ZhudaLayeredClock } from './Clocks.ts';
import { zhudaQuatRotate } from './Ik.ts';

export interface ZhudaSpringChainNodes extends ZhudaSpringChainOptions {
  /** Two or more nodes, each a child of the one before: the bones, and the chain's end last. */
  nodes: readonly any[];
}
/** A body that goes with a node: a ball or a rod given in the node's own space. */
export type ZhudaSpringBodyOnNode =
  | { node: any; type: 'sphere'; center?: readonly [number, number, number]; radius: number }
  | {
      node: any;
      type: 'capsule';
      a: readonly [number, number, number];
      b: readonly [number, number, number];
      radius: number;
    };
export interface ZhudaSpringBonesSpec extends ZhudaSpringBoneOptions {
  chains: readonly ZhudaSpringChainNodes[];
  /** Bodies the joints are kept out of: with a `node` they follow it; without, they stand in the world. */
  colliders?: readonly (ZhudaSpringBodyOnNode | ZhudaCollider)[];
}

type Quat = [number, number, number, number];
const quat = (q: any): Quat => [q.x, q.y, q.z, q.w];
const point = (p: any): [number, number, number] => [p.x, p.y, p.z];
const conjugate = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];

export class ZhudaSpringBones {
  readonly solver: ZhudaSpringBoneSolver;
  private readonly chains: { id: number; nodes: any[] }[] = [];
  private readonly followers: { id: number; body: ZhudaSpringBodyOnNode }[] = [];
  private disposed = false;

  constructor(spec: ZhudaSpringBonesSpec) {
    if (spec === null || typeof spec !== 'object' || !Array.isArray(spec.chains))
      throw Error('Spring bones: { chains: [...] } is expected');
    const { chains, colliders = [], ...options } = spec;
    this.solver = new ZhudaSpringBoneSolver(options);
    try {
      for (const { nodes, ...chainOptions } of chains) {
        if (!Array.isArray(nodes) || nodes.length < 2 || nodes.length > 257)
          throw Error('Spring bones: a chain is 2 to 257 nodes');
        nodes.forEach((node, i) => {
          if (!node?.transform || node.destroyed)
            throw Error('Spring bones: live nodes with a transform are expected');
          if (i && node.parent !== nodes[i - 1])
            throw Error('Spring bones: each node of a chain is a child of the one before');
        });
        // As the chain is now is its rest: each bone's rotation in its parent, and the way to the next joint.
        const rotations: Quat[] = [],
          axes: [number, number, number][] = [],
          lengths: number[] = [];
        for (let i = 0; i < nodes.length - 1; i++) {
          const here = point(nodes[i].transform.position),
            there = point(nodes[i + 1].transform.position);
          const way: [number, number, number] = [
            there[0] - here[0],
            there[1] - here[1],
            there[2] - here[2],
          ];
          const far = Math.hypot(way[0], way[1], way[2]);
          if (!(far > 1e-6)) throw Error('Spring bones: two joints of a chain are in one place');
          rotations.push(quat(nodes[i].transform.localRotation));
          axes.push(zhudaQuatRotate(conjugate(quat(nodes[i].transform.rotation)), way));
          lengths.push(far);
        }
        const id = this.solver.addChain({ rotations, axes, lengths }, chainOptions);
        this.chains.push({ id, nodes: [...nodes] });
      }
      for (const body of colliders) {
        if ((body as any)?.node !== undefined) {
          const follower = body as ZhudaSpringBodyOnNode;
          if (!follower.node?.transform || follower.node.destroyed)
            throw Error('Spring bones: a body follows a live node');
          if (follower.type !== 'sphere' && follower.type !== 'capsule')
            throw Error('Spring bones: a body on a node is a sphere or a capsule');
          this.followers.push({
            id: this.solver.addCollider(this.inWorld(follower)),
            body: follower,
          });
        } else this.solver.addCollider(body as ZhudaCollider);
      }
      this.anchor();
    } catch (error) {
      this.solver.dispose();
      throw error;
    }
  }

  /** A body given in a node's space, where the node is now. */
  private inWorld(body: ZhudaSpringBodyOnNode): ZhudaCollider {
    const at = point(body.node.transform.position),
      turn = quat(body.node.transform.rotation);
    const place = (local: readonly [number, number, number]): [number, number, number] => {
      const turned = zhudaQuatRotate(turn, local);
      return [at[0] + turned[0], at[1] + turned[1], at[2] + turned[2]];
    };
    return body.type === 'sphere'
      ? { type: 'sphere', center: place(body.center ?? [0, 0, 0]), radius: body.radius }
      : { type: 'capsule', a: place(body.a), b: place(body.b), radius: body.radius };
  }

  /** Tells the solver where each chain hangs from now. */
  private anchor() {
    for (const { id, nodes } of this.chains) {
      const parent = nodes[0].parent?.transform;
      this.solver.setAnchor(
        id,
        point(nodes[0].transform.position),
        parent ? quat(parent.rotation) : [0, 0, 0, 1],
      );
    }
  }

  /**
   * Takes a delta in seconds, once the frame's animation has posed the
   * model: the chains are told where they hang from, the bodies where their
   * nodes are, the whole steps the delta holds are run, and the bones are
   * turned. Zero changes nothing.
   */
  update(deltaSeconds: number): { steps: number; dropped: number } {
    if (this.disposed) throw Error('Disposed spring bones');
    this.anchor();
    for (const { id, body } of this.followers) this.solver.setCollider(id, this.inWorld(body));
    const result = this.solver.advance(deltaSeconds);
    if (result.steps) this.turn();
    return result;
  }

  /** The same, with the delta a layer of the engine's clock has for this frame (default `world`). */
  updateFrom(layers: ZhudaLayeredClock, layer = 'world'): { steps: number; dropped: number } {
    const delta = layers?.scaledDeltas?.get(layer);
    if (delta === undefined) throw Error(`Unknown time layer: ${layer}`);
    return this.update(delta);
  }

  /** The chains put back at rest where they hang now, still: after the model was put elsewhere at once. */
  reset() {
    if (this.disposed) throw Error('Disposed spring bones');
    this.anchor();
    this.solver.reset();
    this.turn();
  }

  /** Turns each bone to the solver's rotation, the one nearest the root first. */
  private turn() {
    const l = (globalThis as any).Laya;
    for (const { id, nodes } of this.chains) {
      const rotations = this.solver.rotations(id);
      for (let i = 0; i < nodes.length - 1; i++)
        nodes[i].transform.rotation = new l.Quaternion(
          rotations[i * 4],
          rotations[i * 4 + 1],
          rotations[i * 4 + 2],
          rotations[i * 4 + 3],
        );
    }
  }

  /** Lets go of the solver; the nodes are left as they are and are their owner's. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.solver.dispose();
  }
}
