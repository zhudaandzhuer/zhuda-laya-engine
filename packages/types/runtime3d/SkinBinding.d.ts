// Generated from TypeScript source; run npm run types:generate.
/**
 * Wearing a part on another model's skeleton: clothes, hair, armour or a held
 * prop made as a skinned model of its own whose joints have the same names as
 * the body's. Binding points the part's skinned meshes at the body's joints,
 * so the part is posed by whatever poses the body (its animator, a blend, a
 * procedural pose) and needs no animation of its own.
 *
 * The part need not come from the tool that made the body. Its joints may be
 * fewer, in another order, turned differently in the rest pose (bones along
 * another axis) and under an armature that is turned or scaled (a mesh in
 * centimetres, z up): where a part's joint rests differently from the body's,
 * the part is bound to a node under the body's joint that holds the difference.
 * What must agree is where the joints are: a part made for other proportions
 * is carried as it was made, not refitted.
 */
import type { ModelInstance } from './Assets.js';
export interface ZhudaSkinBindingReport {
    /** Skinned meshes now posed by the skeleton. 0 when anything was missing. */
    renderers: number;
    /** Distinct joints the part uses. */
    joints: number;
    /** Joint names the part needs that the skeleton does not have. Nothing is bound when any is. */
    missing: string[];
    /**
     * Joints bound through an offset node because the part's rest pose there is
     * not the body's (0 for a part made on the body's own skeleton).
     */
    offsets: number;
}
/**
 * Binds every skinned mesh under `part` to the joints of the same names under
 * `skeleton` (a model instance or a node). The skeleton's joints are the ones
 * its own skinned meshes use; if it has no skinned mesh, nodes are matched by
 * name. Either all of the part's meshes are bound or none: `missing` lists the
 * joints the skeleton lacks.
 *
 * Bind a part right after it is instantiated, before anything poses it: its
 * joints are read where they rest. The body may be in any pose. The body's own
 * skinned mesh is taken to be in the body's model space (no scale or turn
 * between its mesh and its joints' rest).
 *
 * Afterwards the part's own joint nodes are unused; its mesh nodes may stay
 * where they are or be moved under the body. Dispose the part as usual, call
 * `releaseZhudaSkinBinding` if the body lives on, and bind again after
 * replacing the body.
 */
export declare function bindZhudaSkinToSkeleton(part: ModelInstance | Laya.Sprite3D, skeleton: ModelInstance | Laya.Sprite3D): ZhudaSkinBindingReport;
/**
 * Removes the offset nodes a binding left under the body's joints. Call it
 * when a bound part is disposed while the body lives on. Returns how many.
 */
export declare function releaseZhudaSkinBinding(part: ModelInstance | Laya.Sprite3D): number;
