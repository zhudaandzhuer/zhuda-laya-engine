export interface Vec3 {
    x: number;
    y: number;
    z: number;
}
export interface Quat {
    x: number;
    y: number;
    z: number;
    w: number;
}
export type Matrix4 = ArrayLike<number>;
export declare const identity4: () => Float32Array<ArrayBuffer>;
export declare function multiply4(a: Matrix4, b: Matrix4): Float32Array<ArrayBuffer>;
export declare function compose4(p?: Vec3, q?: Quat, s?: Vec3): Float32Array<ArrayBuffer>;
export declare function transformPoint(m: Matrix4, p: Vec3): Vec3;
export declare function inverse4(a: Matrix4): Float32Array<ArrayBuffer>;
export declare function normalized(v: Vec3): Vec3;
