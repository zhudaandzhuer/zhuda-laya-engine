import type { MeshData } from "../runtime3d/Surfaces";
import type { QueryRay } from "../runtime3d/SceneQueries";
/** Two-sided ray intersection; distance follows the supplied ray parameter. */
export declare function shellTriangleDistance(ray: QueryRay, p: Float32Array, a: number, b: number, c: number): number | null;
/** Clockwise Laya faces. Extrudes along local -Y; the underside follows the top. */
export declare function buildTerrainShell(top: Float32Array, xs: number[], zs: number[], depth: number): MeshData;
