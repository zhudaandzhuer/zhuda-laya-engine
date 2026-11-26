// 豬大衣櫥 — a character dressed at run time. The body is one model cut into regions; every
// garment, hair, pair of shoes and object is a model of its own on the same joints. Wearing a part
// binds its skinned mesh to the body's skeleton (the engine's bindZhudaSkinToSkeleton), so the
// body's animator poses it. What a part covers is not drawn while it is worn: the skin under it,
// and the cloth of any part under it, triangle by triangle (setZhudaTriangleMask), so nothing can
// come through it in any pose. Its colour is its material's.
// The rules are src/core/wardrobe.ts; the interface is the page's DOM.
//   index.html?look=hair-bob.shirt.trousers.boots._.belt-pouch~shirt:2     a given look
//   index.html?auto=1                                                      a new random look every two seconds
import {
  DirectoryAssetProvider, ZhudaEngine, ZhudaFilmAssets, ZhudaModelInspector, ZhudaModelLibrary, ZhudaRuntimeProfiler,
  bindZhudaSkinToSkeleton, loadZhudaFilmScene, setZhudaTriangleMask, validateZhudaFilmScene, type ModelInstance,
} from 'zhuda-laya-engine';
import { Wardrobe, emptyLook, hiddenIn, paletteOf, type Look, type Manifest, type Masks, type PartDef, type Slot } from './core/wardrobe.ts';
import { studio } from './view/studio.ts';

interface Report {
  ready: boolean;
  error?: string;
  frames: number;
  /** Client position of every named control. */
  hot: Record<string, [number, number]>;
  look?: string;
  worn?: string[];
  hidden?: string[];
  /** Regions of the body whose node is active. */
  shown?: string[];
  /** Per part ever worn: what binding reported. */
  bound: Record<string, { renderers: number; joints: number; missing: string[]; offsets: number }>;
  loads: number;
  /** Triangles hidden under what is worn: of the body's regions still drawn, and of each part worn. */
  masked?: { body: number; parts: Record<string, number> };
  /** Per mesh loaded: how many triangles, and the sum of the lengths of all their sides (times 10,000). */
  order: Record<string, [number, number]>;
  /**
   * Per mesh drawn: the sum of the lengths of the sides of the triangles that are in fact not drawn,
   * read back from the mesh after masking. A mask names triangles by their place in the file; the
   * same sum over the file's triangles shows that the right ones were hidden.
   */
  maskedSum?: Record<string, number>;
  triangles?: { rules: number; drawn: number };
  draws?: number;
  clip?: string;
  yaw?: number;
}
declare global {
  interface Window {
    __GAME__: Report;
  }
}
const report: Report = (window.__GAME__ = { ready: false, frames: 0, hot: {}, bound: {}, loads: 0, order: {} });
const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const SLOT_NAMES: Record<Slot, string> = { hair: '頭髮', hat: '帽', top: '上衣', bottom: '下身', full: '整套', waist: '腰', back: '背', shoes: '鞋' };
/** The order of the slots on the page (the rules list them from the skin outwards). */
const PAGE: Slot[] = ['hair', 'hat', 'top', 'bottom', 'full', 'waist', 'back', 'shoes'];
const CLIP_NAMES: Record<string, string> = { Idle: '站', Walk: '走', Run: '跑', Greet: '招手' };
const css = (c: [number, number, number]) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

async function main() {
  const container = $('#game');
  const context = await ZhudaEngine.boot({ container, features: ['core', '3d', 'gltf', 'postProcess'], dprCap: 1.5, targetFPS: 60, antialias: false });
  const manifest = (await (await fetch('assets/wardrobe.json')).json()) as Manifest;
  const masks = (await (await fetch(`assets/${manifest.masks}`)).json()) as Masks;
  const wardrobe = new Wardrobe(manifest, masks);
  /** The mesh under a node: the lengths of the sides of each of its triangles, as loaded. */
  const sides = new Map<string, Float32Array>(), meshNodes = new Map<string, Laya.Sprite3D>();
  const record = (name: string, node: Laya.Sprite3D) => {
    const mesh = (node.getComponent(Laya.MeshFilter) as Laya.MeshFilter | null)?.sharedMesh;
    if (!mesh) return;
    const positions: Laya.Vector3[] = [];
    mesh.getPositions(positions);
    const index = mesh.getIndices();
    const each = new Float32Array(index.length / 3);
    let sum = 0;
    for (let t = 0; t < each.length; t++) {
      for (let k = 0; k < 3; k++) each[t] += Laya.Vector3.distance(positions[index[t * 3 + k]], positions[index[t * 3 + ((k + 1) % 3)]]);
      sum += each[t];
    }
    sides.set(name, each);
    meshNodes.set(name, node);
    report.order[name] = [each.length, Math.round(sum * 1e4)];
  };
  /** Of a mesh as it is drawn now: the sides of the triangles whose three corners are one (not drawn). */
  const hiddenSides = (name: string) => {
    const index = (meshNodes.get(name)!.getComponent(Laya.MeshFilter) as Laya.MeshFilter).sharedMesh.getIndices();
    const each = sides.get(name)!;
    let sum = 0;
    for (let t = 0; t < each.length; t++) if (index[t * 3] === index[t * 3 + 1] && index[t * 3 + 1] === index[t * 3 + 2]) sum += each[t];
    return Math.round(sum * 1e4);
  };
  const meshNode = (root: Laya.Sprite3D): Laya.Sprite3D | null => {
    if (root.getComponent(Laya.MeshFilter)) return root;
    for (let i = 0; i < root.numChildren; i++) {
      const found = meshNode(root.getChildAt(i) as Laya.Sprite3D);
      if (found) return found;
    }
    return null;
  };
  const library = new ZhudaModelLibrary({ provider: new DirectoryAssetProvider({ baseUrl: 'assets/', timeoutMs: 120_000, maxBytes: 32 * 1024 * 1024 }), timeoutMs: 120_000 });
  const scene = studio();
  const issues = validateZhudaFilmScene(scene);
  if (issues.length) throw Error(issues.join('; '));
  const stage = await loadZhudaFilmScene(context.rootScene, scene, { assets: new ZhudaFilmAssets(new DirectoryAssetProvider({ baseUrl: 'assets/', timeoutMs: 120_000, maxBytes: 32 * 1024 * 1024 }), { timeoutMs: 120_000 }) });

  // ---- the body ----------------------------------------------------------------------------
  const body = await library.instantiate(manifest.body.file, { independentMaterials: true });
  stage.scene3D.addChild(body.node);
  const inspector = new ZhudaModelInspector(body);
  const clips = new Map(inspector.inspect().animations.map((a) => [a.name, a]));
  const regions = new Map<string, Laya.Sprite3D>();
  for (const region of Object.keys(manifest.body.regions)) {
    const node = body.find(`region-${region}`) as Laya.Sprite3D | null;
    if (!node) throw Error(`the body has no node for region ${region}`);
    regions.set(region, node);
    record(`region-${region}`, node);
  }

  // ---- parts: loaded when first worn, bound to the body's skeleton, kept ---------------------
  const parts = new Map<string, ModelInstance>();
  async function part(def: PartDef): Promise<ModelInstance> {
    let model = parts.get(def.id);
    if (model) return model;
    model = await library.instantiate(def.file, { independentMaterials: true });
    report.loads++;
    const bound = bindZhudaSkinToSkeleton(model, body);
    report.bound[def.id] = bound;
    if (!bound.renderers) throw Error(`${def.id} cannot be worn: ${bound.missing.length ? `the body lacks ${bound.missing.join(', ')}` : 'it has no skinned mesh'}`);
    body.node.addChild(model.node);
    const mesh = meshNode(model.node as Laya.Sprite3D);
    if (mesh) record(def.id, mesh);
    parts.set(def.id, model);
    return model;
  }
  // A part is made a neutral grey; its material's colour is the cloth's. setTint takes linear values.
  const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const tint = (model: ModelInstance, c: [number, number, number]) => model.setTint([linear(c[0]), linear(c[1]), linear(c[2]), 1]);

  let look: Look = emptyLook();
  let applying = 0;
  /** Makes the scene match a look: loads what is newly worn, shows it, hides the rest and the covered regions. */
  async function apply(next: Look) {
    const turn = ++applying;
    const worn = wardrobe.worn(next);
    const models = await Promise.all(worn.map((def) => part(def)));
    if (turn !== applying) return; // a later choice came while this one was loading
    look = next;
    const on = new Set(worn.map((p) => p.id));
    for (const [id, model] of parts) model.node.active = on.has(id);
    worn.forEach((def, i) => tint(models[i], wardrobe.colourOf(look, def.id)));
    // What is under the worn parts is not drawn: a region wholly covered is switched off, one partly
    // covered loses the covered triangles, and so does a part under another part.
    const hidden = new Set(wardrobe.hidden(look));
    const masked = { body: 0, parts: {} as Record<string, number> };
    for (const [region, node] of regions) {
      node.active = !hidden.has(region);
      if (!node.active) continue;
      masked.body += setZhudaTriangleMask(node, wardrobe.bodyMask(look, region)).hidden;
    }
    worn.forEach((def, i) => {
      const mask = wardrobe.partMask(look, def.id);
      masked.parts[def.id] = setZhudaTriangleMask(models[i], mask).hidden;
      if (masked.parts[def.id] !== hiddenIn(mask, def.triangles)) throw Error(`${def.id}: the mask hid ${masked.parts[def.id]} triangles, not ${hiddenIn(mask, def.triangles)}`);
    });
    report.masked = masked;
    report.maskedSum = {};
    for (const [region, node] of regions) if (node.active) report.maskedSum[`region-${region}`] = hiddenSides(`region-${region}`);
    for (const def of worn) report.maskedSum[def.id] = hiddenSides(def.id);
    report.look = wardrobe.encode(look);
    report.worn = worn.map((p) => p.id);
    report.hidden = [...hidden];
    report.shown = [...regions].filter(([, node]) => node.active).map(([region]) => region);
    draw();
  }

  // ---- clips ---------------------------------------------------------------------------------
  let clip = '';
  function play(name: string) {
    const entry = clips.get(name);
    if (!entry || name === clip) return;
    clip && !clip.includes('@') ? inspector.crossFade(entry.path, name, { seconds: 0.2 }) : inspector.play(entry.path, name);
    inspector.setAnimationSpeed(entry.path, 1);
    clip = name;
    report.clip = name;
    draw();
  }
  /**
   * Holds a pose no clip of the game reaches, to look at how the clothes take it: the build's
   * `_Stress` clip at one of its poses, all but stopped (LayaAir evaluates a pose only while time moves).
   */
  const HOLDS: [string, string, number][] = [['arms', '舉手', 0.25], ['crouch', '深蹲', 0.5], ['kick', '高踢', 0.75]];
  function hold(id: string, at: number) {
    const entry = clips.get('_Stress');
    if (!entry) return;
    inspector.play(entry.path, '_Stress', { normalizedTime: at, speed: 0.001 });
    clip = `_Stress@${id}`;
    report.clip = clip;
    draw();
  }

  // ---- the page ------------------------------------------------------------------------------
  const slots = $('#slots'), clipRow = $('#clips'), info = $('#info');
  function draw() {
    slots.textContent = '';
    for (const slot of PAGE) {
      const worn = look[slot];
      const h = document.createElement('h2');
      h.textContent = SLOT_NAMES[slot];
      const row = document.createElement('div');
      row.className = 'row';
      const none = document.createElement('button');
      none.textContent = '不穿';
      none.dataset.hot = `none-${slot}`;
      none.className = worn ? '' : 'on';
      none.onclick = () => void apply(wardrobe.takeOff(look, slot));
      row.append(none);
      for (const def of wardrobe.partsOf(slot)) {
        const b = document.createElement('button');
        // A part the build's measure did not pass is offered with a mark: it is a part made elsewhere.
        b.textContent = def.passes ? def.name : `${def.name} ⚠`;
        if (!def.passes) b.title = '量測沒過：某些姿勢身體會穿出來';
        b.dataset.hot = `wear-${def.id}`;
        // What cannot be worn with what is on is dimmed: wearing it takes the other off.
        const clash = wardrobe.worn(look).some((w) => w.id !== def.id && def.avoid.includes(w.id));
        b.className = worn === def.id ? 'on' : clash ? 'clash' : '';
        b.onclick = () => void apply(wardrobe.wear(look, def.id));
        row.append(b);
      }
      slots.append(h, row);
      const def = worn ? wardrobe.part(worn) : null;
      if (def?.tintable) {
        const swatches = document.createElement('div');
        swatches.className = 'row';
        swatches.style.marginTop = '6px';
        paletteOf(def).forEach((c, i) => {
          const s = document.createElement('button');
          s.className = `swatch${(look.colours[def.id] ?? 0) === i ? ' on' : ''}`;
          s.style.background = css(c);
          s.dataset.hot = `colour-${def.id}-${i}`;
          s.onclick = () => void apply(wardrobe.colour(look, def.id, i));
          swatches.append(s);
        });
        slots.append(swatches);
      }
    }
    clipRow.textContent = '';
    for (const name of manifest.body.clips) {
      if (name.startsWith('_')) continue; // a clip for measuring, not for playing
      const b = document.createElement('button');
      b.textContent = CLIP_NAMES[name] ?? name;
      b.dataset.hot = `clip-${name}`;
      b.className = clip === name ? 'on' : '';
      b.onclick = () => play(name);
      clipRow.append(b);
    }
    if (clips.has('_Stress'))
      for (const [id, label, at] of HOLDS) {
        const b = document.createElement('button');
        b.textContent = `${label}（定格）`;
        b.dataset.hot = `hold-${id}`;
        b.className = clip === `_Stress@${id}` ? 'on' : '';
        b.onclick = () => hold(id, at);
        clipRow.append(b);
      }
    const t = report.triangles;
    info.textContent = `三角形 ${t?.rules ?? wardrobe.triangles(look)}（畫出 ${t?.drawn ?? '…'}）　繪製 ${report.draws ?? '…'} 次\n${report.look ?? ''}`;
    report.hot = {};
    for (const el of document.querySelectorAll<HTMLElement>('[data-hot]')) {
      const box = el.getBoundingClientRect();
      if (box.width) report.hot[el.dataset.hot!] = [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)];
    }
  }
  $('#random').onclick = () => void apply(wardrobe.random((Math.random() * 1e9) | 0));
  $('#clear').onclick = () => void apply(emptyLook());

  // Drag across the picture to turn the character.
  let yaw = Number(params.get('yaw') ?? 0), dragging: number | null = null, lastX = 0;
  container.addEventListener('pointerdown', (e) => ((dragging = e.pointerId), (lastX = e.clientX)));
  window.addEventListener('pointermove', (e) => {
    if (dragging !== e.pointerId) return;
    yaw += (e.clientX - lastX) * 0.6;
    lastX = e.clientX;
  });
  window.addEventListener('pointerup', (e) => dragging === e.pointerId && (dragging = null));
  window.addEventListener('resize', draw);

  // ---- the frame -----------------------------------------------------------------------------
  const profiler = new ZhudaRuntimeProfiler({ capacity: 120 });
  const renderEngine = (globalThis as any).Laya?.LayaGL?.renderEngine;
  const gl = renderEngine?.getDevice?.() ?? renderEngine?.gl ?? null;
  if (gl) typeof gl.createQuerySet === 'function' ? profiler.attachWebGPU(gl) : profiler.attach(gl);
  let frameOpen = false, clock = 0, autoAt = 0, autoSeed = Number(params.get('seed') ?? 1);
  const portrait = () => container.clientHeight > container.clientWidth;
  context.runtime.start((dt) => {
    clock += dt;
    if (params.has('spin')) yaw += dt * 40;
    if (params.has('auto') && clock >= autoAt) ((autoAt = clock + 2), void apply(wardrobe.random(autoSeed++)));
    body.node.transform.localRotationEuler = new Laya.Vector3(0, yaw, 0);
    report.yaw = Math.round(yaw);
    // The character stands left of the panel on a wide page, above it on a tall one.
    stage.setCamera(portrait() ? { eye: [0, 0.5, 6.4], target: [0, 0.2, 0], focalLengthMm: 50 } : { eye: [0.8, 0.98, 4.5], target: [0.8, 0.86, 0], focalLengthMm: 50 });
    stage.setTime(clock);
    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    stage.prepare(aspect);
    if (frameOpen) {
      const sample = profiler.endFrame(dt * 1000, dt * 1000);
      report.draws = sample.drawCalls;
      report.triangles = { rules: wardrobe.triangles(look), drawn: sample.triangles };
      if (report.frames % 30 === 0) info.textContent = `三角形 ${report.triangles.rules}（畫出 ${sample.triangles}）　繪製 ${sample.drawCalls} 次\n${report.look ?? ''}`;
    }
    report.frames++;
    profiler.beginFrame();
    frameOpen = true;
  });

  play(params.get('clip') ?? 'Idle');
  await apply(params.has('look') ? wardrobe.decode(params.get('look')!) : wardrobe.decode('hair-long.tee.trousers.shoes._.belt-pouch~tee:1'));
  report.ready = true;
}

main().catch((e) => {
  window.__GAME__.error = String(e?.stack ?? e);
  $('#error').textContent = String(e?.message ?? e);
  console.error(e);
});
