import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  auditImplementationRoutes,
  getAgentContract,
  listImplementationRoutes,
  parseRoutePage,
  readImplementationRoute,
  REQUIRED_AGENT_FILES,
  ROUTE_HEADER_FIELDS,
  ROUTE_KINDS,
  ROUTE_REQUIRED_SECTIONS,
} from '../packages/compiler/agent-contract.mjs';
import { executeMcpTool } from '../packages/mcp-server/index.mjs';

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

test('every route is one page in docs/routes in one format, and is listed as data', () => {
  const routes = listImplementationRoutes(repo);
  // The workflows every project takes, and the scenes built end to end.
  for (const id of [
    'new-game-project',
    'good-looking-3d-scene',
    'film-as-data',
    'model-from-dcc',
    'visual-content-prefab',
    'single-html-page',
    'mini-game-build',
    'floating-island',
    'layered-cloth-on-body',
    'spine-character',
    'underwater',
  ])
    assert.ok(
      routes.some((route) => route.id === id),
      id,
    );
  const index = read('docs/routes/README.md');
  let lastSection = -1;
  for (const route of routes) {
    assert.equal(route.document, `docs/routes/${route.id}.md`);
    assert.ok(ROUTE_KINDS.includes(route.kind), route.id);
    const text = read(route.document);
    const page = parseRoutePage(text);
    // The header: every field, in the stated order, none empty.
    const order = ROUTE_HEADER_FIELDS.map((field) => text.indexOf(`- **${field}:**`));
    assert.ok(
      order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])),
      `${route.id}: header fields in order`,
    );
    for (const field of ROUTE_HEADER_FIELDS)
      assert.ok(page.fields[field]?.length > 3, `${route.id}: ${field}`);
    assert.ok(page.summary.length > 60, `${route.id}: a summary paragraph`);
    assert.ok(route.for.length > 40 && route.for.length < 400, `${route.id}: For`);
    // The sections: the same eight, in the same order, and no others.
    assert.deepEqual(
      page.sections,
      ROUTE_REQUIRED_SECTIONS.filter((s) => s.startsWith('## ')).map((s) => s.slice(3)),
      route.id,
    );
    // Listed in the index, under its kind.
    const row = index.search(new RegExp(`\\| \\[${route.id}\\]\\(${route.id}\\.md\\)\\s*\\|`));
    assert.ok(row > 0, `${route.id}: a row in the index`);
    const heading = index.lastIndexOf('\n## ', row);
    assert.match(
      index.slice(heading, heading + 20),
      route.kind === 'workflow' ? /## Workflows/ : /## Scenes/,
    );
    lastSection = Math.max(lastSection, row);
  }
  // Workflows come first in the listing.
  assert.deepEqual(
    routes.map((route) => route.kind),
    [...routes.map((route) => route.kind)].sort((a, b) =>
      a === b ? 0 : a === 'workflow' ? -1 : 1,
    ),
  );
});

test('an agent finds and reads a route over MCP and in the contract', () => {
  const listed = executeMcpTool('list_routes');
  assert.equal(listed.count, listImplementationRoutes(repo).length);
  assert.ok(listed.routes.every((route) => route.id && route.for && route.checkedOn));
  assert.ok(
    executeMcpTool('list_routes', { kind: 'scene' }).routes.every((r) => r.kind === 'scene'),
  );
  const route = executeMcpTool('get_route', { id: 'film-as-data' });
  assert.equal(route.found, true);
  assert.match(route.text, /^# Route: /);
  assert.match(route.text, /film_scene_query/);
  assert.equal(route.document, 'docs/routes/film-as-data.md');
  const missing = executeMcpTool('get_route', { id: 'nowhere' });
  assert.equal(missing.found, false);
  assert.ok(missing.known.includes('new-game-project'));
  assert.equal(readImplementationRoute(repo, 'nowhere'), undefined);
  const contract = getAgentContract(repo);
  assert.equal(contract.routes.length, listed.count);
  // The entry documents name the tools, so a route is two calls away.
  for (const file of ['AGENTS.md', 'README.md', 'docs/routes/README.md'])
    assert.ok(read(file).includes('list_routes'), file);
});

test('a route whose id is not its file name, or of an unknown kind, is reported', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-routes-'));
  try {
    fs.mkdirSync(path.join(root, 'docs/routes'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs/routes/README.md'), '| [odd](odd.md) | x |\n');
    fs.writeFileSync(
      path.join(root, 'docs/routes/odd.md'),
      '# Route: odd\n\nText.\n\n- **Id:** `other`\n- **Kind:** recipe\n' +
        ROUTE_REQUIRED_SECTIONS.join('\n'),
    );
    const codes = auditImplementationRoutes(root).issues.map((item) => item.code);
    assert.ok(codes.includes('ROUTE_ID_MISMATCH'));
    assert.ok(codes.includes('ROUTE_KIND_INVALID'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a link from a route to a section of a guide names a heading that exists', () => {
  // GitHub's anchor for a heading: lower case, punctuation dropped, spaces to dashes.
  const slug = (heading) =>
    heading
      .toLowerCase()
      .replace(/`/g, '')
      .replace(/[^\p{L}\p{N} _-]/gu, '')
      .replace(/ /g, '-');
  const anchors = new Map();
  const anchorsOf = (file) => {
    if (!anchors.has(file))
      anchors.set(
        file,
        new Set(
          fs
            .readFileSync(file, 'utf8')
            .split('\n')
            .filter((line) => /^#{1,6} /.test(line))
            .map((line) => slug(line.replace(/^#+ /, ''))),
        ),
      );
    return anchors.get(file);
  };
  const files = [
    'README.md',
    ...listImplementationRoutes(repo).map((r) => path.basename(r.document)),
  ];
  let checked = 0;
  for (const name of files) {
    const text = read(`docs/routes/${name}`);
    for (const match of text.matchAll(/\]\(([^)#\s]+\.md)#([^)\s]+)\)/g)) {
      const target = path.resolve(repo, 'docs/routes', match[1]);
      assert.ok(anchorsOf(target).has(match[2]), `${name} -> ${match[1]}#${match[2]}`);
      checked++;
    }
  }
  assert.ok(checked >= 10);
});
