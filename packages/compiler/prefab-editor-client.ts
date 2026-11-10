import { editorFetch } from './editor-request.ts';
import { ZhudaEngine, ZhudaPrefab } from 'zhuda-laya-engine';
import { PrefabEditorPreviewSession } from './prefab-editor-preview.ts';
import type { ZhudaPrefabEditorPreviewModule } from '../types/editor-preview.ts';
import type { LayaHierarchyNodeData } from '../types/index.ts';

type JsonObject = LayaHierarchyNodeData & Record<string, any>;
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
  designWidth: number;
  designHeight: number;
  assetPath: string;
  drag?: {
    id: string;
    pointerId: number;
    canvas: HTMLCanvasElement;
    start: Laya.Point;
    before: JsonObject;
    x: number;
    y: number;
  };
  loadSerial: number;
  ready?: boolean;
  preview?: PrefabEditorPreviewSession;
  previewConfig?: { url: string; timeoutMs: number };
};

// Keep the Web Static Asset Editor on the minimal 2D topology. Scene files
// use Laya Scene/Sprite nodes here; 3D assets have their own model editor and
// must not inflate every 2D artist preview.
const PREFAB_EDITOR_FEATURES = ['core', '2d', 'ui'] as const;

const state: EditorState = {
  data: null,
  revision: '',
  root: null,
  context: null,
  selectedId: '',
  history: [],
  historyIndex: -1,
  savedData: null,
  dirty: false,
  designWidth: 800,
  designHeight: 600,
  assetPath: '',
  loadSerial: 0,
};
const $ = (id: string) => document.getElementById(id)!;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const text = (value: unknown) => String(value ?? '');
const setStatus = (value: string, kind: '' | 'dirty' | 'error' = '') => {
  const node = $('status');
  node.textContent = value;
  node.className = `status ${kind}`;
};
const showError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  $('error').textContent = message;
  setStatus('Error', 'error');
};
const clearError = () => {
  $('error').textContent = '';
};

function encodedProjectUrl(value: string) {
  const clean = value.replace(/^\.?\//, '').replace(/^\/+/, '');
  // Consumer AssetProvider IDs are rooted at the consumer's assets/ directory;
  // keep source IDs logical while resolving the editor-only preview URL.
  const projectPath = clean.startsWith('assets/') ? clean : `assets/${clean}`;
  return `/__project/${projectPath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function walkData(
  node: JsonObject,
  callback: (node: JsonObject, parent: JsonObject | null) => void,
  parent: JsonObject | null = null,
) {
  callback(node, parent);
  for (const child of node._$child || []) walkData(child, callback, node);
}

function findData(id: string): JsonObject | null {
  let result: JsonObject | null = null;
  if (state.data)
    walkData(state.data, (node) => {
      if (node._$id === id) result = node;
    });
  return result;
}

function dataPath(id: string) {
  const parts: string[] = [];
  const visit = (node: JsonObject, path: string[]) => {
    if (node._$id === id) {
      parts.push(...path);
      return true;
    }
    for (const child of node._$child || [])
      if (visit(child, [...path, child.name || child._$id])) return true;
    return false;
  };
  if (state.data) visit(state.data, [state.data.name || state.data._$id]);
  return parts.join('/');
}

function indexRuntime(node: any, data: JsonObject) {
  node.__zhudaPrefabId = data._$id;
  for (let i = 0; i < (node.numChildren || 0); i++) {
    const child = node.getChildAt(i);
    const childData = (data._$child || []).find(
      (item: JsonObject) => item.name === child.name || item._$id === child.__zhudaPrefabId,
    );
    if (childData) indexRuntime(child, childData);
  }
}

function runtimeNode(id: string) {
  let result: any;
  const visit = (node: any) => {
    if (node?.__zhudaPrefabId === id) {
      result = node;
      return;
    }
    for (let i = 0; i < (node?.numChildren || 0) && !result; i++) visit(node.getChildAt(i));
  };
  visit(state.root);
  return result;
}

function rewriteAssets(data: JsonObject) {
  const urls: string[] = [];
  walkData(data, (node) => {
    if (typeof node.skin === 'string' && !/^(?:data:|blob:|https?:\/\/)/.test(node.skin)) {
      node.skin = encodedProjectUrl(node.skin);
      urls.push(node.skin);
    }
    for (const command of node._gcmds || [])
      if (
        command._$type === 'DrawTextureCmd' &&
        typeof command.textureId === 'string' &&
        !/^(?:data:|blob:|https?:\/\/)/.test(command.textureId)
      ) {
        command.textureId = encodedProjectUrl(command.textureId);
        urls.push(command.textureId);
      }
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
      throw Error(
        `Texture preview failed: ${url}\n${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function setDirty(value: boolean) {
  state.dirty = value;
  setStatus(value ? 'Unsaved changes' : 'Saved', value ? 'dirty' : '');
}
function updateDirtyFromSource() {
  setDirty(Boolean(state.data && JSON.stringify(state.data) !== JSON.stringify(state.savedData)));
}

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
  const playing = Boolean(state.preview);
  ($('save') as HTMLButtonElement).disabled = playing;
  ($('reload') as HTMLButtonElement).disabled = playing;
  ($('undo') as HTMLButtonElement).disabled = playing || state.historyIndex <= 0;
  ($('redo') as HTMLButtonElement).disabled =
    playing || state.historyIndex < 0 || state.historyIndex >= state.history.length - 1;
}

function renderTree() {
  const host = $('tree');
  host.textContent = '';
  if (!state.data) return;
  const render = (node: JsonObject, depth: number) => {
    const item = document.createElement('div');
    item.className = `tree-node ${node._$id === state.selectedId ? 'selected' : ''}`;
    item.style.paddingLeft = `${8 + depth * 14}px`;
    item.dataset.nodeId = node._$id;
    item.innerHTML = `${text(node.name || node._$id)} <span class="type">${text(node._$type)}</span>`;
    item.addEventListener('click', () => {
      if (state.preview) return;
      finishDrag(false);
      state.selectedId = node._$id;
      renderTree();
      renderInspector();
      updateSelectionBox();
    });
    host.appendChild(item);
    for (const child of node._$child || []) render(child, depth + 1);
  };
  render(state.data, 0);
}

let assetEntries: AssetEntry[] = [];
let selectedAssetFolder = '';

function assetLabel(value: string) {
  return value.split('/').pop() || value;
}
function formatAssetBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function logicalAssetPath(value: string) {
  return value.replace(/^assets\//, '');
}
function assetFolderOf(value: string) {
  return logicalAssetPath(value).split('/').slice(0, -1).join('/');
}

function renderAssetFiles() {
  const host = $('asset-files');
  const count = $('asset-count');
  const prefix = selectedAssetFolder ? `${selectedAssetFolder}/` : '';
  const visible = assetEntries.filter((entry) => {
    const logical = logicalAssetPath(entry.path);
    return logical.startsWith(prefix) && !logical.slice(prefix.length).includes('/');
  });
  count.textContent = `${visible.length} file${visible.length === 1 ? '' : 's'} · assets/`;
  host.textContent = '';
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'asset-empty';
    empty.textContent = '選擇左側資料夾查看資產';
    host.appendChild(empty);
    return;
  }
  for (const entry of visible) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'asset-card';
    card.classList.toggle('selected', entry.path === state.assetPath);
    card.title = `${entry.path}\nSHA-256 ${entry.sha256}`;
    const icon = document.createElement('span');
    icon.className = `asset-icon ${entry.kind}`;
    icon.textContent =
      entry.kind === 'scene'
        ? 'LS'
        : entry.kind === 'prefab'
          ? 'LH'
          : entry.kind.slice(0, 3).toUpperCase();
    const meta = document.createElement('span');
    meta.className = 'asset-meta';
    const name = document.createElement('span');
    name.className = 'asset-name';
    name.textContent = assetLabel(entry.path);
    const detail = document.createElement('span');
    detail.className = 'asset-detail';
    detail.textContent = `${entry.kind} · ${formatAssetBytes(entry.bytes)}`;
    meta.append(name, detail);
    card.append(icon, meta);
    host.appendChild(card);
    card.addEventListener('click', () => {
      if (state.preview) return;
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
    const parts = logicalAssetPath(entry.path).split('/');
    parts.pop();
    for (let index = 1; index <= parts.length; index += 1)
      folders.add(parts.slice(0, index).join('/'));
  }
  host.textContent = '';
  for (const folder of [...folders].sort((a, b) => a.localeCompare(b))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'asset-folder';
    button.classList.toggle('selected', folder === selectedAssetFolder);
    button.style.paddingLeft = `${8 + folder.split('/').filter(Boolean).length * 14}px`;
    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.textContent = folder ? '▰' : '▾';
    const label = document.createElement('span');
    label.textContent = folder ? assetLabel(folder) : 'Assets';
    button.append(icon, label);
    button.title = folder || 'All project assets';
    button.addEventListener('click', () => {
      selectedAssetFolder = folder;
      renderAssetFolders();
      renderAssetFiles();
    });
    host.appendChild(button);
  }
}

async function loadAssets() {
  const response = await editorFetch('/api/assets', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw Error(payload.error || 'Unable to load project assets');
  assetEntries = Array.isArray(payload.entries) ? payload.entries : [];
  selectedAssetFolder = assetFolderOf(state.assetPath);
  renderAssetFolders();
  renderAssetFiles();
}

const inspectorFields: Array<{
  key: string;
  label: string;
  type: 'number' | 'text' | 'checkbox';
  step?: string;
}> = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'x', label: 'X', type: 'number', step: '0.1' },
  { key: 'y', label: 'Y', type: 'number', step: '0.1' },
  { key: 'width', label: 'Width', type: 'number', step: '0.1' },
  { key: 'height', label: 'Height', type: 'number', step: '0.1' },
  { key: 'anchorX', label: 'Anchor X', type: 'number', step: '0.01' },
  { key: 'anchorY', label: 'Anchor Y', type: 'number', step: '0.01' },
  { key: 'pivotX', label: 'Pivot X', type: 'number', step: '0.1' },
  { key: 'pivotY', label: 'Pivot Y', type: 'number', step: '0.1' },
  { key: 'scaleX', label: 'Scale X', type: 'number', step: '0.01' },
  { key: 'scaleY', label: 'Scale Y', type: 'number', step: '0.01' },
  { key: 'rotation', label: 'Rotation', type: 'number', step: '0.1' },
  { key: 'alpha', label: 'Alpha', type: 'number', step: '0.01' },
  { key: 'visible', label: 'Visible', type: 'checkbox' },
  { key: 'text', label: 'Text', type: 'text' },
  { key: 'font', label: 'Font', type: 'text' },
  { key: 'fontSize', label: 'Font size', type: 'number', step: '1' },
  { key: 'color', label: 'Color', type: 'text' },
  { key: 'align', label: 'Align', type: 'text' },
  { key: 'valign', label: 'Valign', type: 'text' },
];

function editProperty(key: string, raw: string | boolean) {
  if (state.preview) return;
  const dataNode = findData(state.selectedId);
  const live = runtimeNode(state.selectedId);
  if (!dataNode || !live) return;
  let value: any = raw;
  const field = inspectorFields.find((item) => item.key === key);
  if (field?.type === 'number') {
    value = Number(raw);
    if (!Number.isFinite(value)) return;
  }
  dataNode[key] = value;
  if (key === 'name') live.name = value;
  else live[key] = value;
  if (key === 'name') renderTree();
  recordHistory();
  updateSelectionBox();
}

function renderInspector() {
  const host = $('inspector');
  host.textContent = '';
  const dataNode = findData(state.selectedId);
  if (!dataNode) {
    host.innerHTML = '<div class="empty">選擇一個節點開始編輯。</div>';
    return;
  }
  const width = Number(dataNode.width || 0);
  const height = Number(dataNode.height || 0);
  const anchorX = Number(dataNode.anchorX) || 0;
  const anchorY = Number(dataNode.anchorY) || 0;
  const pivotX = Number.isFinite(Number(dataNode.pivotX))
    ? Number(dataNode.pivotX)
    : width * anchorX;
  const pivotY = Number.isFinite(Number(dataNode.pivotY))
    ? Number(dataNode.pivotY)
    : height * anchorY;
  const title = document.createElement('div');
  title.className = 'note';
  title.innerHTML = `<strong>${text(dataNode.name || dataNode._$id)}</strong><br><code>${text(dataPath(state.selectedId))}</code><br><span>${text(dataNode._$type)}</span><br><span>Size ${width} × ${height} · Anchor ${(anchorX * 100).toFixed(0)}% / ${(anchorY * 100).toFixed(0)}% · Pivot ${pivotX} / ${pivotY}</span>`;
  host.appendChild(title);
  for (const field of inspectorFields) {
    if (
      field.key === 'text' &&
      !['Text', 'Label'].includes(dataNode._$type) &&
      dataNode.text === undefined
    )
      continue;
    const row = document.createElement('div');
    row.className = 'field';
    const label = document.createElement('label');
    label.textContent = field.label;
    row.appendChild(label);
    const input = document.createElement('input');
    input.type = field.type;
    input.value =
      field.type === 'checkbox'
        ? ''
        : text(
            dataNode[field.key] ??
              (field.type === 'number' && ['scaleX', 'scaleY', 'alpha'].includes(field.key)
                ? field.key === 'alpha'
                  ? 1
                  : 1
                : 0),
          );
    input.disabled = Boolean(state.preview);
    if (field.type === 'number') input.step = field.step || 'any';
    if (field.type === 'checkbox') input.checked = dataNode[field.key] !== false;
    input.addEventListener('change', () =>
      editProperty(field.key, field.type === 'checkbox' ? input.checked : input.value),
    );
    row.appendChild(input);
    host.appendChild(row);
  }
  if (dataNode.skin) {
    const row = document.createElement('div');
    row.className = 'note';
    row.textContent = `Skin: ${dataNode.skin}`;
    host.appendChild(row);
  }
}

let fitFrame = 0;
function scheduleFitStage() {
  if (fitFrame) return;
  fitFrame = requestAnimationFrame(() => {
    fitFrame = 0;
    fitStage();
  });
}

function installResponsiveLayout() {
  const observer = new ResizeObserver(scheduleFitStage);
  const panel = document.querySelector('.stage-panel'),
    help = document.querySelector('.stage-help');
  if (panel) observer.observe(panel);
  if (help) observer.observe(help);
  window.addEventListener('resize', scheduleFitStage);
  window.visualViewport?.addEventListener('resize', scheduleFitStage);
  const cleanup = (event: PageTransitionEvent) => {
    if (event.persisted) return;
    observer.disconnect();
    cancelAnimationFrame(fitFrame);
    fitFrame = 0;
    window.removeEventListener('resize', scheduleFitStage);
    window.visualViewport?.removeEventListener('resize', scheduleFitStage);
    window.removeEventListener('pagehide', cleanup);
  };
  window.addEventListener('pagehide', cleanup);
}

function fitStage() {
  const panel = document.querySelector('.stage-panel') as HTMLElement | null;
  if (!panel) return;
  const shell = $('stage-shell');
  const help = document.querySelector('.stage-help') as HTMLElement | null;
  const style = getComputedStyle(panel);
  const availableWidth = Math.max(
    1,
    panel.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2,
  );
  const availableHeight = Math.max(
    1,
    panel.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom) -
      (help?.offsetHeight || 0) -
      2,
  );
  const scale = Math.min(
    1,
    availableWidth / state.designWidth,
    availableHeight / state.designHeight,
  );
  // Resize the container, not the managed Retina canvas. Laya owns its backing
  // dimensions, native CSS transform and corresponding input transform.
  shell.style.width = `${Math.max(1, state.designWidth * scale)}px`;
  shell.style.height = `${Math.max(1, state.designHeight * scale)}px`;
  state.context?.resize();
  updateSelectionBox();
}

function stageToOverlay(point: Laya.Point) {
  const canvas = state.context.canvas.getBoundingClientRect();
  const shell = $('stage-shell');
  const origin = shell.getBoundingClientRect();
  return {
    x:
      canvas.left -
      origin.left -
      shell.clientLeft +
      (point.x * canvas.width) / state.context.stage.width,
    y:
      canvas.top -
      origin.top -
      shell.clientTop +
      (point.y * canvas.height) / state.context.stage.height,
  };
}

function updateSelectionBox() {
  const box = $('selection-box');
  const anchor = $('anchor-marker');
  const live = runtimeNode(state.selectedId);
  if (state.preview || !live || !state.context) {
    box.style.display = 'none';
    anchor.style.display = 'none';
    return;
  }
  const project = (x: number, y: number) =>
    stageToOverlay(live.localToGlobal(new Laya.Point(x, y)));
  const origin = project(0, 0),
    xAxis = project(1, 0),
    yAxis = project(0, 1);
  // Three transformed points retain rotation, reflection, pivots and every
  // ancestor transform. A local x/y rectangle cannot represent nested bounds.
  box.style.display = 'block';
  box.style.left = '0px';
  box.style.top = '0px';
  box.style.width = `${Math.max(0, live.width)}px`;
  box.style.height = `${Math.max(0, live.height)}px`;
  box.style.transformOrigin = '0 0';
  box.style.transform = `matrix(${xAxis.x - origin.x},${xAxis.y - origin.y},${yAxis.x - origin.x},${yAxis.y - origin.y},${origin.x},${origin.y})`;
  const pivot = project(live.pivotX, live.pivotY);
  anchor.style.display = 'block';
  anchor.style.left = `${pivot.x}px`;
  anchor.style.top = `${pivot.y}px`;
}

function pointerInParent(event: PointerEvent, node: any): Laya.Point | undefined {
  const rect = state.context.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const point = new Laya.Point(
    ((event.clientX - rect.left) * state.context.stage.width) / rect.width,
    ((event.clientY - rect.top) * state.context.stage.height) / rect.height,
  );
  const local = node.parent.globalToLocal(point);
  // A zero-scale ancestor has no inverse; ignore the gesture without writing NaN.
  if (Number.isFinite(local.x) && Number.isFinite(local.y)) return local;
}

function finishDrag(commit: boolean) {
  const drag = state.drag;
  if (!drag) return;
  state.drag = undefined;
  if (!commit) {
    const data = findData(drag.id),
      live = runtimeNode(drag.id);
    if (data && live) {
      for (const key of ['x', 'y']) {
        if (Object.hasOwn(drag.before, key)) data[key] = drag.before[key];
        else delete data[key];
      }
      live.x = drag.x;
      live.y = drag.y;
    }
  } else recordHistory();
  if (drag.canvas.hasPointerCapture(drag.pointerId))
    drag.canvas.releasePointerCapture(drag.pointerId);
  updateDirtyFromSource();
  renderInspector();
  updateSelectionBox();
}

async function rebuild() {
  finishDrag(false);
  if (!state.data || !state.context) return;
  const serial = ++state.loadSerial;
  if (state.root) {
    state.root.destroy?.(true);
    state.root = null;
  }
  const preview = clone(state.data);
  const urls = rewriteAssets(preview);
  await preloadTextures(urls);
  if (serial !== state.loadSerial) return;
  state.root = ZhudaPrefab.instantiate(preview, state.context.rootScene);
  indexRuntime(state.root, state.data);
  ZhudaEngine.flushRenderFrames(4);
  renderTree();
  renderInspector();
  fitStage();
}

async function loadFromServer(resetHistory = true) {
  if (state.preview) return;
  state.ready = false;
  updatePreviewUI();
  finishDrag(false);
  clearError();
  const requested =
    new URLSearchParams(window.location.search).get('prefab') ||
    new URLSearchParams(window.location.search).get('asset');
  const endpoint = requested
    ? `/api/prefab?prefab=${encodeURIComponent(requested)}`
    : '/api/prefab';
  const response = await editorFetch(endpoint, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw Error(payload.error || 'Unable to load Prefab');
  const data = payload.prefab as JsonObject;
  state.data = data;
  state.revision = payload.revision;
  state.assetPath = payload.path;
  state.selectedId = data._$id;
  state.savedData = clone(data);
  const meta = data._zhudaMeta;
  const canvas = meta?.designCanvas;
  const width = Number(canvas?.width ?? data.width ?? 800);
  const height = Number(canvas?.height ?? data.height ?? 600);
  state.designWidth = Number.isFinite(width) && width > 0 ? width : 800;
  state.designHeight = Number.isFinite(height) && height > 0 ? height : 600;
  const metaLabel = meta?.assetId && meta.assetId !== payload.path ? ` · ${meta.assetId}` : '';
  ($('path') as HTMLElement).textContent =
    `${payload.path}${metaLabel} · ${canvas?.width || data.width || 800}×${canvas?.height || data.height || 600}`;
  if (resetHistory) {
    state.history = [clone(data)];
    state.historyIndex = 0;
    setDirty(false);
  }
  if (state.context) {
    await rebuild();
    state.ready = true;
    updatePreviewUI();
  }
  updateHistoryButtons();
}

async function saveToServer() {
  if (state.preview) return;
  finishDrag(true);
  if (!state.data) return;
  clearError();
  setStatus('Saving…');
  const response = await editorFetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: state.assetPath,
      baseRevision: state.revision,
      prefab: state.data,
    }),
  });
  const payload = await response.json();
  if (response.status === 409)
    throw Error(`${payload.error}\nReload first to avoid overwriting another artist's changes.`);
  if (!response.ok) throw Error(payload.error || 'Save failed');
  state.revision = payload.revision;
  state.savedData = clone(state.data);
  state.history[state.historyIndex] = clone(state.data);
  setDirty(false);
  setStatus(payload.saved ? `Saved · backup ${payload.backup}` : 'Saved');
}

async function moveHistory(delta: number) {
  if (state.preview) return;
  finishDrag(false);
  const next = state.historyIndex + delta;
  if (next < 0 || next >= state.history.length) return;
  state.historyIndex = next;
  state.data = clone(state.history[next]);
  state.selectedId = state.data._$id;
  await rebuild();
  updateDirtyFromSource();
  updateHistoryButtons();
}

function installDrag() {
  document.addEventListener('pointerdown', (event) => {
    const canvas = state.context?.canvas as HTMLCanvasElement | undefined;
    const node = runtimeNode(state.selectedId),
      before = findData(state.selectedId);
    if (
      state.preview ||
      state.drag ||
      event.button !== 0 ||
      !canvas ||
      event.target !== canvas ||
      !node?.parent ||
      !before
    )
      return;
    const start = pointerInParent(event, node);
    if (!start) return;
    state.drag = {
      id: state.selectedId,
      pointerId: event.pointerId,
      canvas,
      start,
      before: clone(before),
      x: node.x,
      y: node.y,
    };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  document.addEventListener('pointermove', (event) => {
    const drag = state.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const data = findData(drag.id),
      node = runtimeNode(drag.id);
    if (!data || !node?.parent) return;
    const point = pointerInParent(event, node);
    if (!point) return;
    data.x = drag.x + point.x - drag.start.x;
    data.y = drag.y + point.y - drag.start.y;
    node.x = data.x;
    node.y = data.y;
    updateSelectionBox();
    renderInspector();
    updateDirtyFromSource();
  });
  document.addEventListener('pointerup', (event) => {
    if (event.pointerId === state.drag?.pointerId) finishDrag(true);
  });
  document.addEventListener('pointercancel', (event) => {
    if (event.pointerId === state.drag?.pointerId) finishDrag(false);
  });
  document.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === state.drag?.pointerId) finishDrag(false);
  });
  window.addEventListener('blur', () => finishDrag(false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) finishDrag(false);
  });
}

const editingHelp = document.querySelector('.stage-help')?.textContent || '';

function updatePreviewUI() {
  const playing = Boolean(state.preview);
  document.body.classList.toggle('play-mode', playing);
  const button = $('play') as HTMLButtonElement;
  button.disabled = !state.ready || !state.context || !state.previewConfig;
  button.textContent = playing ? '■ Stop' : '▶ Play';
  button.title = state.previewConfig
    ? 'Run interactive preview; Stop restores your edits'
    : 'No interactive preview controller configured for this project';
  button.setAttribute('aria-pressed', String(playing));
  const help = document.querySelector('.stage-help');
  if (help)
    help.textContent = playing
      ? 'Play：操作預覽中的控制項。Stop 後還原編輯狀態，互動變更不會寫入原始資產。'
      : editingHelp;
  updateHistoryButtons();
  renderInspector();
  updateSelectionBox();
}

async function loadPreviewConfig() {
  const response = await editorFetch('/api/editor', { cache: 'no-store' });
  const config = await response.json();
  if (!response.ok) throw Error(config.error || 'Unable to load preview configuration');
  state.previewConfig = config.previewController
    ? { url: config.previewController.url, timeoutMs: config.previewTimeoutMs }
    : undefined;
  updatePreviewUI();
}

async function stopPreview(rebuildRoot = true) {
  const session = state.preview;
  if (!session) return;
  state.preview = undefined;
  session.dispose();
  ++state.loadSerial;
  if (rebuildRoot) await rebuild();
  if (!state.preview) {
    updatePreviewUI();
    updateDirtyFromSource();
  }
  if (session.errors.length)
    showError(Error(`Preview cleanup failed: ${session.errors.map(String).join('; ')}`));
}

async function startPreview() {
  if (!state.ready || state.preview || !state.previewConfig || !state.context || !state.data)
    return;
  finishDrag(false);
  clearError();
  const session = new PrefabEditorPreviewSession();
  const config = state.previewConfig,
    assetPath = state.assetPath;
  state.preview = session;
  updatePreviewUI();
  setStatus('Starting preview…');
  try {
    await rebuild();
    const root = state.root;
    await session.mount(async () => {
      const module: ZhudaPrefabEditorPreviewModule = await import(config.url);
      if (session.signal.aborted) throw session.signal.reason;
      if (typeof module.mount !== 'function')
        throw Error('Preview controller must export mount(context)');
      const context = session.context({
        root,
        assetPath,
        canvas: state.context.canvas,
        stage: state.context.stage,
        runtime: state.context.runtime,
        assetUrl: encodedProjectUrl,
      });
      return module.mount(context);
    }, config.timeoutMs);
    if (state.preview === session) setStatus('Play · interactive preview');
  } catch (error) {
    if (state.preview !== session) return;
    await stopPreview();
    showError(error);
  }
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
    if (agent) next.delete('view');
    else next.set('view', 'agent');
    history.replaceState(null, '', `${location.pathname}${next.toString() ? `?${next}` : ''}`);
    applyAgentView();
    scheduleFitStage();
  };
}

async function boot() {
  try {
    // Read the static asset first so .ls Scenes boot at their authored design
    // size instead of being clipped into the Prefab editor's old 800×600 box.
    await loadFromServer(true);
    fitStage();
    state.context = await ZhudaEngine.boot({
      container: '#stage',
      width: state.designWidth,
      height: state.designHeight,
      designSize: { width: state.designWidth, height: state.designHeight },
      dprCap: Math.min(window.devicePixelRatio || 1, 2),
      features: [...PREFAB_EDITOR_FEATURES],
      renderer: 'webgl',
      bgColor: '#0b1220',
      onResize: () => updateSelectionBox(),
    });
    applyAgentView();
    installResponsiveLayout();
    installDrag();
    await loadAssets();
    await loadPreviewConfig();
    await rebuild();
    state.ready = true;
    updatePreviewUI();
    scheduleFitStage();
    setStatus('Saved');
  } catch (error) {
    showError(error);
  }
}

$('play').addEventListener(
  'click',
  () => void (state.preview ? stopPreview() : startPreview()).catch(showError),
);
let restoreAfterPageShow = false;
window.addEventListener('pagehide', () => {
  if (state.preview) {
    restoreAfterPageShow = true;
    void stopPreview(false);
  }
});
window.addEventListener('pageshow', () => {
  if (restoreAfterPageShow) {
    restoreAfterPageShow = false;
    void rebuild()
      .then(() => {
        updatePreviewUI();
        updateDirtyFromSource();
      })
      .catch(showError);
  }
});
$('save').addEventListener('click', () => void saveToServer().catch(showError));
$('reload').addEventListener('click', () => void loadFromServer(true).catch(showError));
$('undo').addEventListener('click', () => void moveHistory(-1).catch(showError));
$('redo').addEventListener('click', () => void moveHistory(1).catch(showError));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.preview) {
    event.preventDefault();
    void stopPreview().catch(showError);
    return;
  }
  if (state.preview) {
    if ((event.ctrlKey || event.metaKey) && ['s', 'z', 'y'].includes(event.key.toLowerCase()))
      event.preventDefault();
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === 's') {
    event.preventDefault();
    void saveToServer().catch(showError);
  }
  if (event.key.toLowerCase() === 'z') {
    event.preventDefault();
    void moveHistory(event.shiftKey ? 1 : -1).catch(showError);
  }
  if (event.key.toLowerCase() === 'y') {
    event.preventDefault();
    void moveHistory(1).catch(showError);
  }
});
applyAgentView();
void boot();
