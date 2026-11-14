import type { LayaHierarchyNodeData } from '../../types/zhuda-static-assets.ts';
import { ZhudaPrefab } from '../Prefab.ts';
import { createProviderAssetCache, normalizeAssetId } from '../runtime3d/AssetProvider.ts';
import type { AssetProvider } from '../runtime3d/AssetProvider.ts';
import {
  buildPrefabTree,
  buildSharedPrefabTree,
  createPrefabTreeResources,
  validatePrefabTree3D,
  validatePrefabPatch3D,
} from './PrefabTree3D.ts';
import type { PrefabTree3D, PrefabNodePatch3D, PrefabTreeInstance3D } from './PrefabTree3D.ts';
import { ZhudaResourceScope } from '../runtime3d/SceneLifecycle.ts';
import { ZhudaAssetCache, ZhudaModelLibrary } from '../runtime3d/Assets.ts';
import {
  mountZhudaModel,
  validateZhudaModelPlacements,
  type ZhudaModelPlacement,
} from '../runtime3d/ModelPlacements.ts';
import {
  validateZhudaLodDistances,
  type ZhudaLodCounts,
  type ZhudaModelLod,
} from '../runtime3d/ModelLod.ts';

export type PrefabNodePatch = Partial<
  Pick<
    LayaHierarchyNodeData,
    | 'x'
    | 'y'
    | 'width'
    | 'height'
    | 'anchorX'
    | 'anchorY'
    | 'pivotX'
    | 'pivotY'
    | 'scaleX'
    | 'scaleY'
    | 'rotation'
    | 'alpha'
    | 'visible'
    | 'text'
    | 'font'
    | 'fontSize'
    | 'color'
    | 'bold'
    | 'align'
    | 'valign'
    | 'sizeGrid'
  >
>;
export interface PrefabDefinition {
  id: string;
  kind?: '2d';
  /** Logical provider ID of a static 2D .lh JSON hierarchy. */
  asset: string;
  textures?: string[];
  states: Record<string, Record<string, PrefabNodePatch>>;
}
export interface Prefab3DDefinition {
  id: string;
  kind: '3d';
  tree: PrefabTree3D;
  states: Record<string, Record<string, PrefabNodePatch3D>>;
}
/** One model of a model prefab: a self-contained `.glb` by logical provider ID. */
export interface PrefabModelNode {
  /** Unique within the prefab; the path `find` and state patches use. */
  name: string;
  /** Logical provider ID of an embedded GLB. */
  asset: string;
  position?: [number, number, number];
  yawDeg?: number;
  /** Uniform scale, 0.001..1000 (default 1). */
  scale?: number;
  /** Copies of the model: `[x, y, z, yawDeg, scale]` each, relative to this node. */
  placements?: ZhudaModelPlacement[];
  /** Cut-out (alpha-tested) materials let light through. */
  translucent?: boolean;
  /** Scales what the model's materials give off, 0..8 (default 1). */
  emission?: number;
  /**
   * False: the model casts no shadow (it still takes them). For ground and
   * paving, which shade nothing, and for what is too small to matter.
   */
  castShadow?: boolean;
  /**
   * Lighter versions for distance, nearest first (at most 4): beyond
   * `fromMeters` from the eye a copy draws this model instead of the one
   * before. Nothing changes until the Scene calls the instance's `updateLod`.
   */
  lod?: { asset: string; fromMeters: number }[];
  /** Beyond this distance from the eye a copy draws nothing. */
  cullMeters?: number;
}
export interface PrefabModelPatch {
  active?: boolean;
}
/**
 * Scenery built from model files: many models, each once or as many copies.
 * Lighting, sky, fog, water and cameras belong to the Scene that instantiates it.
 */
export interface PrefabModelsDefinition {
  id: string;
  kind: 'models';
  nodes: PrefabModelNode[];
  states: Record<string, Record<string, PrefabModelPatch>>;
}
export type AnyPrefabDefinition = PrefabDefinition | Prefab3DDefinition | PrefabModelsDefinition;
type PrefabRoot<T> = T extends Prefab3DDefinition | PrefabModelsDefinition
  ? Laya.Sprite3D
  : Laya.Sprite;
/** Most copies one model prefab may hold in all. */
export const ZHUDA_PREFAB_MODEL_COPIES = 60000;

/** Throws on the first problem of a model prefab definition. */
export function validatePrefabModels(entry: PrefabModelsDefinition): void {
  if (!Array.isArray(entry.nodes) || !entry.nodes.length || entry.nodes.length > 256)
    throw Error('Model prefab needs 1..256 nodes');
  const names = new Set<string>();
  let copies = 0;
  for (const node of entry.nodes) {
    if (!node || typeof node.name !== 'string' || !node.name || node.name.includes('/'))
      throw Error('Model prefab nodes need a name without "/"');
    if (names.has(node.name)) throw Error(`Duplicate model prefab node: ${node.name}`);
    names.add(node.name);
    const at = `Model prefab node ${node.name}`;
    let normalized: string | undefined;
    try {
      normalized = typeof node.asset === 'string' ? normalizeAssetId(node.asset) : undefined;
    } catch {
      // Reported below with the node's name.
    }
    if (normalized !== node.asset) throw Error(`${at}: asset ID must be normalized`);
    if (!/\.glb$/i.test(node.asset)) throw Error(`${at}: asset must be a .glb`);
    if (
      node.position !== undefined &&
      !(
        Array.isArray(node.position) &&
        node.position.length === 3 &&
        node.position.every(Number.isFinite)
      )
    )
      throw Error(`${at}: position needs three finite numbers`);
    if (node.yawDeg !== undefined && !Number.isFinite(node.yawDeg))
      throw Error(`${at}: yawDeg must be finite`);
    if (node.scale !== undefined && !(node.scale >= 0.001 && node.scale <= 1000))
      throw Error(`${at}: scale must be 0.001..1000`);
    if (node.emission !== undefined && !(node.emission >= 0 && node.emission <= 8))
      throw Error(`${at}: emission must be 0..8`);
    if (node.translucent !== undefined && typeof node.translucent !== 'boolean')
      throw Error(`${at}: translucent must be boolean`);
    if (node.castShadow !== undefined && typeof node.castShadow !== 'boolean')
      throw Error(`${at}: castShadow must be boolean`);
    if (node.lod !== undefined || node.cullMeters !== undefined) {
      const levels = node.lod ?? [];
      if (!Array.isArray(levels) || levels.length > 4)
        throw Error(`${at}: lod holds at most 4 levels`);
      for (const level of levels) {
        let id: string | undefined;
        try {
          id = typeof level?.asset === 'string' ? normalizeAssetId(level.asset) : undefined;
        } catch {
          // Reported below with the node's name.
        }
        if (id !== level?.asset || !/\.glb$/i.test(level.asset))
          throw Error(`${at}: lod asset must be a normalized .glb ID`);
      }
      const issues = validateZhudaLodDistances(
        levels.map((level) => level.fromMeters),
        node.cullMeters,
      );
      if (issues.length) throw Error(`${at}: ${issues[0]}`);
    }
    if (node.placements !== undefined) {
      const issues = validateZhudaModelPlacements(node.placements);
      if (issues.length) throw Error(`${at}: placements ${issues[0]}`);
      copies += node.placements.length;
    } else copies++;
  }
  if (copies > ZHUDA_PREFAB_MODEL_COPIES)
    throw Error(`Model prefab holds ${copies} copies; at most ${ZHUDA_PREFAB_MODEL_COPIES}`);
  for (const patches of Object.values(entry.states)) {
    if (!patches || typeof patches !== 'object' || Array.isArray(patches))
      throw Error('Invalid model prefab state');
    for (const [name, patch] of Object.entries(patches)) {
      if (!names.has(name)) throw Error(`Model prefab state names an unknown node: ${name}`);
      if (
        !patch ||
        typeof patch !== 'object' ||
        Object.keys(patch).some((key) => key !== 'active') ||
        (patch.active !== undefined && typeof patch.active !== 'boolean')
      )
        throw Error(`Model prefab state of ${name}: only active (boolean) is supported`);
    }
  }
}
export interface PrefabProvenance {
  kind: '2d' | '3d';
  /** Hash of the complete serialized definition, including states and recipe. */
  definitionHash: string;
  id: string;
  state: string;
  /** SHA-256 of the original bytes, including every declared texture. */
  sources: Record<string, string>;
}
export interface PrefabInstance<T extends Laya.Node = Laya.Sprite> {
  root: T;
  provenance: PrefabProvenance;
  find(path?: string): T;
  applyState(state: string): void;
  socket(id: string): T;
  /** 3D only: copy this instance's material slot before changing material properties. */
  makeMaterialUnique(path?: string): Laya.Material;
  /**
   * Model prefabs with `lod` or `cullMeters`: chooses what every copy draws
   * for an eye at `[x, y, z]` in world metres. Until it is called every copy
   * draws its full model. Without levels it changes nothing.
   */
  updateLod(eye: readonly [number, number, number]): ZhudaLodCounts;
  /**
   * Model prefabs: scales what a node's model gives off, 0..8, while it runs
   * (windows and lanterns that light at dusk). `name` is the node's name; 1
   * is as authored, whatever `emission` the definition started with.
   */
  setEmission(name: string, scale: number): void;
  dispose(): void;
}
const provenance = new WeakMap<Laya.Node, PrefabProvenance>();
/** Returns null for manually built substitutes. */
export function inspectPrefabInstance(root: Laya.Node): PrefabProvenance | null {
  const value = provenance.get(root);
  return value ? structuredClone(value) : null;
}
export function findPrefabNode<T extends Laya.Node>(root: T, path = ''): T {
  let node = root;
  for (const name of path ? path.split('/') : []) {
    const matches: T[] = [];
    for (let i = 0; i < node.numChildren; i++) {
      const child = node.getChildAt(i) as T;
      if (child.name === name) matches.push(child);
    }
    if (matches.length !== 1) throw Error(`Prefab node path missing or ambiguous: ${path}`);
    node = matches[0];
  }
  return node;
}
async function hash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
}
type Resource = { hash: string; data?: LayaHierarchyNodeData; url?: string };
const supportedTypes = new Set(['Sprite', 'Text', 'Label', 'Image', 'Box']);
const numericPatch = new Set([
  'x',
  'y',
  'width',
  'height',
  'anchorX',
  'anchorY',
  'pivotX',
  'pivotY',
  'scaleX',
  'scaleY',
  'rotation',
  'alpha',
  'fontSize',
]);
const stringPatch = new Set(['text', 'font', 'color', 'align', 'valign', 'sizeGrid']);
function validateStates(states: PrefabDefinition['states']) {
  for (const patches of Object.values(states)) {
    if (!patches || typeof patches !== 'object' || Array.isArray(patches))
      throw Error('Invalid prefab state');
    for (const patch of Object.values(patches)) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch))
        throw Error('Invalid node patch');
      for (const [key, value] of Object.entries(patch)) {
        const valid = numericPatch.has(key)
          ? typeof value === 'number' && Number.isFinite(value)
          : stringPatch.has(key)
            ? typeof value === 'string'
            : ['visible', 'bold'].includes(key) && typeof value === 'boolean';
        if (!valid) throw Error(`Unsupported prefab state property: ${key}`);
      }
    }
  }
}
function validateHierarchy(node: LayaHierarchyNodeData, path = 'root') {
  if (!node || !supportedTypes.has(node._$type) || node._$comp?.length)
    throw Error(`Unsupported static 2D prefab node at ${path}`);
  const names = new Set<string>();
  for (const child of node._$child || []) {
    if (!child.name || child.name.includes('/') || names.has(child.name))
      throw Error(`Prefab children need unique names at ${path}`);
    names.add(child.name);
    validateHierarchy(child, `${path}/${child.name}`);
  }
}

/** Shared by isolated previews and scenes. Owns instances and resource leases. */
export class ZhudaPrefabLibrary<T extends AnyPrefabDefinition = PrefabDefinition> {
  private readonly definitions: Map<string, AnyPrefabDefinition>;
  private readonly cache;
  private readonly shared3DCache;
  private readonly share3DResources: boolean;
  private readonly active = new Set<AbortController>();
  private readonly instances = new Set<PrefabInstance<PrefabRoot<T>>>();
  private disposed = false;
  private readonly timeoutMs: number;
  private readonly provider: AssetProvider;
  private models: ZhudaModelLibrary | undefined;
  constructor(options: {
    provider: AssetProvider;
    definitions: readonly T[];
    timeoutMs?: number;
    share3DResources?: boolean;
  }) {
    const timeoutMs = options.timeoutMs ?? 15_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw Error('Invalid prefab timeout');
    this.timeoutMs = timeoutMs;
    this.provider = options.provider;
    if (options.share3DResources !== undefined && typeof options.share3DResources !== 'boolean')
      throw Error('share3DResources must be boolean');
    this.share3DResources = options.share3DResources ?? false;
    this.definitions = new Map();
    const textures = new Set<string>();
    for (const source of options.definitions) {
      const entry = structuredClone(source);
      if (
        typeof entry.id !== 'string' ||
        !entry.id ||
        this.definitions.has(entry.id) ||
        !entry.states ||
        Array.isArray(entry.states) ||
        !Object.keys(entry.states).length
      )
        throw Error('Prefab IDs must be unique and have explicit states');
      if (entry.kind === '3d') {
        validatePrefabTree3D(entry.tree);
        for (const patches of Object.values(entry.states)) {
          if (!patches || typeof patches !== 'object' || Array.isArray(patches))
            throw Error('Invalid 3D prefab state');
          for (const patch of Object.values(patches)) validatePrefabPatch3D(patch);
        }
        this.definitions.set(entry.id, entry);
        continue;
      }
      if (entry.kind === 'models') {
        validatePrefabModels(entry);
        this.definitions.set(entry.id, entry);
        continue;
      }
      validateStates(entry.states);
      if (normalizeAssetId(entry.asset) !== entry.asset)
        throw Error('Prefab asset ID must be normalized');
      for (const id of entry.textures || []) {
        if (normalizeAssetId(id) !== id || id === entry.asset)
          throw Error('Invalid prefab texture ID');
        textures.add(id);
      }
      this.definitions.set(entry.id, entry);
    }
    this.shared3DCache = new ZhudaAssetCache(
      async (key, signal) => {
        if (signal.aborted) throw new DOMException('Prefab cancelled', 'AbortError');
        return createPrefabTreeResources(JSON.parse(key) as PrefabTree3D);
      },
      (value) => value.dispose(),
    );
    this.cache = createProviderAssetCache<Resource>(
      options.provider,
      async (asset, signal) => {
        const sourceHash = await hash(asset.bytes);
        if (!textures.has(asset.id)) {
          const data = JSON.parse(new TextDecoder().decode(asset.bytes));
          validateHierarchy(data);
          return { hash: sourceHash, data };
        }
        const url = URL.createObjectURL(new Blob([new Uint8Array(asset.bytes)]));
        const clear = () => {
          Laya.loader.clearRes(url);
          URL.revokeObjectURL(url);
        };
        let aborted = false;
        const load = Laya.loader.load(url, { type: Laya.Loader.IMAGE }).then((texture) => {
          if (aborted) clear();
          if (!texture) throw Error(`Texture decode failed: ${asset.id}`);
        });
        let timer: ReturnType<typeof setTimeout>;
        let cancel: () => void = () => {};
        try {
          await Promise.race([
            load,
            new Promise<never>((_, reject) => {
              cancel = () => {
                aborted = true;
                reject(new DOMException('Prefab texture cancelled', 'AbortError'));
              };
              signal.addEventListener('abort', cancel, { once: true });
              timer = setTimeout(() => {
                aborted = true;
                reject(Error(`Texture decode timeout: ${asset.id}`));
              }, timeoutMs);
              if (signal.aborted) cancel();
            }),
          ]);
          return { hash: sourceHash, url };
        } catch (error) {
          clear();
          throw error;
        } finally {
          clearTimeout(timer!);
          signal.removeEventListener('abort', cancel);
        }
      },
      (resource) => {
        if (resource.url) {
          Laya.loader.clearRes(resource.url);
          URL.revokeObjectURL(resource.url);
        }
      },
    );
  }
  async instantiate(
    id: string,
    options: { state?: string; signal?: AbortSignal; parent?: Laya.Node } = {},
  ): Promise<PrefabInstance<PrefabRoot<T>>> {
    if (this.disposed) throw Error('Disposed prefab library');
    const entry = this.definitions.get(id);
    if (!entry) throw Error(`Unknown prefab ID: ${id}`);
    const state = options.state ?? Object.keys(entry.states)[0];
    if (!Object.prototype.hasOwnProperty.call(entry.states, state))
      throw Error(`Unknown prefab state: ${id}/${state}`);
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    this.active.add(controller);
    const scope = new ZhudaResourceScope();
    const timer = setTimeout(abort, this.timeoutMs);
    try {
      const resources = new Map<string, Resource>();
      // Sequential acquisition makes partial failure ownership explicit.
      for (const key of entry.kind === '3d' || entry.kind === 'models'
        ? []
        : [entry.asset, ...new Set(entry.textures)]) {
        const lease = await this.cache.acquire(key, { signal: controller.signal });
        scope.defer(() => lease.release());
        resources.set(key, lease.value);
      }
      if (controller.signal.aborted) throw new DOMException('Prefab cancelled', 'AbortError');
      const definitionHash = await hash(new TextEncoder().encode(JSON.stringify(entry)));
      if (controller.signal.aborted) throw new DOMException('Prefab cancelled', 'AbortError');
      let tree: PrefabTreeInstance3D | undefined;
      let levels: ZhudaModelLod[] = [];
      const glow = new Map<string, (scale: number) => void>();
      let created: Laya.Sprite | Laya.Sprite3D;
      if (entry.kind === '3d') {
        if (this.share3DResources) {
          const lease = await this.shared3DCache.acquire(JSON.stringify(entry.tree), {
            signal: controller.signal,
          });
          scope.defer(() => lease.release());
          if (controller.signal.aborted) throw new DOMException('Prefab cancelled', 'AbortError');
          tree = buildSharedPrefabTree(entry.tree, lease.value);
        } else tree = buildPrefabTree(entry.tree);
        scope.defer(() => tree!.dispose());
        created = tree.root;
      } else if (entry.kind === 'models') {
        // One model library per prefab library: every instance and every
        // prefab that names the same asset shares its meshes and materials.
        this.models ??= new ZhudaModelLibrary({
          provider: this.provider,
          maxIdle: 16,
          timeoutMs: this.timeoutMs,
        });
        const root3D = new Laya.Sprite3D(`ZhudaPrefab:${entry.id}`);
        levels = [];
        scope.defer(() => root3D.destroy(false));
        for (const node of entry.nodes) {
          const loaded = await this.models.instantiate(node.asset, { signal: controller.signal });
          scope.defer(() => loaded.dispose());
          if (controller.signal.aborted) throw new DOMException('Prefab cancelled', 'AbortError');
          const holder = new Laya.Sprite3D(node.name);
          root3D.addChild(holder);
          scope.defer(() => holder.destroy(false));
          const [x, y, z] = node.position ?? [0, 0, 0];
          holder.transform.localPosition = new Laya.Vector3(x, y, z);
          holder.transform.localRotationEuler = new Laya.Vector3(0, node.yawDeg ?? 0, 0);
          const size = node.scale ?? 1;
          holder.transform.localScale = new Laya.Vector3(size, size, size);
          const lod: { instance: typeof loaded; fromMeters: number }[] = [];
          for (const level of node.lod ?? []) {
            const lighter = await this.models.instantiate(level.asset, {
              signal: controller.signal,
            });
            scope.defer(() => lighter.dispose());
            if (controller.signal.aborted) throw new DOMException('Prefab cancelled', 'AbortError');
            lod.push({ instance: lighter, fromMeters: level.fromMeters });
          }
          const mounted = mountZhudaModel(holder, loaded, {
            placements: node.placements,
            translucent: node.translucent,
            emission: node.emission,
            castShadow: node.castShadow,
            label: `${entry.id}/${node.name}`,
            lod,
            cullMeters: node.cullMeters,
          });
          scope.defer(() => mounted.dispose());
          if (mounted.lod) levels.push(mounted.lod);
          glow.set(node.name, mounted.setEmission);
        }
        created = root3D;
      } else {
        const data = structuredClone(resources.get(entry.asset)!.data!);
        const bindTextures = (node: LayaHierarchyNodeData) => {
          if (node.skin) {
            const texture = resources.get(node.skin);
            if (!texture?.url) throw Error(`Undeclared prefab texture: ${node.skin}`);
            node.skin = texture.url;
          }
          // Graphics draw commands use the same logical asset boundary as
          // Image.skin. Resolve their provider IDs before the low-level
          // hydrator sees them so isolated previews and Scenes can share
          // procedural slices (for example a capsule with three DrawTextureCmd
          // segments) without embedding blob URLs in the Prefab source.
          for (const command of node._gcmds || []) {
            if (command._$type !== 'DrawTextureCmd') continue;
            if (!command.textureId) throw Error('DrawTextureCmd requires textureId');
            const texture = resources.get(command.textureId);
            if (!texture?.url) throw Error(`Undeclared prefab texture: ${command.textureId}`);
            command.textureId = texture.url;
          }
          node._$child?.forEach(bindTextures);
        };
        bindTextures(data);
        created = ZhudaPrefab.instantiate(data);
        scope.defer(() => created.destroy(true));
      }
      const root = created as PrefabRoot<T>;
      // Snapshot every state-touched 2D property so switching states restores
      // baseline values instead of retaining unrelated properties from the old state.
      const baseline = new Map<Laya.Node, Record<string, unknown>>();
      if (entry.kind !== '3d' && entry.kind !== 'models')
        for (const patches of Object.values(entry.states)) {
          for (const [path, patch] of Object.entries(patches)) {
            const target = findPrefabNode(root, path);
            const values = baseline.get(target) ?? {};
            for (const key of Object.keys(patch))
              if (!Object.prototype.hasOwnProperty.call(values, key))
                values[key] = Reflect.get(target, key);
            baseline.set(target, values);
          }
        }
      let retired = false;
      const apply = (next: string) => {
        if (retired) throw Error('Disposed prefab instance');
        if (!Object.prototype.hasOwnProperty.call(entry.states, next))
          throw Error(`Unknown prefab state: ${id}/${next}`);
        if (tree) tree.apply(entry.states[next] as Record<string, PrefabNodePatch3D>);
        else if (entry.kind === 'models') {
          // A complete state: nodes it does not name are shown.
          const patches = entry.states[next] as Record<string, PrefabModelPatch>;
          for (const node of entry.nodes)
            (findPrefabNode(root, node.name) as Laya.Sprite3D).active =
              patches[node.name]?.active ?? true;
        } else {
          for (const [target, values] of baseline) Object.assign(target, values);
          for (const [path, patch] of Object.entries(entry.states[next]))
            Object.assign(findPrefabNode(root, path), patch);
        }
      };
      apply(state);
      const record: PrefabProvenance = {
        id,
        state,
        kind: entry.kind === 'models' ? '3d' : (entry.kind ?? '2d'),
        definitionHash,
        sources: Object.fromEntries([...resources].map(([key, value]) => [key, value.hash])),
      };
      const instance: PrefabInstance<PrefabRoot<T>> = {
        root,
        provenance: structuredClone(record),
        find: (path) => {
          if (retired) throw Error('Disposed prefab instance');
          return findPrefabNode(root, path);
        },
        socket: (id) => {
          if (!tree) throw Error('Sockets require a 3D prefab');
          return tree.socket(id) as PrefabRoot<T>;
        },
        makeMaterialUnique: (path) => {
          if (!tree) throw Error('Material slots require a 3D prefab');
          return tree.makeMaterialUnique(path);
        },
        applyState: (next) => {
          apply(next);
          record.state = next;
          instance.provenance = structuredClone(record);
        },
        setEmission: (name, scale) => {
          if (retired) throw Error('Disposed prefab instance');
          const set = glow.get(name);
          if (!set) throw Error(`Prefab ${id} has no model node ${name}`);
          set(scale);
        },
        updateLod: (eye) => {
          if (retired) throw Error('Disposed prefab instance');
          const total: ZhudaLodCounts = { levels: [], culled: 0, switched: 0 };
          for (const group of levels) {
            const counts = group.update(eye);
            counts.levels.forEach((n, k) => (total.levels[k] = (total.levels[k] ?? 0) + n));
            total.culled += counts.culled;
            total.switched += counts.switched;
          }
          return total;
        },
        dispose: () => {
          retired = true;
          provenance.delete(root);
          this.instances.delete(instance);
          scope.dispose();
        },
      };
      provenance.set(root, record);
      options.parent?.addChild(root);
      this.instances.add(instance);
      return instance;
    } catch (error) {
      scope.dispose();
      throw error;
    } finally {
      clearTimeout(timer);
      this.active.delete(controller);
      options.signal?.removeEventListener('abort', abort);
      if (this.disposed && !this.active.size) {
        this.cache.dispose();
        this.shared3DCache.dispose();
      }
    }
  }
  report() {
    return {
      instances: this.instances.size,
      ...this.cache.report(),
      shared3D: this.shared3DCache.report(),
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const controller of this.active) controller.abort();
    for (const instance of [...this.instances]) instance.dispose();
    // Cancelled acquisitions release their leases in their finally paths.
    if (!this.active.size) {
      this.cache.dispose();
      this.shared3DCache.dispose();
    }
    // Instances are gone; the model library releases what it kept warm.
    this.models?.dispose();
    this.models = undefined;
  }
}
