/**
 * A VRM 1.0 avatar on a model copy from `ZhudaModelLibrary`: what the file's
 * `VRMC_*` extensions describe, applied with the engine's own parts.
 *
 * - **Humanoid**: `bone(name)` is the Laya node of a humanoid bone.
 * - **Expressions**: `setExpression(name, weight)`; each `update` zeroes the
 *   morph targets the expressions move and adds each bind's share, moves
 *   material colours and texture offsets from their rest toward their
 *   targets, with the specification's `isBinary` and override rules
 *   (`zhudaVrmExpressionWeights`).
 * - **Gaze**: `lookAt(point)` or `setGaze(yaw, pitch)` turns the eye bones
 *   or sets the four gaze expressions, through the file's range maps.
 * - **Node constraints**: roll, aim and rotation, each frame.
 * - **Spring bones**: `ZhudaSpringBones` on the engine's solver, each joint
 *   with its own settings (`zhudaVrmSpringSetting`), kept out of its spring's
 *   colliders.
 * - **MToon**: each MToon material drawn as a `ZhudaToonMaterial` with a
 *   shade colour (`zhudaVrmToonPlan`), one for this copy, put back on
 *   `dispose`.
 *
 * It has no timer: `update(seconds)` or `updateFrom(session.layers)` once a
 * frame, after the frame's animation has posed the model
 * (`runAfterAnimation` does that), in the order three-vrm runs them: gaze,
 * expressions, constraints, springs. Make it before any clip plays: the
 * pose the model has then is its rest.
 */
import type { ModelInstance } from './Assets.ts';
import type { ZhudaLayeredClock } from './Clocks.ts';
import { runZhudaAfterAnimation, zhudaQuatMultiply, zhudaQuatRotate } from './Ik.ts';
import {
  ZhudaSpringBones,
  type ZhudaSpringBodyOnNode,
  type ZhudaSpringChainNodes,
} from './SpringBones.ts';
import {
  ZhudaToonMaterial,
  type ZhudaToonOutline,
  type ZhudaToonRim,
  type ZhudaToonShade,
} from '../shaders/ToonMaterial.ts';
import {
  zhudaLinearToSrgb,
  zhudaVrmConstraintRotation,
  zhudaVrmEyeAngles,
  zhudaVrmExpressionWeights,
  zhudaVrmLookWeights,
  zhudaVrmSpringSetting,
  zhudaVrmToonPlan,
  zhudaVrmYawPitch,
  zhudaVrmYawPitchTurn,
  type ZhudaVrmColorType,
  type ZhudaVrmConstraint,
  type ZhudaVrmDocument,
  type ZhudaVrmHumanBoneName,
  type ZhudaVrmIssue,
  type ZhudaVrmMToon,
} from './VrmDocument.ts';

export interface ZhudaVrmOptions {
  /** Draw the MToon materials as toon materials (default true). Without, they stay LayaAir's glTF materials. */
  mtoon?: boolean;
  /** Spring bones (default true): `step` and `maxSteps` as `ZhudaSpringBoneSolver`'s. */
  springBones?: boolean | { step?: number; maxSteps?: number };
  /**
   * Height in pixels of the picture MToon's screen outlines are a share of
   * (`outlineWidthMode: screenCoordinates`). Default: the stage's height, or 1080.
   */
  screenHeight?: number;
  /** Shader name prefix of the toon materials (default `ZhudaVrmMToon`). */
  shaderName?: string;
}

type Quat = [number, number, number, number];
type Vec3 = [number, number, number];
const quat = (q: any): Quat => [q.x, q.y, q.z, q.w];
const point = (p: any): Vec3 => [p.x, p.y, p.z];
const conj = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];
const laya = () => (globalThis as any).Laya;
const issue = (
  path: string,
  message: string,
  code: ZhudaVrmIssue['code'] = 'VRM_INVALID',
): ZhudaVrmIssue => Object.freeze({ code, severity: 'warning' as const, path, message });

interface MorphTarget {
  renderer: any;
  name: string;
}
interface ToonState {
  toon: ZhudaToonMaterial;
  mtoon: ZhudaVrmMToon;
  rim: ZhudaToonRim | null;
  outline: ZhudaToonOutline | null;
  shadeMultiply: boolean;
  tiling: [number, number, number, number];
  /** The colours last written, by type, linear, to skip what did not change. */
  written: Map<string, string>;
}

export class ZhudaVrm {
  readonly vrm: ZhudaVrmDocument;
  readonly instance: ModelInstance;
  /** What the file's reading found, then what this copy could not apply. */
  readonly issues: readonly ZhudaVrmIssue[];
  /** The toon materials made for the MToon materials, by glTF material index. */
  readonly toonMaterials: ReadonlyMap<number, ZhudaToonMaterial>;
  /** The spring bones, one set for each set of colliders the springs use. */
  readonly springBones: readonly ZhudaSpringBones[];
  private readonly weights = new Map<string, number>();
  private applied = new Map<string, number>();
  private readonly morphs = new Map<string, MorphTarget[]>();
  private readonly touched: MorphTarget[] = [];
  private readonly toons = new Map<number, ToonState>();
  /** Materials of this copy that are not MToon, cloned because an expression moves their colour. */
  private readonly clones = new Map<number, { material: any; color: Quat; emission: Vec3 }>();
  /** Each renderer slot this changed, with what it had. */
  private readonly replaced: { renderer: any; slot: number; material: any }[] = [];
  private readonly rest = new Map<number, Quat>();
  private readonly constraints: ZhudaVrmConstraint[] = [];
  private readonly eyes: {
    node: any;
    restLocal: Quat;
    parentRest: Quat;
    side: 'left' | 'right';
  }[] = [];
  private head: { node: any; restModel: Quat } | null = null;
  private gaze: { target: Vec3 } | { yaw: number; pitch: number } | null = null;
  private lastGaze = { yaw: 0, pitch: 0 };
  private disposed = false;

  constructor(instance: ModelInstance, options: ZhudaVrmOptions = {}) {
    if (!instance?.node || typeof instance.gltfNode !== 'function')
      throw Error('ZhudaVrm: a model instance from ZhudaModelLibrary is expected');
    const vrm = instance.vrm;
    if (!vrm) {
      const why = instance.vrmIssues?.find((i) => i.severity === 'error');
      throw Error(
        `ZhudaVrm: not a VRM 1.0 model${why ? `: ${why.message} (${why.path})` : ' (no VRMC_vrm)'}`,
      );
    }
    this.vrm = vrm;
    this.instance = instance;
    const l = laya();
    if (!l?.Quaternion) throw Error('ZhudaVrm: LayaAir 3D must be loaded');
    const issues: ZhudaVrmIssue[] = [...instance.vrmIssues];
    const node = (index: number): any => instance.gltfNode(index);
    const springs: ZhudaSpringBones[] = [];
    const toonMaterials = new Map<number, ZhudaToonMaterial>();
    try {
      // Rest rotations of every node a constraint or the gaze reads.
      const rootTurn = quat(instance.node.transform.rotation);
      const inModel = (n: any): Quat =>
        zhudaQuatMultiply(conj(rootTurn), quat(n.transform.rotation));
      const keepRest = (index: number) => {
        const n = node(index);
        if (n && !this.rest.has(index)) this.rest.set(index, quat(n.transform.localRotation));
        return n;
      };
      // Expressions: their morph targets.
      for (const e of vrm.expressions) {
        const targets: MorphTarget[] = [];
        e.morphs.forEach((bind, i) => {
          const n = node(bind.node);
          const renderer = n && instance.gltfMaterialSlots.find((s) => s.node === n)?.renderer;
          const data = n?.getComponent?.(l.MeshFilter)?.sharedMesh?.morphTargetData;
          const channel =
            data && bind.index < data.channelCount ? data.getMorphChannelbyIndex(bind.index) : null;
          if (!renderer || !channel) {
            issues.push(
              issue(
                `$.extensions.VRMC_vrm.expressions.${e.name}.morphTargetBinds[${i}]`,
                `node ${bind.node} has no morph target ${bind.index} in this copy; the bind is not applied`,
                'VRM_EXPRESSION',
              ),
            );
            return;
          }
          const target = { renderer, name: channel.name };
          targets.push(target);
          if (!this.touched.some((t) => t.renderer === renderer && t.name === channel.name))
            this.touched.push(target);
        });
        this.morphs.set(e.name, targets);
      }
      // MToon materials as toon materials.
      const height =
        options.screenHeight ??
        (Number.isFinite(l.stage?.height) && l.stage.height > 0 ? l.stage.height : 1080);
      const prefix = options.shaderName ?? 'ZhudaVrmMToon';
      if (!/^Zhuda[A-Za-z0-9_]{1,80}$/.test(prefix))
        throw Error('ZhudaVrm: shaderName is Zhuda, then letters, digits or _');
      if (options.mtoon !== false)
        for (const m of vrm.mtoon) {
          const used = instance.gltfMaterialSlots.some((s) => s.materials.includes(m.material));
          if (!used) continue;
          const plan = zhudaVrmToonPlan(m, { screenHeight: height });
          issues.push(...plan.issues);
          const texture = (i: number | null) =>
            i === null ? undefined : (instance.gltfTexture(i) ?? undefined);
          const textures = Object.fromEntries(
            Object.entries({
              albedo: texture(plan.textures.albedo),
              normal: texture(plan.textures.normal),
              emission: texture(plan.textures.emission),
            }).filter(([, t]) => t),
          );
          const toon = new ZhudaToonMaterial({
            ...plan.spec,
            name: `${prefix}${plan.spec.outline ? 'Outline' : ''}`,
            material: { ...plan.spec.material, textures },
          });
          toonMaterials.set(m.material, toon);
          const tiling = [...plan.tilingOffset] as [number, number, number, number];
          toon.material.tilingOffset = new l.Vector4(...tiling);
          if (plan.renderQueueOffset) toon.material.renderQueue += plan.renderQueueOffset;
          this.toons.set(m.material, {
            toon,
            mtoon: m,
            rim: plan.spec.rim ?? null,
            outline: plan.spec.outline ?? null,
            shadeMultiply: plan.spec.shade?.multiply !== false,
            tiling,
            written: new Map(),
          });
          this.swap(m.material, toon.material);
        }
      // Materials an expression recolours that are not toon: a copy of their own.
      for (const e of vrm.expressions)
        e.colors.forEach((bind, i) => {
          if (this.toons.has(bind.material) || this.clones.has(bind.material)) return;
          const slot = instance.gltfMaterialSlots.find((s) => s.materials.includes(bind.material));
          const original = slot?.renderer.sharedMaterials[slot.materials.indexOf(bind.material)];
          if (!original) return;
          if (!['color', 'emissionColor'].includes(bind.type)) {
            issues.push(
              issue(
                `$.extensions.VRMC_vrm.expressions.${e.name}.materialColorBinds[${i}]`,
                `${bind.type} of a material that is not MToon is not applied`,
                'VRM_EXPRESSION',
              ),
            );
            return;
          }
          const copy = original.clone();
          this.clones.set(bind.material, {
            material: copy,
            color: readPbrColor(copy),
            emission: readPbrEmission(copy),
          });
          this.swap(bind.material, copy);
        });
      for (const e of vrm.expressions) {
        e.colors.forEach((bind, i) => {
          if (bind.type === 'matcapColor')
            issues.push(
              issue(
                `$.extensions.VRMC_vrm.expressions.${e.name}.materialColorBinds[${i}]`,
                'matcapColor is not drawn',
                'VRM_EXPRESSION',
              ),
            );
          else if (bind.type === 'outlineColor' && !this.toons.get(bind.material)?.outline)
            issues.push(
              issue(
                `$.extensions.VRMC_vrm.expressions.${e.name}.materialColorBinds[${i}]`,
                'outlineColor of a material without an outline is not drawn',
                'VRM_EXPRESSION',
              ),
            );
        });
        e.textures.forEach((bind, i) => {
          if (!this.toons.has(bind.material))
            issues.push(
              issue(
                `$.extensions.VRMC_vrm.expressions.${e.name}.textureTransformBinds[${i}]`,
                'a texture transform of a material that is not MToon is not applied',
                'VRM_EXPRESSION',
              ),
            );
        });
      }
      // Gaze: the head's rest in the model, each eye's rest and its parent's.
      const headIndex = vrm.humanBones.head;
      const headNode = headIndex === undefined ? null : node(headIndex);
      if (headNode) this.head = { node: headNode, restModel: inModel(headNode) };
      for (const side of ['left', 'right'] as const) {
        const index = vrm.humanBones[`${side}Eye`];
        const eye = index === undefined ? null : node(index);
        if (eye && eye.parent?.transform)
          this.eyes.push({
            node: eye,
            restLocal: quat(eye.transform.localRotation),
            parentRest: inModel(eye.parent),
            side,
          });
      }
      // Constraints, each after the one its source is.
      const ordered: ZhudaVrmConstraint[] = [];
      const pending = [...vrm.constraints];
      while (pending.length) {
        const ready = pending.findIndex((c) => !pending.some((o) => o.node === c.source));
        ordered.push(...pending.splice(ready < 0 ? 0 : ready, 1));
      }
      for (const c of ordered) {
        const dst = keepRest(c.node),
          src = keepRest(c.source);
        if (!dst || !src) {
          issues.push(
            issue(
              `$.nodes[${c.node}].extensions.VRMC_node_constraint`,
              'its node or source is not in this copy; it is not applied',
              'VRM_CONSTRAINT',
            ),
          );
          continue;
        }
        this.constraints.push(c);
      }
      // Spring bones, one set for each set of colliders.
      const springOptions =
        options.springBones === undefined || options.springBones === true
          ? {}
          : options.springBones;
      if (springOptions && vrm.springBone) {
        const step = springOptions.step ?? 1 / 120;
        const sets = new Map<string, { chains: ZhudaSpringChainNodes[]; colliders: number[] }>();
        vrm.springBone.springs.forEach((spring, i) => {
          const path = `$.extensions.VRMC_springBone.springs[${i}]`;
          const nodes = spring.joints.map((j) => node(j.node));
          const broken = nodes.findIndex((n, k) => !n || (k > 0 && n.parent !== nodes[k - 1]));
          if (broken >= 0) {
            issues.push(
              issue(
                `${path}.joints[${broken}]`,
                nodes[broken]
                  ? 'each joint after the first is to be a child of the one before; the spring is not applied'
                  : 'its node is not in this copy; the spring is not applied',
                'VRM_SPRING',
              ),
            );
            return;
          }
          if (spring.center !== null)
            issues.push(
              issue(
                `${path}.center`,
                'a center space is not applied: the spring moves in the world',
                'VRM_SPRING',
              ),
            );
          const bones = spring.joints.slice(0, -1).map((joint, k) => {
            const a = point(nodes[k].transform.position),
              b = point(nodes[k + 1].transform.position);
            return zhudaVrmSpringSetting(
              joint,
              Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])),
              step,
            );
          });
          const colliders = [
            ...new Set(
              spring.colliderGroups.flatMap((g) => vrm.springBone!.colliderGroups[g].colliders),
            ),
          ].sort((a, b) => a - b);
          const key = colliders.join(',');
          const set = sets.get(key) ?? { chains: [], colliders };
          set.chains.push({ nodes, bones });
          sets.set(key, set);
        });
        for (const { chains, colliders } of sets.values()) {
          const bodies: ZhudaSpringBodyOnNode[] = [];
          for (const index of colliders) {
            const c = vrm.springBone.colliders[index];
            const n = node(c.node);
            const path = `$.extensions.VRMC_springBone.colliders[${index}]`;
            if (!n) {
              issues.push(
                issue(path, 'its node is not in this copy; it is left out', 'VRM_COLLIDER'),
              );
              continue;
            }
            if (!(c.shape.radius > 0)) {
              issues.push(
                issue(
                  `${path}.shape`,
                  'a radius of 0 keeps nothing out; it is left out',
                  'VRM_COLLIDER',
                ),
              );
              continue;
            }
            bodies.push(
              c.shape.type === 'sphere'
                ? { node: n, type: 'sphere', center: c.shape.offset, radius: c.shape.radius }
                : {
                    node: n,
                    type: 'capsule',
                    a: c.shape.offset,
                    b: c.shape.tail,
                    radius: c.shape.radius,
                  },
            );
          }
          springs.push(
            new ZhudaSpringBones({
              ...(springOptions.step !== undefined ? { step: springOptions.step } : {}),
              ...(springOptions.maxSteps !== undefined ? { maxSteps: springOptions.maxSteps } : {}),
              chains,
              colliders: bodies,
            }),
          );
        }
      }
      if (vrm.firstPerson.length)
        issues.push(
          issue(
            '$.extensions.VRMC_vrm.firstPerson',
            'first-person mesh annotations are read (vrm.firstPerson) and not applied',
            'VRM_FIRST_PERSON',
          ),
        );
    } catch (error) {
      for (const s of springs) s.dispose();
      this.restore();
      for (const t of toonMaterials.values()) t.dispose();
      throw error;
    }
    this.toonMaterials = toonMaterials;
    this.springBones = springs;
    this.issues = Object.freeze(issues);
  }

  /** Puts `material` in every slot of this copy made from glTF material `index`. */
  private swap(index: number, material: any) {
    for (const slot of this.instance.gltfMaterialSlots) {
      if (!slot.materials.includes(index)) continue;
      const list = [...slot.renderer.sharedMaterials];
      slot.materials.forEach((m, k) => {
        if (m !== index) return;
        this.replaced.push({ renderer: slot.renderer, slot: k, material: list[k] });
        list[k] = material;
      });
      slot.renderer.sharedMaterials = list;
    }
  }
  private restore() {
    for (const { renderer, slot, material } of this.replaced.reverse()) {
      if (renderer.destroyed) continue;
      const list = [...renderer.sharedMaterials];
      list[slot] = material;
      renderer.sharedMaterials = list;
    }
    this.replaced.length = 0;
    for (const { material } of this.clones.values()) if (!material.destroyed) material.destroy();
    this.clones.clear();
  }
  private alive() {
    if (this.disposed) throw Error('Disposed VRM');
  }

  /** The Laya node of a humanoid bone, or null when the model has none. */
  bone(name: ZhudaVrmHumanBoneName): any | null {
    this.alive();
    const index = this.vrm.humanBones[name];
    return index === undefined ? null : this.instance.gltfNode(index);
  }
  /** The model's expressions: the presets it has, then its custom ones. */
  get expressionNames(): string[] {
    return this.vrm.expressions.map((e) => e.name);
  }
  /** Sets an expression's weight, 0..1 (clamped), applied at the next `update`. */
  setExpression(name: string, weight: number): void {
    this.alive();
    if (!this.vrm.expressions.some((e) => e.name === name))
      throw Error(
        `Unknown VRM expression ${name}; this model has ${this.expressionNames.join(', ') || 'none'}`,
      );
    if (!Number.isFinite(weight)) throw Error('VRM expression weight: a number 0..1');
    this.weights.set(name, Math.min(1, Math.max(0, weight)));
  }
  /** An expression's weight as set (not as applied). */
  expression(name: string): number {
    return this.weights.get(name) ?? 0;
  }
  /** Every weight back to 0. */
  resetExpressions(): void {
    this.alive();
    this.weights.clear();
  }
  /** The weights the last `update` applied, after `isBinary` and the overrides. */
  get appliedExpressions(): ReadonlyMap<string, number> {
    return this.applied;
  }
  /** Looks at a point in the world (metres) from the next `update` on; `null` looks ahead again. */
  lookAt(target: readonly [number, number, number] | null): void {
    this.alive();
    if (
      target !== null &&
      !(Array.isArray(target) && target.length === 3 && target.every(Number.isFinite))
    )
      throw Error('VRM lookAt: [x, y, z] in the world, or null');
    this.gaze = target ? { target: [target[0], target[1], target[2]] } : null;
  }
  /** Looks by angles, degrees, in the gaze's own space: yaw toward the model's left, pitch down. */
  setGaze(yawDeg: number, pitchDeg: number): void {
    this.alive();
    if (!Number.isFinite(yawDeg) || !Number.isFinite(pitchDeg))
      throw Error('VRM gaze: finite degrees');
    this.gaze = { yaw: yawDeg, pitch: pitchDeg };
  }
  /** The yaw and pitch the last `update` looked at, degrees. */
  get gazeAngles(): { yaw: number; pitch: number } {
    return { ...this.lastGaze };
  }

  /** The gaze's own space now: where it is in the world and how it is turned. */
  private gazeSpace(): { origin: Vec3; turn: Quat } | null {
    if (!this.head) return null;
    const l = laya();
    const head = this.head.node;
    const offset = this.vrm.lookAt.offsetFromHeadBone;
    const origin = new l.Vector3();
    l.Vector3.transformCoordinate(
      new l.Vector3(offset[0], offset[1], offset[2]),
      head.transform.worldMatrix,
      origin,
    );
    return {
      origin: point(origin),
      turn: zhudaQuatMultiply(quat(head.transform.rotation), conj(this.head.restModel)),
    };
  }

  /** Runs one frame: gaze, expressions, constraints, then the springs on `deltaSeconds`. */
  update(deltaSeconds: number): void {
    this.alive();
    if (!(Number.isFinite(deltaSeconds) && deltaSeconds >= 0))
      throw Error('VRM update: seconds from 0');
    this.updateGaze();
    this.updateExpressions();
    this.updateConstraints();
    for (const s of this.springBones) s.update(deltaSeconds);
  }
  /** The same, with a layer of the engine's clock (default `world`). */
  updateFrom(layers: ZhudaLayeredClock, layer = 'world'): void {
    const delta = layers?.scaledDeltas?.get(layer);
    if (delta === undefined) throw Error(`Unknown time layer: ${layer}`);
    this.update(delta);
  }
  /** Calls `updateFrom(layers)` each frame once LayaAir's animation has posed the model; returns the stop. */
  runAfterAnimation(layers: ZhudaLayeredClock, layer = 'world'): () => void {
    this.alive();
    return runZhudaAfterAnimation(this.instance.node, () => {
      if (!this.disposed) this.updateFrom(layers, layer);
    });
  }
  /** The springs put back at rest where the model is now: after it was put elsewhere at once. */
  resetSpringBones(): void {
    this.alive();
    for (const s of this.springBones) s.reset();
  }

  private updateGaze() {
    let yaw = 0,
      pitch = 0;
    if (this.gaze && 'target' in this.gaze) {
      const space = this.gazeSpace();
      if (space) {
        const t = this.gaze.target;
        const local = zhudaQuatRotate(conj(space.turn), [
          t[0] - space.origin[0],
          t[1] - space.origin[1],
          t[2] - space.origin[2],
        ]);
        ({ yaw, pitch } = zhudaVrmYawPitch(local));
      }
    } else if (this.gaze) ({ yaw, pitch } = this.gaze);
    this.lastGaze = { yaw, pitch };
    const look = this.vrm.lookAt;
    if (look.type === 'expression') {
      if (!this.gaze) return;
      const w = zhudaVrmLookWeights(look, yaw, pitch);
      for (const [name, value] of Object.entries(w))
        if (this.vrm.expressions.some((e) => e.name === name))
          this.weights.set(name, Math.min(1, Math.max(0, value)));
      return;
    }
    if (this.eyes.length < 2) return;
    const angles = zhudaVrmEyeAngles(look, yaw, pitch);
    const l = laya();
    for (const eye of this.eyes) {
      const a = angles[eye.side];
      const turn = zhudaVrmYawPitchTurn(a.yaw, a.pitch);
      // The turn is about the model's axes at rest, carried into the eye's parent.
      const local = zhudaQuatMultiply(
        zhudaQuatMultiply(zhudaQuatMultiply(conj(eye.parentRest), turn), eye.parentRest),
        eye.restLocal,
      );
      eye.node.transform.localRotation = new l.Quaternion(local[0], local[1], local[2], local[3]);
    }
  }

  private updateExpressions() {
    const applied = zhudaVrmExpressionWeights(this.vrm.expressions, this.weights);
    this.applied = applied;
    // Morph targets: from 0, each bind's share added.
    const sums = new Map<MorphTarget, number>();
    for (const t of this.touched) sums.set(t, 0);
    const find = (renderer: any, name: string) =>
      this.touched.find((t) => t.renderer === renderer && t.name === name)!;
    for (const e of this.vrm.expressions) {
      const w = applied.get(e.name) ?? 0;
      if (!w) continue;
      const targets = this.morphs.get(e.name) ?? [];
      targets.forEach((t, i) => {
        const key = find(t.renderer, t.name);
        sums.set(key, sums.get(key)! + e.morphs[i].weight * w);
      });
    }
    for (const [t, value] of sums)
      if (!t.renderer.destroyed) t.renderer.setMorphChannelWeight(t.name, value);
    // Material colours and texture offsets: rest + each expression's share of the way to its target.
    for (const [index, state] of this.toons) this.updateToon(index, state, applied);
    for (const [index, clone] of this.clones) {
      let color = [...clone.color],
        emission = [...clone.emission];
      for (const e of this.vrm.expressions) {
        const w = applied.get(e.name) ?? 0;
        if (!w) continue;
        for (const b of e.colors)
          if (b.material === index) {
            if (b.type === 'color')
              color = color.map((v, k) => v + (b.target[k] - clone.color[k]) * w);
            else if (b.type === 'emissionColor')
              emission = emission.map((v, k) => v + (b.target[k] - clone.emission[k]) * w);
          }
      }
      writePbrColor(clone.material, color as Quat, emission as Vec3);
    }
  }

  private updateToon(index: number, s: ToonState, applied: ReadonlyMap<string, number>) {
    const m = s.mtoon;
    const rest: Record<ZhudaVrmColorType, number[]> = {
      color: [...m.baseColorFactor],
      emissionColor: [...m.emissiveFactor, 1],
      shadeColor: [...m.shadeColorFactor, 1],
      matcapColor: [...m.matcapFactor, 1],
      rimColor: [...m.parametricRimColorFactor, 1],
      outlineColor: [...m.outlineColorFactor, 1],
    };
    const now: Record<string, number[]> = Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, [...v]]),
    );
    const tiling = [...s.tiling];
    for (const e of this.vrm.expressions) {
      const w = applied.get(e.name) ?? 0;
      if (!w) continue;
      for (const b of e.colors)
        if (b.material === index)
          now[b.type] = now[b.type].map((v, k) => v + (b.target[k] - rest[b.type][k]) * w);
      for (const b of e.textures)
        if (b.material === index) {
          tiling[0] += (b.scale[0] - s.tiling[0]) * w;
          tiling[1] += (b.scale[1] - s.tiling[1]) * w;
          tiling[2] += (b.offset[0] - s.tiling[2]) * w;
          tiling[3] += (b.offset[1] - s.tiling[3]) * w;
        }
    }
    const l = laya();
    const changed = (key: string, value: number[]) => {
      const text = value.join(',');
      if (s.written.get(key) === text) return false;
      s.written.set(key, text);
      return true;
    };
    const display = (c: number[]): [number, number, number] => [
      zhudaLinearToSrgb(c[0]),
      zhudaLinearToSrgb(c[1]),
      zhudaLinearToSrgb(c[2]),
    ];
    const mat = s.toon.material;
    if (changed('color', now.color))
      mat.albedoColor = new l.Color(...display(now.color), Math.min(1, Math.max(0, now.color[3])));
    if (changed('emissionColor', now.emissionColor))
      mat.emissionColor = new l.Color(...display(now.emissionColor), 1);
    if (changed('shadeColor', [...now.shadeColor, ...now.color])) {
      const shade: ZhudaToonShade = s.shadeMultiply
        ? {
            color: display(
              now.shadeColor.map((v, k) => Math.min(1, v / Math.max(1e-4, m.baseColorFactor[k]))),
            ),
            multiply: true,
          }
        : { color: display(now.shadeColor), multiply: false };
      s.toon.setShade(shade);
    }
    if (changed('rimColor', now.rimColor)) {
      const on = now.rimColor.slice(0, 3).some((v) => v > 0);
      s.toon.setRim(
        on
          ? {
              ...(s.rim ?? { width: 0.3, strength: 1, softness: 0.15 }),
              color: display(now.rimColor),
            }
          : null,
      );
    }
    if (s.outline && changed('outlineColor', now.outlineColor))
      s.toon.setOutline({ ...s.outline, color: display(now.outlineColor) });
    if (changed('tiling', tiling)) mat.tilingOffset = new l.Vector4(...tiling);
  }

  private updateConstraints() {
    if (!this.constraints.length) return;
    const l = laya();
    for (const c of this.constraints) {
      const dst: any = this.instance.gltfNode(c.node),
        src: any = this.instance.gltfNode(c.source);
      if (!dst || !src || dst.destroyed || src.destroyed) continue;
      const turn = zhudaVrmConstraintRotation(c, {
        nodeRest: this.rest.get(c.node)!,
        sourceRest: this.rest.get(c.source)!,
        source: quat(src.transform.localRotation),
        ...(c.type === 'aim'
          ? {
              parentWorld: dst.parent?.transform
                ? quat(dst.parent.transform.rotation)
                : [0, 0, 0, 1],
              nodePosition: point(dst.transform.position),
              sourcePosition: point(src.transform.position),
            }
          : {}),
      });
      dst.transform.localRotation = new l.Quaternion(turn[0], turn[1], turn[2], turn[3]);
    }
  }

  /**
   * Lets go of what it made: the springs, the toon materials and copies
   * (the model's own materials go back on), the morph targets to 0. The
   * model's nodes keep the pose they have.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const s of this.springBones) s.dispose();
    for (const t of this.touched)
      if (!t.renderer.destroyed) t.renderer.setMorphChannelWeight(t.name, 0);
    this.restore();
    for (const t of this.toonMaterials.values()) t.dispose();
  }
}

/** A glTF material's base colour (linear, four numbers), as LayaAir holds it. */
function readPbrColor(m: any): Quat {
  const v = m.getVector4?.('u_BaseColorFactor');
  if (v) return [v.x, v.y, v.z, v.w];
  const c = m.albedoColor;
  return c ? [c.r, c.g, c.b, c.a] : [1, 1, 1, 1];
}
function readPbrEmission(m: any): Vec3 {
  const v = m.getVector3?.('u_EmissionFactor');
  return v ? [v.x, v.y, v.z] : [0, 0, 0];
}
function writePbrColor(m: any, color: Quat, emission: Vec3) {
  const l = laya();
  if (m.getVector4?.('u_BaseColorFactor'))
    m.setVector4('u_BaseColorFactor', new l.Vector4(...color));
  else if (m.albedoColor) m.albedoColor = new l.Color(...color);
  if (m.getVector3?.('u_EmissionFactor'))
    m.setVector3('u_EmissionFactor', new l.Vector3(...emission));
}
