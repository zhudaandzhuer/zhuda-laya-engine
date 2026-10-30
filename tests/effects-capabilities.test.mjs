import test from 'node:test';
import assert from 'node:assert/strict';
import {ZhudaParticleSystem} from '../packages/core/particles/ParticleSystem.ts';
import {ZhudaParticleSystem3D} from '../packages/core/particles/ParticleSystem3D.ts';
import {sampleParticleUV} from '../packages/core/particles/ParticleExtras.ts';
import {validateParticleEffect} from '../packages/core/particles/ParticleTypes.ts';
import {ZhudaParticleEventLink} from '../packages/core/effects/ParticleEventLink.ts';
import {ZhudaEffectDirector,validateEffectTimeline} from '../packages/core/effects/EffectDirector.ts';
import {ZhudaEffectBudget,ZhudaRuntimeProfiler} from '../packages/core/effects/EffectBudget.ts';
import {convertUnityVisualMaterial,convertUnityAnimationCurve,compareVisualFrames} from '../packages/core/VisualMigrationPipeline.ts';
import {UnityBridgePipeline} from '../packages/core/UnityBridgePipeline.ts';
import {ZhudaBenchmarkEngine} from '../packages/core/BenchmarkEngine.ts';
const emitter=patch=>({id:'test',texture:'texture',maxParticles:32,seed:1,space:'world',blend:'alpha',shape:{type:'point'},rate:0,lifetime:2,speed:4,angle:Math.PI/2,size:1,...patch});
test('flipbook respects partial atlas, frame subsets, time, wrapping and clamping',()=>{
 const out={};const s={textureRect:{x:.5,y:.25,width:.5,height:.5},flipbook:{columns:2,rows:2,startFrame:1,frameCount:3,fps:10,loop:false}};
 sampleParticleUV(s,.2,1,out);assert.deepEqual(out,{x:.75,y:.5,width:.25,height:.25});
 s.flipbook.loop=true;sampleParticleUV(s,.3,1,out);assert.equal(out.y,.25);
 for(const bad of [{flipbook:{columns:0,rows:2}},{textureRect:{x:.8,y:0,width:.5,height:1}},{collision:{planes:[{normal:{x:0,y:0},offset:0}]}}])assert.ok(validateParticleEffect({schemaVersion:1,emitters:[emitter(bad)]}).length);
});
test('plane collision reflects and dissipates velocity, kill spawns children at the contact point',()=>{
 const source=new ZhudaParticleSystem(emitter({collision:{planes:[{normal:{x:0,y:-1},offset:-1}],restitution:.5}}));source.burst(1);source.update(.25);source.update(.01);assert.ok(source.snapshot()[0].vy<0);assert.ok(source.snapshot()[0].y<=1);
 const child=new ZhudaParticleSystem(emitter({speed:0}));const rain=new ZhudaParticleSystem(emitter({collision:{planes:[{normal:{x:0,y:-1},offset:-.5}],killOnCollision:true}}));const link=new ZhudaParticleEventLink(rain,child,{event:'collision',count:3});rain.burst(1);rain.update(.2);assert.equal(rain.aliveCount,0);assert.equal(child.aliveCount,3);assert.ok(child.snapshot().every(p=>Math.abs(p.y-.5)<1e-8));link.dispose();
});
test('XYZ collisions and events replay identically at 30/60/120fps; admission limits do not erase survivors',()=>{
 const results=[30,60,120].map(fps=>{const e=[];const s=new ZhudaParticleSystem3D({...emitter(),direction:{x:0,y:0,z:-1},spread:0,collision:{planes:[{normal:{x:0,y:0,z:1},offset:-.4}],restitution:.6}});s.onEvent=x=>e.push(x);s.burst(8);for(let i=0;i<fps;i++)s.update(1/fps);return{s:s.snapshot(),e};});assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);assert.equal(results[0].e[0].type,'collision');
 const s=new ZhudaParticleSystem(emitter());s.particleLimit=5;s.burst(20);assert.equal(s.aliveCount,5);s.particleLimit=0;s.burst(1);assert.equal(s.aliveCount,5);assert.throws(()=>{s.particleLimit=NaN});
});
test('disposing chained event links in either order cannot emit into a retired child',()=>{
 const source=new ZhudaParticleSystem(emitter({lifetime:.01})),first=new ZhudaParticleSystem(emitter()),second=new ZhudaParticleSystem(emitter());let events=0;source.onEvent=()=>events++;
 const a=new ZhudaParticleEventLink(source,first,{event:'death',count:1}),b=new ZhudaParticleEventLink(source,second,{event:'death',count:2});
 a.dispose();source.burst(1);source.update(.02);assert.equal(first.aliveCount,0);assert.equal(second.aliveCount,2);assert.equal(events,1);
 b.dispose();source.burst(1);source.update(.02);assert.equal(first.aliveCount,0);assert.equal(second.aliveCount,2);assert.equal(events,2);
});
test('director handles endpoints, loop boundaries, event-free seeking, interpolation and rotated bone attachments',()=>{
 const events=[],values=[];let transform;const spec={version:1,duration:1,loop:true,tracks:[{target:'fx',parameter:'strength',keys:[{time:0,value:0},{time:1,value:2}]}],cues:[{time:0,target:'fx',action:'start'},{time:.5,target:'fx',action:'event',name:'sound'},{time:1,target:'fx',action:'stop'}],attachments:[{target:'fx',source:'rig',anchor:'hand',offset:{x:2,y:0}}]};
 const bindings={fx:{reset(){events.length=0},start(){events.push('start')},stop(){events.push('stop')},event(n){events.push(n)},setParameter(n,v){values.push(v)},setTransform(p){transform=p}},rig:{reset(){},resolveAnchor(){return{x:5,y:3,rotation:Math.PI/2}}}};
 const d=new ZhudaEffectDirector(spec,bindings);d.play();d.update(.5);assert.deepEqual(events,['start','sound']);assert.equal(values.at(-1),1);assert.ok(Math.abs(transform.x-5)<1e-8);assert.equal(transform.y,5);d.update(.5);d.update(.1);assert.deepEqual(events,['start','sound','stop','start']);d.seek(.75);assert.deepEqual(events,['start']);assert.equal(values.at(-1),1.5);assert.equal(d.playing,false);assert.ok(validateEffectTimeline({...spec,tracks:{}}).length);
});
test('global particle/coverage budget preserves priority, bounded totals and quality hysteresis',()=>{
 const b=new ZhudaEffectBudget({maxParticles:100,maxCoverage:2});const r=b.allocate([{id:'far',particles:100,coverage:1,priority:0},{id:'hit',particles:80,coverage:1,priority:10},{id:'hidden',particles:100,coverage:1,priority:20,visible:false}]);assert.equal(r[1].particleLimit,80);assert.equal(r[0].particleLimit,20);assert.equal(r[2].particleLimit,0);for(let i=0;i<15;i++)b.observeFrame(40);assert.ok(b.quality<1);const q=b.quality;for(let i=0;i<30;i++)b.observeFrame(10);assert.equal(b.quality,q);assert.throws(()=>b.allocate([{id:'a',particles:1,coverage:-1,priority:1}]));
});
test('profiler counts actual calls/triangles, reports no fabricated GPU time and restores wrappers',()=>{
 const original=()=>{};const gl={TRIANGLES:4,drawElements:original,drawArrays:original};const p=new ZhudaRuntimeProfiler();p.attach(gl);p.beginFrame();gl.drawElements(4,12,0,0);gl.drawArrays(4,0,6);assert.deepEqual(p.endFrame(20,2),{frameMs:20,cpuMs:2,drawCalls:2,triangles:6});assert.equal(p.report().gpuTimeMs,null);p.dispose();assert.equal(gl.drawElements,original);
});
test('migration preserves PBR parameters and blocks unknown shaders; Hermite curve error stays within tolerance',()=>{
 const m=convertUnityVisualMaterial({id:'metal',shader:'Standard',metallic:.8,smoothness:.7,color:[.1,.3,.5,1]});assert.equal(m.target,'PBRStandardMaterial');assert.equal(m.properties.metallic,.8);assert.equal(UnityBridgePipeline.mapUnityShaderToLayaMaterialClass('Standard'),'Laya.PBRStandardMaterial');assert.throws(()=>convertUnityVisualMaterial({id:'x',shader:'Some/Unknown'}),/Unmapped/);assert.throws(()=>UnityBridgePipeline.mapUnityShaderToLayaMaterialClass('Some/Unknown'),/Unmapped/);
 const curve=convertUnityAnimationCurve([{time:0,value:0,outTangent:4},{time:1,value:1,inTangent:-2}],.0001);for(let i=0;i<=1000;i++){const t=i/1000;let j=0;while(j<curve.length-2&&curve[j+1].time<t)j++;const a=curve[j],b=curve[j+1],linear=a.value+(b.value-a.value)*(t-a.time)/(b.time-a.time),exact=(-2*t*t*t+3*t*t)+(t*t*t-2*t*t+t)*4+(t*t*t-t*t)*-2;assert.ok(Math.abs(linear-exact)<.00012);}assert.throws(()=>convertUnityAnimationCurve([{time:0,value:0,weightedMode:1}]),/weighted/);
});
test('visual comparison tolerates color changes but rejects displacement and empty fixtures',()=>{
 const a=new Uint8Array(16*16*4),b=new Uint8Array(a.length);for(let y=4;y<12;y++)for(let x=4;x<12;x++){a[(y*16+x)*4+3]=255;b[(y*16+x)*4]=100;b[(y*16+x)*4+3]=255;}assert.equal(compareVisualFrames(a,b,16,16).passed,true);b.fill(0);assert.equal(compareVisualFrames(a,b,16,16).passed,false);
 const report=ZhudaBenchmarkEngine.runSuite();assert.equal(report.zeroGcPoolSpeedupRatio,null);assert.equal(report.spinePhysicsOpsPerMs,null);assert.ok(report.springMathOpsPerMs>0);
});
