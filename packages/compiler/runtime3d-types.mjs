import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const core = path.join(root, 'packages/core');
const demo = path.join(root, 'packages/demo');
const types = path.join(root, 'packages/types');
const program = ts.createProgram(
  [path.join(core, 'index.ts'), path.join(demo, 'index.ts'), path.join(types, 'index.ts')],
  {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    declaration: true,
    emitDeclarationOnly: true,
    allowImportingTsExtensions: true,
    skipLibCheck: true,
  },
);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length)
  throw Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (value) => value,
      getCurrentDirectory: () => root,
      getNewLine: () => '\n',
    }),
  );
const destination = (file) =>
  file.startsWith(core + path.sep)
    ? path.join(types, path.relative(core, file))
    : file.startsWith(demo + path.sep)
      ? path.join(types, 'demo', path.relative(demo, file))
      : file;
const changes = [];
program.emit(undefined, (file, text) => {
  if (
    !file.endsWith('.d.ts') ||
    (!file.startsWith(core + path.sep) &&
      !file.startsWith(demo + path.sep) &&
      !file.startsWith(types + path.sep))
  )
    return;
  // Public index is generated from the runtime entry, not the internal contracts barrel.
  if (file === path.join(types, 'index.d.ts')) return;
  const target = destination(file);
  text = text.replace(
    /((?:from\s*|import\s*\()(['"]))(\.[^'"]+)\2/g,
    (all, prefix, quote, relative) => {
      const resolved =
        path.resolve(path.dirname(file), relative.replace(/(?:\.d)?\.ts$/, '')) + '.d.ts';
      let rewritten = path
        .relative(path.dirname(target), destination(resolved))
        .split(path.sep)
        .join('/')
        .replace(/\.d\.ts$/, '');
      if (!rewritten.startsWith('.')) rewritten = './' + rewritten;
      return prefix + rewritten + quote;
    },
  );
  if (target === path.join(types, 'index.d.ts'))
    text =
      '/// <reference path="./vendor/LayaAir.runtime.d.ts" />\n/// <reference path="./vendor/spine.runtime.d.ts" />\n' +
      text;
  text = '// Generated from TypeScript source; run npm run types:generate.\n' + text;
  const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (old === text) return;
  changes.push(path.relative(root, target));
  if (!process.argv.includes('--check')) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
});
if (process.argv.includes('--check') && changes.length)
  throw Error('Stale generated declarations: ' + changes.join(', '));
// Status goes to stderr so `npm pack --json` (prepack -> build) keeps stdout machine-readable.
console.error(
  `Public declarations: ${changes.length} ${process.argv.includes('--check') ? 'stale' : 'updated'}`,
);
