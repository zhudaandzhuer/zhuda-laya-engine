/**
 * Many copies of one mesh without a node for each: the copies are grouped
 * by the square of ground they stand on, and each group is one ordinary
 * mesh node whose geometry carries the copies' matrices as an instance
 * buffer. A group is one draw a sub-mesh in every pass it is in, so the
 * copies are lit, fogged, cast and take shadows and are in the depth
 * texture as any mesh is, on WebGL and on WebGPU; a group out of view is
 * not drawn. Nothing is done for a copy after it is made: the cost of five
 * thousand props is that of the handful of groups in view.
 *
 * What it gives up: a copy cannot be moved, hidden or picked by itself (make
 * the instanced mesh again, or keep that prop a node), culling is by the
 * group, and levels of detail are chosen for a group as a whole.
 *
 * The matrices and the grouping are plain arithmetic; only the class needs
 * the Laya runtime.
 */
import { destroyLaya342ModelTree } from './Laya342Adapters.ts';
import type { ZhudaModelPlacement } from './ModelPlacements.ts';
import { zhudaSrgbToLinear } from './Surfaces.ts';

/** Sixteen numbers a copy, column by column, as LayaAir's `Matrix4x4.elements`. */
export type ZhudaInstanceMatrices = Float32Array;

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const finiteList = (value: ArrayLike<number>, length: number) => {
  if (!value || value.length !== length) return false;
  for (let i = 0; i < length; i++) if (!Number.isFinite(value[i])) return false;
  return true;
};
/** `out = a * b` for column-major 4 by 4 matrices; `out` may be neither `a` nor `b`. */
function multiply(a: ArrayLike<number>, b: ArrayLike<number>, out: Float32Array, at: number) {
  for (let column = 0; column < 4; column++)
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[at + column * 4 + row] = sum;
    }
}

/**
 * The matrix of each copy: `parent * place * local`, where `place` is the
 * placement (`[x, y, z, yawDeg, scale]`), `parent` the holder's world matrix
 * and `local` where the mesh sits inside its model (both default to none).
 */
export function zhudaPlacementMatrices(
  placements: readonly ZhudaModelPlacement[],
  parent: ArrayLike<number> = IDENTITY,
  local: ArrayLike<number> = IDENTITY,
): ZhudaInstanceMatrices {
  if (!Array.isArray(placements)) throw Error('Instance matrices: a list of placements');
  if (!finiteList(parent, 16) || !finiteList(local, 16))
    throw Error('Instance matrices: parent and local are 16 finite numbers');
  const out = new Float32Array(placements.length * 16);
  const place = new Float32Array(16);
  const placed = new Float32Array(16);
  placements.forEach((placement, i) => {
    if (!finiteList(placement, 5) || !(placement[4] >= 0.001 && placement[4] <= 1000))
      throw Error(`Instance matrices: [${i}] is not [x, y, z, yawDeg, scale]`);
    const [x, y, z, yawDeg, size] = placement;
    const turn = (yawDeg * Math.PI) / 180;
    const c = Math.cos(turn) * size,
      s = Math.sin(turn) * size;
    // A turn about +Y, scaled, then moved: as a node with that euler rotation.
    place.set([c, 0, -s, 0, 0, size, 0, 0, s, 0, c, 0, x, y, z, 1]);
    multiply(place, local, placed, 0);
    multiply(parent, placed, out, i * 16);
  });
  return out;
}

export interface ZhudaInstanceCell {
  /** Which copies, by their place in the list, ascending. */
  indices: number[];
  /** The box round those copies' meshes. */
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * Groups copies by the square of ground their origin stands on (`cellMeters`
 * a side, on X and Z), at most `maxPerCell` to a group, with the box round
 * each group's meshes. Groups come in a fixed order (by square, then by
 * place in the list), so the same input gives the same groups. `anchors`
 * (three numbers a copy) say where each copy counts as standing instead of
 * its own origin: the meshes of one model, grouped by where the model
 * stands, then fall into the same groups.
 */
export function zhudaInstanceCells(
  matrices: ZhudaInstanceMatrices,
  meshMin: readonly number[],
  meshMax: readonly number[],
  cellMeters = 32,
  maxPerCell = 1024,
  anchors?: Float32Array,
): ZhudaInstanceCell[] {
  if (!(matrices instanceof Float32Array) || matrices.length % 16 !== 0)
    throw Error('Instance cells: matrices are 16 numbers a copy');
  if (!finiteList(meshMin, 3) || !finiteList(meshMax, 3))
    throw Error('Instance cells: the mesh box is two points');
  if (!(cellMeters >= 0.5 && cellMeters <= 100000))
    throw Error('Instance cells: cellMeters 0.5..100000');
  if (!Number.isInteger(maxPerCell) || maxPerCell < 1 || maxPerCell > 65536)
    throw Error('Instance cells: maxPerCell 1..65536');
  const count = matrices.length / 16;
  if (anchors !== undefined && (!(anchors instanceof Float32Array) || anchors.length !== count * 3))
    throw Error('Instance cells: anchors are three numbers a copy');
  const squares = new Map<string, { cx: number; cz: number; indices: number[] }>();
  for (let i = 0; i < count; i++) {
    const x = anchors ? anchors[i * 3] : matrices[i * 16 + 12],
      z = anchors ? anchors[i * 3 + 2] : matrices[i * 16 + 14];
    if (!Number.isFinite(x) || !Number.isFinite(z))
      throw Error(`Instance cells: copy ${i} is not at a finite place`);
    const cx = Math.floor(x / cellMeters),
      cz = Math.floor(z / cellMeters);
    const key = cx + ',' + cz;
    let square = squares.get(key);
    if (!square) squares.set(key, (square = { cx, cz, indices: [] }));
    square.indices.push(i);
  }
  const ordered = [...squares.values()].sort((a, b) => a.cz - b.cz || a.cx - b.cx);
  const centre = [0, 1, 2].map((k) => (meshMin[k] + meshMax[k]) / 2);
  const half = [0, 1, 2].map((k) => (meshMax[k] - meshMin[k]) / 2);
  const cells: ZhudaInstanceCell[] = [];
  for (const square of ordered)
    for (let start = 0; start < square.indices.length; start += maxPerCell) {
      const indices = square.indices.slice(start, start + maxPerCell);
      const min: [number, number, number] = [Infinity, Infinity, Infinity];
      const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
      for (const i of indices) {
        const m = i * 16;
        for (let row = 0; row < 3; row++) {
          // The box of a turned box: its centre moved, its half-size through the matrix's magnitudes.
          let middle = matrices[m + 12 + row],
            reach = 0;
          for (let k = 0; k < 3; k++) {
            const e = matrices[m + k * 4 + row];
            middle += e * centre[k];
            reach += Math.abs(e) * half[k];
          }
          if (middle - reach < min[row]) min[row] = middle - reach;
          if (middle + reach > max[row]) max[row] = middle + reach;
        }
      }
      cells.push({ indices, min, max });
    }
  return cells;
}

export interface ZhudaInstancedMeshOptions {
  /** The copies cast shadows (default true). */
  castShadow?: boolean;
  /** The copies take shadows (default true). */
  receiveShadow?: boolean;
  /** Side of the squares the copies are grouped by, in metres (default 32). */
  cellMeters?: number;
  /** Most copies in one group, 1..65536 (default 1024). */
  maxPerCell?: number;
  /**
   * A colour for each copy, four numbers a copy (red, green, blue as display
   * colours, and one spare), multiplied into the base colour. Only materials
   * made by `ZhudaLitSurfaceMaterial` or `ZhudaToonMaterial` read it; any
   * other is refused.
   */
  tints?: Float32Array;
  /** Where each copy counts as standing for the grouping, three numbers a copy (default: its origin). */
  anchors?: Float32Array;
  /** LayaAir layer of the group nodes (default: the parent's). */
  layer?: number;
  /** Name prefix of the group nodes. */
  label?: string;
  /**
   * The copies go with the parent: when it, or anything above it, has moved,
   * they are placed again before the next frame is drawn (every copy's
   * matrix worked out and sent again, once however often it moved). For
   * copies under something that is put in its place after they are made, or
   * that moves now and then. The matrices are kept for it, sixteen numbers a
   * copy. Without it a parent that moves leaves the copies where they were
   * drawn first.
   */
  follow?: boolean;
}

/** The define a material's shader reads a copy's tint under. */
export const ZHUDA_INSTANCE_TINT_DEFINE = 'ZHUDA_INSTANCE_TINT';
/** The attribute a copy's tint arrives in, and its place among the vertex attributes. */
export const ZHUDA_INSTANCE_TINT_ATTRIBUTE = 'a_ZhudaInstanceTint';
export const ZHUDA_INSTANCE_TINT_LOCATION = 15;

/** Shaders that read a copy's tint, by the runtime's `Shader3D`. */
const tintable = new WeakMap<object, Set<string>>();
/** For the lit template: a shader of this name reads `a_ZhudaInstanceTint` under the tint define. */
export function registerZhudaInstanceTintShader(runtime: any, name: string): void {
  const key = runtime?.Shader3D;
  if (!key) return;
  let names = tintable.get(key);
  if (!names) tintable.set(key, (names = new Set()));
  names.add(name);
}

export interface ZhudaInstancedGroup {
  /** The node that draws the group. */
  node: any;
  renderer: any;
  /** How many copies it draws. */
  count: number;
  /** The middle of the box round them, in the parent's space. */
  centre: [number, number, number];
}

export class ZhudaInstancedMesh {
  /** How many copies. */
  readonly count: number;
  /** One node a group, in a fixed order. */
  readonly groups: readonly ZhudaInstancedGroup[];
  /** Destroyed in this order: the nodes, then what they drew with. */
  private readonly nodes: any[] = [];
  private readonly owned: { destroy(): void }[] = [];
  private disposed = false;
  /** With `follow`: the parent, the copies' places under it, and each group's buffer of world places. */
  private readonly following: {
    parent: any;
    matrices: Float32Array;
    groups: { indices: number[]; data: Float32Array; buffer: any }[];
  } | null = null;
  private stale = false;

  /**
   * @param parent the node the group nodes are added under. The matrices
   *   are in its space: give them as places under it (`zhudaPlacementMatrices`
   *   without a parent matrix). A parent that moves afterwards takes the
   *   copies with it for culling but not for drawing, unless `follow` is
   *   asked for: then they are placed again when it has moved.
   * @param mesh a LayaAir mesh; its buffers are shared, never copied.
   * @param materials one material, or one a sub-mesh.
   * @param matrices sixteen numbers a copy.
   */
  constructor(
    parent: any,
    mesh: any,
    materials: any,
    matrices: ZhudaInstanceMatrices,
    options: ZhudaInstancedMeshOptions = {},
  ) {
    const l = (globalThis as any).Laya;
    if (
      !l?.MeshInstanceGeometry ||
      !l.Laya3DRender?.renderOBJCreate?.createVertexBuffer3D ||
      !l.BufferState ||
      !l.VertexMesh?.instanceWorldMatrixDeclaration
    )
      throw Error("Instanced meshes need LayaAir's 3D render module");
    if (!parent || typeof parent.addChild !== 'function')
      throw Error('Instanced mesh: a parent node is expected');
    if (!mesh || mesh.destroyed || !mesh._bufferState?._vertexBuffers || !mesh.bounds)
      throw Error('Instanced mesh: a live LayaAir mesh is expected');
    if (!(matrices instanceof Float32Array) || !matrices.length || matrices.length % 16 !== 0)
      throw Error('Instanced mesh: matrices are 16 numbers a copy, at least one copy');
    const count = matrices.length / 16;
    if (count > 200000) throw Error('Instanced mesh: at most 200000 copies');
    for (let i = 0; i < matrices.length; i++)
      if (!Number.isFinite(matrices[i])) throw Error('Instanced mesh: every number must be finite');
    const list: any[] = Array.isArray(materials) ? [...materials] : [materials];
    const parts = mesh.subMeshCount ?? 1;
    if (!list.length || list.length > parts || list.some((m) => !m || m.destroyed))
      throw Error(`Instanced mesh: one live material, or one a sub-mesh (${parts})`);
    while (list.length < parts) list.push(list[list.length - 1]);
    const tints = options.tints;
    if (tints !== undefined) {
      if (!(tints instanceof Float32Array) || tints.length !== count * 4)
        throw Error('Instanced mesh: tints are four numbers a copy');
      for (let i = 0; i < tints.length; i++)
        if (!(tints[i] >= 0 && tints[i] <= 16)) throw Error('Instanced mesh: tints 0..16');
      const names = tintable.get(l.Shader3D);
      for (const material of list)
        if (!names?.has(material._shader?.name ?? material.shader?.name))
          throw Error(
            'Instanced mesh: tints need materials from ZhudaLitSurfaceMaterial or ZhudaToonMaterial',
          );
    }
    const boxMin = mesh.bounds.getMin(),
      boxMax = mesh.bounds.getMax();
    const cells = zhudaInstanceCells(
      matrices,
      [boxMin.x, boxMin.y, boxMin.z],
      [boxMax.x, boxMax.y, boxMax.z],
      options.cellMeters ?? 32,
      options.maxPerCell ?? 1024,
      options.anchors,
    );
    // The parent's world matrix turns places under it into the world places the shader draws at.
    const world = parent.transform?.worldMatrix?.elements ?? IDENTITY;
    const create = (bytes: number) =>
      l.Laya3DRender.renderOBJCreate.createVertexBuffer3D(bytes, l.BufferUsage.Static, false);
    const meshBuffers = mesh._bufferState._vertexBuffers;
    const groups: ZhudaInstancedGroup[] = [];
    const following = options.follow
      ? {
          parent,
          matrices: matrices.slice(),
          groups: [] as { indices: number[]; data: Float32Array; buffer: any }[],
        }
      : null;
    this.following = following;
    const tintDefine = tints ? l.Shader3D.getDefineByName(ZHUDA_INSTANCE_TINT_DEFINE) : null;
    const tintDeclaration = tints
      ? new l.VertexDeclaration(16, [
          new l.VertexElement(0, l.VertexElementFormat.Vector4, ZHUDA_INSTANCE_TINT_LOCATION),
        ])
      : null;
    try {
      cells.forEach((cell, c) => {
        const n = cell.indices.length;
        // Twenty numbers a copy: the matrix, then LayaAir's per-renderer vector (1 for a mesh that is not mirrored).
        const data = new Float32Array(20 * n);
        const lightmap = new Float32Array(4 * n);
        const tint = tints ? new Float32Array(4 * n) : null;
        cell.indices.forEach((index, k) => {
          multiply(world, matrices.subarray(index * 16, index * 16 + 16), data, k * 20);
          const m = k * 20;
          const mirrored =
            data[m] * (data[m + 5] * data[m + 10] - data[m + 6] * data[m + 9]) -
              data[m + 1] * (data[m + 4] * data[m + 10] - data[m + 6] * data[m + 8]) +
              data[m + 2] * (data[m + 4] * data[m + 9] - data[m + 5] * data[m + 8]) <
            0;
          // One group is one draw, and a draw has one facing.
          if (mirrored) throw Error(`Instanced mesh: copy ${index} is mirrored`);
          data[m + 16] = 1;
          lightmap.set([1, 1, 0, 0], k * 4);
          if (tint && tints)
            tint.set(
              [
                zhudaSrgbToLinear(tints[index * 4]),
                zhudaSrgbToLinear(tints[index * 4 + 1]),
                zhudaSrgbToLinear(tints[index * 4 + 2]),
                tints[index * 4 + 3],
              ],
              k * 4,
            );
        });
        const buffer = (values: Float32Array, declaration: any) => {
          const made = create(values.byteLength);
          this.owned.push(made);
          made.vertexDeclaration = declaration;
          made.instanceBuffer = true;
          made.setData(values.buffer, 0, 0, values.byteLength);
          return made;
        };
        const places = buffer(data, l.VertexMesh.instanceWorldMatrixDeclaration);
        following?.groups.push({ indices: cell.indices, data, buffer: places });
        const buffers = [
          ...meshBuffers,
          places,
          // WebGPU's instanced shaders name this attribute whether or not a lightmap is used.
          buffer(lightmap, l.VertexMesh.instanceLightMapScaleOffsetDeclaration),
          ...(tint ? [buffer(tint, tintDeclaration)] : []),
        ];
        const state = new l.BufferState();
        this.owned.push(state);
        state.applyState(buffers, mesh._indexBuffer);
        const node = new l.MeshSprite3D(mesh);
        this.nodes.push(node);
        node.name = `${options.label ?? 'ZhudaInstanced'}:${c}`;
        if (options.layer !== undefined) node.layer = options.layer;
        const renderer = node.meshRenderer;
        renderer.sharedMaterials = list;
        renderer.castShadow = options.castShadow !== false;
        renderer.receiveShadow = options.receiveShadow !== false;
        const elements: any[] = renderer._renderElements ?? [];
        if (elements.length !== parts)
          throw Error('Instanced mesh: this LayaAir version draws a mesh in another way');
        elements.forEach((element, i) => {
          const geometry = new l.MeshInstanceGeometry(mesh.getSubMesh(i));
          this.owned.push(geometry);
          geometry.bufferState = state;
          geometry.instanceCount = n;
          element.setGeometry(geometry);
          // LayaAir would gather nodes of one mesh and material into a batch of its own, one copy a node.
          element._renderElementOBJ.canDynamicBatch = false;
        });
        const data3d = renderer._baseRenderNode.shaderData;
        data3d.addDefine(l.MeshSprite3DShaderDeclaration.SHADERDEFINE_GPU_INSTANCE);
        if (tintDefine) data3d.addDefine(tintDefine);
        // The node has no place of its own: its box, in the parent's space, is the group's.
        const { min, max } = cell;
        renderer.geometryBounds = new l.Bounds(
          new l.Vector3(min[0], min[1], min[2]),
          new l.Vector3(max[0], max[1], max[2]),
        );
        // Added last: WebGPU decides how a renderer is drawn when it joins the scene.
        parent.addChild(node);
        groups.push({
          node,
          renderer,
          count: n,
          centre: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
        });
      });
    } catch (error) {
      this.release();
      throw error;
    }
    this.count = count;
    this.groups = groups;
    // A group node stands under the parent: its transform says when anything above it has moved.
    if (following && groups.length && l.Event?.TRANSFORM_CHANGED)
      groups[0].node.transform?.on?.(l.Event.TRANSFORM_CHANGED, this, this.moved);
  }

  private moved() {
    if (this.stale || this.disposed) return;
    this.stale = true;
    const timer = (globalThis as any).Laya?.timer;
    // Once, before the next frame is drawn, however many times the parent was moved.
    if (typeof timer?.callLater === 'function') timer.callLater(this, this.refresh);
    else this.refresh();
  }

  /**
   * With `follow`: places the copies again from where the parent is now. It
   * is called by itself after the parent has moved; call it to have them
   * placed at once (before reading bounds in the same frame, say).
   */
  refresh(): void {
    this.stale = false;
    if (this.disposed || !this.following) return;
    const { parent, matrices, groups } = this.following;
    const world = parent.transform?.worldMatrix?.elements ?? IDENTITY;
    for (const group of groups) {
      group.indices.forEach((index, k) =>
        multiply(world, matrices.subarray(index * 16, index * 16 + 16), group.data, k * 20),
      );
      group.buffer.setData(group.data.buffer, 0, 0, group.data.byteLength);
    }
  }

  /** Copies, groups, and draws a pass: one a group a sub-mesh. */
  get stats(): { copies: number; groups: number; drawsPerPass: number } {
    const parts = this.groups[0]?.renderer.sharedMaterials?.length ?? 1;
    return {
      copies: this.count,
      groups: this.groups.length,
      drawsPerPass: this.groups.length * parts,
    };
  }
  private release() {
    const l = (globalThis as any).Laya;
    if (this.following && this.groups?.length && l?.Event?.TRANSFORM_CHANGED)
      this.groups[0].node.transform?.off?.(l.Event.TRANSFORM_CHANGED, this, this.moved);
    // At once, not on the next frame: the mesh and the materials are another owner's, who may let go of them now.
    for (const node of this.nodes.splice(0)) if (!node.destroyed) destroyLaya342ModelTree(node);
    for (const item of this.owned.splice(0).reverse()) item.destroy();
  }
  /** Destroys the group nodes and the instance buffers; the mesh and the materials are the caller's. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
  }
}
