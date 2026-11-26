import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MCP_TOOLS_MANIFEST,
  assertMcpToolArguments,
  executeMcpTool,
  handleJsonRpcMessage,
} from '../packages/mcp-server/index.mjs';
import { validateToolArguments } from '../packages/mcp-server/arguments.mjs';
import {
  allowedRoots,
  configureAllowedRoots,
  isInsideRoot,
  resolveAllowedPath,
} from '../packages/mcp-server/roots.mjs';

const server = fileURLToPath(new URL('../packages/mcp-server/index.mjs', import.meta.url));

function scratch(t, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `zhuda-mcp-${name}-`));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function call(name, args) {
  return handleJsonRpcMessage({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  });
}

test('arguments are checked against the keywords the manifests use', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      count: { type: 'integer' },
      ratio: { type: 'number' },
      strict: { type: 'boolean' },
      kind: { type: 'string', enum: ['still', 'sequence'] },
      point: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
      nested: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    required: ['name'],
  };
  assert.deepEqual(validateToolArguments(schema, { name: 'a', count: 2, ratio: 0.5 }), []);
  // A key the schema does not name is left alone.
  assert.deepEqual(validateToolArguments(schema, { name: 'a', extra: { any: 'thing' } }), []);
  assert.deepEqual(validateToolArguments(schema, {}), ['arguments.name: required']);
  assert.deepEqual(validateToolArguments(schema, []), ['arguments: expected an object, got array']);
  assert.deepEqual(
    validateToolArguments(schema, {
      name: 5,
      count: 1.5,
      ratio: Number.NaN,
      strict: 'yes',
      kind: 'film',
      point: [0, 'x'],
      nested: {},
    }),
    [
      'arguments.name: expected a string, got number',
      'arguments.count: expected an integer, got 1.5',
      'arguments.ratio: expected a number, got NaN',
      'arguments.strict: expected a boolean, got string',
      'arguments.kind: expected one of "still", "sequence"',
      'arguments.point: needs at least 3 items, got 2',
      'arguments.point[1]: expected a number, got string',
      'arguments.nested.id: required',
    ],
  );
  assert.deepEqual(validateToolArguments(schema, { name: 'a', point: [0, 1, 2, 3] }), [
    'arguments.point: takes at most 3 items, got 4',
  ]);
  assert.deepEqual(validateToolArguments(schema, { name: null }), [
    'arguments.name: expected a string, got null',
  ]);
});

test('every tool schema stays inside what the check understands', () => {
  // A keyword added to a manifest and not to arguments.mjs would be declared and never enforced.
  const known = new Set([
    'type',
    'description',
    'properties',
    'required',
    'items',
    'minItems',
    'maxItems',
    'enum',
  ]);
  const types = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean']);
  const walk = (schema, at) => {
    assert.equal(typeof schema, 'object', at);
    for (const [key, value] of Object.entries(schema)) {
      assert.ok(known.has(key), `${at}: "${key}" is not checked by arguments.mjs`);
      if (key === 'type') assert.ok(types.has(value), `${at}: type ${JSON.stringify(value)}`);
      if (key === 'items') walk(value, `${at}[]`);
      if (key === 'properties')
        for (const [name, property] of Object.entries(value)) walk(property, `${at}.${name}`);
    }
  };
  for (const tool of MCP_TOOLS_MANIFEST) {
    assert.equal(tool.inputSchema.type, 'object', tool.name);
    walk(tool.inputSchema, tool.name);
  }
});

test('a call that does not fit its schema is refused before the tool runs', async () => {
  assert.throws(() => executeMcpTool('diagnose_error', { error: 5 }), {
    message:
      'diagnose_error: the arguments do not fit its input schema: arguments.error: expected a string, got number',
  });
  assert.throws(() => executeMcpTool('get_route', {}), /arguments\.id: required/);

  const refused = call('diagnose_error', {});
  assert.equal(refused.error.code, -32602);
  assert.match(refused.error.message, /^diagnose_error: .*arguments\.error: required$/);

  // A film tool is refused at once: no session is looked up and no browser is started.
  const film = call('film_scene_get', { sessionId: 7 });
  assert.equal(typeof film.then, 'undefined');
  assert.equal(film.error.code, -32602);
  assert.match(film.error.message, /film_scene_get: .*arguments\.sessionId: expected a string/);
  assert.throws(
    () => assertMcpToolArguments('film_render_job', { sessionId: 's', kind: 'gif', name: 'a' }),
    /arguments\.kind: expected one of/,
  );

  // A validator answers a malformed recipe with its own report, as before.
  assert.equal(executeMcpTool('validate_particle_effect', { effect: null }).passed, false);
  assert.ok(call('validate_texture_recipe', { recipe: 'not a recipe' }).result);

  // A call that fits goes through.
  assert.ok(
    call('diagnose_error', { error: "Cannot read properties of null (reading 'I')" }).result,
  );
  assert.ok(call('list_routes', {}).result);
});

test('a path argument must lie inside an allowed folder', (t) => {
  const inside = scratch(t, 'inside');
  const outside = scratch(t, 'outside');
  fs.writeFileSync(path.join(outside, 'visual-presentation-manifest.json'), '{}');
  fs.mkdirSync(path.join(inside, 'project'));
  t.after(() => configureAllowedRoots([]));

  // Only the working directory to begin with.
  assert.ok(isInsideRoot(process.cwd(), path.join(process.cwd(), 'tests')));
  assert.ok(isInsideRoot(process.cwd(), process.cwd()));
  assert.ok(!isInsideRoot(process.cwd(), path.dirname(process.cwd())));
  assert.ok(!isInsideRoot(inside, inside + '-sibling'));
  assert.ok(isInsideRoot(inside, path.join(inside, '..name-with-dots')));
  assert.throws(
    () => executeMcpTool('audit_visual_contract', { projectRoot: outside }),
    (err) =>
      err.message.startsWith('projectRoot: ') &&
      err.message.includes('is outside the folders this server may read') &&
      err.message.includes('--root DIRECTORY') &&
      err.message.includes('ZHUDA_MCP_ROOTS'),
  );
  assert.throws(
    () => executeMcpTool('audit_visual_migration', { sourceRoot: outside, targetRoot: 'tests' }),
    /^Error: sourceRoot: /,
  );
  assert.throws(
    () => executeMcpTool('audit_visual_migration', { sourceRoot: 'tests', targetRoot: outside }),
    /^Error: targetRoot: /,
  );
  assert.throws(
    () =>
      executeMcpTool('audit_visual_migration', {
        sourceRoot: 'tests',
        targetRoot: 'tests',
        contractPath: path.join(outside, 'visual-presentation-manifest.json'),
      }),
    /^Error: contractPath: /,
  );
  const refused = call('audit_visual_contract', { projectRoot: outside });
  assert.equal(refused.error.code, -32602);
  assert.match(refused.error.message, /^projectRoot: /);

  // A folder the operator added is read.
  configureAllowedRoots([inside]);
  assert.equal(allowedRoots().length, 2);
  const project = path.join(inside, 'project');
  assert.equal(resolveAllowedPath(project, 'projectRoot'), project);
  assert.equal(executeMcpTool('audit_visual_contract', { projectRoot: project }).passed, false);

  // A manifest path is taken from the project and may not climb out of every allowed folder.
  assert.throws(
    () =>
      executeMcpTool('audit_visual_contract', {
        projectRoot: project,
        manifestPath: path.relative(
          project,
          path.join(outside, 'visual-presentation-manifest.json'),
        ),
      }),
    /^Error: manifestPath: /,
  );

  // A link inside an allowed folder does not lead out of it.
  const link = path.join(inside, 'link');
  fs.symlinkSync(outside, link, 'junction');
  assert.throws(
    () => executeMcpTool('audit_visual_contract', { projectRoot: link }),
    /^Error: projectRoot: /,
  );
  assert.throws(
    () =>
      executeMcpTool('audit_visual_contract', {
        projectRoot: project,
        manifestPath: path.join('..', 'link', 'visual-presentation-manifest.json'),
      }),
    /^Error: manifestPath: /,
  );

  // The environment adds folders too.
  const before = process.env.ZHUDA_MCP_ROOTS;
  t.after(() => {
    if (before === undefined) delete process.env.ZHUDA_MCP_ROOTS;
    else process.env.ZHUDA_MCP_ROOTS = before;
  });
  process.env.ZHUDA_MCP_ROOTS = [outside, path.join(outside, 'missing')].join(path.delimiter);
  assert.equal(executeMcpTool('audit_visual_contract', { projectRoot: outside }).passed, false);
  assert.equal(executeMcpTool('audit_visual_contract', { projectRoot: link }).passed, false);
});

test('the command line takes --root', (t) => {
  const outside = scratch(t, 'cli');
  const args = [
    '--tool',
    'audit_visual_contract',
    '--args',
    JSON.stringify({ projectRoot: outside }),
  ];
  const env = { ...process.env };
  delete env.ZHUDA_MCP_ROOTS;
  const refused = spawnSync(process.execPath, [server, ...args], { encoding: 'utf8', env });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /projectRoot: .* is outside the folders this server may read/);

  const allowed = spawnSync(process.execPath, [server, '--root', outside, ...args], {
    encoding: 'utf8',
    env,
  });
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.equal(JSON.parse(allowed.stdout).tool, 'audit_visual_contract');
});
