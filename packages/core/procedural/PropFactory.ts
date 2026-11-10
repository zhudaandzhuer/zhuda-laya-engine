/**
 * Parametric props: a factory returns named mesh parts, box colliders with a
 * surface tag, and optional sockets. Everything is plain data until
 * `instantiateZhudaPropBatches` hands merged meshes to the renderer.
 *
 * The engine owns this mechanism. Which props exist, what they look like and
 * what a surface tag means (footsteps, impacts) stay with the consumer.
 */
import { ZhudaDynamicMesh, computeMeshTangents, type MeshData } from '../runtime3d/Surfaces.ts';
import {
  computeZhudaMeshBounds,
  mergeZhudaMeshes,
  transformZhudaMesh,
  type ZhudaVec3,
} from './Geometry.ts';
import { createZhudaRandom, type ZhudaRandom } from './Random.ts';

export interface ZhudaPropCollider {
  min: ZhudaVec3;
  max: ZhudaVec3;
  /** Consumer-defined tag such as metal, wood or concrete. */
  surface: string;
}
export interface ZhudaPropPart {
  name: string;
  /** Logical material name; the consumer maps it to a real material. */
  material: string;
  mesh: MeshData;
}
export interface ZhudaPropBuild {
  parts: ZhudaPropPart[];
  colliders: ZhudaPropCollider[];
  sockets?: Record<string, ZhudaVec3>;
}
export interface ZhudaPropDefinition<P extends object = Record<string, never>> {
  id: string;
  /** Nominal width (X), height (Y) and depth (Z) in metres. The origin is the middle of the underside. */
  size: ZhudaVec3;
  defaults: P;
  build(params: P, random: ZhudaRandom): ZhudaPropBuild;
}
export interface ZhudaPropPlacement {
  position: ZhudaVec3;
  /** Rotation about +Y in degrees. */
  yawDeg?: number;
  params?: object;
  seed?: number;
  /** Stable instance name for evidence and debugging; defaults to id#index. */
  instance?: string;
}
export interface ZhudaPlacedProp {
  id: string;
  instance: string;
  position: ZhudaVec3;
  yawDeg: number;
  /** World-space parts. */
  parts: ZhudaPropPart[];
  /** World-space axis-aligned boxes. A rotated box becomes several smaller ones. */
  colliders: ZhudaPropCollider[];
  sockets: Record<string, ZhudaVec3>;
}
export interface ZhudaPropBatch {
  material: string;
  meshes: MeshData[];
  triangles: number;
}

const ID = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const isVec = (value: unknown): value is ZhudaVec3 =>
  Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n));

function checkBuild(definition: ZhudaPropDefinition<any>, build: ZhudaPropBuild): void {
  const where = `Prop ${definition.id}`;
  if (!build || !Array.isArray(build.parts) || !build.parts.length)
    throw Error(`${where}: build() must return at least one part`);
  if (!Array.isArray(build.colliders)) throw Error(`${where}: colliders must be an array`);
  const [w, h, d] = definition.size,
    slack = (side: number) => 0.05 + side * 0.02,
    names = new Set<string>();
  for (const part of build.parts) {
    if (!part || typeof part.name !== 'string' || !part.name || names.has(part.name))
      throw Error(`${where}: part names must be unique and non-empty`);
    names.add(part.name);
    if (typeof part.material !== 'string' || !part.material)
      throw Error(`${where}/${part.name}: material name required`);
    const mesh = part.mesh;
    if (
      !mesh ||
      !(mesh.positions instanceof Float32Array) ||
      mesh.positions.length < 9 ||
      mesh.positions.length % 3 ||
      !mesh.indices.length ||
      mesh.indices.length % 3 ||
      !mesh.positions.every(Number.isFinite)
    )
      throw Error(`${where}/${part.name}: invalid mesh data`);
    const { min, max } = computeZhudaMeshBounds(mesh);
    if (
      min[0] < -w / 2 - slack(w) ||
      max[0] > w / 2 + slack(w) ||
      min[1] < -slack(h) ||
      max[1] > h + slack(h) ||
      min[2] < -d / 2 - slack(d) ||
      max[2] > d / 2 + slack(d)
    )
      throw Error(
        `${where}/${part.name}: geometry leaves the declared ${w} x ${h} x ${d} m size; fix the part or the size`,
      );
  }
  for (const collider of build.colliders) {
    if (
      !collider ||
      !isVec(collider.min) ||
      !isVec(collider.max) ||
      collider.min.some((value, axis) => value >= collider.max[axis]) ||
      typeof collider.surface !== 'string' ||
      !collider.surface
    )
      throw Error(`${where}: each collider needs min < max and a surface tag`);
  }
  for (const [name, socket] of Object.entries(build.sockets ?? {}))
    if (!name || !isVec(socket)) throw Error(`${where}: invalid socket ${name}`);
}

const yawOf = (yawDeg: number) => {
  const a = (yawDeg * Math.PI) / 180;
  return { c: Math.cos(a), s: Math.sin(a) };
};
const turn = (p: ZhudaVec3, yaw: { c: number; s: number }, at: ZhudaVec3): ZhudaVec3 => [
  yaw.c * p[0] + yaw.s * p[2] + at[0],
  p[1] + at[1],
  -yaw.s * p[0] + yaw.c * p[2] + at[2],
];

/**
 * Moves a local box into world space. Axis-aligned physics cannot hold a
 * rotated box, so an oblique one is cut along its long side into up to ten
 * slices; each slice's bounds is returned.
 */
export function rotateZhudaCollider(
  collider: ZhudaPropCollider,
  yawDeg: number,
  position: ZhudaVec3,
): ZhudaPropCollider[] {
  const yaw = yawOf(yawDeg),
    lenX = collider.max[0] - collider.min[0],
    lenZ = collider.max[2] - collider.min[2],
    oblique = Math.abs(Math.sin((2 * yawDeg * Math.PI) / 180)) > 0.2,
    axis = lenX >= lenZ ? 0 : 2,
    long = Math.max(lenX, lenZ),
    short = Math.max(0.25, Math.min(lenX, lenZ)),
    slices = oblique ? Math.min(10, Math.max(1, Math.round(long / short))) : 1,
    out: ZhudaPropCollider[] = [];
  for (let i = 0; i < slices; i++) {
    const min: ZhudaVec3 = [...collider.min],
      max: ZhudaVec3 = [...collider.max];
    min[axis] = collider.min[axis] + (long * i) / slices;
    max[axis] = collider.min[axis] + (long * (i + 1)) / slices;
    const world = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const x of [min[0], max[0]])
      for (const z of [min[2], max[2]]) {
        const p = turn([x, 0, z], yaw, position);
        world.min[0] = Math.min(world.min[0], p[0]);
        world.max[0] = Math.max(world.max[0], p[0]);
        world.min[2] = Math.min(world.min[2], p[2]);
        world.max[2] = Math.max(world.max[2], p[2]);
      }
    world.min[1] = min[1] + position[1];
    world.max[1] = max[1] + position[1];
    out.push({
      min: world.min as ZhudaVec3,
      max: world.max as ZhudaVec3,
      surface: collider.surface,
    });
  }
  return out;
}

export class ZhudaPropRegistry {
  private readonly definitions = new Map<string, ZhudaPropDefinition<any>>();
  private placed = 0;

  /** Definitions keep their own parameter type; the registry stores them untyped. */
  register(definition: ZhudaPropDefinition<any>): this {
    if (!definition || typeof definition.id !== 'string' || !ID.test(definition.id))
      throw Error('Prop id must use lowercase letters, digits, dot, dash or underscore');
    if (this.definitions.has(definition.id)) throw Error(`Duplicate prop id: ${definition.id}`);
    if (!isVec(definition.size) || definition.size.some((n) => n <= 0))
      throw Error(`Prop ${definition.id}: size needs three positive metres`);
    if (typeof definition.build !== 'function' || !definition.defaults)
      throw Error(`Prop ${definition.id}: defaults and build() are required`);
    this.definitions.set(definition.id, definition);
    return this;
  }
  has(id: string): boolean {
    return this.definitions.has(id);
  }
  ids(): string[] {
    return [...this.definitions.keys()].sort();
  }
  sizeOf(id: string): ZhudaVec3 {
    return [...this.require(id).size];
  }
  private require(id: string): ZhudaPropDefinition<any> {
    const definition = this.definitions.get(id);
    if (!definition)
      throw Error(`Unknown prop: ${id}. Registered: ${this.ids().join(', ') || 'none'}`);
    return definition;
  }
  /** Local-space build. The same id, params and seed always give the same result. */
  build(id: string, options: { params?: object; seed?: number } = {}): ZhudaPropBuild {
    const definition = this.require(id);
    for (const key of Object.keys(options.params ?? {}))
      if (!Object.prototype.hasOwnProperty.call(definition.defaults, key))
        throw Error(`Prop ${id}: unknown parameter ${key}`);
    const build = definition.build(
      { ...definition.defaults, ...options.params },
      createZhudaRandom(options.seed ?? 0).fork(id),
    );
    checkBuild(definition, build);
    return build;
  }
  /** Builds a prop and moves its parts, colliders and sockets into world space. */
  place(id: string, placement: ZhudaPropPlacement): ZhudaPlacedProp {
    if (!placement || !isVec(placement.position)) throw Error(`Prop ${id}: position required`);
    const yawDeg = placement.yawDeg ?? 0;
    if (!Number.isFinite(yawDeg)) throw Error(`Prop ${id}: yawDeg must be finite`);
    const build = this.build(id, placement),
      yaw = yawOf(yawDeg),
      sockets: Record<string, ZhudaVec3> = {};
    for (const [name, socket] of Object.entries(build.sockets ?? {}))
      sockets[name] = turn(socket, yaw, placement.position);
    return {
      id,
      instance: placement.instance ?? `${id}#${this.placed++}`,
      position: [...placement.position],
      yawDeg,
      parts: build.parts.map((part) => ({
        ...part,
        mesh: transformZhudaMesh(part.mesh, { position: placement.position, yawDeg }),
      })),
      colliders: build.colliders.flatMap((collider) =>
        rotateZhudaCollider(collider, yawDeg, placement.position),
      ),
      sockets,
    };
  }
}

/** Groups every placed part by material and merges each group into as few meshes as possible. */
export function mergeZhudaPlacedProps(
  placed: readonly ZhudaPlacedProp[],
  maxVertices = 65535,
): ZhudaPropBatch[] {
  const groups = new Map<string, MeshData[]>();
  for (const prop of placed)
    for (const part of prop.parts) {
      const list = groups.get(part.material);
      if (list) list.push(part.mesh);
      else groups.set(part.material, [part.mesh]);
    }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([material, meshes]) => {
      const merged = mergeZhudaMeshes(meshes, maxVertices);
      return {
        material,
        meshes: merged,
        triangles: merged.reduce((sum, mesh) => sum + mesh.indices.length / 3, 0),
      };
    });
}

/**
 * Renderer hand-off: one `ZhudaDynamicMesh` per merged chunk, sharing the
 * material returned by `resolveMaterial`. Requires the Laya runtime.
 */
export function instantiateZhudaPropBatches(
  batches: readonly ZhudaPropBatch[],
  resolveMaterial: (material: string) => unknown,
  parent?: unknown,
): { meshes: ZhudaDynamicMesh[]; dispose(): void } {
  const meshes: ZhudaDynamicMesh[] = [];
  const dispose = () => {
    for (const mesh of meshes.splice(0)) mesh.dispose();
  };
  try {
    for (const batch of batches) {
      const material = resolveMaterial(batch.material);
      if (!material) throw Error(`No material resolved for ${batch.material}`);
      for (const data of batch.meshes) {
        // Baked materials carry a normal map, which needs a tangent frame; the
        // geometry kit and merge produce POSITION/NORMAL/UV only.
        const mesh = new ZhudaDynamicMesh(
          data.tangents ? data : { ...data, tangents: computeMeshTangents(data) },
          parent,
        );
        meshes.push(mesh);
        mesh.node.meshRenderer.sharedMaterial = material;
      }
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return { meshes, dispose };
}
