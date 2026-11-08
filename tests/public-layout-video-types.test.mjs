import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

test('strict consumer can import layout, BitmapFont and Laya video contracts from the public package', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-layout-video-types-'));
  try {
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.symlinkSync(path.resolve('.'), path.join(root, 'node_modules/zhuda-laya-engine'), 'dir');
    const file = path.join(root, 'consumer.ts');
    fs.writeFileSync(file, `
      import { computeZhudaGridLayout, computeZhudaTextLayout, measureZhudaBitmapText, validateZhudaBitmapFont, ZhudaVideoSurface, ZhudaWebViewSurface } from 'zhuda-laya-engine';
      import type { ZhudaBitmapFontManifest, ZhudaWebViewAdapter } from 'zhuda-laya-engine';
      const grid = computeZhudaGridLayout({viewport:{width:640,height:360},design:{width:320,height:180},columns:2,rows:2});
      const text = computeZhudaTextLayout({box:{x:0,y:0,width:100,height:40},metrics:{width:50,height:20,baseline:15},align:'center',valign:'middle'});
      const manifest: ZhudaBitmapFontManifest = {schemaVersion:1,id:'font',textureId:'font.png',fontSize:32,lineHeight:36,baseline:26,glyphs:[{char:'A',x:0,y:0,width:20,height:26,xAdvance:21}]};
      const report = validateZhudaBitmapFont(manifest, 'A');
      const width: number = measureZhudaBitmapText(manifest, 'A').width;
      declare const parent: Laya.Sprite;
      const video = new ZhudaVideoSurface({parent, source:'intro.webm'});
      video.dispose();
      const adapter: ZhudaWebViewAdapter = { mount() {}, update() {}, dispose() {} };
      const webview = new ZhudaWebViewSurface({parent, adapter});
      webview.dispose();
      void [grid, text, report, width];
    `);
    const program = ts.createProgram([file], {noEmit:true, strict:true, skipLibCheck:false, types:[], target:ts.ScriptTarget.ES2020, module:ts.ModuleKind.ESNext, moduleResolution:ts.ModuleResolutionKind.Bundler});
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
  } finally {
    fs.rmSync(root, {recursive:true, force:true});
  }
});
