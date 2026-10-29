#!/usr/bin/env node
/**
 * Visual asset migration audit for Unity -> zhuda-laya-engine projects.
 *
 * This tool deliberately validates the visual asset contract before gameplay
 * code is considered. It inventories both trees, compares Spine 4.2 semantic
 * data (animations, skins, bones, slots and constraints), verifies atlas
 * regions and texture references, and reports Unity animation/material
 * wrappers that still need an explicit presentation mapping.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  'Library',
  'Temp',
  'Logs',
  'Obj',
  'Artifacts',
  'TestResults',
  'node_modules',
  'dist'
]);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const UNITY_VISUAL_EXTENSIONS = new Set(['.anim', '.controller', '.mat']);

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function normalizeName(value) {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/\.(atlas\.txt|atlas|json|bytes|png|jpg|jpeg|webp|anim|controller|mat)$/i, '')
    .replace(/^ani[_-]/i, '')
    .replace(/^symbol[_-]/i, '')
    .replace(/[_-](skeletondata|atlas|material)$/i, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
}

function extensionOf(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.atlas.txt')) return '.atlas.txt';
  return path.extname(lower);
}

function walkFiles(root, ignoredDirs = DEFAULT_IGNORED_DIRS) {
  if (!root || !fs.existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  visit(root);
  return files;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  try {
    return { value: JSON.parse(readText(filePath)), error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function loadVisualContract(targetRoot, explicitPath) {
  const candidates = explicitPath
    ? [path.resolve(explicitPath)]
    : [
        path.join(targetRoot, 'visual-migration-manifest.json'),
        path.join(targetRoot, 'visual-material-contract.json'),
        path.join(targetRoot, 'assets', 'visual-migration-manifest.json'),
        path.join(targetRoot, 'assets', 'visual-material-contract.json')
      ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const parsed = readJson(candidate);
    if (parsed.value && typeof parsed.value === 'object') {
      return { path: candidate, value: parsed.value, error: null };
    }
    return { path: candidate, value: null, error: parsed.error };
  }
  return { path: null, value: { animations: [], materials: [], textures: [] }, error: null };
}

function isSpineJson(filePath) {
  if (extensionOf(filePath) !== '.json') return false;
  const lower = filePath.toLowerCase();
  if (lower.includes('/spine/') || lower.includes('/animation/')) return true;
  const parsed = readJson(filePath);
  return Boolean(parsed.value?.skeleton && parsed.value?.animations);
}

function spineDescriptor(filePath, root) {
  const parsed = readJson(filePath);
  const rel = normalizePath(path.relative(root, filePath));
  if (!parsed.value) {
    return {
      sourcePath: rel,
      key: normalizeName(filePath),
      parseError: parsed.error,
      animations: [],
      skins: [],
      bones: [],
      slots: [],
      constraints: { ik: 0, transform: 0, path: 0, physics: 0 },
      version: null
    };
  }
  const value = parsed.value;
  const animations = Object.keys(value.animations || {}).sort();
  const skins = Array.isArray(value.skins)
    ? value.skins.map((skin) => typeof skin === 'string' ? skin : skin.name).filter(Boolean).sort()
    : Object.keys(value.skins || {}).sort();
  return {
    sourcePath: rel,
    key: normalizeName(filePath),
    sha256: sha256(filePath),
    parseError: null,
    version: value.skeleton?.spine || value.skeleton?.version || null,
    hash: value.skeleton?.hash || null,
    dimensions: {
      x: value.skeleton?.x ?? null,
      y: value.skeleton?.y ?? null,
      width: value.skeleton?.width ?? null,
      height: value.skeleton?.height ?? null
    },
    animations,
    skins,
    bones: (value.bones || []).map((bone) => bone.name).filter(Boolean),
    slots: (value.slots || []).map((slot) => slot.name).filter(Boolean),
    constraints: {
      ik: Array.isArray(value.ik) ? value.ik.length : 0,
      transform: Array.isArray(value.transform) ? value.transform.length : 0,
      path: Array.isArray(value.path) ? value.path.length : 0,
      physics: Array.isArray(value.physics) ? value.physics.length : 0
    }
  };
}

function atlasDescriptor(filePath, root) {
  const text = readText(filePath);
  const lines = text.split(/\r?\n/);
  let pages = 0;
  let regions = 0;
  let currentPage = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      currentPage = false;
      continue;
    }
    if (!line.includes(':') && (line.endsWith('.png') || line.endsWith('.jpg') || line.endsWith('.jpeg') || line.endsWith('.webp'))) {
      pages += 1;
      currentPage = true;
      continue;
    }
    if (currentPage && !line.includes(':')) regions += 1;
  }
  return {
    sourcePath: normalizePath(path.relative(root, filePath)),
    key: normalizeName(filePath),
    sha256: sha256(filePath),
    pages,
    regions
  };
}

function collectInventory(root, role) {
  const files = walkFiles(root);
  const inventory = {
    role,
    root,
    totalFiles: files.length,
    extensionCounts: {},
    visualFiles: [],
    spineJson: [],
    atlases: [],
    imageFiles: [],
    unityWrappers: []
  };
  for (const filePath of files) {
    const extension = extensionOf(filePath);
    inventory.extensionCounts[extension] = (inventory.extensionCounts[extension] || 0) + 1;
    const relative = normalizePath(path.relative(root, filePath));
    const record = {
      path: relative,
      key: normalizeName(filePath),
      extension,
      bytes: fs.statSync(filePath).size,
      sha256: sha256(filePath)
    };
    const spine = isSpineJson(filePath);
    const atlas = extension === '.atlas' || extension === '.atlas.txt';
    const image = IMAGE_EXTENSIONS.has(extension);
    if (spine) {
      const descriptor = spineDescriptor(filePath, root);
      inventory.spineJson.push(descriptor);
      inventory.visualFiles.push({ ...record, kind: 'spine-json' });
    } else if (atlas) {
      const descriptor = atlasDescriptor(filePath, root);
      inventory.atlases.push(descriptor);
      inventory.visualFiles.push({ ...record, kind: 'spine-atlas', ...descriptor });
    } else if (image) {
      inventory.imageFiles.push(record);
      if (relative.toLowerCase().includes('/spine/') || relative.toLowerCase().includes('/animation/')) {
        inventory.visualFiles.push({ ...record, kind: 'spine-texture' });
      }
    }
    if (role === 'unity' && UNITY_VISUAL_EXTENSIONS.has(extension)) {
      const text = readText(filePath);
      const nameMatch = text.match(/(?:m_Name|name):\s*([^\r\n]+)/);
      const shaderMatch = text.match(/m_Shader:\s*\{[^}]*guid:\s*([^,}]+)/);
      inventory.unityWrappers.push({
        ...record,
        kind: extension.slice(1),
        declaredName: nameMatch?.[1]?.trim() || path.basename(filePath, extension),
        shaderGuid: shaderMatch?.[1]?.trim() || null,
        additive: /additive|blendadd|_blend/i.test(`${relative}\n${text}`)
      });
    }
  }
  return inventory;
}

function indexByKey(records) {
  const map = new Map();
  for (const record of records) {
    if (!map.has(record.key)) map.set(record.key, []);
    map.get(record.key).push(record);
  }
  return map;
}

function setDifference(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function compareSpine(source, target) {
  if (!target) {
    return {
      key: source.key,
      sourcePath: source.sourcePath,
      targetPath: null,
      status: 'missing-target',
      issues: ['No target Spine JSON with the same normalized asset key.'],
      source,
      target: null
    };
  }
  const missingAnimations = setDifference(source.animations, target.animations);
  const extraAnimations = setDifference(target.animations, source.animations);
  const missingSkins = setDifference(source.skins, target.skins);
  const missingBones = setDifference(source.bones, target.bones);
  const missingSlots = setDifference(source.slots, target.slots);
  const constraintMismatch = Object.entries(source.constraints).filter(([key, value]) => value !== target.constraints[key]);
  const issues = [];
  if (source.parseError) issues.push(`Source JSON parse error: ${source.parseError}`);
  if (target.parseError) issues.push(`Target JSON parse error: ${target.parseError}`);
  if (missingAnimations.length) issues.push(`Missing animations: ${missingAnimations.join(', ')}`);
  if (missingSkins.length) issues.push(`Missing skins: ${missingSkins.join(', ')}`);
  if (missingBones.length) issues.push(`${missingBones.length} bones missing from target`);
  if (missingSlots.length) issues.push(`${missingSlots.length} slots missing from target`);
  if (constraintMismatch.length) issues.push(`Constraint counts differ: ${constraintMismatch.map(([key, value]) => `${key} ${value}->${target.constraints[key]}`).join(', ')}`);
  if (source.version && !String(source.version).startsWith('4.2')) issues.push(`Source Spine version is ${source.version}, expected 4.2`);
  if (target.version && !String(target.version).startsWith('4.2')) issues.push(`Target Spine version is ${target.version}, expected 4.2`);
  return {
    key: source.key,
    sourcePath: source.sourcePath,
    targetPath: target.sourcePath,
    status: issues.length ? 'mismatch' : 'matched',
    issues,
    missingAnimations,
    extraAnimations,
    missingSkins,
    missingBones,
    missingSlots,
    constraintMismatch,
    source,
    target
  };
}

function animationWrapperCoverage(unityWrappers, targetSpine, visualContract) {
  const targetAnimations = new Set(targetSpine.flatMap((asset) => asset.animations));
  const explicitMappings = Array.isArray(visualContract?.animations) ? visualContract.animations : [];
  const wrappers = unityWrappers.filter((wrapper) => wrapper.kind === 'anim');
  return wrappers.map((wrapper) => {
    const declared = wrapper.declaredName || path.basename(wrapper.path, '.anim');
    const candidates = [declared, declared.replace(/^Ani[_-]/i, '')];
    const explicit = explicitMappings.find((mapping) => mapping.sourcePath === wrapper.path || mapping.sourceName === declared);
    const matchedAnimation = explicit?.targetAnimation || candidates.find((candidate) => targetAnimations.has(candidate)) ||
      [...targetAnimations].find((candidate) => normalizeName(candidate) === normalizeName(declared));
    return {
      sourcePath: wrapper.path,
      declaredName: declared,
      targetAnimation: matchedAnimation || null,
      mapping: explicit || null,
      // A contract may intentionally map a Unity authoring clip to a Laya
      // runtime presenter or a documented static state instead of a Spine
      // animation. That is still represented when the mapping is explicit;
      // strict mode must only block genuinely unaccounted-for wrappers.
      status: matchedAnimation ? (explicit ? 'mapped-by-contract' : 'represented-by-spine') : (explicit ? 'mapped-by-contract' : 'unmapped')
    };
  });
}

function materialReview(unityWrappers, visualContract) {
  const explicitMappings = Array.isArray(visualContract?.materials) ? visualContract.materials : [];
  return unityWrappers
    .filter((wrapper) => wrapper.kind === 'mat')
    .map((wrapper) => {
      const explicit = explicitMappings.find((mapping) => mapping.sourcePath === wrapper.path || mapping.sourceName === wrapper.declaredName);
      return {
        sourcePath: wrapper.path,
        declaredName: wrapper.declaredName,
        additive: wrapper.additive,
        targetMaterial: explicit?.targetMaterial || null,
        blendMode: explicit?.blendMode || null,
        mapping: explicit || null,
        status: explicit ? 'mapped-by-contract' : 'requires-target-material-contract',
        message: explicit ? 'Unity material wrapper is represented by an explicit Laya material contract.' : 'Unity material wrapper must be mapped to a Laya blend/material contract; file presence alone cannot prove visual equivalence.'
      };
    });
}

function compareAtlases(sourceInventory, targetInventory) {
  const targetByKey = indexByKey(targetInventory.atlases);
  return sourceInventory.atlases.map((source) => {
    const target = targetByKey.get(source.key)?.[0];
    if (!target) return { key: source.key, sourcePath: source.sourcePath, targetPath: null, status: 'missing-target', issues: ['Missing target atlas.'] };
    const issues = [];
    if (source.pages !== target.pages) issues.push(`Atlas page count differs: ${source.pages}->${target.pages}`);
    if (source.regions !== target.regions) issues.push(`Atlas region count differs: ${source.regions}->${target.regions}`);
    return { key: source.key, sourcePath: source.sourcePath, targetPath: target.sourcePath, status: issues.length ? 'mismatch' : 'matched', issues, source, target };
  });
}

function compareSpineTextures(sourceInventory, targetInventory) {
  const targetByKey = indexByKey(targetInventory.imageFiles);
  return sourceInventory.imageFiles
    .filter((file) => file.path.toLowerCase().includes('/animation/') || file.path.toLowerCase().includes('/spine/'))
    .map((source) => {
      const target = targetByKey.get(source.key)?.[0];
      return {
        key: source.key,
        sourcePath: source.path,
        targetPath: target?.path || null,
        status: target ? 'matched' : 'missing-target',
        sourceBytes: source.bytes,
        targetBytes: target?.bytes || null,
        byteIdentical: Boolean(target && target.sha256 === source.sha256)
      };
    });
}

export function auditVisualAssetMigration({ sourceRoot, targetRoot, strict = false, contractPath } = {}) {
  if (!sourceRoot || !targetRoot) throw new Error('sourceRoot and targetRoot are required');
  const source = path.resolve(sourceRoot);
  const target = path.resolve(targetRoot);
  if (!fs.existsSync(source)) throw new Error(`Source root does not exist: ${source}`);
  if (!fs.existsSync(target)) throw new Error(`Target root does not exist: ${target}`);

  const sourceInventory = collectInventory(source, 'unity');
  const targetInventory = collectInventory(target, 'laya');
  const visualContract = loadVisualContract(target, contractPath);
  const targetSpineByKey = indexByKey(targetInventory.spineJson);
  const spine = sourceInventory.spineJson.map((asset) => compareSpine(asset, targetSpineByKey.get(asset.key)?.[0]));
  const atlases = compareAtlases(sourceInventory, targetInventory);
  const textures = compareSpineTextures(sourceInventory, targetInventory);
  const animations = animationWrapperCoverage(sourceInventory.unityWrappers, targetInventory.spineJson, visualContract.value);
  const materials = materialReview(sourceInventory.unityWrappers, visualContract.value);
  const unmappedMaterials = materials.filter((item) => item.status !== 'mapped-by-contract');
  const issues = [];
  const blockers = [];
  for (const result of [...spine, ...atlases, ...textures]) {
    if (result.status === 'missing-target' || result.status === 'mismatch') {
      issues.push({ severity: 'error', category: 'asset-parity', ...result });
      blockers.push(result);
    }
  }
  const unmappedAnimations = animations.filter((item) => item.status === 'unmapped');
  if (unmappedAnimations.length) {
    issues.push({ severity: strict ? 'error' : 'warning', category: 'animation-contract', count: unmappedAnimations.length, items: unmappedAnimations });
    if (strict) blockers.push(...unmappedAnimations);
  }
  if (unmappedMaterials.length) {
    issues.push({ severity: strict ? 'error' : 'warning', category: 'material-contract', count: unmappedMaterials.length, items: unmappedMaterials });
    if (strict) blockers.push(...unmappedMaterials);
  }
  const matchedSpine = spine.filter((result) => result.status === 'matched').length;
  const matchedAtlases = atlases.filter((result) => result.status === 'matched').length;
  const matchedTextures = textures.filter((result) => result.status === 'matched').length;
  const report = {
    schemaVersion: 1,
    audit: 'zhuda-laya-engine.visual-asset-migration',
    sourceRoot: source,
    targetRoot: target,
    strict,
    contract: { path: visualContract.path, loaded: Boolean(visualContract.path), parseError: visualContract.error },
    source: sourceInventory,
    target: targetInventory,
    parity: { spine, atlases, textures, animations, materials },
    coverage: {
      spine: { matched: matchedSpine, total: spine.length, ratio: spine.length ? matchedSpine / spine.length : 1 },
      atlases: { matched: matchedAtlases, total: atlases.length, ratio: atlases.length ? matchedAtlases / atlases.length : 1 },
      textures: { matched: matchedTextures, total: textures.length, ratio: textures.length ? matchedTextures / textures.length : 1 },
      animationWrappers: { represented: animations.filter((item) => item.status === 'represented-by-spine' || item.status === 'mapped-by-contract').length, byContract: animations.filter((item) => item.status === 'mapped-by-contract').length, total: animations.length, ratio: animations.length ? animations.filter((item) => item.status === 'represented-by-spine' || item.status === 'mapped-by-contract').length / animations.length : 1 },
      materialsRequiringContract: unmappedMaterials.length
    },
    issues,
    passed: blockers.length === 0,
    summary: {
      blockerCount: blockers.length,
      errorCount: issues.filter((issue) => issue.severity === 'error').length,
      warningCount: issues.filter((issue) => issue.severity === 'warning').length,
      sourceFileCount: sourceInventory.totalFiles,
      targetFileCount: targetInventory.totalFiles,
      sourceSpineCount: sourceInventory.spineJson.length,
      targetSpineCount: targetInventory.spineJson.length,
      sourceAnimationCount: sourceInventory.unityWrappers.filter((wrapper) => wrapper.kind === 'anim').length,
      sourceMaterialCount: sourceInventory.unityWrappers.filter((wrapper) => wrapper.kind === 'mat').length
    }
  };
  return report;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (key === 'strict') args.strict = true;
    else args[key] = argv[i + 1];
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = auditVisualAssetMigration({ sourceRoot: args.source, targetRoot: args.target, strict: Boolean(args.strict), contractPath: args.contract });
    const output = args.report ? path.resolve(args.report) : null;
    if (output) {
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    }
    console.log(JSON.stringify({
      passed: report.passed,
      strict: report.strict,
      coverage: report.coverage,
      summary: report.summary,
      report: output
    }, null, 2));
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  }
}

