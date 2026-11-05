import { app, BrowserWindow, protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {resolveBundleFile} from './bundle.mjs';

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: {
  standard: true, secure: true, supportFetchAPI: true, stream: true,
} }]);

// A packaged executable has no separate script argument (electron . does).
const args = new Set(process.argv.slice(app.isPackaged ? 1 : 2));
const root = app.isPackaged ? path.join(app.getAppPath(), 'web') : path.resolve(process.env.ZHUDA_WEB_ROOT || path.join(app.getAppPath(), 'web'));
const entry = (process.env.ZHUDA_ENTRY || 'index.html').replace(/^\/+/, '');
const out = path.resolve(process.env.ZHUDA_WINDOWS_WEBGPU_OUT || path.join(app.isPackaged ? app.getPath('userData') : process.cwd(), 'windows-webgpu-evidence'));

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json'], ['.wasm', 'application/wasm'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.svg', 'image/svg+xml'],
]);

async function serve(request) {
  try {
    const actual = resolveBundleFile(root, request.url);
    return new Response(fs.readFileSync(actual), { headers: { 'content-type': mime.get(path.extname(actual).toLowerCase()) || 'application/octet-stream', 'cache-control': 'no-store' } });
  } catch (error) {
    return new Response(String(error.message || error), { status: error.message === 'APP_PATH_ESCAPE' ? 403 : 404 });
  }
}

function reportRenderer(value) {
  return value?.renderer || value?.backendTest?.renderer || value?.backend || null;
}

async function readReport(window) {
  return window.webContents.executeJavaScript(`(async()=>{
    const candidates=[globalThis.__ZHUDA_RENDERER__,globalThis.backendTest?.report?.(),globalThis.__ZHUDA_PREFAB_TEST__?.report?.(),globalThis.__ZHUDA_MODEL_TEST__?.report?.()];
    for(const candidate of candidates){const value=await Promise.resolve(candidate);if(value)return {renderer:value.renderer||value};}
    return {renderer:null};
  })()`);
}

async function createWindow() {
  protocol.handle('app', serve);
  const window = new BrowserWindow({
    width: 1280, height: 720, backgroundColor: '#0d1724',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  const consoleLines = [];
  window.webContents.on('console-message', (_event, _level, message) => consoleLines.push(message));
  window.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  window.webContents.on('will-navigate', (event, url) => {if(new URL(url).origin !== 'null' || !url.startsWith('app://bundle/')) event.preventDefault();});
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  resolveBundleFile(root, `app://bundle/${entry}`);
  await window.loadURL(`app://bundle/${entry}`);
  if (!args.has('--verify')) return window;
  await new Promise(resolve => setTimeout(resolve, Number(process.env.ZHUDA_VERIFY_WAIT_MS || 3500)));
  const gpu = { features: app.getGPUFeatureStatus(), info: await app.getGPUInfo('complete').catch(error => ({ error: String(error) })) };
  const page = await readReport(window).catch(error => ({ error: String(error) }));
  const renderer = reportRenderer(page);
  const result = {
    schemaVersion: 1, host: 'electron', os: process.platform, osRelease: process.getSystemVersion(),
    electron: process.versions.electron, chromium: process.versions.chrome, root, entry,
    packaged: app.isPackaged, gpu, renderer, consoleLines, verifiedAt: new Date().toISOString(),
  };
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(result, null, 2));
  const errors = [];
  if (renderer?.selected !== 'webgpu' || renderer?.nativeEngine !== 'WebGPURenderEngine') errors.push('actual renderer is not WebGPU');
  if (renderer?.fallbackReason != null || renderer?.adapter?.isFallbackAdapter !== false) errors.push('WebGPU fallback/software adapter is not accepted');
  if (renderer?.status !== 'ready') errors.push(`renderer status is ${renderer?.status || 'missing'}`);
  if (!Array.isArray(renderer?.errors)) errors.push('renderer errors array is missing');
  if (Array.isArray(renderer?.errors) && renderer.errors.length) errors.push(`renderer errors: ${renderer.errors.join('; ')}`);
  result.passed = errors.length === 0; result.errors = errors; fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await window.close(); app.exit(errors.length ? 1 : 0);
  return window;
}

app.whenReady().then(createWindow).catch(error => { console.error(error); app.exit(1); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
