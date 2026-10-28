(function (exports, Laya) {
    'use strict';

    class Physics2DOption {
    }
    Physics2DOption.allowSleeping = false;
    Physics2DOption.gravity = { x: 0, y: 9.8 };
    Physics2DOption.customUpdate = false;
    Physics2DOption.velocityIterations = 8;
    Physics2DOption.positionIterations = 3;
    Physics2DOption.pixelRatio = 50;
    Physics2DOption.debugDraw = true;
    Physics2DOption.drawShape = true;
    Physics2DOption.drawJoint = true;
    Physics2DOption.drawAABB = false;
    Physics2DOption.drawCenterOfMass = false;
    Physics2DOption.subStep = 1;

    var PhysicsLineFs = "#define SHADER_NAME PhysicsLineFS\n#include \"Sprite2DFrag.glsl\"\nvarying vec2 v_position;varying vec4 v_linePionts;varying float v_lineLength;varying vec2 v_linedir;varying float v_lineWidth;vec2 dotToline(in vec2 a,vec2 b,in vec2 p){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return ba*h+a;}void main(){vec2 p=dotToline(v_linePionts.xy,v_linePionts.zw,v_position);float d=v_lineWidth*0.5-length(p-v_position);vec2 left=v_linePionts.xy-v_linedir;vec2 p1=dotToline(left,v_linePionts.zw+v_linedir,v_position);vec2 uv=transformUV(v_texcoord.xy,u_TilingOffset);vec4 textureColor=texture2D(u_baseRender2DTexture,fract(uv));textureColor=transspaceColor(textureColor*u_baseRenderColor);gl_FragColor=vec4(u_baseRenderColor.rgb,textureColor.a*smoothstep(0.0,2.0,d));}";

    var PhysicsLineVs = "#define SHADER_NAME PhysicsLineVS\n#include \"Sprite2DVertex.glsl\"\nvarying vec2 v_position;varying vec4 v_linePionts;varying float v_lineLength;varying vec2 v_linedir;varying float v_lineWidth;void lineMat(in vec2 left,in vec2 right,inout vec3 xDir,inout vec3 yDir,float LineWidth){vec2 dir=right-left;float lineLength=length(dir)+LineWidth+2.0;dir=normalize(dir);xDir.x=dir.x*lineLength;yDir.x=dir.y*lineLength;float lineWidth=LineWidth+2.0;xDir.y=-dir.y*LineWidth;yDir.y=dir.x*LineWidth;xDir.z=(left.x+right.x)*0.5;yDir.z=(left.y+right.y)*0.5;}void main(){vec2 oriUV=(a_position.xy+vec2(0.5,0.5));oriUV.x=(oriUV.x*length(a_linePos.xy-a_linePos.zw)+a_linelength)/50.0;v_texcoord=oriUV;vec2 left,right;getGlobalPos(a_linePos.xy,left);getGlobalPos(a_linePos.zw,right);float lengthScale=length(right-left)/length(a_linePos.zw-a_linePos.xy);v_lineLength=a_linelength*lengthScale;v_linePionts=vec4(left,right);float lineWidth=u_lineWidth*lengthScale;v_lineWidth=lineWidth;v_linedir=normalize(right-left)*v_lineWidth*0.5;vec3 xDir;vec3 yDir;lineMat(left,right,xDir,yDir,v_lineWidth);transfrom(a_position.xy,xDir,yDir,v_position);vec2 viewPos;getViewPos(v_position,viewPos);clip(viewPos);vec4 pos;getProjectPos(viewPos,pos);gl_Position=pos;}";

    class PhysicsLineShader {
        static __init__() {
            if (PhysicsLineShader._isInit)
                return;
            PhysicsLineShader._isInit = true;
            let attributeMap = {
                'a_position': [0, Laya.ShaderDataType.Vector3],
                'a_linePos': [2, Laya.ShaderDataType.Vector4],
                "a_linelength": [3, Laya.ShaderDataType.Float],
            };
            let uniformMap = {
                u_lineWidth: Laya.ShaderDataType.Float,
                u_TilingOffset: Laya.ShaderDataType.Vector4,
            };
            let shader = Laya.Shader3D.add("PhysicsLineShader", true, false);
            shader.shaderType = Laya.ShaderFeatureType.D2_BaseRenderNode2D;
            let subShader = new Laya.SubShader(attributeMap, uniformMap, {});
            shader.addSubShader(subShader);
            subShader.addShaderPass(PhysicsLineVs, PhysicsLineFs);
            PhysicsLineShader.LINEWIDTH = Laya.Shader3D.propertyNameToID("u_lineWidth");
            PhysicsLineShader.TILINGOFFSET = Laya.Shader3D.propertyNameToID("u_TilingOffset");
            let vertexs = new Float32Array([
                -0.5, -0.5, 0,
                0.5, -0.5, 0,
                0.5, 0.5, 0,
                -0.5, 0.5, 0
            ]);
            let index = new Uint16Array([0, 1, 2, 0, 2, 3]);
            var declaration = new Laya.VertexDeclaration(12, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector3, 0),
            ]);
            let vertex = PhysicsLineShader._vbs = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
            vertex.vertexDeclaration = declaration;
            vertex.instanceBuffer = false;
            vertex.setDataLength(vertexs.byteLength);
            vertex.setData(vertexs.buffer, 0, 0, vertexs.byteLength);
            let ibs = PhysicsLineShader._ibs = Laya.LayaGL.renderDeviceFactory.createIndexBuffer(Laya.BufferUsage.Dynamic);
            ibs._setIndexDataLength(index.buffer.byteLength);
            ibs._setIndexData(index, 0);
            PhysicsLineShader.linePoisitionDesc = new Laya.VertexDeclaration(16, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 2),
            ]);
            PhysicsLineShader.lineLengthDesc = new Laya.VertexDeclaration(4, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Single, 3),
            ]);
        }
    }
    PhysicsLineShader._isInit = false;

    class Physics2D extends Laya.EventDispatcher {
        static get I() {
            return Physics2D._I || (Physics2D._I = new Physics2D());
        }
        _addRigidBody(body) {
            this._rigiBodyList.add(body);
        }
        _removeRigidBody(body) {
            this._rigiBodyList.remove(body);
        }
        _update() {
            const deltaMs = Laya.ILaya.timer.delta;
            if (!Number.isFinite(deltaMs))
                return;
            this.update(Math.min(deltaMs / 1000, 0.033));
        }
        update(deltaTime) {
            if (!Number.isFinite(deltaTime))
                throw new Error("Physics2D.update: deltaTime must be a finite number.");
            if (!this._factory || !this._rigiBodyList)
                return;
            this._factory.update(deltaTime);
            this._updatePhysicsTransformToRender();
        }
        _updatePhysicsTransformToRender() {
            for (var i = 0, n = this._rigiBodyList.length; i < n; i++) {
                this._rigiBodyList.elements[i]._updatePhysicsTransformToRender();
            }
        }
        enable() {
            if (this._factory) {
                PhysicsLineShader.__init__();
                if (Laya.PlayerConfig.physics2D != null && Laya.PlayerConfig.physics2D.defaultConfig != null)
                    Object.assign(Physics2DOption, Laya.PlayerConfig.physics2D.defaultConfig);
                return this._factory.initialize().then(() => {
                    this.start();
                    return Promise.resolve();
                });
            }
            else
                return Promise.resolve();
        }
        start() {
            if (!this._enabled) {
                this._enabled = true;
            }
            if (!this._rigiBodyList)
                this._rigiBodyList = new Laya.SingletonList();
            if (!Physics2DOption.customUpdate && Laya.LayaEnv.isPlaying)
                Laya.ILaya.physicsTimer.frameLoop(1, this, this._update);
        }
        destroyWorld() {
            this._enabled = false;
            Laya.ILaya.physicsTimer.clear(this, this._update);
        }
        stop() {
            Laya.ILaya.physicsTimer.clear(this, this._update);
        }
        static toPhysicsX(v) { return v / Laya.ILaya.stage.clientScaleX; }
        static toPhysicsY(v) { return v / Laya.ILaya.stage.clientScaleY; }
        static toRenderX(v) { return v * Laya.ILaya.stage.clientScaleX; }
        static toRenderY(v) { return v * Laya.ILaya.stage.clientScaleY; }
        static getDesignScaleX(sprite) {
            let scale = 1;
            let node = sprite;
            while (node && node !== Laya.ILaya.stage) {
                scale *= node.scaleX;
                node = node.parent instanceof Laya.Sprite ? node.parent : null;
            }
            return scale;
        }
        static getDesignScaleY(sprite) {
            let scale = 1;
            let node = sprite;
            while (node && node !== Laya.ILaya.stage) {
                scale *= node.scaleY;
                node = node.parent instanceof Laya.Sprite ? node.parent : null;
            }
            return scale;
        }
        static getDesignRotation(sprite) {
            let rotation = 0;
            let node = sprite;
            while (node && node !== Laya.ILaya.stage) {
                rotation += node.rotation;
                node = node.parent instanceof Laya.Sprite ? node.parent : null;
            }
            return rotation;
        }
        static setDesignRotation(sprite, rotation) {
            let parentRotation = 0;
            let node = sprite.parent instanceof Laya.Sprite ? sprite.parent : null;
            while (node && node !== Laya.ILaya.stage) {
                parentRotation += node.rotation;
                node = node.parent instanceof Laya.Sprite ? node.parent : null;
            }
            sprite.rotation = rotation - parentRotation;
        }
        static getDesignPosition(sprite, out) {
            out.setTo(sprite.pivotX, sprite.pivotY);
            return sprite.localToGlobal(out);
        }
        static setDesignPosition(sprite, x, y, out) {
            out.setTo(x, y);
            const parent = sprite.parent;
            if (parent instanceof Laya.Sprite)
                parent.globalToLocal(out);
            sprite.pos(out.x, out.y);
        }
        static localToDesignPoint(sprite, x, y, out) {
            out.setTo(sprite.pivotX + x, sprite.pivotY + y);
            return sprite.localToGlobal(out);
        }
        static designToLocalPoint(sprite, x, y, out) {
            out.setTo(x, y);
            sprite.globalToLocal(out);
            out.x -= sprite.pivotX;
            out.y -= sprite.pivotY;
            return out;
        }
    }
    Laya.Laya.addInitCallback(() => Physics2D.I.enable());

    exports.EPhycis2DBlit = void 0;
    (function (EPhycis2DBlit) {
        EPhycis2DBlit[EPhycis2DBlit["None"] = 0] = "None";
        EPhycis2DBlit[EPhycis2DBlit["Shape"] = 1] = "Shape";
        EPhycis2DBlit[EPhycis2DBlit["Joint"] = 2] = "Joint";
        EPhycis2DBlit[EPhycis2DBlit["AABB"] = 4] = "AABB";
        EPhycis2DBlit[EPhycis2DBlit["Pair"] = 8] = "Pair";
        EPhycis2DBlit[EPhycis2DBlit["CenterOfMass"] = 16] = "CenterOfMass";
        EPhycis2DBlit[EPhycis2DBlit["All"] = 31] = "All";
    })(exports.EPhycis2DBlit || (exports.EPhycis2DBlit = {}));
    exports.EPhysics2DJoint = void 0;
    (function (EPhysics2DJoint) {
        EPhysics2DJoint[EPhysics2DJoint["DistanceJoint"] = 0] = "DistanceJoint";
        EPhysics2DJoint[EPhysics2DJoint["RevoluteJoint"] = 1] = "RevoluteJoint";
        EPhysics2DJoint[EPhysics2DJoint["GearJoint"] = 2] = "GearJoint";
        EPhysics2DJoint[EPhysics2DJoint["PulleyJoint"] = 3] = "PulleyJoint";
        EPhysics2DJoint[EPhysics2DJoint["WheelJoint"] = 4] = "WheelJoint";
        EPhysics2DJoint[EPhysics2DJoint["WeldJoint"] = 5] = "WeldJoint";
        EPhysics2DJoint[EPhysics2DJoint["MouseJoint"] = 6] = "MouseJoint";
        EPhysics2DJoint[EPhysics2DJoint["MotorJoint"] = 7] = "MotorJoint";
        EPhysics2DJoint[EPhysics2DJoint["PrismaticJoint"] = 8] = "PrismaticJoint";
    })(exports.EPhysics2DJoint || (exports.EPhysics2DJoint = {}));
    exports.EPhysics2DShape = void 0;
    (function (EPhysics2DShape) {
        EPhysics2DShape[EPhysics2DShape["BoxShape"] = 0] = "BoxShape";
        EPhysics2DShape[EPhysics2DShape["CircleShape"] = 1] = "CircleShape";
        EPhysics2DShape[EPhysics2DShape["PolygonShape"] = 2] = "PolygonShape";
        EPhysics2DShape[EPhysics2DShape["ChainShape"] = 3] = "ChainShape";
        EPhysics2DShape[EPhysics2DShape["EdgeShape"] = 4] = "EdgeShape";
    })(exports.EPhysics2DShape || (exports.EPhysics2DShape = {}));
    class Physics2DContactHitResult {
        constructor() {
            this.normal = { x: 0, y: 0 };
            this.points = [];
            this.separations = [];
        }
    }
    class Physics2DHitResult {
        constructor() {
            this.hitPoint = new Laya.Vector2();
            this.hitNormal = new Laya.Vector2();
            this.fraction = 0;
        }
    }
    class FilterData {
        constructor() {
            this.group = 0;
            this.category = 1;
            this.mask = -1;
        }
    }
    class Box2DShapeDef {
        constructor() {
            this.density = 1;
            this.friction = 0.2;
            this.isSensor = false;
            this.restitution = 0;
            this.restitutionThreshold = 1.0;
            this.filter = new FilterData();
        }
    }
    class RigidBody2DInfo {
        constructor() {
            this.position = new Laya.Vector2();
            this.linearVelocity = new Laya.Vector2();
            this.type = "static";
        }
    }
    class physics2D_BaseJointDef {
    }
    class physics2D_DistancJointDef extends physics2D_BaseJointDef {
        constructor() {
            super(...arguments);
            this.localAnchorA = new Laya.Vector2();
            this.localAnchorB = new Laya.Vector2();
        }
    }
    class physics2D_GearJointDef extends physics2D_BaseJointDef {
    }
    class physics2D_MotorJointDef extends physics2D_BaseJointDef {
        constructor() {
            super(...arguments);
            this.linearOffset = new Laya.Vector2();
        }
    }
    class physics2D_MouseJointJointDef extends physics2D_BaseJointDef {
        constructor() {
            super(...arguments);
            this.target = new Laya.Vector2();
        }
    }
    class physics2D_PrismaticJointDef extends physics2D_BaseJointDef {
        constructor() {
            super(...arguments);
            this.anchor = new Laya.Vector2();
            this.axis = new Laya.Vector2();
        }
    }
    class physics2D_PulleyJointDef extends physics2D_BaseJointDef {
        constructor() {
            super(...arguments);
            this.groundAnchorA = new Laya.Vector2();
            this.groundAnchorB = new Laya.Vector2();
            this.localAnchorA = new Laya.Vector2();
            this.localAnchorB = new Laya.Vector2();
        }
    }
    class physics2D_RevoluteJointDef extends physics2D_BaseJointDef {
        constructor() {
            super(...arguments);
            this.anchor = new Laya.Vector2();
        }
    }
    class physics2D_WeldJointDef extends physics2D_BaseJointDef {
        constructor() {
            super(...arguments);
            this.anchor = new Laya.Vector2();
        }
    }
    class physics2D_WheelJointDef extends physics2D_BaseJointDef {
        constructor() {
            super(...arguments);
            this.anchor = new Laya.Vector2();
            this.axis = new Laya.Vector2();
        }
    }
    class box2DWorldDef {
        constructor() {
            this.gravity = new Laya.Vector2(0, -9.8);
            this.pixelRatio = 50;
            this.subStep = 1;
            this.velocityIterations = 8;
            this.positionIterations = 3;
        }
    }
    exports.Ebox2DType = void 0;
    (function (Ebox2DType) {
        Ebox2DType[Ebox2DType["b2Color"] = 0] = "b2Color";
        Ebox2DType[Ebox2DType["b2Vec2"] = 1] = "b2Vec2";
        Ebox2DType[Ebox2DType["b2Transform"] = 2] = "b2Transform";
        Ebox2DType[Ebox2DType["b2Contact"] = 3] = "b2Contact";
        Ebox2DType[Ebox2DType["b2Joint"] = 4] = "b2Joint";
        Ebox2DType[Ebox2DType["b2Fixture"] = 5] = "b2Fixture";
        Ebox2DType[Ebox2DType["b2Filter"] = 6] = "b2Filter";
        Ebox2DType[Ebox2DType["b2QueryCallback"] = 7] = "b2QueryCallback";
        Ebox2DType[Ebox2DType["b2RayCastCallback"] = 8] = "b2RayCastCallback";
    })(exports.Ebox2DType || (exports.Ebox2DType = {}));

    class PhysicsLineGemetry {
        get positions() {
            return this._positions;
        }
        set positions(value) {
            if ((value.length / 4) != ((value.length / 4) | 0))
                return;
            this._positions = value;
            this._needUpdate = true;
        }
        get renderGeometry() {
            return this._renderGeometry;
        }
        clear() {
            this._positions.length = 0;
            this._needUpdate = true;
        }
        updateGeometry() {
            if (!this._needUpdate)
                return;
            this._needUpdate = false;
            this._changeGeometry();
        }
        initRender() {
            let lineNums = this._maxLineNumer;
            let positionBuffer = this._positionVertexBuffer = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
            positionBuffer.instanceBuffer = true;
            positionBuffer.vertexDeclaration = PhysicsLineShader.linePoisitionDesc;
            positionBuffer.setDataLength(lineNums * 16);
            this._positionInstansBufferData = new Float32Array(lineNums * 4);
            positionBuffer.setData(this._positionInstansBufferData.buffer, 0, 0, this._positionInstansBufferData.byteLength);
            let lineLengthBuffer = this._lineLengthVertexBuffer = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
            lineLengthBuffer.instanceBuffer = true;
            lineLengthBuffer.vertexDeclaration = PhysicsLineShader.lineLengthDesc;
            lineLengthBuffer.setDataLength(lineNums * 4);
            this._lineLengthBufferData = new Float32Array(lineNums * 1);
            lineLengthBuffer.setData(this._lineLengthBufferData.buffer, 0, 0, this._lineLengthBufferData.byteLength);
            let geometry = this._renderGeometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElementInstance);
            geometry.bufferState = Laya.LayaGL.renderDeviceFactory.createBufferState();
            geometry.setDrawElemenParams(6, 0);
            geometry.indexFormat = Laya.IndexFormat.UInt16;
            geometry.instanceCount = 0;
            let buffers = [];
            buffers.push(PhysicsLineShader._vbs);
            buffers.push(this._positionVertexBuffer);
            buffers.push(this._lineLengthVertexBuffer);
            geometry.bufferState.applyState(buffers, PhysicsLineShader._ibs);
        }
        _changeGeometry() {
            let lineLength = this._positions.length / 4;
            if (lineLength > this._maxLineNumer) {
                this._maxLineNumer = (((lineLength / this._enLarge) | 0) + 1) * this._enLarge;
                this._positionInstansBufferData = new Float32Array(this._maxLineNumer * 4);
                this._positionVertexBuffer.setDataLength(this._maxLineNumer * 16);
                this._lineLengthBufferData = new Float32Array(this._maxLineNumer * 1);
                this._lineLengthVertexBuffer.setDataLength(this._maxLineNumer * 4);
                this._renderGeometry.bufferState.applyState([PhysicsLineShader._vbs, this._positionVertexBuffer, this._lineLengthVertexBuffer], PhysicsLineShader._ibs);
            }
            this._positionInstansBufferData.set(this._positions, 0);
            this._positionVertexBuffer.setData(this._positionInstansBufferData.buffer, 0, 0, this._positionInstansBufferData.byteLength);
            {
                let totalLength = 0;
                for (var i = 0; i < lineLength; i++) {
                    const dataIndex = i * 4;
                    this._lineLengthBufferData[i] = totalLength;
                    totalLength += Math.hypot(this._positions[dataIndex + 2] - this._positions[dataIndex], this._positions[dataIndex + 3] - this._positions[dataIndex + 1]);
                }
                this._lineLengthVertexBuffer.setData(this._lineLengthBufferData.buffer, 0, 0, this._lineLengthBufferData.byteLength);
            }
            this._renderGeometry.instanceCount = lineLength;
        }
        constructor() {
            this._positions = [];
            this._needUpdate = true;
            this._maxLineNumer = 200;
            this._enLarge = 100;
            this.initRender();
        }
    }

    class PhysicsDrawLine2DCMD extends Laya.Command2D {
        get physicsGeometry() {
            return this._physicsGeometry;
        }
        static create(pointArray, mat, color = Laya.Color.WHITE, lineWidth = 3) {
            var cmd = PhysicsDrawLine2DCMD._pool.take();
            cmd.physicsGeometry.positions = pointArray;
            cmd.lineWidth = lineWidth;
            cmd.color = color;
            cmd._needUpdateElement = true;
            cmd._setMatrix(mat);
            return cmd;
        }
        constructor() {
            super();
            this._renderElements = [];
            this._material = new Laya.Material();
            this._material._addReference();
            this._material.setShaderName("PhysicsLineShader");
            this._material.cull = Laya.CullMode.Off;
            this._material.setBoolByIndex(Laya.Shader3D.DEPTH_WRITE, false);
            this._material.setIntByIndex(Laya.Shader3D.DEPTH_TEST, Laya.RenderState.DEPTHTEST_OFF);
            this._material.setIntByIndex(Laya.Shader3D.BLEND, Laya.RenderState.BLEND_ENABLE_ALL);
            this._material.setIntByIndex(Laya.Shader3D.BLEND_EQUATION, Laya.RenderState.BLENDEQUATION_ADD);
            this._material.setIntByIndex(Laya.Shader3D.BLEND_SRC, Laya.RenderState.BLENDPARAM_ONE);
            this._material.setIntByIndex(Laya.Shader3D.BLEND_DST, Laya.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA);
            this._material.setFloatByIndex(Laya.ShaderDefines2D.UNIFORM_VERTALPHA, 1.0);
            this._material.setIntByIndex(Laya.Shader3D.CULL, Laya.RenderState.CULL_NONE);
            this._drawElementData = Laya.LayaGL.render2DRenderPassFactory.createDraw2DElementCMDData();
            this._shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData();
            this._shaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_BASERENDER2D);
            this._struct = Laya.LayaGL.render2DRenderPassFactory.createRenderStruct2D();
            this._renderElements[0] = Laya.LayaGL.render2DRenderPassFactory.createRenderElement2D();
            this._physicsGeometry = new PhysicsLineGemetry();
            this._physicsGeometry.updateGeometry();
            this._renderElements[0].nodeCommonMap = ["BaseRender2D"];
            Laya.BaseRenderNode2D._setRenderElement2DMaterial(this._renderElements[0], this._material);
            this._matrix = new Laya.Matrix();
        }
        set lineWidth(value) {
            this._material.shaderData.setNumber(PhysicsLineShader.LINEWIDTH, value);
        }
        set color(value) {
            this._shaderData.setColor(Laya.BaseRenderNode2D.BASERENDER2DCOLOR, value);
        }
        _setMatrix(value) {
            value ? value.copyTo(this._matrix) : Laya.Matrix.EMPTY.copyTo(this._matrix);
            let mat = this._matrix;
            let vec3 = Laya.Vector3.TEMP;
            vec3.x = mat.a;
            vec3.y = mat.c;
            vec3.z = mat.tx;
            this._shaderData.setVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_0, vec3);
            vec3.x = mat.b;
            vec3.y = mat.d;
            vec3.z = mat.ty;
            this._shaderData.setVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_1, vec3);
        }
        getRenderCMD() {
            return this._drawElementData;
        }
        run() {
            if (this._needUpdateElement) {
                this.physicsGeometry.updateGeometry();
                this._renderElements[0].geometry = this._renderGeometry = this._physicsGeometry.renderGeometry;
                this._renderElements[0].renderStateIsBySprite = false;
                this._renderElements[0].value2DShaderData = this._shaderData;
                this._renderElements[0].materialShaderData = this._material.shaderData;
                this._renderElements[0].subShader = this._material._shader.getSubShaderAt(0);
                this._drawElementData.setRenderelements(this._renderElements);
                this._needUpdateElement = false;
            }
        }
        recover() {
            PhysicsDrawLine2DCMD._pool.recover(this);
            super.recover();
        }
    }
    PhysicsDrawLine2DCMD._pool = Laya.Pool.createPool(PhysicsDrawLine2DCMD);

    class Physics2DDebugDraw {
        constructor() {
            this._lineWidth = 3;
            this._matrix = new Laya.Matrix();
            this._meshAccums = new Map();
            this._lineAccums = new Map();
            this._cmdDrawLineList = [];
            this._linePointsList = [];
            this._cmdDrawMeshList = [];
            this._meshList = [];
            this._pendingMeshCmdRing = [];
            this._pendingMeshRing = [];
            this._pendingLineCmdRing = [];
            this._camera = {};
            this._camera.m_center = new Laya.Vector2(0, 0);
            this._camera.m_extent = 25;
            this._camera.m_zoom = 1;
            this._camera.m_width = 1280;
            this._camera.m_height = 800;
            this._cmdBuffer = new Laya.CommandBuffer2D("Physics2DDebugDraw");
        }
        _colorToKey(color) {
            return ((color.r * 255 + 0.5) | 0) * 16777216 +
                ((color.g * 255 + 0.5) | 0) * 65536 +
                ((color.b * 255 + 0.5) | 0) * 256 +
                ((color.a * 255 + 0.5) | 0);
        }
        _getMeshAccum(color) {
            let key = this._colorToKey(color);
            let accum = this._meshAccums.get(key);
            if (!accum) {
                accum = { vertices: [], indices: [], vertexCount: 0, color: color.clone() };
                this._meshAccums.set(key, accum);
            }
            return accum;
        }
        _getLineAccum(color) {
            let key = this._colorToKey(color);
            let accum = this._lineAccums.get(key);
            if (!accum) {
                accum = { points: [], color: color.clone() };
                this._lineAccums.set(key, accum);
            }
            return accum;
        }
        setActive(value) {
            if (value) {
                Laya.Laya.timer.frameLoop(1, this, this.render);
            }
            else {
                Laya.Laya.timer.clear(this, this.render);
            }
        }
        appendCircle(cx, cy, radius, color, numSegments = 24) {
            if (radius <= 0 || numSegments < 3)
                return;
            let accum = this._getMeshAccum(color);
            let base = accum.vertexCount;
            const twoPi = Math.PI * 2;
            const verts = accum.vertices;
            const idxs = accum.indices;
            for (let i = 0; i < numSegments; i++) {
                const angle = twoPi * i / numSegments;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                verts.push(cx + radius * cos, cy + radius * sin, 0, 0.5 + 0.5 * cos, 0.5 + 0.5 * sin);
            }
            verts.push(cx, cy, 0, 0.5, 0.5);
            const centerIdx = base + numSegments;
            for (let i = 0; i < numSegments; i++) {
                idxs.push(centerIdx, base + i, base + ((i + 1) % numSegments));
            }
            accum.vertexCount += numSegments + 1;
        }
        appendPolygon(points, pointCount, color) {
            if (pointCount < 3)
                return;
            let accum = this._getMeshAccum(color);
            let base = accum.vertexCount;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (let i = 0; i < pointCount; i++) {
                const x = points[i * 2], y = points[i * 2 + 1];
                if (x < minX)
                    minX = x;
                if (x > maxX)
                    maxX = x;
                if (y < minY)
                    minY = y;
                if (y > maxY)
                    maxY = y;
            }
            const w = maxX - minX || 1;
            const h = maxY - minY || 1;
            const verts = accum.vertices;
            const idxs = accum.indices;
            for (let i = 0; i < pointCount; i++) {
                const x = points[i * 2];
                const y = points[i * 2 + 1];
                verts.push(x, y, 0, (x - minX) / w, (y - minY) / h);
            }
            for (let i = 1; i < pointCount - 1; i++) {
                idxs.push(base, base + i, base + i + 1);
            }
            accum.vertexCount += pointCount;
        }
        appendLineSegment(x1, y1, x2, y2, color) {
            let accum = this._getLineAccum(color);
            accum.points.push(x1, y1, x2, y2);
        }
        appendLinePoints(points, color) {
            if (points.length < 4)
                return;
            let accum = this._getLineAccum(color);
            let arr = accum.points;
            for (let i = 0, len = points.length; i < len; i++) {
                arr.push(points[i]);
            }
        }
        render() {
            this._matrix.identity();
            this._matrix.scale(Physics2D.toRenderX(1), Physics2D.toRenderY(1));
            if (this._pendingMeshCmdRing.length >= Physics2DDebugDraw._RETAIN_FRAMES) {
                const oldestMeshCmds = this._pendingMeshCmdRing.shift();
                for (let i = 0; i < oldestMeshCmds.length; i++)
                    oldestMeshCmds[i].recover();
                const oldestMeshes = this._pendingMeshRing.shift();
                for (let i = 0; i < oldestMeshes.length; i++)
                    oldestMeshes[i].destroy();
                const oldestLineCmds = this._pendingLineCmdRing.shift();
                for (let i = 0; i < oldestLineCmds.length; i++)
                    oldestLineCmds[i].recover();
            }
            let area2D = this._scene._area2Ds.size > 0 ? this._scene._area2Ds.values().next().value._struct : null;
            let frameMeshCmds = [];
            let frameMeshes = [];
            let frameLineCmds = [];
            const declaration = Laya.VertexMesh2D.getVertexDeclaration(["POSITION,UV"], false)[0];
            this._meshAccums.forEach(accum => {
                if (accum.vertexCount === 0)
                    return;
                const verts = new Float32Array(accum.vertices);
                const useUint32 = accum.vertexCount > 65535;
                const indices = useUint32 ? new Uint32Array(accum.indices) : new Uint16Array(accum.indices);
                const mesh = Laya.Mesh2D.createMesh2DByPrimitive([verts], [declaration], indices, useUint32 ? Laya.IndexFormat.UInt32 : Laya.IndexFormat.UInt16, [{ length: indices.length, start: 0 }]);
                const cmd = Laya.DrawMesh2DCMD.create(mesh, this._matrix, Laya.Texture2D.whiteTexture, accum.color, this._material);
                if (cmd)
                    frameMeshCmds.push(cmd);
                frameMeshes.push(mesh);
                accum.vertices.length = 0;
                accum.indices.length = 0;
                accum.vertexCount = 0;
            });
            this._lineAccums.forEach(accum => {
                if (accum.points.length < 4)
                    return;
                const cmd = PhysicsDrawLine2DCMD.create(accum.points, this._matrix, accum.color, this._lineWidth);
                if (cmd)
                    frameLineCmds.push(cmd);
            });
            this._cmdBuffer.setRenderTarget(null, false);
            for (let i = 0; i < this._cmdDrawMeshList.length; i++) {
                let cmd = this._cmdDrawMeshList[i];
                if (area2D)
                    cmd._renderElements[0] && (cmd._renderElements[0].owner = area2D);
                this._cmdBuffer.addCacheCommand(cmd);
            }
            for (let i = 0; i < frameMeshCmds.length; i++) {
                let cmd = frameMeshCmds[i];
                if (area2D)
                    cmd._renderElements[0] && (cmd._renderElements[0].owner = area2D);
                this._cmdBuffer.addCacheCommand(cmd);
            }
            for (let i = 0; i < this._cmdDrawLineList.length; i++) {
                let cmd = this._cmdDrawLineList[i];
                if (area2D)
                    cmd._renderElements[0] && (cmd._renderElements[0].owner = area2D);
                this._cmdBuffer.addCacheCommand(cmd);
            }
            for (let i = 0; i < frameLineCmds.length; i++) {
                let cmd = frameLineCmds[i];
                if (area2D)
                    cmd._renderElements[0] && (cmd._renderElements[0].owner = area2D);
                this._cmdBuffer.addCacheCommand(cmd);
            }
            this._cmdBuffer.apply(true);
            this._cmdBuffer.clear(false);
            this._pendingMeshCmdRing.push(this._cmdDrawMeshList.slice().concat(frameMeshCmds));
            this._pendingMeshRing.push(this._meshList.slice().concat(frameMeshes));
            this._pendingLineCmdRing.push(this._cmdDrawLineList.slice().concat(frameLineCmds));
            for (let i = 0; i < this._linePointsList.length; i++) {
                this._linePointsList[i] = null;
            }
            this._cmdDrawLineList.length = 0;
            this._cmdDrawMeshList.length = 0;
            this._meshList.length = 0;
            this._linePointsList.length = 0;
            this._lineAccums.forEach(accum => { accum.points.length = 0; });
        }
        createMesh2DByVertices(vertices) {
            const pointCount = vertices.length / 2;
            if (pointCount < 3)
                return null;
            let vertexs = new Float32Array(pointCount * 5);
            let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
            let maxX = Number.MIN_VALUE, maxY = Number.MIN_VALUE;
            for (let i = 0; i < vertices.length; i += 2) {
                minX = Math.min(minX, vertices[i]);
                maxX = Math.max(maxX, vertices[i]);
                minY = Math.min(minY, vertices[i + 1]);
                maxY = Math.max(maxY, vertices[i + 1]);
            }
            const width = maxX - minX;
            const height = maxY - minY;
            let pos = 0;
            for (let i = 0; i < pointCount; i++, pos += 5) {
                const x = vertices[i * 2];
                const y = vertices[i * 2 + 1];
                vertexs[pos + 0] = x;
                vertexs[pos + 1] = y;
                vertexs[pos + 2] = 0;
                vertexs[pos + 3] = (x - minX) / width;
                vertexs[pos + 4] = (y - minY) / height;
            }
            let index = new Uint16Array((pointCount - 2) * 3);
            let ibIndex = 0;
            for (let i = 1; i < pointCount - 1; i++) {
                index[ibIndex++] = 0;
                index[ibIndex++] = i;
                index[ibIndex++] = i + 1;
            }
            const declaration = Laya.VertexMesh2D.getVertexDeclaration(["POSITION,UV"], false)[0];
            let mesh2D = Laya.Mesh2D.createMesh2DByPrimitive([vertexs], [declaration], index, Laya.IndexFormat.UInt16, [{ length: index.length, start: 0 }]);
            return mesh2D;
        }
        createCircleMeshByVertices(center, radius, numSegments) {
            if (numSegments < 3)
                numSegments = 3;
            if (radius <= 0)
                return null;
            const twoPi = Math.PI * 2;
            let vertices = new Float32Array((numSegments + 1) * 5);
            let indices = new Uint16Array(numSegments * 3);
            let pos = 0;
            for (let i = 0; i < numSegments; i++, pos += 5) {
                const angle = twoPi * i / numSegments;
                const x = center.x + radius * Math.cos(angle);
                const y = center.y + radius * Math.sin(angle);
                vertices[pos] = x;
                vertices[pos + 1] = y;
                vertices[pos + 2] = 0;
                vertices[pos + 3] = 0.5 + 0.5 * Math.cos(angle);
                vertices[pos + 4] = 0.5 + 0.5 * Math.sin(angle);
            }
            vertices[pos] = center.x;
            vertices[pos + 1] = center.y;
            vertices[pos + 2] = 0;
            vertices[pos + 3] = 0.5;
            vertices[pos + 4] = 0.5;
            let ibIndex = 0;
            for (let i = 0; i < numSegments; i++, ibIndex += 3) {
                const nextIndex = (i + 1) % numSegments;
                indices[ibIndex] = numSegments;
                indices[ibIndex + 1] = i;
                indices[ibIndex + 2] = nextIndex;
            }
            var declaration = Laya.VertexMesh2D.getVertexDeclaration(["POSITION,UV"], false)[0];
            let mesh2D = Laya.Mesh2D.createMesh2DByPrimitive([vertices], [declaration], indices, Laya.IndexFormat.UInt16, [{ length: indices.length, start: 0 }]);
            return mesh2D;
        }
        addMeshDebugDrawCMD(mesh2D, color, matrix) {
            if (!mesh2D)
                return;
            if (!matrix)
                matrix = this._matrix;
            let cmd = Laya.DrawMesh2DCMD.create(mesh2D, matrix, Laya.Texture2D.whiteTexture, color, this._material);
            cmd && this._cmdDrawMeshList.push(cmd);
            this._meshList.push(mesh2D);
        }
        addLineDebugDrawCMD(points, color, lineWidth, matrix) {
            if (!matrix)
                matrix = this._matrix;
            if (!lineWidth)
                lineWidth = this._lineWidth;
            let cmd = PhysicsDrawLine2DCMD.create(points, matrix, color, lineWidth);
            cmd && this._cmdDrawLineList.push(cmd);
            this._linePointsList.push(points);
        }
        destroy() {
            Laya.Laya.timer.clear(this, this.render);
            this._cmdBuffer && this._cmdBuffer.clear(false);
            this._material && this._material.destroy();
            this._material = null;
            this._cmdBuffer = null;
            if (this._cmdDrawMeshList) {
                for (let i = 0; i < this._cmdDrawMeshList.length; i++) {
                    this._cmdDrawMeshList[i].recover();
                }
                this._cmdDrawMeshList.length = 0;
            }
            if (this._meshList) {
                for (let i = 0; i < this._meshList.length; i++) {
                    this._meshList[i].destroy();
                }
                this._meshList.length = 0;
            }
            if (this._cmdDrawLineList) {
                for (let i = 0; i < this._cmdDrawLineList.length; i++) {
                    this._cmdDrawLineList[i].recover();
                }
                this._cmdDrawLineList.length = 0;
            }
            this._linePointsList && (this._linePointsList.length = 0);
            this._meshAccums.clear();
            this._lineAccums.clear();
            for (let i = 0; i < this._pendingMeshCmdRing.length; i++) {
                const cmds = this._pendingMeshCmdRing[i];
                for (let j = 0; j < cmds.length; j++)
                    cmds[j].recover();
            }
            for (let i = 0; i < this._pendingLineCmdRing.length; i++) {
                const cmds = this._pendingLineCmdRing[i];
                for (let j = 0; j < cmds.length; j++)
                    cmds[j].recover();
            }
            for (let i = 0; i < this._pendingMeshRing.length; i++) {
                const meshes = this._pendingMeshRing[i];
                for (let j = 0; j < meshes.length; j++)
                    meshes[j].destroy();
            }
            this._pendingMeshCmdRing.length = 0;
            this._pendingLineCmdRing.length = 0;
            this._pendingMeshRing.length = 0;
        }
    }
    Physics2DDebugDraw._RETAIN_FRAMES = 6;

    class Physics2DWorldManager {
        getEmptyBody() {
            return this._emptyBody || (this._emptyBody = Physics2D.I._factory.createBody(this._box2DWorld, null));
        }
        get box2DWorld() {
            return this._box2DWorld;
        }
        get gravity() {
            return this._gravity;
        }
        constructor(scene) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            this._subStepCount = 1;
            this._pixelRatio = 50;
            this._RePixelRatio = 1 / this._pixelRatio;
            this._subStep = 1;
            this._velocityIterations = 8;
            this._positionIterations = 8;
            this._gravity = new Laya.Vector2(0, -9.8);
            this._worldDef = new box2DWorldDef();
            this._eventList = [];
            this._allowWorldSleep = false;
            this._tempColor = new Laya.Color();
            this._tempPoints = [];
            const configlayer = (_a = Laya.PlayerConfig.physics2D) === null || _a === void 0 ? void 0 : _a.defaultConfig;
            this._worldDef.pixelRatio = this._pixelRatio = (_b = configlayer === null || configlayer === void 0 ? void 0 : configlayer.pixelRatio) !== null && _b !== void 0 ? _b : Physics2DOption.pixelRatio;
            this._RePixelRatio = 1 / this._pixelRatio;
            this._worldDef.subStep = this._subStep = (_c = configlayer === null || configlayer === void 0 ? void 0 : configlayer.subStep) !== null && _c !== void 0 ? _c : Physics2DOption.subStep;
            this._worldDef.velocityIterations = this._velocityIterations = (_d = configlayer === null || configlayer === void 0 ? void 0 : configlayer.velocityIterations) !== null && _d !== void 0 ? _d : Physics2DOption.velocityIterations;
            this._worldDef.positionIterations = this._positionIterations = (_e = configlayer === null || configlayer === void 0 ? void 0 : configlayer.positionIterations) !== null && _e !== void 0 ? _e : Physics2DOption.positionIterations;
            this._worldDef.gravity = this._gravity.setValue((_f = configlayer === null || configlayer === void 0 ? void 0 : configlayer.gravity.x) !== null && _f !== void 0 ? _f : Physics2DOption.gravity.x, (_g = configlayer === null || configlayer === void 0 ? void 0 : configlayer.gravity.y) !== null && _g !== void 0 ? _g : Physics2DOption.gravity.y);
            this._allowWorldSleep = (_h = configlayer === null || configlayer === void 0 ? void 0 : configlayer.allowSleeping) !== null && _h !== void 0 ? _h : Physics2DOption.allowSleeping;
            this._scene = scene;
            scene.on(Laya.Event.DISPLAY, () => { var _a; return (_a = this._debugDraw) === null || _a === void 0 ? void 0 : _a.setActive(true); });
            scene.on(Laya.Event.UNDISPLAY, () => { var _a; return (_a = this._debugDraw) === null || _a === void 0 ? void 0 : _a.setActive(false); });
            this.setRootSprite(this._scene);
        }
        Init(data) {
            var _a, _b;
            let configlayer = (_a = Laya.PlayerConfig.physics2D) === null || _a === void 0 ? void 0 : _a.addConfig[data];
            if (!configlayer) {
                configlayer = (_b = Laya.PlayerConfig.physics2D) === null || _b === void 0 ? void 0 : _b.defaultConfig;
            }
            if (!configlayer)
                return;
            this._worldDef.pixelRatio = this._pixelRatio = configlayer.pixelRatio ? configlayer.pixelRatio : Physics2DOption.pixelRatio;
            this._RePixelRatio = 1 / this._pixelRatio;
            this._worldDef.subStep = this._subStep = configlayer.subStep ? configlayer.subStep : Physics2DOption.subStep;
            this._worldDef.velocityIterations = this._velocityIterations = configlayer.velocityIterations ? configlayer.velocityIterations : Physics2DOption.velocityIterations;
            this._worldDef.positionIterations = this._positionIterations = configlayer.positionIterations ? configlayer.positionIterations : Physics2DOption.positionIterations;
            this._worldDef.gravity = this._gravity.setValue(configlayer.gravity.x ? configlayer.gravity.x : Physics2DOption.gravity.x, configlayer.gravity.y ? configlayer.gravity.y : Physics2DOption.gravity.x);
            this._allowWorldSleep = configlayer.allowSleeping;
            if (this._box2DWorld) {
                this.destroy();
                this._eventList = [];
            }
            this.setRootSprite(this._scene);
            if (configlayer.debugDraw && Laya.LayaEnv.isPlaying) {
                this.enableDebugDraw(configlayer.drawShape, exports.EPhycis2DBlit.Shape);
                this.enableDebugDraw(configlayer.drawJoint, exports.EPhycis2DBlit.Joint);
                this.enableDebugDraw(configlayer.drawAABB, exports.EPhycis2DBlit.AABB);
                this.enableDebugDraw(configlayer.drawCenterOfMass, exports.EPhycis2DBlit.CenterOfMass);
            }
        }
        update(dt) {
        }
        setRootSprite(scene) {
            var _a;
            this._scene = scene;
            this._box2DWorld = Physics2D.I._factory.createWorld(this._worldDef);
            Physics2D.I._factory.allowWorldSleep(this._box2DWorld, this._allowWorldSleep);
            this._box2DWorld._pixelRatio = this._pixelRatio;
            this._box2DWorld._indexInMap = Physics2D.I._factory.worldCount;
            Physics2D.I._factory.worldMap.set(Physics2D.I._factory.worldCount, this);
            Physics2D.I._factory.worldCount++;
            this._contactListener = Physics2D.I._factory.createContactListener();
            this._contactListener = this._worldContactCallback(this._contactListener);
            Physics2D.I._factory.setContactListener(this._box2DWorld, this._contactListener);
            this._JSRayCastcallback = Physics2D.I._factory.createJSRayCastCallback();
            this._JSQuerycallback = Physics2D.I._factory.createJSQueryCallback();
            const configlayer = (_a = Laya.PlayerConfig.physics2D) === null || _a === void 0 ? void 0 : _a.defaultConfig;
            if (configlayer && configlayer.debugDraw && Laya.LayaEnv.isPlaying) {
                this.enableDebugDraw(configlayer.drawShape, exports.EPhycis2DBlit.Shape);
                this.enableDebugDraw(configlayer.drawJoint, exports.EPhycis2DBlit.Joint);
                this.enableDebugDraw(configlayer.drawAABB, exports.EPhycis2DBlit.AABB);
                this.enableDebugDraw(configlayer.drawCenterOfMass, exports.EPhycis2DBlit.CenterOfMass);
            }
        }
        setGravity(gravity) {
            this._gravity.setValue(gravity.x, gravity.y);
            if (this._box2DWorld) {
                const factory = Physics2D.I._factory;
                const value = factory.createPhyVec2(gravity.x, gravity.y);
                this._box2DWorld.SetGravity(value);
                factory.destroyData(value);
            }
        }
        getRootSprite() {
            return this._scene;
        }
        shiftOrigin(newOrigin) {
            Physics2D.I._factory.shiftOrigin(this._box2DWorld, newOrigin);
        }
        enableDebugDraw(enable, bli) {
            if (!this._debugDraw) {
                this._debugDraw = new Physics2DDebugDraw();
                this._debugDraw._scene = this._scene;
                if (this._scene.activeInHierarchy)
                    this._debugDraw.setActive(true);
            }
            this._enableBox2DDraw(enable, bli);
        }
        setPixel_Ratio(pixelRatio) {
            if (!Number.isFinite(pixelRatio) || pixelRatio <= 0)
                throw new Error("Physics2D pixel ratio must be a finite positive number.");
            this._pixelRatio = pixelRatio;
            this._RePixelRatio = 1 / pixelRatio;
            if (this._box2DWorld)
                this._box2DWorld._pixelRatio = pixelRatio;
        }
        getPixel_Ratio() {
            return this._pixelRatio;
        }
        setSubStep(subStep) {
            if (!Number.isSafeInteger(subStep) || subStep < 1)
                throw new Error("Physics2D substeps must be a positive integer.");
            this._subStep = this._subStepCount = subStep;
        }
        getSubStep() {
            return this._subStep;
        }
        sendEvent() {
            var _a;
            const events = this._eventList;
            if (!events)
                return;
            (_a = this._subStepStayEvents) === null || _a === void 0 ? void 0 : _a.clear();
            let length = events.length;
            if (length > 0) {
                for (let i = 0; i < length && this._box2DWorld; i += 2) {
                    this._dispatchEvent(events[i], events[i + 1]);
                }
                let factory = Physics2D.I._factory;
                for (let i = 1; i < length; i += 2) {
                    if (!events[i]._eventSnapshot && !events[i]._endSnapshot)
                        factory._cleanCache(events[i]);
                }
                if (events.length === length)
                    events.length = 0;
                else
                    events.splice(0, length);
            }
        }
        setVelocityIterations(velocityIterations) {
            this._velocityIterations = velocityIterations;
        }
        getVelocityIterations() {
            return this._velocityIterations;
        }
        setPositionIterations(positionIterations) {
            this._positionIterations = positionIterations;
        }
        getPositionIterations() {
            return this._positionIterations;
        }
        getBodyCount() {
            return Physics2D.I._factory.getBodyCount(this._box2DWorld);
        }
        getJointCount() {
            return Physics2D.I._factory.getJointCount(this._box2DWorld);
        }
        getContactCount() {
            return Physics2D.I._factory.getContactCount(this._box2DWorld);
        }
        layaToPhysics2D(value) {
            return value * this._RePixelRatio;
        }
        physics2DToLaya(value) {
            return value * this._pixelRatio;
        }
        clearAllForces() {
            this._box2DWorld && Physics2D.I._factory.clearForces(this._box2DWorld);
        }
        QueryAABB(res, bounds) {
            this._JSQuerycallback.ReportFixture = function _callback(warp) {
                let fixture = Physics2D.I._factory.warpPoint(warp, exports.Ebox2DType.b2Fixture);
                if (fixture) {
                    let collider = fixture.collider;
                    collider && res.push(collider);
                    return true;
                }
                else {
                    return false;
                }
            };
            Physics2D.I._factory.QueryAABB(this._box2DWorld, this._JSQuerycallback, bounds);
        }
        RayCast(res, startPos, endPos) {
            let callback = (warp, point, normal, fraction) => {
                let fixture = Physics2D.I._factory.warpPoint(warp, exports.Ebox2DType.b2Fixture);
                if (!fixture)
                    return 1;
                let v = Physics2D.I._factory.warpPoint(point, exports.Ebox2DType.b2Vec2);
                let px = v.x, py = v.y;
                v = Physics2D.I._factory.warpPoint(normal, exports.Ebox2DType.b2Vec2);
                let nx = v.x, ny = v.y;
                let hitRes = new Physics2DHitResult();
                let collider = fixture.collider;
                hitRes.collider = collider;
                hitRes.hitPoint.x = this.physics2DToLaya(px);
                hitRes.hitPoint.y = this.physics2DToLaya(py);
                hitRes.hitNormal.x = nx;
                hitRes.hitNormal.y = ny;
                hitRes.fraction = fraction;
                res.push(hitRes);
                if (collider) {
                    return 1;
                }
                else {
                    return 0;
                }
            };
            this._JSRayCastcallback.ReportFixture = callback.bind(this);
            Physics2D.I._factory.RayCast(this._box2DWorld, this._JSRayCastcallback, startPos, endPos);
        }
        destroy() {
            var _a;
            if (!this._box2DWorld)
                return;
            if (this._emptyBody) {
                Physics2D.I._factory.removeBody(this._box2DWorld, this._emptyBody);
                this._emptyBody = null;
            }
            if (this._debugDraw) {
                this._debugDraw.destroy();
                this._debugDraw = null;
                this._jsDraw = null;
            }
            Physics2D.I._factory.worldMap.delete(this._box2DWorld._indexInMap);
            Physics2D.I._factory.destroyWorld(this._box2DWorld);
            this._box2DWorld = null;
            this._eventList = null;
            (_a = this._subStepStayEvents) === null || _a === void 0 ? void 0 : _a.clear();
        }
        _queueContactEvent(type, pointer) {
            const factory = Physics2D.I._factory;
            const contact = factory.warpPoint(pointer, exports.Ebox2DType.b2Contact);
            const substeps = this._subStepCount > 1;
            if (!substeps && type !== "triggerexit") {
                this._eventList.push(type, contact);
                return;
            }
            const a = factory.getContactShapeA(contact);
            const b = factory.getContactShapeB(contact);
            const hit = new Physics2DContactHitResult();
            const count = factory.getContactWorldManifold(contact, hit);
            for (let i = 0; i < count; i++) {
                hit.points[i].x = this.physics2DToLaya(hit.points[i].x);
                hit.points[i].y = this.physics2DToLaya(hit.points[i].y);
                hit.separations[i] = this.physics2DToLaya(hit.separations[i]);
            }
            const snapshot = {
                _eventSnapshot: true,
                GetFixtureA: () => a,
                GetFixtureB: () => b,
                getHitInfo: () => hit
            };
            factory._cleanCache(contact);
            if (!substeps) {
                contact._endSnapshot = snapshot;
                contact.getHitInfo = snapshot.getHitInfo;
                this._eventList.push(type, snapshot);
                return;
            }
            const stays = this._subStepStayEvents || (this._subStepStayEvents = new Map());
            if (type === "triggerstay") {
                const index = stays.get(pointer);
                if (index !== undefined) {
                    this._eventList[index] = snapshot;
                    return;
                }
                stays.set(pointer, this._eventList.length + 1);
            }
            else {
                stays.delete(pointer);
            }
            this._eventList.push(type, snapshot);
        }
        _worldBeginContactCallback(contact) {
            this._queueContactEvent("triggerenter", contact);
        }
        _worldEndContactCallback(contact) {
            this._queueContactEvent("triggerexit", contact);
        }
        _worldPreSolveCallback(contact, oldManifold) {
            this._queueContactEvent("triggerstay", contact);
        }
        _worldPostSolveCallback(contact, impulse) {
        }
        _worldBeginTriggerCallback(contact) {
        }
        _worldEndTriggerCallback(contact) {
        }
        _worldPreTriggerCallback(contact, oldManifold) {
        }
        _worldPostTriggerCallback(contact, impulse) {
        }
        _worldContactCallback(contactListener) {
            contactListener.BeginContact = this._worldBeginContactCallback.bind(this);
            contactListener.EndContact = this._worldEndContactCallback.bind(this);
            contactListener.PreSolve = this._worldPreSolveCallback.bind(this);
            contactListener.PostSolve = this._worldPostSolveCallback.bind(this);
            return contactListener;
        }
        _makeStyleString(color, alpha = -1) {
            let colorData = Physics2D.I._factory.warpPoint(color, exports.Ebox2DType.b2Color);
            let outColor = this._tempColor;
            outColor.r = colorData.r;
            outColor.g = colorData.g;
            outColor.b = colorData.b;
            outColor.a = alpha;
            return outColor;
        }
        _enableBox2DDraw(enable, flag) {
            if (!this._jsDraw) {
                this._jsDraw = Physics2D.I._factory.createBox2DDraw(this._box2DWorld, flag);
                this._jsDraw.DrawSegment = this._debugDrawSegment.bind(this);
                this._jsDraw.DrawPolygon = this._debugDrawPolygon.bind(this);
                this._jsDraw.DrawSolidPolygon = this._debugDrawSolidPolygon.bind(this);
                this._jsDraw.DrawCircle = this._debugDrawCircle.bind(this);
                this._jsDraw.DrawSolidCircle = this._debugDrawSolidCircle.bind(this);
                this._jsDraw.DrawTransform = this._debugDrawTransform.bind(this);
                this._jsDraw.DrawPoint = this._debugDrawPoint.bind(this);
                this._jsDraw.DrawAABB = this._debugDrawAABB.bind(this);
            }
            if (enable) {
                Physics2D.I._factory.appendFlags(this._jsDraw, flag);
            }
            else {
                Physics2D.I._factory.clearFlags(this._jsDraw, flag);
            }
        }
        _debugDrawSegment(p1, p2, color) {
            let v = Physics2D.I._factory.warpPoint(p1, exports.Ebox2DType.b2Vec2);
            let p1x = this.physics2DToLaya(v.x);
            let p1y = this.physics2DToLaya(v.y);
            v = Physics2D.I._factory.warpPoint(p2, exports.Ebox2DType.b2Vec2);
            let p2x = this.physics2DToLaya(v.x);
            let p2y = this.physics2DToLaya(v.y);
            let outColor = this._makeStyleString(color, 1);
            this._debugDraw.appendLineSegment(p1x, p1y, p2x, p2y, outColor);
        }
        _debugDrawPolygon(vertices, vertexCount, color) {
            let points = this._tempPoints;
            points.length = 0;
            for (let i = 0; i < vertexCount; i++) {
                let vert = Physics2D.I._factory.warpPoint(vertices + (i * 8), exports.Ebox2DType.b2Vec2);
                points.push(this.physics2DToLaya(vert.x), this.physics2DToLaya(vert.y));
            }
            let outColor = this._makeStyleString(color, 1);
            this._debugDraw.appendPolygon(points, vertexCount, outColor);
        }
        _debugDrawSolidPolygon(vertices, vertexCount, color) {
            let points = this._tempPoints;
            points.length = 0;
            for (let i = 0; i < vertexCount; i++) {
                let vert = Physics2D.I._factory.warpPoint(vertices + (i * 8), exports.Ebox2DType.b2Vec2);
                points.push(this.physics2DToLaya(vert.x), this.physics2DToLaya(vert.y));
            }
            let outColor = this._makeStyleString(color, 0.5);
            this._debugDraw.appendPolygon(points, vertexCount, outColor);
        }
        _debugDrawCircle(center, radius, color) {
            let centerV = Physics2D.I._factory.warpPoint(center, exports.Ebox2DType.b2Vec2);
            let x = this.physics2DToLaya(centerV.x);
            let y = this.physics2DToLaya(centerV.y);
            radius = this.physics2DToLaya(radius);
            let outColor = this._makeStyleString(color, 1);
            this._debugDraw.appendCircle(x, y, radius, outColor);
        }
        _debugDrawSolidCircle(center, radius, axis, color) {
            let v = Physics2D.I._factory.warpPoint(center, exports.Ebox2DType.b2Vec2);
            let cx = this.physics2DToLaya(v.x);
            let cy = this.physics2DToLaya(v.y);
            radius = this.physics2DToLaya(radius);
            let outColor = this._makeStyleString(color, 0.5);
            this._debugDraw.appendCircle(cx, cy, radius, outColor);
        }
        _debugDrawTransform(xf) {
            xf = Physics2D.I._factory.warpPoint(xf, exports.Ebox2DType.b2Transform);
            const length = 1 / Laya.Browser.pixelRatio;
            let x = this.physics2DToLaya(xf.x);
            let y = this.physics2DToLaya(xf.y);
            let cosAngle = Math.cos(xf.angle);
            let sinAngle = Math.sin(xf.angle);
            let xAxisEndX = x + this.physics2DToLaya(length * cosAngle);
            let xAxisEndY = y + this.physics2DToLaya(length * sinAngle);
            let yAxisEndX = x + this.physics2DToLaya(length * (-sinAngle));
            let yAxisEndY = y + this.physics2DToLaya(length * cosAngle);
            this._debugDraw.appendLineSegment(x, y, xAxisEndX, xAxisEndY, Laya.Color.RED);
            this._debugDraw.appendLineSegment(x, y, yAxisEndX, yAxisEndY, Laya.Color.GREEN);
        }
        _debugDrawPoint(p, size, color) {
            p = Physics2D.I._factory.warpPoint(p, exports.Ebox2DType.b2Vec2);
            size *= this._debugDraw._camera.m_zoom;
            size /= this._debugDraw._camera.m_extent;
            var hsize = size / 2;
            let outColor = this._makeStyleString(color, 1);
            let lx = this.physics2DToLaya(p.x - hsize);
            let rx = this.physics2DToLaya(p.x + hsize);
            let ty = this.physics2DToLaya(p.y - hsize);
            let by = this.physics2DToLaya(p.y + hsize);
            this._debugDraw.appendLineSegment(lx, ty, rx, ty, outColor);
            this._debugDraw.appendLineSegment(rx, ty, rx, by, outColor);
            this._debugDraw.appendLineSegment(rx, by, lx, by, outColor);
            this._debugDraw.appendLineSegment(lx, by, lx, ty, outColor);
        }
        _debugDrawAABB(min, max, color) {
            let v = Physics2D.I._factory.warpPoint(min, exports.Ebox2DType.b2Vec2);
            let minX = v.x, minY = v.y;
            v = Physics2D.I._factory.warpPoint(max, exports.Ebox2DType.b2Vec2);
            let maxX = v.x, maxY = v.y;
            var cx = (maxX + minX) * 0.5;
            var cy = (maxY + minY) * 0.5;
            var hw = (maxX - minX) * 0.5;
            var hh = (maxY - minY) * 0.5;
            let outColor = this._makeStyleString(color, 1);
            let lx = this.physics2DToLaya(cx - hw);
            let rx = this.physics2DToLaya(cx + hw);
            let ty = this.physics2DToLaya(cy - hh);
            let by = this.physics2DToLaya(cy + hh);
            this._debugDraw.appendLineSegment(lx, ty, rx, ty, outColor);
            this._debugDraw.appendLineSegment(lx, by, rx, by, outColor);
            this._debugDraw.appendLineSegment(lx, ty, lx, by, outColor);
            this._debugDraw.appendLineSegment(rx, ty, rx, by, outColor);
        }
        _dispatchEvent(type, contact) {
            contact = contact._endSnapshot || contact;
            let contactShapeA = Physics2D.I._factory.getContactShapeA(contact);
            let contactShapeB = Physics2D.I._factory.getContactShapeB(contact);
            if (contactShapeA == null || contactShapeB == null) {
                return;
            }
            if (type !== "triggerexit" && (contactShapeA.destroyed || contactShapeB.destroyed))
                return;
            let colliderA = contactShapeA.collider;
            let colliderB = contactShapeB.collider;
            if (colliderA == null || colliderB == null) {
                return;
            }
            if (colliderA.destroyed || colliderB.destroyed) {
                return;
            }
            let ownerA = colliderA.owner;
            let ownerB = colliderB.owner;
            let __this = this;
            let _hitResult;
            if (!contact._eventSnapshot)
                contact.getHitInfo = function () {
                    if (contact._endSnapshot)
                        return contact._endSnapshot.getHitInfo();
                    if (!_hitResult)
                        _hitResult = new Physics2DContactHitResult();
                    let pointCount = Physics2D.I._factory.getContactWorldManifold(contact, _hitResult);
                    for (let i = 0; i < pointCount; i++) {
                        _hitResult.points[i].x = __this.physics2DToLaya(_hitResult.points[i].x);
                        _hitResult.points[i].y = __this.physics2DToLaya(_hitResult.points[i].y);
                        _hitResult.separations[i] = __this.physics2DToLaya(_hitResult.separations[i]);
                    }
                    return _hitResult;
                };
            if (ownerA) {
                var args = [colliderB, colliderA, contact];
                ownerA.event(type, args);
            }
            if (ownerB && this._box2DWorld && !colliderA.destroyed && !colliderB.destroyed) {
                args = [colliderA, colliderB, contact];
                ownerB.event(type, args);
            }
        }
    }
    Physics2DWorldManager.__managerName = "Physics2DWorldManager";
    Laya.Scene.regManager(Physics2DWorldManager.__managerName, Physics2DWorldManager);

    const _tempWorldPoint = new Laya.Point();
    const _tempBodyPosition = new Laya.Vector2();
    class ColliderBase extends Laya.Component {
        get isConnectedJoint() {
            return this._isConnectedJoint;
        }
        set isConnectedJoint(value) {
            this._isConnectedJoint = value;
        }
        get inertia() {
            let inertia;
            if (this._useAutoMass) {
                inertia = this.getInertia();
            }
            else {
                inertia = this._inertia;
            }
            return inertia;
        }
        set inertia(value) {
            this._inertia = value;
            if (!this._useAutoMass) {
                this._box2DBody && Physics2D.I._factory.set_rigidBody_Mass(this._box2DBody, this._mass, this._centerOfMass, this._inertia, this._massData);
            }
        }
        get centerOfMass() {
            let center;
            if (this._useAutoMass && this._box2DBody) {
                center = Physics2D.I._factory.get_rigidBody_Center(this._box2DBody);
                this._centerOfMass.x = center.x;
                this._centerOfMass.y = center.y;
            }
            else {
                center = this._centerOfMass;
            }
            return center;
        }
        set centerOfMass(value) {
            if (value instanceof Laya.Vector2) {
                this._centerOfMass = value;
            }
            else {
                this._centerOfMass.x = value.x;
                this._centerOfMass.y = value.y;
            }
            if (!this._useAutoMass) {
                this._box2DBody && Physics2D.I._factory.set_rigidBody_Mass(this._box2DBody, this._mass, this._centerOfMass, this._inertia, this._massData);
            }
        }
        get mass() {
            let mass;
            if (this._useAutoMass && this._box2DBody) {
                mass = Physics2D.I._factory.get_rigidBody_Mass(this._box2DBody);
            }
            else {
                mass = this._mass;
            }
            return mass;
        }
        set mass(value) {
            this._mass = value;
            if (!this._useAutoMass) {
                this._box2DBody && Physics2D.I._factory.set_rigidBody_Mass(this._box2DBody, this._mass, this._centerOfMass, this._inertia, this._massData);
            }
        }
        get useAutoMass() {
            return this._useAutoMass;
        }
        set useAutoMass(value) {
            if (this._useAutoMass === value)
                return;
            this._useAutoMass = value;
            this._resetMassData();
        }
        _resetMassData() {
            if (!this._box2DBody || this._box2DBody.destroyed)
                return;
            const factory = Physics2D.I._factory;
            if (this._useAutoMass)
                factory.retSet_rigidBody_MassData(this._box2DBody);
            else if (this._massData)
                factory.set_rigidBody_Mass(this._box2DBody, this._mass, this._centerOfMass, this._inertia, this._massData);
        }
        get isAwake() {
            if (this._box2DBody) {
                this._isAwake = Physics2D.I._factory.get_rigidBody_IsAwake(this._box2DBody);
            }
            return this._isAwake;
        }
        set isAwake(value) {
            this._isAwake = value;
            this._box2DBody && Physics2D.I._factory.set_rigidBody_Awake(this._box2DBody, value);
        }
        get scaleX() {
            return Physics2D.getDesignScaleX(this.owner);
        }
        get scaleY() {
            return Physics2D.getDesignScaleY(this.owner);
        }
        get pivotoffx() {
            return this._x - this.owner.pivotX;
        }
        get pivotoffy() {
            return this._y - this.owner.pivotY;
        }
        get x() {
            return this._x;
        }
        set x(value) {
            if (this._x == value)
                return;
            this._x = value;
            this._needupdataShapeAttribute();
        }
        get y() {
            return this._y;
        }
        set y(value) {
            if (this._y == value)
                return;
            this._y = value;
            this._needupdataShapeAttribute();
        }
        constructor() {
            super();
            this._isAwake = true;
            this._useAutoMass = true;
            this._mass = 1;
            this._inertia = 10;
            this._centerOfMass = new Laya.Vector2(0.5, 0.5);
            this._bodyDef = new RigidBody2DInfo();
            this._x = 0;
            this._y = 0;
            this._isConnectedJoint = false;
            this._lastPhysicsScaleX = NaN;
            this._lastPhysicsScaleY = NaN;
            this._shapeDef = new Box2DShapeDef();
            this._isSensor = false;
            this._density = 10;
            this._friction = 0.2;
            this._restitution = 0;
            this._singleton = false;
        }
        getBox2DBody() {
            if (this._box2DBody) {
                return this._box2DBody;
            }
        }
        getInertia() {
            if (!this._box2DBody)
                return this._inertia;
            return Physics2D.I._factory.get_rigidBody_Inertia(this._box2DBody);
        }
        _onEnable() {
            this._getPhysicsManager();
            this._box2DBodyDef = Physics2D.I._factory.createBodyDef(this._physics2DManager.box2DWorld, this._bodyDef);
            this._box2DBody = Physics2D.I._factory.createBody(this._physics2DManager.box2DWorld, this._box2DBodyDef);
            this.owner.on(Laya.SpriteGlobalTransform.CHANGED, this, this._onOwnerGlobalTransformChanged);
            this._lastPhysicsScaleX = this.scaleX;
            this._lastPhysicsScaleY = this.scaleY;
        }
        _getPhysicsManager() {
            var _a, _b;
            this._physics2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.getComponentElementManager(Physics2DWorldManager.__managerName);
        }
        getWorldPoint(x, y) {
            return Physics2D.localToDesignPoint(this.owner, x, y, _tempWorldPoint);
        }
        _onOwnerGlobalTransformChanged() {
            const scaleX = this.scaleX;
            const scaleY = this.scaleY;
            const scaleChanged = Math.abs(scaleX - this._lastPhysicsScaleX) > 1e-6
                || Math.abs(scaleY - this._lastPhysicsScaleY) > 1e-6;
            if (scaleChanged) {
                this._lastPhysicsScaleX = scaleX;
                this._lastPhysicsScaleY = scaleY;
                this._onPhysicsScaleChanged();
                this.owner.event("shapeChange");
            }
            this._updateStaticBodyTransform();
        }
        _onPhysicsScaleChanged() {
            if (this._rigidbody && this._rigidbody.applyOwnerColliderComponent) {
                this.createShape(this._rigidbody);
            }
        }
        _updateStaticBodyTransform() {
            const sp = this.owner;
            if (this._box2DBody) {
                Physics2D.getDesignPosition(sp, _tempWorldPoint);
                const factory = Physics2D.I._factory;
                factory.get_RigidBody_Position(this._box2DBody, _tempBodyPosition);
                const angle = Physics2D.getDesignRotation(sp) * Math.PI / 180;
                const oldAngle = factory.get_RigidBody_Angle(this._box2DBody);
                if (Math.abs(_tempBodyPosition.x - _tempWorldPoint.x) > 1e-4
                    || Math.abs(_tempBodyPosition.y - _tempWorldPoint.y) > 1e-4
                    || Math.abs(oldAngle - angle) > 1e-6) {
                    factory.set_RigibBody_Transform(this._box2DBody, _tempWorldPoint.x, _tempWorldPoint.y, angle);
                    factory.set_rigidBody_Awake(this._box2DBody, true);
                }
            }
        }
        _needupdataShapeAttribute() {
            if (this._rigidbody && this._rigidbody.applyOwnerColliderComponent) {
                this.createShape(this._rigidbody);
            }
            this._lastPhysicsScaleX = this.scaleX;
            this._lastPhysicsScaleY = this.scaleY;
            this._updateStaticBodyTransform();
            this.owner.event("shapeChange");
        }
        _onDisable() {
            this._box2DBody && Physics2D.I._factory.removeBody(this._physics2DManager.box2DWorld, this._box2DBody);
            this._box2DBody = null;
            this._box2DBodyDef && Physics2D.I._factory.destroyData(this._box2DBodyDef);
            this._box2DBodyDef = null;
            this.owner.off(Laya.SpriteGlobalTransform.CHANGED, this, this._onOwnerGlobalTransformChanged);
        }
        _onDestroy() {
            this._box2DBody && Physics2D.I._factory.removeBody(this._physics2DManager.box2DWorld, this._box2DBody);
            this._box2DBodyDef && Physics2D.I._factory.destroyData(this._box2DBodyDef);
            this._box2DBody = null;
            this._box2DBodyDef = null;
        }
        get isSensor() {
            return this._isSensor;
        }
        set isSensor(value) {
            if (this._isSensor == value)
                return;
            this._isSensor = value;
            this._needupdataShapeAttribute();
        }
        get density() {
            return this._density;
        }
        set density(value) {
            if (this._density == value)
                return;
            this._density = value;
            this._needupdataShapeAttribute();
        }
        get friction() {
            return this._friction;
        }
        set friction(value) {
            if (this._friction == value)
                return;
            this._friction = value;
            this._needupdataShapeAttribute();
        }
        get restitution() {
            return this._restitution;
        }
        set restitution(value) {
            if (this._restitution == value)
                return;
            this._restitution = value;
            this._needupdataShapeAttribute();
        }
        createShape(collider) {
        }
        _setRigidbodyValue(collider) {
        }
    }

    const _tempV0$1 = new Laya.Vector2();
    const _tempP0 = new Laya.Point();
    class RigidBody extends ColliderBase {
        get body() {
            return this._box2DBody;
        }
        get type() {
            return this._type;
        }
        set type(value) {
            if (value !== "dynamic" && value !== "kinematic") {
                console.warn("Rigidbody only can set as dynamic or kinematic.");
            }
            this._type = value;
            this._updateBodyType();
        }
        get gravityScale() {
            return this._gravityScale;
        }
        set gravityScale(value) {
            this._gravityScale = value;
            if (this._box2DBody)
                Physics2D.I._factory.set_rigidBody_gravityScale(this._box2DBody, value);
        }
        get allowRotation() {
            return this._allowRotation;
        }
        set allowRotation(value) {
            this._allowRotation = value;
            if (this._box2DBody)
                Physics2D.I._factory.set_rigidBody_allowRotation(this._box2DBody, value);
        }
        get allowSleep() {
            return this._allowSleep;
        }
        set allowSleep(value) {
            this._allowSleep = value;
            if (this._box2DBody)
                Physics2D.I._factory.set_rigidBody_allowSleep(this._box2DBody, value);
        }
        get angularDamping() {
            return this._angularDamping;
        }
        set angularDamping(value) {
            this._angularDamping = value;
            if (this._box2DBody)
                Physics2D.I._factory.set_rigidBody_angularDamping(this._box2DBody, value);
        }
        get angularVelocity() {
            if (this._box2DBody)
                return Physics2D.I._factory.get_rigidBody_angularVelocity(this._box2DBody);
            return this._angularVelocity;
        }
        set angularVelocity(value) {
            this._angularVelocity = value;
            if (this._type == "static") {
                return;
            }
            if (this._box2DBody)
                Physics2D.I._factory.set_rigidBody_angularVelocity(this._box2DBody, value);
        }
        get linearDamping() {
            return this._linearDamping;
        }
        set linearDamping(value) {
            this._linearDamping = value;
            if (this._box2DBody)
                Physics2D.I._factory.set_rigidBody_linearDamping(this._box2DBody, value);
        }
        get linearVelocity() {
            if (this._box2DBody) {
                var vec = Physics2D.I._factory.get_rigidBody_linearVelocity(this._box2DBody);
                vec.x = vec.x;
                vec.y = vec.y;
                return { x: vec.x, y: vec.y };
            }
            return this._linearVelocity;
        }
        set linearVelocity(value) {
            if (!value)
                return;
            if (value instanceof Array) {
                throw new Error('set linearVelocity: value is not implement IV2');
            }
            this._linearVelocity = value;
            if (this._type == "static") {
                return;
            }
            if (this._box2DBody)
                Physics2D.I._factory.set_rigidBody_linearVelocity(this._box2DBody, value);
        }
        get bullet() {
            return this._bullet;
        }
        set bullet(value) {
            this._bullet = value;
            if (this._box2DBody)
                Physics2D.I._factory.set_rigidBody_bullet(this._box2DBody, value);
        }
        get shapes() {
            return this._shapes;
        }
        set shapes(shapes) {
            const next = shapes || [];
            for (const shape of this._shapes || []) {
                if (next.indexOf(shape) < 0)
                    shape.destroy();
            }
            this._shapes = shapes;
            if (shapes)
                this.applyOwnerColliderComponent = false;
            shapes = next;
            shapes.forEach((shape) => {
                shape.setCollider(this);
            });
            if (this._useAutoMass) {
                this._box2DBody && Physics2D.I._factory.retSet_rigidBody_MassData(this._box2DBody);
            }
            else {
                this._box2DBody && Physics2D.I._factory.set_rigidBody_Mass(this._box2DBody, this._mass, this._centerOfMass, this._inertia, this._massData);
            }
        }
        get applyOwnerColliderComponent() {
            return this._applyOwnerColliderComponent;
        }
        set applyOwnerColliderComponent(value) {
            this._applyOwnerColliderComponent = value;
        }
        set position(pos) {
            if (!this._box2DBody)
                return;
            var factory = Physics2D.I._factory;
            let rotateValue = factory.get_RigidBody_Angle(this._box2DBody);
            _tempP0.x = pos.x;
            _tempP0.y = pos.y;
            let globalPos = this.owner.parent.localToGlobal(_tempP0);
            factory.set_RigibBody_Transform(this._box2DBody, globalPos.x, globalPos.y, rotateValue);
            factory.set_rigidBody_Awake(this._box2DBody, true);
            Physics2D.I._addRigidBody(this);
        }
        get position() {
            if (!this._box2DBody) {
                _tempP0.x = this.owner.x;
                _tempP0.y = this.owner.y;
                return _tempP0;
            }
            var pos = Laya.Vector2.TEMP;
            Physics2D.I._factory.get_RigidBody_Position(this._box2DBody, pos);
            _tempP0.x = pos.x;
            _tempP0.y = pos.y;
            let localPos = this.owner.parent.globalToLocal(_tempP0);
            _tempP0.x = localPos.x;
            _tempP0.y = localPos.y;
            return _tempP0;
        }
        set rotation(number) {
            if (!this._box2DBody)
                return;
            var factory = Physics2D.I._factory;
            var pos = Laya.Vector2.TEMP;
            factory.get_RigidBody_Position(this._box2DBody, pos);
            pos.setValue(pos.x, pos.y);
            factory.set_RigibBody_Transform(this._box2DBody, pos.x, pos.y, Laya.Utils.toRadian(number));
            factory.set_rigidBody_Awake(this._box2DBody, true);
            Physics2D.I._addRigidBody(this);
        }
        get rotation() {
            if (!this._box2DBody)
                return this.owner.rotation;
            return Laya.Utils.toAngle(Physics2D.I._factory.get_RigidBody_Angle(this._box2DBody));
        }
        constructor() {
            super();
            this._allowSleep = true;
            this._angularVelocity = 0;
            this._angularDamping = 0;
            this._linearVelocity = { x: 0, y: 0 };
            this._linearDamping = 0;
            this._bullet = false;
            this._allowRotation = true;
            this._gravityScale = 1;
            this._colliders = [];
            this.group = 0;
            this.category = 1;
            this.mask = -1;
            this.label = "RigidBody";
            this._applyOwnerColliderComponent = true;
            this._type = "dynamic";
            this._massData = Physics2D.I._factory.createMassData();
        }
        _updateBodyType() {
            if (!this._box2DBody)
                return;
            Physics2D.I._factory.set_rigidBody_type(this._box2DBody, this._type);
            if (this.type == "static") {
                Physics2D.I._removeRigidBody(this);
            }
            else {
                Physics2D.I._addRigidBody(this);
            }
        }
        _globalChangeHandler(flag) {
            this._updatePhysicsTransformToRender();
        }
        _onPhysicsScaleChanged() {
            if (this.applyOwnerColliderComponent) {
                for (let i = 0, n = this._colliders.length; i < n; i++) {
                    this._colliders[i].createShape(this);
                }
            }
            else if (this._shapes) {
                for (let i = 0, n = this._shapes.length; i < n; i++) {
                    this._shapes[i].setCollider(this);
                }
                if (this._useAutoMass) {
                    this._box2DBody && Physics2D.I._factory.retSet_rigidBody_MassData(this._box2DBody);
                }
                else {
                    this._box2DBody && Physics2D.I._factory.set_rigidBody_Mass(this._box2DBody, this._mass, this._centerOfMass, this._inertia, this._massData);
                }
            }
        }
        _onAwake() {
            this.owner.globalTrans.cache = true;
        }
        _setBodyDefValue() {
            if (this._type == "static") {
                let owner = this.owner;
                Physics2D.getDesignPosition(owner, _tempP0);
                this._bodyDef.position.setValue(_tempP0.x, _tempP0.y);
                this._bodyDef.angle = Laya.Utils.toRadian(Physics2D.getDesignRotation(owner));
                this._bodyDef.allowSleep = false;
                this._bodyDef.angularVelocity = 0;
                this._bodyDef.angularDamping = 0;
                this._bodyDef.linearDamping = 0;
                this._bodyDef.linearVelocity.setValue(0, 0);
                this._bodyDef.bullet = false;
                this._bodyDef.fixedRotation = false;
                this._bodyDef.gravityScale = 0;
                return;
            }
            let owner = this.owner;
            Physics2D.getDesignPosition(owner, _tempP0);
            this._bodyDef.position.setValue(_tempP0.x, _tempP0.y);
            this._bodyDef.angle = Laya.Utils.toRadian(Physics2D.getDesignRotation(owner));
            this._bodyDef.fixedRotation = !this._allowRotation;
            this._bodyDef.allowSleep = this._allowSleep;
            this._bodyDef.angularVelocity = this._angularVelocity;
            this._bodyDef.angularDamping = this._angularDamping;
            this._bodyDef.linearDamping = this._linearDamping;
            if (this._linearVelocity.x != 0 || this._linearVelocity.y != 0) {
                this._bodyDef.linearVelocity.setValue(this._linearVelocity.x, this._linearVelocity.y);
            }
            this._bodyDef.type = this._type;
            this._bodyDef.bullet = this._bullet;
            this._bodyDef.gravityScale = this._gravityScale;
            this._bodyDef.group = this.group;
        }
        _onEnable() {
            this.owner.globalTrans.cache = true;
            this._setBodyDefValue();
            super._onEnable();
            this._updateBodyType();
            if (this.applyOwnerColliderComponent) {
                this._colliders = this.owner.getComponents(ColliderBase);
                this._colliders.forEach((collider) => {
                    collider.createShape(this);
                });
            }
            else {
                this.shapes = this._shapes;
            }
            if (this.isConnectedJoint) {
                this.owner.event("bodyCreated");
                this.isConnectedJoint = false;
            }
            this.angularVelocity = this._angularVelocity;
            this.linearVelocity = this._linearVelocity;
        }
        getBody() {
            if (!this._box2DBody)
                this._onAwake();
            return this._box2DBody;
        }
        _updatePhysicsTransformToRender() {
            if (this.type == "static") {
                return;
            }
            var factory = Physics2D.I._factory;
            if (Physics2D.I._factory.get_rigidBody_IsAwake(this._box2DBody)) {
                var pos = Laya.Vector2.TEMP;
                factory.get_RigidBody_Position(this._box2DBody, pos);
                Physics2D.setDesignPosition(this.owner, pos.x, pos.y, _tempP0);
                Physics2D.setDesignRotation(this.owner, Laya.Utils.toAngle(factory.get_RigidBody_Angle(this._box2DBody)));
            }
        }
        _destroyAllShape() {
            if (this._box2DBody) {
                const colliders = this.owner.getComponents(StaticCollider);
                for (const collider of colliders || []) {
                    if (collider.getBox2DBody() === this._box2DBody)
                        collider._removeShapeAndDestroyData();
                }
            }
            if (!this._shapes)
                return;
            for (let i = 0; i < this._shapes.length; i++) {
                let shape = this._shapes[i];
                shape.destroy();
            }
        }
        _onDisable() {
            Physics2D.I._removeRigidBody(this);
            this._destroyAllShape();
            super._onDisable();
        }
        _onDestroy() {
            this._destroyAllShape();
            Physics2D.I._removeRigidBody(this);
            this._box2DBody && Physics2D.I._factory.removeBody(this._physics2DManager.box2DWorld, this._box2DBody);
            super._onDestroy();
            Physics2D.I._factory.destroyData(this._massData);
            this._massData = null;
        }
        getUserData() {
            if (!this._box2DBody)
                return;
            return Physics2D.I._factory.get_rigidBody_userData(this._box2DBody);
        }
        getLinearVelocityFromWorldPoint(worldPoint) {
            if (!this._box2DBody)
                return _tempV0$1;
            let velocity = Physics2D.I._factory.get_rigidBody_linearVelocityFromWorldPoint(this._box2DBody, worldPoint);
            _tempV0$1.x = velocity.x;
            _tempV0$1.y = velocity.y;
            return _tempV0$1;
        }
        getLinearVelocityFromLocalPoint(localPoint) {
            if (!this._box2DBody)
                return _tempV0$1;
            let velocity = Physics2D.I._factory.get_rigidBody_linearVelocityFromLocalPoint(this._box2DBody, localPoint);
            _tempV0$1.x = velocity.x;
            _tempV0$1.y = velocity.y;
            return _tempV0$1;
        }
        applyForce(position, force, wake = true) {
            if (!this._box2DBody)
                return;
            Physics2D.I._factory.rigidBody_applyForce(this._box2DBody, force, position, wake);
        }
        applyForceToCenter(force, wake = true) {
            if (!this._box2DBody)
                return;
            Physics2D.I._factory.rigidBody_applyForceToCenter(this._box2DBody, force, wake);
        }
        applyLinearImpulse(position, impulse, wake = true) {
            if (!this._box2DBody)
                return;
            Physics2D.I._factory.rigidbody_ApplyLinearImpulse(this._box2DBody, impulse, position, wake);
        }
        applyLinearImpulseToCenter(impulse, wake = true) {
            if (!this._box2DBody)
                return;
            Physics2D.I._factory.rigidbody_ApplyLinearImpulseToCenter(this._box2DBody, impulse, wake);
        }
        applyAngularImpulse(impulse, wake = true) {
            if (!this._box2DBody)
                return;
            Physics2D.I._factory.rigidbody_ApplyAngularImpulse(this._box2DBody, impulse, wake);
        }
        applyTorque(torque, wake = true) {
            if (!this._box2DBody)
                return;
            Physics2D.I._factory.rigidbody_applyTorque(this._box2DBody, torque, wake);
        }
        setVelocity(velocity) {
            if (!this._box2DBody)
                return;
            Physics2D.I._factory.set_rigidBody_linearVelocity(this._box2DBody, velocity);
        }
        setAngle(value) {
            if (!this._box2DBody)
                return;
            var factory = Physics2D.I._factory;
            Physics2D.getDesignPosition(this.owner, _tempP0);
            factory.set_RigibBody_Transform(this._box2DBody, _tempP0.x, _tempP0.y, Laya.Utils.toRadian(value));
            factory.set_rigidBody_Awake(this._box2DBody, true);
        }
        getMass() {
            return this._box2DBody ? Physics2D.I._factory.get_rigidBody_Mass(this._box2DBody) : 0;
        }
        getCenter() {
            let center = this._box2DBody ? Physics2D.I._factory.get_rigidBody_Center(this._box2DBody) : null;
            center.x = center.x;
            center.y = center.y;
            return center;
        }
        getInertia() {
            if (!this._box2DBody)
                return this._inertia;
            return Physics2D.I._factory.get_rigidBody_Inertia(this._box2DBody);
        }
        getWorldCenter() {
            let center = this._box2DBody ? Physics2D.I._factory.get_rigidBody_WorldCenter(this._box2DBody) : null;
            center.x = center.x;
            center.y = center.y;
            return center;
        }
        getWorldPoint(x, y) {
            return Physics2D.localToDesignPoint(this.owner, x, y, _tempP0);
        }
        getLocalPoint(x, y) {
            return Physics2D.designToLocalPoint(this.owner, x, y, _tempP0);
        }
    }

    class StaticCollider extends ColliderBase {
        get type() {
            return this._type;
        }
        set type(value) {
            if (value != "static") {
                console.warn("StaticCollider only can set as static.");
                value = "static";
            }
            this._type = value;
        }
        get shapes() {
            return this._shapes;
        }
        set shapes(value) {
            const next = value || [];
            for (const shape of this._shapes || []) {
                if (next.indexOf(shape) < 0)
                    shape.destroy();
            }
            this._shapes = value = next;
            value.forEach((shape) => {
                shape.setCollider(this);
            });
        }
        constructor() {
            super();
            this.label = "StaticCollider";
            this._shapes = [];
        }
        _setBodyDefValue() {
            let owner = this.owner;
            Physics2D.getDesignPosition(owner, _tempPosition);
            this._bodyDef.position.setValue(_tempPosition.x, _tempPosition.y);
            this._bodyDef.angle = Laya.Utils.toRadian(Physics2D.getDesignRotation(owner));
            this._bodyDef.allowSleep = false;
            this._bodyDef.angularVelocity = 0;
            this._bodyDef.angularDamping = 0;
            this._bodyDef.linearDamping = 0;
            this._bodyDef.linearVelocity.setValue(0, 0);
            this._bodyDef.bullet = false;
            this._bodyDef.fixedRotation = false;
            this._bodyDef.gravityScale = 0;
        }
        _onAwake() {
            this.owner.globalTrans.cache = true;
        }
        _onEnable() {
            this._getPhysicsManager();
            this.owner.globalTrans.cache = true;
            let rig = this.owner.getComponent(RigidBody);
            if (rig && rig.applyOwnerColliderComponent) {
                this._setRigidbodyValue(rig);
                this.createShape(rig);
            }
            else {
                this._setBodyDefValue();
                super._onEnable();
                this.shapes = this._shapes;
            }
            if (this.isConnectedJoint) {
                this.owner.event("bodyCreated");
                this.isConnectedJoint = false;
            }
        }
        _onPhysicsScaleChanged() {
            if (this._rigidbody) {
                super._onPhysicsScaleChanged();
                return;
            }
            if (!this._shapes)
                return;
            for (let i = 0, n = this._shapes.length; i < n; i++) {
                this._shapes[i].setCollider(this);
            }
        }
        _removeShapeAndDestroyData() {
            if (this._rigidbody) {
                let body = this._box2DBody;
                if (body && !body.destroyed && this._box2DShape) {
                    Physics2D.I._factory.destroyShape(this._physics2DManager.box2DWorld, body, this._box2DShape);
                }
            }
            else {
                if (this._shapes) {
                    for (let i = 0; i < this._shapes.length; i++) {
                        let shape = this._shapes[i];
                        shape.destroy();
                    }
                }
                if (this._box2DBody) {
                    Physics2D.I._factory.removeBody(this._physics2DManager.box2DWorld, this._box2DBody);
                }
            }
            this._box2DFilter && Physics2D.I._factory.destroyData(this._box2DFilter);
            if (this._box2DShapeDef && this._box2DShapeDef._shape) {
                Physics2D.I._factory.destroyData(this._box2DShapeDef._shape);
                this._box2DShapeDef._shape = null;
            }
            this._box2DShapeDef && Physics2D.I._factory.destroyData(this._box2DShapeDef);
            this._box2DBody = null;
            this._box2DFilter = null;
            this._box2DShape = null;
            this._box2DShapeDef = null;
        }
        _onDisable() {
            this._removeShapeAndDestroyData();
            super._onDisable();
        }
        _onDestroy() {
            this._shapeDef = null;
            this._removeShapeAndDestroyData();
            this._shapes = null;
            super._onDestroy();
        }
        createShape(collider) {
            if (!collider)
                return;
            const body = collider.getBox2DBody();
            if (!body || body.destroyed)
                return;
            this._getPhysicsManager();
            this._setRigidbodyValue(collider);
            this._rigidbody = collider;
            this._box2DBody = body;
            if (this._box2DShape) {
                Physics2D.I._factory.destroyShape(this._physics2DManager.box2DWorld, this._box2DBody, this._box2DShape);
                if (this._box2DShapeDef && this._box2DShapeDef._shape) {
                    Physics2D.I._factory.destroyData(this._box2DShapeDef._shape);
                    this._box2DShapeDef._shape = null;
                }
                Physics2D.I._factory.destroyData(this._box2DShapeDef);
                this._box2DShape = null;
                this._box2DShapeDef = null;
            }
            if (!this._box2DFilter) {
                this._box2DFilter = Physics2D.I._factory.createFilter();
                this._box2DFilter.groupIndex = collider.group;
                this._box2DFilter.categoryBits = collider.category;
                this._box2DFilter.maskBits = collider.mask;
            }
            else {
                this._box2DFilter.groupIndex = collider.group;
                this._box2DFilter.categoryBits = collider.category;
                this._box2DFilter.maskBits = collider.mask;
            }
            this._box2DShapeDef = Physics2D.I._factory.createShapeDef(this._physics2DManager.box2DWorld, this._shapeDef, this._box2DFilter);
            this._setShapeData(this._box2DShapeDef._shape);
            this._box2DShape = Physics2D.I._factory.createShape(this._physics2DManager.box2DWorld, this._box2DBody, this._shapeDef.shapeType, this._box2DShapeDef);
            Physics2D.I._factory.set_shape_collider(this._box2DShape, this);
        }
        _setShapeData(shape) {
        }
        _setRigidbodyValue(collider) {
            this._shapeDef.density = this.density;
            this._shapeDef.friction = this.friction;
            this._shapeDef.isSensor = this.isSensor;
            this._shapeDef.restitution = this.restitution;
            this._shapeDef.filter.group = collider.group;
            this._shapeDef.filter.category = collider.category;
            this._shapeDef.filter.mask = collider.mask;
        }
    }
    const _tempPosition = new Laya.Point();

    class BoxCollider extends StaticCollider {
        get width() {
            return this._width;
        }
        set width(value) {
            if (value <= 0)
                throw "BoxCollider size cannot be less than 0";
            if (this._width == value)
                return;
            this._width = value;
            this._rigidbody && this.createShape(this._rigidbody);
        }
        get height() {
            return this._height;
        }
        set height(value) {
            if (value <= 0)
                throw "BoxCollider size cannot be less than 0";
            if (this._height == value)
                return;
            this._height = value;
            this._rigidbody && this.createShape(this._rigidbody);
        }
        constructor() {
            super();
            this._width = 100;
            this._height = 100;
            this._shapeDef.shapeType = exports.EPhysics2DShape.BoxShape;
        }
        _setShapeData(shape) {
            if (!shape)
                return;
            let helfW = this._width * 0.5;
            let helfH = this._height * 0.5;
            var center = {
                x: helfW + this.pivotoffx,
                y: helfH + this.pivotoffy
            };
            Physics2D.I._factory.set_collider_SetAsBox(shape, helfW, helfH, center, Math.abs(this.scaleX), Math.abs(this.scaleY));
        }
    }

    class ChainCollider extends StaticCollider {
        get points() {
            return this._points;
        }
        set points(value) {
            if (!value)
                throw "ChainCollider points cannot be empty";
            this._points = value;
            var arr = this._points.split(",");
            let length = arr.length;
            this._datas = [];
            for (var i = 0, n = length; i < n; i++) {
                this._datas.push(parseInt(arr[i]));
            }
            this._rigidbody && this.createShape(this._rigidbody);
        }
        get datas() {
            return this._datas;
        }
        set datas(value) {
            if (!value)
                throw "ChainCollider datas cannot be empty";
            this._datas = value;
            this._rigidbody && this.createShape(this._rigidbody);
        }
        get loop() {
            return this._loop;
        }
        set loop(value) {
            if (this._loop == value)
                return;
            this._loop = value;
            if (this._datas.length <= 4) {
                console.warn("To loop Chain, the length of points must be greater than 4");
                return;
            }
            this._rigidbody && this.createShape(this._rigidbody);
        }
        constructor() {
            super();
            this._points = "0,0,100,0";
            this._datas = [0, 0, 100, 0];
            this._loop = false;
            this._shapeDef.shapeType = exports.EPhysics2DShape.ChainShape;
        }
        _setShapeData(shape) {
            if (!shape)
                return;
            var len = this._datas.length;
            if (len % 2 == 1)
                throw "ChainCollider datas lenth must a multiplier of 2";
            Physics2D.I._factory.set_ChainShape_data(shape, this.pivotoffx, this.pivotoffy, this._datas, this._loop, this.scaleX, this.scaleY);
        }
        onAdded() {
            super.onAdded();
            if (this._datas.length == 0) {
                let sp = this.owner;
                this._datas.push(0, 0, sp.width, 0, 0, sp.height, sp.width, sp.height);
            }
        }
    }

    class CircleCollider extends StaticCollider {
        get radius() {
            return this._radius;
        }
        set radius(value) {
            if (value <= 0)
                throw "CircleCollider radius cannot be less than 0";
            if (this._radius == value)
                return;
            this._radius = value;
            this._rigidbody && this.createShape(this._rigidbody);
        }
        constructor() {
            super();
            this._radius = 50;
            this._shapeDef.shapeType = exports.EPhysics2DShape.CircleShape;
        }
        _setShapeData(shape) {
            if (!shape)
                return;
            var scale = Math.max(Math.abs(this.scaleX), Math.abs(this.scaleY));
            let radius = this.radius;
            Physics2D.I._factory.set_CircleShape_radius(shape, radius, scale);
            Physics2D.I._factory.set_CircleShape_pos(shape, this.x, this.y, this.scaleX, this.scaleY);
        }
    }

    class EdgeCollider extends StaticCollider {
        get points() {
            return this._points;
        }
        set points(value) {
            if (!value)
                throw "EdgeCollider points cannot be empty";
            this._points = value;
            var arr = this._points.split(",");
            let length = arr.length;
            this._datas = [];
            for (var i = 0, n = length; i < n; i++) {
                this._datas.push(parseInt(arr[i]));
            }
            this._rigidbody && this.createShape(this._rigidbody);
        }
        get datas() {
            return this._datas;
        }
        set datas(value) {
            if (!value)
                throw "EdgeCollider points cannot be empty";
            this._datas = value;
            this._rigidbody && this.createShape(this._rigidbody);
        }
        constructor() {
            super();
            this._points = "0,0,100,0";
            this._datas = [0, 0, 100, 0];
            this._shapeDef.shapeType = exports.EPhysics2DShape.EdgeShape;
        }
        _setShapeData(shape) {
            if (!shape)
                return;
            var len = this._datas.length;
            if (len % 2 == 1)
                throw "EdgeCollider points lenth must a multiplier of 2";
            Physics2D.I._factory.set_EdgeShape_data(shape, this.pivotoffx, this.pivotoffy, this._datas, this.scaleX, this.scaleY);
        }
    }

    class PolygonCollider extends StaticCollider {
        get points() {
            return this._points;
        }
        set points(value) {
            if (!value)
                throw "PolygonCollider points cannot be empty";
            this._points = value;
            var arr = this._points.split(",");
            let length = arr.length;
            this._datas = [];
            for (var i = 0, n = length; i < n; i++) {
                this._datas.push(parseInt(arr[i]));
            }
            this._rigidbody && this.createShape(this._rigidbody);
        }
        get datas() {
            return this._datas;
        }
        set datas(value) {
            if (!value)
                throw "PolygonCollider points cannot be empty";
            this._datas = value;
            this._rigidbody && this.createShape(this._rigidbody);
        }
        constructor() {
            super();
            this._points = "50,0,100,100,0,100";
            this._datas = [50, 0, 100, 100, 0, 100];
            this._shapeDef.shapeType = exports.EPhysics2DShape.PolygonShape;
        }
        _setShapeData(shape) {
            if (!shape)
                return;
            var len = this.datas.length;
            if (len < 6)
                throw "PolygonCollider points must be greater than 3";
            if (len % 2 == 1)
                throw "PolygonCollider points lenth must a multiplier of 2";
            Physics2D.I._factory.set_PolygonShape_data(shape, this.pivotoffx, this.pivotoffy, this.datas, this.scaleX, this.scaleY);
        }
    }

    const _tempV0 = new Laya.Vector2();
    class JointBase extends Laya.Component {
        get joint() {
            if (!this._joint)
                this._createJoint();
            return this._joint;
        }
        constructor() {
            super();
            this._factory = Physics2D.I._factory;
            this._singleton = false;
        }
        getJointRecationForce() {
            let force;
            if (this._joint) {
                force = Physics2D.I._factory.get_joint_recationForce(this._joint);
            }
            _tempV0.x = force.x;
            _tempV0.y = force.y;
            return _tempV0;
        }
        getJointRecationTorque() {
            let torque;
            if (this._joint) {
                torque = Physics2D.I._factory.get_joint_reactionTorque(this._joint);
            }
            return torque;
        }
        isValid() {
            let isvalid = false;
            if (this._joint) {
                isvalid = Physics2D.I._factory.isValidJoint(this._joint);
            }
            return isvalid;
        }
        getBodyAnchor(body, anchorx, anchory) {
            const node = body.owner;
            Laya.Point.TEMP.setTo(anchorx * Physics2D.getDesignScaleX(node), anchory * Physics2D.getDesignScaleY(node));
            return Laya.Point.TEMP;
        }
        _onAdded() {
        }
        _onEnable() {
            this._createJoint();
        }
        _onAwake() {
        }
        _createJoint() {
        }
        _onDisable() {
            if (this._factory.isValidJoint(this._joint)) {
                Physics2D.I._factory.removeJoint(this._physics2DManager.box2DWorld, this._joint);
            }
            this._joint = null;
        }
    }

    class DistanceJoint extends JointBase {
        constructor() {
            super(...arguments);
            this._length = 0;
            this._maxLength = -1;
            this._minLength = -1;
            this._frequency = 1;
            this._dampingRatio = 0;
            this.selfAnchor = [0, 0];
            this.otherAnchor = [0, 0];
            this.collideConnected = false;
        }
        get length() {
            return this._length;
        }
        set length(value) {
            this._length = value;
            if (this._joint)
                this._factory.set_DistanceJoint_length(this._joint, value);
        }
        get minLength() {
            return this._minLength;
        }
        set minLength(value) {
            this._minLength = value;
            if (this._joint)
                this._factory.set_DistanceJoint_MinLength(this._joint, value);
        }
        get maxLength() {
            return this._maxLength;
        }
        set maxLength(value) {
            this._maxLength = value;
            if (this._joint)
                this._factory.set_DistanceJoint_MaxLength(this._joint, value);
        }
        get frequency() {
            return this._frequency;
        }
        set frequency(value) {
            this._frequency = value;
            if (this._joint) {
                this._factory.set_DistanceJointStiffnessDamping(this._joint, this._frequency, this._dampingRatio);
            }
        }
        get damping() {
            return this._dampingRatio;
        }
        set damping(value) {
            this._dampingRatio = value;
            if (this._joint) {
                this._factory.set_DistanceJointStiffnessDamping(this._joint, this._frequency, this._dampingRatio);
            }
        }
        get jointLength() {
            if (this._joint) {
                return Physics2D.I._factory.get_DistanceJoint_length(this._joint);
            }
            else {
                return 0;
            }
        }
        _createJoint() {
            var _a, _b;
            this._physics2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.getComponentElementManager(Physics2DWorldManager.__managerName);
            if (!this._joint) {
                this.selfBody = this.selfBody || this.owner.getComponent(RigidBody);
                if (!this.selfBody)
                    throw "selfBody can not be empty";
                let point = this.getBodyAnchor(this.selfBody, this.selfAnchor[0], this.selfAnchor[1]);
                var def = DistanceJoint._temp || (DistanceJoint._temp = new physics2D_DistancJointDef());
                def.bodyB = this.selfBody.getBox2DBody();
                if (!def.bodyB) {
                    this.selfBody.isConnectedJoint = true;
                    this.selfBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.localAnchorB.setValue(point.x, point.y);
                this.selfBody.owner.on("shapeChange", this, this._refeahJoint);
                if (this.otherBody) {
                    def.bodyA = this.otherBody.getBox2DBody();
                    if (!def.bodyA) {
                        this.otherBody.isConnectedJoint = true;
                        this.otherBody.owner.on("bodyCreated", this, this._createJoint);
                        return;
                    }
                    point = this.getBodyAnchor(this.otherBody, this.otherAnchor[0], this.otherAnchor[1]);
                    def.localAnchorA.setValue(point.x, point.y);
                    this.otherBody.owner.on("shapeChange", this, this._refeahJoint);
                }
                else {
                    def.bodyA = this._physics2DManager.getEmptyBody();
                    def.localAnchorA.setValue(this.otherAnchor[0], this.otherAnchor[1]);
                }
                def.dampingRatio = this._dampingRatio;
                def.frequency = this._frequency;
                def.collideConnected = this.collideConnected;
                def.length = this._length;
                def.maxLength = this._maxLength;
                def.minLength = this._minLength;
                this._box2DJointDef = Physics2D.I._factory.createJointDef(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.DistanceJoint, def);
                this._joint = this._factory.createJoint(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.DistanceJoint, this._box2DJointDef);
                this.selfBody.owner.off("bodyCreated", this._createJoint);
                if (this.otherBody)
                    this.otherBody.owner.off("bodyCreated", this._createJoint);
            }
        }
        _refeahJoint() {
            if (this._joint) {
                this._factory.set_DistanceJointStiffnessDamping(this._joint, this._frequency, this._dampingRatio);
            }
        }
        onDestroy() {
            super.onDestroy();
            this.selfBody.owner.off("shapeChange", this._refeahJoint);
            if (this.otherBody)
                this.otherBody.owner.off("shapeChange", this._refeahJoint);
        }
    }

    class PrismaticJoint extends JointBase {
        constructor() {
            super(...arguments);
            this._enableMotor = false;
            this._motorSpeed = 0;
            this._maxMotorForce = 10000;
            this._enableLimit = false;
            this._lowerTranslation = 0;
            this._upperTranslation = 0;
            this._axis = [1, 0];
            this.anchor = [0, 0];
            this.angle = 0;
            this.collideConnected = false;
        }
        get enableMotor() {
            return this._enableMotor;
        }
        set enableMotor(value) {
            this._enableMotor = value;
            if (this._joint)
                this._factory.set_Joint_EnableMotor(this._joint, value);
        }
        get motorSpeed() {
            return this._motorSpeed;
        }
        set motorSpeed(value) {
            this._motorSpeed = value;
            if (this._joint)
                this._factory.set_Joint_SetMotorSpeed(this._joint, value);
        }
        get maxMotorForce() {
            return this._maxMotorForce;
        }
        set maxMotorForce(value) {
            this._maxMotorForce = value;
            if (this._joint)
                this._factory.set_Joint_SetMaxMotorForce(this._joint, value);
        }
        get enableLimit() {
            return this._enableLimit;
        }
        set enableLimit(value) {
            this._enableLimit = value;
            if (this._joint)
                this._factory.set_Joint_EnableLimit(this._joint, value);
        }
        get lowerTranslation() {
            return this._lowerTranslation;
        }
        set lowerTranslation(value) {
            this._lowerTranslation = value;
            if (this._joint)
                this._factory.set_Joint_SetTranslationLimits(this._joint, value, this._upperTranslation);
        }
        get upperTranslation() {
            return this._upperTranslation;
        }
        set upperTranslation(value) {
            this._upperTranslation = value;
            if (this._joint)
                this._factory.set_Joint_SetTranslationLimits(this._joint, this._lowerTranslation, value);
        }
        get axis() {
            return this._axis;
        }
        set axis(value) {
            this._axis = value;
            this.angle = Laya.Utils.toAngle(Math.atan2(value[1], value[0]));
        }
        _createJoint() {
            var _a, _b;
            this._physics2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.getComponentElementManager(Physics2DWorldManager.__managerName);
            if (!this._joint) {
                this.selfBody = this.selfBody || this.owner.getComponent(ColliderBase);
                if (!this.selfBody)
                    throw "selfBody can not be empty";
                var def = PrismaticJoint._temp || (PrismaticJoint._temp = new physics2D_PrismaticJointDef());
                def.bodyB = this.selfBody.getBox2DBody();
                if (!def.bodyB) {
                    this.selfBody.isConnectedJoint = true;
                    this.selfBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.bodyA = this.otherBody ? this.otherBody.getBox2DBody() : this._physics2DManager.getEmptyBody();
                if (!def.bodyA) {
                    this.otherBody.isConnectedJoint = true;
                    this.otherBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                let p = this.selfBody.getWorldPoint(this.anchor[0], this.anchor[1]);
                def.anchor.setValue(p.x, p.y);
                let radian = Laya.Utils.toRadian(this.angle);
                def.axis.setValue(Math.cos(radian), Math.sin(radian));
                def.enableMotor = this._enableMotor;
                def.motorSpeed = this._motorSpeed;
                def.maxMotorForce = this._maxMotorForce;
                def.enableLimit = this._enableLimit;
                def.lowerTranslation = this._lowerTranslation;
                def.upperTranslation = this._upperTranslation;
                def.collideConnected = this.collideConnected;
                this._box2DJointDef = this._factory.createJointDef(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.PrismaticJoint, def);
                this._joint = this._factory.createJoint(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.PrismaticJoint, this._box2DJointDef);
                this.selfBody.owner.off("bodyCreated", this, this._createJoint);
                this.otherBody && this.otherBody.owner.off("bodyCreated", this, this._createJoint);
            }
        }
    }

    class RevoluteJoint extends JointBase {
        constructor() {
            super(...arguments);
            this._enableMotor = false;
            this._motorSpeed = 0;
            this._maxMotorTorque = 10000;
            this._enableLimit = false;
            this._lowerAngle = 0;
            this._upperAngle = 0;
            this.anchor = [0, 0];
            this.collideConnected = false;
        }
        get enableMotor() {
            return this._enableMotor;
        }
        set enableMotor(value) {
            this._enableMotor = value;
            if (this._joint)
                this._factory.set_Joint_EnableMotor(this._joint, value);
        }
        get motorSpeed() {
            return this._motorSpeed;
        }
        set motorSpeed(value) {
            this._motorSpeed = value;
            if (this._joint)
                this._factory.set_Joint_SetMotorSpeed(this._joint, value);
        }
        get maxMotorTorque() {
            return this._maxMotorTorque;
        }
        set maxMotorTorque(value) {
            this._maxMotorTorque = value;
            if (this._joint)
                this._factory.set_Joint_SetMaxMotorTorque(this._joint, value);
        }
        get enableLimit() {
            return this._enableLimit;
        }
        set enableLimit(value) {
            this._enableLimit = value;
            if (this._joint)
                this._factory.set_Joint_EnableLimit(this._joint, value);
        }
        get lowerAngle() {
            return this._lowerAngle;
        }
        set lowerAngle(value) {
            this._lowerAngle = value;
            if (this._joint)
                this._factory.set_Joint_SetLimits(this._joint, Laya.Utils.toRadian(value), Laya.Utils.toRadian(this._upperAngle));
        }
        get upperAngle() {
            return this._upperAngle;
        }
        set upperAngle(value) {
            this._upperAngle = value;
            if (this._joint)
                this._factory.set_Joint_SetLimits(this._joint, Laya.Utils.toRadian(this._lowerAngle), Laya.Utils.toRadian(value));
        }
        _createJoint() {
            var _a, _b;
            this._physics2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.getComponentElementManager(Physics2DWorldManager.__managerName);
            if (!this._joint) {
                this.selfBody = this.selfBody || this.owner.getComponent(ColliderBase);
                if (!this.selfBody)
                    throw "selfBody can not be empty";
                var def = RevoluteJoint._temp || (RevoluteJoint._temp = new physics2D_RevoluteJointDef());
                def.bodyB = this.selfBody.getBox2DBody();
                if (!def.bodyB) {
                    this.selfBody.isConnectedJoint = true;
                    this.selfBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.bodyA = this.otherBody ? this.otherBody.getBox2DBody() : this._physics2DManager.getEmptyBody();
                if (!def.bodyA) {
                    this.otherBody.isConnectedJoint = true;
                    this.otherBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                let global = this.selfBody.getWorldPoint(this.anchor[0], this.anchor[1]);
                def.anchor.setValue(global.x, global.y);
                def.enableMotor = this._enableMotor;
                def.motorSpeed = this._motorSpeed;
                def.maxMotorTorque = this._maxMotorTorque;
                def.enableLimit = this._enableLimit;
                def.lowerAngle = Laya.Utils.toRadian(this._lowerAngle);
                def.upperAngle = Laya.Utils.toRadian(this._upperAngle);
                def.collideConnected = this.collideConnected;
                this._box2DJointDef = this._factory.createJointDef(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.RevoluteJoint, def);
                this._joint = this._factory.createJoint(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.RevoluteJoint, this._box2DJointDef);
                this.selfBody.owner.off("bodyCreated", this, this._createJoint);
                this.otherBody && this.otherBody.owner.off("bodyCreated", this, this._createJoint);
            }
        }
    }

    class GearJoint extends JointBase {
        constructor() {
            super(...arguments);
            this._ratio = 1;
            this.collideConnected = false;
        }
        set joint1(value) {
            if (value instanceof RevoluteJoint || value instanceof PrismaticJoint) {
                this._joint1 = value;
            }
            else {
                console.warn("joint1 must be a RevoluteJoint or PrismaticJoint");
                this._joint1 = null;
            }
        }
        get joint1() {
            return this._joint1;
        }
        set joint2(value) {
            if (value instanceof RevoluteJoint || value instanceof PrismaticJoint) {
                this._joint2 = value;
            }
            else {
                console.warn("joint2 must be a RevoluteJoint or PrismaticJoint");
                this._joint2 = null;
            }
        }
        get joint2() {
            return this._joint2;
        }
        get ratio() {
            return this._ratio;
        }
        set ratio(value) {
            this._ratio = value;
            if (this._joint)
                this._factory.set_GearJoint_SetRatio(this._joint, -value);
        }
        _createJoint() {
            var _a, _b;
            this._physics2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.getComponentElementManager(Physics2DWorldManager.__managerName);
            if (!this._joint) {
                if (!this.joint1)
                    throw "Joint1 can not be empty";
                if (!this.joint2)
                    throw "Joint2 can not be empty";
                var def = GearJoint._temp || (GearJoint._temp = new physics2D_GearJointDef());
                def.bodyA = this.joint1.owner.getComponent(ColliderBase).getBox2DBody();
                if (!def.bodyA) {
                    this.joint1.owner.getComponent(ColliderBase).isConnectedJoint = true;
                    this.joint1.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.bodyB = this.joint2.owner.getComponent(ColliderBase).getBox2DBody();
                if (!def.bodyB) {
                    this.joint2.owner.getComponent(ColliderBase).isConnectedJoint = true;
                    this.joint2.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.joint1 = this.joint1.joint;
                def.joint2 = this.joint2.joint;
                def.ratio = -this._ratio;
                def.collideConnected = this.collideConnected;
                this._box2DJointDef = Physics2D.I._factory.createJointDef(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.GearJoint, def);
                this._joint = this._factory.createJoint(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.GearJoint, this._box2DJointDef);
                this.joint1.owner.off("bodyCreated", this, this._createJoint);
                this.joint2.owner.off("bodyCreated", this, this._createJoint);
            }
        }
    }

    class MotorJoint extends JointBase {
        constructor() {
            super(...arguments);
            this._linearOffset = [0, 0];
            this._angularOffset = 0;
            this._maxForce = 1000;
            this._maxTorque = 1000;
            this._correctionFactor = 0.3;
            this.collideConnected = false;
        }
        get linearOffset() {
            return this._linearOffset;
        }
        set linearOffset(value) {
            this._linearOffset = value;
            if (this._joint) {
                this._factory.set_MotorJoint_linearOffset(this._joint, value[0], value[1]);
            }
        }
        get angularOffset() {
            return this._angularOffset;
        }
        set angularOffset(value) {
            this._angularOffset = value;
            if (this._joint)
                this._factory.set_MotorJoint_SetAngularOffset(this._joint, Laya.Utils.toRadian(-value));
        }
        get maxForce() {
            return this._maxForce;
        }
        set maxForce(value) {
            this._maxForce = value;
            if (this._joint)
                this._factory.set_MotorJoint_SetMaxForce(this._joint, value);
        }
        get maxTorque() {
            return this._maxTorque;
        }
        set maxTorque(value) {
            this._maxTorque = value;
            if (this._joint)
                this._factory.set_MotorJoint_SetMaxTorque(this._joint, value);
        }
        get correctionFactor() {
            return this._correctionFactor;
        }
        set correctionFactor(value) {
            this._correctionFactor = value;
            if (this._joint)
                this._factory.set_MotorJoint_SetCorrectionFactor(this._joint, value);
        }
        _createJoint() {
            var _a, _b;
            this._physics2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.getComponentElementManager(Physics2DWorldManager.__managerName);
            if (!this._joint) {
                if (!this.otherBody)
                    throw "otherBody can not be empty";
                this.selfBody = this.selfBody || this.owner.getComponent(ColliderBase);
                if (!this.selfBody)
                    throw "selfBody can not be empty";
                var def = MotorJoint._temp || (MotorJoint._temp = new physics2D_MotorJointDef());
                def.bodyA = this.selfBody.getBox2DBody();
                if (!def.bodyA) {
                    this.selfBody.isConnectedJoint = true;
                    this.selfBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.bodyB = this.otherBody.getBox2DBody();
                if (!def.bodyB) {
                    this.otherBody.isConnectedJoint = true;
                    this.otherBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.linearOffset.setValue(this._linearOffset[0], this._linearOffset[1]);
                def.angularOffset = Laya.Utils.toRadian(-this._angularOffset);
                def.maxForce = this._maxForce;
                def.maxTorque = this._maxTorque;
                def.correctionFactor = this._correctionFactor;
                def.collideConnected = this.collideConnected;
                this._box2DJointDef = Physics2D.I._factory.createJointDef(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.MotorJoint, def);
                this._joint = this._factory.createJoint(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.MotorJoint, this._box2DJointDef);
                this.selfBody.owner.off("bodyCreated", this, this._createJoint);
                this.otherBody.owner.off("bodyCreated", this, this._createJoint);
            }
        }
    }

    class MouseJoint extends JointBase {
        constructor() {
            super(...arguments);
            this._maxForce = 1000;
            this._frequency = 5;
            this._dampingRatio = 0.7;
        }
        get maxForce() {
            return this._maxForce;
        }
        set maxForce(value) {
            this._maxForce = value;
            if (this._joint)
                this._factory.set_MouseJoint_MaxForce(this._joint, value);
        }
        get frequency() {
            return this._frequency;
        }
        set frequency(value) {
            this._frequency = value;
            if (this._joint) {
                this._factory.set_MouseJoint_frequencyAndDampingRatio(this._joint, this._frequency, this._dampingRatio);
            }
        }
        get damping() {
            return this._dampingRatio;
        }
        set damping(value) {
            this._dampingRatio = value;
            if (this._joint) {
                this._factory.set_MouseJoint_frequencyAndDampingRatio(this._joint, this._frequency, this._dampingRatio);
            }
        }
        _onEnable() {
            this.owner.on(Laya.Event.MOUSE_DOWN, this, this._onMouseDown);
        }
        _createJoint() {
            var _a, _b;
            this._physics2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.getComponentElementManager(Physics2DWorldManager.__managerName);
            if (!this._joint) {
                this.selfBody = this.selfBody || this.owner.getComponent(ColliderBase);
                if (!this.selfBody)
                    throw "selfBody can not be empty";
                var def = MouseJoint._temp || (MouseJoint._temp = new physics2D_MouseJointJointDef());
                if (this.anchor) {
                    var anchorPos = this.selfBody.owner.localToGlobal(Laya.Point.TEMP.setTo(this.anchor[0], this.anchor[1]), false, this._physics2DManager.getRootSprite());
                    anchorPos.x = Physics2D.toPhysicsX(anchorPos.x);
                    anchorPos.y = Physics2D.toPhysicsY(anchorPos.y);
                }
                else {
                    anchorPos = this._physics2DManager.getRootSprite().globalToLocal(Laya.Point.TEMP.setTo(Laya.ILaya.InputManager.mouseX, Laya.ILaya.InputManager.mouseY));
                    anchorPos.x = Physics2D.toPhysicsX(anchorPos.x);
                    anchorPos.y = Physics2D.toPhysicsY(anchorPos.y);
                }
                def.bodyA = this._physics2DManager.getEmptyBody();
                def.bodyB = this.selfBody.getBox2DBody();
                if (!def.bodyB) {
                    this.selfBody.isConnectedJoint = true;
                    this.selfBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.target.setValue(anchorPos.x, anchorPos.y);
                def.maxForce = this._maxForce;
                def.dampingRatio = this._dampingRatio;
                def.frequency = this._frequency;
                this._box2DJointDef = Physics2D.I._factory.createJointDef(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.MouseJoint, def);
                this._factory.set_rigidBody_Awake(def.bodyB, true);
                this._joint = this._factory.createJoint(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.MouseJoint, this._box2DJointDef);
                this.selfBody.owner.off("bodyCreated", this, this._createJoint);
            }
        }
        _onMouseDown() {
            this._createJoint();
            Laya.ILaya.stage.on(Laya.Event.MOUSE_MOVE, this, this._onMouseMove);
            Laya.ILaya.stage.once(Laya.Event.MOUSE_UP, this, this._onStageMouseUp);
            Laya.ILaya.stage.once(Laya.Event.MOUSE_OUT, this, this._onStageMouseUp);
        }
        _onStageMouseUp() {
            Laya.ILaya.stage.off(Laya.Event.MOUSE_MOVE, this, this._onMouseMove);
            Laya.ILaya.stage.off(Laya.Event.MOUSE_UP, this, this._onStageMouseUp);
            Laya.ILaya.stage.off(Laya.Event.MOUSE_OUT, this, this._onStageMouseUp);
            this._factory.removeJoint(this._physics2DManager.box2DWorld, this._joint);
            this._joint = null;
        }
        _onMouseMove() {
            if (this._joint)
                this._factory.set_MouseJoint_target(this._joint, Physics2D.toPhysicsX(Laya.ILaya.InputManager.mouseX), Physics2D.toPhysicsY(Laya.ILaya.InputManager.mouseY));
        }
        _onDisable() {
            super._onDisable();
            this.owner.off(Laya.Event.MOUSE_DOWN, this, this._onMouseDown);
        }
    }

    class PulleyJoint extends JointBase {
        constructor() {
            super(...arguments);
            this.selfAnchor = [0, 0];
            this.otherAnchor = [0, 0];
            this.selfGroundPoint = [0, -100];
            this.otherGroundPoint = [0, -100];
            this.ratio = 1;
            this.collideConnected = false;
        }
        _createJoint() {
            var _a, _b;
            this._physics2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.getComponentElementManager(Physics2DWorldManager.__managerName);
            if (!this._joint) {
                if (!this.otherBody)
                    throw "otherBody can not be empty";
                this.selfBody = this.selfBody || this.owner.getComponent(ColliderBase);
                if (!this.selfBody)
                    throw "selfBody can not be empty";
                var def = PulleyJoint._temp || (PulleyJoint._temp = new physics2D_PulleyJointDef);
                def.bodyA = this.otherBody.getBox2DBody();
                if (!def.bodyA) {
                    this.otherBody.isConnectedJoint = true;
                    this.otherBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.bodyB = this.selfBody.getBox2DBody();
                if (!def.bodyB) {
                    this.selfBody.isConnectedJoint = true;
                    this.selfBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                var posA = this.otherBody.getWorldPoint(this.otherAnchor[0], this.otherAnchor[1]);
                def.localAnchorA.setValue(posA.x, posA.y);
                var posB = this.selfBody.getWorldPoint(this.selfAnchor[0], this.selfAnchor[1]);
                def.localAnchorB.setValue(posB.x, posB.y);
                var groundA = this.otherBody.getWorldPoint(this.otherGroundPoint[0], this.otherGroundPoint[1]);
                def.groundAnchorA.setValue(groundA.x, groundA.y);
                var groundB = this.selfBody.getWorldPoint(this.selfGroundPoint[0], this.selfGroundPoint[1]);
                def.groundAnchorB.setValue(groundB.x, groundB.y);
                def.ratio = this.ratio;
                def.collideConnected = this.collideConnected;
                this._box2DJointDef = Physics2D.I._factory.createJointDef(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.PulleyJoint, def);
                this._joint = Physics2D.I._factory.createJoint(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.PulleyJoint, this._box2DJointDef);
                this.otherBody.owner.off("bodyCreated", this, this._createJoint);
                this.selfBody.owner.off("bodyCreated", this, this._createJoint);
            }
        }
    }

    class WeldJoint extends JointBase {
        constructor() {
            super(...arguments);
            this._frequency = 5;
            this._dampingRatio = 0.7;
            this.anchor = [0, 0];
            this.collideConnected = false;
        }
        get frequency() {
            return this._frequency;
        }
        set frequency(value) {
            this._frequency = value;
            if (this._joint) {
                this._factory.set_Joint_frequencyAndDampingRatio(this._joint, this._frequency, this._dampingRatio, false);
            }
        }
        get damping() {
            return this._dampingRatio;
        }
        set damping(value) {
            this._dampingRatio = value;
            if (this._joint) {
                this._factory.set_Joint_frequencyAndDampingRatio(this._joint, this._frequency, this._dampingRatio, true);
            }
        }
        _createJoint() {
            var _a, _b;
            this._physics2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.getComponentElementManager(Physics2DWorldManager.__managerName);
            if (!this._joint) {
                if (!this.otherBody)
                    throw "otherBody can not be empty";
                this.selfBody = this.selfBody || this.owner.getComponent(ColliderBase);
                if (!this.selfBody)
                    throw "selfBody can not be empty";
                var def = WeldJoint._temp || (WeldJoint._temp = new physics2D_WeldJointDef());
                var anchorPos = this.selfBody.getWorldPoint(this.anchor[0], this.anchor[1]);
                def.bodyA = this.otherBody.getBox2DBody();
                if (!def.bodyA) {
                    this.otherBody.isConnectedJoint = true;
                    this.otherBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.bodyB = this.selfBody.getBox2DBody();
                if (!def.bodyB) {
                    this.selfBody.isConnectedJoint = true;
                    this.selfBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.anchor.setValue(anchorPos.x, anchorPos.y);
                def.frequency = this._frequency;
                def.dampingRatio = this._dampingRatio;
                def.collideConnected = this.collideConnected;
                this._box2DJointDef = Physics2D.I._factory.createJointDef(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.WeldJoint, def);
                this._joint = this._factory.createJoint(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.WeldJoint, this._box2DJointDef);
                this.otherBody.owner.off("bodyCreated", this, this._createJoint);
                this.selfBody.owner.off("bodyCreated", this, this._createJoint);
            }
        }
    }

    class WheelJoint extends JointBase {
        constructor() {
            super(...arguments);
            this._frequency = 1;
            this._dampingRatio = 0.7;
            this._enableMotor = false;
            this._motorSpeed = 0;
            this._maxMotorTorque = 10000;
            this._enableLimit = true;
            this._lowerTranslation = 0;
            this._upperTranslation = 0;
            this.anchor = [0, 0];
            this.collideConnected = false;
            this._axis = [0, 1];
            this.angle = 90;
        }
        get frequency() {
            return this._frequency;
        }
        set frequency(value) {
            this._frequency = value;
            if (this._joint) {
                this._factory.set_Joint_frequencyAndDampingRatio(this._joint, this._frequency, this._dampingRatio, false, false);
            }
        }
        get damping() {
            return this._dampingRatio;
        }
        set damping(value) {
            this._dampingRatio = value;
            if (this._joint) {
                this._factory.set_Joint_frequencyAndDampingRatio(this._joint, this._frequency, this._dampingRatio, true, false);
            }
        }
        get enableMotor() {
            return this._enableMotor;
        }
        set enableMotor(value) {
            this._enableMotor = value;
            if (this._joint)
                this._factory.set_Joint_EnableMotor(this._joint, value);
        }
        get motorSpeed() {
            return this._motorSpeed;
        }
        set motorSpeed(value) {
            this._motorSpeed = value;
            if (this._joint)
                this._factory.set_Joint_SetMotorSpeed(this._joint, value);
        }
        get maxMotorTorque() {
            return this._maxMotorTorque;
        }
        set maxMotorTorque(value) {
            this._maxMotorTorque = value;
            if (this._joint)
                this._factory.set_Joint_SetMaxMotorTorque(this._joint, value);
        }
        get enableLimit() {
            return this._enableLimit;
        }
        set enableLimit(value) {
            this._enableLimit = value;
            if (this._joint)
                this._factory.set_Joint_EnableLimit(this._joint, value);
        }
        get lowerTranslation() {
            return this._lowerTranslation;
        }
        set lowerTranslation(value) {
            this._lowerTranslation = value;
            if (this._joint)
                this._factory.set_Joint_SetTranslationLimits(this._joint, value, this._upperTranslation);
        }
        get upperTranslation() {
            return this._upperTranslation;
        }
        set upperTranslation(value) {
            this._upperTranslation = value;
            if (this._joint)
                this._factory.set_Joint_SetTranslationLimits(this._joint, this._lowerTranslation, value);
        }
        get axis() {
            return this._axis;
        }
        set axis(value) {
            this._axis = value;
            this.angle = Laya.Utils.toAngle(Math.atan2(value[1], value[0]));
        }
        _createJoint() {
            var _a, _b;
            this._physics2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.getComponentElementManager(Physics2DWorldManager.__managerName);
            if (!this._joint) {
                if (!this.otherBody)
                    throw "otherBody can not be empty";
                this.selfBody = this.selfBody || this.owner.getComponent(ColliderBase);
                if (!this.selfBody)
                    throw "selfBody can not be empty";
                var def = WheelJoint._temp || (WheelJoint._temp = new physics2D_WheelJointDef());
                var anchorPos = this.selfBody.getWorldPoint(this.anchor[0], this.anchor[1]);
                def.anchor.setValue(anchorPos.x, anchorPos.y);
                let radian = Laya.Utils.toRadian(this.angle);
                def.axis.setValue(Math.cos(radian), Math.sin(radian));
                def.bodyA = this.otherBody.getBox2DBody();
                if (!def.bodyA) {
                    this.otherBody.isConnectedJoint = true;
                    this.otherBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.bodyB = this.selfBody.getBox2DBody();
                if (!def.bodyB) {
                    this.selfBody.isConnectedJoint = true;
                    this.selfBody.owner.on("bodyCreated", this, this._createJoint);
                    return;
                }
                def.enableMotor = this._enableMotor;
                def.motorSpeed = this._motorSpeed;
                def.maxMotorTorque = this._maxMotorTorque;
                def.collideConnected = this.collideConnected;
                def.enableLimit = this._enableLimit;
                def.lowerTranslation = this._lowerTranslation;
                def.upperTranslation = this._upperTranslation;
                def.frequency = this._frequency;
                def.dampingRatio = this._dampingRatio;
                this._box2DJointDef = this._factory.createJointDef(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.WheelJoint, def);
                this._joint = this._factory.createJoint(this._physics2DManager.box2DWorld, exports.EPhysics2DJoint.WheelJoint, this._box2DJointDef);
                this.otherBody.owner.off("bodyCreated", this, this._createJoint);
                this.selfBody.owner.off("bodyCreated", this, this._createJoint);
            }
        }
    }

    class Physics2DShapeBase {
        get x() {
            return this._x;
        }
        set x(value) {
            if (this._x == value)
                return;
            this._x = value;
            this._updateShapeData();
        }
        get y() {
            return this._y;
        }
        set y(value) {
            if (this._y == value)
                return;
            this._y = value;
            this._updateShapeData();
        }
        get filterData() {
            return this._filterData;
        }
        set filterData(value) {
            this._filterData = value;
            this._updateFilterData();
        }
        get density() {
            return this._density;
        }
        set density(value) {
            this._density = value;
            this._shapeDef.density = value;
            if (this._box2DShape) {
                Physics2D.I._factory.set_shape_density(this._box2DShape, value);
                this._body._resetMassData();
            }
        }
        get restitution() {
            return this._restitution;
        }
        set restitution(value) {
            this._restitution = value;
            this._shapeDef.restitution = value;
            this._box2DShape && Physics2D.I._factory.set_shape_restitution(this._box2DShape, value);
        }
        get restitutionThreshold() {
            return this._restitutionThreshold;
        }
        set restitutionThreshold(value) {
            this._restitutionThreshold = value;
            this._shapeDef.restitutionThreshold = value;
            this._box2DShape && Physics2D.I._factory.set_shape_restitutionThreshold(this._box2DShape, value);
        }
        get friction() {
            return this._friction;
        }
        set friction(value) {
            this._friction = value;
            this._shapeDef.friction = value;
            this._box2DShape && Physics2D.I._factory.set_shape_friction(this._box2DShape, value);
        }
        get isSensor() {
            return this._isSensor;
        }
        set isSensor(value) {
            this._isSensor = value;
            this._shapeDef.isSensor = value;
            this._box2DShape && Physics2D.I._factory.set_shape_isSensor(this._box2DShape, value);
        }
        get scaleX() {
            return Physics2D.getDesignScaleX(this._body.owner);
        }
        get scaleY() {
            return Physics2D.getDesignScaleY(this._body.owner);
        }
        get pivotoffx() {
            return this._x - this._body.owner.pivotX;
        }
        get pivotoffy() {
            return this._y - this._body.owner.pivotY;
        }
        constructor() {
            this._shapeDef = new Box2DShapeDef();
            this._filterData = new FilterData();
            this._isSensor = false;
            this._density = 10;
            this._friction = 0.2;
            this._restitution = 0;
            this._restitutionThreshold = 1.0;
            this._x = 0;
            this._y = 0;
            this._box2DFilter = Physics2D.I._factory.createFilter();
        }
        _updateFilterData() {
            if (!this._box2DShape || !this._box2DFilter)
                return;
            this._box2DFilter.groupIndex = this._filterData.group;
            this._box2DFilter.categoryBits = this._filterData.category;
            this._box2DFilter.maskBits = this._filterData.mask;
            this._shapeDef.filter = this._filterData;
            Physics2D.I._factory.setfilterData(this._box2DShape, this._box2DFilter);
            Physics2D.I._factory.set_shape_reFilter(this._box2DShape);
        }
        setCollider(body) {
            var _a, _b;
            this._body = body;
            this._box2DBody = body.getBox2DBody();
            if (!this._box2DBody)
                return;
            if (this._box2DShape) {
                Physics2D.I._factory.destroyShape(this._physics2DManager.box2DWorld, this._box2DBody, this._box2DShape);
                if (this._box2DShapeDef && this._box2DShapeDef._shape) {
                    Physics2D.I._factory.destroyData(this._box2DShapeDef._shape);
                    this._box2DShapeDef._shape = null;
                }
                Physics2D.I._factory.destroyData(this._box2DShapeDef);
                this._box2DShape = null;
                this._box2DShapeDef = null;
            }
            if (!this._box2DFilter) {
                this._box2DFilter = Physics2D.I._factory.createFilter();
            }
            this._physics2DManager = (_b = (_a = this._body.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.getComponentElementManager(Physics2DWorldManager.__managerName);
            this.filterData = this._filterData;
            this._box2DShapeDef = Physics2D.I._factory.createShapeDef(this._physics2DManager.box2DWorld, this._shapeDef, this._box2DFilter);
            Physics2D.I._factory.set_shape_collider(this._box2DShapeDef, this._body);
            this._updateShapeData();
            this._initShape();
        }
        _refreshShape(update) {
            const factory = Physics2D.I._factory;
            update(factory.getShapeByDef(this._box2DShapeDef, this._shapeDef.shapeType));
            if (!this._box2DShape)
                return;
            update(factory.getShape(this._box2DShape, this._shapeDef.shapeType));
            factory.synchronizeShape(this._box2DBody, this._box2DShape);
            this._body._resetMassData();
        }
        _initShape() {
            if (!Laya.LayaEnv.isPlaying)
                return;
            this._createShape();
            if (!this._box2DShape)
                return;
            Physics2D.I._factory.set_shape_collider(this._box2DShape, this._body);
            this._updateFilterData();
            this.x = this._x;
            this.y = this._y;
            this.density = this._density;
            this.friction = this._friction;
            this.isSensor = this._isSensor;
            this.restitution = this._restitution;
            this.restitutionThreshold = this._restitutionThreshold;
        }
        _createShape() {
        }
        _updateShapeData() {
        }
        getAABB() {
            return Physics2D.I._factory.get_shape_AABB(this._box2DShape);
        }
        rayCast(index = 0) {
            return Physics2D.I._factory.shape_rayCast(this._box2DShape, null, null, index);
        }
        destroy() {
            if (!this._box2DBody || !this._box2DShape)
                return;
            Physics2D.I._factory.destroyShape(this._physics2DManager.box2DWorld, this._box2DBody, this._box2DShape);
            Physics2D.I._factory.destroyData(this._box2DFilter);
            if (this._box2DShapeDef && this._box2DShapeDef._shape) {
                Physics2D.I._factory.destroyData(this._box2DShapeDef._shape);
                this._box2DShapeDef._shape = null;
            }
            Physics2D.I._factory.destroyData(this._box2DShapeDef);
            this._box2DShape = null;
            this._box2DFilter = null;
            this._box2DShapeDef = null;
            this._body = null;
            this._box2DBody = null;
        }
        clone() {
        }
        cloneTo(destObject) {
            destObject.density = this.density;
            destObject.filterData = Object.assign(new FilterData(), this.filterData);
            destObject.friction = this.friction;
            destObject.isSensor = this.isSensor;
            destObject.restitution = this.restitution;
            destObject.restitutionThreshold = this.restitutionThreshold;
            destObject.x = this.x;
            destObject.y = this.y;
        }
    }

    class BoxShape2D extends Physics2DShapeBase {
        get height() {
            return this._height;
        }
        set height(value) {
            if (value < 0)
                console.warn("BoxCollider size cannot be less than 0");
            if (this._height == value)
                return;
            this._height = value;
            this._updateShapeData();
        }
        get width() {
            return this._width;
        }
        set width(value) {
            if (value < 0)
                console.warn("BoxCollider size cannot be less than 0");
            if (this._width == value)
                return;
            this._width = value;
            this._updateShapeData();
        }
        constructor() {
            super();
            this._width = 100;
            this._height = 100;
            this._shapeDef.shapeType = exports.EPhysics2DShape.BoxShape;
        }
        _createShape() {
            this._box2DShape = Physics2D.I._factory.createShape(this._physics2DManager.box2DWorld, this._box2DBody, exports.EPhysics2DShape.BoxShape, this._box2DShapeDef);
        }
        _updateShapeData() {
            if (!Laya.LayaEnv.isPlaying || !this._body || !this._box2DBody)
                return;
            let helfW = this._width * 0.5;
            let helfH = this._height * 0.5;
            var center = {
                x: helfW + this.pivotoffx,
                y: helfH + this.pivotoffy
            };
            this._refreshShape(shape => {
                Physics2D.I._factory.set_collider_SetAsBox(shape, helfW, helfH, center, Math.abs(this.scaleX), Math.abs(this.scaleY));
            });
        }
        clone() {
            let dest = new BoxShape2D();
            this.cloneTo(dest);
            return dest;
        }
        cloneTo(destObject) {
            super.cloneTo(destObject);
            destObject.width = this.width;
            destObject.height = this.height;
        }
    }

    class ChainShape2D extends Physics2DShapeBase {
        get datas() {
            return this._datas;
        }
        set datas(value) {
            if (!value)
                throw "ChainCollider datas cannot be empty";
            this._datas = value;
            this._updateShapeData();
        }
        get loop() {
            return this._loop;
        }
        set loop(value) {
            if (this._loop == value)
                return;
            this._loop = value;
            this._updateShapeData();
        }
        constructor() {
            super();
            this._datas = [0, 0, 100, 0];
            this._loop = false;
            this._shapeDef.shapeType = exports.EPhysics2DShape.ChainShape;
        }
        _createShape() {
        }
        _updateShapeData() {
            if (!Laya.LayaEnv.isPlaying || !this._body || !this._box2DBody)
                return;
            var len = this._datas.length;
            if (len % 2 == 1)
                throw "ChainCollider datas lenth must a multiplier of 2";
            var pointCount = len >> 1;
            if (pointCount < 2 || (this._loop && pointCount < 3))
                return;
            if (this._box2DShape) {
                Physics2D.I._factory.destroyShape(this._physics2DManager.box2DWorld, this._box2DBody, this._box2DShape);
                this._box2DShape = null;
            }
            let defShape = Physics2D.I._factory.getShapeByDef(this._box2DShapeDef, this._shapeDef.shapeType);
            Physics2D.I._factory.set_ChainShape_data(defShape, this.pivotoffx, this.pivotoffy, this._datas, this._loop, this.scaleX, this.scaleY);
            this._box2DShape = Physics2D.I._factory.createShape(this._physics2DManager.box2DWorld, this._box2DBody, exports.EPhysics2DShape.ChainShape, this._box2DShapeDef);
            Physics2D.I._factory.set_shape_collider(this._box2DShape, this._body);
            this.filterData = this.filterData;
            this.density = this.density;
            this.friction = this.friction;
            this.isSensor = this.isSensor;
            this.restitution = this.restitution;
            this.restitutionThreshold = this.restitutionThreshold;
        }
        clone() {
            let dest = new ChainShape2D();
            this.cloneTo(dest);
            return dest;
        }
        cloneTo(destObject) {
            super.cloneTo(destObject);
            destObject.datas = this.datas.slice();
            destObject.loop = this.loop;
        }
    }

    class EdgeShape2D extends Physics2DShapeBase {
        get datas() {
            return this._datas;
        }
        set datas(value) {
            if (!value)
                throw "EdgeCollider points cannot be empty";
            this._datas = value;
            this._updateShapeData();
        }
        constructor() {
            super();
            this._datas = [0, 0, 100, 0];
            this._shapeDef.shapeType = exports.EPhysics2DShape.EdgeShape;
        }
        _createShape() {
            this._box2DShape = Physics2D.I._factory.createShape(this._physics2DManager.box2DWorld, this._box2DBody, exports.EPhysics2DShape.EdgeShape, this._box2DShapeDef);
        }
        _updateShapeData() {
            if (!Laya.LayaEnv.isPlaying || !this._body || !this._box2DBody)
                return;
            var len = this._datas.length;
            if (len % 2 == 1)
                throw "EdgeCollider points lenth must a multiplier of 2";
            this._refreshShape(shape => {
                Physics2D.I._factory.set_EdgeShape_data(shape, this.pivotoffx, this.pivotoffy, this._datas, this.scaleX, this.scaleY);
            });
        }
        clone() {
            let dest = new EdgeShape2D();
            this.cloneTo(dest);
            return dest;
        }
        cloneTo(destObject) {
            super.cloneTo(destObject);
            destObject.datas = this.datas.slice();
        }
    }

    class PolygonShape2D extends Physics2DShapeBase {
        get datas() {
            return this._datas;
        }
        set datas(value) {
            if (!value)
                throw "PolygonCollider points cannot be empty";
            this._datas = value;
            this._updateShapeData();
        }
        constructor() {
            super();
            this._datas = [50, 0, 100, 100, 0, 100];
            this._shapeDef.shapeType = exports.EPhysics2DShape.PolygonShape;
        }
        _createShape() {
            this._box2DShape = Physics2D.I._factory.createShape(this._physics2DManager.box2DWorld, this._box2DBody, exports.EPhysics2DShape.PolygonShape, this._box2DShapeDef);
        }
        _updateShapeData() {
            if (!Laya.LayaEnv.isPlaying || !this._body || !this._box2DBody)
                return;
            var len = this.datas.length;
            if (len < 6)
                throw "PolygonCollider points must be greater than 3";
            if (len % 2 == 1)
                throw "PolygonCollider points lenth must a multiplier of 2";
            this._refreshShape(shape => {
                Physics2D.I._factory.set_PolygonShape_data(shape, this.pivotoffx, this.pivotoffy, this.datas, this.scaleX, this.scaleY);
            });
        }
        clone() {
            let dest = new PolygonShape2D();
            this.cloneTo(dest);
            return dest;
        }
        cloneTo(destObject) {
            super.cloneTo(destObject);
            destObject.datas = this.datas.slice();
        }
    }

    class CircleShape2D extends Physics2DShapeBase {
        get radius() {
            return this._radius;
        }
        set radius(value) {
            if (this._radius === value)
                return;
            this._radius = value;
            this._updateShapeData();
        }
        constructor() {
            super();
            this._radius = 50;
            this._shapeDef.shapeType = exports.EPhysics2DShape.CircleShape;
        }
        _createShape() {
            this._box2DShape = Physics2D.I._factory.createShape(this._physics2DManager.box2DWorld, this._box2DBody, exports.EPhysics2DShape.CircleShape, this._box2DShapeDef);
        }
        _updateShapeData() {
            if (!Laya.LayaEnv.isPlaying || !this._body || !this._box2DBody)
                return;
            var scale = Math.max(Math.abs(this.scaleX), Math.abs(this.scaleY));
            let radius = this.radius;
            this._refreshShape(shape => {
                Physics2D.I._factory.set_CircleShape_radius(shape, radius, scale);
                Physics2D.I._factory.set_CircleShape_pos(shape, this.pivotoffx, this.pivotoffy, this.scaleX, this.scaleY);
            });
        }
        clone() {
            let dest = new CircleShape2D();
            this.cloneTo(dest);
            return dest;
        }
        cloneTo(destObject) {
            super.cloneTo(destObject);
            destObject.radius = this.radius;
        }
    }

    let c = Laya.ClassUtils.regClass;
    c("Physics2D", Physics2D);
    c("Physics2DDebugDraw", Physics2DDebugDraw);
    c("Physics2DWorldManager", Physics2DWorldManager);
    c("FilterData", FilterData);
    c("ColliderBase", ColliderBase);
    c("RigidBody", RigidBody);
    c("StaticCollider", StaticCollider);
    c("JointBase", JointBase);
    c("DistanceJoint", DistanceJoint);
    c("GearJoint", GearJoint);
    c("MotorJoint", MotorJoint);
    c("MouseJoint", MouseJoint);
    c("PrismaticJoint", PrismaticJoint);
    c("PulleyJoint", PulleyJoint);
    c("RevoluteJoint", RevoluteJoint);
    c("WeldJoint", WeldJoint);
    c("WheelJoint", WheelJoint);
    c("BoxCollider", BoxCollider);
    c("ChainCollider", ChainCollider);
    c("CircleCollider", CircleCollider);
    c("EdgeCollider", EdgeCollider);
    c("PolygonCollider", PolygonCollider);
    c("Physics2DShapeBase", Physics2DShapeBase);
    c("BoxShape2D", BoxShape2D);
    c("CircleShape2D", CircleShape2D);
    c("ChainShape2D", ChainShape2D);
    c("EdgeShape2D", EdgeShape2D);
    c("PolygonShape2D", PolygonShape2D);

    exports.Box2DShapeDef = Box2DShapeDef;
    exports.BoxCollider = BoxCollider;
    exports.BoxShape2D = BoxShape2D;
    exports.ChainCollider = ChainCollider;
    exports.ChainShape2D = ChainShape2D;
    exports.CircleCollider = CircleCollider;
    exports.CircleShape2D = CircleShape2D;
    exports.ColliderBase = ColliderBase;
    exports.DistanceJoint = DistanceJoint;
    exports.EdgeCollider = EdgeCollider;
    exports.EdgeShape2D = EdgeShape2D;
    exports.FilterData = FilterData;
    exports.GearJoint = GearJoint;
    exports.JointBase = JointBase;
    exports.MotorJoint = MotorJoint;
    exports.MouseJoint = MouseJoint;
    exports.Physics2D = Physics2D;
    exports.Physics2DContactHitResult = Physics2DContactHitResult;
    exports.Physics2DDebugDraw = Physics2DDebugDraw;
    exports.Physics2DHitResult = Physics2DHitResult;
    exports.Physics2DOption = Physics2DOption;
    exports.Physics2DShapeBase = Physics2DShapeBase;
    exports.Physics2DWorldManager = Physics2DWorldManager;
    exports.PhysicsDrawLine2DCMD = PhysicsDrawLine2DCMD;
    exports.PhysicsLineGemetry = PhysicsLineGemetry;
    exports.PhysicsLineShader = PhysicsLineShader;
    exports.PolygonCollider = PolygonCollider;
    exports.PolygonShape2D = PolygonShape2D;
    exports.PrismaticJoint = PrismaticJoint;
    exports.PulleyJoint = PulleyJoint;
    exports.RevoluteJoint = RevoluteJoint;
    exports.RigidBody = RigidBody;
    exports.RigidBody2DInfo = RigidBody2DInfo;
    exports.StaticCollider = StaticCollider;
    exports.WeldJoint = WeldJoint;
    exports.WheelJoint = WheelJoint;
    exports.box2DWorldDef = box2DWorldDef;
    exports.physics2D_BaseJointDef = physics2D_BaseJointDef;
    exports.physics2D_DistancJointDef = physics2D_DistancJointDef;
    exports.physics2D_GearJointDef = physics2D_GearJointDef;
    exports.physics2D_MotorJointDef = physics2D_MotorJointDef;
    exports.physics2D_MouseJointJointDef = physics2D_MouseJointJointDef;
    exports.physics2D_PrismaticJointDef = physics2D_PrismaticJointDef;
    exports.physics2D_PulleyJointDef = physics2D_PulleyJointDef;
    exports.physics2D_RevoluteJointDef = physics2D_RevoluteJointDef;
    exports.physics2D_WeldJointDef = physics2D_WeldJointDef;
    exports.physics2D_WheelJointDef = physics2D_WheelJointDef;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.physics2D.js.map
