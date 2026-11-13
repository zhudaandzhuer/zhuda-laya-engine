/**
 * Shadows from one point light. LayaAir 3.4.2 draws none: a lamp lights the
 * far side of a wall as brightly as the near side.
 *
 * The light's surroundings are drawn six times from the light itself (the six
 * faces of a cube), each as a picture of distances, into one texture of 3 by
 * 2 tiles. LayaAir's own point-light function is then asked, for the light at
 * that position only, whether the surface it lights is farther from the lamp
 * than what the picture holds in that direction.
 *
 * The patch is installed before `Laya.init` (`installLaya342PointShadows`) and
 * compiles to the upstream code unless a scene switches the
 * `ZHUDA_POINT_SHADOW` define on, which `ZhudaPointShadow` does. The pictures
 * are drawn when `render` is called, not every frame: what moves afterwards
 * keeps its old shadow until `render` is called again.
 */
import { prepareLaya342ManualDraw } from './Laya342Adapters.ts';

/** The scene define that switches the shadow lookup on. */
export const ZHUDA_POINT_SHADOW_DEFINE = 'ZHUDA_POINT_SHADOW';

/** Point lights one `ZhudaPointShadow` can hold, and the lit shaders look up. */
export const ZHUDA_POINT_SHADOW_MAX_LIGHTS = 4;

const LIGHT_HEAD = 'Light getLight(in PointLight pointLight,';
const LIGHT_TAIL =
  'light.attenuation=pointLight.attenuation;return light;}Light getLight(in SpotLight';
// Faces: +X, -X, +Y, -Y, +Z, -Z at tiles 0..5; `forward` and `up` of the view
// that drew each are repeated in the lookup below.
const FACES: readonly { forward: readonly number[]; up: readonly number[] }[] = [
  { forward: [1, 0, 0], up: [0, 1, 0] },
  { forward: [-1, 0, 0], up: [0, 1, 0] },
  { forward: [0, 1, 0], up: [0, 0, 1] },
  { forward: [0, -1, 0], up: [0, 0, 1] },
  { forward: [0, 0, 1], up: [0, 1, 0] },
  { forward: [0, 0, -1], up: [0, 1, 0] },
];
// A tile is stored top row first (measured on WebGL: the lookup flips v).
// u_ZhudaPointShadowInfo is two texels: the light's position, then the reach
// of the pictures, the bias as a share of it, the strength and one texel of a
// tile. They travel in a texture because the scene's other uniforms live in
// one block whose layout LayaAir fixes from its uniform map: two more vectors
// in that map moved every member behind them in each shader that did not
// declare them, and all point and spot lights went dark. Samplers are not in
// the block. Four taps soften the edge. The lookups name
// their level: they sit behind a test of which light this is. There is no
// \`#else\`: LayaAir's own shader preprocessor dropped that branch, and the
// function then returned nothing where the define was off. The samplers
// are written out here: LayaAir's lit shaders take their scene uniforms from
// the text of the includes, and from the scene's uniform map only where to
// find each value.
const SHADOW_FUNCTION = `#ifdef ${ZHUDA_POINT_SHADOW_DEFINE}
uniform sampler2D u_ZhudaPointShadowMap;
uniform sampler2D u_ZhudaPointShadowInfo;
// One comparison with the pictures, filtered between the four nearest texels.
float zhudaPointShadowTap(vec2 at,vec2 atlas,float mine){
vec2 t=at*atlas-0.5;vec2 f=fract(t);vec2 s=1.0/atlas;vec2 b=(floor(t)+0.5)*s;
float a=step(mine,texture2DLodEXT(u_ZhudaPointShadowMap,b,0.0).r);
float c=step(mine,texture2DLodEXT(u_ZhudaPointShadowMap,b+vec2(s.x,0.0),0.0).r);
float d=step(mine,texture2DLodEXT(u_ZhudaPointShadowMap,b+vec2(0.0,s.y),0.0).r);
float e=step(mine,texture2DLodEXT(u_ZhudaPointShadowMap,b+s,0.0).r);
return mix(mix(a,c,f.x),mix(d,e,f.x),f.y);
}
#endif
float zhudaPointShadow(vec3 lightPosition,vec3 normalWS,vec3 positionWS){
float shade=1.0;
#ifdef ${ZHUDA_POINT_SHADOW_DEFINE}
for(int k=0;k<${ZHUDA_POINT_SHADOW_MAX_LIGHTS};k++){
float row=(float(k)+0.5)/${ZHUDA_POINT_SHADOW_MAX_LIGHTS}.0;
vec4 where=texture2DLodEXT(u_ZhudaPointShadowInfo,vec2(0.5/3.0,row),0.0);
vec3 apart=lightPosition-where.xyz;
if(where.w>0.5&&dot(apart,apart)<=0.0004){
vec4 params=texture2DLodEXT(u_ZhudaPointShadowInfo,vec2(1.5/3.0,row),0.0);
vec4 extra=texture2DLodEXT(u_ZhudaPointShadowInfo,vec2(2.5/3.0,row),0.0);
float texel=params.w;
vec3 v=positionWS-lightPosition;
float m=max(abs(v.x),max(abs(v.y),abs(v.z)));
// A texel of the pictures is this wide here. A surface the light grazes would
// shade itself: the lookup moves out from it by a texel and a half, and what
// it is compared with moves toward the lamp by as much as the filtered taps
// can reach along a surface that steep.
float world=2.0*m*texel;
float facing=clamp(dot(normalWS,-normalize(v)),0.05,1.0);
float slope=min(sqrt(1.0-facing*facing)/facing,10.0);
v+=normalWS*(world*1.5);
vec3 a=abs(v);m=max(a.x,max(a.y,a.z));
vec3 f;vec3 u;float tile;
if(a.x>=a.y&&a.x>=a.z){f=vec3(sign(v.x),0.0,0.0);u=vec3(0.0,1.0,0.0);tile=v.x>0.0?0.0:1.0;}
else if(a.y>=a.z){f=vec3(0.0,sign(v.y),0.0);u=vec3(0.0,0.0,1.0);tile=v.y>0.0?2.0:3.0;}
else{f=vec3(0.0,0.0,sign(v.z));u=vec3(0.0,1.0,0.0);tile=v.z>0.0?4.0:5.0;}
vec3 r=cross(f,u);
vec2 uv=vec2(dot(v,r),dot(v,u))/m*0.5+0.5;
float mine=(m-world*(1.0+0.5*max(extra.x,0.0))*slope)/params.x-params.y;
float rows=2.0*extra.y;
vec2 atlas=vec2(3.0,rows)/texel;
float spread=max(extra.x,0.0)*texel;
float lit=0.0;
for(int i=0;i<4;i++){
vec2 o=vec2(float(i/2),mod(float(i),2.0))-0.5;
vec2 p=clamp(uv+o*spread,vec2(texel*1.5),vec2(1.0-texel*1.5));
p.y=1.0-p.y;
vec2 at=(vec2(mod(tile,3.0),floor(tile/3.0)+2.0*float(k))+p)/vec2(3.0,rows);
lit+=zhudaPointShadowTap(at,atlas,mine);
}
shade=mix(1.0-params.z,1.0,lit*0.25);
break;
}
}
#endif
return shade;
}
`;

const patched = new WeakSet<object>();
const applied = new WeakSet<object>();
const declared = new WeakSet<object>();

function declare(l: any): boolean {
  if (declared.has(l.Shader3D)) return true;
  const map =
    l.Scene3D?.sceneUniformMap ?? l.LayaGL?.renderDeviceFactory?.createGlobalUniformMap?.('Scene3D');
  if (!map?.addShaderUniform) return false;
  const add = (name: string, type: unknown) =>
    map.addShaderUniform(l.Shader3D.propertyNameToID(name), name, type);
  // Textures only: see the note on the shader above.
  add('u_ZhudaPointShadowMap', l.ShaderDataType.Texture2D);
  add('u_ZhudaPointShadowInfo', l.ShaderDataType.Texture2D);
  declared.add(l.Shader3D);
  return true;
}

/**
 * Teaches Laya 3.4.2's point lights to ask for a shadow. Must run before
 * `Laya.init`, which registers the lighting include and compiles the lit
 * shaders from it. Returns false when there is no runtime to patch.
 */
export function installLaya342PointShadows(runtime: any = (globalThis as any).Laya): boolean {
  const shader = runtime?.Shader3D;
  if (!shader || typeof shader.addInclude !== 'function') return false;
  if (patched.has(shader)) return true;
  const addInclude = shader.addInclude;
  shader.addInclude = function (name: string, text: string, ...rest: unknown[]) {
    if (
      name === 'Lighting.glsl' &&
      typeof text === 'string' &&
      text.includes(LIGHT_HEAD) &&
      text.includes(LIGHT_TAIL)
    ) {
      text = text
        // On a line of its own: the include is one long line and `#ifdef` must start one.
        .replace(LIGHT_HEAD, '\n' + SHADOW_FUNCTION + LIGHT_HEAD)
        .replace(
          LIGHT_TAIL,
          'light.attenuation=pointLight.attenuation*zhudaPointShadow(pointLight.position,normalWS,positionWS);return light;}Light getLight(in SpotLight',
        );
      applied.add(shader);
      // As early as the include itself, so that every shader compiled from
      // here on finds the two textures in the scene's values.
      declare(runtime);
    }
    return addInclude.call(this, name, text, ...rest);
  };
  patched.add(shader);
  return true;
}

export interface ZhudaPointShadowOptions {
  /** Edge of each of the six pictures in pixels: 256, 512 or 1024 (default 512). */
  resolution?: 256 | 512 | 1024;
  /**
   * Nothing closer to the light than this casts a shadow, in metres (default
   * 0.5): the lamp's own head, which would otherwise shade everything.
   */
  near?: number;
  /** How dark the shadow is, 0..1 (default 1). */
  strength?: number;
  /** Distance in metres a surface may be behind the picture and still be lit (default 0.03). */
  bias?: number;
  /**
   * Width of the shadow's edge in texels of the pictures, 0..4 (default 2).
   * The edge widens with distance from the lamp, as each texel does.
   */
  softness?: number;
  /** Point lights this one holds pictures for, 1..4 (default 1): `render(..., light)`. */
  lights?: number;
}

export function validateZhudaPointShadow(options: ZhudaPointShadowOptions): string[] {
  const issues: string[] = [];
  const o = options ?? {};
  if (o.resolution !== undefined && ![256, 512, 1024].includes(o.resolution))
    issues.push('resolution: use 256, 512 or 1024');
  const range = (key: 'near' | 'strength' | 'bias' | 'softness', min: number, max: number) => {
    const value = o[key];
    if (value !== undefined && !(typeof value === 'number' && value >= min && value <= max))
      issues.push(`${key}: use ${min}..${max}`);
  };
  range('near', 0.01, 10);
  range('strength', 0, 1);
  range('bias', 0, 1);
  range('softness', 0, 4);
  const lights: unknown = o.lights;
  if (
    lights !== undefined &&
    !(
      typeof lights === 'number' &&
      Number.isInteger(lights) &&
      lights >= 1 &&
      lights <= ZHUDA_POINT_SHADOW_MAX_LIGHTS
    )
  )
    issues.push(`lights: use a whole number 1..${ZHUDA_POINT_SHADOW_MAX_LIGHTS}`);
  else if ((o.resolution ?? 512) * 2 * ((lights as number | undefined) ?? 1) > 4096)
    issues.push('resolution: 1024 holds at most two lights (the pictures are 4096 tall at most)');
  return issues;
}

const DEPTH_VERTEX =
  '#define SHADER_NAME ZhudaPointShadowDepthVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}';
// The distance along the view of what was drawn, as a share of the reach.
const DEPTH_FRAGMENT = `#define SHADER_NAME ZhudaPointShadowDepthFS
#include "Color.glsl";
#include "Camera.glsl";
varying vec2 v_Texcoord0;
void main(){
float eye=1.0/(u_ZBufferParams.z*texture2D(u_CameraDepthTexture,v_Texcoord0).x+u_ZBufferParams.w);
gl_FragColor=vec4(vec3(eye/u_ZhudaPointShadowReach.x),1.0);
}`;
const depthRegistered = new WeakSet<object>();
function registerDepth(l: any) {
  if (depthRegistered.has(l.Shader3D)) return;
  const shader = l.Shader3D.add('ZhudaPointShadowDepth');
  shader.shaderType = l.ShaderFeatureType.PostProcess;
  const sub = new l.SubShader(
    { a_PositionTexcoord: [l.VertexMesh.MESH_POSITION0, l.ShaderDataType.Vector4] },
    {
      u_MainTex: l.ShaderDataType.Texture2D,
      u_ZhudaPointShadowReach: l.ShaderDataType.Vector4,
    },
  );
  shader.addSubShader(sub);
  const pass = sub.addShaderPass(DEPTH_VERTEX, DEPTH_FRAGMENT);
  pass.statefirst = true;
  pass.renderState.cull = l.RenderState.CULL_NONE;
  depthRegistered.add(l.Shader3D);
}

export class ZhudaPointShadow {
  private readonly scene: any;
  private readonly options: Required<ZhudaPointShadowOptions>;
  private readonly camera: any;
  private readonly target: any;
  private readonly material: any;
  private readonly info: any;
  private readonly values = new Float32Array(3 * 4 * ZHUDA_POINT_SHADOW_MAX_LIGHTS);
  private readonly active: boolean[];
  private disposed = false;
  /** Whether pictures have been drawn for some light and the scene is using them. */
  drawn = false;

  constructor(scene: any, options: ZhudaPointShadowOptions = {}) {
    const issues = validateZhudaPointShadow(options);
    if (issues.length) throw Error('Invalid point shadow: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    if (!l?.MaterialPostProcessEffect)
      throw Error('Point shadows need the Laya post-process module');
    if (!applied.has(l.Shader3D))
      throw Error(
        'Point shadows need installLaya342PointShadows() before Laya.init (ZhudaEngine.boot does it)',
      );
    if (!declare(l)) throw Error('Point shadows could not declare their scene uniforms');
    for (const capability of ['RenderTextureFormat_R16G16B16A16', 'TextureFormat_R32G32B32A32'])
      if (!l.LayaGL.renderEngine.getCapable(l.RenderCapable[capability]))
        throw Error('Point shadows require ' + capability);
    this.scene = scene;
    this.options = {
      resolution: options.resolution ?? 512,
      near: options.near ?? 0.5,
      strength: options.strength ?? 1,
      bias: options.bias ?? 0.03,
      softness: options.softness ?? 2,
      lights: options.lights ?? 1,
    };
    this.active = new Array(this.options.lights).fill(false);
    const n = this.options.resolution;
    // Three by two tiles per light, the lights one above the other.
    this.target = new l.RenderTexture(
      n * 3,
      n * 2 * this.options.lights,
      l.RenderTargetFormat.R16G16B16A16,
      l.RenderTargetFormat.DEPTH_16,
      false,
      1,
      false,
      false,
    );
    this.target.filterMode = l.FilterMode.Point;
    this.target.wrapModeU = this.target.wrapModeV = l.WrapMode.Clamp;
    // Three texels per light, a row for each light the shaders look up.
    this.info = new l.Texture2D(
      3,
      ZHUDA_POINT_SHADOW_MAX_LIGHTS,
      l.TextureFormat.R32G32B32A32,
      false,
      false,
      false,
    );
    this.info.filterMode = l.FilterMode.Point;
    this.info.wrapModeU = this.info.wrapModeV = l.WrapMode.Clamp;
    this.info.setPixelsData(this.values, false, false);
    registerDepth(l);
    this.material = new l.Material();
    this.material.setShaderName('ZhudaPointShadowDepth');
    this.material.setVector4('u_ZhudaPointShadowReach', new l.Vector4(1, 0, 0, 0));
    const effect = new l.MaterialPostProcessEffect();
    effect.material = this.material;
    const post = new l.PostProcess();
    post.addEffect(effect);
    const camera = (this.camera = new l.Camera(1, this.options.near, 100));
    camera.name = 'zhuda-point-shadow';
    camera.fieldOfView = 90;
    camera.clearFlag = l.CameraClearFlags.SolidColor;
    camera.clearColor = new l.Color(1, 1, 1, 1);
    camera.enableHDR = true;
    camera.postProcess = post;
    camera.depthTextureMode |= l.DepthTextureMode.Depth;
    camera.renderTarget = this.target;
    camera.renderingOrder = -210;
    // Drawn by `render`, not by the engine's frame loop.
    camera.enableRender = false;
    scene.addChild(camera);
  }

  /**
   * Draws the six pictures of `light` (0 up to `lights` - 1) from `position`
   * out to `range` metres and switches the shadow on for the point light at
   * that position. Call again after the light or anything that should cast a
   * shadow has moved.
   */
  render(position: readonly number[], range: number, light = 0): void {
    if (this.disposed) throw Error('Disposed point shadow');
    if (!(Number.isInteger(light) && light >= 0 && light < this.options.lights))
      throw Error(`Invalid point shadow light: use 0..${this.options.lights - 1}`);
    if (
      position.length !== 3 ||
      !position.every(Number.isFinite) ||
      !(range > this.options.near) ||
      !Number.isFinite(range)
    )
      throw Error('Invalid point shadow: a position and a range beyond `near` are required');
    const l = (globalThis as any).Laya;
    const { camera, scene, target } = this;
    const define = l.Shader3D.getDefineByName(ZHUDA_POINT_SHADOW_DEFINE);
    // The pictures are drawn without this light's own shadow in them.
    scene._shaderValues.removeDefine(define);
    camera.nearPlane = this.options.near;
    camera.farPlane = range;
    this.material.setVector4('u_ZhudaPointShadowReach', new l.Vector4(range, 0, 0, 0));
    const before = l.Stat.enableShadow;
    l.Stat.enableShadow = false;
    try {
      FACES.forEach((face, tile) => {
        camera.transform.position = new l.Vector3(position[0], position[1], position[2]);
        camera.transform.lookAt(
          new l.Vector3(
            position[0] + face.forward[0],
            position[1] + face.forward[1],
            position[2] + face.forward[2],
          ),
          new l.Vector3(face.up[0], face.up[1], face.up[2]),
          false,
        );
        const rows = 2 * this.options.lights;
        camera.normalizedViewport = new l.Viewport(
          (tile % 3) / 3,
          (Math.floor(tile / 3) + 2 * light) / rows,
          1 / 3,
          1 / rows,
        );
        prepareLaya342ManualDraw(scene);
        l.Camera.drawRenderTextureByScene(camera, scene, target);
        camera.renderTarget = target;
      });
    } finally {
      l.Stat.enableShadow = before;
      camera.renderTarget = target;
    }
    this.values.set(
      [
        position[0],
        position[1],
        position[2],
        1,
        range,
        this.options.bias / range,
        this.options.strength,
        1 / this.options.resolution,
        this.options.softness,
        this.options.lights,
        0,
        0,
      ],
      light * 12,
    );
    this.active[light] = true;
    this.publish();
  }

  /** Switches the shadow of `light` off; its light is drawn as without shadows. */
  clear(light = 0): void {
    if (this.disposed) throw Error('Disposed point shadow');
    if (!(Number.isInteger(light) && light >= 0 && light < this.options.lights))
      throw Error(`Invalid point shadow light: use 0..${this.options.lights - 1}`);
    this.values.fill(0, light * 12, light * 12 + 12);
    this.active[light] = false;
    this.publish();
  }

  private publish(): void {
    const l = (globalThis as any).Laya;
    const { scene, target } = this;
    const define = l.Shader3D.getDefineByName(ZHUDA_POINT_SHADOW_DEFINE);
    // In place: allocating again would be refused (the texture is immutable).
    this.info.setSubPixelsData(
      0,
      0,
      3,
      ZHUDA_POINT_SHADOW_MAX_LIGHTS,
      this.values,
      0,
      false,
      false,
      false,
    );
    scene.setGlobalShaderValue('u_ZhudaPointShadowMap', l.ShaderDataType.Texture2D, target);
    scene.setGlobalShaderValue('u_ZhudaPointShadowInfo', l.ShaderDataType.Texture2D, this.info);
    this.drawn = this.active.some(Boolean);
    if (this.drawn) scene._shaderValues.addDefine(define);
    else scene._shaderValues.removeDefine(define);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const l = (globalThis as any).Laya;
    if (!this.scene.destroyed)
      this.scene._shaderValues?.removeDefine(l.Shader3D.getDefineByName(ZHUDA_POINT_SHADOW_DEFINE));
    this.camera.renderTarget = null;
    this.camera.postProcess = null;
    this.camera.destroy(true);
    this.target.destroy();
    this.info.destroy();
    this.material.destroy();
  }
}
