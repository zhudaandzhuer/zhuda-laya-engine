// Interactive 2D tutorial coach demonstration in the 2D viewer (?scene=tutorial-coach[&step=0..3]).
// Demonstrates StageTutorialCoach over dummy stage cells with tap, double-tap, drag and highlight zones.
import { ZhudaEngine } from 'zhuda-laya-engine';
import { setSceneHook, type ScenePreset } from '../preset.ts';
import type { TutorialStep } from '../common/systems/tutorial/tutorial.ts';
import { StageTutorialCoach } from '../common/2d/tutorial-coach/tutorial-coach.ts';

const W = 720;
const H = 1280;

export const tutorialCoach: ScenePreset = {
  id: 'tutorial-coach',
  title: '2D 新手教學引導層（聚光燈＋小手）',
  summary:
    '純 Laya 2D 舞台新手教學引導模組（systems/tutorial + 2d/tutorial-coach），無瀏覽器 DOM，支援點按／雙擊／拖曳手勢、鏤空點擊穿透與防遮擋說明氣泡，可直接用於網頁與微信小遊戲。',
  modules: ['systems/tutorial', '2d/tutorial-coach'],
  views: {
    '1. 雙擊目標格': 'step=0',
    '2. 紅框禁區＋按鈕': 'step=1',
    '3. 拖曳手勢': 'step=2',
  },
  async start(container, params) {
    const context = await ZhudaEngine.boot({
      container,
      width: W,
      height: H,
      features: ['core', '2d', 'ui'],
      bgColor: '#FAF3E4',
      scaleMode: 'showall',
    });

    const board = new Laya.Sprite();
    board.pos(120, 360);
    const cell = 120;
    const cols = ['#FCE5DF', '#FCEFD6', '#E4F3E5', '#E2ECF7'];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const reg = r < 2 ? (c < 2 ? 0 : 1) : c < 2 ? 2 : 3;
        board.graphics.drawRect(c * cell, r * cell, cell, cell, cols[reg], '#7A5039', 2);
      }
    }
    Laya.stage.addChild(board);

    const overlay = new Laya.Sprite();
    Laya.stage.addChild(overlay);

    const cellRect = (r: number, c: number) => ({
      x: 120 + c * cell,
      y: 360 + r * cell,
      width: cell,
      height: cell,
    });

    const coach = new StageTutorialCoach(overlay, {
      width: W,
      height: H,
      topInset: 24,
      bottomInset: 24,
      tapOutsideText: '請點擊亮起的目標格試試看！',
    });

    const steps: TutorialStep[] = [
      {
        id: 'double_tap',
        title: '第一步：雙擊放置角色',
        body: '聚光燈只放行中央格子點擊，手指動畫清楚示範「連點兩下」或雙擊動作！',
        target: () => cellRect(0, 1),
        gesture: { type: 'double-tap' },
        waitFor: 'placed',
        showNextWithEvent: true,
      },
      {
        id: 'blocked_zones',
        title: '第二步：辨識安全與禁止區',
        body: '可同時標示多種次要高亮區（綠色安全 / 紅色排除），氣泡會自動閃避目標區不遮擋畫面。',
        target: () => cellRect(1, 2),
        highlights: [
          { rect: cellRect(0, 0), tone: 'blocked' },
          { rect: cellRect(0, 1), tone: 'blocked' },
          { rect: cellRect(0, 2), tone: 'blocked' },
          { rect: cellRect(2, 3), tone: 'safe' },
        ],
        advance: 'next',
      },
      {
        id: 'drag_sweep',
        title: '第三步：拖曳滑過手勢',
        body: 'drag 手勢會繪製虛線導軌與滑動手指；底下的真實拖曳與放開事件仍可直接送達遊戲棋盤。',
        target: () => ({ x: 120 + cell, y: 360 + cell * 2, width: cell * 2, height: cell }),
        gesture: {
          type: 'drag',
          from: { x: 120 + cell * 1.5, y: 360 + cell * 2.5 },
          to: { x: 120 + cell * 2.5, y: 360 + cell * 2.5 },
        },
        advance: 'next',
      },
    ];

    coach.show(steps);
    const startStep = Number(params.get('step') ?? 0);
    for (let i = 0; i < Math.max(0, Math.min(2, startStep)); i++) coach.next();

    let frames = 0;
    const hook = {
      ready: false,
      state: () => ({ frames, tutorial: coach.report() }),
      set: (opts: Record<string, unknown>) => {
        if (typeof opts.step === 'number') {
          coach.show(steps);
          for (let i = 0; i < opts.step; i++) coach.next();
        }
      },
      errors: () => context.renderer.errors.slice(0, 6),
    };
    setSceneHook(hook);
    context.runtime.start((dt) => {
      coach.update(dt);
      if (++frames === 10) hook.ready = true;
    });
  },
};
