import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createZhudaBitmapFont,
  measureZhudaBitmapText,
  unregisterZhudaBitmapFont,
  validateZhudaBitmapFont,
} from '../packages/core/BitmapFontContract.ts';

const manifest = {
  schemaVersion: 1,
  id: 'slot-numbers',
  textureId: 'fonts/slot-numbers.png',
  fontSize: 64,
  lineHeight: 72,
  baseline: 54,
  fallbackChar: '?',
  glyphs: [
    { char: '1', x: 0, y: 0, width: 28, height: 54, xAdvance: 30 },
    { char: '2', x: 28, y: 0, width: 32, height: 54, xAdvance: 34 },
    { char: '?', x: 60, y: 0, width: 32, height: 54, xAdvance: 34 },
  ],
};

test('bitmap font manifest validates glyph coverage and measures authored advances', () => {
  const report = validateZhudaBitmapFont(manifest, '12');
  assert.equal(report.passed, true);
  assert.equal(report.measuredWidth, 64);
  assert.deepEqual(measureZhudaBitmapText(manifest, '12\n1'), { width: 64, height: 144, lines: 2 });
});

test('bitmap font validation rejects duplicate and missing glyphs', () => {
  const duplicate = { ...manifest, glyphs: [...manifest.glyphs, { ...manifest.glyphs[0] }] };
  const duplicateReport = validateZhudaBitmapFont(duplicate, '1');
  assert.equal(duplicateReport.passed, false);
  assert.match(duplicateReport.issues.join(';'), /duplicate glyph/);

  const missing = {
    ...manifest,
    fallbackChar: undefined,
    glyphs: manifest.glyphs.filter((g) => g.char !== '2'),
  };
  const missingReport = validateZhudaBitmapFont(missing, '12');
  assert.deepEqual(missingReport.missingCharacters, ['2']);
  assert.equal(missingReport.passed, false);
});

test('declared fallback covers missing glyphs while retaining QA telemetry', () => {
  const report = validateZhudaBitmapFont(manifest, '1X2');
  assert.deepEqual(report.missingCharacters, ['X']);
  assert.equal(report.passed, true);
  assert.equal(measureZhudaBitmapText(manifest, '1X2').width, 98);
});

test('bitmap font registration uses the vendor registry and unregisters cleanly', () => {
  const previous = globalThis.Laya;
  const registered = new Map();
  class FakeBitmapFont {
    dict = {};
  }
  globalThis.Laya = {
    BitmapFont: FakeBitmapFont,
    Texture: class {},
    Text: {
      registerBitmapFont(id, font) {
        registered.set(id, font);
      },
      unregisterBitmapFont(id) {
        registered.delete(id);
      },
    },
  };
  try {
    const font = createZhudaBitmapFont(manifest, {}, '12');
    assert.equal(font.fontSize, 64);
    assert.equal(font.dict['1'].advance, 30);
    assert.equal(registered.get('slot-numbers'), font);
    unregisterZhudaBitmapFont('slot-numbers');
    assert.equal(registered.has('slot-numbers'), false);
  } finally {
    globalThis.Laya = previous;
  }
});
