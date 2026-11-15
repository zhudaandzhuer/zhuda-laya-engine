import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  auditImplementationRoutes,
  getAgentContract,
  REQUIRED_AGENT_FILES,
  ROUTE_REQUIRED_SECTIONS,
} from '../packages/compiler/agent-contract.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(repo, file), 'utf8');

test('the routes index is required reading, in the contract and reachable from the entry documents', () => {
  assert.ok(REQUIRED_AGENT_FILES.includes('docs/routes/README.md'));
  assert.ok(REQUIRED_AGENT_FILES.includes('docs/routes/TEMPLATE.md'));
  const contract = getAgentContract(repo);
  assert.equal(contract.implementationRoutes, 'docs/routes/README.md');
  assert.equal(contract.passed, true, JSON.stringify(contract.audit?.issues ?? []));
  for (const file of [
    'AGENTS.md',
    'README.md',
    'docs/agent-development.md',
    'packages/compiler/zhuda-init.mjs',
  ])
    assert.ok(read(file).includes('docs/routes'), file);
});

test('every route in the repository is listed, complete, and its links resolve', () => {
  const report = auditImplementationRoutes(repo);
  assert.deepEqual(report.issues, []);
  assert.ok(report.routes.length >= 1);
  // Links from routes to other guides (not followed by the audit) resolve here, in a checkout.
  for (const file of ['docs/routes/README.md', 'docs/routes/TEMPLATE.md', ...report.routes]) {
    const text = read(file);
    for (const match of text.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
      if (/^https?:/.test(match[1])) continue;
      assert.ok(
        fs.existsSync(path.resolve(repo, path.dirname(file), match[1])),
        `${file} -> ${match[1]}`,
      );
    }
  }
  // The template itself carries every section a route must have.
  const template = read('docs/routes/TEMPLATE.md');
  for (const section of ROUTE_REQUIRED_SECTIONS) assert.ok(template.includes(section), section);
});

test('a broken index link, an unlisted route and a route without its limits are reported with hints', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-routes-'));
  try {
    fs.mkdirSync(path.join(root, 'docs/routes'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'docs/routes/README.md'),
      '| a | [Gone](gone.md) | x | y |\n| b | [Thin](thin.md) | x | y |\n',
    );
    fs.writeFileSync(
      path.join(root, 'docs/routes/thin.md'),
      '# Route\n\n**Status:** x\n\n## Steps\n',
    );
    fs.writeFileSync(path.join(root, 'docs/routes/stray.md'), ROUTE_REQUIRED_SECTIONS.join('\n'));
    const { issues } = auditImplementationRoutes(root);
    const codes = issues.map((item) => `${item.code}:${path.basename(item.file)}`);
    assert.ok(codes.includes('ROUTE_LINK_BROKEN:README.md'));
    assert.ok(codes.includes('ROUTE_UNLISTED:stray.md'));
    assert.ok(codes.includes('ROUTE_SECTION_MISSING:thin.md'));
    assert.ok(issues.some((item) => /## Not checked/.test(item.message)));
    assert.ok(issues.every((item) => item.hint));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
