// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaPropDefinition } from '../procedural/PropFactory.js';
import type { ZhudaSynthRecipe } from '../procedural/SynthAudio.js';
import type { ZhudaTextureRecipe } from '../procedural/TextureRecipe.js';
export declare const ZHUDA_STARTER_TEXTURES: Record<string, ZhudaTextureRecipe>;
export declare const ZHUDA_STARTER_PROPS: readonly [ZhudaPropDefinition<{
    paint: string;
}>, ZhudaPropDefinition<{
    boards: number;
}>, ZhudaPropDefinition<Record<string, never>>];
export declare const ZHUDA_STARTER_SOUNDS: Record<string, ZhudaSynthRecipe>;
