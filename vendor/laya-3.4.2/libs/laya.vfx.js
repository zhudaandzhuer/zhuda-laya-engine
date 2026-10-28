(function (exports, Laya) {
    'use strict';

    exports.VFXUpdateMode = void 0;
    (function (VFXUpdateMode) {
        VFXUpdateMode[VFXUpdateMode["FixedDeltaTime"] = 0] = "FixedDeltaTime";
        VFXUpdateMode[VFXUpdateMode["DeltaTime"] = 1] = "DeltaTime";
        VFXUpdateMode[VFXUpdateMode["IgnoreTimeScale"] = 2] = "IgnoreTimeScale";
        VFXUpdateMode[VFXUpdateMode["ExactFixedTimeStep"] = 4] = "ExactFixedTimeStep";
    })(exports.VFXUpdateMode || (exports.VFXUpdateMode = {}));
    class VFXEventDesc {
        constructor() {
            this.playSystems = [];
            this.stopSystems = [];
            this.initSystems = [];
        }
    }
    exports.VFXSpawnerTaskType = void 0;
    (function (VFXSpawnerTaskType) {
        VFXSpawnerTaskType["ConstantRate"] = "ConstantRate";
        VFXSpawnerTaskType["SingleBurst"] = "SingleBurst";
        VFXSpawnerTaskType["PeriodicBurst"] = "PeriodicBurst";
        VFXSpawnerTaskType["SpawnOverDistance"] = "SpawnOverDistance";
        VFXSpawnerTaskType["CustomWrapper"] = "CustomWrapper";
        VFXSpawnerTaskType["SetEventAttribute"] = "SetEventAttribute";
    })(exports.VFXSpawnerTaskType || (exports.VFXSpawnerTaskType = {}));
    class VFXSpawnerConstantRateTaskDesc {
        constructor() {
            this.type = exports.VFXSpawnerTaskType.ConstantRate;
            this.rate = 1;
        }
    }
    class VFXSpawnerSingleBurstTaskDesc {
        constructor() {
            this.type = exports.VFXSpawnerTaskType.SingleBurst;
            this.delay = new Laya.Vector2();
            this.count = new Laya.Vector2(1, 1);
            this.countFromLoopIndex = false;
            this.countModulo = 0;
        }
    }
    class VFXSpawnerPeriodicBurstTaskDesc {
        constructor() {
            this.type = exports.VFXSpawnerTaskType.PeriodicBurst;
            this.delay = new Laya.Vector2(1, 1);
            this.count = new Laya.Vector2(1, 1);
        }
    }
    class VFXSpawnerOverDistanceTaskDesc {
        constructor() {
            this.type = exports.VFXSpawnerTaskType.SpawnOverDistance;
            this.distance = 1;
        }
    }
    class VFXSpawnerCustomWrapperTaskDesc {
        constructor() {
            this.type = exports.VFXSpawnerTaskType.CustomWrapper;
            this.callbackName = "default";
        }
    }
    class VFXSpawnerSetEventAttributeTaskDesc {
        constructor() {
            this.type = exports.VFXSpawnerTaskType.SetEventAttribute;
            this.attribute = "lifetime";
            this.value = [0, 0, 0, 0];
            this.fromLoopIndex = false;
            this.loopIndexModulo = 0;
            this.fromSpawnStateLoop = false;
        }
    }
    exports.VFXGPUEventType = void 0;
    (function (VFXGPUEventType) {
        VFXGPUEventType["OnDie"] = "OnDie";
        VFXGPUEventType["Always"] = "Always";
        VFXGPUEventType["OverTime"] = "OverTime";
        VFXGPUEventType["OverDistance"] = "OverDistance";
    })(exports.VFXGPUEventType || (exports.VFXGPUEventType = {}));
    class VFXOutputEventDesc {
        constructor() {
            this.entryFloats = 16;
            this.entryBytes = 64;
        }
    }
    exports.VFXSimulateSpace = void 0;
    (function (VFXSimulateSpace) {
        VFXSimulateSpace[VFXSimulateSpace["Local"] = 0] = "Local";
        VFXSimulateSpace[VFXSimulateSpace["World"] = 1] = "World";
    })(exports.VFXSimulateSpace || (exports.VFXSimulateSpace = {}));
    exports.VFXBoundsMode = void 0;
    (function (VFXBoundsMode) {
        VFXBoundsMode[VFXBoundsMode["Automatic"] = 0] = "Automatic";
        VFXBoundsMode[VFXBoundsMode["Manual"] = 1] = "Manual";
    })(exports.VFXBoundsMode || (exports.VFXBoundsMode = {}));
    exports.VFXBlendMode = void 0;
    (function (VFXBlendMode) {
        VFXBlendMode["Alpha"] = "Alpha";
        VFXBlendMode["Additive"] = "Additive";
        VFXBlendMode["Premultiplied"] = "Premultiplied";
        VFXBlendMode["Opaque"] = "Opaque";
    })(exports.VFXBlendMode || (exports.VFXBlendMode = {}));
    exports.VFXSystemType = void 0;
    (function (VFXSystemType) {
        VFXSystemType["Spawner"] = "Spawner";
        VFXSystemType["Particle"] = "Particle";
        VFXSystemType["StaticMesh"] = "StaticMesh";
    })(exports.VFXSystemType || (exports.VFXSystemType = {}));
    class VFXStaticMeshSystemDesc {
        constructor() {
            this.type = exports.VFXSystemType.StaticMesh;
            this.mesh = null;
            this.materialUuid = "";
            this.bindings = [];
        }
    }
    class VFXSpawnerSystemDesc {
        constructor() {
            this.type = exports.VFXSystemType.Spawner;
            this.loopCount = new Laya.Vector2(-1, -1);
            this.loopDuration = new Laya.Vector2(-1, -1);
            this.delayBeforeLoop = 0;
            this.delayAfterLoop = 0;
            this.tasks = [];
            this.onPlayInputs = [];
            this.onStopInputs = [];
        }
    }
    class VFXParticleSystemDesc {
        constructor() {
            this.type = exports.VFXSystemType.Particle;
            this.outputType = "outputMesh";
            this.spawnerSystems = [];
            this.receiveGPUEvent = false;
            this.gpuEventInput = null;
            this.simulateSpace = exports.VFXSimulateSpace.Local;
            this.boundsMode = exports.VFXBoundsMode.Automatic;
            this.boundsCenter = new Laya.Vector3(0, 0, 0);
            this.boundsExtents = new Laya.Vector3(1, 1, 1);
            this.particlePerStripCount = 128;
            this.stripCapacity = 1;
            this.blendMode = exports.VFXBlendMode.Alpha;
            this.softParticleFade = 0;
            this.uvMode = "Default";
            this.flipbookSize = new Laya.Vector2(4, 4);
            this.mainTexture = "";
            this.subpixelAA = false;
            this.customShaderName = "";
            this.billboardPrimitive = "";
            this.billboardVertexCount = 0;
            this.billboardCropFactor = 0.146;
            this.useAlphaClipping = false;
            this.alphaThreshold = 0.5;
            this.stripColorMapping = "Default";
            this.stripUvScale = { x: 1, y: 1 };
            this.stripUvBias = { x: 0, y: 0 };
            this.stripGradientStops = [];
            this.distortionMode = "Procedural";
            this.extraOutputs = [];
            this.textureUniforms = [];
            this.bufferUniforms = [];
            this.meshPointBuffers = [];
            this.outputEvents = [];
        }
    }
    class VFXExtraOutputDesc {
        constructor() {
            this.outputType = "outputMesh";
            this.blendMode = exports.VFXBlendMode.Alpha;
            this.softParticleFade = 0;
            this.uvMode = "Default";
            this.flipbookSize = new Laya.Vector2(4, 4);
            this.mainTexture = "";
            this.subpixelAA = false;
            this.customShaderName = "";
            this.stripCapacity = 1;
            this.particlePerStripCount = 128;
            this.textureUniforms = [];
            this.billboardPrimitive = "";
            this.billboardVertexCount = 0;
            this.billboardCropFactor = 0.146;
            this.useAlphaClipping = false;
            this.alphaThreshold = 0.5;
            this.tilingMode = "Stretch";
            this.colorMapping = "Default";
        }
    }
    exports.VFXPropertyType = void 0;
    (function (VFXPropertyType) {
        VFXPropertyType["Float"] = "float";
        VFXPropertyType["Vec2"] = "vec2";
        VFXPropertyType["Vec3"] = "vec3";
        VFXPropertyType["Vec4"] = "vec4";
        VFXPropertyType["Color"] = "color";
        VFXPropertyType["Gradient"] = "gradient";
        VFXPropertyType["Texture2D"] = "texture2D";
        VFXPropertyType["Curve"] = "curve";
    })(exports.VFXPropertyType || (exports.VFXPropertyType = {}));
    class VFXPropertyDesc {
    }
    class VFXCurveUniformDesc {
    }
    class VFXAsset extends Laya.Resource {
        constructor() {
            super(true);
            this.updateMode = exports.VFXUpdateMode.FixedDeltaTime;
            this.initialEventName = "OnPlay";
            this.prewarmStepCount = 0;
            this.prewarmDeltaTime = 0;
            this.preWarmTotalTime = 0;
            this.properties = [];
            this.events = new Map();
            this.systems = [];
            this.curveUniforms = [];
            this.bakedTexture = null;
        }
        getEvents() {
            return this.events;
        }
        resolveDeps() {
            for (const desc of this.systems) {
                if (desc.type === exports.VFXSystemType.Particle) {
                    const particleDesc = desc;
                    if (particleDesc.mesh) {
                        this.addDep(particleDesc.mesh);
                    }
                }
            }
            if (this.bakedTexture) {
                this.addDep(this.bakedTexture);
            }
        }
        _disposeResource() {
            this.events.clear();
            this.systems = [];
            this.curveUniforms = [];
            this.bakedTexture = null;
        }
    }

    class VFXGeometryParams {
    }
    function findGpuVertexBuffer(...sources) {
        for (const src of sources) {
            if (!src)
                continue;
            if ('verteBufferLayout' in src)
                return src;
            for (const key of Object.getOwnPropertyNames(src)) {
                const val = src[key];
                if (val && typeof val === 'object' && 'verteBufferLayout' in val) {
                    return val;
                }
            }
        }
        return sources[0];
    }
    class VFXGeometry extends Laya.GeometryElement {
        static init() {
            const particleAttris = [
                Laya.VertexElementFormat.Vector4,
                Laya.VertexElementFormat.Vector4,
                Laya.VertexElementFormat.Vector4,
                Laya.VertexElementFormat.Vector4,
                Laya.VertexElementFormat.Vector4,
            ];
            const createDecl = (attris) => {
                const vertexElements = [];
                let offset = 0;
                for (let i = 0; i < attris.length; i++) {
                    const format = attris[i];
                    const vertexElement = new Laya.VertexElement(offset, format, i + 8);
                    vertexElements.push(vertexElement);
                    switch (format) {
                        case Laya.VertexElementFormat.Vector4:
                            offset += 16;
                            break;
                        default:
                            throw "VFXGeometry: not support format.";
                    }
                }
                return new Laya.VertexDeclaration(offset, vertexElements);
            };
            VFXGeometry.ParticleDecl = createDecl(particleAttris);
        }
        get mesh() {
            return this._mesh;
        }
        constructor(params) {
            var _a, _b;
            super(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElementIndirect);
            this._particleVertex = null;
            this.bounds = new Laya.Bounds(new Laya.Vector3(-0.5, -0.5, -0.5), new Laya.Vector3(0.5, 0.5, 0.5));
            this.blendMode = "Alpha";
            this.outputType = "outputMesh";
            this.softParticleFade = 0;
            this.uvMode = "Default";
            this.flipbookSize = new Laya.Vector2(4, 4);
            this.subpixelAA = false;
            this.customShaderName = "";
            this.capacity = params.capacity;
            this._mesh = params.mesh;
            this.indexFormat = params.mesh.indexFormat;
            const particleVertex = params.particleBuffer;
            this._particleVertex = particleVertex;
            const meshIndexBuffer = (_a = params.mesh.indexBuffer) !== null && _a !== void 0 ? _a : params.mesh._indexBuffer;
            const meshVertexBuffer = (_b = params.mesh.vertexBuffer) !== null && _b !== void 0 ? _b : params.mesh._vertexBuffer;
            findGpuVertexBuffer(meshVertexBuffer);
            const particleGpuVB = findGpuVertexBuffer(params.particleDeviceBuffer, particleVertex);
            if (particleGpuVB && particleGpuVB !== particleVertex && 'vertexDeclaration' in particleGpuVB) {
                particleGpuVB.vertexDeclaration = VFXGeometry.ParticleDecl;
                particleGpuVB.instanceBuffer = true;
            }
            this.bufferState = new Laya.BufferState();
            this.bufferState.applyState([meshVertexBuffer, particleVertex], meshIndexBuffer);
            this.indirectBuffer = params.indirectBuffer;
            const indirectData = new Uint32Array(5);
            indirectData[0] = meshIndexBuffer.indexCount;
            indirectData[1] = 0;
            indirectData[2] = 0;
            indirectData[3] = 0;
            indirectData[4] = 0;
            this.indirectBuffer.deviceBuffer.setData(indirectData.buffer, 0, 0, indirectData.byteLength);
        }
        _updateRenderParams(state) {
            this.clearRenderParams();
            this._geometryElementOBj.setIndirectDrawBuffer(this.indirectBuffer.deviceBuffer, 0);
        }
        setMesh(mesh) {
            var _a, _b, _c, _d, _e, _f;
            if (!mesh || mesh === this._mesh)
                return;
            const meshIndexBuffer = (_a = mesh.indexBuffer) !== null && _a !== void 0 ? _a : mesh._indexBuffer;
            const meshVertexBuffer = (_b = mesh.vertexBuffer) !== null && _b !== void 0 ? _b : mesh._vertexBuffer;
            if (!meshIndexBuffer || !meshVertexBuffer) {
                console.warn("[VFX] VFXGeometry.setMesh: 新 mesh 无 vertex/index buffer，跳过", mesh);
                return;
            }
            try {
                (_d = (_c = mesh)._addReference) === null || _d === void 0 ? void 0 : _d.call(_c);
            }
            catch (_g) { }
            try {
                (_f = (_e = this._mesh) === null || _e === void 0 ? void 0 : _e._removeReference) === null || _f === void 0 ? void 0 : _f.call(_e);
            }
            catch (_h) { }
            this._mesh = mesh;
            this.indexFormat = mesh.indexFormat;
            const oldState = this.bufferState;
            this.bufferState = new Laya.BufferState();
            this.bufferState.applyState([meshVertexBuffer, this._particleVertex], meshIndexBuffer);
            try {
                oldState === null || oldState === void 0 ? void 0 : oldState.destroy();
            }
            catch (_j) { }
            const indirectData = new Uint32Array(5);
            indirectData[0] = meshIndexBuffer.indexCount;
            this.indirectBuffer.deviceBuffer.setData(indirectData.buffer, 0, 0, indirectData.byteLength);
        }
        destroy() {
            var _a;
            super.destroy();
            this.clearRenderParams();
            this.indirectBuffer = null;
            this._mesh._removeReference();
            (_a = this.bufferState) === null || _a === void 0 ? void 0 : _a.destroy();
        }
    }

    class VFXStripGeometryParams {
    }
    class VFXStripGeometry extends Laya.GeometryElement {
        static init() {
            VFXStripGeometry.StripVertexDecl = new Laya.VertexDeclaration(64, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 0),
                new Laya.VertexElement(16, Laya.VertexElementFormat.Vector4, 1),
                new Laya.VertexElement(32, Laya.VertexElementFormat.Vector2, 2),
                new Laya.VertexElement(48, Laya.VertexElementFormat.Vector3, 3),
            ]);
        }
        constructor(params) {
            super(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElementIndirect);
            this.blendMode = "Alpha";
            this.bounds = new Laya.Bounds(new Laya.Vector3(-10, -10, -10), new Laya.Vector3(10, 10, 10));
            if (!VFXStripGeometry.StripVertexDecl) {
                VFXStripGeometry.init();
            }
            this.capacity = params.capacity;
            const vb3d = params.stripVertexBuffer.vertexBuffer;
            vb3d.vertexDeclaration = VFXStripGeometry.StripVertexDecl;
            const stripCapacity = params.stripCapacity || 1;
            const ppsc = params.particlePerStripCount || params.capacity;
            const quadsPerStrip = ppsc - 1;
            const indexCount = stripCapacity * quadsPerStrip * 6;
            const indexData = new Uint32Array(indexCount);
            for (let s = 0; s < stripCapacity; s++) {
                const stripVertBase = s * ppsc * 2;
                for (let i = 0; i < quadsPerStrip; i++) {
                    const idx = (s * quadsPerStrip + i) * 6;
                    const v = stripVertBase + i * 2;
                    indexData[idx + 0] = v;
                    indexData[idx + 1] = v + 1;
                    indexData[idx + 2] = v + 2;
                    indexData[idx + 3] = v + 2;
                    indexData[idx + 4] = v + 1;
                    indexData[idx + 5] = v + 3;
                }
            }
            const indexBuffer = new Laya.IndexBuffer3D(Laya.IndexFormat.UInt32, indexCount, Laya.BufferUsage.Static);
            indexBuffer.setData(indexData);
            this.indexFormat = Laya.IndexFormat.UInt32;
            this.bufferState = new Laya.BufferState();
            this.bufferState.applyState([vb3d], indexBuffer);
            this.indirectBuffer = params.indirectBuffer;
            const indirectData = new Uint32Array(5);
            indirectData[0] = 0;
            indirectData[1] = 1;
            indirectData[2] = 0;
            indirectData[3] = 0;
            indirectData[4] = 0;
            this.indirectBuffer.deviceBuffer.setData(indirectData.buffer, 0, 0, indirectData.byteLength);
        }
        _updateRenderParams(state) {
            this.clearRenderParams();
            this._geometryElementOBj.setIndirectDrawBuffer(this.indirectBuffer.deviceBuffer, 0);
        }
        destroy() {
            var _a;
            super.destroy();
            this.clearRenderParams();
            this.indirectBuffer = null;
            (_a = this.bufferState) === null || _a === void 0 ? void 0 : _a.destroy();
        }
    }

    class VFXRenderer extends Laya.BaseRender {
        static getDefaultDotTexture() {
            if (VFXRenderer._defaultDotTexture)
                return VFXRenderer._defaultDotTexture;
            const size = 64;
            const data = new Uint8Array(size * size * 4);
            const c = (size - 1) * 0.5;
            const radius = c;
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dx = (x - c) / radius;
                    const dy = (y - c) / radius;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    let t = 1.0 - d;
                    if (t < 0)
                        t = 0;
                    if (t > 1)
                        t = 1;
                    const alpha = t * t * (3 - 2 * t);
                    const idx = (y * size + x) * 4;
                    data[idx] = 255;
                    data[idx + 1] = 255;
                    data[idx + 2] = 255;
                    data[idx + 3] = Math.round(alpha * 255);
                }
            }
            const tex = new Laya.Texture2D(size, size, Laya.TextureFormat.R8G8B8A8, false, false, false, false);
            tex.setPixelsData(data, false, false);
            tex.wrapModeU = Laya.WrapMode.Clamp;
            tex.wrapModeV = Laya.WrapMode.Clamp;
            tex.filterMode = Laya.FilterMode.Bilinear;
            VFXRenderer._defaultDotTexture = tex;
            return tex;
        }
        static getBillboardMaterial(blendMode = "Alpha") {
            let mat = VFXRenderer._billboardMaterialCache.get(blendMode);
            if (!mat) {
                mat = new Laya.Material();
                mat.setShaderName("VFXUnlit");
                mat.setColor("u_Color", new Laya.Color(1, 1, 1, 1));
                mat.setTexture("u_AlbedoTexture", VFXRenderer.getDefaultDotTexture());
                mat.renderQueue = 3000;
                mat.cull = Laya.RenderState.CULL_NONE;
                applyBlendMode(mat, blendMode);
                VFXRenderer._billboardMaterialCache.set(blendMode, mat);
            }
            return mat;
        }
        static smoothMeshNormals(mesh) {
            if (!mesh)
                return;
            const meshId = mesh._id;
            if (VFXRenderer._smoothedNormalMeshIds.has(meshId))
                return;
            VFXRenderer._smoothedNormalMeshIds.add(meshId);
            try {
                const positions = [];
                const normals = [];
                mesh.getPositions(positions);
                mesh.getNormals(normals);
                if (!positions.length || !normals.length)
                    return;
                const vertCount = positions.length;
                const indices = mesh.getIndices();
                const posKey = (p) => `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)},${Math.round(p.z * 1000)}`;
                const keyToCluster = new Map();
                const vertToCluster = new Int32Array(vertCount);
                let clusterCount = 0;
                for (let i = 0; i < vertCount; i++) {
                    const k = posKey(positions[i]);
                    let cid = keyToCluster.get(k);
                    if (cid === undefined) {
                        cid = clusterCount++;
                        keyToCluster.set(k, cid);
                    }
                    vertToCluster[i] = cid;
                }
                const cNx = new Float32Array(clusterCount);
                const cNy = new Float32Array(clusterCount);
                const cNz = new Float32Array(clusterCount);
                for (let i = 0; i < vertCount; i++) {
                    const cid = vertToCluster[i];
                    cNx[cid] += normals[i].x;
                    cNy[cid] += normals[i].y;
                    cNz[cid] += normals[i].z;
                }
                for (let c = 0; c < clusterCount; c++) {
                    const len = Math.hypot(cNx[c], cNy[c], cNz[c]);
                    if (len > 1e-6) {
                        cNx[c] /= len;
                        cNy[c] /= len;
                        cNz[c] /= len;
                    }
                    else {
                        cNy[c] = 1;
                    }
                }
                const adj = new Array(clusterCount);
                for (let i = 0; i < clusterCount; i++)
                    adj[i] = new Set();
                const triCount = indices.length / 3;
                for (let t = 0; t < triCount; t++) {
                    const c0 = vertToCluster[indices[t * 3]];
                    const c1 = vertToCluster[indices[t * 3 + 1]];
                    const c2 = vertToCluster[indices[t * 3 + 2]];
                    if (c0 !== c1) {
                        adj[c0].add(c1);
                        adj[c1].add(c0);
                    }
                    if (c0 !== c2) {
                        adj[c0].add(c2);
                        adj[c2].add(c0);
                    }
                    if (c1 !== c2) {
                        adj[c1].add(c2);
                        adj[c2].add(c1);
                    }
                }
                const factor = 0.6;
                for (let iter = 0; iter < 5; iter++) {
                    const nx = new Float32Array(clusterCount);
                    const ny = new Float32Array(clusterCount);
                    const nz = new Float32Array(clusterCount);
                    for (let c = 0; c < clusterCount; c++) {
                        const nb = adj[c];
                        if (nb.size === 0) {
                            nx[c] = cNx[c];
                            ny[c] = cNy[c];
                            nz[c] = cNz[c];
                            continue;
                        }
                        let sx = 0, sy = 0, sz = 0;
                        nb.forEach(n => { sx += cNx[n]; sy += cNy[n]; sz += cNz[n]; });
                        const inv = 1 / nb.size;
                        nx[c] = cNx[c] * (1 - factor) + sx * inv * factor;
                        ny[c] = cNy[c] * (1 - factor) + sy * inv * factor;
                        nz[c] = cNz[c] * (1 - factor) + sz * inv * factor;
                    }
                    for (let c = 0; c < clusterCount; c++) {
                        const len = Math.hypot(nx[c], ny[c], nz[c]);
                        if (len > 1e-6) {
                            nx[c] /= len;
                            ny[c] /= len;
                            nz[c] /= len;
                        }
                        else {
                            ny[c] = 1;
                        }
                    }
                    cNx.set(nx);
                    cNy.set(ny);
                    cNz.set(nz);
                }
                for (let i = 0; i < vertCount; i++) {
                    const cid = vertToCluster[i];
                    normals[i].x = cNx[cid];
                    normals[i].y = cNy[cid];
                    normals[i].z = cNz[cid];
                }
                mesh.setNormals(normals);
            }
            catch (err) {
                console.warn("[VFXRenderer] smoothMeshNormals failed:", err);
            }
        }
        static smoothMeshVertexColors(mesh, iterations = 2, factor = 0.35) {
            if (!mesh)
                return;
            const meshId = mesh._id;
            if (VFXRenderer._smoothedMeshIds.has(meshId))
                return;
            VFXRenderer._smoothedMeshIds.add(meshId);
            try {
                const indices = mesh.getIndices();
                if (!indices)
                    return;
                const colors = [];
                mesh.getColors(colors);
                if (!colors.length)
                    return;
                if (colors[0] == null)
                    return;
                const vertCount = colors.length;
                const positions = [];
                mesh.getPositions(positions);
                const posKey = (p) => `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)},${Math.round(p.z * 1000)}`;
                const keyToCluster = new Map();
                const vertToCluster = new Int32Array(vertCount);
                let clusterCount = 0;
                for (let i = 0; i < vertCount; i++) {
                    const k = posKey(positions[i]);
                    let cid = keyToCluster.get(k);
                    if (cid === undefined) {
                        cid = clusterCount++;
                        keyToCluster.set(k, cid);
                    }
                    vertToCluster[i] = cid;
                }
                const adj = new Array(clusterCount);
                for (let i = 0; i < clusterCount; i++)
                    adj[i] = new Set();
                const triCount = indices.length / 3;
                for (let t = 0; t < triCount; t++) {
                    const c0 = vertToCluster[indices[t * 3]];
                    const c1 = vertToCluster[indices[t * 3 + 1]];
                    const c2 = vertToCluster[indices[t * 3 + 2]];
                    if (c0 !== c1) {
                        adj[c0].add(c1);
                        adj[c1].add(c0);
                    }
                    if (c0 !== c2) {
                        adj[c0].add(c2);
                        adj[c2].add(c0);
                    }
                    if (c1 !== c2) {
                        adj[c1].add(c2);
                        adj[c2].add(c1);
                    }
                }
                const cR = new Float32Array(clusterCount);
                const cG = new Float32Array(clusterCount);
                const cA = new Float32Array(clusterCount);
                const cCount = new Float32Array(clusterCount);
                for (let i = 0; i < vertCount; i++) {
                    const cid = vertToCluster[i];
                    cR[cid] += colors[i].r;
                    cG[cid] += colors[i].g;
                    cA[cid] += colors[i].a;
                    cCount[cid]++;
                }
                for (let c = 0; c < clusterCount; c++) {
                    const inv = cCount[c] > 0 ? 1 / cCount[c] : 0;
                    cR[c] *= inv;
                    cG[c] *= inv;
                    cA[c] *= inv;
                }
                for (let iter = 0; iter < iterations; iter++) {
                    const nR = new Float32Array(clusterCount);
                    const nG = new Float32Array(clusterCount);
                    const nA = new Float32Array(clusterCount);
                    for (let c = 0; c < clusterCount; c++) {
                        const nb = adj[c];
                        if (nb.size === 0) {
                            nR[c] = cR[c];
                            nG[c] = cG[c];
                            nA[c] = cA[c];
                            continue;
                        }
                        let sR = 0, sG = 0, sA = 0;
                        nb.forEach(n => { sR += cR[n]; sG += cG[n]; sA += cA[n]; });
                        const inv = 1 / nb.size;
                        nR[c] = cR[c] * (1 - factor) + sR * inv * factor;
                        nG[c] = cG[c] * (1 - factor) + sG * inv * factor;
                        nA[c] = cA[c] * (1 - factor) + sA * inv * factor;
                    }
                    cR.set(nR);
                    cG.set(nG);
                    cA.set(nA);
                }
                for (let i = 0; i < vertCount; i++) {
                    const cid = vertToCluster[i];
                    colors[i].r = cR[cid];
                    colors[i].g = cG[cid];
                    colors[i].a = cA[cid];
                }
                mesh.setColors(colors);
            }
            catch (err) {
                console.warn("[VFXRenderer] smoothMeshVertexColors failed:", err);
            }
        }
        static _tryLoadTextureOnce(url, onLoaded) {
            if (!url || VFXRenderer._failedTextureUrls.has(url))
                return;
            const cached = VFXRenderer._atlasTextureCache.get(url);
            if (cached) {
                onLoaded(cached);
                return;
            }
            Laya.Laya.loader.load(url).then(async (tex) => {
                if (tex) {
                    await VFXRenderer._patchTextureAlphaFromLuminance(tex, url);
                    VFXRenderer._atlasTextureCache.set(url, tex);
                    onLoaded(tex);
                }
                else {
                    VFXRenderer._failedTextureUrls.add(url);
                    console.warn(`[VFX Renderer] texture load returned null (will not retry): ${url}`);
                }
            }, (err) => {
                VFXRenderer._failedTextureUrls.add(url);
                console.warn(`[VFX Renderer] texture load failed (will not retry): ${url}`, err);
            });
        }
        static async _patchTextureAlphaFromLuminance(tex, url) {
            if (VFXRenderer._patchedTextureUrls.has(url))
                return;
            VFXRenderer._patchedTextureUrls.add(url);
            try {
                const buffer = await Laya.Laya.loader.fetch(url, "arraybuffer");
                if (!buffer || !(buffer instanceof ArrayBuffer)) {
                    console.warn("[VFX alpha] fetch returned non-ArrayBuffer:", typeof buffer);
                    return;
                }
                if (!url.toLowerCase().endsWith(".png")) {
                    return;
                }
                const blob = new Blob([buffer], { type: "image/png" });
                const imgBitmap = await createImageBitmap(blob);
                const canvas = document.createElement("canvas");
                canvas.width = imgBitmap.width;
                canvas.height = imgBitmap.height;
                const ctx = canvas.getContext("2d");
                if (!ctx)
                    return;
                ctx.drawImage(imgBitmap, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels = imageData.data;
                let allOpaque = true;
                for (let i = 3; i < pixels.length; i += 4) {
                    if (pixels[i] !== 255) {
                        allOpaque = false;
                        break;
                    }
                }
                if (!allOpaque)
                    return;
                let blackCount = 0;
                const pixelCount = pixels.length / 4;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i] < 20 && pixels[i + 1] < 20 && pixels[i + 2] < 20)
                        blackCount++;
                }
                const blackRatio = blackCount / pixelCount;
                const isFlameStyle = blackRatio > 0.15;
                let modified = false;
                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
                    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                    if (isFlameStyle) {
                        pixels[i + 3] = Math.round(lum);
                        if (lum < 254)
                            modified = true;
                    }
                    else {
                        const maxC = Math.max(r, g, b);
                        const minC = Math.min(r, g, b);
                        const sat = maxC - minC;
                        if (sat > 30) {
                            pixels[i + 3] = 0;
                            modified = true;
                        }
                        else {
                            pixels[i + 3] = Math.round(lum);
                            if (lum < 254)
                                modified = true;
                        }
                    }
                }
                if (!modified)
                    return;
                const t2d = (tex.bitmap || tex);
                if (t2d && t2d.setPixelsData) {
                    t2d.setPixelsData(new Uint8Array(pixels.buffer), false, false);
                }
                else {
                    console.warn("[VFX alpha] no setPixelsData on bitmap, t2d=", t2d, "tex=", tex);
                }
            }
            catch (e) {
                console.warn("[VFX] alpha patch failed:", url, e);
            }
        }
        static getBillboardProceduralMaterial(primitive, blendMode = "Alpha", cropFactor = 0.146, mainTextureUuid = "", uvMode = "Default", fbW = 4, fbH = 4, geoUid = 0) {
            const key = `${primitive}__${blendMode}__${uvMode}__${fbW}x${fbH}__${mainTextureUuid}__u${geoUid}`;
            let mat = VFXRenderer._billboardProceduralCache.get(key);
            if (!mat) {
                if (!Laya.Shader3D.find("VFXBillboardProcedural")) {
                    return null;
                }
                mat = new Laya.Material();
                mat.setShaderName("VFXBillboardProcedural");
                mat.setColor("u_Color", new Laya.Color(1, 1, 1, 1));
                mat.setTexture("u_AlbedoTexture", VFXRenderer.getDefaultDotTexture());
                mat.renderQueue = 3000;
                mat.cull = Laya.RenderState.CULL_NONE;
                applyBlendMode(mat, blendMode);
                mat.removeDefine(Laya.Shader3D.getDefineByName("VFX_PRIMITIVE_QUAD"));
                mat.removeDefine(Laya.Shader3D.getDefineByName("VFX_PRIMITIVE_TRIANGLE"));
                mat.removeDefine(Laya.Shader3D.getDefineByName("VFX_PRIMITIVE_OCTAGON"));
                if (primitive === "Triangle")
                    mat.addDefine(Laya.Shader3D.getDefineByName("VFX_PRIMITIVE_TRIANGLE"));
                else if (primitive === "Octagon")
                    mat.addDefine(Laya.Shader3D.getDefineByName("VFX_PRIMITIVE_OCTAGON"));
                else
                    mat.addDefine(Laya.Shader3D.getDefineByName("VFX_PRIMITIVE_QUAD"));
                VFXRenderer._billboardProceduralCache.set(key, mat);
            }
            mat.setFloat("u_CropFactor", cropFactor);
            return mat;
        }
        static getDistortionMaterial(mode, blendMode, distortionStrength) {
            const key = `${mode}__${blendMode}`;
            let mat = VFXRenderer._distortionMaterialCache.get(key);
            if (!mat) {
                if (!Laya.Shader3D.find("VFXDistortionQuad")) {
                    return null;
                }
                mat = new Laya.Material();
                mat.setShaderName("VFXDistortionQuad");
                mat.setColor("u_Color", new Laya.Color(1, 1, 1, 1));
                mat.setTexture("u_AlbedoTexture", VFXRenderer.getDefaultDotTexture());
                mat.renderQueue = 3000;
                mat.cull = Laya.RenderState.CULL_NONE;
                applyBlendMode(mat, blendMode);
                if (mode === "NormalMap") {
                    mat.addDefine(Laya.Shader3D.getDefineByName("USE_NORMAL_MAP"));
                }
                VFXRenderer._distortionMaterialCache.set(key, mat);
            }
            mat.setFloat("u_DistortionStrength", distortionStrength);
            return mat;
        }
        static getCubeProceduralMaterial(blendMode = "Alpha") {
            let mat = VFXRenderer._cubeProceduralCache.get(blendMode);
            if (!mat) {
                if (!Laya.Shader3D.find("VFXCubeProcedural")) {
                    return null;
                }
                mat = new Laya.Material();
                mat.setShaderName("VFXCubeProcedural");
                mat.setColor("u_Color", new Laya.Color(1, 1, 1, 1));
                mat.setTexture("u_AlbedoTexture", VFXRenderer.getDefaultDotTexture());
                mat.renderQueue = 3000;
                mat.cull = Laya.RenderState.CULL_BACK;
                applyBlendMode(mat, blendMode);
                VFXRenderer._cubeProceduralCache.set(blendMode, mat);
            }
            return mat;
        }
        static _syncMeshAttrDefines(mat, geometry) {
            try {
                const mesh = geometry && (geometry._mesh || geometry.mesh);
                if (!mesh || !mat)
                    return;
                const vb = mesh.vertexBuffer || mesh._vertexBuffer;
                const decl = vb && vb.vertexDeclaration;
                const elems = decl && (decl._vertexElements || decl.vertexElements);
                if (!elems || !elems.length)
                    return;
                const usages = new Set();
                for (const e of elems)
                    usages.add(e.elementUsage !== undefined ? e.elementUsage : e._elementUsage);
                let meshDefs = null;
                try {
                    meshDefs = [];
                    Laya.MeshUtil.getMeshDefine(mesh, meshDefs);
                }
                catch (e) {
                    meshDefs = null;
                }
                const sync = (defName, usage) => {
                    const def = Laya.Shader3D.getDefineByName(defName);
                    if (!def)
                        return;
                    const has = meshDefs ? meshDefs.indexOf(def) >= 0 : usages.has(usage);
                    if (has || usages.has(usage))
                        mat.addDefine(def);
                    else
                        mat.removeDefine(def);
                };
                sync("COLOR", 1);
                sync("UV", 2);
                sync("UV1", 7);
                sync("TANGENT", 4);
            }
            catch (e) { }
        }
        static getCustomShaderMaterial(shaderName, blendMode = "Alpha", instanceKey = "", variant = "instanced") {
            var _a, _b, _c, _d, _e, _f;
            const key = `${shaderName}__${blendMode}__${instanceKey}__${variant}`;
            let mat = VFXRenderer._customShaderMaterialCache.get(key);
            if (mat)
                return mat;
            const shader = Laya.Shader3D.find(shaderName);
            if (!shader) {
                if (shaderName === "VFXUnlit") {
                    console.error("[VFX Renderer] built-in 'VFXUnlit' shader not registered");
                    return null;
                }
                if (!VFXRenderer._pendingCustomShaderLoads.has(shaderName)) {
                    VFXRenderer._pendingCustomShaderLoads.add(shaderName);
                    const url = (_c = (_b = (_a = Laya.Laya.AssetDb) === null || _a === void 0 ? void 0 : _a.inst) === null || _b === void 0 ? void 0 : _b.shaderName_to_URL) === null || _c === void 0 ? void 0 : _c.call(_b, shaderName);
                    const loadPromise = url
                        ? Laya.Laya.loader.load(url)
                        : (_f = (_e = (_d = Laya.Laya.AssetDb) === null || _d === void 0 ? void 0 : _d.inst) === null || _e === void 0 ? void 0 : _e.shaderName_to_URL_async) === null || _f === void 0 ? void 0 : _f.call(_e, shaderName).then((u) => u ? Laya.Laya.loader.load(u) : null);
                    Promise.resolve(loadPromise)
                        .then(() => console.log(`[VFX Renderer] custom shader '${shaderName}' loaded (url=${url})`))
                        .catch((err) => console.warn(`[VFX Renderer] custom shader '${shaderName}' load failed`, err));
                }
                return VFXRenderer.getCustomShaderMaterial("VFXUnlit", blendMode, instanceKey, variant);
            }
            mat = new Laya.Material();
            mat.setShaderName(shaderName);
            if (variant !== "strip") {
                const vfxDef = Laya.Shader3D.getDefineByName("VFX_INSTANCED");
                if (vfxDef)
                    mat.addDefine(vfxDef);
            }
            else {
                const uvDef = Laya.Shader3D.getDefineByName("UV");
                if (uvDef)
                    mat.addDefine(uvDef);
            }
            const colorDef = Laya.Shader3D.getDefineByName("COLOR");
            if (colorDef)
                mat.addDefine(colorDef);
            const emissionDef = Laya.Shader3D.getDefineByName("EMISSION");
            if (emissionDef)
                mat.addDefine(emissionDef);
            mat.setColor("u_Color", new Laya.Color(1, 1, 1, 1));
            mat.setTexture("u_AlbedoTexture", VFXRenderer.getDefaultDotTexture());
            mat.renderQueue = 3000;
            mat.cull = Laya.RenderState.CULL_NONE;
            applyBlendMode(mat, blendMode);
            VFXRenderer._customShaderMaterialCache.set(key, mat);
            return mat;
        }
        static getMeshTexturedMaterial(blendMode = "Alpha", mainTextureUrl = "", uvMode = "Default", flipbookSize = null) {
            const fbKey = flipbookSize ? `${flipbookSize.x}x${flipbookSize.y}` : "";
            const key = `__meshtex__${blendMode}__${mainTextureUrl}__${uvMode}__${fbKey}`;
            let mat = VFXRenderer._customShaderMaterialCache.get(key);
            if (mat)
                return mat;
            const shader = Laya.Shader3D.find("VFXUnlit");
            if (!shader) {
                console.error("[VFX Renderer] built-in 'VFXUnlit' shader not registered");
                return null;
            }
            mat = new Laya.Material();
            mat.setShaderName("VFXUnlit");
            const vfxDef = Laya.Shader3D.getDefineByName("VFX_INSTANCED");
            if (vfxDef)
                mat.addDefine(vfxDef);
            const colorDef = Laya.Shader3D.getDefineByName("COLOR");
            if (colorDef)
                mat.addDefine(colorDef);
            mat.setColor("u_Color", new Laya.Color(1, 1, 1, 1));
            mat.setTexture("u_AlbedoTexture", VFXRenderer.getDefaultDotTexture());
            mat.renderQueue = 3000;
            mat.cull = Laya.RenderState.CULL_NONE;
            applyBlendMode(mat, blendMode);
            applyFlipbook(mat, uvMode, flipbookSize);
            VFXRenderer._customShaderMaterialCache.set(key, mat);
            if (mainTextureUrl) {
                VFXRenderer._tryLoadTextureOnce(mainTextureUrl, tex => {
                    if (mat)
                        mat.setTexture("u_AlbedoTexture", tex);
                });
            }
            return mat;
        }
        static getStripMaterial(blendMode = "Alpha", mainTextureUuid = "", colorMapping = "Default", uvScale, uvBias, gradientStops, tilingMode = "Stretch", tilingSegments = 1) {
            var _a, _b, _c, _d;
            const gradHash = (gradientStops && gradientStops.length > 0)
                ? gradientStops.map(s => `${s.t.toFixed(3)}:${s.color.map(c => c.toFixed(2)).join(",")}`).join("|")
                : "";
            const usHash = uvScale ? `${uvScale.x},${uvScale.y}` : "1,1";
            const ubHash = uvBias ? `${uvBias.x},${uvBias.y}` : "0,0";
            const tilingHash = `${tilingMode}__${tilingSegments}`;
            const key = `${blendMode}__${mainTextureUuid}__${colorMapping}__${usHash}__${ubHash}__${gradHash}__${tilingHash}`;
            let mat = VFXRenderer._stripMaterialCache.get(key);
            if (mat)
                return mat;
            if (!Laya.Shader3D.find("VFXStrip")) {
                return null;
            }
            mat = new Laya.Material();
            mat.setShaderName("VFXStrip");
            mat.setColor("u_Color", new Laya.Color(1, 1, 1, 1));
            if (Laya.Texture2D.whiteTexture) {
                mat.setTexture("u_AlbedoTexture", Laya.Texture2D.whiteTexture);
            }
            const useGradient = colorMapping === "GradientMapped" && gradientStops && gradientStops.length > 0;
            const gradDef = Laya.Shader3D.getDefineByName("VFX_STRIP_GRADIENT_MAPPED");
            const sbDef = Laya.Shader3D.getDefineByName("VFX_STRIP_UV_SCALE_BIAS");
            if (useGradient) {
                if (gradDef)
                    mat.addDefine(gradDef);
                const gradTex = bakeGradientTexture256(gradientStops);
                mat.setTexture("u_VfxStripGradient", gradTex);
            }
            const useScaleBias = (uvScale && (uvScale.x !== 1 || uvScale.y !== 1)) || (uvBias && (uvBias.x !== 0 || uvBias.y !== 0));
            if (useScaleBias) {
                if (sbDef)
                    mat.addDefine(sbDef);
                mat.setVector2("u_VfxUVScale", new Laya.Vector2((_a = uvScale === null || uvScale === void 0 ? void 0 : uvScale.x) !== null && _a !== void 0 ? _a : 1, (_b = uvScale === null || uvScale === void 0 ? void 0 : uvScale.y) !== null && _b !== void 0 ? _b : 1));
                mat.setVector2("u_VfxUVBias", new Laya.Vector2((_c = uvBias === null || uvBias === void 0 ? void 0 : uvBias.x) !== null && _c !== void 0 ? _c : 0, (_d = uvBias === null || uvBias === void 0 ? void 0 : uvBias.y) !== null && _d !== void 0 ? _d : 0));
            }
            const repeatDef = Laya.Shader3D.getDefineByName("VFX_STRIP_REPEAT_PER_SEGMENT");
            if (repeatDef) {
                if (tilingMode === "RepeatPerSegment")
                    mat.addDefine(repeatDef);
                else
                    mat.removeDefine(repeatDef);
            }
            mat.setFloat("u_VfxStripTilingSegments", Math.max(tilingSegments, 1));
            mat.renderQueue = 3000;
            mat.cull = Laya.RenderState.CULL_NONE;
            applyBlendMode(mat, blendMode);
            VFXRenderer._stripMaterialCache.set(key, mat);
            if (mainTextureUuid) {
                VFXRenderer._tryLoadTextureOnce(mainTextureUuid, tex => {
                    if (mat)
                        mat.setTexture("u_AlbedoTexture", tex);
                });
            }
            return mat;
        }
        addGeometry(geometry) {
            this._geometries.push(geometry);
            this._rebuildRenderElements();
        }
        removeGeometry(geometry) {
            const index = this._geometries.indexOf(geometry);
            if (index >= 0) {
                this._geometries.splice(index, 1);
                this._rebuildRenderElements();
            }
        }
        clearGeometries() {
            this._geometries.length = 0;
            this._rebuildRenderElements();
        }
        constructor() {
            super();
            this._geometries = [];
            this._baseRenderNode.renderNodeType = Laya.BaseRenderType.ParticleRender;
            this._baseRenderNode.perCameraUpdate = true;
            this.geometryBounds = new Laya.Bounds(new Laya.Vector3(), new Laya.Vector3());
        }
        _onEnable() {
            var _a, _b, _c, _d;
            super._onEnable();
            this._surportReflectionProbe = true;
            (_b = (_a = this)._addReflectionProbeUpdate) === null || _b === void 0 ? void 0 : _b.call(_a);
            const scene = (_c = this.owner) === null || _c === void 0 ? void 0 : _c.scene;
            const sceneProbe = scene && (scene.sceneReflectionProb || scene._sceneReflectionProb);
            if (sceneProbe) {
                this.probReflection = sceneProbe;
                const ambient = scene === null || scene === void 0 ? void 0 : scene.ambientColor;
                const probeShaderData = sceneProbe.shaderData;
                if (ambient && probeShaderData) {
                    const ambColorID = Laya.ReflectionProbe.AMBIENTCOLOR;
                    const ambIntensityID = Laya.ReflectionProbe.AMBIENTINTENSITY;
                    const refIntensityID = Laya.ReflectionProbe.REFLECTIONINTENSITY;
                    if (ambColorID != null) {
                        probeShaderData.setColor(ambColorID, new Laya.Color(ambient.r, ambient.g, ambient.b, 1.0));
                    }
                    if (ambIntensityID != null)
                        probeShaderData.setNumber(ambIntensityID, 1.0);
                    if (refIntensityID != null)
                        probeShaderData.setNumber(refIntensityID, 1.0);
                    (_d = probeShaderData.update) === null || _d === void 0 ? void 0 : _d.call(probeShaderData, Laya.ReflectionProbe.BlockName);
                }
            }
        }
        _createBaseRenderNode() {
            return Laya.Laya3DRender.Render3DModuleDataFactory.createMeshRenderNode();
        }
        _getcommonUniformMap() {
            return ["Sprite3D"];
        }
        _createRenderElement(geometry) {
            const element = new Laya.RenderElement();
            element.setGeometry(geometry);
            element.setTransform(this._transform);
            element.render = this;
            element._renderElementOBJ.canDynamicBatch = false;
            return element;
        }
        _rebuildRenderElements() {
            this._renderElements.forEach(element => {
                element.destroy();
            });
            this._renderElements.length = 0;
            const supportedCompute = Laya.LayaGL.renderEngine.getCapable(Laya.RenderCapable.ComputeShader);
            if (!supportedCompute)
                return;
            for (const geo of this._geometries) {
                if (geo instanceof VFXGeometry) {
                    VFXRenderer.smoothMeshNormals(geo.mesh);
                    VFXRenderer.smoothMeshVertexColors(geo.mesh, 8, 0.5);
                }
            }
            for (const geometry of this._geometries) {
                const element = this._createRenderElement(geometry);
                this._renderElements.push(element);
            }
            this._setRenderElements();
        }
        _onWorldMatNeedChange(flag) {
            super._onWorldMatNeedChange(flag);
            const isMoved = this._baseRenderNode.ismoved;
            isMoved.setValue(Laya.Stat.loopCount, Laya.LayaGL.renderEngine._framePassCount);
            this._baseRenderNode.ismoved = isMoved;
        }
        _renderUpdate(context3D) {
            var _a, _b, _c, _d;
            const renderNode = this._baseRenderNode;
            const trans = renderNode.transform;
            renderNode.shaderData.setMatrix4x4(Laya.Sprite3D.WORLDMATRIX, trans.worldMatrix);
            renderNode._worldParams.x = trans.getFrontFaceValue();
            renderNode.shaderData.setVector(Laya.Sprite3D.WORLDINVERTFRONT, renderNode._worldParams);
            (_b = (_a = renderNode)._applyReflection) === null || _b === void 0 ? void 0 : _b.call(_a);
            (_d = (_c = renderNode)._applyLightProb) === null || _d === void 0 ? void 0 : _d.call(_c);
            if (!this.visualEffect)
                return;
            this.visualEffect.outputVFX(context3D);
        }
        renderUpdate(context) {
            var _a;
            this._updateMergedBounds();
            const meshMaterial = (_a = this.sharedMaterials[0]) !== null && _a !== void 0 ? _a : this.sharedMaterial;
            this._renderElements.forEach((element, index) => {
                var _a, _b, _c, _d, _e, _f;
                const geometry = element._geometry;
                element._renderElementOBJ.isRender = geometry._prepareRender(context);
                geometry._updateRenderParams(context);
                const outType = geometry.outputType || "outputMesh";
                if (geometry instanceof VFXStripGeometry || outType === "outputPoint" || outType === "outputLine" || outType === "outputLineStrip") {
                    const mode = geometry.blendMode || "Alpha";
                    const stripCustomShader = geometry.customShaderName || "";
                    if (stripCustomShader && stripCustomShader !== "VFXStrip") {
                        element.material = VFXRenderer.getCustomShaderMaterial(stripCustomShader, mode, geometry.matInstanceKey || "", "strip");
                    }
                    else {
                        const stripMainTex = geometry.mainTexture || "";
                        const stripColorMapping = geometry.stripColorMapping || "Default";
                        const stripUvScale = geometry.stripUvScale;
                        const stripUvBias = geometry.stripUvBias;
                        const stripGradientStops = geometry.stripGradientStops;
                        const stripTilingMode = geometry.stripTilingMode || "Stretch";
                        const stripPpsc = Number((_a = geometry.stripPpsc) !== null && _a !== void 0 ? _a : 0);
                        const stripTilingSegments = stripPpsc > 1 ? stripPpsc - 1 : 1;
                        const strip = VFXRenderer.getStripMaterial(mode, stripMainTex, stripColorMapping, stripUvScale, stripUvBias, stripGradientStops, stripTilingMode, stripTilingSegments);
                        if (strip) {
                            if (!this._stripTexApplied) {
                                const mats = this.sharedMaterials;
                                const curMat = (_b = mats === null || mats === void 0 ? void 0 : mats[0]) !== null && _b !== void 0 ? _b : this.sharedMaterial;
                                if (curMat) {
                                    const texPropID = Laya.Shader3D.propertyNameToID("u_AlbedoTexture");
                                    const userSD = curMat._shaderValues;
                                    const tex = userSD === null || userSD === void 0 ? void 0 : userSD.getTexture(texPropID);
                                    if (tex) {
                                        const stripSD = strip._shaderValues;
                                        stripSD.setTexture(texPropID, tex);
                                        this._stripTexApplied = true;
                                    }
                                }
                            }
                            element.material = strip;
                        }
                    }
                }
                else {
                    const mode = geometry.blendMode || "Alpha";
                    const customShaderName = geometry.customShaderName
                        || (outType === "outputShaderGraphQuad" ? "VFXUnlit" : "");
                    const bbPrim = geometry.primitive || "";
                    const isBillboardProcedural = outType === "outputBillboard" && !!bbPrim;
                    if (customShaderName) {
                        const mat = VFXRenderer.getCustomShaderMaterial(customShaderName, mode, geometry.matInstanceKey || "");
                        VFXRenderer._syncMeshAttrDefines(mat, geometry);
                        element.material = mat;
                    }
                    else if (outType === "outputCube") {
                        const cubeMat = VFXRenderer.getCubeProceduralMaterial(mode);
                        if (cubeMat)
                            element.material = cubeMat;
                    }
                    else if (outType === "outputDistortion") {
                        const dMode = geometry.distortionMode || "Procedural";
                        const dStrength = (_c = geometry.cropFactor) !== null && _c !== void 0 ? _c : 0.05;
                        const dMat = VFXRenderer.getDistortionMaterial(dMode, mode, dStrength);
                        if (dMat)
                            element.material = dMat;
                    }
                    else if (isBillboardProcedural) {
                        const cropF = (_d = geometry.cropFactor) !== null && _d !== void 0 ? _d : 0.146;
                        const mainTex = geometry.mainTexture;
                        const uvMode = geometry.uvMode || "Default";
                        const fbSize = geometry.flipbookSize;
                        const fbW = (fbSize && fbSize.x) || 4;
                        const fbH = (fbSize && fbSize.y) || 4;
                        const geoUid = (_e = geometry._uid) !== null && _e !== void 0 ? _e : (geometry._uid = (VFXRenderer._geoUidNext++));
                        const bbMat = VFXRenderer.getBillboardProceduralMaterial(bbPrim, mode, cropF, mainTex || "", uvMode, fbW, fbH, geoUid);
                        if (bbMat) {
                            if (mainTex) {
                                const cached = VFXRenderer._atlasTextureCache.get(mainTex);
                                if (cached) {
                                    bbMat.setTexture("u_AlbedoTexture", cached);
                                }
                                else if (!VFXRenderer._failedTextureUrls.has(mainTex)) {
                                    VFXRenderer._tryLoadTextureOnce(mainTex, () => { });
                                }
                            }
                            applyFlipbook(bbMat, uvMode, fbSize);
                            const softFade = geometry.softParticleFade || 0;
                            applySoftParticle(bbMat, softFade);
                            applySubpixelAA(bbMat, !!geometry.subpixelAA);
                            const useAlphaClip = !!geometry.useAlphaClipping;
                            const alphaThresh = Number((_f = geometry.alphaThreshold) !== null && _f !== void 0 ? _f : 0.5);
                            const acDef = Laya.Shader3D.getDefineByName("VFX_ALPHA_CLIP");
                            if (acDef) {
                                if (useAlphaClip)
                                    bbMat.addDefine(acDef);
                                else
                                    bbMat.removeDefine(acDef);
                            }
                            bbMat.setFloat("u_AlphaThreshold", alphaThresh);
                            element.material = bbMat;
                        }
                    }
                    else if (!meshMaterial && outType === "outputBillboard") {
                        element.material = VFXRenderer.getBillboardMaterial(mode);
                    }
                    else if (!meshMaterial) {
                        const meshMainTex = geometry.mainTexture || "";
                        if (meshMainTex) {
                            element.material = VFXRenderer.getMeshTexturedMaterial(mode, meshMainTex, geometry.uvMode || "Default", geometry.flipbookSize);
                        }
                        else {
                            element.material = VFXRenderer.getCustomShaderMaterial("VFXUnlit", mode);
                        }
                    }
                    else {
                        if (meshMaterial) {
                            applyBlendMode(meshMaterial, mode);
                        }
                        if (meshMaterial && outType === "outputBillboard") {
                            const mainTex = geometry.mainTexture;
                            if (mainTex) {
                                VFXRenderer._tryLoadTextureOnce(mainTex, tex => meshMaterial.setTexture("u_AlbedoTexture", tex));
                                if (VFXRenderer._failedTextureUrls.has(mainTex)) {
                                    const existing = meshMaterial.getTexture("u_AlbedoTexture");
                                    if (!existing)
                                        meshMaterial.setTexture("u_AlbedoTexture", VFXRenderer.getDefaultDotTexture());
                                }
                            }
                            else {
                                const existing = meshMaterial.getTexture("u_AlbedoTexture");
                                if (!existing) {
                                    meshMaterial.setTexture("u_AlbedoTexture", VFXRenderer.getDefaultDotTexture());
                                }
                            }
                        }
                        if (meshMaterial && outType !== "outputBillboard") {
                            const meshFieldTex = geometry.mainTexture;
                            if (meshFieldTex) {
                                VFXRenderer._tryLoadTextureOnce(meshFieldTex, tex => {
                                    if (tex) {
                                        meshMaterial.setTexture("MainTexture", tex);
                                        meshMaterial.setTexture("_MainTexture", tex);
                                        meshMaterial.setTexture("u_AlbedoTexture", tex);
                                    }
                                });
                            }
                        }
                        const softFade = geometry.softParticleFade || 0;
                        if (meshMaterial) {
                            applySoftParticle(meshMaterial, softFade);
                            const uvMode = geometry.uvMode || "Default";
                            const fbSize = geometry.flipbookSize;
                            applyFlipbook(meshMaterial, uvMode, fbSize);
                            applySubpixelAA(meshMaterial, !!geometry.subpixelAA);
                        }
                        element.material = meshMaterial;
                    }
                }
            });
        }
        _updateMergedBounds() {
            if (this._geometries.length === 0)
                return;
            const geometryBounds = this.geometryBounds;
            geometryBounds.min.set(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
            geometryBounds.max.set(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
            for (const geometry of this._geometries) {
                const bounds = geometry.bounds;
                if (bounds) {
                    Laya.Bounds.merge(bounds, geometryBounds, geometryBounds);
                }
            }
            this.boundsChange = true;
        }
    }
    VFXRenderer._stripMaterialCache = new Map();
    VFXRenderer._billboardMaterialCache = new Map();
    VFXRenderer._customShaderMaterialCache = new Map();
    VFXRenderer._defaultDotTexture = null;
    VFXRenderer._billboardProceduralCache = new Map();
    VFXRenderer._smoothedMeshIds = new Set();
    VFXRenderer._smoothedNormalMeshIds = new Set();
    VFXRenderer._atlasTextureCache = new Map();
    VFXRenderer._failedTextureUrls = new Set();
    VFXRenderer._patchedTextureUrls = new Set();
    VFXRenderer._geoUidNext = 1;
    VFXRenderer._distortionMaterialCache = new Map();
    VFXRenderer._cubeProceduralCache = new Map();
    VFXRenderer._pendingCustomShaderLoads = new Set();
    function bakeGradientTexture256(stops) {
        const sorted = [...stops].sort((a, b) => a.t - b.t);
        if (sorted.length === 0) {
            sorted.push({ t: 0, color: [1, 1, 1, 1] });
            sorted.push({ t: 1, color: [1, 1, 1, 0] });
        }
        const W = 256;
        const floats = new Float32Array(W * 4);
        for (let i = 0; i < W; i++) {
            const t = i / (W - 1);
            let i0 = 0, i1 = sorted.length - 1;
            if (t <= sorted[0].t) {
                i0 = i1 = 0;
            }
            else if (t >= sorted[sorted.length - 1].t) {
                i0 = i1 = sorted.length - 1;
            }
            else {
                for (let k = 0; k < sorted.length - 1; k++) {
                    if (t >= sorted[k].t && t <= sorted[k + 1].t) {
                        i0 = k;
                        i1 = k + 1;
                        break;
                    }
                }
            }
            const a = sorted[i0], b = sorted[i1];
            const f = (a.t === b.t) ? 0 : (t - a.t) / (b.t - a.t);
            floats[i * 4 + 0] = a.color[0] + (b.color[0] - a.color[0]) * f;
            floats[i * 4 + 1] = a.color[1] + (b.color[1] - a.color[1]) * f;
            floats[i * 4 + 2] = a.color[2] + (b.color[2] - a.color[2]) * f;
            floats[i * 4 + 3] = a.color[3] + (b.color[3] - a.color[3]) * f;
        }
        const tex = new Laya.Texture2D(W, 1, Laya.TextureFormat.R32G32B32A32, false, false);
        tex.setPixelsData(new Uint8Array(floats.buffer), false, false);
        tex.filterMode = Laya.FilterMode.Bilinear;
        tex.wrapModeU = Laya.WrapMode.Clamp;
        tex.wrapModeV = Laya.WrapMode.Clamp;
        return tex;
    }
    function applyBlendMode(mat, mode) {
        const RS = Laya.RenderState;
        const opaqueDef = Laya.Shader3D.getDefineByName("VFX_OPAQUE");
        const sd = mat._shaderValues;
        if (mode === "Opaque") {
            mat.materialRenderMode = Laya.MaterialRenderMode.RENDERMODE_OPAQUE;
            mat.blend = RS.BLEND_DISABLE;
            mat.depthWrite = true;
            mat.depthTest = RS.DEPTHTEST_LESS;
            if (sd && opaqueDef)
                sd.addDefine(opaqueDef);
            return;
        }
        if (mode === "AlphaClip") {
            if (sd && opaqueDef)
                sd.removeDefine(opaqueDef);
            mat.materialRenderMode = Laya.MaterialRenderMode.RENDERMODE_TRANSPARENT;
            mat.blend = RS.BLEND_ENABLE_ALL;
            mat.blendSrc = RS.BLENDPARAM_SRC_ALPHA;
            mat.blendDst = RS.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
            mat.depthWrite = true;
            mat.depthTest = RS.DEPTHTEST_LESS;
            return;
        }
        if (sd && opaqueDef)
            sd.removeDefine(opaqueDef);
        mat.materialRenderMode = Laya.MaterialRenderMode.RENDERMODE_TRANSPARENT;
        mat.blend = RS.BLEND_ENABLE_ALL;
        mat.depthWrite = false;
        mat.depthTest = RS.DEPTHTEST_LESS;
        switch (mode) {
            case "Additive":
                mat.blendSrc = RS.BLENDPARAM_SRC_ALPHA;
                mat.blendDst = RS.BLENDPARAM_ONE;
                break;
            case "Premultiplied":
                mat.blendSrc = RS.BLENDPARAM_ONE;
                mat.blendDst = RS.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
                break;
            case "Alpha":
            default:
                mat.blendSrc = RS.BLENDPARAM_SRC_ALPHA;
                mat.blendDst = RS.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
                break;
        }
    }
    function applySoftParticle(mat, softFade) {
        const def = Laya.Shader3D.getDefineByName("SOFT_PARTICLE");
        const sd = mat._shaderValues;
        if (softFade > 0) {
            if (sd && def)
                sd.addDefine(def);
            mat.setVector2("u_SoftParticleFactor", new Laya.Vector2(softFade, 0));
        }
        else {
            if (sd && def)
                sd.removeDefine(def);
        }
    }
    function applyFlipbook(mat, uvMode, flipbookSize) {
        const defFB = Laya.Shader3D.getDefineByName("FLIPBOOK");
        const defFBB = Laya.Shader3D.getDefineByName("FLIPBOOK_BLEND");
        const sd = mat._shaderValues;
        if (!sd)
            return;
        if (uvMode === "Flipbook") {
            if (defFB)
                sd.addDefine(defFB);
            if (defFBB)
                sd.removeDefine(defFBB);
        }
        else if (uvMode === "FlipbookBlend") {
            if (defFB)
                sd.removeDefine(defFB);
            if (defFBB)
                sd.addDefine(defFBB);
        }
        else {
            if (defFB)
                sd.removeDefine(defFB);
            if (defFBB)
                sd.removeDefine(defFBB);
            return;
        }
        const cols = (flipbookSize && flipbookSize.x) || 4;
        const rows = (flipbookSize && flipbookSize.y) || 4;
        mat.setVector2("u_FlipbookSize", new Laya.Vector2(cols, rows));
    }
    function applySubpixelAA(mat, enabled) {
        const def = Laya.Shader3D.getDefineByName("SUBPIXEL_AA");
        const sd = mat._shaderValues;
        if (!sd || !def)
            return;
        if (enabled)
            sd.addDefine(def);
        else
            sd.removeDefine(def);
    }

    exports.VFXEventAttributeType = void 0;
    (function (VFXEventAttributeType) {
        VFXEventAttributeType[VFXEventAttributeType["Bool"] = 0] = "Bool";
        VFXEventAttributeType[VFXEventAttributeType["Int"] = 1] = "Int";
        VFXEventAttributeType[VFXEventAttributeType["Uint"] = 2] = "Uint";
        VFXEventAttributeType[VFXEventAttributeType["Float"] = 3] = "Float";
        VFXEventAttributeType[VFXEventAttributeType["Vector2"] = 4] = "Vector2";
        VFXEventAttributeType[VFXEventAttributeType["Vector3"] = 5] = "Vector3";
        VFXEventAttributeType[VFXEventAttributeType["Vector4"] = 6] = "Vector4";
    })(exports.VFXEventAttributeType || (exports.VFXEventAttributeType = {}));
    const VFXEventAttributeTypeSize = {
        [exports.VFXEventAttributeType.Bool]: 4,
        [exports.VFXEventAttributeType.Int]: 4,
        [exports.VFXEventAttributeType.Uint]: 4,
        [exports.VFXEventAttributeType.Float]: 4,
        [exports.VFXEventAttributeType.Vector2]: 8,
        [exports.VFXEventAttributeType.Vector3]: 12,
        [exports.VFXEventAttributeType.Vector4]: 16,
    };
    const Std430Alignment = {
        [exports.VFXEventAttributeType.Bool]: 4,
        [exports.VFXEventAttributeType.Int]: 4,
        [exports.VFXEventAttributeType.Uint]: 4,
        [exports.VFXEventAttributeType.Float]: 4,
        [exports.VFXEventAttributeType.Vector2]: 8,
        [exports.VFXEventAttributeType.Vector3]: 16,
        [exports.VFXEventAttributeType.Vector4]: 16,
    };
    function alignTo(offset, alignment) {
        return Math.ceil(offset / alignment) * alignment;
    }
    class VFXEventAttributeDesc {
        get stride() {
            return this._stride;
        }
        get eventDataOffset() {
            return this._eventDataOffset;
        }
        get eventDataStride() {
            return this._eventDataStride;
        }
        get attributeCount() {
            return this._entries.size;
        }
        constructor(attributes) {
            this._entries = new Map();
            this._stride = 0;
            this._eventDataOffset = 0;
            this._eventDataStride = 0;
            const allAttrs = [...VFXEventAttributeDesc.defaultAttributes];
            if (attributes) {
                for (const attr of attributes) {
                    if (!allAttrs.find(a => a.name === attr.name)) {
                        allAttrs.push(attr);
                    }
                }
            }
            const headerAttr = allAttrs[0];
            const headerSize = VFXEventAttributeTypeSize[headerAttr.type];
            this._entries.set(headerAttr.name, { type: headerAttr.type, offset: 0, size: headerSize });
            const eventAttrs = allAttrs.slice(1);
            let maxAlign = 4;
            for (const attr of eventAttrs) {
                maxAlign = Math.max(maxAlign, Std430Alignment[attr.type]);
            }
            this._eventDataOffset = alignTo(headerSize, maxAlign);
            let offset = this._eventDataOffset;
            for (const attr of eventAttrs) {
                const align = Std430Alignment[attr.type];
                const size = VFXEventAttributeTypeSize[attr.type];
                offset = alignTo(offset, align);
                this._entries.set(attr.name, { type: attr.type, offset, size });
                offset += size;
            }
            this._eventDataStride = alignTo(offset - this._eventDataOffset, maxAlign);
            this._stride = this._eventDataOffset + this._eventDataStride;
        }
        getAttributeOffset(name) {
            const entry = this._entries.get(name);
            if (!entry)
                return -1;
            return entry.offset;
        }
        getAttributeType(name) {
            var _a;
            return (_a = this._entries.get(name)) === null || _a === void 0 ? void 0 : _a.type;
        }
        getAttributeSize(name) {
            const entry = this._entries.get(name);
            if (!entry)
                return 0;
            return entry.size;
        }
        hasAttribute(name) {
            return this._entries.has(name);
        }
        createBuffer() {
            return new ArrayBuffer(this._stride);
        }
    }
    VFXEventAttributeDesc.defaultAttributes = [
        { name: "spawnCount", type: exports.VFXEventAttributeType.Float },
    ];
    class VFXEventAttribute {
        get view() {
            return this._view;
        }
        constructor(desc) {
            this._desc = desc;
        }
        get desc() {
            return this._desc;
        }
        get buffer() {
            return this._buffer;
        }
        initBuffer(buffer, byteOffset = 0, byteLength) {
            this._buffer = buffer;
            this._view = new DataView(buffer, byteOffset, byteLength !== null && byteLength !== void 0 ? byteLength : this._desc.stride);
        }
        setBool(name, value) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return;
            this._view.setInt32(offset, value ? 1 : 0, true);
        }
        getBool(name) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return false;
            return this._view.getInt32(offset, true) !== 0;
        }
        setInt(name, value) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return;
            this._view.setInt32(offset, value, true);
        }
        getInt(name) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return 0;
            return this._view.getInt32(offset, true);
        }
        setUint(name, value) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return;
            this._view.setUint32(offset, value, true);
        }
        getUint(name) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return 0;
            return this._view.getUint32(offset, true);
        }
        setFloat(name, value) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return;
            this._view.setFloat32(offset, value, true);
        }
        getFloat(name) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return 0;
            return this._view.getFloat32(offset, true);
        }
        setVector2(name, x, y) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return;
            this._view.setFloat32(offset, x, true);
            this._view.setFloat32(offset + 4, y, true);
        }
        getVector2(name, out) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return out;
            out.x = this._view.getFloat32(offset, true);
            out.y = this._view.getFloat32(offset + 4, true);
            return out;
        }
        setVector3(name, x, y, z) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return;
            this._view.setFloat32(offset, x, true);
            this._view.setFloat32(offset + 4, y, true);
            this._view.setFloat32(offset + 8, z, true);
        }
        getVector3(name, out) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return out;
            out.x = this._view.getFloat32(offset, true);
            out.y = this._view.getFloat32(offset + 4, true);
            out.z = this._view.getFloat32(offset + 8, true);
            return out;
        }
        setVector4(name, x, y, z, w) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return;
            this._view.setFloat32(offset, x, true);
            this._view.setFloat32(offset + 4, y, true);
            this._view.setFloat32(offset + 8, z, true);
            this._view.setFloat32(offset + 12, w, true);
        }
        getVector4(name, out) {
            const offset = this._desc.getAttributeOffset(name);
            if (offset < 0)
                return out;
            out.x = this._view.getFloat32(offset, true);
            out.y = this._view.getFloat32(offset + 4, true);
            out.z = this._view.getFloat32(offset + 8, true);
            out.w = this._view.getFloat32(offset + 12, true);
            return out;
        }
        clear() {
            new Uint8Array(this._buffer, this._view.byteOffset, this._view.byteLength).fill(0);
        }
        copyFrom(other) {
            const dst = new Uint8Array(this._buffer, this._view.byteOffset, this._view.byteLength);
            const src = new Uint8Array(other._buffer, other._view.byteOffset, other._view.byteLength);
            dst.set(src);
        }
        destroy() {
            this._buffer = null;
            this._view = null;
            this._desc = null;
        }
    }

    exports.VFXEventType = void 0;
    (function (VFXEventType) {
        VFXEventType[VFXEventType["Event"] = 0] = "Event";
        VFXEventType[VFXEventType["Initialize"] = 1] = "Initialize";
        VFXEventType[VFXEventType["Simulate"] = 2] = "Simulate";
    })(exports.VFXEventType || (exports.VFXEventType = {}));
    class VFXEvent {
        static init() {
            this.OnPlayEventID = Laya.Shader3D.propertyNameToID("OnPlay");
            this.OnStopEventID = Laya.Shader3D.propertyNameToID("OnStop");
        }
        constructor(type = exports.VFXEventType.Event, id = 0) {
            this.attribute = null;
            this.type = type;
            this.id = id;
        }
        reset(type, id) {
            this.type = type;
            this.id = id;
        }
    }
    class VFXEventAttributePool {
        constructor(maxPoolSize = 100) {
            this.pool = [];
            this.maxPoolSize = maxPoolSize;
        }
        acquire(desc) {
            if (this.pool.length > 0) {
                const attr = this.pool.pop();
                attr.clear();
                return attr;
            }
            const attr = new VFXEventAttribute(desc);
            attr.initBuffer(desc.createBuffer());
            return attr;
        }
        recycle(attr) {
            if (this.pool.length < this.maxPoolSize) {
                this.pool.push(attr);
            }
        }
        clear() {
            this.pool.length = 0;
        }
    }
    class VFXEventPool {
        constructor(maxPoolSize = 100) {
            this.pool = [];
            this.maxPoolSize = maxPoolSize;
            this.attributePool = new VFXEventAttributePool(maxPoolSize);
        }
        acquire(type, id) {
            let evt;
            if (this.pool.length > 0) {
                evt = this.pool.pop();
                evt.reset(type, id);
            }
            else {
                evt = new VFXEvent(type, id);
            }
            return evt;
        }
        acquireAttribute(desc) {
            return this.attributePool.acquire(desc);
        }
        recycle(evt) {
            if (evt.attribute) {
                this.attributePool.recycle(evt.attribute);
                evt.attribute = null;
            }
            if (this.pool.length < this.maxPoolSize) {
                this.pool.push(evt);
            }
        }
        recycleAll(events) {
            for (let i = 0; i < events.length; i++) {
                this.recycle(events[i]);
            }
        }
        clear() {
            this.pool.length = 0;
            this.attributePool.clear();
        }
        get size() {
            return this.pool.length;
        }
    }
    class VFXEventQueue {
        constructor(poolSize = 100) {
            this.evtLists = [[], []];
            this.currentIndex = 0;
            this.eventPool = new VFXEventPool(poolSize);
        }
        getCurrentList() {
            return this.evtLists[this.currentIndex];
        }
        getPreviousList() {
            return this.evtLists[1 - this.currentIndex];
        }
        push(id, type = exports.VFXEventType.Event, attribute) {
            let evt = this.eventPool.acquire(type, id);
            if (attribute) {
                evt.attribute = this.eventPool.acquireAttribute(attribute.desc);
                evt.attribute.copyFrom(attribute);
            }
            this.getCurrentList().push(evt);
        }
        empty() {
            return this.evtLists[this.currentIndex].length == 0;
        }
        clearList(list) {
            this.eventPool.recycleAll(list);
            list.length = 0;
        }
        clear() {
            this.clearList(this.evtLists[0]);
            this.clearList(this.evtLists[1]);
        }
        swap() {
            this.currentIndex = 1 - this.currentIndex;
            this.clearList(this.getCurrentList());
        }
        destroy() {
            this.clear();
            this.eventPool.clear();
        }
    }

    var VFXUtilsGLSL = "uint WangHash(uint seed){seed=(seed ^ 61u)^(seed>>16u);seed*=9u;seed=seed ^(seed>>4u);seed*=668265261u;seed=seed ^(seed>>15u);return seed;}float toFloat01(uint u){return uintBitsToFloat((u>>9)|1065353216u)-1.0;}uint Lcg(uint seed){return 1664525u*seed+1013904223u;}float Rand(inout uint seed){seed=Lcg(seed);return toFloat01(seed);}uint AnotherHash(uint seed){seed=((seed>>16u)^ seed)*73244475u;seed=((seed>>16u)^ seed)*73244475u;seed=(seed>>16u)^ seed;return seed;}float FixedRand(uint seed){return toFloat01(AnotherHash(seed));}int floatToSortableInt(float f){int i=floatBitsToInt(f);return(i>=0)? i :(i ^ 2147483647);}float sortableIntToFloat(int si){int i=(si>=0)? si :(si ^ 2147483647);return intBitsToFloat(i);}";

    var VFXCommonGLSL = "#include \"VFXUtils.glsl\"\nbuffer DeadListBuffer{uint count;uint indices[];}DeadList;buffer AliveListReadBuffer{uint count;uint indices[];}AliveListRead;buffer AliveListWriteBuffer{uint count;uint indices[];}AliveListWrite;\n#define PARTICLE_STRIDE 4u\n#define RENDER_STRIDE 5u\nstruct Particle{vec3 position;float lifetime;vec4 color;vec3 velocity;float size;float age;bool alive;vec3 oldPosition;};buffer AttributeBuffer{vec4 data[];}Attributes;vec3 transformPosition(mat4 m,vec3 pos){return(m*vec4(pos,1.0)).xyz;}vec3 transformDirection(mat4 m,vec3 dir){return(m*vec4(dir,0.0)).xyz;}Particle readParticle(uint particleIndex){uint base=particleIndex*PARTICLE_STRIDE;vec4 v0=Attributes.data[base];vec4 v1=Attributes.data[base+1u];vec4 v2=Attributes.data[base+2u];vec4 v3=Attributes.data[base+3u];Particle p;p.position=v0.xyz;p.lifetime=v0.w;p.color=v1;p.velocity=v2.xyz;p.size=v2.w;p.age=v3.x;p.alive=p.age<p.lifetime;p.oldPosition=p.position;return p;}void writeParticle(uint particleIndex,Particle p){uint base=particleIndex*PARTICLE_STRIDE;Attributes.data[base]=vec4(p.position,p.lifetime);Attributes.data[base+1u]=p.color;Attributes.data[base+2u]=vec4(p.velocity,p.size);Attributes.data[base+3u]=vec4(p.age,0.0,0.0,0.0);}void updateParticle(inout Particle p,float dt){p.position+=p.velocity*dt;p.age+=dt;p.alive=p.age<p.lifetime;}buffer PrefixSumBuffer{uint sums[];}PrefixSum;struct SourceEventData{vec4 color;vec4 velocity;};buffer SourceAttributeBuffer{float spawnCount;SourceEventData events[];}SourceAttributes;";

    var VFXGPUEventGLSL = "buffer EventIndexBuffer{uint count;uint indices[];}GPUEvent;buffer GPUEventDispatchBuffer{uint dispatchX;uint dispatchY;uint dispatchZ;}GPUEventDispatch;";

    var VFXRenderCommonGLSL = "struct VFXParticle{vec3 position;float normalizedAge;vec4 color;vec4 rotation;vec3 scale;float texIndex;vec3 pivot;};";

    var VFXRenderVertexGLSL = "\n#include \"VFXRenderCommon.glsl\";\nvec3 rotateByQuat(vec3 v,vec4 q){vec3 t=2.0*cross(q.xyz,v);return v+q.w*t+cross(q.xyz,t);}VFXParticle getVFXParticle(){VFXParticle p;p.position=a_AttrPosition.xyz;p.normalizedAge=a_AttrPosition.w;p.color=a_AttrColor;p.rotation=a_AttrRotation;p.scale=a_AttrScale.xyz;p.texIndex=a_AttrScale.w;p.pivot=a_AttrPivot.xyz;return p;}VFXParticle vfxProcessVertex(inout Vertex vertex){VFXParticle p=getVFXParticle();vec3 v=vertex.positionOS-p.pivot;v=v*p.scale;v=rotateByQuat(v,p.rotation);vertex.positionOS=v+p.position;return p;}vec3 vfxWorldPosition(Vertex vertex,mat4 worldMat){vec4 pos=worldMat*vec4(vertex.positionOS,1.0);return pos.xyz/pos.w;}";

    var BlueprintPixelVertexVFXGLSL = "#if !defined(BlueprintPixelVertexVFX_lib)\n#define BlueprintPixelVertexVFX_lib\n#include \"shaderBlueprint/lib/BlueprintPixel.glsl\";\nvarying float v_TexIndex;varying float v_NormalizedAge;\n#ifdef VFX_INSTANCED\nstruct VFXParticle{vec3 position;float normalizedAge;vec4 color;vec4 rotation;vec3 scale;float texIndex;vec3 pivot;};vec3 vfxRotateByQuat(vec3 v,vec4 q){vec3 t=2.0*cross(q.xyz,v);return v+q.w*t+cross(q.xyz,t);}VFXParticle vfxGetParticle(){VFXParticle p;p.position=a_AttrPosition.xyz;p.normalizedAge=a_AttrPosition.w;p.color=a_AttrColor;p.rotation=a_AttrRotation;p.scale=a_AttrScale.xyz;p.texIndex=a_AttrScale.w;p.pivot=a_AttrPivot.xyz;return p;}VFXParticle vfxTransformVertex(inout Vertex vertex){VFXParticle p=vfxGetParticle();v_TexIndex=p.texIndex;v_NormalizedAge=p.normalizedAge;vec3 vp=vertex.positionOS-p.pivot;vp=vp*p.scale;vp=vfxRotateByQuat(vp,p.rotation);vertex.positionOS=vp+p.position;vertex.normalOS=vfxRotateByQuat(vertex.normalOS,p.rotation);\n#ifdef TANGENT\nvec3 t=vfxRotateByQuat(vertex.tangentOS.xyz,p.rotation);vertex.tangentOS=vec4(t,vertex.tangentOS.w);\n#endif\n#ifdef COLOR\nvertex.vertexColor.r*=p.color.r;vertex.vertexColor.g*=p.color.g;vertex.vertexColor.b=p.color.b;vertex.vertexColor.a*=p.color.a;\n#endif\nreturn p;}\n#endif\n#endif\n";

    class VFXShaderInit {
        static init() {
            Laya.Shader3D.addInclude("VFXUtils.glsl", VFXUtilsGLSL);
            Laya.Shader3D.addInclude("VFXCommon.glsl", VFXCommonGLSL);
            Laya.Shader3D.addInclude("VFXGPUEvent.glsl", VFXGPUEventGLSL);
            Laya.Shader3D.addInclude("VFXRenderCommon.glsl", VFXRenderCommonGLSL);
            Laya.Shader3D.addInclude("VFXRenderVertex.glsl", VFXRenderVertexGLSL);
            Laya.Shader3D.addInclude("shaderBlueprint/lib/BlueprintPixelVertexVFX.glsl", BlueprintPixelVertexVFXGLSL);
        }
    }

    class VFXBillboardGeometryParams {
    }
    class VFXBillboardGeometry extends Laya.GeometryElement {
        static init() {
            const vertexElements = [];
            let offset = 0;
            for (let i = 0; i < 5; i++) {
                vertexElements.push(new Laya.VertexElement(offset, Laya.VertexElementFormat.Vector4, i + 8));
                offset += 16;
            }
            VFXBillboardGeometry.ParticleDecl = new Laya.VertexDeclaration(offset, vertexElements);
        }
        constructor(params) {
            super(Laya.MeshTopology.Triangles, Laya.DrawType.DrawArrayIndirect);
            this.bounds = new Laya.Bounds(new Laya.Vector3(-10, -10, -10), new Laya.Vector3(10, 10, 10));
            this.blendMode = "Alpha";
            this.outputType = "outputBillboard";
            this.softParticleFade = 0;
            this.uvMode = "Default";
            this.flipbookSize = new Laya.Vector2(4, 4);
            this.mainTexture = "";
            this.subpixelAA = false;
            this.customShaderName = "";
            this.primitive = "Quad";
            this.cropFactor = 0.146;
            if (!VFXBillboardGeometry.ParticleDecl) {
                VFXBillboardGeometry.init();
            }
            this.capacity = params.capacity;
            const particleVertex = params.particleBuffer;
            const particleGpuVB = (() => {
                for (const src of [params.particleDeviceBuffer, particleVertex]) {
                    if (!src)
                        continue;
                    if ('verteBufferLayout' in src)
                        return src;
                    for (const key of Object.getOwnPropertyNames(src)) {
                        const val = src[key];
                        if (val && typeof val === 'object' && 'verteBufferLayout' in val)
                            return val;
                    }
                }
                return particleVertex;
            })();
            if (particleGpuVB && particleGpuVB !== particleVertex && 'vertexDeclaration' in particleGpuVB) {
                particleGpuVB.vertexDeclaration = VFXBillboardGeometry.ParticleDecl;
                particleGpuVB.instanceBuffer = true;
            }
            this.bufferState = new Laya.BufferState();
            this.bufferState.applyState([particleVertex], null);
            this.indirectBuffer = params.indirectBuffer;
            const indirectData = new Uint32Array(5);
            indirectData[0] = params.vertexCount;
            indirectData[1] = 0;
            indirectData[2] = 0;
            indirectData[3] = 0;
            indirectData[4] = 0;
            this.indirectBuffer.deviceBuffer.setData(indirectData.buffer, 0, 0, indirectData.byteLength);
        }
        _updateRenderParams(state) {
            this.clearRenderParams();
            this._geometryElementOBj.setIndirectDrawBuffer(this.indirectBuffer.deviceBuffer, 0);
        }
        destroy() {
            var _a;
            super.destroy();
            this.clearRenderParams();
            this.indirectBuffer = null;
            (_a = this.bufferState) === null || _a === void 0 ? void 0 : _a.destroy();
        }
    }

    class VFXLineGeometryParams {
    }
    class VFXLineGeometry extends Laya.GeometryElement {
        static init() {
            VFXLineGeometry.LineVertexDecl = new Laya.VertexDeclaration(64, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 0),
                new Laya.VertexElement(16, Laya.VertexElementFormat.Vector4, 1),
                new Laya.VertexElement(32, Laya.VertexElementFormat.Vector2, 2),
                new Laya.VertexElement(48, Laya.VertexElementFormat.Vector3, 3),
            ]);
        }
        constructor(params) {
            super(Laya.MeshTopology.Lines, Laya.DrawType.DrawArrayIndirect);
            this.blendMode = "Alpha";
            this.outputType = "outputLine";
            this.softParticleFade = 0;
            this.bounds = new Laya.Bounds(new Laya.Vector3(-10, -10, -10), new Laya.Vector3(10, 10, 10));
            if (!VFXLineGeometry.LineVertexDecl) {
                VFXLineGeometry.init();
            }
            this.capacity = params.capacity;
            const vb3d = params.renderBuffer.vertexBuffer;
            vb3d.vertexDeclaration = VFXLineGeometry.LineVertexDecl;
            this.bufferState = new Laya.BufferState();
            this.bufferState.applyState([vb3d], null);
            this.indirectBuffer = params.indirectBuffer;
            const indirectData = new Uint32Array(5);
            indirectData[0] = 0;
            indirectData[1] = 1;
            indirectData[2] = 0;
            indirectData[3] = 0;
            indirectData[4] = 0;
            this.indirectBuffer.deviceBuffer.setData(indirectData.buffer, 0, 0, indirectData.byteLength);
        }
        _updateRenderParams(state) {
            this.clearRenderParams();
            this._geometryElementOBj.setIndirectDrawBuffer(this.indirectBuffer.deviceBuffer, 0);
        }
        destroy() {
            var _a;
            super.destroy();
            this.clearRenderParams();
            this.indirectBuffer = null;
            (_a = this.bufferState) === null || _a === void 0 ? void 0 : _a.destroy();
        }
    }

    class VFXLineStripGeometryParams {
    }
    class VFXLineStripGeometry extends Laya.GeometryElement {
        static init() {
            VFXLineStripGeometry.LineStripVertexDecl = new Laya.VertexDeclaration(48, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 0),
                new Laya.VertexElement(16, Laya.VertexElementFormat.Vector4, 1),
                new Laya.VertexElement(32, Laya.VertexElementFormat.Vector2, 2),
            ]);
        }
        constructor(params) {
            super(Laya.MeshTopology.LineStrip, Laya.DrawType.DrawArrayIndirect);
            this.blendMode = "Alpha";
            this.outputType = "outputLineStrip";
            this.softParticleFade = 0;
            this.bounds = new Laya.Bounds(new Laya.Vector3(-10, -10, -10), new Laya.Vector3(10, 10, 10));
            if (!VFXLineStripGeometry.LineStripVertexDecl) {
                VFXLineStripGeometry.init();
            }
            this.capacity = params.capacity;
            const vb3d = params.renderBuffer.vertexBuffer;
            vb3d.vertexDeclaration = VFXLineStripGeometry.LineStripVertexDecl;
            this.bufferState = new Laya.BufferState();
            this.bufferState.applyState([vb3d], null);
            this.indirectBuffer = params.indirectBuffer;
            const indirectData = new Uint32Array(5);
            indirectData[0] = 0;
            indirectData[1] = 1;
            indirectData[2] = 0;
            indirectData[3] = 0;
            indirectData[4] = 0;
            this.indirectBuffer.deviceBuffer.setData(indirectData.buffer, 0, 0, indirectData.byteLength);
        }
        _updateRenderParams(state) {
            this.clearRenderParams();
            this._geometryElementOBj.setIndirectDrawBuffer(this.indirectBuffer.deviceBuffer, 0);
        }
        destroy() {
            var _a;
            super.destroy();
            this.clearRenderParams();
            this.indirectBuffer = null;
            (_a = this.bufferState) === null || _a === void 0 ? void 0 : _a.destroy();
        }
    }

    class VFXPointGeometryParams {
    }
    class VFXPointGeometry extends Laya.GeometryElement {
        static init() {
            VFXPointGeometry.PointVertexDecl = new Laya.VertexDeclaration(48, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 0),
                new Laya.VertexElement(16, Laya.VertexElementFormat.Vector4, 1),
                new Laya.VertexElement(32, Laya.VertexElementFormat.Vector2, 2),
            ]);
        }
        constructor(params) {
            super(Laya.MeshTopology.Points, Laya.DrawType.DrawArrayIndirect);
            this.blendMode = "Alpha";
            this.outputType = "outputPoint";
            this.softParticleFade = 0;
            this.bounds = new Laya.Bounds(new Laya.Vector3(-10, -10, -10), new Laya.Vector3(10, 10, 10));
            if (!VFXPointGeometry.PointVertexDecl) {
                VFXPointGeometry.init();
            }
            this.capacity = params.capacity;
            const vb3d = params.renderBuffer.vertexBuffer;
            vb3d.vertexDeclaration = VFXPointGeometry.PointVertexDecl;
            this.bufferState = new Laya.BufferState();
            this.bufferState.applyState([vb3d], null);
            this.indirectBuffer = params.indirectBuffer;
            const indirectData = new Uint32Array(5);
            indirectData[0] = 0;
            indirectData[1] = 1;
            indirectData[2] = 0;
            indirectData[3] = 0;
            indirectData[4] = 0;
            this.indirectBuffer.deviceBuffer.setData(indirectData.buffer, 0, 0, indirectData.byteLength);
        }
        _updateRenderParams(state) {
            this.clearRenderParams();
            this._geometryElementOBj.setIndirectDrawBuffer(this.indirectBuffer.deviceBuffer, 0);
        }
        destroy() {
            var _a;
            super.destroy();
            this.clearRenderParams();
            this.indirectBuffer = null;
            (_a = this.bufferState) === null || _a === void 0 ? void 0 : _a.destroy();
        }
    }

    class VFXSystem {
    }

    let ID;
    function ensureIDs() {
        if (ID)
            return;
        ID = {
            DeadListBuffer: Laya.Shader3D.propertyNameToID("DeadListBuffer"),
            AliveListReadBuffer: Laya.Shader3D.propertyNameToID("AliveListReadBuffer"),
            AliveListWriteBuffer: Laya.Shader3D.propertyNameToID("AliveListWriteBuffer"),
            AttributeBuffer: Laya.Shader3D.propertyNameToID("AttributeBuffer"),
            RenderBuffer: Laya.Shader3D.propertyNameToID("RenderBuffer"),
            IndirectBuffer: Laya.Shader3D.propertyNameToID("IndirectBuffer"),
            SourceAttributeBuffer: Laya.Shader3D.propertyNameToID("SourceAttributeBuffer"),
            PrefixSumBuffer: Laya.Shader3D.propertyNameToID("PrefixSumBuffer"),
            EventIndexBuffer: Laya.Shader3D.propertyNameToID("EventIndexBuffer"),
            SourceParticleBuffer: Laya.Shader3D.propertyNameToID("SourceParticleBuffer"),
            AccumulatorBuffer: Laya.Shader3D.propertyNameToID("AccumulatorBuffer"),
            GPUEventDispatchBuffer: Laya.Shader3D.propertyNameToID("GPUEventDispatchBuffer"),
            BoundsBuffer: Laya.Shader3D.propertyNameToID("BoundsBuffer"),
            StripDataBuffer: Laya.Shader3D.propertyNameToID("StripDataBuffer"),
            u_Capacity: Laya.Shader3D.propertyNameToID("u_Capacity"),
            u_DeltaTime: Laya.Shader3D.propertyNameToID("u_DeltaTime"),
            u_TotalTime: Laya.Shader3D.propertyNameToID("u_TotalTime"),
            u_SystemSeed: Laya.Shader3D.propertyNameToID("u_SystemSeed"),
            u_SpawnedCount: Laya.Shader3D.propertyNameToID("u_SpawnedCount"),
            u_TotalSpawnedCount: Laya.Shader3D.propertyNameToID("u_TotalSpawnedCount"),
            u_LoopIndex: Laya.Shader3D.propertyNameToID("u_LoopIndex"),
            u_EventCount: Laya.Shader3D.propertyNameToID("u_EventCount"),
            u_MaxSpawnCount: Laya.Shader3D.propertyNameToID("u_MaxSpawnCount"),
            u_EmitterWorldMatrix: Laya.Shader3D.propertyNameToID("u_EmitterWorldMatrix"),
            u_InvEmitterWorldMatrix: Laya.Shader3D.propertyNameToID("u_InvEmitterWorldMatrix"),
            u_SourceSimulateSpace: Laya.Shader3D.propertyNameToID("u_SourceSimulateSpace"),
            u_VfxCameraParams: Laya.Shader3D.propertyNameToID("u_VfxCameraParams"),
            u_VfxCameraParams2: Laya.Shader3D.propertyNameToID("u_VfxCameraParams2"),
            u_VfxCameraParams3: Laya.Shader3D.propertyNameToID("u_VfxCameraParams3"),
            u_CameraDepthTexture: Laya.Shader3D.propertyNameToID("u_CameraDepthTexture"),
            u_VfxViewProjection: Laya.Shader3D.propertyNameToID("u_VfxViewProjection"),
            u_VfxInvViewProjection: Laya.Shader3D.propertyNameToID("u_VfxInvViewProjection"),
            u_OrientCameraPos: Laya.Shader3D.propertyNameToID("u_OrientCameraPos"),
            u_OrientCameraDir: Laya.Shader3D.propertyNameToID("u_OrientCameraDir"),
            u_OrientCameraUp: Laya.Shader3D.propertyNameToID("u_OrientCameraUp"),
            u_ParticlePerStrip: Laya.Shader3D.propertyNameToID("u_ParticlePerStrip"),
            u_StripCapacity: Laya.Shader3D.propertyNameToID("u_StripCapacity"),
            u_NewLoop: Laya.Shader3D.propertyNameToID("u_NewLoop"),
            u_LoopState: Laya.Shader3D.propertyNameToID("u_LoopState"),
            u_SpawnCount: Laya.Shader3D.propertyNameToID("u_SpawnCount"),
            u_SpawnDeltaTime: Laya.Shader3D.propertyNameToID("u_SpawnDeltaTime"),
            u_SpawnTotalTime: Laya.Shader3D.propertyNameToID("u_SpawnTotalTime"),
            u_LoopDuration: Laya.Shader3D.propertyNameToID("u_LoopDuration"),
            u_LoopCount: Laya.Shader3D.propertyNameToID("u_LoopCount"),
            u_DelayBeforeLoop: Laya.Shader3D.propertyNameToID("u_DelayBeforeLoop"),
            u_DelayAfterLoop: Laya.Shader3D.propertyNameToID("u_DelayAfterLoop"),
        };
    }
    class VFXParticleSystem extends VFXSystem {
        get isStripOutput() {
            return this.outputType === "outputTrail" || this.outputType === "outputParticleStripSGQuad";
        }
        get isBillboardProcedural() {
            return this.outputType === "outputBillboard" && !!this.billboardPrimitive;
        }
        get isProceduralGeometry() {
            return (this.outputType === "outputBillboard" || this.outputType === "outputCube" || this.outputType === "outputDistortion") && !!this.billboardPrimitive;
        }
        constructor() {
            var _a;
            super();
            this.spawnerSystems = [];
            this.boundsMode = exports.VFXBoundsMode.Automatic;
            this.boundsCenter = new Laya.Vector3(0, 0, 0);
            this.boundsExtents = new Laya.Vector3(1, 1, 1);
            this._cameraParams = new Laya.Vector4();
            this._cameraParams2 = new Laya.Vector4();
            this._cameraParams3 = new Laya.Vector4();
            this.simulateSpace = exports.VFXSimulateSpace.Local;
            this.receiveGPUEvent = false;
            this.gpuEventInput = null;
            this.gpuEventSourceSystem = null;
            this.gpuEventType = null;
            this.gpuEventReceiverCount = 0;
            this.eventIndexBuffers = [];
            this.gpuEventBufferIndex = -1;
            this.gpuEventAccumulatorBuffer = null;
            this.gpuEventDispatchBuffer = null;
            this.capacity = 10;
            this.outputType = "outputMesh";
            this.particlePerStripCount = 128;
            this.stripCapacity = 1;
            this.blendMode = "Alpha";
            this.matInstanceKey = "s" + (VFXParticleSystem._matUidCounter++);
            this.softParticleFade = 0;
            this.uvMode = "Default";
            this.flipbookSize = new Laya.Vector2(4, 4);
            this.mainTexture = "";
            this.subpixelAA = false;
            this.stripColorMapping = "Default";
            this.stripUvScale = { x: 1, y: 1 };
            this.stripUvBias = { x: 0, y: 0 };
            this.stripGradientStops = [];
            this.stripTilingMode = "Stretch";
            this.customShaderName = "";
            this.billboardPrimitive = "";
            this.billboardVertexCount = 0;
            this.billboardCropFactor = 0.146;
            this.useAlphaClipping = false;
            this.alphaThreshold = 0.5;
            this.distortionMode = "Procedural";
            this.stripVertexBuffer = null;
            this.stripDataBuffer = null;
            this.updateStripsShader = null;
            this.updateStripsDatas = null;
            this.useStripRingBuffer = false;
            this.spawnedCount = 0;
            this.eventCount = 0;
            this._cumulativeSpawnTotal = 0;
            this.maxEventsPerFrame = 32;
            this.dispatch = new Laya.Vector3(1, 1, 1);
            this.extraOutputs = [];
            this.boundsReadbackPending = false;
            this._released = false;
            this.eventIndexBufferIDs = [];
            this.outputEventDescs = [];
            this.outputEventBuffers = [];
            this.outputEventStagingBuffers = [];
            this.outputEventBufferIDs = [];
            this.outputEventReadbackDest = [];
            this.outputEventReadbackPending = [];
            this.outputEventAccumulatorBuffer = null;
            this.outputEventAccumulatorBufferID = -1;
            this.outputEventAccumulatorSlots = 0;
            this.initializeDatas = [Laya.LayaGL.renderDeviceFactory.createShaderData()];
            this.updateDatas = [Laya.LayaGL.renderDeviceFactory.createShaderData()];
            this.outputDatas = [Laya.LayaGL.renderDeviceFactory.createShaderData()];
            this.prepareDispatchDatas = [Laya.LayaGL.renderDeviceFactory.createShaderData()];
            this._allShaderDatas = [
                this.initializeDatas[0],
                this.updateDatas[0],
                this.outputDatas[0],
                this.prepareDispatchDatas[0],
            ];
            for (const extra of this.extraOutputs) {
                if ((_a = extra.outputDatas) === null || _a === void 0 ? void 0 : _a[0]) {
                    this._allShaderDatas.push(extra.outputDatas[0]);
                }
            }
        }
        setupOutputEventBuffers() {
            if (!this.outputEventDescs || this.outputEventDescs.length === 0)
                return;
            this.outputEventAccumulatorSlots = 0;
            for (const desc of this.outputEventDescs) {
                if (desc.eventType === "OverTime" || desc.eventType === "OverDistance") {
                    this.outputEventAccumulatorSlots++;
                }
            }
            const bufUsage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_SRC | Laya.EDeviceBufferUsage.COPY_DST;
            const stagingUsage = Laya.EDeviceBufferUsage.MAP_READ | Laya.EDeviceBufferUsage.COPY_DST;
            for (let i = 0; i < this.outputEventDescs.length; i++) {
                const desc = this.outputEventDescs[i];
                const bufSize = 4 + desc.capacity * desc.entryBytes;
                const buffer = new Laya.DeviceBuffer(bufSize, bufUsage);
                const initData = new Uint32Array(1);
                initData[0] = 0;
                buffer.deviceBuffer.setData(initData.buffer, 0, 0, 4);
                this.outputEventBuffers.push(buffer);
                const staging = new Laya.DeviceBuffer(bufSize, stagingUsage);
                this.outputEventStagingBuffers.push(staging);
                this.outputEventBufferIDs.push(Laya.Shader3D.propertyNameToID(`OutputEventBuffer_${desc.eventIdx}`));
                this.outputEventReadbackDest.push(new ArrayBuffer(bufSize));
                this.outputEventReadbackPending.push(false);
            }
            if (this.outputEventAccumulatorSlots > 0) {
                const accBytes = this.capacity * this.outputEventAccumulatorSlots * 4;
                const accUsage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST;
                this.outputEventAccumulatorBuffer = new Laya.DeviceBuffer(accBytes, accUsage);
                const init = new Float32Array(this.capacity * this.outputEventAccumulatorSlots);
                this.outputEventAccumulatorBuffer.deviceBuffer.setData(init.buffer, 0, 0, accBytes);
                this.outputEventAccumulatorBufferID = Laya.Shader3D.propertyNameToID("OutputEventAccumulatorBuffer");
            }
        }
        copyOutputEventsToStaging(cmd) {
            for (let i = 0; i < this.outputEventBuffers.length; i++) {
                if (this.outputEventReadbackPending[i])
                    continue;
                const buf = this.outputEventBuffers[i];
                const staging = this.outputEventStagingBuffers[i];
                if (!buf || !staging)
                    continue;
                const desc = this.outputEventDescs[i];
                const bytes = 4 + desc.capacity * desc.entryBytes;
                cmd.addBufferToBufferCommand(buf.deviceBuffer, staging.deviceBuffer, 0, 0, bytes);
            }
        }
        requestOutputEventReadback(dispatch) {
            if (this._released)
                return;
            for (let i = 0; i < this.outputEventStagingBuffers.length; i++) {
                if (this.outputEventReadbackPending[i])
                    continue;
                const staging = this.outputEventStagingBuffers[i];
                const desc = this.outputEventDescs[i];
                if (!staging || !desc)
                    continue;
                const bytes = 4 + desc.capacity * desc.entryBytes;
                const dest = this.outputEventReadbackDest[i];
                this.outputEventReadbackPending[i] = true;
                const idx = i;
                staging.deviceBuffer.readData(dest, 0, 0, bytes).then(() => {
                    this.outputEventReadbackPending[idx] = false;
                    if (this._released)
                        return;
                    this._dispatchOutputEvent(idx, dispatch);
                });
            }
        }
        _dispatchOutputEvent(idx, dispatch) {
            const desc = this.outputEventDescs[idx];
            const dest = this.outputEventReadbackDest[idx];
            if (!desc || !dest)
                return;
            const u32 = new Uint32Array(dest);
            const f32 = new Float32Array(dest);
            const count = Math.min(u32[0], desc.capacity);
            if (count === 0)
                return;
            const entries = [];
            const headerFloats = 1;
            for (let i = 0; i < count; i++) {
                const base = headerFloats + i * desc.entryFloats;
                entries.push({
                    particleId: u32[base + 0],
                    position: [f32[base + 1], f32[base + 2], f32[base + 3]],
                    age: f32[base + 4],
                    velocity: [f32[base + 5], f32[base + 6], f32[base + 7]],
                    lifetime: f32[base + 8],
                    color: [f32[base + 9], f32[base + 10], f32[base + 11], f32[base + 12]],
                    size: f32[base + 13],
                });
            }
            dispatch(desc.eventName, entries);
        }
        addEventIndexBuffer(maxEntries) {
            const index = this.eventIndexBuffers.length;
            const bufferSize = 4 * (maxEntries + 1);
            const usage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST;
            const buffer = new Laya.DeviceBuffer(bufferSize, usage);
            const initData = new Uint32Array(1);
            initData[0] = 0;
            buffer.deviceBuffer.setData(initData.buffer, 0, 0, 4);
            this.eventIndexBuffers.push(buffer);
            this.eventIndexBufferIDs.push(Laya.Shader3D.propertyNameToID(`EventIndexBuffer_${index}`));
            return index;
        }
        ensureAccumulatorBuffer() {
            if (this.gpuEventAccumulatorBuffer) {
                this.gpuEventAccumulatorBuffer.destroy();
            }
            const numEvents = this.gpuEventReceiverCount;
            if (numEvents === 0)
                return;
            const bufferSize = this.capacity * numEvents * 4;
            const usage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST;
            this.gpuEventAccumulatorBuffer = new Laya.DeviceBuffer(bufferSize, usage);
            const initData = new Float32Array(this.capacity * numEvents);
            this.gpuEventAccumulatorBuffer.deviceBuffer.setData(initData.buffer, 0, 0, bufferSize);
        }
        initSourceAttributes() {
            const desc = this.effect.asset.eventAttributeDesc;
            const headerBytes = desc.eventDataOffset;
            const eventStride = desc.eventDataStride;
            const totalBytes = headerBytes + this.maxEventsPerFrame * eventStride;
            this.sourceAttributeStaging = new Float32Array(totalBytes / 4);
            this.prefixSumStaging = new Uint32Array(this.maxEventsPerFrame + 1);
            this.spawnCountsPerEvent = new Uint32Array(this.maxEventsPerFrame);
            const storageUsage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST;
            this.sourceAttributeBuffer = new Laya.DeviceBuffer(totalBytes, storageUsage);
            this.prefixSumBuffer = new Laya.DeviceBuffer(4 * (this.maxEventsPerFrame + 1), storageUsage);
        }
        releaseSourceAttributes() {
            this.sourceAttributeBuffer.destroy();
            this.prefixSumBuffer.destroy();
        }
        getAllShaderDatas() {
            var _a;
            if (this.extraOutputs.length > 0) {
                for (const extra of this.extraOutputs) {
                    const esd = (_a = extra.outputDatas) === null || _a === void 0 ? void 0 : _a[0];
                    if (esd && this._allShaderDatas.indexOf(esd) === -1) {
                        this._allShaderDatas.push(esd);
                    }
                }
            }
            return this._allShaderDatas;
        }
        setCommonUniforms(state, camera) {
            var _a;
            const allDatas = this.getAllShaderDatas();
            for (const sd of allDatas) {
                sd.setInt(ID.u_Capacity, this.capacity);
                sd.setNumber(ID.u_DeltaTime, state.deltaTime);
                sd.setNumber(ID.u_TotalTime, state.totalTime);
                sd.setInt(ID.u_SystemSeed, state.systemSeed);
                sd.setInt(ID.u_MaxSpawnCount, this.capacity);
                sd.setInt(ID.u_ParticlePerStrip, this.particlePerStripCount);
                sd.setInt(ID.u_StripCapacity, this.stripCapacity);
            }
            for (const sd of allDatas) {
                sd.setMatrix4x4(ID.u_EmitterWorldMatrix, state.emitterWorldMatrix);
                sd.setMatrix4x4(ID.u_InvEmitterWorldMatrix, state.invEmitterWorldMatrix);
            }
            if (camera) {
                const pos = camera.transform.position;
                const rot = camera.transform.localRotationEuler;
                const isOrtho = camera.orthographic ? 1.0 : 0.0;
                this._cameraParams.setValue(pos.x, pos.y, pos.z, isOrtho);
                this._cameraParams2.setValue(rot.x, rot.y, rot.z, camera.fieldOfView);
                this._cameraParams3.setValue(camera.nearPlane, camera.farPlane, camera.orthographicVerticalSize, camera.aspectRatio);
                for (const sd of allDatas) {
                    sd.setVector(ID.u_VfxCameraParams, this._cameraParams);
                    sd.setVector(ID.u_VfxCameraParams2, this._cameraParams2);
                    sd.setVector(ID.u_VfxCameraParams3, this._cameraParams3);
                }
                const depthTex = ((_a = camera.depthTexture) !== null && _a !== void 0 ? _a : camera._depthTexture);
                if (depthTex) {
                    const vp = camera.projectionViewMatrix;
                    if (!this._invVP)
                        this._invVP = new Laya.Matrix4x4();
                    vp.invert(this._invVP);
                    for (const sd of allDatas) {
                        sd.setTexture(ID.u_CameraDepthTexture, depthTex);
                        sd.setMatrix4x4(ID.u_VfxViewProjection, vp);
                        sd.setMatrix4x4(ID.u_VfxInvViewProjection, this._invVP);
                    }
                }
            }
        }
        setOrientCamera(cmd, cameraWorldPos, cameraForward, cameraUp) {
            var _a;
            for (const sd of this.outputDatas) {
                cmd.addSetShaderDataCommand(sd, ID.u_OrientCameraPos, Laya.ShaderDataType.Vector3, cameraWorldPos);
                cmd.addSetShaderDataCommand(sd, ID.u_OrientCameraDir, Laya.ShaderDataType.Vector3, cameraForward);
                cmd.addSetShaderDataCommand(sd, ID.u_OrientCameraUp, Laya.ShaderDataType.Vector3, cameraUp);
            }
            for (const extra of this.extraOutputs) {
                const esd = (_a = extra.outputDatas) === null || _a === void 0 ? void 0 : _a[0];
                if (esd) {
                    cmd.addSetShaderDataCommand(esd, ID.u_OrientCameraPos, Laya.ShaderDataType.Vector3, cameraWorldPos);
                    cmd.addSetShaderDataCommand(esd, ID.u_OrientCameraDir, Laya.ShaderDataType.Vector3, cameraForward);
                    cmd.addSetShaderDataCommand(esd, ID.u_OrientCameraUp, Laya.ShaderDataType.Vector3, cameraUp);
                }
            }
        }
        init() {
            const capacity = this.capacity;
            const deadListSize = 4 * (capacity + 1);
            const deadListUsage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST;
            this.deadListBuffer = new Laya.DeviceBuffer(deadListSize, deadListUsage);
            {
                const initData = new Uint32Array(capacity + 1);
                if (this.useStripRingBuffer) {
                    initData[0] = 0;
                }
                else {
                    initData[0] = capacity;
                    for (let i = 0; i < capacity; i++) {
                        initData[i + 1] = i;
                    }
                }
                this.deadListBuffer.deviceBuffer.setData(initData.buffer, 0, 0, deadListSize);
            }
            if (this.isStripOutput) {
                const stripCount = this.stripCapacity;
                const stripDataSize = stripCount * 5 * 4;
                const stripDataUsage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST;
                this.stripDataBuffer = new Laya.DeviceBuffer(stripDataSize, stripDataUsage);
                const stripInit = new Uint32Array(stripCount * 5);
                for (let s = 0; s < stripCount; s++) {
                    stripInit[s * 5 + 4] = 0xFFFFFFFF;
                }
                this.stripDataBuffer.deviceBuffer.setData(stripInit.buffer, 0, 0, stripDataSize);
            }
            const aliveListSize = 4 * (capacity + 1);
            const aliveListUsage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST;
            this.aliveListBufferRead = new Laya.DeviceBuffer(aliveListSize, aliveListUsage);
            this.aliveListBufferWrite = new Laya.DeviceBuffer(aliveListSize, aliveListUsage);
            {
                const initData = new Uint32Array(1);
                initData[0] = 0;
                this.aliveListBufferRead.deviceBuffer.setData(initData.buffer, 0, 0, 4);
                this.aliveListBufferWrite.deviceBuffer.setData(initData.buffer, 0, 0, 4);
            }
            const attributeStride = this.attributeBytesPerParticle;
            const attributeUsage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST;
            this.attributeBuffer = new Laya.DeviceBuffer(attributeStride * capacity, attributeUsage);
            const isNoOutput = this.outputType === "none";
            const isStrip = this.isStripOutput;
            const isPoint = this.outputType === "outputPoint";
            const isLine = this.outputType === "outputLine";
            const isLineStrip = this.outputType === "outputLineStrip";
            const isBillboardProc = this.isProceduralGeometry;
            if (!isNoOutput) {
                let renderStride;
                if (isStrip)
                    renderStride = 2 * 4 * 16;
                else if (isPoint)
                    renderStride = 3 * 16;
                else if (isLineStrip)
                    renderStride = 3 * 16;
                else if (isLine)
                    renderStride = 2 * 4 * 16;
                else
                    renderStride = VFXGeometry.ParticleDecl.vertexStride;
                const renderUsage = Laya.EDeviceBufferUsage.STORAGE |
                    Laya.EDeviceBufferUsage.COPY_DST |
                    Laya.EDeviceBufferUsage.VERTEX;
                this.renderBuffer = new Laya.DeviceBuffer(renderStride * capacity, renderUsage);
                if (isStrip) {
                    if (!VFXStripGeometry.StripVertexDecl)
                        VFXStripGeometry.init();
                    this.renderBuffer.vertexBuffer.vertexDeclaration = VFXStripGeometry.StripVertexDecl;
                }
                else if (isPoint) {
                    if (!VFXPointGeometry.PointVertexDecl)
                        VFXPointGeometry.init();
                    this.renderBuffer.vertexBuffer.vertexDeclaration = VFXPointGeometry.PointVertexDecl;
                }
                else if (isLineStrip) {
                    if (!VFXLineStripGeometry.LineStripVertexDecl)
                        VFXLineStripGeometry.init();
                    this.renderBuffer.vertexBuffer.vertexDeclaration = VFXLineStripGeometry.LineStripVertexDecl;
                }
                else if (isLine) {
                    if (!VFXLineGeometry.LineVertexDecl)
                        VFXLineGeometry.init();
                    this.renderBuffer.vertexBuffer.vertexDeclaration = VFXLineGeometry.LineVertexDecl;
                }
                else {
                    this.renderBuffer.vertexBuffer.vertexDeclaration = VFXGeometry.ParticleDecl;
                    this.renderBuffer.vertexBuffer.instanceBuffer = true;
                }
                const indirectUsage = Laya.EDeviceBufferUsage.INDIRECT |
                    Laya.EDeviceBufferUsage.STORAGE |
                    Laya.EDeviceBufferUsage.COPY_DST;
                this.indirectBuffer = new Laya.DeviceBuffer(20, indirectUsage);
            }
            this.initSourceAttributes();
            if (!isNoOutput) {
                try {
                    if (isStrip) {
                        const stripParams = new VFXStripGeometryParams();
                        stripParams.capacity = capacity;
                        stripParams.stripVertexBuffer = this.renderBuffer;
                        stripParams.indirectBuffer = this.indirectBuffer;
                        stripParams.stripCapacity = this.stripCapacity;
                        stripParams.particlePerStripCount = this.particlePerStripCount;
                        this.geometry = new VFXStripGeometry(stripParams);
                        this.geometry.blendMode = this.blendMode;
                        this.geometry.outputType = this.outputType;
                        this.geometry.customShaderName = this.customShaderName;
                        this.geometry.mainTexture = this.mainTexture;
                        this.geometry.stripColorMapping = this.stripColorMapping;
                        this.geometry.stripUvScale = this.stripUvScale;
                        this.geometry.stripUvBias = this.stripUvBias;
                        this.geometry.stripGradientStops = this.stripGradientStops;
                        this.geometry.stripTilingMode = this.stripTilingMode;
                        this.geometry.stripPpsc = this.particlePerStripCount;
                    }
                    else if (isPoint) {
                        const pointParams = new VFXPointGeometryParams();
                        pointParams.capacity = capacity;
                        pointParams.renderBuffer = this.renderBuffer;
                        pointParams.indirectBuffer = this.indirectBuffer;
                        this.geometry = new VFXPointGeometry(pointParams);
                        this.geometry.blendMode = this.blendMode;
                        this.geometry.outputType = this.outputType;
                    }
                    else if (isLineStrip) {
                        const lsParams = new VFXLineStripGeometryParams();
                        lsParams.capacity = capacity;
                        lsParams.renderBuffer = this.renderBuffer;
                        lsParams.indirectBuffer = this.indirectBuffer;
                        this.geometry = new VFXLineStripGeometry(lsParams);
                        this.geometry.blendMode = this.blendMode;
                        this.geometry.outputType = this.outputType;
                    }
                    else if (isLine) {
                        const lineParams = new VFXLineGeometryParams();
                        lineParams.capacity = capacity;
                        lineParams.renderBuffer = this.renderBuffer;
                        lineParams.indirectBuffer = this.indirectBuffer;
                        this.geometry = new VFXLineGeometry(lineParams);
                        this.geometry.blendMode = this.blendMode;
                        this.geometry.outputType = this.outputType;
                    }
                    else if (isBillboardProc) {
                        const bbParams = new VFXBillboardGeometryParams();
                        bbParams.capacity = capacity;
                        bbParams.vertexCount = this.billboardVertexCount;
                        bbParams.particleBuffer = this.renderBuffer.vertexBuffer;
                        bbParams.particleDeviceBuffer = this.renderBuffer;
                        bbParams.indirectBuffer = this.indirectBuffer;
                        this.geometry = new VFXBillboardGeometry(bbParams);
                        this.geometry.blendMode = this.blendMode;
                        this.geometry.outputType = this.outputType;
                        this.geometry.softParticleFade = this.softParticleFade;
                        this.geometry.uvMode = this.uvMode;
                        this.geometry.flipbookSize = this.flipbookSize;
                        this.geometry.mainTexture = this.mainTexture;
                        this.geometry.subpixelAA = this.subpixelAA;
                        this.geometry.customShaderName = this.customShaderName;
                        this.geometry.primitive = this.billboardPrimitive;
                        this.geometry.cropFactor = this.billboardCropFactor;
                        this.geometry.useAlphaClipping = this.useAlphaClipping;
                        this.geometry.alphaThreshold = this.alphaThreshold;
                        if (this.outputType === "outputDistortion") {
                            this.geometry.distortionMode = this.distortionMode;
                        }
                    }
                    else {
                        const geometryParams = new VFXGeometryParams();
                        geometryParams.particleBuffer = this.renderBuffer.vertexBuffer;
                        geometryParams.particleDeviceBuffer = this.renderBuffer;
                        geometryParams.indirectBuffer = this.indirectBuffer;
                        geometryParams.capacity = capacity;
                        geometryParams.mesh = this.mesh;
                        this.geometry = new VFXGeometry(geometryParams);
                        this.geometry.blendMode = this.blendMode;
                        this.geometry.outputType = this.outputType;
                        this.geometry.softParticleFade = this.softParticleFade;
                        this.geometry.uvMode = this.uvMode;
                        this.geometry.flipbookSize = this.flipbookSize;
                        this.geometry.subpixelAA = this.subpixelAA;
                        this.geometry.customShaderName = this.customShaderName;
                    }
                    if (this.geometry)
                        this.geometry.matInstanceKey = this.matInstanceKey;
                }
                catch (e) {
                    console.warn("VFXParticleSystem: geometry creation failed, compute pipeline will still run.", e);
                }
            }
            {
                const boundsUsage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_SRC | Laya.EDeviceBufferUsage.COPY_DST;
                this.boundsBuffer = new Laya.DeviceBuffer(24, boundsUsage);
                const stagingUsage = Laya.EDeviceBufferUsage.MAP_READ | Laya.EDeviceBufferUsage.COPY_DST;
                this.boundsStagingBuffer = new Laya.DeviceBuffer(24, stagingUsage);
                this.boundsResetData = new Int32Array([
                    0x7FFFFFFF, 0x7FFFFFFF, 0x7FFFFFFF,
                    -0x80000000, -0x80000000, -0x80000000
                ]);
                this.boundsBuffer.deviceBuffer.setData(this.boundsResetData.buffer, 0, 0, 24);
                this.boundsReadbackDest = new ArrayBuffer(24);
                this.boundsDataView = new DataView(new ArrayBuffer(4));
            }
            if (this.boundsMode === exports.VFXBoundsMode.Manual && this.geometry) {
                const c = this.boundsCenter;
                const e = this.boundsExtents;
                this.geometry.bounds.setMin(new Laya.Vector3(c.x - e.x, c.y - e.y, c.z - e.z));
                this.geometry.bounds.setMax(new Laya.Vector3(c.x + e.x, c.y + e.y, c.z + e.z));
            }
            this.spawnedCount = 0;
            this._cumulativeSpawnTotal = 0;
            if (this.receiveGPUEvent && this.gpuEventInput) {
                const sourceIndex = this.gpuEventInput.sourceSystem;
                const sourceSystem = this.effect.systems[sourceIndex];
                this.gpuEventSourceSystem = sourceSystem;
                this.gpuEventType = this.gpuEventInput.eventType;
                this.gpuEventBufferIndex = sourceSystem.addEventIndexBuffer(this.capacity);
                sourceSystem.gpuEventReceiverCount++;
                sourceSystem.ensureAccumulatorBuffer();
                const dispatchUsage = Laya.EDeviceBufferUsage.INDIRECT |
                    Laya.EDeviceBufferUsage.STORAGE |
                    Laya.EDeviceBufferUsage.COPY_DST;
                this.gpuEventDispatchBuffer = new Laya.DeviceBuffer(12, dispatchUsage);
                const initDispatch = new Uint32Array([0, 1, 1]);
                this.gpuEventDispatchBuffer.deviceBuffer.setData(initDispatch.buffer, 0, 0, 12);
            }
            this.setupOutputEventBuffers();
        }
        setMesh(mesh) {
            if (!mesh)
                return;
            const geo = this.geometry;
            if (geo && typeof geo.setMesh === "function") {
                this.mesh = mesh;
                geo.setMesh(mesh);
            }
        }
        receiveInitializeEvent(attr) {
            let spawnCount = Math.floor(attr.getFloat("spawnCount"));
            if (spawnCount <= 0) {
                return;
            }
            if (this.eventCount >= this.maxEventsPerFrame) {
                this.releaseSourceAttributes();
                const oldSourceStaging = this.sourceAttributeStaging;
                const oldPrefixSumStaging = this.prefixSumStaging;
                const oldSpawnCounts = this.spawnCountsPerEvent;
                this.maxEventsPerFrame *= 2;
                this.initSourceAttributes();
                this.sourceAttributeStaging.set(oldSourceStaging);
                this.prefixSumStaging.set(oldPrefixSumStaging);
                this.spawnCountsPerEvent.set(oldSpawnCounts);
            }
            this.spawnCountsPerEvent[this.eventCount] = spawnCount;
            const desc = attr.desc;
            const dstByteOffset = desc.eventDataOffset + this.eventCount * desc.eventDataStride;
            const src = new Uint8Array(attr.buffer, attr.view.byteOffset + desc.eventDataOffset, desc.eventDataStride);
            new Uint8Array(this.sourceAttributeStaging.buffer).set(src, dstByteOffset);
            this.spawnedCount += spawnCount;
            this.eventCount++;
        }
        updatePhase(state, cmd) {
            if (state.deltaTime <= 0)
                return;
            if (!this.deadListBuffer || !this.aliveListBufferRead)
                return;
            const shaderData = this.updateDatas[0];
            shaderData.setDeviceBuffer(ID.DeadListBuffer, this.deadListBuffer.deviceBuffer);
            shaderData.setDeviceBuffer(ID.AliveListReadBuffer, this.aliveListBufferRead.deviceBuffer);
            shaderData.setDeviceBuffer(ID.AliveListWriteBuffer, this.aliveListBufferWrite.deviceBuffer);
            shaderData.setDeviceBuffer(ID.AttributeBuffer, this.attributeBuffer.deviceBuffer);
            shaderData.setDeviceBuffer(ID.SourceAttributeBuffer, this.sourceAttributeBuffer.deviceBuffer);
            shaderData.setDeviceBuffer(ID.PrefixSumBuffer, this.prefixSumBuffer.deviceBuffer);
            if (this.useStripRingBuffer && this.stripDataBuffer) {
                shaderData.setDeviceBuffer(ID.StripDataBuffer, this.stripDataBuffer.deviceBuffer);
            }
            if (this.eventIndexBuffers) {
                for (let i = 0; i < this.eventIndexBuffers.length; i++) {
                    const eib = this.eventIndexBuffers[i];
                    if (eib)
                        shaderData.setDeviceBuffer(this.eventIndexBufferIDs[i], eib.deviceBuffer);
                }
                if (this.eventIndexBuffers.length > 0 && this.eventIndexBuffers[0]) {
                    shaderData.setDeviceBuffer(ID.EventIndexBuffer, this.eventIndexBuffers[0].deviceBuffer);
                }
            }
            if (this.gpuEventAccumulatorBuffer) {
                shaderData.setDeviceBuffer(ID.AccumulatorBuffer, this.gpuEventAccumulatorBuffer.deviceBuffer);
            }
            for (let i = 0; i < this.outputEventBuffers.length; i++) {
                const buf = this.outputEventBuffers[i];
                if (buf)
                    shaderData.setDeviceBuffer(this.outputEventBufferIDs[i], buf.deviceBuffer);
            }
            if (this.outputEventAccumulatorBuffer) {
                shaderData.setDeviceBuffer(this.outputEventAccumulatorBufferID, this.outputEventAccumulatorBuffer.deviceBuffer);
            }
            cmd.addClearBufferCommand(this.aliveListBufferWrite.deviceBuffer, 0, 4);
            this.dispatch.x = Math.ceil(this.capacity / 64);
            DispatchCommand(cmd, this.updateShader, this.updateDatas, this.dispatch);
            this.swapAliveListBuffers();
        }
        initializePhase(state, cmd) {
            if (!this.deadListBuffer || !this.aliveListBufferRead)
                return;
            if (this.receiveGPUEvent) {
                this.initializeFromGPUEvent(cmd);
            }
            else {
                this.initializeFromCPUEvent(cmd);
            }
            this.spawnedCount = 0;
            this.eventCount = 0;
        }
        outputPhase(state, cmd) {
            if (this.outputType === "none" || !this.outputShader)
                return;
            if (!this.aliveListBufferRead || !this.renderBuffer || !this.indirectBuffer)
                return;
            const shaderData = this.outputDatas[0];
            shaderData.setDeviceBuffer(ID.AliveListReadBuffer, this.aliveListBufferRead.deviceBuffer);
            shaderData.setDeviceBuffer(ID.AttributeBuffer, this.attributeBuffer.deviceBuffer);
            shaderData.setDeviceBuffer(ID.RenderBuffer, this.renderBuffer.deviceBuffer);
            shaderData.setDeviceBuffer(ID.IndirectBuffer, this.indirectBuffer.deviceBuffer);
            shaderData.setDeviceBuffer(ID.DeadListBuffer, this.deadListBuffer.deviceBuffer);
            shaderData.setDeviceBuffer(ID.AliveListWriteBuffer, this.aliveListBufferWrite.deviceBuffer);
            shaderData.setDeviceBuffer(ID.SourceAttributeBuffer, this.sourceAttributeBuffer.deviceBuffer);
            shaderData.setDeviceBuffer(ID.PrefixSumBuffer, this.prefixSumBuffer.deviceBuffer);
            if (this.boundsBuffer) {
                shaderData.setDeviceBuffer(ID.BoundsBuffer, this.boundsBuffer.deviceBuffer);
            }
            if (this.isStripOutput && this.stripDataBuffer) {
                shaderData.setDeviceBuffer(ID.StripDataBuffer, this.stripDataBuffer.deviceBuffer);
            }
            if (this.isStripOutput) {
                cmd.addClearBufferCommand(this.indirectBuffer.deviceBuffer, 0, 4);
            }
            else {
                cmd.addClearBufferCommand(this.indirectBuffer.deviceBuffer, 4, 4);
            }
            if (this.isStripOutput && this.useStripRingBuffer) {
                this.dispatch.x = this.stripCapacity;
            }
            else if (this.isStripOutput) {
                this.dispatch.x = 1;
            }
            else {
                this.dispatch.x = Math.ceil(this.capacity / 64);
            }
            DispatchCommand(cmd, this.outputShader, this.outputDatas, this.dispatch);
            for (const extra of this.extraOutputs) {
                if (!extra.outputShader || !extra.outputDatas)
                    continue;
                const extraIsStrip = extra.outputType === "outputTrail" || extra.outputType === "outputParticleStripSGQuad";
                cmd.addClearBufferCommand(extra.indirectBuffer.deviceBuffer, 4, 4);
                const esd = extra.outputDatas[0];
                esd.setDeviceBuffer(ID.AliveListReadBuffer, this.aliveListBufferRead.deviceBuffer);
                esd.setDeviceBuffer(ID.AttributeBuffer, this.attributeBuffer.deviceBuffer);
                esd.setDeviceBuffer(ID.RenderBuffer, extra.renderBuffer.deviceBuffer);
                esd.setDeviceBuffer(ID.IndirectBuffer, extra.indirectBuffer.deviceBuffer);
                if (this.boundsBuffer) {
                    esd.setDeviceBuffer(ID.BoundsBuffer, this.boundsBuffer.deviceBuffer);
                }
                esd.setDeviceBuffer(ID.DeadListBuffer, this.deadListBuffer.deviceBuffer);
                esd.setDeviceBuffer(ID.AliveListWriteBuffer, this.aliveListBufferWrite.deviceBuffer);
                esd.setDeviceBuffer(ID.SourceAttributeBuffer, this.sourceAttributeBuffer.deviceBuffer);
                esd.setDeviceBuffer(ID.PrefixSumBuffer, this.prefixSumBuffer.deviceBuffer);
                if (extraIsStrip && this.stripDataBuffer) {
                    esd.setDeviceBuffer(ID.StripDataBuffer, this.stripDataBuffer.deviceBuffer);
                }
                this.dispatch.x = extraIsStrip ? this.stripCapacity : Math.ceil(this.capacity / 64);
                DispatchCommand(cmd, extra.outputShader, extra.outputDatas, this.dispatch);
            }
        }
        updateStripsPhase(cmd) {
            if (!this.updateStripsShader || !this.stripDataBuffer || !this.updateStripsDatas)
                return;
            const shaderData = this.updateStripsDatas[0];
            shaderData.setDeviceBuffer(ID.StripDataBuffer, this.stripDataBuffer.deviceBuffer);
            shaderData.setInt(ID.u_StripCapacity, this.stripCapacity);
            shaderData.setInt(ID.u_ParticlePerStrip, this.particlePerStripCount);
            this.dispatch.x = Math.ceil(this.stripCapacity / 64);
            DispatchCommand(cmd, this.updateStripsShader, this.updateStripsDatas, this.dispatch);
        }
        initializeFromCPUEvent(cmd) {
            for (let index of this.spawnerSystems) {
                let spawner = this.effect.systems[index];
                this.receiveInitializeEvent(spawner.spawnerState.eventAttribute);
            }
            if (this.spawnedCount <= 0) {
                return;
            }
            this.prefixSumStaging[0] = 0;
            for (let i = 0; i < this.eventCount; i++) {
                this.prefixSumStaging[i + 1] = this.prefixSumStaging[i] + this.spawnCountsPerEvent[i];
            }
            const desc = this.effect.asset.eventAttributeDesc;
            const uploadSize = desc.eventDataOffset + this.eventCount * desc.eventDataStride;
            this.sourceAttributeBuffer.deviceBuffer.setData(this.sourceAttributeStaging.buffer, 0, 0, uploadSize);
            this.prefixSumBuffer.deviceBuffer.setData(this.prefixSumStaging.buffer, 0, 0, (this.eventCount + 1) * 4);
            const shaderData = this.initializeDatas[0];
            shaderData.setDeviceBuffer(ID.DeadListBuffer, this.deadListBuffer.deviceBuffer);
            shaderData.setDeviceBuffer(ID.AliveListWriteBuffer, this.aliveListBufferRead.deviceBuffer);
            shaderData.setDeviceBuffer(ID.AttributeBuffer, this.attributeBuffer.deviceBuffer);
            shaderData.setDeviceBuffer(ID.SourceAttributeBuffer, this.sourceAttributeBuffer.deviceBuffer);
            shaderData.setDeviceBuffer(ID.PrefixSumBuffer, this.prefixSumBuffer.deviceBuffer);
            const sc = Math.floor(this.spawnedCount);
            shaderData.setInt(ID.u_TotalSpawnedCount, this._cumulativeSpawnTotal);
            shaderData.setInt(ID.u_SpawnedCount, sc);
            shaderData.setInt(ID.u_EventCount, this.eventCount);
            if (this.spawnerSystems.length > 0) {
                const spawner = this.effect.systems[this.spawnerSystems[0]];
                if (spawner) {
                    const ss = spawner.spawnerState;
                    shaderData.setInt(ID.u_LoopIndex, ss.loopIndex);
                    shaderData.setInt(ID.u_NewLoop, ss.newLoop ? 1 : 0);
                    shaderData.setInt(ID.u_LoopState, ss.loopState);
                    shaderData.setNumber(ID.u_SpawnCount, ss.spawnCount);
                    shaderData.setNumber(ID.u_SpawnDeltaTime, ss.deltaTime);
                    shaderData.setNumber(ID.u_SpawnTotalTime, ss.totalTime);
                    shaderData.setNumber(ID.u_LoopDuration, ss.settings.loopDuration);
                    shaderData.setInt(ID.u_LoopCount, ss.settings.loopCount);
                    shaderData.setNumber(ID.u_DelayBeforeLoop, ss.settings.delayBeforeLoop);
                    shaderData.setNumber(ID.u_DelayAfterLoop, ss.settings.delayAfterLoop);
                }
            }
            if (this.useStripRingBuffer && this.stripDataBuffer) {
                shaderData.setDeviceBuffer(ID.StripDataBuffer, this.stripDataBuffer.deviceBuffer);
            }
            if (this.gpuEventAccumulatorBuffer) {
                shaderData.setDeviceBuffer(ID.AccumulatorBuffer, this.gpuEventAccumulatorBuffer.deviceBuffer);
            }
            this.dispatch.x = Math.ceil(this.spawnedCount / 64);
            DispatchCommand(cmd, this.initializeShader, this.initializeDatas, this.dispatch);
            this._cumulativeSpawnTotal += sc;
        }
        initializeFromGPUEvent(cmd) {
            if (!this.gpuEventSourceSystem) {
                return;
            }
            const source = this.gpuEventSourceSystem;
            if (this.capacity <= 0)
                return;
            {
                const sd = this.prepareDispatchDatas[0];
                sd.setDeviceBuffer(ID.EventIndexBuffer, source.eventIndexBuffers[this.gpuEventBufferIndex].deviceBuffer);
                sd.setDeviceBuffer(ID.GPUEventDispatchBuffer, this.gpuEventDispatchBuffer.deviceBuffer);
                this.dispatch.x = 1;
                DispatchCommand(cmd, this.prepareDispatchShader, this.prepareDispatchDatas, this.dispatch);
            }
            cmd.executeCMDs();
            cmd.clearCMDs();
            {
                const shaderData = this.initializeDatas[0];
                shaderData.setDeviceBuffer(ID.DeadListBuffer, this.deadListBuffer.deviceBuffer);
                shaderData.setDeviceBuffer(ID.AliveListWriteBuffer, this.aliveListBufferRead.deviceBuffer);
                shaderData.setDeviceBuffer(ID.AttributeBuffer, this.attributeBuffer.deviceBuffer);
                shaderData.setDeviceBuffer(ID.EventIndexBuffer, source.eventIndexBuffers[this.gpuEventBufferIndex].deviceBuffer);
                shaderData.setDeviceBuffer(ID.SourceParticleBuffer, source.attributeBuffer.deviceBuffer);
                shaderData.setInt(ID.u_SourceSimulateSpace, source.simulateSpace);
                if (this.useStripRingBuffer && this.stripDataBuffer) {
                    shaderData.setDeviceBuffer(ID.StripDataBuffer, this.stripDataBuffer.deviceBuffer);
                }
                if (this.gpuEventAccumulatorBuffer) {
                    shaderData.setDeviceBuffer(ID.AccumulatorBuffer, this.gpuEventAccumulatorBuffer.deviceBuffer);
                }
                cmd.addDispatchIndirectCommand(this.initializeShader, shaderData.getDefineData(), this.initializeDatas, this.gpuEventDispatchBuffer.deviceBuffer, 0);
            }
        }
        update(state, cmd) {
        }
        swapAliveListBuffers() {
            [this.aliveListBufferRead, this.aliveListBufferWrite] =
                [this.aliveListBufferWrite, this.aliveListBufferRead];
        }
        resetBoundsBuffer() {
            if (this.boundsMode === exports.VFXBoundsMode.Manual)
                return;
            if (!this.boundsBuffer)
                return;
            this.boundsBuffer.deviceBuffer.setData(this.boundsResetData.buffer, 0, 0, 24);
        }
        copyBoundsToStaging(cmd) {
            if (this.boundsMode === exports.VFXBoundsMode.Manual)
                return;
            if (!this.boundsBuffer || !this.boundsStagingBuffer)
                return;
            if (this.boundsReadbackPending)
                return;
            cmd.addBufferToBufferCommand(this.boundsBuffer.deviceBuffer, this.boundsStagingBuffer.deviceBuffer, 0, 0, 24);
        }
        requestBoundsReadback() {
            if (this.boundsMode === exports.VFXBoundsMode.Manual)
                return;
            if (!this.boundsStagingBuffer)
                return;
            if (this.boundsReadbackPending || this._released)
                return;
            this.boundsReadbackPending = true;
            this.boundsStagingBuffer.deviceBuffer.readData(this.boundsReadbackDest, 0, 0, 24).then(() => {
                this.boundsReadbackPending = false;
                if (this._released)
                    return;
                this.updateBoundsFromReadback();
            });
        }
        updateBoundsFromReadback() {
            if (!this.geometry)
                return;
            const data = new Int32Array(this.boundsReadbackDest);
            if (data[0] === 0x7FFFFFFF)
                return;
            const minX = this.sortableIntToFloat(data[0]);
            const minY = this.sortableIntToFloat(data[1]);
            const minZ = this.sortableIntToFloat(data[2]);
            const maxX = this.sortableIntToFloat(data[3]);
            const maxY = this.sortableIntToFloat(data[4]);
            const maxZ = this.sortableIntToFloat(data[5]);
            const bounds = this.geometry.bounds;
            bounds.setMin(new Laya.Vector3(minX, minY, minZ));
            bounds.setMax(new Laya.Vector3(maxX, maxY, maxZ));
        }
        sortableIntToFloat(si) {
            const i = (si >= 0) ? si : (si ^ 0x7FFFFFFF);
            this.boundsDataView.setInt32(0, i, true);
            return this.boundsDataView.getFloat32(0, true);
        }
        release() {
            var _a;
            this._released = true;
            if (this.geometry) {
                (_a = this.effect.renderer) === null || _a === void 0 ? void 0 : _a.removeGeometry(this.geometry);
                this.geometry.destroy();
                this.geometry = null;
            }
            this.deadListBuffer.destroy();
            this.aliveListBufferRead.destroy();
            this.aliveListBufferWrite.destroy();
            this.attributeBuffer.destroy();
            if (this.renderBuffer)
                this.renderBuffer.destroy();
            if (this.indirectBuffer)
                this.indirectBuffer.destroy();
            if (this.boundsBuffer) {
                this.boundsBuffer.destroy();
            }
            if (this.boundsStagingBuffer) {
                this.boundsStagingBuffer.destroy();
            }
            this.boundsReadbackDest = null;
            this.boundsDataView = null;
            this.boundsResetData = null;
            this.releaseSourceAttributes();
            this.sourceAttributeStaging = null;
            this.prefixSumStaging = null;
            this.spawnCountsPerEvent = null;
            this.initializeDatas.forEach(sd => sd.destroy());
            this.initializeDatas = null;
            this.updateDatas.forEach(sd => sd.destroy());
            this.updateDatas = null;
            this.outputDatas.forEach(sd => sd.destroy());
            this.outputDatas = null;
            this.prepareDispatchDatas.forEach(sd => sd.destroy());
            this.prepareDispatchDatas = null;
            for (const buffer of this.eventIndexBuffers) {
                buffer.destroy();
            }
            this.eventIndexBuffers = [];
            if (this.gpuEventAccumulatorBuffer) {
                this.gpuEventAccumulatorBuffer.destroy();
                this.gpuEventAccumulatorBuffer = null;
            }
            if (this.gpuEventDispatchBuffer) {
                this.gpuEventDispatchBuffer.destroy();
                this.gpuEventDispatchBuffer = null;
            }
            this.gpuEventSourceSystem = null;
            for (const b of this.outputEventBuffers)
                b.destroy();
            for (const b of this.outputEventStagingBuffers)
                b.destroy();
            this.outputEventBuffers = [];
            this.outputEventStagingBuffers = [];
            this.outputEventReadbackDest = [];
            this.outputEventReadbackPending = [];
            if (this.outputEventAccumulatorBuffer) {
                this.outputEventAccumulatorBuffer.destroy();
                this.outputEventAccumulatorBuffer = null;
            }
        }
    }
    VFXParticleSystem._matUidCounter = 0;
    function DispatchCommand(cmd, shader, shaderDatas, dispatch) {
        cmd.addDispatchCommand(shader, shaderDatas[0].getDefineData(), shaderDatas, dispatch);
    }

    function sampleRange(range, rand) {
        return range.x === range.y ? range.x : Laya.MathUtil.lerp(range.x, range.y, rand.getFloat());
    }

    exports.VFXSpawnerLoopState = void 0;
    (function (VFXSpawnerLoopState) {
        VFXSpawnerLoopState[VFXSpawnerLoopState["Finished"] = 0] = "Finished";
        VFXSpawnerLoopState[VFXSpawnerLoopState["DelayBeforeLoop"] = 1] = "DelayBeforeLoop";
        VFXSpawnerLoopState[VFXSpawnerLoopState["Looping"] = 2] = "Looping";
        VFXSpawnerLoopState[VFXSpawnerLoopState["DelayAfterLoop"] = 3] = "DelayAfterLoop";
    })(exports.VFXSpawnerLoopState || (exports.VFXSpawnerLoopState = {}));
    class VFXSpawnerSettings {
        constructor() {
            this.loopCount = -1;
            this.loopDuration = -1.0;
            this.delayBeforeLoop = 0.0;
            this.delayAfterLoop = 0.0;
        }
    }
    class VFXSpawnerState {
        get eventAttribute() {
            return this._eventAttribute;
        }
        setEventAttribute(attr) {
            this._eventAttribute = attr;
        }
        get spawnCount() {
            return this._eventAttribute.getFloat("spawnCount");
        }
        set spawnCount(value) {
            this._eventAttribute.setFloat("spawnCount", value);
        }
        isPlaying() {
            return this.loopState == exports.VFXSpawnerLoopState.Looping;
        }
        getCurrentMaximumDuration() {
            switch (this.loopState) {
                case exports.VFXSpawnerLoopState.Finished:
                    break;
                case exports.VFXSpawnerLoopState.DelayBeforeLoop:
                    return this.settings.delayBeforeLoop;
                case exports.VFXSpawnerLoopState.Looping:
                    return this.settings.loopDuration;
                case exports.VFXSpawnerLoopState.DelayAfterLoop:
                    return this.settings.delayAfterLoop;
            }
            return -1;
        }
        gotoNextLoopState() {
            if (this.loopState == exports.VFXSpawnerLoopState.Finished) {
                return;
            }
            switch (this.loopState) {
                case exports.VFXSpawnerLoopState.DelayBeforeLoop:
                    this.loopState = exports.VFXSpawnerLoopState.Looping;
                    break;
                case exports.VFXSpawnerLoopState.Looping:
                    this.loopState = exports.VFXSpawnerLoopState.DelayAfterLoop;
                    break;
                case exports.VFXSpawnerLoopState.DelayAfterLoop: {
                    this.loopIndex++;
                    if (this.settings.loopCount < 0 || this.loopIndex < this.settings.loopCount) {
                        this.loopState = exports.VFXSpawnerLoopState.DelayBeforeLoop;
                        this.delayDirty = true;
                        this.newLoop = true;
                    }
                    else {
                        this.loopState = exports.VFXSpawnerLoopState.Finished;
                    }
                    break;
                }
            }
        }
        fastFowarduntilValidLoopState() {
            while (this.getCurrentMaximumDuration() == 0
                && (!this.newLoop
                    || this.settings.delayAfterLoop != 0
                    || this.settings.loopDuration != 0
                    || this.settings.delayBeforeLoop != 0)) {
                this.gotoNextLoopState();
            }
        }
        updateLoopCount(currentSettings) {
            this.settings.loopCount = currentSettings.loopCount;
        }
        updateDelay(currentSettings) {
            this.delayDirty = false;
            this.settings.delayBeforeLoop = currentSettings.delayBeforeLoop;
            this.settings.delayAfterLoop = currentSettings.delayAfterLoop;
            this.settings.loopDuration = currentSettings.loopDuration;
        }
        setLoopState(state) {
            if (this.loopState != state) {
                this.loopState = state;
                this.totalTime = 0.0;
                this.fastFowarduntilValidLoopState();
            }
        }
        constructor() {
            this.settings = new VFXSpawnerSettings();
            this.delayDirty = false;
            this.loopState = exports.VFXSpawnerLoopState.Finished;
            this.newLoop = false;
            this.loopIndex = 0;
            this.totalTime = 0.0;
            this.deltaTime = 0.0;
        }
        prepareOnPlay(sourceEvtAttr) {
            this.eventAttribute.copyFrom(sourceEvtAttr);
        }
        onPlay(currentSettings) {
            this.loopIndex = 0;
            this.newLoop = true;
            this.updateDelay(currentSettings);
            this.updateLoopCount(currentSettings);
            let state = exports.VFXSpawnerLoopState.DelayBeforeLoop;
            if (this.settings.loopCount == 0) {
                state = exports.VFXSpawnerLoopState.Finished;
            }
            this.setLoopState(state);
        }
        beginUpdate(deltaTime, currentSettings) {
            if (this.delayDirty) {
                this.updateDelay(currentSettings);
            }
            this.deltaTime = deltaTime;
        }
        endUpdate() {
            this.newLoop = false;
            this.totalTime += this.deltaTime;
            let currentMaximumDuration = this.getCurrentMaximumDuration();
            if (currentMaximumDuration >= 0 && this.totalTime >= currentMaximumDuration) {
                this.totalTime = 0.0;
                this.gotoNextLoopState();
                this.fastFowarduntilValidLoopState();
            }
        }
        onStop() {
            this.setLoopState(exports.VFXSpawnerLoopState.Finished);
        }
        release() {
            this._eventAttribute = null;
        }
    }

    class VFXSpawnerSystem extends VFXSystem {
        constructor() {
            super(...arguments);
            this.spawnerState = new VFXSpawnerState();
            this.settings = new VFXSpawnerSettings();
            this.tasks = [];
            this.onPlayInputs = [];
            this.onStopInputs = [];
        }
        onPlay(sourceEvtAttr) {
            this.spawnerState.prepareOnPlay(sourceEvtAttr);
            const rand = this.effect.state.rand;
            this.settings.loopCount = Math.round(sampleRange(this.desc.loopCount, rand));
            this.settings.loopDuration = sampleRange(this.desc.loopDuration, rand);
            this.spawnerState.onPlay(this.settings);
            for (let task of this.tasks) {
                task.play();
            }
        }
        onStop() {
            this.spawnerState.onStop();
            for (let task of this.tasks) {
                task.stop();
            }
        }
        init() {
            this.release();
            const attrDesc = this.effect.asset.eventAttributeDesc;
            this.eventAttribute = new VFXEventAttribute(attrDesc);
            {
                const buffer = attrDesc.createBuffer();
                this.eventAttribute.initBuffer(buffer);
                if (attrDesc.hasAttribute("lifetime")) {
                    this.eventAttribute.setFloat("lifetime", 1);
                }
            }
            this.spawnerState.setEventAttribute(this.eventAttribute);
            for (let task of this.tasks) {
                task.init();
            }
        }
        inputSpawner(onPlay, state) {
            const inputs = onPlay ? this.onPlayInputs : this.onStopInputs;
            inputs.forEach(index => {
                const system = this.effect.systems[index];
                const inputSpawnCount = system.spawnerState.spawnCount;
                if (inputSpawnCount >= 1) {
                    let currentSpawnCount = this.spawnerState.spawnCount;
                    if (onPlay) {
                        this.onPlay(system.spawnerState.eventAttribute);
                    }
                    else {
                        this.onStop();
                    }
                    this.spawnerState.spawnCount = currentSpawnCount;
                }
            });
        }
        update(state) {
            const spawnerState = this.spawnerState;
            this.inputSpawner(true, state);
            let accumulatedSpawn = 0;
            spawnerState.spawnCount -= Math.floor(spawnerState.spawnCount);
            if (!spawnerState.newLoop) {
                accumulatedSpawn = spawnerState.spawnCount;
            }
            spawnerState.spawnCount = 0;
            if (spawnerState.delayDirty) {
                const rand = this.effect.state.rand;
                this.settings.loopDuration = sampleRange(this.desc.loopDuration, rand);
            }
            spawnerState.beginUpdate(state.deltaTime, this.settings);
            const rand = this.effect.state.rand;
            for (let task of this.tasks) {
                task.update(spawnerState, rand);
            }
            spawnerState.endUpdate();
            spawnerState.spawnCount += accumulatedSpawn;
            this.inputSpawner(false, state);
        }
        release() {
            this.spawnerState.release();
            if (this.eventAttribute) {
                this.eventAttribute.destroy();
                this.eventAttribute = null;
            }
            this.tasks.forEach(task => {
                task.release();
            });
        }
    }

    class VFXStaticMeshSystem extends VFXSystem {
        constructor() {
            super(...arguments);
            this._child = null;
            this._meshFilter = null;
            this._meshRenderer = null;
            this._tmpVec3 = new Laya.Vector3();
            this._tmpColor = new Laya.Color();
        }
        setMesh(mesh) {
            if (!mesh)
                return;
            this.desc.mesh = mesh;
            if (this._meshFilter)
                this._meshFilter.sharedMesh = mesh;
        }
        init() {
            var _a;
            if (this._child)
                this.release();
            const owner = (_a = this.effect) === null || _a === void 0 ? void 0 : _a.owner;
            if (!owner)
                return;
            this._child = new Laya.Sprite3D("VFXStaticMesh");
            this._meshFilter = this._child.addComponent(Laya.MeshFilter);
            this._meshRenderer = this._child.addComponent(Laya.MeshRenderer);
            if (this.desc.mesh)
                this._meshFilter.sharedMesh = this.desc.mesh;
            if (this.desc.materialUuid) {
                Laya.Laya.loader.load(this.desc.materialUuid).then((mat) => {
                    if (mat && this._meshRenderer) {
                        this._meshRenderer.sharedMaterial = mat;
                        this._applyBindings();
                    }
                    else if (this._meshRenderer) {
                        console.warn(`[VFXStaticMeshSystem] load returned null for ${this.desc.materialUuid}, fallback unlit`);
                        this._applyFallbackMaterial();
                    }
                }).catch((e) => {
                    console.error(`[VFXStaticMeshSystem] load failed for ${this.desc.materialUuid}`, e);
                    this._applyFallbackMaterial();
                });
            }
            else {
                this._applyFallbackMaterial();
            }
            owner.addChild(this._child);
        }
        _applyFallbackMaterial() {
            if (!this._meshRenderer)
                return;
            const mat = new Laya.UnlitMaterial();
            mat.albedoColor = new Laya.Color(1, 1, 1, 1);
            this._meshRenderer.sharedMaterial = mat;
            this._applyBindings();
        }
        update(state, cmd) {
            this._applyBindings();
        }
        _applyBindings() {
            var _a;
            if (!this._child || !this.desc.bindings || this.desc.bindings.length === 0)
                return;
            for (const b of this.desc.bindings) {
                const v = this._evalSource(b);
                if (!v)
                    continue;
                switch (b.target) {
                    case "position":
                        this._tmpVec3.setValue(v.x, v.y, v.z);
                        this._child.transform.localPosition = this._tmpVec3;
                        break;
                    case "rotation":
                        this._tmpVec3.setValue(v.x, v.y, v.z);
                        this._child.transform.localRotationEuler = this._tmpVec3;
                        break;
                    case "scale":
                        this._tmpVec3.setValue(v.x, v.y, v.z);
                        this._child.transform.localScale = this._tmpVec3;
                        break;
                    case "color":
                        if (!((_a = this._meshRenderer) === null || _a === void 0 ? void 0 : _a.sharedMaterial))
                            break;
                        this._tmpColor.setValue(v.r, v.g, v.b, v.a);
                        const mat = this._meshRenderer.sharedMaterial;
                        mat.setColor("u_AlbedoColor", this._tmpColor);
                        mat.setColor("u_DiffuseColor", this._tmpColor);
                        mat.setColor("u_BaseColor", this._tmpColor);
                        break;
                }
            }
        }
        _evalSource(b) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            if (b.source === "inline") {
                return b.target === "color" ? b.value : { x: b.value.x, y: b.value.y, z: b.value.z };
            }
            const entry = (_b = (_a = this.effect) === null || _a === void 0 ? void 0 : _a._propertyValues) === null || _b === void 0 ? void 0 : _b.get(b.name);
            if (!entry)
                return null;
            const arr = entry.value;
            if (b.target === "color") {
                return { r: (_c = arr[0]) !== null && _c !== void 0 ? _c : 0, g: (_d = arr[1]) !== null && _d !== void 0 ? _d : 0, b: (_e = arr[2]) !== null && _e !== void 0 ? _e : 0, a: (_f = arr[3]) !== null && _f !== void 0 ? _f : 1 };
            }
            return { x: (_g = arr[0]) !== null && _g !== void 0 ? _g : 0, y: (_h = arr[1]) !== null && _h !== void 0 ? _h : 0, z: (_j = arr[2]) !== null && _j !== void 0 ? _j : 0 };
        }
        release() {
            if (this._child) {
                if (this._child.parent)
                    this._child.parent.removeChild(this._child);
                this._child.destroy();
                this._child = null;
            }
            this._meshFilter = null;
            this._meshRenderer = null;
        }
    }

    class VFXSpawnerTask {
        play() { }
        ;
        stop() { }
        ;
        update(spawnerState, rand) {
            if (spawnerState.newLoop) {
                this.internalInit(rand);
            }
            if (spawnerState.isPlaying()) {
                this.internalUpdate(spawnerState);
            }
        }
    }
    class VFXSpawnerConstantRate extends VFXSpawnerTask {
        constructor() {
            super(...arguments);
            this.rate = 1;
        }
        init() {
        }
        internalInit(rand) {
        }
        internalUpdate(spawnerState) {
            spawnerState.spawnCount += this.rate * spawnerState.deltaTime;
        }
        release() {
        }
    }
    class VFXSpawnerSingleBurst extends VFXSpawnerTask {
        constructor() {
            super(...arguments);
            this.count = new Laya.Vector2(1, 1);
            this.delay = new Laya.Vector2();
            this.countFromLoopIndex = false;
            this.countModulo = 0;
            this.sleeping = false;
            this.nextTriggerTime = 0;
            this.sampledCount = 0;
        }
        init() {
            this.sleeping = false;
            this.nextTriggerTime = 0;
            this.sampledCount = 0;
        }
        play() {
            this.sleeping = false;
        }
        internalInit(rand) {
            this.sleeping = false;
            this.nextTriggerTime = sampleRange(this.delay, rand);
            this.sampledCount = Math.round(sampleRange(this.count, rand));
        }
        internalUpdate(spawnerState) {
            if (this.sleeping) {
                return;
            }
            if (spawnerState.totalTime < this.nextTriggerTime) {
                return;
            }
            this.sleeping = true;
            if (this.countFromLoopIndex) {
                const idx = this.countModulo > 0 ? (spawnerState.loopIndex % this.countModulo) : spawnerState.loopIndex;
                spawnerState.spawnCount += idx;
            }
            else {
                spawnerState.spawnCount += this.sampledCount;
            }
        }
        release() {
        }
    }
    class VFXSpawnerOverDistance extends VFXSpawnerTask {
        constructor() {
            super(...arguments);
            this.distance = 1;
            this.owner = null;
            this._lastPos = new Laya.Vector3();
            this._hasLast = false;
            this._accum = 0;
        }
        init() {
            this._hasLast = false;
            this._accum = 0;
        }
        internalInit(rand) {
            this._accum = 0;
        }
        internalUpdate(spawnerState) {
            if (!this.owner)
                return;
            const p = this.owner.transform.position;
            if (!this._hasLast) {
                this._lastPos.setValue(p.x, p.y, p.z);
                this._hasLast = true;
                return;
            }
            const dx = p.x - this._lastPos.x;
            const dy = p.y - this._lastPos.y;
            const dz = p.z - this._lastPos.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            this._accum += d;
            this._lastPos.setValue(p.x, p.y, p.z);
            const step = Math.max(this.distance, 1e-4);
            while (this._accum >= step) {
                spawnerState.spawnCount += 1;
                this._accum -= step;
            }
        }
        release() {
            this.owner = null;
        }
    }
    class VFXSpawnerCustomWrapper extends VFXSpawnerTask {
        constructor() {
            super(...arguments);
            this.callbackName = "default";
            this.effect = null;
        }
        init() { }
        internalInit(rand) { }
        internalUpdate(spawnerState) {
            if (!this.effect)
                return;
            const cb = this.effect.getCustomSpawnCallback(this.callbackName);
            if (!cb)
                return;
            const n = cb(spawnerState, spawnerState.deltaTime);
            if (n > 0)
                spawnerState.spawnCount += n;
        }
        release() { }
    }
    class VFXSpawnerSetEventAttribute extends VFXSpawnerTask {
        constructor() {
            super(...arguments);
            this.attribute = "lifetime";
            this.value = [0, 0, 0, 0];
            this.fromLoopIndex = false;
            this.loopIndexModulo = 0;
            this.fromSpawnStateLoop = false;
        }
        init() { }
        internalInit(rand) { }
        internalUpdate(spawnerState) {
            var _a, _b, _c, _d;
            const attr = spawnerState.eventAttribute;
            if (!attr || !attr.desc.hasAttribute(this.attribute))
                return;
            let v = this.value;
            if (this.fromLoopIndex) {
                const idx = this.loopIndexModulo > 0
                    ? (spawnerState.loopIndex % this.loopIndexModulo)
                    : spawnerState.loopIndex;
                v = [idx, 0, 0, 0];
            }
            else if (this.fromSpawnStateLoop) {
                const dur = (_b = (_a = spawnerState.settings) === null || _a === void 0 ? void 0 : _a.loopDuration) !== null && _b !== void 0 ? _b : 1;
                const delay = (_d = (_c = spawnerState.settings) === null || _c === void 0 ? void 0 : _c.delayAfterLoop) !== null && _d !== void 0 ? _d : 0;
                v = [dur + delay, 0, 0, 0];
            }
            const t = attr.desc.getAttributeType(this.attribute);
            switch (t) {
                case exports.VFXEventAttributeType.Bool:
                    attr.setBool(this.attribute, v[0] !== 0);
                    break;
                case exports.VFXEventAttributeType.Int:
                    attr.setInt(this.attribute, v[0]);
                    break;
                case exports.VFXEventAttributeType.Uint:
                    attr.setUint(this.attribute, v[0] >>> 0);
                    break;
                case exports.VFXEventAttributeType.Float:
                    attr.setFloat(this.attribute, v[0]);
                    break;
                case exports.VFXEventAttributeType.Vector2:
                    attr.setVector2(this.attribute, v[0], v[1]);
                    break;
                case exports.VFXEventAttributeType.Vector3:
                    attr.setVector3(this.attribute, v[0], v[1], v[2]);
                    break;
                case exports.VFXEventAttributeType.Vector4:
                    attr.setVector4(this.attribute, v[0], v[1], v[2], v[3]);
                    break;
            }
        }
        release() { }
    }
    class VFXSpawnerPeriodicBurst extends VFXSpawnerTask {
        constructor() {
            super(...arguments);
            this.count = new Laya.Vector2(1, 1);
            this.delay = new Laya.Vector2(1, 1);
            this.nextTriggerTime = 0;
        }
        init() {
            this.nextTriggerTime = 0;
        }
        internalInit(rand) {
            this.rand = rand;
            this.nextTriggerTime = sampleRange(this.delay, rand);
        }
        internalUpdate(spawnerState) {
            while (spawnerState.totalTime >= this.nextTriggerTime) {
                spawnerState.spawnCount += Math.round(sampleRange(this.count, this.rand));
                this.nextTriggerTime += sampleRange(this.delay, this.rand);
            }
        }
        release() {
        }
    }

    class VFXAssetParser {
        async parse(data, baseUrl) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const vfxAsset = new VFXAsset();
            let updateMode = exports.VFXUpdateMode.FixedDeltaTime;
            if (data.fixedDeltaTime === false) {
                updateMode |= exports.VFXUpdateMode.DeltaTime;
            }
            if (data.exactFixedTime) {
                updateMode |= exports.VFXUpdateMode.ExactFixedTimeStep;
            }
            if (data.ignoreTimeScale) {
                updateMode |= exports.VFXUpdateMode.IgnoreTimeScale;
            }
            vfxAsset.updateMode = updateMode;
            if (data.initialEventName) {
                vfxAsset.initialEventName = data.initialEventName;
            }
            if (typeof data.preWarmTotalTime === "number")
                vfxAsset.preWarmTotalTime = data.preWarmTotalTime;
            if (typeof data.preWarmStepCount === "number")
                vfxAsset.prewarmStepCount = data.preWarmStepCount;
            if (typeof data.preWarmDeltaTime === "number")
                vfxAsset.prewarmDeltaTime = data.preWarmDeltaTime;
            const loadPromises = [];
            data.systems.forEach((sys, index) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                const type = sys.type;
                switch (type) {
                    case exports.VFXSystemType.Spawner: {
                        const desc = new VFXSpawnerSystemDesc();
                        desc.loopCount = new Laya.Vector2(sys.loopCount[0], sys.loopCount[1]);
                        desc.loopDuration = new Laya.Vector2(sys.loopDuration[0], sys.loopDuration[1]);
                        desc.delayBeforeLoop = sys.delayBeforeLoop;
                        desc.delayAfterLoop = sys.delayAfterLoop;
                        sys.onPlayInputs && desc.onPlayInputs.push(...sys.onPlayInputs);
                        sys.onStopInputs && desc.onStopInputs.push(...sys.onStopInputs);
                        sys.tasks.forEach(task => {
                            var _a, _b;
                            switch (task.type) {
                                case exports.VFXSpawnerTaskType.ConstantRate: {
                                    const taskDesc = new VFXSpawnerConstantRateTaskDesc();
                                    taskDesc.rate = task.rate;
                                    desc.tasks.push(taskDesc);
                                    break;
                                }
                                case exports.VFXSpawnerTaskType.SingleBurst: {
                                    const taskDesc = new VFXSpawnerSingleBurstTaskDesc();
                                    taskDesc.delay = new Laya.Vector2(task.delay[0], task.delay[1]);
                                    taskDesc.count = new Laya.Vector2(task.count[0], task.count[1]);
                                    if (task.countFromLoopIndex) {
                                        taskDesc.countFromLoopIndex = true;
                                        if (task.countModulo > 0)
                                            taskDesc.countModulo = task.countModulo;
                                    }
                                    desc.tasks.push(taskDesc);
                                    break;
                                }
                                case exports.VFXSpawnerTaskType.PeriodicBurst: {
                                    const taskDesc = new VFXSpawnerPeriodicBurstTaskDesc();
                                    taskDesc.delay = new Laya.Vector2(task.delay[0], task.delay[1]);
                                    taskDesc.count = new Laya.Vector2(task.count[0], task.count[1]);
                                    desc.tasks.push(taskDesc);
                                    break;
                                }
                                case exports.VFXSpawnerTaskType.SpawnOverDistance: {
                                    const taskDesc = new VFXSpawnerOverDistanceTaskDesc();
                                    taskDesc.distance = typeof task.distance === "number" ? task.distance : 1;
                                    desc.tasks.push(taskDesc);
                                    break;
                                }
                                case exports.VFXSpawnerTaskType.CustomWrapper: {
                                    const taskDesc = new VFXSpawnerCustomWrapperTaskDesc();
                                    taskDesc.callbackName = String((_a = task.callbackName) !== null && _a !== void 0 ? _a : "default");
                                    desc.tasks.push(taskDesc);
                                    break;
                                }
                                case exports.VFXSpawnerTaskType.SetEventAttribute: {
                                    const taskDesc = new VFXSpawnerSetEventAttributeTaskDesc();
                                    taskDesc.attribute = String((_b = task.attribute) !== null && _b !== void 0 ? _b : "lifetime");
                                    if (Array.isArray(task.value) && task.value.length === 4) {
                                        taskDesc.value = [Number(task.value[0]) || 0, Number(task.value[1]) || 0, Number(task.value[2]) || 0, Number(task.value[3]) || 0];
                                    }
                                    taskDesc.fromLoopIndex = !!task.fromLoopIndex;
                                    taskDesc.loopIndexModulo = Number(task.loopIndexModulo) || 0;
                                    taskDesc.fromSpawnStateLoop = !!task.fromSpawnStateLoop;
                                    desc.tasks.push(taskDesc);
                                    break;
                                }
                            }
                        });
                        vfxAsset.systems.push(desc);
                        break;
                    }
                    case exports.VFXSystemType.Particle: {
                        const desc = new VFXParticleSystemDesc();
                        const initializeUrl = Laya.URL.join(baseUrl, sys.initializeShader);
                        const updateUrl = Laya.URL.join(baseUrl, sys.updateShader);
                        const outputUrl = Laya.URL.join(baseUrl, sys.outputShader);
                        const prepareDispatchUrl = Laya.URL.join(baseUrl, sys.prepareDispatchShader);
                        const updateStripsUrl = Laya.URL.join(baseUrl, sys.updateStripsShader);
                        desc.capacity = sys.capacity;
                        desc.attributeBytesPerParticle = sys.attributeBytesPerParticle;
                        desc.outputType = sys.outputType || "outputMesh";
                        desc.particlePerStripCount = (_a = sys.particlePerStripCount) !== null && _a !== void 0 ? _a : 128;
                        desc.stripCapacity = (_b = sys.stripCapacity) !== null && _b !== void 0 ? _b : 1;
                        desc.billboardPrimitive = sys.billboardPrimitive || "";
                        desc.billboardVertexCount = Number(sys.billboardVertexCount) || 0;
                        desc.distortionMode = sys.distortionMode || "Procedural";
                        desc.billboardCropFactor = Number((_c = sys.billboardCropFactor) !== null && _c !== void 0 ? _c : 0.146);
                        desc.useAlphaClipping = !!sys.useAlphaClipping;
                        desc.alphaThreshold = Number((_d = sys.alphaThreshold) !== null && _d !== void 0 ? _d : 0.5);
                        if (sys.spawnerSystems) {
                            desc.spawnerSystems.push(...sys.spawnerSystems);
                        }
                        desc.receiveGPUEvent = (_e = sys.receiveGPUEvent) !== null && _e !== void 0 ? _e : false;
                        if (sys.simulateSpace === "World") {
                            desc.simulateSpace = exports.VFXSimulateSpace.World;
                        }
                        if (sys.blendMode && exports.VFXBlendMode[sys.blendMode]) {
                            desc.blendMode = sys.blendMode;
                        }
                        if (typeof sys.softParticleFade === "number") {
                            desc.softParticleFade = sys.softParticleFade;
                        }
                        if (typeof sys.uvMode === "string")
                            desc.uvMode = sys.uvMode;
                        if (Array.isArray(sys.flipbookSize)) {
                            desc.flipbookSize = new Laya.Vector2(sys.flipbookSize[0] || 4, sys.flipbookSize[1] || 4);
                        }
                        if (typeof sys.mainTexture === "string" && sys.mainTexture) {
                            desc.mainTexture = Laya.URL.join(baseUrl, sys.mainTexture);
                        }
                        if (sys.subpixelAA)
                            desc.subpixelAA = true;
                        if (typeof sys.customShaderName === "string" && sys.customShaderName) {
                            desc.customShaderName = sys.customShaderName;
                        }
                        if (typeof sys.customShaderRes === "string" && sys.customShaderRes) {
                            const shaderUrl = Laya.URL.join(baseUrl, sys.customShaderRes);
                            desc.customShaderRes = shaderUrl;
                            loadPromises.push(Laya.Laya.loader.load(shaderUrl).then(() => { console.log(`[VFX Parser] preloaded custom shader '${sys.customShaderName}' from ${shaderUrl}`); }, (err) => { console.warn(`[VFX Parser] failed preloading custom shader '${sys.customShaderName}' from ${shaderUrl}`, err); }));
                        }
                        if (sys.shaderPropertyBindings && typeof sys.shaderPropertyBindings === "object") {
                            desc.shaderPropertyBindings = sys.shaderPropertyBindings;
                        }
                        if (sys.shaderPropertyDefaults && typeof sys.shaderPropertyDefaults === "object") {
                            const entries = {};
                            for (const uniformName in sys.shaderPropertyDefaults) {
                                if (uniformName === "mesh")
                                    continue;
                                const path = sys.shaderPropertyDefaults[uniformName];
                                if (typeof path !== "string" || !path)
                                    continue;
                                const url = Laya.URL.join(baseUrl, path);
                                const entry = { url, texture: null };
                                entries[uniformName] = entry;
                                loadPromises.push(Laya.Laya.loader.load(url).then((tex) => { if (tex)
                                    entry.texture = tex; }, (err) => { console.warn(`[VFX] shaderPropertyDefault '${uniformName}' load failed: ${url}`, err); }));
                            }
                            desc.shaderPropertyDefaults = entries;
                        }
                        if (sys.shaderPropertyExpressions && typeof sys.shaderPropertyExpressions === "object") {
                            desc.shaderPropertyExpressions = sys.shaderPropertyExpressions;
                        }
                        if (typeof sys.colorMapping === "string")
                            desc.stripColorMapping = sys.colorMapping;
                        if (typeof sys.tilingMode === "string")
                            desc.tilingMode = sys.tilingMode;
                        if (sys.uvScale && typeof sys.uvScale === "object") {
                            desc.stripUvScale = { x: Number((_f = sys.uvScale.x) !== null && _f !== void 0 ? _f : 1), y: Number((_g = sys.uvScale.y) !== null && _g !== void 0 ? _g : 1) };
                        }
                        if (sys.uvBias && typeof sys.uvBias === "object") {
                            desc.stripUvBias = { x: Number((_h = sys.uvBias.x) !== null && _h !== void 0 ? _h : 0), y: Number((_j = sys.uvBias.y) !== null && _j !== void 0 ? _j : 0) };
                        }
                        if (sys.gradient && typeof sys.gradient === "object" && Array.isArray(sys.gradient.colorKeys)) {
                            const gck = sys.gradient.colorKeys, gak = sys.gradient.alphaKeys || [];
                            const allTimes = new Set();
                            gck.forEach((k) => allTimes.add(Number(k.time) || 0));
                            gak.forEach((k) => allTimes.add(Number(k.time) || 0));
                            const sortedTimes = [...allTimes].sort((a, b) => a - b);
                            const sampleColor = (t) => {
                                if (gck.length === 0)
                                    return { r: 1, g: 1, b: 1 };
                                if (t <= gck[0].time)
                                    return gck[0].color;
                                if (t >= gck[gck.length - 1].time)
                                    return gck[gck.length - 1].color;
                                for (let i = 0; i < gck.length - 1; i++) {
                                    const a = gck[i], b = gck[i + 1];
                                    if (t >= a.time && t <= b.time) {
                                        const f = (t - a.time) / (b.time - a.time + 1e-8);
                                        return { r: a.color.r + (b.color.r - a.color.r) * f, g: a.color.g + (b.color.g - a.color.g) * f, b: a.color.b + (b.color.b - a.color.b) * f };
                                    }
                                }
                                return gck[gck.length - 1].color;
                            };
                            const sampleAlpha = (t) => {
                                if (gak.length === 0)
                                    return 1;
                                if (t <= gak[0].time)
                                    return gak[0].alpha;
                                if (t >= gak[gak.length - 1].time)
                                    return gak[gak.length - 1].alpha;
                                for (let i = 0; i < gak.length - 1; i++) {
                                    const a = gak[i], b = gak[i + 1];
                                    if (t >= a.time && t <= b.time) {
                                        const f = (t - a.time) / (b.time - a.time + 1e-8);
                                        return a.alpha + (b.alpha - a.alpha) * f;
                                    }
                                }
                                return gak[gak.length - 1].alpha;
                            };
                            desc.stripGradientStops = sortedTimes.map(t => {
                                const c = sampleColor(t);
                                const a = sampleAlpha(t);
                                return { t, color: [c.r, c.g, c.b, a] };
                            });
                        }
                        if (sys.boundsMode === "Manual") {
                            desc.boundsMode = exports.VFXBoundsMode.Manual;
                            const c = sys.boundsCenter;
                            const e = sys.boundsExtents;
                            desc.boundsCenter = new Laya.Vector3(c[0], c[1], c[2]);
                            desc.boundsExtents = new Laya.Vector3(e[0], e[1], e[2]);
                        }
                        if (sys.gpuEventInput) {
                            desc.gpuEventInput = {
                                sourceSystem: sys.gpuEventInput.sourceSystem,
                                eventType: sys.gpuEventInput.eventType,
                            };
                        }
                        const shaderUrls = [initializeUrl, updateUrl];
                        if (outputUrl) {
                            shaderUrls.push(outputUrl);
                        }
                        if (prepareDispatchUrl) {
                            shaderUrls.push(prepareDispatchUrl);
                        }
                        if (updateStripsUrl) {
                            shaderUrls.push(updateStripsUrl);
                        }
                        const loadCompute = Laya.Laya.loader.load(shaderUrls).then((shaders) => {
                            desc.initializeShader = shaders[0];
                            desc.updateShader = shaders[1];
                            let nextIdx = 2;
                            if (outputUrl) {
                                desc.outputShader = shaders[nextIdx++];
                            }
                            if (prepareDispatchUrl && shaders[nextIdx]) {
                                desc.prepareDispatchShader = shaders[nextIdx++];
                            }
                            if (updateStripsUrl && shaders[nextIdx]) {
                                desc.updateStripsShader = shaders[nextIdx];
                            }
                        });
                        loadPromises.push(loadCompute);
                        const meshUrl = Laya.URL.join(baseUrl, sys.mesh);
                        const isProceduralGeometry = (desc.outputType === "outputBillboard" || desc.outputType === "outputCube" || desc.outputType === "outputDistortion") && !!desc.billboardPrimitive;
                        const buildMeshFallback = () => {
                            if (desc.outputType === "outputMesh" || desc.outputType === "outputStaticMesh") {
                                return Laya.PrimitiveMesh.createSphere(0.5, 12, 12);
                            }
                            return Laya.PrimitiveMesh.createQuad(1, 1);
                        };
                        const buildBuiltinMesh = (name) => {
                            switch (name) {
                                case "Sphere": return Laya.PrimitiveMesh.createSphere(0.5, 12, 12);
                                case "Cube": return Laya.PrimitiveMesh.createBox(1, 1, 1);
                                case "Cylinder": return Laya.PrimitiveMesh.createCylinder(0.5, 2, 12);
                                case "Capsule": return Laya.PrimitiveMesh.createCapsule(0.5, 2, 12, 12);
                                case "Plane": return Laya.PrimitiveMesh.createPlane(10, 10, 1, 1);
                                case "Quad": return Laya.PrimitiveMesh.createQuad(1, 1);
                                case "Triangle": return Laya.PrimitiveMesh.createTriangle(1, 1);
                                default: return null;
                            }
                        };
                        if (meshUrl && meshUrl.startsWith("builtin:") && !isProceduralGeometry) {
                            const builtinName = meshUrl.slice(8);
                            desc.mesh = buildBuiltinMesh(builtinName) || buildMeshFallback();
                        }
                        else if (meshUrl && !isProceduralGeometry) {
                            const loadMesh = Laya.Laya.loader.load(meshUrl).then(mesh => {
                                if (mesh) {
                                    desc.mesh = mesh;
                                }
                                else {
                                    console.error(`[VFX] mesh load returned null: ${meshUrl} (system mesh) — fallback to builtin`);
                                    desc.mesh = buildMeshFallback();
                                }
                            }).catch(err => {
                                console.error(`[VFX] mesh load failed: ${meshUrl} (system mesh)`, err);
                                desc.mesh = buildMeshFallback();
                            });
                            loadPromises.push(loadMesh);
                        }
                        else if (!isProceduralGeometry) {
                            if (desc.outputType === "outputMesh" || desc.outputType === "outputStaticMesh") {
                                desc.outputType = "none";
                            }
                            else {
                                desc.mesh = buildMeshFallback();
                            }
                        }
                        if (sys.textureUniforms && Array.isArray(sys.textureUniforms)) {
                            for (const tu of sys.textureUniforms) {
                                const uuid = tu.uuid;
                                const uniformName = tu.uniformName;
                                const textureType = tu.textureType;
                                const entry = { uniformName, texture: null, textureType };
                                desc.textureUniforms.push(entry);
                                const skinnedMeshMatch = /^SkinnedMesh_(position|indices|weights|normal|bones)$/.exec(textureType);
                                if (skinnedMeshMatch) {
                                    entry.skinnedMeshSource = uuid;
                                    entry.skinnedMeshRole = skinnedMeshMatch[1];
                                    continue;
                                }
                                if (textureType === "Transform") {
                                    entry.transformSource = uuid;
                                    continue;
                                }
                                if (textureType === "InlineGradient") {
                                    const rawStops = Array.isArray(tu.gradientStops) ? tu.gradientStops : [];
                                    const stops = rawStops.map((s) => {
                                        var _a, _b, _c, _d, _e, _f, _g, _h;
                                        return ({
                                            t: Number(s.t) || 0,
                                            color: [
                                                Number((_b = (_a = s.color) === null || _a === void 0 ? void 0 : _a.r) !== null && _b !== void 0 ? _b : 1),
                                                Number((_d = (_c = s.color) === null || _c === void 0 ? void 0 : _c.g) !== null && _d !== void 0 ? _d : 1),
                                                Number((_f = (_e = s.color) === null || _e === void 0 ? void 0 : _e.b) !== null && _f !== void 0 ? _f : 1),
                                                Number((_h = (_g = s.color) === null || _g === void 0 ? void 0 : _g.a) !== null && _h !== void 0 ? _h : 1),
                                            ],
                                        });
                                    });
                                    stops.sort((a, b) => a.t - b.t);
                                    if (stops.length === 0) {
                                        stops.push({ t: 0, color: [1, 1, 1, 1] });
                                        stops.push({ t: 1, color: [1, 1, 1, 0] });
                                    }
                                    entry.texture = bakeInlineGradientTexture(stops);
                                    continue;
                                }
                                if (!uuid)
                                    continue;
                                const resourceUrl = Laya.URL.join(baseUrl, uuid);
                                const meshPCMatch = /^Mesh(SurfacePoints|VolumePoints)$/.exec(textureType);
                                const meshRoleMatch = !meshPCMatch ? /^Mesh(Pos|Position|Normal|Tangent|Uv|UV|Color|Index)$/.exec(textureType) : null;
                                const pointCacheMatch = (!meshPCMatch && !meshRoleMatch) ? /^PointCache_(.+)$/.exec(textureType) : null;
                                if (meshPCMatch) {
                                    const pcRole = meshPCMatch[1] === "SurfacePoints" ? "surface" : "volume";
                                    const pointCount = Math.max(16, Math.min(8192, Number(tu.pointCount) || 1024));
                                    const meshScale = _resolveMeshScale(Number(tu.meshScale), uuid);
                                    if (uuid.startsWith("builtin:")) {
                                        const builtinMesh = buildBuiltinMesh(uuid.slice(8));
                                        if (builtinMesh)
                                            entry.texture = pcRole === "surface"
                                                ? bakeMeshSurfacePoints(builtinMesh, pointCount, meshScale)
                                                : bakeMeshVolumePoints(builtinMesh, pointCount, meshScale);
                                        else
                                            console.warn(`[VFX] setPositionMesh(${pcRole}): unknown builtin mesh ${uuid}`);
                                    }
                                    else {
                                        const loadMeshTex = Laya.Laya.loader.load(resourceUrl).then((mesh) => {
                                            if (mesh)
                                                entry.texture = pcRole === "surface"
                                                    ? bakeMeshSurfacePoints(mesh, pointCount, meshScale)
                                                    : bakeMeshVolumePoints(mesh, pointCount, meshScale);
                                            else
                                                console.warn(`[VFX] setPositionMesh(${pcRole}): failed to load mesh ${resourceUrl}`);
                                        });
                                        loadPromises.push(loadMeshTex);
                                    }
                                }
                                else if (meshRoleMatch) {
                                    const role = meshRoleMatch[1].toLowerCase();
                                    const normalizedRole = role === "pos" ? "position" : (role === "uv" ? "uv" : role);
                                    const loadMeshTex = Laya.Laya.loader.load(resourceUrl).then((mesh) => {
                                        if (mesh) {
                                            entry.texture = bakeMeshAttributeTexture(mesh, normalizedRole);
                                        }
                                        else {
                                            console.warn(`[VFX] sampleMesh: failed to load mesh ${resourceUrl}`);
                                        }
                                    });
                                    loadPromises.push(loadMeshTex);
                                }
                                else if (pointCacheMatch) {
                                    const attrName = pointCacheMatch[1];
                                    const loadPCache = Laya.Laya.loader.fetch(resourceUrl, "json", null).then((pcache) => {
                                        if (pcache)
                                            entry.texture = bakePointCacheTexture(pcache, attrName);
                                        else
                                            console.warn(`[VFX] samplePointCache: failed to load ${resourceUrl}`);
                                    });
                                    loadPromises.push(loadPCache);
                                }
                                else {
                                    const loadTex = Laya.Laya.loader.load(resourceUrl).then((tex) => {
                                        entry.texture = tex;
                                    });
                                    loadPromises.push(loadTex);
                                }
                            }
                        }
                        if (sys.bufferUniforms && Array.isArray(sys.bufferUniforms)) {
                            for (const bu of sys.bufferUniforms) {
                                if (bu.meshProp) {
                                    const mpEntry = { uniformName: bu.uniformName, buffer: null };
                                    desc.meshPointBuffers.push(mpEntry);
                                    const pcUuid = String(bu.meshProp);
                                    const pcUrl = Laya.URL.join(baseUrl, pcUuid);
                                    const pcRole = String(bu.meshRole || "surfacePoints");
                                    const pcCount = Math.max(16, Math.min(8192, Number(bu.pointCount) || 1024));
                                    const pcScale = _resolveMeshScale(Number(bu.meshScale), pcUuid);
                                    loadPromises.push(Laya.Laya.loader.load(pcUrl).then((mesh) => {
                                        if (mesh)
                                            mpEntry.buffer = pcRole === "volumePoints"
                                                ? bakeMeshVolumePointsBuffer(mesh, pcCount, pcScale)
                                                : bakeMeshSurfacePointsBuffer(mesh, pcCount, pcScale);
                                        else
                                            console.warn(`[VFX] setPositionMesh(buffer): failed to load mesh ${pcUrl}`);
                                    }));
                                }
                                else {
                                    desc.bufferUniforms.push({
                                        uniformName: bu.uniformName,
                                        propertyName: bu.propertyName,
                                    });
                                }
                            }
                        }
                        if (sys.outputEvents && Array.isArray(sys.outputEvents)) {
                            for (const oe of sys.outputEvents) {
                                const desc_oe = new VFXOutputEventDesc();
                                desc_oe.eventIdx = Number(oe.eventIdx) || 0;
                                desc_oe.eventName = oe.eventName || "OnReceived";
                                desc_oe.eventType = oe.eventType || "OnDie";
                                desc_oe.capacity = Math.max(1, Number(oe.capacity) || 256);
                                desc_oe.entryFloats = Number(oe.entryFloats) || 16;
                                desc_oe.entryBytes = Number(oe.entryBytes) || 64;
                                desc.outputEvents.push(desc_oe);
                            }
                        }
                        if (Array.isArray(sys.extraOutputs)) {
                            for (const eo of sys.extraOutputs) {
                                const extra = new VFXExtraOutputDesc();
                                extra.outputType = eo.outputType || "outputMesh";
                                extra.blendMode = (eo.blendMode || "Alpha");
                                extra.softParticleFade = Number(eo.softParticleFade) || 0;
                                if (typeof eo.uvMode === "string")
                                    extra.uvMode = eo.uvMode;
                                if (Array.isArray(eo.flipbookSize)) {
                                    extra.flipbookSize = new Laya.Vector2(eo.flipbookSize[0] || 4, eo.flipbookSize[1] || 4);
                                }
                                if (typeof eo.mainTexture === "string" && eo.mainTexture) {
                                    extra.mainTexture = Laya.URL.join(baseUrl, eo.mainTexture);
                                }
                                if (eo.subpixelAA)
                                    extra.subpixelAA = true;
                                if (eo.customShaderName)
                                    extra.customShaderName = eo.customShaderName;
                                if (typeof eo.customShaderRes === "string" && eo.customShaderRes) {
                                    const exShaderUrl = Laya.URL.join(baseUrl, eo.customShaderRes);
                                    extra.customShaderRes = exShaderUrl;
                                    loadPromises.push(Laya.Laya.loader.load(exShaderUrl).then(() => { console.log(`[VFX Parser] preloaded extra custom shader '${eo.customShaderName}' from ${exShaderUrl}`); }, (err) => { console.warn(`[VFX Parser] failed preloading extra custom shader '${eo.customShaderName}' from ${exShaderUrl}`, err); }));
                                }
                                extra.stripCapacity = Number(eo.stripCapacity) || 1;
                                extra.particlePerStripCount = Number(eo.particlePerStripCount) || 128;
                                extra.billboardPrimitive = eo.billboardPrimitive || "";
                                extra.billboardVertexCount = Number(eo.billboardVertexCount) || 0;
                                extra.billboardCropFactor = Number((_k = eo.billboardCropFactor) !== null && _k !== void 0 ? _k : 0.146);
                                extra.useAlphaClipping = !!eo.useAlphaClipping;
                                extra.alphaThreshold = Number((_l = eo.alphaThreshold) !== null && _l !== void 0 ? _l : 0.5);
                                extra.tilingMode = eo.tilingMode || "Stretch";
                                extra.colorMapping = eo.colorMapping || "Default";
                                extra.uvScale = eo.uvScale;
                                extra.uvBias = eo.uvBias;
                                if (eo.outputShader) {
                                    const outputShaderUrl = Laya.URL.join(baseUrl, eo.outputShader);
                                    const loadExtraShader = Laya.Laya.loader.load(outputShaderUrl).then((shader) => {
                                        extra.outputShader = shader;
                                    });
                                    loadPromises.push(loadExtraShader);
                                }
                                const meshUrl = Laya.URL.join(baseUrl, eo.mesh);
                                const buildExtraMeshFallback = () => {
                                    return extra.outputType === "outputMesh" || extra.outputType === "outputStaticMesh"
                                        ? Laya.PrimitiveMesh.createSphere(0.5, 12, 12)
                                        : Laya.PrimitiveMesh.createQuad(1, 1);
                                };
                                if (meshUrl && meshUrl.startsWith("builtin:")) {
                                    const builtinName = meshUrl.slice(8);
                                    extra.mesh = buildBuiltinMesh(builtinName) || buildExtraMeshFallback();
                                }
                                else if (meshUrl) {
                                    const loadMesh = Laya.Laya.loader.load(meshUrl).then((mesh) => {
                                        if (mesh) {
                                            extra.mesh = mesh;
                                        }
                                        else {
                                            console.error(`[VFX] mesh load returned null: ${meshUrl} (extra output) — fallback to builtin`);
                                            extra.mesh = buildExtraMeshFallback();
                                        }
                                    }).catch(err => {
                                        console.error(`[VFX] mesh load failed: ${meshUrl} (extra output)`, err);
                                        extra.mesh = buildExtraMeshFallback();
                                    });
                                    loadPromises.push(loadMesh);
                                }
                                else {
                                    extra.mesh = buildExtraMeshFallback();
                                }
                                desc.extraOutputs.push(extra);
                            }
                        }
                        vfxAsset.systems.push(desc);
                        break;
                    }
                    case exports.VFXSystemType.StaticMesh: {
                        const desc = new VFXStaticMeshSystemDesc();
                        desc.materialUuid = Laya.URL.join(baseUrl, String(sys.materialUuid || ""));
                        if (Array.isArray(sys.bindings)) {
                            desc.bindings = sys.bindings;
                        }
                        const meshUrl = Laya.URL.join(baseUrl, sys.mesh);
                        const buildStaticBuiltin = (name) => {
                            switch (name) {
                                case "Sphere": return Laya.PrimitiveMesh.createSphere(0.5, 12, 12);
                                case "Cube": return Laya.PrimitiveMesh.createBox(1, 1, 1);
                                case "Cylinder": return Laya.PrimitiveMesh.createCylinder(0.5, 2, 12);
                                case "Capsule": return Laya.PrimitiveMesh.createCapsule(0.5, 2, 12, 12);
                                case "Plane": return Laya.PrimitiveMesh.createPlane(10, 10, 1, 1);
                                case "Quad": return Laya.PrimitiveMesh.createQuad(1, 1);
                                case "Triangle": return Laya.PrimitiveMesh.createTriangle(1, 1);
                                default: return null;
                            }
                        };
                        if (meshUrl && meshUrl.startsWith("builtin:")) {
                            desc.mesh = buildStaticBuiltin(meshUrl.slice(8)) || Laya.PrimitiveMesh.createSphere(0.5, 12, 12);
                        }
                        else if (meshUrl) {
                            const loadMesh = Laya.Laya.loader.load(meshUrl).then(mesh => {
                                if (mesh) {
                                    desc.mesh = mesh;
                                }
                                else {
                                    console.error(`[VFX] mesh load returned null: ${meshUrl} (StaticMesh) — fallback to sphere`);
                                    desc.mesh = Laya.PrimitiveMesh.createSphere(0.5, 12, 12);
                                }
                            }).catch(err => {
                                console.error(`[VFX] mesh load failed: ${meshUrl} (StaticMesh)`, err);
                                desc.mesh = Laya.PrimitiveMesh.createSphere(0.5, 12, 12);
                            });
                            loadPromises.push(loadMesh);
                        }
                        else {
                            desc.mesh = Laya.PrimitiveMesh.createSphere(0.5, 12, 12);
                        }
                        vfxAsset.systems.push(desc);
                        break;
                    }
                }
            });
            if (data.properties) {
                for (const prop of data.properties) {
                    const desc = new VFXPropertyDesc();
                    desc.name = prop.name;
                    desc.uniform = prop.uniform;
                    desc.type = normalizePropertyType(prop.type);
                    const d = prop.default;
                    switch (desc.type) {
                        case exports.VFXPropertyType.Float:
                            desc.default = [d];
                            break;
                        case exports.VFXPropertyType.Vec2:
                            desc.default = [d.x, d.y];
                            break;
                        case exports.VFXPropertyType.Vec3:
                            desc.default = [d.x, d.y, d.z];
                            break;
                        case exports.VFXPropertyType.Vec4:
                            desc.default = [d.x, d.y, d.z, d.w];
                            break;
                        case exports.VFXPropertyType.Color:
                            desc.default = [(_b = (_a = d.r) !== null && _a !== void 0 ? _a : d.x) !== null && _b !== void 0 ? _b : 1, (_d = (_c = d.g) !== null && _c !== void 0 ? _c : d.y) !== null && _d !== void 0 ? _d : 1, (_f = (_e = d.b) !== null && _e !== void 0 ? _e : d.z) !== null && _f !== void 0 ? _f : 1, (_h = (_g = d.a) !== null && _g !== void 0 ? _g : d.w) !== null && _h !== void 0 ? _h : 1];
                            break;
                        case exports.VFXPropertyType.Gradient: {
                            const stops = Array.isArray(d === null || d === void 0 ? void 0 : d.stops) ? d.stops : [];
                            desc.gradientStops = stops.map((s) => {
                                var _a, _b, _c, _d, _e, _f, _g, _h;
                                return ({
                                    t: Number(s.t) || 0,
                                    color: [
                                        Number((_b = (_a = s.color) === null || _a === void 0 ? void 0 : _a.r) !== null && _b !== void 0 ? _b : 1),
                                        Number((_d = (_c = s.color) === null || _c === void 0 ? void 0 : _c.g) !== null && _d !== void 0 ? _d : 1),
                                        Number((_f = (_e = s.color) === null || _e === void 0 ? void 0 : _e.b) !== null && _f !== void 0 ? _f : 1),
                                        Number((_h = (_g = s.color) === null || _g === void 0 ? void 0 : _g.a) !== null && _h !== void 0 ? _h : 1),
                                    ],
                                });
                            });
                            desc.gradientStops.sort((a, b) => a.t - b.t);
                            if (desc.gradientStops.length === 0) {
                                desc.gradientStops = [
                                    { t: 0, color: [1, 1, 1, 1] },
                                    { t: 1, color: [1, 1, 1, 0] },
                                ];
                            }
                            desc.default = [];
                            break;
                        }
                        case exports.VFXPropertyType.Texture2D: {
                            let path = null;
                            if (Array.isArray(d) && typeof d[0] === "string")
                                path = d[0];
                            else if (typeof d === "string")
                                path = d;
                            const url = path ? Laya.URL.join(baseUrl, path) : null;
                            desc.default = url ? [url] : [];
                            desc.texture = null;
                            if (url) {
                                const loadTex = Laya.Laya.loader.load(url).then((tex) => {
                                    if (tex) {
                                        desc.texture = tex.bitmap || tex._image || tex._source || tex;
                                    }
                                    else {
                                        console.warn(`[VFX] Texture2D property '${prop.name}' load returned null: ${url}`);
                                    }
                                }, (err) => {
                                    console.warn(`[VFX] Texture2D property '${prop.name}' load failed: ${url}`, err);
                                });
                                loadPromises.push(loadTex);
                            }
                            break;
                        }
                    }
                    vfxAsset.properties.push(desc);
                }
            }
            const descs = getDescMap(data.eventAttributes);
            vfxAsset.eventAttributeDesc = new VFXEventAttributeDesc(descs);
            data.events.forEach(evt => {
                const evtDesc = new VFXEventDesc();
                evtDesc.id = Laya.Shader3D.propertyNameToID(evt.name);
                evtDesc.playSystems.push(...evt.playSystems);
                evtDesc.stopSystems.push(...evt.stopSystems);
                evtDesc.initSystems.push(...evt.initSystems);
                vfxAsset.events.set(evtDesc.id, evtDesc);
            });
            if (data.curveUniforms) {
                for (const cu of data.curveUniforms) {
                    const desc = new VFXCurveUniformDesc();
                    desc.opId = cu.opId;
                    desc.uniform = cu.uniform;
                    desc.curveData = cu.curveData;
                    vfxAsset.curveUniforms.push(desc);
                }
            }
            if (data.bakedTexture) {
                const bakedTextureUrl = Laya.URL.join(baseUrl, data.bakedTexture);
                const loadBakedTex = Laya.Laya.loader.load(bakedTextureUrl).then((tex) => {
                    vfxAsset.bakedTexture = tex;
                });
                loadPromises.push(loadBakedTex);
            }
            await Promise.all(loadPromises);
            vfxAsset.resolveDeps();
            return vfxAsset;
        }
    }
    const _f16ScratchF32 = new Float32Array(1);
    const _f16ScratchU32 = new Uint32Array(_f16ScratchF32.buffer);
    function _f32ToF16(v) {
        _f16ScratchF32[0] = v;
        const bits = _f16ScratchU32[0];
        const sign = (bits >> 16) & 0x8000;
        const exp = ((bits >> 23) & 0xff) - 127 + 15;
        const frac = bits & 0x7fffff;
        if (exp <= 0) {
            if (exp < -10)
                return sign;
            const m = (frac | 0x800000) >> (1 - exp);
            return sign | (m >> 13);
        }
        if (exp >= 31)
            return sign | 0x7c00;
        return sign | (exp << 10) | (frac >> 13);
    }
    function bakeInlineGradientTexture(stops) {
        const width = 256;
        const data = new Uint16Array(width * 4);
        const rawKeys = stops.length >= 2 ? stops : [
            { t: 0, color: [1, 1, 1, 1] },
            { t: 1, color: [1, 1, 1, 0] },
        ];
        const sanitizeStop = (c) => [
            Math.max(0, c[0]), Math.max(0, c[1]), Math.max(0, c[2]), Math.max(0, Math.min(1, c[3])),
        ];
        const keys = rawKeys.map(k => ({
            t: k.t,
            color: sanitizeStop(k.color),
        }));
        for (let i = 0; i < width; i++) {
            const t = i / (width - 1);
            let a = keys[0], b = keys[keys.length - 1];
            for (let k = 0; k < keys.length - 1; k++) {
                if (t >= keys[k].t && t <= keys[k + 1].t) {
                    a = keys[k];
                    b = keys[k + 1];
                    break;
                }
            }
            const span = Math.max(b.t - a.t, 1e-6);
            const u = Math.max(0, Math.min(1, (t - a.t) / span));
            const r = a.color[0] + (b.color[0] - a.color[0]) * u;
            const g = a.color[1] + (b.color[1] - a.color[1]) * u;
            const bB = a.color[2] + (b.color[2] - a.color[2]) * u;
            const aA = a.color[3] + (b.color[3] - a.color[3]) * u;
            data[i * 4] = _f32ToF16(r);
            data[i * 4 + 1] = _f32ToF16(g);
            data[i * 4 + 2] = _f32ToF16(bB);
            data[i * 4 + 3] = _f32ToF16(aA);
        }
        const tex = new Laya.Texture2D(width, 1, Laya.TextureFormat.R16G16B16A16, false, false, false, false);
        tex.setPixelsData(data, false, false);
        tex.wrapModeU = Laya.WrapMode.Clamp;
        tex.wrapModeV = Laya.WrapMode.Clamp;
        tex.filterMode = Laya.FilterMode.Bilinear;
        return tex;
    }
    function bakePointCacheTexture(pcache, attrName) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        let count = 1;
        let data = new Float32Array(4);
        try {
            const attrs = pcache === null || pcache === void 0 ? void 0 : pcache.attributes;
            const arr = attrs === null || attrs === void 0 ? void 0 : attrs[attrName];
            if (Array.isArray(arr) && arr.length > 0) {
                count = arr.length;
                data = new Float32Array(count * 4);
                for (let i = 0; i < count; i++) {
                    const v = arr[i];
                    if (v == null)
                        continue;
                    if (typeof v === "number") {
                        data[i * 4] = v;
                    }
                    else if (Array.isArray(v)) {
                        data[i * 4] = (_a = v[0]) !== null && _a !== void 0 ? _a : 0;
                        data[i * 4 + 1] = (_b = v[1]) !== null && _b !== void 0 ? _b : 0;
                        data[i * 4 + 2] = (_c = v[2]) !== null && _c !== void 0 ? _c : 0;
                        data[i * 4 + 3] = (_d = v[3]) !== null && _d !== void 0 ? _d : (v.length === 3 ? 1 : 0);
                    }
                    else if (typeof v === "object") {
                        data[i * 4] = (_f = (_e = v.x) !== null && _e !== void 0 ? _e : v.r) !== null && _f !== void 0 ? _f : 0;
                        data[i * 4 + 1] = (_h = (_g = v.y) !== null && _g !== void 0 ? _g : v.g) !== null && _h !== void 0 ? _h : 0;
                        data[i * 4 + 2] = (_k = (_j = v.z) !== null && _j !== void 0 ? _j : v.b) !== null && _k !== void 0 ? _k : 0;
                        data[i * 4 + 3] = (_m = (_l = v.w) !== null && _l !== void 0 ? _l : v.a) !== null && _m !== void 0 ? _m : 0;
                    }
                }
            }
            else {
                console.warn(`[VFX] samplePointCache: attribute "${attrName}" not found in pcache`);
            }
        }
        catch (e) {
            console.warn(`[VFX] bakePointCacheTexture(${attrName}) failed`, e);
        }
        const tex = new Laya.Texture2D(count, 1, Laya.TextureFormat.R32G32B32A32, false, false, false, false);
        tex.setPixelsData(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), false, false);
        tex.wrapModeU = Laya.WrapMode.Clamp;
        tex.wrapModeV = Laya.WrapMode.Clamp;
        tex.filterMode = Laya.FilterMode.Point;
        return tex;
    }
    function bakeMeshAttributeTexture(mesh, role = "position") {
        const MAX_VERTS = 16384;
        let count = 1;
        let data = new Float32Array(4);
        if (role === "color") {
            data[0] = 1;
            data[1] = 1;
            data[2] = 1;
            data[3] = 1;
        }
        const hasData = (vs) => vs.length > 0 && vs[0] != null;
        try {
            const _calcStride = (totalCount) => totalCount > MAX_VERTS ? Math.ceil(totalCount / MAX_VERTS) : 1;
            if (role === "position") {
                const vs = [];
                mesh.getPositions(vs);
                if (hasData(vs)) {
                    const stride = _calcStride(vs.length);
                    count = Math.ceil(vs.length / stride);
                    data = new Float32Array(count * 4);
                    for (let j = 0; j < count; j++) {
                        const v = vs[j * stride];
                        if (!v)
                            continue;
                        data[j * 4] = v.x;
                        data[j * 4 + 1] = v.y;
                        data[j * 4 + 2] = v.z;
                        data[j * 4 + 3] = 1.0;
                    }
                }
            }
            else if (role === "normal") {
                const vs = [];
                mesh.getNormals(vs);
                if (hasData(vs)) {
                    const stride = _calcStride(vs.length);
                    count = Math.ceil(vs.length / stride);
                    data = new Float32Array(count * 4);
                    for (let j = 0; j < count; j++) {
                        const v = vs[j * stride];
                        if (!v)
                            continue;
                        data[j * 4] = v.x;
                        data[j * 4 + 1] = v.y;
                        data[j * 4 + 2] = v.z;
                        data[j * 4 + 3] = 0.0;
                    }
                }
            }
            else if (role === "tangent") {
                const vs = [];
                mesh.getTangents(vs);
                if (hasData(vs)) {
                    const stride = _calcStride(vs.length);
                    count = Math.ceil(vs.length / stride);
                    data = new Float32Array(count * 4);
                    for (let j = 0; j < count; j++) {
                        const v = vs[j * stride];
                        if (!v)
                            continue;
                        data[j * 4] = v.x;
                        data[j * 4 + 1] = v.y;
                        data[j * 4 + 2] = v.z;
                        data[j * 4 + 3] = v.w;
                    }
                }
            }
            else if (role === "uv") {
                const vs = [];
                mesh.getUVs(vs);
                if (hasData(vs)) {
                    const stride = _calcStride(vs.length);
                    count = Math.ceil(vs.length / stride);
                    data = new Float32Array(count * 4);
                    for (let j = 0; j < count; j++) {
                        const v = vs[j * stride];
                        if (!v)
                            continue;
                        data[j * 4] = v.x;
                        data[j * 4 + 1] = v.y;
                        data[j * 4 + 2] = 0.0;
                        data[j * 4 + 3] = 0.0;
                    }
                }
            }
            else if (role === "color") {
                const vs = [];
                if (mesh.getColors) {
                    try {
                        mesh.getColors(vs);
                    }
                    catch (_a) { }
                }
                if (hasData(vs)) {
                    const stride = _calcStride(vs.length);
                    count = Math.ceil(vs.length / stride);
                    data = new Float32Array(count * 4);
                    for (let j = 0; j < count; j++) {
                        const v = vs[j * stride];
                        if (!v) {
                            data[j * 4] = 1;
                            data[j * 4 + 1] = 1;
                            data[j * 4 + 2] = 1;
                            data[j * 4 + 3] = 1;
                            continue;
                        }
                        data[j * 4] = v.r;
                        data[j * 4 + 1] = v.g;
                        data[j * 4 + 2] = v.b;
                        data[j * 4 + 3] = v.a;
                    }
                }
            }
            else if (role === "index") {
                const indices = mesh.getIndices ? mesh.getIndices() : null;
                if (indices && indices.length > 0) {
                    const stride = _calcStride(indices.length);
                    count = Math.ceil(indices.length / stride);
                    data = new Float32Array(count * 4);
                    for (let j = 0; j < count; j++) {
                        data[j * 4] = indices[j * stride];
                    }
                }
            }
        }
        catch (e) {
            console.warn(`[VFX] bakeMeshAttributeTexture(${role}) failed`, e);
        }
        const tex = new Laya.Texture2D(count, 1, Laya.TextureFormat.R32G32B32A32, false, false, false, false);
        tex.setPixelsData(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), false, false);
        tex.wrapModeU = Laya.WrapMode.Clamp;
        tex.wrapModeV = Laya.WrapMode.Clamp;
        tex.filterMode = Laya.FilterMode.Point;
        return tex;
    }
    function bakeSkinnedMeshVertexTexture(mesh, role) {
        let count = 1;
        let data = new Float32Array(4);
        try {
            if (role === "position") {
                const vs = [];
                mesh.getPositions(vs);
                if (vs.length > 0 && vs[0]) {
                    count = vs.length;
                    data = new Float32Array(count * 4);
                    for (let i = 0; i < count; i++) {
                        const v = vs[i];
                        if (!v)
                            continue;
                        data[i * 4] = v.x;
                        data[i * 4 + 1] = v.y;
                        data[i * 4 + 2] = v.z;
                        data[i * 4 + 3] = 1;
                    }
                }
            }
            else if (role === "normal") {
                const vs = [];
                mesh.getNormals(vs);
                if (vs.length > 0 && vs[0]) {
                    count = vs.length;
                    data = new Float32Array(count * 4);
                    for (let i = 0; i < count; i++) {
                        const v = vs[i];
                        if (!v)
                            continue;
                        data[i * 4] = v.x;
                        data[i * 4 + 1] = v.y;
                        data[i * 4 + 2] = v.z;
                        data[i * 4 + 3] = 0;
                    }
                }
            }
            else if (role === "indices") {
                const vs = [];
                mesh.getBoneIndices(vs);
                if (vs.length > 0 && vs[0]) {
                    count = vs.length;
                    data = new Float32Array(count * 4);
                    for (let i = 0; i < count; i++) {
                        const v = vs[i];
                        if (!v)
                            continue;
                        data[i * 4] = v.x;
                        data[i * 4 + 1] = v.y;
                        data[i * 4 + 2] = v.z;
                        data[i * 4 + 3] = v.w;
                    }
                }
            }
            else if (role === "weights") {
                const vs = [];
                mesh.getBoneWeights(vs);
                if (vs.length > 0 && vs[0]) {
                    count = vs.length;
                    data = new Float32Array(count * 4);
                    for (let i = 0; i < count; i++) {
                        const v = vs[i];
                        if (!v)
                            continue;
                        data[i * 4] = v.x;
                        data[i * 4 + 1] = v.y;
                        data[i * 4 + 2] = v.z;
                        data[i * 4 + 3] = v.w;
                    }
                }
            }
        }
        catch (e) {
            console.warn(`[VFX] bakeSkinnedMeshVertexTexture(${role}) failed`, e);
        }
        const tex = new Laya.Texture2D(count, 1, Laya.TextureFormat.R32G32B32A32, false, false, false, false);
        tex.setPixelsData(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), false, false);
        tex.wrapModeU = Laya.WrapMode.Clamp;
        tex.wrapModeV = Laya.WrapMode.Clamp;
        tex.filterMode = Laya.FilterMode.Point;
        return tex;
    }
    function bakeSkinnedMeshBonesTexture(renderer, existingTex) {
        var _a, _b, _c, _d;
        const bones = renderer.bones;
        const mesh = (_c = (_b = (_a = renderer.owner) === null || _a === void 0 ? void 0 : _a.getComponent) === null || _b === void 0 ? void 0 : _b.call(_a, Laya.MeshFilter)) === null || _c === void 0 ? void 0 : _c.sharedMesh;
        const inverseBindPoses = mesh === null || mesh === void 0 ? void 0 : mesh._inverseBindPoses;
        const data = new Float32Array(256 * 4);
        const tmpMtx = new Laya.Matrix4x4();
        const boneCount = Math.min((_d = bones === null || bones === void 0 ? void 0 : bones.length) !== null && _d !== void 0 ? _d : 0, 64);
        for (let i = 0; i < boneCount; i++) {
            const bone = bones[i];
            if (!bone)
                continue;
            const boneWorld = bone.transform.worldMatrix;
            const ibp = inverseBindPoses === null || inverseBindPoses === void 0 ? void 0 : inverseBindPoses[i];
            if (ibp) {
                Laya.Matrix4x4.multiply(boneWorld, ibp, tmpMtx);
            }
            else {
                boneWorld.cloneTo(tmpMtx);
            }
            const e = tmpMtx.elements;
            const off = i * 16;
            for (let k = 0; k < 16; k++)
                data[off + k] = e[k];
        }
        let tex = existingTex;
        if (!tex) {
            tex = new Laya.Texture2D(256, 1, Laya.TextureFormat.R32G32B32A32, false, false, false, false);
            tex.wrapModeU = Laya.WrapMode.Clamp;
            tex.wrapModeV = Laya.WrapMode.Clamp;
            tex.filterMode = Laya.FilterMode.Point;
        }
        tex.setPixelsData(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), false, false);
        return tex;
    }
    function getMeshTriangles(mesh) {
        try {
            const positions = [];
            mesh.getPositions(positions);
            if (!positions.length || positions[0] == null)
                return null;
            const subCount = mesh.subMeshCount;
            if (!subCount)
                return null;
            const parts = [];
            let total = 0;
            for (let i = 0; i < subCount; i++) {
                const sm = mesh.getSubMesh(i);
                if (!sm)
                    continue;
                const idx = sm.getIndices();
                if (!idx || idx.length === 0)
                    continue;
                parts.push(idx);
                total += idx.length;
            }
            if (total === 0)
                return null;
            const indices = new Uint32Array(total);
            let off = 0;
            for (const p of parts) {
                indices.set(p, off);
                off += p.length;
            }
            return { positions, indices };
        }
        catch (e) {
            console.warn("[VFX] getMeshTriangles failed", e);
            return null;
        }
    }
    function _rayTri(ox, oy, oz, dx, dy, dz, a, b, c) {
        const e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z;
        const e2x = c.x - a.x, e2y = c.y - a.y, e2z = c.z - a.z;
        const hx = dy * e2z - dz * e2y;
        const hy = dz * e2x - dx * e2z;
        const hz = dx * e2y - dy * e2x;
        const det = e1x * hx + e1y * hy + e1z * hz;
        if (Math.abs(det) < 1e-10)
            return null;
        const inv = 1 / det;
        const sx = ox - a.x, sy = oy - a.y, sz = oz - a.z;
        const u = (sx * hx + sy * hy + sz * hz) * inv;
        if (u < 0 || u > 1)
            return null;
        const qx = sy * e1z - sz * e1y;
        const qy = sz * e1x - sx * e1z;
        const qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1)
            return null;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        return t > 1e-6 ? t : null;
    }
    const _f16f32buf = new Float32Array(1);
    const _f16i32buf = new Int32Array(_f16f32buf.buffer);
    function _f32tof16(val) {
        _f16f32buf[0] = val;
        const x = _f16i32buf[0];
        let bits = (x >> 16) & 0x8000;
        let m = (x >> 12) & 0x07ff;
        const e = (x >> 23) & 0xff;
        if (e < 103)
            return bits;
        if (e > 142) {
            bits |= 0x7c00;
            return bits;
        }
        if (e < 113) {
            m |= 0x0800;
            bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
            return bits;
        }
        bits |= ((e - 112) << 10) | (m >> 1);
        bits += m & 1;
        return bits;
    }
    function _makePointTexture(data, count) {
        const half = new Uint16Array(count * 4);
        for (let i = 0; i < count * 4; i++)
            half[i] = _f32tof16(data[i]);
        const tex = new Laya.Texture2D(count, 1, Laya.TextureFormat.R16G16B16A16, false, false, false, false);
        tex.setPixelsData(new Uint8Array(half.buffer, half.byteOffset, half.byteLength), false, false);
        tex.wrapModeU = Laya.WrapMode.Clamp;
        tex.wrapModeV = Laya.WrapMode.Clamp;
        tex.filterMode = Laya.FilterMode.Point;
        return tex;
    }
    function _fallbackPointTexture() {
        const data = new Float32Array(4);
        data[3] = 1;
        return _makePointTexture(data, 1);
    }
    function _computeSurfacePointsData(mesh, count, scale) {
        const tri = getMeshTriangles(mesh);
        if (!tri || tri.indices.length < 3)
            return null;
        const { positions, indices } = tri;
        const triCount = (indices.length / 3) | 0;
        if (triCount <= 0)
            return null;
        const _S = (typeof scale === "number" && scale > 0) ? scale : 1;
        const data = new Float32Array(count * 4);
        for (let p = 0; p < count; p++) {
            const ti = Math.min((Math.random() * triCount) | 0, triCount - 1);
            const a = positions[indices[ti * 3]];
            const b = positions[indices[ti * 3 + 1]];
            const c = positions[indices[ti * 3 + 2]];
            if (!a || !b || !c)
                continue;
            let u = Math.random(), v = Math.random();
            if (u + v > 1) {
                u = 1 - u;
                v = 1 - v;
            }
            const w = 1 - u - v;
            data[p * 4] = (w * a.x + u * b.x + v * c.x) * _S;
            data[p * 4 + 1] = (w * a.y + u * b.y + v * c.y) * _S;
            data[p * 4 + 2] = (w * a.z + u * b.z + v * c.z) * _S;
            data[p * 4 + 3] = 1;
        }
        return data;
    }
    function _computeVolumePointsData(mesh, count, scale) {
        const _S = (typeof scale === "number" && scale > 0) ? scale : 1;
        const tri = getMeshTriangles(mesh);
        if (!tri || tri.indices.length < 3)
            return null;
        const { positions, indices } = tri;
        const triCount = (indices.length / 3) | 0;
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (const p of positions) {
            if (!p)
                continue;
            if (p.x < minX)
                minX = p.x;
            if (p.x > maxX)
                maxX = p.x;
            if (p.y < minY)
                minY = p.y;
            if (p.y > maxY)
                maxY = p.y;
            if (p.z < minZ)
                minZ = p.z;
            if (p.z > maxZ)
                maxZ = p.z;
        }
        if (!isFinite(minX))
            return null;
        const triA = new Array(triCount);
        const triB = new Array(triCount);
        const triC = new Array(triCount);
        for (let i = 0; i < triCount; i++) {
            triA[i] = positions[indices[i * 3]];
            triB[i] = positions[indices[i * 3 + 1]];
            triC[i] = positions[indices[i * 3 + 2]];
        }
        const data = new Float32Array(count * 4);
        let written = 0;
        const maxAttempts = count * 32;
        let attempts = 0;
        while (written < count && attempts < maxAttempts) {
            attempts++;
            const px = minX + Math.random() * (maxX - minX);
            const py = minY + Math.random() * (maxY - minY);
            const pz = minZ + Math.random() * (maxZ - minZ);
            let crossings = 0;
            for (let i = 0; i < triCount; i++) {
                const a = triA[i], b = triB[i], c = triC[i];
                if (!a || !b || !c)
                    continue;
                if (_rayTri(px, py, pz, 1, 0, 0, a, b, c) !== null)
                    crossings++;
            }
            if ((crossings & 1) === 1) {
                data[written * 4] = px * _S;
                data[written * 4 + 1] = py * _S;
                data[written * 4 + 2] = pz * _S;
                data[written * 4 + 3] = 1;
                written++;
            }
        }
        if (written === 0)
            return _computeSurfacePointsData(mesh, count, scale);
        for (let i = written; i < count; i++) {
            const src = (i % written) * 4;
            data[i * 4] = data[src];
            data[i * 4 + 1] = data[src + 1];
            data[i * 4 + 2] = data[src + 2];
            data[i * 4 + 3] = 1;
        }
        return data;
    }
    function _fallbackPointData(count) {
        const data = new Float32Array(count * 4);
        for (let i = 0; i < count; i++)
            data[i * 4 + 3] = 1;
        return data;
    }
    const MESH_CMUNIT_FALLBACK = { "e38d2d0d-ea52-4bc0-ae3f-09506c2cde20": 0.01 };
    function _resolveMeshScale(rawScale, uuid) {
        if (typeof rawScale === "number" && rawScale > 0 && rawScale !== 1)
            return rawScale;
        if (uuid) {
            const bare = String(uuid).replace(/^res:\/\//, "").replace(/@.*$/, "");
            if (MESH_CMUNIT_FALLBACK[bare])
                return MESH_CMUNIT_FALLBACK[bare];
        }
        return (typeof rawScale === "number" && rawScale > 0) ? rawScale : 1;
    }
    function bakeMeshSurfacePoints(mesh, count, scale) {
        const data = _computeSurfacePointsData(mesh, count, scale);
        if (!data)
            console.warn("[VFX] bakeMeshSurfacePoints: mesh has no triangles, fallback to single point");
        return data ? _makePointTexture(data, count) : _fallbackPointTexture();
    }
    function bakeMeshVolumePoints(mesh, count, scale) {
        const data = _computeVolumePointsData(mesh, count, scale);
        if (!data)
            console.warn("[VFX] bakeMeshVolumePoints: mesh has no triangles, fallback to single point");
        return data ? _makePointTexture(data, count) : _fallbackPointTexture();
    }
    function _makePointBuffer(data, count) {
        const buf = new Laya.DeviceBuffer(count * 16, Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST);
        buf.deviceBuffer.setData(data.buffer, 0, 0, count * 16);
        return buf;
    }
    function bakeMeshSurfacePointsBuffer(mesh, count, scale) {
        const data = _computeSurfacePointsData(mesh, count, scale) || _fallbackPointData(count);
        return _makePointBuffer(data, count);
    }
    function bakeMeshVolumePointsBuffer(mesh, count, scale) {
        const data = _computeVolumePointsData(mesh, count, scale) || _fallbackPointData(count);
        return _makePointBuffer(data, count);
    }
    function normalizePropertyType(raw) {
        const s = String(raw || "").toLowerCase();
        if (s === "number" || s === "float")
            return exports.VFXPropertyType.Float;
        if (s === "vec2" || s === "vector2")
            return exports.VFXPropertyType.Vec2;
        if (s === "vec3" || s === "vector3")
            return exports.VFXPropertyType.Vec3;
        if (s === "vec4" || s === "vector4")
            return exports.VFXPropertyType.Vec4;
        if (s === "color")
            return exports.VFXPropertyType.Color;
        if (s === "gradient")
            return exports.VFXPropertyType.Gradient;
        if (s === "texture2d")
            return exports.VFXPropertyType.Texture2D;
        return exports.VFXPropertyType.Float;
    }
    const EventAttributeTypeMap = {
        "Bool": exports.VFXEventAttributeType.Bool,
        "Int": exports.VFXEventAttributeType.Int,
        "Uint": exports.VFXEventAttributeType.Uint,
        "Float": exports.VFXEventAttributeType.Float,
        "Vector2": exports.VFXEventAttributeType.Vector2,
        "Vector3": exports.VFXEventAttributeType.Vector3,
        "Vector4": exports.VFXEventAttributeType.Vector4,
    };
    function getDescMap(desc) {
        if (!desc)
            return null;
        return desc.map(attr => ({
            name: attr.name,
            type: EventAttributeTypeMap[attr.type],
        }));
    }

    class VFXFrameTime {
        constructor() {
            this.fixedDeltaTime = 0;
            this.deltaTime = 0;
            this.timeStepCount = 0;
            this.unscaledDeltaTime = 0;
            this.unscaledFixedDeltaTime = 0;
            this.unscaledTimeStepCount = 0;
            this.timeAccum = 0;
            this.unscaledTimeAccum = 0;
        }
        computeStepCount(fixedTimeStep, maxFixedStepCount, currentDeltaTime, maxDeltaTime) {
            this.timeAccum += currentDeltaTime;
            let signedStepCount = Math.round(this.timeAccum / fixedTimeStep);
            this.timeStepCount = Math.min(Math.max(signedStepCount, 0), maxFixedStepCount);
            this.timeAccum -= this.timeStepCount * fixedTimeStep;
            currentDeltaTime = Laya.MathUtil.clamp(currentDeltaTime, 0, maxDeltaTime);
        }
        computeUnscaledStepCount(fixedTimeStep, maxFixedStepCount, currentUnscaledDeltaTime, maxDeltaTime) {
            this.unscaledTimeAccum += currentUnscaledDeltaTime;
            let signedStepCount = Math.round(this.unscaledTimeAccum / fixedTimeStep);
            this.unscaledTimeStepCount = Math.min(Math.max(signedStepCount, 0), maxFixedStepCount);
            this.unscaledTimeAccum -= this.unscaledTimeStepCount * fixedTimeStep;
            currentUnscaledDeltaTime = Laya.MathUtil.clamp(currentUnscaledDeltaTime, 0, maxDeltaTime);
        }
    }

    class ShaderExpressionEvaluator {
        static evaluate(graph, ctx) {
            if (!graph || !graph.nodes || !graph.rootNodeId)
                return null;
            const cache = {};
            return this._evalNode(graph.rootNodeId, graph.nodes, cache, ctx);
        }
        static _evalNode(id, nodes, cache, ctx) {
            var _a, _b, _c, _d;
            if (cache[id] !== undefined)
                return cache[id];
            const n = nodes[id];
            if (!n)
                return null;
            let result = null;
            switch (n.kind) {
                case "Constant":
                    result = n.value;
                    break;
                case "VFXParameter": {
                    const pv = ctx.propertyValues && n.exposedName ? ctx.propertyValues.get(n.exposedName) : null;
                    if (pv) {
                        if (pv.rawGradientStops && pv.rawGradientStops.length > 0) {
                            result = { __layaGradientStops: pv.rawGradientStops };
                        }
                        else if (pv.rawCurveFrames && pv.rawCurveFrames.length > 0) {
                            result = { __layaCurveFrames: pv.rawCurveFrames };
                        }
                        else if (pv.value && pv.value.length > 0) {
                            const v = pv.value;
                            result = pv.value.length === 1 ? Number(v[0]) || 0 : { r: (_a = v[0]) !== null && _a !== void 0 ? _a : 0, g: (_b = v[1]) !== null && _b !== void 0 ? _b : 0, b: (_c = v[2]) !== null && _c !== void 0 ? _c : 0, a: (_d = v[3]) !== null && _d !== void 0 ? _d : 0 };
                        }
                        else if (pv.cached != null) {
                            result = pv.cached;
                        }
                        else {
                            result = undefined;
                        }
                    }
                    else {
                        result = undefined;
                    }
                    break;
                }
                case "VFXTotalTime":
                case "VFXTime":
                    result = ctx.totalTime;
                    break;
                case "VFXDeltaTime":
                    result = ctx.deltaTime;
                    break;
                case "VFXFrameIndex":
                    result = Math.floor(ctx.totalTime * 60);
                    break;
                case "GlobalTimeRatio":
                    result = ((n.continuous != null) ? n.continuous : ctx.hasContinuousSpawn)
                        ? (ctx.totalTime - Math.floor(ctx.totalTime))
                        : Math.min(ctx.totalTime / (n.duration || 1), 1);
                    break;
                case "Random": {
                    const min = Number(this._evalNode(n.inputs[0], nodes, cache, ctx)) || 0;
                    const max = Number(this._evalNode(n.inputs[1], nodes, cache, ctx)) || 1;
                    const seed = n.inputs.length > 2 ? Number(this._evalNode(n.inputs[2], nodes, cache, ctx)) || 0 : 0;
                    const t = ctx.totalTime + seed * 13.7;
                    const r = Math.abs(Math.sin(t * 12.9898) * 43758.5453) % 1;
                    result = min + (max - min) * r;
                    break;
                }
                case "SampleGradient": {
                    const grad = this._evalNode(n.inputs[0], nodes, cache, ctx);
                    const t = Number(this._evalNode(n.inputs[1], nodes, cache, ctx)) || 0;
                    result = this._sampleGradient(grad, t);
                    break;
                }
                case "SampleCurve": {
                    const curve = this._evalNode(n.inputs[0], nodes, cache, ctx);
                    const timeNode = nodes[n.inputs[1]];
                    if (timeNode && timeNode.kind === "Constant" && timeNode.slotName === ShaderExpressionEvaluator.AGE_MEDIAN_SLOT_NAME) {
                        result = this._sampleCurveAverage(curve);
                    }
                    else {
                        const t = Number(this._evalNode(n.inputs[1], nodes, cache, ctx)) || 0;
                        result = this._sampleCurve(curve, t);
                    }
                    break;
                }
                case "Add":
                case "Sub":
                case "Mul":
                case "Div":
                case "Mod": {
                    const a = this._evalNode(n.inputs[0], nodes, cache, ctx);
                    const b = this._evalNode(n.inputs[1], nodes, cache, ctx);
                    result = this._binOp(n.kind, a, b);
                    break;
                }
                case "Lerp": {
                    const x = this._evalNode(n.inputs[0], nodes, cache, ctx);
                    const y = this._evalNode(n.inputs[1], nodes, cache, ctx);
                    const s = Number(this._evalNode(n.inputs[2], nodes, cache, ctx)) || 0;
                    result = this._lerp(x, y, s);
                    break;
                }
                case "Sin":
                    result = Math.sin(Number(this._evalNode(n.inputs[0], nodes, cache, ctx)) || 0);
                    break;
                case "Cos":
                    result = Math.cos(Number(this._evalNode(n.inputs[0], nodes, cache, ctx)) || 0);
                    break;
                case "Frac": {
                    const x = Number(this._evalNode(n.inputs[0], nodes, cache, ctx)) || 0;
                    result = x - Math.floor(x);
                    break;
                }
                case "Abs":
                    result = Math.abs(Number(this._evalNode(n.inputs[0], nodes, cache, ctx)) || 0);
                    break;
                case "Neg":
                    result = -(Number(this._evalNode(n.inputs[0], nodes, cache, ctx)) || 0);
                    break;
                case "Saturate": {
                    const x = Number(this._evalNode(n.inputs[0], nodes, cache, ctx)) || 0;
                    result = Math.max(0, Math.min(1, x));
                    break;
                }
                case "CombineVec2": {
                    const x = Number(this._evalNode(n.inputs[0], nodes, cache, ctx)) || 0;
                    const y = Number(this._evalNode(n.inputs[1], nodes, cache, ctx)) || 0;
                    result = { x, y };
                    break;
                }
                case "CombineVec3": {
                    const x = Number(this._evalNode(n.inputs[0], nodes, cache, ctx)) || 0;
                    const y = Number(this._evalNode(n.inputs[1], nodes, cache, ctx)) || 0;
                    const z = Number(this._evalNode(n.inputs[2], nodes, cache, ctx)) || 0;
                    result = { x, y, z };
                    break;
                }
                case "CombineVec4": {
                    const x = Number(this._evalNode(n.inputs[0], nodes, cache, ctx)) || 0;
                    const y = Number(this._evalNode(n.inputs[1], nodes, cache, ctx)) || 0;
                    const z = Number(this._evalNode(n.inputs[2], nodes, cache, ctx)) || 0;
                    const w = Number(this._evalNode(n.inputs[3], nodes, cache, ctx)) || 0;
                    result = { x, y, z, w };
                    break;
                }
                default:
                    result = null;
            }
            cache[id] = result;
            return result;
        }
        static _sampleGradient(g, t) {
            if (!g)
                return null;
            const clamp = Math.max(0, Math.min(1, t));
            if (g.__layaGradientStops && Array.isArray(g.__layaGradientStops) && g.__layaGradientStops.length > 0) {
                const stops = g.__layaGradientStops;
                let s0 = stops[0], s1 = stops[stops.length - 1];
                for (let i = 0; i < stops.length - 1; i++) {
                    if (clamp >= stops[i].t && clamp <= stops[i + 1].t) {
                        s0 = stops[i];
                        s1 = stops[i + 1];
                        break;
                    }
                }
                const denom = (s1.t - s0.t) || 1;
                const u = Math.max(0, Math.min(1, (clamp - s0.t) / denom));
                const c0 = s0.color || [1, 1, 1, 1];
                const c1 = s1.color || [1, 1, 1, 1];
                return {
                    r: c0[0] + (c1[0] - c0[0]) * u,
                    g: c0[1] + (c1[1] - c0[1]) * u,
                    b: c0[2] + (c1[2] - c0[2]) * u,
                    a: c0[3] + (c1[3] - c0[3]) * u,
                };
            }
            if (!g.colorKeys || g.colorKeys.length === 0)
                return { r: 1, g: 1, b: 1, a: 1 };
            const keys = g.colorKeys;
            const aKeys = g.alphaKeys || [{ alpha: 1, time: 0 }];
            const mode = g.mode || 0;
            let c0 = keys[0], c1 = keys[keys.length - 1];
            for (let i = 0; i < keys.length - 1; i++) {
                if (clamp >= keys[i].time && clamp <= keys[i + 1].time) {
                    c0 = keys[i];
                    c1 = keys[i + 1];
                    break;
                }
            }
            const denom = (c1.time - c0.time) || 1;
            const u = mode === 1 ? 0 : Math.max(0, Math.min(1, (clamp - c0.time) / denom));
            const r = c0.color.r + (c1.color.r - c0.color.r) * u;
            const g_ = c0.color.g + (c1.color.g - c0.color.g) * u;
            const b = c0.color.b + (c1.color.b - c0.color.b) * u;
            let a0 = aKeys[0], a1 = aKeys[aKeys.length - 1];
            for (let i = 0; i < aKeys.length - 1; i++) {
                if (clamp >= aKeys[i].time && clamp <= aKeys[i + 1].time) {
                    a0 = aKeys[i];
                    a1 = aKeys[i + 1];
                    break;
                }
            }
            const aDenom = (a1.time - a0.time) || 1;
            const au = mode === 1 ? 0 : Math.max(0, Math.min(1, (clamp - a0.time) / aDenom));
            const a = a0.alpha + (a1.alpha - a0.alpha) * au;
            return { r, g: g_, b, a };
        }
        static _sampleCurve(c, t) {
            if (!c)
                return null;
            if (!c.frames || c.frames.length === 0)
                return 0;
            if (c.frames.length === 1)
                return c.frames[0].value;
            const clamp = Math.max(c.frames[0].time, Math.min(c.frames[c.frames.length - 1].time, t));
            let f0 = c.frames[0], f1 = c.frames[c.frames.length - 1];
            for (let i = 0; i < c.frames.length - 1; i++) {
                if (clamp >= c.frames[i].time && clamp <= c.frames[i + 1].time) {
                    f0 = c.frames[i];
                    f1 = c.frames[i + 1];
                    break;
                }
            }
            const denom = (f1.time - f0.time) || 1;
            const u = (clamp - f0.time) / denom;
            return f0.value + (f1.value - f0.value) * u;
        }
        static _sampleCurveAverage(c) {
            if (!c || !c.frames || c.frames.length === 0)
                return 0;
            if (c.frames.length === 1)
                return c.frames[0].value;
            const N = this.CURVE_AVERAGE_SAMPLE_COUNT;
            let sum = 0;
            for (let i = 0; i < N; i++)
                sum += this._sampleCurve(c, (i + 0.5) / N);
            return sum / N;
        }
        static _binOp(kind, a, b) {
            const isVec = (v) => v && typeof v === "object" && ("r" in v || "x" in v);
            if (isVec(a) || isVec(b)) {
                const getC = (v, k) => {
                    if (typeof v === "number")
                        return v;
                    if (k === "r" || k === "x")
                        return v.r !== undefined ? v.r : v.x;
                    if (k === "g" || k === "y")
                        return v.g !== undefined ? v.g : v.y;
                    if (k === "b" || k === "z")
                        return v.b !== undefined ? v.b : v.z;
                    if (k === "a" || k === "w")
                        return v.a !== undefined ? v.a : v.w;
                    return 0;
                };
                const op = (x, y) => kind === "Add" ? x + y : kind === "Sub" ? x - y : kind === "Mul" ? x * y : kind === "Div" ? (y !== 0 ? x / y : 0) : kind === "Mod" ? x - y * Math.floor(x / (y || 1)) : 0;
                return {
                    r: op(getC(a, "r"), getC(b, "r")),
                    g: op(getC(a, "g"), getC(b, "g")),
                    b: op(getC(a, "b"), getC(b, "b")),
                    a: op(getC(a, "a"), getC(b, "a")),
                };
            }
            const x = Number(a) || 0, y = Number(b) || 0;
            switch (kind) {
                case "Add": return x + y;
                case "Sub": return x - y;
                case "Mul": return x * y;
                case "Div": return y !== 0 ? x / y : 0;
                case "Mod": return x - y * Math.floor(x / (y || 1));
            }
            return 0;
        }
        static _lerp(x, y, s) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            const isVec = (v) => v && typeof v === "object";
            if (isVec(x)) {
                return {
                    r: ((_b = (_a = x.r) !== null && _a !== void 0 ? _a : x.x) !== null && _b !== void 0 ? _b : 0) * (1 - s) + ((_d = (_c = y.r) !== null && _c !== void 0 ? _c : y.x) !== null && _d !== void 0 ? _d : 0) * s,
                    g: ((_f = (_e = x.g) !== null && _e !== void 0 ? _e : x.y) !== null && _f !== void 0 ? _f : 0) * (1 - s) + ((_h = (_g = y.g) !== null && _g !== void 0 ? _g : y.y) !== null && _h !== void 0 ? _h : 0) * s,
                    b: ((_k = (_j = x.b) !== null && _j !== void 0 ? _j : x.z) !== null && _k !== void 0 ? _k : 0) * (1 - s) + ((_m = (_l = y.b) !== null && _l !== void 0 ? _l : y.z) !== null && _m !== void 0 ? _m : 0) * s,
                    a: ((_p = (_o = x.a) !== null && _o !== void 0 ? _o : x.w) !== null && _p !== void 0 ? _p : 0) * (1 - s) + ((_r = (_q = y.a) !== null && _q !== void 0 ? _q : y.w) !== null && _r !== void 0 ? _r : 0) * s,
                };
            }
            return (Number(x) || 0) * (1 - s) + (Number(y) || 0) * s;
        }
        static toVector4(v, out) {
            if (!out)
                out = new Laya.Vector4();
            if (typeof v === "number") {
                out.setValue(v, v, v, v);
            }
            else if (v && typeof v === "object") {
                out.setValue(v.r !== undefined ? v.r : (v.x !== undefined ? v.x : 0), v.g !== undefined ? v.g : (v.y !== undefined ? v.y : 0), v.b !== undefined ? v.b : (v.z !== undefined ? v.z : 0), v.a !== undefined ? v.a : (v.w !== undefined ? v.w : 0));
            }
            return out;
        }
    }
    ShaderExpressionEvaluator.AGE_MEDIAN_SLOT_NAME = "ageMedian";
    ShaderExpressionEvaluator.CURVE_AVERAGE_SAMPLE_COUNT = 32;

    class VFXState {
        constructor() {
            this.deltaTime = 0;
            this.unscaledDeltaTime = 0;
            this.totalTime = 0;
            this.playRate = 1.0;
            this.systemSeed = 0;
        }
    }

    const globalRand = new Laya.Rand((Math.random() * 0xFFFFFFFF) >>> 0);
    const _tempCamForward = new Laya.Vector3();
    const _tempCamUp = new Laya.Vector3();
    class VisualEffect extends Laya.Script {
        get asset() {
            return this._asset;
        }
        set asset(value) {
            if (this._asset === value)
                return;
            this.releaseAssetData();
            this._asset = value;
            if (this._asset) {
                this._asset._addReference();
                this.initialEvent = this._asset.initialEventName;
                const supportedCompute = Laya.LayaGL.renderEngine.getCapable(Laya.RenderCapable.ComputeShader);
                if (supportedCompute) {
                    this.createAssetData();
                    this.initAssetData();
                }
            }
        }
        get initialEvent() {
            return this._initialEvent;
        }
        set initialEvent(value) {
            if (!value)
                value = (this._asset && this._asset.initialEventName) || "OnPlay";
            this._initialEvent = value;
            this.initialEventID = Laya.Shader3D.propertyNameToID(this._initialEvent);
        }
        get mainCamera() {
            return this._mainCamera;
        }
        set mainCamera(value) {
            this._mainCamera = value;
        }
        setSkinnedMeshSource(name, renderer) {
            this._skinnedMeshSources.set(name, renderer);
            this._skinnedMeshVertexBaked.delete(name);
        }
        clearSkinnedMeshSource(name) {
            this._skinnedMeshSources.delete(name);
            this._skinnedMeshVertexBaked.delete(name);
            const tex = this._skinnedMeshBoneTextures.get(name);
            if (tex)
                tex.destroy();
            this._skinnedMeshBoneTextures.delete(name);
        }
        setTransformSource(name, node) {
            this._transformSources.set(name, node);
        }
        clearTransformSource(name) {
            this._transformSources.delete(name);
        }
        setCustomSpawnCallback(name, callback) {
            this._customSpawnCallbacks.set(name, callback);
        }
        clearCustomSpawnCallback(name) {
            this._customSpawnCallbacks.delete(name);
        }
        getCustomSpawnCallback(name) {
            return this._customSpawnCallbacks.get(name);
        }
        createAssetData() {
            const asset = this.asset;
            asset.systems.forEach((desc, index) => {
                var _a, _b;
                switch (desc.type) {
                    case exports.VFXSystemType.Spawner: {
                        const spawnerDesc = desc;
                        const spawnerSystem = new VFXSpawnerSystem();
                        spawnerSystem.effect = this;
                        spawnerSystem.desc = spawnerDesc;
                        spawnerSystem.settings.delayBeforeLoop = spawnerDesc.delayBeforeLoop;
                        spawnerSystem.settings.delayAfterLoop = spawnerDesc.delayAfterLoop;
                        spawnerSystem.onPlayInputs.push(...spawnerDesc.onPlayInputs);
                        spawnerSystem.onStopInputs.push(...spawnerDesc.onStopInputs);
                        spawnerDesc.tasks.forEach(taskDesc => {
                            let task;
                            switch (taskDesc.type) {
                                case exports.VFXSpawnerTaskType.ConstantRate: {
                                    const constantRateDesc = taskDesc;
                                    const constantRateTask = task = new VFXSpawnerConstantRate();
                                    constantRateTask.rate = constantRateDesc.rate;
                                    break;
                                }
                                case exports.VFXSpawnerTaskType.SingleBurst: {
                                    const singleBurstDesc = taskDesc;
                                    const singleBurstTask = task = new VFXSpawnerSingleBurst();
                                    singleBurstTask.delay = singleBurstDesc.delay;
                                    singleBurstTask.count = singleBurstDesc.count;
                                    singleBurstTask.countFromLoopIndex = singleBurstDesc.countFromLoopIndex;
                                    singleBurstTask.countModulo = singleBurstDesc.countModulo;
                                    break;
                                }
                                case exports.VFXSpawnerTaskType.PeriodicBurst: {
                                    const periodicBurstDesc = taskDesc;
                                    const periodicBurstTask = task = new VFXSpawnerPeriodicBurst();
                                    periodicBurstTask.delay = periodicBurstDesc.delay;
                                    periodicBurstTask.count = periodicBurstDesc.count;
                                    break;
                                }
                                case exports.VFXSpawnerTaskType.SpawnOverDistance: {
                                    const spawnOverDistanceDesc = taskDesc;
                                    const spawnOverDistanceTask = task = new VFXSpawnerOverDistance();
                                    spawnOverDistanceTask.distance = spawnOverDistanceDesc.distance;
                                    spawnOverDistanceTask.owner = this.owner;
                                    break;
                                }
                                case exports.VFXSpawnerTaskType.CustomWrapper: {
                                    const customDesc = taskDesc;
                                    const customTask = task = new VFXSpawnerCustomWrapper();
                                    customTask.callbackName = customDesc.callbackName;
                                    customTask.effect = this;
                                    break;
                                }
                                case exports.VFXSpawnerTaskType.SetEventAttribute: {
                                    const sd = taskDesc;
                                    const t = task = new VFXSpawnerSetEventAttribute();
                                    t.attribute = sd.attribute;
                                    t.value = sd.value && sd.value.length === 4 ? sd.value : [0, 0, 0, 0];
                                    t.fromLoopIndex = !!sd.fromLoopIndex;
                                    t.loopIndexModulo = sd.loopIndexModulo || 0;
                                    t.fromSpawnStateLoop = !!sd.fromSpawnStateLoop;
                                    break;
                                }
                            }
                            spawnerSystem.tasks.push(task);
                        });
                        this.systems.push(spawnerSystem);
                        break;
                    }
                    case exports.VFXSystemType.Particle: {
                        const particleDesc = desc;
                        const particleSystem = new VFXParticleSystem();
                        particleSystem.effect = this;
                        particleSystem.initializeShader = particleDesc.initializeShader;
                        particleSystem.updateShader = particleDesc.updateShader;
                        particleSystem.outputShader = particleDesc.outputShader;
                        particleSystem.capacity = particleDesc.capacity;
                        particleSystem.attributeBytesPerParticle = particleDesc.attributeBytesPerParticle;
                        particleSystem.outputType = particleDesc.outputType || "outputMesh";
                        particleSystem.particlePerStripCount = particleDesc.particlePerStripCount;
                        particleSystem.stripCapacity = (_a = particleDesc.stripCapacity) !== null && _a !== void 0 ? _a : 1;
                        particleSystem.mesh = particleDesc.mesh;
                        particleSystem.spawnerSystems.push(...particleDesc.spawnerSystems);
                        particleSystem.receiveGPUEvent = particleDesc.receiveGPUEvent;
                        particleSystem.gpuEventInput = particleDesc.gpuEventInput;
                        if (particleDesc.outputEvents && particleDesc.outputEvents.length > 0) {
                            particleSystem.outputEventDescs = particleDesc.outputEvents.slice();
                        }
                        particleSystem.simulateSpace = particleDesc.simulateSpace;
                        particleSystem.boundsMode = particleDesc.boundsMode;
                        particleSystem.boundsCenter = particleDesc.boundsCenter;
                        particleSystem.boundsExtents = particleDesc.boundsExtents;
                        particleSystem.blendMode = particleDesc.blendMode;
                        particleSystem.softParticleFade = particleDesc.softParticleFade;
                        particleSystem.uvMode = particleDesc.uvMode;
                        particleSystem.flipbookSize = particleDesc.flipbookSize;
                        particleSystem.mainTexture = particleDesc.mainTexture || "";
                        particleSystem.subpixelAA = particleDesc.subpixelAA;
                        particleSystem.customShaderName = particleDesc.customShaderName;
                        particleSystem.shaderPropertyBindings = particleDesc.shaderPropertyBindings || null;
                        particleSystem.shaderPropertyDefaults = particleDesc.shaderPropertyDefaults || null;
                        particleSystem.shaderPropertyExpressions = particleDesc.shaderPropertyExpressions || null;
                        particleSystem.billboardPrimitive = particleDesc.billboardPrimitive;
                        particleSystem.billboardVertexCount = particleDesc.billboardVertexCount;
                        particleSystem.distortionMode = particleDesc.distortionMode || "Procedural";
                        particleSystem.billboardCropFactor = particleDesc.billboardCropFactor;
                        particleSystem.useAlphaClipping = particleDesc.useAlphaClipping || false;
                        particleSystem.alphaThreshold = (_b = particleDesc.alphaThreshold) !== null && _b !== void 0 ? _b : 0.5;
                        particleSystem.stripColorMapping = particleDesc.stripColorMapping || "Default";
                        particleSystem.stripUvScale = particleDesc.stripUvScale || { x: 1, y: 1 };
                        particleSystem.stripUvBias = particleDesc.stripUvBias || { x: 0, y: 0 };
                        particleSystem.stripGradientStops = particleDesc.stripGradientStops || [];
                        particleSystem.stripTilingMode = particleDesc.tilingMode || "Stretch";
                        if (particleDesc.prepareDispatchShader) {
                            particleSystem.prepareDispatchShader = particleDesc.prepareDispatchShader;
                        }
                        if (particleDesc.updateStripsShader) {
                            particleSystem.updateStripsShader = particleDesc.updateStripsShader;
                            particleSystem.updateStripsDatas = [Laya.LayaGL.renderDeviceFactory.createShaderData()];
                        }
                        if (particleDesc.outputType === "outputTrail" || particleDesc.outputType === "outputParticleStripSGQuad") {
                            particleSystem.useStripRingBuffer = true;
                        }
                        if (particleDesc.extraOutputs && particleDesc.extraOutputs.length > 0) {
                            for (const extraDesc of particleDesc.extraOutputs) {
                                if (!extraDesc.outputShader)
                                    continue;
                                const isStripExtra = extraDesc.outputType === "outputTrail" || extraDesc.outputType === "outputParticleStripSGQuad";
                                const renderStride = isStripExtra ? 128 : (5 * 16);
                                const renderUsage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST | Laya.EDeviceBufferUsage.VERTEX;
                                const extraRenderBuffer = new Laya.DeviceBuffer(renderStride * particleDesc.capacity, renderUsage);
                                extraRenderBuffer.vertexBuffer.vertexDeclaration = isStripExtra ? VFXStripGeometry.StripVertexDecl : VFXGeometry.ParticleDecl;
                                extraRenderBuffer.vertexBuffer.instanceBuffer = !isStripExtra;
                                const indirectUsage = Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.INDIRECT | Laya.EDeviceBufferUsage.COPY_DST;
                                const extraIndirectBuffer = new Laya.DeviceBuffer(20, indirectUsage);
                                const extraOutputDatas = [Laya.LayaGL.renderDeviceFactory.createShaderData()];
                                particleSystem.extraOutputs.push({
                                    outputShader: extraDesc.outputShader,
                                    outputDatas: extraOutputDatas,
                                    renderBuffer: extraRenderBuffer,
                                    indirectBuffer: extraIndirectBuffer,
                                    geometry: null,
                                    outputType: extraDesc.outputType,
                                    blendMode: extraDesc.blendMode,
                                    softParticleFade: extraDesc.softParticleFade,
                                    uvMode: extraDesc.uvMode,
                                    flipbookSize: extraDesc.flipbookSize,
                                    mainTexture: extraDesc.mainTexture || "",
                                    subpixelAA: extraDesc.subpixelAA,
                                    customShaderName: extraDesc.customShaderName,
                                    mesh: extraDesc.mesh || Laya.PrimitiveMesh.createSphere(0.5, 12, 12),
                                    billboardPrimitive: extraDesc.billboardPrimitive,
                                    billboardVertexCount: extraDesc.billboardVertexCount,
                                    billboardCropFactor: extraDesc.billboardCropFactor,
                                    useAlphaClipping: extraDesc.useAlphaClipping,
                                    alphaThreshold: extraDesc.alphaThreshold,
                                    tilingMode: extraDesc.tilingMode || "Stretch",
                                    colorMapping: extraDesc.colorMapping || "Default",
                                    uvScale: extraDesc.uvScale,
                                    uvBias: extraDesc.uvBias,
                                });
                            }
                        }
                        this.systems.push(particleSystem);
                        break;
                    }
                    case exports.VFXSystemType.StaticMesh: {
                        const staticDesc = desc;
                        const staticSys = new VFXStaticMeshSystem();
                        staticSys.effect = this;
                        staticSys.desc = staticDesc;
                        this.systems.push(staticSys);
                        break;
                    }
                }
            });
            this.eventQueue = new VFXEventQueue(100);
        }
        initAssetData() {
            for (let system of this.systems) {
                system.init();
            }
            this.state.totalTime = 0;
            if (this.resetSeedOnPlay) {
                this.currentSeed = globalRand.getUint();
            }
            else {
                this.currentSeed = this.randomSeed;
            }
            this.rand.seed = this.currentSeed;
            this.eventQueue.push(this.initialEventID, exports.VFXEventType.Initialize);
            this.globalEventAttribute = this.createEmptyEventAttribute();
            this.globalEventAttribute.setFloat("spawnCount", 1);
            this.globalEventAttribute.setVector4("color", 1, 1, 1, 1);
            this.globalEventAttribute.setVector3("velocity", 0, 0, 0);
            this._propertyValues.clear();
            for (const prop of this.asset.properties) {
                const id = Laya.Shader3D.propertyNameToID(prop.uniform);
                const v = prop.default;
                let cached = null;
                switch (prop.type) {
                    case exports.VFXPropertyType.Vec2:
                        cached = new Laya.Vector2(v[0], v[1]);
                        break;
                    case exports.VFXPropertyType.Vec3:
                        cached = new Laya.Vector3(v[0], v[1], v[2]);
                        break;
                    case exports.VFXPropertyType.Vec4:
                        cached = new Laya.Vector4(v[0], v[1], v[2], v[3]);
                        break;
                    case exports.VFXPropertyType.Color:
                        cached = new Laya.Vector4(v[0], v[1], v[2], v[3]);
                        break;
                    case exports.VFXPropertyType.Gradient:
                        cached = bakeGradientTexture(prop.gradientStops || []);
                        break;
                    case exports.VFXPropertyType.Texture2D:
                        cached = prop.texture;
                        break;
                }
                this._propertyValues.set(prop.name, {
                    id,
                    type: prop.type,
                    value: Array.isArray(v) ? [...v] : [],
                    cached,
                    defaultCached: cached,
                    defaultRawGradientStops: prop.type === exports.VFXPropertyType.Gradient ? (prop.gradientStops || []) : undefined,
                    rawGradientStops: prop.type === exports.VFXPropertyType.Gradient ? (prop.gradientStops || []) : undefined,
                    rawCurveFrames: prop.type === exports.VFXPropertyType.Curve ? (prop.curveFrames || []) : undefined,
                });
                if ((prop.type === exports.VFXPropertyType.Gradient || prop.type === exports.VFXPropertyType.Texture2D) && cached) {
                    for (const sys of this.systems) {
                        if (sys instanceof VFXParticleSystem) {
                            const bindings = sys.shaderPropertyBindings;
                            const shaderUniformName = bindings ? bindings[prop.name] : null;
                            const aliasIds = shaderUniformName
                                ? [id, Laya.Shader3D.propertyNameToID(shaderUniformName)]
                                : [id];
                            for (const sd of sys.getAllShaderDatas()) {
                                for (const aid of aliasIds)
                                    sd.setTexture(aid, cached);
                            }
                        }
                    }
                }
            }
            for (const sys of this.systems) {
                if (!(sys instanceof VFXParticleSystem))
                    continue;
                const defaults = sys.shaderPropertyDefaults;
                if (!defaults)
                    continue;
                const allDatas = sys.getAllShaderDatas().slice();
                const customShaderName = sys.customShaderName;
                const blendMode = sys.blendMode || "Alpha";
                if (customShaderName) {
                    const variant = VisualEffect._matVariantOf(sys);
                    const mat = VFXRenderer.getCustomShaderMaterial(customShaderName, blendMode, sys.matInstanceKey || "", variant);
                    if (mat && mat.shaderData && allDatas.indexOf(mat.shaderData) === -1)
                        allDatas.push(mat.shaderData);
                }
                for (const uniformName in defaults) {
                    const entry = defaults[uniformName];
                    if (!entry || !entry.texture)
                        continue;
                    const ids = [Laya.Shader3D.propertyNameToID(uniformName)];
                    if (uniformName.startsWith("_"))
                        ids.push(Laya.Shader3D.propertyNameToID(uniformName.substring(1)));
                    const noUnderscoreTex = uniformName.replace(/_/g, "");
                    if (noUnderscoreTex !== uniformName && noUnderscoreTex !== uniformName.substring(1))
                        ids.push(Laya.Shader3D.propertyNameToID(noUnderscoreTex));
                    for (const sd of allDatas) {
                        for (const aid of ids)
                            sd.setTexture(aid, entry.texture);
                    }
                }
            }
            this.applyCurveUniforms();
            this._applyPropertyOverrides();
        }
        _applyPropertyOverrides() {
            if (this.asset && this._propertyValues) {
                for (const prop of this.asset.properties) {
                    const entry = this._propertyValues.get(prop.name);
                    if (!entry)
                        continue;
                    if (Array.isArray(prop.default) && Array.isArray(entry.value)) {
                        for (let i = 0; i < entry.value.length && i < prop.default.length; i++)
                            entry.value[i] = prop.default[i];
                    }
                    if (entry.type === exports.VFXPropertyType.Gradient || entry.type === exports.VFXPropertyType.Texture2D) {
                        if (entry.defaultCached !== undefined) {
                            entry.cached = entry.defaultCached;
                            if (entry.type === exports.VFXPropertyType.Gradient)
                                entry.rawGradientStops = entry.defaultRawGradientStops;
                            this._bindPropertyTextureToShaders(prop.name, entry.id, entry.cached);
                        }
                    }
                }
            }
            if (!this.propertyOverrides)
                return;
            let overrides;
            try {
                overrides = typeof this.propertyOverrides === "string"
                    ? JSON.parse(this.propertyOverrides)
                    : this.propertyOverrides;
            }
            catch (e) {
                console.warn("[VFX] failed to parse propertyOverrides JSON:", e);
                return;
            }
            if (!overrides || typeof overrides !== "object")
                return;
            for (const name in overrides) {
                const value = overrides[name];
                if (Array.isArray(value)) {
                    switch (value.length) {
                        case 1:
                            this.setPropertyFloat(name, value[0]);
                            break;
                        case 2:
                            this.setPropertyVec2(name, value[0], value[1]);
                            break;
                        case 3:
                            this.setPropertyVec3(name, value[0], value[1], value[2]);
                            break;
                        case 4:
                            this.setPropertyVec4(name, value[0], value[1], value[2], value[3]);
                            break;
                    }
                }
                else if (typeof value === "string" && value) {
                    const _entry = this._propertyValues.get(name);
                    if (_entry && String(_entry.type).toLowerCase() === "mesh") {
                        this.setPropertyMesh(name, value);
                    }
                    else {
                        this.setPropertyTexture(name, value);
                    }
                }
                else if (value && typeof value === "object" && Array.isArray(value.stops)) {
                    this.setPropertyGradient(name, value.stops);
                }
            }
        }
        releaseAssetData() {
            for (let system of this.systems) {
                system.release();
            }
            this.systems = [];
            if (this.globalEventAttribute) {
                this.globalEventAttribute.destroy();
                this.globalEventAttribute = null;
            }
            if (this._stripNode) {
                this._stripNode.destroy();
                this._stripNode = null;
                this._stripRenderer = null;
            }
            if (this._asset) {
                this._asset._removeReference();
                this._asset = null;
            }
        }
        constructor() {
            super();
            this.randomSeed = 0;
            this.propertyOverrides = "{}";
            this.currentSeed = 0;
            this.rand = new Laya.Rand(0);
            this.resetSeedOnPlay = true;
            this.frameTime = new VFXFrameTime();
            this.cmd = new Laya.ComputeCommandBuffer();
            this.systems = [];
            this.playRate = 1.0;
            this.state = new VFXState();
            this.outputEventReceived = null;
            this._customSpawnCallbacks = new Map();
            this._skinnedMeshSources = new Map();
            this._skinnedMeshBoneTextures = new Map();
            this._skinnedMeshVertexBaked = new Set();
            this._transformSources = new Map();
            this._invEmitterWorldMatrix = new Laya.Matrix4x4();
            this._propertyValues = new Map();
            this._tmpExprVec4 = new Laya.Vector4();
            this._pause = false;
            this.initialEvent = "OnPlay";
        }
        static _matVariantOf(sys) {
            const t = sys.outputType;
            return (t === "outputTrail" || t === "outputParticleStripSGQuad" || t === "outputPoint" || t === "outputLine" || t === "outputLineStrip")
                ? "strip" : "instanced";
        }
        onStart() {
        }
        onAwake() {
            var _a, _b;
            const supportedCompute = Laya.LayaGL.renderEngine.getCapable(Laya.RenderCapable.ComputeShader);
            if (!supportedCompute) {
                return;
            }
            this.renderer = this.owner.getComponent(VFXRenderer);
            this.renderer.visualEffect = this;
            const isNonMeshOutput = (t) => t === "outputTrail" || t === "outputParticleStripSGQuad" || t === "outputPoint" || t === "outputLine";
            let hasStrip = false;
            let hasMesh = false;
            for (let system of this.systems) {
                const sysAny = system;
                if (system instanceof VFXParticleSystem && sysAny.geometry && sysAny.customShaderName
                    && !isNonMeshOutput(sysAny.outputType)) {
                    const _m = VFXRenderer.getCustomShaderMaterial(sysAny.customShaderName, sysAny.blendMode || "Alpha", sysAny.matInstanceKey || "");
                    VFXRenderer._syncMeshAttrDefines(_m, sysAny.geometry);
                }
            }
            for (let system of this.systems) {
                if (system instanceof VFXParticleSystem && system.geometry) {
                    if (isNonMeshOutput(system.outputType)) {
                        hasStrip = true;
                    }
                    else {
                        hasMesh = true;
                        this.renderer.addGeometry(system.geometry);
                    }
                    for (const extra of system.extraOutputs) {
                        try {
                            const isExtraStrip = extra.outputType === "outputTrail" || extra.outputType === "outputParticleStripSGQuad";
                            const isBillboardProc = (extra.outputType === "outputBillboard"
                                || extra.outputType === "outputCube"
                                || extra.outputType === "outputDistortion") && !!extra.billboardPrimitive;
                            let geo;
                            if (isExtraStrip) {
                                const stripParams = new VFXStripGeometryParams();
                                stripParams.capacity = system.capacity;
                                stripParams.stripVertexBuffer = extra.renderBuffer;
                                stripParams.indirectBuffer = extra.indirectBuffer;
                                stripParams.stripCapacity = system.stripCapacity;
                                stripParams.particlePerStripCount = system.particlePerStripCount;
                                geo = new VFXStripGeometry(stripParams);
                            }
                            else if (isBillboardProc) {
                                const bbParams = new VFXBillboardGeometryParams();
                                bbParams.capacity = system.capacity;
                                bbParams.vertexCount = extra.billboardVertexCount;
                                bbParams.particleBuffer = extra.renderBuffer.vertexBuffer;
                                bbParams.particleDeviceBuffer = extra.renderBuffer;
                                bbParams.indirectBuffer = extra.indirectBuffer;
                                geo = new VFXBillboardGeometry(bbParams);
                                geo.primitive = extra.billboardPrimitive;
                                geo.cropFactor = extra.billboardCropFactor;
                            }
                            else {
                                const geoParams = new VFXGeometryParams();
                                geoParams.particleBuffer = extra.renderBuffer.vertexBuffer;
                                geoParams.particleDeviceBuffer = extra.renderBuffer;
                                geoParams.indirectBuffer = extra.indirectBuffer;
                                geoParams.capacity = system.capacity;
                                geoParams.mesh = extra.mesh;
                                geo = new VFXGeometry(geoParams);
                            }
                            geo.blendMode = extra.blendMode;
                            geo.outputType = extra.outputType;
                            geo.softParticleFade = extra.softParticleFade;
                            geo.uvMode = extra.uvMode;
                            geo.flipbookSize = extra.flipbookSize;
                            geo.mainTexture = extra.mainTexture || "";
                            geo.stripColorMapping = extra.colorMapping || "Default";
                            geo.stripUvScale = extra.uvScale;
                            geo.stripUvBias = extra.uvBias;
                            geo.stripGradientStops = extra.gradientStops || [];
                            geo.stripTilingMode = extra.tilingMode || "Stretch";
                            geo.stripPpsc = system.particlePerStripCount;
                            geo.useAlphaClipping = !!extra.useAlphaClipping;
                            geo.alphaThreshold = Number((_a = extra.alphaThreshold) !== null && _a !== void 0 ? _a : 0.5);
                            geo.subpixelAA = extra.subpixelAA;
                            geo.customShaderName = extra.customShaderName;
                            extra.geometry = geo;
                            if (isNonMeshOutput(extra.outputType)) {
                                hasStrip = true;
                            }
                            else {
                                hasMesh = true;
                                this.renderer.addGeometry(geo);
                            }
                        }
                        catch (e) {
                            console.warn("[VFX] Multi-Output: extra geometry creation failed", e);
                        }
                    }
                }
            }
            if (hasStrip) {
                this._stripNode = new Laya.Sprite3D("VFX_Strip");
                this.owner.addChild(this._stripNode);
                this._stripRenderer = this._stripNode.addComponent(VFXRenderer);
                if (((_b = this.renderer.sharedMaterials) === null || _b === void 0 ? void 0 : _b.length) > 0) {
                    this._stripRenderer.sharedMaterials = this.renderer.sharedMaterials;
                }
                if (!hasMesh) {
                    this.renderer.visualEffect = null;
                    this._stripRenderer.visualEffect = this;
                }
                const colorDefine = Laya.Shader3D.getDefineByName("COLOR");
                this._stripRenderer._baseRenderNode.shaderData.addDefine(colorDefine);
                for (let system of this.systems) {
                    if (system instanceof VFXParticleSystem) {
                        if (system.geometry && isNonMeshOutput(system.outputType)) {
                            this._stripRenderer.addGeometry(system.geometry);
                        }
                        for (const extra of system.extraOutputs) {
                            if (extra.geometry && isNonMeshOutput(extra.outputType)) {
                                this._stripRenderer.addGeometry(extra.geometry);
                            }
                        }
                    }
                }
            }
        }
        onEnable() {
        }
        onUpdate() {
            const supportedCompute = Laya.LayaGL.renderEngine.getCapable(Laya.RenderCapable.ComputeShader);
            if (!this.asset || !supportedCompute) {
                return;
            }
            const currentDeltaTime = this.owner.scene.timer.delta / 1000;
            const currentUnscaledDeltaTime = this.owner.scene.timer.unscaledDelta / 1000;
            const fixedTimeStep = 1.0 / 60.0;
            const maxDeltaTime = 1 / 20;
            const maxFixedTimeStepCount = Math.max(1, Math.ceil(maxDeltaTime / fixedTimeStep));
            this.frameTime.computeStepCount(fixedTimeStep, maxFixedTimeStepCount, currentDeltaTime, maxDeltaTime);
            this.frameTime.computeUnscaledStepCount(fixedTimeStep, maxFixedTimeStepCount, currentUnscaledDeltaTime, maxDeltaTime);
            this.frameTime.fixedDeltaTime = this.frameTime.timeStepCount * fixedTimeStep;
            this.frameTime.deltaTime = Laya.MathUtil.clamp(currentDeltaTime, 0, maxDeltaTime);
            this.frameTime.unscaledFixedDeltaTime = this.frameTime.unscaledTimeStepCount * fixedTimeStep;
            this.frameTime.unscaledDeltaTime = Laya.MathUtil.clamp(currentUnscaledDeltaTime, 0.0, maxDeltaTime);
            let currentUnscaledVfxDeltaTime = 0;
            let stepCount = 0;
            const updateMode = this.asset.updateMode;
            const isIgnoreTimeScale = (updateMode & exports.VFXUpdateMode.IgnoreTimeScale) !== 0;
            if (updateMode & exports.VFXUpdateMode.DeltaTime) {
                stepCount = 1;
                if (isIgnoreTimeScale) {
                    currentUnscaledVfxDeltaTime = this.frameTime.unscaledDeltaTime;
                }
                else {
                    currentUnscaledVfxDeltaTime = this.frameTime.deltaTime;
                }
            }
            else {
                if (isIgnoreTimeScale) {
                    stepCount = this.frameTime.unscaledTimeStepCount;
                    currentUnscaledVfxDeltaTime = this.frameTime.unscaledFixedDeltaTime;
                }
                else {
                    stepCount = this.frameTime.timeStepCount;
                    currentUnscaledVfxDeltaTime = this.frameTime.fixedDeltaTime;
                }
                if (this.asset.updateMode & exports.VFXUpdateMode.ExactFixedTimeStep) {
                    if (stepCount != 0) {
                        currentUnscaledVfxDeltaTime = fixedTimeStep;
                    }
                    else {
                        currentUnscaledVfxDeltaTime = 0;
                        stepCount = 1;
                    }
                }
                else {
                    stepCount = 1;
                }
            }
            let currentVFXDeltaTime = currentUnscaledVfxDeltaTime * this.playRate;
            if (this.pause) {
                currentVFXDeltaTime = 0;
            }
            this.state.deltaTime = currentVFXDeltaTime;
            this.state.unscaledDeltaTime = currentUnscaledVfxDeltaTime;
            this.state.playRate = this.playRate;
            this.state.systemSeed = this.currentSeed;
            this.state.rand = this.rand;
            for (let i = 0; i < stepCount; i++) {
                this.simulateVFX();
                this.state.totalTime += this.state.deltaTime;
            }
        }
        onDestroy() {
            var _a;
            this.releaseAssetData();
            (_a = this.eventQueue) === null || _a === void 0 ? void 0 : _a.destroy();
            this.eventQueue = null;
        }
        sendEvent(id, attribute = null) {
            if (!this.asset) {
                return;
            }
            if (this.resetSeedOnPlay && id == VFXEvent.OnPlayEventID) {
                this.currentSeed = globalRand.getUint();
            }
            this.eventQueue.push(id, exports.VFXEventType.Event, attribute);
        }
        sendEventByName(name, attribute = null) {
            const id = Laya.Shader3D.propertyNameToID(name);
            this.sendEvent(id, attribute);
        }
        processEvent(evt, state) {
            const asset = this.asset;
            const evtAttr = evt.attribute ? evt.attribute : this.globalEventAttribute;
            const evtDesc = asset.getEvents().get(evt.id);
            if (evtDesc) {
                for (let index of evtDesc.playSystems) {
                    const system = this.systems[index];
                    system.onPlay(evtAttr);
                }
                for (let index of evtDesc.stopSystems) {
                    const system = this.systems[index];
                    system.onStop();
                }
                for (let index of evtDesc.initSystems) {
                    const system = this.systems[index];
                    system.receiveInitializeEvent(evtAttr);
                }
            }
        }
        processInitialize(evt, state) {
            evt.id = this.initialEventID;
            this.processEvent(evt, state);
            this.asset.prewarmDeltaTime;
            this.asset.prewarmStepCount;
        }
        execudeEvents(state) {
            if (this.eventQueue.empty()) {
                return;
            }
            this.eventQueue.swap();
            const evtList = this.eventQueue.getPreviousList();
            for (let evt of evtList) {
                switch (evt.type) {
                    case exports.VFXEventType.Event:
                        this.processEvent(evt, state);
                        break;
                    case exports.VFXEventType.Initialize:
                        this.processInitialize(evt, state);
                        break;
                    case exports.VFXEventType.Simulate:
                }
            }
        }
        updateVFX() {
            this.simulateVFX();
            this._evaluateShaderExpressions();
        }
        _evaluateShaderExpressions() {
            var _a, _b, _c;
            const totalTime = this.state.totalTime;
            const deltaTime = this.frameTime.deltaTime;
            const propertyValues = this._propertyValues;
            let hasContinuousSpawn = false;
            for (const sys of this.systems) {
                if (!(sys instanceof VFXSpawnerSystem))
                    continue;
                for (const task of sys.tasks) {
                    const cn = ((_a = task.constructor) === null || _a === void 0 ? void 0 : _a.name) || "";
                    if (cn === "VFXSpawnerConstantRate" || cn === "VFXSpawnerPeriodicBurst" || cn === "VFXSpawnerVariableRate") {
                        hasContinuousSpawn = true;
                        break;
                    }
                }
                if (hasContinuousSpawn)
                    break;
            }
            for (const sys of this.systems) {
                if (!(sys instanceof VFXParticleSystem))
                    continue;
                const expressions = sys.shaderPropertyExpressions;
                if (!expressions)
                    continue;
                const allDatas = sys.getAllShaderDatas().slice();
                const customShaderName = sys.customShaderName;
                const blendMode = sys.blendMode || "Alpha";
                if (customShaderName) {
                    const variant = VisualEffect._matVariantOf(sys);
                    const mat = VFXRenderer.getCustomShaderMaterial(customShaderName, blendMode, sys.matInstanceKey || "", variant);
                    if (mat && mat.shaderData && allDatas.indexOf(mat.shaderData) === -1)
                        allDatas.push(mat.shaderData);
                }
                for (const uniformName in expressions) {
                    const graph = expressions[uniformName];
                    if (VisualEffect.PER_PARTICLE_AGE_CURVE_UNIFORMS.has(uniformName)) {
                        let curveNode = null, mult = 1;
                        const g = graph;
                        for (const nid in g.nodes) {
                            const nd = g.nodes[nid];
                            if (nd.kind === "Constant" && nd.outputType === "Curve")
                                curveNode = nd;
                            else if (nd.kind === "VFXParameter") {
                                const pv = (propertyValues && propertyValues.get) ? propertyValues.get(nd.exposedName) : undefined;
                                mult = (typeof pv === "number") ? pv : (typeof nd.defaultValue === "number" ? nd.defaultValue : 1);
                            }
                        }
                        if (curveNode && curveNode.value) {
                            const c = curveNode.value;
                            const s = (t) => mult * (ShaderExpressionEvaluator._sampleCurve(c, t) || 0);
                            const _base = uniformName.replace(/[^A-Za-z0-9]/g, "");
                            const tId = Laya.Shader3D.propertyNameToID(VisualEffect.AGE_CURVE_UNIFORM_PREFIX + _base + VisualEffect.AGE_CURVE_TIMES_SUFFIX);
                            const vId = Laya.Shader3D.propertyNameToID(VisualEffect.AGE_CURVE_UNIFORM_PREFIX + _base + VisualEffect.AGE_CURVE_VALS_SUFFIX);
                            const ts = VisualEffect.AGE_CURVE_SAMPLE_TIMES;
                            const tv = new Laya.Vector4(ts[0], ts[1], ts[2], ts[3]);
                            const vv = new Laya.Vector4(s(ts[0]), s(ts[1]), s(ts[2]), s(ts[3]));
                            for (const sd of allDatas) {
                                sd.setVector(tId, tv);
                                sd.setVector(vId, vv);
                            }
                        }
                    }
                    if (uniformName === "_Disappear" || uniformName === "Disappear") {
                        const g = graph;
                        const root = g.nodes && g.nodes[g.rootNodeId];
                        if (root && root.kind === "SampleCurve" && root.inputs && root.inputs.length > 0) {
                            const cnode = g.nodes[root.inputs[0]];
                            const curve = cnode && cnode.kind === "Constant" ? cnode.value : null;
                            if (curve && Array.isArray(curve.frames) && curve.frames.length > 0) {
                                let times = curve.frames.map((f) => Number(f.time) || 0).sort((a, b) => a - b);
                                if (times.length > 4)
                                    times = [0, 1 / 3, 2 / 3, 1];
                                while (times.length < 4)
                                    times.push((_b = times[times.length - 1]) !== null && _b !== void 0 ? _b : 1);
                                const sc = (t) => ShaderExpressionEvaluator._sampleCurve(curve, t) || 0;
                                const eId = Laya.Shader3D.propertyNameToID("u_VfxDisCurveEnable");
                                const tId3 = Laya.Shader3D.propertyNameToID("u_VfxDisTimes");
                                const vId3 = Laya.Shader3D.propertyNameToID("u_VfxDisVals");
                                const tv3 = new Laya.Vector4(times[0], times[1], times[2], times[3]);
                                const vv3 = new Laya.Vector4(sc(times[0]), sc(times[1]), sc(times[2]), sc(times[3]));
                                for (const sd of allDatas) {
                                    sd.setNumber(eId, 1);
                                    sd.setVector(tId3, tv3);
                                    sd.setVector(vId3, vv3);
                                }
                            }
                        }
                    }
                    if (VisualEffect.PER_PARTICLE_COLOR_GRADIENT_UNIFORMS.has(uniformName)) {
                        const g = graph;
                        const root = g.nodes && g.nodes[g.rootNodeId];
                        if (root && root.kind === "SampleGradient" && root.inputs && root.inputs.length > 0) {
                            const gnode = g.nodes[root.inputs[0]];
                            let grad = null;
                            if (gnode && gnode.kind === "VFXParameter") {
                                const pv = (propertyValues && gnode.exposedName) ? propertyValues.get(gnode.exposedName) : null;
                                if (pv && pv.rawGradientStops && pv.rawGradientStops.length > 0) {
                                    grad = { __layaGradientStops: pv.rawGradientStops };
                                }
                                else if (gnode.defaultValue && (gnode.defaultValue.colorKeys || gnode.defaultValue.alphaKeys)) {
                                    grad = gnode.defaultValue;
                                }
                            }
                            if (grad) {
                                const tSet = new Set();
                                if (grad.__layaGradientStops) {
                                    for (const s of grad.__layaGradientStops)
                                        tSet.add(Number(s.t) || 0);
                                }
                                else {
                                    for (const k of grad.colorKeys || [])
                                        tSet.add(Number(k.time) || 0);
                                    for (const k of grad.alphaKeys || [])
                                        tSet.add(Number(k.time) || 0);
                                }
                                let times = [...tSet].sort((a, b) => a - b);
                                if (times.length > 4)
                                    times = [0, 1 / 3, 2 / 3, 1];
                                while (times.length < 4)
                                    times.push((_c = times[times.length - 1]) !== null && _c !== void 0 ? _c : 1);
                                const sampler = ShaderExpressionEvaluator._sampleGradient.bind(ShaderExpressionEvaluator);
                                const eId = Laya.Shader3D.propertyNameToID(VisualEffect.COLOR_GRAD_ENABLE_UNIFORM);
                                const tId2 = Laya.Shader3D.propertyNameToID(VisualEffect.COLOR_GRAD_TIMES_UNIFORM);
                                const tv2 = new Laya.Vector4(times[0], times[1], times[2], times[3]);
                                for (const sd of allDatas) {
                                    sd.setNumber(eId, 1);
                                    sd.setVector(tId2, tv2);
                                }
                                for (let ci = 0; ci < 4; ci++) {
                                    const col = sampler(grad, times[ci]) || { r: 1, g: 1, b: 1, a: 1 };
                                    const cId = Laya.Shader3D.propertyNameToID(VisualEffect.COLOR_GRAD_COLOR_UNIFORMS[ci]);
                                    const cv = new Laya.Vector4(col.r, col.g, col.b, col.a);
                                    for (const sd of allDatas)
                                        sd.setVector(cId, cv);
                                }
                            }
                        }
                    }
                    const result = ShaderExpressionEvaluator.evaluate(graph, { totalTime, deltaTime, propertyValues, hasContinuousSpawn });
                    if (result == null)
                        continue;
                    const ids = [Laya.Shader3D.propertyNameToID(uniformName)];
                    if (uniformName.startsWith("_"))
                        ids.push(Laya.Shader3D.propertyNameToID(uniformName.substring(1)));
                    const noUnderscore = uniformName.replace(/_/g, "");
                    if (noUnderscore !== uniformName && noUnderscore !== uniformName.substring(1))
                        ids.push(Laya.Shader3D.propertyNameToID(noUnderscore));
                    if (graph.outputType === "float") {
                        const v = Number(result) || 0;
                        for (const sd of allDatas)
                            for (const id of ids)
                                sd.setNumber(id, v);
                    }
                    else {
                        ShaderExpressionEvaluator.toVector4(result, this._tmpExprVec4);
                        for (const sd of allDatas)
                            for (const id of ids)
                                sd.setVector(id, this._tmpExprVec4);
                    }
                }
            }
        }
        simulateVFX() {
            var _a, _b, _c;
            const state = this.state;
            this.execudeEvents(state);
            for (let system of this.systems) {
                if (system instanceof VFXSpawnerSystem) {
                    system.update(state);
                }
            }
            for (let system of this.systems) {
                if (system instanceof VFXStaticMeshSystem) {
                    system.update(state, null);
                }
            }
            this._updateSkinnedMeshTextures();
            this._updateTransformSources();
            state.emitterWorldMatrix = this.owner.transform.worldMatrix;
            state.emitterWorldMatrix.invert(this._invEmitterWorldMatrix);
            state.invEmitterWorldMatrix = this._invEmitterWorldMatrix;
            const camera = (_a = this._mainCamera) !== null && _a !== void 0 ? _a : (_c = (_b = this.owner.scene) === null || _b === void 0 ? void 0 : _b._cameraPool) === null || _c === void 0 ? void 0 : _c[0];
            for (let system of this.systems) {
                if (system instanceof VFXParticleSystem) {
                    system.setCommonUniforms(state, camera);
                }
            }
            this.applyProperties();
            for (let system of this.systems) {
                if (system instanceof VFXParticleSystem) {
                    system.updatePhase(state, this.cmd);
                }
            }
            this.cmd.executeCMDs();
            this.cmd.clearCMDs();
            for (let system of this.systems) {
                if (system instanceof VFXParticleSystem && system.useStripRingBuffer) {
                    system.updateStripsPhase(this.cmd);
                }
            }
            this.cmd.executeCMDs();
            this.cmd.clearCMDs();
            for (let system of this.systems) {
                if (system instanceof VFXParticleSystem && system.receiveGPUEvent) {
                    system.initializePhase(state, this.cmd);
                }
            }
            this.cmd.executeCMDs();
            this.cmd.clearCMDs();
            for (let system of this.systems) {
                if (system instanceof VFXParticleSystem && !system.receiveGPUEvent) {
                    system.initializePhase(state, this.cmd);
                }
            }
            this.cmd.executeCMDs();
            this.cmd.clearCMDs();
        }
        outputVFX(context3D) {
            const state = this.state;
            const cameraModuleData = context3D.cameraModuleData;
            if (cameraModuleData) {
                const camTransform = cameraModuleData.transform;
                const cameraWorldPos = camTransform.position;
                camTransform.getForward(_tempCamForward);
                camTransform.getUp(_tempCamUp);
                for (let system of this.systems) {
                    if (system instanceof VFXParticleSystem) {
                        system.setOrientCamera(this.cmd, cameraWorldPos, _tempCamForward, _tempCamUp);
                    }
                }
            }
            for (let system of this.systems) {
                if (system instanceof VFXParticleSystem) {
                    system.resetBoundsBuffer();
                }
            }
            for (let system of this.systems) {
                if (system instanceof VFXParticleSystem) {
                    system.outputPhase(state, this.cmd);
                }
            }
            for (let system of this.systems) {
                if (system instanceof VFXParticleSystem) {
                    system.copyBoundsToStaging(this.cmd);
                    system.copyOutputEventsToStaging(this.cmd);
                }
            }
            this.cmd.executeCMDs();
            this.cmd.clearCMDs();
            for (let system of this.systems) {
                if (system instanceof VFXParticleSystem) {
                    system.requestBoundsReadback();
                    if (system.outputEventDescs.length > 0) {
                        system.requestOutputEventReadback((eventName, entries) => this._dispatchOutputEvent(eventName, entries));
                    }
                }
            }
            this._evaluateShaderExpressions();
        }
        _dispatchOutputEvent(eventName, entries) {
            const cb = this.outputEventReceived;
            if (!cb)
                return;
            for (const e of entries) {
                cb(Object.assign({ eventName }, e));
            }
        }
        play() {
            this.sendEvent(VFXEvent.OnPlayEventID);
            this._executePreWarm();
        }
        _executePreWarm() {
            const asset = this.asset;
            if (!asset)
                return;
            const stepCount = asset.prewarmStepCount | 0;
            const dt = asset.prewarmDeltaTime;
            if (stepCount <= 0 || dt <= 0)
                return;
            const state = this.state;
            const savedDt = state.deltaTime;
            for (let i = 0; i < stepCount; i++) {
                state.deltaTime = dt;
                this.simulateVFX();
                state.totalTime += dt;
            }
            state.deltaTime = savedDt;
        }
        stop() {
            this.sendEvent(VFXEvent.OnStopEventID);
        }
        get pause() {
            return this._pause;
        }
        set pause(value) {
            this._pause = value;
        }
        advanceOneFrame() {
        }
        createEmptyEventAttribute() {
            if (this.asset) {
                const desc = this.asset.eventAttributeDesc;
                const evtAttr = new VFXEventAttribute(desc);
                const buffer = desc.createBuffer();
                evtAttr.initBuffer(buffer);
                return evtAttr;
            }
            return null;
        }
        createEventAttribute() {
            const evtAttr = this.createEmptyEventAttribute();
            if (evtAttr) {
                evtAttr.copyFrom(this.globalEventAttribute);
            }
            return evtAttr;
        }
        reset() {
        }
        setPropertyFloat(name, value) {
            const entry = this._propertyValues.get(name);
            if (entry) {
                entry.value[0] = value;
            }
        }
        setPropertyVec2(name, x, y) {
            const entry = this._propertyValues.get(name);
            if (entry) {
                entry.value[0] = x;
                entry.value[1] = y;
            }
        }
        setPropertyVec3(name, x, y, z) {
            const entry = this._propertyValues.get(name);
            if (entry) {
                entry.value[0] = x;
                entry.value[1] = y;
                entry.value[2] = z;
            }
        }
        setPropertyVec4(name, x, y, z, w) {
            const entry = this._propertyValues.get(name);
            if (entry) {
                entry.value[0] = x;
                entry.value[1] = y;
                entry.value[2] = z;
                entry.value[3] = w;
            }
        }
        _bindPropertyTextureToShaders(name, id, texture) {
            if (!texture)
                return;
            for (const sys of this.systems) {
                if (!(sys instanceof VFXParticleSystem))
                    continue;
                const bindings = sys.shaderPropertyBindings;
                const shaderUniformName = bindings ? bindings[name] : null;
                const aliasIds = shaderUniformName
                    ? [id, Laya.Shader3D.propertyNameToID(shaderUniformName)]
                    : [id];
                for (const sd of sys.getAllShaderDatas()) {
                    for (const aid of aliasIds)
                        sd.setTexture(aid, texture);
                }
            }
        }
        setPropertyTexture(name, url) {
            const entry = this._propertyValues.get(name);
            if (!entry || !url)
                return;
            Laya.Laya.loader.load(url).then((res) => {
                const tex = res ? (res.bitmap || res._image || res._source || res) : null;
                if (!tex) {
                    console.warn(`[VFX] setPropertyTexture('${name}') load returned null: ${url}`);
                    return;
                }
                entry.cached = tex;
                this._bindPropertyTextureToShaders(name, entry.id, tex);
            }, (err) => {
                console.warn(`[VFX] setPropertyTexture('${name}') load failed: ${url}`, err);
            });
        }
        setPropertyMesh(name, url) {
            const entry = this._propertyValues.get(name);
            if (!entry || !url)
                return;
            Laya.Laya.loader.load(url).then((mesh) => {
                if (!mesh) {
                    console.warn(`[VFX] setPropertyMesh('${name}') load returned null: ${url}`);
                    return;
                }
                entry.cached = mesh;
                for (const system of this.systems) {
                    if (typeof system.setMesh === "function")
                        system.setMesh(mesh);
                }
            }, (err) => {
                console.warn(`[VFX] setPropertyMesh('${name}') load failed: ${url}`, err);
            });
        }
        setPropertyGradient(name, stops) {
            const entry = this._propertyValues.get(name);
            if (!entry || !Array.isArray(stops))
                return;
            const engineStops = stops.map((s) => {
                const c = s && s.color;
                const color = Array.isArray(c)
                    ? [Number(c[0]) || 0, Number(c[1]) || 0, Number(c[2]) || 0, c[3] != null ? Number(c[3]) : 1]
                    : [Number(c && c.r) || 0, Number(c && c.g) || 0, Number(c && c.b) || 0, (c && c.a != null) ? Number(c.a) : 1];
                return { t: Number(s && s.t) || 0, color };
            });
            engineStops.sort((a, b) => a.t - b.t);
            entry.rawGradientStops = engineStops;
            entry.cached = bakeGradientTexture(engineStops);
            this._bindPropertyTextureToShaders(name, entry.id, entry.cached);
        }
        setBuffer(name, buffer) {
            const asset = this.asset;
            if (!asset)
                return;
            for (let i = 0; i < this.systems.length; i++) {
                const sys = this.systems[i];
                if (!(sys instanceof VFXParticleSystem))
                    continue;
                const desc = asset.systems[i];
                if (!(desc === null || desc === void 0 ? void 0 : desc.bufferUniforms))
                    continue;
                for (const bu of desc.bufferUniforms) {
                    if (bu.propertyName !== name)
                        continue;
                    const id = Laya.Shader3D.propertyNameToID(bu.uniformName + "Buffer");
                    for (const sd of sys.getAllShaderDatas()) {
                        sd.setDeviceBuffer(id, buffer.deviceBuffer);
                    }
                }
            }
        }
        applyCurveUniforms() {
            var _a, _b, _c, _d;
            const asset = this.asset;
            if (!asset)
                return;
            const bakedTexId = asset.bakedTexture ? Laya.Shader3D.propertyNameToID("u_VfxBakedTex") : 0;
            for (const system of this.systems) {
                if (!(system instanceof VFXParticleSystem))
                    continue;
                const allDatas = system.getAllShaderDatas();
                for (const cu of asset.curveUniforms) {
                    const id = Laya.Shader3D.propertyNameToID(cu.uniform);
                    const d = cu.curveData;
                    const vec = new Laya.Vector4((_a = d[0]) !== null && _a !== void 0 ? _a : 0, (_b = d[1]) !== null && _b !== void 0 ? _b : 0, (_c = d[2]) !== null && _c !== void 0 ? _c : 0, (_d = d[3]) !== null && _d !== void 0 ? _d : 0);
                    for (const sd of allDatas) {
                        sd.setVector(id, vec);
                    }
                }
                if (asset.bakedTexture) {
                    for (const sd of allDatas) {
                        sd.setTexture(bakedTexId, asset.bakedTexture);
                    }
                }
            }
            const descs = asset.systems;
            for (let i = 0; i < this.systems.length; i++) {
                const system = this.systems[i];
                const desc = descs[i];
                if (!(system instanceof VFXParticleSystem))
                    continue;
                const textureUniforms = desc.textureUniforms;
                if (!textureUniforms || textureUniforms.length === 0)
                    continue;
                const allDatas = system.getAllShaderDatas();
                for (const tu of textureUniforms) {
                    if (tu.transformSource)
                        continue;
                    const id = Laya.Shader3D.propertyNameToID(tu.uniformName);
                    let texture = tu.texture;
                    if (!texture) {
                        if (tu.textureType === "Texture3D") {
                            texture = Laya.Texture3D.defaultTexture;
                        }
                        else if (tu.textureType === "Texture2DArray") {
                            texture = Laya.Texture2DArray.defaultTexture;
                        }
                        else {
                            texture = Laya.Texture2D.whiteTexture;
                        }
                    }
                    if (!texture)
                        continue;
                    for (const sd of allDatas) {
                        sd.setTexture(id, texture);
                    }
                }
            }
            for (let i = 0; i < this.systems.length; i++) {
                const system = this.systems[i];
                const desc = descs[i];
                if (!(system instanceof VFXParticleSystem))
                    continue;
                if (!(desc === null || desc === void 0 ? void 0 : desc.meshPointBuffers) || desc.meshPointBuffers.length === 0)
                    continue;
                const allDatas = system.getAllShaderDatas();
                for (const mpb of desc.meshPointBuffers) {
                    if (!mpb.buffer)
                        continue;
                    const id = Laya.Shader3D.propertyNameToID(mpb.uniformName + "Buffer");
                    for (const sd of allDatas) {
                        sd.setDeviceBuffer(id, mpb.buffer.deviceBuffer);
                    }
                }
            }
        }
        _updateTransformSources() {
            if (this._transformSources.size === 0)
                return;
            const asset = this.asset;
            if (!asset)
                return;
            const descs = asset.systems;
            for (let i = 0; i < this.systems.length; i++) {
                const system = this.systems[i];
                const desc = descs[i];
                if (!(system instanceof VFXParticleSystem))
                    continue;
                if (!(desc === null || desc === void 0 ? void 0 : desc.textureUniforms))
                    continue;
                for (const tu of desc.textureUniforms) {
                    if (!tu.transformSource)
                        continue;
                    const node = this._transformSources.get(tu.transformSource);
                    if (!node)
                        continue;
                    const tr = node.transform || (node.owner && node.owner.transform);
                    if (!tr)
                        continue;
                    const id = Laya.Shader3D.propertyNameToID(tu.uniformName);
                    const wm = tr.worldMatrix;
                    for (const sd of system.getAllShaderDatas())
                        sd.setMatrix4x4(id, wm);
                }
            }
        }
        _updateSkinnedMeshTextures() {
            var _a, _b, _c;
            if (this._skinnedMeshSources.size === 0)
                return;
            const asset = this.asset;
            if (!asset)
                return;
            const descs = asset.systems;
            for (let i = 0; i < this.systems.length; i++) {
                const system = this.systems[i];
                const desc = descs[i];
                if (!(system instanceof VFXParticleSystem))
                    continue;
                if (!(desc === null || desc === void 0 ? void 0 : desc.textureUniforms))
                    continue;
                for (const tu of desc.textureUniforms) {
                    if (!tu.skinnedMeshSource)
                        continue;
                    const source = this._skinnedMeshSources.get(tu.skinnedMeshSource);
                    if (!source)
                        continue;
                    const role = tu.skinnedMeshRole;
                    if (role === "bones") {
                        let bonesTex = this._skinnedMeshBoneTextures.get(tu.skinnedMeshSource);
                        bonesTex = bakeSkinnedMeshBonesTexture(source, bonesTex);
                        this._skinnedMeshBoneTextures.set(tu.skinnedMeshSource, bonesTex);
                        tu.texture = bonesTex;
                    }
                    else {
                        const bakedKey = `${tu.skinnedMeshSource}|${role}`;
                        if (!tu.texture || !this._skinnedMeshVertexBaked.has(bakedKey)) {
                            const mesh = (_c = (_b = (_a = source.owner) === null || _a === void 0 ? void 0 : _a.getComponent) === null || _b === void 0 ? void 0 : _b.call(_a, Laya.MeshFilter)) === null || _c === void 0 ? void 0 : _c.sharedMesh;
                            if (!mesh)
                                continue;
                            tu.texture = bakeSkinnedMeshVertexTexture(mesh, role);
                            this._skinnedMeshVertexBaked.add(bakedKey);
                        }
                    }
                    const id = Laya.Shader3D.propertyNameToID(tu.uniformName);
                    const allDatas = system.getAllShaderDatas();
                    for (const sd of allDatas)
                        sd.setTexture(id, tu.texture);
                }
            }
        }
        applyProperties() {
            for (const entry of this._propertyValues.values()) {
                const v = entry.value;
                const c = entry.cached;
                switch (entry.type) {
                    case exports.VFXPropertyType.Vec2:
                        c.x = v[0];
                        c.y = v[1];
                        break;
                    case exports.VFXPropertyType.Vec3:
                        c.x = v[0];
                        c.y = v[1];
                        c.z = v[2];
                        break;
                    case exports.VFXPropertyType.Vec4:
                        c.x = v[0];
                        c.y = v[1];
                        c.z = v[2];
                        c.w = v[3];
                        break;
                }
                for (const system of this.systems) {
                    if (system instanceof VFXParticleSystem) {
                        const allDatas = system.getAllShaderDatas();
                        for (const sd of allDatas) {
                            switch (entry.type) {
                                case exports.VFXPropertyType.Float:
                                    sd.setNumber(entry.id, v[0]);
                                    break;
                                case exports.VFXPropertyType.Vec2:
                                    sd.setVector2(entry.id, c);
                                    break;
                                case exports.VFXPropertyType.Vec3:
                                    sd.setVector3(entry.id, c);
                                    break;
                                case exports.VFXPropertyType.Vec4:
                                case exports.VFXPropertyType.Color:
                                    sd.setVector(entry.id, c);
                                    break;
                                case exports.VFXPropertyType.Gradient:
                                    if (c)
                                        sd.setTexture(entry.id, c);
                                    break;
                            }
                        }
                    }
                }
            }
        }
    }
    VisualEffect.PER_PARTICLE_AGE_CURVE_UNIFORMS = new Set(["Alpha_Multiplier"]);
    VisualEffect.AGE_CURVE_SAMPLE_TIMES = [0, 1 / 3, 2 / 3, 1];
    VisualEffect.AGE_CURVE_UNIFORM_PREFIX = "u";
    VisualEffect.AGE_CURVE_TIMES_SUFFIX = "CurveTimes";
    VisualEffect.AGE_CURVE_VALS_SUFFIX = "CurveVals";
    VisualEffect.PER_PARTICLE_COLOR_GRADIENT_UNIFORMS = new Set(["_MainTextureColor"]);
    VisualEffect.COLOR_GRAD_ENABLE_UNIFORM = "u_VfxColorGradEnable";
    VisualEffect.COLOR_GRAD_TIMES_UNIFORM = "u_VfxColorGradTimes";
    VisualEffect.COLOR_GRAD_COLOR_UNIFORMS = ["u_VfxColorGradC0", "u_VfxColorGradC1", "u_VfxColorGradC2", "u_VfxColorGradC3"];
    const _veF16F32 = new Float32Array(1);
    const _veF16U32 = new Uint32Array(_veF16F32.buffer);
    function _veF32ToF16(v) {
        _veF16F32[0] = v;
        const bits = _veF16U32[0];
        const sign = (bits >> 16) & 0x8000;
        const exp = ((bits >> 23) & 0xff) - 127 + 15;
        const frac = bits & 0x7fffff;
        if (exp <= 0) {
            if (exp < -10)
                return sign;
            const m = (frac | 0x800000) >> (1 - exp);
            return sign | (m >> 13);
        }
        if (exp >= 31)
            return sign | 0x7c00;
        return sign | (exp << 10) | (frac >> 13);
    }
    function bakeGradientTexture(stops) {
        const width = 256;
        const data = new Uint16Array(width * 4);
        const rawKeys = stops.length >= 2 ? stops : [
            { t: 0, color: [1, 1, 1, 1] },
            { t: 1, color: [1, 1, 1, 0] },
        ];
        const sanitizeStop = (c) => [
            Math.max(0, c[0]), Math.max(0, c[1]), Math.max(0, c[2]), Math.max(0, Math.min(1, c[3])),
        ];
        const keys = rawKeys.map(k => ({
            t: k.t,
            color: sanitizeStop(k.color),
        }));
        for (let i = 0; i < width; i++) {
            const t = i / (width - 1);
            let a = keys[0], b = keys[keys.length - 1];
            for (let k = 0; k < keys.length - 1; k++) {
                if (t >= keys[k].t && t <= keys[k + 1].t) {
                    a = keys[k];
                    b = keys[k + 1];
                    break;
                }
            }
            const span = Math.max(b.t - a.t, 1e-6);
            const u = Math.max(0, Math.min(1, (t - a.t) / span));
            const r = a.color[0] + (b.color[0] - a.color[0]) * u;
            const g = a.color[1] + (b.color[1] - a.color[1]) * u;
            const bB = a.color[2] + (b.color[2] - a.color[2]) * u;
            const aA = a.color[3] + (b.color[3] - a.color[3]) * u;
            data[i * 4] = _veF32ToF16(r);
            data[i * 4 + 1] = _veF32ToF16(g);
            data[i * 4 + 2] = _veF32ToF16(bB);
            data[i * 4 + 3] = _veF32ToF16(aA);
        }
        const tex = new Laya.Texture2D(width, 1, Laya.TextureFormat.R16G16B16A16, false, false, false, false);
        tex.setPixelsData(data, false, false);
        tex.wrapModeU = Laya.WrapMode.Clamp;
        tex.wrapModeV = Laya.WrapMode.Clamp;
        tex.filterMode = Laya.FilterMode.Bilinear;
        return tex;
    }
    const VFXInit = () => {
        VFXGeometry.init();
        VFXStripGeometry.init();
        VFXEvent.init();
        VFXShaderInit.init();
        ensureIDs();
        if (Laya.LayaEnv.isPlaying) {
            Laya.Laya.loader.load([
                "VFXBillboardProcedural.shader",
                "VFXCubeProcedural.shader",
                "VFXDistortionQuad.shader",
                "VFXUnlit.shader",
                "VFXStrip.shader",
            ].map(s => "internal/vfx/" + s));
        }
    };
    Laya.Laya.addAfterInitCallback(VFXInit);

    let c = Laya.ClassUtils.regClass;
    c("VFXAsset", VFXAsset);
    c("VFXRenderer", VFXRenderer);
    c("VisualEffect", VisualEffect);

    class VFXLoader {
        load(task) {
            let url = Laya.AssetDb.inst.getSubAssetURL(task.url, task.uuid, "0", "lvfx");
            return task.loader.fetch(url, "json", task.progress.createCallback(), task.options).then(data => {
                return new VFXAssetParser().parse(data, Laya.URL.getPath(task.url));
            });
        }
    }
    Laya.Loader.registerLoader(["vfx"], VFXLoader, "VFXGraph");

    exports.ShaderExpressionEvaluator = ShaderExpressionEvaluator;
    exports.VFXAsset = VFXAsset;
    exports.VFXAssetParser = VFXAssetParser;
    exports.VFXBillboardGeometry = VFXBillboardGeometry;
    exports.VFXBillboardGeometryParams = VFXBillboardGeometryParams;
    exports.VFXCurveUniformDesc = VFXCurveUniformDesc;
    exports.VFXEvent = VFXEvent;
    exports.VFXEventAttribute = VFXEventAttribute;
    exports.VFXEventAttributeDesc = VFXEventAttributeDesc;
    exports.VFXEventDesc = VFXEventDesc;
    exports.VFXEventPool = VFXEventPool;
    exports.VFXEventQueue = VFXEventQueue;
    exports.VFXExtraOutputDesc = VFXExtraOutputDesc;
    exports.VFXFrameTime = VFXFrameTime;
    exports.VFXGeometry = VFXGeometry;
    exports.VFXGeometryParams = VFXGeometryParams;
    exports.VFXInit = VFXInit;
    exports.VFXLineGeometry = VFXLineGeometry;
    exports.VFXLineGeometryParams = VFXLineGeometryParams;
    exports.VFXLineStripGeometry = VFXLineStripGeometry;
    exports.VFXLineStripGeometryParams = VFXLineStripGeometryParams;
    exports.VFXLoader = VFXLoader;
    exports.VFXOutputEventDesc = VFXOutputEventDesc;
    exports.VFXParticleSystem = VFXParticleSystem;
    exports.VFXParticleSystemDesc = VFXParticleSystemDesc;
    exports.VFXPointGeometry = VFXPointGeometry;
    exports.VFXPointGeometryParams = VFXPointGeometryParams;
    exports.VFXPropertyDesc = VFXPropertyDesc;
    exports.VFXRenderer = VFXRenderer;
    exports.VFXShaderInit = VFXShaderInit;
    exports.VFXSpawnerConstantRate = VFXSpawnerConstantRate;
    exports.VFXSpawnerConstantRateTaskDesc = VFXSpawnerConstantRateTaskDesc;
    exports.VFXSpawnerCustomWrapper = VFXSpawnerCustomWrapper;
    exports.VFXSpawnerCustomWrapperTaskDesc = VFXSpawnerCustomWrapperTaskDesc;
    exports.VFXSpawnerOverDistance = VFXSpawnerOverDistance;
    exports.VFXSpawnerOverDistanceTaskDesc = VFXSpawnerOverDistanceTaskDesc;
    exports.VFXSpawnerPeriodicBurst = VFXSpawnerPeriodicBurst;
    exports.VFXSpawnerPeriodicBurstTaskDesc = VFXSpawnerPeriodicBurstTaskDesc;
    exports.VFXSpawnerSetEventAttribute = VFXSpawnerSetEventAttribute;
    exports.VFXSpawnerSetEventAttributeTaskDesc = VFXSpawnerSetEventAttributeTaskDesc;
    exports.VFXSpawnerSettings = VFXSpawnerSettings;
    exports.VFXSpawnerSingleBurst = VFXSpawnerSingleBurst;
    exports.VFXSpawnerSingleBurstTaskDesc = VFXSpawnerSingleBurstTaskDesc;
    exports.VFXSpawnerState = VFXSpawnerState;
    exports.VFXSpawnerSystem = VFXSpawnerSystem;
    exports.VFXSpawnerSystemDesc = VFXSpawnerSystemDesc;
    exports.VFXSpawnerTask = VFXSpawnerTask;
    exports.VFXState = VFXState;
    exports.VFXStaticMeshSystem = VFXStaticMeshSystem;
    exports.VFXStaticMeshSystemDesc = VFXStaticMeshSystemDesc;
    exports.VFXStripGeometry = VFXStripGeometry;
    exports.VFXStripGeometryParams = VFXStripGeometryParams;
    exports.VFXSystem = VFXSystem;
    exports.VisualEffect = VisualEffect;
    exports.bakeSkinnedMeshBonesTexture = bakeSkinnedMeshBonesTexture;
    exports.bakeSkinnedMeshVertexTexture = bakeSkinnedMeshVertexTexture;
    exports.ensureIDs = ensureIDs;
    exports.findGpuVertexBuffer = findGpuVertexBuffer;
    exports.sampleRange = sampleRange;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.vfx.js.map
