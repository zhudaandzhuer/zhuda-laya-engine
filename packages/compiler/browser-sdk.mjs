#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import esbuild from 'esbuild';
import {TopologyResolver} from './compiler-runtime.mjs';

import {modelBrowserExample} from './browser-model-example.mjs';
import {browserExample} from './browser-sdk-example.mjs';

export const BROWSER_PROFILES=Object.freeze({
  '2d':Object.freeze(['core','2d','ui']),
  '3d':Object.freeze(['core','2d','3d','ui']),
  '3d-gltf':Object.freeze(['core','2d','3d','ui','gltf','postProcess']),
});
const hash=(bytes,algorithm='sha256',encoding='hex')=>crypto.createHash(algorithm).update(bytes).digest(encoding);
const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

async function branding(svg, engineRoot) {
  const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const result = await esbuild.build({absWorkingDir:engineRoot,minify:true,stdin:{contents:`import {mountBrandSplash} from './packages/compiler/branding.mjs'; mountBrandSplash(${JSON.stringify(source)}, globalThis.ZhudaBranding);`,resolveDir:engineRoot},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020'});
  return result.outputFiles[0].text;
}

/** Create/reuse a deterministic distribution; never overwrite a different release. */
export async function buildBrowserSdk({engineRoot=defaultRoot,outDir,profiles=['2d','3d','3d-gltf']}={}){
  engineRoot=path.resolve(engineRoot);
  if(!Array.isArray(profiles)||!profiles.length||new Set(profiles).size!==profiles.length||profiles.some(p=>!Object.hasOwn(BROWSER_PROFILES,p)))
    throw Error('Browser profile must be 2d, 3d or 3d-gltf (unique, nonempty list)');
  const packageInfo=JSON.parse(fs.readFileSync(path.join(engineRoot,'package.json'),'utf8'));
  const version=packageInfo.version;
  if(packageInfo.dependencies.esbuild!==esbuild.version)throw Error('Browser bundler version differs from the exact package pin; reinstall dependencies');
  const sdkFile=path.join(engineRoot,'dist/sdk/zhuda-laya-engine.esm.js');
  const sdk=fs.readFileSync(sdkFile,'utf8');
  if(!sdk.includes(`zhuda-laya-engine v${version}`))throw Error('SDK version is stale; run npm run build before browser packaging');
  const svg=fs.readFileSync(path.join(engineRoot,'assets/branding/zhuda-layaair-mark.svg'),'utf8');
  const brandCode=await branding(svg,engineRoot);
  const bundled=await esbuild.build({entryPoints:[sdkFile],bundle:true,write:false,minify:true,format:'iife',globalName:'__zhudaSdk',platform:'browser',target:'es2020',legalComments:'inline'});
  const output=path.resolve(outDir||path.join(engineRoot,'dist/browser',version));
  const files=new Map();
  const manifest={schemaVersion:1,engine:'zhuda-laya-engine',version,upstream:'LayaAir 3.4.2',profiles:{}};
  for(const profile of profiles){
    const features=[...BROWSER_PROFILES[profile]],topology=TopologyResolver.resolveByFeatures(features);
    const problems=TopologyResolver.auditFileSequence(topology.orderedFiles);
    if(problems.length)throw Error('Invalid browser topology: '+problems.map(p=>p.message).join('; '));
    const inputs=[{path:'dist/sdk/zhuda-laya-engine.esm.js',sha256:hash(sdk)},{path:'assets/branding/zhuda-layaair-mark.svg',sha256:hash(svg)}];
    for(const file of ['browser-sdk.mjs','browser-sdk-example.mjs','browser-model-example.mjs','branding.mjs'])
      inputs.push({path:'packages/compiler/'+file,sha256:hash(fs.readFileSync(path.join(engineRoot,'packages/compiler',file)))});
    const libs=topology.orderedFiles.map(file=>{
      const relative='vendor/laya-3.4.2/libs/'+file,bytes=fs.readFileSync(path.join(engineRoot,relative));
      inputs.push({path:relative,sha256:hash(bytes)});return bytes.toString('utf8');
    });
    const modelDocument = profile==='3d-gltf' ? fs.readFileSync(path.join(engineRoot,'examples/model-inspector/asset.gltf'),'utf8') : null;
    if(modelDocument) inputs.push({path:'examples/model-inspector/asset.gltf',sha256:hash(modelDocument)});
    const metadata={version,profile,features,libraries:topology.orderedFiles,sourceFingerprint:hash(JSON.stringify({inputs,esbuild:esbuild.version})),bundler:{name:'esbuild',version:esbuild.version}};
    const code=`/* Zhuda LayaAir ${version} browser ${profile}; MIT; see LICENSE.txt (including upstream attribution). */\n(function(){\nif(globalThis.Zhuda||globalThis.Laya||globalThis.ZhudaBundle)throw Error('ZHUDA_DUPLICATE_RUNTIME: load exactly one official browser bundle per page');\n${brandCode}\n${libs.join('\n;\n')}\n;${bundled.outputFiles[0].text}\nObject.defineProperty(globalThis,'Zhuda',{value:Object.freeze(__zhudaSdk),configurable:false,writable:false});\nconst meta=${JSON.stringify(metadata)};Object.freeze(meta.features);Object.freeze(meta.libraries);Object.defineProperty(globalThis,'ZhudaBundle',{value:Object.freeze(meta),configurable:false,writable:false});\n})();\n`;
    const file=`zhuda-${profile}.js`,bytes=Buffer.from(code);
    const entry={...metadata,file,bytes:bytes.length,sha256:hash(bytes),integrity:'sha384-'+hash(bytes,'sha384','base64'),inputs};
    manifest.profiles[profile]=entry;files.set(file,bytes);
    files.set(`example-${profile}.html`,Buffer.from(modelDocument ? modelBrowserExample(entry,JSON.parse(modelDocument)) : browserExample(entry)));
  }
  files.set('sdk-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
  files.set('LICENSE.txt',fs.readFileSync(path.join(engineRoot,'LICENSE')));
  files.set('index.html',Buffer.from(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Zhuda Browser SDK ${version}</title><style>body{max-width:850px;margin:60px auto;padding:24px;background:#0d1724;color:#e5f1ff;font:18px/1.7 system-ui}a{color:#72d6eb}code{overflow-wrap:anywhere}</style><h1>豬大 Browser SDK ${version}</h1><p>單一 HTML，使用真正的 Zhuda × LayaAir 引擎。</p><ul>${profiles.map(p=>`<li><a href="example-${p}.html">${p.toUpperCase()} 可執行範例</a> · <a href="zhuda-${p}.js">完整 browser bundle</a></li>`).join('')}</ul><p>將範例中的相對 script src 換成此版本的完整網址，保留 integrity 與 crossorigin，即可從允許外部腳本的 HTML 引用。</p><p>使用固定 release 網址，不使用 latest。站內遊戲沙箱只允許自身版本資源：部署包內放入同一份 bundle，保留相對路徑。</p><p><a href="sdk-manifest.json">版本、依賴與完整性清單</a> · <a href="https://github.com/zhudaandzhuer/zhuda-laya-engine">公開 API 與開發路線</a></p><p>這是瀏覽器交付入口；Prefab 比對、遊戲驗收與裝置測試仍須完成。範例非完整遊戲。</p></html>`));
  const payload=[...files].map(([path,bytes])=>({path,bytes:bytes.length,sha256:hash(bytes)})).sort((a,b)=>a.path.localeCompare(b.path));
  files.set('payload-manifest.json',Buffer.from(JSON.stringify({fingerprint:hash(JSON.stringify(payload)),files:payload},null,2)+'\n'));
  if(fs.existsSync(output)){
    const existing=fs.readdirSync(output).sort();
    if(JSON.stringify(existing)!==JSON.stringify([...files.keys()].sort())||[...files].some(([file,bytes])=>!fs.readFileSync(path.join(output,file)).equals(bytes)))
      throw Error('Browser SDK output differs; choose a fresh --out directory to preserve the prior release');
    return {output,manifest,reused:true};
  }
  fs.mkdirSync(path.dirname(output),{recursive:true});
  const staging=fs.mkdtempSync(path.join(path.dirname(output),'.zhuda-browser-'));
  try{for(const[file,bytes]of files)fs.writeFileSync(path.join(staging,file),bytes);fs.renameSync(staging,output);}
  finally{fs.rmSync(staging,{recursive:true,force:true});}
  return {output,manifest,reused:false};
}

if(process.argv[1]&&fs.realpathSync(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);let outDir,profiles;
  try{
    for(let i=0;i<args.length;i++){
      if(args[i]==='--out'&&args[i+1])outDir=args[++i];
      else if(args[i]==='--profile'&&args[i+1])profiles=[args[++i]];
      else throw Error('Usage: zhuda-laya-browser-sdk [--out DIRECTORY] [--profile 2d|3d|3d-gltf]');
    }
    console.log(JSON.stringify(await buildBrowserSdk({outDir,profiles}),null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
