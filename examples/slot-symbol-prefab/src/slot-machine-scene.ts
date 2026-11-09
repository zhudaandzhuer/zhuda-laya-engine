import { ZhudaEngine, ZhudaPrefab, ZhudaPrefabLibrary, findPrefabNode } from 'zhuda-laya-engine';
import type { LayaHierarchyNodeData, PrefabInstance } from 'zhuda-laya-engine';
import { createAssetProvider, definitions } from './prefabs';
import { SlotSymbolEffect, type SlotSymbolState } from './slot-symbol-effect';

type SceneContext = Awaited<ReturnType<typeof ZhudaEngine.boot>>;

export interface SlotMachineSceneHandle {
  update(delta: number): void;
  setVisible(visible: boolean): void;
  selectRoot(): void;
  copyHierarchy(): Promise<void>;
  dispose(): void;
}

declare global {
  interface Window {
    slotMachineScene?: { ready: boolean; report(): unknown };
  }
}

type SceneLayoutNode = Laya.Node & {
  width?: number; height?: number; x?: number; y?: number;
  scaleX?: number; scaleY?: number; anchorX?: number; anchorY?: number;
  pivotX?: number; pivotY?: number;
};

function sceneNodeType(node: Laya.Node): string {
  const L = (globalThis as unknown as { Laya?: Record<string, any> }).Laya;
  if (L?.Scene && node instanceof L.Scene) return 'Scene';
  if (L?.Label && node instanceof L.Label) return 'Label';
  if (L?.Text && node instanceof L.Text) return 'Text';
  if (L?.Image && node instanceof L.Image) return 'Image';
  if (L?.Box && node instanceof L.Box) return 'Box';
  if (L?.Sprite && node instanceof L.Sprite) return 'Sprite';
  return node.constructor?.name || 'Node';
}

function sceneNodeBounds(node: SceneLayoutNode, root: SceneLayoutNode) {
  const width = Math.abs(Number(node.width) || 0);
  const height = Math.abs(Number(node.height) || 0);
  const scaleX = Number(node.scaleX) || 1;
  const scaleY = Number(node.scaleY) || 1;
  const anchorX = Number(node.anchorX) || 0;
  const anchorY = Number(node.anchorY) || 0;
  const pivotX = Number.isFinite(Number(node.pivotX)) ? Number(node.pivotX) : width * anchorX;
  const pivotY = Number.isFinite(Number(node.pivotY)) ? Number(node.pivotY) : height * anchorY;
  let x = Number(node.x ?? 0) - pivotX * scaleX;
  let y = Number(node.y ?? 0) - pivotY * scaleY;
  let renderedWidth = width * Math.abs(scaleX);
  let renderedHeight = height * Math.abs(scaleY);
  if (node === root) return { x: 0, y: 0, width: renderedWidth, height: renderedHeight };
  let parent = node.parent as SceneLayoutNode | null;
  while (parent && parent !== root.parent) {
    const parentWidth = Math.abs(Number(parent.width) || 0);
    const parentHeight = Math.abs(Number(parent.height) || 0);
    const parentScaleX = Number(parent.scaleX) || 1;
    const parentScaleY = Number(parent.scaleY) || 1;
    const parentAnchorX = Number(parent.anchorX) || 0;
    const parentAnchorY = Number(parent.anchorY) || 0;
    const parentPivotX = Number.isFinite(Number(parent.pivotX)) ? Number(parent.pivotX) : parentWidth * parentAnchorX;
    const parentPivotY = Number.isFinite(Number(parent.pivotY)) ? Number(parent.pivotY) : parentHeight * parentAnchorY;
    x = Number(parent.x ?? 0) - parentPivotX * parentScaleX + x * parentScaleX;
    y = Number(parent.y ?? 0) - parentPivotY * parentScaleY + y * parentScaleY;
    renderedWidth *= Math.abs(parentScaleX);
    renderedHeight *= Math.abs(parentScaleY);
    parent = parent.parent as SceneLayoutNode | null;
  }
  return { x, y, width: renderedWidth, height: renderedHeight };
}

function installSceneInspector(root: Laya.Sprite, context: SceneContext): { remove(): void; selectRoot(): void; copyHierarchy(): Promise<void> } {
  const hierarchyTree = document.querySelector<HTMLElement>('#hierarchy-tree');
  const highlight = document.querySelector<SVGRectElement>('#hierarchy-highlight');
  const overlay = document.querySelector<SVGSVGElement>('#anchor-overlay');
  const note = document.querySelector<HTMLElement>('.metrics .metrics-note');
  const hierarchyTitle = document.querySelector<HTMLElement>('.hierarchy-title');
  const sourceLabel = Array.from(document.querySelectorAll<HTMLElement>('.metrics dt')).find(item => item.textContent === 'Source image');
  const summaries = new WeakMap<Laya.Node, HTMLElement>();
  let selected: Laya.Node = root;
  if (overlay) overlay.setAttribute('viewBox', '0 0 1280 720');
  if (note) note.textContent = 'Scene .ls 由 Laya runtime 水合。點選階層節點查看設計尺寸、世界 bounds、anchor/pivot 與實際 CSS 尺寸；COPY 可複製完整 Scene 階層給 Agent。';
  if (hierarchyTitle) hierarchyTitle.textContent = 'SCENE HIERARCHY';
  if (sourceLabel) sourceLabel.textContent = 'Scene asset';

  const metric = (id: string) => document.querySelector<HTMLElement>(id);
  const scenePath = (node: Laya.Node): string => {
    const parts: string[] = [];
    let current: Laya.Node | null = node;
    while (current && current !== root.parent) {
      parts.unshift(current.name || sceneNodeType(current));
      current = current.parent;
    }
    return parts.join('/');
  };
  const snapshot = (node: Laya.Node, path: string): Record<string, unknown> => {
    const value = node as SceneLayoutNode;
    const width = Number(value.width) || 0;
    const height = Number(value.height) || 0;
    const anchorX = Number(value.anchorX) || 0;
    const anchorY = Number(value.anchorY) || 0;
    const pivotX = Number.isFinite(Number(value.pivotX)) ? Number(value.pivotX) : width * anchorX;
    const pivotY = Number.isFinite(Number(value.pivotY)) ? Number(value.pivotY) : height * anchorY;
    return {
      path, name: node.name || 'Unnamed', type: sceneNodeType(node),
      x: Number(value.x ?? 0), y: Number(value.y ?? 0), width, height,
      scaleX: Number(value.scaleX) || 1, scaleY: Number(value.scaleY) || 1,
      anchorX, anchorY, pivotX, pivotY,
      children: Array.from({ length: node.numChildren }, (_, index) => {
        const child = node.getChildAt(index) as Laya.Node;
        return snapshot(child, `${path}/${child.name || index}`);
      }),
    };
  };
  const update = () => {
    const value = selected as SceneLayoutNode;
    const bounds = sceneNodeBounds(value, root as SceneLayoutNode);
    const width = Math.abs(Number(value.width) || 0);
    const height = Math.abs(Number(value.height) || 0);
    const scaleX = Number(value.scaleX) || 1;
    const scaleY = Number(value.scaleY) || 1;
    const anchorX = Number(value.anchorX) || 0;
    const anchorY = Number(value.anchorY) || 0;
    const pivotX = Number.isFinite(Number(value.pivotX)) ? Number(value.pivotX) : width * anchorX;
    const pivotY = Number.isFinite(Number(value.pivotY)) ? Number(value.pivotY) : height * anchorY;
    const canvas = context.canvas;
    const screenScaleX = (canvas.clientWidth || 1280) / 1280;
    const screenScaleY = (canvas.clientHeight || 720) / 720;
    if (highlight) {
      highlight.setAttribute('x', bounds.x.toFixed(2));
      highlight.setAttribute('y', bounds.y.toFixed(2));
      highlight.setAttribute('width', Math.max(1, bounds.width).toFixed(2));
      highlight.setAttribute('height', Math.max(1, bounds.height).toFixed(2));
      highlight.setAttribute('visibility', 'visible');
    }
    const selection = metric('#metric-selection');
    const rootLabel = Array.from(document.querySelectorAll<HTMLElement>('.metrics dt')).find(item => item.textContent === 'Prefab root');
    const rootSize = rootLabel?.nextElementSibling as HTMLElement | null;
    if (selection) selection.textContent = `${selected.name || 'Unnamed'} · ${sceneNodeType(selected)}`;
    if (rootLabel) rootLabel.textContent = 'Scene design';
    if (rootSize?.tagName === 'DD') rootSize.textContent = '1280 × 720 px';
    const nodeRect = metric('#metric-node-rect');
    const nodePos = metric('#metric-node-pos');
    const nodeScale = metric('#metric-node-scale');
    const nodeAnchor = metric('#metric-node-anchor');
    const owner = metric('#metric-node-owner');
    const source = metric('#metric-source');
    const screen = metric('#metric-screen');
    const scale = metric('#metric-scale');
    const viewport = metric('#metric-viewport');
    if (nodeRect) nodeRect.textContent = `x ${bounds.x.toFixed(0)} · y ${bounds.y.toFixed(0)} · ${bounds.width.toFixed(0)} × ${bounds.height.toFixed(0)}`;
    if (nodePos) nodePos.textContent = `${Number(value.x ?? 0).toFixed(0)}, ${Number(value.y ?? 0).toFixed(0)}`;
    if (nodeScale) nodeScale.textContent = `${scaleX.toFixed(2)} × ${scaleY.toFixed(2)}`;
    if (nodeAnchor) nodeAnchor.textContent = `${(anchorX * 100).toFixed(0)}% / ${(anchorY * 100).toFixed(0)}% · ${pivotX.toFixed(0)}, ${pivotY.toFixed(0)}`;
    if (owner) owner.textContent = `Laya.${sceneNodeType(selected)}`;
    if (source) { source.textContent = 'scenes/slot-machine.ls'; source.title = scenePath(selected); }
    if (screen) screen.textContent = `${Math.round(bounds.width * screenScaleX)} × ${Math.round(bounds.height * screenScaleY)} CSS px`;
    if (scale) scale.textContent = `${screenScaleX.toFixed(2)}× screen · ${scenePath(selected)}`;
    if (viewport) viewport.textContent = `${Math.round(canvas.clientWidth || 0)} × ${Math.round(canvas.clientHeight || 0)} · DPR ${(window.devicePixelRatio || 1).toFixed(2)}`;
  };
  const select = (node: Laya.Node, summary?: HTMLElement) => {
    selected = node;
    for (const item of Array.from(hierarchyTree?.querySelectorAll<HTMLElement>('summary') || [])) item.classList.toggle('is-selected', item === summary);
    update();
  };
  const selectRoot = () => select(root, summaries.get(root));
  const render = () => {
    if (!hierarchyTree) return;
    hierarchyTree.replaceChildren();
    const append = (node: Laya.Node, depth: number): HTMLElement => {
      const branch = document.createElement('details');
      branch.open = depth === 0;
      const summary = document.createElement('summary');
      summary.textContent = node.name || 'Unnamed';
      const type = document.createElement('span');
      type.className = 'hierarchy-type'; type.textContent = sceneNodeType(node);
      summary.append(' ', type);
      summaries.set(node, summary);
      summary.addEventListener('click', () => select(node, summary));
      branch.appendChild(summary);
      if (node.numChildren) {
        const children = document.createElement('div');
        children.className = 'hierarchy-children';
        for (let index = 0; index < node.numChildren; index += 1) children.appendChild(append(node.getChildAt(index) as Laya.Node, depth + 1));
        branch.appendChild(children);
      }
      return branch;
    };
    hierarchyTree.appendChild(append(root, 0));
    select(root, summaries.get(root));
  };
  const copyHierarchy = async () => {
    const payload = JSON.stringify({ scene: 'scenes/slot-machine.ls', designCanvas: { width: 1280, height: 720 }, selected: { path: scenePath(selected), type: sceneNodeType(selected) }, hierarchy: snapshot(root, root.name || 'SlotMachineScene') }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const fallback = document.createElement('textarea');
      fallback.value = payload;
      fallback.style.position = 'fixed'; fallback.style.opacity = '0';
      document.body.appendChild(fallback); fallback.select();
      document.execCommand('copy'); fallback.remove();
    }
    const hierarchyCopy = document.querySelector<HTMLButtonElement>('#hierarchy-copy');
    if (hierarchyCopy) {
      hierarchyCopy.textContent = 'COPIED';
      window.setTimeout(() => { hierarchyCopy.textContent = 'COPY'; }, 1200);
    }
  };
  window.addEventListener('resize', update);
  render();
  return {
    remove: () => window.removeEventListener('resize', update),
    selectRoot,
    copyHierarchy,
  };
}

export interface SlotMachineSceneOptions {
  context?: SceneContext;
}

export async function startSlotMachineScene(options: SlotMachineSceneOptions = {}): Promise<SlotMachineSceneHandle> {
  document.body.classList.add('scene-mode');
  const surface = document.querySelector<HTMLElement>('#stage-surface');
  const fitSceneViewport = () => {
    if (!surface) return;
    const width = Math.max(1, surface.clientWidth);
    const height = Math.max(1, surface.clientHeight);
    const sceneWidth = Math.min(width, height * (1280 / 720));
    const sceneHeight = sceneWidth * (720 / 1280);
    surface.style.setProperty('--scene-viewport-width', `${sceneWidth}px`);
    surface.style.setProperty('--scene-viewport-height', `${sceneHeight}px`);
  };
  // Establish the design viewport before Laya boot measures #game. This keeps
  // the runtime canvas, SVG guides and selection bounds on one 16:9 surface.
  fitSceneViewport();
  const ownsContext = !options.context;
  const context: SceneContext = options.context ?? await ZhudaEngine.boot({
    container: '#game',
    width: 1280,
    height: 720,
    dprCap: 3,
    designSize: { width: 1280, height: 720 },
    scaleMode: 'noborder',
    features: ['core', '2d', 'ui', 'particle2d'],
    bgColor: '#07101f',
  });
  fitSceneViewport();
  context.resize();
  const resizeScene = () => {
    fitSceneViewport();
    context.resize();
  };
  const surfaceObserver = typeof ResizeObserver === 'function' && surface
    ? new ResizeObserver(resizeScene)
    : undefined;
  if (surfaceObserver && surface) surfaceObserver.observe(surface);
  window.addEventListener('resize', resizeScene, { passive: true });
  const provider = createAssetProvider();
  const library = new ZhudaPrefabLibrary({ provider, definitions });
  const sceneAsset = await provider.load('scenes/slot-machine.ls');
  let sceneRoot: Laya.Sprite;
  try {
    const sceneData = JSON.parse(new TextDecoder().decode(sceneAsset.bytes)) as LayaHierarchyNodeData;
    sceneRoot = ZhudaPrefab.instantiate(sceneData);
  } finally {
    sceneAsset.release?.();
  }
  context.rootScene.addChild(sceneRoot);
  const reels = findPrefabNode<Laya.Sprite>(sceneRoot, 'MachineFrame/ReelWindow/Reels');

  const instances: PrefabInstance[] = [];
  const effects: SlotSymbolEffect[] = [];
  const columns = 5;
  const rows = 3;
  const cellWidth = 194;
  const cellHeight = 112;
  const symbolScale = 0.22;
  const states: SlotSymbolState[] = ['idle', 'win', 'selected', 'win', 'idle'];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cell = findPrefabNode<Laya.Sprite>(reels, `ReelCell_${column + 1}_${row + 1}`);

      const instance = await library.instantiate('slot/symbol', { parent: cell });
      instance.root.name = `Symbol_${column + 1}_${row + 1}`;
      instance.root.scaleX = symbolScale;
      instance.root.scaleY = symbolScale;
      instance.root.pos((cellWidth - 480 * symbolScale) / 2, (cellHeight - 480 * symbolScale) / 2 - 2);
      instances.push(instance);
      const effect = new SlotSymbolEffect(instance);
      effect.play(states[column]);
      effects.push(effect);
    }
  }
  const inspector = installSceneInspector(sceneRoot, context);
  const update = (delta: number) => {
    for (const effect of effects) effect.update(delta);
  };
  if (ownsContext) context.runtime.start(update);
  context.stage.repaint();
  window.slotMachineScene = {
    ready: true,
    report: () => ({ ready: true, scene: 'slot-machine', sceneAsset: 'scenes/slot-machine.ls', prefab: 'slot/symbol', columns, rows, instances: instances.length, state: states }),
  };

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    surfaceObserver?.disconnect();
    window.removeEventListener('resize', resizeScene);
    for (const effect of effects) effect.dispose();
    for (const instance of instances) instance.dispose();
    library.dispose();
    provider.dispose?.();
    inspector.remove();
    if (ownsContext) context.dispose();
  };
  window.addEventListener('pagehide', dispose, { once: true });
  const setVisible = (visible: boolean) => { sceneRoot.visible = visible; };
  return { update, setVisible, selectRoot: inspector.selectRoot, copyHierarchy: inspector.copyHierarchy, dispose };
}
