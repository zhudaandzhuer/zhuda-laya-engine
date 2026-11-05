import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {injectBrandSplash,brandSplashMarkup} from '../packages/compiler/branding.mjs';
const svg=fs.readFileSync(new URL('../assets/branding/zhuda-layaair-mark.svg',import.meta.url),'utf8');
test('consumer brand is self-contained, responsive and before runtime scripts',()=>{const source='<html><head><meta charset="utf-8"></head><body><main id="game"></main><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY --></body></html>';const result=injectBrandSplash(source,svg);assert.equal((result.match(/id="zhudaLogoSplash"/g)||[]).length,1);assert.ok(result.indexOf('id="zhudaLogoSplash"')<result.indexOf('ZHUDA_LIBS'));const data=result.match(/src="data:image\/svg\+xml;base64,([^"]+)"/)[1];assert.equal(Buffer.from(data,'base64').toString(),svg);assert.match(result,/88vw/);assert.match(result,/42svh/);assert.match(result,/safe-area-inset-top/);assert.match(result,/2180/);assert.match(brandSplashMarkup('assets/branding/zhuda-layaair-mark.svg'),/assets\/branding/);});
test('consumer template cannot silently replace or duplicate reserved branding',()=>{assert.throws(()=>injectBrandSplash('<body><div id="zhudaLogoSplash"></div></body>',svg),/Reserved.*remove the custom splash/);});

test('fragment branding preserves standards mode and UTF-8 detection before embedded SVG',()=>{
 const html=injectBrandSplash('<!doctype html><meta charset="utf-8"><div id="game"></div><!-- ZHUDA_LIBS -->',svg);
 assert.match(html,/^<!doctype html>/i);assert.ok(html.indexOf('charset="utf-8"')<1024);assert.ok(html.indexOf('id="zhudaLogoSplash"')>html.indexOf('<body>'));assert.ok(html.indexOf('id="zhudaLogoSplash"')<html.indexOf('ZHUDA_LIBS'));
});

test('body-only document keeps doctype and early charset while branding adds a head',()=>{const html=injectBrandSplash('<!doctype html><html><body><main></main></body></html>',svg);assert.match(html,/^<!doctype html>/);assert.ok(html.indexOf('charset="utf-8"')<1024);});
