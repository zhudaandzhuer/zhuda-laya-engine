// 囂張小黑人站在地上，兩段 idle 用 LayaAir 自己的 Animator 播放、互相 crossfade。
// 左上角的按鈕換段（0.35 秒過渡），「自動輪播」讓 StickmanIdles 每兩三輪自己換。
// 拖曳轉視角、滾輪拉近。?clip=Idle_ArmsCrossed 從抱胸開始；?auto=0 不自動換；?maps=0 關掉法線貼圖和環境遮蔽（normal／occlusion 只留一張）。
import { ZhudaEngine, Zhuda3D, ZhudaModelLibrary, ZhudaModelInspector, ZhudaSceneLook, DirectoryAssetProvider, createSurfaceMaterial } from 'zhuda-laya-engine';
import { skyAt, OCEAN, type WeatherMix } from '../common/3d/day-look.ts';
import { STICKMAN, STICKMAN_CLIPS, STICKMAN_CLIP_NAMES, StickmanIdles, fadeShare, repairGltfCrossFade, stickmanPath, type StickmanClip } from '../common/3d/stickman/stickman.ts';
import { clamp, type V3 } from '../common/3d/math.ts';
import { setSceneHook, type ScenePreset } from '../preset.ts';

const DEFAULT_FOV = 32;

export const stickman: ScenePreset = {
  id: 'stickman',
  title: '囂張小黑人：低模角色＋兩段 idle',
  summary: '黑色大頭小人（2994 個三角形、一個材質、20 根骨頭），叉腰挺胸與抱胸點腳兩段 idle，用 LayaAir 的 Animator 互相 crossfade。賽車遊戲車庫、角色選擇畫面可以直接放。',
  modules: ['3d/stickman', '3d/day-look', '3d/math'],
  views: { 自動輪播: '', 叉腰: 'clip=Idle_HandsOnHips&auto=0', 抱胸: 'clip=Idle_ArmsCrossed&auto=0', 正面: 'yaw=0&auto=0' },
  async start(container, params) {
    const width = Number(params.get('width')) || window.innerWidth || 1280,
      height = Number(params.get('height')) || window.innerHeight || 720;
    container.style.position = 'relative';
    // ?fov=8 配遠距離（distance 9）接近正交投影，和三視圖並排比用。
    const FOV = Number(params.get('fov')) || DEFAULT_FOV;
    // ?look=studio（預設）：像三視圖那樣的白色攝影棚，光從四面八方均勻來、反差小，看材質本來的顏色。
    // ?look=outdoor：戶外天光＋太陽（遊戲場景裡大概的樣子）。?bind=1：不播動作，停在綁定姿勢（A 字手，和三視圖同姿勢）。
    const studioMode = (params.get('look') ?? 'studio') !== 'outdoor';
    const bindPose = params.get('bind') === '1';
    const context = await ZhudaEngine.boot({ container, width, height, dprCap: Number(params.get('dpr')) || 1.5, features: ['core', '3d', 'gltf', 'postProcess'], bgColor: studioMode ? '#ebebeb' : '#a58bbd' });
    const scene = Zhuda3D.createScene3D(context.rootScene);
    const camera = Zhuda3D.createCamera(scene, { position: [0, 1, 4], rotationEuler: [0, 0, 0], fov: FOV, near: 0.05, far: 200 });
    const calm: WeatherMix = { rain: 0, storm: 0, mist: 0 };
    // 白天的天空，但太陽從角色的左前方照過來（角色面向 +Z），環境光改成不偏藍的灰，眼白才是白的。
    const sky = skyAt(10.5, calm, 4, 0, 8, ['clouds', 'fog'], OCEAN).look;
    // 不額外打光：用天空本來的環境光（使用者：「不要特別加光，要物理光的樣子」），只把太陽轉到角色的左前方。
    // ?amb=、?ground= 只在要試光時用。
    const amb = params.get('amb'), ground = params.get('ground');
    const outdoor = {
      ...sky,
      sun: { ...sky.sun, azimuthDeg: -35, elevationDeg: 40 },
      ...(amb ? { ambient: [Number(amb), Number(amb) * 0.97, Number(amb)] as [number, number, number] } : {}),
      ...(ground ? { ambientGround: [Number(ground), Number(ground) * 0.97, Number(ground) * 0.92] as [number, number, number] } : {}),
    };
    // 攝影棚：白色、中性（不偏藍）、四周都有光、太陽很弱，影子淡；不做暈影、顆粒。
    const grey = (v: number) => [v, v, v] as [number, number, number];
    const studioLook = {
      ...sky,
      sky: grey(1),
      atmosphere: false as const,
      ambient: grey(Number(amb ?? 1.05)),
      ambientGround: grey(Number(ground ?? 0.85)),
      sun: { azimuthDeg: -30, elevationDeg: 55, intensity: 0.7, color: grey(1) },
      shadows: { ...sky.shadows, strength: 0.35 },
      fog: { color: grey(0.92), start: 60, end: 200 },
      grade: { ...sky.grade, contrast: 1, saturation: 1, vignette: 0, grain: 0, bloom: 0.05 },
      lightFog: false as const,
    };
    const look = new ZhudaSceneLook(scene, camera, studioMode ? studioLook : outdoor, { quality: 2, cameraPasses: { depth: true, opaque: true } });

    const floor = new Laya.MeshSprite3D(Laya.PrimitiveMesh.createPlane(60, 60, 1, 1));
    floor.meshRenderer.sharedMaterial = createSurfaceMaterial({ type: 'pbr', color: studioMode ? [0.9, 0.9, 0.9, 1] : [0.78, 0.5, 0.62, 1], roughness: 0.9, metallic: 0 }) as Laya.Material;
    floor.meshRenderer.receiveShadow = true;
    scene.addChild(floor);

    const provider = new DirectoryAssetProvider({ baseUrl: './', timeoutMs: 60_000 });
    const models = new ZhudaModelLibrary({ provider, timeoutMs: 60_000 });
    const model = await models.instantiate(stickmanPath(), { retries: 2 });
    scene.addChild(model.node);
    const inspector = new ZhudaModelInspector(model);
    const report = inspector.inspect();

    // 模型裡的東西：網格、材質、骨頭（給檢查看）。
    let animator: Laya.Animator | null = null;
    const bones = new Map<string, Laya.Sprite3D>();
    let triangles = 0,
      meshes = 0;
    const walk = (n: Laya.Node) => {
      const s = n as Laya.Sprite3D;
      animator ??= s.getComponent?.(Laya.Animator) as Laya.Animator | null;
      const renderer = s.getComponent?.(Laya.BaseRender) as Laya.BaseRender | null;
      if (renderer) (renderer.castShadow = true), (renderer.receiveShadow = true);
      // ?maps=0：關掉法線貼圖和環境遮蔽（同一個模型，比較有沒有貼圖的差別）；?maps=normal 只留法線、?maps=occlusion 只留遮蔽。
      const keep = params.get('maps');
      const off = keep === '0' ? ['NORMALMAP', 'OCCLUSIONMAP'] : keep === 'normal' ? ['OCCLUSIONMAP'] : keep === 'occlusion' ? ['NORMALMAP'] : [];
      if (renderer) for (const m of renderer.sharedMaterials ?? []) for (const name of off) m?.removeDefine(Laya.Shader3D.getDefineByName(name));
      if (s.name) bones.set(s.name, s);
      for (let k = 0; k < n.numChildren; k++) walk(n.getChildAt(k));
    };
    walk(model.node);
    for (const node of report.nodes) if (node.mesh) (meshes++, (triangles += node.mesh.indices / 3));
    if (!animator) throw Error('stickman.glb has no animator');
    const anim = animator as Laya.Animator;
    // LayaAir 3.4.2 讀 glTF 動作的字典 bug：不修的話 crossFade 會先混向綁定姿勢、最後一格才跳到目標（?repair=0 看修之前）。
    const repaired = params.get('repair') === '0' ? 0 : repairGltfCrossFade(anim);
    // glTF 沒有循環旗標：兩段都設成循環。
    for (const name of STICKMAN_CLIPS) {
      const state = anim.getControllerLayer(0).getAnimatorState(name);
      if (!state?.clip) throw Error(`stickman.glb has no clip ${name}`);
      state.clip.islooping = true;
    }
    const playing = () => anim.getCurrentAnimatorPlayState(0);
    const plays: { clip: StickmanClip; fade: number; share: number; at: number }[] = [];
    let clock = 0;
    let current: StickmanClip | null = null;
    const play = (clip: StickmanClip, fade: number) => {
      const playingSeconds = playing()?.animatorState?.clip?.duration() ?? 0;
      const share = fadeShare(fade, playingSeconds);
      if (share > 0) anim.crossFade(clip, share, 0, 0);
      else anim.play(clip, 0, 0);
      plays.push({ clip, fade, share: +share.toFixed(4), at: +clock.toFixed(3) });
      current = clip;
      updateButtons();
    };

    // 介面：三個按鈕和一行狀態。
    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;left:16px;top:14px;display:flex;gap:8px;flex-wrap:wrap;z-index:4;font:14px/1.2 -apple-system,"PingFang TC",sans-serif';
    const status = document.createElement('div');
    status.style.cssText = 'position:absolute;left:16px;bottom:14px;padding:6px 10px;border-radius:8px;background:rgba(30,20,40,.55);color:#fff;font:12px/1.5 -apple-system,"PingFang TC",sans-serif;z-index:4;pointer-events:none';
    container.append(panel, status);
    const buttons = new Map<string, HTMLButtonElement>();
    const button = (key: string, label: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'padding:9px 16px;border:0;border-radius:10px;background:rgba(255,255,255,.88);color:#2a2236;font:inherit;cursor:pointer';
      b.addEventListener('click', onClick);
      panel.appendChild(b);
      buttons.set(key, b);
    };
    let auto = params.get('auto') !== '0';
    const first = (STICKMAN_CLIPS as readonly string[]).includes(params.get('clip') ?? '') ? (params.get('clip') as StickmanClip) : 'Idle_HandsOnHips';
    const idles = new StickmanIdles(play, { first });
    if (!auto) idles.hold(first);
    if (bindPose) ((auto = false), (anim.enabled = false));
    for (const clip of STICKMAN_CLIPS) button(clip, STICKMAN_CLIP_NAMES[clip], () => ((auto = false), idles.hold(clip), updateButtons()));
    button('auto', '自動輪播', () => ((auto = true), idles.resume(), updateButtons()));
    function updateButtons() {
      for (const [key, b] of buttons) {
        const on = key === 'auto' ? auto : !auto && current === key;
        b.style.background = on ? '#2a2236' : 'rgba(255,255,255,.88)';
        b.style.color = on ? '#fff' : '#2a2236';
      }
    }
    updateButtons();

    const orbit = { yaw: Number(params.get('yaw') ?? 0.42), pitch: 0.1, distance: 3.4 };
    const target: V3 = [0, 0.64, 0];
    let drag: { x: number; y: number } | null = null;
    container.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).tagName !== 'BUTTON') drag = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', () => (drag = null));
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      orbit.yaw -= (e.clientX - drag.x) * 0.006;
      orbit.pitch = clamp(orbit.pitch + (e.clientY - drag.y) * 0.004, -0.1, 1.2);
      drag = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener('wheel', (e) => (orbit.distance = clamp(orbit.distance * Math.exp(e.deltaY * 0.001), 1.2, 12)), { passive: true });
    window.addEventListener('resize', () => context.resize());

    const where = (name: string): V3 => {
      const p = bones.get(name)?.transform.position;
      return p ? [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)] : [NaN, NaN, NaN];
    };
    let frames = 0;
    setSceneHook({
      ready: false,
      state: () => {
        const ps = playing();
        return {
          clock: +clock.toFixed(3),
          repaired,
          clip: ps?.animatorState?.name ?? null,
          normalizedTime: ps ? +ps.normalizedTime.toFixed(3) : null,
          auto,
          triangles,
          meshes,
          materials: report.materials.length,
          clips: report.animations.map((a) => ({ name: a.name, seconds: +a.durationSeconds.toFixed(3) })),
          plays: plays.slice(-6),
        };
      },
      set: (o: { clip?: StickmanClip; fade?: number; auto?: boolean; yaw?: number; pitch?: number; distance?: number; target?: V3 }) => {
        if (o.target) target.splice(0, 3, ...o.target);
        if (o.yaw !== undefined) orbit.yaw = o.yaw;
        if (o.pitch !== undefined) orbit.pitch = o.pitch;
        if (o.distance !== undefined) orbit.distance = o.distance;
        if (o.auto === true) ((auto = true), idles.resume());
        if (o.clip) ((auto = false), idles.hold(o.clip), o.fade !== undefined && idles.clip === o.clip && play(o.clip, o.fade));
        updateButtons();
      },
      /** 骨頭現在的世界位置：手、頭、腳。用來證明動作在動、crossfade 在中間。 */
      bones: () => Object.fromEntries(['handL', 'handR', 'head', 'footL', 'footR', 'root'].map((n) => [n, where(n)])),
      errors: () => context.renderer.errors.slice(0, 6),
    });
    const hook = Reflect.get(window, '__SCENE__') as { ready: boolean };
    context.runtime.start((dt: number) => {
      clock += dt;
      if (auto) idles.update(dt);
      const eye: V3 = [
        target[0] + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance,
        target[1] + Math.sin(orbit.pitch) * orbit.distance,
        target[2] + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance,
      ];
      camera.transform.position = new Laya.Vector3(...eye);
      camera.transform.lookAt(new Laya.Vector3(...target), new Laya.Vector3(0, 1, 0), false);
      look.update(eye, target, FOV, Laya.stage.width / Math.max(1, Laya.stage.height), dt);
      const ps = playing();
      status.textContent = `${STICKMAN.name}・${triangles} 個三角形・${meshes} 個網格・${report.materials.length} 個材質・${STICKMAN.joints} 根骨頭・正在播：${STICKMAN_CLIP_NAMES[(ps?.animatorState?.name ?? '') as StickmanClip] ?? '—'}${auto ? '（自動輪播）' : ''}`;
      if (++frames === 30) hook.ready = true;
    });
  },
};
