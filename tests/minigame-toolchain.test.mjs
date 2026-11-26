import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  writeOfficialProject,
  resolveMiniGameToolchain,
  OFFICIAL_VERSION,
} from '../packages/compiler/minigame-toolchain.mjs';
import { auditMiniGameInputs } from '../packages/compiler/minigame-guards.mjs';

test('headless official project declares required platform config without credentials', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-mini-project-'));
  try {
    writeOfficialProject(root, 'fixture');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'zhuda.laya'))), {
      version: OFFICIAL_VERSION,
    });
    const settings = JSON.parse(fs.readFileSync(path.join(root, 'settings/BuildSettings.json')));
    assert.equal(settings.oppogame.package, 'com.zhuda.minigame');
    assert.equal(settings.vivogame.minPlatformVersion, '1063');
    assert.equal(settings.xmgame.versionCode, '1');
    assert.equal(settings.wxgame.appid, 'touristappid');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('mini-game source guard reports browser APIs with a source location', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-mini-guard-'));
  const file = path.join(root, 'Main.ts');
  fs.writeFileSync(
    file,
    `import {ZhudaPointerInput} from 'zhuda-laya-engine';\nconst node = document.body;\n`,
  );
  try {
    assert.throws(
      () => auditMiniGameInputs([file], root),
      /Main\.ts:1 \[MINIGAME_BROWSER_API\].*pointer|Main\.ts:2 \[MINIGAME_BROWSER_API\]/i,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('mini-game source guard rejects dynamic public SDK imports', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-mini-dynamic-guard-'));
  const file = path.join(root, 'Main.ts');
  fs.writeFileSync(file, `const sdk = await import('zhuda-laya-engine');\nconsole.log(sdk);\n`);
  try {
    assert.throws(
      () => auditMiniGameInputs([file], root),
      /Main\.ts:1 \[MINIGAME_BROWSER_API\].*static public SDK import/i,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('toolchain resolver rejects a missing installation before invoking a build', () => {
  assert.throws(
    () => resolveMiniGameToolchain('/definitely/missing/layaair/3.4.2'),
    /ENOENT|no such file/i,
  );
});

test('mini-game settings: the syntax target and the orientation are checked, and say what they cannot do', async () => {
  const { resolveMiniGameSettings, applyMiniGameOrientation, MINIGAME_SYNTAX_TARGETS } =
    await import('../packages/compiler/zhuda-minigame.mjs');
  assert.deepEqual(resolveMiniGameSettings({}, 'wxgame'), {
    syntaxTarget: 'es2020',
    orientation: undefined,
  });
  assert.deepEqual(
    resolveMiniGameSettings(
      { minigame: { syntaxTarget: 'es2017', orientation: 'landscape' } },
      'wxgame',
    ),
    { syntaxTarget: 'es2017', orientation: 'landscape' },
  );
  assert.throws(
    () => resolveMiniGameSettings({ minigame: { syntaxTarget: 'es2015' } }, 'wxgame'),
    /zhuda\.config\.json:1 \[MINIGAME_SYNTAX\].*es2017/,
  );
  assert.throws(
    () => resolveMiniGameSettings({ minigame: { orientation: 'sideways' } }, 'wxgame'),
    /\[MINIGAME_ORIENTATION\]/,
  );
  // A signed package cannot be edited after the official tool has made it: refused, not ignored.
  assert.throws(
    () => resolveMiniGameSettings({ minigame: { orientation: 'landscape' } }, 'oppogame'),
    /\[MINIGAME_ORIENTATION\].*oppogame.*signs/,
  );
  assert.equal(
    resolveMiniGameSettings({ minigame: { syntaxTarget: 'es2017' } }, 'oppogame').syntaxTarget,
    'es2017',
  );

  const fs = await import('node:fs'),
    os = await import('node:os'),
    path = await import('node:path');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-minigame-'));
  try {
    assert.throws(() => applyMiniGameOrientation(out, 'landscape'), /no game\.json/);
    fs.writeFileSync(
      path.join(out, 'game.json'),
      JSON.stringify({ deviceOrientation: 'portrait', showStatusBar: false }),
    );
    fs.writeFileSync(path.join(out, 'project.config.json'), '{}');
    assert.deepEqual(applyMiniGameOrientation(out, 'landscape'), ['game.json']);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'game.json'), 'utf8')), {
      deviceOrientation: 'landscape',
      showStatusBar: false,
    });
    assert.equal(
      fs.readFileSync(path.join(out, 'project.config.json'), 'utf8'),
      '{}',
      'nothing else is touched',
    );
    fs.writeFileSync(path.join(out, 'game.json'), 'not json');
    assert.throws(() => applyMiniGameOrientation(out, 'portrait'), /not JSON/);
    assert.throws(() => applyMiniGameOrientation(out, 'upside-down'), /portrait/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }

  // The bundler lowers what a host that stops at ES2017 cannot read, for every target offered.
  const esbuild = (await import('esbuild')).default;
  const source =
    'export async function f(a, list) { for await (const x of list) a = a?.b ?? x; try { return a } catch { return { ...a } } }';
  for (const target of MINIGAME_SYNTAX_TARGETS) {
    const { code } = await esbuild.transform(source, { target, format: 'esm' });
    const lowered = !/\?\.|\?\?|for await/.test(code);
    assert.equal(lowered, target === 'es2017', `${target}: ${code.length} bytes`);
  }
});

test("the bundle is compared at the web build's syntax and lowered after that, or refused", async () => {
  const { MINIGAME_GATED_SYNTAX, MINIGAME_SYNTAX_TARGETS, lowerMiniGameScript } =
    await import('../packages/compiler/zhuda-minigame.mjs');
  const { CONSUMER_SYNTAX_TARGET } = await import('../packages/compiler/consumer-build.mjs');
  // The mini-game tool compares its bundle with the gated app.js character for character, so
  // both are built at one target; a lower target for the comparison made every export fail.
  assert.equal(MINIGAME_GATED_SYNTAX, CONSUMER_SYNTAX_TARGET);
  assert.equal(MINIGAME_GATED_SYNTAX, 'es2020');
  const tool = fs.readFileSync(
    new URL('../packages/compiler/zhuda-minigame.mjs', import.meta.url),
    'utf8',
  );
  const compare = tool.slice(
    tool.indexOf('const compiled = await esbuild.build('),
    tool.indexOf('MINIGAME_SOURCE_RACE'),
  );
  assert.match(compare, /target: MINIGAME_GATED_SYNTAX/);
  assert.doesNotMatch(compare, /target: syntaxTarget/);

  // A bundle as the web build writes it: an IIFE at es2020, with something from every year after 2017.
  const esbuild = (await import('esbuild')).default;
  const { code: gated } = await esbuild.transform(
    'export async function f(a, list) { for await (const x of list) a = a?.b ?? x; try { return a } catch { return { ...a } } } globalThis.f = f;',
    { target: MINIGAME_GATED_SYNTAX, format: 'iife', minify: true },
  );
  const newer = {
    es2018: [/for await/, /\{\.\.\./],
    es2019: [/catch\{/],
    es2020: [/\?\./, /\?\?/],
  };
  for (const list of Object.values(newer)) for (const syntax of list) assert.match(gated, syntax);
  assert.equal(await lowerMiniGameScript(gated, 'es2020'), gated, 'the gated target: untouched');
  for (const target of MINIGAME_SYNTAX_TARGETS) {
    const lowered = await lowerMiniGameScript(gated, target);
    // Nothing of a later year is left; what the target itself has may stay.
    for (const [year, list] of Object.entries(newer))
      for (const syntax of list)
        if (year > target) assert.doesNotMatch(lowered, syntax, `${target} keeps ${syntax}`);
    // It is still the same program.
    const run = new Function(`${lowered}; return globalThis.f;`);
    assert.equal(typeof run(), 'function', target);
  }

  // What has no older form is refused, with what it is and what to do, never passed on.
  await assert.rejects(
    lowerMiniGameScript('globalThis.n = 100000n;', 'es2017'),
    /zhuda\.config\.json:1 \[MINIGAME_SYNTAX\].*es2017.*Big integer literals.*raise minigame\.syntaxTarget/s,
  );
  assert.equal(
    await lowerMiniGameScript('globalThis.n = 100000n;', 'es2020'),
    'globalThis.n = 100000n;',
  );
  await assert.rejects(lowerMiniGameScript(gated, 'es2015'), /\[MINIGAME_SYNTAX\]/);
});

test('every source file of the engine lowers to the lowest syntax target a mini-game may ask for', async () => {
  // `minigame.syntaxTarget` promises a package an ES2017 engine can read. A game's own scripts are
  // its own affair, but nothing of the engine's may stand in the way: no file may hold syntax
  // that has no ES2017 form (a BigInt literal has none; the effect budget held some).
  const fs = await import('node:fs'),
    path = await import('node:path');
  const esbuild = (await import('esbuild')).default;
  const { MINIGAME_SYNTAX_TARGETS } = await import('../packages/compiler/zhuda-minigame.mjs');
  const lowest = MINIGAME_SYNTAX_TARGETS[0];
  assert.equal(lowest, 'es2017');
  const root = path.resolve('packages/core');
  const files = fs
    .readdirSync(root, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
  assert.ok(files.length > 150, `${files.length} files`);
  const refused = [];
  for (const file of files) {
    try {
      // What the bundler cannot lower it only warns about (a BigInt literal is left as it is):
      // a warning is a refusal here.
      const { warnings } = await esbuild.transform(fs.readFileSync(path.join(root, file), 'utf8'), {
        loader: 'ts',
        target: lowest,
        logLevel: 'silent',
      });
      if (warnings.length) refused.push(`${file}: ${warnings[0].text}`);
    } catch (error) {
      refused.push(`${file}: ${error.errors?.[0]?.text ?? error.message}`);
    }
  }
  assert.deepEqual(refused, []);
});
