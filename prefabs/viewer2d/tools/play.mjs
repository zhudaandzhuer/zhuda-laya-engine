// Plays a scenario in headless Chrome: steps of page script, waits and screenshots.
// Usage: node tools/play.mjs <scenario.json> "<query>"      e.g. "scene=sky-island&fx=high&governor=0"
// A step is { "js": "...", "wait": seconds, "shot": "name", "click": [x, y], "drag": [x0, y0, x1, y1], "hold": seconds } (any of them);
// a drag presses at the first point, moves to the second in 24 moves, holds, and lets go;
// in "js", `S` is the open scene's window.__SCENE__ hook (state(), set(), errors() and the scene's own handles).
// By what is on the Laya stage (the engine's stage probe, packages/compiler/stage-probe.mjs, read from outside the page):
//   "click": "name" | { "name": … } | { "text": … } | { "textMatches": … }   clicks the middle of the one shown node it picks
//            (with "hold": seconds and no drag, the button stays down that long: a control that listens for press and release)
//   "expect": { "name": …, "text": …, "visible": false, "count": n, "js": "S.…", "within": seconds } (or a list of them)
//   "probe": "name"   writes the whole stage report to OUT/name.stage.json
// In a step they run in this order: click, drag, js, wait, expect, probe, shot. A click that finds no node, or an
// expectation that does not hold, ends the run: exit code 1, the step and what was found on stderr, OUT/failed.png.
// Screenshots go to OUT (default evidence/), 1280×720 unless MOBILE=1 (390×844 at 3×, touch). THROTTLE=n slows the CPU n times.
import fs from 'node:fs';
import path from 'node:path';
import { chromeFixture } from '../node_modules/zhuda-laya-engine/packages/compiler/chrome-host.mjs';
import { checkScenario, stageSteps } from '../node_modules/zhuda-laya-engine/packages/compiler/stage-probe.mjs';
import { serve } from './serve.mjs';
const project = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const [file, query = ''] = process.argv.slice(2);
if (!file) throw Error('usage: node tools/play.mjs <scenario.json> "scene=<id>&…"');
const steps = checkScenario(JSON.parse(fs.readFileSync(file, 'utf8')));
const out = path.resolve(process.env.OUT || path.join(project, 'evidence'));
fs.mkdirSync(out, { recursive: true });
const { server, base } = await serve();
const browser = await chromeFixture();
const log = [];
try {
  const mobile = process.env.MOBILE === '1';
  await browser.send('Emulation.setDeviceMetricsOverride', mobile ? { width: 390, height: 844, deviceScaleFactor: 3, mobile: true } : { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  if (mobile) await browser.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (process.env.THROTTLE) await browser.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) });
  await browser.send('Page.navigate', { url: base + 'index.html?' + (mobile ? '' : 'width=1280&height=720&') + query });
  let ready = false;
  for (let i = 0; i < 900 && !ready; i++) {
    ready = await browser.evaluate('!!(window.__SCENE__ && window.__SCENE__.ready)').catch(() => false);
    if (!ready) await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw Error('the scene never said it was ready (window.__SCENE__.ready); page errors: ' + JSON.stringify(browser.errors.slice(0, 4)));
  const press = async (x, y, hold = 0) => {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await browser.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      if (hold && type === 'mousePressed') await new Promise((r) => setTimeout(r, hold * 1000));
    }
  };
  const named = stageSteps({ evaluate: browser.evaluate, press, advance: (seconds) => new Promise((r) => setTimeout(r, seconds * 1000)), hook: 'window.__SCENE__', total: steps.length });
  for (const [index, step] of steps.entries()) {
    // "hold" belongs to the drag when the step has one, otherwise to the click.
    if (Array.isArray(step.click)) await press(step.click[0], step.click[1], step.drag ? 0 : step.hold);
    else if (step.click) log.push(await named.click(step.click, index, step.drag ? 0 : step.hold));
    if (step.drag) {
      const [x0, y0, x1, y1] = step.drag;
      const mouse = (type, x, y, buttons) => browser.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
      await mouse('mouseMoved', x0, y0, 0);
      await mouse('mousePressed', x0, y0, 1);
      for (let i = 1; i <= 24; i++) {
        await mouse('mouseMoved', x0 + ((x1 - x0) * i) / 24, y0 + ((y1 - y0) * i) / 24, 1);
        await new Promise((r) => setTimeout(r, 16));
      }
      if (step.hold) await new Promise((r) => setTimeout(r, step.hold * 1000));
      await mouse('mouseReleased', x1, y1, 0);
    }
    if (step.js) {
      const got = await browser.evaluate(`(async () => { const S = window.__SCENE__; ${step.js} })()`).catch((e) => 'ERR ' + e);
      if (got !== undefined) log.push(got);
    }
    if (step.wait) await new Promise((r) => setTimeout(r, step.wait * 1000));
    if (step.expect) log.push(await named.expect(step.expect, index));
    if (step.probe) {
      const report = await named.probe();
      fs.writeFileSync(path.join(out, step.probe + '.stage.json'), JSON.stringify(report, null, 1) + '\n');
      log.push({ probe: step.probe, nodes: report.total, shown: report.shown });
    }
    if (step.shot) {
      await browser.screenshot(path.join(out, step.shot + '.png'));
      log.push({ shot: step.shot, state: JSON.parse(await browser.evaluate('JSON.stringify(window.__SCENE__.state())')) });
    }
  }
  log.push({ rendererErrors: await browser.evaluate('JSON.stringify(window.__SCENE__.errors())'), pageErrors: browser.errors.slice(0, 4) });
  console.log(JSON.stringify(log).slice(0, Number(process.env.LOG_CHARS) || 3000));
} catch (error) {
  // What ran before the failure, then the failure where a cut log cannot hide it.
  console.log(JSON.stringify(log).slice(0, Number(process.env.LOG_CHARS) || 3000));
  console.error('FAILED ' + (error?.message ?? error));
  await browser.screenshot(path.join(out, 'failed.png')).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
