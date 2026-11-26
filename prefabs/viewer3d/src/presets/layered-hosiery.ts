// 分層絲襪試驗台：一雙建模的腿，貼著皮膚一層絲襪，外面再一層裙子、短褲、長褲或不穿。拖曳大腿拉扯最上面那一層，
// 拉到底會撕破；褲子破了洞，從洞裡還能拉到底下的絲襪。拖曳裙擺掀起；拖曳空白處轉動，滾輪拉近。
// ?type=<絲襪>&color=<色號>&bottom=<下身>&yaw=&pitch=&zoom=&ty=；量測用：dpr、q、rs、up、aa、ao；hud=0 收起面板。
import { ZhudaEngine, Zhuda3D, ZhudaSceneLook, whenZhudaSplashGone, type ZhudaLookQuality } from 'zhuda-laya-engine';
import { HOSIERY_BACKGROUND, HOSIERY_BACKGROUND_CSS, HOSIERY_VIEW, HOSIERY_VIEW_LIMITS, LEGS_PATH, createHosieryWearer, frameHosiery, hosieryLook, mountHosieryStudio, pointerRay, type LegsFile } from '../common/3d/layered-hosiery/layered-hosiery.ts';
import { BOTTOMS } from '../common/3d/layered-hosiery/bottoms.ts';
import { COLORS, TYPES } from '../common/3d/layered-hosiery/patterns.ts';
import { createHud, hudInsets } from '../common/3d/layered-hosiery/bench-hud.ts';
import { clamp } from '../common/3d/math.ts';
import { setSceneHook, type ScenePreset } from '../preset.ts';

export const layeredHosiery: ScenePreset = {
  id: 'layered-hosiery',
  title: '分層絲襪：拉扯、撕破、裙子與褲子',
  summary:
    '建模的下半身（MakeHuman 基礎網格，約 16,000 個三角形一條腿）穿 15 種絲襪、13 種下身。絲襪和褲子是貼著皮膚的逐頂點位移層，能拉、能撕出破洞和抽絲；裙子是引擎的布料。全部走引擎公開 API，沒有貼圖檔（織紋是算出來的）。',
  modules: ['3d/layered-hosiery', '3d/math'],
  views: {
    '20D 黑絲配 A 字裙': '',
    蕾絲吊帶襪: 'type=garter&bottom=none',
    蕾絲花紋褲襪配西裝短褲: 'type=laceTights&bottom=woolShorts',
    網襪配破洞牛仔短褲: 'type=fishnet&bottom=rippedShorts',
    '後縫線（從背後看）': 'type=seam15&bottom=none&yaw=172',
    百褶短裙: 'type=sheer20&bottom=pleated',
    牛仔長褲: 'type=opaque80&bottom=jeans',
    不開面板: 'hud=0',
  },
  async start(container, params) {
    const number = (name: string, fallback: number) => (params.has(name) ? Number(params.get(name)) : fallback);
    const width = Number(params.get('width')) || window.innerWidth || 1280,
      height = Number(params.get('height')) || window.innerHeight || 720;
    container.style.position = 'relative';
    container.style.background = HOSIERY_BACKGROUND_CSS;
    const coarse = matchMedia('(pointer: coarse)').matches;
    // 手機：畫布開到兩倍 CSS 像素，3D 畫面只畫四分之三再用 FSR 拉回來（在 vivo V40 上量的：織紋看得見、約 43 fps）。
    const context = await ZhudaEngine.boot({ container, width, height, dprCap: number('dpr', 2), features: ['core', '3d', 'postProcess'], bgColor: HOSIERY_BACKGROUND_CSS });
    const scene = Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.3, 0.3, 0.32, 1] });
    const size = () => ({ width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight) });

    const showHud = params.get('hud') !== '0';
    const view = { ...HOSIERY_VIEW, yaw: (number('yaw', 0) * Math.PI) / 180, pitch: (number('pitch', 3) * Math.PI) / 180, zoom: number('zoom', 1) };
    let targetY: number | undefined = params.has('ty') ? number('ty', 0.5) : undefined;
    const frame = () => {
      const { width: w, height: h } = size();
      return frameHosiery(view, w, h, { ...(showHud ? hudInsets(w) : {}), targetY });
    };
    let { eye, target } = frame();
    const camera = Zhuda3D.createCamera(scene, { position: eye, fov: view.fov, near: 0.03, far: 60, clearColor: [...HOSIERY_BACKGROUND, 1] });
    const aimCamera = () => {
      ({ eye, target } = frame());
      camera.transform.position = new Laya.Vector3(...eye);
      camera.transform.lookAt(new Laya.Vector3(...target), new Laya.Vector3(0, 1, 0));
    };
    aimCamera();
    const quality = (params.has('q') ? number('q', 2) : coarse ? 2 : 3) as ZhudaLookQuality;
    const look = new ZhudaSceneLook(scene, camera, hosieryLook({ coarse, ao: number('ao', 0.6), antialias: (params.get('aa') as 'fxaa' | 'smaa' | 'msaa' | 'none' | null) ?? undefined }), { quality });
    const renderScale = number('rs', coarse ? 0.75 : 1);
    if (renderScale < 1) look.setRenderScale(renderScale, { upscale: (params.get('up') as any) || 'fsr' });
    mountHosieryStudio(scene, camera);

    const file = (await (await fetch(LEGS_PATH)).json()) as LegsFile;
    const type = TYPES.find((t) => t.id === params.get('type')) ?? TYPES[1];
    let hud: { update(): void } | null = null;
    const wearer = createHosieryWearer(scene, file, {
      coarse,
      type,
      color: params.has('color') ? Number(params.get('color')) : type.colors[0],
      bottom: BOTTOMS.find((b) => b.id === params.get('bottom')) ?? BOTTOMS[0],
      onChange: () => hud?.update(),
    });
    const resetView = () => {
      Object.assign(view, HOSIERY_VIEW);
      aimCamera();
    };
    if (showHud) {
      hud = createHud(container, {
        types: TYPES,
        colors: COLORS,
        bottoms: BOTTOMS,
        current: () => wearer.type,
        color: () => wearer.color,
        bottom: () => wearer.bottom,
        choose: (next, shade) => wearer.dress(next, shade),
        wear: (next) => wearer.wear(next),
        reset: () => {
          wearer.reset();
          resetView();
        },
      });
      hud.update();
    }

    // --- 指標：碰到腿或裙子就交給模組，碰到空白就轉鏡頭 -----------------------------------------
    let inputError: string | undefined;
    let pointer: { id: number; x: number; y: number; turning: boolean } | null = null;
    const guard = (handler: (event: PointerEvent) => void) => (event: PointerEvent) => {
      try {
        handler(event);
      } catch (error: any) {
        inputError = String(error?.stack || error).slice(0, 400);
      }
    };
    const down = (event: PointerEvent) => {
      if (pointer || event.button !== 0 || (event.target as HTMLElement).closest?.('[data-hud]')) return;
      const got = wearer.press(pointerRay(eye, target, view.fov, container.getBoundingClientRect(), event.clientX, event.clientY));
      container.setPointerCapture?.(event.pointerId);
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, turning: !got };
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x,
        dy = event.clientY - pointer.y;
      if (!pointer.turning) return wearer.drag(dx, dy);
      view.yaw = clamp(view.yaw - dx * 0.006, HOSIERY_VIEW_LIMITS.yaw[0], HOSIERY_VIEW_LIMITS.yaw[1]);
      view.pitch = clamp(view.pitch + dy * 0.004, HOSIERY_VIEW_LIMITS.pitch[0], HOSIERY_VIEW_LIMITS.pitch[1]);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      aimCamera();
    };
    const up = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      if (!pointer.turning) wearer.release(event.type === 'pointerup');
      pointer = null;
    };
    // 捕獲階段：LayaAir 自己在畫布上的輸入處理不能把事件攔走。
    container.addEventListener('pointerdown', guard(down), true);
    container.addEventListener('pointermove', guard(move), true);
    for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture']) container.addEventListener(kind, guard(up) as EventListener, true);
    container.addEventListener(
      'wheel',
      (event) => {
        if ((event.target as HTMLElement).closest?.('[data-hud]')) return;
        view.zoom = clamp(view.zoom * Math.exp(event.deltaY * 0.001), HOSIERY_VIEW_LIMITS.zoom[0], HOSIERY_VIEW_LIMITS.zoom[1]);
        aimCamera();
        event.preventDefault();
      },
      { passive: false },
    );
    window.addEventListener('resize', () => {
      context.resize();
      aimCamera();
    });

    setSceneHook({
      ready: false,
      state: () => ({ ...wearer.stats(), renderer: context.renderer.selected, quality: look.quality, yaw: +view.yaw.toFixed(3), pitch: +view.pitch.toFixed(3), zoom: +view.zoom.toFixed(3), cloth: wearer.cloth(), inputError }),
      set: (o: { type?: string; color?: number; bottom?: string; yaw?: number; pitch?: number; zoom?: number; ty?: number | null }) => {
        if (o.type !== undefined) {
          const next = TYPES.find((t) => t.id === o.type);
          if (next) wearer.dress(next, o.color ?? next.colors[0]);
        } else if (o.color !== undefined) wearer.dress(wearer.type, o.color);
        if (o.bottom !== undefined) {
          const next = BOTTOMS.find((b) => b.id === o.bottom);
          if (next) wearer.wear(next);
        }
        if (o.yaw !== undefined) view.yaw = o.yaw;
        if (o.pitch !== undefined) view.pitch = o.pitch;
        if (o.zoom !== undefined) view.zoom = o.zoom;
        if (o.ty !== undefined) targetY = o.ty ?? undefined;
        aimCamera();
      },
      errors: () => context.renderer.errors.slice(0, 6),
      wearer,
      /** 每一幀量一次拉扯量和裙擺的平均高度與左右位置，量 frames 幀：檢查放手後晃多久。 */
      trace: (frames = 180) =>
        new Promise((resolve) => {
          const out: number[][] = [];
          const sample = () => {
            const hem = wearer.hem();
            out.push([+wearer.amount.toFixed(4), +(hem?.y ?? 0).toFixed(5), +(hem?.x ?? 0).toFixed(5), +performance.now().toFixed(1)]);
            if (out.length < frames) requestAnimationFrame(sample);
            else resolve(out);
          };
          requestAnimationFrame(sample);
        }),
    });
    const hook = Reflect.get(window, '__SCENE__') as { ready: boolean };
    let frames = 0;
    const draw = () => {
      const { width: w, height: h } = size();
      look.update(eye, target, view.fov, w / h);
    };
    // 引擎的開場畫面還蓋在上面時，按下去的是它不是腿：等它走了才算準備好。
    let uncovered = false;
    void whenZhudaSplashGone().then(
      () => (uncovered = true),
      () => (uncovered = true),
    );
    context.runtime.start(() => {
      wearer.step(context.runtime.layers.scaledDeltas.get('world') ?? 1 / 60);
      draw();
      if (++frames >= 8 && uncovered) hook.ready = true;
    });
    draw();
    ZhudaEngine.flushRenderFrames(4);
  },
};
