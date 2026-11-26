import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(repo, file), 'utf8');
const links = (file) =>
  [...read(file).matchAll(/\]\(([^)\s#]+)(?:#[^)\s]*)?\)/g)]
    .map((match) => match[1])
    .filter((target) => !/^(?:https?:|mailto:)/.test(target));

test('the documentation index lists every guide, and its links resolve', () => {
  const listed = new Set(links('docs/README.md').map((target) => path.normalize(target)));
  for (const file of fs.readdirSync(path.join(repo, 'docs')))
    if (file.endsWith('.md') && file !== 'README.md')
      assert.ok(listed.has(file), `docs/README.md does not list ${file}`);
  for (const target of listed)
    assert.ok(fs.existsSync(path.join(repo, 'docs', target)), `docs/README.md -> ${target}`);
});

test('the entry pages link only to files that exist', () => {
  for (const file of ['README.md', 'CHANGELOG.md', 'docs/overview.md', 'games/README.md'])
    for (const target of links(file))
      assert.ok(fs.existsSync(path.join(repo, path.dirname(file), target)), `${file} -> ${target}`);
});

test('every reference game is in the games index, names its route, and builds against this checkout', () => {
  const index = read('games/README.md');
  const games = fs
    .readdirSync(path.join(repo, 'games'))
    .filter((name) => fs.existsSync(path.join(repo, 'games', name, 'zhuda.config.json')));
  assert.ok(games.length >= 8);
  for (const name of games) {
    assert.ok(index.includes(`(${name}/)`), `games/README.md does not list ${name}`);
    const manifest = JSON.parse(read(`games/${name}/package.json`));
    assert.equal(manifest.dependencies['zhuda-laya-engine'], 'file:../..', name);
    assert.equal(manifest.private, true, `${name} must not be publishable`);
  }
  const routes = [...index.matchAll(/\]\(\.\.\/docs\/routes\/([a-z0-9-]+)\.md\)/g)].map(
    (m) => m[1],
  );
  assert.ok(routes.length >= games.length, 'each game names the route it is the reference for');
});
