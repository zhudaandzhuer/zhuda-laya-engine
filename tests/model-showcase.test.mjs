import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inspectGltfDocument, inspectGltfAsset, ZhudaModelCompatibilityError } from '../packages/core/runtime3d/ModelCompatibility.ts';
import { ZhudaModelLibrary } from '../packages/core/runtime3d/Assets.ts';
import { prepareLaya342GltfResource } from '../packages/core/runtime3d/Laya342GltfAdapter.ts';
const fixture = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/gltf-review/${name}.gltf`, import.meta.url)));

test('required extensions fail explicitly; optional loss and required render inputs remain machine readable', () => {
  const data = fixture('required-extension');
  let report = inspectGltfDocument(data);
  assert.equal(report.status, 'unsupported');
  assert.ok(report.diagnostics.some(d => d.code === 'UNSUPPORTED_REQUIRED_EXTENSION' && d.path === '$.extensionsRequired[0]' && d.extension === 'KHR_materials_variants'));
  data.extensionsRequired = []; report = inspectGltfDocument(data);
  assert.equal(report.status, 'degraded');
  assert.ok(report.diagnostics.some(d => d.code === 'UNSUPPORTED_OPTIONAL_EXTENSION'));
  data.extensionsUsed = ['KHR_materials_transmission']; delete data.extensions; data.materials = [{extensions:{KHR_materials_transmission:{transmissionFactor:1}}}]; data.meshes = [];
  report = inspectGltfDocument(data); assert.equal(report.status, 'conditional'); assert.deepEqual(report.requiredRenderInputs, ['opaqueColor']);
  assert.throws(() => report.requiredRenderInputs.push('other'));
});

test('invalid declarations, undeclared payloads, malformed bytes and morph counts are not accepted as compatible', () => {
  assert.equal(inspectGltfDocument({}).status, 'unsupported');
  for (const declarations of [['x','x'], 'x', [4]])
    assert.ok(inspectGltfDocument({asset:{version:'2.0'},extensionsUsed:declarations}).diagnostics.some(d => d.code === 'INVALID_EXTENSION_DECLARATION'));
  const data = fixture('node-weights'); data.nodes[0].weights = [1, 2];
  assert.ok(inspectGltfDocument(data).diagnostics.some(d => d.code === 'INVALID_MORPH_WEIGHTS' && d.path === '$.nodes[0].weights'));
  data.nodes[0].weights = [1]; data.extensionsUsed = [];
  assert.ok(inspectGltfDocument(data).diagnostics.some(d => d.code === 'UNDECLARED_EXTENSION'));
  assert.equal(inspectGltfAsset(new Uint8Array([1,2])).diagnostics[0].code, 'INVALID_DOCUMENT');
  const container = new Uint8Array(15);container.set(new TextEncoder().encode('{}'),5);
  assert.equal(inspectGltfAsset(container.subarray(5,7)).status, 'unsupported');
});

test('inventory preserves authored node precedence, primitive counts and color/data texture contracts', () => {
  const data = fixture('node-weights');
  data.materials[0].pbrMetallicRoughness.baseColorTexture = {index:0};
  data.materials[0].normalTexture = {index:1};
  const r = inspectGltfDocument(data);
  assert.equal(r.status, 'supported'); assert.deepEqual(r.inventory.nodes[0].morphWeights, [1]);
  assert.equal(r.inventory.meshes[0].primitives[0].triangles, 1);
  assert.deepEqual(r.inventory.materials[0].textures.map(t=>t.colorSpace), ['srgb','linear']);
  assert.equal(data.materials[0].pbrMetallicRoughness.baseColorTexture.index, 0);
});

test('required extension gate releases provider bytes without allocating a native model', async () => {
  const previous = globalThis.Laya; let allocated=0,released=0;
  globalThis.Laya = {glTFResource:class {constructor(){allocated++;}}};
  try {
    const library = new ZhudaModelLibrary({provider:{name:'test',async load(){return {id:'asset',bytes:new TextEncoder().encode(JSON.stringify(fixture('required-extension'))),release(){released++;}};}}});
    await assert.rejects(library.instantiate('asset'), e=>e instanceof ZhudaModelCompatibilityError && e.assetId==='asset');
    assert.equal(allocated,0);assert.equal(released,1);assert.equal(library.report().entries,0);library.dispose();
  } finally {globalThis.Laya=previous;}
});

test('cubic morph adapter retains multi-target tangents, skinned ownership and existing native tracks', () => {
  class MeshFilter{} class MeshRenderer{} class SkinnedMeshRenderer{}
  class KeyframeNode {
    owner=[];properties=[];keys=[];
    _setOwnerPathCount(n){this.owner.length=n;} _setOwnerPathByIndex(i,v){this.owner[i]=v;}
    _joinOwnerPath(s){return this.owner.join(s);} _setPropertyCount(n){this.properties.length=n;}
    _setPropertyByIndex(i,v){this.properties[i]=v;} _setKeyframeByIndex(i,v){this.keys[i]=v;}
  }
  const names=['face','jaw'], times=new Float32Array([0,2]),values=new Float32Array([1,2, .2,.4, 3,4, 5,6, .8,.9, 7,8]);
  const node={getComponent(type){if(type===MeshFilter)return{sharedMesh:{morphTargetData:{channelCount:2,getMorphChannelbyIndex:i=>({name:names[i]})}}};if(type===SkinnedMeshRenderer)return{};}};
  let nativeCalls=0;
  const resource={_nodes:[node],getBufferwithAccessorIndex:i=>i===0?times:values,getAnimationPath:()=>['Actor','Face'],
    createAnimatorClip(){nativeCalls++;return{_nodes:{count:1,nodes:['native-transform'],setNodeByIndex(i,n){this.nodes[i]=n;}},_nodesMap:{},_nodesDic:{},_duration:1,destroy(){}};}};
  const runtime={MeshFilter,MeshRenderer,SkinnedMeshRenderer,KeyframeNode,FloatKeyframe:class{}};
  prepareLaya342GltfResource(resource,runtime);prepareLaya342GltfResource(resource,runtime);
  const animation={channels:[{target:{node:0,path:'weights'},sampler:0}],samplers:[{input:0,output:1,interpolation:'CUBICSPLINE'}]};
  const clip=resource.createAnimatorClip(animation,{});
  assert.equal(nativeCalls,1);assert.equal(clip._nodes.count,3);assert.equal(clip._duration,2);assert.equal(clip._nodes.nodes[0],'native-transform');
  const [face,jaw]=clip._nodes.nodes.slice(1);
  assert.equal(jaw.propertyOwner,'SkinnedMeshRenderer');assert.deepEqual(jaw.callParams,['jaw']);
  assert.equal(face.keys[0].inTangent,1);assert.equal(face.keys[0].outTangent,3);
  assert.equal(jaw.keys[1].inTangent,6);assert.equal(jaw.keys[1].outTangent,8);assert.equal(jaw.keys[1].time,2);
  assert.ok(Math.abs(jaw.keys[1].value-.9)<1e-6);
  times[1]=0;assert.throws(()=>resource.createAnimatorClip(animation,{}),/sample times/);assert.equal(nativeCalls,1);
});

test('showcase preserves the previous asset on rejection, discards late loads and restores its borrowed camera', async () => {
  const {ZhudaAssetShowcase} = await import('../packages/core/runtime3d/AssetShowcase.ts');
  const camera={opaquePass:false,postProcess:null,taa:false}, mounted=[];
  const parent={addChild(node){mounted.push(node);}};
  let releaseLate;const instances=[];
  const make=(id,opaque=false)=>{const v={node:{id},compatibility:{requiredRenderInputs:opaque?['opaqueColor']:[]},disposed:0,dispose(){this.disposed++;}};instances.push(v);return v;};
  const library={async instantiate(id){if(id==='bad')throw Error('invalid');if(id==='slow')return new Promise(r=>releaseLate=()=>r(make(id)));return make(id,id==='glass');}};
  const modes={gameplay:{filmic:false,opaqueColor:false},cinematic:{filmic:false,opaqueColor:true}};
  const show=new ZhudaAssetShowcase({camera,parent,library,presentations:modes});
  assert.throws(()=>new ZhudaAssetShowcase({camera,parent,library}),/exclusive/);
  await show.load('good');const first=show.instance;show.setMode('gameplay');assert.equal(show.instance,first);
  await assert.rejects(show.load('bad'),/invalid/);assert.equal(show.instance,first);assert.equal(first.disposed,0);
  await assert.rejects(show.load('glass'),/REQUIRED_RENDER_INPUT/);assert.equal(instances.at(-1).disposed,1);assert.equal(show.instance,first);
  const late=show.load('slow');await show.load('new');releaseLate();assert.equal(await late,false);assert.equal(instances.at(-1).disposed,1);assert.equal(show.instance.node.id,'new');
  assert.equal(first.disposed,1);const late2=show.load('slow');show.dispose();releaseLate();assert.equal(await late2,false);
  assert.equal(camera.opaquePass,false);assert.equal(instances.every(v=>v.disposed===1),true);
  assert.throws(()=>show.setMode('raw'),/Disposed/);assert.equal(mounted.length,2);
});

test('showcase rejects unavailable Filmic before changing mode or discarding a loaded asset', async () => {
  const {ZhudaAssetShowcase} = await import('../packages/core/runtime3d/AssetShowcase.ts');
  const prev=globalThis.Laya;globalThis.Laya={};
  try {const camera={opaquePass:false,postProcess:null,taa:false};
    const show=new ZhudaAssetShowcase({camera,parent:{},library:{}});
    assert.throws(()=>show.setMode('cinematic'),/requires postprocess/);assert.equal(show.mode,'raw');assert.equal(camera.opaquePass,true);show.dispose();assert.equal(camera.opaquePass,false);
  }finally{globalThis.Laya=prev;}
});

test('failed native creation retires partial scene trees, orphan nodes and imported clips before resource release', async () => {
 const {createLaya342ModelTemplate}=await import('../packages/core/runtime3d/Laya342GltfAdapter.ts');
 const clip={destroyed:false,referenceCount:1,destroy(){this.destroyed=true;}};
 const node={numChildren:0,destroyed:false,getComponent(){return{controllerLayerCount:1,getControllerLayer(){return{states:[{clip}]};}};},destroy(){this.destroyed=true;clip.referenceCount--;}};
 const orphan={numChildren:0,destroyed:false,destroy(){this.destroyed=true;}};
 const resource={_nodes:[node,orphan],_scenes:[node],create(){throw Error('Malformed animation');}};
 assert.throws(()=>createLaya342ModelTemplate(resource,{Animator:class{}}),/Malformed/);
 assert.equal(node.destroyed,true);assert.equal(orphan.destroyed,true);assert.equal(clip.destroyed,true);assert.deepEqual(resource._nodes,[]);assert.deepEqual(resource._scenes,[]);
});
