import type {
  ZhudaGridLayoutReport,
  ZhudaGridLayoutSpec,
  ZhudaLayoutInsets,
  ZhudaLayoutRect,
  ZhudaTextLayoutReport,
  ZhudaTextLayoutSpec,
} from '../types/zhuda-layout.ts';

const finite = (value: number, name: string): number => {
  if (!Number.isFinite(value)) throw new Error(`Invalid ${name}.`);
  return value;
};

const positive = (value: number, name: string): number => {
  finite(value, name);
  if (value <= 0) throw new Error(`${name} must be greater than zero.`);
  return value;
};

const insets = (value: Partial<ZhudaLayoutInsets> | undefined): ZhudaLayoutInsets => ({
  top: Math.max(0, finite(value?.top ?? 0, 'insets.top')),
  right: Math.max(0, finite(value?.right ?? 0, 'insets.right')),
  bottom: Math.max(0, finite(value?.bottom ?? 0, 'insets.bottom')),
  left: Math.max(0, finite(value?.left ?? 0, 'insets.left')),
});

const rect = (x: number, y: number, width: number, height: number): ZhudaLayoutRect => ({
  x: Number(x.toFixed(4)),
  y: Number(y.toFixed(4)),
  width: Number(width.toFixed(4)),
  height: Number(height.toFixed(4)),
});

/**
 * Computes all positions in design pixels. DPR only changes the backing canvas;
 * it never enters this calculation. The same report can therefore drive a
 * Prefab preview and the assembled Scene without a second coordinate formula.
 */
export function computeZhudaGridLayout(spec: ZhudaGridLayoutSpec): ZhudaGridLayoutReport {
  const viewportWidth = positive(spec.viewport.width, 'viewport.width');
  const viewportHeight = positive(spec.viewport.height, 'viewport.height');
  const designWidth = positive(spec.design.width, 'design.width');
  const designHeight = positive(spec.design.height, 'design.height');
  if (!Number.isInteger(spec.columns) || spec.columns < 1)
    throw new Error('columns must be a positive integer.');
  if (!Number.isInteger(spec.rows) || spec.rows < 1)
    throw new Error('rows must be a positive integer.');

  const safe = insets(spec.safeArea);
  const padding = insets(spec.padding);
  const safeWidth = Math.max(0, viewportWidth - safe.left - safe.right);
  const safeHeight = Math.max(0, viewportHeight - safe.top - safe.bottom);
  const mode = spec.scaleMode ?? 'showall';
  const sx = safeWidth / designWidth;
  const sy = safeHeight / designHeight;
  const scale = mode === 'none' ? 1 : mode === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Unable to compute layout scale.');

  const scaledDesign = rect(
    safe.left + (safeWidth - designWidth * scale) / 2,
    safe.top + (safeHeight - designHeight * scale) / 2,
    designWidth * scale,
    designHeight * scale,
  );
  const designViewport = rect(0, 0, designWidth, designHeight);
  const safeRect = rect(safe.left, safe.top, safeWidth, safeHeight);
  const gapX = Math.max(0, finite(spec.gapX ?? 0, 'gapX'));
  const gapY = Math.max(0, finite(spec.gapY ?? 0, 'gapY'));
  const innerWidth = designWidth - padding.left - padding.right - gapX * (spec.columns - 1);
  const innerHeight = designHeight - padding.top - padding.bottom - gapY * (spec.rows - 1);
  if (innerWidth <= 0 || innerHeight <= 0)
    throw new Error('Grid padding and gaps leave no cell space.');
  const cellWidth = innerWidth / spec.columns;
  const cellHeight = innerHeight / spec.rows;
  const cells: ZhudaLayoutRect[] = [];
  for (let row = 0; row < spec.rows; row++) {
    for (let column = 0; column < spec.columns; column++) {
      cells.push(
        rect(
          scaledDesign.x + (padding.left + column * (cellWidth + gapX)) * scale,
          scaledDesign.y + (padding.top + row * (cellHeight + gapY)) * scale,
          cellWidth * scale,
          cellHeight * scale,
        ),
      );
    }
  }
  const overflow =
    mode === 'cover' &&
    (scaledDesign.x < safe.left ||
      scaledDesign.y < safe.top ||
      scaledDesign.x + scaledDesign.width > safe.left + safeWidth ||
      scaledDesign.y + scaledDesign.height > safe.top + safeHeight);
  return { scale: Number(scale.toFixed(6)), designViewport, safeRect, cells, overflow };
}

/** Aligns measured Laya text metrics inside an authored design-space box. */
export function computeZhudaTextLayout(spec: ZhudaTextLayoutSpec): ZhudaTextLayoutReport {
  const box = spec.box;
  const metrics = spec.metrics;
  for (const [name, value] of Object.entries({
    'box.x': box.x,
    'box.y': box.y,
    'box.width': box.width,
    'box.height': box.height,
    'metrics.width': metrics.width,
    'metrics.height': metrics.height,
    'metrics.baseline': metrics.baseline,
  }))
    finite(value, name);
  if (box.width < 0 || box.height < 0 || metrics.width < 0 || metrics.height < 0)
    throw new Error('Text layout dimensions cannot be negative.');
  const padding = insets(spec.padding);
  const contentWidth = Math.max(0, box.width - padding.left - padding.right);
  const contentHeight = Math.max(0, box.height - padding.top - padding.bottom);
  const rawScale = Math.min(
    1,
    metrics.width > 0 ? contentWidth / metrics.width : 1,
    metrics.height > 0 ? contentHeight / metrics.height : 1,
  );
  const minScale = Math.max(0, Math.min(1, spec.minScale ?? 0.5));
  const scale = spec.scaleToFit ? Math.max(minScale, rawScale) : 1;
  const width = metrics.width * scale;
  const height = metrics.height * scale;
  const align = spec.align ?? 'left';
  const valign = spec.valign ?? 'top';
  const x =
    align === 'center'
      ? padding.left + (contentWidth - width) / 2
      : align === 'right'
        ? box.width - padding.right - width
        : padding.left;
  const y =
    valign === 'middle'
      ? padding.top + (contentHeight - height) / 2
      : valign === 'bottom'
        ? box.height - padding.bottom - height
        : padding.top;
  return {
    rect: rect(box.x + x, box.y + y, width, height),
    scale: Number(scale.toFixed(6)),
    baselineX: Number(
      (box.x + x + (align === 'center' ? width / 2 : align === 'right' ? width : 0)).toFixed(4),
    ),
    baselineY: Number((box.y + y + metrics.baseline * scale).toFixed(4)),
    overflow: width > contentWidth + 0.0001 || height > contentHeight + 0.0001,
  };
}
