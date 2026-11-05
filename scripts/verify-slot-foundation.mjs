import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import crypto from 'node:crypto';import os from 'node:os';import ts from 'typescript';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';
import {chromeFixture} from './lib/chrome-fixture.mjs';import {png} from './lib/neutral-png.mjs';
const engine=path.resolve(import.meta.dirname,'..'),root=path.resolve(process.env.FACTORY_OUT||'/tmp/zhuda-slot-foundation'),consumer=path.join(root,'consumer'),evidence=path.join(root,'evidence');
for(const p of ['src','public/assets','node_modules'])fs.mkdirSync(path.join(consumer,p),{recursive:true});fs.mkdirSync(evidence,{recursive:true});
const write=(p,v)=>{fs.mkdirSync(path.dirname(path.join(consumer,p)),{recursive:true});fs.writeFileSync(path.join(consumer,p),v);};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const version=JSON.parse(fs.readFileSync(path.join(engine,'package.json'))).version;
const packed=JSON.parse(execFileSync('npm',['pack','--json','--pack-destination',root],{cwd:engine,encoding:'utf8',maxBuffer:16e6}))[0];
const sdk=path.join(consumer,'node_modules/zhuda-laya-engine');fs.mkdirSync(sdk,{recursive:true});execFileSync('tar',['-xzf',path.join(root,packed.filename),'-C',sdk,'--strip-components=1']);
for(const dependency of ['@webgpu','i18next','typescript','esbuild']){const dest=path.join(consumer,'node_modules',dependency);if(!fs.existsSync(dest))fs.symlinkSync(path.join(engine,'node_modules',dependency),dest);}
const {runConsumerBuild}=await import(path.join(sdk,'packages/compiler/consumer-build.mjs'));
const esm=await import(path.join(sdk,'dist/sdk/zhuda-laya-engine.esm.js')),cjs=createRequire(import.meta.url)(path.join(sdk,'dist/sdk/zhuda-laya-engine.cjs'));
for(const name of ['ZhudaThemeAssetProvider','ZhudaThemeController','validateThemeManifest','ZhudaResultPlayback']){assert.equal(typeof esm[name],'function');assert.equal(typeof cjs[name],'function');}
fs.copyFileSync(path.join(engine,'tests/fixtures/slot-foundation/Main.ts'),path.join(consumer,'src/Main.ts'));
const symbol=(label)=>({_$id:'symbol',_$type:'Sprite',name:'Symbol',width:100,height:100,_$child:[{_$id:'icon',_$type:'Image',name:'Icon',skin:'icon.png',x:10,y:8,width:80,height:80},{_$id:'label',_$type:'Label',name:'Label',text:label,x:10,y:25,width:80,height:40,font:'Arial',fontSize:28,color:'#ffffff',align:'center',valign:'middle'}]});
const themes=[];
for(const [id,color]of [['a',[30,120,150,255]],['b',[165,60,105,255]]]){
 const item=symbol(id.toUpperCase()),grid={_$id:'grid',_$type:'Sprite',name:'Grid',width:640,height:360,_$child:Array.from({length:15},(_,i)=>({...structuredClone(item),_$id:'cell'+i,name:'Cell'+i,x:50+(i%5)*110,y:20+Math.floor(i/5)*105}))};
 const sources={'symbol.lh':Buffer.from(JSON.stringify(item)),'grid.lh':Buffer.from(JSON.stringify(grid)),'icon.png':png(color)};
 for(const [file,bytes]of Object.entries(sources))write('public/assets/'+id+'/'+file,bytes);
 themes.push({schemaVersion:1,id,revision:'fixture1',contractId:'neutral-grid-v1',estimatedDecodedBytes:400000,assets:Object.entries(sources).map(([file,bytes])=>({id:file,source:id+'/'+file,kind:file.endsWith('.png')?'image':'scene',bytes:bytes.length,sha256:sha(bytes)}))});
}
const definitions=[{id:'factory.symbol',asset:'symbol.lh',textures:['icon.png'],states:{idle:{}}},{id:'factory.grid',asset:'grid.lh',textures:['icon.png'],states:{idle:{}}}],contract={id:'neutral-grid-v1',required:[{id:'symbol.lh',kind:'scene'},{id:'grid.lh',kind:'scene'},{id:'icon.png',kind:'image'}],maxDownloadBytes:100000,maxEstimatedDecodedBytes:500000};
write('src/themes.ts',`export const themes=${JSON.stringify(themes)};\nexport const contract=${JSON.stringify(contract)};\nexport const definitions=${JSON.stringify(definitions)};\n`);
write('package.json',JSON.stringify({name:'neutral-slot-foundation',private:true,type:'module',dependencies:{'zhuda-laya-engine':version}},null,2));
write('public/index.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#152030}#game{width:640px;height:360px}</style></head><body><div id="game"></div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY --></body></html>');
write('client.svg','<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80"><rect width="300" height="80" fill="#26a6f2"/><text x="150" y="50" text-anchor="middle" font-size="30" fill="white">CUSTOM BRAND</text></svg>');
const config={entry:'src/Main.ts',profile:'2d-light',assetInclude:['a','b']};write('zhuda.config.json',JSON.stringify(config));
const program=ts.createProgram([path.join(consumer,'src/Main.ts')],{noEmit:true,strict:true,skipLibCheck:false,types:[],target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler});const diagnostics=ts.getPreEmitDiagnostics(program);assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>consumer,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
for(const [mode,branding]of [['engine',{mode:'engine'}],['custom',{mode:'custom',brandId:'client',logo:'client.svg',title:'Customer'}],['none',{mode:'none'}]])await runConsumerBuild({projectRoot:consumer,config:{...config,outDir:'dist/'+mode+'/web',branding}});
// Doctor inspects the same public consumer sources/config.
fs.writeFileSync(path.join(evidence,'doctor.log'),execFileSync(process.execPath,[path.join(sdk,'packages/compiler/zhuda-doctor.mjs'),'--project',consumer],{encoding:'utf8',maxBuffer:8e6}));
const identity={version,baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),tarballSha256:sha(fs.readFileSync(path.join(root,packed.filename))),coreSha256:sha(fs.readFileSync(path.join(consumer,'src/Main.ts'))),themeSourceSha256:sha(fs.readFileSync(path.join(consumer,'src/themes.ts'))),node:process.version,os:os.platform()+' '+os.release()};fs.writeFileSync(path.join(evidence,'identity.json'),JSON.stringify(identity,null,2));
const server=http.createServer((req,res)=>{try{const file=path.join(consumer,'dist',new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.png')?'image/png':file.endsWith('.html')?'text/html':'application/json');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,reports=[];let b;
try{
 for(const dpr of [1,2,3]){
  b=await chromeFixture();await b.send('Emulation.setDeviceMetricsOverride',{width:720,height:480,deviceScaleFactor:dpr,mobile:false});
  await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.draws=0;const seen=new WeakSet(),original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args){const gl=original.apply(this,args);if(gl&&!seen.has(gl)&&gl.drawArrays){seen.add(gl);for(const name of ['drawArrays','drawElements']){const f=gl[name];gl[name]=function(...a){window.draws++;return f.apply(gl,a);};}}return gl;};`});
  const open=async(mode,query)=>{await b.send('Page.navigate',{url:base+'/'+mode+'/web/index.html?'+query});await b.waitFor('window.factoryTest?.ready || window.factoryError');assert.equal(await b.evaluate('window.factoryError'),undefined);await b.waitFor('window.__ZHUDA_SPLASH__?.completed');await b.waitFor('!document.querySelector("#zhudaLogoSplash")');};
  const comparisons=[];
  for(const theme of ['a','b'])for(const [id,node]of [['factory.symbol','Icon'],['factory.symbol','Label'],['factory.symbol',''],['factory.grid','']]){
   let first,provenance;
   for(const pass of ['reference','actual']){
    await open('none',`theme=${theme}&id=${id}&node=${node}`);const report=await b.evaluate('factoryTest.report()');assert.deepEqual(report.canvas,[640*dpr,360*dpr]);assert.equal(report.dpr,dpr);assert.ok(await b.evaluate('draws>0'));
    const canvas=await b.evaluate('document.querySelector("canvas").toDataURL()');const file=`${dpr}-${theme}-${id}-${node||'root'}-${pass}.png`;fs.writeFileSync(path.join(evidence,file),Buffer.from(canvas.split(',')[1],'base64'));
    if(pass==='reference'){first=canvas;provenance=report.provenance;}else{assert.equal(canvas,first);assert.deepEqual(report.provenance,provenance);comparisons.push({theme,id,node,exactReplay:true,provenance});}
    await b.evaluate('factoryTest.dispose()');
   }
  }
  const brands=[];
  for(const mode of ['engine','custom','none'])for(const theme of ['a','b']){await open(mode,`theme=${theme}`);const r=await b.evaluate('factoryTest.report()');assert.equal(r.theme,theme);assert.equal(await b.evaluate('__ZHUDA_SPLASH__.mode'),mode);brands.push({mode,theme,provenance:r.provenance});await b.evaluate('factoryTest.dispose()');}
  await open('none','theme=a');const failure=await b.evaluate('factoryTest.failure()');assert.match(failure.error,/integrity/);assert.equal(failure.kept,true);
  let lifecycle,benchmark,recovery;
  if(dpr===1){lifecycle=await b.evaluate('factoryTest.cycles()');assert.equal(lifecycle.length,100);assert.deepEqual(lifecycle[9].counts,lifecycle.at(-1).counts);benchmark=await b.evaluate('factoryTest.benchmark()');assert.equal(benchmark.rounds,1000);recovery=await b.evaluate('factoryTest.recovery()');assert.equal(recovery.locked,true);assert.equal(recovery.unlocked,true);assert.equal(recovery.after.completed,true);}
  const report=await b.evaluate('factoryTest.report()');assert.ok(report.releases.every(r=>r.instances===0&&r.references===0&&r.entries===0));await b.evaluate('factoryTest.dispose()');assert.deepEqual(b.errors,[]);
  reports.push({dpr,browser:await b.send('Browser.getVersion'),comparisons,brands,failure,lifecycle,benchmark,recovery,report,limits:['desktop CDP DPR emulation; physical mobile unavailable','1000 fixture rounds is not a 60-minute device test','decoded estimates are not GPU memory measurements']});fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(reports,null,2));await b.close();b=null;console.log('PASS foundation DPR '+dpr);
 }
}finally{await b?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
