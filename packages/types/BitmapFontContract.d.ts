// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaBitmapFontManifest, ZhudaBitmapFontValidationReport } from './zhuda-static-assets.js';
/** Validates authored art-text metadata before a Laya BitmapFont is registered. */
export declare function validateZhudaBitmapFont(manifest: ZhudaBitmapFontManifest, requiredText?: string): ZhudaBitmapFontValidationReport;
/** Deterministic art-text width using the authored advance values, including fallback glyphs. */
export declare function measureZhudaBitmapText(manifest: ZhudaBitmapFontManifest, text: string): {
    width: number;
    height: number;
    lines: number;
};
/**
 * Creates and registers the vendor BitmapFont from the same authored manifest
 * used by the preview and measurement contracts. The texture is supplied by
 * the consumer's AssetProvider, so the engine never creates a second asset
 * cache or guesses a URL.
 */
export declare function createZhudaBitmapFont(manifest: ZhudaBitmapFontManifest, texture: Laya.Texture, requiredText?: string): Laya.BitmapFont;
/** Unregisters a font created by createZhudaBitmapFont and releases its owner. */
export declare function unregisterZhudaBitmapFont(id: string, destroy?: boolean): void;
