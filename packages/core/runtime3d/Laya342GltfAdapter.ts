import { destroyLaya342ModelTree } from './Laya342Adapters.ts';
const prepared = new WeakSet<object>();
/** Version-pinned importer repairs. Applied to one owned glTFResource, never to
 * global prototypes. The native Animator remains the sole pose evaluator. */
export function prepareLaya342GltfResource(resource: any, runtime: any): void {
  if (prepared.has(resource)) return;
  prepared.add(resource);
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
