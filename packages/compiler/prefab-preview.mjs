import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";
import crypto from 'node:crypto';
import { validatePrefabComponents } from './prefab-dependencies.mjs';

export async function buildPrefabPreview({ projectRoot, engineRoot, out, topology, config }) {
  const components=validatePrefabComponents(config.prefabComponents);
  const bundles=Object.create(null);
  const entries=[[null,config.prefabPreview,'prefab-preview.js'],...Object.entries(components).map(([id,value])=>{
    const bundle='prefab-component-'+crypto.createHash('sha256').update(id).digest('hex').slice(0,20)+'.js';
    bundles[id]=bundle;return [id,value.entry,bundle];
  })];
  for (const [componentId,moduleEntry,bundle] of entries) {
  const entry = path.resolve(projectRoot, moduleEntry);
  if (!entry.startsWith(projectRoot + path.sep) || !fs.existsSync(entry))
    throw Error("prefabPreview must name an existing consumer module");
  const sdk = path.join(engineRoot, "dist/sdk/zhuda-laya-engine.esm.js");
  const code = `
import {ZhudaEngine,Zhuda3D,DirectoryAssetProvider,ZhudaPrefabLibrary,ZhudaRequestSlot,ZhudaResourceScope,inspectPrefabInstance,inspectSceneResources} from 'zhuda-laya-engine';
import * as prefabModule from ${JSON.stringify(entry)};
const {definitions}=prefabModule;
const componentId=${JSON.stringify(componentId)};
if(componentId && (definitions.length!==1 || definitions[0].id!==componentId))throw Error('Isolated component entry must export its single matching definition');
const scope=new ZhudaResourceScope();
const dispose=()=>scope.dispose();
window.addEventListener('pagehide',dispose,{once:true});
scope.defer(()=>window.removeEventListener('pagehide',dispose));
async function bootPreview(){
const params=new URLSearchParams(location.search);
const cycles=Number(params.get('cycles')||0);
if(!Number.isSafeInteger(cycles)||cycles<0||cycles>100)throw Error('Invalid preview cycle count');
const width=Number(params.get('width')||640),height=Number(params.get('height')||360),dpr=Number(params.get('dpr')||1);
if(![width,height,dpr].every(Number.isFinite)||width<1||height<1||width>4096||height>4096||dpr<.5||dpr>3)throw Error('Invalid preview size');
// The runtime observes the preview container and uses its CSS box as the
// stage size. Keep that box equal to the requested design canvas; a generic
// 100vw/80vh box would silently resize a 572x174 control bar to a portrait
// viewport and stretch every circle and capsule before it can be reviewed.
const preview=document.querySelector('#preview');
preview.style.width=width+'px';
preview.style.height=height+'px';
preview.style.maxWidth='none';
preview.style.maxHeight='none';
preview.dataset.designWidth=String(width);
preview.dataset.designHeight=String(height);
const has3D=definitions.some(definition=>definition.kind==='3d');
const context=scope.own(await ZhudaEngine.boot({container:document.querySelector('#preview'),width,height,dprCap:dpr,features:has3D?['core','3d']:['core','2d','ui'],bgColor:'#152030'}),value=>value.dispose());
let scene3D;
if(has3D){
 const settings=Reflect.get(prefabModule,'preview3D')||{};
 scene3D=Zhuda3D.createScene3D(context.rootScene,{ambientColor:settings.ambientColor||[.4,.4,.4,1]});
 Zhuda3D.createCamera(scene3D,settings.camera||{position:[0,2,6],rotationEuler:[-15,0,0],clearColor:[.08,.12,.18,1]});
 Zhuda3D.createDirectionalLight(scene3D,settings.light||{rotationEuler:[-35,-30,0],intensity:1});
}
// Consumers may export the same typed factory that their Scene calls. The
// preview owns this instance and releases it with the library/session.
const createAssetProvider=Reflect.get(prefabModule,'createAssetProvider');
const provider=typeof createAssetProvider==='function'
  ? createAssetProvider() : new DirectoryAssetProvider({baseUrl:'./assets/'});
if(!provider||typeof provider.load!=='function')throw Error('createAssetProvider must return an AssetProvider synchronously');
scope.own(provider,value=>value.dispose?.());
const library=scope.own(new ZhudaPrefabLibrary({provider,definitions,share3DResources:Reflect.get(prefabModule,'libraryOptions')?.share3DResources}),value=>value.dispose());
const slot=scope.own(new ZhudaRequestSlot(),value=>value.cancel());
let instance,selection,error,ready=false;
const lifecycle=[];
const lifecycleCheck={requestedCycles:cycles,completedCycles:0,status:'running',before:null,after:null};
async function select(id,state,node=''){
 ready=false;
 error=undefined;
 try{
  await slot.replace(signal=>library.instantiate(id,{state,signal}),value=>{
   const selected=value.find(node);
   let current=selected;
   while(current!==value.root){
    const parent=current.parent;
    for(let i=0;i<parent.numChildren;i++)parent.getChildAt(i)[value.provenance.kind==='3d'?'active':'visible']=parent.getChildAt(i)===current;
    current=parent;
   }
   instance?.dispose();instance=value;
   if(scene3D)scene3D.active=value.provenance.kind==='3d';
   (value.provenance.kind==='3d'?scene3D:context.rootScene).addChild(value.root);
   selection={id,state:value.provenance.state,node};
  },value=>value.dispose());
  await document.fonts.ready;
  ZhudaEngine.flushRenderFrames(3);
  if(lifecycleCheck.status==='complete')ready=true;
 }catch(e){error=String(e);document.querySelector('#error').textContent=error;throw e;}
}
window.__ZHUDA_PREFAB_TEST__={
 select,
 report:()=>{
  const node=instance?.find(selection?.node);
  return {ready:ready&&!!instance&&!error,error,componentId,selection,provenance:instance?inspectPrefabInstance(instance.root):null,
    bounds:node?{x:node.x,y:node.y,width:node.width,height:node.height}:null,
    resources:library.report(),lifecycle,lifecycleCheck,environment:{
      requested:{width,height,dpr},
      measured:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      provider:provider.name,engine:${JSON.stringify(JSON.parse(fs.readFileSync(path.join(engineRoot,'package.json'),'utf8')).version)}}}
 }
};
for(const definition of definitions){
 const option=document.createElement('option');option.value=definition.id;option.textContent=definition.id;document.querySelector('#choose').appendChild(option);
}
document.querySelector('#choose').onchange=()=>{location.search=new URLSearchParams({id:document.querySelector('#choose').value}).toString()};
const id=params.get('id')||definitions[0]?.id;
document.querySelector('#choose').value=id;
await select(id,params.get('state')||undefined,params.get('node')||'');
lifecycleCheck.before=inspectSceneResources();
for(let i=0;i<cycles;i++){
 instance.dispose();instance=undefined;
 lifecycle.push(library.report());
 await select(id,params.get('state')||undefined,params.get('node')||'');
 lifecycleCheck.completedCycles++;
}
lifecycleCheck.after=inspectSceneResources();
lifecycleCheck.status='complete';ready=true;
}
void bootPreview().catch(error=>{
 try{dispose()}catch(releaseError){console.error(releaseError)}
 document.querySelector('#error').textContent=String(error);
 window.__ZHUDA_PREFAB_TEST__={report:()=>({ready:false,error:String(error)})};
});
`;
  await esbuild.build({
    stdin: { contents: code, loader: "ts", resolveDir: projectRoot },
    bundle: true, format: "iife", target: "es2020", minify: true,
    outfile: path.join(out, bundle),
    plugins: [{ name: "prefab-sdk", setup(build) {
      build.onResolve({ filter: /^zhuda-laya-engine$/ }, () => ({ path: sdk }));
    } }]
  });
  }
  const scripts = topology.orderedFiles.map(file => `<script src="libs/${file}"></script>`).join("\n");
  fs.writeFileSync(path.join(out, "prefab-preview.html"), `<!doctype html><meta charset="utf-8">
<title>Prefab preview</title><style>body{margin:0;background:#152030;color:white;font:14px sans-serif;overflow:auto}header{padding:12px}#preview{display:block;position:relative;width:640px;height:360px;overflow:hidden;background:#152030}</style>
<header>Prefab <select id="choose"></select><span id="error" role="alert"></span></header>
<div id="preview"></div>${scripts}<script>const components=${JSON.stringify(bundles).replaceAll('<','\\u003c')};const id=new URLSearchParams(location.search).get('id');const script=document.createElement('script');script.src=Object.hasOwn(components,id)?components[id]:'prefab-preview.js';document.body.appendChild(script);</script>`);
  return bundles;
}
