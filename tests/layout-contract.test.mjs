import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  buildLayoutPreview,
  compareLayoutSvg,
  layoutToSvg,
  parseLayoutSvg,
  validateLayoutContract,
  validateLayoutContracts,
} from '../packages/compiler/layout-contract.mjs';
import { runConsumerBuild } from '../packages/compiler/consumer-build.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAQAAACe2K4AAAAA', 'base64');
const hash = crypto.createHash('sha256').update(png).digest('hex');
const source = { path: 'reference/home.png', sha256: hash, bytes: png.length, width: 4, height: 4 };
const makeContract = () => ({
  contract: 'zhuda-laya-engine.layout', schemaVersion: 1, id: 'scene/home', design: { width: 4, height: 4 }, source,
  nodes: [
    { id: 'hud.balance', kind: 'text', rect: { x: 0, y: 0, width: 2, height: 1 }, anchor: 'top-left', states: ['idle', 'win'] },
    { id: 'hud.spin', kind: 'button', rect: { x: 2, y: 2, width: 2, height: 2 }, anchor: 'bottom-right', parent: 'hud.balance' },
  ],
});

test('layout contract validates design coordinates, parent references and source metadata', () => {
  const result = validateLayoutContract(makeContract());
  assert.equal(result.passed, true, result.issues?.join('; '));
  const broken = makeContract(); broken.nodes[1].parent = 'missing';
  assert.equal(validateLayoutContract(broken).passed, false);
  broken.nodes[1].parent = 'hud.spin';
  assert.match(validateLayoutContract(broken).issues.join('; '), /cycle/);
});

test('SVG import and export preserve stable IDs and geometry', () => {
  const contract = makeContract();
  const svg = layoutToSvg(contract);
  const comparison = compareLayoutSvg(contract, svg);
  assert.equal(comparison.passed, true, comparison.issues.join('; '));
  const imported = parseLayoutSvg(svg, { id: contract.id, sourceInfo: source });
  assert.deepEqual(imported.nodes.map(node => node.id), ['hud.balance', 'hud.spin']);
  assert.deepEqual(imported.nodes[1].rect, contract.nodes[1].rect);
  assert.match(svg, /data-layout-id="hud\.spin"/);
});

test('layout preview embeds the source and exposes node metadata without a network', () => {
  const html = buildLayoutPreview(makeContract(), png, { title: 'Home Wireframe' });
  assert.match(html, /data:image\/png;base64/);
  assert.match(html, /hud\.balance/);
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
});

test('consumer layout gate verifies the source hash and linked SVG', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-layout-contract-'));
  try {
    fs.mkdirSync(path.join(root, 'reference'), { recursive: true });
    fs.mkdirSync(path.join(root, 'layouts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'reference/home.png'), png);
    const contract = makeContract();
    fs.writeFileSync(path.join(root, 'layouts/home.json'), JSON.stringify(contract));
    fs.writeFileSync(path.join(root, 'layouts/home.svg'), layoutToSvg(contract));
    const passed = validateLayoutContracts(root, [{ layout: 'layouts/home.json', svg: 'layouts/home.svg' }]);
    assert.equal(passed.passed, true, passed.issues?.join('; '));
    const stale = { ...contract, source: { ...contract.source, sha256: '0'.repeat(64) } };
    fs.writeFileSync(path.join(root, 'layouts/home.json'), JSON.stringify(stale));
    const failed = validateLayoutContracts(root, [{ layout: 'layouts/home.json', svg: 'layouts/home.svg' }]);
    assert.equal(failed.passed, false);
    assert.match(failed.issues.join('; '), /SHA-256/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('consumer candidate build records valid layout contracts and rejects stale ones', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-layout-consumer-'));
  const engineRoot = path.resolve(import.meta.dirname, '..');
  try {
    fs.mkdirSync(path.join(root, 'reference'), { recursive: true });
    fs.mkdirSync(path.join(root, 'layouts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'public'), { recursive: true });
    fs.writeFileSync(path.join(root, 'reference/home.png'), png);
    const contract = makeContract();
    fs.writeFileSync(path.join(root, 'layouts/home.json'), JSON.stringify(contract));
    fs.writeFileSync(path.join(root, 'layouts/home.svg'), layoutToSvg(contract));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'layout-consumer', private: true, type: 'module', dependencies: { 'zhuda-laya-engine': '1.14.0' } }));
    fs.writeFileSync(path.join(root, 'zhuda.config.json'), JSON.stringify({ layoutContracts: [{ layout: 'layouts/home.json', svg: 'layouts/home.svg' }] }));
    fs.writeFileSync(path.join(root, 'src/Main.ts'), "import { ZhudaEngine } from 'zhuda-laya-engine'; async function main(){ await ZhudaEngine.boot({ container: '#game', features: ['core', '2d'] }); } void main();");
    fs.writeFileSync(path.join(root, 'public/index.html'), '<!doctype html><meta charset="utf-8"><main id="game"></main><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY -->');
    const report = await runConsumerBuild({ projectRoot: root, engineRoot, config: { features: ['core', '2d'], layoutContracts: [{ layout: 'layouts/home.json', svg: 'layouts/home.svg' }] }, mode: 'candidate' });
    assert.equal(report.layoutContracts[0].id, 'scene/home');
    const stale = { ...contract, source: { ...contract.source, sha256: '0'.repeat(64) } };
    fs.writeFileSync(path.join(root, 'layouts/home.json'), JSON.stringify(stale));
    await assert.rejects(runConsumerBuild({ projectRoot: root, engineRoot, config: { features: ['core', '2d'], layoutContracts: [{ layout: 'layouts/home.json', svg: 'layouts/home.svg' }] }, mode: 'candidate' }), /Layout wireframe contract failed/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
