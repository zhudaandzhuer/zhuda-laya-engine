// What an exported mini-game folder holds: game.json's orientation, and the newest syntax each script needs.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve(process.argv[3]) + '/');
const acorn = require('acorn');
const dir = process.argv[2];
const game = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') && files.push(path.join(d, e.name)); };
walk(dir);
const need = {};
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  let lowest = null;
  for (const v of [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022]) {
    try { acorn.parse(text, { ecmaVersion: v, sourceType: 'script', allowHashBang: true }); lowest = v; break; } catch {}
    try { acorn.parse(text, { ecmaVersion: v, sourceType: 'module' }); lowest = v; break; } catch {}
  }
  need[path.relative(dir, f)] = { bytes: text.length, needs: lowest ? 'es' + lowest : 'newer than es2022 or not parsed' };
}
const newest = Object.values(need).map((n) => n.needs).sort().pop();
console.log(JSON.stringify({ deviceOrientation: game.deviceOrientation ?? '(not set)', scripts: files.length, newestSyntaxNeeded: newest, perFile: Object.fromEntries(Object.entries(need).filter(([, n]) => n.needs !== 'es2015' ).slice(0, 12)), totalBytes: Object.values(need).reduce((s, n) => s + n.bytes, 0) }, null, 1));
