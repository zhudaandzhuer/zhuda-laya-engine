// The ground a walker walks on, as two questions any island can answer, and the
// one rule for a step: take it whole, else slide along what cannot be walked.
// No engine here, so the rule can be checked against an island without a browser.

/** What a walker needs to know of the ground it walks on (createGardenIsland's handle is one). */
export interface WalkWorld {
  /** Height of what is underfoot at a place (null: off the map; the walker then stands at 0). */
  groundAt(x: number, z: number): number | null;
  /** Whether a place may be stood on. */
  walkable(x: number, z: number): boolean;
}

/**
 * A step from (x, z) toward (nx, nz): the whole step if it lands on walkable ground,
 * else only its x part, else only its z part (sliding along a shore or a wall),
 * else null (blocked).
 */
export function slide(world: WalkWorld, x: number, z: number, nx: number, nz: number): [number, number] | null {
  if (world.walkable(nx, nz)) return [nx, nz];
  if (world.walkable(nx, z)) return [nx, z];
  if (world.walkable(x, nz)) return [x, nz];
  return null;
}
