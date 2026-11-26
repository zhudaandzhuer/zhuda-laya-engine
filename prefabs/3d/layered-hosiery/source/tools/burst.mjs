// Frames while a drag is held: node tools/burst.mjs <name> "<query>" x0 y0 x1 y1 [frames] [width] [height]
// Saves evidence/<name>/f00.png... and prints, per frame, the skirt particles' stretch and the cloth state.
import fs from 'node:fs';
import path from 'node:path';
import { chromeFixture } from 'zhuda-laya-engine/compiler/chrome-host';
import { serve } from './serve.mjs';
const project = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const [name, query, x0, y0, x1, y1, frames = '24', width = '1280', height = '720'] = process.argv.slice(2);
const out = path.join(project, 'evidence', name);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { server, base } = await serve();
const browser = await chromeFixture();
try {
  await browser.send('Emulation.setDeviceMetricsOverride', { width: +width, height: +height, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: base + 'index.html?' + query });
  for (let i = 0; i < 100; i++) {
    if (await browser.evaluate('!!(window.__GAME__ && window.__GAME__.ready) && !!(window.__ZHUDA_SPLASH__?.completed) && !document.getElementById("zhudaLogoSplash")').catch(() => false)) break;
    await sleep(200);
  }
  await sleep(500);
  const mouse = (type, x, y, buttons) => browser.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
  await mouse('mouseMoved', +x0, +y0, 0);
  await mouse('mousePressed', +x0, +y0, 1);
  const steps = 30;
  for (let i = 1; i <= steps; i++) {
    await mouse('mouseMoved', +x0 + ((x1 - x0) * i) / steps, +y0 + ((y1 - y0) * i) / steps, 1);
    await sleep(16);
  }
  for (let f = 0; f < +frames; f++) {
    const shot = await browser.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1000, height: 720, scale: 1 } }, undefined, 60000);
    fs.writeFileSync(path.join(out, `f${String(f).padStart(2, '0')}.png`), Buffer.from(shot.data, 'base64'));
    console.log(f, await browser.evaluate('JSON.stringify(window.__GAME__.api.cloth ? window.__GAME__.api.cloth() : null)'));
    await sleep(40);
  }
  await mouse('mouseReleased', +x1, +y1, 0);
} finally {
  await browser.close?.();
  server.close();
}
