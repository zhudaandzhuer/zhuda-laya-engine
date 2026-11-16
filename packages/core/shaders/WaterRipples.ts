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
export const ZHUDA_WATER_MAX_RIPPLES = 4;

const finite = (value: unknown, limit: number) =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

/** Lists what is wrong with the sources; empty when they are valid. */
export function validateZhudaWaterRipples(
  sources: readonly ZhudaWaterRipple[],
  path = 'ripples',
): string[] {
  if (!Array.isArray(sources)) return [`${path}: use a list of bodies`];
  const issues: string[] = [];
  if (sources.length > ZHUDA_WATER_MAX_RIPPLES)
    issues.push(`${path}: at most ${ZHUDA_WATER_MAX_RIPPLES} bodies (${sources.length})`);
  sources.forEach((source, i) => {
    const s = (source ?? {}) as unknown as Record<string, unknown>;
    const at = `${path}[${i}]`;
    if (!finite(s.x, 1e6) || !finite(s.z, 1e6)) issues.push(`${at}.x, z: use finite metres`);
    if (!(finite(s.radius, 20) && (s.radius as number) >= 0.05))
      issues.push(`${at}.radius: use 0.05..20 metres`);
    if (!(finite(s.strength, 2) && (s.strength as number) >= 0))
      issues.push(`${at}.strength: use 0..2`);
    if (
      s.velocity !== undefined &&
      !(
        Array.isArray(s.velocity) &&
        s.velocity.length === 2 &&
        s.velocity.every((v) => finite(v, 30))
      )
    )
      issues.push(`${at}.velocity: use [x, z] metres a second, each -30..30`);
  });
  return issues;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function one(x: number, z: number, s: ZhudaWaterRipple, seconds: number): [number, number] {
  if (!(s.strength > 0)) return [0, 0];
  const dx = x - s.x,
    dz = z - s.z;
  const dist = Math.hypot(dx, dz);
  const [vx, vz] = s.velocity ?? [0, 0];
  const speed = Math.hypot(vx, vz);
  if (dist > s.radius + 4 + speed * 6) return [0, 0];
  const gap = Math.max(dist - s.radius, 0);
  let height =
    0.012 *
    Math.sin(19.6 * gap - 6.2832 * seconds) *
    Math.exp(-gap / 1.4) *
    smoothstep(0, 0.12, gap);
  let froth = 0.35 * Math.exp((-gap * gap) / 0.006);
  if (speed > 0.05) {
    const ux = vx / speed,
      uz = vz / speed;
    const along = -(dx * ux + dz * uz);
    if (along > 0) {
      const across = Math.abs(dx * -uz + dz * ux);
      const tau = along / speed;
      const rho = s.radius * 0.85 + 0.5 * tau;
      const arm = across - rho;
      const strong = Math.min(speed / 1.2, 1.5);
      height +=
        0.016 *
        strong *
        Math.exp(-tau / 2.5) *
        Math.exp((-arm * arm) / (0.02 + 0.03 * tau)) *
        Math.cos(18 * arm - 5 * seconds);
      const kt = Math.min(14, Math.max(2, 9.81 / (speed * speed)));
      height +=
        0.008 *
        strong *
        Math.exp(-tau / 1.6) *
        Math.max(0, 1 - (across * across) / (rho * rho)) *
        Math.sin(kt * along);
      froth += 0.8 * strong * Math.exp(-tau / 0.35) * Math.exp((-arm * arm) / 0.015);
    }
  }
  const body = smoothstep(s.radius * 0.75, s.radius, dist);
  return [height * s.strength * body, Math.min(froth, 1) * s.strength * body];
}

/**
 * Height in metres the bodies raise the water by at x, z at `seconds` of the
 * water's time, and how much froth there is (0..2). The shader's function.
 */
export function zhudaWaterRipple(
  x: number,
  z: number,
  sources: readonly ZhudaWaterRipple[],
  seconds: number,
): { height: number; froth: number } {
  let height = 0,
    froth = 0;
  for (const source of sources.slice(0, ZHUDA_WATER_MAX_RIPPLES)) {
    const [h, f] = one(x, z, source, seconds);
    height += h;
    froth += f;
  }
  return { height, froth };
}

/**
 * The same in GLSL, for the water's surface code: `zhudaWaterRipples(p)`
 * returns (height, froth) at a point of the water plane. It reads
 * `u_ZhudaWaterRippleA0..3` (x, z, radius, strength), `u_ZhudaWaterRippleB0..3`
 * (velocity x, z) and the water's time in `u_ZhudaWaterFlow.z`.
 */
export const RIPPLE_GLSL = `vec2 zhudaWaterRippleOne(vec2 p,vec4 a,vec4 b){
if(a.w<=0.0)return vec2(0.0);
vec2 d=p-a.xy;
float dist=length(d);
float speed=length(b.xy);
if(dist>a.z+4.0+speed*6.0)return vec2(0.0);
float t=u_ZhudaWaterFlow.z;
float gap=max(dist-a.z,0.0);
float h=0.012*sin(19.6*gap-6.2832*t)*exp(-gap/1.4)*smoothstep(0.0,0.12,gap);
float froth=0.35*exp(-gap*gap/0.006);
if(speed>0.05){
vec2 u=b.xy/speed;
float along=-dot(d,u);
if(along>0.0){
float across=abs(dot(d,vec2(-u.y,u.x)));
float tau=along/speed;
float rho=a.z*0.85+0.5*tau;
float arm=across-rho;
float strong=min(speed/1.2,1.5);
h+=0.016*strong*exp(-tau/2.5)*exp(-arm*arm/(0.02+0.03*tau))*cos(18.0*arm-5.0*t);
float kt=clamp(9.81/(speed*speed),2.0,14.0);
h+=0.008*strong*exp(-tau/1.6)*max(0.0,1.0-across*across/(rho*rho))*sin(kt*along);
froth+=0.8*strong*exp(-tau/0.35)*exp(-arm*arm/0.015);}}
float body=smoothstep(a.z*0.75,a.z,dist);
return vec2(h,min(froth,1.0))*a.w*body;}
vec2 zhudaWaterRipples(vec2 p){
return zhudaWaterRippleOne(p,u_ZhudaWaterRippleA0,u_ZhudaWaterRippleB0)+zhudaWaterRippleOne(p,u_ZhudaWaterRippleA1,u_ZhudaWaterRippleB1)+zhudaWaterRippleOne(p,u_ZhudaWaterRippleA2,u_ZhudaWaterRippleB2)+zhudaWaterRippleOne(p,u_ZhudaWaterRippleA3,u_ZhudaWaterRippleB3);}
`;
