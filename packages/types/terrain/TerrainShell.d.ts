// Generated from TypeScript source; run npm run types:generate.
import type { MeshData } from '../runtime3d/Surfaces.js';
import type { QueryRay } from '../runtime3d/SceneQueries.js';
/** Two-sided ray intersection; distance follows the supplied ray parameter. */
export declare function shellTriangleDistance(ray: QueryRay, p: Float32Array, a: number, b: number, c: number): number | null;
/** Clockwise Laya faces. Extrudes along local -Y; the underside follows the top. */
/** `stride` is the floats per vertex of `top`: 8, or 12 when it carries tangents. */
export declare function buildTerrainShell(top: Float32Array, xs: number[], zs: number[], depth: number, stride?: number): MeshData;
