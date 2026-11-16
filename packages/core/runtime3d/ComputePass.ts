/**
 * A step run for many things at once on the GPU, and a draw of copies whose
 * places such a step writes.
 *
 * `ZhudaComputePass` is LayaAir 3.4.2's compute shader, command buffer and
 * device buffers behind one object: buffers of numbers, a few uniforms, and
 * a GLSL function `void zhudaStep(uint index)` that is called once for every
 * index of a dispatch. What it writes stays on the GPU:
 * `ZhudaComputedInstances` draws a mesh once for every place a pass wrote,
 * with nothing read back.
 *
 * Compute exists on WebGPU only. A pass that is given the same step in
 * JavaScript (`step`) runs that instead where there is no compute, with the
 * same buffers and the same draw, and says so (`backend: 'cpu'`). A pass
 * without one refuses with `COMPUTE_UNAVAILABLE`.
 *
 * One index of a step reads and writes its own elements. On the GPU all
 * indices run at once, in JavaScript one after another: a step that reads
 * what another index of the same dispatch writes is not the same on both.
 */
import { destroyLaya342ModelTree } from './Laya342Adapters.ts';

export type ZhudaComputeElement = 'float' | 'vec4' | 'uint';

export interface ZhudaComputeBufferSpec {
  /** What one element is: a float, four floats, or an unsigned integer. */
  type: ZhudaComputeElement;
  /** How many elements, 1..16777216. */
  length: number;
  /** `'read'`: the step only reads it (default `'read-write'`). */
  access?: 'read' | 'read-write';
  /** Also the vertex data of a draw (`ZhudaComputedInstances`); `vec4` only. */
  vertex?: boolean;
}

export interface ZhudaComputeUniformSpec {
  type: 'float' | 'vec4' | 'int';
  value?: number | readonly number[];
}

export type ZhudaComputeArrays = Record<string, Float32Array | Uint32Array>;
export type ZhudaComputeValues = Record<string, number | number[]>;

export interface ZhudaComputeSpec {
  /** `Zhuda` and letters, digits or `_`. A name names its code: two passes of one name share the code. */
  name: string;
  /**
   * GLSL: `void zhudaStep(uint index)` and what it calls. Each buffer is an
   * array under its own name (`zhudaPlaces[index]`), each uniform a value
   * under its name; `u_ZhudaCount` is how many indices the dispatch has.
   * The layout, the buffers, the uniforms and `main` are the engine's.
   */
  code: string;
  /** Up to eight, named `zhuda` and a capital, letters or digits (`zhudaPlaces`). */
  buffers: Record<string, ZhudaComputeBufferSpec>;
  /** Up to 32, named `u_Zhuda…`. */
  uniforms?: Record<string, ZhudaComputeUniformSpec>;
  /**
   * The same step in JavaScript, for a backend without compute. A `vec4`
   * buffer is four numbers an element in its array.
   */
  step?: (index: number, buffers: ZhudaComputeArrays, uniforms: ZhudaComputeValues) => void;
}

const SIZE: Record<ZhudaComputeElement, number> = { float: 1, vec4: 4, uint: 1 };
const GLSL: Record<ZhudaComputeElement, string> = { float: 'float', vec4: 'vec4', uint: 'uint' };
/** Indices one group of the GPU's step covers. */
export const ZHUDA_COMPUTE_GROUP = 64;
/**
 * Groups along x in one row of a dispatch. WebGPU allows at most 65535
 * groups along an axis, so a dispatch of more than this many groups is laid
 * out in rows along y; up to this many it is one row, as it always was.
 */
const GROUPS_PER_ROW = 32768;
/** The uniform a step reads its count from. */
export const ZHUDA_COMPUTE_COUNT = 'u_ZhudaCount';

/** Lists what is wrong with a compute spec; empty when it is valid. Needs no GPU. */
export function validateZhudaComputeSpec(spec: ZhudaComputeSpec): string[] {
  const issues: string[] = [];
  const s = (spec ?? {}) as ZhudaComputeSpec;
  if (typeof s.name !== 'string' || !/^Zhuda[A-Za-z0-9_]{1,100}$/.test(s.name))
    issues.push('name: start with Zhuda, then letters, digits or _');
  if (typeof s.code !== 'string' || s.code.length > 65536 || !/\bzhudaStep\s*\(/.test(s.code))
    issues.push('code: define void zhudaStep(uint index) (at most 65536 characters)');
  else if (
    /\bvoid\s+main\s*\(|\blayout\s*\(|\b(?:uniform|buffer)\b|#\s*(?:version|include)/.test(
      s.code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ''),
    )
  )
    issues.push('code: the layout, buffers, uniforms, includes and main belong to the engine');
  const buffers = s.buffers && typeof s.buffers === 'object' ? Object.entries(s.buffers) : [];
  if (!buffers.length || buffers.length > 8) issues.push('buffers: one to eight');
  for (const [name, buffer] of buffers) {
    if (!/^zhuda[A-Z][A-Za-z0-9]{0,60}$/.test(name))
      issues.push(`buffers.${name}: name it zhuda and a capital, then letters or digits`);
    if (!buffer || !Object.hasOwn(SIZE, buffer.type)) {
      issues.push(`buffers.${name}.type: use float, vec4 or uint`);
      continue;
    }
    if (!(Number.isInteger(buffer.length) && buffer.length >= 1 && buffer.length <= 16777216))
      issues.push(`buffers.${name}.length: use a whole number 1..16777216`);
    if (buffer.access !== undefined && buffer.access !== 'read' && buffer.access !== 'read-write')
      issues.push(`buffers.${name}.access: use read or read-write`);
    if (buffer.vertex !== undefined && typeof buffer.vertex !== 'boolean')
      issues.push(`buffers.${name}.vertex: use true or false`);
    if (buffer.vertex && buffer.type !== 'vec4')
      issues.push(`buffers.${name}: vertex data is vec4`);
  }
  const uniforms = Object.entries(s.uniforms ?? {});
  if (uniforms.length > 32) issues.push('uniforms: at most 32');
  for (const [name, uniform] of uniforms) {
    if (!/^u_Zhuda[A-Za-z0-9_]{1,60}$/.test(name) || name === ZHUDA_COMPUTE_COUNT)
      issues.push(`uniforms.${name}: name it u_Zhuda… (${ZHUDA_COMPUTE_COUNT} is the engine's)`);
    if (!uniform || !['float', 'vec4', 'int'].includes(uniform.type)) {
      issues.push(`uniforms.${name}.type: use float, vec4 or int`);
      continue;
    }
    if (uniform.value !== undefined && !validValue(uniform.type, uniform.value))
      issues.push(`uniforms.${name}.value: a ${uniform.type}`);
  }
  if (s.step !== undefined && typeof s.step !== 'function') issues.push('step: use a function');
  return issues;
}

function validValue(type: ZhudaComputeUniformSpec['type'], value: unknown): boolean {
  if (type === 'vec4')
    return Array.isArray(value) && value.length === 4 && value.every((v) => Number.isFinite(v));
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return type === 'float' || (Number.isInteger(value) && Math.abs(value) <= 2147483647);
}

/**
 * The compute shader a spec becomes: the engine's layout, a block for each
 * buffer, the spec's code, and a `main` that calls `zhudaStep` for every
 * index below the dispatch's count. Uniforms are declared by LayaAir from
 * the pass's uniform map.
 */
export function zhudaComputeSource(spec: ZhudaComputeSpec): string {
  const issues = validateZhudaComputeSpec(spec);
  if (issues.length) throw Error('Invalid compute pass: ' + issues.join('; '));
  const blocks = Object.keys(spec.buffers)
    .sort()
    .map((name) => {
      const buffer = spec.buffers[name];
      return `${buffer.access === 'read' ? 'readonly ' : ''}buffer ${blockName(name)}{${GLSL[buffer.type]} ${name}[];};`;
    })
    .join('\n');
  return (
    `layout(local_size_x=${ZHUDA_COMPUTE_GROUP},local_size_y=1,local_size_z=1)in;\n${blocks}\n${spec.code}\n` +
    `void main(){uint index=gl_GlobalInvocationID.x+gl_GlobalInvocationID.y*${GROUPS_PER_ROW * ZHUDA_COMPUTE_GROUP}u;if(index>=uint(${ZHUDA_COMPUTE_COUNT})){return;}zhudaStep(index);}`
  );
}
/** `zhudaPlaces` is the array of the block `ZhudaPlaces`. */
const blockName = (name: string) => name[0].toUpperCase() + name.slice(1);

export class ZhudaComputeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = 'ZhudaComputeError';
  }
}

/** Whether this realm's LayaAir has compute (the WebGPU backend). */
export function zhudaComputeSupported(l: any = (globalThis as any).Laya): boolean {
  return !!(
    l?.ComputeShader &&
    l.ComputeCommandBuffer &&
    l.DeviceBuffer &&
    typeof l.LayaGL?.renderDeviceFactory?.createDeviceBuffer === 'function' &&
    typeof l.LayaGL?.renderEngine?.getDevice === 'function' &&
    l.LayaGL.renderEngine.getDevice()
  );
}

/** A name names its code: LayaAir keeps one compute shader a name. */
const sources = new Map<string, { source: string; shader: any }>();

interface Held {
  spec: ZhudaComputeBufferSpec;
  bytes: number;
  /** GPU: LayaAir's device buffer; with `vertex`, the pair that is also a vertex buffer. */
  device?: any;
  pair?: any;
  /** CPU: the numbers, and the vertex buffer they are uploaded to after a dispatch. */
  array?: Float32Array | Uint32Array;
  vertex?: any;
}

export class ZhudaComputePass {
  /** Where the step runs: on the GPU, or as the spec's JavaScript step. */
  readonly backend: 'webgpu' | 'cpu';
  readonly spec: ZhudaComputeSpec;
  private readonly held = new Map<string, Held>();
  private readonly values: ZhudaComputeValues = {};
  private shader: any;
  private uniformData: any;
  private bufferData: any;
  private commands: any;
  private defines: any;
  private disposed = false;

  constructor(spec: ZhudaComputeSpec) {
    const source = zhudaComputeSource(spec);
    const l = (globalThis as any).Laya;
    if (!l) throw Error('A compute pass needs LayaAir (ZhudaEngine.boot first)');
    this.spec = { ...spec, buffers: { ...spec.buffers }, uniforms: { ...(spec.uniforms ?? {}) } };
    const gpu = zhudaComputeSupported(l);
    if (!gpu && typeof spec.step !== 'function')
      throw new ZhudaComputeError(
        'COMPUTE_UNAVAILABLE',
        'this backend has no compute shaders (WebGPU has), and the pass has no JavaScript step',
      );
    this.backend = gpu ? 'webgpu' : 'cpu';
    try {
      if (gpu) this.makeGpu(l, source);
      else this.makeCpu(l);
      for (const [name, uniform] of Object.entries(this.spec.uniforms ?? {}))
        this.setUniform(name, uniform.value ?? (uniform.type === 'vec4' ? [0, 0, 0, 0] : 0));
    } catch (error) {
      this.release();
      throw error;
    }
  }

  private makeGpu(l: any, source: string) {
    const factory = l.LayaGL.renderDeviceFactory;
    const known = sources.get(this.spec.name);
    if (known && known.source !== source)
      throw Error(
        `Invalid compute pass: another pass named ${this.spec.name} has other code or buffers`,
      );
    const id = (name: string) => l.Shader3D.propertyNameToID(name);
    if (known) this.shader = known.shader;
    else {
      const uniforms = factory.createGlobalUniformMap(this.spec.name + 'Uniforms');
      uniforms.addShaderUniform(id(ZHUDA_COMPUTE_COUNT), ZHUDA_COMPUTE_COUNT, l.ShaderDataType.Int);
      const types = {
        float: l.ShaderDataType.Float,
        vec4: l.ShaderDataType.Vector4,
        int: l.ShaderDataType.Int,
      };
      for (const name of Object.keys(this.spec.uniforms ?? {}).sort())
        uniforms.addShaderUniform(id(name), name, types[this.spec.uniforms![name].type]);
      const buffers = factory.createGlobalUniformMap(this.spec.name + 'Buffers');
      for (const name of Object.keys(this.spec.buffers).sort())
        buffers.addShaderUniform(
          id(blockName(name)),
          blockName(name),
          this.spec.buffers[name].access === 'read'
            ? l.ShaderDataType.ReadOnlyDeviceBuffer
            : l.ShaderDataType.DeviceBuffer,
        );
      this.shader = l.ComputeShader.createComputeShader(this.spec.name, source, [
        uniforms,
        buffers,
      ]);
      sources.set(this.spec.name, { source, shader: this.shader });
    }
    this.uniformData = factory.createShaderData(null);
    this.bufferData = factory.createShaderData(null);
    this.defines = l.LayaGL.unitRenderModuleDataFactory.createDefineDatas();
    this.commands = new l.ComputeCommandBuffer();
    const usage = l.EDeviceBufferUsage;
    for (const [name, spec] of Object.entries(this.spec.buffers)) {
      const bytes = spec.length * SIZE[spec.type] * 4;
      const held: Held = { spec, bytes };
      if (spec.vertex) {
        // One GPU buffer that a step writes and a draw reads.
        held.pair = new l.DeviceBuffer(
          bytes,
          usage.STORAGE | usage.VERTEX | usage.COPY_SRC | usage.COPY_DST,
        );
        held.device = held.pair.deviceBuffer;
      } else {
        held.device = factory.createDeviceBuffer(usage.STORAGE | usage.COPY_SRC | usage.COPY_DST);
        held.device.setDataLength(bytes);
      }
      this.held.set(name, held);
      this.bufferData.setDeviceBuffer(id(blockName(name)), held.device);
    }
  }

  private makeCpu(l: any) {
    for (const [name, spec] of Object.entries(this.spec.buffers)) {
      const count = spec.length * SIZE[spec.type];
      const held: Held = {
        spec,
        bytes: count * 4,
        array: spec.type === 'uint' ? new Uint32Array(count) : new Float32Array(count),
      };
      if (spec.vertex) {
        const create = l.Laya3DRender?.renderOBJCreate?.createVertexBuffer3D;
        if (typeof create !== 'function')
          throw Error("Invalid compute pass: vertex buffers need LayaAir's 3D render module");
        held.vertex = create.call(
          l.Laya3DRender.renderOBJCreate,
          held.bytes,
          l.BufferUsage.Dynamic,
          false,
        );
      }
      this.held.set(name, held);
    }
  }

  private buffer(name: string): Held {
    if (this.disposed) throw Error('Disposed compute pass');
    const held = this.held.get(name);
    if (!held) throw Error(`Invalid compute pass: no buffer ${name}`);
    return held;
  }

  /**
   * Puts numbers into a buffer, from element `offset` on. A `vec4` buffer
   * takes four numbers an element.
   */
  write(name: string, data: Float32Array | Uint32Array, offset = 0): void {
    const held = this.buffer(name);
    const wanted = held.spec.type === 'uint' ? Uint32Array : Float32Array;
    const size = SIZE[held.spec.type];
    if (
      !(data instanceof wanted) ||
      data.length % size !== 0 ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset + data.length / size > held.spec.length
    )
      throw Error(
        `Invalid compute pass: ${name} takes a ${wanted.name} of whole elements that fits (${held.spec.length} ${held.spec.type})`,
      );
    if (held.array) {
      held.array.set(data, offset * size);
      this.upload(held);
      return;
    }
    // A view into a larger array is copied: LayaAir is handed whole arrays.
    const whole =
      data.byteOffset === 0 && data.byteLength === data.buffer.byteLength ? data : data.slice();
    held.device.setData(whole, offset * size * 4, 0, whole.byteLength);
  }

  /** CPU: a buffer that is also vertex data is handed to the GPU again. */
  private upload(held: Held) {
    if (held.vertex && held.array) held.vertex.setData(held.array.buffer, 0, 0, held.bytes);
  }

  /** A uniform's value: a number, or four for a `vec4`. */
  setUniform(name: string, value: number | readonly number[]): void {
    if (this.disposed) throw Error('Disposed compute pass');
    const uniform = this.spec.uniforms?.[name];
    if (!uniform || !validValue(uniform.type, value))
      throw Error(`Invalid compute pass: ${name} is ${uniform ? 'a ' + uniform.type : 'unknown'}`);
    this.values[name] = uniform.type === 'vec4' ? [...(value as number[])] : (value as number);
    if (this.backend !== 'webgpu') return;
    const l = (globalThis as any).Laya;
    const id = l.Shader3D.propertyNameToID(name);
    if (uniform.type === 'float') this.uniformData.setNumber(id, value);
    else if (uniform.type === 'int') this.uniformData.setInt(id, value);
    // A new vector each time: one changed in place is not uploaded on WebGPU.
    else this.uniformData.setVector(id, new l.Vector4(...(value as number[])));
  }

  /** Runs `zhudaStep` for every index below `count` (1..16777216). */
  dispatch(count: number): void {
    if (this.disposed) throw Error('Disposed compute pass');
    if (!(Number.isInteger(count) && count >= 1 && count <= 16777216))
      throw Error('Invalid compute pass: dispatch a whole number 1..16777216');
    if (this.backend === 'webgpu') {
      const l = (globalThis as any).Laya;
      this.uniformData.setInt(l.Shader3D.propertyNameToID(ZHUDA_COMPUTE_COUNT), count);
      this.commands.addDispatchCommand(
        this.shader,
        this.defines,
        [this.uniformData, this.bufferData],
        // More than 65535 groups along one axis is refused by WebGPU: rows along y past GROUPS_PER_ROW.
        new l.Vector3(
          Math.min(Math.ceil(count / ZHUDA_COMPUTE_GROUP), GROUPS_PER_ROW),
          Math.ceil(Math.ceil(count / ZHUDA_COMPUTE_GROUP) / GROUPS_PER_ROW),
          1,
        ),
      );
      this.commands.executeCMDs();
      this.commands.clearCMDs();
      return;
    }
    const arrays: ZhudaComputeArrays = {};
    for (const [name, held] of this.held) arrays[name] = held.array!;
    const values = { ...this.values, [ZHUDA_COMPUTE_COUNT]: count };
    const step = this.spec.step!;
    for (let index = 0; index < count; index++) step(index, arrays, values);
    for (const held of this.held.values()) this.upload(held);
  }

  /**
   * A buffer's numbers as they are now. On the GPU they are copied out and
   * waited for; a draw does not need this.
   */
  async read(name: string): Promise<Float32Array | Uint32Array> {
    const held = this.buffer(name);
    if (held.array) return held.array.slice();
    const l = (globalThis as any).Laya;
    const usage = l.EDeviceBufferUsage;
    const reader = l.LayaGL.renderDeviceFactory.createDeviceBuffer(usage.MAP_READ | usage.COPY_DST);
    try {
      reader.setDataLength(held.bytes);
      held.device.copyToBuffer(reader, 0, 0, held.bytes);
      const out = new ArrayBuffer(held.bytes);
      await reader.readData(out, 0, 0, held.bytes);
      return held.spec.type === 'uint' ? new Uint32Array(out) : new Float32Array(out);
    } finally {
      reader.destroy();
    }
  }

  /**
   * LayaAir's vertex buffer over a buffer declared with `vertex: true`, for
   * a draw. On the GPU it is the buffer the step writes; in JavaScript it is
   * filled again after every dispatch.
   */
  vertexBuffer(name: string): any {
    const held = this.buffer(name);
    const buffer = held.pair?.vertexBuffer ?? held.vertex;
    if (!buffer) throw Error(`Invalid compute pass: ${name} was not declared with vertex: true`);
    return buffer;
  }

  private release() {
    for (const held of this.held.values()) {
      if (held.pair) {
        // LayaAir's own `DeviceBuffer.destroy` destroys the storage buffer
        // twice (once through the vertex buffer) and throws on the second.
        held.pair.vertexBuffer?.destroy();
        if (held.device && !held.device._destroyed) held.device.destroy();
      } else held.device?.destroy();
      held.vertex?.destroy();
    }
    this.held.clear();
    this.commands?.destroy?.();
    this.uniformData?.destroy?.();
    this.bufferData?.destroy?.();
    this.commands = this.uniformData = this.bufferData = undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
  }
}

export interface ZhudaComputedInstancesOptions {
  /**
   * The box every copy stays inside, in the world: what the draw is culled
   * by. The places are on the GPU; nothing else knows where they are.
   */
  bounds: { min: readonly [number, number, number]; max: readonly [number, number, number] };
  /** Default true. */
  castShadow?: boolean;
  /** Default true. */
  receiveShadow?: boolean;
  layer?: number;
  label?: string;
}

/** Floats a copy in the buffer a pass writes: a matrix's four columns, then (1, 0, 0, 0). */
export const ZHUDA_COMPUTED_INSTANCE_FLOATS = 20;

/**
 * One draw of `count` copies of a mesh, each at the world matrix a compute
 * pass wrote for it: five `vec4` a copy in a buffer declared with `vertex:
 * true`, the matrix's four columns and then `vec4(1, 0, 0, 0)` (LayaAir's
 * own fifth: 1 for a copy that is not mirrored).
 *
 * Nothing is read back: the step and the draw share the buffer.
 */
export class ZhudaComputedInstances {
  readonly count: number;
  private node: any;
  private readonly owned: { destroy(): void }[] = [];
  private disposed = false;

  constructor(
    parent: any,
    mesh: any,
    materials: any,
    pass: ZhudaComputePass,
    buffer: string,
    count: number,
    options: ZhudaComputedInstancesOptions,
  ) {
    const l = (globalThis as any).Laya;
    if (!l?.MeshInstanceGeometry || !l.BufferState || !l.VertexMesh?.instanceWorldMatrixDeclaration)
      throw Error("Computed instances need LayaAir's 3D render module");
    if (!parent || typeof parent.addChild !== 'function')
      throw Error('Computed instances: a parent node is expected');
    if (!mesh || mesh.destroyed || !mesh._bufferState?._vertexBuffers)
      throw Error('Computed instances: a live LayaAir mesh is expected');
    const spec = pass?.spec?.buffers?.[buffer];
    if (!spec?.vertex)
      throw Error(`Computed instances: ${buffer} is not a buffer declared with vertex: true`);
    if (!(Number.isInteger(count) && count >= 1 && count * 5 <= spec.length))
      throw Error('Computed instances: five vec4 a copy must fit the buffer');
    const box = options?.bounds;
    const corner = (v: unknown) =>
      Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n));
    if (!box || !corner(box.min) || !corner(box.max) || box.min.some((v, i) => v > box.max[i]))
      throw Error('Computed instances: bounds are { min, max } in the world');
    const list: any[] = Array.isArray(materials) ? [...materials] : [materials];
    const parts = mesh.subMeshCount ?? 1;
    if (!list.length || list.length > parts || list.some((m) => !m || m.destroyed))
      throw Error(`Computed instances: one live material, or one a sub-mesh (${parts})`);
    while (list.length < parts) list.push(list[list.length - 1]);
    this.count = count;
    try {
      const places = pass.vertexBuffer(buffer);
      places.vertexDeclaration = l.VertexMesh.instanceWorldMatrixDeclaration;
      places.instanceBuffer = true;
      // WebGPU's instanced shaders name this attribute whether or not a lightmap is used.
      const lightmap = new Float32Array(4 * count);
      for (let i = 0; i < count; i++) lightmap.set([1, 1, 0, 0], i * 4);
      const scale = l.Laya3DRender.renderOBJCreate.createVertexBuffer3D(
        lightmap.byteLength,
        l.BufferUsage.Static,
        false,
      );
      this.owned.push(scale);
      scale.vertexDeclaration = l.VertexMesh.instanceLightMapScaleOffsetDeclaration;
      scale.instanceBuffer = true;
      scale.setData(lightmap.buffer, 0, 0, lightmap.byteLength);
      const state = new l.BufferState();
      this.owned.push(state);
      state.applyState([...mesh._bufferState._vertexBuffers, places, scale], mesh._indexBuffer);
      const node = (this.node = new l.MeshSprite3D(mesh));
      node.name = options.label ?? 'ZhudaComputedInstances';
      if (options.layer !== undefined) node.layer = options.layer;
      const renderer = node.meshRenderer;
      renderer.sharedMaterials = list;
      renderer.castShadow = options.castShadow !== false;
      renderer.receiveShadow = options.receiveShadow !== false;
      const elements: any[] = renderer._renderElements ?? [];
      if (elements.length !== parts)
        throw Error('Computed instances: this LayaAir version draws a mesh in another way');
      elements.forEach((element, i) => {
        const geometry = new l.MeshInstanceGeometry(mesh.getSubMesh(i));
        this.owned.push(geometry);
        geometry.bufferState = state;
        geometry.instanceCount = count;
        element.setGeometry(geometry);
        // LayaAir would gather nodes of one mesh and material into a batch of its own.
        element._renderElementOBJ.canDynamicBatch = false;
      });
      renderer._baseRenderNode.shaderData.addDefine(
        l.MeshSprite3DShaderDeclaration.SHADERDEFINE_GPU_INSTANCE,
      );
      renderer.geometryBounds = new l.Bounds(
        new l.Vector3(box.min[0], box.min[1], box.min[2]),
        new l.Vector3(box.max[0], box.max[1], box.max[2]),
      );
      // Added last: WebGPU decides how a renderer is drawn when it joins the scene.
      parent.addChild(node);
    } catch (error) {
      this.release();
      throw error;
    }
  }

  private release() {
    if (this.node && !this.node.destroyed) destroyLaya342ModelTree(this.node);
    this.node = undefined;
    for (const item of this.owned.splice(0).reverse()) item.destroy();
  }

  /** Destroys the draw; the mesh, the materials and the pass are the caller's. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
  }
}
