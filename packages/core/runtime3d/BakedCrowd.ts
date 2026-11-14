/**
 * A crowd of one animated character without a skeleton for each: the
 * character's clips are played once when it is made, every bone of every
 * frame is written into a texture, and each copy says which clip and which
 * frame it shows. The copies are grouped by the square of ground they stand
 * on (as `ZhudaInstancedMesh` groups props), a group is one draw a
 * sub-mesh in every pass, and a frame costs four numbers a copy. Five
 * hundred walkers are a handful of draws, lit and shadowed like any mesh.
 *
 * What it gives up: a copy shows whole frames of one clip (no blending
 * between clips or between frames; bake at the rate it is seen at), nothing
 * can be attached to its bones, and it is culled with its group.
 *
 * LayaAir draws such a mesh with its "simple skinned" shader path
 * (`SIMPLEBONE` with `GPU_INSTANCE`); the texture is laid out as that path
 * reads it. The layout and the frame arithmetic are plain; the baking and
 * the crowd need the Laya runtime.
 */
import type { ModelInstance } from './Assets.ts';
import { zhudaInstanceCells, zhudaPlacementMatrices } from './InstancedMesh.ts';
import { destroyLaya342ModelTree } from './Laya342Adapters.ts';
import { ZhudaModelAnimationSampler } from './ModelAnimationSampler.ts';
import { ZhudaModelInspector } from './ModelInspector.ts';
import type { ZhudaModelPlacement } from './ModelPlacements.ts';

export interface ZhudaBakedClip {
  name: string;
  /** How long it is, in seconds. */
  seconds: number;
  /** How many frames were written: one at each `1 / fps`, and the last at its end. */
  frames: number;
  /** The texel its first frame begins at. */
  start: number;
}
export interface ZhudaBakedLayout {
  /** The texture is `size` by `size` texels, four numbers each. */
  size: number;
  fps: number;
  /** Texels a frame: four a bone, for every bone of every skinned mesh. */
  frameTexels: number;
  clips: ZhudaBakedClip[];
  /** For each skinned mesh of the model: the bone its bones begin at inside a frame. */
  bases: number[];
  /** Texels in use; the rest of the texture is empty. */
  texels: number;
}

/**
 * Where every bone of every frame goes in the texture: clip after clip,
 * frame after frame, the skinned meshes of the model one after another
 * inside a frame, four texels (a matrix, column by column) a bone.
 */
export function zhudaBakedLayout(
  clips: readonly { name: string; seconds: number }[],
  bones: readonly number[],
  fps = 30,
): ZhudaBakedLayout {
  if (!Array.isArray(clips) || !clips.length || clips.length > 64)
    throw Error('Baked animation: 1..64 clips');
  if (!Array.isArray(bones) || !bones.length || bones.length > 16)
    throw Error('Baked animation: 1..16 skinned meshes');
  if (!(fps >= 1 && fps <= 120)) throw Error('Baked animation: fps 1..120');
  const bases: number[] = [];
  let total = 0;
  for (const count of bones) {
    if (!Number.isInteger(count) || count < 1 || count > 1024)
      throw Error('Baked animation: 1..1024 bones a skinned mesh');
    bases.push(total);
    total += count;
  }
  const frameTexels = total * 4;
  let start = 0;
  const names = new Set<string>();
  const laid = clips.map((clip) => {
    if (typeof clip?.name !== 'string' || !clip.name || names.has(clip.name))
      throw Error('Baked animation: each clip needs a name of its own');
    names.add(clip.name);
    if (!(clip.seconds > 0 && clip.seconds <= 600))
      throw Error(`Baked animation: clip ${clip.name} must last 0..600 seconds`);
    const frames = Math.max(1, Math.ceil(clip.seconds * fps - 1e-6)) + 1;
    const entry = { name: clip.name, seconds: clip.seconds, frames, start };
    start += frames * frameTexels;
    return entry;
  });
  // A square, a power of two: a matrix never straddles two rows since every row holds a multiple of four.
  let size = 4;
  while (size * size < start) size *= 2;
  if (size > 4096)
    throw Error(
      `Baked animation: ${start} texels do not fit 4096 by 4096; bake fewer clips or a lower fps`,
    );
  return { size, fps, frameTexels, clips: laid, bases, texels: start };
}

/**
 * The frame of a clip a copy shows at `seconds`, for a copy that began
 * `phase` seconds into the clip and plays at `speed`: the clip goes round.
 * The last written frame is the clip's end, which a round shows as its
 * beginning, so a round has `frames - 1` steps.
 */
export function zhudaCrowdFrame(
  clip: Pick<ZhudaBakedClip, 'seconds' | 'frames'>,
  seconds: number,
  phase = 0,
  speed = 1,
): number {
  if (!Number.isFinite(seconds) || !Number.isFinite(phase) || !Number.isFinite(speed))
    throw Error('Crowd frame: seconds, phase and speed must be finite');
  const steps = clip.frames - 1;
  if (steps < 1) return 0;
  let at = ((seconds * speed + phase) / clip.seconds) % 1;
  if (at < 0) at += 1;
  return Math.min(steps - 1, Math.floor(at * steps + 1e-9));
}

export interface ZhudaBakeOptions {
  /** Which clips, by name (default: every clip of the model). */
  clips?: readonly string[];
  /** Frames a second written, 1..120 (default 30). */
  fps?: number;
}

interface BakedPart {
  mesh: any;
  materials: any[];
  /** The mesh's vertices with each bone index as the skeleton numbers it. */
  vertices: any;
}

const runtime = () => (globalThis as any).Laya;

/** A model's animation written out for a crowd; owns the texture and the vertex buffers made for it. */
export class ZhudaBakedCharacter {
  readonly layout: ZhudaBakedLayout;
  /** The box round the character through all its clips, in the model's own space. */
  readonly min: [number, number, number];
  readonly max: [number, number, number];
  /** @internal */
  readonly texture: any;
  /** @internal */
  readonly parts: BakedPart[];
  private disposed = false;

  /**
   * Plays every asked clip of `instance` once, a frame at a time, and keeps
   * every bone of every frame. The instance is the caller's and is left in
   * the pose of the last frame written; it need not be in a scene. It must
   * stay alive while the character is used: the crowd draws with its meshes
   * and materials.
   */
  constructor(instance: ModelInstance, options: ZhudaBakeOptions = {}) {
    const l = runtime();
    if (!l?.SimpleSkinnedMeshSprite3D || !l.SkinnedMeshRenderer || !l.Texture2D)
      throw Error("Baked crowds need LayaAir's 3D module");
    const renderers: any[] = [];
    const visit = (node: any) => {
      const found = node.getComponent?.(l.SkinnedMeshRenderer);
      if (found) renderers.push(found);
      for (let i = 0; i < (node.numChildren || 0); i++) visit(node.getChildAt(i));
    };
    visit(instance.node);
    if (!renderers.length) throw Error('Baked character: the model has no skinned mesh');
    const available = new ZhudaModelInspector(instance).inspect().animations;
    const wanted = options.clips ?? available.map((entry) => entry.name);
    const clips = wanted.map((name) => {
      const entry = available.find((candidate) => candidate.name === name);
      if (!entry)
        throw Error(
          `Baked character: the model has no clip ${name}; it has: ${
            available.map((candidate) => candidate.name).join(', ') || 'none'
          }`,
        );
      return entry;
    });
    const layout = (this.layout = zhudaBakedLayout(
      clips.map((clip) => ({ name: clip.name, seconds: clip.durationSeconds })),
      renderers.map((renderer) => renderer.bones.length),
      options.fps ?? 30,
    ));
    const meshes = renderers.map((renderer) => {
      const mesh = renderer.owner.getComponent(l.MeshFilter)?.sharedMesh;
      if (!mesh?._inverseBindPoses || mesh._inverseBindPoses.length < renderer.bones.length)
        throw Error('Baked character: a skinned mesh without bind poses');
      return mesh;
    });
    const made: { destroy(): void }[] = [];
    try {
      this.parts = renderers.map((renderer, r) => ({
        mesh: meshes[r],
        materials: [...renderer.sharedMaterials],
        vertices: globalBoneIndices(l, meshes[r], made),
      }));
      const data = new Float32Array(layout.size * layout.size * 4);
      const root = new l.Matrix4x4();
      instance.node.transform.worldMatrix.invert(root);
      const step = new l.Matrix4x4(),
        skin = new l.Matrix4x4();
      const min: [number, number, number] = [Infinity, Infinity, Infinity];
      const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
      const joint = new l.Matrix4x4();
      clips.forEach((clip, c) => {
        const sampler = new ZhudaModelAnimationSampler(instance, clip.path, clip.name, clip.layer);
        try {
          const laid = layout.clips[c];
          for (let frame = 0; frame < laid.frames; frame++) {
            sampler.sample(Math.min(frame / layout.fps, laid.seconds));
            renderers.forEach((renderer, r) => {
              const binds = meshes[r]._inverseBindPoses;
              renderer.bones.forEach((bone: any, b: number) => {
                // Where the bone is under the model's root, times where it was when the mesh was bound to it.
                l.Matrix4x4.multiply(root, bone.transform.worldMatrix, step);
                l.Matrix4x4.multiply(step, binds[b], skin);
                data.set(
                  skin.elements,
                  (laid.start + frame * layout.frameTexels + (layout.bases[r] + b) * 4) * 4,
                );
                const e = step.elements;
                for (let k = 0; k < 3; k++) {
                  if (e[12 + k] < min[k]) min[k] = e[12 + k];
                  if (e[12 + k] > max[k]) max[k] = e[12 + k];
                }
              });
            });
          }
        } finally {
          sampler.dispose();
        }
      });
      void joint;
      // The joints' box, widened by the mesh as it was bound: flesh reaches past the joints.
      let reach = 0;
      for (const mesh of meshes) {
        const low = mesh.bounds.getMin(),
          high = mesh.bounds.getMax();
        reach = Math.max(reach, (high.x - low.x) / 2, (high.y - low.y) / 2, (high.z - low.z) / 2);
        const corners = [low, high];
        for (const corner of corners)
          for (const [k, v] of [corner.x, corner.y, corner.z].entries()) {
            if (v < min[k]) min[k] = v;
            if (v > max[k]) max[k] = v;
          }
      }
      const pad = reach * 0.25;
      this.min = [min[0] - pad, min[1] - pad, min[2] - pad];
      this.max = [max[0] + pad, max[1] + pad, max[2] + pad];
      const texture = new l.Texture2D(
        layout.size,
        layout.size,
        l.TextureFormat.R32G32B32A32,
        false,
        false,
        false,
      );
      made.push(texture);
      // A texel is a number, not a colour: never blended with its neighbour.
      texture.filterMode = l.FilterMode.Point;
      texture.wrapModeU = texture.wrapModeV = l.WrapMode.Clamp;
      texture.setPixelsData(data, false, false);
      this.texture = texture;
      this.owned = made;
    } catch (error) {
      for (const item of made.reverse()) item.destroy();
      throw error;
    }
  }
  private readonly owned: { destroy(): void }[] = [];

  /** The clip of that name. */
  clip(name: string): ZhudaBakedClip {
    const found = this.layout.clips.find((clip) => clip.name === name);
    if (!found)
      throw Error(
        `Baked character: no clip ${name}; baked: ${this.layout.clips.map((clip) => clip.name).join(', ')}`,
      );
    return found;
  }
  /** Bytes of the texture on the graphics card. */
  get textureBytes(): number {
    return this.layout.size * this.layout.size * 16;
  }
  get isDisposed(): boolean {
    return this.disposed;
  }
  /** After every crowd made from it is disposed. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const item of this.owned.splice(0).reverse()) item.destroy();
  }
}

/**
 * A copy of the mesh's vertices in which each vertex names its bones as the
 * skeleton numbers them. LayaAir cuts a mesh driven by many bones into
 * pieces of at most 24 and numbers the bones again inside each piece; the
 * texture is read with the skeleton's own numbers.
 */
function globalBoneIndices(l: any, mesh: any, made: { destroy(): void }[]): any {
  if (!mesh._isReadable || mesh._bufferState?._vertexBuffers?.length !== 1)
    throw Error('Baked character: the mesh must be readable and hold one vertex buffer');
  const declaration = mesh.getVertexDeclaration();
  const element = declaration.getVertexElementByUsage(l.VertexMesh.MESH_BLENDINDICES0);
  if (!element) throw Error('Baked character: the mesh has no bone indices');
  const bytes = new Uint8Array(mesh.getVertices());
  const indices = mesh.getIndices();
  const stride = declaration.vertexStride;
  const offset = element._offset ?? element.offset;
  const seen = new Int32Array(mesh.vertexCount).fill(-1);
  let piece = 0;
  for (const part of mesh._subMeshes)
    part._boneIndicesList.forEach((bones: ArrayLike<number>, j: number) => {
      const start = part._subIndexBufferStart[j];
      const end = start + part._subIndexBufferCount[j];
      for (let i = start; i < end; i++) {
        const vertex = indices[i];
        if (seen[vertex] === piece) continue;
        if (seen[vertex] !== -1)
          throw Error('Baked character: a vertex is shared by two pieces with their own bones');
        seen[vertex] = piece;
        const at = vertex * stride + offset;
        for (let k = 0; k < 4; k++) {
          const bone = bones[bytes[at + k]];
          if (bone > 255) throw Error('Baked character: more than 256 bones in one mesh');
          bytes[at + k] = bone;
        }
      }
      piece++;
    });
  const buffer = l.Laya3DRender.renderOBJCreate.createVertexBuffer3D(
    bytes.byteLength,
    l.BufferUsage.Static,
    false,
  );
  made.push(buffer);
  buffer.vertexDeclaration = declaration;
  buffer.setData(bytes.buffer, 0, 0, bytes.byteLength);
  return buffer;
}

export interface ZhudaCrowdCopy {
  /** Where the copy stands under the crowd's parent: `[x, y, z, yawDeg, scale]`. */
  place: ZhudaModelPlacement;
  /** The clip it shows, by name (default: the first that was baked). */
  clip?: string;
  /** Seconds into the clip it begins at (default 0): copies in step look like a drill. */
  phase?: number;
  /** How fast it plays, 0..8 (default 1). */
  speed?: number;
}
export interface ZhudaBakedCrowdOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Side of the squares the copies are grouped by, in metres (default 32). */
  cellMeters?: number;
  /** Most copies in one group (default 1024). */
  maxPerCell?: number;
  layer?: number;
  label?: string;
}

interface CrowdGroup {
  indices: number[];
  /** One buffer of four numbers a copy for each skinned mesh. */
  animation: { buffer: any; data: Float32Array }[];
  frames: Int32Array;
}

export class ZhudaBakedCrowd {
  readonly count: number;
  private readonly character: ZhudaBakedCharacter;
  private readonly clips: ZhudaBakedClip[];
  private readonly phases: Float32Array;
  private readonly speeds: Float32Array;
  private readonly groups: CrowdGroup[] = [];
  private readonly nodes: any[] = [];
  private readonly owned: { destroy(): void }[] = [];
  private changed = true;
  private disposed = false;

  /**
   * @param parent the node the groups are added under; the places are under it.
   * @param character what `ZhudaBakedCharacter` baked; shared by every crowd made from it.
   */
  constructor(
    parent: any,
    character: ZhudaBakedCharacter,
    copies: readonly ZhudaCrowdCopy[],
    options: ZhudaBakedCrowdOptions = {},
  ) {
    const l = runtime();
    if (!l?.SimpleSkinnedMeshSprite3D || !l.MeshInstanceGeometry)
      throw Error("Baked crowds need LayaAir's 3D module");
    if (!parent || typeof parent.addChild !== 'function')
      throw Error('Baked crowd: a parent node is expected');
    if (!(character instanceof ZhudaBakedCharacter) || character.isDisposed)
      throw Error('Baked crowd: a live baked character is expected');
    if (!Array.isArray(copies) || !copies.length || copies.length > 100000)
      throw Error('Baked crowd: 1..100000 copies');
    this.character = character;
    const layout = character.layout;
    this.count = copies.length;
    this.clips = [];
    this.phases = new Float32Array(copies.length);
    this.speeds = new Float32Array(copies.length);
    copies.forEach((copy, i) => {
      this.clips.push(copy.clip === undefined ? layout.clips[0] : character.clip(copy.clip));
      const phase = copy.phase ?? 0,
        speed = copy.speed ?? 1;
      if (!Number.isFinite(phase)) throw Error(`Baked crowd: copy ${i} phase must be finite`);
      if (!(speed >= 0 && speed <= 8)) throw Error(`Baked crowd: copy ${i} speed 0..8`);
      this.phases[i] = phase;
      this.speeds[i] = speed;
    });
    const matrices = zhudaPlacementMatrices(copies.map((copy) => copy.place));
    const cells = zhudaInstanceCells(
      matrices,
      character.min,
      character.max,
      options.cellMeters ?? 32,
      options.maxPerCell ?? 1024,
    );
    const world = parent.transform?.worldMatrix?.elements;
    const create = (bytes: number, usage: unknown) =>
      l.Laya3DRender.renderOBJCreate.createVertexBuffer3D(bytes, usage, false);
    try {
      cells.forEach((cell, c) => {
        const n = cell.indices.length;
        const data = new Float32Array(20 * n);
        cell.indices.forEach((index, k) => {
          const local = matrices.subarray(index * 16, index * 16 + 16);
          if (world) multiplyInto(world, local, data, k * 20);
          else data.set(local, k * 20);
          data[k * 20 + 16] = 1;
        });
        const places = create(data.byteLength, l.BufferUsage.Static);
        this.owned.push(places);
        places.vertexDeclaration = l.VertexMesh.instanceWorldMatrixDeclaration;
        places.instanceBuffer = true;
        places.setData(data.buffer, 0, 0, data.byteLength);
        const group: CrowdGroup = {
          indices: cell.indices,
          animation: [],
          frames: new Int32Array(n).fill(-1),
        };
        character.parts.forEach((part, r) => {
          const animated = new Float32Array(4 * n);
          const buffer = create(animated.byteLength, l.BufferUsage.Dynamic);
          this.owned.push(buffer);
          buffer.vertexDeclaration = l.VertexMesh.instanceSimpleAnimatorDeclaration;
          buffer.instanceBuffer = true;
          group.animation.push({ buffer, data: animated });
          const state = new l.BufferState();
          this.owned.push(state);
          state.applyState([part.vertices, places, buffer], part.mesh._indexBuffer);
          const node = new l.SimpleSkinnedMeshSprite3D(part.mesh);
          this.nodes.push(node);
          node.name = `${options.label ?? 'ZhudaCrowd'}:${c}:${r}`;
          if (options.layer !== undefined) node.layer = options.layer;
          const renderer = node.simpleSkinnedMeshRenderer;
          renderer.sharedMaterials = part.materials;
          renderer.castShadow = options.castShadow !== false;
          renderer.receiveShadow = options.receiveShadow !== false;
          renderer.simpleAnimatorTexture = character.texture;
          const elements: any[] = renderer._renderElements ?? [];
          if (elements.length !== (part.mesh.subMeshCount ?? 1))
            throw Error('Baked crowd: this LayaAir version draws a skinned mesh in another way');
          elements.forEach((element, i) => {
            const geometry = new l.MeshInstanceGeometry(part.mesh.getSubMesh(i));
            this.owned.push(geometry);
            geometry.bufferState = state;
            geometry.instanceCount = n;
            element.setGeometry(geometry);
            element._renderElementOBJ.canDynamicBatch = false;
          });
          renderer._baseRenderNode.shaderData.addDefine(
            l.MeshSprite3DShaderDeclaration.SHADERDEFINE_GPU_INSTANCE,
          );
          renderer.localBounds = new l.Bounds(
            new l.Vector3(cell.min[0], cell.min[1], cell.min[2]),
            new l.Vector3(cell.max[0], cell.max[1], cell.max[2]),
          );
          parent.addChild(node);
        });
        this.groups.push(group);
      });
      this.update(0);
    } catch (error) {
      this.release();
      throw error;
    }
  }

  /** Copies, groups, and draws a pass. */
  get stats(): { copies: number; groups: number; drawsPerPass: number } {
    const parts = this.character.parts.reduce(
      (sum, part) => sum + (part.mesh.subMeshCount ?? 1),
      0,
    );
    return {
      copies: this.count,
      groups: this.groups.length,
      drawsPerPass: this.groups.length * parts,
    };
  }

  /** Gives a copy another clip, from its beginning at the `seconds` it is given. */
  setClip(copy: number, clip: string, options: { phase?: number; speed?: number } = {}): void {
    if (this.disposed) throw Error('Disposed crowd');
    if (!Number.isInteger(copy) || copy < 0 || copy >= this.count)
      throw Error('Baked crowd: no such copy');
    const speed = options.speed ?? this.speeds[copy];
    if (!(speed >= 0 && speed <= 8)) throw Error('Baked crowd: speed 0..8');
    if (options.phase !== undefined && !Number.isFinite(options.phase))
      throw Error('Baked crowd: phase must be finite');
    this.clips[copy] = this.character.clip(clip);
    this.phases[copy] = options.phase ?? 0;
    this.speeds[copy] = speed;
    this.changed = true;
  }

  /**
   * Shows every copy the frame of its clip at `seconds`, the time of the
   * clock the scene runs on. Returns how many copies changed frame; a group
   * none of whose copies did is not touched.
   */
  update(seconds: number): number {
    if (this.disposed) throw Error('Disposed crowd');
    if (!Number.isFinite(seconds)) throw Error('Baked crowd: seconds must be finite');
    const { frameTexels, bases } = this.character.layout;
    let moved = 0;
    for (const group of this.groups) {
      let dirty = this.changed;
      group.indices.forEach((index, k) => {
        const clip = this.clips[index];
        const frame = zhudaCrowdFrame(clip, seconds, this.phases[index], this.speeds[index]);
        // A frame is told from another clip's by where the clip starts.
        const key = clip.start + frame * frameTexels;
        if (group.frames[k] === key) return;
        group.frames[k] = key;
        dirty = true;
        moved++;
        group.animation.forEach(({ data }, r) => {
          data[k * 4] = clip.start + bases[r] * 4;
          data[k * 4 + 1] = frame * frameTexels;
        });
      });
      if (dirty)
        for (const { buffer, data } of group.animation)
          buffer.setData(data.buffer, 0, 0, data.byteLength);
    }
    this.changed = false;
    return moved;
  }

  private release() {
    // At once, not on the next frame: the mesh and the materials are the model's, which may be let go of now.
    for (const node of this.nodes.splice(0)) if (!node.destroyed) destroyLaya342ModelTree(node);
    for (const item of this.owned.splice(0).reverse()) item.destroy();
  }
  /** Destroys the group nodes and their buffers; the baked character is the caller's. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
  }
}

function multiplyInto(a: ArrayLike<number>, b: ArrayLike<number>, out: Float32Array, at: number) {
  for (let column = 0; column < 4; column++)
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[at + column * 4 + row] = sum;
    }
}
