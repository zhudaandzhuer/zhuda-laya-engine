import type { LayaHierarchyNodeData } from "../../types/zhuda-static-assets.ts";
import { ZhudaPrefab } from "../StaticAssetPipeline.ts";
import { createProviderAssetCache, normalizeAssetId } from "../runtime3d/AssetProvider.ts";
import type { AssetProvider } from "../runtime3d/AssetProvider.ts";
import { buildPrefabTree, validatePrefabTree3D, validatePrefabPatch3D } from "./PrefabTree3D.ts";
import type { PrefabTree3D, PrefabNodePatch3D, PrefabTreeInstance3D } from "./PrefabTree3D.ts";
import { ZhudaResourceScope } from "../runtime3d/SceneLifecycle.ts";

export type PrefabNodePatch = Partial<Pick<LayaHierarchyNodeData,
  "x" | "y" | "width" | "height" | "scaleX" | "scaleY" | "rotation" |
  "alpha" | "visible" | "text" | "font" | "fontSize" | "color" |
  "bold" | "align" | "valign" | "sizeGrid">>;
export interface PrefabDefinition {
  id: string;
  kind?: "2d";
  /** Logical provider ID of a static 2D .lh JSON hierarchy. */
  asset: string;
  textures?: string[];
  states: Record<string, Record<string, PrefabNodePatch>>;
}
export interface Prefab3DDefinition {
  id: string;
  kind: "3d";
  tree: PrefabTree3D;
  states: Record<string, Record<string, PrefabNodePatch3D>>;
}
export type AnyPrefabDefinition = PrefabDefinition | Prefab3DDefinition;
type PrefabRoot<T> = T extends Prefab3DDefinition ? Laya.Sprite3D : Laya.Sprite;
export interface PrefabProvenance {
  kind: "2d" | "3d";
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
  dispose(): void;
}
const provenance = new WeakMap<Laya.Node, PrefabProvenance>();
/** Returns null for manually built substitutes. */
export function inspectPrefabInstance(root: Laya.Node): PrefabProvenance | null {
  const value = provenance.get(root);
  return value ? structuredClone(value) : null;
}
export function findPrefabNode<T extends Laya.Node>(root: T, path = ""): T {
  let node = root;
  for (const name of path ? path.split("/") : []) {
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
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}
type Resource = { hash: string; data?: LayaHierarchyNodeData; url?: string };
const supportedTypes = new Set(["Sprite", "Text", "Label", "Image", "Box"]);
const numericPatch = new Set(["x", "y", "width", "height", "scaleX", "scaleY", "rotation", "alpha", "fontSize"]);
const stringPatch = new Set(["text", "font", "color", "align", "valign", "sizeGrid"]);
function validateStates(states: PrefabDefinition["states"]) {
  for (const patches of Object.values(states)) {
    if (!patches || typeof patches !== "object" || Array.isArray(patches)) throw Error("Invalid prefab state");
    for (const patch of Object.values(patches)) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw Error("Invalid node patch");
      for (const [key, value] of Object.entries(patch)) {
        const valid = numericPatch.has(key) ? typeof value === "number" && Number.isFinite(value) :
          stringPatch.has(key) ? typeof value === "string" :
          ["visible", "bold"].includes(key) && typeof value === "boolean";
        if (!valid) throw Error(`Unsupported prefab state property: ${key}`);
      }
    }
  }
}
function validateHierarchy(node: LayaHierarchyNodeData, path = "root") {
  if (!node || !supportedTypes.has(node._$type) || node._$comp?.length)
    throw Error(`Unsupported static 2D prefab node at ${path}`);
  const names = new Set<string>();
  for (const child of node._$child || []) {
    if (!child.name || child.name.includes("/") || names.has(child.name))
      throw Error(`Prefab children need unique names at ${path}`);
    names.add(child.name);
    validateHierarchy(child, `${path}/${child.name}`);
  }
}

/** Shared by isolated previews and scenes. Owns instances and resource leases. */
export class ZhudaPrefabLibrary<T extends AnyPrefabDefinition = PrefabDefinition> {
  private readonly definitions: Map<string, AnyPrefabDefinition>;
  private readonly cache;
  private readonly active = new Set<AbortController>();
  private readonly instances = new Set<PrefabInstance<PrefabRoot<T>>>();
  private disposed = false;
  private readonly timeoutMs: number;
  constructor(options: { provider: AssetProvider; definitions: readonly T[]; timeoutMs?: number }) {
    const timeoutMs = options.timeoutMs ?? 15_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw Error("Invalid prefab timeout");
    this.timeoutMs = timeoutMs;
    this.definitions = new Map();
    const textures = new Set<string>();
    for (const source of options.definitions) {
      const entry = structuredClone(source);
      if (typeof entry.id !== "string" || !entry.id || this.definitions.has(entry.id) ||
          !entry.states || Array.isArray(entry.states) || !Object.keys(entry.states).length)
        throw Error("Prefab IDs must be unique and have explicit states");
      if (entry.kind === "3d") {
        validatePrefabTree3D(entry.tree);
        for (const patches of Object.values(entry.states)) {
          if (!patches || typeof patches !== 'object' || Array.isArray(patches)) throw Error('Invalid 3D prefab state');
          for (const patch of Object.values(patches)) validatePrefabPatch3D(patch);
        }
        this.definitions.set(entry.id, entry);
        continue;
      }
      validateStates(entry.states);
      if (normalizeAssetId(entry.asset) !== entry.asset) throw Error("Prefab asset ID must be normalized");
      for (const id of entry.textures || []) {
        if (normalizeAssetId(id) !== id || id === entry.asset) throw Error("Invalid prefab texture ID");
        textures.add(id);
      }
      this.definitions.set(entry.id, entry);
    }
    this.cache = createProviderAssetCache<Resource>(options.provider, async (asset, signal) => {
      const sourceHash = await hash(asset.bytes);
      if (!textures.has(asset.id)) {
        const data = JSON.parse(new TextDecoder().decode(asset.bytes));
        validateHierarchy(data);
        return { hash: sourceHash, data };
      }
      const url = URL.createObjectURL(new Blob([new Uint8Array(asset.bytes)]));
      const clear = () => { Laya.loader.clearRes(url); URL.revokeObjectURL(url); };
      let aborted = false;
      const load = Laya.loader.load(url, { type: Laya.Loader.IMAGE }).then(texture => {
        if (aborted) clear();
        if (!texture) throw Error(`Texture decode failed: ${asset.id}`);
      });
      let timer: ReturnType<typeof setTimeout>;
      let cancel: () => void = () => {};
      try {
        await Promise.race([load, new Promise<never>((_, reject) => {
          cancel = () => { aborted = true; reject(new DOMException("Prefab texture cancelled", "AbortError")); };
          signal.addEventListener("abort", cancel, { once: true });
          timer = setTimeout(() => { aborted = true; reject(Error(`Texture decode timeout: ${asset.id}`)); }, timeoutMs);
          if (signal.aborted) cancel();
        })]);
        return { hash: sourceHash, url };
      } catch (error) {
        clear();
        throw error;
      } finally {
        clearTimeout(timer!);
        signal.removeEventListener("abort", cancel);
      }
    }, resource => {
      if (resource.url) { Laya.loader.clearRes(resource.url); URL.revokeObjectURL(resource.url); }
    });
  }
  async instantiate(id: string, options: { state?: string; signal?: AbortSignal; parent?: Laya.Node } = {}): Promise<PrefabInstance<PrefabRoot<T>>> {
    if (this.disposed) throw Error("Disposed prefab library");
    const entry = this.definitions.get(id);
    if (!entry) throw Error(`Unknown prefab ID: ${id}`);
    const state = options.state ?? Object.keys(entry.states)[0];
    if (!Object.prototype.hasOwnProperty.call(entry.states, state)) throw Error(`Unknown prefab state: ${id}/${state}`);
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    this.active.add(controller);
    const scope = new ZhudaResourceScope();
    const timer = setTimeout(abort, this.timeoutMs);
    try {
      const resources = new Map<string, Resource>();
      // Sequential acquisition makes partial failure ownership explicit.
      for (const key of entry.kind === "3d" ? [] : [entry.asset, ...new Set(entry.textures)]) {
        const lease = await this.cache.acquire(key, { signal: controller.signal });
        scope.defer(() => lease.release());
        resources.set(key, lease.value);
      }
      if (controller.signal.aborted) throw new DOMException("Prefab cancelled", "AbortError");
      const definitionHash = await hash(new TextEncoder().encode(JSON.stringify(entry)));
      if (controller.signal.aborted) throw new DOMException("Prefab cancelled", "AbortError");
      let tree: PrefabTreeInstance3D | undefined;
      let created: Laya.Sprite | Laya.Sprite3D;
      if (entry.kind === "3d") {
        tree = buildPrefabTree(entry.tree);
        scope.defer(() => tree!.dispose());
        created = tree.root;
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
            if (command._$type !== "DrawTextureCmd") continue;
            if (!command.textureId) throw Error("DrawTextureCmd requires textureId");
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
      if (entry.kind !== "3d") for (const patches of Object.values(entry.states)) {
        for (const [path, patch] of Object.entries(patches)) {
          const target = findPrefabNode(root, path);
          const values = baseline.get(target) ?? {};
          for (const key of Object.keys(patch)) if (!Object.prototype.hasOwnProperty.call(values, key))
            values[key] = Reflect.get(target, key);
          baseline.set(target, values);
        }
      }
      let retired = false;
      const apply = (next: string) => {
        if (retired) throw Error('Disposed prefab instance');
        if (!Object.prototype.hasOwnProperty.call(entry.states, next)) throw Error(`Unknown prefab state: ${id}/${next}`);
        if (tree) tree.apply(entry.states[next] as Record<string, PrefabNodePatch3D>);
        else {
          for (const [target, values] of baseline) Object.assign(target, values);
          for (const [path, patch] of Object.entries(entry.states[next])) Object.assign(findPrefabNode(root, path), patch);
        }
      };
      apply(state);
      const record: PrefabProvenance = {
        id, state, kind: entry.kind ?? "2d", definitionHash, sources: Object.fromEntries([...resources].map(([key, value]) => [key, value.hash]))
      };
      const instance: PrefabInstance<PrefabRoot<T>> = {
        root, provenance: structuredClone(record),
        find: path => { if (retired) throw Error('Disposed prefab instance'); return findPrefabNode(root, path); },
        socket: id => { if (!tree) throw Error('Sockets require a 3D prefab'); return tree.socket(id) as PrefabRoot<T>; },
        applyState: next => { apply(next); record.state = next; instance.provenance = structuredClone(record); },
        dispose: () => {
          retired = true;
          provenance.delete(root);
          this.instances.delete(instance);
          scope.dispose();
        }
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
      options.signal?.removeEventListener("abort", abort);
      if (this.disposed && !this.active.size) this.cache.dispose();
    }
  }
  report() { return { instances: this.instances.size, ...this.cache.report() }; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const controller of this.active) controller.abort();
    for (const instance of [...this.instances]) instance.dispose();
    // Cancelled acquisitions release their leases in their finally paths.
    if (!this.active.size) this.cache.dispose();
  }
}
