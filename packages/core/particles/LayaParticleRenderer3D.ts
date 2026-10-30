import { ZhudaVfxMaterial } from '../effects/VfxMaterial.ts';
import type { VfxMaterialSpec } from '../effects/VfxMaterial.ts';
import { ZhudaParticleMesh3D } from './ParticleMesh3D.ts';
import type { ParticleGeometry3D } from './ParticleMesh3D.ts';
import type { ParticleView3D } from './ParticleTypes3D.ts';
import type { ZhudaParticleSystem3D } from './ParticleSystem3D.ts';
import type { ZhudaRibbonTrail3D } from './RibbonTrail3D.ts';
import type { ZhudaRibbonPath3D } from './RibbonPath3D.ts';
import type { ParticleTextureResolver } from './LayaParticleRenderer.ts';

/** Laya 3.4.2 mesh adapter. Uses scene depth testing, never writes transparent depth. */
class DynamicParticleMesh3D {
  readonly node: any; readonly material: any; readonly mesh: any;
  private disposed = false;
  readonly vfx?: ZhudaVfxMaterial;
  private readonly min: any; private readonly max: any;
  constructor(parent: any, geometry: ParticleGeometry3D, texture: any, blend: 'alpha' | 'additive', color?: string, vfxSpec?: VfxMaterialSpec, resolver?: ParticleTextureResolver) {
    const l = (globalThis as any).Laya;
    if (!l?.PrimitiveMesh?._createMesh || !l?.MeshSprite3D || !texture) throw new Error('3D particle rendering requires booted Laya 3.4.2 3D modules and a texture.');
    this.mesh = l.PrimitiveMesh._createMesh(l.VertexMesh.getVertexDeclaration('POSITION,COLOR,UV'), geometry.vertices, geometry.indices);
    this.vfx = vfxSpec ? new ZhudaVfxMaterial(vfxSpec, texture, resolver!, blend) : undefined;
    this.material = this.vfx?.material || new l.UnlitMaterial(); this.material.enableVertexColor = true;
    if (!this.vfx) this.material.albedoTexture = texture.bitmap || texture;
    if (color) { const c = parseInt(color.slice(1), 16); this.material.albedoColor = new l.Color((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255, 1); }
    this.material.renderQueue = 3000; this.material.depthWrite = false;
    this.material.depthTest = l.RenderState.DEPTHTEST_LEQUAL; this.material.cull = l.RenderState.CULL_NONE;
    this.material.blend = l.RenderState.BLEND_ENABLE_ALL; this.material.blendSrc = l.RenderState.BLENDPARAM_SRC_ALPHA;
    this.material.blendDst = blend === 'additive' ? l.RenderState.BLENDPARAM_ONE : l.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA;
    this.node = new l.MeshSprite3D(this.mesh); this.node.name = 'ZhudaParticles3D';
    this.node.meshRenderer.sharedMaterial = this.material; parent.addChild(this.node);
    this.min = new l.Vector3(); this.max = new l.Vector3();
  }
  submit(g: ParticleGeometry3D, visible: boolean): void {
    if (this.disposed) return;
    this.node.active = visible && g.indexCount > 0;
    if (!this.node.active) return;
    this.mesh.setVertices(g.vertices.buffer);
    this.mesh.setIndices(g.indices);
    // Inactive quads remain zero-area in a preallocated index buffer; no per-frame buffer allocation.
    this.min.setValue(Infinity, Infinity, Infinity); this.max.setValue(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < g.vertexCount; i++) {
      const offset = i * 9;
      this.min.x = Math.min(this.min.x, g.vertices[offset]); this.max.x = Math.max(this.max.x, g.vertices[offset]);
      this.min.y = Math.min(this.min.y, g.vertices[offset + 1]); this.max.y = Math.max(this.max.y, g.vertices[offset + 1]);
      this.min.z = Math.min(this.min.z, g.vertices[offset + 2]); this.max.z = Math.max(this.max.z, g.vertices[offset + 2]);
    }
    const bounds = this.mesh.bounds; bounds.setMin(this.min); bounds.setMax(this.max); this.mesh.bounds = bounds;
    this.node.meshRenderer.boundsChange = true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    // Laya destroys zero-reference texture dependencies during Material.destroy().
    // Detach outside that cascade so shared application textures survive rebuilding.
    this.material.albedoTexture = null;
    this.node.destroy(true); this.mesh.destroy(); if (this.vfx) this.vfx.dispose(); else this.material.destroy();
  }
}

function cameraView(camera: any, out: ParticleView3D): ParticleView3D {
  const e = camera.transform.worldMatrix.elements, p = camera.transform.position;
  Object.assign(out.position, { x: p.x, y: p.y, z: p.z });
  Object.assign(out.right, { x: e[0], y: e[1], z: e[2] }); Object.assign(out.up, { x: e[4], y: e[5], z: e[6] });
  Object.assign(out.forward, { x: -e[8], y: -e[9], z: -e[10] }); return out;
}
function emptyView(): ParticleView3D { return { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: -1 } }; }

export class ZhudaLayaParticleRenderer3D {
  readonly node: any;
  readonly system: ZhudaParticleSystem3D;
  get vfxMaterial(): ZhudaVfxMaterial | undefined { return this.backend.vfx; }
  submittedBatches = 0;
  private readonly builder: ZhudaParticleMesh3D;
  private readonly backend: DynamicParticleMesh3D;
  private readonly view = emptyView();
  private disposed = false;
  constructor(system: ZhudaParticleSystem3D, parent: any, resolveTexture: ParticleTextureResolver) {
    this.system = system; this.builder = new ZhudaParticleMesh3D(system);
    this.backend = new DynamicParticleMesh3D(parent, this.builder.geometry, resolveTexture(system.spec.texture), system.spec.blend, undefined, system.spec.material, resolveTexture);
    this.node = this.backend.node;
  }
  render(camera: any, opacity = 1): void {
    this.submittedBatches = 0; if (this.disposed) return;
    this.backend.vfx?.setTime(this.system.time);
    const g = this.builder.build(cameraView(camera, this.view), opacity);
    this.backend.submit(g, opacity > 0); this.submittedBatches = opacity > 0 && g.indexCount > 0 ? 1 : 0;
  }
  dispose(): void { this.disposed = true; this.backend.dispose(); }
}

export class ZhudaLayaRibbonRenderer3D {
  readonly node: any; readonly trail: ZhudaRibbonTrail3D | ZhudaRibbonPath3D;
  submittedBatches = 0;
  private readonly backend: DynamicParticleMesh3D;
  private disposed = false;
  constructor(trail: ZhudaRibbonTrail3D | ZhudaRibbonPath3D, parent: any, texture: any, color = '#ffffff', blend: 'alpha' | 'additive' = 'additive') {
    this.trail = trail; this.backend = new DynamicParticleMesh3D(parent, trail.buildMesh({ x: 0, y: 0, z: 1 }), texture, blend, color);
    this.node = this.backend.node; this.node.name = 'ZhudaRibbon3D';
  }
  render(camera: any, opacity = 1): void {
    this.submittedBatches = 0; if (this.disposed) return;
    const g = this.trail.buildMesh(camera.transform.position, opacity); this.backend.submit(g, opacity > 0);
    this.submittedBatches = opacity > 0 && g.indexCount > 0 ? 1 : 0;
  }
  dispose(): void { this.disposed = true; this.backend.dispose(); }
}
