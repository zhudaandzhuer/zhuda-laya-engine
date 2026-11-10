import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CONTRACT = 'zhuda-laya-engine.layout';
const NODE_KINDS = new Set([
  'scene',
  'container',
  'region',
  'button',
  'text',
  'image',
  'safe-area',
  'custom',
]);
const ANCHORS = new Set([
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

const finitePositive = (value) => Number.isFinite(value) && value > 0;
const finiteNonNegative = (value) => Number.isFinite(value) && value >= 0;
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

export function normalizeLayoutPath(value, field = 'path') {
  if (typeof value !== 'string' || !value.trim())
    throw Error(`${field} must be a non-empty relative path`);
  const normalized = value.trim().replaceAll('\\', '/');
  if (
    normalized.startsWith('/') ||
    normalized.includes('\0') ||
    normalized.split('/').some((part) => !part || part === '.' || part === '..') ||
    /^[A-Za-z]:/.test(normalized)
  )
    throw Error(`${field} must be a normalized relative path without '..'`);
  return normalized;
}

export function readImageDimensions(bytes, file = 'source image') {
  if (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString('ascii', 12, 16) === 'IHDR'
  )
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), mime: 'image/png' };
  if (
    bytes.length >= 30 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && bytes.length >= 30)
      return {
        width: 1 + bytes.readUIntLE(24, 3),
        height: 1 + bytes.readUIntLE(27, 3),
        mime: 'image/webp',
      };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > bytes.length) break;
      const baseline =
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        marker === 0xc5 ||
        marker === 0xc6 ||
        marker === 0xc7 ||
        marker === 0xc9 ||
        marker === 0xca ||
        marker === 0xcb ||
        marker === 0xcd ||
        marker === 0xce ||
        marker === 0xcf;
      if (baseline)
        return {
          width: bytes.readUInt16BE(offset + 7),
          height: bytes.readUInt16BE(offset + 5),
          mime: 'image/jpeg',
        };
      offset += length + 2;
    }
  }
  throw Error(`Unsupported or malformed ${file}; use PNG, JPEG or WebP`);
}

function validateRect(rect, label, design) {
  if (
    !rect ||
    typeof rect !== 'object' ||
    !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key]))
  )
    throw Error(`${label}.rect must contain finite x, y, width and height`);
  if (!finitePositive(rect.width) || !finitePositive(rect.height))
    throw Error(`${label}.rect width and height must be positive`);
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.x + rect.width > design.width ||
    rect.y + rect.height > design.height
  )
    throw Error(`${label}.rect must stay inside the design canvas`);
}

export function validateLayoutContract(value, { requireSourceHash = true } = {}) {
  const issues = [];
  const fail = (message) => issues.push(message);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { passed: false, issues: ['layout contract must be an object'] };
  if (value.contract !== CONTRACT) fail(`contract must be ${CONTRACT}`);
  if (value.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id))
    fail('id must be a normalized logical ID');
  const design = value.design;
  if (
    !design ||
    !finitePositive(design.width) ||
    !finitePositive(design.height) ||
    design.width > 16384 ||
    design.height > 16384
  )
    fail('design.width and design.height must be finite positive values <= 16384');
  const source = value.source;
  if (!source || typeof source !== 'object') fail('source is required');
  else {
    try {
      normalizeLayoutPath(source.path, 'source.path');
    } catch (error) {
      fail(error.message);
    }
    if (
      requireSourceHash &&
      (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256))
    )
      fail('source.sha256 must be a lowercase SHA-256');
    if (!finitePositive(source.width) || !finitePositive(source.height))
      fail('source.width and source.height must be finite positive values');
    if (
      design &&
      finitePositive(design.width) &&
      finitePositive(design.height) &&
      (source.width !== design.width || source.height !== design.height)
    )
      fail('source dimensions must equal design dimensions');
    if (source.bytes !== undefined && (!Number.isSafeInteger(source.bytes) || source.bytes <= 0))
      fail('source.bytes must be a positive integer when provided');
  }
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];
  if (!nodes.length) fail('nodes must contain at least one region');
  if (nodes.length > 2000) fail('nodes cannot exceed 2000 entries');
  const ids = new Set();
  for (const [index, node] of nodes.entries()) {
    const label = `nodes[${index}]`;
    if (!node || typeof node !== 'object') {
      fail(`${label} must be an object`);
      continue;
    }
    if (typeof node.id !== 'string' || !ID_PATTERN.test(node.id))
      fail(`${label}.id must be a normalized logical ID`);
    else if (ids.has(node.id)) fail(`${label}.id duplicates ${node.id}`);
    else ids.add(node.id);
    if (!NODE_KINDS.has(node.kind))
      fail(`${label}.kind must be one of ${[...NODE_KINDS].join(', ')}`);
    if (design && finitePositive(design.width) && finitePositive(design.height)) {
      try {
        validateRect(node.rect, label, design);
      } catch (error) {
        fail(error.message);
      }
    }
    if (node.label !== undefined && (typeof node.label !== 'string' || node.label.length > 200))
      fail(`${label}.label must be a string up to 200 characters`);
    if (node.anchor !== undefined && !ANCHORS.has(node.anchor)) fail(`${label}.anchor is invalid`);
    if (
      node.parent !== undefined &&
      (typeof node.parent !== 'string' || !ID_PATTERN.test(node.parent))
    )
      fail(`${label}.parent must be a logical ID`);
    if (node.zIndex !== undefined && !Number.isSafeInteger(node.zIndex))
      fail(`${label}.zIndex must be an integer`);
    if (
      node.states !== undefined &&
      (!Array.isArray(node.states) ||
        node.states.some((state) => typeof state !== 'string' || !state.trim()) ||
        new Set(node.states).size !== node.states.length)
    )
      fail(`${label}.states must be unique non-empty strings`);
  }
  for (const node of nodes)
    if (node?.parent && !ids.has(node.parent))
      fail(`node ${node.id} references missing parent ${node.parent}`);
  for (const node of nodes) {
    const seen = new Set();
    let current = node;
    while (current?.parent) {
      if (seen.has(current.id)) {
        fail(`parent cycle includes ${current.id}`);
        break;
      }
      seen.add(current.id);
      current = nodes.find((candidate) => candidate?.id === current.parent);
    }
  }
  const safeAreas = value.safeAreas ?? [];
  if (!Array.isArray(safeAreas)) fail('safeAreas must be an array');
  else {
    const safeIds = new Set();
    for (const [index, area] of safeAreas.entries()) {
      const label = `safeAreas[${index}]`;
      if (
        !area ||
        typeof area !== 'object' ||
        typeof area.id !== 'string' ||
        !ID_PATTERN.test(area.id)
      )
        fail(`${label}.id must be a logical ID`);
      else if (safeIds.has(area.id)) fail(`${label}.id duplicates ${area.id}`);
      else safeIds.add(area.id);
      const inset = area?.inset;
      if (
        !inset ||
        !['top', 'right', 'bottom', 'left'].every((key) => finiteNonNegative(inset[key]))
      )
        fail(`${label}.inset must contain non-negative finite sides`);
      else if (design && inset.left + inset.right >= design.width)
        fail(`${label}.inset leaves no horizontal design space`);
      else if (design && inset.top + inset.bottom >= design.height)
        fail(`${label}.inset leaves no vertical design space`);
    }
  }
  return { passed: issues.length === 0, issues, contract: value };
}

export function readLayoutContract(file, options) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = validateLayoutContract(value, options);
  if (!result.passed) throw Error(result.issues.join('; '));
  return value;
}

function parseAttributes(tag) {
  const attributes = {};
  const pattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(["'])(.*?)\2/g;
  for (const match of tag.matchAll(pattern)) attributes[match[1]] = match[3];
  return attributes;
}
function numberAttribute(attributes, key, required = true) {
  const value = Number(attributes[key]);
  if (!Number.isFinite(value) || (required && attributes[key] === undefined))
    throw Error(`SVG rect ${key} must be finite`);
  return value;
}
function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function parseLayoutSvg(svg, { id = 'scene/layout', sourcePath, sourceInfo } = {}) {
  if (typeof svg !== 'string' || !svg.trim()) throw Error('SVG source is empty');
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!root) throw Error('SVG root element is missing');
  const rootAttributes = parseAttributes(root);
  const viewBox = (rootAttributes.viewBox || '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    viewBox.length !== 4 ||
    viewBox[0] !== 0 ||
    viewBox[1] !== 0 ||
    !finitePositive(viewBox[2]) ||
    !finitePositive(viewBox[3])
  )
    throw Error('SVG viewBox must be "0 0 width height"');
  const [, , designWidth, designHeight] = viewBox;
  const nodes = [];
  for (const match of svg.matchAll(/<rect\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const nodeId = attributes['data-layout-id'];
    if (!nodeId) continue;
    const states = attributes['data-states']
      ? attributes['data-states']
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined;
    const node = {
      id: nodeId,
      kind: attributes['data-kind'] || 'region',
      rect: {
        x: numberAttribute(attributes, 'x'),
        y: numberAttribute(attributes, 'y'),
        width: numberAttribute(attributes, 'width'),
        height: numberAttribute(attributes, 'height'),
      },
      ...(attributes['data-label'] ? { label: attributes['data-label'] } : {}),
      ...(attributes['data-anchor'] ? { anchor: attributes['data-anchor'] } : {}),
      ...(attributes['data-parent'] ? { parent: attributes['data-parent'] } : {}),
      ...(attributes['data-z'] !== undefined ? { zIndex: Number(attributes['data-z']) } : {}),
      ...(states?.length ? { states } : {}),
    };
    nodes.push(node);
  }
  const contract = {
    contract: CONTRACT,
    schemaVersion: 1,
    id,
    design: { width: designWidth, height: designHeight },
    source: sourceInfo
      ? { path: normalizeLayoutPath(sourcePath || sourceInfo.path, 'source.path'), ...sourceInfo }
      : {
          path: normalizeLayoutPath(sourcePath || 'reference/source.png', 'source.path'),
          sha256: '0'.repeat(64),
          width: designWidth,
          height: designHeight,
        },
    nodes,
  };
  const result = validateLayoutContract(contract, { requireSourceHash: Boolean(sourceInfo) });
  if (!result.passed) throw Error(result.issues.join('; '));
  return contract;
}

export function layoutToSvg(contract, { includeLabels = true } = {}) {
  const result = validateLayoutContract(contract);
  if (!result.passed) throw Error(result.issues.join('; '));
  const { width, height } = contract.design;
  const groups = [...contract.nodes]
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    .map((node) => {
      const r = node.rect;
      const attrs = [
        `data-layout-id="${xmlEscape(node.id)}"`,
        `data-kind="${xmlEscape(node.kind)}"`,
        node.anchor ? `data-anchor="${xmlEscape(node.anchor)}"` : '',
        node.parent ? `data-parent="${xmlEscape(node.parent)}"` : '',
        node.states?.length ? `data-states="${xmlEscape(node.states.join(','))}"` : '',
      ]
        .filter(Boolean)
        .join(' ');
      const label = includeLabels
        ? `<text x="${r.x + 6}" y="${r.y + 18}" class="layout-label">${xmlEscape(node.label || node.id)}</text>`
        : '';
      return `<g><rect ${attrs} x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" class="layout-box"/>${label}</g>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Zhuda layout wireframe">\n<style>.layout-box{fill:#21d4fd22;stroke:#21d4fd;stroke-width:2;vector-effect:non-scaling-stroke}.layout-label{fill:#06121f;font:14px ui-monospace,monospace;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}</style>${groups}\n</svg>\n`;
}

export function compareLayoutSvg(contract, svg) {
  const parsed = parseLayoutSvg(svg, { id: contract.id, sourceInfo: { ...contract.source } });
  const issues = [];
  if (
    parsed.design.width !== contract.design.width ||
    parsed.design.height !== contract.design.height
  )
    issues.push('SVG viewBox does not match layout design dimensions');
  const expected = new Map(contract.nodes.map((node) => [node.id, node]));
  const actual = new Map(parsed.nodes.map((node) => [node.id, node]));
  for (const id of expected.keys())
    if (!actual.has(id)) issues.push(`SVG is missing layout node ${id}`);
  for (const id of actual.keys())
    if (!expected.has(id)) issues.push(`SVG contains undeclared layout node ${id}`);
  for (const [id, node] of expected) {
    const other = actual.get(id);
    if (!other) continue;
    for (const key of ['x', 'y', 'width', 'height'])
      if (node.rect[key] !== other.rect[key]) issues.push(`SVG geometry differs for ${id}.${key}`);
    if (node.kind !== other.kind) issues.push(`SVG kind differs for ${id}`);
  }
  return { passed: issues.length === 0, issues, contract: parsed };
}

function mimeFor(file) {
  return /\.png$/i.test(file)
    ? 'image/png'
    : /\.jpe?g$/i.test(file)
      ? 'image/jpeg'
      : /\.webp$/i.test(file)
        ? 'image/webp'
        : 'application/octet-stream';
}

export function buildLayoutPreview(contract, sourceBytes, { title = contract.id } = {}) {
  const svg = layoutToSvg(contract);
  const image = `data:${mimeFor(contract.source.path)};base64,${Buffer.from(sourceBytes).toString('base64')}`;
  const data = JSON.stringify({
    id: contract.id,
    design: contract.design,
    nodes: contract.nodes,
  }).replaceAll('<', '\\u003c');
  const inlineSvg = svg.replaceAll('<script', '&lt;script');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${xmlEscape(title)}</title><style>:root{color-scheme:dark;font:14px system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:#07111f;color:#e8f2ff;min-height:100vh}main{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;padding:16px;min-height:100vh}.stage{display:grid;place-items:center;min-width:0}.canvas{position:relative;width:min(100%,calc(100vw - 328px));aspect-ratio:${contract.design.width}/${contract.design.height};background:#182638;box-shadow:0 16px 48px #0008}.canvas img,.canvas svg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.canvas svg{pointer-events:auto}.panel{padding:12px;border:1px solid #29415b;border-radius:12px;background:#0d1b2b;align-self:start;max-height:calc(100vh - 32px);overflow:auto}.panel h1{font-size:15px;margin:0 0 12px}.node{display:block;width:100%;margin:4px 0;padding:8px;border:1px solid #29415b;border-radius:8px;background:#10263c;color:#d8edff;text-align:left;cursor:pointer}.node:hover,.node.active{border-color:#21d4fd;background:#153d58}.meta{color:#9db5c9;font-size:12px;white-space:pre-wrap}@media(max-width:760px){main{display:block;padding:8px}.canvas{width:100%}.panel{margin-top:8px;max-height:none}}</style></head><body><main><section class="stage"><div class="canvas"><img alt="Layout source" src="${image}"><div id="overlay">${inlineSvg}</div></div></section><aside class="panel"><h1>${xmlEscape(title)}</h1><div class="meta" id="meta">Select a region</div><div id="nodes"></div></aside></main><script type="application/json" id="layout-data">${data}</script><script>(()=>{const data=JSON.parse(document.querySelector('#layout-data').textContent),meta=document.querySelector('#meta'),list=document.querySelector('#nodes');const boxes=[...document.querySelectorAll('[data-layout-id]')];const select=id=>{const n=data.nodes.find(v=>v.id===id);if(!n)return;boxes.forEach(b=>b.classList.toggle('active',b.dataset.layoutId===id));document.querySelectorAll('.node').forEach(b=>b.classList.toggle('active',b.dataset.id===id));meta.textContent=JSON.stringify({id:n.id,kind:n.kind,rect:n.rect,anchor:n.anchor||null,parent:n.parent||null,states:n.states||[]},null,2)};data.nodes.forEach(n=>{const b=document.createElement('button');b.className='node';b.dataset.id=n.id;b.textContent=n.id;b.onclick=()=>select(n.id);list.appendChild(b)});boxes.forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();select(b.dataset.layoutId)}));})();</script></body></html>`;
}

export function validateLayoutContracts(projectRoot, configured) {
  if (configured === undefined) return { passed: true, contracts: [] };
  if (!Array.isArray(configured))
    return { passed: false, contracts: [], issues: ['layoutContracts must be an array'] };
  const contracts = [],
    issues = [];
  for (const [index, entry] of configured.entries()) {
    const layoutPath = typeof entry === 'string' ? entry : entry?.layout;
    const svgPath = typeof entry === 'object' ? entry?.svg : undefined;
    const label = `layoutContracts[${index}]`;
    try {
      const layoutFile = path.resolve(
        projectRoot,
        normalizeLayoutPath(layoutPath, `${label}.layout`),
      );
      if (!layoutFile.startsWith(path.resolve(projectRoot) + path.sep))
        throw Error('layout path escapes project');
      const contract = readLayoutContract(layoutFile);
      const sourceFile = path.resolve(
        projectRoot,
        normalizeLayoutPath(contract.source.path, `${label}.source.path`),
      );
      if (
        !sourceFile.startsWith(path.resolve(projectRoot) + path.sep) ||
        !fs.existsSync(sourceFile)
      )
        throw Error(`source image is missing: ${contract.source.path}`);
      const sourceBytes = fs.readFileSync(sourceFile);
      const info = readImageDimensions(sourceBytes, contract.source.path);
      if (info.width !== contract.source.width || info.height !== contract.source.height)
        throw Error('source image dimensions do not match the contract');
      if (sha256(sourceBytes) !== contract.source.sha256)
        throw Error('source image SHA-256 does not match the contract');
      if (svgPath !== undefined) {
        const svgFile = path.resolve(projectRoot, normalizeLayoutPath(svgPath, `${label}.svg`));
        if (!svgFile.startsWith(path.resolve(projectRoot) + path.sep))
          throw Error('SVG path escapes project');
        const comparison = compareLayoutSvg(contract, fs.readFileSync(svgFile, 'utf8'));
        if (!comparison.passed) throw Error(comparison.issues.join('; '));
      }
      contracts.push({
        id: contract.id,
        layout: path.relative(projectRoot, layoutFile).split(path.sep).join('/'),
        svg: svgPath ?? null,
        source: contract.source.path,
        nodes: contract.nodes.length,
      });
    } catch (error) {
      issues.push(`${label}: ${error.message}`);
    }
  }
  return { passed: issues.length === 0, contracts, issues };
}
