import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaParticleSystem3D } from '../packages/core/particles/ParticleSystem3D.ts';
import { ZhudaParticleMesh3D } from '../packages/core/particles/ParticleMesh3D.ts';
import { ZhudaRibbonTrail3D } from '../packages/core/particles/RibbonTrail3D.ts';
import { ZhudaRibbonPath3D } from '../packages/core/particles/RibbonPath3D.ts';
import { ZhudaLayaParticleRenderer3D } from '../packages/core/particles/LayaParticleRenderer3D.ts';
import { validateParticleEffect3D, rotateParticleVector3 } from '../packages/core/particles/ParticleTypes3D.ts';
const emitter = (patch = {}) => ({ id:'neutral-3d', texture:'external', maxParticles:256, seed:17,
  space:'world', blend:'alpha', shape:{type:'point'}, rate:30, lifetime:[.5,1], speed:[1,3], size:[.1,.3],
  direction:{x:0,y:0,z:-1}, spread:.3, ...patch });
const advance = (s, frames, dt) => { for(let i=0;i<frames;i++) s.update(dt); };
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-5, `${a} ~= ${b}`);
const view = {position:{x:0,y:2,z:10},right:{x:1,y:0,z:0},up:{x:0,y:1,z:0},forward:{x:0,y:0,z:-1}};

test('3D fixed-step seeded replay is equal at 30/60/120 fps, including XYZ turbulence', () => {
  const systems=[30,60,120].map(fps=>{const s=new ZhudaParticleSystem3D(emitter({turbulence:{strength:2,frequency:4}}));s.play();advance(s,fps*2,1/fps);return s;});
  assert.deepEqual(systems[0].snapshot(),systems[1].snapshot());assert.deepEqual(systems[1].snapshot(),systems[2].snapshot());
  const before=systems[0].snapshot();systems[0].play(true);advance(systems[0],60,1/30);assert.deepEqual(systems[0].snapshot(),before);
  assert.ok(before.some(p=>Math.abs(p.z)>0 && Math.abs(p.vz)>0));
});

test('3D quaternion transform supports in-place rotation, world inheritance and local attachment', () => {
  const q={x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2}, v={x:0,y:0,z:-1};rotateParticleVector3(v,q,v);near(v.x,-1);near(v.z,0);
  for(const space of ['world','local']) {
    const s=new ZhudaParticleSystem3D(emitter({space,rate:0,speed:2,spread:0,velocityInheritance:.5}));
    s.setTransform(10,20,30,q,{x:4,y:2,z:6});s.burst(1);const p=s.snapshot()[0];
    near(p.vx,space==='world'?0:0);near(p.vy,space==='world'?1:0);near(p.vz,space==='world'?3:-2);
    s.setTransform(100,200,300);const g=new ZhudaParticleMesh3D(s).build(view);
    const center=[0,1,2].map(j=>[0,1,2,3].reduce((a,i)=>a+g.vertices[i*9+j],0)/4);
    near(center[0],space==='world'?10:100);near(center[1],space==='world'?20:200);near(center[2],space==='world'?30:300);
  }
});

test('3D pool is bounded, reports dropped time and particles, then drains and recycles', () => {
  const s=new ZhudaParticleSystem3D(emitter({maxParticles:8,rate:0,lifetime:.1}));s.burst(1e6);
  assert.equal(s.aliveCount,8);assert.equal(s.droppedParticles,999992);s.stop();s.update(20);
  assert.equal(s.aliveCount,0);assert.equal(s.droppedSeconds,19.75);near(s.time,.25);s.burst(8);assert.equal(s.aliveCount,8);
});

test('3D distance emission spans XYZ movement and non-integral duration loops keep time', () => {
  const s=new ZhudaParticleSystem3D(emitter({rate:0,rateOverDistance:1,speed:0,lifetime:5}));
  s.setTransform(0,0,0);s.play();s.setTransform(0,0,10);s.update(.1);assert.equal(s.aliveCount,10);
  assert.ok(new Set(s.snapshot().map(p=>p.z)).size>5);s.stop();advance(s,600,1/120);assert.equal(s.aliveCount,0);
  const loop=new ZhudaParticleSystem3D(emitter({rate:120,duration:.013,loop:true,lifetime:5}));loop.play();advance(loop,120,1/120);assert.equal(loop.aliveCount,120);
  const bursts=new ZhudaParticleSystem3D(emitter({rate:0,duration:.25,loop:true,lifetime:5,bursts:[{time:0,count:2},{time:.125,count:3}]}));
  bursts.play();advance(bursts,60,1/120);assert.equal(bursts.aliveCount,10);
});

test('3D shape and direction validation reject malformed input before allocation', () => {
  for(const patch of [{direction:{x:0,y:0,z:0}},{spread:4},{shape:{type:'box',width:1,height:1,depth:-1}},
    {acceleration:{x:0,y:0,z:NaN}},{billboard:'wrong'},{velocityInheritance:3},{maxParticles:16384}]) {
    assert.throws(()=>new ZhudaParticleSystem3D(emitter(patch)),/ZhudaParticles3D/);
  }
  assert.ok(validateParticleEffect3D(null).length);assert.ok(validateParticleEffect3D({schemaVersion:1,dimension:3,emitters:[null]}).length);
  for(const shape of [{type:'sphere',radius:2,surface:true},{type:'box',width:2,height:2,depth:2}]) {
    const s=new ZhudaParticleSystem3D(emitter({shape,rate:0,speed:0}));s.burst(100);
    assert.ok(s.snapshot().every(p=>Math.hypot(p.x,p.y,p.z)<=2.001));
  }
});

test('3D billboard modes are finite and bounded, alpha sorts far to near, ground stays horizontal', () => {
  for(const billboard of ['camera','velocity','ground']) {
    const s=new ZhudaParticleSystem3D(emitter({billboard,rate:0,speed:0,size:2}));s.burst(1,0,0,-1);s.burst(1,0,0,-5);
    const m=new ZhudaParticleMesh3D(s),g=m.build(view);assert.equal(g.vertexCount,8);assert.ok(g.vertices.every(Number.isFinite));
    const center=i=>[0,1,2,3].reduce((a,j)=>a+g.vertices[i*36+j*9+2],0)/4;near(center(0),-5);near(center(1),-1);
    for(let i=0;i<8;i++) {const o=i*9;assert.ok(Math.abs(g.vertices[o])<=1.001);if(billboard==='ground')near(g.vertices[o+1],0);}
    s.clear();m.build(view);assert.ok(g.vertices.every(v=>v===0));assert.equal(g.indexCount,0);
  }
});

test('3D historical ribbon keeps curve, bounds width, expires, and unused index capacity cannot form origin spikes', () => {
  const t=new ZhudaRibbonTrail3D({maxPoints:16,lifetime:.5,width:1,minDistance:.01,teleportDistance:10});
  for(let i=0;i<6;i++)t.update(.02,100+i,20+i*.1,-30+i*i*.1);
  const points=t.snapshot(),g=t.buildMesh(view.position);assert.equal(g.indexCount,30);
  assert.ok(g.indices.slice(0,g.indexCount).every(i=>i<g.vertexCount));assert.ok(g.indices.slice(g.indexCount).every(i=>i===0));
  for(let i=0;i<points.length;i++){const p=points[i],o=i*18;near(Math.hypot(g.vertices[o]-p.x,g.vertices[o+1]-p.y,g.vertices[o+2]-p.z),.5*(1-p.age/.5));}
  assert.ok(g.vertices.every(Number.isFinite));t.update(0,500,0,0);assert.equal(t.pointCount,1);
  t.update(1,500,0,0,false);const empty=t.buildMesh(view.position);assert.equal(empty.indexCount,0);assert.ok(empty.indices.every(i=>i===0));
});

test('3D authored flow reveals from its start, erases forward, preserves XYZ and bounded geometry across views', () => {
  const p=new ZhudaRibbonPath3D({maxPoints:24,width:.8});p.setPoints(Array.from({length:11},(_,i)=>({x:Math.sin(i),y:i*.1,z:i})));
  p.visibleEnd=.45;p.edgeFade=.03;let g=p.buildMesh(view.position);
  const alpha=i=>g.vertices[i*18+6];assert.ok(alpha(2)>.9);assert.equal(alpha(8),0);assert.equal(alpha(0),0);
  p.visibleEnd=1;p.visibleStart=.5;g=p.buildMesh({x:10,y:3,z:0});assert.equal(alpha(2),0);assert.ok(alpha(8)>.9);
  assert.equal(g.vertexCount,22);assert.equal(g.indexCount,60);assert.ok(g.indices.slice(g.indexCount).every(i=>i===0));
  const snapshot=p.snapshot();for(let i=0;i<snapshot.length;i++){const o=i*18,v=snapshot[i];near(Math.hypot(g.vertices[o]-v.x,g.vertices[o+1]-v.y,g.vertices[o+2]-v.z),.4);}
  p.uvOffset=-3;p.uvTiles=4;assert.ok(p.buildMesh(view.position).vertices.every(Number.isFinite));assert.deepEqual(p.snapshot(),snapshot);
  p.clear();assert.equal(p.buildMesh(view.position).indexCount,0);assert.throws(()=>p.setPoints([{x:0,y:0,z:NaN}]));
});

test('3D renderer uses scene depth, submits preallocated geometry, and destroys only owned resources once', () => {
  const previous=globalThis.Laya,owned=[];const texture={destroy(){throw new Error('shared texture destroyed');}};
  class V {setValue(x,y,z){Object.assign(this,{x,y,z});}}
  const mesh={bounds:{setMin(){},setMax(){}},setVertices(v){this.vertices=v;},setIndices(v){this.indices=v;},destroy(){owned.push('mesh');}};
  class Node {constructor(){this.meshRenderer={};}destroy(){owned.push('node');}}
  class Material {destroy(){assert.equal(this.albedoTexture,null,'Detach shared texture before the Laya resource destruction cascade');owned.push('material');}}
  globalThis.Laya={PrimitiveMesh:{_createMesh(){return mesh;}},VertexMesh:{getVertexDeclaration(){return {};}},
    MeshSprite3D:Node,UnlitMaterial:Material,Vector3:V,RenderState:{DEPTHTEST_LEQUAL:515,CULL_NONE:0,BLEND_ENABLE_ALL:1,BLENDPARAM_SRC_ALPHA:770,BLENDPARAM_ONE:1,BLENDPARAM_ONE_MINUS_SRC_ALPHA:771}};
  try{
    const s=new ZhudaParticleSystem3D(emitter({rate:0}));s.burst(4);
    const r=new ZhudaLayaParticleRenderer3D(s,{addChild(){}},()=>texture);
    const cam={transform:{position:view.position,worldMatrix:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}}};
    r.render(cam);assert.equal(r.submittedBatches,1);assert.equal(r.node.meshRenderer.sharedMaterial.depthWrite,false);assert.equal(r.node.meshRenderer.sharedMaterial.depthTest,515);
    const buffer=mesh.vertices;r.render(cam);assert.equal(buffer,mesh.vertices);r.render(cam,0);assert.equal(r.node.active,false);
    r.dispose();r.dispose();assert.deepEqual(owned,['node','mesh','material']);r.render(cam);assert.equal(r.submittedBatches,0);
  }finally{globalThis.Laya=previous;}
});

test('authored width directions preserve surface orientation when a camera passes along the flow', () => {
  const p=new ZhudaRibbonPath3D({maxPoints:8,width:1});const points=[{x:0,y:1,z:0},{x:0,y:1,z:1},{x:0,y:1,z:2}];
  p.setPoints(points,points.map(()=>({x:1,y:0,z:0})));
  const a=Array.from(p.buildMesh({x:0,y:1,z:10}).vertices);const b=Array.from(p.buildMesh({x:10,y:0,z:0}).vertices);
  assert.deepEqual(a,b);near(a[0],-.5);near(a[9],.5);
  assert.throws(()=>p.setPoints(points,[{x:1,y:0,z:0}]));
});
