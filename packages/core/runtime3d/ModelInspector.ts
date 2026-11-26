import type { ModelInstance } from './Assets.ts';
import type { ModelCompatibilityReport } from './ModelCompatibility.ts';

const runtime = () => (globalThis as unknown as { Laya: typeof Laya }).Laya;
const textureUniforms = [
  'u_BaseColorTexture',
  'u_MetallicRoughnessTexture',
  'u_NormalTexture',
  'u_OcclusionTexture',
  'u_EmissionTexture',
  'u_AlbedoTexture',
  'u_ClearCoatTexture',
  'u_ClearCoatRoughnessTexture',
  'u_ClearCoatNormalTexture',
  'u_AnisotropyTexture',
  'u_IridescenceTexture',
  'u_IridescenceThicknessTexture',
  'u_SheenColorTexture',
  'u_SheenRoughnessTexture',
  'u_TransmissionTexture',
  'u_VolumeThicknessTexture',
  'u_SpecularFactorTexture',
  'u_SpecularColorTexture',
];
export interface ModelInspection {
  compatibility: ModelCompatibilityReport;
  /** Paths identify child indices in this instance, not glTF source node indices. */
  nodes: {
    path: string;
    name: string;
    active: boolean;
    mesh: null | { id: number; vertices: number; indices: number };
    materialIds: number[];
    morphWeights: Record<string, number>;
  }[];
  materials: {
    id: number;
    name: string;
    textures: { uniform: string; id: number; width: number; height: number }[];
  }[];
  animations: {
    path: string;
    layer: number;
    name: string;
    durationSeconds: number;
    speed: number;
  }[];
  textureScope: 'known-gltf-and-unlit-uniforms';
}
/** Borrows a live instance. Does not own resources or drive an animation clock. */
export class ZhudaModelInspector {
  private readonly instance: ModelInstance;
  constructor(instance: ModelInstance) {
    this.instance = instance;
  }
  private root() {
    if (this.instance.node.destroyed) throw Error('Disposed model instance');
    return this.instance.node;
  }
  node(path: string): Laya.Sprite3D {
    if (!/^\$(\/\d+)*$/.test(path)) throw Error('Invalid model node path: ' + path);
    let node: Laya.Node = this.root();
    for (const part of path.split('/').slice(1)) {
      const index = Number(part);
      if (!Number.isSafeInteger(index) || index >= node.numChildren)
        throw Error('Unknown model node path: ' + path);
      node = node.getChildAt(index);
    }
    return node as Laya.Sprite3D;
  }
  inspect(): ModelInspection {
    const l = runtime(),
      materials = new Map<number, ModelInspection['materials'][number]>();
    const nodes: ModelInspection['nodes'] = [],
      animations: ModelInspection['animations'] = [];
    const visit = (node: Laya.Node, path: string) => {
      const renderer = node.getComponent(l.MeshRenderer),
        mesh = node.getComponent(l.MeshFilter)?.sharedMesh;
      const slots = renderer?.sharedMaterials ?? [];
      nodes.push({
        path,
        name: node.name,
        active: node.active,
        mesh: mesh ? { id: mesh.id, vertices: mesh.vertexCount, indices: mesh.indexCount } : null,
        materialIds: slots.filter(Boolean).map((m) => m.id),
        morphWeights: { ...renderer?.morphTargetValues },
      });
      for (const material of slots)
        if (material && !materials.has(material.id)) {
          const textures: ModelInspection['materials'][number]['textures'] = [];
          for (const uniform of textureUniforms) {
            const texture = material.getTexture(uniform);
            if (texture)
              textures.push({
                uniform,
                id: texture.id,
                width: texture.width,
                height: texture.height,
              });
          }
          materials.set(material.id, { id: material.id, name: material.name ?? '', textures });
        }
      const animator = node.getComponent(l.Animator);
      if (animator)
        for (let layer = 0; layer < animator.controllerLayerCount; layer++)
          for (const state of animator.getControllerLayer(layer).states)
            if (state.clip)
              animations.push({
                path,
                layer,
                name: state.name,
                durationSeconds: state.clip.duration(),
                speed: animator.speed,
              });
      for (let i = 0; i < node.numChildren; i++) visit(node.getChildAt(i), `${path}/${i}`);
    };
    visit(this.root(), '$');
    return {
      compatibility: this.instance.compatibility,
      nodes,
      materials: [...materials.values()],
      animations,
      textureScope: 'known-gltf-and-unlit-uniforms',
    };
  }
  setMorphWeight(path: string, channel: string, weight: number): void {
    if (!Number.isFinite(weight)) throw Error('Morph weight must be finite');
    const renderer = this.node(path).getComponent(runtime().MeshRenderer);
    if (!renderer || !Object.prototype.hasOwnProperty.call(renderer.morphTargetValues, channel))
      throw Error('Unknown morph channel: ' + channel);
    renderer.setMorphChannelWeight(channel, weight);
  }
  /**
   * The animator speed at which the whole of a clip takes `seconds`: for a
   * move whose length is the game's (frame data), not the clip's.
   */
  private paced(animator: any, layer: number, name: string, seconds: number): number {
    const length = animator.getControllerLayer(layer).getAnimatorState(name)?.clip?.duration();
    if (!(seconds > 0 && seconds <= 3600) || !(length > 0))
      throw Error(
        'Invalid animation duration: durationSeconds must be above zero and the clip must have a length',
      );
    return length / seconds;
  }
  /**
   * Starts native playback. Pose is evaluated by the next native animation frame, not synchronously.
   * `durationSeconds` plays the whole clip in that time (it sets the animator's speed, as `speed`
   * does; give one or the other).
   */
  play(
    path: string,
    name: string,
    options: {
      layer?: number;
      normalizedTime?: number;
      speed?: number;
      durationSeconds?: number;
    } = {},
  ): void {
    const animator = this.node(path).getComponent(runtime().Animator),
      layer = options.layer ?? 0;
    if (options.speed !== undefined && options.durationSeconds !== undefined)
      throw Error('Invalid animation playback options: give speed or durationSeconds, not both');
    const time = options.normalizedTime ?? 0;
    let speed = options.speed ?? 1;
    if (
      !animator ||
      !Number.isInteger(layer) ||
      layer < 0 ||
      layer >= animator.controllerLayerCount ||
      !animator.getControllerLayer(layer).getAnimatorState(name)
    )
      throw Error('Unknown animation state');
    if (options.durationSeconds !== undefined)
      speed = this.paced(animator, layer, name, options.durationSeconds);
    if (!Number.isFinite(time) || time < 0 || time > 1 || !Number.isFinite(speed) || speed < 0)
      throw Error('Invalid animation playback options');
    animator.speed = speed;
    animator.play(name, layer, time);
  }
  /**
   * Fades from the clip that is playing to another over `seconds` (default
   * 0.25), with LayaAir's own playback. With nothing playing it starts the
   * clip. `normalizedTime` (0..1) is where the new clip begins.
   * `durationSeconds` plays the whole of the new clip in that time (it sets
   * the animator's speed, which the fade itself then runs at too); without
   * it the speed is left as it was.
   */
  crossFade(
    path: string,
    name: string,
    options: {
      seconds?: number;
      layer?: number;
      normalizedTime?: number;
      durationSeconds?: number;
    } = {},
  ): void {
    const animator = this.node(path).getComponent(runtime().Animator),
      layer = options.layer ?? 0;
    const seconds = options.seconds ?? 0.25,
      time = options.normalizedTime ?? 0;
    if (
      !animator ||
      !Number.isInteger(layer) ||
      layer < 0 ||
      layer >= animator.controllerLayerCount ||
      !animator.getControllerLayer(layer).getAnimatorState(name)
    )
      throw Error('Unknown animation state');
    if (!(seconds >= 0 && seconds <= 60) || !Number.isFinite(time) || time < 0 || time > 1)
      throw Error('Invalid animation cross-fade options');
    if (options.durationSeconds !== undefined)
      animator.speed = this.paced(animator, layer, name, options.durationSeconds);
    // LayaAir takes the fade as a share of the clip that is playing.
    const playing = animator.getCurrentAnimatorPlayState(layer)?.animatorState?.clip;
    const length = playing ? playing.duration() : 0;
    if (!(length > 0) || seconds === 0) animator.play(name, layer, time);
    else animator.crossFade(name, seconds / length, layer, time);
  }
  setAnimationSpeed(path: string, speed: number): void {
    const animator = this.node(path).getComponent(runtime().Animator);
    if (!animator || !Number.isFinite(speed) || speed < 0) throw Error('Invalid animator or speed');
    animator.speed = speed;
  }
}
