// Serves a built game (dist/web) and drives it in headless Chromium (software WebGL).
//   node games/tools/shot.mjs <project dir> [--query a=1&b=2] [--size 1280x720] [--out dir] [--script file.mjs] [--wait ms] [--touch]
//                                           [--gpu] [--headed] [--channel chrome] [--dpr 2] [--root dist/web]
//                                           [--hook __SCENE__]
// Without --script: waits for window.__GAME__.ready, waits --wait ms, takes one screenshot.
// --hook names the page's hook when it is not __GAME__ (the prefab viewers set __SCENE__): its
// `ready` is waited for, and where it has a state() function the log holds what that returns.
// A script exports default async ({ page, shot, state, sleep, log }) => {}.
// Without --gpu the screenshots are for looking at, not for timing: the drawing is in software.
// --gpu drives the browser installed on the machine (--channel, default chrome) on its graphics
// card, with a window if --headed; the log's `renderer` says what drew. Baselines taken one way
// are not comparable with the other: antialiasing, shadows and colours differ.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const project = resolve(process.argv[2]);
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const root = resolve(project, arg('root', join('dist', 'web')));
const out = resolve(arg('out', join(project, 'play-out')));
mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = existsSync(path) && !path.endsWith('/') ? path : join(path, 'index.html');
  // A page without an icon of its own: the browser asks for one by itself, and a 404 would be counted as a page error.
  if (!existsSync(file)) return res.writeHead(req.url === '/favicon.ico' ? 204 : 404).end();
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(0);
const port = server.address().port;
// Playwright is not a dependency of the engine or of a game: install it where you like
// (`npm i -g playwright && npx playwright install chromium`) and, if it is not resolvable from
// here, say where with PLAYWRIGHT_PATH=<a node_modules directory>.
const roots = [process.env.PLAYWRIGHT_PATH, import.meta.dirname].filter(Boolean);
let chromium;
for (const root of roots)
  try {
    ({ chromium } = createRequire(join(root, 'x.js'))('playwright'));
    break;
  } catch {
    try {
      // playwright-core is enough with --gpu: the browser is the machine's own.
      ({ chromium } = createRequire(join(root, 'x.js'))('playwright-core'));
      break;
    } catch {
      /* try the next place */
    }
  }
if (!chromium) throw Error('playwright not found: npm i -g playwright, or set PLAYWRIGHT_PATH to a node_modules directory');
const gpu = process.argv.includes('--gpu');
// More switches for the browser, e.g. SHOT_CHROME_ARGS="--disable-frame-rate-limit --disable-gpu-vsync" to see what a frame costs.
const extra = (process.env.SHOT_CHROME_ARGS ?? '').split(' ').filter(Boolean);
const browser = gpu
  ? await chromium.launch({ channel: arg('channel', 'chrome'), headless: !process.argv.includes('--headed'), args: ['--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', ...extra] })
  : await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const [vw, vh] = arg('size', '1280x720').split('x').map(Number);
const touch = process.argv.includes('--touch');
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: Number(arg('dpr', '1')), hasTouch: touch, isMobile: touch });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.location()?.url ? `${m.text()} ${m.location().url}` : m.text()));
page.on('pageerror', (e) => errors.push(String(e.stack || e)));
page.on('requestfailed', (r) => errors.push(`request failed ${r.url()}`));
const log = [];
const t0 = Date.now();
const hook = arg('hook', '__GAME__');
const state = () =>
  page.evaluate((name) => {
    const h = window[name];
    if (!h) return null;
    return JSON.parse(JSON.stringify(typeof h.state === 'function' ? { ready: h.ready, state: h.state(), rendererErrors: h.errors?.() } : h));
  }, hook);
const shot = async (name) => { await page.screenshot({ path: join(out, `${name}.png`) }); log.push({ shot: name, seconds: (Date.now() - t0) / 1000, state: await state() }); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = '';
try {
  await page.goto(`http://localhost:${port}/index.html?${arg('query', '')}`);
  await page.waitForFunction((name) => window[name]?.ready || window[name]?.error, hook, { timeout: Number(arg('timeout', '240000')), polling: 250 });
  const script = arg('script', '');
  if (script) await (await import(pathToFileURL(resolve(script)).href)).default({ page, shot, state, sleep, log: (x) => log.push(x) });
  else { await sleep(Number(arg('wait', '1500'))); await shot(arg('name', 'shot')); }
} catch (e) { failed = String(e.stack || e); try { await page.screenshot({ path: join(out, 'failed.png') }); } catch {} }
const final = await state().catch(() => null);
// What drew: the graphics card's name as WebGL gives it (SwiftShader without --gpu), and the browser.
const renderer = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  return { webgl: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null, webgpu: 'gpu' in navigator, userAgent: navigator.userAgent, dpr: devicePixelRatio };
}).catch(() => null);
writeFileSync(join(out, `${arg('name', 'run')}.log.json`), JSON.stringify({ errors, failed, renderer, final, log }, null, 1));
console.log(JSON.stringify({ errors: errors.slice(0, 8), failed: failed.slice(0, 600), final }, null, 1).slice(0, 3000));
await browser.close(); server.close();
process.exit(errors.length || failed ? 1 : 0);
