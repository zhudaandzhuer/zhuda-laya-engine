/**
 * @zhuda-laya/mcp-server — Phase 2: AI-Native Anti-Hallucination Corpus & Golden Examples
 *
 * 解決痛點四 (AI 語料赤字與版本混淆)：
 * - 內建 Laya 1.x/2.x vs Laya 3.4.2 (@zhuda-laya/core) 對照護欄
 * - 內建 6 大致命崩潰診斷知識庫
 * - 內建 5 組 100% 零幻覺 Golden Examples 範例模版
 */

export const API_GUARDRAILS = [
 {id:'GUARD_TERRAIN_2D',topic:'2D terrain tile atlas chunks',hallucinatedLegacyApi:'Tiled JSON automatically supplies game collision rules',zhudaCanonicalApi:'new ZhudaTerrain2D(spec); new ZhudaTerrain2DRenderer(data,{parent,atlas,material}); renderer.setView(localRect); renderer.flush();',reason:'零為空tile；atlas/material是借用；blocked為資料。畫面chunk可卸載，遊戲規則仍由消費端決定。'},
 {id:'GUARD_TERRAIN_3D',topic:'3D terrain heightfield raycast LOD seam',hallucinatedLegacyApi:'bilinear height equals triangle mesh; per-chunk arbitrary LOD needs no seams',zhudaCanonicalApi:'ZhudaHeightfield.generate(config); new ZhudaTerrain3D(field,{parent,material}); terrain.setRegion(localXZBounds,1); field.brush(x,z,radius,delta); terrain.flush();',reason:'高度沿a-d三角對角線插值；同region統一stride1/2/4；field為全解析度權威資料，renderer query符合目前載入區域與stride。'},
 {id:'GUARD_SHADER_CONTRACT',topic:'shader uniform GLSL 2D 3D material',hallucinatedLegacyApi:'ShaderMaterial.ready means GPU compiled; raw shader globals can be copied from Three.js',zhudaCanonicalApi:'new ZhudaShaderMaterial(shaderRecipes.terrain3D); shader.setUniform("u_ZhudaSnowLine",6);',reason:'2D保留graphics premultiplied alpha/clipping/gamma；3D模板處理world normal/fog/output。surface不是完整main。JSON驗證不等於GPU編譯。'},
  {
    id: 'GUARD_INIT_BOOT',
    topic: '引擎啟動與 Stage 初始化',
    hallucinatedLegacyApi: 'Laya.init(1280, 720, Laya.WebGL); Laya.MiniAdpter.init();',
    zhudaCanonicalApi: 'const { stage, rootScene } = await ZhudaEngine.boot({ width: 1280, height: 720, features: "all" });',
    reason: 'Laya 3.4.2 採用非同步 Promise Laya.init(w, h)，且需在初始化前後掛載 Prototype Detox 與拓撲守衛。'
  },
  {
    id: 'GUARD_3D_MESH_CREATE',
    topic: '3D 網格與材質建立',
    hallucinatedLegacyApi: 'new Laya.MeshSprite3D(new THREE.BoxGeometry());',
    zhudaCanonicalApi:
      'const sp = new Laya.MeshSprite3D();\nsp.meshFilter.sharedMesh = Zhuda3D.createPrimitiveMesh("box", { width: 1, height: 1, depth: 1 });\nsp.meshRenderer.sharedMaterial = Zhuda3D.createMaterial({ albedoColor: [0.2, 0.5, 0.9, 1], shininess: 32 });',
    reason: 'Laya 3.4.2 支援 new MeshSprite3D(mesh,name)，也可另設 meshFilter.sharedMesh。必須使用 Laya.Mesh，不能直接塞 Three.js Geometry；材質由 meshRenderer.sharedMaterial 指定。'
  },
  {
    id: 'GUARD_DIRECTIONAL_LIGHT',
    topic: '3D 平行光組件',
    hallucinatedLegacyApi: 'const light = scene3D.addChild(new Laya.DirectionLight());',
    zhudaCanonicalApi: 'const { node, light } = Zhuda3D.createDirectionalLight(scene3D, { intensity: 1.3, rotationEuler: [-55, 35, 0] });',
    reason: 'Laya 3.4.2 已全面改為組件化 (Entity-Component)，燈光必須透過 Sprite3D.addComponent(Laya.DirectionLightCom) 掛載。'
  },
  {
    id: 'GUARD_VECTOR_BUTTON',
    topic: '純代碼 2D 向量按鈕',
    hallucinatedLegacyApi: 'const btn = new Laya.Button(); btn.graphics.drawRect(0, 0, 100, 40, "#336699");',
    zhudaCanonicalApi: 'const { root, label } = ZhudaUI.createVectorButton(parent, x, y, "按鈕文字", { width: 100, height: 40 }, onClick);',
    reason: 'Laya.Button 內部強依賴 AutoBitmap.setState，直接覆寫 graphics 在滑鼠懸停時會拋出 this._graphics.setState is not a function。'
  },
  {
    id: 'GUARD_COMPONENT_REFLECTION',
    topic: '自定義 Script 組件註冊 (脫離 IDE)',
    hallucinatedLegacyApi: 'export default class PlayerScript extends Laya.Script {} // 依賴 IDE 黑盒掃描',
    zhudaCanonicalApi: '@zhudaComponent({ className: "PlayerScript", category: "3d" })\nexport class PlayerScript extends Laya.Script {}',
    reason: '脫離 IDE 後必須透過 @zhudaComponent 裝飾器與 @zhuda-laya/compiler 的 AST 掃描器自動注入 ClassUtils.regClass。'
  },
  {
    id: 'GUARD_RAYCAST_3D',
    topic: '3D 相機螢幕射線拾取',
    hallucinatedLegacyApi: 'camera.viewportPointToRay(new Laya.Vector2(x, y)); // 缺少 out Ray 參數',
    zhudaCanonicalApi:
      'const ray = new Laya.Ray(new Laya.Vector3(), new Laya.Vector3());\ncamera.viewportPointToRay(new Laya.Vector2(screenX, screenY), ray);',
    reason: 'Laya 3.4.2 viewportPointToRay 為零 GC 設計，必須傳入預先配置的 Laya.Ray 實例作為輸出。'
  },
  {
    id: 'GUARD_STATIC_PREFAB_CALIBRATION',
    topic: '動態轉靜態資產 (.lh) 與像素/色差 (ΔE00) 孤立校準',
    hallucinatedLegacyApi: '每次修改 2px UI 座標或粒子色號都重新啟動完整遊戲 Runtime 肉眼比對',
    zhudaCanonicalApi:
      'const lh = ZhudaAssetSerializer.serializeNodeToHierarchy(node, { assetId: "assets/prefabs/MyCard.lh", targetSpec });\nconst report = PixelCalibrationEngine.calibrateAsset(lh);\nconst converged = ZhudaAssetSerializer.applyCalibrationPatches(lh, report.autoFixPatches);\nconst inst = ZhudaPrefab.instantiate(converged, parent);',
    reason: 'Laya 3.4.2 的 DrawRoundRectCmd 建構子預設 percent: true，必須透過 ZhudaAssetSerializer 顯式序列化 percent: false 並以 PixelCalibrationEngine 單步收斂至 0px 與 ΔE00=0。'
  }
];

export const ERROR_DIAGNOSTICS_DB = [
  {
    pattern: "Cannot read properties of undefined (reading 'I')",
    faultyModule: 'laya.box2D.js',
    rootCause: 'laya.box2D.js 在 laya.physics2D.js 之前被載入，頂層存取 Laya.Physics2D.I._factory 時 Laya.Physics2D 尚未定義。',
    fix: '使用 TopologyResolver.resolveByFeatures(["physics2d"]) 強制確保 laya.physics2D.js 排在 laya.box2D.js 之前。'
  },
  {
    pattern: 'Box2DShapeDef is not a constructor',
    faultyModule: 'laya.tilemap.js',
    rootCause: '載入了 laya.tilemap.js 卻未先載入 laya.physics2D.js，TileMap 內部在載入期直接繼承 Box2DShapeDef。',
    fix: '在 TopologyGraph 中將 physics2d 列為 tilemap 的硬性前置依賴 (dependsOn: ["core", "webgl2d", "physics2d"])。'
  },
  {
    pattern: 'this._graphics.setState is not a function',
    faultyModule: 'laya.ui.js (Laya.Button)',
    rootCause: '對 Laya.Button 賦值了一般 Laya.Graphics 實例，而非內部預期的 AutoBitmap。',
    fix: '呼叫 EngineGuard.installPrototypeDetox() 自動修補 Graphics.prototype.setState，或改用 ZhudaUI.createVectorButton()。'
  },
  {
    pattern: 'spine is not defined',
    faultyModule: 'laya.spine.js / laya.spine3D.js',
    rootCause: 'laya.spine.js 在 spine-core-4.2.js 之前載入，或同時混用了 3.8 與 4.2 runtime。',
    fix: '載入順序必須嚴格為：spine-core-4.2.js -> laya.spine.js -> laya.spine3D.js。'
  },
  {
    pattern: 'Component onAwake / onUpdate never fires after loading prefab',
    faultyModule: 'Laya.ClassUtils',
    rootCause: '脫離 IDE 後未在資產反序列化前執行 Laya.ClassUtils.regClass(name, Ctor)，引擎靜默降級為空節點。',
    fix: '為組件加上 @zhudaComponent 裝飾器，並由 @zhuda-laya/compiler AST 掃描器自動生成 zhuda-registry.ts。'
  },
  {
    pattern: 'DrawRoundRectCmd width scaled by 100x after HierarchyParser.parse',
    faultyModule: 'laya.core.js (DrawRoundRectCmd / DrawRectCmd)',
    rootCause: 'Laya 3.4.2 的 DrawRoundRectCmd 建構子預設 this.percent = true，若 .lh JSON 未顯式寫入 "percent": false，反序列化後長寬會被乘上父節點尺寸。',
    fix: '使用 ZhudaAssetSerializer.serializeNodeToHierarchy() 自動注入 percent: false，並透過 PixelCalibrationEngine.calibrateAsset() 驗證 Tight Bounding Box。'
  }
];

export const GOLDEN_EXAMPLES = {
 'terrain-2d':{title:'分塊2D地形與局部繪製',features:['core'],code:`import {ZhudaEngine,ZhudaTerrain2D,ZhudaTerrain2DRenderer} from 'zhuda-laya-engine';
const {rootScene}=await ZhudaEngine.boot({features:['core']});
const map=new ZhudaTerrain2D({schemaVersion:1,dimension:2,width:32,height:32,tileSize:20,palette:[{id:1,color:'#339955'}],layers:[{id:'ground',tiles:Array(1024).fill(1)}]});
const renderer=new ZhudaTerrain2DRenderer(map,{parent:rootScene});
renderer.setView({x:0,y:0,width:320,height:320});
map.setTile('ground',15,15,0);renderer.flush();
// renderer.dispose(); // release graphics commands; borrowed atlas stays owned by caller
`},
 'terrain-3d-shader':{title:'定種子高度場、地形Shader、筆刷與查詢',features:['core','3d'],code:`import {ZhudaEngine,Zhuda3D,ZhudaHeightfield,ZhudaTerrain3D,ZhudaShaderMaterial,shaderRecipes} from 'zhuda-laya-engine';
const {rootScene}=await ZhudaEngine.boot({features:['core','3d']});
const scene3D=Zhuda3D.createScene3D(rootScene);
Zhuda3D.createCamera(scene3D,{position:[32,55,70],rotationEuler:[-55,0,0],far:300});
const field=ZhudaHeightfield.generate({cellsX:64,cellsZ:64,cellSize:1,seed:42,amplitude:8});
const shader=new ZhudaShaderMaterial(shaderRecipes.terrain3D);
const terrain=new ZhudaTerrain3D(field,{parent:scene3D,material:shader.material});
terrain.setRegion({minX:0,minZ:0,maxX:64,maxZ:64},1);
field.brush(32,32,4,2);terrain.flush();shader.setUniform('u_ZhudaSnowLine',6);
const hit=terrain.raycast({origin:{x:32,y:30,z:32},direction:{x:0,y:-1,z:0}});
console.log(hit?.position);
// terrain.dispose(); shader.dispose();
`},
  'boot-declarative-3d': {
    title: 'Zero-IDE 宣告式 3D 場景與相機燈光初始化',
    features: ['core', '2d', '3d', 'ui'],
    code: `import { ZhudaEngine, Zhuda3D, zhudaComponent } from 'zhuda-laya-engine';

@zhudaComponent({ className: 'SpinCubeScript', category: '3d' })
export class SpinCubeScript extends Laya.Script {
  public onUpdate(): void {
    const sp = this.owner as Laya.Sprite3D;
    const rot = sp.transform.rotationEuler;
    rot.y += 1.2;
    sp.transform.rotationEuler = rot;
  }
}

async function main() {
  const { rootScene } = await ZhudaEngine.boot({ width: 1280, height: 720, features: ['3d', 'ui'] });
  const scene3D = Zhuda3D.createScene3D(rootScene);
  Zhuda3D.createCamera(scene3D, { position: [0, 4, 8], rotationEuler: [-25, 0, 0] });
  Zhuda3D.createDirectionalLight(scene3D, { intensity: 1.3 });

  const cube = new Laya.MeshSprite3D();
  cube.meshFilter.sharedMesh = Zhuda3D.createPrimitiveMesh('box', { width: 1.5, height: 1.5, depth: 1.5 });
  cube.meshRenderer.sharedMaterial = Zhuda3D.createMaterial({ albedoColor: [0.2, 0.7, 1.0, 1], shininess: 48 });
  cube.addComponent(SpinCubeScript);
  scene3D.addChild(cube);
}
main();`
  },
  'spine42-physics-companion': {
    title: 'Spine 4.2 PhysicsConstraint 物理骨骼約束與動態渲染',
    features: ['core', '2d', 'spine42'],
    code: `import { EngineGuard } from 'zhuda-laya-engine';

export function verifySpine42Physics() {
  const telemetry = EngineGuard.checkSpine42();
  if (!telemetry.hasPhysicsConstraint) {
    throw new Error('Spine 4.2 PhysicsConstraint not loaded!');
  }
  return telemetry;
}`
  },
  'safe-vector-ui-hud': {
    title: '免疫 AutoBitmap 崩潰的玻璃擬態 2D 向量 HUD',
    features: ['core', '2d', 'ui'],
    code: `import { ZhudaUI } from 'zhuda-laya-engine';

export function buildHud(stage: Laya.Stage) {
  const panel = ZhudaUI.createGlassPanel(stage, { x: 20, y: 20, width: 420, height: 64 });
  ZhudaUI.createVectorButton(panel, 16, 12, '🚀 啟動引擎基準測試', { width: 180, height: 40 }, () => {
    console.log('Benchmark triggered!');
  });
}`
  },
  'static-prefab-pixel-calibration': {
    title: '先設計後組裝：動態節點轉靜態 .lh 預製體與像素/色差 (ΔE00) 自動校準',
    features: ['core', '2d', 'ui', 'spine42'],
    code: `import { ZhudaAssetSerializer, ZhudaPrefab, PixelCalibrationEngine } from 'zhuda-laya-engine';

export function calibrateAndAssembleButton(stage: Laya.Stage) {
  // 1. 載入或建立未校準之靜態 .lh 資產 (包含 +3px 寬度誤差與 ΔE00 色差)
  const rawLh = ZhudaAssetSerializer.buildConfirmButtonPrefab('uncalibrated-drift');

  // 2. 無需啟動完整遊戲，直接執行像素邊界與 CIEDE2000 色差校準
  const report = PixelCalibrationEngine.calibrateAsset(rawLh);
  const convergedLh = ZhudaAssetSerializer.applyCalibrationPatches(rawLh, report.autoFixPatches);

  // 3. 後組裝階段 (Assembly Phase)：毫秒級實例化已收斂為 0px / ΔE00=0 的靜態預製體
  return ZhudaPrefab.instantiate(convergedLh, stage, { x: 24, y: 24 });
}`
  }
};
