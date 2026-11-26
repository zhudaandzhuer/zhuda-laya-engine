// Deterministic scenario player for pixel comparisons (used by the route game-to-prefabs).
// Same scenario format as play.mjs, but the page runs on a virtual clock: every
// animation frame advances time by exactly STEP ms, performance.now(), Date and
// setTimeout/setInterval follow that clock, and frames only run while a step
// lets them. The scene therefore reaches each screenshot after the same number
// of frames, each with the same dt, however busy the machine is.
//
//   [BLOCK=<regex>] [VIEWPORT=572x1024] [HOOK=__GAME__] [READY=ready] [PRELOAD=<a.js>[,<b.js>…]] node detplay.mjs <dist/web dir> <scenario.json> "<query>" <out dir>
//
// PRELOAD: page scripts run on every new document right after the virtual clock, before the
// page's own scripts — e.g. a DOM-only window.__SCENE__ for a game that has no hook of its own
// (define it when the game has scheduled its first frame, so frames are held from there), or
// input helpers shared by both builds.
//
// In step "js", both `S` and `I` are the page hook (window.__SCENE__ or window.__ISLAND__).
// VIEWPORT=<w>x<h> sets the browser size (default 1280x720; the query still starts with width=&height= of it).
// HOOK=<global name> waits for and uses window[<name>] instead, for a game that never sets __SCENE__
// (its state() and errors() are read only when it has them).
// Frames are held as soon as the hook appears (before the scene's first frame).
// READY=<property> holds them when window[HOOK][<property>] is true instead, for a game that sets its hook
// on its first line and says later that it has loaded (window.__GAME__.ready): loading then takes the frames
// it takes, and the scenario starts from the same clock and the same random numbers every run.
//
// Steps by what is on the Laya stage (the engine's stage probe, packages/compiler/stage-probe.mjs):
//   "click": "name" | { "name": … } | { "text": … } | { "textMatches": … }   clicks the middle of the one shown node it picks
//            (with "hold": seconds the button stays down that long on the virtual clock)
//   "expect": { "name": …, "text": …, "visible": false, "count": n, "js": "S.…", "within": seconds } (or a list of them);
//             "within" lets the virtual clock run a tenth of a second at a time until it holds
//   "probe": "name"   writes the whole stage report to <out dir>/name.stage.json
// In a step they run in this order: click, js, wait, expect, probe, shot. A click that finds no node, or an
// expectation that does not hold, ends the run: exit code 1, the step and what was found on stderr, failed.png.
// detrepeat.mjs beside this file runs a scenario N times and says whether every run gave the same files.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromeFixture } from '../../packages/compiler/chrome-host.mjs';
import { checkScenario, stageSteps } from '../../packages/compiler/stage-probe.mjs';

const [root, file, query = '', out = 'shots'] = process.argv.slice(2);
const STEP = Number(process.env.STEP_MS || 1000 / 60);
const [VW, VH] = (process.env.VIEWPORT || '1280x720').split('x').map(Number);
const NAMED = process.env.HOOK ? `window[${JSON.stringify(process.env.HOOK)}]` : '(window.__ISLAND__ || window.__SCENE__)';
const HOOKED = process.env.READY ? `(${NAMED} && ${NAMED}[${JSON.stringify(process.env.READY)}])` : NAMED;
const steps = checkScenario(JSON.parse(fs.readFileSync(file, 'utf8')));
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css', '.glb': 'model/gltf-binary', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.lh': 'application/json' };
const dir = path.resolve(root);
const server = http.createServer((req, res) => {
  const f = path.resolve(dir, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  // BLOCK=<regex>: files withheld (404), e.g. the song, whose element clock is real time.
  if (process.env.BLOCK && new RegExp(process.env.BLOCK).test(f)) return void res.writeHead(404).end();
  if (!f.startsWith(dir + path.sep)) return void res.writeHead(403).end();
  fs.readFile(f, (error, bytes) => {
    if (error) return void res.writeHead(404).end();
    res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
    res.end(bytes);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const virtualClock = `(() => {
  const STEP = ${STEP};
  const realRaf = window.requestAnimationFrame.bind(window);
  const realSetTimeout = window.setTimeout.bind(window);
  const RealDate = Date;
  const EPOCH = new RealDate(2026, 10, 16, 10, 0, 0).getTime();
  let vt = 0, frames = new Map(), frameId = 1, timers = [], timerId = 1;
  const state = { held: false, autoHeld: false, ticks: 0, sceneTicks: 0, holdAt: Infinity, errors: [] };
  window.requestAnimationFrame = (cb) => { const id = frameId++; frames.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { frames.delete(id); };
  performance.now = () => vt;
  let seed = 12345;
  Math.random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // Date counts whole milliseconds, as in a browser (vt has fractions: 1000/60 a frame);
  // a fractional Date.now() fails Number.isSafeInteger checks a game makes on its saves.
  class VDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(Math.floor(EPOCH + vt)); else super(...a); }
    static now() { return Math.floor(EPOCH + vt); }
  }
  window.Date = VDate;
  window.setTimeout = (fn, ms = 0, ...args) => { const id = timerId++; timers.push({ id, due: vt + Math.max(0, Number(ms) || 0), fn, args }); return id; };
  window.clearTimeout = (id) => { timers = timers.filter((t) => t.id !== id); };
  window.setInterval = (fn, ms = 0, ...args) => { const id = timerId++; const every = Math.max(1, Number(ms) || 0); timers.push({ id, due: vt + every, fn, args, every }); return id; };
  window.clearInterval = window.clearTimeout;
  const fail = (e) => { state.errors.push(String(e && e.stack || e)); realSetTimeout(() => { throw e; }); };
  const master = () => {
    realRaf(master);
    if (!state.autoHeld && ${HOOKED}) {
      // The scene is about to run its first frame: from here on every run sees the same clock and the same random numbers.
      state.autoHeld = true; state.held = true; state.loadedAt = vt; vt = Math.max(vt, 600000); seed = 12345;
    }
    if (state.held) return;
    vt += STEP; state.ticks++; if (state.autoHeld) state.sceneTicks++;
    const due = timers.filter((t) => t.due <= vt).sort((a, b) => a.due - b.due || a.id - b.id);
    timers = timers.filter((t) => t.due > vt);
    for (const t of due) {
      if (t.every) timers.push({ ...t, due: t.due + t.every });
      try { typeof t.fn === 'function' ? t.fn(...t.args) : (0, eval)(String(t.fn)); } catch (e) { fail(e); }
    }
    const cbs = [...frames.values()]; frames = new Map();
    for (const cb of cbs) { try { cb(vt); } catch (e) { fail(e); } }
    if (vt >= state.holdAt) { state.held = true; state.holdAt = Infinity; }
  };
  realRaf(master);
  // CSS transitions run on the real clock: NOTRANSITIONS=1 turns them off, so a fading hint is never caught half way.
  if (${process.env.NOTRANSITIONS === '1'}) document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(st); });
  window.__vt = { state, run() { state.held = false; }, hold() { state.held = true; }, runFor(ms) { state.holdAt = vt + ms; state.held = false; }, get now() { return vt; } };
})();`;

const browser = await chromeFixture();
const log = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HOOK = process.env.HOOK ? NAMED : '(window.__SCENE__ || window.__ISLAND__)';
let failed = false;
const readHook = (fn, empty) => `(typeof ${HOOK}.${fn} === 'function' ? ${HOOK}.${fn}() : ${empty})`;
try {
  await browser.send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: virtualClock });
  for (const preload of (process.env.PRELOAD || '').split(',').filter(Boolean))
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(preload, 'utf8') });
  await browser.send('Page.navigate', { url: base + `index.html?width=${VW}&height=${VH}&` + query });
  let held = false;
  for (let i = 0; i < 1500 && !held; i++) {
    held = await browser.evaluate('!!(window.__vt && window.__vt.state.autoHeld)').catch(() => false);
    if (!held) await sleep(200);
  }
  if (!held) throw Error('no hook; page errors: ' + JSON.stringify(browser.errors.slice(0, 4)));
  const waitHeld = async () => {
    for (let i = 0; i < 6000; i++) {
      if (await browser.evaluate('window.__vt.state.held')) return;
      await sleep(50);
    }
    throw Error('frames never stopped');
  };
  const advance = async (seconds) => {
    await browser.evaluate(`window.__vt.runFor(${Math.round(seconds * 1000)})`);
    await waitHeld();
  };
  const press = async (x, y, hold = 0) => {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await browser.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      if (hold && type === 'mousePressed') await advance(hold);
    }
  };
  const named = stageSteps({ evaluate: browser.evaluate, press, advance, hook: HOOK, total: steps.length });
  for (const [index, step] of steps.entries()) {
    if (Array.isArray(step.click)) await press(step.click[0], step.click[1], step.hold);
    else if (step.click) log.push(await named.click(step.click, index, step.hold));
    if (step.js) {
      const got = await browser
        .evaluate(`(async () => { const S = ${HOOK}, I = S; window.__vt.run(); try { ${step.js} } finally { window.__vt.hold(); } })()`, { timeoutMs: 600000 })
        .catch((e) => 'ERR ' + e);
      if (got !== undefined) log.push(got);
    }
    if (step.wait) await advance(step.wait);
    if (step.expect) log.push(await named.expect(step.expect, index));
    if (step.probe) {
      const report = await named.probe();
      fs.writeFileSync(path.join(out, step.probe + '.stage.json'), JSON.stringify(report, null, 1) + '\n');
      log.push({ probe: step.probe, nodes: report.total, shown: report.shown });
    }
    if (step.shot) {
      await sleep(300);
      await browser.screenshot(path.join(out, step.shot + '.png'));
      log.push({ shot: step.shot, at: await browser.evaluate('window.__vt.state.sceneTicks'), state: JSON.parse(await browser.evaluate(`JSON.stringify(${readHook('state', '{}')})`)) });
    }
  }
  log.push({ rendererErrors: await browser.evaluate(`JSON.stringify(${readHook('errors', '[]')})`), pageErrors: browser.errors.slice(0, 6), clockErrors: await browser.evaluate('window.__vt.state.errors.slice(0, 4)') });
  console.log(JSON.stringify(log).slice(0, Number(process.env.LOG_CHARS) || 4000));
} catch (error) {
  // What ran before the failure, then the failure where a cut log cannot hide it.
  failed = true;
  console.log(JSON.stringify(log).slice(0, Number(process.env.LOG_CHARS) || 4000));
  console.error('FAILED ' + (error?.message ?? error));
  await browser.screenshot(path.join(out, 'failed.png')).catch(() => {});
} finally {
  await browser.close();
  server.closeAllConnections?.();
  server.close();
}
process.exit(failed ? 1 : 0);
