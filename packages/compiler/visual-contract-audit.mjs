#!/usr/bin/env node
/**
 * Static gate for runtime visual presentation contracts.
 *
 * Asset parity answers "does the file exist?". This gate answers "did the
 * migration define what the presentation must do, where it applies, and how
 * it is restored?" It is intentionally engine-agnostic so an agent can run
 * it before touching gameplay code.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MANIFEST_NAMES = [
  'visual-presentation-manifest.json',
  'assets/visual-presentation-manifest.json'
];

const ALLOWED_SCOPES = new Set(['board', 'reel', 'cell', 'scene', 'popup']);
const REQUIRED_INVARIANTS = new Set([
  'winningTargetsRemainBright',
  'nonWinningTargetsAreDimmed',
  'clearRestoresOriginalVisuals'
]);

function resolveManifestPath(projectRoot, explicitPath) {
  if (explicitPath) return path.resolve(projectRoot, explicitPath);
  return MANIFEST_NAMES
    .map((name) => path.join(projectRoot, name))
    .find((candidate) => fs.existsSync(candidate)) || null;
}

export function auditVisualPresentationContracts({ projectRoot = process.cwd(), manifestPath } = {}) {
  const root = path.resolve(projectRoot);
  const resolvedPath = resolveManifestPath(root, manifestPath);
  const issues = [];

  if (!resolvedPath) {
    return {
      passed: false,
      projectRoot: root,
      manifestPath: null,
      contractCount: 0,
      issues: ['Missing visual-presentation-manifest.json.']
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    return {
      passed: false,
      projectRoot: root,
      manifestPath: path.relative(root, resolvedPath),
      contractCount: 0,
      issues: [`Cannot parse manifest: ${error.message}`]
    };
  }

  if (manifest.contract !== 'zhuda-laya-engine.visual-presentation-contract') {
    issues.push('Manifest contract must be zhuda-laya-engine.visual-presentation-contract.');
  }
  if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1) {
    issues.push('schemaVersion must be an integer >= 1.');
  }
  for (const field of ['sourceEngine', 'targetEngine']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) {
      issues.push(`${field} is required.`);
    }
  }

  const contracts = Array.isArray(manifest.contracts) ? manifest.contracts : [];
  if (contracts.length === 0) issues.push('contracts must contain at least one presentation contract.');
  const contractIds = new Set();

  for (const [index, contract] of contracts.entries()) {
    const label = `contracts[${index}]`;
    if (!contract || typeof contract !== 'object') {
      issues.push(`${label} must be an object.`);
      continue;
    }
    if (typeof contract.id !== 'string' || !contract.id.trim()) {
      issues.push(`${label}.id is required.`);
    } else if (contractIds.has(contract.id)) {
      issues.push(`${label}.id duplicates ${contract.id}.`);
    } else {
      contractIds.add(contract.id);
    }
    if (!ALLOWED_SCOPES.has(contract.scope)) {
      issues.push(`${label}.scope must be one of ${[...ALLOWED_SCOPES].join(', ')}.`);
    }
    for (const field of ['source', 'target']) {
      if (typeof contract[field] !== 'string' || !contract[field].trim()) {
        issues.push(`${label}.${field} is required.`);
      }
    }
    const invariants = Array.isArray(contract.invariants) ? contract.invariants : [];
    for (const invariant of REQUIRED_INVARIANTS) {
      if (!invariants.includes(invariant)) {
        issues.push(`${label}.invariants is missing ${invariant}.`);
      }
    }
    if (!Array.isArray(contract.evidence) || contract.evidence.length === 0 || contract.evidence.some((item) => typeof item !== 'string' || !item.trim())) {
      issues.push(`${label}.evidence must contain at least one source/test reference.`);
    }
    const states = Array.isArray(contract.states) ? contract.states : [];
    if (states.length === 0) {
      issues.push(`${label}.states must contain at least one explicit runtime state.`);
    }
    const stateNames = new Set();
    for (const [stateIndex, state] of states.entries()) {
      const stateLabel = `${label}.states[${stateIndex}]`;
      if (!state || typeof state !== 'object' || typeof state.name !== 'string' || !state.name.trim()) {
        issues.push(`${stateLabel}.name is required.`);
      } else if (stateNames.has(state.name)) {
        issues.push(`${stateLabel}.name duplicates ${state.name}.`);
      } else {
        stateNames.add(state.name);
      }
      if (!state || typeof state.expectedBehavior !== 'string' || !state.expectedBehavior.trim()) {
        issues.push(`${stateLabel}.expectedBehavior is required.`);
      }
    }
  }

  return {
    passed: issues.length === 0,
    projectRoot: root,
    manifestPath: path.relative(root, resolvedPath),
    contractCount: contracts.length,
    contractIds: [...contractIds],
    issues
  };
}

function parseArgs(argv) {
  const args = { projectRoot: process.cwd() };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--project') args.projectRoot = argv[++index];
    else if (argv[index] === '--manifest') args.manifestPath = argv[++index];
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = auditVisualPresentationContracts(parseArgs(process.argv));
  console.log('🎭 [Zhuda-Visual-Contract] 視覺演出契約閘門:');
  console.log(`  • 契約數量: ${report.contractCount}`);
  console.log(`  • Manifest: ${report.manifestPath || '(missing)'}`);
  console.log(`  • 結果:     ${report.passed ? '✅ PASSED' : '❌ FAILED'}`);
  for (const issue of report.issues) console.error(`  • ${issue}`);
  if (!report.passed) process.exit(1);
}
