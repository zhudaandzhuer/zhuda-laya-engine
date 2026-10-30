/** Generated public effects and visual migration declarations. */
import type { ZhudaParticleSystem, ZhudaParticleSystem3D, ParticleEvent } from './zhuda-particles';
export interface EffectKey {
    time: number;
    value: number;
}
export interface EffectTrack {
    target: string;
    parameter: string;
    keys: EffectKey[];
}
export interface EffectCue {
    time: number;
    target: string;
    action: 'start' | 'stop' | 'event';
    name?: string;
}
export interface EffectAnchor {
    x: number;
    y: number;
    z?: number;
    rotation?: number;
    quaternion?: {x:number;y:number;z:number;w:number};
    scale?: {x:number;y:number;z:number};
    worldMatrix?: ArrayLike<number>;
}
export interface EffectAttachment {
    target: string;
    source: string;
    anchor: string;
    offset?: EffectAnchor;
}
export interface EffectTimelineSpec {
    version: 1;
    duration: number;
    loop?: boolean;
    tracks?: EffectTrack[];
    cues?: EffectCue[];
    attachments?: EffectAttachment[];
}
export interface EffectBinding {
    reset(): void;
    setParameter?(name: string, value: number): void;
    start?(name?: string): void;
    stop?(): void;
    event?(name: string): void;
    resolveAnchor?(name: string): EffectAnchor | null;
    setTransform?(value: EffectAnchor): void;
}
export declare function validateEffectTimeline(s: EffectTimelineSpec): string[];
/** Serializable choreography. Bindings own scene objects, sound and Spine APIs. Seek suppresses external event cues by default. */
export declare class ZhudaEffectDirector {
    readonly spec: EffectTimelineSpec;
    time: number;
    playing: boolean;
    cycle: number;
    private initial;
    private readonly bindings;
    constructor(spec: EffectTimelineSpec, bindings: Record<string, EffectBinding>);
    reset(): void;
    play(restart?: boolean): void;
    pause(): void;
    stop(): void;
    update(dt: number): void;
    seek(time: number, dispatchEvents?: boolean): void;
    private advance;
    private apply;
}

export interface EffectBudgetSpec {
    maxParticles: number;
    maxCoverage: number;
    targetFrameMs?: number;
    minQuality?: number;
}
export interface EffectBudgetRequest {
    id: string;
    particles: number;
    coverage: number;
    priority: number;
    visible?: boolean;
    distance?: number;
}
export interface EffectAllocation {
    id: string;
    particleLimit: number;
    emissionScale: number;
}
/** Global admission plan. Lower limits stop new births; living particles drain naturally. */
export declare class ZhudaEffectBudget {
    readonly spec: EffectBudgetSpec;
    quality: number;
    private slow;
    private fast;
    constructor(spec: EffectBudgetSpec);
    observeFrame(ms: number): void;
    allocate(requests: readonly EffectBudgetRequest[]): EffectAllocation[];
}
export interface RuntimeFrameSample {
    frameMs: number;
    cpuMs: number;
    drawCalls: number;
    triangles: number;
}
/** Measures actual intercepted WebGL calls; does not infer GPU completion from CPU elapsed time. */
export declare class ZhudaRuntimeProfiler {
    private calls;
    private triangles;
    private contexts;
    private restore;
    private samples;
    attach(gl: any): void;
    beginFrame(): void;
    endFrame(frameMs: number, cpuMs: number): RuntimeFrameSample;
    report(): {
        measured: boolean;
        gpuTimeMs: null;
        gpuTimeReason: string;
        samples: {
            frameMs: number;
            cpuMs: number;
            drawCalls: number;
            triangles: number;
        }[];
        frameP95Ms: number | null;
    };
    dispose(): void;
}

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

/** Links collision/death events to a bounded child emitter. The child is advanced by its application's loop. */
export declare class ZhudaParticleEventLink {
    private disposed;
    private readonly previous;
    private readonly listener;
    readonly source: ZhudaParticleSystem | ZhudaParticleSystem3D;
    readonly child: ZhudaParticleSystem | ZhudaParticleSystem3D;
    constructor(source: ZhudaParticleSystem | ZhudaParticleSystem3D, child: ZhudaParticleSystem | ZhudaParticleSystem3D, options: {
        event: 'collision' | 'death';
        count: number;
    });
    dispose(): void;
}

export interface UnityVisualMaterial {
    id: string;
    shader: string;
    color?: [number, number, number, number];
    metallic?: number;
    smoothness?: number;
    emission?: [number, number, number];
    transparent?: boolean;
    textures?: {
        albedo?: string;
        normal?: string;
        metallicGloss?: string;
        emission?: string;
    };
    vfx?: VfxMaterialSpec;
}
export interface MigratedVisualMaterial {
    id: string;
    target: 'PBRStandardMaterial' | 'UnlitMaterial' | 'ZhudaVfx';
    properties: Record<string, any>;
    textures: Record<string, string>;
    vfx?: VfxMaterialSpec;
}
/** Converts explicit Unity exporter data. Unknown shaders block conversion instead of silently falling back to BlinnPhong. */
export declare function convertUnityVisualMaterial(input: UnityVisualMaterial): MigratedVisualMaterial;
export declare function instantiateMigratedMaterial(spec: MigratedVisualMaterial, resolve: (key: string) => any): any;
/** Dispose a migrated material without cascading into shared application textures. */
export declare function disposeMigratedMaterial(material: any): void;
export interface UnityCurveKey {
    time: number;
    value: number;
    inTangent?: number;
    outTangent?: number;
    weightedMode?: number;
}
/** Adaptive Hermite baking with an explicit error bound at quarter points. Weighted tangents need an exporter-side bake. */
export declare function convertUnityAnimationCurve(keys: readonly UnityCurveKey[], tolerance?: number): EffectKey[];
export interface VisualFrameMetrics {
    passed: boolean;
    intersectionOverUnion: number;
    sourcePixels: number;
    targetPixels: number;
    centroidErrorPx: number;
}
/** Compare aligned RGBA captures by silhouette. Color is intentionally excluded; render timing and viewport must be matched by the caller. */
export declare function compareVisualFrames(source: ArrayLike<number>, target: ArrayLike<number>, width: number, height: number, options?: {
    alphaThreshold?: number;
    minIoU?: number;
    maxCentroidErrorPx?: number;
}): VisualFrameMetrics;
