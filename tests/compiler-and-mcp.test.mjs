import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { scanAndGenerateRegistry } from '../packages/compiler/ast-scanner.mjs';
import { runDoctorAudit } from '../packages/compiler/zhuda-doctor.mjs';
import { executeMcpTool, handleJsonRpcMessage } from '../packages/mcp-server/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

test('AST Scanner discovers @zhudaComponent classes and generates zhuda-registry.ts without IDE', () => {
  const res = scanAndGenerateRegistry(projectRoot);
  const classNames = res.classes.map((c) => c.className);
  assert.ok(classNames.includes('BoardCameraController'), 'Should discover BoardCameraController');
  assert.ok(classNames.includes('TilePhysicsBehavior'), 'Should discover TilePhysicsBehavior');
  assert.ok(classNames.includes('Spine42PhysicsRigComponent'), 'Should discover Spine42PhysicsRigComponent');
  assert.ok(classNames.includes('ZhudaParticleEmitterComponent'), 'Should discover ZhudaParticleEmitterComponent');
  assert.ok(classNames.includes('ZhudaAnimatorControllerComponent'), 'Should discover ZhudaAnimatorControllerComponent');
});

test('MCP Server resolves topology, diagnoses Laya crashes, and serves Golden Examples', () => {
  const topoRes = executeMcpTool('resolve_topology', { features: ['3d', 'spine42'] });
  assert.ok(topoRes.orderedFiles.includes('laya.d3.js'));
  assert.ok(topoRes.orderedFiles.includes('spine-core-4.2.js'));
  assert.ok(topoRes.orderedFiles.includes('laya.spine.js'));

  const diagRes = executeMcpTool('diagnose_error', {
    error: 'this._graphics.setState is not a function'
  });
  assert.equal(diagRes.diagnosed, true);
  assert.ok(diagRes.matches[0].fix.includes('installPrototypeDetox'));

  const rpcRes = handleJsonRpcMessage({
    jsonrpc: '2.0',
    id: 42,
    method: 'tools/list',
    params: {}
  });
  assert.equal(rpcRes.id, 42);
  assert.equal(rpcRes.result.tools.length, 14);
  assert.ok(rpcRes.result.tools.some((tool) => tool.name === 'audit_visual_migration'));
  assert.ok(rpcRes.result.tools.some((tool) => tool.name === 'audit_visual_contract'));
  assert.ok(rpcRes.result.tools.some((tool) => tool.name === 'validate_particle_effect'));
  assert.equal(executeMcpTool('validate_particle_effect', { effect: null }).passed, false);
  assert.equal(executeMcpTool('validate_particle_effect', { effect: { schemaVersion: 1, emitters: [{
    id: 'neutral', texture: 'external-key', seed: 1, space: 'world', blend: 'alpha',
    maxParticles: 16, shape: { type: 'point' }, rate: 10, lifetime: 1, speed: 0, angle: 0, size: 4
  }] } }).passed, true);

  const visualContractRes = executeMcpTool('audit_visual_contract', {
    projectRoot,
    manifestPath: 'tests/fixtures/visual-presentation-manifest.json'
  });
  assert.equal(visualContractRes.passed, true);
  assert.deepEqual(visualContractRes.contractIds, ['sample-focus']);

  const calibRes = executeMcpTool('calibrate_asset_pixels', { simulateDriftAndAutoFix: true });
  assert.equal(calibRes.beforeReport.passed, false);
  assert.equal(calibRes.afterReport.passed, true);
  assert.equal(calibRes.afterReport.pixelErrors.maxAbsErrorPx, 0);
  assert.equal(calibRes.afterReport.colorMetrics.maxDeltaE2000, 0);
});

test('Zhuda Doctor audit passes with 0 topological inversions and 0 legacy API violations', () => {
  const audit = runDoctorAudit();
  assert.equal(audit.passed, true);
  assert.equal(audit.apiViolations.length, 0);
  assert.equal(audit.topologyIssues.length, 0);
});

test('zhuda-laya-engine SDK bundles (ESM & CJS) and upstream LayaAir Official attribution are present', async () => {
  const manifestPath = path.join(projectRoot, 'dist/build-manifest.json');
  assert.equal(fs.existsSync(manifestPath), true);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.packageName, 'zhuda-laya-engine');
  assert.equal(manifest.repositoryUrl, 'https://github.com/zhudaandzhuer/zhuda-laya-engine');
  assert.equal(manifest.upstreamOfficial.website, 'https://layaair.com/');
  assert.equal(manifest.upstreamOfficial.repository, 'https://github.com/layabox/LayaAir');
  assert.equal(manifest.upstreamOfficial.baseVersion, '3.4.2');

  const esmPath = path.join(projectRoot, 'dist/sdk/zhuda-laya-engine.esm.js');
  const cjsPath = path.join(projectRoot, 'dist/sdk/zhuda-laya-engine.cjs');
  assert.equal(fs.existsSync(esmPath), true, 'ESM SDK bundle must exist');
  assert.equal(fs.existsSync(cjsPath), true, 'CJS SDK bundle must exist');

  const sdkMod = await import(esmPath);
  assert.ok(sdkMod.TopologyResolver, 'ESM SDK should export TopologyResolver');
  assert.ok(sdkMod.EngineGuard, 'ESM SDK should export EngineGuard');
  assert.ok(sdkMod.ZhudaEngine, 'ESM SDK should export ZhudaEngine');
  assert.ok(sdkMod.PixelCalibrationEngine, 'ESM SDK should export PixelCalibrationEngine');
  assert.ok(sdkMod.IframeSoundAdapter, 'ESM SDK should export IframeSoundAdapter');
  assert.ok(sdkMod.ViewportMatrixEngine, 'ESM SDK should export ViewportMatrixEngine');
  assert.ok(sdkMod.UnityBridgePipeline, 'ESM SDK should export UnityBridgePipeline');
  assert.ok(sdkMod.VisualFocusContract, 'ESM SDK should export VisualFocusContract');
  const cjsMod = (await import('node:module')).createRequire(import.meta.url)(cjsPath);
  for (const name of ['ZhudaParticleSystem', 'ZhudaRibbonTrail', 'ZhudaEffectEnvelope', 'ZhudaLayaParticleRenderer',
    'ZhudaLayaRibbonRenderer', 'validateParticleEffect', 'ZhudaParticleSystem3D', 'ZhudaParticleMesh3D',
    'ZhudaRibbonTrail3D', 'ZhudaRibbonPath3D', 'ZhudaLayaParticleRenderer3D', 'ZhudaLayaRibbonRenderer3D', 'validateParticleEffect3D',
    'ZhudaEffectDirector', 'ZhudaEffectBudget', 'ZhudaRuntimeProfiler', 'ZhudaVfxMaterial', 'ZhudaVfxCamera',
    'ZhudaParticleEventLink', 'sampleParticleUV', 'convertUnityVisualMaterial', 'instantiateMigratedMaterial',
    'disposeMigratedMaterial', 'convertUnityAnimationCurve', 'compareVisualFrames']) {
    assert.equal(typeof sdkMod[name], 'function', `ESM SDK should export ${name}`);
    assert.equal(typeof cjsMod[name], 'function', `CJS SDK should export ${name}`);
  }
});

test('effects and migration public types compose with particle systems in a strict consumer', () => {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'zhuda-effects-types-'));
  try {
    fs.mkdirSync(path.join(temporary,'node_modules'));fs.symlinkSync(projectRoot,path.join(temporary,'node_modules/zhuda-laya-engine'),'dir');
    const fixture=path.join(temporary,'consumer.ts');
    fs.writeFileSync(fixture,`import { ZhudaEffectDirector, ZhudaEffectBudget, ZhudaRuntimeProfiler, ZhudaVfxCamera,
      ZhudaVfxMaterial, ZhudaParticleSystem3D, ZhudaParticleEventLink, convertUnityVisualMaterial,
      instantiateMigratedMaterial, compareVisualFrames } from 'zhuda-laya-engine';
      import type { VfxMaterialSpec, EffectTimelineSpec, ParticleEmitterSpec3D } from 'zhuda-laya-engine';
      const material: VfxMaterialSpec={version:1,dissolve:.2,softDistance:.3};
      const spec: ParticleEmitterSpec3D={id:'fx',texture:'atlas',seed:1,maxParticles:16,space:'world',blend:'alpha',
        shape:{type:'point'},rate:1,lifetime:1,speed:2,size:.1,direction:{x:0,y:1,z:0},spread:.2,material,
        flipbook:{columns:4,rows:4},collision:{planes:[{normal:{x:0,y:1,z:0},offset:0}]}};
      const source=new ZhudaParticleSystem3D(spec),child=new ZhudaParticleSystem3D(spec);
      source.onEvent=e=>{const age:number=e.age;};new ZhudaParticleEventLink(source,child,{event:'collision',count:2});
      const timeline:EffectTimelineSpec={version:1,duration:2};new ZhudaEffectDirector(timeline,{}).seek(1);
      const budget=new ZhudaEffectBudget({maxParticles:100,maxCoverage:2});source.particleLimit=budget.allocate([{id:'fx',particles:16,coverage:1,priority:1}])[0].particleLimit;
      new ZhudaVfxCamera({}, {softParticles:true}).dispose();new ZhudaVfxMaterial(material,{},key=>({})).configure({dissolve:.5});
      const gpu:null=new ZhudaRuntimeProfiler().report().gpuTimeMs;
      instantiateMigratedMaterial(convertUnityVisualMaterial({id:'metal',shader:'Standard',metallic:.8}),key=>({}));
      const passed:boolean=compareVisualFrames(new Uint8Array(4),new Uint8Array(4),1,1).passed;
      // @ts-expect-error version must match the material contract
      const invalid:VfxMaterialSpec={version:2};`);
    const program=ts.createProgram([fixture],{noEmit:true,strict:true,skipLibCheck:true,types:[],target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler});
    const diagnostics=ts.getPreEmitDiagnostics(program);assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>temporary,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
    assert.equal(program.getSourceFiles().some(f=>f.fileName.includes('/core/effects/')),false);
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
});

test('particle public types compile in a strict consumer without importing implementation files', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-particle-types-'));
  try {
    fs.mkdirSync(path.join(temporary, 'node_modules'));
    fs.symlinkSync(projectRoot, path.join(temporary, 'node_modules/zhuda-laya-engine'), 'dir');
    const fixture = path.join(temporary, 'consumer.ts');
    fs.writeFileSync(fixture, `import { ZhudaParticleSystem, ZhudaLayaParticleRenderer, ZhudaRibbonTrail,
      ZhudaLayaRibbonRenderer, ZhudaEffectEnvelope, validateParticleEffect, ZhudaParticleSystem3D, ZhudaParticleMesh3D,
      ZhudaLayaParticleRenderer3D, ZhudaRibbonPath3D, ZhudaRibbonTrail3D, ZhudaLayaRibbonRenderer3D, validateParticleEffect3D } from 'zhuda-laya-engine';
      import type { ParticleEffectSpec, ParticleState, ParticleEffectSpec3D } from 'zhuda-laya-engine';
      const spec: ParticleEffectSpec = {schemaVersion:1,emitters:[{id:'test',texture:'external',maxParticles:32,
        seed:1,space:'world',blend:'alpha',shape:{type:'point'},rate:10,lifetime:1,speed:20,angle:0,size:5}]};
      const s = new ZhudaParticleSystem(spec.emitters[0]);
      s.forEach((p: ParticleState) => { const x: number = p.x; });
      const r = new ZhudaLayaParticleRenderer(s, {}, key => ({}));
      const t = new ZhudaRibbonTrail({maxPoints:8,lifetime:1,width:5,minDistance:1,teleportDistance:20});
      new ZhudaLayaRibbonRenderer(t, {}, {}).render();
      new ZhudaEffectEnvelope().start();
      const issues: string[] = validateParticleEffect(spec); r.dispose();
      // Exercise the 3D package contract without reaching into implementation files.
      const s3 = new ZhudaParticleSystem3D({id:'xyz',texture:'external',maxParticles:8,seed:2,space:'world',blend:'additive',
        shape:{type:'sphere',radius:1},direction:{x:0,y:0,z:-1},spread:0,rate:10,lifetime:1,speed:2,size:.1});
      s3.setTransform(0,0,0,{x:0,y:0,z:0,w:1},{x:0,y:0,z:-5});
      new ZhudaParticleMesh3D(s3); new ZhudaLayaParticleRenderer3D(s3, {}, key=>({}));
      const path = new ZhudaRibbonPath3D({maxPoints:8,width:.2}); path.visibleEnd=.5;
      path.setPoints([{x:0,y:0,z:0},{x:0,y:1,z:2}]);new ZhudaLayaRibbonRenderer3D(path, {}, {});
      new ZhudaRibbonTrail3D({maxPoints:8,lifetime:1,width:.2,minDistance:.01,teleportDistance:5});
      const spec3: ParticleEffectSpec3D = {schemaVersion:1,dimension:3,emitters:[s3.spec]};
      const errors3: string[] = validateParticleEffect3D(spec3);
      // @ts-expect-error unknown emitter spaces must be rejected by the public types
      spec.emitters[0].space = 'screen';
    `);
    for (const standalone of [false, true]) {
      // The package's pre-existing vendor declarations require skipLibCheck, as in tsconfig.json.
      // Also check the new particle contract alone without skipping declaration checks.
      const program = ts.createProgram([fixture], { noEmit: true, strict: true, skipLibCheck: !standalone,
        types: [], target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        ...(standalone ? { paths: { 'zhuda-laya-engine': [path.join(projectRoot, 'packages/types/zhuda-particles.d.ts')] } } : {}) });
      const diagnostics = ts.getPreEmitDiagnostics(program);
      assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics.slice(0, 5), {
        getCurrentDirectory: () => temporary, getCanonicalFileName: f => f, getNewLine: () => '\n'
      }));
      assert.equal(program.getSourceFiles().some(f => f.fileName.includes('/core/particles/')), false);
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('MCP validates 3D particle descriptors with XYZ direction and cone constraints', () => {
  const effect={schemaVersion:1,dimension:3,emitters:[{id:'xyz',texture:'external',maxParticles:8,seed:1,space:'world',blend:'alpha',
    shape:{type:'point'},direction:{x:0,y:0,z:-1},spread:.2,rate:10,lifetime:1,speed:2,size:.1}]};
  assert.equal(executeMcpTool('validate_particle_effect',{effect}).passed,true);
  effect.emitters[0].direction.z=0;assert.equal(executeMcpTool('validate_particle_effect',{effect}).passed,false);
});
