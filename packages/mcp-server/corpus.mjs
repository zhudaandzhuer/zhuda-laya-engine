/**
 * @zhuda-laya/mcp-server — Phase 2: AI-Native Anti-Hallucination Corpus & Golden Examples
 *
 * 解決痛點四 (AI 語料赤字與版本混淆)：
 * - 內建 Laya 1.x/2.x vs Laya 3.4.2 (@zhuda-laya/core) 對照護欄
 * - 內建 6 大致命崩潰診斷知識庫
 * - 內建 5 組 Golden Examples 範例模版（示範 API 用法，不代表畫面驗收）
 */

import { QUALITY_ROUTE_SCENES } from './quality-route.mjs';

export const API_GUARDRAILS = [
  {
    id: 'GUARD_SCENE_QUALITY_ROUTE',
    topic:
      'high quality 3D scene look lighting shadows HDR tone mapping bloom fog reflection wet ground PBR material 高品質 場景 畫面 光影 陰影 霧 反射 質感',
    hallucinatedLegacyApi:
      'Zhuda3D.createMaterial({ albedoColor, shininess }) for scene surfaces (a shininess makes it Blinn-Phong); a bare camera and one directional light; a hand-built Laya PostProcess chain; a look without preset or grade; lightFog with a night colour in a day scene; a reflector lying in the ground plane',
    zhudaCanonicalApi:
      "get_quality_route first. Game: new ZhudaSceneLook(scene3D, camera, { preset: 'day', grade: {}, ambientGround, shadows, lightFog }) + Zhuda3D.createMaterial({ type: 'pbr' }) or createSurfaceMaterial / createZhudaProceduralMaterial + ZhudaQualityGovernor. Film: film_scene_create → read advice → film_scene_preview → read metrics.",
    reason:
      'The look (sun, shadows, sky, fog, HDR grade, multisampling) is one object shared by film scenes and games. Defaults since the quality-defaults change: ground fog follows the sky colour, mipmapped textures use anisotropic 8, a graded look multisamples, what lies below a reflector is cut from the mirror. lintZhudaFilmScene names scenes that are valid and still wrong; measureZhudaFrame describes a preview in numbers. Desktop WebGL evidence only; not built yet: real-time GI, reflections on walls, point-light shadows. See docs/quality-route.md.',
  },
  {
    id: 'GUARD_CINEMATIC_CAPTURE',
    topic: 'cinematic movie capture shutter physical camera lens 景深 電影 離線 4K',
    hallucinatedLegacyApi:
      'Seek Animator.play and immediately screenshot; TAA means deterministic movie samples; cancelled readback frees GPU immediately',
    zhudaCanonicalApi:
      'runtime.setPaused(true); new ZhudaModelAnimationSampler(instance,path,state); new ZhudaPhysicalCameraRig(camera,{focalLengthMm:50}); new ZhudaCinematicCapture(scene,lens,runtime,{width:3840,height:2160}); audio.renderOffline(options); zhuda-film-export report.json --fps 24 --output movie.mp4',
    reason:
      '1.13.0 固定時間同步取樣、光圈/快門累積、共用 mixer 離線 WAV、原子 MP4 輸出。取樣 callback 必須同步且無遊戲事件；取消仍保留底層作業至排空。帶 linear: pipeline.linearChain() 時在 scene-linear（tone mapping 之前）累積，否則為 display-linear；輸出為 SDR，非 EXR 或即時 4K 效能；見 docs/cinematics.md 與 get_cinematic_contract。',
  },
  {
    id: 'GUARD_MESHOPT',
    topic: 'Meshopt Draco KTX2 compressed glTF decoder chunk 資產 壓縮',
    hallucinatedLegacyApi:
      'Registering metadata proves a codec; remove required extensions to force parsing',
    zhudaCanonicalApi:
      'const decoders=new ZhudaModelDecoderRegistry(); decoders.register(new ZhudaMeshoptModelDecoder()); const models=new ZhudaModelLibrary({provider,decoders,maxIdle:0});',
    reason:
      '1.12.0 optional Meshopt 1.3.0 converts embedded glTF/GLB before native parse; raw inspection still reports unsupported without conversion. Registry metadata is not artifact authentication. Draco/KTX2 remain unsupported. Release model leases before disposing library/registry/provider. See docs/model-showcase.md.',
  },
  {
    id: 'GUARD_TIMELINE',
    topic: 'timeline cinematic offline keyframe sequence 電影 時間軸',
    hallucinatedLegacyApi:
      'A metadata recorder exports 4K movies or a hash gate approves visual quality',
    zhudaCanonicalApi:
      'new ZhudaTimelineSequencer(spec,bindings); timeline.update(session.layers.scaledDeltas.get("presentation") ?? 0); new ZhudaOfflineFrameRecorder({durationSeconds:1,fps:24,advance,capture}); zhuda-sequence-check report.json --times 0,0.5,1',
    reason:
      'Use the existing session clock; offline callbacks explicitly own fixed-step presentation and real capture, obey abort signals and have deadlines. Sequence checks evidence integrity; pixel comparison and review remain separate. See docs/cinematics.md.',
  },
  {
    id: 'GUARD_WEBGPU',
    topic: 'WebGPU renderer backend Windows browser device lost WASM',
    hallucinatedLegacyApi:
      'features:["webgpu"]; force WebGPU in a WebGL bundle; fallback WebGL counts as GPU acceptance',
    zhudaCanonicalApi:
      'zhuda.config.json renderer:"webgpu"; await ZhudaEngine.boot({renderer:"webgpu",signal,bootTimeoutMs:30000}); context.renderer; browser profile 3d-webgpu',
    reason:
      '1.11.0 使用同版真實WebGPU後端及內附Shader compiler；預設仍為WebGL。同realm只可載一個後端。裝置遺失或GPU釋放後須新realm，不靜默降級。macOS硬體已測，Windows/實體手機及Native仍需裝置證據；見docs/webgpu.md。',
  },
  {
    id: 'GUARD_CROWD_PRESENTATION',
    topic: 'crowd Animator animation LOD 群體 百人 骨骼',
    hallucinatedLegacyApi:
      'Manually tick Animator in every actor timer; ordinary GPU instancing proves skinned batching',
    zhudaCanonicalApi:
      'new ZhudaCrowdScheduler({tiers,maxUpdatesPerFrame:50}); new ZhudaAnimatorLOD(animator); scheduler.update(sessionLayerDelta);',
    reason:
      '1.8.0 排程只控制呈現。Animator LOD 使用 native manager 的 frame divisor，不能再手動 tick；遊戲權威不降頻。真實模型/材質/設備仍需量測，見 docs/crowd-runtime.md。',
  },
  {
    id: 'GUARD_FACTORY_FOUNDATION',
    topic: 'white label brand theme slot factory result recovery 白牌 主題 回合 恢復',
    hallucinatedLegacyApi:
      'showEngineCredit:false; an EventGate or playback checkpoint settles money exactly once; theme metadata certifies Spine pixels',
    zhudaCanonicalApi:
      'branding:{mode:"custom",brandId:"client",logo:"brand/logo.svg"}; new ZhudaThemeController(source,contract); new ZhudaResultPlayback({scope,store,validate}); zhuda-laya-init --template 2d',
    reason:
      '1.10.0 預設官方品牌，可選 custom/none；browser bundle 先設定 ZhudaBranding。Theme provider 核對 SHA，失敗保留舊主題；prepare 驗證實際解碼內容。結果必須先 recover，再 accept/advance；交易與帳務仍由後端權威處理。見 docs/white-label-themes.md；Slot/Factory 專屬產品不在引擎範圍，Native/真機驗收獨立。',
  },
  {
    id: 'GUARD_MODEL_SHOWCASE',
    topic: 'glTF model inspector showcase morph cubic variants cinematic 模型 展示',
    hallucinatedLegacyApi:
      'A loaded model proves all materials match UE; Cinematic exports offline movies; unsupported required extensions can be ignored',
    zhudaCanonicalApi:
      'inspectGltfAsset(bytes); new ZhudaModelInspector(instance).inspect(); const view=new ZhudaAssetShowcase({library,parent,camera}); await view.load(id); view.setMode("cinematic");',
    reason:
      '1.9.0 必需擴充不支援會拋 ZhudaModelCompatibilityError；可選降級、opaqueColor 與 source inventory 有結構化報告。三模式共用實例，不換材質。handler 不代表視覺認證；Cinematic 是即時後製，非離線電影。見 docs/model-showcase.md。',
  },
  {
    id: 'GUARD_MODEL_PROVIDER',
    topic: 'model glTF GLB provider 模型 動畫',
    hallucinatedLegacyApi:
      'Fetch external glTF dependencies behind the provider; clone all materials for every actor',
    zhudaCanonicalApi:
      'const models=new ZhudaModelLibrary({provider,maxIdle:2,timeoutMs:15000}); const actor=await models.instantiate("actors/scout.glb",{signal}); actor.dispose(); models.dispose();',
    reason:
      '1.8.0 provider 模式只接受自包含 GLB/內嵌 glTF，共用模板/clip；外部URI明確拒絕。native glTF feature 必須載入，基本 browser 3d profile 不含 glTF；1.9.0 可選 3d-gltf profile（含 postProcess）。',
  },
  {
    id: 'GUARD_REMOTE_PRESENTATION',
    topic: 'snapshot remote network MMO 國戰 快照 重連',
    hallucinatedLegacyApi:
      'new ZhudaMMOServer(2000); client animation events decide authoritative damage',
    zhudaCanonicalApi:
      'new ZhudaRemoteCharacterPresenter({epoch,interpolate,tiers,maxUpdatesPerFrame:100}); presenter.push(id,snapshot,teleport); presenter.update(layerDelta,serverSampleTime);',
    reason:
      '只組合既有 snapshot buffer 與呈現排程。transport、時間同步、AOI、傷害、帳號與CCU驗收屬consumer；舊epoch/sequence和晚到瞬移不得覆蓋新狀態。',
  },
  {
    id: 'GUARD_EFFECT_MINIMUM',
    topic: 'particle effect budget minimum fallback 粒子 特效 預算',
    hallucinatedLegacyApi:
      'Calling update less often reduces fixed 120 Hz particle work; priority alone guarantees telegraphs',
    zhudaCanonicalApi:
      'new ZhudaParticleSystem3D(spec,{frequencyHz:30,maxSubsteps:4}); budget.allocate([{id:"warning",particles:48,coverage:.1,priority:10,minimumScale:.25,fallbackId:"ring"}]);',
    reason:
      '最低額度先保留；不可行時回報fallbackRequired。fallback由consumer另編預算。頻率改變才減少子步；丟棄視覺時間計入droppedSeconds，不影響遊戲權威。',
  },
  {
    id: 'GUARD_PROFILER_EVIDENCE',
    topic: 'profiler GPU performance P95 P99 memory Windows Steam 效能 驗收',
    hallucinatedLegacyApi:
      'CPU elapsed equals GPU time; ten-second desktop benchmark certifies mobile or Steam',
    zhudaCanonicalApi:
      'const p=new ZhudaRuntimeProfiler({capacity:60000}); p.attach(gl); p.enableGpuTiming(gl); p.beginFrame(); p.endFrame(frameMs,cpuMs); p.exportJSON({device,quality,commit});',
    reason:
      'GPU僅收非disjoint查詢；raw/percentiles有明確視窗，沒測就是缺值。JS heap不等於GPU/native記憶體。Windows Native/Steam及百人目標硬體仍未驗收。',
  },
  {
    id: 'GUARD_TERRAIN_2D',
    topic: '2D terrain tile atlas chunks',
    hallucinatedLegacyApi: 'Tiled JSON automatically supplies game collision rules',
    zhudaCanonicalApi:
      'new ZhudaTerrain2D(spec); new ZhudaTerrain2DRenderer(data,{parent,atlas,material}); renderer.setView(localRect); renderer.flush();',
    reason:
      '零為空tile；atlas/material是借用；blocked為資料。畫面chunk可卸載，遊戲規則仍由消費端決定。',
  },
  {
    id: 'GUARD_TERRAIN_3D',
    topic: '3D terrain heightfield raycast LOD seam',
    hallucinatedLegacyApi:
      'bilinear height equals triangle mesh; per-chunk arbitrary LOD needs no seams',
    zhudaCanonicalApi:
      'ZhudaHeightfield.generate(config); new ZhudaTerrain3D(field,{parent,material}); terrain.setRegion(localXZBounds,1); field.brush(x,z,radius,delta); terrain.flush();',
    reason:
      '高度沿a-d三角對角線插值；同region統一stride1/2/4；field為全解析度權威資料，renderer query符合目前載入區域與stride。',
  },
  {
    id: 'GUARD_SHADER_CONTRACT',
    topic: 'shader uniform GLSL 2D 3D material',
    hallucinatedLegacyApi:
      'ShaderMaterial.ready means GPU compiled; raw shader globals can be copied from Three.js',
    zhudaCanonicalApi:
      'new ZhudaShaderMaterial(shaderRecipes.terrain3D); shader.setUniform("u_ZhudaSnowLine",6);',
    reason:
      '2D保留graphics premultiplied alpha/clipping/gamma；3D模板處理world normal/fog/output。surface不是完整main。JSON驗證不等於GPU編譯。',
  },
  {
    id: 'GUARD_INIT_BOOT',
    topic: '引擎啟動與 Stage 初始化',
    hallucinatedLegacyApi: 'Laya.init(1280, 720, Laya.WebGL); Laya.MiniAdpter.init();',
    zhudaCanonicalApi:
      'const { stage, rootScene } = await ZhudaEngine.boot({ width: 1280, height: 720, features: "all" });',
    reason:
      'Laya 3.4.2 採用非同步 Promise Laya.init(w, h)，且需在初始化前後掛載 Prototype Detox 與拓撲守衛。',
  },
  {
    id: 'GUARD_3D_MESH_CREATE',
    topic: '3D 網格與材質建立',
    hallucinatedLegacyApi: 'new Laya.MeshSprite3D(new THREE.BoxGeometry());',
    zhudaCanonicalApi:
      'const sp = new Laya.MeshSprite3D();\nsp.meshFilter.sharedMesh = Zhuda3D.createPrimitiveMesh("box", { width: 1, height: 1, depth: 1 });\nsp.meshRenderer.sharedMaterial = Zhuda3D.createMaterial({ albedoColor: [0.2, 0.5, 0.9, 1], shininess: 32 });',
    reason:
      'Laya 3.4.2 支援 new MeshSprite3D(mesh,name)，也可另設 meshFilter.sharedMesh。必須使用 Laya.Mesh，不能直接塞 Three.js Geometry；材質由 meshRenderer.sharedMaterial 指定。',
  },
  {
    id: 'GUARD_DIRECTIONAL_LIGHT',
    topic: '3D 平行光組件',
    hallucinatedLegacyApi: 'const light = scene3D.addChild(new Laya.DirectionLight());',
    zhudaCanonicalApi:
      'const { node, light } = Zhuda3D.createDirectionalLight(scene3D, { intensity: 1.3, rotationEuler: [-55, 35, 0] });',
    reason:
      'Laya 3.4.2 已全面改為組件化 (Entity-Component)，燈光必須透過 Sprite3D.addComponent(Laya.DirectionLightCom) 掛載。',
  },
  {
    id: 'GUARD_VECTOR_BUTTON',
    topic: '純代碼 2D 向量按鈕',
    hallucinatedLegacyApi:
      'const btn = new Laya.Button(); btn.graphics.drawRect(0, 0, 100, 40, "#336699");',
    zhudaCanonicalApi:
      'const { root, label } = ZhudaUI.createVectorButton(parent, x, y, "按鈕文字", { width: 100, height: 40 }, onClick);',
    reason:
      'Laya.Button 內部強依賴 AutoBitmap.setState，直接覆寫 graphics 在滑鼠懸停時會拋出 this._graphics.setState is not a function。',
  },
  {
    id: 'GUARD_COMPONENT_REFLECTION',
    topic: '自定義 Script 組件註冊 (脫離 IDE)',
    hallucinatedLegacyApi:
      'export default class PlayerScript extends Laya.Script {} // 依賴 IDE 黑盒掃描',
    zhudaCanonicalApi:
      '@zhudaComponent({ className: "PlayerScript", category: "3d" })\nexport class PlayerScript extends Laya.Script {}',
    reason:
      '脫離 IDE 後必須透過 @zhudaComponent 裝飾器與 @zhuda-laya/compiler 的 AST 掃描器自動注入 ClassUtils.regClass。',
  },
  {
    id: 'GUARD_RAYCAST_3D',
    topic: '3D 相機螢幕射線拾取',
    hallucinatedLegacyApi:
      'camera.viewportPointToRay(new Laya.Vector2(x, y)); // 缺少 out Ray 參數',
    zhudaCanonicalApi:
      'const ray = new Laya.Ray(new Laya.Vector3(), new Laya.Vector3());\ncamera.viewportPointToRay(new Laya.Vector2(screenX, screenY), ray);',
    reason:
      'Laya 3.4.2 viewportPointToRay 為零 GC 設計，必須傳入預先配置的 Laya.Ray 實例作為輸出。',
  },
  {
    id: 'GUARD_STATIC_PREFAB_CALIBRATION',
    topic: '動態轉靜態資產 (.lh) 與像素/色差 (ΔE00) 孤立校準',
    hallucinatedLegacyApi: '每次修改 2px UI 座標或粒子色號都重新啟動完整遊戲 Runtime 肉眼比對',
    zhudaCanonicalApi:
      'const lh = ZhudaAssetSerializer.serializeNodeToHierarchy(node, { assetId: "assets/prefabs/MyCard.lh", targetSpec });\nconst report = PixelCalibrationEngine.calibrateAsset(lh);\nconst converged = ZhudaAssetSerializer.applyCalibrationPatches(lh, report.autoFixPatches);\nconst inst = ZhudaPrefab.instantiate(converged, parent);',
    reason:
      'Laya 3.4.2 的 DrawRoundRectCmd 建構子預設 percent: true，必須透過 ZhudaAssetSerializer 顯式序列化 percent: false 並以 PixelCalibrationEngine 單步收斂至 0px 與 ΔE00=0。',
  },
];

export const ERROR_DIAGNOSTICS_DB = [
  {
    pattern: "Cannot read properties of undefined (reading 'I')",
    faultyModule: 'laya.box2D.js',
    rootCause:
      'laya.box2D.js 在 laya.physics2D.js 之前被載入，頂層存取 Laya.Physics2D.I._factory 時 Laya.Physics2D 尚未定義。',
    fix: '使用 TopologyResolver.resolveByFeatures(["physics2d"]) 強制確保 laya.physics2D.js 排在 laya.box2D.js 之前。',
  },
  {
    pattern: 'Box2DShapeDef is not a constructor',
    faultyModule: 'laya.tilemap.js',
    rootCause:
      '載入了 laya.tilemap.js 卻未先載入 laya.physics2D.js，TileMap 內部在載入期直接繼承 Box2DShapeDef。',
    fix: '在 TopologyGraph 中將 physics2d 列為 tilemap 的硬性前置依賴 (dependsOn: ["core", "webgl2d", "physics2d"])。',
  },
  {
    pattern: 'this._graphics.setState is not a function',
    faultyModule: 'laya.ui.js (Laya.Button)',
    rootCause: '對 Laya.Button 賦值了一般 Laya.Graphics 實例，而非內部預期的 AutoBitmap。',
    fix: '呼叫 EngineGuard.installPrototypeDetox() 自動修補 Graphics.prototype.setState，或改用 ZhudaUI.createVectorButton()。',
  },
  {
    pattern: 'spine is not defined',
    faultyModule: 'laya.spine.js / laya.spine3D.js',
    rootCause: 'laya.spine.js 在 spine-core-4.2.js 之前載入，或同時混用了 3.8 與 4.2 runtime。',
    fix: '載入順序必須嚴格為：spine-core-4.2.js -> laya.spine.js -> laya.spine3D.js。',
  },
  {
    pattern: 'Component onAwake / onUpdate never fires after loading prefab',
    faultyModule: 'Laya.ClassUtils',
    rootCause:
      '脫離 IDE 後未在資產反序列化前執行 Laya.ClassUtils.regClass(name, Ctor)，引擎靜默降級為空節點。',
    fix: '為組件加上 @zhudaComponent 裝飾器，並由 @zhuda-laya/compiler AST 掃描器自動生成 zhuda-registry.ts。',
  },
  {
    pattern: 'DrawRoundRectCmd width scaled by 100x after HierarchyParser.parse',
    faultyModule: 'laya.core.js (DrawRoundRectCmd / DrawRectCmd)',
    rootCause:
      'Laya 3.4.2 的 DrawRoundRectCmd 建構子預設 this.percent = true，若 .lh JSON 未顯式寫入 "percent": false，反序列化後長寬會被乘上父節點尺寸。',
    fix: '使用 ZhudaAssetSerializer.serializeNodeToHierarchy() 自動注入 percent: false，並透過 PixelCalibrationEngine.calibrateAsset() 驗證 Tight Bounding Box。',
  },
];

export const GOLDEN_EXAMPLES = {
  'scene-look-game': {
    title: 'A game scene on the quality route: PBR surfaces, ZhudaSceneLook, frame budget',
    features: ['core', '3d', 'postProcess'],
    code: `import {
  Zhuda3D,
  ZhudaEngine,
  ZhudaQualityGovernor,
  ZhudaSceneLook,
  type ZhudaLookQuality,
} from 'zhuda-laya-engine';

async function main() {
  const container = document.querySelector<HTMLElement>('#game');
  if (!container) throw new Error('Missing #game container');

  // postProcess carries the HDR grade: tone mapping, bloom, ambient occlusion.
  const context = await ZhudaEngine.boot({
    container,
    features: ['core', '3d', 'postProcess'],
    dprCap: 1.5,
    targetFPS: 60,
  });
  const scene = Zhuda3D.createScene3D(context.rootScene);
  const eye: [number, number, number] = [5, 3, 7];
  const target: [number, number, number] = [0, 0.75, 0];
  const camera = Zhuda3D.createCamera(scene, { position: eye, rotationEuler: [-14.7, 35.5, 0] });

  // The look owns the sun, its shadows, the sky, the fog and the HDR chain:
  // do not add a directional light of your own. See the engine's
  // docs/quality-route.md for every step and why it is there.
  const look = new ZhudaSceneLook(scene, camera, {
    preset: 'day',
    sun: { azimuthDeg: 155, elevationDeg: 32 }, // from the side, a little ahead of the camera
    ambientGround: [0.26, 0.23, 0.2], // what the ground throws back
    shadows: { distance: 40, resolution: 2048, cascades: 4 },
    grade: { exposure: 1.1, bloom: 0.2, ao: 0.6 },
    lightFog: { density: 0.003 }, // its colour follows the sky
  });

  // Physically based surfaces (the default): lit by the sky and the HDR chain.
  const surface = (albedoColor: [number, number, number, number], smoothness: number) =>
    Zhuda3D.createMaterial({ type: 'pbr', albedoColor, smoothness, metallic: 0 });
  const add = (mesh: Laya.Mesh, material: Laya.Material, y: number) => {
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.meshRenderer.castShadow = true;
    node.meshRenderer.receiveShadow = true;
    node.transform.position = new Laya.Vector3(0, y, 0);
    scene.addChild(node);
    return node;
  };
  add(
    Zhuda3D.createPrimitiveMesh('box', { width: 30, height: 0.2, depth: 30 }),
    surface([0.32, 0.33, 0.35, 1], 0.1),
    -0.1,
  );
  add(
    Zhuda3D.createPrimitiveMesh('box', { width: 1.5, height: 1.5, depth: 1.5 }),
    surface([0.2, 0.55, 0.9, 1], 0.55),
    0.75,
  );

  // Hold the frame budget: the governor decides the level, the look applies it.
  const governor = new ZhudaQualityGovernor({ budgetMs: 1000 / 60 });
  context.runtime.start((dt) => {
    look.update(eye, target, camera.fieldOfView, camera.aspectRatio);
    const level = governor.sample(dt * 1000);
    if (level !== undefined) look.setQuality(level as ZhudaLookQuality);
  });
}

void main();`,
  },
  'film-scene-day': {
    title: 'A film scene on the quality route (day): preset, side light, shadows, fog, sized textures',
    features: ['core', '2d', '3d', 'ui', 'gltf', 'postProcess'],
    code:
      '// film_scene_create { scene } → read advice → film_scene_preview → read metrics\n' +
      JSON.stringify(QUALITY_ROUTE_SCENES['day-yard'], null, 2),
  },
  'film-scene-night-wet': {
    title:
      'A film scene on the quality route (night): lamps with halos, one shadow-casting spot, wet ground',
    features: ['core', '2d', '3d', 'ui', 'gltf', 'postProcess'],
    code:
      '// film_scene_create { scene } → read advice → film_scene_preview → read metrics\n' +
      JSON.stringify(QUALITY_ROUTE_SCENES['night-wet'], null, 2),
  },
  'terrain-2d': {
    title: '分塊2D地形與局部繪製',
    features: ['core'],
    code: `import {ZhudaEngine,ZhudaTerrain2D,ZhudaTerrain2DRenderer} from 'zhuda-laya-engine';
const {rootScene}=await ZhudaEngine.boot({features:['core']});
const map=new ZhudaTerrain2D({schemaVersion:1,dimension:2,width:32,height:32,tileSize:20,palette:[{id:1,color:'#339955'}],layers:[{id:'ground',tiles:Array(1024).fill(1)}]});
const renderer=new ZhudaTerrain2DRenderer(map,{parent:rootScene});
renderer.setView({x:0,y:0,width:320,height:320});
map.setTile('ground',15,15,0);renderer.flush();
// renderer.dispose(); // release graphics commands; borrowed atlas stays owned by caller
`,
  },
  'terrain-3d-shader': {
    title: '定種子高度場、地形Shader、筆刷與查詢',
    features: ['core', '3d'],
    code: `import {ZhudaEngine,Zhuda3D,ZhudaHeightfield,ZhudaTerrain3D,ZhudaShaderMaterial,shaderRecipes} from 'zhuda-laya-engine';
const {rootScene}=await ZhudaEngine.boot({features:['core','3d']});
const scene3D=Zhuda3D.createScene3D(rootScene);
Zhuda3D.createCamera(scene3D,{position:[32,55,70],rotationEuler:[-55,0,0],far:300});
const field=ZhudaHeightfield.generate({cellsX:64,cellsZ:64,cellSize:1,seed:42,amplitude:8});
const shader=new ZhudaShaderMaterial(shaderRecipes.terrain3D);
const terrain=new ZhudaTerrain3D(field,{parent:scene3D,material:shader.material,solid:{depth:12}});
terrain.setRegion({minX:0,minZ:0,maxX:64,maxZ:64},1);
field.brush(32,32,4,2);terrain.flush();shader.setUniform('u_ZhudaSnowLine',6);
const hit=terrain.raycast({origin:{x:32,y:30,z:32},direction:{x:0,y:-1,z:0}});
console.log(hit?.position);
// terrain.dispose(); shader.dispose();
`,
  },
  'terrain-solid-camera': {
    title: 'Closed terrain and camera boom collision',
    features: ['core', '3d'],
    code: `import {ZhudaEngine,Zhuda3D,ZhudaHeightfield,ZhudaTerrain3D,ZhudaShaderMaterial,shaderRecipes,ZhudaSceneQueries,ZhudaCameraRig} from 'zhuda-laya-engine';
const ctx=await ZhudaEngine.boot({features:['core','3d'],dprCap:1.5});
const scene=Zhuda3D.createScene3D(ctx.rootScene),camera=Zhuda3D.createCamera(scene,{far:300});
const field=ZhudaHeightfield.generate({cellsX:64,cellsZ:64,cellSize:1,seed:42,amplitude:8});
const shader=new ZhudaShaderMaterial(shaderRecipes.terrain3D);
const terrain=new ZhudaTerrain3D(field,{parent:scene,material:shader.material,solid:{depth:12}});
terrain.setRegion({minX:0,minZ:0,maxX:64,maxZ:64});
const queries=new ZhudaSceneQueries();queries.register(terrain.queryProvider('ground',4));
const rig=new ZhudaCameraRig(camera,{collision:{queries,radius:.4,clearance:.2,layerMask:4}});
// Focus and near-plane probes must begin outside solids. This is not a physics sphere sweep.
ctx.runtime.start(()=>rig.update({x:32,y:field.sample(32,32).height+2,z:32}));
// Inspector-only underside view: rig.options.collision=undefined; rig.pitch=-.5;
// Stop runtime before terrain.dispose(); shader.dispose(); ctx.dispose();
`,
  },
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
  // Physically based, the default. The smallest scene
  // that draws; for one that looks good see the example 'scene-look-game'.
  cube.meshRenderer.sharedMaterial = Zhuda3D.createMaterial({ type: 'pbr', albedoColor: [0.2, 0.7, 1.0, 1], smoothness: 0.5 });
  cube.addComponent(SpinCubeScript);
  scene3D.addChild(cube);
}
main();`,
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
}`,
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
}`,
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
}`,
  },
};
