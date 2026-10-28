(function (exports, Laya) {
    'use strict';

    class ExternalSkin {
        get source() {
            return this._source;
        }
        set source(value) {
            this._source = value;
            if (value) {
                Laya.ILaya.loader.load(value, Laya.Loader.SPINE).then((templet) => {
                    if (!this._source || templet && !templet.isCreateFromURL(this._source))
                        return;
                    this.templet = templet;
                });
            }
            else
                this.templet = null;
        }
        get items() {
            return this._items;
        }
        set items(value) {
            this._items = value;
        }
        get templet() {
            return this._templet;
        }
        set templet(value) {
            this.init(value);
        }
        init(templet) {
            this._templet = templet;
            if (!this._templet) {
                return;
            }
            this.flush();
        }
        flush() {
            var _a;
            let targetTemplet = (_a = this.target) === null || _a === void 0 ? void 0 : _a.templet;
            if (this._items
                && this._templet
                && targetTemplet
                && targetTemplet._textures) {
                let optimize = this._templet.optimize;
                if (!optimize)
                    return;
                for (let i = this._items.length - 1; i >= 0; i--) {
                    let o = this._items[i];
                    this.target.setTempletAttachment(this._templet, o.slot, o.skin, o.attachment);
                }
            }
        }
    }

    class ExternalSkinItem {
        get skin() {
            return this._skin;
        }
        set skin(value) {
            this._skin = value;
        }
        get slot() {
            return this._slot;
        }
        set slot(value) {
            this._slot = value;
        }
        get attachment() {
            return this._attachment;
        }
        set attachment(value) {
            this._attachment = value;
        }
    }

    var spineVertexCommon = "#if !defined(SpineVertexCommon_lib)\n#define SpineVertexCommon_lib\n#ifdef SPINE_RB\nuniform vec4 u_sBone0;uniform vec4 u_sBone1;\n#endif\nvoid transfrom(vec2 pos,vec4 xDir,vec4 yDir,out vec2 outPos){outPos.x=xDir.x*pos.x+xDir.y*pos.y+xDir.z;outPos.y=yDir.x*pos.x+yDir.y*pos.y+yDir.z;}\n#ifdef SPINE_SIMPLE\nuniform vec4 u_SimpleAnimatorParams;uniform sampler2D u_SimpleAnimatorTexture;uniform float u_SimpleAnimatorTextureSize;vec4 getBonePosBake(float FramePos,float boneIndices,float weight,vec2 pos,float offset){vec2 uv=vec2(0.0,0.0);float PixelPos=FramePos+boneIndices*2.0;float halfOffset=offset*0.5;float uvoffset=PixelPos/u_SimpleAnimatorTextureSize;uv.y=floor(uvoffset)*offset+halfOffset;uv.x=mod(PixelPos,u_SimpleAnimatorTextureSize)*offset+halfOffset;vec4 up=texture2D(u_SimpleAnimatorTexture,uv);uv.x+=offset;vec4 down=texture2D(u_SimpleAnimatorTexture,uv);vec2 outPos;transfrom(pos,up,down,outPos);outPos=outPos*weight;return vec4(outPos,0.,1.0);}\n#endif\n#ifdef SPINE_FAST\nuniform vec4 u_sBone[200];vec4 getBonePos(float fboneId,float weight,vec2 pos){int boneId=int(fboneId);vec4 up=u_sBone[boneId*2];vec4 down=u_sBone[boneId*2+1];vec2 outPos;transfrom(pos,up,down,outPos);outPos=outPos*weight;return vec4(outPos,0.,1.0);}\n#endif\nvec4 getSpinePos(){\n#ifdef SPINE_SIMPLE\n#ifdef GPU_INSTANCE\nfloat currentPixelPos=a_SimpleTextureParams.x+a_SimpleTextureParams.y;\n#else\nfloat currentPixelPos=u_SimpleAnimatorParams.x+u_SimpleAnimatorParams.y;\n#endif\nfloat offset=1.0/u_SimpleAnimatorTextureSize;\n#ifdef SPINE_RB\nreturn getBonePosBake(currentPixelPos,a_BoneId,a_weight,a_position,offset);\n#else\nreturn getBonePosBake(currentPixelPos,a_BoneId,a_weight,a_position,offset)+getBonePosBake(currentPixelPos,a_PosWeightBoneID_2.w,a_PosWeightBoneID_2.z,a_PosWeightBoneID_2.xy,offset)+getBonePosBake(currentPixelPos,a_PosWeightBoneID_3.w,a_PosWeightBoneID_3.z,a_PosWeightBoneID_3.xy,offset)+getBonePosBake(currentPixelPos,a_PosWeightBoneID_4.w,a_PosWeightBoneID_4.z,a_PosWeightBoneID_4.xy,offset);\n#endif\n#else\n#ifdef SPINE_FAST\nreturn getBonePos(a_BoneId,a_weight,a_position)+getBonePos(a_PosWeightBoneID_2.w,a_PosWeightBoneID_2.z,a_PosWeightBoneID_2.xy)+getBonePos(a_PosWeightBoneID_3.w,a_PosWeightBoneID_3.z,a_PosWeightBoneID_3.xy)+getBonePos(a_PosWeightBoneID_4.w,a_PosWeightBoneID_4.z,a_PosWeightBoneID_4.xy);\n#endif\n#ifdef SPINE_RB\nvec2 pos;transfrom(a_position,u_sBone0,u_sBone1,pos);pos*=a_weight;return vec4(pos,0.,1.);\n#endif\n#endif\nreturn vec4(a_position.x,a_position.y,0.,1.);}\n#endif\n";

    var spineFragment = "#if !defined(SpineFragment_lib)\n#define SpineFragment_lib\n#include \"Sprite2DFrag.glsl\";\nvec4 getColor(){vec4 color=texture2D(u_spineTexture,v_texcoord.xy);\n#ifndef GAMMATEXTURE\n#ifdef GAMMASPACE\ncolor.xyz=linearToGamma(color.xyz);\n#endif\n#else\n#ifndef GAMMASPACE\ncolor.xyz=gammaToLinear(color.xyz);\n#endif\n#endif\nvec4 final;\n#ifdef TWOCOLORTINT\nfinal.a=color.a*v_color.a;final.xyz=((color.a-1.0)*v_color2.a+1.0-color.xyz)*v_color2.xyz+color.xyz*v_color.xyz;\n#else\nfinal=color*v_color;\n#endif\nreturn final;}\n#endif\n";

    var spine2DVertex = "#if !defined(SpineVertex_lib)\n#define SpineVertex_lib\nvoid transfrom_spine(vec2 pos,vec3 xDir,vec3 yDir,out vec2 outPos){outPos.x=xDir.x*pos.x-xDir.y*pos.y+xDir.z;outPos.y=yDir.x*pos.x-yDir.y*pos.y+yDir.z;}void getGlobalPos(vec4 pos,out vec2 globalPos){\n#ifdef GPU_INSTANCE\nvec3 down=a_NMatrix_1;vec3 up=a_NMatrix_0;\n#else\nvec3 down=u_NMatrix_1;vec3 up=u_NMatrix_0;\n#endif\n#ifdef SPINE_NORMAL_2D\nglobalPos.xy=pos.xy;\n#else\ntransfrom_spine(pos.xy,up,down,globalPos);\n#endif\n}vec4 getScreenPos(vec4 pos){vec2 globalPos;\n#ifdef GPU_INSTANCE\nvec3 down=a_NMatrix_1;vec3 up=a_NMatrix_0;\n#else\nvec3 down=u_NMatrix_1;vec3 up=u_NMatrix_0;\n#endif\n#ifdef SPINE_NORMAL_2D\nglobalPos.xy=pos.xy;\n#else\ntransfrom_spine(pos.xy,up,down,globalPos);\n#endif\nclip(globalPos);vec2 viewPos;getViewPos(globalPos,viewPos);vec4 outPos;getProjectPos(viewPos,outPos);return outPos;}void getVertexInfo(vec4 pos,inout vertexInfo info){info.pos=pos.xy;info.color=vec4(1.0);\n#ifdef COLOR\ninfo.color=a_color;\n#endif\ninfo.color*=u_baseRenderColor;\n#ifdef PREMULTIPLYALPHA\ninfo.color.rgb=info.color.rgb*info.color.a;\n#endif\n#ifdef UV\ninfo.uv=a_uv;\n#endif\n#ifdef LIGHT2D_ENABLE\nvec2 global;getGlobalPos(pos,global);info.lightUV.x=(global.x-u_LightAndShadow2DParam.x)/u_LightAndShadow2DParam.z;info.lightUV.y=1.0-(global.y-u_LightAndShadow2DParam.y)/u_LightAndShadow2DParam.w;\n#endif\n}\n#endif\n";

    var spineStandardVS = "#define SHADER_NAME SpineStandardVS\nvarying vec4 v_color2;\n#include \"Sprite2DVertex.glsl\";\n#include \"SpineVertexCommon.glsl\";\n#include \"Spine2DVertex.glsl\";\nvoid main(){vec4 pos=getSpinePos();vertexInfo info;getVertexInfo(pos,info);v_texcoord=info.uv;v_color=info.color;\n#ifdef COLOR2\nv_color2=a_color2;\n#else\nv_color2=vec4(0.0,0.0,0.0,1.0);\n#endif\n#ifdef PREMULTIPLYALPHA\nv_color2.xyz=v_color2.xyz*v_color.a;\n#endif\n#ifdef LIGHT2D_ENABLE\nlightAndShadow(info);\n#endif\ngl_Position=getScreenPos(pos);}";

    var spineStandardFS = "#define SHADER_NAME SpineStandardFS\nvarying vec4 v_color2;\n#include \"SpineFragment.glsl\";\nvoid main(){clip();gl_FragColor=getColor();\n#ifdef LIGHT2D_ENABLE\nlightAndShadow(gl_FragColor);\n#endif\n}";

    class SpineShaderInit {
        static SetSpineBlendMode(value, mat, premultipliedAlpha = true) {
            switch (value) {
                case 1:
                    mat.blend = Laya.RenderState.BLEND_ENABLE_ALL;
                    mat.blendSrc = Laya.RenderState.BLENDPARAM_SRC_ALPHA;
                    mat.blendDst = Laya.RenderState.BLENDPARAM_ONE;
                    break;
                case 3:
                    mat.blend = Laya.RenderState.BLEND_ENABLE_SEPERATE;
                    mat.blendSrcRGB = Laya.RenderState.BLENDPARAM_ONE;
                    mat.blendSrcAlpha = Laya.RenderState.BLENDPARAM_ONE;
                    mat.blendDstRGB = Laya.RenderState.BLENDPARAM_ONE_MINUS_SRC_COLOR;
                    mat.blendDstAlpha = Laya.RenderState.BLENDPARAM_ONE;
                    break;
                case 2:
                    mat.blend = Laya.RenderState.BLEND_ENABLE_ALL;
                    mat.blendSrc = Laya.RenderState.BLENDPARAM_DST_COLOR;
                    mat.blendDst = Laya.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
                    break;
                default:
                    mat.blend = Laya.RenderState.BLEND_ENABLE_ALL;
                    mat.blendSrc = premultipliedAlpha ? Laya.RenderState.BLENDPARAM_ONE : Laya.RenderState.BLENDPARAM_SRC_ALPHA;
                    mat.blendDst = Laya.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
            }
        }
        static initSpineMaterial(mat) {
            mat.alphaTest = false;
            mat.depthWrite = false;
            mat.cull = Laya.RenderState.CULL_NONE;
            mat.blend = Laya.RenderState.BLEND_ENABLE_ALL;
            mat.blendSrc = Laya.RenderState.BLENDPARAM_SRC_ALPHA;
            mat.blendDst = Laya.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
            mat.depthTest = Laya.RenderState.DEPTHTEST_OFF;
        }
        static init() {
            Laya.Shader3D.addInclude("SpineFragment.glsl", spineFragment);
            Laya.Shader3D.addInclude("Spine2DVertex.glsl", spine2DVertex);
            Laya.Shader3D.addInclude("SpineVertexCommon.glsl", spineVertexCommon);
            SpineShaderInit.BONEMAT = Laya.Shader3D.propertyNameToID("u_sBone");
            SpineShaderInit.BONEMAT_0 = Laya.Shader3D.propertyNameToID("u_sBone0");
            SpineShaderInit.BONEMAT_1 = Laya.Shader3D.propertyNameToID("u_sBone1");
            SpineShaderInit.SpineTexture = Laya.Shader3D.propertyNameToID("u_spineTexture");
            SpineShaderInit.COLOR = Laya.Shader3D.propertyNameToID("u_color");
            SpineShaderInit.SPINE_RENDER_SIZE = Laya.Shader3D.propertyNameToID("u_spineRenderSize");
            SpineShaderInit.SPINE_FAST = Laya.Shader3D.getDefineByName("SPINE_FAST");
            SpineShaderInit.SPINE_RB = Laya.Shader3D.getDefineByName("SPINE_RB");
            SpineShaderInit.SPINE_UV = Laya.Shader3D.getDefineByName("UV");
            SpineShaderInit.SPINE_COLOR = Laya.Shader3D.getDefineByName("COLOR");
            SpineShaderInit.SPINE_NORMAL_2D = Laya.Shader3D.getDefineByName("SPINE_NORMAL_2D");
            SpineShaderInit.SPINE_PREMULTIPLYALPHA = Laya.Shader3D.getDefineByName("PREMULTIPLYALPHA");
            SpineShaderInit.SIMPLE_SIMPLEANIMATORPARAMS = Laya.Shader3D.propertyNameToID("u_SimpleAnimatorParams");
            SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURE = Laya.Shader3D.propertyNameToID("u_SimpleAnimatorTexture");
            SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURESIZE = Laya.Shader3D.propertyNameToID("u_SimpleAnimatorTextureSize");
            SpineShaderInit.SPINE_SIMPLE = Laya.Shader3D.getDefineByName("SPINE_SIMPLE");
            SpineShaderInit.SPINE_GPU_INSTANCE = Laya.Shader3D.getDefineByName("GPU_INSTANCE");
            SpineShaderInit.SPINE_TWOCOLORTINT = Laya.Shader3D.getDefineByName("TWOCOLORTINT");
            SpineShaderInit.SPINE_COLOR2 = Laya.Shader3D.getDefineByName("COLOR2");
            const commandUniform = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("Spine2D");
            commandUniform.addShaderUniformArray(SpineShaderInit.BONEMAT, "u_sBone", Laya.ShaderDataType.Vector4, 200);
            commandUniform.addShaderUniform(SpineShaderInit.BONEMAT_0, "u_sBone0", Laya.ShaderDataType.Vector4);
            commandUniform.addShaderUniform(SpineShaderInit.BONEMAT_1, "u_sBone1", Laya.ShaderDataType.Vector4);
            commandUniform.addShaderUniform(SpineShaderInit.COLOR, "u_color", Laya.ShaderDataType.Vector4);
            commandUniform.addShaderUniform(SpineShaderInit.SIMPLE_SIMPLEANIMATORPARAMS, "u_SimpleAnimatorParams", Laya.ShaderDataType.Vector4);
            commandUniform.addShaderUniform(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURE, "u_SimpleAnimatorTexture", Laya.ShaderDataType.Texture2D);
            commandUniform.addShaderUniform(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURESIZE, "u_SimpleAnimatorTextureSize", Laya.ShaderDataType.Float);
            commandUniform.addShaderUniform(SpineShaderInit.SPINE_RENDER_SIZE, "u_spineRenderSize", Laya.ShaderDataType.Vector2);
            let shader = Laya.Shader3D.add("SpineStandard", true, false);
            shader.shaderType = Laya.ShaderFeatureType.D2_BaseRenderNode2D;
            let uniformMap = {
                "u_spineTexture": Laya.ShaderDataType.Texture2D
            };
            let subShader = new Laya.SubShader(SpineShaderInit.textureSpineAttribute, uniformMap);
            shader.addSubShader(subShader);
            subShader.addShaderPass(spineStandardVS, spineStandardFS);
            SpineShaderInit.SpineNormalVertexDeclaration = SpineShaderInit.getVertexDeclaration("UV,COLOR,POSITION,COLOR2");
            SpineShaderInit.instanceNMatrixDeclaration = new Laya.VertexDeclaration(24, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector3, 8),
                new Laya.VertexElement(12, Laya.VertexElementFormat.Vector3, 9),
            ]);
            SpineShaderInit.instanceSimpleAnimatorDeclaration = new Laya.VertexDeclaration(16, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 10),
            ]);
        }
        static getVertexDeclaration(vertexFlag) {
            var verDec = SpineShaderInit._vertexDeclarationMap[vertexFlag];
            if (!verDec) {
                var subFlags = vertexFlag.split(",");
                var elements = [];
                var offset = 0;
                for (var i = 0, n = subFlags.length; i < n; i++) {
                    var element;
                    switch (subFlags[i]) {
                        case "COLOR2":
                            element = new Laya.VertexElement(offset, Laya.VertexElementFormat.Vector4, 11);
                            offset += 16;
                            break;
                        case "BONE":
                            element = new Laya.VertexElement(offset, Laya.VertexElementFormat.Single, 3);
                            elements.push(element);
                            offset += 4;
                            element = new Laya.VertexElement(offset, Laya.VertexElementFormat.Single, 4);
                            elements.push(element);
                            offset += 4;
                            element = new Laya.VertexElement(offset, Laya.VertexElementFormat.Vector4, 5);
                            elements.push(element);
                            offset += 16;
                            element = new Laya.VertexElement(offset, Laya.VertexElementFormat.Vector4, 6);
                            elements.push(element);
                            offset += 16;
                            element = new Laya.VertexElement(offset, Laya.VertexElementFormat.Vector4, 7);
                            offset += 16;
                            break;
                        case "RIGIDBODY":
                            element = new Laya.VertexElement(offset, Laya.VertexElementFormat.Single, 3);
                            elements.push(element);
                            offset += 4;
                            element = new Laya.VertexElement(offset, Laya.VertexElementFormat.Single, 4);
                            offset += 4;
                            break;
                        case "UV":
                            element = new Laya.VertexElement(offset, Laya.VertexElementFormat.Vector2, 0);
                            offset += 8;
                            break;
                        case "COLOR":
                            element = new Laya.VertexElement(offset, Laya.VertexElementFormat.Vector4, 1);
                            offset += 16;
                            break;
                        case "POSITION":
                            element = new Laya.VertexElement(offset, Laya.VertexElementFormat.Vector2, 2);
                            offset += 8;
                            break;
                        default:
                            throw new Error("unknown vertex flag.");
                    }
                    elements.push(element);
                }
                verDec = new Laya.VertexDeclaration(offset, elements);
                SpineShaderInit._vertexDeclarationMap[vertexFlag] = verDec;
            }
            return verDec;
        }
        static getAllVertexDeclarations() {
            if (this._declarations) {
                return this._declarations;
            }
            this._declarations = {};
            let vertexFlags = [
                "UV,COLOR,POSITION",
                "UV,COLOR,POSITION,COLOR2",
                "UV,COLOR,POSITION,BONE",
                "UV,COLOR,POSITION,BONE,COLOR2",
                "UV,COLOR,POSITION,RIGIDBODY",
                "UV,COLOR,POSITION,RIGIDBODY,COLOR2"
            ];
            for (const vertexFlag of vertexFlags) {
                this._declarations[vertexFlag] = SpineShaderInit.getVertexDeclaration(vertexFlag);
            }
            this._declarations["instanceMatrix"] = SpineShaderInit.instanceNMatrixDeclaration;
            this._declarations["simpleAnimation"] = SpineShaderInit.instanceSimpleAnimatorDeclaration;
            return this._declarations;
        }
        static getIndexFormat(vertexCount) {
            let type = Laya.IndexFormat.UInt32;
            if (vertexCount < 256 && Laya.LayaGL.renderEngine.getCapable(Laya.RenderCapable.Element_Index_Uint8)) {
                type = Laya.IndexFormat.UInt8;
            }
            else if (vertexCount < 65536) {
                type = Laya.IndexFormat.UInt16;
            }
            return type;
        }
    }
    SpineShaderInit._vertexDeclarationMap = {};
    SpineShaderInit.textureSpineAttribute = {
        'a_uv': [0, Laya.ShaderDataType.Vector2],
        'a_color': [1, Laya.ShaderDataType.Vector4],
        'a_position': [2, Laya.ShaderDataType.Vector2],
        "a_weight": [3, Laya.ShaderDataType.Float],
        "a_BoneId": [4, Laya.ShaderDataType.Float],
        'a_PosWeightBoneID_2': [5, Laya.ShaderDataType.Vector4],
        'a_PosWeightBoneID_3': [6, Laya.ShaderDataType.Vector4],
        'a_PosWeightBoneID_4': [7, Laya.ShaderDataType.Vector4],
        'a_NMatrix_0': [8, Laya.ShaderDataType.Vector3],
        'a_NMatrix_1': [9, Laya.ShaderDataType.Vector3],
        'a_SimpleTextureParams': [10, Laya.ShaderDataType.Vector4],
        "a_color2": [11, Laya.ShaderDataType.Vector4],
    };

    class SpineTemplet extends Laya.Resource {
        constructor() {
            super();
            this.materialMap = new Map();
            this._spineMaterials2D = {};
            this._spineMaterials3D = {};
            this._spineMaterialTextures = {};
            this._spineMaterialTextureKeys = {};
            this.x = 0;
            this.y = 0;
            this.offsetX = 0;
            this.offsetY = 0;
            this._premultipliedAlpha = true;
        }
        get premultipliedAlpha() {
            return this._premultipliedAlpha;
        }
        get spineMaterials2D() {
            return this._spineMaterials2D;
        }
        set spineMaterials2D(value) {
            this._spineMaterials2D = value || {};
            this.onSpineMaterialsChanged();
        }
        get spineMaterials3D() {
            return this._spineMaterials3D;
        }
        set spineMaterials3D(value) {
            this._spineMaterials3D = value || {};
            this.onSpineMaterialsChanged();
        }
        get spineMaterialTextures() {
            return this._spineMaterialTextures;
        }
        set spineMaterialTextures(value) {
            this._spineMaterialTextures = value || {};
            this._refreshSpineMaterialTextureKeys();
            this.onSpineMaterialsChanged();
        }
        onSpineMaterialsChanged() {
            this.event(SpineTemplet.EVENT_SPINE_MATERIAL_CHANGE);
        }
        _getSpineMaterial(texture, blendMode, premultipliedAlpha, is3D) {
            if (!texture)
                return null;
            let dimension = is3D ? "3D" : "2D";
            let materials = is3D ? this._spineMaterials3D : this._spineMaterials2D;
            let material = this._getSpineMaterialByKey(materials, this._getSpineMaterialKey(texture, blendMode, premultipliedAlpha, dimension), is3D);
            if (material)
                return material;
            let keys = this._spineMaterialTextureKeys[texture.id];
            if (keys) {
                for (let key of keys) {
                    material = this._getSpineMaterialByKey(materials, `${key}_${blendMode}_${premultipliedAlpha}_${dimension}`, is3D);
                    if (material)
                        return material;
                }
            }
            return null;
        }
        _getSpineMaterialByKey(materials, key, is3D) {
            let material = materials[key];
            if (material instanceof Laya.Material && material.checkType(is3D ? Laya.ShaderFeatureType.D3 : Laya.ShaderFeatureType.D2_BaseRenderNode2D))
                return material;
            return null;
        }
        _getSpineMaterialKey(texture, blendMode, premultipliedAlpha, dimension) {
            return `${texture.id}_${blendMode}_${premultipliedAlpha}_${dimension}`;
        }
        getMaterial(texture, blendMode, premultipliedAlpha, is3D = false) {
            if (!texture) {
                console.warn("SpineError:cant Find Main Texture");
                texture = Laya.Texture2D.whiteTexture;
            }
            let remapMaterial = this._getSpineMaterial(texture, blendMode, premultipliedAlpha, is3D);
            if (remapMaterial)
                return remapMaterial;
            let key = this._getSpineMaterialKey(texture, blendMode, premultipliedAlpha, is3D ? "3D" : "2D");
            let mat = this.materialMap.get(key);
            if (!mat) {
                mat = new Laya.Material();
                mat.setShaderName(is3D ? "Spine3D" : "SpineStandard");
                mat.renderQueue = is3D ? 3000 : 2000;
                SpineShaderInit.initSpineMaterial(mat);
                mat.setTextureByIndex(SpineShaderInit.SpineTexture, texture);
                if (texture.gammaCorrection != 1) {
                    mat.addDefine(Laya.ShaderDefines2D.GAMMATEXTURE);
                }
                else {
                    mat.removeDefine(Laya.ShaderDefines2D.GAMMATEXTURE);
                }
                SpineShaderInit.SetSpineBlendMode(blendMode, mat, premultipliedAlpha);
                if (premultipliedAlpha) {
                    mat.addDefine(SpineShaderInit.SPINE_PREMULTIPLYALPHA);
                }
                else {
                    mat.removeDefine(SpineShaderInit.SPINE_PREMULTIPLYALPHA);
                }
                mat._addReference();
                this.materialMap.set(key, mat);
            }
            return mat;
        }
        getTexture(name) {
            return this._textures[name];
        }
        setTexture(name, tex) {
            if (!this._textures)
                this._textures = {};
            this._textures[name] = tex;
            this._registerSpineMaterialTexture(name, tex);
            this.onSpineMaterialsChanged();
        }
        registerTexture(texture) {
            if (!texture)
                return;
            let tex2d = texture.bitmap;
            if (!tex2d)
                return;
            this._registerTextureByName(texture.url, tex2d);
            this._registerTextureByName(tex2d.url, tex2d);
        }
        _registerTextureByName(name, texture) {
            if (!name)
                return;
            let previous = this._textures && this._textures[name];
            if (previous === texture)
                return;
            if (previous)
                previous._removeReference();
            texture._addReference();
            this.setTexture(name, texture);
        }
        _refreshSpineMaterialTextureKeys() {
            this._spineMaterialTextureKeys = {};
            if (!this._textures)
                return;
            for (let name in this._textures)
                this._registerSpineMaterialTexture(name, this._textures[name]);
        }
        _registerSpineMaterialTexture(name, texture) {
            if (!texture)
                return;
            let keys = this._spineMaterialTextureKeys[texture.id];
            if (!keys)
                keys = this._spineMaterialTextureKeys[texture.id] = [];
            this._addSpineMaterialTextureKey(keys, name);
            this._addSpineMaterialTextureKey(keys, texture.uuid);
            this._addSpineMaterialTextureKey(keys, texture.url);
            for (let id in this._spineMaterialTextures) {
                if (this._spineMaterialTextures[id] === name)
                    this._addSpineMaterialTextureKey(keys, id);
            }
        }
        _addSpineMaterialTextureKey(keys, key) {
            if (key && keys.indexOf(key) === -1)
                keys.push(key);
        }
        getAniNameByIndex(index) {
            return this.optimize.getAniNameByIndex(index);
        }
        getAnimationCount() {
            return this.optimize.getAnimationCount();
        }
        findAnimation(name) {
            return this.optimize.findAnimation(name);
        }
        hasAnimation(name) {
            return this.optimize.hasAnimation(name);
        }
        getSkinIndexByName(skinName) {
            return this.optimize.getSkinIndexByName(skinName);
        }
        checkPremultipliedAlpha() {
            let premultipliedAlpha = true;
            let textures = this._textures;
            for (const key in textures) {
                const texture2d = textures[key];
                premultipliedAlpha = texture2d._premultiplyAlpha && premultipliedAlpha;
            }
            return premultipliedAlpha;
        }
        _disposeResource() {
            this.optimize.destroy();
            this._parser.destroy();
            for (let k in this._textures) {
                let tex = this._textures[k];
                if (tex) {
                    tex._removeReference();
                }
            }
            if (this._referenceCount <= 0) {
                this.materialMap.forEach(value => {
                    value._removeReference();
                });
                this.materialMap.clear();
            }
            else {
                console.error("SpineTemplet is using");
            }
            this._parser = null;
        }
    }
    SpineTemplet.EVENT_SPINE_MATERIAL_CHANGE = "spineMaterialChange";

    class SpineConst {
    }
    SpineConst.SPLIT_REGEX = /\r?\n/;
    SpineConst.PMA_REGEX = /^pma:\s*(true|false)$/i;
    SpineConst.PREMULTIPLIED_ALPHA_DEFAULT = true;
    SpineConst.VERSION = "3.8";
    SpineConst.VersionFirst = 3;
    SpineConst.VersionSecond = 8;
    SpineConst.normalRenderSwitch = false;
    SpineConst.MAX_BONES = 100;
    SpineConst.cacheSwitch = false;
    SpineConst.factory = null;
    SpineConst.VERTEXSIZE = 8;
    SpineConst.VERTEX_TWOCOLOR = 12;
    SpineConst.VERTEX_INITIAL_CAPACITY = 128;
    SpineConst.NORMAL_VERTEX_LENGTH = 1024;
    SpineConst.NORMAL_MAX_VERTEX = 10922;
    SpineConst.VERTEX_BONE = 22;
    SpineConst.VERTEX_RIGIDBODY = 10;
    SpineConst.SPINE_STEP = 1 / 30;
    SpineConst.NEED_SLOT = false;
    SpineConst.ENABLE_WEB_BATCH = false;
    exports.ESpineRenderMode = void 0;
    (function (ESpineRenderMode) {
        ESpineRenderMode[ESpineRenderMode["None"] = 0] = "None";
        ESpineRenderMode[ESpineRenderMode["Normal"] = 1] = "Normal";
        ESpineRenderMode[ESpineRenderMode["Optimize"] = 2] = "Optimize";
        ESpineRenderMode[ESpineRenderMode["Bake"] = 3] = "Bake";
    })(exports.ESpineRenderMode || (exports.ESpineRenderMode = {}));
    exports.ESpineRenderState = void 0;
    (function (ESpineRenderState) {
        ESpineRenderState[ESpineRenderState["Stopped"] = 0] = "Stopped";
        ESpineRenderState[ESpineRenderState["Paused"] = 1] = "Paused";
        ESpineRenderState[ESpineRenderState["Playing"] = 2] = "Playing";
    })(exports.ESpineRenderState || (exports.ESpineRenderState = {}));
    Laya.Laya.addAfterInitCallback(() => {
        const versionMatch = /^(\d+)\.(\d+)/.exec(SpineConst.VERSION);
        const versionNumber = Number(versionMatch[1]);
        const versionNumber2 = Number(versionMatch[2]);
        SpineConst.VersionFirst = versionNumber;
        SpineConst.VersionSecond = versionNumber2;
        if (versionNumber > 4 || (versionNumber === 4 && versionNumber2 >= 1)) {
            SpineConst.NEED_SLOT = true;
        }
        SpineConst.ENABLE_WEB_BATCH = window.Laya.BatchManager != null;
        SpineShaderInit.init();
    });

    class Spine2DRenderNode extends Laya.BaseRenderNode2D {
        get boneMap() {
            return this._boneMap;
        }
        constructor() {
            super();
            this._createBone = false;
            this.physicsUpdate = 0;
            this._maxDeltaTime = 0.1;
            this._pause = true;
            this._needUpdate = false;
            this._leakReleased = false;
            this._releasedTemplet = null;
            this._playbackRate = 1.0;
            this._playAudio = true;
            this._soundChannelArr = [];
            this.trackIndex = 0;
            this._skinName = "default";
            this._loop = true;
            this._playState = exports.ESpineRenderState.Stopped;
            this._renderOffset = new Laya.Vector2();
            this._offset = new Laya.Vector2();
            this._transformDirty = true;
            this._skinRenderDirty = false;
            this._setPreAlphaFlag = false;
            this._premultipliedAlpha = true;
            this._useFastRender = true;
            this._autoAdjust = false;
            this._enableCache = false;
            this._renderElements = [];
            this._materials = [];
        }
        _isMaterialVaild(value) {
            return value.checkType(Laya.ShaderFeatureType.D2_BaseRenderNode2D);
        }
        _getcommonUniformMap() {
            return ["BaseRender2D", "Spine2D"];
        }
        _createRenderHandle() {
            return SpineConst.factory.createSpineRenderDataHandle();
        }
        get createBone() {
            return this._createBone;
        }
        set createBone(value) {
            if (this._createBone === value)
                return;
            this._createBone = value;
            if (value) {
                this._createBones();
            }
            else {
                this._rootBone.destroy();
                this._rootBone = null;
            }
        }
        _createBones() {
            if (this._rootBone || !this._templet)
                return;
            this._bones = [];
            let bones = this._spineRender.getBones();
            if (!bones || bones.length === 0)
                return;
            let map = new Map;
            this._rootBone = new Laya.Sprite();
            this._rootBone.name = "__bone_root__";
            this.owner.addChild(this._rootBone);
            let transform = this._spineRender.getSkeletonTransform();
            let offsetX = -transform.x + this._renderOffset.x;
            let offsetY = -transform.y - this._renderOffset.y;
            for (let i = 0; i < bones.length; i++) {
                let bone = bones[i];
                let boneSprite = new Laya.Sprite();
                boneSprite.name = bone.data.name;
                let attachSprite = new Laya.Sprite();
                attachSprite.name = bone.data.name + "__attach";
                attachSprite.scaleY = -1;
                boneSprite.x = bone.worldX + offsetX;
                boneSprite.y = -(bone.worldY + offsetY);
                boneSprite.addChild(attachSprite);
                this._rootBone.addChild(boneSprite);
                this._bones.push(boneSprite);
                map.set(bone.data.name, attachSprite);
            }
            this._boneMap = map;
        }
        getBone(boneName) {
            return this._boneMap.get(boneName);
        }
        get externalSkins() {
            return this._externalSkins;
        }
        set externalSkins(value) {
            if (value) {
                for (let i = value.length - 1; i >= 0; i--) {
                    value[i].target = this;
                }
            }
            this._externalSkins = value;
        }
        renderUpdate(context) {
            this._updateLight();
        }
        resetExternalSkin() {
            var _a;
            if (this._spineRender) {
                this._spineRender.resetExternalSkin();
                this._flushExtSkin();
                this._skinRenderDirty = true;
                (_a = this.owner) === null || _a === void 0 ? void 0 : _a.repaint(Laya.RepaintFlag.UpdateRT);
            }
        }
        get premultipliedAlpha() {
            return !this._templet || this._setPreAlphaFlag ? this._premultipliedAlpha : this._templet.premultipliedAlpha;
        }
        set premultipliedAlpha(value) {
            this._premultipliedAlpha = value;
            if (!this._spineRender)
                return;
            if (this._setPreAlphaFlag || !this._templet) {
                this._spineRender.premultipliedAlpha = value;
            }
            else {
                this._spineRender.premultipliedAlpha = this._templet.premultipliedAlpha;
            }
        }
        setPremultipliedAlpha(value) {
            this._premultipliedAlpha = value;
            this._spineRender.premultipliedAlpha = value;
            this._setPreAlphaFlag = true;
        }
        get source() {
            return this._source;
        }
        set source(value) {
            this._source = value;
            if (value) {
                let template = Laya.ILaya.loader.getRes(value, Laya.Loader.SPINE);
                if (template) {
                    this.templet = template;
                }
                else {
                    Laya.ILaya.loader.load(value, Laya.Loader.SPINE).then((templet) => {
                        if (!this._source || templet && !templet.isCreateFromURL(this._source))
                            return;
                        if (this.destroyed)
                            return;
                        this.templet = templet;
                    });
                }
            }
            else
                this.templet = null;
        }
        get skinName() {
            return this._skinName;
        }
        set skinName(value) {
            this._skinName = value;
            if (this._templet)
                this.showSkinByName(value);
        }
        get animationName() {
            return this._animationName;
        }
        set animationName(value) {
            this._animationName = value;
            if (this._templet)
                this.play(value, this._loop, true);
        }
        get maxDetlaTime() {
            return this._maxDeltaTime;
        }
        set maxDetlaTime(value) {
            this._maxDeltaTime = value;
        }
        get loop() {
            return this._loop;
        }
        set loop(value) {
            this._loop = value;
            if (this._templet)
                this.play(this._animationName, this._loop, true);
        }
        get url() {
            return this._skin;
        }
        set url(value) {
            if (this._skin != value) {
                this._skin = value;
                Laya.Laya.loader.load(value, Laya.Loader.SPINE).then((templet) => {
                    this.init(templet);
                });
            }
        }
        get twoColorTint() {
            return this._spriteShaderData.hasDefine(SpineShaderInit.SPINE_TWOCOLORTINT);
        }
        set twoColorTint(value) {
            if (value) {
                this._spriteShaderData.addDefine(SpineShaderInit.SPINE_TWOCOLORTINT);
            }
            else {
                this._spriteShaderData.removeDefine(SpineShaderInit.SPINE_TWOCOLORTINT);
            }
        }
        get templet() {
            return this._templet;
        }
        set templet(value) {
            this.init(value);
        }
        set currentTime(value) {
            if (!this._templet)
                return;
            value /= 1000;
            if (value < this._playStart || (!!this._playEnd && value > this._playEnd) || value > this._duration)
                throw new Error("AnimationPlayer: value must large than playStartTime,small than playEndTime.");
            this._spineRender.currentTime = value;
        }
        get currentTime() {
            if (!this._templet)
                return 0;
            return this._spineRender.currentTime;
        }
        get playState() {
            return this._playState;
        }
        get useFastRender() {
            return this._useFastRender;
        }
        set useFastRender(value) {
            if (this._useFastRender === value)
                return;
            this._useFastRender = value;
            if (!this._templet)
                return;
            this._spineRender.mode = !SpineConst.normalRenderSwitch && value ? exports.ESpineRenderMode.Optimize : exports.ESpineRenderMode.Normal;
        }
        get offset() {
            return this._offset;
        }
        set offset(value) {
            this._offset = value;
            if (this._templet) {
                if (value) {
                    this._renderOffset.x = value.x + this._templet.offsetX;
                    this._renderOffset.y = value.y - this._templet.offsetY;
                }
                else {
                    this._renderOffset.x = this._templet.offsetX;
                    this._renderOffset.y = -this._templet.offsetY;
                }
                this._renderHandle.offset = this._renderOffset;
            }
            this.boundsChange = true;
            if (this.playState !== exports.ESpineRenderState.Playing) {
                this.owner.repaint(Laya.RepaintFlag.UpdateRT);
            }
        }
        get autoAdjust() {
            return this._autoAdjust;
        }
        set autoAdjust(value) {
            if (this._autoAdjust === value)
                return;
            this._autoAdjust = value;
            if (value) {
                this._doAutoAdjust();
            }
        }
        get enableCache() {
            return this._enableCache;
        }
        set enableCache(value) {
            if (this._enableCache === value)
                return;
            this._enableCache = value;
            if (this._spineRender) {
                if (value) {
                    this._spineRender.enableCache();
                }
                else {
                    this._spineRender.disableCache();
                }
            }
            if (this._animationName) {
                this.play(this._animationName, this._loop, true, this._playStart, this._playEnd, false, this._playAudio);
            }
        }
        _doAutoAdjust() {
            if (!this._templet)
                return;
            let width = this._templet.width;
            let height = this._templet.height;
            if (width === undefined || height === undefined) {
                console.warn('Spine.SkeletonData: width or height is undefined');
                this._autoAdjust = false;
                return;
            }
            if (width < 1)
                width = 100;
            if (height < 1)
                height = 100;
            this.owner.size(Math.round(width), Math.round(height));
            this.owner.pivot(Math.round(this._templet.offsetX), Math.round(-this._templet.offsetY));
        }
        onEnable() {
            this._transformDirty = true;
            this.owner.on(Laya.Event.TRANSFORM_CHANGED, this, this.onTransformChanged);
            if (this._leakReleased && this._releasedTemplet && !this._releasedTemplet.destroyed && !this._spineRender && !this.destroyed) {
                this.init(this._releasedTemplet);
            }
            if (this._spineRender && Laya.LayaEnv.isPlaying && this._animationName !== undefined)
                this.play(this._animationName, this._loop, true);
        }
        onDisable() {
            this.owner.off(Laya.Event.TRANSFORM_CHANGED, this, this.onTransformChanged);
            if (!this.destroyed && this._templet && this._spineRender && !this._leakReleased) {
                this._leakReleased = true;
                this._releasedTemplet = this._templet;
                if (this._renderHandle)
                    this._renderHandle.skeleton = null;
                this.clear();
                if (this._rootBone) {
                    this._rootBone.destroy();
                    this._rootBone = null;
                    this._bones = null;
                }
            }
        }
        init(templet) {
            if (this.destroyed)
                return;
            this._leakReleased = false;
            this._releasedTemplet = null;
            if (this._templet || this._spineRender) {
                this.clear();
            }
            this._templet = templet;
            if (!this._templet)
                return;
            this._templet._addReference();
            this._templet.on(SpineTemplet.EVENT_SPINE_MATERIAL_CHANGE, this, this.onSpineMaterialChange);
            this._struct.renderElements = [];
            this._struct.setRepaint();
            this._spineRender = SpineConst.factory.createSpineRender2D(this);
            this._spineRender.init(templet);
            this._spineRender.mode = !SpineConst.normalRenderSwitch && this._useFastRender ? exports.ESpineRenderMode.Optimize : exports.ESpineRenderMode.Normal;
            this._spineRender.premultipliedAlpha = this._setPreAlphaFlag ? this._premultipliedAlpha : this._templet.premultipliedAlpha;
            if (this._enableCache) {
                this._spineRender.enableCache();
            }
            if (this._autoAdjust) {
                this._doAutoAdjust();
            }
            this._renderOffset.x = this._offset.x + this._templet.offsetX;
            this._renderOffset.y = this._offset.y - this._templet.offsetY;
            this._renderHandle.offset = this._renderOffset;
            if (this._createBone) {
                this._createBones();
            }
            this.onTransformChanged();
            this.boundsChange = true;
            let skinIndex = this._templet.getSkinIndexByName(this._skinName);
            if (skinIndex != -1)
                this.showSkinByIndex(skinIndex);
            this.onTransformChanged();
            this._spineRender.setEventListener({
                start: (entry) => {
                },
                interrupt: (entry) => {
                },
                end: (entry) => {
                },
                dispose: (entry) => {
                },
                complete: (entry) => {
                    const spineRender = this._spineRender;
                    this.owner.event(Laya.Event.END);
                    if (spineRender !== this._spineRender) {
                        return;
                    }
                    if (entry.loop) {
                        spineRender.complete();
                        this.owner.event(Laya.Event.COMPLETE);
                    }
                    else {
                        this.stop();
                    }
                },
                event: (entry, event) => {
                    let eventData = {
                        audioValue: event.data.audioPath,
                        audioPath: event.data.audioPath,
                        floatValue: event.floatValue,
                        intValue: event.intValue,
                        name: event.data.name,
                        stringValue: event.stringValue,
                        time: event.time * 1000,
                        balance: event.balance,
                        volume: event.volume
                    };
                    const spineRender = this._spineRender;
                    this.owner.event(Laya.Event.LABEL, eventData);
                    if (spineRender !== this._spineRender) {
                        return;
                    }
                    if (this._playAudio && eventData.audioValue) {
                        let channel = Laya.SoundManager.playSound(eventData.audioValue, 1, Laya.Handler.create(this, this._onAniSoundStoped), null, (spineRender.currentTime * 1000 - eventData.time) / 1000);
                        Laya.SoundManager.playbackRate = this._playbackRate;
                        channel && this._soundChannelArr.push(channel);
                    }
                }
            });
            this._flushExtSkin();
            this.owner.event(Laya.Event.READY);
            if (Laya.LayaEnv.isPlaying
                && this.enabled
                && this._animationName !== undefined) {
                this.play(this._animationName, this._loop, true);
            }
        }
        play(nameOrIndex, loop, force = true, start = 0, end = 0, freshSkin = true, playAudio = true) {
            if (!this._templet) {
                console.warn("Spine2DRenderNode.play: templet is not ready, animation:", nameOrIndex);
                return;
            }
            this._playAudio = playAudio;
            start /= 1000;
            end /= 1000;
            this._loop = loop;
            if (start < 0 || end < 0)
                throw new Error("SpineSkeleton: start and end must large than zero.");
            if ((end !== 0) && (start > end))
                throw new Error("SpineSkeleton: start must less than end.");
            if (typeof nameOrIndex == "number") {
                nameOrIndex = this.getAniNameByIndex(nameOrIndex);
            }
            else {
                if (!this.templet.hasAnimation(nameOrIndex))
                    return;
            }
            if (force || this._pause || this._animationName != nameOrIndex) {
                this._animationName = nameOrIndex;
                this._spineRender.play(nameOrIndex, loop, this.trackIndex, start, end);
                let duration = this._spineRender.trackEntry.animation.duration;
                this._duration = duration;
                this._playStart = start;
                this._playEnd = end <= duration ? end : duration;
                if (this._pause) {
                    this._pause = false;
                    this._needUpdate = true;
                }
                this._playState = exports.ESpineRenderState.Playing;
                this._update();
                this.owner.event(Laya.Event.PLAYED);
            }
        }
        _update() {
            this.owner.repaint(Laya.RepaintFlag.UpdateRT);
        }
        onPreRender() {
            if (this._needUpdate || this._skinRenderDirty) {
                this._skinRenderDirty = false;
                const spineRender = this._spineRender;
                if (!spineRender) {
                    return;
                }
                if (this._transformDirty) {
                    let matrix = this.owner.globalTrans.getMatrix();
                    spineRender.setSkeletonPosition(matrix.tx, matrix.ty);
                    this._transformDirty = false;
                }
                let timerDelta = Laya.Laya.timer.delta / 1000;
                if (timerDelta > this._maxDeltaTime)
                    timerDelta = this._maxDeltaTime;
                let delta = timerDelta * this._playbackRate;
                if (this._needUpdate)
                    spineRender.update(delta);
                if (this.destroyed || spineRender !== this._spineRender) {
                    return;
                }
                spineRender.render(this._needUpdate ? spineRender.currentTime : 0, this._needUpdate ? this.physicsUpdate : 0);
                this._updateBones();
            }
        }
        _updateBones() {
            if (!this._createBone || !this._bones)
                return;
            let bones = this._spineRender.getBones();
            if (!bones || bones.length === 0)
                return;
            let transform = this._spineRender.getSkeletonTransform();
            let offset = this._renderOffset;
            let offsetX = -transform.x + offset.x;
            let offsetY = -transform.y - offset.y;
            for (let i = 0; i < bones.length && i < this._bones.length; i++) {
                let bone = bones[i];
                let boneSprite = this._bones[i];
                let matrix = boneSprite.transform;
                if (!matrix) {
                    matrix = new Laya.Matrix();
                    boneSprite.transform = matrix;
                }
                matrix.a = bone.a;
                matrix.b = bone.b;
                matrix.c = -bone.c;
                matrix.d = -bone.d;
                matrix.tx = bone.worldX + offsetX;
                matrix.ty = -(bone.worldY + offsetY);
                boneSprite.transform = matrix;
            }
        }
        _flushExtSkin() {
            let skins = this._externalSkins;
            if (skins && skins.length > 0) {
                this.useFastRender = false;
                for (let i = skins.length - 1; i >= 0; i--) {
                    skins[i].flush();
                }
            }
        }
        getAnimNum() {
            return this._templet.getAnimationCount();
        }
        getAniNameByIndex(index) {
            return this._templet.getAniNameByIndex(index);
        }
        getSlotByName(slotName) {
            return this._spineRender.findSlot(slotName);
        }
        playbackRate(value) {
            this._playbackRate = value;
        }
        showSkinByName(name) {
            this.showSkinByIndex(this._templet.getSkinIndexByName(name));
        }
        showSkinByIndex(skinIndex) {
            var _a;
            this._spineRender.showSkinByIndex(skinIndex);
            this._flushExtSkin();
            this._skinRenderDirty = true;
            (_a = this.owner) === null || _a === void 0 ? void 0 : _a.repaint(Laya.RepaintFlag.UpdateRT);
        }
        stop() {
            if (this._playState === exports.ESpineRenderState.Stopped)
                return;
            this._pause = true;
            this._needUpdate = false;
            this._playState = exports.ESpineRenderState.Stopped;
            this.owner.event(Laya.Event.STOPPED);
            if (this._soundChannelArr.length > 0) {
                this._onAniSoundStoped(true);
            }
        }
        onUpdate() {
            this._needUpdate && this._update();
        }
        paused() {
            if (!this._pause) {
                this._pause = true;
                this._needUpdate = false;
                this._playState = exports.ESpineRenderState.Paused;
                this.owner.event(Laya.Event.PAUSED);
                if (this._soundChannelArr.length > 0) {
                    for (let len = this._soundChannelArr.length, i = 0; i < len; i++) {
                        let channel = this._soundChannelArr[i];
                        if (!channel.isStopped) {
                            channel.pause();
                        }
                    }
                }
            }
        }
        resume() {
            if (this._playState === exports.ESpineRenderState.Paused) {
                this._pause = false;
                this._needUpdate = true;
                this._playState = exports.ESpineRenderState.Playing;
                if (this._soundChannelArr.length > 0) {
                    for (let len = this._soundChannelArr.length, i = 0; i < len; i++) {
                        let channel = this._soundChannelArr[i];
                        if (channel.audioBuffer) {
                            channel.resume();
                        }
                    }
                }
            }
        }
        _onAniSoundStoped(force) {
            for (let len = this._soundChannelArr.length, i = 0; i < len; i++) {
                let channel = this._soundChannelArr[i];
                if (channel.isStopped || force) {
                    !channel.isStopped && channel.stop();
                    this._soundChannelArr.splice(i, 1);
                    len--;
                    i--;
                }
            }
        }
        onSpineMaterialChange() {
            if (this._spineRender)
                this._spineRender.clearCacheMaterials();
        }
        reset() {
            var _a;
            (_a = this._spineRender) === null || _a === void 0 ? void 0 : _a.reset();
            if (this._templet) {
                this._templet.off(SpineTemplet.EVENT_SPINE_MATERIAL_CHANGE, this, this.onSpineMaterialChange);
                this._templet._removeReference(1);
                this._templet = null;
            }
            this._pause = true;
            this._needUpdate = false;
            this._playState = exports.ESpineRenderState.Stopped;
            if (this._soundChannelArr.length > 0)
                this._onAniSoundStoped(true);
            this.owner.repaint();
        }
        addAnimation(nameOrIndex, loop = false, delay = 0) {
            delay /= 1000;
            let animationName = nameOrIndex;
            if (typeof animationName == "number") {
                animationName = this.getAniNameByIndex(animationName);
            }
            this._animationName = animationName;
            this._spineRender.addAnimation(animationName, loop, delay, this.trackIndex);
        }
        setSlotTexture(slotName, texture, createAttachment = true, updateAttachmentSize = true) {
            if (this._useFastRender) {
                console.log("setSlotTexture: useFastRender is true, return");
                return;
            }
            this._spineRender.setSlotTexture(slotName, texture, createAttachment, updateAttachmentSize);
        }
        restoreSlotTexture(slotName) {
            var _a, _b;
            if (this._useFastRender) {
                console.log("restoreSlotTexture: useFastRender is true, return");
                return false;
            }
            return (_b = (_a = this._spineRender) === null || _a === void 0 ? void 0 : _a.restoreSlotTexture(slotName)) !== null && _b !== void 0 ? _b : false;
        }
        setTempletAttachment(templet, targetSlotName, skinName, attachmentName) {
            var _a;
            if (this._useFastRender) {
                console.log("setTempletAttachment: useFastRender is true, return");
                return;
            }
            this._spineRender.setTempletAttachment(templet, targetSlotName, skinName, attachmentName);
            this._skinRenderDirty = true;
            (_a = this.owner) === null || _a === void 0 ? void 0 : _a.repaint(Laya.RepaintFlag.UpdateRT);
        }
        setMix(fromNameOrIndex, toNameOrIndex, duration) {
            duration /= 1000;
            let fromName = fromNameOrIndex;
            if (typeof fromName == "number") {
                fromName = this.getAniNameByIndex(fromName);
            }
            let toName = toNameOrIndex;
            if (typeof toName == "number") {
                toName = this.getAniNameByIndex(toName);
            }
            this._spineRender.setMix(fromName, toName, duration);
        }
        getBoneByName(boneName) {
            return this._spineRender.findBone(boneName);
        }
        getSkeleton() {
            return this._spineRender ? this._spineRender.getSkeleton() : null;
        }
        updateWorldTransform(physicsUpdate = this.physicsUpdate) {
            if (this._spineRender) {
                this._spineRender.updateWorldTransform(physicsUpdate);
            }
        }
        physicsTranslate(x, y) {
            this._spineRender.physicsTranslate(x, y);
        }
        onTransformChanged() {
            this._transformDirty = true;
        }
        setSlotAttachment(slotName, attachmentName) {
            this.useFastRender = false;
            this._spineRender.setAttachment(slotName, attachmentName);
        }
        clear() {
            var _a;
            this._needUpdate = false;
            this._pause = true;
            const spineRender = this._spineRender;
            this._spineRender = null;
            this._struct.renderElements = this._renderElements;
            (_a = this.owner) === null || _a === void 0 ? void 0 : _a.repaint();
            spineRender === null || spineRender === void 0 ? void 0 : spineRender.destroy();
            this.reset();
        }
        onDestroy() {
            this._releasedTemplet = null;
            if (this._templet || this._spineRender) {
                this.clear();
            }
            if (this._rootBone) {
                this._rootBone.destroy();
                this._rootBone = null;
                this._bones = null;
            }
        }
        get rect() {
            if (this._boundsChange) {
                if (this._templet) {
                    this._rect.z = this._templet.width + this._renderOffset.x;
                    this._rect.w = this._templet.height + this._renderOffset.y;
                }
                else {
                    this._rect.z = this.owner.width + this._renderOffset.x;
                    this._rect.w = this.owner.height + this._renderOffset.y;
                }
                this._rect.x = this._renderOffset.x;
                this._rect.y = this._renderOffset.y;
                this._boundsChange = false;
            }
            return this._rect;
        }
    }
    Spine2DRenderNode.STOPPED = 0;
    Spine2DRenderNode.PAUSED = 1;
    Spine2DRenderNode.PLAYING = 2;

    class SpineSkeleton extends Laya.Sprite {
        constructor() {
            super();
            this._spineComponent = this.addComponent(Spine2DRenderNode);
        }
        get externalSkins() {
            return this._spineComponent.externalSkins;
        }
        set externalSkins(value) {
            this._spineComponent.externalSkins = value;
        }
        resetExternalSkin() {
            this._spineComponent.resetExternalSkin();
        }
        get source() {
            return this._spineComponent.source;
        }
        set source(value) {
            this._spineComponent.source = value;
        }
        get skinName() {
            return this._spineComponent.skinName;
        }
        set skinName(value) {
            this._spineComponent.skinName = value;
        }
        get animationName() {
            return this._spineComponent.animationName;
        }
        set animationName(value) {
            this._spineComponent.animationName = value;
        }
        get loop() {
            return this._spineComponent.loop;
        }
        set loop(value) {
            this._spineComponent.loop = value;
        }
        get templet() {
            return this._spineComponent.templet;
        }
        set templet(value) {
            this._spineComponent.templet = value;
        }
        set currentTime(value) {
            this._spineComponent.currentTime = value;
        }
        get playState() {
            return this._spineComponent.playState;
        }
        play(nameOrIndex, loop, force = true, start = 0, end = 0, freshSkin = true, playAudio = true) {
            this._spineComponent.play(nameOrIndex, loop, force, start, end, freshSkin, playAudio);
        }
        getAnimNum() {
            return this._spineComponent.getAnimNum();
        }
        getAniNameByIndex(index) {
            return this._spineComponent.getAniNameByIndex(index);
        }
        getSlotByName(slotName) {
            return this._spineComponent.getSlotByName(slotName);
        }
        playbackRate(value) {
            this._spineComponent.playbackRate(value);
        }
        showSkinByName(name) {
            this._spineComponent.showSkinByName(name);
        }
        showSkinByIndex(skinIndex) {
            this._spineComponent.showSkinByIndex(skinIndex);
        }
        stop() {
            this._spineComponent.stop();
        }
        paused() {
            this._spineComponent.paused();
        }
        resume() {
            this._spineComponent.resume();
        }
        destroy(destroyChild = true) {
            if (this._spineComponent.templet) {
                this._spineComponent.clear();
            }
            super.destroy(destroyChild);
        }
        addAnimation(nameOrIndex, loop = false, delay = 0) {
            this._spineComponent.addAnimation(nameOrIndex, loop, delay);
        }
        setMix(fromNameOrIndex, toNameOrIndex, duration) {
            this._spineComponent.setMix(fromNameOrIndex, toNameOrIndex, duration);
        }
        getBoneByName(boneName) {
            return this._spineComponent.getBoneByName(boneName);
        }
        getSkeleton() {
            return this._spineComponent.getSkeleton();
        }
        updateWorldTransform(physicsUpdate = this._spineComponent.physicsUpdate) {
            this._spineComponent.updateWorldTransform(physicsUpdate);
        }
        setSlotAttachment(slotName, attachmentName) {
            this._spineComponent.setSlotAttachment(slotName, attachmentName);
        }
    }
    exports.ESpineRenderType = void 0;
    (function (ESpineRenderType) {
        ESpineRenderType[ESpineRenderType["boneGPU"] = 0] = "boneGPU";
        ESpineRenderType[ESpineRenderType["normal"] = 1] = "normal";
        ESpineRenderType[ESpineRenderType["rigidBody"] = 2] = "rigidBody";
    })(exports.ESpineRenderType || (exports.ESpineRenderType = {}));

    let c = Laya.ClassUtils.regClass;
    c("SpineSkeleton", SpineSkeleton);
    c("ExternalSkin", ExternalSkin);
    c("ExternalSkinItem", ExternalSkinItem);
    c("Spine2DRenderNode", Spine2DRenderNode);
    Laya.Laya.addBeforeInitCallback(() => {
        if (Laya.PlayerConfig.spineVersion)
            SpineConst.VERSION = Laya.PlayerConfig.spineVersion;
    });

    class NativeSkeletonOptimise {
        static __init__() {
            let dec = SpineShaderInit.getAllVertexDeclarations();
            for (const vertexFlag in dec) {
                const vertexDeclaration = dec[vertexFlag];
                if (vertexDeclaration && vertexDeclaration._shaderValues) {
                    for (const shaderLocation of Object.keys(vertexDeclaration._shaderValues)) {
                        let location = parseInt(shaderLocation);
                        const vertexStateContext = vertexDeclaration._shaderValues[location];
                        if (vertexStateContext) {
                            NativeSkeletonOptimise.SetVertexDeclaration(vertexFlag, location, vertexStateContext);
                        }
                    }
                }
            }
        }
        static SetVertexDeclaration(vertexFlag, shaderLocation, context) {
            conchSkeletonOptimise.SetVertexDeclaration(vertexFlag, shaderLocation, context);
        }
        constructor() {
            this._registTextures = new Map();
            this.data = null;
            this._animationNames = [];
            this._skinNames = [];
            this._materials = [];
            this._nativeOptimise = new conchSkeletonOptimise();
            this._nativeOptimise.setMaterialTemplateInitializer(this.nativeCreateMaterialTemplet.bind(this));
        }
        init() {
            this._animationNames = this._nativeOptimise.getAllAnimationNames() || [];
            this._skinNames = this._nativeOptimise.getAllSkinNames() || [];
        }
        getAnimationCount() {
            return this._animationNames.length;
        }
        getAniNameByIndex(index) {
            if (index >= 0 && index < this._animationNames.length) {
                return this._animationNames[index];
            }
            return null;
        }
        getAllAnimationNames() {
            return this._animationNames;
        }
        findAnimation(name) {
            return null;
        }
        hasAnimation(name) {
            return this._animationNames.indexOf(name) !== -1;
        }
        getSkinIndexByName(skinName) {
            if (!skinName) {
                return -1;
            }
            return this._skinNames.indexOf(skinName);
        }
        getSkinCount() {
            return this._skinNames.length;
        }
        getSkinNameByIndex(index) {
            if (index >= 0 && index < this._skinNames.length) {
                return this._skinNames[index];
            }
            return null;
        }
        getAllSkinNames() {
            return this._skinNames;
        }
        checkMainAttach(skeleton, skeletonData) {
        }
        registerTexturePage(textureId, pageName, pageWidth, pageHeight) {
            this._nativeOptimise.registerTexturePage(textureId, pageName, pageWidth, pageHeight);
        }
        registerTextureRegion(pageName, textureName, width, height, originalWidth, originalHeight, offsetX, offsetY, u, v, u2, v2) {
            this._nativeOptimise.registerTextureRegion(pageName, textureName, width, height, originalWidth, originalHeight, offsetX, offsetY, u, v, u2, v2);
        }
        registerTexture(texture) {
            let isTexture = false;
            let texture2d;
            if (texture instanceof Laya.Texture) {
                texture2d = texture.bitmap;
                isTexture = true;
            }
            else
                texture2d = texture;
            if (!texture2d)
                return null;
            let bitmapUrl = texture2d.url || "texture";
            let textureName = this._getTextureName(texture);
            if (this._registTextures.get(bitmapUrl) !== texture2d.id) {
                this._registTextures.set(bitmapUrl, texture2d.id);
                this.registerTexturePage(texture2d.id, bitmapUrl, texture2d.width, texture2d.height);
            }
            let width = texture.width;
            let height = texture.height;
            let originalWidth = texture.width;
            let originalHeight = texture.height;
            let offsetX = 0;
            let offsetY = 0;
            let u = 0;
            let v = 0;
            let u2 = 1.0;
            let v2 = 1.0;
            if (isTexture) {
                originalWidth = texture.sourceWidth;
                originalHeight = texture.sourceHeight;
                offsetX = texture.offsetX;
                offsetY = texture.offsetY;
                if (texture.uv && texture.uv.length >= 8) {
                    u = texture.uv[0];
                    v = texture.uv[1];
                    u2 = texture.uv[4];
                    v2 = texture.uv[5];
                }
            }
            this.registerTextureRegion(bitmapUrl, textureName, width, height, originalWidth, originalHeight, offsetX, offsetY, u, v, u2, v2);
            return {
                textureId: texture2d.id,
                pageName: bitmapUrl,
                textureName
            };
        }
        _getTextureName(texture) {
            let textureName = texture.name;
            if (!textureName && texture.url) {
                textureName = texture.url.split("/").pop().split("\\").pop();
            }
            return textureName || "texture";
        }
        initMaterials(textureUrls, textures) {
            if (textureUrls.length === 0 || textures.length === 0) {
                return;
            }
            this._createMaterial(false, "", null);
            this._createMaterial(true, "", null);
            for (let i = 0, n = textureUrls.length; i < n; i++) {
                const textureUrl = textureUrls[i];
                const texture = textures[i];
                this._createMaterial(false, textureUrl, texture);
                this._createMaterial(true, textureUrl, texture);
            }
        }
        nativeCreateMaterialTemplet(textureUrl, is3D) {
            let texture = this._templet.getTexture(textureUrl);
            this._createMaterial(is3D, textureUrl, texture);
        }
        _createMaterial(is3D, textureUrl, texture) {
            const material = new Laya.Material();
            material.setShaderName(is3D ? "Spine3D" : "SpineStandard");
            SpineShaderInit.initSpineMaterial(material);
            if (texture) {
                const shaderData = material.shaderData;
                shaderData.setTexture(SpineShaderInit.SpineTexture, texture);
                if (texture.gammaCorrection !== 1) {
                    shaderData.addDefine(Laya.ShaderDefines2D.GAMMATEXTURE);
                }
            }
            material.lock = true;
            this._materials.push(material);
            this._nativeOptimise.setMaterialTemplate(is3D, textureUrl, texture ? texture._id : -1, material.shaderData._nativeObj, material.shader.getSubShaderAt(0).moduleData._nativeObj);
            return material;
        }
        destroy() {
            for (let i = 0; i < this._materials.length; i++) {
                const material = this._materials[i];
                if (material) {
                    material.destroy();
                }
            }
            this._materials.length = 0;
            if (this._nativeOptimise) {
                this._nativeOptimise.destroy();
                this._nativeOptimise = null;
            }
            this.data = null;
            this._animationNames = [];
            this._skinNames = [];
        }
        _getNativeOptimise() {
            return this._nativeOptimise;
        }
    }

    class NativeSpineTempletParser {
        constructor() {
            this._cachedTextureUrls = null;
            this._premultipliedAlpha = SpineConst.PREMULTIPLIED_ALPHA_DEFAULT;
            this._atlasTextContent = null;
            this._nativeParser = new conchNativeSpineTempletParser();
        }
        collectTextures(atlasText, task) {
            this._atlasTextContent = atlasText;
            const lines = atlasText.split(SpineConst.SPLIT_REGEX);
            const textureInfos = [];
            const urls = [];
            let currentPma = this._premultipliedAlpha;
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (!trimmed)
                    continue;
                const pmaMatch = trimmed.match(SpineConst.PMA_REGEX);
                if (pmaMatch) {
                    currentPma = pmaMatch[1].toLowerCase() === "true";
                    continue;
                }
                if (trimmed.indexOf(".png") !== -1 || trimmed.indexOf(".jpg") !== -1 ||
                    trimmed.indexOf(".jpeg") !== -1 || trimmed.indexOf(".webp") !== -1) {
                    const lastSlash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
                    const texturePath = lastSlash !== -1
                        ? trimmed.substring(lastSlash + 1)
                        : trimmed;
                    textureInfos.push({
                        path: texturePath,
                        pma: currentPma
                    });
                    this._premultipliedAlpha = currentPma && this._premultipliedAlpha;
                    urls.push(texturePath);
                    currentPma = true;
                }
            }
            this._cachedTextureUrls = urls;
            const basePath = task.url.substring(0, task.url.lastIndexOf("/") + 1);
            return textureInfos.map((info) => ({
                url: basePath + info.path,
                type: "TEXTURE2D",
                propertyParams: {
                    premultiplyAlpha: info.pma
                },
                constructParams: [0, 0, Laya.TextureFormat.R8G8B8A8, false, false, true, info.pma]
            }));
        }
        create(desc, textures) {
            const isBinary = desc instanceof ArrayBuffer;
            let textureUrls = this._cachedTextureUrls;
            if (textureUrls.length > 0 && textures.length > 0) {
                let currentPma = this._premultipliedAlpha;
                const minLength = Math.min(textureUrls.length, textures.length);
                for (let i = 0; i < minLength; i++) {
                    const texture = textures[i];
                    if (texture) {
                        currentPma = currentPma && texture._premultiplyAlpha;
                        this._nativeParser.addTextureSizeInfo(textureUrls[i], texture.width, texture.height, texture.id);
                        texture._addReference();
                    }
                }
                this._premultipliedAlpha = currentPma;
            }
            const optimize = new NativeSkeletonOptimise();
            const rtSkeletonOptimize = optimize._getNativeOptimise();
            const templet = new SpineTemplet();
            templet.optimize = optimize;
            optimize._templet = templet;
            templet._textures = {};
            for (let i = 0; i < textureUrls.length; i++) {
                templet.setTexture(textureUrls[i], textures[i]);
            }
            const parseResultBuffer = new Float32Array(6);
            let parseSuccess;
            if (isBinary) {
                parseSuccess = this._nativeParser.parseBinary(rtSkeletonOptimize, desc, this._atlasTextContent, parseResultBuffer);
            }
            else {
                const jsonData = typeof desc === "string" ? JSON.parse(desc) : desc;
                const skeletonData = jsonData && jsonData.skeleton;
                const hasSkeletonBounds = !!skeletonData
                    && skeletonData.x !== undefined
                    && skeletonData.y !== undefined
                    && skeletonData.width !== undefined
                    && skeletonData.height !== undefined;
                parseSuccess = this._nativeParser.parse(rtSkeletonOptimize, JSON.stringify(desc), this._atlasTextContent, hasSkeletonBounds, parseResultBuffer);
            }
            if (!parseSuccess) {
                console.error("Failed to parse Spine skeleton data");
                return null;
            }
            const x = parseResultBuffer[0];
            const y = parseResultBuffer[1];
            const width = parseResultBuffer[2];
            const height = parseResultBuffer[3];
            const offsetX = parseResultBuffer[4];
            const offsetY = parseResultBuffer[5];
            templet.x = x;
            templet.y = y;
            templet.width = width;
            templet.height = height;
            templet.offsetX = offsetX;
            templet.offsetY = offsetY;
            optimize.init();
            templet._premultipliedAlpha = this._premultipliedAlpha;
            templet._parser = this;
            return templet;
        }
        destroy() {
            if (this._nativeParser) {
                this._nativeParser.destroy();
                this._nativeParser = null;
            }
        }
    }

    class NativeSpineOptimizeRenderBase {
        constructor(owner, nativeRender) {
            this._sharedBoneBuffer = null;
            this._sharedTrackEntryBuffer = new Float32Array(7);
            this._boneNames = [];
            this._skeletonVec2 = new Laya.Vector2();
            this._premultipliedAlpha = true;
            this._mode = exports.ESpineRenderMode.Optimize;
            this.state = exports.ESpineRenderState.Stopped;
            this.currentTime = 0;
            this.trackEntry = {
                animation: {
                    duration: 0
                },
                animationEnd: 0,
                animationStart: 0,
                loop: false,
                trackIndex: 0
            };
            this.bones = [];
            this._owner = owner;
            this._nativeRender = nativeRender;
        }
        setSlotTexture(slotName, texture, createAttachment, updateAttachmentSize = true) {
            if (!this._templet || !texture) {
                return;
            }
            this._templet.registerTexture(texture);
            let optimize = this._templet.optimize;
            let newRegion = optimize.registerTexture(texture);
            if (!newRegion) {
                return;
            }
            this._nativeRender.setSlotTexture(slotName, newRegion.textureId, newRegion.pageName, newRegion.textureName, createAttachment, updateAttachmentSize);
        }
        restoreSlotTexture(slotName) {
            if (!this._nativeRender || !slotName) {
                return false;
            }
            return !!this._nativeRender.restoreSlotTexture(slotName);
        }
        setTempletAttachment(templet, targetSlotName, skinName, attachmentName) {
            if (!this._templet || !templet || !targetSlotName || !skinName || !attachmentName) {
                return;
            }
            let sourceOptimize = templet.optimize;
            if (templet._textures) {
                for (let textureName in templet._textures) {
                    let texture2d = templet._textures[textureName];
                    if (texture2d && !this._templet._textures[textureName]) {
                        this._templet.setTexture(textureName, texture2d);
                    }
                }
            }
            this._nativeRender.setTempletAttachment(sourceOptimize._getNativeOptimise(), targetSlotName, skinName, attachmentName);
        }
        getSkeleton() {
            return null;
        }
        init(templet) {
            this._templet = templet;
            const optimize = templet.optimize;
            if (!optimize) {
                throw new Error("SpineTemplet.optimize is required for native rendering");
            }
            const nativeOptimize = optimize._getNativeOptimise ? optimize._getNativeOptimise() : optimize;
            this._nativeRender.init(nativeOptimize);
            this._initializeBoneData();
            if (this._nativeRender.bindTrackEntryBuffer) {
                this._nativeRender.bindTrackEntryBuffer(this._sharedTrackEntryBuffer);
            }
            this.premultipliedAlpha = templet.premultipliedAlpha;
            this._onInit();
        }
        _initializeBoneData() {
            if (this._nativeRender.getBoneNames) {
                this._boneNames = this._nativeRender.getBoneNames();
                const length = this._boneNames.length;
                if (length > 0) {
                    this._sharedBoneBuffer = new Float32Array(2 + length * 8);
                    this._nativeRender.bindBoneDataBuffer(this._sharedBoneBuffer);
                    this.bones = [];
                    for (let i = 0; i < length; i++) {
                        this.bones.push({
                            worldX: 0,
                            worldY: 0,
                            a: 1,
                            b: 0,
                            c: 0,
                            d: 1,
                            data: {
                                name: this._boneNames[i],
                                length: 0
                            }
                        });
                    }
                }
            }
        }
        _onInit() {
        }
        play(animationName, loop = true, trackIndex = 0, start = 0, end = 0) {
            if (!this._nativeRender) {
                return;
            }
            this._nativeRender.play(animationName, loop, trackIndex, start, end);
            this._updateTrackEntry();
        }
        addAnimation(animationName, loop = false, delay = 0, trackIndex = 0) {
            if (!this._nativeRender) {
                return;
            }
            this._nativeRender.addAnimation(animationName, loop, delay, trackIndex);
        }
        setMix(fromAnimation, toAnimation, duration) {
            if (!this._nativeRender) {
                return;
            }
            this._nativeRender.setMix(fromAnimation, toAnimation, duration);
        }
        update(delta) {
            const nativeRender = this._nativeRender;
            if (!nativeRender) {
                return;
            }
            nativeRender.update(delta);
            if (nativeRender !== this._nativeRender) {
                return;
            }
            this._updateTrackEntry();
        }
        updateWorldTransform(physicsUpdate) {
            if (!this._nativeRender) {
                return;
            }
            this._nativeRender.updateWorldTransform(physicsUpdate);
        }
        _updateTrackEntry() {
            this.trackEntry.animationStart = this._sharedTrackEntryBuffer[0];
            this.trackEntry.animationEnd = this._sharedTrackEntryBuffer[1];
            this.trackEntry.trackIndex = this._sharedTrackEntryBuffer[2];
            this.trackEntry.loop = !!this._sharedTrackEntryBuffer[3];
            this.trackEntry.animation.duration = this._sharedTrackEntryBuffer[4];
            this.currentTime = this._sharedTrackEntryBuffer[5];
            this.state = this._sharedTrackEntryBuffer[6];
        }
        render(time, physicsUpdate = 2) {
            if (!this._nativeRender) {
                return;
            }
            this._nativeRender.render(time, physicsUpdate);
        }
        showSkinByIndex(skinIndex) {
            if (!this._nativeRender) {
                return;
            }
            this._nativeRender.showSkinByIndex(skinIndex);
        }
        setAttachment(slotName, attachmentName) {
            if (!this._nativeRender) {
                return;
            }
            this._nativeRender.setAttachment(slotName, attachmentName);
        }
        findBone(boneName) {
            if (!this._sharedBoneBuffer || !this._boneNames.length) {
                return null;
            }
            const boneIndex = this._boneNames.indexOf(boneName);
            if (boneIndex === -1) {
                return null;
            }
            const offset = 2 + boneIndex * 8;
            return {
                worldX: this._sharedBoneBuffer[offset + 0],
                worldY: this._sharedBoneBuffer[offset + 1],
                a: this._sharedBoneBuffer[offset + 2],
                b: this._sharedBoneBuffer[offset + 3],
                c: this._sharedBoneBuffer[offset + 4],
                d: this._sharedBoneBuffer[offset + 5],
                data: {
                    name: boneName,
                    length: this._sharedBoneBuffer[offset + 7]
                }
            };
        }
        findSlot(slotName) {
            return null;
        }
        setSkeletonPosition(x, y) {
            if (!this._nativeRender) {
                return;
            }
            this._nativeRender.setSkeletonPosition(x, y);
        }
        physicsTranslate(x, y) {
            if (!this._nativeRender) {
                return;
            }
            this._nativeRender.physicsTranslate(x, y);
        }
        getBones() {
            if (!this._sharedBoneBuffer || !this._boneNames.length) {
                return [];
            }
            const bones = [];
            for (let i = 0; i < this._boneNames.length; i++) {
                const offset = 2 + i * 8;
                bones.push({
                    worldX: this._sharedBoneBuffer[offset + 0],
                    worldY: this._sharedBoneBuffer[offset + 1],
                    a: this._sharedBoneBuffer[offset + 2],
                    b: this._sharedBoneBuffer[offset + 3],
                    c: this._sharedBoneBuffer[offset + 4],
                    d: this._sharedBoneBuffer[offset + 5],
                    data: {
                        name: this._boneNames[i],
                        length: this._sharedBoneBuffer[offset + 7]
                    }
                });
            }
            return bones;
        }
        getSkeletonTransform() {
            if (this._sharedBoneBuffer && this._sharedBoneBuffer.length >= 2) {
                return this._skeletonVec2.setValue(this._sharedBoneBuffer[0], this._sharedBoneBuffer[1]);
            }
            return this._skeletonVec2;
        }
        resetExternalSkin() {
            if (!this._nativeRender) {
                return;
            }
            if (this._nativeRender.resetExternalSkin) {
                this._nativeRender.resetExternalSkin();
            }
        }
        reset() {
            if (!this._nativeRender) {
                return;
            }
            if (this._nativeRender.reset) {
                this._nativeRender.reset();
            }
            this._updateTrackEntry();
        }
        getSpineColor() {
            if (!this._nativeRender) {
                return new Laya.Color(1, 1, 1, 1);
            }
            if (this._nativeRender.getSpineColor) {
                const color = this._nativeRender.getSpineColor();
                if (color) {
                    return new Laya.Color(color.r, color.g, color.b, color.a);
                }
            }
            return new Laya.Color(1, 1, 1, 1);
        }
        get premultipliedAlpha() {
            return this._premultipliedAlpha;
        }
        set premultipliedAlpha(value) {
            if (this._premultipliedAlpha === value)
                return;
            this._premultipliedAlpha = value;
            if (this._nativeRender) {
                this._nativeRender.setPremultipliedAlpha(value);
            }
        }
        get mode() {
            return this._mode;
        }
        set mode(value) {
            if (this._nativeRender && this._nativeRender.setMode) {
                this._nativeRender.setMode(value);
                this._mode = this._nativeRender.getMode ? this._nativeRender.getMode() : value;
            }
            else {
                this._mode = value;
            }
        }
        complete() {
            if (!this._nativeRender) {
                return;
            }
            this._nativeRender.complete();
        }
        initBake(obj) {
            if (!this._nativeRender) {
                return;
            }
            this._nativeRender.resetBakeData();
            if (!obj) {
                if (this._nativeRender.setMode) {
                    this._nativeRender.setMode(exports.ESpineRenderMode.Optimize);
                    this._mode = this._nativeRender.getMode ? this._nativeRender.getMode() : exports.ESpineRenderMode.Optimize;
                }
                else {
                    this._mode = exports.ESpineRenderMode.Optimize;
                }
                return;
            }
            this._nativeRender.setBakeBonesNums(obj.bonesNums);
            let animationMap = obj.aniOffsetMap;
            for (const key in animationMap) {
                const offset = animationMap[key];
                if (key === "textureWidth" || typeof offset !== "number" || !isFinite(offset)) {
                    continue;
                }
                this._nativeRender.setBakeAniOffset(key, offset);
            }
            if (this._nativeRender.initBake) {
                this._nativeRender.initBake();
            }
            this._mode = this._nativeRender.getMode ? this._nativeRender.getMode() : exports.ESpineRenderMode.Bake;
        }
        setEventListener(listeners) {
            if (!this._nativeRender) {
                return;
            }
            this._listeners = listeners;
            if (listeners.start && this._nativeRender.setOnStart) {
                this._nativeRender.setOnStart((nativeEntry) => {
                    this._updateTrackEntry();
                    listeners.start(this.trackEntry);
                });
            }
            if (listeners.interrupt && this._nativeRender.setOnInterrupt) {
                this._nativeRender.setOnInterrupt((nativeEntry) => {
                    this._updateTrackEntry();
                    listeners.interrupt(this.trackEntry);
                });
            }
            if (listeners.end && this._nativeRender.setOnEnd) {
                this._nativeRender.setOnEnd((nativeEntry) => {
                    this._updateTrackEntry();
                    listeners.end(this.trackEntry);
                });
            }
            if (listeners.dispose && this._nativeRender.setOnDispose) {
                this._nativeRender.setOnDispose((nativeEntry) => {
                    this._updateTrackEntry();
                    listeners.dispose(this.trackEntry);
                });
            }
            if (listeners.complete && this._nativeRender.setOnComplete) {
                this._nativeRender.setOnComplete((nativeEntry) => {
                    this._updateTrackEntry();
                    listeners.complete(this.trackEntry);
                });
            }
            if (listeners.event && this._nativeRender.setOnEvent) {
                this._nativeRender.setOnEvent((nativeEntry, nativeEvent) => {
                    this._updateTrackEntry();
                    listeners.event(this.trackEntry, this._normalizeNativeEvent(nativeEvent || nativeEntry));
                });
            }
        }
        _normalizeNativeEvent(nativeEvent) {
            if (!nativeEvent) {
                nativeEvent = {};
            }
            let name = nativeEvent.name || "";
            let audioPath = nativeEvent.audioPath || "";
            return {
                data: {
                    name: name,
                    audioPath: audioPath
                },
                intValue: nativeEvent.intValue || 0,
                floatValue: nativeEvent.floatValue || 0,
                stringValue: nativeEvent.stringValue || "",
                time: nativeEvent.time || 0,
                balance: nativeEvent.balance || 0,
                volume: nativeEvent.volume || 0
            };
        }
        destroy() {
            const nativeRender = this._nativeRender;
            this._nativeRender = null;
            if (nativeRender) {
                if (this._listeners && nativeRender.removeEventListener) {
                    nativeRender.removeEventListener();
                }
                nativeRender.destroy();
            }
            this._listeners = null;
            this._templet = null;
            this._owner = null;
            this._sharedBoneBuffer = null;
            this.bones = [];
        }
        stop() {
            if (this._nativeRender && this._nativeRender.stop) {
                this._nativeRender.stop();
                this._updateTrackEntry();
            }
        }
        pause() {
            if (this._nativeRender && this._nativeRender.pause) {
                this._nativeRender.pause();
                this._updateTrackEntry();
            }
        }
        resume() {
            if (this._nativeRender && this._nativeRender.resume) {
                this._nativeRender.resume();
                this._updateTrackEntry();
            }
        }
        setPlaybackRate(rate) {
            if (this._nativeRender && this._nativeRender.setPlaybackRate) {
                this._nativeRender.setPlaybackRate(rate);
            }
        }
        getPlaybackRate() {
            if (this._nativeRender && this._nativeRender.getPlaybackRate) {
                return this._nativeRender.getPlaybackRate();
            }
            return 1.0;
        }
        enableCache() {
            if (this._nativeRender) {
                this._nativeRender.enableCache();
            }
        }
        disableCache() {
            if (this._nativeRender) {
                this._nativeRender.disableCache();
            }
        }
        clearCacheMaterials() {
            if (this._nativeRender && this._nativeRender.clearCacheMaterials) {
                this._nativeRender.clearCacheMaterials();
            }
        }
    }

    class NativeSpineOptimizeRender2D extends NativeSpineOptimizeRenderBase {
        constructor(owner, nativeRender) {
            super(owner, nativeRender);
            this._handle = null;
            this._handle = owner._getRenderHandle();
        }
        _onInit() {
        }
        initBake(obj) {
            if (!this._nativeRender) {
                return;
            }
            if (!obj) {
                super.initBake(obj);
                return;
            }
            let shaderData = this._owner._spriteShaderData;
            let texture = obj.texture2d;
            shaderData.setTexture(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURE, texture);
            shaderData.setNumber(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURESIZE, texture.width);
            super.initBake(obj);
        }
    }

    class NativeSpineOptimizeRender3D extends NativeSpineOptimizeRenderBase {
        constructor(owner, nativeRender) {
            super(owner, nativeRender);
        }
        initBake(obj) {
            if (!this._nativeRender) {
                return;
            }
            if (!obj) {
                super.initBake(obj);
                return;
            }
            let shaderData = this._owner.shaderData;
            let texture = obj.texture2d;
            shaderData.setTexture(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURE, texture);
            shaderData.setNumber(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURESIZE, texture.width);
            super.initBake(obj);
        }
    }

    class NativeSpineRenderDataHandle {
        constructor() {
            this._needUseMatrix = true;
            this._lightReceive = false;
            this._offset = new Laya.Vector2();
            this._baseColor = new Laya.Color(1, 1, 1, 1);
            this.renderMatrixVersion = -1;
            this._nativeObj = new window.conchRTSpineRenderDataHandle();
            this._nativeObj.needUseMatrix = true;
        }
        get needUseMatrix() {
            return this._needUseMatrix;
        }
        set needUseMatrix(value) {
            if (this._needUseMatrix === value)
                return;
            this._needUseMatrix = value;
            this._nativeObj.needUseMatrix = value;
        }
        get lightReceive() {
            return this._lightReceive;
        }
        set lightReceive(value) {
            if (this._lightReceive === value)
                return;
            this._lightReceive = value;
            if (value)
                this._owner.spriteShaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
            else
                this._owner.spriteShaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
        }
        get baseColor() {
            return this._baseColor;
        }
        set baseColor(value) {
            if (value !== this._baseColor && this._baseColor.equal(value))
                return;
            value = value || Laya.Color.BLACK;
            value.cloneTo(this._baseColor);
            this._owner.spriteShaderData.setColor(Laya.BaseRenderNode2D.BASERENDER2DCOLOR, this._baseColor);
            this._nativeObj.setBaseColor(this._baseColor);
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            if (value === this._owner)
                return;
            this._setOwnerLocal(value);
            this._nativeObj.setOwner(value ? value._nativeObj : null);
        }
        _setOwnerLocal(value) {
            if (value === this._owner)
                return;
            if (this._owner && this._owner.spriteShaderData) {
                let shaderData = this._owner.spriteShaderData;
                shaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_BASERENDER2D);
                shaderData.removeDefine(SpineShaderInit.SPINE_UV);
                shaderData.removeDefine(SpineShaderInit.SPINE_COLOR);
                shaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
            }
            this._owner = value;
            if (this._owner) {
                let shaderData = this._owner.spriteShaderData;
                shaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_BASERENDER2D);
                shaderData.addDefine(SpineShaderInit.SPINE_UV);
                shaderData.addDefine(SpineShaderInit.SPINE_COLOR);
                if (this._lightReceive)
                    shaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
            }
        }
        get offset() {
            return this._offset;
        }
        set offset(value) {
            this._offset = value;
            this._nativeObj.setOffset(value);
        }
        inheriteRenderData(context) {
            this._nativeObj.inheriteRenderData(context._nativeObj);
        }
        destroy() {
            var _a;
            this.owner = null;
            this.skeleton = null;
            (_a = this._nativeObj) === null || _a === void 0 ? void 0 : _a.destroy();
            this._nativeObj = null;
        }
    }

    class NativeSpineFactory {
        constructor() {
            this._nativeFactory = new conchNativeSpineFactory();
        }
        createSpineTempletParser() {
            return new NativeSpineTempletParser();
        }
        createSpineRenderDataHandle() {
            return new NativeSpineRenderDataHandle();
        }
        createSpineRender2D(owner) {
            const handle = owner._getRenderHandle();
            const struct = owner._struct;
            const nativeRender = this._nativeFactory.createSpineRender2D(handle._nativeObj, struct._nativeObj);
            return new NativeSpineOptimizeRender2D(owner, nativeRender);
        }
        createSpineRender3D(owner) {
            const nativeRender = this._nativeFactory.createSpineRender3D(owner._nativeObj);
            return new NativeSpineOptimizeRender3D(owner, nativeRender);
        }
    }

    class SpineInstanceBatch {
        constructor() {
            this._recoverList = new Laya.FastSinglelist();
        }
        batch(list, start, end, allowReorder) {
            if (start > end) {
                return;
            }
            let elementArray = list.elements;
            let length = end - start + 1;
            if (length === 1) {
                list.add(elementArray[start]);
                return;
            }
            let batchStart = start;
            for (let i = start; i < end; i++) {
                let cElement = elementArray[i];
                let nElement = elementArray[i + 1];
                if (!this.check(cElement, nElement)) {
                    if (i > batchStart) {
                        this._batchInternal(list, batchStart, i - batchStart + 1);
                    }
                    else {
                        list.add(elementArray[batchStart]);
                    }
                    batchStart = i + 1;
                }
            }
            if (batchStart <= end) {
                if (end > batchStart) {
                    this._batchInternal(list, batchStart, end - batchStart + 1);
                }
                else {
                    list.add(elementArray[batchStart]);
                }
            }
        }
        reset() {
            this.recover();
        }
        destroy() {
            this.recover();
            this._recoverList.length = 0;
        }
        check(left, right) {
            if (left.materialShaderData !== right.materialShaderData) {
                return false;
            }
            if (left.geometry.instanceCount || right.geometry.instanceCount) {
                return false;
            }
            return true;
        }
        batchRenderElement(list, start, length, elementCount = 1) {
            let elementArray = list.elements;
            let batchStart = -1;
            for (let i = 0; i < length - 1; i++) {
                let index = start + i;
                let cElement = elementArray[index];
                let nElement = elementArray[index + 1];
                if (this.check(cElement, nElement)) {
                    if (batchStart == -1) {
                        batchStart = i;
                    }
                }
                else {
                    if (batchStart != -1) {
                        this._batchInternal(list, batchStart + start, i - batchStart);
                    }
                    else {
                        list.add(elementArray[start + i]);
                    }
                    batchStart = -1;
                }
            }
            if (batchStart != -1) {
                this._batchInternal(list, batchStart + start, length - batchStart);
            }
            else if (length > 0) {
                list.add(elementArray[start + length - 1]);
            }
        }
        updateBuffer(info, nMatrixData, simpleAnimatorData, instanceCount) {
            let nMatrixInstanceVB = info.nMatrixInstanceVB;
            let simpleAnimatorVB = info.simpleAnimatorVB;
            nMatrixInstanceVB.setData(nMatrixData.buffer, 0, 0, instanceCount * 6 * 4);
            simpleAnimatorVB.setData(simpleAnimatorData.buffer, 0, 0, instanceCount * 4 * 4);
        }
        _batchInternal(list, start, length) {
            let instanceElement, geometry;
            let elementArray = list.elements;
            let nMatrixData = SpineInstanceElement2DTool._instanceBufferCreate(6 * SpineInstanceElement2DTool.MaxInstanceCount);
            let simpleAnimatorData = SpineInstanceElement2DTool._instanceBufferCreate(4 * SpineInstanceElement2DTool.MaxInstanceCount);
            let info;
            let currentGeometry = null;
            let instanceCount = 0;
            for (let i = 0; i < length; i++) {
                let element = elementArray[start + i];
                let shaderData = element.value2DShaderData;
                let originGeo = element.geometry;
                if (!instanceElement || currentGeometry !== originGeo) {
                    if (instanceElement && instanceCount > 0) {
                        this.updateBuffer(info, nMatrixData, simpleAnimatorData, instanceCount);
                        geometry.instanceCount = instanceCount;
                        list.add(instanceElement);
                        instanceElement = null;
                        instanceCount = 0;
                    }
                    info = SpineInstanceElement2DTool.getInstanceInfo();
                    instanceElement = info.element;
                    this._recoverList.add(info);
                    geometry = instanceElement.geometry;
                    currentGeometry = originGeo;
                    let oriBufferState = originGeo.bufferState;
                    let vertexArray = oriBufferState._vertexBuffers.slice();
                    vertexArray.push(info.nMatrixInstanceVB);
                    vertexArray.push(info.simpleAnimatorVB);
                    info.state.applyState(vertexArray, oriBufferState._bindedIndexBuffer);
                    geometry.bufferState = info.state;
                    geometry.drawParams.elements = originGeo.drawParams.elements.slice();
                    geometry.drawParams.length = originGeo.drawParams.length;
                    geometry.indexFormat = originGeo.indexFormat;
                    instanceElement.subShader = element.subShader;
                    instanceElement.materialShaderData = element.materialShaderData;
                    instanceElement.value2DShaderData = element.value2DShaderData;
                    instanceElement.renderStateIsBySprite = element.renderStateIsBySprite;
                    instanceElement.nodeCommonMap = element.nodeCommonMap;
                    instanceElement.value2DShaderData.addDefine(SpineShaderInit.SPINE_GPU_INSTANCE);
                }
                let nMatrix_0 = shaderData.getVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_0);
                let nMatrix_1 = shaderData.getVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_1);
                let nMatrixOffset = instanceCount * 6;
                nMatrixData[nMatrixOffset] = nMatrix_0.x;
                nMatrixData[nMatrixOffset + 1] = nMatrix_0.y;
                nMatrixData[nMatrixOffset + 2] = nMatrix_0.z;
                nMatrixData[nMatrixOffset + 3] = nMatrix_1.x;
                nMatrixData[nMatrixOffset + 4] = nMatrix_1.y;
                nMatrixData[nMatrixOffset + 5] = nMatrix_1.z;
                let simpleAnimatorParams = shaderData.getVector(SpineShaderInit.SIMPLE_SIMPLEANIMATORPARAMS);
                let offset = instanceCount * 4;
                simpleAnimatorData[offset] = simpleAnimatorParams.x;
                simpleAnimatorData[offset + 1] = simpleAnimatorParams.y;
                simpleAnimatorData[offset + 2] = simpleAnimatorParams.z;
                simpleAnimatorData[offset + 3] = simpleAnimatorParams.w;
                instanceCount++;
                geometry.instanceCount = instanceCount;
                if (geometry.instanceCount == SpineInstanceElement2DTool.MaxInstanceCount) {
                    this.updateBuffer(info, nMatrixData, simpleAnimatorData, geometry.instanceCount);
                    list.add(instanceElement);
                    instanceElement = null;
                    currentGeometry = null;
                    instanceCount = 0;
                }
            }
            if (instanceElement && instanceCount > 0) {
                this.updateBuffer(info, nMatrixData, simpleAnimatorData, instanceCount);
                geometry.instanceCount = instanceCount;
                list.add(instanceElement);
            }
            SpineInstanceElement2DTool._instanceBufferRecover(nMatrixData);
            SpineInstanceElement2DTool._instanceBufferRecover(simpleAnimatorData);
        }
        recover() {
            let length = this._recoverList.length;
            let recoverArray = this._recoverList.elements;
            for (let i = 0; i < length; i++) {
                let info = recoverArray[i];
                SpineInstanceElement2DTool.recover(info);
            }
            this._recoverList.length = 0;
        }
    }
    class SpineInstanceElement2DTool {
        static getInstanceInfo() {
            let info = SpineInstanceElement2DTool._instanceInfoPool.pop() || SpineInstanceElement2DTool.createInstanceInfo();
            return info;
        }
        static createInstanceInfo() {
            let element = Laya.LayaGL.render2DRenderPassFactory.createRenderElement2D();
            element.geometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElementInstance);
            let state = Laya.LayaGL.renderDeviceFactory.createBufferState();
            let nMatrixInstanceVB = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
            nMatrixInstanceVB.setDataLength(SpineInstanceElement2DTool.MaxInstanceCount * 6 * 4);
            nMatrixInstanceVB.vertexDeclaration = SpineShaderInit.instanceNMatrixDeclaration;
            nMatrixInstanceVB.instanceBuffer = true;
            let simpleAnimatorVB = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
            simpleAnimatorVB.setDataLength(SpineInstanceElement2DTool.MaxInstanceCount * 4 * 4);
            simpleAnimatorVB.vertexDeclaration = SpineShaderInit.instanceSimpleAnimatorDeclaration;
            simpleAnimatorVB.instanceBuffer = true;
            let info = {
                state,
                element,
                nMatrixInstanceVB,
                simpleAnimatorVB
            };
            return info;
        }
        static recover(info) {
            let element = info.element;
            if (element.value2DShaderData) {
                element.value2DShaderData.removeDefine(SpineShaderInit.SPINE_GPU_INSTANCE);
            }
            element.value2DShaderData = null;
            element.materialShaderData = null;
            element.subShader = null;
            element.nodeCommonMap = null;
            element.geometry.bufferState = null;
            element.geometry.drawParams.elements = [];
            element.geometry.drawParams.length = 0;
            SpineInstanceElement2DTool._instanceInfoPool.push(info);
        }
        static _instanceBufferCreate(length) {
            let array = SpineInstanceElement2DTool._bufferPool[length];
            if (!array) {
                array = SpineInstanceElement2DTool._bufferPool[length] = [];
            }
            let element = array.pop() || new Float32Array(length);
            return element;
        }
        static _instanceBufferRecover(float32) {
            let length = float32.length;
            let array = SpineInstanceElement2DTool._bufferPool[length];
            if (!array) {
                array = SpineInstanceElement2DTool._bufferPool[length] = [];
            }
            array.push(float32);
        }
    }
    SpineInstanceElement2DTool.MaxInstanceCount = 2048;
    SpineInstanceElement2DTool._instanceInfoPool = [];
    SpineInstanceElement2DTool._bufferPool = [];

    class SpineWholeBuffer {
        static _growGlobalArraysIfNeeded(requiredVertexFloats, requiredIndexCount) {
            if (requiredVertexFloats > SpineWholeBuffer._globalTempVertexData.length) {
                const newSize = Math.ceil(requiredVertexFloats / SpineWholeBuffer.ARRAY_GROWTH_STEP_VERTEX) * SpineWholeBuffer.ARRAY_GROWTH_STEP_VERTEX;
                SpineWholeBuffer._globalTempVertexData = new Float32Array(newSize);
            }
            if (requiredIndexCount > SpineWholeBuffer._globalTempIndexData.length) {
                const newSize = Math.ceil(requiredIndexCount / SpineWholeBuffer.ARRAY_GROWTH_STEP_INDEX) * SpineWholeBuffer.ARRAY_GROWTH_STEP_INDEX;
                SpineWholeBuffer._globalTempIndexData = new Uint16Array(newSize);
            }
        }
        constructor(vertexBuffer, indexBuffer) {
            this.currentVertexCount = 0;
            this._vertexCapacity = 0;
            this._indexCapacity = 0;
            this._vertexFloatCount = 0;
            this._indexCount = 0;
            this._needResetData = false;
            this._inPass = false;
            this._num = 0;
            this.vertexBuffer = vertexBuffer;
            this.indexBuffer = indexBuffer;
        }
        resetCapacity(vertexFloats, indexCount) {
            if (vertexFloats > this._vertexCapacity) {
                this._vertexCapacity = vertexFloats;
                this.vertexBuffer.setDataLength(vertexFloats * 4);
            }
            const alignedIndexCount = Math.ceil(indexCount / 2) * 2;
            if (alignedIndexCount > this._indexCapacity) {
                this._indexCapacity = alignedIndexCount;
                this.indexBuffer._setIndexDataLength(alignedIndexCount * 2);
            }
            this._needResetData = true;
        }
        _ensureCapacityForViews() {
            SpineWholeBuffer._growGlobalArraysIfNeeded(this._vertexFloatCount, this._indexCount);
            if (this._vertexFloatCount > this._vertexCapacity || this._indexCount > this._indexCapacity) {
                const vertexCapacity = this._vertexFloatCount > this._vertexCapacity
                    ? Math.max(this._vertexFloatCount, this._vertexCapacity * 2)
                    : this._vertexCapacity;
                const indexCapacity = this._indexCount > this._indexCapacity
                    ? Math.max(this._indexCount, this._indexCapacity * 2)
                    : this._indexCapacity;
                this.resetCapacity(vertexCapacity, indexCapacity);
            }
        }
        addDataView(view) {
            view._next = null;
            view._prev = null;
            if (!this._first) {
                this._first = view;
            }
            if (this._last) {
                this._last._next = view;
                view._prev = this._last;
            }
            view.owner = this;
            this._last = view;
            this._num++;
            this.currentVertexCount += view.vertexCount;
            this._vertexFloatCount += view.vertexBufferLength;
            this._indexCount += view.indexBufferLength;
            this._needResetData = true;
            Laya.WebRender2DPass.setBuffer(this);
        }
        removeDataView(view) {
            view.owner = null;
            if (view._prev) {
                view._prev._next = view._next;
            }
            if (view._next) {
                view._next._prev = view._prev;
            }
            if (view == this._first) {
                this._first = view._next;
            }
            if (view == this._last) {
                this._last = view._prev;
            }
            view._next = null;
            view._prev = null;
            this._num--;
            this.currentVertexCount -= view.vertexCount;
            this._vertexFloatCount -= view.vertexBufferLength;
            this._indexCount -= view.indexBufferLength;
            this._needResetData = true;
            Laya.WebRender2DPass.setBuffer(this);
        }
        clearDataViews() {
            let view = this._first;
            while (view) {
                const next = view._next;
                view.owner = null;
                view._prev = null;
                view._next = null;
                view = next;
            }
            this._first = null;
            this._last = null;
            this._num = 0;
            this.currentVertexCount = 0;
            this._vertexFloatCount = 0;
            this._indexCount = 0;
            this._needResetData = true;
            Laya.WebRender2DPass.setBuffer(this);
        }
        canFit(vertexCount) {
            return this.currentVertexCount + vertexCount <= SpineWholeBuffer.MAX_VERTICES;
        }
        _modifyOneView(_view) {
            this._needResetData = true;
        }
        _upload() {
            if (!this._needResetData)
                return;
            if (!this._first)
                return;
            const totalVertexFloats = this._vertexFloatCount;
            const totalIndices = this._indexCount;
            if (totalVertexFloats === 0 || totalIndices === 0) {
                this._needResetData = false;
                return;
            }
            this._ensureCapacityForViews();
            const vertexData = SpineWholeBuffer._globalTempVertexData;
            const indexData = SpineWholeBuffer._globalTempIndexData;
            let vertexOffset = 0;
            let indexOffset = 0;
            let currentVertexIndex = 0;
            let view = this._first;
            while (view) {
                if (view.vertexBufferLength > 0) {
                    let sourceIndex = view.cacheIndex || view.indexData;
                    vertexData.set(view.getUploadVertexData(), vertexOffset);
                    for (let i = 0; i < view.indexCount; i++) {
                        indexData[indexOffset + i] = sourceIndex[i] + currentVertexIndex;
                    }
                    if (view.geometry) {
                        view.geometry.clearRenderParams();
                        view.geometry.bufferState = this.bufferState;
                        view.geometry.setDrawElemenParams(view.indexCount, indexOffset * 2);
                    }
                    vertexOffset += view.vertexBufferLength;
                    indexOffset += view.indexBufferLength;
                    currentVertexIndex += view.vertexCount;
                }
                view = view._next;
            }
            this.vertexBuffer.setData(SpineWholeBuffer._globalTempVertexData.buffer, 0, 0, totalVertexFloats * 4);
            const alignedIndexCount = Math.ceil(totalIndices / 2) * 2;
            if (alignedIndexCount !== totalIndices) {
                SpineWholeBuffer._globalTempIndexData[totalIndices] = 0;
            }
            this.indexBuffer.setData(SpineWholeBuffer._globalTempIndexData.buffer, 0, 0, alignedIndexCount * 2);
            this._needResetData = false;
        }
        destroy() {
            var _a, _b;
            this._first = null;
            this._last = null;
            (_a = this.vertexBuffer) === null || _a === void 0 ? void 0 : _a.destroy();
            (_b = this.indexBuffer) === null || _b === void 0 ? void 0 : _b.destroy();
            this.vertexBuffer = null;
            this.indexBuffer = null;
        }
    }
    SpineWholeBuffer.MAX_VERTICES = 65535;
    SpineWholeBuffer.ARRAY_GROWTH_STEP_VERTEX = SpineConst.NORMAL_VERTEX_LENGTH * SpineConst.VERTEX_TWOCOLOR;
    SpineWholeBuffer.ARRAY_GROWTH_STEP_INDEX = SpineConst.NORMAL_VERTEX_LENGTH * 3;
    SpineWholeBuffer._globalTempVertexData = new Float32Array(SpineWholeBuffer.ARRAY_GROWTH_STEP_VERTEX);
    SpineWholeBuffer._globalTempIndexData = new Uint16Array(SpineWholeBuffer.ARRAY_GROWTH_STEP_INDEX);

    class SpineBatchContext {
        constructor() {
            this.element = null;
            this.materialShaderData = null;
            this.ownerStruct = null;
            this.subShader = null;
            this.stencilClipState = null;
        }
        setHead(element) {
            this.element = element;
            this.ownerStruct = element.owner;
            this.materialShaderData = element.materialShaderData;
            this.subShader = element.subShader;
            this.stencilClipState = element.stencilClipState;
            return true;
        }
        isCompatible(element) {
            if (element.subShader !== this.subShader) {
                return false;
            }
            if (element.materialShaderData !== this.materialShaderData) {
                return false;
            }
            if (element.stencilClipState !== this.stencilClipState) {
                return false;
            }
            return true;
        }
        getViewFromGeometry(element) {
            this.element = element;
            this.ownerStruct = element.owner;
            this.materialShaderData = element.materialShaderData;
            let handle = element.owner.renderDataHandler;
            let normalUpdater = handle.normalUpdater;
            return normalUpdater.getViewForGeometry(element.geometry);
        }
    }
    class SpineNormalBatch {
        constructor() {
            this._batchBufferPool = [];
            this._retiredBatchBuffers = [];
            this._activeBatchBuffers = [];
            this._activeBatchBufferCount = 0;
            this._context = new SpineBatchContext();
            this._merged = [];
            this._mergedCount = 0;
        }
        batch(list, start, end, _allowReorder) {
            if (start > end) {
                return;
            }
            let elementArray = list.elements;
            let ctx = this._context;
            let firstElement = elementArray[start];
            if (!ctx.setHead(firstElement)) {
                list.add(firstElement);
                if (start === end)
                    return;
                start++;
                firstElement = elementArray[start];
                if (!ctx.setHead(firstElement)) {
                    list.add(firstElement);
                    return;
                }
            }
            let batchStart = start;
            let batchEnd = start;
            let view = ctx.getViewFromGeometry(firstElement);
            if (!view) {
                list.add(firstElement);
                if (start === end)
                    return;
                start++;
                firstElement = elementArray[start];
                if (!ctx.setHead(firstElement)) {
                    list.add(firstElement);
                    return;
                }
                view = ctx.getViewFromGeometry(firstElement);
                if (!view) {
                    list.add(firstElement);
                    return;
                }
            }
            let currentVertexCount = view.vertexCount;
            for (let i = start + 1; i <= end; i++) {
                let element = elementArray[i];
                if (ctx.isCompatible(element)) {
                    let view = ctx.getViewFromGeometry(element);
                    if (!view)
                        continue;
                    let viewVertexCount = view.vertexCount;
                    if (currentVertexCount + viewVertexCount <= SpineNormalBatch.MAX_VERTICES_PER_BATCH) {
                        batchEnd = i;
                        currentVertexCount += viewVertexCount;
                        continue;
                    }
                    else {
                        if (batchEnd > batchStart) {
                            this._createBatchedElement(list, elementArray, batchStart, batchEnd);
                        }
                        else {
                            list.add(elementArray[batchStart]);
                        }
                        batchStart = i;
                        batchEnd = i;
                        currentVertexCount = viewVertexCount;
                        continue;
                    }
                }
                if (batchEnd > batchStart) {
                    this._createBatchedElement(list, elementArray, batchStart, batchEnd);
                }
                else if (batchStart >= 0) {
                    list.add(elementArray[batchStart]);
                }
                if (ctx.setHead(element)) {
                    let view = ctx.getViewFromGeometry(element);
                    batchStart = i;
                    batchEnd = i;
                    currentVertexCount = view ? view.vertexCount : 0;
                }
                else {
                    list.add(element);
                    batchStart = -1;
                    currentVertexCount = 0;
                }
            }
            if (batchStart >= 0) {
                if (batchEnd > batchStart) {
                    this._createBatchedElement(list, elementArray, batchStart, batchEnd);
                }
                else {
                    list.add(elementArray[batchStart]);
                }
            }
        }
        _createBatchedElement(list, elementArray, batchStart, batchEnd) {
            let batchBuffer = this._getBatchBuffer();
            let totalVertexFloats = 0;
            let totalIndices = 0;
            for (let i = batchStart; i <= batchEnd; i++) {
                let element = elementArray[i];
                let handle = element.owner.renderDataHandler;
                let normalUpdater = handle.normalUpdater;
                let view = normalUpdater.getViewForGeometry(element.geometry);
                if (view) {
                    totalVertexFloats += view.vertexBufferLength;
                    totalIndices += view.indexBufferLength;
                }
            }
            batchBuffer.wholeBuffer.resetCapacity(totalVertexFloats, totalIndices);
            for (let i = batchStart; i <= batchEnd; i++) {
                let element = elementArray[i];
                let handle = element.owner.renderDataHandler;
                let normalUpdater = handle.normalUpdater;
                let view = normalUpdater.getViewForGeometry(element.geometry);
                if (!view)
                    continue;
                view.transferToBuffer(batchBuffer.wholeBuffer);
            }
            let firstElement = elementArray[batchStart];
            let batchElement = SpineNormalBatch._pool.take();
            this._merged[this._mergedCount++] = batchElement;
            let geometry = batchElement.geometry;
            geometry.bufferState = batchBuffer.bufferState;
            geometry.setDrawElemenParams(totalIndices, 0);
            geometry.indexFormat = firstElement.geometry.indexFormat;
            batchElement.subShader = firstElement.subShader;
            batchElement.materialShaderData = firstElement.materialShaderData;
            batchElement.value2DShaderData = firstElement.value2DShaderData;
            batchElement.renderStateIsBySprite = firstElement.renderStateIsBySprite;
            batchElement.nodeCommonMap = firstElement.nodeCommonMap;
            list.add(batchElement);
        }
        _getBatchBuffer() {
            let batchBuffer = this._batchBufferPool.pop();
            if (!batchBuffer) {
                let vertexBuffer = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
                vertexBuffer.vertexDeclaration = SpineShaderInit.SpineNormalVertexDeclaration;
                let indexBuffer = Laya.LayaGL.renderDeviceFactory.createIndexBuffer(Laya.BufferUsage.Dynamic);
                let wholeBuffer = new SpineWholeBuffer(vertexBuffer, indexBuffer);
                wholeBuffer.resetCapacity(4096 * SpineConst.VERTEX_TWOCOLOR, 4096 * 3);
                let bufferState = Laya.LayaGL.renderDeviceFactory.createBufferState();
                bufferState.applyState([vertexBuffer], indexBuffer);
                wholeBuffer.bufferState = bufferState;
                batchBuffer = {
                    wholeBuffer,
                    bufferState
                };
            }
            this._activeBatchBuffers[this._activeBatchBufferCount++] = batchBuffer;
            return batchBuffer;
        }
        reset() {
            let retainedCount = 0;
            for (let i = 0; i < this._retiredBatchBuffers.length; i++) {
                let batchBuffer = this._retiredBatchBuffers[i];
                if (batchBuffer.wholeBuffer._first) {
                    this._retiredBatchBuffers[retainedCount++] = batchBuffer;
                }
                else {
                    this._batchBufferPool.push(batchBuffer);
                }
            }
            this._retiredBatchBuffers.length = retainedCount;
            for (let i = 0; i < this._activeBatchBufferCount; i++) {
                this._retiredBatchBuffers.push(this._activeBatchBuffers[i]);
            }
            this._activeBatchBufferCount = 0;
            for (let i = 0; i < this._mergedCount; i++) {
                SpineNormalBatch._pool.recover(this._merged[i]);
            }
            this._mergedCount = 0;
        }
        destroy() {
            for (let batchBuffer of this._batchBufferPool) {
                batchBuffer.wholeBuffer.destroy();
                batchBuffer.bufferState.destroy();
            }
            for (let i = 0; i < this._activeBatchBufferCount; i++) {
                let batchBuffer = this._activeBatchBuffers[i];
                batchBuffer.wholeBuffer.destroy();
                batchBuffer.bufferState.destroy();
            }
            for (let batchBuffer of this._retiredBatchBuffers) {
                batchBuffer.wholeBuffer.destroy();
                batchBuffer.bufferState.destroy();
            }
            this._batchBufferPool = [];
            this._activeBatchBuffers = [];
            this._retiredBatchBuffers = [];
            for (let i = 0; i < this._mergedCount; i++) {
                SpineNormalBatch._pool.recover(this._merged[i]);
            }
            this._merged.length = 0;
            this._mergedCount = 0;
        }
    }
    SpineNormalBatch.MAX_VERTICES_PER_BATCH = 65535;
    SpineNormalBatch._pool = Laya.Pool.createPool2(() => {
        let element = Laya.LayaGL.render2DRenderPassFactory.createRenderElement2D();
        element.geometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElement);
        element.geometry.indexFormat = Laya.IndexFormat.UInt16;
        element.nodeCommonMap = ["Sprite2D"];
        return element;
    }, null, element => {
        element.geometry.clearRenderParams();
        element.geometry.bufferState = null;
        element.materialShaderData = null;
        element.value2DShaderData = null;
        element.subShader = null;
        element.owner = null;
    });

    const QUAD_TRIANGLES$2 = [0, 1, 2, 2, 3, 0];
    class SpineNormalRenderUpdater {
        constructor() {
            this.clipper = new spine.SkeletonClipping();
            this.batches = [];
            this._currentBatchIndex = -1;
            this._internalMaterials = [];
            this.materials = [];
            this._materialIndex = 0;
            this.needUpdate = false;
            this.subMeshes = [];
            this.autoCacheEnabled = false;
        }
        static __init__() {
            SpineNormalRenderUpdater.positions = new Float32Array(SpineConst.NORMAL_MAX_VERTEX * 2);
            SpineNormalRenderUpdater._TEMP_COLOR = new spine.Color();
            SpineNormalRenderUpdater._TEMP_COLOR2 = new spine.Color();
        }
        restoreFromCache(cache, offsetX = 0, offsetY = 0) {
            if (!cache)
                return;
            const blockCount = cache.renderBlocks.length;
            if (this.batches.length < blockCount) {
                for (let i = this.batches.length; i < blockCount; i++) {
                    const vertexDeclaration = SpineShaderInit.SpineNormalVertexDeclaration;
                    const vertexBuffer = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
                    vertexBuffer.vertexDeclaration = vertexDeclaration;
                    const indexBuffer = Laya.LayaGL.renderDeviceFactory.createIndexBuffer(Laya.BufferUsage.Dynamic);
                    const bufferState = Laya.LayaGL.renderDeviceFactory.createBufferState();
                    bufferState.applyState([vertexBuffer], indexBuffer);
                    const buffer = {
                        vertexData: new Float32Array(SpineConst.VERTEX_INITIAL_CAPACITY * SpineConst.VERTEX_TWOCOLOR),
                        indexData: new Uint16Array(SpineConst.VERTEX_INITIAL_CAPACITY * 3),
                        vertexLength: 0,
                        indexLength: 0,
                        bufferState: bufferState,
                        cacheVertex: null,
                        cacheIndex: null,
                        offsetX: 0,
                        offsetY: 0
                    };
                    const geometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElement);
                    geometry.indexFormat = Laya.IndexFormat.UInt16;
                    geometry.bufferState = bufferState;
                    const materialIndex = i < cache.materials.length ? i : cache.materials.length - 1;
                    const material = cache.materials[materialIndex] || null;
                    this.batches[i] = {
                        geometry: geometry,
                        buffer: buffer,
                        material: material,
                        materialIndex: materialIndex
                    };
                }
            }
            for (let i = 0; i < blockCount; i++) {
                const block = cache.renderBlocks[i];
                const batch = this.batches[i];
                const subMeshBuffer = batch.buffer;
                const geometry = batch.geometry;
                subMeshBuffer.cacheVertex = block.vertexData;
                subMeshBuffer.vertexLength = block.vertexLength;
                subMeshBuffer.offsetX = offsetX;
                subMeshBuffer.offsetY = offsetY;
                subMeshBuffer.cacheIndex = block.indexData;
                subMeshBuffer.indexLength = block.indexLength;
                this.uploadBuffer(subMeshBuffer, true);
                geometry.clearRenderParams();
                geometry.setDrawElemenParams(block.indexLength, 0);
                if (i < cache.materials.length) {
                    batch.material = cache.materials[i];
                    batch.materialIndex = i;
                }
            }
            this._currentBatchIndex = blockCount - 1;
            this._syncRenderBatches(blockCount);
            this._materialIndex = blockCount;
            this.needUpdate = true;
        }
        getCurrentBatch() {
            let batch = this.batches[this._currentBatchIndex];
            if (!batch) {
                const vertexDeclaration = SpineShaderInit.SpineNormalVertexDeclaration;
                const vertexBuffer = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
                vertexBuffer.vertexDeclaration = vertexDeclaration;
                const indexBuffer = Laya.LayaGL.renderDeviceFactory.createIndexBuffer(Laya.BufferUsage.Dynamic);
                const bufferState = Laya.LayaGL.renderDeviceFactory.createBufferState();
                bufferState.applyState([vertexBuffer], indexBuffer);
                const buffer = {
                    vertexData: new Float32Array(SpineConst.NORMAL_VERTEX_LENGTH * SpineConst.VERTEX_TWOCOLOR),
                    indexData: new Uint16Array(SpineConst.NORMAL_VERTEX_LENGTH * 3),
                    vertexLength: 0,
                    indexLength: 0,
                    bufferState: bufferState,
                    cacheVertex: null,
                    cacheIndex: null,
                    offsetX: 0,
                    offsetY: 0
                };
                const geometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElement);
                geometry.indexFormat = Laya.IndexFormat.UInt16;
                geometry.bufferState = bufferState;
                const materialIndex = this._materialIndex - 1;
                const material = materialIndex >= 0 ? this._internalMaterials[materialIndex] : null;
                batch = {
                    geometry: geometry,
                    buffer: buffer,
                    material: material,
                    materialIndex: materialIndex
                };
                this.batches[this._currentBatchIndex] = batch;
            }
            return batch;
        }
        _syncRenderBatches(batchCount) {
            this.subMeshes.length = 0;
            this.materials.length = 0;
            for (let i = 0; i < batchCount; i++) {
                const batch = this.batches[i];
                if (!batch || !batch.material || batch.buffer.vertexLength === 0 || batch.buffer.indexLength === 0)
                    continue;
                this.subMeshes.push(batch.geometry);
                this.materials.push(batch.material);
            }
        }
        getCurrentSubMeshBuffer() {
            return this.getCurrentBatch().buffer;
        }
        ensureVerticesCapacity(buffer, requiredLength) {
            if (requiredLength > buffer.vertexData.length) {
                const newLength = Math.max(requiredLength, buffer.vertexData.length * 2);
                const newVertices = new Float32Array(newLength);
                newVertices.set(buffer.vertexData);
                buffer.vertexData = newVertices;
            }
        }
        ensureIndicesCapacity(buffer, requiredLength) {
            if (requiredLength > buffer.indexData.length) {
                const newLength = Math.max(requiredLength, buffer.indexData.length * 2);
                const newIndices = new Uint16Array(newLength);
                newIndices.set(buffer.indexData);
                buffer.indexData = newIndices;
            }
        }
        renderUpdate(time, skeleton, updater, slotRangeStart, slotRangeEnd, offsetX = 0, offsetY = 0) {
            let clipper = this.clipper;
            let twoColorTint = true;
            let blendMode = null;
            let uvs;
            let triangles;
            let drawOrder = skeleton.drawOrder;
            let attachmentColor;
            let skeletonColor = skeleton.color;
            let vertexStride = SpineConst.VERTEX_TWOCOLOR;
            let inRange = false;
            if (slotRangeStart == -1)
                inRange = true;
            let spineTex;
            let positions = SpineNormalRenderUpdater.positions;
            let _TEMP_COLOR = SpineNormalRenderUpdater._TEMP_COLOR;
            let _TEMP_COLOR2 = SpineNormalRenderUpdater._TEMP_COLOR2;
            this._materialIndex = 0;
            this._currentBatchIndex = -1;
            const startNewBatch = () => {
                if (this._currentBatchIndex >= 0) {
                    const currentBatch = this.batches[this._currentBatchIndex];
                    if (currentBatch && currentBatch.buffer.vertexLength > 0) {
                        currentBatch.geometry.clearRenderParams();
                        currentBatch.geometry.setDrawElemenParams(currentBatch.buffer.indexLength, 0);
                        this.uploadBuffer(currentBatch.buffer);
                    }
                }
                this._currentBatchIndex++;
                const batch = this.getCurrentBatch();
                batch.buffer.vertexLength = 0;
                batch.buffer.indexLength = 0;
                batch.buffer.cacheVertex = null;
                batch.buffer.cacheIndex = null;
                batch.buffer.offsetX = offsetX;
                batch.buffer.offsetY = offsetY;
                const materialIndex = this._materialIndex - 1;
                batch.material = materialIndex >= 0 ? this._internalMaterials[materialIndex] : null;
                batch.materialIndex = materialIndex;
            };
            for (let i = 0, n = drawOrder.length; i < n; i++) {
                let clippedVertexStride = clipper.isClipping() ? 2 : vertexStride;
                let slot = drawOrder[i];
                let boneOrSlot = SpineConst.NEED_SLOT ? slot : slot.bone;
                if (!slot.bone.active) {
                    clipper.clipEndWithSlot(slot);
                    continue;
                }
                if (slotRangeStart >= 0 && slotRangeStart == slot.data.index) {
                    inRange = true;
                }
                if (!inRange) {
                    clipper.clipEndWithSlot(slot);
                    continue;
                }
                if (slotRangeEnd >= 0 && slotRangeEnd == slot.data.index) {
                    inRange = false;
                }
                let attachment = slot.getAttachment();
                let texture;
                let verticesLength = 0;
                if (attachment instanceof window.spine.RegionAttachment) {
                    let region = attachment;
                    verticesLength = clippedVertexStride << 2;
                    if (attachment.sequence != null)
                        attachment.sequence.apply(slot, attachment);
                    region.computeWorldVertices(boneOrSlot, positions, 0, clippedVertexStride);
                    triangles = QUAD_TRIANGLES$2;
                    uvs = region.uvs;
                    texture = region.region.page.texture;
                    attachmentColor = region.color;
                }
                else if (attachment instanceof window.spine.MeshAttachment) {
                    let mesh = attachment;
                    verticesLength = (mesh.worldVerticesLength >> 1) * clippedVertexStride;
                    if (verticesLength > positions.length) {
                        positions = new Float32Array(verticesLength);
                        SpineNormalRenderUpdater.positions = positions;
                    }
                    mesh.computeWorldVertices(slot, 0, mesh.worldVerticesLength, positions, 0, clippedVertexStride);
                    triangles = mesh.triangles;
                    texture = mesh.region.page.texture;
                    uvs = mesh.uvs;
                    attachmentColor = mesh.color;
                }
                else if (attachment instanceof window.spine.ClippingAttachment) {
                    this.clipper.clipStart(slot, attachment);
                    continue;
                }
                else {
                    clipper.clipEndWithSlot(slot);
                    continue;
                }
                if (texture) {
                    let slotColor = slot.color;
                    let finalColor = _TEMP_COLOR;
                    finalColor.r = skeletonColor.r * slotColor.r * attachmentColor.r;
                    finalColor.g = skeletonColor.g * slotColor.g * attachmentColor.g;
                    finalColor.b = skeletonColor.b * slotColor.b * attachmentColor.b;
                    finalColor.a = skeletonColor.a * slotColor.a * attachmentColor.a;
                    let darkColor = _TEMP_COLOR2;
                    if (!slot.darkColor)
                        darkColor.set(0, 0, 0, 1.0);
                    else {
                        darkColor.setFromColor(slot.darkColor);
                    }
                    let slotBlendMode = slot.data.blendMode;
                    let needNewMat = false;
                    if (slotBlendMode != blendMode) {
                        blendMode = slotBlendMode;
                        needNewMat = true;
                    }
                    if (spineTex != texture) {
                        spineTex = texture;
                        needNewMat = true;
                    }
                    if (needNewMat) {
                        const needsNewBatch = this._currentBatchIndex < 0 || this.batches[this._currentBatchIndex].buffer.vertexLength > 0;
                        this.addMaterial(updater.owner._getMaterial(texture.realTexture, blendMode));
                        if (needsNewBatch) {
                            startNewBatch();
                        }
                        else {
                            const currentBatch = this.batches[this._currentBatchIndex];
                            currentBatch.material = this._internalMaterials[this._materialIndex - 1];
                            currentBatch.materialIndex = this._materialIndex - 1;
                        }
                    }
                    if (clipper.isClipping()) {
                        clipper.clipTriangles(positions, verticesLength, triangles, triangles.length, uvs, finalColor, darkColor, twoColorTint);
                        if (!this.canAppend(clipper.clippedVertices.length)) {
                            startNewBatch();
                        }
                        this.appendVerticesClip(clipper.clippedVertices, clipper.clippedTriangles, vertexStride, offsetX, offsetY);
                    }
                    else {
                        if (!this.canAppend(verticesLength)) {
                            startNewBatch();
                        }
                        if (finalColor.a != 0) {
                            this.appendVertices(positions, uvs, finalColor, darkColor, verticesLength, triangles, triangles.length, vertexStride, offsetX, offsetY);
                        }
                    }
                }
                clipper.clipEndWithSlot(slot);
            }
            clipper.clipEnd();
            if (this._currentBatchIndex >= 0) {
                const currentBatch = this.batches[this._currentBatchIndex];
                if (currentBatch.buffer.vertexLength > 0) {
                    currentBatch.geometry.clearRenderParams();
                    currentBatch.geometry.setDrawElemenParams(currentBatch.buffer.indexLength, 0);
                    this.uploadBuffer(currentBatch.buffer);
                }
            }
            const totalBatchCount = this._currentBatchIndex + 1;
            if (totalBatchCount < this.batches.length) {
                for (let i = totalBatchCount; i < this.batches.length; i++) {
                    this.destroyBatch(this.batches[i]);
                }
            }
            this.batches.length = totalBatchCount;
            this._syncRenderBatches(totalBatchCount);
            this.needUpdate = true;
            if (this.autoCacheEnabled && updater && !updater.owner._hasExternalSkin) {
                let frameIndex = updater.cacheFrameIndex;
                let cacheTarget = updater.currentData;
                if (frameIndex >= 0 && !cacheTarget.renderCache[frameIndex]) {
                    let renderBlocks = [];
                    for (let i = 0; i < totalBatchCount; i++) {
                        const batch = this.batches[i];
                        if (batch && batch.material && batch.buffer.vertexLength > 0 && batch.buffer.indexLength > 0) {
                            renderBlocks.push({
                                vertexData: batch.buffer.vertexData.slice(0, batch.buffer.vertexLength),
                                vertexLength: batch.buffer.vertexLength,
                                indexData: batch.buffer.indexData.slice(0, batch.buffer.indexLength),
                                indexLength: batch.buffer.indexLength
                            });
                        }
                    }
                    let frameCache = {
                        renderBlocks: renderBlocks,
                        materials: this.materials.slice()
                    };
                    cacheTarget.renderCache[frameIndex] = frameCache;
                }
            }
        }
        destroyBatch(batch) {
            let _vertexBuffers = batch.buffer.bufferState._vertexBuffers;
            for (let i = 0; i < _vertexBuffers.length; i++) {
                _vertexBuffers[i].destroy();
            }
            batch.buffer.bufferState._bindedIndexBuffer.destroy();
            batch.buffer.bufferState.destroy();
            batch.geometry.destroy();
        }
        addMaterial(material) {
            if (this._internalMaterials[this._materialIndex] === material) {
                this._materialIndex++;
                return;
            }
            this._internalMaterials[this._materialIndex] = material;
            this._materialIndex++;
            this.needUpdate = true;
        }
        canAppend(verticesLength) {
            if (this._currentBatchIndex < 0)
                return true;
            const currentBatch = this.batches[this._currentBatchIndex];
            if (!currentBatch)
                return true;
            const currentBuffer = currentBatch.buffer;
            const currentVertexCount = currentBuffer.vertexLength / SpineConst.VERTEX_TWOCOLOR;
            const newVertexCount = verticesLength / SpineConst.VERTEX_TWOCOLOR;
            return (currentVertexCount + newVertexCount) < SpineNormalRenderUpdater.MAX_VERTICES_PER_BUFFER;
        }
        uploadBuffer(subMeshBuffer, useCache = false) {
            if (!subMeshBuffer || !subMeshBuffer.bufferState)
                return;
            const vbByteLength = subMeshBuffer.vertexLength * 4;
            const ibByteLength = subMeshBuffer.indexLength * 2;
            let vertexBuffer = subMeshBuffer.bufferState._vertexBuffers[0];
            vertexBuffer.setDataLength(vbByteLength);
            if (useCache && subMeshBuffer.cacheVertex) {
                vertexBuffer.setData(subMeshBuffer.cacheVertex.buffer, 0, 0, vbByteLength);
            }
            else {
                vertexBuffer.setData(subMeshBuffer.vertexData.buffer, 0, 0, vbByteLength);
            }
            let indexBuffer = subMeshBuffer.bufferState._bindedIndexBuffer;
            indexBuffer._setIndexDataLength(ibByteLength);
            if (useCache && subMeshBuffer.cacheIndex) {
                indexBuffer.setData(subMeshBuffer.cacheIndex.buffer, 0, 0, ibByteLength);
            }
            else {
                indexBuffer.setData(subMeshBuffer.indexData.buffer, 0, 0, ibByteLength);
            }
        }
        appendVerticesClip(vertices, indices, stride, offsetX, offsetY) {
            let verticesLength = vertices.length;
            if (verticesLength == 0)
                return;
            let indicesLength = indices.length;
            const currentBuffer = this.getCurrentSubMeshBuffer();
            this.ensureVerticesCapacity(currentBuffer, currentBuffer.vertexLength + verticesLength);
            this.ensureIndicesCapacity(currentBuffer, currentBuffer.indexLength + indicesLength);
            let vertexData = currentBuffer.vertexData;
            let indexData = currentBuffer.indexData;
            let before = currentBuffer.vertexLength;
            let indexStart = before / stride;
            let vlen = before;
            for (let j = 0; j < verticesLength; vlen += stride, j += stride) {
                vertexData[vlen] = vertices[j + 6];
                vertexData[vlen + 1] = vertices[j + 7];
                vertexData[vlen + 2] = vertices[j + 2];
                vertexData[vlen + 3] = vertices[j + 3];
                vertexData[vlen + 4] = vertices[j + 4];
                vertexData[vlen + 5] = vertices[j + 5];
                vertexData[vlen + 6] = vertices[j] + offsetX;
                vertexData[vlen + 7] = vertices[j + 1] + offsetY;
                vertexData[vlen + 8] = vertices[j + 8];
                vertexData[vlen + 9] = vertices[j + 9];
                vertexData[vlen + 10] = vertices[j + 10];
                vertexData[vlen + 11] = vertices[j + 11];
            }
            currentBuffer.vertexLength = before + verticesLength;
            for (let i = currentBuffer.indexLength, j = 0; j < indicesLength; i++, j++)
                indexData[i] = indices[j] + indexStart;
            currentBuffer.indexLength += indicesLength;
        }
        appendVertices(positions, uvs, finalColor, darkColor, verticesLength, indices, indicesLength, stride, offsetX, offsetY) {
            if (verticesLength == 0)
                return;
            const currentBuffer = this.getCurrentSubMeshBuffer();
            this.ensureVerticesCapacity(currentBuffer, currentBuffer.vertexLength + verticesLength);
            this.ensureIndicesCapacity(currentBuffer, currentBuffer.indexLength + indicesLength);
            let vertexData = currentBuffer.vertexData;
            let indexData = currentBuffer.indexData;
            let before = currentBuffer.vertexLength;
            let indexStart = before / stride;
            for (let u = 0, v = 0, n = verticesLength; v < n; v += stride, u += 2) {
                let size = before + v;
                vertexData[size] = uvs[u];
                vertexData[size + 1] = uvs[u + 1];
                vertexData[size + 2] = finalColor.r;
                vertexData[size + 3] = finalColor.g;
                vertexData[size + 4] = finalColor.b;
                vertexData[size + 5] = finalColor.a;
                vertexData[size + 6] = positions[v] + offsetX;
                vertexData[size + 7] = positions[v + 1] + offsetY;
                vertexData[size + 8] = darkColor.r;
                vertexData[size + 9] = darkColor.g;
                vertexData[size + 10] = darkColor.b;
                vertexData[size + 11] = darkColor.a;
            }
            for (let i = currentBuffer.indexLength, j = 0; j < indicesLength; i++, j++)
                indexData[i] = indices[j] + indexStart;
            currentBuffer.vertexLength = before + verticesLength;
            currentBuffer.indexLength += indicesLength;
        }
        exportToCache() {
            let renderBlocks = [];
            for (let i = 0; i <= this._currentBatchIndex; i++) {
                const batch = this.batches[i];
                if (batch) {
                    renderBlocks.push({
                        vertexData: new Float32Array(batch.buffer.vertexData.subarray(0, batch.buffer.vertexLength)),
                        vertexLength: batch.buffer.vertexLength,
                        indexData: new Uint16Array(batch.buffer.indexData.subarray(0, batch.buffer.indexLength)),
                        indexLength: batch.buffer.indexLength
                    });
                }
            }
            return {
                renderBlocks: renderBlocks,
                materials: this.materials.slice(0, this._materialIndex)
            };
        }
        destroy() {
            this.batches.forEach((batch) => {
                this.destroyBatch(batch);
            });
            this.subMeshes.forEach(mesh => {
                mesh.destroy();
            });
            this.subMeshes.length = 0;
            this.batches.length = 0;
        }
    }
    SpineNormalRenderUpdater.MAX_VERTICES_PER_BUFFER = 65536;

    class SpineMeshUtils {
        static createMesh(type, vbCreator, ibCreator, isDynamic = false, uploadBuffer = true) {
            let mesh = new Laya.Mesh2D;
            let vertexBuffers = [];
            let usage = isDynamic ? Laya.BufferUsage.Dynamic : Laya.BufferUsage.Static;
            let vertexBuffer = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(usage);
            let vertexDeclaration = vbCreator.vertexDeclaration;
            let vertexStride = vertexDeclaration.vertexStride;
            vertexBuffer.vertexDeclaration = vertexDeclaration;
            let vbByteLength = vbCreator.maxVertexCount * vertexStride;
            let vbUploadLength = vbCreator.vbLength * Float32Array.BYTES_PER_ELEMENT;
            vertexBuffer.setDataLength(vbByteLength);
            if (uploadBuffer) {
                vertexBuffer.setData(vbCreator.vb.buffer, 0, 0, vbUploadLength);
            }
            vertexBuffers.push(vertexBuffer);
            mesh._vertexCount = vbByteLength / vertexStride;
            mesh._vertexBuffers = vertexBuffers;
            let ibByteLength = ibCreator.maxIndexCount * ibCreator.size;
            ibCreator.ibLength;
            let indexbuffer = Laya.LayaGL.renderDeviceFactory.createIndexBuffer(usage);
            indexbuffer.indexType = ibCreator.type;
            indexbuffer.indexCount = ibCreator.maxIndexCount;
            indexbuffer._setIndexDataLength(ibByteLength);
            if (uploadBuffer) {
                indexbuffer._setIndexData(ibCreator.ib, 0);
            }
            mesh._indexBuffer = indexbuffer;
            let state = mesh._bufferState;
            state.applyState(vertexBuffers, indexbuffer);
            let subMeshes = [];
            let multi = ibCreator.outRenderData;
            for (let i = 0, len = multi.renderData.length; i < len; i++) {
                let data = multi.renderData[i];
                let geometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElement);
                geometry.bufferState = state;
                geometry.setDrawElemenParams(data.length, data.offset * ibCreator.size);
                geometry.indexFormat = ibCreator.type;
                subMeshes.push(geometry);
            }
            mesh._setSubMeshes(subMeshes);
            var memorySize = vbByteLength + ibByteLength;
            mesh._setCPUMemory(memorySize);
            mesh._setGPUMemory(memorySize);
            return mesh;
        }
        static createMeshDynamic(vertexDeclaration) {
            let mesh = new Laya.Mesh2D;
            let vertexBuffers = [];
            let usage = Laya.BufferUsage.Dynamic;
            let vertexBuffer = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(usage);
            vertexBuffer.vertexDeclaration = vertexDeclaration;
            vertexBuffer._byteLength = 0;
            vertexBuffers.push(vertexBuffer);
            mesh._vertexBuffers = vertexBuffers;
            let indexbuffer = Laya.LayaGL.renderDeviceFactory.createIndexBuffer(usage);
            mesh._indexBuffer = indexbuffer;
            indexbuffer._byteLength = 0;
            let state = mesh._bufferState;
            state.applyState(vertexBuffers, indexbuffer);
            mesh.lock = true;
            return mesh;
        }
        static _updateSpineSubMesh(mesh, frameData) {
            let subMeshCount = mesh.subMeshCount;
            let mulitRenderData = frameData.mulitRenderData;
            if (!mulitRenderData)
                return false;
            let renderdata = mulitRenderData.renderData;
            let rdLength = renderdata.length;
            let needUpdate = subMeshCount != rdLength;
            let subMeshes = mesh._subMeshes;
            if (needUpdate) {
                let flen = Math.max(rdLength, subMeshCount);
                let state = mesh._bufferState;
                for (let i = 0; i < flen; i++) {
                    let submesh = subMeshes[i];
                    let data = renderdata[i];
                    if (data) {
                        if (!submesh) {
                            submesh = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElement);
                            submesh.bufferState = state;
                            subMeshes[i] = submesh;
                        }
                        submesh.indexFormat = frameData.type;
                        submesh.clearRenderParams();
                        submesh.setDrawElemenParams(data.length, data.offset * frameData.size);
                    }
                    else {
                        submesh.destroy();
                    }
                }
                subMeshes.length = rdLength;
            }
            else {
                for (let i = 0; i < subMeshCount; i++) {
                    let submesh = subMeshes[i];
                    let data = renderdata[i];
                    submesh.indexFormat = frameData.type;
                    submesh.clearRenderParams();
                    submesh.setDrawElemenParams(data.length, data.offset * frameData.size);
                }
            }
            return needUpdate;
        }
    }

    class SpineRenderUpdater {
        getSubMeshes() {
            return this._mesh ? this._mesh._subMeshes : [];
        }
        constructor(owner) {
            this.currentMaterials = [];
            this.cacheMaterials = [];
            this.materialCacheVersion = 0;
            this.vChanges = [];
            this._animator = null;
            this.cacheFrameIndex = 0;
            this.currentFrameIndex = -1;
            this.currentData = null;
            this.state = null;
            this._skinAttach = null;
            this.needUpdate = true;
            this.owner = owner;
            this.reset();
        }
        set skinAttach(value) {
            if (this._skinAttach === value)
                return;
            this._skinAttach = value;
            this._updateData();
        }
        get skinAttach() {
            return this._skinAttach;
        }
        set animator(value) {
            if (this._animator === value)
                return;
            this._animator = value;
            this._updateData();
        }
        get animator() {
            return this._animator;
        }
        _updateData() {
            if (!this._animator || !this._skinAttach)
                return;
            this.currentData = this._animator.skinDataArray[this._skinAttach.index];
            this.updateBones = this._animator.isCache ? this.updateBoneMatrixCache : this.updateBoneMatrix;
        }
        get animationName() {
            return this.animator ? this.animator.name : this.name;
        }
        reset() {
            this.currentFrameIndex = -1;
        }
        clear() {
            this.cacheMaterials.length = 0;
            this.currentFrameIndex = -1;
            this.currentData = null;
            this.state = null;
            this._skinAttach = null;
            this._animator = null;
            this.vChanges.length = 0;
            this._updateMaterials(null);
            this._mesh = null;
        }
        renderUpdate(slots, skindata, frame, lastFrame) {
            let needUpdate = false;
            if (skindata.isDynamic) {
                needUpdate = this.updateDynamicRender(slots, skindata, frame, lastFrame);
            }
            else {
                needUpdate = this.handleRender(skindata, frame, skindata.getMesh());
            }
            this.needUpdate = this.needUpdate || needUpdate;
        }
        updateDynamicRender(slots, skindata, frame, lastFrame) {
            let mesh = this.owner.getDynamicMesh(skindata.vb.vertexDeclaration);
            let currentChanges = this.vChanges;
            let frameData = skindata.getFrameData(frame);
            let isFirst = lastFrame < 0;
            let needUpload = false;
            let indexFrameData = isFirst && !frameData.ib
                ? this._getPreviousIndexFrameData(skindata, frame)
                : frameData;
            if (isFirst) {
                this._resetVertexBuffers(slots, skindata);
                currentChanges.length = 0;
            }
            for (let f = lastFrame + 1; f <= frame; f++) {
                let frameData = skindata.getFrameData(f);
                let frameChanges = frameData.vChanges;
                if (frameChanges) {
                    for (const change of frameChanges) {
                        if (!currentChanges.includes(change)) {
                            currentChanges.push(change);
                        }
                    }
                }
            }
            for (let i = currentChanges.length - 1; i >= 0; i--) {
                let change = currentChanges[i];
                if (change.apply(frame, skindata.vb, slots)) {
                    needUpload = true;
                }
                else {
                    currentChanges.splice(i, 1);
                }
            }
            if (needUpload || isFirst) {
                this.uploadVertexBuffer(skindata.vb, mesh);
            }
            if (frameData.ib || isFirst) {
                this.uploadIndexBuffer(indexFrameData, mesh);
            }
            let needUpdate = SpineMeshUtils._updateSpineSubMesh(mesh, indexFrameData);
            needUpdate = this.handleRender(skindata, frame, mesh, indexFrameData) || needUpdate;
            return needUpdate;
        }
        _getPreviousIndexFrameData(skindata, frame) {
            for (let i = frame - 1; i >= 0; i--) {
                let previousFrameData = skindata.getFrameData(i);
                if (previousFrameData.ib) {
                    return previousFrameData;
                }
            }
            return skindata._defaultFrameData;
        }
        handleRender(skindata, frame, mesh, frameData = skindata.getFrameData(frame)) {
            let needUpdate = false;
            let mulitRenderData = frameData.mulitRenderData;
            if (mulitRenderData) {
                let mats = this.cacheMaterials[mulitRenderData.id] || this.createMaterials(mulitRenderData);
                if (this.currentMaterials !== mats) {
                    this._updateMaterials(mats);
                    needUpdate = true;
                }
            }
            if (this._mesh !== mesh) {
                this._mesh = mesh;
                needUpdate = true;
            }
            return needUpdate;
        }
        createMaterials(mulitRenderData) {
            let mats = mulitRenderData.renderData.map(data => this.owner._getMaterialByName(data.textureName, data.blendMode));
            if (this.currentMaterials) {
                for (let i = 0; i < mats.length; i++) {
                    if (this.currentMaterials[i] !== mats[i]) {
                        this.cacheMaterials[mulitRenderData.id] = mats;
                        return mats;
                    }
                }
                this.cacheMaterials[mulitRenderData.id] = this.currentMaterials;
                return this.currentMaterials;
            }
            else {
                this.cacheMaterials[mulitRenderData.id] = mats;
                return mats;
            }
        }
        getDynamicMesh(vertexDeclaration, index = 0) {
            return this.owner.getDynamicMesh(vertexDeclaration, true, index);
        }
        uploadIndexBuffer(frameData, mesh) {
            let indexData = frameData.ib;
            let indexbuffer = mesh._indexBuffer;
            indexbuffer.indexType = frameData.type;
            indexbuffer.indexCount = indexData.length;
            indexbuffer._setIndexDataLength(indexData.byteLength);
            indexbuffer._setIndexData(indexData, 0);
        }
        uploadVertexBuffer(vbCreator, mesh) {
            let vertexBuffer = mesh.vertexBuffers[0];
            let vblen = vbCreator.vbLength * 4;
            vertexBuffer.setDataLength(vbCreator.maxVertexCount * vbCreator.vertexSize * 4);
            vertexBuffer.setData(vbCreator.vb.buffer, 0, 0, vblen);
        }
        renderWithOutMat(slots, curTime) {
            let beforeFrame = this.currentFrameIndex;
            let nowFrame = this.animator.getFrameIndex(curTime, beforeFrame);
            this.renderUpdate(slots, this.currentData, nowFrame, beforeFrame);
            this.currentFrameIndex = nowFrame;
        }
        renderWithMat(bones, slots, curTime, boneMat, ofx, ofy) {
            this.renderWithOutMat(slots, curTime);
            this.updateBones(curTime, bones, boneMat, ofx, ofy);
        }
        _resetVertexBuffers(slots, skindata) {
            let map = skindata.vb.slotVBMap;
            let renderDatas = skindata.renderDatas;
            let resetSlots = new Set();
            renderDatas.forEach(data => {
                if (data && data.vChanges) {
                    for (const change of data.vChanges) {
                        resetSlots.add(change.slotId);
                    }
                }
            });
            resetSlots.forEach(slotId => {
                let slot = slots[slotId];
                if (slot) {
                    let posMap = map.get(slotId);
                    if (posMap) {
                        posMap.forEach((pos, attachment) => {
                            skindata.vb.resetVB(pos.attachment);
                        });
                    }
                }
            });
        }
        updateBoneMatrix(delta, bones, boneMat, ofx = 0, ofy = 0) {
            this.writeBoneBuffer(bones, boneMat, ofx, ofy);
        }
        updateBoneMatrixCache(delta, bones, boneMat, ofx = 0, ofy = 0) {
            this.writeBoneBufferCache(this._animator.boneFrames, delta / SpineConst.SPINE_STEP, boneMat, ofx, ofy);
        }
        writeBoneBuffer(bones, boneMat, ofx = 0, ofy = 0) {
            let creator = this.currentData.vb;
            let boneArray = creator.localBoneIdIndexPairs;
            for (let i = 0, n = boneArray.length; i < n; i += 2) {
                let offset = boneArray[i] * 8;
                let bone = bones[boneArray[i + 1]];
                boneMat[offset] = bone.a;
                boneMat[offset + 1] = bone.b;
                boneMat[offset + 2] = bone.worldX + ofx;
                boneMat[offset + 3] = 0;
                boneMat[offset + 4] = bone.c;
                boneMat[offset + 5] = bone.d;
                boneMat[offset + 6] = bone.worldY + ofy;
                boneMat[offset + 7] = 0;
            }
        }
        writeBoneBufferCache(boneFrames, frames, boneMat, ofx = 0, ofy = 0) {
            let creator = this.currentData.vb;
            let boneArray = creator.localBoneIdIndexPairs;
            let floor = Math.floor(frames);
            let detal;
            if (floor == boneFrames.length - 1) {
                detal = 0;
            }
            else {
                detal = frames - floor;
            }
            let boneFrames1 = boneFrames[floor];
            let boneFrames2 = boneFrames[floor + 1];
            if (detal > 0.0001) {
                for (let i = 0, n = boneArray.length; i < n; i += 2) {
                    let offset = boneArray[i] * 8;
                    let boneFloatArray = boneFrames1[boneArray[i + 1]];
                    let boneFloatArray2 = boneFrames2[boneArray[i + 1]];
                    boneMat[offset] = boneFloatArray[0] + (boneFloatArray2[0] - boneFloatArray[0]) * detal;
                    boneMat[offset + 1] = boneFloatArray[1] + (boneFloatArray2[1] - boneFloatArray[1]) * detal;
                    boneMat[offset + 2] = boneFloatArray[2] + (boneFloatArray2[2] - boneFloatArray[2]) * detal;
                    boneMat[offset + 3] = 0;
                    boneMat[offset + 4] = boneFloatArray[4] + (boneFloatArray2[4] - boneFloatArray[4]) * detal;
                    boneMat[offset + 5] = boneFloatArray[5] + (boneFloatArray2[5] - boneFloatArray[5]) * detal;
                    boneMat[offset + 6] = boneFloatArray[6] + (boneFloatArray2[6] - boneFloatArray[6]) * detal;
                    boneMat[offset + 7] = 0;
                }
            }
            else {
                for (let i = 0, n = boneArray.length; i < n; i += 2) {
                    let offset = boneArray[i] * 8;
                    let bone = boneFrames1[boneArray[i + 1]];
                    boneMat.set(bone, offset);
                }
            }
        }
        _updateMaterials(elements) {
            if (this.currentMaterials) {
                for (let i = 0, len = this.currentMaterials.length; i < len; i++) {
                    this.currentMaterials[i]._removeReference();
                }
            }
            if (elements) {
                for (let i = 0, len = elements.length; i < len; i++) {
                    elements[i]._addReference();
                }
            }
            this.currentMaterials = elements;
        }
        _clearCacheMaterials() {
            this.cacheMaterials.length = 0;
            this.materialCacheVersion++;
        }
        destroy() {
            this.clear();
            this.owner = null;
        }
    }

    var ERenderProxyType;
    (function (ERenderProxyType) {
        ERenderProxyType[ERenderProxyType["RenderNormal"] = 0] = "RenderNormal";
        ERenderProxyType[ERenderProxyType["RenderRigidBody"] = 1] = "RenderRigidBody";
        ERenderProxyType[ERenderProxyType["RenderOptimize"] = 2] = "RenderOptimize";
        ERenderProxyType[ERenderProxyType["RenderBake"] = 3] = "RenderBake";
    })(ERenderProxyType || (ERenderProxyType = {}));
    class BaseOptimizeRender {
        get mode() {
            return this._mode;
        }
        set mode(value) {
            var _a;
            if (this._mode === value)
                return;
            if (value !== exports.ESpineRenderMode.Normal && this._optimize.maxBoneNumber > SpineConst.MAX_BONES) {
                console.warn("The number of Bones :", this._optimize.maxBoneNumber, " > ", SpineConst.MAX_BONES, ", use CPU caculation");
                value = exports.ESpineRenderMode.Normal;
            }
            this._mode = value;
            if (this._curAnimationName) {
                if (this._enableCache && ((_a = this.updater.currentData) === null || _a === void 0 ? void 0 : _a.renderCache[this.updater.cacheFrameIndex])) {
                    this._applyCurrentPose();
                }
                this._clearRenderElements();
                this._updateRenderProxy();
            }
        }
        get premultipliedAlpha() {
            return this._premultipliedAlpha;
        }
        set premultipliedAlpha(value) {
            if (this._premultipliedAlpha === value)
                return;
            this.clearCacheMaterials();
            this._premultipliedAlpha = value;
        }
        constructor() {
            this._skinIndex = 0;
            this._skinAttach = null;
            this._currentAnimator = null;
            this._transform = new Laya.Vector2();
            this._enableCache = false;
            this._hasExternalSkin = false;
            this._destroyed = false;
            this._mode = exports.ESpineRenderMode.None;
            this._bakeVertexAnimationWarnings = new Set();
            this.state = exports.ESpineRenderState.Stopped;
            this.currentTime = 0;
            this.trackEntry = null;
            this._premultipliedAlpha = true;
            this.spineColor = new Laya.Color();
            this.updater = new SpineRenderUpdater(this);
        }
        init(templet) {
            this._templet = templet;
            let optimize = this._optimize = this._templet.optimize;
            this._skeleton = new spine.Skeleton(optimize.data);
            this._stateData = new spine.AnimationStateData(optimize.data);
            this._state = new spine.AnimationState(this._stateData);
            let scolor = this._skeleton.color;
            this.spineColor.setValue(scolor.r, scolor.g, scolor.b, scolor.a);
            this.initRenderProxies();
            this._updateSkinShaderDefines();
        }
        getSkeleton() {
            return this._skeleton;
        }
        showSkinByIndex(skinIndex) {
            this.setSkinIndex(skinIndex);
            this._skeleton.setSkin(this._optimize.getSkin(skinIndex));
            this._skeleton.setSlotsToSetupPose();
            if (this._currentAnimator)
                this._applyCurrentPose();
        }
        setAttachment(slotName, attachmentName) {
            if (this._skeleton) {
                this._skeleton.setAttachment(slotName, attachmentName);
            }
        }
        update(delta) {
            var _a;
            if (!Laya.Stat.enableSpine || this._destroyed)
                return;
            this._state.update(delta);
            this.currentTime = this.trackEntry.getAnimationTime();
            let cacheFrameIndex = Math.floor(this.currentTime / SpineConst.SPINE_STEP);
            this.updater.cacheFrameIndex = cacheFrameIndex;
            let bakeNeedsSlotState = this.renderProxy.type === exports.ESpineRenderMode.Bake
                && this._currentAnimator.hasVertexAnimation;
            if (bakeNeedsSlotState || ((!this._enableCache
                || this._hasExternalSkin
                || !this.updater.currentData.renderCache[cacheFrameIndex])
                && this.renderProxy.type !== exports.ESpineRenderMode.Bake)) {
                this._state.apply(this._skeleton);
            }
            else {
                let entry = this.trackEntry;
                let animationStart = entry.animationStart, animationEnd = entry.animationEnd;
                let duration = animationEnd - animationStart;
                entry.trackLast = entry.nextTrackLast;
                let trackLastWrapped = entry.trackLast % duration;
                let animationTime = entry.getAnimationTime();
                let complete = false;
                if (entry.loop)
                    complete = duration == 0 || trackLastWrapped > entry.trackTime % duration;
                else
                    complete = animationTime >= animationEnd && entry.animationLast < animationEnd;
                if (complete) {
                    (_a = this._listeners) === null || _a === void 0 ? void 0 : _a.complete(entry);
                    entry.nextAnimationLast = -1;
                    entry.nextTrackLast = -1;
                }
                else {
                    entry.nextAnimationLast = animationTime;
                    entry.nextTrackLast = entry.trackTime;
                }
                if (this._currentAnimator.hasEvent) {
                    this._updateCacheEvent(delta);
                }
            }
        }
        updateWorldTransform(physicsUpdate) {
            if (this._skeleton) {
                this._skeleton.updateWorldTransform(physicsUpdate);
            }
        }
        _updateCacheEvent(delta) {
            let animator = this._currentAnimator;
            let f = delta / SpineConst.SPINE_STEP;
            let currFrame = Math.round(f);
            let curentTrack = this.trackEntry;
            let lastEventFrame = curentTrack.lastEventFrame;
            if (lastEventFrame == currFrame) {
                return;
            }
            if (lastEventFrame > currFrame || lastEventFrame == undefined) {
                lastEventFrame = -1;
            }
            if (currFrame - lastEventFrame <= 1) {
                let events = animator.eventsFrames[currFrame];
                if (events) {
                    for (let i = 0, n = events.length; i < n; i++) {
                        this.dispatchEvent(null, "event", events[i]);
                    }
                }
            }
            else {
                for (let i = lastEventFrame + 1; i <= currFrame; i++) {
                    let events = animator.eventsFrames[i];
                    if (events) {
                        for (let j = 0, m = events.length; j < m; j++) {
                            this.dispatchEvent(null, "event", events[j]);
                        }
                    }
                }
            }
            curentTrack.lastEventFrame = currFrame;
        }
        render(time, physicsUpdate) {
            if (!Laya.Stat.enableSpine || !this.renderProxy || this._destroyed)
                return;
            this._skeleton.update(time);
            if ((!this._enableCache
                || this._hasExternalSkin
                || !this.updater.currentData.renderCache[this.updater.cacheFrameIndex])
                && this.renderProxy.type !== exports.ESpineRenderMode.Bake) {
                this.updateWorldTransform(physicsUpdate);
            }
            let offsetX = -this._skeleton.x;
            let offsetY = -this._skeleton.y;
            if (this.renderProxy) {
                this.renderProxy.render(this.currentTime, offsetX, offsetY);
                if (this.renderProxy.afterRender) {
                    this.renderProxy.afterRender(this);
                }
            }
        }
        getSpineColor() {
            return this.spineColor;
        }
        initRenderProxies() {
            if (!this._templet || !this._optimize) {
                return;
            }
            this.renderProxyMap = new Map();
            this._dynamicMap = new Map();
            this.updater.clear();
            this._createRenderProxies();
            this.renderProxyMap.forEach(render => {
                render.bind(this.updater, this._skeleton);
            });
            this._skinAttach = this._optimize.skinAttachArray[this._skinIndex];
            this.updater.skinAttach = this._skinAttach;
        }
        destroy() {
            this.reset();
            if (this._dynamicMap) {
                this._dynamicMap.forEach(meshes => meshes.forEach(mesh => mesh.destroy()));
                this._dynamicMap.clear();
            }
            this.updater.destroy();
            this.updater = null;
            this._destroyed = true;
        }
        initBake(obj) {
            this.bakeData = obj;
            if (obj) {
                let render = this.renderProxyMap.get(ERenderProxyType.RenderBake);
                if (!render) {
                    render = this._createBakedRenderer();
                    render.bind(this.updater, this._skeleton);
                    this.renderProxyMap.set(ERenderProxyType.RenderBake, render);
                }
                if (render) {
                    render.simpleAnimatorTexture = obj.texture2d;
                    render._bonesNums = obj.bonesNums;
                    render.aniOffsetMap = obj.aniOffsetMap;
                }
            }
            this._mode = exports.ESpineRenderMode.Bake;
            if (this._curAnimationName) {
                this._clearRenderElements();
                if (this.trackEntry) {
                    this.play(this._curAnimationName, this.trackEntry.loop, this.trackEntry.trackIndex, this.trackEntry.animationStart, this.trackEntry.animationEnd);
                }
                else {
                    this.play(this._curAnimationName);
                }
            }
        }
        changeSkeleton(skeleton) {
            this._skeleton = skeleton;
            this.renderProxyMap.forEach(proxy => {
                proxy.bind(this.updater, skeleton);
            });
            skeleton.setSkin(this._optimize.getSkin(this._skinIndex));
            this._skeleton.setSlotsToSetupPose();
        }
        setSkinIndex(index) {
            if (index == this._skinIndex || !this._optimize)
                return;
            this._skinIndex = index;
            this._skinAttach = this._optimize.skinAttachArray[index];
            this.updater.skinAttach = this._skinAttach;
            this._updateSkinShaderDefines();
            if (this._currentAnimator) {
                this._clearRenderElements();
                this._updateRenderProxy();
            }
        }
        getDynamicMesh(vertexDeclaration, create = true, index = 0) {
            let id = vertexDeclaration.id;
            let meshes = this._dynamicMap.get(id);
            if (!meshes) {
                meshes = [];
                this._dynamicMap.set(id, meshes);
            }
            let mesh = meshes[index];
            if (!mesh && create) {
                mesh = SpineMeshUtils.createMeshDynamic(vertexDeclaration);
                meshes[index] = mesh;
            }
            return mesh;
        }
        reset() {
            this._skinIndex = 0;
            this._curAnimationName = null;
            this._currentAnimator = null;
            this._skinAttach = null;
            this.updater.clear();
            this.renderProxyMap.forEach(render => {
                render.destroy();
            });
            this.renderProxyMap.clear();
            this.renderProxy = null;
            this._skeleton = null;
            this._optimize = null;
            this._bakeVertexAnimationWarnings.clear();
            if (this._state) {
                this._state.clearListeners();
            }
            this._state = null;
            this._stateData = null;
            this._clearRenderElements();
        }
        _applyCurrentPose() {
            const queue = this._state.queue;
            const pendingCount = queue.objects.length;
            const drainDisabled = queue.drainDisabled;
            queue.drainDisabled = true;
            try {
                this._state.apply(this._skeleton);
            }
            finally {
                queue.objects.length = pendingCount;
                queue.drainDisabled = drainDisabled;
            }
        }
        play(animationName, loop = true, trackIndex = 0, start = 0, end = 0) {
            let trackEntry = this._state.setAnimation(trackIndex, animationName, loop);
            if (!trackEntry)
                return null;
            this.trackEntry = trackEntry;
            trackEntry.animationStart = start;
            if (end > 0 && end < trackEntry.animationEnd) {
                trackEntry.animationEnd = end;
            }
            this._curAnimationName = animationName;
            this._updateRenderProxy();
            if (this.renderProxy.type !== exports.ESpineRenderMode.Optimize) {
                this._skeleton.setBonesToSetupPose();
            }
        }
        _updateRenderProxy() {
            var _a;
            const animationName = this._curAnimationName;
            let oldProxy = this.renderProxy;
            this.updater.reset();
            let skinAttach = this._skinAttach;
            let currentAnimator = this._optimize.animators.find(animator => animator.name === animationName);
            let skinAniData = currentAnimator.skinDataArray[skinAttach.index];
            let isNormalRender = skinAttach.isNormalRender || currentAnimator.hasClip || (skinAniData && skinAniData.isNormalRender);
            if (!isNormalRender && (this.mode === exports.ESpineRenderMode.Optimize || this.mode === exports.ESpineRenderMode.Bake)) {
                if (skinAttach.vertexBones > 4) {
                    console.warn(`In FastRender mode - Current skin: ${skinAttach.name} has ${skinAttach.vertexBones} bones influencing each vertex. This exceeds the recommended limit of 4 bones per vertex.`);
                }
                if (this.bakeData
                    && this.bakeData.aniOffsetMap[animationName] != undefined) {
                    this.renderProxy = this.renderProxyMap.get(ERenderProxyType.RenderBake);
                }
                else {
                    switch (skinAttach.type) {
                        case exports.ESpineRenderType.boneGPU:
                            this.renderProxy = this.renderProxyMap.get(ERenderProxyType.RenderOptimize);
                            break;
                        case exports.ESpineRenderType.rigidBody:
                            this.renderProxy = this.renderProxyMap.get(ERenderProxyType.RenderRigidBody);
                            break;
                        case exports.ESpineRenderType.normal:
                            this.renderProxy = this.renderProxyMap.get(ERenderProxyType.RenderNormal);
                            break;
                    }
                    if (this._enableCache) {
                        if (!currentAnimator.isCache) {
                            this._optimize.cacheBone();
                        }
                    }
                }
            }
            else {
                this.renderProxy = this.renderProxyMap.get(ERenderProxyType.RenderNormal);
            }
            if (oldProxy) {
                oldProxy.leave();
            }
            if (((_a = this.renderProxy) === null || _a === void 0 ? void 0 : _a.type) === exports.ESpineRenderMode.Bake
                && currentAnimator.hasVertexAnimation
                && !this._bakeVertexAnimationWarnings.has(animationName)) {
                this._bakeVertexAnimationWarnings.add(animationName);
                console.warn(`Spine Bake mode: animation "${animationName}" contains vertex animation. Vertex data will be updated on the CPU while bone matrices continue to use baked data.`);
            }
            if (this.renderProxy && currentAnimator) {
                this.updater.animator = currentAnimator;
                this._currentAnimator = currentAnimator;
                this.renderProxy.change();
            }
        }
        addAnimation(animationName, loop = false, delay = 0, trackIndex = 0) {
            this._state.addAnimation(trackIndex, animationName, loop, delay);
        }
        setMix(fromAnimation, toAnimation, duration) {
            this._stateData.setMix(fromAnimation, toAnimation, duration);
        }
        findBone(boneName) {
            if (!this._skeleton)
                return null;
            return this._skeleton.findBone(boneName);
        }
        findSlot(slotName) {
            if (!this._skeleton)
                return null;
            let slot = this._skeleton.findSlot(slotName);
            if (!slot)
                return null;
            return {
                name: slot.data.name
            };
        }
        setSkeletonPosition(x, y) {
            if (this._skeleton) {
                this._skeleton.x = x;
                this._skeleton.y = y;
            }
        }
        physicsTranslate(x, y) {
            if (this._skeleton && this._optimize.hasPhysics) {
                this._skeleton.physicsTranslate(x, y);
            }
        }
        getBones() {
            if (!this._skeleton)
                return [];
            return this._skeleton.bones;
        }
        getSkeletonTransform() {
            if (!this._skeleton || !this._templet) {
                return this._transform;
            }
            this._transform.x = this._skeleton.x;
            this._transform.y = this._skeleton.y;
            return this._transform;
        }
        resetExternalSkin() {
            if (!this._skeleton || !this._templet)
                return;
            this._hasExternalSkin = false;
            let optimize = this._templet.optimize;
            if (optimize && optimize.data) {
                for (const slot of this._skeleton.slots) {
                    const name = slot.data.attachmentName;
                    slot.setAttachment(name ? this._skeleton.getAttachment(slot.data.index, name) : null);
                }
            }
        }
        setEventListener(listeners) {
            this._listeners = listeners;
            if (this._state) {
                this._state.addListener(listeners);
            }
        }
        dispatchEvent(entry, type, event) {
            this._listeners[type](entry, event);
        }
        complete() {
            this.updater.currentFrameIndex = -1;
        }
        enableCache() {
            if (this._mode !== exports.ESpineRenderMode.Normal) {
                console.log("enableCache: mode is not Normal");
            }
            if (this.renderProxyMap) {
                const renderNormal = this.renderProxyMap.get(ERenderProxyType.RenderNormal);
                if (renderNormal) {
                    renderNormal.normalUpdater.autoCacheEnabled = true;
                }
            }
            this._enableCache = true;
        }
        disableCache() {
            if (this._mode !== exports.ESpineRenderMode.Normal) {
                console.log("disableCache: mode is not Normal");
            }
            if (this.renderProxyMap) {
                const renderNormal = this.renderProxyMap.get(ERenderProxyType.RenderNormal);
                if (renderNormal) {
                    renderNormal.normalUpdater.autoCacheEnabled = false;
                }
            }
            this._enableCache = false;
        }
        clearCacheMaterials() {
            var _a, _b;
            if (this._hasExternalSkin) {
                for (const slot of this._skeleton.slots) {
                    const page = (_b = (_a = slot.getAttachment()) === null || _a === void 0 ? void 0 : _a.region) === null || _b === void 0 ? void 0 : _b.page;
                    if (page)
                        this._templet._registerSpineMaterialTexture(page.name, page.texture.realTexture);
                }
            }
            this.updater._clearCacheMaterials();
        }
        setSlotTexture(slotName, texture, createAttachment, updateAttachmentSize = true) {
            if (this._mode !== exports.ESpineRenderMode.Normal) {
                console.log("setSlotTexture: mode is not Normal, return");
                return;
            }
            if (!this._skeleton || !texture)
                return;
            let slot = this._skeleton.findSlot(slotName);
            if (!slot)
                return;
            let attachment = slot.getAttachment();
            if (!attachment)
                return;
            this._templet.registerTexture(texture);
            let newRegion = this._optimize.registerTexture(texture);
            if (!newRegion)
                return;
            if (createAttachment) {
                attachment = attachment.copy();
                slot.setAttachment(attachment);
            }
            if (attachment instanceof spine.RegionAttachment) {
                attachment.region = newRegion;
                if (updateAttachmentSize) {
                    attachment.width = newRegion.width;
                    attachment.height = newRegion.height;
                }
                if (attachment.updateRegion) {
                    attachment.updateRegion();
                }
                else if (attachment.updateOffset) {
                    attachment.updateOffset();
                }
            }
            else if (attachment instanceof spine.MeshAttachment) {
                attachment.region = newRegion;
                if (updateAttachmentSize) {
                    attachment.width = newRegion.width;
                    attachment.height = newRegion.height;
                }
                if (attachment.updateRegion) {
                    attachment.updateRegion();
                }
                else if (attachment.updateUVs) {
                    attachment.updateUVs();
                }
            }
        }
        restoreSlotTexture(slotName) {
            if (this._mode !== exports.ESpineRenderMode.Normal || !this._skeleton) {
                return false;
            }
            let slot = this._skeleton.findSlot(slotName);
            if (!slot) {
                return false;
            }
            let setupAttachmentName = slot.data.attachmentName;
            if (!setupAttachmentName) {
                slot.setAttachment(null);
                return true;
            }
            let setupAttachment = this._skeleton.getAttachment(slot.data.index, setupAttachmentName);
            if (!setupAttachment) {
                return false;
            }
            slot.setAttachment(setupAttachment);
            return true;
        }
        setTempletAttachment(templet, targetSlotName, skinName, attachmentName) {
            var _a;
            if (this._mode !== exports.ESpineRenderMode.Normal) {
                console.log("setSlotAttachment: mode is not Normal");
                return;
            }
            let optimize = templet.optimize;
            if (attachmentName && targetSlotName && skinName) {
                let attachment = null;
                let skins = optimize.data.skins;
                for (let j = skins.length - 1; j >= 0; j--) {
                    if (skins[j].name == skinName) {
                        let skin = skins[j];
                        let attachments = skin.attachments;
                        for (let j = attachments.length - 1; j >= 0; j--) {
                            attachment = (_a = attachments[j]) === null || _a === void 0 ? void 0 : _a[attachmentName];
                            if (attachment) {
                                break;
                            }
                        }
                        break;
                    }
                }
                if (attachment && attachment.region) {
                    let slotObj = this._skeleton.findSlot(targetSlotName);
                    if (slotObj) {
                        slotObj.setAttachment(attachment);
                        this._hasExternalSkin = true;
                        const page = attachment.region.page;
                        this._templet._registerSpineMaterialTexture(page.name, page.texture.realTexture);
                        this.updater._clearCacheMaterials();
                    }
                }
            }
        }
    }

    exports.ERenderProxyType = void 0;
    (function (ERenderProxyType) {
        ERenderProxyType[ERenderProxyType["RenderNormal"] = 0] = "RenderNormal";
        ERenderProxyType[ERenderProxyType["RenderRigidBody"] = 1] = "RenderRigidBody";
        ERenderProxyType[ERenderProxyType["RenderOptimize"] = 2] = "RenderOptimize";
        ERenderProxyType[ERenderProxyType["RenderBake"] = 3] = "RenderBake";
    })(exports.ERenderProxyType || (exports.ERenderProxyType = {}));

    class SpineBaseRenderer {
        constructor(shaderData) {
            this.type = exports.ESpineRenderMode.Optimize;
            this._shaderData = shaderData;
        }
        destroy() {
        }
        bind(updater, skeleton) {
            this.updater = updater;
            this._skeleton = skeleton;
            this.bones = skeleton.bones;
            this.slots = skeleton.slots;
        }
    }
    class RigidBodySpineRenderer extends SpineBaseRenderer {
        constructor() {
            super(...arguments);
            this._matrix_0 = new Laya.Vector4(1, 0, 0);
            this._matrix_1 = new Laya.Vector4(0, 1, 0);
        }
        leave() {
            this._shaderData.removeDefine(SpineShaderInit.SPINE_RB);
        }
        change() {
            this._shaderData.addDefine(SpineShaderInit.SPINE_RB);
            this.updater.needUpdate = true;
            this._shaderData.setVector(SpineShaderInit.BONEMAT_0, this._matrix_0);
            this._shaderData.setVector(SpineShaderInit.BONEMAT_1, this._matrix_1);
        }
        render(curTime, offsetX = 0, offsetY = 0) {
            if (!this.updater)
                return;
            this.updater.renderWithOutMat(this.slots, curTime);
            let bone = this.bones[this.updater.skinAttach.rbBoneIndex];
            if (!bone) {
                return;
            }
            let x = bone.worldX + offsetX;
            let y = bone.worldY + offsetY;
            if (bone.a === this._matrix_0.x
                && bone.b === this._matrix_0.y
                && bone.c === this._matrix_1.x
                && bone.d === this._matrix_1.y
                && x === this._matrix_0.z
                && y === this._matrix_1.z) {
                return;
            }
            this._matrix_0.x = bone.a;
            this._matrix_0.y = bone.b;
            this._matrix_0.z = x;
            this._matrix_1.x = bone.c;
            this._matrix_1.y = bone.d;
            this._matrix_1.z = y;
            this._shaderData.setVector(SpineShaderInit.BONEMAT_0, this._matrix_0);
            this._shaderData.setVector(SpineShaderInit.BONEMAT_1, this._matrix_1);
        }
        afterRender(optimizeRender) {
            if (this.updater.needUpdate) {
                optimizeRender._updateRenderElements(this.updater.getSubMeshes(), this.updater.currentMaterials);
                this.updater.needUpdate = false;
            }
        }
    }
    class OptimizedSpineRenderer extends SpineBaseRenderer {
        constructor(shaderData) {
            super(shaderData);
            this._boneMat = new Float32Array(SpineConst.MAX_BONES * 8);
        }
        change() {
            this._shaderData.addDefine(SpineShaderInit.SPINE_FAST);
            this.updater.needUpdate = true;
        }
        leave() {
            this._shaderData.removeDefine(SpineShaderInit.SPINE_FAST);
        }
        render(curTime, offsetX = 0, offsetY = 0) {
            this.updater.renderWithMat(this.bones, this.slots, curTime, this._boneMat, offsetX, offsetY);
            this._shaderData.setBuffer(SpineShaderInit.BONEMAT, this._boneMat);
        }
        afterRender(optimizeRender) {
            if (this.updater.needUpdate) {
                optimizeRender._updateRenderElements(this.updater.getSubMeshes(), this.updater.currentMaterials);
                this.updater.needUpdate = false;
            }
        }
    }
    class StandardSpineRenderer extends SpineBaseRenderer {
        constructor(shaderData) {
            super(shaderData);
            this.type = exports.ESpineRenderMode.Normal;
        }
        leave() {
            this._shaderData.removeDefine(SpineShaderInit.SPINE_COLOR2);
        }
        change() {
            this._shaderData.addDefine(SpineShaderInit.SPINE_COLOR2);
            this.normalUpdater.needUpdate = true;
        }
        render(curTime, offsetX = 0, offsetY = 0) {
            var _a;
            let skinData = (_a = this.updater) === null || _a === void 0 ? void 0 : _a.currentData;
            if (skinData && !this.updater.owner._hasExternalSkin
                && (skinData.hasRenderCache || this.normalUpdater.autoCacheEnabled)) {
                let cache = skinData.renderCache[this.updater.cacheFrameIndex];
                if (cache) {
                    this.normalUpdater.restoreFromCache(cache);
                    return;
                }
            }
            this.normalUpdater.renderUpdate(curTime, this._skeleton, this.updater, -1, -1, offsetX, offsetY);
        }
        afterRender(optimizeRender) {
            if (this.normalUpdater.needUpdate) {
                optimizeRender._updateRenderElements(this.normalUpdater.subMeshes, this.normalUpdater.materials);
                this.normalUpdater.needUpdate = false;
            }
        }
        destroy() {
            if (this.normalUpdater) {
                this.normalUpdater.destroy();
                this.normalUpdater = null;
            }
        }
    }
    class BakedSpineRenderer extends SpineBaseRenderer {
        constructor() {
            super(...arguments);
            this.type = exports.ESpineRenderMode.Bake;
            this._simpleAnimatorParams = new Laya.Vector4();
            this._simpleAnimatorOffset = new Laya.Vector2();
            this.step = 1 / 60;
        }
        get simpleAnimatorTexture() {
            return this._simpleAnimatorTexture;
        }
        set simpleAnimatorTexture(value) {
            if (this._simpleAnimatorTexture) {
                this._simpleAnimatorTexture._removeReference();
            }
            this._simpleAnimatorTexture = value;
            this._simpleAnimatorTextureSize = value.width;
            this._shaderData.setTexture(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURE, value);
            value._addReference();
            this._shaderData.setNumber(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURESIZE, this._simpleAnimatorTextureSize);
        }
        get simpleAnimatorOffset() {
            return this._simpleAnimatorOffset;
        }
        set simpleAnimatorOffset(value) {
            value.cloneTo(this._simpleAnimatorOffset);
        }
        leave() {
            this._shaderData.removeDefine(SpineShaderInit.SPINE_SIMPLE);
            this._shaderData.removeDefine(SpineShaderInit.SPINE_GPU_INSTANCE);
            this._shaderData.removeDefine(SpineShaderInit.SPINE_RB);
        }
        change() {
            this._shaderData.addDefine(SpineShaderInit.SPINE_SIMPLE);
            if (this.updater.skinAttach.type === exports.ESpineRenderType.rigidBody) {
                this._shaderData.addDefine(SpineShaderInit.SPINE_RB);
            }
            else {
                this._shaderData.removeDefine(SpineShaderInit.SPINE_RB);
            }
            this._simpleAnimatorOffset.x = this.aniOffsetMap[this.updater.animationName];
            this.updater.needUpdate = true;
        }
        _computeAnimatorParamsData() {
            this._simpleAnimatorParams.x = this._simpleAnimatorOffset.x;
            this._simpleAnimatorParams.y = Math.round(this._simpleAnimatorOffset.y) * this._bonesNums * 2;
        }
        setCustomData(value1, value2 = 0) {
            this._simpleAnimatorParams.z = value1;
            this._simpleAnimatorParams.w = value2;
        }
        render(curTime, offsetX = 0, offsetY = 0) {
            this.updater.renderWithOutMat(this.slots, curTime);
            this._simpleAnimatorOffset.y = curTime / this.step;
            this._computeAnimatorParamsData();
            this._shaderData.setVector(SpineShaderInit.SIMPLE_SIMPLEANIMATORPARAMS, this._simpleAnimatorParams);
            this.updater.needUpdate = true;
        }
        afterRender(optimizeRender) {
            optimizeRender._updateRenderElements(this.updater.getSubMeshes(), this.updater.currentMaterials);
        }
    }

    class BakedSpine2DRenderer extends BakedSpineRenderer {
        constructor(struct) {
            super(struct.spriteShaderData);
            this._struct = struct;
        }
        change() {
            super.change();
            if (this.updater.currentData && this.updater.currentData.canInstance) {
                this._struct.renderType = Laya.BaseRender2DType.spineSimple;
            }
            else
                this._struct.renderType = Laya.BaseRender2DType.spine;
        }
        leave() {
            super.leave();
            this._struct.renderType = Laya.BaseRender2DType.spine;
        }
    }
    class StandardSpine2DRenderer extends StandardSpineRenderer {
        constructor(struct) {
            super(struct.spriteShaderData);
            this._struct = struct;
        }
        change() {
            super.change();
            this._struct.renderType = Laya.BaseRender2DType.spinenormal;
            this._shaderData.addDefine(SpineShaderInit.SPINE_NORMAL_2D);
            let handle = this._struct.renderDataHandler;
            handle.needUseMatrix = false;
            handle.renderMatrixVersion = -1;
        }
        leave() {
            super.leave();
            this._struct.renderType = Laya.BaseRender2DType.spine;
            this._shaderData.removeDefine(SpineShaderInit.SPINE_NORMAL_2D);
            let handle = this._struct.renderDataHandler;
            handle.needUseMatrix = true;
            handle.renderMatrixVersion = -1;
        }
        updateRenderMatrix(renderMatrix, offset, applyToViews) {
            let matrix = this.normalUpdater.matrix;
            renderMatrix.copyTo(matrix);
            if (offset) {
                matrix.tx += matrix.a * offset.x + matrix.c * offset.y;
                matrix.ty += matrix.b * offset.x + matrix.d * offset.y;
            }
            this._struct.renderDataHandler.renderMatrixVersion = this._struct.getRenderMatrixVersion();
            if (applyToViews) {
                this.normalUpdater.applyRenderMatrixToViews();
            }
        }
        render(curTime, offsetX = 0, offsetY = 0) {
            var _a;
            let skinData = (_a = this.updater) === null || _a === void 0 ? void 0 : _a.currentData;
            let handle = this._struct.renderDataHandler;
            let matrixVersion = this._struct.getRenderMatrixVersion();
            if (matrixVersion < 0 || handle.renderMatrixVersion !== matrixVersion) {
                this.updateRenderMatrix(this._struct.renderMatrix, handle.offset, false);
            }
            if (skinData && !this.updater.owner._hasExternalSkin
                && (skinData.hasRenderCache || this.normalUpdater.autoCacheEnabled)) {
                let cache = skinData.renderCache[this.updater.cacheFrameIndex];
                if (cache) {
                    this.normalUpdater.restoreFromCache(cache);
                    return;
                }
            }
            this.normalUpdater.renderUpdate(curTime, this._skeleton, this.updater, -1, -1, offsetX, offsetY);
        }
        afterRender(optimizeRender) {
            if (this.normalUpdater.needUpdate) {
                optimizeRender._updateRenderElements(this.normalUpdater.subMeshes, this.normalUpdater.materials);
                this.normalUpdater.needUpdate = false;
            }
        }
        destroy() {
            this._shaderData.removeDefine(SpineShaderInit.SPINE_NORMAL_2D);
            super.destroy();
        }
    }

    class SpineBufferView {
        constructor(vertexCapacity, indexCapacity) {
            this.vertexCount = 0;
            this.vertexBufferLength = 0;
            this.indexCount = 0;
            this.indexBufferLength = 0;
            this._uploadVertexSource = null;
            this._uploadVertexLength = -1;
            this._uploadVertexView = null;
            this.cacheIndex = null;
            this.vertexCapacity = vertexCapacity;
            this.indexCapacity = indexCapacity;
            this.vertexData = new Float32Array(vertexCapacity);
            this.localPositionCapacity = Math.ceil(vertexCapacity / SpineConst.VERTEX_TWOCOLOR) * 2;
            this.localPositions = new Float32Array(this.localPositionCapacity);
            this.indexData = new Uint16Array(indexCapacity);
        }
        getVertexData() {
            return this.vertexData;
        }
        getIndexData() {
            return this.indexData;
        }
        getUploadVertexData() {
            let source = this.vertexData;
            if (source.length === this.vertexBufferLength) {
                return source;
            }
            if (this._uploadVertexSource !== source || this._uploadVertexLength !== this.vertexBufferLength) {
                this._uploadVertexSource = source;
                this._uploadVertexLength = this.vertexBufferLength;
                this._uploadVertexView = source.subarray(0, this.vertexBufferLength);
            }
            return this._uploadVertexView;
        }
        markModified() {
            if (this.owner) {
                this.owner._modifyOneView(this);
                Laya.WebRender2DPass.setBuffer(this.owner);
            }
        }
        reset() {
            if (this.owner) {
                this.owner.removeDataView(this);
            }
            this.vertexCount = 0;
            this.vertexBufferLength = 0;
            this.indexCount = 0;
            this.indexBufferLength = 0;
            this.cacheIndex = null;
        }
        transferToBuffer(targetBuffer) {
            if (this.owner) {
                this.owner.removeDataView(this);
            }
            targetBuffer.addDataView(this);
        }
        ensureVertexCapacity(requiredFloats) {
            if (requiredFloats > this.vertexCapacity) {
                const newSize = Math.ceil(requiredFloats / SpineBufferView.ARRAY_GROWTH_STEP_VERTEX) * SpineBufferView.ARRAY_GROWTH_STEP_VERTEX;
                let newData = new Float32Array(newSize);
                newData.set(this.vertexData);
                this.vertexData = newData;
                this.vertexCapacity = newSize;
            }
            this.ensureLocalPositionCapacity(Math.ceil(requiredFloats / SpineConst.VERTEX_TWOCOLOR) * 2);
        }
        ensureLocalPositionCapacity(requiredFloats) {
            if (requiredFloats > this.localPositionCapacity) {
                const newSize = Math.ceil(requiredFloats / SpineBufferView.ARRAY_GROWTH_STEP_LOCAL_POSITION) * SpineBufferView.ARRAY_GROWTH_STEP_LOCAL_POSITION;
                let newData = new Float32Array(newSize);
                newData.set(this.localPositions);
                this.localPositions = newData;
                this.localPositionCapacity = newSize;
            }
        }
        ensureIndexCapacity(requiredIndices) {
            if (requiredIndices > this.indexCapacity) {
                const newSize = Math.ceil(requiredIndices / SpineBufferView.ARRAY_GROWTH_STEP_INDEX) * SpineBufferView.ARRAY_GROWTH_STEP_INDEX;
                let newData = new Uint16Array(newSize);
                newData.set(this.indexData);
                this.indexData = newData;
                this.indexCapacity = newSize;
            }
        }
        destroy() {
            this.vertexData = null;
            this.localPositions = null;
            this.indexData = null;
            this.cacheIndex = null;
            this._uploadVertexSource = null;
            this._uploadVertexView = null;
            this.geometry = null;
            this.owner = null;
            this._next = null;
            this._prev = null;
        }
    }
    SpineBufferView.ARRAY_GROWTH_STEP_VERTEX = SpineConst.NORMAL_VERTEX_LENGTH * SpineConst.VERTEX_TWOCOLOR;
    SpineBufferView.ARRAY_GROWTH_STEP_INDEX = SpineConst.NORMAL_VERTEX_LENGTH * 3;
    SpineBufferView.ARRAY_GROWTH_STEP_LOCAL_POSITION = SpineConst.NORMAL_VERTEX_LENGTH * 2;

    class SpineGlobalMeshManager {
        constructor() {
            this._buffers = [];
        }
        static get instance() {
            if (!this._instance) {
                this._instance = new SpineGlobalMeshManager();
            }
            return this._instance;
        }
        assignViewToBuffer(view, vertexCount) {
            let targetBuffer = this._findOrCreateBuffer(vertexCount);
            targetBuffer.addDataView(view);
            this.outBufferState = targetBuffer.bufferState;
            this.outBufferIndex = this._buffers.indexOf(targetBuffer);
        }
        _findOrCreateBuffer(vertexCount) {
            for (let buffer of this._buffers) {
                if (buffer.canFit(vertexCount)) {
                    return buffer;
                }
            }
            let newBuffer = this._createBuffer();
            this._buffers.push(newBuffer);
            return newBuffer;
        }
        allocateView(vertexCount, indexCount) {
            let targetBuffer = null;
            let bufferIndex = -1;
            for (let i = 0; i < this._buffers.length; i++) {
                let buffer = this._buffers[i];
                if (buffer.canFit(vertexCount)) {
                    targetBuffer = buffer;
                    bufferIndex = i;
                    break;
                }
            }
            if (!targetBuffer) {
                targetBuffer = this._createBuffer();
                bufferIndex = this._buffers.length;
                this._buffers.push(targetBuffer);
            }
            let vertexFloats = vertexCount * SpineConst.VERTEX_TWOCOLOR;
            let allocVertexFloats = Math.max(SpineGlobalMeshManager.INITIAL_VERTEX_CAPACITY, vertexFloats);
            let allocIndexCount = Math.max(SpineGlobalMeshManager.INITIAL_INDEX_CAPACITY, indexCount);
            this.outView = new SpineBufferView(allocVertexFloats, allocIndexCount);
            targetBuffer.addDataView(this.outView);
            this.outBufferState = targetBuffer.bufferState;
            this.outBufferIndex = bufferIndex;
        }
        releaseView(view) {
            if (view && view.owner) {
                view.owner.removeDataView(view);
            }
        }
        _createBuffer() {
            let vertexBuffer = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
            vertexBuffer.vertexDeclaration = SpineShaderInit.SpineNormalVertexDeclaration;
            let indexBuffer = Laya.LayaGL.renderDeviceFactory.createIndexBuffer(Laya.BufferUsage.Dynamic);
            let wholeBuffer = new SpineWholeBuffer(vertexBuffer, indexBuffer);
            wholeBuffer.resetCapacity(SpineGlobalMeshManager.INITIAL_VERTEX_CAPACITY, SpineGlobalMeshManager.INITIAL_INDEX_CAPACITY);
            wholeBuffer.bufferState = Laya.LayaGL.renderDeviceFactory.createBufferState();
            wholeBuffer.bufferState.applyState([vertexBuffer], indexBuffer);
            return wholeBuffer;
        }
        clear() {
            this._buffers.forEach(buffer => {
                buffer.destroy();
            });
            this._buffers = [];
        }
    }
    SpineGlobalMeshManager.INITIAL_VERTEX_CAPACITY = 1024 * SpineConst.VERTEX_TWOCOLOR;
    SpineGlobalMeshManager.INITIAL_INDEX_CAPACITY = 1024 * 3;

    const QUAD_TRIANGLES$1 = [0, 1, 2, 2, 3, 0];
    class Spine2DNormalRenderUpdater {
        constructor() {
            this.clipper = new spine.SkeletonClipping();
            this._internalMaterials = [];
            this._materialTextures = [];
            this._materialBlendModes = [];
            this._materialCacheVersion = -1;
            this.materials = [];
            this._materialIndex = 0;
            this.needUpdate = false;
            this.subMeshes = [];
            this.autoCacheEnabled = false;
            this.batches = [];
            this._currentBatchIndex = -1;
            this._currentGeometryVertexCount = 0;
            this._viewPool = [];
            this._allocatedViewsThisFrame = [];
            this._allocatedViewCount = 0;
            this.matrix = new Laya.Matrix;
        }
        applyRenderMatrixToViews() {
            var _a;
            let matrix = this.matrix;
            let a = matrix.a;
            let b = matrix.b;
            let c = matrix.c;
            let d = matrix.d;
            let tx = matrix.tx;
            let ty = matrix.ty;
            for (let i = 0; i <= this._currentBatchIndex; i++) {
                let view = (_a = this.batches[i]) === null || _a === void 0 ? void 0 : _a.view;
                if (view) {
                    let vertexData = view.vertexData;
                    let localPositions = view.localPositions;
                    for (let vertexIndex = 0, pos = 0, localPos = 0; vertexIndex < view.vertexCount; vertexIndex++, pos += SpineConst.VERTEX_TWOCOLOR, localPos += 2) {
                        let x = localPositions[localPos];
                        let y = localPositions[localPos + 1];
                        vertexData[pos + 6] = a * x - c * y + tx;
                        vertexData[pos + 7] = b * x - d * y + ty;
                    }
                    view.markModified();
                }
            }
        }
        renderUpdate(time, skeleton, updater, slotRangeStart, slotRangeEnd, offsetX = 0, offsetY = 0) {
            if (this._materialCacheVersion !== updater.materialCacheVersion) {
                this._materialCacheVersion = updater.materialCacheVersion;
                this._internalMaterials.length = 0;
                this._materialTextures.length = 0;
                this._materialBlendModes.length = 0;
                this.needUpdate = true;
            }
            let clipper = this.clipper;
            let twoColorTint = true;
            let blendMode = null;
            let uvs;
            let triangles;
            let drawOrder = skeleton.drawOrder;
            let attachmentColor;
            let skeletonColor = skeleton.color;
            let vertexStride = SpineConst.VERTEX_TWOCOLOR;
            let inRange = false;
            if (slotRangeStart == -1)
                inRange = true;
            let spineTex;
            let positions = SpineNormalRenderUpdater.positions;
            let _TEMP_COLOR = SpineNormalRenderUpdater._TEMP_COLOR;
            let _TEMP_COLOR2 = SpineNormalRenderUpdater._TEMP_COLOR2;
            this._materialIndex = 0;
            this._currentBatchIndex = -1;
            this._currentGeometryVertexCount = 0;
            for (let i = 0, n = this._allocatedViewCount; i < n; i++) {
                let view = this._allocatedViewsThisFrame[i];
                view.reset();
                this._viewPool.push(view);
            }
            this._allocatedViewCount = 0;
            blendMode = null;
            spineTex = null;
            for (let i = 0, n = drawOrder.length; i < n; i++) {
                let clippedVertexStride = clipper.isClipping() ? 2 : vertexStride;
                let slot = drawOrder[i];
                let boneOrSlot = SpineConst.NEED_SLOT ? slot : slot.bone;
                if (!slot.bone.active) {
                    clipper.clipEndWithSlot(slot);
                    continue;
                }
                if (slotRangeStart >= 0 && slotRangeStart == slot.data.index) {
                    inRange = true;
                }
                if (!inRange) {
                    clipper.clipEndWithSlot(slot);
                    continue;
                }
                if (slotRangeEnd >= 0 && slotRangeEnd == slot.data.index) {
                    inRange = false;
                }
                let attachment = slot.getAttachment();
                let texture;
                let verticesLength = 0;
                if (attachment instanceof window.spine.RegionAttachment) {
                    let region = attachment;
                    verticesLength = clippedVertexStride << 2;
                    if (attachment.sequence != null)
                        attachment.sequence.apply(slot, attachment);
                    region.computeWorldVertices(boneOrSlot, positions, 0, clippedVertexStride);
                    triangles = QUAD_TRIANGLES$1;
                    uvs = region.uvs;
                    texture = region.region.page.texture;
                    attachmentColor = region.color;
                }
                else if (attachment instanceof window.spine.MeshAttachment) {
                    let mesh = attachment;
                    verticesLength = (mesh.worldVerticesLength >> 1) * clippedVertexStride;
                    if (verticesLength > positions.length) {
                        positions = new Float32Array(verticesLength);
                        SpineNormalRenderUpdater.positions = positions;
                    }
                    mesh.computeWorldVertices(slot, 0, mesh.worldVerticesLength, positions, 0, clippedVertexStride);
                    triangles = mesh.triangles;
                    texture = mesh.region.page.texture;
                    uvs = mesh.uvs;
                    attachmentColor = mesh.color;
                }
                else if (attachment instanceof window.spine.ClippingAttachment) {
                    this.clipper.clipStart(slot, attachment);
                    continue;
                }
                else {
                    clipper.clipEndWithSlot(slot);
                    continue;
                }
                if (texture) {
                    let slotColor = slot.color;
                    let finalColor = _TEMP_COLOR;
                    finalColor.r = skeletonColor.r * slotColor.r * attachmentColor.r;
                    finalColor.g = skeletonColor.g * slotColor.g * attachmentColor.g;
                    finalColor.b = skeletonColor.b * slotColor.b * attachmentColor.b;
                    finalColor.a = skeletonColor.a * slotColor.a * attachmentColor.a;
                    let darkColor = _TEMP_COLOR2;
                    if (!slot.darkColor)
                        darkColor.set(0, 0, 0, 1.0);
                    else {
                        darkColor.setFromColor(slot.darkColor);
                    }
                    let slotBlendMode = slot.data.blendMode;
                    let needNewMat = false;
                    if (slotBlendMode != blendMode) {
                        blendMode = slotBlendMode;
                        needNewMat = true;
                    }
                    if (spineTex != texture) {
                        spineTex = texture;
                        needNewMat = true;
                    }
                    if (needNewMat) {
                        let materialIndex = this._materialIndex;
                        let realTexture = texture.realTexture;
                        let material = this._internalMaterials[materialIndex];
                        if (this._materialTextures[materialIndex] !== realTexture
                            || this._materialBlendModes[materialIndex] !== blendMode
                            || !material) {
                            material = updater.owner._getMaterial(realTexture, blendMode);
                            this._materialTextures[materialIndex] = realTexture;
                            this._materialBlendModes[materialIndex] = blendMode;
                        }
                        this.addMaterial(material);
                        this.createBatch();
                    }
                    if (clipper.isClipping()) {
                        clipper.clipTriangles(positions, verticesLength, triangles, triangles.length, uvs, finalColor, darkColor, twoColorTint);
                        this.appendVerticesClip(clipper.clippedVertices, clipper.clippedTriangles, vertexStride, offsetX, offsetY);
                    }
                    else {
                        if (finalColor.a != 0) {
                            this.appendVertices(positions, uvs, finalColor, darkColor, verticesLength, triangles, triangles.length, vertexStride, offsetX, offsetY);
                        }
                    }
                }
                clipper.clipEndWithSlot(slot);
            }
            clipper.clipEnd();
            this._bindViewsToBuffers();
            const totalBatchCount = this._currentBatchIndex + 1;
            let renderBatchCount = 0;
            for (let i = 0; i < totalBatchCount; i++) {
                const batch = this.batches[i];
                if (batch && batch.view && batch.view.vertexCount > 0 && batch.view.indexCount > 0) {
                    this.subMeshes[renderBatchCount] = batch.geometry;
                    this.materials[renderBatchCount] = batch.material;
                    renderBatchCount++;
                }
                else if (batch && batch.geometry) {
                    batch.geometry.clearRenderParams();
                }
            }
            this.subMeshes.length = renderBatchCount;
            this.materials.length = renderBatchCount;
            this._materialIndex = renderBatchCount;
            this.needUpdate = true;
            if (this.autoCacheEnabled && !updater.owner._hasExternalSkin) {
                let frameIndex = updater.cacheFrameIndex;
                let cacheTarget = updater.currentData;
                if (frameIndex >= 0 && !cacheTarget.renderCache[frameIndex]) {
                    let frameCache = this._generateCacheData(totalBatchCount);
                    cacheTarget.renderCache[frameIndex] = frameCache;
                }
            }
        }
        _generateCacheData(totalBatchCount) {
            let renderBlocks = [];
            for (let i = 0; i < totalBatchCount; i++) {
                const batch = this.batches[i];
                if (batch && batch.view && batch.view.vertexCount > 0 && batch.view.indexCount > 0) {
                    let vertexData = batch.view.vertexData;
                    let vertexBufferLength = batch.view.vertexBufferLength;
                    let data = new Float32Array(vertexBufferLength);
                    data.set(vertexData.subarray(0, vertexBufferLength));
                    let localPositions = batch.view.localPositions;
                    for (let vertexIndex = 0, pos = 0, localPos = 0; vertexIndex < batch.view.vertexCount; vertexIndex++, pos += SpineConst.VERTEX_TWOCOLOR, localPos += 2) {
                        data[pos + 6] = localPositions[localPos];
                        data[pos + 7] = localPositions[localPos + 1];
                    }
                    renderBlocks.push({
                        vertexData: data,
                        vertexLength: vertexBufferLength,
                        indexData: new Uint16Array(batch.view.indexData.slice(0, batch.view.indexBufferLength)),
                        indexLength: batch.view.indexBufferLength,
                        vertexCount: batch.view.vertexCount,
                        indexCount: batch.view.indexCount,
                        vertexBufferLength: vertexBufferLength,
                        indexBufferLength: batch.view.indexBufferLength
                    });
                }
            }
            return {
                renderBlocks: renderBlocks,
                materials: this.materials.slice()
            };
        }
        addMaterial(material) {
            if (this._internalMaterials[this._materialIndex] === material) {
                this._materialIndex++;
                return;
            }
            this._internalMaterials[this._materialIndex] = material;
            this._materialIndex++;
            this.needUpdate = true;
        }
        createBatch() {
            this._currentBatchIndex++;
            let batch = this.batches[this._currentBatchIndex];
            let geometry;
            let materialIndex = this._materialIndex - 1;
            let material = materialIndex >= 0 ? this._internalMaterials[materialIndex] : null;
            if (!batch) {
                geometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElement);
                geometry.indexFormat = Laya.IndexFormat.UInt16;
                this.needUpdate = true;
                batch = {
                    geometry: geometry,
                    view: null,
                    material: material,
                    materialIndex: materialIndex
                };
                this.batches[this._currentBatchIndex] = batch;
            }
            else {
                geometry = batch.geometry;
                if (batch.material !== material || batch.materialIndex !== materialIndex) {
                    batch.material = material;
                    batch.materialIndex = materialIndex;
                    this.needUpdate = true;
                }
            }
            let view;
            if (this._viewPool.length > 0) {
                view = this._viewPool.pop();
                view.reset();
            }
            else {
                let initialVertexCapacity = SpineConst.VERTEX_INITIAL_CAPACITY * SpineConst.VERTEX_TWOCOLOR;
                let initialIndexCapacity = SpineConst.VERTEX_INITIAL_CAPACITY * 3;
                view = new SpineBufferView(initialVertexCapacity, initialIndexCapacity);
            }
            view.cacheIndex = null;
            view.geometry = geometry;
            batch.view = view;
            this._allocatedViewsThisFrame[this._allocatedViewCount++] = view;
            this._currentGeometryVertexCount = 0;
            return true;
        }
        appendVerticesClip(vertices, indices, stride, offsetX, offsetY) {
            let verticesLength = vertices.length;
            if (verticesLength == 0)
                return;
            let indicesLength = indices.length;
            let newVertexCount = verticesLength / stride;
            if (this._currentBatchIndex < 0 || this._currentGeometryVertexCount + newVertexCount > 65535) {
                this.createBatch();
            }
            let currentBatch = this.batches[this._currentBatchIndex];
            if (!currentBatch)
                return;
            let currentView = currentBatch.view;
            currentView.ensureVertexCapacity(currentView.vertexBufferLength + verticesLength);
            currentView.ensureIndexCapacity(currentView.indexBufferLength + indicesLength);
            let vertexData = currentView.vertexData;
            let localPositions = currentView.localPositions;
            let indexData = currentView.indexData;
            let vertexOffset = currentView.vertexBufferLength;
            let localPositionOffset = currentView.vertexCount * 2;
            let indexOffset = currentView.indexBufferLength;
            let indexBase = currentView.vertexCount;
            let matrix = this.matrix;
            let a = matrix.a;
            let b = matrix.b;
            let c = matrix.c;
            let d = matrix.d;
            let tx = matrix.tx;
            let ty = matrix.ty;
            for (let j = 0, vlen = vertexOffset, localPos = localPositionOffset; j < verticesLength; vlen += stride, j += stride, localPos += 2) {
                vertexData[vlen] = vertices[j + 6];
                vertexData[vlen + 1] = vertices[j + 7];
                vertexData[vlen + 2] = vertices[j + 2];
                vertexData[vlen + 3] = vertices[j + 3];
                vertexData[vlen + 4] = vertices[j + 4];
                vertexData[vlen + 5] = vertices[j + 5];
                let x = vertices[j] + offsetX;
                let y = vertices[j + 1] + offsetY;
                localPositions[localPos] = x;
                localPositions[localPos + 1] = y;
                vertexData[vlen + 6] = a * x - c * y + tx;
                vertexData[vlen + 7] = b * x - d * y + ty;
                vertexData[vlen + 8] = vertices[j + 8];
                vertexData[vlen + 9] = vertices[j + 9];
                vertexData[vlen + 10] = vertices[j + 10];
                vertexData[vlen + 11] = vertices[j + 11];
            }
            for (let i = 0; i < indicesLength; i++) {
                indexData[indexOffset + i] = indices[i] + indexBase;
            }
            currentView.vertexBufferLength += verticesLength;
            currentView.indexBufferLength += indicesLength;
            currentView.vertexCount += newVertexCount;
            currentView.indexCount += indicesLength;
            this._currentGeometryVertexCount += newVertexCount;
        }
        appendVertices(positions, uvs, finalColor, darkColor, verticesLength, indices, indicesLength, stride, offsetX, offsetY) {
            if (verticesLength == 0)
                return;
            let newVertexCount = verticesLength / stride;
            if (this._currentBatchIndex < 0 || this._currentGeometryVertexCount + newVertexCount > 65535) {
                this.createBatch();
            }
            const currentBatch = this.batches[this._currentBatchIndex];
            if (!currentBatch)
                return;
            let currentView = currentBatch.view;
            currentView.ensureVertexCapacity(currentView.vertexBufferLength + verticesLength);
            currentView.ensureIndexCapacity(currentView.indexBufferLength + indicesLength);
            let vertexData = currentView.vertexData;
            let localPositions = currentView.localPositions;
            let indexData = currentView.indexData;
            let vertexOffset = currentView.vertexBufferLength;
            let localPositionOffset = currentView.vertexCount * 2;
            let indexOffset = currentView.indexBufferLength;
            let indexBase = currentView.vertexCount;
            let matrix = this.matrix;
            let a = matrix.a;
            let b = matrix.b;
            let c = matrix.c;
            let d = matrix.d;
            let tx = matrix.tx;
            let ty = matrix.ty;
            for (let u = 0, v = 0, n = verticesLength, localPos = localPositionOffset; v < n; v += stride, u += 2, localPos += 2) {
                let pos = vertexOffset + v;
                vertexData[pos] = uvs[u];
                vertexData[pos + 1] = uvs[u + 1];
                vertexData[pos + 2] = finalColor.r;
                vertexData[pos + 3] = finalColor.g;
                vertexData[pos + 4] = finalColor.b;
                vertexData[pos + 5] = finalColor.a;
                let x = positions[v] + offsetX;
                let y = positions[v + 1] + offsetY;
                localPositions[localPos] = x;
                localPositions[localPos + 1] = y;
                vertexData[pos + 6] = a * x - c * y + tx;
                vertexData[pos + 7] = b * x - d * y + ty;
                vertexData[pos + 8] = darkColor.r;
                vertexData[pos + 9] = darkColor.g;
                vertexData[pos + 10] = darkColor.b;
                vertexData[pos + 11] = darkColor.a;
            }
            for (let i = 0; i < indicesLength; i++) {
                indexData[indexOffset + i] = indices[i] + indexBase;
            }
            currentView.vertexBufferLength += verticesLength;
            currentView.indexBufferLength += indicesLength;
            currentView.vertexCount += newVertexCount;
            currentView.indexCount += indicesLength;
            this._currentGeometryVertexCount += newVertexCount;
        }
        _bindViewsToBuffers() {
            let manager = SpineGlobalMeshManager.instance;
            for (let i = 0; i <= this._currentBatchIndex; i++) {
                const batch = this.batches[i];
                if (batch && batch.view) {
                    if (batch.view.vertexCount > 0 && batch.view.indexCount > 0) {
                        manager.assignViewToBuffer(batch.view, batch.view.vertexCount);
                        batch.geometry.bufferState = manager.outBufferState;
                    }
                    else {
                        batch.geometry.clearRenderParams();
                    }
                }
            }
        }
        getViewForGeometry(geometry) {
            for (let i = 0; i <= this._currentBatchIndex; i++) {
                const batch = this.batches[i];
                if (batch && batch.geometry === geometry) {
                    return batch.view;
                }
            }
            return undefined;
        }
        destroy() {
            for (let i = 0; i < this._allocatedViewCount; i++) {
                this._allocatedViewsThisFrame[i].reset();
            }
            this.batches.forEach(batch => {
                if (batch && batch.geometry) {
                    batch.geometry.destroy();
                }
            });
            this.batches.length = 0;
            this.subMeshes.length = 0;
            this._internalMaterials.length = 0;
            this._materialTextures.length = 0;
            this._materialBlendModes.length = 0;
            this._allocatedViewsThisFrame.length = 0;
            this._allocatedViewCount = 0;
            this._allocatedViewsThisFrame = null;
            this._viewPool = null;
        }
        restoreFromCache(cache, offsetX = 0, offsetY = 0) {
            if (!cache)
                return;
            for (let i = 0; i < this._allocatedViewCount; i++) {
                let view = this._allocatedViewsThisFrame[i];
                view.reset();
                this._viewPool.push(view);
            }
            this._allocatedViewCount = 0;
            this.materials.length = cache.materials.length;
            for (let i = 0; i < cache.materials.length; i++) {
                this.materials[i] = cache.materials[i];
            }
            this._currentBatchIndex = -1;
            for (let i = 0; i < cache.renderBlocks.length; i++) {
                const renderBlock = cache.renderBlocks[i];
                const vertexBufferLength = renderBlock.vertexBufferLength;
                const indexBufferLength = renderBlock.indexBufferLength;
                this._currentBatchIndex++;
                let existingBatch = this.batches[this._currentBatchIndex];
                let geometry;
                if (existingBatch && existingBatch.geometry) {
                    geometry = existingBatch.geometry;
                }
                else {
                    geometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElement);
                    geometry.indexFormat = Laya.IndexFormat.UInt16;
                    this.needUpdate = true;
                }
                let view;
                if (this._viewPool.length > 0) {
                    view = this._viewPool.pop();
                    view.reset();
                }
                else {
                    view = new SpineBufferView(renderBlock.vertexData.length, renderBlock.indexData.length);
                }
                view.ensureVertexCapacity(vertexBufferLength);
                view.ensureIndexCapacity(indexBufferLength);
                view.vertexData.set(renderBlock.vertexData.subarray(0, vertexBufferLength), 0);
                view.cacheIndex = renderBlock.indexData;
                view.vertexBufferLength = vertexBufferLength;
                view.indexBufferLength = indexBufferLength;
                view.vertexCount = renderBlock.vertexCount;
                view.indexCount = renderBlock.indexCount;
                view.geometry = geometry;
                let matrix = this.matrix;
                let a = matrix.a;
                let b = matrix.b;
                let c = matrix.c;
                let d = matrix.d;
                let tx = matrix.tx;
                let ty = matrix.ty;
                let vertexData = view.vertexData;
                let localPositions = view.localPositions;
                for (let vertexIndex = 0, pos = 0, localPos = 0; vertexIndex < view.vertexCount; vertexIndex++, pos += SpineConst.VERTEX_TWOCOLOR, localPos += 2) {
                    let x = vertexData[pos + 6];
                    let y = vertexData[pos + 7];
                    localPositions[localPos] = x;
                    localPositions[localPos + 1] = y;
                    vertexData[pos + 6] = a * x - c * y + tx;
                    vertexData[pos + 7] = b * x - d * y + ty;
                }
                const materialIndex = i < cache.materials.length ? i : cache.materials.length - 1;
                const material = cache.materials[materialIndex] || null;
                let batch = existingBatch;
                if (batch) {
                    batch.geometry = geometry;
                    batch.view = view;
                    batch.material = material;
                    batch.materialIndex = materialIndex;
                }
                else {
                    batch = {
                        geometry: geometry,
                        view: view,
                        material: material,
                        materialIndex: materialIndex
                    };
                    this.batches[this._currentBatchIndex] = batch;
                }
                this._allocatedViewsThisFrame[this._allocatedViewCount++] = view;
            }
            this._bindViewsToBuffers();
            const totalBatchCount = this._currentBatchIndex + 1;
            let renderBatchCount = 0;
            for (let i = 0; i < totalBatchCount; i++) {
                const batch = this.batches[i];
                if (batch && batch.view && batch.view.vertexCount > 0 && batch.view.indexCount > 0) {
                    this.subMeshes[renderBatchCount] = batch.geometry;
                    this.materials[renderBatchCount] = batch.material;
                    renderBatchCount++;
                }
                else if (batch && batch.geometry) {
                    batch.geometry.clearRenderParams();
                }
            }
            this.subMeshes.length = renderBatchCount;
            this.materials.length = renderBatchCount;
            this.needUpdate = true;
        }
    }

    class SpineOptimizeRender2D extends BaseOptimizeRender {
        static createRenderElement2D() {
            let element;
            if (this._pool.length > 0) {
                element = this._pool.pop();
            }
            else {
                element = Laya.LayaGL.render2DRenderPassFactory.createRenderElement2D();
            }
            element.renderStateIsBySprite = false;
            element.nodeCommonMap = SpineOptimizeRender2D._NODE_COMMONMAP_;
            return element;
        }
        static recoverRenderElement2D(value) {
            if (!value.canotPool) {
                value.materialShaderData = null;
                value.geometry = null;
                value.subShader = null;
                value.owner = null;
                if (this._pool.length < this._maxPoolSize) {
                    this._pool.push(value);
                }
                else {
                    value.destroy();
                }
            }
        }
        constructor(owner) {
            super();
            this.is3D = false;
            this._renderElements = [];
            this._owner = owner;
            this._handle = this._owner._getRenderHandle();
            this._handle.baseColor = this.spineColor;
        }
        init(templet) {
            super.init(templet);
            this._handle.skeleton = this._skeleton;
        }
        _createRenderProxies() {
            let shaderData = this._owner._struct.spriteShaderData;
            let renderOptimize = new OptimizedSpineRenderer(shaderData);
            let renderRigidBody = new RigidBodySpineRenderer(shaderData);
            if (SpineConst.ENABLE_WEB_BATCH) {
                let renderNormal = new StandardSpine2DRenderer(this._owner._struct);
                renderNormal.normalUpdater = new Spine2DNormalRenderUpdater;
                renderNormal.normalUpdater.autoCacheEnabled = this._enableCache;
                this._handle.bindNormalRender(renderNormal);
                this.renderProxyMap.set(exports.ERenderProxyType.RenderNormal, renderNormal);
            }
            else {
                let renderNormal = new StandardSpineRenderer(shaderData);
                renderNormal.normalUpdater = new SpineNormalRenderUpdater;
                renderNormal.normalUpdater.autoCacheEnabled = this._enableCache;
                this.renderProxyMap.set(exports.ERenderProxyType.RenderNormal, renderNormal);
            }
            this.renderProxyMap.set(exports.ERenderProxyType.RenderOptimize, renderOptimize);
            this.renderProxyMap.set(exports.ERenderProxyType.RenderRigidBody, renderRigidBody);
        }
        _createBakedRenderer() {
            return new BakedSpine2DRenderer(this._owner._struct);
        }
        _updateSkinShaderDefines() {
            if (this._skinAttach.twoColorTint) {
                this._owner._spriteShaderData.addDefine(SpineShaderInit.SPINE_COLOR2);
            }
            else {
                this._owner._spriteShaderData.removeDefine(SpineShaderInit.SPINE_COLOR2);
            }
        }
        changeSkeleton(skeleton) {
            super.changeSkeleton(skeleton);
            this._handle.skeleton = skeleton;
        }
        reset() {
            const handle = this._handle;
            handle.skeleton = null;
            handle.bindNormalRender(null);
            handle.needUseMatrix = true;
            super.reset();
        }
        _updateRenderElements(subMeshes, materials) {
            if (!this._owner || !this._owner._struct) {
                return;
            }
            const struct = this._owner._struct;
            const shaderData = this._owner._spriteShaderData;
            this._updateRenderElementsFromData(struct, shaderData, subMeshes, materials);
        }
        _updateRenderElementsFromData(struct, shaderData, subMeshes, materials) {
            if (!subMeshes || !materials || subMeshes.length === 0 || materials.length === 0) {
                this._clearRenderElements();
                return;
            }
            const subMeshCount = subMeshes.length;
            const materialCount = materials.length;
            const targetCount = Math.max(subMeshCount, materialCount);
            let need = !SpineConst.ENABLE_WEB_BATCH && subMeshCount != this._renderElements.length ? true : false;
            for (let i = 0; i < targetCount; i++) {
                let element = this._renderElements[i];
                const subMesh = subMeshes[i];
                const material = materials[i];
                if (subMesh && material) {
                    let needUpdate = false;
                    if (!element) {
                        element = SpineOptimizeRender2D.createRenderElement2D();
                        this._renderElements[i] = element;
                        needUpdate = true;
                    }
                    else {
                        if (element.geometry !== subMesh ||
                            element.materialShaderData !== material.shaderData ||
                            element.value2DShaderData !== shaderData ||
                            element.owner !== struct) {
                            needUpdate = true;
                        }
                    }
                    if (needUpdate) {
                        element.geometry = subMesh;
                        element.materialShaderData = material.shaderData;
                        element.subShader = material._shader.getSubShaderAt(0);
                        element.value2DShaderData = shaderData;
                        element.owner = struct;
                        element._index = i;
                        need = true;
                    }
                }
                else {
                    if (element) {
                        SpineOptimizeRender2D.recoverRenderElement2D(element);
                    }
                }
            }
            this._renderElements.length = subMeshCount;
            if (need) {
                struct.renderElements = this._renderElements;
            }
        }
        _clearRenderElements() {
            for (let i = 0, len = this._renderElements.length; i < len; i++) {
                const element = this._renderElements[i];
                if (element) {
                    SpineOptimizeRender2D.recoverRenderElement2D(element);
                }
            }
            this._renderElements.length = 0;
            if (this._owner && this._owner._struct) {
                this._owner._struct.renderElements = SpineOptimizeRender2D._emptyList;
            }
        }
        _getMaterialByName(name, blendMode) {
            return this._templet.getMaterial(this._templet.getTexture(name), blendMode, this._premultipliedAlpha, false);
        }
        _getMaterial(texture, blendMode) {
            return this._templet.getMaterial(texture, blendMode, this._premultipliedAlpha, false);
        }
        _getRenderHandle() {
            return this._handle;
        }
    }
    SpineOptimizeRender2D._emptyList = [];
    SpineOptimizeRender2D._NODE_COMMONMAP_ = ["BaseRender2D", "Spine2D"];
    SpineOptimizeRender2D._pool = [];
    SpineOptimizeRender2D._maxPoolSize = 64;

    const _setRenderColor = new Laya.Color(1, 1, 1, 1);
    class WebSpineRenderDataHandle {
        constructor() {
            this._nMatrix_0 = new Laya.Vector3();
            this._nMatrix_1 = new Laya.Vector3();
            this._needUseMatrix = true;
            this._lightReceive = false;
            this._renderAlpha = -1;
            this._baseColor = new Laya.Color(1, 1, 1, 1);
            this._renderMatrixVersion = -1;
            this._normalRender = null;
        }
        get needUseMatrix() {
            return this._needUseMatrix;
        }
        set needUseMatrix(value) {
            var _a;
            if (this._needUseMatrix === value)
                return;
            this._needUseMatrix = value;
            this._renderMatrixVersion = -1;
            if (!value && ((_a = this._owner) === null || _a === void 0 ? void 0 : _a.spriteShaderData)) {
                this._nMatrix_0.set(1, 0, 0);
                this._nMatrix_1.set(0, 1, 0);
                this._owner.spriteShaderData.setVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_0, this._nMatrix_0);
                this._owner.spriteShaderData.setVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_1, this._nMatrix_1);
            }
        }
        get lightReceive() {
            return this._lightReceive;
        }
        set lightReceive(value) {
            if (this._lightReceive === value)
                return;
            this._lightReceive = value;
            if (value)
                this._owner.spriteShaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
            else
                this._owner.spriteShaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
        }
        bindNormalRender(value) {
            this._normalRender = value;
            this._renderMatrixVersion = -1;
        }
        get renderMatrixVersion() {
            return this._renderMatrixVersion;
        }
        set renderMatrixVersion(value) {
            this._renderMatrixVersion = value;
        }
        get normalUpdater() {
            var _a;
            return (_a = this._normalRender) === null || _a === void 0 ? void 0 : _a.normalUpdater;
        }
        get baseColor() {
            return this._baseColor;
        }
        set baseColor(value) {
            if (value !== this._baseColor && this._baseColor.equal(value))
                return;
            value = value || Laya.Color.BLACK;
            value.cloneTo(this._baseColor);
            this._renderAlpha = -1;
            this._owner.spriteShaderData.setColor(Laya.BaseRenderNode2D.BASERENDER2DCOLOR, this._baseColor);
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            if (value === this._owner)
                return;
            if (this._owner && this._owner.spriteShaderData) {
                let shaderData = this._owner.spriteShaderData;
                shaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_BASERENDER2D);
                shaderData.removeDefine(SpineShaderInit.SPINE_UV);
                shaderData.removeDefine(SpineShaderInit.SPINE_COLOR);
                shaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
            }
            this._owner = value;
            this._renderMatrixVersion = -1;
            if (this._owner) {
                let shaderData = this._owner.spriteShaderData;
                shaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_BASERENDER2D);
                shaderData.addDefine(SpineShaderInit.SPINE_UV);
                shaderData.addDefine(SpineShaderInit.SPINE_COLOR);
                if (this._lightReceive)
                    shaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
            }
        }
        get offset() {
            return this._offset;
        }
        set offset(value) {
            this._offset = value;
            this._renderMatrixVersion = -1;
        }
        inheriteRenderData(context) {
            var _a;
            if (!this._owner || !this._owner.spriteShaderData || !this.skeleton)
                return;
            let matrixVersion = this._owner.getRenderMatrixVersion();
            if (matrixVersion < 0 || this._renderMatrixVersion !== matrixVersion) {
                let shaderData = this._owner.spriteShaderData;
                let mat = this._owner.renderMatrix;
                if (this._needUseMatrix) {
                    this._renderMatrixVersion = matrixVersion;
                    if (this._offset) {
                        let ofx = this._offset.x;
                        let ofy = this._offset.y;
                        this._nMatrix_0.setValue(mat.a, mat.c, mat.tx + mat.a * ofx + mat.c * ofy);
                        this._nMatrix_1.setValue(mat.b, mat.d, mat.ty + mat.b * ofx + mat.d * ofy);
                    }
                    else {
                        this._nMatrix_0.setValue(mat.a, mat.c, mat.tx);
                        this._nMatrix_1.setValue(mat.b, mat.d, mat.ty);
                    }
                    shaderData.setVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_0, this._nMatrix_0);
                    shaderData.setVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_1, this._nMatrix_1);
                }
                else {
                    (_a = this._normalRender) === null || _a === void 0 ? void 0 : _a.updateRenderMatrix(mat, this._offset, true);
                }
            }
            if (this._renderAlpha !== this._owner.globalAlpha) {
                let alpha = this._owner.globalAlpha * this._baseColor.a;
                _setRenderColor.setValue(this._baseColor.r, this._baseColor.g, this._baseColor.b, alpha);
                this._owner.spriteShaderData.setColor(Laya.BaseRenderNode2D.BASERENDER2DCOLOR, _setRenderColor);
                this._renderAlpha = this._owner.globalAlpha;
            }
        }
        destroy() {
            this._normalRender = null;
            this.skeleton = null;
            this.owner = null;
        }
    }

    class SpineOptimizeRender3D extends BaseOptimizeRender {
        static createRenderElement3D() {
            let element;
            if (this._pool.length > 0) {
                element = this._pool.pop();
            }
            else {
                element = Laya.Laya3DRender.Render3DPassFactory.createRenderElement3D();
                element.isRender = true;
            }
            return element;
        }
        static recoverRenderElement3D(value) {
            if (!value.canotPool) {
                value.materialShaderData = null;
                value.geometry = null;
                value.subShader = null;
                value.owner = null;
                this._pool.push(value);
            }
        }
        constructor(owner) {
            super();
            this.is3D = true;
            this._renderElements = [];
            this._owner = owner;
        }
        _createRenderProxies() {
            let shaderData = this._owner.shaderData;
            let renderOptimize = new OptimizedSpineRenderer(shaderData);
            let renderNormal = new StandardSpineRenderer(shaderData);
            renderNormal.normalUpdater = new SpineNormalRenderUpdater;
            renderNormal.normalUpdater.autoCacheEnabled = this._enableCache;
            let renderRigidBody = new RigidBodySpineRenderer(shaderData);
            this.renderProxyMap.set(exports.ERenderProxyType.RenderNormal, renderNormal);
            this.renderProxyMap.set(exports.ERenderProxyType.RenderOptimize, renderOptimize);
            this.renderProxyMap.set(exports.ERenderProxyType.RenderRigidBody, renderRigidBody);
        }
        _createBakedRenderer() {
            return new BakedSpineRenderer(this._owner.shaderData);
        }
        _updateSkinShaderDefines() {
            if (this._skinAttach.twoColorTint) {
                this._owner.shaderData.addDefine(SpineShaderInit.SPINE_COLOR2);
            }
            else {
                this._owner.shaderData.removeDefine(SpineShaderInit.SPINE_COLOR2);
            }
        }
        _updateRenderElements(subMeshes, materials) {
            if (!this._owner) {
                return;
            }
            const shaderData = this._owner.shaderData;
            this._updateRenderElementsFromData(shaderData, subMeshes, materials);
        }
        _updateRenderElementsFromData(shaderData, subMeshes, materials) {
            if (!subMeshes || !materials || subMeshes.length === 0 || materials.length === 0) {
                this._clearRenderElements();
                return;
            }
            const subMeshCount = subMeshes.length;
            const materialCount = materials.length;
            const targetCount = Math.max(subMeshCount, materialCount);
            let need = !SpineConst.ENABLE_WEB_BATCH && subMeshCount != this._renderElements.length ? true : false;
            for (let i = 0; i < targetCount; i++) {
                let element = this._renderElements[i];
                const subMesh = subMeshes[i];
                const material = materials[i];
                if (subMesh && material) {
                    let needUpdate = false;
                    if (!element) {
                        element = SpineOptimizeRender3D.createRenderElement3D();
                        this._renderElements[i] = element;
                        needUpdate = true;
                    }
                    else {
                        if (element.geometry !== subMesh ||
                            element.materialShaderData !== material.shaderData ||
                            element.renderShaderData !== shaderData ||
                            element.owner !== this._owner) {
                            needUpdate = true;
                        }
                    }
                    if (needUpdate) {
                        element.geometry = subMesh;
                        element.materialShaderData = material.shaderData;
                        element.subShader = material._shader.getSubShaderAt(0);
                        element.renderShaderData = shaderData;
                        element.owner = this._owner;
                        element.materialRenderQueue = material.renderQueue;
                        need = true;
                    }
                }
                else {
                    if (element) {
                        SpineOptimizeRender3D.recoverRenderElement3D(element);
                    }
                }
            }
            this._renderElements.length = subMeshCount;
            if (need) {
                this._owner.setRenderelements(this._renderElements);
            }
        }
        _clearRenderElements() {
            for (let i = 0, len = this._renderElements.length; i < len; i++) {
                const element = this._renderElements[i];
                if (element) {
                    SpineOptimizeRender3D.recoverRenderElement3D(element);
                }
            }
            this._renderElements.length = 0;
            if (this._owner) {
                this._owner.setRenderelements(SpineOptimizeRender3D._emptyList);
            }
        }
        _getMaterialByName(name, blendMode) {
            return this._templet.getMaterial(this._templet.getTexture(name), blendMode, this._premultipliedAlpha, true);
        }
        _getMaterial(texture, blendMode) {
            return this._templet.getMaterial(texture, blendMode, this._premultipliedAlpha, true);
        }
    }
    SpineOptimizeRender3D._emptyList = [];
    SpineOptimizeRender3D._pool = [];

    const QUAD_TRIANGLES = [0, 1, 2, 2, 3, 0];
    class AttachmentParse {
        constructor() {
            this.vertexCount = 0;
            this.indexCount = 0;
            this.isNormalRender = false;
            this.vertexBones = 0;
            this.bones = new Set();
        }
        init(attachment, boneIndex, slotId, deform, slot) {
            this.slotId = slotId;
            this.sourceData = attachment;
            this.attachment = attachment.name;
            this.boneIndex = boneIndex;
            let slotColor = slot.color;
            this.blendMode = slot.blendMode;
            let color = this.color = new Laya.Color();
            let attchmentColor;
            let darkColor = slot.darkColor;
            if (attachment instanceof spine.RegionAttachment) {
                attchmentColor = attachment.color;
                let region = attachment;
                this.vertexArray = region.offset;
                this.stride = 2;
                this.indexArray = QUAD_TRIANGLES;
                this.uvs = region.uvs;
                if (region.region) {
                    this.textureName = region.region.page.name;
                }
                this.vertexBones = 1;
                this.bones.add(boneIndex);
            }
            else if (attachment instanceof spine.MeshAttachment) {
                attchmentColor = attachment.color;
                let vside = SpineConst.VERTEX_BONE;
                let mesh = attachment;
                this.textureName = mesh.region.page.name;
                if (!mesh.bones || mesh.bones.length == 0) {
                    if (deform && deform.length > 1) {
                        this.vertexArray = new Float32Array(deform);
                    }
                    else {
                        this.vertexArray = mesh.vertices;
                    }
                    this.stride = 2;
                    this.indexArray = mesh.triangles;
                    this.uvs = mesh.uvs;
                    this.bones.add(boneIndex);
                }
                else {
                    if (deform && deform.length > 1) {
                        debugger;
                    }
                    this.stride = vside - 6;
                    let vertexSize = mesh.uvs.length / 2;
                    let vertexArray = this.vertexArray = new Float32Array(vertexSize * this.stride);
                    this.indexArray = mesh.triangles;
                    this.uvs = mesh.uvs;
                    let vertices = mesh.vertices;
                    let bones = mesh.bones;
                    let v = 0;
                    let needPoint = (vside - 6) / 4;
                    this.vertexBones = needPoint;
                    for (let w = 0, b = 0; w < vertexSize; w++) {
                        let n = bones[v++];
                        n += v;
                        let result = [];
                        let offset = w * this.stride;
                        let nid = 0;
                        for (; v < n; v++, b += 3, nid++) {
                            let boneIndex = bones[v];
                            result.push([vertices[b], vertices[b + 1], vertices[b + 2], boneIndex]);
                            this.bones.add(boneIndex);
                        }
                        if (result.length > needPoint) {
                            this.vertexBones = Math.max(this.vertexBones, result.length);
                            result.length = needPoint;
                            this.isNormalRender = true;
                        }
                        for (let i = 0; i < needPoint; i++) {
                            let v = result[i];
                            if (!v)
                                continue;
                            vertexArray[offset + i * 4] = v[0];
                            vertexArray[offset + i * 4 + 1] = v[1];
                            vertexArray[offset + i * 4 + 2] = v[2];
                            vertexArray[offset + i * 4 + 3] = v[3];
                        }
                    }
                }
            }
            else if (attachment instanceof spine.ClippingAttachment) {
                this.attachment = null;
                this.isClip = true;
            }
            else if (attachment instanceof spine.PathAttachment) {
                this.attachment = attachment.name;
                this.vertexArray = new Float32Array(attachment.vertices);
                this.isPath = true;
            }
            else {
                this.attachment = null;
            }
            if (this.textureName) {
                this.vertexCount = this.vertexArray.length / this.stride;
                this.indexCount = this.indexArray.length;
            }
            if (attchmentColor) {
                this.lightColor = attchmentColor;
                color.r = slotColor.r * attchmentColor.r;
                color.g = slotColor.g * attchmentColor.g;
                color.b = slotColor.b * attchmentColor.b;
                color.a = slotColor.a * attchmentColor.a;
            }
            this.darkColor = darkColor;
            return true;
        }
    }

    class MultiRenderData {
        constructor() {
            this.renderData = [];
            this.id = MultiRenderData.ID++;
        }
        addData(textureName, blendMode, offset, length, attachment) {
            this.currentData = { textureName: textureName, blendMode, offset, length, attachment };
            this.renderData.push(this.currentData);
        }
        endData(length) {
            this.currentData.length = length - this.currentData.offset;
        }
    }
    MultiRenderData.ID = 0;

    class IBCreator {
        constructor() {
            this.ibLength = 0;
            this.maxIndexCount = 0;
        }
        updateFormat(vertexCount) {
            let ntype = SpineShaderInit.getIndexFormat(vertexCount);
            if (this.type === ntype)
                return;
            this.type = ntype;
            this._updateBuffer();
        }
        setBufferLength(maxIndexCount) {
            if (maxIndexCount <= this.maxIndexCount)
                return;
            this.maxIndexCount = maxIndexCount;
            this._updateBuffer();
        }
        _updateBuffer() {
            let oldbuffer = this.ib;
            switch (this.type) {
                case Laya.IndexFormat.UInt16:
                    this.size = 2;
                    this.ib = new Uint16Array(this.maxIndexCount);
                    break;
                case Laya.IndexFormat.UInt8:
                    this.size = 1;
                    this.ib = new Uint8Array(this.maxIndexCount);
                    break;
                case Laya.IndexFormat.UInt32:
                    this.size = 4;
                    this.ib = new Uint32Array(this.maxIndexCount);
                    break;
            }
            if (oldbuffer)
                this.ib.set(oldbuffer);
        }
        createIB(attachs, vbCreator, order) {
            let offset = 0;
            let slotVBMap = vbCreator.slotVBMap;
            let drawOrder;
            let getAttach;
            if (order) {
                drawOrder = order;
                getAttach = function (value) {
                    return attachs[value];
                };
            }
            else {
                drawOrder = attachs;
                getAttach = function (value) {
                    return value;
                };
            }
            let outRenderData = new MultiRenderData();
            let texture;
            let blend;
            let uploadData = [];
            let end = -1;
            for (let i = 0, n = drawOrder.length; i < n; i++) {
                let attach = getAttach(drawOrder[i]);
                if (attach.attachment && !attach.isPath) {
                    let needAdd = false;
                    if (texture != attach.textureName) {
                        texture = attach.textureName;
                        needAdd = true;
                    }
                    if (blend != attach.blendMode) {
                        blend = attach.blendMode;
                        needAdd = true;
                    }
                    if (needAdd) {
                        if (outRenderData.currentData) {
                            outRenderData.endData(offset);
                        }
                        outRenderData.addData(attach.textureName, attach.blendMode, offset, 0, attach.attachment);
                    }
                    let attachPos = slotVBMap.get(attach.slotId).get(attach.attachment);
                    if (attach.attachment && attach.indexArray) {
                        uploadData.push({
                            data: attach.indexArray,
                            offset: attachPos.offset,
                            start: offset
                        });
                        offset += attach.indexArray.length;
                        end = Math.max(end, offset);
                    }
                }
            }
            let vertexCount = vbCreator.maxVertexCount;
            let ntype = SpineShaderInit.getIndexFormat(vertexCount);
            let needUpdateBuffer = false;
            if (ntype !== this.type) {
                this.type = ntype;
                needUpdateBuffer = true;
            }
            if (end > this.maxIndexCount) {
                this.maxIndexCount = end;
                needUpdateBuffer = true;
            }
            needUpdateBuffer && this._updateBuffer();
            let ib = this.ib;
            for (let i = 0, len = uploadData.length; i < len; i++) {
                let upload = uploadData[i];
                let offset = upload.offset;
                let start = upload.start;
                for (let j = 0, n = upload.data.length; j < n; j++) {
                    ib[start + j] = upload.data[j] + offset;
                }
            }
            if (texture) {
                outRenderData.endData(offset);
            }
            this.outRenderData = outRenderData;
            this.ibLength = offset;
        }
    }

    class SpineBoneRegistry {
        constructor() {
            this._nextBoneId = 0;
            this._boneIndexToId = new Map();
            this._boneIdIndexPairs = [];
        }
        getOrRegisterBoneId(boneIndex) {
            let boneId = this._boneIndexToId.get(boneIndex);
            if (boneId === undefined) {
                boneId = this._nextBoneId;
                this._boneIndexToId.set(boneIndex, boneId);
                this._boneIdIndexPairs.push(boneId, boneIndex);
                this._nextBoneId++;
            }
            return boneId;
        }
        getBoneId(boneIndex) {
            return this._boneIndexToId.get(boneIndex);
        }
        get boneCount() {
            return this._nextBoneId;
        }
        get boneIdIndexPairs() {
            return this._boneIdIndexPairs;
        }
        get boneIndexToIdMap() {
            return this._boneIndexToId;
        }
        clear() {
            this._nextBoneId = 0;
            this._boneIndexToId.clear();
            this._boneIdIndexPairs.length = 0;
        }
    }
    class VBCreator {
        constructor(vertexFlag, maxVertexCount = 0, auto = true, boneRegistry) {
            this._vertexSize = 0;
            this._baseVtxCount = 6;
            this._boneVtxCount = 4;
            this.twoColorTint = false;
            this.maxVertexCount = maxVertexCount;
            this.vertexFlag = vertexFlag;
            this.boneRegistry = boneRegistry || new SpineBoneRegistry();
            this.localBoneIndexToId = new Map();
            this.localBoneIdIndexPairs = [];
            this.slotVBMap = new Map();
            this.vbLength = 0;
            if (auto) {
                this._vertexDeclaration = SpineShaderInit.getVertexDeclaration(this.vertexFlag);
                this.twoColorTint = vertexFlag.indexOf("COLOR2") != -1;
                if (this.twoColorTint)
                    this._baseVtxCount += 4;
                this._vertexSize = this._vertexDeclaration.vertexStride / 4;
                this._boneVtxCount = this._vertexSize - this._baseVtxCount;
                this._updateBuffer();
            }
        }
        setBufferLength(maxVertexCount) {
            if (maxVertexCount <= this.maxVertexCount)
                return;
            this.maxVertexCount = maxVertexCount;
            this._updateBuffer();
        }
        _updateBuffer() {
            let oldbuffer = this.vb;
            this.vb = new Float32Array(this.maxVertexCount * this.vertexSize);
            if (oldbuffer)
                this.vb.set(oldbuffer);
        }
        get vertexSize() {
            return this._vertexSize;
        }
        get vertexDeclaration() {
            return this._vertexDeclaration;
        }
        appendAndCreateIB(attach) {
            this.appendVB(attach);
        }
        getBoneId(boneIndex) {
            let id = this.localBoneIndexToId.get(boneIndex);
            if (id !== undefined) {
                return id;
            }
            id = this.boneRegistry.getOrRegisterBoneId(boneIndex);
            this.localBoneIndexToId.set(boneIndex, id);
            this.localBoneIdIndexPairs.push(id, boneIndex);
            return id;
        }
        appendVB(attach) {
            let offset;
            let map = this.slotVBMap.get(attach.slotId);
            if (map) {
                let offset = map.get(attach.attachment);
                if (offset != undefined) {
                    return offset;
                }
            }
            else {
                map = new Map();
                this.slotVBMap.set(attach.slotId, map);
            }
            offset = this.vbLength / this.vertexSize;
            map.set(attach.attachment, { offset: offset, attachment: attach });
            if (!attach.vertexCount)
                return offset;
            if (offset + attach.vertexCount >= this.maxVertexCount) {
                this.setBufferLength(offset + attach.vertexCount);
            }
            this.vbLength = this.appendVertexArray(attach, this.vb, this.vbLength, this);
            return offset;
        }
        resetVB(attach) {
            var _a;
            if (attach.isPath) {
                return;
            }
            let pos = (_a = this.slotVBMap.get(attach.slotId)) === null || _a === void 0 ? void 0 : _a.get(attach.attachment);
            if (pos) {
                this.appendVertexArray(attach, this.vb, pos.offset * this.vertexSize, this);
            }
        }
        _cloneTo(target) {
            target.vb = new Float32Array(this.vb);
            target.vbLength = this.vbLength;
            target.boneRegistry = this.boneRegistry;
            target.localBoneIndexToId = new Map(this.localBoneIndexToId);
            target.localBoneIdIndexPairs = this.localBoneIdIndexPairs.slice();
            target._vertexDeclaration = this._vertexDeclaration;
            target._vertexSize = this._vertexSize;
            target.twoColorTint = this.twoColorTint;
            target._baseVtxCount = this._baseVtxCount;
            target._boneVtxCount = this._boneVtxCount;
            target.vertexFlag = this.vertexFlag;
            this.slotVBMap.forEach((value, key) => {
                target.slotVBMap.set(key, new Map(value));
            });
        }
        clone() {
            let rs = this._create();
            this._cloneTo(rs);
            return rs;
        }
    }
    class VBBoneCreator extends VBCreator {
        _create() {
            return new VBBoneCreator(this.vertexFlag, this.maxVertexCount, false, this.boneRegistry);
        }
        appendVertexArray(attachmentParse, vertexArray, offset, creator) {
            if (!attachmentParse.attachment) {
                creator.getBoneId(attachmentParse.boneIndex);
                return offset;
            }
            let vside = this.vertexSize;
            let slotVertex = attachmentParse.vertexArray;
            let uvs = attachmentParse.uvs;
            let color = attachmentParse.color;
            let c1r = color.r, c1g = color.g, c1b = color.b, c1a = color.a;
            let boneNum = this._boneVtxCount / 4;
            let color2 = attachmentParse.darkColor;
            let c2r = 0, c2g = 0, c2b = 0, c2a = 1;
            if (color2) {
                c2r = color2.r;
                c2g = color2.g;
                c2b = color2.b;
                c2a = color2.a;
            }
            if (attachmentParse.stride == 2) {
                let boneid = creator.getBoneId(attachmentParse.boneIndex);
                for (let j = 0, n = slotVertex.length; j < n; j += attachmentParse.stride) {
                    vertexArray[offset] = uvs[j];
                    vertexArray[offset + 1] = uvs[j + 1];
                    vertexArray[offset + 2] = c1r;
                    vertexArray[offset + 3] = c1g;
                    vertexArray[offset + 4] = c1b;
                    vertexArray[offset + 5] = c1a;
                    vertexArray[offset + 6] = slotVertex[j];
                    vertexArray[offset + 7] = slotVertex[j + 1];
                    vertexArray[offset + 8] = 1;
                    vertexArray[offset + 9] = boneid;
                    let ox = offset + 10;
                    for (let z = 0, len = boneNum - 1; z < len; z++) {
                        let vOffset = ox + z * 4;
                        vertexArray[vOffset] = 0;
                        vertexArray[vOffset + 1] = 0;
                        vertexArray[vOffset + 2] = 0;
                        vertexArray[vOffset + 3] = 0;
                    }
                    if (this.twoColorTint) {
                        let tColorOffset = offset + 6 + this._boneVtxCount;
                        vertexArray[tColorOffset] = c2r;
                        vertexArray[tColorOffset + 1] = c2g;
                        vertexArray[tColorOffset + 2] = c2b;
                        vertexArray[tColorOffset + 3] = c2a;
                    }
                    offset += vside;
                }
            }
            else {
                for (let j = 0, uvid = 0, n = slotVertex.length; j < n; j += attachmentParse.stride, uvid += 2) {
                    vertexArray[offset] = uvs[uvid];
                    vertexArray[offset + 1] = uvs[uvid + 1];
                    vertexArray[offset + 2] = c1r;
                    vertexArray[offset + 3] = c1g;
                    vertexArray[offset + 4] = c1b;
                    vertexArray[offset + 5] = c1a;
                    let ox = offset + 6;
                    for (let z = 0; z < boneNum; z++) {
                        let vOffset = ox + z * 4;
                        let oOffset = j + z * 4;
                        vertexArray[vOffset] = slotVertex[oOffset];
                        vertexArray[vOffset + 1] = slotVertex[oOffset + 1];
                        vertexArray[vOffset + 2] = slotVertex[oOffset + 2];
                        vertexArray[vOffset + 3] = creator.getBoneId(slotVertex[oOffset + 3]);
                    }
                    if (this.twoColorTint) {
                        let tColorOffset = ox + this._boneVtxCount;
                        vertexArray[tColorOffset] = c2r;
                        vertexArray[tColorOffset + 1] = c2g;
                        vertexArray[tColorOffset + 2] = c2b;
                        vertexArray[tColorOffset + 3] = c2a;
                    }
                    offset += vside;
                }
            }
            return offset;
        }
        appendDeform(attachmentParse, deform, offset, out) {
            if (!attachmentParse.attachment) {
                return;
            }
            let vside = this.vertexSize;
            let slotVertex = attachmentParse.vertexArray;
            if (attachmentParse.stride == 2) {
                for (let j = 0, n = slotVertex.length; j < n; j += attachmentParse.stride) {
                    out[offset + 6] = deform[j];
                    out[offset + 7] = deform[j + 1];
                    offset += vside;
                }
            }
            else {
                let attchment = attachmentParse.sourceData;
                let bones = attchment.bones;
                let vertexCount = attachmentParse.vertexCount;
                let boneNum = this._boneVtxCount / 4;
                let f = 0, v = 0;
                for (let w = 0; w < vertexCount; w++) {
                    let len = bones[v++];
                    let slotOffset = w * this._boneVtxCount;
                    let vertexOffset = offset + w * vside + 6;
                    for (let i = 0; i < len; i++) {
                        if (i >= boneNum)
                            break;
                        let deformOffset = f + i * 2;
                        let slotIndex = slotOffset + i * 4;
                        let boneOffset = vertexOffset + i * 4;
                        out[boneOffset] = slotVertex[slotIndex] + deform[deformOffset];
                        out[boneOffset + 1] = slotVertex[slotIndex + 1] + deform[deformOffset + 1];
                    }
                    v += len;
                    f += 2 * len;
                }
            }
        }
    }
    class VBRigBodyCreator extends VBCreator {
        _create() {
            return new VBRigBodyCreator(this.vertexFlag, this.maxVertexCount, false, this.boneRegistry);
        }
        appendVertexArray(attachmentParse, vertexArray, offset, creator) {
            let slotVertex = attachmentParse.vertexArray;
            let uvs = attachmentParse.uvs;
            let color = attachmentParse.color;
            let color2 = attachmentParse.darkColor;
            let vside = this.vertexSize;
            let c1r = color.r, c1g = color.g, c1b = color.b, c1a = color.a;
            let c2r = 0, c2g = 0, c2b = 0, c2a = 1;
            if (color2) {
                c2r = color2.r;
                c2g = color2.g;
                c2b = color2.b;
                c2a = color2.a;
            }
            if (attachmentParse.stride == 2) {
                let boneid = creator.getBoneId(attachmentParse.boneIndex);
                for (let j = 0, n = slotVertex.length; j < n; j += attachmentParse.stride) {
                    vertexArray[offset + 0] = uvs[j];
                    vertexArray[offset + 1] = uvs[j + 1];
                    vertexArray[offset + 2] = c1r;
                    vertexArray[offset + 3] = c1g;
                    vertexArray[offset + 4] = c1b;
                    vertexArray[offset + 5] = c1a;
                    vertexArray[offset + 6] = slotVertex[j];
                    vertexArray[offset + 7] = slotVertex[j + 1];
                    vertexArray[offset + 8] = 1;
                    vertexArray[offset + 9] = boneid;
                    if (this.twoColorTint) {
                        let tColorOffset = offset + 10;
                        vertexArray[tColorOffset] = c2r;
                        vertexArray[tColorOffset + 1] = c2g;
                        vertexArray[tColorOffset + 2] = c2b;
                        vertexArray[tColorOffset + 3] = c2a;
                    }
                    offset += vside;
                }
            }
            return offset;
        }
        appendDeform(attachmentParse, deform, offset, out) {
            if (!attachmentParse.attachment) {
                return;
            }
            let vside = this.vertexSize;
            let slotVertex = attachmentParse.vertexArray;
            if (attachmentParse.stride == 2) {
                for (let j = 0, n = slotVertex.length; j < n; j += attachmentParse.stride) {
                    out[offset + 6] = deform[j];
                    out[offset + 7] = deform[j + 1];
                    offset += vside;
                }
            }
        }
    }

    class ChangeDeform {
        constructor() {
        }
        apply(frame, vb, slots) {
            if (frame >= this.startFrame) {
                if (this._lastFrame >= this.endFrame && frame >= this.endFrame)
                    return false;
                this._lastFrame = frame;
                return this.updateVB(vb, slots);
            }
            else
                return false;
        }
        initChange(vb) {
            this.sizeMap = vb.slotVBMap.get(this.slotId);
            return true;
        }
        updateVB(vb, slots) {
            if (!this.sizeMap) {
                this.sizeMap = vb.slotVBMap.get(this.slotId);
                if (!this.sizeMap) {
                    return false;
                }
            }
            let slot = slots[this.slotId];
            if (slot.attachment) {
                let deform = slot.deform;
                if (!deform || !deform.length) {
                    return false;
                }
                let vertexSize = vb.vertexSize;
                let attachmentPos = this.sizeMap.get(slot.attachment.name);
                let offset = attachmentPos.offset * vertexSize;
                let vbData = vb.vb;
                let attachmentParse = attachmentPos.attachment;
                vb.appendDeform(attachmentParse, deform, offset, vbData);
            }
            return true;
        }
        clone() {
            let out = new ChangeDeform;
            out.slotId = this.slotId;
            out.startFrame = this.startFrame;
            out.endFrame = this.endFrame;
            return out;
        }
    }

    class ChangeDrawOrder {
        changeOrder(attachMap) {
            return this.order;
        }
        change(vb, slotAttachMap) {
            return true;
        }
    }

    class ChangeRGBA {
        constructor(slotId) {
            this.slotId = slotId;
        }
        apply(frame, vb, slots) {
            this.updateVB(vb, slots);
            return frame >= this.startFrame;
        }
        initChange(vb) {
            this.sizeMap = vb.slotVBMap.get(this.slotId);
            return true;
        }
        updateVB(vb, slots) {
            if (!this.sizeMap) {
                this.sizeMap = vb.slotVBMap.get(this.slotId);
                if (!this.sizeMap) {
                    return false;
                }
            }
            let slot = slots[this.slotId];
            let color = slot.color;
            if (slot.attachment) {
                let vertexSize = vb.vertexSize;
                let attachmentPos = this.sizeMap.get(slot.attachment.name);
                let vbData = vb.vb;
                let offset = attachmentPos.offset * vertexSize;
                let attachment = attachmentPos.attachment;
                let r, g, b, a;
                let attachmentColor = attachment.lightColor;
                let twoColorTint = vb.twoColorTint;
                let colorElement = vb.vertexDeclaration.getVertexElementByUsage(1);
                let cOffset = colorElement.offset / 4;
                let c2Offset = 0;
                if (twoColorTint) {
                    let color2Element = vb.vertexDeclaration.getVertexElementByUsage(11);
                    c2Offset = color2Element.offset / 4;
                }
                if (!attachmentColor) {
                    r = color.r;
                    g = color.g;
                    b = color.b;
                    a = color.a;
                }
                else {
                    r = color.r * attachmentColor.r;
                    g = color.g * attachmentColor.g;
                    b = color.b * attachmentColor.b;
                    a = color.a * attachmentColor.a;
                }
                let darkColor = slot.darkColor;
                let darkColorR = 0, darkColorG = 0, darkColorB = 0, darkColorA = 1;
                if (darkColor) {
                    darkColorR = darkColor.r;
                    darkColorG = darkColor.g;
                    darkColorB = darkColor.b;
                    darkColorA = darkColor.a;
                }
                let n = attachment.vertexCount;
                for (let i = 0; i < n; i++) {
                    let co = offset + i * vertexSize + cOffset;
                    vbData[co] = r;
                    vbData[co + 1] = g;
                    vbData[co + 2] = b;
                    vbData[co + 3] = a;
                    if (twoColorTint) {
                        let c2o = offset + i * vertexSize + c2Offset;
                        vbData[c2o] = darkColorR;
                        vbData[c2o + 1] = darkColorG;
                        vbData[c2o + 2] = darkColorB;
                        vbData[c2o + 3] = darkColorA;
                    }
                }
            }
            return true;
        }
        clone() {
            let out = new ChangeRGBA(this.slotId);
            out.startFrame = this.startFrame;
            out.endFrame = this.endFrame;
            return out;
        }
    }

    class ChangeSlot {
        change(vb, slotAttachMap) {
            let map = slotAttachMap.get(this.slotId);
            let attachmentParse = map.get(this.attachment);
            if (attachmentParse) {
                vb.appendVB(attachmentParse);
            }
            else {
                attachmentParse = map.get(null);
            }
            this.attachmentParse = attachmentParse;
            return !this.attachmentParse.isClip;
        }
        changeOrder(attachMap) {
            attachMap[this.slotId] = this.attachmentParse;
            return null;
        }
    }

    class AnimationRender {
        constructor() {
            this.isDynamic = false;
            this.hasEvent = false;
            this.hasVertexAnimation = false;
            this.isCache = false;
            this.hasClip = false;
            this.hasRenderCache = false;
            this.changeMap = new Map();
            this.frames = [];
            this.skinDataArray = [];
            this.boneFrames = [];
            this.eventsFrames = [];
        }
        getFrameIndex(time, frameIndex) {
            let frames = this.frames;
            let n = frames.length;
            for (let i = 1; i < n; i++)
                if (frames[i] > time)
                    return i - 1;
            return n - 1;
        }
        check(animation, optimise) {
            this.name = animation.name;
            let timeline = animation.timelines;
            let changeMap = this.changeMap;
            let renderFrames = this.frames;
            let spineRuntime = window.spine;
            let hasClip = false;
            let hasEvent = false;
            renderFrames.push(0);
            changeMap.set(0, {});
            let isDynamic = false;
            for (let i = 0, n = timeline.length; i < n; i++) {
                let time = timeline[i];
                let frames = time.frames;
                if (time instanceof spine.AttachmentTimeline) {
                    let attachmentNames = time.attachmentNames;
                    let slotIndex = time.slotIndex;
                    for (let j = 0, m = frames.length; j < m; j++) {
                        let frame = frames[j];
                        let change = new ChangeSlot();
                        change.slotId = slotIndex;
                        change.attachment = attachmentNames[j] || null;
                        let changeItem = changeMap.get(frame);
                        if (!changeItem) {
                            this.frames.indexOf(frame) == -1 && this.frames.push(frame);
                            changeItem = {
                                iChanges: []
                            };
                            changeMap.set(frame, changeItem);
                        }
                        let arr = changeItem.iChanges = changeItem.iChanges || [];
                        arr.push(change);
                    }
                    isDynamic = true;
                }
                else if (time instanceof spine.DrawOrderTimeline) {
                    let orders = time.drawOrders;
                    for (let j = 0, m = frames.length; j < m; j++) {
                        let frame = frames[j];
                        let change = new ChangeDrawOrder();
                        change.order = orders[j];
                        let changeItem = changeMap.get(frame);
                        if (!changeItem) {
                            this.frames.indexOf(frame) == -1 && this.frames.push(frame);
                            changeItem = {
                                iChanges: []
                            };
                            changeMap.set(frame, changeItem);
                        }
                        let arr = changeItem.iChanges = changeItem.iChanges || [];
                        arr.push(change);
                        isDynamic = true;
                    }
                }
                else if ((spineRuntime.ColorTimeline && time instanceof spineRuntime.ColorTimeline)
                    || (spineRuntime.RGBATimeline && time instanceof spineRuntime.RGBATimeline)
                    || (spineRuntime.RGBTimeline && time instanceof spineRuntime.RGBTimeline)
                    || (spineRuntime.AlphaTimeline && time instanceof spineRuntime.AlphaTimeline)
                    || (spineRuntime.TwoColorTimeline && time instanceof spineRuntime.TwoColorTimeline)
                    || (spineRuntime.RGBA2Timeline && time instanceof spineRuntime.RGBA2Timeline)
                    || (spineRuntime.RGB2Timeline && time instanceof spineRuntime.RGB2Timeline)) {
                    let rgba = time;
                    let slotIndex = rgba.slotIndex;
                    this.hasVertexAnimation = true;
                    let changeRGBA = new ChangeRGBA(slotIndex);
                    let startFrame = frames[0];
                    let frameEntries = typeof time.getFrameEntries === "function"
                        ? time.getFrameEntries()
                        : (spineRuntime.TwoColorTimeline && time instanceof spineRuntime.TwoColorTimeline ? 8 : 5);
                    let num = frames.length / frameEntries | 0;
                    let endFrame = frames[(num - 1) * frameEntries];
                    changeRGBA.startFrame = startFrame;
                    changeRGBA.endFrame = endFrame;
                    let changeItem = changeMap.get(startFrame);
                    if (!changeItem) {
                        this.frames.indexOf(startFrame) == -1 && this.frames.push(startFrame);
                        changeItem = {
                            vChanges: []
                        };
                        changeMap.set(startFrame, changeItem);
                    }
                    this.frames.indexOf(endFrame) == -1 && this.frames.push(endFrame);
                    let arr = changeItem.vChanges = changeItem.vChanges || [];
                    arr.push(changeRGBA);
                    isDynamic = true;
                }
                else if (time instanceof window.spine.ClippingAttachment) {
                    hasClip = true;
                }
                else if (time instanceof window.spine.EventTimeline) {
                    let eventTime = time;
                    let events = eventTime.events;
                    for (let j = 0, m = frames.length; j < m; j++) {
                        let frame = frames[j];
                        let event = events[j];
                        let arr = this.eventsFrames[Math.round(frame / SpineConst.SPINE_STEP)] = this.eventsFrames[frame] || [];
                        arr.push(event);
                    }
                    hasEvent = true;
                }
                else if (time instanceof spine.DeformTimeline) {
                    this.hasVertexAnimation = true;
                    let slotIndex = time.slotIndex;
                    let change = new ChangeDeform();
                    change.slotId = slotIndex;
                    let startFrame = frames[0];
                    let endFrame = frames[frames.length - 1];
                    change.startFrame = startFrame;
                    change.endFrame = endFrame;
                    let changeItem = changeMap.get(startFrame);
                    if (!changeItem) {
                        this.frames.indexOf(startFrame) == -1 && this.frames.push(startFrame);
                        changeItem = {
                            vChanges: []
                        };
                        changeMap.set(startFrame, changeItem);
                    }
                    this.frames.indexOf(endFrame) == -1 && this.frames.push(endFrame);
                    let arr = changeItem.vChanges = changeItem.vChanges || [];
                    arr.push(change);
                    isDynamic = true;
                }
                else ;
            }
            this.isDynamic = isDynamic;
            renderFrames.sort();
            this.hasClip = hasClip;
            this.hasEvent = hasEvent;
            this.frameNumber = renderFrames.length;
        }
        createSkinData(mainVB, mainIB, tempIbCreate, slotAttachMap, attachMap, type) {
            let skinData = new SkinAniRenderData();
            skinData.type = type;
            let frames = this.frames;
            skinData.init(this.changeMap, mainVB, mainIB, tempIbCreate, frames, slotAttachMap, attachMap, this.isDynamic);
            this.skinDataArray.push(skinData);
            return skinData;
        }
        destroy() {
            for (let i = 0, n = this.skinDataArray.length; i < n; i++)
                this.skinDataArray[i].destroy();
            this.skinDataArray.length = 0;
            this.frames.length = 0;
            this.changeMap.clear();
        }
    }
    class SkinAniRenderData {
        constructor() {
            this.maxVertexCount = 0;
            this.maxIndexCount = 0;
            this.isDynamic = false;
            this.renderCache = [];
            this.hasRenderCache = false;
            this.renderDatas = [];
        }
        getMesh() {
            return this._defaultMesh;
        }
        getFrameData(frameIndex) {
            return this.renderDatas[frameIndex] || this._defaultFrameData;
        }
        init(changeMap, mainVB, ibCreator, tempCreator, frames, slotAttachMap, attachMap, isDynamic) {
            this.mainIB = ibCreator;
            this.isDynamic = isDynamic;
            this.canInstance = !this.isDynamic;
            if (isDynamic) {
                this.vb = mainVB.clone();
                let tAttachMap = attachMap.slice();
                let framesLength = frames.length;
                let order;
                let lastData;
                for (let i = 0; i < framesLength; i++) {
                    let frame = frames[i];
                    let fcs = changeMap.get(frame);
                    if (!fcs) {
                        this.renderDatas[i] = lastData;
                        continue;
                    }
                    let iChanges = fcs.iChanges;
                    let data = {};
                    if (iChanges) {
                        for (let j = 0, m = iChanges.length; j < m; j++) {
                            let ichange = iChanges[j];
                            if (!ichange.change(this.vb, slotAttachMap)) {
                                this.isNormalRender = true;
                            }
                            let newOrder = ichange.changeOrder(tAttachMap);
                            if (newOrder) {
                                order = newOrder;
                            }
                        }
                        tempCreator.createIB(tAttachMap, this.vb, order);
                        data.ib = tempCreator.ib.slice(0, tempCreator.ibLength);
                        data.mulitRenderData = tempCreator.outRenderData;
                        data.type = tempCreator.type;
                        data.size = tempCreator.size;
                    }
                    let vChanges = fcs.vChanges;
                    if (vChanges) {
                        let myChangeVB = [];
                        for (let j = 0, m = vChanges.length; j < m; j++) {
                            let changeVBItem = vChanges[j].clone();
                            if (changeVBItem.initChange(this.vb)) {
                                changeVBItem.startFrame = i;
                                changeVBItem.endFrame = frames.indexOf(changeVBItem.endFrame);
                                myChangeVB.push(changeVBItem);
                            }
                        }
                        data.vChanges = myChangeVB;
                    }
                    this.renderDatas[i] = data;
                    lastData = data;
                    if (!frame) {
                        if (!data.ib) {
                            data.mulitRenderData = ibCreator.outRenderData;
                            data.ib = ibCreator.ib.slice(0, this.mainIB.ibLength);
                            data.type = ibCreator.type;
                            data.size = ibCreator.size;
                        }
                        this._defaultFrameData = data;
                    }
                }
                this.maxIndexCount = Math.max(tempCreator.maxIndexCount, this.mainIB.maxIndexCount);
            }
            else {
                this.vb = mainVB;
                this._defaultMesh = SpineMeshUtils.createMesh(this.type, this.vb, ibCreator, this.isDynamic);
                this._defaultMesh.lock = true;
                this.maxIndexCount = ibCreator.maxIndexCount;
            }
            this.maxVertexCount = this.vb.maxVertexCount;
            if (!this._defaultFrameData) {
                this._defaultFrameData = {
                    mulitRenderData: ibCreator.outRenderData,
                    ib: ibCreator.ib.slice(0, this.mainIB.ibLength),
                    type: ibCreator.type,
                    size: ibCreator.size
                };
            }
        }
        destroy() {
            this._defaultMesh && this._defaultMesh.destroy();
            this._defaultMesh = null;
            this._defaultFrameData = null;
            this.renderDatas = null;
            this.renderCache = null;
            this.hasRenderCache = false;
        }
    }

    class SpineTexture {
        constructor(tex) {
            this.realTexture = tex;
        }
        getImage() {
            var _a, _b, _c, _d;
            return {
                width: (_b = ((_a = this.realTexture) === null || _a === void 0 ? void 0 : _a.width)) !== null && _b !== void 0 ? _b : 16,
                height: (_d = ((_c = this.realTexture) === null || _c === void 0 ? void 0 : _c.height)) !== null && _d !== void 0 ? _d : 16,
            };
        }
        setFilters(minFilter, magFilter) {
            if (!this.realTexture)
                return;
            let filterMode;
            if (magFilter === window.spine.TextureFilter.Nearest)
                filterMode = Laya.FilterMode.Point;
            else
                filterMode = Laya.FilterMode.Bilinear;
            this.realTexture.filterMode = filterMode;
        }
        convertWrapMode(mode) {
            return mode == spine.TextureWrap.ClampToEdge ? Laya.WrapMode.Clamp : (mode == spine.TextureWrap.MirroredRepeat ? Laya.WrapMode.Mirrored : Laya.WrapMode.Repeat);
        }
        setWraps(uWrap, vWrap) {
            if (!this.realTexture)
                return;
            this.realTexture.wrapModeU = this.convertWrapMode(uWrap);
            this.realTexture.wrapModeV = this.convertWrapMode(vWrap);
        }
    }

    class SkeletonOptimise {
        constructor() {
            this._registTextures = {};
            this.hasPhysics = false;
            this.blendModeMap = new Map();
            this.animators = [];
            this.skinAttachArray = [];
            this._skinNames = [];
        }
        getAllSkinNames() {
            return this._skinNames;
        }
        getAnimationCount() {
            return this.data.animations.length;
        }
        getAniNameByIndex(index) {
            let tAni = this.data.animations[index];
            if (tAni)
                return tAni.name;
            return null;
        }
        findAnimation(name) {
            return this.data.findAnimation(name);
        }
        hasAnimation(name) {
            return !!this.data.findAnimation(name);
        }
        getSkinIndexByName(skinName) {
            let skins = this.data.skins;
            for (let i = 0, n = skins.length; i < n; i++) {
                if (skins[i].name == skinName) {
                    return i;
                }
            }
            return -1;
        }
        _getBounds() {
            let skeleton = this.skeleton;
            let skeletonData = this.data;
            let offset = new spine.Vector2;
            let size = new spine.Vector2;
            let skins = skeletonData.skins;
            let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
            for (let index = 0; index < skins.length; index++) {
                const skin = skins[index];
                skeleton.setSkin(skin);
                skeleton.setToSetupPose();
                skeleton.updateWorldTransform(0);
                skeleton.getBounds(offset, size);
                minX = Math.min(minX, offset.x);
                minY = Math.min(minY, offset.y);
                maxX = Math.max(maxX, offset.x + size.x);
                maxY = Math.max(maxY, offset.y + size.y);
            }
            if (minX == Number.POSITIVE_INFINITY
                || minY == Number.POSITIVE_INFINITY
                || maxX == Number.NEGATIVE_INFINITY
                || maxY == Number.NEGATIVE_INFINITY) {
                return SkeletonOptimise.emptyBounds;
            }
            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        }
        getSkin(index) {
            return this.data.skins[index];
        }
        _updateState(delta) {
            this._state.update(delta);
            this._state.getCurrent(0);
            this._state.apply(this.skeleton);
            this.skeleton.updateWorldTransform(2);
            return this.skeleton.bones;
        }
        _play(animationName) {
            let trackEntry = this._state.setAnimation(0, animationName, true);
            trackEntry.animationStart = 0;
            let animationDuration = trackEntry.animation.duration;
            return animationDuration;
        }
        checkMainAttach(skeleton, data) {
            this.skeleton = skeleton;
            this.data = data;
            this._stateData = new spine.AnimationStateData(data);
            this._state = new spine.AnimationState(this._stateData);
            this._bones = new SpineBoneRegistry;
            this.attachMentParse(data);
            this.initAnimation(data.animations);
        }
        attachMentParse(skeletonData) {
            let skins = skeletonData.skins;
            let slots = skeletonData.slots;
            let defaultSkinAttach;
            this._tempIbCreate = new IBCreator();
            this._skinNames.length = 0;
            for (let i = 0, n = skins.length; i < n; i++) {
                let skin = skins[i];
                let skinAttach = new SkinAttach();
                skinAttach.index = i;
                skinAttach.name = skin.name;
                skinAttach._tempIbCreate = this._tempIbCreate;
                if (i != 0) {
                    skinAttach.copyFrom(defaultSkinAttach);
                }
                skinAttach.attachMentParse(skin, slots, this._bones);
                this.skinAttachArray.push(skinAttach);
                skinAttach.init(slots);
                if (i == 0) {
                    defaultSkinAttach = skinAttach;
                }
                this._skinNames.push(skin.name);
            }
        }
        registerTexture(texture) {
            let tex2d = texture.bitmap;
            if (!tex2d)
                return null;
            let bitmapUrl = tex2d.url || "texture";
            let spineTexture = new SpineTexture(tex2d);
            let page = this._registTextures[bitmapUrl];
            if (!page) {
                page = new spine.TextureAtlasPage(bitmapUrl);
                page.name = bitmapUrl;
                page.texture = spineTexture;
                page.width = tex2d.width;
                page.height = tex2d.height;
                this._registTextures[bitmapUrl] = page;
            }
            let textureName = this._getTextureName(texture);
            let region = null;
            if (!region) {
                region = new spine.TextureAtlasRegion(page, textureName);
                region.page = page;
                region.name = textureName;
            }
            region.width = texture.width;
            region.height = texture.height;
            region.originalWidth = texture.sourceWidth;
            region.originalHeight = texture.sourceHeight;
            region.offsetX = texture.offsetX;
            region.offsetY = region.originalHeight - texture.offsetY - region.height;
            if (texture.uv && texture.uv.length >= 8) {
                region.u = texture.uv[0];
                region.v = texture.uv[1];
                region.u2 = texture.uv[4];
                region.v2 = texture.uv[5];
            }
            else {
                region.u = 0;
                region.v = 0;
                region.u2 = 1.0;
                region.v2 = 1.0;
            }
            region.texture = spineTexture;
            return region;
        }
        _getTextureName(texture) {
            let textureName = texture.name;
            if (!textureName && texture.url) {
                textureName = texture.url.split("/").pop().split("\\").pop();
            }
            return textureName || "texture";
        }
        getTextureRegion(pageName, textureName) {
            let page = this._registTextures[pageName];
            if (!page)
                return null;
            return page.regions.find(region => region.name === textureName);
        }
        initAnimation(animations) {
            for (let i = 0, n = animations.length; i < n; i++) {
                let animation = animations[i];
                let animator = new AnimationRender();
                animator.check(animation, this);
                this.animators.push(animator);
                this.skinAttachArray.forEach((value) => {
                    value.initAnimator(animator);
                });
                if (this.canCache) {
                    this._initBoneFrame(animator);
                }
            }
            this.maxBoneNumber = this._bones.boneCount;
        }
        _initBoneFrame(animator) {
            let duration = this._play(animator.name);
            let totalFrame = Math.round(duration / SpineConst.SPINE_STEP) || 1;
            let offsetX = 0;
            let offsetY = 0;
            for (let i = 0; i <= totalFrame; i++) {
                let bones = this._updateState(i == 0 ? 0 : SpineConst.SPINE_STEP);
                let frame = [];
                animator.boneFrames.push(frame);
                for (let j = 0; j < bones.length; j++) {
                    let bone = bones[j];
                    let rs = new Float32Array(8);
                    rs[0] = bone.a;
                    rs[1] = bone.b;
                    rs[2] = bone.worldX + offsetX;
                    rs[3] = 0;
                    rs[4] = bone.c;
                    rs[5] = bone.d;
                    rs[6] = bone.worldY + offsetY;
                    rs[7] = 0;
                    frame.push(rs);
                }
            }
            animator.isCache = true;
        }
        cacheBone() {
            let boneS = this._bones.boneIdIndexPairs;
            let boneIndexSet = new Set();
            let originalSkinRequiredMap = new Map();
            for (let i = 1, n = boneS.length; i < n; i += 2) {
                let boneIndex = boneS[i];
                boneIndexSet.add(boneIndex);
                let bone = this.skeleton.bones[boneIndex];
                if (bone && bone.data) {
                    originalSkinRequiredMap.set(boneIndex, bone.data.skinRequired);
                    bone.data.skinRequired = false;
                }
            }
            this.skeleton.updateCache();
            for (let i = 0, n = this.animators.length; i < n; i++) {
                let animator = this.animators[i];
                if (animator.boneFrames.length == 0 && !animator.hasClip) {
                    this._initBoneFrame(animator);
                }
            }
            originalSkinRequiredMap.forEach((originalValue, boneIndex) => {
                let bone = this.skeleton.bones[boneIndex];
                if (bone && bone.data) {
                    bone.data.skinRequired = originalValue;
                }
            });
        }
        cacheRender() {
            if (!SpineConst.cacheSwitch) {
                for (let i = 0, n = this.animators.length; i < n; i++) {
                    let animator = this.animators[i];
                    if (animator.hasRenderCache)
                        continue;
                    for (let skinData of animator.skinDataArray) {
                        this._cacheRenderForSkin(animator, skinData);
                    }
                    animator.hasRenderCache = true;
                }
            }
        }
        _cacheRenderForSkin(animator, skinData) {
            let duration = this._play(animator.name);
            let totalFrame = Math.round(duration / SpineConst.SPINE_STEP) || 1;
            let tempUpdater = new SpineNormalRenderUpdater();
            skinData.renderCache = [];
            for (let frameIndex = 0; frameIndex <= totalFrame; frameIndex++) {
                this._updateState(frameIndex == 0 ? 0 : SpineConst.SPINE_STEP);
                this.skeleton.updateWorldTransform(2);
                tempUpdater.renderUpdate(frameIndex * SpineConst.SPINE_STEP, this.skeleton, null, -1, -1, 0, 0);
                let frameCache = tempUpdater.exportToCache();
                skinData.renderCache[frameIndex] = frameCache;
            }
            skinData.hasRenderCache = true;
        }
        destroy() {
            for (let i = 0, n = this.animators.length; i < n; i++)
                this.animators[i].destroy();
            this.animators.length = 0;
        }
    }
    SkeletonOptimise.emptyBounds = { x: 0, y: 0, width: 0, height: 0 };
    class SkinAttach {
        constructor() {
            this.vertexBones = 0;
            this.rbBoneIndex = -1;
            this.twoColorTint = false;
            this.slotAttachMap = new Map();
            this.mainAttachMentOrder = [];
        }
        copyFrom(other) {
            other.slotAttachMap.forEach((value, key) => {
                this.slotAttachMap.set(key, new Map(value));
            });
        }
        attachMentParse(skinData, slots, boneRegistry) {
            let vertexBones = 0;
            let attachments = skinData.attachments;
            let vertexCount = 0;
            let indexCount = 0;
            let twoColorTint = false;
            let bones = new Set();
            for (let i = 0, n = slots.length; i < n; i++) {
                let attachment = attachments[i];
                let slot = slots[i];
                let boneIndex = slot.boneData.index;
                let map = this.slotAttachMap.get(i);
                let slotAttachName = slot.attachmentName;
                if (!map) {
                    map = new Map();
                    this.slotAttachMap.set(i, map);
                }
                if (attachment) {
                    for (let key in attachment) {
                        let attach = attachment[key];
                        let deform = null;
                        let parse = new AttachmentParse();
                        parse.init(attach, boneIndex, i, deform, slot);
                        vertexBones = Math.max(vertexBones, parse.vertexBones);
                        indexCount += parse.indexCount;
                        vertexCount += parse.vertexCount;
                        twoColorTint = twoColorTint || !!parse.darkColor;
                        map.set(key, parse);
                        parse.bones.forEach(bone => {
                            bones.add(bone);
                        });
                    }
                }
                else if (slotAttachName) {
                    let parse = map.get(slotAttachName);
                    if (parse) {
                        indexCount += parse.indexCount;
                        vertexCount += parse.vertexCount;
                        vertexBones = Math.max(vertexBones, parse.vertexBones);
                        twoColorTint = twoColorTint || !!parse.darkColor;
                        parse.bones.forEach(bone => {
                            bones.add(bone);
                        });
                    }
                }
                if (!map.get(null)) {
                    let nullAttachment = new AttachmentParse();
                    nullAttachment.slotId = i;
                    nullAttachment.color = slot.color;
                    nullAttachment.boneIndex = boneIndex;
                    nullAttachment.attachment = null;
                    map.set(nullAttachment.attachment, nullAttachment);
                }
            }
            let size = bones.size;
            if (size > 1) {
                this.type = exports.ESpineRenderType.boneGPU;
            }
            else if (size === 1) {
                this.type = exports.ESpineRenderType.rigidBody;
                this.rbBoneIndex = bones.values().next().value;
            }
            else {
                this.type = exports.ESpineRenderType.normal;
            }
            this.vertexBones = vertexBones;
            this.twoColorTint = twoColorTint;
            let flag;
            switch (this.type) {
                case exports.ESpineRenderType.normal:
                    flag = "UV,COLOR,POSITION,BONE";
                    if (twoColorTint)
                        flag += ",COLOR2";
                    this.mainVB = new VBBoneCreator(flag, vertexCount, true, boneRegistry);
                    break;
                case exports.ESpineRenderType.boneGPU:
                    flag = "UV,COLOR,POSITION,BONE";
                    if (twoColorTint)
                        flag += ",COLOR2";
                    this.mainVB = new VBBoneCreator(flag, vertexCount, true, boneRegistry);
                    break;
                case exports.ESpineRenderType.rigidBody:
                    flag = "UV,COLOR,POSITION,RIGIDBODY";
                    if (twoColorTint)
                        flag += ",COLOR2";
                    this.mainVB = new VBRigBodyCreator(flag, vertexCount, true, boneRegistry);
                    break;
            }
            this.mainIB = new IBCreator();
            this.mainIB.updateFormat(vertexCount);
            this.mainIB.setBufferLength(indexCount);
        }
        init(slots) {
            let mainAttachMentOrder = this.mainAttachMentOrder;
            slots.forEach((slot, index) => {
                let attchment = slot.attachmentName;
                if (attchment) {
                    let parse = this.slotAttachMap.get(index).get(attchment);
                    if (parse) {
                        this.mainVB.appendVB(parse);
                    }
                    else {
                        parse = this.slotAttachMap.get(index).get(null);
                    }
                    if (parse.isClip)
                        this.isNormalRender = true;
                    mainAttachMentOrder.push(parse);
                }
                else {
                    let attach = this.slotAttachMap.get(index).get(null);
                    mainAttachMentOrder.push(attach);
                }
            });
            this.mainIB.createIB(mainAttachMentOrder, this.mainVB);
        }
        initAnimator(animator) {
            let skinData = animator.createSkinData(this.mainVB, this.mainIB, this._tempIbCreate, this.slotAttachMap, this.mainAttachMentOrder, this.type);
            skinData.name = this.name + "_" + animator.name;
            return skinData;
        }
    }

    class WebSpineTempletParser {
        constructor() {
            this._premultipliedAlpha = SpineConst.PREMULTIPLIED_ALPHA_DEFAULT;
            this._cachedAtlasText = null;
            this._basePath = "";
        }
        parse(data, textures) {
            let templet = new SpineTemplet();
            let atlasLoader = new spine.AtlasAttachmentLoader(this._atlas);
            let skeletonData = null;
            if (data instanceof ArrayBuffer) {
                let skeletonBinary = new spine.SkeletonBinary(atlasLoader, false);
                skeletonData = skeletonBinary.readSkeletonData(new Uint8Array(data));
            }
            else {
                let skeletonJson = new spine.SkeletonJson(atlasLoader, false);
                skeletonData = skeletonJson.readSkeletonData(data);
            }
            let skeletonOptimise = new SkeletonOptimise();
            let skeleton = new spine.Skeleton(skeletonData);
            templet._textures = textures;
            templet._premultipliedAlpha = this._premultipliedAlpha;
            skeletonOptimise.hasPhysics = this._premultipliedAlpha && skeletonData.physicsConstraints && skeletonData.physicsConstraints.length > 0;
            skeletonOptimise.canCache = SpineConst.cacheSwitch && !skeletonOptimise.hasPhysics;
            skeletonOptimise.checkMainAttach(skeleton, skeletonData);
            if (skeletonData.x == undefined
                || skeletonData.y == undefined
                || skeletonData.width == undefined
                || skeletonData.height == undefined) {
                let bounds = skeletonOptimise._getBounds();
                templet.x = bounds.x;
                templet.y = bounds.y;
                templet.width = bounds.width;
                templet.height = bounds.height;
                templet.offsetX = bounds.x + bounds.width;
                templet.offsetY = -(bounds.y + bounds.height);
            }
            else {
                templet.x = skeletonData.x || 0;
                templet.y = skeletonData.y || 0;
                templet.width = skeletonData.width || 0;
                templet.height = skeletonData.height || 0;
                templet.offsetX = (skeletonData.x || 0) + templet.width;
                templet.offsetY = -((skeletonData.y || 0) + templet.height);
            }
            templet.optimize = skeletonOptimise;
            templet._parser = this;
            return templet;
        }
        collectTextures(atlasText, task) {
            const lines = atlasText.split(SpineConst.SPLIT_REGEX);
            const textureInfos = [];
            let currentPma = this._premultipliedAlpha;
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (!trimmed)
                    continue;
                const pmaMatch = trimmed.match(SpineConst.PMA_REGEX);
                if (pmaMatch) {
                    currentPma = pmaMatch[1].toLowerCase() === "true";
                    continue;
                }
                if (trimmed.indexOf(".png") !== -1 || trimmed.indexOf(".jpg") !== -1 ||
                    trimmed.indexOf(".jpeg") !== -1 || trimmed.indexOf(".webp") !== -1) {
                    const lastSlash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
                    const texturePath = lastSlash !== -1
                        ? trimmed.substring(lastSlash + 1)
                        : trimmed;
                    textureInfos.push({
                        path: texturePath,
                        pma: currentPma
                    });
                    this._premultipliedAlpha = currentPma && this._premultipliedAlpha;
                    currentPma = true;
                }
            }
            this._cachedAtlasText = atlasText;
            this._basePath = Laya.URL.getPath(task.url);
            return textureInfos.map((info) => ({
                url: this._basePath + info.path,
                type: Laya.Loader.TEXTURE2D,
                propertyParams: {
                    premultiplyAlpha: info.pma
                },
                constructParams: [0, 0, Laya.TextureFormat.R8G8B8A8, false, false, true, info.pma]
            }));
        }
        create(desc, textures) {
            const atlasTextContent = this._cachedAtlasText || "";
            if (SpineConst.VersionFirst >= 4) {
                this._atlas = new spine.TextureAtlas(atlasTextContent);
            }
            else {
                this._atlas = new spine.TextureAtlas(atlasTextContent, (path) => {
                    return new SpineTexture(Laya.Laya.loader.getRes(this._basePath + path, Laya.Loader.TEXTURE2D));
                });
            }
            let textureMap = {};
            let currentPma = this._premultipliedAlpha;
            let atlas = this._atlas;
            for (var i = 0; i < textures.length; i++) {
                let tex = textures[i];
                if (tex)
                    tex._addReference();
                let pages = atlas.pages;
                let page = pages[i];
                textureMap[page.name] = tex;
                currentPma = currentPma && tex._premultiplyAlpha;
                if (page.setTexture) {
                    page.setTexture(new SpineTexture(tex));
                }
            }
            this._premultipliedAlpha = currentPma;
            return this.parse(desc, textureMap);
        }
        destroy() {
        }
    }

    class JSSpineFactory {
        createSpineTempletParser() {
            return new WebSpineTempletParser();
        }
        createSpineRenderDataHandle() {
            if (Laya.LayaEnv.isConch && window.conchConfig.getGraphicsAPI() !== 2)
                return new NativeSpineRenderDataHandle();
            return new WebSpineRenderDataHandle();
        }
        createSpineRender2D(owner) {
            return new SpineOptimizeRender2D(owner);
        }
        createSpineRender3D(owner) {
            return new SpineOptimizeRender3D(owner);
        }
    }

    class SpineAdapter {
        static adaptJS() {
            let ns = window.spine;
            if (ns) {
                let stateProto = ns.AnimationState.prototype;
                stateProto.getCurrentOld = stateProto.getCurrent;
                stateProto.getCurrent = function (trackIndex) {
                    let result = this.getCurrentOld(trackIndex);
                    this.currentTrack = result;
                    return result;
                };
                if (SpineConst.VERSION === "4.1" && typeof ns.Skeleton.prototype.update !== "function") {
                    ns.Skeleton.prototype.update = function (_delta) { };
                }
                if (SpineConst.VERSION == "3.7") {
                    let bone_proto = ns.Bone.prototype;
                    bone_proto.active = true;
                }
            }
        }
    }
    SpineAdapter.stateMap = { 0: "start", 1: "interrupt", 2: "end", 3: "complete", 4: "dispose", 5: "event" };

    Laya.Laya.addAfterInitCallback(() => {
        if (!Laya.LayaEnv.isConch || window.conchConfig.getGraphicsAPI() === 2) {
            SpineConst.factory = new JSSpineFactory();
            SpineNormalRenderUpdater.__init__();
            SpineAdapter.adaptJS();
            if (SpineConst.ENABLE_WEB_BATCH) {
                Laya.BatchManager.registerProvider(Laya.BaseRender2DType.spineSimple, SpineInstanceBatch);
                Laya.BatchManager.registerProvider(Laya.BaseRender2DType.spinenormal, SpineNormalBatch);
            }
            return;
        }
        SpineConst.factory = new NativeSpineFactory();
        NativeSkeletonOptimise.__init__();
    });

    class SpineBakeScript extends Laya.Script {
        constructor() {
            super();
        }
        onEnable() {
            if (this.bakeData)
                this.initBake(JSON.parse(this.bakeData));
        }
        onDisable() {
            let spine = this.owner.getComponent(Spine2DRenderNode);
            if (spine._spineRender) {
                spine._spineRender.initBake(null);
            }
        }
        async initBake(data) {
            const textureWidth = data.aniOffsetMap.textureWidth || 256;
            let texture = await Laya.Laya.loader.load({
                url: data.simpPath,
                type: Laya.Loader.TEXTURE2D,
                constructParams: [
                    textureWidth, textureWidth, Laya.TextureFormat.R32G32B32A32, false, false, false, false
                ]
            });
            data.texture2d = texture;
            let spine = this.owner.getComponent(Spine2DRenderNode);
            if (spine.templet) {
                spine._spineRender.initBake(data);
            }
            else {
                this.owner.on(Laya.Event.READY, this, () => {
                    spine._spineRender.initBake(data);
                });
            }
        }
    }
    Laya.ClassUtils.regClass("SpineBakeScript", SpineBakeScript);

    class SpineTempletLoader {
        load(task) {
            let ext = Laya.Utils.getFileExtension(task.url);
            if (ext === "json")
                return task.loader.fetch(task.url, "json", task.progress.createCallback()).then((data) => this.loadSpineSource(task, task.url, data));
            return this.loadSpineSource(task, task.url);
        }
        loadSpineSource(task, url, spineData) {
            return Laya.AssetDb.inst.resolveURL(url).then(resolvedUrl => this.loadSpineSourceResolved(task, resolvedUrl || url, spineData));
        }
        loadSpineSourceResolved(task, url, spineData) {
            let atlasUrl = Laya.Utils.replaceFileExtension(url, "atlas");
            let ext = Laya.Utils.getFileExtension(url);
            return Promise.all([
                spineData !== undefined ? Promise.resolve(spineData) : task.loader.fetch(url, ext == "skel" || ext == "bin" ? "arraybuffer" : "json", task.progress.createCallback()),
                task.loader.fetch(atlasUrl, "text", task.progress.createCallback())
            ]).then(res => {
                if (!res[0] || !res[1])
                    return null;
                let parser = SpineConst.factory.createSpineTempletParser();
                let sourceTask = url === task.url ? task : Object.assign(Object.create(task), { url });
                let urls = parser.collectTextures(res[1], sourceTask);
                return Laya.Laya.loader.load(urls, null, task.progress.createCallback()).then((textures) => {
                    let templet = parser.create(res[0], textures);
                    return this.loadRuntimeMeta(task, url).then(data => SpineTempletLoader.applyRuntimeData(templet, data, task));
                });
            });
        }
        async loadRuntimeMeta(task, resolvedUrl) {
            let data = Laya.AssetDb.inst.metaMap[task.url] || Laya.AssetDb.inst.metaMap[resolvedUrl];
            if (!data && task.uuid)
                data = await Laya.AssetDb.inst.getMeta(task.url, task.uuid);
            return data;
        }
        static async applyRuntimeData(templet, data, task) {
            if (!templet)
                return templet;
            if (!data) {
                templet.spineMaterialTextures = {};
                templet.spineMaterials2D = {};
                templet.spineMaterials3D = {};
                return templet;
            }
            templet.spineMaterialTextures = data.spineMaterialTextures || {};
            let [materials2D, materials3D] = await Promise.all([
                SpineTempletLoader.loadMaterialMap(data.spineMaterials2D, templet, task),
                SpineTempletLoader.loadMaterialMap(data.spineMaterials3D, templet, task)
            ]);
            templet.spineMaterials2D = materials2D || {};
            templet.spineMaterials3D = materials3D || {};
            return templet;
        }
        static async loadMaterialMap(data, templet, task) {
            var _a;
            if (!data)
                return null;
            let result = {};
            let promises = [];
            for (let key in data) {
                if (key.indexOf("_$") === 0)
                    continue;
                let runtimeKey = SpineTempletLoader.getRuntimeMaterialKey(key, templet);
                let url = SpineTempletLoader.getMaterialURL(data[key]);
                if (!url) {
                    result[runtimeKey] = null;
                    continue;
                }
                promises.push(Laya.Laya.loader.load(url, Laya.Loader.MATERIAL, (_a = task === null || task === void 0 ? void 0 : task.progress) === null || _a === void 0 ? void 0 : _a.createCallback()).then((material) => {
                    result[runtimeKey] = material || null;
                }));
            }
            await Promise.all(promises);
            return result;
        }
        static getRuntimeMaterialKey(key, templet) {
            let match = /^(.*)_([0-3])_(true|false)_(2D|3D)$/.exec(key);
            if (!match)
                return key;
            let texture = SpineTempletLoader.getTextureByStorageKey(match[1], templet);
            if (!texture)
                return key;
            return `${texture.id}_${match[2]}_${match[3]}_${match[4]}`;
        }
        static getTextureByStorageKey(key, templet) {
            var _a;
            let textures = templet === null || templet === void 0 ? void 0 : templet._textures;
            if (!textures)
                return null;
            let name = (_a = templet.spineMaterialTextures) === null || _a === void 0 ? void 0 : _a[key];
            if (name && textures[name])
                return textures[name];
            for (let name in textures) {
                let texture = textures[name];
                if (texture && (name === key || texture.url === key || texture.uuid === key || String(texture.id) === key))
                    return texture;
            }
            return null;
        }
        static getMaterialURL(ref) {
            if (!ref)
                return null;
            let url = typeof ref === "string" ? ref : ref._$uuid;
            if (!url)
                return null;
            if (url.indexOf("://") == -1 && url.indexOf("/") == -1 && url.indexOf(".") == -1)
                url = "res://" + url;
            return url;
        }
    }
    Laya.Loader.registerLoader(["skel", "json"], SpineTempletLoader, Laya.Loader.SPINE);

    var spine3DVertex = "#if !defined(SpineVertex_lib)\n#define SpineVertex_lib\n#include \"SpineVertexCommon.glsl\";\nuniform mat4 u_WorldMat;uniform vec4 u_WorldInvertFront;struct Vertex{vec3 positionOS;vec3 normalOS;vec2 texCoord0;\n#ifdef UV1\nvec2 texCoord1;\n#endif\nvec4 vertexColor;\n#ifdef LIGHTMAP\nvec4 lightmapScaleOffset;\n#endif LIGHTMAP\n};\n#ifdef LIGHTMAP\n#ifndef GPU_INSTANCE\nuniform vec4 u_LightmapScaleOffset;\n#endif\nvec4 getLightmapScaleOffset(){\n#ifdef GPU_INSTANCE\nreturn a_LightmapScaleOffset;\n#else\nreturn u_LightmapScaleOffset;\n#endif\n}\n#endif\nvoid getVertexParams(inout Vertex vertex){vec4 spinePos2D=getSpinePos();vertex.positionOS=vec3(spinePos2D.xy,0.0);vertex.normalOS=vec3(0.0,0.0,1.0);vertex.vertexColor=vec4(1.0,1.0,1.0,1.0);vertex.vertexColor=a_color;vertex.vertexColor.rgb=pow(vertex.vertexColor.rgb,vec3(2.2));vertex.vertexColor.rgb*=a_color.a;vertex.texCoord0=a_uv;\n#ifdef LIGHTMAP\nvertex.lightmapScaleOffset=getLightmapScaleOffset();\n#endif LIGHTMAP\n}\n#endif\n";

    var spine3DVS = "#define SHADER_NAME Spine3DVS\n#include \"Math.glsl\";\n#include \"Scene.glsl\";\n#include \"SceneFogInput.glsl\";\n#include \"Camera.glsl\";\n#include \"Spine3DVertex.glsl\";\n#ifdef SPINE_BILLBOARD\nuniform mat4 u_spineBillboardMatrix;\n#endif\nvarying vec2 v_texcoord;varying vec4 v_color;varying vec4 v_color2;mat4 getWorldMatrix(){\n#ifdef SPINE_BILLBOARD\nreturn u_spineBillboardMatrix;\n#else\n#ifdef GPU_INSTANCE\nmat4 worldMat=a_WorldMat;\n#else\nmat4 worldMat=u_WorldMat;\n#endif\nreturn worldMat;\n#endif\n}void main(){Vertex vertex;getVertexParams(vertex);v_texcoord=vertex.texCoord0;v_color=vertex.vertexColor;\n#ifdef COLOR2\nv_color2=a_color2;v_color2.rgb=pow(v_color2.rgb,vec3(2.2));\n#else\nv_color2=vec4(0.0,0.0,0.0,1.0);\n#endif\n#ifdef PREMULTIPLYALPHA\nv_color2.xyz=v_color2.xyz*v_color.a;\n#endif\nmat4 worldMat=getWorldMatrix();vec4 pos=worldMat*vec4(vertex.positionOS,1.0);vec3 positionWS=pos.xyz/pos.w;gl_Position=getPositionCS(positionWS);gl_Position=remapPositionZ(gl_Position);\n#ifdef FOG\nFogHandle(gl_Position.z);\n#endif\n}";

    var spine3DFS = "#define SHADER_NAME Spine3DFS\n#include \"Color.glsl\";\n#include \"Scene.glsl\";\n#include \"SceneFog.glsl\";\n#include \"Camera.glsl\";\nvarying vec2 v_texcoord;varying vec4 v_color;varying vec4 v_color2;vec4 getColor(){vec4 color=texture2D(u_spineTexture,v_texcoord.xy);\n#ifdef Gamma_u_spineTexture\ncolor=gammaToLinear(color);\n#endif\nvec4 final;\n#ifdef TWOCOLORTINT\nfinal.a=color.a*v_color.a;final.xyz=((color.a-1.0)*v_color2.a+1.0-color.xyz)*v_color2.xyz+color.xyz*v_color.xyz;\n#else\nfinal=color*v_color;\n#endif\nreturn final;}void main(){gl_FragColor=getColor();gl_FragColor=outputTransform(gl_FragColor);\n#ifdef FOG\ngl_FragColor.rgb=sceneLitFog(gl_FragColor.rgb);\n#endif\n}";

    class Spine3DShaderInit {
        static init() {
            Laya.Shader3D.addInclude("Spine3DVertex.glsl", spine3DVertex);
            Spine3DShaderInit.SPINE_BILLBOARD = Laya.Shader3D.getDefineByName("SPINE_BILLBOARD");
            Spine3DShaderInit.SPINE_BILLBOARD_MATRIX = Laya.Shader3D.propertyNameToID("u_spineBillboardMatrix");
            const commandUniform3D = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("Spine3D");
            commandUniform3D.addShaderUniformArray(SpineShaderInit.BONEMAT, "u_sBone", Laya.ShaderDataType.Vector4, 200);
            commandUniform3D.addShaderUniform(SpineShaderInit.COLOR, "u_color", Laya.ShaderDataType.Vector4);
            commandUniform3D.addShaderUniform(SpineShaderInit.BONEMAT_0, "u_sBone0", Laya.ShaderDataType.Vector4);
            commandUniform3D.addShaderUniform(SpineShaderInit.BONEMAT_1, "u_sBone1", Laya.ShaderDataType.Vector4);
            commandUniform3D.addShaderUniform(SpineShaderInit.SIMPLE_SIMPLEANIMATORPARAMS, "u_SimpleAnimatorParams", Laya.ShaderDataType.Vector4);
            commandUniform3D.addShaderUniform(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURE, "u_SimpleAnimatorTexture", Laya.ShaderDataType.Texture2D);
            commandUniform3D.addShaderUniform(SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURESIZE, "u_SimpleAnimatorTextureSize", Laya.ShaderDataType.Float);
            commandUniform3D.addShaderUniform(SpineShaderInit.SPINE_RENDER_SIZE, "u_spineRenderSize", Laya.ShaderDataType.Vector2);
            commandUniform3D.addShaderUniform(Spine3DShaderInit.SPINE_BILLBOARD_MATRIX, "u_spineBillboardMatrix", Laya.ShaderDataType.Matrix4x4);
            let shader3D = Laya.Shader3D.add("Spine3D", true, false);
            shader3D.shaderType = Laya.ShaderFeatureType.D3;
            let uniformMap3D = {
                "u_spineTexture": Laya.ShaderDataType.Texture2D
            };
            let subShader3D = new Laya.SubShader(SpineShaderInit.textureSpineAttribute, uniformMap3D);
            shader3D.addSubShader(subShader3D);
            subShader3D.addShaderPass(spine3DVS, spine3DFS);
        }
    }

    exports.AnimationRender = AnimationRender;
    exports.AttachmentParse = AttachmentParse;
    exports.BakedSpine2DRenderer = BakedSpine2DRenderer;
    exports.BakedSpineRenderer = BakedSpineRenderer;
    exports.BaseOptimizeRender = BaseOptimizeRender;
    exports.ChangeDeform = ChangeDeform;
    exports.ChangeDrawOrder = ChangeDrawOrder;
    exports.ChangeRGBA = ChangeRGBA;
    exports.ChangeSlot = ChangeSlot;
    exports.ExternalSkin = ExternalSkin;
    exports.ExternalSkinItem = ExternalSkinItem;
    exports.IBCreator = IBCreator;
    exports.JSSpineFactory = JSSpineFactory;
    exports.MultiRenderData = MultiRenderData;
    exports.NativeSkeletonOptimise = NativeSkeletonOptimise;
    exports.NativeSpineFactory = NativeSpineFactory;
    exports.NativeSpineOptimizeRender2D = NativeSpineOptimizeRender2D;
    exports.NativeSpineOptimizeRender3D = NativeSpineOptimizeRender3D;
    exports.NativeSpineOptimizeRenderBase = NativeSpineOptimizeRenderBase;
    exports.NativeSpineRenderDataHandle = NativeSpineRenderDataHandle;
    exports.NativeSpineTempletParser = NativeSpineTempletParser;
    exports.OptimizedSpineRenderer = OptimizedSpineRenderer;
    exports.RigidBodySpineRenderer = RigidBodySpineRenderer;
    exports.SkeletonOptimise = SkeletonOptimise;
    exports.SkinAniRenderData = SkinAniRenderData;
    exports.SkinAttach = SkinAttach;
    exports.Spine2DNormalRenderUpdater = Spine2DNormalRenderUpdater;
    exports.Spine2DRenderNode = Spine2DRenderNode;
    exports.Spine3DShaderInit = Spine3DShaderInit;
    exports.SpineAdapter = SpineAdapter;
    exports.SpineBakeScript = SpineBakeScript;
    exports.SpineBaseRenderer = SpineBaseRenderer;
    exports.SpineBoneRegistry = SpineBoneRegistry;
    exports.SpineBufferView = SpineBufferView;
    exports.SpineConst = SpineConst;
    exports.SpineGlobalMeshManager = SpineGlobalMeshManager;
    exports.SpineInstanceBatch = SpineInstanceBatch;
    exports.SpineInstanceElement2DTool = SpineInstanceElement2DTool;
    exports.SpineMeshUtils = SpineMeshUtils;
    exports.SpineNormalBatch = SpineNormalBatch;
    exports.SpineNormalRenderUpdater = SpineNormalRenderUpdater;
    exports.SpineOptimizeRender2D = SpineOptimizeRender2D;
    exports.SpineOptimizeRender3D = SpineOptimizeRender3D;
    exports.SpineRenderUpdater = SpineRenderUpdater;
    exports.SpineShaderInit = SpineShaderInit;
    exports.SpineSkeleton = SpineSkeleton;
    exports.SpineTemplet = SpineTemplet;
    exports.SpineTempletLoader = SpineTempletLoader;
    exports.SpineTexture = SpineTexture;
    exports.SpineWholeBuffer = SpineWholeBuffer;
    exports.StandardSpine2DRenderer = StandardSpine2DRenderer;
    exports.StandardSpineRenderer = StandardSpineRenderer;
    exports.VBBoneCreator = VBBoneCreator;
    exports.VBCreator = VBCreator;
    exports.VBRigBodyCreator = VBRigBodyCreator;
    exports.WebSpineRenderDataHandle = WebSpineRenderDataHandle;
    exports.WebSpineTempletParser = WebSpineTempletParser;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.native-spine42.js.map
