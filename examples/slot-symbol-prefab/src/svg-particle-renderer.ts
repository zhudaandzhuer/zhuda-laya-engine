import {
  sampleParticleColor,
  sampleParticleCurve,
  ZhudaParticleSystem,
} from 'zhuda-laya-engine';
import type { ParticleState } from 'zhuda-laya-engine';

export type SymbolLayout = { x: number; y: number; scale: number };

/**
 * Renders the public Zhuda particle simulation into the SVG design overlay.
 *
 * The simulation remains engine-owned and fixed-step; SVG only presents the
 * borrowed particle states. This keeps every particle in the same 960x540
 * coordinate system as the Laya stage and makes the effect easy to inspect in
 * screenshots without adding one display object per particle.
 */
export class SvgParticleRenderer {
  readonly system = new ZhudaParticleSystem({
    id: 'slot-symbol.selected-sparks',
    texture: 'vfx/slot-symbol-spark',
    maxParticles: 40,
    seed: 0x51ec7,
    space: 'world',
    blend: 'additive',
    shape: { type: 'circle', radius: 7 },
    rate: 0,
    lifetime: [0.4, 0.95],
    speed: [48, 132],
    angle: [0, Math.PI * 2],
    size: [5, 13],
    drag: 1.4,
    turbulence: { strength: 18, frequency: 6 },
    sizeOverLife: [
      { time: 0, value: 0.45 },
      { time: 0.12, value: 1 },
      { time: 1, value: 0.08 },
    ],
    alphaOverLife: [
      { time: 0, value: 0 },
      { time: 0.08, value: 1 },
      { time: 0.58, value: 0.72 },
      { time: 1, value: 0 },
    ],
    colorOverLife: [
      { time: 0, color: '#fff7c2' },
      { time: 0.45, color: '#ffd166' },
      { time: 1, color: '#ff7b42' },
    ],
  });

  private readonly layer: SVGGElement;
  private readonly particles: SVGGElement[];
  private layout: SymbolLayout = { x: 0, y: 0, scale: 1 };
  private state: 'idle' | 'selected' | 'win' | 'jackpot' = 'idle';

  constructor(layer: SVGGElement) {
    this.layer = layer;
    this.particles = Array.from({ length: this.system.capacity }, (_, index) => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('data-particle', String(index));
      group.style.mixBlendMode = 'screen';
      const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      halo.setAttribute('class', 'particle-halo');
      halo.setAttribute('filter', 'url(#particle-blur)');
      const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      core.setAttribute('class', 'particle-core');
      group.append(halo, core);
      layer.appendChild(group);
      return group;
    });
    this.system.setTransform(240, 240);
    this.hideUnused(0);
  }

  setLayout(layout: SymbolLayout): void {
    this.layout = layout;
    this.render();
  }

  play(state: 'idle' | 'selected' | 'win' | 'jackpot'): void {
    this.state = state;
    this.system.stop(true);
    if (state === 'idle') {
      this.hideUnused(0);
      return;
    }
    this.system.play(true);
    const count = state === 'selected' ? 18 : state === 'win' ? 28 : 36;
    // Emit from four authored sockets around the symbol. The particles then
    // read as a contained sparkle field instead of a radial cross or a ring
    // stamped over the artwork.
    const sockets = [[88, 92], [392, 92], [88, 388], [392, 388]] as const;
    sockets.forEach(([x, y], index) => {
      const remaining = count - Math.floor(count / sockets.length) * index;
      this.system.burst(Math.max(0, Math.ceil(remaining / (sockets.length - index))), x, y);
    });
    this.render();
  }

  update(deltaSeconds: number): void {
    if (this.state !== 'idle') this.system.update(deltaSeconds);
    this.render();
  }

  private hideUnused(start: number): void {
    for (let i = start; i < this.particles.length; i++) this.particles[i].setAttribute('visibility', 'hidden');
  }

  private renderParticle(group: SVGGElement, particle: ParticleState): void {
    const time = Math.min(1, Math.max(0, particle.age / particle.lifetime));
    const alpha = sampleParticleCurve(this.system.spec.alphaOverLife, time, 1);
    const color = sampleParticleColor(this.system.spec.colorOverLife, time);
    const x = this.layout.x + particle.x * this.layout.scale;
    const y = this.layout.y + particle.y * this.layout.scale;
    const size = Math.max(0.5, particle.size * this.layout.scale);
    group.setAttribute('visibility', 'visible');
    group.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(particle.rotation * 180 / Math.PI).toFixed(2)})`);
    const halo = group.querySelector<SVGCircleElement>('.particle-halo');
    const core = group.querySelector<SVGCircleElement>('.particle-core');
    halo?.setAttribute('r', (size * 2.5).toFixed(2));
    halo?.setAttribute('fill', color);
    halo?.setAttribute('opacity', (alpha * 0.34).toFixed(3));
    core?.setAttribute('r', (size * 0.55).toFixed(2));
    core?.setAttribute('fill', '#fffbea');
    core?.setAttribute('opacity', alpha.toFixed(3));
  }

  render(): void {
    let used = 0;
    this.system.forEach((particle) => {
      if (used < this.particles.length) this.renderParticle(this.particles[used++], particle);
    });
    this.hideUnused(used);
  }

  dispose(): void {
    this.system.stop(true);
    this.layer.replaceChildren();
  }
}
