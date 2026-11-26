// whenZhudaSplashGone on a built page, in a real Chrome: the page's flag, its event, and the splash's node.
//   PLAYWRIGHT_PATH=<node_modules> node splash-check.mjs <dist/web dir>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_PATH + '/');
const { chromium } = require('playwright');
const dir = path.resolve(process.argv[2]);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!f.startsWith(dir)) return void res.writeHead(403).end();
  fs.readFile(f, (e, b) => (e ? res.writeHead(404).end() : (res.setHeader('Content-Type', types[path.extname(f)] ?? 'application/octet-stream'), res.end(b))));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist'] });
const out = { page: path.relative(process.cwd(), dir), runs: [] };
try {
  for (let run = 0; run < 3; run++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      const t0 = performance.now();
      window.__seen = { events: 0, at: null, nodeAtEvent: null, completedAt: null };
      window.addEventListener('zhuda:splash-gone', () => {
        window.__seen.events++;
        window.__seen.at = Math.round(performance.now() - t0);
        window.__seen.nodeAtEvent = !!document.getElementById('zhudaLogoSplash');
      });
      const poll = setInterval(() => {
        const s = window.__ZHUDA_SPLASH__;
        if (s?.completed && window.__seen.completedAt === null) window.__seen.completedAt = Math.round(performance.now() - t0);
        if (s?.gone) clearInterval(poll);
      }, 10);
    });
    await page.goto(url);
    const early = await page.evaluate(() => ({ state: { ...window.__ZHUDA_SPLASH__ }, node: !!document.getElementById('zhudaLogoSplash') }));
    await page.waitForFunction(() => window.__ZHUDA_SPLASH__?.gone === true, null, { timeout: 30000 });
    await page.waitForTimeout(1500); // a second event would arrive in this time
    const late = await page.evaluate(() => ({ state: { ...window.__ZHUDA_SPLASH__ }, node: !!document.getElementById('zhudaLogoSplash'), seen: window.__seen }));
    out.runs.push({ early, late, errors });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
out.ok = out.runs.every((r) => r.early.node && !r.early.state.gone && r.late.state.gone && !r.late.node && r.late.seen.events === 1 && r.late.seen.nodeAtEvent === false && r.errors.length === 0);
console.log(JSON.stringify(out, null, 1));
process.exit(out.ok ? 0 : 1);
