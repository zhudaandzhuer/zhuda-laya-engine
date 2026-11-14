/**
 * How much of each clip a blend takes, for a value on a line (a speed: idle,
 * walk, run) or a point on a plane (a direction and a speed). Plain
 * arithmetic: the weights are never negative and add up to 1.
 */

/**
 * Weights for clips placed along a line at `positions` (ascending): the two
 * neighbours of `value` share it by how near each is; outside the ends the
 * end clip has it all.
 */
export function zhudaBlend1D(positions: readonly number[], value: number): number[] {
  if (!Array.isArray(positions) || !positions.length || positions.length > 32)
    throw Error('Blend: 1..32 positions');
  if (!positions.every(Number.isFinite) || positions.some((p, i) => i > 0 && p <= positions[i - 1]))
    throw Error('Blend: positions must be finite and ascending');
  if (!Number.isFinite(value)) throw Error('Blend: value must be finite');
  const weights = new Array<number>(positions.length).fill(0);
  if (value <= positions[0]) weights[0] = 1;
  else if (value >= positions[positions.length - 1]) weights[positions.length - 1] = 1;
  else {
    let upper = 1;
    while (positions[upper] < value) upper++;
    const share = (value - positions[upper - 1]) / (positions[upper] - positions[upper - 1]);
    weights[upper - 1] = 1 - share;
    weights[upper] = share;
  }
  return weights;
}

/**
 * Weights for clips placed on a plane at `points`, for the point `(x, y)`
 * (gradient bands: a clip's weight falls to nothing on the line through
 * each other clip square to the way to it). At a clip's own point the
 * clip has it all; between two clips they share it by distance.
 */
export function zhudaBlend2D(
  points: readonly (readonly [number, number])[],
  x: number,
  y: number,
): number[] {
  if (!Array.isArray(points) || !points.length || points.length > 32)
    throw Error('Blend: 1..32 points');
  if (!points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)))
    throw Error('Blend: each point is two finite numbers');
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('Blend: the point must be finite');
  for (let i = 0; i < points.length; i++)
    for (let j = 0; j < i; j++)
      if (points[i][0] === points[j][0] && points[i][1] === points[j][1])
        throw Error('Blend: two clips at one point');
  const weights = points.map((p, i) => {
    let weight = 1;
    for (let j = 0; j < points.length; j++) {
      if (j === i) continue;
      const wayX = points[j][0] - p[0],
        wayY = points[j][1] - p[1];
      const along = ((x - p[0]) * wayX + (y - p[1]) * wayY) / (wayX * wayX + wayY * wayY);
      weight = Math.min(weight, 1 - along);
    }
    return Math.max(0, weight);
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  // Outside every band (far beyond the clips): the nearest clip.
  if (!(total > 1e-12)) {
    let nearest = 0,
      best = Infinity;
    points.forEach((p, i) => {
      const d = (x - p[0]) ** 2 + (y - p[1]) ** 2;
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    return points.map((_, i) => (i === nearest ? 1 : 0));
  }
  return weights.map((w) => w / total);
}

/** Weights as given, made to add up to 1; all nothing is refused. */
export function zhudaNormalizeWeights(weights: readonly number[]): number[] {
  if (!Array.isArray(weights) || !weights.length) throw Error('Blend: at least one weight');
  if (!weights.every((w) => Number.isFinite(w) && w >= 0)) throw Error('Blend: weights 0 or more');
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (!(total > 0)) throw Error('Blend: every weight is 0');
  return weights.map((w) => w / total);
}

/**
 * How long one round of a blend lasts: clips of different lengths are kept
 * in step (a walk and a run put the same foot down together), so the round
 * is the lengths weighed by the weights.
 */
export function zhudaBlendSeconds(weights: readonly number[], seconds: readonly number[]): number {
  if (weights.length !== seconds.length) throw Error('Blend: a length for each weight');
  if (!seconds.every((s) => s > 0 && Number.isFinite(s))) throw Error('Blend: lengths above 0');
  const normal = zhudaNormalizeWeights(weights);
  return normal.reduce((sum, w, i) => sum + w * seconds[i], 0);
}
