#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLayoutPreview,
  compareLayoutSvg,
  layoutToSvg,
  normalizeLayoutPath,
  parseLayoutSvg,
  readImageDimensions,
  readLayoutContract,
  validateLayoutContracts,
} from './layout-contract.mjs';
import crypto from 'node:crypto';

function parseArgs(argv = process.argv.slice(2)) {
  const command = argv[0] || 'help';
  const args = {};
  for (let index = 1; index < argv.length; index++) {
    const value = argv[index];
    if (!value.startsWith('--')) throw Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    if (key === 'help') { args.help = true; continue; }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) throw Error(`--${key} requires a value`);
    args[key] = next; index++;
  }
  return { command, args };
}

function required(args, key) {
  if (!args[key]) throw Error(`--${key} is required`);
  return args[key];
}
function rootOf(args) { return path.resolve(args.root || process.cwd()); }
function resolveInside(root, value, field) {
  const normalized = normalizeLayoutPath(value, field);
  const file = path.resolve(root, normalized);
  if (!file.startsWith(root + path.sep)) throw Error(`${field} escapes --root`);
  return { normalized, file };
}
function sourcePathFor(root, value) {
  const absolute = path.resolve(root, value);
  if (!absolute.startsWith(root + path.sep)) throw Error('--source must be inside --root');
  return path.relative(root, absolute).split(path.sep).join('/');
}
function writeOutput(output, value) {
  if (!output) { process.stdout.write(value); return; }
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, value, 'utf8');
  console.log(`Wrote ${path.resolve(output)}`);
}

export function printHelp() {
  console.log(`zhuda-layout — SVG wireframe and design-coordinate contract tool

Commands:
  from-svg --svg FILE --source IMAGE --output FILE [--root DIR] [--id ID]
  to-svg --layout FILE [--output FILE] [--no-labels]
  preview --layout FILE --output FILE [--root DIR] [--title TEXT]
  validate --layout FILE [--svg FILE] [--root DIR]
  check --project DIR --layout FILE [--svg FILE]

The JSON contract is authoritative. SVG rectangles with data-layout-id are the
editable visual representation. Coordinates are design/CSS pixels, never DPR
backing pixels.`);
}

export function runLayoutCommand(command, args) {
  if (args.help || command === 'help') { printHelp(); return { passed: true }; }
  if (command === 'from-svg') {
    const root = rootOf(args);
    const svgRef = resolveInside(root, required(args, 'svg'), '--svg');
    const sourceRef = resolveInside(root, required(args, 'source'), '--source');
    const sourceBytes = fs.readFileSync(sourceRef.file);
    const dimensions = readImageDimensions(sourceBytes, sourceRef.normalized);
    const contract = parseLayoutSvg(fs.readFileSync(svgRef.file, 'utf8'), {
      id: args.id || 'scene/layout', sourcePath: sourceRef.normalized,
      sourceInfo: { path: sourceRef.normalized, sha256: crypto.createHash('sha256').update(sourceBytes).digest('hex'), bytes: sourceBytes.byteLength, width: dimensions.width, height: dimensions.height },
    });
    writeOutput(args.output, `${JSON.stringify(contract, null, 2)}\n`);
    return { passed: true, command, nodes: contract.nodes.length, id: contract.id };
  }
  if (command === 'to-svg') {
    const contract = readLayoutContract(path.resolve(required(args, 'layout')));
    const svg = layoutToSvg(contract, { includeLabels: !args['no-labels'] });
    writeOutput(args.output, svg);
    return { passed: true, command, nodes: contract.nodes.length };
  }
  if (command === 'preview') {
    const root = rootOf(args);
    const layoutRef = resolveInside(root, required(args, 'layout'), '--layout');
    const contract = readLayoutContract(layoutRef.file);
    const sourceRef = resolveInside(root, contract.source.path, 'source.path');
    const html = buildLayoutPreview(contract, fs.readFileSync(sourceRef.file), { title: args.title || contract.id });
    writeOutput(args.output, html);
    return { passed: true, command, id: contract.id, nodes: contract.nodes.length };
  }
  if (command === 'validate') {
    const root = rootOf(args);
    const layoutRef = resolveInside(root, required(args, 'layout'), '--layout');
    const svg = args.svg ? fs.readFileSync(resolveInside(root, args.svg, '--svg').file, 'utf8') : undefined;
    const result = validateLayoutContracts(root, [{ layout: layoutRef.normalized, ...(args.svg ? { svg: normalizeLayoutPath(args.svg, '--svg') } : {}) }]);
    if (!result.passed) throw Error(result.issues.join('; '));
    if (svg) {
      const contract = readLayoutContract(layoutRef.file);
      const comparison = compareLayoutSvg(contract, svg);
      if (!comparison.passed) throw Error(comparison.issues.join('; '));
    }
    console.log(JSON.stringify({ passed: true, command, ...result.contracts[0] }, null, 2));
    return { passed: true, command };
  }
  if (command === 'check') {
    const root = path.resolve(required(args, 'project'));
    const configured = [{ layout: required(args, 'layout'), ...(args.svg ? { svg: args.svg } : {}) }];
    const result = validateLayoutContracts(root, configured);
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) throw Error(result.issues.join('; '));
    return result;
  }
  throw Error(`Unknown command: ${command}`);
}

const launched = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (launched) {
  try {
    const input = process.argv.slice(2);
    if (input[0] === '--help' || input[0] === '-h') printHelp();
    else runLayoutCommand(...Object.values(parseArgs(input)));
  }
  catch (error) { console.error(`zhuda-layout: ${error.message}`); process.exitCode = 1; }
}
