import { cliMain } from './cli.mjs';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import {
  realPath,
  inside,
  resolveProjectFile,
  createEditorAccess,
  respondStatic,
  publicAssetPath,
  scriptJson,
} from './editor-http.mjs';
export { resolveProjectFile } from './editor-http.mjs';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultEngineRoot = path.resolve(moduleDir, '..', '..');

// The static editor is intentionally a 2D-only profile. Keep this contract in
// one place so a future editor change cannot accidentally pull the 3D/GLTF
// renderer into every artist preview.
export const PREFAB_EDITOR_ENGINE_FILES = Object.freeze([
  'laya.core.js',
  'laya.webgl_2D.js',
  'laya.ui.js',
]);
export const PREFAB_EDITOR_FEATURES = Object.freeze(['core', '2d', 'ui']);
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const SUPPORTED_NODE_TYPES = new Set(['Sprite', 'Text', 'Label', 'Image', 'Box', 'Scene']);

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export function parsePrefabEditorArgs(argv = process.argv.slice(2)) {
  const read = (name, fallback) => {
    const index = argv.indexOf(name);
    return index === -1 ? fallback : argv[index + 1];
  };
  const project = path.resolve(read('--project', process.cwd()));
  const prefab = read('--prefab');
  const host = read('--host', '127.0.0.1');
  const port = Number(read('--port', '8891'));
  const engineRoot = path.resolve(read('--engine-root', defaultEngineRoot));
  const previewController = read('--preview-controller');
  if (
    argv.includes('--preview-controller') &&
    (!previewController || previewController.startsWith('--'))
  )
    throw Error('--preview-controller needs a project-relative module path');
  if (
    !prefab ||
    prefab.startsWith('/') ||
    prefab.includes('\\') ||
    prefab.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw Error(
      'Use --prefab with a project-relative .lh or .ls path (for example assets/prefabs/rocket.lh)',
    );
  }
  if (!/\.(?:lh|ls)$/i.test(prefab)) throw Error('--prefab must point to a .lh or .ls file');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid --port');
  if (!host || host.includes('/') || host.includes(':')) throw Error('Invalid --host');
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory())
    throw Error(`Project does not exist: ${project}`);
  return { project, projectRoot: project, prefab, host, port, engineRoot, previewController };
}

function validateNumber(value, label) {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value)))
    throw Error(`${label} must be a finite number`);
}

function validateAnchor(value, label) {
  validateNumber(value, label);
  if (value !== undefined && (value < 0 || value > 1))
    throw Error(`${label} must be between 0 and 1`);
}

export function validatePrefabHierarchy(value) {
  const errors = [];
  const ids = new Set();
  const visit = (node, nodePath, root = false) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      errors.push(`${nodePath}: node must be an object`);
      return;
    }
    if (typeof node._$id !== 'string' || !node._$id) errors.push(`${nodePath}: _$id is required`);
    else if (ids.has(node._$id)) errors.push(`${nodePath}: _$id must be unique (${node._$id})`);
    else ids.add(node._$id);
    if (typeof node._$type !== 'string' || !SUPPORTED_NODE_TYPES.has(node._$type))
      errors.push(`${nodePath}: unsupported _$type ${String(node._$type)}`);
    if (node.name !== undefined && (typeof node.name !== 'string' || node.name.includes('/')))
      errors.push(`${nodePath}: name must be a slash-free string`);
    for (const key of [
      'x',
      'y',
      'width',
      'height',
      'pivotX',
      'pivotY',
      'scaleX',
      'scaleY',
      'rotation',
      'alpha',
      'fontSize',
      'leading',
      'stroke',
    ])
      validateNumber(node[key], `${nodePath}.${key}`);
    for (const key of ['anchorX', 'anchorY']) validateAnchor(node[key], `${nodePath}.${key}`);
    for (const key of ['visible', 'mouseEnabled', 'bold'])
      if (node[key] !== undefined && typeof node[key] !== 'boolean')
        errors.push(`${nodePath}.${key} must be boolean`);
    for (const key of [
      'text',
      'font',
      'color',
      'align',
      'valign',
      'skin',
      'sizeGrid',
      'strokeColor',
    ])
      if (node[key] !== undefined && typeof node[key] !== 'string')
        errors.push(`${nodePath}.${key} must be a string`);
    if (node._$child !== undefined && !Array.isArray(node._$child))
      errors.push(`${nodePath}._$child must be an array`);
    const names = new Set();
    for (const [index, child] of (node._$child || []).entries()) {
      const name = child && typeof child.name === 'string' ? child.name : '';
      if (!name || names.has(name))
        errors.push(`${nodePath}: child names must be unique and non-empty`);
      names.add(name);
      visit(child, `${nodePath}/${name || index}`);
    }
    if (node._gcmds !== undefined && !Array.isArray(node._gcmds))
      errors.push(`${nodePath}._gcmds must be an array`);
    if (root && node._$type === 'Scene' && typeof node.width !== 'number')
      errors.push('root Scene needs a finite width');
  };
  visit(value, 'root', true);
  if (errors.length)
    throw Error(`Invalid Prefab hierarchy:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  return value;
}

async function readJson(file) {
  let bytes;
  try {
    bytes = await fsp.readFile(file);
  } catch (error) {
    throw Error(`Unable to read Prefab: ${error.message}`);
  }
  if (bytes.length > MAX_BODY_BYTES) throw Error('Prefab exceeds the editor size limit');
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw Error(`Invalid Prefab JSON: ${error.message}`);
  }
  validatePrefabHierarchy(value);
  return { value, bytes };
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Error('Request body exceeds the editor size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function json(response, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
  });
  response.end(body);
}

const assetKind = (file) => {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.lh') return 'prefab';
  if (extension === '.ls') return 'scene';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) return 'image';
  if (['.mp3', '.wav', '.ogg', '.m4a'].includes(extension)) return 'audio';
  if (['.glb', '.gltf', '.fbx', '.obj'].includes(extension)) return 'model';
  if (['.json', '.txt', '.csv', '.atlas', '.skel', '.css', '.ts', '.js'].includes(extension))
    return 'text';
  return 'file';
};

/**
 * Return metadata for the consumer's assets/ tree without exposing files
 * outside that tree. The editor uses this as its Project/Assets panel; the
 * actual preview still goes through the existing /__project static route.
 */
export async function scanProjectAssets(projectRoot) {
  const project = realPath(projectRoot);
  const assetsRoot = path.join(project, 'assets');
  if (!fs.existsSync(assetsRoot)) return [];
  const root = realPath(assetsRoot);
  if (!inside(project, root)) throw Error('Asset root escapes project');
  const files = [];
  const visited = new Set();
  const visit = async (directory) => {
    if (visited.has(directory)) return;
    visited.add(directory);
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!publicAssetPath(entry.name)) continue;
      const candidate = path.join(directory, entry.name);
      const resolved = realPath(candidate);
      if (!inside(root, resolved))
        throw Error(`Asset symlink escapes project assets: ${path.relative(project, candidate)}`);
      if (!publicAssetPath(path.relative(project, resolved))) continue;
      const stat = await fsp.stat(resolved);
      if (stat.isDirectory()) await visit(resolved);
      else if (stat.isFile()) {
        const relative = path.relative(project, resolved).split(path.sep).join('/');
        files.push({
          path: relative,
          kind: assetKind(relative),
          bytes: stat.size,
          sha256: await sha256File(resolved),
        });
      }
    }
  };
  await visit(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function selectedPrefabPath(project, urlOrPath, fallback) {
  const requested =
    typeof urlOrPath === 'string'
      ? urlOrPath
      : urlOrPath.searchParams.get('prefab') || urlOrPath.searchParams.get('asset') || fallback;
  if (!requested || !/\.(?:lh|ls)$/i.test(requested))
    throw Error('Selected asset must be a project-relative .lh or .ls file');
  const file = resolveProjectFile(project, requested, { mustExist: true });
  return { file, path: path.relative(project, file).split(path.sep).join('/') };
}

function editorHtml(engineFiles, assetPath, token) {
  const tags = engineFiles
    .map((file) => `<script src="/__editor/engine/${file}"></script>`)
    .join('\n');
  const isScene = /\.ls$/i.test(assetPath);
  const assetLabel = isScene ? 'Scene' : 'Prefab';
  const css = `
:root{color-scheme:dark;--bg:#0b1020;--panel:#111a2c;--line:#263858;--text:#e6edf7;--muted:#9db0c9;--accent:#63d8cf;--danger:#ff8f9c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;width:100%;height:100vh;height:100dvh;min-width:0;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr);container-type:inline-size;container-name:editor}
button,input,select{font:inherit;color:inherit;background:#0c1424;border:1px solid var(--line);border-radius:6px;padding:7px 9px}button{cursor:pointer;white-space:nowrap}button:hover{border-color:var(--accent)}button:disabled{opacity:.45;cursor:not-allowed}
.top{min-height:54px;display:flex;flex-wrap:wrap;align-items:center;min-width:0;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line);background:#0e172a}.top h1{font-size:16px;margin:0 12px 0 0;color:var(--accent);min-width:0;max-width:100%;overflow-wrap:anywhere;flex:0 1 auto}.top .path{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 0;min-width:0}.top button{flex:0 0 auto;max-width:100%}.status{flex:1 1 130px;min-width:0;max-width:100%;overflow-wrap:anywhere;text-align:right;color:var(--muted)}.status.dirty{color:#ffd17a}.status.error{color:var(--danger)}.play-mode #play{border-color:var(--accent);color:var(--accent)}.play-mode #tree,.play-mode #asset-files{pointer-events:none;opacity:.6}.play-mode .selection-box,.play-mode .anchor-marker{display:none!important}
.layout{min-width:0;min-height:0;overflow:auto;display:grid;grid-template-columns:minmax(180px,22%) minmax(0,1fr) minmax(230px,25%);grid-template-rows:minmax(120px,1fr) minmax(120px,22%);gap:10px;padding:10px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:9px;min-width:0;min-height:0;overflow:auto}.panel h2{font-size:13px;color:var(--accent);margin:0;padding:12px;border-bottom:1px solid var(--line)}#tree{padding:8px}.tree-node{padding:6px 8px;margin:2px 0;border-radius:5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tree-node:hover{background:#192743}.tree-node.selected{background:#16434c;color:#fff}.tree-node .type{color:var(--muted);font-size:11px;margin-left:5px}
.stage-panel{container-type:size;container-name:stage;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:12px;background:repeating-conic-gradient(#121c30 0 25%,#0e1728 0 50%) 0/24px 24px}.stage-shell{box-sizing:content-box;position:relative;box-shadow:0 12px 35px #0008;border:1px solid #38527a;background:#0b1220;flex:0 0 auto}/* The runtime owns logical canvas sizing and the backing-to-CSS transform. */
#stage{position:relative;width:100%;height:100%;overflow:hidden}.stage-shell canvas{display:block;max-width:none;max-height:none}.selection-box{position:absolute;border:1px dashed var(--accent);pointer-events:none;display:none}.anchor-marker{position:absolute;width:13px;height:13px;transform:translate(-50%,-50%);border:1px solid #ffd166;border-radius:50%;box-shadow:0 0 0 3px #ffd16633;pointer-events:none;display:none;z-index:2}.anchor-marker::before,.anchor-marker::after{content:"";position:absolute;background:#ffd166}.anchor-marker::before{left:5px;top:-5px;width:1px;height:21px}.anchor-marker::after{left:-5px;top:5px;width:21px;height:1px}.anchor-marker span{position:absolute;left:12px;top:-17px;color:#ffd166;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}.stage-help{width:min(800px,100%);padding:8px;color:var(--muted);font-size:12px;text-align:center}.inspector{padding-bottom:18px}.inspector .empty{padding:14px;color:var(--muted)}.field{display:grid;grid-template-columns:1fr minmax(90px,1fr);gap:8px;align-items:center;padding:7px 12px}.field label{color:var(--muted);font-size:12px}.field input[type=checkbox]{justify-self:start;width:18px;height:18px}.field input,.field select{width:100%;min-width:0}.note{margin:10px 12px;padding:9px;border:1px solid #3d4d6d;border-radius:6px;color:var(--muted);font-size:12px;overflow-wrap:anywhere}.error{white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 12px;color:var(--danger)}code{color:#9be9df}
.asset-panel{grid-column:1/-1;grid-row:2;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.asset-panel h2{display:inline-block;border:0;padding:9px 12px}.asset-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);min-width:0}.asset-count{padding:0 12px;color:var(--muted);font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.asset-body{display:grid;grid-template-columns:minmax(0,26%) minmax(0,1fr);min-width:0;min-height:0}.asset-folders{padding:6px;overflow:auto;border-right:1px solid var(--line)}.asset-folder{display:block;width:100%;padding:6px 8px;border:0;border-radius:5px;background:transparent;color:var(--muted);text-align:left;cursor:pointer;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.asset-folder:hover,.asset-folder.selected{background:#16434c;color:#fff}.asset-folder .folder-icon{display:inline-block;width:16px;color:#ffd166}.asset-files{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(130px,100%),1fr));align-content:start;gap:7px;padding:7px;overflow:auto}.asset-card{display:grid;grid-template-columns:30px minmax(0,1fr);gap:7px;align-items:center;min-width:0;padding:6px;border:1px solid var(--line);border-radius:6px;background:#0c1424;color:var(--text);text-align:left;cursor:pointer}.asset-card:hover,.asset-card.selected{border-color:var(--accent);background:#16434c}.asset-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:5px;background:#182743;color:#ffd166;font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace}.asset-icon.prefab{color:#63d8cf}.asset-icon.image{color:#ffd166}.asset-icon.scene{color:#c49cff}.asset-icon.audio{color:#ff9ac0}.asset-meta{min-width:0}.asset-name,.asset-detail{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.asset-name{font-size:11px}.asset-detail{margin-top:2px;color:var(--muted);font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.asset-empty{grid-column:1/-1;align-self:center;justify-self:center;color:var(--muted);font-size:12px}
/* Query the editor's actual width as well as the browser viewport: it can be
   embedded in a split pane without an outer window resize. */
@container editor (max-width:1100px){.top h1{font-size:14px}.top .path{display:none}.layout{grid-template-columns:minmax(150px,22%) minmax(0,1fr) minmax(200px,25%);gap:6px;padding:6px}.stage-panel{padding:8px}.field{grid-template-columns:minmax(0,1fr)}}
@container editor (max-width:900px){.layout{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:max(120px,55%) max(180px,42dvh) max(160px,28dvh);overflow:auto;align-content:start}.layout>.panel:first-child{grid-column:1;grid-row:2}.stage-panel{grid-column:1/-1;grid-row:1}.inspector{grid-column:2;grid-row:2}.asset-panel{grid-column:1/-1;grid-row:3}.stage-help{display:none}.top{gap:6px;padding:6px 8px}.top button{padding:6px 8px}.status{font-size:12px}}
@container stage (max-height:180px){.stage-help{display:none}}
.agent-view .layout{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);overflow:hidden}.agent-view .layout>.panel:not(.stage-panel){display:none}.agent-view .stage-panel{grid-column:1;grid-row:1;padding:10px}.agent-view .stage-help{display:none}.agent-view .top .path{display:none}.agent-view .top h1{flex:1 1 180px;margin-right:0}

`;
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zhuda ${assetLabel} Editor</title><style>${css}</style></head><body><header class="top"><h1>豬大 ${assetLabel} Editor</h1><div class="path" id="path">Loading…</div><button id="play" disabled title="Loading preview controller">▶ Play</button><button id="agent-view" title="Fit the canvas for an agent screenshot">Agent View</button><button id="undo" title="Undo">↶ Undo</button><button id="redo" title="Redo">↷ Redo</button><button id="reload">Reload</button><button id="save">Save</button><div class="status" id="status">Loading…</div></header><main class="layout"><section class="panel"><h2>Hierarchy</h2><div id="tree"></div><div class="note">編輯目前選定的 ${assetPath.endsWith('.ls') ? '.ls Scene' : '.lh Prefab'}。預覽使用真正的 Zhuda/Laya runtime；拖曳座標以設計像素計算。</div></section><section class="panel stage-panel"><div class="stage-shell" id="stage-shell"><div id="stage"></div><div id="selection-box" class="selection-box"></div><div id="anchor-marker" class="anchor-marker"><span>anchor</span></div></div><div class="stage-help">拖曳選定節點移動位置。選取框會包住節點實際 bounds；黃色十字是 anchor/pivot。按 Save 寫回原始 ${assetPath.endsWith('.ls') ? '.ls' : '.lh'}，編輯器會先驗證並留下 .bak 備份。</div></section><section class="panel inspector"><h2>Inspector</h2><div id="inspector"><div class="empty">選擇一個節點開始編輯。</div></div><div id="error" class="error" role="alert"></div></section><section class="panel asset-panel" aria-label="Project Assets"><div class="asset-head"><h2>Assets</h2><span id="asset-count" class="asset-count">Loading…</span></div><div class="asset-body"><nav id="asset-folders" class="asset-folders" aria-label="Asset folders"></nav><section id="asset-files" class="asset-files" aria-label="Asset files"></section></div></section></main><script>window.__ZHUDA_EDITOR_TOKEN__=${scriptJson(token)};window.__ZHUDA_EDITOR_ENGINE_FILES__=${scriptJson(engineFiles)};</script>${tags}<script type="module" src="/__editor/editor.js"></script></body></html>`;
}

// Share the same public SDK module between the editor and consumer controller.
// No controller may import a second engine copy through a private subpath.
const previewSdkPlugin = {
  name: 'editor-public-sdk',
  setup(build) {
    build.onResolve({ filter: /^zhuda-laya-engine$/ }, () => ({
      path: '/__editor/sdk.js',
      external: true,
    }));
    build.onResolve({ filter: /^zhuda-laya-engine\// }, (args) => ({
      errors: [
        {
          text: `Preview controllers must import the public zhuda-laya-engine entry: ${args.path}`,
        },
      ],
    }));
  },
};

export async function buildPrefabEditorController({ projectRoot, previewController } = {}) {
  const project = realPath(projectRoot);
  const selected =
    previewController ??
    ['zhuda.editor.ts', 'zhuda.editor.mjs', 'zhuda.editor.js'].find((file) =>
      fs.existsSync(path.join(project, file)),
    ) ??
    null;
  if (!selected) return null;
  if (!/\.(?:ts|js|mjs)$/.test(selected))
    throw Error('Preview controller must be a project-relative .ts, .js or .mjs module');
  const entry = resolveProjectFile(project, selected, { mustExist: true });
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    write: false,
    sourcemap: 'inline',
    absWorkingDir: project,
    plugins: [previewSdkPlugin],
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  return {
    code,
    path: path.relative(project, entry).split(path.sep).join('/'),
    url: `/__editor/preview-controller.js?v=${sha256(code)}`,
  };
}

export async function buildPrefabEditorBundle({ engineRoot = defaultEngineRoot } = {}) {
  engineRoot = path.resolve(engineRoot);
  const candidate = path.join(engineRoot, 'packages', 'compiler', 'prefab-editor-client.ts');
  const entry = fs.existsSync(candidate)
    ? candidate
    : path.join(moduleDir, 'prefab-editor-client.ts');
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    write: false,
    sourcemap: 'inline',
    absWorkingDir: engineRoot,
    plugins: [previewSdkPlugin],
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

export async function createPrefabEditorServer({
  projectRoot,
  prefab,
  engineRoot = defaultEngineRoot,
  host = '127.0.0.1',
  port = 8891,
  historyLimit = 10,
  bundle,
  previewController,
  previewTimeoutMs = 15000,
} = {}) {
  const project = realPath(projectRoot || process.cwd());
  const initialSelection = selectedPrefabPath(project, String(prefab), String(prefab));
  const engine = realPath(engineRoot);
  const engineLibRoot = path.join(engine, 'vendor', 'laya-3.4.2', 'libs');
  const engineFiles = PREFAB_EDITOR_ENGINE_FILES;
  for (const file of engineFiles)
    if (!fs.existsSync(path.join(engineLibRoot, file)))
      throw Error(`Missing pinned engine library: ${file}`);
  const editorBundle = bundle ?? (await buildPrefabEditorBundle({ engineRoot: engine }));
  if (!Number.isSafeInteger(previewTimeoutMs) || previewTimeoutMs < 1 || previewTimeoutMs > 60000)
    throw Error('Invalid preview timeout');
  const controller = await buildPrefabEditorController({ projectRoot: project, previewController });
  const sdkFile = path.join(engine, 'dist', 'sdk', 'zhuda-laya-engine.esm.js');
  if (!fs.existsSync(sdkFile))
    throw Error('Editor SDK bundle missing; run npm run build in the engine');
  const initial = await readJson(initialSelection.file);
  let revision = sha256(initial.bytes);
  const history = [];
  const addHistory = (bytes) => {
    history.push(bytes);
    while (history.length > Math.max(1, historyLimit)) history.shift();
  };
  const access = createEditorAccess(host);
  const server = http.createServer(async (request, response) => {
    try {
      const url = access.validate(request, response);
      if (url.pathname === '/api/editor' && request.method === 'GET') {
        json(response, 200, {
          previewController: controller ? { path: controller.path, url: controller.url } : null,
          previewTimeoutMs,
        });
        return;
      }
      if (url.pathname === '/api/prefab' && request.method === 'GET') {
        const selection = selectedPrefabPath(project, url, initialSelection.path);
        const current = await readJson(selection.file);
        revision = sha256(current.bytes);
        json(response, 200, {
          prefab: current.value,
          revision,
          path: selection.path,
          backup: `${selection.path}.bak`,
        });
        return;
      }
      if (url.pathname === '/api/assets' && request.method === 'GET') {
        json(response, 200, { root: 'assets', entries: await scanProjectAssets(project) });
        return;
      }
      if (url.pathname === '/api/save' && request.method === 'POST') {
        const body = JSON.parse(await readRequestBody(request));
        if (
          !body ||
          typeof body !== 'object' ||
          typeof body.baseRevision !== 'string' ||
          !body.prefab
        )
          throw Error('Save requires baseRevision and prefab');
        const selection = selectedPrefabPath(
          project,
          typeof body.path === 'string' ? body.path : initialSelection.path,
          initialSelection.path,
        );
        const current = await readJson(selection.file);
        const currentRevision = sha256(current.bytes);
        if (body.baseRevision !== currentRevision) {
          json(response, 409, {
            error: 'Prefab changed on disk; reload before saving',
            revision: currentRevision,
          });
          return;
        }
        validatePrefabHierarchy(body.prefab);
        const nextBytes = Buffer.from(`${JSON.stringify(body.prefab, null, 2)}\n`);
        const nextRevision = sha256(nextBytes);
        if (nextRevision === currentRevision) {
          revision = currentRevision;
          json(response, 200, { saved: false, revision, path: selection.path });
          return;
        }
        addHistory(current.bytes);
        const backup = `${selection.file}.bak`;
        const temporary = `${selection.file}.tmp-${process.pid}-${Date.now()}`;
        await fsp.writeFile(backup, current.bytes, { flag: 'w' });
        const handle = await fsp.open(temporary, 'w');
        try {
          await handle.writeFile(nextBytes);
          await handle.sync();
        } finally {
          await handle.close();
        }
        await fsp.rename(temporary, selection.file);
        revision = nextRevision;
        json(response, 200, {
          saved: true,
          revision,
          path: selection.path,
          backup: path.relative(project, backup).split(path.sep).join('/'),
        });
        return;
      }
      if (url.pathname === '/api/history' && request.method === 'GET') {
        json(response, 200, { available: history.length, revision });
        return;
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        const selection = selectedPrefabPath(project, url, initialSelection.path);
        const html = editorHtml(engineFiles, selection.path, access.token);
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(html);
        return;
      }
      if (url.pathname === '/__editor/sdk.js') {
        await respondStatic(path.dirname(sdkFile), path.basename(sdkFile), response);
        return;
      }
      if (url.pathname === '/__editor/preview-controller.js' && controller) {
        response.writeHead(200, {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(controller.code);
        return;
      }
      if (url.pathname === '/__editor/editor.js') {
        response.writeHead(200, {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(editorBundle);
        return;
      }
      if (url.pathname.startsWith('/__editor/engine/')) {
        await respondStatic(
          engineLibRoot,
          url.pathname.slice('/__editor/engine/'.length),
          response,
        );
        return;
      }
      if (url.pathname.startsWith('/__project/')) {
        await respondStatic(project, url.pathname.slice('/__project/'.length), response, {
          projectAssets: true,
        });
        return;
      }
      response.writeHead(404);
      response.end('Not found');
    } catch (error) {
      if (!response.headersSent)
        json(response, error.status || 400, {
          error: error instanceof Error ? error.message : String(error),
        });
      else response.destroy();
    }
  });
  const listening = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server.address()));
  });
  const close = async () => {
    await new Promise((resolve) => server.close(() => resolve()));
  };
  return {
    server,
    listening,
    close,
    token: access.token,
    projectRoot: project,
    prefabFile: initialSelection.file,
    engineRoot: engine,
    revision: () => revision,
    history,
  };
}

const launched = cliMain(
  import.meta.url,
  'Usage: zhuda-prefab-editor --project DIRECTORY --prefab assets/FILE.lh [--host HOST] [--port PORT] [--preview-controller MODULE]',
);
if (launched) {
  try {
    const args = parsePrefabEditorArgs();
    const editor = await createPrefabEditorServer(args);
    const address = await editor.listening;
    console.log(`[Zhuda Prefab Editor] http://${args.host}:${address.port}/`);
    console.log(`[Zhuda Prefab Editor] editing ${args.prefab}`);
    const stop = async () => {
      await editor.close();
      process.exit(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
