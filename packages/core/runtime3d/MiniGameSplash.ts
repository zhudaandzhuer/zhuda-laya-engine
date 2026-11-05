import type { ZhudaBootContext } from '../DeclarativeSDK.ts';
import { withDeadline } from './AsyncDeadline.ts';
import { awaitAbortable } from './AsyncOperation.ts';

/** Platform branding runs on the existing session clock before consumer startup. */
export async function showMiniGameSplash(context: ZhudaBootContext, signal?: AbortSignal, timeoutMs = 30_000): Promise<void> {
  const config = (globalThis as unknown as {__ZHUDA_MINIGAME__?: {branding?: {mode: string; logo?: string}}}).__ZHUDA_MINIGAME__;
  const branding = config?.branding;
  if (!branding || branding.mode === 'none' || !branding.logo) return;
  const url = branding.logo;
  const panel = new Laya.Sprite(), logo = new Laya.Sprite();
  panel.name = 'ZhudaPlatformSplash'; panel.zOrder = 2147483000;
  panel.mouseEnabled = true; panel.addChild(logo);
  Laya.stage.addChild(panel);
  let ready = false, elapsed = 0;
  const release = () => Laya.loader.clearRes(url);
  try {
    await withDeadline(async cancellation => {
      const texture = await awaitAbortable(Laya.loader.load(url, Laya.Loader.IMAGE), cancellation, release);
      if (!(texture instanceof Laya.Texture)) throw Error('Mini-game branding image failed to load');
      logo.texture = texture; ready = true;
      await awaitAbortable(new Promise<void>(resolve => {
        context.runtime.start(dt => {
          if (!ready || context.runtime.disposed) return;
          elapsed += dt;
          const width = Laya.stage.width, height = Laya.stage.height;
          panel.size(width, height); panel.graphics.clear();
          panel.graphics.drawRect(0, 0, width, height, '#0b1220');
          const fit = Math.min(width * .82 / texture.width, height * .5 / texture.height);
          const entrance = Math.min(1, elapsed / .5);
          logo.size(texture.width * fit, texture.height * fit);
          logo.pivot(logo.width / 2, logo.height / 2);
          logo.pos(width / 2, height / 2);
          logo.scale(.9 + .1 * entrance, .9 + .1 * entrance);
          panel.alpha = elapsed > 1.4 ? Math.max(0, (1.8 - elapsed) / .4) : entrance;
          if (elapsed >= 1.8) resolve();
        });
      }), cancellation);
    }, {signal, timeoutMs});
  } finally {
    ready = false;
    if (!context.runtime.disposed) context.runtime.start(() => {});
    panel.destroy(true); release();
  }
}
