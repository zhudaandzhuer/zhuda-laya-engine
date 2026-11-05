import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import crypto from 'node:crypto';import os from 'node:os';import ts from 'typescript';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';
import {chromeFixture} from './lib/chrome-fixture.mjs';
const engine=path.resolve(import.meta.dirname,'..'),root=path.resolve(process.env.WEBGPU_OUT||'/tmp/zhuda-webgpu'),consumer=path.join(root,'consumer'),evidence=path.join(root,'evidence');
for(const p of ['src','public/assets','node_modules'])fs.mkdirSync(path.join(consumer,p),{recursive:true});fs.mkdirSync(evidence,{recursive:true});
const write=(p,v)=>fs.writeFileSync(path.join(consumer,p),v),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const version=JSON.parse(fs.readFileSync(path.join(engine,'package.json'))).version;
const packed=JSON.parse(execFileSync('npm',['pack','--json','--pack-destination',root],{cwd:engine,encoding:'utf8',maxBuffer:16e6}))[0];
const sdk=path.join(consumer,'node_modules/zhuda-laya-engine');fs.mkdirSync(sdk,{recursive:true});execFileSync('tar',['-xzf',path.join(root,packed.filename),'-C',sdk,'--strip-components=1']);
for(const dependency of ['@webgpu','i18next','typescript','esbuild']){const dest=path.join(consumer,'node_modules',dependency);if(!fs.existsSync(dest))fs.symlinkSync(path.join(engine,'node_modules',dependency),dest);}
const {runConsumerBuild}=await import(path.join(sdk,'packages/compiler/consumer-build.mjs'));
const esm=await import(path.join(sdk,'dist/sdk/zhuda-laya-engine.esm.js')),cjs=createRequire(import.meta.url)(path.join(sdk,'dist/sdk/zhuda-laya-engine.cjs'));
for(const name of ['ZhudaRendererError','ZhudaEngine','TopologyResolver']){assert.equal(typeof esm[name],'function');assert.equal(typeof cjs[name],'function');}
for(const file of ['Main.ts','prefabs.ts'])fs.copyFileSync(path.join(engine,'tests/fixtures/webgpu',file),path.join(consumer,'src',file));
write('package.json',JSON.stringify({name:'neutral-webgpu-consumer',private:true,type:'module',dependencies:{'zhuda-laya-engine':version}},null,2));
write('public/assets/panel.lh',JSON.stringify({_$id:'panel',_$type:'Sprite',name:'Root',width:640,height:360,_$child:[{_$id:'icon',_$type:'Sprite',name:'Icon',x:30,y:30,width:70,height:70,mouseEnabled:true,_gcmds:[{_$type:'DrawRectCmd',x:0,y:0,width:70,height:70,fillColor:'#26a6f2',percent:false}]},{_$id:'label',_$type:'Label',name:'Label',text:'Zhuda GPU',x:120,y:40,width:260,height:50,font:'Arial',fontSize:28,color:'#ffffff'}]}));
write('public/index.html','<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#152030}#game{position:relative;width:640px;height:360px}</style><body><div id="game"></div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY --></body></html>');
const config={entry:'src/Main.ts',features:['core','2d','3d','ui'],prefabPreview:'src/prefabs.ts',branding:{mode:'none'}};
const program=ts.createProgram([path.join(consumer,'src/Main.ts')],{noEmit:true,strict:true,skipLibCheck:false,types:[],target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler});const diagnostics=ts.getPreEmitDiagnostics(program);assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>consumer,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
for(const renderer of ['webgl','webgpu']){
 const settings={...config,renderer,outDir:'dist/'+renderer+'/web'};write('zhuda.config.json',JSON.stringify(settings));await runConsumerBuild({projectRoot:consumer,config:settings});
 fs.writeFileSync(path.join(evidence,renderer+'-doctor.log'),execFileSync(process.execPath,[path.join(sdk,'packages/compiler/zhuda-doctor.mjs'),'--project',consumer],{encoding:'utf8',maxBuffer:8e6}));
}
await assert.rejects(runConsumerBuild({projectRoot:consumer,config:{...config,renderer:'metal'}}),/zhuda.config.json:1.*RENDERER/);
const server=http.createServer((req,res)=>{try{const file=path.join(consumer,'dist',new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.html')?'text/html':'application/json');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,reports=[];let b;
const identity={version,baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),tarballSha256:sha(fs.readFileSync(path.join(root,packed.filename))),prefabsSha256:sha(fs.readFileSync(path.join(consumer,'src/prefabs.ts'))),node:process.version,os:os.platform()+' '+os.release()};
fs.writeFileSync(path.join(evidence,'identity.json'),JSON.stringify(identity,null,2));
try{
 for(const renderer of ['webgl','webgpu'])for(const dpr of [1,2,3]){
  b=await chromeFixture();await b.send('Emulation.setDeviceMetricsOverride',{width:720,height:480,deviceScaleFactor:dpr,mobile:false});
  const open=async(entry,query='')=>{await b.send('Page.navigate',{url:base+'/'+renderer+'/web/'+entry+'?width=640&height=360&dpr='+dpr+'&'+query});await b.waitFor('(window.backendTest?.ready || window.backendTest?.error || window.__ZHUDA_PREFAB_TEST__?.report()?.ready || window.__ZHUDA_PREFAB_TEST__?.report()?.error)');const error=await b.evaluate('window.backendTest?.error || window.__ZHUDA_PREFAB_TEST__?.report()?.error');assert.equal(error,undefined);};
  const snapshot=async(file)=>{await b.evaluate('(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);await Laya.LayaGL.renderEngine.getDevice?.().queue.onSubmittedWorkDone();})()');const rect=await b.evaluate('(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};})()');const image=await b.send('Page.captureScreenshot',{format:'png',clip:rect});fs.writeFileSync(path.join(evidence,file),Buffer.from(image.data,'base64'));return sha(Buffer.from(image.data,'base64'));};
  const comparisons=[];
  for(const [id,node]of [['backend.2d','Icon'],['backend.2d','Label'],['backend.2d',''],['backend.3d','Body'],['backend.3d','']]){
   await open('prefab-preview.html',`id=${id}&node=${node}`);const preview=await b.evaluate('__ZHUDA_PREFAB_TEST__.report()');assert.equal(preview.renderer.selected,renderer);const first=await snapshot(`${renderer}-${dpr}-${id}-${node||'root'}-preview.png`);
   await open('index.html',`id=${id}&node=${node}`);const scene=await b.evaluate('backendTest.report()');assert.equal(scene.renderer.selected,renderer);assert.deepEqual(scene.canvas,[640*dpr,360*dpr]);const second=await snapshot(`${renderer}-${dpr}-${id}-${node||'root'}-scene.png`);
   assert.equal(second,first,'Preview/Scene pixel mismatch '+renderer+' '+dpr+' '+id+' '+node);comparisons.push({id,node,previewSha256:first,sceneSha256:second,provenance:scene.provenance});
  }
  await open('index.html');await snapshot(`${renderer}-${dpr}-composition.png`);
  await b.send('Input.dispatchMouseEvent',{type:'mousePressed',x:65,y:65,button:'left',clickCount:1});await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:65,y:65,button:'left',clickCount:1});assert.equal(await b.evaluate('backendTest.report().clicks'),1);
  await b.evaluate('window.dispatchEvent(new Event("blur"))');assert.equal(await b.evaluate('backendTest.report().paused'),true);await b.evaluate('window.dispatchEvent(new Event("focus"))');assert.equal(await b.evaluate('backendTest.report().paused'),false);
  await b.evaluate('document.querySelector("#game").style.width="500px"');await b.waitFor('backendTest.report().canvas[0]==='+500*dpr);await b.evaluate('document.querySelector("#game").style.width="640px"');await b.waitFor('backendTest.report().canvas[0]==='+640*dpr);
  let cycles,loss;
  if(dpr===1){cycles=await b.evaluate('backendTest.cycles()');assert.equal(cycles.length,30);assert.deepEqual(cycles[4].resources.counts,cycles.at(-1).resources.counts);}
  if(renderer==='webgpu'){
   await b.evaluate('Laya.LayaGL.renderEngine.getDevice().destroy()');await b.waitFor('backendTest.report().contextLost');loss=await b.evaluate('backendTest.report()');assert.equal(loss.losses,1);assert.equal(loss.paused,true);const ticks=loss.ticks;await b.evaluate('(async()=>{for(let i=0;i<5;i++)await new Promise(requestAnimationFrame);})()');assert.equal(await b.evaluate('backendTest.report().ticks'),ticks);
   await open('index.html');assert.equal(await b.evaluate('backendTest.report().renderer.status'),'ready');
  }
  const report=await b.evaluate('backendTest.report()');assert.deepEqual(report.renderer.errors,[]);await b.evaluate('backendTest.dispose()');await b.evaluate('(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);})()');assert.deepEqual(b.errors,[]);
  reports.push({renderer,dpr,browser:await b.send('Browser.getVersion'),comparisons,cycles,loss,report});fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(reports,null,2));await b.close();b=null;console.log('PASS '+renderer+' DPR '+dpr);
 }
 const failures=[];
 for(const [name,source,query,pattern] of [
  ['missing-gpu',"Object.defineProperty(navigator,'gpu',{value:undefined})",'',/WEBGPU_UNAVAILABLE/],
  ['no-adapter',"navigator.gpu.requestAdapter=async()=>null",'',/WebGPU device|WEBGPU_ADAPTER/],
  ['timeout',"const original=navigator.gpu.requestAdapter.bind(navigator.gpu);navigator.gpu.requestAdapter=async(...a)=>{await new Promise(r=>setTimeout(r,200));return original(...a);}",'timeout=10',/TimeoutError/],
  ['cancel-late-device',"window.destroyedDevices=0;const original=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...args){const device=await original.apply(this,args);window.lateDeviceRequested=true;const destroy=device.destroy.bind(device);device.destroy=()=>{window.destroyedDevices++;destroy();};await new Promise(r=>setTimeout(r,300));return device;}",'',/AbortError/],
  ['preabort','', 'abort=before',/AbortError/],
  ['missing-wasm','', '',/WEBGPU_SHADER_COMPILER/],
 ]){
  b=await chromeFixture();if(source)await b.send('Page.addScriptToEvaluateOnNewDocument',{source});
  if(name==='missing-wasm'){await b.send('Network.enable');await b.send('Network.setBlockedURLs',{urls:['*shader_compiler_web.wasm']});}
  await b.send('Page.navigate',{url:base+'/webgpu/web/index.html?'+query});
  if(name==='cancel-late-device'){await b.waitFor('window.lateDeviceRequested');await b.evaluate('backendAbort()');}
  await b.waitFor('window.backendTest?.error');const error=await b.evaluate('backendTest.error');assert.match(error,pattern);
  await b.evaluate('new Promise(r=>setTimeout(r,500))');const state=await b.evaluate('({booted:window.__ZHUDA_ENGINE_BOOTED__===true,ready:window.backendTest.ready,destroyed:window.destroyedDevices,scene:window.Laya?.stage?.getChildByName("ZhudaRootScene")!=null})');assert.equal(state.booted,false);assert.equal(state.ready,false);assert.equal(state.scene,false);if(name==='cancel-late-device')assert.equal(state.destroyed,1);
  assert.deepEqual(b.errors,[]);failures.push({name,error,state});await b.close();b=null;
 }
 fs.writeFileSync(path.join(evidence,'failures.json'),JSON.stringify(failures,null,2));console.log('PASS WebGPU unavailable, adapter, timeout, abort, late release and compiler failures');
}finally{await b?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
