// Plays a scenario on a phone's Chrome through its DevTools port and reads the frame rate.
// Before: `adb reverse tcp:PORT tcp:PORT` (the phone loads this Mac's server as localhost, a secure
// context, so WebGPU is allowed) and `adb forward tcp:9333 localabstract:chrome_devtools_remote`.
// Usage: node tools/phone.mjs <scenario.json> <query> <label> [port]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';
const project = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const [file, query = '', label = 'phone', port = '8920'] = process.argv.slice(2);
const steps = JSON.parse(fs.readFileSync(file, 'utf8'));
const { server } = await serve(Number(port));
const devtools = 'http://127.0.0.1:9333';
const url = `http://localhost:${port}/index.html?${query}&run=${label}`;
// Android Chrome cannot open a page through DevTools: adb opens it, then it is found in the list.
execFileSync(process.env.ZHUDA_PHONE_ADB || 'adb', ['-s', process.env.ANDROID_SERIAL, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `'${url}'`, 'com.android.chrome'], { stdio: 'ignore' });
let target;
for (let i = 0; i < 40 && !target; i++) {
  await new Promise((r) => setTimeout(r, 500));
  target = (await (await fetch(`${devtools}/json`)).json()).find((page) => page.type === 'page' && page.url.startsWith(url.split('?')[0]) && page.url.includes(label));
}
if (!target) throw Error('the phone did not open ' + url);
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => ((ws.onopen = resolve), (ws.onerror = reject)));
let id = 0;
const waiting = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) waiting.get(message.id)(message), waiting.delete(message.id);
};
const send = (method, params = {}) => new Promise((resolve) => (waiting.set(++id, resolve), ws.send(JSON.stringify({ id, method, params }))));
const evaluate = async (expression) => {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (reply.result?.exceptionDetails) throw Error(JSON.stringify(reply.result.exceptionDetails).slice(0, 300));
  return reply.result?.result?.value;
};
const sleep = (seconds) => new Promise((r) => setTimeout(r, seconds * 1000));
const log = [];
try {
  await send('Page.bringToFront');
  let ready = false;
  for (let i = 0; i < 600 && !ready; i++) {
    ready = await evaluate('!!window.__ISLAND__').catch(() => false);
    if (!ready) await sleep(0.5);
  }
  if (!ready) throw Error('the page did not start: ' + (await evaluate('document.body.innerText.slice(0, 300)').catch(() => '')));
  log.push({ agent: await evaluate('navigator.userAgent'), gpu: await evaluate('!!navigator.gpu'), screen: await evaluate('[innerWidth, innerHeight, devicePixelRatio].join(" ")') });
  // Frame times, measured in the page between shots.
  await evaluate(`(() => { const t = (window.__FT__ = []); let last = performance.now(); const tick = (now) => { t.push(now - last); last = now; requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()`);
  for (const step of steps) {
    if (step.js) await evaluate(`(async () => { const I = window.__ISLAND__; ${step.js} })()`);
    if (step.wait) await sleep(step.wait);
    // Six seconds of frames at this place, after it has settled.
    await evaluate('window.__FT__.length = 0');
    await sleep(6);
    const times = JSON.parse(await evaluate('JSON.stringify(window.__FT__)')).sort((a, b) => a - b);
    const mean = times.reduce((a, b) => a + b, 0) / (times.length || 1);
    const state = JSON.parse(await evaluate('JSON.stringify(window.__ISLAND__.state())'));
    if (step.shot) {
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
      fs.mkdirSync(path.join(project, 'evidence', label), { recursive: true });
      fs.writeFileSync(path.join(project, 'evidence', label, step.shot + '.jpg'), Buffer.from(shot.result.data, 'base64'));
    }
    log.push({ shot: step.shot, frames: times.length, fps: +(1000 / mean).toFixed(1), p50ms: +times[Math.floor(times.length * 0.5)]?.toFixed(1), p95ms: +times[Math.floor(times.length * 0.95)]?.toFixed(1), backend: state.backend, view: state.view, setting: state.setting, quality: state.quality, renderScale: state.renderScale, blades: state.grass?.blades, particles: state.particles });
  }
  log.push({ rendererErrors: await evaluate('JSON.stringify(window.__ISLAND__.errors())') });
} catch (error) {
  log.push({ failed: String(error) });
} finally {
  await fetch(`${devtools}/json/close/${target.id}`).catch(() => {});
  ws.close();
  server.close();
}
fs.writeFileSync(path.join(project, 'evidence', `${label}.json`), JSON.stringify(log, null, 1));
console.log(JSON.stringify(log));
