// The hunter and the monster on the field: loaded models, the clips they play for each state of
// the rules, and the motion added on top where a model has no clip for it (a beast with only
// Idle, Move and Attack is tipped over by hand when it is toppled). Positions come from the rules.
import { ZhudaModelInspector, type ModelInstance, type ZhudaModelLibrary } from 'zhuda-laya-engine';
import { HUNTER_MOVES, type Hunt, type Monster } from '../core/hunt.ts';

const DEG = 180 / Math.PI;
const ease = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

class Clips {
  readonly inspector: ZhudaModelInspector;
  readonly clips = new Map<string, { path: string; seconds: number }>();
  current = '';
  constructor(instance: ModelInstance) {
    this.inspector = new ZhudaModelInspector(instance);
    for (const c of this.inspector.inspect().animations) this.clips.set(c.name, { path: c.path, seconds: c.durationSeconds });
  }
  /** Plays the first of `names` the model has, stretched to `seconds` when given. Returns whether one played. */
  play(names: string[], seconds?: number, restart = false, fade = 0.1): boolean {
    const name = names.find((n) => this.clips.has(n));
    if (!name) return false;
    const key = `${name}@${seconds ?? 0}`;
    if (key === this.current && !restart) return true;
    this.current = key;
    const clip = this.clips.get(name)!;
    this.inspector.crossFade(clip.path, name, { seconds: fade, normalizedTime: 0 });
    this.inspector.setAnimationSpeed(clip.path, seconds ? clip.seconds / seconds : 1);
    return true;
  }
}

function shadows(node: Laya.Node): void {
  const r = ((node as Laya.Sprite3D).getComponent?.(Laya.MeshRenderer) ?? (node as Laya.Sprite3D).getComponent?.(Laya.SkinnedMeshRenderer)) as Laya.MeshRenderer | null;
  if (r) r.castShadow = r.receiveShadow = true;
  for (let i = 0; i < node.numChildren; i++) shadows(node.getChildAt(i));
}

export class HunterView {
  private readonly clips: Clips;
  private tilt = 0;
  private flash = 0;
  private constructor(private readonly model: ModelInstance) {
    this.clips = new Clips(model);
    // 豬大 is 1.14 m; a hunter half as tall again reads better beside a 3 m beast.
    model.node.transform.localScale = new Laya.Vector3(1.35, 1.35, 1.35);
    shadows(model.node);
  }
  static async load(library: ZhudaModelLibrary, parent: Laya.Node): Promise<HunterView> {
    const model = await library.instantiate('zhuda.glb', { independentMaterials: true });
    parent.addChild(model.node);
    return new HunterView(model);
  }
  /** Called on the step an action starts: the clip is stretched to the move's frame data. */
  act(action: keyof typeof HUNTER_MOVES): void {
    const move = HUNTER_MOVES[action];
    this.clips.play([move.clip, 'Slash1'], move.spec.frameCount / move.spec.frameRate, true, 0.06);
  }
  hurt(): void {
    this.flash = 1;
  }
  update(dt: number, hunt: Hunt): void {
    const h = hunt.hunter;
    if (!h.action) this.clips.play(h.down > 0 ? ['Sit', 'Idle'] : h.moving ? ['Run', 'Walk'] : ['Idle']);
    this.tilt = ease(this.tilt, h.down > 0 ? 1 : 0, 12, dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    const f = this.flash, blink = h.grace > 0 && Math.floor(h.grace * 16) % 2 === 0 ? 0.55 : 1;
    this.model.setTint([blink, blink * (1 - 0.6 * f), blink * (1 - 0.65 * f), 1]);
    const t = this.model.node.transform;
    t.position = new Laya.Vector3(h.x, 0.02, h.z);
    t.localRotationEuler = new Laya.Vector3(-70 * this.tilt, h.yaw * DEG, 0);
  }
}

export class MonsterView {
  private readonly clips: Clips;
  private readonly scale: number;
  private roll = 0;
  private pitch = 0;
  private sink = 0;
  private flash = 0;
  private lastState = '';
  private constructor(private readonly model: ModelInstance, monster: Monster) {
    this.clips = new Clips(model);
    this.scale = monster.def.height / monster.def.modelHeight;
    model.node.transform.localScale = new Laya.Vector3(this.scale, this.scale, this.scale);
    shadows(model.node);
  }
  static async load(library: ZhudaModelLibrary, parent: Laya.Node, monster: Monster): Promise<MonsterView> {
    const model = await library.instantiate(monster.def.model, { independentMaterials: true });
    parent.addChild(model.node);
    return new MonsterView(model, monster);
  }
  hit(weak: boolean): void {
    this.flash = weak ? 1 : 0.6;
  }
  update(dt: number, m: Monster, hunterDist: number): void {
    const changed = m.state !== this.lastState;
    this.lastState = m.state;
    let roll = 0, pitch = 0;
    switch (m.state) {
      case 'roam':
        this.clips.play(hunterDist > m.def.reach ? ['Move', 'Idle'] : ['Idle']);
        break;
      case 'windup':
        // The strike's clip is stretched over windup and strike, so the blow lands with the rules;
        // the body leans back as it gathers (charge: it lowers its head).
        if (changed && m.move) this.clips.play(m.move.shape === 'charge' ? ['Roar', 'Idle'] : [m.move.clip, 'Attack'], m.move.shape === 'charge' ? m.span * 1.4 : (m.span + m.move.active) * 1.25, true);
        pitch = m.move?.shape === 'charge' ? 10 : -14 * Math.min(1, m.t / m.span);
        break;
      case 'active':
        if (changed && m.move?.shape === 'charge') this.clips.play(['Move'], 0.45, true);
        pitch = m.move?.shape === 'charge' ? 8 : 12;
        break;
      case 'recover':
        if (changed) this.clips.play(['Idle'], undefined, false, 0.35);
        pitch = 5;
        break;
      case 'roar':
        if (changed && !this.clips.play(['Roar'], m.span, true)) this.clips.play(['Attack'], m.span, true);
        pitch = -18;
        break;
      case 'flinch':
        if (changed) this.clips.play(['Hit', 'Idle'], m.span, true);
        pitch = -8;
        break;
      case 'stun':
        if (changed) this.clips.play(['Idle'], 1.2, true);
        pitch = 14;
        roll = Math.sin(m.t * 5) * 6; // it sways, head down
        break;
      case 'topple':
        if (changed) this.clips.play(['Hit', 'Move'], 0.5, true);
        roll = 78;
        break;
      case 'dead':
        if (changed && !this.clips.play(['Death'], undefined, true)) this.clips.play(['Idle'], 8, true);
        if (!this.clips.clips.has('Death')) roll = 84;
        break;
    }
    this.roll = ease(this.roll, roll, m.state === 'topple' || m.state === 'dead' ? 7 : 5, dt);
    this.pitch = ease(this.pitch, pitch, 9, dt);
    this.sink = ease(this.sink, Math.abs(this.roll) > 40 ? 1 : 0, 6, dt);
    this.flash = Math.max(0, this.flash - dt * 5);
    const f = this.flash, rage = m.enraged > 0 ? 0.22 + 0.08 * Math.sin(m.t * 9) : 0;
    this.model.setTint([1, 1 - 0.5 * f - rage, 1 - 0.55 * f - rage, 1]);
    const t = this.model.node.transform;
    // Rolled onto its side, the body's half-width keeps it on the ground.
    t.position = new Laya.Vector3(m.x, 0.02 + this.sink * m.def.height * 0.18, m.z);
    t.localRotationEuler = new Laya.Vector3(this.pitch, m.yaw * DEG, this.roll);
  }
}
