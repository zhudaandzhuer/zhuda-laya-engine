import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";

export async function buildPrefabPreview({ projectRoot, engineRoot, out, topology, config }) {
  const entry = path.resolve(projectRoot, config.prefabPreview);
  if (!entry.startsWith(projectRoot + path.sep) || !fs.existsSync(entry))
    throw Error("prefabPreview must name an existing consumer module");
  const sdk = path.join(engineRoot, "dist/sdk/zhuda-laya-engine.esm.js");
  const code = `
import {ZhudaEngine,DirectoryAssetProvider,ZhudaPrefabLibrary,ZhudaRequestSlot,inspectPrefabInstance} from 'zhuda-laya-engine';
import {definitions} from ${JSON.stringify(entry)};
async function bootPreview(){
const params=new URLSearchParams(location.search);
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
const context=await ZhudaEngine.boot({container:document.querySelector('#preview'),width,height,dprCap:dpr,features:['core','2d','ui'],bgColor:'#152030'});
const provider=new DirectoryAssetProvider({baseUrl:'./assets/'});
const library=new ZhudaPrefabLibrary({provider,definitions});
const slot=new ZhudaRequestSlot();
let instance,selection,error;
const lifecycle=[];
async function select(id,state,node=''){
 error=undefined;
 try{
  await slot.replace(signal=>library.instantiate(id,{state,signal}),value=>{
   const selected=value.find(node);
   let current=selected;
   while(current!==value.root){
    const parent=current.parent;
    for(let i=0;i<parent.numChildren;i++)parent.getChildAt(i).visible=parent.getChildAt(i)===current;
    current=parent;
   }
   instance?.dispose();instance=value;
   context.rootScene.addChild(value.root);
   selection={id,state:value.provenance.state,node};
  },value=>value.dispose());
  await document.fonts.ready;
  ZhudaEngine.flushRenderFrames(3);
 }catch(e){error=String(e);document.querySelector('#error').textContent=error;throw e;}
}
window.__ZHUDA_PREFAB_TEST__={
 select,
 report:()=>{
  const node=instance?.find(selection.node);
  return {ready:!!instance&&!error,error,selection,provenance:instance?inspectPrefabInstance(instance.root):null,
    bounds:node?{x:node.x,y:node.y,width:node.width,height:node.height}:null,
    resources:library.report(),lifecycle,environment:{width,height,dpr,engine:${JSON.stringify(JSON.parse(fs.readFileSync(path.join(engineRoot,'package.json'),'utf8')).version)}}}
 }
};
for(const definition of definitions){
 const option=document.createElement('option');option.value=definition.id;option.textContent=definition.id;document.querySelector('#choose').appendChild(option);
}
document.querySelector('#choose').onchange=()=>{location.search=new URLSearchParams({id:document.querySelector('#choose').value}).toString()};
const id=params.get('id')||definitions[0]?.id;
document.querySelector('#choose').value=id;
await select(id,params.get('state')||undefined,params.get('node')||'');
const cycles=Number(params.get('cycles')||0);
if(!Number.isSafeInteger(cycles)||cycles<0||cycles>100)throw Error('Invalid preview cycle count');
for(let i=0;i<cycles;i++){
 instance.dispose();instance=undefined;
 lifecycle.push(library.report());
 await select(id,params.get('state')||undefined,params.get('node')||'');
}
window.addEventListener('pagehide',()=>{slot.cancel();library.dispose();provider.dispose();context.dispose()},{once:true});
}
void bootPreview();
`;
  await esbuild.build({
    stdin: { contents: code, loader: "ts", resolveDir: projectRoot },
    bundle: true, format: "iife", target: "es2020", minify: true,
    outfile: path.join(out, "prefab-preview.js"),
    plugins: [{ name: "prefab-sdk", setup(build) {
      build.onResolve({ filter: /^zhuda-laya-engine$/ }, () => ({ path: sdk }));
    } }]
  });
  const scripts = topology.orderedFiles.map(file => `<script src="libs/${file}"></script>`).join("\n");
  fs.writeFileSync(path.join(out, "prefab-preview.html"), `<!doctype html><meta charset="utf-8">
<title>Prefab preview</title><style>body{margin:0;background:#152030;color:white;font:14px sans-serif;overflow:auto}header{padding:12px}#preview{display:block;position:relative;width:640px;height:360px;overflow:hidden;background:#152030}</style>
<header>Prefab <select id="choose"></select><span id="error" role="alert"></span></header>
<div id="preview"></div>${scripts}<script src="prefab-preview.js"></script>`);
}
