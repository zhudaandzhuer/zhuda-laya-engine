// 撕襪 2D, Spine version: 沈知微's legs in sheer black tights under a pleated skirt, one Spine 4.2 rig made
// with zhuda-spine2D (spine/outfit: rig.py, make_parts.py, make_tights.py) and drawn by the engine's
// spine42 feature through ZhudaSpineCharacter (which sets LayaAir's Spine2DRenderNode up for a hand-driven
// rig and converts between the rig's canvas and the skeleton).
//
// - Drag the skirt: the pleat chain nearest the finger has its IK toward the finger switched on; the
//   other chains follow by Spine physics, and on letting go it swings back and settles.
// - Drag a leg: the tear site nearest the finger pulls the nylon toward the finger (its bone, which
//   carries the tights mesh round it); pulled far enough it tears (a small hole, then a large one) and
//   springs back. Double-tap the background to put everything back.
import { ZhudaEngine, ZhudaSpineCharacter } from 'zhuda-laya-engine';

const state: { ready: boolean; error?: string; note?: any; api?: any } = { ready: false };
Reflect.set(window, '__TEAR2D__', state);

const CW = 1024,
  CH = 1536; // the rig's canvas (pixels of the photo)
interface Site { name: string; x: number; y: number; w: number }

async function main() {
  const params = new URLSearchParams(location.search);
  const number = (name: string, fallback: number) => (params.has(name) ? Number(params.get(name)) : fallback);
  const container = document.querySelector<HTMLElement>('#game')!;
  const context = await ZhudaEngine.boot({ container, dprCap: number('dpr', 2), features: ['core', '2d', 'spine42'], bgColor: '#a49e9f' });
  const stage = Laya.stage;

  const [bgTexture, templet, sites] = await Promise.all([
    Laya.loader.load('assets/spine/bg.png') as Promise<any>,
    Laya.loader.load('assets/spine/outfit.json', Laya.Loader.SPINE) as Promise<any>,
    fetch('assets/spine/sites.json').then((r) => r.json() as Promise<Site[]>),
  ]);
  if (!templet) throw Error('the Spine rig did not load');

  // The picture: a sprite holding the background and the rig, in canvas pixels, scaled to the screen.
  const picture = new Laya.Sprite();
  context.rootScene.addChild(picture);
  picture.graphics.drawTexture(bgTexture, 0, 0, CW, CH);
  // The rig: its node's local space is the canvas (the art's pixels).
  const spine = new ZhudaSpineCharacter({ parent: picture, templet, animation: 'idle' });
  const skeleton = spine.skeleton;

  // Fit: a tall screen shows the legs large (the grey sides are cut), a wide one the whole picture.
  const view = { scale: 1, x: 0, y: 0 };
  const fit = () => {
    const w = stage.width,
      h = stage.height;
    view.scale = Math.min(h / (CH * 0.9), w / (CW * 0.8));
    view.x = (w - CW * view.scale) / 2;
    view.y = (h - CH * view.scale) / 2 + CH * view.scale * 0.02;
    picture.scale(view.scale, view.scale);
    picture.pos(view.x, view.y);
  };
  fit();
  stage.on(Laya.Event.RESIZE, null, fit);

  const bone = (name: string) => skeleton.findBone(name);
  const chains = Array.from({ length: 9 }, (_, i) => ({
    tip: `pleat${i}_3`,
    grab: `grab${i}`,
    ik: `grab${i}_ik`,
    mix: 0,
  }));
  const pulls = sites.map((s) => ({ site: s, bone: `pull_${s.name}`, stage: 0, offset: [0, 0], velocity: [0, 0], target: [0, 0] }));
  for (const p of pulls) if (!bone(p.bone)) throw Error('missing bone ' + p.bone);

  // --- input --------------------------------------------------------------------------------------
  type Held =
    | { kind: 'skirt'; id: number; chain: number; start: number[]; tip: number[] }
    | { kind: 'leg'; id: number; pull: (typeof pulls)[number]; start: number[] };
  let held: Held | null = null;
  const tearAt = number('tearAt', 0.8); // of the leg's width (it tears at 1.35 times this)
  let lastTap = 0;

  const local = (event: PointerEvent) => {
    const box = container.getBoundingClientRect();
    return spine.stageToCanvas(((event.clientX - box.left) / box.width) * stage.width, ((event.clientY - box.top) / box.height) * stage.height);
  };
  const skirtHit = (x: number, y: number) => {
    // Within the skirt's fan: below the waistband, above the hem (as the chain tips are now).
    if (y < 100) return -1;
    let best = -1,
      bestD = Infinity;
    chains.forEach((c, i) => {
      const [tipX, tipY] = spine.boneTipCanvas(c.tip);
      if (y > tipY + 30) return;
      const d = Math.abs(x - tipX) + 0.3 * Math.abs(y - tipY);
      if (d < bestD) (bestD = d), (best = i);
    });
    return bestD < 120 ? best : -1;
  };
  const down = (event: PointerEvent) => {
    if (held || event.button !== 0) return;
    const [x, y] = local(event);
    container.setPointerCapture?.(event.pointerId);
    const chain = skirtHit(x, y);
    if (chain >= 0) {
      const c = chains[chain];
      // The grab bone starts at the chain's tip.
      const tip = spine.boneTipCanvas(c.tip);
      held = { kind: 'skirt', id: event.pointerId, chain, start: [x, y], tip };
      spine.moveBoneTo(c.grab, tip[0], tip[1]);
      return;
    }
    let best: (typeof pulls)[number] | null = null,
      bestD = Infinity;
    for (const p of pulls) {
      const d = Math.hypot(x - p.site.x, (y - p.site.y) * 0.6);
      if (d < bestD && d < p.site.w * 0.9) (bestD = d), (best = p);
    }
    if (best) {
      held = { kind: 'leg', id: event.pointerId, pull: best, start: [x, y] };
      return;
    }
    const now = performance.now();
    if (now - lastTap < 350) reset();
    lastTap = now;
  };
  const move = (event: PointerEvent) => {
    if (!held || held.id !== event.pointerId) return;
    const [x, y] = local(event);
    const dx = x - held.start[0],
      dy = y - held.start[1];
    if (held.kind === 'skirt') {
      const c = chains[held.chain];
      // Lifted hems go up and out; held lower than its rest the cloth does not stretch past it.
      const lift = Math.max(-40, -dy) * 1.25;
      spine.moveBoneTo(c.grab, held.tip[0] + dx * 1.1, held.tip[1] - lift);
      return;
    }
    const p = held.pull,
      w = p.site.w;
    // The nylon follows the finger, giving way less the farther it goes.
    const len = Math.hypot(dx, dy);
    const give = len > 0 ? (Math.min(len, w * 0.8) * (1 - 0.3 * Math.min(1, len / (w * tearAt)))) / len : 0;
    p.target = [dx * give, dy * give];
    if (len > w * tearAt * 1.35) tear(p);
  };
  const tear = (p: (typeof pulls)[number]) => {
    p.stage = Math.min(2, p.stage + 1);
    const size = p.stage === 1 ? 'small' : 'large';
    // The bare leg where it opened, and its rolled lip.
    for (const kind of ['tear', 'lip']) spine.setAttachment(`${kind}_${p.site.name}`, `${kind}_${p.site.name}_${size}`);
    p.target = [0, 0];
    held = null;
  };
  const up = (event: PointerEvent) => {
    if (!held || held.id !== event.pointerId) return;
    if (held.kind === 'leg') held.pull.target = [0, 0];
    held = null;
  };
  const reset = () => {
    for (const p of pulls) {
      p.stage = 0;
      for (const kind of ['tear', 'lip']) spine.setAttachment(`${kind}_${p.site.name}`, null);
    }
  };
  container.addEventListener('pointerdown', down, true);
  container.addEventListener('pointermove', move, true);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) container.addEventListener(type, up as any, true);

  // --- each frame: the IK mixes and the nylon's spring ---------------------------------------------
  context.runtime.start(() => {
    spine.update();
    const dt = Math.min(context.runtime.layers.scaledDeltas.get('world') ?? 1 / 60, 0.04);
    chains.forEach((c, i) => {
      const want = held?.kind === 'skirt' && held.chain === i ? 1 : 0;
      // Let go, the IK fades over a fifth of a second and the physics carries the swing.
      c.mix += (want - c.mix) * Math.min(1, dt * (want ? 18 : 5));
      spine.setIkMix(c.ik, c.mix);
    });
    for (const p of pulls) {
      const holding = held?.kind === 'leg' && held.pull === p;
      const stiffness = holding ? 900 : 260,
        damping = holding ? 60 : 15;
      const steps = Math.max(1, Math.ceil(dt * 240));
      for (let s = 0; s < steps; s++) {
        const h = dt / steps;
        for (let k = 0; k < 2; k++) {
          p.velocity[k] += ((p.target[k] - p.offset[k]) * stiffness - p.velocity[k] * damping) * h;
          p.offset[k] += p.velocity[k] * h;
        }
      }
      spine.nudgeBone(p.bone, p.offset[0], p.offset[1]);
    }
  });

  Reflect.set(window, '__SPINE__', { spine, skeleton, picture });
  state.note = { sites: sites.length, chains: chains.length, stage: [stage.width, stage.height] };
  state.api = {
    stats: () => ({ held: held?.kind ?? null, tears: pulls.filter((p) => p.stage).map((p) => `${p.site.name}:${p.stage}`), mix: chains.map((c) => +c.mix.toFixed(2)), spine: spine.diagnostics() }),
    tear: (name: string) => {
      const p = pulls.find((q) => q.site.name === name);
      if (p) tear(p);
      return p?.stage;
    },
    reset,
  };
  state.ready = true;
}

main().catch((error) => {
  state.error = String(error?.stack || error);
  const note = document.createElement('pre');
  note.style.cssText = 'position:fixed;left:8px;top:8px;right:8px;color:#fff;font:12px/1.4 monospace;white-space:pre-wrap;z-index:9';
  note.textContent = state.error;
  document.body.appendChild(note);
});
