import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { browserSdkFolder } from './lib/browser-release.mjs';
// SDK_BROWSER_DIR: a release folder to certify; otherwise this source, built fresh.
const root = await browserSdkFolder(process.env.SDK_BROWSER_DIR),
  out = path.resolve(process.env.SDK_EVIDENCE_DIR || '/tmp/zhuda-branding-evidence');
fs.mkdirSync(out, { recursive: true });
// `/__hold.png` answers after HOLD_MS: the page's load event waits for it, so
// the splash must stay past its intro and show that it is still waiting.
const HOLD_MS = 8000;
const server = http.createServer((q, r) => {
  if (q.url.startsWith('/__hold.png')) {
    setTimeout(() => r.writeHead(204).end(), HOLD_MS);
    return;
  }
  try {
    const f = path.join(root, q.url.split('?')[0]);
    r.setHeader('Content-Type', f.endsWith('.js') ? 'application/javascript' : 'text/html');
    r.end(fs.readFileSync(f));
  } catch {
    r.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const logo =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160"><rect width="600" height="160" fill="#26a6f2"/><text x="300" y="100" text-anchor="middle" font-size="60" fill="white">CUSTOM BRAND</text></svg>',
  ).toString('base64');
const reports = [];
try {
  for (const profile of ['2d', '3d', '3d-gltf'])
    for (const mode of ['engine', 'custom', 'none'])
      for (const [width, height] of [
        [360, 640],
        [844, 390],
      ]) {
        const b = await chromeFixture();
        try {
          await b.send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 2,
            mobile: false,
          });
          const config =
            mode === 'custom'
              ? { mode, brandId: 'client', logo, title: 'Customer', caption: 'White label' }
              : { mode };
          await b.send('Page.addScriptToEvaluateOnNewDocument', {
            source:
              (mode === 'engine' ? '' : `window.ZhudaBranding=${JSON.stringify(config)};`) +
              `document.addEventListener('DOMContentLoaded',()=>{const i=new Image();i.src='/__hold.png';document.body.append(i);});`,
          });
          await b.send('Page.navigate', {
            url: `http://127.0.0.1:${server.address().port}/example-${profile}.html`,
          });
          await b.waitFor('!!window.__ZHUDA_SPLASH__');
          if (mode !== 'none')
            await b.waitFor(
              // The intro's length depends on the mode (the tribute mark fades in, a custom logo scales in): wait for it to end.
              `(a=>a.length>0&&a.every(x=>x.playState==='finished'))(document.querySelector('#zhudaLogoSplash img')?.getAnimations()||[])`,
            );
          const state = await b.evaluate(
            `({splash:__ZHUDA_SPLASH__,img:document.querySelector('#zhudaLogoSplash img')?{rect:document.querySelector('#zhudaLogoSplash img').getBoundingClientRect().toJSON(),alt:document.querySelector('#zhudaLogoSplash img').alt,src:document.querySelector('#zhudaLogoSplash img').getAttribute('src')}:null})`,
          );
          assert.equal(state.splash.mode, mode);
          if (mode === 'none') {
            assert.equal(state.splash.completed, true);
            assert.equal(state.img, null);
          } else {
            assert.equal(
              state.img.alt,
              mode === 'engine' ? 'Powered by LayaAir Engine' : 'Customer',
            );
            assert.ok(state.img.rect.width > 0 && state.img.rect.height > 0);
            assert.ok(state.img.rect.left >= 0 && state.img.rect.right <= width + 1);
            assert.ok(state.img.rect.top >= 0 && state.img.rect.bottom <= height + 1);
            await b.screenshot(path.join(out, `${profile}-${mode}-${width}x${height}.png`));
          }
          if (mode !== 'none') {
            // Past its intro, with the page still loading: the splash is still up and its bar loops.
            await b.waitFor(
              `document.querySelector('#zhudaLogoSplash')?.classList.contains('is-waiting')`,
            );
            assert.equal(await b.evaluate('window.__ZHUDA_SPLASH__.completed'), false);
          }
          await b.waitFor('window.__ZHUDA_SPLASH__.completed');
          // The splash leaves only once the page has loaded (never onto a bare background).
          assert.equal(
            await b.evaluate(
              'window.__ZHUDA_SPLASH__.loaded===true||window.__ZHUDA_SPLASH__.mode==="none"',
            ),
            true,
          );
          const api = profile === '3d-gltf' ? '__ZHUDA_MODEL_TEST__' : '__ZHUDA_PREFAB_TEST__';
          await b.waitFor(`window.${api}?.report().ready===true`);
          assert.deepEqual(b.errors, []);
          reports.push({ profile, mode, width, height, state });
        } finally {
          await b.close();
        }
      }
  fs.writeFileSync(path.join(out, 'branding-browser.json'), JSON.stringify(reports, null, 2));
  console.log('PASS ' + reports.length + ' brand/profile/viewport scenarios');
} finally {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
