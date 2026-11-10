/**
 * Review sheet for film shots, composed with Laya 2D: each shot becomes a
 * texture on a `Laya.Sprite`, labels are `Laya.Text`, and the sheet is drawn
 * into a `RenderTexture2D` and read back. Requires the Laya runtime.
 */
import { createSurfaceTexture } from '../runtime3d/Surfaces.ts';

export interface ZhudaFilmReviewShot {
  label: string;
  /** Top-left RGBA8, opaque sRGB (as returned by the film renderer). */
  frame: { width: number; height: number; rgba: Uint8Array };
}

export interface ZhudaFilmReviewSheet {
  width: number;
  height: number;
  /** Top-left RGBA8, opaque sRGB. */
  rgba: Uint8Array;
  cells: { label: string; x: number; y: number; width: number; height: number }[];
}

/** One to four shots of the same size: one column for a single shot, otherwise two. */
export async function composeZhudaFilmReview(
  shots: readonly ZhudaFilmReviewShot[],
  options: { gap?: number } = {},
): Promise<ZhudaFilmReviewSheet> {
  const l = (globalThis as any).Laya;
  if (!l?.Sprite) throw Error('Film review needs the Laya runtime');
  if (!Array.isArray(shots) || shots.length < 1 || shots.length > 4)
    throw Error('A review sheet takes one to four shots');
  const { width, height } = shots[0].frame;
  for (const shot of shots)
    if (shot.frame.width !== width || shot.frame.height !== height)
      throw Error('Every review shot must have the same size');
  const gap = options.gap ?? 4,
    columns = shots.length === 1 ? 1 : 2,
    rows = Math.ceil(shots.length / columns),
    sheetWidth = columns * width + (columns - 1) * gap,
    sheetHeight = rows * height + (rows - 1) * gap;
  const owned: { destroy(): void }[] = [];
  const root = new l.Sprite();
  let target: any;
  try {
    root.size(sheetWidth, sheetHeight);
    root.graphics.drawRect(0, 0, sheetWidth, sheetHeight, '#111111');
    const cells: ZhudaFilmReviewSheet['cells'] = [];
    shots.forEach((shot, i) => {
      const x = (i % columns) * (width + gap),
        y = Math.floor(i / columns) * (height + gap);
      // The 2D render target encodes its output to sRGB, so the shot is
      // uploaded as sRGB colour: decode on sampling, encode on write.
      const texture2D = createSurfaceTexture(width, height, shot.frame.rgba, 'color');
      const texture = new l.Texture(texture2D);
      owned.push(texture, texture2D);
      root.graphics.drawTexture(texture, x, y, width, height);
      const label = new l.Text();
      label.text = shot.label;
      label.fontSize = 14;
      label.bold = true;
      label.color = '#ffffff';
      label.pos(x + 12, y + 10);
      const plate = new l.Sprite();
      plate.graphics.drawRect(x + 6, y + 6, Math.ceil(label.textWidth) + 12, 22, '#000000');
      plate.alpha = 0.65;
      root.addChild(plate);
      root.addChild(label);
      cells.push({ label: shot.label, x, y, width, height });
    });
    target = root.drawToRenderTexture2D(sheetWidth, sheetHeight, 0, 0, null, false);
    const rgba = new Uint8Array(sheetWidth * sheetHeight * 4);
    await target.getDataAsync(0, 0, sheetWidth, sheetHeight, rgba);
    // A 2D render target reads back bottom-up; return top-left rows like the capture.
    const flipped = new Uint8Array(rgba.length),
      row = sheetWidth * 4;
    for (let y = 0; y < sheetHeight; y++)
      flipped.set(rgba.subarray((sheetHeight - 1 - y) * row, (sheetHeight - y) * row), y * row);
    for (let i = 3; i < flipped.length; i += 4) flipped[i] = 255;
    return { width: sheetWidth, height: sheetHeight, rgba: flipped, cells };
  } finally {
    target?.destroy();
    root.destroy(true);
    for (const resource of owned) resource.destroy();
  }
}
