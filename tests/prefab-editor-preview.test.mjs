import { authorizedFetch } from './helpers/editor-request.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrefabEditorPreviewSession } from '../packages/compiler/prefab-editor-preview.ts';
import {
  buildPrefabEditorController,
  createPrefabEditorServer,
  parsePrefabEditorArgs,
  buildPrefabEditorBundle,
} from '../packages/compiler/prefab-editor-server.mjs';

const turn = () => new Promise((resolve) => setImmediate(resolve));
function fixture(session) {
  const listeners = new Set();
  const target = {
    on(type, owner, fn) {
      listeners.add(fn);
    },
    off(type, owner, fn) {
      listeners.delete(fn);
    },
  };
  const child = { name: 'Child' };
  const context = session.context({
    root: { getChildByName: (name) => (name === 'Child' ? child : null) },
    stage: target,
    canvas: {},
    runtime: {},
    assetPath: 'assets/fixture.lh',
    assetUrl: (id) => '/assets/' + id,
  });
  return { context, listeners, target, child };
}

test('Play ownership retires listeners/resources in reverse order over 30 cycles', async () => {
  for (let i = 0; i < 30; i++) {
    const session = new PrefabEditorPreviewSession(),
      { context, target, listeners, child } = fixture(session),
      order = [];
    assert.equal(context.find('Child'), child);
    assert.throws(() => context.find('Missing'), /Missing/);
    await session.mount(async () => {
      context.listen(target, 'click', () => {});
      context.onDispose(() => order.push('resource'));
      return {
        dispose() {
          order.push('controller');
        },
      };
    });
    assert.equal(listeners.size, 1);
    session.dispose();
    session.dispose();
    assert.deepEqual(order, ['controller', 'resource']);
    assert.equal(listeners.size, 0);
    assert.equal(context.signal.aborted, true);
    assert.throws(() => context.find('Child'), /stopped/);
    context.onDispose(() => order.push('late'));
    assert.deepEqual(order, ['controller', 'resource', 'late']);
  }
});

test('failed, invalid and timed-out mounts release already acquired ownership', async () => {
  for (const mode of ['failure', 'invalid', 'timeout']) {
    const session = new PrefabEditorPreviewSession(),
      { context, target, listeners } = fixture(session);
    let released = 0;
    const pending = session.mount(async () => {
      context.listen(target, 'click', () => {});
      context.onDispose(() => released++);
      if (mode === 'failure') throw Error('fixture failure');
      if (mode === 'invalid') return {};
      return new Promise(() => {});
    }, 20);
    await assert.rejects(
      pending,
      mode === 'failure' ? /fixture failure/ : mode === 'invalid' ? /disposable/ : /deadline/,
    );
    assert.equal(released, 1);
    assert.equal(listeners.size, 0);
    assert.equal(session.signal.aborted, true);
  }
});

test('Stop aborts a non-cooperative mount and disposes its late result once', async () => {
  const session = new PrefabEditorPreviewSession(),
    { context } = fixture(session);
  let complete,
    released = 0;
  const pending = session.mount(
    async () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  await turn();
  session.dispose();
  await assert.rejects(pending, /stopped/);
  complete({
    dispose() {
      released++;
    },
  });
  await turn();
  assert.equal(released, 1);
  context.onDispose(() => released++);
  assert.equal(released, 2);
});

test('cleanup failure cannot retain later resources or prevent idempotent Stop', () => {
  const session = new PrefabEditorPreviewSession();
  let released = 0;
  session.own(() => released++);
  session.own(() => {
    throw Error('cleanup fixture');
  });
  session.dispose();
  session.dispose();
  assert.equal(released, 1);
  assert.equal(session.errors.length, 1);
});

test('editor controller is opt-in, project confined and shares the public SDK', async () => {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuda-editor-controller-'));
  try {
    await fs.mkdir(path.join(project, 'assets'));
    await fs.writeFile(
      path.join(project, 'assets/a.lh'),
      JSON.stringify({ _$id: 'root', _$type: 'Sprite', name: 'Root', width: 320, height: 180 }),
    );
    assert.equal(await buildPrefabEditorController({ projectRoot: project }), null);
    await fs.writeFile(
      path.join(project, 'zhuda.editor.ts'),
      `import { IframeSoundAdapter } from 'zhuda-laya-engine'; export function mount(){const audio=new IframeSoundAdapter();return {dispose(){audio.dispose()}}}`,
    );
    const controller = await buildPrefabEditorController({ projectRoot: project });
    assert.equal(controller.path, 'zhuda.editor.ts');
    assert.match(controller.code, /from "\/__editor\/sdk.js"/);
    await assert.rejects(
      buildPrefabEditorController({ projectRoot: project, previewController: '../escape.ts' }),
      /escapes/,
    );
    await assert.rejects(
      buildPrefabEditorController({ projectRoot: project, previewController: 'missing.ts' }),
      /does not exist: missing.ts/,
    );
    await fs.writeFile(
      path.join(project, 'private.ts'),
      `import {ZhudaEngine} from 'zhuda-laya-engine/core';export const mount=()=>ZhudaEngine;`,
    );
    await assert.rejects(
      buildPrefabEditorController({ projectRoot: project, previewController: 'private.ts' }),
      /public zhuda-laya-engine/,
    );
    assert.throws(
      () =>
        parsePrefabEditorArgs([
          '--project',
          project,
          '--prefab',
          'assets/a.lh',
          '--preview-controller',
        ]),
      /needs/,
    );
    const bundle = await buildPrefabEditorBundle();
    assert.match(bundle, /from "\/__editor\/sdk.js"/);
    const editor = await createPrefabEditorServer({
      projectRoot: project,
      prefab: 'assets/a.lh',
      port: 0,
      bundle,
    });
    try {
      const { port } = await editor.listening,
        base = `http://127.0.0.1:${port}`;
      const config = await (await authorizedFetch(editor, base + '/api/editor')).json();
      assert.equal(config.previewController.path, 'zhuda.editor.ts');
      assert.match(
        await (await authorizedFetch(editor, base + config.previewController.url)).text(),
        /mount/,
      );
      assert.equal((await authorizedFetch(editor, base + '/__editor/sdk.js')).status, 200);
      assert.match(await (await authorizedFetch(editor, base)).text(), /id="play"/);
    } finally {
      await editor.close();
    }
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('strict external controller can use the public preview and audio contracts', async () => {
  const ts = (await import('typescript')).default;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuda-preview-types-'));
  try {
    await fs.mkdir(path.join(root, 'node_modules'));
    await fs.symlink(path.resolve('.'), path.join(root, 'node_modules/zhuda-laya-engine'), 'dir');
    const file = path.join(root, 'controller.ts');
    await fs.writeFile(
      file,
      `import {IframeSoundAdapter} from 'zhuda-laya-engine';
      import type {ZhudaPrefabEditorPreviewModule,ZhudaPrefabEditorPreviewContext} from 'zhuda-laya-engine';
      export const mount:ZhudaPrefabEditorPreviewModule['mount']=async(ctx:ZhudaPrefabEditorPreviewContext)=>{
        const label=ctx.find<Laya.Text>('Panel/Percent');const mixer=new IframeSoundAdapter();
        ctx.onDispose(()=>mixer.dispose());ctx.listen(ctx.stage,'mouseup',()=>{label.text='50';mixer.setChannelVolume('master',.5)});
        const url:string=ctx.assetUrl('audio/click.mp3');const signal:AbortSignal=ctx.signal;void [url,signal,ctx.runtime.clock];
        return {dispose(){}};
      };`,
    );
    const program = ts.createProgram([file], {
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      types: [],
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => root,
        getCanonicalFileName: (f) => f,
        getNewLine: () => '\n',
      }),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
