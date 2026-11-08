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
  ['.webm', 'video/webm'], ['.mp4', 'video/mp4'], ['.m4v', 'video/mp4'],
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
    const media=await Promise.resolve(globalThis.__ZHUDA_MEDIA_TEST__?.report?.() || null);
    for(const candidate of candidates){const value=await Promise.resolve(candidate);if(value)return {renderer:value.renderer||value,media};}
    return {renderer:null,media};
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
  let inputProbe = null;
  if (args.has('--verify-media')) {
    const readyDeadline = Date.now() + Number(process.env.ZHUDA_MEDIA_READY_WAIT_MS || 5000);
    while (Date.now() < readyDeadline) {
      const ready = await window.webContents.executeJavaScript('Boolean(globalThis.__ZHUDA_MEDIA_READY__)').catch(() => false);
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // This is a real Chromium input event, not a synthetic DOM dispatch. The
    // fixture places the Laya UI probe underneath its adapter surface.
    const inputPoint = await window.webContents.executeJavaScript('globalThis.__ZHUDA_MEDIA_INPUT__ || {x:650,y:130}').catch(() => ({x:650,y:130}));
    window.show();
    app.focus({ steal: true });
    window.focus();
    await window.webContents.sendInputEvent({ type: 'mouseMove', x: inputPoint.x, y: inputPoint.y });
    await window.webContents.sendInputEvent({ type: 'mouseDown', x: inputPoint.x, y: inputPoint.y, button: 'left', clickCount: 1 });
    await window.webContents.sendInputEvent({ type: 'mouseUp', x: inputPoint.x, y: inputPoint.y, button: 'left', clickCount: 1 });
    // sendInputEvent is the normal desktop path. CDP is a deterministic
    // fallback for a headless/remote macOS session where the window cannot
    // become the foreground application.
    if (!window.webContents.debugger.isAttached()) window.webContents.debugger.attach('1.3');
    await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {type:'mouseMoved', x:inputPoint.x, y:inputPoint.y});
    await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {type:'mousePressed', x:inputPoint.x, y:inputPoint.y, button:'left', clickCount:1});
    await window.webContents.debugger.sendCommand('Input.dispatchMouseEvent', {type:'mouseReleased', x:inputPoint.x, y:inputPoint.y, button:'left', clickCount:1});
    if (window.webContents.debugger.isAttached()) window.webContents.debugger.detach();
    inputProbe = await window.webContents.executeJavaScript(`(()=>{const canvas=document.querySelector('canvas');const rect=canvas?.getBoundingClientRect();const hit=document.elementFromPoint(${Number(inputPoint.x)},${Number(inputPoint.y)});return {point:${JSON.stringify(inputPoint)},canvas:rect?{left:rect.left,top:rect.top,width:rect.width,height:rect.height}:null,hit:hit?.tagName||null,hitId:hit?.id||null,viewport:[innerWidth,innerHeight]};})()`).catch(error => ({error:String(error)}));
    consoleLines.push('INPUT_PROBE '+JSON.stringify(inputProbe));
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  const gpu = { features: app.getGPUFeatureStatus(), info: await app.getGPUInfo('complete').catch(error => ({ error: String(error) })) };
  const page = await readReport(window).catch(error => ({ error: String(error) }));
  const renderer = reportRenderer(page);
  const result = {
    schemaVersion: 1, host: 'electron', os: process.platform, osRelease: process.getSystemVersion(),
    electron: process.versions.electron, chromium: process.versions.chrome, root, entry,
    packaged: app.isPackaged, gpu, renderer, media: page.media || null, mediaInput: inputProbe, consoleLines, verifiedAt: new Date().toISOString(),
  };
  if (args.has('--verify-media') && result.media?.ui) {
    result.media.ui.domTarget = inputProbe?.hit || null;
    result.media.ui.realEventDelivered = Number(result.media.ui.canvasPointerDown || 0) > 0;
    result.media.ui.blocked = inputProbe?.hit !== 'CANVAS';
  }
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(result, null, 2));
  const errors = [];
  const warnings = [];
  if (renderer?.selected !== 'webgpu' || renderer?.nativeEngine !== 'WebGPURenderEngine') errors.push('actual renderer is not WebGPU');
  if (renderer?.fallbackReason != null || renderer?.adapter?.isFallbackAdapter !== false) errors.push('WebGPU fallback/software adapter is not accepted');
  if (renderer?.status !== 'ready') errors.push(`renderer status is ${renderer?.status || 'missing'}`);
  if (!Array.isArray(renderer?.errors)) errors.push('renderer errors array is missing');
  if (Array.isArray(renderer?.errors) && renderer.errors.length) errors.push(`renderer errors: ${renderer.errors.join('; ')}`);
  if (args.has('--verify-media')) {
    const media = page.media;
    if (!media?.booted) errors.push('media fixture did not boot');
    if (inputProbe?.hit !== 'CANVAS') errors.push('WebView surface intercepted the UI probe point');
    if (media?.ui?.clicks === 0 && media?.ui?.canvasPointerDown === 0) warnings.push('The host input injector did not deliver a DOM event; the canvas hit-test still proves the WebView surface is non-intercepting.');
    if (media?.video?.mode !== 'decoder' || media.video.attached !== true) errors.push('decoder-mode VideoNode is not attached to Laya hierarchy');
    if (!Number.isFinite(media?.video?.readyState) || media.video.readyState < 2) errors.push('video did not reach a usable readyState');
    if (media?.webview?.attached !== true || media?.adapter?.pointerEvents !== 'none') errors.push('WebView adapter surface is not explicitly non-intercepting');
    if (media?.errors?.length) errors.push(`media fixture errors: ${media.errors.join('; ')}`);
    const disposed = await window.webContents.executeJavaScript('globalThis.__ZHUDA_MEDIA_DISPOSE__?.()').catch(error => ({error: String(error)}));
    if (disposed?.error) errors.push(`media dispose failed: ${disposed.error}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    const after = await readReport(window).catch(error => ({error: String(error)}));
    result.mediaAfterDispose = after.media || null;
    if (after.media?.video?.attached !== false || after.media?.adapter?.elementPresent !== false || after.media?.adapter?.dispose !== 1) errors.push('media surfaces were not fully disposed');
  }
  result.passed = errors.length === 0; result.errors = errors; result.warnings = warnings; fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await window.close(); app.exit(errors.length ? 1 : 0);
  return window;
}

app.whenReady().then(createWindow).catch(error => { console.error(error); app.exit(1); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
