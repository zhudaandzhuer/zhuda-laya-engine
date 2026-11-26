// Saves a picture of the page. Usage: node tools/shot.mjs <name> [query] [width] [height]
//   SCRIPT='__TEAR2D__.api.pull(-1, .5, .6, [0,0,1], .8)'  run after the page is ready (several, split by ;)
//   DRAGS='x0,y0,x1,y1[,steps[,holdMs]];...'          real mouse drags (CDP input), each released at its end
//   KEEP_HELD=1                                       the last drag is not released before the picture
//   WAIT=ms                                           time before the picture (default 3200)
import fs from 'node:fs';
import path from 'node:path';
import { chromeFixture } from 'zhuda-laya-engine/compiler/chrome-host';
import { serve } from './serve.mjs';
const project = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const [name = 'shot', query = '', width = '900', height = '900'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { server, base } = await serve();
const browser = await chromeFixture();
try {
  await browser.send('Emulation.setDeviceMetricsOverride', { width: +width, height: +height, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: base + 'index.html?' + query });
  let state = null;
  for (let i = 0; i < 300 && !state; i++) {
    state = await browser.evaluate('window.__TEAR2D__ && (window.__TEAR2D__.ready || window.__TEAR2D__.error) ? JSON.stringify({ready: window.__TEAR2D__.ready, error: window.__TEAR2D__.error, note: window.__TEAR2D__.note}) : null').catch(() => null);
    if (!state) await sleep(200);
  }
  console.log(state);
  // The engine's start splash takes the pointer until it has gone (about 2.2 s after load).
  for (let i = 0; i < 60; i++) {
    if (await browser.evaluate('!!(window.__ZHUDA_SPLASH__?.completed) && !document.getElementById("zhudaLogoSplash")').catch(() => false)) break;
    await sleep(100);
  }
  await sleep(300);
  if (process.env.SCRIPT_FILE) console.log('script-file ->', await browser.evaluate(fs.readFileSync(process.env.SCRIPT_FILE, 'utf8')));
  for (const line of (process.env.SCRIPT || '').split(';').filter(Boolean)) console.log('script', line.trim(), '->', await browser.evaluate('JSON.stringify(' + line + ')'));
  const drags = (process.env.DRAGS || '').split(';').filter(Boolean);
  const mouse = (type, x, y, buttons) => browser.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
  for (let d = 0; d < drags.length; d++) {
    const [x0, y0, x1, y1, steps = 24, hold = 300] = drags[d].split(',').map(Number);
    await mouse('mouseMoved', x0, y0, 0);
    await mouse('mousePressed', x0, y0, 1);
    for (let i = 1; i <= steps; i++) {
      await mouse('mouseMoved', x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, 1);
      await sleep(16);
    }
    await sleep(hold);
    if (process.env.KEEP_HELD && d === drags.length - 1) break;
    await mouse('mouseReleased', x1, y1, 0);
    await sleep(400);
  }
  await sleep(+(process.env.WAIT || 3200));
  console.log('stats', await browser.evaluate('JSON.stringify(window.__TEAR2D__.api && window.__TEAR2D__.api.stats())'));
  const shot = await browser.send('Page.captureScreenshot', { format: 'png' }, undefined, 60000);
  const file = path.join(project, 'evidence', name + '.png');
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log(file, await browser.evaluate('JSON.stringify(window.__BODY_RENDERER__ ? window.__BODY_RENDERER__() : [])'));
} finally {
  await browser.close?.();
  server.close();
}
