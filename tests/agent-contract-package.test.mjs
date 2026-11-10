import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditAgentContract, REQUIRED_AGENT_FILES } from '../packages/compiler/agent-contract.mjs';

const repo = path.resolve(import.meta.dirname, '..');

function copyContract(withRecords) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-agent-contract-'));
  for (const file of REQUIRED_AGENT_FILES) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(repo, file), path.join(root, file));
  }
  for (const file of fs.readdirSync(path.join(repo, 'docs/plans')))
    if (file.endsWith('.md'))
      fs.copyFileSync(path.join(repo, 'docs/plans', file), path.join(root, 'docs/plans', file));
  for (const dir of ['cinematic-production', 'desktop-and-agent-gates'])
    fs.cpSync(path.join(repo, 'docs/plans', dir), path.join(root, 'docs/plans', dir), {
      recursive: true,
    });
  if (withRecords) fs.mkdirSync(path.join(root, 'docs/plans/records'));
  return root;
}

test('published package without plan records passes; a checkout with records still enforces links', () => {
  const packaged = copyContract(false);
  const partial = copyContract(true);
  try {
    assert.deepEqual(auditAgentContract(packaged).issues, []);
    const broken = auditAgentContract(partial).issues.filter((i) => i.code === 'PLAN_LINK_BROKEN');
    assert.ok(broken.length > 0, 'an incomplete records directory is still reported');
    assert.deepEqual(auditAgentContract(repo).issues, [], 'the full repository contract is intact');
  } finally {
    fs.rmSync(packaged, { recursive: true, force: true });
    fs.rmSync(partial, { recursive: true, force: true });
  }
});
