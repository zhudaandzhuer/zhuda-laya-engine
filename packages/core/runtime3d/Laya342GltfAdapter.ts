import { destroyLaya342ModelTree } from './Laya342Adapters.ts';
import {
  readZhudaGltfInstancing,
  resolveZhudaGltfTextureSource,
  zhudaGltfInstanceMatrices,
  type ZhudaImageDecodeSupport,
  type ZhudaLayaLightSettings,
} from './GltfIntake.ts';
import { createZhudaBasisTexture, isZhudaKtx2, type ZhudaBasisTranscoder } from './BasisTexture.ts';
import {
  ZHUDA_EMISSION_UV1_DEFINE,
  ZHUDA_OCCLUSION_UV1_DEFINE,
  ZHUDA_UV1_DEFINE,
  zhudaGltfTexCoord,
  zhudaSecondUvStatus,
} from './GltfSecondUv.ts';
const prepared = new WeakSet<object>();
// The Laya node made for each glTF node by the resource's last create().
const createdNodes = new WeakMap<object, readonly any[]>();
// The glTF textures whose picture did not load, per resource.
const missingTextures = new WeakMap<object, Set<number>>();
/** The copies a glTF node asks for (`EXT_mesh_gpu_instancing`), read when the file was parsed. */
export interface Laya342GltfInstances {
  /** Sixteen numbers a copy, column by column, in the node's own space. */
  readonly matrices: Float32Array;
  /** How many copies the file asked for and are not here: their scale turns the mesh inside out. */
  readonly mirrored: number;
}
const instances = new WeakMap<object, Map<number, Laya342GltfInstances>>();
// Textures that asked for the second set of texture coordinates and were not given it, per resource.
const refusedSecondUv = new WeakMap<object, { material: number; slot: string; reason: string }[]>();
/** Whether two byte ranges hold the same bytes. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let i = 0;
  // Whole words first when both ranges start on one (LayaAir's slices do).
  if (a.byteOffset % 4 === 0 && b.byteOffset % 4 === 0) {
    const words = a.byteLength >>> 2,
      wa = new Uint32Array(a.buffer, a.byteOffset, words),
      wb = new Uint32Array(b.buffer, b.byteOffset, words);
    for (let w = 0; w < words; w++) if (wa[w] !== wb[w]) return false;
    i = words * 4;
  }
  for (; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}
/** Options for one owned glTFResource. */
export interface Laya342GltfResourceOptions {
  /** This device's WebP/AVIF decoding; picks each texture's image (see resolveZhudaGltfTextureSource). */
  imageDecode?: ZhudaImageDecodeSupport;
  /** Transcodes embedded KTX 2 images (`KHR_texture_basisu`) to a format the graphics card samples. */
  basis?: ZhudaBasisTranscoder;
}
/** Version-pinned importer repairs. Applied to one owned glTFResource, never to
 * global prototypes. The native Animator remains the sole pose evaluator. */
export function prepareLaya342GltfResource(
  resource: any,
  runtime: any,
  options: Laya342GltfResourceOptions = {},
): void {
  if (prepared.has(resource)) return;
  prepared.add(resource);
  // The embedded pictures this parse has asked for, each with its one load.
  const pictures: { mimeType: string; bytes: Uint8Array; texture: Promise<unknown> }[] = [];
  // EXT_texture_webp / EXT_texture_avif: the native loader reads only
  // textures[i].source. Point it at the image this device decodes, in this
  // resource's own parsed document, before any texture (core or extension slot) loads.
  const loadTextures = resource.loadTextures;
  if (typeof loadTextures === 'function')
    resource.loadTextures = function (...args: any[]) {
      (this._data?.textures ?? []).forEach((texture: any, i: number) => {
        const source = resolveZhudaGltfTextureSource(texture, options.imageDecode);
        if (source.image !== null) texture.source = source.image;
        else if (source.unavailable.length)
          throw Error(`glTF textures[${i}] has no image this device can decode.`);
      });
      // Every slot asks for its picture inside this call: once they have all
      // loaded, the bytes kept to recognise a repeat are let go.
      const forget = () => (pictures.length = 0);
      let loading: unknown;
      try {
        loading = loadTextures.apply(this, args);
      } catch (error) {
        forget();
        throw error;
      }
      if (typeof (loading as any)?.then !== 'function') return (forget(), loading);
      return (loading as Promise<unknown>).then(
        (textures) => (forget(), textures),
        (error) => {
          forget();
          throw error;
        },
      );
    };
  // A picture that does not load leaves its slots empty in LayaAir, which only
  // warns on the console. Remember which textures, for the model's report.
  const fromInfo = resource.loadTextureFromInfo;
  if (typeof fromInfo === 'function')
    resource.loadTextureFromInfo = function (info: any, ...rest: any[]) {
      return Promise.resolve(fromInfo.call(this, info, ...rest)).then((texture: unknown) => {
        if (!texture && Number.isInteger(info?.index)) {
          const missing = missingTextures.get(this) ?? new Set<number>();
          missingTextures.set(this, missing.add(info.index));
        }
        return texture;
      });
    };
  // Embedded images: the native loader base64-encodes each one into a data URL
  // on the main thread (a string about 1.33 times the picture) for the browser
  // to decode again. Hand the same bytes to the same loader as a Blob URL
  // instead, and revoke it once the picture has loaded.
  const fromBuffer = resource.loadTextureFromBuffer;
  const urls = (globalThis as any).URL;
  const loader = runtime?.ILaya?.loader ?? runtime?.loader;
  if (
    typeof fromBuffer === 'function' &&
    typeof (globalThis as any).Blob === 'function' &&
    typeof urls?.createObjectURL === 'function' &&
    typeof loader?.load === 'function' &&
    runtime?.Loader?.TEXTURE2D
  )
    resource.loadTextureFromBuffer = function (
      buffer: ArrayBuffer | ArrayBufferView,
      mimeType: string,
      constructParams: unknown,
      propertyParams: unknown,
      progress?: { createCallback(): (progress: number) => void },
    ) {
      const bytes = ArrayBuffer.isView(buffer)
        ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
        : new Uint8Array(buffer);
      // One picture, one texture. LayaAir asks once per material slot, not once
      // per picture. Its data URL was the same for the same bytes, so its
      // loader answered a repeat with the texture it already had (and with the
      // first slot's sampler and colour space, as here). A Blob URL is new each
      // time: recognise the repeat here, by the bytes themselves.
      const repeat = pictures.find((p) => p.mimeType === mimeType && sameBytes(p.bytes, bytes));
      if (repeat) {
        const done = progress?.createCallback();
        return done ? repeat.texture.then((texture) => (done(1), texture)) : repeat.texture;
      }
      if (mimeType === 'image/ktx2' || isZhudaKtx2(bytes)) {
        // A KTX 2 image: no browser decodes it. Transcoded here and uploaded
        // compressed; a failure leaves the slot empty, as LayaAir's own
        // failed loads do, and the model's report names the texture.
        const done = progress?.createCallback();
        const params = constructParams as unknown[] | null | undefined;
        const made = Promise.resolve().then(() => {
          let made: any = null;
          try {
            if (!options.basis) throw Error('no Basis transcoder was given to the model library');
            made = createZhudaBasisTexture(
              options.basis,
              bytes,
              // LayaAir's construct parameters: index 5 says whether the slot reads sRGB.
              { role: params?.[5] ? 'color' : 'data' },
              runtime,
            );
            if (propertyParams) made.setProperties?.(propertyParams);
          } catch (error) {
            console.warn(
              `[zhuda] KTX 2 image did not load: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
          done?.(1);
          return made;
        });
        pictures.push({ mimeType, bytes, texture: made });
        return made;
      }
      const url = urls.createObjectURL(
        new Blob([bytes as Uint8Array<ArrayBuffer>], {
          type: mimeType || 'application/octet-stream',
        }),
      );
      const revoke = () => urls.revokeObjectURL(url);
      let texture: Promise<unknown>;
      try {
        texture = Promise.resolve(
          loader.load(
            // Not kept in LayaAir's URL cache: this URL is revoked and never
            // asked for again, and a failed load would stay there as a null.
            { url, constructParams, propertyParams, cache: false },
            runtime.Loader.TEXTURE2D,
            progress?.createCallback(),
          ),
        ).then(
          // LayaAir 3.4.2 answers a failed load with null rather than rejecting.
          (loaded: unknown) => (revoke(), loaded),
          (error: unknown) => {
            revoke();
            throw error;
          },
        );
      } catch (error) {
        revoke();
        throw error;
      }
      pictures.push({ mimeType, bytes, texture });
      return texture;
    };
  const loadNodes = resource.loadNodes;
  if (typeof loadNodes === 'function')
    resource.loadNodes = function (...args: any[]) {
      const result = loadNodes.apply(this, args);
      createdNodes.set(this, [...(this._nodes ?? [])]);
      // EXT_mesh_gpu_instancing: LayaAir makes the node and draws its mesh
      // once. Read where the copies go; whoever mounts the model draws them.
      const found = new Map<number, Laya342GltfInstances>();
      for (const item of readZhudaGltfInstancing(this._data).instancing) {
        const read = (accessor: number | null) =>
          accessor === null ? null : this.getBufferwithAccessorIndex(accessor);
        const component =
          item.rotation === null ? 5126 : this._data.accessors[item.rotation].componentType;
        let made: ReturnType<typeof zhudaGltfInstanceMatrices>;
        try {
          made = zhudaGltfInstanceMatrices(
            item.count,
            read(item.translation),
            read(item.rotation),
            read(item.scale),
            component === 5120 ? 1 / 127 : component === 5122 ? 1 / 32767 : 1,
          );
        } catch (error) {
          throw Error(
            `glTF node ${item.index} (EXT_mesh_gpu_instancing): ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        // One draw has one facing: a copy turned inside out is left out and reported.
        let matrices = made.matrices;
        if (made.mirrored.length) {
          const skip = new Set(made.mirrored);
          matrices = new Float32Array((item.count - skip.size) * 16);
          let k = 0;
          for (let i = 0; i < item.count; i++)
            if (!skip.has(i)) matrices.set(made.matrices.subarray(i * 16, i * 16 + 16), k++ * 16);
        }
        found.set(item.index, { matrices, mirrored: made.mirrored.length });
      }
      instances.set(this, found);
      return result;
    };
  // The texture references read by the second set of texture coordinates:
  // LayaAir's loader warns of every one that is not the first.
  const secondSet = new WeakSet<object>();
  const withInfo = resource.getTextureWithInfo;
  if (typeof withInfo === 'function')
    resource.getTextureWithInfo = function (info: any, ...rest: unknown[]) {
      if (info && secondSet.has(info)) return this._textures?.[info.index];
      return withInfo.call(this, info, ...rest);
    };
  const createMaterial = resource.createMaterial;
  if (typeof createMaterial === 'function')
    resource.createMaterial = function (definition: any) {
      // Occlusion and emission may be laid out on TEXCOORD_1 (a baked map).
      const slots = [
        {
          info: definition?.occlusionTexture,
          slot: 'occlusion',
          define: ZHUDA_OCCLUSION_UV1_DEFINE,
        },
        { info: definition?.emissiveTexture, slot: 'emissive', define: ZHUDA_EMISSION_UV1_DEFINE },
      ].filter((item) => item.info && zhudaGltfTexCoord(item.info) === 1);
      const status = zhudaSecondUvStatus(runtime);
      if (status.ready) for (const item of slots) secondSet.add(item.info);
      const material = createMaterial.call(this, definition);
      if (slots.length) {
        if (status.ready) {
          const define = (name: string) =>
            material.addDefine(runtime.Shader3D.getDefineByName(name));
          define(ZHUDA_UV1_DEFINE);
          for (const item of slots) define(item.define);
        } else {
          const index = (this._data?.materials ?? []).indexOf(definition);
          const refused = refusedSecondUv.get(this) ?? [];
          refusedSecondUv.set(this, refused);
          for (const item of slots)
            refused.push({ material: index, slot: item.slot, reason: status.reason ?? 'unknown' });
        }
      }
      // Native KHR_materials_unlit mutates the color returned by its getter, then
      // assigns that same object. WebGPU's equality fast path skips conversion,
      // leaving the linear GPU uniform white. Repair this owned imported material.
      if (
        definition.extensions?.KHR_materials_unlit &&
        definition.pbrMetallicRoughness?.baseColorFactor
      ) {
        const linear = new runtime.Color();
        material.albedoColor.toLinear(linear);
        material.setVector4(
          'u_AlbedoColor',
          new runtime.Vector4(linear.r, linear.g, linear.b, linear.a),
        );
      }
      return material;
    };
  // glTF stores COLOR_0 as three or four components, as floats or as normalized
  // bytes or shorts. The native loader hands the raw array to a four-float
  // vertex element: a 16-bit colour arrives 65535 times too bright and a
  // three-component one is read out of step. Convert to four floats.
  const attribute = resource.getArrributeBuffer;
  if (typeof attribute === 'function')
    resource.getArrributeBuffer = function (index: number, name: string, map: any, names: any) {
      const raw = attribute.call(this, index, name, map, names);
      if (!raw || name !== 'COLOR') return raw;
      const fixed = zhudaGltfColors(raw, this._data?.accessors?.[index]);
      map.set(name, fixed);
      return fixed;
    };
  // A mesh's primitives go into one vertex buffer laid out as the first one's:
  // parseMeshwithSubMeshData takes the first primitive's attribute list and
  // fillMeshBuffers packs each primitive's own attributes in order. A primitive
  // without an attribute the first has (a body with vertex colours, eyes
  // without) is written out of step: its weights land in the colour slot and its
  // skin collapses, its texture coordinates become colours. Give every primitive
  // of the mesh the same attributes first.
  const parseMesh = resource.parseMeshwithSubMeshData;
  if (typeof parseMesh === 'function')
    resource.parseMeshwithSubMeshData = function (subMeshes: any[], mesh: any) {
      unifyLaya342SubMeshAttributes(subMeshes);
      return parseMesh.call(this, subMeshes, mesh);
    };
  // A skin of more than 24 joints is cut into pieces, a draw each in every
  // pass: the loader walks the triangles in the file's order, gathers the
  // joints they name and starts a piece when the next triangle would bring
  // the count past 24. How many pieces that is depends on the order alone (a
  // skin of 36 joints was cut into 1,065). The triangles are put in an order
  // that cuts into few, and the joints a vertex names without weighting it
  // are not counted.
  const split = resource.splitSubMeshByBonesCount;
  if (typeof split === 'function')
    resource.splitSubMeshByBonesCount = function (attributes: any, ...rest: any[]) {
      const indices = rest[1],
        joints = attributes?.get?.('BLENDINDICES'),
        weights = attributes?.get?.('BLENDWEIGHT');
      if (indices?.length && joints?.length && weights?.length === joints.length)
        orderLaya342SkinTriangles(indices, joints, weights);
      return split.call(this, attributes, ...rest);
    };
  for (const method of ['createMeshSprite3D', 'createSkinnedMeshSprite3D']) {
    const original = resource[method];
    if (typeof original !== 'function') continue;
    resource[method] = function (definition: any) {
      const node = original.call(this, definition);
      if (definition.weights !== undefined) {
        const renderer =
          node.getComponent(runtime.SkinnedMeshRenderer) || node.getComponent(runtime.MeshRenderer);
        const morphs = node.getComponent(runtime.MeshFilter)?.sharedMesh?.morphTargetData;
        if (!renderer || !morphs || definition.weights.length !== morphs.channelCount) {
          destroyLaya342ModelTree(node, runtime);
          throw Error('glTF node morph weights do not match its mesh.');
        }
        for (let i = 0; i < morphs.channelCount; i++)
          renderer.setMorphChannelWeight(
            morphs.getMorphChannelbyIndex(i).name,
            definition.weights[i],
          );
      }
      return node;
    };
  }
  const createClip = resource.createAnimatorClip;
  if (typeof createClip !== 'function') return;
  resource.createAnimatorClip = function (animation: any, root: any) {
    const tracks: {
      paths: string[];
      owner: string;
      names: string[];
      times: ArrayLike<number>;
      values: ArrayLike<number>;
    }[] = [];
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler];
      if (channel.target.path !== 'weights' || sampler.interpolation !== 'CUBICSPLINE') continue;
      const node = this._nodes[channel.target.node];
      const morphs = node?.getComponent(runtime.MeshFilter)?.sharedMesh?.morphTargetData;
      if (!morphs) throw Error('CUBICSPLINE weights require a morph target mesh.');
      const times = this.getBufferwithAccessorIndex(sampler.input),
        values = this.getBufferwithAccessorIndex(sampler.output);
      const count = morphs.channelCount;
      if (
        !count ||
        !times ||
        times.length < 1 ||
        !values ||
        values.length !== times.length * count * 3
      )
        throw Error('Invalid CUBICSPLINE morph sample count.');
      for (let i = 0; i < times.length; i++)
        if (!Number.isFinite(times[i]) || times[i] < 0 || (i > 0 && times[i] <= times[i - 1]))
          throw Error('Invalid CUBICSPLINE morph sample times.');
      for (let i = 0; i < values.length; i++)
        if (!Number.isFinite(values[i])) throw Error('Invalid CUBICSPLINE morph sample value.');
      tracks.push({
        paths: this.getAnimationPath(root, node),
        owner: node.getComponent(runtime.SkinnedMeshRenderer)
          ? 'SkinnedMeshRenderer'
          : 'MeshRenderer',
        names: Array.from({ length: count }, (_, i) => morphs.getMorphChannelbyIndex(i).name),
        times,
        values,
      });
    }
    // The native 3.4.2 path drops these channels. Keep all native transform and
    // LINEAR/STEP paths, then append exact cubic scalar tracks to that same clip.
    const clip = createClip.call(this, animation, root);
    indexLaya342ClipNodes(clip);
    try {
      for (const track of tracks)
        for (let morph = 0; morph < track.names.length; morph++) {
          const name = track.names[morph],
            index = clip._nodes.count,
            node = new runtime.KeyframeNode();
          clip._nodes.count = index + 1;
          clip._nodes.setNodeByIndex(index, node);
          node._indexInList = index;
          node.type = 0;
          node._setOwnerPathCount(track.paths.length);
          track.paths.forEach((p, i) => node._setOwnerPathByIndex(i, p));
          const ownerPath = node._joinOwnerPath('/');
          (clip._nodesMap[ownerPath] ||= []).push(node);
          node.propertyOwner = track.owner;
          node._setPropertyCount(2);
          node._setPropertyByIndex(0, 'morphTargetValues');
          node._setPropertyByIndex(1, name);
          node.fullPath = `${ownerPath}.${track.owner}.morphTargetValues.${name}`;
          clip._nodesDic[node.fullPath] = node;
          node.callbackFunData = '_changeMorphTargetValue';
          node.callParams = [name];
          node.propertyChangePath = 'morphTargetValues';
          for (let key = 0; key < track.times.length; key++) {
            const frame = new runtime.FloatKeyframe(),
              start = key * track.names.length * 3;
            frame.time = track.times[key];
            frame.inTangent = track.values[start + morph];
            frame.value = track.values[start + track.names.length + morph];
            frame.outTangent = track.values[start + track.names.length * 2 + morph];
            node._setKeyframeByIndex(key, frame);
          }
          clip._duration = Math.max(clip._duration, track.times[track.times.length - 1]);
        }
      return clip;
    } catch (error) {
      clip.destroy();
      throw error;
    }
  };
}

/** LayaAir 3.4.2's glTF reader files every keyframe node of a clip under its full path as the
 * path string itself; its `.lani` reader files the node. `Animator.crossFade` reads
 * `_indexInList` from that entry to pair the two clips' nodes, finds none on a string, and so
 * blends a glTF model towards its bind pose and back instead of from one clip to the other.
 * File the nodes. Returns how many entries were corrected. */
export function indexLaya342ClipNodes(clip: any): number {
  const nodes = clip?._nodes,
    index = clip?._nodesDic;
  if (!nodes || !index || typeof nodes.getNodeByIndex !== 'function') return 0;
  let corrected = 0;
  for (let i = 0; i < nodes.count; i++) {
    const node = nodes.getNodeByIndex(i);
    if (!node || typeof node.fullPath !== 'string' || index[node.fullPath] === node) continue;
    index[node.fullPath] = node;
    corrected++;
  }
  return corrected;
}

/** Native MeshRenderer cloning does not consistently preserve authored weights.
 * Copy values through the public setter to retain independent dirty tracking. */
export function copyLaya342MorphWeights(source: any, target: any, runtime: any): void {
  const a = source.getComponent?.(runtime.MeshRenderer),
    b = target.getComponent?.(runtime.MeshRenderer);
  if (a && b)
    for (const [name, weight] of Object.entries(a.morphTargetValues ?? {}))
      b.setMorphChannelWeight(name, weight);
}

/** Native create() retains its partial trees on failure. Retire their components
 * before the caller releases the parsed resource and its shared dependencies. */
export function createLaya342ModelTemplate(resource: any, runtime: any): Laya.Sprite3D {
  try {
    return resource.create();
  } catch (error) {
    const nodes = new Set<any>(),
      clips = new Set<any>();
    const collect = (node: any) => {
      if (!node || nodes.has(node)) return;
      nodes.add(node);
      const animator = runtime.Animator && node.getComponent?.(runtime.Animator);
      if (animator)
        for (let layer = 0; layer < animator.controllerLayerCount; layer++)
          for (const state of animator.getControllerLayer(layer).states)
            if (state.clip) clips.add(state.clip);
      for (let i = 0; i < (node.numChildren || 0); i++) collect(node.getChildAt(i));
    };
    for (const node of [...(resource._scenes ?? []), ...(resource._nodes ?? [])]) collect(node);
    for (const node of nodes) if (!node.destroyed) destroyLaya342ModelTree(node, runtime);
    for (const clip of clips) if (!clip.destroyed && clip.referenceCount === 0) clip.destroy();
    if (resource._scenes) resource._scenes.length = 0;
    if (resource._nodes) resource._nodes.length = 0;
    throw error;
  }
}

/**
 * The glTF texture indices whose picture did not load or decode while the
 * resource was parsed: LayaAir left their material slots empty.
 */
export function laya342GltfMissingTextures(resource: object): readonly number[] {
  return [...(missingTextures.get(resource) ?? [])].sort((a, b) => a - b);
}

/**
 * The occlusion and emissive textures that asked for the second set of
 * texture coordinates and are drawn with the first, because the shader
 * text that reads it could not be put in place.
 */
export function laya342GltfRefusedSecondUv(
  resource: object,
): readonly { material: number; slot: string; reason: string }[] {
  return refusedSecondUv.get(resource) ?? [];
}

/** The copies each glTF node asks for (`EXT_mesh_gpu_instancing`), by node index. */
export function laya342GltfInstances(resource: object): ReadonlyMap<number, Laya342GltfInstances> {
  return instances.get(resource) ?? new Map();
}

/** The Laya node made for each glTF node index by the resource's last create(). */
export function laya342GltfNodes(resource: object): readonly any[] {
  return createdNodes.get(resource) ?? [];
}

/** Adds a LayaAir light component, set from `zhudaGltfLightToLaya`, to a node.
 * It points down the node's -Z, as glTF's does, and casts no shadow. */
export function createLaya342GltfLight(
  node: any,
  settings: ZhudaLayaLightSettings,
  runtime: any,
): any {
  const type =
    settings.kind === 'directional'
      ? runtime.DirectionLightCom
      : settings.kind === 'spot'
        ? runtime.SpotLightCom
        : runtime.PointLightCom;
  if (!type) throw Error(`LayaAir has no ${settings.kind} light component here`);
  const light = node.addComponent(type);
  light.color = new runtime.Color(...settings.color, 1);
  light.intensity = settings.intensity;
  if (settings.range !== null) light.range = settings.range;
  if (settings.spotAngleDeg !== null) light.spotAngle = settings.spotAngleDeg;
  return light;
}

/** The most joints LayaAir 3.4.2 gives one draw of a skinned mesh. */
const LAYA342_JOINTS_A_DRAW = 24;

/**
 * How many pieces LayaAir 3.4.2's glTF loader cuts a skinned primitive into
 * for these triangles in this order: it gathers the joints the triangles
 * name, all four a vertex, and starts a piece when one more triangle would
 * bring them past 24. One for a skin that names 24 joints or fewer. Pure.
 */
export function countLaya342SkinPieces(
  indices: ArrayLike<number>,
  joints: ArrayLike<number>,
): number {
  let pieces = 1,
    held = new Set<number>();
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const triangle = new Set<number>();
    for (let k = 0; k < 3; k++)
      for (let j = 0; j < 4; j++) triangle.add(joints[indices[t + k] * 4 + j]);
    const both = new Set([...held, ...triangle]);
    if (both.size > LAYA342_JOINTS_A_DRAW) {
      pieces++;
      held = triangle;
    } else held = both;
  }
  return pieces;
}

/**
 * Puts a skinned primitive's triangles in an order LayaAir 3.4.2 cuts into
 * few pieces, in place, and returns the pieces before and after. Two things
 * are done, neither of which changes what is drawn:
 *
 * - a joint a vertex names with no weight is replaced by the joint that
 *   vertex is weighted to most (`joints` is changed in place): the loader
 *   counts a named joint whether it is weighted or not;
 * - the triangles are gathered a piece at a time: every triangle whose
 *   joints the piece already holds, then the one that adds the fewest, until
 *   no triangle fits in 24.
 *
 * The order is left as it is when it is already cut as little, or when the
 * skin names 24 joints or fewer.
 */
export function orderLaya342SkinTriangles(
  indices: { [index: number]: number; readonly length: number },
  joints: { [index: number]: number; readonly length: number },
  weights: ArrayLike<number>,
): { before: number; after: number } {
  const vertices = Math.floor(joints.length / 4);
  for (let v = 0; v < vertices; v++) {
    let most = 0;
    for (let j = 1; j < 4; j++) if (weights[v * 4 + j] > weights[v * 4 + most]) most = j;
    if (!(weights[v * 4 + most] > 0)) continue;
    for (let j = 0; j < 4; j++)
      if (!(weights[v * 4 + j] > 0)) joints[v * 4 + j] = joints[v * 4 + most];
  }
  const before = countLaya342SkinPieces(indices, joints);
  if (before === 1) return { before, after: 1 };
  let highest = 0;
  for (let i = 0; i < joints.length; i++) if (joints[i] > highest) highest = joints[i];
  const words = (highest >> 5) + 1,
    count = Math.floor(indices.length / 3);
  // Each triangle's joints as bits.
  const bits = new Uint32Array(count * words);
  for (let t = 0; t < count; t++)
    for (let k = 0; k < 3; k++)
      for (let j = 0; j < 4; j++) {
        const joint = joints[indices[t * 3 + k] * 4 + j];
        bits[t * words + (joint >> 5)] |= 1 << (joint & 31);
      }
  const ones = (value: number) => {
    value -= (value >>> 1) & 0x55555555;
    value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
    return (((value + (value >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  };
  const order = new Uint32Array(count),
    placed = new Uint8Array(count),
    held = new Uint32Array(words);
  let done = 0,
    heldCount = 0;
  while (done < count) {
    // Everything the piece's joints already cover, and the nearest of what is left.
    let nearest = -1,
      fewest = Infinity;
    for (let t = 0; t < count; t++) {
      if (placed[t]) continue;
      let added = 0;
      for (let w = 0; w < words; w++) added += ones(bits[t * words + w] & ~held[w]);
      if (added === 0) {
        placed[t] = 1;
        order[done++] = t;
      } else if (added < fewest) {
        fewest = added;
        nearest = t;
      }
    }
    if (nearest < 0) break;
    // The nearest joins the piece when it fits; otherwise a new piece starts with it.
    if (heldCount + fewest > LAYA342_JOINTS_A_DRAW) {
      held.fill(0);
      heldCount = 0;
      for (let w = 0; w < words; w++) heldCount += ones(bits[nearest * words + w]);
    } else heldCount += fewest;
    for (let w = 0; w < words; w++) held[w] |= bits[nearest * words + w];
  }
  const sorted = new Uint32Array(count * 3);
  for (let i = 0; i < count; i++)
    for (let k = 0; k < 3; k++) sorted[i * 3 + k] = indices[order[i] * 3 + k];
  const after = countLaya342SkinPieces(sorted, joints);
  if (after >= before) return { before, after: before };
  for (let i = 0; i < sorted.length; i++) indices[i] = sorted[i];
  return { before, after };
}

/** The vertex attributes of LayaAir 3.4.2's glTF loader, in the order it lists and packs them. */
const LAYA342_ATTRIBUTES = [
  'POSITION',
  'NORMAL',
  'COLOR',
  'UV',
  'UV1',
  'BLENDWEIGHT',
  'BLENDINDICES',
  'TANGENT',
] as const;
const repeat = (values: number[], n: number) => {
  const out = new Float32Array(values.length * n);
  for (let i = 0; i < n; i++) out.set(values, i * values.length);
  return out;
};
/** What a primitive lacking an attribute its mesh's others have gets, for n vertices. */
const LAYA342_DEFAULTS: Record<string, (n: number) => ArrayLike<number>> = {
  NORMAL: (n) => repeat([0, 1, 0], n),
  // White: a vertex colour multiplies, so this changes nothing.
  COLOR: (n) => new Float32Array(n * 4).fill(1),
  UV: (n) => new Float32Array(n * 2),
  UV1: (n) => new Float32Array(n * 2),
  // The whole weight on the first joint of its batch.
  BLENDWEIGHT: (n) => repeat([1, 0, 0, 0], n),
  BLENDINDICES: (n) => new Uint8Array(n * 4),
  TANGENT: (n) => repeat([1, 0, 0, 1], n),
};
/**
 * Gives every primitive (sub-mesh) of one glTF mesh the same vertex attributes,
 * the union of theirs, before LayaAir 3.4.2 packs them into one buffer laid out
 * as the first one's. A missing attribute gets a value that changes nothing (see
 * LAYA342_DEFAULTS). Returns how many attributes were added; leaves the list as
 * it was when it holds a name this function does not know.
 */
export function unifyLaya342SubMeshAttributes(subMeshes: any[]): number {
  if (!Array.isArray(subMeshes) || subMeshes.length < 2) return 0;
  const names = subMeshes.map((s) =>
    String(s?.vertexDecler ?? '')
      .split(',')
      .filter(Boolean),
  );
  const known = new Set<string>(LAYA342_ATTRIBUTES);
  if (names.some((list) => list.some((name) => !known.has(name)))) return 0;
  const union = LAYA342_ATTRIBUTES.filter((name) => names.some((list) => list.includes(name)));
  const declaration = union.join(',');
  let added = 0;
  subMeshes.forEach((s, i) => {
    if (names[i].join(',') === declaration) return;
    for (const name of union)
      if (!s.attributeMap.has(name)) {
        s.attributeMap.set(name, LAYA342_DEFAULTS[name](s.vertexCount));
        added++;
      }
    s.vertexDecler = declaration;
  });
  return added;
}

/**
 * A colour accessor's values as RGBA floats in 0..1 (see glTF 2.0, COLOR_0), for
 * LayaAir's vertex colour: glTF's colour is linear, and LayaAir's shader raises
 * the red, green and blue it is given to the power 2.2 (it takes them as display
 * values), so they are handed over raised to 1/2.2. Alpha is passed as it is.
 */
export function zhudaGltfColors(
  raw: ArrayLike<number>,
  accessor: { type?: string; componentType?: number; count?: number } | undefined,
): Float32Array {
  const size = accessor?.type === 'VEC3' ? 3 : 4;
  const scale = { 5121: 1 / 255, 5123: 1 / 65535 }[accessor?.componentType ?? 5126] ?? 1;
  const count = Math.floor(raw.length / size);
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++)
      out[i * 4 + c] = Math.min(1, Math.max(0, raw[i * size + c] * scale)) ** (1 / 2.2);
    out[i * 4 + 3] = size === 4 ? raw[i * size + 3] * scale : 1;
  }
  return out;
}
