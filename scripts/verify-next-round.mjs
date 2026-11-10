import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { compressFixture, embeddedGlb } from '../tests/fixtures/meshopt.mjs';
import {
  validateSequenceReport,
  compareSequenceReports,
} from '../packages/ci-gate/verify-sequence.mjs';
const engine = path.resolve(import.meta.dirname, '..'),
  root = path.resolve(process.env.NEXT_ROUND_OUT ?? '/tmp/zhuda-next-round-hardening'),
  consumer = path.join(root, 'consumer'),
  evidence = path.join(root, 'evidence');
for (const sub of ['src', 'public/assets', 'node_modules'])
  fs.mkdirSync(path.join(consumer, sub), { recursive: true });
fs.mkdirSync(evidence, { recursive: true });
const raw = JSON.parse(
    fs.readFileSync(path.join(engine, 'tests/fixtures/gltf-review/node-weights.gltf')),
  ),
  compressed = await compressFixture(raw),
  glb = embeddedGlb(compressed);
fs.writeFileSync(path.join(consumer, 'public/assets/reference.gltf'), JSON.stringify(raw));
fs.writeFileSync(path.join(consumer, 'public/assets/meshopt.glb'), glb);
const broken = structuredClone(compressed);
broken.bufferViews[0].extensions.EXT_meshopt_compression.byteOffset = 999999;
fs.writeFileSync(path.join(consumer, 'public/assets/broken.gltf'), JSON.stringify(broken));
const chunk = Buffer.concat([Buffer.from('prefix'), glb]);
fs.writeFileSync(path.join(consumer, 'public/assets/chunk.bin'), chunk);
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const manifest = {
  schemaVersion: 1,
  chunks: [{ id: 'model', url: 'chunk.bin', bytes: chunk.length, sha256: sha(chunk) }],
  assets: [
    {
      id: 'meshopt.glb',
      chunk: 'model',
      offset: 6,
      length: glb.length,
      sha256: sha(glb),
      kind: 'model',
    },
  ],
};
fs.writeFileSync(
  path.join(consumer, 'src/Main.ts'),
  `import {ZhudaEngine,Zhuda3D,ZhudaModelLibrary,ZhudaModelInspector,ZhudaModelDecoderRegistry,ZhudaMeshoptModelDecoder,DirectoryAssetProvider,ChunkedAssetProvider,ZhudaTimelineSequencer,ZhudaOfflineFrameRecorder,inspectSceneResources} from 'zhuda-laya-engine';
async function start(){
 const context=await ZhudaEngine.boot({container:'#game',width:720,height:480,dprCap:2,features:['core','2d','3d','gltf'],preserveDrawingBuffer:true});
 const scene=Zhuda3D.createScene3D(context.rootScene),camera=Zhuda3D.createCamera(scene,{position:[0,0,3],clearColor:[.04,.07,.11,1]});
 const chunks=new URLSearchParams(location.search).has('chunks');
 const provider=chunks?new ChunkedAssetProvider({baseUrl:'./assets/',manifest:${JSON.stringify(manifest)}}):new DirectoryAssetProvider({baseUrl:'./assets/'});
 const decoders=new ZhudaModelDecoderRegistry();decoders.register(new ZhudaMeshoptModelDecoder());
 const library=new ZhudaModelLibrary({provider,decoders,maxIdle:0});let instance:Awaited<ReturnType<typeof library.instantiate>>|undefined;
 const frames=async()=>{ZhudaEngine.flushRenderFrames(3);for(let i=0;i<5;i++)await new Promise<void>(r=>requestAnimationFrame(()=>r()));};
 const load=async(id:string)=>{instance?.dispose();instance=undefined;instance=await library.instantiate(id);scene.addChild(instance.node);await frames();return new ZhudaModelInspector(instance).inspect();};
 const report=()=>({renderer:context.renderer,resources:inspectSceneResources(),models:library.report()});
 await load(chunks?'meshopt.glb':'reference.gltf');context.runtime.start(()=>{});
 const timeline=new ZhudaTimelineSequencer({schemaVersion:1,duration:1,tracks:[{id:'camera',target:'camera',kind:'number',keys:[{time:0,value:0},{time:1,value:.25}]}]},{camera:{set(value){const p=camera.transform.position.clone();p.x=value as number;camera.transform.position=p;}}});
 Object.assign(window,{__ZHUDA_RENDERER__:context.renderer,nextRound:{ready:true,load,report,
 async failure(){const node=instance!.node;let message='';try{await library.instantiate('broken.gltf');}catch(e){message=String(e);}if(!message)throw Error('Corrupt Meshopt accepted');return {message,kept:instance!.node===node};},
 async lifecycle(){instance?.dispose();instance=undefined;const rows=[];for(let i=0;i<30;i++){await load('meshopt.glb');instance!.dispose();instance=undefined;await frames();rows.push(report());}await load('meshopt.glb');return rows;},
 async seek(time:number){timeline.seek(time);await frames();return report();},
 async offline(){const recorder=new ZhudaOfflineFrameRecorder({durationSeconds:1,fps:2,advance:async frame=>{timeline.seek(frame.time);await frames();},capture:frame=>({ready:true,imagePath:'frame-'+frame.index+'.png'})});const captured=await recorder.record();recorder.dispose();return captured.map(f=>f.time);},
 dispose(){instance?.dispose();timeline.dispose();library.dispose();decoders.dispose();provider.dispose();const result=report();context.dispose();return result;}
 }});
}start().catch(error=>Object.assign(window,{nextRound:{ready:false,error:String(error)}}));`,
);
const packed = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', root], {
      cwd: engine,
      encoding: 'utf8',
      maxBuffer: 32e6,
    }),
  )[0],
  sdk = path.join(consumer, 'node_modules/zhuda-laya-engine');
fs.rmSync(sdk, { recursive: true, force: true });
fs.mkdirSync(sdk, { recursive: true });
execFileSync('tar', ['-xzf', path.join(root, packed.filename), '-C', sdk, '--strip-components=1']);
for (const dep of ['@webgpu', 'i18next', 'esbuild', 'typescript', 'meshoptimizer', 'pngjs']) {
  const dest = path.join(consumer, 'node_modules', dep);
  if (!fs.existsSync(dest)) fs.symlinkSync(path.join(engine, 'node_modules', dep), dest);
}
fs.writeFileSync(
  path.join(consumer, 'package.json'),
  JSON.stringify({
    name: 'next-round-consumer',
    private: true,
    type: 'module',
    dependencies: {
      'zhuda-laya-engine': JSON.parse(fs.readFileSync(path.join(engine, 'package.json'))).version,
    },
  }),
);
fs.writeFileSync(
  path.join(consumer, 'public/index.html'),
  '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#111}#game{width:720px;height:480px}</style><div id="game"></div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY -->',
);
const program = ts.createProgram([path.join(consumer, 'src/Main.ts')], {
    noEmit: true,
    strict: true,
    skipLibCheck: false,
    types: [],
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  }),
  diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(
  diagnostics.length,
  0,
  ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => consumer,
    getCanonicalFileName: (x) => x,
    getNewLine: () => '\n',
  }),
);
const esm = await import(path.join(sdk, 'dist/sdk/zhuda-laya-engine.esm.js')),
  cjs = createRequire(import.meta.url)(path.join(sdk, 'dist/sdk/zhuda-laya-engine.cjs'));
for (const name of [
  'ZhudaTimelineSequencer',
  'ZhudaOfflineFrameRecorder',
  'ChunkedAssetProvider',
  'ZhudaModelDecoderRegistry',
  'ZhudaMeshoptModelDecoder',
]) {
  assert.equal(typeof esm[name], 'function');
  assert.equal(typeof cjs[name], 'function');
}
const { runConsumerBuild } = await import(path.join(sdk, 'packages/compiler/consumer-build.mjs'));
for (const renderer of ['webgl', 'webgpu']) {
  const config = {
    name: 'next-round-' + renderer,
    entry: 'src/Main.ts',
    renderer,
    features: ['core', '2d', '3d', 'gltf'],
    outDir: 'dist/' + renderer,
    assetInclude: ['reference.gltf', 'meshopt.glb', 'broken.gltf', 'chunk.bin'],
  };
  fs.writeFileSync(path.join(consumer, 'zhuda.config.json'), JSON.stringify(config));
  await runConsumerBuild({ projectRoot: consumer, engineRoot: sdk, config });
}
const server = http.createServer((req, res) => {
  try {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (name.endsWith('/')) name += 'index.html';
    const file = path.join(consumer, 'dist', name);
    res.setHeader(
      'Content-Type',
      file.endsWith('.js')
        ? 'application/javascript'
        : file.endsWith('.wasm')
          ? 'application/wasm'
          : file.endsWith('.html')
            ? 'text/html'
            : 'application/octet-stream',
    );
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let b;
const results = [];
try {
  for (const backend of ['webgl', 'webgpu']) {
    b = await chromeFixture();
    await b.send('Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 600,
      deviceScaleFactor: 2,
      mobile: false,
    });
    const url = 'http://127.0.0.1:' + server.address().port + '/' + backend + '/';
    await b.send('Page.navigate', { url });
    await b.waitFor('!!window.nextRound');
    assert.equal(
      await b.evaluate('nextRound.ready'),
      true,
      JSON.stringify(await b.evaluate('nextRound')),
    );
    await b.waitFor('!document.querySelector("#zhudaLogoSplash")');
    const renderer = await b.evaluate('nextRound.report().renderer');
    assert.equal(renderer.selected, backend);
    assert.equal(renderer.status, 'ready');
    if (backend === 'webgpu') assert.equal(renderer.adapter.isFallbackAdapter, false);
    assert.deepEqual(renderer.errors, []);
    // Same neutral definition in isolation: compression must not change its pixels.
    await b.screenshot(path.join(evidence, backend + '-reference.png'));
    const inspection = await b.evaluate('nextRound.load("meshopt.glb")');
    assert.equal(inspection.compatibility.status, 'supported');
    await b.screenshot(path.join(evidence, backend + '-meshopt.png'));
    assert.equal(
      sha(fs.readFileSync(path.join(evidence, backend + '-reference.png'))),
      sha(fs.readFileSync(path.join(evidence, backend + '-meshopt.png'))),
      'Compressed/uncompressed pixels differ',
    );
    const failure = await b.evaluate('nextRound.failure()');
    assert.equal(failure.kept, true);
    const lifecycle = await b.evaluate('nextRound.lifecycle()');
    assert.equal(lifecycle.length, 30);
    for (const r of lifecycle)
      assert.equal(r.models.entries + r.models.references + r.models.instances, 0);
    assert.deepEqual(lifecycle[3].resources, lifecycle.at(-1).resources);
    assert.deepEqual(await b.evaluate('nextRound.offline()'), [0, 0.5, 1]);
    const frames = [];
    for (const [i, time] of [0, 0.5, 1].entries()) {
      await b.evaluate('nextRound.seek(' + time + ')');
      const imagePath = backend + '-frame-' + i + '.png';
      await b.screenshot(path.join(evidence, imagePath));
      frames.push({
        time,
        ready: true,
        imagePath,
        imageSha256: sha(fs.readFileSync(path.join(evidence, imagePath))),
      });
    }
    assert.notEqual(
      frames[0].imageSha256,
      frames.at(-1).imageSha256,
      'Camera timeline must move the visible model',
    );
    const sequence = {
      schemaVersion: 1,
      requestedBackend: backend,
      selectedBackend: renderer.selected,
      isFallbackAdapter: renderer.adapter?.isFallbackAdapter ?? null,
      fallbackReason: renderer.fallbackReason,
      status: renderer.status,
      errors: renderer.errors,
      expectedTimes: [0, 0.5, 1],
      frames,
    };
    const gate = validateSequenceReport(sequence, { root: evidence });
    assert.equal(gate.passed, true, gate.errors.join(';'));
    fs.writeFileSync(
      path.join(evidence, backend + '-sequence.json'),
      JSON.stringify(sequence, null, 2),
    );
    const referenceFrames = [];
    for (const [i, time] of [0, 0.5, 1].entries()) {
      await b.evaluate('nextRound.seek(' + time + ')');
      const imagePath = backend + '-reference-frame-' + i + '.png';
      await b.screenshot(path.join(evidence, imagePath));
      referenceFrames.push({
        time,
        ready: true,
        imagePath,
        imageSha256: sha(fs.readFileSync(path.join(evidence, imagePath))),
      });
    }
    const reference = {
      ...sequence,
      frames: referenceFrames,
      approval: {
        reviewedBy: 'engine-authored neutral regression geometry; not consumer artwork approval',
        reviewedAt: new Date().toISOString(),
      },
    };
    const comparison = compareSequenceReports(sequence, reference, { root: evidence });
    assert.equal(comparison.passed, true, JSON.stringify(comparison));
    const wrong = structuredClone(sequence);
    wrong.frames[0] = { ...wrong.frames[2], time: 0 };
    assert.equal(
      compareSequenceReports(wrong, reference, { root: evidence }).passed,
      false,
      'Wrong camera frame must fail visual regression',
    );
    fs.writeFileSync(
      path.join(evidence, backend + '-reference-sequence.json'),
      JSON.stringify(reference, null, 2),
    );
    fs.writeFileSync(
      path.join(evidence, backend + '-comparison.json'),
      JSON.stringify(comparison, null, 2),
    );
    execFileSync(
      process.execPath,
      [
        path.join(sdk, 'packages/ci-gate/verify-sequence.mjs'),
        path.join(evidence, backend + '-sequence.json'),
        '--reference',
        path.join(evidence, backend + '-reference-sequence.json'),
      ],
      { cwd: consumer, encoding: 'utf8' },
    );
    await b.evaluate('nextRound.dispose()');
    await b.send('Page.navigate', { url: url + '?chunks=1' });
    await b.waitFor('!!window.nextRound');
    assert.equal(
      await b.evaluate('nextRound.ready'),
      true,
      JSON.stringify(await b.evaluate('nextRound')),
    );
    const chunkReport = await b.evaluate('nextRound.report()');
    assert.equal(chunkReport.models.instances, 1);
    await b.evaluate('nextRound.dispose()');
    assert.deepEqual(b.errors, []);
    results.push({
      backend,
      browser: await b.send('Browser.getVersion'),
      renderer,
      inspection,
      failure,
      lifecycle,
      chunkReport,
      gate,
      comparison,
    });
    fs.writeFileSync(
      path.join(evidence, 'results.json'),
      JSON.stringify(
        {
          commit: execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: engine,
            encoding: 'utf8',
          }).trim(),
          workingTree: true,
          node: process.version,
          os: os.platform() + ' ' + os.release(),
          tarballSha256: sha(fs.readFileSync(path.join(root, packed.filename))),
          sourceSha256: sha(Buffer.from(JSON.stringify(raw))),
          compressedSha256: sha(glb),
          results,
        },
        null,
        2,
      ),
    );
    await b.close();
    b = null;
    console.log('PASS public packed SDK / Meshopt / chunk / timeline: ' + backend);
  }
} finally {
  await b?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
