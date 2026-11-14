// The topology table says which globals each LayaAir lib provides
// (`providesGlobals`); `EngineGuard.inspectEngineHealth` counts a module as
// loaded when every one of them is present. These tests read each vendored
// lib as JavaScript and collect what it assigns while it loads, so that a
// name the lib does not define (or that another lib defines) fails here and
// not silently in a health report. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { TopologyResolver, ZHUDA_ENGINE_MODULES } from '../packages/core/TopologyGraph.ts';

const LIBS = new URL('../vendor/laya-3.4.2/libs/', import.meta.url);
/** Identifiers that are the global object itself. */
const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self']);

const unwrap = (node) => {
  for (;;)
    if (ts.isParenthesizedExpression(node)) node = node.expression;
    else if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken)
      node = node.operand;
    else return node;
};

/**
 * `a.b["c"]` as a path from the global object ('Laya.b.c' when `a` stands for
 * `Laya`), or undefined when `a` is not known to stand for a global.
 */
function globalPath(node, roots) {
  const parts = [];
  for (;;)
    if (ts.isPropertyAccessExpression(node)) {
      parts.unshift(node.name.text);
      node = node.expression;
    } else if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression)
    ) {
      parts.unshift(node.argumentExpression.text);
      node = node.expression;
    } else if (ts.isParenthesizedExpression(node)) node = node.expression;
    else break;
  if (!ts.isIdentifier(node)) return undefined;
  if (GLOBAL_OBJECTS.has(node.text) && !roots.has(node.text))
    return parts.length ? parts.join('.') : undefined;
  const root = roots.get(node.text);
  return root === undefined ? undefined : [root, ...parts].join('.');
}

/** The global a wrapper's argument stands for: `Laya`, `window.Laya = window.Laya || {}`, `spine || (spine = {})`. */
function argumentPath(arg, roots, returnedTo) {
  arg = unwrap(arg);
  if (ts.isIdentifier(arg)) return roots.get(arg.text);
  // `window.Laya = function (e) { ...; return e; }({})`
  if (ts.isObjectLiteralExpression(arg) && arg.properties.length === 0) return returnedTo;
  if (ts.isBinaryExpression(arg)) {
    if (arg.operatorToken.kind === ts.SyntaxKind.EqualsToken) return globalPath(arg.left, roots);
    if (arg.operatorToken.kind === ts.SyntaxKind.BarBarToken) return argumentPath(arg.left, roots);
  }
  return undefined;
}

function declaredNames(statement) {
  if (ts.isVariableStatement(statement))
    return statement.declarationList.declarations
      .filter((declaration) => ts.isIdentifier(declaration.name))
      .map((declaration) => declaration.name.text);
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name)
    return [statement.name.text];
  return [];
}

/** Assignments made while `body` runs, without entering code that runs later. */
function collect(body, roots, out) {
  const assignedTo = new Map();
  const visit = (node) => {
    // Functions, methods and class bodies run later, if at all: not loading.
    if (ts.isFunctionLike(node) || ts.isClassLike(node)) return;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const name = globalPath(node.left, roots);
      if (name) out.add(name);
      const right = unwrap(node.right);
      if (name && ts.isCallExpression(right)) assignedTo.set(right, name);
    }
    if (ts.isCallExpression(node)) enter(node, roots, out, assignedTo.get(node));
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(body, visit);
}

/** A function called where it is written (a module wrapper) runs while loading. */
function enter(call, roots, out, assignedTo) {
  const fn = unwrap(call.expression);
  if (!(ts.isFunctionExpression(fn) || ts.isArrowFunction(fn)) || !ts.isBlock(fn.body)) return;
  // What the wrapper hands back: `return e` or, minified, `return e.a=x,e`.
  const last = fn.body.statements.at(-1);
  let value = last && ts.isReturnStatement(last) ? last.expression : undefined;
  while (
    value &&
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.CommaToken
  )
    value = value.right;
  const returned = value && ts.isIdentifier(value) ? value.text : undefined;
  const inner = new Map(roots);
  fn.parameters.forEach((param, index) => {
    if (!ts.isIdentifier(param.name)) return;
    const arg = call.arguments[index];
    const path =
      arg && argumentPath(arg, roots, returned === param.name.text ? assignedTo : undefined);
    if (path) inner.set(param.name.text, path);
    else inner.delete(param.name.text);
  });
  // A name declared again in the wrapper's own scope is a local from there on.
  for (const statement of fn.body.statements)
    for (const name of declaredNames(statement)) inner.delete(name);
  collect(fn.body, inner, out);
}

/** Paths from the global object that a script assigns while it loads. */
function topLevelGlobals(text, fileName = 'lib.js') {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS,
  );
  const roots = new Map([['Laya', 'Laya']]);
  // A script's own `var` and function declarations are properties of the global object.
  for (const statement of source.statements)
    if (
      (ts.isVariableStatement(statement) &&
        !(statement.declarationList.flags & ts.NodeFlags.BlockScoped)) ||
      ts.isFunctionDeclaration(statement)
    )
      for (const name of declaredNames(statement)) roots.set(name, name);
  const out = new Set();
  for (const statement of source.statements)
    if (
      ts.isVariableStatement(statement) &&
      !(statement.declarationList.flags & ts.NodeFlags.BlockScoped)
    )
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.initializer)
          out.add(declaration.name.text);
  collect(source, roots, out);
  return out;
}

const parsed = new Map();
const globalsOf = (file) => {
  if (!parsed.has(file))
    parsed.set(file, topLevelGlobals(fs.readFileSync(new URL(file, LIBS), 'utf8'), file));
  return parsed.get(file);
};
/** `window.spine` and `spine` are the same global. */
const normalize = (name) => name.replace(/^(window|globalThis|self)\./, '');
const missingGlobals = (module) =>
  module.providesGlobals.filter((name) => !globalsOf(module.file).has(normalize(name)));

const byId = (modules) => [...new Map(modules.map((module) => [module.id, module])).values()];
const TABLES = {
  webgl: [...ZHUDA_ENGINE_MODULES],
  // The WebGPU table is derived: everything, plus the Spine 3.8 pair `all` leaves out.
  webgpu: byId([
    ...TopologyResolver.resolveByFeatures('all', 'webgpu').orderedModules,
    ...TopologyResolver.resolveByModuleIds(['spine38'], 'webgpu').orderedModules,
  ]),
};

test('both renderer tables are read in full', () => {
  const webgpuIds = TABLES.webgpu.map((module) => module.id).sort();
  const expected = [
    ...ZHUDA_ENGINE_MODULES.map((module) => module.id.replace('webgl', 'webgpu')),
    'shader-compiler',
    'naga',
  ].sort();
  assert.deepEqual(webgpuIds, expected);
  for (const modules of Object.values(TABLES))
    for (const module of modules) {
      assert.ok(fs.existsSync(new URL(module.file, LIBS)), module.file);
      assert.ok(module.providesGlobals.length > 0, module.id);
    }
});

test('every providesGlobals entry is defined by its own vendored lib while it loads', () => {
  const problems = [];
  for (const [renderer, modules] of Object.entries(TABLES))
    for (const module of modules) {
      const missing = missingGlobals(module);
      if (missing.length) problems.push(`${renderer} ${module.id} (${module.file}): ${missing}`);
    }
  assert.deepEqual(problems, []);
});

test('every module names at least one global that no other lib of its realm defines', () => {
  const problems = [];
  for (const [renderer, modules] of Object.entries(TABLES)) {
    for (const module of modules) {
      // Modules that may not share a page with this one do not count.
      const others = modules.filter(
        (other) =>
          other.file !== module.file &&
          !module.conflictsWith?.includes(other.id) &&
          !other.conflictsWith?.includes(module.id),
      );
      const own = module.providesGlobals.filter(
        (name) => !others.some((other) => globalsOf(other.file).has(normalize(name))),
      );
      if (!own.length) problems.push(`${renderer} ${module.id}: ${module.providesGlobals}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('every sizeBytes and the WebGPU support files match the vendored files', () => {
  const problems = [];
  for (const [renderer, modules] of Object.entries(TABLES))
    for (const module of modules) {
      const size = fs.statSync(new URL(module.file, LIBS)).size;
      if (size !== module.sizeBytes)
        problems.push(`${renderer} ${module.file}: ${module.sizeBytes}, file ${size}`);
    }
  assert.deepEqual(problems, []);
  const gpu = TopologyResolver.resolveByFeatures(['core'], 'webgpu');
  const modules = gpu.orderedModules.reduce((sum, module) => sum + module.sizeBytes, 0);
  const support = gpu.supportFiles.reduce(
    (sum, file) => sum + fs.statSync(new URL(file, LIBS)).size,
    0,
  );
  assert.equal(gpu.totalSizeBytes - modules, support);
});

test('names the libs do not define are reported, with their real exports beside them', () => {
  const trail3d = ZHUDA_ENGINE_MODULES.find((module) => module.id === 'trail3d');
  assert.deepEqual(
    missingGlobals({ ...trail3d, providesGlobals: ['Laya.TrailSprite3D', 'Laya.TrailRenderer'] }),
    ['Laya.TrailSprite3D'],
  );
  const ik = ZHUDA_ENGINE_MODULES.find((module) => module.id === 'ik');
  assert.deepEqual(
    missingGlobals({ ...ik, providesGlobals: ['Laya.IKConstraint', 'Laya.IK_Comp'] }),
    ['Laya.IKConstraint'],
  );
  // Defined, but by laya.d3.js: it would count laya.postProcess.js as loaded without it.
  const post = ZHUDA_ENGINE_MODULES.find((module) => module.id === 'postProcess');
  assert.deepEqual(missingGlobals({ ...post, providesGlobals: ['Laya.PostProcess'] }), [
    'Laya.PostProcess',
  ]);
  assert.ok(globalsOf('laya.d3.js').has('Laya.PostProcess'));
  // Case matters: Box2D's global is `Box2D`.
  const box2d = ZHUDA_ENGINE_MODULES.find((module) => module.id === 'box2d');
  assert.deepEqual(missingGlobals({ ...box2d, providesGlobals: ['window.box2d'] }), [
    'window.box2d',
  ]);
});

test('only what runs while a script loads counts as defined', () => {
  const found = topLevelGlobals(
    [
      '!function(e,t){"use strict";',
      'class a{m(){e.Method=1}static s(){e.Static=1}}',
      'function f(e){e.Param=1}',
      't.Laya.addAfterInitCallback(()=>{e.Callback=1});',
      '(function(){e.Inner=1})();',
      '(function(e){e[e.Local=0]="Local"})(e.Kind||(e.Kind={}));',
      'e.Now=a,e.Sub=class{}',
      '}(window.Laya=window.Laya||{},Laya);',
      '!function(e){var e={};e.Shadowed=1}(window.Laya=window.Laya||{});',
      'window["Quoted"]=1;var spine;(function(s){s.Bone=1})(spine||(spine={}));',
      'window.Core=function(e){e.Node=1;return e}({});',
      'window.Packed=function(e){"use strict";return e.Node=1,e}({});',
      'window.Other=function(e){e.Node=1;return{}}({});',
      'var declared;',
    ].join(''),
  );
  assert.deepEqual([...found].sort(), [
    'Core',
    'Core.Node',
    'Laya',
    'Laya.Inner',
    'Laya.Kind',
    'Laya.Now',
    'Laya.Sub',
    'Other',
    'Packed',
    'Packed.Node',
    'Quoted',
    'spine',
    'spine.Bone',
  ]);
});

test('3D Spine is ready only when the lib that draws it is loaded', async () => {
  const { EngineGuard } = await import('../packages/core/RuntimeGuards.ts');
  const before = globalThis.Laya;
  try {
    // The 2D adapter alone (laya.spine.js) used to count as 3D Spine being ready.
    globalThis.Laya = { SpineTemplet: class {}, Spine2DRenderNode: class {} };
    let seen = EngineGuard.checkSpine42();
    assert.equal(seen.layaSpineAdapterReady, true);
    assert.equal(seen.layaSpine3DReady, false);
    // laya.spine3D.js defines Laya.Spine3DRenderer (checked against the lib above).
    globalThis.Laya = { SpineTemplet: class {}, Spine3DRenderer: class {} };
    seen = EngineGuard.checkSpine42();
    assert.equal(seen.layaSpine3DReady, true);
    // The name the guard read before exists in no lib.
    globalThis.Laya = { Spine3DRenderNode: class {} };
    assert.equal(EngineGuard.checkSpine42().layaSpine3DReady, false);
  } finally {
    globalThis.Laya = before;
  }
});
