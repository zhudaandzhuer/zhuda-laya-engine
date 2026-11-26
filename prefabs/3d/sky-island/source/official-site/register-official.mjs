// Copies the WebGL build into the official site's game clients
// (zhudaandzhuer.com/www/gameClients/zhuda/home-island) with a manifest of SHA-256s,
// which the site's sync step checks before it publishes the files under /game-clients/.
// From games/zhuda-home-island/tools (2026-11-16); now run from the small client made from
// the viewer's home-island preset (see README.md beside this file), as tools/register-official.mjs:
// Usage: node tools/build.mjs && node tools/register-official.mjs   (OFFICIAL_CLIENT=<dir> to write elsewhere)
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const project = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const source = path.join(project, 'dist/web');
const target = process.env.OFFICIAL_CLIENT || path.join(process.env.HOME, 'Documents/zhudaandzhuer.com/www/gameClients/zhuda/home-island');
const html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
if (html.includes('webgpu')) throw new Error('Build the WebGL version for the site (RENDERER=webgl): it is lighter and works where WebGPU does not.');

fs.rmSync(path.join(target, 'web'), { recursive: true, force: true });
const files = {};
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // no hidden files on the site
    const from = path.join(dir, entry.name);
    const rel = path.relative(source, from).split(path.sep).join('/');
    const to = path.join(target, 'web', rel);
    if (entry.isDirectory()) walk(from);
    else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      files[rel] = createHash('sha256').update(fs.readFileSync(from)).digest('hex');
    }
  }
};
walk(source);
const version = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
const manifest = {
  slug: 'zhuda-home-island',
  series: 'zhuda',
  title: '豬大與豬二的小島',
  kind: 'scene',
  buildVersion: version,
  publicPath: 'zhuda/home-island',
  entry: 'index.html',
  files,
};
fs.writeFileSync(path.join(target, 'game-client.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`registered ${Object.keys(files).length} files, version ${version} -> ${target}`);
