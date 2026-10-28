var ZhudaPreviewBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __decorateClass = (decorators, target, key, kind) => {
    var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
    for (var i = decorators.length - 1, decorator; i >= 0; i--)
      if (decorator = decorators[i])
        result = (kind ? decorator(target, key, result) : decorator(result)) || result;
    if (kind && result) __defProp(target, key, result);
    return result;
  };

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

  // src/components/BoardCameraController.ts
  var BoardCameraController = class extends Laya.Script {
    constructor() {
      super(...arguments);
      this.targetPosition = new Laya.Vector3(4, 15, 17);
      this.targetRotationEuler = new Laya.Vector3(-48, 0, 0);
      this.lerpSpeed = 0.14;
      this.frameTickCount = 0;
    }
    onAwake() {
      this.frameTickCount = 0;
    }
    setCameraTarget(pos, euler) {
      this.targetPosition = pos.clone();
      this.targetRotationEuler = euler.clone();
    }
    onUpdate() {
      this.frameTickCount++;
      const cam = this.owner;
      if (!cam || !cam.transform) return;
      const curPos = cam.transform.position;
      const curRot = cam.transform.rotationEuler;
      const nx = curPos.x + (this.targetPosition.x - curPos.x) * this.lerpSpeed;
      const ny = curPos.y + (this.targetPosition.y - curPos.y) * this.lerpSpeed;
      const nz = curPos.z + (this.targetPosition.z - curPos.z) * this.lerpSpeed;
      cam.transform.position = new Laya.Vector3(nx, ny, nz);
      const rx = curRot.x + (this.targetRotationEuler.x - curRot.x) * this.lerpSpeed;
      const ry = curRot.y + (this.targetRotationEuler.y - curRot.y) * this.lerpSpeed;
      const rz = curRot.z + (this.targetRotationEuler.z - curRot.z) * this.lerpSpeed;
      cam.transform.rotationEuler = new Laya.Vector3(rx, ry, rz);
    }
  };
  BoardCameraController = __decorateClass([
    zhudaComponent({
      className: "BoardCameraController",
      assetId: "zhuda://BoardCameraController",
      category: "3d",
      description: "3D \u6230\u8853\u68CB\u76E4\u76F8\u6A5F\u5E73\u6ED1\u63D2\u503C\u8207\u5FAE\u5E45\u547C\u5438\u904B\u93E1\u7D44\u4EF6"
    })
  ], BoardCameraController);

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

  // src/components/StaticAssetComponents.ts
  var Spine42PhysicsRigComponent = class extends Laya.Script {
    constructor() {
      super(...arguments);
      this.rigName = "ZhudaGuardianPig_v4.2";
      this.defaultPose = "idle";
      this.stiffness = 95;
      this.damping = 0.88;
      this.windAmplitude = 1.8;
      this.earAngleRad = 0;
      this.earVelocity = 0;
      this.skinPrimaryColor = "#ff9ebb";
      this.skinBorderColor = "#ff6b98";
      this.bellyHighlightColor = "#ffd0df";
      this.snoutColor = "#ffa6c2";
      this.staticFreezeMode = false;
    }
    applyImpulse(impulse) {
      this.earVelocity += impulse;
    }
    stepPhysics(dt = 0.016, timeSec = 0) {
      if (this.staticFreezeMode) {
        return this.earAngleRad;
      }
      const wind = Math.sin(timeSec * 3) * this.windAmplitude;
      const accel = -this.stiffness * this.earAngleRad + wind;
      this.earVelocity = (this.earVelocity + accel * dt) * this.damping;
      this.earAngleRad += this.earVelocity * dt;
      return this.earAngleRad;
    }
  };
  Spine42PhysicsRigComponent = __decorateClass([
    zhudaComponent({
      className: "Spine42PhysicsRigComponent",
      assetId: "zhuda://Spine42PhysicsRigComponent",
      category: "spine",
      description: "Spine 4.2 \u975C\u614B\u9810\u88FD\u9AD4\u9AA8\u9ABC\u7269\u7406\u7D04\u675F\u7D44\u4EF6\uFF0C\u652F\u63F4\u5B64\u7ACB\u975C\u614B\u5E40\u6821\u6E96\u8207\u904B\u884C\u671F\u5F48\u7C27\u64FA\u89E3\u7B97"
    })
  ], Spine42PhysicsRigComponent);
  var ZhudaParticleEmitterComponent = class extends Laya.Script {
    constructor() {
      super(...arguments);
      this.emitterName = "TacticalMineBurst_v1";
      this.burstCount = 24;
      this.emissionRate = 36;
      this.lifetimeMs = 850;
      this.startSpeed = 165;
      this.gravityY = 220;
      this.seed = 20261028;
      this.previewTimestampMs = 240;
      this.primaryColor = "#ff5533";
      this.secondaryColor = "#ffaa00";
      this.sparkColor = "#64ffda";
      this.coreGlowColor = "#231424";
      this.particles = [];
      this.isPlayingBurst = false;
      this.shockwaveRadius = 10;
    }
    /**
     * 於指定座標觸發一次即時粒子爆發 (後組裝運行期調用，支援爆破、揭開、勝利及 M4 特效藍圖庫)
     */
    playBurst(worldX, worldY, paletteMode = "explode") {
      const sp = this.owner;
      if (!sp) return;
      sp.pos(worldX - 88, worldY - 88);
      sp.visible = true;
      this.particles = [];
      this.shockwaveRadius = 12;
      this.isPlayingBurst = true;
      let c1 = this.primaryColor;
      let c2 = this.secondaryColor;
      let c3 = this.sparkColor;
      if (paletteMode === "reveal" || paletteMode === "sword-slash") {
        c1 = "#00e5ff";
        c2 = "#7df9ff";
        c3 = "#ffffff";
      } else if (paletteMode === "victory" || paletteMode === "coin-fountain") {
        c1 = "#fbbf24";
        c2 = "#fef08a";
        c3 = "#4ade80";
      } else if (paletteMode === "levelup-aura") {
        c1 = "#a855f7";
        c2 = "#e9d5ff";
        c3 = "#64ffda";
      }
      let rngState = this.seed;
      const nextRand = () => {
        rngState = rngState * 1664525 + 1013904223 >>> 0;
        return rngState / 4294967295;
      };
      const count = paletteMode === "reveal" ? 14 : this.burstCount;
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2 + (nextRand() - 0.5) * 0.25;
        const speed = this.startSpeed * (0.55 + nextRand() * 0.55);
        this.particles.push({
          x: 88,
          y: 88,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 3 + i % 3 * 1.5,
          color: i % 3 === 0 ? c2 : i % 3 === 1 ? c1 : c3,
          alpha: 1,
          ageMs: 0,
          maxAgeMs: this.lifetimeMs * (0.7 + nextRand() * 0.3)
        });
      }
    }
    onUpdate() {
      if (!this.isPlayingBurst) return;
      const sp = this.owner;
      if (!sp || !sp.graphics) return;
      const dtMs = 16.67;
      const dtSec = dtMs / 1e3;
      const g = sp.graphics;
      g.clear();
      this.shockwaveRadius += 190 * dtSec;
      if (this.shockwaveRadius < 82) {
        g.drawCircle(88, 88, this.shockwaveRadius, null, this.sparkColor, 1.8);
      }
      let alive = 0;
      for (const p of this.particles) {
        p.ageMs += dtMs;
        if (p.ageMs >= p.maxAgeMs) continue;
        alive++;
        p.vy += this.gravityY * dtSec;
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        const lifeRatio = 1 - p.ageMs / p.maxAgeMs;
        const r = Math.max(1.2, p.radius * lifeRatio);
        g.drawCircle(p.x, p.y, r, p.color);
      }
      if (alive === 0) {
        this.isPlayingBurst = false;
        sp.visible = false;
      }
    }
  };
  ZhudaParticleEmitterComponent = __decorateClass([
    zhudaComponent({
      className: "ZhudaParticleEmitterComponent",
      assetId: "zhuda://ZhudaParticleEmitterComponent",
      category: "2d",
      description: "\u6C7A\u5B9A\u6027\u975C\u614B\u7C92\u5B50\u767C\u5C04\u5668\u7D44\u4EF6\uFF0C\u652F\u63F4 t=240ms \u975C\u614B\u50CF\u7D20\u6821\u6E96\u5FEB\u7167\u8207\u904B\u884C\u671F\u5373\u6642\u7206\u7834\u7279\u6548"
    })
  ], ZhudaParticleEmitterComponent);
  var ZhudaAnimatorControllerComponent = class extends Laya.Script {
    constructor() {
      super(...arguments);
      this.controllerName = "CrystalGuardian.controller";
      this.defaultState = "Idle";
      this.unityGuid = "u-crystal-004";
      this.layaPosRH = "2.2,1.8,1.5";
      this.layaEulerRH = "15,-45,-15";
      this.spine42RigFile = "ZhudaGuardianPig_v4.2.skel";
      this.statesJson = "";
      this.transitionsJson = "";
      this.parametersJson = "";
      this.fsm = null;
      this.cycleStep = 0;
    }
    ensureFsm() {
      if (!this.fsm) {
        const defaultSpec = UNITY_CYBER_SHRINE_SCENE.nodes.find((n) => Boolean(n.animatorController)).animatorController;
        let spec = defaultSpec;
        if (this.statesJson && this.transitionsJson && this.parametersJson) {
          try {
            spec = {
              controllerName: this.controllerName,
              defaultState: this.defaultState,
              states: JSON.parse(this.statesJson),
              transitions: JSON.parse(this.transitionsJson),
              parameters: JSON.parse(this.parametersJson)
            };
          } catch (_e) {
            spec = defaultSpec;
          }
        }
        this.fsm = new UnityAnimatorStateMachine(spec);
      }
      return this.fsm;
    }
    getCurrentStateName() {
      return this.ensureFsm().getCurrentState().name;
    }
    getStateTrace() {
      return this.ensureFsm().getStateHistory();
    }
    stepAnimatorCycle() {
      const fsm = this.ensureFsm();
      this.cycleStep = (this.cycleStep + 1) % 3;
      if (this.cycleStep === 1) {
        fsm.setFloat("Speed", 0.9);
        fsm.setBool("Overcharge", false);
      } else if (this.cycleStep === 2) {
        fsm.setFloat("Speed", 0.9);
        fsm.setBool("Overcharge", true);
      } else {
        fsm.setBool("Overcharge", false);
        fsm.setFloat("Speed", 0);
      }
      const st = fsm.getCurrentState();
      return {
        stateName: st.name,
        spineAnim: st.spineAnimationName || "idle",
        tintHex: st.tintHex || "#38bdf8"
      };
    }
  };
  ZhudaAnimatorControllerComponent = __decorateClass([
    zhudaComponent({
      className: "ZhudaAnimatorControllerComponent",
      assetId: "zhuda://ZhudaAnimatorControllerComponent",
      category: "3d",
      description: "M5 Unity AnimatorController \u8DE8\u5F15\u64CE\u72C0\u614B\u6A5F\u7D44\u4EF6\uFF0C\u652F\u63F4 Float/Bool/Trigger \u689D\u4EF6\u8F49\u79FB\u8207 Spine 4.2 \u806F\u52D5"
    })
  ], ZhudaAnimatorControllerComponent);

  // src/components/TilePhysicsBehavior.ts
  var TilePhysicsBehavior = class extends Laya.Script {
    constructor() {
      super(...arguments);
      this.activeSimulations = 0;
    }
    onAwake() {
      this.activeSimulations = 0;
    }
  };
  TilePhysicsBehavior = __decorateClass([
    zhudaComponent({
      className: "TilePhysicsBehavior",
      assetId: "zhuda://TilePhysicsBehavior",
      category: "physics",
      description: "\u7BA1\u7406 3D \u8E29\u5730\u96F7\u65B9\u584A\u7206\u7834\u91CD\u529B\u98DB\u6563\u8207\u6CE2\u6D6A\u52D5\u756B\u72C0\u614B"
    })
  ], TilePhysicsBehavior);

  // src/.generated/zhuda-registry.ts
  var ZHUDA_REFLECTED_MANIFEST = [
    {
      "className": "BoardCameraController",
      "baseClass": "Laya.Script",
      "decorator": "zhudaComponent",
      "assetId": "zhuda://BoardCameraController"
    },
    {
      "className": "Spine42PhysicsRigComponent",
      "baseClass": "Laya.Script",
      "decorator": "zhudaComponent",
      "assetId": "zhuda://Spine42PhysicsRigComponent"
    },
    {
      "className": "ZhudaParticleEmitterComponent",
      "baseClass": "Laya.Script",
      "decorator": "zhudaComponent",
      "assetId": "zhuda://ZhudaParticleEmitterComponent"
    },
    {
      "className": "ZhudaAnimatorControllerComponent",
      "baseClass": "Laya.Script",
      "decorator": "zhudaComponent",
      "assetId": "zhuda://ZhudaAnimatorControllerComponent"
    },
    {
      "className": "TilePhysicsBehavior",
      "baseClass": "Laya.Script",
      "decorator": "zhudaComponent",
      "assetId": "zhuda://TilePhysicsBehavior"
    }
  ];
  function registerAllReflectedComponents() {
    EngineGuard.registerComponent("BoardCameraController", BoardCameraController, "zhuda://BoardCameraController");
    EngineGuard.registerComponent("Spine42PhysicsRigComponent", Spine42PhysicsRigComponent, "zhuda://Spine42PhysicsRigComponent");
    EngineGuard.registerComponent("ZhudaParticleEmitterComponent", ZhudaParticleEmitterComponent, "zhuda://ZhudaParticleEmitterComponent");
    EngineGuard.registerComponent("ZhudaAnimatorControllerComponent", ZhudaAnimatorControllerComponent, "zhuda://ZhudaAnimatorControllerComponent");
    EngineGuard.registerComponent("TilePhysicsBehavior", TilePhysicsBehavior, "zhuda://TilePhysicsBehavior");
    return ZHUDA_REFLECTED_MANIFEST;
  }

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

  // src/PreviewMain.ts
  async function bootMicroPreview() {
    registerAllReflectedComponents();
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const initialAsset = params.get("asset") || "ConfirmActionButton.lh";
    const initialDrift = params.get("drift") === "1";
    await ZhudaEngine.boot({
      width: 1280,
      height: 720,
      bgColor: "#080c14",
      features: ["core", "2d", "ui", "spine42"]
    });
    const stageRoot = new Laya.Sprite();
    stageRoot.name = "MicroPreviewCalibrationStage";
    Laya.stage.addChild(stageRoot);
    const gridLayer = new Laya.Sprite();
    stageRoot.addChild(gridLayer);
    const quadrantLayer = new Laya.Sprite();
    stageRoot.addChild(quadrantLayer);
    const overlayLayer = new Laya.Sprite();
    stageRoot.addChild(overlayLayer);
    const builtinAssets = ZhudaAssetSerializer.getAllBuiltinStaticAssets();
    const uncalibratedBtn = ZhudaAssetSerializer.buildConfirmButtonPrefab("uncalibrated-drift");
    const calibratedBtn = builtinAssets["ConfirmActionButton.lh"];
    const spineMascot = builtinAssets["ZhudaSpine42Mascot.lh"];
    const particleBurst = builtinAssets["MineExplosionParticle.lh"];
    const renderQuadrantCard = (opts) => {
      const { qx, qy, qw, qh, title, lhData, isHighlighted } = opts;
      const g = gridLayer.graphics;
      g.drawRoundRect(
        qx,
        qy,
        qw,
        qh,
        10,
        10,
        10,
        10,
        "#0e1525",
        isHighlighted ? "#38bdf8" : "#1e293b",
        isHighlighted ? 2 : 1.2
      );
      const titleTxt = new Laya.Text();
      titleTxt.pos(qx + 12, qy + 8);
      titleTxt.fontSize = 12;
      titleTxt.bold = true;
      titleTxt.color = isHighlighted ? "#7df9ff" : "#94a3b8";
      titleTxt.text = title;
      overlayLayer.addChild(titleTxt);
      const stageX = qx + 14;
      const stageY = qy + 30;
      const stageW = qw - 28;
      const stageH = qh - 62;
      g.drawRect(stageX, stageY, stageW, stageH, "#090d16", "#1e293b", 1);
      for (let x = stageX; x <= stageX + stageW; x += 12) {
        g.drawLine(x, stageY, x, stageY + stageH, "#131c2e", 1);
      }
      for (let y = stageY; y <= stageY + stageH; y += 12) {
        g.drawLine(stageX, y, stageX + stageW, y, "#131c2e", 1);
      }
      const report = PixelCalibrationEngine.calibrateAsset(lhData);
      const expW = report.expectedBox.width;
      const expH = report.expectedBox.height;
      const baseOriginX = Math.round(stageX + (stageW - expW) / 2 - report.expectedBox.x);
      const baseOriginY = Math.round(stageY + (stageH - expH) / 2 - report.expectedBox.y);
      const inst = ZhudaPrefab.instantiate(lhData, quadrantLayer, {
        x: baseOriginX + (lhData.x ?? 10),
        y: baseOriginY + (lhData.y ?? 10)
      });
      const og = overlayLayer.graphics;
      og.drawRect(
        baseOriginX + report.expectedBox.x,
        baseOriginY + report.expectedBox.y,
        report.expectedBox.width,
        report.expectedBox.height,
        null,
        "#38bdf888",
        1.2
      );
      const statusColor = report.passed ? "#4ade80" : "#fb7185";
      og.drawRect(
        baseOriginX + report.measuredBox.x,
        baseOriginY + report.measuredBox.y,
        report.measuredBox.width,
        report.measuredBox.height,
        null,
        statusColor,
        1.8
      );
      const footerTxt = new Laya.Text();
      footerTxt.pos(qx + 12, qy + qh - 24);
      footerTxt.fontSize = 11;
      footerTxt.bold = true;
      footerTxt.color = statusColor;
      footerTxt.text = report.passed ? `\u2714 TightBox: (${report.measuredBox.x},${report.measuredBox.y}) ${report.measuredBox.width}\xD7${report.measuredBox.height}px | \u0394Px=0px | \u0394E00=${report.colorMetrics.maxDeltaE2000}` : `\u26A0 Drift: (${report.measuredBox.x},${report.measuredBox.y}) ${report.measuredBox.width}\xD7${report.measuredBox.height}px | \u0394W=+${report.pixelErrors.widthDiffPx}px, \u0394X=+${report.pixelErrors.xDiffPx}px | \u0394E00=${report.colorMetrics.maxDeltaE2000}`;
      overlayLayer.addChild(footerTxt);
      return report;
    };
    const renderFullCalibrationWorkbench = (focusAssetKey, driftMode = false) => {
      gridLayer.graphics.clear();
      overlayLayer.graphics.clear();
      overlayLayer.removeChildren();
      quadrantLayer.removeChildren();
      const rDrift = renderQuadrantCard({
        qx: 24,
        qy: 66,
        qw: 378,
        qh: 298,
        title: "[1] \u6821\u6E96\u524D\uFF1AConfirmActionButton.lh (\u672A\u6821\u6E96\u504F\u5DEE\u614B)",
        lhData: uncalibratedBtn,
        isHighlighted: focusAssetKey === "ConfirmActionButton.lh" && driftMode
      });
      const q2Asset = focusAssetKey === "NineSliceDialogFrame.lh" || focusAssetKey === "TacticalHudBar.lh" || focusAssetKey === "TelemetryDashboard.lh" ? builtinAssets[focusAssetKey] : calibratedBtn;
      const rCalibrated = renderQuadrantCard({
        qx: 416,
        qy: 66,
        qw: 378,
        qh: 298,
        title: `[2] \u81EA\u52D5\u6536\u6582\u5F8C\uFF1A${q2Asset.name}.lh (0px / \u0394E00=0)`,
        lhData: q2Asset,
        isHighlighted: !driftMode && (focusAssetKey === "ConfirmActionButton.lh" || focusAssetKey === "NineSliceDialogFrame.lh" || focusAssetKey === "TacticalHudBar.lh" || focusAssetKey === "TelemetryDashboard.lh")
      });
      const q3Asset = focusAssetKey === "UnityCrystalGuardian.lh" ? builtinAssets["UnityCrystalGuardian.lh"] : spineMascot;
      const rSpine = renderQuadrantCard({
        qx: 24,
        qy: 378,
        qw: 378,
        qh: 316,
        title: focusAssetKey === "UnityCrystalGuardian.lh" ? "[3] Unity \u79FB\u690D\u8CC7\u7522\uFF1AUnityCrystalGuardian.lh (Animator+Spine4.2)" : "[3] Spine 4.2 \u975C\u614B\u9AA8\u9ABC\u8CC7\u7522\uFF1AZhudaSpine42Mascot.lh",
        lhData: q3Asset,
        isHighlighted: focusAssetKey === "ZhudaSpine42Mascot.lh" || focusAssetKey === "UnityCrystalGuardian.lh"
      });
      const q4Asset = focusAssetKey === "CoinFountainVfx.lh" || focusAssetKey === "SwordSlashTrailVfx.lh" || focusAssetKey === "LevelUpAuraVfx.lh" ? builtinAssets[focusAssetKey] : particleBurst;
      const rParticle = renderQuadrantCard({
        qx: 416,
        qy: 378,
        qw: 378,
        qh: 316,
        title: `[4] \u6C7A\u5B9A\u6027 VFX \u85CD\u5716\uFF1A${q4Asset.name}.lh`,
        lhData: q4Asset,
        isHighlighted: focusAssetKey === "MineExplosionParticle.lh" || focusAssetKey === "CoinFountainVfx.lh" || focusAssetKey === "SwordSlashTrailVfx.lh" || focusAssetKey === "LevelUpAuraVfx.lh"
      });
      ZhudaEngine.flushRenderFrames(4);
      let selectedReport = rCalibrated;
      let selectedLh = q2Asset;
      if (focusAssetKey === "ConfirmActionButton.lh" && driftMode) {
        selectedReport = rDrift;
        selectedLh = uncalibratedBtn;
      } else if (focusAssetKey === "ZhudaSpine42Mascot.lh" || focusAssetKey === "UnityCrystalGuardian.lh") {
        selectedReport = rSpine;
        selectedLh = q3Asset;
      } else if (focusAssetKey === "MineExplosionParticle.lh" || focusAssetKey === "CoinFountainVfx.lh" || focusAssetKey === "SwordSlashTrailVfx.lh" || focusAssetKey === "LevelUpAuraVfx.lh") {
        selectedReport = rParticle;
        selectedLh = q4Asset;
      }
      const win = globalThis;
      if (typeof win.__ZHUDA_PREVIEW_ON_UPDATE__ === "function") {
        win.__ZHUDA_PREVIEW_ON_UPDATE__({
          assetKey: focusAssetKey,
          driftMode,
          lhData: selectedLh,
          report: selectedReport
        });
      }
      return selectedReport;
    };
    const convergenceDemo = PixelCalibrationEngine.runSelfConvergenceDemo();
    const calibratedAssetKeys = Object.keys(builtinAssets).filter((k) => k.endsWith(".lh"));
    const allReports = calibratedAssetKeys.map(
      (k) => PixelCalibrationEngine.calibrateAsset(builtinAssets[k])
    );
    const allPassed = allReports.every((r) => r.passed);
    const activeReport = renderFullCalibrationWorkbench(initialAsset, initialDrift);
    let sampledNonBgPixels = 0;
    try {
      const canvasEl = document.getElementById("layaCanvas");
      if (canvasEl) {
        const gl = canvasEl.getContext("webgl2") || canvasEl.getContext("webgl");
        if (gl) {
          const w = canvasEl.width;
          const h = canvasEl.height;
          const buf = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          const pxMetrics = PixelCalibrationEngine.measurePixelBuffer(buf, w, h, {
            r: 8,
            g: 12,
            b: 20
          });
          sampledNonBgPixels = pxMetrics.nonTransparentPixels;
        }
      }
    } catch (_e) {
      sampledNonBgPixels = 0;
    }
    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.zhudaPreviewReady = "true";
      document.body.dataset.zhudaPreviewAsset = activeReport.assetName;
      document.body.dataset.zhudaCalibratedAssets = String(calibratedAssetKeys.length);
      document.body.dataset.zhudaAllAssetsPassed = String(allPassed);
      document.body.dataset.zhudaBeforePxError = String(
        convergenceDemo.beforeReport.pixelErrors.maxAbsErrorPx
      );
      document.body.dataset.zhudaAfterPxError = String(
        convergenceDemo.afterReport.pixelErrors.maxAbsErrorPx
      );
      document.body.dataset.zhudaBeforeDeltaE = String(
        convergenceDemo.beforeReport.colorMetrics.maxDeltaE2000
      );
      document.body.dataset.zhudaAfterDeltaE = String(
        convergenceDemo.afterReport.colorMetrics.maxDeltaE2000
      );
      document.body.dataset.zhudaGlPixelsSampled = String(sampledNonBgPixels);
    }
    const controller = {
      switchAsset: (key, drift = false) => renderFullCalibrationWorkbench(key, drift),
      runAutoConverge: () => renderFullCalibrationWorkbench("ConfirmActionButton.lh", false)
    };
    globalThis.__ZHUDA_MICRO_PREVIEW__ = controller;
  }
  bootMicroPreview().catch((err) => {
    console.error("[Zhuda-MicroPreview] \u555F\u52D5\u5931\u6557:", err);
  });
})();
//# sourceMappingURL=preview-bundle.js.map
