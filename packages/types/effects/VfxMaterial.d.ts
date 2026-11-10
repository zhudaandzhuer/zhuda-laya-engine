// Generated from TypeScript source; run npm run types:generate.
export interface VfxMaterialSpec {
    version: 1;
    maskTexture?: string;
    noiseTexture?: string;
    dissolve?: number;
    edgeWidth?: number;
    edgeColor?: string;
    intensity?: number;
    uvScroll?: {
        x: number;
        y: number;
    };
    uvDistortion?: number;
    refraction?: number;
    softDistance?: number;
}
export declare function validateVfxMaterial(s: VfxMaterialSpec): string[];
export declare const ZHUDA_VFX_VERTEX = "\n#define SHADER_NAME ZhudaVfxVS\n#include \"Camera.glsl\";\n#include \"Sprite3DVertex.glsl\";\n#include \"VertexCommon.glsl\";\nvarying vec2 v_UV; varying vec4 v_Color; varying vec4 v_Clip; varying float v_EyeDepth;\nvoid main(){\n  Vertex vertex; getVertexParams(vertex);\n  v_UV=vertex.texCoord0; v_Color=vertex.vertexColor;\n  vec4 world=getWorldMatrix()*vec4(vertex.positionOS,1.0);\n  vec4 clip=getPositionCS(world.xyz/world.w); v_Clip=clip;\n  v_EyeDepth=-(u_View*world).z;\n  gl_Position=remapPositionZ(clip);\n}";
export declare const ZHUDA_VFX_FRAGMENT = "\n#define SHADER_NAME ZhudaVfxFS\n#include \"Camera.glsl\";\nvarying vec2 v_UV; varying vec4 v_Color; varying vec4 v_Clip; varying float v_EyeDepth;\nuniform sampler2D u_BaseTexture; uniform sampler2D u_MaskTexture; uniform sampler2D u_NoiseTexture;\nuniform vec4 u_VfxParams; uniform vec4 u_UVParams; uniform vec4 u_EdgeColor; uniform vec4 u_VfxFlags; uniform float u_VfxTime;\nvoid main(){\n  vec2 uv=v_UV+u_UVParams.xy*u_VfxTime;\n  vec2 flow=texture2D(u_NoiseTexture,uv).rg*2.0-1.0;\n  vec4 base=texture2D(u_BaseTexture,uv+flow*u_UVParams.z)*v_Color;\n  float noise=texture2D(u_NoiseTexture,uv).r;\n  float visible=1.0; float edge=0.0;\n  if(u_VfxParams.x>0.0){\n    visible=smoothstep(u_VfxParams.x,u_VfxParams.x+max(0.001,u_VfxParams.y),noise);\n    edge=visible*(1.0-smoothstep(u_VfxParams.x+u_VfxParams.y,u_VfxParams.x+2.0*max(0.001,u_VfxParams.y),noise));\n  }\n  if(u_VfxParams.x>=1.0)visible=0.0;\n  base.a*=texture2D(u_MaskTexture,v_UV).r*visible;\n  base.rgb=base.rgb*u_VfxParams.z+u_EdgeColor.rgb*edge*u_EdgeColor.a;\n  vec2 screen=v_Clip.xy/v_Clip.w*0.5+0.5;\n  screen.y=mix(screen.y,1.0-screen.y,u_VfxFlags.y);\n  if(u_UVParams.w>0.0){vec3 scene=texture2D(u_CameraOpaqueTexture,clamp(screen+flow*u_UVParams.w,0.001,0.999)).rgb;base.rgb=mix(base.rgb,scene,0.85);}\n  if(u_VfxParams.w>0.0){float d=texture2D(u_CameraDepthTexture,screen).r;float eye=1.0/(u_ZBufferParams.z*d+u_ZBufferParams.w);base.a*=clamp((eye-v_EyeDepth)/u_VfxParams.w,0.0,1.0);}\n  gl_FragColor=base;\n}";
/** Laya 3.4.2 mesh material. Textures are borrowed and detached on disposal. Requires camera depth/opaque passes for soft particles/refraction. */
export declare class ZhudaVfxMaterial {
    readonly material: any;
    private spec;
    private readonly resolveTexture;
    private readonly baseTexture;
    private disposed;
    constructor(spec: VfxMaterialSpec, baseTexture: any, resolveTexture: (key: string) => any, blend?: 'alpha' | 'additive');
    descriptor(): VfxMaterialSpec;
    configure(patch: Partial<VfxMaterialSpec>): void;
    setTime(seconds: number): void;
    setScreenFlipY(flip: boolean): void;
    private apply;
    dispose(): void;
}
/** Explicit ownership of additional camera passes; restore the original state when leaving the scene. */
export declare class ZhudaVfxCamera {
    private static owners;
    private disposed;
    private readonly depth;
    private readonly opaque;
    private readonly post;
    private readonly bloom;
    private readonly ownedPost;
    readonly camera: any;
    constructor(camera: any, options?: {
        softParticles?: boolean;
        refraction?: boolean;
        bloomIntensity?: number;
    });
    dispose(): void;
}
