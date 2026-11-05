#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import esbuild from 'esbuild';
import sharp from 'sharp';
import {runConsumerBuild, archiveConsumer, zhudaConsumerPlugin} from './consumer-build.mjs';
import {publishConsumerOutput} from './consumer-publication.mjs';
import {resolveConsumerBranding} from './branding-assets.mjs';
import {officialBridgeSource} from './minigame-bridge.mjs';
import {auditMiniGameInputs} from './minigame-guards.mjs';
import {resolveMiniGameToolchain, listMiniGameTargets, runOfficialCli, writeOfficialProject, MINIGAME_TARGETS, sha256} from './minigame-toolchain.mjs';

const engineDefault = path.resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const allowedFeatures = new Set(['core','2d','3d','ui','ui2','gltf','particle2d','particle3d','trail2d','trail3d','effects2d','tilemap','ik','postProcess','ani']);
const problem = (code, message) => Error(`zhuda.config.json:1 [${code}] ${message}`);

function filesAt(root, dir = root) {
  return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry => {
    const file = path.join(dir,entry.name);
    if(entry.isSymbolicLink()) throw Error(`Platform payload cannot contain symlinks: ${file}`);
    return entry.isDirectory() ? filesAt(root,file) : [{path:path.relative(root,file).split(path.sep).join('/'),bytes:fs.statSync(file).size,sha256:sha256(fs.readFileSync(file))}];
  });
}

function assertInside(root, file) {
  if(!path.resolve(file).startsWith(path.resolve(root)+path.sep)) throw Error(`Path escapes platform staging: ${file}`);
}

function removeToolingDirectories(root) {
  // Platform CLIs install their own npm workspace beside the exported game.
  // It is build tooling, not runtime content; leaving it would also copy
  // platform-specific symlinks from node_modules into the consumer package.
  for (const entry of fs.readdirSync(root, {withFileTypes:true})) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      if (entry.name === 'node_modules') fs.rmSync(file, {recursive:true, force:true});
      else removeToolingDirectories(file);
    }
  }
}

function resolveExportedFile(output, resourceRoot, relative) {
  const candidates = [
    path.join(resourceRoot, relative),
    path.join(output, relative),
    path.join(output, 'src', relative),
    path.join(output, 'engine', relative),
  ];
  return candidates.find(file => fs.existsSync(file));
}

export async function buildMiniGame({projectRoot = process.cwd(), engineRoot = engineDefault, target, toolchainRoot, candidate = false, signal, onOutput} = {}) {
  projectRoot = fs.realpathSync(path.resolve(projectRoot));
  engineRoot = fs.realpathSync(path.resolve(engineRoot));
  const config = JSON.parse(fs.readFileSync(path.join(projectRoot,'zhuda.config.json'),'utf8'));
  const settings = config.minigame || {};
  if(!MINIGAME_TARGETS.includes(target)) throw problem('MINIGAME_TARGET', `Unsupported target ${target}; use --list-platforms. Kuaishou is not an official 3.4.2 target.`);
  if(config.renderer && config.renderer !== 'webgl') throw problem('MINIGAME_RENDERER','This mini-game route requires renderer: webgl. Browser WebGPU acceptance does not apply to mini-game hosts.');
  if(!Array.isArray(config.features) || !config.features.length || config.features.some(f=>!allowedFeatures.has(f)))
    throw problem('MINIGAME_FEATURES',`Declare an explicit features array from: ${[...allowedFeatures].join(', ')}. WASM/physics/Spine/native routes need separate platform acceptance.`);
  if(settings.subpackages || settings.remoteAssets) throw problem('MINIGAME_PACKAGES','Automatic asset subpackages/remote packages are not implemented. Keep a bounded main package; do not silently flatten a declared package layout.');
  // Platform quotas differ (and some vendors emit a scaffold rather than a
  // single archive).  Keep a bounded default while requiring consumers to
  // set the exact quota for their target before release.
  const maxMainBytes = settings.maxMainPackageBytes ?? 8*1024*1024;
  if(!Number.isSafeInteger(maxMainBytes) || maxMainBytes < 1) throw problem('MINIGAME_SIZE','maxMainPackageBytes must be a positive integer; confirm the limit for your platform.');
  let toolchain;
  try { toolchain = resolveMiniGameToolchain(toolchainRoot || settings.toolchain, settings.toolchainSha256); }
  catch(error) { throw problem('MINIGAME_TOOLCHAIN',`${error.message} Install official CLI 3.4.2 and pass --toolchain <installation/3.4.2>.`); }
  const platforms = await listMiniGameTargets(toolchain,{signal,timeoutMs:settings.timeoutMs});
  if(!platforms.some(p=>p.name===target)) throw problem('MINIGAME_TARGET',`${target} is not registered by this CLI installation.`);
  const parent = path.join(projectRoot,'dist','minigames',...(candidate?['candidate']:[]),target);
  for(let p=parent;p!==projectRoot;p=path.dirname(p)) if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink()) throw problem('MINIGAME_OUTPUT','Output path cannot contain symlinks.');
  fs.mkdirSync(parent,{recursive:true});
  const lock = path.join(parent,'.zhuda-minigame-build.lock');
  let lockFd;
  try {lockFd=fs.openSync(lock,'wx');} catch(error) { if(error.code==='EEXIST')throw Error(`Mini-game build owns ${parent}; inspect the lock PID before recovery.`);throw error; }
  fs.writeFileSync(lockFd,JSON.stringify({pid:process.pid,target}));
  const staging=fs.mkdtempSync(path.join(parent,'.zhuda-minigame-'));
  let keepRecovery=false;
  try {
    // Build and gate into private staging, preserving the consumer's browser release.
    const validation = await runConsumerBuild({projectRoot,engineRoot,config:{...config,outDir:path.relative(projectRoot,path.join(staging,'validation/web'))},mode:candidate?'candidate':'release'});
    signal?.throwIfAborted();
    const entry=path.resolve(projectRoot,config.entry||'src/Main.ts');
    const compiled=await esbuild.build({entryPoints:[entry],bundle:true,write:false,metafile:true,format:'iife',target:'es2020',minify:true,plugins:[zhudaConsumerPlugin({projectRoot,entry,engineRoot})]});
    auditMiniGameInputs(Object.keys(compiled.metafile.inputs).map(f=>path.resolve(f)).filter(f=>f.startsWith(projectRoot+path.sep)&&!f.startsWith(engineRoot+path.sep)),projectRoot);
    const gatedApp=fs.readFileSync(path.join(validation.output,'app.js'),'utf8');
    if(compiled.outputFiles[0].text!==gatedApp)
      throw Error('[MINIGAME_SOURCE_RACE] Consumer sources changed between the gated web build and the platform bundle; rebuild from a stable checkout.');
    const project=path.join(staging,'official-project'),output=path.join(staging,'web');
    writeOfficialProject(project,config.name||'zhuda-minigame');
    const template=path.join(project,'build-templates',target);
    fs.mkdirSync(path.join(template,'libs'),{recursive:true});
    // Official build templates preserve the pinned SDK libraries and logical paths.
    for(const file of validation.orderedLibraries) fs.copyFileSync(path.join(validation.output,'libs',file),path.join(template,'libs',file));
    for(const directory of ['assets','zhuda-notices']) {
      const source=path.join(validation.output,directory);
      if(fs.existsSync(source)) fs.cpSync(source,path.join(template,directory),{recursive:true});
    }
    const branding=resolveConsumerBranding(projectRoot,config.branding);
    let logo;
    if(branding.mode!=='none') {
      logo='zhuda-notices/boot-logo.png';
      const source=branding.mode==='engine'?fs.readFileSync(path.join(engineRoot,'assets/branding/zhuda-layaair-mark.svg')):Buffer.from(branding.logo.split(',')[1],'base64');
      await sharp(source,{limitInputPixels:16_000_000}).resize({width:1024,height:512,fit:'inside',withoutEnlargement:true}).png().toFile(path.join(template,logo));
    }
    const bootstrap=await esbuild.build({entryPoints:[path.join(engineRoot,'packages/compiler/minigame-bootstrap.mjs')],write:false,bundle:true,format:'iife',target:'es2020',minify:true,define:{global:'globalThis',self:'globalThis'}});
    const app=path.join(staging,'application.js');
    fs.writeFileSync(app,bootstrap.outputFiles[0].text+'\n;globalThis.__ZHUDA_MINIGAME__='+JSON.stringify({schemaVersion:1,target,branding:{mode:branding.mode,logo},candidate})+';\n'+compiled.outputFiles[0].text);
    // Include the cancellation polyfill's required attribution with the package.
    let dependencyRoot;
    try { dependencyRoot=path.dirname(require.resolve('abortcontroller-polyfill/package.json')); }
    catch { dependencyRoot=path.resolve(engineRoot,'node_modules/abortcontroller-polyfill'); }
    const license=path.join(dependencyRoot,'LICENSE');
    if(fs.existsSync(license))fs.copyFileSync(license,path.join(template,'zhuda-notices/ABORTCONTROLLER-LICENSE.txt'));
    const script=path.join(project,'ZhudaMiniGameBuild.ts');
    const modules={
      'laya.d3':validation.orderedLibraries.includes('laya.d3.js'),
      'laya.ui':validation.orderedLibraries.some(file=>file==='laya.ui.js'||file==='laya.ui2.js'),
      'laya.spine':validation.orderedLibraries.some(file=>file.includes('spine')),
      'laya.gltf':validation.orderedLibraries.some(file=>file.includes('gltf')),
    };
    fs.writeFileSync(script,officialBridgeSource({target,output,app,libraries:validation.orderedLibraries,platformSettings:settings.targets?.[target]||{},modules}));
    const log=path.join(parent,'last-attempt.log');
    await runOfficialCli(toolchain,['run','-p',project,`--script-file=${script}`,'--script=ZhudaMiniGameBuild.build','--skip-package-install'],{signal,timeoutMs:settings.timeoutMs,logFile:log,onOutput,ptyCommands:target==='vivogame'?['mg']:[]});
    signal?.throwIfAborted();
    removeToolingDirectories(output);
    const proof=JSON.parse(fs.readFileSync(path.join(output,'zhuda-official-build.json'),'utf8'));
    const resourceRoot=path.resolve(output,proof.resourcePath||'.');
    if(resourceRoot!==output)assertInside(output,resourceRoot);
    const boot=path.resolve(output,proof.entry);assertInside(output,boot);
    if(sha256(fs.readFileSync(boot))!==sha256(fs.readFileSync(app)))throw Error('[MINIGAME_ENTRY] Official output did not preserve the Zhuda boot entry');
    for(const file of validation.orderedLibraries) {
      const pinned=fs.readFileSync(path.join(validation.output,'libs',file));
      const emitted=resolveExportedFile(output,resourceRoot,path.join('libs',file));
      if(!emitted || sha256(fs.readFileSync(emitted))!==sha256(pinned))throw Error(`[MINIGAME_VENDOR] Official output changed or dropped pinned library ${file}`);
    }
    for(const file of filesAt(template).filter(f=>!f.path.startsWith('libs/'))) {
      const emitted=resolveExportedFile(output,resourceRoot,file.path);
      if(!emitted || sha256(fs.readFileSync(emitted))!==file.sha256)throw Error(`[MINIGAME_ASSETS] Official output changed or dropped ${file.path}`);
    }
    const payload=filesAt(output);
    // Quick-game targets emit a signed RPK.  Its bytes are the platform's
    // main package; the surrounding scaffold (including build/ and sign/)
    // remains useful for local inspection but must not be charged against the
    // runtime quota.  Web-like targets have no RPK and use the exported files.
    const packageArtifacts=payload.filter(f=>/\.rpk$/i.test(f.path));
    const mainBytes=packageArtifacts.length
      ? Math.max(...packageArtifacts.map(f=>f.bytes))
      : payload.filter(f=>!(/\.zip$/i.test(f.path))&&f.path!=='zhuda-official-build.json'&&f.path!=='zhuda-payload.json')
        .reduce((n,f)=>n+f.bytes,0);
    if(mainBytes>maxMainBytes)throw problem('MINIGAME_SIZE',`Main package ${mainBytes} bytes exceeds configured ${maxMainBytes}; reduce assets/features or provide an accepted platform package layout.`);
    const fingerprint=sha256(JSON.stringify(payload));
    const manifest={schemaVersion:1,target,fingerprint,files:payload,mainBytes,maxMainPackageBytes:maxMainBytes};
    fs.writeFileSync(path.join(output,'zhuda-payload.json'),JSON.stringify(manifest,null,2));
    const archive=archiveConsumer(output,path.join(staging,'game.zip'),config.maxPackageBytes||50_000_000);
    const report={schemaVersion:1,consumer:true,target,mode:candidate?'candidate':'release',sourceWrites:0,
      output:path.join(parent,'game'),fingerprint,archive,mainBytes,packageArtifacts,
      engine:{version:JSON.parse(fs.readFileSync(path.join(engineRoot,'package.json'))).version,dependency:validation.route.engineDependency},
      toolchain:{version:toolchain.version,fingerprint:toolchain.fingerprint,files:toolchain.files},
      inputs:{browserFingerprint:validation.fingerprint,entry:path.relative(projectRoot,entry),branding:branding.mode},
      route:{level:candidate?'unverified-candidate':'packaged-static',officialBuild:'passed',platformRuntime:'unavailable',deviceEvidence:'required',storeSubmission:'not-run'},
      limits:['WebGL only','Bounded main package; automatic subpackages are not implemented','Browser audio/providers/DOM APIs need a separate validated platform adapter','Official package output does not establish platform/device acceptance']};
    fs.writeFileSync(path.join(staging,'consumer-build.json'),JSON.stringify(report,null,2));
    signal?.throwIfAborted();
    publishConsumerOutput({staging,output:report.output});
    fs.rmSync(path.join(parent,'last-failure.json'),{force:true});
    return report;
  } catch(error) {
    keepRecovery=Boolean(error.recoveryDirectory);
    fs.writeFileSync(path.join(parent,'last-failure.json'),JSON.stringify({target,message:error.message,at:new Date().toISOString()},null,2));
    throw error;
  } finally {
    for(const cleanup of [()=>{if(!keepRecovery)fs.rmSync(staging,{recursive:true,force:true});},()=>fs.closeSync(lockFd),()=>fs.unlinkSync(lock)])try{cleanup();}catch(error){console.warn(error.message);}
  }
}

export async function miniGameCli(argv=process.argv.slice(2)) {
  const options={};let list=false;
  for(let i=0;i<argv.length;i++) {
    const arg=argv[i];
    if(arg==='--help'||arg==='-h'){console.log('Usage: zhuda-laya-minigame --platform <id> [--project <consumer>] [--toolchain <official-cli/3.4.2>] [--candidate]\n       zhuda-laya-minigame --list-platforms [--toolchain <official-cli/3.4.2>]');return;}
    if(arg==='--candidate'){options.candidate=true;continue;}
    if(arg==='--list-platforms'){list=true;continue;}
    const key={'--platform':'target','--project':'projectRoot','--toolchain':'toolchainRoot'}[arg];
    if(!key||!argv[i+1]||argv[i+1].startsWith('--'))throw Error(`Unknown or incomplete option: ${arg}`);
    options[key]=argv[++i];
  }
  const controller=new AbortController();
  const cancel=()=>controller.abort(Error('Mini-game build interrupted'));
  process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
  try {
    if(list){const toolchain=resolveMiniGameToolchain(options.toolchainRoot);console.log(JSON.stringify({version:toolchain.version,fingerprint:toolchain.fingerprint,platforms:await listMiniGameTargets(toolchain,{signal:controller.signal})},null,2));}
    else console.log(JSON.stringify(await buildMiniGame({...options,signal:controller.signal,onOutput:text=>process.stdout.write(text)}),null,2));
  } finally {process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
}
if(process.argv[1]&&fs.realpathSync(process.argv[1])===fileURLToPath(import.meta.url))miniGameCli().catch(error=>{console.error(error.message);process.exitCode=1;});
