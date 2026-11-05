(function (exports, Laya) {
    'use strict';

    class RenderCullUtil {
        static cullByCameraCullInfo(cameraCullInfo, list, count, opaqueList, transparent, context) {
            const boundFrustum = cameraCullInfo.boundFrustum;
            const cullMask = cameraCullInfo.cullingMask;
            const staticMask = cameraCullInfo.staticMask;
            let render;
            let canPass;
            for (let i = 0; i < count; i++) {
                render = list[i];
                canPass = ((1 << render.layer) & cullMask) != 0 && (render.renderbitFlag == 0);
                canPass = canPass && ((render.staticMask & staticMask) != 0);
                if (canPass) {
                    if (!cameraCullInfo.useOcclusionCulling || render._needRender(boundFrustum)) {
                        let distance = render.distanceForSort = Laya.Vector3.distanceSquared(render.bounds._imp.getCenter(), cameraCullInfo.position);
                        if (render.visibalRangeBit == 0 || (distance > render.visibalMin && distance < render.visibalMax)) {
                            render._renderUpdatePre(context);
                            let element;
                            const elements = render.renderelements;
                            for (let j = 0, len = elements.length; j < len; j++) {
                                element = elements[j];
                                if (element.materialRenderQueue > 2500)
                                    transparent.addRenderElement(element);
                                else
                                    opaqueList.addRenderElement(element);
                            }
                        }
                    }
                }
            }
        }
        static cullDirectLightShadow(shadowCullInfo, list, count, opaqueList, context) {
            opaqueList.clear();
            for (let i = 0; i < count; i++) {
                const render = list[i];
                if (render.shadowCullPass()) {
                    if (Laya.FrustumCulling.cullingRenderBounds(render.bounds, shadowCullInfo)) {
                        let distance = render.distanceForSort = Laya.Vector3.distanceSquared(render.bounds._imp.getCenter(), shadowCullInfo.cameraPosition);
                        if (render.visibalRangeBit == 0 || (distance > render.visibalMin && distance < render.visibalMax)) {
                            render._renderUpdatePre(context);
                            let element;
                            const elements = render.renderelements;
                            for (let j = 0, len = elements.length; j < len; j++) {
                                element = elements[j];
                                if (element.materialRenderQueue < 2500)
                                    opaqueList.addRenderElement(element);
                            }
                        }
                    }
                }
            }
        }
        static cullSpotShadow(cameraCullInfo, list, count, opaqueList, context) {
            opaqueList.clear();
            const boundFrustum = cameraCullInfo.boundFrustum;
            for (let i = 0; i < count; i++) {
                const render = list[i];
                render._renderUpdatePre(context);
                if (render.shadowCullPass()) {
                    let distance = render.distanceForSort = Laya.Vector3.distanceSquared(render.bounds._imp.getCenter(), cameraCullInfo.position);
                    if (render.visibalRangeBit == 0 || (distance > render.visibalMin && distance < render.visibalMax)) {
                        if (render._needRender(boundFrustum)) {
                            let element;
                            const elements = render.renderelements;
                            for (let j = 0, len = elements.length; j < len; j++) {
                                element = elements[j];
                                if (element.materialRenderQueue < 2500)
                                    opaqueList.addRenderElement(element);
                            }
                        }
                    }
                }
            }
        }
    }

    class RenderQuickSort {
        sort(elements, isTransparent, left, right) {
            this.elementArray = elements;
            this.isTransparent = isTransparent;
            this._quickSort(left, right);
        }
        _quickSort(left, right) {
            if (this.elementArray.length > 1) {
                const index = this._partitionRenderObject(left, right);
                const leftIndex = index - 1;
                if (left < leftIndex)
                    this._quickSort(left, leftIndex);
                if (index < right)
                    this._quickSort(index, right);
            }
        }
        _partitionRenderObject(left, right) {
            const elements = this.elementArray.elements;
            const pivot = elements[Math.floor((right + left) / 2)];
            while (left <= right) {
                while (this._compare(elements[left], pivot) < 0)
                    left++;
                while (this._compare(elements[right], pivot) > 0)
                    right--;
                if (left < right) {
                    const temp = elements[left];
                    elements[left] = elements[right];
                    elements[right] = temp;
                    left++;
                    right--;
                }
                else if (left === right) {
                    left++;
                    break;
                }
            }
            return left;
        }
        _compare(left, right) {
            const renderOrder = left.owner.renderOrder - right.owner.renderOrder;
            if (renderOrder !== 0)
                return renderOrder;
            const renderQueue = left.materialRenderQueue - right.materialRenderQueue;
            if (renderQueue === 0) {
                const sort = this.isTransparent ? right.owner.distanceForSort - left.owner.distanceForSort : left.owner.distanceForSort - right.owner.distanceForSort;
                const sortKey = sort + right.owner.sortingFudge - left.owner.sortingFudge;
                if (sortKey !== 0)
                    return sortKey;
                return left.sortIndex - right.sortIndex;
            }
            else
                return renderQueue;
        }
    }

    class RenderListQueue {
        get elements() { return this._elements; }
        constructor(isTransParent) {
            this._elements = new Laya.FastSinglelist();
            this.batchModule = new Laya.SingletonList();
            this._isTransparent = isTransParent;
            this._quickSort = new RenderQuickSort();
        }
        addRenderElement(renderelement) {
            renderelement.materialShaderData && this._elements.add(renderelement);
        }
        addBatchAgent(agent) {
            this.batchModule.add(agent);
        }
        renderQueue(context) {
            this.sort();
            if (!this._isTransparent && this.batchModule.length > 0) {
                for (var i = 0, n = this.batchModule.length; i < n; i++) {
                    let list = this.batchModule.elements[i].opaqueList;
                    for (var j = 0, m = list.length; j < m; j++) {
                        let elements = list.elements;
                        this._elements.add(elements[j]);
                    }
                }
            }
            context.drawRenderElementList(this._elements);
            Laya.LayaGL.statAgent.recordCTData(this._isTransparent ? Laya.StatElement.CT_TransDrawCall : Laya.StatElement.CT_OpaqueDrawCall, this.elements.length);
        }
        mergeQueue() {
            this.sort();
            if (!this._isTransparent && this.batchModule.length > 0) {
                for (var i = 0, n = this.batchModule.length; i < n; i++) {
                    let list = this.batchModule.elements[i].opaqueList;
                    for (var j = 0, m = list.length; j < m; j++) {
                        let elements = list.elements;
                        this._elements.add(elements[j]);
                    }
                }
            }
        }
        renderQueueOnly(context) {
            context.drawRenderElementList(this._elements);
            Laya.LayaGL.statAgent.recordCTData(this._isTransparent ? Laya.StatElement.CT_TransDrawCall : Laya.StatElement.CT_OpaqueDrawCall, this.elements.length);
        }
        sort() {
            const count = this._elements.length;
            this._quickSort.sort(this._elements, this._isTransparent, 0, count - 1);
        }
        clear() {
            this._elements.elements.fill(null);
            this._elements.length = 0;
            this.batchModule.length = 0;
        }
        destroy() {
            this.clear();
            this._elements = null;
        }
    }

    class RenderPassUtil {
        static renderCmd(cmds, context) {
            if (cmds && cmds.length > 0)
                cmds.forEach(value => context.runCMDList(value._renderCMDs));
        }
        static recoverRenderContext3D(context, renderTarget) {
            context.setViewPort(this.contextViewPortCache);
            context.setScissor(this.contextScissorCache);
            context.setRenderTarget(renderTarget, Laya.RenderClearFlag.Nothing);
        }
    }
    RenderPassUtil.contextViewPortCache = new Laya.Viewport();
    RenderPassUtil.contextScissorCache = new Laya.Vector4();

    class WebBaseRenderNode {
        get shaderData() {
            return this._shaderData;
        }
        set shaderData(value) {
            if (this._shaderData != value) {
                let oldCommandMap = this._commonUniformMap.slice();
                if (this._shaderData) {
                    this.setCommonUniformMap([]);
                }
                this._shaderData = value;
                this.setCommonUniformMap(oldCommandMap);
            }
        }
        _renderUpdatePre(context3D) {
            const mask = this.perCameraUpdate
                ? context3D.cameraUpdateMask
                : context3D.sceneUpdateMask;
            if (this._updateMark == mask)
                return;
            this._renderUpdatePreFun.call(this._renderUpdatePreCall, context3D);
            this._updateMark = mask;
        }
        _calculateBoundingBox() {
            this._caculateBoundingBoxFun.call(this._caculateBoundingBoxCall);
        }
        _setTransformWorldMatrix(value) {
            this.shaderData.setMatrix4x4(Laya.Sprite3D.WORLDMATRIX, value);
        }
        _setTransformWorldInvertFront(value) {
            this.shaderData.setVector(Laya.Sprite3D.WORLDINVERTFRONT, value);
        }
        get bounds() {
            if (this.boundsChange) {
                this._calculateBoundingBox();
                this.boundsChange = false;
            }
            return this._bounds;
        }
        set bounds(value) {
            this._bounds = value;
        }
        get additionShaderData() {
            return this._additionShaderData;
        }
        set additionShaderData(value) {
            if (this._additionShaderData && this._additionShaderData.size > 0) {
                if (!value)
                    for (var [key, date] of this._additionShaderData) {
                        date.getDefineData().removeChangeFlagInfo(this.defineDataChangeFlag);
                    }
                else {
                    for (var [key, date] of this._additionShaderData) {
                        if (!value.has(key)) {
                            date.getDefineData().removeChangeFlagInfo(this.defineDataChangeFlag);
                        }
                    }
                }
            }
            this._additionShaderData = value;
            if (value && value.size > 0) {
                this._additionShaderDataKeys = Array.from(this._additionShaderData.keys());
                for (var [key, shaderdate] of value) {
                    shaderdate.getDefineData().addChangeFlagInfo(this.defineDataChangeFlag);
                }
            }
            else {
                this._additionShaderDataKeys = [];
            }
        }
        constructor() {
            this.renderOrder = 0;
            this.ismoved = new Laya.Vector2();
            this.defineDataChangeFlag = new Laya.Vector2();
            this.perCameraUpdate = false;
            this.renderelements = [];
            this._commonUniformMap = [];
            this._worldParams = new Laya.Vector4(1, 0, 0, 0);
            this.lightmapDirtyFlag = -1;
            this.lightmapScaleOffset = new Laya.Vector4(1, 1, 0, 0);
            this.set_caculateBoundingBox(this, this._ownerCalculateBoundingBox);
            this._additionShaderData = new Map();
        }
        setNodeCustomData(dataSlot, data) {
            switch (dataSlot) {
                case 0:
                    this._worldParams.y = data;
                    break;
                case 1:
                    this._worldParams.z = data;
                    break;
                case 2:
                    this._worldParams.w = data;
                    break;
            }
        }
        set_renderUpdatePreCall(call, fun) {
            this._renderUpdatePreCall = call;
            this._renderUpdatePreFun = fun;
        }
        set_caculateBoundingBox(call, fun) {
            this._caculateBoundingBoxCall = call;
            this._caculateBoundingBoxFun = fun;
        }
        _needRender(boundFrustum) {
            if (boundFrustum)
                return boundFrustum.intersects(this.bounds);
            else
                return true;
        }
        setRenderelements(value) {
            this.renderelements.length = 0;
            for (var i = 0; i < value.length; i++) {
                this.renderelements.push(value[i]);
                value[i].owner = this;
                value[i].sortIndex = i;
            }
        }
        setOneMaterial(index, mat) {
            if (!this.renderelements[index])
                return;
            this.renderelements[index].materialShaderData = mat.shaderData;
            this.renderelements[index].materialRenderQueue = mat.renderQueue;
            this.renderelements[index].subShader = mat.shader.getSubShaderAt(0);
            this.renderelements[index].materialId = mat._id;
        }
        setLightmapScaleOffset(value) {
            value && value.cloneTo(this.lightmapScaleOffset);
        }
        setCommonUniformMap(value) {
            var _a;
            this._commonUniformMap.length = 0;
            value.forEach(element => {
                this._commonUniformMap.push(element);
            });
            this._shaderData && ((_a = this._shaderData.getDefineData()) === null || _a === void 0 ? void 0 : _a.addChangeFlagInfo(this.defineDataChangeFlag));
        }
        shadowCullPass() {
            return this.castShadow && this.enable && (this.renderbitFlag == 0);
        }
        _ownerCalculateBoundingBox() {
            this.baseGeometryBounds._tranform(this.transform.worldMatrix, this._bounds);
        }
        _applyLightMapParams() {
            let shaderValues = this.shaderData;
            if (this.lightmap) {
                let lightMap = this.lightmap;
                shaderValues.setVector(Laya.RenderableSprite3D.LIGHTMAPSCALEOFFSET, this.lightmapScaleOffset);
                shaderValues._setInternalTexture(Laya.RenderableSprite3D.LIGHTMAP, lightMap.lightmapColor);
                shaderValues.addDefine(Laya.RenderableSprite3D.SAHDERDEFINE_LIGHTMAP);
                if (lightMap.lightmapDirection) {
                    shaderValues._setInternalTexture(Laya.RenderableSprite3D.LIGHTMAP_DIRECTION, lightMap.lightmapDirection);
                    shaderValues.addDefine(Laya.RenderableSprite3D.SHADERDEFINE_LIGHTMAP_DIRECTIONAL);
                }
                else {
                    shaderValues.removeDefine(Laya.RenderableSprite3D.SHADERDEFINE_LIGHTMAP_DIRECTIONAL);
                }
            }
            else {
                shaderValues.removeDefine(Laya.RenderableSprite3D.SAHDERDEFINE_LIGHTMAP);
                shaderValues.removeDefine(Laya.RenderableSprite3D.SHADERDEFINE_LIGHTMAP_DIRECTIONAL);
            }
        }
        _applyLightProb() {
            if (this.lightmapIndex >= 0 || !this.volumetricGI)
                return;
            if (this.volumetricGI.updateMark != this.lightProbUpdateMark) {
                this.lightProbUpdateMark = this.volumetricGI.updateMark;
                this.volumetricGI.applyRenderData();
            }
        }
        _applyReflection() {
            if (!this.probeReflection || this.reflectionMode == Laya.ReflectionProbeMode.off)
                return;
            if (!this.probeReflection.shaderData)
                return;
            if (this.probeReflection.needUpdate()) {
                this.probeReflection.applyRenderData();
            }
        }
        destroy() {
            this.renderelements.forEach(element => {
                element.destroy();
            });
            this.baseGeometryBounds = null;
            this.transform = null;
            this.lightmapScaleOffset = null;
            this.lightmap = null;
            this.probeReflection = null;
            this.volumetricGI = null;
            this.renderelements.length = 0;
            this.renderelements = null;
            this.shaderData && this.shaderData.destroy();
            this.shaderData = null;
            this._commonUniformMap.length = 0;
            this._commonUniformMap = null;
            this.additionShaderData.clear();
            this.additionShaderData = null;
            this._additionShaderDataKeys.length = 0;
            this._additionShaderDataKeys = null;
        }
    }

    class WebDirectLight {
        constructor() {
            this._shadowFourCascadeSplits = new Laya.Vector3();
            this._direction = new Laya.Vector3();
        }
        setShadowFourCascadeSplits(value) {
            value && value.cloneTo(this._shadowFourCascadeSplits);
        }
        setDirection(value) {
            value && value.cloneTo(this._direction);
        }
    }

    class WebLightmap {
        destroy() {
            this.lightmapColor = null;
            this.lightmapDirection = null;
        }
    }

    var baseRenderNode = null;
    function WebMeshRenderNode() {
        if (!baseRenderNode)
            baseRenderNode = class extends WebBaseRenderNode.BaseRenderNodeClass {
                constructor() {
                    super();
                    this._cacheMoved = new Laya.Vector2(-1, -1);
                    this.set_renderUpdatePreCall(this, this._renderUpdate);
                }
                _renderUpdate(context) {
                    if (context.sceneModuleData.lightmapDirtyFlag != this.lightmapDirtyFlag) {
                        this._applyLightMapParams();
                        this.lightmapDirtyFlag = context.sceneModuleData.lightmapDirtyFlag;
                    }
                    this._applyReflection();
                    this._applyLightProb();
                    if (this.ismoved.x > this._cacheMoved.x || (this.ismoved.x == this._cacheMoved.x && this.ismoved.y > this._cacheMoved.y)) {
                        let trans = this.transform;
                        this._setTransformWorldMatrix(trans.worldMatrix);
                        this._worldParams.x = trans.getFrontFaceValue();
                        this._setTransformWorldInvertFront(this._worldParams);
                        this.ismoved.cloneTo(this._cacheMoved);
                    }
                }
            };
        return baseRenderNode;
    }

    class WebCameraNodeData {
        constructor() {
            this._projectViewMatrix = new Laya.Matrix4x4();
        }
        setProjectionViewMatrix(value) {
            value && value.cloneTo(this._projectViewMatrix);
        }
    }
    class WebSceneNodeData {
    }

    class WebPointLight {
    }

    class WebReflectionProbe {
        constructor() {
            this._id = ++WebReflectionProbe._idCounter;
            this._updateMaskFlag = -1;
            this._shCoefficients = [];
            this._probePosition = new Laya.Vector3();
            this._ambientColor = new Laya.Color();
            this.shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData();
        }
        needUpdate() {
            return this.updateMark != this._updateMaskFlag;
        }
        destroy() {
            this.bound = null;
            delete this._shCoefficients;
            delete this._ambientSH;
            this.shaderData.destroy();
            this.shaderData = null;
        }
        setAmbientSH(value) {
            this._ambientSH = value;
        }
        setShCoefficients(value) {
            this._shCoefficients.length = 0;
            value.forEach(element => {
                var v4 = new Laya.Vector4();
                element.cloneTo(v4);
                this._shCoefficients.push(v4);
            });
        }
        setProbePosition(value) {
            value && value.cloneTo(this._probePosition);
        }
        setreflectionHDRParams(value) {
            value && value.cloneTo(this._reflectionHDRParams);
        }
        setAmbientColor(value) {
            value && value.cloneTo(this._ambientColor);
        }
        applyRenderData() {
            if (!this.shaderData)
                return;
            this._updateMaskFlag = this.updateMark;
            let data = this.shaderData;
            if (!data)
                return;
            if (!this.boxProjection) {
                data.removeDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_SPECCUBE_BOX_PROJECTION);
            }
            else {
                data.addDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_SPECCUBE_BOX_PROJECTION);
                data.setVector3(Laya.ReflectionProbe.REFLECTIONCUBE_PROBEPOSITION, this._probePosition);
                data.setVector3(Laya.ReflectionProbe.REFLECTIONCUBE_PROBEBOXMAX, this.bound.getMax());
                data.setVector3(Laya.ReflectionProbe.REFLECTIONCUBE_PROBEBOXMIN, this.bound.getMin());
            }
            if (this.ambientMode == Laya.AmbientMode.SolidColor) {
                data.removeDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_GI_LEGACYIBL);
                data.removeDefine(Laya.ReflectionProbe.SHADERDEFINE_GI_IBL);
                data.setColor(Laya.ReflectionProbe.AMBIENTCOLOR, this._ambientColor);
            }
            else if (this.iblTex && this._ambientSH) {
                data.addDefine(Laya.ReflectionProbe.SHADERDEFINE_GI_IBL);
                data.removeDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_GI_LEGACYIBL);
                if (this.iblTex) {
                    data._setInternalTexture(Laya.ReflectionProbe.IBLTEX, this.iblTex);
                    data.setNumber(Laya.ReflectionProbe.IBLROUGHNESSLEVEL, this.iblTex.maxMipmapLevel);
                }
                this.iblTexRGBD ? data.addDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_IBL_RGBD) : data.removeDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_IBL_RGBD);
                this._ambientSH && data.setBuffer(Laya.ReflectionProbe.AMBIENTSH, this._ambientSH);
            }
            else {
                data.removeDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_GI_LEGACYIBL);
                data.removeDefine(Laya.ReflectionProbe.SHADERDEFINE_GI_IBL);
            }
            data.setNumber(Laya.ReflectionProbe.AMBIENTINTENSITY, this.ambientIntensity);
            data.setNumber(Laya.ReflectionProbe.REFLECTIONINTENSITY, this.reflectionIntensity);
            data.update(Laya.ReflectionProbe.BlockName);
        }
    }
    WebReflectionProbe._idCounter = 0;

    var CLSSK = null;
    function WebSkinRenderNode() {
        if (!CLSSK)
            CLSSK = class extends WebBaseRenderNode.BaseRenderNodeClass {
                constructor() {
                    super();
                    this._bones = [];
                    this.set_renderUpdatePreCall(this, this._renderUpdate);
                }
                setRootBoneTransfom(value) {
                    this._cacheRootBone = value.transform;
                }
                setOwnerTransform(value) {
                    this._owner = value.transform;
                }
                setCacheMesh(cacheMesh) {
                    this._cacheMesh = cacheMesh;
                    this._skinnedDataLoopMarks = new Uint32Array(cacheMesh._inverseBindPoses.length);
                }
                setBones(value) {
                    this._bones = value;
                }
                setSkinnedData(value) {
                    this._skinnedData = value;
                }
                computeSkinnedData() {
                    var bindPoses = this._cacheMesh._inverseBindPoses;
                    var pathMarks = this._cacheMesh._skinnedMatrixCaches;
                    for (var i = 0, n = this._cacheMesh.subMeshCount; i < n; i++) {
                        var subMeshBoneIndices = ((this._cacheMesh.getSubMesh(i)))._boneIndicesList;
                        var subData = this._skinnedData[i];
                        for (var j = 0, m = subMeshBoneIndices.length; j < m; j++) {
                            var boneIndices = subMeshBoneIndices[j];
                            this._computeSubSkinnedData(bindPoses, boneIndices, subData[j], pathMarks);
                        }
                    }
                }
                _computeSubSkinnedData(bindPoses, boneIndices, data, matrixCaches) {
                    for (let k = 0, q = boneIndices.length; k < q; k++) {
                        let index = boneIndices[k];
                        if (this._skinnedDataLoopMarks[index] === Laya.Stat.loopCount) {
                            let c = matrixCaches[index];
                            let preData = this._skinnedData[c.subMeshIndex][c.batchIndex];
                            let srcIndex = c.batchBoneIndex * 16;
                            let dstIndex = k * 16;
                            for (let d = 0; d < 16; d++)
                                data[dstIndex + d] = preData[srcIndex + d];
                        }
                        else {
                            let bone = this._bones[index];
                            if (bone)
                                Laya.Utils3D._mulMatrixArray(bone.transform.worldMatrix.elements, bindPoses[index].elements, 0, data, k * 16);
                            this._skinnedDataLoopMarks[index] = Laya.Stat.loopCount;
                        }
                    }
                }
                _renderUpdate(context3D) {
                    let mat = this._owner.worldMatrix;
                    let worldParams = this._worldParams;
                    worldParams.x = this._owner.getFrontFaceValue();
                    if (this._cacheRootBone) {
                        mat = Laya.Matrix4x4.DEFAULT;
                        worldParams.x = 1;
                    }
                    this._applyLightProb();
                    this._applyReflection();
                    this._setTransformWorldMatrix(mat);
                    this._setTransformWorldInvertFront(worldParams);
                }
            };
        return CLSSK;
    }

    class WebSpotLight {
        setDirection(value) {
            value.cloneTo(this._direction);
        }
        getWorldMatrix(out) {
            var position = this.transform.position;
            var quaterian = this.transform.rotation;
            Laya.Matrix4x4.createAffineTransformation(position, quaterian, Laya.Vector3.ONE, out);
            return out;
        }
    }

    class WebVolumetricGI {
        constructor() {
            this._id = ++WebVolumetricGI._idCounter;
            this._probeCounts = new Laya.Vector3();
            this._probeStep = new Laya.Vector3();
            this._params = new Laya.Vector4();
            this._params = new Laya.Vector4();
            this.bound = new Laya.Bounds();
            this.shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData();
        }
        setParams(value) {
            value.cloneTo(this._params);
        }
        setProbeCounts(value) {
            value.cloneTo(this._probeCounts);
        }
        setProbeStep(value) {
            value.cloneTo(this._probeStep);
        }
        applyRenderData() {
            let data = this.shaderData;
            if (!data)
                return;
            data.addDefine(Laya.VolumetricGI.SHADERDEFINE_VOLUMETRICGI);
            data.setVector3(Laya.VolumetricGI.VOLUMETRICGI_PROBECOUNTS, this._probeCounts);
            data.setVector3(Laya.VolumetricGI.VOLUMETRICGI_PROBESTEPS, this._probeStep);
            data.setVector3(Laya.VolumetricGI.VOLUMETRICGI_PROBESTARTPOS, this.bound.getMin());
            data.setVector(Laya.VolumetricGI.VOLUMETRICGI_PROBEPARAMS, this._params);
            data._setInternalTexture(Laya.VolumetricGI.VOLUMETRICGI_IRRADIANCE, this.irradiance);
            data._setInternalTexture(Laya.VolumetricGI.VOLUMETRICGI_DISTANCE, this.distance);
            data.setNumber(Laya.ReflectionProbe.AMBIENTINTENSITY, this.intensity);
            data.update(Laya.VolumetricGI.BlockName);
        }
        destroy() {
            this.shaderData.destroy();
            this.shaderData = null;
            this.irradiance = null;
            this.distance = null;
            this.bound = null;
        }
    }
    WebVolumetricGI._idCounter = 0;

    var CLASSIMPLESKIN = null;
    function WebSimpleSkinRenderNode() {
        if (!CLASSIMPLESKIN)
            CLASSIMPLESKIN = class extends WebBaseRenderNode.BaseRenderNodeClass {
                constructor() {
                    super();
                    this.set_renderUpdatePreCall(this, this._renderUpdate);
                    this._simpleAnimatorParams = new Laya.Vector4();
                }
                setSimpleAnimatorParams(value) {
                    value.cloneTo(this._simpleAnimatorParams);
                    this.shaderData.setVector(Laya.SimpleSkinnedMeshSprite3D.SIMPLE_SIMPLEANIMATORPARAMS, this._simpleAnimatorParams);
                }
                _renderUpdate(context3D) {
                    let shaderData = this.shaderData;
                    let worldMat = this.transform.worldMatrix;
                    let worldParams = this._worldParams;
                    worldParams.x = this.transform.getFrontFaceValue();
                    this._setTransformWorldMatrix(worldMat);
                    this._setTransformWorldInvertFront(worldParams);
                    this._applyLightProb();
                    this._applyReflection();
                    shaderData.setVector(Laya.SimpleSkinnedMeshSprite3D.SIMPLE_SIMPLEANIMATORPARAMS, this._simpleAnimatorParams);
                }
            };
        return CLASSIMPLESKIN;
    }

    class Web3DRenderModuleFactory {
        createSimpleSkinRenderNode() {
            return new (WebSimpleSkinRenderNode())();
        }
        createTransform(owner) {
            return new Laya.Transform3D(owner);
        }
        createBounds(min, max) {
            return new Laya.BoundsImpl(min, max);
        }
        createVolumetricGI() {
            return new WebVolumetricGI();
        }
        createReflectionProbe() {
            return new WebReflectionProbe();
        }
        createLightmapData() {
            return new WebLightmap();
        }
        createDirectLight() {
            return new WebDirectLight();
        }
        createSpotLight() {
            return new WebSpotLight();
        }
        createPointLight() {
            return new WebPointLight();
        }
        createCameraModuleData() {
            return new WebCameraNodeData();
        }
        createSceneModuleData() {
            return new WebSceneNodeData();
        }
        createBaseRenderNode() {
            let renderNode = new WebBaseRenderNode();
            return renderNode;
        }
        createMeshRenderNode() {
            return new (WebMeshRenderNode())();
        }
        createSkinRenderNode() {
            return new (WebSkinRenderNode())();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.Laya3DRender.Render3DModuleDataFactory) {
            Laya.Laya3DRender.Render3DModuleDataFactory = new Web3DRenderModuleFactory();
        }
    });

    class WebForwardAddClusterRP {
        get camera() {
            return this._camera;
        }
        set camera(value) {
            this._camera = value;
            this._setCameraCullInfo(this.camera);
        }
        get clearColor() {
            return this._clearColor;
        }
        set clearColor(value) {
            this._clearColor = value;
        }
        _setCameraCullInfo(value) {
            this._cameraCullInfo.position = value._transform.position;
            this._cameraCullInfo.cullingMask = value.cullingMask;
            this._cameraCullInfo.staticMask = value.staticMask;
            this._cameraCullInfo.boundFrustum = value.boundFrustum;
            this._cameraCullInfo.useOcclusionCulling = value.useOcclusionCulling;
            this._cameraCullInfo.id = value.id;
        }
        _clearRenderList() {
            this._opaqueList.clear();
            this._transparent.clear();
        }
        setCameraCullInfo(sceneManager) {
            let agent = sceneManager.batchAgentList;
            for (var [key, value] of agent) {
                value.setCullCamera([this._cameraCullInfo]);
            }
        }
        constructor() {
            this._opaqueList = new RenderListQueue(false);
            this._transparent = new RenderListQueue(true);
            this._cameraCullInfo = new Laya.CameraCullInfo();
            this._zBufferParams = new Laya.Vector4();
            this._scissor = new Laya.Vector4();
            this._viewPort = new Laya.Viewport();
            this._defaultNormalDepthColor = new Laya.Color(0.5, 0.5, 1.0, 0.0);
            this._clearColor = new Laya.Color();
            this.blitOpaqueBuffer = new Laya.CommandBuffer();
            this.depthPipelineMode = "ShadowCaster";
            this.depthNormalPipelineMode = "DepthNormal";
        }
        setViewPort(value) {
            value.cloneTo(this._viewPort);
        }
        setScissor(value) {
            value.cloneTo(this._scissor);
        }
        setBeforeForwardCmds(value) {
            if (value && value.length > 0) {
                this._beforeForwardCmds = value;
                value.forEach(element => element._apply(false));
            }
        }
        setBeforeSkyboxCmds(value) {
            if (value && value.length > 0) {
                this._beforeSkyboxCmds = value;
                value.forEach(element => element._apply(false));
            }
        }
        setBeforeTransparentCmds(value) {
            if (value && value.length > 0) {
                this._beforeTransparentCmds = value;
                value.forEach(element => element._apply(false));
            }
        }
        render(context, renderManager) {
            context.cameraUpdateMask++;
            this._clearRenderList();
            var time = performance.now();
            let _list = renderManager.baseRenderList;
            RenderCullUtil.cullByCameraCullInfo(this._cameraCullInfo, _list.elements, _list.length, this._opaqueList, this._transparent, context);
            let agent = renderManager.batchAgentList;
            for (var [key, agentModule] of agent) {
                let agentrenderList = agentModule.appendRenderElement(Laya.BatchCullMode.Camera, 0, context);
                let opaqueList = agentrenderList.opaqueList;
                let translist = agentrenderList.transparentList;
                if (agentrenderList.opaqueCustomSort) {
                    this._opaqueList.addBatchAgent(agentrenderList);
                }
                else {
                    let element = opaqueList.elements;
                    for (var jj = 0; jj < opaqueList.length; jj++) {
                        this._opaqueList.addRenderElement(element[jj]);
                    }
                }
                let element = translist.elements;
                for (var jj = 0; jj < translist.length; jj++) {
                    this._transparent.addRenderElement(element[jj]);
                }
            }
            Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_CullMain, performance.now() - time);
            time = performance.now();
            this._opaqueList.mergeQueue();
            if ((this.depthTextureMode & Laya.DepthTextureMode.Depth) != 0)
                this._renderDepthPass(context);
            if ((this.depthTextureMode & Laya.DepthTextureMode.DepthNormals) != 0)
                this._renderDepthNormalPass(context);
            Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_DepthPass, performance.now() - time);
            time = performance.now();
            this._mainPass(context);
            Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_3DMainPass, performance.now() - time);
        }
        _renderDepthNormalPass(context) {
            context.pipelineMode = this.depthNormalPipelineMode;
            this.camera._shaderValues.setTexture(Laya.DepthPass.DEPTHNORMALSTEXTURE, Laya.Texture2D.blackTexture);
            const viewport = this._viewPort;
            Laya.Viewport.TEMP.set(viewport.x, viewport.y, viewport.width, viewport.height);
            Laya.Vector4.TEMP.setValue(viewport.x, viewport.y, viewport.width, viewport.height);
            context.setViewPort(Laya.Viewport.TEMP);
            context.setScissor(Laya.Vector4.TEMP);
            context.setClearData(Laya.RenderClearFlag.Color | Laya.RenderClearFlag.Depth, this._defaultNormalDepthColor, 1, 0);
            context.setRenderTarget(this.depthNormalTarget, Laya.RenderClearFlag.Color | Laya.RenderClearFlag.Depth);
            this._opaqueList.renderQueueOnly(context);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_DepthCastDrawCall, this._opaqueList.elements.length);
            Laya.Camera.depthPass._setupDepthModeShaderValue(Laya.DepthTextureMode.DepthNormals, this.camera);
        }
        _renderDepthPass(context) {
            context.pipelineMode = this.depthPipelineMode;
            const viewport = this._viewPort;
            const shadervalue = context.sceneData;
            shadervalue.addDefine(Laya.DepthPass.DEPTHPASS);
            shadervalue.setVector(Laya.DepthPass.DEFINE_SHADOW_BIAS, Laya.Vector4.ZERO);
            Laya.Viewport.TEMP.set(viewport.x, viewport.y, viewport.width, viewport.height);
            Laya.Vector4.TEMP.setValue(viewport.x, viewport.y, viewport.width, viewport.height);
            context.setViewPort(Laya.Viewport.TEMP);
            context.setScissor(Laya.Vector4.TEMP);
            context.setRenderTarget(this.depthTarget, Laya.RenderClearFlag.Depth);
            context.setClearData(Laya.RenderClearFlag.Depth, Laya.Color.BLACK, 1, 0);
            this._opaqueList.renderQueueOnly(context);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_DepthCastDrawCall, this._opaqueList.elements.length);
            const far = this.camera.farPlane;
            const near = this.camera.nearPlane;
            this._zBufferParams.setValue(1.0 - far / near, far / near, (near - far) / (near * far), 1 / near);
            context.cameraData.setVector(Laya.DepthPass.DEFINE_SHADOW_BIAS, Laya.DepthPass.SHADOW_BIAS);
            context.cameraData.setVector(Laya.DepthPass.DEPTHZBUFFERPARAMS, this._zBufferParams);
            Laya.Camera.depthPass._setupDepthModeShaderValue(Laya.DepthTextureMode.Depth, this.camera);
            shadervalue.removeDefine(Laya.DepthPass.DEPTHPASS);
        }
        _mainPass(context) {
            context.pipelineMode = this.pipelineMode;
            RenderPassUtil.renderCmd(this._beforeForwardCmds, context);
            this._recoverRenderContext3D(context, this.opaqueMRTTarget || this.destTarget);
            context.setClearData(this.opaqueMRTTarget ? this.clearFlag | Laya.RenderClearFlag.Color : this.clearFlag, this.clearColor, 1, 0, this.opaqueMRTClearColors);
            var time = performance.now();
            this._opaqueList.renderQueueOnly(context);
            if (this.opaqueMRTTarget)
                this._recoverRenderContext3D(context, this.destTarget);
            Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_3DMainPass_Opaque, performance.now() - time);
            RenderPassUtil.renderCmd(this._beforeSkyboxCmds, context);
            if (this.opaqueMRTTarget)
                this._recoverRenderContext3D(context, this.destTarget);
            if (this.skyRenderNode) {
                const skyRenderElement = this.skyRenderNode.renderelements[0];
                if (skyRenderElement.subShader)
                    context.drawRenderElementOne(skyRenderElement);
            }
            if (this.camera.opaquePass)
                this._opaqueTexturePass(context);
            RenderPassUtil.renderCmd(this._beforeTransparentCmds, context);
            this._recoverRenderContext3D(context, this.destTarget);
            time = performance.now();
            this._transparent.renderQueue(context);
            Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_3DMainPass_Trans, performance.now() - time);
        }
        _opaqueTexturePass(context) {
            const cameraData = context.cameraData;
            const opaqueTexture = cameraData.getTexture(Laya.BaseCamera.OPAQUETEXTURE);
            cameraData.setTexture(Laya.BaseCamera.OPAQUETEXTURE, Laya.Texture2D.blackTexture);
            const commandBuffer = this.blitOpaqueBuffer;
            commandBuffer._apply(false);
            context.runCMDList(commandBuffer._renderCMDs);
            cameraData.setTexture(Laya.BaseCamera.OPAQUETEXTURE, opaqueTexture);
        }
        _recoverRenderContext3D(context, renderTarget) {
            context.setViewPort(this._viewPort);
            context.setScissor(this._scissor);
            context.setRenderTarget(renderTarget, Laya.RenderClearFlag.Nothing);
        }
        destory() {
        }
    }

    class WebForwardAddRP {
        constructor() {
            this.finalize = new Laya.CommandBuffer();
        }
        setBeforeImageEffect(value) {
            if (value && value.length > 0) {
                this._beforeImageEffectCMDS = value;
                value.forEach(element => element._apply(false));
            }
        }
        runBeforeImageEffectCMD(context) {
            this._renderCmd(this._beforeImageEffectCMDS, context);
        }
        setAfterEventCmd(value) {
            if (value && value.length > 0) {
                this._afterAllRenderCMDS = value;
                value.forEach(element => element._apply(false));
            }
        }
        runAfterEventCMD(context) {
            this._renderCmd(this._afterAllRenderCMDS, context);
        }
        _renderCmd(cmds, context) {
            if (cmds && cmds.length > 0)
                cmds.forEach(value => context.runCMDList(value._renderCMDs));
        }
        destroy() {
        }
    }

    const viewport$1 = new Laya.Viewport(0, 0, 0, 0);
    const offsetScale = new Laya.Vector4();
    class WebRender3DProcess {
        constructor() {
            this._useCachedDepth = false;
            this._defaultDepthTex = Laya.RenderTexture.createFromPool(1, 1, Laya.RenderTargetFormat.DEPTH_32, Laya.RenderTargetFormat.None, false, 1);
            this._defaultShadowMap = Laya.ShadowUtils.getTemporaryShadowTexture(1, 1, Laya.ShadowMapFormat.bit16);
            let shadowMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("Shadow");
            shadowMap.setDefaultTextureData(Laya.ShadowCasterPass.SHADOW_MAP, this._defaultShadowMap);
            shadowMap.setDefaultTextureData(Laya.ShadowCasterPass.SHADOW_SPOTMAP, this._defaultShadowMap);
        }
        _renderCmd(cmds, context) {
            if (cmds && cmds.length > 0)
                cmds.forEach(value => context.runCMDList(value._renderCMDs));
        }
        _renderPostProcess(postprocessCMD, context) {
            context.runCMDList(postprocessCMD._renderCMDs);
        }
        _initRenderPass(camera, context) {
            const renderPass = this._renderPass.mainRenderpass;
            const renderRT = camera._getRenderTexture();
            let clearConst = 0;
            const clearFlag = camera.clearFlag;
            const hasStencil = renderRT.depthStencilFormat === Laya.RenderTargetFormat.DEPTHSTENCIL_24_8;
            const stencilFlag = hasStencil ? Laya.RenderClearFlag.Stencil : 0;
            switch (clearFlag) {
                case Laya.CameraClearFlags.DepthOnly:
                    clearConst = Laya.RenderClearFlag.Depth | stencilFlag;
                    break;
                case Laya.CameraClearFlags.Nothing:
                    clearConst = Laya.RenderClearFlag.Nothing;
                    break;
                case Laya.CameraClearFlags.ColorOnly:
                    clearConst = Laya.RenderClearFlag.Color;
                    break;
                case Laya.CameraClearFlags.Sky:
                case Laya.CameraClearFlags.SolidColor:
                default:
                    clearConst = Laya.RenderClearFlag.Color | Laya.RenderClearFlag.Depth | stencilFlag;
                    break;
            }
            const clearValue = renderRT._texture.gammaCorrection !== 1 ? camera.clearColor : camera._linearClearColor;
            renderPass.camera = camera;
            renderPass.destTarget = renderRT._getRenderTarget(!!camera.effectiveOpaqueMRT);
            renderPass.clearFlag = clearConst;
            renderPass.clearColor = clearValue;
            renderPass.opaqueMRTTarget = camera.effectiveOpaqueMRT ? renderRT._getRenderTarget() : null;
            renderPass.opaqueMRTClearColors = camera._getOpaqueMRTClearColors((clearConst & Laya.RenderClearFlag.Color) ? clearValue : null);
            let needInternalRT = camera._needInternalRenderTexture();
            renderPass.setCameraCullInfo(this.render3DManager);
            if (needInternalRT) {
                viewport$1.set(0, 0, renderRT.width, renderRT.height);
            }
            else {
                camera.viewport.cloneTo(viewport$1);
            }
            renderPass.setViewPort(viewport$1);
            let scissor = Laya.Vector4.TEMP;
            scissor.setValue(viewport$1.x, viewport$1.y, viewport$1.width, viewport$1.height);
            renderPass.setScissor(scissor);
            renderPass.enableOpaque = Laya.Stat.enableOpaque;
            renderPass.enableTransparent = Laya.Stat.enableTransparent;
            renderPass.enableCMD = Laya.Stat.enableCameraCMD;
            renderPass.setBeforeSkyboxCmds(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeSkyBox]);
            renderPass.setBeforeForwardCmds(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeForwardOpaque]);
            renderPass.setBeforeTransparentCmds(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeTransparent]);
            this._renderPass.setBeforeImageEffect(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeImageEffect]);
            this._renderPass.setAfterEventCmd(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.AfterEveryThing]);
            if (camera.clearFlag === Laya.CameraClearFlags.Sky)
                renderPass.skyRenderNode = camera.scene.skyRenderer._baseRenderNode;
            else
                renderPass.skyRenderNode = null;
            renderPass.pipelineMode = Laya.RenderContext3D._instance.configPipeLineMode;
            const enableShadow = (Laya.Scene3D._updateMark % camera.scene._ShadowMapupdateFrequency === 0) && Laya.Stat.enableShadow;
            this._renderPass.shadowCastPass = enableShadow;
            context.preDrawUniformMaps.add("Scene3D");
            context.preDrawUniformMaps.add("Global");
            if (enableShadow) {
                const mainDirectionLight = camera.scene._mainDirectionLight;
                const needDirectionShadow = mainDirectionLight && mainDirectionLight.shadowMode !== Laya.ShadowMode.None;
                this._renderPass.enableDirectLightShadow = needDirectionShadow;
                if (needDirectionShadow) {
                    this._renderPass.dirShadowRenderPass.setRPData(mainDirectionLight._dataModule, camera._renderDataModule, context, this.render3DManager);
                    this._renderPass.dirShadowRenderPass.setCameraCullInfo(this.render3DManager);
                }
                const mainSpotLight = camera.scene._mainSpotLight;
                const needSpotShadow = mainSpotLight && mainSpotLight.shadowMode !== Laya.ShadowMode.None;
                this._renderPass.enableSpotLightShadowPass = needSpotShadow;
                if (needSpotShadow) {
                    this._renderPass.spotShadowRenderPass.setRPData(mainSpotLight._dataModule, context, this.render3DManager);
                    this._renderPass.spotShadowRenderPass.setCameraCullInfo(this.render3DManager);
                }
                if (needDirectionShadow || needSpotShadow) {
                    context.preDrawUniformMaps.add("Shadow");
                }
            }
            else {
                context.preDrawUniformMaps.delete("Shadow");
            }
            renderPass.blitOpaqueBuffer.clear();
            if (camera.opaquePass && camera._opaqueTexture) {
                renderPass.blitOpaqueBuffer.blitScreenQuad(renderRT, camera._opaqueTexture);
            }
            if (Laya.Stat.enablePostprocess && camera.postProcess && camera.postProcess.enable && camera.postProcess.effects.length > 0) {
                this._renderPass.enablePostProcess = camera.postProcess.enable;
                this._renderPass.postProcess = camera.postProcess._context.command;
                camera.postProcess._render(camera);
                this._renderPass.postProcess._apply(false);
            }
            else
                this._renderPass.enablePostProcess = false;
            this._renderPass.finalize.clear();
            if (!this._renderPass.enablePostProcess && needInternalRT && camera._offScreenRenderTexture) {
                let dst = camera._offScreenRenderTexture;
                if (Laya.LayaGL.renderEngine._screenInvertY) {
                    offsetScale.setValue(camera.normalizedViewport.x, camera.normalizedViewport.y, renderRT.width / dst.width, renderRT.height / dst.height);
                }
                else
                    offsetScale.setValue(camera.normalizedViewport.x, 1.0 - camera.normalizedViewport.y, renderRT.width / dst.width, -renderRT.height / dst.height);
                this._renderPass.finalize.blitScreenQuad(renderRT, camera._offScreenRenderTexture, offsetScale);
            }
        }
        _renderDepth(camera) {
            this._useCachedDepth = false;
            this._renderPass.mainRenderpass.depthTarget = null;
            let depthMode = camera.depthTextureMode;
            if (camera.postProcess && camera.postProcess.enable) {
                depthMode |= camera.postProcess.cameraDepthTextureMode;
            }
            if ((depthMode & Laya.DepthTextureMode.Depth) != 0) {
                Laya.Camera.depthPass.getTarget(camera, Laya.DepthTextureMode.Depth, camera.depthTextureFormat);
                this._useCachedDepth = camera.canblitDepth && camera.depthTexture === camera._cacheDepthTexture.depthStencilTexture;
                if (this._useCachedDepth) {
                    depthMode &= ~Laya.DepthTextureMode.Depth;
                }
                else {
                    this._renderPass.mainRenderpass.depthTarget = camera.depthTexture._getRenderTarget();
                }
                Laya.Camera.depthPass._setupDepthModeShaderValue(Laya.DepthTextureMode.Depth, camera);
            }
            if ((depthMode & Laya.DepthTextureMode.DepthNormals) != 0) {
                Laya.Camera.depthPass.getTarget(camera, Laya.DepthTextureMode.DepthNormals, camera.depthTextureFormat);
                this._renderPass.mainRenderpass.depthNormalTarget = camera.depthNormalTexture._renderTarget;
                camera._shaderValues.setTexture(Laya.DepthPass.DEPTHNORMALSTEXTURE, camera.depthNormalTexture);
                Laya.Camera.depthPass._setupDepthModeShaderValue(Laya.DepthTextureMode.DepthNormals, camera);
            }
            this._renderPass.mainRenderpass.depthTextureMode = depthMode;
        }
        _renderForwardAddCameraPass(context, renderPass) {
            var time = Laya.Browser.now();
            context.cameraData.setTexture(Laya.DepthPass.DEPTHTEXTURE, this._defaultDepthTex);
            if (this._useCachedDepth)
                Laya.Camera.depthPass._setupDepthModeShaderValue(Laya.DepthTextureMode.Depth, renderPass.mainRenderpass.camera);
            if (renderPass.shadowCastPass) {
                context.sceneData.setTexture(Laya.ShadowCasterPass.SHADOW_MAP, this._defaultShadowMap);
                context.sceneData.setTexture(Laya.ShadowCasterPass.SHADOW_SPOTMAP, this._defaultShadowMap);
                if (renderPass.enableDirectLightShadow) {
                    renderPass.dirShadowRenderPass.update(context);
                    renderPass.dirShadowRenderPass.render(context, this.render3DManager);
                }
                if (renderPass.enableSpotLightShadowPass) {
                    renderPass.spotShadowRenderPass.update(context);
                    renderPass.spotShadowRenderPass.render(context, this.render3DManager);
                }
            }
            if (renderPass.enableDirectLightShadow) {
                renderPass.dirShadowRenderPass.useRPResource(context);
            }
            else {
                renderPass.dirShadowRenderPass.unuseRPResource(context);
            }
            if (renderPass.enableSpotLightShadowPass) {
                renderPass.spotShadowRenderPass.useRPResource(context);
            }
            else {
                renderPass.spotShadowRenderPass.unuseRPResource(context);
            }
            Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_ShadowPass, Laya.Browser.now() - time);
            renderPass.mainRenderpass.render(context, this.render3DManager);
            renderPass.runBeforeImageEffectCMD(context);
            if (renderPass.enablePostProcess && renderPass.postProcess) {
                time = Laya.Browser.now();
                this._renderPostProcess(renderPass.postProcess, context);
                Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_Render_PostProcess, Laya.Browser.now() - time);
            }
            renderPass.runAfterEventCMD(context);
            renderPass.finalize._apply(false);
            context.runCMDList(renderPass.finalize._renderCMDs);
        }
        fowardRender(context, camera) {
            Laya.Camera.depthPass.cleanUp(camera);
            this._renderDepth(camera);
            this._initRenderPass(camera, context);
            this._renderForwardAddCameraPass(context, this._renderPass);
            this._renderPass.mainRenderpass.opaqueMRTTarget = null;
            this._renderPass.mainRenderpass.opaqueMRTClearColors = null;
        }
        destroy() {
            this._defaultDepthTex.destroy();
            this._defaultDepthTex = null;
            this._renderPass.destroy();
        }
    }

    class WebSceneRenderManager {
        constructor() {
            this._list = new Laya.SingletonList();
            this.batchAgentList = new Map();
            this.baseRenderList = new Laya.SingletonList();
        }
        registerBatchModuleAgent(renderNodeType, agent) {
            if (!this.batchAgentList.has(renderNodeType)) {
                this.batchAgentList.set(renderNodeType, agent);
                for (let i = 0; i < this.baseRenderList.length; i++) {
                    if (this.baseRenderList.elements[i].renderNodeType == renderNodeType) {
                        agent.addRenderNode(this._list.elements[i]);
                        this._list.elements[i]._batchRender = agent;
                    }
                }
            }
        }
        updateProperty(object, property) {
            let agent = this.batchAgentList.get(object._baseRenderNode.renderNodeType);
            agent && agent.updateProperty(object, property);
        }
        get list() {
            return this._list;
        }
        set list(value) {
            this._list = value;
            if (value) {
                let elemnt = this._list.elements;
                this.baseRenderList.clear();
                for (let i = 0; i < this._list.length; i++) {
                    this.baseRenderList.add(elemnt[i]._baseRenderNode);
                }
            }
        }
        addRenderObject(object) {
            let agent = this.batchAgentList.get(object._baseRenderNode.renderNodeType);
            if (agent) {
                agent.addRenderNode(object);
                object._batchRender = agent;
            }
            else {
                this._list.add(object);
                this.baseRenderList.add(object._baseRenderNode);
            }
        }
        removeRenderObject(object) {
            let agent = this.batchAgentList.get(object._baseRenderNode.renderNodeType);
            if (agent) {
                agent.removeRenderNode(object);
                object._batchRender = null;
            }
            else {
                this._list.remove(object);
                this.baseRenderList.remove(object._baseRenderNode);
            }
        }
        removeMotionObject(object) {
        }
        updateMotionObjects() {
        }
        addMotionObject(object) {
        }
        destroy() {
            var _a;
            (_a = this._list) === null || _a === void 0 ? void 0 : _a.destroy();
            this.baseRenderList.destroy();
            this._list = null;
            this.baseRenderList = null;
            for (var [key, value] of this.batchAgentList) {
                value.release();
            }
        }
    }

    class WebBaseSpotRP {
        constructor() {
            this._shadowSpotMatrices = new Laya.Matrix4x4();
            this._shadowSpotMapSize = new Laya.Vector4();
            this._renderQueue = new RenderListQueue(false);
            this._shadowSpotData = new Laya.ShadowSpotData();
            this._lightWorldMatrix = new Laya.Matrix4x4();
            this._shadowBias = new Laya.Vector4();
        }
        _setLight(value) {
            this._light = value;
            this._shadowResolution = this._light.shadowResolution;
            this._lightWorldMatrix = this._light.getWorldMatrix(this._lightWorldMatrix);
            this._lightPos = this._light.transform.position;
            this._spotAngle = this._light.spotAngle;
            this._spotRange = this._light.spotRange;
            this._shadowStrength = this._light.shadowStrength;
            this._shadowMode = this._light.shadowMode;
        }
        _applyCasterPassCommandBuffer(context) {
            if (this._shadowCasterCommanBuffer && this._shadowCasterCommanBuffer.length > 0)
                this._shadowCasterCommanBuffer.forEach(value => value._apply());
        }
        _getSpotLightShadowData(shadowSpotData, resolution, shadowSpotMatrices, shadowMapSize) {
            var out = shadowSpotData.position = this._lightPos;
            shadowSpotData.resolution = resolution;
            shadowMapSize.setValue(1.0 / resolution, 1.0 / resolution, resolution, resolution);
            shadowSpotData.offsetX = 0;
            shadowSpotData.offsetY = 0;
            var spotWorldMatrix = this._lightWorldMatrix;
            var viewMatrix = shadowSpotData.viewMatrix;
            var projectMatrix = shadowSpotData.projectionMatrix;
            var viewProjectMatrix = shadowSpotData.viewProjectMatrix;
            var BoundFrustum = shadowSpotData.cameraCullInfo.boundFrustum;
            spotWorldMatrix.invert(viewMatrix);
            Laya.Matrix4x4.createPerspective(3.1416 * this._spotAngle / 180.0, 1, 0.1, this._spotRange, projectMatrix);
            Laya.Matrix4x4.multiply(projectMatrix, viewMatrix, viewProjectMatrix);
            BoundFrustum.matrix = viewProjectMatrix;
            viewProjectMatrix.cloneTo(shadowSpotMatrices);
            shadowSpotData.cameraCullInfo.position = out;
        }
        _getShadowBias(shadowResolution, out) {
            var frustumSize = Math.tan(this._spotAngle * 0.5 * Laya.MathUtils3D.Deg2Rad) * this._spotRange;
            var texelSize = frustumSize / shadowResolution;
            var depthBias = -this._light.shadowDepthBias * texelSize;
            var normalBias = -this._light.shadowNormalBias * texelSize;
            if (this._shadowMode == Laya.ShadowMode.SoftHigh) {
                const kernelRadius = 2.5;
                depthBias *= kernelRadius;
                normalBias *= kernelRadius;
            }
            out.setValue(depthBias, normalBias, 0.0, 0.0);
        }
        _setupShadowCasterShaderValues(shaderValues, shadowSliceData, shadowBias) {
            shaderValues.setVector(Laya.ShadowCasterPass.SHADOW_BIAS, shadowBias);
            var cameraSV = shadowSliceData.cameraShaderValue;
            cameraSV.setMatrix4x4(Laya.BaseCamera.VIEWMATRIX, shadowSliceData.viewMatrix);
            cameraSV.setMatrix4x4(Laya.BaseCamera.PROJECTMATRIX, shadowSliceData.projectionMatrix);
            cameraSV.setMatrix4x4(Laya.BaseCamera.VIEWPROJECTMATRIX, shadowSliceData.viewProjectMatrix);
            shaderValues.setMatrix4x4(Laya.BaseCamera.VIEWPROJECTMATRIX, shadowSliceData.viewProjectMatrix);
        }
        _applyRenderData(sceneData, cameraData) {
            var spotLight = this._light;
            switch (spotLight.shadowMode) {
                case Laya.ShadowMode.Hard:
                    sceneData.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SPOT_SOFT_SHADOW_HIGH);
                    sceneData.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SPOT_SOFT_SHADOW_LOW);
                    break;
                case Laya.ShadowMode.SoftLow:
                    sceneData.addDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SPOT_SOFT_SHADOW_LOW);
                    sceneData.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SPOT_SOFT_SHADOW_HIGH);
                    break;
                case Laya.ShadowMode.SoftHigh:
                    sceneData.addDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SPOT_SOFT_SHADOW_HIGH);
                    sceneData.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SPOT_SOFT_SHADOW_LOW);
                    break;
            }
            sceneData.setMatrix4x4(Laya.ShadowCasterPass.SHADOW_SPOTMATRICES, this._shadowSpotMatrices);
            sceneData.setVector(Laya.ShadowCasterPass.SHADOW_SPOTMAP_SIZE, this._shadowSpotMapSize);
        }
        setShadowCasterCommanBuffer(cmd) {
            this._shadowCasterCommanBuffer = cmd;
        }
        setCameraCullInfo(sceneManager) {
            const shadowSpotData = this._shadowSpotData;
            this._getSpotLightShadowData(shadowSpotData, this._shadowResolution, this._shadowSpotMatrices, this._shadowSpotMapSize);
            let agent = sceneManager.batchAgentList;
            for (var [key, value] of agent) {
                value.setSpotCullingDir([shadowSpotData.cameraCullInfo]);
            }
        }
        setRPData(spotLight, context) {
            this._setLight(spotLight);
            this._destShadowRT = Laya.Scene3D._shadowCasterPass.getSpotLightShadowPassData(spotLight);
            let v4 = context.sceneData.getVector(Laya.ShadowCasterPass.SHADOW_PARAMS);
            v4 = v4 ? v4 : new Laya.Vector4();
            v4.y = spotLight.shadowStrength;
            context.sceneData.setVector(Laya.ShadowCasterPass.SHADOW_PARAMS, v4);
        }
        update(context) {
            context.sceneData.addDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SPOT);
            context.sceneData.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW);
        }
        render(context, manager) {
            const originCameraData = context.cameraData;
            const shadowSpotData = this._shadowSpotData;
            const shaderData = context.sceneData;
            context.pipelineMode = 'ShadowCaster';
            context.setRenderTarget(this._destShadowRT._renderTarget, Laya.RenderClearFlag.Depth);
            this._getShadowBias(shadowSpotData.resolution, this._shadowBias);
            this._setupShadowCasterShaderValues(shaderData, shadowSpotData, this._shadowBias);
            let list = manager.baseRenderList;
            var time = Laya.Browser.now();
            RenderCullUtil.cullSpotShadow(shadowSpotData.cameraCullInfo, list.elements, list.length, this._renderQueue, context);
            let agent = manager.batchAgentList;
            for (var [key, agentModule] of agent) {
                let agentrenderList = agentModule.appendRenderElement(Laya.BatchCullMode.Spot, 0, context).opaqueList;
                let element = agentrenderList.elements;
                for (var jj = 0; jj < agentrenderList.length; jj++) {
                    this._renderQueue.addRenderElement(element[jj]);
                }
            }
            Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_CullShadow, Laya.Browser.now() - time);
            let cameraDepthTex = context.cameraData.getTexture(Laya.DepthPass.DEPTHTEXTURE);
            shadowSpotData.cameraShaderValue.setTexture(Laya.DepthPass.DEPTHTEXTURE, cameraDepthTex);
            context.cameraData = shadowSpotData.cameraShaderValue;
            context.cameraUpdateMask++;
            Laya.Viewport.TEMP.set(shadowSpotData.offsetX, shadowSpotData.offsetY, shadowSpotData.resolution, shadowSpotData.resolution);
            Laya.Vector4.TEMP.setValue(shadowSpotData.offsetX, shadowSpotData.offsetY, shadowSpotData.resolution, shadowSpotData.resolution);
            context.setViewPort(Laya.Viewport.TEMP);
            context.setScissor(Laya.Vector4.TEMP);
            context.setClearData(Laya.RenderClearFlag.Depth, Laya.Color.BLACK, 1, 0);
            this._renderQueue.renderQueue(context);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_ShadowDrawCall, this._renderQueue.elements.length);
            this._applyCasterPassCommandBuffer(context);
            this._applyRenderData(context.sceneData, context.cameraData);
            context.cameraData = originCameraData;
            context.cameraUpdateMask++;
        }
        useRPResource(context) {
            context.sceneData.addDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SPOT);
            context.sceneData.setTexture(Laya.ShadowCasterPass.SHADOW_SPOTMAP, this._destShadowRT);
        }
        unuseRPResource(context) {
            context.sceneData.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SPOT);
        }
        destory() {
        }
    }

    class WebDirCascadeShadowRP {
        constructor() {
            this._cascadesSplitDistance = new Array(WebDirCascadeShadowRP._maxCascades + 1);
            this._shadowMatrices = new Float32Array(16 * (WebDirCascadeShadowRP._maxCascades));
            this._splitBoundSpheres = new Float32Array(WebDirCascadeShadowRP._maxCascades * 4);
            this._shadowSliceDatas = [new Laya.ShadowSliceData(), new Laya.ShadowSliceData(), new Laya.ShadowSliceData(), new Laya.ShadowSliceData()];
            this._shadowMapSize = new Laya.Vector4();
            this._shadowBias = new Laya.Vector4();
            this._cascadeCount = 0;
            this._shadowMapWidth = 0;
            this._shadowMapHeight = 0;
            this._shadowTileResolution = 0;
            this._shadowCullInfo = [new Laya.ShadowCullInfo(), new Laya.ShadowCullInfo(), new Laya.ShadowCullInfo(), new Laya.ShadowCullInfo()];
            this._lightup = new Laya.Vector3();
            this._lightSide = new Laya.Vector3();
            this._lightForward = new Laya.Vector3();
            this._cascadesSplitDistance = new Array(WebDirCascadeShadowRP._maxCascades + 1);
            this._frustumPlanes = new Array(new Laya.Plane(new Laya.Vector3(), 0), new Laya.Plane(new Laya.Vector3(), 0), new Laya.Plane(new Laya.Vector3(), 0), new Laya.Plane(new Laya.Vector3(), 0), new Laya.Plane(new Laya.Vector3(), 0), new Laya.Plane(new Laya.Vector3(), 0));
            this._renderQueue = new RenderListQueue(false);
        }
        _setLight(value) {
            this._light = value;
            var lightWorld = Laya.Matrix4x4.TEMP;
            var lightWorldE = lightWorld.elements;
            var lightUp = this._lightup;
            var lightSide = this._lightSide;
            var lightForward = this._lightForward;
            Laya.Matrix4x4.createFromQuaternion(this._light.transform.rotation, lightWorld);
            lightSide.setValue(lightWorldE[0], lightWorldE[1], lightWorldE[2]);
            lightUp.setValue(lightWorldE[4], lightWorldE[5], lightWorldE[6]);
            lightForward.setValue(-lightWorldE[8], -lightWorldE[9], -lightWorldE[10]);
            var atlasResolution = this._light.shadowResolution;
            var cascadesMode = this._shadowCastMode = this._light.shadowCascadesMode;
            if (cascadesMode == Laya.ShadowCascadesMode.NoCascades) {
                this._cascadeCount = 1;
                this._shadowTileResolution = atlasResolution;
                this._shadowMapWidth = atlasResolution;
                this._shadowMapHeight = atlasResolution;
            }
            else {
                this._cascadeCount = cascadesMode == Laya.ShadowCascadesMode.TwoCascades ? 2 : 4;
                let shadowTileResolution = Laya.ShadowUtils.getMaxTileResolutionInAtlas(atlasResolution, atlasResolution, this._cascadeCount);
                this._shadowTileResolution = shadowTileResolution;
                this._shadowMapWidth = shadowTileResolution * 2;
                this._shadowMapHeight = cascadesMode == Laya.ShadowCascadesMode.TwoCascades ? shadowTileResolution : shadowTileResolution * 2;
            }
        }
        _getShadowBias(shadowProjectionMatrix, shadowResolution, out) {
            var frustumSize;
            frustumSize = 2.0 / shadowProjectionMatrix.elements[0];
            var texelSize = frustumSize / shadowResolution;
            var depthBias = -this._light.shadowDepthBias * texelSize;
            var normalBias = -this._light.shadowNormalBias * texelSize;
            if (this._light.shadowMode == Laya.ShadowMode.SoftHigh) {
                const kernelRadius = 2.5;
                depthBias *= kernelRadius;
                normalBias *= kernelRadius;
            }
            out.setValue(depthBias, normalBias, 0.0, 0.0);
        }
        _setupShadowCasterShaderValues(shaderValues, shadowSliceData, LightParam, shadowBias) {
            shaderValues.setVector(Laya.ShadowCasterPass.SHADOW_BIAS, shadowBias);
            shaderValues.setVector3(Laya.ShadowCasterPass.SHADOW_LIGHT_DIRECTION, LightParam);
            var cameraSV = shadowSliceData.cameraShaderValue;
            cameraSV.setMatrix4x4(Laya.BaseCamera.VIEWMATRIX, shadowSliceData.viewMatrix);
            cameraSV.setMatrix4x4(Laya.BaseCamera.PROJECTMATRIX, shadowSliceData.projectionMatrix);
            cameraSV.setMatrix4x4(Laya.BaseCamera.VIEWPROJECTMATRIX, shadowSliceData.viewProjectMatrix);
            shaderValues.setMatrix4x4(Laya.BaseCamera.VIEWPROJECTMATRIX, shadowSliceData.viewProjectMatrix);
        }
        _applyRenderData(scene, camera) {
            var light = this._light;
            if (light.shadowCascadesMode !== Laya.ShadowCascadesMode.NoCascades)
                scene.addDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_CASCADE);
            else
                scene.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_CASCADE);
            switch (light.shadowMode) {
                case Laya.ShadowMode.Hard:
                    scene.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SOFT_SHADOW_LOW);
                    scene.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SOFT_SHADOW_HIGH);
                    break;
                case Laya.ShadowMode.SoftLow:
                    scene.addDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SOFT_SHADOW_LOW);
                    scene.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SOFT_SHADOW_HIGH);
                    break;
                case Laya.ShadowMode.SoftHigh:
                    scene.addDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SOFT_SHADOW_HIGH);
                    scene.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SOFT_SHADOW_LOW);
                    break;
            }
            scene.setBuffer(Laya.ShadowCasterPass.SHADOW_MATRICES, this._shadowMatrices);
            scene.setVector(Laya.ShadowCasterPass.SHADOW_MAP_SIZE, this._shadowMapSize);
            scene.setBuffer(Laya.ShadowCasterPass.SHADOW_SPLIT_SPHERES, this._splitBoundSpheres);
        }
        _applyCasterPassCommandBuffer(context) {
            if (!this._shadowCasterCommanBuffer || this._shadowCasterCommanBuffer.length == 0)
                return;
            this._shadowCasterCommanBuffer.forEach(function (value) {
                value._apply();
            });
        }
        setShadowCasterCommanBuffer(cmd) {
            this._shadowCasterCommanBuffer = cmd;
        }
        _caculateDirCullInfo() {
            var splitDistance = this._cascadesSplitDistance;
            var frustumPlanes = this._frustumPlanes;
            var cameraNear = this._camera.nearplane;
            var shadowFar = Math.min(this._camera.farplane, this._light.shadowDistance);
            var shadowMatrices = this._shadowMatrices;
            var boundSpheres = this._splitBoundSpheres;
            Laya.ShadowUtils.getCascadesSplitDistance(this._light.shadowTwoCascadeSplits, this._light._shadowFourCascadeSplits, cameraNear, shadowFar, this._camera.fieldOfView * Laya.MathUtils3D.Deg2Rad, this._camera.aspectRatio, this._shadowCastMode, splitDistance);
            Laya.ShadowUtils.getCameraFrustumPlanes(this._camera._projectViewMatrix, frustumPlanes);
            var forward = Laya.Vector3.TEMP;
            this._camera.transform.getForward(forward);
            Laya.Vector3.normalize(forward, forward);
            for (var i = 0; i < this._cascadeCount; i++) {
                var sliceData = this._shadowSliceDatas[i];
                sliceData.sphereCenterZ = Laya.ShadowUtils.getBoundSphereByFrustum(splitDistance[i], splitDistance[i + 1], this._camera.fieldOfView * Laya.MathUtils3D.Deg2Rad, this._camera.aspectRatio, this._camera.transform.position, forward, sliceData.splitBoundSphere);
                Laya.ShadowUtils.getDirectionLightShadowCullPlanes(frustumPlanes, i, splitDistance, cameraNear, this._lightForward, sliceData);
                Laya.ShadowUtils.getDirectionalLightMatrices(this._lightup, this._lightSide, this._lightForward, i, this._light.shadowNearPlane, this._shadowTileResolution, sliceData, shadowMatrices);
                if (this._cascadeCount > 1)
                    Laya.ShadowUtils.applySliceTransform(sliceData, this._shadowMapWidth, this._shadowMapHeight, i, shadowMatrices);
            }
            Laya.ShadowUtils.prepareShadowReceiverShaderValues(this._shadowMapWidth, this._shadowMapHeight, this._shadowSliceDatas, this._cascadeCount, this._shadowMapSize, shadowMatrices, boundSpheres);
            for (var i = 0, n = this._cascadeCount; i < n; i++) {
                var shadowCullInfo = this._shadowCullInfo[i];
                var sliceData = this._shadowSliceDatas[i];
                shadowCullInfo.cameraPosition = this._camera.transform.position;
                shadowCullInfo.position = sliceData.position;
                shadowCullInfo.cullPlanes = sliceData.cullPlanes;
                shadowCullInfo.cullPlaneCount = sliceData.cullPlaneCount;
                shadowCullInfo.cullSphere = sliceData.splitBoundSphere;
                shadowCullInfo.direction = this._lightForward;
                let receiverMargin = 0;
                if (this._cascadeCount > 1) {
                    this._getShadowBias(sliceData.projectionMatrix, sliceData.resolution, this._shadowBias);
                    const texelSize = 2.0 / sliceData.projectionMatrix.elements[0] / sliceData.resolution;
                    const filterRadius = this._light.shadowMode === Laya.ShadowMode.SoftHigh ? 3.0
                        : this._light.shadowMode === Laya.ShadowMode.SoftLow ? 1.5 : 1.0;
                    receiverMargin = Math.SQRT2 * filterRadius * texelSize
                        + Math.abs(this._shadowBias.x) + Math.abs(this._shadowBias.y);
                }
                shadowCullInfo.prepareReceiverSphereCulling(this._cascadeCount > 1, receiverMargin);
            }
        }
        setCameraCullInfo(sceneManager) {
            let cullInfos = this._shadowCullInfo.slice(0, this._cascadeCount);
            let agent = sceneManager.batchAgentList;
            for (var [key, value] of agent) {
                value.setDirLightCullInfo(cullInfos);
            }
        }
        setRPData(dirLight, camera, context) {
            this._setLight(dirLight);
            this._camera = camera;
            this._destShadowRT = Laya.Scene3D._shadowCasterPass.getDirectLightShadowMap(dirLight);
            let v4 = context.sceneData.getVector(Laya.ShadowCasterPass.SHADOW_PARAMS);
            v4 = v4 ? v4 : new Laya.Vector4();
            v4.x = dirLight.shadowStrength;
            context.sceneData.setVector(Laya.ShadowCasterPass.SHADOW_PARAMS, v4);
            context.sceneData.setTexture(Laya.ShadowCasterPass.SHADOW_MAP, this._defaultShadowMap);
            this._caculateDirCullInfo();
        }
        update(context) {
            context.sceneData.addDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW);
            context.sceneData.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW_SPOT);
        }
        render(context, manager) {
            let shaderValues = context.sceneData;
            context.pipelineMode = "ShadowCaster";
            var shadowMap = this._destShadowRT;
            context.setRenderTarget(shadowMap._renderTarget, Laya.RenderClearFlag.Depth);
            let originCameraData = context.cameraData;
            let originInvertY = context.invertY;
            Laya.Viewport.TEMP.set(0, 0, this._shadowMapWidth, this._shadowMapHeight);
            Laya.Vector4.TEMP.setValue(0, 0, this._shadowMapWidth, this._shadowMapHeight);
            context.setViewPort(Laya.Viewport.TEMP);
            context.setScissor(Laya.Vector4.TEMP);
            context.setClearData(Laya.RenderClearFlag.Depth, Laya.Color.BLACK, 1, 0);
            context.clearRenderTarget();
            for (var i = 0, n = this._cascadeCount; i < n; i++) {
                var sliceData = this._shadowSliceDatas[i];
                this._getShadowBias(sliceData.projectionMatrix, sliceData.resolution, this._shadowBias);
                this._setupShadowCasterShaderValues(shaderValues, sliceData, this._lightForward, this._shadowBias);
                var shadowCullInfo = this._shadowCullInfo[i];
                let list = manager.baseRenderList;
                var time = Laya.Browser.now();
                RenderCullUtil.cullDirectLightShadow(shadowCullInfo, list.elements, list.length, this._renderQueue, context);
                let agent = manager.batchAgentList;
                for (var [key, agentModule] of agent) {
                    let agentrenderList = agentModule.appendRenderElement(Laya.BatchCullMode.DirectLight, i, context).opaqueList;
                    let element = agentrenderList.elements;
                    for (var jj = 0; jj < agentrenderList.length; jj++) {
                        this._renderQueue.addRenderElement(element[jj]);
                    }
                }
                Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_CullShadow, performance.now() - time);
                context.cameraData = sliceData.cameraShaderValue;
                context.invertY = false;
                context.cameraUpdateMask++;
                var resolution = sliceData.resolution;
                var offsetX = sliceData.offsetX;
                var offsetY = sliceData.offsetY;
                Laya.Viewport.TEMP.set(offsetX, offsetY, resolution, resolution);
                Laya.Vector4.TEMP.setValue(offsetX + 1, offsetY + 1, resolution - 2, resolution - 2);
                context.setViewPort(Laya.Viewport.TEMP);
                context.setScissor(Laya.Vector4.TEMP);
                if (this._renderQueue.elements.length > 0) {
                    this._renderQueue.renderQueue(context);
                }
                else {
                    context.clearRenderTarget();
                }
                Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_ShadowDrawCall, this._renderQueue.elements.length);
                this._applyCasterPassCommandBuffer(context);
            }
            this._applyRenderData(context.sceneData, context.cameraData);
            context.cameraData = originCameraData;
            context.invertY = originInvertY;
            context.cameraUpdateMask++;
        }
        useRPResource(context) {
            context.sceneData.addDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW);
            context.sceneData.setTexture(Laya.ShadowCasterPass.SHADOW_MAP, this._destShadowRT);
        }
        unuseRPResource(context) {
            context.sceneData.removeDefine(Laya.Scene3DShaderDeclaration.SHADERDEFINE_SHADOW);
        }
        destory() {
        }
    }
    WebDirCascadeShadowRP._maxCascades = 4;

    class WebGPUMeshInstanceUtil {
        static getInstanceBufferState(stateInfo, renderType, oriGeometry, newGeometry, oneBatchMark) {
            if (!stateInfo.state)
                stateInfo.state = new Laya.WebGPUBufferState();
            const oriBufferState = oriGeometry.bufferState;
            let vertexArray;
            let indexBuffer;
            if (WebGPUMeshInstanceUtil.mergeBigBuffer) {
                let v2 = Laya.Vector2.TEMP;
                let info = MergeMeshUtil.getMergeInfo(oriGeometry, newGeometry, v2);
                vertexArray = [info.vertexBuffer];
                indexBuffer = info.indexBuffer;
                oneBatchMark._Geo_IndexOffset = v2.x + oneBatchMark._Geo_IndexOriOffset;
            }
            else {
                vertexArray = oriBufferState._vertexBuffers.slice();
                indexBuffer = oriGeometry.bufferState._bindedIndexBuffer;
            }
            let worldMatVertex = stateInfo.worldInstanceVB;
            vertexArray.push(worldMatVertex);
            switch (renderType) {
                case Laya.BaseRenderType.MeshRender:
                    let instanceLightMapVertexBuffer = stateInfo.lightmapScaleOffsetVB;
                    vertexArray.push(instanceLightMapVertexBuffer);
                    break;
                case Laya.BaseRenderType.SimpleSkinRender:
                    let simpleAnimatorVertexBuffer = stateInfo.simpleAnimatorVB;
                    vertexArray.push(simpleAnimatorVertexBuffer);
                    break;
            }
            stateInfo.state.applyState(vertexArray, indexBuffer);
        }
    }
    WebGPUMeshInstanceUtil.mergeBigBuffer = true;
    class SingleLeakList {
        constructor() {
            this.elements = [];
            this.leakIndexList = [];
        }
        add(element) {
            let index = this.elements.indexOf(element);
            if (index != -1 && this.leakIndexList.indexOf(index) == -1)
                return index;
            if (this.leakIndexList.length >= 1) {
                index = this.leakIndexList.pop();
                this.elements[index] = element;
            }
            else {
                index = this.elements.length;
                this.elements.push(element);
            }
            return index;
        }
        remove(element) {
            let index = this.elements.indexOf(element);
            if (index != -1 && this.leakIndexList.indexOf(index) == -1) {
                this.leakIndexList.push(index);
                this.elements[index] = null;
            }
        }
        indexof(element) {
            let index = this.elements.indexOf(element);
            if (index != -1 && this.leakIndexList.indexOf(index) == -1)
                return index;
            else {
                return -1;
            }
        }
        release() {
            this.elements = null;
            this.leakIndexList = null;
        }
    }
    class WebGPUBatchQueue {
        constructor(createTransList) {
            this.opaqueCustomSort = true;
            this.transCustomSort = false;
            this.opaqueQueue = new RenderListQueue(false);
            this.opaqueList = this.opaqueQueue.elements;
            if (createTransList) {
                this.transparentQueue = new RenderListQueue(true);
                this.transparentList = this.transparentQueue.elements;
            }
        }
        clearList() {
            this.opaqueList.length = 0;
            this.transparentList && (this.transparentList.length = 0);
        }
        release() {
            if (this.transparentList) {
                this.transparentQueue.destroy();
                this.transparentList = null;
            }
            this.opaqueQueue.destroy();
            this.opaqueList = null;
        }
    }
    class renderNodeCustomData {
        constructor() {
        }
        _initData() {
            this.allBatch = true;
            this.hasBatch = false;
            this.cullPassIndex = -1;
            this.batchRecoards = [];
        }
        needCull(updateMark) {
            if (this.allBatch) {
                for (var i = 0; i < this.batchRecoards.length; i++) {
                    if (this.batchRecoards[i].batchMark.cullUpdateMark != updateMark)
                        return true;
                }
                return false;
            }
            else {
                return true;
            }
        }
    }
    class batchRecoard {
    }
    class WebGPUBatch_CullDataSet {
        static fillPlaneCullData(plane, index, data) {
            data[index] = plane.normal.x;
            data[index + 1] = plane.normal.y;
            data[index + 2] = plane.normal.z;
            data[index + 3] = plane.distance;
        }
        static fillCameraCullData(cameraCullInfo, index, data, dataUint32) {
            let boundFrustum = cameraCullInfo.boundFrustum;
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.near, index + 0, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.far, index + 4, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.left, index + 8, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.right, index + 12, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.top, index + 16, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.bottom, index + 20, data);
            let cameraPos = cameraCullInfo.position;
            data[index + 24] = cameraPos.x;
            data[index + 25] = cameraPos.y;
            data[index + 26] = cameraPos.z;
            dataUint32[index + 28] = 1;
            dataUint32[index + 29] = 1;
            dataUint32[index + 30] = 0;
            dataUint32[index + 31] = cameraCullInfo.cullingMask;
        }
        static fillDirCullData(cullInfo, index, data, dataUint32) {
            let planes = cullInfo.cullPlanes;
            WebGPUBatch_CullDataSet.fillPlaneCullData(planes[0], index + 0, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(planes[1], index + 4, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(planes[2], index + 8, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(planes[3], index + 12, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(planes[4], index + 16, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(planes[5], index + 20, data);
            let cameraPos = cullInfo.cameraPosition;
            data[index + 24] = cameraPos.x;
            data[index + 25] = cameraPos.y;
            data[index + 26] = cameraPos.z;
            dataUint32[index + 28] = 1;
            dataUint32[index + 29] = 1;
            dataUint32[index + 30] = 1;
            dataUint32[index + 31] = 0;
        }
        static fillNOCullData(index, dataUint32) {
            dataUint32[index + 28] = 0;
            dataUint32[index + 29] = 0;
            dataUint32[index + 30] = 0;
            dataUint32[index + 31] = 0;
        }
        static fillSpotCullData(spotCullInfo, index, data, dataUint32) {
            let boundFrustum = spotCullInfo.boundFrustum;
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.near, index + 0, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.far, index + 4, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.left, index + 8, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.right, index + 12, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.top, index + 16, data);
            WebGPUBatch_CullDataSet.fillPlaneCullData(boundFrustum.bottom, index + 20, data);
            let cameraPos = spotCullInfo.position;
            data[index + 24] = cameraPos.x;
            data[index + 25] = cameraPos.y;
            data[index + 26] = cameraPos.z;
            dataUint32[index + 28] = 1;
            dataUint32[index + 29] = 0;
            dataUint32[index + 30] = 1;
            dataUint32[index + 31] = 0;
        }
        static _commonCullByCameraCullInfo(cameraCullInfo, count, context, list, opaqueList, transparent, cullOutResoult) {
            const boundFrustum = cameraCullInfo.boundFrustum;
            const cullMask = cameraCullInfo.cullingMask;
            cameraCullInfo.staticMask;
            let render;
            let canPass;
            let updateMask = context.cameraUpdateMask;
            let listElements = list.elements;
            for (let i = 0; i < count; i++) {
                render = listElements[i];
                canPass = ((1 << render.layer) & cullMask) != 0 && (render.renderbitFlag == 0);
                render.customData;
                if (canPass && render._needRender(boundFrustum)) {
                    let distance = render.distanceForSort = Laya.Vector3.distanceSquared(render.bounds._imp.getCenter(), cameraCullInfo.position);
                    if (render.visibalRangeBit == 0 || (distance > render.visibalMin && distance < render.visibalMax)) {
                        render._renderUpdatePre(context);
                        if (render.renderNodeType == Laya.BaseRenderType.SkinnedMeshRender) {
                            cullOutResoult.forwardNeedUpdateNode.add(render);
                        }
                        let element;
                        const elements = render.renderelements;
                        let recoards = render.customData.batchRecoards;
                        for (let j = 0, len = elements.length; j < len; j++) {
                            element = elements[j];
                            let recoard = recoards[j];
                            if (recoard.canBatch && recoard.batchMark.canBatch) {
                                recoard.batchMark.cullUpdateMark = updateMask;
                            }
                            if (element.materialRenderQueue > 2500)
                                transparent.add(element);
                            else
                                opaqueList.add(element);
                        }
                    }
                }
            }
        }
        static cullByCameraCullInfo2(cameraCullInfo, cullNodeManager, cullOutResoult, transparent, context) {
            let list;
            let opaqueRes;
            let transRes;
            list = cullNodeManager._dynamicCullList;
            opaqueRes = cullOutResoult._dynamicCullResult;
            transRes = transparent.elements;
            cullOutResoult.forwardNeedUpdateNode.clear();
            WebGPUBatch_CullDataSet._commonCullByCameraCullInfo(cameraCullInfo, list.length, context, list, opaqueRes, transRes, cullOutResoult);
            if (cullOutResoult.needCullStatic) {
                list = cullNodeManager._staticCullList;
                opaqueRes = cullOutResoult._staticOpaqueCullResult;
                opaqueRes.clear();
                transRes = cullOutResoult._staticTransCullResult;
                transRes.clear();
                WebGPUBatch_CullDataSet._commonCullByCameraCullInfo(cameraCullInfo, list.length, context, list, opaqueRes, transRes, cullOutResoult);
            }
            list = cullNodeManager._oneBatchCullList;
            opaqueRes = cullOutResoult._tempList;
            transRes = cullOutResoult._tempList;
            WebGPUBatch_CullDataSet._commonCullByCameraCullInfo(cameraCullInfo, list.length, context, list, opaqueRes, transRes, cullOutResoult);
        }
        static _commonCullByDirectLightShadow(shadowCullInfo, list, count, opaqueList, context, cullOutResoult) {
            let updateMask = context.cameraUpdateMask;
            let elements = list.elements;
            for (let i = 0; i < count; i++) {
                const render = elements[i];
                let customData = render.customData;
                customData.cullMask = updateMask;
                if (render.shadowCullPass()) {
                    if (Laya.FrustumCulling.cullingRenderBounds(render.bounds, shadowCullInfo)) {
                        let distance = render.distanceForSort = Laya.Vector3.distanceSquared(render.bounds._imp.getCenter(), shadowCullInfo.cameraPosition);
                        if (render.visibalRangeBit == 0 || (distance > render.visibalMin && distance < render.visibalMax)) {
                            render._renderUpdatePre(context);
                            if (render.renderNodeType == Laya.BaseRenderType.SkinnedMeshRender) {
                                cullOutResoult.forwardNeedUpdateNode.add(render);
                            }
                            let element;
                            const elements = render.renderelements;
                            let recoards = render.customData.batchRecoards;
                            for (let j = 0, len = elements.length; j < len; j++) {
                                element = elements[j];
                                let recoard = recoards[j];
                                if (recoard.canBatch && recoard.batchMark.canBatch) {
                                    recoard.batchMark.cullUpdateMark = updateMask;
                                    continue;
                                }
                                if (element.materialRenderQueue < 2500)
                                    opaqueList.add(element);
                            }
                        }
                    }
                }
            }
        }
        static cullDirectLightShadow2(shadowCullInfo, cullNodeManager, cullOutResoult, context) {
            let list;
            let opaqueRes;
            cullOutResoult.forwardNeedUpdateNode.clear();
            list = cullNodeManager._dynamicCullList;
            opaqueRes = cullOutResoult._dynamicCullResult;
            WebGPUBatch_CullDataSet._commonCullByDirectLightShadow(shadowCullInfo, list, list.length, opaqueRes, context, cullOutResoult);
            if (cullOutResoult.needCullStatic) {
                list = cullNodeManager._staticCullList;
                opaqueRes = cullOutResoult._staticOpaqueCullResult;
                opaqueRes.clear();
                WebGPUBatch_CullDataSet._commonCullByDirectLightShadow(shadowCullInfo, list, list.length, opaqueRes, context, cullOutResoult);
            }
            list = cullNodeManager._oneBatchCullList;
            opaqueRes = cullOutResoult._tempList;
            WebGPUBatch_CullDataSet._commonCullByDirectLightShadow(shadowCullInfo, list, list.length, opaqueRes, context, cullOutResoult);
        }
        static cullSpotLightShadow2(spotCullInfo, cullNodeManager, cullOutResoult, context) {
            let list;
            let opaqueRes;
            cullOutResoult.forwardNeedUpdateNode.clear();
            list = cullNodeManager._dynamicCullList;
            opaqueRes = cullOutResoult._dynamicCullResult;
            WebGPUBatch_CullDataSet.cullSpotShadow(spotCullInfo, list, list.length, opaqueRes, context, cullOutResoult);
            if (cullOutResoult.needCullStatic) {
                list = cullNodeManager._staticCullList;
                opaqueRes = cullOutResoult._staticOpaqueCullResult;
                opaqueRes.clear();
                WebGPUBatch_CullDataSet.cullSpotShadow(spotCullInfo, list, list.length, opaqueRes, context, cullOutResoult);
            }
            list = cullNodeManager._oneBatchCullList;
            opaqueRes = cullOutResoult._tempList;
            WebGPUBatch_CullDataSet.cullSpotShadow(spotCullInfo, list, list.length, opaqueRes, context, cullOutResoult);
        }
        static quickOneMarkBatchCull(batch, cullMode, cullData, cullMask, cullInfoIndex) {
            let cullElement = batch.batchRenderList.elements;
            let cullLength = batch.batchRenderList.length;
            switch (cullMode) {
                case Laya.BatchCullMode.Camera:
                    let cullInfo = cullData;
                    const boundFrustum = cullData.boundFrustum;
                    for (var i = 0; i < cullLength; i++) {
                        let owner = cullElement[i].owner;
                        if (owner.customData.cullMask == cullMask)
                            continue;
                        else
                            owner.customData.cullMask = cullMask;
                        let distance = owner.distanceForSort = Laya.Vector3.distanceSquared(owner.bounds._imp.getCenter(), cullInfo.position);
                        if (owner.visibalRangeBit == 0 || (distance > owner.visibalMin && distance < owner.visibalMax)) {
                            if (owner._needRender(boundFrustum)) {
                                batch.cullUpdateMark = cullMask;
                                const elements = owner.renderelements;
                                if (elements.length > 1) {
                                    let recoards = owner.customData.batchRecoards;
                                    for (let j = 0, len = elements.length; j < len; j++) {
                                        let recoard = recoards[j];
                                        if (recoard.canBatch && recoard.batchMark.canBatch) {
                                            recoard.batchMark.cullUpdateMark = cullMask;
                                        }
                                    }
                                }
                                if (batch.cullAdditionalInfo.preCameraCullNode) {
                                    batch.owner._cacheCameraPreCullList.remove(batch.cullAdditionalInfo.preCameraCullNode);
                                }
                                batch.cullAdditionalInfo.preCameraCullNode = cullElement[i].owner;
                                batch.owner._cacheCameraPreCullList.add(cullElement[i].owner);
                                return true;
                            }
                        }
                    }
                    break;
                case Laya.BatchCullMode.DirectLight:
                    let dirCullInfo = cullData;
                    for (var i = 0; i < cullLength; i++) {
                        let owner = cullElement[i].owner;
                        if (owner.customData.cullMask == cullMask)
                            continue;
                        else
                            owner.customData.cullMask = cullMask;
                        let distance = owner.distanceForSort = Laya.Vector3.distanceSquared(owner.bounds._imp.getCenter(), dirCullInfo.cameraPosition);
                        if (owner.visibalRangeBit == 0 || (distance > owner.visibalMin && distance < owner.visibalMax)) {
                            if (Laya.FrustumCulling.cullingRenderBounds(owner.bounds, dirCullInfo)) {
                                batch.cullUpdateMark = cullMask;
                                const elements = owner.renderelements;
                                if (elements.length > 1) {
                                    let recoards = owner.customData.batchRecoards;
                                    for (let j = 0, len = elements.length; j < len; j++) {
                                        let recoard = recoards[j];
                                        if (recoard.canBatch && recoard.batchMark.canBatch) {
                                            recoard.batchMark.cullUpdateMark = cullMask;
                                        }
                                    }
                                }
                                if (batch.cullAdditionalInfo.preDirCullNode) {
                                    batch.owner._cacheDirPreCullList.remove(batch.cullAdditionalInfo.preDirCullNode);
                                }
                                batch.cullAdditionalInfo.preDirCullNode = cullElement[i].owner;
                                batch.owner._cacheDirPreCullList.add(cullElement[i].owner);
                                return true;
                            }
                        }
                    }
                    break;
                case Laya.BatchCullMode.Spot:
                    cullData.boundFrustum;
                    for (var i = 0; i < cullLength; i++) {
                        let owner = cullElement[i].owner;
                        if (owner.customData.cullMask == cullMask)
                            continue;
                        else
                            owner.customData.cullMask = cullMask;
                        if (owner._needRender(boundFrustum)) {
                            batch.cullUpdateMark = cullMask;
                            const elements = owner.renderelements;
                            if (elements.length > 1) {
                                let recoards = owner.customData.batchRecoards;
                                for (let j = 0, len = elements.length; j < len; j++) {
                                    let recoard = recoards[j];
                                    if (recoard.canBatch && recoard.batchMark.canBatch) {
                                        recoard.batchMark.cullUpdateMark = cullMask;
                                    }
                                }
                            }
                            if (batch.cullAdditionalInfo.preSpotCullNode) {
                                batch.owner._cacheSpotPreCullList.remove(batch.cullAdditionalInfo.preSpotCullNode);
                            }
                            batch.cullAdditionalInfo.preSpotCullNode = cullElement[i].owner;
                            batch.owner._cacheSpotPreCullList.add(cullElement[i].owner);
                            return true;
                        }
                    }
                    break;
            }
            return false;
        }
        static cullSpotShadow(cameraCullInfo, list, count, opaqueList, context, cullOutResoult) {
            opaqueList.clear();
            const boundFrustum = cameraCullInfo.boundFrustum;
            for (let i = 0; i < count; i++) {
                const render = list.elements[i];
                if (render.shadowCullPass()) {
                    let distance = render.distanceForSort = Laya.Vector3.distanceSquared(render.bounds._imp.getCenter(), cameraCullInfo.position);
                    if (render.visibalRangeBit == 0 || (distance > render.visibalMin && distance < render.visibalMax)) {
                        if (render._needRender(boundFrustum)) {
                            render._renderUpdatePre(context);
                            if (render.renderNodeType == Laya.BaseRenderType.SkinnedMeshRender) {
                                cullOutResoult.forwardNeedUpdateNode.add(render);
                            }
                            let element;
                            const elements = render.renderelements;
                            let recoards = render.customData.batchRecoards;
                            for (let j = 0, len = elements.length; j < len; j++) {
                                element = elements[j];
                                let recoard = recoards[j];
                                if (recoard.canBatch && recoard.batchMark.canBatch) {
                                    continue;
                                }
                                if (element.materialRenderQueue < 2500)
                                    opaqueList.add(element);
                            }
                        }
                    }
                }
            }
        }
    }
    class BatchMergeVertexInfo {
        constructor(vertexLength, indexLength, oriVertex) {
            this._cacheVertexInfo = new Map();
            this._cacheIndexInfo = new Map();
            this._curVertexCount = 0;
            this._curIndexCount = 0;
            this._curMaxVertexCount = 0;
            this._curMaxIndexCount = 0;
            this.vertexStride = oriVertex.vertexDeclaration.vertexStride / 4;
            let needVertexCount = this._curMaxVertexCount = (((vertexLength / 4 / BatchMergeVertexInfo.VertexBufferExtendCount) | 0) + 1) * BatchMergeVertexInfo.VertexBufferExtendCount;
            let needIndexCount = this._curMaxIndexCount = (((indexLength / 4 / BatchMergeVertexInfo.IndexBufferExtendCount) | 0) + 1) * BatchMergeVertexInfo.IndexBufferExtendCount;
            this._vertexData = new Float32Array(needVertexCount * this.vertexStride);
            this._indexData = new Uint32Array(needIndexCount);
            this.vertexBuffer = new Laya.WebGPUVertexBuffer(Laya.BufferTargetType.ARRAY_BUFFER, Laya.BufferUsage.Dynamic);
            this.vertexBuffer.setDataLength(needVertexCount * this.vertexStride * 4);
            this.vertexBuffer.vertexDeclaration = oriVertex.vertexDeclaration;
            this.indexBuffer = new Laya.WebGPUIndexBuffer(Laya.BufferTargetType.ELEMENT_ARRAY_BUFFER, Laya.BufferUsage.Dynamic);
            this.indexBuffer._setIndexDataLength(needIndexCount * 4);
            this.indexBuffer.indexType = Laya.IndexFormat.UInt32;
        }
        _extendIndexBuffer(count) {
            let needIndexCount = this._curMaxIndexCount = (((count / BatchMergeVertexInfo.IndexBufferExtendCount) | 0) + 1) * BatchMergeVertexInfo.IndexBufferExtendCount;
            this.indexBuffer._setIndexDataLength(needIndexCount * 4);
            let oldBuffer = this._indexData;
            this._indexData = new Uint32Array(needIndexCount);
            this._indexData.set(oldBuffer, 0);
        }
        _extendVertexBuffer(count) {
            let needVertexCount = this._curMaxVertexCount = (((count / BatchMergeVertexInfo.VertexBufferExtendCount) | 0) + 1) * BatchMergeVertexInfo.VertexBufferExtendCount;
            this.vertexBuffer.setDataLength(needVertexCount * this.vertexStride * 4);
            let oldBuffer = this._vertexData;
            this._vertexData = new Float32Array(needVertexCount * this.vertexStride);
            this._vertexData.set(oldBuffer, 0);
        }
        addMesh(MergVertexBuffer, MergeIndexBuffer, indexOffsetCount) {
            let needmergeVertex = false;
            let needMergeIndex = false;
            if (!this._cacheVertexInfo.has(MergVertexBuffer.globalId)) {
                needmergeVertex = true;
            }
            if (!this._cacheIndexInfo.has(MergeIndexBuffer.globalId)) {
                needMergeIndex = true;
            }
            if (!needmergeVertex && !needMergeIndex) {
                indexOffsetCount.x = this._cacheIndexInfo.get(MergeIndexBuffer.globalId);
                return;
            }
            if (needmergeVertex) {
                this._cacheVertexInfo.set(MergVertexBuffer.globalId, this._curVertexCount);
                let addVertexCount = MergVertexBuffer.buffer.byteLength / 4 / this.vertexStride;
                let needCount = this._curVertexCount + addVertexCount;
                let needExtendBuffer = false;
                if (needCount > this._curMaxVertexCount) {
                    this._extendVertexBuffer(needCount);
                    needExtendBuffer = true;
                }
                this._vertexData.set(new Float32Array(MergVertexBuffer.buffer), this._curVertexCount * this.vertexStride);
                if (needExtendBuffer) {
                    this.vertexBuffer.setData(this._vertexData.buffer, 0);
                }
                else {
                    let vertexOffset = this._curVertexCount * this.vertexStride * 4;
                    this.vertexBuffer.setData(this._vertexData.buffer, vertexOffset, vertexOffset, addVertexCount * this.vertexStride * 4);
                }
                this._curVertexCount += addVertexCount;
            }
            if (needMergeIndex) {
                let vertexOffset = this._cacheVertexInfo.get(MergVertexBuffer.globalId);
                let indexByteScale = MergeIndexBuffer.indexType == Laya.IndexFormat.UInt16 ? 2 : 4;
                let addIndexCount = MergeIndexBuffer.getNativeBuffer()._byteLength / indexByteScale;
                let CopyIndexbuffer = Laya.IndexFormat.UInt16 ? new Uint16Array(MergeIndexBuffer.buffer, MergeIndexBuffer.bufferoffset) : new Uint32Array(MergeIndexBuffer.buffer, MergeIndexBuffer.bufferoffset);
                let needCount = this._curIndexCount + addIndexCount;
                let needExtendBuffer = false;
                if (needCount > this._curMaxIndexCount) {
                    this._extendIndexBuffer(needCount);
                    needExtendBuffer = true;
                }
                this._cacheIndexInfo.set(MergeIndexBuffer.globalId, this._curIndexCount);
                for (var i = 0; i < addIndexCount; i++) {
                    this._indexData[this._curIndexCount + i] = CopyIndexbuffer[i] + vertexOffset;
                }
                if (needExtendBuffer) {
                    this.indexBuffer.setData(this._indexData.buffer, 0);
                }
                else {
                    let indexoffset = this._curIndexCount * 4;
                    this.indexBuffer.setData(this._indexData.buffer, indexoffset, indexoffset, addIndexCount * 4);
                }
                this._curIndexCount += addIndexCount;
            }
            indexOffsetCount.x = this._cacheIndexInfo.get(MergeIndexBuffer.globalId);
            return null;
        }
    }
    BatchMergeVertexInfo.VertexBufferExtendCount = 100000;
    BatchMergeVertexInfo.IndexBufferExtendCount = 100000;
    BatchMergeVertexInfo.indexFormat = Laya.IndexFormat.UInt32;
    class MergeMeshUtil {
        static getMergeInfo(mergeGeometry, newGeoemtty, outIndexOffsetCount) {
            let stateInfo = mergeGeometry.getStateCacheID();
            let mergeVertex = mergeGeometry._bufferState._vertexBuffers[0];
            let mergeIndex = mergeGeometry._bufferState._bindedIndexBuffer;
            let mergeInfo;
            let indexByteScale = 1;
            if (mergeGeometry.indexFormat == Laya.IndexFormat.UInt16) {
                indexByteScale = 2;
            }
            mergeInfo = MergeMeshUtil.vertexStateMap.get(stateInfo);
            if (!mergeInfo) {
                mergeInfo = new BatchMergeVertexInfo(mergeVertex.getNativeBuffer()._size, mergeIndex.getNativeBuffer()._size * indexByteScale, mergeVertex);
                MergeMeshUtil.vertexStateMap.set(stateInfo, mergeInfo);
            }
            else {
                mergeInfo = MergeMeshUtil.vertexStateMap.get(stateInfo);
            }
            mergeInfo.addMesh(mergeVertex, mergeIndex, outIndexOffsetCount);
            newGeoemtty.indexFormat = Laya.IndexFormat.UInt32;
            return mergeInfo;
        }
        static getMergeInfoNoIns(mergeGeometry, outIndexOffsetCount) {
            let stateInfo = mergeGeometry.getStateCacheID();
            let mergeVertex = mergeGeometry._bufferState._vertexBuffers[0];
            let mergeIndex = mergeGeometry._bufferState._bindedIndexBuffer;
            let mergeInfo;
            let indexByteScale = 1;
            if (mergeGeometry.indexFormat == Laya.IndexFormat.UInt16) {
                indexByteScale = 2;
            }
            mergeInfo = MergeMeshUtil.vertexStateMap.get(stateInfo);
            if (!mergeInfo) {
                mergeInfo = new BatchMergeVertexInfo(mergeVertex.getNativeBuffer()._size, mergeIndex.getNativeBuffer()._size * indexByteScale, mergeVertex);
                MergeMeshUtil.vertexStateMap.set(stateInfo, mergeInfo);
            }
            else {
                mergeInfo = MergeMeshUtil.vertexStateMap.get(stateInfo);
            }
            mergeInfo.addMesh(mergeVertex, mergeIndex, outIndexOffsetCount);
            return mergeInfo;
        }
    }
    MergeMeshUtil.vertexStateMap = new Map();
    class BatchAgentSortUtil {
        static quickSortInPlace(arr, low = 0, high = arr.length - 1) {
            BatchAgentSortUtil._sort(arr, low, high, BatchAgentSortUtil.getPivot1);
        }
        static quickSortInPlace2(arr, low = 0, high = arr.length - 1) {
            BatchAgentSortUtil._sort(arr, low, high, BatchAgentSortUtil.getPivot2);
        }
        static getPivot1(arr) {
            return arr.materialRenderQueue;
        }
        static getPivot2(arr) {
            return arr.materialRenderQueue + arr.geometry._bufferState.stateCacheID + arr.materialId;
        }
        static _sort(arr, low, high, keyOf) {
            while (low < high) {
                if (high - low < BatchAgentSortUtil._INSERTION_THRESHOLD) {
                    BatchAgentSortUtil._insertionSort(arr, low, high, keyOf);
                    return;
                }
                const pivot = keyOf(arr[BatchAgentSortUtil._medianOfThree(arr, low, high, keyOf)]);
                let lt = low, i = low, gt = high;
                while (i <= gt) {
                    const key = keyOf(arr[i]);
                    if (key < pivot) {
                        const temp = arr[i];
                        arr[i] = arr[lt];
                        arr[lt] = temp;
                        lt++;
                        i++;
                    }
                    else if (key > pivot) {
                        const temp = arr[i];
                        arr[i] = arr[gt];
                        arr[gt] = temp;
                        gt--;
                    }
                    else
                        i++;
                }
                if (lt - low < high - gt) {
                    BatchAgentSortUtil._sort(arr, low, lt - 1, keyOf);
                    low = gt + 1;
                }
                else {
                    BatchAgentSortUtil._sort(arr, gt + 1, high, keyOf);
                    high = lt - 1;
                }
            }
        }
        static _medianOfThree(arr, low, high, keyOf) {
            const mid = low + ((high - low) >> 1);
            const a = keyOf(arr[low]), b = keyOf(arr[mid]), c = keyOf(arr[high]);
            if (a < b) {
                if (b < c)
                    return mid;
                return a < c ? high : low;
            }
            if (a < c)
                return low;
            return b < c ? high : mid;
        }
        static _insertionSort(arr, low, high, keyOf) {
            for (let i = low + 1; i <= high; i++) {
                const current = arr[i];
                const key = keyOf(current);
                let j = i - 1;
                while (j >= low && keyOf(arr[j]) > key) {
                    arr[j + 1] = arr[j];
                    j--;
                }
                arr[j + 1] = current;
            }
        }
    }
    BatchAgentSortUtil._INSERTION_THRESHOLD = 16;

    var CullResourceCommon = "struct IndirectArgs{uint drawCount;uint instanceCount;uint reserved0;uint reserved1;uint instanceoffset;};struct gpu_instanceData{mat4 insWorldMat;vec4 lightMapUV;vec4 customData;\n#ifdef SIMPLEBONE\nvec4 simpleSkinParam;\n#endif\n};struct worldInsInfo{mat4 WorldMat;vec4 worldCustom;};buffer IndirectArgsBuffer{IndirectArgs indirectArgs[];};readonly buffer BatchPosBuffer{uint batchPosBuffer[];};readonly buffer CullResourtBuffer{uint cullResourt[];};readonly buffer ElementsInfoBuffer{uvec2 elementsInfoBuffer[];};readonly buffer InstanceDatasBuffer{gpu_instanceData instanceDatas[];};buffer WorldInsDatasBuffer{worldInsInfo worldinsDatas[];};buffer LightmapOffsetDatasBuffer{vec4 lightmapOffsetDatas[];};buffer SimpleSkinInsDatasBuffer{vec4 simpleSkinInsDatas[];};";

    var ClearCullResultCode = "#include \"CullResourceCommon.glsl\"\nlayout(local_size_x=64,local_size_y=1,local_size_z=1)in;void main(){uint instanceIndex=gl_GlobalInvocationID.x;uint batchCount=u_getResultParamsArray[0].x;if(instanceIndex>=batchCount){return;}atomicExchange(indirectArgs[instanceIndex].instanceCount,0u);indirectArgs[instanceIndex].instanceoffset=batchPosBuffer[instanceIndex];}";

    var GetCullResultCode = "#include \"CullResourceCommon.glsl\"\nlayout(local_size_x=64,local_size_y=1,local_size_z=1)in;void main(){uint instanceIndex=gl_GlobalInvocationID.x;uint elementCount=u_getResultParamsArray[0].y;if(instanceIndex>=elementCount){return;}uint cullbit=1u<<u_getResultParamsArray[0].z;uvec2 elementinfo=elementsInfoBuffer[instanceIndex];uint nodeIndex=elementinfo.x;uint batchIndex=elementinfo.y;uint cull=cullResourt[nodeIndex];if((cullbit&cull)>0u){uint culledIndex=atomicAdd(indirectArgs[batchIndex].instanceCount,1u);uint batchStart=batchPosBuffer[batchIndex];uint insdataPosIndex=culledIndex+batchStart;worldinsDatas[insdataPosIndex].WorldMat=instanceDatas[nodeIndex].insWorldMat;worldinsDatas[insdataPosIndex].worldCustom=instanceDatas[nodeIndex].customData;lightmapOffsetDatas[insdataPosIndex]=instanceDatas[nodeIndex].lightMapUV;\n#ifdef SIMPLEBONE\nsimpleSkinInsDatas[insdataPosIndex]=instanceDatas[nodeIndex].simpleSkinParam;\n#endif\n}}";

    var CullBatchComputeCode = "layout(local_size_x=64,local_size_y=1,local_size_z=1)in;struct Plane{vec3 normal;float distance;};struct oneCull{vec4 planes[6];vec4 cullPos;uvec4 otherData;};struct insCullData{vec4 min;vec4 max;uvec4 layer_CastShadow_other;};readonly buffer CullInfoDatas{insCullData cullInfoDatas[];};buffer CullResourtBuffer{uint cullResourt[];};bool isPatchRenderLayer(insCullData ins,oneCull cull){bool needCheckRenderLayer=cull.otherData.z<1u;if(needCheckRenderLayer){return(cull.otherData.w&(1u<<ins.layer_CastShadow_other.x))>0u;}else{return ins.layer_CastShadow_other.y>0u;}}float distanceToPlane(vec3 point,vec4 plane){return dot(plane.xyz,point)+plane.w;}bool isAABBInFrontOfPlane(insCullData aabb,vec4 plane){vec3 center=(aabb.min.xyz+aabb.max.xyz)*0.5;vec3 halfSize=(aabb.max.xyz-aabb.min.xyz)*0.5;float projectionRadius=dot(abs(plane.xyz),halfSize);float distanceToCenter=distanceToPlane(center,plane);return distanceToCenter>-projectionRadius;}float distance_point_to_aabb(vec3 point,vec3 aabb_min,vec3 aabb_max){vec3 dif=point-(aabb_min+aabb_max)*0.5;return dot(dif,dif);}float keepThreeDecimals(float value){return floor(value);}bool isRangeVisible(insCullData aabb,oneCull culldata){if(culldata.otherData.y<1u||aabb.layer_CastShadow_other.z==0u){return true;}float dis=(distance_point_to_aabb(culldata.cullPos.xyz,aabb.min.xyz,aabb.max.xyz));return dis>aabb.min.w&&dis<aabb.max.w;}bool isAABBVisible(insCullData aabb,oneCull cullData){for(uint i=0u;i<6u;i++){vec4 cullPlane=cullData.planes[i];if(!isAABBInFrontOfPlane(aabb,cullPlane)){return false;}}return true;}oneCull getOneCull(uint index){oneCull c;uint base=index*8;c.planes[0]=u_CullInfos[base+0];c.planes[1]=u_CullInfos[base+1];c.planes[2]=u_CullInfos[base+2];c.planes[3]=u_CullInfos[base+3];c.planes[4]=u_CullInfos[base+4];c.planes[5]=u_CullInfos[base+5];c.cullPos=u_CullInfos[base+6];c.otherData=floatBitsToUint(u_CullInfos[base+7]);return c;}void main(){uint instanceIndex=gl_GlobalInvocationID.x;if(instanceIndex>=u_computeMaxID){return;}insCullData _inscullInfo=cullInfoDatas[instanceIndex];uint _bitValue=0u;for(uint i=0u;i<6u;i++){uint _bit=1u<<i;oneCull _cullInfo=getOneCull(i);if(_cullInfo.otherData.x<1u){continue;}if(!isPatchRenderLayer(_inscullInfo,_cullInfo)){continue;}if(!isRangeVisible(_inscullInfo,_cullInfo)){continue;}if(!isAABBVisible(_inscullInfo,_cullInfo)){continue;}_bitValue=_bitValue+_bit;}cullResourt[instanceIndex]=_bitValue;}";

    class WebGPUMeshBathShaderInit {
        static init() {
            this._createComputeShader();
            this._createClearCoumputeShader();
            WebGPUMeshBathShaderInit.inited = true;
        }
        static _createComputeShader() {
            let uniformMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("BatchCull_CullInfos");
            uniformMap.addShaderUniformArray(Laya.Shader3D.propertyNameToID("u_CullInfos"), "u_CullInfos", Laya.ShaderDataType.Vector4, BatchCullPass.TotleCullNeedV4Count);
            uniformMap.addShaderUniform(Laya.Shader3D.propertyNameToID("u_computeMaxID"), "u_computeMaxID", Laya.ShaderDataType.Int);
            let uniformMap1 = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("BatchCull_NodeInfo");
            uniformMap1.addShaderUniform(Laya.Shader3D.propertyNameToID("CullInfoDatas"), "CullInfoDatas", Laya.ShaderDataType.ReadOnlyDeviceBuffer);
            uniformMap1.addShaderUniform(Laya.Shader3D.propertyNameToID("CullResourtBuffer"), "CullResourtBuffer", Laya.ShaderDataType.DeviceBuffer);
            let computeShader = Laya.ComputeShader.createComputeShader(`cullBatchCompute`, CullBatchComputeCode, [uniformMap, uniformMap1]);
            WebGPUMeshBathShaderInit.cullComputeShader = computeShader;
        }
        static _createClearCoumputeShader() {
            let uniformMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("BatchCull_getResultParams");
            uniformMap.addShaderUniformArray(Laya.Shader3D.propertyNameToID("u_getResultParamsArray"), "u_getResultParamsArray", Laya.ShaderDataType.Vector4u, 2);
            let uniformMap1 = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("BatchCull_getResultNode");
            uniformMap1.addShaderUniform(Laya.Shader3D.propertyNameToID("IndirectArgsBuffer"), "IndirectArgsBuffer", Laya.ShaderDataType.DeviceBuffer);
            uniformMap1.addShaderUniform(Laya.Shader3D.propertyNameToID("BatchPosBuffer"), "BatchPosBuffer", Laya.ShaderDataType.ReadOnlyDeviceBuffer);
            uniformMap1.addShaderUniform(Laya.Shader3D.propertyNameToID("CullResourtBuffer"), "CullResourtBuffer", Laya.ShaderDataType.ReadOnlyDeviceBuffer);
            uniformMap1.addShaderUniform(Laya.Shader3D.propertyNameToID("ElementsInfoBuffer"), "ElementsInfoBuffer", Laya.ShaderDataType.ReadOnlyDeviceBuffer);
            uniformMap1.addShaderUniform(Laya.Shader3D.propertyNameToID("InstanceDatasBuffer"), "InstanceDatasBuffer", Laya.ShaderDataType.ReadOnlyDeviceBuffer);
            uniformMap1.addShaderUniform(Laya.Shader3D.propertyNameToID("WorldInsDatasBuffer"), "WorldInsDatasBuffer", Laya.ShaderDataType.DeviceBuffer);
            uniformMap1.addShaderUniform(Laya.Shader3D.propertyNameToID("LightmapOffsetDatasBuffer"), "LightmapOffsetDatasBuffer", Laya.ShaderDataType.DeviceBuffer);
            uniformMap1.addShaderUniform(Laya.Shader3D.propertyNameToID("SimpleSkinInsDatasBuffer"), "SimpleSkinInsDatasBuffer", Laya.ShaderDataType.DeviceBuffer);
            Laya.Shader3D.addInclude("CullResourceCommon.glsl", CullResourceCommon);
            WebGPUMeshBathShaderInit.getCullResoultComputeShader = Laya.ComputeShader.createComputeShader("GetRenderResult", GetCullResultCode, [uniformMap, uniformMap1]);
            WebGPUMeshBathShaderInit.clearCullResourceShader = Laya.ComputeShader.createComputeShader("ClearCullResult", ClearCullResultCode, [uniformMap, uniformMap1]);
        }
        static _initRenderMap() {
            const spriteParms = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("StorageInstanceBatch");
            spriteParms.addShaderUniform(Laya.Shader3D.propertyNameToID("instanceIDBuffer"), "instanceIDBuffer", Laya.ShaderDataType.ReadOnlyDeviceBuffer);
            spriteParms.addShaderUniform(Laya.Shader3D.propertyNameToID("BatchPosBuffer"), "BatchPosBuffer", Laya.ShaderDataType.ReadOnlyDeviceBuffer);
            spriteParms.addShaderUniform(Laya.Shader3D.propertyNameToID("InstanceDatasBuffer"), "InstanceDatasBuffer", Laya.ShaderDataType.ReadOnlyDeviceBuffer);
            spriteParms.addShaderUniform(Laya.Shader3D.propertyNameToID("u_oneBathMarkIndex"), "u_oneBathMarkIndex", Laya.ShaderDataType.Vector4);
        }
    }
    WebGPUMeshBathShaderInit.inited = false;
    WebGPUMeshBathShaderInit.renderCommandMap = "StorageInstanceBatch";

    const LargeData = Number.MAX_SAFE_INTEGER;
    class BatchCullPass {
        get renderType() {
            return this._renderType;
        }
        constructor(renderType) {
            this.oneBatchMarks = new SingleLeakList();
            this.renderNodes = new SingleLeakList();
            this.renderOneBatchs = new Laya.SingletonList();
            this.bufferUpdate_CullNodes = new Laya.Vector2(LargeData, -LargeData);
            this.bufferUpdate_InstanceData = new Laya.Vector2(LargeData, -LargeData);
            this.bufferUpdate_IndirectDrawBuffer = new Laya.Vector2(LargeData, -LargeData);
            this.bufferUpdate_renderElementsInfo = new Laya.Vector2(LargeData, -LargeData);
            this.worldInstanceStride = 20;
            this.LightmapScaleOffsetStride = 4;
            this.simpleSkinInstanceStride = 4;
            this._cullElementCount = 0;
            this.maxCullPlane = 5;
            this._cullShaderList = [];
            this._getResoultShaderList = [];
            this._dispartchParams = new Laya.Vector3();
            this._maxRenderNodeCount = 500;
            this._extendRenderNodeCount = 100;
            this._maxRenderElementCount = 500;
            this._extendELementNodeCount = 100;
            this._maxBatchCount = 100;
            this._extendBatchCount = 10;
            this._deviceBufferChange = 0;
            this._IndirectDrawBufferChange = 0;
            this._quickSortList = new Laya.FastSinglelist();
            this._cacheCameraPreCullList = new Laya.SingletonList();
            this._cacheDirPreCullList = new Laya.SingletonList();
            this._cacheSpotPreCullList = new Laya.SingletonList();
            this._needCreateRenderElementBatch = new Laya.SingletonList();
            this._getResultParamsArray = new Uint32Array(8);
            this._renderType = renderType;
            this._computeShader = WebGPUMeshBathShaderInit.cullComputeShader;
            this._getCullResoultShader = WebGPUMeshBathShaderInit.getCullResoultComputeShader;
            this._clearCullResShader = WebGPUMeshBathShaderInit.clearCullResourceShader;
            this._configStructDataOffset();
            this._createBufferAndData();
            this._initComputeShader();
        }
        _createBufferAndData() {
            let floatCount = this._maxRenderNodeCount * this._wholeCullStride;
            this.deviceBuffer_CullInfos = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST | Laya.EDeviceBufferUsage.COPY_SRC);
            this.deviceBuffer_CullInfos.setDataLength(floatCount * 4);
            this.buffer_CullNodes = new Float32Array(floatCount);
            this.buffer_CullNodes_uint32 = new Uint32Array(this.buffer_CullNodes.buffer);
            floatCount = this._maxRenderNodeCount * this._wholeInsStride;
            this.deviceBuffer_InstanceData = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST | Laya.EDeviceBufferUsage.COPY_SRC);
            this.deviceBuffer_InstanceData.setDataLength(floatCount * 4);
            this.buffer_InstanceData = new Float32Array(floatCount);
            this.deviceBuffer_CullResourse = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST);
            this.deviceBuffer_CullResourse.setDataLength(this._maxRenderNodeCount * 4);
            this.deviceBuffer_IndirectDrawBuffer = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.INDIRECT | Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST);
            this.deviceBuffer_IndirectDrawBuffer.setDataLength(this._maxBatchCount * 5 * 4);
            this.buffer_IndirectDrawBuffer = new Uint32Array(this._maxBatchCount * 5);
            this.deviceBuffer_batchPosBuffer = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST);
            this.deviceBuffer_batchPosBuffer.setDataLength(this._maxBatchCount * 4);
            this.batchPosBuffer = new Uint32Array(this._maxBatchCount);
            this.vertexBuffer_worldInstance = new Laya.WebGPUVertexBuffer(Laya.BufferTargetType.TRANSFORM_FEEDBACK_BUFFER, Laya.BufferUsage.Dynamic);
            this.deviceBuffer_worldInstance = this.vertexBuffer_worldInstance.getStorageBuffer();
            this.vertexBuffer_worldInstance.setDataLength(this._maxRenderElementCount * this.worldInstanceStride * 4);
            this.vertexBuffer_worldInstance.vertexDeclaration = Laya.VertexMesh.instanceWorldMatrixDeclaration;
            this.vertexBuffer_worldInstance.instanceBuffer = true;
            this.vertexBuffer_LightmapScaleOffset = new Laya.WebGPUVertexBuffer(Laya.BufferTargetType.TRANSFORM_FEEDBACK_BUFFER, Laya.BufferUsage.Dynamic);
            this.deviceBuffer_LightmapScaleOffset = this.vertexBuffer_LightmapScaleOffset.getStorageBuffer();
            this.vertexBuffer_LightmapScaleOffset.setDataLength(this._maxRenderElementCount * this.LightmapScaleOffsetStride * 4);
            this.vertexBuffer_LightmapScaleOffset.vertexDeclaration = Laya.VertexMesh.instanceLightMapScaleOffsetDeclaration;
            this.vertexBuffer_LightmapScaleOffset.instanceBuffer = true;
            {
                this.vertexBuffer_simpleSkinInstance = new Laya.WebGPUVertexBuffer(Laya.BufferTargetType.TRANSFORM_FEEDBACK_BUFFER, Laya.BufferUsage.Dynamic);
                this.deviceBuffer_simpleSkinInstance = this.vertexBuffer_simpleSkinInstance.getStorageBuffer();
                let dataLength = 4;
                if (this._renderType == Laya.BaseRenderType.SimpleSkinRender) {
                    dataLength = this._maxRenderElementCount * this.simpleSkinInstanceStride * 4;
                }
                this.vertexBuffer_simpleSkinInstance.setDataLength(dataLength);
                this.vertexBuffer_simpleSkinInstance.vertexDeclaration = Laya.VertexMesh.instanceSimpleAnimatorDeclaration;
                this.vertexBuffer_simpleSkinInstance.instanceBuffer = true;
            }
            this.deviceBuffer_renderElementsInfo = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST | Laya.EDeviceBufferUsage.COPY_SRC);
            this.deviceBuffer_renderElementsInfo.setDataLength(this._maxRenderElementCount * 2 * 4);
            this.buffer_renderElementsInfo = new Uint32Array(this._maxRenderElementCount * 2);
            this._deviceBufferChange = Laya.Stat.loopCount;
            this._IndirectDrawBufferChange = Laya.Stat.loopCount;
        }
        _extendRenderNodeBuffer(count) {
            this._maxRenderNodeCount = (((count / this._extendRenderNodeCount) | 0) + 1) * this._extendRenderNodeCount;
            let floatCount = this._maxRenderNodeCount * this._wholeCullStride;
            this.deviceBuffer_CullInfos.destroy();
            this.deviceBuffer_CullInfos = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST | Laya.EDeviceBufferUsage.COPY_SRC);
            this.deviceBuffer_CullInfos.setDataLength(floatCount * 4);
            let oldBuffer = this.buffer_CullNodes;
            this.buffer_CullNodes = new Float32Array(floatCount);
            this.buffer_CullNodes_uint32 = new Uint32Array(this.buffer_CullNodes.buffer);
            this.buffer_CullNodes.set(oldBuffer, 0);
            this.bufferUpdate_CullNodes.x = 0;
            this.bufferUpdate_CullNodes.y = this._maxRenderNodeCount - 1;
            floatCount = this._maxRenderNodeCount * this._wholeInsStride;
            this.deviceBuffer_InstanceData.destroy();
            this.deviceBuffer_InstanceData = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST | Laya.EDeviceBufferUsage.COPY_SRC);
            this.deviceBuffer_InstanceData.setDataLength(floatCount * 4);
            oldBuffer = this.buffer_InstanceData;
            this.buffer_InstanceData = new Float32Array(floatCount);
            this.buffer_InstanceData.set(oldBuffer, 0);
            this.bufferUpdate_InstanceData.x = 0;
            this.bufferUpdate_InstanceData.y = this._maxRenderNodeCount - 1;
            this.deviceBuffer_CullResourse.destroy();
            this.deviceBuffer_CullResourse = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST);
            this.deviceBuffer_CullResourse.setDataLength(this._maxRenderNodeCount * 4);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("CullInfoDatas"), this.deviceBuffer_CullInfos);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("InstanceDatasBuffer"), this.deviceBuffer_InstanceData);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("CullResourtBuffer"), this.deviceBuffer_CullResourse);
            this._deviceBufferChange = Laya.Stat.loopCount;
        }
        _extendBatchCountBuffer(count) {
            this._maxBatchCount = (((count / this._extendBatchCount) | 0) + 1) * this._extendBatchCount;
            this.deviceBuffer_IndirectDrawBuffer.destroy();
            this.deviceBuffer_IndirectDrawBuffer = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.INDIRECT | Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST);
            this.deviceBuffer_IndirectDrawBuffer.setDataLength(this._maxBatchCount * 5 * 4);
            let oldBuffer = this.buffer_IndirectDrawBuffer;
            this.buffer_IndirectDrawBuffer = new Uint32Array(this._maxBatchCount * 5);
            this.buffer_IndirectDrawBuffer.set(oldBuffer, 0);
            this.bufferUpdate_IndirectDrawBuffer.x = 0;
            this.bufferUpdate_IndirectDrawBuffer.y = this._maxBatchCount - 1;
            this.deviceBuffer_batchPosBuffer.destroy();
            this.deviceBuffer_batchPosBuffer = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST);
            this.deviceBuffer_batchPosBuffer.setDataLength(this._maxBatchCount * 4);
            oldBuffer = this.batchPosBuffer;
            this.batchPosBuffer = new Uint32Array(this._maxBatchCount);
            this.batchPosBuffer.set(oldBuffer, 0);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("IndirectArgsBuffer"), this.deviceBuffer_IndirectDrawBuffer);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("BatchPosBuffer"), this.deviceBuffer_batchPosBuffer);
            this._deviceBufferChange = Laya.Stat.loopCount;
            this._IndirectDrawBufferChange = Laya.Stat.loopCount;
        }
        _extendRenderElementCountBuffer(count) {
            this._maxRenderElementCount = (((count / this._extendELementNodeCount) | 0) + 1) * this._extendELementNodeCount;
            this.vertexBuffer_worldInstance.destroy();
            this.vertexBuffer_worldInstance = new Laya.WebGPUVertexBuffer(Laya.BufferTargetType.TRANSFORM_FEEDBACK_BUFFER, Laya.BufferUsage.Dynamic);
            this.deviceBuffer_worldInstance = this.vertexBuffer_worldInstance.getStorageBuffer();
            this.vertexBuffer_worldInstance.setDataLength(this._maxRenderElementCount * this.worldInstanceStride * 4);
            this.vertexBuffer_worldInstance.vertexDeclaration = Laya.VertexMesh.instanceWorldMatrixDeclaration;
            this.vertexBuffer_worldInstance.instanceBuffer = true;
            this.vertexBuffer_LightmapScaleOffset.destroy();
            this.vertexBuffer_LightmapScaleOffset = new Laya.WebGPUVertexBuffer(Laya.BufferTargetType.TRANSFORM_FEEDBACK_BUFFER, Laya.BufferUsage.Dynamic);
            this.deviceBuffer_LightmapScaleOffset = this.vertexBuffer_LightmapScaleOffset.getStorageBuffer();
            this.vertexBuffer_LightmapScaleOffset.setDataLength(this._maxRenderElementCount * this.LightmapScaleOffsetStride * 4);
            this.vertexBuffer_LightmapScaleOffset.vertexDeclaration = Laya.VertexMesh.instanceLightMapScaleOffsetDeclaration;
            this.vertexBuffer_LightmapScaleOffset.instanceBuffer = true;
            if (this._renderType == Laya.BaseRenderType.SimpleSkinRender) {
                this.vertexBuffer_simpleSkinInstance.destroy();
                this.vertexBuffer_simpleSkinInstance = new Laya.WebGPUVertexBuffer(Laya.BufferTargetType.TRANSFORM_FEEDBACK_BUFFER, Laya.BufferUsage.Dynamic);
                this.deviceBuffer_simpleSkinInstance = this.vertexBuffer_simpleSkinInstance.getStorageBuffer();
                this.vertexBuffer_simpleSkinInstance.setDataLength(this._maxRenderElementCount * this.simpleSkinInstanceStride * 4);
                this.vertexBuffer_simpleSkinInstance.vertexDeclaration = Laya.VertexMesh.instanceSimpleAnimatorDeclaration;
                this.vertexBuffer_simpleSkinInstance.instanceBuffer = true;
            }
            this.deviceBuffer_renderElementsInfo.destroy();
            this.deviceBuffer_renderElementsInfo = Laya.LayaGL.renderDeviceFactory.createDeviceBuffer(Laya.EDeviceBufferUsage.STORAGE | Laya.EDeviceBufferUsage.COPY_DST | Laya.EDeviceBufferUsage.COPY_SRC);
            this.deviceBuffer_renderElementsInfo.setDataLength(this._maxRenderElementCount * 2 * 4);
            let oldBuffer = this.buffer_renderElementsInfo;
            this.buffer_renderElementsInfo = new Uint32Array(this._maxRenderElementCount * 2);
            this.buffer_renderElementsInfo.set(oldBuffer, 0);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("WorldInsDatasBuffer"), this.deviceBuffer_worldInstance);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("LightmapOffsetDatasBuffer"), this.deviceBuffer_LightmapScaleOffset);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("SimpleSkinInsDatasBuffer"), this.deviceBuffer_simpleSkinInstance);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("ElementsInfoBuffer"), this.deviceBuffer_renderElementsInfo);
            this._deviceBufferChange = Laya.Stat.loopCount;
        }
        _initComputeShader() {
            this._cullPlaneData = new Float32Array(BatchCullPass.oneCullNeedFloatCount * this.maxCullPlane);
            this._cullPlaneData_Uint32 = new Uint32Array(this._cullPlaneData.buffer);
            this._computeCommandBuffer = new Laya.ComputeCommandBuffer();
            this._cullShaderData = Laya.LayaGL.renderDeviceFactory.createShaderData();
            this._cullShaderList.length = 2;
            this._cullShaderList[0] = this._cullShaderData;
            let shaderData1 = this._deviceBufferShaderData = Laya.LayaGL.renderDeviceFactory.createShaderData();
            this._cullShaderList[1] = shaderData1;
            this._setDeviceBuffer();
            this._shaderDefine = Laya.LayaGL.unitRenderModuleDataFactory.createDefineDatas();
            if (this._renderType == Laya.BaseRenderType.SimpleSkinRender) {
                this._shaderDefine.add(Laya.SkinnedMeshSprite3DShaderDeclaration.SHADERDEFINE_SIMPLEBONE);
            }
            this._getCullInfoCommandBuffer = new Laya.ComputeCommandBuffer();
            this._getResoultShaderData = Laya.LayaGL.renderDeviceFactory.createShaderData();
            this._getResoultShaderList.length = 2;
            this._getResoultShaderList[0] = this._getResoultShaderData;
            this._getResoultShaderList[1] = shaderData1;
        }
        _setDeviceBuffer() {
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("CullInfoDatas"), this.deviceBuffer_CullInfos);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("InstanceDatasBuffer"), this.deviceBuffer_InstanceData);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("CullResourtBuffer"), this.deviceBuffer_CullResourse);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("IndirectArgsBuffer"), this.deviceBuffer_IndirectDrawBuffer);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("BatchPosBuffer"), this.deviceBuffer_batchPosBuffer);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("WorldInsDatasBuffer"), this.deviceBuffer_worldInstance);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("SimpleSkinInsDatasBuffer"), this.deviceBuffer_simpleSkinInstance);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("LightmapOffsetDatasBuffer"), this.deviceBuffer_LightmapScaleOffset);
            this._deviceBufferShaderData.setDeviceBuffer(Laya.Shader3D.propertyNameToID("ElementsInfoBuffer"), this.deviceBuffer_renderElementsInfo);
        }
        _configStructDataOffset() {
            this._wholeCullStride = 12;
            this._worldParamsOffset = 20;
            this._wholeInsStride = 24;
            if (this._renderType == Laya.BaseRenderType.SimpleSkinRender) {
                this._wholeInsStride += 4;
            }
        }
        addNode(insCullInfo) {
            let index = this.renderNodes.add(insCullInfo);
            insCullInfo.customData.cullPassIndex = index;
            return index;
        }
        removeNode(insCullInfo) {
            if (this.renderNodes.indexof(insCullInfo) != -1) {
                this.renderNodes.remove(insCullInfo);
            }
            return;
        }
        hasNode(insCullInfo) {
            return this.renderNodes.indexof(insCullInfo) != -1;
        }
        updateData(nodes) {
            if (nodes.length == 0)
                return;
            let elements = nodes.elements;
            let node;
            let nodeData;
            let min = LargeData;
            let max = 0;
            if (this.renderNodes.elements.length > this._maxRenderNodeCount) {
                this._extendRenderNodeBuffer(this.renderNodes.elements.length);
            }
            let visibalMin;
            let visibalMax;
            for (var i = 0, n = nodes.length; i < n; i++) {
                node = elements[i];
                if (node.visibalRangeBit != 0) {
                    visibalMin = node.visibalMin;
                    visibalMax = node.visibalMax;
                }
                else {
                    visibalMin = 0;
                    visibalMax = 0;
                }
                nodeData = node.customData;
                let cullPassIndex = nodeData.cullPassIndex;
                min = min < cullPassIndex ? min : cullPassIndex;
                max = max > cullPassIndex ? max : cullPassIndex;
                let cullDataIndex = cullPassIndex * this._wholeCullStride;
                let boundMax = node.bounds.getMax();
                let boundMin = node.bounds.getMin();
                this.buffer_CullNodes[cullDataIndex] = boundMin.x;
                this.buffer_CullNodes[cullDataIndex + 1] = boundMin.y;
                this.buffer_CullNodes[cullDataIndex + 2] = boundMin.z;
                this.buffer_CullNodes[cullDataIndex + 3] = visibalMin;
                this.buffer_CullNodes[cullDataIndex + 4] = boundMax.x;
                this.buffer_CullNodes[cullDataIndex + 5] = boundMax.y;
                this.buffer_CullNodes[cullDataIndex + 6] = boundMax.z;
                this.buffer_CullNodes[cullDataIndex + 7] = visibalMax;
                this.buffer_CullNodes_uint32[cullDataIndex + 8] = node.layer;
                this.buffer_CullNodes_uint32[cullDataIndex + 9] = node.castShadow ? 1 : 0;
                this.buffer_CullNodes_uint32[cullDataIndex + 10] = node.visibalRangeBit;
                let instanceIndex = cullPassIndex * this._wholeInsStride;
                this.buffer_InstanceData.set(node.transform.worldMatrix.elements, instanceIndex);
                node._worldParams.writeTo(this.buffer_InstanceData, instanceIndex + this._worldParamsOffset);
                node.lightmapScaleOffset.writeTo(this.buffer_InstanceData, instanceIndex + 16);
                if (this._renderType == Laya.BaseRenderType.SimpleSkinRender) {
                    let simpleAnimatorParams = node.shaderData.getVector(Laya.SimpleSkinnedMeshSprite3D.SIMPLE_SIMPLEANIMATORPARAMS);
                    simpleAnimatorParams.writeTo(this.buffer_InstanceData, instanceIndex + 24);
                }
                let record = node.customData.batchRecoards;
                for (var j = 0; j < record.length; j++) {
                    record[j].batchMark && (record[j].batchMark.notifyChange());
                }
            }
            this.bufferUpdate_CullNodes.x = Math.min(this.bufferUpdate_CullNodes.x, min);
            this.bufferUpdate_CullNodes.y = Math.max(this.bufferUpdate_CullNodes.y, max);
            this.bufferUpdate_InstanceData.x = Math.min(this.bufferUpdate_CullNodes.x, min);
            this.bufferUpdate_InstanceData.y = Math.max(this.bufferUpdate_CullNodes.y, max);
            if (this.bufferUpdate_CullNodes.x <= this.bufferUpdate_CullNodes.y) {
                this.deviceBuffer_CullInfos.setData(this.buffer_CullNodes, this.bufferUpdate_CullNodes.x * this._wholeCullStride * 4, this.bufferUpdate_CullNodes.x * this._wholeCullStride * 4, (this.bufferUpdate_CullNodes.y + 1 - this.bufferUpdate_CullNodes.x) * this._wholeCullStride * 4);
                this.bufferUpdate_CullNodes.x = LargeData;
                this.bufferUpdate_CullNodes.y = -LargeData;
            }
            if (this.bufferUpdate_InstanceData.x <= this.bufferUpdate_InstanceData.y) {
                this.deviceBuffer_InstanceData.setData(this.buffer_InstanceData, this.bufferUpdate_InstanceData.x * this._wholeInsStride * 4, this.bufferUpdate_InstanceData.x * this._wholeInsStride * 4, (this.bufferUpdate_InstanceData.y + 1 - this.bufferUpdate_InstanceData.x) * this._wholeInsStride * 4);
                this.bufferUpdate_InstanceData.x = LargeData;
                this.bufferUpdate_InstanceData.y = -LargeData;
            }
        }
        _renderUpdatePre() {
            let createElementCount = this._needCreateRenderElementBatch.length;
            if (this._maxBatchCount <= this.oneBatchMarks.elements.length) {
                this._extendBatchCountBuffer(this.oneBatchMarks.elements.length);
            }
            for (var i = 0; i < createElementCount; i++) {
                let onebatch = this._needCreateRenderElementBatch.elements[i];
                if (onebatch.batchRenderList.length > 0 && onebatch._needCreateRenderElement) {
                    onebatch._createRenderElement();
                }
            }
            this._needCreateRenderElementBatch.clear();
            if (this.bufferUpdate_IndirectDrawBuffer.x <= this.bufferUpdate_IndirectDrawBuffer.y) {
                this.deviceBuffer_IndirectDrawBuffer.setData(this.buffer_IndirectDrawBuffer, this.bufferUpdate_IndirectDrawBuffer.x * 5 * 4, this.bufferUpdate_IndirectDrawBuffer.x * 5 * 4, (this.bufferUpdate_IndirectDrawBuffer.y + 1 - this.bufferUpdate_IndirectDrawBuffer.x) * 5 * 4);
                this.bufferUpdate_IndirectDrawBuffer.x = LargeData;
                this.bufferUpdate_IndirectDrawBuffer.y = -LargeData;
            }
            if (!this.needUpdateElemenetIndex)
                return;
            this.needUpdateElemenetIndex = false;
            let elements = this.oneBatchMarks.elements;
            let hasExtend = false;
            {
                let currentCount = 0;
                for (let i = 0; i < elements.length; ++i) {
                    let oneBatch = elements[i];
                    if (oneBatch && oneBatch.canBatch) {
                        currentCount += oneBatch.elementCount;
                    }
                }
                if (currentCount > this._maxRenderElementCount) {
                    hasExtend = true;
                    this._extendRenderElementCountBuffer(currentCount);
                }
            }
            let elementCount = 0;
            for (var i = 0; i < elements.length; i++) {
                let oneBatch = elements[i];
                if (oneBatch && oneBatch.canBatch) {
                    this.batchPosBuffer[i] = elementCount;
                    oneBatch._updateElementBuffer(elementCount);
                    elementCount += oneBatch.elementCount;
                    if (hasExtend && oneBatch.changeFlag == this._deviceBufferChange) {
                        oneBatch.changeOnCreate = true;
                    }
                }
                else {
                    this.batchPosBuffer[i] = 0;
                }
            }
            this._cullElementCount = elementCount;
            this.deviceBuffer_batchPosBuffer.setData(this.batchPosBuffer, 0, 0, elements.length * 4);
            this.deviceBuffer_renderElementsInfo.setData(this.buffer_renderElementsInfo, 0, 0, this._cullElementCount * 2 * 4);
        }
        setCullingCamera(cameraCullInfo, directLightCullInfo, spotCullInfo) {
            WebGPUBatch_CullDataSet.fillCameraCullData(cameraCullInfo[0], 0, this._cullPlaneData, this._cullPlaneData_Uint32);
            for (var i = 0; i < 4; i++) {
                let index = (i + 1) * BatchCullPass.oneCullNeedFloatCount;
                if (!directLightCullInfo[i]) {
                    WebGPUBatch_CullDataSet.fillNOCullData(index, this._cullPlaneData_Uint32);
                }
                else {
                    WebGPUBatch_CullDataSet.fillDirCullData(directLightCullInfo[i], index, this._cullPlaneData, this._cullPlaneData_Uint32);
                }
            }
            if (!spotCullInfo[0]) {
                WebGPUBatch_CullDataSet.fillNOCullData(5 * BatchCullPass.oneCullNeedFloatCount, this._cullPlaneData_Uint32);
            }
            else {
                WebGPUBatch_CullDataSet.fillSpotCullData(spotCullInfo[0], 5 * BatchCullPass.oneCullNeedFloatCount, this._cullPlaneData, this._cullPlaneData_Uint32);
            }
            this._cullShaderData.setBuffer(Laya.Shader3D.propertyNameToID("u_CullInfos"), this._cullPlaneData);
        }
        applyComputeCull() {
            this._renderUpdatePre();
            this._dispartchParams.set(Math.ceil(this.renderNodes.elements.length / BatchCullPass.CULLING_WORKGROUP_SIZE), 1, 1);
            this._cullShaderData.setInt(Laya.Shader3D.propertyNameToID("u_computeMaxID"), this.renderNodes.elements.length);
            if (this._dispartchParams.x > 0) {
                this._computeCommandBuffer.addDispatchCommand(this._computeShader, this._shaderDefine, this._cullShaderList, this._dispartchParams);
                this._computeCommandBuffer.executeCMDs();
                this._computeCommandBuffer.clearCMDs();
            }
        }
        applyGetResoultCull(cullMode, cullInfoIndex, agent) {
            if (this._cullElementCount == 0)
                return;
            let bitOffset;
            switch (cullMode) {
                case Laya.BatchCullMode.Camera:
                    bitOffset = 0;
                    agent._cameraChangeMask == Laya.Stat.loopCount;
                    break;
                case Laya.BatchCullMode.DirectLight:
                    bitOffset = 1 + cullInfoIndex;
                    agent._dirCullChangeMask == Laya.Stat.loopCount;
                    break;
                case Laya.BatchCullMode.Spot:
                    bitOffset = 5;
                    break;
            }
            this._getResultParamsArray[0] = this.oneBatchMarks.elements.length;
            this._getResultParamsArray[1] = this._cullElementCount;
            this._getResultParamsArray[2] = bitOffset;
            this._getResoultShaderData.setBuffer(Laya.Shader3D.propertyNameToID("u_getResultParamsArray"), this._getResultParamsArray);
            this._dispartchParams.set(Math.ceil(this.oneBatchMarks.elements.length / BatchCullPass.CULLING_WORKGROUP_SIZE), 1, 1);
            if (this._dispartchParams.x > 0) {
                this._getCullInfoCommandBuffer.addDispatchCommand(this._clearCullResShader, this._shaderDefine, this._getResoultShaderList, this._dispartchParams);
            }
            this._dispartchParams.set(Math.ceil(this._cullElementCount / BatchCullPass.CULLING_WORKGROUP_SIZE), 1, 1);
            if (this._dispartchParams.x > 0) {
                this._getCullInfoCommandBuffer.addDispatchCommand(this._getCullResoultShader, this._shaderDefine, this._getResoultShaderList, this._dispartchParams);
            }
            this._getCullInfoCommandBuffer.executeCMDs();
            this._getCullInfoCommandBuffer.clearCMDs();
        }
        appendRenderELement(cullMode, cullInfoIndex, batchQueue, cullData, context, agnet) {
            let bitOffset;
            let isShadow;
            let cullChange;
            switch (cullMode) {
                case Laya.BatchCullMode.Camera:
                    bitOffset = 0;
                    isShadow = false;
                    cullChange = agnet._cameraChangeMask == Laya.Stat.loopCount;
                    break;
                case Laya.BatchCullMode.DirectLight:
                    bitOffset = 1 + cullInfoIndex;
                    isShadow = true;
                    cullChange = agnet._dirCullChangeMask == Laya.Stat.loopCount;
                    break;
                case Laya.BatchCullMode.Spot:
                    bitOffset = 5;
                    isShadow = true;
            }
            this._getResultParamsArray[0] = this.oneBatchMarks.elements.length;
            this._getResultParamsArray[1] = this._cullElementCount;
            this._getResultParamsArray[2] = bitOffset;
            this._getResoultShaderData.setBuffer(Laya.Shader3D.propertyNameToID("u_getResultParamsArray"), this._getResultParamsArray);
            this._dispartchParams.set(Math.ceil(this.oneBatchMarks.elements.length / BatchCullPass.CULLING_WORKGROUP_SIZE), 1, 1);
            if (this._dispartchParams.x > 0) {
                this._getCullInfoCommandBuffer.addDispatchCommand(this._clearCullResShader, this._shaderDefine, this._getResoultShaderList, this._dispartchParams);
            }
            this._dispartchParams.set(Math.ceil(this._cullElementCount / BatchCullPass.CULLING_WORKGROUP_SIZE), 1, 1);
            if (this._dispartchParams.x > 0) {
                this._getCullInfoCommandBuffer.addDispatchCommand(this._getCullResoultShader, this._shaderDefine, this._getResoultShaderList, this._dispartchParams);
            }
            this._getCullInfoCommandBuffer.executeCMDs();
            this._getCullInfoCommandBuffer.clearCMDs();
            this._quickSortList.length = 0;
            for (var i = 0, n = this.oneBatchMarks.elements.length; i < n; i++) {
                let batchMark = this.oneBatchMarks.elements[i];
                if (batchMark && batchMark.indexOfCullPass != -1 && batchMark.canBatch) {
                    if (batchMark.cullInsert(cullMode, cullData, isShadow)) {
                        if (context.cameraUpdateMask == batchMark.cullUpdateMark) {
                            this._quickSortList.add(batchMark.renderElement);
                            if (cullMode == Laya.BatchCullMode.Camera) {
                                batchMark.cullAdditionalInfo.camCullRes = true;
                            }
                            else if (cullMode == Laya.BatchCullMode.DirectLight) {
                                batchMark.cullAdditionalInfo.dirCullRes = true;
                            }
                            else if (cullMode == Laya.BatchCullMode.Spot) {
                                batchMark.cullAdditionalInfo.spotCullRes = true;
                            }
                        }
                        else if (!cullChange && batchMark.stateChangeMask != Laya.Stat.loopCount) {
                            let oldRes = (cullMode == Laya.BatchCullMode.Camera) ? batchMark.cullAdditionalInfo.camCullRes : batchMark.cullAdditionalInfo.dirCullRes;
                            if (oldRes)
                                this._quickSortList.add(batchMark.renderElement);
                        }
                        else {
                            let res = false;
                            if (WebGPUBatch_CullDataSet.quickOneMarkBatchCull(batchMark, cullMode, cullData, context.cameraUpdateMask, cullInfoIndex)) {
                                this._quickSortList.add(batchMark.renderElement);
                                res = true;
                            }
                            if ((cullMode == Laya.BatchCullMode.Camera))
                                batchMark.cullAdditionalInfo.camCullRes = res;
                            else if (cullMode == Laya.BatchCullMode.DirectLight) {
                                batchMark.cullAdditionalInfo.dirCullRes = res;
                            }
                            else if (cullMode == Laya.BatchCullMode.Spot) {
                                batchMark.cullAdditionalInfo.spotCullRes = res;
                            }
                        }
                    }
                }
            }
            BatchAgentSortUtil.quickSortInPlace(this._quickSortList.elements, 0, this._quickSortList.length - 1);
            let resoultelement = this._quickSortList.elements;
            for (var i = 0, n = this._quickSortList.length; i < n; i++) {
                batchQueue.opaqueQueue.addRenderElement(resoultelement[i]);
            }
        }
        addOneBatchMark(oneBathMark) {
            let index = this.oneBatchMarks.add(oneBathMark);
            oneBathMark.indexOfCullPass = index;
        }
        removeOneBatchMark(oneBathMark) {
            this.oneBatchMarks.remove(oneBathMark);
            oneBathMark.indexOfCullPass = -1;
        }
        release() {
            this.oneBatchMarks.release();
            this.oneBatchMarks = null;
            this.renderNodes.release();
            this.renderNodes = null;
            this.renderOneBatchs.clear();
            this.renderOneBatchs = null;
            this.deviceBuffer_CullInfos.destroy();
            this.buffer_CullNodes = null;
            this.buffer_CullNodes_uint32 = null;
            this.deviceBuffer_InstanceData.destroy();
            this.buffer_InstanceData = null;
            this.deviceBuffer_CullResourse.destroy();
            this.deviceBuffer_IndirectDrawBuffer.destroy();
            this.buffer_IndirectDrawBuffer = null;
            this.deviceBuffer_renderElementsInfo.destroy();
            this.buffer_renderElementsInfo = null;
            this.deviceBuffer_batchPosBuffer.destroy();
            this.batchPosBuffer = null;
            this.deviceBuffer_worldInstance.destroy();
            this.deviceBuffer_LightmapScaleOffset.destroy();
            if (this.deviceBuffer_simpleSkinInstance) {
                this.deviceBuffer_simpleSkinInstance.destroy();
            }
            this._cullPlaneData = null;
            this._cullPlaneData_Uint32 = null;
            this._cullShaderData.destroy();
            this._deviceBufferShaderData.destroy();
            this._getResoultShaderData.destroy();
        }
    }
    BatchCullPass.CULLING_WORKGROUP_SIZE = 64;
    BatchCullPass.TotleCullNeedV4Count = 6 * 8;
    BatchCullPass.oneCullNeedFloatCount = 4 * 8;

    class WebGPURenderContext3D {
        get _mrtColorAttachmentCount() { var _a, _b; return ((_b = (_a = this.destRT) === null || _a === void 0 ? void 0 : _a.colorFormats) === null || _b === void 0 ? void 0 : _b.length) || 0; }
        get sceneData() {
            return this._sceneData;
        }
        set sceneData(value) {
            if (value == this._sceneData)
                return;
            this._sceneData = value;
            if (value) {
                for (let key of this.preDrawUniformMaps) {
                    let uniformMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap(key);
                    if (uniformMap._idata.size > 0) {
                        this.sceneData.createSubUniformBuffer(key, key, uniformMap._idata);
                    }
                }
            }
        }
        get cameraData() {
            return this._cameraData;
        }
        set cameraData(value) {
            if (value == this._cameraData)
                return;
            if (value) {
                this._cameraData = value;
                let cameraMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("BaseCamera");
                this.cameraData.createUniformBuffer("BaseCamera", cameraMap);
            }
        }
        get sceneModuleData() {
            return this._sceneModuleData;
        }
        set sceneModuleData(value) {
            this._sceneModuleData = value;
        }
        get cameraModuleData() {
            return this._cameraModuleData;
        }
        set cameraModuleData(value) {
            this._cameraModuleData = value;
        }
        get globalShaderData() {
            return this._globalShaderData;
        }
        set globalShaderData(value) {
            this._globalShaderData = value;
        }
        get sceneUpdateMask() {
            return this._sceneUpdateMask;
        }
        set sceneUpdateMask(value) {
            this._sceneUpdateMask = value;
        }
        get cameraUpdateMask() {
            return this._cameraUpdateMask;
        }
        set cameraUpdateMask(value) {
            this._cameraUpdateMask = value;
        }
        get pipelineMode() {
            return this._pipelineMode;
        }
        set pipelineMode(value) {
            this._pipelineMode = value;
        }
        get invertY() {
            return this._invertY;
        }
        set invertY(value) {
            this._invertY = value;
        }
        constructor() {
            this._globalComkeyCounter = 0;
            this._globalComkeyNameMap = {};
            this._globalRendercacheInfoMap = new Map();
            this._sceneUpdateMask = 0;
            this._cameraUpdateMask = 0;
            this._pipelineMode = "";
            this._clearColor = Laya.Color.BLACK.clone();
            this._clearColorValues = null;
            this._needStart = true;
            this._commandClearPending = false;
            this._blitFrameCount = 0;
            this._blitScreen = false;
            this._viewScissorSaved = false;
            this._viewPortSave = new Laya.Viewport();
            this._scissorSave = new Laya.Vector4();
            this._renderCommand = new Laya.WebGPURenderCommandEncoder();
            this._cacheGlobalDefines = new Laya.WebDefineDatas();
            this.rtNeedClear = false;
            this.device = Laya.WebGPURenderEngine._instance.getDevice();
            this.preDrawUniformMaps = new Set();
            WebGPURenderContext3D._instance = this;
        }
        globalComkeyToID(name) {
            if (this._globalComkeyNameMap[name] !== undefined) {
                return this._globalComkeyNameMap[name];
            }
            else {
                const id = this._globalComkeyCounter++;
                this._globalComkeyNameMap[name] = id;
                return id;
            }
        }
        _getRenderPipeLine() {
            const engine = Laya.WebGPURenderEngine._instance;
            let sceneCommands = Array.from(this.preDrawUniformMaps);
            let sceneResources = Laya.WebGPUBindGroupHelper.createBindPropertyInfoArrayByCommandMap(0, sceneCommands);
            let sceneLayoutInfo = engine.bindGroupCache.getLayoutInfo(sceneCommands, this._sceneData, null, sceneResources, ~0);
            let cameraCommands = ["BaseCamera"];
            let cameraid = -1;
            if (this.cameraData) {
                let cameraResources = Laya.WebGPUBindGroupHelper.createBindPropertyInfoArrayByCommandMap(1, cameraCommands);
                let cameraLayoutInfo = engine.bindGroupCache.getLayoutInfo(cameraCommands, this.cameraData, null, cameraResources, ~0);
                cameraid = cameraLayoutInfo.id;
            }
            return `${this.destRT.stateCacheID},${this.invertY ? 1 : 0},(${sceneLayoutInfo.id},${cameraid})`;
        }
        _getSceneCameraCacheKey() {
            let key = `${(this.sceneData && this.sceneData._id) ? this.sceneData._id : -1} + ${this.cameraData ? this.cameraData._id : -1}+${this._pipelineMode}+${this.destRT == Laya.WebGPURenderEngine._instance._screenRT ? 0 : 1}+${this._mrtColorAttachmentCount}`;
            this._curRenderGlobalKey = this.globalComkeyToID(key);
            let pipelineLayout = this._getRenderPipeLine();
            if (!this._globalRendercacheInfoMap.has(this._curRenderGlobalKey)) {
                let cacheInfo = new Laya.WebGPUGlobalPipeLineCacheInfo();
                this._curRenderCacheInfo = cacheInfo;
                this._cacheGlobalDefines.cloneTo(cacheInfo.globalDefineData);
                this._curRenderCacheInfo.globalDefineChangeFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                cacheInfo.pipeLineChangeFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                cacheInfo.globalPipelineCacheKey = pipelineLayout;
                this._globalRendercacheInfoMap.set(this._curRenderGlobalKey, cacheInfo);
                this._pipelineChange = this._curRenderCacheInfo.pipeLineChangeFlag;
            }
            else {
                this._curRenderCacheInfo = this._globalRendercacheInfoMap.get(this._curRenderGlobalKey);
                if (this._curRenderCacheInfo.globalPipelineCacheKey == pipelineLayout) {
                    this._pipelineChange = this._curRenderCacheInfo.pipeLineChangeFlag;
                }
                else {
                    this._pipelineChange = this._curRenderCacheInfo.pipeLineChangeFlag;
                    this._curRenderCacheInfo.globalPipelineCacheKey = pipelineLayout;
                    this._curRenderCacheInfo.pipeLineChangeFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                }
                if (!this._curRenderCacheInfo.globalDefineData.isEual(this._cacheGlobalDefines)) {
                    this._cacheGlobalDefines.cloneTo(this._curRenderCacheInfo.globalDefineData);
                    this._curRenderCacheInfo.globalDefineChangeFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                }
            }
            this._curDefineChangeFlag = this._curRenderCacheInfo.globalDefineChangeFlag;
        }
        _prepareContext() {
            let contextDef = this._cacheGlobalDefines;
            if (this._sceneData) {
                this._sceneData._defineDatas.cloneTo(contextDef);
                for (let key of this.preDrawUniformMaps) {
                    let uniformMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap(key);
                    if (uniformMap._idata.size > 0) {
                        let buffer = this.sceneData.createSubUniformBuffer(key, key, uniformMap._idata);
                        buffer.upload();
                    }
                }
                let commandArray = Array.from(this.preDrawUniformMaps);
                let resource = Laya.WebGPUBindGroupHelper.createBindPropertyInfoArrayByCommandMap(0, commandArray);
                this._sceneBindGroup = Laya.LayaGL.renderEngine.bindGroupCache.getBindGroup(commandArray, this._sceneData, null, resource, ~0);
            }
            else {
                this._globalConfigShaderData && this._globalConfigShaderData.cloneTo(contextDef);
            }
            if (this.cameraData) {
                contextDef.addDefineDatas(this.cameraData._defineDatas);
                let cameraMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("BaseCamera");
                let cameraBuffer = this.cameraData.createUniformBuffer("BaseCamera", cameraMap);
                if (cameraBuffer) {
                    cameraBuffer.upload();
                }
                let commandArray = ["BaseCamera"];
                let resource = Laya.WebGPUBindGroupHelper.createBindPropertyInfoArrayByCommandMap(1, commandArray);
                this._cameraBindGroup = Laya.LayaGL.renderEngine.bindGroupCache.getBindGroup(commandArray, this.cameraData, null, resource, ~0);
            }
            this._getSceneCameraCacheKey();
        }
        _ensureGlobalBindGroupsValid() {
            var _a, _b;
            const engine = Laya.WebGPURenderEngine._instance;
            if (this._sceneData && !((_a = this._sceneBindGroup) === null || _a === void 0 ? void 0 : _a.isBufferValid())) {
                const commands = Array.from(this.preDrawUniformMaps);
                const resource = Laya.WebGPUBindGroupHelper.createBindPropertyInfoArrayByCommandMap(0, commands);
                this._sceneBindGroup = engine.bindGroupCache.getBindGroup(commands, this._sceneData, null, resource, ~0);
            }
            if (this.cameraData && !((_b = this._cameraBindGroup) === null || _b === void 0 ? void 0 : _b.isBufferValid())) {
                const commands = ["BaseCamera"];
                const resource = Laya.WebGPUBindGroupHelper.createBindPropertyInfoArrayByCommandMap(1, commands);
                this._cameraBindGroup = engine.bindGroupCache.getBindGroup(commands, this.cameraData, null, resource, ~0);
            }
        }
        _setScreenRT() {
            if (!this.destRT) {
                const engine = Laya.WebGPURenderEngine._instance;
                engine._screenResized = false;
                if (this._blitFrameCount === Laya.Laya.timer.currFrame) {
                    this.setRenderTarget(engine._screenRT, Laya.RenderClearFlag.Nothing);
                }
                else {
                    this.setRenderTarget(engine._screenRT, Laya.RenderClearFlag.Color | Laya.RenderClearFlag.Depth);
                    engine.hasScreenCleared = true;
                }
                Laya.Color.BLACK.cloneTo(this._clearColor);
                this._clearColorValues = null;
                this._blitFrameCount = Laya.Laya.timer.currFrame;
                this._blitScreen = true;
            }
            else
                this._blitScreen = false;
        }
        _start(viewPortAndScissor = true) {
            const renderPassDesc = Laya.WebGPURenderPassHelper.getDescriptor(this.destRT, this._clearFlag, this._clearColor, this._clearDepth, this._clearStencil, this._clearColorValues);
            this._renderCommand.startRender(renderPassDesc, this.destRT);
            this._clearFlag = Laya.RenderClearFlag.Nothing;
            this._clearColorValues = null;
            this._commandClearPending = false;
            if (viewPortAndScissor) {
                if (this._viewPort) {
                    this._viewPort.y = this._viewPort.y | 0;
                    this._viewPort.width = this._viewPort.width | 0;
                    this._viewPort.height = this._viewPort.height | 0;
                    this._renderCommand.setViewport(this._viewPort.x, this._viewPort.y, this._viewPort.width, this._viewPort.height, 0, 1);
                }
                if (this._scissor) {
                    this._scissor.y = this._scissor.y | 0;
                    this._renderCommand.setScissorRect(this._scissor.x, this._scissor.y, this._scissor.z, this._scissor.w);
                }
            }
        }
        _submit() {
            const engine = Laya.WebGPURenderEngine._instance;
            if (this._blitScreen && engine._screenResized)
                return;
            this._renderCommand.end();
            engine.upload();
            this.device.queue.submit([this._renderCommand.finish()]);
            this._needStart = true;
        }
        setRenderTarget(rt, clearFlag) {
            if (rt !== this.destRT) {
                if (this.destRT)
                    this._flushCommandClear();
                this._clearFlag = clearFlag;
                this._clearColorValues = null;
                this.destRT = rt;
                this._needStart = true;
            }
            else {
                if (!this.rtNeedClear) {
                    this._clearFlag = clearFlag;
                }
                else {
                    if (clearFlag != Laya.RenderClearFlag.Nothing) {
                        this._clearFlag |= clearFlag;
                    }
                }
            }
        }
        setViewPort(value) {
            this._viewPort = value;
        }
        setScissor(value) {
            this._scissor = value;
        }
        saveViewPortAndScissor() {
            if (this._viewPort && this._scissor) {
                this._viewPort.cloneTo(this._viewPortSave);
                this._scissor.cloneTo(this._scissorSave);
                this._viewScissorSaved = true;
            }
        }
        restoreViewPortAndScissor() {
            if (this._viewScissorSaved) {
                this._viewPortSave.cloneTo(this._viewPort);
                this._scissorSave.cloneTo(this._scissor);
                this._viewScissorSaved = false;
            }
        }
        setClearData(flag, color, depth, stencil, colorValues) {
            if (!this.rtNeedClear || (flag & Laya.RenderClearFlag.Color)) {
                if ((flag & Laya.RenderClearFlag.Color) && colorValues) {
                    const values = this._clearColorValuesCache || (this._clearColorValuesCache = []);
                    const colors = this._clearColorValuePool || (this._clearColorValuePool = []);
                    values.length = colorValues.length;
                    for (let i = 0; i < colorValues.length; i++) {
                        const value = colorValues[i];
                        if (value) {
                            const snapshot = colors[i] || (colors[i] = new Laya.Color());
                            value.cloneTo(snapshot);
                            values[i] = snapshot;
                        }
                        else
                            values[i] = null;
                    }
                    this._clearColorValues = values;
                }
                else
                    this._clearColorValues = null;
            }
            if (this.rtNeedClear) {
                if (flag & Laya.RenderClearFlag.Color) {
                    this._clearFlag |= Laya.RenderClearFlag.Color;
                    color.cloneTo(this._clearColor);
                }
                if (flag & Laya.RenderClearFlag.Depth) {
                    this._clearFlag |= Laya.RenderClearFlag.Depth;
                    this._clearDepth = depth;
                }
                if (flag & Laya.RenderClearFlag.Stencil) {
                    this._clearFlag |= Laya.RenderClearFlag.Stencil;
                    this._clearStencil = stencil;
                }
            }
            else {
                this._clearFlag = flag;
                this._clearDepth = depth;
                this._clearStencil = stencil;
                color.cloneTo(this._clearColor);
            }
            if (flag != Laya.RenderClearFlag.Nothing) {
                this.rtNeedClear = true;
            }
            return 0;
        }
        drawRenderElementList(list) {
            const len = list.length;
            if (len === 0) {
                if (this.rtNeedClear) {
                    this._setScreenRT();
                    this.clearRenderTarget();
                    this.rtNeedClear = false;
                    Laya.WebGPURenderEngine._instance._framePassCount++;
                }
                return 0;
            }
            this._setScreenRT();
            let time = Laya.Browser.now();
            this._prepareContext();
            const elements = list.elements;
            let element;
            for (let i = 0; i < len; i++) {
                element = elements[i];
                element._preUpdatePre(this);
            }
            this._ensureGlobalBindGroupsValid();
            Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_3DContextPre, Laya.Browser.now() - time);
            time = Laya.Browser.now();
            if (this._needStart) {
                this._start();
                this._needStart = false;
            }
            let cmd = this._renderCommand;
            cmd.setBindGroup(0, this._sceneBindGroup ? this._sceneBindGroup : Laya.WebGPUBindGroupCache.emptyBindGroup);
            cmd.setBindGroup(1, this._cameraBindGroup ? this._cameraBindGroup : Laya.WebGPUBindGroupCache.emptyBindGroup);
            for (let i = 0; i < len; i++)
                elements[i]._render(this, cmd);
            this._submit();
            this.rtNeedClear = false;
            Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_3DContextRender, Laya.Browser.now() - time);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_3DDrawCall, list.length);
            Laya.WebGPURenderEngine._instance._framePassCount++;
            return 0;
        }
        drawRenderElementOne(node) {
            this._setScreenRT();
            this._prepareContext();
            node._preUpdatePre(this);
            this._ensureGlobalBindGroupsValid();
            if (this._needStart) {
                this._start();
                this._needStart = false;
            }
            this._renderCommand.setBindGroup(0, this._sceneBindGroup ? this._sceneBindGroup : Laya.WebGPUBindGroupCache.emptyBindGroup);
            this._renderCommand.setBindGroup(1, this._cameraBindGroup ? this._cameraBindGroup : Laya.WebGPUBindGroupCache.emptyBindGroup);
            node._render(this, this._renderCommand);
            this._submit();
            this.rtNeedClear = false;
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_3DDrawCall, 1);
            Laya.WebGPURenderEngine._instance._framePassCount++;
            return 0;
        }
        runCMDList(cmds) {
            cmds.forEach(cmd => this._applyCommand(cmd));
            this._flushCommandClear();
        }
        runOneCMD(cmd) {
            this._applyCommand(cmd);
            this._flushCommandClear();
        }
        _applyCommand(cmd) {
            switch (cmd.type) {
                case Laya.RenderCMDType.DrawNode:
                case Laya.RenderCMDType.DrawElement:
                case Laya.RenderCMDType.Blit:
                case Laya.RenderCMDType.ChangeData:
                case Laya.RenderCMDType.ChangeShaderDefine:
                case Laya.RenderCMDType.ChangeViewPort:
                    break;
                case Laya.RenderCMDType.ChangeRenderTarget:
                    this._flushCommandClear();
                    break;
                default:
                    this._flushCommandClear();
                    break;
            }
            cmd.apply(this);
            if (cmd.type === Laya.RenderCMDType.ChangeRenderTarget)
                this._commandClearPending = this.rtNeedClear && this._clearFlag !== Laya.RenderClearFlag.Nothing;
        }
        _flushCommandClear() {
            if (!this._commandClearPending)
                return;
            this._commandClearPending = false;
            this._setScreenRT();
            this.clearRenderTarget();
        }
        clearRenderTarget() {
            this._start(false);
            this._submit();
            this.rtNeedClear = false;
        }
        destroy() {
            this._renderCommand.destroy();
            this.destRT = null;
        }
    }

    class WebGPURenderElement3D {
        get materialShaderData() {
            return this._materialShaderData;
        }
        set materialShaderData(value) {
            if (this._materialShaderData != value) {
                this._materialShaderData = value;
                this._materialStateRevision++;
            }
        }
        get renderShaderData() {
            return this._renderShaderData;
        }
        set renderShaderData(value) {
            if (this._renderShaderData != value) {
                this._renderShaderData = value;
                this._renderNodeChangeFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
            }
        }
        get subShader() {
            return this._subShader;
        }
        set subShader(value) {
            if (this._subShader != value) {
                this._subShader = value;
                this._materialStateRevision++;
            }
        }
        constructor() {
            this._materialRenderDataChange = false;
            this._spriteRenderDataChange = false;
            this._invertFrontFace = false;
            this._bindGroupMap = new Map();
            this.sortIndex = 0;
            this.depthStencilParam = new Laya.DepthStencilParam();
            this._passRenderInfo = new Map();
            this._materialStateRevision = 0;
            this._renderNodeChangeFlag = new Laya.Vector2();
            this._pipelineChangeFlag = new Laya.Vector2();
            this._cacheGeometryStateID = -1;
        }
        _needUpdatePipeline() {
            this._pipelineChangeFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
        }
        _getInvertFront() {
            var _a;
            const transform = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.transform;
            return transform ? transform._isFrontFaceInvert : false;
        }
        _updateInvertFrontFace() {
            const invertFrontFace = this._getInvertFront();
            if (this._invertFrontFace !== invertFrontFace) {
                this._invertFrontFace = invertFrontFace;
                this._needUpdatePipeline();
            }
        }
        _getShaderInstanceDefines(context) {
            let comDef = WebGPURenderElement3D._compileDefine;
            const globalShaderDefines = context._cacheGlobalDefines;
            globalShaderDefines.cloneTo(comDef);
            if (this._renderShaderData) {
                comDef.addDefineDatas(this._renderShaderData.getDefineData());
            }
            if (this._materialShaderData) {
                comDef.addDefineDatas(this._materialShaderData._defineDatas);
            }
            if (this.owner) {
                let additionShaderData = this.owner.additionShaderData;
                if (additionShaderData.size > 0) {
                    for (let [key, value] of additionShaderData.entries()) {
                        comDef.addDefineDatas(value.getDefineData());
                    }
                }
            }
            return comDef;
        }
        _compileShader(context) {
            var passes = this.subShader._passes;
            let renderCount = 0;
            for (var j = 0, m = passes.length; j < m; j++) {
                let pass = passes[j];
                let passdata = pass.moduleData;
                if (passdata.pipelineMode !== context.pipelineMode)
                    continue;
                if (this._renderShaderData) {
                    passdata.nodeCommonMap = this.owner._commonUniformMap;
                }
                else {
                    passdata.nodeCommonMap = null;
                }
                passdata.additionShaderData = null;
                if (this.owner) {
                    passdata.additionShaderData = this.owner._additionShaderDataKeys;
                }
                let attributeLocations = this.geometry.bufferState._attriLocArray;
                pass.moduleData.attributeLocations = attributeLocations;
                let comDef = this._getShaderInstanceDefines(context);
                var shaderIns = pass.withCompile(comDef, false, context._mrtColorAttachmentCount);
                if (this._drawCacheArray[renderCount]) {
                    let oneInfo = this._drawCacheArray[renderCount];
                    if (oneInfo.shaderInstance != shaderIns) {
                        oneInfo.shaderChange = true;
                        oneInfo.shaderInstance = shaderIns;
                    }
                }
                else {
                    let oneInfo = new Laya.OneDrawCacheInfo();
                    oneInfo.shaderChange = true;
                    oneInfo.shaderInstance = shaderIns;
                    this._drawCacheArray[renderCount] = oneInfo;
                }
                renderCount++;
            }
            this._drawCacheArray.length = renderCount;
        }
        _updateMatChangeFlag() {
            this._materialRenderDataChange = this._materialStateRevision !== this._drawPassInfo.materialStateRevision;
            if (this._renderShaderData && Laya.compareCahceFlag(this._renderNodeChangeFlag, this._drawPassInfo.nodeCacheFlag)) {
                this._drawPassInfo.nodeCacheFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                this._spriteRenderDataChange = true;
            }
            else {
                this._spriteRenderDataChange = false;
            }
        }
        _handleMaterialChange() {
            let shadername = this._subShader._owner.name;
            if (!WebGPURenderElement3D._matChangeFlagMap.has(shadername))
                WebGPURenderElement3D._matChangeFlagMap.set(shadername, new Map());
            let shadermap = WebGPURenderElement3D._matChangeFlagMap.get(shadername);
            if (!shadermap.has(this._materialShaderData._id)) {
                let flagArray = [new Laya.Vector2(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount), new Laya.Vector2(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount), new Laya.Vector2(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount)];
                shadermap.set(this._materialShaderData._id, flagArray);
                this._materialShaderData.addBindGroupChangeLink(this._subShader._owner.name, this._subShader._uniformMap);
                this._materialShaderData.addBindGroupChangeFlag(this._subShader._owner.name, flagArray[0], flagArray[1]);
                this._materialShaderData._defineDatas.addChangeFlagInfo(flagArray[2]);
            }
            let flagArray = shadermap.get(this._materialShaderData._id);
            this._matBindGroupChangeFlag = flagArray[0];
            this._matBindGroupLayoutFlag = flagArray[1];
            this._matDefChangeFlag = flagArray[2];
            let subShader = this._subShader;
            this._materialUBO = this._materialShaderData.createSubUniformBuffer("Material", subShader._owner.name, subShader._uniformMap);
            this._drawPassInfo.materialStateRevision = this._materialStateRevision;
        }
        _preUpdatePre(context) {
            if (!this._passRenderInfo.has(context._curRenderGlobalKey)) {
                this._drawPassInfo = new Laya.OneDrawPassCacheInfo();
                this._passRenderInfo.set(context._curRenderGlobalKey, this._drawPassInfo);
            }
            else {
                this._drawPassInfo = this._passRenderInfo.get(context._curRenderGlobalKey);
            }
            this._drawCacheArray = this._drawPassInfo.drawInfos;
            this._updateMatChangeFlag();
            if (this.geometry.getStateCacheID() != this._cacheGeometryStateID) {
                this._needUpdatePipeline();
                this._cacheGeometryStateID = this.geometry.getStateCacheID();
            }
            let passDefineChangeFlag = this._drawPassInfo.passDefineCacheFlag;
            if (this._materialRenderDataChange ||
                !this._matDefChangeFlag ||
                Laya.compareCahceFlag(this._matDefChangeFlag, passDefineChangeFlag) ||
                (this.owner && Laya.compareCahceFlag(this.owner.defineDataChangeFlag, passDefineChangeFlag)) ||
                Laya.compareCahceFlag(context._curDefineChangeFlag, passDefineChangeFlag) ||
                this._drawPassInfo.geometryStateID != this._cacheGeometryStateID) {
                passDefineChangeFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                this._compileShader(context);
                this._drawPassInfo.geometryStateID = this._cacheGeometryStateID;
            }
            if (this._materialRenderDataChange) {
                this._handleMaterialChange();
            }
            let cullmode = this._materialShaderData.getInt(Laya.Shader3D.CULL);
            cullmode = cullmode ? cullmode : Laya.RenderState.CULL_NONE;
            let depthStencilID = this._materialShaderData.depthStencilStateKey;
            let blendid = this._materialShaderData.blendStateCache ? this._materialShaderData.blendStateCache.id : -1;
            if (this._cacheMatCullMode != cullmode ||
                this._cacheMatDepthStencilID != depthStencilID ||
                this._cacheMatBlendStateID != blendid) {
                this._cacheMatBlendStateID = blendid;
                this._cacheMatDepthStencilID = depthStencilID;
                this._cacheMatCullMode = cullmode;
                this._needUpdatePipeline();
            }
            this._updateInvertFrontFace();
            return;
        }
        _render(context, command) {
            if (!this.isRender) {
                return 0;
            }
            if (!this._drawCacheArray || this._drawCacheArray.length == 0)
                return 0;
            for (let j = 0, m = this._drawCacheArray.length; j < m; j++) {
                let drawInfo = this._drawCacheArray[j];
                let shaderInstance = drawInfo.shaderInstance;
                if (!shaderInstance.complete)
                    return 0;
                this._bindGroup(context, drawInfo, command);
                let pipelineCache = drawInfo.pipeLineCacheFlag;
                if (drawInfo.shaderChange ||
                    Laya.compareCahceFlag(context._pipelineChange, pipelineCache) ||
                    Laya.compareCahceFlag(this._pipelineChangeFlag, pipelineCache)) {
                    this._bindGroupMap.clear();
                    this._bindGroupMap.set(0, context._sceneBindGroup);
                    this._bindGroupMap.set(1, context._cameraBindGroup);
                    this._bindGroupMap.set(2, drawInfo.nodeBindGroup);
                    this._bindGroupMap.set(3, drawInfo.matBindGroup);
                    drawInfo.shaderChange = false;
                    drawInfo.pipeline = this._getWebGPURenderPipeline(drawInfo.shaderInstance, context.destRT, context);
                    drawInfo.pipeLineCacheFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                }
                command.setPipeline(drawInfo.pipeline);
                if (!command.isBundle && this.depthStencilParam.stencilEnable) {
                    command.setStencilReference(this.depthStencilParam.stencilRef);
                }
                this.geometry.applyToEncoder(command);
            }
            return 1;
        }
        _getWebGPURenderPipeline(shaderInstance, dest, context) {
            if (this._materialShaderData) {
                this._getBlendState(shaderInstance);
                this._getDepthStencilState(shaderInstance, dest);
                this._getCullFrontMode(this._materialShaderData, shaderInstance, this._invertFrontFace, context.invertY);
            }
            let pipeline = Laya.WebGPURenderEngine._instance.pipelineCache.getPipeline(this._bindGroupMap, this, shaderInstance, context.destRT);
            return pipeline;
        }
        _getBlendState(shaderInstance) {
            if (shaderInstance._shaderPass.statefirst)
                this.blendState = this._getRenderStateBlendByShader(this._materialShaderData, shaderInstance);
            else {
                this.blendState = this._materialShaderData.blendStateCache;
            }
        }
        _getRenderStateBlendByShader(shaderData, shaderInstance) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
            const data = shaderData.getData();
            const renderState = shaderInstance._shaderPass.renderState;
            const blend = (_b = ((_a = renderState.blend) !== null && _a !== void 0 ? _a : data[Laya.Shader3D.BLEND])) !== null && _b !== void 0 ? _b : Laya.RenderState.Default.blend;
            let blendState;
            switch (blend) {
                case Laya.RenderState.BLEND_DISABLE:
                    blendState = Laya.WebGPUBlendState.getBlendState(blend, Laya.RenderState.BLENDEQUATION_ADD, Laya.RenderState.BLENDPARAM_ONE, Laya.RenderState.BLENDPARAM_ZERO, Laya.RenderState.BLENDEQUATION_ADD, Laya.RenderState.BLENDPARAM_ONE, Laya.RenderState.BLENDPARAM_ZERO);
                    break;
                case Laya.RenderState.BLEND_ENABLE_ALL:
                    const blendEquation = (_d = ((_c = renderState.blendEquation) !== null && _c !== void 0 ? _c : data[Laya.Shader3D.BLEND_EQUATION])) !== null && _d !== void 0 ? _d : Laya.RenderState.Default.blendEquation;
                    const srcBlend = (_f = ((_e = renderState.srcBlend) !== null && _e !== void 0 ? _e : data[Laya.Shader3D.BLEND_SRC])) !== null && _f !== void 0 ? _f : Laya.RenderState.Default.srcBlend;
                    const dstBlend = (_h = ((_g = renderState.dstBlend) !== null && _g !== void 0 ? _g : data[Laya.Shader3D.BLEND_DST])) !== null && _h !== void 0 ? _h : Laya.RenderState.Default.dstBlend;
                    blendState = Laya.WebGPUBlendState.getBlendState(blend, blendEquation, srcBlend, dstBlend, blendEquation, srcBlend, dstBlend);
                    break;
                case Laya.RenderState.BLEND_ENABLE_SEPERATE:
                    const blendEquationRGB = (_k = ((_j = renderState.blendEquationRGB) !== null && _j !== void 0 ? _j : data[Laya.Shader3D.BLEND_EQUATION_RGB])) !== null && _k !== void 0 ? _k : Laya.RenderState.Default.blendEquationRGB;
                    const blendEquationAlpha = (_m = ((_l = renderState.blendEquationAlpha) !== null && _l !== void 0 ? _l : data[Laya.Shader3D.BLEND_EQUATION_ALPHA])) !== null && _m !== void 0 ? _m : Laya.RenderState.Default.blendEquationAlpha;
                    const srcRGB = (_p = ((_o = renderState.srcBlendRGB) !== null && _o !== void 0 ? _o : data[Laya.Shader3D.BLEND_SRC_RGB])) !== null && _p !== void 0 ? _p : Laya.RenderState.Default.srcBlendRGB;
                    const dstRGB = (_r = ((_q = renderState.dstBlendRGB) !== null && _q !== void 0 ? _q : data[Laya.Shader3D.BLEND_DST_RGB])) !== null && _r !== void 0 ? _r : Laya.RenderState.Default.dstBlendRGB;
                    const srcAlpha = (_t = ((_s = renderState.srcBlendAlpha) !== null && _s !== void 0 ? _s : data[Laya.Shader3D.BLEND_SRC_ALPHA])) !== null && _t !== void 0 ? _t : Laya.RenderState.Default.srcBlendAlpha;
                    const dstAlpha = (_v = ((_u = renderState.dstBlendAlpha) !== null && _u !== void 0 ? _u : data[Laya.Shader3D.BLEND_DST_ALPHA])) !== null && _v !== void 0 ? _v : Laya.RenderState.Default.dstBlendAlpha;
                    blendState = Laya.WebGPUBlendState.getBlendState(blend, blendEquationRGB, srcRGB, dstRGB, blendEquationAlpha, srcAlpha, dstAlpha);
                    break;
                default:
                    throw 'blendState set error';
            }
            return blendState;
        }
        _getDepthStencilState(shaderInstance, dest) {
            if (dest._depthTexture) {
                if (shaderInstance._shaderPass.statefirst)
                    this.depthStencilState = this._getRenderStateDepthByShader(this._materialShaderData, shaderInstance, dest);
                else
                    this.depthStencilState = this._getRenderStateDepthByMaterial(this._materialShaderData, dest);
            }
            else
                this.depthStencilState = null;
        }
        _getRenderStateDepthByShader(shaderData, shaderInstance, dest) {
            Laya.getDepthStencilParamFromShader(shaderData, shaderInstance, dest, this.depthStencilParam);
            return Laya.WebGPUDepthStencilState.getDepthStencilState(dest.depthStencilFormat, this.depthStencilParam);
        }
        _getRenderStateDepthByMaterial(shaderData, dest) {
            Laya.getDepthStencilParamFromMaterial(shaderData, dest, this.depthStencilParam);
            return Laya.WebGPUDepthStencilState.getDepthStencilState(dest.depthStencilFormat, this.depthStencilParam);
        }
        _getCullFrontMode(shaderData, shaderInstance, isTarget, invertFront) {
            var _a;
            const renderState = shaderInstance._shaderPass.renderState;
            const data = shaderData.getData();
            let cull = data[Laya.Shader3D.CULL];
            if (shaderInstance._shaderPass.statefirst)
                cull = (_a = renderState.cull) !== null && _a !== void 0 ? _a : cull;
            cull = cull !== null && cull !== void 0 ? cull : Laya.RenderState.Default.cull;
            switch (cull) {
                case Laya.RenderState.CULL_NONE:
                    this.cullMode = Laya.CullMode.Off;
                    if (isTarget !== invertFront)
                        this.frontFace = Laya.FrontFace.CW;
                    else
                        this.frontFace = Laya.FrontFace.CCW;
                    break;
                case Laya.RenderState.CULL_FRONT:
                    this.cullMode = Laya.CullMode.Front;
                    if (isTarget !== invertFront)
                        this.frontFace = Laya.FrontFace.CW;
                    else
                        this.frontFace = Laya.FrontFace.CCW;
                    break;
                case Laya.RenderState.CULL_BACK:
                default:
                    this.cullMode = Laya.CullMode.Back;
                    if (isTarget !== invertFront)
                        this.frontFace = Laya.FrontFace.CW;
                    else
                        this.frontFace = Laya.FrontFace.CCW;
                    break;
            }
        }
        _bindGroup(context, info, command) {
            var _a, _b, _c, _d, _e;
            let shaderInstance = info.shaderInstance;
            {
                if (this.owner) {
                    let bindgroupChangeFlag = this.owner.bindGroupChangeFlag;
                    if (info.shaderChange || this._spriteRenderDataChange || Laya.compareCahceFlag(bindgroupChangeFlag, info.renderNodeBindGroupCacheFlag) || !((_a = info.nodeBindGroup) === null || _a === void 0 ? void 0 : _a.isBufferValid())) {
                        info.renderNodeBindGroupCacheFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                        let shaderResource = shaderInstance.uniformSetMap.get(2);
                        let textureExitsMask = shaderInstance.uniformTextureExits.get(2);
                        let commands = (_b = this.owner) === null || _b === void 0 ? void 0 : _b._commonUniformMap;
                        let shaderData = (_c = this.owner) === null || _c === void 0 ? void 0 : _c.shaderData;
                        let addition = (_d = this.owner) === null || _d === void 0 ? void 0 : _d.additionShaderData;
                        info.nodeBindGroup = Laya.WebGPURenderEngine._instance.bindGroupCache.getBindGroup(commands, shaderData, addition, shaderResource, textureExitsMask);
                        Laya.coverCahceFlag(this.owner.bindGroupLayoutChangeFlag, this._pipelineChangeFlag);
                    }
                }
                else {
                    info.nodeBindGroup = Laya.WebGPUBindGroupCache.emptyBindGroup;
                }
                command.setBindGroup(2, info.nodeBindGroup);
            }
            {
                if (this._materialShaderData) {
                    if (info.shaderChange || this._materialRenderDataChange || Laya.compareCahceFlag(this._matBindGroupChangeFlag, info.matBindGroupCacheFlag) || !((_e = info.matBindGroup) === null || _e === void 0 ? void 0 : _e.isBufferValid())) {
                        info.matBindGroupCacheFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                        let shaderResource = shaderInstance.uniformSetMap.get(3);
                        let textureExitsMask = shaderInstance.uniformTextureExits.get(3);
                        info.matBindGroup = Laya.WebGPURenderEngine._instance.bindGroupCache.getBindGroup([this._subShader._owner.name], this._materialShaderData, null, shaderResource, textureExitsMask);
                        Laya.coverCahceFlag(this._matBindGroupLayoutFlag, this._pipelineChangeFlag);
                    }
                }
                else {
                    info.matBindGroup = Laya.WebGPUBindGroupCache.emptyBindGroup;
                }
                command.setBindGroup(3, info.matBindGroup);
            }
        }
        _uploadGeometryIndex(command, index) {
            let triangles = 0;
            if (command) {
                triangles += command.applyGeometryIndex(this.geometry, index);
            }
            return triangles;
        }
        destroy() {
            this._materialUBO = null;
            this._passRenderInfo.clear();
        }
    }
    WebGPURenderElement3D._matChangeFlagMap = new Map();
    WebGPURenderElement3D._compileDefine = new Laya.WebDefineDatas();

    class WebGPUMeshInstanceRenderElement extends WebGPURenderElement3D {
        constructor(invertFrontFace) {
            super();
            this._batchInvertFrontFace = invertFrontFace;
        }
        _getInvertFront() {
            return this._batchInvertFrontFace;
        }
        _getShaderInstanceDefines(context) {
            let comDef = WebGPURenderElement3D._compileDefine;
            const globalShaderDefines = context._cacheGlobalDefines;
            globalShaderDefines.cloneTo(comDef);
            if (this._renderShaderData) {
                comDef.addDefineDatas(this._renderShaderData.getDefineData());
            }
            if (this._materialShaderData) {
                comDef.addDefineDatas(this._materialShaderData._defineDatas);
            }
            if (this.owner) {
                let additionShaderData = this.owner.additionShaderData;
                if (additionShaderData.size > 0) {
                    for (let [key, value] of additionShaderData.entries()) {
                        comDef.addDefineDatas(value.getDefineData());
                    }
                }
            }
            comDef.add(Laya.MeshSprite3DShaderDeclaration.SHADERDEFINE_GPU_INSTANCE);
            return comDef;
        }
    }

    class CullAdditionalInfo {
        constructor() {
            this.camCullRes = false;
            this.preCameraCullNode = null;
            this.dirCullRes = false;
            this.preDirCullNode = null;
            this.spotCullRes = false;
            this.preSpotCullNode = null;
        }
    }
    class OneBatchMark {
        notifyChange() {
            this.stateChangeMask = Laya.Stat.loopCount;
        }
        constructor(owner, agent, invertFrontFace = false) {
            this._needCreateRenderElement = false;
            this.elementCount = 0;
            this.indexOfCullPass = -1;
            this.changeFlag = 0;
            this.changeOnCreate = false;
            this.castShadow = false;
            this.cullUpdateMark = 0;
            this.stateChangeMask = -1;
            this.owner = owner;
            this.agent = agent;
            this.invertFrontFace = invertFrontFace;
            this.batchRenderList = new Laya.SingletonList();
            this.cullAdditionalInfo = new CullAdditionalInfo();
        }
        _createRenderElement() {
            let renderElement = this.batchRenderList.elements[0];
            renderElement.owner._renderUpdatePre(WebGPURenderContext3D._instance);
            if (!this.renderElement) {
                this.renderElement = new WebGPUMeshInstanceRenderElement(this.invertFrontFace);
                this._instanceStateInfo = { state: new Laya.WebGPUBufferState() };
                let geometry = this.renderGeometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElementIndirect);
                geometry.indexFormat = renderElement.geometry.indexFormat;
                this._Geo_IndexCount = renderElement.geometry._drawElementInfo.elements[1];
                this._Geo_IndexOffset = renderElement.geometry._drawElementInfo.elements[0] / geometry.gpuIndexByte;
                this._Geo_IndexOriOffset = this._Geo_IndexOffset;
                this.castShadow = renderElement.owner.castShadow;
                this.renderLayer = renderElement.owner.layer;
            }
            this.renderElement.materialShaderData = renderElement.materialShaderData;
            this.renderElement.subShader = renderElement.subShader;
            this.renderElement.cullMode = renderElement.cullMode;
            this.renderElement.renderShaderData = renderElement.renderShaderData;
            this._changeBufferState(renderElement);
            this.renderElement.geometry = this.renderGeometry;
            this._cacheUseNode = renderElement.owner;
            let oldOwner = renderElement.owner.shaderData;
            this.renderNode = Laya.Laya3DRender.Render3DModuleDataFactory.createBaseRenderNode();
            this.renderNode.shaderData = oldOwner;
            this.renderNode.setCommonUniformMap(renderElement.owner._commonUniformMap);
            this.renderNode.additionShaderData = renderElement.owner.additionShaderData;
            this.renderNode.setRenderelements([this.renderElement]);
            this.renderElement.isRender = true;
            this.renderElement.renderShaderData = this.renderNode.shaderData;
            this.renderElement.materialRenderQueue = renderElement.materialRenderQueue + renderElement.materialShaderData._id * 10 + this.renderGeometry.bufferState._vertexBuffers[0].globalId / 10;
            this.owner.buffer_IndirectDrawBuffer[this.indexOfCullPass * 5] = this._Geo_IndexCount;
            this.owner.buffer_IndirectDrawBuffer[this.indexOfCullPass * 5 + 2] = this._Geo_IndexOffset;
            this.owner.bufferUpdate_IndirectDrawBuffer.x = Math.min(this.owner.bufferUpdate_IndirectDrawBuffer.x, this.indexOfCullPass);
            this.owner.bufferUpdate_IndirectDrawBuffer.y = Math.max(this.owner.bufferUpdate_IndirectDrawBuffer.y, this.indexOfCullPass);
            this.renderGeometry.clearRenderParams();
            this.renderGeometry.setIndirectDrawBuffer(this.owner.deviceBuffer_IndirectDrawBuffer, this.indexOfCullPass * 5 * 4);
            this.changeFlag = Laya.Stat.loopCount;
            this._needCreateRenderElement = false;
        }
        _changeBufferState(renderElement) {
            this._instanceStateInfo.worldInstanceVB = this.owner.vertexBuffer_worldInstance;
            this._instanceStateInfo.lightmapScaleOffsetVB = this.owner.vertexBuffer_LightmapScaleOffset;
            this._instanceStateInfo.simpleAnimatorVB = this.owner.vertexBuffer_simpleSkinInstance;
            WebGPUMeshInstanceUtil.getInstanceBufferState(this._instanceStateInfo, this.owner.renderType, renderElement.geometry, this.renderGeometry, this);
            this.renderGeometry.bufferState = this._instanceStateInfo.state;
        }
        _changeFlag() {
            if (this.changeOnCreate || this.owner._deviceBufferChange >= this.changeFlag) {
                this._changeBufferState(this.batchRenderList.elements[0]);
                if (this.owner._IndirectDrawBufferChange > this.changeFlag) {
                    this.renderGeometry.clearRenderParams();
                    this.renderGeometry.setIndirectDrawBuffer(this.owner.deviceBuffer_IndirectDrawBuffer, this.indexOfCullPass * 5 * 4);
                }
                this.changeFlag = Laya.Stat.loopCount;
                this.changeOnCreate = false;
            }
        }
        cullInsert(cullMode, cullData, isShadow) {
            if (isShadow && this.castShadow) {
                if (this.castShadow) {
                    this._changeFlag();
                    return true;
                }
                else
                    return false;
            }
            else {
                this._changeFlag();
                return true;
            }
        }
        _updateElementBuffer(count) {
            if (this.needReSetElementIndexBuffer) {
                let currentElement = Math.ceil(this.elementCount / 100) * 100;
                if (!this._elementInfoArray || this._elementInfoArray.length < currentElement * 2)
                    this._elementInfoArray = new Uint32Array(currentElement * 2);
                let elements = this.batchRenderList.elements;
                let index = 0;
                for (var i = 0, n = this.batchRenderList.length; i < n; i++) {
                    this._elementInfoArray[index++] = elements[i].owner.customData.cullPassIndex;
                    this._elementInfoArray[index++] = this.indexOfCullPass;
                }
            }
            if (count * 2 + this._elementInfoArray.length > this.owner.buffer_renderElementsInfo.length) {
                this.owner.buffer_renderElementsInfo.set(this._elementInfoArray.slice(0, this.elementCount * 2), count * 2);
            }
            else {
                this.owner.buffer_renderElementsInfo.set(this._elementInfoArray, count * 2);
            }
        }
        addElement(element) {
            this.batchRenderList.add(element);
            this.elementCount = this.batchRenderList.length;
            this.owner.needUpdateElemenetIndex = true;
            this.needReSetElementIndexBuffer = true;
            this.notifyChange();
            if (this.batchRenderList.length > 1 && !this.canBatch) {
                this.canBatch = true;
                this.owner.addOneBatchMark(this);
                this._needCreateRenderElement = true;
                this.owner._needCreateRenderElementBatch.add(this);
                this.agent._checkCPUCullList.add(this.batchRenderList.elements[0].owner);
            }
        }
        removeElement(element) {
            if (element.owner == this.cullAdditionalInfo.preCameraCullNode) {
                this.cullAdditionalInfo.preCameraCullNode = null;
                this.owner._cacheCameraPreCullList.remove(element.owner);
            }
            if (element.owner == this.cullAdditionalInfo.preDirCullNode) {
                this.cullAdditionalInfo.preDirCullNode = null;
                this.owner._cacheDirPreCullList.remove(element.owner);
            }
            this.batchRenderList.remove(element);
            this.elementCount = this.batchRenderList.length;
            this.owner.needUpdateElemenetIndex = true;
            this.needReSetElementIndexBuffer = true;
            this.notifyChange();
            if (element.owner == this._cacheUseNode) {
                if (this.batchRenderList.length > 0) {
                    this._cacheUseNode = this.batchRenderList.elements[0].owner;
                    this.renderNode.shaderData = this._cacheUseNode.shaderData;
                    this.renderElement.renderShaderData = this._cacheUseNode.shaderData;
                }
                else {
                    this._cacheUseNode = null;
                    this.renderNode.shaderData = null;
                    this.renderElement.renderShaderData = null;
                }
            }
            if (this.batchRenderList.length == 1 && this.canBatch) {
                this.canBatch = false;
                this._needCreateRenderElement = false;
                this.owner._needCreateRenderElementBatch.remove(this);
                this.owner.removeOneBatchMark(this);
                this.agent._checkCPUCullList.add(this.batchRenderList.elements[0].owner);
            }
        }
        release() {
            this.batchRenderList.clear();
            this.batchRenderList = null;
            this.renderElement && this.renderElement.destroy();
            this.renderGeometry && this.renderGeometry.destroy();
            this.renderNode && this.renderNode.destroy();
            this._elementInfoArray = null;
            this._instanceStateInfo = null;
            this._cacheUseNode = null;
        }
    }

    class WebGPUMeshBatchCPUCullNodeList {
        constructor() {
            this._dynamicCullList = new Laya.SingletonList();
            this._staticCullList = new Laya.SingletonList();
            this._tempCullList = new Laya.SingletonList();
        }
        add(node) {
            if (node.staticMask != Laya.StaticFlag.StaticBatch) {
                this._dynamicCullList.add(node);
            }
            else {
                this._staticCullList.add(node);
                this._staticChangeMask = Laya.Stat.loopCount;
            }
        }
        remove(node) {
            if (node.staticMask != Laya.StaticFlag.StaticBatch) {
                this._dynamicCullList.remove(node);
            }
            else {
                this._staticCullList.remove(node);
                this._staticChangeMask = Laya.Stat.loopCount;
            }
        }
        clear() {
            this._dynamicCullList.clear();
            this._staticCullList.clear();
            this._oneBatchCullList = null;
        }
    }
    class WebGPUMeshBatchCPUCullResult {
        constructor() {
            this._dynamicCullResult = new Laya.FastSinglelist();
            this._staticOpaqueCullResult = new Laya.FastSinglelist();
            this._staticTransCullResult = new Laya.FastSinglelist();
            this._tempList = new Laya.FastSinglelist();
            this.forwardNeedUpdateNode = new Laya.FastSinglelist();
            this.needCullStatic = true;
        }
        mergeResoult(queue, trans) {
            if (this.needCullStatic) {
                BatchAgentSortUtil.quickSortInPlace2(this._staticOpaqueCullResult.elements, 0, this._staticOpaqueCullResult.length - 1);
            }
            BatchAgentSortUtil.quickSortInPlace2(this._dynamicCullResult.elements, 0, this._dynamicCullResult.length - 1);
            queue.clear();
            let elements = this._staticOpaqueCullResult.elements;
            for (var i = 0, n = this._staticOpaqueCullResult.length; i < n; i++) {
                queue.addRenderElement(elements[i]);
            }
            elements = this._dynamicCullResult.elements;
            for (var i = 0, n = this._dynamicCullResult.length; i < n; i++) {
                queue.addRenderElement(elements[i]);
            }
            if (trans) {
                elements = this._staticTransCullResult.elements;
                for (var i = 0, n = this._staticTransCullResult.length; i < n; i++) {
                    trans.addRenderElement(elements[i]);
                }
            }
        }
        clear() {
            this._dynamicCullResult.clear();
            this._staticOpaqueCullResult.clear();
            this._staticTransCullResult.clear();
            this.needCullStatic = true;
        }
    }
    class WebGPUMeshRenderBatchAgent {
        constructor(renderType = Laya.BaseRenderType.MeshRender) {
            this._cpuCameraCullResult = new WebGPUMeshBatchCPUCullResult();
            this._cpuDirCullResoult = new WebGPUMeshBatchCPUCullResult();
            this._cpuSpotCullResoult = new WebGPUMeshBatchCPUCullResult();
            this._changeElementBatchMark = new Laya.SingletonList();
            this._changeInstanceData = new Laya.SingletonList();
            this._updateMark = 0;
            this._checkCPUCullList = new Laya.SingletonList();
            this._kipCullCount = 3;
            this._canKipCull = -1;
            this._renderType = renderType;
            this._cameraCullInfo = [];
            this._dirShadowCullInfo = [];
            this._spotCullInfo = [];
            this._batchOpaqueMarks = new Map();
            this._list = new Laya.SingletonList();
            this._baseRenderList = new Laya.SingletonList();
            this._mainBatchQueue = new Laya.FastSinglelist();
            this._shadowBatchQueue = new Laya.FastSinglelist();
            this._spotBatchQueue = new Laya.FastSinglelist();
            this._cpuCullList = new WebGPUMeshBatchCPUCullNodeList();
            this._gpuCUllPass = new BatchCullPass(renderType);
        }
        _getBatchMark(element) {
            const renderNode = element.owner;
            const geometry = element.geometry;
            const invertFrontFace = element.transform ? element.transform._isFrontFaceInvert : false;
            const invertFrontFaceFlag = invertFrontFace ? 1 : 0;
            const receiveShadowFlag = renderNode.receiveShadow ? 1 : 0;
            const geometryFlag = geometry._id;
            const materialFlag = element.materialId;
            const renderId = (materialFlag << 17) + (geometryFlag << 2) + (invertFrontFaceFlag << 1) + (receiveShadowFlag);
            const reflectFlag = (renderNode.probeReflection ? renderNode.probeReflection._id : -1) + 1;
            const lightmapFlag = renderNode.lightmapIndex + 1;
            const lightProbeFlag = (renderNode.volumetricGI ? renderNode.volumetricGI._id : -1) + 1;
            const giId = (reflectFlag << 10) + (lightmapFlag << 20) + lightProbeFlag;
            if (!this._batchOpaqueMarks.has(renderId)) {
                this._batchOpaqueMarks.set(renderId, {});
            }
            const data = this._batchOpaqueMarks.get(renderId);
            let batchmark = data[giId] || (data[giId] = new OneBatchMark(this._gpuCUllPass, this, invertFrontFace));
            return batchmark;
        }
        _canBatch(element) {
            var _a;
            return element.materialRenderQueue < 2500 && element.canDynamicBatch && ((_a = element.subShader) === null || _a === void 0 ? void 0 : _a._owner._enableInstancing);
        }
        _addBatchMark(renderNode) {
            let elements = renderNode.renderelements;
            let customData = new renderNodeCustomData();
            customData._initData();
            renderNode.customData = customData;
            for (var i = 0; i < elements.length; i++) {
                let recoard = new batchRecoard();
                customData.batchRecoards.push(recoard);
                let element = elements[i];
                recoard.renderElement = element;
                if (this._canBatch(element)) {
                    recoard.canBatch = true;
                    let batchMark = this._getBatchMark(element);
                    batchMark.addElement(element);
                    customData.hasBatch = true;
                    recoard.batchMark = batchMark;
                }
                else {
                    recoard.canBatch = false;
                    recoard.batchMark = null;
                    customData.allBatch = false;
                }
            }
            if (customData.hasBatch) {
                this._gpuCUllPass.addNode(renderNode);
                this._changeInstanceData.add(renderNode);
            }
            this._checkCPUCullList.add(renderNode);
        }
        _removeBatchMark(renderNode) {
            let customData = renderNode.customData;
            if (customData.hasBatch) {
                this._gpuCUllPass.removeNode(renderNode);
            }
            let batchRecoards = customData.batchRecoards;
            for (var i = 0; i < batchRecoards.length; i++) {
                let recoard = batchRecoards[i];
                if (recoard.canBatch) {
                    recoard.batchMark.removeElement(recoard.renderElement);
                }
            }
            this._checkCPUCullList.add(renderNode);
        }
        _changeBatchMark(renderNode) {
            let customData = renderNode.customData;
            let batchRecoards = customData.batchRecoards;
            for (var i = 0; i < batchRecoards.length; i++) {
                let recoard = batchRecoards[i];
                if (recoard.canBatch) {
                    recoard.batchMark.removeElement(recoard.renderElement);
                }
            }
            customData.batchRecoards = batchRecoards = [];
            let elements = renderNode.renderelements;
            customData.allBatch = true;
            customData.hasBatch = false;
            for (var i = 0; i < elements.length; i++) {
                let recoard = new batchRecoard();
                batchRecoards.push(recoard);
                let element = elements[i];
                recoard.renderElement = element;
                if (this._canBatch(element)) {
                    recoard.canBatch = true;
                    let batchMark = this._getBatchMark(element);
                    batchMark.addElement(element);
                    customData.hasBatch = true;
                    recoard.batchMark = batchMark;
                }
                else {
                    recoard.canBatch = false;
                    recoard.batchMark = null;
                    customData.allBatch = false;
                }
            }
            if (customData.hasBatch) {
                this._gpuCUllPass.addNode(renderNode);
                this._changeInstanceData.add(renderNode);
            }
            else if (this._gpuCUllPass.hasNode(renderNode)) {
                this._gpuCUllPass.removeNode(renderNode);
            }
            this._checkCPUCullList.add(renderNode);
        }
        _checkBaseRenderNodeCullMode() {
            let elements = this._checkCPUCullList.elements;
            for (var i = 0; i < this._checkCPUCullList.length; i++) {
                let node = elements[i];
                let customData = node.customData;
                let needcpuList = false;
                if (this._baseRenderList.indexof(node) == -1) {
                    needcpuList = false;
                }
                else {
                    for (var j = 0; j < customData.batchRecoards.length; j++) {
                        let recoards = customData.batchRecoards[j];
                        if (!recoards.canBatch || !recoards.batchMark.canBatch) {
                            needcpuList = true;
                        }
                    }
                }
                if (needcpuList) {
                    this._cpuCullList.add(node);
                }
                else {
                    this._cpuCullList.remove(node);
                }
            }
            this._checkCPUCullList.length = 0;
        }
        _cullpassRun(context) {
            this._updateMark = context.sceneUpdateMask;
            this._checkBaseRenderNodeCullMode();
            let elemnts = this._changeElementBatchMark.elements;
            let length = this._changeElementBatchMark.length;
            for (var i = 0; i < length; i++) {
                this._changeBatchMark(elemnts[i]);
            }
            this._changeElementBatchMark.length = 0;
            length = this._changeInstanceData.length;
            if (length > 0) {
                this._gpuCUllPass.updateData(this._changeInstanceData);
            }
            this._changeInstanceData.length = 0;
            this._gpuCUllPass.setCullingCamera(this._cameraCullInfo, this._dirShadowCullInfo, this._spotCullInfo);
            this._gpuCUllPass.applyComputeCull();
        }
        create() {
        }
        addRenderNode(object) {
            if (this._list.indexof(object) != -1) {
                return true;
            }
            this._list.add(object);
            let baseNode = object._baseRenderNode;
            this._baseRenderList.add(baseNode);
            this._addBatchMark(baseNode);
            return true;
        }
        removeRenderNode(object) {
            if (this._list.indexof(object) == -1) {
                return true;
            }
            this._list.remove(object);
            let baseNode = object._baseRenderNode;
            this._baseRenderList.remove(baseNode);
            this._removeBatchMark(baseNode);
            this._changeElementBatchMark.remove(baseNode);
            this._changeInstanceData.remove(baseNode);
            this._canKipCull = Laya.Stat.loopCount;
            return true;
        }
        _isFrontFaceBatchChanged(renderNode) {
            const batchRecoards = renderNode.customData.batchRecoards;
            for (let i = 0, n = batchRecoards.length; i < n; i++) {
                const recoard = batchRecoards[i];
                if (!recoard.canBatch) {
                    continue;
                }
                const transform = recoard.renderElement.transform;
                const invertFrontFace = transform ? transform._isFrontFaceInvert : false;
                if (recoard.batchMark.invertFrontFace !== invertFrontFace) {
                    return true;
                }
            }
            return false;
        }
        updateProperty(object, property) {
            let baseRenerNode = object._baseRenderNode;
            switch (property) {
                case Laya.propertyChangeFlag.castShadow:
                case Laya.propertyChangeFlag.receiveShadow:
                case Laya.propertyChangeFlag.volumGI:
                case Laya.propertyChangeFlag.lightmap:
                case Laya.propertyChangeFlag.reflection:
                    this._changeElementBatchMark.add(baseRenerNode);
                    this._canKipCull = Laya.Stat.loopCount;
                    break;
                case Laya.propertyChangeFlag.invertY:
                    if (this._isFrontFaceBatchChanged(baseRenerNode)) {
                        this._changeElementBatchMark.add(baseRenerNode);
                        this._canKipCull = Laya.Stat.loopCount;
                    }
                    break;
                case Laya.propertyChangeFlag.transform:
                case Laya.propertyChangeFlag.lightmapData:
                case Laya.propertyChangeFlag.RenderCustomData:
                case Laya.propertyChangeFlag.VisibalRange:
                case Laya.propertyChangeFlag.SimpleSkineParam:
                    if (baseRenerNode.customData.hasBatch) {
                        this._changeInstanceData.add(baseRenerNode);
                    }
                    if (property === Laya.propertyChangeFlag.transform && baseRenerNode.staticMask === Laya.StaticFlag.StaticBatch) {
                        this._cpuCullList._staticChangeMask = Laya.Stat.loopCount;
                    }
                    break;
            }
        }
        _isCameraChange(cameraCullInfo) {
            if (!this._cacheInfo) {
                this._cacheInfo = new Laya.CameraCullInfo();
                this._cacheInfo.position = new Laya.Vector3();
            }
            else if (!this._cacheInfo.position.equal(cameraCullInfo.position) || !this._cacheInfo.boundFrustum.equalsBoundFrustum(cameraCullInfo.boundFrustum) || this._cacheInfo.cullingMask != cameraCullInfo.cullingMask) {
                this._cameraChangeMask = Laya.Stat.loopCount;
                cameraCullInfo.boundFrustum.cloneTo(this._cacheInfo.boundFrustum);
                this._cacheInfo.cullingMask = cameraCullInfo.cullingMask;
                cameraCullInfo.position.cloneTo(this._cacheInfo.position);
                this._cacheInfo.staticMask = cameraCullInfo.staticMask;
                this._cacheInfo.useOcclusionCulling = cameraCullInfo.useOcclusionCulling;
            }
            if (this._cacheInfo.id !== cameraCullInfo.id) {
                this._cacheInfo.id = cameraCullInfo.id;
                this._canKipCull = Laya.Stat.loopCount;
            }
        }
        _isDirCullChange(shadowCullInfo) {
            if (!this._cacheDirCullInfo) {
                this._cacheDirCullInfo = new Laya.ShadowCullInfo();
                this._cacheDirCullInfo.position = new Laya.Vector3();
                this._cacheDirCullInfo.direction = new Laya.Vector3();
                this._cacheDirCullInfo.cullSphere = new Laya.BoundSphere();
            }
            else if (!this._cacheDirCullInfo.position.equal(shadowCullInfo.position) || !this._cacheDirCullInfo.direction.equal(shadowCullInfo.direction)) {
                this._dirCullChangeMask = Laya.Stat.loopCount;
                this._cacheDirCullInfo.cullPlaneCount = shadowCullInfo.cullPlaneCount;
                this._cacheDirCullInfo.cullPlanes = shadowCullInfo.cullPlanes;
                shadowCullInfo.cullSphere.cloneTo(this._cacheDirCullInfo.cullSphere);
                shadowCullInfo.position.cloneTo(this._cacheDirCullInfo.position);
                shadowCullInfo.direction.cloneTo(this._cacheDirCullInfo.direction);
            }
        }
        _isSpotCullChange(spotCullInfo) {
            if (!this._cacheSpotCullInfo) {
                this._cacheSpotCullInfo = new Laya.CameraCullInfo();
                this._cacheSpotCullInfo.position = new Laya.Vector3();
            }
            else if (!this._cacheSpotCullInfo.position.equal(spotCullInfo.position) || !this._cacheSpotCullInfo.boundFrustum.equalsBoundFrustum(spotCullInfo.boundFrustum) || this._cacheSpotCullInfo.cullingMask != spotCullInfo.cullingMask) {
                this._spotCullChangeMask = Laya.Stat.loopCount;
                spotCullInfo.boundFrustum.cloneTo(this._cacheSpotCullInfo.boundFrustum);
                this._cacheSpotCullInfo.cullingMask = spotCullInfo.cullingMask;
                spotCullInfo.position.cloneTo(this._cacheSpotCullInfo.position);
                this._cacheSpotCullInfo.staticMask = spotCullInfo.staticMask;
                this._cacheSpotCullInfo.useOcclusionCulling = spotCullInfo.useOcclusionCulling;
            }
        }
        setCullCamera(cameraCullInfo) {
            if (cameraCullInfo.length > this._mainBatchQueue.length) {
                let createCount = cameraCullInfo.length - this._mainBatchQueue.length;
                for (var i = 0; i < createCount; i++) {
                    this._mainBatchQueue.add(new WebGPUBatchQueue(true));
                }
            }
            else {
                this._mainBatchQueue.length = cameraCullInfo.length;
            }
            this._cameraCullInfo = cameraCullInfo;
            this._isCameraChange(cameraCullInfo[0]);
        }
        setDirLightCullInfo(directLightCullInfo) {
            if (directLightCullInfo.length > this._shadowBatchQueue.length) {
                let createCount = directLightCullInfo.length - this._shadowBatchQueue.length;
                for (var i = 0; i < createCount; i++) {
                    this._shadowBatchQueue.add(new WebGPUBatchQueue(false));
                }
            }
            else {
                this._shadowBatchQueue.length = directLightCullInfo.length;
            }
            this._dirShadowCullInfo = directLightCullInfo;
            this._isDirCullChange(directLightCullInfo[0]);
        }
        setSpotCullingDir(spotCullInfo) {
            if (spotCullInfo.length > this._spotBatchQueue.length) {
                let createCount = spotCullInfo.length - this._spotBatchQueue.length;
                for (var i = 0; i < createCount; i++) {
                    this._spotBatchQueue.add(new WebGPUBatchQueue(false));
                }
            }
            else {
                this._spotBatchQueue.length = spotCullInfo.length;
            }
            this._spotCullInfo = spotCullInfo;
            this._isSpotCullChange(spotCullInfo[0]);
        }
        appendRenderElement(cullMode, cullInfoIndex, context) {
            if (Laya.Stat.loopCount % 3 != 0 && this._canKipCull != Laya.Stat.loopCount) {
                if (this._cameraChangeMask == Laya.Stat.loopCount) {
                    this._cameraChangeMask += 1;
                }
                if (this._dirCullChangeMask == Laya.Stat.loopCount) {
                    this._dirCullChangeMask += 1;
                }
                if (this._spotCullChangeMask == Laya.Stat.loopCount) {
                    this._spotCullChangeMask += 1;
                }
                return this.appendRenderElementUseForward(cullMode, cullInfoIndex, context);
            }
            if (this._list.length > 0 || this._checkCPUCullList.length > 0) {
                this._cullpassRun(context);
            }
            let moduleBatchQueue;
            let cullInfo;
            switch (cullMode) {
                case Laya.BatchCullMode.Camera:
                    cullInfo = this._cameraCullInfo[cullInfoIndex];
                    moduleBatchQueue = this._mainBatchQueue.elements[cullInfoIndex];
                    moduleBatchQueue.clearList();
                    this._cpuCameraCullResult.needCullStatic = true;
                    if (this._cameraChangeMask == Laya.Stat.loopCount) {
                        this._cpuCameraCullResult.clear();
                        this._cpuCullList._oneBatchCullList = this._gpuCUllPass._cacheCameraPreCullList;
                    }
                    else {
                        this._cpuCameraCullResult.needCullStatic = this._cpuCullList._staticChangeMask == Laya.Stat.loopCount;
                        this._cpuCameraCullResult._dynamicCullResult.clear();
                        this._cpuCullList._tempCullList.clear();
                        this._cpuCullList._oneBatchCullList = this._cpuCullList._tempCullList;
                        let batchMarks = this._gpuCUllPass.oneBatchMarks;
                        for (var i = 0; i < batchMarks.elements.length; i++) {
                            let batchmark = batchMarks.elements[i];
                            if (batchmark) {
                                if (batchmark.stateChangeMask == Laya.Stat.loopCount && (batchmark.cullAdditionalInfo.preCameraCullNode != null)) {
                                    this._cpuCullList._oneBatchCullList.add(batchmark.cullAdditionalInfo.preCameraCullNode);
                                }
                            }
                        }
                    }
                    WebGPUBatch_CullDataSet.cullByCameraCullInfo2(cullInfo, this._cpuCullList, this._cpuCameraCullResult, moduleBatchQueue.transparentQueue, context);
                    this._cpuCameraCullResult.mergeResoult(moduleBatchQueue.opaqueQueue, moduleBatchQueue.transparentQueue);
                    break;
                case Laya.BatchCullMode.DirectLight:
                    cullInfo = this._dirShadowCullInfo[cullInfoIndex];
                    moduleBatchQueue = this._shadowBatchQueue.elements[cullInfoIndex];
                    moduleBatchQueue.clearList();
                    this._cpuDirCullResoult.needCullStatic = true;
                    if (this._dirCullChangeMask == Laya.Stat.loopCount) {
                        this._cpuDirCullResoult.clear();
                        this._cpuCullList._oneBatchCullList = this._gpuCUllPass._cacheDirPreCullList;
                    }
                    else {
                        this._cpuDirCullResoult.needCullStatic = this._cpuCullList._staticChangeMask == Laya.Stat.loopCount;
                        this._cpuDirCullResoult._dynamicCullResult.clear();
                        this._cpuCullList._tempCullList.clear();
                        this._cpuCullList._oneBatchCullList = this._cpuCullList._tempCullList;
                        let batchMarks = this._gpuCUllPass.oneBatchMarks;
                        for (var i = 0; i < batchMarks.elements.length; i++) {
                            let batchmark = batchMarks.elements[i];
                            if (batchmark) {
                                if (batchmark.stateChangeMask == Laya.Stat.loopCount && (batchmark.cullAdditionalInfo.preDirCullNode != null)) {
                                    this._cpuCullList._oneBatchCullList.add(batchmark.cullAdditionalInfo.preDirCullNode);
                                }
                            }
                        }
                    }
                    WebGPUBatch_CullDataSet.cullDirectLightShadow2(cullInfo, this._cpuCullList, this._cpuDirCullResoult, context);
                    this._cpuDirCullResoult.mergeResoult(moduleBatchQueue.opaqueQueue, null);
                    break;
                case Laya.BatchCullMode.Spot:
                    cullInfo = this._spotCullInfo[cullInfoIndex];
                    moduleBatchQueue = this._spotBatchQueue.elements[cullInfoIndex];
                    moduleBatchQueue.clearList();
                    this._cpuSpotCullResoult.needCullStatic = true;
                    if (this._spotCullChangeMask == Laya.Stat.loopCount) {
                        this._cpuSpotCullResoult.clear();
                        this._cpuCullList._oneBatchCullList = this._gpuCUllPass._cacheSpotPreCullList;
                    }
                    else {
                        this._cpuSpotCullResoult.needCullStatic = this._cpuCullList._staticChangeMask == Laya.Stat.loopCount;
                        this._cpuSpotCullResoult._dynamicCullResult.clear();
                        this._cpuCullList._tempCullList.clear();
                        this._cpuCullList._oneBatchCullList = this._cpuCullList._tempCullList;
                        let batchMarks = this._gpuCUllPass.oneBatchMarks;
                        for (var i = 0; i < batchMarks.elements.length; i++) {
                            let batchmark = batchMarks.elements[i];
                            if (batchmark) {
                                if (batchmark.stateChangeMask == Laya.Stat.loopCount && (batchmark.cullAdditionalInfo.preSpotCullNode != null)) {
                                    this._cpuCullList._oneBatchCullList.add(batchmark.cullAdditionalInfo.preSpotCullNode);
                                }
                            }
                        }
                    }
                    WebGPUBatch_CullDataSet.cullSpotLightShadow2(cullInfo, this._cpuCullList, this._cpuSpotCullResoult, context);
                    this._cpuSpotCullResoult.mergeResoult(moduleBatchQueue.opaqueQueue, null);
                    break;
            }
            this._gpuCUllPass.appendRenderELement(cullMode, cullInfoIndex, moduleBatchQueue, cullInfo, context, this);
            return moduleBatchQueue;
        }
        appendRenderElementUseForward(cullMode, cullInfoIndex, context) {
            if (this._list.length > 0 || this._checkCPUCullList.length > 0) {
                if (this._updateMark == context.sceneUpdateMask) {
                    this._updateMark = context.sceneUpdateMask;
                    let length = this._changeInstanceData.length;
                    if (length > 0) {
                        this._gpuCUllPass.updateData(this._changeInstanceData);
                    }
                    this._changeInstanceData.length = 0;
                }
            }
            let moduleBatchQueue;
            let resoult;
            switch (cullMode) {
                case Laya.BatchCullMode.Camera:
                    moduleBatchQueue = this._mainBatchQueue.elements[cullInfoIndex];
                    resoult = this._cpuCameraCullResult;
                    break;
                case Laya.BatchCullMode.DirectLight:
                    moduleBatchQueue = this._shadowBatchQueue.elements[cullInfoIndex];
                    resoult = this._cpuDirCullResoult;
                    break;
                case Laya.BatchCullMode.Spot:
                    moduleBatchQueue = this._spotBatchQueue.elements[cullInfoIndex];
                    resoult = this._cpuSpotCullResoult;
                    break;
            }
            this._gpuCUllPass.applyGetResoultCull(cullMode, cullInfoIndex, this);
            {
                let opaqueQueue = resoult._dynamicCullResult;
                let queElement = opaqueQueue.elements;
                let queLength = opaqueQueue.elements.length;
                for (var i = 0; i < queLength; i++) {
                    queElement[i].owner._renderUpdatePre(context);
                }
                let transList = moduleBatchQueue.transparentList;
                if (transList) {
                    for (var i = 0, n = transList.length; i < n; i++) {
                        transList.elements[i].owner._renderUpdatePre(context);
                    }
                }
            }
            return moduleBatchQueue;
        }
        release() {
            this._cameraCullInfo = null;
            this._dirShadowCullInfo = null;
            this._spotCullInfo = null;
            this._gpuCUllPass.release();
            this._gpuCUllPass = null;
            this._batchOpaqueMarks.forEach((value, key) => {
                for (let j in value) {
                    value[j].release();
                }
            });
            this._batchOpaqueMarks.clear();
            this._list.clear();
            this._list = null;
            this._baseRenderList.clear();
            this._baseRenderList = null;
            this._mainBatchQueue.clear();
            this._shadowBatchQueue.clear();
            this._spotBatchQueue.clear();
            this._cpuCullList.clear();
            this._cpuCullList = null;
            this._changeElementBatchMark.clear();
            this._changeElementBatchMark = null;
            this._changeInstanceData.clear();
            this._changeInstanceData = null;
        }
    }
    WebGPUMeshRenderBatchAgent.mergeBigBuffer = false;

    class WebGPUBaseRenderNode extends WebBaseRenderNode {
        constructor() {
            super(...arguments);
            this.bindGroupChangeFlag = new Laya.Vector2();
            this.bindGroupLayoutChangeFlag = new Laya.Vector2();
            this.defineDataChangeFlag = new Laya.Vector2();
        }
        get shaderData() {
            return this._shaderData;
        }
        set shaderData(value) {
            if (this._shaderData != value) {
                this._worldMatrixField = null;
                this._worldInvertFrontField = null;
                let oldCommandMap = this._commonUniformMap.slice();
                if (this._shaderData) {
                    this.setCommonUniformMap([]);
                }
                this._shaderData = value;
                this.setCommonUniformMap(oldCommandMap);
            }
        }
        _setTransformWorldMatrix(value) {
            const field = this._worldMatrixField
                || (this._worldMatrixField = this._shaderData.getUniformField(Laya.Sprite3D.WORLDMATRIX));
            if (!field.setMatrix4x4(value))
                this._shaderData.setMatrix4x4(Laya.Sprite3D.WORLDMATRIX, value);
        }
        _setTransformWorldInvertFront(value) {
            const field = this._worldInvertFrontField
                || (this._worldInvertFrontField = this._shaderData.getUniformField(Laya.Sprite3D.WORLDINVERTFRONT));
            if (!field.setVector4(value))
                this._shaderData.setVector(Laya.Sprite3D.WORLDINVERTFRONT, value);
        }
        set additionShaderData(value) {
            if (this._additionShaderData && this._additionShaderData.size > 0) {
                if (!value)
                    for (var [key, date] of this._additionShaderData) {
                        date.removeBindGroupChangeFlag(key, this.bindGroupChangeFlag, this.bindGroupLayoutChangeFlag);
                        date._defineDatas.removeChangeFlagInfo(this.defineDataChangeFlag);
                    }
                else {
                    for (var [key, date] of this._additionShaderData) {
                        if (!value.has(key)) {
                            date.removeBindGroupChangeFlag(key, this.bindGroupChangeFlag, this.bindGroupLayoutChangeFlag);
                            date._defineDatas.removeChangeFlagInfo(this.defineDataChangeFlag);
                        }
                    }
                }
            }
            this._additionShaderData = value;
            if (value && value.size > 0) {
                this._additionShaderDataKeys = Array.from(this._additionShaderData.keys());
                for (var [key, shaderdate] of value) {
                    shaderdate.addBindGroupChangeFlag(key, this.bindGroupChangeFlag, this.bindGroupLayoutChangeFlag);
                    shaderdate._defineDatas.addChangeFlagInfo(this.defineDataChangeFlag);
                }
            }
            else {
                this._additionShaderDataKeys = [];
            }
        }
        get additionShaderData() {
            return this._additionShaderData;
        }
        setCommonUniformMap(value) {
            this._commonUniformMap.forEach(element => {
                if (value.indexOf(element) == -1) {
                    let unifomrMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap(element);
                    this._shaderData.removeBindGroupChangeLink(element, unifomrMap._idata);
                }
            });
            this._commonUniformMap.length = 0;
            value.forEach(element => {
                this._commonUniformMap.push(element);
                if (this.shaderData) {
                    let unifomrMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap(element);
                    this.shaderData.createSubUniformBuffer(element, element, unifomrMap._idata);
                    this._shaderData.addBindGroupChangeLink(element, unifomrMap._idata);
                    this._shaderData.addBindGroupChangeFlag(element, this.bindGroupChangeFlag, this.bindGroupLayoutChangeFlag);
                    this._shaderData._defineDatas.addChangeFlagInfo(this.defineDataChangeFlag);
                }
            });
        }
    }

    class WebGPUBlitQuadCMDData extends Laya.BlitQuadCMDData {
        get dest() {
            return this._dest;
        }
        set dest(value) {
            this._dest = value;
        }
        get viewport() {
            return this._viewport;
        }
        set viewport(value) {
            value.cloneTo(this._viewport);
        }
        get scissor() {
            return this._scissor;
        }
        set scissor(value) {
            value.cloneTo(this._scissor);
        }
        get source() {
            return this._source;
        }
        set source(value) {
            this._source = value;
            if (this._source)
                this._sourceTexelSize.setValue(1 / this._source.width, 1 / this._source.height, this._source.width, this._source.height);
        }
        get offsetScale() {
            return this._offsetScale;
        }
        set offsetScale(value) {
            value.cloneTo(this._offsetScale);
        }
        get element() {
            return this._element;
        }
        set element(value) {
            this._element = value;
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.Blit;
            this._viewport = new Laya.Viewport();
            this._scissor = new Laya.Vector4();
            this._offsetScale = new Laya.Vector4();
            this._sourceTexelSize = new Laya.Vector4();
        }
        apply(context) {
            this.element.materialShaderData._setInternalTexture(Laya.Command.SCREENTEXTURE_ID, this._source);
            this.element.materialShaderData.setVector(Laya.Command.SCREENTEXTUREOFFSETSCALE_ID, this._offsetScale);
            this.element.materialShaderData.setVector(Laya.Command.MAINTEXTURE_TEXELSIZE_ID, this._sourceTexelSize);
            context.setViewPort(this._viewport);
            context.setScissor(this._scissor);
            context.setRenderTarget(this.dest, Laya.RenderClearFlag.Nothing);
            context.drawRenderElementOne(this.element);
        }
    }

    class WebGPUDrawElementCMDData extends Laya.DrawElementCMDData {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.DrawElement;
        }
        setRenderelements(value) {
            this._elemets = value;
        }
        apply(context) {
            if (this._elemets.length == 1) {
                context.drawRenderElementOne(this._elemets[0]);
            }
            else {
                this._elemets.forEach(element => {
                    context.drawRenderElementOne(element);
                });
            }
        }
    }

    class WebGPUDrawNodeCMDData extends Laya.DrawNodeCMDData {
        get node() {
            return this._node;
        }
        set node(value) {
            this._node = value;
        }
        get destShaderData() {
            return this._destShaderData;
        }
        set destShaderData(value) {
            this._destShaderData = value;
        }
        get destSubShader() {
            return this._destSubShader;
        }
        set destSubShader(value) {
            this._destSubShader = value;
        }
        get subMeshIndex() {
            return this._subMeshIndex;
        }
        set subMeshIndex(value) {
            this._subMeshIndex = value;
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.DrawNode;
        }
        apply(context) {
            this.node._renderUpdatePre(context);
            if (this.subMeshIndex == -1) {
                this.node.renderelements.forEach(element => {
                    const oriSubShader = element.subShader;
                    const oriMatShaderData = element.materialShaderData;
                    element.subShader = this._destSubShader;
                    element.materialShaderData = this._destShaderData;
                    context.drawRenderElementOne(element);
                    element.subShader = oriSubShader;
                    element.materialShaderData = oriMatShaderData;
                });
            }
            else {
                const element = this.node.renderelements[this.subMeshIndex];
                const oriSubShader = element.subShader;
                const oriMatShaderData = element.materialShaderData;
                element.subShader = this._destSubShader;
                element.materialShaderData = this._destShaderData;
                context.drawRenderElementOne(element);
                element.subShader = oriSubShader;
                element.materialShaderData = oriMatShaderData;
            }
        }
    }

    const viewport = new Laya.Viewport();
    const scissor = new Laya.Vector4();
    class WebGPUSetRenderTargetCMD extends Laya.SetRenderTargetCMD {
        get rt() {
            return this._rt;
        }
        set rt(value) {
            this._rt = value;
        }
        get clearFlag() {
            return this._clearFlag;
        }
        set clearFlag(value) {
            this._clearFlag = value;
        }
        get clearColorValue() {
            return this._clearColorValue;
        }
        set clearColorValue(value) {
            value.cloneTo(this._clearColorValue);
            this._clearColorValues = null;
        }
        get clearDepthValue() {
            return this._clearDepthValue;
        }
        set clearDepthValue(value) {
            this._clearDepthValue = value;
        }
        get clearStencilValue() {
            return this._clearStencilValue;
        }
        set clearStencilValue(value) {
            this._clearStencilValue = value;
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeRenderTarget;
            this._clearColorValue = new Laya.Color();
        }
        apply(context) {
            context.setRenderTarget(this.rt, Laya.RenderClearFlag.Nothing);
            context.setClearData(this.clearFlag, this.clearColorValue, this.clearDepthValue, this.clearStencilValue, this.clearColorValues);
            if (this.rt) {
                viewport.set(0, 0, this.rt._textures[0].width, this.rt._textures[0].height);
                scissor.setValue(0, 0, this.rt._textures[0].width, this.rt._textures[0].height);
                context.setViewPort(viewport);
                context.setScissor(scissor);
            }
        }
    }

    class WebGPUSetViewportCMD extends Laya.SetViewportCMD {
        get viewport() {
            return this._viewport;
        }
        set viewport(value) {
            this._viewport = value;
        }
        get scissor() {
            return this._scissor;
        }
        set scissor(value) {
            this._scissor = value;
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeViewPort;
            this.scissor = new Laya.Vector4();
            this.viewport = new Laya.Viewport();
        }
        apply(context) {
            context.setViewPort(this.viewport);
            context.setScissor(this.scissor);
        }
    }

    const dynamicOffsetsData = new Uint32Array(1);
    class WebGPUSkinRenderElement3D extends WebGPURenderElement3D {
        constructor() {
            super();
            this.objectName = 'WebGPUSkinRenderElement3D';
            this._skinnedDataSize = 0;
            this._skinnedBufferOffsetAlignment = 0;
            this.skinnedUniformMap = new Map();
            this.skinnedUniformMap.set(Laya.SkinnedMeshRenderer.BONES, {
                id: Laya.SkinnedMeshRenderer.BONES,
                uniformtype: Laya.ShaderDataType.Matrix4x4,
                propertyName: "u_bones",
                arrayLength: 1,
            });
            const boneCount = 24;
            let bufferLength = boneCount * 16 * Float32Array.BYTES_PER_ELEMENT;
            const engine = Laya.WebGPURenderEngine._instance;
            const alignment = engine.getDevice().limits.minUniformBufferOffsetAlignment;
            this._skinnedBufferOffsetAlignment = Math.ceil(bufferLength / alignment) * alignment;
            this._skinnedDataSize = this._skinnedBufferOffsetAlignment / Float32Array.BYTES_PER_ELEMENT;
        }
        _preUpdatePre(context) {
            var _a;
            super._preUpdatePre(context);
            if (this._renderShaderData && this.owner._commonUniformMap.length > 0) {
                if (this.skinnedData) {
                    let uniform = this.skinnedUniformMap.get(Laya.SkinnedMeshRenderer.BONES);
                    let arrayLength = 24 * (this.skinnedData.length);
                    if (arrayLength != uniform.arrayLength) {
                        uniform.arrayLength = arrayLength;
                        (_a = this.skinnedBuffer) === null || _a === void 0 ? void 0 : _a.destroy();
                        let descriptor = new Laya.WebGPUUniformBufferDescriptor("SkinSprite3D");
                        descriptor.setUniforms(this.skinnedUniformMap);
                        this.skinnedBuffer = Laya.WebGPURenderEngine._instance.gpuBufferMgr.getBlock(descriptor.byteLength, descriptor, null);
                        this.skinnedBuffer.uniformName = "SkinSprite3D";
                        this._bonesUniform = this.skinnedBuffer.descriptor.uniforms.get(Laya.SkinnedMeshRenderer.BONES);
                        this._spriteRenderDataChange = true;
                    }
                    const view = this._bonesUniform.view;
                    for (let i = 0; i < this.skinnedData.length; i++) {
                        view.set(this.skinnedData[i], this._skinnedDataSize * i);
                    }
                    this.skinnedBuffer.markDirty();
                }
            }
            return;
        }
        _bindGroup(context, info, command) {
            var _a, _b, _c, _d, _e;
            let shaderInstance = info.shaderInstance;
            {
                command.setBindGroup(0, context._sceneBindGroup);
            }
            {
                command.setBindGroup(1, context._cameraBindGroup);
            }
            {
                if (this.owner) {
                    let bindgroupChangeFlag = this.owner.bindGroupChangeFlag;
                    if (info.shaderChange || this._spriteRenderDataChange || Laya.compareCahceFlag(bindgroupChangeFlag, info.renderNodeBindGroupCacheFlag) || !((_a = info.nodeBindGroup) === null || _a === void 0 ? void 0 : _a.isBufferValid())) {
                        info.renderNodeBindGroupCacheFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                        let shaderResource = shaderInstance.uniformSetMap.get(2);
                        let textureExitsMask = shaderInstance.uniformTextureExits.get(2);
                        let commands = (_b = this.owner) === null || _b === void 0 ? void 0 : _b._commonUniformMap;
                        let shaderData = (_c = this.owner) === null || _c === void 0 ? void 0 : _c.shaderData;
                        let addition = (_d = this.owner) === null || _d === void 0 ? void 0 : _d.additionShaderData;
                        shaderData._cacheSubUniformBuffer(this.skinnedBuffer, "SkinSprite3D", "SkinSprite3D", this.skinnedUniformMap);
                        info.nodeBindGroup = Laya.WebGPURenderEngine._instance.bindGroupCache.getBindGroup(commands, shaderData, addition, shaderResource, textureExitsMask);
                        Laya.coverCahceFlag(this.owner.bindGroupLayoutChangeFlag, this._pipelineChangeFlag);
                    }
                }
                else {
                    info.nodeBindGroup = Laya.WebGPUBindGroupCache.emptyBindGroup;
                }
            }
            {
                if (this._materialShaderData) {
                    if (info.shaderChange || this._materialRenderDataChange || Laya.compareCahceFlag(this._matBindGroupChangeFlag, info.matBindGroupCacheFlag) || !((_e = info.matBindGroup) === null || _e === void 0 ? void 0 : _e.isBufferValid())) {
                        info.matBindGroupCacheFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                        let shaderResource = shaderInstance.uniformSetMap.get(3);
                        let textureExitsMask = shaderInstance.uniformTextureExits.get(3);
                        info.matBindGroup = Laya.WebGPURenderEngine._instance.bindGroupCache.getBindGroup([this._subShader._owner.name], this._materialShaderData, null, shaderResource, textureExitsMask);
                        Laya.coverCahceFlag(this._matBindGroupLayoutFlag, this._pipelineChangeFlag);
                    }
                }
                else {
                    info.matBindGroup = Laya.WebGPUBindGroupCache.emptyBindGroup;
                }
                command.setBindGroup(3, info.matBindGroup);
            }
        }
        _render(context, command) {
            if (!this.isRender) {
                return 0;
            }
            if (this._drawCacheArray && this._drawCacheArray.length == 0)
                return 0;
            for (let j = 0, m = this._drawCacheArray.length; j < m; j++) {
                let drawInfo = this._drawCacheArray[j];
                let shaderInstance = drawInfo.shaderInstance;
                if (!shaderInstance.complete)
                    return 0;
                this._bindGroup(context, drawInfo, command);
                let pipelineCache = drawInfo.pipeLineCacheFlag;
                if (drawInfo.shaderChange ||
                    Laya.compareCahceFlag(context._pipelineChange, pipelineCache) ||
                    Laya.compareCahceFlag(this._pipelineChangeFlag, pipelineCache)) {
                    this._bindGroupMap.clear();
                    this._bindGroupMap.set(0, context._sceneBindGroup);
                    this._bindGroupMap.set(1, context._cameraBindGroup);
                    this._bindGroupMap.set(2, drawInfo.nodeBindGroup);
                    this._bindGroupMap.set(3, drawInfo.matBindGroup);
                    drawInfo.shaderChange = false;
                    drawInfo.pipeline = this._getWebGPURenderPipeline(drawInfo.shaderInstance, context.destRT, context);
                    drawInfo.pipeLineCacheFlag.setValue(Laya.Stat.loopCount, Laya.WebGPURenderEngine._instance._framePassCount);
                }
                command.setPipeline(drawInfo.pipeline);
                if (!command.isBundle && this.depthStencilParam.stencilEnable) {
                    command.setStencilReference(this.depthStencilParam.stencilRef);
                }
                {
                    let bindgroup = drawInfo.nodeBindGroup;
                    for (let i = 0; i < this.skinnedData.length; i++) {
                        dynamicOffsetsData[0] = i * this._skinnedBufferOffsetAlignment;
                        command.setBindGroupByDataOffaset(2, bindgroup, dynamicOffsetsData, 0, 1);
                        this._uploadGeometryIndex(command, i);
                    }
                }
            }
            return 1;
        }
        destroy() {
            var _a;
            super.destroy();
            (_a = this.skinnedBuffer) === null || _a === void 0 ? void 0 : _a.destroy();
            this.skinnedBuffer = null;
            this._bonesUniform = null;
            this.skinnedData = null;
        }
    }

    WebBaseRenderNode.BaseRenderNodeClass = WebGPUBaseRenderNode;
    class WebGPU3DRenderPassFactory {
        createMeshRenderBatchModule() {
            (!WebGPUMeshBathShaderInit.inited) && WebGPUMeshBathShaderInit.init();
            return new WebGPUMeshRenderBatchAgent();
        }
        createSimpleSkinRenderBatchModule() {
            (!WebGPUMeshBathShaderInit.inited) && WebGPUMeshBathShaderInit.init();
            return new WebGPUMeshRenderBatchAgent(Laya.BaseRenderType.SimpleSkinRender);
        }
        createRender3DProcess() {
            let renderPass = new WebRender3DProcess();
            let forwardRP = renderPass._renderPass = new WebForwardAddRP();
            forwardRP.mainRenderpass = new WebForwardAddClusterRP();
            forwardRP.dirShadowRenderPass = new WebDirCascadeShadowRP();
            forwardRP.spotShadowRenderPass = new WebBaseSpotRP();
            return renderPass;
        }
        createRenderContext3D() {
            return new WebGPURenderContext3D();
        }
        createRenderElement3D() {
            return new WebGPURenderElement3D();
        }
        createSkinRenderElement() {
            return new WebGPUSkinRenderElement3D();
        }
        createSceneRenderManager() {
            return new WebSceneRenderManager();
        }
        createDrawNodeCMDData() {
            return new WebGPUDrawNodeCMDData();
        }
        createBlitQuadCMDData() {
            return new WebGPUBlitQuadCMDData();
        }
        createDrawElementCMDData() {
            return new WebGPUDrawElementCMDData();
        }
        createSetViewportCMD() {
            return new WebGPUSetViewportCMD();
        }
        createSetRenderTargetCMD() {
            return new WebGPUSetRenderTargetCMD();
        }
        createSetRenderDataCMD() {
            return new Laya.WebGPUSetRenderData();
        }
        createSetShaderDefineCMD() {
            return new Laya.WebGPUSetShaderDefine();
        }
        createComputeCommandAppatchCMD() {
            return new Laya.WebGPUComputeCommandAppatchCMD();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.Laya3DRender.Render3DPassFactory) {
            Laya.Laya3DRender.Render3DPassFactory = new WebGPU3DRenderPassFactory();
            Laya.LayaGL.statAgent = new Laya.DefaultStaticsContext();
        }
    });
    Laya.Laya.addAfterInitCallback(() => {
        Laya.Laya3DRender.Render3DModuleDataFactory.createBaseRenderNode = () => {
            return new WebGPUBaseRenderNode();
        };
    });

    class WebGPUShaderDefine {
        static findNumberDefine(code, map) {
            const pattern = /^\s*#define\s+(\w+)\s+([1-9]\d*)(?=\s*($|\/\/))/gm;
            if (!map)
                map = new Map();
            let match;
            while ((match = pattern.exec(code)) !== null) {
                map.set(match[1], match[2]);
            }
            return map;
        }
    }

    class WebGPUShaderCompileUtil {
        static checkDef(node, _defs) {
            if (null == _defs)
                return;
            let arr = node.defParam;
            if (arr) {
                for (let i = 0, len = arr.length; i < len; i++) {
                    let str = arr[i];
                    if ("#ifdef" == node.name || '#ifndef' == node.name) {
                        _defs.add(str);
                    }
                    else {
                        while (true) {
                            let ofs = str.indexOf("defined");
                            if (0 <= ofs) {
                                ofs = str.indexOf("(");
                                if (0 < ofs) {
                                    let ofs2 = str.indexOf(")");
                                    _defs.add(str.substring(ofs + 1, ofs2).trim());
                                    str = str.substring(ofs2 + 1);
                                }
                                else {
                                    break;
                                }
                            }
                            else {
                                break;
                            }
                        }
                    }
                }
            }
        }
        static extractMacros(code) {
            const regex = /^\s*#\s*define\s+/;
            const lines = code.split('\n');
            const macros = [];
            let currentMacro = '';
            for (let i = 0, len = lines.length; i < len; i++) {
                const line = lines[i].trim();
                if (line.length === 0)
                    continue;
                if (currentMacro.length > 0 || regex.test(line)) {
                    if (line.endsWith('\\')) {
                        currentMacro += line.slice(0, -1) + ' ';
                    }
                    else {
                        currentMacro += line;
                        macros.push(new Laya.WebGPU_GLSLMacro(currentMacro));
                        currentMacro = '';
                    }
                }
            }
            return macros;
        }
        static macrosToVariable(macros) {
            const regex = /^([_a-zA-Z][_a-zA-Z0-9]*)$/;
            const variable = new Set();
            for (let i = macros.length - 1; i > -1; i--) {
                let name = macros[i].replace;
                if (name) {
                    const ofs = name.indexOf('.');
                    if (ofs >= 0) {
                        name = name.substring(0, ofs).trim();
                        if (name.match(regex))
                            variable.add(name);
                    }
                    else if (name.match(regex))
                        variable.add(name);
                }
            }
            return variable;
        }
        static toScript(root, def, outData) {
            if (null == def)
                def = {};
            let out = this._parseChilds(root, def);
            const macros = this.extractMacros(out);
            const mvariable = this.macrosToVariable(macros);
            if (outData) {
                let st = WebGPUShaderCompileCode.compile(out);
                let uniform = st.uniform;
                let varying = st.varying;
                let attribute = st.attribute;
                let variable = st.variable;
                if (variable) {
                    if (uniform) {
                        for (let k in uniform) {
                            if (variable.has(k) || mvariable.has(k)) {
                                if (null == outData.uniform)
                                    outData.uniform = {};
                                outData.uniform[k] = uniform[k];
                            }
                        }
                    }
                    if (varying) {
                        for (let k in varying) {
                            if (variable.has(k) || mvariable.has(k)) {
                                if (null == outData.varying)
                                    outData.varying = {};
                                outData.varying[k] = varying[k];
                            }
                        }
                    }
                    if (attribute) {
                        for (let k in attribute) {
                            if (variable.has(k) || mvariable.has(k)) {
                                if (null == outData.attribute)
                                    outData.attribute = {};
                                outData.attribute[k] = attribute[k];
                            }
                        }
                    }
                }
                outData.variable = variable;
            }
            out = this.removeUniform(out);
            out = this.removeVarying(out);
            return out;
        }
        static removeUniform(code) {
            let arr = code.split("\n");
            let isParentRemove = false;
            let isUniformStruct = false;
            let isModify = false;
            for (let i = 0, len = arr.length; i < len; i++) {
                let cstr = arr[i].trim();
                if ('' == cstr) {
                    arr.splice(i, 1);
                    len -= 1;
                    i -= 1;
                }
                else if (0 == cstr.indexOf("uniform ")) {
                    isParentRemove = true;
                    arr.splice(i, 1);
                    len -= 1;
                    i -= 1;
                    isModify = true;
                    if (0 < cstr.indexOf("{")) {
                        isUniformStruct = true;
                    }
                }
                else {
                    if (isParentRemove && !isUniformStruct) {
                        if (0 == cstr.indexOf("{")) {
                            isUniformStruct = true;
                            arr.splice(i, 1);
                            len -= 1;
                            i -= 1;
                        }
                    }
                    else if (isUniformStruct) {
                        if (0 <= cstr.indexOf("}")) {
                            isUniformStruct = false;
                        }
                        arr.splice(i, 1);
                        len -= 1;
                        i -= 1;
                    }
                    isParentRemove = false;
                }
            }
            if (isModify)
                code = arr.join('\n');
            return code;
        }
        static removeVarying(code) {
            let arr = code.split("\n");
            let isModify = false;
            for (let i = 0, len = arr.length; i < len; i++) {
                let cstr = arr[i].trim();
                if ('' == cstr) {
                    arr.splice(i, 1);
                    len -= 1;
                    i -= 1;
                }
                else if (0 == cstr.indexOf("varying ")) {
                    arr.splice(i, 1);
                    len -= 1;
                    i -= 1;
                    isModify = true;
                }
            }
            if (isModify)
                code = arr.join('\n');
            return code;
        }
        static checkCondition(st, def) {
            let childs = st.childs;
            let ret = false;
            if (null == childs) {
                return ret;
            }
            for (let i = 0, len = childs.length; i < len; i++) {
                let o = childs[i];
                if (exports.enumOperator["&&"] == o.operator) {
                    if (!ret) {
                        continue;
                    }
                }
                else if (exports.enumOperator["||"] == o.operator) {
                    if (ret) {
                        continue;
                    }
                }
                if ('defined' == o.name) {
                    try {
                        let defName = o.parameter.childs[0].name;
                        let b = !!def[defName];
                        if (o.operator == exports.enumOperator["!"])
                            b = !b;
                        ret = b;
                    }
                    catch (err) { }
                }
                else {
                    if (null != o.name || null == o.operator || null != o.parameter) {
                        if (('' == o.name || null == o.name) && null != o.parameter) {
                            ret = this.checkCondition(o.parameter, def);
                        }
                        else {
                            console.log("TODO:待处理判断", o);
                        }
                    }
                }
            }
            return ret;
        }
        static _parseChilds(parent, def) {
            let childs = parent.childs;
            let checkConditionType = 0;
            let out = '';
            if (null == childs)
                return out;
            for (let i = 0, len = childs.length; i < len; i++) {
                let t = childs[i];
                if ("#ifdef" == t.name || "#ifndef" == t.name || "#if" == t.name || "#elif" == t.name || "#else" == t.name) {
                    if (1 == checkConditionType && ("#elif" == t.name || "#else" == t.name)) {
                        continue;
                    }
                    if (t.condition(def)) {
                        if ("#else" != t.name) {
                            checkConditionType = 1;
                        }
                        else {
                            checkConditionType = 0;
                        }
                        out += this._parseChilds(t, def);
                    }
                    else {
                        checkConditionType = 0;
                    }
                }
                else if (null != t.defParam) {
                    if ('#define' == t.name) {
                        if (Array.isArray(t.defParam)) {
                            let arr = t.defParam;
                            if (1 == arr.length) {
                                def[arr[0]] = true;
                            }
                        }
                        else {
                            console.log('TODO');
                        }
                    }
                    else if ('#undefine' == t.name) {
                        if (Array.isArray(t.defParam)) {
                            let arr = t.defParam;
                            if (1 == arr.length) {
                                delete def[arr[0]];
                            }
                        }
                        else {
                            console.log('TODO');
                        }
                    }
                    if (t.code)
                        out += t.code + "\n";
                }
                else {
                    if (t.code && null == t.root) {
                        out += t.code + "\n";
                    }
                }
            }
            return out;
        }
    }

    class WebGPUShaderToken {
        constructor(includefiles) {
            this.z = 0;
            if (includefiles) {
                this.includefiles = includefiles;
            }
            else {
                this.includefiles = [];
            }
        }
        condition(def) {
            if ('#else' == this.name)
                return true;
            if (null != def) {
                if ("#ifdef" == this.name || "#ifndef" == this.name) {
                    try {
                        let check = this.defParam[0];
                        return ("#ifdef" == this.name) == !!def[check];
                    }
                    catch (err) { }
                }
                else {
                    if (!(this.defParam instanceof WebGPUShaderToken)) {
                        let defParm = this.defParam.join(" ");
                        let parmRoot = WebGPUShaderCompileCode.compile(defParm);
                        this.defParam = parmRoot;
                    }
                    return WebGPUShaderCompileUtil.checkCondition(this.defParam, def);
                }
            }
            else if ("#ifndef" == this.name) {
                return true;
            }
            return false;
        }
        addParameterArr(param, parent) {
            if (null == this.parameterArr) {
                this.parameterArr = [];
            }
            this.parameterArr.push(param);
            param.owner = this;
            if (parent) {
                param.parent = parent;
            }
        }
        setParameter(param, parent) {
            this.parameter = param;
            param.owner = this;
            if (parent)
                param.parent = parent;
        }
        addBody(body) {
            body.setParent(this);
        }
        setParent(parent) {
            if (null == parent.childs) {
                parent.childs = [];
            }
            parent.childs.push(this);
            this.z = parent.z + 1;
            this.parent = parent;
        }
        _parseShaderNode(sn) {
            let ret = '';
            let operator = null;
            if (null != sn.operator) {
                operator = exports.enumOperator[sn.operator];
                if (!sn.operatorRight) {
                    ret += operator;
                    operator = null;
                }
            }
            if (sn.type) {
                if (null != sn.describe) {
                    ret += exports.enumDescribe[sn.describe] + " ";
                }
                if (null != sn.inOrOut) {
                    ret += exports.enumInOut[sn.inOrOut] + " ";
                }
                if (null != sn.type) {
                    ret += sn.type + " ";
                }
                if (null != sn.name) {
                    ret += sn.name;
                }
                if (null != sn.parameter) {
                    let childs = sn.parameter.childs;
                    if (childs) {
                        ret += '(';
                        for (let i = 0, len = childs.length; i < len; i++) {
                            ret += this._parseShaderNode(childs[i]);
                        }
                        ret += ')';
                    }
                }
            }
            else if (sn.parameter) {
                if (null != sn.name) {
                    ret += sn.name;
                }
                if (null != operator) {
                    ret += operator;
                    operator = null;
                }
                ret += '(' + this._getParameter(sn.parameter) + ")";
            }
            else if (sn.parameterArr) {
                ret += this._getParameterArr(sn, '');
            }
            else if (sn.name) {
                ret += sn.name;
            }
            if (null != operator) {
                ret += operator;
            }
            if (null != sn.childs) {
                for (let i = 0, len = sn.childs.length; i < len; i++) {
                    ret += this._parseShaderNode(sn.childs[i]);
                }
            }
            return ret;
        }
        _getParameter(param, isFor = false) {
            let ret = '';
            if (null == param) {
                param = this.parameter;
            }
            if (param) {
                if (param.childs) {
                    let arr = param.childs;
                    for (let i = 0, len = arr.length; i < len; i++) {
                        let sn = arr[i];
                        ret += this._parseShaderNode(sn);
                        if (isFor && i < len - 1) {
                            ret += ';';
                        }
                    }
                }
                else {
                    ret += this._parseShaderNode(param);
                }
            }
            return ret;
        }
        _getParameterArr(st, end = ';') {
            let outStr = '';
            if (null != st.type) {
                outStr += st.type + " ";
            }
            let operator;
            if (null != st.operator && '' != end) {
                operator = exports.enumOperator[st.operator];
                if (!st.operatorRight) {
                    outStr += operator;
                    operator = null;
                }
            }
            let arr = st.parameterArr;
            if (null != st.name) {
                outStr += st.name;
            }
            for (let i = 0, len = arr.length; i < len; i++) {
                outStr += "[" + st._getParameter(arr[i]) + "]";
            }
            if (null != operator) {
                outStr += operator;
            }
            if (st.assign) {
                if (null != st.assignLeft) {
                    outStr += exports.enumOperator[st.assignLeft];
                }
                outStr += "=";
            }
            if (st.childs) {
                outStr += st._getParameter(st);
            }
            return outStr + end;
        }
        toscript(def, out) {
            if (null == out) {
                out = [];
            }
            if (this.type) {
                if ("return" == this.type) {
                    let outStr = this.type + " ";
                    if (this.name) {
                        outStr += this.name;
                    }
                    if (this.parameter) {
                        outStr += "(" + this._getParameter() + ")";
                    }
                    if (null != this.childs) {
                        outStr += this._getParameter(this);
                    }
                    outStr += ";";
                    out.push(outStr);
                }
                else if (this.parameter) {
                    let outStr = this.type + " " + this.name + "(" + this._getParameter() + "){";
                    if (null != this.describe) {
                        outStr = exports.enumDescribe[this.describe] + " " + outStr;
                    }
                    out.push(outStr);
                    if (this.childs) {
                        for (let i = 0, len = this.childs.length; i < len; i++) {
                            this.childs[i].toscript(def, out);
                        }
                    }
                    out.push('}');
                }
                else if (this.parameterArr) {
                    out.push(this._getParameterArr(this));
                }
                else if (this.assign) {
                    let outStr = this.type + " " + this.name;
                    if (null != this.assignLeft) {
                        outStr += exports.enumOperator[this.assignLeft];
                    }
                    outStr += '=';
                    if (this.childs) {
                        outStr += this._getParameter(this);
                        outStr += ';';
                        out.push(outStr);
                    }
                    else {
                        console.log("理论上不存在这种情况！");
                    }
                }
                else if (null != this.name) {
                    let outStr = '';
                    if (null != this.describe) {
                        outStr += exports.enumDescribe[this.describe] + " ";
                    }
                    outStr += this.type + " " + this.name;
                    if (null != this.operator) {
                        outStr += exports.enumOperator[this.operator];
                    }
                    if ('struct' == this.type) {
                        outStr += '{';
                        out.push(outStr);
                        outStr = '';
                        if (null != this.childs) {
                            let arr = this.childs;
                            for (let i = 0, len = arr.length; i < len; i++) {
                                let sn = arr[i];
                                let outStr = this._parseShaderNode(sn);
                                if ('' != outStr) {
                                    out.push(outStr + ";");
                                }
                            }
                        }
                        outStr += '}';
                        if (this.varNames) {
                            outStr += " " + this.varNames.join(",");
                        }
                    }
                    else {
                        if (null != this.childs)
                            outStr += this._getParameter(this);
                    }
                    outStr += ';';
                    out.push(outStr);
                }
                else {
                    out.push(this.type + ";");
                }
            }
            else if (this.parameterArr) {
                out.push(this._getParameterArr(this));
            }
            else if (this.parameter) {
                if (null != this.name) {
                    let outStr = '';
                    if (null != this.operator) {
                        outStr += exports.enumOperator[this.operator];
                    }
                    outStr += this.name + "(" + this._getParameter(null, 'for' == this.name) + ")";
                    if ("layout" == this.name) {
                        if (this.childs) {
                            for (let i = 0, len = this.childs.length; i < len; i++) {
                                let sn = this.childs[i];
                                if (sn.describe == exports.enumDescribe.uniform) {
                                    outStr += ' uniform';
                                }
                                else {
                                    console.log("TODO待处理:", sn);
                                }
                            }
                        }
                        outStr += ';';
                        out.push(outStr);
                    }
                    else {
                        out.push(outStr);
                        if (this.childs) {
                            out.push("{");
                            for (let i = 0, len = this.childs.length; i < len; i++) {
                                let sn = this.childs[i];
                                sn.toscript(def, out);
                            }
                            out.push("}");
                        }
                    }
                }
            }
            else if (this.name) {
                if (this.describe == exports.enumDescribe.uniform) {
                    out.push("uniform " + this.name + "{");
                    for (let i = 0, len = this.childs.length; i < len; i++) {
                        let sn = this.childs[i];
                        sn.toscript(def, out);
                    }
                    let outstr = '}';
                    if (this.varNames) {
                        outstr += " " + this.varNames.join(",");
                    }
                    outstr += ';';
                    out.push(outstr);
                }
                else if (this.assign) {
                    let outStr = this.name;
                    if (null != this.assignLeft) {
                        outStr += exports.enumOperator[this.assignLeft];
                    }
                    outStr += '=';
                    if (this.childs) {
                        outStr += this._getParameter(this);
                        outStr += ';';
                        out.push(outStr);
                    }
                    else {
                        console.log("理论上不存在这种情况！");
                    }
                }
                else {
                    if (this.childs) {
                        out.push(this.name + "{");
                        for (let i = 0, len = this.childs.length; i < len; i++) {
                            let sn = this.childs[i];
                            sn.toscript(def, out);
                        }
                        out.push("}");
                    }
                    else {
                        if (0 > this.name.indexOf("#")) {
                            out.push(this.name + ";");
                        }
                        else {
                            out.push(this.name);
                        }
                    }
                }
            }
            else if (null != this.operator) ;
            else if (this.childs) {
                if (null != this.parent) {
                    out.push("{");
                    for (let i = 0, len = this.childs.length; i < len; i++) {
                        let sn = this.childs[i];
                        sn.toscript(def, out);
                    }
                    out.push("}");
                }
                else {
                    for (let i = 0, len = this.childs.length; i < len; i++) {
                        let sn = this.childs[i];
                        sn.toscript(def, out);
                    }
                }
            }
            else ;
            return out;
        }
    }

    exports.enumInOut = void 0;
    (function (enumInOut) {
        enumInOut[enumInOut["in"] = 0] = "in";
        enumInOut[enumInOut["out"] = 1] = "out";
        enumInOut[enumInOut["inout"] = 2] = "inout";
    })(exports.enumInOut || (exports.enumInOut = {}));
    exports.enumDescribe = void 0;
    (function (enumDescribe) {
        enumDescribe[enumDescribe["uniform"] = 0] = "uniform";
        enumDescribe[enumDescribe["varying"] = 1] = "varying";
        enumDescribe[enumDescribe["const"] = 2] = "const";
        enumDescribe[enumDescribe["mediump"] = 3] = "mediump";
        enumDescribe[enumDescribe["highp"] = 4] = "highp";
        enumDescribe[enumDescribe["lowp"] = 5] = "lowp";
        enumDescribe[enumDescribe["attribute"] = 6] = "attribute";
    })(exports.enumDescribe || (exports.enumDescribe = {}));
    exports.enumOperator = void 0;
    (function (enumOperator) {
        enumOperator[enumOperator["!="] = 0] = "!=";
        enumOperator[enumOperator["=="] = 1] = "==";
        enumOperator[enumOperator["<="] = 2] = "<=";
        enumOperator[enumOperator[">="] = 3] = ">=";
        enumOperator[enumOperator["||"] = 4] = "||";
        enumOperator[enumOperator["&&"] = 5] = "&&";
        enumOperator[enumOperator[">>"] = 6] = ">>";
        enumOperator[enumOperator["<<"] = 7] = "<<";
        enumOperator[enumOperator["++"] = 8] = "++";
        enumOperator[enumOperator["^^"] = 9] = "^^";
        enumOperator[enumOperator["--"] = 10] = "--";
        enumOperator[enumOperator["!"] = 11] = "!";
        enumOperator[enumOperator["+"] = 12] = "+";
        enumOperator[enumOperator["-"] = 13] = "-";
        enumOperator[enumOperator["*"] = 14] = "*";
        enumOperator[enumOperator["/"] = 15] = "/";
        enumOperator[enumOperator["="] = 16] = "=";
        enumOperator[enumOperator["<"] = 17] = "<";
        enumOperator[enumOperator[">"] = 18] = ">";
        enumOperator[enumOperator["&"] = 19] = "&";
        enumOperator[enumOperator["|"] = 20] = "|";
        enumOperator[enumOperator["^"] = 21] = "^";
        enumOperator[enumOperator["%"] = 22] = "%";
    })(exports.enumOperator || (exports.enumOperator = {}));
    const boolCheck = ['<=', '>=', '!=', '==', "&&", "||", '>', '<', '!'];
    const checkBodyName = ['if', 'for', 'while', 'layout'];
    const _clearCR = new RegExp("\r", "g");
    class WebGPUShaderCompileCode {
        static compile(code) {
            let ret = new WebGPUShaderToken();
            code = code.replace(_clearCR, "");
            code = this.removeAnnotation(code).trim();
            this._define.clear();
            WebGPUShaderDefine.findNumberDefine(code, this._define);
            this._compileToTree(ret, code);
            this._parameterNode = null;
            this._parentNode = null;
            this._currNode = null;
            this._currNameNode = null;
            this._currParame = null;
            this._isCheckType = false;
            this._currTmpBody = null;
            ret.uniform = this._uniform;
            ret.variable = this._variable;
            ret.structs = this._struct;
            ret.varying = this._varying;
            ret.attribute = this._attribute;
            if (this._struct) {
                if (this._uniform) {
                    for (let k in this._uniform) {
                        if (this._struct[this._uniform[k].type]) {
                            this._uniform[k].struct = this._struct[this._uniform[k].type];
                        }
                    }
                }
                if (this._varying) {
                    for (let k in this._varying) {
                        if (this._struct[this._varying[k].type]) {
                            this._varying[k].struct = this._struct[this._varying[k].type];
                        }
                    }
                }
                if (this._attribute) {
                    for (let k in this._attribute) {
                        if (this._struct[this._attribute[k].type]) {
                            this._attribute[k].struct = this._struct[this._attribute[k].type];
                        }
                    }
                }
            }
            this._uniform = null;
            this._variable = null;
            this._struct = null;
            this._varying = null;
            this._attribute = null;
            this._varUniform = null;
            return ret;
        }
        static get _currNode() {
            return this.__currNode;
        }
        static set _currNode(value) {
            if (value == this.__currNode)
                return;
            if (null != this.__currNode) {
                if (null != this.__currNode.name && (null == this.__currNode.type || 'return' == this.__currNode.type)) {
                    if (null == this.__currNode.parameter && this.__currNode.describe != exports.enumDescribe.uniform) {
                        let name = this.__currNode.name;
                        if ('' != name && isNaN(Number(name))) {
                            let ofs = name.indexOf(".");
                            if (0 <= ofs) {
                                name = name.substring(0, ofs).trim();
                                if (this._varUniform && this._varUniform[name]) {
                                    name = this.__currNode.name.substring(ofs + 1).trim();
                                }
                            }
                            if ('' != name) {
                                if (null == this._variable)
                                    this._variable = new Set();
                                this._variable.add(name);
                            }
                        }
                    }
                }
            }
            this.__currNode = value;
        }
        static get isCheckType() {
            return this._isCheckType;
        }
        static set isCheckType(value) {
            if (value != this._isCheckType) {
                if (null == this._parameterNode && value) {
                    if (this._parentNode.assign) {
                        this._parentNode = this._parentNode.parent;
                    }
                    if ('return' == this._parentNode.type) {
                        this._parentNode = this._parentNode.parent;
                    }
                }
                this._isCheckType = value;
            }
        }
        static get currNode() {
            if (null == this._currNode) {
                if (null == this._parentNode) {
                    console.log("异常啦！！！");
                }
                this._currNode = new WebGPUShaderToken(this._parentNode.includefiles);
                if (this._parameterNode) {
                    this._currNode.owner = this._parameterNode.owner;
                    this._parameterNode.addBody(this._currNode);
                }
                else {
                    this._parentNode.addBody(this._currNode);
                }
            }
            return this._currNode;
        }
        static updateCurrNode() {
            if (this._parameterNode) {
                if (this._parameterNode.childs) {
                    this._currNode = this._parameterNode.childs[this._parameterNode.childs.length - 1];
                }
                else
                    this._currNode = null;
            }
            else {
                if (this._parentNode.childs) {
                    this._currNode = this._parentNode.childs[this._parentNode.childs.length - 1];
                }
                else {
                    console.log("这里应该有点问题！");
                    this._currNode = null;
                }
            }
        }
        static newParameterNode(parameterType = 0) {
            let sn = new WebGPUShaderToken(this._parentNode.includefiles);
            if (null == this._currNameNode) {
                if (1 == parameterType) {
                    let childs = this._parentNode.childs;
                    let pNode = childs[childs.length - 1];
                    if (pNode.parameterArr) {
                        this._currNameNode = pNode;
                    }
                }
                if (null == this._currNameNode) {
                    this._currNameNode = this.nextCurrNode(true);
                    this._currNameNode.name = '';
                }
            }
            if (1 == parameterType) {
                this._currNameNode.addParameterArr(sn, this._parameterNode);
            }
            else {
                this._currNameNode.setParameter(sn, this._parameterNode);
            }
            this._currNameNode = null;
            this._parameterNode = sn;
            this.updateCurrNode();
        }
        static isEmptyNode(node, isCheckParent = false) {
            for (let name in node) {
                if ('includefiles' == name || 'owner' == name || 'z' == name) {
                    continue;
                }
                if (isCheckParent && 'parent' == name) {
                    continue;
                }
                return false;
            }
            return true;
        }
        static nextCurrNode(isForceCreate = false) {
            if (isForceCreate) {
                this._currNode = null;
                return this.currNode;
            }
            else {
                if (null != this._currNode) {
                    if (this.isEmptyNode(this._currNode)) {
                        return null;
                    }
                    this._currNode = null;
                }
                return null;
            }
        }
        static _compileToTree(root, script) {
            let lines = script.split(";");
            this._parentNode = root;
            for (let i = 0, len = lines.length; i < len; i++) {
                let text = lines[i].trim();
                if (text.length < 1)
                    continue;
                this._parseNode(text);
                this._checkStructDef();
                if (null != this._currParame) {
                    this._parseParameter();
                }
                this._body3Fin();
            }
        }
        static _checkStructDef() {
            let childs = this._parentNode.childs;
            if (childs) {
                let len = childs.length;
                if (2 <= len) {
                    let index = len - 1;
                    let o1 = childs[index];
                    let o2 = childs[len - 2];
                    if (('struct' == o2.type || (o2.describe == exports.enumDescribe.uniform && o2.childs)) && null == o1.name && null != o1.type) {
                        let arr = o1.type.split(',');
                        o2.varNames = arr;
                        childs.splice(index, 1);
                        if (o2.describe == exports.enumDescribe.uniform) {
                            if (null == this._varUniform)
                                this._varUniform = {};
                            for (let i = arr.length - 1; i >= 0; i--) {
                                this._varUniform[arr[i]] = o2.name;
                            }
                        }
                    }
                }
            }
        }
        static _checkTypeByString(text) {
            let sn = this.nextCurrNode(true);
            this.isCheckType = true;
            let arr = text.split(" ");
            for (let i = 0, len = arr.length; i < len; i++) {
                if (this.isCheckType) {
                    this._checkType(arr[i]);
                }
                else {
                    sn.name = arr[i];
                }
            }
            this.isCheckType = false;
        }
        static get _isFor() {
            if (this._parameterNode) {
                let node = this._parameterNode.owner;
                if ("for" == node.name) {
                    return true;
                }
            }
            return false;
        }
        static _parseParameter() {
            if (null != this._currParame) {
                let node = this._parameterNode.owner;
                if (this._isFor) {
                    let _parentNode = this._parentNode;
                    let _parameterNode = this._parameterNode;
                    if (null == _parameterNode.childs || 0 == _parameterNode.childs.length) {
                        this.isCheckType = true;
                    }
                    let sn = this.nextCurrNode(true);
                    this._parameterNode = null;
                    this._parentNode = sn;
                    this._currNode = null;
                    let arr = this._currParame.split(" ");
                    for (let i = 0, len = arr.length; i < len; i++) {
                        this._checkBody(arr[i]);
                    }
                    this._parameterNode = _parameterNode;
                    this._parentNode = _parentNode;
                }
                else {
                    let isFun = false;
                    if (null != node.type && 'return' != node.type && 'else' != node.type)
                        isFun = true;
                    let arr = this._currParame.split(',');
                    for (let i = 0, len = arr.length; i < len; i++) {
                        let str = arr[i];
                        if (isFun) {
                            this._checkTypeByString(str);
                        }
                        else {
                            this._checkBody2(str, false);
                        }
                        if (i < len - 1) {
                            let sn = this.nextCurrNode(true);
                            sn.type = ',';
                            this._currNode = null;
                        }
                    }
                }
            }
            this._currParame = null;
        }
        static _addParam(text) {
            if (null == this._currParame) {
                this._currParame = text;
            }
            else {
                this._currParame += ' ' + text;
            }
        }
        static _checkParameter(text) {
            text = text.trim();
            if ('' == text) {
                if (this._isFor)
                    this._addParam(text);
                return;
            }
            if (this.isCheckType) {
                this._checkType(text);
                return;
            }
            let ofs = text.indexOf("(");
            if (0 <= ofs) {
                this._checkParameter(text.substring(0, ofs));
                this._parseParameter();
                this.newParameterNode();
                text = text.substring(ofs + 1);
                this._checkParameter(text);
            }
            else {
                let ofs = text.indexOf("[");
                if (0 <= ofs) {
                    this._checkParameter(text.substring(0, ofs));
                    this._parseParameter();
                    this.newParameterNode(1);
                    text = text.substring(ofs + 1);
                    this._checkParameter(text);
                }
                else {
                    ofs = text.indexOf(")");
                    if (0 > ofs) {
                        ofs = text.indexOf("]");
                    }
                    if (0 <= ofs) {
                        this._checkParameter(text.substring(0, ofs));
                        this._parseParameter();
                        let owner = this._parameterNode.owner;
                        if (owner) {
                            let obj = null;
                            if (owner.describe == exports.enumDescribe.uniform) {
                                obj = this._uniform;
                            }
                            else if (owner.describe == exports.enumDescribe.attribute) {
                                obj = this._attribute;
                            }
                            else if (owner.describe == exports.enumDescribe.varying) {
                                obj = this._varying;
                            }
                            if (null != obj) {
                                try {
                                    let str = this._parameterNode.childs[0].type;
                                    if (this._define.has(str))
                                        str = this._define.get(str);
                                    const num = Number(str);
                                    if (!isNaN(num) && obj[owner.name]) {
                                        if (null == obj[owner.name].length)
                                            obj[owner.name].length = [];
                                        obj[owner.name].length.push(num);
                                    }
                                }
                                catch (err) { }
                            }
                        }
                        this._parameterNode = this._parameterNode.parent;
                        this.updateCurrNode();
                        text = text.substring(ofs + 1);
                        this._currNameNode = null;
                        if (this.currNode && null != this.currNode.parameter && null == this._parameterNode && 0 <= checkBodyName.indexOf(this.currNode.name)) {
                            this._isCheckBody3 = true;
                        }
                        this._checkBody(text);
                    }
                    else {
                        this._addParam(text);
                    }
                }
            }
        }
        static _body3Fin() {
            let arr = this._currTmpBody;
            this._currTmpBody = null;
            this._isCheckBody3 = false;
            if (arr) {
                if (this._currNode && 0 <= checkBodyName.indexOf(this._currNode.name)) {
                    this._parentNode = this._currNode;
                    this._currNode = null;
                }
                else if (this._parentNode && 0 <= checkBodyName.indexOf(this._parentNode.name)) {
                    this._currNode = null;
                }
                else {
                    console.log("理论上不应该进入这里，待查！");
                    this._currNode = null;
                    this._parentNode = this.currNode;
                    this._currNode = null;
                }
                this.isCheckType = true;
                for (let i = 0, len = arr.length; i < len; i++) {
                    this._checkBody(arr[i]);
                }
                this._parentNode = this._parentNode.parent;
                this.nextCurrNode();
                this.isCheckType = true;
            }
        }
        static _checkBody3(text) {
            if (this._isCheckBody3) {
                if (0 > text.indexOf("{")) {
                    if (null == this._currTmpBody) {
                        this._currTmpBody = [];
                    }
                    this._currTmpBody.push(text);
                    return true;
                }
                else if (null != this._currTmpBody) {
                    console.log("理论上不应该会走到这里，如果到这里，待检查！", this._currTmpBody);
                    this._isCheckBody3 = false;
                    let arr = this._currTmpBody;
                    this._currTmpBody = null;
                    for (let i = 0, len = arr.length; i < len; i++) {
                        this._checkBody(arr[i]);
                    }
                }
                else {
                    this._isCheckBody3 = false;
                }
            }
            return false;
        }
        static _checkBody(text) {
            text = text.trim();
            if ('' == text)
                return;
            if (this._checkBody3(text)) {
                return;
            }
            if (this.isCheckType) {
                this._checkType(text);
                return;
            }
            if (null != this._parameterNode) {
                this._checkParameter(text);
                return;
            }
            if (this._checkOperator(text))
                return;
            let ofs = text.indexOf("=");
            if (0 > ofs) {
                ofs = text.indexOf("(");
                if (0 > ofs) {
                    ofs = text.indexOf("[");
                    if (0 > ofs) {
                        ofs = text.indexOf("{");
                        if (0 <= ofs) {
                            let cstr = text.substring(0, ofs);
                            if ('' != cstr) {
                                this._setNodeName(cstr);
                            }
                            else if (null != this._currNode.type && null == this._currNode.name) {
                                this._currNode.name = this._currNode.type;
                                delete this._currNode.type;
                            }
                            this._parentNode = this.currNode;
                            text = text.substring(ofs + 1);
                            this.isCheckType = true;
                            this._currNode = null;
                            this._checkBody(text);
                        }
                        else {
                            ofs = text.indexOf("}");
                            if (0 <= ofs) {
                                this._childFin(ofs, text);
                            }
                            else {
                                ofs = text.indexOf(",");
                                if (0 <= ofs) {
                                    this._checkBody(text.substring(0, ofs));
                                    this.isCheckType = true;
                                    this.updateCurrNode();
                                    let typeNode = this._currNode;
                                    if (null == typeNode.type) {
                                        console.log("理论上不应该出现这个情况！", text);
                                    }
                                    else {
                                        let sn = this.nextCurrNode(true);
                                        sn.type = typeNode.type;
                                        if (null != typeNode.describe) {
                                            sn.describe = typeNode.describe;
                                        }
                                    }
                                    this.isCheckType = false;
                                    this._checkBody(text.substring(ofs + 1));
                                }
                                else {
                                    if (!this._splitTextCheck(text, "?")) {
                                        if (!this._splitTextCheck(text, ":")) {
                                            this._checkBody2(text);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    else {
                        let cstr = text.substring(0, ofs);
                        this._setNodeName(cstr);
                        this.newParameterNode(1);
                        this._checkParameter(text.substring(ofs + 1));
                    }
                }
                else {
                    let cstr = text.substring(0, ofs).trim();
                    if (null == this._currNode || null == this._currNode.name || '' != cstr) {
                        this._setNodeName(cstr);
                    }
                    else if (null != this._currNode && this._currNode.assign) {
                        this._setNodeName(cstr);
                    }
                    this.newParameterNode();
                    this._checkParameter(text.substring(ofs + 1));
                    return;
                }
            }
            else {
                this._checkEqual(text, ofs);
            }
        }
        static _splitTextCheck(text, cstr, fun) {
            if (null == fun)
                fun = this._checkBody;
            let ofs = text.indexOf(cstr);
            if (0 <= ofs) {
                fun.call(this, text.substring(0, ofs));
                let sn = this.nextCurrNode(true);
                sn.type = cstr;
                this._currNameNode = sn;
                this._currNode = null;
                fun.call(this, text.substring(ofs + cstr.length));
                return true;
            }
            return false;
        }
        static _childFin(ofs, text) {
            let cstr = text.substring(0, ofs);
            this._checkBody(cstr);
            if ("struct" == this._parentNode.type) {
                if (!this._struct)
                    this._struct = {};
                this._struct[this._parentNode.name] = this._parentNode;
            }
            let childs = this._parentNode.childs;
            if (childs) {
                for (let i = childs.length - 1; i >= 0; i--) {
                    let o = childs[i];
                    if (this.isEmptyNode(o, true)) {
                        childs.splice(i, 1);
                    }
                }
            }
            this._parentNode = this._parentNode.parent;
            this.nextCurrNode();
            text = text.substring(ofs + 1);
            this.isCheckType = true;
            if ('' != text) {
                this.nextCurrNode();
                this._checkBody(text);
            }
        }
        static _checkType(text) {
            if ('' == text)
                return;
            let node = this.currNode;
            let inout = exports.enumInOut[text];
            if (undefined != inout && isNaN(Number(text))) {
                node.inOrOut = inout;
            }
            else {
                let describe = exports.enumDescribe[text];
                if (undefined != describe && isNaN(Number(text))) {
                    node.describe = describe;
                }
                else {
                    let ofs = text.indexOf("}");
                    if (0 <= ofs) {
                        this._childFin(ofs, text);
                        return;
                    }
                    ofs = text.indexOf("(");
                    if (0 > ofs) {
                        ofs = text.indexOf("[");
                    }
                    if (0 <= ofs) {
                        this.isCheckType = false;
                        this._checkBody(text);
                    }
                    else {
                        ofs = text.indexOf("=");
                        if (0 <= ofs) {
                            this._checkEqual(text, ofs);
                        }
                        else {
                            ofs = text.indexOf("{");
                            if (0 <= ofs) {
                                this.isCheckType = false;
                                this._checkBody(text);
                            }
                            else {
                                node.type = text;
                                if ('return' == text) {
                                    this._parentNode = node;
                                    this.nextCurrNode();
                                }
                                this.isCheckType = false;
                            }
                        }
                    }
                }
            }
        }
        static _checkEqual(text, ofs) {
            this.isCheckType = false;
            if (0 == ofs) {
                let cstr = text.substring(0, 2);
                if (this._checkOperator(cstr)) {
                    this._checkBody(text.substring(2));
                    return;
                }
            }
            let cstr = text.substring(0, ofs);
            let len = cstr.length;
            if (0 < len) {
                let cstr2 = cstr.substring(len - 2);
                let operator = exports.enumOperator[cstr2];
                if (null != operator && isNaN(Number(cstr2))) {
                    cstr2 = cstr.substring(0, cstr.length - 2).trim();
                    if ('' != cstr2) {
                        this._setNodeName(cstr2);
                    }
                    this._checkOperator("=");
                    this.currNode.assignLeft = operator;
                    this._checkBody(text.substring(ofs + 1));
                    return;
                }
                cstr2 = cstr.substring(len - 1);
                let cstr3 = cstr2 + "=";
                operator = exports.enumOperator[cstr3];
                if (null != operator && isNaN(Number(cstr3))) {
                    this._checkBody(cstr.substring(0, cstr.length - 1).trim());
                    this._checkBody(cstr3);
                    this._checkBody(text.substring(ofs + 1));
                    return;
                }
                operator = exports.enumOperator[cstr2];
                if (null != operator && isNaN(Number(cstr2))) {
                    cstr2 = cstr.substring(0, cstr.length - 1).trim();
                    if ('' != cstr2) {
                        this._setNodeName(cstr2);
                    }
                    this._checkOperator("=");
                    this.currNode.assignLeft = operator;
                    this._checkBody(text.substring(ofs + 1));
                    return;
                }
            }
            this._setNodeName(cstr);
            cstr = text.substring(ofs, ofs + 2);
            if (this._checkOperator(cstr)) {
                ofs += 1;
            }
            else {
                this._checkOperator("=");
            }
            this._checkBody(text.substring(ofs + 1));
        }
        static _setNodeName(value) {
            value = value.trim();
            let node = this.currNode;
            if (null != node.name) {
                this._checkBody2(value, false);
                return;
            }
            if ('' == value && null != node.type) {
                this._checkBody2(node.type, false);
                delete node.type;
            }
            else {
                this._checkBody2(value);
            }
        }
        static _checkBody2(text, isCheckEmpty = true) {
            text = text.trim();
            if ('' == text && isCheckEmpty)
                return;
            let ofs;
            let pstr;
            if ('' != text) {
                for (let k in exports.enumOperator) {
                    if (isNaN(Number(k))) {
                        let num = text.indexOf(k);
                        if (0 <= num) {
                            if (null == ofs || ofs > num) {
                                ofs = num;
                                pstr = k;
                            }
                        }
                    }
                }
            }
            if (null != ofs) {
                this._checkBody2(text.substring(0, ofs));
                this._checkOperator(text.substring(ofs, ofs + pstr.length));
                this._checkBody2(text.substring(ofs + pstr.length));
            }
            else {
                if (!this._splitTextCheck(text, "?", this._checkBody2)) {
                    if (!this._splitTextCheck(text, ":", this._checkBody2)) {
                        let sn = this.currNode;
                        if (null != sn.name) {
                            sn = this.nextCurrNode(true);
                        }
                        sn.name = text;
                        this._currNameNode = sn;
                        if (this._parentNode) {
                            let obj = null;
                            if (this._parentNode.describe == exports.enumDescribe.uniform) {
                                if (null == this._uniform)
                                    this._uniform = {};
                                obj = this._uniform;
                            }
                            else if (this._parentNode.describe == exports.enumDescribe.varying) {
                                if (null == this._varying)
                                    this._varying = {};
                                obj = this._varying;
                            }
                            else if (this._parentNode.describe == exports.enumDescribe.attribute) {
                                if (null == this._attribute)
                                    this._attribute = {};
                                obj = this._attribute;
                            }
                            if (null != obj) {
                                obj[sn.name] = {
                                    type: sn.type,
                                    struct: this._parentNode,
                                    blockName: this._parentNode.name
                                };
                            }
                        }
                        if (sn.describe == exports.enumDescribe.uniform) {
                            if (null == this._uniform)
                                this._uniform = {};
                            this._uniform[sn.name] = { type: sn.type };
                        }
                        else if (sn.describe == exports.enumDescribe.attribute) {
                            if (null == this._attribute)
                                this._attribute = {};
                            this._attribute[sn.name] = { type: sn.type };
                        }
                        else if (sn.describe == exports.enumDescribe.varying) {
                            if (null == this._varying)
                                this._varying = {};
                            this._varying[sn.name] = { type: sn.type };
                        }
                    }
                }
            }
        }
        static _checkOperator(text) {
            let operator = exports.enumOperator[text];
            if (undefined != operator && isNaN(Number(text))) {
                let sn = this.currNode;
                if ('=' == text) {
                    sn.assign = true;
                    if (null == sn.name && null != sn.type) {
                        this._checkBody2(sn.type, false);
                        delete sn.type;
                    }
                    this._parentNode = sn;
                }
                else {
                    if (null != sn.name || null != sn.operator) {
                        sn = this.nextCurrNode(true);
                    }
                    sn.operator = operator;
                    this._currNameNode = sn;
                    if (null != sn.name) {
                        sn.operatorRight = true;
                    }
                }
                return true;
            }
            return false;
        }
        static _parseNode(text) {
            if ('' == text)
                return;
            let ofs = text.indexOf("#");
            if (0 > ofs) {
                text = text.split("\n").join(" ").split("\t").join(" ");
                if (0 == text.indexOf('precision')) {
                    let sn = new WebGPUShaderToken(this._parentNode.includefiles);
                    sn.name = text;
                    this._parentNode.addBody(sn);
                    return;
                }
                let arr = text.split(" ");
                if (!this._isFor)
                    this.isCheckType = true;
                this.nextCurrNode();
                for (let i = 0, len = arr.length; i < len; i++) {
                    text = arr[i];
                    if ('' == text)
                        continue;
                    this._checkBody(text);
                }
            }
            else {
                this._parseNode(text.substring(0, ofs));
                let def = text.substring(ofs);
                ofs = def.indexOf("\n");
                text = null;
                if (0 < ofs) {
                    text = def.substring(ofs + 1);
                    def = def.substring(0, ofs);
                }
                let sn = new WebGPUShaderToken(this._parentNode.includefiles);
                sn.name = def;
                this._parentNode.addBody(sn);
                if (null != text) {
                    this._parseNode(text);
                }
            }
        }
        static removeAnnotation(text) {
            while (true) {
                let i = text.indexOf("//");
                if (0 > i) {
                    break;
                }
                else {
                    let num = text.indexOf('\n', i);
                    if (0 < num) {
                        text = text.substring(0, i) + text.substring(num);
                    }
                    else {
                        text = text.substring(0, i);
                    }
                }
            }
            while (true) {
                let i = text.indexOf("/*");
                if (0 > i) {
                    break;
                }
                else {
                    let num = text.indexOf("*/", i);
                    if (0 < num) {
                        text = text.substring(0, i) + text.substring(num + 2);
                    }
                    else {
                        text = text.substring(0, i);
                    }
                }
            }
            return text;
        }
    }
    WebGPUShaderCompileCode._isCheckType = false;
    WebGPUShaderCompileCode._define = new Map();

    class WebGPUShaderCompileDef {
        static compile(code, defs) {
            code = code.replace(_clearCR, "");
            this._defs = defs;
            let st = new WebGPUShaderToken();
            this._compileToTree(st, code);
            this._parentNode = null;
            this._defs = null;
            this._currNode = null;
            return st;
        }
        static isEmptyNode(node) {
            for (let name in node) {
                if ('includefiles' == name || 'owner' == name || 'z' == name) {
                    continue;
                }
                return false;
            }
            return true;
        }
        static nextCurrNode(isForceCreate = false) {
            if (isForceCreate) {
                this._currNode = null;
                return this.currNode;
            }
            else {
                if (null != this._currNode) {
                    if (this.isEmptyNode(this._currNode)) {
                        return null;
                    }
                    this._currNode = null;
                }
                return null;
            }
        }
        static get currNode() {
            if (null == this._currNode) {
                this._currNode = new WebGPUShaderToken(this._parentNode.includefiles);
                this._parentNode.addBody(this._currNode);
            }
            return this._currNode;
        }
        static _compileToTree(parent, code) {
            this._parentNode = parent;
            let lines = code.split("\n");
            for (let i = 0, len = lines.length; i < len; i++) {
                let text = lines[i];
                if (text.length < 1)
                    continue;
                let ofs = text.indexOf("//");
                if (0 < ofs) {
                    this._parseNode(text.substring(0, ofs));
                    this._parseNode(text.substring(ofs));
                }
                else {
                    this._parseNode(text);
                }
            }
        }
        static _parseNode(text) {
            text = text.split("\t").join(" ").trim();
            if (text.indexOf("#") != 0) {
                if (null == this.currNode.code) {
                    this.currNode.code = text;
                }
                else {
                    this.currNode.code += '\n' + text;
                }
            }
            else {
                let arr = text.split(" ");
                let name = arr.shift();
                if ("#endif" == name) {
                    this._parentNode = this._parentNode.parent;
                    this._currNode = null;
                    return;
                }
                let node;
                switch (name) {
                    case '#ifdef':
                    case "#ifndef":
                    case "#if":
                        node = this.nextCurrNode(true);
                        node.code = text;
                        node.name = name;
                        node.defParam = arr;
                        this._parentNode = node;
                        this._currNode = null;
                        WebGPUShaderCompileUtil.checkDef(node, this._defs);
                        break;
                    case "#elif":
                    case "#else":
                        this._parentNode = this._parentNode.parent;
                        node = this.nextCurrNode(true);
                        node.code = text;
                        node.name = name;
                        node.defParam = arr;
                        this._parentNode = node;
                        this._currNode = null;
                        if ('#elif' == name)
                            WebGPUShaderCompileUtil.checkDef(node, this._defs);
                        break;
                    case "#include":
                        break;
                    default:
                        node = this.nextCurrNode(true);
                        node.code = text;
                        node.name = name;
                        node.defParam = arr;
                        this._currNode = null;
                        break;
                }
            }
        }
    }

    exports.BatchAgentSortUtil = BatchAgentSortUtil;
    exports.BatchCullPass = BatchCullPass;
    exports.BatchMergeVertexInfo = BatchMergeVertexInfo;
    exports.MergeMeshUtil = MergeMeshUtil;
    exports.OneBatchMark = OneBatchMark;
    exports.RenderCullUtil = RenderCullUtil;
    exports.RenderListQueue = RenderListQueue;
    exports.RenderPassUtil = RenderPassUtil;
    exports.RenderQuickSort = RenderQuickSort;
    exports.SingleLeakList = SingleLeakList;
    exports.Web3DRenderModuleFactory = Web3DRenderModuleFactory;
    exports.WebBaseRenderNode = WebBaseRenderNode;
    exports.WebBaseSpotRP = WebBaseSpotRP;
    exports.WebCameraNodeData = WebCameraNodeData;
    exports.WebDirCascadeShadowRP = WebDirCascadeShadowRP;
    exports.WebDirectLight = WebDirectLight;
    exports.WebForwardAddClusterRP = WebForwardAddClusterRP;
    exports.WebForwardAddRP = WebForwardAddRP;
    exports.WebGPU3DRenderPassFactory = WebGPU3DRenderPassFactory;
    exports.WebGPUBaseRenderNode = WebGPUBaseRenderNode;
    exports.WebGPUBatchQueue = WebGPUBatchQueue;
    exports.WebGPUBatch_CullDataSet = WebGPUBatch_CullDataSet;
    exports.WebGPUBlitQuadCMDData = WebGPUBlitQuadCMDData;
    exports.WebGPUDrawElementCMDData = WebGPUDrawElementCMDData;
    exports.WebGPUDrawNodeCMDData = WebGPUDrawNodeCMDData;
    exports.WebGPUMeshBatchCPUCullNodeList = WebGPUMeshBatchCPUCullNodeList;
    exports.WebGPUMeshBatchCPUCullResult = WebGPUMeshBatchCPUCullResult;
    exports.WebGPUMeshBathShaderInit = WebGPUMeshBathShaderInit;
    exports.WebGPUMeshInstanceRenderElement = WebGPUMeshInstanceRenderElement;
    exports.WebGPUMeshInstanceUtil = WebGPUMeshInstanceUtil;
    exports.WebGPUMeshRenderBatchAgent = WebGPUMeshRenderBatchAgent;
    exports.WebGPURenderContext3D = WebGPURenderContext3D;
    exports.WebGPURenderElement3D = WebGPURenderElement3D;
    exports.WebGPUSetRenderTargetCMD = WebGPUSetRenderTargetCMD;
    exports.WebGPUSetViewportCMD = WebGPUSetViewportCMD;
    exports.WebGPUShaderCompileCode = WebGPUShaderCompileCode;
    exports.WebGPUShaderCompileDef = WebGPUShaderCompileDef;
    exports.WebGPUShaderCompileUtil = WebGPUShaderCompileUtil;
    exports.WebGPUShaderDefine = WebGPUShaderDefine;
    exports.WebGPUShaderToken = WebGPUShaderToken;
    exports.WebGPUSkinRenderElement3D = WebGPUSkinRenderElement3D;
    exports.WebLightmap = WebLightmap;
    exports.WebMeshRenderNode = WebMeshRenderNode;
    exports.WebPointLight = WebPointLight;
    exports.WebReflectionProbe = WebReflectionProbe;
    exports.WebRender3DProcess = WebRender3DProcess;
    exports.WebSceneNodeData = WebSceneNodeData;
    exports.WebSceneRenderManager = WebSceneRenderManager;
    exports.WebSimpleSkinRenderNode = WebSimpleSkinRenderNode;
    exports.WebSkinRenderNode = WebSkinRenderNode;
    exports.WebSpotLight = WebSpotLight;
    exports.WebVolumetricGI = WebVolumetricGI;
    exports._clearCR = _clearCR;
    exports.batchRecoard = batchRecoard;
    exports.boolCheck = boolCheck;
    exports.renderNodeCustomData = renderNodeCustomData;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.webgpu_3D.js.map
