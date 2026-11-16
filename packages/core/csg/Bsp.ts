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

const sub = (a: BspVec, b: BspVec): BspVec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: BspVec, b: BspVec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: BspVec, b: BspVec): BspVec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function interpolateVertex(a: BspVertex, b: BspVertex, t: number): BspVertex {
  const v: BspVertex = {
    pos: [lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t)],
    normal: [
      lerp(a.normal[0], b.normal[0], t),
      lerp(a.normal[1], b.normal[1], t),
      lerp(a.normal[2], b.normal[2], t),
    ],
    uv: [lerp(a.uv[0], b.uv[0], t), lerp(a.uv[1], b.uv[1], t)],
  };
  if (a.color && b.color)
    v.color = [
      lerp(a.color[0], b.color[0], t),
      lerp(a.color[1], b.color[1], t),
      lerp(a.color[2], b.color[2], t),
      lerp(a.color[3], b.color[3], t),
    ];
  return v;
}

function flipVertex(v: BspVertex): BspVertex {
  return {
    pos: v.pos,
    normal: [-v.normal[0], -v.normal[1], -v.normal[2]],
    uv: v.uv,
    ...(v.color ? { color: v.color } : {}),
  };
}

export class BspPlane {
  normal: BspVec;
  w: number;
  constructor(normal: BspVec, w: number) {
    this.normal = normal;
    this.w = w;
  }
  static fromPoints(a: BspVec, b: BspVec, c: BspVec): BspPlane | null {
    const n = cross(sub(b, a), sub(c, a));
    const length = Math.hypot(n[0], n[1], n[2]);
    if (!(length > 0)) return null;
    const unit: BspVec = [n[0] / length, n[1] / length, n[2] / length];
    return new BspPlane(unit, dot(unit, a));
  }
  clone(): BspPlane {
    return new BspPlane([...this.normal] as BspVec, this.w);
  }
  flip(): void {
    this.normal = [-this.normal[0], -this.normal[1], -this.normal[2]];
    this.w = -this.w;
  }
  /**
   * Puts `polygon` in the right list: coplanar ones by facing, the others in
   * front or behind, and one that spans the plane split in two.
   */
  splitPolygon(
    polygon: BspPolygon,
    coplanarFront: BspPolygon[],
    coplanarBack: BspPolygon[],
    front: BspPolygon[],
    back: BspPolygon[],
    epsilon: number,
  ): void {
    const COPLANAR = 0,
      FRONT = 1,
      BACK = 2,
      SPANNING = 3;
    let polygonType = 0;
    const types: number[] = [];
    for (const v of polygon.vertices) {
      const t = dot(this.normal, v.pos) - this.w;
      const type = t < -epsilon ? BACK : t > epsilon ? FRONT : COPLANAR;
      polygonType |= type;
      types.push(type);
    }
    switch (polygonType) {
      case COPLANAR:
        (dot(this.normal, polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
        break;
      case FRONT:
        front.push(polygon);
        break;
      case BACK:
        back.push(polygon);
        break;
      default: {
        const f: BspVertex[] = [],
          b: BspVertex[] = [];
        const n = polygon.vertices.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const ti = types[i],
            tj = types[j];
          const vi = polygon.vertices[i],
            vj = polygon.vertices[j];
          if (ti !== BACK) f.push(vi);
          if (ti !== FRONT) b.push(vi);
          if ((ti | tj) === SPANNING) {
            const t = (this.w - dot(this.normal, vi.pos)) / dot(this.normal, sub(vj.pos, vi.pos));
            const v = interpolateVertex(vi, vj, t);
            f.push(v);
            b.push(v);
          }
        }
        if (f.length >= 3)
          front.push({
            vertices: f,
            plane: polygon.plane,
            source: polygon.source,
            origin: polygon.origin,
          });
        if (b.length >= 3)
          back.push({
            vertices: b,
            plane: polygon.plane,
            source: polygon.source,
            origin: polygon.origin,
          });
      }
    }
  }
}

export function flipPolygon(p: BspPolygon): BspPolygon {
  const plane = p.plane.clone();
  plane.flip();
  return {
    vertices: p.vertices.slice().reverse().map(flipVertex),
    plane,
    source: p.source,
    origin: p.origin,
  };
}

export class BspNode {
  plane: BspPlane | null = null;
  front: BspNode | null = null;
  back: BspNode | null = null;
  polygons: BspPolygon[] = [];

  private readonly epsilon: number;
  constructor(epsilon: number, polygons?: BspPolygon[]) {
    this.epsilon = epsilon;
    if (polygons) this.build(polygons);
  }

  /** Every node of the tree, without recursion. */
  private nodes(): BspNode[] {
    const out: BspNode[] = [];
    const stack: BspNode[] = [this];
    while (stack.length) {
      const node = stack.pop()!;
      out.push(node);
      if (node.front) stack.push(node.front);
      if (node.back) stack.push(node.back);
    }
    return out;
  }

  /** Solid becomes empty and empty solid. */
  invert(): void {
    for (const node of this.nodes()) {
      node.polygons = node.polygons.map(flipPolygon);
      node.plane?.flip();
      const front = node.front;
      node.front = node.back;
      node.back = front;
    }
  }

  /** What of `polygons` lies outside this tree's solid. */
  clipPolygons(polygons: BspPolygon[]): BspPolygon[] {
    const out: BspPolygon[] = [];
    const stack: { node: BspNode; polygons: BspPolygon[] }[] = [{ node: this, polygons }];
    while (stack.length) {
      const { node, polygons: list } = stack.pop()!;
      if (!node.plane) {
        out.push(...list);
        continue;
      }
      const front: BspPolygon[] = [],
        back: BspPolygon[] = [];
      for (const p of list) node.plane.splitPolygon(p, front, back, front, back, this.epsilon);
      if (node.front) stack.push({ node: node.front, polygons: front });
      else out.push(...front);
      if (node.back) stack.push({ node: node.back, polygons: back });
      // Behind a leaf's last plane is inside: dropped.
    }
    return out;
  }

  /** Removes from this tree what lies inside `bsp`. */
  clipTo(bsp: BspNode): void {
    for (const node of this.nodes()) node.polygons = bsp.clipPolygons(node.polygons);
  }

  allPolygons(): BspPolygon[] {
    const out: BspPolygon[] = [];
    for (const node of this.nodes()) out.push(...node.polygons);
    return out;
  }

  build(polygons: BspPolygon[]): void {
    const stack: { node: BspNode; polygons: BspPolygon[] }[] = [{ node: this, polygons }];
    while (stack.length) {
      const { node, polygons: list } = stack.pop()!;
      if (!list.length) continue;
      if (!node.plane) node.plane = list[0].plane.clone();
      const front: BspPolygon[] = [],
        back: BspPolygon[] = [];
      for (const p of list)
        node.plane.splitPolygon(p, node.polygons, node.polygons, front, back, this.epsilon);
      if (front.length)
        stack.push({ node: (node.front ??= new BspNode(this.epsilon)), polygons: front });
      if (back.length)
        stack.push({ node: (node.back ??= new BspNode(this.epsilon)), polygons: back });
    }
  }
}

/** a ∪ b, a − b, a ∩ b: the three operations of csg.js, on two trees. */
export function bspUnion(a: BspNode, b: BspNode): BspPolygon[] {
  a.clipTo(b);
  b.clipTo(a);
  b.invert();
  b.clipTo(a);
  b.invert();
  a.build(b.allPolygons());
  return a.allPolygons();
}
export function bspSubtract(a: BspNode, b: BspNode): BspPolygon[] {
  a.invert();
  a.clipTo(b);
  b.clipTo(a);
  b.invert();
  b.clipTo(a);
  b.invert();
  a.build(b.allPolygons());
  a.invert();
  return a.allPolygons();
}
export function bspIntersect(a: BspNode, b: BspNode): BspPolygon[] {
  a.invert();
  b.clipTo(a);
  b.invert();
  a.clipTo(b);
  b.clipTo(a);
  a.build(b.allPolygons());
  a.invert();
  return a.allPolygons();
}
