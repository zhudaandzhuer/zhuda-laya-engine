/** Real browser gate. Portable Windows/macOS/Linux entry; no software-backend PASS. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';import assert from 'node:assert/strict';
import {chromeFixture} from './lib/chrome-fixture.mjs';
const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
const root=path.resolve(option('--out')||process.env.WEBGPU_BROWSER_OUT||path.join(os.tmpdir(),'zhuda-webgpu-browser'));
fs.mkdirSync(root,{recursive:true});let base,server;
if(args.includes('--url'))base=option('--url').replace(/\/?$/,'/');
else {const dir=path.resolve(process.env.WEBGPU_BROWSER_DIR||'dist/browser/'+JSON.parse(fs.readFileSync('package.json')).version);server=http.createServer((req,res)=>{try{const file=path.join(dir,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;}
const results=[];let b;
try{
 for(const profile of ['2d-webgpu','3d-webgpu','3d-gltf-webgpu']){
  b=await chromeFixture();await b.send('Emulation.setDeviceMetricsOverride',{width:1100,height:1000,deviceScaleFactor:2,mobile:false});
  await b.send('Page.navigate',{url:base+`example-${profile}.html?cycles=30&dpr=2`});await b.waitFor('(window.__ZHUDA_PREFAB_TEST__||window.__ZHUDA_MODEL_TEST__)?.report()?.ready || (window.__ZHUDA_PREFAB_TEST__||window.__ZHUDA_MODEL_TEST__)?.report()?.error');
  const get=()=>b.evaluate('(window.__ZHUDA_PREFAB_TEST__||window.__ZHUDA_MODEL_TEST__).report()');let report=await get();assert.ok(!report.error,report.error);assert.equal(report.renderer.selected,'webgpu');assert.equal(report.renderer.nativeEngine,'WebGPURenderEngine');assert.equal(report.renderer.adapter.isFallbackAdapter,false,'Hardware WebGPU required; software adapter is not device acceptance');assert.equal(report.renderer.status,'ready');
  if(profile==='3d-webgpu'){
   // Deterministic, separately captured engine recipes; the base Prefab stays selectable.
   const effect=await b.evaluate(`(async()=>{
    const scene=Zhuda.ZhudaEngine.getContext().rootScene.getChildAt(0),camera=scene.getChildAt(0);
    const tree=Zhuda.Zhuda3D.buildPrefabTree({materials:{base:{type:'unlit',albedoColor:[1,1,1,1]}},root:{name:'ShaderProbe',mesh:{type:'sphere'},material:'base',localPosition:[-1.4,0,0]}});scene.addChild(tree.root);
    const shader=new Zhuda.ZhudaShaderMaterial({...Zhuda.shaderRecipes.terrain3D,fog:false});tree.root.meshRenderer.sharedMaterial=shader.material;
    const spec={id:'backend.particles',texture:'engine-white',maxParticles:16,seed:42,space:'world',blend:'alpha',shape:{type:'sphere',radius:.5},direction:{x:0,y:1,z:0},spread:1,rate:0,bursts:[{time:0,count:16}],lifetime:5,speed:.5,size:.15};
    const particles=new Zhuda.ZhudaParticleSystem3D(spec),renderer=new Zhuda.ZhudaLayaParticleRenderer3D(particles,scene,()=>Laya.Texture2D.whiteTexture);particles.setTransform(1.4,0,0);particles.play(true);particles.update(.1);renderer.render(camera);Zhuda.ZhudaEngine.flushRenderFrames(3);
    window.__effectDispose=()=>{renderer.dispose();particles.clear();tree.dispose();shader.dispose();};
    for(let i=0;i<6;i++)await new Promise(requestAnimationFrame);await Laya.LayaGL.renderEngine.getDevice().queue.onSubmittedWorkDone();return {id:'backend.shader+particles',particles:particles.aliveCount,batches:renderer.submittedBatches,seed:42,seconds:.1};
   })()`);
   assert.equal(effect.particles,16);assert.equal(effect.batches,1);await b.screenshot(path.join(root,'3d-webgpu-shader-particles.png'));assert.deepEqual((await get()).renderer.errors,[]);await b.evaluate('__effectDispose()');report.effect=effect;
  }
  const modes=[];
  if(profile==='3d-gltf-webgpu'){
   for(const mode of ['raw','gameplay','cinematic']){
    await b.evaluate(`document.querySelector('#mode').value=${JSON.stringify(mode)};document.querySelector('#mode').dispatchEvent(new Event('change'))`);await b.evaluate('(async()=>{for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);await Laya.LayaGL.renderEngine.getDevice().queue.onSubmittedWorkDone();})()');
    const r=await get();assert.equal(r.mode,mode);assert.deepEqual(r.renderer.errors,[],mode+' GPU validation');modes.push({mode,report:r});await b.screenshot(path.join(root,profile+'-'+mode+'.png'));
   }
   await b.evaluate('__ZHUDA_MODEL_TEST__.cycles(30)');report=await get();assert.equal(report.completedCycles,30);
  }else {assert.equal(report.lifecycleCheck.completedCycles,30);assert.deepEqual(report.lifecycleCheck.before.counts,report.lifecycleCheck.after.counts);await b.screenshot(path.join(root,profile+'.png'));}
  await b.evaluate('(window.__ZHUDA_MODEL_TEST__?.dispose ?? (()=>document.querySelector("#dispose").click()))()');await b.evaluate('(async()=>{for(let i=0;i<5;i++)await new Promise(requestAnimationFrame);})()');assert.deepEqual(b.errors,[]);assert.deepEqual(report.renderer.errors,[]);
  results.push({profile,source:base,os:os.platform()+' '+os.release(),browser:await b.send('Browser.getVersion'),report,modes,errors:b.errors});fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(results,null,2));await b.close();b=null;console.log('PASS real WebGPU '+profile);
 }
}finally{await b?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
