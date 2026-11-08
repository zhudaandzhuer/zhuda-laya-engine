import type { ZhudaBitmapFontManifest, ZhudaBitmapFontValidationReport } from '../types/zhuda-static-assets.ts';

const finite = (value: unknown, name: string, issues: string[]): value is number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) { issues.push(`${name} must be finite.`); return false; }
  return true;
};

/** Validates authored art-text metadata before a Laya BitmapFont is registered. */
export function validateZhudaBitmapFont(
  manifest: ZhudaBitmapFontManifest,
  requiredText = ''
): ZhudaBitmapFontValidationReport {
  const issues: string[] = [];
  if (!manifest || manifest.schemaVersion !== 1) issues.push('schemaVersion must be 1.');
  if (!manifest?.id) issues.push('id is required.');
  if (!manifest?.textureId) issues.push('textureId is required.');
  for (const [name, value] of Object.entries({fontSize: manifest?.fontSize, lineHeight: manifest?.lineHeight, baseline: manifest?.baseline})) {
    if (finite(value, name, issues) && value <= 0 && name !== 'baseline') issues.push(`${name} must be greater than zero.`);
  }
  const glyphs = Array.isArray(manifest?.glyphs) ? manifest.glyphs : [];
  if (!glyphs.length) issues.push('glyphs must contain at least one glyph.');
  const seen = new Set<string>();
  const widths = new Map<string, number>();
  for (const glyph of glyphs) {
    if (!glyph || typeof glyph.char !== 'string' || [...glyph.char].length !== 1) { issues.push('each glyph must contain exactly one Unicode character.'); continue; }
    if (seen.has(glyph.char)) issues.push(`duplicate glyph: ${glyph.char}`);
    seen.add(glyph.char);
    for (const [name, value] of Object.entries({x:glyph.x,y:glyph.y,width:glyph.width,height:glyph.height,xAdvance:glyph.xAdvance})) finite(value, `glyph(${glyph.char}).${name}`, issues);
    if (glyph.width < 0 || glyph.height < 0 || glyph.xAdvance < 0) issues.push(`glyph(${glyph.char}) dimensions cannot be negative.`);
    widths.set(glyph.char, glyph.xAdvance);
  }
  const fallback = manifest?.fallbackChar;
  if (fallback !== undefined && (!seen.has(fallback) || [...fallback].length !== 1)) issues.push('fallbackChar must reference one declared glyph.');
  const missingCharacters = [...new Set([...requiredText].filter(char => !seen.has(char) && char !== '\n' && char !== '\r'))];
  if (missingCharacters.length && !fallback) issues.push(`missing glyphs: ${missingCharacters.join('')}`);
  let measuredWidth = 0;
  for (const line of requiredText.split(/\r?\n/)) {
    const lineWidth = [...line].reduce((sum, char) => sum + (widths.get(char) ?? widths.get(fallback ?? '') ?? 0), 0);
    measuredWidth = Math.max(measuredWidth, lineWidth);
  }
  // A declared fallback is an intentional, deterministic replacement for
  // missing authored glyphs. Keep the list in the report for QA, but do not
  // fail registration when that fallback was validated above.
  return {passed: issues.length === 0 && (missingCharacters.length === 0 || !!fallback), issues, glyphCount: seen.size, missingCharacters, measuredWidth};
}

/** Deterministic art-text width using the authored advance values, including fallback glyphs. */
export function measureZhudaBitmapText(manifest: ZhudaBitmapFontManifest, text: string): {width: number; height: number; lines: number} {
  const report = validateZhudaBitmapFont(manifest, text);
  const advances = new Map(manifest.glyphs.map(g => [g.char, g.xAdvance]));
  const fallback = manifest.fallbackChar ? advances.get(manifest.fallbackChar) ?? 0 : 0;
  const lines = text.split(/\r?\n/);
  const width = Math.max(...lines.map(line => [...line].reduce((sum, char) => sum + (advances.get(char) ?? fallback), 0)), 0);
  return {width: Number(width.toFixed(4)), height: lines.length * manifest.lineHeight, lines: lines.length};
}

/**
 * Creates and registers the vendor BitmapFont from the same authored manifest
 * used by the preview and measurement contracts. The texture is supplied by
 * the consumer's AssetProvider, so the engine never creates a second asset
 * cache or guesses a URL.
 */
export function createZhudaBitmapFont(
  manifest: ZhudaBitmapFontManifest,
  texture: Laya.Texture,
  requiredText = ''
): Laya.BitmapFont {
  const report = validateZhudaBitmapFont(manifest, requiredText);
  if (!report.passed) throw new Error(`Bitmap font ${manifest?.id || '<unknown>'} failed validation: ${report.issues.join('; ') || `missing glyphs: ${report.missingCharacters.join('')}`}`);
  const L = (globalThis as typeof globalThis & { Laya?: typeof Laya }).Laya;
  if (!L?.BitmapFont || !L.Text?.registerBitmapFont) throw new Error('Laya.BitmapFont is unavailable in this runtime.');
  const font = new L.BitmapFont();
  font.texture = texture;
  font.fontSize = manifest.fontSize;
  font.lineHeight = manifest.lineHeight;
  font.autoScaleSize = false;
  font.padding = [0, 0, 0, 0];
  const dict: Record<string, { x: number; y: number; width: number; height: number; advance: number }> = {};
  for (const glyph of manifest.glyphs) {
    dict[glyph.char] = {
      x: glyph.x,
      y: glyph.y,
      width: glyph.width,
      height: glyph.height,
      advance: glyph.xAdvance
    };
    if (glyph.xOffset !== undefined || glyph.yOffset !== undefined) {
      (dict[glyph.char] as Record<string, number>).xOffset = glyph.xOffset ?? 0;
      (dict[glyph.char] as Record<string, number>).yOffset = glyph.yOffset ?? 0;
    }
  }
  font.dict = dict;
  L.Text.registerBitmapFont(manifest.id, font);
  return font;
}

/** Unregisters a font created by createZhudaBitmapFont and releases its owner. */
export function unregisterZhudaBitmapFont(id: string, destroy = true): void {
  if (!id) throw new Error('Bitmap font id is required.');
  const L = (globalThis as typeof globalThis & { Laya?: typeof Laya }).Laya;
  if (!L?.Text?.unregisterBitmapFont) throw new Error('Laya.Text bitmap-font registry is unavailable in this runtime.');
  L.Text.unregisterBitmapFont(id, destroy);
}
