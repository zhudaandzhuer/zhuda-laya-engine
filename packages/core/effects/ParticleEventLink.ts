import { rotateParticleVector3 } from '../particles/ParticleTypes3D.ts';
import type { ZhudaParticleSystem } from '../particles/ParticleSystem.ts';
import type { ZhudaParticleSystem3D } from '../particles/ParticleSystem3D.ts';
import type { ParticleEvent } from '../particles/ParticleExtras.ts';
/** Links collision/death events to a bounded child emitter. The child is advanced by its application's loop. */
export class ZhudaParticleEventLink {
  private disposed=false;
  private readonly previous:((event:ParticleEvent)=>void)|undefined;
  private readonly listener:(event:ParticleEvent)=>void;
  readonly source:ZhudaParticleSystem|ZhudaParticleSystem3D;
  readonly child:ZhudaParticleSystem|ZhudaParticleSystem3D;
  constructor(source:ZhudaParticleSystem|ZhudaParticleSystem3D,child:ZhudaParticleSystem|ZhudaParticleSystem3D,options:{event:'collision'|'death';count:number}){
    this.source=source;this.child=child;
    if(source===child||child.spec.space!=='world'||!Number.isInteger(options.count)||options.count<0||options.count>child.capacity)throw new Error('Event links need a separate world-space child and a bounded count.');
    this.previous=source.onEvent;
    this.listener=e=>{
      this.previous?.(e);if(this.disposed||e.type!==options.event)return;
      const point={x:e.x,y:e.y,z:e.z};
      if(source.spec.space==='local'){
        const transform=source.transform as any;
        if(typeof transform.rotation==='number'){const c=Math.cos(transform.rotation),s=Math.sin(transform.rotation),x=point.x;point.x=x*c-point.y*s;point.y=x*s+point.y*c;}
        else rotateParticleVector3(point,transform.rotation,point);
        point.x+=transform.x;point.y+=transform.y;point.z+=transform.z||0;
      }
      (child.burst as any).call(child,options.count,point.x,point.y,point.z);
    };
    source.onEvent=this.listener;
  }
  dispose():void{this.disposed=true;if(this.source.onEvent===this.listener)this.source.onEvent=this.previous;}
}
