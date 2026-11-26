/**
 * 「灰燼之庭」 picture: the two figures (2d/cel-motion CelSprite, with the warden's dent),
 * the bending blade drawn as a 24-segment strip with its crossguard, contact shadows,
 * impact dust and steel shards (a seeded particle pool, at most 330), and the camera that
 * frames both fighters for any viewport (portrait zooms in on them) while the courtyard
 * backdrop fills the screen with a slower parallax. Also maps a screen point to the world.
 */
import type { PrefabInstance } from "zhuda-laya-engine";
import { CelSprite, sourceTexture } from "../cel-motion/cel-sprite.ts";
import { CELS } from "./motion-cels.ts";
import {
  BLADE_STEPS,
  FLOOR,
  KNIGHT,
  KNIGHT_SCALE,
  WARDEN,
  WARDEN_SCALE,
  clamp,
  mix,
  onBlade,
  type Blade,
  type Point,
  WIDTH,
  HEIGHT,
  type Rect,
} from "./motion.ts";
import type { CombatEvent, View } from "./combat.ts";

const matUV = (rect: Rect) => {
  const [x, y, r, b] = rect;
  return [
    x / 512,
    y / 256,
    r / 512,
    y / 256,
    r / 512,
    b / 256,
    x / 512,
    b / 256,
  ];
};
const shadowUV = matUV([385, 65, 511, 191]);
const dustUV = [0, 1, 2].map((i) =>
  matUV([i * 128 + 1, 65, i * 128 + 127, 191])
);
class SwordSprite {
  private readonly positions = new Float32Array((BLADE_STEPS + 1) * 4);
  private readonly uv = new Float32Array((BLADE_STEPS + 1) * 4);
  private readonly indices: Uint16Array;
  private node: Laya.Sprite;
  private material: Laya.Texture;
  constructor(node: Laya.Sprite, material: Laya.Texture) {
    this.node = node;
    this.material = material;
    const indices = [];
    for (let i = 0; i <= BLADE_STEPS; i++) {
      const u = mix(0.001, 0.999, i / BLADE_STEPS);
      this.uv.set([u, 0.002, u, 31.5 / 256], i * 4);
      if (i < BLADE_STEPS) {
        const j = i * 2;
        indices.push(j, j + 2, j + 1, j + 2, j + 3, j + 1);
      }
    }
    this.indices = Uint16Array.from(indices);
  }
  draw(blade: Blade): void {
    this.node.zOrder = blade.touching ? 1 : -1;
    for (let i = 0; i <= BLADE_STEPS; i++) {
      const u = i / BLADE_STEPS,
        center = onBlade(blade, u),
        next = onBlade(blade, u + 0.002);
      const a = Math.atan2(next.y - center.y, next.x - center.x);
      const taper = u > 0.86 ? Math.max(0.02, (1 - u) / 0.14) : 1;
      const width = (9.2 - 3.6 * u) * taper;
      const dx = -Math.sin(a) * width,
        dy = Math.cos(a) * width;
      this.positions.set(
        [center.x - dx, center.y - dy, center.x + dx, center.y + dy],
        i * 4
      );
    }
    const g = this.node.graphics;
    g.clear();
    g.drawTriangles(this.material, 0, 0, this.positions, this.uv, this.indices);
    // The crossguard obscures the wrist socket as the blade changes plane.
    const { x, y } = blade.grip,
      a = blade.angle,
      c = Math.cos(a),
      s = Math.sin(a);
    const cross = [
      [-7, -23],
      [-2, -22],
      [2, -7],
      [3, 7],
      [-0.5, 21],
      [-5, 25],
      [-7, 22],
      [-4, 6],
      [-5, -8],
      [-9, -20],
    ];
    const points = cross.flatMap(([u, v]) => [u * c - v * s, u * s + v * c]);
    g.drawPoly(x, y, points, "#49463c", "#211f1a", 1.5);
    g.drawLine(
      x - 7 * c + 20 * s,
      y - 7 * s - 20 * c,
      x - 2 * c + 4 * s,
      y - 2 * s - 4 * c,
      "#9b988a",
      1.7
    );
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  radius: number;
  angle: number;
  spin: number;
  tile: number;
  mote: boolean;
  ground: boolean;
  tint: number;
}
const shardColors = ["#22211c", "#37342b", "#514a3c", "#686151", "#292821"];
export class Battlefield {
  private knight: CelSprite;
  private warden: CelSprite;
  private sword: SwordSprite;
  private ground: Laya.Sprite;
  private dust: Laya.Sprite;
  private matter: Laya.Texture;
  private particles: Particle[] = [];
  private seed = 19843;
  private backdrop: Laya.Sprite;
  private span = WIDTH;
  private focus = WIDTH / 2;
  private lastTime = -1;
  private lastWidth = 0;
  private lastHeight = 0;
  private instance: PrefabInstance;
  constructor(instance: PrefabInstance) {
    this.instance = instance;
    this.knight = new CelSprite(
      instance.find("Knight"),
      KNIGHT,
      KNIGHT_SCALE,
      CELS.knight,
      CELS.scale,
      "knight"
    );
    this.warden = new CelSprite(
      instance.find("Warden"),
      WARDEN,
      WARDEN_SCALE,
      CELS.warden,
      CELS.scale,
      "warden"
    );
    const blade = instance.find("Blade");
    this.matter = sourceTexture(blade);
    this.sword = new SwordSprite(blade, this.matter);
    this.ground = instance.find("Ground");
    this.backdrop = instance.find("Backdrop");
    this.backdrop.zOrder = -4;
    this.ground.zOrder = -3;
    instance.find("Knight").zOrder = 2;
    for (let i = 0; i < this.ground.numChildren; i++)
      (this.ground.getChildAt(i) as Laya.Sprite).visible = false;
    this.dust = instance.find("Dust");
    this.dust.zOrder = 3;
  }
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  clear(): void {
    this.particles.length = 0;
    this.lastTime = -1;
  }
  burst(event: CombatEvent): void {
    if (event.kind === "swing") return;
    const ground = event.kind === "step" || event.kind === "evade",
      strength = event.strength;
    const count = Math.round((ground ? 26 : 83) * strength);
    for (let i = 0; i < count; i++) {
      const r = () => this.random(),
        mote = i > count * (ground ? 0.42 : 0.26);
      const angle = ground ? -0.12 - r() * 2.9 : -2.85 + r() * 4.0;
      const speed =
        (ground ? 58 : 103) *
        (mote ? 1.6 : 1) *
        (0.25 + 2.15 * r()) *
        (0.7 + strength * 0.62);
      this.particles.push({
        x: event.x + (r() - 0.5) * (ground ? 46 : 13),
        y: event.y + (r() - 0.5) * (ground ? 5 : 14),
        vx: Math.cos(angle) * speed + (ground ? -30 : 10),
        vy: Math.sin(angle) * speed - (ground ? 8 : 67),
        age: 0,
        life: (mote ? 0.4 : ground ? 0.62 : 0.63) + r() * (mote ? 0.7 : 0.53),
        radius: mote ? 1 + Math.pow(r(), 2) * 4 : (ground ? 20 : 17) + r() * 25,
        angle: r() * 6.28,
        spin: (r() - 0.5) * 8,
        tile: Math.floor(r() * 3),
        mote,
        ground,
        tint: Math.floor(r() * shardColors.length),
      });
    }
    if (this.particles.length > 330)
      this.particles.splice(0, this.particles.length - 330);
  }
  advance(dt: number): void {
    if (dt <= 0) return;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      const drag = Math.exp(-dt * (p.mote ? 0.65 : 2.1));
      p.vx *= drag;
      p.vy = p.vy * drag + (p.mote ? 435 : p.ground ? -18 : 16) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      if (p.y > FLOOR - 1 && p.vy > 0) {
        p.y = FLOOR - 1;
        p.vy *= -0.27;
        p.vx *= 0.72;
      }
    }
  }
  private drawDust(): void {
    const g = this.dust.graphics;
    g.clear();
    for (const p of this.particles) {
      const u = p.age / p.life;
      if (!p.mote) {
        const w = p.radius * (0.64 + 2 * u),
          h = w * (p.ground ? 0.6 : 0.93);
        const a =
          clamp((p.age + 0.035) * 13, 0, 1) *
          Math.pow(1 - u, 1.35) *
          (p.ground ? 0.69 : 0.49);
        g.drawTexture(
          this.matter,
          p.x - w,
          p.y - h,
          w * 2,
          h * 2,
          null,
          a,
          undefined,
          undefined,
          dustUV[p.tile]
        );
      } else {
        const a = p.angle,
          c = Math.cos(a),
          s = Math.sin(a),
          r = p.radius * Math.min(1, (1 - u) * 4);
        const contour = [
          -c * r * 1.3,
          -s * r * 1.3,
          (s * 0.53 + c * 0.22) * r,
          (-c * 0.53 + s * 0.22) * r,
          c * r,
          s * r,
          (-s * 0.45 + c * 0.33) * r,
          (c * 0.45 + s * 0.33) * r,
        ];
        g.drawPoly(p.x, p.y, contour, shardColors[p.tint]);
        if (r > 2.8)
          g.drawLine(
            p.x + contour[0],
            p.y + contour[1],
            p.x + contour[2],
            p.y + contour[3],
            "#837965",
            0.7
          );
      }
    }
  }
  worldAt(point: Point): Point {
    const root = this.instance.root;
    return {
      x: (point.x - root.x) / root.scaleX,
      y: (point.y - root.y) / root.scaleY,
    };
  }

  private frameActors(
    view: View,
    time: number,
    width: number,
    height: number
  ): void {
    const portrait = height > width;
    const span = portrait
      ? clamp(view.warden.x - view.knight.x + 308, 630, WIDTH)
      : WIDTH;
    const center = portrait
      ? clamp((view.knight.x + view.warden.x) / 2, span / 2, WIDTH - span / 2)
      : WIDTH / 2;
    const reset =
      this.lastTime < 0 ||
      time < this.lastTime ||
      width !== this.lastWidth ||
      height !== this.lastHeight;
    const follow = reset ? 1 : 1 - Math.exp(-10 * (time - this.lastTime));
    this.span = mix(this.span, span, follow);
    this.focus = mix(this.focus, center, follow);
    this.lastTime = time;
    this.lastWidth = width;
    this.lastHeight = height;
    const zoom = Math.min(width / this.span, height / HEIGHT);
    const floor = portrait
      ? Math.min(height * 0.75, height - 115)
      : (height - HEIGHT * zoom) / 2 + FLOOR * zoom;
    const left = width / 2 - this.focus * zoom;
    const top = floor - FLOOR * zoom;
    const root = this.instance.root;
    root.scale(zoom, zoom);
    root.pos(
      left + Math.sin(time * 127) * view.shake * zoom,
      top + Math.cos(time * 103) * view.shake * 0.52 * zoom
    );

    // The courtyard fills the viewport while both figures retain their original proportions.
    const scenery = Math.max(width / WIDTH, height / HEIGHT);
    const panorama = clamp(
      WIDTH / 2 + (this.focus - WIDTH / 2) * 0.35,
      width / (2 * scenery),
      WIDTH - width / (2 * scenery)
    );
    this.backdrop.scale(scenery / zoom, scenery / zoom);
    this.backdrop.pos(
      (width / 2 - (panorama + 8) * scenery - left) / zoom,
      ((height - HEIGHT * scenery) / 2 - 5 * scenery - top) / zoom
    );
  }

  draw(
    view: View,
    time: number,
    viewport: { width: number; height: number }
  ): void {
    this.frameActors(view, time, viewport.width, viewport.height);
    const g = this.ground.graphics;
    g.clear();
    for (const actor of [view.knight, view.warden]) {
      const width = actor === view.knight ? 374 : 300;
      g.drawTexture(
        this.matter,
        actor.x - width * 0.55,
        FLOOR - 14,
        width,
        31,
        null,
        0.85,
        undefined,
        undefined,
        shadowUV
      );
      g.drawTexture(
        this.matter,
        actor.x - width * 0.38,
        FLOOR - 6,
        width * 0.79,
        15,
        null,
        0.75,
        undefined,
        undefined,
        shadowUV
      );
    }
    this.sword.draw(view.blade);
    this.knight.draw(view.knight);
    this.warden.draw(view.warden, view.dent);
    this.drawDust();
  }
}
