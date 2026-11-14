import { destroyLaya342ModelTree } from './Laya342Adapters.ts';
import {
  resolveZhudaGltfTextureSource,
  type ZhudaImageDecodeSupport,
  type ZhudaLayaLightSettings,
} from './GltfIntake.ts';
const prepared = new WeakSet<object>();
// The Laya node made for each glTF node by the resource's last create().
const createdNodes = new WeakMap<object, readonly any[]>();
// The glTF textures whose picture did not load, per resource.
const missingTextures = new WeakMap<object, Set<number>>();
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
      return result;
    };
  const createMaterial = resource.createMaterial;
  if (typeof createMaterial === 'function')
    resource.createMaterial = function (definition: any) {
      const material = createMaterial.call(this, definition);
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
          clip._nodesDic[node.fullPath] = node.fullPath;
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

/** A colour accessor's values as RGBA floats in 0..1 (see glTF 2.0, COLOR_0). */
export function zhudaGltfColors(
  raw: ArrayLike<number>,
  accessor: { type?: string; componentType?: number; count?: number } | undefined,
): Float32Array {
  const size = accessor?.type === 'VEC3' ? 3 : 4;
  const scale = { 5121: 1 / 255, 5123: 1 / 65535 }[accessor?.componentType ?? 5126] ?? 1;
  const count = Math.floor(raw.length / size);
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 3; c++) out[i * 4 + c] = raw[i * size + c] * scale;
    out[i * 4 + 3] = size === 4 ? raw[i * size + 3] * scale : 1;
  }
  return out;
}
