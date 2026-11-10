import {
  ZhudaModelLibrary,
  ZhudaAnimatorLOD,
  Zhuda3D,
  ZhudaParticleSystem3D,
  ZhudaLayaParticleRenderer3D,
} from 'zhuda-laya-engine';
import type { ParticleEmitterSpec3D } from 'zhuda-laya-engine';
/** The exact same recipe powers isolated selections and composed crowd scenes. */
export const characterDefinition = Object.freeze({
  id: 'cesium-character',
  model: 'CesiumMan.glb',
  socket: 'Skeleton_arm_joint_R__3_',
  state: 'locomotion',
  animationClips: 1,
});
export const sparkDefinition: ParticleEmitterSpec3D = {
  id: 'neutral-sparks',
  texture: 'white',
  maxParticles: 48,
  seed: 42,
  space: 'world',
  blend: 'additive',
  shape: { type: 'point' },
  rate: 40,
  lifetime: 0.8,
  speed: [0.4, 1.5],
  size: [0.04, 0.08],
  direction: { x: 0, y: 1, z: 0 },
  spread: 0.8,
  acceleration: { x: 0, y: -0.5, z: 0 },
  colorOverLife: [
    { time: 0, color: '#ffbc4b' },
    { time: 1, color: '#e54b36' },
  ],
};
export async function createCharacter(
  library: ZhudaModelLibrary,
  parent: Laya.Node,
  index: number,
  options: { unique?: boolean; equipment?: boolean; frozen?: boolean } = {},
) {
  const model = await library.instantiate(characterDefinition.model, {
    independentMaterials: options.unique,
  });
  const root = model.node as Laya.Sprite3D;
  root.name = 'Character-' + index;
  parent.addChild(root);
  const animators: Laya.Animator[] = [];
  const visit = (n: Laya.Node) => {
    const a = n.getComponent(Laya.Animator);
    if (a) animators.push(a);
    for (let i = 0; i < n.numChildren; i++) visit(n.getChildAt(i));
  };
  visit(root);
  if (!animators.length) {
    model.dispose();
    throw Error('Fixture requires real skinned animation');
  }
  const lod = animators.map((a) => new ZhudaAnimatorLOD(a));
  for (const a of animators) {
    a.play(null, 0, (index * 0.013) % 1);
    if (options.frozen) a.speed = 0;
  }
  const hand = model.find(characterDefinition.socket) as Laya.Sprite3D;
  if (!hand) {
    model.dispose();
    throw Error('Named equipment socket missing');
  }
  const equipment = options.equipment
    ? Zhuda3D.buildPrefabTree({
        materials: { neutral: { type: 'unlit', albedoColor: [0.2, 0.7, 1, 1] } },
        root: {
          name: 'Equipment',
          mesh: { type: 'box', dimensions: { width: 0.04, height: 0.25, depth: 0.04 } },
          material: 'neutral',
        },
      })
    : null;
  if (equipment) hand.addChild(equipment.root);
  const particles = new ZhudaParticleSystem3D({ ...sparkDefinition, seed: 42 + index });
  const renderer = new ZhudaLayaParticleRenderer3D(
    particles,
    parent,
    () => Laya.Texture2D.whiteTexture,
  );
  const warning = Zhuda3D.buildPrefabTree({
    materials: { warning: { type: 'unlit', albedoColor: [0.9, 0.32, 0.12, 1] } },
    root: {
      name: 'Warning',
      mesh: { type: 'cylinder', dimensions: { radius: 0.4, height: 0.015 } },
      material: 'warning',
    },
  });
  parent.addChild(warning.root);
  warning.root.active = false;
  const hud = document.createElement('div');
  hud.className = 'actor-hud';
  hud.textContent = `Actor ${index + 1}`;
  document.querySelector('#hud')!.appendChild(hud);
  const position = new Laya.Vector3();
  return {
    root,
    model,
    lod,
    hand,
    animators,
    equipment,
    particles,
    renderer,
    warning,
    hud,
    position,
    setPosition(x: number, z: number) {
      position.setValue(x, 0, z);
      root.transform.position = position;
      particles.setTransform(x, 0.3, z);
      warning.root.transform.position = new Laya.Vector3(x, 0.015, z);
    },
    dispose() {
      hud.remove();
      renderer.dispose();
      warning.dispose();
      equipment?.dispose();
      for (const a of lod) a.dispose();
      model.dispose();
    },
  };
}
