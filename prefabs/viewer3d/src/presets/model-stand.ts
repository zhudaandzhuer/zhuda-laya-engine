// 角色展示台：把任何一個綁骨的 .glb 放在白色攝影棚裡看，用引擎自己的播放與淡入。做角色的人（或 agent）
// 每做一版都在這裡看：動作連不連、頭髮衣服有沒有跟著擺、關節彎起來塌不塌。路線：docs/routes/high-quality-character.md。
//
// ?file=<相對 index.html 的路徑或網址>（預設是元件庫的小黑人）。自己的檔不用重新建置：複製到
// dist/web/local/ 再開 ?scene=model-stand&file=local/<檔名>.glb（dist 不進版本庫）。
// 生成器給的模型常常是「高度 1、中心在原點、面向別的方向」：?scale=<倍數>、?lift=<往上抬幾公尺>、?turn=<繞直立軸轉幾度> 把它擺正再看（只在展示台上擺，不改檔案）。
// ?clip=<動作名>、?t=<秒>（停在那一刻，拍定格用）、?fade=<秒，預設 0.18>、?yaw=、?pitch=、?distance=、?tall=<角色大約多高，公尺；預設 1.7>、?look=outdoor。（?width=、?height= 是畫布大小，和別的 preset 一樣。）
//
// window.__SCENE__：state()（檔案、每段動作的長度、正在播哪段、三角形、節點數）、
// set({ clip, fade, freeze: 秒 | null, yaw, pitch, distance, tall, aim: [x, y, z] | null（鏡頭看哪一點；null 回到腰） })、where(骨頭名)（世界座標）、errors()。
import { ZhudaEngine, Zhuda3D, ZhudaModelAnimationSampler, ZhudaModelInspector, ZhudaModelLibrary, ZhudaSceneLook, DirectoryAssetProvider, createSurfaceMaterial, whenZhudaSplashGone } from 'zhuda-laya-engine';
import { skyAt, OCEAN, type WeatherMix } from '../common/3d/day-look.ts';
import { stickmanPath } from '../common/3d/stickman/stickman.ts';
import { clamp, type V3 } from '../common/3d/math.ts';
import { setSceneHook, type ScenePreset } from '../preset.ts';

export const modelStand: ScenePreset = {
  id: 'model-stand',
  title: '角色展示台：看任何一個綁骨的模型',
  summary: '白色攝影棚、一個地板、一個會轉的鏡頭。?file= 指到任何 .glb，列出它帶的每段動作，用引擎的播放和以秒計的淡入切換，也能停在某一秒拍定格。做角色時每一版都拿來看。',
  modules: ['3d/stickman', '3d/day-look', '3d/math'],
  views: { 元件庫的小黑人: '', '停在第 1.5 秒': 't=1.5', 戶外的光: 'look=outdoor', 正側面: 'yaw=1.5708' },
  async start(container, params) {
    const number = (name: string, fallback: number) => (params.has(name) ? Number(params.get(name)) : fallback);
    const width = Number(params.get('width')) || window.innerWidth || 1280,
      height = Number(params.get('height')) || window.innerHeight || 720;
    container.style.position = 'relative';
    const FOV = number('fov', 32);
    const studio = params.get('look') !== 'outdoor';
    const context = await ZhudaEngine.boot({ container, width, height, dprCap: number('dpr', 1.5), features: ['core', '3d', 'gltf', 'postProcess'], bgColor: studio ? '#ebebeb' : '#a9c4e4' });
    const scene = Zhuda3D.createScene3D(context.rootScene);
    const camera = Zhuda3D.createCamera(scene, { position: [0, 1, 4], rotationEuler: [0, 0, 0], fov: FOV, near: 0.05, far: 200 });
    const calm: WeatherMix = { rain: 0, storm: 0, mist: 0 };
    const sky = skyAt(10.5, calm, 4, 0, 8, ['clouds', 'fog'], OCEAN).look;
    const grey = (v: number) => [v, v, v] as [number, number, number];
    // 攝影棚：白色、中性、四周都有光、太陽弱、影子淡；不做暈影和顆粒，看的是模型本身。
    const studioLook = {
      ...sky,
      sky: grey(1),
      atmosphere: false as const,
      ambient: grey(1.05),
      ambientGround: grey(0.85),
      sun: { azimuthDeg: -30, elevationDeg: 55, intensity: 0.7, color: grey(1) },
      shadows: { ...sky.shadows, strength: 0.35 },
      fog: { color: grey(0.92), start: 60, end: 200 },
      grade: { ...sky.grade, contrast: 1, saturation: 1, vignette: 0, grain: 0, bloom: 0.05 },
      lightFog: false as const,
    };
    const look = new ZhudaSceneLook(scene, camera, studio ? studioLook : { ...sky, sun: { ...sky.sun, azimuthDeg: -35, elevationDeg: 40 } }, { quality: 2, cameraPasses: { depth: true, opaque: true } });
    const floor = new Laya.MeshSprite3D(Laya.PrimitiveMesh.createPlane(60, 60, 1, 1));
    floor.meshRenderer.sharedMaterial = createSurfaceMaterial({ type: 'pbr', color: studio ? [0.9, 0.9, 0.9, 1] : [0.62, 0.66, 0.6, 1], roughness: 0.9, metallic: 0 }) as Laya.Material;
    floor.meshRenderer.receiveShadow = true;
    scene.addChild(floor);

    const file = params.get('file') || stickmanPath();
    const models = new ZhudaModelLibrary({ provider: new DirectoryAssetProvider({ baseUrl: './', timeoutMs: 120_000 }), timeoutMs: 120_000 });
    const model = await models.instantiate(file, { retries: 1 });
    scene.addChild(model.node);
    // 只在展示台上擺正：放大、抬高、轉向。檔案本身不動。
    const placed = { scale: number('scale', 1), lift: number('lift', 0), turn: number('turn', 0) };
    model.node.transform.localScale = new Laya.Vector3(placed.scale, placed.scale, placed.scale);
    model.node.transform.position = new Laya.Vector3(0, placed.lift, 0);
    model.node.transform.rotationEuler = new Laya.Vector3(0, placed.turn, 0);
    const inspector = new ZhudaModelInspector(model);
    const report = inspector.inspect();
    const clips = report.animations.map((a) => ({ path: a.path, name: a.name, seconds: a.durationSeconds }));

    const named = new Map<string, Laya.Sprite3D>();
    let animator: Laya.Animator | null = null;
    let triangles = 0;
    const walk = (n: Laya.Node) => {
      const s = n as Laya.Sprite3D;
      animator ??= s.getComponent?.(Laya.Animator) as Laya.Animator | null;
      const renderer = s.getComponent?.(Laya.BaseRender) as Laya.BaseRender | null;
      if (renderer) (renderer.castShadow = true), (renderer.receiveShadow = true);
      if (s.name) named.set(s.name, s);
      for (let k = 0; k < n.numChildren; k++) walk(n.getChildAt(k));
    };
    walk(model.node);
    for (const node of report.nodes) if (node.mesh) triangles += node.mesh.indices / 3;
    // glTF 沒有循環旗標：展示台上每段都循環播，看得出頭尾接不接。
    if (animator) for (const clip of clips) { const state = (animator as Laya.Animator).getControllerLayer(0).getAnimatorState(clip.name); if (state?.clip) state.clip.islooping = true; }

    let current: (typeof clips)[number] | null = null;
    let sampler: ZhudaModelAnimationSampler | null = null;
    let frozenAt: number | null = null;
    const fadeDefault = number('fade', 0.18);
    const play = (name: string, fade = fadeDefault) => {
      const clip = clips.find((c) => c.name === name);
      if (!clip) return false;
      sampler?.dispose();
      sampler = null;
      frozenAt = null;
      // 以秒計的淡入：LayaAir 自己吃的是「正在播的那段的幾分之幾」，引擎換算好了。
      if (current && fade > 0) inspector.crossFade(clip.path, clip.name, { seconds: fade });
      else inspector.play(clip.path, clip.name);
      current = clip;
      return true;
    };
    const freeze = (seconds: number | null) => {
      const held = sampler;
      sampler?.dispose();
      sampler = null;
      frozenAt = null;
      // 解除定格才重新播；本來就在播（或正在淡入）的不要打斷。
      if (seconds === null || !current) return void (held && current && inspector.play(current.path, current.name));
      sampler = new ZhudaModelAnimationSampler(model, current.path, current.name);
      sampler.sample(seconds, true);
      frozenAt = seconds;
    };
    if (clips.length) play(clips.some((c) => c.name === params.get('clip')) ? params.get('clip')! : clips[0].name, 0);
    if (params.has('t')) freeze(number('t', 0));

    // 鏡頭繞著角色的腰轉；?tall= 是角色大約多高。
    let tall = number('tall', 1.7);
    let aim: V3 | null = null;
    const orbit = { yaw: number('yaw', 0.42), pitch: number('pitch', 0.1), distance: number('distance', 0) };
    let drag: { x: number; y: number } | null = null;
    container.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY }));
    window.addEventListener('pointerup', () => (drag = null));
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      orbit.yaw -= (e.clientX - drag.x) * 0.006;
      orbit.pitch = clamp(orbit.pitch + (e.clientY - drag.y) * 0.004, -0.2, 1.3);
      drag = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener('wheel', (e) => (orbit.distance = clamp((orbit.distance || tall * 2.4) * Math.exp(e.deltaY * 0.001), tall * 0.3, tall * 12)), { passive: true });
    window.addEventListener('resize', () => context.resize());

    const status = document.createElement('div');
    status.style.cssText = 'position:absolute;left:16px;bottom:14px;padding:6px 10px;border-radius:8px;background:rgba(30,20,40,.55);color:#fff;font:12px/1.5 -apple-system,"PingFang TC",sans-serif;z-index:4;pointer-events:none';
    container.append(status);
    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;left:16px;top:14px;display:flex;gap:6px;flex-wrap:wrap;max-width:70%;z-index:4;font:13px/1.2 -apple-system,"PingFang TC",sans-serif';
    if (params.get('hud') !== '0') container.append(panel);
    for (const clip of clips) {
      const b = document.createElement('button');
      b.textContent = `${clip.name} ${clip.seconds.toFixed(1)}s`;
      b.style.cssText = 'padding:7px 12px;border:0;border-radius:9px;background:rgba(255,255,255,.88);color:#2a2236;font:inherit;cursor:pointer';
      b.addEventListener('click', () => play(clip.name));
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      panel.appendChild(b);
    }

    const where = (name: string): V3 | null => {
      const p = named.get(name)?.transform.position;
      return p ? [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)] : null;
    };
    let frames = 0,
      clock = 0;
    setSceneHook({
      ready: false,
      state: () => {
        const ps = animator?.getCurrentAnimatorPlayState(0);
        return { file, placed, clips: clips.map((c) => ({ name: c.name, seconds: +c.seconds.toFixed(3) })), clip: current?.name ?? null, normalizedTime: ps ? +ps.normalizedTime.toFixed(3) : null, frozenAt, triangles, nodes: report.nodes.length, materials: report.materials.length, named: named.size, clock: +clock.toFixed(3), renderer: context.renderer.selected };
      },
      set: (o: { clip?: string; fade?: number; freeze?: number | null; yaw?: number; pitch?: number; distance?: number; tall?: number; aim?: V3 | null }) => {
        if (o.clip !== undefined) play(o.clip, o.fade);
        if (o.freeze !== undefined) freeze(o.freeze);
        if (o.yaw !== undefined) orbit.yaw = o.yaw;
        if (o.pitch !== undefined) orbit.pitch = o.pitch;
        if (o.distance !== undefined) orbit.distance = o.distance;
        if (o.tall !== undefined) tall = o.tall;
        if (o.aim !== undefined) aim = o.aim;
      },
      where,
      errors: () => context.renderer.errors.slice(0, 6),
    });
    const hook = Reflect.get(window, '__SCENE__') as { ready: boolean };
    let uncovered = false;
    void whenZhudaSplashGone().then(
      () => (uncovered = true),
      () => (uncovered = true),
    );
    context.runtime.start((dt: number) => {
      clock += dt;
      const distance = orbit.distance || tall * 2.4;
      const target: V3 = aim ?? [0, tall * 0.52, 0];
      const eye: V3 = [target[0] + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * distance, target[1] + Math.sin(orbit.pitch) * distance, target[2] + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * distance];
      camera.transform.position = new Laya.Vector3(...eye);
      camera.transform.lookAt(new Laya.Vector3(...target), new Laya.Vector3(0, 1, 0), false);
      look.update(eye, target, FOV, Laya.stage.width / Math.max(1, Laya.stage.height), dt);
      status.textContent = `${file.split('/').pop()}・${triangles} 個三角形・${clips.length} 段動作・${frozenAt === null ? `正在播 ${current?.name ?? '（沒有動作）'}` : `停在 ${current?.name} 第 ${frozenAt} 秒`}`;
      if (++frames >= 20 && uncovered) hook.ready = true;
    });
  },
};
