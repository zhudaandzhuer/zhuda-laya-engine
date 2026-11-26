#!/usr/bin/env node
// Copies common prefabs into a game client, or checks that the copies are current.
//
//   node scripts/sync.mjs <game client dir> ui/dialog systems/i18n …   add or update these modules (and their deps)
//   node scripts/sync.mjs <game client dir>                           update the modules already listed in its lock
//   node scripts/sync.mjs <game client dir> --check                   exit 1 if any copy differs from the library
//
// TypeScript goes to <client>/src/common/<path>, CSS to <client>/public/common/<path>
// (the engine build copies public/ into the web build; link the CSS from index.html).
// Any other file (a model, a sound, a picture: the 3D modules' assets/) is copied byte
// for byte to <client>/public/common/<path>, so it is served at `common/<path>`.
// <client>/common-prefabs.lock.json records the library version, the modules and a
// SHA-256 per copied file. TypeScript and CSS copies carry a header saying where to
// change them: edit the library, then sync again, never the copy. --check compares
// content, so a library version bump that leaves a game's modules untouched does not fail it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const LIB = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalog = JSON.parse(fs.readFileSync(path.join(LIB, 'catalog.json'), 'utf8'));
const LOCK = 'common-prefabs.lock.json';

export function plan(client, wanted) {
  const order = [];
  const visit = (id, from) => {
    const mod = catalog.modules[id];
    if (!mod) throw Error(`unknown module "${id}"${from ? ` (needed by ${from})` : ''}; see catalog.json`);
    if (order.includes(id)) return;
    for (const dep of mod.deps) visit(dep, id);
    order.push(id);
  };
  for (const id of wanted) visit(id);
  const files = [];
  for (const id of order)
    for (const file of catalog.modules[id].files) {
      const kind = file.endsWith('.ts') ? 'ts' : file.endsWith('.css') ? 'css' : 'bytes';
      const target = path.join(kind === 'ts' ? 'src' : 'public', 'common', file);
      const source = fs.readFileSync(path.join(LIB, file));
      const header =
        kind === 'css'
          ? `/* prefabs · ${file} — 複製品，請改 prefabs/${file} 後重跑 scripts/sync.mjs */\n`
          : kind === 'ts'
            ? `// prefabs · ${file} — 複製品，請改 prefabs/${file} 後重跑 scripts/sync.mjs\n`
            : '';
      const content = header ? Buffer.concat([Buffer.from(header, 'utf8'), source]) : source;
      files.push({ module: id, file, target, content, sha256: crypto.createHash('sha256').update(content).digest('hex') });
    }
  return { modules: order, files };
}

function main() {
  const args = process.argv.slice(2),
    check = args.includes('--check'),
    rest = args.filter((a) => a !== '--check');
  if (rest.includes('--help') || rest.includes('-h')) {
    console.log(
      [
        'Usage: zhuda-prefab-sync <game dir> [module …] [--check]',
        '',
        '  <game dir> <module …>   add or update these modules of the prefab library (and what they need)',
        '  <game dir>              update the modules already listed in the game\'s lock',
        '  <game dir> --check      exit 1 if a copy in the game differs from the library',
        '',
        'TypeScript goes to <game>/src/common/, everything else to <game>/public/common/;',
        `<game>/${LOCK} records what was taken. Modules: prefabs/catalog.json (library ${catalog.version}).`,
      ].join('\n'),
    );
    return;
  }
  const client = rest.shift();
  if (!client) throw Error('usage: zhuda-prefab-sync <game dir> [module …] [--check]   (--help for more)');
  const root = path.resolve(client),
    lockPath = path.join(root, LOCK);
  if (!fs.existsSync(path.join(root, 'package.json'))) throw Error(`${root} is not a game client (no package.json)`);
  const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : { modules: [] };
  const wanted = check ? lock.modules : [...new Set([...lock.modules, ...rest])];
  if (!wanted.length) throw Error('no modules: name some, e.g. ui/dialog systems/i18n');
  const { modules, files } = plan(root, wanted);
  if (check) {
    const problems = [];
    for (const f of files) {
      const at = path.join(root, f.target);
      if (!fs.existsSync(at)) problems.push(`missing ${f.target}`);
      else if (!fs.readFileSync(at).equals(f.content)) problems.push(`differs ${f.target}`);
    }
    const listed = new Set(Object.keys(lock.files ?? {})),
      expected = new Set(files.map((f) => f.target.split(path.sep).join('/')));
    for (const p of listed) if (!expected.has(p)) problems.push(`stale ${p}`);
    // Same content under an older library version is fine; say so without failing.
    const notes = lock.version !== catalog.version ? [`synced at ${lock.version}; library is ${catalog.version} (these modules unchanged)`] : [];
    console.log(JSON.stringify({ ok: !problems.length, version: catalog.version, modules, problems, notes }, null, 1));
    process.exit(problems.length ? 1 : 0);
  }
  // Files this game had from the library but no longer needs.
  const keep = new Set(files.map((f) => f.target.split(path.sep).join('/')));
  for (const old of Object.keys(lock.files ?? {})) if (!keep.has(old)) fs.rmSync(path.join(root, old), { force: true });
  for (const f of files) {
    const at = path.join(root, f.target);
    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.writeFileSync(at, f.content);
  }
  const next = {
    library: 'zhuda-laya-engine/prefabs',
    version: catalog.version,
    modules,
    files: Object.fromEntries(files.map((f) => [f.target.split(path.sep).join('/'), f.sha256])),
  };
  fs.writeFileSync(lockPath, JSON.stringify(next, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, version: catalog.version, modules, files: files.length }, null, 1));
}

/** True when this file is what `node` was started with, also through a `node_modules/.bin` link. */
function isMain() {
  try {
    return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) main();
