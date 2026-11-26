// Lifts the skirt by its hem with the mouse, lets go, and prints its motion afterwards.
// Usage: node tools/release-trace.mjs "<query>" x0 y0 x1 y1
import { chromeFixture } from 'zhuda-laya-engine/compiler/chrome-host';
import { serve } from './serve.mjs';
const [query = '', x0, y0, x1, y1] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { server, base } = await serve();
const browser = await chromeFixture();
try {
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: base + 'index.html?' + query });
  for (let i = 0; i < 100; i++) {
    if (await browser.evaluate('!!(window.__GAME__ && window.__GAME__.ready) && !!(window.__ZHUDA_SPLASH__?.completed) && !document.getElementById("zhudaLogoSplash")').catch(() => false)) break;
    await sleep(200);
  }
  await sleep(500);
  const mouse = (type, x, y, buttons) => browser.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
  await mouse('mouseMoved', +x0, +y0, 0);
  await mouse('mousePressed', +x0, +y0, 1);
  for (let i = 1; i <= 30; i++) {
    await mouse('mouseMoved', +x0 + ((x1 - x0) * i) / 30, +y0 + ((y1 - y0) * i) / 30, 1);
    await sleep(16);
  }
  await sleep(800);
  console.log('held', await browser.evaluate('JSON.stringify(window.__GAME__.api.stats().held)'));
  const traced = browser.evaluate('window.__GAME__.api.trace(240).then(JSON.stringify)');
  await sleep(30);
  await mouse('mouseReleased', +x1, +y1, 0);
  console.log(await traced);
} finally {
  await browser.close?.();
  server.close();
}
