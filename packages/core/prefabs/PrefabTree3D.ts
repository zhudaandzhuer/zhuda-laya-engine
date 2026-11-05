import { Zhuda3D } from '../DeclarativeSDK.ts';
import type { DeclarativeMaterialOptions, DeclarativeCameraOptions, DeclarativeLightOptions, PrimitiveType3D } from '../../types/zhuda-3d-physics.ts';
import { ZhudaResourceScope } from '../runtime3d/SceneLifecycle.ts';

export type PrefabVector3 = [number, number, number];
export interface PrefabNodePatch3D {
  active?: boolean;
  localPosition?: PrefabVector3;
  localRotationEuler?: PrefabVector3;
  localScale?: PrefabVector3;
  /** Key in this tree's materials; only valid on mesh nodes. */
  material?: string;
}
export interface PrefabTreeNode3D extends PrefabNodePatch3D {
  name: string;
  mesh?: { type: PrimitiveType3D; dimensions?: { width?: number; height?: number; depth?: number; radius?: number } };
  children?: PrefabTreeNode3D[];
}
export interface PrefabTree3D {
  root: PrefabTreeNode3D;
  materials: Record<string, DeclarativeMaterialOptions>;
  /** Stable socket ID -> slash-separated node path, relative to the root. */
  sockets?: Record<string, string>;
}
export interface PrefabPreview3D {
  camera?: DeclarativeCameraOptions;
  ambientColor?: [number, number, number, number];
  light?: DeclarativeLightOptions;
}
export interface PrefabTreeInstance3D {
  root: Laya.Sprite3D;
  find(path?: string): Laya.Sprite3D;
  socket(id: string): Laya.Sprite3D;
  /** Resets the authored baseline before applying a complete named state. */
  apply(patches: Record<string, PrefabNodePatch3D>): void;
  /** Returns an instance-owned copy of this node's material slot before mutation. */
  makeMaterialUnique(path?: string): Laya.Material;
  dispose(): void;
}
const primitives = new Set(['box', 'sphere', 'plane', 'cone', 'cylinder', 'capsule']);
const has = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
export function validatePrefabPatch3D(patch: PrefabNodePatch3D): void {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('Invalid 3D node patch');
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'active' && typeof value === 'boolean') continue;
    if (key === 'material' && typeof value === 'string' && value.length) continue;
    if (['localPosition', 'localRotationEuler', 'localScale'].includes(key) &&
        Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n)) &&
        (key !== 'localScale' || value.every(n => n !== 0))) continue;
    throw Error(`Invalid 3D prefab patch property: ${key}`);
  }
}
export function validatePrefabTree3D(tree: PrefabTree3D): void {
  if (!tree || !tree.materials || Array.isArray(tree.materials)) throw Error('3D prefab requires materials');
  for (const [id, material] of Object.entries(tree.materials)) {
    if (!id || !material || !Array.isArray(material.albedoColor) || material.albedoColor.length !== 4 ||
        !material.albedoColor.every(n => Number.isFinite(n) && n >= 0 && n <= 1) ||
        (material.type !== undefined && !['blinn-phong', 'unlit', 'pbr'].includes(material.type)))
      throw Error(`Invalid 3D prefab material: ${id}`);
    for (const key of ['shininess', 'metallic', 'smoothness'] as const) {
      const value = material[key];
      if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > (key === 'shininess' ? 128 : 1)))
        throw Error(`Invalid 3D material ${id}.${key}`);
    }
  }
  let count = 0;
  const paths = new Set<string>();
  const visit = (node: PrefabTreeNode3D, path: string, depth: number) => {
    if (++count > 4096 || depth > 64) throw Error('3D prefab tree exceeds node/depth limit');
    if (!node || typeof node.name !== 'string' || !node.name || node.name.includes('/')) throw Error(`Invalid 3D node name at ${path}`);
    const { name, mesh, children, ...patch } = node;
    validatePrefabPatch3D(patch);
    if (mesh && (!primitives.has(mesh.type) || !node.material)) throw Error(`Invalid mesh/material at ${path}`);
    if (node.material && (!mesh || !has(tree.materials, node.material))) throw Error(`Unknown material or non-mesh node at ${path}`);
    for (const [key, value] of Object.entries(mesh?.dimensions ?? {}))
      if (!['width', 'height', 'depth', 'radius'].includes(key) || !Number.isFinite(value) || value <= 0)
        throw Error(`Invalid primitive dimension at ${path}.${key}`);
    paths.add(path);
    if (children !== undefined && !Array.isArray(children)) throw Error(`Invalid children at ${path}`);
    const names = new Set<string>();
    for (const child of children ?? []) {
      if (!child || names.has(child.name)) throw Error(`Duplicate child name at ${path}`);
      names.add(child.name); visit(child, path ? `${path}/${child.name}` : child.name, depth + 1);
    }
  };
  visit(tree.root, '', 0);
  for (const [id, path] of Object.entries(tree.sockets ?? {}))
    if (!id || !paths.has(path)) throw Error(`Unknown 3D socket path: ${id}/${path}`);
}

/** Internal resource pack; lifetime is owned by the library's existing cache leases. */
export function createPrefabTreeResources(tree: PrefabTree3D) {
  validatePrefabTree3D(tree);
  const scope = new ZhudaResourceScope();
  const materials = new Map<string, Laya.Material>();
  const meshes = new Map<string, Laya.Mesh>();
  try {
    for (const [id, options] of Object.entries(tree.materials)) {
      const material = scope.own(Zhuda3D.createMaterial(options), value=>value.destroy());
      materials.set(id, material);
    }
    // Preserve node-level mesh identity within a recipe. Merging identical
    // sibling shapes can change native batch ordering at coplanar intersections.
    // The same path is still shared across every instance of this recipe.
    const visit = (node: PrefabTreeNode3D, nodePath: string) => {
      if (node.mesh)
        meshes.set(nodePath, scope.own(Zhuda3D.createPrimitiveMesh(node.mesh.type,node.mesh.dimensions),value=>value.destroy()));
      node.children?.forEach(child=>visit(child,nodePath?`${nodePath}/${child.name}`:child.name));
    };
    visit(tree.root,'');
    return {materials,meshes,dispose:()=>scope.dispose()};
  } catch (error) { scope.dispose(); throw error; }
}
type SharedTreeResources = ReturnType<typeof createPrefabTreeResources>;

/** Independent ownership is the compatible default for the synchronous builder. */
export function buildPrefabTree(tree: PrefabTree3D): PrefabTreeInstance3D {
  return renderPrefabTree(tree);
}
/** Internal library entry; borrowed resources are released by its cache lease. */
export function buildSharedPrefabTree(tree: PrefabTree3D, resources: SharedTreeResources): PrefabTreeInstance3D {
  return renderPrefabTree(tree, resources);
}
function renderPrefabTree(tree: PrefabTree3D, shared?: SharedTreeResources): PrefabTreeInstance3D {
  const spec = structuredClone(tree);
  validatePrefabTree3D(spec);
  const resources = new ZhudaResourceScope();
  const nodes = new Map<string, Laya.Sprite3D>();
  const baseline = new Map<string, PrefabNodePatch3D>();
  const materials = new Map<string, Laya.Material>();
  const ownedMaterials = new Set<Laya.Material>();
  let root: Laya.Sprite3D | undefined;
  let disposed = false;
  const find = (path = '') => {
    if (disposed) throw Error('Disposed 3D prefab');
    const node = nodes.get(path);
    if (!node) throw Error(`Prefab node path missing: ${path}`);
    return node;
  };
  const applyNode = (node: Laya.Sprite3D, patch: PrefabNodePatch3D) => {
    if (patch.active !== undefined) node.active = patch.active;
    if (patch.localPosition) node.transform.localPosition = new Laya.Vector3(...patch.localPosition);
    if (patch.localRotationEuler) node.transform.localRotationEuler = new Laya.Vector3(...patch.localRotationEuler);
    if (patch.localScale) node.transform.localScale = new Laya.Vector3(...patch.localScale);
    if (patch.material) (node as Laya.MeshSprite3D).meshRenderer.sharedMaterial = materials.get(patch.material)!;
  };
  try {
    for (const [id, material] of Object.entries(spec.materials)) {
      const value = shared ? shared.materials.get(id)! : resources.own(Zhuda3D.createMaterial(material), value => value.destroy());
      materials.set(id, value);
      if (!shared) ownedMaterials.add(value);
    }
    const visit = (source: PrefabTreeNode3D, path: string, parent?: Laya.Sprite3D): Laya.Sprite3D => {
      const node = source.mesh
        ? new Laya.MeshSprite3D(shared ? shared.meshes.get(path)! : resources.own(Zhuda3D.createPrimitiveMesh(source.mesh.type, source.mesh.dimensions), value => value.destroy()))
        : new Laya.Sprite3D();
      if (!root) root = node;
      node.name = source.name;
      parent?.addChild(node);
      nodes.set(path, node);
      const patch: PrefabNodePatch3D = {
        active: source.active ?? true, localPosition: source.localPosition ?? [0, 0, 0],
        localRotationEuler: source.localRotationEuler ?? [0, 0, 0], localScale: source.localScale ?? [1, 1, 1],
        ...(source.material ? { material: source.material } : {}),
      };
      baseline.set(path, patch); applyNode(node, patch);
      for (const child of source.children ?? []) visit(child, path ? `${path}/${child.name}` : child.name, node);
      return node;
    };
    visit(spec.root, '');
    return {
      root: root!, find,
      makeMaterialUnique: (path = '') => {
        const node = find(path) as Laya.MeshSprite3D;
        if (!baseline.get(path)?.material) throw Error(`Node has no material slot: ${path}`);
        const current = node.meshRenderer.sharedMaterial;
        if (ownedMaterials.has(current)) return current;
        const clone = resources.own(current.clone(), value=>value.destroy());
        ownedMaterials.add(clone);
        for (const [id, value] of materials) if (value === current) materials.set(id, clone);
        for (const [key, other] of nodes) if (baseline.get(key)?.material && (other as Laya.MeshSprite3D).meshRenderer.sharedMaterial === current)
          (other as Laya.MeshSprite3D).meshRenderer.sharedMaterial = clone;
        return clone;
      },
      socket: id => {
        if (!has(spec.sockets ?? {}, id)) throw Error(`Unknown 3D socket: ${id}`);
        return find(spec.sockets![id]);
      },
      apply: patches => {
        if (disposed) throw Error('Disposed 3D prefab');
        // Validate the entire transaction before changing any nodes.
        for (const [path, patch] of Object.entries(patches)) {
          validatePrefabPatch3D(patch); find(path);
          if (patch.material && (!materials.has(patch.material) || !baseline.get(path)?.material))
            throw Error(`Invalid material slot at ${path}`);
        }
        for (const [path, patch] of baseline) applyNode(find(path), patch);
        for (const [path, patch] of Object.entries(patches)) applyNode(find(path), patch);
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        try { root!.destroy(true); } finally { resources.dispose(); nodes.clear(); materials.clear(); }
      },
    };
  } catch (error) {
    try { root?.destroy(true); } finally { resources.dispose(); }
    throw error;
  }
}
