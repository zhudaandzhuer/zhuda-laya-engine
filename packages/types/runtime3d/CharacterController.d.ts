// Generated from TypeScript source; run npm run types:generate.
import type { Vec3 } from './Math3D.js';
import { type ZhudaSolid } from './WalkGrid.js';
export interface ZhudaCharacterWorld {
    /** The ground's height under a point, or null where there is none (outside the map, a pit). */
    ground(x: number, z: number): number | null;
    /** What the capsule cannot pass through. Read on every move: the game may change the list. */
    solids?: readonly ZhudaSolid[];
}
export interface ZhudaCharacterControllerOptions {
    world: ZhudaCharacterWorld;
    /** Where the feet start. */
    position: Vec3;
    radius?: number;
    height?: number;
    /** The highest rise taken in one stride, and the deepest drop that is still walking, not falling. */
    maxStep?: number;
    /** The steepest ground climbed, in degrees. Going down is not limited. */
    maxSlopeDeg?: number;
    /** Metres per second squared, downwards. */
    gravity?: number;
    /** Metres per second upwards when a jump starts. */
    jumpSpeed?: number;
    maxFallSpeed?: number;
    /** Where there is no ground: 'block' treats it as a wall (the edge of the map), 'fall' lets the character walk off. */
    noGround?: 'block' | 'fall';
}
export interface ZhudaCharacterMove {
    /** How far the feet moved in this call. */
    moved: Vec3;
    grounded: boolean;
    /** Something solid, a step too high, a slope too steep or the map's edge shortened the move. */
    blocked: boolean;
    /** It touched ground in this call after being in the air. */
    landed: boolean;
    /** It left the ground in this call without jumping (walked off an edge). */
    fellOff: boolean;
    jumped: boolean;
}
export declare class ZhudaCharacterController {
    readonly radius: number;
    readonly height: number;
    readonly maxStep: number;
    readonly maxSlopeDeg: number;
    gravity: number;
    jumpSpeed: number;
    maxFallSpeed: number;
    /** The feet. Set it through `teleport`, which also settles `grounded`. */
    readonly position: Vec3;
    /** Metres per second upwards (negative while falling). */
    velocityY: number;
    grounded: boolean;
    private readonly world;
    private readonly noGround;
    private readonly slopeLimit;
    constructor(options: ZhudaCharacterControllerOptions);
    /** Puts the feet somewhere. On the ground if they are within a step of it, else in the air. */
    teleport(position: Vec3): void;
    /**
     * One step of `dt` seconds. `wish` is the speed wanted over the ground, in metres per second
     * on x and z; the game has already turned its input, its speed and its states into it.
     */
    move(dt: number, wish: {
        x: number;
        z: number;
    }, options?: {
        jump?: boolean;
    }): ZhudaCharacterMove;
    /** Tries one stride over the ground. Moves and returns true, or leaves the feet where they are. */
    private stride;
}
