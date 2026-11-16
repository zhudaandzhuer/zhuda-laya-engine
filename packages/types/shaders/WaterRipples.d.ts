// Generated from TypeScript source; run npm run types:generate.
/**
 * Ripples from bodies in the water, for `ZhudaWaterSurface.setRipples`: rings
 * spreading from each body, the V of waves a moving one leaves behind it and
 * a little froth at its waterline. They are drawn, not simulated: a height
 * that is a function of where and when, whose slope tilts the water's normal
 * (and so the mirror, the view of the bed and the sun's glint).
 *
 * The rings: waves 0.32 m apart, once a second, fading over 1.4 m. The wake:
 * every point a body passes sends out a ring that spreads at 0.5 m/s, so the
 * two arms open at atan(0.5 / speed) behind it, crests 0.35 m apart that are
 * gone in about 2.5 s; between them, waves across the path, 2πv²/g apart and
 * still in the body's frame (as in a ship's Kelvin wake). `zhudaWaterRipple`
 * is the shader's function in TypeScript (`RIPPLE_GLSL`).
 *
 * No Laya imports: film scene validation reads this module.
 */
/** A body in the water. */
export interface ZhudaWaterRipple {
    /** Where it is on the water, in metres. */
    x: number;
    z: number;
    /** Its radius at the waterline, 0.05..20 m: the rings start there and nothing is drawn under its middle. */
    radius: number;
    /** How strong the ripples are, 0..2 (1 suits a swimmer or a small boat; 0 draws none). */
    strength: number;
    /** Metres a second it moves along X and Z, each -30..30 (default still): a moving body leaves a wake. */
    velocity?: readonly [number, number];
}
/** How many bodies one water surface ripples for at once. */
export declare const ZHUDA_WATER_MAX_RIPPLES = 4;
/** Lists what is wrong with the sources; empty when they are valid. */
export declare function validateZhudaWaterRipples(sources: readonly ZhudaWaterRipple[], path?: string): string[];
/**
 * Height in metres the bodies raise the water by at x, z at `seconds` of the
 * water's time, and how much froth there is (0..2). The shader's function.
 */
export declare function zhudaWaterRipple(x: number, z: number, sources: readonly ZhudaWaterRipple[], seconds: number): {
    height: number;
    froth: number;
};
/**
 * The same in GLSL, for the water's surface code: `zhudaWaterRipples(p)`
 * returns (height, froth) at a point of the water plane. It reads
 * `u_ZhudaWaterRippleA0..3` (x, z, radius, strength), `u_ZhudaWaterRippleB0..3`
 * (velocity x, z) and the water's time in `u_ZhudaWaterFlow.z`.
 */
export declare const RIPPLE_GLSL = "vec2 zhudaWaterRippleOne(vec2 p,vec4 a,vec4 b){\nif(a.w<=0.0)return vec2(0.0);\nvec2 d=p-a.xy;\nfloat dist=length(d);\nfloat speed=length(b.xy);\nif(dist>a.z+4.0+speed*6.0)return vec2(0.0);\nfloat t=u_ZhudaWaterFlow.z;\nfloat gap=max(dist-a.z,0.0);\nfloat h=0.012*sin(19.6*gap-6.2832*t)*exp(-gap/1.4)*smoothstep(0.0,0.12,gap);\nfloat froth=0.35*exp(-gap*gap/0.006);\nif(speed>0.05){\nvec2 u=b.xy/speed;\nfloat along=-dot(d,u);\nif(along>0.0){\nfloat across=abs(dot(d,vec2(-u.y,u.x)));\nfloat tau=along/speed;\nfloat rho=a.z*0.85+0.5*tau;\nfloat arm=across-rho;\nfloat strong=min(speed/1.2,1.5);\nh+=0.016*strong*exp(-tau/2.5)*exp(-arm*arm/(0.02+0.03*tau))*cos(18.0*arm-5.0*t);\nfloat kt=clamp(9.81/(speed*speed),2.0,14.0);\nh+=0.008*strong*exp(-tau/1.6)*max(0.0,1.0-across*across/(rho*rho))*sin(kt*along);\nfroth+=0.8*strong*exp(-tau/0.35)*exp(-arm*arm/0.015);}}\nfloat body=smoothstep(a.z*0.75,a.z,dist);\nreturn vec2(h,min(froth,1.0))*a.w*body;}\nvec2 zhudaWaterRipples(vec2 p){\nreturn zhudaWaterRippleOne(p,u_ZhudaWaterRippleA0,u_ZhudaWaterRippleB0)+zhudaWaterRippleOne(p,u_ZhudaWaterRippleA1,u_ZhudaWaterRippleB1)+zhudaWaterRippleOne(p,u_ZhudaWaterRippleA2,u_ZhudaWaterRippleB2)+zhudaWaterRippleOne(p,u_ZhudaWaterRippleA3,u_ZhudaWaterRippleB3);}\n";
