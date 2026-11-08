import test from 'node:test';
import assert from 'node:assert/strict';
import { computeZhudaGridLayout, computeZhudaTextLayout } from '../packages/core/ResponsiveLayout.ts';

test('grid layout stays in design coordinates and respects safe area', () => {
  const report = computeZhudaGridLayout({
    viewport: {width: 1170, height: 720}, design: {width: 390, height: 240},
    safeArea: {left: 30, right: 30}, columns: 3, rows: 2, gapX: 6, gapY: 4,
    padding: {top: 8, right: 8, bottom: 8, left: 8}, scaleMode: 'showall'
  });
  assert.equal(report.cells.length, 6);
  assert.equal(report.overflow, false);
  assert.ok(Math.abs(report.cells[0].x - (30 + (1170 - 60 - 390 * report.scale) / 2 + 8 * report.scale)) < 0.001);
  assert.ok(report.cells.every(cell => cell.x >= report.safeRect.x && cell.y >= report.safeRect.y));
});

test('text layout centers measured glyphs and reports overflow instead of hiding it', () => {
  const fit = computeZhudaTextLayout({
    box: {x: 10, y: 20, width: 200, height: 60}, metrics: {width: 300, height: 30, baseline: 22},
    align: 'center', valign: 'middle', scaleToFit: true
  });
  assert.ok(Math.abs(fit.scale - 2 / 3) < 0.000001);
  assert.equal(fit.overflow, false);
  assert.equal(fit.rect.x, 10);
  assert.ok(fit.baselineY > fit.rect.y);

  const overflow = computeZhudaTextLayout({
    box: {x: 0, y: 0, width: 40, height: 20}, metrics: {width: 80, height: 24, baseline: 17}, align: 'left', valign: 'top'
  });
  assert.equal(overflow.overflow, true);
});

test('invalid grid dimensions fail closed', () => {
  assert.throws(() => computeZhudaGridLayout({viewport: {width: 100, height: 100}, design: {width: 100, height: 100}, columns: 0, rows: 1}), /columns/);
  assert.throws(() => computeZhudaGridLayout({viewport: {width: 100, height: 100}, design: {width: 10, height: 10}, columns: 1, rows: 1, padding: {left: 6, right: 6}}), /no cell/);
});
