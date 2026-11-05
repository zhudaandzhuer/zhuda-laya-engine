import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { runConsumerBuild } from '../packages/compiler/consumer-build.mjs';
const engineRoot=path.resolve(import.meta.dirname,'..');
const root=path.resolve(process.env.CROWD_FIXTURE_DIR||'/tmp/zhuda-crowd-acceptance');
const consumer=path.join(root,'consumer'),evidence=path.join(root,'evidence');
for(const sub of ['src','public/assets','node_modules'])fs.mkdirSync(path.join(consumer,sub),{recursive:true});fs.mkdirSync(evidence,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const revision='4995a638c96dbc94376d3d6164e70fee3ac7f7a2',base=`https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/${revision}/`;
const assetDir=path.join(root,'assets');fs.mkdirSync(assetDir,{recursive:true});
for(const [source,target] of [['Models/CesiumMan/glTF-Binary/CesiumMan.glb','CesiumMan.glb'],['Models/CesiumMan/README.md','CesiumMan-README.md'],['Models/CesiumMan/metadata.json','CesiumMan-metadata.json'],['LICENSES/LicenseRef-LegalMark-Cesium.txt','Cesium-Logo-LICENSE.txt']]){
 const file=path.join(assetDir,target);if(!fs.existsSync(file)){const r=await fetch(base+source);if(!r.ok)throw Error(`${r.status} ${source}`);fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));}
}
const model=fs.readFileSync(path.join(assetDir,'CesiumMan.glb'));assert.equal(sha(model),'b7001eaeea8254bd44773bcd247e78696d94169388fbb2a1800fc69434e777d9');fs.writeFileSync(path.join(consumer,'public/assets/CesiumMan.glb'),model);
const json=JSON.parse(model.subarray(20,20+model.readUInt32LE(12)).toString());
const inventory={repository:'KhronosGroup/glTF-Sample-Assets',revision,sha256:sha(model),bytes:model.length,triangles:json.meshes.reduce((n,m)=>n+m.primitives.reduce((n,p)=>n+json.accessors[p.indices].count/3,0),0),joints:json.skins.map(s=>s.joints.length),animations:json.animations.length,license:'Cesium, 2017, CC-BY-4.0; logo trademark notice retained',source:base+'Models/CesiumMan/README.md'};
fs.writeFileSync(path.join(evidence,'model-inventory.json'),JSON.stringify(inventory,null,2));
fs.cpSync(path.join(engineRoot,'tests/fixtures/crowd'),path.join(consumer,'src'),{recursive:true});
const version=JSON.parse(fs.readFileSync(path.join(engineRoot,'package.json'))).version;
const packed=JSON.parse(execFileSync('npm',['pack','--json','--pack-destination',root],{cwd:engineRoot,encoding:'utf8',maxBuffer:16*1024*1024}))[0];
const sdk=path.join(consumer,'node_modules/zhuda-laya-engine');fs.mkdirSync(sdk,{recursive:true});execFileSync('tar',['-xzf',path.join(root,packed.filename),'-C',sdk,'--strip-components=1']);
for(const dependency of ['@webgpu','i18next','typescript','esbuild']){const dest=path.join(consumer,'node_modules',dependency);if(!fs.existsSync(dest))fs.symlinkSync(path.join(engineRoot,'node_modules',dependency),dest);}
fs.writeFileSync(path.join(consumer,'package.json'),JSON.stringify({name:'zhuda-crowd-independent-fixture',private:true,type:'module',dependencies:{'zhuda-laya-engine':version}},null,2));
fs.writeFileSync(path.join(consumer,'public/index.html'),`<!doctype html><meta charset="utf-8"><style>html,body,#game{margin:0;width:100%;height:100%;background:#0f1724;overflow:hidden}#game{position:absolute}#hud{pointer-events:none;position:absolute;inset:0}.actor-hud{position:absolute;color:#fff;font:10px sans-serif;border-bottom:3px solid #66dfb0;transform-origin:center;white-space:nowrap}</style><div id="game"></div><div id="hud"></div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY -->`);
const config={name:'crowd-fixture',entry:'src/Main.ts',features:['core','2d','3d','gltf'],assetInclude:['CesiumMan.glb']};fs.writeFileSync(path.join(consumer,'zhuda.config.json'),JSON.stringify(config,null,2));
const program=ts.createProgram([path.join(consumer,'src/Main.ts')],{noEmit:true,strict:true,skipLibCheck:false,types:[],target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler});
const diagnostics=ts.getPreEmitDiagnostics(program);assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>consumer,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
await runConsumerBuild({projectRoot:consumer,engineRoot:sdk,config});
const esm=await import(path.join(sdk,'dist/sdk/zhuda-laya-engine.esm.js'));const {createRequire}=await import('node:module');const cjs=createRequire(import.meta.url)(path.join(sdk,'dist/sdk/zhuda-laya-engine.cjs'));
for(const name of ['ZhudaCrowdScheduler','ZhudaRemoteCharacterPresenter','ZhudaAnimatorLOD','ZhudaModelLibrary','ZhudaRuntimeProfiler'])assert.equal(typeof esm[name],typeof cjs[name]);
const identity={version,baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:engineRoot,encoding:'utf8'}).trim(),sourceDiffSha256:sha(execFileSync('git',['diff','HEAD'],{cwd:engineRoot,maxBuffer:32*1024*1024})),tarball:packed.filename,tarballSha256:sha(fs.readFileSync(path.join(root,packed.filename))),node:process.version,os:{platform:os.platform(),release:os.release(),arch:os.arch(),cpus:os.cpus()[0]?.model,totalMemory:os.totalmem()},sources:Object.fromEntries(['Main.ts','character.ts'].map(f=>[f,sha(fs.readFileSync(path.join(consumer,'src',f)))]))};fs.writeFileSync(path.join(evidence,'identity.json'),JSON.stringify(identity,null,2));
if(process.env.CROWD_PREPARE_ONLY==='1'){console.log('Prepared independent packed consumer: '+consumer);process.exit(0);}
// Transport is a consumer test server. Deterministic latency, loss and an epoch change;
// it models positions, not combat authority, login, AOI or a production MMO backend.
const networkLog=[];let sequence=0;
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/snapshots'){
  const seq=++sequence,epoch=seq<35?'initial':'reconnected',time=seq*.1;
  const packet={epoch,sequence:seq,time,dropped:seq%7===0,actors:Array.from({length:100},(_,i)=>({id:String(i),value:{x:(i%10-4.5)*1.25+Math.sin(time*.5+i)*.2,z:(Math.floor(i/10)-4.5)*1.25},teleport:seq===55&&i===0}))};
  networkLog.push({sequence:seq,epoch,dropped:packet.dropped,latencyMs:seq%3*20});setTimeout(()=>res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(packet)),seq%3*20);return;
 }
 const file=path.resolve(consumer,'dist/web','.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
 if(!file.startsWith(path.join(consumer,'dist/web')+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;
const seconds=Number(process.env.CROWD_SECONDS||15);if(!Number.isFinite(seconds)||seconds<1)throw Error('Invalid duration');
const scenarios=(process.env.CROWD_SCENARIOS||'selection-character,selection-equipment,selection-warning,selection-sparks,selection-ribbon,bare-25,bare-50,bare-100,equipped-100,unique-100,full-100,budget-100,network-100,instances-100,instances-300,instances-500').split(',');
const reports=[];let browser;
try{
 for(const scenario of scenarios){
  browser=await chromeFixture();await browser.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  const isolated=scenario.startsWith('selection-'),[mode,count]=scenario.split('-');
  let animationEvidence;
  const query=isolated?`selection=${count}&count=1`:`mode=${mode}&count=${count}`;
  await browser.send('Page.navigate',{url:url+'/?'+query});await browser.waitFor('!!window.crowd');const ready=await browser.evaluate('window.crowd.ready');assert.equal(ready,true,JSON.stringify({error:await browser.evaluate('window.crowd.error'),browserErrors:browser.errors}));
  await browser.waitFor('!document.querySelector("#zhudaLogoSplash") || getComputedStyle(document.querySelector("#zhudaLogoSplash")).display==="none" || getComputedStyle(document.querySelector("#zhudaLogoSplash")).opacity==="0"');
  await browser.evaluate('window.crowd.start()');
  if(isolated){
   await new Promise(r=>setTimeout(r,500));await browser.screenshot(path.join(evidence,scenario+'-reference.png'));
   await browser.evaluate('window.crowd.dispose()');
   await browser.send('Page.navigate',{url:url+'/?'+query});await browser.waitFor('!!window.crowd?.ready');
   await browser.waitFor('!document.querySelector("#zhudaLogoSplash")');await browser.evaluate('window.crowd.start()');
   await new Promise(r=>setTimeout(r,500));await browser.screenshot(path.join(evidence,scenario+'-actual.png'));
   const comparison=JSON.parse(execFileSync('python3',['-c',`import sys,json
from PIL import Image,ImageChops
a=Image.open(sys.argv[1]).convert('RGB');b=Image.open(sys.argv[2]).convert('RGB')
d=ImageChops.difference(a,b);changed=sum(1 for p in d.getdata() if max(p)>2)
colors=b.getcolors(b.width*b.height);foreground=b.width*b.height-max(n for n,c in colors)
print(json.dumps({'changedPixels':changed,'foregroundPixels':foreground,'pixels':b.width*b.height,'passed':foreground>32 and changed/(b.width*b.height)<.001}))`,path.join(evidence,scenario+'-reference.png'),path.join(evidence,scenario+'-actual.png')],{encoding:'utf8'}));
   fs.writeFileSync(path.join(evidence,scenario+'-comparison.json'),JSON.stringify({...comparison,selection:count,state:'deterministic bind pose / fixed-seed effect',source:identity.sources,model:inventory.sha256},null,2));
   assert.equal(comparison.passed,true,JSON.stringify(comparison));
  }else{
   // Short warmup outside the reported measurement interval.
   await new Promise(r=>setTimeout(r,1000));
   if(mode!=='instances') {
    const before=await browser.evaluate('window.crowd.report().animation');
    await new Promise(r=>setTimeout(r,250));
    const after=await browser.evaluate('window.crowd.report().animation');
    const angles=after.map((a,i)=>{const q=a.localRotation,p=before[i].localRotation;const dot=q.x*p.x+q.y*p.y+q.z*p.z+q.w*p.w;return 2*Math.acos(Math.min(1,Math.abs(dot)/(Math.hypot(q.x,q.y,q.z,q.w)*Math.hypot(p.x,p.y,p.z,p.w))));});
    animationEvidence={before,after,maxJointAngleRadians:Math.max(...angles),scope:'250 ms warmup; actual local joint quaternion, before timed profile'};
    assert.ok(after.some((a,i)=>a.normalizedTime>before[i].normalizedTime),'Native Animator timeline must advance');
    assert.ok(animationEvidence.maxJointAngleRadians>.001,'A real skeleton joint must rotate beyond floating point noise');
   }
   await browser.evaluate('window.crowd.start()');
   const start=Date.now();while(Date.now()-start<seconds*1000)await new Promise(r=>setTimeout(r,Math.min(1000,seconds*1000-(Date.now()-start))));
   await browser.screenshot(path.join(evidence,scenario+'.png'));
  }
  const report=await browser.evaluate('window.crowd.report()');if(animationEvidence)report.animationEvidence=animationEvidence;assert.ok(report.profile.samples.some(s=>s.drawCalls>0),'Real draws required');assert.equal(browser.errors.length,0,browser.errors.join('\n'));
  if(mode==='network'){assert.ok(report.network.packets>0);assert.equal(report.network.error,undefined);}
  if(scenario==='bare-25'){report.lifecycle=await browser.evaluate('window.crowd.lifecycle()');const first=report.lifecycle[0],last=report.lifecycle.at(-1);assert.equal(last.resources.resources,first.resources.resources,'Full model reload cycles must stay bounded');assert.ok(report.lifecycle.every(x=>x.models.references===0&&x.models.instances===0));}
  if(scenario==='bare-100') {
   // Separate short diagnostic trace; timing statistics above exclude its overhead.
   await browser.send('Tracing.start',{categories:'devtools.timeline,v8,disabled-by-default-v8.gc',transferMode:'ReturnAsStream'});
   await new Promise(r=>setTimeout(r,2000));const done=browser.waitEvent('Tracing.tracingComplete');await browser.send('Tracing.end');const {stream}=await done;
   const chunks=[];for(;;){const part=await browser.send('IO.read',{handle:stream,size:1048576});chunks.push(Buffer.from(part.data,part.base64Encoded?'base64':'utf8'));if(part.eof)break;}
   await browser.send('IO.close',{handle:stream});fs.writeFileSync(path.join(evidence,'bare-100-trace.json'),Buffer.concat(chunks));
  }
  report.disposed=await browser.evaluate('window.crowd.dispose()');assert.equal(report.disposed.models.instances,0);assert.equal(report.disposed.models.references,0);
  const file=path.join(evidence,scenario+'.json');fs.writeFileSync(file,JSON.stringify(report,null,2));
  reports.push({scenario,file,frame:report.profile.frame,cpu:report.profile.cpu,gpu:report.profile.gpu,drawCalls:report.profile.samples.reduce((n,s)=>n+s.drawCalls,0)/report.profile.samples.length,samples:report.profile.totalSamples,renderer:report.renderer});
  console.log(JSON.stringify(reports.at(-1)));await browser.close();browser=undefined;
 }
 fs.writeFileSync(path.join(evidence,'summary.json'),JSON.stringify({identity,seconds,inventory,reports,networkLog,limits:['Headless local WebGL only; not target RTX3060/GTX1650 or physical mobile','One locomotion clip; no attack/death/combat acceptance','CPU scope is Stage.render; consumer callback time reported separately','GPU memory is estimated; JS heap excludes native allocations','Network uses HTTP snapshot fixture; no production AOI/2,000 CCU claim']},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
