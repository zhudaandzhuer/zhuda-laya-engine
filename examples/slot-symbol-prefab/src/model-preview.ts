import {
  DirectoryAssetProvider,
  Zhuda3D,
  ZhudaAssetShowcase,
  ZhudaModelInspector,
  ZhudaModelLibrary,
} from 'zhuda-laya-engine';
import type {
  AssetManifest,
  AssetManifestEntry,
  ModelInspection,
  ZhudaBootContext,
} from 'zhuda-laya-engine';

type ModelNode = ModelInspection['nodes'][number];

export interface ModelPreviewHandle {
  readonly camera: Laya.Camera;
  readonly scene: Laya.Scene3D;
  readonly assetId: string;
  readonly ready: boolean;
  load(entry: AssetManifestEntry): Promise<ModelInspection>;
  setVisible(value: boolean): void;
  setMode(mode: 'raw' | 'gameplay' | 'cinematic'): void;
  orbit(deltaX: number, deltaY: number): void;
  zoom(deltaY: number): void;
  renderHierarchy(host: HTMLElement, selectedPath: string, select: (path: string) => void): void;
  inspect(): ModelInspection | undefined;
  select(path: string): ModelNode | undefined;
  snapshot(): unknown;
  dispose(): void;
}

function childrenOf(nodes: ModelNode[], parentPath: string): ModelNode[] {
  return nodes.filter(node => {
    if (node.path === parentPath) return false;
    const parent = node.path.slice(0, node.path.lastIndexOf('/')) || '$';
    return parent === parentPath;
  });
}

function nodeLabel(node: ModelNode): string {
  const mesh = node.mesh ? ` · ${node.mesh.vertices}v` : '';
  return `${node.name || 'Unnamed'}${mesh}`;
}

function frameModel(instance: NonNullable<ZhudaAssetShowcase['instance']>, camera: Laya.Camera): void {
  const root = instance.node;
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  const visit = (node: Laya.Sprite3D) => {
    for (const type of [Laya.MeshRenderer, Laya.SkinnedMeshRenderer]) {
      const renderer = node.getComponent(type);
      const bounds = renderer?.bounds;
      if (!bounds) continue;
      const center = bounds.getCenter();
      const extent = bounds.getExtent();
      const components: Array<[number, number]> = [[center.x, extent.x], [center.y, extent.y], [center.z, extent.z]];
      for (let axis = 0; axis < components.length; axis += 1) {
        const [middle, radius] = components[axis];
        minimum[axis] = Math.min(minimum[axis], middle - radius);
        maximum[axis] = Math.max(maximum[axis], middle + radius);
      }
    }
    for (let index = 0; index < node.numChildren; index += 1) visit(node.getChildAt(index) as Laya.Sprite3D);
  };
  visit(root);
  if (!minimum.every(Number.isFinite) || !maximum.every(Number.isFinite)) return;
  const center = minimum.map((value, index) => (value + maximum[index]) / 2);
  const extent = maximum.map((value, index) => Math.max(0.001, (value - minimum[index]) / 2));
  const radius = Math.max(...extent);
  const scale = Math.min(1, 1.35 / radius);
  root.transform.position = new Laya.Vector3(-center[0] * scale, -center[1] * scale, -center[2] * scale);
  root.transform.scale = new Laya.Vector3(scale, scale, scale);
  camera.transform.position = new Laya.Vector3(0, 0, Math.max(0.45, Math.min(40, radius * 2.8)));
  camera.transform.rotationEuler = new Laya.Vector3(0, 0, 0);
}

export function createModelPreview(context: ZhudaBootContext, manifest: AssetManifest): ModelPreviewHandle {
  const modelManifest: AssetManifest = {
    schemaVersion: 1,
    entries: manifest.entries.filter(entry => entry.kind === 'model'),
  };
  const provider = new DirectoryAssetProvider({
    baseUrl: './assets/',
    manifest: modelManifest,
    timeoutMs: 20_000,
    maxBytes: 128 * 1024 * 1024,
  });
  const library = new ZhudaModelLibrary({ provider, maxIdle: 0, timeoutMs: 20_000 });
  const scene = Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.55, 0.58, 0.68, 1] });
  const camera = Zhuda3D.createCamera(scene, {
    position: [0, 0, 3],
    clearColor: [0.025, 0.045, 0.08, 1],
  });
  Zhuda3D.createDirectionalLight(scene, { rotationEuler: [-35, -30, 0], intensity: 1.65 });
  Zhuda3D.createDirectionalLight(scene, { rotationEuler: [-20, 145, 0], color: [0.38, 0.48, 1, 1], intensity: 0.32 });
  const showcase = new ZhudaAssetShowcase({ library, parent: scene, camera });
  let inspection: ModelInspection | undefined;
  let currentAssetId = '';
  let selectedPath = '$';
  let disposed = false;
  let orbitX = 0;
  let orbitY = 0;

  const updateCamera = () => {
    camera.transform.rotationEuler = new Laya.Vector3(orbitY, orbitX, 0);
  };

  return {
    camera,
    scene,
    get assetId() { return currentAssetId; },
    get ready() { return !disposed && Boolean(inspection); },
    async load(entry) {
      if (disposed) throw Error('3D preview has been disposed');
      if (entry.kind !== 'model' || !/\.(?:glb|gltf)$/i.test(entry.id)) throw Error(`Not a supported 3D model: ${entry.id}`);
      const loaded = await showcase.load(entry.id, { timeoutMs: 20_000, independentMaterials: true });
      if (!loaded || disposed || !showcase.instance) throw Error('3D model load was cancelled');
      inspection = showcase.inspect();
      currentAssetId = entry.id;
      selectedPath = '$'; orbitX = 0; orbitY = 0;
      frameModel(showcase.instance, camera); updateCamera();
      return inspection;
    },
    setVisible(value) { scene.visible = value; },
    setMode(mode) { showcase.setMode(mode); },
    orbit(deltaX, deltaY) {
      orbitX += deltaX * 0.35; orbitY = Math.max(-80, Math.min(80, orbitY + deltaY * 0.35)); updateCamera();
    },
    zoom(deltaY) {
      const current = camera.transform.position.z;
      camera.transform.position = new Laya.Vector3(0, 0, Math.max(0.35, Math.min(40, current * (deltaY > 0 ? 1.08 : 0.92))));
    },
    renderHierarchy(host, selected, select) {
      host.replaceChildren();
      if (!inspection) { host.textContent = '載入 3D 模型中…'; return; }
      const byPath = new Map(inspection.nodes.map(node => [node.path, node]));
      const append = (node: ModelNode): HTMLDetailsElement => {
        const branch = document.createElement('details'); branch.open = node.path === '$' || node.path.startsWith('$/');
        const summary = document.createElement('summary'); summary.className = node.path === selected ? 'is-selected' : '';
        summary.textContent = nodeLabel(node); summary.title = node.path;
        summary.addEventListener('click', event => { event.preventDefault(); selectedPath = node.path; select(node.path); });
        branch.appendChild(summary);
        const children = childrenOf(inspection!.nodes, node.path);
        if (children.length) { const childHost = document.createElement('div'); childHost.className = 'hierarchy-children'; for (const child of children) childHost.appendChild(append(child)); branch.appendChild(childHost); }
        return branch;
      };
      const root = byPath.get('$');
      if (root) host.appendChild(append(root));
    },
    inspect() { return inspection; },
    select(path) {
      if (!inspection) return undefined;
      selectedPath = path;
      return inspection.nodes.find(node => node.path === path);
    },
    snapshot() {
      return {
        asset: currentAssetId || null,
        selectedPath,
        nodes: inspection?.nodes ?? [],
        materials: inspection?.materials ?? [],
        animations: inspection?.animations ?? [],
        compatibility: inspection?.compatibility ?? null,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true; showcase.dispose(); library.dispose(); provider.dispose?.();
      scene.destroy(true);
    },
  };
}
