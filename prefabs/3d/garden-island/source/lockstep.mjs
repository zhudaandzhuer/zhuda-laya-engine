// Plays a scenario in headless Chrome on a virtual clock, so two builds of the same scene can be
// compared pixel for pixel. performance.now(), Date.now() and requestAnimationFrame are replaced
// before any page script runs: while the page loads, time stands still (frames run, nothing moves);
// once the scene's hook is there, frames run only when a step grants them, each exactly 1/60 s.
// A step { js, wait, shot } runs `js` (I and S are the hook), then grants wait×60 frames, then
// takes the screenshot of the last of them.
//
// Same scene, same scenario, same Chrome: two runs give the same pixels (checked 2026-11-25),
// so a moved or rebuilt scene can be compared with its original by counting differing pixels.
// The preview/ pictures were taken with it (viewer3d/scenarios/garden-island-views.json).
//
// Usage (from prefabs/viewer3d, after npm run build):
//   node ../3d/garden-island/source/lockstep.mjs dist/web scenarios/garden-island-views.json "scene=garden-island&fx=high&governor=0" /tmp/views
// SETTLE=<seconds> of still time after the hook appears (default 4).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const { chromeFixture } = await import(new URL('../../../viewer3d/node_modules/zhuda-laya-engine/packages/compiler/chrome-host.mjs', import.meta.url).href);

const [rootArg, file, query = '', outArg] = process.argv.slice(2);
const root = path.resolve(rootArg);
const out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
const steps = JSON.parse(fs.readFileSync(file, 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!f.startsWith(root + path.sep)) return void res.writeHead(403).end();
  fs.readFile(f, (error, bytes) => {
    if (error) return void res.writeHead(404).end();
    res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream');
    res.end(bytes);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const clock = `(() => {
  const realRAF = window.requestAnimationFrame.bind(window);
  const vt = { now: 1000, ticks: 0, locked: false, frames: 0, step: 1000 / 60 };
  Object.defineProperty(window, '__VT__', { value: vt });
  performance.now = () => vt.now;
  Date.now = () => 1763500000000 + Math.floor(vt.now);
  let queue = new Map(), next = 1;
  window.requestAnimationFrame = (cb) => { const id = next++; queue.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { queue.delete(id); };
  const pump = () => {
    realRAF(pump);
    if (vt.locked) {
      if (vt.ticks <= 0) return;
      vt.ticks--;
      vt.now += vt.step;
      vt.frames++;
    }
    const run = queue;
    queue = new Map();
    for (const cb of run.values()) {
      try { cb(vt.now); } catch (e) { setTimeout(() => { throw e; }); }
    }
  };
  realRAF(pump);
})();`;

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const browser = await chromeFixture();
const log = [];
try {
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: clock });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: base + 'index.html?width=1280&height=720&' + query });
  const HOOK = '(window.__ISLAND__ || window.__SCENE__)';
  let there = false;
  for (let i = 0; i < 900 && !there; i++) {
    there = await browser.evaluate(`!!${HOOK}`).catch(() => false);
    if (!there) await sleep(0.2);
  }
  if (!there) throw Error('no hook; page errors: ' + JSON.stringify(browser.errors.slice(0, 4)));
  // Still time: let shaders and pipelines settle before the first granted frame.
  await sleep(Number(process.env.SETTLE || 4));
  await browser.evaluate('window.__VT__.locked = true');
  for (const step of steps) {
    if (step.js) {
      const got = await browser.evaluate(`(async () => { const I = ${HOOK}, S = I; ${step.js} })()`).catch((e) => 'ERR ' + e);
      if (got !== undefined) log.push(got);
    }
    const ticks = Math.round((step.wait || 0) * 60);
    if (ticks) {
      await browser.evaluate(`window.__VT__.ticks = ${ticks}`);
      for (let i = 0; i < 6000; i++) {
        if ((await browser.evaluate('window.__VT__.ticks')) <= 0) break;
        await sleep(0.05);
      }
    }
    if (step.shot) {
      await sleep(0.4);
      await browser.screenshot(path.join(out, step.shot + '.png'));
      log.push({ shot: step.shot, frames: await browser.evaluate('window.__VT__.frames'), state: JSON.parse(await browser.evaluate(`JSON.stringify(${HOOK}.state())`)) });
    }
  }
  log.push({ rendererErrors: await browser.evaluate(`JSON.stringify(${HOOK}.errors())`), pageErrors: browser.errors.slice(0, 4) });
  console.log(JSON.stringify(log).slice(0, Number(process.env.LOG_CHARS) || 4000));
} finally {
  await browser.close();
  server.close();
}
