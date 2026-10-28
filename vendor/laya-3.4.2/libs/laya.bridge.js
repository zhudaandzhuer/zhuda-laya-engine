(function (exports, Laya) {
    'use strict';

    class RTBridge3DRenderProcess {
        get render3DManager() { return this._render3DManager; }
        set render3DManager(value) {
            this._render3DManager = value;
            this._nativeObj.renderManager = value._nativeObj;
        }
        constructor() {
            this._bridgeElements = [];
            this._nativeObj = new window.conchGLESBridge3DRenderProcess();
            this._mem = new Laya.NativeMemory(3 * 4, false);
            this._i32 = this._mem.int32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
            this._dirShadowRP = new Laya.RTDirCascadeShadowRP();
            this._spotShadowRP = new Laya.RTBaseSpotRP();
            this._nativeObj.setDirectLightShadowPass(this._dirShadowRP._nativeObj);
            this._nativeObj.setSpotLightShadowPass(this._spotShadowRP._nativeObj);
            this._defaultShadowMap = Laya.ShadowUtils.getTemporaryShadowTexture(1, 1, Laya.ShadowMapFormat.bit16);
            this._nativeObj.setDefaultShadowMap(this._defaultShadowMap._renderTarget._nativeObj);
        }
        addBridgeElement(element) {
            this._bridgeElements.push(element);
        }
        removeBridgeElement(element) {
            const idx = this._bridgeElements.indexOf(element);
            if (idx !== -1)
                this._bridgeElements.splice(idx, 1);
        }
        fowardRender(context3d, camera) {
            const scene = camera._scene;
            if (!scene)
                return;
            scene.bridge3DContext.prepareForRender(camera, context3d);
            const nativeCtx3d = context3d._nativeObj;
            for (const element of this._bridgeElements) {
                element._nativeObj.setContext3D(nativeCtx3d);
            }
            if (!scene.enableLight)
                return;
            if (this._bridgeElements.length === 0)
                return;
            scene._setCullCamera(camera);
            this.render3DManager = scene.sceneRenderableManager._sceneManagerOBJ;
            this.renderShadows(context3d, camera);
            scene.recaculateCullCamera();
        }
        renderShadows(context, camera) {
            const scene = camera._scene;
            if (!scene) {
                return;
            }
            if (Laya.Config3D._multiLighting) {
                Laya.Cluster.instance.update(camera, scene);
            }
            const enableShadow = (Laya.Scene3D._updateMark % scene._ShadowMapupdateFrequency === 0);
            this._i32[0] = enableShadow ? 1 : 0;
            if (!enableShadow) {
                window.conchRT3DRenderProcess._removePreDrawUniformMap("Shadow", context._nativeObj);
                context.preDrawUniformMaps = context.preDrawUniformMaps;
                return;
            }
            const mainDirLight = scene._mainDirectionLight;
            const needDirectionShadow = mainDirLight && mainDirLight.shadowMode !== Laya.ShadowMode.None;
            this._i32[1] = needDirectionShadow ? 1 : 0;
            if (needDirectionShadow) {
                this._dirShadowRP.setRPData(mainDirLight._dataModule, camera._renderDataModule, context);
                this._dirShadowRP.setCameraCullInfo(this._render3DManager);
            }
            const mainSpotLight = scene._mainSpotLight;
            const needSpotShadow = mainSpotLight && mainSpotLight.shadowMode !== Laya.ShadowMode.None;
            this._i32[2] = needSpotShadow ? 1 : 0;
            if (needSpotShadow) {
                this._spotShadowRP.setRPData(mainSpotLight._dataModule, context);
                this._spotShadowRP.setCameraCullInfo(this._render3DManager);
            }
            if (needDirectionShadow || needSpotShadow) {
                window.conchRT3DRenderProcess._addPreDrawUniformMap("Shadow", context._nativeObj);
            }
            else {
                window.conchRT3DRenderProcess._removePreDrawUniformMap("Shadow", context._nativeObj);
            }
            context.preDrawUniformMaps = context.preDrawUniformMaps;
            this._nativeObj.renderShadows(context._nativeObj);
        }
        render(element, context2d, context3d) {
            this._nativeObj.render(element._nativeObj, context2d._nativeObj, context3d._nativeObj);
        }
        destroy() {
            if (this._dirShadowRP) {
                this._dirShadowRP.destroy();
                this._dirShadowRP = null;
            }
            if (this._spotShadowRP) {
                this._spotShadowRP.destroy();
                this._spotShadowRP = null;
            }
            if (this._defaultShadowMap) {
                this._defaultShadowMap.destroy();
                this._defaultShadowMap = null;
            }
            this._render3DManager = null;
            if (this._nativeObj) {
                this._nativeObj.destroy();
                this._nativeObj = null;
            }
        }
    }

    class Bridge3DContext {
        constructor() {
            this._clearDepthBeforeRender = true;
            this._pipelineMode = "Forward";
            this._invertY = false;
            this._clearDepth = 1.0;
            this._clearStencil = 0;
            this._sceneModuleData = null;
            this._cameraModuleData = null;
            this._sceneData = null;
            this._cameraData = null;
            this._globalShaderData = null;
            this._sceneOffsetMatrix = new Laya.Matrix4x4();
            this._bridgePlaneWidth = 1;
            this._bridgePlaneHeight = 1;
            this._color = null;
            this._renderTarget2D = null;
            this._invertMat0_a = 1;
            this._invertMat0_c = 0;
            this._invertMat0_tx = 0;
            this._invertMat1_b = 0;
            this._invertMat1_d = 1;
            this._invertMat1_ty = 0;
            this._invertY2D = false;
            this._bridge3DLightTexture = null;
            this._bridge3DLightPixels = null;
            this._viewport = new Laya.Viewport(0, 0, 0, 0);
            this._scissor = new Laya.Vector4(0, 0, 0, 0);
            this._color = new Laya.Color(1, 1, 1, 1);
        }
        setSceneModuleData(data) {
            this._sceneModuleData = data;
        }
        setCameraModuleData(data) {
            this._cameraModuleData = data;
        }
        setSceneData(data) {
            this._sceneData = data;
        }
        setCameraData(data) {
            this._cameraData = data;
        }
        setGlobalShaderData(data) {
            this._globalShaderData = data;
        }
        setBridgeProjectionData(sceneOffsetMatrix, bridgePlaneWidth, bridgePlaneHeight) {
            if (sceneOffsetMatrix) {
                sceneOffsetMatrix.cloneTo(this._sceneOffsetMatrix);
            }
            else {
                this._sceneOffsetMatrix.identity();
            }
            this._bridgePlaneWidth = bridgePlaneWidth || 1;
            this._bridgePlaneHeight = bridgePlaneHeight || 1;
        }
        setRenderTarget2D(rt) {
            this._renderTarget2D = rt;
        }
        getRenderTarget2D() {
            return this._renderTarget2D;
        }
        setInvertMatrix(a, b, c, d, tx, ty) {
            this._invertMat0_a = a;
            this._invertMat0_c = c;
            this._invertMat0_tx = tx;
            this._invertMat1_b = b;
            this._invertMat1_d = d;
            this._invertMat1_ty = ty;
        }
        set invertY2D(value) {
            this._invertY2D = value;
        }
        get invertY2D() {
            return this._invertY2D;
        }
        get needsProjectionCorrection() {
            return this._renderTarget2D != null;
        }
        computeCorrectionMatrix(vpW, vpH, rtW, rtH, out) {
            const a = this._invertMat0_a;
            const b = this._invertMat1_b;
            const c = this._invertMat0_c;
            const d = this._invertMat1_d;
            const tx = this._invertMat0_tx;
            const ty = this._invertMat1_ty;
            const A = a * vpW / rtW;
            const B = -c * vpH / rtW;
            const C = (a * vpW + c * vpH + 2 * tx) / rtW - 1;
            const D = -b * vpW / rtH;
            const E = d * vpH / rtH;
            const F = 1 - (b * vpW + d * vpH + 2 * ty) / rtH;
            const e = out.elements;
            e[0] = A;
            e[1] = D;
            e[2] = 0;
            e[3] = 0;
            e[4] = B;
            e[5] = E;
            e[6] = 0;
            e[7] = 0;
            e[8] = 0;
            e[9] = 0;
            e[10] = 1;
            e[11] = 0;
            e[12] = C;
            e[13] = F;
            e[14] = 0;
            e[15] = 1;
        }
        updateFromCamera(camera) {
            if (!camera)
                return;
            const viewport = camera.viewport;
            this._viewport.x = viewport.x;
            this._viewport.y = viewport.y;
            this._viewport.width = viewport.width;
            this._viewport.height = viewport.height;
            this._scissor.setValue(viewport.x, viewport.y, viewport.width, viewport.height);
        }
        applyToContext(context3d) {
            context3d.preDrawUniformMaps.add("Scene3D");
            context3d.preDrawUniformMaps.add("Global");
            context3d.sceneData = this._sceneData;
            context3d.cameraData = this._cameraData;
            context3d.sceneModuleData = this._sceneModuleData;
            context3d.cameraModuleData = this._cameraModuleData;
            context3d.globalShaderData = this._globalShaderData;
            context3d.setViewPort(this._viewport);
            context3d.setScissor(this._scissor);
            const clearFlag = this._clearDepthBeforeRender ? Laya.RenderClearFlag.Depth : Laya.RenderClearFlag.Nothing;
            context3d.setClearData(clearFlag, this._color, this._clearDepth, this._clearStencil);
            context3d.pipelineMode = this._pipelineMode;
            context3d.invertY = this._invertY;
        }
        get clearDepthBeforeRender() {
            return this._clearDepthBeforeRender;
        }
        set clearDepthBeforeRender(value) {
            this._clearDepthBeforeRender = value;
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
        get clearDepth() {
            return this._clearDepth;
        }
        set clearDepth(value) {
            this._clearDepth = value;
        }
        get clearStencil() {
            return this._clearStencil;
        }
        set clearStencil(value) {
            this._clearStencil = value;
        }
        get viewport() {
            return this._viewport;
        }
        get scissor() {
            return this._scissor;
        }
        get sceneModuleData() {
            return this._sceneModuleData;
        }
        get cameraModuleData() {
            return this._cameraModuleData;
        }
        get sceneData() {
            return this._sceneData;
        }
        get cameraData() {
            return this._cameraData;
        }
        get globalShaderData() {
            return this._globalShaderData;
        }
        get sceneOffsetMatrix() {
            return this._sceneOffsetMatrix;
        }
        get bridgePlaneWidth() {
            return this._bridgePlaneWidth;
        }
        get bridgePlaneHeight() {
            return this._bridgePlaneHeight;
        }
        setBridge3DLightData(lightTexture, lightPixels) {
            this._bridge3DLightTexture = lightTexture;
            this._bridge3DLightPixels = lightPixels;
        }
        get bridge3DLightTexture() {
            return this._bridge3DLightTexture;
        }
        get bridge3DLightPixels() {
            return this._bridge3DLightPixels;
        }
    }
    Bridge3DContext._correctionMatrix = new Laya.Matrix4x4();
    Bridge3DContext._tempCorrectedProj = new Laya.Matrix4x4();
    Bridge3DContext._tempCorrectedProjView = new Laya.Matrix4x4();

    class WebBridge3DRenderProcess {
        constructor() {
            this._bridgeElements = [];
            this._rt2d = null;
            this._cachedInvertY = false;
            this._rtW = 0;
            this._rtH = 0;
            this._vpW = 0;
            this._vpH = 0;
            this._hasInvertMatrix = false;
            this._invA = 1;
            this._invB = 0;
            this._invC = 0;
            this._invD = 1;
            this._invTx = 0;
            this._invTy = 0;
            this._projCorrected = false;
            this._hasGammaCorrect = false;
            this._defaultShadowMap = Laya.ShadowUtils.getTemporaryShadowTexture(1, 1, Laya.ShadowMapFormat.bit16);
            this._dirShadowRP = new Laya.WebDirCascadeShadowRP();
            this._spotShadowRP = new Laya.WebBaseSpotRP();
        }
        addBridgeElement(element) {
            this._bridgeElements.push(element);
        }
        removeBridgeElement(element) {
            const idx = this._bridgeElements.indexOf(element);
            if (idx !== -1)
                this._bridgeElements.splice(idx, 1);
        }
        fowardRender(context3d, camera) {
            const scene = camera._scene;
            if (!scene)
                return;
            const bridge3DContext = scene.bridge3DContext;
            bridge3DContext.updateFromCamera(camera);
            bridge3DContext.applyToContext(context3d);
            context3d.preDrawUniformMaps.add("Scene3D");
            context3d.preDrawUniformMaps.add("Global");
            if (!scene.enableLight)
                return;
            if (this._bridgeElements.length === 0)
                return;
            scene._setCullCamera(camera);
            this.render3DManager = scene.sceneRenderableManager._sceneManagerOBJ;
            this.renderShadows(context3d, camera);
            scene.recaculateCullCamera();
        }
        renderShadows(context, camera) {
            const scene = camera._scene;
            if (!scene) {
                return;
            }
            if (Laya.Config3D._multiLighting) {
                Laya.Cluster.instance.update(camera, scene);
            }
            const enableShadow = (Laya.Scene3D._updateMark % scene._ShadowMapupdateFrequency === 0);
            if (!enableShadow) {
                return;
            }
            context.preDrawUniformMaps.add("Shadow");
            context.sceneData.setTexture(Laya.ShadowCasterPass.SHADOW_SPOTMAP, this._defaultShadowMap);
            const mainDirLight = scene._mainDirectionLight;
            const needDirectionShadow = mainDirLight && mainDirLight.shadowMode !== Laya.ShadowMode.None;
            if (needDirectionShadow) {
                this._dirShadowRP.setRPData(mainDirLight._dataModule, camera._renderDataModule, context);
                this._dirShadowRP.setCameraCullInfo(this.render3DManager);
                this._dirShadowRP.update(context);
                this._dirShadowRP.render(context, this.render3DManager);
                this._dirShadowRP.useRPResource(context);
            }
            else {
                this._dirShadowRP.unuseRPResource(context);
            }
            const mainSpotLight = scene._mainSpotLight;
            const needSpotShadow = mainSpotLight && mainSpotLight.shadowMode !== Laya.ShadowMode.None;
            if (needSpotShadow) {
                this._spotShadowRP.setRPData(mainSpotLight._dataModule, context);
                this._spotShadowRP.setCameraCullInfo(this.render3DManager);
                this._spotShadowRP.update(context);
                this._spotShadowRP.render(context, this.render3DManager);
                this._spotShadowRP.useRPResource(context);
            }
            else {
                this._spotShadowRP.unuseRPResource(context);
            }
            if (!needDirectionShadow && !needSpotShadow) {
                context.preDrawUniformMaps.delete("Shadow");
            }
            context.setRenderTarget(null, Laya.RenderClearFlag.Nothing);
        }
        initBridge3DRenderPass(element, context2d, context3d) {
            const bridge3DElement = element;
            const bridge3DContext = bridge3DElement.bridge3DContext;
            this._rt2d = context2d.getRenderTarget();
            this._cachedInvertY = context2d.invertY;
            this._vpW = Laya.RenderState2D.width;
            this._vpH = Laya.RenderState2D.height;
            if (this._rt2d) {
                this._rtW = this._rt2d._textures[0].width;
                this._rtH = this._rt2d._textures[0].height;
            }
            else {
                this._rtW = this._vpW;
                this._rtH = this._vpH;
            }
            this._hasInvertMatrix = false;
            this._invA = 1;
            this._invB = 0;
            this._invC = 0;
            this._invD = 1;
            this._invTx = 0;
            this._invTy = 0;
            if (this._rt2d) {
                const passData = context2d.passData;
                if (passData) {
                    const mat0 = passData.getVector3(Laya.ShaderDefines2D.UNIFORM_INVERTMAT_0);
                    const mat1 = passData.getVector3(Laya.ShaderDefines2D.UNIFORM_INVERTMAT_1);
                    if (mat0 && mat1) {
                        this._invA = mat0.x;
                        this._invC = mat0.y;
                        this._invTx = mat0.z;
                        this._invB = mat1.x;
                        this._invD = mat1.y;
                        this._invTy = mat1.z;
                        this._hasInvertMatrix = true;
                    }
                }
            }
            bridge3DContext.applyToContext(context3d);
            const clearFlag = bridge3DContext.clearDepthBeforeRender
                ? Laya.RenderClearFlag.Depth
                : Laya.RenderClearFlag.Nothing;
            context3d.setRenderTarget(this._rt2d, clearFlag);
            context3d.pipelineMode = context2d.pipelineMode;
            this._hasGammaCorrect = false;
            const cameraData = bridge3DContext.cameraData;
            if (!this._rt2d || this._rt2d._textures[0].gammaCorrection !== 1) {
                cameraData.addDefine(Laya.RenderContext3D.GammaCorrect);
                this._hasGammaCorrect = true;
            }
            else {
                cameraData.removeDefine(Laya.RenderContext3D.GammaCorrect);
            }
            if (this._rt2d) {
                const tempVP = WebBridge3DRenderProcess._tempViewport;
                tempVP.x = 0;
                tempVP.y = 0;
                tempVP.width = this._rtW;
                tempVP.height = this._rtH;
                context3d.setViewPort(tempVP);
                const tempSC = WebBridge3DRenderProcess._tempScissor;
                tempSC.setValue(0, 0, this._rtW, this._rtH);
                context3d.setScissor(tempSC);
            }
        }
        prepareProjectionCorrection(element, context2d, context3d) {
            const bridge3DElement = element;
            const bridge3DContext = bridge3DElement.bridge3DContext;
            this._projCorrected = false;
            const cameraData = bridge3DContext.cameraData;
            const origProj = cameraData.getMatrix4x4(Laya.BaseCamera.PROJECTMATRIX);
            const origProjView = cameraData.getMatrix4x4(Laya.BaseCamera.VIEWPROJECTMATRIX);
            if (origProj && origProjView) {
                origProj.cloneTo(WebBridge3DRenderProcess._savedProjMatrix);
                origProjView.cloneTo(WebBridge3DRenderProcess._savedProjViewMatrix);
                const sceneCorrection = WebBridge3DRenderProcess._sceneCorrectionMatrix;
                this._computeSceneCorrectionMatrix(bridge3DContext, sceneCorrection);
                let correctionMatrix = sceneCorrection;
                if (this._hasInvertMatrix) {
                    bridge3DContext.setInvertMatrix(this._invA, this._invB, this._invC, this._invD, this._invTx, this._invTy);
                    const corrMat = Bridge3DContext._correctionMatrix;
                    bridge3DContext.computeCorrectionMatrix(this._vpW, this._vpH, this._rtW, this._rtH, corrMat);
                    correctionMatrix = WebBridge3DRenderProcess._combinedCorrectionMatrix;
                    Laya.Matrix4x4.multiply(corrMat, sceneCorrection, correctionMatrix);
                }
                const correctedProj = Bridge3DContext._tempCorrectedProj;
                Laya.Matrix4x4.multiply(correctionMatrix, origProj, correctedProj);
                const correctedProjView = Bridge3DContext._tempCorrectedProjView;
                Laya.Matrix4x4.multiply(correctionMatrix, origProjView, correctedProjView);
                cameraData.setMatrix4x4(Laya.BaseCamera.PROJECTMATRIX, correctedProj);
                cameraData.setMatrix4x4(Laya.BaseCamera.VIEWPROJECTMATRIX, correctedProjView);
                this._projCorrected = true;
            }
        }
        _computeSceneCorrectionMatrix(bridge3DContext, out) {
            const sceneW = bridge3DContext.bridgePlaneWidth;
            const sceneH = bridge3DContext.bridgePlaneHeight;
            const stageW = this._vpW || this._rtW || 1;
            const stageH = this._vpH || this._rtH || 1;
            const src = bridge3DContext.sceneOffsetMatrix.elements;
            const e = out.elements;
            const a = src[0], b = src[1], c = src[4], d = src[5], tx = src[12], ty = src[13];
            e[0] = a * sceneW / stageW;
            e[1] = b * sceneW / stageH;
            e[2] = 0;
            e[3] = 0;
            e[4] = c * sceneH / stageW;
            e[5] = d * sceneH / stageH;
            e[6] = 0;
            e[7] = 0;
            e[8] = 0;
            e[9] = 0;
            e[10] = 1;
            e[11] = 0;
            e[12] = (a * sceneW + c * sceneH + 2 * tx) / stageW - 1;
            e[13] = (b * sceneW + d * sceneH + 2 * ty) / stageH - 1;
            e[14] = 0;
            e[15] = 1;
        }
        renderBridge3DForward(element, context2d, context3d) {
            const bridge3DElement = element;
            const bridge3DContext = bridge3DElement.bridge3DContext;
            const opaqueList = bridge3DElement.getOpaqueList();
            const transparentList = bridge3DElement.getTransparentList();
            bridge3DElement.applyStencilClipTo3DRenderStates();
            try {
                if (opaqueList.elements.length > 0) {
                    opaqueList.renderQueueOnly(context3d);
                }
                if (transparentList.elements.length > 0) {
                    transparentList.renderQueueOnly(context3d);
                }
            }
            finally {
                bridge3DElement.restoreStencilClipTo3DRenderStates();
            }
            if (this._hasGammaCorrect) {
                bridge3DContext.cameraData.removeDefine(Laya.RenderContext3D.GammaCorrect);
            }
            if (this._projCorrected) {
                const cameraData = bridge3DContext.cameraData;
                cameraData.setMatrix4x4(Laya.BaseCamera.PROJECTMATRIX, WebBridge3DRenderProcess._savedProjMatrix);
                cameraData.setMatrix4x4(Laya.BaseCamera.VIEWPROJECTMATRIX, WebBridge3DRenderProcess._savedProjViewMatrix);
            }
            context2d.setRenderTarget(this._rt2d, false, Laya.Color.BLACK);
            context2d.invertY = this._cachedInvertY;
        }
        render(element, context2d, context3d) {
            this.initBridge3DRenderPass(element, context2d, context3d);
            const bridge3DElement = element;
            bridge3DElement.collectElements(context3d);
            if (bridge3DElement.getOpaqueList().elements.length === 0 && bridge3DElement.getTransparentList().elements.length === 0) {
                context2d.setRenderTarget(this._rt2d, false, Laya.Color.BLACK);
                context2d.invertY = this._cachedInvertY;
                return;
            }
            this.prepareProjectionCorrection(element, context2d, context3d);
            this.renderBridge3DForward(element, context2d, context3d);
        }
        destroy() {
            if (this._dirShadowRP) {
                this._dirShadowRP.destory();
                this._dirShadowRP = null;
            }
            if (this._spotShadowRP) {
                this._spotShadowRP.destory();
                this._spotShadowRP = null;
            }
            if (this._defaultShadowMap) {
                this._defaultShadowMap.destroy();
                this._defaultShadowMap = null;
            }
            this.render3DManager = null;
            this._rt2d = null;
        }
    }
    WebBridge3DRenderProcess._tempViewport = new Laya.Viewport(0, 0, 0, 0);
    WebBridge3DRenderProcess._tempScissor = new Laya.Vector4(0, 0, 0, 0);
    WebBridge3DRenderProcess._savedProjMatrix = new Laya.Matrix4x4();
    WebBridge3DRenderProcess._savedProjViewMatrix = new Laya.Matrix4x4();
    WebBridge3DRenderProcess._sceneCorrectionMatrix = new Laya.Matrix4x4();
    WebBridge3DRenderProcess._combinedCorrectionMatrix = new Laya.Matrix4x4();

    class LayaXBridge3DRenderProcess {
        get render3DManager() { return this._render3DManager; }
        set render3DManager(value) {
            if (this._render3DManager === value)
                return;
            this._render3DManager = value;
            this._nativeObj.renderManager = value._nativeObj;
        }
        constructor() {
            this._shadowBuf = new ArrayBuffer(3 * 4);
            this._shadowI32 = new Int32Array(this._shadowBuf);
            this._bridgeElements = [];
            this._nativeObj = new window.conchLayaXBridge3DProcess();
            this._nativeObj.bindPropertyBuffer(this._shadowBuf);
            this._dirShadowRP = new Laya.LayaXDirCascadeShadowRP();
            this._spotShadowRP = new Laya.LayaXBaseSpotRP();
            this._nativeObj.setDirectLightShadowPass(this._dirShadowRP._nativeObj);
            this._nativeObj.setSpotLightShadowPass(this._spotShadowRP._nativeObj);
            this._defaultShadowMap = Laya.ShadowUtils.getTemporaryShadowTexture(1, 1, Laya.ShadowMapFormat.bit16);
            this._nativeObj.setDefaultShadowMap(this._defaultShadowMap._renderTarget._nativeObj);
        }
        addBridgeElement(element) {
            this._bridgeElements.push(element);
        }
        removeBridgeElement(element) {
            const idx = this._bridgeElements.indexOf(element);
            if (idx !== -1)
                this._bridgeElements.splice(idx, 1);
        }
        fowardRender(context3d, camera) {
            const scene = camera._scene;
            if (!scene)
                return;
            Laya.LayaXRender3DProcess._flushDirtyProbes();
            const cameraData = camera._shaderValues;
            if (cameraData && Laya.RenderContext3D.GammaCorrect) {
                cameraData.addDefine(Laya.RenderContext3D.GammaCorrect);
            }
            camera._renderDataModule.syncProjection();
            const bridge3DContext = scene.bridge3DContext;
            bridge3DContext.invertY = context3d.invertY;
            bridge3DContext.prepareForRender(camera, context3d);
            for (const element of this._bridgeElements) {
                element.setContext3D(context3d);
            }
            if (!scene.enableLight)
                return;
            if (this._bridgeElements.length === 0)
                return;
            scene._setCullCamera(camera);
            this.render3DManager = scene.sceneRenderableManager._sceneManagerOBJ;
            this.renderShadows(context3d, camera);
            scene.recaculateCullCamera();
        }
        renderShadows(context, camera) {
            const scene = camera._scene;
            if (!scene) {
                return;
            }
            if (Laya.Config3D._multiLighting) {
                Laya.Cluster.instance.update(camera, scene);
            }
            const enableShadow = (Laya.Scene3D._updateMark % scene._ShadowMapupdateFrequency === 0);
            this._shadowI32[0] = enableShadow ? 1 : 0;
            if (!enableShadow) {
                window.conchLayaXRT3DRenderProcess._removePreDrawUniformMap("Shadow", context._nativeObj);
                context.preDrawUniformMaps = context.preDrawUniformMaps;
                return;
            }
            const mainDirLight = scene._mainDirectionLight;
            const needDirectionShadow = mainDirLight && mainDirLight.shadowMode !== Laya.ShadowMode.None;
            this._shadowI32[1] = needDirectionShadow ? 1 : 0;
            if (needDirectionShadow) {
                const dirLight = mainDirLight._dataModule;
                const camData = camera._renderDataModule;
                dirLight.syncShadow();
                this._dirShadowRP.setRPData(dirLight, camData, context);
                this._dirShadowRP.setCameraCullInfo(this._render3DManager);
            }
            const mainSpotLight = scene._mainSpotLight;
            const needSpotShadow = mainSpotLight && mainSpotLight.shadowMode !== Laya.ShadowMode.None;
            this._shadowI32[2] = needSpotShadow ? 1 : 0;
            if (needSpotShadow) {
                this._spotShadowRP.setRPData(mainSpotLight._dataModule, context);
                this._spotShadowRP.setCameraCullInfo(this._render3DManager);
            }
            if (needDirectionShadow || needSpotShadow) {
                window.conchLayaXRT3DRenderProcess._addPreDrawUniformMap("Shadow", context._nativeObj);
            }
            else {
                window.conchLayaXRT3DRenderProcess._removePreDrawUniformMap("Shadow", context._nativeObj);
            }
            context.preDrawUniformMaps = context.preDrawUniformMaps;
            this._nativeObj.renderShadows();
        }
        render(element, context2d, context3d) {
            this._nativeObj.render(element._nativeObj, context2d._nativeObj, context3d._nativeObj);
        }
        destroy() {
            if (this._dirShadowRP) {
                this._dirShadowRP.destroy();
                this._dirShadowRP = null;
            }
            if (this._spotShadowRP) {
                this._spotShadowRP.destroy();
                this._spotShadowRP = null;
            }
            if (this._defaultShadowMap) {
                this._defaultShadowMap.destroy();
                this._defaultShadowMap = null;
            }
            this._render3DManager = null;
            if (this._nativeObj) {
                this._nativeObj.destroy();
                this._nativeObj = null;
            }
        }
    }

    class Bridge3DCamera extends Laya.Camera {
        static __init__() {
        }
        constructor() {
            super();
            this._sceneOffsetMatrix = new Laya.Matrix4x4();
            this._sceneOffsetIsIdentity = true;
            this._projectionChangeHandler = null;
            if (Laya.LayaEnv.isModernAPIs) {
                this._bridge3DRenderProcess = new LayaXBridge3DRenderProcess();
            }
            else if (Laya.LayaEnv.isConch && window.conchConfig.getGraphicsAPI() != 2) {
                this._bridge3DRenderProcess = new RTBridge3DRenderProcess();
            }
            else {
                this._bridge3DRenderProcess = new WebBridge3DRenderProcess();
            }
            this._setupBridge3DCameraDefaults();
        }
        _setupBridge3DCameraDefaults() {
            this.clearFlag = Laya.CameraClearFlags.DepthOnly;
            this.clearColor = new Laya.Color(1, 1, 1, 1);
            this.enableHDR = false;
            this.msaa = false;
            this.postProcess = null;
            this.enableRender = true;
            this.enableBuiltInRenderTexture = false;
        }
        get bridge3DRenderProcess() {
            return this._bridge3DRenderProcess;
        }
        setProjectionChangeHandler(handler) {
            this._projectionChangeHandler = handler;
        }
        get fieldOfView() {
            return super.fieldOfView;
        }
        set fieldOfView(value) {
            super.fieldOfView = value;
            if (this._projectionChangeHandler) {
                this._projectionChangeHandler();
            }
        }
        setSceneOffsetFrom2DMatrix(a, b, c, d, tx, ty, renderHeight, sceneHeight = renderHeight) {
            const e = this._sceneOffsetMatrix.elements;
            e[0] = a;
            e[1] = -b;
            e[2] = 0;
            e[3] = 0;
            e[4] = -c;
            e[5] = d;
            e[6] = 0;
            e[7] = 0;
            e[8] = 0;
            e[9] = 0;
            e[10] = 1;
            e[11] = 0;
            e[12] = c * sceneHeight + tx;
            e[13] = renderHeight - d * sceneHeight - ty;
            e[14] = 0;
            e[15] = 1;
            this._sceneOffsetIsIdentity =
                a === 1 && b === 0 && c === 0 && d === 1 && tx === 0 && ty === 0;
        }
        get sceneOffsetMatrix() {
            return this._sceneOffsetMatrix;
        }
        get sceneOffsetIsIdentity() {
            return this._sceneOffsetIsIdentity;
        }
        render(scene) {
            if (!scene)
                return;
            const context = Laya.RenderContext3D._instance;
            context.scene = scene;
            context.camera = this;
            context.invertY = Laya.LayaEnv.isModernAPIs;
            this._prepareCameraToRender();
            let viewMat = this.viewMatrix;
            this._applyViewProject(viewMat, this.projectionMatrix, context.invertY);
            this._contextApply(context);
            this._bridge3DRenderProcess.fowardRender(context._contextOBJ, this);
        }
        clone() {
            const clonedCamera = super.clone();
            return clonedCamera;
        }
        destroy(destroyChild = true) {
            if (this._bridge3DRenderProcess) {
                this._bridge3DRenderProcess.destroy();
                this._bridge3DRenderProcess = null;
            }
            super.destroy(destroyChild);
        }
    }

    class Bridge3DData {
        constructor() {
            this._cameraZDistance = 100;
            this._cameraFarPlane = 1000;
            this._orthographicCamera = true;
            this._scene3dSettingsData = { skyRenderer: {} };
            this._cameraSettingsData = {};
        }
        get cameraZDistance() {
            return this._cameraZDistance;
        }
        set cameraZDistance(value) {
            this._cameraZDistance = value;
        }
        get cameraFarPlane() {
            return this._cameraFarPlane;
        }
        set cameraFarPlane(value) {
            this._cameraFarPlane = value;
        }
        get orthographicCamera() {
            return this._orthographicCamera;
        }
        set orthographicCamera(value) {
            this._orthographicCamera = value;
        }
        get scene3dSettings() {
            return this._scene3dSettingsData;
        }
        get cameraSettings() {
            return this._cameraSettingsData;
        }
    }
    Laya.ClassUtils.regClass('Bridge3DData', Bridge3DData);

    class LayaXBridge3DContext {
        constructor() {
            this._clearBuf = new ArrayBuffer(3 * 4);
            this._clearI32 = new Int32Array(this._clearBuf);
            this._clearF32 = new Float32Array(this._clearBuf);
            this._invertY = false;
            this._nativeObj = new window.conchLayaXBridge3DContext();
            this._nativeObj.bindPropertyBuffer(this._clearBuf);
        }
        setSceneModuleData(data) {
            this._nativeObj.setSceneModuleData(data ? data._nativeObj : null);
        }
        setCameraModuleData(data) {
            this._nativeObj.setCameraModuleData(data ? data._nativeObj : null);
        }
        setSceneData(data) {
            this._nativeObj.setSceneData(data ? data._nativeObj : null);
        }
        setCameraData(data) {
            this._nativeObj.setCameraData(data ? data._nativeObj : null);
        }
        setGlobalShaderData(data) {
            this._nativeObj.setGlobalShaderData(data ? data._nativeObj : null);
        }
        setBridgeProjectionData(sceneOffsetMatrix, bridgePlaneWidth, bridgePlaneHeight) {
            this._nativeObj.setBridgeProjectionData(sceneOffsetMatrix, bridgePlaneWidth, bridgePlaneHeight);
        }
        setRenderTarget2D(rt) {
        }
        getRenderTarget2D() {
            return null;
        }
        setViewPort(vp) {
        }
        setScissor(sc) {
        }
        setClearData(flag, color, depthValue, stencilValue) {
            this._clearI32[0] = (flag & Laya.RenderClearFlag.Depth) !== 0 ? 1 : 0;
            this._clearF32[1] = depthValue;
            this._clearI32[2] = stencilValue;
        }
        setInvertMatrix(a, b, c, d, tx, ty) {
        }
        applyToContext(context) {
        }
        get clearDepthBeforeRender() {
            return this._clearI32[0] !== 0;
        }
        set clearDepthBeforeRender(value) {
            this._clearI32[0] = value ? 1 : 0;
        }
        get clearDepth() {
            return this._clearF32[1];
        }
        set clearDepth(value) {
            this._clearF32[1] = value;
        }
        get clearStencil() {
            return this._clearI32[2];
        }
        set clearStencil(value) {
            this._clearI32[2] = value;
        }
        get pipelineMode() {
            return null;
        }
        set pipelineMode(value) {
        }
        get invertY() {
            return this._invertY;
        }
        set invertY(value) {
            if (this._invertY !== value) {
                this._invertY = value;
                this._nativeObj.setInvertY(value);
            }
        }
        get sceneModuleData() {
            return null;
        }
        get cameraModuleData() {
            return null;
        }
        get sceneData() {
            return null;
        }
        get cameraData() {
            return null;
        }
        get globalShaderData() {
            return null;
        }
        setBridge3DLightData(lightTexture, lightPixels) {
        }
        get bridge3DLightTexture() {
            return null;
        }
        get bridge3DLightPixels() {
            return null;
        }
        updateFromCamera(camera) {
        }
        prepareForRender(camera, context3d) {
            this._nativeObj.prepareForRender(Laya.RenderState2D.width, Laya.RenderState2D.height);
        }
    }

    class RTBridge3DContext {
        constructor() {
            this._nativeObj = new window.conchGLESBridge3DContext();
            this._mem = new Laya.NativeMemory(3 * 4, false);
            this._f32 = this._mem.float32Array;
            this._i32 = this._mem.int32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
            this._i32[0] = 1;
            this._f32[1] = 1.0;
        }
        setSceneModuleData(data) {
            this._nativeObj.setSceneModuleData(data ? data._nativeObj : null);
        }
        setCameraModuleData(data) {
            this._nativeObj.setCameraModuleData(data ? data._nativeObj : null);
        }
        setSceneData(data) {
            this._nativeObj.setSceneData(data ? data._nativeObj : null);
        }
        setCameraData(data) {
            this._nativeObj.setCameraData(data ? data._nativeObj : null);
        }
        setGlobalShaderData(data) {
            this._nativeObj.setGlobalShaderData(data ? data._nativeObj : null);
        }
        setBridgeProjectionData(sceneOffsetMatrix, bridgePlaneWidth, bridgePlaneHeight) {
            this._nativeObj.setBridgeProjectionData(sceneOffsetMatrix, bridgePlaneWidth, bridgePlaneHeight);
        }
        setRenderTarget2D(rt) {
        }
        getRenderTarget2D() {
            return null;
        }
        setViewPort(vp) {
            this._nativeObj.setViewport(vp);
        }
        setScissor(sc) {
            this._nativeObj.setScissor(sc);
        }
        setClearData(flag, color, depthValue, stencilValue) {
            this._i32[0] = (flag & Laya.RenderClearFlag.Depth) !== 0 ? 1 : 0;
            this._f32[1] = depthValue;
            this._i32[2] = stencilValue | 0;
        }
        setInvertMatrix(a, b, c, d, tx, ty) {
        }
        applyToContext(context) {
            this._nativeObj.applyToContext(context._nativeObj);
        }
        computeCorrectionMatrix(vpW, vpH, rtW, rtH, out) {
        }
        get clearDepthBeforeRender() {
            return this._i32[0] !== 0;
        }
        set clearDepthBeforeRender(value) {
            this._i32[0] = value ? 1 : 0;
        }
        get clearDepth() {
            return this._f32[1];
        }
        set clearDepth(value) {
            this._f32[1] = value;
        }
        get clearStencil() {
            return this._i32[2];
        }
        set clearStencil(value) {
            this._i32[2] = value | 0;
        }
        get pipelineMode() {
            return null;
        }
        set pipelineMode(value) {
        }
        get invertY() {
            return false;
        }
        set invertY(value) {
        }
        get sceneModuleData() {
            return null;
        }
        get cameraModuleData() {
            return null;
        }
        get sceneData() {
            return null;
        }
        get cameraData() {
            return null;
        }
        get globalShaderData() {
            return null;
        }
        setBridge3DLightData(lightTexture, lightPixels) {
        }
        get bridge3DLightTexture() {
            return null;
        }
        get bridge3DLightPixels() {
            return null;
        }
        updateFromCamera(camera) {
            if (!camera)
                return;
            const viewport = camera.viewport;
            const vp = new Laya.Viewport(viewport.x, viewport.y, viewport.width, viewport.height);
            this._nativeObj.setViewport(vp);
            const sc = new Laya.Vector4(viewport.x, viewport.y, viewport.width, viewport.height);
            this._nativeObj.setScissor(sc);
        }
        prepareForRender(camera, context3d) {
            this._nativeObj.prepareForRender(context3d._nativeObj, camera.viewport.x, camera.viewport.y, camera.viewport.width, camera.viewport.height, Laya.RenderState2D.width, Laya.RenderState2D.height);
        }
    }

    class Bridge3DScene3D extends Laya.Scene3D {
        _getLightTexture() {
            return this._bridge3DLightTexture;
        }
        get sharedCamera() {
            return this._sharedCamera;
        }
        get bridge3DContext() {
            return this._bridge3DContext;
        }
        constructor(holder) {
            super();
            this._renderToBridgeMap = new Map();
            this._cameraZDistance = 100;
            this._orthographicCamera = true;
            this._updatingCameraProjection = false;
            this._bridge3DLightTexture = null;
            this.hideFlags = Laya.HideFlags.HideAndDontSave;
            this._holder = holder;
            if (Laya.Config3D._multiLighting) {
                const width = 4;
                const maxLightCount = Laya.Config3D.maxLightCount;
                this._bridge3DLightTexture = Laya.Utils3D._createFloatTextureBuffer(width, maxLightCount);
                this._bridge3DLightTexture.lock = true;
            }
            if (Laya.LayaEnv.isModernAPIs) {
                this._bridge3DContext = new LayaXBridge3DContext();
            }
            else if (Laya.LayaEnv.isConch && window.conchConfig.getGraphicsAPI() != 2) {
                this._bridge3DContext = new RTBridge3DContext();
            }
            else {
                this._bridge3DContext = new Bridge3DContext();
            }
            this._bridge3DContext.setBridge3DLightData(this._bridge3DLightTexture, this._getLightPixels());
            this.ambientMode = Laya.AmbientMode.SolidColor;
            this._sharedCamera = new Bridge3DCamera();
            this._sharedCamera.setProjectionChangeHandler(() => {
                if (!this._updatingCameraProjection) {
                    this._updateCameraProjectionAndPosition();
                }
            });
            this._sharedCamera.orthographic = this._orthographicCamera;
            this.addChild(this._sharedCamera);
            this.updateContext();
            this.setupCamera();
            Laya.ILaya.stage.on(Laya.Event.RESIZE, this, this.onStageResize);
        }
        applyCameraZDistance(value) {
            if (this._cameraZDistance !== value) {
                this._cameraZDistance = value;
                this._updateCameraProjectionAndPosition();
            }
        }
        applyOrthographicCamera(value) {
            value = value !== false;
            if (this._orthographicCamera !== value) {
                this._orthographicCamera = value;
            }
            this._updateCameraProjectionAndPosition();
        }
        applyCameraFarPlane(value) {
            this._sharedCamera.farPlane = value;
        }
        updateContext() {
            this._bridge3DContext.setSceneData(this._shaderValues);
            this._bridge3DContext.setCameraData(this._sharedCamera._shaderValues);
            this._bridge3DContext.setSceneModuleData(this._sceneModuleData);
            this._bridge3DContext.setCameraModuleData(this._sharedCamera._renderDataModule);
            this._bridge3DContext.updateFromCamera(this._sharedCamera);
            this._bridge3DContext.setBridgeProjectionData(this._sharedCamera.sceneOffsetMatrix, this._getBridgePlaneWidth(), this._getBridgePlaneHeight());
        }
        _addRenderObject(render) {
            super._addRenderObject(render);
            const bridge = this._findOwnerBridge3DSprite(render.owner);
            if (bridge) {
                bridge._addRenderObject(render);
                this._renderToBridgeMap.set(render, bridge);
            }
        }
        _findOwnerBridge3DSprite(node) {
            const list = this._holder.bridge3DList;
            while (node) {
                for (let i = 0, len = list.length; i < len; i++) {
                    const bridge = list[i];
                    if (node === bridge.containerSprite3D) {
                        return bridge;
                    }
                }
                node = node._parent;
            }
            return null;
        }
        _removeRenderObject(render) {
            super._removeRenderObject(render);
            const bridge = this._renderToBridgeMap.get(render);
            if (bridge) {
                bridge._removeRenderObject(render);
                this._renderToBridgeMap.delete(render);
            }
        }
        _getRenderHeight() {
            return this._scene2D && this._scene2D.height ? this._scene2D.height : (Laya.RenderState2D.height || Laya.ILaya.stage.height);
        }
        _getRenderWidth() {
            return this._scene2D && this._scene2D.width ? this._scene2D.width : (Laya.RenderState2D.width || Laya.ILaya.stage.width);
        }
        _getBridgePlaneWidth() {
            return this._getRenderWidth();
        }
        _getBridgePlaneHeight() {
            return this._getRenderHeight();
        }
        _getMinPerspectiveCameraZ(height) {
            const halfFov = Bridge3DScene3D._maxPerspectiveFieldOfView * Math.PI / 180 * 0.5;
            const tanHalfFov = Math.tan(halfFov);
            return tanHalfFov > 0 ? height * 0.5 / tanHalfFov : height;
        }
        _getEffectiveCameraZ(height) {
            if (this._orthographicCamera) {
                return this._cameraZDistance;
            }
            return Math.max(this._cameraZDistance, this._getMinPerspectiveCameraZ(height), this._sharedCamera.nearPlane + 0.0001);
        }
        _getPerspectiveFieldOfView(height, cameraZ) {
            return Math.atan(height * 0.5 / cameraZ) * 2 * 180 / Math.PI;
        }
        _updateCameraProjectionAndPosition() {
            if (this._updatingCameraProjection)
                return;
            this._updatingCameraProjection = true;
            try {
                const height = this._getRenderHeight();
                const width = this._getRenderWidth();
                const aspect = height > 0 ? width / height : 1;
                this._sharedCamera.aspectRatio = aspect;
                this._sharedCamera.orthographic = this._orthographicCamera;
                if (this._orthographicCamera) {
                    this._sharedCamera.orthographicVerticalSize = height;
                }
                else {
                    const cameraZ = this._getEffectiveCameraZ(height);
                    const fieldOfView = this._getPerspectiveFieldOfView(height, cameraZ);
                    if (Math.abs(this._sharedCamera.fieldOfView - fieldOfView) > 0.0001) {
                        this._sharedCamera.fieldOfView = fieldOfView;
                    }
                }
                this._updateCameraPosition(width, height);
                this._bridge3DContext.updateFromCamera(this._sharedCamera);
                this._bridge3DContext.setBridgeProjectionData(this._sharedCamera.sceneOffsetMatrix, this._getBridgePlaneWidth(), this._getBridgePlaneHeight());
            }
            finally {
                this._updatingCameraProjection = false;
            }
        }
        _updateCameraPosition(width = this._getRenderWidth(), height = this._getRenderHeight()) {
            const centerX = width / 2;
            const centerY = height / 2;
            let localPosition = this._sharedCamera.transform.localPosition;
            localPosition.x = centerX;
            localPosition.y = centerY;
            localPosition.z = this._getEffectiveCameraZ(height);
            this._sharedCamera.transform.localPosition = localPosition;
        }
        setupCamera() {
            this._sharedCamera.nearPlane = 0.1;
            this._updateCameraProjectionAndPosition();
            let rotationEuler = this._sharedCamera.transform.rotationEuler;
            rotationEuler.x = 0;
            rotationEuler.y = 0;
            rotationEuler.z = 0;
            this._sharedCamera.transform.rotationEuler = rotationEuler;
        }
        onStageResize() {
            this._updateCameraProjectionAndPosition();
        }
        renderSubmit() {
            if (this._renderByEditor)
                return;
            Laya.Scene3D._updateMark++;
            if (Laya.LayaEnv.isModernAPIs) {
                this._prepareLayaXActiveCameras();
            }
            this._prepareSceneToRender();
            this._sharedCamera.render(this);
        }
        _update() {
            var delta = this.timer.delta / 1000;
            this._time += delta;
            this._shaderValues.setNumber(Laya.Scene3D.TIME, this._time);
            this._componentDriver.callStart();
            this._componentDriver.callUpdate();
            this._componentDriver.callLateUpdate();
            this._componentDriver.callDestroy();
            if (this._volumeManager.needreCaculateAllRenderObjects())
                this._volumeManager.reCaculateAllRenderObjects(this._sceneRenderManager.list);
            else
                this._volumeManager.handleMotionlist();
            this.componentElementMap.forEach((value) => {
                value.update(delta);
            });
            const bridge3DList = this._holder.bridge3DList;
            for (let i = 0, l = bridge3DList.length; i < l; i++) {
                bridge3DList[i]._renderUpdate();
            }
        }
        destroy(destroyChild = true) {
            Laya.ILaya.stage.off(Laya.Event.RESIZE, this, this.onStageResize);
            this._renderToBridgeMap.clear();
            if (this._bridge3DLightTexture) {
                this._bridge3DLightTexture.destroy();
                this._bridge3DLightTexture = null;
            }
            if (this._bridge3DContext) {
                this._bridge3DContext.setSceneData(null);
                this._bridge3DContext.setCameraData(null);
                this._bridge3DContext.setGlobalShaderData(null);
                this._bridge3DContext.setSceneModuleData(null);
                this._bridge3DContext.setCameraModuleData(null);
                this._bridge3DContext.setBridge3DLightData(null, null);
                this._bridge3DContext = null;
            }
            this._sharedCamera.destroy();
            this._sharedCamera = null;
            this._holder = null;
            super.destroy(destroyChild);
        }
    }
    Bridge3DScene3D._maxPerspectiveFieldOfView = 90;

    class Bridge3DSceneInternal {
        constructor(scene) {
            this._scene3d = null;
            this._bridge3DList = [];
            this._isAddedToStage = false;
            this._offsetListenersHooked = false;
            this._updateSceneOffset = () => {
                if (!this._scene3d || !this._scene2D)
                    return;
                const cam = this._scene3d.sharedCamera;
                if (!cam)
                    return;
                const m = this._scene2D.globalTrans.getMatrix();
                const renderH = Laya.RenderState2D.height || Laya.ILaya.stage.height;
                const sceneH = this._scene2D.height || renderH;
                cam.setSceneOffsetFrom2DMatrix(m.a, m.b, m.c, m.d, m.tx, m.ty, renderH, sceneH);
                this._scene3d.updateContext();
            };
            this._onScene2DResize = () => {
                if (this._scene3d) {
                    this._scene3d.onStageResize();
                }
                this._updateSceneOffset();
                for (let i = 0, len = this._bridge3DList.length; i < len; i++) {
                    this._bridge3DList[i]._onScene2DResize();
                }
            };
            this._scene2D = scene;
        }
        _hookOffsetListeners() {
            if (this._offsetListenersHooked)
                return;
            this._scene2D.on(Laya.Event.TRANSFORM_CHANGED, this, this._updateSceneOffset);
            this._scene2D.on(Laya.Event.RESIZE, this, this._onScene2DResize);
            Laya.ILaya.stage.on(Laya.Event.RESIZE, this, this._updateSceneOffset);
            this._offsetListenersHooked = true;
        }
        _unhookOffsetListeners() {
            if (!this._offsetListenersHooked)
                return;
            this._scene2D && this._scene2D.off(Laya.Event.TRANSFORM_CHANGED, this, this._updateSceneOffset);
            this._scene2D && this._scene2D.off(Laya.Event.RESIZE, this, this._onScene2DResize);
            Laya.ILaya.stage && Laya.ILaya.stage.off(Laya.Event.RESIZE, this, this._updateSceneOffset);
            this._offsetListenersHooked = false;
        }
        _onAdded() {
            if (!this._isAddedToStage && this._bridge3DList.length > 0) {
                Laya.ILaya.stage.addChild(this._scene3d);
                this._isAddedToStage = true;
            }
        }
        _onRemoved() {
            if (this._scene3d && this._isAddedToStage) {
                Laya.ILaya.stage.removeChild(this._scene3d);
                this._isAddedToStage = false;
            }
        }
        get scene3d() {
            return this._scene3d;
        }
        get sharedCamera() {
            return this._scene3d ? this._scene3d.sharedCamera : null;
        }
        get bridge3DList() {
            return this._bridge3DList;
        }
        initScene3D() {
            if (!this._scene3d) {
                this._scene3d = new Bridge3DScene3D(this);
                this._scene3d._scene2D = this._scene2D;
                const holder = this._scene2D.bridge3D;
                if (holder) {
                    this._scene3d.applyCameraZDistance(holder.cameraZDistance);
                    this._scene3d.applyCameraFarPlane(holder.cameraFarPlane);
                    this._applySettingsTo(this._scene3d, holder.scene3dSettings);
                    this._applySettingsTo(this._scene3d.sharedCamera, holder.cameraSettings);
                    this._scene3d.applyOrthographicCamera(holder.orthographicCamera);
                }
                this._hookOffsetListeners();
                this._updateSceneOffset();
            }
            return this._scene3d;
        }
        _applySettingsTo(target, data) {
            if (!target || !data)
                return;
            for (const key in data) {
                const value = data[key];
                if (value == null)
                    continue;
                if (Bridge3DSceneInternal._readonlyKeys.has(key)) {
                    const existing = target[key];
                    if (existing != null && typeof value === 'object') {
                        this._applySettingsTo(existing, value);
                    }
                }
                else {
                    target[key] = value;
                }
            }
        }
        registerBridge3D(bridge) {
            if (this._bridge3DList.indexOf(bridge) !== -1) {
                return;
            }
            this._bridge3DList.push(bridge);
            const scene3d = this.initScene3D();
            if (bridge.containerSprite3D.parent !== scene3d) {
                bridge.containerSprite3D.removeSelf();
                scene3d.addChild(bridge.containerSprite3D);
                const element = bridge.bridge3DRenderElement;
                if (element) {
                    const process = scene3d.sharedCamera.bridge3DRenderProcess;
                    element.setBridge3DContext(scene3d.bridge3DContext);
                    element.setRenderProcess(process);
                    process.addBridgeElement(element);
                }
            }
            if (Laya.SerializeUtil.isDeserializing || !this._scene2D.displayedInStage)
                return;
            if (!this._isAddedToStage && this._bridge3DList.length > 0) {
                Laya.ILaya.stage.addChild(scene3d);
                this._isAddedToStage = true;
            }
        }
        unregisterBridge3D(bridge) {
            const index = this._bridge3DList.indexOf(bridge);
            if (index !== -1) {
                this._bridge3DList.splice(index, 1);
                if (this._scene3d) {
                    const element = bridge.bridge3DRenderElement;
                    if (element) {
                        this._scene3d.sharedCamera.bridge3DRenderProcess.removeBridgeElement(element);
                    }
                    this._scene3d.removeChild(bridge.containerSprite3D);
                }
            }
            if (this._isAddedToStage && this._bridge3DList.length === 0 && this._scene3d) {
                Laya.ILaya.stage.removeChild(this._scene3d);
                this._isAddedToStage = false;
            }
        }
        applyData(data) {
            if (!this._scene3d)
                return;
            if (data) {
                this._scene3d.applyCameraZDistance(data.cameraZDistance);
                this._scene3d.applyCameraFarPlane(data.cameraFarPlane);
                this._scene3d.applyOrthographicCamera(data.orthographicCamera);
                const s3d = data.scene3dSettings;
                if (s3d && !s3d._applyCache) {
                    this._applySettingsTo(this._scene3d, s3d);
                }
                const cam = data.cameraSettings;
                if (cam && !cam._applyCache) {
                    this._applySettingsTo(this._scene3d.sharedCamera, cam);
                }
                this._scene3d.applyOrthographicCamera(data.orthographicCamera);
            }
            else {
                this._scene3d.applyCameraZDistance(100);
                this._scene3d.applyCameraFarPlane(1000);
                this._scene3d.applyOrthographicCamera(true);
            }
        }
        finalizeSetup() {
            if (!this._scene3d)
                return;
            const holder = this._scene2D.bridge3D;
            if (holder) {
                this._scene3d.applyCameraZDistance(holder.cameraZDistance);
                this._scene3d.applyCameraFarPlane(holder.cameraFarPlane);
                this._applySettingsTo(this._scene3d, holder.scene3dSettings);
                this._applySettingsTo(this._scene3d.sharedCamera, holder.cameraSettings);
                this._scene3d.applyOrthographicCamera(holder.orthographicCamera);
            }
        }
        destroy() {
            this._unhookOffsetListeners();
            if (this._scene3d) {
                if (this._isAddedToStage) {
                    Laya.ILaya.stage.removeChild(this._scene3d);
                    this._isAddedToStage = false;
                }
                this._scene3d.destroy(false);
                this._scene3d = null;
            }
            this._bridge3DList.length = 0;
            this._scene2D = null;
        }
    }
    Bridge3DSceneInternal._readonlyKeys = new Set(["skyRenderer"]);

    class Bridge3DRenderElement {
        constructor() {
            this.type = 0;
            this.geometry = null;
            this.materialShaderData = null;
            this.value2DShaderData = null;
            this.globalShaderData = null;
            this.subShader = null;
            this.renderStateIsBySprite = true;
            this.stencilClipState = null;
            this.nodeCommonMap = [];
            this.owner = null;
            this._baseRenderList = new Laya.SingletonList();
            this._renderProcess = null;
            this._bridge3DContext = null;
            this._stencilRestoreList = [];
            this._opaqueList = new Laya.RenderListQueue(false);
            this._transparentList = new Laya.RenderListQueue(true);
        }
        addBaseRenderNode(node) {
            this._baseRenderList.add(node);
        }
        removeBaseRenderNode(node) {
            this._baseRenderList.remove(node);
        }
        setBridge3DContext(context) {
            this._bridge3DContext = context;
        }
        setRenderProcess(process) {
            this._renderProcess = process;
        }
        getBaseRenderList() {
            return this._baseRenderList;
        }
        getOpaqueList() {
            return this._opaqueList;
        }
        getTransparentList() {
            return this._transparentList;
        }
        get clearDepthBeforeRender() {
            var _a, _b;
            return (_b = (_a = this._bridge3DContext) === null || _a === void 0 ? void 0 : _a.clearDepthBeforeRender) !== null && _b !== void 0 ? _b : true;
        }
        set clearDepthBeforeRender(value) {
            if (this._bridge3DContext) {
                this._bridge3DContext.clearDepthBeforeRender = value;
            }
        }
        get bridge3DContext() {
            return this._bridge3DContext;
        }
        collectElements(context3d) {
            this._opaqueList.clear();
            this._transparentList.clear();
            for (let i = 0, l = this._baseRenderList.length; i < l; i++) {
                let renderNode = this._baseRenderList.elements[i];
                renderNode._renderUpdatePre(context3d);
                const elements = renderNode.renderelements;
                if (elements) {
                    for (let j = 0; j < elements.length; j++) {
                        const el = elements[j];
                        if (!el || !el.isRender)
                            continue;
                        if (el.materialRenderQueue > 2500) {
                            this._transparentList.addRenderElement(el);
                        }
                        else {
                            this._opaqueList.addRenderElement(el);
                        }
                    }
                }
            }
            this._opaqueList.sort();
            this._transparentList.sort();
            return -1;
        }
        applyStencilClipTo3DRenderStates() {
            this.restoreStencilClipTo3DRenderStates();
            const state = this.stencilClipState;
            if (!state || !state.enabled)
                return;
            this._applyStencilClipToQueue(this._opaqueList, state);
            this._applyStencilClipToQueue(this._transparentList, state);
        }
        restoreStencilClipTo3DRenderStates() {
            const restores = this._stencilRestoreList;
            for (let i = 0, n = restores.length; i < n; i++) {
                const item = restores[i];
                const shaderData = item.shaderData;
                const data = shaderData.getData();
                this._restoreShaderDataField(shaderData, data, Laya.Shader3D.STENCIL_TEST, item.hasStencilTest, item.stencilTest);
                this._restoreShaderDataField(shaderData, data, Laya.Shader3D.STENCIL_WRITE, item.hasStencilWrite, item.stencilWrite);
                this._restoreShaderDataField(shaderData, data, Laya.Shader3D.STENCIL_Ref, item.hasStencilRef, item.stencilRef);
                this._restoreShaderDataField(shaderData, data, Laya.Shader3D.STENCIL_READ_MASK, item.hasStencilReadMask, item.stencilReadMask);
                this._restoreShaderDataField(shaderData, data, Laya.Shader3D.STENCIL_WRITE_MASK, item.hasStencilWriteMask, item.stencilWriteMask);
                if (item.hasStencilOp) {
                    if (item.stencilOp)
                        shaderData.setVector3(Laya.Shader3D.STENCIL_Op, item.stencilOp);
                    else {
                        data[Laya.Shader3D.STENCIL_Op] = item.stencilOp;
                        shaderData._renderStateChanged = true;
                    }
                }
                else {
                    delete data[Laya.Shader3D.STENCIL_Op];
                    shaderData._renderStateChanged = true;
                }
            }
            restores.length = 0;
        }
        _applyStencilClipToQueue(queue, state) {
            const list = queue.elements;
            for (let i = 0, n = list.length; i < n; i++) {
                const element = list.elements[i];
                const shaderData = element && element.materialShaderData;
                if (shaderData)
                    this._applyStencilClipToShaderData(shaderData, state);
            }
        }
        _applyStencilClipToShaderData(shaderData, state) {
            const restores = this._stencilRestoreList;
            for (let i = 0, n = restores.length; i < n; i++) {
                if (restores[i].shaderData === shaderData)
                    return;
            }
            const data = shaderData.getData();
            const stencilOp = data[Laya.Shader3D.STENCIL_Op];
            restores.push({
                shaderData,
                hasStencilTest: Object.prototype.hasOwnProperty.call(data, Laya.Shader3D.STENCIL_TEST),
                stencilTest: data[Laya.Shader3D.STENCIL_TEST],
                hasStencilWrite: Object.prototype.hasOwnProperty.call(data, Laya.Shader3D.STENCIL_WRITE),
                stencilWrite: data[Laya.Shader3D.STENCIL_WRITE],
                hasStencilRef: Object.prototype.hasOwnProperty.call(data, Laya.Shader3D.STENCIL_Ref),
                stencilRef: data[Laya.Shader3D.STENCIL_Ref],
                hasStencilReadMask: Object.prototype.hasOwnProperty.call(data, Laya.Shader3D.STENCIL_READ_MASK),
                stencilReadMask: data[Laya.Shader3D.STENCIL_READ_MASK],
                hasStencilWriteMask: Object.prototype.hasOwnProperty.call(data, Laya.Shader3D.STENCIL_WRITE_MASK),
                stencilWriteMask: data[Laya.Shader3D.STENCIL_WRITE_MASK],
                hasStencilOp: Object.prototype.hasOwnProperty.call(data, Laya.Shader3D.STENCIL_Op),
                stencilOp: stencilOp ? new Laya.Vector3(stencilOp.x, stencilOp.y, stencilOp.z) : null
            });
            shaderData.setInt(Laya.Shader3D.STENCIL_TEST, state.test);
            shaderData.setBool(Laya.Shader3D.STENCIL_WRITE, false);
            shaderData.setInt(Laya.Shader3D.STENCIL_Ref, state.ref);
            shaderData.setInt(Laya.Shader3D.STENCIL_READ_MASK, state.readMask);
            shaderData.setInt(Laya.Shader3D.STENCIL_WRITE_MASK, 0x00);
            shaderData.setVector3(Laya.Shader3D.STENCIL_Op, Bridge3DRenderElement._stencilKeepOp);
        }
        _restoreShaderDataField(shaderData, data, index, hasValue, value) {
            if (hasValue)
                data[index] = value;
            else
                delete data[index];
            shaderData._renderStateChanged = true;
        }
        _prepare(context) {
        }
        _render(context) {
            if (!this._renderProcess || !this._bridge3DContext || !this._bridge3DContext.sceneData || !this._bridge3DContext.cameraData) {
                return;
            }
            let context3d = Laya.RenderContext3D._instance._contextOBJ;
            this._renderProcess.render(this, context, context3d);
        }
        destroy() {
            var _a, _b;
            (_a = this._opaqueList) === null || _a === void 0 ? void 0 : _a.destroy();
            (_b = this._transparentList) === null || _b === void 0 ? void 0 : _b.destroy();
            this._opaqueList = null;
            this._transparentList = null;
            this._bridge3DContext = null;
            this._renderProcess = null;
            this._stencilRestoreList.length = 0;
            this.stencilClipState = null;
            this.owner = null;
            this.geometry = null;
            this.materialShaderData = null;
            this.value2DShaderData = null;
            this.globalShaderData = null;
            this.subShader = null;
        }
    }
    Bridge3DRenderElement._stencilKeepOp = new Laya.Vector3(Laya.RenderState.STENCILOP_KEEP, Laya.RenderState.STENCILOP_KEEP, Laya.RenderState.STENCILOP_KEEP);

    class LayaXBridge3DRenderElement {
        set geometry(v) {
            this._geometry = v;
            this._nativeObj.setGeometry(v ? v._nativeObj : null);
        }
        get geometry() {
            return this._geometry;
        }
        constructor() {
            this.type = 0;
            this._geometry = null;
            this.materialShaderData = null;
            this.value2DShaderData = null;
            this.globalShaderData = null;
            this.subShader = null;
            this.renderStateIsBySprite = true;
            this.nodeCommonMap = [];
            this._renderProcess = null;
            this._owner = null;
            this._baseRenderList = new Laya.SingletonList();
            this._bridge3DContext = null;
            this._context3dNative = null;
            this._nativeObj = new window.conchLayaXBridge3DElement2D();
            this._opaqueList = new Laya.RenderListQueue(false);
            this._transparentList = new Laya.RenderListQueue(true);
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            this._owner = value;
            this._nativeObj.setOwner(value ? value._nativeObj : null);
        }
        addBaseRenderNode(node) {
            this._baseRenderList.add(node);
            this._nativeObj.addBaseRenderNode(node._nativeObj);
        }
        removeBaseRenderNode(node) {
            this._baseRenderList.remove(node);
            this._nativeObj.removeBaseRenderNode(node._nativeObj);
        }
        setBridge3DContext(context) {
            if (context instanceof LayaXBridge3DContext) {
                if (this._bridge3DContext !== context) {
                    this._bridge3DContext = context;
                    this._nativeObj.setBridge3DContext(context._nativeObj);
                }
            }
        }
        setRenderProcess(process) {
            this._renderProcess = process;
            this._nativeObj.setRenderProcess(process ? process._nativeObj : null);
        }
        setContext3D(context3d) {
            const native = context3d ? context3d._nativeObj : null;
            if (this._context3dNative === native)
                return;
            this._context3dNative = native;
            this._nativeObj.setContext3D(native);
        }
        getBaseRenderList() {
            return this._baseRenderList;
        }
        getOpaqueList() {
            return this._opaqueList;
        }
        getTransparentList() {
            return this._transparentList;
        }
        get bridge3DContext() {
            return this._bridge3DContext;
        }
        collectElements(context3d) {
            return this._nativeObj.collectFromNodes();
        }
        _prepare(context) {
        }
        _render(context) {
        }
        destroy() {
            var _a, _b, _c;
            (_a = this._opaqueList) === null || _a === void 0 ? void 0 : _a.destroy();
            (_b = this._transparentList) === null || _b === void 0 ? void 0 : _b.destroy();
            this._opaqueList = null;
            this._transparentList = null;
            this._bridge3DContext = null;
            this._renderProcess = null;
            this._owner = null;
            this.geometry = null;
            this.materialShaderData = null;
            this.value2DShaderData = null;
            this.globalShaderData = null;
            this.subShader = null;
            (_c = this._nativeObj) === null || _c === void 0 ? void 0 : _c.destroy();
            this._nativeObj = null;
        }
    }

    class RTBridge3DRenderElement {
        set geometry(v) {
            this._geometry = v;
            this._nativeObj.setGeometry(v ? v._nativeObj : null);
        }
        get geometry() {
            return this._geometry;
        }
        constructor() {
            this.type = 0;
            this._geometry = null;
            this.materialShaderData = null;
            this.value2DShaderData = null;
            this.globalShaderData = null;
            this.subShader = null;
            this.renderStateIsBySprite = true;
            this.nodeCommonMap = [];
            this._renderProcess = null;
            this._owner = null;
            this._baseRenderList = new Laya.SingletonList();
            this._bridge3DContext = null;
            this._nativeObj = new window.conchGLESBridge3DRenderElement2D();
            this._opaqueList = new Laya.RenderListQueue(false);
            this._transparentList = new Laya.RenderListQueue(true);
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            this._owner = value;
            this._nativeObj.setOwner(value ? value._nativeObj : null);
        }
        addBaseRenderNode(node) {
            this._baseRenderList.add(node);
            this._nativeObj.addBaseRenderNode(node._nativeObj);
        }
        removeBaseRenderNode(node) {
            this._baseRenderList.remove(node);
            this._nativeObj.removeBaseRenderNode(node._nativeObj);
        }
        setBridge3DContext(context) {
            if (context instanceof RTBridge3DContext) {
                if (this._bridge3DContext !== context) {
                    this._bridge3DContext = context;
                    this._nativeObj.setBridge3DContext(context._nativeObj);
                }
            }
        }
        setRenderProcess(process) {
            this._renderProcess = process;
            this._nativeObj.setRenderProcess(process ? process._nativeObj : null);
        }
        getBaseRenderList() {
            return this._baseRenderList;
        }
        getOpaqueList() {
            return this._opaqueList;
        }
        getTransparentList() {
            return this._transparentList;
        }
        get bridge3DContext() {
            return this._bridge3DContext;
        }
        collectElements(context3d) {
            return this._nativeObj.collectFromNodes(context3d._nativeObj);
        }
        _prepare(context) {
        }
        _render(context) {
        }
        destroy() {
            var _a, _b, _c;
            (_a = this._opaqueList) === null || _a === void 0 ? void 0 : _a.destroy();
            (_b = this._transparentList) === null || _b === void 0 ? void 0 : _b.destroy();
            this._opaqueList = null;
            this._transparentList = null;
            this._bridge3DContext = null;
            this._renderProcess = null;
            this._owner = null;
            this.geometry = null;
            this.materialShaderData = null;
            this.value2DShaderData = null;
            this.globalShaderData = null;
            this.subShader = null;
            (_c = this._nativeObj) === null || _c === void 0 ? void 0 : _c.destroy();
            this._nativeObj = null;
        }
    }

    class Bridge3DSprite extends Laya.Sprite {
        static createBridge3DRenderElement() {
            if (Laya.LayaEnv.isModernAPIs) {
                return new LayaXBridge3DRenderElement();
            }
            else if (Laya.LayaEnv.isConch && window.conchConfig.getGraphicsAPI() != 2) {
                return new RTBridge3DRenderElement();
            }
            else {
                return new Bridge3DRenderElement();
            }
        }
        constructor() {
            super();
            this._isRegistered = false;
            this._boundsDirty = true;
            this._list = new Laya.SingletonList();
            this._ppu = Bridge3DSprite.defaultPixelsPerUnit;
            this._bounds3D = new Laya.Bounds(new Laya.Vector3(), new Laya.Vector3());
            this._bounds2DRect = new Laya.Rectangle();
            this._containerSprite3D = new BridgeContainerSprite3D();
            this._containerSprite3D.active = false;
            this._containerSprite3D.name = "Bridge3DContainer";
            this._containerSprite3D._ownerBridge = this;
            this._setContainer(this._containerSprite3D);
            this._bridge3DRenderElement = Bridge3DSprite.createBridge3DRenderElement();
            this._bridge3DRenderElement.owner = this._struct;
            this._bridge3DRenderElement.geometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(0, 0);
            this._struct.renderElements = [this._bridge3DRenderElement];
            this._initShaderData();
            const emptyHandle = Laya.LayaGL.render2DRenderPassFactory.createEmptyRenderDataHandle();
            if (emptyHandle) {
                this._struct.renderDataHandler = emptyHandle;
                emptyHandle.needUseMatrix = false;
            }
        }
        get containerSprite3D() {
            return this._containerSprite3D;
        }
        get transform3D() {
            return this._containerSprite3D.transform;
        }
        get pixelsPerUnit() {
            return this._ppu;
        }
        set pixelsPerUnit(value) {
            if (value <= 0) {
                throw new Error("scale3DToPixel must be greater than 0");
            }
            if (this._ppu !== value) {
                this._ppu = value;
                this._syncTransform2DTo3D();
            }
        }
        addChild(node) {
            if (!node) {
                throw new Error("node cannot be null or undefined");
            }
            if (!(node instanceof Laya.Sprite3D)) {
                throw new Error("Bridge3DSprite can only add Sprite3D children, not 2D nodes");
            }
            return super.addChild(node);
        }
        _setBelongScene(scene) {
            super._setBelongScene(scene);
            this._regsiterScene();
        }
        _setUnBelongScene() {
            this._removeRegister();
            super._setUnBelongScene();
        }
        _onAdded() {
            this.on(Laya.Event.TRANSFORM_CHANGED, this, this._syncTransform2DTo3D);
            super._onAdded();
        }
        _onActive() {
            super._onActive();
            this._containerSprite3D.active = true;
        }
        _onInActive() {
            this._containerSprite3D.active = false;
            super._onInActive();
        }
        _regsiterScene() {
            if (!this._scene)
                return;
            this._scene._bridge3DInternal.registerBridge3D(this);
            this._isRegistered = true;
        }
        _removeRegister() {
            if (!this._scene || !this._isRegistered)
                return;
            this._scene._bridge3DInternal.unregisterBridge3D(this);
            this._isRegistered = false;
        }
        _onRemoved() {
            this.off(Laya.Event.TRANSFORM_CHANGED, this, this._syncTransform2DTo3D);
            super._onRemoved();
        }
        _setParent(value, index) {
            super._setParent(value, index);
            if (value) {
                this._syncTransform2DTo3D();
            }
        }
        _transChanged(flag) {
            super._transChanged(flag);
            this._syncTransform2DTo3D();
        }
        _computeSceneLocalMatrix(out) {
            const selfGlobal = this.globalTrans.getMatrix();
            const scene = this._scene;
            if (!scene) {
                selfGlobal.copyTo(out);
                return out;
            }
            const sceneInv = Bridge3DSprite._tmpSceneInv;
            scene.globalTrans.getMatrixInv(sceneInv);
            Laya.Matrix.mul(selfGlobal, sceneInv, out);
            return out;
        }
        _getSceneHeight() {
            const scene = this._scene;
            return scene && scene.height ? scene.height : Laya.RenderState2D.height;
        }
        _syncTransform2DTo3D() {
            const transform = this._containerSprite3D.transform;
            const sceneLocalMatrix = this._computeSceneLocalMatrix(Bridge3DSprite._tmpSceneLocal);
            const a = sceneLocalMatrix.a;
            const b = sceneLocalMatrix.b;
            const c = sceneLocalMatrix.c;
            const d = sceneLocalMatrix.d;
            const tx = sceneLocalMatrix.tx;
            const ty = sceneLocalMatrix.ty;
            const scale = this._ppu;
            const pos3D = Laya.Vector3.TEMP;
            const sceneH = this._getSceneHeight();
            pos3D.x = tx;
            pos3D.y = sceneH - ty;
            pos3D.z = 0;
            const matrix = transform.localMatrix;
            const e = matrix.elements;
            e[0] = a * scale;
            e[1] = -b * scale;
            e[2] = 0;
            e[3] = 0;
            e[4] = -c * scale;
            e[5] = d * scale;
            e[6] = 0;
            e[7] = 0;
            e[8] = 0;
            e[9] = 0;
            e[10] = scale;
            e[11] = 0;
            e[12] = pos3D.x;
            e[13] = pos3D.y;
            e[14] = pos3D.z;
            e[15] = 1;
            transform.localMatrix = matrix;
            this._markBoundsDirty();
        }
        _onScene2DResize() {
            this._syncTransform2DTo3D();
        }
        _addRenderObject(render) {
            this._list.add(render);
            this._bridge3DRenderElement.addBaseRenderNode(render.renderNode);
            this._markBoundsDirty();
        }
        _removeRenderObject(render) {
            this._list.remove(render);
            this._bridge3DRenderElement.removeBaseRenderNode(render.renderNode);
            this._markBoundsDirty();
        }
        _renderUpdate() {
            let context = Laya.RenderContext3D._instance;
            let elements = this._list.elements;
            for (let i = 0, len = this._list.length; i < len; i++) {
                elements[i].renderUpdate(context);
            }
        }
        get3DBounds() {
            if (this._boundsDirty)
                this._updateBounds();
            return this._bounds3D;
        }
        _markBoundsDirty() {
            this._boundsDirty = true;
        }
        _updateBounds() {
            const elements = this._list.elements;
            const len = this._list.length;
            if (len === 0) {
                this._bounds3D.min = _boundsTemp0;
                this._bounds3D.max = _boundsTemp1;
            }
            else {
                elements[0].bounds.cloneTo(this._bounds3D);
                for (let i = 1; i < len; i++) {
                    Laya.Bounds.merge(this._bounds3D, elements[i].bounds, this._bounds3D);
                }
            }
            this._project3DTo2D();
            this._boundsDirty = false;
        }
        _project3DTo2D() {
            const min3D = this._bounds3D.min;
            const max3D = this._bounds3D.max;
            const sceneH = this._getSceneHeight();
            const scene = this._scene;
            const projectCorner = (wx, wy, p) => {
                p.setTo(wx, sceneH - wy);
                if (scene) {
                    scene.localToGlobal(p);
                }
                this.globalToLocal(p);
            };
            const p = _boundsPoint;
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            projectCorner(min3D.x, min3D.y, p);
            if (p.x < minX)
                minX = p.x;
            if (p.x > maxX)
                maxX = p.x;
            if (p.y < minY)
                minY = p.y;
            if (p.y > maxY)
                maxY = p.y;
            projectCorner(max3D.x, min3D.y, p);
            if (p.x < minX)
                minX = p.x;
            if (p.x > maxX)
                maxX = p.x;
            if (p.y < minY)
                minY = p.y;
            if (p.y > maxY)
                maxY = p.y;
            projectCorner(min3D.x, max3D.y, p);
            if (p.x < minX)
                minX = p.x;
            if (p.x > maxX)
                maxX = p.x;
            if (p.y < minY)
                minY = p.y;
            if (p.y > maxY)
                maxY = p.y;
            projectCorner(max3D.x, max3D.y, p);
            if (p.x < minX)
                minX = p.x;
            if (p.x > maxX)
                maxX = p.x;
            if (p.y < minY)
                minY = p.y;
            if (p.y > maxY)
                maxY = p.y;
            this._bounds2DRect.setTo(minX, minY, maxX - minX, maxY - minY);
        }
        getGraphicBounds(realSize, out) {
            if (this._boundsDirty)
                this._updateBounds();
            return this._bounds2DRect.clone(out);
        }
        onDestroy() {
            this._removeRegister();
            this._list.length = 0;
            this._bounds3D = null;
            this._bounds2DRect = null;
            if (this._bridge3DRenderElement) {
                this._bridge3DRenderElement.destroy();
                this._bridge3DRenderElement = null;
            }
            if (this._containerSprite3D) {
                this._containerSprite3D.destroy();
                this._containerSprite3D = null;
            }
            super.onDestroy();
        }
        get bridge3DRenderElement() {
            return this._bridge3DRenderElement;
        }
        _child3dChanged(child) {
        }
    }
    Bridge3DSprite.defaultPixelsPerUnit = 10;
    Bridge3DSprite._tmpSceneLocal = new Laya.Matrix();
    Bridge3DSprite._tmpSceneInv = new Laya.Matrix();
    class BridgeContainerSprite3D extends Laya.Sprite3D {
        _childChanged(child) {
            super._childChanged(child);
            this._ownerBridge._child3dChanged(child);
        }
    }
    const _boundsTemp0 = new Laya.Vector3();
    const _boundsTemp1 = new Laya.Vector3();
    const _boundsPoint = new Laya.Point();

    let c = Laya.ClassUtils.regClass;
    c('Bridge3DCamera', Bridge3DCamera);
    c('Bridge3DScene3D', Bridge3DScene3D);
    c('Bridge3DSprite', Bridge3DSprite);
    c('Bridge3DData', Bridge3DData);
    Laya.Scene.bridge3DInternalHandler = (scene) => new Bridge3DSceneInternal(scene);
    Laya.Config.isDepth = true;
    Laya.Laya.addInitCallback(() => {
        Bridge3DCamera.__init__();
    });

    class Bridge3DCoordinate {
        static logicTo3D(x, y, z = 0, out, sceneHeight = Laya.RenderState2D.height) {
            if (!out) {
                out = new Laya.Vector3();
            }
            out.x = x;
            out.y = sceneHeight - y;
            out.z = z;
            return out;
        }
        static worldTo2D(worldPos, sceneHeight = Laya.RenderState2D.height) {
            return {
                x: worldPos.x,
                y: sceneHeight - worldPos.y
            };
        }
        static getScale() {
            const stage = Laya.ILaya.stage;
            return {
                scaleX: stage.scaleX,
                scaleY: stage.scaleY
            };
        }
        static getRenderInfo() {
            const stage = Laya.ILaya.stage;
            return {
                logicWidth: stage.width,
                logicHeight: stage.height,
                renderWidth: Laya.RenderState2D.width,
                renderHeight: Laya.RenderState2D.height,
                scaleX: stage.scaleX,
                scaleY: stage.scaleY
            };
        }
        static screenTo3D(screenX, screenY, camera, depth = 0, out) {
            if (!out) {
                out = new Laya.Vector3();
            }
            const renderWidth = Laya.RenderState2D.width;
            const renderHeight = Laya.RenderState2D.height;
            const ndcX = (screenX / renderWidth) * 2 - 1;
            const ndcY = 1 - (screenY / renderHeight) * 2;
            const cameraPos = camera.transform.position;
            if (camera.orthographic) {
                const halfHeight = camera.orthographicVerticalSize * 0.5;
                const halfWidth = halfHeight * camera.aspectRatio;
                out.x = cameraPos.x + ndcX * halfWidth;
                out.y = cameraPos.y + ndcY * halfHeight;
                out.z = depth;
            }
            else {
                const distance = cameraPos.z - depth;
                if (distance <= 0) {
                    return out;
                }
                const halfFov = camera.fieldOfView * Math.PI / 180 * 0.5;
                const halfHeight = Math.tan(halfFov) * distance;
                const halfWidth = halfHeight * camera.aspectRatio;
                out.x = cameraPos.x + ndcX * halfWidth;
                out.y = cameraPos.y + ndcY * halfHeight;
                out.z = depth;
            }
            const bridgeCamera = camera;
            if (bridgeCamera.sceneOffsetMatrix && !bridgeCamera.sceneOffsetIsIdentity) {
                bridgeCamera.sceneOffsetMatrix.invert(Bridge3DCoordinate._tmpInvOffset);
                Bridge3DCoordinate._tmpScreenPoint.x = out.x;
                Bridge3DCoordinate._tmpScreenPoint.y = out.y;
                Bridge3DCoordinate._tmpScreenPoint.z = out.z;
                Laya.Vector3.transformCoordinate(Bridge3DCoordinate._tmpScreenPoint, Bridge3DCoordinate._tmpInvOffset, out);
            }
            return out;
        }
        static debugInfo() {
            const info = Bridge3DCoordinate.getRenderInfo();
            console.log("=== Bridge3D Coordinate System Info ===");
            console.log(`Logic Size: ${info.logicWidth} x ${info.logicHeight}`);
            console.log(`Render Size: ${info.renderWidth} x ${info.renderHeight}`);
            console.log(`Scale: ${info.scaleX.toFixed(3)} x ${info.scaleY.toFixed(3)}`);
            console.log("=======================================");
        }
    }
    Bridge3DCoordinate._tmpInvOffset = new Laya.Matrix4x4();
    Bridge3DCoordinate._tmpScreenPoint = new Laya.Vector3();

    exports.Bridge3DCamera = Bridge3DCamera;
    exports.Bridge3DContext = Bridge3DContext;
    exports.Bridge3DCoordinate = Bridge3DCoordinate;
    exports.Bridge3DData = Bridge3DData;
    exports.Bridge3DRenderElement = Bridge3DRenderElement;
    exports.Bridge3DScene3D = Bridge3DScene3D;
    exports.Bridge3DSceneInternal = Bridge3DSceneInternal;
    exports.Bridge3DSprite = Bridge3DSprite;
    exports.LayaXBridge3DContext = LayaXBridge3DContext;
    exports.LayaXBridge3DRenderElement = LayaXBridge3DRenderElement;
    exports.LayaXBridge3DRenderProcess = LayaXBridge3DRenderProcess;
    exports.RTBridge3DContext = RTBridge3DContext;
    exports.RTBridge3DRenderElement = RTBridge3DRenderElement;
    exports.RTBridge3DRenderProcess = RTBridge3DRenderProcess;
    exports.WebBridge3DRenderProcess = WebBridge3DRenderProcess;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.bridge.js.map
