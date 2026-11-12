import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('generated engine index contains a mandatory responsive Zhuda splash', () => {
  const html = fs.readFileSync(path.join(root, 'dist/web/index.html'), 'utf8');
  assert.match(html, /id="zhudaLogoSplash"/);
  assert.match(html, /assets\/branding\/layaair-tribute-mark\.svg/);
  assert.match(html, /zhuda-splash-logo-in/);
  assert.match(html, /safe-area-inset-top/);
  assert.match(html, /orientation: landscape/);
  assert.match(html, /__ZHUDA_SPLASH__/);
  assert.equal(
    fs.existsSync(path.join(root, 'dist/web/assets/branding/layaair-tribute-mark.svg')),
    true,
  );
});
