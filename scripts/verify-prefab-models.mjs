#!/usr/bin/env node
// Real-browser check of model prefabs (`kind: 'models'`) through the consumer
// build and the prefab checker: a prefab of GLB models with copies is built by
// an independent consumer, drawn in the isolated preview, compared with its
// own reference, survives 30 load/unload cycles without leftovers, and a
// moved copy or a hidden node fails the comparison. Desktop WebGL evidence
// only; not WebGPU, mobile or art approval.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { runConsumerBuild } from '../packages/compiler/consumer-build.mjs';
import { checkPrefab } from '../packages/compiler/prefab-check.mjs';
import { floorGlb } from './lib/film-fixtures.mjs';
import { PNG } from 'pngjs';
import { chromeFixture } from '../packages/compiler/chrome-host.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const root =
  process.env.PREFAB_MODELS_FIXTURE_DIR ||
  fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-prefab-models-'));
for (const dir of ['src', 'public/assets/set', 'evidence'])
  fs.mkdirSync(path.join(root, dir), { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(root, name), value);
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const engineVersion = JSON.parse(
  fs.readFileSync(path.join(engineRoot, 'package.json'), 'utf8'),
).version;
write(
  'package.json',
  JSON.stringify({
    private: true,
    type: 'module',
    dependencies: { 'zhuda-laya-engine': engineVersion },
  }),
);
// Two neutral models: a plain floor and one that glows by itself.
write('public/assets/set/tile.glb', floorGlb({ uv1: false }));
write('public/assets/set/glow.glb', floorGlb({ uv1: false, emissive: [0.6, 0.2, 0.05] }));
const manifest = {
  schemaVersion: 1,
  entries: ['set/tile.glb', 'set/glow.glb'].map((id) => ({
    id,
    sha256: sha(fs.readFileSync(path.join(root, 'public/assets', id))),
  })),
};
function writeDefinitions(shift = 0) {
  const definitions = [
    {
      id: 'yard',
      kind: 'models',
      nodes: [
        {
          name: 'tiles',
          asset: 'set/tile.glb',
          placements: [
            [-2.2 + shift, 0, 0, 0, 0.15],
            [0, 0, -1, 45, 0.2],
            [2.2, 0, 0, 0, 0.15],
          ],
        },
        { name: 'lamp', asset: 'set/glow.glb', position: [0, 0.6, 1.5], scale: 0.06 },
      ],
      states: { all: {}, dark: { lamp: { active: false } } },
    },
    // Levels of detail: the plain tile near the eye, the glowing one from 5 m, nothing beyond 12 m.
    {
      id: 'levels',
      kind: 'models',
      nodes: [
        {
          name: 'tiles',
          asset: 'set/tile.glb',
          lod: [{ asset: 'set/glow.glb', fromMeters: 5 }],
          cullMeters: 12,
          placements: [
            [-2.2, 0, 0, 0, 0.15],
            [0, 0, -1, 45, 0.2],
            [2.2, 0, 0, 0, 0.15],
          ],
        },
      ],
      states: { all: {} },
    },
  ];
  write(
    'src/prefabs.ts',
    `import {DirectoryAssetProvider} from 'zhuda-laya-engine';
import type {PrefabModelsDefinition,AssetProvider,PrefabPreview3D} from 'zhuda-laya-engine';
export const definitions:PrefabModelsDefinition[]=${JSON.stringify(definitions)} as PrefabModelsDefinition[];
export const preview3D:PrefabPreview3D={camera:{position:[0,4,7],rotationEuler:[-32,0,0],clearColor:[0,0,0,1]},ambientColor:[0.5,0.5,0.5,1]};
export function createAssetProvider():AssetProvider {return new DirectoryAssetProvider({baseUrl:'./assets/',manifest:${JSON.stringify(manifest)}});}`,
  );
}
writeDefinitions();
// The Scene instantiates the same definition through the same provider factory.
write(
  'src/Main.ts',
  `import {ZhudaEngine,Zhuda3D,ZhudaPrefabLibrary} from 'zhuda-laya-engine';
import {definitions,createAssetProvider,preview3D} from './prefabs';
async function main(){
const context=await ZhudaEngine.boot({container:document.querySelector<HTMLElement>('#preview')!,width:640,height:360,dprCap:1,features:['core','2d','3d','ui','gltf'],bgColor:'#152030'});
const scene=Zhuda3D.createScene3D(context.rootScene,{ambientColor:preview3D.ambientColor});
Zhuda3D.createCamera(scene,preview3D.camera!);
Zhuda3D.createDirectionalLight(scene,{rotationEuler:[-35,-30,0],intensity:1});
const provider=createAssetProvider();
const library=new ZhudaPrefabLibrary({provider,definitions});
window.addEventListener('pagehide',()=>{library.dispose();provider.dispose?.();context.dispose()},{once:true});
const levels=new URLSearchParams(location.search).has('levels');
const instance=await library.instantiate(levels?'levels':'yard',{parent:scene});
// For the check: the eye that levels are chosen for is given, the camera stays where it is.
Reflect.set(window,'__LEVELS__',{ready:true,update:(x:number,y:number,z:number)=>instance.updateLod([x,y,z]),glow:(name:string,scale:number)=>{try{instance.setEmission(name,scale);return 'set'}catch(error){return String((error as Error).message)}}});
}
void main();`,
);
write(
  'public/index.html',
  '<!doctype html><meta charset="utf-8"><div id="preview"></div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY -->',
);
const config = {
  features: ['core', '2d', '3d', 'ui', 'gltf'],
  prefabPreview: 'src/prefabs.ts',
  branding: { mode: 'none' },
};
const types = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};
const server = http.createServer((req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, 'dist/web', '.' + relative);
  if (!file.startsWith(path.join(root, 'dist/web') + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const bytes = fs.readFileSync(file);
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;
const baseline = path.join(root, 'evidence/yard.png');
const check = (query, name, extra = {}) =>
  checkPrefab({
    url: base + 'prefab-preview.html?' + query,
    baseline,
    output: path.join(root, 'evidence', name + '.json'),
    ...extra,
  });
const report = {};
try {
  await runConsumerBuild({ projectRoot: root, engineRoot, config });
  // 1. The preview draws the prefab; the second run matches the first.
  assert.equal((await check('id=yard', 'reference', { updateBaseline: true })).passed, false);
  const pass = await check('id=yard', 'pass');
  assert.equal(pass.passed, true, 'the prefab matches its own reference');
  assert.equal(pass.provenance.kind, '3d');
  assert.equal(pass.provenance.id, 'yard');
  report.provenance = pass.provenance;
  // 2. Thirty load/unload cycles leave nothing behind.
  const cycles = await check('id=yard&cycles=30', 'cycles');
  assert.equal(cycles.lifecycle.length, 30);
  assert.ok(
    cycles.lifecycle.every((r) => r.instances === 0),
    'no instance survives a cycle',
  );
  assert.equal(cycles.passed, true, 'identical after 30 cycles');
  report.cycles = cycles.lifecycle.length;
  // 3. A state hides a node: the picture changes, and matches its own reference.
  assert.equal((await check('id=yard&state=dark', 'dark-against-all')).passed, false);
  const dark = path.join(root, 'evidence/dark.png');
  await check('id=yard&state=dark', 'dark-reference', { baseline: dark, updateBaseline: true });
  assert.equal((await check('id=yard&state=dark', 'dark', { baseline: dark })).passed, true);
  // 4. One node alone.
  const lamp = path.join(root, 'evidence/lamp.png');
  await check('id=yard&node=lamp', 'lamp-reference', { baseline: lamp, updateBaseline: true });
  assert.equal((await check('id=yard&node=lamp', 'lamp', { baseline: lamp })).passed, true);
  assert.equal((await check('id=yard&node=lamp', 'lamp-against-all')).passed, false);
  await assert.rejects(check('id=yard&node=missing', 'missing-node'), /node path/);
  await assert.rejects(check('id=missing', 'missing'), /Unknown prefab/);
  // 4b. Levels of detail, drawn: the same three copies seen with the eye among
  // them (plain tiles), 8 m away (the glowing version) and 12 m away (the
  // farthest one is no longer drawn).
  {
    const browser = await chromeFixture();
    try {
      await browser.send('Emulation.setDeviceMetricsOverride', {
        width: 640,
        height: 360,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await browser.send('Page.navigate', { url: base + 'index.html?levels' });
      for (let i = 0; i < 300; i++) {
        if (await browser.evaluate('window.__LEVELS__?.ready === true').catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const picture = async (name, eye) => {
        const counts = JSON.parse(
          await browser.evaluate(`JSON.stringify(window.__LEVELS__.update(${eye.join(',')}))`),
        );
        await new Promise((resolve) => setTimeout(resolve, 600));
        const file = path.join(root, 'evidence', `levels-${name}.png`);
        await browser.screenshot(file);
        const png = PNG.sync.read(fs.readFileSync(file));
        let warm = 0,
          drawn = 0;
        for (let i = 0; i < png.data.length; i += 4) {
          const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
          // The page behind the tiles is dark blue: a tile is clearly brighter.
          if (r + g + b > 200) drawn++;
          warm += r - b;
        }
        return { counts, drawn, warm };
      };
      const among = await picture('among', [-2.2, 0, 0]);
      const away = await picture('away', [-8, 0, 0]);
      const far = await picture('far', [-12, 0, 0]);
      report.levels = { among, away, far };
      assert.deepEqual(among.counts, { levels: [3, 0], culled: 0, switched: 0 });
      assert.deepEqual(away.counts, { levels: [0, 3], culled: 0, switched: 3 });
      assert.deepEqual(far.counts, { levels: [0, 2], culled: 1, switched: 1 });
      assert.ok(among.drawn > 2000, `three tiles are drawn: ${among.drawn}`);
      assert.ok(
        away.warm > among.warm + 20000,
        `the far version glows: ${away.warm} against ${among.warm}`,
      );
      assert.ok(
        far.drawn < away.drawn * 0.85,
        `a culled copy is not drawn: ${far.drawn} against ${away.drawn}`,
      );
      // Coming back restores the first picture exactly.
      const back = await picture('back', [-2.2, 0, 0]);
      assert.deepEqual(back.counts.levels, [3, 0]);
      assert.equal(back.drawn, among.drawn);
      assert.equal(back.warm, among.warm);
    } finally {
      await browser.close();
    }
  }
  // 4c. A model's glow changed while it runs: the lamp put out, tripled, and back.
  {
    const browser = await chromeFixture();
    try {
      await browser.send('Emulation.setDeviceMetricsOverride', {
        width: 640,
        height: 360,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await browser.send('Page.navigate', { url: base + 'index.html' });
      for (let i = 0; i < 300; i++) {
        if (await browser.evaluate('window.__LEVELS__?.ready === true').catch(() => false)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const warmth = async (name, scale) => {
        const outcome = await browser.evaluate(`window.__LEVELS__.glow('lamp', ${scale})`);
        assert.equal(outcome, 'set');
        await new Promise((resolve) => setTimeout(resolve, 600));
        const file = path.join(root, 'evidence', `glow-${name}.png`);
        await browser.screenshot(file);
        const png = PNG.sync.read(fs.readFileSync(file));
        // Brightness of the whole frame: red saturates first, so warmth alone misleads.
        let light = 0;
        for (let i = 0; i < png.data.length; i += 4)
          light += png.data[i] + png.data[i + 1] + png.data[i + 2];
        return light;
      };
      const authored = await warmth('authored', 1);
      const out = await warmth('out', 0);
      const strong = await warmth('strong', 3);
      const again = await warmth('again', 1);
      report.glow = { authored, out, strong, again };
      assert.ok(out < authored - 2000, `emission 0 puts the lamp out (${out} against ${authored})`);
      assert.ok(strong > authored + 2000, `emission 3 is brighter (${strong} against ${authored})`);
      assert.equal(again, authored, 'emission 1 is the authored picture again');
      assert.match(await browser.evaluate(`window.__LEVELS__.glow('missing', 1)`), /no model node/);
      assert.match(await browser.evaluate(`window.__LEVELS__.glow('lamp', 9)`), /0\.\.8/);
    } finally {
      await browser.close();
    }
  }
  // 5. A copy moved by 30 cm must fail against the reference.
  writeDefinitions(0.3);
  await runConsumerBuild({ projectRoot: root, engineRoot, config });
  const moved = await check('id=yard', 'moved');
  assert.equal(moved.passed, false, 'a moved copy is caught');
  report.movedDiffPixels = moved.diffPixels ?? moved.comparison?.diffPixels;
  fs.writeFileSync(path.join(root, 'evidence/report.json'), JSON.stringify(report, null, 2));
  console.log(`PASS model prefabs: ${JSON.stringify(report)}; evidence ${root}/evidence`);
} finally {
  server.close();
}
