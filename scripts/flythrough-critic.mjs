#!/usr/bin/env node
// Gates a critic's report on the pictures of a fly-through: the critic saw
// only the pictures (critic-brief.md beside them) and ranked the defects it
// found. No defect above minor is the gate it proposes; a person accepts it.
//
//   node scripts/flythrough-critic.mjs critic-report.json [--run DIR]
//
// --run DIR: the fly-through's output; every pose picture there must have
// been reviewed. Exit 0: minor only (proposed, not a pass by itself).
// 1: a defect above minor, or a report that does not validate, with
// file:line for each.
import fs from 'node:fs';
import path from 'node:path';
import { gateCriticFile } from '../packages/compiler/flythrough-file.mjs';

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--run');
if (!file) {
  console.error('Usage: node scripts/flythrough-critic.mjs critic-report.json [--run DIR]');
  process.exit(1);
}
const runDir = args.includes('--run') ? args[args.indexOf('--run') + 1] : undefined;
const pictures = runDir
  ? JSON.parse(fs.readFileSync(path.join(runDir, 'report.json'), 'utf8')).poses.map((p) => p.file)
  : undefined;
const gate = gateCriticFile(path.resolve(file), pictures);
if (gate.status === 'minor-only')
  console.log(
    'MINOR-ONLY critic report: no defect above minor. This is the gate the critic proposes; a person looks and accepts it.',
  );
else console.log(`${gate.status.toUpperCase()} critic report\n${gate.lines.join('\n')}`);
process.exit(gate.status === 'minor-only' ? 0 : 1);
