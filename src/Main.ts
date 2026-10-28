import { ZhudaEngine } from '../packages/core/DeclarativeSDK';
import { registerAllReflectedComponents } from './.generated/zhuda-registry';
import { ZhudaShowcaseApp } from './ZhudaShowcaseApp';

/**
 * 豬大 LayaAir (Zhuda-LayaAir) — Zero-IDE AI-Native 啟動入口
 * 1. 自動執行 AST 掃描產出的類別反射註冊表 (取代 LayaAir IDE 黑盒)
 * 2. 透過 ZhudaEngine.boot 載入拓撲守衛、原型解毒補丁與 WebGL/WASM 管線
 * 3. 啟動 3D/2D/Spine 4.2 戰術踩地雷與引擎基準測試工作台
 */
async function bootstrap() {
  const { rootScene } = await ZhudaEngine.boot({
    width: 1280,
    height: 720,
    bgColor: '#0b0f17',
    features: 'all',
    beforeInit: () => {
      registerAllReflectedComponents();
    }
  });

  // 確保 Laya.init 後反射表與實例一致
  registerAllReflectedComponents();

  new ZhudaShowcaseApp(rootScene);
  ZhudaEngine.flushRenderFrames(4);
}

bootstrap().catch((err) => {
  console.error('[Zhuda-LayaAir] 啟動失敗:', err);
});
