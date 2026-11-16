// Generated from TypeScript source; run npm run types:generate.
/**
 * Constructive solid geometry on binary space partitioning trees, ported
 * from csg.js.
 *
 * csg.js: Copyright (c) 2011 Evan Wallace (http://madebyevan.com/), under
 * the MIT license:
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a
 *   copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included
 *   in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 *   OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 *   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 *   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 *   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 *   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Changes in this port: typed; a vertex carries a normal, texture
 * coordinates and an optional colour, all interpolated along a split; the
 * tolerance is a parameter; a tree is built without recursion; polygons are
 * wound counter-clockwise seen from outside, as in csg.js (the caller turns
 * the engine's triangles round).
 */
export type BspVec = [number, number, number];
export interface BspVertex {
    pos: BspVec;
    normal: BspVec;
    uv: [number, number];
    color?: [number, number, number, number];
}
export interface BspPolygon {
    vertices: BspVertex[];
    plane: BspPlane;
    /** Which input the polygon came from: 0 or 1. */
    source: number;
    /** The input triangle it is (a piece of). */
    origin: number;
}
export declare function interpolateVertex(a: BspVertex, b: BspVertex, t: number): BspVertex;
export declare class BspPlane {
    normal: BspVec;
    w: number;
    constructor(normal: BspVec, w: number);
    static fromPoints(a: BspVec, b: BspVec, c: BspVec): BspPlane | null;
    clone(): BspPlane;
    flip(): void;
    /**
     * Puts `polygon` in the right list: coplanar ones by facing, the others in
     * front or behind, and one that spans the plane split in two.
     */
    splitPolygon(polygon: BspPolygon, coplanarFront: BspPolygon[], coplanarBack: BspPolygon[], front: BspPolygon[], back: BspPolygon[], epsilon: number): void;
}
export declare function flipPolygon(p: BspPolygon): BspPolygon;
export declare class BspNode {
    plane: BspPlane | null;
    front: BspNode | null;
    back: BspNode | null;
    polygons: BspPolygon[];
    private readonly epsilon;
    constructor(epsilon: number, polygons?: BspPolygon[]);
    /** Every node of the tree, without recursion. */
    private nodes;
    /** Solid becomes empty and empty solid. */
    invert(): void;
    /** What of `polygons` lies outside this tree's solid. */
    clipPolygons(polygons: BspPolygon[]): BspPolygon[];
    /** Removes from this tree what lies inside `bsp`. */
    clipTo(bsp: BspNode): void;
    allPolygons(): BspPolygon[];
    build(polygons: BspPolygon[]): void;
}
/** a ∪ b, a − b, a ∩ b: the three operations of csg.js, on two trees. */
export declare function bspUnion(a: BspNode, b: BspNode): BspPolygon[];
export declare function bspSubtract(a: BspNode, b: BspNode): BspPolygon[];
export declare function bspIntersect(a: BspNode, b: BspNode): BspPolygon[];
