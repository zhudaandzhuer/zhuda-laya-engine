import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import ts from 'typescript';
import esbuild from 'esbuild';
import {
  handleJsonRpcMessage,
  executeMcpTool,
  MCP_TOOLS_MANIFEST,
} from '../packages/mcp-server/index.mjs';
import { EngineGuard } from '../packages/core/RuntimeGuards.ts';
const repo = path.resolve(import.meta.dirname, '..');

test('MCP notifications, unknown methods, package versions and unknown assets are truthful', () => {
  const version = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version;
  assert.equal(handleJsonRpcMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(
    handleJsonRpcMessage({ jsonrpc: '2.0', id: 0, method: 'missing' }).error.code,
    -32601,
  );
  assert.equal(handleJsonRpcMessage({ jsonrpc: '2.0', id: 0, method: 'ping' }).id, 0);
  assert.equal(handleJsonRpcMessage(null).error.code, -32600);
  assert.equal(
    handleJsonRpcMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: null }).error.code,
    -32602,
  );
  assert.equal(
    handleJsonRpcMessage({ jsonrpc: '2.0', id: 1, method: 'initialize' }).result.serverInfo.version,
    version,
  );
  assert.equal(executeMcpTool('get_cinematic_contract').version, version);
  for (const tool of ['compile_static_asset', 'calibrate_asset_pixels'])
    assert.throws(() => executeMcpTool(tool, { assetName: 'unknown.lh' }), /Unknown built-in/);
  assert.ok(MCP_TOOLS_MANIFEST.some((tool) => tool.name === 'demo_verify_unity_migration'));
  assert.ok(!MCP_TOOLS_MANIFEST.some((tool) => tool.name === 'verify_unity_migration'));
  const input =
    [
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 0, method: 'ping' },
      { jsonrpc: '2.0', id: 2, method: 'missing' },
    ]
      .map((value) => JSON.stringify(value))
      .join('\n') + '\n';
  const child = spawnSync(process.execPath, [path.join(repo, 'packages/mcp-server/index.mjs')], {
    input,
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  const messages = child.stdout
    .trim()
    .split('\n')
    .map((value) => JSON.parse(value));
  assert.equal(messages.length, 2);
  assert.equal(messages[0].id, 0);
  assert.equal(messages[1].error.code, -32601);
});

test('health reports observed module markers and initialized native Bullet exports', () => {
  const previous = globalThis.Laya,
    physics = globalThis.Physics3D;
  try {
    delete globalThis.Laya;
    delete globalThis.Physics3D;
    assert.equal(EngineGuard.inspectEngineHealth().loadedGlobalModules, 0);
    globalThis.Laya = {
      Node: class {},
      Sprite: class {},
      ClassUtils: {},
      PhysicsCollider: class {},
      Rigidbody3D: class {},
      Laya3D: {},
    };
    assert.equal(EngineGuard.inspectEngineHealth().loadedGlobalModules, 1);
    assert.equal(EngineGuard.checkPhysics3D().wasmInitialized, false);
    globalThis.Laya.btStatics = {
      bt: { btVector3_create() {}, btDiscreteDynamicsWorld_create() {} },
    };
    assert.equal(EngineGuard.checkPhysics3D().wasmInitialized, true);
  } finally {
    globalThis.Laya = previous;
    globalThis.Physics3D = physics;
  }
});

test('every main/demo runtime export has a generated value declaration; minified entries agree', async () => {
  const require = createRequire(import.meta.url);
  for (const [stem, relative] of [
    ['zhuda-laya-engine', 'index.d.ts'],
    ['zhuda-laya-demo', 'demo/index.d.ts'],
  ]) {
    const entry = path.join(repo, 'packages/types', relative);
    const program = ts.createProgram([entry], {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      skipLibCheck: false,
    });
    const checker = program.getTypeChecker();
    const symbols = checker.getExportsOfModule(
      checker.getSymbolAtLocation(program.getSourceFile(entry)),
    );
    const values = symbols
      .filter(
        (symbol) =>
          (symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol).flags &
          ts.SymbolFlags.Value,
      )
      .map((symbol) => symbol.name);
    const esm = await import(pathToFileURL(path.join(repo, 'dist/sdk', stem + '.esm.js')).href);
    for (const name of Object.keys(esm))
      assert.ok(values.includes(name), `${stem}: missing declaration ${name}`);
    for (const suffix of ['.cjs', '.min.cjs'])
      assert.deepEqual(
        Object.keys(require(path.join(repo, 'dist/sdk', stem + suffix))).sort(),
        Object.keys(esm).sort(),
      );
    const min = await import(pathToFileURL(path.join(repo, 'dist/sdk', stem + '.min.esm.js')).href);
    assert.deepEqual(Object.keys(min).sort(), Object.keys(esm).sort());
  }
  const main = fs.readFileSync(path.join(repo, 'dist/sdk/zhuda-laya-engine.esm.js'), 'utf8');
  assert.ok(!main.includes('UNITY_CYBER_SHRINE_SCENE'));
  assert.ok(!main.includes('class ZhudaBenchmarkEngine'));
  const result = await esbuild.build({
    stdin: {
      contents: `import {ZhudaPrefab} from 'zhuda-laya-engine'; console.log(ZhudaPrefab);`,
      resolveDir: repo,
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'esm',
    minify: true,
  });
  assert.ok(
    result.outputFiles[0].contents.length < Buffer.byteLength(main) / 4,
    'named imports remain tree-shakable',
  );
});
