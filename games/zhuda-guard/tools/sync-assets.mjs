// Copies what the game draws from games/shared-assets into assets/ (git-ignored: the files are
// tracked once, in shared-assets, with their sources in games/ASSETS.md).
//   node tools/sync-assets.mjs
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const shared = join(project, '..', 'shared-assets');
const copies = [
  ['models/zheng-lod25.glb', 'models/zheng.glb'],
  ['models/jiuweihu-lod25.glb', 'models/jiuweihu.glb'],
  ['models/kui-lod25.glb', 'models/kui.glb'],
  ['models/xuanwu-lod25.glb', 'models/xuanwu.glb'],
];
for (const id of ['grass-lawn', 'forest-floor', 'dirt-path', 'stone-pavers', 'stone-wall', 'old-planks', 'clay-roof-tiles'])
  for (const map of ['albedo-512.png', 'normal-512.png']) copies.push([`textures/${id}/${map}`, `textures/${id}/${map}`]);
let bytes = 0;
for (const [from, to] of copies) {
  const src = join(shared, from), dst = join(project, 'assets', to);
  if (!existsSync(src)) throw Error(`${from}: missing`);
  mkdirSync(dirname(dst), { recursive: true });
  if (!existsSync(dst) || statSync(dst).size !== statSync(src).size) copyFileSync(src, dst);
  bytes += statSync(dst).size;
}
writeFileSync(join(project, 'assets', 'sources.json'), JSON.stringify(Object.fromEntries(copies.map(([a, b]) => [b, a])), null, 1));
console.log(`assets: ${copies.length} files, ${(bytes / 1e6).toFixed(1)} MB`);
