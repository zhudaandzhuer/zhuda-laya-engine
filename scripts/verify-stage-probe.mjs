#!/usr/bin/env node
// Real-browser check of the stage probe (packages/compiler/stage-probe.mjs) on a built
// reference game, games/zhuda-match (build it first: `npm run build` in its folder). The
// game computes where its named controls are by itself (`window.__GAME__.hot`, kit.ts), so
// the probe, which knows nothing of the game, is checked against a second opinion.
//
// In headless Chrome, at each of three shapes of page (a desktop, an upright window, a
// phone at 3 device pixels to one):
//   - every control the game lists is found by its name, and the middle of the probe's
//     rectangle is within one CSS pixel of the game's own point;
//   - the probe's node count is what a plain walk of `Laya.stage` in the page counts;
//   - a click (the browser's own mouse events) at the probe's point of `level-0` opens the
//     board, and one at `menu`, found by what its label says, goes back;
//   - the stage's node counts and the page's DOM node count are read side by side on the
//     title and on the board.
// Then, on the upright window, the stage is turned by LayaAir itself (`screenMode`
// 'horizontal'): the report says `turned`, and a click by name still lands.
//
// STAGE_PROBE_OUT: folder for the report (stage-probe.json). Desktop evidence only: not a
// phone, not iOS, not a mini-game runtime.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromeFixture } from '../packages/compiler/chrome-host.mjs';
import {
  findStageNodes,
  stageClickPoint,
  stageProbeExpression,
  stageSteps,
} from '../packages/compiler/stage-probe.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const web = path.join(engineRoot, 'games/zhuda-match/dist/web');
if (!fs.existsSync(path.join(web, 'index.html')))
  throw Error('games/zhuda-match is not built: run `npm run build` in games/zhuda-match');
const out = path.resolve(
  process.env.STAGE_PROBE_OUT || path.join(os.tmpdir(), 'zhuda-stage-probe'),
);
fs.mkdirSync(out, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
};
const server = http.createServer((req, res) => {
  const file = path.resolve(web, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(web + path.sep)) return void res.writeHead(403).end();
  fs.readFile(file, (error, bytes) => {
    if (error) return void res.writeHead(req.url === '/favicon.ico' ? 204 : 404).end();
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(bytes);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

const shapes = [
  { id: 'desktop-1280x720', width: 1280, height: 720, deviceScaleFactor: 1, mobile: false },
  { id: 'upright-540x960', width: 540, height: 960, deviceScaleFactor: 1, mobile: false },
  { id: 'phone-390x844-dpr3', width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  return ok;
};
const report = { game: 'games/zhuda-match', shapes: [], turned: null, failures };

const browser = await chromeFixture();
try {
  await browser.send('Performance.enable');
  const press = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased'])
      await browser.send('Input.dispatchMouseEvent', {
        type,
        x,
        y,
        button: 'left',
        clickCount: 1,
      });
  };
  const steps = stageSteps({
    evaluate: browser.evaluate,
    press,
    advance: (seconds) => sleep(seconds * 1000),
    hook: 'window.__GAME__',
  });
  const open = async (shape) => {
    const { id, ...metrics } = shape;
    await browser.send('Emulation.setDeviceMetricsOverride', metrics);
    await browser.send('Page.navigate', { url: base + 'index.html?fresh=1&seed=7' });
    await browser.waitFor('window.__GAME__ && (window.__GAME__.ready || window.__GAME__.error)');
    await sleep(300);
  };
  const counts = async () => {
    const stage = await browser.evaluate(stageProbeExpression({ counts: true }));
    await browser.send('HeapProfiler.collectGarbage');
    const { metrics } = await browser.send('Performance.getMetrics');
    const walked = await browser.evaluate(
      '(function count(n) { let k = 1; for (const c of n._children) k += count(c); return k; })(Laya.stage)',
    );
    return {
      stageNodes: stage.total,
      stageNodesShown: stage.shown,
      walked,
      domNodes: metrics.find((m) => m.name === 'Nodes').value,
    };
  };

  for (const shape of shapes) {
    await open(shape);
    const stage = await browser.evaluate(stageProbeExpression());
    const hot = JSON.parse(await browser.evaluate('JSON.stringify(window.__GAME__.hot)'));
    const entry = { shape: shape.id, canvas: stage.canvas, stage: stage.stage, controls: {} };
    check(
      Object.keys(hot).length >= 5,
      `${shape.id}: the game lists ${Object.keys(hot).length} controls`,
    );
    for (const [name, own] of Object.entries(hot)) {
      const found = findStageNodes(stage, name);
      if (!check(found.length === 1, `${shape.id}: ${found.length} shown nodes named ${name}`))
        continue;
      const point = stageClickPoint(found[0]);
      const off = Math.max(Math.abs(point[0] - own[0]), Math.abs(point[1] - own[1]));
      entry.controls[name] = { probe: point, game: own, rect: found[0].rect, off };
      check(off <= 1, `${shape.id}: ${name} is at ${point} by the probe and ${own} by the game`);
    }
    entry.title = await counts();
    check(entry.title.walked === entry.title.stageNodes, `${shape.id}: the count on the title`);
    entry.clicks = [];
    try {
      entry.clicks.push(await steps.click('level-0', 0));
      await steps.expect({ name: 'menu', js: "S.screen === 'play'", within: 5 }, 1);
      await steps.expect({ js: 'S.game && !S.game.busy', within: 5 }, 2);
      entry.board = await counts();
      check(entry.board.walked === entry.board.stageNodes, `${shape.id}: the count on the board`);
      entry.clicks.push(await steps.click({ text: '選單' }, 3));
      await steps.expect([{ text: '豬大果園' }, { js: "S.screen === 'title'" }], 4);
    } catch (error) {
      check(false, `${shape.id}: ${error.message}`);
    }
    report.shapes.push(entry);
  }

  // LayaAir turns the stage itself when the screen is the other shape from the one asked
  // for. The engine sizes the stage when its container changes size, so the page is made
  // two pixels taller after the mode is set.
  await open(shapes[1]);
  await browser.evaluate("Laya.stage.screenMode = 'horizontal'; 0");
  const { id: _, ...upright } = shapes[1];
  await browser.send('Emulation.setDeviceMetricsOverride', { ...upright, height: 962 });
  await sleep(800);
  const turned = await browser.evaluate(stageProbeExpression());
  report.turned = { turned: turned.turned, canvas: turned.canvas, stage: turned.stage };
  if (check(turned.turned === true, 'the stage did not turn with screenMode horizontal')) {
    const [level] = findStageNodes(turned, 'level-0');
    report.turned.level0 = level?.rect;
    try {
      report.turned.click = await steps.click('level-0', 0);
      await steps.expect({ name: 'menu', js: "S.screen === 'play'", within: 5 }, 1);
      report.turned.click2 = await steps.click('menu', 2);
      await steps.expect({ js: "S.screen === 'title'", within: 5 }, 3);
    } catch (error) {
      check(false, `turned: ${error.message}`);
    }
  }
  check(browser.errors.length === 0, `page errors: ${browser.errors.slice(0, 3).join(' | ')}`);
} finally {
  await browser.close();
  server.closeAllConnections?.();
  server.close();
}
fs.writeFileSync(path.join(out, 'stage-probe.json'), JSON.stringify(report, null, 1) + '\n');
for (const shape of report.shapes)
  console.log(
    `${shape.shape}: ${Object.keys(shape.controls).length} controls, worst ${Math.max(...Object.values(shape.controls).map((c) => c.off))} px from the game's own point; title ${shape.title.stageNodes} stage nodes (${shape.title.stageNodesShown} shown), ${shape.title.domNodes} DOM nodes; board ${shape.board?.stageNodes} (${shape.board?.stageNodesShown} shown), ${shape.board?.domNodes} DOM nodes`,
  );
console.log(`turned by LayaAir: ${JSON.stringify(report.turned)}`);
if (failures.length) {
  console.error(failures.map((f) => 'FAILED ' + f).join('\n'));
  process.exit(1);
}
console.log(`stage probe: ok (${path.join(out, 'stage-probe.json')})`);
