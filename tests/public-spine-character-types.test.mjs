import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

test('strict consumer can drive a Spine character through the public package', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-spine-character-types-'));
  try {
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.symlinkSync(
      path.resolve('.'),
      path.join(root, 'node_modules/zhuda-laya-engine'),
      'junction',
    );
    const file = path.join(root, 'consumer.ts');
    fs.writeFileSync(
      file,
      `
      import { ZhudaSpineCharacter, zhudaSpineFromCanvas, zhudaSpineToCanvas, ZHUDA_SPINE_PHYSICS_UPDATE } from 'zhuda-laya-engine';
      import type { ZhudaSpineBounds, ZhudaSpineCharacterOptions, ZhudaSpineDiagnostics } from 'zhuda-laya-engine';
      declare const parent: Laya.Sprite;
      declare const templet: Laya.SpineTemplet;
      const options: ZhudaSpineCharacterOptions = { parent, templet, animation: 'idle', loop: true, physics: true };
      const character = new ZhudaSpineCharacter(options);
      character.update();
      const tip: [number, number] = character.boneTipCanvas('pleat4_3');
      character.moveBoneTo('grab4', tip[0], tip[1] - 40);
      character.setIkMix('grab4_ik', 1);
      character.nudgeBone('pull_knee', -12, 4);
      character.setAttachment('tear_knee', 'tear_knee_small');
      character.setAttachment('tear_knee', null);
      const [cx, cy] = character.stageToCanvas(10, 20);
      const bounds: ZhudaSpineBounds = character.bounds;
      const back = zhudaSpineToCanvas(bounds, ...zhudaSpineFromCanvas(bounds, cx, cy));
      const report: ZhudaSpineDiagnostics = character.diagnostics();
      const mode: number = ZHUDA_SPINE_PHYSICS_UPDATE;
      character.dispose();
      void [back, report, mode];
    `,
    );
    const program = ts.createProgram([file], {
      noEmit: true,
      strict: true,
      skipLibCheck: false,
      types: [],
      target: ts.ScriptTarget.ES2020,
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
    fs.rmSync(root, { recursive: true, force: true });
  }
});
