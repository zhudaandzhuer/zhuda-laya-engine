import { ZhudaEngine } from '../core/DeclarativeSDK.ts';
import { ZhudaPrefab } from '../core/StaticAssetPipeline.ts';

type JsonObject = Record<string, any>;
type AssetEntry = { path: string; kind: string; bytes: number; sha256: string };
type EditorState = {
  data: JsonObject | null;
  revision: string;
  root: any;
  context: any;
  selectedId: string;
  history: JsonObject[];
  historyIndex: number;
  savedData: JsonObject | null;
  dirty: boolean;
  stageScale: number;
  designWidth: number;
  designHeight: number;
  assetPath: string;
  drag?: { startX: number; startY: number; before: JsonObject; scaleX: number; scaleY: number };
  loadSerial: number;
};

// Keep the Web Static Asset Editor on the minimal 2D topology. Scene files
// use Laya Scene/Sprite nodes here; 3D assets have their own model editor and
// must not inflate every 2D artist preview.
const PREFAB_EDITOR_FEATURES = ['core', '2d', 'ui'] as const;

const state: EditorState = { data: null, revision: '', root: null, context: null, selectedId: '', history: [], historyIndex: -1, savedData: null, dirty: false, stageScale: 1, designWidth: 800, designHeight: 600, assetPath: '', loadSerial: 0 };
const $ = (id: string) => document.getElementById(id)!;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const text = (value: unknown) => String(value ?? '');
const setStatus = (value: string, kind: '' | 'dirty' | 'error' = '') => { const node = $('status'); node.textContent = value; node.className = `status ${kind}`; };
const showError = (error: unknown) => { const message = error instanceof Error ? error.message : String(error); $('error').textContent = message; setStatus('Error', 'error'); };
const clearError = () => { $('error').textContent = ''; };

function encodedProjectUrl(value: string) {
  const clean = value.replace(/^\.?\//, '').replace(/^\/+/, '');
  // Consumer AssetProvider IDs are rooted at the consumer's assets/ directory;
  // keep source IDs logical while resolving the editor-only preview URL.
  const projectPath = clean.startsWith('assets/') ? clean : `assets/${clean}`;
  return `/__project/${projectPath.split('/').filter(Boolean).map(part => encodeURIComponent(part)).join('/')}`;
}

function walkData(node: JsonObject, callback: (node: JsonObject, parent: JsonObject | null) => void, parent: JsonObject | null = null) {
  callback(node, parent);
  for (const child of node._$child || []) walkData(child, callback, node);
}

function findData(id: string) {
  let result: JsonObject | null = null;
  if (state.data) walkData(state.data, node => { if (node._$id === id) result = node; });
  return result;
}

function dataPath(id: string) {
  const parts: string[] = [];
  const visit = (node: JsonObject, path: string[]) => {
    if (node._$id === id) { parts.push(...path); return true; }
    for (const child of node._$child || []) if (visit(child, [...path, child.name || child._$id])) return true;
    return false;
  };
  if (state.data) visit(state.data, [state.data.name || state.data._$id]);
  return parts.join('/');
}

function indexRuntime(node: any, data: JsonObject) {
  node.__zhudaPrefabId = data._$id;
  for (let i = 0; i < (node.numChildren || 0); i++) {
    const child = node.getChildAt(i);
    const childData = (data._$child || []).find((item: JsonObject) => item.name === child.name || item._$id === child.__zhudaPrefabId);
    if (childData) indexRuntime(child, childData);
  }
}

function runtimeNode(id: string) {
  let result: any;
  const visit = (node: any) => { if (node?.__zhudaPrefabId === id) { result = node; return; } for (let i = 0; i < (node?.numChildren || 0) && !result; i++) visit(node.getChildAt(i)); };
  visit(state.root);
  return result;
}

function rewriteAssets(data: JsonObject) {
  const urls: string[] = [];
  walkData(data, node => {
    if (typeof node.skin === 'string' && !/^(?:data:|blob:|https?:\/\/)/.test(node.skin)) { node.skin = encodedProjectUrl(node.skin); urls.push(node.skin); }
    for (const command of node._gcmds || []) if (command._$type === 'DrawTextureCmd' && typeof command.textureId === 'string' && !/^(?:data:|blob:|https?:\/\/)/.test(command.textureId)) { command.textureId = encodedProjectUrl(command.textureId); urls.push(command.textureId); }
  });
  return [...new Set(urls)];
}

async function preloadTextures(urls: string[]) {
  const loader = (globalThis as any).Laya?.loader;
  if (!loader || typeof loader.load !== 'function') return;
  for (const url of urls) {
    try {
      const result = loader.load(url, { type: (globalThis as any).Laya?.Loader?.IMAGE });
      if (result?.then) await result;
    } catch (error) {
      throw Error(`Texture preview failed: ${url}\n${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function setDirty(value: boolean) { state.dirty = value; setStatus(value ? 'Unsaved changes' : 'Saved', value ? 'dirty' : ''); }
function updateDirtyFromSource() { setDirty(Boolean(state.data && JSON.stringify(state.data) !== JSON.stringify(state.savedData))); }

function recordHistory() {
  if (!state.data) return;
  const snapshot = clone(state.data);
  const current = state.history[state.historyIndex];
  if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return;
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  state.historyIndex = state.history.length - 1;
  setDirty(true);
  updateHistoryButtons();
}

function updateHistoryButtons() {
  ($('undo') as HTMLButtonElement).disabled = state.historyIndex <= 0;
  ($('redo') as HTMLButtonElement).disabled = state.historyIndex < 0 || state.historyIndex >= state.history.length - 1;
}

function renderTree() {
  const host = $('tree'); host.textContent = '';
  if (!state.data) return;
  const render = (node: JsonObject, depth: number) => {
    const item = document.createElement('div');
    item.className = `tree-node ${node._$id === state.selectedId ? 'selected' : ''}`;
    item.style.paddingLeft = `${8 + depth * 14}px`;
    item.dataset.nodeId = node._$id;
    item.innerHTML = `${text(node.name || node._$id)} <span class="type">${text(node._$type)}</span>`;
    item.addEventListener('click', () => { state.selectedId = node._$id; renderTree(); renderInspector(); updateSelectionBox(); });
    host.appendChild(item);
    for (const child of node._$child || []) render(child, depth + 1);
  };
  render(state.data, 0);
}

let assetEntries: AssetEntry[] = [];
let selectedAssetFolder = '';

function assetLabel(value: string) { return value.split('/').pop() || value; }
function formatAssetBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function logicalAssetPath(value: string) { return value.replace(/^assets\//, ''); }
function assetFolderOf(value: string) { return logicalAssetPath(value).split('/').slice(0, -1).join('/'); }

function renderAssetFiles() {
  const host = $('asset-files');
  const count = $('asset-count');
  const prefix = selectedAssetFolder ? `${selectedAssetFolder}/` : '';
  const visible = assetEntries.filter(entry => {
    const logical = logicalAssetPath(entry.path);
    return logical.startsWith(prefix) && !logical.slice(prefix.length).includes('/');
  });
  count.textContent = `${visible.length} file${visible.length === 1 ? '' : 's'} · assets/`;
  host.textContent = '';
  if (!visible.length) {
    const empty = document.createElement('div'); empty.className = 'asset-empty'; empty.textContent = '選擇左側資料夾查看資產'; host.appendChild(empty); return;
  }
  for (const entry of visible) {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'asset-card'; card.classList.toggle('selected', entry.path === state.assetPath);
    card.title = `${entry.path}\nSHA-256 ${entry.sha256}`;
    const icon = document.createElement('span'); icon.className = `asset-icon ${entry.kind}`; icon.textContent = entry.kind === 'scene' ? 'LS' : entry.kind === 'prefab' ? 'LH' : entry.kind.slice(0, 3).toUpperCase();
    const meta = document.createElement('span'); meta.className = 'asset-meta';
    const name = document.createElement('span'); name.className = 'asset-name'; name.textContent = assetLabel(entry.path);
    const detail = document.createElement('span'); detail.className = 'asset-detail'; detail.textContent = `${entry.kind} · ${formatAssetBytes(entry.bytes)}`;
    meta.append(name, detail); card.append(icon, meta); host.appendChild(card);
    card.addEventListener('click', () => {
      if (entry.kind === 'prefab' || entry.kind === 'scene') {
        const next = new URL(window.location.href);
        next.searchParams.set('prefab', entry.path);
        next.searchParams.delete('asset');
        window.location.assign(next.toString());
        return;
      }
      state.assetPath = entry.path;
      renderAssetFiles();
      setStatus(`${entry.path} · ${formatAssetBytes(entry.bytes)}`);
    });
  }
}

function renderAssetFolders() {
  const host = $('asset-folders');
  const folders = new Set<string>(['']);
  for (const entry of assetEntries) {
    const parts = logicalAssetPath(entry.path).split('/'); parts.pop();
    for (let index = 1; index <= parts.length; index += 1) folders.add(parts.slice(0, index).join('/'));
  }
  host.textContent = '';
  for (const folder of [...folders].sort((a, b) => a.localeCompare(b))) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'asset-folder'; button.classList.toggle('selected', folder === selectedAssetFolder);
    button.style.paddingLeft = `${8 + folder.split('/').filter(Boolean).length * 14}px`;
    const icon = document.createElement('span'); icon.className = 'folder-icon'; icon.textContent = folder ? '▰' : '▾';
    const label = document.createElement('span'); label.textContent = folder ? assetLabel(folder) : 'Assets';
    button.append(icon, label); button.title = folder || 'All project assets';
    button.addEventListener('click', () => { selectedAssetFolder = folder; renderAssetFolders(); renderAssetFiles(); });
    host.appendChild(button);
  }
}

async function loadAssets() {
  const response = await fetch('/api/assets', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw Error(payload.error || 'Unable to load project assets');
  assetEntries = Array.isArray(payload.entries) ? payload.entries : [];
  selectedAssetFolder = assetFolderOf(state.assetPath);
  renderAssetFolders(); renderAssetFiles();
}

const inspectorFields: Array<{ key: string; label: string; type: 'number' | 'text' | 'checkbox'; step?: string }> = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'x', label: 'X', type: 'number', step: '0.1' }, { key: 'y', label: 'Y', type: 'number', step: '0.1' },
  { key: 'width', label: 'Width', type: 'number', step: '0.1' }, { key: 'height', label: 'Height', type: 'number', step: '0.1' },
  { key: 'anchorX', label: 'Anchor X', type: 'number', step: '0.01' }, { key: 'anchorY', label: 'Anchor Y', type: 'number', step: '0.01' },
  { key: 'pivotX', label: 'Pivot X', type: 'number', step: '0.1' }, { key: 'pivotY', label: 'Pivot Y', type: 'number', step: '0.1' },
  { key: 'scaleX', label: 'Scale X', type: 'number', step: '0.01' }, { key: 'scaleY', label: 'Scale Y', type: 'number', step: '0.01' },
  { key: 'rotation', label: 'Rotation', type: 'number', step: '0.1' }, { key: 'alpha', label: 'Alpha', type: 'number', step: '0.01' },
  { key: 'visible', label: 'Visible', type: 'checkbox' }, { key: 'text', label: 'Text', type: 'text' },
  { key: 'font', label: 'Font', type: 'text' }, { key: 'fontSize', label: 'Font size', type: 'number', step: '1' },
  { key: 'color', label: 'Color', type: 'text' }, { key: 'align', label: 'Align', type: 'text' }, { key: 'valign', label: 'Valign', type: 'text' },
];

function editProperty(key: string, raw: string | boolean) {
  const dataNode = findData(state.selectedId); const live = runtimeNode(state.selectedId);
  if (!dataNode || !live) return;
  let value: any = raw;
  const field = inspectorFields.find(item => item.key === key);
  if (field?.type === 'number') { value = Number(raw); if (!Number.isFinite(value)) return; }
  dataNode[key] = value;
  if (key === 'name') live.name = value;
  else live[key] = value;
  if (key === 'name') renderTree();
  recordHistory(); updateSelectionBox();
}

function renderInspector() {
  const host = $('inspector'); host.textContent = '';
  const dataNode = findData(state.selectedId);
  if (!dataNode) { host.innerHTML = '<div class="empty">選擇一個節點開始編輯。</div>'; return; }
  const width = Number(dataNode.width || 0); const height = Number(dataNode.height || 0);
  const anchorX = Number(dataNode.anchorX) || 0; const anchorY = Number(dataNode.anchorY) || 0;
  const pivotX = Number.isFinite(Number(dataNode.pivotX)) ? Number(dataNode.pivotX) : width * anchorX;
  const pivotY = Number.isFinite(Number(dataNode.pivotY)) ? Number(dataNode.pivotY) : height * anchorY;
  const title = document.createElement('div'); title.className = 'note'; title.innerHTML = `<strong>${text(dataNode.name || dataNode._$id)}</strong><br><code>${text(dataPath(state.selectedId))}</code><br><span>${text(dataNode._$type)}</span><br><span>Size ${width} × ${height} · Anchor ${(anchorX * 100).toFixed(0)}% / ${(anchorY * 100).toFixed(0)}% · Pivot ${pivotX} / ${pivotY}</span>`; host.appendChild(title);
  for (const field of inspectorFields) {
    if (field.key === 'text' && !['Text', 'Label'].includes(dataNode._$type) && dataNode.text === undefined) continue;
    const row = document.createElement('div'); row.className = 'field';
    const label = document.createElement('label'); label.textContent = field.label; row.appendChild(label);
    const input = document.createElement('input'); input.type = field.type; input.value = field.type === 'checkbox' ? '' : text(dataNode[field.key] ?? (field.type === 'number' && ['scaleX', 'scaleY', 'alpha'].includes(field.key) ? field.key === 'alpha' ? 1 : 1 : 0));
    if (field.type === 'number') input.step = field.step || 'any';
    if (field.type === 'checkbox') input.checked = dataNode[field.key] !== false;
    input.addEventListener('change', () => editProperty(field.key, field.type === 'checkbox' ? input.checked : input.value));
    row.appendChild(input); host.appendChild(row);
  }
  if (dataNode.skin) { const row = document.createElement('div'); row.className = 'note'; row.textContent = `Skin: ${dataNode.skin}`; host.appendChild(row); }
}

function fitStage() {
  const panel = document.querySelector('.stage-panel') as HTMLElement | null;
  const shell = $('stage-shell') as HTMLElement;
  const canvas = state.context?.canvas as HTMLCanvasElement | undefined;
  if (!panel || !canvas) return;
  const help = document.querySelector('.stage-help') as HTMLElement | null;
  const availableWidth = Math.max(160, panel.clientWidth - 24);
  const availableHeight = Math.max(160, panel.clientHeight - (help?.offsetHeight || 0) - 24);
  const scale = Math.min(1, availableWidth / state.designWidth, availableHeight / state.designHeight);
  const width = Math.max(1, Math.floor(state.designWidth * scale));
  const height = Math.max(1, Math.floor(state.designHeight * scale));
  state.stageScale = scale;
  shell.style.width = `${width}px`;
  shell.style.height = `${height}px`;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  updateSelectionBox();
}

function updateSelectionBox() {
  const box = $('selection-box') as HTMLElement;
  const anchor = $('anchor-marker') as HTMLElement;
  const live = runtimeNode(state.selectedId); const canvas = state.context?.canvas;
  if (!live || !canvas) { box.style.display = 'none'; anchor.style.display = 'none'; return; }
  const shell = $('stage-shell') as HTMLElement;
  const scaleX = shell.clientWidth / state.designWidth || state.stageScale; const scaleY = shell.clientHeight / state.designHeight || state.stageScale;
  const widthLocal = Math.max(0, Number(live.width || 0)); const heightLocal = Math.max(0, Number(live.height || 0));
  const nodeScaleX = Number(live.scaleX) || 1; const nodeScaleY = Number(live.scaleY) || 1;
  const anchorX = Number(live.anchorX) || 0; const anchorY = Number(live.anchorY) || 0;
  const pivotX = Number.isFinite(Number(live.pivotX)) ? Number(live.pivotX) : widthLocal * anchorX;
  const pivotY = Number.isFinite(Number(live.pivotY)) ? Number(live.pivotY) : heightLocal * anchorY;
  const width = widthLocal * Math.abs(nodeScaleX) * scaleX; const height = heightLocal * Math.abs(nodeScaleY) * scaleY;
  const left = (Number(live.x || 0) - pivotX * nodeScaleX) * scaleX;
  const top = (Number(live.y || 0) - pivotY * nodeScaleY) * scaleY;
  box.style.display = 'block'; box.style.left = `${left}px`; box.style.top = `${top}px`; box.style.width = `${Math.max(1, width)}px`; box.style.height = `${Math.max(1, height)}px`;
  anchor.style.display = 'block'; anchor.style.left = `${Number(live.x || 0) * scaleX}px`; anchor.style.top = `${Number(live.y || 0) * scaleY}px`;
}

async function rebuild() {
  if (!state.data || !state.context) return;
  const serial = ++state.loadSerial;
  if (state.root) { state.root.destroy?.(true); state.root = null; }
  const preview = clone(state.data);
  const urls = rewriteAssets(preview);
  await preloadTextures(urls);
  if (serial !== state.loadSerial) return;
  state.root = ZhudaPrefab.instantiate(preview, state.context.rootScene);
  indexRuntime(state.root, state.data);
  ZhudaEngine.flushRenderFrames(4);
  renderTree(); renderInspector(); updateSelectionBox();
}

async function loadFromServer(resetHistory = true) {
  clearError();
  const requested = new URLSearchParams(window.location.search).get('prefab') || new URLSearchParams(window.location.search).get('asset');
  const endpoint = requested ? `/api/prefab?prefab=${encodeURIComponent(requested)}` : '/api/prefab';
  const response = await fetch(endpoint, { cache: 'no-store' });
  const payload = await response.json(); if (!response.ok) throw Error(payload.error || 'Unable to load Prefab');
  state.data = payload.prefab; state.revision = payload.revision; state.assetPath = payload.path; state.selectedId = state.data._$id;
  state.savedData = clone(state.data);
  const meta = state.data._zhudaMeta;
  const canvas = meta?.designCanvas;
  const width = Number(canvas?.width ?? state.data.width ?? 800);
  const height = Number(canvas?.height ?? state.data.height ?? 600);
  state.designWidth = Number.isFinite(width) && width > 0 ? width : 800;
  state.designHeight = Number.isFinite(height) && height > 0 ? height : 600;
  const metaLabel = meta?.assetId && meta.assetId !== payload.path ? ` · ${meta.assetId}` : '';
  ($('path') as HTMLElement).textContent = `${payload.path}${metaLabel} · ${canvas?.width || state.data.width || 800}×${canvas?.height || state.data.height || 600}`;
  if (resetHistory) { state.history = [clone(state.data)]; state.historyIndex = 0; setDirty(false); }
  if (state.context) await rebuild();
  updateHistoryButtons();
}

async function saveToServer() {
  if (!state.data) return;
  clearError(); setStatus('Saving…');
  const response = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: state.assetPath, baseRevision: state.revision, prefab: state.data }) });
  const payload = await response.json();
  if (response.status === 409) throw Error(`${payload.error}\nReload first to avoid overwriting another artist's changes.`);
  if (!response.ok) throw Error(payload.error || 'Save failed');
  state.revision = payload.revision; state.savedData = clone(state.data); state.history[state.historyIndex] = clone(state.data); setDirty(false); setStatus(payload.saved ? `Saved · backup ${payload.backup}` : 'Saved');
}

async function moveHistory(delta: number) {
  const next = state.historyIndex + delta;
  if (next < 0 || next >= state.history.length) return;
  state.historyIndex = next; state.data = clone(state.history[next]); state.selectedId = state.data._$id; await rebuild(); updateDirtyFromSource(); updateHistoryButtons();
}

function installDrag() {
  const canvas = () => state.context?.canvas as HTMLCanvasElement | undefined;
  document.addEventListener('pointerdown', event => {
    const target = event.target as Node | null; const currentCanvas = canvas(); const node = runtimeNode(state.selectedId);
    if (!currentCanvas || !node || !target || !currentCanvas.contains(target)) return;
    const rect = currentCanvas.getBoundingClientRect(); state.drag = { startX: event.clientX, startY: event.clientY, before: clone(findData(state.selectedId)), scaleX: rect.width / state.designWidth, scaleY: rect.height / state.designHeight };
    currentCanvas.setPointerCapture?.(event.pointerId); event.preventDefault();
  });
  document.addEventListener('pointermove', event => {
    if (!state.drag) return; const dataNode = findData(state.selectedId); const node = runtimeNode(state.selectedId); if (!dataNode || !node) return;
    dataNode.x = Number(state.drag.before.x || 0) + (event.clientX - state.drag.startX) / (state.drag.scaleX || 1);
    dataNode.y = Number(state.drag.before.y || 0) + (event.clientY - state.drag.startY) / (state.drag.scaleY || 1);
    node.x = dataNode.x; node.y = dataNode.y; updateSelectionBox(); renderInspector(); setDirty(true);
  });
  document.addEventListener('pointerup', () => { if (!state.drag) return; state.drag = undefined; recordHistory(); });
}

function applyAgentView() {
  const params = new URLSearchParams(location.search);
  const agent = params.get('view') === 'agent';
  document.body.classList.toggle('agent-view', agent);
  const button = $('agent-view') as HTMLButtonElement;
  button.textContent = agent ? 'Editor View' : 'Agent View';
  button.setAttribute('aria-pressed', String(agent));
  button.onclick = () => {
    const next = new URLSearchParams(location.search);
    if (agent) next.delete('view'); else next.set('view', 'agent');
    history.replaceState(null, '', `${location.pathname}${next.toString() ? `?${next}` : ''}`);
    applyAgentView();
    requestAnimationFrame(fitStage);
  };
}

async function boot() {
  try {
    // Read the static asset first so .ls Scenes boot at their authored design
    // size instead of being clipped into the Prefab editor's old 800×600 box.
    await loadFromServer(true);
    state.context = await ZhudaEngine.boot({ container: '#stage', width: state.designWidth, height: state.designHeight, designSize: { width: state.designWidth, height: state.designHeight }, dprCap: Math.min(window.devicePixelRatio || 1, 2), features: [...PREFAB_EDITOR_FEATURES], renderer: 'webgl', bgColor: '#0b1220' });
    state.context.canvas.style.width = `${state.designWidth}px`; state.context.canvas.style.height = `${state.designHeight}px`; state.context.canvas.style.display = 'block';
    applyAgentView();
    window.addEventListener('resize', () => requestAnimationFrame(fitStage));
    installDrag();
    await loadAssets();
    await rebuild();
    requestAnimationFrame(fitStage);
    setStatus('Saved');
  } catch (error) { showError(error); }
}

$('save').addEventListener('click', () => void saveToServer().catch(showError));
$('reload').addEventListener('click', () => void loadFromServer(true).catch(showError));
$('undo').addEventListener('click', () => void moveHistory(-1).catch(showError));
$('redo').addEventListener('click', () => void moveHistory(1).catch(showError));
window.addEventListener('keydown', event => { if (!(event.ctrlKey || event.metaKey)) return; if (event.key.toLowerCase() === 's') { event.preventDefault(); void saveToServer().catch(showError); } if (event.key.toLowerCase() === 'z') { event.preventDefault(); void moveHistory(event.shiftKey ? 1 : -1).catch(showError); } if (event.key.toLowerCase() === 'y') { event.preventDefault(); void moveHistory(1).catch(showError); } });
applyAgentView();
void boot();
