import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {initConsumer} from '../packages/compiler/zhuda-init.mjs';

const engine=path.resolve(import.meta.dirname,'..');
const root=path.resolve(process.env.MINIGAME_OUT||'/tmp/zhuda-minigame-acceptance');
const consumer=path.join(root,'consumer'), evidence=path.join(root,'evidence');
fs.mkdirSync(evidence,{recursive:true});
const version=JSON.parse(fs.readFileSync(path.join(engine,'package.json'))).version;
if(!fs.existsSync(path.join(consumer,'package.json')))initConsumer({target:consumer,name:'neutral-minigame',engine:version,template:'minigame'});
const consumerManifest=JSON.parse(fs.readFileSync(path.join(consumer,'package.json'),'utf8'));
const declaredEngine=consumerManifest.dependencies?.['zhuda-laya-engine'] ?? consumerManifest.devDependencies?.['zhuda-laya-engine'];
if(declaredEngine!==version) throw new Error(`Consumer must pin zhuda-laya-engine ${version}; found ${declaredEngine||'missing'}`);
const packed=JSON.parse(execFileSync('npm',['pack','--json','--pack-destination',root],{cwd:engine,encoding:'utf8',maxBuffer:16e6}))[0];
const sdk=path.join(consumer,'node_modules/zhuda-laya-engine');
fs.mkdirSync(sdk,{recursive:true});
execFileSync('tar',['-xzf',path.join(root,packed.filename),'-C',sdk,'--strip-components=1']);
for(const name of Object.keys(JSON.parse(fs.readFileSync(path.join(engine,'package.json'))).dependencies)) {
  const dest=path.join(consumer,'node_modules',name);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(!fs.existsSync(dest))fs.symlinkSync(path.join(engine,'node_modules',name),dest);
}
const configFile=path.join(consumer,'zhuda.config.json');
const config=JSON.parse(fs.readFileSync(configFile));
config.minigame={...config.minigame,timeoutMs:90_000};
fs.writeFileSync(configFile,JSON.stringify(config,null,2));
const identity={version,consumerEnginePin:declaredEngine,node:process.version,os:os.platform()+' '+os.release(),arch:os.arch(),baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),tarballSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,packed.filename))).digest('hex')};
fs.writeFileSync(path.join(evidence,'identity.json'),JSON.stringify(identity,null,2));
for(const [name,command,args] of [
  ['typecheck',process.execPath,[path.join(engine,'node_modules/typescript/bin/tsc'),'--noEmit','-p',consumer]],
  ['doctor',process.execPath,[path.join(sdk,'packages/compiler/zhuda-doctor.mjs'),'--project',consumer]],
  ['web-build',process.execPath,[path.join(sdk,'packages/compiler/zhuda-build.mjs'),'--project',consumer]],
]) {
  fs.writeFileSync(path.join(evidence,name+'.log'),execFileSync(command,args,{cwd:consumer,encoding:'utf8',maxBuffer:12e6}));
  console.log('PASS '+name);
}
const {buildMiniGame}=await import(path.join(sdk,'packages/compiler/zhuda-minigame.mjs'));
const {resolveMiniGameToolchain,listMiniGameTargets}=await import(path.join(sdk,'packages/compiler/minigame-toolchain.mjs'));
const toolchain=resolveMiniGameToolchain(process.env.LAYA_CLI_ROOT);
const platforms=await listMiniGameTargets(toolchain);
fs.writeFileSync(path.join(evidence,'platforms.json'),JSON.stringify({toolchain,platforms},null,2));
const results=[];
for(const {name:target} of platforms) {
  try {
    const report=await buildMiniGame({projectRoot:consumer,engineRoot:sdk,target,toolchainRoot:toolchain.root});
    execFileSync('unzip',['-t',path.join(path.dirname(report.output),'game.zip')]);
    results.push({target,packaging:'PASS',hostRuntime:'UNAVAILABLE',report});
    console.log('PASS '+target+' '+report.mainBytes+' bytes');
  } catch(error) {
    results.push({target,packaging:'FAIL',hostRuntime:'UNAVAILABLE',error:error.message});
    console.log('FAIL '+target+': '+error.message.slice(0,300));
  }
  fs.writeFileSync(path.join(evidence,'packaging.json'),JSON.stringify(results,null,2));
}
// Compile and size failures must not replace a previously published generation.
const target='bytedancegame', targetDir=path.join(consumer,'dist/minigames',target);
const digest=()=>crypto.createHash('sha256').update(fs.readFileSync(path.join(targetDir,'game.zip'))).update(fs.readFileSync(path.join(targetDir,'consumer-build.json'))).digest('hex');
if(fs.existsSync(path.join(targetDir,'game.zip'))) {
  const before=digest(), main=path.join(consumer,config.entry), source=fs.readFileSync(main);
  try {
    fs.writeFileSync(main,'export const broken = ;');
    await assert.rejects(buildMiniGame({projectRoot:consumer,engineRoot:sdk,target,toolchainRoot:toolchain.root}));
    assert.equal(digest(),before);
  } finally {fs.writeFileSync(main,source);}
  try {
    fs.writeFileSync(configFile,JSON.stringify({...config,minigame:{...config.minigame,maxMainPackageBytes:1}}));
    await assert.rejects(buildMiniGame({projectRoot:consumer,engineRoot:sdk,target,toolchainRoot:toolchain.root}),/MINIGAME_SIZE/);
    assert.equal(digest(),before);
  } finally {fs.writeFileSync(configFile,JSON.stringify(config,null,2));}
  fs.writeFileSync(path.join(evidence,'preserved.json'),JSON.stringify({compileFailure:true,sizeFailure:true,sha256:before},null,2));
  console.log('PASS previous-package preservation');
}
if(results.some(r=>r.packaging!=='PASS'))process.exitCode=1;
