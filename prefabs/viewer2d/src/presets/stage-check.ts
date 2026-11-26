// The smallest 2D preset: boots the engine on a design-size stage and draws a grid with
// its size and the device pixel ratio, to see that the 2D viewer itself works.
// ?width=&height= set the design size (default 1280×720).
import { ZhudaEngine } from 'zhuda-laya-engine';
import { setSceneHook, type ScenePreset } from '../preset.ts';

export const stageCheck: ScenePreset = {
  id: 'stage-check',
  title: '2D 舞台檢查',
  summary: '只啟動引擎、畫格線和設計尺寸，用來確認 2D 觀看台本身能動。',
  modules: ['ui/dom'],
  views: { '1280×720': '', '直式 572×1024': 'width=572&height=1024' },
  async start(container, params) {
    const width = Number(params.get('width')) || 1280,
      height = Number(params.get('height')) || 720;
    const context = await ZhudaEngine.boot({ container, width, height, features: ['core', '2d', 'ui'], bgColor: '#1d2330', scaleMode: 'showall' });
    const grid = new Laya.Sprite();
    for (let x = 0; x <= width; x += 40) grid.graphics.drawLine(x, 0, x, height, x % 200 ? '#2c3446' : '#46506a', 1);
    for (let y = 0; y <= height; y += 40) grid.graphics.drawLine(0, y, width, y, y % 200 ? '#2c3446' : '#46506a', 1);
    grid.graphics.drawRect(2, 2, width - 4, height - 4, null, '#7fb0ff', 4);
    Laya.stage.addChild(grid);
    const label = new Laya.Text();
    label.text = `${width} × ${height} · DPR ${window.devicePixelRatio}`;
    label.fontSize = 36;
    label.color = '#e8eefc';
    label.pos(40, 40);
    Laya.stage.addChild(label);
    let frames = 0;
    const hook = { ready: false, state: () => ({ width, height, frames }), set: () => {}, errors: () => context.renderer.errors.slice(0, 6) };
    setSceneHook(hook);
    context.runtime.start(() => {
      if (++frames === 10) hook.ready = true;
    });
  },
};
