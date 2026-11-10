import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { injectBrandSplash, brandSplashMarkup } from '../packages/compiler/branding.mjs';
const svg = fs.readFileSync(
  new URL('../assets/branding/zhuda-layaair-mark.svg', import.meta.url),
  'utf8',
);
test('consumer brand is self-contained, responsive and before runtime scripts', () => {
  const source =
    '<html><head><meta charset="utf-8"></head><body><main id="game"></main><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY --></body></html>';
  const result = injectBrandSplash(source, svg);
  assert.equal((result.match(/id="zhudaLogoSplash"/g) || []).length, 1);
  assert.ok(result.indexOf('id="zhudaLogoSplash"') < result.indexOf('ZHUDA_LIBS'));
  const data = result.match(/src="data:image\/svg\+xml;base64,([^"]+)"/)[1];
  assert.equal(Buffer.from(data, 'base64').toString(), svg);
  assert.match(result, /88vw/);
  assert.match(result, /42svh/);
  assert.match(result, /safe-area-inset-top/);
  assert.match(result, /2180/);
  assert.match(brandSplashMarkup('assets/branding/zhuda-layaair-mark.svg'), /assets\/branding/);
});
test('consumer template cannot silently replace or duplicate reserved branding', () => {
  assert.throws(
    () => injectBrandSplash('<body><div id="zhudaLogoSplash"></div></body>', svg),
    /Reserved.*remove the custom splash/,
  );
});

test('fragment branding preserves standards mode and UTF-8 detection before embedded SVG', () => {
  const html = injectBrandSplash(
    '<!doctype html><meta charset="utf-8"><div id="game"></div><!-- ZHUDA_LIBS -->',
    svg,
  );
  assert.match(html, /^<!doctype html>/i);
  assert.ok(html.indexOf('charset="utf-8"') < 1024);
  assert.ok(html.indexOf('id="zhudaLogoSplash"') > html.indexOf('<body>'));
  assert.ok(html.indexOf('id="zhudaLogoSplash"') < html.indexOf('ZHUDA_LIBS'));
});

test('body-only document keeps doctype and early charset while branding adds a head', () => {
  const html = injectBrandSplash('<!doctype html><html><body><main></main></body></html>', svg);
  assert.match(html, /^<!doctype html>/);
  assert.ok(html.indexOf('charset="utf-8"') < 1024);
});

test('white-label is explicit, escaped and none completes without a logo', () => {
  const custom = injectBrandSplash('<body></body>', svg, {
    mode: 'custom',
    brandId: 'client',
    logo: 'https://cdn.example/logo.png',
    title: '<script>"&',
    caption: 'Client',
  });
  assert.match(custom, /&lt;script&gt;&quot;&amp;/);
  assert.doesNotMatch(custom, /AI-FRIENDLY GAME ENGINE|豬大 × LayaAir/);
  const none = injectBrandSplash('<body></body>', svg, { mode: 'none' });
  assert.doesNotMatch(none, /id="zhudaLogoSplash"|data:image/);
  assert.match(none, /\("none"\)/);
  for (const config of [
    { mode: 'invalid' },
    { mode: 'engine', logo: 'x' },
    { mode: 'none', showEngineCredit: false },
    { mode: 'custom', brandId: 'client', logo: 'javascript:alert(1)' },
    { mode: 'custom', brandId: 'client', logo: '//host/logo' },
  ])
    assert.throws(() => injectBrandSplash('<body></body>', svg, config), /branding/);
});

test('custom build embeds local logo, keeps notices and rejects unsafe paths without replacing release', async () => {
  const { default: os } = await import('node:os'),
    { default: path } = await import('node:path');
  const { initConsumer } = await import('../packages/compiler/zhuda-init.mjs');
  const { runConsumerBuild } = await import('../packages/compiler/consumer-build.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'white-label-'));
  try {
    initConsumer({ target: root, name: 'brand-test', engine: '1.10.0' });
    fs.writeFileSync(
      path.join(root, 'client.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>',
    );
    const branding = { mode: 'custom', brandId: 'client', logo: 'client.svg', title: 'Client' };
    const report = await runConsumerBuild({ projectRoot: root, config: { branding } });
    assert.equal(report.branding.brandId, 'client');
    const dest = path.join(root, 'dist/web/index.html'),
      before = fs.readFileSync(dest);
    assert.ok(before.includes('alt="Client"'));
    assert.ok(
      fs.readFileSync(path.join(root, 'dist/web/zhuda-notices/LICENSE.txt')).includes('MIT'),
    );
    for (const logo of ['../client.svg', 'https://example.com/logo.png', 'missing.png']) {
      await assert.rejects(
        runConsumerBuild({ projectRoot: root, config: { branding: { ...branding, logo } } }),
      );
      assert.deepEqual(fs.readFileSync(dest), before);
    }
    fs.symlinkSync(path.join(root, 'client.svg'), path.join(root, 'linked.svg'));
    await assert.rejects(
      runConsumerBuild({
        projectRoot: root,
        config: { branding: { ...branding, logo: 'linked.svg' } },
      }),
      /symlink/,
    );
    await runConsumerBuild({ projectRoot: root, config: { branding: { mode: 'none' } } });
    assert.doesNotMatch(fs.readFileSync(dest, 'utf8'), /id="zhudaLogoSplash"/);
    assert.ok(fs.existsSync(path.join(root, 'dist/web/zhuda-notices/LICENSE.txt')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
