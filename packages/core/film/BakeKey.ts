import type { ZhudaTextureRecipe } from '../procedural/TextureRecipe.ts';

/**
 * The key a baked texture set is stored under in \`bakeCache\`: bake a recipe
 * yourself (in a worker, behind a progress bar), put the result in the map
 * under this key, and the mount uses it instead of baking again. The order
 * of a recipe's properties does not change the key.
 */
export function zhudaBakeKey(recipe: ZhudaTextureRecipe, size: number): string {
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value as object)
              .sort()
              .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
          )
        : value;
  return `${size}:${JSON.stringify(stable(recipe))}`;
}
