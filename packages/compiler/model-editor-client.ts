import { editorFetch } from './editor-request.ts';
import {
  DirectoryAssetProvider,
  ZhudaAssetShowcase,
  ZhudaEngine,
  ZhudaModelInspector,
  ZhudaModelLibrary,
  Zhuda3D,
  inspectGltfAsset,
  inspectSceneResources,
} from 'zhuda-laya-engine';
import type { AssetManifest, AssetManifestEntry, ZhudaBootContext } from 'zhuda-laya-engine';

declare global {
  interface Window {
    __ZHUDA_MODEL_ASSET__?: string;
    __ZHUDA_MODEL_EDITOR__?: { ready: boolean; report(): unknown; dispose(): void };
  }
}

type ModelAssetEntry = Omit<AssetManifestEntry, 'kind'> & { path: string; kind: string };
type ModelInspection = ReturnType<ZhudaModelInspector['inspect']>;
type ModelEditorState = {
  assetPath: string;
  assetId: string;
  context?: ZhudaBootContext;
  provider?: DirectoryAssetProvider;
  library?: ZhudaModelLibrary;
  showcase?: ZhudaAssetShowcase;
  inspector?: ZhudaModelInspector;
  camera?: Laya.Camera;
  inspection?: ModelInspection;
  selectedPath: string;
  isolatedPath: string | null;
  loadSerial: number;
  disposed: boolean;
  mode: 'raw' | 'gameplay' | 'cinematic';
  orbitX: number;
  orbitY: number;
  distance: number;
  resizeObserver?: ResizeObserver;
  resizeListener?: () => void;
};

const state: ModelEditorState = {
  assetPath: window.__ZHUDA_MODEL_ASSET__ || '',
  assetId: '',
  selectedPath: '$',
  isolatedPath: null,
  loadSerial: 0,
  disposed: false,
  mode: 'raw',
  orbitX: 0,
  orbitY: 0,
  distance: 3,
};

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw Error(`Missing model editor element #${id}`);
  return element as T;
};

const text = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] || character));

const setStatus = (value: string, kind: '' | 'error' | 'busy' = '') => {
  const status = $('status');
  status.textContent = value;
  status.className = `status ${kind}`.trim();
};

const setError = (error: unknown) => {
  const host = $('error');
  host.textContent = error ? String(error instanceof Error ? (error.stack || error.message) : error) : '';
  if (error) setStatus('Load failed', 'error');
};

function modelAssetId(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized.startsWith('assets/')) throw Error('Model must be inside the project assets directory');
  const id = normalized.slice('assets/'.length);
  if (!/\.(?:glb|gltf)$/i.test(id) || id.split('/').some(part => !part || part === '.' || part === '..'))
    throw Error('3D editor accepts self-contained .glb or .gltf assets');
  return id;
}

function assetLabel(path: string): string { return path.split('/').pop() || path; }
function assetFolder(path: string): string { const parts = path.split('/'); parts.pop(); return parts.join('/'); }
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function updateUrl(path: string): void {
  const next = new URL(window.location.href);
  next.searchParams.set('asset', path);
  history.replaceState(null, '', `${next.pathname}${next.search}`);
  state.assetPath = path;
  $('path').textContent = `${path} · 3D model editor`;
}

function renderFolders(entries: ModelAssetEntry[], selectedFolder: string, selectFolder: (folder: string) => void): void {
  const host = $('asset-folders');
  const folders = new Set<string>(['']);
  for (const entry of entries) {
    const parts = assetFolder(entry.path).split('/').filter(Boolean);
    for (let index = 1; index <= parts.length; index += 1) folders.add(parts.slice(0, index).join('/'));
  }
  host.replaceChildren();
  for (const folder of [...folders].sort((a, b) => a.localeCompare(b))) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'asset-folder'; button.classList.toggle('selected', folder === selectedFolder);
    button.style.paddingLeft = `${8 + folder.split('/').filter(Boolean).length * 14}px`;
    button.textContent = `${folder ? '▰' : '▾'} ${folder ? assetLabel(folder) : 'Assets'}`;
    button.title = folder || 'All project assets';
    button.onclick = () => selectFolder(folder);
    host.appendChild(button);
  }
}

function renderAssets(entries: ModelAssetEntry[], selectedFolder: string, open: (entry: ModelAssetEntry) => void): void {
  const host = $('asset-files');
  const visible = entries.filter(entry => {
    const path = entry.path.replace(/^assets\//, '');
    return assetFolder(path) === selectedFolder;
  });
  $('asset-count').textContent = `${visible.length} file${visible.length === 1 ? '' : 's'} · assets/`;
  host.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div'); empty.className = 'asset-empty'; empty.textContent = '此資料夾沒有資產'; host.appendChild(empty); return;
  }
  for (const entry of visible) {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'asset-card';
    card.classList.toggle('selected', entry.path === state.assetPath);
    const icon = document.createElement('span'); icon.className = `asset-icon ${entry.kind}`;
    icon.textContent = entry.kind === 'model' ? '3D' : entry.kind === 'scene' ? 'LS' : entry.kind === 'prefab' ? 'LH' : entry.kind.slice(0, 3).toUpperCase();
    const meta = document.createElement('span'); meta.className = 'asset-meta';
    const name = document.createElement('span'); name.className = 'asset-name'; name.textContent = assetLabel(entry.path);
    const detail = document.createElement('span'); detail.className = 'asset-detail'; detail.textContent = `${entry.kind} · ${formatBytes(entry.bytes ?? 0)}`;
    meta.append(name, detail); card.append(icon, meta); card.title = `${entry.path}\nSHA-256 ${entry.sha256 || '—'}`;
    card.onclick = () => open(entry); host.appendChild(card);
  }
}

async function loadAssetIndex(): Promise<ModelAssetEntry[]> {
  const response = await editorFetch('/api/assets', { cache: 'no-store' });
  const payload = await response.json() as { entries?: Array<AssetManifestEntry & { path: string; kind: string }>; error?: string };
  if (!response.ok) throw Error(payload.error || 'Unable to read project assets');
  return (payload.entries || []).map(entry => ({ ...entry, path: entry.path.replace(/^assets\//, '') }));
}

function installAssetBrowser(entries: ModelAssetEntry[]): void {
  let selectedFolder = assetFolder(state.assetPath.replace(/^assets\//, ''));
  const draw = () => {
    renderFolders(entries, selectedFolder, folder => { selectedFolder = folder; draw(); });
    renderAssets(entries, selectedFolder, entry => {
      if (entry.kind !== 'model') {
        setStatus(`${entry.path} · 以 2D Prefab Editor 開啟 ${entry.kind}`, '');
        return;
      }
      void loadModel(`assets/${entry.path}`);
    });
  };
  draw();
}

function nodeLabel(node: ModelInspection['nodes'][number]): string {
  const mesh = node.mesh ? ` · ${node.mesh.vertices}v` : '';
  return `${node.name || 'Unnamed'}${mesh}`;
}

function renderHierarchy(info: ModelInspection): void {
  const host = $('tree');
  host.replaceChildren();
  const byPath = new Map(info.nodes.map(node => [node.path, node]));
  const childrenOf = (path: string) => info.nodes.filter(node => {
    const parent = node.path.slice(0, node.path.lastIndexOf('/')) || '$';
    return parent === path && node.path !== path;
  });
  const append = (node: ModelInspection['nodes'][number]) => {
    const branch = document.createElement('details'); branch.open = node.path === '$' || node.path.startsWith('$/');
    const summary = document.createElement('summary'); summary.className = node.path === state.selectedPath ? 'selected' : '';
    summary.textContent = nodeLabel(node); summary.title = node.path;
    summary.onclick = event => { event.preventDefault(); selectNode(node.path); };
    branch.appendChild(summary);
    const children = childrenOf(node.path);
    if (children.length) { const childHost = document.createElement('div'); childHost.className = 'tree-children'; for (const child of children) childHost.appendChild(append(child)); branch.appendChild(childHost); }
    return branch;
  };
  const root = byPath.get('$');
  if (root) host.appendChild(append(root));
  else for (const node of info.nodes.filter(item => item.path.split('/').length === 2)) host.appendChild(append(node));
}

function renderInspector(info: ModelInspection): void {
  const host = $('inspector');
  const selected = info.nodes.find(node => node.path === state.selectedPath) || info.nodes[0];
  if (!selected) { host.innerHTML = '<div class="empty">模型沒有可檢視的節點。</div>'; return; }
  state.selectedPath = selected.path;
  const compatibility = info.compatibility;
  const summary = compatibility.inventory.summary;
  const title = document.createElement('div'); title.className = 'note';
  title.innerHTML = `<strong>${text(selected.name || 'Unnamed')}</strong><br><code>${text(selected.path)}</code><br><span>${selected.mesh ? `Mesh ${selected.mesh.vertices} vertices · ${selected.mesh.indices} indices` : 'Group node'}</span><br><span>Active ${selected.active ? 'yes' : 'no'} · materials ${selected.materialIds.length} · morphs ${Object.keys(selected.morphWeights).length}</span>`;
  host.replaceChildren(title);
  const rows: Array<[string, string]> = [
    ['Asset', state.assetPath],
    ['Importer', `${compatibility.status} · ${compatibility.validationScope}`],
    ['Source', `${summary.nodes} nodes · ${summary.meshes} meshes · ${summary.primitives} primitives`],
    ['Geometry', `${summary.vertices} vertices · ${summary.triangles} triangles`],
    ['Materials', `${summary.materials} materials · ${summary.textures} textures`],
    ['Animation', `${summary.animations} clips · live ${info.animations.length}`],
    ['GPU report', state.library ? state.library.report().gpuReady : '—'],
    ['Renderer', state.context?.renderer.selected || '—'],
    ['Viewport', state.context ? `${state.context.canvas.clientWidth} × ${state.context.canvas.clientHeight} CSS · DPR ${(window.devicePixelRatio || 1).toFixed(2)}` : '—'],
  ];
  for (const [label, value] of rows) { const row = document.createElement('div'); row.className = 'metric-row'; row.innerHTML = `<span>${text(label)}</span><strong>${text(value)}</strong>`; host.appendChild(row); }
  const actions = document.createElement('div'); actions.className = 'inspector-actions';
  const isolate = document.createElement('button'); isolate.type = 'button'; isolate.textContent = state.isolatedPath === selected.path ? 'Show all nodes' : 'Isolate selected'; isolate.onclick = () => { state.isolatedPath = state.isolatedPath === selected.path ? null : selected.path; applyIsolation(); renderInspector(info); };
  actions.appendChild(isolate); host.appendChild(actions);
  if (compatibility.diagnostics.length) {
    const diagnostics = document.createElement('div'); diagnostics.className = 'note diagnostics'; diagnostics.textContent = compatibility.diagnostics.map(item => `${item.severity}: ${item.message}`).join('\n'); host.appendChild(diagnostics);
  }
}

function applyIsolation(): void {
  const inspector = state.inspector;
  const info = state.inspection;
  if (!inspector || !info) return;
  const keep = new Set<string>();
  if (state.isolatedPath) {
    for (let path = state.isolatedPath; path; path = path.slice(0, path.lastIndexOf('/')) || '') {
      keep.add(path || '$'); if (path === '$') break;
    }
  }
  for (const node of info.nodes) {
    const live = inspector.node(node.path);
    live.active = !state.isolatedPath || keep.has(node.path) || node.path.startsWith(`${state.isolatedPath}/`);
  }
}

function selectNode(path: string): void {
  state.selectedPath = path;
  if (state.inspection) { renderHierarchy(state.inspection); renderInspector(state.inspection); }
}

function updateCamera(): void {
  const camera = state.camera;
  if (!camera) return;
  camera.transform.position = new Laya.Vector3(0, 0, state.distance);
  camera.transform.rotationEuler = new Laya.Vector3(state.orbitY, state.orbitX, 0);
}

/** Center and frame arbitrary imported models before the first screenshot.
 * Bounds are sampled from the native renderers; a failed bounds query keeps the
 * authored transform and is reported by the normal model inspection contract. */
function frameModel(): void {
  const root = state.showcase?.instance?.node;
  if (!root) return;
  const minimum = [Infinity, Infinity, Infinity]; const maximum = [-Infinity, -Infinity, -Infinity];
  const visit = (node: Laya.Sprite3D) => {
    for (const type of [Laya.MeshRenderer, Laya.SkinnedMeshRenderer]) {
      const renderer = node.getComponent(type);
      const bounds = renderer?.bounds;
      if (!bounds) continue;
      const center = bounds.getCenter(); const extent = bounds.getExtent();
      for (let axis = 0; axis < 3; axis += 1) { minimum[axis] = Math.min(minimum[axis], [center.x, center.y, center.z][axis] - [extent.x, extent.y, extent.z][axis]); maximum[axis] = Math.max(maximum[axis], [center.x, center.y, center.z][axis] + [extent.x, extent.y, extent.z][axis]); }
    }
    for (let index = 0; index < node.numChildren; index += 1) visit(node.getChildAt(index) as Laya.Sprite3D);
  };
  try {
    visit(root);
    if (!minimum.every(Number.isFinite) || !maximum.every(Number.isFinite)) return;
    const center = minimum.map((value, index) => (value + maximum[index]) / 2);
    const extent = maximum.map((value, index) => Math.max(0.001, (value - minimum[index]) / 2));
    const radius = Math.max(...extent); const scale = Math.min(1, 1.35 / radius);
    root.transform.position = new Laya.Vector3(-center[0] * scale, -center[1] * scale, -center[2] * scale);
    root.transform.scale = new Laya.Vector3(scale, scale, scale);
    state.distance = Math.max(0.45, Math.min(40, radius * 2.8)); state.orbitX = 0; state.orbitY = 0; updateCamera();
  } catch {
    // Some native renderers expose bounds only after their first draw. The
    // authored model remains valid and the next reload can try again.
  }
}

function fitStage(): void {
  const context = state.context; const panel = $('stage-panel'); const shell = $('stage-shell'); const canvas = context?.canvas;
  if (!canvas) return;
  const width = Math.max(1, panel.clientWidth - 24); const height = Math.max(1, panel.clientHeight - 56);
  const scale = Math.min(1, width / 720, height / 480);
  shell.style.width = `${Math.max(160, Math.floor(720 * scale))}px`; shell.style.height = `${Math.max(120, Math.floor(480 * scale))}px`;
  canvas.style.width = '100%'; canvas.style.height = '100%';
  context!.resize();
}

function installPointerControls(): void {
  const canvasHost = $('stage-shell'); let drag: { x: number; y: number } | null = null;
  canvasHost.addEventListener('pointerdown', event => { drag = { x: event.clientX, y: event.clientY }; canvasHost.setPointerCapture(event.pointerId); });
  canvasHost.addEventListener('pointermove', event => {
    if (!drag || !state.showcase?.instance) return;
    state.orbitX += (event.clientX - drag.x) * 0.35; state.orbitY = Math.max(-80, Math.min(80, state.orbitY + (event.clientY - drag.y) * 0.35));
    drag = { x: event.clientX, y: event.clientY }; updateCamera();
  });
  canvasHost.addEventListener('pointerup', () => { drag = null; });
  canvasHost.addEventListener('pointercancel', () => { drag = null; });
  canvasHost.addEventListener('wheel', event => { event.preventDefault(); state.distance = Math.max(0.35, Math.min(40, state.distance * (event.deltaY > 0 ? 1.08 : 0.92))); updateCamera(); }, { passive: false });
}

async function loadModel(path: string): Promise<void> {
  if (state.disposed) return;
  const serial = ++state.loadSerial;
  state.assetPath = path; state.assetId = modelAssetId(path); state.selectedPath = '$'; state.isolatedPath = null;
  updateUrl(path); setError(null); setStatus('Loading model…', 'busy');
  try {
    if (!state.showcase) throw Error('3D showcase is not ready');
    const loaded = await state.showcase.load(state.assetId, { timeoutMs: 20_000, independentMaterials: true });
    if (!loaded || serial !== state.loadSerial || state.disposed) return;
    state.inspection = state.showcase.inspect(); state.inspector = new ZhudaModelInspector(state.showcase.instance!);
    frameModel();
    applyIsolation(); renderHierarchy(state.inspection); renderInspector(state.inspection);
    setStatus(`${assetLabel(path)} · ${state.inspection.compatibility.status}`, '');
    ZhudaEngine.flushRenderFrames(3);
  } catch (error) {
    if (serial !== state.loadSerial || state.disposed) return;
    state.inspection = undefined; state.inspector = undefined; setError(error);
  }
}

async function main(): Promise<void> {
  state.assetPath = window.__ZHUDA_MODEL_ASSET__ || state.assetPath;
  state.assetId = modelAssetId(state.assetPath);
  $('path').textContent = `${state.assetPath} · 3D model editor`;
  const stage = $('stage');
  state.context = await ZhudaEngine.boot({
    container: stage, width: 720, height: 480, dprCap: 3, renderer: 'webgl',
    designSize: { width: 720, height: 480 }, scaleMode: 'noborder',
    features: ['core', '2d', '3d', 'ui', 'gltf', 'postProcess'], preserveDrawingBuffer: true,
    bgColor: '#0b1220',
  });
  const scene = Zhuda3D.createScene3D(state.context.rootScene, { ambientColor: [0.34, 0.4, 0.52, 1] });
  const camera = Zhuda3D.createCamera(scene, { position: [0, 0, state.distance], clearColor: [0.025, 0.045, 0.08, 1] });
  Zhuda3D.createDirectionalLight(scene, { rotationEuler: [-35, -30, 0], intensity: 1.15 });
  state.context.runtime.start(() => {});
  const resize = () => { fitStage(); };
  state.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : undefined;
  state.resizeObserver?.observe($('stage-panel'));
  state.resizeListener = resize;
  window.addEventListener('resize', resize, { passive: true });
  installPointerControls(); resize();
  const entries = await loadAssetIndex();
  const modelEntries = entries.filter(entry => entry.kind === 'model').map(entry => ({ ...entry, id: entry.path }));
  const manifest: AssetManifest = { schemaVersion: 1, entries: modelEntries.map(entry => ({ id: entry.path, kind: 'model', bytes: entry.bytes, sha256: entry.sha256 })) };
  state.provider = new DirectoryAssetProvider({ baseUrl: '/__project/assets/', manifest, maxBytes: 128 * 1024 * 1024, timeoutMs: 20_000 });
  state.library = new ZhudaModelLibrary({ provider: state.provider, maxIdle: 0, timeoutMs: 20_000 });
  state.showcase = new ZhudaAssetShowcase({ library: state.library, parent: scene, camera });
  installAssetBrowser(entries);
  $('mode-raw').onclick = () => { state.showcase?.setMode('raw'); state.mode = 'raw'; setModeButtons(); renderInspector(state.inspection!); };
  $('mode-gameplay').onclick = () => { state.showcase?.setMode('gameplay'); state.mode = 'gameplay'; setModeButtons(); renderInspector(state.inspection!); };
  $('mode-cinematic').onclick = () => { state.showcase?.setMode('cinematic'); state.mode = 'cinematic'; setModeButtons(); renderInspector(state.inspection!); };
  $('agent-view').onclick = () => document.body.classList.toggle('agent-view');
  $('copy').onclick = async () => {
    const payload = JSON.stringify(report(), null, 2);
    try { await navigator.clipboard.writeText(payload); } catch { const area = document.createElement('textarea'); area.value = payload; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); }
    $('copy').textContent = 'COPIED'; window.setTimeout(() => { $('copy').textContent = 'COPY'; }, 1000);
  };
  $('reload').onclick = () => { void loadModel(state.assetPath); };
  $('dispose').onclick = dispose;
  setModeButtons(); await loadModel(state.assetPath);
  window.__ZHUDA_MODEL_EDITOR__ = { ready: true, report, dispose };
}

function setModeButtons(): void { for (const mode of ['raw', 'gameplay', 'cinematic'] as const) $(`mode-${mode}`).classList.toggle('active', mode === state.mode); }

function report(): unknown {
  return {
    ready: !state.disposed && Boolean(state.inspection), asset: state.assetPath, mode: state.mode,
    renderer: state.context?.renderer, selectedPath: state.selectedPath,
    compatibility: state.inspection?.compatibility, inspection: state.inspection,
    library: state.library?.report(), resources: state.context ? inspectSceneResources() : null,
    viewport: state.context ? { cssWidth: state.context.canvas.clientWidth, cssHeight: state.context.canvas.clientHeight, backingWidth: state.context.canvas.width, backingHeight: state.context.canvas.height, dpr: window.devicePixelRatio } : null,
  };
}

function dispose(): void {
  if (state.disposed) return; state.disposed = true; ++state.loadSerial;
  state.resizeObserver?.disconnect(); state.resizeObserver = undefined;
  if (state.resizeListener) window.removeEventListener('resize', state.resizeListener);
  state.resizeListener = undefined;
  state.showcase?.dispose(); state.library?.dispose(); state.provider?.dispose(); state.context?.dispose();
  setStatus('Disposed');
}

window.addEventListener('pagehide', dispose, { once: true });
void main().catch(error => { setError(error); dispose(); window.__ZHUDA_MODEL_EDITOR__ = { ready: false, report, dispose }; });

