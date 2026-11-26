// Spine 褲襪：一張照片切成零件的 Spine 4.2 骨架，穿黑色透膚褲襪、外面一條百褶裙。拖曳裙子：離手指最近的那條褶
// 用 IK 跟著手指，其他的靠 Spine 物理跟著擺，放手自己盪回去。拖曳腿：那一處的絲襪跟著手指被拉開，拉夠遠就撕破
// （先小洞、再大洞）。在背景上連點兩下全部復原。
// ?tearAt=<拉到腿寬的幾倍會破，預設 0.8>&dpr=；?torn=<部位:1|2,…> 開場就先撕（例 torn=L_thigh:2,R_knee:1）。
import { ZhudaEngine, ZhudaSpineCharacter, whenZhudaSplashGone } from 'zhuda-laya-engine';
import { TIGHTS_BACKGROUND_CSS, TIGHTS_CANVAS, TIGHTS_IDLE, createSpineTights, fitTights, tightsPath, type TearSite } from '../common/2d/spine-tights/spine-tights.ts';
import { setSceneHook, type ScenePreset } from '../preset.ts';

export const spineTights: ScenePreset = {
  id: 'spine-tights',
  title: 'Spine 褲襪：拉扯、撕破、掀裙',
  summary:
    '一套 Spine 4.2 骨架（照片切件，用 zhuda-spine2D 工具組做的）：百褶裙是掛在九條褶鏈上的一張網格，帶 Spine 物理；褲襪是一張網格，十個撕裂點各有一根骨頭；破洞是換上去的貼片。由引擎的 ZhudaSpineCharacter 畫，遊戲只給手指的位置。',
  modules: ['2d/spine-tights'],
  views: { 完好: '', 兩腿各撕一個小洞: 'torn=L_thigh:1,R_knee:1', 全部撕成大洞: 'torn=all:2', '直式 390×844': 'width=390&height=844' },
  async start(container, params) {
    const number = (name: string, fallback: number) => (params.has(name) ? Number(params.get(name)) : fallback);
    container.style.background = TIGHTS_BACKGROUND_CSS;
    const context = await ZhudaEngine.boot({ container, dprCap: number('dpr', 2), features: ['core', '2d', 'spine42'], bgColor: TIGHTS_BACKGROUND_CSS });
    const stage = Laya.stage;
    const [background, templet, sites] = await Promise.all([
      Laya.loader.load(tightsPath('background')) as Promise<any>,
      Laya.loader.load(tightsPath('rig'), Laya.Loader.SPINE) as Promise<any>,
      fetch(tightsPath('sites')).then((r) => r.json() as Promise<TearSite[]>),
    ]);
    if (!templet) throw Error('the Spine rig did not load');

    // 一個裝著背景和骨架的圖層，用照片的像素當座標，再整個縮放到畫面上。
    const picture = new Laya.Sprite();
    context.rootScene.addChild(picture);
    picture.graphics.drawTexture(background, 0, 0, TIGHTS_CANVAS.width, TIGHTS_CANVAS.height);
    const spine = new ZhudaSpineCharacter({ parent: picture, templet, animation: TIGHTS_IDLE });
    const fit = () => {
      const { scale, x, y } = fitTights(stage.width, stage.height);
      picture.scale(scale, scale);
      picture.pos(x, y);
    };
    fit();
    stage.on(Laya.Event.RESIZE, null, fit);

    const tights = createSpineTights(spine, sites, { tearAt: number('tearAt', 0.8) });
    for (const entry of (params.get('torn') ?? '').split(',').filter(Boolean)) {
      const [name, stageText] = entry.split(':');
      for (const site of name === 'all' ? sites : sites.filter((s) => s.name === name)) for (let k = 0; k < (Number(stageText) || 1); k++) tights.tear(site.name);
    }

    // --- 指標：換成照片的像素再交給模組 ---------------------------------------------------------
    let inputError: string | undefined;
    let pointer: number | null = null;
    let lastTap = 0;
    const local = (event: PointerEvent) => {
      const box = container.getBoundingClientRect();
      return spine.stageToCanvas(((event.clientX - box.left) / box.width) * stage.width, ((event.clientY - box.top) / box.height) * stage.height);
    };
    const guard = (handler: (event: PointerEvent) => void) => (event: PointerEvent) => {
      try {
        handler(event);
      } catch (error: any) {
        inputError = String(error?.stack || error).slice(0, 400);
      }
    };
    const down = (event: PointerEvent) => {
      if (pointer !== null || event.button !== 0) return;
      const [x, y] = local(event);
      container.setPointerCapture?.(event.pointerId);
      if (tights.press(x, y)) {
        pointer = event.pointerId;
        return;
      }
      const now = performance.now();
      if (now - lastTap < 350) tights.reset();
      lastTap = now;
    };
    const move = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      const [x, y] = local(event);
      tights.drag(x, y);
      // 撕破的那一下模組自己放手。
      if (!tights.held) pointer = null;
    };
    const up = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      tights.release();
      pointer = null;
    };
    container.addEventListener('pointerdown', guard(down), true);
    container.addEventListener('pointermove', guard(move), true);
    for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture']) container.addEventListener(kind, guard(up) as EventListener, true);

    let frames = 0;
    setSceneHook({
      ready: false,
      state: () => ({ ...tights.stats(), sites: sites.length, stage: [stage.width, stage.height], renderer: context.renderer.selected, spine: spine.diagnostics(), frames, inputError }),
      set: (o: { tear?: string; reset?: boolean }) => {
        if (o.reset) tights.reset();
        if (o.tear) tights.tear(o.tear);
      },
      errors: () => context.renderer.errors.slice(0, 6),
      tights,
      spine,
      sites,
      /** 照片上的一點在頁面上的位置（CSS 像素），給用真滑鼠的檢查用。 */
      toPage: (x: number, y: number) => {
        const box = container.getBoundingClientRect();
        const { scale, x: left, y: top } = fitTights(stage.width, stage.height);
        return [box.left + ((left + x * scale) / stage.width) * box.width, box.top + ((top + y * scale) / stage.height) * box.height];
      },
      /** 一條褶鏈末端現在在照片上的位置。 */
      hem: (chain: number) => spine.boneTipCanvas(`pleat${chain}_3`),
    });
    const hook = Reflect.get(window, '__SCENE__') as { ready: boolean };
    // 引擎的開場畫面還蓋在上面時，按下去的是它不是腿：等它走了才算準備好。
    let uncovered = false;
    void whenZhudaSplashGone().then(
      () => (uncovered = true),
      () => (uncovered = true),
    );
    context.runtime.start(() => {
      spine.update();
      tights.step(context.runtime.layers.scaledDeltas.get('world') ?? 1 / 60);
      if (++frames >= 12 && uncovered) hook.ready = true;
    });
  },
};
