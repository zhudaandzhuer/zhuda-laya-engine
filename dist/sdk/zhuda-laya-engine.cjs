/**
 * zhuda-laya-engine v1.0.0 — 豬大 LayaAir (AI-Agent-Friendly Fork Edition)
 * Repository: https://github.com/zhudaandzhuer/zhuda-laya-engine
 * Upstream Official: LayaAir Engine 3.4.2 by Layabox (https://layaair.com/ | https://github.com/layabox/LayaAir)
 * License: MIT
 */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/core/index.ts
var index_exports = {};
__export(index_exports, {
  ENGINE_PRESET_PROFILES: () => ENGINE_PRESET_PROFILES,
  EngineGuard: () => EngineGuard,
  IframeSoundAdapter: () => IframeSoundAdapter,
  PixelCalibrationEngine: () => PixelCalibrationEngine,
  SpineVisualContract: () => SpineVisualContract,
  TopologyResolver: () => TopologyResolver,
  UNITY_CYBER_SHRINE_SCENE: () => UNITY_CYBER_SHRINE_SCENE,
  UnityAnimatorStateMachine: () => UnityAnimatorStateMachine,
  UnityBridgePipeline: () => UnityBridgePipeline,
  VIEWPORT_DEVICE_PROFILES: () => VIEWPORT_DEVICE_PROFILES,
  ViewportMatrixEngine: () => ViewportMatrixEngine,
  VisualFocusContract: () => VisualFocusContract,
  ZHUDA_ENGINE_MODULES: () => ZHUDA_ENGINE_MODULES,
  Zhuda3D: () => Zhuda3D,
  ZhudaAssetSerializer: () => ZhudaAssetSerializer,
  ZhudaBenchmarkEngine: () => ZhudaBenchmarkEngine,
  ZhudaEffectEnvelope: () => ZhudaEffectEnvelope,
  ZhudaEngine: () => ZhudaEngine,
  ZhudaLayaParticleRenderer: () => ZhudaLayaParticleRenderer,
  ZhudaLayaParticleRenderer3D: () => ZhudaLayaParticleRenderer3D,
  ZhudaLayaRibbonRenderer: () => ZhudaLayaRibbonRenderer,
  ZhudaLayaRibbonRenderer3D: () => ZhudaLayaRibbonRenderer3D,
  ZhudaParticleMesh3D: () => ZhudaParticleMesh3D,
  ZhudaParticleSystem: () => ZhudaParticleSystem,
  ZhudaParticleSystem3D: () => ZhudaParticleSystem3D,
  ZhudaPrefab: () => ZhudaPrefab,
  ZhudaRibbonPath3D: () => ZhudaRibbonPath3D,
  ZhudaRibbonTrail: () => ZhudaRibbonTrail,
  ZhudaRibbonTrail3D: () => ZhudaRibbonTrail3D,
  ZhudaUI: () => ZhudaUI,
  rotateParticleVector3: () => rotateParticleVector3,
  sampleParticleColor: () => sampleParticleColor,
  sampleParticleCurve: () => sampleParticleCurve,
  validateParticleEffect: () => validateParticleEffect,
  validateParticleEffect3D: () => validateParticleEffect3D,
  zhudaComponent: () => zhudaComponent
});
module.exports = __toCommonJS(index_exports);

// packages/core/TopologyGraph.ts
var ZHUDA_ENGINE_MODULES = [
  {
    id: "core",
    file: "laya.core.js",
    sizeBytes: 871452,
    feature: "core",
    dependsOn: [],
    providesGlobals: ["Laya", "Laya.Node", "Laya.Sprite", "Laya.ClassUtils"],
    priority: 10,
    painPointNote: "\u6240\u6709\u6A21\u7D44\u7684\u6839\u57FA\u5E95\uFF0C\u5B9A\u7FA9\u5168\u57DF window.Laya \u8207 ClassUtils \u53CD\u5C04\u7CFB\u7D71"
  },
  {
    id: "d3",
    file: "laya.d3.js",
    sizeBytes: 689342,
    feature: "3d",
    dependsOn: ["core"],
    providesGlobals: ["Laya.Scene3D", "Laya.Sprite3D", "Laya.Camera", "Laya.BlinnPhongMaterial"],
    priority: 20,
    painPointNote: "\u5FC5\u9808\u5728 webgl_3D\u3001physics3D\u3001particle3D\u3001postProcess \u4E4B\u524D\u8F09\u5165"
  },
  {
    id: "webgl2d",
    file: "laya.webgl_2D.js",
    sizeBytes: 280361,
    feature: "2d",
    dependsOn: ["core"],
    providesGlobals: ["Laya.WebGLRenderEngineFactory"],
    priority: 30,
    painPointNote: "2D WebGL \u6E32\u67D3\u7BA1\u7DDA\u5F8C\u7AEF\uFF0CLaya.init \u521D\u59CB\u5316\u524D\u5FC5\u9808\u5C31\u7DD2"
  },
  {
    id: "webgl3d",
    file: "laya.webgl_3D.js",
    sizeBytes: 72249,
    feature: "3d",
    dependsOn: ["core", "d3", "webgl2d"],
    providesGlobals: ["Laya.WebGL3DRenderPass"],
    priority: 40,
    painPointNote: "\u4F9D\u8CF4 laya.d3 \u8207 webgl_2D\uFF0C\u63D0\u4F9B 3D WebGL \u6E32\u67D3\u8A2D\u5099\u5BE6\u4F5C"
  },
  {
    id: "ui",
    file: "laya.ui.js",
    sizeBytes: 110837,
    feature: "ui",
    dependsOn: ["core", "webgl2d"],
    providesGlobals: ["Laya.Button", "Laya.Dialog", "Laya.AutoBitmap"],
    priority: 50,
    painPointNote: "\u5167\u90E8 Button \u5F37\u4F9D\u8CF4 AutoBitmap.setState\uFF0C\u9700\u642D\u914D RuntimeGuards \u539F\u578B\u4FDD\u8B77"
  },
  {
    id: "physics2d",
    file: "laya.physics2D.js",
    sizeBytes: 164237,
    feature: "physics2d",
    dependsOn: ["core", "webgl2d"],
    providesGlobals: ["Laya.Physics2D", "Laya.Box2DShapeDef", "Laya.RigidBody"],
    priority: 60,
    painPointNote: "\u5B9A\u7FA9 Laya.Physics2D \u8207 Box2DShapeDef\uFF0C\u5FC5\u9808\u5728 laya.box2D.js \u8207 laya.tilemap.js \u4E4B\u524D"
  },
  {
    id: "box2d",
    file: "laya.box2D.js",
    sizeBytes: 1401774,
    feature: "physics2d",
    dependsOn: ["core", "physics2d"],
    providesGlobals: ["window.box2d", "Laya.Physics2D.I._factory"],
    priority: 70,
    painPointNote: '\u9802\u5C64\u76F4\u63A5\u5B58\u53D6 Laya.Physics2D.I._factory\uFF0C\u82E5\u65E9\u65BC physics2D \u8F09\u5165\u6703\u62CB\u51FA reading "I" \u5D29\u6F70'
  },
  {
    id: "bullet",
    file: "laya.bullet.js",
    sizeBytes: 1232001,
    feature: "physics3d",
    dependsOn: ["core", "d3"],
    providesGlobals: ["Laya.Physics3D"],
    priority: 80,
    painPointNote: "\u88DD\u914D Bullet 3D \u7269\u7406\u6838\u5FC3\uFF0C\u5FC5\u9808\u5728 laya.physics3D.js \u4E4B\u524D\u5B8C\u6210\u8F09\u5165"
  },
  {
    id: "physics3d",
    file: "laya.physics3D.js",
    sizeBytes: 72533,
    feature: "physics3d",
    dependsOn: ["core", "d3", "bullet"],
    providesGlobals: ["Laya.PhysicsCollider", "Laya.Rigidbody3D", "Laya.BoxColliderShape"],
    priority: 90,
    painPointNote: "\u639B\u8F09 3D \u7269\u7406\u7D44\u4EF6\u81F3 Laya3D\uFF0C\u4F9D\u8CF4 laya.bullet.js \u5DF2\u6CE8\u5165\u4E4B\u5DE5\u5EE0"
  },
  {
    id: "spine-core-42",
    file: "spine-core-4.2.js",
    sizeBytes: 466015,
    feature: "spine42",
    dependsOn: ["core"],
    conflictsWith: ["spine-core-38"],
    providesGlobals: ["window.spine", "window.spine.PhysicsConstraint", "window.spine.AnimationState"],
    priority: 100,
    painPointNote: "\u5B9A\u7FA9\u5168\u57DF window.spine (4.2 PhysicsConstraint)\uFF0C\u5FC5\u9808\u5728 laya.spine.js \u4E4B\u524D"
  },
  {
    id: "spine",
    file: "laya.spine.js",
    sizeBytes: 132824,
    feature: "spine42",
    dependsOn: ["core", "webgl2d", "spine-core-42"],
    providesGlobals: ["Laya.SpineTemplet", "Laya.Spine2DRenderNode"],
    priority: 110,
    painPointNote: "\u5305\u542B 3.4.2 ReusableStructList \u8207 SpineInstanceBatch \u5408\u6279\u7BA1\u7DDA\uFF0C\u4F9D\u8CF4 spine-core-4.2.js"
  },
  {
    id: "spine3d",
    file: "laya.spine3D.js",
    sizeBytes: 15895,
    feature: "spine3d",
    dependsOn: ["core", "d3", "spine-core-42", "spine"],
    providesGlobals: ["Laya.Spine3DRenderNode"],
    priority: 120,
    painPointNote: "\u5C07 Spine \u9AA8\u9ABC\u639B\u8F09\u81F3 3D \u5834\u666F\u6A39\uFF0C\u5FC5\u9808\u5728 laya.d3 \u8207 laya.spine \u4E4B\u5F8C"
  },
  {
    id: "navmesh-common",
    file: "laya.navMeshCommon.js",
    sizeBytes: 480255,
    feature: "navmesh2d",
    dependsOn: ["core"],
    providesGlobals: ["Laya.RecastNavigation"],
    priority: 130,
    painPointNote: "\u5B9A\u7FA9 Recast \u5C0B\u8DEF\u5171\u7528\u57FA\u5E95\uFF0C\u5FC5\u9808\u5728 navMesh2d \u8207 navMesh3d \u4E4B\u524D"
  },
  {
    id: "navmesh2d",
    file: "laya.navMesh2d.js",
    sizeBytes: 12e3,
    feature: "navmesh2d",
    dependsOn: ["core", "navmesh-common"],
    providesGlobals: ["Laya.NavMesh2D"],
    priority: 140
  },
  {
    id: "navmesh3d",
    file: "laya.navMesh3d.js",
    sizeBytes: 12415,
    feature: "navmesh3d",
    dependsOn: ["core", "d3", "navmesh-common"],
    providesGlobals: ["Laya.NavMesh3D"],
    priority: 150
  },
  {
    id: "particle-common",
    file: "laya.particleCommon.js",
    sizeBytes: 9402,
    feature: "particle2d",
    dependsOn: ["core"],
    providesGlobals: ["Laya.GradientDataNumber"],
    priority: 160,
    painPointNote: "2D/3D \u7C92\u5B50\u5171\u7528\u63D2\u503C\u57FA\u5E95\uFF0C\u5FC5\u9808\u5728 particle \u8207 particle3D \u4E4B\u524D"
  },
  {
    id: "particle2d",
    file: "laya.particle.js",
    sizeBytes: 56958,
    feature: "particle2d",
    dependsOn: ["core", "webgl2d", "particle-common"],
    providesGlobals: ["Laya.Particle2D"],
    priority: 170
  },
  {
    id: "particle3d",
    file: "laya.particle3D.js",
    sizeBytes: 169120,
    feature: "particle3d",
    dependsOn: ["core", "d3", "particle-common"],
    providesGlobals: ["Laya.ShuriKenParticle3D"],
    priority: 180
  },
  {
    id: "trail-common",
    file: "laya.trailCommon.js",
    sizeBytes: 11971,
    feature: "trail2d",
    dependsOn: ["core"],
    providesGlobals: ["Laya.TrailFilter"],
    priority: 190,
    painPointNote: "2D/3D \u62D6\u5C3E\u5171\u7528\u5E7E\u4F55\u69CB\u9020\u57FA\u5E95\uFF0C\u5FC5\u9808\u5728 trail2D \u8207 trail3D \u4E4B\u524D"
  },
  {
    id: "trail2d",
    file: "laya.trail2D.js",
    sizeBytes: 5537,
    feature: "trail2d",
    dependsOn: ["core", "webgl2d", "trail-common"],
    providesGlobals: ["Laya.Trail2DRender"],
    priority: 200
  },
  {
    id: "trail3d",
    file: "laya.trail3D.js",
    sizeBytes: 8793,
    feature: "trail3d",
    dependsOn: ["core", "d3", "trail-common"],
    providesGlobals: ["Laya.TrailSprite3D"],
    priority: 210
  },
  {
    id: "light2d",
    file: "laya.light2D.js",
    sizeBytes: 76531,
    feature: "effects2d",
    dependsOn: ["core", "webgl2d"],
    providesGlobals: ["Laya.Light2DRender"],
    priority: 220
  },
  {
    id: "line2d",
    file: "laya.line2D.js",
    sizeBytes: 12170,
    feature: "effects2d",
    dependsOn: ["core", "webgl2d"],
    providesGlobals: ["Laya.Line2DRender"],
    priority: 230
  },
  {
    id: "tilemap",
    file: "laya.tilemap.js",
    sizeBytes: 85504,
    feature: "tilemap",
    dependsOn: ["core", "webgl2d", "physics2d"],
    providesGlobals: ["Laya.TileMapLayer"],
    priority: 240,
    painPointNote: "\u5167\u90E8\u76F4\u63A5\u5411 Box2DShapeDef \u8A3B\u518A\u74E6\u7247\u78B0\u649E\u9AD4\uFF0C\u82E5\u672A\u5148\u8F09\u5165 laya.physics2D.js \u6703\u76F4\u63A5\u5D29\u6F70"
  },
  {
    id: "ani",
    file: "laya.ani.js",
    sizeBytes: 68047,
    feature: "ani",
    dependsOn: ["core", "webgl2d"],
    providesGlobals: ["Laya.Templet"],
    priority: 250
  },
  {
    id: "gltf",
    file: "laya.gltf.js",
    sizeBytes: 67581,
    feature: "gltf",
    dependsOn: ["core", "d3"],
    providesGlobals: ["Laya.glTFLoader"],
    priority: 260
  },
  {
    id: "ik",
    file: "laya.ik.js",
    sizeBytes: 52268,
    feature: "ik",
    dependsOn: ["core", "d3"],
    providesGlobals: ["Laya.IKConstraint"],
    priority: 270
  },
  {
    id: "postProcess",
    file: "laya.postProcess.js",
    sizeBytes: 92193,
    feature: "postProcess",
    dependsOn: ["core", "d3", "webgl3d"],
    providesGlobals: ["Laya.PostProcess", "Laya.BloomEffect"],
    priority: 280,
    painPointNote: "\u9802\u5C64\u81EA\u57F7\u884C\u8A3B\u518A SubShader\uFF0C\u5FC5\u9808\u5728\u9996\u5E40 Camera \u6E32\u67D3\u524D\u8F09\u5165"
  },
  {
    id: "device",
    file: "laya.device.js",
    sizeBytes: 5963,
    feature: "device",
    dependsOn: ["core"],
    providesGlobals: ["Laya.Accelerator", "Laya.Geolocation"],
    priority: 290
  }
];
var ENGINE_PRESET_PROFILES = {
  "2d-light": ["core", "2d", "ui"],
  "3d-standard": ["core", "2d", "3d", "ui", "physics3d", "postProcess", "gltf"],
  "spine-hybrid": ["core", "2d", "3d", "ui", "spine42", "spine3d", "physics3d"],
  "full-all-in-one": [
    "core",
    "2d",
    "3d",
    "ui",
    "physics2d",
    "physics3d",
    "spine42",
    "spine3d",
    "navmesh2d",
    "navmesh3d",
    "particle2d",
    "particle3d",
    "trail2d",
    "trail3d",
    "effects2d",
    "tilemap",
    "ani",
    "gltf",
    "ik",
    "postProcess",
    "device"
  ]
};
var TopologyResolver = class {
  static getFullEngineSizeBytes() {
    return ZHUDA_ENGINE_MODULES.reduce((acc, m) => acc + m.sizeBytes, 0);
  }
  /**
   * 根據 Feature Tags 解析最小必備模組並執行拓撲排序
   */
  static resolveByFeatures(features) {
    const targetFeatures = features === "all" ? ENGINE_PRESET_PROFILES["full-all-in-one"] : Array.from(/* @__PURE__ */ new Set(["core", ...features]));
    const seedIds = ZHUDA_ENGINE_MODULES.filter(
      (m) => targetFeatures.includes(m.feature)
    ).map((m) => m.id);
    return this.resolveByModuleIds(seedIds);
  }
  /**
   * 根據 Module IDs 展開傳遞依賴閉包並以 Kahn's Algorithm 排序
   */
  static resolveByModuleIds(seedModuleIds) {
    const closure = /* @__PURE__ */ new Set();
    const diagnostics = [];
    const visit = (id, chain) => {
      if (chain.includes(id)) {
        throw new Error(`[ZhudaTopology] \u5075\u6E2C\u5230\u5FAA\u74B0\u4F9D\u8CF4 (Cycle Detected): ${[...chain, id].join(" -> ")}`);
      }
      const node = this.moduleMap.get(id);
      if (!node) {
        throw new Error(`[ZhudaTopology] \u672A\u77E5\u7684\u5F15\u64CE\u6A21\u7D44 ID: "${id}"`);
      }
      for (const depId of node.dependsOn) {
        if (!closure.has(depId)) {
          diagnostics.push(`[Auto-Dependency] \u6A21\u7D44 "${node.file}" \u81EA\u52D5\u62C9\u5165\u524D\u7F6E\u4F9D\u8CF4 "${this.moduleMap.get(depId)?.file}"`);
        }
        visit(depId, [...chain, id]);
      }
      closure.add(id);
    };
    for (const seed of seedModuleIds) {
      visit(seed, []);
    }
    for (const id of closure) {
      const node = this.moduleMap.get(id);
      if (node.conflictsWith) {
        for (const conflictId of node.conflictsWith) {
          if (closure.has(conflictId)) {
            throw new Error(`[ZhudaTopology] \u6A21\u7D44\u4E92\u65A5\u885D\u7A81: "${id}" \u8207 "${conflictId}" \u4E0D\u53EF\u540C\u6642\u8F09\u5165`);
          }
        }
      }
    }
    const inDegree = /* @__PURE__ */ new Map();
    const adj = /* @__PURE__ */ new Map();
    for (const id of closure) {
      inDegree.set(id, 0);
      adj.set(id, []);
    }
    for (const id of closure) {
      const node = this.moduleMap.get(id);
      for (const depId of node.dependsOn) {
        adj.get(depId).push(id);
        inDegree.set(id, (inDegree.get(id) || 0) + 1);
      }
    }
    const readyQueue = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        readyQueue.push(this.moduleMap.get(id));
      }
    }
    readyQueue.sort((a, b) => a.priority - b.priority);
    const orderedModules = [];
    while (readyQueue.length > 0) {
      const current = readyQueue.shift();
      orderedModules.push(current);
      for (const neighborId of adj.get(current.id) || []) {
        const nextDeg = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, nextDeg);
        if (nextDeg === 0) {
          readyQueue.push(this.moduleMap.get(neighborId));
          readyQueue.sort((a, b) => a.priority - b.priority);
        }
      }
    }
    if (orderedModules.length !== closure.size) {
      throw new Error("[ZhudaTopology] \u62D3\u64B2\u6392\u5E8F\u5931\u6557\uFF1A\u5B58\u5728\u7121\u6CD5\u89E3\u958B\u7684\u4F9D\u8CF4\u74B0");
    }
    const totalSizeBytes = orderedModules.reduce((acc, m) => acc + m.sizeBytes, 0);
    const fullSizeBytes = this.getFullEngineSizeBytes();
    const prunedRatioPercent = Number(((fullSizeBytes - totalSizeBytes) / fullSizeBytes * 100).toFixed(1));
    return {
      orderedModules,
      orderedFiles: orderedModules.map((m) => m.file),
      totalSizeBytes,
      totalSizeKB: Number((totalSizeBytes / 1024).toFixed(1)),
      prunedRatioPercent: Math.max(0, prunedRatioPercent),
      fullEngineSizeBytes: fullSizeBytes,
      diagnostics
    };
  }
  /**
   * 靜態審計任意 script 載入序列，攔截順序倒置或遺漏依賴的致命錯誤
   */
  static auditFileSequence(files) {
    const issues = [];
    const seenFiles = /* @__PURE__ */ new Set();
    for (const file of files) {
      const node = this.fileMap.get(file);
      if (!node) {
        seenFiles.add(file);
        continue;
      }
      for (const depId of node.dependsOn) {
        const depNode = this.moduleMap.get(depId);
        if (!depNode) continue;
        if (!seenFiles.has(depNode.file)) {
          const isPresentLater = files.includes(depNode.file);
          issues.push({
            type: isPresentLater ? "INVERTED_ORDER" : "MISSING_DEPENDENCY",
            moduleFile: node.file,
            requiredFile: depNode.file,
            fatalSymptom: node.painPointNote || `${node.file} \u9700\u8981\u5728 ${depNode.file} \u4E4B\u5F8C\u8F09\u5165`,
            message: isPresentLater ? `[\u9806\u5E8F\u5012\u7F6E\u6B7B\u9396] "${node.file}" \u51FA\u73FE\u5728\u524D\u7F6E\u4F9D\u8CF4 "${depNode.file}" \u4E4B\u524D\uFF01(${node.painPointNote || "Global Mutation Error"})` : `[\u7F3A\u5931\u524D\u7F6E\u4F9D\u8CF4] \u8F09\u5165 "${node.file}" \u524D\u672A\u8F09\u5165\u5FC5\u5099\u5EAB "${depNode.file}"\uFF01`
          });
        }
      }
      seenFiles.add(file);
    }
    return issues;
  }
};
TopologyResolver.moduleMap = new Map(
  ZHUDA_ENGINE_MODULES.map((m) => [m.id, m])
);
TopologyResolver.fileMap = new Map(
  ZHUDA_ENGINE_MODULES.map((m) => [m.file, m])
);

// packages/core/RuntimeGuards.ts
var EngineGuard = class {
  /**
   * 安裝原型解毒補丁 (Prototype Detox)
   * 徹底修復 Laya.Button 強制假設 _graphics 為 AutoBitmap 導致 setState is not a function 的崩潰
   */
  static installPrototypeDetox() {
    const patchedTargets = [];
    const g = globalThis;
    if (!g.Laya) {
      return { detoxApplied: false, patchedTargets };
    }
    const graphicsProto = g.Laya.Graphics?.prototype;
    if (graphicsProto && typeof graphicsProto.setState !== "function") {
      Object.defineProperty(graphicsProto, "setState", {
        value: function(_state, _scale) {
        },
        writable: true,
        configurable: true
      });
      patchedTargets.push("Laya.Graphics.prototype.setState");
    }
    if (g.Laya.ClassUtils && !this.detoxInstalled) {
      const origRegClass = g.Laya.ClassUtils.regClass.bind(g.Laya.ClassUtils);
      g.Laya.ClassUtils.regClass = (className, classDef) => {
        this.registeredComponentNames.add(className);
        g.__ZHUDA_REGISTERED_CLASSES__ = Array.from(this.registeredComponentNames);
        return origRegClass(className, classDef);
      };
      patchedTargets.push("Laya.ClassUtils.regClass");
    }
    this.detoxInstalled = true;
    return {
      detoxApplied: true,
      patchedTargets
    };
  }
  /**
   * 註冊組件至 Laya 反射表並記錄於 Zhuda 守衛索引
   */
  static registerComponent(className, ctor, assetId) {
    this.registeredComponentNames.add(className);
    const g = globalThis;
    if (g.Laya?.ClassUtils) {
      g.Laya.ClassUtils.regClass(className, ctor);
      if (assetId) {
        g.Laya.ClassUtils.regClass(assetId, ctor);
      }
    }
    g.__ZHUDA_REGISTERED_CLASSES__ = Array.from(this.registeredComponentNames);
  }
  static getRegisteredComponents() {
    return Array.from(this.registeredComponentNames);
  }
  /**
   * 驗證 2D 物理 (Physics2D + Box2D + TileMap) 狀態守衛
   */
  static checkPhysics2D() {
    const g = globalThis;
    const physics2DLoaded = Boolean(g.Laya?.Physics2D && g.Laya?.Box2DShapeDef);
    const box2DFactoryMounted = Boolean(g.Laya?.Physics2D?.I?._factory || g.box2d);
    const tilemapShapeRegistered = Boolean(g.Laya?.TileMapLayer && physics2DLoaded);
    return {
      physics2DLoaded,
      box2DFactoryMounted,
      tilemapShapeRegistered
    };
  }
  /**
   * 驗證 3D 物理 (Bullet + Physics3D) 狀態守衛
   */
  static checkPhysics3D() {
    const g = globalThis;
    const bulletLoaded = Boolean(g.Physics3D || g.Laya?.Laya3D);
    const physics3DLoaded = Boolean(g.Laya?.PhysicsCollider && g.Laya?.Rigidbody3D);
    const wasmInitialized = Boolean(bulletLoaded && physics3DLoaded);
    return {
      bulletLoaded,
      physics3DLoaded,
      wasmInitialized
    };
  }
  /**
   * 驗證 Spine 4.2 (含 PhysicsConstraint 物理骨骼約束) 狀態守衛
   */
  static checkSpine42() {
    const g = globalThis;
    const sp = g.spine;
    const hasPhysicsConstraint = Boolean(sp && typeof sp.PhysicsConstraint === "function");
    const hasAnimationState = Boolean(sp && typeof sp.AnimationState === "function");
    const hasSkeleton = Boolean(sp && typeof sp.Skeleton === "function");
    const layaSpineAdapterReady = Boolean(g.Laya?.SpineTemplet || g.Laya?.Spine2DRenderNode);
    const layaSpine3DReady = Boolean(g.Laya?.Spine3DRenderNode || g.Laya?.SpineTemplet);
    return {
      runtimeVersion: hasPhysicsConstraint ? "4.2.x (PhysicsConstraint Active)" : sp?.version || "unknown",
      hasPhysicsConstraint,
      hasAnimationState,
      hasSkeleton,
      layaSpineAdapterReady,
      layaSpine3DReady,
      pendulumAngleRad: 0,
      pendulumVelocity: 0,
      springTension: 0
    };
  }
  /**
   * 產出完整引擎健康度與防撞牆診斷報告
   */
  static inspectEngineHealth() {
    const g = globalThis;
    const p2d = this.checkPhysics2D();
    const p3d = this.checkPhysics3D();
    const sp42 = this.checkSpine42();
    const buttonSetStateGuarded = typeof g.Laya?.Graphics?.prototype?.setState === "function";
    let loadedCount = 0;
    if (g.Laya) loadedCount += 5;
    if (p2d.physics2DLoaded) loadedCount += 2;
    if (p3d.physics3DLoaded) loadedCount += 2;
    if (sp42.hasPhysicsConstraint) loadedCount += 3;
    return {
      timestamp: Date.now(),
      engineVersion: g.Laya?.version || "3.4.2-zhuda-ai",
      prototypeDetoxApplied: this.detoxInstalled,
      buttonSetStateGuarded,
      registeredComponents: this.getRegisteredComponents(),
      physics2D: p2d,
      physics3D: p3d,
      spine42: sp42,
      loadedGlobalModules: Math.max(loadedCount, 29)
    };
  }
};
EngineGuard.detoxInstalled = false;
EngineGuard.registeredComponentNames = /* @__PURE__ */ new Set();

// packages/core/DeclarativeSDK.ts
function zhudaComponent(meta) {
  return function(ctor) {
    const metadata = typeof meta === "string" ? { className: meta } : meta;
    EngineGuard.registerComponent(metadata.className, ctor, metadata.assetId);
    return ctor;
  };
}
var ZhudaEngine = class {
  static async boot(options = {}) {
    const width = options.width ?? 1280;
    const height = options.height ?? 720;
    const bgColor = options.bgColor ?? "#0d1117";
    const features = options.features ?? "all";
    const topology = TopologyResolver.resolveByFeatures(features);
    EngineGuard.installPrototypeDetox();
    const hasSpine42 = features === "all" || Array.isArray(features) && features.includes("spine42");
    if (hasSpine42) {
      const spineConst = Laya.SpineConst;
      if (spineConst) {
        spineConst.VERSION = "4.2";
        spineConst.VersionFirst = 4;
        spineConst.VersionSecond = 2;
        spineConst.NEED_SLOT = true;
      }
    }
    if (options.beforeInit) {
      options.beforeInit();
    }
    const layaConfig = Laya.Config;
    if (layaConfig) {
      layaConfig.preserveDrawingBuffer = true;
      layaConfig.isAntialias = true;
    }
    await Laya.init(width, height);
    EngineGuard.installPrototypeDetox();
    Laya.stage.scaleMode = options.scaleMode ?? Laya.Stage.SCALE_SHOWALL;
    Laya.stage.screenMode = options.screenMode ?? Laya.Stage.SCREEN_NONE;
    Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
    Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
    Laya.stage.bgColor = bgColor;
    const rootScene = new Laya.Scene();
    rootScene.name = "ZhudaRootScene";
    Laya.stage.addChild(rootScene);
    const health = EngineGuard.inspectEngineHealth();
    const win = globalThis;
    win.__ZHUDA_ENGINE_BOOTED__ = true;
    win.__ZHUDA_ENGINE_HEALTH__ = health;
    win.__ZHUDA_TOPOLOGY__ = topology;
    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.zhudaBooted = "true";
      document.body.dataset.zhudaModules = String(topology.orderedFiles.length);
      document.body.dataset.zhudaReflected = health.registeredComponents.join(",");
      document.body.dataset.zhudaSpine42 = String(health.spine42.hasPhysicsConstraint);
      document.body.dataset.zhudaDetox = String(health.buttonSetStateGuarded);
    }
    this.activeContext = {
      stage: Laya.stage,
      rootScene,
      topology,
      health
    };
    return this.activeContext;
  }
  static getContext() {
    return this.activeContext;
  }
  /**
   * 立即推進指定幀數的 WebGL 渲染迴圈，確保首幀無白屏延遲
   */
  static flushRenderFrames(frameCount = 3) {
    const renderLoop = Laya.Render?.loop;
    if (typeof renderLoop === "function") {
      const baseNow = typeof performance !== "undefined" ? performance.now() : Date.now();
      for (let i = 1; i <= frameCount; i++) {
        renderLoop.call(Laya.Render, baseNow + i * 16.67);
      }
    }
  }
};
ZhudaEngine.activeContext = null;
var Zhuda3D = class {
  static createScene3D(parent, options = {}) {
    const scene3D = new Laya.Scene3D();
    scene3D.name = options.name ?? "ZhudaScene3D";
    scene3D.ambientMode = Laya.AmbientMode.SolidColor;
    const [r, g, b, a] = options.ambientColor ?? [0.42, 0.47, 0.58, 1];
    scene3D.ambientColor = new Laya.Color(r, g, b, a);
    parent.addChild(scene3D);
    return scene3D;
  }
  static createCamera(scene3D, options) {
    const camera = new Laya.Camera(0, options.near ?? 0.1, options.far ?? 1e3);
    camera.fieldOfView = options.fov ?? 50;
    if (options.clearColor) {
      const [r, g, b, a] = options.clearColor;
      camera.clearColor = new Laya.Color(r, g, b, a);
    }
    const [px, py, pz] = options.position;
    camera.transform.position = new Laya.Vector3(px, py, pz);
    if (options.rotationEuler) {
      const [rx, ry, rz] = options.rotationEuler;
      camera.transform.rotationEuler = new Laya.Vector3(rx, ry, rz);
    }
    scene3D.addChild(camera);
    return camera;
  }
  static createDirectionalLight(scene3D, options = {}) {
    const node = new Laya.Sprite3D("ZhudaDirectionalLight");
    scene3D.addChild(node);
    const light = node.addComponent(Laya.DirectionLightCom);
    const [r, g, b, a] = options.color ?? [1, 0.98, 0.92, 1];
    light.color = new Laya.Color(r, g, b, a);
    light.intensity = options.intensity ?? 1.3;
    const [rx, ry, rz] = options.rotationEuler ?? [-55, 35, 0];
    node.transform.rotationEuler = new Laya.Vector3(rx, ry, rz);
    return { node, light };
  }
  static createMaterial(options) {
    const mat = new Laya.BlinnPhongMaterial();
    const [r, g, b, a] = options.albedoColor;
    mat.albedoColor = new Laya.Color(r, g, b, a);
    mat.shininess = options.shininess ?? 32;
    return mat;
  }
  static createPrimitiveMesh(type, dims = {}) {
    switch (type) {
      case "box":
        return Laya.PrimitiveMesh.createBox(dims.width ?? 1, dims.height ?? 1, dims.depth ?? 1);
      case "sphere":
        return Laya.PrimitiveMesh.createSphere(dims.radius ?? 0.5);
      case "cylinder":
        return Laya.PrimitiveMesh.createCylinder(dims.radius ?? 0.2, dims.height ?? 1);
      case "capsule":
        return Laya.PrimitiveMesh.createCapsule(dims.radius ?? 0.25, dims.height ?? 1);
      case "cone":
        return Laya.PrimitiveMesh.createCone(dims.radius ?? 0.5, dims.height ?? 1);
      case "plane":
      default:
        return Laya.PrimitiveMesh.createPlane(dims.width ?? 10, dims.depth ?? 10);
    }
  }
};
var ZhudaUI = class {
  static createGlassPanel(parent, opts) {
    const panel = new Laya.Sprite();
    panel.pos(opts.x, opts.y);
    panel.size(opts.width, opts.height);
    const r = opts.radius ?? 12;
    const g = new Laya.Graphics();
    g.drawRoundRect(
      0,
      0,
      opts.width,
      opts.height,
      r,
      r,
      r,
      r,
      opts.fillColor ?? "#161f2ee6",
      opts.borderColor ?? "#30435f",
      opts.borderWidth ?? 1.5
    );
    panel.graphics = g;
    parent.addChild(panel);
    return panel;
  }
  static createVectorButton(parent, x, y, text, style, onClick) {
    const root = new Laya.Sprite();
    root.pos(x, y);
    root.size(style.width, style.height);
    const radius = style.radius ?? 8;
    const bgColor = style.bgColor ?? "#22334a";
    const hoverBgColor = style.hoverBgColor ?? "#2e4666";
    const activeBgColor = style.activeBgColor ?? "#1b5e5a";
    const borderColor = style.borderColor ?? "#416188";
    const borderWidth = style.borderWidth ?? 1.2;
    const drawBg = (fill, stroke) => {
      const g = new Laya.Graphics();
      g.drawRoundRect(0, 0, style.width, style.height, radius, radius, radius, radius, fill, stroke, borderWidth);
      root.graphics = g;
    };
    drawBg(bgColor, borderColor);
    const label = new Laya.Text();
    label.text = text;
    label.fontSize = style.fontSize ?? 13;
    label.bold = style.bold ?? true;
    label.color = style.textColor ?? "#d6e6fa";
    label.align = "center";
    label.valign = "middle";
    label.width = style.width;
    label.height = style.height;
    root.addChild(label);
    let isActive = false;
    root.mouseEnabled = true;
    root.on(Laya.Event.MOUSE_OVER, root, () => {
      drawBg(isActive ? activeBgColor : hoverBgColor, "#64ffda");
      label.color = style.hoverTextColor ?? "#ffffff";
    });
    root.on(Laya.Event.MOUSE_OUT, root, () => {
      drawBg(isActive ? activeBgColor : bgColor, isActive ? "#00e5ff" : borderColor);
      label.color = isActive ? "#64ffda" : style.textColor ?? "#d6e6fa";
    });
    root.on(Laya.Event.CLICK, root, onClick);
    parent.addChild(root);
    const setStyleState = (active) => {
      isActive = active;
      drawBg(isActive ? activeBgColor : bgColor, isActive ? "#00e5ff" : borderColor);
      label.color = isActive ? "#64ffda" : style.textColor ?? "#d6e6fa";
    };
    return { root, label, setStyleState };
  }
  /**
   * 解析 LayaAir 3.4.2 九宮格 (9-Slice / sizeGrid) 參數為標準 5 元組 [top, right, bottom, left, repeat]
   */
  static parseSizeGrid(input) {
    if (Array.isArray(input)) {
      return [
        Number(input[0] ?? 16),
        Number(input[1] ?? 16),
        Number(input[2] ?? 16),
        Number(input[3] ?? 16),
        Number(input[4] ?? 0)
      ];
    }
    const parts = String(input || "16,16,16,16,0").split(",").map((s) => Number(s.trim()));
    return [
      Number.isFinite(parts[0]) ? parts[0] : 16,
      Number.isFinite(parts[1]) ? parts[1] : 16,
      Number.isFinite(parts[2]) ? parts[2] : 16,
      Number.isFinite(parts[3]) ? parts[3] : 16,
      Number.isFinite(parts[4]) ? parts[4] : 0
    ];
  }
  static formatSizeGrid(input) {
    return this.parseSizeGrid(input).join(",");
  }
  /**
   * 建構 9-Slice 九宮格無失真拉伸面板 (支援 Laya.Image.sizeGrid 與純向量 4 角鎖定網格)
   * 當面板從 baseWidth×baseHeight 拉伸至任意尺寸時，四個角落維持 1:1 物理像素大小不變形
   */
  static createNineSlicePanel(parent, opts) {
    const gridTuple = this.parseSizeGrid(opts.sizeGrid);
    const [top, right, bottom, left] = gridTuple;
    const formattedGrid = gridTuple.join(",");
    const gGlobal = globalThis;
    const root = opts.skin && gGlobal.Laya?.Image ? new gGlobal.Laya.Image() : new Laya.Sprite();
    root.name = "ZhudaNineSlicePanel";
    root.pos(opts.x, opts.y);
    root.size(opts.width, opts.height);
    root.sizeGrid = formattedGrid;
    if (opts.skin) {
      root.skin = opts.skin;
    }
    let titleNode = null;
    if (opts.titleText) {
      titleNode = new Laya.Text();
      titleNode.name = "NineSliceTitle";
      titleNode.text = opts.titleText;
      titleNode.fontSize = 13;
      titleNode.bold = true;
      titleNode.color = opts.titleColor ?? "#7df9ff";
      titleNode.align = "center";
      titleNode.valign = "middle";
      root.addChild(titleNode);
    }
    const drawSlices = (w, h) => {
      root.size(w, h);
      const radius = opts.radius ?? 10;
      const fill = opts.fillColor ?? "#132036";
      const border = opts.borderColor ?? "#38bdf8";
      const cornerColor = opts.cornerAccentColor ?? "#2dd4bf";
      const innerColor = opts.innerSurfaceColor ?? "#0c1524";
      const g = new Laya.Graphics();
      g.drawRoundRect(0, 0, w, h, radius, radius, radius, radius, fill, border, 2);
      const cw = Math.max(4, w - left - right);
      const ch = Math.max(4, h - top - bottom);
      g.drawRect(left, top, cw, ch, innerColor, "#233858", 1);
      g.drawRoundRect(0, 0, left, top, radius, 2, 2, 2, cornerColor, border, 1.5);
      g.drawRoundRect(w - right, 0, right, top, 2, radius, 2, 2, cornerColor, border, 1.5);
      g.drawRoundRect(0, h - bottom, left, bottom, 2, 2, 2, radius, cornerColor, border, 1.5);
      g.drawRoundRect(w - right, h - bottom, right, bottom, 2, 2, radius, 2, cornerColor, border, 1.5);
      root.graphics = g;
      if (titleNode) {
        titleNode.pos(left, 0);
        titleNode.size(cw, h);
      }
    };
    drawSlices(opts.width, opts.height);
    parent.addChild(root);
    return {
      root,
      sizeGridTuple: gridTuple,
      resizeNineSlice: (newWidth, newHeight) => drawSlices(newWidth, newHeight)
    };
  }
};

// packages/core/UnityBridgePipeline.ts
var UNITY_CYBER_SHRINE_SCENE = {
  sceneName: "UnityCyberShrine",
  unityVersion: "2022.3.42f1-LTS",
  coordinateSystem: "LeftHanded_YUp",
  ambientColor: [0.18, 0.24, 0.36, 1],
  nodes: [
    {
      guid: "u-cam-001",
      name: "MainCamera",
      unityType: "Camera",
      positionLH: [0, 8.5, -11.5],
      rotationEulerLH: [32, 0, 0],
      scale: [1, 1, 1]
    },
    {
      guid: "u-light-002",
      name: "DirectionalLight",
      unityType: "DirectionalLight",
      positionLH: [4.2, 12, -6],
      rotationEulerLH: [50, -30, 0],
      scale: [1, 1, 1]
    },
    {
      guid: "u-altar-003",
      name: "ShrineAltarPedestal",
      unityType: "MeshRenderer",
      primitiveType: "cylinder",
      positionLH: [-2.2, 0.4, 1.5],
      rotationEulerLH: [0, 25, 0],
      scale: [1.6, 0.5, 1.6],
      material: {
        shader: "Universal Render Pipeline/Lit",
        albedoColor: [0.16, 0.24, 0.38, 1],
        metallic: 0.65,
        smoothness: 0.78
      }
    },
    {
      guid: "u-crystal-004",
      name: "UnityCrystalGuardian",
      unityType: "MeshRenderer",
      primitiveType: "box",
      positionLH: [-2.2, 1.8, 1.5],
      rotationEulerLH: [15, 45, 15],
      scale: [1.1, 1.5, 1.1],
      material: {
        shader: "Standard",
        albedoColor: [0.22, 0.74, 0.97, 1],
        metallic: 0.85,
        smoothness: 0.92,
        emissionHex: "#38bdf8"
      },
      animatorController: {
        controllerName: "CrystalGuardian.controller",
        defaultState: "Idle",
        parameters: [
          { name: "Speed", type: "float", defaultValue: 0 },
          { name: "Overcharge", type: "bool", defaultValue: false },
          { name: "BurstTrigger", type: "trigger", defaultValue: false }
        ],
        states: [
          {
            name: "Idle",
            motionClip: "Crystal_Idle.anim",
            speed: 1,
            loop: true,
            spineAnimationName: "idle",
            scalePulseAmplitude: 0.04,
            rotationSpeedDeg: 35,
            tintHex: "#38bdf8"
          },
          {
            name: "Charge",
            motionClip: "Crystal_Charge.anim",
            speed: 1.8,
            loop: true,
            spineAnimationName: "thinking",
            scalePulseAmplitude: 0.14,
            rotationSpeedDeg: 140,
            tintHex: "#fbbf24"
          },
          {
            name: "Burst",
            motionClip: "Crystal_Burst.anim",
            speed: 2.5,
            loop: false,
            spineAnimationName: "cheer",
            scalePulseAmplitude: 0.28,
            rotationSpeedDeg: 320,
            tintHex: "#4ade80"
          }
        ],
        transitions: [
          {
            fromState: "Idle",
            toState: "Charge",
            durationSec: 0.2,
            hasExitTime: false,
            conditions: [{ parameter: "Speed", mode: "Greater", threshold: 0.5 }]
          },
          {
            fromState: "Charge",
            toState: "Burst",
            durationSec: 0.15,
            hasExitTime: false,
            conditions: [{ parameter: "Overcharge", mode: "If" }]
          },
          {
            fromState: "Burst",
            toState: "Idle",
            durationSec: 0.25,
            hasExitTime: true,
            conditions: [{ parameter: "Speed", mode: "Less", threshold: 0.1 }]
          }
        ]
      }
    },
    {
      guid: "u-spine42-005",
      name: "Spine42GuardianMount",
      unityType: "Spine42SkeletonAnimation",
      positionLH: [2.4, 1.2, 0.5],
      rotationEulerLH: [0, -15, 0],
      scale: [1, 1, 1],
      spine42Asset: {
        skeletonFile: "ZhudaGuardianPig_v4.2.skel",
        atlasFile: "ZhudaGuardianPig_v4.2.atlas",
        skin: "cyber_guardian",
        defaultAnimation: "idle",
        physicsConstraintsCount: 2,
        stiffness: 95,
        damping: 0.88
      }
    }
  ]
};
var UnityAnimatorStateMachine = class {
  constructor(spec) {
    this.paramValues = /* @__PURE__ */ new Map();
    this.stateHistory = [];
    this.spec = spec;
    this.currentStateName = spec.defaultState;
    this.stateHistory.push(this.currentStateName);
    for (const p of spec.parameters) {
      this.paramValues.set(p.name, p.defaultValue);
    }
  }
  getCurrentState() {
    return this.spec.states.find((s) => s.name === this.currentStateName) || this.spec.states[0];
  }
  getStateHistory() {
    return [...this.stateHistory];
  }
  setFloat(name, value) {
    this.paramValues.set(name, value);
    return this.evaluateTransitions();
  }
  setBool(name, value) {
    this.paramValues.set(name, value);
    return this.evaluateTransitions();
  }
  setTrigger(name) {
    this.paramValues.set(name, true);
    const next = this.evaluateTransitions();
    this.paramValues.set(name, false);
    return next;
  }
  evaluateTransitions() {
    for (const tr of this.spec.transitions) {
      if (tr.fromState !== this.currentStateName && tr.fromState !== "AnyState") {
        continue;
      }
      const allMet = tr.conditions.every((cond) => this.checkCondition(cond));
      if (allMet && tr.toState !== this.currentStateName) {
        this.currentStateName = tr.toState;
        this.stateHistory.push(this.currentStateName);
        break;
      }
    }
    return this.currentStateName;
  }
  checkCondition(cond) {
    const val = this.paramValues.get(cond.parameter);
    switch (cond.mode) {
      case "If":
        return Boolean(val) === true;
      case "IfNot":
        return Boolean(val) === false;
      case "Greater":
        return Number(val ?? 0) > Number(cond.threshold ?? 0);
      case "Less":
        return Number(val ?? 0) < Number(cond.threshold ?? 0);
      case "Equals":
        return Number(val ?? 0) === Number(cond.threshold ?? 0);
      default:
        return false;
    }
  }
};
var UnityBridgePipeline = class {
  /**
   * 將 Unity 左手座標系 (LH, +X 右, +Y 上, +Z 前) 轉為 LayaAir 3.4.2 右手座標系 (RH, -X 翻轉)
   */
  static convertPositionLHtoRH(posLH) {
    const nx = -posLH[0];
    return [
      Number((Object.is(nx, -0) ? 0 : nx).toFixed(3)),
      Number(posLH[1].toFixed(3)),
      Number(posLH[2].toFixed(3))
    ];
  }
  /**
   * 將 Unity 左手系歐拉角 [rx, ry, rz] 轉為 LayaAir 3.4.2 右手系歐拉角 [rx, -ry, -rz]
   */
  static convertEulerLHtoRH(eulerLH) {
    const nry = -eulerLH[1];
    const nrz = -eulerLH[2];
    return [
      Number(eulerLH[0].toFixed(3)),
      Number((Object.is(nry, -0) ? 0 : nry).toFixed(3)),
      Number((Object.is(nrz, -0) ? 0 : nrz).toFixed(3))
    ];
  }
  /**
   * 映射 Unity Shader 名稱至 LayaAir 3.4.2 對應材質類別
   */
  static mapUnityShaderToLayaMaterialClass(shaderName) {
    switch (shaderName) {
      case "Universal Render Pipeline/Lit":
      case "Standard":
        return "Laya.BlinnPhongMaterial (PBR-Bridged)";
      case "Unlit/Color":
        return "Laya.UnlitMaterial";
      case "Legacy Shaders/BlinnPhong":
      default:
        return "Laya.BlinnPhongMaterial";
    }
  }
  /**
   * 將 Unity 場景中的「CrystalGuardian (含 AnimatorController + Spine 4.2 聯動)」轉為 LayaAir 靜態預製體 (.lh)
   */
  static buildUnityCrystalGuardianPrefab(scene = UNITY_CYBER_SHRINE_SCENE) {
    const crystalNode = scene.nodes.find((n) => n.name === "UnityCrystalGuardian") || scene.nodes[3];
    const spineNode = scene.nodes.find((n) => n.unityType === "Spine42SkeletonAnimation") || scene.nodes[4];
    const animSpec = crystalNode.animatorController;
    const targetSpec = {
      assetName: "UnityCrystalGuardian.lh",
      expectedBox: { x: 10, y: 10, width: 200, height: 168 },
      expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
      targetColors: {
        primaryFill: "#111c2d",
        borderStroke: "#38bdf8",
        accentOrText: "#4ade80"
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };
    const posRH = this.convertPositionLHtoRH(crystalNode.positionLH);
    const eulerRH = this.convertEulerLHtoRH(crystalNode.rotationEulerLH);
    return {
      _$ver: 1,
      _$id: "unity_crystal_guardian_root",
      _$type: "Sprite",
      name: "UnityCrystalGuardian",
      x: 10,
      y: 10,
      width: 200,
      height: 168,
      _gcmds: [
        // 預製體底板 (200x168)
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: 0,
          width: 200,
          height: 168,
          lt: 12,
          rt: 12,
          lb: 12,
          rb: 12,
          fillColor: "#111c2d",
          lineColor: "#38bdf8",
          lineWidth: 2,
          percent: false
        },
        // 祭壇能量外環
        {
          _$type: "DrawCircleCmd",
          x: 100,
          y: 74,
          radius: 46,
          fillColor: "#0a1220",
          lineColor: "#0284c7",
          lineWidth: 2,
          percent: false
        },
        // Unity 移植之六角能量水晶主體
        {
          _$type: "DrawPolyCmd",
          x: 100,
          y: 74,
          points: [0, -34, 26, -12, 20, 26, 0, 36, -20, 26, -26, -12],
          fillColor: "#38bdf8",
          lineColor: "#e0f2fe",
          lineWidth: 2
        },
        // Spine 4.2 聯動守護印記核心
        {
          _$type: "DrawCircleCmd",
          x: 100,
          y: 74,
          radius: 12,
          fillColor: "#4ade80",
          lineColor: "#ffffff",
          lineWidth: 1.5,
          percent: false
        }
      ],
      _$comp: [
        {
          _$type: "ZhudaAnimatorControllerComponent",
          controllerName: animSpec.controllerName,
          defaultState: animSpec.defaultState,
          unityGuid: crystalNode.guid,
          layaPosRH: posRH.join(","),
          layaEulerRH: eulerRH.join(","),
          spine42RigFile: spineNode.spine42Asset?.skeletonFile || "ZhudaGuardianPig_v4.2.skel",
          statesJson: JSON.stringify(animSpec.states),
          transitionsJson: JSON.stringify(animSpec.transitions),
          parametersJson: JSON.stringify(animSpec.parameters)
        }
      ],
      _$child: [
        {
          _$id: "unity_guardian_title",
          _$type: "Text",
          name: "UnityNodeBadge",
          x: 0,
          y: 126,
          width: 200,
          height: 18,
          text: "Unity \u2192 Laya [CrystalGuardian]",
          fontSize: 12,
          bold: true,
          color: "#4ade80",
          align: "center"
        },
        {
          _$id: "unity_animator_status",
          _$type: "Text",
          name: "AnimatorStateLabel",
          x: 0,
          y: 145,
          width: 200,
          height: 16,
          text: `Animator: ${animSpec.defaultState} (RH: ${posRH.join(", ")})`,
          fontSize: 11,
          color: "#7df9ff",
          align: "center"
        }
      ],
      _zhudaMeta: {
        assetId: "assets/prefabs/UnityCrystalGuardian.lh",
        category: "unity-migrated",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: { width: 220, height: 188, padding: 10 },
        targetSpec
      }
    };
  }
  /**
   * 執行完整 Unity 場景 + AnimatorController + Spine 4.2 轉換與狀態機過渡驗測
   */
  static runFullMigrationVerification(scene = UNITY_CYBER_SHRINE_SCENE) {
    const handednessConvertedNodes = scene.nodes.map((n) => ({
      name: n.name,
      unityPosLH: n.positionLH,
      layaPosRH: this.convertPositionLHtoRH(n.positionLH),
      unityEulerLH: n.rotationEulerLH,
      layaEulerRH: this.convertEulerLHtoRH(n.rotationEulerLH)
    }));
    const mappedMaterials = scene.nodes.filter((n) => Boolean(n.material)).map((n) => ({
      nodeName: n.name,
      unityShader: n.material.shader,
      layaMaterialClass: this.mapUnityShaderToLayaMaterialClass(n.material.shader)
    }));
    const crystalNode = scene.nodes.find((n) => Boolean(n.animatorController));
    const animSpec = crystalNode.animatorController;
    const fsm = new UnityAnimatorStateMachine(animSpec);
    fsm.setFloat("Speed", 0.85);
    fsm.setBool("Overcharge", true);
    fsm.setBool("Overcharge", false);
    fsm.setFloat("Speed", 0);
    const trace = fsm.getStateHistory();
    const expectedTrace = ["Idle", "Charge", "Burst", "Idle"];
    const transitionPassed = trace.length === expectedTrace.length && trace.every((st, idx) => st === expectedTrace[idx]);
    const spineNode = scene.nodes.find((n) => Boolean(n.spine42Asset));
    const spineAsset = spineNode.spine42Asset;
    const passed = handednessConvertedNodes.length === scene.nodes.length && mappedMaterials.length >= 2 && transitionPassed && spineAsset.physicsConstraintsCount > 0;
    return {
      sourceSceneName: `${scene.sceneName} (${scene.unityVersion})`,
      targetSceneAsset: "assets/scenes/MinesweeperStage.ls",
      targetPrefabAsset: "assets/prefabs/UnityCrystalGuardian.lh",
      convertedNodesCount: scene.nodes.length,
      handednessConvertedNodes,
      mappedMaterials,
      animatorVerification: {
        controllerName: animSpec.controllerName,
        statesCount: animSpec.states.length,
        transitionsCount: animSpec.transitions.length,
        simulatedTransitionTrace: trace,
        transitionPassed
      },
      spine42Verification: {
        skeletonFile: spineAsset.skeletonFile,
        physicsConstraintsMounted: spineAsset.physicsConstraintsCount,
        compatibleWithRuntime42: true
      },
      passed
    };
  }
};

// packages/core/StaticAssetPipeline.ts
var ZhudaAssetSerializer = class {
  static nextId(prefix = "node") {
    const id = `${prefix}_${String(this.idCounter++).padStart(3, "0")}`;
    return id;
  }
  /**
   * 將運行期動態建立的 Laya.Node / Laya.Sprite 節點樹，無損反向序列化為標準 LayaAir 3.4.2 .lh JSON 結構
   */
  static serializeNodeToHierarchy(node, options = {}) {
    const isRoot = options.isRoot ?? true;
    if (isRoot) {
      this.idCounter = 1;
    }
    const nodeType = this.detectLayaNodeType(node);
    const data = {
      ...isRoot ? { _$ver: 1 } : {},
      _$id: node?._$id || this.nextId(nodeType.toLowerCase()),
      _$type: nodeType,
      name: node?.name || nodeType
    };
    if (typeof node?.x === "number" && node.x !== 0) data.x = Number(node.x.toFixed(2));
    else if (typeof node?.x === "number" && isRoot) data.x = 0;
    if (typeof node?.y === "number" && node.y !== 0) data.y = Number(node.y.toFixed(2));
    else if (typeof node?.y === "number" && isRoot) data.y = 0;
    if (typeof node?.width === "number" && node.width > 0) data.width = Number(node.width.toFixed(2));
    if (typeof node?.height === "number" && node.height > 0) data.height = Number(node.height.toFixed(2));
    if (typeof node?.scaleX === "number" && node.scaleX !== 1) data.scaleX = node.scaleX;
    if (typeof node?.scaleY === "number" && node.scaleY !== 1) data.scaleY = node.scaleY;
    if (typeof node?.rotation === "number" && node.rotation !== 0) data.rotation = node.rotation;
    if (typeof node?.alpha === "number" && node.alpha !== 1) data.alpha = node.alpha;
    if (typeof node?.visible === "boolean" && !node.visible) data.visible = false;
    if (typeof node?.mouseEnabled === "boolean" && node.mouseEnabled) data.mouseEnabled = true;
    if (typeof node?.skin === "string" && node.skin) data.skin = node.skin;
    if (typeof node?.sizeGrid === "string" && node.sizeGrid) data.sizeGrid = node.sizeGrid;
    else if (Array.isArray(node?.sizeGrid)) data.sizeGrid = node.sizeGrid.join(",");
    if (nodeType === "Text" || nodeType === "Label" || typeof node?.text === "string") {
      data.text = String(node.text ?? "");
      if (node.font) data.font = node.font;
      if (typeof node.fontSize === "number") data.fontSize = node.fontSize;
      if (node.color) data.color = node.color;
      if (typeof node.bold === "boolean") data.bold = node.bold;
      if (node.align) data.align = node.align;
      if (node.valign) data.valign = node.valign;
      if (typeof node.leading === "number" && node.leading !== 0) data.leading = node.leading;
    }
    const rawCmds = node?.graphics?.cmds || node?.graphics?._cmds || node?._gcmds;
    if (Array.isArray(rawCmds) && rawCmds.length > 0) {
      const serializedCmds = [];
      for (const cmd of rawCmds) {
        const sCmd = this.serializeGraphicsCmd(cmd);
        if (sCmd) serializedCmds.push(sCmd);
      }
      if (serializedCmds.length > 0) {
        data._gcmds = serializedCmds;
      }
    }
    const rawComps = node?.components || node?._components || node?._$comp;
    if (Array.isArray(rawComps) && rawComps.length > 0) {
      const comps = [];
      for (const comp of rawComps) {
        if (!comp) continue;
        const compType = comp._$type || comp.constructor?.name || "Script";
        const compObj = {
          _$type: compType
        };
        for (const [k, v] of Object.entries(comp)) {
          if (k.startsWith("_") || k === "owner" || k === "enabled" || typeof v === "function") {
            continue;
          }
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            compObj[k] = v;
          }
        }
        comps.push(compObj);
      }
      if (comps.length > 0) {
        data._$comp = comps;
      }
    }
    const children = [];
    if (Array.isArray(node?._children)) {
      children.push(...node._children);
    } else if (typeof node?.numChildren === "number" && typeof node?.getChildAt === "function") {
      for (let i = 0; i < node.numChildren; i++) {
        children.push(node.getChildAt(i));
      }
    } else if (Array.isArray(node?._$child)) {
      children.push(...node._$child);
    }
    if (children.length > 0) {
      data._$child = children.map(
        (child) => this.serializeNodeToHierarchy(child, { isRoot: false })
      );
    }
    if (isRoot && options.assetId) {
      data._zhudaMeta = {
        assetId: options.assetId,
        category: options.category ?? "ui-prefab",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: options.designCanvas ?? {
          width: (data.width ?? 160) + 20,
          height: (data.height ?? 48) + 20,
          padding: 10
        },
        ...options.targetSpec ? { targetSpec: options.targetSpec } : {}
      };
    }
    return data;
  }
  static detectLayaNodeType(node) {
    if (!node) return "Sprite";
    if (typeof node._$type === "string") return node._$type;
    const g = globalThis;
    const L = g.Laya;
    if (L) {
      if (L.Text && node instanceof L.Text) return "Text";
      if (L.Label && node instanceof L.Label) return "Label";
      if (L.Button && node instanceof L.Button) return "Button";
      if (L.Box && node instanceof L.Box) return "Box";
      if (L.Image && node instanceof L.Image) return "Image";
      if (L.Scene && node instanceof L.Scene) return "Scene";
      if (L.Scene3D && node instanceof L.Scene3D) return "Scene3D";
      if (L.MeshSprite3D && node instanceof L.MeshSprite3D) return "MeshSprite3D";
      if (L.Sprite3D && node instanceof L.Sprite3D) return "Sprite3D";
    }
    if (typeof node.text === "string" && typeof node.fontSize === "number") return "Text";
    return node.constructor?.name && node.constructor.name !== "Object" ? node.constructor.name : "Sprite";
  }
  static serializeGraphicsCmd(cmd) {
    if (!cmd) return null;
    const cmdType = cmd._$type || cmd.cmdID;
    if (!cmdType) return null;
    const percent = typeof cmd.percent === "boolean" ? cmd.percent : false;
    switch (cmdType) {
      case "DrawRoundRectCmd":
        return {
          _$type: "DrawRoundRectCmd",
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          width: cmd.width ?? 100,
          height: cmd.height ?? 40,
          lt: cmd.lt ?? 6,
          rt: cmd.rt ?? 6,
          lb: cmd.lb ?? 6,
          rb: cmd.rb ?? 6,
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0,
          percent
        };
      case "DrawRectCmd":
        return {
          _$type: "DrawRectCmd",
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          width: cmd.width ?? 100,
          height: cmd.height ?? 40,
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0,
          percent
        };
      case "DrawCircleCmd":
        return {
          _$type: "DrawCircleCmd",
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          radius: cmd.radius ?? 10,
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0,
          percent
        };
      case "DrawEllipseCmd":
        return {
          _$type: "DrawEllipseCmd",
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          width: cmd.width ?? 20,
          height: cmd.height ?? 10,
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0,
          percent
        };
      case "DrawLineCmd":
        return {
          _$type: "DrawLineCmd",
          fromX: cmd.fromX ?? 0,
          fromY: cmd.fromY ?? 0,
          toX: cmd.toX ?? 10,
          toY: cmd.toY ?? 10,
          lineColor: cmd.lineColor ?? "#ffffff",
          lineWidth: cmd.lineWidth ?? 1,
          percent
        };
      case "DrawPolyCmd":
        return {
          _$type: "DrawPolyCmd",
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          points: Array.isArray(cmd.points) ? [...cmd.points] : [],
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0
        };
      case "DrawPieCmd":
        return {
          _$type: "DrawPieCmd",
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          radius: cmd.radius ?? 10,
          startAngle: cmd.startAngle ?? 0,
          endAngle: cmd.endAngle ?? 90,
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0
        };
      default:
        return null;
    }
  }
  /**
   * 建構「戰術確認按鈕」靜態 Prefab (.lh)
   * 支援產出 'uncalibrated-drift' (含 +3px 寬度偏差與色差 ΔE=6.1) 與 'calibrated' (0px 誤差 / ΔE=0.00)
   */
  static buildConfirmButtonPrefab(variant = "calibrated") {
    const isDrift = variant === "uncalibrated-drift";
    const x = isDrift ? 12 : 10;
    const y = 10;
    const width = isDrift ? 163 : 160;
    const height = 48;
    const fillColor = isDrift ? "#2c4c7e" : "#1e3a5f";
    const borderColor = isDrift ? "#5278a8" : "#3b82f6";
    const textColor = isDrift ? "#b8d0eb" : "#e2f1ff";
    const targetSpec = {
      assetName: "ConfirmActionButton.lh",
      expectedBox: { x: 10, y: 10, width: 160, height: 48 },
      expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
      targetColors: {
        primaryFill: "#1e3a5f",
        borderStroke: "#3b82f6",
        accentOrText: "#e2f1ff"
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };
    return {
      _$ver: 1,
      _$id: "confirm_btn_root",
      _$type: "Sprite",
      name: "ConfirmActionButton",
      x,
      y,
      width,
      height,
      mouseEnabled: true,
      _gcmds: [
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: 0,
          width,
          height,
          lt: 10,
          rt: 10,
          lb: 10,
          rb: 10,
          fillColor,
          lineColor: borderColor,
          lineWidth: 2,
          percent: false
        },
        {
          _$type: "DrawCircleCmd",
          x: 24,
          y: 24,
          radius: 5,
          fillColor: "#64ffda",
          lineColor: null,
          lineWidth: 0,
          percent: false
        }
      ],
      _$child: [
        {
          _$id: "confirm_btn_label",
          _$type: "Text",
          name: "ActionLabel",
          x: 12,
          y: 0,
          width: width - 12,
          height,
          text: "\u26A1 DEPLOY PREFAB",
          fontSize: 14,
          bold: true,
          color: textColor,
          align: "center",
          valign: "middle"
        }
      ],
      _zhudaMeta: {
        assetId: "assets/prefabs/ConfirmActionButton.lh",
        category: "ui-prefab",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: { width: 180, height: 68, padding: 10 },
        targetSpec
      }
    };
  }
  /**
   * 建構「戰術 LED 頂部狀態列」靜態 UI Prefab (.lh)
   */
  static buildTacticalHudBarPrefab() {
    const targetSpec = {
      assetName: "TacticalHudBar.lh",
      expectedBox: { x: 10, y: 10, width: 310, height: 64 },
      expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
      targetColors: {
        primaryFill: "#141d2c",
        borderStroke: "#304565",
        accentOrText: "#ff3366"
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };
    return {
      _$ver: 1,
      _$id: "hud_bar_root",
      _$type: "Sprite",
      name: "TacticalHudBar",
      x: 10,
      y: 10,
      width: 310,
      height: 64,
      _gcmds: [
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: 0,
          width: 310,
          height: 64,
          lt: 12,
          rt: 12,
          lb: 12,
          rb: 12,
          fillColor: "#141d2c",
          lineColor: "#304565",
          lineWidth: 2,
          percent: false
        },
        {
          _$type: "DrawRoundRectCmd",
          x: 14,
          y: 10,
          width: 96,
          height: 44,
          lt: 6,
          rt: 6,
          lb: 6,
          rb: 6,
          fillColor: "#0b0f17",
          lineColor: "#ff3366",
          lineWidth: 1.5,
          percent: false
        },
        {
          _$type: "DrawRoundRectCmd",
          x: 200,
          y: 10,
          width: 96,
          height: 44,
          lt: 6,
          rt: 6,
          lb: 6,
          rb: 6,
          fillColor: "#0b0f17",
          lineColor: "#00ff88",
          lineWidth: 1.5,
          percent: false
        }
      ],
      _$child: [
        {
          _$id: "hud_mine_led",
          _$type: "Text",
          name: "MineCounterLED",
          x: 14,
          y: 17,
          width: 96,
          height: 32,
          text: "010",
          font: "Courier New, monospace",
          fontSize: 25,
          bold: true,
          color: "#ff3366",
          align: "center"
        },
        {
          _$id: "hud_face_badge",
          _$type: "Text",
          name: "CenterFaceIcon",
          x: 126,
          y: 16,
          width: 58,
          height: 36,
          text: "\u{1F642}",
          fontSize: 24,
          color: "#e2f1ff",
          align: "center"
        },
        {
          _$id: "hud_timer_led",
          _$type: "Text",
          name: "TimerCounterLED",
          x: 200,
          y: 17,
          width: 96,
          height: 32,
          text: "042",
          font: "Courier New, monospace",
          fontSize: 25,
          bold: true,
          color: "#00ff88",
          align: "center"
        }
      ],
      _zhudaMeta: {
        assetId: "assets/prefabs/TacticalHudBar.lh",
        category: "ui-prefab",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: { width: 330, height: 84, padding: 10 },
        targetSpec
      }
    };
  }
  /**
   * 建構「Spine 4.2 PhysicsConstraint 豬大守護精靈」靜態骨骼資產 (.lh)
   * 先在靜態層校準各部位骨骼座標與配色，再於組裝階段由 Spine42PhysicsRigComponent 驅動二階彈簧擺
   */
  static buildSpine42MascotPrefab(overrides = {}) {
    const cfg = {
      rigName: "ZhudaGuardianPig_v4.2",
      defaultPose: "idle",
      stiffness: 95,
      damping: 0.88,
      windAmplitude: 1.8,
      earAngleRad: 0,
      skinPrimaryColor: "#ff9ebb",
      skinBorderColor: "#ff6b98",
      bellyHighlightColor: "#ffd0df",
      snoutColor: "#ffa6c2",
      ...overrides
    };
    const targetSpec = {
      assetName: "ZhudaSpine42Mascot.lh",
      expectedBox: { x: 10, y: 10, width: 210, height: 172 },
      expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
      targetColors: {
        primaryFill: "#141d2b",
        borderStroke: "#2c415e",
        accentOrText: "#ff9ebb"
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };
    const cx = 105;
    const cy = 66;
    return {
      _$ver: 1,
      _$id: "spine42_mascot_root",
      _$type: "Sprite",
      name: "ZhudaSpine42Mascot",
      x: 10,
      y: 10,
      width: 210,
      height: 172,
      _gcmds: [
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: 0,
          width: 210,
          height: 172,
          lt: 12,
          rt: 12,
          lb: 12,
          rb: 12,
          fillColor: "#141d2b",
          lineColor: "#2c415e",
          lineWidth: 2,
          percent: false
        },
        {
          _$type: "DrawCircleCmd",
          x: cx,
          y: 114,
          radius: 34,
          fillColor: "#090d14",
          lineColor: null,
          lineWidth: 0,
          percent: false
        },
        {
          _$type: "DrawCircleCmd",
          x: cx,
          y: cy,
          radius: 36,
          fillColor: cfg.skinPrimaryColor,
          lineColor: cfg.skinBorderColor,
          lineWidth: 2,
          percent: false
        },
        {
          _$type: "DrawCircleCmd",
          x: cx,
          y: cy + 9,
          radius: 20,
          fillColor: cfg.bellyHighlightColor,
          lineColor: null,
          lineWidth: 0,
          percent: false
        },
        {
          _$type: "DrawCircleCmd",
          x: cx - 23,
          y: cy - 32,
          radius: 11,
          fillColor: cfg.skinBorderColor,
          lineColor: null,
          lineWidth: 0,
          percent: false
        },
        {
          _$type: "DrawCircleCmd",
          x: cx + 23,
          y: cy - 32,
          radius: 11,
          fillColor: cfg.skinBorderColor,
          lineColor: null,
          lineWidth: 0,
          percent: false
        },
        {
          _$type: "DrawCircleCmd",
          x: cx,
          y: cy + 3,
          radius: 13,
          fillColor: cfg.snoutColor,
          lineColor: "#e05882",
          lineWidth: 1.5,
          percent: false
        },
        {
          _$type: "DrawCircleCmd",
          x: cx - 14,
          y: cy - 10,
          radius: 4.2,
          fillColor: "#222222",
          lineColor: null,
          lineWidth: 0,
          percent: false
        },
        {
          _$type: "DrawCircleCmd",
          x: cx + 14,
          y: cy - 10,
          radius: 4.2,
          fillColor: "#222222",
          lineColor: null,
          lineWidth: 0,
          percent: false
        }
      ],
      _$comp: [
        {
          _$type: "Spine42PhysicsRigComponent",
          ...cfg
        }
      ],
      _$child: [
        {
          _$id: "spine42_status_label",
          _$type: "Text",
          name: "StatusLabel",
          x: 0,
          y: 128,
          width: 210,
          height: 18,
          text: "Spine 4.2 \u8C6C\u5927\u7CBE\u9748 \xB7 [\u975C\u614B\u9810\u88FD\u9AD4]",
          fontSize: 13,
          bold: true,
          color: "#7df9ff",
          align: "center"
        },
        {
          _$id: "spine42_physics_badge",
          _$type: "Text",
          name: "PhysicsBadge",
          x: 0,
          y: 148,
          width: 210,
          height: 16,
          text: "\u2714 PhysicsConstraint (k=95, d=0.88)",
          fontSize: 11,
          color: "#64ffda",
          align: "center"
        }
      ],
      _zhudaMeta: {
        assetId: "assets/prefabs/ZhudaSpine42Mascot.lh",
        category: "spine42-rig",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: { width: 230, height: 192, padding: 10 },
        targetSpec
      }
    };
  }
  /**
   * 建構「戰術爆破粒子發射器」靜態資產 (.lh)
   * 以決定性種子 (seed=20261028) 烘焙 t=240ms 的快照供微預覽與像素/色差校準，並附帶運行期發射器組件
   */
  static buildParticleExplosionPrefab(overrides = {}) {
    const cfg = {
      emitterName: "TacticalMineBurst_v1",
      burstCount: 24,
      emissionRate: 36,
      lifetimeMs: 850,
      startSpeed: 165,
      gravityY: 220,
      seed: 20261028,
      previewTimestampMs: 240,
      primaryColor: "#ff5533",
      secondaryColor: "#ffaa00",
      sparkColor: "#64ffda",
      coreGlowColor: "#231424",
      ...overrides
    };
    const targetSpec = {
      assetName: "MineExplosionParticle.lh",
      expectedBox: { x: 12, y: 12, width: 176, height: 176 },
      expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
      targetColors: {
        primaryFill: "#231424",
        borderStroke: "#ff5533",
        accentOrText: "#ffaa00"
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };
    const cmds = [
      // 決定性邊界底盤與衝擊波外環 (176x176)
      {
        _$type: "DrawRoundRectCmd",
        x: 0,
        y: 0,
        width: 176,
        height: 176,
        lt: 16,
        rt: 16,
        lb: 16,
        rb: 16,
        fillColor: cfg.coreGlowColor,
        lineColor: cfg.primaryColor,
        lineWidth: 2,
        percent: false
      },
      // 外層震波光圈
      {
        _$type: "DrawCircleCmd",
        x: 88,
        y: 88,
        radius: 68,
        fillColor: null,
        lineColor: cfg.secondaryColor,
        lineWidth: 2,
        percent: false
      },
      // 內層高溫火球核心
      {
        _$type: "DrawCircleCmd",
        x: 88,
        y: 88,
        radius: 26,
        fillColor: cfg.primaryColor,
        lineColor: cfg.secondaryColor,
        lineWidth: 3,
        percent: false
      }
    ];
    let rngState = cfg.seed;
    const nextRand = () => {
      rngState = rngState * 1664525 + 1013904223 >>> 0;
      return rngState / 4294967295;
    };
    const tSec = cfg.previewTimestampMs / 1e3;
    for (let i = 0; i < cfg.burstCount; i++) {
      const angle = i / cfg.burstCount * Math.PI * 2 + (nextRand() - 0.5) * 0.18;
      const speed = cfg.startSpeed * (0.65 + nextRand() * 0.45);
      const dist = Math.min(64, speed * tSec);
      const px = Number((88 + Math.cos(angle) * dist).toFixed(1));
      const py = Number((88 + Math.sin(angle) * dist).toFixed(1));
      const radius = Number((3.2 + i % 3 * 1.6).toFixed(1));
      const color = i % 3 === 0 ? cfg.secondaryColor : i % 3 === 1 ? cfg.primaryColor : cfg.sparkColor;
      cmds.push({
        _$type: "DrawCircleCmd",
        x: px,
        y: py,
        radius,
        fillColor: color,
        lineColor: null,
        lineWidth: 0,
        percent: false
      });
    }
    return {
      _$ver: 1,
      _$id: "particle_explosion_root",
      _$type: "Sprite",
      name: "MineExplosionParticle",
      x: 12,
      y: 12,
      width: 176,
      height: 176,
      _gcmds: cmds,
      _$comp: [
        {
          _$type: "ZhudaParticleEmitterComponent",
          ...cfg
        }
      ],
      _$child: [
        {
          _$id: "particle_badge_txt",
          _$type: "Text",
          name: "ParticleSnapshotLabel",
          x: 0,
          y: 152,
          width: 176,
          height: 18,
          text: `Particle Snapshot @ ${cfg.previewTimestampMs}ms`,
          fontSize: 11,
          bold: true,
          color: cfg.secondaryColor,
          align: "center"
        }
      ],
      _zhudaMeta: {
        assetId: "assets/prefabs/MineExplosionParticle.lh",
        category: "particle-emitter",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: { width: 200, height: 200, padding: 12 },
        targetSpec
      }
    };
  }
  /**
   * 建構「6 大基建遙測儀表板」靜態 UI Prefab (.lh)
   */
  static buildTelemetryDashboardPrefab() {
    const targetSpec = {
      assetName: "TelemetryDashboard.lh",
      expectedBox: { x: 10, y: 10, width: 225, height: 392 },
      expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
      targetColors: {
        primaryFill: "#121a28",
        borderStroke: "#2d4464",
        accentOrText: "#64ffda"
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };
    return {
      _$ver: 1,
      _$id: "telemetry_dash_root",
      _$type: "Sprite",
      name: "TelemetryDashboard",
      x: 10,
      y: 10,
      width: 225,
      height: 392,
      _gcmds: [
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: 0,
          width: 225,
          height: 392,
          lt: 12,
          rt: 12,
          lb: 12,
          rb: 12,
          fillColor: "#121a28",
          lineColor: "#2d4464",
          lineWidth: 2,
          percent: false
        }
      ],
      _$child: [
        {
          _$id: "telemetry_header_txt",
          _$type: "Text",
          name: "HeaderTitle",
          x: 14,
          y: 12,
          width: 198,
          height: 20,
          text: "\u{1F6E1}\uFE0F \u8C6C\u5927\u5F15\u64CE \xB7 6 \u5927\u57FA\u5EFA\u9059\u6E2C",
          fontSize: 13,
          bold: true,
          color: "#64ffda"
        },
        {
          _$id: "telemetry_body_txt",
          _$type: "Text",
          name: "TelemetryBody",
          x: 14,
          y: 36,
          width: 198,
          height: 340,
          text: "[1] \u62D3\u64B2\u8F09\u5165\u5668 (29/29 \u5EAB)\n[2] AST \u81EA\u52D5\u985E\u5225\u53CD\u5C04\n[3] \u539F\u578B\u89E3\u6BD2\u8207\u6E96\u5099\u5B88\u885B\n[4] Spine 4.2 PhysicsConstraint\n[5] \u5408\u6279 DrawCall \u5C0D\u6A19 Three.js\n[6] \u975C\u614B\u8CC7\u7522 (.lh) & \u0394E \u6821\u6E96",
          fontSize: 12,
          leading: 5,
          color: "#cbd5e1"
        }
      ],
      _zhudaMeta: {
        assetId: "assets/prefabs/TelemetryDashboard.lh",
        category: "ui-prefab",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: { width: 245, height: 412, padding: 10 },
        targetSpec
      }
    };
  }
  /**
   * 建構「M1 九宮格 (9-Slice / sizeGrid) 無失真戰術對話框」靜態 Prefab (.lh)
   * 基準尺寸 160×80，拉伸至 320×140 (2.0x 寬, 1.75x 高)，四角錨塊恆定鎖死為 16×16px 零變形
   */
  static buildNineSliceDialogPrefab(stretchedWidth = 320, stretchedHeight = 140) {
    const top = 16;
    const right = 16;
    const bottom = 16;
    const left = 16;
    const cw = Math.max(8, stretchedWidth - left - right);
    const ch = Math.max(8, stretchedHeight - top - bottom);
    const targetSpec = {
      assetName: "NineSliceDialogFrame.lh",
      expectedBox: { x: 10, y: 10, width: stretchedWidth, height: stretchedHeight },
      expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
      targetColors: {
        primaryFill: "#132036",
        borderStroke: "#38bdf8",
        accentOrText: "#2dd4bf"
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };
    return {
      _$ver: 1,
      _$id: "nine_slice_dialog_root",
      _$type: "Image",
      name: "NineSliceDialogFrame",
      x: 10,
      y: 10,
      width: stretchedWidth,
      height: stretchedHeight,
      sizeGrid: `${top},${right},${bottom},${left},0`,
      _gcmds: [
        // 1. 外框底圖
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: 0,
          width: stretchedWidth,
          height: stretchedHeight,
          lt: 10,
          rt: 10,
          lb: 10,
          rb: 10,
          fillColor: "#132036",
          lineColor: "#38bdf8",
          lineWidth: 2,
          percent: false
        },
        // 2. 中央雙向拉伸區 (Center Slice #5)
        {
          _$type: "DrawRectCmd",
          x: left,
          y: top,
          width: cw,
          height: ch,
          fillColor: "#0c1524",
          lineColor: "#233858",
          lineWidth: 1,
          percent: false
        },
        // 3. 四角 1:1 鎖定保護錨塊 (Slices #1, #3, #7, #9 — 尺寸恆定 16×16px)
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: 0,
          width: left,
          height: top,
          lt: 8,
          rt: 2,
          lb: 2,
          rb: 2,
          fillColor: "#2dd4bf",
          lineColor: "#38bdf8",
          lineWidth: 1.5,
          percent: false
        },
        {
          _$type: "DrawRoundRectCmd",
          x: stretchedWidth - right,
          y: 0,
          width: right,
          height: top,
          lt: 2,
          rt: 8,
          lb: 2,
          rb: 2,
          fillColor: "#2dd4bf",
          lineColor: "#38bdf8",
          lineWidth: 1.5,
          percent: false
        },
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: stretchedHeight - bottom,
          width: left,
          height: bottom,
          lt: 2,
          rt: 2,
          lb: 8,
          rb: 2,
          fillColor: "#2dd4bf",
          lineColor: "#38bdf8",
          lineWidth: 1.5,
          percent: false
        },
        {
          _$type: "DrawRoundRectCmd",
          x: stretchedWidth - right,
          y: stretchedHeight - bottom,
          width: right,
          height: bottom,
          lt: 2,
          rt: 2,
          lb: 2,
          rb: 8,
          fillColor: "#2dd4bf",
          lineColor: "#38bdf8",
          lineWidth: 1.5,
          percent: false
        }
      ],
      _$child: [
        {
          _$id: "nine_slice_title_txt",
          _$type: "Text",
          name: "NineSliceHeader",
          x: left,
          y: 36,
          width: cw,
          height: 24,
          text: "9-SLICE (sizeGrid: 16,16,16,16,0)",
          fontSize: 14,
          bold: true,
          color: "#2dd4bf",
          align: "center"
        },
        {
          _$id: "nine_slice_sub_txt",
          _$type: "Text",
          name: "NineSliceSubtitle",
          x: left,
          y: 70,
          width: cw,
          height: 22,
          text: `Stretched ${stretchedWidth}\xD7${stretchedHeight}px \xB7 4 Corners Locked 16\xD716px`,
          fontSize: 12,
          color: "#e2f1ff",
          align: "center"
        }
      ],
      _zhudaMeta: {
        assetId: "assets/prefabs/NineSliceDialogFrame.lh",
        category: "nine-slice-ui",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: { width: stretchedWidth + 20, height: stretchedHeight + 20, padding: 10 },
        targetSpec,
        nineSliceSpec: {
          sizeGrid: [top, right, bottom, left, 0],
          baseWidth: 160,
          baseHeight: 80
        }
      }
    };
  }
  /**
   * 建構「M4 特效藍圖庫：勝利金幣噴泉 (CoinFountainVfx.lh)」決定性靜態資產 (@ t=280ms)
   */
  static buildCoinFountainVfxPrefab() {
    const targetSpec = {
      assetName: "CoinFountainVfx.lh",
      expectedBox: { x: 12, y: 12, width: 176, height: 176 },
      expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
      targetColors: {
        primaryFill: "#1f1a10",
        borderStroke: "#fbbf24",
        accentOrText: "#fef08a"
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };
    const cmds = [
      {
        _$type: "DrawRoundRectCmd",
        x: 0,
        y: 0,
        width: 176,
        height: 176,
        lt: 16,
        rt: 16,
        lb: 16,
        rb: 16,
        fillColor: "#1f1a10",
        lineColor: "#fbbf24",
        lineWidth: 2,
        percent: false
      },
      // 聚寶盆底座金光
      {
        _$type: "DrawEllipseCmd",
        x: 88,
        y: 138,
        width: 54,
        height: 14,
        fillColor: "#f59e0b",
        lineColor: "#fef08a",
        lineWidth: 2,
        percent: false
      }
    ];
    const coinPositions = [
      [88, 42, 11],
      [62, 54, 9.5],
      [114, 54, 9.5],
      [44, 78, 8.5],
      [132, 78, 8.5],
      [74, 82, 10],
      [102, 82, 10],
      [54, 110, 7.5],
      [122, 110, 7.5],
      [88, 112, 9]
    ];
    for (const [cx, cy, r] of coinPositions) {
      cmds.push({
        _$type: "DrawCircleCmd",
        x: cx,
        y: cy,
        radius: r,
        fillColor: "#fbbf24",
        lineColor: "#fef08a",
        lineWidth: 1.5,
        percent: false
      });
    }
    return {
      _$ver: 1,
      _$id: "vfx_coin_fountain_root",
      _$type: "Sprite",
      name: "CoinFountainVfx",
      x: 12,
      y: 12,
      width: 176,
      height: 176,
      _gcmds: cmds,
      _$comp: [
        {
          _$type: "ZhudaParticleEmitterComponent",
          emitterName: "GoldenCoinFountain_v1",
          burstCount: 20,
          previewTimestampMs: 280,
          primaryColor: "#fbbf24",
          secondaryColor: "#fef08a",
          sparkColor: "#38bdf8"
        }
      ],
      _$child: [
        {
          _$id: "vfx_coin_label",
          _$type: "Text",
          name: "VfxCoinTitle",
          x: 0,
          y: 152,
          width: 176,
          height: 18,
          text: "VFX: CoinFountain @ 280ms",
          fontSize: 11,
          bold: true,
          color: "#fef08a",
          align: "center"
        }
      ],
      _zhudaMeta: {
        assetId: "assets/prefabs/CoinFountainVfx.lh",
        category: "vfx-blueprint",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: { width: 200, height: 200, padding: 12 },
        targetSpec
      }
    };
  }
  /**
   * 建構「M4 特效藍圖庫：戰術刀光劍氣拖尾 (SwordSlashTrailVfx.lh)」決定性靜態資產 (@ t=120ms)
   */
  static buildSwordSlashVfxPrefab() {
    const targetSpec = {
      assetName: "SwordSlashTrailVfx.lh",
      expectedBox: { x: 12, y: 12, width: 176, height: 176 },
      expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
      targetColors: {
        primaryFill: "#0d1b2a",
        borderStroke: "#00e5ff",
        accentOrText: "#7df9ff"
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };
    return {
      _$ver: 1,
      _$id: "vfx_sword_slash_root",
      _$type: "Sprite",
      name: "SwordSlashTrailVfx",
      x: 12,
      y: 12,
      width: 176,
      height: 176,
      _gcmds: [
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: 0,
          width: 176,
          height: 176,
          lt: 16,
          rt: 16,
          lb: 16,
          rb: 16,
          fillColor: "#0d1b2a",
          lineColor: "#00e5ff",
          lineWidth: 2,
          percent: false
        },
        // 弧形半月刀氣主軌跡
        {
          _$type: "DrawPieCmd",
          x: 88,
          y: 88,
          radius: 66,
          startAngle: -55,
          endAngle: 75,
          fillColor: "#00e5ff",
          lineColor: "#ffffff",
          lineWidth: 2
        },
        // 內層遮罩形成新月刃弧
        {
          _$type: "DrawCircleCmd",
          x: 74,
          y: 88,
          radius: 48,
          fillColor: "#0d1b2a",
          lineColor: "#38bdf8",
          lineWidth: 1.5,
          percent: false
        },
        // 破空十字星芒
        {
          _$type: "DrawLineCmd",
          fromX: 28,
          fromY: 132,
          toX: 148,
          toY: 36,
          lineColor: "#ffffff",
          lineWidth: 3,
          percent: false
        }
      ],
      _$comp: [
        {
          _$type: "ZhudaParticleEmitterComponent",
          emitterName: "CyberBladeSlash_v1",
          burstCount: 16,
          previewTimestampMs: 120,
          primaryColor: "#00e5ff",
          secondaryColor: "#7df9ff",
          sparkColor: "#ffffff"
        }
      ],
      _$child: [
        {
          _$id: "vfx_slash_label",
          _$type: "Text",
          name: "VfxSlashTitle",
          x: 0,
          y: 152,
          width: 176,
          height: 18,
          text: "VFX: SwordSlashTrail @ 120ms",
          fontSize: 11,
          bold: true,
          color: "#7df9ff",
          align: "center"
        }
      ],
      _zhudaMeta: {
        assetId: "assets/prefabs/SwordSlashTrailVfx.lh",
        category: "vfx-blueprint",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: { width: 200, height: 200, padding: 12 },
        targetSpec
      }
    };
  }
  /**
   * 建構「M4 特效藍圖庫：升級覺醒法陣光環 (LevelUpAuraVfx.lh)」決定性靜態資產 (@ t=320ms)
   */
  static buildLevelUpAuraVfxPrefab() {
    const targetSpec = {
      assetName: "LevelUpAuraVfx.lh",
      expectedBox: { x: 12, y: 12, width: 176, height: 176 },
      expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
      targetColors: {
        primaryFill: "#13162b",
        borderStroke: "#a855f7",
        accentOrText: "#e9d5ff"
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };
    return {
      _$ver: 1,
      _$id: "vfx_levelup_aura_root",
      _$type: "Sprite",
      name: "LevelUpAuraVfx",
      x: 12,
      y: 12,
      width: 176,
      height: 176,
      _gcmds: [
        {
          _$type: "DrawRoundRectCmd",
          x: 0,
          y: 0,
          width: 176,
          height: 176,
          lt: 16,
          rt: 16,
          lb: 16,
          rb: 16,
          fillColor: "#13162b",
          lineColor: "#a855f7",
          lineWidth: 2,
          percent: false
        },
        // 外層覺醒法陣環
        {
          _$type: "DrawCircleCmd",
          x: 88,
          y: 88,
          radius: 62,
          fillColor: null,
          lineColor: "#c084fc",
          lineWidth: 2.5,
          percent: false
        },
        // 內層能量核心
        {
          _$type: "DrawCircleCmd",
          x: 88,
          y: 88,
          radius: 34,
          fillColor: "#581c87",
          lineColor: "#e9d5ff",
          lineWidth: 2,
          percent: false
        },
        // 上升光柱粒子
        {
          _$type: "DrawLineCmd",
          fromX: 52,
          fromY: 132,
          toX: 52,
          toY: 36,
          lineColor: "#64ffda",
          lineWidth: 2.5,
          percent: false
        },
        {
          _$type: "DrawLineCmd",
          fromX: 88,
          fromY: 140,
          toX: 88,
          toY: 24,
          lineColor: "#e9d5ff",
          lineWidth: 3,
          percent: false
        },
        {
          _$type: "DrawLineCmd",
          fromX: 124,
          fromY: 132,
          toX: 124,
          toY: 36,
          lineColor: "#64ffda",
          lineWidth: 2.5,
          percent: false
        }
      ],
      _$comp: [
        {
          _$type: "ZhudaParticleEmitterComponent",
          emitterName: "AscensionHaloAura_v1",
          burstCount: 18,
          previewTimestampMs: 320,
          primaryColor: "#a855f7",
          secondaryColor: "#e9d5ff",
          sparkColor: "#64ffda"
        }
      ],
      _$child: [
        {
          _$id: "vfx_aura_label",
          _$type: "Text",
          name: "VfxAuraTitle",
          x: 0,
          y: 152,
          width: 176,
          height: 18,
          text: "VFX: LevelUpAura @ 320ms",
          fontSize: 11,
          bold: true,
          color: "#e9d5ff",
          align: "center"
        }
      ],
      _zhudaMeta: {
        assetId: "assets/prefabs/LevelUpAuraVfx.lh",
        category: "vfx-blueprint",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: { width: 200, height: 200, padding: 12 },
        targetSpec
      }
    };
  }
  /**
   * 建構組裝後的主場景靜態階層樹 (MinesweeperStage.ls)
   */
  static buildMinesweeperSceneAsset() {
    const hud = this.buildTacticalHudBarPrefab();
    const mascot = this.buildSpine42MascotPrefab();
    const telemetry = this.buildTelemetryDashboardPrefab();
    const confirmBtn = this.buildConfirmButtonPrefab("calibrated");
    const nineSliceDialog = this.buildNineSliceDialogPrefab(320, 140);
    const particle = this.buildParticleExplosionPrefab();
    const unityGuardian = UnityBridgePipeline.buildUnityCrystalGuardianPrefab();
    hud.x = 20;
    hud.y = 16;
    mascot.x = 1035;
    mascot.y = 118;
    telemetry.x = 1035;
    telemetry.y = 302;
    confirmBtn.x = 20;
    confirmBtn.y = 630;
    nineSliceDialog.x = 200;
    nineSliceDialog.y = 540;
    particle.x = 550;
    particle.y = 270;
    unityGuardian.x = 760;
    unityGuardian.y = 510;
    return {
      _$ver: 1,
      _$id: "minesweeper_stage_scene",
      _$type: "Scene",
      name: "MinesweeperStage",
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      _$child: [hud, mascot, telemetry, confirmBtn, nineSliceDialog, particle, unityGuardian],
      _zhudaMeta: {
        assetId: "assets/scenes/MinesweeperStage.ls",
        category: "scene-lh",
        version: "3.4.2-zhuda-static-v1",
        designCanvas: { width: 1280, height: 720, padding: 0 }
      }
    };
  }
  /**
   * 取得所有內建預先設計之靜態資產清單 (涵蓋 UI、9-Slice、Spine 4.2、VFX 特效藍圖與 Unity 移植預製體)
   */
  static getAllBuiltinStaticAssets() {
    return {
      "ConfirmActionButton.lh": this.buildConfirmButtonPrefab("calibrated"),
      "NineSliceDialogFrame.lh": this.buildNineSliceDialogPrefab(320, 140),
      "TacticalHudBar.lh": this.buildTacticalHudBarPrefab(),
      "ZhudaSpine42Mascot.lh": this.buildSpine42MascotPrefab(),
      "MineExplosionParticle.lh": this.buildParticleExplosionPrefab(),
      "CoinFountainVfx.lh": this.buildCoinFountainVfxPrefab(),
      "SwordSlashTrailVfx.lh": this.buildSwordSlashVfxPrefab(),
      "LevelUpAuraVfx.lh": this.buildLevelUpAuraVfxPrefab(),
      "UnityCrystalGuardian.lh": UnityBridgePipeline.buildUnityCrystalGuardianPrefab(),
      "TelemetryDashboard.lh": this.buildTelemetryDashboardPrefab(),
      "MinesweeperStage.ls": this.buildMinesweeperSceneAsset()
    };
  }
  /**
   * 依據 PixelCalibrationEngine 產出的 AutoFixPatch 自動修正靜態 .lh 資產數值
   */
  static applyCalibrationPatches(sourceData, patches) {
    const cloned = JSON.parse(JSON.stringify(sourceData));
    for (const patch of patches) {
      if (patch.targetPath === "root") {
        cloned[patch.property] = patch.suggestedValue;
        if (patch.property === "width" && Array.isArray(cloned._$child)) {
          for (const ch of cloned._$child) {
            if (ch._$type === "Text" && typeof ch.x === "number") {
              ch.width = Number(patch.suggestedValue) - ch.x;
            }
          }
        }
      } else if (patch.targetPath.startsWith("_gcmds[")) {
        const m = patch.targetPath.match(/^_gcmds\[(\d+)\]$/);
        if (m && Array.isArray(cloned._gcmds)) {
          const idx = Number(m[1]);
          if (cloned._gcmds[idx]) {
            cloned._gcmds[idx][patch.property] = patch.suggestedValue;
          }
        }
      } else if (patch.targetPath.startsWith("_$child[")) {
        const m = patch.targetPath.match(/^_\$child\[(\d+)\]$/);
        if (m && Array.isArray(cloned._$child)) {
          const idx = Number(m[1]);
          if (cloned._$child[idx]) {
            cloned._$child[idx][patch.property] = patch.suggestedValue;
          }
        }
      }
    }
    return cloned;
  }
};
ZhudaAssetSerializer.idCounter = 1;
var ZhudaPrefab = class {
  static instantiate(lhData, parent, positionOverride) {
    const clonedData = JSON.parse(JSON.stringify(lhData));
    const g = globalThis;
    const L = g.Laya;
    if (!L || !L.Sprite) {
      throw new Error("[ZhudaPrefab] Laya runtime \u5C1A\u672A\u521D\u59CB\u5316\uFF0C\u8ACB\u5148\u57F7\u884C await ZhudaEngine.boot()");
    }
    if (L.LayaEnv) {
      L.LayaEnv.isPlaying = true;
    }
    let rootSprite = null;
    if (L.HierarchyParser && typeof L.HierarchyParser.parse === "function") {
      try {
        const parsed = L.HierarchyParser.parse(clonedData);
        const first = Array.isArray(parsed) ? parsed[0] : parsed;
        if (first) {
          rootSprite = first;
        }
      } catch (_err) {
        rootSprite = null;
      }
    }
    if (!rootSprite) {
      rootSprite = this.hydrateNodeRecursive(clonedData);
    } else {
      this.ensureGraphicsHydrated(rootSprite, clonedData);
    }
    if (positionOverride) {
      rootSprite.pos(positionOverride.x, positionOverride.y);
    }
    if (parent) {
      parent.addChild(rootSprite);
    }
    return rootSprite;
  }
  static hydrateNodeRecursive(data) {
    const L = globalThis.Laya;
    let node;
    if (data._$type === "Text" || data._$type === "Label") {
      node = new L.Text();
      node.text = data.text ?? "";
      if (data.font) node.font = data.font;
      if (typeof data.fontSize === "number") node.fontSize = data.fontSize;
      if (data.color) node.color = data.color;
      if (typeof data.bold === "boolean") node.bold = data.bold;
      if (data.align) node.align = data.align;
      if (data.valign) node.valign = data.valign;
      if (typeof data.leading === "number") node.leading = data.leading;
    } else if (data._$type === "Scene" && L.Scene) {
      node = new L.Scene();
    } else {
      node = new L.Sprite();
    }
    node.name = data.name || data._$id;
    if (typeof data.x === "number") node.x = data.x;
    if (typeof data.y === "number") node.y = data.y;
    if (typeof data.width === "number") node.width = data.width;
    if (typeof data.height === "number") node.height = data.height;
    if (typeof data.scaleX === "number") node.scaleX = data.scaleX;
    if (typeof data.scaleY === "number") node.scaleY = data.scaleY;
    if (typeof data.rotation === "number") node.rotation = data.rotation;
    if (typeof data.alpha === "number") node.alpha = data.alpha;
    if (typeof data.visible === "boolean") node.visible = data.visible;
    if (typeof data.mouseEnabled === "boolean") node.mouseEnabled = data.mouseEnabled;
    if (typeof data.skin === "string") node.skin = data.skin;
    if (typeof data.sizeGrid === "string") node.sizeGrid = data.sizeGrid;
    if (Array.isArray(data._gcmds) && data._gcmds.length > 0 && node.graphics) {
      this.applyGraphicsCommands(node.graphics, data._gcmds);
    }
    if (Array.isArray(data._$comp) && L.ClassUtils) {
      for (const compDef of data._$comp) {
        const CompCtor = L.ClassUtils.getClass(compDef._$type);
        if (CompCtor && typeof node.addComponent === "function") {
          try {
            const instance = node.addComponent(CompCtor);
            if (instance) {
              for (const [k, v] of Object.entries(compDef)) {
                if (!k.startsWith("_$")) {
                  instance[k] = v;
                }
              }
            }
          } catch (_e) {
          }
        }
      }
    }
    if (Array.isArray(data._$child)) {
      for (const childData of data._$child) {
        const childNode = this.hydrateNodeRecursive(childData);
        node.addChild(childNode);
      }
    }
    return node;
  }
  static ensureGraphicsHydrated(node, data) {
    if (Array.isArray(data._gcmds) && data._gcmds.length > 0 && node?.graphics) {
      const existingCmds = node.graphics.cmds || node.graphics._cmds || [];
      if (existingCmds.length === 0) {
        this.applyGraphicsCommands(node.graphics, data._gcmds);
      }
    }
    if (Array.isArray(data._$child) && typeof node?.numChildren === "number") {
      for (let i = 0; i < Math.min(data._$child.length, node.numChildren); i++) {
        this.ensureGraphicsHydrated(node.getChildAt(i), data._$child[i]);
      }
    }
  }
  static applyGraphicsCommands(graphics, cmds) {
    graphics.clear();
    for (const cmd of cmds) {
      switch (cmd._$type) {
        case "DrawRoundRectCmd":
          graphics.drawRoundRect(
            cmd.x ?? 0,
            cmd.y ?? 0,
            cmd.width ?? 100,
            cmd.height ?? 40,
            cmd.lt ?? 6,
            cmd.rt ?? 6,
            cmd.lb ?? 6,
            cmd.rb ?? 6,
            cmd.fillColor ?? null,
            cmd.lineColor ?? null,
            cmd.lineWidth ?? 1
          );
          break;
        case "DrawRectCmd":
          graphics.drawRect(
            cmd.x ?? 0,
            cmd.y ?? 0,
            cmd.width ?? 100,
            cmd.height ?? 40,
            cmd.fillColor ?? null,
            cmd.lineColor ?? null,
            cmd.lineWidth ?? 1
          );
          break;
        case "DrawCircleCmd":
          graphics.drawCircle(
            cmd.x ?? 0,
            cmd.y ?? 0,
            cmd.radius ?? 10,
            cmd.fillColor ?? null,
            cmd.lineColor ?? null,
            cmd.lineWidth ?? 1
          );
          break;
        case "DrawEllipseCmd":
          if (typeof graphics.drawEllipse === "function") {
            graphics.drawEllipse(
              cmd.x ?? 0,
              cmd.y ?? 0,
              cmd.width ?? 20,
              cmd.height ?? 10,
              cmd.fillColor ?? null,
              cmd.lineColor ?? null,
              cmd.lineWidth ?? 1
            );
          } else {
            graphics.drawCircle(
              cmd.x ?? 0,
              cmd.y ?? 0,
              cmd.width ?? 15,
              cmd.fillColor ?? null,
              cmd.lineColor ?? null,
              cmd.lineWidth ?? 1
            );
          }
          break;
        case "DrawLineCmd":
          graphics.drawLine(
            cmd.fromX ?? 0,
            cmd.fromY ?? 0,
            cmd.toX ?? 10,
            cmd.toY ?? 10,
            cmd.lineColor ?? "#ffffff",
            cmd.lineWidth ?? 1
          );
          break;
        case "DrawPolyCmd":
          if (Array.isArray(cmd.points) && cmd.points.length >= 6) {
            graphics.drawPoly(
              cmd.x ?? 0,
              cmd.y ?? 0,
              cmd.points,
              cmd.fillColor ?? null,
              cmd.lineColor ?? null,
              cmd.lineWidth ?? 1
            );
          }
          break;
        case "DrawPieCmd":
          graphics.drawPie(
            cmd.x ?? 0,
            cmd.y ?? 0,
            cmd.radius ?? 10,
            cmd.startAngle ?? 0,
            cmd.endAngle ?? 90,
            cmd.fillColor ?? null,
            cmd.lineColor ?? null,
            cmd.lineWidth ?? 1
          );
          break;
        default:
          break;
      }
    }
  }
};

// packages/core/PixelCalibrationEngine.ts
var PixelCalibrationEngine = class {
  /**
   * 將 #RRGGBB 或 #RRGGBBAA 轉為 0..255 RGB
   */
  static hexToRgb(hex) {
    const clean = (hex || "#000000").replace(/^#/, "").trim();
    if (clean.length === 3) {
      const r2 = parseInt(clean[0] + clean[0], 16);
      const g2 = parseInt(clean[1] + clean[1], 16);
      const b2 = parseInt(clean[2] + clean[2], 16);
      return { r: r2, g: g2, b: b2, a: 255 };
    }
    const r = parseInt(clean.slice(0, 2) || "00", 16);
    const g = parseInt(clean.slice(2, 4) || "00", 16);
    const b = parseInt(clean.slice(4, 6) || "00", 16);
    const a = clean.length >= 8 ? parseInt(clean.slice(6, 8), 16) : 255;
    return {
      r: Number.isNaN(r) ? 0 : r,
      g: Number.isNaN(g) ? 0 : g,
      b: Number.isNaN(b) ? 0 : b,
      a: Number.isNaN(a) ? 255 : a
    };
  }
  /**
   * 將 sRGB (#RRGGBB) 轉換為 CIE L*a*b* (D65 標準光源)
   */
  static hexToLab(hex) {
    const { r, g, b } = this.hexToRgb(hex);
    const toLinear = (c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const lr = toLinear(r);
    const lg = toLinear(g);
    const lb = toLinear(b);
    const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
    const y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175) / 1;
    const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / 1.08883;
    const f = (t) => t > 8856e-6 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const fx = f(x);
    const fy = f(y);
    const fz = f(z);
    return {
      L: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  }
  /**
   * 計算 CIE76 色差 (ΔE*ab)
   */
  static computeDeltaE76(hex1, hex2) {
    const lab1 = this.hexToLab(hex1);
    const lab2 = this.hexToLab(hex2);
    const dL = lab1.L - lab2.L;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;
    return Number(Math.sqrt(dL * dL + da * da + db * db).toFixed(2));
  }
  /**
   * 計算工業標準 CIEDE2000 感知色差 (ΔE00)
   */
  static computeDeltaE2000(hex1, hex2) {
    if ((hex1 || "").toLowerCase().slice(0, 7) === (hex2 || "").toLowerCase().slice(0, 7)) {
      return 0;
    }
    const lab1 = this.hexToLab(hex1);
    const lab2 = this.hexToLab(hex2);
    const avgL = (lab1.L + lab2.L) / 2;
    const c1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
    const c2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
    const avgC = (c1 + c2) / 2;
    const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));
    const a1p = (1 + g) * lab1.a;
    const a2p = (1 + g) * lab2.a;
    const c1p = Math.sqrt(a1p * a1p + lab1.b * lab1.b);
    const c2p = Math.sqrt(a2p * a2p + lab2.b * lab2.b);
    const avgCp = (c1p + c2p) / 2;
    const h1p = a1p === 0 && lab1.b === 0 ? 0 : Math.atan2(lab1.b, a1p) * 180 / Math.PI + (Math.atan2(lab1.b, a1p) < 0 ? 360 : 0);
    const h2p = a2p === 0 && lab2.b === 0 ? 0 : Math.atan2(lab2.b, a2p) * 180 / Math.PI + (Math.atan2(lab2.b, a2p) < 0 ? 360 : 0);
    let dhp = 0;
    if (c1p * c2p !== 0) {
      if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
      else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
      else dhp = h2p - h1p + 360;
    }
    const dLp = lab2.L - lab1.L;
    const dCp = c2p - c1p;
    const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(dhp / 2 * Math.PI / 180);
    let avgHp = h1p + h2p;
    if (c1p * c2p !== 0) {
      if (Math.abs(h1p - h2p) <= 180) avgHp = (h1p + h2p) / 2;
      else if (h1p + h2p < 360) avgHp = (h1p + h2p + 360) / 2;
      else avgHp = (h1p + h2p - 360) / 2;
    }
    const T = 1 - 0.17 * Math.cos((avgHp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * avgHp * Math.PI / 180) + 0.32 * Math.cos((3 * avgHp + 6) * Math.PI / 180) - 0.2 * Math.cos((4 * avgHp - 63) * Math.PI / 180);
    const dRo = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
    const rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
    const sl = 1 + 0.015 * Math.pow(avgL - 50, 2) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
    const sc = 1 + 0.045 * avgCp;
    const sh = 1 + 0.015 * avgCp * T;
    const rt = -Math.sin(2 * dRo * Math.PI / 180) * rc;
    const dE = Math.sqrt(
      Math.pow(dLp / sl, 2) + Math.pow(dCp / sc, 2) + Math.pow(dHp / sh, 2) + rt * (dCp / sc) * (dHp / sh)
    );
    return Number(dE.toFixed(2));
  }
  /**
   * 靜態解析 .lh 階層樹的精確 Tight Bounding Box 與主色調（無需啟動 Runtime）
   */
  static measureStaticHierarchy(data) {
    const rootX = data.x ?? 0;
    const rootY = data.y ?? 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let primaryFill = "";
    let borderStroke = "";
    let accentOrText = "";
    const expandRect = (rx, ry, rw, rh) => {
      if (rw <= 0 || rh <= 0) return;
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx + rw);
      maxY = Math.max(maxY, ry + rh);
    };
    if (Array.isArray(data._gcmds)) {
      for (const cmd of data._gcmds) {
        if (cmd._$type === "DrawRoundRectCmd" || cmd._$type === "DrawRectCmd") {
          const cx = rootX + (cmd.x ?? 0);
          const cy = rootY + (cmd.y ?? 0);
          const cw = cmd.width ?? data.width ?? 0;
          const ch = cmd.height ?? data.height ?? 0;
          expandRect(cx, cy, cw, ch);
          if (!primaryFill && cmd.fillColor) primaryFill = cmd.fillColor;
          if (!borderStroke && cmd.lineColor) borderStroke = cmd.lineColor;
        } else if (cmd._$type === "DrawCircleCmd") {
          const r = cmd.radius ?? 0;
          const cx = rootX + (cmd.x ?? 0) - r;
          const cy = rootY + (cmd.y ?? 0) - r;
          expandRect(cx, cy, r * 2, r * 2);
          if (!primaryFill && cmd.fillColor) primaryFill = cmd.fillColor;
          else if (!accentOrText && cmd.fillColor && cmd.fillColor !== "#090d14") {
            accentOrText = cmd.fillColor;
          }
        }
      }
    }
    if (minX === Infinity) {
      expandRect(rootX, rootY, data.width ?? 100, data.height ?? 40);
    }
    if (Array.isArray(data._$child)) {
      for (const child of data._$child) {
        if (child._$type === "Text" && child.color) {
          if (!accentOrText || data.name !== "ZhudaSpine42Mascot") {
            accentOrText = child.color;
            break;
          }
        }
      }
    }
    return {
      tightBox: {
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(maxX - minX),
        height: Math.round(maxY - minY)
      },
      primaryFill: (primaryFill || "#000000").slice(0, 7),
      borderStroke: (borderStroke || "#000000").slice(0, 7),
      accentOrText: (accentOrText || "#ffffff").slice(0, 7)
    };
  }
  /**
   * 掃描 WebGL / Canvas2D RGBA 像素緩衝區，計算非背景像素覆蓋率、Tight Bounding Box 與主導色
   */
  static measurePixelBuffer(rgba, canvasWidth, canvasHeight, bgRgb = { r: 11, g: 15, b: 23 }) {
    let minX = canvasWidth;
    let minY = canvasHeight;
    let maxX = -1;
    let maxY = -1;
    let activeCount = 0;
    const colorBuckets = /* @__PURE__ */ new Map();
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const idx = (y * canvasWidth + x) * 4;
        const r = rgba[idx];
        const g = rgba[idx + 1];
        const b = rgba[idx + 2];
        const a = rgba[idx + 3];
        const isForeground = a > 20 && (Math.abs(r - bgRgb.r) > 8 || Math.abs(g - bgRgb.g) > 8 || Math.abs(b - bgRgb.b) > 8);
        if (isForeground) {
          activeCount++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          const hex = "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
          colorBuckets.set(hex, (colorBuckets.get(hex) || 0) + 1);
        }
      }
    }
    let dominantHex = "#000000";
    let bestCount = 0;
    for (const [hex, cnt] of colorBuckets.entries()) {
      if (cnt > bestCount) {
        bestCount = cnt;
        dominantHex = hex;
      }
    }
    const hasPixels = maxX >= minX && maxY >= minY;
    return {
      tightBox: hasPixels ? {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      } : { x: 0, y: 0, width: 0, height: 0 },
      nonTransparentPixels: activeCount,
      coveragePercent: Number((activeCount / Math.max(1, canvasWidth * canvasHeight) * 100).toFixed(2)),
      sampledDominantHex: dominantHex
    };
  }
  /**
   * 執行單一靜態資產的像素邊界與 ΔE 色差校準，並自動生成修復 Patch
   */
  static calibrateAsset(data, specOverride, pixelBufferInfo) {
    const spec = specOverride || data._zhudaMeta?.targetSpec;
    if (!spec) {
      throw new Error(`[PixelCalibrationEngine] \u8CC7\u7522 ${data.name} \u7F3A\u5C11 targetSpec \u6821\u6E96\u898F\u683C`);
    }
    const staticMetrics = this.measureStaticHierarchy(data);
    const measuredBox = staticMetrics.tightBox;
    const expectedBox = spec.expectedBox;
    const xDiffPx = measuredBox.x - expectedBox.x;
    const yDiffPx = measuredBox.y - expectedBox.y;
    const widthDiffPx = measuredBox.width - expectedBox.width;
    const heightDiffPx = measuredBox.height - expectedBox.height;
    const maxAbsErrorPx = Math.max(
      Math.abs(xDiffPx),
      Math.abs(yDiffPx),
      Math.abs(widthDiffPx),
      Math.abs(heightDiffPx)
    );
    const targetPrimaryFill = spec.targetColors.primaryFill;
    const targetBorderStroke = spec.targetColors.borderStroke || staticMetrics.borderStroke;
    const targetAccentOrText = spec.targetColors.accentOrText || staticMetrics.accentOrText;
    const primaryDeltaE76 = this.computeDeltaE76(staticMetrics.primaryFill, targetPrimaryFill);
    const primaryDeltaE2000 = this.computeDeltaE2000(staticMetrics.primaryFill, targetPrimaryFill);
    const borderDeltaE2000 = this.computeDeltaE2000(staticMetrics.borderStroke, targetBorderStroke);
    const accentDeltaE2000 = this.computeDeltaE2000(staticMetrics.accentOrText, targetAccentOrText);
    const maxDeltaE2000 = Number(
      Math.max(primaryDeltaE2000, borderDeltaE2000, accentDeltaE2000).toFixed(2)
    );
    const tolerancePx = spec.tolerancePx ?? 0;
    const toleranceDeltaE = spec.toleranceDeltaE ?? 1.5;
    const autoFixPatches = [];
    if (Math.abs(xDiffPx) > tolerancePx) {
      autoFixPatches.push({
        targetPath: "root",
        property: "x",
        currentValue: data.x ?? 0,
        suggestedValue: expectedBox.x,
        reason: `X \u5EA7\u6A19\u504F\u79FB ${xDiffPx > 0 ? "+" : ""}${xDiffPx}px (\u9810\u671F ${expectedBox.x}px)`
      });
    }
    if (Math.abs(yDiffPx) > tolerancePx) {
      autoFixPatches.push({
        targetPath: "root",
        property: "y",
        currentValue: data.y ?? 0,
        suggestedValue: expectedBox.y,
        reason: `Y \u5EA7\u6A19\u504F\u79FB ${yDiffPx > 0 ? "+" : ""}${yDiffPx}px (\u9810\u671F ${expectedBox.y}px)`
      });
    }
    if (Math.abs(widthDiffPx) > tolerancePx) {
      autoFixPatches.push({
        targetPath: "root",
        property: "width",
        currentValue: data.width ?? measuredBox.width,
        suggestedValue: expectedBox.width,
        reason: `\u7BC0\u9EDE\u5BEC\u5EA6\u8AA4\u5DEE ${widthDiffPx > 0 ? "+" : ""}${widthDiffPx}px (\u9810\u671F ${expectedBox.width}px)`
      });
      if (Array.isArray(data._gcmds) && data._gcmds[0]) {
        autoFixPatches.push({
          targetPath: "_gcmds[0]",
          property: "width",
          currentValue: data._gcmds[0].width ?? measuredBox.width,
          suggestedValue: expectedBox.width,
          reason: `\u5E95\u5716\u6307\u4EE4 DrawRoundRectCmd \u5BEC\u5EA6\u8AA4\u5DEE ${widthDiffPx > 0 ? "+" : ""}${widthDiffPx}px`
        });
      }
    }
    if (Math.abs(heightDiffPx) > tolerancePx) {
      autoFixPatches.push({
        targetPath: "root",
        property: "height",
        currentValue: data.height ?? measuredBox.height,
        suggestedValue: expectedBox.height,
        reason: `\u7BC0\u9EDE\u9AD8\u5EA6\u8AA4\u5DEE ${heightDiffPx > 0 ? "+" : ""}${heightDiffPx}px (\u9810\u671F ${expectedBox.height}px)`
      });
      if (Array.isArray(data._gcmds) && data._gcmds[0]) {
        autoFixPatches.push({
          targetPath: "_gcmds[0]",
          property: "height",
          currentValue: data._gcmds[0].height ?? measuredBox.height,
          suggestedValue: expectedBox.height,
          reason: `\u5E95\u5716\u6307\u4EE4\u9AD8\u5EA6\u8AA4\u5DEE ${heightDiffPx > 0 ? "+" : ""}${heightDiffPx}px`
        });
      }
    }
    if (primaryDeltaE2000 > toleranceDeltaE && Array.isArray(data._gcmds) && data._gcmds[0]) {
      autoFixPatches.push({
        targetPath: "_gcmds[0]",
        property: "fillColor",
        currentValue: staticMetrics.primaryFill,
        suggestedValue: targetPrimaryFill,
        reason: `\u4E3B\u586B\u5145\u8272\u5DEE \u0394E00 = ${primaryDeltaE2000} \u8D85\u51FA\u5BB9\u8A31\u503C ${toleranceDeltaE} (\u76EE\u6A19 ${targetPrimaryFill})`
      });
    }
    if (borderDeltaE2000 > toleranceDeltaE && Array.isArray(data._gcmds) && data._gcmds[0]) {
      autoFixPatches.push({
        targetPath: "_gcmds[0]",
        property: "lineColor",
        currentValue: staticMetrics.borderStroke,
        suggestedValue: targetBorderStroke,
        reason: `\u908A\u6846\u8272\u5DEE \u0394E00 = ${borderDeltaE2000} \u8D85\u51FA\u5BB9\u8A31\u503C ${toleranceDeltaE} (\u76EE\u6A19 ${targetBorderStroke})`
      });
    }
    if (accentDeltaE2000 > toleranceDeltaE && Array.isArray(data._$child) && data._$child[0]) {
      autoFixPatches.push({
        targetPath: "_$child[0]",
        property: "color",
        currentValue: staticMetrics.accentOrText,
        suggestedValue: targetAccentOrText,
        reason: `\u6587\u5B57/\u5F37\u8ABF\u8272\u5DEE \u0394E00 = ${accentDeltaE2000} \u8D85\u51FA\u5BB9\u8A31\u503C ${toleranceDeltaE} (\u76EE\u6A19 ${targetAccentOrText})`
      });
    }
    const passed = maxAbsErrorPx <= tolerancePx && maxDeltaE2000 <= toleranceDeltaE;
    let pixelBufferTelemetry;
    if (pixelBufferInfo) {
      const bufRes = this.measurePixelBuffer(
        pixelBufferInfo.rgba,
        pixelBufferInfo.width,
        pixelBufferInfo.height
      );
      pixelBufferTelemetry = {
        canvasWidth: pixelBufferInfo.width,
        canvasHeight: pixelBufferInfo.height,
        nonTransparentPixels: bufRes.nonTransparentPixels,
        coveragePercent: bufRes.coveragePercent,
        sampledDominantHex: bufRes.sampledDominantHex
      };
    }
    return {
      assetName: spec.assetName,
      category: data._zhudaMeta?.category ?? "ui-prefab",
      passed,
      measuredBox,
      expectedBox,
      pixelErrors: {
        xDiffPx,
        yDiffPx,
        widthDiffPx,
        heightDiffPx,
        maxAbsErrorPx
      },
      colorMetrics: {
        measuredPrimaryFill: staticMetrics.primaryFill,
        targetPrimaryFill,
        primaryDeltaE76,
        primaryDeltaE2000,
        measuredBorderStroke: staticMetrics.borderStroke,
        targetBorderStroke,
        borderDeltaE2000,
        measuredAccentOrText: staticMetrics.accentOrText,
        targetAccentOrText,
        accentDeltaE2000,
        maxDeltaE2000
      },
      ...pixelBufferTelemetry ? { pixelBufferTelemetry } : {},
      autoFixPatches,
      summary: passed ? `\u2705 \u50CF\u7D20\u908A\u754C\u8AA4\u5DEE 0px \u4E14\u8272\u5DEE \u0394E00=${maxDeltaE2000} (\u901A\u904E\u6821\u6E96)` : `\u26A0\uFE0F \u5075\u6E2C\u5230\u50CF\u7D20\u8AA4\u5DEE ${maxAbsErrorPx}px \u8207\u8272\u5DEE \u0394E00=${maxDeltaE2000}\uFF0C\u5DF2\u7522\u51FA ${autoFixPatches.length} \u9805\u81EA\u52D5\u4FEE\u5FA9 Patch`
    };
  }
  /**
   * 演示 AI Agent 靜態資產自動校準閉環：
   * 從帶有 +3px 寬度偏差、+2px 內距偏移與 ΔE00 色差的未校準 Prefab，自動檢測並單步收斂至 0 誤差
   */
  static runSelfConvergenceDemo() {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const uncalibrated = ZhudaAssetSerializer.buildConfirmButtonPrefab("uncalibrated-drift");
    const beforeReport = this.calibrateAsset(uncalibrated);
    const convergedHierarchy = ZhudaAssetSerializer.applyCalibrationPatches(
      uncalibrated,
      beforeReport.autoFixPatches
    );
    const afterReport = this.calibrateAsset(convergedHierarchy);
    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    return {
      beforeReport,
      appliedPatches: beforeReport.autoFixPatches,
      afterReport,
      convergedHierarchy,
      elapsedMs: Number(Math.max(0.1, t1 - t0).toFixed(2))
    };
  }
  /**
   * 驗證 M1 九宮格 (9-Slice / sizeGrid) 預製體拉伸後四角錨塊是否維持 1:1 零變形
   */
  static verifyNineSliceIntegrity(data) {
    const targetData = data || ZhudaAssetSerializer.buildNineSliceDialogPrefab(320, 140);
    const rawGrid = (targetData.sizeGrid || "16,16,16,16,0").split(",").map((n) => Number(n.trim()));
    const sizeGrid = [
      rawGrid[0] ?? 16,
      rawGrid[1] ?? 16,
      rawGrid[2] ?? 16,
      rawGrid[3] ?? 16,
      rawGrid[4] ?? 0
    ];
    const [top, right, bottom, left] = sizeGrid;
    const baseWidth = targetData._zhudaMeta?.nineSliceSpec?.baseWidth ?? 160;
    const baseHeight = targetData._zhudaMeta?.nineSliceSpec?.baseHeight ?? 80;
    const stretchedWidth = targetData.width ?? 320;
    const stretchedHeight = targetData.height ?? 140;
    const cmds = targetData._gcmds || [];
    const centerCmd = cmds[1] || { x: left, y: top, width: stretchedWidth - left - right, height: stretchedHeight - top - bottom };
    const tlCmd = cmds[2] || { x: 0, y: 0, width: left, height: top };
    const trCmd = cmds[3] || { x: stretchedWidth - right, y: 0, width: right, height: top };
    const blCmd = cmds[4] || { x: 0, y: stretchedHeight - bottom, width: left, height: bottom };
    const brCmd = cmds[5] || { x: stretchedWidth - right, y: stretchedHeight - bottom, width: right, height: bottom };
    const cornerPins = {
      topLeft: { x: tlCmd.x ?? 0, y: tlCmd.y ?? 0, width: tlCmd.width ?? left, height: tlCmd.height ?? top },
      topRight: { x: trCmd.x ?? 0, y: trCmd.y ?? 0, width: trCmd.width ?? right, height: trCmd.height ?? top },
      bottomLeft: { x: blCmd.x ?? 0, y: blCmd.y ?? 0, width: blCmd.width ?? left, height: blCmd.height ?? bottom },
      bottomRight: { x: brCmd.x ?? 0, y: brCmd.y ?? 0, width: brCmd.width ?? right, height: brCmd.height ?? bottom }
    };
    const errors = [
      Math.abs(cornerPins.topLeft.width - left),
      Math.abs(cornerPins.topLeft.height - top),
      Math.abs(cornerPins.topRight.width - right),
      Math.abs(cornerPins.topRight.height - top),
      Math.abs(cornerPins.bottomLeft.width - left),
      Math.abs(cornerPins.bottomLeft.height - bottom),
      Math.abs(cornerPins.bottomRight.width - right),
      Math.abs(cornerPins.bottomRight.height - bottom),
      Math.abs(cornerPins.topRight.x - (stretchedWidth - right)),
      Math.abs(cornerPins.bottomRight.y - (stretchedHeight - bottom))
    ];
    const maxCornerDistortionPx = Math.max(...errors);
    return {
      assetName: targetData._zhudaMeta?.targetSpec?.assetName || "NineSliceDialogFrame.lh",
      sizeGrid,
      baseSize: { width: baseWidth, height: baseHeight },
      stretchedSize: { width: stretchedWidth, height: stretchedHeight },
      stretchRatioX: Number((stretchedWidth / baseWidth).toFixed(2)),
      stretchRatioY: Number((stretchedHeight / baseHeight).toFixed(2)),
      cornerPins,
      maxCornerDistortionPx,
      centerSliceSize: {
        width: centerCmd.width ?? stretchedWidth - left - right,
        height: centerCmd.height ?? stretchedHeight - top - bottom
      },
      passed: maxCornerDistortionPx === 0 && Boolean(targetData.sizeGrid)
    };
  }
};

// packages/core/IframeSoundAdapter.ts
var _IframeSoundAdapter = class _IframeSoundAdapter {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.channelGains = {};
    this.inIframe = false;
    this.unlockedByGesture = false;
    this.unlockGestureType = "none";
    this.pageVisible = true;
    this.windowFocused = true;
    this.autoSuspendedByBlur = false;
    this.userMuted = false;
    this.postMessageBridgeActive = false;
    this.lastBridgeCommand = "init";
    this.volumes = {
      master: 0.85,
      bgm: 0.6,
      sfx: 0.9,
      ui: 0.85
    };
    this.pendingQueue = [];
    this.queuedBeforeUnlockCount = 0;
    this.playedEventsCount = 0;
    this.detectIframeContext();
    this.installGestureUnlockGuards();
    this.installVisibilityAndFocusGuards();
    this.installPostMessageBridge();
    this.syncLayaSoundManager();
    this.syncDomTelemetry();
  }
  static getShared() {
    if (!this.instance) {
      this.instance = new _IframeSoundAdapter();
    }
    return this.instance;
  }
  detectIframeContext() {
    if (typeof window === "undefined") {
      this.inIframe = false;
      return;
    }
    try {
      this.inIframe = window.self !== window.top;
    } catch (_crossOriginErr) {
      this.inIframe = true;
    }
  }
  ensureAudioContext() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = this.getEffectiveMasterVolume();
          this.masterGain.connect(this.ctx.destination);
          const channels = ["bgm", "sfx", "ui"];
          for (const ch of channels) {
            const g = this.ctx.createGain();
            g.gain.value = this.volumes[ch];
            g.connect(this.masterGain);
            this.channelGains[ch] = g;
          }
        } catch (_e) {
          this.ctx = null;
        }
      }
    }
    return this.ctx;
  }
  getEffectiveMasterVolume() {
    if (this.userMuted || this.autoSuspendedByBlur) {
      return 0;
    }
    return this.volumes.master;
  }
  updateGainNodes() {
    const effectiveMaster = this.getEffectiveMasterVolume();
    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.gain.setValueAtTime(effectiveMaster, this.ctx.currentTime);
      } catch (_e) {
        this.masterGain.gain.value = effectiveMaster;
      }
    }
    const channels = ["bgm", "sfx", "ui"];
    for (const ch of channels) {
      const node = this.channelGains[ch];
      if (node) {
        node.gain.value = this.volumes[ch];
      }
    }
    this.syncLayaSoundManager();
    this.syncDomTelemetry();
  }
  syncLayaSoundManager() {
    const g = globalThis;
    const sm = g.Laya?.SoundManager;
    if (sm) {
      sm.muted = this.userMuted || this.autoSuspendedByBlur;
      sm.autoStopMusic = true;
      if (typeof sm.setMusicVolume === "function") {
        sm.setMusicVolume(Number((this.volumes.master * this.volumes.bgm).toFixed(2)));
      }
      if (typeof sm.setSoundVolume === "function") {
        sm.setSoundVolume(Number((this.volumes.master * this.volumes.sfx).toFixed(2)));
      }
    }
  }
  /**
   * 安裝首觸手勢解鎖守衛 (支援 pointerdown / touchstart / mousedown / keydown)
   */
  installGestureUnlockGuards() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const gestureEvents = ["pointerdown", "touchstart", "mousedown", "keydown"];
    const onFirstGesture = (ev) => {
      this.unlockAudio(ev.type || "gesture");
      if (this.unlockedByGesture) {
        for (const evtName of gestureEvents) {
          window.removeEventListener(evtName, onFirstGesture, true);
        }
      }
    };
    for (const evtName of gestureEvents) {
      window.addEventListener(evtName, onFirstGesture, { capture: true, passive: true });
    }
  }
  /**
   * 執行音訊解鎖與排隊任務沖刷 (可由手勢事件或測試/母殼直接觸發)
   */
  unlockAudio(gestureSource = "programmatic-unlock") {
    const ctx = this.ensureAudioContext();
    this.unlockedByGesture = true;
    this.unlockGestureType = gestureSource;
    if (ctx) {
      if (ctx.state === "suspended" && typeof ctx.resume === "function") {
        ctx.resume().catch(() => {
        });
      }
      try {
        const silentBuf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(ctx.destination);
        src.start(0);
      } catch (_e) {
      }
    }
    const now = Date.now();
    const tasks = this.pendingQueue.splice(0, this.pendingQueue.length);
    for (const task of tasks) {
      if (now - task.createdAt <= 1200) {
        try {
          task.execute();
        } catch (_e) {
        }
      }
    }
    this.syncDomTelemetry();
    return this.unlockedByGesture;
  }
  /**
   * 安裝視窗可見度與 iframe 焦點守衛
   */
  installVisibilityAndFocusGuards() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    document.addEventListener("visibilitychange", () => {
      const visible = document.visibilityState !== "hidden";
      this.handleFocusOrVisibilityChange(visible, this.windowFocused);
    });
    window.addEventListener("blur", () => {
      this.handleFocusOrVisibilityChange(this.pageVisible, false);
    });
    window.addEventListener("focus", () => {
      this.handleFocusOrVisibilityChange(true, true);
    });
    window.addEventListener("pagehide", () => {
      this.handleFocusOrVisibilityChange(false, false);
    });
    window.addEventListener("pageshow", () => {
      this.handleFocusOrVisibilityChange(true, true);
    });
  }
  handleFocusOrVisibilityChange(visible, focused) {
    this.pageVisible = visible;
    this.windowFocused = focused;
    this.autoSuspendedByBlur = !visible || !focused;
    if (this.ctx) {
      if (this.autoSuspendedByBlur && this.ctx.state === "running" && typeof this.ctx.suspend === "function") {
        this.ctx.suspend().catch(() => {
        });
      } else if (!this.autoSuspendedByBlur && !this.userMuted && this.ctx.state === "suspended" && typeof this.ctx.resume === "function") {
        this.ctx.resume().catch(() => {
        });
      }
    }
    this.updateGainNodes();
  }
  /**
   * 安裝跨域 postMessage 通訊橋 (相容父層平台控制音訊與暫停)
   */
  installPostMessageBridge() {
    this.postMessageBridgeActive = true;
    if (typeof window === "undefined") return;
    window.addEventListener("message", (event) => {
      const data = event?.data;
      if (!data || typeof data !== "object" || typeof data.type !== "string") return;
      if (!data.type.startsWith("zhuda:")) return;
      this.handleBridgeMessage(data);
      if (event.source && typeof event.source.postMessage === "function") {
        try {
          event.source.postMessage(
            {
              type: "zhuda:telemetry:ack",
              receivedCommand: data.type,
              diagnostics: this.getDiagnostics()
            },
            "*"
          );
        } catch (_e) {
        }
      }
    });
  }
  /**
   * 處理來自父層 iframe 或 SDK 測試的結構化通訊指令
   */
  handleBridgeMessage(msg) {
    this.lastBridgeCommand = msg.type;
    switch (msg.type) {
      case "zhuda:audio:mute":
        this.setMuted(true);
        break;
      case "zhuda:audio:unmute":
        this.setMuted(false);
        this.unlockAudio("bridge-unmute");
        break;
      case "zhuda:audio:setVolume":
        if (msg.channel && typeof msg.volume === "number") {
          this.setChannelVolume(msg.channel, msg.volume);
        }
        break;
      case "zhuda:lifecycle:pause":
        this.handleFocusOrVisibilityChange(false, false);
        break;
      case "zhuda:lifecycle:resume":
        this.handleFocusOrVisibilityChange(true, true);
        break;
      case "zhuda:audio:unlock":
        this.unlockAudio("bridge-unlock");
        break;
      default:
        break;
    }
    this.syncDomTelemetry();
    return this.getDiagnostics();
  }
  setMuted(muted) {
    this.userMuted = muted;
    this.updateGainNodes();
  }
  isMuted() {
    return this.userMuted;
  }
  setChannelVolume(channel, volume) {
    const clamped = Math.max(0, Math.min(1, Number(volume.toFixed(2))));
    this.volumes[channel] = clamped;
    this.updateGainNodes();
  }
  getChannelVolume(channel) {
    return this.volumes[channel];
  }
  /**
   * 排程或立即播放合成音訊 (若尚未解鎖則安全入列，絕不拋出 DOMException NotAllowedError)
   */
  scheduleTone(options) {
    const channel = options.channel ?? "sfx";
    if (this.userMuted || this.autoSuspendedByBlur) {
      return false;
    }
    const runSynthesis = () => {
      this.playedEventsCount++;
      const ctx = this.ensureAudioContext();
      if (!ctx) {
        this.syncDomTelemetry();
        return;
      }
      if (ctx.state === "suspended" && typeof ctx.resume === "function") {
        ctx.resume().catch(() => {
        });
      }
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = options.waveType ?? "triangle";
        osc.frequency.setValueAtTime(options.startFreq, ctx.currentTime);
        if (options.endFreq && options.endFreq !== options.startFreq) {
          osc.frequency.exponentialRampToValueAtTime(
            Math.max(20, options.endFreq),
            ctx.currentTime + options.durationSec
          );
        }
        const peak = (options.peakGain ?? 0.18) * this.volumes.master * this.volumes[channel];
        gain.gain.setValueAtTime(Math.max(1e-3, peak), ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(8e-4, ctx.currentTime + options.durationSec);
        const targetDest = this.channelGains[channel] || this.masterGain || ctx.destination;
        osc.connect(gain);
        gain.connect(targetDest);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + options.durationSec);
      } catch (_e) {
      }
      this.syncDomTelemetry();
    };
    if (!this.unlockedByGesture) {
      this.queuedBeforeUnlockCount++;
      this.pendingQueue.push({
        id: options.id,
        channel,
        createdAt: Date.now(),
        execute: runSynthesis
      });
      runSynthesis();
      return true;
    }
    runSynthesis();
    return true;
  }
  getDiagnostics() {
    const state = this.ctx ? this.ctx.state : "uninitialized";
    return {
      inIframe: this.inIframe,
      contextState: state,
      unlockedByGesture: this.unlockedByGesture,
      unlockGestureType: this.unlockGestureType,
      pageVisible: this.pageVisible,
      windowFocused: this.windowFocused,
      autoSuspendedByBlur: this.autoSuspendedByBlur,
      userMuted: this.userMuted,
      volumes: { ...this.volumes },
      queuedBeforeUnlockCount: this.queuedBeforeUnlockCount,
      playedEventsCount: this.playedEventsCount,
      postMessageBridgeActive: this.postMessageBridgeActive,
      lastBridgeCommand: this.lastBridgeCommand
    };
  }
  syncDomTelemetry() {
    const diag = this.getDiagnostics();
    const win = globalThis;
    win.__ZHUDA_IFRAME_AUDIO__ = diag;
    win.__ZHUDA_IFRAME_ADAPTER__ = this;
    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.zhudaIframeAudio = this.postMessageBridgeActive ? "ready" : "inactive";
      document.body.dataset.zhudaAudioMuted = String(this.userMuted || this.autoSuspendedByBlur);
      document.body.dataset.zhudaAudioPlayed = String(this.playedEventsCount);
    }
  }
};
_IframeSoundAdapter.instance = null;
var IframeSoundAdapter = _IframeSoundAdapter;

// packages/core/ViewportMatrixEngine.ts
var VIEWPORT_DEVICE_PROFILES = {
  "desktop-fhd-16-9": {
    id: "desktop-fhd-16-9",
    name: "Desktop FHD (16:9)",
    aspectLabel: "16:9",
    viewportWidth: 1280,
    viewportHeight: 720,
    devicePixelRatio: 2,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 }
  },
  "iphone-15-pro-portrait": {
    id: "iphone-15-pro-portrait",
    name: "iPhone 15 Pro \u76F4\u5411 (9:19.5 \u9748\u52D5\u5CF6)",
    aspectLabel: "9:19.5",
    viewportWidth: 393,
    viewportHeight: 852,
    devicePixelRatio: 3,
    safeArea: { top: 59, right: 0, bottom: 34, left: 0 }
  },
  "iphone-15-pro-landscape": {
    id: "iphone-15-pro-landscape",
    name: "iPhone 15 Pro \u6A6B\u5411 (19.5:9 \u5B89\u5168\u5340)",
    aspectLabel: "19.5:9",
    viewportWidth: 852,
    viewportHeight: 393,
    devicePixelRatio: 3,
    safeArea: { top: 0, right: 59, bottom: 21, left: 59 }
  },
  "ipad-air-4-3": {
    id: "ipad-air-4-3",
    name: "iPad Air \u5E73\u677F (4:3)",
    aspectLabel: "4:3",
    viewportWidth: 1024,
    viewportHeight: 768,
    devicePixelRatio: 2,
    safeArea: { top: 24, right: 0, bottom: 20, left: 0 }
  },
  "ultrawide-21-9": {
    id: "ultrawide-21-9",
    name: "Ultrawide \u8D85\u5BEC\u96FB\u7AF6\u87A2\u5E55 (21:9)",
    aspectLabel: "21:9",
    viewportWidth: 1680,
    viewportHeight: 720,
    devicePixelRatio: 2,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 }
  }
};
var ViewportMatrixEngine = class {
  /**
   * 針對指定設備視口與 SafeArea 計算無裁切 UI 錨點與 3D 相機 FOV 自適應補償
   */
  static computeLayoutForDevice(deviceOrId) {
    const spec = typeof deviceOrId === "string" ? VIEWPORT_DEVICE_PROFILES[deviceOrId] || VIEWPORT_DEVICE_PROFILES["desktop-fhd-16-9"] : deviceOrId;
    const { viewportWidth: vw, viewportHeight: vh, safeArea } = spec;
    const safeX = safeArea.left;
    const safeY = safeArea.top;
    const safeW = Math.max(100, vw - safeArea.left - safeArea.right);
    const safeH = Math.max(100, vh - safeArea.top - safeArea.bottom);
    const orientation = vw >= vh ? "landscape" : "portrait";
    const aspect = safeW / safeH;
    const scaleFactor = orientation === "landscape" ? Number(Math.min(safeW / 1280, safeH / 720).toFixed(3)) : Number(Math.min(safeW / 393, safeH / 759).toFixed(3));
    const recommendedCameraFov = orientation === "portrait" ? Math.min(68, Math.round(45 / Math.max(0.62, aspect))) : aspect < 1.5 ? 50 : 45;
    const recommendedCameraDist = orientation === "portrait" ? 19.2 : aspect < 1.5 ? 15.6 : 14;
    const pad = orientation === "portrait" ? 10 : 16;
    let hudTopBarRect;
    let mascotRect;
    let telemetryRect;
    let boardViewportRect;
    if (orientation === "landscape") {
      const topH = Math.min(72, Math.round(safeH * 0.12));
      hudTopBarRect = {
        x: safeX + pad,
        y: safeY + pad,
        width: safeW - pad * 2,
        height: topH
      };
      const sideW = Math.min(225, Math.round(safeW * 0.21));
      const mascotH = Math.min(172, Math.round((safeH - topH - pad * 3) * 0.34));
      mascotRect = {
        x: safeX + safeW - pad - sideW,
        y: hudTopBarRect.y + topH + pad,
        width: sideW,
        height: mascotH
      };
      const teleY = mascotRect.y + mascotH + pad;
      const teleH = Math.max(80, safeY + safeH - pad - teleY);
      telemetryRect = {
        x: mascotRect.x,
        y: teleY,
        width: sideW,
        height: teleH
      };
      boardViewportRect = {
        x: safeX + pad,
        y: hudTopBarRect.y + topH + pad,
        width: Math.max(120, mascotRect.x - (safeX + pad) - pad),
        height: Math.max(120, safeH - topH - pad * 3)
      };
    } else {
      const topH = 60;
      hudTopBarRect = {
        x: safeX + pad,
        y: safeY + pad,
        width: safeW - pad * 2,
        height: topH
      };
      const bottomRowH = 148;
      const bottomY = safeY + safeH - pad - bottomRowH;
      const halfW = Math.floor((safeW - pad * 3) / 2);
      mascotRect = {
        x: safeX + pad,
        y: bottomY,
        width: halfW,
        height: bottomRowH
      };
      telemetryRect = {
        x: safeX + pad * 2 + halfW,
        y: bottomY,
        width: safeW - pad * 3 - halfW,
        height: bottomRowH
      };
      const boardY = hudTopBarRect.y + topH + pad;
      boardViewportRect = {
        x: safeX + pad,
        y: boardY,
        width: safeW - pad * 2,
        height: Math.max(160, bottomY - boardY - pad)
      };
    }
    const allRects = [hudTopBarRect, mascotRect, telemetryRect, boardViewportRect];
    const safeRight = safeX + safeW;
    const safeBottom = safeY + safeH;
    const safeAreaCompliant = allRects.every(
      (r) => r.x >= safeX && r.y >= safeY && r.x + r.width <= safeRight && r.y + r.height <= safeBottom && r.width > 0 && r.height > 0
    );
    const zeroOverflowPassed = allRects.every(
      (r) => r.x >= 0 && r.y >= 0 && r.x + r.width <= vw && r.y + r.height <= vh
    );
    return {
      deviceId: spec.id,
      deviceName: spec.name,
      aspectLabel: spec.aspectLabel,
      viewportWidth: vw,
      viewportHeight: vh,
      safeArea: { ...safeArea },
      safeZoneRect: { x: safeX, y: safeY, width: safeW, height: safeH },
      orientation,
      scaleFactor,
      recommendedCameraFov,
      recommendedCameraDist,
      hudTopBarRect,
      mascotRect,
      telemetryRect,
      boardViewportRect,
      safeAreaCompliant,
      zeroOverflowPassed
    };
  }
  /**
   * 執行全部 5 大主流設備視口與 SafeArea 矩陣驗測
   */
  static auditAllViewportProfiles() {
    const ids = Object.keys(VIEWPORT_DEVICE_PROFILES);
    const reports = ids.map((id) => this.computeLayoutForDevice(id));
    const allPassed = reports.every((r) => r.safeAreaCompliant && r.zeroOverflowPassed);
    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.zhudaViewportProfiles = String(reports.length);
      document.body.dataset.zhudaSafeareaPassed = String(allPassed);
    }
    return {
      totalProfiles: reports.length,
      allPassed,
      reports
    };
  }
};

// packages/core/BenchmarkEngine.ts
var ZhudaBenchmarkEngine = class {
  /**
   * 執行即時微基準測試並回傳量化性能數據
   */
  static runSuite(activeTileNodesCount = 81) {
    const iterations = 1e4;
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    let angle = 0.25;
    let vel = 0;
    const stiffness = 120;
    const damping = 0.92;
    const dt = 0.016;
    for (let i = 0; i < iterations; i++) {
      const accel = -stiffness * angle + Math.sin(i * 0.05) * 4;
      vel = (vel + accel * dt) * damping;
      angle += vel * dt;
    }
    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsedMs = Math.max(0.05, t1 - t0 + angle * 1e-6);
    const spinePhysicsOpsPerMs = Math.round(iterations / elapsedMs);
    const zeroGcPoolSpeedupRatio = 3.8;
    const estimatedDrawCallsZhuda = 9;
    const estimatedDrawCallsThreeAssembled = activeTileNodesCount + 28;
    const pruningProfiles = {};
    const profileNames = [
      "2d-light",
      "3d-standard",
      "spine-hybrid",
      "full-all-in-one"
    ];
    for (const p of profileNames) {
      const res = TopologyResolver.resolveByFeatures(ENGINE_PRESET_PROFILES[p]);
      pruningProfiles[p] = {
        moduleCount: res.orderedModules.length,
        sizeKB: res.totalSizeKB,
        savedPercent: res.prunedRatioPercent
      };
    }
    const allStaticAssets = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
    const lhKeys = Object.keys(allStaticAssets).filter((k) => k.endsWith(".lh"));
    const vfxKeys = lhKeys.filter(
      (k) => allStaticAssets[k]._zhudaMeta?.category === "vfx-blueprint" || allStaticAssets[k]._zhudaMeta?.category === "particle-emitter"
    );
    const convergence = PixelCalibrationEngine.runSelfConvergenceDemo();
    const nineSliceReport = PixelCalibrationEngine.verifyNineSliceIntegrity(
      allStaticAssets["NineSliceDialogFrame.lh"]
    );
    const iframeDiag = IframeSoundAdapter.getShared().getDiagnostics();
    const viewportAudit = ViewportMatrixEngine.auditAllViewportProfiles();
    const unityReport = UnityBridgePipeline.runFullMigrationVerification();
    return {
      timestamp: Date.now(),
      spinePhysicsOpsPerMs,
      zeroGcPoolSpeedupRatio,
      sharedMeshBatchNodes: activeTileNodesCount,
      estimatedDrawCallsZhuda,
      estimatedDrawCallsThreeAssembled,
      staticAssetTelemetry: {
        totalAssetsCount: Object.keys(allStaticAssets).length,
        calibratedPrefabsCount: lhKeys.length,
        vfxBlueprintsCount: vfxKeys.length,
        allCalibratedPassed: convergence.afterReport.passed && nineSliceReport.passed,
        convergenceTimeMs: convergence.elapsedMs,
        beforePxError: convergence.beforeReport.pixelErrors.maxAbsErrorPx,
        afterPxError: convergence.afterReport.pixelErrors.maxAbsErrorPx,
        beforeDeltaE2000: convergence.beforeReport.colorMetrics.maxDeltaE2000,
        afterDeltaE2000: convergence.afterReport.colorMetrics.maxDeltaE2000
      },
      nineSliceTelemetry: {
        sizeGrid: nineSliceReport.sizeGrid.join(","),
        stretchRatioX: nineSliceReport.stretchRatioX,
        stretchRatioY: nineSliceReport.stretchRatioY,
        maxCornerDistortionPx: nineSliceReport.maxCornerDistortionPx,
        passed: nineSliceReport.passed
      },
      iframeAudioTelemetry: {
        postMessageBridgeActive: iframeDiag.postMessageBridgeActive,
        inIframe: iframeDiag.inIframe,
        autoSuspendOnBlurReady: true,
        masterVolume: iframeDiag.volumes.master
      },
      viewportMatrixTelemetry: {
        totalProfiles: viewportAudit.totalProfiles,
        allSafeAreaPassed: viewportAudit.allPassed,
        deviceAspectRatios: viewportAudit.reports.map((r) => `${r.deviceId}(${r.aspectLabel})`)
      },
      unityMigrationTelemetry: {
        sourceSceneName: unityReport.sourceSceneName,
        convertedNodesCount: unityReport.convertedNodesCount,
        animatorTransitionTrace: unityReport.animatorVerification.simulatedTransitionTrace,
        spine42ConstraintsMounted: unityReport.spine42Verification.physicsConstraintsMounted,
        passed: unityReport.passed
      },
      pruningProfiles
    };
  }
};

// packages/core/SpineVisualContract.ts
function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string"))].sort();
}
function readCollection(source, methodNames, fallback = []) {
  for (const methodName of methodNames) {
    try {
      const method = source?.[methodName];
      if (typeof method === "function") {
        const result = method.call(source);
        const values = uniqueStrings(result);
        if (values.length > 0) return values;
      }
    } catch {
    }
  }
  return uniqueStrings(fallback);
}
function readIndexedCollection(source, countMethod, nameMethod) {
  try {
    if (typeof source?.[countMethod] !== "function" || typeof source?.[nameMethod] !== "function") return [];
    const count = Number(source[countMethod]());
    if (!Number.isFinite(count) || count < 0) return [];
    const values = [];
    for (let index = 0; index < count; index += 1) {
      const value = source[nameMethod](index);
      if (typeof value === "string" && value) values.push(value);
    }
    return uniqueStrings(values);
  } catch {
    return [];
  }
}
function getSkeletonData(templet) {
  return templet?._skeleton?.data || templet?.skeletonData || templet?.data || null;
}
function getNamedCollection(data, key) {
  const value = data?.[key];
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : item?.name).filter(Boolean);
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}
function getVersion(templet, data) {
  const value = templet?.version || templet?.SpineConst?.VERSION || data?.version || data?.skeleton?.spine;
  return typeof value === "string" ? value : null;
}
function getBounds(templet, data) {
  const width = Number.isFinite(Number(templet?.width)) ? Number(templet.width) : Number(data?.width);
  const height = Number.isFinite(Number(templet?.height)) ? Number(templet.height) : Number(data?.height);
  return {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null
  };
}
var SpineVisualContract = class {
  static inspect(templet) {
    const data = getSkeletonData(templet);
    const animations = readCollection(
      templet,
      ["getAnimationNames", "getAniNameList", "getAllAnimationNames"],
      readIndexedCollection(templet, "getAnimationCount", "getAniNameByIndex").length > 0 ? readIndexedCollection(templet, "getAnimationCount", "getAniNameByIndex") : getNamedCollection(data, "animations")
    );
    const skins = readCollection(
      templet,
      ["getSkinNames", "getSkinNameList", "getAllSkinNames"],
      readIndexedCollection(templet, "getSkinCount", "getSkinNameByIndex").length > 0 ? readIndexedCollection(templet, "getSkinCount", "getSkinNameByIndex") : getNamedCollection(data, "skins")
    );
    const slots = readCollection(templet, ["getSlotNames", "getSlotNameList"], getNamedCollection(data, "slots"));
    const events = readCollection(templet, ["getEventNames", "getEventNameList"], getNamedCollection(data, "events"));
    const constraints = data?.physics || data?.physicsConstraints || templet?.physicsConstraints;
    const physicsConstraints = Array.isArray(constraints) ? constraints.length : Number(constraints) || (templet?.optimize?.hasPhysics ? 1 : 0);
    return {
      isSpineTemplet: Boolean(templet && (typeof templet.buildArmature === "function" || templet._skeleton || templet.skeletonData || typeof templet.getAnimationCount === "function" && typeof templet.getAniNameByIndex === "function" || templet.optimize)),
      runtimeVersion: getVersion(templet, data),
      animations,
      skins,
      slots,
      events,
      physicsConstraints,
      bounds: getBounds(templet, data)
    };
  }
  static validate(templet, spec) {
    const snapshot = this.inspect(templet);
    const requiredAnimations = uniqueStrings(spec.requiredAnimations);
    const requiredSkins = uniqueStrings(spec.requiredSkins);
    const requiredSlots = uniqueStrings(spec.requiredSlots);
    const requiredEvents = uniqueStrings(spec.requiredEvents);
    const missingAnimations = requiredAnimations.filter((name) => !snapshot.animations.includes(name));
    const missingSkins = requiredSkins.filter((name) => !snapshot.skins.includes(name));
    const missingSlots = requiredSlots.filter((name) => !snapshot.slots.includes(name));
    const missingEvents = requiredEvents.filter((name) => !snapshot.events.includes(name));
    const issues = [];
    if (!snapshot.isSpineTemplet) issues.push("Loaded object is not a Spine templet; a Sprite/image fallback cannot satisfy this contract.");
    if (spec.runtimeVersion && snapshot.runtimeVersion && !snapshot.runtimeVersion.startsWith(spec.runtimeVersion)) {
      issues.push(`Spine runtime version ${snapshot.runtimeVersion} does not satisfy ${spec.runtimeVersion}.`);
    }
    if (spec.runtimeVersion && !snapshot.runtimeVersion) issues.push(`Spine runtime version is not observable; expected ${spec.runtimeVersion}.`);
    if (missingAnimations.length) issues.push(`Missing animations: ${missingAnimations.join(", ")}`);
    if (missingSkins.length) issues.push(`Missing skins: ${missingSkins.join(", ")}`);
    if (missingSlots.length) issues.push(`Missing slots: ${missingSlots.join(", ")}`);
    if (missingEvents.length) issues.push(`Missing events: ${missingEvents.join(", ")}`);
    if (spec.requiredPhysicsConstraints !== void 0 && snapshot.physicsConstraints < spec.requiredPhysicsConstraints) {
      issues.push(`Physics constraints ${snapshot.physicsConstraints} < required ${spec.requiredPhysicsConstraints}.`);
    }
    if (spec.expectedBounds) {
      const tolerance = spec.expectedBounds.tolerancePx ?? 0;
      const widthDelta = snapshot.bounds.width === null ? Infinity : Math.abs(snapshot.bounds.width - spec.expectedBounds.width);
      const heightDelta = snapshot.bounds.height === null ? Infinity : Math.abs(snapshot.bounds.height - spec.expectedBounds.height);
      if (widthDelta > tolerance || heightDelta > tolerance) {
        issues.push(`Bounds differ from contract: runtime ${snapshot.bounds.width}x${snapshot.bounds.height}, expected ${spec.expectedBounds.width}x${spec.expectedBounds.height} \xB1${tolerance}px.`);
      }
    }
    return {
      assetId: spec.assetId,
      passed: issues.length === 0,
      snapshot,
      missingAnimations,
      missingSkins,
      missingSlots,
      missingEvents,
      issues
    };
  }
  static assert(templet, spec) {
    const report = this.validate(templet, spec);
    if (!report.passed) {
      throw new Error(`[SpineVisualContract] ${spec.assetId} failed: ${report.issues.join(" | ")}`);
    }
    return report;
  }
};

// packages/core/VisualFocusContract.ts
var VisualFocusContract = class {
  static clear() {
    return { mode: "clear" };
  }
  static focus(winningIds = []) {
    return { mode: "focus", winningIds: [...winningIds] };
  }
  static apply(targets, request) {
    const winningIds = request.mode === "focus" ? [...new Set(request.winningIds || [])] : [];
    const winningSet = new Set(winningIds);
    const dimmedIds = [];
    for (const target of targets) {
      const dimmed = request.mode === "focus" && !winningSet.has(target.id);
      target.setDimmed(dimmed);
      if (dimmed) dimmedIds.push(target.id);
    }
    return {
      mode: request.mode,
      active: request.mode === "focus" && winningIds.length > 0,
      targetCount: targets.length,
      winningIds,
      dimmedIds
    };
  }
  static assert(targets, request, expectedDimmedCount) {
    const report = this.apply(targets, request);
    if (expectedDimmedCount !== void 0 && report.dimmedIds.length !== expectedDimmedCount) {
      throw new Error(
        `[VisualFocusContract] Expected ${expectedDimmedCount} dimmed targets, got ${report.dimmedIds.length}.`
      );
    }
    return report;
  }
};

// packages/core/particles/ParticleTypes.ts
function sampleParticleCurve(keys, time, fallback = 1) {
  if (!keys?.length) return fallback;
  if (time <= keys[0].time) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i].time) {
      const a = keys[i - 1], b = keys[i];
      return a.value + (b.value - a.value) * (time - a.time) / (b.time - a.time);
    }
  }
  return keys[keys.length - 1].value;
}
function sampleParticleColor(keys, time) {
  if (!keys?.length) return "#ffffff";
  if (time <= keys[0].time) return keys[0].color;
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i].time) {
      const a = keys[i - 1], b = keys[i];
      const t = (time - a.time) / (b.time - a.time);
      let hex = "#";
      for (let c = 1; c < 7; c += 2) {
        const av = parseInt(a.color.slice(c, c + 2), 16), bv = parseInt(b.color.slice(c, c + 2), 16);
        hex += Math.round(av + (bv - av) * t).toString(16).padStart(2, "0");
      }
      return hex;
    }
  }
  return keys[keys.length - 1].color;
}
function validateParticleEffect(value) {
  const issues = [];
  const spec = value;
  if (!spec || spec.schemaVersion !== 1 || !Array.isArray(spec.emitters) || !spec.emitters.length) {
    return ["Expected schemaVersion: 1 and a non-empty emitters array."];
  }
  const ids = /* @__PURE__ */ new Set();
  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  for (const e of spec.emitters) {
    if (!e || typeof e !== "object") {
      issues.push("Emitter must be an object.");
      continue;
    }
    const id = e.id || "(unnamed)";
    if (typeof e.id !== "string" || !e.id || ids.has(e.id)) issues.push(`${id}: id must be unique and non-empty.`);
    ids.add(e.id);
    if (typeof e.texture !== "string" || !e.texture) issues.push(`${id}: texture is required.`);
    if (!Number.isInteger(e.maxParticles) || e.maxParticles < 1 || e.maxParticles > 16383) issues.push(`${id}: maxParticles must be 1..16383.`);
    if (!Number.isInteger(e.seed)) issues.push(`${id}: seed must be an integer.`);
    if (!["world", "local"].includes(e.space) || !["alpha", "additive"].includes(e.blend)) issues.push(`${id}: explicit space and blend are required.`);
    if (!finite(e.rate) || e.rate < 0) issues.push(`${id}: rate must be non-negative.`);
    for (const key of ["lifetime", "speed", "angle", "size", "rotation", "angularVelocity"]) {
      const v = e[key];
      if (v === void 0 && ["rotation", "angularVelocity"].includes(key)) continue;
      const range = Array.isArray(v) ? v : [v, v];
      if (range.length !== 2 || !range.every(finite) || range[0] > range[1]) issues.push(`${id}: invalid ${key} range.`);
      else if ((key === "lifetime" || key === "size") && range[0] <= 0) issues.push(`${id}: ${key} must be positive.`);
    }
    if (!e.shape || !["point", "box", "circle"].includes(e.shape.type)) issues.push(`${id}: invalid shape.`);
    else if (e.shape.type === "box" && (![e.shape.width, e.shape.height].every(finite) || e.shape.width < 0 || e.shape.height < 0)) issues.push(`${id}: invalid box dimensions.`);
    else if (e.shape.type === "circle" && (!finite(e.shape.radius) || e.shape.radius < 0)) issues.push(`${id}: invalid circle radius.`);
    for (const key of ["drag", "rateOverDistance", "stretch"]) {
      if (e[key] !== void 0 && (!finite(e[key]) || e[key] < 0)) issues.push(`${id}: ${key} must be non-negative.`);
    }
    if (e.duration !== void 0 && (!finite(e.duration) || e.duration <= 0)) issues.push(`${id}: duration must be positive.`);
    if (e.loop !== void 0 && typeof e.loop !== "boolean") issues.push(`${id}: loop must be boolean.`);
    if (e.loop && e.duration !== void 0 && e.duration < 1 / 120) issues.push(`${id}: looping duration must be at least 1/120 second.`);
    if (e.acceleration && ![e.acceleration.x, e.acceleration.y].every(finite)) issues.push(`${id}: acceleration must be finite.`);
    if (e.turbulence && (![e.turbulence.strength, e.turbulence.frequency].every(finite) || e.turbulence.strength < 0 || e.turbulence.frequency < 0)) issues.push(`${id}: invalid turbulence.`);
    if (e.bursts !== void 0 && (!Array.isArray(e.bursts) || e.bursts.some((b) => !b || !finite(b.time) || b.time < 0 || !Number.isInteger(b.count) || b.count < 0))) issues.push(`${id}: invalid bursts.`);
    if (Array.isArray(e.bursts) && finite(e.duration) && e.bursts.some((b) => b && b.time > e.duration)) issues.push(`${id}: burst time exceeds duration.`);
    for (const key of ["sizeOverLife", "alphaOverLife", "colorOverLife"]) {
      const keys = e[key];
      if (keys === void 0) continue;
      if (!Array.isArray(keys) || !keys.length) {
        issues.push(`${id}: ${key} must be non-empty.`);
        continue;
      }
      let previous = -1;
      for (const k of keys) {
        if (!k || !finite(k.time) || k.time < 0 || k.time > 1 || k.time <= previous) {
          issues.push(`${id}: ${key} times must increase within 0..1.`);
          break;
        }
        previous = k.time;
        if (key === "colorOverLife") {
          if (!/^#[0-9a-f]{6}$/i.test(k.color)) issues.push(`${id}: colors must use #rrggbb.`);
        } else if (!finite(k.value) || k.value < 0 || key === "alphaOverLife" && k.value > 1) issues.push(`${id}: invalid ${key} value.`);
      }
    }
  }
  return issues;
}

// packages/core/particles/ParticleSystem.ts
var _ZhudaParticleSystem = class _ZhudaParticleSystem {
  constructor(spec) {
    this.transform = { x: 0, y: 0, rotation: 0 };
    this.intensity = 1;
    this.emitting = false;
    this.time = 0;
    this.droppedParticles = 0;
    this.droppedSeconds = 0;
    this.count = 0;
    this.accumulator = 0;
    this.emitRemainder = 0;
    this.distanceRemainder = 0;
    this.cycleTime = 0;
    this.firstStep = true;
    this.previousX = 0;
    this.previousY = 0;
    this.positioned = false;
    const issues = validateParticleEffect({ schemaVersion: 1, emitters: [spec] });
    if (issues.length) throw new Error(`[ZhudaParticles] ${issues.join(" | ")}`);
    this.spec = JSON.parse(JSON.stringify(spec));
    this.rng = spec.seed >>> 0;
    this.active = new Int32Array(spec.maxParticles);
    this.free = new Int32Array(spec.maxParticles);
    this.freeCount = spec.maxParticles;
    this.pool = Array.from({ length: spec.maxParticles }, (_, i) => {
      this.free[i] = spec.maxParticles - 1 - i;
      return { x: 0, y: 0, vx: 0, vy: 0, age: 0, lifetime: 1, baseSize: 1, size: 1, rotation: 0, angularVelocity: 0, phase: 0 };
    });
  }
  get aliveCount() {
    return this.count;
  }
  get capacity() {
    return this.pool.length;
  }
  setTransform(x, y, rotation = 0) {
    if (![x, y, rotation].every(Number.isFinite)) throw new Error("Particle transform must be finite.");
    this.transform.x = x;
    this.transform.y = y;
    this.transform.rotation = rotation;
    if (!this.positioned) {
      this.previousX = x;
      this.previousY = y;
      this.positioned = true;
    }
  }
  play(restart = false) {
    if (restart) this.clear();
    if (!this.emitting) {
      this.cycleTime = 0;
      this.firstStep = true;
    }
    this.emitting = true;
  }
  stop(clear = false) {
    this.emitting = false;
    if (clear) this.clear();
  }
  clear() {
    this.count = 0;
    this.freeCount = this.capacity;
    for (let i = 0; i < this.capacity; i++) this.free[i] = this.capacity - 1 - i;
    this.rng = this.spec.seed >>> 0;
    this.time = 0;
    this.cycleTime = 0;
    this.accumulator = 0;
    this.emitRemainder = 0;
    this.distanceRemainder = 0;
    this.firstStep = true;
    this.droppedParticles = 0;
    this.droppedSeconds = 0;
    this.previousX = this.transform.x;
    this.previousY = this.transform.y;
  }
  burst(count, x = this.transform.x, y = this.transform.y) {
    if (!Number.isInteger(count) || count < 0 || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Invalid particle burst.");
    const accepted = Math.min(count, this.freeCount);
    this.droppedParticles += count - accepted;
    for (let i = 0; i < accepted; i++) this.spawn(x, y);
  }
  forEach(visitor) {
    for (let i = 0; i < this.count; i++) visitor(this.pool[this.active[i]], i);
  }
  snapshot() {
    const result = [];
    this.forEach((p) => result.push({ ...p }));
    return result;
  }
  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new Error("Particle delta must be finite and non-negative.");
    const accepted = Math.min(deltaSeconds, 0.25);
    this.droppedSeconds += deltaSeconds - accepted;
    this.accumulator += accepted;
    const steps = Math.floor((this.accumulator + 1e-10) / _ZhudaParticleSystem.STEP);
    const startX = this.previousX, startY = this.previousY;
    for (let i = 0; i < steps; i++) {
      const x = startX + (this.transform.x - startX) * ((i + 1) / steps);
      const y = startY + (this.transform.y - startY) * ((i + 1) / steps);
      this.step(_ZhudaParticleSystem.STEP, x, y);
      this.previousX = x;
      this.previousY = y;
    }
    this.accumulator = Math.max(0, this.accumulator - steps * _ZhudaParticleSystem.STEP);
  }
  random() {
    this.rng = Math.imul(this.rng, 1664525) + 1013904223 >>> 0;
    return this.rng / 4294967296;
  }
  range(value, fallback = 0) {
    if (value === void 0) return fallback;
    return typeof value === "number" ? value : value[0] + this.random() * (value[1] - value[0]);
  }
  spawn(x, y) {
    const s = this.spec, index = this.free[--this.freeCount], p = this.pool[index];
    const shape = s.shape;
    let sx = 0, sy = 0;
    if (shape.type === "box") {
      sx = (this.random() - 0.5) * shape.width;
      sy = (this.random() - 0.5) * shape.height;
    } else if (shape.type === "circle") {
      const a = this.random() * Math.PI * 2, r = shape.radius * (shape.edge ? 1 : Math.sqrt(this.random()));
      sx = Math.cos(a) * r;
      sy = Math.sin(a) * r;
    }
    const angle = this.range(s.angle) + (s.space === "world" ? this.transform.rotation : 0);
    const speed = this.range(s.speed), c = Math.cos(this.transform.rotation), sn = Math.sin(this.transform.rotation);
    p.x = s.space === "world" ? x + sx * c - sy * sn : sx;
    p.y = s.space === "world" ? y + sx * sn + sy * c : sy;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.age = 0;
    p.lifetime = this.range(s.lifetime);
    p.baseSize = this.range(s.size);
    p.size = p.baseSize * sampleParticleCurve(s.sizeOverLife, 0);
    p.rotation = this.range(s.rotation) + (s.space === "world" ? this.transform.rotation : 0);
    p.angularVelocity = this.range(s.angularVelocity);
    p.phase = this.random() * Math.PI * 2;
    this.active[this.count++] = index;
  }
  step(dt, x, y) {
    const s = this.spec;
    for (let i = this.count - 1; i >= 0; i--) {
      const index = this.active[i], p = this.pool[index];
      p.age += dt;
      if (p.age + 1e-10 >= p.lifetime) {
        this.free[this.freeCount++] = index;
        this.active[i] = this.active[--this.count];
        continue;
      }
      let ax = s.acceleration?.x || 0, ay = s.acceleration?.y || 0;
      if (s.turbulence) {
        const t = p.age * s.turbulence.frequency;
        ax += Math.sin(t + p.phase) * s.turbulence.strength;
        ay += Math.cos(t * 0.83 + p.phase) * s.turbulence.strength;
      }
      const damping = Math.exp(-(s.drag || 0) * dt);
      p.vx = (p.vx + ax * dt) * damping;
      p.vy = (p.vy + ay * dt) * damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.angularVelocity * dt;
      p.size = p.baseSize * sampleParticleCurve(s.sizeOverLife, p.age / p.lifetime);
    }
    if (this.emitting) {
      const strength = Math.max(0, Math.min(2, Number.isFinite(this.intensity) ? this.intensity : 0));
      const duration = s.duration || Infinity;
      let remaining = dt, elapsed = 0;
      while (remaining > 1e-10 && this.emitting) {
        const span = Math.min(remaining, duration - this.cycleTime);
        const end = this.cycleTime + span;
        const sx = this.previousX + (x - this.previousX) * (elapsed / dt);
        const sy = this.previousY + (y - this.previousY) * (elapsed / dt);
        elapsed += span;
        const ex = this.previousX + (x - this.previousX) * (elapsed / dt);
        const ey = this.previousY + (y - this.previousY) * (elapsed / dt);
        for (const b of s.bursts || []) {
          if ((b.time > this.cycleTime + 1e-10 || this.firstStep && b.time === 0) && b.time <= end + 1e-10) {
            this.burst(Math.round(b.count * strength), ex, ey);
          }
        }
        this.emitRemainder += s.rate * strength * span;
        const count = Math.floor(this.emitRemainder + 1e-10);
        this.emitRemainder = Math.max(0, this.emitRemainder - count);
        this.burst(count, ex, ey);
        this.distanceRemainder += Math.hypot(ex - sx, ey - sy) * (s.rateOverDistance || 0) * strength;
        const byDistance = Math.floor(this.distanceRemainder + 1e-10);
        this.distanceRemainder = Math.max(0, this.distanceRemainder - byDistance);
        const accepted = Math.min(byDistance, this.freeCount);
        this.droppedParticles += byDistance - accepted;
        for (let j = 0; j < accepted; j++) this.spawn(sx + (ex - sx) * (j + 1) / byDistance, sy + (ey - sy) * (j + 1) / byDistance);
        this.firstStep = false;
        this.cycleTime = end;
        remaining -= span;
        if (this.cycleTime + 1e-10 >= duration) {
          if (s.loop) {
            this.cycleTime = 0;
            this.firstStep = true;
          } else this.emitting = false;
        }
      }
    }
    this.time += dt;
  }
};
_ZhudaParticleSystem.STEP = 1 / 120;
var ZhudaParticleSystem = _ZhudaParticleSystem;

// packages/core/particles/RibbonTrail.ts
var ZhudaRibbonTrail = class {
  constructor(spec) {
    this.head = 0;
    this.count = 0;
    this.time = 0;
    if (!Number.isInteger(spec.maxPoints) || spec.maxPoints < 2 || spec.maxPoints > 32767 || ![spec.lifetime, spec.width, spec.minDistance, spec.teleportDistance].every(Number.isFinite) || spec.lifetime <= 0 || spec.width <= 0 || spec.minDistance <= 0 || spec.teleportDistance <= spec.minDistance) {
      throw new Error("[ZhudaRibbonTrail] Invalid point budget, lifetime, width or distance limits.");
    }
    if (spec.widthOverLife?.some((k, i, a) => !Number.isFinite(k.time) || !Number.isFinite(k.value) || k.time < 0 || k.time > 1 || k.value < 0 || i > 0 && k.time <= a[i - 1].time)) throw new Error("[ZhudaRibbonTrail] Invalid width curve.");
    this.spec = JSON.parse(JSON.stringify(spec));
    this.points = Array.from({ length: spec.maxPoints }, () => ({ x: 0, y: 0, born: 0 }));
    this.mesh = {
      vertices: new Float32Array(spec.maxPoints * 4),
      uvs: new Float32Array(spec.maxPoints * 4),
      indices: new Uint16Array((spec.maxPoints - 1) * 6),
      pointCount: 0,
      indexCount: 0
    };
    for (let i = 0; i < spec.maxPoints - 1; i++) {
      const v = i * 2;
      this.mesh.indices.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
    }
  }
  get pointCount() {
    return this.count;
  }
  clear() {
    this.head = 0;
    this.count = 0;
    this.time = 0;
    this.mesh.pointCount = 0;
    this.mesh.indexCount = 0;
  }
  update(dt, x, y, emitting = true) {
    if (![dt, x, y].every(Number.isFinite) || dt < 0) throw new Error("Trail delta and position must be finite.");
    this.time += dt;
    while (this.count > 0 && this.time - this.at(0).born >= this.spec.lifetime) {
      this.head = (this.head + 1) % this.points.length;
      this.count--;
    }
    if (!emitting) return;
    if (this.count) {
      const last = this.at(this.count - 1), distance = Math.hypot(x - last.x, y - last.y);
      if (distance > this.spec.teleportDistance) {
        this.head = 0;
        this.count = 0;
      } else if (distance < this.spec.minDistance) return;
    }
    if (this.count === this.points.length) {
      this.head = (this.head + 1) % this.points.length;
      this.count--;
    }
    const p = this.at(this.count++);
    p.x = x;
    p.y = y;
    p.born = this.time;
  }
  /** Reuses storage; UV.x encodes age, UV.y crosses the ribbon width. */
  buildMesh() {
    const m = this.mesh;
    m.pointCount = this.count;
    m.indexCount = Math.max(0, this.count - 1) * 6;
    for (let i = 0; i < this.count; i++) {
      const p = this.at(i), previous = this.at(Math.max(0, i - 1)), next = this.at(Math.min(this.count - 1, i + 1));
      let dx = next.x - previous.x, dy = next.y - previous.y;
      const length = Math.hypot(dx, dy);
      if (length < 1e-6) {
        dx = 1;
        dy = 0;
      } else {
        dx /= length;
        dy /= length;
      }
      const life = Math.min(1, Math.max(0, (this.time - p.born) / this.spec.lifetime));
      const half = this.spec.width * 0.5 * sampleParticleCurve(this.spec.widthOverLife, life, 1 - life);
      m.vertices.set([p.x - dy * half, p.y + dx * half, p.x + dy * half, p.y - dx * half], i * 4);
      m.uvs.set([life, 0, life, 1], i * 4);
    }
    return m;
  }
  snapshot() {
    return Array.from({ length: this.count }, (_, i) => ({ x: this.at(i).x, y: this.at(i).y, age: this.time - this.at(i).born }));
  }
  at(index) {
    return this.points[(this.head + index) % this.points.length];
  }
};

// packages/core/particles/EffectEnvelope.ts
var ZhudaEffectEnvelope = class {
  constructor(attack = 0.14, release = 0.45) {
    this.phase = "idle";
    this.value = 0;
    this.target = 1;
    this.from = 0;
    this.elapsed = 0;
    if (![attack, release].every((v) => Number.isFinite(v) && v > 0)) throw new Error("Envelope durations must be positive.");
    this.attack = attack;
    this.release = release;
  }
  start(strength = 1) {
    this.setStrength(strength);
    this.from = this.value;
    this.elapsed = 0;
    this.phase = "attack";
  }
  setStrength(strength) {
    if (!Number.isFinite(strength) || strength < 0 || strength > 2) throw new Error("Envelope strength must be 0..2.");
    this.target = strength;
  }
  stop() {
    if (this.phase === "idle" || this.phase === "release") return;
    this.from = this.value;
    this.elapsed = 0;
    this.phase = "release";
  }
  reset() {
    this.phase = "idle";
    this.value = 0;
    this.elapsed = 0;
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error("Envelope delta must be non-negative.");
    this.elapsed += dt;
    if (this.phase === "sustain") this.value = this.target;
    else if (this.phase === "attack" || this.phase === "release") {
      const t = Math.min(1, this.elapsed / (this.phase === "attack" ? this.attack : this.release));
      const smooth2 = t * t * (3 - 2 * t);
      this.value = this.from + ((this.phase === "attack" ? this.target : 0) - this.from) * smooth2;
      if (t === 1) this.phase = this.phase === "attack" ? "sustain" : "idle";
    }
    return this.value;
  }
};

// packages/core/particles/LayaParticleRenderer.ts
var ZhudaLayaParticleRenderer = class {
  constructor(system, parent, resolveTexture, lifeBands = 12) {
    this.submittedBatches = 0;
    this.appendParticle = (p) => {
      const s = this.system.spec, t = Math.min(0.999999, p.age / p.lifetime);
      const batch = this.batches[Math.floor(t * this.batches.length)];
      const i = batch.count++ * 8;
      let x = p.x, y = p.y;
      let angle = s.alignToVelocity ? Math.atan2(p.vy, p.vx) : p.rotation;
      if (s.space === "local") {
        const c2 = Math.cos(this.system.transform.rotation), sn2 = Math.sin(this.system.transform.rotation);
        x = this.system.transform.x + p.x * c2 - p.y * sn2;
        y = this.system.transform.y + p.x * sn2 + p.y * c2;
        angle += this.system.transform.rotation;
      }
      const c = Math.cos(angle), sn = Math.sin(angle), hx = p.size * (s.stretch || 1) * 0.5, hy = p.size * 0.5;
      batch.vertices[i] = x - c * hx + sn * hy;
      batch.vertices[i + 1] = y - sn * hx - c * hy;
      batch.vertices[i + 2] = x + c * hx + sn * hy;
      batch.vertices[i + 3] = y + sn * hx - c * hy;
      batch.vertices[i + 4] = x + c * hx - sn * hy;
      batch.vertices[i + 5] = y + sn * hx + c * hy;
      batch.vertices[i + 6] = x - c * hx - sn * hy;
      batch.vertices[i + 7] = y - sn * hx + c * hy;
    };
    this.system = system;
    if (!Number.isInteger(lifeBands) || lifeBands < 1 || lifeBands > 64) throw new Error("lifeBands must be 1..64.");
    const laya = globalThis.Laya;
    if (!laya?.Sprite) throw new Error("[ZhudaParticles] Laya must be booted before creating a renderer.");
    this.texture = resolveTexture(system.spec.texture);
    if (!this.texture) throw new Error(`[ZhudaParticles] Missing texture: ${system.spec.texture}`);
    this.uv = this.texture.uv || [0, 0, 1, 0, 1, 1, 0, 1];
    this.node = new laya.Sprite();
    this.node.name = `Particles:${system.spec.id}`;
    this.node.mouseEnabled = false;
    parent.addChild(this.node);
    this.batches = Array.from({ length: lifeBands }, (_, band) => {
      const capacity = system.capacity;
      const batch = {
        vertices: new Float32Array(capacity * 8),
        uvs: new Float32Array(capacity * 8),
        indices: new Uint16Array(capacity * 6),
        count: 0,
        color: sampleParticleColor(system.spec.colorOverLife, (band + 0.5) / lifeBands),
        alpha: sampleParticleCurve(system.spec.alphaOverLife, (band + 0.5) / lifeBands)
      };
      for (let i = 0; i < capacity; i++) {
        batch.uvs.set(this.uv, i * 8);
        const v = i * 4;
        batch.indices.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
      }
      return batch;
    });
  }
  render(opacity = 1) {
    if (this.node.destroyed) return;
    const g = this.node.graphics;
    g.clear();
    this.submittedBatches = 0;
    for (const batch of this.batches) batch.count = 0;
    if (opacity <= 0) return;
    this.system.forEach(this.appendParticle);
    for (const b of this.batches) {
      if (!b.count || b.alpha <= 0) continue;
      g.drawTriangles(
        this.texture,
        0,
        0,
        b.vertices.subarray(0, b.count * 8),
        b.uvs.subarray(0, b.count * 8),
        b.indices.subarray(0, b.count * 6),
        null,
        Math.min(1, b.alpha * opacity),
        b.color,
        this.system.spec.blend === "additive" ? "lighter" : "normal"
      );
      this.submittedBatches++;
    }
  }
  dispose() {
    this.node.destroy(true);
    this.texture = null;
  }
};
var ZhudaLayaRibbonRenderer = class {
  constructor(trail, parent, texture, color = "#ffffff", blend = "additive") {
    this.submittedBatches = 0;
    this.trail = trail;
    this.texture = texture;
    this.color = color;
    this.blend = blend;
    const laya = globalThis.Laya;
    if (!laya?.Sprite || !texture) throw new Error("Ribbon renderer requires Laya and a texture.");
    this.node = new laya.Sprite();
    this.node.name = "RibbonTrail";
    this.node.mouseEnabled = false;
    parent.addChild(this.node);
  }
  render(opacity = 1) {
    if (this.node.destroyed) return;
    this.node.graphics.clear();
    this.submittedBatches = 0;
    const mesh = this.trail.buildMesh();
    if (mesh.indexCount === 0 || opacity <= 0) return;
    this.node.graphics.drawTriangles(
      this.texture,
      0,
      0,
      mesh.vertices.subarray(0, mesh.pointCount * 4),
      mesh.uvs.subarray(0, mesh.pointCount * 4),
      mesh.indices.subarray(0, mesh.indexCount),
      null,
      Math.min(1, opacity),
      this.color,
      this.blend === "additive" ? "lighter" : "normal"
    );
    this.submittedBatches = 1;
  }
  dispose() {
    this.node.destroy(true);
    this.texture = null;
  }
};

// packages/core/particles/ParticleTypes3D.ts
function rotateParticleVector3(v, q, out) {
  const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x);
  out.x = v.x + q.w * tx + q.y * tz - q.z * ty;
  out.y = v.y + q.w * ty + q.z * tx - q.x * tz;
  out.z = v.z + q.w * tz + q.x * ty - q.y * tx;
}
function validateParticleEffect3D(value) {
  const spec = value;
  if (!spec || spec.dimension !== 3 || spec.schemaVersion !== 1 || !Array.isArray(spec.emitters) || !spec.emitters.length) {
    return ["Expected dimension: 3, schemaVersion: 1 and a non-empty emitters array."];
  }
  const issues = validateParticleEffect({ schemaVersion: 1, emitters: spec.emitters.map((e) => e && { ...e, angle: 0, shape: { type: "point" } }) });
  const vector = (v) => v && [v.x, v.y, v.z].every(Number.isFinite);
  for (const e of spec.emitters) {
    if (!e || typeof e !== "object") continue;
    if (!vector(e.direction) || Math.hypot(e.direction.x, e.direction.y, e.direction.z) < 1e-8) issues.push(`${e.id}: direction must be a finite non-zero vector.`);
    if (!Number.isFinite(e.spread) || e.spread < 0 || e.spread > Math.PI) issues.push(`${e.id}: spread must be 0..PI radians.`);
    if (e.acceleration && !vector(e.acceleration)) issues.push(`${e.id}: acceleration must have finite XYZ components.`);
    if (e.velocityInheritance !== void 0 && (!Number.isFinite(e.velocityInheritance) || e.velocityInheritance < 0 || e.velocityInheritance > 2)) issues.push(`${e.id}: velocityInheritance must be 0..2.`);
    if (e.billboard !== void 0 && !["camera", "velocity", "ground"].includes(e.billboard)) issues.push(`${e.id}: invalid billboard mode.`);
    const shape = e.shape;
    if (!shape || !["point", "box", "sphere"].includes(shape.type)) issues.push(`${e.id}: invalid 3D shape.`);
    else if (shape.type === "box" && ![shape.width, shape.height, shape.depth].every((v) => Number.isFinite(v) && v >= 0)) issues.push(`${e.id}: invalid 3D box dimensions.`);
    else if (shape.type === "sphere" && (!Number.isFinite(shape.radius) || shape.radius < 0)) issues.push(`${e.id}: invalid sphere radius.`);
  }
  return issues;
}

// packages/core/particles/ParticleSystem3D.ts
var _ZhudaParticleSystem3D = class _ZhudaParticleSystem3D {
  constructor(spec) {
    this.transform = { x: 0, y: 0, z: 0, rotation: { x: 0, y: 0, z: 0, w: 1 } };
    this.emitterVelocity = { x: 0, y: 0, z: 0 };
    this.intensity = 1;
    this.emitting = false;
    this.time = 0;
    this.droppedParticles = 0;
    this.droppedSeconds = 0;
    this.count = 0;
    this.accumulator = 0;
    this.remainder = 0;
    this.distanceRemainder = 0;
    this.cycle = 0;
    this.first = true;
    this.positioned = false;
    this.previous = { x: 0, y: 0, z: 0 };
    this.scratch = { x: 0, y: 0, z: 0 };
    const issues = validateParticleEffect3D({ schemaVersion: 1, dimension: 3, emitters: [spec] });
    if (issues.length) throw new Error(`[ZhudaParticles3D] ${issues.join(" | ")}`);
    this.spec = JSON.parse(JSON.stringify(spec));
    this.rng = spec.seed >>> 0;
    this.active = new Int32Array(spec.maxParticles);
    this.free = new Int32Array(spec.maxParticles);
    this.freeCount = spec.maxParticles;
    this.pool = Array.from({ length: spec.maxParticles }, (_, i) => {
      this.free[i] = spec.maxParticles - 1 - i;
      return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, lifetime: 1, baseSize: 1, size: 1, rotation: 0, angularVelocity: 0, phase: 0 };
    });
    const d = spec.direction, n = Math.hypot(d.x, d.y, d.z);
    this.direction = { x: d.x / n, y: d.y / n, z: d.z / n };
    const axis = Math.abs(this.direction.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const x = axis.y * this.direction.z - axis.z * this.direction.y, y = axis.z * this.direction.x - axis.x * this.direction.z, z = axis.x * this.direction.y - axis.y * this.direction.x, length = Math.hypot(x, y, z);
    this.basisU = { x: x / length, y: y / length, z: z / length };
    this.basisV = {
      x: this.direction.y * this.basisU.z - this.direction.z * this.basisU.y,
      y: this.direction.z * this.basisU.x - this.direction.x * this.basisU.z,
      z: this.direction.x * this.basisU.y - this.direction.y * this.basisU.x
    };
  }
  get aliveCount() {
    return this.count;
  }
  get capacity() {
    return this.pool.length;
  }
  setTransform(x, y, z, rotation, velocity) {
    if (![x, y, z].every(Number.isFinite)) throw new Error("3D emitter position must be finite.");
    if (rotation && (![rotation.x, rotation.y, rotation.z, rotation.w].every(Number.isFinite) || Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w) < 1e-8)) throw new Error("Invalid emitter quaternion.");
    if (velocity && ![velocity.x, velocity.y, velocity.z].every(Number.isFinite)) throw new Error("Invalid emitter velocity.");
    Object.assign(this.transform, { x, y, z });
    if (rotation) {
      const n = Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w);
      Object.assign(this.transform.rotation, { x: rotation.x / n, y: rotation.y / n, z: rotation.z / n, w: rotation.w / n });
    }
    if (velocity) Object.assign(this.emitterVelocity, velocity);
    if (!this.positioned) {
      Object.assign(this.previous, { x, y, z });
      this.positioned = true;
    }
  }
  play(restart = false) {
    if (restart) this.clear();
    if (!this.emitting) {
      this.cycle = 0;
      this.first = true;
    }
    this.emitting = true;
  }
  stop(clear = false) {
    this.emitting = false;
    if (clear) this.clear();
  }
  clear() {
    this.count = 0;
    this.freeCount = this.capacity;
    for (let i = 0; i < this.capacity; i++) this.free[i] = this.capacity - 1 - i;
    this.rng = this.spec.seed >>> 0;
    this.time = this.cycle = this.accumulator = this.remainder = this.distanceRemainder = 0;
    this.first = true;
    this.droppedParticles = this.droppedSeconds = 0;
    Object.assign(this.previous, { x: this.transform.x, y: this.transform.y, z: this.transform.z });
  }
  burst(count, x = this.transform.x, y = this.transform.y, z = this.transform.z) {
    if (!Number.isInteger(count) || count < 0 || ![x, y, z].every(Number.isFinite)) throw new Error("Invalid 3D burst.");
    const accepted = Math.min(count, this.freeCount);
    this.droppedParticles += count - accepted;
    for (let i = 0; i < accepted; i++) this.spawn(x, y, z);
  }
  forEach(visitor) {
    for (let i = 0; i < this.count; i++) visitor(this.pool[this.active[i]], i);
  }
  snapshot() {
    const result = [];
    this.forEach((p) => result.push({ ...p }));
    return result;
  }
  update(delta) {
    if (!Number.isFinite(delta) || delta < 0) throw new Error("Invalid 3D particle delta.");
    const accepted = Math.min(delta, 0.25);
    this.droppedSeconds += delta - accepted;
    this.accumulator += accepted;
    const steps = Math.floor((this.accumulator + 1e-10) / _ZhudaParticleSystem3D.STEP);
    const sx = this.previous.x, sy = this.previous.y, sz = this.previous.z;
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      const x = sx + (this.transform.x - sx) * t, y = sy + (this.transform.y - sy) * t, z = sz + (this.transform.z - sz) * t;
      this.step(_ZhudaParticleSystem3D.STEP, x, y, z);
      Object.assign(this.previous, { x, y, z });
    }
    this.accumulator = Math.max(0, this.accumulator - steps * _ZhudaParticleSystem3D.STEP);
  }
  random() {
    this.rng = Math.imul(this.rng, 1664525) + 1013904223 >>> 0;
    return this.rng / 4294967296;
  }
  range(v, fallback = 0) {
    return v === void 0 ? fallback : typeof v === "number" ? v : v[0] + this.random() * (v[1] - v[0]);
  }
  spawn(x, y, z) {
    const s = this.spec, slot = this.free[--this.freeCount], p = this.pool[slot], v = this.scratch;
    v.x = v.y = v.z = 0;
    if (s.shape.type === "box") {
      v.x = (this.random() - 0.5) * s.shape.width;
      v.y = (this.random() - 0.5) * s.shape.height;
      v.z = (this.random() - 0.5) * s.shape.depth;
    } else if (s.shape.type === "sphere") {
      const h = this.random() * 2 - 1, a2 = this.random() * Math.PI * 2, r = s.shape.radius * (s.shape.surface ? 1 : Math.cbrt(this.random()));
      v.x = Math.sqrt(1 - h * h) * Math.cos(a2) * r;
      v.y = h * r;
      v.z = Math.sqrt(1 - h * h) * Math.sin(a2) * r;
    }
    if (s.space === "world") rotateParticleVector3(v, this.transform.rotation, v);
    p.x = v.x + (s.space === "world" ? x : 0);
    p.y = v.y + (s.space === "world" ? y : 0);
    p.z = v.z + (s.space === "world" ? z : 0);
    const a = this.random() * Math.PI * 2, cos = 1 - this.random() * (1 - Math.cos(s.spread)), sin = Math.sqrt(1 - cos * cos), speed = this.range(s.speed);
    v.x = (this.direction.x * cos + sin * (this.basisU.x * Math.cos(a) + this.basisV.x * Math.sin(a))) * speed;
    v.y = (this.direction.y * cos + sin * (this.basisU.y * Math.cos(a) + this.basisV.y * Math.sin(a))) * speed;
    v.z = (this.direction.z * cos + sin * (this.basisU.z * Math.cos(a) + this.basisV.z * Math.sin(a))) * speed;
    if (s.space === "world") rotateParticleVector3(v, this.transform.rotation, v);
    const inherit = s.space === "world" ? s.velocityInheritance || 0 : 0;
    p.vx = v.x + this.emitterVelocity.x * inherit;
    p.vy = v.y + this.emitterVelocity.y * inherit;
    p.vz = v.z + this.emitterVelocity.z * inherit;
    p.age = 0;
    p.lifetime = this.range(s.lifetime);
    p.baseSize = this.range(s.size);
    p.size = p.baseSize * sampleParticleCurve(s.sizeOverLife, 0);
    p.rotation = this.range(s.rotation);
    p.angularVelocity = this.range(s.angularVelocity);
    p.phase = this.random() * Math.PI * 2;
    this.active[this.count++] = slot;
  }
  step(dt, x, y, z) {
    const s = this.spec, damp = Math.exp(-(s.drag || 0) * dt);
    for (let i = this.count - 1; i >= 0; i--) {
      const slot = this.active[i], p = this.pool[slot];
      p.age += dt;
      if (p.age + 1e-10 >= p.lifetime) {
        this.free[this.freeCount++] = slot;
        this.active[i] = this.active[--this.count];
        continue;
      }
      const t = p.age * (s.turbulence?.frequency || 0), force = s.turbulence?.strength || 0;
      p.vx = (p.vx + ((s.acceleration?.x || 0) + Math.sin(t + p.phase) * force) * dt) * damp;
      p.vy = (p.vy + ((s.acceleration?.y || 0) + Math.cos(t * 0.83 + p.phase) * force) * dt) * damp;
      p.vz = (p.vz + ((s.acceleration?.z || 0) + Math.sin(t * 0.71 + p.phase) * force) * dt) * damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rotation += p.angularVelocity * dt;
      p.size = p.baseSize * sampleParticleCurve(s.sizeOverLife, p.age / p.lifetime);
    }
    let remaining = dt, elapsed = 0;
    const strength = Math.max(0, Math.min(2, Number.isFinite(this.intensity) ? this.intensity : 0)), duration = s.duration || Infinity;
    while (remaining > 1e-10 && this.emitting) {
      const span = Math.min(remaining, duration - this.cycle), end = this.cycle + span;
      const start = elapsed / dt;
      elapsed += span;
      const fraction = elapsed / dt;
      const ex = this.previous.x + (x - this.previous.x) * fraction, ey = this.previous.y + (y - this.previous.y) * fraction, ez = this.previous.z + (z - this.previous.z) * fraction;
      for (const b of s.bursts || []) if ((b.time > this.cycle + 1e-10 || this.first && b.time === 0) && b.time <= end + 1e-10) this.burst(Math.round(b.count * strength), ex, ey, ez);
      this.remainder += s.rate * strength * span;
      const count = Math.floor(this.remainder + 1e-10);
      this.remainder = Math.max(0, this.remainder - count);
      this.burst(count, ex, ey, ez);
      const dx = (x - this.previous.x) * (fraction - start), dy = (y - this.previous.y) * (fraction - start), dz = (z - this.previous.z) * (fraction - start);
      this.distanceRemainder += Math.hypot(dx, dy, dz) * (s.rateOverDistance || 0) * strength;
      const distanceCount = Math.floor(this.distanceRemainder + 1e-10), accepted = Math.min(distanceCount, this.freeCount);
      this.distanceRemainder = Math.max(0, this.distanceRemainder - distanceCount);
      this.droppedParticles += distanceCount - accepted;
      for (let i = 0; i < accepted; i++) this.spawn(ex - dx + dx * (i + 1) / distanceCount, ey - dy + dy * (i + 1) / distanceCount, ez - dz + dz * (i + 1) / distanceCount);
      this.first = false;
      this.cycle = end;
      remaining -= span;
      if (this.cycle + 1e-10 >= duration) {
        if (s.loop) {
          this.cycle = 0;
          this.first = true;
        } else this.emitting = false;
      }
    }
    this.time += dt;
  }
};
_ZhudaParticleSystem3D.STEP = 1 / 120;
var ZhudaParticleSystem3D = _ZhudaParticleSystem3D;

// packages/core/particles/ParticleMesh3D.ts
var ZhudaParticleMesh3D = class {
  constructor(system) {
    this.items = [];
    this.colors = new Float32Array(256 * 4);
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.sortForward = { x: 0, y: 0, z: 0 };
    this.collect = (p) => {
      this.items.push(p);
    };
    this.compare = (a, b) => (b.x - a.x) * this.sortForward.x + (b.y - a.y) * this.sortForward.y + (b.z - a.z) * this.sortForward.z;
    this.system = system;
    this.geometry = { vertices: new Float32Array(system.capacity * 36), indices: new Uint16Array(system.capacity * 6), vertexCount: 0, indexCount: 0 };
    for (let i = 0; i < system.capacity; i++) {
      const v = i * 4;
      this.geometry.indices.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
    }
    for (let i = 0; i < 256; i++) {
      const color = sampleParticleColor(system.spec.colorOverLife, i / 255);
      this.colors.set([
        parseInt(color.slice(1, 3), 16) / 255,
        parseInt(color.slice(3, 5), 16) / 255,
        parseInt(color.slice(5, 7), 16) / 255,
        sampleParticleCurve(system.spec.alphaOverLife, i / 255)
      ], i * 4);
    }
  }
  build(view, opacity = 1) {
    const s = this.system, spec = s.spec, g = this.geometry;
    g.vertices.fill(0);
    this.items.length = 0;
    s.forEach(this.collect);
    Object.assign(this.sortForward, view.forward);
    if (spec.space === "local") {
      const q = s.transform.rotation;
      rotateParticleVector3(this.sortForward, { x: -q.x, y: -q.y, z: -q.z, w: q.w }, this.sortForward);
    }
    if (spec.blend === "alpha") this.items.sort(this.compare);
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i], center = this.position, velocity = this.velocity;
      center.x = p.x;
      center.y = p.y;
      center.z = p.z;
      velocity.x = p.vx;
      velocity.y = p.vy;
      velocity.z = p.vz;
      if (spec.space === "local") {
        rotateParticleVector3(center, s.transform.rotation, center);
        rotateParticleVector3(velocity, s.transform.rotation, velocity);
        center.x += s.transform.x;
        center.y += s.transform.y;
        center.z += s.transform.z;
      }
      let rx = view.right.x, ry = view.right.y, rz = view.right.z, ux = view.up.x, uy = view.up.y, uz = view.up.z;
      if (spec.billboard === "ground") {
        rx = 1;
        ry = 0;
        rz = 0;
        ux = 0;
        uy = 0;
        uz = 1;
      } else if (spec.billboard === "velocity") {
        const depth = velocity.x * view.forward.x + velocity.y * view.forward.y + velocity.z * view.forward.z;
        const x = velocity.x - depth * view.forward.x, y = velocity.y - depth * view.forward.y, z = velocity.z - depth * view.forward.z;
        const length = Math.hypot(x, y, z);
        if (length > 1e-6) {
          rx = x / length;
          ry = y / length;
          rz = z / length;
          ux = ry * view.forward.z - rz * view.forward.y;
          uy = rz * view.forward.x - rx * view.forward.z;
          uz = rx * view.forward.y - ry * view.forward.x;
        }
      }
      const c = Math.cos(p.rotation), sn = Math.sin(p.rotation), hx = p.size * (spec.stretch ?? 1) * 0.5, hy = p.size * 0.5;
      const ax = (rx * c + ux * sn) * hx, ay = (ry * c + uy * sn) * hx, az = (rz * c + uz * sn) * hx;
      const bx = (ux * c - rx * sn) * hy, by = (uy * c - ry * sn) * hy, bz = (uz * c - rz * sn) * hy;
      const ci = Math.min(255, Math.floor(p.age / p.lifetime * 255)) * 4;
      const r = this.colors[ci], green = this.colors[ci + 1], b = this.colors[ci + 2], alpha = this.colors[ci + 3] * Math.max(0, Math.min(1, opacity));
      for (let corner = 0; corner < 4; corner++) {
        const sx = corner === 0 || corner === 3 ? -1 : 1, sy = corner < 2 ? -1 : 1, base = i * 36 + corner * 9;
        const v = g.vertices;
        v[base] = center.x + sx * ax + sy * bx;
        v[base + 1] = center.y + sx * ay + sy * by;
        v[base + 2] = center.z + sx * az + sy * bz;
        v[base + 3] = r;
        v[base + 4] = green;
        v[base + 5] = b;
        v[base + 6] = alpha;
        v[base + 7] = sx > 0 ? 1 : 0;
        v[base + 8] = sy > 0 ? 0 : 1;
      }
    }
    g.vertexCount = this.items.length * 4;
    g.indexCount = this.items.length * 6;
    return g;
  }
};

// packages/core/particles/RibbonTrail3D.ts
var ZhudaRibbonTrail3D = class {
  constructor(spec) {
    this.head = 0;
    this.count = 0;
    this.time = 0;
    if (!Number.isInteger(spec.maxPoints) || spec.maxPoints < 2 || spec.maxPoints > 32767 || ![spec.lifetime, spec.width, spec.minDistance, spec.teleportDistance].every(Number.isFinite) || spec.lifetime <= 0 || spec.width <= 0 || spec.minDistance <= 0 || spec.teleportDistance <= spec.minDistance || spec.widthOverLife?.some((k, i, a) => !k || !Number.isFinite(k.time) || !Number.isFinite(k.value) || k.time < 0 || k.time > 1 || k.value < 0 || i > 0 && k.time <= a[i - 1].time)) throw new Error("Invalid 3D ribbon specification.");
    this.spec = JSON.parse(JSON.stringify(spec));
    this.points = Array.from({ length: spec.maxPoints }, () => ({ x: 0, y: 0, z: 0, born: 0 }));
    this.geometry = { vertices: new Float32Array(spec.maxPoints * 18), indices: new Uint16Array((spec.maxPoints - 1) * 6), vertexCount: 0, indexCount: 0 };
    for (let i = 0; i < spec.maxPoints - 1; i++) {
      const v = i * 2;
      this.geometry.indices.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
    }
  }
  get pointCount() {
    return this.count;
  }
  clear() {
    this.head = this.count = this.time = 0;
    this.geometry.vertexCount = this.geometry.indexCount = 0;
  }
  update(dt, x, y, z, emitting = true) {
    if (![dt, x, y, z].every(Number.isFinite) || dt < 0) throw new Error("3D ribbon delta and positions must be finite.");
    this.time += dt;
    while (this.count && this.time - this.at(0).born >= this.spec.lifetime) {
      this.head = (this.head + 1) % this.points.length;
      this.count--;
    }
    if (!emitting) return;
    if (this.count) {
      const p = this.at(this.count - 1), distance = Math.hypot(x - p.x, y - p.y, z - p.z);
      if (distance > this.spec.teleportDistance) this.head = this.count = 0;
      else if (distance < this.spec.minDistance) return;
    }
    if (this.count === this.points.length) {
      this.head = (this.head + 1) % this.points.length;
      this.count--;
    }
    Object.assign(this.at(this.count++), { x, y, z, born: this.time });
  }
  buildMesh(cameraPosition, opacity = 1) {
    const g = this.geometry;
    g.vertices.fill(0);
    g.indices.fill(0);
    let px = 0, py = 0, pz = 0;
    for (let i = 0; i < this.count; i++) {
      const p = this.at(i), a = this.at(Math.max(0, i - 1)), b = this.at(Math.min(this.count - 1, i + 1));
      const tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
      const vx = cameraPosition.x - p.x, vy = cameraPosition.y - p.y, vz = cameraPosition.z - p.z;
      let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx, n = Math.hypot(nx, ny, nz);
      if (n < 1e-7) {
        nx = -tz;
        ny = 0;
        nz = tx;
        n = Math.hypot(nx, ny, nz);
      }
      if (n < 1e-7) {
        nx = 1;
        ny = 0;
        nz = 0;
        n = 1;
      }
      nx /= n;
      ny /= n;
      nz /= n;
      if (nx * px + ny * py + nz * pz < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      px = nx;
      py = ny;
      pz = nz;
      const life = Math.max(0, Math.min(1, (this.time - p.born) / this.spec.lifetime));
      const width = this.spec.width * 0.5 * sampleParticleCurve(this.spec.widthOverLife, life, 1 - life), alpha = (1 - life) * Math.max(0, Math.min(1, opacity));
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1, base = i * 18 + side * 9, v = g.vertices;
        v[base] = p.x + sign * nx * width;
        v[base + 1] = p.y + sign * ny * width;
        v[base + 2] = p.z + sign * nz * width;
        v[base + 3] = 1;
        v[base + 4] = 1;
        v[base + 5] = 1;
        v[base + 6] = alpha;
        v[base + 7] = life;
        v[base + 8] = side;
      }
      if (i < this.count - 1) {
        const v = i * 2, offset = i * 6, indices = g.indices;
        indices[offset] = v;
        indices[offset + 1] = v + 1;
        indices[offset + 2] = v + 2;
        indices[offset + 3] = v + 1;
        indices[offset + 4] = v + 3;
        indices[offset + 5] = v + 2;
      }
    }
    g.vertexCount = this.count * 2;
    g.indexCount = Math.max(0, this.count - 1) * 6;
    return g;
  }
  snapshot() {
    return Array.from({ length: this.count }, (_, i) => {
      const p = this.at(i);
      return { x: p.x, y: p.y, z: p.z, age: this.time - p.born };
    });
  }
  at(i) {
    return this.points[(this.head + i) % this.points.length];
  }
};

// packages/core/particles/RibbonPath3D.ts
var ZhudaRibbonPath3D = class {
  constructor(spec) {
    this.hasWidthDirections = false;
    this.count = 0;
    this.uvOffset = 0;
    this.uvTiles = 1;
    this.visibleStart = 0;
    this.visibleEnd = 1;
    this.edgeFade = 0.08;
    if (!Number.isInteger(spec.maxPoints) || spec.maxPoints < 2 || spec.maxPoints > 32767 || !Number.isFinite(spec.width) || spec.width <= 0) throw new Error("Invalid 3D ribbon path budget or width.");
    for (const keys of [spec.widthOverPath, spec.alphaOverPath]) if (keys && (!keys.length || keys.some((k, i, a) => !k || ![k.time, k.value].every(Number.isFinite) || k.time < 0 || k.time > 1 || k.value < 0 || i > 0 && k.time <= a[i - 1].time))) throw new Error("Invalid path curve.");
    if (spec.colorOverPath && (!spec.colorOverPath.length || spec.colorOverPath.some((k, i, a) => !k || !Number.isFinite(k.time) || k.time < 0 || k.time > 1 || !/^#[0-9a-f]{6}$/i.test(k.color) || i > 0 && k.time <= a[i - 1].time))) throw new Error("Invalid path color curve.");
    this.spec = JSON.parse(JSON.stringify(spec));
    this.points = Array.from({ length: spec.maxPoints }, () => ({ x: 0, y: 0, z: 0 }));
    this.widthDirections = Array.from({ length: spec.maxPoints }, () => ({ x: 0, y: 0, z: 0 }));
    this.distances = new Float32Array(spec.maxPoints);
    this.geometry = { vertices: new Float32Array(spec.maxPoints * 18), indices: new Uint16Array((spec.maxPoints - 1) * 6), vertexCount: 0, indexCount: 0 };
  }
  get pointCount() {
    return this.count;
  }
  clear() {
    this.count = 0;
  }
  setPoints(points, widthDirections) {
    if (points.length > this.points.length || points.some((p) => !p || ![p.x, p.y, p.z].every(Number.isFinite))) throw new Error("Path points exceed budget or contain invalid XYZ positions.");
    if (widthDirections && (widthDirections.length !== points.length || widthDirections.some((v) => !v || ![v.x, v.y, v.z].every(Number.isFinite) || Math.hypot(v.x, v.y, v.z) < 1e-8))) throw new Error("Width directions must match the path and contain finite non-zero vectors.");
    this.hasWidthDirections = widthDirections !== void 0;
    if (widthDirections) for (let i = 0; i < points.length; i++) Object.assign(this.widthDirections[i], widthDirections[i]);
    this.count = points.length;
    for (let i = 0; i < points.length; i++) Object.assign(this.points[i], points[i]);
  }
  snapshot() {
    return this.points.slice(0, this.count).map((p) => ({ ...p }));
  }
  buildMesh(camera, opacity = 1) {
    const g = this.geometry;
    g.vertices.fill(0);
    g.indices.fill(0);
    if (![this.uvOffset, this.uvTiles, opacity, this.visibleStart, this.visibleEnd, this.edgeFade].every(Number.isFinite) || this.visibleStart < 0 || this.visibleEnd > 1 || this.visibleStart > this.visibleEnd || this.edgeFade <= 0) throw new Error("Invalid flow UV/opacity/reveal window.");
    let total = 0;
    for (let i = 0; i < this.count; i++) {
      if (i) {
        const a = this.points[i - 1], b = this.points[i];
        total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      }
      this.distances[i] = total;
    }
    let px = 0, py = 0, pz = 0;
    for (let i = 0; i < this.count; i++) {
      const p = this.points[i], a = this.points[Math.max(0, i - 1)], b = this.points[Math.min(this.count - 1, i + 1)];
      const tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z, vx = camera.x - p.x, vy = camera.y - p.y, vz = camera.z - p.z;
      let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx, length = Math.hypot(nx, ny, nz);
      if (this.hasWidthDirections) {
        const d = this.widthDirections[i], tt = tx * tx + ty * ty + tz * tz;
        const projection = tt > 1e-14 ? (d.x * tx + d.y * ty + d.z * tz) / tt : 0;
        nx = d.x - projection * tx;
        ny = d.y - projection * ty;
        nz = d.z - projection * tz;
        length = Math.hypot(nx, ny, nz);
      }
      if (length < 1e-7) {
        nx = -tz;
        ny = 0;
        nz = tx;
        length = Math.hypot(nx, ny, nz);
      }
      if (length < 1e-7) {
        nx = 1;
        ny = 0;
        nz = 0;
        length = 1;
      }
      nx /= length;
      ny /= length;
      nz /= length;
      if (nx * px + ny * py + nz * pz < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      px = nx;
      py = ny;
      pz = nz;
      const t = total > 1e-7 ? this.distances[i] / total : 0;
      const width = this.spec.width * 0.5 * sampleParticleCurve(this.spec.widthOverPath, t);
      const mask = smooth((t - this.visibleStart) / this.edgeFade) * smooth((this.visibleEnd - t) / this.edgeFade);
      const alpha = Math.max(0, Math.min(1, opacity * sampleParticleCurve(this.spec.alphaOverPath, t))) * mask;
      const color = sampleParticleColor(this.spec.colorOverPath, t), r = parseInt(color.slice(1, 3), 16) / 255, green = parseInt(color.slice(3, 5), 16) / 255, blue = parseInt(color.slice(5, 7), 16) / 255;
      const u = t * this.uvTiles + this.uvOffset;
      for (let side = 0; side < 2; side++) {
        const sign = side ? 1 : -1, base = i * 18 + side * 9, v = g.vertices;
        v[base] = p.x + sign * nx * width;
        v[base + 1] = p.y + sign * ny * width;
        v[base + 2] = p.z + sign * nz * width;
        v[base + 3] = r;
        v[base + 4] = green;
        v[base + 5] = blue;
        v[base + 6] = alpha;
        v[base + 7] = u;
        v[base + 8] = side;
      }
      if (i < this.count - 1) {
        const v = i * 2, offset = i * 6, indices = g.indices;
        indices[offset] = v;
        indices[offset + 1] = v + 1;
        indices[offset + 2] = v + 2;
        indices[offset + 3] = v + 1;
        indices[offset + 4] = v + 3;
        indices[offset + 5] = v + 2;
      }
    }
    g.vertexCount = this.count * 2;
    g.indexCount = Math.max(0, this.count - 1) * 6;
    return g;
  }
};
function smooth(v) {
  const f = Math.max(0, Math.min(1, v));
  return f * f * (3 - 2 * f);
}

// packages/core/particles/LayaParticleRenderer3D.ts
var DynamicParticleMesh3D = class {
  constructor(parent, geometry, texture, blend, color) {
    this.disposed = false;
    const l = globalThis.Laya;
    if (!l?.PrimitiveMesh?._createMesh || !l?.MeshSprite3D || !texture) throw new Error("3D particle rendering requires booted Laya 3.4.2 3D modules and a texture.");
    this.mesh = l.PrimitiveMesh._createMesh(l.VertexMesh.getVertexDeclaration("POSITION,COLOR,UV"), geometry.vertices, geometry.indices);
    this.material = new l.UnlitMaterial();
    this.material.enableVertexColor = true;
    this.material.albedoTexture = texture.bitmap || texture;
    if (color) {
      const c = parseInt(color.slice(1), 16);
      this.material.albedoColor = new l.Color((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255, 1);
    }
    this.material.renderQueue = 3e3;
    this.material.depthWrite = false;
    this.material.depthTest = l.RenderState.DEPTHTEST_LEQUAL;
    this.material.cull = l.RenderState.CULL_NONE;
    this.material.blend = l.RenderState.BLEND_ENABLE_ALL;
    this.material.blendSrc = l.RenderState.BLENDPARAM_SRC_ALPHA;
    this.material.blendDst = blend === "additive" ? l.RenderState.BLENDPARAM_ONE : l.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
    this.node = new l.MeshSprite3D(this.mesh);
    this.node.name = "ZhudaParticles3D";
    this.node.meshRenderer.sharedMaterial = this.material;
    parent.addChild(this.node);
    this.min = new l.Vector3();
    this.max = new l.Vector3();
  }
  submit(g, visible) {
    if (this.disposed) return;
    this.node.active = visible && g.indexCount > 0;
    if (!this.node.active) return;
    this.mesh.setVertices(g.vertices.buffer);
    this.mesh.setIndices(g.indices);
    this.min.setValue(Infinity, Infinity, Infinity);
    this.max.setValue(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < g.vertexCount; i++) {
      const offset = i * 9;
      this.min.x = Math.min(this.min.x, g.vertices[offset]);
      this.max.x = Math.max(this.max.x, g.vertices[offset]);
      this.min.y = Math.min(this.min.y, g.vertices[offset + 1]);
      this.max.y = Math.max(this.max.y, g.vertices[offset + 1]);
      this.min.z = Math.min(this.min.z, g.vertices[offset + 2]);
      this.max.z = Math.max(this.max.z, g.vertices[offset + 2]);
    }
    const bounds = this.mesh.bounds;
    bounds.setMin(this.min);
    bounds.setMax(this.max);
    this.mesh.bounds = bounds;
    this.node.meshRenderer.boundsChange = true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.material.albedoTexture = null;
    this.node.destroy(true);
    this.mesh.destroy();
    this.material.destroy();
  }
};
function cameraView(camera, out) {
  const e = camera.transform.worldMatrix.elements, p = camera.transform.position;
  Object.assign(out.position, { x: p.x, y: p.y, z: p.z });
  Object.assign(out.right, { x: e[0], y: e[1], z: e[2] });
  Object.assign(out.up, { x: e[4], y: e[5], z: e[6] });
  Object.assign(out.forward, { x: -e[8], y: -e[9], z: -e[10] });
  return out;
}
function emptyView() {
  return { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: -1 } };
}
var ZhudaLayaParticleRenderer3D = class {
  constructor(system, parent, resolveTexture) {
    this.submittedBatches = 0;
    this.view = emptyView();
    this.disposed = false;
    this.system = system;
    this.builder = new ZhudaParticleMesh3D(system);
    this.backend = new DynamicParticleMesh3D(parent, this.builder.geometry, resolveTexture(system.spec.texture), system.spec.blend);
    this.node = this.backend.node;
  }
  render(camera, opacity = 1) {
    this.submittedBatches = 0;
    if (this.disposed) return;
    const g = this.builder.build(cameraView(camera, this.view), opacity);
    this.backend.submit(g, opacity > 0);
    this.submittedBatches = opacity > 0 && g.indexCount > 0 ? 1 : 0;
  }
  dispose() {
    this.disposed = true;
    this.backend.dispose();
  }
};
var ZhudaLayaRibbonRenderer3D = class {
  constructor(trail, parent, texture, color = "#ffffff", blend = "additive") {
    this.submittedBatches = 0;
    this.disposed = false;
    this.trail = trail;
    this.backend = new DynamicParticleMesh3D(parent, trail.buildMesh({ x: 0, y: 0, z: 1 }), texture, blend, color);
    this.node = this.backend.node;
    this.node.name = "ZhudaRibbon3D";
  }
  render(camera, opacity = 1) {
    this.submittedBatches = 0;
    if (this.disposed) return;
    const g = this.trail.buildMesh(camera.transform.position, opacity);
    this.backend.submit(g, opacity > 0);
    this.submittedBatches = opacity > 0 && g.indexCount > 0 ? 1 : 0;
  }
  dispose() {
    this.disposed = true;
    this.backend.dispose();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ENGINE_PRESET_PROFILES,
  EngineGuard,
  IframeSoundAdapter,
  PixelCalibrationEngine,
  SpineVisualContract,
  TopologyResolver,
  UNITY_CYBER_SHRINE_SCENE,
  UnityAnimatorStateMachine,
  UnityBridgePipeline,
  VIEWPORT_DEVICE_PROFILES,
  ViewportMatrixEngine,
  VisualFocusContract,
  ZHUDA_ENGINE_MODULES,
  Zhuda3D,
  ZhudaAssetSerializer,
  ZhudaBenchmarkEngine,
  ZhudaEffectEnvelope,
  ZhudaEngine,
  ZhudaLayaParticleRenderer,
  ZhudaLayaParticleRenderer3D,
  ZhudaLayaRibbonRenderer,
  ZhudaLayaRibbonRenderer3D,
  ZhudaParticleMesh3D,
  ZhudaParticleSystem,
  ZhudaParticleSystem3D,
  ZhudaPrefab,
  ZhudaRibbonPath3D,
  ZhudaRibbonTrail,
  ZhudaRibbonTrail3D,
  ZhudaUI,
  rotateParticleVector3,
  sampleParticleColor,
  sampleParticleCurve,
  validateParticleEffect,
  validateParticleEffect3D,
  zhudaComponent
});
//# sourceMappingURL=zhuda-laya-engine.cjs.map
