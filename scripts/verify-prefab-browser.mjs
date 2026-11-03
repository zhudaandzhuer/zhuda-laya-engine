import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import zlib from "node:zlib";
import assert from "node:assert/strict";
import { runConsumerBuild } from "../packages/compiler/consumer-build.mjs";
import { checkPrefab } from "../packages/compiler/prefab-check.mjs";

const engineRoot = path.resolve(import.meta.dirname, "..");
const root = process.env.PREFAB_FIXTURE_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "zhuda-prefab-consumer-"));
fs.mkdirSync(path.join(root, "src"), { recursive: true });
fs.mkdirSync(path.join(root, "public/assets"), { recursive: true });
fs.mkdirSync(path.join(root, "evidence"), { recursive: true });
// A neutral 16x16 fixture image, generated here without copying consumer art.
function png(color) {
  const crc = bytes => { let c = -1; for (const b of bytes) { c ^= b; for (let i=0;i<8;i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (c ^ -1) >>> 0; };
  const chunk = (name, bytes) => {
    const type = Buffer.from(name), header = Buffer.alloc(4), checksum = Buffer.alloc(4);
    header.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc(Buffer.concat([type, bytes])));
    return Buffer.concat([header, type, bytes, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(16); header.writeUInt32BE(16,4); header[8]=8; header[9]=6;
  const rows = Buffer.concat(Array.from({length:16},()=>Buffer.concat([Buffer.from([0]),Buffer.from(Array(16).fill(color).flat())])));
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",zlib.deflateSync(rows)),chunk("IEND",Buffer.alloc(0))]);
}
const write = (name, value) => fs.writeFileSync(path.join(root, name), value);
const hierarchy = { _$id:"panel", _$type:"Sprite", name:"Panel", width:300,height:150,
  _$child:[
    { _$id:"plate", _$type:"Image", name:"plate", skin:"plate.png", x:20,y:20,width:260,height:110 },
    { _$id:"value", _$type:"Label", name:"value", text:"123,456",font:"Arial",fontSize:32,color:"#ffffff",x:40,y:45,width:220,height:60,align:"center",valign:"middle" }
  ] };
write("public/assets/panel.lh", JSON.stringify(hierarchy));
write("public/assets/plate.png", png([28,75,90,255]));
write("src/prefabs.ts", `import type {PrefabDefinition} from 'zhuda-laya-engine';
export const definitions:PrefabDefinition[]=[{id:'amount-plate',asset:'panel.lh',textures:['plate.png'],states:{short:{},long:{value:{text:'999,999,999'}}}}];`);
write("src/Main.ts", `import {ZhudaEngine,DirectoryAssetProvider,ZhudaPrefabLibrary,inspectPrefabInstance} from 'zhuda-laya-engine';
import {definitions} from './prefabs';
async function main(){
const context=await ZhudaEngine.boot({container:document.querySelector('#preview')!,width:640,height:360,dprCap:1,features:['core','2d','ui'],bgColor:'#152030'});
const library=new ZhudaPrefabLibrary({provider:new DirectoryAssetProvider({baseUrl:'./assets/'}),definitions});
const instance=await library.instantiate('amount-plate',{state:'short'});
context.rootScene.addChild(instance.root);
await document.fonts.ready;ZhudaEngine.flushRenderFrames(3);
if(new URLSearchParams(location.search).has('shift'))instance.find('value').x+=15;
const substitute=new URLSearchParams(location.search).has('substitute');
(window as unknown as Record<string,unknown>).__ZHUDA_PREFAB_TEST__={report:()=>({ready:true,
selection:{id:'amount-plate',state:'short',node:''},provenance:inspectPrefabInstance(substitute?new Laya.Sprite():instance.root),
bounds:{x:instance.root.x,y:instance.root.y,width:instance.root.width,height:instance.root.height},
environment:{width:640,height:360,dpr:1,engine:'1.1.0'}})};
}void main();`);
write("public/index.html", `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#152030;color:white;font:14px sans-serif}#preview{width:100vw;height:80vh}header{padding:12px}</style><header>Prefab <select><option>amount-plate</option></select></header><div id="preview"></div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY -->`);
const config = { features:["core","2d","ui"], prefabPreview:"src/prefabs.ts" };
await runConsumerBuild({ projectRoot:root, engineRoot, config });
const server = http.createServer((req,res)=>{
  const relative = decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  const file = path.resolve(root,"dist/web","."+relative);
  if (!file.startsWith(path.join(root,"dist/web")+path.sep)) { res.writeHead(403).end(); return; }
  try {
    const bytes=fs.readFileSync(file);
    res.setHeader("Content-Type",({".html":"text/html",".js":"application/javascript",".json":"application/json",".png":"image/png",".lh":"application/json"})[path.extname(file)]||"application/octet-stream");
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const baseline=path.join(root,"evidence/panel.png");
const result=async (page,name,extra={})=>checkPrefab({url:base+page,baseline,output:path.join(root,"evidence",name+".json"),...extra});
try {
  await result("prefab-preview.html?id=amount-plate","baseline",{updateBaseline:true});
  assert.equal((await result("prefab-preview.html?id=amount-plate","pass")).passed,true);
  const cycles=await result("prefab-preview.html?id=amount-plate&cycles=30","cycles");
  assert.equal(cycles.lifecycle.length,30);
  assert.ok(cycles.lifecycle.every(r=>r.references===0&&r.entries===0&&r.instances===0));
  assert.equal(cycles.resources.instances,1);
  assert.equal((await result("index.html","scene")).passed,true);
  assert.equal((await result("index.html?shift=1","shift")).passed,false);
  await assert.rejects(result("index.html?substitute=1","substitute"),/provenance/);
  await assert.rejects(result("prefab-preview.html?id=missing","missing"),/Unknown prefab/);
  await assert.rejects(result("prefab-preview.html?id=amount-plate&node=missing","missing-node"),/node path/);
  const childBase=path.join(root,"evidence/value.png");
  await result("prefab-preview.html?id=amount-plate&node=value","child-baseline",{baseline:childBase,updateBaseline:true});
  assert.equal((await result("prefab-preview.html?id=amount-plate&node=value","child",{baseline:childBase})).passed,true);
  const longBase=path.join(root,"evidence/long.png");
  await result("prefab-preview.html?id=amount-plate&state=long","long-baseline",{baseline:longBase,updateBaseline:true});
  assert.equal((await result("prefab-preview.html?id=amount-plate&state=long","long",{baseline:longBase})).passed,true);
  await runConsumerBuild({ projectRoot:root,engineRoot,config:{...config,prefabEvidence:["evidence/pass.json","evidence/scene.json"]} });
  write("public/assets/plate.png",png([130,30,35,255]));
  await assert.rejects(runConsumerBuild({projectRoot:root,engineRoot,config:{...config,prefabEvidence:["evidence/pass.json"]}}),/stale prefab evidence/);
  await runConsumerBuild({projectRoot:root,engineRoot,config});
  assert.equal((await result("prefab-preview.html?id=amount-plate","wrong-texture")).passed,false);
  write("src/bad.ts","declare const Laya: any;\nimport {ZhudaEngine} from '../packages/core/DeclarativeSDK';");
  await assert.rejects(runConsumerBuild({projectRoot:root,engineRoot,config}),/bad.ts:1 \[UNTYPED_LAYA\]/);
  fs.rmSync(path.join(root,"src/bad.ts"));
  write("evidence/summary.json",JSON.stringify({passed:true,environment:"desktop Chrome WebGL",checks:14,
    limits:["iPhone Safari and Android hardware not tested"],root},null,2));
  console.log("PASS: prefab browser regressions; evidence at "+path.join(root,"evidence"));
} finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
