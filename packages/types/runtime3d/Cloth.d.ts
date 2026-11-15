// Generated from TypeScript source; run npm run types:generate.
/**
 * A cloth that is drawn: a `ZhudaClothSolver` and the `ZhudaDynamicMesh` it
 * moves. The solver's particles are in the world's space, and so are its
 * pins and the bodies it is kept out of: the mesh's node stays at the
 * origin, unturned, under a parent that is too.
 *
 * It has no timer. Each frame it is given the delta of a layer of the
 * engine's clock (`update(seconds)`, or `updateFrom(session.layers)`): a
 * paused layer hands it zero and it stands still.
 */
import { ZhudaClothSolver, type ZhudaClothOptions, type ZhudaClothShape } from '../simulation/Cloth.js';
import type { ZhudaLayeredClock } from './Clocks.js';
import { ZhudaDynamicMesh } from './Surfaces.js';
export interface ZhudaClothMeshOptions extends ZhudaClothOptions {
    /**
     * Gives the mesh a colour a vertex and writes how far the weave is
     * stretched at each place to its alpha, for a lit surface's hook to read
     * (`s.vertexColor.a`): `true`, or `{ scale }`, by which the stretch (a
     * share of the rest length: 0.05 is five per cent) is multiplied before
     * it is clamped to 0..1 (default 1). Red, green and blue stay white.
     */
    strain?: boolean | {
        scale?: number;
    };
}
export declare class ZhudaCloth {
    readonly solver: ZhudaClothSolver;
    readonly mesh: ZhudaDynamicMesh;
    /** The mesh's node: give its renderer a material. */
    readonly node: any;
    private readonly strainScale;
    private readonly normals;
    private disposed;
    constructor(shape: ZhudaClothShape, parent: any, options?: ZhudaClothMeshOptions);
    /**
     * Takes a delta in seconds, runs the whole steps it holds and, if any
     * ran, moves the mesh. Zero changes nothing.
     */
    update(deltaSeconds: number): {
        steps: number;
        dropped: number;
    };
    /** The same, with the delta a layer of the engine's clock has for this frame (default `world`). */
    updateFrom(layers: ZhudaLayeredClock, layer?: string): {
        steps: number;
        dropped: number;
    };
    /**
     * Writes where the particles are to the mesh, with their normals (and
     * the stretch): after a pin was moved or the cloth reset while no step
     * ran. `update` does it by itself.
     */
    refresh(): void;
    /** Destroys the mesh and its node; the material is its owner's. */
    dispose(): void;
}
