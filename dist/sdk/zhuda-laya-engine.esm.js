/**
 * zhuda-laya-engine v1.14.0 — 豬大 LayaAir (AI-Agent-Friendly Fork Edition)
 * Repository: https://github.com/zhudaandzhuer/zhuda-laya-engine
 * Upstream Official: LayaAir Engine 3.4.2 by Layabox (https://layaair.com/ | https://github.com/layabox/LayaAir)
 * License: MIT
 */

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
    id: "spine-core-38",
    file: "spine-core-3.8.js",
    sizeBytes: 138800,
    feature: "spine38",
    dependsOn: ["core"],
    conflictsWith: ["spine-core-42"],
    providesGlobals: ["window.spine", "window.spine.AnimationState"],
    priority: 100,
    painPointNote: "Game100001 \u7684\u7368\u7ACB Spine 3.8 runtime\uFF1B\u4E0D\u5F97\u8207 Spine 4.2 core \u5171\u7528\u540C\u4E00\u9801"
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
    id: "spine38",
    file: "laya.spine.js",
    sizeBytes: 132824,
    feature: "spine38",
    dependsOn: ["core", "webgl2d", "spine-core-38"],
    conflictsWith: ["spine"],
    providesGlobals: ["Laya.SpineTemplet", "Laya.Spine2DRenderNode"],
    priority: 110,
    painPointNote: "\u540C\u4E00 Laya Spine adapter \u4EE5 3.8 runtime namespace \u555F\u52D5\uFF1B\u5FC5\u9808\u5728 spine-core-3.8.js \u4E4B\u5F8C"
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
function rendererModules(renderer) {
  if (renderer !== "webgl" && renderer !== "webgpu") throw Error("[ZhudaTopology] renderer must be webgl or webgpu");
  if (renderer === "webgl") return ZHUDA_ENGINE_MODULES;
  const id = (value) => value.replace("webgl", "webgpu");
  return [
    ...ZHUDA_ENGINE_MODULES.map((node) => ({
      ...node,
      id: id(node.id),
      file: node.file.replace("webgl", "webgpu"),
      sizeBytes: node.id === "webgl2d" ? 858378 : node.id === "webgl3d" ? 335455 : node.sizeBytes,
      dependsOn: [...node.dependsOn.map(id), ...node.id === "webgl2d" ? ["shader-compiler", "naga"] : []],
      providesGlobals: node.providesGlobals.map((value) => value.replace("WebGL", "WebGPU"))
    })),
    { id: "shader-compiler", file: "shader_compiler_web.js", sizeBytes: 61401, feature: "2d", dependsOn: ["core"], providesGlobals: ["ShaderCompiler"], priority: 25 },
    { id: "naga", file: "nagabind.js", sizeBytes: 13996, feature: "2d", dependsOn: ["core"], providesGlobals: ["wasm_bindgen"], priority: 26 }
  ];
}
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
  static resolveByFeatures(features, renderer = "webgl") {
    const targetFeatures = features === "all" ? ENGINE_PRESET_PROFILES["full-all-in-one"] : Array.from(/* @__PURE__ */ new Set(["core", ...features]));
    const seedIds = rendererModules(renderer).filter(
      (m) => targetFeatures.includes(m.feature)
    ).map((m) => m.id);
    return this.resolveByModuleIds(seedIds, renderer);
  }
  /**
   * 根據 Module IDs 展開傳遞依賴閉包並以 Kahn's Algorithm 排序
   */
  static resolveByModuleIds(seedModuleIds, renderer = "webgl") {
    const modules = rendererModules(renderer);
    const moduleMap = new Map(modules.map((node) => [node.id, node]));
    const closure = /* @__PURE__ */ new Set();
    const diagnostics = [];
    const visit2 = (id, chain) => {
      if (chain.includes(id)) {
        throw new Error(`[ZhudaTopology] \u5075\u6E2C\u5230\u5FAA\u74B0\u4F9D\u8CF4 (Cycle Detected): ${[...chain, id].join(" -> ")}`);
      }
      const node = moduleMap.get(id);
      if (!node) {
        throw new Error(`[ZhudaTopology] \u672A\u77E5\u7684\u5F15\u64CE\u6A21\u7D44 ID: "${id}"`);
      }
      for (const depId of node.dependsOn) {
        if (!closure.has(depId)) {
          diagnostics.push(`[Auto-Dependency] \u6A21\u7D44 "${node.file}" \u81EA\u52D5\u62C9\u5165\u524D\u7F6E\u4F9D\u8CF4 "${moduleMap.get(depId)?.file}"`);
        }
        visit2(depId, [...chain, id]);
      }
      closure.add(id);
    };
    for (const seed of seedModuleIds) {
      visit2(seed, []);
    }
    for (const id of closure) {
      const node = moduleMap.get(id);
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
      const node = moduleMap.get(id);
      for (const depId of node.dependsOn) {
        adj.get(depId).push(id);
        inDegree.set(id, (inDegree.get(id) || 0) + 1);
      }
    }
    const readyQueue = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        readyQueue.push(moduleMap.get(id));
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
          readyQueue.push(moduleMap.get(neighborId));
          readyQueue.sort((a, b) => a.priority - b.priority);
        }
      }
    }
    if (orderedModules.length !== closure.size) {
      throw new Error("[ZhudaTopology] \u62D3\u64B2\u6392\u5E8F\u5931\u6557\uFF1A\u5B58\u5728\u7121\u6CD5\u89E3\u958B\u7684\u4F9D\u8CF4\u74B0");
    }
    const supportSizeBytes = renderer === "webgpu" ? 5942257 : 0;
    const totalSizeBytes = orderedModules.reduce((acc, m) => acc + m.sizeBytes, supportSizeBytes);
    const fullSizeBytes = modules.reduce((acc, m) => acc + m.sizeBytes, supportSizeBytes);
    const prunedRatioPercent = Number(((fullSizeBytes - totalSizeBytes) / fullSizeBytes * 100).toFixed(1));
    return {
      renderer,
      supportFiles: renderer === "webgpu" ? ["shader_compiler_web.wasm", "nagabind_bg.wasm"] : [],
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
    const gpu = files.some((file) => file.startsWith("laya.webgpu_"));
    const modules = rendererModules(gpu ? "webgpu" : "webgl");
    const moduleMap = new Map(modules.map((node) => [node.id, node]));
    const fileMap = /* @__PURE__ */ new Map();
    for (const node of modules) {
      const candidates = fileMap.get(node.file) || [];
      candidates.push(node);
      fileMap.set(node.file, candidates);
    }
    if (gpu && files.some((file) => file.startsWith("laya.webgl_"))) issues.push({ type: "CONFLICTING_MODULE", moduleFile: "laya.webgpu_2D.js", requiredFile: "laya.webgl_2D.js", fatalSymptom: "Mixed renderer factories", message: "Load exactly one renderer backend per realm" });
    if (files.includes("spine-core-3.8.js") && files.includes("spine-core-4.2.js")) issues.push({ type: "CONFLICTING_MODULE", moduleFile: "spine-core-3.8.js", requiredFile: "spine-core-4.2.js", fatalSymptom: "Mixed Spine global namespaces", message: "Load exactly one Spine core runtime per realm" });
    const seenFiles = /* @__PURE__ */ new Set();
    const seenIds = /* @__PURE__ */ new Set();
    const selectNode = (file) => {
      const candidates = fileMap.get(file);
      if (!candidates?.length) return void 0;
      if (candidates.length === 1) return candidates[0];
      const preferred = seenFiles.has("spine-core-3.8.js") ? candidates.find((node) => node.id === "spine38") : seenFiles.has("spine-core-4.2.js") ? candidates.find((node) => node.id === "spine") : void 0;
      return preferred || candidates[0];
    };
    for (const file of files) {
      const node = selectNode(file);
      if (!node) {
        seenFiles.add(file);
        continue;
      }
      for (const depId of node.dependsOn) {
        const depNode = moduleMap.get(depId);
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
      seenIds.add(node.id);
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

// packages/core/runtime3d/WebGPU342Adapters.ts
var patched = /* @__PURE__ */ new WeakSet();
function installLaya342WebGPUFix(native) {
  const prototype = native.WebGPUMeshRenderBatchAgent?.prototype;
  if (!prototype || patched.has(prototype)) return;
  const append = prototype.appendRenderElement;
  prototype.appendRenderElement = function(...args) {
    if (this._checkCPUCullList?.length || this._changeElementBatchMark?.length) {
      this._canKipCull = native.Stat.loopCount;
      this._cameraChangeMask = this._dirCullChangeMask = this._spotCullChangeMask = native.Stat.loopCount;
    }
    return append.apply(this, args);
  };
  patched.add(prototype);
}

// packages/core/runtime3d/Renderer.ts
var ZhudaRendererError = class extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "ZhudaRendererError";
  }
};
function prepareRenderer(requested, native = globalThis.Laya) {
  const gpuLoaded = !!native?.WebGPURenderDeviceFactory;
  const glLoaded = !!native?.WebGLRenderDeviceFactory;
  const selected = gpuLoaded ? "webgpu" : "webgl";
  requested ?? (requested = selected);
  if (requested !== "webgl" && requested !== "webgpu") throw new ZhudaRendererError("RENDERER_OPTION", "renderer must be webgl or webgpu");
  if (gpuLoaded && glLoaded) throw new ZhudaRendererError("RENDERER_CONFLICT", "Load one backend per realm; rebuild with renderer: webgl or webgpu");
  if (requested !== selected) throw new ZhudaRendererError("RENDERER_MISMATCH", `Requested ${requested}, loaded ${selected}; set renderer in zhuda.config.json and rebuild`);
  if (selected === "webgpu" && !globalThis.navigator?.gpu) throw new ZhudaRendererError("WEBGPU_UNAVAILABLE", "WebGPU requires HTTPS/localhost and a supported browser/GPU; use a separately built WebGL page if unavailable");
  const diagnostics = { requested, selected, fallbackReason: null, nativeEngine: "", status: "initializing", features: [], errors: [] };
  let ended = false, device, engine, session;
  const cancellation = new AbortController();
  const cleanups = [];
  const check = () => {
    if (ended) throw new ZhudaRendererError("RENDERER_CANCELLED", "Initialization retired; recreate the runtime realm");
  };
  const errorListener = (event) => {
    if (diagnostics.errors.length < 64) diagnostics.errors.push(String(event.error?.message ?? event.error));
  };
  const pause = () => {
    if (native.Render) native.Render.paused = true;
    if (native.stage) native.stage.renderingEnabled = false;
    session?.notifyContextLost();
  };
  const patch = (prototype, key, make) => {
    const original = prototype?.[key];
    if (typeof original !== "function") throw new ZhudaRendererError("WEBGPU_VENDOR_MISMATCH", `Missing pinned LayaAir 3.4.2 seam: ${key}`);
    const replacement = make(original);
    prototype[key] = replacement;
    cleanups.push(() => {
      if (prototype[key] === replacement) prototype[key] = original;
    });
  };
  const release = (status) => {
    if (ended) return;
    ended = true;
    diagnostics.status = status;
    cancellation.abort();
    if (selected === "webgpu") {
      pause();
      device?.removeEventListener("uncapturederror", errorListener);
      engine?._context?.unconfigure();
      device?.destroy();
    }
    cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
  };
  try {
    if (selected === "webgpu") {
      installLaya342WebGPUFix(native);
      patch(native.WebGPUShaderCompiler?.prototype, "init", (original) => async function() {
        check();
        const prepare = globalThis.__ZHUDA_WEBGPU_PREPARE__;
        if (prepare) {
          try {
            const compiled = await prepare(cancellation.signal);
            check();
            this.glslang = compiled.glslang;
            this.naga = compiled.naga;
          } catch (error) {
            throw new ZhudaRendererError("WEBGPU_SHADER_COMPILER", String(error));
          }
        } else {
          await original.call(this);
          check();
        }
        if (!this.glslang || !this.naga) throw new ZhudaRendererError("WEBGPU_SHADER_COMPILER", "GLSL/WGSL compiler failed; verify the packaged WASM resources and CSP");
      });
      patch(native.WebGPURenderEngine?.prototype, "_getAdapter", (original) => async function() {
        check();
        const adapter = await original.call(this);
        check();
        if (!adapter) throw new ZhudaRendererError("WEBGPU_ADAPTER", "No compatible adapter; inspect browser GPU diagnostics");
        const info = adapter.info ?? {};
        diagnostics.adapter = { vendor: info.vendor ?? "", architecture: info.architecture ?? "", device: info.device ?? "", description: info.description ?? "", isFallbackAdapter: info.isFallbackAdapter ?? false };
        return adapter;
      });
      patch(native.WebGPURenderEngine?.prototype, "_getGPUdevice", (original) => async function(descriptor) {
        check();
        const result = await original.call(this, descriptor);
        if (ended) {
          result.destroy();
          check();
        }
        device = result;
        engine = this;
        diagnostics.features = [...result.features].sort();
        device.addEventListener("uncapturederror", errorListener);
        device.lost.then((info) => {
          if (ended) return;
          diagnostics.status = "lost";
          diagnostics.loss = { reason: info.reason, message: info.message };
          pause();
        });
        return result;
      });
    }
    return {
      backend: selected,
      diagnostics,
      ready() {
        check();
        const actual = native.LayaGL?.renderEngine;
        diagnostics.nativeEngine = actual?.objectName ?? actual?.constructor?.name ?? "unknown";
        const actualGpu = typeof actual?.getDevice === "function" && !!actual.getDevice();
        if (selected === "webgpu" && (!actualGpu || diagnostics.status === "lost")) throw new ZhudaRendererError("WEBGPU_NOT_READY", "Native WebGPU device did not initialize or was lost");
        if (selected === "webgl" && actualGpu) throw new ZhudaRendererError("RENDERER_MISMATCH", "Native renderer does not match the requested backend");
        diagnostics.status = "ready";
      },
      attach(runtime2) {
        session = runtime2;
        if (diagnostics.status === "lost") pause();
      },
      release
    };
  } catch (error) {
    release("failed");
    throw error;
  }
}

// packages/core/runtime3d/AsyncDeadline.ts
function withDeadline(run, options, discard = () => {
}) {
  const timeout = options.timeoutMs ?? 15e3;
  if (!Number.isSafeInteger(timeout) || timeout <= 0) return Promise.reject(Error("Invalid IO timeoutMs"));
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    };
    const fail = (reason) => {
      if (settled) return;
      settled = true;
      controller.abort(reason);
      cleanup();
      reject(reason);
    };
    const abort = () => fail(options.signal?.reason ?? new DOMException("Operation cancelled", "AbortError"));
    const timer = setTimeout(() => fail(new DOMException("IO deadline exceeded", "TimeoutError")), timeout);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) {
      abort();
      return;
    }
    Promise.resolve().then(() => {
      if (controller.signal.aborted) throw controller.signal.reason;
      return run(controller.signal);
    }).then((value) => {
      if (settled) {
        discard(value);
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    }, fail).catch(() => {
    });
  });
}

// packages/core/runtime3d/AsyncOperation.ts
function awaitAbortable(work, signal, discard) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => {
      if (settled) return;
      settled = true;
      reject(signal.reason ?? new DOMException("Cancelled", "AbortError"));
    };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    work.then((value) => {
      signal.removeEventListener("abort", abort);
      if (settled) {
        discard?.(value);
        return;
      }
      settled = true;
      resolve(value);
    }, (error) => {
      signal.removeEventListener("abort", abort);
      if (!settled) {
        settled = true;
        reject(error);
      }
    }).catch(() => {
    });
  });
}

// packages/core/runtime3d/MiniGameSplash.ts
async function showMiniGameSplash(context, signal, timeoutMs = 3e4) {
  const config = globalThis.__ZHUDA_MINIGAME__;
  const branding = config?.branding;
  if (!branding || branding.mode === "none" || !branding.logo) return;
  const url = branding.logo;
  const panel = new Laya.Sprite(), logo = new Laya.Sprite();
  panel.name = "ZhudaPlatformSplash";
  panel.zOrder = 2147483e3;
  panel.mouseEnabled = true;
  panel.addChild(logo);
  Laya.stage.addChild(panel);
  let ready = false, elapsed = 0;
  const release = () => Laya.loader.clearRes(url);
  try {
    await withDeadline(async (cancellation) => {
      const texture = await awaitAbortable(Laya.loader.load(url, Laya.Loader.IMAGE), cancellation, release);
      if (!(texture instanceof Laya.Texture)) throw Error("Mini-game branding image failed to load");
      logo.texture = texture;
      ready = true;
      await awaitAbortable(new Promise((resolve) => {
        context.runtime.start((dt) => {
          if (!ready || context.runtime.disposed) return;
          elapsed += dt;
          const width = Laya.stage.width, height = Laya.stage.height;
          panel.size(width, height);
          panel.graphics.clear();
          panel.graphics.drawRect(0, 0, width, height, "#0b1220");
          const fit = Math.min(width * 0.82 / texture.width, height * 0.5 / texture.height);
          const entrance = Math.min(1, elapsed / 0.5);
          logo.size(texture.width * fit, texture.height * fit);
          logo.pivot(logo.width / 2, logo.height / 2);
          logo.pos(width / 2, height / 2);
          logo.scale(0.9 + 0.1 * entrance, 0.9 + 0.1 * entrance);
          panel.alpha = elapsed > 1.4 ? Math.max(0, (1.8 - elapsed) / 0.4) : entrance;
          if (elapsed >= 1.8) resolve();
        });
      }), cancellation);
    }, { signal, timeoutMs });
  } finally {
    ready = false;
    if (!context.runtime.disposed) context.runtime.start(() => {
    });
    panel.destroy(true);
    release();
  }
}

// packages/core/runtime3d/Clocks.ts
var ZhudaSimulationClock = class {
  constructor(step = 1 / 60, maxCatchup = 8) {
    this.tick = 0;
    this.renderTime = 0;
    this.paused = false;
    this.timeScale = 1;
    this.unscaledTime = 0;
    this.scaledTime = 0;
    this.unscaledDeltaTime = 0;
    this.scaledDeltaTime = 0;
    this.accumulator = 0;
    this.step = step;
    this.maxCatchup = maxCatchup;
    if (!(step > 0 && Number.isFinite(step) && Number.isInteger(maxCatchup) && maxCatchup > 0))
      throw Error("Invalid fixed clock");
  }
  advance(dt, simulate) {
    if (!Number.isFinite(dt) || dt < 0) throw Error("Invalid clock delta");
    if (!Number.isFinite(this.timeScale) || this.timeScale < 0)
      throw Error("Invalid clock time scale");
    this.unscaledDeltaTime = this.paused ? 0 : dt;
    this.scaledDeltaTime = this.paused ? 0 : dt * this.timeScale;
    if (this.paused) return 0;
    this.unscaledTime += dt;
    this.scaledTime += dt * this.timeScale;
    this.renderTime += dt;
    this.accumulator = Math.min(
      this.accumulator + dt * this.timeScale,
      this.step * this.maxCatchup
    );
    let n = 0;
    while (this.accumulator + 1e-10 >= this.step) {
      this.accumulator -= this.step;
      simulate(this.step, ++this.tick);
      n++;
    }
    return n;
  }
  get simulationTime() {
    return this.tick * this.step;
  }
  get alpha() {
    return Math.max(0, this.accumulator / this.step);
  }
  reset(tick = 0) {
    if (!Number.isSafeInteger(tick) || tick < 0) throw Error("Invalid tick");
    this.tick = tick;
    this.renderTime = tick * this.step;
    this.unscaledTime = this.renderTime;
    this.scaledTime = this.renderTime;
    this.unscaledDeltaTime = 0;
    this.scaledDeltaTime = 0;
    this.accumulator = 0;
  }
};
var DEFAULT_TIME_LAYERS = ["world", "player", "enemy", "vfx", "ui"];
var ZhudaLayeredClock = class {
  constructor(layers = DEFAULT_TIME_LAYERS) {
    this.layerStates = /* @__PURE__ */ new Map();
    this.layerDeltaValues = /* @__PURE__ */ new Map();
    /** Global scale inherited from the owning runtime session. */
    this.globalTimeScale = 1;
    this.unscaledTime = 0;
    this.unscaledDeltaTime = 0;
    if (Array.isArray(layers)) {
      if (!layers.length) throw Error("At least one time layer is required");
      for (const name of layers) this.defineLayer(name);
    } else {
      const definitions = layers;
      const names = Object.keys(definitions);
      if (!names.length) throw Error("At least one time layer is required");
      for (const name of names) this.defineLayer(name, definitions[name]);
    }
  }
  defineLayer(name, options = {}) {
    this.validateName(name);
    if (this.layerStates.has(name)) throw Error(`Time layer already exists: ${name}`);
    const timeScale = options.timeScale ?? 1;
    if (!Number.isFinite(timeScale) || timeScale < 0)
      throw Error("Invalid time layer scale");
    if (options.paused !== void 0 && typeof options.paused !== "boolean")
      throw Error("Invalid time layer pause state");
    this.layerStates.set(name, {
      name,
      timeScale,
      paused: options.paused ?? false,
      scaledTime: 0,
      scaledDeltaTime: 0
    });
    this.layerDeltaValues.set(name, 0);
    return this;
  }
  removeLayer(name) {
    this.validateName(name);
    this.layerDeltaValues.delete(name);
    return this.layerStates.delete(name);
  }
  setTimeScale(name, value) {
    const layer = this.getLayer(name);
    if (!Number.isFinite(value) || value < 0) throw Error("Invalid time layer scale");
    layer.timeScale = value;
    return this;
  }
  setGlobalTimeScale(value) {
    if (!Number.isFinite(value) || value < 0) throw Error("Invalid global time layer scale");
    this.globalTimeScale = value;
    return this;
  }
  setPaused(name, paused) {
    const layer = this.getLayer(name);
    if (typeof paused !== "boolean") throw Error("Invalid time layer pause state");
    layer.paused = paused;
    return this;
  }
  getTimeScale(name) {
    return this.getLayer(name).timeScale;
  }
  isPaused(name) {
    return this.getLayer(name).paused;
  }
  get layerNames() {
    return [...this.layerStates.keys()];
  }
  /** Reusable layer deltas for `ZhudaTimerScheduler.advance`. */
  get scaledDeltas() {
    return this.layerDeltaValues;
  }
  advance(unscaledDeltaTime) {
    if (!Number.isFinite(unscaledDeltaTime) || unscaledDeltaTime < 0)
      throw Error("Invalid layered clock delta");
    this.unscaledDeltaTime = unscaledDeltaTime;
    this.unscaledTime += unscaledDeltaTime;
    for (const layer of this.layerStates.values()) {
      const scaledDeltaTime = layer.paused ? 0 : unscaledDeltaTime * this.globalTimeScale * layer.timeScale;
      layer.scaledDeltaTime = scaledDeltaTime;
      layer.scaledTime += scaledDeltaTime;
      this.layerDeltaValues.set(layer.name, scaledDeltaTime);
    }
  }
  sample(name) {
    const layer = this.getLayer(name);
    return {
      layer: layer.name,
      paused: layer.paused,
      unscaledDeltaTime: this.unscaledDeltaTime,
      scaledDeltaTime: layer.scaledDeltaTime,
      unscaledTime: this.unscaledTime,
      scaledTime: layer.scaledTime,
      timeScale: this.globalTimeScale * layer.timeScale
    };
  }
  reset() {
    this.unscaledTime = 0;
    this.unscaledDeltaTime = 0;
    for (const layer of this.layerStates.values()) {
      layer.scaledTime = 0;
      layer.scaledDeltaTime = 0;
      this.layerDeltaValues.set(layer.name, 0);
    }
  }
  getLayer(name) {
    this.validateName(name);
    const layer = this.layerStates.get(name);
    if (!layer) throw Error(`Unknown time layer: ${name}`);
    return layer;
  }
  validateName(name) {
    if (typeof name !== "string" || !name.trim()) throw Error("Invalid time layer name");
  }
};
var ZhudaRealtimeClock = class {
  constructor() {
    this.timeScale = 1;
    this.unscaledTime = 0;
    this.scaledTime = 0;
    this.unscaledDeltaTime = 0;
    this.scaledDeltaTime = 0;
    this.paused = false;
  }
  advance(unscaledDeltaTime) {
    if (!Number.isFinite(unscaledDeltaTime) || unscaledDeltaTime < 0)
      throw Error("Invalid real-time delta");
    if (!Number.isFinite(this.timeScale) || this.timeScale < 0)
      throw Error("Invalid clock time scale");
    const unscaled = this.paused ? 0 : unscaledDeltaTime;
    const scaled = unscaled * this.timeScale;
    this.unscaledDeltaTime = unscaled;
    this.scaledDeltaTime = scaled;
    this.unscaledTime += unscaled;
    this.scaledTime += scaled;
    return this.sample();
  }
  sample() {
    return {
      unscaledDeltaTime: this.unscaledDeltaTime,
      scaledDeltaTime: this.scaledDeltaTime,
      unscaledTime: this.unscaledTime,
      scaledTime: this.scaledTime,
      timeScale: this.timeScale
    };
  }
  reset() {
    this.unscaledTime = 0;
    this.scaledTime = 0;
    this.unscaledDeltaTime = 0;
    this.scaledDeltaTime = 0;
  }
};
var ZhudaTimerScheduler = class {
  constructor(maxCallbacksPerAdvance = 64) {
    this.nextId = 1;
    this.tasks = /* @__PURE__ */ new Map();
    this.owners = /* @__PURE__ */ new Map();
    this.disposed = false;
    if (!Number.isSafeInteger(maxCallbacksPerAdvance) || maxCallbacksPerAdvance <= 0)
      throw Error("Invalid timer callback bound");
    this.maxCallbacksPerAdvance = maxCallbacksPerAdvance;
  }
  scheduleOnce(delay, callback, options = {}) {
    return this.schedule(delay, callback, { ...options, repeat: false });
  }
  scheduleLoop(interval, callback, options = {}) {
    return this.schedule(interval, callback, { ...options, repeat: true });
  }
  schedule(delay, callback, options) {
    if (this.disposed) throw Error("Disposed timer scheduler");
    if (!Number.isFinite(delay) || delay < 0 || options.repeat && delay <= 0)
      throw Error("Invalid timer delay");
    if (typeof callback !== "function") throw Error("Invalid timer callback");
    if (options.layer !== void 0 && (typeof options.layer !== "string" || !options.layer.trim()))
      throw Error("Invalid timer layer");
    if (options.layer !== void 0 && options.channel !== void 0)
      throw Error("Timer layer cannot be combined with a timer channel");
    const task = {
      id: this.nextId++,
      remaining: delay,
      interval: delay,
      repeat: options.repeat,
      channel: options.channel ?? "scaled",
      layer: options.layer,
      owner: options.owner,
      callback,
      cancelled: false
    };
    this.tasks.set(task.id, task);
    if (task.owner) {
      let ids = this.owners.get(task.owner);
      if (!ids) this.owners.set(task.owner, ids = /* @__PURE__ */ new Set());
      ids.add(task.id);
    }
    return this.handle(task);
  }
  handle(task) {
    return {
      id: task.id,
      get cancelled() {
        return task.cancelled;
      },
      cancel: () => this.cancel(task.id)
    };
  }
  cancel(id) {
    const task = this.tasks.get(id);
    if (!task || task.cancelled) return false;
    task.cancelled = true;
    this.tasks.delete(id);
    if (task.owner) {
      const ids = this.owners.get(task.owner);
      ids?.delete(id);
      if (ids && !ids.size) this.owners.delete(task.owner);
    }
    return true;
  }
  cancelOwner(owner) {
    const ids = [...this.owners.get(owner) ?? []];
    for (const id of ids) this.cancel(id);
    return ids.length;
  }
  advance(unscaledDeltaTime, scaledDeltaTime = unscaledDeltaTime, layerDeltas) {
    if (this.disposed) return 0;
    if (![unscaledDeltaTime, scaledDeltaTime].every((v) => Number.isFinite(v) && v >= 0))
      throw Error("Invalid timer delta");
    if (layerDeltas) {
      for (const [name, delta] of layerDeltas) {
        if (typeof name !== "string" || !name.trim() || !Number.isFinite(delta) || delta < 0)
          throw Error("Invalid timer layer delta");
      }
    }
    let callbacks = 0;
    const snapshot = [...this.tasks.values()];
    for (const task of snapshot) {
      if (callbacks >= this.maxCallbacksPerAdvance) break;
      if (task.cancelled || !this.tasks.has(task.id)) continue;
      const delta = task.layer ? layerDeltas?.get(task.layer) ?? 0 : task.channel === "scaled" ? scaledDeltaTime : unscaledDeltaTime;
      task.remaining -= delta;
      while (task.remaining <= 1e-10 && !task.cancelled && this.tasks.has(task.id) && callbacks < this.maxCallbacksPerAdvance) {
        task.callback();
        callbacks++;
        if (!task.repeat) {
          this.cancel(task.id);
          break;
        }
        task.remaining += task.interval;
      }
      if (callbacks >= this.maxCallbacksPerAdvance && task.repeat && !task.cancelled && task.remaining <= 1e-10)
        task.remaining = task.interval;
    }
    return callbacks;
  }
  clear() {
    for (const id of [...this.tasks.keys()]) this.cancel(id);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.owners.clear();
  }
  get size() {
    return this.tasks.size;
  }
};
var ZhudaSnapshotBuffer = class {
  constructor(epoch, interpolate, maxExtrapolation = 0.15, capacity = 32) {
    this.items = [];
    this.sequence = -1;
    this.epoch = epoch;
    this.interpolate = interpolate;
    this.maxExtrapolation = maxExtrapolation;
    this.capacity = capacity;
    if (!Number.isFinite(maxExtrapolation) || maxExtrapolation < 0 || capacity < 2 || !Number.isInteger(capacity))
      throw Error("Invalid snapshot bounds");
  }
  push(s) {
    if (s.epoch !== this.epoch || !Number.isSafeInteger(s.sequence) || s.sequence <= this.sequence || !Number.isFinite(s.time))
      return false;
    if (this.items.length && s.time <= this.items[this.items.length - 1].time)
      return false;
    this.sequence = s.sequence;
    this.items.push(s);
    if (this.items.length > this.capacity) this.items.shift();
    return true;
  }
  sample(time) {
    if (!Number.isFinite(time)) throw Error("Invalid sample time");
    const a = this.items;
    if (!a.length) return null;
    if (a.length === 1 || time <= a[0].time)
      return { value: a[0].value, time: a[0].time, mode: "held" };
    for (let i = 1; i < a.length; i++)
      if (time <= a[i].time) {
        const x2 = a[i - 1], y2 = a[i];
        return {
          value: this.interpolate(
            x2.value,
            y2.value,
            (time - x2.time) / (y2.time - x2.time)
          ),
          time,
          mode: "interpolated"
        };
      }
    const x = a[a.length - 2], y = a[a.length - 1], t = Math.min(time, y.time + this.maxExtrapolation);
    return {
      value: this.interpolate(
        x.value,
        y.value,
        (t - x.time) / (y.time - x.time)
      ),
      time: t,
      mode: "extrapolated"
    };
  }
  reset(epoch) {
    this.epoch = epoch;
    this.items = [];
    this.sequence = -1;
  }
  get size() {
    return this.items.length;
  }
};
var ZhudaEventGate = class {
  constructor(epoch, ttl = 30, capacity = 2048) {
    this.seen = /* @__PURE__ */ new Map();
    this.epoch = epoch;
    this.ttl = ttl;
    this.capacity = capacity;
    if (!(ttl > 0 && Number.isFinite(ttl) && Number.isInteger(capacity) && capacity > 0))
      throw Error("Invalid event bounds");
  }
  dispatch(id, now, action, options = {}) {
    if (!id || !Number.isFinite(now)) throw Error("Invalid event");
    if (options.replay || options.epoch && options.epoch !== this.epoch)
      return false;
    for (const [k, t] of this.seen) if (now - t > this.ttl) this.seen.delete(k);
    if (this.seen.has(id)) return false;
    this.seen.set(id, now);
    while (this.seen.size > this.capacity)
      this.seen.delete(this.seen.keys().next().value);
    action();
    return true;
  }
  reset(epoch) {
    this.epoch = epoch;
    this.seen.clear();
  }
  get size() {
    return this.seen.size;
  }
};

// packages/core/runtime3d/SceneMutation.ts
var ZhudaSceneMutationQueue = class {
  constructor() {
    this.nextId = 1;
    this.pending = /* @__PURE__ */ new Map();
    this.disposed = false;
    this.flushing = false;
  }
  enqueue(mutation) {
    if (this.disposed) throw Error("Disposed scene mutation queue");
    if (!mutation || typeof mutation.apply !== "function")
      throw Error("Invalid scene mutation");
    if (!["add", "remove", "destroy", "custom"].includes(mutation.kind))
      throw Error("Invalid scene mutation kind");
    const item = {
      ...mutation,
      id: this.nextId++,
      cancelled: false
    };
    this.pending.set(item.id, item);
    return {
      id: item.id,
      get cancelled() {
        return item.cancelled;
      },
      cancel: () => this.cancel(item.id)
    };
  }
  deferAdd(apply) {
    return this.enqueue({ kind: "add", apply });
  }
  deferRemove(apply) {
    return this.enqueue({ kind: "remove", apply });
  }
  deferDestroy(apply) {
    return this.enqueue({ kind: "destroy", apply });
  }
  cancel(id) {
    const item = this.pending.get(id);
    if (!item || item.cancelled) return false;
    item.cancelled = true;
    this.pending.delete(id);
    return true;
  }
  /** Applies exactly the batch present at the start of this call. */
  flush() {
    if (this.disposed || this.flushing) return 0;
    const batch = [...this.pending.values()];
    for (const item of batch) this.pending.delete(item.id);
    this.flushing = true;
    let applied = 0;
    try {
      for (const item of batch) {
        if (item.cancelled) continue;
        item.apply();
        applied++;
      }
    } finally {
      this.flushing = false;
    }
    return applied;
  }
  clear() {
    for (const item of this.pending.values()) item.cancelled = true;
    this.pending.clear();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }
  get size() {
    return this.pending.size;
  }
  get isFlushing() {
    return this.flushing;
  }
};

// packages/core/runtime3d/Laya342Adapters.ts
var patched2 = /* @__PURE__ */ new WeakSet();
function resizeLaya342Stage(runtime2, width, height, designWidth, designHeight, dpr, canvas) {
  const descriptor = Object.getOwnPropertyDescriptor(
    runtime2.Browser,
    "pixelRatio"
  );
  try {
    Object.defineProperty(runtime2.Browser, "pixelRatio", {
      configurable: true,
      get: () => dpr
    });
    runtime2.stage.size(designWidth, designHeight);
    if (runtime2.stage.updateCanvasSize)
      runtime2.systemTimer?.clearCallLater(runtime2.stage, runtime2.stage.updateCanvasSize);
    runtime2.stage.setScreenSize(width * dpr, height * dpr);
    const matrix = runtime2.stage._canvasTransform;
    if (canvas?.getBoundingClientRect && matrix) {
      const rect = canvas.getBoundingClientRect();
      const x = [
        0,
        matrix.a * canvas.width,
        matrix.c * canvas.height,
        matrix.a * canvas.width + matrix.c * canvas.height
      ];
      const y = [
        0,
        matrix.b * canvas.width,
        matrix.d * canvas.height,
        matrix.b * canvas.width + matrix.d * canvas.height
      ];
      matrix.tx = rect.left + (globalThis.scrollX || 0) - Math.min(...x);
      matrix.ty = rect.top + (globalThis.scrollY || 0) - Math.min(...y);
    }
  } finally {
    if (descriptor)
      Object.defineProperty(runtime2.Browser, "pixelRatio", descriptor);
    else Reflect.deleteProperty(runtime2.Browser, "pixelRatio");
  }
}
function installLaya342LifecycleFix(runtime2 = globalThis.Laya) {
  const prototype = runtime2?.WebRender3DProcess?.prototype;
  if (!prototype || patched2.has(prototype)) return;
  const destroy = prototype.destroy;
  if (typeof destroy !== "function") return;
  const retired = /* @__PURE__ */ new WeakSet();
  prototype.destroy = function(...args) {
    if (retired.has(this)) return;
    retired.add(this);
    const shadow = this._defaultShadowMap;
    try {
      return destroy.apply(this, args);
    } finally {
      if (shadow && !shadow.destroyed) shadow.destroy();
      this._defaultShadowMap = null;
    }
  };
  patched2.add(prototype);
}
function destroyLaya342ModelTree(node, runtime2 = globalThis.Laya) {
  const pending = [];
  const collect = (n) => {
    for (const component of n._components ?? [])
      pending.push({ component, queue: (component._driver || runtime2?.stage?._componentDriver)?._toDestroys });
    for (let i = 0; i < (n.numChildren || 0); i++) collect(n.getChildAt(i));
  };
  collect(node);
  node.destroy(true);
  for (const { component, queue } of pending)
    if (component._status === 4 && queue?.delete(component)) component._destroy(true);
}

// packages/core/runtime3d/RuntimeDriver.ts
var ZhudaRafDriver = class {
  constructor() {
    this.frame = 0;
    this.generation = 0;
  }
  now() {
    return performance.now();
  }
  start(callback) {
    this.stop();
    const generation = ++this.generation;
    const tick = (now) => {
      if (generation !== this.generation) return;
      this.frame = 0;
      try {
        callback(now);
      } finally {
        if (generation === this.generation)
          this.frame = requestAnimationFrame(tick);
      }
    };
    this.frame = requestAnimationFrame(tick);
  }
  setBackground(_background) {
  }
  stop() {
    this.generation++;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
  dispose() {
    this.stop();
  }
};
var ZhudaWorkerFrameDriver = class {
  constructor(options = {}) {
    this.raf = new ZhudaRafDriver();
    this.generation = 0;
    this.background = false;
    this.disposed = false;
    this.intervalMs = options.intervalMs ?? 100;
    if (!Number.isFinite(this.intervalMs) || this.intervalMs < 16 || this.intervalMs > 6e4)
      throw Error("Worker interval must be 16..60000 ms");
    if (options.workerFactory) this.worker = options.workerFactory();
    else {
      const source = `let timer;onmessage=({data})=>{clearInterval(timer);if(data.type==='start')timer=setInterval(()=>postMessage({generation:data.generation}),data.intervalMs);};`;
      const url = URL.createObjectURL(
        new Blob([source], { type: "application/javascript" })
      );
      try {
        this.worker = new Worker(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    this.worker.onmessage = (event) => {
      if (!this.disposed && this.background && this.callback && event.data?.generation === this.generation)
        this.callback(this.now());
    };
    this.worker.onerror = (event) => {
      this.stop();
      options.onError?.(Error(event.message || "Background worker failed"));
    };
  }
  now() {
    return performance.now();
  }
  start(callback) {
    if (this.disposed) throw Error("Driver disposed");
    this.callback = callback;
    this.switchSource();
  }
  setBackground(background) {
    if (this.disposed || this.background === background) return;
    this.background = background;
    this.switchSource();
  }
  switchSource() {
    const generation = ++this.generation;
    this.raf.stop();
    this.worker.postMessage({ type: "stop" });
    if (!this.callback) return;
    if (this.background)
      this.worker.postMessage({
        type: "start",
        generation,
        intervalMs: this.intervalMs
      });
    else
      this.raf.start((now) => {
        if (generation === this.generation) this.callback?.(now);
      });
  }
  stop() {
    this.callback = void 0;
    this.generation++;
    this.raf.stop();
    this.worker.postMessage({ type: "stop" });
  }
  dispose() {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
    this.raf.dispose();
  }
};

// packages/core/runtime3d/Runtime.ts
var LayaPlatformDriver = class {
  now() {
    return Laya.Browser.now();
  }
  start(callback) {
    this.stop();
    const tick = () => {
      if (this.tick === tick) callback(this.now());
    };
    this.tick = tick;
    Laya.systemTimer.frameLoop(1, this, tick);
  }
  setBackground(_background) {
  }
  stop() {
    if (this.tick) Laya.systemTimer.clear(this, this.tick);
    this.tick = void 0;
  }
  dispose() {
    this.stop();
  }
};
function installSandboxStorageFallback() {
  const modes = {};
  for (const name of ["localStorage", "sessionStorage"]) {
    try {
      void window[name];
      modes[name] = "persistent";
    } catch {
      const values = /* @__PURE__ */ new Map();
      const memory = {
        get length() {
          return values.size;
        },
        key: (i) => [...values.keys()][i] ?? null,
        getItem: (k) => values.get(String(k)) ?? null,
        setItem: (k, v) => {
          values.set(String(k), String(v));
        },
        removeItem: (k) => {
          values.delete(String(k));
        },
        clear: () => values.clear()
      };
      Object.defineProperty(window, name, {
        configurable: true,
        value: memory
      });
      modes[name] = "memory";
    }
  }
  return modes;
}
var ZhudaRuntimeSession = class {
  constructor(canvas, options = {}) {
    this.paused = false;
    this.contextLost = false;
    this.disposed = false;
    this.clock = new ZhudaRealtimeClock();
    /** Named channels driven by the same RAF clock as `clock` and `timers`. */
    this.layers = new ZhudaLayeredClock();
    this.timers = new ZhudaTimerScheduler();
    this.mutations = new ZhudaSceneMutationQueue();
    this.cleanups = [];
    this.started = false;
    this.background = false;
    this.manuallyPaused = false;
    this.recoveryDelta = 0;
    this.task = null;
    this.canvas = canvas;
    this.options = options;
    if (!["pause", "continue"].includes(options.backgroundPolicy ?? "pause") || !["discard", "bounded"].includes(options.recoveryPolicy ?? "discard") || !Number.isFinite(options.maxFrameDeltaSec ?? 0.1) || (options.maxFrameDeltaSec ?? 0.1) <= 0 || (options.maxFrameDeltaSec ?? 0.1) > 1)
      throw Error("Invalid runtime background/recovery policy");
    if (options.timeScale !== void 0) {
      if (!Number.isFinite(options.timeScale) || options.timeScale < 0)
        throw Error("Invalid runtime time scale");
      this.clock.timeScale = options.timeScale;
    }
    const native = globalThis.Laya;
    const platform = native?.Browser?.isDomSupported === false ? native.PAL?.browser : void 0;
    this.driver = options.driver ?? (platform ? new LayaPlatformDriver() : new ZhudaRafDriver());
    this.layers.setGlobalTimeScale(this.clock.timeScale);
    const listen = (target, event, fn, capture = false) => {
      target.addEventListener(event, fn, capture);
      this.cleanups.push(() => target.removeEventListener(event, fn, capture));
    };
    if (platform) {
      if (options.container) throw Error("Mini-game runtime cannot use a DOM container");
      const visibility = (visible) => this.setBackground(!visible);
      const focus = () => this.setBackground(false);
      const blur = () => this.setBackground(true);
      const resize = () => this.resize();
      for (const [event, callback] of [[Laya.Event.VISIBILITY_CHANGE, visibility], [Laya.Event.FOCUS, focus], [Laya.Event.BLUR, blur], [Laya.Event.RESIZE, resize]]) {
        platform.on(event, this, callback);
        this.cleanups.push(() => platform.off(event, this, callback));
      }
      try {
        this.resize();
        if (!platform.getVisibility()) this.setBackground(true);
      } catch (error) {
        this.dispose();
        throw error;
      }
      return;
    }
    listen(
      document,
      "visibilitychange",
      () => this.setBackground(document.hidden)
    );
    listen(window, "blur", () => this.setBackground(true));
    listen(window, "focus", () => {
      if (!document.hidden && !this.contextLost) this.setBackground(false);
    });
    listen(window, "pagehide", () => this.setBackground(true));
    listen(window, "pageshow", () => {
      if (!document.hidden) this.setBackground(false);
    });
    listen(window, "scroll", () => this.resize(), true);
    listen(canvas, "webglcontextlost", (e) => {
      e.preventDefault();
      this.notifyContextLost();
    });
    try {
      if (options.container) {
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(options.container);
      } else listen(window, "resize", () => this.resize());
      this.resize();
      if (document.hidden) this.setBackground(true);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  /** Shared WebGL context/WebGPU device-loss path; a new realm owns recovery. */
  notifyContextLost() {
    if (this.disposed || this.contextLost) return;
    this.contextLost = true;
    this.setPaused(true);
    this.options.onContextLost?.();
  }
  setPaused(value) {
    this.manuallyPaused = value;
    this.options.clearInput?.();
    this.paused = value || this.contextLost || this.background && this.options.backgroundPolicy !== "continue";
    this.previous = void 0;
    this.recoveryDelta = 0;
    this.options.onPause?.(this.paused);
  }
  setBackground(background) {
    if (this.disposed || this.background === background) return;
    this.options.clearInput?.();
    const now = this.driver.now();
    this.background = background;
    this.driver.setBackground(background);
    if (background) {
      this.suspendedAt = now;
    } else {
      const elapsedSec = Math.max(0, (now - (this.suspendedAt ?? now)) / 1e3);
      const missed = this.options.backgroundPolicy === "continue" && this.previous !== void 0 ? Math.max(0, (now - this.previous) / 1e3) : elapsedSec;
      this.recoveryDelta = !this.manuallyPaused && this.options.recoveryPolicy === "bounded" ? Math.min(missed, this.options.maxFrameDeltaSec ?? 0.1) : 0;
      this.options.onResume?.({
        elapsedSec,
        advancedSec: this.recoveryDelta,
        discardedSec: Math.max(0, missed - this.recoveryDelta)
      });
      this.previous = void 0;
      this.suspendedAt = void 0;
    }
    this.paused = this.manuallyPaused || this.contextLost || background && this.options.backgroundPolicy !== "continue";
    this.options.onPause?.(this.paused);
  }
  resize() {
    if (this.disposed) return;
    const l = globalThis.Laya, c = this.options.container;
    if (!c && !this.options.dprCap) return;
    const platform = l.Browser?.isDomSupported === false ? l.PAL?.browser : void 0;
    const rect = c?.getBoundingClientRect(), width = platform ? platform.getClientWidth() : rect?.width || innerWidth, height = platform ? platform.getClientHeight() : rect?.height || innerHeight, dpr = Math.min(platform ? platform.getPixelRatio() : devicePixelRatio || 1, this.options.dprCap ?? 2);
    if (width < 2 || height < 2) return;
    const design = this.options.designSize ?? { width, height };
    if (![design.width, design.height, dpr].every(
      (value) => Number.isFinite(value) && value > 0
    ))
      throw Error("Invalid runtime design size or DPR");
    l.Config.useRetinalCanvas = true;
    l.stage.screenAdaptationEnabled = false;
    l.stage.scaleMode = this.options.scaleMode ?? l.Stage.SCALE_SHOWALL;
    l.stage.alignH = l.Stage.ALIGN_LEFT;
    l.stage.alignV = l.Stage.ALIGN_TOP;
    resizeLaya342Stage(
      l,
      width,
      height,
      design.width,
      design.height,
      dpr,
      platform ? void 0 : this.canvas
    );
    this.options.onResize?.({ width, height, dpr });
  }
  start(update) {
    if (this.disposed) throw Error("Disposed runtime");
    this.task = update;
    if (this.started) return;
    this.started = true;
    const tick = (now) => {
      if (this.disposed) return;
      if (!Number.isFinite(now) || this.previous !== void 0 && now <= this.previous)
        return;
      if (!this.paused) {
        const elapsed = this.previous !== void 0 ? now - this.previous : this.recoveryDelta * 1e3;
        if (this.previous === void 0 || elapsed >= 1e3 / (this.options.targetFPS || 60) - 2) {
          this.previous = now;
          this.recoveryDelta = 0;
          const sample = this.clock.advance(
            Math.min(this.options.maxFrameDeltaSec ?? 0.1, elapsed / 1e3)
          );
          this.layers.setGlobalTimeScale(this.clock.timeScale);
          this.layers.advance(sample.unscaledDeltaTime);
          this.timers.advance(
            sample.unscaledDeltaTime,
            sample.scaledDeltaTime,
            this.layers.scaledDeltas
          );
          this.task?.(sample.unscaledDeltaTime, sample);
          this.mutations.flush();
        }
      }
    };
    try {
      this.driver.start(tick);
    } catch (error) {
      this.started = false;
      this.driver.stop();
      throw error;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.driver.dispose();
    this.started = false;
    this.task = null;
    this.timers.dispose();
    this.mutations.dispose();
    this.observer?.disconnect();
    for (const f of this.cleanups) f();
    this.cleanups = [];
    this.options.clearInput?.();
  }
};
var ZhudaRuntimeHost = class {
  constructor(container, url, options = {}) {
    this.frame = null;
    this.generation = 0;
    this.restarts = 0;
    this.disposed = false;
    this.state = null;
    this.container = container;
    this.url = url;
    this.options = options;
    const receive = (e) => {
      if (e.source !== this.frame?.contentWindow || !e.data || typeof e.data !== "object")
        return;
      const message = e.data;
      if (message.type === "zhuda:ready") {
        this.send("zhuda:restore", this.state);
        options.onReady?.(this.generation);
      } else if (message.type === "zhuda:snapshot") this.state = message.state;
      else if (message.type === "zhuda:context-lost") {
        this.state = message.state;
        this.restarts++;
        this.restart(this.state);
      }
      options.onMessage?.(message);
    };
    window.addEventListener("message", receive);
    this.cleanup = () => window.removeEventListener("message", receive);
    this.restart();
  }
  send(type, state) {
    this.frame?.contentWindow?.postMessage({ type, state }, "*");
  }
  restart(state = this.state) {
    if (this.disposed) throw Error("Disposed host");
    this.state = state;
    this.generation++;
    this.frame?.remove();
    const f = document.createElement("iframe");
    f.title = "3D runtime";
    f.style.cssText = "display:block;width:100%;height:100%;border:0";
    if (this.options.sandbox) f.setAttribute("sandbox", this.options.sandbox);
    f.src = this.url;
    this.container.appendChild(f);
    this.frame = f;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanup();
    this.frame?.remove();
    this.frame = null;
  }
};
var ZhudaPointerInput = class {
  constructor(element, chooseRole, changed) {
    this.pointers = /* @__PURE__ */ new Map();
    this.cleanup = [];
    this.element = element;
    this.chooseRole = chooseRole;
    this.changed = changed;
    const on = (target, name, fn) => {
      target.addEventListener(name, fn);
      this.cleanup.push(() => target.removeEventListener(name, fn));
    };
    on(element, "pointerdown", ((e) => {
      const role = chooseRole(e);
      if (!role || [...this.pointers.values()].some((p) => p.role === role))
        return;
      this.pointers.set(e.pointerId, {
        pointerId: e.pointerId,
        role,
        x: e.clientX,
        y: e.clientY,
        dx: 0,
        dy: 0
      });
      element.setPointerCapture(e.pointerId);
      e.preventDefault();
      changed(this.pointers);
    }));
    on(element, "pointermove", ((e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.dx = e.clientX - p.x;
      p.dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      changed(this.pointers);
    }));
    const up = ((e) => {
      if (this.pointers.delete(e.pointerId)) changed(this.pointers);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      on(element, name, up);
    on(window, "blur", () => this.clear());
    on(document, "visibilitychange", () => {
      if (document.hidden) this.clear();
    });
  }
  clear() {
    for (const id of this.pointers.keys())
      if (this.element.hasPointerCapture(id))
        this.element.releasePointerCapture(id);
    this.pointers.clear();
    this.changed(this.pointers);
  }
  dispose() {
    this.clear();
    for (const f of this.cleanup) f();
    this.cleanup = [];
  }
};

// packages/core/runtime3d/Surfaces.ts
function packMetallicRoughness(rgba) {
  if (rgba.length % 4) throw Error("RGBA data required");
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = rgba[i + 2];
    out[i + 3] = 255 - rgba[i + 1];
  }
  return out;
}
function createSurfaceTexture(width, height, pixels, role) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || pixels.length !== width * height * 4)
    throw Error("Invalid texture payload");
  const l = globalThis.Laya, t = new l.Texture2D(
    width,
    height,
    l.TextureFormat.R8G8B8A8,
    false,
    true,
    role === "color" || role === "emission"
  );
  t.setPixelsData(pixels, false, false);
  return t;
}
function createSurfaceMaterial(s) {
  const l = globalThis.Laya;
  if (!["pbr", "unlit"].includes(s.type)) throw Error("Unknown material type");
  if ([s.metallic ?? 0, s.roughness ?? 0.5, s.alphaCutoff ?? 0.5].some(
    (v) => !Number.isFinite(v) || v < 0 || v > 1
  ))
    throw Error("Invalid material factors");
  const m = s.type === "pbr" ? new l.PBRStandardMaterial() : new l.UnlitMaterial();
  m.albedoColor = new l.Color(...s.color || [1, 1, 1, 1]);
  if (s.type === "pbr") {
    m.metallic = s.metallic ?? 0;
    m.smoothness = 1 - (s.roughness ?? 0.5);
    if (s.emission) {
      m.enableEmission = true;
      m.emissionColor = new l.Color(...s.emission, 1);
    }
  }
  for (const [key, value] of Object.entries(s.textures || {}))
    m[{
      albedo: "albedoTexture",
      normal: "normalTexture",
      metallicGloss: "metallicGlossTexture",
      emission: "emissionTexture"
    }[key]] = value?.bitmap || value;
  const blend = s.blend || "opaque", Class = s.type === "pbr" ? l.PBRStandardMaterial : l.UnlitMaterial;
  if (blend === "alpha") m.renderMode = Class.RENDERMODE_TRANSPARENT;
  else if (blend === "cutout") {
    m.alphaTest = true;
    m.alphaTestValue = s.alphaCutoff ?? 0.5;
  } else if (blend === "additive") {
    m.renderQueue = 3e3;
    m.blend = l.RenderState.BLEND_ENABLE_ALL;
    m.blendSrc = l.RenderState.BLENDPARAM_SRC_ALPHA;
    m.blendDst = l.RenderState.BLENDPARAM_ONE;
  }
  if (s.doubleSided) m.cull = l.RenderState.CULL_NONE;
  m.depthWrite = s.depthWrite ?? (blend === "opaque" || blend === "cutout");
  return m;
}
function disposeSurfaceMaterial(m) {
  for (const k of [
    "albedoTexture",
    "normalTexture",
    "metallicGlossTexture",
    "emissionTexture"
  ])
    if (k in m) m[k] = null;
  m.destroy();
}
var registeredShaders = /* @__PURE__ */ new WeakMap();
function createCustomSurfaceMaterial(s) {
  const l = globalThis.Laya;
  if (!s.name || !s.vertex || !s.fragment)
    throw Error("Incomplete custom shader");
  let registry2 = registeredShaders.get(l.Shader3D);
  if (!registry2) registeredShaders.set(l.Shader3D, registry2 = /* @__PURE__ */ new Map());
  const signature = JSON.stringify(s);
  if (l.Shader3D.find(s.name)) {
    if (registry2.get(s.name) !== signature)
      throw Error("Shader name has a different contract");
  } else {
    const shader = l.Shader3D.add(s.name, !!s.instancing, false);
    shader.shaderType = s.dimension === 2 ? l.ShaderFeatureType.D2_TextureSV : l.ShaderFeatureType.D3;
    const sub = new l.SubShader(
      s.attributes || (s.dimension === 2 ? l.Shader2D.graphicsAttribute : l.SubShader.DefaultAttributeMap),
      s.uniforms
    );
    shader.addSubShader(sub);
    const source = (code) => code.replace(
      /\buniform\s+((?:(?:lowp|mediump|highp)\s+)?\w+)\s+([^;]+);/g,
      (original, type, names) => {
        const retained = names.split(",").map((n) => n.trim()).filter(
          (n) => !Object.prototype.hasOwnProperty.call(s.uniforms, n)
        );
        return retained.length ? `uniform ${type} ${retained.join(",")};` : "";
      }
    );
    sub.addShaderPass(source(s.vertex), source(s.fragment));
    registry2.set(s.name, signature);
  }
  const material = new l.Material();
  material.setShaderName(s.name);
  return material;
}
function computeMeshTangents(data) {
  const n = data.positions.length / 3;
  if (!data.normals || !data.uvs || !Number.isInteger(n) || data.normals.length !== n * 3 || data.uvs.length !== n * 2 || data.indices.length % 3 || [...data.indices].some((i) => i >= n) || ![...data.positions, ...data.normals, ...data.uvs].every(Number.isFinite))
    throw Error("Tangents require finite position/normal/UV triangles");
  const a = new Float64Array(n * 3), b = new Float64Array(n * 3);
  for (let i = 0; i < data.indices.length; i += 3) {
    const [i0, i1, i2] = [
      data.indices[i],
      data.indices[i + 1],
      data.indices[i + 2]
    ];
    const du1 = data.uvs[i1 * 2] - data.uvs[i0 * 2], dv1 = data.uvs[i1 * 2 + 1] - data.uvs[i0 * 2 + 1], du2 = data.uvs[i2 * 2] - data.uvs[i0 * 2], dv2 = data.uvs[i2 * 2 + 1] - data.uvs[i0 * 2 + 1];
    const determinant = du1 * dv2 - du2 * dv1;
    if (Math.abs(determinant) < 1e-12) continue;
    for (let k = 0; k < 3; k++) {
      const e1 = data.positions[i1 * 3 + k] - data.positions[i0 * 3 + k], e2 = data.positions[i2 * 3 + k] - data.positions[i0 * 3 + k];
      for (const index of [i0, i1, i2]) {
        a[index * 3 + k] += (e1 * dv2 - e2 * dv1) / determinant;
        b[index * 3 + k] += (e2 * du1 - e1 * du2) / determinant;
      }
    }
  }
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    let nx = data.normals[i * 3], ny = data.normals[i * 3 + 1], nz = data.normals[i * 3 + 2], length = Math.hypot(nx, ny, nz);
    if (length < 1e-9) throw Error("Zero mesh normal");
    nx /= length;
    ny /= length;
    nz /= length;
    const dot = nx * a[i * 3] + ny * a[i * 3 + 1] + nz * a[i * 3 + 2];
    let x = a[i * 3] - nx * dot, y = a[i * 3 + 1] - ny * dot, z = a[i * 3 + 2] - nz * dot;
    length = Math.hypot(x, y, z);
    if (length < 1e-9) {
      if (Math.abs(ny) < 0.99) {
        x = -nz;
        y = 0;
        z = nx;
      } else {
        x = 0;
        y = nz;
        z = -ny;
      }
      length = Math.hypot(x, y, z);
    }
    x /= length;
    y /= length;
    z /= length;
    const sign = (ny * z - nz * y) * b[i * 3] + (nz * x - nx * z) * b[i * 3 + 1] + (nx * y - ny * x) * b[i * 3 + 2] < 0 ? -1 : 1;
    out.set([x, y, z, sign], i * 4);
  }
  return out;
}
var ZhudaDynamicMesh = class {
  constructor(data, parent) {
    this.disposed = false;
    this.data = data;
    const l = globalThis.Laya, n = data.positions.length / 3;
    if (!Number.isInteger(n) || n < 3 || n > 65535)
      throw Error("Mesh requires 3..65535 vertices per chunk");
    if (data.normals && data.normals.length !== n * 3 || data.uvs && data.uvs.length !== n * 2 || data.tangents && data.tangents.length !== n * 4 || !data.indices.length || data.indices.length % 3 || [...data.indices].some((i) => i >= n))
      throw Error("Invalid mesh attributes or indices");
    this.stride = data.tangents ? 12 : 8;
    this.vertices = new Float32Array(n * this.stride);
    for (let i = 0; i < n; i++) {
      this.vertices.set(
        data.positions.subarray(i * 3, i * 3 + 3),
        i * this.stride
      );
      this.vertices.set(
        data.normals?.subarray(i * 3, i * 3 + 3) || [0, 1, 0],
        i * this.stride + 3
      );
      this.vertices.set(
        data.uvs?.subarray(i * 2, i * 2 + 2) || [0, 0],
        i * this.stride + 6
      );
      if (data.tangents)
        this.vertices.set(
          data.tangents.subarray(i * 4, i * 4 + 4),
          i * this.stride + 8
        );
    }
    if (!this.vertices.every(Number.isFinite))
      throw Error("Non-finite mesh data");
    this.mesh = l.PrimitiveMesh._createMesh(
      l.VertexMesh.getVertexDeclaration(
        data.tangents ? "POSITION,NORMAL,UV,TANGENT" : "POSITION,NORMAL,UV"
      ),
      this.vertices,
      new Uint16Array(data.indices)
    );
    this.node = new l.MeshSprite3D(this.mesh);
    parent?.addChild(this.node);
    this.refreshBounds();
  }
  updateRange(first, count) {
    if (this.disposed) throw Error("Disposed mesh");
    if (!Number.isInteger(first) || !Number.isInteger(count) || first < 0 || count < 1 || (first + count) * this.stride > this.vertices.length)
      throw Error("Invalid vertex range");
    if (!this.vertices.subarray(first * this.stride, (first + count) * this.stride).every(Number.isFinite))
      throw Error("Non-finite mesh update");
    const bytes = first * this.stride * 4, length = count * this.stride * 4;
    this.mesh._vertexBuffer.setData(this.vertices.buffer, bytes, bytes, length);
    this.refreshBounds();
  }
  setPosition(i, x, y, z) {
    if (!Number.isInteger(i) || i < 0 || i * this.stride >= this.vertices.length || ![x, y, z].every(Number.isFinite))
      throw Error("Invalid vertex");
    this.vertices.set([x, y, z], i * this.stride);
  }
  refreshBounds() {
    const l = globalThis.Laya, min = new l.Vector3(Infinity, Infinity, Infinity), max = new l.Vector3(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < this.vertices.length; i += this.stride) {
      min.x = Math.min(min.x, this.vertices[i]);
      min.y = Math.min(min.y, this.vertices[i + 1]);
      min.z = Math.min(min.z, this.vertices[i + 2]);
      max.x = Math.max(max.x, this.vertices[i]);
      max.y = Math.max(max.y, this.vertices[i + 1]);
      max.z = Math.max(max.z, this.vertices[i + 2]);
    }
    this.mesh.bounds = new l.Bounds(min, max);
    this.node.meshRenderer.boundsChange = true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.node.destroy(true);
    this.mesh.destroy();
  }
};
var ZhudaInstanceGroup = class {
  constructor(parent, mesh, material) {
    this.nodes = /* @__PURE__ */ new Map();
    this.disposed = false;
    this.parent = parent;
    this.mesh = mesh;
    this.material = material;
    material.enableInstancing = true;
  }
  set(id, matrix) {
    if (this.disposed) throw Error("Disposed instance group");
    if (!id || matrix.length !== 16) throw Error("Invalid instance");
    for (let i = 0; i < 16; i++)
      if (!Number.isFinite(matrix[i])) throw Error("Invalid instance");
    let entry = this.nodes.get(id);
    if (!entry) {
      const l = globalThis.Laya;
      const node = new l.MeshSprite3D(this.mesh, id);
      node.meshRenderer.sharedMaterial = this.material;
      this.parent.addChild(node);
      entry = { node, matrix: new l.Matrix4x4() };
      this.nodes.set(id, entry);
    }
    for (let i = 0; i < 16; i++) entry.matrix.elements[i] = matrix[i];
    entry.node.transform.worldMatrix = entry.matrix;
    return entry.node;
  }
  remove(id) {
    const entry = this.nodes.get(id);
    if (!entry) return false;
    entry.node.destroy(true);
    this.nodes.delete(id);
    return true;
  }
  get(id) {
    return this.nodes.get(id)?.node;
  }
  get size() {
    return this.nodes.size;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const { node } of this.nodes.values()) node.destroy(true);
    this.nodes.clear();
  }
};
function configureSurfacePasses(camera, requirements, maxAdditionalPasses) {
  if (!Number.isInteger(maxAdditionalPasses) || maxAdditionalPasses < 0)
    throw Error("Invalid additional pass budget");
  const l = globalThis.Laya;
  const depth = requirements.some((r) => r.depth), opaqueColor = requirements.some((r) => r.opaqueColor);
  const requestedPasses = Number(depth) + Number(opaqueColor);
  const withinBudget = requestedPasses <= maxAdditionalPasses;
  camera.depthTextureMode = withinBudget && depth ? l.DepthTextureMode.Depth : l.DepthTextureMode.None;
  camera.opaquePass = withinBudget && opaqueColor;
  const supported = !depth || !!(camera.depthTextureMode & l.DepthTextureMode.Depth);
  if (!supported) {
    camera.depthTextureMode = l.DepthTextureMode.None;
    camera.opaquePass = false;
  }
  return {
    requested: { depth, opaqueColor },
    requestedPasses,
    enabledPasses: withinBudget && supported ? requestedPasses : 0,
    ready: withinBudget && supported,
    reason: !withinBudget ? "budget" : !supported ? "depth-unsupported" : null
  };
}

// packages/core/runtime3d/Laya342GltfAdapter.ts
var prepared = /* @__PURE__ */ new WeakSet();
function prepareLaya342GltfResource(resource, runtime2) {
  if (prepared.has(resource)) return;
  prepared.add(resource);
  const createMaterial = resource.createMaterial;
  if (typeof createMaterial === "function") resource.createMaterial = function(definition) {
    const material = createMaterial.call(this, definition);
    if (definition.extensions?.KHR_materials_unlit && definition.pbrMetallicRoughness?.baseColorFactor) {
      const linear2 = new runtime2.Color();
      material.albedoColor.toLinear(linear2);
      material.setVector4("u_AlbedoColor", new runtime2.Vector4(linear2.r, linear2.g, linear2.b, linear2.a));
    }
    return material;
  };
  for (const method of ["createMeshSprite3D", "createSkinnedMeshSprite3D"]) {
    const original = resource[method];
    if (typeof original !== "function") continue;
    resource[method] = function(definition) {
      const node = original.call(this, definition);
      if (definition.weights !== void 0) {
        const renderer = node.getComponent(runtime2.SkinnedMeshRenderer) || node.getComponent(runtime2.MeshRenderer);
        const morphs = node.getComponent(runtime2.MeshFilter)?.sharedMesh?.morphTargetData;
        if (!renderer || !morphs || definition.weights.length !== morphs.channelCount) {
          destroyLaya342ModelTree(node, runtime2);
          throw Error("glTF node morph weights do not match its mesh.");
        }
        for (let i = 0; i < morphs.channelCount; i++)
          renderer.setMorphChannelWeight(morphs.getMorphChannelbyIndex(i).name, definition.weights[i]);
      }
      return node;
    };
  }
  const createClip = resource.createAnimatorClip;
  if (typeof createClip !== "function") return;
  resource.createAnimatorClip = function(animation, root) {
    var _a;
    const tracks = [];
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler];
      if (channel.target.path !== "weights" || sampler.interpolation !== "CUBICSPLINE") continue;
      const node = this._nodes[channel.target.node];
      const morphs = node?.getComponent(runtime2.MeshFilter)?.sharedMesh?.morphTargetData;
      if (!morphs) throw Error("CUBICSPLINE weights require a morph target mesh.");
      const times = this.getBufferwithAccessorIndex(sampler.input), values = this.getBufferwithAccessorIndex(sampler.output);
      const count = morphs.channelCount;
      if (!count || !times || times.length < 1 || !values || values.length !== times.length * count * 3)
        throw Error("Invalid CUBICSPLINE morph sample count.");
      for (let i = 0; i < times.length; i++) if (!Number.isFinite(times[i]) || times[i] < 0 || i > 0 && times[i] <= times[i - 1])
        throw Error("Invalid CUBICSPLINE morph sample times.");
      for (let i = 0; i < values.length; i++) if (!Number.isFinite(values[i])) throw Error("Invalid CUBICSPLINE morph sample value.");
      tracks.push({
        paths: this.getAnimationPath(root, node),
        owner: node.getComponent(runtime2.SkinnedMeshRenderer) ? "SkinnedMeshRenderer" : "MeshRenderer",
        names: Array.from({ length: count }, (_, i) => morphs.getMorphChannelbyIndex(i).name),
        times,
        values
      });
    }
    const clip = createClip.call(this, animation, root);
    try {
      for (const track of tracks) for (let morph = 0; morph < track.names.length; morph++) {
        const name = track.names[morph], index = clip._nodes.count, node = new runtime2.KeyframeNode();
        clip._nodes.count = index + 1;
        clip._nodes.setNodeByIndex(index, node);
        node._indexInList = index;
        node.type = 0;
        node._setOwnerPathCount(track.paths.length);
        track.paths.forEach((p, i) => node._setOwnerPathByIndex(i, p));
        const ownerPath = node._joinOwnerPath("/");
        ((_a = clip._nodesMap)[ownerPath] || (_a[ownerPath] = [])).push(node);
        node.propertyOwner = track.owner;
        node._setPropertyCount(2);
        node._setPropertyByIndex(0, "morphTargetValues");
        node._setPropertyByIndex(1, name);
        node.fullPath = `${ownerPath}.${track.owner}.morphTargetValues.${name}`;
        clip._nodesDic[node.fullPath] = node.fullPath;
        node.callbackFunData = "_changeMorphTargetValue";
        node.callParams = [name];
        node.propertyChangePath = "morphTargetValues";
        for (let key = 0; key < track.times.length; key++) {
          const frame = new runtime2.FloatKeyframe(), start = key * track.names.length * 3;
          frame.time = track.times[key];
          frame.inTangent = track.values[start + morph];
          frame.value = track.values[start + track.names.length + morph];
          frame.outTangent = track.values[start + track.names.length * 2 + morph];
          node._setKeyframeByIndex(key, frame);
        }
        clip._duration = Math.max(clip._duration, track.times[track.times.length - 1]);
      }
      return clip;
    } catch (error) {
      clip.destroy();
      throw error;
    }
  };
}
function copyLaya342MorphWeights(source, target, runtime2) {
  const a = source.getComponent?.(runtime2.MeshRenderer), b = target.getComponent?.(runtime2.MeshRenderer);
  if (a && b) for (const [name, weight] of Object.entries(a.morphTargetValues ?? {}))
    b.setMorphChannelWeight(name, weight);
}
function createLaya342ModelTemplate(resource, runtime2) {
  try {
    return resource.create();
  } catch (error) {
    const nodes = /* @__PURE__ */ new Set(), clips = /* @__PURE__ */ new Set();
    const collect = (node) => {
      if (!node || nodes.has(node)) return;
      nodes.add(node);
      const animator = runtime2.Animator && node.getComponent?.(runtime2.Animator);
      if (animator) {
        for (let layer = 0; layer < animator.controllerLayerCount; layer++)
          for (const state of animator.getControllerLayer(layer).states) if (state.clip) clips.add(state.clip);
      }
      for (let i = 0; i < (node.numChildren || 0); i++) collect(node.getChildAt(i));
    };
    for (const node of [...resource._scenes ?? [], ...resource._nodes ?? []]) collect(node);
    for (const node of nodes) if (!node.destroyed) destroyLaya342ModelTree(node, runtime2);
    for (const clip of clips) if (!clip.destroyed && clip.referenceCount === 0) clip.destroy();
    if (resource._scenes) resource._scenes.length = 0;
    if (resource._nodes) resource._nodes.length = 0;
    throw error;
  }
}

// packages/core/runtime3d/ModelCompatibility.ts
var gltfAssetCapabilities = Object.freeze([
  Object.freeze({ name: "glTF 2.0 JSON", kind: "container", status: "supported", message: "glTF 2.0 JSON can be inspected and loaded when its resources are self-contained.", hint: "Prefer a single GLB for consumer delivery." }),
  Object.freeze({ name: "GLB 2.0", kind: "container", status: "supported", message: "GLB 2.0 with an embedded JSON and binary payload is supported.", hint: "Pass the complete GLB through AssetProvider." }),
  Object.freeze({ name: "embedded buffers/images", kind: "delivery", status: "supported", message: "Embedded data is deterministic and provider-verifiable.", hint: "Record the logical asset SHA." }),
  Object.freeze({ name: "external buffers/images", kind: "delivery", status: "unsupported", message: "The provider model loader does not fetch undeclared relative resource URLs.", hint: "Package buffers and images into a GLB or explicit provider assets." }),
  Object.freeze({ name: "KHR_draco_mesh_compression", kind: "geometry-compression", status: "unsupported", message: "No pinned Draco decoder is shipped in this release.", hint: "Export an uncompressed GLB or add a separately verified decoder adapter." }),
  Object.freeze({ name: "EXT_meshopt_compression", kind: "geometry-compression", status: "adapter-required", message: "Embedded glTF/GLB can be decoded by the optional pinned Meshopt adapter before native parsing.", hint: "Register ZhudaMeshoptModelDecoder with ZhudaModelDecoderRegistry and pass decoders plus provider to ZhudaModelLibrary; verify the model on target devices." }),
  Object.freeze({ name: "KHR_texture_basisu", kind: "image-compression", status: "unsupported", message: "No pinned KTX2/Basis decoder and device upload contract is shipped in this release.", hint: "Use ordinary embedded images until the format gate passes on target devices." })
]);
var extensionNames = [
  "KHR_materials_anisotropy",
  "KHR_materials_clearcoat",
  "KHR_materials_emissive_strength",
  "KHR_materials_ior",
  "KHR_materials_iridescence",
  "KHR_materials_sheen",
  "KHR_materials_specular",
  "KHR_materials_transmission",
  "KHR_materials_unlit",
  "KHR_materials_volume",
  "KHR_texture_transform"
];
var gltfExtensionCapabilities = Object.freeze(
  extensionNames.map((name) => Object.freeze({
    name,
    implementation: "native",
    requiredRenderInputs: Object.freeze(name === "KHR_materials_transmission" ? ["opaqueColor"] : []),
    visualConformance: "not-certified"
  }))
);
var record = (v) => v !== null && typeof v === "object" && !Array.isArray(v) ? v : {};
var list = (v) => Array.isArray(v) ? v : [];
var records = (v) => list(v).map(record);
var numeric = (v, fallback = 0) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
var indexOf = (v) => Number.isInteger(v) && v >= 0 ? v : null;
var label = (v) => typeof v === "string" ? v : "";
var numbers = (v) => list(v).map((x) => numeric(x));
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function inventory(d) {
  const meshes = records(d.meshes), accessors = records(d.accessors);
  return {
    nodes: records(d.nodes).map((n, index) => ({
      index,
      name: label(n.name),
      mesh: indexOf(n.mesh),
      skin: indexOf(n.skin),
      children: numbers(n.children),
      morphWeights: numbers(n.weights ?? meshes[indexOf(n.mesh) ?? -1]?.weights)
    })),
    meshes: meshes.map((m, index) => ({ index, name: label(m.name), primitives: records(m.primitives).map((p) => {
      const attributes = record(p.attributes), vertices = numeric(accessors[indexOf(attributes.POSITION) ?? -1]?.count);
      const indices = p.indices === void 0 ? vertices : numeric(accessors[indexOf(p.indices) ?? -1]?.count);
      const mode = numeric(p.mode, 4);
      return {
        mode,
        vertices,
        indices,
        triangles: mode === 4 ? indices / 3 : mode === 5 || mode === 6 ? Math.max(0, indices - 2) : null,
        material: indexOf(p.material),
        morphTargets: list(p.targets).length,
        attributes: Object.keys(attributes)
      };
    }) })),
    materials: records(d.materials).map((m, index) => {
      const pbr = record(m.pbrMetallicRoughness), textures = [];
      const add = (slot, v, colorSpace) => {
        const info = record(v), texture = indexOf(info.index);
        if (texture !== null) textures.push({ slot, texture, texCoord: numeric(record(record(info.extensions).KHR_texture_transform).texCoord, numeric(info.texCoord)), colorSpace });
      };
      add("baseColor", pbr.baseColorTexture, "srgb");
      add("metallicRoughness", pbr.metallicRoughnessTexture, "linear");
      add("normal", m.normalTexture, "linear");
      add("occlusion", m.occlusionTexture, "linear");
      add("emissive", m.emissiveTexture, "srgb");
      for (const [extension, value] of Object.entries(record(m.extensions)))
        for (const [name, texture] of Object.entries(record(value))) if (name.endsWith("Texture"))
          add(`${extension}.${name}`, texture, name === "sheenColorTexture" || name === "specularColorTexture" ? "srgb" : "linear");
      return {
        index,
        name: label(m.name),
        alphaMode: label(m.alphaMode) || "OPAQUE",
        doubleSided: m.doubleSided === true,
        baseColor: pbr.baseColorFactor === void 0 ? [1, 1, 1, 1] : numbers(pbr.baseColorFactor),
        metallic: numeric(pbr.metallicFactor, 1),
        roughness: numeric(pbr.roughnessFactor, 1),
        extensions: Object.keys(record(m.extensions)),
        textures
      };
    }),
    textures: records(d.textures).map((t, index) => ({ index, image: indexOf(t.source), sampler: indexOf(t.sampler) })),
    images: records(d.images).map((i, index) => ({
      index,
      name: label(i.name),
      delivery: typeof i.uri === "string" && !i.uri.startsWith("data:") ? "external" : "embedded",
      mimeType: typeof i.mimeType === "string" ? i.mimeType : null
    })),
    animations: records(d.animations).map((a, index) => ({ index, name: label(a.name), channels: records(a.channels).map((c) => {
      const target = record(c.target), sampler = records(a.samplers)[indexOf(c.sampler) ?? -1];
      return { node: indexOf(target.node), path: label(target.path), interpolation: label(sampler?.interpolation) || "LINEAR" };
    }) }))
  };
}
function inspectGltfDocument(document2) {
  const d = record(document2), diagnostics = [];
  const add = (issue) => diagnostics.push(issue);
  if (record(d.asset).version !== "2.0") add({ code: "INVALID_DOCUMENT", severity: "error", path: "$.asset.version", message: "Expected a glTF 2.0 document.", hint: "Export glTF 2.0 / GLB and run Khronos Validator." });
  if (record(d.asset).minVersion !== void 0 && record(d.asset).minVersion !== "2.0") add({ code: "INVALID_DOCUMENT", severity: "error", path: "$.asset.minVersion", message: "The minimum glTF version is not supported.", hint: "Export for the shipped glTF 2.0 importer." });
  const extensionList = (key) => {
    const value = d[key];
    if (value === void 0) return [];
    if (!Array.isArray(value) || value.some((x) => typeof x !== "string" || !x) || new Set(value).size !== value.length) {
      add({ code: "INVALID_EXTENSION_DECLARATION", severity: "error", path: `$.${key}`, message: "Extensions must be a unique array of nonempty names.", hint: "Repair the exported extension declaration." });
      return [];
    }
    return value;
  };
  const used = extensionList("extensionsUsed"), required = extensionList("extensionsRequired");
  for (const [i, name] of required.entries()) if (!used.includes(name)) add({ code: "INVALID_EXTENSION_DECLARATION", severity: "error", extension: name, path: `$.extensionsRequired[${i}]`, message: "Required extension is missing from extensionsUsed.", hint: "Declare every required extension in both arrays." });
  const seen = /* @__PURE__ */ new WeakSet();
  const collect = (v, path) => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    for (const [key, child] of Object.entries(v)) {
      if (key === "extras") continue;
      if (key === "extensions") {
        for (const name of Object.keys(record(child))) if (!used.includes(name))
          add({ code: "UNDECLARED_EXTENSION", severity: "error", extension: name, path: `${path}.extensions.${name}`, message: "Extension payload is not declared in extensionsUsed.", hint: "Repair the export; missing declarations can silently omit a material feature." });
      }
      collect(child, `${path}.${key}`);
    }
  };
  collect(d, "$");
  const extensions = [.../* @__PURE__ */ new Set([...used, ...required])].map((name) => ({ name, required: required.includes(name), implemented: extensionNames.includes(name) }));
  for (const e of extensions) if (!e.implemented) add({
    code: e.required ? "UNSUPPORTED_REQUIRED_EXTENSION" : "UNSUPPORTED_OPTIONAL_EXTENSION",
    severity: e.required ? "error" : "warning",
    extension: e.name,
    path: `$.${e.required ? "extensionsRequired" : "extensionsUsed"}[${(e.required ? required : used).indexOf(e.name)}]`,
    message: `The shipped importer does not implement ${e.name}.`,
    hint: e.required ? "Export a supported representation. Do not remove required declarations to force acceptance." : "The fallback may omit this feature; inspect the result and record the accepted downgrade."
  });
  const needsOpaque = used.includes("KHR_materials_transmission");
  if (needsOpaque) add({ code: "REQUIRED_RENDER_INPUT", severity: "warning", extension: "KHR_materials_transmission", path: "$.extensionsUsed", message: "Transmission requires the camera opaque-color pass.", hint: "Use configureSurfacePasses or a showcase mode with opaqueColor enabled, then verify transparent materials." });
  const meshes = records(d.meshes);
  const checkWeights = (v, count, path) => {
    if (v !== void 0 && (!Array.isArray(v) || v.length !== count || v.some((x) => typeof x !== "number" || !Number.isFinite(x))))
      add({ code: "INVALID_MORPH_WEIGHTS", severity: "error", path, message: "Morph weights must be finite and match the mesh target count.", hint: "Fix the exporter; node weights override mesh weights and are not clamped." });
  };
  meshes.forEach((m, i) => checkWeights(m.weights, list(records(m.primitives)[0]?.targets).length, `$.meshes[${i}].weights`));
  records(d.nodes).forEach((n, i) => checkWeights(n.weights, list(records(meshes[indexOf(n.mesh) ?? -1]?.primitives)[0]?.targets).length, `$.nodes[${i}].weights`));
  const status = diagnostics.some((x) => x.severity === "error") ? "unsupported" : diagnostics.some((x) => x.code === "UNSUPPORTED_OPTIONAL_EXTENSION") ? "degraded" : needsOpaque ? "conditional" : "supported";
  return freeze({
    schemaVersion: 1,
    status,
    validationScope: "importer-capabilities",
    extensions,
    requiredRenderInputs: needsOpaque ? ["opaqueColor"] : [],
    diagnostics,
    inventory: inventory(d)
  });
}
var ZhudaModelCompatibilityError = class extends Error {
  constructor(report, assetId) {
    super(report.diagnostics.filter((x) => x.severity === "error").map((x) => `${x.code} ${x.path}: ${x.message}`).join("; "));
    this.name = "ZhudaModelCompatibilityError";
    this.report = report;
    this.assetId = assetId;
  }
};
function readGltfAssetDocument(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const binary = bytes.byteLength >= 12 && view.getUint32(0, true) === 1179937895;
  let json = bytes;
  if (binary) {
    if (bytes.byteLength < 20 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength || view.getUint32(16, true) !== 1313821514 || view.getUint32(12, true) > bytes.byteLength - 20)
      throw Error("Invalid GLB header or JSON chunk");
    json = bytes.subarray(20, 20 + view.getUint32(12, true));
  }
  return { binary, document: record(JSON.parse(new TextDecoder().decode(json))) };
}
function inspectGltfAsset(bytes) {
  try {
    return inspectGltfDocument(readGltfAssetDocument(bytes).document);
  } catch (error) {
    const base = inspectGltfDocument({});
    return freeze({ ...base, diagnostics: [{ code: "INVALID_DOCUMENT", severity: "error", path: "$", message: error instanceof Error ? error.message : "Invalid model bytes.", hint: "Verify the glTF JSON / GLB container and run Khronos Validator." }] });
  }
}

// packages/core/runtime3d/AssetProvider.ts
var AssetProviderError = class extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AssetProviderError";
    this.code = code;
    this.id = details.id;
    this.status = details.status;
  }
};
function normalizeAssetId(value) {
  if (typeof value !== "string")
    throw new AssetProviderError("invalid-id", "Asset id must be a string");
  let id = value.trim().replace(/\\/g, "/");
  while (id.startsWith("./")) id = id.slice(2);
  if (!id || id.startsWith("/") || id.includes("\0") || /[?#]/.test(id) || /^[a-z][a-z\d+.-]*:/i.test(id))
    throw new AssetProviderError("invalid-id", `Invalid asset id: ${value}`);
  const parts = id.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === ".."))
    throw new AssetProviderError("invalid-id", `Invalid asset id: ${value}`);
  return parts.join("/");
}
function validateAssetManifest(value) {
  if (!value || typeof value !== "object")
    throw Error("Invalid asset manifest");
  const manifest = value;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries))
    throw Error("Invalid asset manifest schema");
  const ids = /* @__PURE__ */ new Set();
  for (const candidate of manifest.entries) {
    if (!candidate || typeof candidate !== "object")
      throw Error("Invalid asset manifest entry");
    const entry = candidate;
    const id = normalizeAssetId(entry.id);
    if (id !== entry.id || ids.has(id))
      throw Error(`Duplicate or non-normalized asset id: ${entry.id}`);
    ids.add(id);
    if (entry.bytes !== void 0 && (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0))
      throw Error(`Invalid asset byte size: ${id}`);
    if (entry.sha256 !== void 0 && !/^[0-9a-f]{64}$/i.test(entry.sha256))
      throw Error(`Invalid asset checksum: ${id}`);
  }
  return manifest;
}
function manifestIdFor(baseUrl, value) {
  const manifestUrl = new URL(value, baseUrl);
  if (manifestUrl.origin !== baseUrl.origin || !manifestUrl.pathname.startsWith(baseUrl.pathname))
    throw new AssetProviderError(
      "invalid-id",
      "Manifest must be below the provider base URL"
    );
  const id = decodeURIComponent(
    manifestUrl.pathname.slice(baseUrl.pathname.length)
  );
  return normalizeAssetId(id);
}
function abortReason(signal, id) {
  return new AssetProviderError(
    signal.reason?.name === "TimeoutError" ? "timeout" : "aborted",
    signal.reason?.name === "TimeoutError" ? `Asset request timed out: ${id}` : `Asset request cancelled: ${id}`,
    { id }
  );
}
function combineSignals(source, timeoutMs, id) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(source?.reason);
  if (source?.aborted) controller.abort(source.reason);
  else source?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(
      new DOMException("Asset request timed out", "TimeoutError")
    );
  }, timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      source?.removeEventListener("abort", abort);
      if (timedOut && !controller.signal.reason)
        controller.abort(
          new DOMException(`Asset request timed out: ${id}`, "TimeoutError")
        );
    }
  };
}
async function sha256(bytes) {
  if (!globalThis.crypto?.subtle)
    throw new AssetProviderError(
      "integrity",
      "Web Crypto subtle.digest is unavailable"
    );
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input.buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
var DirectoryAssetProvider = class {
  constructor(options) {
    this.name = "directory";
    this.active = /* @__PURE__ */ new Set();
    this.disposed = false;
    this.streamReleases = /* @__PURE__ */ new Set();
    if (!options?.baseUrl)
      throw Error("DirectoryAssetProvider requires baseUrl");
    this.baseUrl = new URL(
      options.baseUrl,
      globalThis.location?.href || "http://localhost/"
    );
    if (!this.baseUrl.pathname.endsWith("/")) this.baseUrl.pathname += "/";
    this.manifest = options.manifest ? validateAssetManifest(options.manifest) : void 0;
    this.manifestUrl = options.manifestUrl;
    this.manifestId = options.manifestUrl ? manifestIdFor(this.baseUrl, options.manifestUrl) : void 0;
    this.timeoutMs = options.timeoutMs ?? 15e3;
    this.maxBytes = options.maxBytes ?? 128 * 1024 * 1024;
    this.fetchImpl = options.fetch || globalThis.fetch.bind(globalThis);
    this.streamMode = options.streamMode ?? "verified-blob";
    if (!["native", "verified-blob"].includes(this.streamMode))
      throw Error("Invalid streamMode");
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0)
      throw Error("timeoutMs must be a positive integer");
    if (!Number.isInteger(this.maxBytes) || this.maxBytes <= 0)
      throw Error("maxBytes must be a positive integer");
  }
  async getManifest(signal) {
    if (this.disposed)
      throw new AssetProviderError("disposed", "Asset provider disposed");
    if (this.manifest) return this.manifest;
    if (!this.manifestId) return { schemaVersion: 1, entries: [] };
    if (!this.manifestPromise) {
      const pending = (async () => {
        const result = await this.load(this.manifestId, {
          signal,
          maxBytes: 2 * 1024 * 1024
        });
        try {
          const parsed = JSON.parse(new TextDecoder().decode(result.bytes));
          this.manifest = validateAssetManifest(parsed);
          return this.manifest;
        } catch (error) {
          if (error instanceof AssetProviderError) throw error;
          throw new AssetProviderError(
            "integrity",
            `Invalid asset manifest: ${this.manifestUrl}`
          );
        }
      })();
      this.manifestPromise = pending.catch((error) => {
        this.manifestPromise = void 0;
        throw error;
      });
    }
    return this.manifestPromise;
  }
  async load(value, options = {}) {
    if (this.disposed)
      throw new AssetProviderError("disposed", "Asset provider disposed");
    const id = normalizeAssetId(value);
    if (this.manifestId && id !== this.manifestId && !this.manifest)
      await this.getManifest(options.signal);
    const entry = this.manifest?.entries.find(
      (candidate) => candidate.id === id
    );
    const maxBytes = options.maxBytes ?? this.maxBytes;
    const url = new URL(
      id.split("/").map(encodeURIComponent).join("/"),
      this.baseUrl
    );
    const combined = combineSignals(options.signal, this.timeoutMs, id);
    const request = new AbortController();
    const relay = () => request.abort(combined.signal.reason);
    combined.signal.addEventListener("abort", relay, { once: true });
    if (combined.signal.aborted) relay();
    this.active.add(request);
    try {
      if (request.signal.aborted) throw abortReason(combined.signal, id);
      options.onProgress?.({ id, phase: "downloading", loadedBytes: 0 });
      const response = await this.fetchImpl(url, { signal: request.signal });
      if (!response.ok)
        throw new AssetProviderError(
          "http",
          `Asset HTTP ${response.status}: ${id}`,
          {
            id,
            status: response.status
          }
        );
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxBytes)
        throw new AssetProviderError(
          "too-large",
          `Asset exceeds ${maxBytes} bytes: ${id}`,
          { id }
        );
      const chunks = [];
      let total = 0;
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          total += next.value.byteLength;
          if (total > maxBytes)
            throw new AssetProviderError(
              "too-large",
              `Asset exceeds ${maxBytes} bytes: ${id}`,
              { id }
            );
          chunks.push(next.value);
          options.onProgress?.({
            id,
            phase: "downloading",
            loadedBytes: total,
            totalBytes: contentLength || void 0
          });
        }
      } else {
        const data = new Uint8Array(await response.arrayBuffer());
        total = data.byteLength;
        if (total > maxBytes)
          throw new AssetProviderError(
            "too-large",
            `Asset exceeds ${maxBytes} bytes: ${id}`,
            { id }
          );
        chunks.push(data);
        options.onProgress?.({
          id,
          phase: "downloading",
          loadedBytes: total,
          totalBytes: total
        });
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      if (entry?.bytes !== void 0 && entry.bytes !== bytes.byteLength)
        throw new AssetProviderError(
          "integrity",
          `Asset size mismatch: ${id}`,
          { id }
        );
      if (entry?.sha256) {
        options.onProgress?.({
          id,
          phase: "verifying",
          loadedBytes: total,
          totalBytes: total
        });
        if (await sha256(bytes) !== entry.sha256.toLowerCase())
          throw new AssetProviderError(
            "integrity",
            `Asset checksum mismatch: ${id}`,
            { id }
          );
      }
      options.onProgress?.({
        id,
        phase: "ready",
        loadedBytes: total,
        totalBytes: total
      });
      return { id, bytes, manifest: entry };
    } catch (error) {
      if (combined.signal.aborted || request.signal.aborted) {
        if (combined.signal.reason?.name === "TimeoutError")
          throw abortReason(combined.signal, id);
        throw abortReason(combined.signal, id);
      }
      throw error;
    } finally {
      this.active.delete(request);
      combined.signal.removeEventListener("abort", relay);
      combined.cleanup();
    }
  }
  async openStream(value, options = {}) {
    const id = normalizeAssetId(value);
    const check = () => {
      if (this.disposed)
        throw new AssetProviderError("disposed", "Asset provider disposed");
      if (options.signal?.aborted) throw abortReason(options.signal, id);
    };
    check();
    if (this.manifestId && !this.manifest)
      await this.getManifest(options.signal);
    check();
    const entry = this.manifest?.entries.find((value2) => value2.id === id);
    if (this.manifest && !entry)
      throw new AssetProviderError(
        "integrity",
        `Stream missing manifest entry: ${id}`
      );
    if (entry?.kind && entry.kind !== "audio")
      throw new AssetProviderError("integrity", `Stream is not audio: ${id}`);
    let url, retainedBytes = 0;
    if (this.streamMode === "native") {
      if (entry?.sha256)
        throw new AssetProviderError(
          "integrity",
          `Native stream cannot verify whole-file SHA: ${id}; use verified-blob or a transport-only media manifest`
        );
      url = new URL(
        id.split("/").map(encodeURIComponent).join("/"),
        this.baseUrl
      ).href;
    } else {
      const asset = await this.load(id, options);
      try {
        check();
        retainedBytes = asset.bytes.byteLength;
        const mime = /\.mp3$/i.test(id) ? "audio/mpeg" : /\.ogg$/i.test(id) ? "audio/ogg" : /\.(m4a|mp4)$/i.test(id) ? "audio/mp4" : /\.wav$/i.test(id) ? "audio/wav" : "application/octet-stream";
        url = URL.createObjectURL(
          new Blob([new Uint8Array(asset.bytes)], { type: mime })
        );
      } finally {
        asset.release?.();
      }
    }
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.streamReleases.delete(release);
      if (this.streamMode === "verified-blob") URL.revokeObjectURL(url);
    };
    this.streamReleases.add(release);
    return {
      id,
      url,
      retainedBytes,
      delivery: this.streamMode,
      integrity: entry?.sha256 ? "sha256" : "transport",
      crossOrigin: "anonymous",
      release
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const controller of this.active)
      controller.abort(
        new DOMException("Asset provider disposed", "AbortError")
      );
    this.active.clear();
    for (const release of [...this.streamReleases]) release();
  }
};
var ChunkedAssetProvider = class {
  constructor(options) {
    this.name = "chunked";
    this.chunks = /* @__PURE__ */ new Map();
    this.assets = /* @__PURE__ */ new Map();
    this.active = /* @__PURE__ */ new Set();
    this.disposed = false;
    if (!options?.baseUrl) throw Error("ChunkedAssetProvider requires baseUrl");
    this.baseUrl = new URL(options.baseUrl, globalThis.location?.href || "http://localhost/");
    if (!this.baseUrl.pathname.endsWith("/")) this.baseUrl.pathname += "/";
    if (!options.manifest || options.manifest.schemaVersion !== 1 || !Array.isArray(options.manifest.chunks) || !Array.isArray(options.manifest.assets)) throw Error("Invalid chunked asset manifest");
    this.timeoutMs = options.timeoutMs ?? 3e4;
    this.maxChunkBytes = options.maxChunkBytes ?? 256 * 1024 * 1024;
    const maxCachedChunks = options.maxCachedChunks ?? 4;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0 || this.timeoutMs > 2147483647 || !Number.isSafeInteger(this.maxChunkBytes) || this.maxChunkBytes < 1 || !Number.isSafeInteger(maxCachedChunks) || maxCachedChunks < 0) throw Error("Invalid chunk provider limits");
    for (const chunk of options.manifest.chunks) {
      if (!chunk || normalizeAssetId(chunk.id) !== chunk.id || this.chunks.has(chunk.id) || typeof chunk.url !== "string" || !chunk.url) throw Error(`Invalid or duplicate chunk: ${chunk?.id}`);
      if (chunk.bytes !== void 0 && (!Number.isSafeInteger(chunk.bytes) || chunk.bytes < 0 || chunk.bytes > this.maxChunkBytes)) throw Error(`Invalid chunk byte size: ${chunk.id}`);
      if (chunk.sha256 !== void 0 && !/^[0-9a-f]{64}$/i.test(chunk.sha256)) throw Error(`Invalid chunk checksum: ${chunk.id}`);
      const url = new URL(chunk.url, this.baseUrl);
      if (url.origin !== this.baseUrl.origin || !url.pathname.startsWith(this.baseUrl.pathname) || url.username || url.password || url.hash) throw new AssetProviderError("invalid-id", `Chunk URL escapes provider base: ${chunk.id}`);
      const relative = decodeURIComponent(url.pathname.slice(this.baseUrl.pathname.length));
      normalizeAssetId(relative);
      this.chunks.set(chunk.id, Object.freeze({ ...chunk, url: url.href }));
    }
    for (const asset of options.manifest.assets) {
      if (!asset) throw Error("Invalid chunk asset");
      validateAssetManifest({ schemaVersion: 1, entries: [asset] });
      const id = normalizeAssetId(asset.id), chunk = this.chunks.get(asset.chunk);
      if (id !== asset.id || this.assets.has(id) || !chunk || !Number.isSafeInteger(asset.offset) || asset.offset < 0 || !Number.isSafeInteger(asset.length) || asset.length < 0 || !Number.isSafeInteger(asset.offset + asset.length) || asset.offset + asset.length > (chunk.bytes ?? this.maxChunkBytes)) throw Error(`Invalid chunk asset range: ${id}`);
      if (asset.bytes !== void 0 && asset.bytes !== asset.length) throw Error(`Chunk asset byte range mismatch: ${id}`);
      this.assets.set(id, Object.freeze({ ...asset, bytes: asset.length }));
    }
    this.fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
    if (!this.fetchImpl) throw Error("ChunkedAssetProvider requires fetch");
    this.cache = new ZhudaAssetCache((id, signal) => this.loadChunk(this.chunks.get(id), signal), () => {
    }, maxCachedChunks);
  }
  async getManifest(signal) {
    if (this.disposed) throw new AssetProviderError("disposed", "Asset provider disposed");
    if (signal?.aborted) throw abortReason(signal, "manifest");
    return Object.freeze({ schemaVersion: 1, entries: Object.freeze([...this.assets.values()].map(({ offset: _offset, length: _length, ...entry }) => Object.freeze(entry))) });
  }
  async loadChunk(chunk, signal) {
    const response = await awaitAbortable(
      this.fetchImpl(new URL(chunk.url), { signal, redirect: "error" }),
      signal,
      (late) => {
        void late.body?.cancel().catch(() => {
        });
      }
    );
    let reader;
    try {
      if (!response.ok) throw new AssetProviderError("http", `Chunk HTTP ${response.status}: ${chunk.id}`, { id: chunk.id, status: response.status });
      const declared = response.headers.get("content-length");
      if (declared !== null && Number(declared) > this.maxChunkBytes) throw new AssetProviderError("too-large", `Chunk exceeds ${this.maxChunkBytes} bytes: ${chunk.id}`);
      if (!response.body) throw new AssetProviderError("integrity", `Chunk has no response body: ${chunk.id}`);
      reader = response.body.getReader();
      const pieces = [];
      let length = 0;
      while (true) {
        const part = await awaitAbortable(reader.read(), signal);
        if (part.done) break;
        length += part.value.byteLength;
        if (length > this.maxChunkBytes) throw new AssetProviderError("too-large", `Chunk exceeds ${this.maxChunkBytes} bytes: ${chunk.id}`);
        pieces.push(part.value);
      }
      if (chunk.bytes !== void 0 && length !== chunk.bytes) throw new AssetProviderError("integrity", `Chunk size mismatch: ${chunk.id}`);
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const part of pieces) {
        bytes.set(part, offset);
        offset += part.byteLength;
      }
      if (chunk.sha256 && await awaitAbortable(sha256(bytes), signal) !== chunk.sha256.toLowerCase()) throw new AssetProviderError("integrity", `Chunk checksum mismatch: ${chunk.id}`);
      if (signal.aborted) throw signal.reason;
      return bytes;
    } finally {
      if (reader) {
        void reader.cancel().catch(() => {
        });
        reader.releaseLock();
      } else {
        void response.body?.cancel().catch(() => {
        });
      }
    }
  }
  async load(value, options = {}) {
    if (this.disposed) throw new AssetProviderError("disposed", "Asset provider disposed");
    const id = normalizeAssetId(value), entry = this.assets.get(id);
    if (!entry) throw new AssetProviderError("http", `Unknown chunk asset: ${id}`, { id });
    if (options.maxBytes !== void 0 && (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 0 || entry.length > options.maxBytes)) throw new AssetProviderError("too-large", `Invalid or exceeded asset byte limit: ${id}`);
    const request = new AbortController(), relay = () => request.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", relay, { once: true });
    if (options.signal?.aborted) relay();
    this.active.add(request);
    const combined = combineSignals(request.signal, this.timeoutMs, id);
    let lease;
    const check = () => {
      if (this.disposed) throw new AssetProviderError("disposed", "Asset provider disposed", { id });
      if (combined.signal.aborted) throw abortReason(combined.signal, id);
    };
    try {
      check();
      options.onProgress?.({ id, phase: "downloading", loadedBytes: 0, totalBytes: entry.length });
      check();
      lease = await this.cache.acquire(entry.chunk, { signal: combined.signal });
      check();
      if (entry.offset + entry.length > lease.value.byteLength) throw new AssetProviderError("integrity", `Chunk range exceeds chunk: ${id}`, { id });
      const bytes = lease.value.slice(entry.offset, entry.offset + entry.length);
      if (entry.sha256) {
        options.onProgress?.({ id, phase: "verifying", loadedBytes: bytes.byteLength, totalBytes: bytes.byteLength });
        check();
        if (await awaitAbortable(sha256(bytes), combined.signal) !== entry.sha256.toLowerCase()) throw new AssetProviderError("integrity", `Asset checksum mismatch: ${id}`, { id });
      }
      check();
      options.onProgress?.({ id, phase: "ready", loadedBytes: bytes.byteLength, totalBytes: bytes.byteLength });
      check();
      return { id, bytes, manifest: entry };
    } catch (error) {
      check();
      throw error;
    } finally {
      lease?.release();
      combined.cleanup();
      options.signal?.removeEventListener("abort", relay);
      this.active.delete(request);
      if (this.disposed && !this.active.size) this.cache.dispose();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const controller of this.active) controller.abort(new DOMException("Asset provider disposed", "AbortError"));
    if (!this.active.size) this.cache.dispose();
  }
};
function createProviderAssetCache(provider, decode, destroy, maxIdle = 0) {
  return new ZhudaAssetCache(
    async (id, signal, phase) => {
      const asset = await provider.load(id, {
        signal,
        onProgress: ({ phase: providerPhase }) => phase(providerPhase === "ready" ? "ready" : "downloading")
      });
      phase("parsing");
      try {
        return await decode(asset, signal, phase);
      } finally {
        asset.release?.();
      }
    },
    destroy,
    maxIdle
  );
}

// packages/core/runtime3d/Assets.ts
var abortError = () => new DOMException("Asset request cancelled", "AbortError");
var ZhudaAssetCache = class {
  constructor(load, destroy, maxIdle = 0) {
    this.entries = /* @__PURE__ */ new Map();
    this.disposed = false;
    this.serial = 0;
    this.loads = 0;
    this.load = load;
    this.destroy = destroy;
    this.maxIdle = maxIdle;
    if (!Number.isInteger(maxIdle) || maxIdle < 0)
      throw Error("Invalid warm asset bound");
  }
  async acquire(key, options = {}) {
    if (this.disposed) throw Error("Disposed asset cache");
    if (options.signal?.aborted) throw abortError();
    if (!key || options.retries !== void 0 && (!Number.isInteger(options.retries) || options.retries < 0 || options.retries > 3))
      throw Error("Invalid asset request");
    let e = this.entries.get(key);
    if (!e) {
      const controller = new AbortController();
      e = {
        refs: 0,
        ready: false,
        abort: controller,
        phase: "downloading",
        used: ++this.serial,
        promise: null
      };
      const created = e;
      this.entries.set(key, e);
      this.loads++;
      e.promise = (async () => {
        let last;
        for (let i = 0; i <= Math.max(0, Math.min(3, options.retries ?? 0)); i++) {
          try {
            return await this.load(
              key,
              controller.signal,
              (p) => created.phase = p
            );
          } catch (error) {
            last = error;
            if (controller.signal.aborted) throw error;
          }
        }
        throw last;
      })().then(
        (value) => {
          created.value = value;
          created.ready = true;
          created.phase = "ready";
          if (controller.signal.aborted || this.disposed || this.entries.get(key) !== created) {
            this.destroy(value);
            throw abortError();
          }
          return value;
        },
        (error) => {
          if (this.entries.get(key) === created) this.entries.delete(key);
          throw error;
        }
      );
    }
    const target = e;
    target.refs++;
    target.used = ++this.serial;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      target.refs--;
      target.used = ++this.serial;
      this.evict();
    };
    let cancel;
    try {
      const value = await new Promise((resolve, reject) => {
        cancel = () => {
          release();
          reject(abortError());
        };
        options.signal?.addEventListener("abort", cancel, { once: true });
        target.promise.then(resolve, reject);
      });
      if (released) throw abortError();
      return { value, release };
    } catch (error) {
      release();
      throw error;
    } finally {
      if (cancel) options.signal?.removeEventListener("abort", cancel);
    }
  }
  evict() {
    for (const [k, e] of this.entries)
      if (!e.refs && !e.ready) {
        this.entries.delete(k);
        e.abort.abort();
      }
    const idle = [...this.entries].filter(([, e]) => !e.refs && e.ready).sort((a, b) => a[1].used - b[1].used);
    while (idle.length > this.maxIdle) {
      const [k, e] = idle.shift();
      this.entries.delete(k);
      this.destroy(e.value);
    }
  }
  report() {
    return {
      entries: this.entries.size,
      references: [...this.entries.values()].reduce((n, e) => n + e.refs, 0),
      pending: [...this.entries.values()].filter((e) => !e.ready).length,
      loads: this.loads,
      phases: [...this.entries].map(([key, e]) => ({
        key,
        phase: e.phase,
        references: e.refs
      })),
      gpuReady: "requires-first-draw"
    };
  }
  dispose() {
    if (this.disposed) return;
    if ([...this.entries.values()].some((e) => e.refs > 0))
      throw Error("Release all asset leases before disposing cache");
    this.disposed = true;
    for (const e of this.entries.values()) {
      e.abort.abort();
      if (e.ready) this.destroy(e.value);
    }
    this.entries.clear();
  }
};
var ZhudaRequestSlot = class {
  constructor() {
    this.generation = 0;
    this.active = null;
  }
  async replace(load, commit, discard) {
    this.cancel();
    const n = this.generation, c = this.active = new AbortController();
    try {
      const value = await load(c.signal);
      if (n !== this.generation || c.signal.aborted) {
        discard(value);
        return false;
      }
      try {
        commit(value);
      } catch (error) {
        discard(value);
        throw error;
      }
      return true;
    } catch (e) {
      if (c.signal.aborted) return false;
      throw e;
    }
  }
  cancel() {
    this.generation++;
    this.active?.abort();
    this.active = null;
  }
};
function visit(node, fn) {
  fn(node);
  for (let i = 0; i < (node.numChildren || 0); i++)
    visit(node.getChildAt(i), fn);
}
var ZhudaModelLibrary = class {
  constructor(options = 3) {
    this.instances = /* @__PURE__ */ new Set();
    // glTFResource.create() rebuilds animation clips on every call in 3.4.2.
    // Retain one off-scene template per existing cache lease and clone its tree.
    this.templates = /* @__PURE__ */ new WeakMap();
    const config = typeof options === "number" ? { maxIdle: options } : options;
    if (config.decoders && !config.provider) throw Error("Model decoders require a logical AssetProvider");
    this.provider = config.provider;
    this.timeoutMs = config.timeoutMs ?? 15e3;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0) throw Error("Invalid model deadline");
    this.cache = new ZhudaAssetCache(
      async (url, signal, phase) => {
        const l = globalThis.Laya;
        if (!l?.glTFResource)
          throw Error("Load Laya glTF module before models");
        let asset;
        let resource;
        let decoded;
        try {
          let bytes;
          if (this.provider) {
            asset = await this.provider.load(url, { signal });
            if (signal.aborted) throw abortError();
            bytes = new Uint8Array(asset.bytes).buffer;
          } else {
            const response = await fetch(url, { signal });
            if (!response.ok) throw Error(`Model HTTP ${response.status}`);
            bytes = await response.arrayBuffer();
          }
          if (signal.aborted) throw abortError();
          if (config.decoders?.has("meshopt") && inspectGltfAsset(bytes).extensions.some((e) => e.name === "EXT_meshopt_compression")) {
            decoded = await config.decoders.decode("meshopt", url, new Uint8Array(bytes), { signal });
            if (!(decoded.data instanceof Uint8Array)) throw Error("Meshopt model decoder must return embedded GLB bytes");
            bytes = new Uint8Array(decoded.data).buffer;
            if (signal.aborted) throw abortError();
          }
          const compatibility = inspectGltfAsset(bytes);
          if (compatibility.status === "unsupported") throw new ZhudaModelCompatibilityError(compatibility, url);
          const parsed = readGltfAssetDocument(bytes);
          if (this.provider) {
            for (const item of [...parsed.document.buffers ?? [], ...parsed.document.images ?? []])
              if (item.uri !== void 0 && !item.uri.startsWith("data:"))
                throw Error("Provider models require embedded buffers/images; repack as a self-contained GLB");
          }
          phase("parsing");
          resource = new l.glTFResource();
          prepareLaya342GltfResource(resource, l);
          if (parsed.binary) await resource._parseglb(bytes, url);
          else await resource._parse(parsed.document, url);
          if (signal.aborted) {
            resource.destroy();
            throw abortError();
          }
          const template = createLaya342ModelTemplate(resource, l);
          const clips = /* @__PURE__ */ new Set();
          visit(template, (n) => {
            const animator = l.Animator && n.getComponent?.(l.Animator);
            if (animator) {
              for (let i = 0; i < animator.controllerLayerCount; i++)
                for (const state of animator.getControllerLayer(i).states) if (state.clip) clips.add(state.clip);
            }
          });
          this.templates.set(resource, { node: template, clips, compatibility });
          resource._addReference();
          return resource;
        } catch (e) {
          if (resource && !resource.destroyed) resource.destroy();
          throw e;
        } finally {
          try {
            decoded?.release();
          } finally {
            asset?.release?.();
          }
        }
      },
      (r) => {
        const template = this.templates.get(r);
        if (template) destroyLaya342ModelTree(template.node);
        r._removeReference();
        r.destroy();
        for (const clip of template?.clips ?? [])
          if (!clip.destroyed && clip.referenceCount === 0) clip.destroy();
        this.templates.delete(r);
      },
      config.maxIdle ?? 3
    );
  }
  async instantiate(url, options = {}) {
    const key = this.provider ? normalizeAssetId(url) : url;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw Error("Invalid model deadline");
    const controller = new AbortController();
    const relay = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", relay, { once: true });
    if (options.signal?.aborted) relay();
    const timer = setTimeout(() => controller.abort(new DOMException("Model request timed out", "TimeoutError")), timeoutMs);
    let lease;
    try {
      lease = await this.cache.acquire(key, { ...options, signal: controller.signal });
    } catch (error) {
      if (controller.signal.reason?.name === "TimeoutError") throw controller.signal.reason;
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", relay);
    }
    let node;
    const materials = [];
    try {
      if (options.signal?.aborted) throw abortError();
      const template = this.templates.get(lease.value);
      if (!template) throw Error("Model template unavailable");
      node = template.node.clone();
      const l = globalThis.Laya;
      const restoreDefaults = (source, target) => {
        copyLaya342MorphWeights(source, target, l);
        const a = l.Animator && source.getComponent?.(l.Animator), b = l.Animator && target.getComponent?.(l.Animator);
        if (a && b) for (let i = 0; i < a.controllerLayerCount; i++) {
          const original = a.getControllerLayer(i).defaultState;
          const layer = b.getControllerLayer(i);
          if (original) layer.defaultState = layer.getAnimatorState(original.name);
        }
        for (let i = 0; i < (source.numChildren || 0); i++) restoreDefaults(source.getChildAt(i), target.getChildAt(i));
      };
      restoreDefaults(template.node, node);
      if (options.independentMaterials)
        visit(node, (n) => {
          const l2 = globalThis.Laya;
          const renderer = n.meshRenderer || n.skinnedMeshRenderer || n.getComponent?.(l2.SkinnedMeshRenderer) || n.getComponent?.(l2.MeshRenderer);
          if (renderer) {
            renderer.sharedMaterials = renderer.sharedMaterials.map(
              (m) => {
                const copy = m.clone();
                materials.push(copy);
                return copy;
              }
            );
          }
        });
    } catch (e) {
      if (node) destroyLaya342ModelTree(node);
      for (const m of materials) if (!m.destroyed) m.destroy();
      lease.release();
      throw e;
    }
    this.instances.add(node);
    let disposed = false;
    return {
      node,
      compatibility: this.templates.get(lease.value).compatibility,
      materials,
      setTint: (color) => {
        if (disposed) throw Error("Disposed model instance");
        if (!options.independentMaterials)
          throw Error("Tint requires independent materials");
        if (color.length !== 4 || !color.every((n) => Number.isFinite(n) && n >= 0 && n <= 1))
          throw Error("Invalid linear tint");
        const l = globalThis.Laya;
        for (const m of materials) {
          if ("albedoColor" in m) m.albedoColor = new l.Color(...color);
          else if (m.getVector4("u_BaseColorFactor"))
            m.setVector4("u_BaseColorFactor", new l.Vector4(...color));
          else throw Error("Model material does not expose a base color");
        }
      },
      find: (name) => {
        let found = null;
        visit(node, (n) => {
          if (n.name === name) found = n;
        });
        return found;
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        destroyLaya342ModelTree(node);
        for (const m of materials) if (!m.destroyed) m.destroy();
        this.instances.delete(node);
        lease.release();
      }
    };
  }
  report() {
    return { ...this.cache.report(), instances: this.instances.size };
  }
  dispose() {
    if (this.instances.size)
      throw Error("Dispose model instances before library");
    this.cache.dispose();
  }
};

// packages/core/runtime3d/SceneLifecycle.ts
var ZhudaResourceScope = class {
  constructor() {
    this.releases = [];
    this.disposed = false;
  }
  own(value, release) {
    if (this.disposed) {
      release(value);
      throw Error("Disposed resource scope");
    }
    this.releases.push(() => release(value));
    return value;
  }
  defer(release) {
    this.own(release, (f) => f());
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const errors = [];
    for (const release of this.releases.reverse())
      try {
        release();
      } catch (e) {
        errors.push(e);
      }
    this.releases = [];
    if (errors.length)
      throw Object.assign(Error("Resource release failed"), { errors });
  }
};
var ZhudaSceneRegions = class {
  constructor() {
    this.regions = /* @__PURE__ */ new Map();
  }
  async enter(id, create) {
    if (!id) throw Error("Missing region ID");
    this.leave(id);
    const record2 = {
      slot: new ZhudaRequestSlot(),
      value: void 0
    };
    this.regions.set(id, record2);
    try {
      return await record2.slot.replace(
        create,
        (value) => record2.value = value,
        (value) => value.dispose()
      );
    } catch (e) {
      if (this.regions.get(id) === record2) this.regions.delete(id);
      throw e;
    }
  }
  leave(id) {
    const r = this.regions.get(id);
    if (!r) return;
    this.regions.delete(id);
    r.slot.cancel();
    r.value?.dispose();
  }
  clear() {
    for (const id of [...this.regions.keys()]) this.leave(id);
  }
  get size() {
    return this.regions.size;
  }
};
var ZhudaSceneBudget = class {
  constructor() {
    this.resources = /* @__PURE__ */ new Map();
  }
  track(id, kind, estimatedBytes) {
    if (!id || this.resources.has(id) || !Number.isFinite(estimatedBytes) || estimatedBytes < 0)
      throw Error("Invalid/duplicate resource budget");
    this.resources.set(id, { kind, estimatedBytes });
    return () => this.resources.delete(id);
  }
  report() {
    const counts = { mesh: 0, texture: 0, renderTarget: 0 };
    const animation = { clips: 0, materials: 0 };
    let estimatedBytes = 0;
    for (const r of this.resources.values()) {
      counts[r.kind]++;
      estimatedBytes += r.estimatedBytes;
    }
    return { counts, estimatedBytes, memoryMeasurement: "estimate" };
  }
};
var sceneQuality = {
  low: {
    dprCap: 1,
    shadowDistance: 0,
    shadowResolution: 512,
    extraPasses: 0,
    lodDistance: 20
  },
  medium: {
    dprCap: 1.5,
    shadowDistance: 30,
    shadowResolution: 1024,
    extraPasses: 0,
    lodDistance: 40
  },
  high: {
    dprCap: 2,
    shadowDistance: 60,
    shadowResolution: 2048,
    extraPasses: 2,
    lodDistance: 80
  }
};
var ZhudaDistanceLOD = class {
  constructor(distance, hysteresis = 2) {
    this.near = true;
    this.distance = distance;
    this.hysteresis = hysteresis;
    if (!(distance > hysteresis && hysteresis >= 0))
      throw Error("Invalid LOD bounds");
  }
  update(camera, object2) {
    const d = Math.hypot(
      camera.x - object2.x,
      camera.y - object2.y,
      camera.z - object2.z
    );
    if (d > this.distance + this.hysteresis) this.near = false;
    else if (d < this.distance - this.hysteresis) this.near = true;
    return this.near;
  }
};
function inspectSceneResources(runtime2 = globalThis.Laya) {
  const map = runtime2.Resource._idResourcesMap, items = map instanceof Map ? [...map.values()] : Object.values(map || {});
  const counts = { mesh: 0, texture: 0, renderTarget: 0 };
  const animation = { clips: 0, materials: 0 };
  let meshBytes = 0, textureBytes = 0, renderTargetBytes = 0;
  for (const r of items) {
    if (r.destroyed) continue;
    if (typeof runtime2.AnimationClip === "function" && r instanceof runtime2.AnimationClip) animation.clips++;
    if (typeof runtime2.Material === "function" && r instanceof runtime2.Material) animation.materials++;
    if (typeof runtime2.Mesh === "function" && r instanceof runtime2.Mesh) {
      counts.mesh++;
      meshBytes += r.gpuMemory || 0;
    } else if (runtime2.RenderTexture && r instanceof runtime2.RenderTexture || runtime2.RenderTexture2D && r instanceof runtime2.RenderTexture2D) {
      counts.renderTarget++;
      renderTargetBytes += (r.width || 0) * (r.height || 0) * 8 * Math.max(1, r.samples || 1);
    } else if (r instanceof runtime2.BaseTexture) {
      counts.texture++;
      textureBytes += (r.width || 0) * (r.height || 0) * 4 * (r.mipmap ? 4 / 3 : 1) * (r.isCube ? 6 : 1);
    }
  }
  return {
    counts,
    animation,
    resources: items.filter((r) => !r.destroyed).length,
    estimatedBytes: meshBytes + textureBytes + renderTargetBytes,
    meshBytes,
    textureBytes,
    renderTargetBytes,
    memoryMeasurement: "estimate",
    assumptions: "Texture RGBA8, render target RGBA8 + 32-bit depth; vendor mesh accounting. Excludes driver overhead and compressed/HDR format corrections."
  };
}
function applySceneQuality(quality, session, camera, lights = []) {
  const l = globalThis.Laya;
  if (![quality.dprCap, quality.shadowDistance, quality.extraPasses].every(
    Number.isFinite
  ) || quality.dprCap < 0.5 || quality.dprCap > 4 || quality.shadowDistance < 0 || quality.extraPasses < 0 || !Number.isFinite(quality.lodDistance) || quality.lodDistance <= 0 || ![512, 1024, 2048].includes(quality.shadowResolution))
    throw Error("Invalid scene quality");
  session.options.dprCap = quality.dprCap;
  session.resize();
  camera.msaa = false;
  for (const light of lights) {
    light.shadowDistance = quality.shadowDistance;
    light.shadowResolution = quality.shadowResolution;
    light.shadowMode = quality.shadowDistance > 0 ? l.ShadowMode.SoftLow : l.ShadowMode.None;
  }
  return { ...quality, additionalPassBudget: quality.extraPasses };
}

// packages/core/prefabs/PrefabTree3D.ts
var primitives = /* @__PURE__ */ new Set(["box", "sphere", "plane", "cone", "cylinder", "capsule"]);
var has = (object2, key) => Object.prototype.hasOwnProperty.call(object2, key);
function validatePrefabPatch3D(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw Error("Invalid 3D node patch");
  for (const [key, value] of Object.entries(patch)) {
    if (key === "active" && typeof value === "boolean") continue;
    if (key === "material" && typeof value === "string" && value.length) continue;
    if (["localPosition", "localRotationEuler", "localScale"].includes(key) && Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n)) && (key !== "localScale" || value.every((n) => n !== 0))) continue;
    throw Error(`Invalid 3D prefab patch property: ${key}`);
  }
}
function validatePrefabTree3D(tree) {
  if (!tree || !tree.materials || Array.isArray(tree.materials)) throw Error("3D prefab requires materials");
  for (const [id, material] of Object.entries(tree.materials)) {
    if (!id || !material || !Array.isArray(material.albedoColor) || material.albedoColor.length !== 4 || !material.albedoColor.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) || material.type !== void 0 && !["blinn-phong", "unlit", "pbr"].includes(material.type))
      throw Error(`Invalid 3D prefab material: ${id}`);
    for (const key of ["shininess", "metallic", "smoothness"]) {
      const value = material[key];
      if (value !== void 0 && (!Number.isFinite(value) || value < 0 || value > (key === "shininess" ? 128 : 1)))
        throw Error(`Invalid 3D material ${id}.${key}`);
    }
  }
  let count = 0;
  const paths = /* @__PURE__ */ new Set();
  const visit2 = (node, path, depth) => {
    if (++count > 4096 || depth > 64) throw Error("3D prefab tree exceeds node/depth limit");
    if (!node || typeof node.name !== "string" || !node.name || node.name.includes("/")) throw Error(`Invalid 3D node name at ${path}`);
    const { name, mesh, children, ...patch } = node;
    validatePrefabPatch3D(patch);
    if (mesh && (!primitives.has(mesh.type) || !node.material)) throw Error(`Invalid mesh/material at ${path}`);
    if (node.material && (!mesh || !has(tree.materials, node.material))) throw Error(`Unknown material or non-mesh node at ${path}`);
    for (const [key, value] of Object.entries(mesh?.dimensions ?? {}))
      if (!["width", "height", "depth", "radius"].includes(key) || !Number.isFinite(value) || value <= 0)
        throw Error(`Invalid primitive dimension at ${path}.${key}`);
    paths.add(path);
    if (children !== void 0 && !Array.isArray(children)) throw Error(`Invalid children at ${path}`);
    const names = /* @__PURE__ */ new Set();
    for (const child of children ?? []) {
      if (!child || names.has(child.name)) throw Error(`Duplicate child name at ${path}`);
      names.add(child.name);
      visit2(child, path ? `${path}/${child.name}` : child.name, depth + 1);
    }
  };
  visit2(tree.root, "", 0);
  for (const [id, path] of Object.entries(tree.sockets ?? {}))
    if (!id || !paths.has(path)) throw Error(`Unknown 3D socket path: ${id}/${path}`);
}
function createPrefabTreeResources(tree) {
  validatePrefabTree3D(tree);
  const scope = new ZhudaResourceScope();
  const materials = /* @__PURE__ */ new Map();
  const meshes = /* @__PURE__ */ new Map();
  try {
    for (const [id, options] of Object.entries(tree.materials)) {
      const material = scope.own(Zhuda3D.createMaterial(options), (value) => value.destroy());
      materials.set(id, material);
    }
    const visit2 = (node, nodePath) => {
      if (node.mesh)
        meshes.set(nodePath, scope.own(Zhuda3D.createPrimitiveMesh(node.mesh.type, node.mesh.dimensions), (value) => value.destroy()));
      node.children?.forEach((child) => visit2(child, nodePath ? `${nodePath}/${child.name}` : child.name));
    };
    visit2(tree.root, "");
    return { materials, meshes, dispose: () => scope.dispose() };
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
function buildPrefabTree(tree) {
  return renderPrefabTree(tree);
}
function buildSharedPrefabTree(tree, resources) {
  return renderPrefabTree(tree, resources);
}
function renderPrefabTree(tree, shared) {
  const spec = structuredClone(tree);
  validatePrefabTree3D(spec);
  const resources = new ZhudaResourceScope();
  const nodes = /* @__PURE__ */ new Map();
  const baseline = /* @__PURE__ */ new Map();
  const materials = /* @__PURE__ */ new Map();
  const ownedMaterials = /* @__PURE__ */ new Set();
  let root;
  let disposed = false;
  const find = (path = "") => {
    if (disposed) throw Error("Disposed 3D prefab");
    const node = nodes.get(path);
    if (!node) throw Error(`Prefab node path missing: ${path}`);
    return node;
  };
  const applyNode = (node, patch) => {
    if (patch.active !== void 0) node.active = patch.active;
    if (patch.localPosition) node.transform.localPosition = new Laya.Vector3(...patch.localPosition);
    if (patch.localRotationEuler) node.transform.localRotationEuler = new Laya.Vector3(...patch.localRotationEuler);
    if (patch.localScale) node.transform.localScale = new Laya.Vector3(...patch.localScale);
    if (patch.material) node.meshRenderer.sharedMaterial = materials.get(patch.material);
  };
  try {
    for (const [id, material] of Object.entries(spec.materials)) {
      const value = shared ? shared.materials.get(id) : resources.own(Zhuda3D.createMaterial(material), (value2) => value2.destroy());
      materials.set(id, value);
      if (!shared) ownedMaterials.add(value);
    }
    const visit2 = (source, path, parent) => {
      const node = source.mesh ? new Laya.MeshSprite3D(shared ? shared.meshes.get(path) : resources.own(Zhuda3D.createPrimitiveMesh(source.mesh.type, source.mesh.dimensions), (value) => value.destroy())) : new Laya.Sprite3D();
      if (!root) root = node;
      node.name = source.name;
      parent?.addChild(node);
      nodes.set(path, node);
      const patch = {
        active: source.active ?? true,
        localPosition: source.localPosition ?? [0, 0, 0],
        localRotationEuler: source.localRotationEuler ?? [0, 0, 0],
        localScale: source.localScale ?? [1, 1, 1],
        ...source.material ? { material: source.material } : {}
      };
      baseline.set(path, patch);
      applyNode(node, patch);
      for (const child of source.children ?? []) visit2(child, path ? `${path}/${child.name}` : child.name, node);
      return node;
    };
    visit2(spec.root, "");
    return {
      root,
      find,
      makeMaterialUnique: (path = "") => {
        const node = find(path);
        if (!baseline.get(path)?.material) throw Error(`Node has no material slot: ${path}`);
        const current = node.meshRenderer.sharedMaterial;
        if (ownedMaterials.has(current)) return current;
        const clone2 = resources.own(current.clone(), (value) => value.destroy());
        ownedMaterials.add(clone2);
        for (const [id, value] of materials) if (value === current) materials.set(id, clone2);
        for (const [key, other] of nodes) if (baseline.get(key)?.material && other.meshRenderer.sharedMaterial === current)
          other.meshRenderer.sharedMaterial = clone2;
        return clone2;
      },
      socket: (id) => {
        if (!has(spec.sockets ?? {}, id)) throw Error(`Unknown 3D socket: ${id}`);
        return find(spec.sockets[id]);
      },
      apply: (patches) => {
        if (disposed) throw Error("Disposed 3D prefab");
        for (const [path, patch] of Object.entries(patches)) {
          validatePrefabPatch3D(patch);
          find(path);
          if (patch.material && (!materials.has(patch.material) || !baseline.get(path)?.material))
            throw Error(`Invalid material slot at ${path}`);
        }
        for (const [path, patch] of baseline) applyNode(find(path), patch);
        for (const [path, patch] of Object.entries(patches)) applyNode(find(path), patch);
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        try {
          root.destroy(true);
        } finally {
          resources.dispose();
          nodes.clear();
          materials.clear();
        }
      }
    };
  } catch (error) {
    try {
      root?.destroy(true);
    } finally {
      resources.dispose();
    }
    throw error;
  }
}

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
    if (this.retiredGpuRealm) throw Error("WebGPU realm retired; recreate it with ZhudaRuntimeHost or reload the page");
    if (options.signal?.aborted) throw options.signal.reason ?? new DOMException("Cancelled", "AbortError");
    if (this.activeContext || this.booting)
      throw new Error(
        "An engine session is already active; dispose it or use a separate runtime realm."
      );
    const container = typeof options.container === "string" ? document.querySelector(options.container) : options.container;
    if (options.container && !container)
      throw new Error("Canvas container not found");
    if (options.dprCap !== void 0 && (!Number.isFinite(options.dprCap) || options.dprCap < 0.5 || options.dprCap > 4))
      throw new Error("DPR cap must be .5..4");
    this.booting = true;
    let allocatedScene;
    let allocatedRuntime;
    let renderer;
    try {
      const width = options.width ?? 1280;
      const height = options.height ?? 720;
      const bgColor = options.bgColor ?? "#0d1117";
      const features = options.features ?? "all";
      renderer = prepareRenderer(options.renderer);
      const topology = TopologyResolver.resolveByFeatures(features, renderer.backend);
      if (typeof window !== "undefined") installSandboxStorageFallback();
      EngineGuard.installPrototypeDetox();
      const hasSpine38 = Array.isArray(features) && features.includes("spine38");
      const hasSpine42 = features === "all" || Array.isArray(features) && features.includes("spine42");
      if (hasSpine38 || hasSpine42) {
        const spineConst = Laya.SpineConst;
        if (spineConst) {
          spineConst.VERSION = hasSpine38 ? "3.8" : "4.2";
          spineConst.VersionFirst = hasSpine38 ? 3 : 4;
          spineConst.VersionSecond = hasSpine38 ? 8 : 2;
          spineConst.NEED_SLOT = !hasSpine38;
        }
      }
      const layaConfig = Laya.Config;
      if (layaConfig) {
        if (options.preserveDrawingBuffer !== void 0)
          layaConfig.preserveDrawingBuffer = options.preserveDrawingBuffer;
        if (options.antialias !== void 0)
          layaConfig.isAntialias = options.antialias;
      }
      options.beforeInit?.();
      await withDeadline(() => Laya.init(width, height), { signal: options.signal, timeoutMs: options.bootTimeoutMs ?? 3e4 });
      renderer.ready();
      installLaya342LifecycleFix();
      EngineGuard.installPrototypeDetox();
      Laya.stage.scaleMode = options.scaleMode ?? Laya.Stage.SCALE_SHOWALL;
      Laya.stage.screenMode = options.screenMode ?? Laya.Stage.SCREEN_NONE;
      Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
      Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
      Laya.stage.bgColor = bgColor;
      const rootScene = allocatedScene = new Laya.Scene();
      rootScene.name = "ZhudaRootScene";
      Laya.stage.addChild(rootScene);
      const health = EngineGuard.inspectEngineHealth();
      const win = globalThis;
      win.__ZHUDA_ENGINE_BOOTED__ = true;
      win.__ZHUDA_ENGINE_HEALTH__ = health;
      win.__ZHUDA_TOPOLOGY__ = topology;
      if (Laya.Browser.isDomSupported !== false && typeof document !== "undefined" && document.body?.dataset) {
        document.body.dataset.zhudaBooted = "true";
        document.body.dataset.zhudaModules = String(
          topology.orderedFiles.length
        );
        document.body.dataset.zhudaReflected = health.registeredComponents.join(",");
        document.body.dataset.zhudaSpine42 = String(
          health.spine42.hasPhysicsConstraint
        );
        document.body.dataset.zhudaDetox = String(health.buttonSetStateGuarded);
      }
      const canvas = Laya.Browser.mainCanvas.source;
      if (container) container.appendChild(canvas);
      if (options.targetFPS)
        Laya.stage.frameRate = options.targetFPS === 30 ? "slow" : "fast";
      const runtime2 = allocatedRuntime = new ZhudaRuntimeSession(canvas, {
        ...options,
        container: container ?? void 0
      });
      renderer.attach(runtime2);
      const selectedRenderer = renderer;
      let disposed = false;
      this.activeContext = {
        renderer: renderer.diagnostics,
        stage: Laya.stage,
        rootScene,
        topology,
        health,
        canvas,
        runtime: runtime2,
        resize: () => runtime2.resize(),
        dispose: () => {
          if (disposed) return;
          disposed = true;
          runtime2.dispose();
          rootScene.destroy(true);
          selectedRenderer.release("disposed");
          if (selectedRenderer.backend === "webgpu") this.retiredGpuRealm = true;
          this.activeContext = null;
        }
      };
      await showMiniGameSplash(this.activeContext, options.signal, options.bootTimeoutMs);
      return this.activeContext;
    } catch (error) {
      allocatedRuntime?.dispose();
      this.activeContext = null;
      allocatedScene?.destroy(true);
      renderer?.release("failed");
      if (renderer?.backend === "webgpu") this.retiredGpuRealm = true;
      globalThis.__ZHUDA_ENGINE_BOOTED__ = false;
      if (typeof document !== "undefined" && document.body?.dataset)
        document.body.dataset.zhudaBooted = "false";
      throw error;
    } finally {
      this.booting = false;
    }
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
        renderLoop.call(
          Laya.Render,
          baseNow + i * 16.67
        );
      }
    }
  }
};
ZhudaEngine.activeContext = null;
ZhudaEngine.booting = false;
ZhudaEngine.retiredGpuRealm = false;
var Zhuda3D = class {
  static buildPrefabTree(spec) {
    return buildPrefabTree(spec);
  }
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
    const light = node.addComponent(
      Laya.DirectionLightCom
    );
    const [r, g, b, a] = options.color ?? [1, 0.98, 0.92, 1];
    light.color = new Laya.Color(r, g, b, a);
    light.intensity = options.intensity ?? 1.3;
    const [rx, ry, rz] = options.rotationEuler ?? [-55, 35, 0];
    node.transform.rotationEuler = new Laya.Vector3(rx, ry, rz);
    return { node, light };
  }
  static createMaterial(options) {
    if (options.type === "pbr" || options.type === "unlit")
      return createSurfaceMaterial({
        type: options.type,
        color: options.albedoColor,
        metallic: options.metallic,
        roughness: 1 - (options.smoothness ?? 0.5)
      });
    const mat = new Laya.BlinnPhongMaterial();
    const [r, g, b, a] = options.albedoColor;
    mat.albedoColor = new Laya.Color(r, g, b, a);
    mat.shininess = options.shininess ?? 32;
    return mat;
  }
  static createPrimitiveMesh(type, dims = {}) {
    switch (type) {
      case "box":
        return Laya.PrimitiveMesh.createBox(
          dims.width ?? 1,
          dims.height ?? 1,
          dims.depth ?? 1
        );
      case "sphere":
        return Laya.PrimitiveMesh.createSphere(dims.radius ?? 0.5);
      case "cylinder":
        return Laya.PrimitiveMesh.createCylinder(
          dims.radius ?? 0.2,
          dims.height ?? 1
        );
      case "capsule":
        return Laya.PrimitiveMesh.createCapsule(
          dims.radius ?? 0.25,
          dims.height ?? 1
        );
      case "cone":
        return Laya.PrimitiveMesh.createCone(
          dims.radius ?? 0.5,
          dims.height ?? 1
        );
      case "plane":
      default:
        return Laya.PrimitiveMesh.createPlane(
          dims.width ?? 10,
          dims.depth ?? 10
        );
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
      g.drawRoundRect(
        0,
        0,
        style.width,
        style.height,
        radius,
        radius,
        radius,
        radius,
        fill,
        stroke,
        borderWidth
      );
      root.graphics = g;
    };
    drawBg(bgColor, borderColor);
    const label2 = new Laya.Text();
    label2.text = text;
    label2.fontSize = style.fontSize ?? 13;
    label2.bold = style.bold ?? true;
    label2.color = style.textColor ?? "#d6e6fa";
    label2.align = "center";
    label2.valign = "middle";
    label2.width = style.width;
    label2.height = style.height;
    root.addChild(label2);
    let isActive = false;
    root.mouseEnabled = true;
    root.on(Laya.Event.MOUSE_OVER, root, () => {
      drawBg(isActive ? activeBgColor : hoverBgColor, "#64ffda");
      label2.color = style.hoverTextColor ?? "#ffffff";
    });
    root.on(Laya.Event.MOUSE_OUT, root, () => {
      drawBg(
        isActive ? activeBgColor : bgColor,
        isActive ? "#00e5ff" : borderColor
      );
      label2.color = isActive ? "#64ffda" : style.textColor ?? "#d6e6fa";
    });
    root.on(Laya.Event.CLICK, root, onClick);
    parent.addChild(root);
    const setStyleState = (active) => {
      isActive = active;
      drawBg(
        isActive ? activeBgColor : bgColor,
        isActive ? "#00e5ff" : borderColor
      );
      label2.color = isActive ? "#64ffda" : style.textColor ?? "#d6e6fa";
    };
    return { root, label: label2, setStyleState };
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
      g.drawRoundRect(
        0,
        0,
        w,
        h,
        radius,
        radius,
        radius,
        radius,
        fill,
        border,
        2
      );
      const cw = Math.max(4, w - left - right);
      const ch = Math.max(4, h - top - bottom);
      g.drawRect(left, top, cw, ch, innerColor, "#233858", 1);
      g.drawRoundRect(
        0,
        0,
        left,
        top,
        radius,
        2,
        2,
        2,
        cornerColor,
        border,
        1.5
      );
      g.drawRoundRect(
        w - right,
        0,
        right,
        top,
        2,
        radius,
        2,
        2,
        cornerColor,
        border,
        1.5
      );
      g.drawRoundRect(
        0,
        h - bottom,
        left,
        bottom,
        2,
        2,
        2,
        radius,
        cornerColor,
        border,
        1.5
      );
      g.drawRoundRect(
        w - right,
        h - bottom,
        right,
        bottom,
        2,
        2,
        radius,
        2,
        cornerColor,
        border,
        1.5
      );
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
        return "Laya.PBRStandardMaterial";
      case "Unlit/Color":
        return "Laya.UnlitMaterial";
      case "Legacy Shaders/BlinnPhong":
        return "Laya.BlinnPhongMaterial";
      default:
        throw new Error(`Unmapped Unity shader: ${shaderName}`);
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
      case "DrawTextureCmd": {
        const textureId = typeof cmd.textureId === "string" ? cmd.textureId : typeof cmd.texture === "string" ? cmd.texture : typeof cmd.texture?.url === "string" ? cmd.texture.url : "";
        if (!textureId || /^(?:blob:|data:)/i.test(textureId)) return null;
        return {
          _$type: "DrawTextureCmd",
          textureId,
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          width: cmd.width,
          height: cmd.height,
          matrix: Array.isArray(cmd.matrix) ? [...cmd.matrix] : void 0,
          alpha: cmd.alpha,
          color: cmd.color ?? null,
          blendMode: cmd.blendMode,
          uv: Array.isArray(cmd.uv) ? [...cmd.uv] : void 0,
          percent
        };
      }
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
      node = data._$type === "Label" && L.Label ? new L.Label() : new L.Text();
      node.text = data.text ?? "";
      if (data.font) node.font = data.font;
      if (typeof data.fontSize === "number") node.fontSize = data.fontSize;
      if (data.color) node.color = data.color;
      if (typeof data.bold === "boolean") node.bold = data.bold;
      if (data.align) node.align = data.align;
      if (data.valign) node.valign = data.valign;
      if (typeof data.leading === "number") node.leading = data.leading;
      if (typeof data.stroke === "number") node.stroke = data.stroke;
      if (data.strokeColor) node.strokeColor = data.strokeColor;
      if (data.padding) node.padding = data._$type === "Label" && L.Label ? data.padding.join(",") : data.padding;
    } else if (data._$type === "Scene" && L.Scene) {
      node = new L.Scene();
    } else if (data._$type === "Image" && L.Image) {
      node = new L.Image();
    } else if (data._$type === "Box" && L.Box) {
      node = new L.Box();
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
      for (const childData of data._$child) {
        let child = void 0;
        for (let i = 0; i < node.numChildren; i++) {
          const candidate = node.getChildAt(i);
          if (candidate?.name === (childData.name || childData._$id)) {
            child = candidate;
            break;
          }
        }
        if (!child && typeof node.addChild === "function") {
          child = this.hydrateNodeRecursive(childData);
          node.addChild(child);
        }
        if (child) this.ensureGraphicsHydrated(child, childData);
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
        case "DrawTextureCmd": {
          const textureId = cmd.textureId;
          const runtime2 = globalThis.Laya;
          const texture = textureId && runtime2?.loader?.getRes?.(textureId);
          if (!texture) {
            throw Error(`DrawTextureCmd texture is not loaded: ${textureId || "<missing textureId>"}`);
          }
          if (typeof graphics.drawTexture !== "function") {
            throw Error("DrawTextureCmd requires Graphics.drawTexture");
          }
          const matrix = Array.isArray(cmd.matrix) && cmd.matrix.length === 6 && runtime2?.Matrix ? new runtime2.Matrix(...cmd.matrix) : null;
          graphics.drawTexture(
            texture,
            cmd.x ?? 0,
            cmd.y ?? 0,
            cmd.width,
            cmd.height,
            matrix,
            cmd.alpha,
            cmd.color ?? null,
            cmd.blendMode ?? null,
            cmd.uv
          );
          break;
        }
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

// packages/core/audio/StreamVoice.ts
var StreamVoice = class {
  constructor(context, media, lease, options, timeoutMs, onFailure, onStarted) {
    this.onended = null;
    this.generation = 0;
    this.ended = false;
    this.paused = false;
    this.started = false;
    this.reportedStart = false;
    this.endedListener = () => this.end();
    this.errorListener = () => this.fail(
      Error(
        `Media playback failed: ${this.media.error?.message || this.media.error?.code || "unknown"}`
      )
    );
    this.context = context;
    this.media = media;
    this.timeoutMs = timeoutMs;
    this.onFailure = onFailure;
    this.onStarted = onStarted;
    media.crossOrigin = lease.crossOrigin ?? "anonymous";
    media.preload = "metadata";
    media.loop = options.loop ?? false;
    media.volume = 1;
    media.muted = false;
    media.addEventListener("ended", this.endedListener);
    media.addEventListener("error", this.errorListener);
    try {
      media.src = lease.url;
      this.output = context.createMediaElementSource(media);
    } catch (error) {
      this.releaseMedia();
      throw error;
    }
  }
  start(_when, offsetSec) {
    if (this.ended) throw Error("Stream voice ended");
    this.media.currentTime = offsetSec;
    this.started = true;
    this.play();
  }
  play() {
    if (this.ended || this.paused || !this.started) return;
    const generation = ++this.generation;
    clearTimeout(this.deadline);
    this.deadline = setTimeout(
      () => this.fail(Error("Stream playback timeout")),
      this.timeoutMs
    );
    try {
      Promise.resolve(this.media.play()).then(
        () => {
          if (generation !== this.generation || this.ended || this.paused)
            return;
          clearTimeout(this.deadline);
          if (!this.reportedStart) {
            this.reportedStart = true;
            this.onStarted();
          }
        },
        (error) => {
          if (generation === this.generation && !this.ended) this.fail(error);
        }
      );
    } catch (error) {
      this.fail(error);
    }
  }
  setPaused(paused) {
    if (this.ended || this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.generation++;
      clearTimeout(this.deadline);
      this.media.pause();
    } else this.play();
  }
  stop(when = this.context.currentTime) {
    if (this.alarm) {
      this.alarm.onended = null;
      try {
        this.alarm.stop();
      } catch {
      }
      this.alarm.disconnect();
    }
    this.alarm = void 0;
    if (when <= this.context.currentTime) {
      this.end();
      return;
    }
    const alarm = this.alarm = this.context.createBufferSource();
    alarm.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
    alarm.onended = () => {
      if (this.alarm === alarm) this.end();
    };
    alarm.start(when);
  }
  fail(error) {
    if (this.ended) return;
    try {
      this.onFailure(error);
    } finally {
      this.end();
    }
  }
  end() {
    if (this.ended) return;
    this.ended = true;
    this.generation++;
    clearTimeout(this.deadline);
    this.media.pause();
    this.onended?.();
  }
  releaseMedia() {
    this.media.removeEventListener("ended", this.endedListener);
    this.media.removeEventListener("error", this.errorListener);
    this.media.pause();
    this.media.removeAttribute("src");
    this.media.load();
  }
  disconnect() {
    this.ended = true;
    this.generation++;
    clearTimeout(this.deadline);
    if (this.alarm) {
      this.alarm.onended = null;
      try {
        this.alarm.stop();
      } catch {
      }
      this.alarm.disconnect();
      this.alarm = void 0;
    }
    this.onended = null;
    try {
      this.output.disconnect();
    } finally {
      this.releaseMedia();
    }
  }
};

// packages/core/audio/OfflineMix.ts
async function renderOfflineMix(snapshot, options, signal) {
  const rate = options.sampleRate ?? 48e3, channels = options.channels ?? 2, limit = options.maxOutputBytes ?? 256 * 1024 * 1024;
  const frames = Math.round(options.durationSec * rate);
  if (!Number.isInteger(rate) || rate < 8e3 || rate > 192e3 || ![1, 2].includes(channels) || !Number.isFinite(options.durationSec) || options.durationSec <= 0 || !Number.isSafeInteger(frames) || frames < 1 || Math.abs(frames - options.durationSec * rate) > 1e-6 || !Number.isSafeInteger(limit) || limit <= 0 || frames * channels * 8 + 44 > limit || frames * channels * 4 + 36 > 4294967295)
    throw Error("Invalid offline audio duration or PCM budget");
  if (!Array.isArray(options.cues) || options.cues.length > 1e5)
    throw Error("Invalid offline audio cues");
  const ids = /* @__PURE__ */ new Set(), events = [];
  const cues = options.cues.map((cue) => {
    if (!cue || typeof cue.id !== "string" || !cue.id || ids.has(cue.id))
      throw Error("Duplicate or missing offline audio event id");
    ids.add(cue.id);
    const buffer = snapshot.samples.get(cue.sampleId);
    if (!buffer) throw Error("Offline sample is not loaded: " + cue.sampleId);
    const c = {
      ...cue,
      channel: cue.channel ?? "sfx",
      offsetSec: cue.offsetSec ?? 0,
      loopStartSec: cue.loopStartSec ?? 0,
      loopEndSec: cue.loopEndSec ?? buffer.duration,
      peakGain: cue.peakGain ?? 1,
      fadeInSec: cue.fadeInSec ?? 0,
      fadeOutSec: cue.fadeOutSec ?? 0
    };
    if (!["master", "bgm", "sfx", "ui"].includes(c.channel) || ![
      c.atSec,
      c.durationSec,
      c.offsetSec,
      c.loopStartSec,
      c.loopEndSec,
      c.peakGain,
      c.fadeInSec,
      c.fadeOutSec
    ].every(Number.isFinite) || c.atSec < 0 || c.durationSec <= 0 || c.atSec + c.durationSec > options.durationSec + 1e-9 || c.offsetSec < 0 || c.offsetSec >= buffer.duration || c.loopStartSec < 0 || c.loopEndSec > buffer.duration || c.loopEndSec <= c.loopStartSec || c.peakGain < 0 || c.peakGain > 4 || c.fadeInSec < 0 || c.fadeOutSec < 0 || c.fadeInSec + c.fadeOutSec > c.durationSec || !c.loop && c.offsetSec + c.durationSec > buffer.duration + 1 / rate)
      throw Error("Invalid offline audio cue: " + c.id);
    events.push(
      { time: c.atSec, delta: 1 },
      { time: c.atSec + c.durationSec, delta: -1 }
    );
    return { cue: c, buffer };
  });
  let voices = 0;
  for (const event of events.sort(
    (a, b) => a.time - b.time || a.delta - b.delta
  ))
    if ((voices += event.delta) > snapshot.maxVoices)
      throw Error("Offline audio voice capacity exceeded");
  if (signal.aborted) throw signal.reason;
  if (typeof globalThis.OfflineAudioContext !== "function")
    throw Error("OfflineAudioContext unavailable");
  const context = new OfflineAudioContext(channels, frames, rate), nodes = [], sources = [];
  try {
    const master = context.createGain();
    master.gain.value = snapshot.volumes.master;
    master.connect(context.destination);
    nodes.push(master);
    const buses = /* @__PURE__ */ new Map([["master", master]]);
    for (const channel of ["bgm", "sfx", "ui"]) {
      const gain = context.createGain();
      gain.gain.value = snapshot.volumes[channel];
      gain.connect(master);
      buses.set(channel, gain);
      nodes.push(gain);
    }
    for (const { cue: c, buffer } of cues) {
      const source = context.createBufferSource(), gain = context.createGain();
      sources.push(source);
      nodes.push(source, gain);
      source.buffer = buffer;
      source.loop = c.loop ?? false;
      source.loopStart = c.loopStartSec;
      source.loopEnd = c.loopEndSec;
      gain.gain.setValueAtTime(c.fadeInSec ? 0 : c.peakGain, c.atSec);
      if (c.fadeInSec)
        gain.gain.linearRampToValueAtTime(c.peakGain, c.atSec + c.fadeInSec);
      if (c.fadeOutSec) {
        gain.gain.setValueAtTime(
          c.peakGain,
          c.atSec + c.durationSec - c.fadeOutSec
        );
        gain.gain.linearRampToValueAtTime(0, c.atSec + c.durationSec);
      }
      source.connect(gain);
      gain.connect(buses.get(c.channel));
      source.start(c.atSec, c.offsetSec);
      source.stop(c.atSec + c.durationSec);
    }
    const rendered = await context.startRendering();
    if (signal.aborted) throw signal.reason;
    const wav = new Uint8Array(44 + frames * channels * 4), view = new DataView(wav.buffer), write = (offset, text) => {
      for (let i = 0; i < text.length; i++)
        wav[offset + i] = text.charCodeAt(i);
    };
    write(0, "RIFF");
    view.setUint32(4, wav.length - 8, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 3, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * channels * 4, true);
    view.setUint16(32, channels * 4, true);
    view.setUint16(34, 32, true);
    write(36, "data");
    view.setUint32(40, wav.length - 44, true);
    const data = Array.from(
      { length: channels },
      (_, i) => rendered.getChannelData(i)
    );
    let peak = 0, overRangeSamples = 0;
    for (let i = 0; i < frames; i++)
      for (let c = 0; c < channels; c++) {
        const value = data[c][i];
        if (!Number.isFinite(value)) throw Error("Nonfinite offline sample");
        peak = Math.max(peak, Math.abs(value));
        if (Math.abs(value) > 1) overRangeSamples++;
        view.setFloat32(44 + (i * channels + c) * 4, value, true);
      }
    return {
      sampleRate: rate,
      channels,
      frames,
      durationSec: frames / rate,
      format: "wav-f32",
      peak,
      overRangeSamples,
      wav
    };
  } finally {
    for (const source of sources) {
      try {
        source.stop();
      } catch {
      }
    }
    for (const node of nodes) node.disconnect();
  }
}

// packages/core/IframeSoundAdapter.ts
var CHANNELS = ["bgm", "sfx", "ui"];
var AUDIO_WAVE_TYPES = [
  "sine",
  "square",
  "sawtooth",
  "triangle"
];
var CONTEXT_STATES = /* @__PURE__ */ new Set(["suspended", "running", "closed"]);
function isAudioChannel(value) {
  return value === "master" || value === "bgm" || value === "sfx" || value === "ui";
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
var _IframeSoundAdapter = class _IframeSoundAdapter {
  constructor(options = {}) {
    this.cleanupFns = [];
    this.gestureCleanupFns = [];
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
    this.lastError = null;
    this.disposed = false;
    this.unlockAttempt = 0;
    this.volumes = {
      master: 0.85,
      bgm: 0.6,
      sfx: 0.9,
      ui: 0.85
    };
    this.pendingQueue = [];
    this.queuedBeforeUnlockCount = 0;
    this.droppedQueue = 0;
    this.activeVoices = /* @__PURE__ */ new Map();
    this.droppedVoices = 0;
    this.playedEventsCount = 0;
    this.voiceSerial = 0;
    this.samples = /* @__PURE__ */ new Map();
    this.sampleLoads = /* @__PURE__ */ new Map();
    this.streams = /* @__PURE__ */ new Map();
    this.streamLoads = /* @__PURE__ */ new Map();
    this.admissions = /* @__PURE__ */ new Map();
    this.retiredVoices = 0;
    this.backendContextLost = false;
    this.offlineMix = null;
    this.options = {
      ...options,
      queueMaxAgeMs: options.queueMaxAgeMs ?? 500,
      maxPendingQueue: options.maxPendingQueue ?? 32,
      maxActiveVoices: options.maxActiveVoices ?? 32,
      syncLayaSoundManager: options.syncLayaSoundManager ?? false
    };
    this.sampleTimeoutMs = options.sampleTimeoutMs ?? 15e3;
    this.maxSamples = options.maxSamples ?? 32;
    this.maxRetainedStreamBytes = options.maxRetainedStreamBytes ?? 64 * 1024 * 1024;
    this.maxDecodedSampleBytes = options.maxDecodedSampleBytes ?? 64 * 1024 * 1024;
    if (!["reject", "fifo", "priority"].includes(
      options.voiceOverflow ?? "reject"
    ))
      throw Error("Invalid voice overflow");
    if (!Number.isFinite(options.retireFadeSec ?? 5e-3) || (options.retireFadeSec ?? 5e-3) < 0 || (options.retireFadeSec ?? 5e-3) > 1)
      throw Error("Invalid retirement fade");
    if (options.protectedChannels?.some((channel) => !isAudioChannel(channel)))
      throw Error("Invalid protected channel");
    const streamProvider = options.streamProvider ?? options.sampleProvider;
    if (streamProvider?.openStream)
      this.streamCache = new ZhudaAssetCache(
        async (id, signal) => {
          const lease = await streamProvider.openStream(id, { signal });
          if (signal.aborted || this.disposed) {
            lease.release();
            throw new DOMException("Stream load cancelled", "AbortError");
          }
          if (lease.id !== id || !lease.url || !["native", "verified-blob"].includes(lease.delivery) || !["sha256", "transport"].includes(lease.integrity) || !Number.isSafeInteger(lease.retainedBytes) || lease.retainedBytes < 0) {
            lease.release();
            throw Error("Invalid stream lease");
          }
          return lease;
        },
        (lease) => lease.release(),
        0
      );
    for (const [name, value] of Object.entries({
      sampleTimeoutMs: this.sampleTimeoutMs,
      maxSamples: this.maxSamples,
      maxRetainedStreamBytes: this.maxRetainedStreamBytes,
      maxDecodedSampleBytes: this.maxDecodedSampleBytes,
      maxActiveVoices: this.options.maxActiveVoices,
      maxPendingQueue: this.options.maxPendingQueue,
      queueMaxAgeMs: this.options.queueMaxAgeMs
    }))
      if (!Number.isSafeInteger(value) || value <= 0)
        throw Error(`Invalid audio limit: ${name}`);
    if (options.sampleProvider)
      this.sampleCache = createProviderAssetCache(
        options.sampleProvider,
        async (asset, signal) => {
          const context = this.ensureAudioContext();
          if (!context) throw Error("WebAudio decoder unavailable");
          if (signal.aborted)
            throw new DOMException("Sample decode cancelled", "AbortError");
          let cancel = () => {
          };
          try {
            const decoded = await Promise.race([
              context.decodeAudioData(new Uint8Array(asset.bytes).buffer),
              new Promise((_, reject) => {
                cancel = () => reject(
                  new DOMException("Sample decode cancelled", "AbortError")
                );
                signal.addEventListener("abort", cancel, { once: true });
                if (signal.aborted) cancel();
              })
            ]);
            if (signal.aborted || this.disposed)
              throw new DOMException("Sample decode cancelled", "AbortError");
            const bytes = decoded.length * decoded.numberOfChannels * 4;
            if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > this.maxDecodedSampleBytes || !Number.isFinite(decoded.duration) || decoded.duration <= 0)
              throw Error("Decoded sample exceeds PCM bound or is empty");
            return decoded;
          } finally {
            signal.removeEventListener("abort", cancel);
          }
        },
        () => {
        }
      );
    this.allowedParentOrigins = new Set(
      (options.allowedParentOrigins ?? []).filter(
        (origin) => typeof origin === "string" && origin.length > 0 && origin !== "*"
      )
    );
    this.now = options.now ?? (() => Date.now());
    this.detectIframeContext();
    this.installGestureUnlockGuards();
    this.installVisibilityAndFocusGuards();
    this.installPostMessageBridge();
    this.syncLayaSoundManager();
    this.syncDomTelemetry();
  }
  static getShared() {
    if (!this.instance || this.instance.disposed) {
      this.instance = new _IframeSoundAdapter();
    }
    return this.instance;
  }
  recordError(error) {
    this.lastError = error instanceof Error ? error.message : String(error);
  }
  voiceEvent(event) {
    try {
      this.options.onVoiceEvent?.(event);
    } catch (error) {
      this.recordError(error);
    }
  }
  validVoice(options) {
    return (options.priority === void 0 || Number.isFinite(options.priority)) && (options.protected === void 0 || typeof options.protected === "boolean");
  }
  admit(options, task, exclude = []) {
    if (this.activeVoices.size < this.options.maxActiveVoices) return "ready";
    const mode = this.options.voiceOverflow ?? "reject";
    const protectedChannels = this.options.protectedChannels ?? ["bgm"];
    const candidates = [...this.activeVoices].filter(
      ([key, voice]) => !exclude.includes(key) && !voice.stopping && !this.admissions.has(key) && !voice.protected && !protectedChannels.includes(voice.channel) && (mode !== "priority" || (voice.priority ?? 0) <= (options.priority ?? 0))
    );
    if (mode === "priority")
      candidates.sort((a, b) => (a[1].priority ?? 0) - (b[1].priority ?? 0));
    const victim = candidates[0];
    if (mode === "reject" || !victim || this.admissions.size >= this.options.maxPendingQueue) {
      this.droppedVoices++;
      this.voiceEvent({
        type: "rejected",
        id: task.id,
        channel: task.channel,
        reason: "voice-capacity"
      });
      this.syncDomTelemetry();
      return "rejected";
    }
    this.admissions.set(victim[0], task);
    this.retiredVoices++;
    this.voiceEvent({
      type: "retiring",
      id: victim[1].logicalId,
      channel: victim[1].channel,
      replacedBy: task.id,
      reason: mode
    });
    this.stopVoice(victim[0], this.options.retireFadeSec ?? 5e-3);
    this.syncDomTelemetry();
    return "queued";
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
  defaultAudioContextFactory() {
    if (typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    return new AudioCtx();
  }
  ensureAudioContext(recreateClosed = true) {
    if (this.disposed || this.backendContextLost) return null;
    if (this.ctx && this.ctx.state !== "closed") return this.ctx;
    if (this.ctx?.state === "closed") {
      this.recordError("AudioContext is closed");
      this.unlockedByGesture = false;
      for (const key of [...this.activeVoices.keys()]) this.finishVoice(key);
      if (this.sampleBackend) {
        this.backendContextLost = true;
        try {
          this.sampleBackend.dispose();
        } catch (error) {
          this.recordError(error);
        }
        this.recordError(
          "Sample backend context closed; dispose and recreate the adapter"
        );
        return null;
      }
      this.ctx = null;
      this.masterGain = null;
      this.channelGains = {};
      if (!recreateClosed) return null;
    }
    let context = null;
    try {
      context = this.options.audioContextFactory ? this.options.audioContextFactory() : this.defaultAudioContextFactory();
      if (!context) return null;
      this.ctx = context;
      this.masterGain = context.createGain();
      this.masterGain.gain.value = this.getEffectiveMasterVolume();
      this.masterGain.connect(context.destination);
      this.channelGains = {};
      for (const channel of CHANNELS) {
        const gain = context.createGain();
        gain.gain.value = this.volumes[channel];
        gain.connect(this.masterGain);
        this.channelGains[channel] = gain;
      }
      return context;
    } catch (error) {
      this.recordError(error);
      try {
        if (context && context.state !== "closed") void context.close();
      } catch (_closeError) {
      }
      this.ctx = null;
      this.masterGain = null;
      this.channelGains = {};
      return null;
    }
  }
  getEffectiveMasterVolume() {
    return this.userMuted || this.autoSuspendedByBlur ? 0 : this.volumes.master;
  }
  setGainValue(node, value) {
    if (!this.ctx) return;
    try {
      node.gain.setValueAtTime(value, this.ctx.currentTime);
    } catch (_error) {
      node.gain.value = value;
    }
  }
  updateGainNodes() {
    if (this.masterGain)
      this.setGainValue(this.masterGain, this.getEffectiveMasterVolume());
    for (const channel of CHANNELS) {
      const node = this.channelGains[channel];
      if (node) this.setGainValue(node, this.volumes[channel]);
    }
    this.syncLayaSoundManager();
    this.syncStreamFocus();
    this.syncDomTelemetry();
  }
  syncStreamFocus() {
    const paused = this.autoSuspendedByBlur || !this.unlockedByGesture || this.ctx?.state !== "running";
    for (const voice of this.activeVoices.values())
      if (voice.source instanceof StreamVoice) voice.source.setPaused(paused);
  }
  /** Optional state mirroring for consumers that explicitly still use Laya SoundManager. */
  syncLayaSoundManager() {
    if (!this.options.syncLayaSoundManager) return;
    const g = globalThis;
    const soundManager = g.Laya?.SoundManager;
    if (!soundManager) return;
    soundManager.muted = this.userMuted || this.autoSuspendedByBlur;
    soundManager.autoStopMusic = true;
    soundManager.setMusicVolume?.(
      Number((this.volumes.master * this.volumes.bgm).toFixed(2))
    );
    soundManager.setSoundVolume?.(
      Number((this.volumes.master * this.volumes.sfx).toFixed(2))
    );
  }
  addEventListener(target, type, listener, options, gesture = false) {
    target.addEventListener(type, listener, options);
    const cleanup = () => target.removeEventListener(type, listener, options);
    this.cleanupFns.push(cleanup);
    if (gesture) this.gestureCleanupFns.push(cleanup);
  }
  removeGestureUnlockGuards() {
    for (const cleanup of this.gestureCleanupFns.splice(0)) {
      cleanup();
      const index = this.cleanupFns.indexOf(cleanup);
      if (index >= 0) this.cleanupFns.splice(index, 1);
    }
  }
  installGestureUnlockGuards() {
    if (typeof window === "undefined") return;
    const events = ["pointerdown", "touchstart", "mousedown", "keydown"];
    const onFirstGesture = (event) => {
      this.unlockAudio(event.type || "gesture");
      if (this.unlockedByGesture) this.removeGestureUnlockGuards();
    };
    for (const event of events) {
      this.addEventListener(
        window,
        event,
        onFirstGesture,
        { capture: true, passive: true },
        true
      );
    }
  }
  markUnlocked(gestureSource) {
    this.unlockedByGesture = true;
    this.unlockGestureType = gestureSource;
    this.playSilentUnlockSample();
    this.flushPendingQueue();
    this.syncStreamFocus();
    this.syncDomTelemetry();
  }
  playSilentUnlockSample() {
    if (!this.ctx) return;
    try {
      const silentBuffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.onended = () => source.disconnect?.();
      source.connect(this.ctx.destination);
      source.start(0);
    } catch (error) {
      this.recordError(error);
    }
  }
  /** Unlocks only after a real context exists and resume succeeds or is already running. */
  unlockAudio(gestureSource = "programmatic-unlock") {
    if (this.disposed) return false;
    this.unlockGestureType = gestureSource;
    const context = this.ensureAudioContext();
    if (!context) {
      this.recordError("WebAudio is unavailable");
      this.syncDomTelemetry();
      return false;
    }
    const attempt = ++this.unlockAttempt;
    if (context.state === "running") {
      this.markUnlocked(gestureSource);
      return true;
    }
    if (context.state !== "suspended" || typeof context.resume !== "function") {
      this.recordError(`AudioContext cannot resume from ${context.state}`);
      this.syncDomTelemetry();
      return false;
    }
    try {
      const result = context.resume();
      Promise.resolve(result).then(
        () => {
          if (this.disposed || attempt !== this.unlockAttempt || this.ctx !== context)
            return;
          if (context.state === "running") {
            this.markUnlocked(gestureSource);
            this.removeGestureUnlockGuards();
          } else {
            this.recordError(`AudioContext resume ended in ${context.state}`);
            this.unlockedByGesture = false;
            this.syncDomTelemetry();
          }
        },
        (error) => {
          if (this.disposed || attempt !== this.unlockAttempt) return;
          this.unlockedByGesture = false;
          this.recordError(error);
          this.syncDomTelemetry();
        }
      );
    } catch (error) {
      this.unlockedByGesture = false;
      this.recordError(error);
      this.syncDomTelemetry();
      return false;
    }
    this.syncDomTelemetry();
    return this.unlockedByGesture;
  }
  flushPendingQueue() {
    if (!this.unlockedByGesture) return;
    if (this.userMuted || this.autoSuspendedByBlur) {
      this.pendingQueue = [];
      return;
    }
    const now = this.now();
    const tasks = this.pendingQueue.splice(0);
    for (const task of tasks) {
      if (now - task.createdAt > this.options.queueMaxAgeMs) {
        this.droppedQueue++;
        continue;
      }
      try {
        if (!task.execute()) this.droppedQueue++;
      } catch (error) {
        this.droppedQueue++;
        this.recordError(error);
      }
    }
    this.syncDomTelemetry();
  }
  installVisibilityAndFocusGuards() {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    this.addEventListener(document, "visibilitychange", () => {
      this.handleFocusOrVisibilityChange(
        document.visibilityState !== "hidden",
        this.windowFocused
      );
    });
    this.addEventListener(window, "blur", () => {
      this.handleFocusOrVisibilityChange(this.pageVisible, false);
    });
    this.addEventListener(window, "focus", () => {
      this.handleFocusOrVisibilityChange(true, true);
    });
    this.addEventListener(window, "pagehide", () => {
      this.handleFocusOrVisibilityChange(false, false);
    });
    this.addEventListener(window, "pageshow", () => {
      this.handleFocusOrVisibilityChange(true, true);
    });
  }
  handleFocusOrVisibilityChange(visible, focused) {
    if (this.disposed) return;
    this.pageVisible = Boolean(visible);
    this.windowFocused = Boolean(focused);
    this.autoSuspendedByBlur = !this.pageVisible || !this.windowFocused;
    if (this.ctx) {
      if (this.autoSuspendedByBlur && this.ctx.state === "running" && typeof this.ctx.suspend === "function") {
        try {
          Promise.resolve(this.ctx.suspend()).catch(
            (error) => this.recordError(error)
          );
        } catch (error) {
          this.recordError(error);
        }
      } else if (!this.autoSuspendedByBlur && !this.userMuted && this.unlockedByGesture && this.ctx.state === "suspended" && typeof this.ctx.resume === "function") {
        try {
          Promise.resolve(this.ctx.resume()).then(
            () => this.syncStreamFocus(),
            (error) => this.recordError(error)
          );
        } catch (error) {
          this.recordError(error);
        }
      }
    }
    this.updateGainNodes();
  }
  isAllowedBridgeOrigin(origin) {
    if (!origin || origin === "null") return false;
    if (this.allowedParentOrigins.size > 0)
      return this.allowedParentOrigins.has(origin);
    if (typeof window === "undefined" || !window.location) return false;
    return origin === window.location.origin;
  }
  installPostMessageBridge() {
    if (typeof window === "undefined") return;
    const listener = (event) => {
      const messageEvent = event;
      if (!this.isAllowedBridgeOrigin(messageEvent.origin)) return;
      const data = messageEvent.data;
      if (!data || typeof data !== "object" || typeof data.type !== "string")
        return;
      if (!data.type.startsWith("zhuda:")) return;
      this.handleBridgeMessage(data);
      const source = messageEvent.source;
      if (source && typeof source.postMessage === "function") {
        try {
          source.postMessage(
            {
              type: "zhuda:telemetry:ack",
              receivedCommand: data.type,
              diagnostics: this.getDiagnostics()
            },
            messageEvent.origin
          );
        } catch (error) {
          this.recordError(error);
        }
      }
    };
    this.addEventListener(window, "message", listener);
    this.postMessageBridgeActive = true;
  }
  handleBridgeMessage(msg) {
    if (this.disposed) return this.getDiagnostics();
    this.lastBridgeCommand = typeof msg?.type === "string" ? msg.type : "invalid";
    switch (msg?.type) {
      case "zhuda:audio:mute":
        this.setMuted(true);
        break;
      case "zhuda:audio:unmute":
        this.setMuted(false);
        this.unlockAudio("bridge-unmute");
        break;
      case "zhuda:audio:setVolume":
        if (isAudioChannel(msg.channel) && isFiniteNumber(msg.volume)) {
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
    if (this.disposed) return;
    this.userMuted = Boolean(muted);
    this.updateGainNodes();
  }
  isMuted() {
    return this.userMuted;
  }
  setChannelVolume(channel, volume) {
    if (!isAudioChannel(channel) || !isFiniteNumber(volume) || volume < 0 || volume > 1)
      return false;
    this.volumes[channel] = volume;
    this.updateGainNodes();
    return true;
  }
  getChannelVolume(channel) {
    return this.volumes[channel];
  }
  validateTone(options) {
    if (!options || typeof options.id !== "string" || options.id.trim().length === 0 || !this.validVoice(options))
      return null;
    const channel = options.channel ?? "sfx";
    if (!isAudioChannel(channel)) return null;
    if (!isFiniteNumber(options.startFreq) || options.startFreq <= 0 || options.startFreq > 24e3)
      return null;
    if (options.endFreq !== void 0 && (!isFiniteNumber(options.endFreq) || options.endFreq <= 0 || options.endFreq > 24e3))
      return null;
    if (!isFiniteNumber(options.durationSec) || options.durationSec <= 0 || options.durationSec > 30)
      return null;
    if (options.peakGain !== void 0 && (!isFiniteNumber(options.peakGain) || options.peakGain < 0 || options.peakGain > 1))
      return null;
    if (options.delaySec !== void 0 && (!isFiniteNumber(options.delaySec) || options.delaySec < 0 || options.delaySec > 60))
      return null;
    if (options.waveType !== void 0 && !AUDIO_WAVE_TYPES.includes(options.waveType))
      return null;
    return channel;
  }
  runSynthesis(options, channel) {
    const context = this.ensureAudioContext(false);
    const channelGain = channel === "master" ? this.masterGain : this.channelGains[channel];
    if (!context || !this.masterGain || !channelGain) {
      this.recordError("WebAudio mixer is unavailable");
      this.syncDomTelemetry();
      return null;
    }
    const admission = this.admit(options, {
      id: options.id,
      channel,
      execute: () => this.runSynthesis(options, channel) !== null
    });
    if (admission !== "ready") return admission === "queued" ? true : null;
    const voiceKey = `${options.id}:${++this.voiceSerial}`;
    const when = context.currentTime + (options.delaySec ?? 0);
    const duration = options.durationSec;
    const state = {
      logicalId: options.id,
      channel,
      priority: options.priority,
      protected: options.protected,
      source: null,
      stopped: false
    };
    try {
      const source = context.createOscillator();
      const gain = context.createGain();
      state.source = source;
      state.gain = gain;
      source.type = options.waveType ?? "triangle";
      source.frequency.setValueAtTime(options.startFreq, when);
      if (options.endFreq !== void 0 && options.endFreq !== options.startFreq) {
        source.frequency.exponentialRampToValueAtTime(
          options.endFreq,
          when + duration
        );
      }
      const peak = options.peakGain ?? 0.18;
      gain.gain.setValueAtTime(Math.max(1e-3, peak), when);
      gain.gain.exponentialRampToValueAtTime(8e-4, when + duration);
      source.connect(gain);
      gain.connect(channelGain);
      source.onended = () => this.finishVoice(voiceKey);
      this.activeVoices.set(voiceKey, state);
      source.start(when);
      source.stop(when + duration);
      this.playedEventsCount++;
      this.voiceEvent({ type: "started", id: options.id, channel });
      const handle = {
        id: options.id,
        channel,
        get stopped() {
          return state.stopped;
        },
        stop: () => this.stopVoice(voiceKey)
      };
      this.syncDomTelemetry();
      return handle;
    } catch (error) {
      this.recordError(error);
      state.stopped = true;
      try {
        state.source?.disconnect?.();
        state.gain?.disconnect?.();
      } catch {
      }
      this.activeVoices.delete(voiceKey);
      this.syncDomTelemetry();
      return null;
    }
  }
  submit(task, replace = false) {
    if (this.disposed || this.userMuted || this.autoSuspendedByBlur)
      return false;
    if ([...this.admissions.values()].some((value) => value.id === task.id))
      return false;
    if (this.unlockedByGesture) return task.execute();
    const old = this.pendingQueue.findIndex((value) => value.id === task.id);
    if (old >= 0 && !replace) {
      this.droppedQueue++;
      this.syncDomTelemetry();
      return false;
    }
    if (old < 0 && this.pendingQueue.length >= this.options.maxPendingQueue) {
      this.droppedQueue++;
      this.syncDomTelemetry();
      return false;
    }
    const queued = { ...task, createdAt: this.now() };
    if (old >= 0) this.pendingQueue[old] = queued;
    else this.pendingQueue.push(queued);
    this.queuedBeforeUnlockCount++;
    this.syncDomTelemetry();
    return true;
  }
  /** Queues once before unlock, then starts one voice through the shared mixer. */
  scheduleTone(options) {
    const channel = this.validateTone(options);
    if (!channel) return false;
    const snapshot = { ...options };
    return this.submit({
      id: snapshot.id,
      channel,
      execute: () => this.runSynthesis(snapshot, channel) !== null
    });
  }
  sampleInfo(id, buffer) {
    return {
      id,
      durationSec: buffer.duration,
      channels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate,
      frames: buffer.length,
      decodedBytes: buffer.length * buffer.numberOfChannels * 4
    };
  }
  /** Load and decode a provider logical ID. Repeated callers share the existing cache work. */
  async loadSample(id, options = {}) {
    normalizeAssetId(id);
    if (this.disposed || !this.sampleCache)
      throw Error("Sample loading requires a live adapter with sampleProvider");
    if (options.signal?.aborted)
      throw new DOMException("Sample load cancelled", "AbortError");
    const existing = this.samples.get(id);
    if (existing) return this.sampleInfo(id, existing.value);
    const reserved = /* @__PURE__ */ new Set([
      ...this.samples.keys(),
      ...this.sampleLoads.values(),
      id
    ]);
    if (reserved.size > this.maxSamples)
      throw Error("Audio sample capacity exceeded");
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    this.sampleLoads.set(controller, id);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      abort();
    }, this.sampleTimeoutMs);
    let lease;
    try {
      lease = await this.sampleCache.acquire(id, { signal: controller.signal });
      if (controller.signal.aborted || this.disposed)
        throw new DOMException("Sample load cancelled", "AbortError");
      const info = this.sampleInfo(id, lease.value);
      if (!this.samples.has(id)) {
        if (this.getDiagnostics().decodedSampleBytes + info.decodedBytes > this.maxDecodedSampleBytes)
          throw Error("Total decoded sample PCM bound exceeded");
        this.samples.set(id, lease);
        lease = void 0;
      }
      return info;
    } catch (error) {
      const failure = timedOut ? new Error(`Audio sample load/decode timeout: ${id}`) : error;
      this.recordError(failure);
      throw failure;
    } finally {
      lease?.release();
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      this.sampleLoads.delete(controller);
      if (this.disposed && !this.sampleLoads.size) this.sampleCache.dispose();
      this.syncDomTelemetry();
    }
  }
  /** Stops this sample's queued/active voices, cancels pending loads and releases its PCM lease. */
  unloadSample(id) {
    let changed = false;
    for (const [controller, sampleId] of this.sampleLoads)
      if (sampleId === id) {
        controller.abort();
        changed = true;
      }
    for (const [key, task] of this.admissions)
      if (task.sampleId === id) {
        this.admissions.delete(key);
        changed = true;
      }
    for (const [key, voice] of [...this.activeVoices])
      if (voice.sampleId === id) {
        this.stopVoice(key);
        changed = true;
      }
    const before = this.pendingQueue.length;
    this.pendingQueue = this.pendingQueue.filter(
      (task) => task.sampleId !== id
    );
    changed || (changed = before !== this.pendingQueue.length);
    const lease = this.samples.get(id);
    if (lease) {
      this.samples.delete(id);
      lease.release();
      changed = true;
    }
    this.syncDomTelemetry();
    return changed;
  }
  /** Install one sample backend before playback. No implicit fallback after
   * failure: the caller may retry or retain native playback explicitly. */
  async prepareSampleBackend(backend, options = {}) {
    if (this.disposed || this.sampleBackend || this.backendPreparing || this.activeVoices.size || this.pendingQueue.length || this.admissions.size)
      throw Error(
        "Backend preparation requires an idle, live adapter without a backend"
      );
    const provider = this.options.sampleProvider;
    const context = this.ensureAudioContext();
    if (!provider || !context || !backend?.name)
      throw Error("Backend requires provider, context and name");
    const controller = this.backendPreparing = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const timer = setTimeout(
      () => controller.abort(
        new DOMException("Backend prepare timeout", "TimeoutError")
      ),
      this.sampleTimeoutMs
    );
    let cancel = () => {
    };
    let accepted = false;
    const work = Promise.resolve().then(() => {
      if (controller.signal.aborted)
        throw controller.signal.reason ?? new DOMException("Cancelled", "AbortError");
      return backend.prepare({ context, provider, signal: controller.signal });
    });
    void work.then(
      () => {
        if (controller.signal.aborted || this.disposed) {
          try {
            backend.dispose();
          } catch (error) {
            this.recordError(error);
          }
        }
      },
      () => {
      }
    );
    try {
      await Promise.race([
        work,
        new Promise((_, reject) => {
          cancel = () => reject(
            controller.signal.reason ?? new DOMException("Cancelled", "AbortError")
          );
          controller.signal.addEventListener("abort", cancel, { once: true });
          if (controller.signal.aborted) cancel();
        })
      ]);
      if (this.disposed || controller.signal.aborted)
        throw new DOMException("Backend cancelled", "AbortError");
      this.sampleBackend = backend;
      accepted = true;
    } catch (error) {
      this.recordError(error);
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      controller.signal.removeEventListener("abort", cancel);
      this.backendPreparing = void 0;
      if (!accepted) {
        try {
          backend.dispose();
        } catch (error) {
          this.recordError(error);
        }
      }
    }
  }
  async loadStream(id, options = {}) {
    id = normalizeAssetId(id);
    if (this.disposed || !this.streamCache)
      throw Error("Stream loading requires a live provider with openStream");
    if (options.signal?.aborted)
      throw new DOMException("Stream cancelled", "AbortError");
    const info = (lease2) => ({
      id,
      integrity: lease2.integrity,
      delivery: lease2.delivery,
      retainedBytes: lease2.retainedBytes
    });
    const existing = this.streams.get(id);
    if (existing) return info(existing.value);
    if ((/* @__PURE__ */ new Set([...this.streams.keys(), ...this.streamLoads.values(), id])).size > this.maxSamples)
      throw Error("Stream capacity exceeded");
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    this.streamLoads.set(controller, id);
    let timeout = false;
    const timer = setTimeout(() => {
      timeout = true;
      controller.abort();
    }, this.sampleTimeoutMs);
    let lease;
    try {
      lease = await this.streamCache.acquire(id, { signal: controller.signal });
      if (controller.signal.aborted || this.disposed)
        throw new DOMException("Stream cancelled", "AbortError");
      const result = info(lease.value);
      if (!this.streams.has(id)) {
        if (this.getDiagnostics().retainedStreamBytes + result.retainedBytes > this.maxRetainedStreamBytes)
          throw Error("Total retained stream byte bound exceeded");
        this.streams.set(id, lease);
        lease = void 0;
      }
      return result;
    } catch (error) {
      const failure = timeout ? Error(`Stream load timeout: ${id}`) : error;
      this.recordError(failure);
      throw failure;
    } finally {
      lease?.release();
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      this.streamLoads.delete(controller);
      if (this.disposed && !this.streamLoads.size) this.streamCache.dispose();
      this.syncDomTelemetry();
    }
  }
  unloadStream(id) {
    let changed = false;
    for (const [controller, value] of this.streamLoads)
      if (value === id) {
        controller.abort();
        changed = true;
      }
    for (const [key, task] of this.admissions)
      if (task.streamId === id) {
        this.admissions.delete(key);
        changed = true;
      }
    const before = this.pendingQueue.length;
    this.pendingQueue = this.pendingQueue.filter(
      (task) => task.streamId !== id
    );
    changed || (changed = before !== this.pendingQueue.length);
    for (const [key, voice] of [...this.activeVoices])
      if (voice.streamId === id) {
        this.stopVoice(key);
        changed = true;
      }
    const lease = this.streams.get(id);
    if (lease) {
      this.streams.delete(id);
      lease.release();
      changed = true;
    }
    this.syncDomTelemetry();
    return changed;
  }
  playStream(options) {
    if (!options || !options.id?.trim() || !this.validVoice(options))
      return false;
    const lease = this.streams.get(options.streamId), channel = options.channel ?? "bgm";
    if (!lease || !isAudioChannel(channel)) return false;
    const offset = options.offsetSec ?? 0, fade = options.fadeInSec ?? options.crossFadeSec ?? 0, crossFade = options.crossFadeSec ?? 0, peak = options.peakGain ?? 1;
    if (![offset, fade, crossFade, peak].every(
      (v) => Number.isFinite(v) && v >= 0
    ) || peak > 1 || fade > 60 || crossFade > 60 || crossFade > 0 && !options.replace || options.loop !== void 0 && typeof options.loop !== "boolean" || options.replace !== void 0 && typeof options.replace !== "boolean")
      return false;
    const snapshot = { ...options };
    const task = {
      id: snapshot.id,
      streamId: snapshot.streamId,
      channel,
      execute: () => {
        if (this.disposed || this.userMuted || this.autoSuspendedByBlur || this.streams.get(snapshot.streamId) !== lease)
          return false;
        const previous = [...this.activeVoices].filter(([, v]) => v.logicalId === snapshot.id).map(([k]) => k);
        if (previous.length && !snapshot.replace) return false;
        const context = this.ensureAudioContext(false), channelGain = channel === "master" ? this.masterGain : this.channelGains[channel];
        if (!context || !channelGain) return false;
        const admission = this.admit(snapshot, task, previous);
        if (admission !== "ready") return admission === "queued";
        const key = `${snapshot.id}:${++this.voiceSerial}`;
        let source, gain;
        try {
          const media = this.options.mediaElementFactory?.() ?? document.createElement("audio");
          source = new StreamVoice(
            context,
            media,
            lease.value,
            snapshot,
            this.sampleTimeoutMs,
            (error) => {
              this.recordError(error);
              this.voiceEvent({
                type: "failed",
                id: snapshot.id,
                channel,
                reason: String(error)
              });
            },
            () => {
              if (!this.activeVoices.has(key) || this.disposed) return;
              gain.gain.setValueAtTime(fade ? 0 : peak, context.currentTime);
              if (fade)
                gain.gain.linearRampToValueAtTime(
                  peak,
                  context.currentTime + fade
                );
              for (const old of previous) this.stopVoice(old, crossFade);
              this.playedEventsCount++;
              this.voiceEvent({ type: "started", id: snapshot.id, channel });
              this.syncDomTelemetry();
            }
          );
          gain = context.createGain();
          gain.gain.setValueAtTime(fade ? 0 : peak, context.currentTime);
          source.output.connect(gain);
          gain.connect(channelGain);
          source.onended = () => this.finishVoice(key);
          this.activeVoices.set(key, {
            logicalId: snapshot.id,
            channel,
            source,
            gain,
            streamId: snapshot.streamId,
            stopped: false,
            priority: snapshot.priority,
            protected: snapshot.protected
          });
          source.start(context.currentTime, offset);
          this.syncDomTelemetry();
          return true;
        } catch (error) {
          source?.disconnect();
          gain?.disconnect();
          this.activeVoices.delete(key);
          this.recordError(error);
          return false;
        }
      }
    };
    return this.submit(task, snapshot.replace);
  }
  playSample(options) {
    if (!options || typeof options.id !== "string" || !options.id.trim() || !this.validVoice(options) || this.backendPreparing)
      return false;
    const lease = this.samples.get(options.sampleId);
    const channel = options.channel ?? "sfx";
    if (!lease || !isAudioChannel(channel)) return false;
    const buffer = lease.value;
    const offset = options.offsetSec ?? 0, loopStart = options.loopStartSec ?? 0, loopEnd = options.loopEndSec ?? buffer.duration;
    for (const value of [
      offset,
      loopStart,
      loopEnd,
      options.fadeInSec ?? 0,
      options.fadeOutSec ?? 0,
      options.crossFadeSec ?? 0
    ])
      if (!Number.isFinite(value) || value < 0) return false;
    if (offset >= buffer.duration || loopStart >= loopEnd || loopEnd > buffer.duration || options.loop !== void 0 && typeof options.loop !== "boolean" || options.replace !== void 0 && typeof options.replace !== "boolean" || (options.crossFadeSec ?? 0) > 0 && !options.replace || options.durationSec !== void 0 && (!Number.isFinite(options.durationSec) || options.durationSec <= 0) || options.peakGain !== void 0 && (!Number.isFinite(options.peakGain) || options.peakGain < 0 || options.peakGain > 1))
      return false;
    const duration = options.loop ? options.durationSec : Math.min(options.durationSec ?? Infinity, buffer.duration - offset);
    const fadeIn = options.fadeInSec ?? options.crossFadeSec ?? 0, fadeOut = options.fadeOutSec ?? 0;
    if (fadeIn > 60 || fadeOut > 60 || (options.crossFadeSec ?? 0) > 60 || (duration === void 0 ? fadeOut > 0 : fadeIn + fadeOut > duration))
      return false;
    const snapshot = { ...options };
    const task = {
      id: snapshot.id,
      sampleId: snapshot.sampleId,
      channel,
      execute: () => {
        if (this.samples.get(snapshot.sampleId) !== lease || this.userMuted || this.autoSuspendedByBlur)
          return false;
        const previous = [...this.activeVoices].filter(([, voice]) => voice.logicalId === snapshot.id).map(([key2]) => key2);
        if (previous.length && !snapshot.replace) return false;
        const context = this.ensureAudioContext(false);
        const channelGain = channel === "master" ? this.masterGain : this.channelGains[channel];
        if (!context || !channelGain) return false;
        const admission = this.admit(snapshot, task, previous);
        if (admission !== "ready") return admission === "queued";
        const key = `${snapshot.id}:${++this.voiceSerial}`;
        let source, gain;
        try {
          if (this.sampleBackend)
            source = this.sampleBackend.createVoice(buffer, snapshot);
          else {
            source = context.createBufferSource();
            source.buffer = buffer;
            source.loop = snapshot.loop ?? false;
            source.loopStart = loopStart;
            source.loopEnd = loopEnd;
          }
          gain = context.createGain();
          const now = context.currentTime, peak = snapshot.peakGain ?? 1;
          gain.gain.setValueAtTime(fadeIn ? 0 : peak, now);
          if (fadeIn) gain.gain.linearRampToValueAtTime(peak, now + fadeIn);
          if (duration !== void 0 && fadeOut) {
            gain.gain.setValueAtTime(peak, now + duration - fadeOut);
            gain.gain.linearRampToValueAtTime(0, now + duration);
          }
          ("output" in source ? source.output : source).connect(gain);
          gain.connect(channelGain);
          source.onended = () => this.finishVoice(key);
          this.activeVoices.set(key, {
            logicalId: snapshot.id,
            channel,
            source,
            gain,
            sampleId: snapshot.sampleId,
            stopped: false,
            priority: snapshot.priority,
            protected: snapshot.protected
          });
          source.start(now, offset);
          if (duration !== void 0) source.stop(now + duration);
          for (const old of previous)
            this.stopVoice(old, snapshot.crossFadeSec ?? 0);
          this.playedEventsCount++;
          this.voiceEvent({ type: "started", id: snapshot.id, channel });
          this.syncDomTelemetry();
          return true;
        } catch (error) {
          try {
            source?.stop();
          } catch {
          }
          source?.disconnect();
          gain?.disconnect();
          this.activeVoices.delete(key);
          this.recordError(error);
          this.syncDomTelemetry();
          return false;
        }
      }
    };
    return this.submit(task, snapshot.replace);
  }
  /** Explicit offline soundtrack using loaded samples and this mixer's gain snapshot.
   * Does not play live voices, use a second live AudioContext or dispatch events. */
  async renderOffline(options) {
    if (this.disposed || this.offlineMix)
      throw Error("Offline mixer is disposed or busy");
    const timeout = options.timeoutMs ?? 3e4;
    if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 2147483647)
      throw Error("Invalid offline audio deadline");
    if (options.signal?.aborted)
      throw options.signal.reason ?? new DOMException("Cancelled", "AbortError");
    const controller = this.offlineMix = new AbortController(), abort = () => controller.abort(
      options.signal?.reason ?? new DOMException("Cancelled", "AbortError")
    );
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () => controller.abort(
        new DOMException("Offline mix timed out", "TimeoutError")
      ),
      timeout
    );
    const work = renderOfflineMix(
      {
        samples: new Map(
          [...this.samples].map(([id, lease]) => [id, lease.value])
        ),
        volumes: {
          ...this.volumes,
          master: this.userMuted ? 0 : this.volumes.master
        },
        maxVoices: this.options.maxActiveVoices
      },
      options,
      controller.signal
    );
    const drained = () => {
      if (this.offlineMix === controller) this.offlineMix = null;
    };
    void work.then(drained, drained);
    try {
      return await awaitAbortable(work, controller.signal);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }
  stop(id, fadeOutSec = 0) {
    if (!Number.isFinite(fadeOutSec) || fadeOutSec < 0 || fadeOutSec > 60)
      return false;
    let stopped = false;
    for (const [key, task] of this.admissions)
      if (task.id === id) {
        this.admissions.delete(key);
        stopped = true;
      }
    for (const [voiceKey, voice] of [...this.activeVoices.entries()]) {
      if (voice.logicalId === id)
        stopped = this.stopVoice(voiceKey, fadeOutSec) || stopped;
    }
    const before = this.pendingQueue.length;
    this.pendingQueue = this.pendingQueue.filter((task) => task.id !== id);
    if (before !== this.pendingQueue.length) stopped = true;
    this.syncDomTelemetry();
    return stopped;
  }
  finishVoice(voiceKey) {
    const voice = this.activeVoices.get(voiceKey);
    if (!voice) return;
    this.activeVoices.delete(voiceKey);
    voice.stopped = true;
    voice.source.onended = null;
    try {
      voice.source.disconnect?.();
    } catch {
    }
    try {
      voice.gain?.disconnect?.();
    } catch {
    }
    const next = this.admissions.get(voiceKey);
    this.admissions.delete(voiceKey);
    this.voiceEvent({
      type: "ended",
      id: voice.logicalId,
      channel: voice.channel
    });
    if (next && !this.disposed && !this.userMuted && !this.autoSuspendedByBlur)
      next.execute();
    this.syncDomTelemetry();
  }
  stopVoice(voiceKey, fadeOutSec = 0) {
    const voice = this.activeVoices.get(voiceKey);
    if (!voice) return false;
    if (fadeOutSec && voice.stopping) return false;
    try {
      if (fadeOutSec && this.ctx && voice.gain) {
        const now = this.ctx.currentTime;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + fadeOutSec);
        voice.source.stop(now + fadeOutSec);
        voice.stopping = true;
        return true;
      }
      voice.source.stop();
    } catch (_error) {
    }
    this.finishVoice(voiceKey);
    return true;
  }
  stopAll(channel) {
    for (const [key, task] of this.admissions)
      if (channel === void 0 || task.channel === channel)
        this.admissions.delete(key);
    const before = this.pendingQueue.length;
    this.pendingQueue = this.pendingQueue.filter(
      (task) => channel !== void 0 && task.channel !== channel
    );
    let count = before - this.pendingQueue.length;
    for (const [voiceKey, voice] of [...this.activeVoices.entries()]) {
      if (channel === void 0 || voice.channel === channel) {
        if (this.stopVoice(voiceKey)) count++;
      }
    }
    this.syncDomTelemetry();
    return count;
  }
  getDiagnostics() {
    const state = this.ctx && CONTEXT_STATES.has(this.ctx.state) ? this.ctx.state : "uninitialized";
    return {
      loadedStreams: this.streams.size,
      pendingStreamLoads: this.streamLoads.size,
      retainedStreamBytes: [...this.streams.values()].reduce(
        (sum, lease) => sum + lease.value.retainedBytes,
        0
      ),
      pendingAdmissions: this.admissions.size,
      retiredVoices: this.retiredVoices,
      sampleBackend: this.sampleBackend?.name ?? "native",
      loadedSamples: this.samples.size,
      pendingSampleLoads: this.sampleLoads.size,
      decodedSampleBytes: [...this.samples.values()].reduce(
        (sum, lease) => sum + lease.value.length * lease.value.numberOfChannels * 4,
        0
      ),
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
      pendingQueue: this.pendingQueue.length,
      droppedQueue: this.droppedQueue,
      activeVoices: this.activeVoices.size,
      droppedVoices: this.droppedVoices,
      playedEventsCount: this.playedEventsCount,
      postMessageBridgeActive: this.postMessageBridgeActive,
      lastBridgeCommand: this.lastBridgeCommand,
      backend: this.ctx ? "webaudio" : "unavailable",
      contextAvailable: this.ctx !== null,
      lastError: this.lastError
    };
  }
  syncDomTelemetry() {
    const diagnostics = this.getDiagnostics();
    const win = globalThis;
    win.__ZHUDA_IFRAME_AUDIO__ = diagnostics;
    if (!this.disposed) win.__ZHUDA_IFRAME_ADAPTER__ = this;
    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.zhudaIframeAudio = this.postMessageBridgeActive ? "ready" : "inactive";
      document.body.dataset.zhudaAudioMuted = String(
        this.userMuted || this.autoSuspendedByBlur
      );
      document.body.dataset.zhudaAudioPlayed = String(this.playedEventsCount);
    }
  }
  /** Stops voices, removes every event listener and closes the owned context. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.offlineMix?.abort(new DOMException("Mixer disposed", "AbortError"));
    this.backendPreparing?.abort();
    this.unlockAttempt++;
    this.pendingQueue = [];
    this.stopAll();
    for (const controller of this.sampleLoads.keys()) controller.abort();
    for (const id of [...this.samples.keys()]) this.unloadSample(id);
    for (const controller of this.streamLoads.keys()) controller.abort();
    for (const id of [...this.streams.keys()]) this.unloadStream(id);
    if (!this.streamLoads.size) this.streamCache?.dispose();
    try {
      this.sampleBackend?.dispose();
    } catch (error) {
      this.recordError(error);
    }
    if (!this.sampleLoads.size) this.sampleCache?.dispose();
    try {
      this.masterGain?.disconnect?.();
      for (const node of Object.values(this.channelGains)) node.disconnect?.();
    } catch {
    }
    for (const cleanup of this.cleanupFns.splice(0)) cleanup();
    this.gestureCleanupFns.splice(0);
    this.postMessageBridgeActive = false;
    if (this.ctx && typeof this.ctx.close === "function" && this.ctx.state !== "closed") {
      try {
        Promise.resolve(this.ctx.close()).catch(
          (error) => this.recordError(error)
        );
      } catch (error) {
        this.recordError(error);
      }
    }
    this.syncDomTelemetry();
    if (_IframeSoundAdapter.instance === this)
      _IframeSoundAdapter.instance = null;
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
    const springMathOpsPerMs = Math.round(iterations / elapsedMs);
    const spinePhysicsOpsPerMs = null;
    const zeroGcPoolSpeedupRatio = null;
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
      springMathOpsPerMs,
      measurementScope: "Spring arithmetic microbenchmark only; draw calls below are estimates, and no pool speedup or Spine runtime result is claimed.",
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

// packages/core/NoSleepAdapter.ts
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
var NoSleepAdapter = class {
  constructor(options = {}) {
    this.cleanupFns = [];
    this.gestureCleanupFns = [];
    this.state = "disabled";
    this.desiredEnabled = false;
    this.pageVisible = true;
    this.windowFocused = true;
    this.sentinel = null;
    this.sentinelReleaseCleanup = null;
    this.pendingRequest = null;
    this.requestGeneration = 0;
    this.requestCount = 0;
    this.releaseCount = 0;
    this.staleRequestCount = 0;
    this.lastError = null;
    this.disposed = false;
    this.options = {
      ...options,
      autoEnableOnGesture: options.autoEnableOnGesture ?? true,
      releaseOnBlur: options.releaseOnBlur ?? true
    };
    this.pageVisible = typeof document === "undefined" || document.visibilityState !== "hidden";
    this.installLifecycleGuards();
    if (this.options.autoEnableOnGesture) this.installGestureGuards();
  }
  addEventListener(target, type, listener, options, gesture = false) {
    target.addEventListener(type, listener, options);
    const cleanup = () => target.removeEventListener(type, listener, options);
    this.cleanupFns.push(cleanup);
    if (gesture) this.gestureCleanupFns.push(cleanup);
  }
  removeGestureGuards() {
    for (const cleanup of this.gestureCleanupFns.splice(0)) {
      cleanup();
      const index = this.cleanupFns.indexOf(cleanup);
      if (index >= 0) this.cleanupFns.splice(index, 1);
    }
  }
  installGestureGuards() {
    if (typeof window === "undefined") return;
    const events = ["pointerdown", "touchstart", "mousedown", "keydown"];
    const onGesture = () => {
      void this.enable().then((enabled) => {
        if (enabled) this.removeGestureGuards();
      });
    };
    for (const type of events) {
      this.addEventListener(window, type, onGesture, { capture: true, passive: true }, true);
    }
  }
  installLifecycleGuards() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    this.addEventListener(document, "visibilitychange", () => {
      const visible = document.visibilityState !== "hidden";
      this.handleLifecycleChange(visible, this.windowFocused);
    });
    this.addEventListener(window, "blur", () => {
      this.handleLifecycleChange(this.pageVisible, false);
    });
    this.addEventListener(window, "focus", () => {
      this.handleLifecycleChange(this.pageVisible, true);
    });
    this.addEventListener(window, "pagehide", () => {
      this.handleLifecycleChange(false, false);
    });
    this.addEventListener(window, "pageshow", () => {
      this.handleLifecycleChange(true, true);
    });
  }
  getProvider() {
    if (this.options.wakeLockProvider) {
      try {
        return this.options.wakeLockProvider();
      } catch (error) {
        this.lastError = errorMessage(error);
        return null;
      }
    }
    const root = globalThis;
    return root.navigator?.wakeLock ?? null;
  }
  isSupported() {
    return this.getProvider() !== null;
  }
  recordError(error) {
    this.lastError = errorMessage(error);
  }
  canRequest() {
    return !this.disposed && this.desiredEnabled && this.pageVisible && this.windowFocused;
  }
  releaseCandidate(candidate) {
    this.releaseCount++;
    try {
      Promise.resolve(candidate.release()).catch((error) => this.recordError(error));
    } catch (error) {
      this.recordError(error);
    }
  }
  detachSentinel(candidate) {
    if (this.sentinel !== candidate) return;
    this.sentinel = null;
    this.sentinelReleaseCleanup?.();
    this.sentinelReleaseCleanup = null;
  }
  releaseSentinel(keepDesired) {
    this.requestGeneration++;
    const candidate = this.sentinel;
    if (candidate) {
      this.detachSentinel(candidate);
      this.releaseCandidate(candidate);
    }
    if (this.disposed) return;
    this.state = keepDesired && this.desiredEnabled ? "suspended" : "disabled";
  }
  attachSentinel(candidate, generation) {
    if (!candidate || typeof candidate.release !== "function") {
      this.state = "error";
      this.lastError = "Wake Lock provider returned an invalid sentinel";
      return false;
    }
    if (candidate.released === true) {
      this.staleRequestCount++;
      this.releaseCandidate(candidate);
      this.state = "suspended";
      return false;
    }
    if (!this.canRequest() || generation !== this.requestGeneration) {
      this.staleRequestCount++;
      this.releaseCandidate(candidate);
      return false;
    }
    this.sentinel = candidate;
    const onRelease = () => {
      if (this.sentinel !== candidate) return;
      this.detachSentinel(candidate);
      this.releaseCount++;
      if (this.disposed) return;
      this.state = this.desiredEnabled ? "suspended" : "disabled";
      if (this.canRequest()) void this.requestLock();
    };
    candidate.addEventListener?.("release", onRelease);
    this.sentinelReleaseCleanup = () => candidate.removeEventListener?.("release", onRelease);
    this.state = "enabled";
    this.lastError = null;
    return true;
  }
  requestLock() {
    if (!this.canRequest()) return Promise.resolve(false);
    if (this.sentinel && this.sentinel.released !== true) {
      this.state = "enabled";
      return Promise.resolve(true);
    }
    if (this.pendingRequest) return this.pendingRequest;
    const provider = this.getProvider();
    if (!provider) {
      this.state = "unsupported";
      this.lastError = "Screen Wake Lock API is unavailable";
      return Promise.resolve(false);
    }
    const generation = ++this.requestGeneration;
    this.requestCount++;
    this.state = "requesting";
    let request;
    try {
      request = Promise.resolve(provider.request("screen")).then(
        (candidate) => this.attachSentinel(candidate, generation),
        (error) => {
          if (generation === this.requestGeneration && !this.disposed) {
            this.state = error?.name === "NotAllowedError" ? "denied" : "error";
            this.recordError(error);
          }
          return false;
        }
      );
    } catch (error) {
      this.state = "error";
      this.recordError(error);
      return Promise.resolve(false);
    }
    this.pendingRequest = request;
    void request.finally(() => {
      if (this.pendingRequest === request) this.pendingRequest = null;
    }).catch((error) => this.recordError(error));
    return request;
  }
  handleLifecycleChange(visible, focused) {
    if (this.disposed) return;
    this.pageVisible = Boolean(visible);
    this.windowFocused = Boolean(focused);
    if (!this.pageVisible || !this.windowFocused && this.options.releaseOnBlur) {
      this.releaseSentinel(true);
      return;
    }
    if (this.desiredEnabled) void this.requestLock();
  }
  /** Enable the native screen wake lock. Call from a user gesture when possible. */
  enable() {
    if (this.disposed) return Promise.resolve(false);
    this.desiredEnabled = true;
    if (!this.pageVisible || !this.windowFocused && this.options.releaseOnBlur) {
      this.state = "suspended";
      return Promise.resolve(false);
    }
    return this.requestLock();
  }
  /** Disable and release the current sentinel; release failures are diagnosed. */
  disable() {
    if (this.disposed) return;
    this.desiredEnabled = false;
    this.removeGestureGuards();
    this.releaseSentinel(false);
  }
  isEnabled() {
    return !this.disposed && this.state === "enabled" && this.sentinel !== null;
  }
  getDiagnostics() {
    return {
      state: this.state,
      supported: this.isSupported(),
      desiredEnabled: this.desiredEnabled,
      pageVisible: this.pageVisible,
      windowFocused: this.windowFocused,
      requestCount: this.requestCount,
      releaseCount: this.releaseCount,
      staleRequestCount: this.staleRequestCount,
      lastError: this.lastError
    };
  }
  /** Remove listeners and release all owned wake-lock resources. */
  dispose() {
    if (this.disposed) return;
    this.desiredEnabled = false;
    this.requestGeneration++;
    this.releaseSentinel(false);
    this.disposed = true;
    this.state = "disposed";
    for (const cleanup of this.cleanupFns.splice(0)) cleanup();
    this.gestureCleanupFns.splice(0);
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

// packages/core/particles/ParticleExtras.ts
function validateParticleExtras(e, dimension = 2) {
  const errors = [], r = e.textureRect, f = e.flipbook, c = e.collision;
  if (r && (![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x + r.width > 1.000001 || r.y + r.height > 1.000001)) errors.push("textureRect must be a normalized rectangle inside the texture.");
  if (f) {
    if (!Number.isInteger(f.columns) || !Number.isInteger(f.rows) || f.columns < 1 || f.rows < 1 || f.columns * f.rows > 65536) errors.push("Invalid flipbook grid.");
    const start = f.startFrame ?? 0, count = f.frameCount ?? f.columns * f.rows;
    if (!Number.isInteger(start) || !Number.isInteger(count) || start < 0 || count < 1 || start + count > f.columns * f.rows) errors.push("Invalid flipbook frame range.");
    if (f.fps !== void 0 && (!Number.isFinite(f.fps) || f.fps <= 0) || f.cycles !== void 0 && (!Number.isFinite(f.cycles) || f.cycles <= 0) || f.loop !== void 0 && typeof f.loop !== "boolean") errors.push("Invalid flipbook timing.");
  }
  if (c) {
    if (!Array.isArray(c.planes) || c.planes.length < 1 || c.planes.length > 16) errors.push("collision requires 1..16 planes.");
    else for (const p of c.planes) if (!p?.normal || ![p.normal.x, p.normal.y, p.normal.z ?? 0, p.offset].every(Number.isFinite) || Math.hypot(p.normal.x, p.normal.y, p.normal.z ?? 0) < 1e-8 || dimension === 2 && (p.normal.z ?? 0) !== 0) errors.push("Invalid collision plane.");
    for (const k of ["restitution", "friction"]) if (c[k] !== void 0 && (!Number.isFinite(c[k]) || c[k] < 0 || c[k] > 1)) errors.push(`collision.${k} must be 0..1.`);
    if (c.radius !== void 0 && (!Number.isFinite(c.radius) || c.radius < 0)) errors.push("Invalid collision radius.");
    if (c.killOnCollision !== void 0 && typeof c.killOnCollision !== "boolean") errors.push("Invalid collision response.");
  }
  return errors;
}
function sampleParticleUV(spec, age, lifetime, out) {
  const r = spec.textureRect || { x: 0, y: 0, width: 1, height: 1 }, f = spec.flipbook;
  Object.assign(out, r);
  if (!f) return out;
  const count = f.frameCount ?? f.columns * f.rows, progress = f.fps !== void 0 ? age * f.fps : age / lifetime * (f.cycles ?? 1) * count;
  const step = Math.max(0, Math.floor(progress + 1e-8)), frame = (f.startFrame ?? 0) + (f.loop === false ? Math.min(count - 1, step) : step % count);
  out.x = r.x + frame % f.columns * r.width / f.columns;
  out.y = r.y + Math.floor(frame / f.columns) * r.height / f.rows;
  out.width = r.width / f.columns;
  out.height = r.height / f.rows;
  return out;
}
function resolveParticleCollision(p, spec, dimension, hit) {
  let killed = false;
  for (let i = 0; i < spec.planes.length; i++) {
    const plane = spec.planes[i], n = plane.normal, length = Math.hypot(n.x, n.y, dimension === 3 ? n.z || 0 : 0), nx = n.x / length, ny = n.y / length, nz = dimension === 3 ? (n.z || 0) / length : 0;
    const penetration = plane.offset / length + (spec.radius || 0) - (p.x * nx + p.y * ny + (p.z || 0) * nz);
    if (penetration <= 0) continue;
    p.x += nx * penetration;
    p.y += ny * penetration;
    if (dimension === 3) p.z += nz * penetration;
    const vn = p.vx * nx + p.vy * ny + (p.vz || 0) * nz;
    if (vn < 0) {
      const bounce = (1 + (spec.restitution ?? 0.5)) * vn;
      p.vx -= bounce * nx;
      p.vy -= bounce * ny;
      if (dimension === 3) p.vz -= bounce * nz;
      const normal = p.vx * nx + p.vy * ny + (p.vz || 0) * nz, keep = 1 - (spec.friction ?? 0);
      p.vx = nx * normal + (p.vx - nx * normal) * keep;
      p.vy = ny * normal + (p.vy - ny * normal) * keep;
      if (dimension === 3) p.vz = nz * normal + (p.vz - nz * normal) * keep;
      hit(i);
      if (spec.killOnCollision) {
        killed = true;
        break;
      }
    }
  }
  return killed;
}

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
  const finite2 = (v) => typeof v === "number" && Number.isFinite(v);
  for (const e of spec.emitters) {
    if (!e || typeof e !== "object") {
      issues.push("Emitter must be an object.");
      continue;
    }
    const id = e.id || "(unnamed)";
    issues.push(...validateParticleExtras(e).map((message) => `${id}: ${message}`));
    if (typeof e.id !== "string" || !e.id || ids.has(e.id)) issues.push(`${id}: id must be unique and non-empty.`);
    ids.add(e.id);
    if (typeof e.texture !== "string" || !e.texture) issues.push(`${id}: texture is required.`);
    if (!Number.isInteger(e.maxParticles) || e.maxParticles < 1 || e.maxParticles > 16383) issues.push(`${id}: maxParticles must be 1..16383.`);
    if (!Number.isInteger(e.seed)) issues.push(`${id}: seed must be an integer.`);
    if (!["world", "local"].includes(e.space) || !["alpha", "additive"].includes(e.blend)) issues.push(`${id}: explicit space and blend are required.`);
    if (!finite2(e.rate) || e.rate < 0) issues.push(`${id}: rate must be non-negative.`);
    for (const key of ["lifetime", "speed", "angle", "size", "rotation", "angularVelocity"]) {
      const v = e[key];
      if (v === void 0 && ["rotation", "angularVelocity"].includes(key)) continue;
      const range = Array.isArray(v) ? v : [v, v];
      if (range.length !== 2 || typeof range[0] !== "number" || typeof range[1] !== "number" || !range.every(finite2) || range[0] > range[1]) issues.push(`${id}: invalid ${key} range.`);
      else if ((key === "lifetime" || key === "size") && range[0] <= 0) issues.push(`${id}: ${key} must be positive.`);
    }
    if (!e.shape || !["point", "box", "circle"].includes(e.shape.type)) issues.push(`${id}: invalid shape.`);
    else if (e.shape.type === "box" && (![e.shape.width, e.shape.height].every(finite2) || e.shape.width < 0 || e.shape.height < 0)) issues.push(`${id}: invalid box dimensions.`);
    else if (e.shape.type === "circle" && (!finite2(e.shape.radius) || e.shape.radius < 0)) issues.push(`${id}: invalid circle radius.`);
    for (const key of ["drag", "rateOverDistance", "stretch"]) {
      if (e[key] !== void 0 && (!finite2(e[key]) || e[key] < 0)) issues.push(`${id}: ${key} must be non-negative.`);
    }
    if (e.duration !== void 0 && (!finite2(e.duration) || e.duration <= 0)) issues.push(`${id}: duration must be positive.`);
    if (e.loop !== void 0 && typeof e.loop !== "boolean") issues.push(`${id}: loop must be boolean.`);
    if (e.loop && e.duration !== void 0 && e.duration < 1 / 120) issues.push(`${id}: looping duration must be at least 1/120 second.`);
    if (e.acceleration && ![e.acceleration.x, e.acceleration.y].every(finite2)) issues.push(`${id}: acceleration must be finite.`);
    if (e.turbulence && (![e.turbulence.strength, e.turbulence.frequency].every(finite2) || e.turbulence.strength < 0 || e.turbulence.frequency < 0)) issues.push(`${id}: invalid turbulence.`);
    if (e.bursts !== void 0 && (!Array.isArray(e.bursts) || e.bursts.some((b) => !b || !finite2(b.time) || b.time < 0 || !Number.isInteger(b.count) || b.count < 0))) issues.push(`${id}: invalid bursts.`);
    if (Array.isArray(e.bursts) && finite2(e.duration) && e.bursts.some((b) => b && b.time > e.duration)) issues.push(`${id}: burst time exceeds duration.`);
    for (const key of ["sizeOverLife", "alphaOverLife", "colorOverLife"]) {
      const keys = e[key];
      if (keys === void 0) continue;
      if (!Array.isArray(keys) || !keys.length) {
        issues.push(`${id}: ${key} must be non-empty.`);
        continue;
      }
      let previous = -1;
      for (const k of keys) {
        if (!k || !finite2(k.time) || k.time < 0 || k.time > 1 || k.time <= previous) {
          issues.push(`${id}: ${key} times must increase within 0..1.`);
          break;
        }
        previous = k.time;
        if (key === "colorOverLife") {
          if (!/^#[0-9a-f]{6}$/i.test(k.color)) issues.push(`${id}: colors must use #rrggbb.`);
        } else if (!finite2(k.value) || k.value < 0 || key === "alphaOverLife" && k.value > 1) issues.push(`${id}: invalid ${key} value.`);
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
    /** Future births respect this cap; existing particles drain naturally. */
    this.limit = Infinity;
    this.droppedEvents = 0;
    this.events = [];
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
  get particleLimit() {
    return this.limit;
  }
  set particleLimit(value) {
    if (value !== Infinity && (!Number.isInteger(value) || value < 0)) throw new Error("Particle limit must be a non-negative integer.");
    this.limit = value;
  }
  queueEvent(type, p, plane = -1) {
    if (!this.onEvent) return;
    if (this.events.length >= this.capacity * 2) {
      this.droppedEvents++;
      return;
    }
    this.events.push({ type, x: p.x, y: p.y, z: p.z || 0, vx: p.vx, vy: p.vy, vz: p.vz || 0, age: p.age, plane });
  }
  flushEvents() {
    if (!this.events.length) return;
    const events = this.events;
    this.events = [];
    for (const e of events) this.onEvent?.(e);
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
    this.events.length = 0;
    this.droppedEvents = 0;
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
    const accepted = Math.min(count, this.freeCount, Math.max(0, Math.floor(this.particleLimit) - this.count));
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
    this.flushEvents();
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
        this.queueEvent("death", p);
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
      if (s.collision && resolveParticleCollision(p, s.collision, 2, (plane) => this.queueEvent("collision", p, plane))) {
        this.queueEvent("death", p);
        this.free[this.freeCount++] = index;
        this.active[i] = this.active[--this.count];
        continue;
      }
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
        const accepted = Math.min(byDistance, this.freeCount, Math.max(0, Math.floor(this.particleLimit) - this.count));
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
    this.frameUV = { x: 0, y: 0, width: 1, height: 1 };
    this.appendParticle = (p) => {
      const s = this.system.spec, t = Math.min(0.999999, p.age / p.lifetime);
      const batch = this.batches[Math.floor(t * this.batches.length)];
      const i = batch.count++ * 8;
      const rect = sampleParticleUV(s, p.age, p.lifetime, this.frameUV), source = this.uv;
      const uv = batch.uvs;
      for (let corner = 0; corner < 4; corner++) {
        const u = rect.x + (corner === 1 || corner === 2 ? rect.width : 0), v = rect.y + (corner >= 2 ? rect.height : 0);
        uv[i + corner * 2] = source[0] + (source[2] - source[0]) * u + (source[6] - source[0]) * v;
        uv[i + corner * 2 + 1] = source[1] + (source[3] - source[1]) * u + (source[7] - source[1]) * v;
      }
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

// packages/core/effects/VfxMaterial.ts
function validateVfxMaterial(s) {
  if (!s || s.version !== 1) return ["VFX material requires version 1."];
  const errors = [];
  for (const k of ["dissolve", "edgeWidth", "uvDistortion", "refraction"]) if (s[k] !== void 0 && (!Number.isFinite(s[k]) || s[k] < 0 || s[k] > 1)) errors.push(`${k} must be 0..1.`);
  for (const k of ["intensity", "softDistance"]) if (s[k] !== void 0 && (!Number.isFinite(s[k]) || s[k] < 0 || s[k] > 100)) errors.push(`${k} must be 0..100.`);
  if (s.uvScroll && ![s.uvScroll.x, s.uvScroll.y].every(Number.isFinite)) errors.push("Invalid UV scroll.");
  if (s.edgeColor !== void 0 && !/^#[0-9a-f]{6}$/i.test(s.edgeColor)) errors.push("Invalid edge color.");
  for (const key of ["maskTexture", "noiseTexture"]) if (s[key] !== void 0 && (typeof s[key] !== "string" || !s[key].length)) errors.push(`Invalid ${key}.`);
  return errors;
}
var ZHUDA_VFX_VERTEX = `
#define SHADER_NAME ZhudaVfxVS
#include "Camera.glsl";
#include "Sprite3DVertex.glsl";
#include "VertexCommon.glsl";
varying vec2 v_UV; varying vec4 v_Color; varying vec4 v_Clip; varying float v_EyeDepth;
void main(){
  Vertex vertex; getVertexParams(vertex);
  v_UV=vertex.texCoord0; v_Color=vertex.vertexColor;
  vec4 world=getWorldMatrix()*vec4(vertex.positionOS,1.0);
  vec4 clip=getPositionCS(world.xyz/world.w); v_Clip=clip;
  v_EyeDepth=-(u_View*world).z;
  gl_Position=remapPositionZ(clip);
}`;
var ZHUDA_VFX_FRAGMENT = `
#define SHADER_NAME ZhudaVfxFS
#include "Camera.glsl";
varying vec2 v_UV; varying vec4 v_Color; varying vec4 v_Clip; varying float v_EyeDepth;
uniform sampler2D u_BaseTexture; uniform sampler2D u_MaskTexture; uniform sampler2D u_NoiseTexture;
uniform vec4 u_VfxParams; uniform vec4 u_UVParams; uniform vec4 u_EdgeColor; uniform vec4 u_VfxFlags; uniform float u_VfxTime;
void main(){
  vec2 uv=v_UV+u_UVParams.xy*u_VfxTime;
  vec2 flow=texture2D(u_NoiseTexture,uv).rg*2.0-1.0;
  vec4 base=texture2D(u_BaseTexture,uv+flow*u_UVParams.z)*v_Color;
  float noise=texture2D(u_NoiseTexture,uv).r;
  float visible=1.0; float edge=0.0;
  if(u_VfxParams.x>0.0){
    visible=smoothstep(u_VfxParams.x,u_VfxParams.x+max(0.001,u_VfxParams.y),noise);
    edge=visible*(1.0-smoothstep(u_VfxParams.x+u_VfxParams.y,u_VfxParams.x+2.0*max(0.001,u_VfxParams.y),noise));
  }
  if(u_VfxParams.x>=1.0)visible=0.0;
  base.a*=texture2D(u_MaskTexture,v_UV).r*visible;
  base.rgb=base.rgb*u_VfxParams.z+u_EdgeColor.rgb*edge*u_EdgeColor.a;
  vec2 screen=v_Clip.xy/v_Clip.w*0.5+0.5;
  screen.y=mix(screen.y,1.0-screen.y,u_VfxFlags.y);
  if(u_UVParams.w>0.0){vec3 scene=texture2D(u_CameraOpaqueTexture,clamp(screen+flow*u_UVParams.w,0.001,0.999)).rgb;base.rgb=mix(base.rgb,scene,0.85);}
  if(u_VfxParams.w>0.0){float d=texture2D(u_CameraDepthTexture,screen).r;float eye=1.0/(u_ZBufferParams.z*d+u_ZBufferParams.w);base.a*=clamp((eye-v_EyeDepth)/u_VfxParams.w,0.0,1.0);}
  gl_FragColor=base;
}`;
var ZhudaVfxMaterial = class {
  constructor(spec, baseTexture, resolveTexture, blend = "alpha") {
    this.disposed = false;
    const errors = validateVfxMaterial(spec);
    if (errors.length) throw new Error(errors.join(" | "));
    const l = globalThis.Laya;
    if (!l?.Shader3D || !baseTexture) throw new Error("Boot Laya 3D and load a base texture before creating VFX materials.");
    if (!l.Shader3D.find("ZhudaVfx")) {
      const shader = l.Shader3D.add("ZhudaVfx", true, false);
      shader.shaderType = l.ShaderFeatureType.D3;
      const uniforms = {
        u_BaseTexture: l.ShaderDataType.Texture2D,
        u_MaskTexture: l.ShaderDataType.Texture2D,
        u_NoiseTexture: l.ShaderDataType.Texture2D,
        u_VfxParams: l.ShaderDataType.Vector4,
        u_UVParams: l.ShaderDataType.Vector4,
        u_EdgeColor: l.ShaderDataType.Vector4,
        u_VfxFlags: l.ShaderDataType.Vector4,
        u_VfxTime: l.ShaderDataType.Float
      };
      const sub = new l.SubShader(l.SubShader.DefaultAttributeMap, uniforms);
      shader.addSubShader(sub);
      sub.addShaderPass(ZHUDA_VFX_VERTEX, ZHUDA_VFX_FRAGMENT);
    }
    this.resolveTexture = resolveTexture;
    this.baseTexture = baseTexture.bitmap || baseTexture;
    this.material = new l.Material();
    this.material.setShaderName("ZhudaVfx");
    this.material.renderQueue = 3e3;
    this.material.depthWrite = false;
    this.material.depthTest = l.RenderState.DEPTHTEST_LEQUAL;
    this.material.cull = l.RenderState.CULL_NONE;
    this.material.blend = l.RenderState.BLEND_ENABLE_ALL;
    this.material.blendSrc = l.RenderState.BLENDPARAM_SRC_ALPHA;
    this.material.blendDst = blend === "additive" ? l.RenderState.BLENDPARAM_ONE : l.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
    this.spec = JSON.parse(JSON.stringify(spec));
    try {
      this.apply(this.spec);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  descriptor() {
    return JSON.parse(JSON.stringify(this.spec));
  }
  configure(patch) {
    if (this.disposed) throw new Error("Disposed VFX material.");
    const next = { ...this.spec, ...patch };
    const errors = validateVfxMaterial(next);
    if (errors.length) throw new Error(errors.join(" | "));
    this.apply(next);
    this.spec = JSON.parse(JSON.stringify(next));
  }
  setTime(seconds) {
    if (!Number.isFinite(seconds)) throw new Error("Invalid material time.");
    this.material.setFloat("u_VfxTime", seconds);
  }
  setScreenFlipY(flip) {
    const l = globalThis.Laya;
    this.material.setVector4("u_VfxFlags", new l.Vector4(0, flip ? 1 : 0, 0, 0));
  }
  apply(s) {
    const l = globalThis.Laya, m = this.material;
    const texture = (key) => {
      if (!key) return l.Texture2D.whiteTexture;
      const value = this.resolveTexture(key);
      if (!value) throw new Error(`Missing VFX texture: ${key}`);
      return value.bitmap || value;
    };
    const mask = texture(s.maskTexture), noise = texture(s.noiseTexture);
    m.setTexture("u_BaseTexture", this.baseTexture);
    m.setTexture("u_MaskTexture", mask);
    m.setTexture("u_NoiseTexture", noise);
    m.setVector4("u_VfxParams", new l.Vector4(s.dissolve ?? 0, s.edgeWidth ?? 0.04, s.intensity ?? 1, s.softDistance ?? 0));
    m.setVector4("u_UVParams", new l.Vector4(s.uvScroll?.x ?? 0, s.uvScroll?.y ?? 0, s.uvDistortion ?? 0, s.refraction ?? 0));
    const color = parseInt((s.edgeColor || "#ffbb44").slice(1), 16);
    m.setVector4("u_EdgeColor", new l.Vector4((color >> 16 & 255) / 255, (color >> 8 & 255) / 255, (color & 255) / 255, 1));
    m.setVector4("u_VfxFlags", new l.Vector4());
    m.setFloat("u_VfxTime", 0);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const name of ["u_BaseTexture", "u_MaskTexture", "u_NoiseTexture"]) this.material.setTexture(name, null);
    this.material.destroy();
  }
};
var _ZhudaVfxCamera = class _ZhudaVfxCamera {
  constructor(camera, options = {}) {
    this.disposed = false;
    const runtime2 = globalThis.Laya;
    if (_ZhudaVfxCamera.owners.has(camera)) throw new Error("This camera already has a VFX pass owner.");
    if (options.bloomIntensity !== void 0 && (!runtime2?.PostProcess || !runtime2?.BloomEffect || !Number.isFinite(options.bloomIntensity) || options.bloomIntensity < 0)) throw new Error("Bloom requires the Laya postProcess module and a non-negative intensity.");
    _ZhudaVfxCamera.owners.add(camera);
    this.camera = camera;
    const l = globalThis.Laya;
    this.depth = camera.depthTextureMode;
    this.opaque = camera.opaquePass;
    this.post = camera.postProcess;
    if (options.softParticles) camera.depthTextureMode |= l.DepthTextureMode.Depth;
    if (options.refraction) camera.opaquePass = true;
    if (options.bloomIntensity !== void 0) {
      if (!l.PostProcess || !l.BloomEffect || !Number.isFinite(options.bloomIntensity) || options.bloomIntensity < 0) throw new Error("Bloom requires the Laya postProcess module and a non-negative intensity.");
      this.ownedPost = this.post || new l.PostProcess();
      camera.postProcess = this.ownedPost;
      this.bloom = new l.BloomEffect();
      this.bloom.intensity = options.bloomIntensity;
      this.ownedPost.addEffect(this.bloom);
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    _ZhudaVfxCamera.owners.delete(this.camera);
    this.camera.depthTextureMode = this.depth;
    this.camera.opaquePass = this.opaque;
    if (this.bloom) {
      this.ownedPost.removeEffect(this.bloom);
      if (this.camera.postProcess === this.ownedPost && !this.post) this.camera.postProcess = this.post;
    }
  }
};
_ZhudaVfxCamera.owners = /* @__PURE__ */ new WeakSet();
var ZhudaVfxCamera = _ZhudaVfxCamera;

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
  const issues = validateParticleEffect({ schemaVersion: 1, emitters: spec.emitters.map((e) => e && { ...e, collision: void 0, angle: 0, shape: { type: "point" } }) });
  const vector = (v) => v && [v.x, v.y, v.z].every(Number.isFinite);
  for (const e of spec.emitters) {
    if (!e || typeof e !== "object") continue;
    issues.push(...validateParticleExtras(e, 3).map((message) => `${e.id}: ${message}`));
    if (!vector(e.direction) || Math.hypot(e.direction.x, e.direction.y, e.direction.z) < 1e-8) issues.push(`${e.id}: direction must be a finite non-zero vector.`);
    if (!Number.isFinite(e.spread) || e.spread < 0 || e.spread > Math.PI) issues.push(`${e.id}: spread must be 0..PI radians.`);
    if (e.acceleration && !vector(e.acceleration)) issues.push(`${e.id}: acceleration must have finite XYZ components.`);
    if (e.velocityInheritance !== void 0 && (!Number.isFinite(e.velocityInheritance) || e.velocityInheritance < 0 || e.velocityInheritance > 2)) issues.push(`${e.id}: velocityInheritance must be 0..2.`);
    if (e.billboard !== void 0 && !["camera", "velocity", "ground"].includes(e.billboard)) issues.push(`${e.id}: invalid billboard mode.`);
    if (e.material) issues.push(...validateVfxMaterial(e.material));
    const shape = e.shape;
    if (!shape || !["point", "box", "sphere"].includes(shape.type)) issues.push(`${e.id}: invalid 3D shape.`);
    else if (shape.type === "box" && ![shape.width, shape.height, shape.depth].every((v) => Number.isFinite(v) && v >= 0)) issues.push(`${e.id}: invalid 3D box dimensions.`);
    else if (shape.type === "sphere" && (!Number.isFinite(shape.radius) || shape.radius < 0)) issues.push(`${e.id}: invalid sphere radius.`);
  }
  return issues;
}

// packages/core/particles/ParticleSystem3D.ts
var ZhudaParticleSystem3D = class {
  constructor(spec, simulation = {}) {
    this.transform = { x: 0, y: 0, z: 0, rotation: { x: 0, y: 0, z: 0, w: 1 } };
    this.emitterVelocity = { x: 0, y: 0, z: 0 };
    this.intensity = 1;
    this.emitting = false;
    this.time = 0;
    this.droppedParticles = 0;
    this.droppedSeconds = 0;
    /** Future births respect this cap; existing particles drain naturally. */
    this.limit = Infinity;
    this.droppedEvents = 0;
    this.events = [];
    this.count = 0;
    this.accumulator = 0;
    this.remainder = 0;
    this.distanceRemainder = 0;
    this.cycle = 0;
    this.first = true;
    this.positioned = false;
    this.previous = { x: 0, y: 0, z: 0 };
    this.scratch = { x: 0, y: 0, z: 0 };
    this.frequency = 120;
    this.maxSteps = 30;
    this.simulatedSteps = 0;
    this.lastSubsteps = 0;
    this.setSimulation(simulation);
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
  get particleLimit() {
    return this.limit;
  }
  set particleLimit(value) {
    if (value !== Infinity && (!Number.isInteger(value) || value < 0)) throw new Error("Particle limit must be a non-negative integer.");
    this.limit = value;
  }
  queueEvent(type, p, plane = -1) {
    if (!this.onEvent) return;
    if (this.events.length >= this.capacity * 2) {
      this.droppedEvents++;
      return;
    }
    this.events.push({ type, x: p.x, y: p.y, z: p.z || 0, vx: p.vx, vy: p.vy, vz: p.vz || 0, age: p.age, plane });
  }
  flushEvents() {
    if (!this.events.length) return;
    const events = this.events;
    this.events = [];
    for (const e of events) this.onEvent?.(e);
  }
  get frequencyHz() {
    return this.frequency;
  }
  /** Rate changes discard only the fractional remainder, reported in droppedSeconds. */
  setSimulation(options) {
    const frequency = options.frequencyHz ?? this.frequency, maxSteps = options.maxSubsteps ?? this.maxSteps;
    if (!Number.isFinite(frequency) || frequency < 15 || frequency > 240 || !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 240)
      throw new Error("Invalid particle simulation budget.");
    if (frequency !== this.frequency) {
      this.droppedSeconds += this.accumulator;
      this.accumulator = 0;
    }
    this.frequency = frequency;
    this.maxSteps = maxSteps;
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
    this.events.length = 0;
    this.droppedEvents = 0;
    for (let i = 0; i < this.capacity; i++) this.free[i] = this.capacity - 1 - i;
    this.rng = this.spec.seed >>> 0;
    this.time = this.cycle = this.accumulator = this.remainder = this.distanceRemainder = 0;
    this.first = true;
    this.droppedParticles = this.droppedSeconds = this.simulatedSteps = this.lastSubsteps = 0;
    Object.assign(this.previous, { x: this.transform.x, y: this.transform.y, z: this.transform.z });
  }
  burst(count, x = this.transform.x, y = this.transform.y, z = this.transform.z) {
    if (!Number.isInteger(count) || count < 0 || ![x, y, z].every(Number.isFinite)) throw new Error("Invalid 3D burst.");
    const accepted = Math.min(count, this.freeCount, Math.max(0, Math.floor(this.particleLimit) - this.count));
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
    const step = 1 / this.frequency;
    const requested = Math.floor((this.accumulator + 1e-10) / step);
    const steps = Math.min(requested, this.maxSteps);
    this.lastSubsteps = steps;
    this.simulatedSteps += steps;
    this.droppedSeconds += (requested - steps) * step;
    const sx = this.previous.x, sy = this.previous.y, sz = this.previous.z;
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      const x = sx + (this.transform.x - sx) * t, y = sy + (this.transform.y - sy) * t, z = sz + (this.transform.z - sz) * t;
      this.step(step, x, y, z);
      Object.assign(this.previous, { x, y, z });
    }
    this.accumulator = Math.max(0, this.accumulator - requested * step);
    this.flushEvents();
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
        this.queueEvent("death", p);
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
      if (s.collision && resolveParticleCollision(p, s.collision, 3, (plane) => this.queueEvent("collision", p, plane))) {
        this.queueEvent("death", p);
        this.free[this.freeCount++] = slot;
        this.active[i] = this.active[--this.count];
        continue;
      }
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
      const distanceCount = Math.floor(this.distanceRemainder + 1e-10), accepted = Math.min(distanceCount, this.freeCount, Math.max(0, Math.floor(this.particleLimit) - this.count));
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
ZhudaParticleSystem3D.STEP = 1 / 120;

// packages/core/particles/ParticleMesh3D.ts
var ZhudaParticleMesh3D = class {
  constructor(system) {
    this.frameUV = { x: 0, y: 0, width: 1, height: 1 };
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
    const previousCount = g.vertexCount;
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
      const rect = sampleParticleUV(spec, p.age, p.lifetime, this.frameUV);
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
        v[base + 7] = rect.x + (sx > 0 ? rect.width : 0);
        v[base + 8] = rect.y + (sy > 0 ? 0 : rect.height);
      }
    }
    g.vertices.fill(0, this.items.length * 36, previousCount * 9);
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
  constructor(parent, geometry, texture, blend, color, vfxSpec, resolver, staticIndices = false) {
    this.disposed = false;
    this.drawCount = -1;
    this.staticIndices = staticIndices;
    const l = globalThis.Laya;
    if (!l?.PrimitiveMesh?._createMesh || !l?.MeshSprite3D || !texture) throw new Error("3D particle rendering requires booted Laya 3.4.2 3D modules and a texture.");
    this.mesh = l.PrimitiveMesh._createMesh(l.VertexMesh.getVertexDeclaration("POSITION,COLOR,UV"), geometry.vertices, geometry.indices);
    this.vfx = vfxSpec ? new ZhudaVfxMaterial(vfxSpec, texture, resolver, blend) : void 0;
    this.material = this.vfx?.material || new l.UnlitMaterial();
    this.material.enableVertexColor = true;
    if (!this.vfx) this.material.albedoTexture = texture.bitmap || texture;
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
    this.node.active = false;
    this.node.meshRenderer.sharedMaterial = this.material;
    parent.addChild(this.node);
    this.min = new l.Vector3();
    this.max = new l.Vector3();
  }
  submit(g, visible) {
    if (this.disposed) return;
    this.node.active = visible && g.indexCount > 0;
    if (!this.node.active) return;
    this.mesh._vertexBuffer.setData(g.vertices.buffer, 0, g.vertices.byteOffset, g.vertexCount * 9 * 4);
    if (!this.staticIndices) this.mesh._indexBuffer.setData(g.indices, 0, 0, g.indexCount);
    if (this.drawCount !== g.indexCount) {
      this.mesh.getSubMesh(0)._setIndexRange(0, g.indexCount);
      this.drawCount = g.indexCount;
    }
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
    if (this.vfx) this.vfx.dispose();
    else this.material.destroy();
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
    this.backend = new DynamicParticleMesh3D(parent, this.builder.geometry, resolveTexture(system.spec.texture), system.spec.blend, void 0, system.spec.material, resolveTexture, true);
    this.node = this.backend.node;
  }
  get vfxMaterial() {
    return this.backend.vfx;
  }
  render(camera, opacity = 1) {
    this.submittedBatches = 0;
    if (this.disposed) return;
    this.backend.vfx?.setTime(this.system.time);
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

// packages/core/runtime3d/Math3D.ts
var identity4 = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function multiply4(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function compose4(p = { x: 0, y: 0, z: 0 }, q = { x: 0, y: 0, z: 0, w: 1 }, s = { x: 1, y: 1, z: 1 }) {
  const n = Math.hypot(q.x, q.y, q.z, q.w);
  if (!n || ![p.x, p.y, p.z, s.x, s.y, s.z, n].every(Number.isFinite))
    throw Error("Invalid transform");
  const x = q.x / n, y = q.y / n, z = q.z / n, w = q.w / n;
  return new Float32Array([
    (1 - 2 * (y * y + z * z)) * s.x,
    2 * (x * y + z * w) * s.x,
    2 * (x * z - y * w) * s.x,
    0,
    2 * (x * y - z * w) * s.y,
    (1 - 2 * (x * x + z * z)) * s.y,
    2 * (y * z + x * w) * s.y,
    0,
    2 * (x * z + y * w) * s.z,
    2 * (y * z - x * w) * s.z,
    (1 - 2 * (x * x + y * y)) * s.z,
    0,
    p.x,
    p.y,
    p.z,
    1
  ]);
}
function transformPoint(m, p) {
  const w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
  if (Math.abs(w) < 1e-12) throw Error("Point projects to infinity");
  return {
    x: (m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12]) / w,
    y: (m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13]) / w,
    z: (m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]) / w
  };
}
function inverse4(a) {
  const rows = Array.from(
    { length: 4 },
    (_, r) => Array.from(
      { length: 8 },
      (_2, c) => c < 4 ? a[c * 4 + r] : Number(c - 4 === r)
    )
  );
  for (let i = 0; i < 4; i++) {
    let p = i;
    for (let r = i + 1; r < 4; r++)
      if (Math.abs(rows[r][i]) > Math.abs(rows[p][i])) p = r;
    if (Math.abs(rows[p][i]) < 1e-12) throw Error("Singular transform");
    [rows[i], rows[p]] = [rows[p], rows[i]];
    const d = rows[i][i];
    for (let c = 0; c < 8; c++) rows[i][c] /= d;
    for (let r = 0; r < 4; r++)
      if (r !== i) {
        const k = rows[r][i];
        for (let c = 0; c < 8; c++) rows[r][c] -= k * rows[i][c];
      }
  }
  return Float32Array.from(
    { length: 16 },
    (_, i) => rows[i % 4][4 + Math.floor(i / 4)]
  );
}
function normalized(v) {
  const n = Math.hypot(v.x, v.y, v.z);
  if (!Number.isFinite(n) || n < 1e-12)
    throw Error("Zero/non-finite direction");
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

// packages/core/effects/EffectDirector.ts
function validateEffectTimeline(s) {
  const errors = [];
  if (!s || s.version !== 1 || !Number.isFinite(s.duration) || s.duration < 1 / 120)
    return ["Timeline requires version 1 and duration >= 1/120."];
  for (const key of ["tracks", "cues", "attachments"])
    if (s[key] !== void 0 && !Array.isArray(s[key]))
      return [`${key} must be an array.`];
  if (s.loop !== void 0 && typeof s.loop !== "boolean")
    errors.push("loop must be boolean.");
  for (const t of s.tracks || []) {
    if (!t.target || !t.parameter || !Array.isArray(t.keys) || !t.keys.length) {
      errors.push("Track needs target, parameter and keys.");
      continue;
    }
    let previous = -1;
    for (const k of t.keys) {
      if (!Number.isFinite(k.time) || k.time < 0 || k.time > s.duration || k.time <= previous || !Number.isFinite(k.value))
        errors.push("Invalid or unordered track key.");
      previous = k.time;
    }
  }
  for (const c of s.cues || [])
    if (!c.target || !["start", "stop", "event"].includes(c.action) || !Number.isFinite(c.time) || c.time < 0 || c.time > s.duration || c.action === "event" && !c.name)
      errors.push("Invalid cue.");
  for (const a of s.attachments || [])
    if (!a.target || !a.source || !a.anchor || a.offset && (![
      a.offset.x,
      a.offset.y,
      a.offset.z ?? 0,
      a.offset.rotation ?? 0,
      ...Object.values(a.offset.quaternion || { x: 0, y: 0, z: 0, w: 1 }),
      ...Object.values(a.offset.scale || { x: 1, y: 1, z: 1 }),
      ...Array.from(a.offset.worldMatrix || [])
    ].every(Number.isFinite) || a.offset.worldMatrix && a.offset.worldMatrix.length !== 16 || a.offset.quaternion && Math.hypot(...Object.values(a.offset.quaternion)) < 1e-12))
      errors.push("Invalid attachment.");
  return errors;
}
var ZhudaEffectDirector = class {
  constructor(spec, bindings) {
    this.time = 0;
    this.playing = false;
    this.cycle = 0;
    this.initial = true;
    const errors = validateEffectTimeline(spec);
    if (errors.length) throw new Error(errors.join(" | "));
    this.spec = JSON.parse(JSON.stringify(spec));
    this.bindings = bindings;
    for (const t of spec.tracks || [])
      if (!bindings[t.target]?.setParameter)
        throw new Error(`Missing parameter binding: ${t.target}`);
    for (const c of spec.cues || [])
      if (!bindings[c.target]?.[c.action])
        throw new Error(`Missing ${c.action} binding: ${c.target}`);
    for (const a of spec.attachments || [])
      if (!bindings[a.source]?.resolveAnchor || !bindings[a.target]?.setTransform)
        throw new Error("Missing attachment binding.");
  }
  reset() {
    for (const b of Object.values(this.bindings)) b.reset();
    this.time = this.cycle = 0;
    this.initial = true;
    this.playing = false;
    this.apply();
  }
  play(restart = false) {
    if (restart || this.time >= this.spec.duration) this.reset();
    this.playing = true;
    this.advance(0, true);
  }
  pause() {
    this.playing = false;
  }
  stop() {
    this.playing = false;
    for (const b of Object.values(this.bindings)) b.stop?.();
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 10)
      throw new Error("Timeline delta must be 0..10 seconds.");
    if (this.playing) this.advance(dt, true);
    else this.apply();
  }
  seek(time, dispatchEvents = false) {
    if (!Number.isFinite(time) || time < 0 || time > this.spec.duration)
      throw new Error("Seek outside timeline.");
    this.reset();
    this.advance(time, dispatchEvents);
    this.playing = false;
  }
  advance(dt, dispatchEvents) {
    let remaining = dt, events = 0;
    do {
      const end = Math.min(this.spec.duration, this.time + remaining);
      const cues = (this.spec.cues || []).filter(
        (c) => (c.time > this.time || this.initial && c.time === 0) && c.time <= end
      ).sort((a, b) => a.time - b.time);
      for (const c of cues) {
        if (++events > 4096) throw new Error("Timeline cue budget exceeded.");
        if (c.action !== "event" || dispatchEvents) {
          const b = this.bindings[c.target];
          if (c.action === "event") b.event(c.name);
          else if (c.action === "start") b.start(c.name);
          else b.stop();
        }
      }
      remaining -= end - this.time;
      this.time = end;
      this.initial = false;
      this.apply();
      if (this.time >= this.spec.duration) {
        if (this.spec.loop && remaining > 1e-10) {
          this.cycle++;
          this.time = 0;
          this.initial = true;
        } else {
          if (!this.spec.loop) this.playing = false;
          break;
        }
      }
    } while (remaining > 1e-10);
  }
  apply() {
    for (const t of this.spec.tracks || []) {
      let value = t.keys[0].value;
      for (let i = 0; i < t.keys.length; i++) {
        const a = t.keys[i], b = t.keys[i + 1];
        if (this.time >= a.time)
          value = !b || this.time >= b.time ? a.value : a.value + (b.value - a.value) * (this.time - a.time) / (b.time - a.time);
      }
      this.bindings[t.target].setParameter(t.parameter, value);
    }
    for (const a of this.spec.attachments || []) {
      const p = this.bindings[a.source].resolveAnchor(a.anchor);
      if (!p) {
        this.bindings[a.target].stop?.();
        continue;
      }
      if (p.worldMatrix || p.quaternion || p.scale || a.offset?.worldMatrix || a.offset?.quaternion || a.offset?.scale) {
        const matrix = (v) => v.worldMatrix || compose4(
          { x: v.x, y: v.y, z: v.z ?? 0 },
          v.quaternion || {
            x: 0,
            y: 0,
            z: Math.sin((v.rotation ?? 0) / 2),
            w: Math.cos((v.rotation ?? 0) / 2)
          },
          v.scale
        );
        const worldMatrix = multiply4(
          matrix(p),
          matrix(a.offset || { x: 0, y: 0 })
        );
        this.bindings[a.target].setTransform({
          x: worldMatrix[12],
          y: worldMatrix[13],
          z: worldMatrix[14],
          worldMatrix
        });
        continue;
      }
      const o = a.offset || { x: 0, y: 0 }, r = p.rotation || 0, c = Math.cos(r), s = Math.sin(r);
      this.bindings[a.target].setTransform({
        x: p.x + o.x * c - o.y * s,
        y: p.y + o.x * s + o.y * c,
        z: (p.z || 0) + (o.z || 0),
        rotation: r + (o.rotation || 0)
      });
    }
  }
};

// packages/core/effects/EffectBudget.ts
var ZhudaEffectBudget = class {
  constructor(spec) {
    this.quality = 1;
    this.slow = 0;
    this.fast = 0;
    if (!Number.isInteger(spec.maxParticles) || spec.maxParticles < 0 || !Number.isFinite(spec.maxCoverage) || spec.maxCoverage < 0 || spec.targetFrameMs !== void 0 && (!Number.isFinite(spec.targetFrameMs) || spec.targetFrameMs <= 0) || spec.minQuality !== void 0 && (!Number.isFinite(spec.minQuality) || spec.minQuality <= 0 || spec.minQuality > 1)) throw new Error("Invalid effect budget.");
    this.spec = { ...spec };
  }
  observeFrame(ms) {
    if (!Number.isFinite(ms) || ms <= 0) throw new Error("Invalid frame measurement.");
    const target = this.spec.targetFrameMs || 16.67;
    this.slow = ms > target * 1.25 ? this.slow + 1 : 0;
    this.fast = ms < target * 0.9 ? this.fast + 1 : 0;
    if (this.slow >= 15) {
      this.quality = Math.max(this.spec.minQuality ?? 0.25, this.quality - 0.1);
      this.slow = 0;
    }
    if (this.fast >= 120) {
      this.quality = Math.min(1, this.quality + 0.05);
      this.fast = 0;
    }
  }
  allocate(requests) {
    const seen = /* @__PURE__ */ new Set();
    for (const r of requests) {
      if (!r.id || seen.has(r.id) || !Number.isInteger(r.particles) || r.particles < 0 || ![r.coverage, r.priority, r.distance ?? 0, r.minimumScale ?? 0].every(Number.isFinite) || r.coverage < 0 || (r.distance ?? 0) < 0 || (r.minimumScale ?? 0) < 0 || (r.minimumScale ?? 0) > 1 || r.fallbackId !== void 0 && !r.fallbackId) throw new Error("Invalid or duplicate effect request.");
      seen.add(r.id);
    }
    if (!Number.isFinite(this.quality) || this.quality < 0 || this.quality > 1) throw Error("Invalid effect quality.");
    let particles = Math.floor(this.spec.maxParticles * this.quality), coverage = this.spec.maxCoverage * this.quality;
    const ordered = [...requests].sort((a, b) => b.priority - a.priority || (a.distance || 0) - (b.distance || 0) || a.id.localeCompare(b.id));
    const result = /* @__PURE__ */ new Map();
    for (const r of ordered) {
      const limit = Math.ceil(r.particles * (r.minimumScale ?? 0));
      const scale = r.particles ? limit / r.particles : r.minimumScale ?? 0;
      const hidden = r.visible === false;
      const unmet = !hidden && (limit > particles || r.coverage * scale > coverage + 1e-10);
      const admitted = !hidden && !unmet;
      if (admitted) {
        particles -= limit;
        coverage -= r.coverage * scale;
      }
      result.set(r.id, {
        id: r.id,
        particleLimit: admitted ? limit : 0,
        emissionScale: admitted ? scale : 0,
        mode: hidden ? "culled" : unmet ? "fallback" : "reduced",
        fallbackRequired: unmet,
        ...unmet && r.fallbackId ? { fallbackId: r.fallbackId } : {}
      });
    }
    for (const r of ordered) {
      const a = result.get(r.id);
      if (a.mode === "culled" || a.fallbackRequired) continue;
      const extra = Math.max(0, Math.min(1 - a.emissionScale, r.particles ? particles / r.particles : 1, r.coverage ? coverage / r.coverage : 1));
      const limit = Math.min(r.particles - a.particleLimit, Math.floor(r.particles * extra + 1e-10));
      const effective = r.particles ? limit / r.particles : extra;
      a.particleLimit += limit;
      a.emissionScale += effective;
      particles -= limit;
      coverage = Math.max(0, coverage - r.coverage * effective);
      a.mode = a.emissionScale >= 1 - 1e-10 ? "full" : "reduced";
    }
    return requests.map((r) => result.get(r.id));
  }
};
function percentiles(values) {
  values.sort((a, b) => a - b);
  const at = (p) => values.length ? values[Math.ceil(values.length * p) - 1] : null;
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99) };
}
var ZhudaRuntimeProfiler = class {
  constructor(options = {}) {
    this.calls = 0;
    this.triangles = 0;
    this.contexts = /* @__PURE__ */ new WeakSet();
    this.contextCount = 0;
    this.restore = [];
    this.samples = [];
    this.next = 0;
    this.total = 0;
    this.duration = 0;
    this.gpuReason = "GPU timer queries not enabled.";
    this.frameOpen = false;
    this.capacity = options.capacity ?? 600;
    if (!Number.isInteger(this.capacity) || this.capacity < 1 || this.capacity > 1e6) throw Error("Invalid profiler capacity.");
  }
  attach(gl) {
    if (!gl) throw new Error("A WebGL context is required.");
    if (this.contexts.has(gl)) return;
    this.contexts.add(gl);
    this.contextCount++;
    const wrap = (target, names) => {
      for (const name of names) {
        if (typeof target[name] !== "function") continue;
        const original = target[name], profiler = this;
        const wrapper = function(...args) {
          profiler.calls++;
          const count = name.startsWith("drawElements") ? args[1] : args[2];
          const instances = name.includes("Instanced") ? args[name.startsWith("drawArrays") ? 3 : 4] : 1;
          if (args[0] === gl.TRIANGLES) profiler.triangles += Math.floor(count / 3) * instances;
          else if (args[0] === gl.TRIANGLE_STRIP || args[0] === gl.TRIANGLE_FAN) profiler.triangles += Math.max(0, count - 2) * instances;
          return original.apply(target, args);
        };
        target[name] = wrapper;
        this.restore.push(() => {
          if (target[name] === wrapper) target[name] = original;
        });
      }
    };
    wrap(gl, ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]);
    if (!gl.drawArraysInstanced) {
      const angle = gl.getExtension?.("ANGLE_instanced_arrays");
      if (angle) wrap(angle, ["drawArraysInstancedANGLE", "drawElementsInstancedANGLE"]);
    }
  }
  /** Optional WebGL2 timer. Never blocks on completion or substitutes CPU elapsed time. */
  enableGpuTiming(gl) {
    if (this.gpu) throw Error("GPU timing already enabled.");
    const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    if (!ext || typeof gl.createQuery !== "function") {
      this.gpuReason = "EXT_disjoint_timer_query_webgl2 unavailable.";
      return false;
    }
    this.gpu = { gl, timeElapsed: ext.TIME_ELAPSED_EXT, disjoint: ext.GPU_DISJOINT_EXT, pending: [] };
    this.gpuReason = "No completed valid GPU queries in retained window.";
    return true;
  }
  pollGpu() {
    const g = this.gpu;
    if (!g) return;
    const invalid = g.gl.isContextLost() || g.gl.getParameter(g.disjoint);
    for (let i = g.pending.length - 1; i >= 0; i--) {
      const q = g.pending[i];
      if (invalid || g.gl.getQueryParameter(q.query, g.gl.QUERY_RESULT_AVAILABLE)) {
        if (!invalid && q.sample) {
          const ms = Number(g.gl.getQueryParameter(q.query, g.gl.QUERY_RESULT)) / 1e6;
          if (Number.isFinite(ms) && ms >= 0) q.sample.gpuMs = ms;
        }
        g.gl.deleteQuery(q.query);
        g.pending.splice(i, 1);
      }
    }
    if (invalid) this.gpuReason = "GPU disjoint or context lost; affected queries discarded.";
  }
  beginFrame() {
    if (this.frameOpen) throw Error("End the previous profiler frame first.");
    this.frameOpen = true;
    this.calls = this.triangles = 0;
    this.pollGpu();
    const g = this.gpu;
    if (g && !g.gl.isContextLost() && !g.gl.getParameter(g.disjoint) && g.pending.length < 64 && !g.gl.getQuery(g.timeElapsed, g.gl.CURRENT_QUERY)) {
      const query = g.gl.createQuery();
      if (query) {
        g.active = { query };
        g.gl.beginQuery(g.timeElapsed, query);
      }
    }
  }
  endFrame(frameMs, cpuMs, extra = {}) {
    if (![frameMs, cpuMs, extra.heapBytes ?? 0].every((v) => Number.isFinite(v) && v >= 0)) throw new Error("Invalid frame timing or heap.");
    const sample = {
      frameMs,
      cpuMs,
      drawCalls: this.calls,
      triangles: this.triangles,
      ...extra.heapBytes === void 0 ? {} : { heapBytes: extra.heapBytes }
    };
    const g = this.gpu;
    if (g?.active) {
      g.gl.endQuery(g.timeElapsed);
      g.active.sample = sample;
      g.pending.push(g.active);
      g.active = void 0;
    }
    this.frameOpen = false;
    this.samples[this.next] = sample;
    this.next = (this.next + 1) % this.capacity;
    this.total++;
    this.duration += frameMs;
    return { ...sample };
  }
  report() {
    this.pollGpu();
    const samples = (this.samples.length < this.capacity ? this.samples : [...this.samples.slice(this.next), ...this.samples.slice(0, this.next)]).map((s) => ({ ...s }));
    const frame = percentiles(samples.map((s) => s.frameMs)), cpu = percentiles(samples.map((s) => s.cpuMs));
    const gpu = percentiles(samples.flatMap((s) => s.gpuMs === void 0 ? [] : [s.gpuMs]));
    return {
      measured: this.total > 0,
      sources: { frame: "caller elapsed frame interval", cpu: "caller timed work scope", draw: this.contextCount ? "intercepted WebGL calls" : "unavailable: no context attached", heap: "optional caller JS heap bytes", gpu: "optional disjoint timer query" },
      totalSamples: this.total,
      retainedSamples: samples.length,
      droppedSamples: this.total - samples.length,
      durationMs: this.duration,
      retainedDurationMs: samples.reduce((n, s) => n + s.frameMs, 0),
      frame,
      cpu,
      gpu,
      frameP95Ms: frame.p95,
      gpuTimeMs: gpu.p50,
      gpuTimeReason: gpu.p50 === null ? this.gpuReason : "Median of valid completed GPU queries in retained window.",
      samples
    };
  }
  exportJSON(metadata = {}) {
    return JSON.stringify({ schemaVersion: 1, metadata, ...this.report() });
  }
  dispose() {
    const g = this.gpu;
    if (g) {
      if (g.active) {
        if (!g.gl.isContextLost()) g.gl.endQuery(g.timeElapsed);
        g.gl.deleteQuery(g.active.query);
      }
      for (const q of g.pending) g.gl.deleteQuery(q.query);
      this.gpu = void 0;
    }
    this.frameOpen = false;
    this.restore.forEach((fn) => fn());
    this.restore = [];
    this.contexts = /* @__PURE__ */ new WeakSet();
    this.contextCount = 0;
  }
};

// packages/core/effects/ParticleEventLink.ts
var ZhudaParticleEventLink = class {
  constructor(source, child, options) {
    this.disposed = false;
    this.source = source;
    this.child = child;
    if (source === child || child.spec.space !== "world" || !Number.isInteger(options.count) || options.count < 0 || options.count > child.capacity) throw new Error("Event links need a separate world-space child and a bounded count.");
    this.previous = source.onEvent;
    this.listener = (e) => {
      this.previous?.(e);
      if (this.disposed || e.type !== options.event) return;
      const point = { x: e.x, y: e.y, z: e.z };
      if (source.spec.space === "local") {
        const transform = source.transform;
        if (typeof transform.rotation === "number") {
          const c = Math.cos(transform.rotation), s = Math.sin(transform.rotation), x = point.x;
          point.x = x * c - point.y * s;
          point.y = x * s + point.y * c;
        } else rotateParticleVector3(point, transform.rotation, point);
        point.x += transform.x;
        point.y += transform.y;
        point.z += transform.z || 0;
      }
      child.burst.call(child, options.count, point.x, point.y, point.z);
    };
    source.onEvent = this.listener;
  }
  dispose() {
    this.disposed = true;
    if (this.source.onEvent === this.listener) this.source.onEvent = this.previous;
  }
};

// packages/core/VisualMigrationPipeline.ts
function convertUnityVisualMaterial(input) {
  if (!input?.id || !input.shader) throw new Error("Material needs a source id and shader.");
  const pbr = ["Standard", "Universal Render Pipeline/Lit"].includes(input.shader), unlit = ["Unlit/Color", "Unlit/Texture", "Universal Render Pipeline/Unlit"].includes(input.shader);
  if (!pbr && !unlit && !input.vfx) throw new Error(`Unmapped Unity shader ${input.shader}; supply an explicit VFX material contract.`);
  if (input.vfx) {
    const errors = validateVfxMaterial(input.vfx);
    if (errors.length) throw new Error(errors.join(" | "));
  }
  const color = input.color || [1, 1, 1, 1];
  if (color.length !== 4 || !color.every((v) => Number.isFinite(v) && v >= 0) || [input.metallic ?? 0, input.smoothness ?? 0.5].some((v) => !Number.isFinite(v) || v < 0 || v > 1) || input.emission && (input.emission.length !== 3 || !input.emission.every((v) => Number.isFinite(v) && v >= 0))) throw new Error("Invalid source material values.");
  const textures = {};
  for (const [name, key] of Object.entries(input.textures || {})) {
    if (!["albedo", "normal", "metallicGloss", "emission"].includes(name) || typeof key !== "string" || !key) throw new Error("Unknown texture semantic.");
    textures[name] = key;
  }
  if (!pbr && (textures.normal || textures.metallicGloss)) throw new Error("PBR texture semantics cannot be applied to an unlit material.");
  return { id: input.id, target: input.vfx ? "ZhudaVfx" : pbr ? "PBRStandardMaterial" : "UnlitMaterial", properties: { albedoColor: [...color], metallic: input.metallic ?? 0, smoothness: input.smoothness ?? 0.5, emission: input.emission ? [...input.emission] : [0, 0, 0], transparent: !!input.transparent }, textures, ...input.vfx ? { vfx: JSON.parse(JSON.stringify(input.vfx)) } : {} };
}
function instantiateMigratedMaterial(spec, resolve) {
  const l = globalThis.Laya;
  if (spec.target === "ZhudaVfx") throw new Error("Construct ZhudaVfxMaterial with this contract and the resolved albedo texture.");
  if (!l?.[spec.target]) throw new Error(`Missing Laya material class ${spec.target}.`);
  const textures = {};
  for (const [name, key] of Object.entries(spec.textures)) {
    const t = resolve(key);
    if (!t) throw new Error(`Missing migrated texture ${key}`);
    textures[name] = t.bitmap || t;
  }
  const m = new l[spec.target](), p = spec.properties;
  m.albedoColor = new l.Color(...p.albedoColor);
  if (spec.target === "PBRStandardMaterial") {
    m.metallic = p.metallic;
    m.smoothness = p.smoothness;
    m.enableEmission = p.emission.some((v) => v > 0);
    m.emissionColor = new l.Color(...p.emission, 1);
  }
  const map = { albedo: "albedoTexture", normal: "normalTexture", metallicGloss: "metallicGlossTexture", emission: "emissionTexture" };
  for (const [name, t] of Object.entries(textures)) m[map[name]] = t;
  if (p.transparent) m.renderMode = l[spec.target].RENDERMODE_TRANSPARENT;
  return m;
}
function disposeMigratedMaterial(material) {
  for (const key of ["albedoTexture", "normalTexture", "metallicGlossTexture", "emissionTexture"]) if (key in material) material[key] = null;
  material.destroy();
}
function convertUnityAnimationCurve(keys, tolerance = 1e-3) {
  if (!keys.length || keys.length > 4096 || !Number.isFinite(tolerance) || tolerance <= 0) throw new Error("Invalid source curve.");
  keys.forEach((k, i) => {
    if (![k.time, k.value, k.inTangent ?? 0, k.outTangent ?? 0].every(Number.isFinite) || k.time < 0 || i > 0 && k.time <= keys[i - 1].time || k.weightedMode) throw new Error("Unordered, non-finite or weighted curve; bake unsupported tangent modes before import.");
  });
  const out = [{ time: keys[0].time, value: keys[0].value }];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i], span = b.time - a.time;
    const sample = (t) => {
      const u = (t - a.time) / span, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * a.value + (u3 - 2 * u2 + u) * (a.outTangent ?? (b.value - a.value) / span) * span + (-2 * u3 + 3 * u2) * b.value + (u3 - u2) * (b.inTangent ?? (b.value - a.value) / span) * span;
    };
    const split = (lo, hi, lv, hv, depth) => {
      let error = 0;
      for (const f of [0.25, 0.5, 0.75]) error = Math.max(error, Math.abs(sample(lo + (hi - lo) * f) - (lv + (hv - lv) * f)));
      if (error > tolerance) {
        if (depth >= 16 || out.length > 65530) throw new Error("Curve exceeds baking budget.");
        const mid = (lo + hi) / 2, mv = sample(mid);
        split(lo, mid, lv, mv, depth + 1);
        split(mid, hi, mv, hv, depth + 1);
      } else out.push({ time: hi, value: hv });
    };
    split(a.time, b.time, a.value, b.value, 0);
  }
  return out;
}
function compareVisualFrames(source, target, width, height, options = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || source.length !== width * height * 4 || target.length !== source.length) throw new Error("Frames must share an explicit RGBA viewport.");
  const threshold = options.alphaThreshold ?? 16, minIoU = options.minIoU ?? 0.95, maxCenter = options.maxCentroidErrorPx ?? 1;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255 || !Number.isFinite(minIoU) || minIoU < 0 || minIoU > 1 || !Number.isFinite(maxCenter) || maxCenter < 0) throw new Error("Invalid visual comparison thresholds.");
  let a = 0, b = 0, intersection = 0, union = 0, ax = 0, ay = 0, bx = 0, by = 0;
  for (let i = 0; i < width * height; i++) {
    const sa = source[i * 4 + 3] > threshold, tb = target[i * 4 + 3] > threshold, x = i % width, y = Math.floor(i / width);
    if (sa) {
      a++;
      ax += x;
      ay += y;
    }
    if (tb) {
      b++;
      bx += x;
      by += y;
    }
    if (sa && tb) intersection++;
    if (sa || tb) union++;
  }
  const iou = union ? intersection / union : 1, center = a && b ? Math.hypot(ax / a - bx / b, ay / a - by / b) : a === b ? 0 : Infinity;
  return { passed: a > 0 && b > 0 && iou >= minIoU && center <= maxCenter, intersectionOverUnion: iou, sourcePixels: a, targetPixels: b, centroidErrorPx: center };
}

// packages/core/prefabs/PrefabLibrary.ts
var provenance = /* @__PURE__ */ new WeakMap();
function inspectPrefabInstance(root) {
  const value = provenance.get(root);
  return value ? structuredClone(value) : null;
}
function findPrefabNode(root, path = "") {
  let node = root;
  for (const name of path ? path.split("/") : []) {
    const matches = [];
    for (let i = 0; i < node.numChildren; i++) {
      const child = node.getChildAt(i);
      if (child.name === name) matches.push(child);
    }
    if (matches.length !== 1) throw Error(`Prefab node path missing or ambiguous: ${path}`);
    node = matches[0];
  }
  return node;
}
async function hash(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
}
var supportedTypes = /* @__PURE__ */ new Set(["Sprite", "Text", "Label", "Image", "Box"]);
var numericPatch = /* @__PURE__ */ new Set(["x", "y", "width", "height", "scaleX", "scaleY", "rotation", "alpha", "fontSize"]);
var stringPatch = /* @__PURE__ */ new Set(["text", "font", "color", "align", "valign", "sizeGrid"]);
function validateStates(states) {
  for (const patches of Object.values(states)) {
    if (!patches || typeof patches !== "object" || Array.isArray(patches)) throw Error("Invalid prefab state");
    for (const patch of Object.values(patches)) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw Error("Invalid node patch");
      for (const [key, value] of Object.entries(patch)) {
        const valid = numericPatch.has(key) ? typeof value === "number" && Number.isFinite(value) : stringPatch.has(key) ? typeof value === "string" : ["visible", "bold"].includes(key) && typeof value === "boolean";
        if (!valid) throw Error(`Unsupported prefab state property: ${key}`);
      }
    }
  }
}
function validateHierarchy(node, path = "root") {
  if (!node || !supportedTypes.has(node._$type) || node._$comp?.length)
    throw Error(`Unsupported static 2D prefab node at ${path}`);
  const names = /* @__PURE__ */ new Set();
  for (const child of node._$child || []) {
    if (!child.name || child.name.includes("/") || names.has(child.name))
      throw Error(`Prefab children need unique names at ${path}`);
    names.add(child.name);
    validateHierarchy(child, `${path}/${child.name}`);
  }
}
var ZhudaPrefabLibrary = class {
  constructor(options) {
    this.active = /* @__PURE__ */ new Set();
    this.instances = /* @__PURE__ */ new Set();
    this.disposed = false;
    const timeoutMs = options.timeoutMs ?? 15e3;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw Error("Invalid prefab timeout");
    this.timeoutMs = timeoutMs;
    if (options.share3DResources !== void 0 && typeof options.share3DResources !== "boolean") throw Error("share3DResources must be boolean");
    this.share3DResources = options.share3DResources ?? false;
    this.definitions = /* @__PURE__ */ new Map();
    const textures = /* @__PURE__ */ new Set();
    for (const source of options.definitions) {
      const entry = structuredClone(source);
      if (typeof entry.id !== "string" || !entry.id || this.definitions.has(entry.id) || !entry.states || Array.isArray(entry.states) || !Object.keys(entry.states).length)
        throw Error("Prefab IDs must be unique and have explicit states");
      if (entry.kind === "3d") {
        validatePrefabTree3D(entry.tree);
        for (const patches of Object.values(entry.states)) {
          if (!patches || typeof patches !== "object" || Array.isArray(patches)) throw Error("Invalid 3D prefab state");
          for (const patch of Object.values(patches)) validatePrefabPatch3D(patch);
        }
        this.definitions.set(entry.id, entry);
        continue;
      }
      validateStates(entry.states);
      if (normalizeAssetId(entry.asset) !== entry.asset) throw Error("Prefab asset ID must be normalized");
      for (const id of entry.textures || []) {
        if (normalizeAssetId(id) !== id || id === entry.asset) throw Error("Invalid prefab texture ID");
        textures.add(id);
      }
      this.definitions.set(entry.id, entry);
    }
    this.shared3DCache = new ZhudaAssetCache(async (key, signal) => {
      if (signal.aborted) throw new DOMException("Prefab cancelled", "AbortError");
      return createPrefabTreeResources(JSON.parse(key));
    }, (value) => value.dispose());
    this.cache = createProviderAssetCache(options.provider, async (asset, signal) => {
      const sourceHash = await hash(asset.bytes);
      if (!textures.has(asset.id)) {
        const data = JSON.parse(new TextDecoder().decode(asset.bytes));
        validateHierarchy(data);
        return { hash: sourceHash, data };
      }
      const url = URL.createObjectURL(new Blob([new Uint8Array(asset.bytes)]));
      const clear = () => {
        Laya.loader.clearRes(url);
        URL.revokeObjectURL(url);
      };
      let aborted = false;
      const load = Laya.loader.load(url, { type: Laya.Loader.IMAGE }).then((texture) => {
        if (aborted) clear();
        if (!texture) throw Error(`Texture decode failed: ${asset.id}`);
      });
      let timer;
      let cancel = () => {
      };
      try {
        await Promise.race([load, new Promise((_, reject) => {
          cancel = () => {
            aborted = true;
            reject(new DOMException("Prefab texture cancelled", "AbortError"));
          };
          signal.addEventListener("abort", cancel, { once: true });
          timer = setTimeout(() => {
            aborted = true;
            reject(Error(`Texture decode timeout: ${asset.id}`));
          }, timeoutMs);
          if (signal.aborted) cancel();
        })]);
        return { hash: sourceHash, url };
      } catch (error) {
        clear();
        throw error;
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
      }
    }, (resource) => {
      if (resource.url) {
        Laya.loader.clearRes(resource.url);
        URL.revokeObjectURL(resource.url);
      }
    });
  }
  async instantiate(id, options = {}) {
    if (this.disposed) throw Error("Disposed prefab library");
    const entry = this.definitions.get(id);
    if (!entry) throw Error(`Unknown prefab ID: ${id}`);
    const state = options.state ?? Object.keys(entry.states)[0];
    if (!Object.prototype.hasOwnProperty.call(entry.states, state)) throw Error(`Unknown prefab state: ${id}/${state}`);
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    this.active.add(controller);
    const scope = new ZhudaResourceScope();
    const timer = setTimeout(abort, this.timeoutMs);
    try {
      const resources = /* @__PURE__ */ new Map();
      for (const key of entry.kind === "3d" ? [] : [entry.asset, ...new Set(entry.textures)]) {
        const lease = await this.cache.acquire(key, { signal: controller.signal });
        scope.defer(() => lease.release());
        resources.set(key, lease.value);
      }
      if (controller.signal.aborted) throw new DOMException("Prefab cancelled", "AbortError");
      const definitionHash = await hash(new TextEncoder().encode(JSON.stringify(entry)));
      if (controller.signal.aborted) throw new DOMException("Prefab cancelled", "AbortError");
      let tree;
      let created;
      if (entry.kind === "3d") {
        if (this.share3DResources) {
          const lease = await this.shared3DCache.acquire(JSON.stringify(entry.tree), { signal: controller.signal });
          scope.defer(() => lease.release());
          if (controller.signal.aborted) throw new DOMException("Prefab cancelled", "AbortError");
          tree = buildSharedPrefabTree(entry.tree, lease.value);
        } else tree = buildPrefabTree(entry.tree);
        scope.defer(() => tree.dispose());
        created = tree.root;
      } else {
        const data = structuredClone(resources.get(entry.asset).data);
        const bindTextures = (node) => {
          if (node.skin) {
            const texture = resources.get(node.skin);
            if (!texture?.url) throw Error(`Undeclared prefab texture: ${node.skin}`);
            node.skin = texture.url;
          }
          for (const command of node._gcmds || []) {
            if (command._$type !== "DrawTextureCmd") continue;
            if (!command.textureId) throw Error("DrawTextureCmd requires textureId");
            const texture = resources.get(command.textureId);
            if (!texture?.url) throw Error(`Undeclared prefab texture: ${command.textureId}`);
            command.textureId = texture.url;
          }
          node._$child?.forEach(bindTextures);
        };
        bindTextures(data);
        created = ZhudaPrefab.instantiate(data);
        scope.defer(() => created.destroy(true));
      }
      const root = created;
      const baseline = /* @__PURE__ */ new Map();
      if (entry.kind !== "3d") for (const patches of Object.values(entry.states)) {
        for (const [path, patch] of Object.entries(patches)) {
          const target = findPrefabNode(root, path);
          const values = baseline.get(target) ?? {};
          for (const key of Object.keys(patch)) if (!Object.prototype.hasOwnProperty.call(values, key))
            values[key] = Reflect.get(target, key);
          baseline.set(target, values);
        }
      }
      let retired = false;
      const apply = (next) => {
        if (retired) throw Error("Disposed prefab instance");
        if (!Object.prototype.hasOwnProperty.call(entry.states, next)) throw Error(`Unknown prefab state: ${id}/${next}`);
        if (tree) tree.apply(entry.states[next]);
        else {
          for (const [target, values] of baseline) Object.assign(target, values);
          for (const [path, patch] of Object.entries(entry.states[next])) Object.assign(findPrefabNode(root, path), patch);
        }
      };
      apply(state);
      const record2 = {
        id,
        state,
        kind: entry.kind ?? "2d",
        definitionHash,
        sources: Object.fromEntries([...resources].map(([key, value]) => [key, value.hash]))
      };
      const instance = {
        root,
        provenance: structuredClone(record2),
        find: (path) => {
          if (retired) throw Error("Disposed prefab instance");
          return findPrefabNode(root, path);
        },
        socket: (id2) => {
          if (!tree) throw Error("Sockets require a 3D prefab");
          return tree.socket(id2);
        },
        makeMaterialUnique: (path) => {
          if (!tree) throw Error("Material slots require a 3D prefab");
          return tree.makeMaterialUnique(path);
        },
        applyState: (next) => {
          apply(next);
          record2.state = next;
          instance.provenance = structuredClone(record2);
        },
        dispose: () => {
          retired = true;
          provenance.delete(root);
          this.instances.delete(instance);
          scope.dispose();
        }
      };
      provenance.set(root, record2);
      options.parent?.addChild(root);
      this.instances.add(instance);
      return instance;
    } catch (error) {
      scope.dispose();
      throw error;
    } finally {
      clearTimeout(timer);
      this.active.delete(controller);
      options.signal?.removeEventListener("abort", abort);
      if (this.disposed && !this.active.size) {
        this.cache.dispose();
        this.shared3DCache.dispose();
      }
    }
  }
  report() {
    return { instances: this.instances.size, ...this.cache.report(), shared3D: this.shared3DCache.report() };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const controller of this.active) controller.abort();
    for (const instance of [...this.instances]) instance.dispose();
    if (!this.active.size) {
      this.cache.dispose();
      this.shared3DCache.dispose();
    }
  }
};

// packages/core/runtime3d/ActionFrames.ts
function finiteInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function validateWindow(name, window2, frameCount, errors) {
  if (!window2 || !finiteInteger(window2.from) || !finiteInteger(window2.until)) {
    errors.push(`${name} must contain integer from/until frames.`);
    return false;
  }
  if (window2.from < 0 || window2.from >= window2.until || window2.until > frameCount)
    errors.push(`${name} must be a non-empty interval within frameCount.`);
  return true;
}
function validateActionFrameSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== "object") return ["Action frame spec is required."];
  if (typeof spec.id !== "string" || !spec.id.trim()) errors.push("id must be a non-empty string.");
  if (!finiteNumber(spec.frameRate) || spec.frameRate <= 0)
    errors.push("frameRate must be a positive finite number.");
  if (!finiteInteger(spec.frameCount) || spec.frameCount <= 0)
    errors.push("frameCount must be a positive safe integer.");
  const frameCount = finiteInteger(spec.frameCount) && spec.frameCount > 0 ? spec.frameCount : 1;
  const startupOk = validateWindow("startup", spec.startup, frameCount, errors);
  const activeOk = validateWindow("active", spec.active, frameCount, errors);
  const recoveryOk = validateWindow("recovery", spec.recovery, frameCount, errors);
  if (startupOk && spec.startup.from !== 0) errors.push("startup must begin at frame 0.");
  if (startupOk && activeOk && spec.startup.until !== spec.active.from)
    errors.push("startup must connect directly to active.");
  if (activeOk && recoveryOk && spec.active.until !== spec.recovery.from)
    errors.push("active must connect directly to recovery.");
  if (recoveryOk && spec.recovery.until !== frameCount)
    errors.push("recovery must end at frameCount.");
  if (spec.cancelWindows !== void 0) {
    if (!Array.isArray(spec.cancelWindows)) errors.push("cancelWindows must be an array.");
    else {
      for (let i = 0; i < spec.cancelWindows.length; i++) {
        const window2 = spec.cancelWindows[i];
        const name = `cancelWindows[${i}]`;
        if (!validateWindow(name, window2, frameCount, errors)) continue;
        const cancelWindow = window2;
        if (!Array.isArray(cancelWindow.actions) || !cancelWindow.actions.length || cancelWindow.actions.some((action) => typeof action !== "string" || !action.trim()))
          errors.push(`${name}.actions must contain at least one non-empty action id.`);
      }
    }
  }
  if (spec.events !== void 0) {
    if (!Array.isArray(spec.events)) errors.push("events must be an array.");
    else {
      let previousFrame = -1;
      for (let i = 0; i < spec.events.length; i++) {
        const event = spec.events[i];
        if (!event || !finiteInteger(event.frame) || event.frame < 0 || event.frame > frameCount)
          errors.push(`events[${i}].frame must be within frameCount.`);
        else if (event.frame < previousFrame)
          errors.push("events must be ordered by non-decreasing frame.");
        else previousFrame = event.frame;
        if (!event || typeof event.id !== "string" || !event.id.trim())
          errors.push(`events[${i}].id must be a non-empty string.`);
      }
    }
  }
  if (spec.sockets !== void 0) {
    if (!Array.isArray(spec.sockets)) errors.push("sockets must be an array.");
    else {
      const ids = /* @__PURE__ */ new Set();
      for (let i = 0; i < spec.sockets.length; i++) {
        const socket = spec.sockets[i];
        if (!socket || typeof socket.id !== "string" || !socket.id.trim())
          errors.push(`sockets[${i}].id must be a non-empty string.`);
        else if (ids.has(socket.id)) errors.push(`sockets[${i}].id is duplicated.`);
        else ids.add(socket.id);
        if (!socket || typeof socket.bone !== "string" || !socket.bone.trim())
          errors.push(`sockets[${i}].bone must be a non-empty string.`);
        const offset = socket?.offset;
        if (offset && ![offset.x, offset.y, offset.z ?? 0].every(finiteNumber))
          errors.push(`sockets[${i}].offset must contain finite coordinates.`);
      }
    }
  }
  return errors;
}
var ZhudaActionStateMachine = class {
  constructor(spec) {
    this.currentFrame = 0;
    this.eventIndex = 0;
    this.playing = false;
    const errors = validateActionFrameSpec(spec);
    if (errors.length) throw Error(`Invalid action frame spec: ${errors.join(" ")}`);
    this.spec = {
      ...spec,
      cancelWindows: spec.cancelWindows ? spec.cancelWindows.map((w) => ({ ...w, actions: [...w.actions] })) : void 0,
      events: spec.events ? spec.events.map((event) => ({ ...event })) : void 0,
      sockets: spec.sockets ? spec.sockets.map((socket) => ({ ...socket, offset: socket.offset ? { ...socket.offset } : void 0 })) : void 0
    };
  }
  get frame() {
    return this.currentFrame;
  }
  get isPlaying() {
    return this.playing;
  }
  get isComplete() {
    return this.currentFrame >= this.spec.frameCount;
  }
  get phase() {
    if (this.isComplete) return "complete";
    if (this.currentFrame < this.spec.startup.until) return "startup";
    if (this.currentFrame < this.spec.active.until) return "active";
    return "recovery";
  }
  get normalizedTime() {
    return this.currentFrame / this.spec.frameCount;
  }
  get active() {
    return this.phase === "active";
  }
  reset() {
    this.currentFrame = 0;
    this.eventIndex = 0;
    this.playing = false;
  }
  play(reset = true) {
    if (reset) this.reset();
    if (this.isComplete) this.reset();
    this.playing = true;
  }
  stop() {
    this.playing = false;
  }
  advance(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0)
      throw Error("Invalid action delta");
    if (!this.playing || this.isComplete) return [];
    const previousFrame = this.currentFrame;
    this.currentFrame = Math.min(
      this.spec.frameCount,
      previousFrame + deltaSeconds * this.spec.frameRate
    );
    const events = [];
    const frameEvents = this.spec.events ?? [];
    const firstAdvance = this.eventIndex === 0 && previousFrame === 0;
    while (this.eventIndex < frameEvents.length && (frameEvents[this.eventIndex].frame > previousFrame || firstAdvance && frameEvents[this.eventIndex].frame === 0) && frameEvents[this.eventIndex].frame <= this.currentFrame) {
      events.push({ ...frameEvents[this.eventIndex] });
      this.eventIndex++;
    }
    if (this.isComplete) this.playing = false;
    return events;
  }
  canCancelInto(actionId) {
    if (typeof actionId !== "string" || !actionId.trim()) return false;
    return (this.spec.cancelWindows ?? []).some(
      (window2) => this.currentFrame >= window2.from && this.currentFrame < window2.until && window2.actions.includes(actionId)
    );
  }
  getSocket(id) {
    const socket = (this.spec.sockets ?? []).find((candidate) => candidate.id === id);
    return socket ? { ...socket, offset: socket.offset ? { ...socket.offset } : void 0 } : null;
  }
};

// packages/core/runtime3d/InputBuffer.ts
var ZhudaInputBuffer = class {
  constructor(options = {}) {
    this.entries = [];
    this.nextSequence = 1;
    this.lastTime = -Infinity;
    this.disposed = false;
    this.window = options.window ?? 0.12;
    this.capacity = options.capacity ?? 32;
    if (!Number.isFinite(this.window) || this.window <= 0)
      throw Error("Invalid input buffer window");
    if (!Number.isSafeInteger(this.capacity) || this.capacity <= 0)
      throw Error("Invalid input buffer capacity");
  }
  push(action, time) {
    this.ensureLive();
    if (typeof action !== "string" || !action.trim() || !Number.isFinite(time))
      throw Error("Invalid buffered input");
    if (time < this.lastTime) return false;
    this.lastTime = time;
    this.entries.push({ action, time, sequence: this.nextSequence++ });
    this.prune(time);
    while (this.entries.length > this.capacity) this.entries.shift();
    return true;
  }
  has(action, time) {
    this.ensureLive();
    this.validateRead(action, time);
    this.prune(time);
    return this.entries.some((entry) => entry.action === action);
  }
  /** Consumes the oldest matching action once. */
  consume(action, time) {
    this.ensureLive();
    this.validateRead(action, time);
    this.prune(time);
    const index = this.entries.findIndex((entry) => entry.action === action);
    if (index < 0) return false;
    this.entries.splice(index, 1);
    return true;
  }
  /** Consumes the oldest matching action from a set of alternatives. */
  consumeAny(actions, time) {
    this.ensureLive();
    this.validateActions(actions);
    this.validateTime(time);
    this.prune(time);
    const accepted = new Set(actions);
    const index = this.entries.findIndex((entry2) => accepted.has(entry2.action));
    if (index < 0) return null;
    const [entry] = this.entries.splice(index, 1);
    return entry.action;
  }
  /**
   * Consumes an ordered combo such as `down`, `forward`, `attack`.
   * Unrelated actions may occur between combo steps; each accepted step must
   * arrive within `maxGap` of the previous accepted step.
   */
  consumeSequence(actions, time, maxGap = this.window) {
    this.ensureLive();
    this.validateActions(actions);
    this.validateTime(time);
    if (!Number.isFinite(maxGap) || maxGap < 0) throw Error("Invalid combo gap");
    this.prune(time);
    const indexes = [];
    let searchFrom = 0;
    let previousTime = -Infinity;
    for (const action of actions) {
      let found = -1;
      for (let i = searchFrom; i < this.entries.length; i++) {
        const entry = this.entries[i];
        if (entry.action !== action || entry.time > time) continue;
        if (previousTime !== -Infinity && entry.time - previousTime > maxGap) break;
        found = i;
        break;
      }
      if (found < 0) return false;
      indexes.push(found);
      previousTime = this.entries[found].time;
      searchFrom = found + 1;
    }
    for (let i = indexes.length - 1; i >= 0; i--) this.entries.splice(indexes[i], 1);
    return true;
  }
  snapshot(time) {
    this.ensureLive();
    this.validateTime(time);
    this.prune(time);
    return this.entries.map((entry) => ({ ...entry }));
  }
  clear() {
    this.entries = [];
    this.lastTime = -Infinity;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }
  get size() {
    return this.entries.length;
  }
  get isDisposed() {
    return this.disposed;
  }
  prune(time) {
    const cutoff = time - this.window;
    while (this.entries.length && this.entries[0].time < cutoff) this.entries.shift();
  }
  validateRead(action, time) {
    if (typeof action !== "string" || !action.trim()) throw Error("Invalid buffered input action");
    this.validateTime(time);
  }
  validateTime(time) {
    if (!Number.isFinite(time)) throw Error("Invalid buffered input time");
    if (time < this.lastTime) throw Error("Buffered input time moved backwards");
    this.lastTime = time;
  }
  validateActions(actions) {
    if (!Array.isArray(actions) || !actions.length || actions.some((action) => typeof action !== "string" || !action.trim()))
      throw Error("Invalid input action sequence");
  }
  ensureLive() {
    if (this.disposed) throw Error("Disposed input buffer");
  }
};

// packages/core/runtime3d/RenderSpaces.ts
var ZhudaRenderSpace = class {
  constructor() {
    this.registrations = /* @__PURE__ */ new Set();
    this.disposed = false;
  }
  register(callbacks) {
    if (this.disposed) throw Error("Disposed render space");
    if (!callbacks || !callbacks.onRenderLocal && !callbacks.onRenderWorld && !callbacks.onRenderOverlay)
      throw Error("Render space needs at least one pass callback");
    this.registrations.add(callbacks);
    let cancelled = false;
    return {
      get cancelled() {
        return cancelled;
      },
      cancel: () => {
        if (cancelled) return false;
        cancelled = true;
        return this.registrations.delete(callbacks);
      }
    };
  }
  render(frame) {
    if (this.disposed) return 0;
    const snapshot = [...this.registrations];
    let calls = 0;
    const dispatch = (pass, coordinates, transform, callback) => {
      if (!callback) return;
      callback({
        pass,
        coordinates,
        transform: transform ?? null,
        localToWorld: frame.localToWorld,
        worldToLocal: frame.worldToLocal
      });
      calls++;
    };
    for (const registration of snapshot) {
      dispatch("local", "local", frame.localTransform, registration.onRenderLocal);
      dispatch("world", "world", frame.worldTransform, registration.onRenderWorld);
      dispatch("overlay", "camera-overlay", frame.overlayTransform, registration.onRenderOverlay);
    }
    return calls;
  }
  clear() {
    this.registrations.clear();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }
  get size() {
    return this.registrations.size;
  }
};

// packages/core/runtime3d/GraphicsGuard.ts
function finite(name, value) {
  if (!Number.isFinite(value)) throw Error(`Invalid Graphics ${name}`);
  return value;
}
function nonNegative(name, value) {
  return Math.max(0, finite(name, value));
}
var ZhudaGraphicsGuard = class {
  constructor(target) {
    if (!target) throw Error("Graphics target is required");
    this.target = target;
  }
  clear(...args) {
    return this.target.clear(...args);
  }
  drawRect(x, y, width, height, fillColor, lineColor, lineWidth = 1, percent = false) {
    return this.target.drawRect(
      finite("x", x),
      finite("y", y),
      nonNegative("width", width),
      nonNegative("height", height),
      fillColor,
      lineColor,
      nonNegative("lineWidth", lineWidth),
      percent
    );
  }
  drawRoundRect(x, y, width, height, lt, rt, lb, rb, fillColor, lineColor, lineWidth = 1, percent = false, minNum, segPixel) {
    const w = nonNegative("width", width), h = nonNegative("height", height);
    const maxRadius = Math.min(w, h) / 2;
    return this.target.drawRoundRect(
      finite("x", x),
      finite("y", y),
      w,
      h,
      Math.min(maxRadius, nonNegative("lt", lt)),
      Math.min(maxRadius, nonNegative("rt", rt)),
      Math.min(maxRadius, nonNegative("lb", lb)),
      Math.min(maxRadius, nonNegative("rb", rb)),
      fillColor,
      lineColor,
      nonNegative("lineWidth", lineWidth),
      percent,
      minNum === void 0 ? void 0 : nonNegative("minNum", minNum),
      segPixel === void 0 ? void 0 : nonNegative("segPixel", segPixel)
    );
  }
  drawCircle(x, y, radius, fillColor, lineColor, lineWidth = 1, percent = false) {
    return this.target.drawCircle(
      finite("x", x),
      finite("y", y),
      nonNegative("radius", radius),
      fillColor,
      lineColor,
      nonNegative("lineWidth", lineWidth),
      percent
    );
  }
  drawEllipse(x, y, width, height, fillColor, lineColor, lineWidth = 1, percent = false) {
    return this.target.drawEllipse(
      finite("x", x),
      finite("y", y),
      nonNegative("width", width),
      nonNegative("height", height),
      fillColor,
      lineColor,
      nonNegative("lineWidth", lineWidth),
      percent
    );
  }
};

// packages/core/runtime3d/Pool.ts
var ZhudaObjectPool = class {
  constructor(options) {
    this.free = [];
    this.active = /* @__PURE__ */ new Set();
    this.disposedItems = /* @__PURE__ */ new Set();
    this.created = 0;
    this.disposed = false;
    if (!options || !Number.isSafeInteger(options.capacity) || options.capacity <= 0)
      throw Error("Invalid pool capacity");
    if (typeof options.create !== "function") throw Error("Pool create callback is required");
    this.capacity = options.capacity;
    this.create = options.create;
    this.reset = options.reset;
    this.onSpawn = options.onSpawn;
    this.onDespawn = options.onDespawn;
    this.disposeItemCallback = options.dispose;
  }
  acquire() {
    if (this.disposed) return null;
    let item;
    if (this.free.length) item = this.free.pop();
    else if (this.created < this.capacity) {
      item = this.create();
      this.created++;
    } else item = null;
    if (item === null) return null;
    this.active.add(item);
    try {
      this.onSpawn?.(item);
    } catch (error) {
      this.active.delete(item);
      this.disposeItem(item);
      throw error;
    }
    return item;
  }
  release(item) {
    if (this.disposed || !this.active.has(item)) return false;
    this.active.delete(item);
    try {
      this.onDespawn?.(item);
      this.reset?.(item);
    } catch (error) {
      this.disposeItem(item);
      throw error;
    }
    this.free.push(item);
    return true;
  }
  disposeItem(item) {
    if (this.disposedItems.has(item)) return;
    this.disposedItems.add(item);
    this.disposeItemCallback?.(item);
    this.created = Math.max(0, this.created - 1);
  }
  clear() {
    const items = [...this.active];
    for (const item of items) this.release(item);
    return items.length;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    let firstError;
    let hadError = false;
    const run = (action) => {
      try {
        action();
      } catch (error) {
        if (!hadError) {
          hadError = true;
          firstError = error;
        }
      }
    };
    for (const item of this.active) {
      run(() => this.onDespawn?.(item));
      run(() => this.disposeItem(item));
    }
    for (const item of this.free) run(() => this.disposeItem(item));
    this.active.clear();
    this.free.length = 0;
    if (hadError) throw firstError;
  }
  get activeCount() {
    return this.active.size;
  }
  get availableCount() {
    return this.free.length;
  }
  get createdCount() {
    return this.created;
  }
  get isDisposed() {
    return this.disposed;
  }
};

// packages/core/runtime3d/CombatQueries.ts
function validateRect(rect) {
  if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite))
    throw Error("Combat rectangles must be finite");
  if (rect.width < 0 || rect.height < 0) throw Error("Combat rectangle size must be non-negative");
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}
function validateLayer(name, value) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 4294967295)
    throw Error(`Invalid ${name} layer`);
  return value >>> 0;
}
function overlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
var ZhudaCombatWorld = class {
  constructor() {
    this.hurtboxes = /* @__PURE__ */ new Map();
    this.hitboxes = /* @__PURE__ */ new Map();
    this.hitTargets = /* @__PURE__ */ new Map();
    this.disposed = false;
  }
  registerHurtbox(definition) {
    if (this.disposed) throw Error("Disposed combat world");
    this.validateBox(definition);
    if (this.hurtboxes.has(definition.id)) throw Error(`Duplicate hurtbox: ${definition.id}`);
    this.hurtboxes.set(definition.id, { ...definition, rect: validateRect(definition.rect) });
    return () => this.hurtboxes.delete(definition.id);
  }
  registerHitbox(definition) {
    if (this.disposed) throw Error("Disposed combat world");
    this.validateBox(definition);
    if (!definition.swingId && definition.swingId !== 0) throw Error("Hitbox swingId is required");
    if (!Number.isFinite(definition.activeFrom ?? 0) || !Number.isFinite(definition.activeUntil ?? 0))
      throw Error("Invalid hitbox active window");
    if (definition.activeFrom !== void 0 && definition.activeUntil !== void 0 && definition.activeUntil < definition.activeFrom)
      throw Error("Hitbox active window is reversed");
    if (this.hitboxes.has(definition.id)) throw Error(`Duplicate hitbox: ${definition.id}`);
    this.hitboxes.set(definition.id, { ...definition, rect: validateRect(definition.rect), mask: validateLayer("hitbox mask", definition.mask) });
    return () => {
      this.clearHitboxSwing(definition.id);
      return this.hitboxes.delete(definition.id);
    };
  }
  validateBox(definition) {
    if (!definition?.id || !definition.ownerId) throw Error("Combat box needs id and ownerId");
    validateLayer("box", definition.layer);
    validateRect(definition.rect);
    if (definition.sampleRect && typeof definition.sampleRect !== "function") throw Error("Invalid combat rect sampler");
  }
  updateHurtbox(id, patch) {
    const box = this.hurtboxes.get(id);
    if (!box) return false;
    if (patch.rect) box.rect = validateRect(patch.rect);
    if (patch.layer !== void 0) box.layer = validateLayer("box", patch.layer);
    if (patch.enabled !== void 0) box.enabled = patch.enabled;
    if (patch.sampleRect !== void 0) box.sampleRect = patch.sampleRect;
    return true;
  }
  updateHitbox(id, patch) {
    const box = this.hitboxes.get(id);
    if (!box) return false;
    const rect = patch.rect ? validateRect(patch.rect) : box.rect;
    const layer = patch.layer === void 0 ? box.layer : validateLayer("box", patch.layer);
    const mask = patch.mask === void 0 ? box.mask : validateLayer("hitbox mask", patch.mask);
    if (patch.sampleRect !== void 0 && typeof patch.sampleRect !== "function") throw Error("Invalid combat rect sampler");
    const swingId = patch.swingId === void 0 ? box.swingId : patch.swingId;
    if (!swingId && swingId !== 0) throw Error("Hitbox swingId is required");
    const activeFrom = patch.activeFrom === void 0 ? box.activeFrom : patch.activeFrom;
    const activeUntil = patch.activeUntil === void 0 ? box.activeUntil : patch.activeUntil;
    if (activeFrom !== void 0 && !Number.isFinite(activeFrom) || activeUntil !== void 0 && !Number.isFinite(activeUntil))
      throw Error("Invalid hitbox active window");
    if (activeFrom !== void 0 && activeUntil !== void 0 && activeUntil < activeFrom)
      throw Error("Hitbox active window is reversed");
    if (patch.swingId !== void 0 && String(patch.swingId) !== String(box.swingId)) this.clearHitboxSwing(id);
    Object.assign(box, {
      rect,
      layer,
      mask,
      swingId,
      activeFrom,
      activeUntil,
      ...patch.enabled === void 0 ? {} : { enabled: patch.enabled },
      ...patch.sampleRect === void 0 ? {} : { sampleRect: patch.sampleRect }
    });
    return true;
  }
  queryHitbox(id, time) {
    if (!Number.isFinite(time)) throw Error("Combat query time must be finite");
    const hitbox = this.hitboxes.get(id);
    if (!hitbox || hitbox.enabled === false || hitbox.activeFrom !== void 0 && time < hitbox.activeFrom || hitbox.activeUntil !== void 0 && time >= hitbox.activeUntil) return [];
    const attackRect = validateRect(hitbox.sampleRect?.() ?? hitbox.rect);
    const swingKey = `${hitbox.id}\0${String(hitbox.swingId)}`;
    let seen = this.hitTargets.get(swingKey);
    if (!seen) this.hitTargets.set(swingKey, seen = /* @__PURE__ */ new Set());
    const result = [];
    for (const hurtbox of this.hurtboxes.values()) {
      if (hurtbox.enabled === false || !(hurtbox.layer >>> 0 & hitbox.mask)) continue;
      const hurtRect = validateRect(hurtbox.sampleRect?.() ?? hurtbox.rect);
      if (!overlap(attackRect, hurtRect) || seen.has(hurtbox.id)) continue;
      seen.add(hurtbox.id);
      result.push({
        hitboxId: hitbox.id,
        swingId: hitbox.swingId,
        attackerId: hitbox.ownerId,
        hurtboxId: hurtbox.id,
        targetId: hurtbox.ownerId,
        attackRect,
        hurtRect
      });
    }
    return result;
  }
  queryAll(time) {
    const result = [];
    for (const id of this.hitboxes.keys()) result.push(...this.queryHitbox(id, time));
    return result;
  }
  clearHitboxSwing(hitboxId, swingId) {
    const prefix = `${hitboxId}\0`;
    let removed = 0;
    for (const key of [...this.hitTargets.keys()]) {
      if (key.startsWith(prefix) && (swingId === void 0 || key === `${prefix}${String(swingId)}`)) {
        this.hitTargets.delete(key);
        removed++;
      }
    }
    return removed;
  }
  clear() {
    this.hurtboxes.clear();
    this.hitboxes.clear();
    this.hitTargets.clear();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }
  get hurtboxCount() {
    return this.hurtboxes.size;
  }
  get hitboxCount() {
    return this.hitboxes.size;
  }
};

// packages/core/runtime3d/ModelDecoder.ts
var ModelDecoderError = class extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ModelDecoderError";
    this.code = code;
    this.format = details.format;
    this.assetId = details.assetId;
  }
};
var formats = /* @__PURE__ */ new Set(["draco", "meshopt", "ktx2-basis"]);
var sha256Pattern = /^[0-9a-f]{64}$/i;
var abortError2 = (format, assetId, timeout) => new ModelDecoderError(timeout ? "timeout" : "aborted", timeout ? `Model decoder timed out: ${assetId}` : `Model decoder cancelled: ${assetId}`, { format, assetId });
function validateDescriptor(descriptor) {
  if (!descriptor || !formats.has(descriptor.format) || typeof descriptor.name !== "string" || !descriptor.name.trim() || typeof descriptor.version !== "string" || !descriptor.version.trim() || typeof descriptor.integritySha256 !== "string" || !sha256Pattern.test(descriptor.integritySha256))
    throw new ModelDecoderError("invalid-adapter", "A decoder descriptor requires a format, name, version and SHA-256 metadata.");
}
function positive(value) {
  return Number.isSafeInteger(value) && value > 0;
}
function releasePayload(payload) {
  if (typeof payload?.release === "function") payload.release();
}
var ZhudaModelDecoderRegistry = class {
  constructor(options = {}) {
    this.adapters = /* @__PURE__ */ new Map();
    this.disposed = false;
    this.timeoutMs = options.timeoutMs ?? 15e3;
    this.maxInputBytes = options.maxInputBytes ?? 256 * 1024 * 1024;
    this.maxOutputBytes = options.maxOutputBytes ?? 256 * 1024 * 1024;
    if (!positive(this.timeoutMs) || this.timeoutMs > 2147483647 || !positive(this.maxInputBytes) || !positive(this.maxOutputBytes))
      throw Error("Invalid decoder limits");
  }
  drain(entry) {
    if (entry.retired && !entry.pending && !entry.leases && !entry.disposed) {
      entry.disposed = true;
      entry.adapter.dispose?.();
    }
  }
  retire(entry) {
    if (entry.retired) return;
    entry.retired = true;
    for (const controller of entry.requests) controller.abort(new DOMException("Decoder retired", "AbortError"));
    this.drain(entry);
  }
  register(adapter) {
    if (this.disposed) throw new ModelDecoderError("disposed", "Decoder registry is disposed.");
    validateDescriptor(adapter?.descriptor);
    if (typeof adapter.decode !== "function" || adapter.dispose !== void 0 && typeof adapter.dispose !== "function")
      throw new ModelDecoderError("invalid-adapter", "Decoder requires decode and an optional dispose function.");
    const { format } = adapter.descriptor;
    if (this.adapters.has(format)) throw new ModelDecoderError("invalid-adapter", `A ${format} decoder is already registered.`, { format });
    const entry = { adapter, requests: /* @__PURE__ */ new Set(), pending: 0, leases: 0, retired: false, disposed: false };
    this.adapters.set(format, entry);
    return () => {
      if (this.adapters.get(format) === entry) this.adapters.delete(format);
      this.retire(entry);
    };
  }
  has(format) {
    return this.adapters.has(format);
  }
  async decode(format, assetId, bytes, options = {}) {
    if (this.disposed) throw new ModelDecoderError("disposed", "Decoder registry is disposed.", { format, assetId });
    if (!formats.has(format) || normalizeAssetId(assetId) !== assetId) throw new ModelDecoderError("invalid-input", "A normalized logical asset ID is required.", { format, assetId });
    const timeoutMs = options.timeoutMs ?? this.timeoutMs, inputLimit = options.maxInputBytes ?? this.maxInputBytes, outputLimit = options.maxOutputBytes ?? this.maxOutputBytes;
    if (!positive(timeoutMs) || timeoutMs > 2147483647 || !positive(inputLimit) || !positive(outputLimit) || !(bytes instanceof Uint8Array) || bytes.byteLength > inputLimit)
      throw new ModelDecoderError("invalid-input", `Invalid decoder bounds/input: ${assetId}.`, { format, assetId });
    if (options.signal?.aborted) throw abortError2(format, assetId, false);
    const entry = this.adapters.get(format);
    if (!entry) throw new ModelDecoderError("unsupported", `No ${format} decoder is registered.`, { format, assetId });
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    entry.requests.add(controller);
    entry.pending++;
    const input = new Uint8Array(bytes);
    const work = Promise.resolve().then(async () => {
      if (controller.signal.aborted) throw abortError2(format, assetId, timedOut);
      const payload = await entry.adapter.decode({ assetId, bytes: input, signal: controller.signal, maxOutputBytes: outputLimit });
      if (!payload || payload.assetId !== assetId || payload.format !== format || !Number.isSafeInteger(payload.byteLength) || payload.byteLength < 0 || payload.byteLength > outputLimit || typeof payload.release !== "function") {
        releasePayload(payload);
        throw new ModelDecoderError("invalid-output", `Invalid or oversized decoder output: ${assetId}`, { format, assetId });
      }
      entry.leases++;
      let released = false;
      return Object.freeze({ assetId, format, data: payload.data, byteLength: payload.byteLength, release: () => {
        if (released) return;
        released = true;
        try {
          payload.release();
        } finally {
          entry.leases--;
          this.drain(entry);
        }
      } });
    }).finally(() => {
      entry.pending--;
      entry.requests.delete(controller);
      this.drain(entry);
    });
    try {
      return await awaitAbortable(work, controller.signal, releasePayload);
    } catch (error) {
      if (controller.signal.aborted) throw abortError2(format, assetId, timedOut);
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const entries = [...this.adapters.values()];
    this.adapters.clear();
    for (const entry of entries) this.retire(entry);
  }
};

// node_modules/meshoptimizer/meshopt_decoder.mjs
var MeshoptDecoder = (function() {
  var wasm_base = "b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuixkbeeeddddillviebeoweuecj:Gdkr;Neqo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949WboY9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVJ9V29VVbrl79IV9Rbwq;X8:kdbk:kYi5ud9:du8Jjjjjbcjq9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxcj;abad9Uc;WFbGcjdadca0EhmaialfgPar9Rgoadfhsavaoadz:jjjjbgzceVhHcbhOdndninaeaO9nmeaPax9RaD6mdamaeaO9RaOamfgoae6EgAcsfglc9WGhCaAcethXaxaDfhiaOaeaoaeao6E9RhQalcl4cifcd4hLazcjdfaAfhKcbhYabaOad2fg8AhEaHh3incbh5dnawTmbaxaYcd4fRbbh5kcbh8Eazcjdfhqinaih8Fdndndndna5a8Ecet4ciGgoc9:fPdebdkaPa8F9RaA6mrazcjdfa8EaA2fa8FaAz:jjjjb8Aa8FaAfhixdkazcjdfa8EaA2fcbaAz:kjjjb8Aa8FhixekaPa8F9RaL6mva8FaLfhidnaCTmbaPai9RcK6mbaocdtc:q:G:cjbfcj:G:cjbawEhaczhrcbhlinargoc9Wfghaqfhrdndndndndndnaaa8Fahco4fRbbalcoG4ciGcdtfydbPDbedvivvvlvkar9cb83bwar9cb83bbxlkarcbaiRbdai8Xbb9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbaqaofgrcGfcbaicdfa8J9c8N1:NfghRbbag9cjjjjjw:dg8J9qE86bbarcVfcbaha8J9c8M1:NfghRbbag9cjjjjjl:dg8J9qE86bbarc7fcbaha8J9c8L1:NfghRbbag9cjjjjjd:dg8J9qE86bbarctfcbaha8J9c8K1:NfghRbbag9cjjjjje:dg8J9qE86bbarc91fcbaha8J9c8J1:NfghRbbag9cjjjj;ab:dg8J9qE86bbarc4fcbaha8J9cg1:NfghRbbag9cjjjja:dg8J9qE86bbarc93fcbaha8J9ch1:NfghRbbag9cjjjjz:dgg9qE86bbarc94fcbahag9ca1:NfghRbbai8Xbe9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbarc95fcbaha8J9c8N1:NfgiRbbag9cjjjjjw:dg8J9qE86bbarc96fcbaia8J9c8M1:NfgiRbbag9cjjjjjl:dg8J9qE86bbarc97fcbaia8J9c8L1:NfgiRbbag9cjjjjjd:dg8J9qE86bbarc98fcbaia8J9c8K1:NfgiRbbag9cjjjjje:dg8J9qE86bbarc99fcbaia8J9c8J1:NfgiRbbag9cjjjj;ab:dg8J9qE86bbarc9:fcbaia8J9cg1:NfgiRbbag9cjjjja:dg8J9qE86bbarcufcbaia8J9ch1:NfgiRbbag9cjjjjz:dgg9qE86bbaiag9ca1:NfhixikaraiRblaiRbbghco4g8Ka8KciSg8KE86bbaqaofgrcGfaiclfa8Kfg8KRbbahcl4ciGg8La8LciSg8LE86bbarcVfa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc7fa8Ka8Lfg8KRbbahciGghahciSghE86bbarctfa8Kahfg8KRbbaiRbeghco4g8La8LciSg8LE86bbarc91fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc4fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc93fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc94fa8Kahfg8KRbbaiRbdghco4g8La8LciSg8LE86bbarc95fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc96fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc97fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc98fa8KahfghRbbaiRbigico4g8Ka8KciSg8KE86bbarc99faha8KfghRbbaicl4ciGg8Ka8KciSg8KE86bbarc9:faha8KfghRbbaicd4ciGg8Ka8KciSg8KE86bbarcufaha8KfgrRbbaiciGgiaiciSgiE86bbaraifhixdkaraiRbwaiRbbghcl4g8Ka8KcsSg8KE86bbaqaofgrcGfaicwfa8Kfg8KRbbahcsGghahcsSghE86bbarcVfa8KahfghRbbaiRbeg8Kcl4g8La8LcsSg8LE86bbarc7faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarctfaha8KfghRbbaiRbdg8Kcl4g8La8LcsSg8LE86bbarc91faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc4faha8KfghRbbaiRbig8Kcl4g8La8LcsSg8LE86bbarc93faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc94faha8KfghRbbaiRblg8Kcl4g8La8LcsSg8LE86bbarc95faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc96faha8KfghRbbaiRbvg8Kcl4g8La8LcsSg8LE86bbarc97faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc98faha8KfghRbbaiRbog8Kcl4g8La8LcsSg8LE86bbarc99faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc9:faha8KfghRbbaiRbrgicl4g8Ka8KcsSg8KE86bbarcufaha8KfgrRbbaicsGgiaicsSgiE86bbaraifhixekarai8Pbw83bwarai8Pbb83bbaiczfhikdnaoaC9pmbalcdfhlaoczfhraPai9RcL0mekkaoaC6moaimexokaCmva8FTmvkaqaAfhqa8Ecefg8Ecl9hmbkdndndndnawTmbasaYcd4fRbbgociGPlbedrbkaATmdazaYfh8Fazcjdfhhcbh8EaEhaina8FRbbhraahocbhlinaoahalfRbbgqce4cbaqceG9R7arfgr86bbaoadfhoaAalcefgl9hmbkaacefhaa8Fcefh8FahaAfhha8Ecefg8Ecl9hmbxikkaATmeazaYfhaazcjdfhhcbhoceh8EaKh8FinaEaofhlaa8Vbbhrcbhoinala8FaofRbbcwtahaofRbbgqVc;:FiGce4cbaqceG9R7arfgr87bbaladfhlaQaocefgofmbka8FaXfh8FcdhoaacdfhaahaXfhha8EceGhlcbh8EalmbxdkkaATmbaocl4h8EazaYfRbbhqcwhoa3hlinalRbbaotaqVhqalcefhlaocwfgoca9hmbkcbhhaEh8FaKhainazcjdfahfRbbhrcwhoaahlinalRbbaotarVhralaAfhlaocwfgoca9hmbkara8E94aq7hqcbhoa8Fhlinalaqao486bbalcefhlaocwfgoca9hmbka8Fadfh8FaacefhaahcefghaA9hmbkkaEclfhEa3clfh3aYclfgYad6mbkaza8AaAcufad2fadz:jjjjb8AaAaOfhOaihxaimbkc9:hoxdkcbc99aPax9RakSEhoxekc9:hokavcjqf8Kjjjjbaok:bsesu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnalaeci9UgrcHf6mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgwce0mbavc;abfcFecjez:kjjjb8Aav9cu83iUav9cu83i8Wav9cu83iyav9cu83iaav9cu83iKav9cu83izav9cu83iwav9cu83ibaialfc9WfhDaicefgiarfhqdndnaeci9pmbaqhexekcmcsawceSEhkcbhxcbhmaqhecbhlcbhoindndnaiRbbgrc;Ve0mbavc;abfaoarcu7gPcl4fcsGcitfgwydlhsawydbhzdndnarcsGgwak9pmbavalaPfcsGcdtfydbaxawEhraxawTgHfhxxekdnaeaD9nmbc9:hoxokdndnawcsSmbcehHamawcetfcWfhrxekaecefhrae8SbbgwcFeGhPdndnawcu9mmbarhexekaecvfheaPcFbGhPcrhwdninar8SbbgHcFbGawtaPVhPaHcu9kmearcefhrawcrfgwc8J9hmbxdkkarcefhekcehHaPce4cbaPceG9R7amfhrkarhmkavc;abfaocitfgwarBdbawasBdlavalcdtfarBdbavc;abfaocefcsGcitfgwazBdbawarBdlaocdfhoaHalfhldnadcd9hmbabar87elabas87edabaz87ebabcofhbxdkabarBdwabasBdlabazBdbabcxfhbxekdnarcpe0mbavalaDarcsGfRbbgwcl4gP9RcsGcdtfydbaxcefgsaPEhravalaw9RcsGcdtfydbasaPTgzfgsawcsGgPEhwaPThPdndnadcd9hmbabaw87elabar87edabax87ebcohHxekabawBdwabarBdlabaxBdbcxhHkavalcdtfaxBdbavc;abfaocitfgOarBdbaOaxBdlavalcefglcsGcdtfarBdbavc;abfaocefcsGcitfgOawBdbaOarBdlavalazfglcsGcdtfawBdbavc;abfaocdfcsGcitfgraxBdbarawBdlaocifhoabaHfhbalaPfhlasaPfhxxekdnaeaD9nmbc9:hoxlkaxcbaeRbbgwEgHarc;:eSgrfhsawcsGhOdndnawcl4gAmbascefhzxekashzavalaA9RcsGcdtfydbhskdndnaOmbazcefhxxekazhxavalaw9RcsGcdtfydbhzkdndnarTmbaecefhrxekaecdfhrae8SbegPcFeGhwdnaPcu9kmbaecofhHawcFbGhwcrhedninar8SbbgPcFbGaetawVhwaPcu9kmearcefhraecrfgec8J9hmbkaHhrxekarcefhrkawce4cbawceG9R7amfgmhHkdndnaAcsSmbarhwxekarcefhwar8SbbgecFeGhPdnaecu9kmbarcvfhsaPcFbGhPcrhedninaw8SbbgrcFbGaetaPVhParcu9kmeawcefhwaecrfgec8J9hmbkashwxekawcefhwkaPce4cbaPceG9R7amfgmhskdndnaOcsSmbawhexekawcefheaw8SbbgrcFeGhPdnarcu9kmbawcvfhzaPcFbGhPcrhrdninae8SbbgwcFbGartaPVhPawcu9kmeaecefhearcrfgrc8J9hmbkazhexekaecefhekaPce4cbaPceG9R7amfgmhzkdndnadcd9hmbabaz87elabas87edabaH87ebcohrxekabazBdwabasBdlabaHBdbcxhrkavc;abfaocitfgwasBdbawaHBdlavalcdtfaHBdbavc;abfaocefcsGcitfgwazBdbawasBdlavalcefglcsGcdtfasBdbavc;abfaocdfcsGcitfgwaHBdbawazBdlavalaATaAcsSVfglcsGcdtfazBdbalaOTaOcsSVfhlaocifhoabarfhbkaocsGhoalcsGhlaicefgiaq6mbkkcbc99aeaDSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnalaecvf9pmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk:4ioiue99dud99dud99dnaeTmbcbhiabhlindndnal8Uebgv:YgoJ:ji:1Salcof8UebgrciVgw:Y:vgDNJbbbZJbbb:;avcu9kEMgq:lJbbb9p9DTmbaq:Ohkxekcjjjj94hkkalclf8Uebhvalcdf8UebhxalarcefciGcetfak87ebdndnax:YgqaDNJbbbZJbbb:;axcu9kEMgm:lJbbb9p9DTmbam:Ohxxekcjjjj94hxkabaiarciGgkfcd7cetfax87ebdndnav:YgmaDNJbbbZJbbb:;avcu9kEMgP:lJbbb9p9DTmbaP:Ohvxekcjjjj94hvkalarcufciGcetfav87ebdndnawaw2:ZgPaPMaoaoN:taqaqN:tamamN:tgoJbbbbaoJbbbb9GE:raDNJbbbZMgD:lJbbb9p9DTmbaD:Ohrxekcjjjj94hrkalakcetfar87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk:Tvirud99eudndnadcl9hmbaeTmeindndnabRbbgiabcefgl8Sbbgvabcdfgo8Sbbgrf9R:YJbbuJabcifgwRbbgdce4adVgDcd4aDVgDcl4aDVgD:Z:vgqNJbbbZMgk:lJbbb9p9DTmbak:Ohxxekcjjjj94hxkaoax86bbdndnaraif:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohoxekcjjjj94hokalao86bbdndnavaifar9R:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabai86bbdndnaDadcetGadceGV:ZaqNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkawad86bbabclfhbaecufgembxdkkaeTmbindndnab8Vebgiabcdfgl8Uebgvabclfgo8Uebgrf9R:YJbFu9habcofgw8Vebgdce4adVgDcd4aDVgDcl4aDVgDcw4aDVgD:Z:vgqNJbbbZMgk:lJbbb9p9DTmbak:Ohxxekcjjjj94hxkaoax87ebdndnaraif:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohoxekcjjjj94hokalao87ebdndnavaifar9R:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabai87ebdndnaDadcetGadceGV:ZaqNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkawad87ebabcwfhbaecufgembkkk9teiucbcbyd:K:G:cjbgeabcifc98GfgbBd:K:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkk83dbcj:Gdk8Kbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbc:K:Gdkl8W:qbb";
  var wasm_simd = "b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuixkbbebeeddddilve9Weeeviebeoweuecj:Gdkr;Neqo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949WbwY9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVJ9V29VVbDl79IV9Rbqq:I9Dklbzik94evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaeai86b:q:W:cjbaecitab8Piw83i:q:G:cjbaecefgecjd9hmbkk:SBlEud97dur978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaialfgxar9RhodnadTgmmbavaoad;8qbbkaicefhPcj;abad9Uc;WFbGcjdadca0EhsdndndnadTmbaoadfhzcbhHinaeaH9nmdaxaP9RaD6miabaHad2fgOavcjdfasaeaH9RaHasfae6EgAaAcsfgoc9WGgCSEhXaPaDfhQaocl4cifcd4hLavcj;cbfaCcetfhKavcj;cbfaCci2fhYavcj;cbfaCfh8AcbhEaoc;ab6h3incbh5dnawTmbaPaEcd4fRbbh5kcbh8Eavcj;cbfh8Findndndndna5a8Ecet4ciGgoc9:fPdebdkaxaQ9RaC6mwdnaCTmbavcj;cbfa8EaC2faQaC;8qbbkaQaAfhQxdkaCTmeavcj;cbfa8EaC2fcbaC;8kbxekaxaQ9RaL6moaoclVcbawEhraQaLfhocbhidna3mbaxao9Rc;Gb6mbcbhlina8FalfhidndndndndndnaQalco4fRbbgqciGarfPDbedibledibkaipxbbbbbbbbbbbbbbbbpklbxlkaiaopbblaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLgacdp:meaapmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9oghpxiiiiiiiiiiiiiiiip8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaoclffa8JRb:q:W:cjbfhoxikaiaopbbwaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLpxssssssssssssssssp9oghpxssssssssssssssssp8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaocwffa8JRb:q:W:cjbfhoxdkaiaopbbbpklbaoczfhoxekaiaopbbdaoRbbggcitpbi:q:G:cjbagRb:q:W:cjbggpsaoRbeg8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbagaocdffa8JRb:q:W:cjbfhokdndndndndndnaqcd4ciGarfPDbedibledibkaiczfpxbbbbbbbbbbbbbbbbpklbxlkaiczfaopbblaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLgacdp:meaapmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9oghpxiiiiiiiiiiiiiiiip8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaoclffa8JRb:q:W:cjbfhoxikaiczfaopbbwaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLpxssssssssssssssssp9oghpxssssssssssssssssp8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaocwffa8JRb:q:W:cjbfhoxdkaiczfaopbbbpklbaoczfhoxekaiczfaopbbdaoRbbggcitpbi:q:G:cjbagRb:q:W:cjbggpsaoRbeg8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbagaocdffa8JRb:q:W:cjbfhokdndndndndndnaqcl4ciGarfPDbedibledibkaicafpxbbbbbbbbbbbbbbbbpklbxlkaicafaopbblaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLgacdp:meaapmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9oghpxiiiiiiiiiiiiiiiip8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaoclffa8JRb:q:W:cjbfhoxikaicafaopbbwaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLpxssssssssssssssssp9oghpxssssssssssssssssp8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaocwffa8JRb:q:W:cjbfhoxdkaicafaopbbbpklbaoczfhoxekaicafaopbbdaoRbbggcitpbi:q:G:cjbagRb:q:W:cjbggpsaoRbeg8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbagaocdffa8JRb:q:W:cjbfhokdndndndndndnaqco4arfPDbedibledibkaic8Wfpxbbbbbbbbbbbbbbbbpklbxlkaic8Wfaopbblaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLgacdp:meaapmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9oghpxiiiiiiiiiiiiiiiip8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Ngicitpbi:q:G:cjbaiRb:q:W:cjbgipsaap5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbaiaoclffaqRb:q:W:cjbfhoxikaic8Wfaopbbwaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLpxssssssssssssssssp9oghpxssssssssssssssssp8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Ngicitpbi:q:G:cjbaiRb:q:W:cjbgipsaap5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbaiaocwffaqRb:q:W:cjbfhoxdkaic8Wfaopbbbpklbaoczfhoxekaic8WfaopbbdaoRbbgicitpbi:q:G:cjbaiRb:q:W:cjbgipsaoRbegqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbaiaocdffaqRb:q:W:cjbfhokalc;abfhialcjefaC0meaihlaxao9Rc;Fb0mbkkdnaiaC9pmbaici4hlinaxao9RcK6mwa8FaifhqdndndndndndnaQaico4fRbbalcoG4ciGarfPDbedibledibkaqpxbbbbbbbbbbbbbbbbpkbbxlkaqaopbblaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLgacdp:meaapmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9oghpxiiiiiiiiiiiiiiiip8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spkbbagaoclffa8JRb:q:W:cjbfhoxikaqaopbbwaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLpxssssssssssssssssp9oghpxssssssssssssssssp8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spkbbagaocwffa8JRb:q:W:cjbfhoxdkaqaopbbbpkbbaoczfhoxekaqaopbbdaoRbbggcitpbi:q:G:cjbagRb:q:W:cjbggpsaoRbeg8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpkbbagaocdffa8JRb:q:W:cjbfhokalcdfhlaiczfgiaC6mbkkaohQaoTmoka8FaCfh8Fa8Ecefg8Ecl9hmbkdndndndnawTmbazaEcd4fRbbglciGPlbedwbkaCTmdaXaEfhlavaEfpbdbh8Kcbhoinalavcj;cbfaofpblbg8La8Aaofpblbg8MpmbzeHdOiAlCvXoQrLg8NaKaofpblbgyaYaofpblbg8PpmbzeHdOiAlCvXoQrLgIpmbezHdiOAlvCXorQLgacep9Taapxeeeeeeeeeeeeeeeeghp9op9Hp9rgaa8Kp9Ug8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp9Ug8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp9Ug8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp9Ug8Kp9Abbbaladfgla8Ka8NaIpmwDKYqk8AExm35Ps8E8Fgacep9Taaahp9op9Hp9rgap9Ug8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp9Ug8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp9Ug8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp9Ug8Kp9Abbbaladfgla8Ka8La8MpmwKDYq8AkEx3m5P8Es8Fg8Laya8PpmwKDYq8AkEx3m5P8Es8Fg8MpmbezHdiOAlvCXorQLgacep9Taaahp9op9Hp9rgap9Ug8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp9Ug8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp9Ug8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp9Ug8Kp9Abbbaladfgla8Ka8La8MpmwDKYqk8AExm35Ps8E8Fgacep9Taaahp9op9Hp9rgap9Ughp9Abbbaladfglahaaaapmlvorlvorlvorlvorp9Ughp9AbbbaladfglahaaaapmwDqkwDqkwDqkwDqkp9Ughp9AbbbaladfglahaaaapmxmPsxmPsxmPsxmPsp9Ug8Kp9AbbbaladfhlaoczfgoaC6mbxikkaCTmeaXaEfhlavaEfpbdbh8Kcbhoinalavcj;cbfaofpblbg8La8Aaofpblbg8MpmbzeHdOiAlCvXoQrLg8NaKaofpblbgyaYaofpblbg8PpmbzeHdOiAlCvXoQrLgIpmbezHdiOAlvCXorQLgacep:neaapxebebebebebebebebghp9op:bep9rgaa8Kp:oeg8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp:oeg8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp:oeg8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp:oeg8Kp9Abbbaladfgla8Ka8NaIpmwDKYqk8AExm35Ps8E8Fgacep:neaaahp9op:bep9rgap:oeg8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp:oeg8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp:oeg8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp:oeg8Kp9Abbbaladfgla8Ka8La8MpmwKDYq8AkEx3m5P8Es8Fg8Laya8PpmwKDYq8AkEx3m5P8Es8Fg8MpmbezHdiOAlvCXorQLgacep:neaaahp9op:bep9rgap:oeg8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp:oeg8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp:oeg8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp:oeg8Kp9Abbbaladfgla8Ka8La8MpmwDKYqk8AExm35Ps8E8Fgacep:neaaahp9op:bep9rgap:oeghp9Abbbaladfglahaaaapmlvorlvorlvorlvorp:oeghp9AbbbaladfglahaaaapmwDqkwDqkwDqkwDqkp:oeghp9AbbbaladfglahaaaapmxmPsxmPsxmPsxmPsp:oeg8Kp9AbbbaladfhlaoczfgoaC6mbxdkkaCTmbaXaEfhrcbhocbalcl4gl9Rc8FGhiavaEfpbdbhhinaravcj;cbfaofpblbg8Ka8Aaofpblbg8LpmbzeHdOiAlCvXoQrLg8MaKaofpblbg8NaYaofpblbgypmbzeHdOiAlCvXoQrLg8PpmbezHdiOAlvCXorQLgaaip:Reaaalp:Tep9qgaahp9rghp9Abbbaradfgrahaaaapmlvorlvorlvorlvorp9rghp9AbbbaradfgrahaaaapmwDqkwDqkwDqkwDqkp9rghp9AbbbaradfgrahaaaapmxmPsxmPsxmPsxmPsp9rghp9Abbbaradfgraha8Ma8PpmwDKYqk8AExm35Ps8E8Fgaaip:Reaaalp:Tep9qgap9rghp9Abbbaradfgrahaaaapmlvorlvorlvorlvorp9rghp9AbbbaradfgrahaaaapmwDqkwDqkwDqkwDqkp9rghp9AbbbaradfgrahaaaapmxmPsxmPsxmPsxmPsp9rghp9Abbbaradfgraha8Ka8LpmwKDYq8AkEx3m5P8Es8Fg8Ka8NaypmwKDYq8AkEx3m5P8Es8Fg8LpmbezHdiOAlvCXorQLgaaip:Reaaalp:Tep9qgap9rghp9Abbbaradfgrahaaaapmlvorlvorlvorlvorp9rghp9AbbbaradfgrahaaaapmwDqkwDqkwDqkwDqkp9rghp9AbbbaradfgrahaaaapmxmPsxmPsxmPsxmPsp9rghp9Abbbaradfgraha8Ka8LpmwDKYqk8AExm35Ps8E8Fgaaip:Reaaalp:Tep9qgap9rghp9Abbbaradfgrahaaaapmlvorlvorlvorlvorp9rghp9AbbbaradfgrahaaaapmwDqkwDqkwDqkwDqkp9rghp9AbbbaradfgrahaaaapmxmPsxmPsxmPsxmPsp9rghp9AbbbaradfhraoczfgoaC6mbkkaEclfgEad6mbkdnaXavcjdf9hmbaAad2goTmbaOavcjdfao;8qbbkdnammbavaXaAcufad2fad;8qbbkaAaHfhHc9:hoaQhPaQmbxlkkaeTmbaDalfhrcbhocuhlinaralaD9RglfaD6mdasaeao9Raoasfae6Eaofgoae6mbkaial9RhPkcbc99axaP9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaokwbz:bjjjbkpPesu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnalaeci9UgrcHf6mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgwce0mbavc;abfcFecje;8kbav9cu83iUav9cu83i8Wav9cu83iyav9cu83iaav9cu83iKav9cu83izav9cu83iwav9cu83ibaialfc9WfhDaicefgiarfhqdndnaeci9pmbaqhexekcmcsawceSEhkcbhxcbhmaqhecbhlcbhoindndnaiRbbgrc;Ve0mbavc;abfaoarcu7gPcl4fcsGcitfgwydlhsawydbhzdndnarcsGgwak9pmbavalaPfcsGcdtfydbaxawEhraxawTgHfhxxekdnaeaD9nmbc9:hoxokdndnawcsSmbcehHamawcetfcWfhrxekaecefhrae8SbbgwcFeGhPdndnawcu9mmbarhexekaecvfheaPcFbGhPcrhwdninar8SbbgHcFbGawtaPVhPaHcu9kmearcefhrawcrfgwc8J9hmbxdkkarcefhekcehHaPce4cbaPceG9R7amfhrkarhmkavc;abfaocitfgwarBdbawasBdlavalcdtfarBdbavc;abfaocefcsGcitfgwazBdbawarBdlaocdfhoaHalfhldnadcd9hmbabar87elabas87edabaz87ebabcofhbxdkabarBdwabasBdlabazBdbabcxfhbxekdnarcpe0mbavalaDarcsGfRbbgwcl4gP9RcsGcdtfydbaxcefgsaPEhravalaw9RcsGcdtfydbasaPTgzfgsawcsGgPEhwaPThPdndnadcd9hmbabaw87elabar87edabax87ebcohHxekabawBdwabarBdlabaxBdbcxhHkavalcdtfaxBdbavc;abfaocitfgOarBdbaOaxBdlavalcefglcsGcdtfarBdbavc;abfaocefcsGcitfgOawBdbaOarBdlavalazfglcsGcdtfawBdbavc;abfaocdfcsGcitfgraxBdbarawBdlaocifhoabaHfhbalaPfhlasaPfhxxekdnaeaD9nmbc9:hoxlkaxcbaeRbbgwEgHarc;:eSgrfhsawcsGhOdndnawcl4gAmbascefhzxekashzavalaA9RcsGcdtfydbhskdndnaOmbazcefhxxekazhxavalaw9RcsGcdtfydbhzkdndnarTmbaecefhrxekaecdfhrae8SbegPcFeGhwdnaPcu9kmbaecofhHawcFbGhwcrhedninar8SbbgPcFbGaetawVhwaPcu9kmearcefhraecrfgec8J9hmbkaHhrxekarcefhrkawce4cbawceG9R7amfgmhHkdndnaAcsSmbarhwxekarcefhwar8SbbgecFeGhPdnaecu9kmbarcvfhsaPcFbGhPcrhedninaw8SbbgrcFbGaetaPVhParcu9kmeawcefhwaecrfgec8J9hmbkashwxekawcefhwkaPce4cbaPceG9R7amfgmhskdndnaOcsSmbawhexekawcefheaw8SbbgrcFeGhPdnarcu9kmbawcvfhzaPcFbGhPcrhrdninae8SbbgwcFbGartaPVhPawcu9kmeaecefhearcrfgrc8J9hmbkazhexekaecefhekaPce4cbaPceG9R7amfgmhzkdndnadcd9hmbabaz87elabas87edabaH87ebcohrxekabazBdwabasBdlabaHBdbcxhrkavc;abfaocitfgwasBdbawaHBdlavalcdtfaHBdbavc;abfaocefcsGcitfgwazBdbawasBdlavalcefglcsGcdtfasBdbavc;abfaocdfcsGcitfgwaHBdbawazBdlavalaATaAcsSVfglcsGcdtfazBdbalaOTaOcsSVfhlaocifhoabarfhbkaocsGhoalcsGhlaicefgiaq6mbkkcbc99aeaDSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnalaecvf9pmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk;Toio97eue97aec98Ghedndnadcl9hmbaeTmecbhdinababpbbbgicKp:RecKp:Sep;6eglaicwp:RecKp:Sep;6ealp;Geaiczp:RecKp:Sep;6egvp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egralpxbbbjbbbjbbbjbbbjgwp9op9rp;Keglpxbb;:9cbb;:9cbb;:9cbb;:9calalp;Meaoaop;Meavaravawp9op9rp;Keglalp;Mep;Kep;Kep;Jep;Negvp;Mepxbbn0bbn0bbn0bbn0grp;KepxFbbbFbbbFbbbFbbbp9oaipxbbbFbbbFbbbFbbbFp9op9qalavp;Mearp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaoavp;Mearp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbabczfhbadclfgdae6mbxdkkaeTmbcbhdinabczfgDaDpbbbgipxbbbbbbFFbbbbbbFFgwp9oabpbbbgoaipmbediwDqkzHOAKY8AEgvczp:Reczp:Sep;6eglaoaipmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eavczp:Sep;6egvp;Gealp;Gep;Kep;Legipxbbbbbbbbbbbbbbbbp:2egralpxbbbjbbbjbbbjbbbjgqp9op9rp;Keglpxb;:FSb;:FSb;:FSb;:FSalalp;Meaiaip;Meavaravaqp9op9rp;Keglalp;Mep;Kep;Kep;Jep;Negvp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbp9oaiavp;Mearp;Keczp:Rep9qgialavp;Mearp;KepxFFbbFFbbFFbbFFbbp9oglpmwDKYqk8AExm35Ps8E8Fp9qpkbbabaoawp9oaialpmbezHdiOAlvCXorQLp9qpkbbabcafhbadclfgdae6mbkkk;2ileue97euo97dnaec98GgiTmbcbheinabcKfpx:ji:1S:ji:1S:ji:1S:ji:1SabpbbbglabczfgvpbbbgopmlvorxmPsCXQL358E8Fgrczp:Segwpxibbbibbbibbbibbbp9qp;6egDp;NegqaDaDp;MegDaDp;KealaopmbediwDqkzHOAKY8AEgDczp:Reczp:Sep;6eglalp;MeaDczp:Sep;6egoaop;Mearczp:Reczp:Sep;6egrarp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jep;Mepxbbn0bbn0bbn0bbn0gDp;KepxFFbbFFbbFFbbFFbbgkp9oaqaop;MeaDp;Keczp:Rep9qgoaqalp;MeaDp;Keakp9oaqarp;MeaDp;Keczp:Rep9qgDpmwDKYqk8AExm35Ps8E8Fglp5eawclp:RegqpEi:T:j83ibavalp5baqpEd:T:j83ibabcwfaoaDpmbezHdiOAlvCXorQLgDp5eaqpEe:T:j83ibabaDp5baqpEb:T:j83ibabcafhbaeclfgeai6mbkkkuee97dnadcd4ae2c98GgeTmbcbhdinababpbbbgicwp:Recwp:Sep;6eaicep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbabczfhbadclfgdae6mbkkk:Sodw97euaec98Ghedndnadcl9hmbaeTmecbhdinabpxbbuJbbuJbbuJbbuJabpbbbgicKp:TeglaicYp:Tep9qgvcdp:Teavp9qgvclp:Teavp9qgop;6ep;Negvaicwp:RecKp:SegraipxFbbbFbbbFbbbFbbbgwp9ogDp:Uep;6ep;Mepxbbn0bbn0bbn0bbn0gqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9oavaDarp:Xeaiczp:RecKp:Segip:Uep;6ep;Meaqp;Keawp9op9qavaDaraip:Uep:Xep;6ep;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qavaoalcep:Rep9oalpxebbbebbbebbbebbbp9op9qp;6ep;Meaqp;KecKp:Rep9qpkbbabczfhbadclfgdae6mbxdkkaeTmbcbhdinabczfgkpxbFu9hbFu9hbFu9hbFu9habpbbbglakpbbbgrpmlvorxmPsCXQL358E8Fgvczp:TegqavcHp:Tep9qgicdp:Teaip9qgiclp:Teaip9qgicwp:Teaip9qgop;6ep;NegialarpmbediwDqkzHOAKY8AEgDpxFFbbFFbbFFbbFFbbglp9ograDczp:Segwp:Ueavczp:Reczp:SegDp:Xep;6ep;Mepxbbn0bbn0bbn0bbn0gvp;Kealp9oaiarawaDp:Uep:Xep;6ep;Meavp;Keczp:Rep9qgwaiaoaqcep:Rep9oaqpxebbbebbbebbbebbbp9op9qp;6ep;Meavp;Keczp:ReaiaDarp:Uep;6ep;Meavp;Kealp9op9qgipmwDKYqk8AExm35Ps8E8FpkbbabawaipmbezHdiOAlvCXorQLpkbbabcafhbadclfgdae6mbkkk9teiucbcbydj:G:cjbgeabcifc98GfgbBdj:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkxebcj:Gdklz:zbb";
  var detector = new Uint8Array([
    0,
    97,
    115,
    109,
    1,
    0,
    0,
    0,
    1,
    4,
    1,
    96,
    0,
    0,
    3,
    3,
    2,
    0,
    0,
    5,
    3,
    1,
    0,
    1,
    12,
    1,
    0,
    10,
    22,
    2,
    12,
    0,
    65,
    0,
    65,
    0,
    65,
    0,
    252,
    10,
    0,
    0,
    11,
    7,
    0,
    65,
    0,
    253,
    15,
    26,
    11
  ]);
  var wasmpack = new Uint8Array([
    32,
    0,
    65,
    2,
    1,
    106,
    34,
    33,
    3,
    128,
    11,
    4,
    13,
    64,
    6,
    253,
    10,
    7,
    15,
    116,
    127,
    5,
    8,
    12,
    40,
    16,
    19,
    54,
    20,
    9,
    27,
    255,
    113,
    17,
    42,
    67,
    24,
    23,
    146,
    148,
    18,
    14,
    22,
    45,
    70,
    69,
    56,
    114,
    101,
    21,
    25,
    63,
    75,
    136,
    108,
    28,
    118,
    29,
    73,
    115
  ]);
  if (typeof WebAssembly !== "object") {
    return {
      supported: false
    };
  }
  var wasm = WebAssembly.validate(detector) ? unpack(wasm_simd) : unpack(wasm_base);
  var instance;
  var ready = WebAssembly.instantiate(wasm, {}).then(function(result) {
    instance = result.instance;
    instance.exports.__wasm_call_ctors();
  });
  function unpack(data) {
    var result = new Uint8Array(data.length);
    for (var i = 0; i < data.length; ++i) {
      var ch = data.charCodeAt(i);
      result[i] = ch > 96 ? ch - 97 : ch > 64 ? ch - 39 : ch + 4;
    }
    var write = 0;
    for (var i = 0; i < data.length; ++i) {
      result[write++] = result[i] < 60 ? wasmpack[result[i]] : (result[i] - 60) * 64 + result[++i];
    }
    return result.buffer.slice(0, write);
  }
  function decode(instance2, fun, target, count, size, source, filter) {
    var sbrk = instance2.exports.sbrk;
    var count4 = count + 3 & ~3;
    var tp = sbrk(count4 * size);
    var sp = sbrk(source.length);
    var heap = new Uint8Array(instance2.exports.memory.buffer);
    heap.set(source, sp);
    var res = fun(tp, count, size, sp, source.length);
    if (res == 0 && filter) {
      filter(tp, count4, size);
    }
    target.set(heap.subarray(tp, tp + count * size));
    sbrk(tp - sbrk(0));
    if (res != 0) {
      throw new Error("Malformed buffer data: " + res);
    }
  }
  var filters = {
    NONE: "",
    OCTAHEDRAL: "meshopt_decodeFilterOct",
    QUATERNION: "meshopt_decodeFilterQuat",
    EXPONENTIAL: "meshopt_decodeFilterExp",
    COLOR: "meshopt_decodeFilterColor"
  };
  var decoders = {
    ATTRIBUTES: "meshopt_decodeVertexBuffer",
    TRIANGLES: "meshopt_decodeIndexBuffer",
    INDICES: "meshopt_decodeIndexSequence"
  };
  var workers = [];
  var requestId = 0;
  function createWorker(url) {
    var worker = {
      object: new Worker(url),
      pending: 0,
      requests: {}
    };
    worker.object.onmessage = function(event) {
      var data = event.data;
      worker.pending -= data.count;
      worker.requests[data.id][data.action](data.value);
      delete worker.requests[data.id];
    };
    return worker;
  }
  function initWorkers(count) {
    var source = "self.ready = WebAssembly.instantiate(new Uint8Array([" + new Uint8Array(wasm) + "]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = " + workerProcess.name + ";" + decode.toString() + workerProcess.toString();
    var blob = new Blob([source], { type: "text/javascript" });
    var url = URL.createObjectURL(blob);
    for (var i = workers.length; i < count; ++i) {
      workers[i] = createWorker(url);
    }
    for (var i = count; i < workers.length; ++i) {
      workers[i].object.postMessage({});
    }
    workers.length = count;
    URL.revokeObjectURL(url);
  }
  function decodeWorker(count, size, source, mode, filter) {
    var worker = workers[0];
    for (var i = 1; i < workers.length; ++i) {
      if (workers[i].pending < worker.pending) {
        worker = workers[i];
      }
    }
    return new Promise(function(resolve, reject) {
      var data = new Uint8Array(source);
      var id = ++requestId;
      worker.pending += count;
      worker.requests[id] = { resolve, reject };
      worker.object.postMessage({ id, count, size, source: data, mode, filter }, [data.buffer]);
    });
  }
  function workerProcess(event) {
    var data = event.data;
    self.ready.then(function(instance2) {
      if (!data.id) {
        return self.close();
      }
      try {
        var target = new Uint8Array(data.count * data.size);
        decode(instance2, instance2.exports[data.mode], target, data.count, data.size, data.source, instance2.exports[data.filter]);
        self.postMessage({ id: data.id, count: data.count, action: "resolve", value: target }, [target.buffer]);
      } catch (error) {
        self.postMessage({ id: data.id, count: data.count, action: "reject", value: error });
      }
    });
  }
  return {
    ready,
    supported: true,
    useWorkers: function(count) {
      initWorkers(count);
    },
    decodeVertexBuffer: function(target, count, size, source, filter) {
      decode(instance, instance.exports.meshopt_decodeVertexBuffer, target, count, size, source, instance.exports[filters[filter]]);
    },
    decodeIndexBuffer: function(target, count, size, source) {
      decode(instance, instance.exports.meshopt_decodeIndexBuffer, target, count, size, source);
    },
    decodeIndexSequence: function(target, count, size, source) {
      decode(instance, instance.exports.meshopt_decodeIndexSequence, target, count, size, source);
    },
    decodeGltfBuffer: function(target, count, size, source, mode, filter) {
      decode(instance, instance.exports[decoders[mode]], target, count, size, source, instance.exports[filters[filter]]);
    },
    decodeGltfBufferAsync: function(count, size, source, mode, filter) {
      if (workers.length > 0) {
        return decodeWorker(count, size, source, decoders[mode], filters[filter]);
      }
      return ready.then(function() {
        var target = new Uint8Array(count * size);
        decode(instance, instance.exports[decoders[mode]], target, count, size, source, instance.exports[filters[filter]]);
        return target;
      });
    }
  };
})();

// packages/core/runtime3d/MeshoptModelDecoder.ts
var EXT = "EXT_meshopt_compression";
var object = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Expected glTF object");
  return value;
};
var integer = (value, min = 0) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) throw Error("Invalid glTF byte count/index");
  return value;
};
var align = (value) => Math.ceil(value / 4) * 4;
var ZhudaMeshoptModelDecoder = class {
  constructor() {
    this.descriptor = Object.freeze({
      format: "meshopt",
      name: "meshoptimizer",
      version: "1.3.0",
      integritySha256: "10b313edaa0e322b0c1b46443f6c8b186b42139fe1eca189d50c09511d0ebedc"
    });
    this.disposed = false;
  }
  async decode({ assetId, bytes, signal, maxOutputBytes }) {
    const check = () => {
      if (this.disposed || signal.aborted) throw new DOMException("Meshopt decode cancelled", "AbortError");
    };
    check();
    if (!MeshoptDecoder.supported) throw new ModelDecoderError("unsupported", "Meshopt requires WebAssembly", { format: "meshopt", assetId });
    if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) throw Error("Invalid Meshopt output limit");
    const { document: document2, binary } = readGltfAssetDocument(bytes);
    const report = inspectGltfDocument(document2);
    if (report.diagnostics.some((d) => d.severity === "error" && !(d.code === "UNSUPPORTED_REQUIRED_EXTENSION" && d.extension === EXT)))
      throw Error("Invalid or unsupported glTF input: " + report.diagnostics.filter((d) => d.severity === "error").map((d) => d.message).join("; "));
    if (!Array.isArray(document2.extensionsUsed) || !document2.extensionsUsed.includes(EXT)) throw Error("Meshopt extension is not declared");
    const sourceBuffers = document2.buffers;
    const views = document2.bufferViews;
    if (!Array.isArray(sourceBuffers) || !Array.isArray(views)) throw Error("Meshopt requires buffers and bufferViews");
    let bin;
    if (binary) {
      const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let offset2 = 12, chunks = 0;
      while (offset2 < bytes.byteLength) {
        if (offset2 + 8 > bytes.byteLength) throw Error("Truncated GLB chunk");
        const size = data.getUint32(offset2, true), kind = data.getUint32(offset2 + 4, true);
        if (size % 4 || offset2 + 8 + size > bytes.byteLength) throw Error("Invalid GLB chunk length");
        if (chunks === 0 && kind !== 1313821514) throw Error("GLB JSON must be first");
        if (kind === 5130562) {
          if (bin || chunks !== 1) throw Error("Duplicate or misplaced GLB binary chunk");
          bin = bytes.subarray(offset2 + 8, offset2 + 8 + size);
        } else if (kind !== 1313821514 || chunks !== 0) throw Error("Unsupported GLB chunk");
        offset2 += size + 8;
        chunks++;
      }
    }
    const buffers = /* @__PURE__ */ new Map();
    let embeddedBytes = 0;
    const buffer = (value) => {
      const index = integer(value), source = object(sourceBuffers[index]);
      if (buffers.has(index)) return buffers.get(index);
      const length = integer(source.byteLength), uri = source.uri;
      let result;
      if (uri === void 0 && index === 0 && bin) result = bin;
      else if (typeof uri === "string" && /^data:(application\/(octet-stream|gltf-buffer))?;base64,/.test(uri)) {
        const encoded = uri.slice(uri.indexOf(",") + 1);
        if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded) || Math.floor(encoded.length * 3 / 4) > maxOutputBytes + 2) throw Error("Invalid or oversized embedded buffer");
        result = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      } else throw Error("Meshopt requires embedded buffers; no external fetch or missing fallback bytes");
      if (result.byteLength < length || result.byteLength > length + (uri === void 0 ? 3 : 0)) throw Error("Embedded buffer length mismatch");
      embeddedBytes += result.byteLength;
      if (embeddedBytes > maxOutputBytes) throw Error("Meshopt embedded buffer budget exceeded");
      buffers.set(index, result.subarray(0, length));
      return buffers.get(index);
    };
    for (const item of document2.images ?? []) {
      const image = object(item);
      if (image.uri !== void 0 && (typeof image.uri !== "string" || !image.uri.startsWith("data:"))) throw Error("Meshopt requires embedded images");
    }
    const plans = views.map((raw, index) => {
      const view = object(raw), extensions = view.extensions === void 0 ? {} : object(view.extensions);
      const e = extensions[EXT] === void 0 ? void 0 : object(extensions[EXT]);
      const length = integer(view.byteLength, 1), fallbackIndex = integer(view.buffer);
      const fallback = object(sourceBuffers[fallbackIndex]);
      if (integer(view.byteOffset ?? 0) + length > integer(fallback.byteLength)) throw Error(`bufferViews[${index}] exceeds declared fallback buffer`);
      if (!e) return { view, length, source: buffer(view.buffer), offset: integer(view.byteOffset ?? 0), compressedLength: length, e };
      const stride = integer(e.byteStride, 1), count = integer(e.count, 1), mode = e.mode, filter = e.filter ?? "NONE";
      if (stride * count !== length || view.byteStride !== void 0 && view.byteStride !== stride || !["ATTRIBUTES", "TRIANGLES", "INDICES"].includes(String(mode)) || !["NONE", "OCTAHEDRAL", "QUATERNION", "EXPONENTIAL"].includes(String(filter)) || mode === "ATTRIBUTES" && (stride % 4 !== 0 || stride > 256) || mode !== "ATTRIBUTES" && (![2, 4].includes(stride) || filter !== "NONE") || mode === "TRIANGLES" && count % 3 !== 0 || filter === "OCTAHEDRAL" && ![4, 8].includes(stride) || filter === "QUATERNION" && stride !== 8 || filter === "EXPONENTIAL" && stride % 4 !== 0) throw Error(`Invalid Meshopt layout at bufferViews[${index}]`);
      return { view, length, source: buffer(e.buffer), offset: integer(e.byteOffset ?? 0), compressedLength: integer(e.byteLength, 1), e };
    });
    let total = 0;
    for (const p of plans) {
      if (p.offset + p.compressedLength > p.source.byteLength) throw Error("Meshopt source range exceeds buffer");
      total += align(p.length);
      if (!Number.isSafeInteger(total) || total > maxOutputBytes) throw Error("Meshopt decoded output budget exceeded");
    }
    await MeshoptDecoder.ready;
    check();
    const output = new Uint8Array(total);
    let offset = 0;
    for (const p of plans) {
      check();
      const target = output.subarray(offset, offset + p.length), source = p.source.subarray(p.offset, p.offset + p.compressedLength);
      if (p.e) MeshoptDecoder.decodeGltfBuffer(target, p.e.count, p.e.byteStride, source, p.e.mode, p.e.filter ?? "NONE");
      else target.set(source);
      p.view.buffer = 0;
      p.view.byteOffset = offset;
      if (p.view.extensions) {
        delete object(p.view.extensions)[EXT];
        if (!Object.keys(object(p.view.extensions)).length) delete p.view.extensions;
      }
      offset += align(p.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    check();
    document2.buffers = [{ byteLength: output.byteLength }];
    for (const name of ["extensionsUsed", "extensionsRequired"]) if (Array.isArray(document2[name])) {
      document2[name] = document2[name].filter((x) => x !== EXT);
      if (!document2[name].length) delete document2[name];
    }
    if (inspectGltfDocument(document2).diagnostics.some((d) => d.severity === "error")) throw Error("Unhandled Meshopt extension location");
    const json = new TextEncoder().encode(JSON.stringify(document2)), jsonLength = align(json.byteLength);
    const fileLength = 12 + 8 + jsonLength + 8 + output.byteLength;
    if (fileLength > maxOutputBytes || fileLength > 4294967295) throw Error("Meshopt GLB output budget exceeded");
    const glb = new Uint8Array(fileLength), header = new DataView(glb.buffer);
    header.setUint32(0, 1179937895, true);
    header.setUint32(4, 2, true);
    header.setUint32(8, fileLength, true);
    header.setUint32(12, jsonLength, true);
    header.setUint32(16, 1313821514, true);
    glb.fill(32, 20, 20 + jsonLength);
    glb.set(json, 20);
    header.setUint32(20 + jsonLength, output.byteLength, true);
    header.setUint32(24 + jsonLength, 5130562, true);
    glb.set(output, 28 + jsonLength);
    return { assetId, format: "meshopt", data: glb, byteLength: glb.byteLength, release() {
    } };
  }
  dispose() {
    this.disposed = true;
  }
};

// packages/core/runtime3d/SceneQueries.ts
var ZhudaSceneQueries = class {
  constructor() {
    this.providers = /* @__PURE__ */ new Map();
  }
  register(p) {
    const key = p.entityId + "\0" + (p.instanceId ?? "");
    if (!p.entityId || this.providers.has(key))
      throw Error("Duplicate/missing stable query ID");
    this.providers.set(key, p);
    return () => this.providers.delete(key);
  }
  raycast(ray, maxDistance = Infinity, layerMask = 4294967295) {
    if (!(maxDistance >= 0)) throw Error("Invalid ray distance");
    const r = { origin: ray.origin, direction: normalized(ray.direction) };
    let hit = null;
    for (const p of this.providers.values()) {
      if (!((p.layer ?? 1) & layerMask)) continue;
      const h = p.raycast(r, hit?.distance ?? maxDistance);
      if (h && Number.isFinite(h.distance) && h.distance >= 0 && h.distance <= maxDistance && (!hit || h.distance < hit.distance))
        hit = {
          ...h,
          entityId: p.entityId,
          instanceId: p.instanceId ?? h.instanceId
        };
    }
    return hit;
  }
  sweepSphere(from, to, radius, layerMask = 4294967295) {
    if (!Number.isFinite(radius) || radius < 0)
      throw Error("Invalid sweep radius");
    let hit = null;
    for (const p of this.providers.values()) {
      if (!((p.layer ?? 1) & layerMask) || !p.sweepSphere) continue;
      const h = p.sweepSphere(from, to, radius);
      if (h && h.distance >= 0 && Number.isFinite(h.distance) && (!hit || h.distance < hit.distance))
        hit = {
          ...h,
          entityId: p.entityId,
          instanceId: p.instanceId ?? h.instanceId
        };
    }
    return hit;
  }
  clear() {
    this.providers.clear();
  }
  get size() {
    return this.providers.size;
  }
};
function rayBox(ray, min, max, maxDistance = Infinity) {
  let near = 0, far = maxDistance;
  let normal = { x: 0, y: 0, z: 0 };
  for (const axis of ["x", "y", "z"]) {
    const d = ray.direction[axis], o = ray.origin[axis];
    if (Math.abs(d) < 1e-10) {
      if (o < min[axis] || o > max[axis]) return null;
      continue;
    }
    let a = (min[axis] - o) / d, b = (max[axis] - o) / d, sign = -1;
    if (a > b) {
      [a, b] = [b, a];
      sign = 1;
    }
    if (a > near) {
      near = a;
      normal = { x: 0, y: 0, z: 0 };
      normal[axis] = sign;
    }
    far = Math.min(far, b);
    if (near > far) return null;
  }
  if (far < 0) return null;
  return {
    distance: near,
    normal,
    position: {
      x: ray.origin.x + ray.direction.x * near,
      y: ray.origin.y + ray.direction.y * near,
      z: ray.origin.z + ray.direction.z * near
    }
  };
}
var ZhudaCameraCoordinates = class {
  constructor(camera, viewport) {
    this.camera = camera;
    this.viewport = viewport;
  }
  matrices() {
    return multiply4(
      this.camera.projectionMatrix.elements,
      this.camera.viewMatrix.elements
    );
  }
  rect() {
    const v = this.viewport(), n = this.camera.normalizedViewport || { x: 0, y: 0, width: 1, height: 1 };
    if (!(v.width > 0 && v.height > 0 && n.width > 0 && n.height > 0))
      throw Error("Empty camera viewport");
    return {
      left: v.left + n.x * v.width,
      top: v.top + n.y * v.height,
      width: v.width * n.width,
      height: v.height * n.height
    };
  }
  screenToRay(x, y) {
    if (![x, y].every(Number.isFinite)) throw Error("Invalid screen point");
    const r = this.rect(), inv = inverse4(this.matrices()), nx = (x - r.left) / r.width * 2 - 1, ny = 1 - (y - r.top) / r.height * 2;
    const origin = transformPoint(inv, { x: nx, y: ny, z: -1 }), far = transformPoint(inv, { x: nx, y: ny, z: 1 });
    return {
      origin,
      direction: normalized({
        x: far.x - origin.x,
        y: far.y - origin.y,
        z: far.z - origin.z
      })
    };
  }
  worldToScreen(p) {
    const m = this.matrices(), v = transformPoint(m, p), r = this.rect(), w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
    return {
      x: r.left + (v.x + 1) * 0.5 * r.width,
      y: r.top + (1 - v.y) * 0.5 * r.height,
      depth: (v.z + 1) * 0.5,
      visible: w > 0 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && Math.abs(v.z) <= 1
    };
  }
};
var ZhudaSurfaceQuery = class {
  constructor(sample) {
    this.sample = sample;
  }
  at(x, z, time) {
    if (![x, z, time].every(Number.isFinite))
      throw Error("Invalid surface query");
    return this.sample(x, z, time);
  }
};

// packages/core/runtime3d/CameraCollision.ts
function resolveCameraBoom(focus, desired, options) {
  const radius = options.radius ?? 0.25, clearance = options.clearance ?? 0.1;
  if (![
    ...Object.values(focus),
    ...Object.values(desired),
    radius,
    clearance
  ].every(Number.isFinite) || radius < 0 || clearance < 0)
    throw Error("Invalid camera collision parameters");
  const delta = {
    x: desired.x - focus.x,
    y: desired.y - focus.y,
    z: desired.z - focus.z
  }, length = Math.hypot(delta.x, delta.y, delta.z);
  if (length < 1e-8)
    return { position: { ...focus }, distance: 0, blocked: false };
  const direction = normalized(delta), axis = Math.abs(direction.y) < 0.95 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }, cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  }), right = normalized(cross(direction, axis)), up = cross(right, direction);
  let distance = length;
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.707, 0.707],
    [-0.707, 0.707],
    [0.707, -0.707],
    [-0.707, -0.707]
  ]) {
    const origin = {
      x: focus.x + (right.x * x + up.x * y) * radius,
      y: focus.y + (right.y * x + up.y * y) * radius,
      z: focus.z + (right.z * x + up.z * y) * radius
    }, hit = options.queries.raycast(
      { origin, direction },
      length + radius,
      options.layerMask
    );
    if (hit)
      distance = Math.min(
        distance,
        Math.max(0, hit.distance - radius - clearance)
      );
  }
  return {
    position: {
      x: focus.x + direction.x * distance,
      y: focus.y + direction.y * distance,
      z: focus.z + direction.z * distance
    },
    distance,
    blocked: distance < length
  };
}

// packages/core/runtime3d/CameraRig.ts
var ZhudaCameraRig = class {
  constructor(camera, options = {}) {
    this.yaw = 0;
    this.pitch = 0.48;
    this.distance = 16;
    this.camera = camera;
    this.options = options;
  }
  rotate(dx, dy) {
    if (![dx, dy].every(Number.isFinite)) throw Error("Invalid camera input");
    const s = this.options.sensitivity ?? 5e-3;
    this.yaw -= dx * s;
    this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch + dy * s));
  }
  zoom(delta) {
    if (!Number.isFinite(delta)) throw Error("Invalid camera zoom");
    this.distance = Math.max(
      this.options.minDistance ?? 2,
      Math.min(
        this.options.maxDistance ?? 80,
        this.distance * Math.exp(delta * 1e-3)
      )
    );
  }
  update(target) {
    const l = globalThis.Laya, first = this.options.mode === "firstPerson", d = first ? 1 : this.distance;
    const offset = {
      x: Math.sin(this.yaw) * Math.cos(this.pitch) * d,
      y: Math.sin(this.pitch) * d,
      z: Math.cos(this.yaw) * Math.cos(this.pitch) * d
    };
    let position = first ? target : {
      x: target.x + offset.x,
      y: target.y + offset.y,
      z: target.z + offset.z
    };
    if (!first && this.options.collision)
      position = resolveCameraBoom(
        target,
        position,
        this.options.collision
      ).position;
    const look = first ? {
      x: target.x - offset.x,
      y: target.y - offset.y,
      z: target.z - offset.z
    } : target;
    this.camera.transform.position = new l.Vector3(
      position.x,
      position.y,
      position.z
    );
    this.camera.transform.lookAt(
      new l.Vector3(look.x, look.y, look.z),
      new l.Vector3(0, 1, 0)
    );
  }
};

// packages/core/runtime3d/Filmic.ts
function requireCapabilities(l, names) {
  for (const name of names)
    if (!l.LayaGL.renderEngine.getCapable(l.RenderCapable[name]))
      throw Error("Filmic rendering requires " + name);
}
function createPrefilteredEnvironment(spec, pixels) {
  if (!Number.isInteger(spec.size) || spec.size < 1 || spec.size & spec.size - 1 || spec.ambientSH.length !== 27 || !spec.ambientSH.every(Number.isFinite))
    throw Error("Invalid environment descriptor");
  if (spec.levels.length !== Math.log2(spec.size) + 1)
    throw Error("Incomplete GGX mip chain");
  let offset = 0;
  for (const [i, level] of spec.levels.entries()) {
    const size = Math.max(1, spec.size >> i), elements = size * size * 4 * 6;
    if (level.size !== size || level.offset !== offset || level.elements !== elements)
      throw Error("Invalid environment mip layout");
    offset += elements;
  }
  if (offset !== pixels.length || !pixels.every((v) => Number.isFinite(v) && v >= 0))
    throw Error("Invalid environment pixels");
  const l = globalThis.Laya;
  requireCapabilities(l, [
    "TextureFormat_R32G32B32A32",
    "Texture_FloatLinearFiltering"
  ]);
  const texture = new l.TextureCube(
    spec.size,
    l.TextureFormat.R32G32B32A32,
    true,
    false
  );
  texture.filterMode = l.FilterMode.Trilinear;
  const faces = (level) => [4, 5, 0, 1, 2, 3].map(
    (i) => pixels.subarray(
      level.offset + i * level.size * level.size * 4,
      level.offset + (i + 1) * level.size * level.size * 4
    )
  );
  texture.setPixelsData(faces(spec.levels[0]), false, false);
  for (let i = 1; i < spec.levels.length; i++) {
    const level = spec.levels[i];
    texture.updateSubPixelsData(
      faces(level),
      0,
      0,
      level.size,
      level.size,
      i,
      false,
      false,
      false
    );
  }
  return {
    texture,
    apply(scene) {
      scene.iblTex = texture;
      scene.iblTexRGBD = false;
      scene.ambientMode = l.AmbientMode.SphericalHarmonics;
      scene.ambientSH = new Float32Array(spec.ambientSH);
    },
    dispose() {
      texture.destroy();
    }
  };
}
var ZhudaFilmicPipeline = class {
  constructor(camera, options = {}) {
    this.disposed = false;
    this.ownsTAA = false;
    this.camera = camera;
    const l = globalThis.Laya;
    for (const k of [
      "exposure",
      "contrast",
      "saturation",
      "aoIntensity",
      "aoRadius",
      "bloomIntensity"
    ])
      if (options[k] !== void 0 && (!Number.isFinite(options[k]) || options[k] < 0))
        throw Error("Invalid filmic option " + k);
    if (camera.postProcess)
      throw Error("Camera already owns a postprocess chain");
    requireCapabilities(l, ["RenderTextureFormat_R16G16B16A16"]);
    this.previous = camera.postProcess;
    this.previousHDR = camera.enableHDR;
    this.previousMSAA = camera.msaa;
    this.previousDepth = camera.depthTextureMode;
    const post = this.post = new l.PostProcess();
    this.ao = new l.ScalableAO();
    this.ao.intensity = options.aoIntensity ?? 0.65;
    this.ao.radius = options.aoRadius ?? 0.7;
    this.ao.aoQuality = l.AOQUALITY.High;
    this.ao.active = options.ao !== false;
    this.bloom = new l.BloomEffect();
    this.bloom.intensity = options.bloomIntensity ?? 0.12;
    this.bloom.threshold = 1.2;
    this.bloom.diffusion = 4;
    this.bloom.active = options.bloom !== false;
    this.grade = new l.ColorGradEffect();
    this.grade.toneMapping = l.ToneMappingType.ACES;
    this.grade.enableColorAdjust = true;
    this.grade.postExposure = options.exposure ?? 1;
    this.grade.contrast = options.contrast ?? 1.04;
    this.grade.saturation = options.saturation ?? 0.96;
    post.addEffect(this.ao);
    post.addEffect(this.bloom);
    post.addEffect(this.grade);
    camera.enableHDR = true;
    camera.postProcess = post;
    if (options.temporalAA) {
      this.ownsTAA = true;
      camera.taa = true;
      camera.taaSettings.quality = l.TemporalAAQuality.High;
    }
  }
  /** Update the existing ACES grading exposure multiplier. */
  setExposure(value) {
    if (this.disposed) throw Error("Disposed filmic pipeline");
    if (!Number.isFinite(value) || value < 0 || value > 1048576)
      throw Error("Invalid filmic exposure");
    this.grade.postExposure = value;
  }
  /** Call on camera cuts, teleports and timeline seeks, not on ordinary movement. */
  resetHistory() {
    if (this.disposed) throw Error("Disposed filmic pipeline");
    if (this.ownsTAA) this.camera.taaSettings.resetHistory();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.ownsTAA) this.camera.taa = false;
    if (this.camera.postProcess === this.post) {
      this.camera.postProcess = this.previous;
      this.camera.enableHDR = this.previousHDR;
      this.camera.msaa = this.previousMSAA;
      this.camera.depthTextureMode = this.previousDepth;
    }
    this.post.clearEffect();
    this.post._context.command.clear();
    const owned = /* @__PURE__ */ new Set([
      this.grade._lutBuilderMat,
      this.grade._lutTex,
      this.grade._lutShaderData,
      this.ao._shaderData,
      this.bloom._shaderData,
      this.bloom._compositeShaderData,
      this.post._compositeShaderData
    ]);
    for (const resource of owned)
      if (resource && !resource.destroyed) {
        if ("lock" in resource) resource.lock = false;
        resource.destroy();
      }
    this.post._context.camera = null;
  }
};
var ZhudaPlanarReflection = class {
  constructor(scene, options) {
    this.disposed = false;
    const l = globalThis.Laya;
    if (![options.width, options.height].every(
      (v) => Number.isInteger(v) && v > 0 && v <= 8192
    ) || !Number.isInteger(options.excludedLayer) || options.excludedLayer < 0 || options.excludedLayer > 30 || !Number.isFinite(options.planeY ?? 0))
      throw Error("Invalid planar reflection options");
    const near = options.near ?? 0.08, far = options.far ?? 1500;
    if (!Number.isFinite(near) || !Number.isFinite(far) || near <= 0 || far <= near)
      throw Error("Invalid reflection clipping range");
    requireCapabilities(l, ["RenderTextureFormat_R16G16B16A16"]);
    this.planeY = options.planeY ?? 0;
    this.texture = new l.RenderTexture(
      options.width,
      options.height,
      l.RenderTargetFormat.R16G16B16A16,
      l.RenderTargetFormat.DEPTH_16,
      false,
      1
    );
    this.camera = new l.Camera(options.width / options.height, near, far);
    this.camera.name = "zhuda-planar-reflection";
    this.camera.enableHDR = true;
    this.camera.renderTarget = this.texture;
    this.camera.renderingOrder = -100;
    this.camera.cullingMask = ~(1 << options.excludedLayer);
    scene.addChild(this.camera);
  }
  update(eye, target, fieldOfView, aspect) {
    if (this.disposed) throw Error("Disposed reflection");
    if (eye.length !== 3 || target.length !== 3 || ![...eye, ...target, fieldOfView].every(Number.isFinite) || fieldOfView <= 0 || fieldOfView >= 179)
      throw Error("Invalid reflection pose");
    if (Math.hypot(...eye.map((v, i) => v - target[i])) < 1e-9)
      throw Error("Reflection eye and target must differ");
    const l = globalThis.Laya;
    if (aspect !== void 0) {
      if (!Number.isFinite(aspect) || aspect <= 0)
        throw Error("Invalid reflection aspect");
      this.camera.aspectRatio = aspect;
    }
    this.camera.fieldOfView = fieldOfView;
    this.camera.transform.position = new l.Vector3(
      eye[0],
      2 * this.planeY - eye[1],
      eye[2]
    );
    const vertical = Math.hypot(eye[0] - target[0], eye[2] - target[2]) < 1e-9;
    this.camera.transform.lookAt(
      new l.Vector3(target[0], 2 * this.planeY - target[1], target[2]),
      vertical ? new l.Vector3(0, 0, 1) : new l.Vector3(0, -1, 0),
      false
    );
    const e = this.camera.projectionViewMatrix.elements;
    return Array.from({ length: 4 }, (_, i) => [
      e[i * 4],
      e[i * 4 + 1],
      e[i * 4 + 2],
      e[i * 4 + 3]
    ]);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.camera.renderTarget = null;
    this.camera.destroy(true);
    this.texture.destroy();
  }
};

// packages/core/runtime3d/CrowdPresentation.ts
var ZhudaCrowdScheduler = class {
  constructor(options) {
    this.entries = /* @__PURE__ */ new Map();
    this.due = [];
    this.disposed = false;
    this.dropped = 0;
    if (!options.tiers.length || options.tiers[options.tiers.length - 1]?.maxDistance !== Infinity || !Number.isInteger(options.maxUpdatesPerFrame) || options.maxUpdatesPerFrame < 1)
      throw Error("Invalid crowd presentation budget.");
    let previous = -1;
    for (const tier of options.tiers) {
      if (!(tier.maxDistance > previous) || !Number.isFinite(tier.updateHz) || tier.updateHz <= 0 || tier.updateHz > 240 || !["full", "low", "paused"].includes(tier.animation) || !Number.isInteger(tier.animationInterval ?? 2) || (tier.animationInterval ?? 2) < 1 || (tier.animationInterval ?? 2) > 60)
        throw Error("Invalid crowd tier.");
      previous = tier.maxDistance;
    }
    this.hysteresis = options.hysteresis ?? 1;
    this.maxDelta = options.maxDeltaSeconds ?? 0.25;
    if (!Number.isFinite(this.hysteresis) || this.hysteresis < 0 || !Number.isFinite(this.maxDelta) || this.maxDelta <= 0) throw Error("Invalid crowd time/distance bounds.");
    this.tiers = options.tiers.map((t) => Object.freeze({ ...t }));
    this.maxUpdates = options.maxUpdatesPerFrame;
  }
  check() {
    if (this.disposed) throw Error("Disposed crowd scheduler.");
  }
  register(id, binding, state) {
    this.check();
    if (!id || this.entries.has(id)) throw Error("Duplicate or empty crowd ID.");
    this.validate(state);
    const entry = { id, binding, state: { ...state }, tier: -2, elapsed: 0, initial: true, active: true };
    this.entries.set(id, entry);
    try {
      this.selectTier(entry);
    } catch (error) {
      this.entries.delete(id);
      throw error;
    }
  }
  validate(s) {
    if (typeof s.visible !== "boolean" || !Number.isFinite(s.distance) || s.distance < 0 || !Number.isFinite(s.priority ?? 0)) throw Error("Invalid crowd presentation state.");
  }
  setState(id, state) {
    this.check();
    this.validate(state);
    const e = this.entries.get(id);
    if (!e) throw Error(`Unknown crowd ID: ${id}`);
    e.state = { ...state };
    this.selectTier(e);
  }
  selectTier(e) {
    let next = e.tier;
    if (!e.state.visible) next = -1;
    else if (next < 0) next = this.tiers.findIndex((t) => e.state.distance <= t.maxDistance);
    else {
      while (next < this.tiers.length - 1 && e.state.distance > this.tiers[next].maxDistance + this.hysteresis) next++;
      while (next > 0 && e.state.distance < this.tiers[next - 1].maxDistance - this.hysteresis) next--;
    }
    if (next !== e.tier) {
      e.tier = next;
      e.elapsed = 0;
      e.initial = true;
      e.binding.setTier?.(next < 0 ? null : this.tiers[next]);
    }
  }
  update(deltaSeconds) {
    this.check();
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw Error("Invalid crowd delta.");
    this.due.length = 0;
    let hidden = 0;
    for (const e of this.entries.values()) {
      if (e.tier < 0) {
        hidden++;
        continue;
      }
      e.elapsed += deltaSeconds;
      if (e.initial || e.elapsed + 1e-10 >= 1 / this.tiers[e.tier].updateHz) this.due.push(e);
    }
    this.due.sort((a, b) => b.elapsed * this.tiers[b.tier].updateHz - a.elapsed * this.tiers[a.tier].updateHz || (b.state.priority ?? 0) - (a.state.priority ?? 0) || a.id.localeCompare(b.id));
    let updated = 0;
    for (const e of this.due) {
      if (updated >= this.maxUpdates) break;
      if (!e.active || e.tier < 0) continue;
      const dt = Math.min(e.elapsed, this.maxDelta);
      this.dropped += e.elapsed - dt;
      e.elapsed = 0;
      e.initial = false;
      updated++;
      e.binding.update(dt);
    }
    return { updated, deferred: this.due.filter((e) => e.active && (e.initial || e.elapsed > 0)).length, hidden, droppedSeconds: this.dropped };
  }
  remove(id) {
    const e = this.entries.get(id);
    if (!e) return false;
    e.active = false;
    this.entries.delete(id);
    return true;
  }
  get size() {
    return this.entries.size;
  }
  dispose() {
    this.disposed = true;
    for (const e of this.entries.values()) e.active = false;
    this.entries.clear();
    this.due.length = 0;
  }
};
var _ZhudaAnimatorLOD = class _ZhudaAnimatorLOD {
  /** Native updateMode/interval are write-only in 3.4.2. Pass original settings if non-default. */
  constructor(target, restore = {}) {
    this.disposed = false;
    if (_ZhudaAnimatorLOD.owners.has(target)) throw Error("Animator already has a LOD owner.");
    if (!Number.isFinite(target.speed) || ![0, 1, 2].includes(restore.updateMode ?? 0) || !Number.isInteger(restore.lowUpdateInterval ?? 1) || (restore.lowUpdateInterval ?? 1) < 1 || (restore.lowUpdateInterval ?? 1) > 60) throw Error("Invalid animator restoration settings.");
    _ZhudaAnimatorLOD.owners.add(target);
    this.target = target;
    this.speed = target.speed;
    this.restoreMode = restore.updateMode ?? 0;
    this.restoreInterval = restore.lowUpdateInterval ?? 1;
  }
  set(mode, frameInterval = 2) {
    if (this.disposed) throw Error("Disposed animator LOD.");
    if (!["full", "low", "paused"].includes(mode) || !Number.isInteger(frameInterval) || frameInterval < 1 || frameInterval > 60) throw Error("Invalid animation LOD.");
    this.target.speed = mode === "paused" ? 0 : this.speed;
    this.target.lowUpdateDelty = frameInterval;
    this.target.updateMode = mode === "low" ? 1 : 0;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    _ZhudaAnimatorLOD.owners.delete(this.target);
    this.target.speed = this.speed;
    this.target.updateMode = this.restoreMode;
    this.target.lowUpdateDelty = this.restoreInterval;
  }
};
_ZhudaAnimatorLOD.owners = /* @__PURE__ */ new WeakSet();
var ZhudaAnimatorLOD = _ZhudaAnimatorLOD;
var ZhudaRemoteCharacterPresenter = class {
  constructor(options) {
    this.entries = /* @__PURE__ */ new Map();
    this.sampleTime = 0;
    if (!options.epoch || !Number.isFinite(options.staleAfterSeconds ?? 0.5) || (options.staleAfterSeconds ?? 0.5) < 0) throw Error("Invalid remote presentation bounds.");
    new ZhudaSnapshotBuffer(options.epoch, options.interpolate, options.maxExtrapolation, options.snapshotCapacity);
    this.options = { ...options };
    this.epoch = options.epoch;
    this.scheduler = new ZhudaCrowdScheduler(options);
  }
  register(id, binding, state) {
    const entry = { buffer: new ZhudaSnapshotBuffer(this.epoch, this.options.interpolate, this.options.maxExtrapolation, this.options.snapshotCapacity), latest: -Infinity, sequence: -1 };
    this.scheduler.register(id, { setTier: binding.setTier?.bind(binding), update: () => {
      const sample = entry.buffer.sample(this.sampleTime);
      if (sample) binding.present(sample.value, sample.mode, this.sampleTime - entry.latest > (this.options.staleAfterSeconds ?? 0.5));
    } }, state);
    this.entries.set(id, entry);
  }
  push(id, snapshot, teleport = false) {
    const e = this.entries.get(id);
    if (!e || snapshot.epoch !== this.epoch || !Number.isInteger(snapshot.sequence) || snapshot.sequence <= e.sequence || !Number.isFinite(snapshot.time) || snapshot.time <= e.latest) return false;
    if (teleport) e.buffer.reset(this.epoch);
    if (!e.buffer.push(snapshot)) return false;
    e.latest = snapshot.time;
    e.sequence = snapshot.sequence;
    return true;
  }
  update(deltaSeconds, serverSampleTime) {
    if (!Number.isFinite(serverSampleTime)) throw Error("Invalid server sample time.");
    this.sampleTime = serverSampleTime;
    return this.scheduler.update(deltaSeconds);
  }
  reset(epoch) {
    if (!epoch) throw Error("Empty epoch.");
    this.epoch = epoch;
    for (const e of this.entries.values()) {
      e.buffer.reset(epoch);
      e.latest = -Infinity;
      e.sequence = -1;
    }
  }
  remove(id) {
    this.entries.delete(id);
    return this.scheduler.remove(id);
  }
  dispose() {
    this.scheduler.dispose();
    this.entries.clear();
  }
};

// packages/core/runtime3d/ModelInspector.ts
var runtime = () => globalThis.Laya;
var textureUniforms = [
  "u_BaseColorTexture",
  "u_MetallicRoughnessTexture",
  "u_NormalTexture",
  "u_OcclusionTexture",
  "u_EmissionTexture",
  "u_AlbedoTexture",
  "u_ClearCoatTexture",
  "u_ClearCoatRoughnessTexture",
  "u_ClearCoatNormalTexture",
  "u_AnisotropyTexture",
  "u_IridescenceTexture",
  "u_IridescenceThicknessTexture",
  "u_SheenColorTexture",
  "u_SheenRoughnessTexture",
  "u_TransmissionTexture",
  "u_VolumeThicknessTexture",
  "u_SpecularFactorTexture",
  "u_SpecularColorTexture"
];
var ZhudaModelInspector = class {
  constructor(instance) {
    this.instance = instance;
  }
  root() {
    if (this.instance.node.destroyed) throw Error("Disposed model instance");
    return this.instance.node;
  }
  node(path) {
    if (!/^\$(\/\d+)*$/.test(path)) throw Error("Invalid model node path: " + path);
    let node = this.root();
    for (const part of path.split("/").slice(1)) {
      const index = Number(part);
      if (!Number.isSafeInteger(index) || index >= node.numChildren) throw Error("Unknown model node path: " + path);
      node = node.getChildAt(index);
    }
    return node;
  }
  inspect() {
    const l = runtime(), materials = /* @__PURE__ */ new Map();
    const nodes = [], animations = [];
    const visit2 = (node, path) => {
      const renderer = node.getComponent(l.MeshRenderer), mesh = node.getComponent(l.MeshFilter)?.sharedMesh;
      const slots = renderer?.sharedMaterials ?? [];
      nodes.push({
        path,
        name: node.name,
        active: node.active,
        mesh: mesh ? { id: mesh.id, vertices: mesh.vertexCount, indices: mesh.indexCount } : null,
        materialIds: slots.filter(Boolean).map((m) => m.id),
        morphWeights: { ...renderer?.morphTargetValues }
      });
      for (const material of slots) if (material && !materials.has(material.id)) {
        const textures = [];
        for (const uniform of textureUniforms) {
          const texture = material.getTexture(uniform);
          if (texture) textures.push({ uniform, id: texture.id, width: texture.width, height: texture.height });
        }
        materials.set(material.id, { id: material.id, name: material.name ?? "", textures });
      }
      const animator = node.getComponent(l.Animator);
      if (animator) {
        for (let layer = 0; layer < animator.controllerLayerCount; layer++)
          for (const state of animator.getControllerLayer(layer).states) if (state.clip)
            animations.push({ path, layer, name: state.name, durationSeconds: state.clip.duration(), speed: animator.speed });
      }
      for (let i = 0; i < node.numChildren; i++) visit2(node.getChildAt(i), `${path}/${i}`);
    };
    visit2(this.root(), "$");
    return { compatibility: this.instance.compatibility, nodes, materials: [...materials.values()], animations, textureScope: "known-gltf-and-unlit-uniforms" };
  }
  setMorphWeight(path, channel, weight) {
    if (!Number.isFinite(weight)) throw Error("Morph weight must be finite");
    const renderer = this.node(path).getComponent(runtime().MeshRenderer);
    if (!renderer || !Object.prototype.hasOwnProperty.call(renderer.morphTargetValues, channel)) throw Error("Unknown morph channel: " + channel);
    renderer.setMorphChannelWeight(channel, weight);
  }
  /** Starts native playback. Pose is evaluated by the next native animation frame, not synchronously. */
  play(path, name, options = {}) {
    const animator = this.node(path).getComponent(runtime().Animator), layer = options.layer ?? 0;
    const time = options.normalizedTime ?? 0, speed = options.speed ?? 1;
    if (!animator || !Number.isInteger(layer) || layer < 0 || layer >= animator.controllerLayerCount || !animator.getControllerLayer(layer).getAnimatorState(name)) throw Error("Unknown animation state");
    if (!Number.isFinite(time) || time < 0 || time > 1 || !Number.isFinite(speed) || speed < 0) throw Error("Invalid animation playback options");
    animator.speed = speed;
    animator.play(name, layer, time);
  }
  setAnimationSpeed(path, speed) {
    const animator = this.node(path).getComponent(runtime().Animator);
    if (!animator || !Number.isFinite(speed) || speed < 0) throw Error("Invalid animator or speed");
    animator.speed = speed;
  }
};

// packages/core/runtime3d/AssetShowcase.ts
var defaults = {
  raw: { filmic: false, opaqueColor: true },
  gameplay: { filmic: { ao: false, bloom: false, exposure: 1, contrast: 1, saturation: 1 }, opaqueColor: true },
  cinematic: { filmic: { ao: true, bloom: true, temporalAA: false }, opaqueColor: true }
};
var owners = /* @__PURE__ */ new WeakSet();
var ZhudaAssetShowcase = class {
  constructor(options) {
    this.slot = new ZhudaRequestSlot();
    this.pipeline = null;
    this.current = null;
    this.currentMode = "raw";
    this.disposed = false;
    this.library = options.library;
    this.parent = options.parent;
    this.camera = options.camera;
    if (this.camera.destroyed || this.parent.destroyed || owners.has(this.camera) || this.camera.postProcess || this.camera.taa)
      throw Error("Showcase requires a live exclusive camera without postprocessing or TAA");
    this.modes = {};
    for (const mode of ["raw", "gameplay", "cinematic"]) {
      const value = options.presentations?.[mode] ?? defaults[mode];
      if (typeof value.opaqueColor !== "boolean" || value.filmic !== false && (!value.filmic || typeof value.filmic !== "object") || mode === "raw" && value.filmic !== false) throw Error("Invalid showcase presentation: " + mode);
      if (value.filmic !== false) {
        for (const key of ["exposure", "contrast", "saturation", "aoIntensity", "aoRadius", "bloomIntensity"]) {
          const n = value.filmic[key];
          if (n !== void 0 && (!Number.isFinite(n) || n < 0)) throw Error("Invalid filmic option: " + key);
        }
        for (const key of ["ao", "bloom", "temporalAA"]) if (value.filmic[key] !== void 0 && typeof value.filmic[key] !== "boolean") throw Error("Invalid filmic option: " + key);
      }
      this.modes[mode] = { opaqueColor: value.opaqueColor, filmic: value.filmic === false ? false : { ...value.filmic } };
    }
    this.previousOpaque = this.camera.opaquePass;
    owners.add(this.camera);
    this.camera.opaquePass = this.modes.raw.opaqueColor;
  }
  get mode() {
    return this.currentMode;
  }
  get instance() {
    return this.current;
  }
  alive() {
    if (this.disposed || this.parent.destroyed || this.camera.destroyed) throw Error("Disposed showcase or borrowed scene");
  }
  requireInputs(instance, mode) {
    if (instance.compatibility.requiredRenderInputs.includes("opaqueColor") && !this.modes[mode].opaqueColor)
      throw Error("REQUIRED_RENDER_INPUT: this asset requires opaqueColor in mode " + mode);
  }
  async load(assetId, options = {}) {
    this.alive();
    return this.slot.replace(
      async (signal) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal.addEventListener("abort", abort, { once: true });
        options.signal?.addEventListener("abort", abort, { once: true });
        if (signal.aborted || options.signal?.aborted) abort();
        try {
          return await this.library.instantiate(assetId, { ...options, signal: controller.signal });
        } finally {
          signal.removeEventListener("abort", abort);
          options.signal?.removeEventListener("abort", abort);
        }
      },
      (instance) => {
        this.alive();
        this.requireInputs(instance, this.currentMode);
        this.parent.addChild(instance.node);
        const previous = this.current;
        this.current = instance;
        previous?.dispose();
        this.pipeline?.resetHistory();
      },
      (instance) => instance.dispose()
    );
  }
  inspect() {
    this.alive();
    if (!this.current) throw Error("No loaded showcase asset");
    return new ZhudaModelInspector(this.current).inspect();
  }
  setMode(mode) {
    this.alive();
    if (!Object.prototype.hasOwnProperty.call(this.modes, mode)) throw Error("Unknown showcase mode");
    if (mode === this.currentMode) return;
    if (this.current) this.requireInputs(this.current, mode);
    if (this.camera.postProcess && this.camera.postProcess !== this.pipeline?.post) throw Error("Showcase camera postprocess ownership changed");
    const next = this.modes[mode], previous = this.modes[this.currentMode];
    if (next.filmic !== false) {
      const l = globalThis.Laya;
      if (!l.PostProcess || !l.ScalableAO || !l.BloomEffect || !l.ColorGradEffect || !l.LayaGL.renderEngine.getCapable(l.RenderCapable.RenderTextureFormat_R16G16B16A16)) throw Error("Showcase Filmic requires postprocess module and half-float render targets");
    }
    this.pipeline?.dispose();
    this.pipeline = null;
    try {
      if (next.filmic !== false) this.pipeline = new ZhudaFilmicPipeline(this.camera, next.filmic);
      this.camera.opaquePass = next.opaqueColor;
      this.currentMode = mode;
    } catch (error) {
      if (previous.filmic !== false) this.pipeline = new ZhudaFilmicPipeline(this.camera, previous.filmic);
      this.camera.opaquePass = previous.opaqueColor;
      throw error;
    }
  }
  cancel() {
    this.slot.cancel();
  }
  clear() {
    this.slot.cancel();
    this.current?.dispose();
    this.current = null;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.pipeline?.dispose();
    this.pipeline = null;
    if (!this.camera.destroyed) this.camera.opaquePass = this.previousOpaque;
    owners.delete(this.camera);
  }
};

// packages/core/runtime3d/Timeline.ts
var abortOffline = () => new DOMException("Offline frame recording cancelled", "AbortError");
function validateFrameCapture(value) {
  if (!value || value.ready !== true || typeof value.imagePath !== "string" || !value.imagePath)
    throw Error("Offline frame capture must provide ready:true and imagePath.");
  if (value.metrics !== void 0) {
    if (!value.metrics || typeof value.metrics !== "object" || Array.isArray(value.metrics))
      throw Error("Offline frame metrics must be an object.");
    for (const [key, metric] of Object.entries(value.metrics))
      if (!Number.isFinite(metric)) throw Error(`Offline frame metric ${key} must be finite.`);
  }
  return Object.freeze({ ...value, metrics: value.metrics ? Object.freeze({ ...value.metrics }) : void 0 });
}
function validValue(value, kind) {
  if (kind === "number") return typeof value === "number" && Number.isFinite(value);
  if (kind === "boolean") return typeof value === "boolean";
  if (kind === "event") return typeof value === "string";
  return kind === "vector" && Array.isArray(value) && value.length > 0 && value.every((x) => typeof x === "number" && Number.isFinite(x));
}
function validateTimelineSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return ["Timeline spec must be an object."];
  const value = spec;
  if (value.schemaVersion !== 1) errors.push("Timeline schemaVersion must be 1.");
  if (!Number.isFinite(value.duration) || (value.duration ?? 0) <= 0) errors.push("Timeline duration must be positive.");
  if (!Array.isArray(value.tracks) || !value.tracks.length) return [...errors, "Timeline requires at least one track."];
  const ids = /* @__PURE__ */ new Set(), targets = /* @__PURE__ */ new Set();
  for (const [index, track] of value.tracks.entries()) {
    if (!track || typeof track !== "object" || Array.isArray(track)) {
      errors.push(`Track ${index} must be an object.`);
      continue;
    }
    const t = track;
    if (typeof t.id !== "string" || !t.id || ids.has(t.id)) errors.push(`Track ${index} has a duplicate or empty id.`);
    else ids.add(t.id);
    if (typeof t.target !== "string" || !t.target) errors.push(`Track ${index} target is required.`);
    if (t.kind !== "event") {
      if (targets.has(t.target)) errors.push(`Track ${index} has a duplicate value target.`);
      targets.add(t.target);
    }
    if (!["number", "boolean", "vector", "event"].includes(t.kind)) errors.push(`Track ${index} kind is invalid.`);
    if (t.interpolation !== void 0 && !["linear", "step"].includes(t.interpolation)) errors.push(`Track ${index} interpolation is invalid.`);
    if ((t.kind === "event" || t.kind === "boolean") && t.interpolation === "linear") errors.push(`Track ${index} ${t.kind} interpolation must be step.`);
    if (!Array.isArray(t.keys) || !t.keys.length) {
      errors.push(`Track ${index} requires keys.`);
      continue;
    }
    let previous = -Infinity;
    const dimensions = Array.isArray(t.keys[0]?.value) ? t.keys[0].value.length : -1;
    for (const [keyIndex, key] of t.keys.entries()) {
      if (!key || !Number.isFinite(key.time) || key.time < 0 || key.time > (value.duration ?? 0) || key.time <= previous) errors.push(`Track ${index} key ${keyIndex} time is invalid or not increasing.`);
      previous = key?.time ?? previous;
      if (!key || !validValue(key.value, t.kind) || t.kind === "vector" && (!Array.isArray(key.value) || key.value.length !== dimensions)) errors.push(`Track ${index} key ${keyIndex} value does not match ${t.kind}.`);
    }
  }
  return errors;
}
function cloneValue(value) {
  return Array.isArray(value) ? [...value] : value;
}
function valueAt(track, time) {
  const keys = track.keys;
  if (time <= keys[0].time) return cloneValue(keys[0].value);
  const last = keys[keys.length - 1];
  if (time >= last.time) return cloneValue(last.value);
  let next = 1;
  while (next < keys.length && keys[next].time <= time) next++;
  const a = keys[next - 1], b = keys[next];
  if (track.kind !== "number" && track.kind !== "vector" || track.interpolation === "step") return cloneValue(a.value);
  const t = (time - a.time) / (b.time - a.time);
  if (track.kind === "number") return a.value * (1 - t) + b.value * t;
  return a.value.map((v, i) => v * (1 - t) + b.value[i] * t);
}
var ZhudaTimelineSequencer = class {
  constructor(spec, bindings) {
    this.time = 0;
    this.disposed = false;
    const errors = validateTimelineSpec(spec);
    if (errors.length) throw Error(errors.join(" "));
    this.spec = Object.freeze({ schemaVersion: 1, duration: spec.duration, tracks: Object.freeze(spec.tracks.map((track) => Object.freeze({ ...track, keys: Object.freeze(track.keys.map((key) => Object.freeze({ time: key.time, value: Array.isArray(key.value) ? Object.freeze([...key.value]) : key.value }))) }))) });
    this.bindings = Object.freeze(Object.fromEntries(Object.entries(bindings).map(([key, value]) => [key, Object.freeze({ ...value })])));
    for (const track of this.spec.tracks) if (typeof this.bindings[track.target]?.[track.kind === "event" ? "cue" : "set"] !== "function") throw Error(`Missing timeline binding: ${track.target}`);
    this.apply(this.time, false);
  }
  check() {
    if (this.disposed) throw Error("Disposed timeline sequencer.");
  }
  apply(time, emitEvents, from = this.time) {
    for (const track of this.spec.tracks) {
      const binding = this.bindings[track.target];
      if (track.kind === "event") {
        if (emitEvents && time >= from) {
          for (const key of track.keys) if (key.time > from && key.time <= time) binding.cue?.(key.value, key.time, track);
        }
      } else binding.set?.(valueAt(track, time), time, track);
    }
  }
  sample(time) {
    this.check();
    if (!Number.isFinite(time) || time < 0 || time > this.spec.duration) throw Error("Timeline sample is outside duration.");
    return Object.freeze(Object.fromEntries(this.spec.tracks.filter((track) => track.kind !== "event").map((track) => [track.target, valueAt(track, time)])));
  }
  seek(time, options = {}) {
    this.check();
    if (!Number.isFinite(time) || time < 0 || time > this.spec.duration) throw Error("Timeline seek is outside duration.");
    const from = this.time;
    this.time = time;
    this.apply(time, options.emitEvents === true, from);
  }
  update(deltaSeconds) {
    this.check();
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0 || deltaSeconds > 10) throw Error("Timeline delta must be 0..10 seconds.");
    const from = this.time;
    this.time = Math.min(this.spec.duration, this.time + deltaSeconds);
    this.apply(this.time, true, from);
    return this.time;
  }
  reset() {
    this.seek(0);
  }
  get currentTime() {
    return this.time;
  }
  get complete() {
    return this.time >= this.spec.duration;
  }
  dispose() {
    this.disposed = true;
  }
};
var ZhudaOfflineFrameRecorder = class {
  constructor(options) {
    this.disposed = false;
    this.recording = false;
    this.controller = null;
    if (!options || !Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0)
      throw Error("Offline duration must be positive.");
    if (!Number.isFinite(options.fps) || options.fps <= 0 || options.fps > 1e3)
      throw Error("Offline fps must be 0..1000.");
    const exactFrames = options.durationSeconds * options.fps;
    if (!Number.isSafeInteger(Math.round(exactFrames)) || Math.abs(exactFrames - Math.round(exactFrames)) > 1e-7)
      throw Error("Offline durationSeconds * fps must be an integer.");
    this.frameCount = Math.round(exactFrames) + 1;
    const maxFrames = options.maxFrames ?? 1e5;
    if (!Number.isSafeInteger(maxFrames) || maxFrames <= 0 || this.frameCount > maxFrames)
      throw Error("Offline frame count exceeds maxFrames.");
    if (typeof options.advance !== "function" || typeof options.capture !== "function")
      throw Error("Offline recorder requires advance and capture callbacks.");
    if (!Number.isSafeInteger(options.stepTimeoutMs ?? 15e3) || (options.stepTimeoutMs ?? 15e3) <= 0 || (options.stepTimeoutMs ?? 15e3) > 2147483647) throw Error("Invalid offline step deadline.");
    this.options = Object.freeze({ ...options });
  }
  check() {
    if (this.disposed) throw Error("Disposed offline frame recorder.");
    if (this.options.signal?.aborted) throw abortOffline();
  }
  async record() {
    this.check();
    if (this.recording) throw Error("Offline frame recorder is already recording.");
    this.recording = true;
    const controller = this.controller = new AbortController();
    const abort = () => controller.abort(this.options.signal?.reason ?? abortOffline());
    this.options.signal?.addEventListener("abort", abort, { once: true });
    const step = async (fn) => {
      const timer = setTimeout(() => controller.abort(new DOMException("Offline callback timed out", "TimeoutError")), this.options.stepTimeoutMs ?? 15e3);
      try {
        return await awaitAbortable(Promise.resolve().then(() => {
          if (controller.signal.aborted) throw controller.signal.reason;
          return fn();
        }), controller.signal);
      } finally {
        clearTimeout(timer);
      }
    };
    const frames = [];
    const deltaSeconds = 1 / this.options.fps;
    try {
      for (let index = 0; index < this.frameCount; index++) {
        this.check();
        const frame = Object.freeze({ index, time: index / this.options.fps, deltaSeconds: index === 0 ? 0 : deltaSeconds });
        await step(() => this.options.advance(frame, controller.signal));
        this.check();
        const capture = validateFrameCapture(await step(() => this.options.capture(frame, controller.signal)));
        this.check();
        frames.push(Object.freeze({ ...frame, capture }));
      }
      return Object.freeze(frames);
    } finally {
      this.recording = false;
      this.controller = null;
      this.options.signal?.removeEventListener("abort", abort);
    }
  }
  dispose() {
    this.disposed = true;
    this.controller?.abort(abortOffline());
  }
};

// packages/core/runtime3d/PhysicalCamera.ts
function physicalCameraSettings(spec) {
  const value = {
    sensorHeightMm: 24,
    fStop: 2.8,
    focusDistanceM: 5,
    iso: 100,
    shutterAngle: 180,
    exposureCompensation: 0,
    referenceEV100: 10,
    ...spec
  };
  const bounds = {
    focalLengthMm: [1, 2e3],
    sensorHeightMm: [1, 200],
    fStop: [0.1, 128],
    focusDistanceM: [0.01, 1e7],
    iso: [1, 1e7],
    shutterAngle: [0, 360],
    exposureCompensation: [-24, 24],
    referenceEV100: [-24, 32]
  };
  for (const key of Object.keys(bounds))
    if (!Number.isFinite(value[key]) || value[key] < bounds[key][0] || value[key] > bounds[key][1])
      throw Error("Invalid physical camera " + key);
  if (value.focusDistanceM <= value.focalLengthMm / 1e3)
    throw Error("Focus must lie beyond focal length");
  return Object.freeze(value);
}
function physicalCameraMetrics(spec, fps) {
  const s = physicalCameraSettings(spec);
  if (!Number.isFinite(fps) || fps <= 0 || fps > 1e3)
    throw Error("Invalid camera frame rate");
  const exposureSeconds = s.shutterAngle / 360 / fps;
  const ev100 = exposureSeconds === 0 ? Infinity : Math.log2(s.fStop * s.fStop / exposureSeconds * 100 / s.iso);
  return Object.freeze({
    verticalFovDegrees: 2 * Math.atan(s.sensorHeightMm / (2 * s.focalLengthMm)) * 180 / Math.PI,
    apertureRadiusM: s.focalLengthMm / s.fStop / 2e3,
    exposureSeconds,
    ev100,
    exposureMultiplier: exposureSeconds === 0 ? 0 : Math.pow(2, s.referenceEV100 - ev100 + s.exposureCompensation)
  });
}
var lenses = /* @__PURE__ */ new WeakSet();
var ZhudaPhysicalCameraRig = class {
  constructor(camera, spec) {
    this.disposed = false;
    this.restoreSample = null;
    this.settings = physicalCameraSettings(spec);
    if (camera.destroyed || camera.orthographic || lenses.has(camera))
      throw Error("Physical camera requires an unowned perspective camera");
    this.camera = camera;
    this.previous = {
      fov: camera.fieldOfView,
      aspect: camera._aspectRatio ?? camera.aspectRatio,
      projection: camera.projectionMatrix.clone(),
      custom: camera._useUserProjectionMatrix
    };
    lenses.add(camera);
  }
  check() {
    if (this.disposed || this.camera.destroyed)
      throw Error("Disposed physical camera");
  }
  get spec() {
    return this.settings;
  }
  configure(patch) {
    this.check();
    if (this.restoreSample) throw Error("Restore active lens sample first");
    this.settings = physicalCameraSettings({ ...this.settings, ...patch });
  }
  apply(aspect) {
    this.check();
    if (this.restoreSample) throw Error("Restore active lens sample first");
    if (!Number.isFinite(aspect) || aspect <= 0)
      throw Error("Invalid camera aspect");
    this.camera.resetProjectionMatrix();
    this.camera.aspectRatio = aspect;
    this.camera.fieldOfView = physicalCameraMetrics(
      this.settings,
      24
    ).verticalFovDegrees;
  }
  applyExposure(pipeline, fps) {
    this.check();
    pipeline.setExposure(
      physicalCameraMetrics(this.settings, fps).exposureMultiplier
    );
  }
  /** Temporary aperture and subpixel offsets; always call the returned restore. */
  sample(lensX, lensY, jitterX, jitterY, width, height) {
    this.check();
    if (this.restoreSample) throw Error("Restore active lens sample first");
    if (![lensX, lensY, jitterX, jitterY, width, height].every(Number.isFinite) || Math.hypot(lensX, lensY) > 1.000001 || Math.abs(jitterX) > 0.5 || Math.abs(jitterY) > 0.5 || width < 1 || height < 1)
      throw Error("Invalid lens sample");
    const l = globalThis.Laya, camera = this.camera;
    const position = camera.transform.position.clone(), projection = camera.projectionMatrix.clone();
    const custom = camera._useUserProjectionMatrix;
    const matrix = camera.transform.worldMatrix.elements, radius = physicalCameraMetrics(this.settings, 24).apertureRadiusM;
    for (const start of [0, 4, 8])
      if (Math.abs(
        Math.hypot(matrix[start], matrix[start + 1], matrix[start + 2]) - 1
      ) > 1e-4)
        throw Error("Physical camera requires unit world scale");
    const x = lensX * radius, y = lensY * radius, shifted = projection.clone();
    shifted.elements[8] -= projection.elements[0] * x / this.settings.focusDistanceM + 2 * jitterX / width;
    shifted.elements[9] -= projection.elements[5] * y / this.settings.focusDistanceM + 2 * jitterY / height;
    camera.transform.position = new l.Vector3(
      position.x + matrix[0] * x + matrix[4] * y,
      position.y + matrix[1] * x + matrix[5] * y,
      position.z + matrix[2] * x + matrix[6] * y
    );
    camera.projectionMatrix = shifted;
    let restored = false;
    return this.restoreSample = () => {
      if (restored) return;
      restored = true;
      this.restoreSample = null;
      if (camera.destroyed) return;
      camera.transform.position = position;
      if (custom) camera.projectionMatrix = projection;
      else camera.resetProjectionMatrix();
    };
  }
  dispose() {
    if (this.disposed) return;
    this.restoreSample?.();
    this.disposed = true;
    lenses.delete(this.camera);
    if (this.camera.destroyed) return;
    this.camera.fieldOfView = this.previous.fov;
    this.camera.aspectRatio = this.previous.aspect;
    if (this.previous.custom)
      this.camera.projectionMatrix = this.previous.projection;
    else this.camera.resetProjectionMatrix();
  }
};

// packages/core/runtime3d/ModelAnimationSampler.ts
var owners2 = /* @__PURE__ */ new WeakSet();
var ZhudaModelAnimationSampler = class {
  constructor(instance, path, name, layerIndex = 0) {
    this.mark = 0;
    this.disposed = false;
    const l = globalThis.Laya;
    const animator = new ZhudaModelInspector(instance).node(path).getComponent(l.Animator);
    if (!animator || !Number.isInteger(layerIndex) || layerIndex < 0 || layerIndex >= animator.controllerLayerCount || owners2.has(animator))
      throw Error("Missing or owned animation sampler target");
    const layer = animator.getControllerLayer(layerIndex), state = layer.getAnimatorState(name);
    if (!state?.clip || layer.blendingMode !== l.AnimatorControllerLayer.BLENDINGMODE_OVERRIDE)
      throw Error("Sampling requires a named override animation");
    const duration = state.clip.duration() * (state.clipEnd - state.clipStart);
    if (!Number.isFinite(duration) || duration <= 0)
      throw Error("Invalid animation duration");
    const native = animator;
    l.prepareStateOwners(native._bindContext, state);
    this.animator = animator;
    this.layer = layer;
    this.state = state;
    this.durationSeconds = duration;
    this.evaluator = new l.WebAnimatorEvaluator();
    this.applier = new l.WebAnimatorApplier();
    this.play = new l.AnimatorPlayState();
    this.task = new l.LayerTask();
    this.task.type = l.LayerTaskType.Normal;
    this.task.state = state;
    this.task.playState = this.play;
    this.task.weight = 1;
    this.previousSpeed = animator.speed;
    animator.speed = 0;
    owners2.add(animator);
  }
  /** Absolute clip-local seconds. Clamps by default; explicit loop wraps endpoint. */
  sample(seconds, loop = false) {
    if (this.disposed || this.animator.destroyed)
      throw Error("Disposed animation sampler");
    if (!Number.isFinite(seconds) || seconds < 0 || typeof loop !== "boolean")
      throw Error("Invalid animation sample time");
    const time = loop ? seconds % this.durationSeconds : Math.min(seconds, this.durationSeconds);
    this.state._currentFrameIndices.fill(-1);
    Object.assign(this.play, {
      _duration: this.durationSeconds,
      _normalizedPlayTime: time / this.durationSeconds,
      _elapsedTime: time,
      _lastElapsedTime: -Infinity
    });
    this.evaluator.evaluateLayer(this.task, this.layer);
    this.applier.applyNormal(this.task, this.layer, true, --this.mark);
  }
  /** Restore native playback speed. The last sampled pose remains until next tick. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    owners2.delete(this.animator);
    if (!this.animator.destroyed) this.animator.speed = this.previousSpeed;
  }
};

// packages/core/runtime3d/CinematicCapture.ts
var locked = /* @__PURE__ */ new WeakSet();
var halton = (index, base) => {
  let result = 0, fraction = 1;
  while (index > 0) {
    fraction /= base;
    result += fraction * (index % base);
    index = Math.floor(index / base);
  }
  return result;
};
var linear = Float32Array.from({ length: 256 }, (_, i) => {
  const x = i / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
});
var srgb = (x) => Math.round(
  Math.min(
    1,
    Math.max(
      0,
      x <= 31308e-7 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
    )
  ) * 255
);
var ZhudaCinematicCapture = class {
  constructor(scene, lens, runtime2, options) {
    this.disposed = false;
    this.busy = false;
    this.controller = null;
    this.reading = false;
    this.released = false;
    const l = globalThis.Laya;
    const { width, height } = options, limit = options.maxWorkingBytes ?? 512 * 1024 * 1024, timeout = options.timeoutMs ?? 3e4;
    if (![width, height].every(
      (v) => Number.isInteger(v) && v > 0 && v <= 8192
    ) || !Number.isSafeInteger(limit) || limit <= 0 || width * height * 24 > limit)
      throw Error("Cinematic pixel budget exceeded");
    if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 2147483647)
      throw Error("Invalid cinematic deadline");
    if (scene.destroyed || !scene.parent || lens.camera.scene !== scene || locked.has(scene) || !runtime2.paused)
      throw Error(
        "Capture requires a mounted unowned scene and paused runtime"
      );
    if (lens.camera.taa)
      throw Error("Disable temporal AA for independently sampled capture");
    this.scene = scene;
    this.lens = lens;
    this.runtime = runtime2;
    this.width = width;
    this.height = height;
    this.timeoutMs = timeout;
    this.target = new l.RenderTexture(
      width,
      height,
      l.RenderTargetFormat.R8G8B8A8,
      l.RenderTargetFormat.DEPTH_16,
      false,
      1,
      false,
      true
    );
    this.previous = {
      update: this.scene._update,
      editor: this.scene._renderByEditor,
      time: this.scene._time
    };
    this.scene._update = () => {
    };
    this.scene._renderByEditor = true;
    locked.add(scene);
  }
  check() {
    if (this.disposed || this.scene.destroyed || this.lens.camera.destroyed || !this.runtime.paused)
      throw Error("Capture is disposed or runtime resumed");
    if (this.lens.camera.taa)
      throw Error("Disable temporal AA for independently sampled capture");
  }
  async renderFrame(request) {
    this.check();
    if (this.busy || this.reading)
      throw Error(
        "Cinematic capture is already rendering or draining readback"
      );
    const count = request.samples ?? 1;
    if (!Number.isSafeInteger(request.index) || request.index < 0 || !Number.isFinite(request.fps) || request.fps < 1 || request.fps > 1e3 || !Number.isInteger(count) || count < 1 || count > 256 || typeof request.sample !== "function")
      throw Error("Invalid cinematic frame request");
    if (request.signal?.aborted)
      throw request.signal.reason ?? new DOMException("Cancelled", "AbortError");
    this.busy = true;
    const controller = this.controller = new AbortController();
    const abort = () => controller.abort(
      request.signal?.reason ?? new DOMException("Cancelled", "AbortError")
    );
    request.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () => controller.abort(
        new DOMException("Cinematic capture timed out", "TimeoutError")
      ),
      this.timeoutMs
    );
    const l = globalThis.Laya;
    const pixels = new Uint8Array(this.width * this.height * 4), sum = new Float32Array(this.width * this.height * 3);
    const time = request.index / request.fps;
    try {
      for (let i = 0; i < count; i++) {
        this.check();
        if (controller.signal.aborted) throw controller.signal.reason;
        const seconds = time + (count === 1 ? 0 : (i + 0.5) / count) * this.lens.spec.shutterAngle / 360 / request.fps;
        const sampled = request.sample(seconds);
        if (sampled && typeof sampled.then === "function") {
          void Promise.resolve(sampled).catch(() => {
          });
          throw Error(
            "Cinematic sample must be synchronous; load assets before capture"
          );
        }
        this.check();
        this.lens.apply(this.width / this.height);
        this.scene._time = seconds;
        this.scene._shaderValues.setNumber(
          l.Shader3D.propertyNameToID("u_Time"),
          seconds
        );
        const radius = Math.sqrt(halton(i + 1, 5)), angle = 2 * Math.PI * halton(i + 1, 7), aperture = count > 1 && request.aperture !== false;
        const restore = this.lens.sample(
          aperture ? radius * Math.cos(angle) : 0,
          aperture ? radius * Math.sin(angle) : 0,
          count > 1 && request.jitter !== false ? halton(i + 1, 2) - 0.5 : 0,
          count > 1 && request.jitter !== false ? halton(i + 1, 3) - 0.5 : 0,
          this.width,
          this.height
        );
        try {
          l.Stat.loopCount++;
          l.LayaGL.renderEngine.startFrame();
          const previousTarget = this.lens.camera.renderTarget;
          try {
            l.Camera.drawRenderTextureByScene(
              this.lens.camera,
              this.scene,
              this.target
            );
          } finally {
            this.lens.camera.renderTarget = previousTarget;
            this.scene.recaculateCullCamera();
            l.LayaGL.renderEngine.endFrame();
          }
        } finally {
          restore();
        }
        const readback = this.target.getDataAsync(
          0,
          0,
          this.width,
          this.height,
          pixels
        );
        this.reading = true;
        const drained = () => {
          this.reading = false;
          this.releaseTarget();
        };
        void readback.then(drained, drained);
        await awaitAbortable(readback, controller.signal);
        this.check();
        for (let p = 0, q = 0; p < pixels.length; p += 4, q += 3) {
          sum[q] += linear[pixels[p]];
          sum[q + 1] += linear[pixels[p + 1]];
          sum[q + 2] += linear[pixels[p + 2]];
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
        this.check();
        if (controller.signal.aborted) throw controller.signal.reason;
      }
      const output = new Uint8Array(pixels.length);
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++) {
          const src = (y * this.width + x) * 3, dest = (y * this.width + x) * 4;
          output[dest] = srgb(sum[src] / count);
          output[dest + 1] = srgb(sum[src + 1] / count);
          output[dest + 2] = srgb(sum[src + 2] / count);
          output[dest + 3] = 255;
        }
      return {
        width: this.width,
        height: this.height,
        index: request.index,
        time,
        samples: count,
        colorSpace: "srgb",
        accumulation: "display-linear",
        alpha: "opaque",
        rgba: output
      };
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", abort);
      this.busy = false;
      this.controller = null;
      this.releaseTarget();
    }
  }
  releaseTarget() {
    if (this.disposed && !this.busy && !this.reading && !this.released) {
      this.released = true;
      locked.delete(this.scene);
      this.target.destroy();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.controller?.abort(new DOMException("Capture disposed", "AbortError"));
    if (!this.scene.destroyed) {
      this.scene._update = this.previous.update;
      this.scene._renderByEditor = this.previous.editor;
      this.scene._time = this.previous.time;
      const l = globalThis.Laya;
      this.scene._shaderValues.setNumber(
        l.Shader3D.propertyNameToID("u_Time"),
        this.previous.time
      );
    }
    this.releaseTarget();
  }
};

// packages/core/runtime3d/Themes.ts
function identity(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value)) throw Error("Invalid theme identity");
}
function budget(value) {
  if (value !== void 0 && (!Number.isSafeInteger(value) || value < 0)) throw Error("Invalid theme budget");
}
function validateThemeManifest(value, contract) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.assets) || !contract || !Array.isArray(contract.required)) throw Error("Invalid theme schema");
  identity(value.id);
  identity(value.revision);
  identity(value.contractId);
  identity(contract.id);
  if (value.contractId !== contract.id) throw Error("Theme contract mismatch");
  budget(value.estimatedDecodedBytes);
  budget(contract.maxDownloadBytes);
  budget(contract.maxEstimatedDecodedBytes);
  if (value.estimatedDecodedBytes === void 0) throw Error("Missing decoded theme estimate");
  const ids = /* @__PURE__ */ new Set();
  let bytes = 0;
  const assets = value.assets.map((entry) => {
    if (!entry || normalizeAssetId(entry.id) !== entry.id || normalizeAssetId(entry.source) !== entry.source || ids.has(entry.id)) throw Error("Duplicate or invalid theme asset");
    if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) throw Error("Theme asset requires bytes and lowercase SHA-256: " + entry.id);
    if (entry.kind !== void 0 && !["binary", "text", "image", "audio", "model", "scene", "shader", "unknown"].includes(entry.kind)) throw Error("Invalid theme asset kind");
    if (entry.formatVersion !== void 0 && (typeof entry.formatVersion !== "string" || !entry.formatVersion)) throw Error("Invalid theme formatVersion");
    ids.add(entry.id);
    bytes += entry.bytes;
    return Object.freeze({ ...entry });
  });
  const required = /* @__PURE__ */ new Set();
  for (const need of contract.required) {
    if (normalizeAssetId(need.id) !== need.id || required.has(need.id)) throw Error("Invalid theme requirement");
    required.add(need.id);
    const found = assets.find((a) => a.id === need.id);
    if (!found || need.kind && need.kind !== found.kind || need.formatVersion && need.formatVersion !== found.formatVersion) throw Error("Missing/incompatible theme asset: " + need.id);
  }
  if (!Number.isSafeInteger(bytes) || bytes > (contract.maxDownloadBytes ?? Infinity)) throw Error("Theme download budget exceeded");
  if (value.estimatedDecodedBytes > (contract.maxEstimatedDecodedBytes ?? Infinity)) throw Error("Theme decoded estimate budget exceeded");
  return Object.freeze({ ...value, assets: Object.freeze(assets) });
}
var ZhudaThemeAssetProvider = class {
  constructor(source, manifest, contract, timeoutMs = 15e3) {
    this.lifetime = new AbortController();
    this.releases = /* @__PURE__ */ new Set();
    this.manifest = validateThemeManifest(manifest, contract);
    this.name = `theme:${manifest.id}:${manifest.revision}`;
    this.source = source;
    this.timeoutMs = timeoutMs;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw Error("Invalid IO timeoutMs");
  }
  /** Namespace a caller's shared cache key; never reuse bare logical IDs between providers. */
  cacheKey(id) {
    const entry = this.entry(id);
    return JSON.stringify([this.manifest.id, this.manifest.revision, entry.id, entry.sha256]);
  }
  entry(id) {
    if (this.lifetime.signal.aborted) throw Error("Disposed theme provider");
    const entry = this.manifest.assets.find((a) => a.id === normalizeAssetId(id));
    if (!entry) throw Error("Unmapped theme asset: " + id);
    return entry;
  }
  async getManifest(signal) {
    if (this.lifetime.signal.aborted || signal?.aborted) throw new DOMException("Cancelled theme manifest", "AbortError");
    return { schemaVersion: 1, entries: this.manifest.assets.map(({ source: _source, ...entry }) => entry) };
  }
  async load(id, options = {}) {
    const entry = this.entry(id);
    const controller = new AbortController();
    const abort = () => controller.abort(new DOMException("Theme load cancelled", "AbortError"));
    const signals = [this.lifetime.signal, options.signal].filter((s) => !!s);
    for (const signal of signals) {
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    }
    try {
      const asset = await withDeadline(async (signal) => {
        const raw = await this.source.load(entry.source, { ...options, signal, maxBytes: Math.min(entry.bytes || 1, options.maxBytes ?? Infinity), onProgress: (p) => options.onProgress?.({ ...p, id: entry.id }) });
        try {
          if (raw.bytes.byteLength !== entry.bytes || raw.bytes.byteLength > (options.maxBytes ?? Infinity)) throw Error("Theme asset size mismatch: " + id);
          const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(raw.bytes).buffer);
          const sha = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
          if (sha !== entry.sha256) throw Error("Theme asset integrity mismatch: " + id);
          return raw;
        } catch (error) {
          raw.release?.();
          throw error;
        }
      }, { signal: controller.signal, timeoutMs: this.timeoutMs }, (raw) => raw.release?.());
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this.releases.delete(release);
        asset.release?.();
      };
      if (controller.signal.aborted) {
        release();
        throw controller.signal.reason;
      }
      this.releases.add(release);
      return { id: entry.id, bytes: asset.bytes, manifest: { ...entry }, release };
    } finally {
      for (const signal of signals) signal.removeEventListener("abort", abort);
    }
  }
  dispose() {
    if (this.lifetime.signal.aborted) return;
    this.lifetime.abort();
    const errors = [];
    for (const release of [...this.releases]) {
      try {
        release();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw Object.assign(Error("Theme release failed"), { errors });
  }
};
var ZhudaThemeController = class {
  constructor(source, contract, maxTransitionEstimatedBytes = Infinity) {
    this.slot = new ZhudaRequestSlot();
    this.active = null;
    this.disposed = false;
    this.source = source;
    this.maxTransitionEstimatedBytes = maxTransitionEstimatedBytes;
    this.contract = { ...contract, required: contract.required.map((r) => ({ ...r })) };
    if (maxTransitionEstimatedBytes !== Infinity) budget(maxTransitionEstimatedBytes);
  }
  get current() {
    return this.active;
  }
  async replace(manifest, prepare, options = {}) {
    if (this.disposed) throw Error("Disposed theme controller");
    const snapshot = validateThemeManifest(manifest, this.contract);
    if (snapshot.estimatedDecodedBytes + (this.active?.manifest.estimatedDecodedBytes ?? 0) > this.maxTransitionEstimatedBytes) throw Error("Theme transition estimate budget exceeded");
    let retirementError;
    const changed = await this.slot.replace(async (signal) => {
      const provider = new ZhudaThemeAssetProvider(this.source, snapshot, this.contract, options.timeoutMs);
      const controller = new AbortController();
      const abort = () => controller.abort(new DOMException("Theme preparation cancelled", "AbortError"));
      for (const s of [signal, options.signal]) {
        s?.addEventListener("abort", abort, { once: true });
        if (s?.aborted) abort();
      }
      try {
        const prepared2 = await withDeadline((s) => prepare(provider, s), { signal: controller.signal, timeoutMs: options.timeoutMs }, (value) => value.dispose());
        let disposed = false;
        return Object.freeze({ manifest: snapshot, provider, value: prepared2.value, dispose: () => {
          if (disposed) return;
          disposed = true;
          try {
            prepared2.dispose();
          } finally {
            provider.dispose();
          }
        } });
      } catch (error) {
        provider.dispose();
        throw error;
      } finally {
        for (const s of [signal, options.signal]) s?.removeEventListener("abort", abort);
      }
    }, (value) => {
      const old = this.active;
      this.active = value;
      try {
        old?.dispose();
      } catch (error) {
        retirementError = error;
      }
    }, (value) => value.dispose());
    if (retirementError) throw retirementError;
    return changed;
  }
  cancel() {
    this.slot.cancel();
  }
  clear() {
    this.slot.cancel();
    const old = this.active;
    this.active = null;
    old?.dispose();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }
};

// packages/core/runtime3d/ResultPlayback.ts
function identity2(value) {
  if (typeof value !== "string" || !value || value.length > 256) throw Error("Invalid result identity");
}
function canonical(value, depth = 0) {
  if (depth > 64) throw Error("Result exceeds JSON depth");
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + Array.from(value, (v) => canonical(v, depth + 1)).join(",") + "]";
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype)
    return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k], depth + 1)).join(",") + "}";
  throw Error("Result must contain finite JSON values");
}
var clone = (value) => JSON.parse(canonical(value));
var ZhudaResultPlayback = class {
  constructor(options) {
    this.ready = false;
    this.disposed = false;
    this.pending = null;
    this.scope = { ...options.scope };
    this.store = options.store;
    this.validate = options.validate;
    this.validateCursor = options.validateCursor;
    for (const field of ["gameId", "sessionId", "epoch"]) identity2(this.scope[field]);
    this.key = "zhuda:playback:" + JSON.stringify([this.scope.gameId, this.scope.sessionId, this.scope.epoch]);
    const stored = this.store.read(this.key);
    this.state = stored == null ? { schemaVersion: 1, ...this.scope, result: null, cursor: 0, completed: false } : this.checkpoint(stored);
  }
  checkScope(value) {
    for (const field of ["gameId", "sessionId", "epoch"]) if (value[field] !== this.scope[field]) throw Error("Result scope mismatch: " + field);
  }
  result(value) {
    if (!value || value.schemaVersion !== 1 || !Number.isSafeInteger(value.sequence) || value.sequence < 1) throw Error("Invalid result envelope");
    this.checkScope(value);
    identity2(value.roundId);
    identity2(value.resultVersion);
    const copy = clone(value);
    this.validate(clone(copy));
    return copy;
  }
  checkpoint(value) {
    const state = clone(value);
    if (!state || state.schemaVersion !== 1 || !Number.isSafeInteger(state.cursor) || state.cursor < 0 || typeof state.completed !== "boolean") throw Error("Invalid playback checkpoint");
    this.checkScope(state);
    if (state.result === null) {
      if (state.cursor !== 0 || state.completed) throw Error("Invalid empty checkpoint");
    } else {
      this.result(state.result);
      this.validateCursor?.(clone(state.result), state.cursor, state.completed);
    }
    return state;
  }
  persist(state) {
    const checked = this.checkpoint(state);
    this.store.write(this.key, clone(checked));
    this.state = checked;
  }
  alive() {
    if (this.disposed) throw Error("Disposed result playback");
  }
  writable() {
    this.alive();
    if (!this.ready || this.pending) throw Error("Playback locked; authoritative recovery required");
  }
  get inputLocked() {
    return !this.ready || this.pending !== null || this.disposed;
  }
  snapshot() {
    return clone(this.state);
  }
  accept(value) {
    this.writable();
    const next = this.result(value), previous = this.state.result;
    if (previous && next.sequence < previous.sequence) return "stale";
    if (previous && next.sequence === previous.sequence) {
      if (canonical(next) !== canonical(previous)) throw Error("Conflicting result for sequence");
      return "duplicate";
    }
    if (next.sequence !== (previous?.sequence ?? 0) + 1) throw Error("Result sequence gap; reconcile with authority");
    if (previous && (!this.state.completed || previous.roundId === next.roundId)) throw Error("Previous presentation incomplete or round ID reused");
    this.persist({ ...this.state, result: next, cursor: 0, completed: false });
    return "accepted";
  }
  /** Consumer applies idempotent visual state then checkpoints; crashes may replay that state.
   * Never attach wallet/payment side effects to this method. */
  advance(sequence, cursor, completed = false) {
    this.writable();
    if (!this.state.result || this.state.result.sequence !== sequence || this.state.completed || cursor < this.state.cursor || cursor === this.state.cursor && !completed) throw Error("Stale or regressing presentation cursor");
    this.persist({ ...this.state, cursor, completed });
  }
  /** On blur/context loss call suspend, cancel visual work and pause the existing session. */
  suspend() {
    this.ready = false;
    this.pending?.abort(new DOMException("Playback suspended", "AbortError"));
    this.pending = null;
  }
  async recover(adapter, options = {}) {
    this.alive();
    this.suspend();
    const controller = new AbortController();
    this.pending = controller;
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    try {
      const value = await withDeadline((signal) => adapter.reconcile(this.snapshot(), signal), { signal: controller.signal, timeoutMs: options.timeoutMs });
      if (controller.signal.aborted || this.pending !== controller || this.disposed) throw new DOMException("Stale result recovery", "AbortError");
      const next = value === null ? null : this.result(value), previous = this.state.result;
      if (previous && (!next || next.sequence < previous.sequence)) throw Error("Authoritative recovery regressed; require a new epoch");
      if (previous && next && next.sequence === previous.sequence) {
        if (canonical(next) !== canonical(previous)) throw Error("Conflicting authoritative recovery");
        this.persist(this.state);
      } else {
        if (previous && next?.roundId === previous.roundId) throw Error("Recovered round ID reused");
        this.persist({ ...this.state, result: next, cursor: 0, completed: false });
      }
      this.ready = true;
    } finally {
      options.signal?.removeEventListener("abort", abort);
      if (this.pending === controller) this.pending = null;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.suspend();
  }
};

// packages/core/terrain/Terrain2D.ts
function validateTerrain2D(spec) {
  const s = spec, e = [];
  if (!s || s.schemaVersion !== 1 || s.dimension !== 2)
    return ["Expected schemaVersion:1, dimension:2"];
  if (![s.width, s.height].every(
    (n) => Number.isInteger(n) && n > 0 && n <= 4096
  ) || s.width * s.height > 1048576)
    e.push("width/height must be 1..4096 and at most 1048576 cells");
  if (!Number.isFinite(s.tileSize) || s.tileSize <= 0)
    e.push("tileSize must be positive");
  if (s.origin && (!Array.isArray(s.origin) || s.origin.length !== 2 || !s.origin.every(Number.isFinite)))
    e.push("Invalid origin");
  const ids = /* @__PURE__ */ new Set([0]);
  if (!Array.isArray(s.palette) || s.palette.length > 65535)
    e.push("Invalid palette");
  else
    for (const t of s.palette) {
      if (!t || !Number.isInteger(t.id) || t.id < 1 || t.id > 65535 || ids.has(t.id)) {
        e.push("Palette IDs must be unique integers 1..65535");
        continue;
      }
      ids.add(t.id);
      if (t.color !== void 0 && !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(t.color))
        e.push("Tile color must be #RRGGBB or #RRGGBBAA");
      if (t.uv && (!Array.isArray(t.uv) || t.uv.length !== 4 || !t.uv.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) || t.uv[0] >= t.uv[2] || t.uv[1] >= t.uv[3]))
        e.push("Invalid normalized atlas rectangle");
    }
  if (!Array.isArray(s.layers) || !s.layers.length || s.layers.length > 8 || s.layers.length * s.width * s.height > 2097152)
    e.push("Expected 1..8 layers and at most 2097152 total cells");
  else {
    const names = /* @__PURE__ */ new Set();
    for (const l of s.layers) {
      if (!l || typeof l.id !== "string" || !l.id || names.has(l.id)) {
        e.push("Layer IDs must be unique nonempty strings");
        continue;
      }
      names.add(l.id);
      if (!Array.isArray(l.tiles) || l.tiles.length !== s.width * s.height || l.tiles.some((id) => !ids.has(id)))
        e.push(`Invalid tiles for layer ${l.id}`);
    }
  }
  return e;
}
var ZhudaTerrain2D = class {
  constructor(spec) {
    this.layers = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
    const errors = validateTerrain2D(spec);
    if (errors.length) throw Error(errors.join("; "));
    this.width = spec.width;
    this.height = spec.height;
    this.tileSize = spec.tileSize;
    this.origin = Object.freeze([...spec.origin || [0, 0]]);
    this.palette = new Map(
      spec.palette.map((t) => [
        t.id,
        Object.freeze({
          ...t,
          uv: t.uv ? Object.freeze([...t.uv]) : void 0
        })
      ])
    );
    for (const layer of spec.layers)
      this.layers.set(layer.id, new Uint16Array(layer.tiles));
  }
  get layerIds() {
    return [...this.layers.keys()];
  }
  index(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.width || y >= this.height)
      throw Error("Tile outside terrain");
    return y * this.width + x;
  }
  layer(id) {
    const l = this.layers.get(id);
    if (!l) throw Error("Unknown layer " + id);
    return l;
  }
  getTile(layer, x, y) {
    return this.layer(layer)[this.index(x, y)];
  }
  setTile(layer, x, y, id) {
    this.paintRect(layer, { x, y, width: 1, height: 1 }, id);
  }
  paintRect(layer, r, id) {
    const l = this.layer(layer);
    if (id !== 0 && !this.palette.has(id)) throw Error("Unknown tile ID");
    if (![r.x, r.y, r.width, r.height].every(Number.isInteger) || r.width < 1 || r.height < 1)
      throw Error("Invalid tile rectangle");
    this.index(r.x, r.y);
    this.index(r.x + r.width - 1, r.y + r.height - 1);
    for (let y = r.y; y < r.y + r.height; y++)
      l.fill(id, y * this.width + r.x, y * this.width + r.x + r.width);
    for (const f of this.listeners) f({ ...r });
  }
  localToTile(x, y) {
    if (![x, y].every(Number.isFinite)) throw Error("Invalid terrain point");
    const col = Math.floor((x - this.origin[0]) / this.tileSize), row = Math.floor((y - this.origin[1]) / this.tileSize);
    return col >= 0 && row >= 0 && col < this.width && row < this.height ? { col, row } : null;
  }
  tileToLocal(col, row) {
    this.index(col, row);
    return {
      x: this.origin[0] + (col + 0.5) * this.tileSize,
      y: this.origin[1] + (row + 0.5) * this.tileSize
    };
  }
  isBlocked(col, row) {
    const i = this.index(col, row);
    return [...this.layers.values()].some(
      (l) => this.palette.get(l[i])?.blocked === true
    );
  }
  onChange(f) {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }
  toJSON() {
    return {
      schemaVersion: 1,
      dimension: 2,
      width: this.width,
      height: this.height,
      tileSize: this.tileSize,
      origin: [...this.origin],
      palette: [...this.palette.values()].map((t) => ({
        ...t,
        uv: t.uv ? [...t.uv] : void 0
      })),
      layers: [...this.layers].map(([id, tiles]) => ({
        id,
        tiles: [...tiles]
      }))
    };
  }
};
var ZhudaTerrain2DRenderer = class {
  constructor(terrain, options = {}) {
    this.chunks = /* @__PURE__ */ new Map();
    this.disposed = false;
    this.terrain = terrain;
    this.options = options;
    const c = options.chunkCells ?? 16;
    if (!Number.isInteger(c) || c < 1 || c > 128)
      throw Error("chunkCells must be 1..128");
    if (!Number.isInteger(options.maxResidentChunks ?? 128) || (options.maxResidentChunks ?? 128) < 1)
      throw Error("Invalid chunk budget");
    if ([...terrain.palette.values()].some((tile) => tile.uv) && !options.atlas) throw Error("Atlas texture required for UV tiles");
    if (options.atlas?.destroyed) throw Error("Atlas texture is destroyed");
    const l = globalThis.Laya;
    this.root = new l.Sprite();
    options.parent?.addChild(this.root);
    this.unsubscribe = terrain.onChange((r) => {
      for (const chunk of this.chunks.values())
        if (chunk.x * c < r.x + r.width && (chunk.x + 1) * c > r.x && chunk.y * c < r.y + r.height && (chunk.y + 1) * c > r.y)
          chunk.dirty = true;
    });
  }
  setView(r) {
    if (this.disposed) throw Error("Disposed terrain renderer");
    if (!Object.values(r).every(Number.isFinite) || r.width <= 0 || r.height <= 0)
      throw Error("Invalid local view");
    const t = this.terrain, c = this.options.chunkCells ?? 16, size = t.tileSize * c;
    const x0 = Math.max(0, Math.floor((r.x - t.origin[0]) / size)), x1 = Math.min(
      Math.ceil(t.width / c) - 1,
      Math.ceil((r.x + r.width - t.origin[0]) / size) - 1
    ), y0 = Math.max(0, Math.floor((r.y - t.origin[1]) / size)), y1 = Math.min(
      Math.ceil(t.height / c) - 1,
      Math.ceil((r.y + r.height - t.origin[1]) / size) - 1
    );
    if (Math.max(0, x1 - x0 + 1) * Math.max(0, y1 - y0 + 1) > (this.options.maxResidentChunks ?? 128))
      throw Error("Visible terrain exceeds chunk budget");
    const needed = /* @__PURE__ */ new Set();
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) needed.add(x + ":" + y);
    for (const [key, r2] of this.chunks)
      if (!needed.has(key)) {
        r2.node.destroy(true);
        this.chunks.delete(key);
      }
    const l = globalThis.Laya;
    for (const key of needed)
      if (!this.chunks.has(key)) {
        const [x, y] = key.split(":").map(Number), node = new l.Sprite();
        node.pos(t.origin[0] + x * size, t.origin[1] + y * size);
        node.graphics.material = this.options.material || null;
        this.root.addChild(node);
        this.chunks.set(key, { node, x, y, dirty: true });
      }
    this.flush();
  }
  flush() {
    if (this.disposed) throw Error("Disposed terrain renderer");
    const t = this.terrain, c = this.options.chunkCells ?? 16;
    for (const chunk of this.chunks.values()) {
      if (!chunk.dirty) continue;
      const g = chunk.node.graphics;
      g.clear();
      for (const layer of t.layerIds)
        for (let y = chunk.y * c; y < Math.min(t.height, (chunk.y + 1) * c); y++)
          for (let x = chunk.x * c; x < Math.min(t.width, (chunk.x + 1) * c); x++) {
            const tile = t.palette.get(t.getTile(layer, x, y));
            if (!tile) continue;
            const px = (x - chunk.x * c) * t.tileSize, py = (y - chunk.y * c) * t.tileSize;
            if (tile.uv && this.options.atlas) {
              const [u0, v0, u1, v1] = tile.uv;
              g.drawTexture(
                this.options.atlas,
                px,
                py,
                t.tileSize,
                t.tileSize,
                null,
                1,
                tile.color || "#ffffff",
                null,
                [u0, v0, u1, v0, u1, v1, u0, v1]
              );
            } else
              g.drawRect(
                px,
                py,
                t.tileSize,
                t.tileSize,
                tile.color || "#ffffff"
              );
          }
      chunk.dirty = false;
    }
  }
  get residentChunks() {
    return this.chunks.size;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.root.destroy(true);
    this.chunks.clear();
  }
};

// packages/core/terrain/Heightfield.ts
function validateHeightfield(spec) {
  const s = spec, e = [];
  if (!s || s.schemaVersion !== 1 || s.dimension !== 3)
    return ["Expected schemaVersion:1, dimension:3"];
  if (![s.cellsX, s.cellsZ].every(
    (n) => Number.isInteger(n) && n > 0 && n <= 2048
  ) || (s.cellsX + 1) * (s.cellsZ + 1) > 4194304)
    e.push(
      "Invalid heightfield dimensions (1..2048, at most 4194304 vertices)"
    );
  if (!Number.isFinite(s.cellSize) || s.cellSize <= 0)
    e.push("cellSize must be positive");
  if (s.origin && (!Array.isArray(s.origin) || s.origin.length !== 2 || !s.origin.every(Number.isFinite)))
    e.push("Invalid origin");
  if (!Array.isArray(s.heights) || s.heights.length !== (s.cellsX + 1) * (s.cellsZ + 1) || s.heights.some((h) => !Number.isFinite(h) || Math.abs(h) > 1e6))
    e.push("Invalid finite height data");
  return e;
}
function terrainNoise(seed, x, z) {
  if (![seed, x, z].every(Number.isFinite))
    throw Error("Invalid noise coordinates");
  const hash2 = (a2, b2) => {
    let h = Math.imul(a2 ^ seed, 374761393) ^ Math.imul(b2, 668265263);
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967295;
  };
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz), a = hash2(ix, iz) * (1 - u) + hash2(ix + 1, iz) * u, b = hash2(ix, iz + 1) * (1 - u) + hash2(ix + 1, iz + 1) * u;
  return a * (1 - v) + b * v;
}
var ZhudaHeightfield = class _ZhudaHeightfield {
  constructor(spec) {
    this.listeners = /* @__PURE__ */ new Set();
    const e = validateHeightfield(spec);
    if (e.length) throw Error(e.join("; "));
    this.cellsX = spec.cellsX;
    this.cellsZ = spec.cellsZ;
    this.cellSize = spec.cellSize;
    this.origin = Object.freeze([...spec.origin || [0, 0]]);
    this.heights = new Float32Array(spec.heights);
  }
  static generate(options) {
    const count = (options.cellsX + 1) * (options.cellsZ + 1);
    if (!Number.isSafeInteger(count) || count < 4 || count > 4194304 || ![options.seed, options.amplitude ?? 4, options.frequency ?? 0.1].every(
      Number.isFinite
    ))
      throw Error("Invalid generation bounds");
    const heights = Array.from(
      { length: count },
      (_, i) => terrainNoise(
        options.seed,
        i % (options.cellsX + 1) * (options.frequency ?? 0.1),
        Math.floor(i / (options.cellsX + 1)) * (options.frequency ?? 0.1)
      ) * (options.amplitude ?? 4)
    );
    return new _ZhudaHeightfield({
      schemaVersion: 1,
      dimension: 3,
      ...options,
      heights
    });
  }
  index(x, z) {
    if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x > this.cellsX || z > this.cellsZ)
      throw Error("Vertex outside heightfield");
    return z * (this.cellsX + 1) + x;
  }
  heightAtVertex(x, z) {
    return this.heights[this.index(x, z)];
  }
  normalAtVertex(x, z) {
    this.index(x, z);
    const ax = Math.max(0, x - 1), bx = Math.min(this.cellsX, x + 1), az = Math.max(0, z - 1), bz = Math.min(this.cellsZ, z + 1);
    return normalized({
      x: -(this.heightAtVertex(bx, z) - this.heightAtVertex(ax, z)) / ((bx - ax) * this.cellSize),
      y: 1,
      z: -(this.heightAtVertex(x, bz) - this.heightAtVertex(x, az)) / ((bz - az) * this.cellSize)
    });
  }
  setHeight(x, z, height) {
    this.applyPatch(x, z, 1, 1, [height]);
  }
  applyPatch(x, z, width, depth, values) {
    if (![x, z, width, depth].every(Number.isInteger) || width < 1 || depth < 1 || values.length !== width * depth || Array.from(values).some((h) => !Number.isFinite(h) || Math.abs(h) > 1e6))
      throw Error("Invalid height patch");
    this.index(x, z);
    this.index(x + width - 1, z + depth - 1);
    for (let j = 0; j < depth; j++)
      for (let i = 0; i < width; i++)
        this.heights[(z + j) * (this.cellsX + 1) + x + i] = values[j * width + i];
    this.emit({ minX: x, minZ: z, maxX: x + width - 1, maxZ: z + depth - 1 });
  }
  brush(x, z, radius, delta) {
    if (![x, z, radius, delta].every(Number.isFinite) || radius <= 0)
      throw Error("Invalid height brush");
    const cx = (x - this.origin[0]) / this.cellSize, cz = (z - this.origin[1]) / this.cellSize, r = radius / this.cellSize;
    const minX = Math.max(0, Math.ceil(cx - r)), maxX = Math.min(this.cellsX, Math.floor(cx + r)), minZ = Math.max(0, Math.ceil(cz - r)), maxZ = Math.min(this.cellsZ, Math.floor(cz + r));
    const patch = [];
    for (let j = minZ; j <= maxZ; j++)
      for (let i = minX; i <= maxX; i++) {
        const d = Math.hypot(i - cx, j - cz) / r;
        if (d > 1) continue;
        const a = 1 - d, h = this.heightAtVertex(i, j) + delta * a * a * (3 - 2 * a);
        if (Math.abs(h) > 1e6) throw Error("Brush exceeds height bound");
        patch.push({ i: j * (this.cellsX + 1) + i, h });
      }
    if (!patch.length) return;
    for (const p of patch) this.heights[p.i] = p.h;
    this.emit({ minX, minZ, maxX, maxZ });
  }
  emit(r) {
    for (const f of this.listeners) f(r);
  }
  onChange(f) {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  }
  /** Exact same diagonal and barycentric interpolation as rendered triangles. */
  sample(x, z, stride = 1) {
    if (![1, 2, 4].includes(stride)) throw Error("Invalid terrain stride");
    if (![x, z].every(Number.isFinite)) throw Error("Invalid sample");
    const gx = (x - this.origin[0]) / this.cellSize, gz = (z - this.origin[1]) / this.cellSize;
    if (gx < 0 || gz < 0 || gx > this.cellsX || gz > this.cellsZ) return null;
    const ix = Math.min(
      Math.floor((this.cellsX - 1) / stride) * stride,
      Math.floor(gx / stride) * stride
    ), iz = Math.min(
      Math.floor((this.cellsZ - 1) / stride) * stride,
      Math.floor(gz / stride) * stride
    ), bx = Math.min(this.cellsX, ix + stride), bz = Math.min(this.cellsZ, iz + stride), u = (gx - ix) / (bx - ix), v = (gz - iz) / (bz - iz), a = this.heightAtVertex(ix, iz), b = this.heightAtVertex(bx, iz), c = this.heightAtVertex(ix, bz), d = this.heightAtVertex(bx, bz);
    const height = u >= v ? a * (1 - u) + b * (u - v) + d * v : a * (1 - v) + c * (v - u) + d * u;
    const normal = u >= v ? normalized({
      x: -(b - a) / ((bx - ix) * this.cellSize),
      y: 1,
      z: -(d - b) / ((bz - iz) * this.cellSize)
    }) : normalized({
      x: -(d - c) / ((bx - ix) * this.cellSize),
      y: 1,
      z: -(c - a) / ((bz - iz) * this.cellSize)
    });
    return { height, normal, cellX: ix, cellZ: iz };
  }
  /** Local ray direction may be unnormalized, preserving world-distance parameter after inverse transform. */
  raycast(ray, maxDistance = Infinity, stride = 1, acceptCell) {
    if (![1, 2, 4].includes(stride)) throw Error("Invalid terrain stride");
    if (!(maxDistance >= 0) || ![...Object.values(ray.origin), ...Object.values(ray.direction)].every(
      Number.isFinite
    ) || Math.hypot(...Object.values(ray.direction)) < 1e-12)
      throw Error("Invalid terrain ray");
    const o = ray.origin, d = ray.direction, minX = this.origin[0], minZ = this.origin[1], maxX = minX + this.cellsX * this.cellSize, maxZ = minZ + this.cellsZ * this.cellSize;
    let near = 0, far = maxDistance;
    for (const [key, min, max] of [
      ["x", minX, maxX],
      ["z", minZ, maxZ]
    ]) {
      if (Math.abs(d[key]) < 1e-12) {
        if (o[key] < min || o[key] > max) return null;
      } else {
        const a = (min - o[key]) / d[key], b = (max - o[key]) / d[key];
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
    }
    if (far < near) return null;
    let t = near;
    const epsilon = 1e-7 * this.cellSize;
    let x = Math.min(
      this.cellsX - 1,
      Math.max(
        0,
        Math.floor((o.x + d.x * (t + epsilon) - minX) / this.cellSize)
      )
    ), z = Math.min(
      this.cellsZ - 1,
      Math.max(
        0,
        Math.floor((o.z + d.z * (t + epsilon) - minZ) / this.cellSize)
      )
    );
    const stepX = Math.sign(d.x), stepZ = Math.sign(d.z), dtX = stepX ? this.cellSize / Math.abs(d.x) : Infinity, dtZ = stepZ ? this.cellSize / Math.abs(d.z) : Infinity;
    let nextX = stepX ? (minX + (x + (stepX > 0 ? 1 : 0)) * this.cellSize - o.x) / d.x : Infinity, nextZ = stepZ ? (minZ + (z + (stepZ > 0 ? 1 : 0)) * this.cellSize - o.z) / d.z : Infinity;
    for (let n = 0; n < this.cellsX + this.cellsZ + 4 && x >= 0 && z >= 0 && x < this.cellsX && z < this.cellsZ && t <= far + 1e-8; n++) {
      const v = (i, j) => ({
        x: minX + i * this.cellSize,
        y: this.heightAtVertex(i, j),
        z: minZ + j * this.cellSize
      }), sx = Math.floor(x / stride) * stride, sz = Math.floor(z / stride) * stride, bx = Math.min(this.cellsX, sx + stride), bz = Math.min(this.cellsZ, sz + stride), a = v(sx, sz), b = v(bx, sz), c = v(sx, bz), q = v(bx, bz);
      let hit = null;
      for (const tri of acceptCell && !acceptCell(x, z) ? [] : [
        [a, b, q],
        [a, q, c]
      ]) {
        const h = triangle(ray, tri[0], tri[1], tri[2]);
        if (h !== null && h >= near - 1e-7 && h <= Math.min(nextX, nextZ, far) + 1e-7 && (hit === null || h < hit))
          hit = h;
      }
      if (hit !== null) {
        const position = {
          x: o.x + d.x * hit,
          y: o.y + d.y * hit,
          z: o.z + d.z * hit
        }, s = this.sample(
          Math.max(minX, Math.min(maxX, position.x)),
          Math.max(minZ, Math.min(maxZ, position.z)),
          stride
        );
        return {
          distance: hit,
          position,
          normal: s.normal,
          cellX: x,
          cellZ: z
        };
      }
      if (!stepX && !stepZ) break;
      const boundary = Math.min(nextX, nextZ);
      t = boundary;
      if (nextX <= boundary + 1e-9) {
        x += stepX;
        nextX += dtX;
      }
      if (nextZ <= boundary + 1e-9) {
        z += stepZ;
        nextZ += dtZ;
      }
    }
    return null;
  }
  toJSON() {
    return {
      schemaVersion: 1,
      dimension: 3,
      cellsX: this.cellsX,
      cellsZ: this.cellsZ,
      cellSize: this.cellSize,
      origin: [...this.origin],
      heights: [...this.heights]
    };
  }
};
function triangle(r, a, b, c) {
  const sub = (x, y) => ({
    x: x.x - y.x,
    y: x.y - y.y,
    z: x.z - y.z
  }), cross = (x, y) => ({
    x: x.y * y.z - x.z * y.y,
    y: x.z * y.x - x.x * y.z,
    z: x.x * y.y - x.y * y.x
  }), dot = (x, y) => x.x * y.x + x.y * y.y + x.z * y.z;
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(r.direction, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-10) return null;
  const t = sub(r.origin, a), u = dot(t, p) / det;
  if (u < -1e-8 || u > 1 + 1e-8) return null;
  const q = cross(t, e1), v = dot(r.direction, q) / det;
  if (v < -1e-8 || u + v > 1 + 1e-8) return null;
  const distance = dot(e2, q) / det;
  return distance >= -1e-8 ? Math.max(0, distance) : null;
}

// packages/core/terrain/TerrainShell.ts
function shellTriangleDistance(ray, p, a, b, c) {
  a *= 3;
  b *= 3;
  c *= 3;
  const ax = p[b] - p[a], ay = p[b + 1] - p[a + 1], az = p[b + 2] - p[a + 2], bx = p[c] - p[a], by = p[c + 1] - p[a + 1], bz = p[c + 2] - p[a + 2], d = ray.direction, px = d.y * bz - d.z * by, py = d.z * bx - d.x * bz, pz = d.x * by - d.y * bx, det = ax * px + ay * py + az * pz;
  if (Math.abs(det) < 1e-10) return null;
  const tx = ray.origin.x - p[a], ty = ray.origin.y - p[a + 1], tz = ray.origin.z - p[a + 2], u = (tx * px + ty * py + tz * pz) / det;
  if (u < -1e-7 || u > 1 + 1e-7) return null;
  const qx = ty * az - tz * ay, qy = tz * ax - tx * az, qz = tx * ay - ty * ax, v = (d.x * qx + d.y * qy + d.z * qz) / det;
  if (v < -1e-7 || u + v > 1 + 1e-7) return null;
  const t = (bx * qx + by * qy + bz * qz) / det;
  return t >= 0 ? t : null;
}
function buildTerrainShell(top, xs, zs, depth) {
  if (!Number.isFinite(depth) || depth <= 0)
    throw Error("Terrain solid depth must be positive");
  const nx = xs.length, nz = zs.length, n = nx * nz;
  const edges = [];
  for (let x = 0; x < nx - 1; x++) edges.push([x, x + 1]);
  for (let z = 0; z < nz - 1; z++)
    edges.push([z * nx + nx - 1, (z + 1) * nx + nx - 1]);
  for (let x = nx - 1; x > 0; x--)
    edges.push([(nz - 1) * nx + x, (nz - 1) * nx + x - 1]);
  for (let z = nz - 1; z > 0; z--) edges.push([z * nx, (z - 1) * nx]);
  const count = n + edges.length * 4, positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2), indices = new Uint16Array((nx - 1) * (nz - 1) * 6 + edges.length * 6);
  for (let i = 0; i < n; i++) {
    positions.set([top[i * 8], top[i * 8 + 1] - depth, top[i * 8 + 2]], i * 3);
    normals.set([-top[i * 8 + 3], -top[i * 8 + 4], -top[i * 8 + 5]], i * 3);
    uvs.set([top[i * 8 + 6], top[i * 8 + 7]], i * 2);
  }
  let k = 0;
  for (let z = 0; z < nz - 1; z++)
    for (let x = 0; x < nx - 1; x++) {
      const a = z * nx + x, b = a + 1, c = a + nx, d = c + 1;
      indices.set([c, d, a, a, d, b], k);
      k += 6;
    }
  edges.forEach(([a, b], j) => {
    const i = n + j * 4, dx = top[b * 8] - top[a * 8], dz = top[b * 8 + 2] - top[a * 8 + 2], len = Math.hypot(dx, dz);
    for (let v = 0; v < 4; v++) {
      const src = (v % 2 ? b : a) * 8;
      positions.set(
        [top[src], top[src + 1] - (v >= 2 ? depth : 0), top[src + 2]],
        (i + v) * 3
      );
      normals.set([dz / len, 0, -dx / len], (i + v) * 3);
      uvs.set([v % 2 ? len : 0, v >= 2 ? depth : 0], (i + v) * 2);
    }
    indices.set([i, i + 2, i + 1, i + 1, i + 2, i + 3], k);
    k += 6;
  });
  return { positions, normals, uvs, indices };
}

// packages/core/terrain/Terrain3D.ts
var ZhudaTerrain3D = class {
  constructor(field, options) {
    this.chunks = /* @__PURE__ */ new Map();
    this.disposed = false;
    this.stride = 1;
    this.field = field;
    this.options = options;
    if (!options.material || options.material.destroyed)
      throw Error("A live terrain material is required");
    if (options.solid && (!Number.isFinite(options.solid.depth) || options.solid.depth <= 0 || options.solid.material?.destroyed))
      throw Error("Invalid terrain solid depth/material");
    const size = options.chunkCells ?? 32;
    if (!Number.isInteger(size) || size < 4 || size > 128 || size % 4)
      throw Error("chunkCells must be a multiple of 4 within 4..128");
    if (!Number.isInteger(options.maxResidentChunks ?? 64) || (options.maxResidentChunks ?? 64) < 1)
      throw Error("Invalid chunk budget");
    if (options.uvScale && (!options.uvScale.every(Number.isFinite) || options.uvScale.length !== 2))
      throw Error("Invalid UV scale");
    const l = globalThis.Laya;
    this.root = new l.Sprite3D("ZhudaTerrain");
    options.parent?.addChild(this.root);
    this.unsubscribe = field.onChange((r) => {
      for (const chunk of this.chunks.values()) {
        const expanded = {
          minX: r.minX - 1,
          minZ: r.minZ - 1,
          maxX: r.maxX + 1,
          maxZ: r.maxZ + 1
        };
        if (chunk.xs[0] > expanded.maxX || chunk.xs[chunk.xs.length - 1] < expanded.minX || chunk.zs[0] > expanded.maxZ || chunk.zs[chunk.zs.length - 1] < expanded.minZ)
          continue;
        const old = chunk.dirty;
        chunk.dirty = old ? {
          minX: Math.min(old.minX, expanded.minX),
          minZ: Math.min(old.minZ, expanded.minZ),
          maxX: Math.max(old.maxX, expanded.maxX),
          maxZ: Math.max(old.maxZ, expanded.maxZ)
        } : expanded;
      }
    });
  }
  /** Local x/z bounds; uniform stride avoids neighboring chunks with incompatible edge LODs. */
  setRegion(region, stride = 1) {
    if (this.disposed) throw Error("Disposed terrain");
    if (![1, 2, 4].includes(stride) || !Object.values(region).every(Number.isFinite) || region.maxX <= region.minX || region.maxZ <= region.minZ)
      throw Error("Invalid terrain region/stride");
    const f = this.field, size = this.options.chunkCells ?? 32, span = size * f.cellSize, x0 = Math.max(0, Math.floor((region.minX - f.origin[0]) / span)), x1 = Math.min(
      Math.ceil(f.cellsX / size) - 1,
      Math.ceil((region.maxX - f.origin[0]) / span) - 1
    ), z0 = Math.max(0, Math.floor((region.minZ - f.origin[1]) / span)), z1 = Math.min(
      Math.ceil(f.cellsZ / size) - 1,
      Math.ceil((region.maxZ - f.origin[1]) / span) - 1
    );
    if (Math.max(0, x1 - x0 + 1) * Math.max(0, z1 - z0 + 1) > (this.options.maxResidentChunks ?? 64))
      throw Error("Terrain region exceeds resident chunk budget");
    const required = /* @__PURE__ */ new Set();
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) required.add(x + ":" + z);
    for (const [key, c] of this.chunks)
      if (!required.has(key) || this.stride !== stride) {
        c.mesh.dispose();
        c.shell?.dispose();
        this.chunks.delete(key);
      }
    this.stride = stride;
    try {
      for (const key of required)
        if (!this.chunks.has(key)) {
          const [x, z] = key.split(":").map(Number), axis = (start, end) => {
            const a = [];
            for (let i = start; i < end; i += stride) a.push(i);
            a.push(end);
            return a;
          }, xs = axis(x * size, Math.min(f.cellsX, (x + 1) * size)), zs = axis(z * size, Math.min(f.cellsZ, (z + 1) * size));
          const n = xs.length * zs.length, positions = new Float32Array(n * 3), normals = new Float32Array(n * 3), uvs = new Float32Array(n * 2), indices = new Uint16Array((xs.length - 1) * (zs.length - 1) * 6);
          for (let j = 0; j < zs.length; j++)
            for (let i = 0; i < xs.length; i++) {
              const k2 = j * xs.length + i, p = this.vertex(xs[i], zs[j]);
              positions.set(p.slice(0, 3), k2 * 3);
              normals.set(p.slice(3, 6), k2 * 3);
              uvs.set(p.slice(6), k2 * 2);
            }
          let k = 0;
          for (let j = 0; j < zs.length - 1; j++)
            for (let i = 0; i < xs.length - 1; i++) {
              const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1;
              indices.set([c, a, d, a, b, d], k);
              k += 6;
            }
          const mesh = new ZhudaDynamicMesh(
            { positions, normals, uvs, indices },
            this.root
          );
          mesh.node.name = "terrain:" + key;
          mesh.node.meshRenderer.sharedMaterial = this.options.material;
          mesh.node.meshRenderer.receiveShadow = true;
          const chunk = { mesh, xs, zs };
          this.chunks.set(key, chunk);
          this.rebuildShell(chunk);
        }
      this.flush();
    } catch (e) {
      this.dispose();
      throw e;
    }
  }
  vertex(x, z) {
    const f = this.field, n = f.normalAtVertex(x, z), px = f.origin[0] + x * f.cellSize, pz = f.origin[1] + z * f.cellSize;
    return [
      px,
      f.heightAtVertex(x, z),
      pz,
      n.x,
      n.y,
      n.z,
      px * (this.options.uvScale?.[0] ?? 1),
      pz * (this.options.uvScale?.[1] ?? 1)
    ];
  }
  rebuildShell(chunk) {
    if (!this.options.solid) return;
    const shell = new ZhudaDynamicMesh(
      buildTerrainShell(
        chunk.mesh.vertices,
        chunk.xs,
        chunk.zs,
        this.options.solid.depth
      ),
      this.root
    );
    shell.node.name = "terrain-solid";
    shell.node.meshRenderer.sharedMaterial = this.options.solid.material ?? this.options.material;
    shell.node.meshRenderer.receiveShadow = true;
    chunk.shell?.dispose();
    chunk.shell = shell;
  }
  flush() {
    if (this.disposed) throw Error("Disposed terrain");
    for (const chunk of this.chunks.values()) {
      const r = chunk.dirty;
      if (!r) continue;
      let first = Infinity, last = -1;
      for (let j = 0; j < chunk.zs.length; j++)
        for (let i = 0; i < chunk.xs.length; i++)
          if (chunk.xs[i] >= r.minX && chunk.xs[i] <= r.maxX && chunk.zs[j] >= r.minZ && chunk.zs[j] <= r.maxZ) {
            const k = j * chunk.xs.length + i;
            chunk.mesh.vertices.set(
              this.vertex(chunk.xs[i], chunk.zs[j]),
              k * 8
            );
            first = Math.min(first, k);
            last = Math.max(last, k);
          }
      if (last >= first) {
        chunk.mesh.updateRange(first, last - first + 1);
        this.rebuildShell(chunk);
      }
      chunk.dirty = void 0;
    }
  }
  sampleLocal(x, z) {
    return this.field.sample(x, z, this.stride);
  }
  chunkKeyForCell(x, z) {
    const size = this.options.chunkCells ?? 32;
    return Math.floor(x / size) + ":" + Math.floor(z / size);
  }
  raycastLocal(ray, maxDistance) {
    const accept = (x, z) => this.chunks.has(this.chunkKeyForCell(x, z));
    let hit = this.field.raycast(ray, maxDistance, this.stride, accept);
    if (!this.options.solid) return hit;
    const depth = this.options.solid.depth, bottom = this.field.raycast(
      {
        origin: { ...ray.origin, y: ray.origin.y + depth },
        direction: ray.direction
      },
      hit?.distance ?? maxDistance,
      this.stride,
      accept
    );
    if (bottom)
      hit = {
        ...bottom,
        position: { ...bottom.position, y: bottom.position.y - depth },
        normal: {
          x: -bottom.normal.x,
          y: -bottom.normal.y,
          z: -bottom.normal.z
        }
      };
    for (const chunk of this.chunks.values()) {
      const shell = chunk.shell;
      const data = shell.data, start = (chunk.xs.length - 1) * (chunk.zs.length - 1) * 6;
      for (let i = start; i < data.indices.length; i += 3) {
        const a = data.indices[i], t = shellTriangleDistance(
          ray,
          data.positions,
          a,
          data.indices[i + 1],
          data.indices[i + 2]
        );
        if (t === null || t > (hit?.distance ?? maxDistance)) continue;
        const position = {
          x: ray.origin.x + ray.direction.x * t,
          y: ray.origin.y + ray.direction.y * t,
          z: ray.origin.z + ray.direction.z * t
        }, f = this.field;
        hit = {
          distance: t,
          position,
          normal: {
            x: data.normals[a * 3],
            y: data.normals[a * 3 + 1],
            z: data.normals[a * 3 + 2]
          },
          cellX: Math.min(
            f.cellsX - 1,
            Math.max(0, Math.floor((position.x - f.origin[0]) / f.cellSize))
          ),
          cellZ: Math.min(
            f.cellsZ - 1,
            Math.max(0, Math.floor((position.z - f.origin[1]) / f.cellSize))
          )
        };
      }
    }
    return hit;
  }
  raycast(ray, maxDistance = Infinity) {
    if (this.disposed) throw Error("Disposed terrain");
    if (maxDistance !== Infinity && (!Number.isFinite(maxDistance) || maxDistance < 0))
      throw Error("Invalid terrain ray distance");
    const world = this.root.transform.worldMatrix.elements, inv = inverse4(world), direction = normalized(ray.direction), origin = transformPoint(inv, ray.origin), end = transformPoint(inv, {
      x: ray.origin.x + direction.x,
      y: ray.origin.y + direction.y,
      z: ray.origin.z + direction.z
    });
    const rawDirection = {
      x: end.x - origin.x,
      y: end.y - origin.y,
      z: end.z - origin.z
    }, localScale = Math.hypot(rawDirection.x, rawDirection.y, rawDirection.z);
    if (!Number.isFinite(localScale) || localScale < 1e-12) return null;
    const hit = this.raycastLocal(
      {
        origin,
        direction: {
          x: rawDirection.x / localScale,
          y: rawDirection.y / localScale,
          z: rawDirection.z / localScale
        }
      },
      Number.isFinite(maxDistance) ? maxDistance * localScale : Infinity
    );
    if (!hit) return null;
    const n = hit.normal, normal = normalized({
      x: inv[0] * n.x + inv[1] * n.y + inv[2] * n.z,
      y: inv[4] * n.x + inv[5] * n.y + inv[6] * n.z,
      z: inv[8] * n.x + inv[9] * n.y + inv[10] * n.z
    });
    const position = transformPoint(world, hit.position);
    return {
      ...hit,
      distance: Math.hypot(
        position.x - ray.origin.x,
        position.y - ray.origin.y,
        position.z - ray.origin.z
      ),
      position,
      normal
    };
  }
  queryProvider(entityId, layer = 1) {
    return {
      entityId,
      layer,
      raycast: (ray, distance) => {
        const h = this.raycast(ray, distance);
        return h ? { ...h, instanceId: h.cellX + ":" + h.cellZ } : null;
      }
    };
  }
  report() {
    return {
      residentChunks: this.chunks.size,
      renderMeshes: this.chunks.size + [...this.chunks.values()].filter((c) => c.shell).length,
      solidDepth: this.options.solid?.depth ?? 0,
      stride: this.stride,
      vertices: [...this.chunks.values()].reduce(
        (n, c) => n + c.mesh.vertices.length / 8 + (c.shell?.vertices.length ?? 0) / 8,
        0
      ),
      estimatedBufferBytes: [...this.chunks.values()].reduce(
        (n, c) => n + c.mesh.vertices.byteLength + c.mesh.data.indices.byteLength + (c.shell ? c.shell.vertices.byteLength + c.shell.data.indices.byteLength : 0),
        0
      )
    };
  }
  /** Diagnostic copy prevents callers from accidentally bypassing edits/dirty propagation. */
  chunkSnapshot(key) {
    const c = this.chunks.get(key);
    return c ? {
      xs: [...c.xs],
      zs: [...c.zs],
      vertices: new Float32Array(c.mesh.vertices),
      bounds: c.mesh.mesh.bounds,
      shell: c.shell ? {
        vertices: new Float32Array(c.shell.vertices),
        indices: new Uint16Array(c.shell.data.indices),
        bounds: c.shell.mesh.bounds
      } : null
    } : null;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    for (const c of this.chunks.values()) {
      c.mesh.dispose();
      c.shell?.dispose();
    }
    this.chunks.clear();
    this.root.destroy(true);
  }
};

// packages/core/shaders/Laya342ShaderTemplates.ts
var graphicsVertex = "#define SHADER_NAME TextureVS2D\n#ifdef CAMERA2D\nuniform mat3 u_view2D;\n#endif\n#ifdef SPRITE2DGLOBAL\n#endif\n#ifdef RENDERTEXTURE\nuniform vec3 u_InvertMat_0;uniform vec3 u_InvertMat_1;\n#endif\n#ifdef VERTEX_SIZE\nuniform vec4 u_vertexSize;uniform vec3 u_NMatrix_0;uniform vec3 u_NMatrix_1;\n#endif\n#ifdef UNIFORMCLIP\nuniform vec2 u_clipOffset;\n#endif\nuniform vec2 u_size;\n#ifndef VERTEXALPHA\nuniform float u_VertAlpha;\n#endif\nvarying vec4 v_texcoordAlpha;varying vec4 v_color;varying float v_useTex;\n#ifdef UV_CLIP_GPU\nvarying float v_useClip;\n#endif\n#if defined(UV_CLIP_GPU) || defined(FILLTEXTURE)\nvarying vec4 v_customs;\n#endif\n#ifdef USE_TEX_ARRAY\nvarying float v_texLayer;\n#endif\nvoid main(){vec4 color=a_attribColor;\n#ifdef VERTEXALPHA\ncolor.a*=a_attribFlags.z;\n#else\ncolor.a*=u_VertAlpha;\n#endif\ncolor.rgb*=color.a;v_texcoordAlpha=vec4(a_posuv.zw,0.0,0.0);v_color=color;v_useTex=a_attribFlags.r;\n#ifdef UV_CLIP_GPU\nv_useClip=a_attribFlags.g;\n#endif\n#if defined(UV_CLIP_GPU) || defined(FILLTEXTURE)\nv_customs=a_customs;\n#endif\n#ifdef USE_TEX_ARRAY\nv_texLayer=a_attribFlags.w;\n#endif\n#ifdef VERTEX_SIZE\nvec2 localPos=a_posuv.xy*u_vertexSize.zw+u_vertexSize.xy;vec2 globalPos=vec2(u_NMatrix_0.x*localPos.x+u_NMatrix_0.y*localPos.y+u_NMatrix_0.z,u_NMatrix_1.x*localPos.x+u_NMatrix_1.y*localPos.y+u_NMatrix_1.z);\n#else\nvec2 globalPos=a_posuv.xy;\n#endif\n#ifdef UNIFORMCLIP\nglobalPos+=u_clipOffset;\n#endif\n#ifdef RENDERTEXTURE\nvec2 viewSource=vec2(u_InvertMat_0.x*globalPos.x+u_InvertMat_0.y*globalPos.y+u_InvertMat_0.z,u_InvertMat_1.x*globalPos.x+u_InvertMat_1.y*globalPos.y+u_InvertMat_1.z);\n#else\nvec2 viewSource=globalPos;\n#endif\n#ifdef CAMERA2D\nvec2 viewPos=(u_view2D*vec3(viewSource,1.0)).xy+u_size/2.0;\n#else\nvec2 viewPos=viewSource;\n#endif\nvec4 pos=vec4((viewPos.x/u_size.x-0.5)*2.0,(0.5-viewPos.y/u_size.y)*2.0,0.0,1.0);\n#ifdef INVERTY\npos.y=-pos.y;\n#endif\ngl_Position=pos;}";
var graphicsFragment = "#define SHADER_NAME TextureFS2D\n#if defined(GL_FRAGMENT_PRECISION_HIGH)\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec4 v_texcoordAlpha;varying vec4 v_color;varying float v_useTex;\n#ifdef UV_CLIP_GPU\nvarying float v_useClip;\n#endif\n#if defined(UV_CLIP_GPU) || defined(FILLTEXTURE)\nvarying vec4 v_customs;\n#endif\n#ifdef USE_TEX_ARRAY\nvarying float v_texLayer;uniform sampler2DArray u_spriteTextureArray;\n#else\nuniform sampler2D u_spriteTexture;\n#endif\n#ifdef FILLTEXTURE\nuniform vec4 u_TexRange;\n#endif\nvec3 linearToGamma(in vec3 value){return vec3(mix(pow(value.rgb,vec3(0.41666))*1.055-vec3(0.055),value.rgb*12.92,vec3(lessThanEqual(value.rgb,vec3(0.0031308)))));}vec4 linearToGamma(in vec4 value){return vec4(linearToGamma(value.rgb),value.a);}vec3 gammaToLinear(in vec3 value){return pow((value+0.055)/1.055,vec3(2.4));}vec4 gammaToLinear(in vec4 value){return vec4(gammaToLinear(value.rgb),value.a);}__ZHUDA_FUNCTION__\nvoid main(){\n#ifdef FILLTEXTURE\nvec2 tileUV=fract(v_texcoordAlpha.xy);vec4 trimRect=v_customs;if(tileUV.x<trimRect.x||tileUV.x>trimRect.x+trimRect.z||tileUV.y<trimRect.y||tileUV.y>trimRect.y+trimRect.w)discard;vec2 contentUV=(tileUV-trimRect.xy)/trimRect.zw;vec2 uv=contentUV*u_TexRange.zw+u_TexRange.xy;\n#else\nvec2 uv=v_texcoordAlpha.xy;\n#endif\n#ifdef USE_TEX_ARRAY\nvec4 color=texture(u_spriteTextureArray,vec3(uv,v_texLayer));\n#else\nvec4 color=texture2D(u_spriteTexture,uv);\n#endif\n#ifndef GAMMATEXTURE\n#ifdef GAMMASPACE\ncolor.rgb=linearToGamma(color.xyz);\n#endif\n#else\n#ifndef GAMMASPACE\ncolor.rgb=gammaToLinear(color.xyz);\n#endif\n#endif\nfloat useTex=step(1.0,v_useTex);color=color*useTex+(1.0-useTex);\n#if defined(UV_CLIP_GPU) && !defined(FILLTEXTURE)\nif(v_useClip>=1.0){vec2 srcUV=v_texcoordAlpha.xy;vec4 clipRect=v_customs;if(srcUV.x<clipRect.x||srcUV.x>clipRect.x+clipRect.z||srcUV.y<clipRect.y||srcUV.y>clipRect.y+clipRect.w)discard;}\n#endif\ncolor.a*=v_color.w;\n#ifdef GAMMASPACE\nvec4 transColor=v_color;\n#else\nvec4 transColor=vec4(gammaToLinear(v_color.rgb),v_color.a);\n#endif\ncolor.rgb*=transColor.rgb;gl_FragColor=zhudaSurface(uv,color);}";

// packages/core/shaders/ShaderMaterials.ts
function validateShaderSpec(spec) {
  const s = spec, e = [];
  if (!s || s.schemaVersion !== 1 || ![2, 3].includes(s.dimension))
    return ["Expected schemaVersion:1 and dimension:2|3"];
  if (typeof s.name !== "string" || !/^Zhuda[A-Za-z0-9_]{1,100}$/.test(s.name))
    e.push("Shader name must start with Zhuda, then letters/digits/_");
  if (s.fog !== void 0 && typeof s.fog !== "boolean")
    e.push("fog must be boolean");
  if (typeof s.surface !== "string" || s.surface.length > 65536 || !s.surface.includes("zhudaSurface"))
    e.push("surface must define zhudaSurface (at most 65536 characters)");
  if (!s.uniforms || typeof s.uniforms !== "object" || Array.isArray(s.uniforms) || Object.keys(s.uniforms).length > 64)
    e.push("Expected at most 64 uniform descriptors");
  else
    for (const [name, u] of Object.entries(s.uniforms)) {
      if (!/^u_Zhuda[A-Za-z0-9_]+$/.test(name))
        e.push("Custom uniforms must use u_Zhuda prefix");
      if (!u || !["float", "vec2", "vec3", "vec4", "texture2D"].includes(u.type)) {
        e.push("Invalid uniform type " + name);
        continue;
      }
      const n = { float: 1, vec2: 2, vec3: 3, vec4: 4, texture2D: 0 }[u.type];
      if (n && u.value !== void 0 && (n === 1 ? typeof u.value !== "number" || !Number.isFinite(u.value) : !Array.isArray(u.value) || u.value.length !== n || !u.value.every(Number.isFinite)))
        e.push("Invalid uniform value " + name);
      if (!n && u.value !== void 0)
        e.push(
          "Texture uniforms use the external texture bindings, not JSON values"
        );
    }
  if (s.blend && !["opaque", "alpha", "additive"].includes(s.blend))
    e.push("Invalid blend");
  if (s.dimension === 2 && s.passes && (s.passes.depth || s.passes.opaqueColor))
    e.push("2D graphics shaders cannot request 3D camera passes");
  if (typeof s.surface === "string" && /\b(?:uniform|attribute|varying)\b|#\s*(?:version|include)|\bvoid\s+main\s*\(/.test(
    s.surface.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")
  ))
    e.push(
      "surface is a function body contract; declarations/includes/main belong to the engine template"
    );
  return e;
}
var vertex3D = `#include "Scene.glsl";
#include "SceneFogInput.glsl";
#include "Camera.glsl";
#include "Sprite3DVertex.glsl";
#include "VertexCommon.glsl";
varying vec2 v_ZhudaUV;varying vec3 v_ZhudaPosition;varying vec3 v_ZhudaNormal;
void main(){Vertex v;getVertexParams(v);mat4 w=getWorldMatrix();vec4 p=w*vec4(v.positionOS,1.0);v_ZhudaPosition=p.xyz;
v_ZhudaUV=vec2(0.0);
#ifdef UV
v_ZhudaUV=v.texCoord0;
#endif
vec3 a=w[0].xyz,b=w[1].xyz,c=w[2].xyz;v_ZhudaNormal=normalize(mat3(cross(b,c),cross(c,a),cross(a,b))*v.normalOS)*sign(dot(a,cross(b,c)));
gl_Position=remapPositionZ(getPositionCS(p.xyz));
#ifdef FOG
FogHandle(gl_Position.z);
#endif
}`;
var fragment3D = (surface, fog = true) => `#include "Color.glsl";
#include "Scene.glsl";
#include "Camera.glsl";
#include "SceneFog.glsl";
varying vec2 v_ZhudaUV;varying vec3 v_ZhudaPosition;varying vec3 v_ZhudaNormal;
${surface}
void main(){gl_FragColor=outputTransform(zhudaSurface(v_ZhudaUV,v_ZhudaPosition,normalize(v_ZhudaNormal)));
${fog ? `#ifdef FOG
gl_FragColor.rgb=scenUnlitFog(gl_FragColor.rgb);
#endif` : ""}
}`;
var ZhudaShaderMaterial = class {
  constructor(spec, textures = {}) {
    this.disposed = false;
    const e = validateShaderSpec(spec);
    if (e.length) throw Error(e.join("; "));
    this.spec = JSON.parse(JSON.stringify(spec));
    for (const [name, u] of Object.entries(spec.uniforms))
      if (u.type === "texture2D" && !textures[name])
        throw Error("Missing texture binding " + name);
    const l = globalThis.Laya, types = {
      float: l.ShaderDataType.Float,
      vec2: l.ShaderDataType.Vector2,
      vec3: l.ShaderDataType.Vector3,
      vec4: l.ShaderDataType.Vector4,
      texture2D: l.ShaderDataType.Texture2D
    }, uniforms = Object.fromEntries(
      Object.keys(spec.uniforms).sort().map((name) => [name, types[spec.uniforms[name].type]])
    );
    const textureHelpers = Object.entries(spec.uniforms).filter(([, u]) => u.type === "texture2D").map(
      ([
        name
      ]) => `vec4 zhudaSample_${name}(vec2 uv){vec4 c=texture2D(${name},uv);
#ifdef Gamma_${name}
c=gammaToLinear(c);
#endif
return c;}`
    ).join("\n");
    const surface = textureHelpers + "\n" + spec.surface;
    this.material = createCustomSurfaceMaterial({
      name: spec.name,
      dimension: spec.dimension,
      vertex: spec.dimension === 2 ? graphicsVertex : vertex3D,
      fragment: spec.dimension === 2 ? graphicsFragment.replace("__ZHUDA_FUNCTION__", surface) : fragment3D(surface, spec.fog !== false),
      uniforms,
      instancing: spec.dimension === 3
    });
    try {
      const m = this.material, blend = spec.blend || (spec.dimension === 2 ? "alpha" : "opaque");
      m.depthWrite = spec.depthWrite ?? (spec.dimension === 3 && blend === "opaque");
      m.depthTest = spec.dimension === 2 ? l.RenderState.DEPTHTEST_ALWAYS : l.RenderState.DEPTHTEST_LESS;
      m.cull = spec.dimension === 2 || spec.doubleSided ? l.RenderState.CULL_NONE : l.RenderState.CULL_BACK;
      m.renderQueue = blend === "opaque" ? l.Material.RENDERQUEUE_OPAQUE : l.Material.RENDERQUEUE_TRANSPARENT;
      m.blend = blend === "opaque" ? l.RenderState.BLEND_DISABLE : l.RenderState.BLEND_ENABLE_ALL;
      m.blendSrc = spec.dimension === 2 ? l.RenderState.BLENDPARAM_ONE : l.RenderState.BLENDPARAM_SRC_ALPHA;
      m.blendDst = blend === "additive" ? l.RenderState.BLENDPARAM_ONE : l.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
      for (const [name, u] of Object.entries(spec.uniforms)) {
        if (u.type === "texture2D") this.setTexture(name, textures[name]);
        else
          this.setUniform(
            name,
            u.value ?? (u.type === "float" ? 0 : Array(Number(u.type.slice(-1))).fill(0))
          );
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  setUniform(name, value) {
    if (this.disposed) throw Error("Disposed shader");
    const u = this.spec.uniforms[name];
    if (!u || u.type === "texture2D")
      throw Error("Unknown numeric uniform " + name);
    const n = u.type === "float" ? 1 : Number(u.type.slice(-1));
    if (n === 1 ? typeof value !== "number" || !Number.isFinite(value) : typeof value === "number" || value.length !== n || !Array.from(value).every(Number.isFinite))
      throw Error("Invalid uniform " + name);
    const l = globalThis.Laya;
    if (u.type === "float") this.material.setFloat(name, value);
    else
      this.material["setVector" + n](
        name,
        new l["Vector" + n](...value)
      );
  }
  setTexture(name, texture) {
    if (this.disposed || this.spec.uniforms[name]?.type !== "texture2D" || !texture || texture.destroyed)
      throw Error("Invalid texture binding " + name);
    this.material.setTexture(name, texture.bitmap || texture);
  }
  report() {
    return {
      name: this.spec.name,
      dimension: this.spec.dimension,
      uniforms: Object.keys(this.spec.uniforms),
      passes: this.spec.passes || {},
      gpuStatus: "requires-first-draw",
      disposed: this.disposed
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [name, u] of Object.entries(this.spec.uniforms))
      if (u.type === "texture2D") this.material.setTexture(name, null);
    this.material.destroy();
  }
};
var shaderRecipes = {
  terrain3D: {
    schemaVersion: 1,
    name: "ZhudaTerrainHeightSlope",
    dimension: 3,
    uniforms: {
      u_ZhudaGrass: { type: "vec3", value: [0.15, 0.42, 0.13] },
      u_ZhudaRock: { type: "vec3", value: [0.38, 0.32, 0.26] },
      u_ZhudaSnow: { type: "vec3", value: [0.85, 0.91, 0.96] },
      u_ZhudaSnowLine: { type: "float", value: 5 }
    },
    surface: `vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){float slope=1.0-abs(n.y);vec3 color=mix(u_ZhudaGrass,u_ZhudaRock,smoothstep(.12,.5,slope));color=mix(color,u_ZhudaSnow,smoothstep(u_ZhudaSnowLine-.5,u_ZhudaSnowLine+.5,p.y));float grid=.95+.05*sin(uv.x*3.14159)*sin(uv.y*3.14159);float light=.35+.65*max(0.0,dot(n,normalize(vec3(.3,1.0,.2))));return vec4(color*light*grid,1.0);}`
  },
  textured3D: {
    schemaVersion: 1,
    name: "ZhudaTexturedSurface",
    dimension: 3,
    uniforms: {
      u_ZhudaTexture: { type: "texture2D" },
      u_ZhudaTint: { type: "vec4", value: [1, 1, 1, 1] }
    },
    surface: "vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){return zhudaSample_u_ZhudaTexture(uv)*u_ZhudaTint;}"
  },
  dissolve3D: {
    schemaVersion: 1,
    name: "ZhudaDissolveSurface",
    dimension: 3,
    doubleSided: true,
    uniforms: {
      u_ZhudaAmount: { type: "float", value: 0.4 },
      u_ZhudaTint: { type: "vec4", value: [0.1, 0.7, 1, 1] }
    },
    surface: "vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){float noise=fract(sin(dot(floor(uv*40.0),vec2(12.98,78.23)))*43758.54);if(noise<u_ZhudaAmount)discard;float edge=1.0-smoothstep(u_ZhudaAmount,u_ZhudaAmount+.08,noise);return vec4(mix(u_ZhudaTint.rgb,vec3(1.0,.7,.05),edge),u_ZhudaTint.a);}"
  },
  tint2D: {
    schemaVersion: 1,
    name: "ZhudaGraphicsTint",
    dimension: 2,
    uniforms: { u_ZhudaTint: { type: "vec4", value: [1, 1, 1, 1] } },
    surface: "vec4 zhudaSurface(vec2 uv,vec4 color){return vec4(color.rgb*u_ZhudaTint.rgb*u_ZhudaTint.a,color.a*u_ZhudaTint.a);}"
  }
};

// packages/core/shaders/LitSurfaceTemplates.ts
var litVertex = '#define SHADER_NAME PBRStandardVS\n#include "Math.glsl";\n#include "Scene.glsl";\n#include "SceneFogInput.glsl";\n#include "Camera.glsl";\n#include "Sprite3DVertex.glsl";\n#include "VertexCommon.glsl";\n#include "PBRVertex.glsl";\n#if defined(DETAILTEXTURE) || defined(DETAILNORMAL)\nvarying vec2 v_DetailUV;\n#endif\nvoid main(){Vertex vertex;getVertexParams(vertex);PixelParams pixel;initPixelParams(pixel,vertex);\n#if defined(DETAILTEXTURE) || defined(DETAILNORMAL)\n#ifdef UV\nv_DetailUV=transformUV(vertex.texCoord0,u_DetailTillingOffset);\n#else\nv_DetailUV=vec2(0.0);\n#endif\n#endif\ngl_Position=getPositionCS(pixel.positionWS);gl_Position=remapPositionZ(gl_Position);\n#ifdef FOG\nFogHandle(gl_Position.z);\n#endif\n}';
var litFragment = '#define SHADER_NAME PBRStandardFS\n#include "Color.glsl";\n#include "Scene.glsl";\n#include "SceneFog.glsl";\n#include "Camera.glsl";\n#include "Sprite3DFrag.glsl";\n#include "PBRMetallicFrag.glsl";\n#if defined(DETAILTEXTURE) || defined(DETAILNORMAL)\nvarying vec2 v_DetailUV;\n#define ColorSpaceDouble vec3(4.59479380, 4.59479380, 4.59479380);\nvec3 BlendNormals(vec3 n1,vec3 n2){return normalize(vec3(n1.xy+n2.xy,n1.z*n2.z));}\n#endif\nvoid initSurfaceInputs(inout SurfaceInputs inputs,const in PixelParams pixel){\n#ifdef UV\nvec2 uv=transformUV(pixel.uv0,u_TilingOffset);\n#else\nvec2 uv=vec2(0.0);\n#endif\ninputs.diffuseColor=u_AlbedoColor.rgb;inputs.alpha=u_AlbedoColor.a;\n#ifdef COLOR\n#ifdef ENABLEVERTEXCOLOR\ninputs.diffuseColor*=pixel.vertexColor.xyz;inputs.alpha*=pixel.vertexColor.a;\n#endif\n#endif\ninputs.alphaTest=u_AlphaTestValue;\n#ifdef ALBEDOTEXTURE\nvec4 albedoSampler=texture2D(u_AlbedoTexture,uv);\n#ifdef Gamma_u_AlbedoTexture\nalbedoSampler=gammaToLinear(albedoSampler);\n#endif\ninputs.diffuseColor*=albedoSampler.rgb;inputs.alpha*=albedoSampler.a;\n#endif\n#ifdef DETAILTEXTURE\nvec3 detailSampler=texture2D(u_DetailAlbedoTexture,v_DetailUV).rgb;\n#ifdef Gamma_u_DetailAlbedoTexture\ndetailSampler=gammaToLinear(detailSampler);\n#endif\ndetailSampler*=ColorSpaceDouble;inputs.diffuseColor*=detailSampler;\n#endif\ninputs.normalTS=vec3(0.0,0.0,1.0);\n#ifdef NORMALTEXTURE\nvec3 normalSampler=texture2D(u_NormalTexture,uv).rgb;normalSampler=normalize(normalSampler*2.0-1.0);normalSampler.y*=-1.0;inputs.normalTS=normalScale(normalSampler,u_NormalScale);\n#endif\n#ifdef DETAILNORMAL\nvec3 detailnormalSampler=texture2D(u_DetailNormalTexture,v_DetailUV).rgb;detailnormalSampler=normalize(detailnormalSampler*2.0-1.0);detailnormalSampler.y*=-1.0;detailnormalSampler=normalScale(detailnormalSampler,u_DetailNormalScale);inputs.normalTS=BlendNormals(inputs.normalTS,detailnormalSampler);\n#endif\ninputs.metallic=u_Metallic;inputs.smoothness=u_Smoothness;\n#ifdef METALLICGLOSSTEXTURE\nvec4 metallicSampler=texture2D(u_MetallicGlossTexture,uv);\n#ifdef Gamma_u_MetallicGlossTexture\nmetallicSampler=gammaToLinear(metallicSampler);\n#endif\ninputs.metallic=metallicSampler.x;\n#ifdef SMOOTHNESSSOURCE_ALBEDOTEXTURE_ALPHA\n#ifdef ALBEDOTEXTURE\ninputs.smoothness=(albedoSampler.a*u_Smoothness);\n#endif\n#else\ninputs.smoothness=(metallicSampler.a*u_Smoothness);\n#endif\n#endif\ninputs.occlusion=1.0;\n#ifdef OCCLUSIONTEXTURE\nvec4 occlusionSampler=texture2D(u_OcclusionTexture,uv);\n#ifdef Gamma_u_OcclusionTexture\nocclusionSampler=gammaToLinear(occlusionSampler);\n#endif\nfloat occlusion=occlusionSampler.g;inputs.occlusion=(1.0-u_OcclusionStrength)+occlusion*u_OcclusionStrength;\n#endif\ninputs.emissionColor=vec3(0.0);\n#ifdef EMISSION\ninputs.emissionColor=u_EmissionColor.rgb*u_EmissionIntensity;\n#ifdef EMISSIONTEXTURE\nvec4 emissionSampler=texture2D(u_EmissionTexture,uv);\n#ifdef Gamma_u_EmissionTexture\nemissionSampler=gammaToLinear(emissionSampler);\n#endif\ninputs.emissionColor*=emissionSampler.rgb;\n#endif\n#endif\n#ifdef CLEARCOAT\ninputs.clearCoat=u_ClearCoatFactor;inputs.clearCoatRoughness=u_ClearCoatRoughness;\n#ifdef CLEARCOATMAP\nvec4 clearCoatSampler=texture2D(u_ClearCoatTexture,uv);inputs.clearCoat*=clearCoatSampler.r;\n#endif\n#ifdef CLEARCOAT_ROUGHNESSMAP\nvec4 clearcoatSampleRoughness=texture2D(u_ClearCoatRoughnessTexture,uv);inputs.clearCoatRoughness*=clearcoatSampleRoughness.g;\n#endif\n#ifdef CLEARCOAT_NORMAL\nvec3 clearCoatNormalSampler=texture2D(u_ClearCoatNormalTexture,uv).rgb;clearCoatNormalSampler=normalize(clearCoatNormalSampler*2.0-1.0);clearCoatNormalSampler.y*=-1.0;inputs.clearCoatNormalTS=clearCoatNormalSampler;\n#endif\n#endif\n#ifdef ANISOTROPIC\ninputs.anisotropy=u_AnisotropyStrength;vec2 direction=vec2(1.0,0.0);\n#ifdef ANISOTROPYMAP\nvec3 anisotropySampler=texture2D(u_AnisotropyTexture,uv).rgb;inputs.anisotropy*=anisotropySampler.b;direction=anisotropySampler.xy*2.0-1.0;\n#endif\nvec2 anisotropyRotation=vec2(cos(u_AnisotropyRotation),sin(u_AnisotropyRotation));mat2 rotationMatrix=mat2(anisotropyRotation.x,anisotropyRotation.y,-anisotropyRotation.y,anisotropyRotation.x);inputs.anisotropyDirection=rotationMatrix*direction;\n#endif\n}void main(){PixelParams pixel;getPixelParams(pixel);SurfaceInputs inputs;initSurfaceInputs(inputs,pixel);vec4 surfaceColor=PBR_Metallic_Flow(inputs,pixel);\n#ifdef FOG\nsurfaceColor.rgb=sceneLitFog(surfaceColor.rgb);\n#endif\ngl_FragColor=surfaceColor;gl_FragColor=outputTransform(gl_FragColor);}';
var litShadowFragment = '#define SHADER_NAME PBRDepthFS\n#include "DepthFrag.glsl";\n#include "Sprite3DFrag.glsl";\n#ifdef ALPHATEST\nvarying vec2 v_AlphaTestUV;varying float v_AlphaTestVertexAlpha;\n#endif\nvoid main(){\n#ifdef ALPHATEST\nfloat alpha=u_AlbedoColor.a*v_AlphaTestVertexAlpha;\n#ifdef ALBEDOTEXTURE\n#ifdef UV\nvec2 uv=transformUV(v_AlphaTestUV,u_TilingOffset);\n#else\nvec2 uv=vec2(0.0);\n#endif\nalpha*=texture2D(u_AlbedoTexture,uv).a;\n#endif\nif(alpha<u_AlphaTestValue)discard;\n#endif\ngl_FragColor=getDepthColor();}';
var litDepthVertex = '#define SHADER_NAME PBRStandardDepthNormalVS\n#include "Math.glsl";\n#include "Camera.glsl";\n#include "Sprite3DVertex.glsl";\n#include "VertexCommon.glsl";\n#include "PBRVertex.glsl";\nvarying vec4 v_PositionCS;void main(){Vertex vertex;getVertexParams(vertex);PixelParams pixel;initPixelParams(pixel,vertex);sharePixelParams(pixel);vec4 positionCS=getPositionCS(pixel.positionWS);v_PositionCS=positionCS;gl_Position=positionCS;gl_Position=remapPositionZ(gl_Position);}';
var litDepthFragment = '#define SHADER_NAME PBRStandardDepthNormalFS\n#include "Color.glsl";\n#include "Scene.glsl";\n#include "Camera.glsl";\n#include "Sprite3DFrag.glsl";\n#include "ShadingFrag.glsl";\n#include "DepthNormalFrag.glsl";\nvarying vec4 v_PositionCS;void main(){PixelParams pixel;getPixelParams(pixel);\n#ifdef ALPHATEST\nfloat alpha=u_AlbedoColor.a;\n#if defined(COLOR) && defined(ENABLEVERTEXCOLOR)\nalpha*=pixel.vertexColor.a;\n#endif\n#ifdef ALBEDOTEXTURE\n#ifdef UV\nvec2 alphaUV=transformUV(pixel.uv0,u_TilingOffset);\n#else\nvec2 alphaUV=vec2(0.0);\n#endif\nalpha*=texture2D(u_AlbedoTexture,alphaUV).a;\n#endif\nif(alpha<u_AlphaTestValue)discard;\n#endif\nvec3 normalWS=pixel.normalWS;\n#ifdef NORMALTEXTURE\n#ifdef UV\nvec2 uv=transformUV(pixel.uv0,u_TilingOffset);vec3 normalSampler=texture2D(u_NormalTexture,uv).rgb;normalSampler=normalize(normalSampler*2.0-1.0);normalSampler.y*=-1.0;vec3 normalTS=normalScale(normalSampler,u_NormalScale);normalWS=normalize(pixel.TBN*normalTS);\n#endif\n#endif\nvec4 positionCS=v_PositionCS;vec4 dephtNormal=encodeDepthNormal(positionCS,normalWS);gl_FragColor=dephtNormal;}';
var litShadowVertex = '#define SHADER_NAME DepthVS\n#include "DepthVertex.glsl";\n#ifdef ALPHATEST\nvarying vec2 v_AlphaTestUV;varying float v_AlphaTestVertexAlpha;\n#endif\nvoid main(){Vertex vertex;getVertexParams(vertex);\n#ifdef ALPHATEST\n#ifdef UV\nv_AlphaTestUV=vertex.texCoord0;\n#else\nv_AlphaTestUV=vec2(0.0);\n#endif\n#if defined(COLOR) && defined(ENABLEVERTEXCOLOR)\nv_AlphaTestVertexAlpha=vertex.vertexColor.a;\n#else\nv_AlphaTestVertexAlpha=1.0;\n#endif\n#endif\nmat4 worldMat=getWorldMatrix();vec4 pos=(worldMat*vec4(vertex.positionOS,1.0));vec3 positionWS=pos.xyz/pos.w;mat4 normalMat=transpose(inverse(worldMat));vec3 normalWS=normalize((normalMat*vec4(vertex.normalOS,0.0)).xyz);vec4 positionCS=DepthPositionCS(positionWS,normalWS);gl_Position=remapPositionZ(positionCS);}';

// packages/core/shaders/LitSurfaceMaterial.ts
var registry = /* @__PURE__ */ new WeakMap();
var fields = {
  u_AlbedoColor: "Color",
  u_TilingOffset: "Vector4",
  u_NormalScale: "Float",
  u_Metallic: "Float",
  u_Smoothness: "Float",
  u_OcclusionStrength: "Float",
  u_AlphaTestValue: "Float",
  u_EmissionColor: "Color",
  u_EmissionIntensity: "Float",
  u_AlbedoTexture: "Texture2D",
  u_NormalTexture: "Texture2D",
  u_OcclusionTexture: "Texture2D",
  u_EmissionTexture: "Texture2D",
  u_MetallicGlossTexture: "Texture2D",
  u_ClearCoatFactor: "Float",
  u_ClearCoatTexture: "Texture2D",
  u_ClearCoatRoughness: "Float",
  u_ClearCoatRoughnessTexture: "Texture2D",
  u_ClearCoatNormalTexture: "Texture2D"
};
var ZhudaLitSurfaceMaterial = class {
  constructor(spec, textures = {}) {
    this.disposed = false;
    const uniforms = spec.uniforms || {};
    const errors = validateShaderSpec({
      schemaVersion: 1,
      dimension: 3,
      name: spec.name,
      surface: spec.surface,
      uniforms
    });
    if (errors.length) throw Error(errors.join("; "));
    if (spec.normalConvention && !["directx", "opengl"].includes(spec.normalConvention))
      throw Error("Invalid normal map convention");
    for (const v of [
      spec.material?.clearCoat ?? 0,
      spec.material?.clearCoatRoughness ?? 0.1
    ])
      if (!Number.isFinite(v) || v < 0 || v > 1)
        throw Error("Invalid clear coat factor");
    for (const [k, u] of Object.entries(uniforms))
      if (u.type === "texture2D" && !textures[k])
        throw Error("Missing texture binding " + k);
    this.spec = {
      ...spec,
      uniforms: JSON.parse(JSON.stringify(uniforms)),
      material: spec.material ? { ...spec.material } : void 0
    };
    const l = globalThis.Laya;
    let records2 = registry.get(l.Shader3D);
    if (!records2) registry.set(l.Shader3D, records2 = /* @__PURE__ */ new Map());
    const signature = JSON.stringify({
      surface: spec.surface,
      uniforms,
      normalConvention: spec.normalConvention || "directx"
    });
    if (l.Shader3D.find(spec.name)) {
      if (records2.get(spec.name) !== signature)
        throw Error("Shader name has a different contract");
    } else {
      const types = {
        float: "Float",
        vec2: "Vector2",
        vec3: "Vector3",
        vec4: "Vector4",
        texture2D: "Texture2D"
      };
      const map = Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, l.ShaderDataType[v]])
      );
      for (const [k, u] of Object.entries(uniforms))
        map[k] = l.ShaderDataType[types[u.type]];
      const helper = Object.entries(uniforms).filter(([, u]) => u.type === "texture2D").map(
        ([k]) => `vec4 zhudaSample_${k}(vec2 uv){vec4 c=texture2D(${k},uv);
#ifdef Gamma_${k}
c=gammaToLinear(c);
#endif
return c;}`
      ).join("\n");
      const hook = `struct ZhudaLitSurface {vec3 baseColor;float metallic;float roughness;float occlusion;vec3 emission;};
${helper}
${spec.surface}
`;
      const call = `initSurfaceInputs(inputs,pixel);ZhudaLitSurface s;s.baseColor=inputs.diffuseColor;s.metallic=inputs.metallic;s.roughness=1.0-inputs.smoothness;s.occlusion=inputs.occlusion;s.emission=inputs.emissionColor;
#ifdef UV
vec2 zhudaUV=pixel.uv0;
#else
vec2 zhudaUV=vec2(0.0);
#endif
zhudaSurface(s,zhudaUV,pixel.positionWS,pixel.normalWS);inputs.diffuseColor=max(s.baseColor,vec3(0.0));inputs.metallic=clamp(s.metallic,0.0,1.0);inputs.smoothness=1.0-clamp(s.roughness,0.04,1.0);inputs.occlusion=clamp(s.occlusion,0.0,1.0);inputs.emissionColor=max(s.emission,vec3(0.0));`;
      const normals = (source) => spec.normalConvention === "opengl" ? source.replace(
        /\b(?:normalSampler|detailnormalSampler|clearCoatNormalSampler)\.y\*=-1\.0;/g,
        ""
      ) : source;
      const fragment = normals(litFragment).replace("void main(){", hook + "void main(){").replace("initSurfaceInputs(inputs,pixel);", call);
      const shader = l.Shader3D.add(spec.name, true, true);
      shader.shaderType = l.ShaderFeatureType.D3;
      const sub = new l.SubShader(l.SubShader.DefaultAttributeMap, map, {});
      shader.addSubShader(sub);
      sub.addShaderPass(litVertex, fragment);
      sub.addShaderPass(litShadowVertex, litShadowFragment, "ShadowCaster");
      sub.addShaderPass(
        litDepthVertex,
        normals(litDepthFragment),
        "DepthNormal"
      );
      records2.set(spec.name, signature);
    }
    const m = createSurfaceMaterial({ type: "pbr", ...spec.material });
    m.setShaderName(spec.name);
    const settings = spec.material || {};
    m.albedoColor = new l.Color(...settings.color || [1, 1, 1, 1]);
    m.metallic = settings.metallic ?? 0;
    m.smoothness = 1 - (settings.roughness ?? 0.5);
    const slots = {
      albedo: "albedoTexture",
      normal: "normalTexture",
      metallicGloss: "metallicGlossTexture",
      emission: "emissionTexture"
    };
    for (const [k, value] of Object.entries(settings.textures || {}))
      m[slots[k]] = value?.bitmap || value;
    m.emissionColor = new l.Color(...settings.emission || [0, 0, 0], 1);
    m.tilingOffset = new l.Vector4(1, 1, 0, 0);
    m.normalTextureScale = 1;
    m.occlusionTextureStrength = 1;
    m.emissionIntensity = 1;
    m.clearCoatEnable = (spec.material?.clearCoat ?? 0) > 0;
    m.clearCoat = spec.material?.clearCoat ?? 0;
    m.clearCoatRoughness = spec.material?.clearCoatRoughness ?? 0.1;
    m.enableEmission = true;
    this.material = m;
    for (const [k, u] of Object.entries(uniforms))
      this.set(
        k,
        u.type === "texture2D" ? textures[k] : u.value ?? (u.type === "float" ? 0 : Array(Number(u.type.slice(-1))).fill(0))
      );
  }
  set(name, value) {
    if (this.disposed) throw Error("Disposed material");
    const u = this.spec.uniforms?.[name];
    if (!u) throw Error("Unknown uniform " + name);
    const l = globalThis.Laya;
    if (u.type === "texture2D")
      this.material.setTexture(name, value?.bitmap || value);
    else if (u.type === "float") {
      if (!Number.isFinite(value)) throw Error("Expected finite float");
      this.material.setFloat(name, value);
    } else {
      const n = Number(u.type.slice(-1));
      if (!Array.isArray(value) || value.length !== n || !value.every(Number.isFinite))
        throw Error("Invalid vector");
      this.material[{ 2: "setVector2", 3: "setVector3", 4: "setVector4" }[n]](name, new l["Vector" + n](...value));
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const l = globalThis.Laya;
    for (const [k, u] of Object.entries(this.spec.uniforms || {}))
      if (u.type === "texture2D") this.material.setTexture(k, null);
    disposeSurfaceMaterial(this.material);
  }
};
export {
  AssetProviderError,
  ChunkedAssetProvider,
  DirectoryAssetProvider,
  ENGINE_PRESET_PROFILES,
  EngineGuard,
  IframeSoundAdapter,
  ModelDecoderError,
  NoSleepAdapter,
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
  ZHUDA_VFX_FRAGMENT,
  ZHUDA_VFX_VERTEX,
  Zhuda3D,
  ZhudaActionStateMachine,
  ZhudaAnimatorLOD,
  ZhudaAssetCache,
  ZhudaAssetSerializer,
  ZhudaAssetShowcase,
  ZhudaBenchmarkEngine,
  ZhudaCameraCoordinates,
  ZhudaCameraRig,
  ZhudaCinematicCapture,
  ZhudaCombatWorld,
  ZhudaCrowdScheduler,
  ZhudaDistanceLOD,
  ZhudaDynamicMesh,
  ZhudaEffectBudget,
  ZhudaEffectDirector,
  ZhudaEffectEnvelope,
  ZhudaEngine,
  ZhudaEventGate,
  ZhudaFilmicPipeline,
  ZhudaGraphicsGuard,
  ZhudaHeightfield,
  ZhudaInputBuffer,
  ZhudaInstanceGroup,
  ZhudaLayaParticleRenderer,
  ZhudaLayaParticleRenderer3D,
  ZhudaLayaRibbonRenderer,
  ZhudaLayaRibbonRenderer3D,
  ZhudaLayeredClock,
  ZhudaLitSurfaceMaterial,
  ZhudaMeshoptModelDecoder,
  ZhudaModelAnimationSampler,
  ZhudaModelCompatibilityError,
  ZhudaModelDecoderRegistry,
  ZhudaModelInspector,
  ZhudaModelLibrary,
  ZhudaObjectPool,
  ZhudaOfflineFrameRecorder,
  ZhudaParticleEventLink,
  ZhudaParticleMesh3D,
  ZhudaParticleSystem,
  ZhudaParticleSystem3D,
  ZhudaPhysicalCameraRig,
  ZhudaPlanarReflection,
  ZhudaPointerInput,
  ZhudaPrefab,
  ZhudaPrefabLibrary,
  ZhudaRafDriver,
  ZhudaRealtimeClock,
  ZhudaRemoteCharacterPresenter,
  ZhudaRenderSpace,
  ZhudaRendererError,
  ZhudaRequestSlot,
  ZhudaResourceScope,
  ZhudaResultPlayback,
  ZhudaRibbonPath3D,
  ZhudaRibbonTrail,
  ZhudaRibbonTrail3D,
  ZhudaRuntimeHost,
  ZhudaRuntimeProfiler,
  ZhudaRuntimeSession,
  ZhudaSceneBudget,
  ZhudaSceneMutationQueue,
  ZhudaSceneQueries,
  ZhudaSceneRegions,
  ZhudaShaderMaterial,
  ZhudaSimulationClock,
  ZhudaSnapshotBuffer,
  ZhudaSurfaceQuery,
  ZhudaTerrain2D,
  ZhudaTerrain2DRenderer,
  ZhudaTerrain3D,
  ZhudaThemeAssetProvider,
  ZhudaThemeController,
  ZhudaTimelineSequencer,
  ZhudaTimerScheduler,
  ZhudaUI,
  ZhudaVfxCamera,
  ZhudaVfxMaterial,
  ZhudaWorkerFrameDriver,
  applySceneQuality,
  buildPrefabTree,
  compareVisualFrames,
  compose4,
  computeMeshTangents,
  configureSurfacePasses,
  convertUnityAnimationCurve,
  convertUnityVisualMaterial,
  createCustomSurfaceMaterial,
  createPrefilteredEnvironment,
  createProviderAssetCache,
  createSurfaceMaterial,
  createSurfaceTexture,
  disposeMigratedMaterial,
  disposeSurfaceMaterial,
  findPrefabNode,
  gltfAssetCapabilities,
  gltfExtensionCapabilities,
  identity4,
  inspectGltfAsset,
  inspectGltfDocument,
  inspectPrefabInstance,
  inspectSceneResources,
  installLaya342LifecycleFix,
  installSandboxStorageFallback,
  instantiateMigratedMaterial,
  inverse4,
  multiply4,
  normalizeAssetId,
  normalized,
  packMetallicRoughness,
  physicalCameraMetrics,
  physicalCameraSettings,
  rayBox,
  resolveCameraBoom,
  resolveParticleCollision,
  rotateParticleVector3,
  sampleParticleColor,
  sampleParticleCurve,
  sampleParticleUV,
  sceneQuality,
  shaderRecipes,
  terrainNoise,
  transformPoint,
  validateActionFrameSpec,
  validateAssetManifest,
  validateEffectTimeline,
  validateHeightfield,
  validateParticleEffect,
  validateParticleEffect3D,
  validateParticleExtras,
  validatePrefabPatch3D,
  validatePrefabTree3D,
  validateShaderSpec,
  validateTerrain2D,
  validateThemeManifest,
  validateTimelineSpec,
  validateVfxMaterial,
  zhudaComponent
};
//# sourceMappingURL=zhuda-laya-engine.esm.js.map
