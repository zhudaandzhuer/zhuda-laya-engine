#!/usr/bin/env node
import { cliMain } from './cli.mjs';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { scanProjectAssets } from './prefab-editor-server.mjs';
import {
  realPath,
  inside,
  resolveProjectFile,
  createEditorAccess,
  respondStatic,
  scriptJson,
} from './editor-http.mjs';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultEngineRoot = path.resolve(moduleDir, '..', '..');

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

export function parseModelEditorArgs(argv = process.argv.slice(2)) {
  const read = (name, fallback) => {
    const index = argv.indexOf(name);
    return index === -1 ? fallback : argv[index + 1];
  };
  const project = path.resolve(read('--project', process.cwd()));
  const asset = read('--asset', read('--prefab'));
  const host = read('--host', '127.0.0.1');
  const port = Number(read('--port', '8892'));
  const engineRoot = path.resolve(read('--engine-root', defaultEngineRoot));
  if (
    !asset ||
    asset.startsWith('/') ||
    asset.includes('\\') ||
    asset.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw Error('Use --asset with a project-relative assets/**/*.glb or assets/**/*.gltf path');
  if (!/^assets\/.+\.(?:glb|gltf)$/i.test(asset))
    throw Error('--asset must point to a project-relative .glb or .gltf file inside assets/');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid --port');
  if (!host || host.includes('/') || host.includes(':')) throw Error('Invalid --host');
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory())
    throw Error(`Project does not exist: ${project}`);
  return { project, projectRoot: project, asset, prefab: asset, host, port, engineRoot };
}

function resolveModelFile(project, requested, fallback) {
  const relative = typeof requested === 'string' && requested ? requested : fallback;
  if (!/^assets\/.+\.(?:glb|gltf)$/i.test(relative))
    throw Error('Selected asset must be an assets/**/*.glb or assets/**/*.gltf file');
  const file = resolveProjectFile(project, relative, { mustExist: true });
  const assetsRoot = realPath(path.join(project, 'assets'));
  if (!inside(assetsRoot, realPath(file))) throw Error('Model must remain inside project assets');
  return { file, path: relative.replace(/\\/g, '/') };
}

function html(engineFiles, assetPath, token) {
  const tags = engineFiles
    .map((file) => `<script src="/__editor/engine/${file}"></script>`)
    .join('\n');
  const css = `
:root{color-scheme:dark;--bg:#080f1c;--panel:#101a2c;--line:#263858;--text:#e8f1ff;--muted:#8ea5c9;--accent:#73e4d8;--warn:#ffd166;--danger:#ff8f9c}
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:var(--bg);color:var(--text);font:13px/1.4 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button{font:inherit;color:inherit;background:#0b1425;border:1px solid var(--line);border-radius:7px;padding:7px 9px;cursor:pointer}button:hover{border-color:var(--accent)}button:disabled{opacity:.45;cursor:not-allowed}
.top{height:54px;display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line);background:#0c1628}.top h1{margin:0 12px 0 0;color:var(--accent);font-size:15px;white-space:nowrap}.path{flex:1;min-width:0;overflow:hidden;color:var(--muted);font:11px ui-monospace,SFMono-Regular,Menlo,monospace;text-overflow:ellipsis;white-space:nowrap}.mode{display:flex;gap:4px}.mode button{padding:6px 8px;color:var(--muted);font-size:11px}.mode button.active{color:#07131e;background:var(--accent);border-color:var(--accent)}.status{min-width:130px;text-align:right;color:var(--muted);font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.status.error{color:var(--danger)}.status.busy{color:var(--warn)}
.layout{height:calc(100vh - 54px);display:grid;grid-template-columns:minmax(190px,22vw) minmax(300px,1fr) minmax(270px,27vw);grid-template-rows:minmax(0,1fr) minmax(150px,22vh);gap:10px;padding:10px}.panel{min-height:0;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px}.panel h2{margin:0;padding:11px 12px;border-bottom:1px solid var(--line);color:var(--accent);font-size:12px;letter-spacing:.12em}.tree{padding:8px}.tree details{margin:0}.tree summary{padding:6px 8px;border-radius:6px;cursor:pointer;list-style-position:inside;color:#cbd9ee;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tree summary:hover{background:#182944}.tree summary.selected{color:#07131e;background:var(--accent)}.tree-children{margin-left:10px;padding-left:10px;border-left:1px solid #2a3d5d}.note{margin:10px 12px;padding:9px;border:1px solid #304566;border-radius:7px;color:var(--muted);font-size:11px;white-space:pre-wrap}.note strong{color:var(--text)}code{color:#9be9df}.stage-panel{display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:12px;background:repeating-linear-gradient(0deg,transparent 0 39px,#172844 40px),repeating-linear-gradient(90deg,transparent 0 39px,#172844 40px),#0a1425}#stage{width:100%;height:100%}.stage-shell{position:relative;flex:0 0 auto;width:min(100%,720px);aspect-ratio:3/2;border:1px solid #38527a;border-radius:8px;overflow:hidden;background:#07101e;box-shadow:0 14px 36px #0009}.stage-shell canvas{display:block;width:100%;height:100%;touch-action:none}.stage-help{width:min(720px,100%);padding:9px 4px 0;color:var(--muted);font-size:11px;text-align:center}.inspector{padding-bottom:12px}.metric-row{display:grid;grid-template-columns:82px minmax(0,1fr);gap:8px;padding:6px 12px;border-bottom:1px solid #1c2a44;font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.metric-row span{color:var(--muted)}.metric-row strong{overflow-wrap:anywhere;text-align:right;font-weight:500}.inspector-actions{display:flex;gap:7px;padding:10px 12px}.diagnostics{color:#ffcf9a}.error{margin:10px 12px;color:var(--danger);white-space:pre-wrap}.empty{padding:14px;color:var(--muted)}
.asset-panel{grid-column:1/-1;grid-row:2;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.asset-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.asset-head h2{border:0}.asset-count{padding:0 12px;color:var(--muted);font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.asset-body{display:grid;grid-template-columns:minmax(170px,22%) minmax(0,1fr);min-height:0}.asset-folders{padding:6px;overflow:auto;border-right:1px solid var(--line)}.asset-folder{display:block;width:100%;border:0;padding:6px 8px;color:var(--muted);background:transparent;text-align:left;font:11px ui-monospace,SFMono-Regular,Menlo,monospace}.asset-folder:hover,.asset-folder.selected{background:#16434c;color:#fff}.asset-files{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));align-content:start;gap:7px;padding:7px;overflow:auto}.asset-card{display:grid;grid-template-columns:30px minmax(0,1fr);gap:7px;align-items:center;min-width:0;padding:6px;text-align:left}.asset-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:5px;background:#182743;color:var(--accent);font:700 10px ui-monospace,SFMono-Regular,Menlo,monospace}.asset-icon.model{color:var(--warn);background:#2b2a1b}.asset-meta{min-width:0}.asset-name,.asset-detail{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.asset-name{font-size:11px}.asset-detail{margin-top:2px;color:var(--muted);font:10px ui-monospace,SFMono-Regular,Menlo,monospace}.asset-empty{grid-column:1/-1;align-self:center;justify-self:center;color:var(--muted)}.agent-view .layout{grid-template-columns:1fr}.agent-view .layout>.panel:not(.stage-panel){display:none}.agent-view .stage-panel{padding:10px}.agent-view .stage-help{display:none}.agent-view .top .path{display:none}.agent-view .top h1{margin-right:auto}
@media(max-width:900px){.layout{grid-template-columns:minmax(170px,24vw) minmax(260px,1fr) minmax(230px,28vw);gap:6px;padding:6px}.path{display:none}.top{gap:4px}.mode{gap:2px}.mode button{padding:5px 6px}.status{min-width:0}}
@media(max-width:700px){body{overflow:auto}.top{height:auto;min-height:54px;flex-wrap:wrap}.status{margin-left:auto}.layout{height:auto;min-height:calc(100vh - 54px);display:flex;flex-direction:column}.stage-panel{order:-1;height:56vh;min-height:280px}.panel:not(.stage-panel){max-height:32vh}.asset-panel{order:4;min-height:190px;height:190px}.agent-view .layout{min-height:calc(100vh - 54px)}.agent-view .stage-panel{height:calc(100vh - 74px);min-height:0}.asset-body{grid-template-columns:130px minmax(0,1fr)}}`;
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zhuda 3D Model Editor</title><style>${css}</style></head><body><header class="top"><h1>豬大 3D Model Editor</h1><div id="path" class="path">Loading…</div><div class="mode"><button id="mode-raw" type="button">Raw</button><button id="mode-gameplay" type="button">Gameplay</button><button id="mode-cinematic" type="button">Cinematic</button></div><button id="agent-view" type="button">Agent View</button><button id="copy" type="button">COPY</button><button id="reload" type="button">Reload</button><button id="dispose" type="button">Dispose</button><div id="status" class="status">Loading…</div></header><main class="layout"><section class="panel"><h2>3D HIERARCHY</h2><div id="tree" class="tree"></div><div class="note">模型階層來自真正的 Laya Sprite3D。點節點查看 mesh、材質、morph 與 active 狀態；Isolate 只改預覽可見性，不寫回模型。</div></section><section id="stage-panel" class="panel stage-panel"><div id="stage-shell" class="stage-shell"><div id="stage"></div></div><div class="stage-help">拖曳預覽旋轉模型，滾輪縮放。Raw／Gameplay／Cinematic 使用同一個 ModelInstance；網格只是預覽定位輔助，不是模型內容。</div></section><section class="panel inspector"><h2>3D INSPECTOR</h2><div id="inspector"><div class="empty">載入模型中…</div></div><div id="error" class="error" role="alert"></div></section><section class="panel asset-panel" aria-label="Project Assets"><div class="asset-head"><h2>ASSETS</h2><span id="asset-count" class="asset-count">Loading…</span></div><div class="asset-body"><nav id="asset-folders" class="asset-folders" aria-label="Asset folders"></nav><section id="asset-files" class="asset-files" aria-label="Asset files"></section></div></section></main><script>window.__ZHUDA_EDITOR_TOKEN__=${scriptJson(token)};window.__ZHUDA_MODEL_ASSET__=${scriptJson(assetPath)};</script>${tags}<script type="module" src="/__editor/model.js"></script></body></html>`;
}

export async function buildModelEditorBundle({ engineRoot = defaultEngineRoot } = {}) {
  engineRoot = path.resolve(engineRoot);
  const entry = path.join(engineRoot, 'packages', 'compiler', 'model-editor-client.ts');
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    write: false,
    sourcemap: 'inline',
    absWorkingDir: engineRoot,
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

export async function createModelEditorServer({
  projectRoot,
  asset,
  prefab,
  engineRoot = defaultEngineRoot,
  host = '127.0.0.1',
  port = 8892,
  bundle,
} = {}) {
  const project = realPath(projectRoot || process.cwd());
  const initialSelection = resolveModelFile(
    project,
    String(asset || prefab || ''),
    String(asset || prefab || ''),
  );
  const engine = realPath(engineRoot);
  const engineLibRoot = path.join(engine, 'vendor', 'laya-3.4.2', 'libs');
  const engineFiles = [
    'laya.core.js',
    'laya.d3.js',
    'laya.webgl_2D.js',
    'laya.webgl_3D.js',
    'laya.ui.js',
    'laya.gltf.js',
    'laya.postProcess.js',
  ];
  for (const file of engineFiles)
    if (!fs.existsSync(path.join(engineLibRoot, file)))
      throw Error(`Missing pinned engine library: ${file}`);
  const editorBundle = bundle ?? (await buildModelEditorBundle({ engineRoot: engine }));
  const access = createEditorAccess(host);
  const server = http.createServer(async (request, response) => {
    try {
      const url = access.validate(request, response);
      if (url.pathname === '/api/assets' && request.method === 'GET') {
        response.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(JSON.stringify({ root: 'assets', entries: await scanProjectAssets(project) }));
        return;
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        const selection = resolveModelFile(
          project,
          url.searchParams.get('asset') || url.searchParams.get('model') || initialSelection.path,
          initialSelection.path,
        );
        const bytes = await fsp.readFile(selection.file);
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Zhuda-Asset-SHA256': sha256(bytes),
        });
        response.end(html(engineFiles, selection.path, access.token));
        return;
      }
      if (url.pathname === '/__editor/model.js') {
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
      if (!response.headersSent) {
        response.writeHead(error.status || 400, {
          'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(
          JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        );
      } else response.destroy();
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
    assetFile: initialSelection.file,
    engineRoot: engine,
  };
}

const launched = cliMain(
  import.meta.url,
  'Usage: zhuda-model-editor --project DIRECTORY --asset assets/FILE.glb [--host HOST] [--port PORT]',
);
if (launched) {
  try {
    const args = parseModelEditorArgs();
    const editor = await createModelEditorServer(args);
    const address = await editor.listening;
    console.log(
      `[Zhuda 3D Model Editor] http://${args.host}:${address.port}/?asset=${encodeURIComponent(args.asset)}`,
    );
    console.log(`[Zhuda 3D Model Editor] editing ${args.asset}`);
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
