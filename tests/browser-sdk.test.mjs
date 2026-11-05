import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {buildBrowserSdk} from '../packages/compiler/browser-sdk.mjs';
import {inspectSceneResources} from '../packages/core/runtime3d/SceneLifecycle.ts';
const root=path.resolve(import.meta.dirname,'..');

test('resource inventory supports a 2D-only runtime without the optional Mesh constructor',()=>{
 class BaseTexture {width=16;height=8;}
 class RenderTexture2D extends BaseTexture {}
 const texture=new BaseTexture(),target=new RenderTexture2D();
 const result=inspectSceneResources({BaseTexture,RenderTexture2D,Resource:{_idResourcesMap:new Map([[1,texture],[2,target]])}});
 assert.deepEqual(result.counts,{mesh:0,texture:1,renderTarget:1});
 assert.equal(result.estimatedBytes,16*8*(4+8));
});

test('browser distribution is deterministic, integrity-pinned, rejects overwrite and duplicate runtimes before mutation',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zhuda-browser-'));
 try{
  const out=path.join(temp,'sdk'),first=await buildBrowserSdk({engineRoot:root,outDir:out});
  assert.equal((await buildBrowserSdk({engineRoot:root,outDir:out})).reused,true);
  for(const [profile,entry] of Object.entries(first.manifest.profiles)){
   const bytes=fs.readFileSync(path.join(out,entry.file));
   assert.equal(entry.sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
   assert.equal(entry.integrity,'sha384-'+crypto.createHash('sha384').update(bytes).digest('base64'));
   assert.equal(entry.bytes,bytes.length);
   assert.match(fs.readFileSync(path.join(out,`example-${profile}.html`),'utf8'),new RegExp(entry.integrity.replace(/[+]/g,'\\+')));
   const previous={sentinel:true},sandbox={Laya:previous};
   assert.throws(()=>new vm.Script(bytes.toString()).runInNewContext(sandbox),/ZHUDA_DUPLICATE_RUNTIME/);
   assert.equal(sandbox.Laya,previous);assert.equal(sandbox.Zhuda,undefined);
  }
  const before=fs.readFileSync(path.join(out,'zhuda-3d.js'));
  fs.writeFileSync(path.join(out,'index.html'),'keep previous output');
  await assert.rejects(buildBrowserSdk({engineRoot:root,outDir:out}),/preserve the prior release/);
  assert.equal(fs.readFileSync(path.join(out,'index.html'),'utf8'),'keep previous output');
  assert.deepEqual(fs.readFileSync(path.join(out,'zhuda-3d.js')),before);
  await assert.rejects(buildBrowserSdk({engineRoot:root,outDir:path.join(temp,'invalid'),profiles:['physics3d']}),/profile/);
  assert.equal(fs.existsSync(path.join(temp,'invalid')),false);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

test('browser globals retain strict public SDK types without a parallel facade',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zhuda-browser-types-'));
 try{
  const file=path.join(temp,'consumer.ts');
  fs.writeFileSync(file,`/// <reference path=${JSON.stringify(path.join(root,'packages/types/browser.d.ts'))} />
async function main(){
 const context=await Zhuda.ZhudaEngine.boot({container:'#view',features:[...ZhudaBundle.features]});
 const library=new Zhuda.ZhudaPrefabLibrary({provider:new Zhuda.DirectoryAssetProvider({baseUrl:'./assets/'}),definitions:[],share3DResources:true});
 context.dispose();library.dispose();
 // @ts-expect-error missing container selector must not hide bad API types
 Zhuda.ZhudaEngine.boot({container:42});
 // @ts-expect-error invented helpers must remain errors
 Zhuda.createAmazingGame();
}
`);
  const program=ts.createProgram([file],{noEmit:true,strict:true,skipLibCheck:false,types:[],target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler});
  const diagnostics=ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
