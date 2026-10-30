export interface ParticleUVRect { x: number; y: number; width: number; height: number; }
export interface ParticleFlipbook { columns: number; rows: number; fps?: number; cycles?: number; startFrame?: number; frameCount?: number; loop?: boolean; }
export interface ParticlePlane { normal: { x: number; y: number; z?: number }; offset: number; }
export interface ParticleCollisionSpec { planes: ParticlePlane[]; restitution?: number; friction?: number; radius?: number; killOnCollision?: boolean; }
export interface ParticleEvent { type: 'collision' | 'death'; x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; plane: number; }
export function validateParticleExtras(e: any, dimension = 2): string[] {
  const errors: string[] = [], r = e.textureRect, f = e.flipbook, c = e.collision;
  if (r && (![r.x,r.y,r.width,r.height].every(Number.isFinite) || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x+r.width > 1.000001 || r.y+r.height > 1.000001)) errors.push('textureRect must be a normalized rectangle inside the texture.');
  if (f) {
    if (!Number.isInteger(f.columns) || !Number.isInteger(f.rows) || f.columns < 1 || f.rows < 1 || f.columns*f.rows > 65536) errors.push('Invalid flipbook grid.');
    const start=f.startFrame??0,count=f.frameCount??f.columns*f.rows;
    if (!Number.isInteger(start)||!Number.isInteger(count)||start<0||count<1||start+count>f.columns*f.rows) errors.push('Invalid flipbook frame range.');
    if ((f.fps!==undefined&&(!Number.isFinite(f.fps)||f.fps<=0)) || (f.cycles!==undefined&&(!Number.isFinite(f.cycles)||f.cycles<=0)) || (f.loop!==undefined&&typeof f.loop!=='boolean')) errors.push('Invalid flipbook timing.');
  }
  if (c) {
    if (!Array.isArray(c.planes)||c.planes.length<1||c.planes.length>16) errors.push('collision requires 1..16 planes.');
    else for (const p of c.planes) if (!p?.normal || ![p.normal.x,p.normal.y,p.normal.z??0,p.offset].every(Number.isFinite)||Math.hypot(p.normal.x,p.normal.y,p.normal.z??0)<1e-8||(dimension===2&&(p.normal.z??0)!==0)) errors.push('Invalid collision plane.');
    for (const k of ['restitution','friction']) if (c[k]!==undefined&&(!Number.isFinite(c[k])||c[k]<0||c[k]>1)) errors.push(`collision.${k} must be 0..1.`);
    if (c.radius!==undefined&&(!Number.isFinite(c.radius)||c.radius<0)) errors.push('Invalid collision radius.');
    if (c.killOnCollision!==undefined&&typeof c.killOnCollision!=='boolean') errors.push('Invalid collision response.');
  }
  return errors;
}
/** Returns UVs through a caller-owned rectangle. Rows are authored from the top of the texture. */
export function sampleParticleUV(spec: {textureRect?:ParticleUVRect;flipbook?:ParticleFlipbook}, age:number, lifetime:number, out:ParticleUVRect):ParticleUVRect {
  const r=spec.textureRect||{x:0,y:0,width:1,height:1},f=spec.flipbook;
  Object.assign(out,r); if(!f)return out;
  const count=f.frameCount??f.columns*f.rows,progress=f.fps!==undefined?age*f.fps:age/lifetime*(f.cycles??1)*count;
  const step=Math.max(0,Math.floor(progress+1e-8)),frame=(f.startFrame??0)+(f.loop===false?Math.min(count-1,step):step%count);
  out.x=r.x+(frame%f.columns)*r.width/f.columns;out.y=r.y+Math.floor(frame/f.columns)*r.height/f.rows;out.width=r.width/f.columns;out.height=r.height/f.rows;return out;
}
/** Plane convention: dot(position, normal) >= offset is free space, in the simulator's chosen world/local coordinates. */
export function resolveParticleCollision(p:any,spec:ParticleCollisionSpec,dimension:number,hit:(plane:number)=>void):boolean {
  let killed=false;
  for(let i=0;i<spec.planes.length;i++){
    const plane=spec.planes[i],n=plane.normal,length=Math.hypot(n.x,n.y,dimension===3?n.z||0:0),nx=n.x/length,ny=n.y/length,nz=dimension===3?(n.z||0)/length:0;
    const penetration=plane.offset/length+(spec.radius||0)-(p.x*nx+p.y*ny+(p.z||0)*nz);
    if(penetration<=0)continue;
    p.x+=nx*penetration;p.y+=ny*penetration;if(dimension===3)p.z+=nz*penetration;
    const vn=p.vx*nx+p.vy*ny+(p.vz||0)*nz;
    if(vn<0){const bounce=(1+(spec.restitution??.5))*vn;p.vx-=bounce*nx;p.vy-=bounce*ny;if(dimension===3)p.vz-=bounce*nz;
      const normal=p.vx*nx+p.vy*ny+(p.vz||0)*nz,keep=1-(spec.friction??0);p.vx=nx*normal+(p.vx-nx*normal)*keep;p.vy=ny*normal+(p.vy-ny*normal)*keep;if(dimension===3)p.vz=nz*normal+(p.vz-nz*normal)*keep;
      hit(i);if(spec.killOnCollision){killed=true;break;}
    }
  }
  return killed;
}
