import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const repo = path.resolve(import.meta.dirname, '..');

// Mirror exactly the declaration files npm would publish, so the check sees
// what a consumer installs (and not the repository's TypeScript sources).
function stagePublishedTypes() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-types-resolution-'));
  const sdk = path.join(root, 'node_modules/zhuda-laya-engine');
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: repo,
      encoding: 'utf8',
      maxBuffer: 32e6,
    }),
  )[0];
  const files = packed.files.map((file) => file.path);
  for (const file of ['package.json', ...files.filter((f) => f.startsWith('packages/types/'))]) {
    fs.mkdirSync(path.dirname(path.join(sdk, file)), { recursive: true });
    fs.copyFileSync(path.join(repo, file), path.join(sdk, file));
  }
  // A real install also provides the package's runtime dependencies (the
  // vendored Laya declarations reference @webgpu/types and i18next).
  const { dependencies = {} } = JSON.parse(
    fs.readFileSync(path.join(repo, 'package.json'), 'utf8'),
  );
  for (const name of Object.keys(dependencies)) {
    const link = path.join(root, 'node_modules', name);
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(path.join(repo, 'node_modules', name), link, 'junction');
  }
  return { root, files };
}

const consumerSource = `
import { TopologyResolver, EngineGuard, ZhudaRuntimeSession } from 'zhuda-laya-engine';
import { TopologyResolver as MinTopology } from 'zhuda-laya-engine/min';
import { UnityBridgePipeline } from 'zhuda-laya-engine/demo';
export const values = [TopologyResolver, EngineGuard, ZhudaRuntimeSession, MinTopology, UnityBridgePipeline];
`;

test('published declarations resolve under Bundler, Node16 and NodeNext without skipLibCheck', () => {
  const { root, files } = stagePublishedTypes();
  try {
    assert.deepEqual(
      files.filter((f) => /^packages\/types\/.*(?<!\.d)\.ts$/.test(f)),
      [],
      'TypeScript contract sources must not be published next to their declarations',
    );
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'resolution-consumer', private: true, type: 'module' }),
    );
    const entry = path.join(root, 'consumer.ts');
    fs.writeFileSync(entry, consumerSource);
    const modes = [
      ['Bundler', ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
      ['Node16', ts.ModuleKind.Node16, ts.ModuleResolutionKind.Node16],
      ['NodeNext', ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
    ];
    for (const [name, module, moduleResolution] of modes) {
      const program = ts.createProgram([entry], {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        target: ts.ScriptTarget.ES2022,
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
        module,
        moduleResolution,
        types: [],
      });
      const diagnostics = ts.getPreEmitDiagnostics(program).map((d) => {
        const where = d.file
          ? `${path.relative(root, d.file.fileName)}:${d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1} `
          : '';
        return where + ts.flattenDiagnosticMessageText(d.messageText, '\n');
      });
      assert.deepEqual(diagnostics, [], `${name} consumer type check`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
