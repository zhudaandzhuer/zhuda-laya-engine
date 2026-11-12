// Generated from TypeScript source; run npm run types:generate.
import type { ZhudaTextureRecipe } from '../procedural/TextureRecipe.js';
/**
 * The key a baked texture set is stored under in \`bakeCache\`: bake a recipe
 * yourself (in a worker, behind a progress bar), put the result in the map
 * under this key, and the mount uses it instead of baking again. The order
 * of a recipe's properties does not change the key.
 */
export declare function zhudaBakeKey(recipe: ZhudaTextureRecipe, size: number): string;
