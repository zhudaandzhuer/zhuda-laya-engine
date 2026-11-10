import { Zhuda3D, ZhudaEngine, ZhudaPrefabLibrary } from 'zhuda-laya-engine';
import type { AssetManifestEntry, PrefabInstance } from 'zhuda-laya-engine';
import { createAssetProvider, definitions, manifest, symbolId } from './prefabs';
import { SlotSymbolEffect, type SlotSymbolState } from './slot-symbol-effect';
import { SvgParticleRenderer, type SymbolLayout } from './svg-particle-renderer';
import { startSlotMachineScene, type SlotMachineSceneHandle } from './slot-machine-scene';
import { installAssetBrowser } from './asset-browser';
import { createModelPreview, type ModelPreviewHandle } from './model-preview';
import {
  resolvePreviewResourcePolicy,
  shouldReleaseHiddenPreview,
  type PreviewResourcePolicy,
} from './preview-resource-policy';

declare global {
  interface Window {
    slotSymbolDemo?: {
      ready: boolean;
      play(state: SlotSymbolState): void;
      replace(file: File): void;
      report(): unknown;
    };
  }
}

const main = async () => {
  const query = new URLSearchParams(window.location.search);
  const sceneMode = query.get('scene') === 'slot-machine';
  const resourcePolicy: PreviewResourcePolicy = resolvePreviewResourcePolicy(
    window.location.search,
  );
  const requestedAsset = query.get('asset');
  const selectedManifestEntry = manifest.entries.find((entry) => entry.id === requestedAsset);
  const selectedAssetId =
    selectedManifestEntry?.id || (sceneMode ? 'scenes/slot-machine.ls' : 'prefabs/slot-symbol.lh');
  let openAsset: (entry: AssetManifestEntry) => void = () => {};
  installAssetBrowser({
    manifest,
    selectedId: selectedAssetId,
    onOpen: (entry) => openAsset(entry),
  });
  let instance: PrefabInstance | undefined;
  let particleRenderer: SvgParticleRenderer | undefined;
  let currentLayout: SymbolLayout = { x: 0, y: 0, scale: 1 };
  const guideFrame = document.querySelector<SVGRectElement>('#layout-frame');
  const artFrame = document.querySelector<SVGRectElement>('#art-frame');
  const clipRect = document.querySelector<SVGRectElement>('#symbol-clip-rect');
  const badgeFrame = document.querySelector<SVGRectElement>('#badge-frame');
  const artAnchorGuide = document.querySelector<SVGGElement>('#art-anchor-guide');
  const guideLabel = document.querySelector<SVGTextElement>('#layout-label');
  const artLabel = document.querySelector<SVGTextElement>('#art-label');
  const badgeLabel = document.querySelector<SVGTextElement>('#badge-label');
  const artAnchorLabel = document.querySelector<SVGTextElement>('#art-anchor-label');
  const hierarchyPanel = document.querySelector<HTMLElement>('#hierarchy-panel');
  const hierarchyTree = document.querySelector<HTMLElement>('#hierarchy-tree');
  const hierarchyCopy = document.querySelector<HTMLButtonElement>('#hierarchy-copy');
  const hierarchyToggle = document.querySelector<HTMLButtonElement>('#hierarchy-toggle');
  const metricsPanel = document.querySelector<HTMLElement>('.metrics');
  const metricsToggle = document.querySelector<HTMLButtonElement>('#metrics-toggle');
  const hierarchyHighlight = document.querySelector<SVGRectElement>('#hierarchy-highlight');
  const anchorOverlay = document.querySelector<SVGSVGElement>('#anchor-overlay');
  const surface = document.querySelector<HTMLElement>('#stage-surface');
  const logicalFactor = 1280 / 960;
  const previewFactor = 1 / logicalFactor;
  const fitPreviewViewport = () => {
    if (!surface) return;
    const width = Math.max(1, surface.clientWidth);
    const height = Math.max(1, surface.clientHeight);
    const previewWidth = Math.min(width, height * (960 / 540));
    const previewHeight = previewWidth * (540 / 960);
    surface.style.setProperty('--scene-viewport-width', `${previewWidth}px`);
    surface.style.setProperty('--scene-viewport-height', `${previewHeight}px`);
  };
  fitPreviewViewport();
  let updateMetrics: () => void = () => {};
  let sourceWidth = 1280;
  let sourceHeight = 1280;
  let activeMode: 'prefab' | 'scene' | 'model' = 'prefab';
  let modelPreview: ModelPreviewHandle | undefined;
  let modelSelectedPath = '$';
  let sceneHandle: SlotMachineSceneHandle | undefined;
  const selectedImage =
    selectedManifestEntry?.kind === 'image' ? selectedManifestEntry.id : symbolId;
  let sourceName = selectedImage;
  let art: Laya.Image | undefined;
  let selectedNode: Laya.Node | undefined;
  let hierarchySelectionVisible = false;
  const hierarchySummaries = new WeakMap<Laya.Node, HTMLElement>();
  const showGuides = new URLSearchParams(window.location.search).get('guides') === '1';
  if (!showGuides) artAnchorLabel?.setAttribute('visibility', 'hidden');

  const nodeType = (node: Laya.Node) => {
    const L = (globalThis as unknown as { Laya?: Record<string, any> }).Laya;
    if (L?.Label && node instanceof L.Label) return 'Label';
    if (L?.Text && node instanceof L.Text) return 'Text';
    if (L?.Image && node instanceof L.Image) return 'Image';
    if (L?.Box && node instanceof L.Box) return 'Box';
    if (L?.Scene && node instanceof L.Scene) return 'Scene';
    if (L?.Sprite && node instanceof L.Sprite) return 'Sprite';
    return node.constructor?.name || 'Node';
  };
  type LayoutNode = Laya.Node & {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    anchorX?: number;
    anchorY?: number;
    pivotX?: number;
    pivotY?: number;
  };
  const boundsInStage = (value: LayoutNode) => {
    const width = Math.abs(Number(value.width) || 0);
    const height = Math.abs(Number(value.height) || 0);
    const scaleX = Number(value.scaleX) || 1;
    const scaleY = Number(value.scaleY) || 1;
    const anchorX = Number(value.anchorX) || 0;
    const anchorY = Number(value.anchorY) || 0;
    const pivotX = Number.isFinite(Number(value.pivotX)) ? Number(value.pivotX) : width * anchorX;
    const pivotY = Number.isFinite(Number(value.pivotY)) ? Number(value.pivotY) : height * anchorY;
    let x = Number(value.x ?? 0) - pivotX * scaleX;
    let y = Number(value.y ?? 0) - pivotY * scaleY;
    let renderedWidth = width * Math.abs(scaleX);
    let renderedHeight = height * Math.abs(scaleY);
    const root = instance?.root as LayoutNode | undefined;
    if (root && value === root) {
      return { x, y, width: renderedWidth, height: renderedHeight };
    }
    const stopParent = root?.parent;
    let parent = value.parent as LayoutNode | null;
    while (parent && parent !== stopParent) {
      const parentWidth = Math.abs(Number(parent.width) || 0);
      const parentHeight = Math.abs(Number(parent.height) || 0);
      const parentScaleX = Number(parent.scaleX) || 1;
      const parentScaleY = Number(parent.scaleY) || 1;
      const parentAnchorX = Number(parent.anchorX) || 0;
      const parentAnchorY = Number(parent.anchorY) || 0;
      const parentPivotX = Number.isFinite(Number(parent.pivotX))
        ? Number(parent.pivotX)
        : parentWidth * parentAnchorX;
      const parentPivotY = Number.isFinite(Number(parent.pivotY))
        ? Number(parent.pivotY)
        : parentHeight * parentAnchorY;
      x = Number(parent.x ?? 0) - parentPivotX * parentScaleX + x * parentScaleX;
      y = Number(parent.y ?? 0) - parentPivotY * parentScaleY + y * parentScaleY;
      renderedWidth *= Math.abs(parentScaleX);
      renderedHeight *= Math.abs(parentScaleY);
      parent = parent.parent as LayoutNode | null;
    }
    return { x, y, width: renderedWidth, height: renderedHeight };
  };
  const updateHierarchyHighlight = () => {
    const node = selectedNode as LayoutNode | undefined;
    if (!hierarchyHighlight) return;
    if (!node || !hierarchySelectionVisible) {
      hierarchyHighlight.setAttribute('visibility', 'hidden');
      return;
    }
    const bounds = boundsInStage(node);
    hierarchyHighlight.setAttribute('x', (bounds.x * previewFactor).toFixed(2));
    hierarchyHighlight.setAttribute('y', (bounds.y * previewFactor).toFixed(2));
    hierarchyHighlight.setAttribute('width', (bounds.width * previewFactor).toFixed(2));
    hierarchyHighlight.setAttribute('height', (bounds.height * previewFactor).toFixed(2));
    hierarchyHighlight.setAttribute('visibility', 'visible');
  };

  const setSelection = (node: Laya.Node, summary?: HTMLElement, showBounds = true) => {
    selectedNode = node;
    hierarchySelectionVisible = showBounds;
    for (const item of Array.from(hierarchyTree?.querySelectorAll<HTMLElement>('summary') || []))
      item.classList.toggle('is-selected', item === summary);
    updateMetrics();
    updateHierarchyHighlight();
  };

  const selectHierarchyNode = (node: Laya.Node, summary: HTMLElement) =>
    setSelection(node, summary, true);

  const renderModelMetrics = () => {
    const inspection = modelPreview?.inspect();
    if (!inspection) return;
    const selected =
      inspection.nodes.find((node) => node.path === modelSelectedPath) || inspection.nodes[0];
    modelSelectedPath = selected?.path || '$';
    const title = metricsPanel?.querySelector<HTMLElement>('.metrics-title');
    if (title) title.textContent = '3D MODEL INSPECTOR';
    const dl = metricsPanel?.querySelector('dl');
    if (dl) {
      const summary = inspection.compatibility.inventory.summary;
      const rows: Array<[string, string]> = [
        [
          'Selection',
          selected ? `${selected.name || 'Unnamed'} · ${selected.mesh ? 'Mesh' : 'Node'}` : '—',
        ],
        ['Asset', modelPreview?.assetId || '—'],
        [
          'Source',
          `${summary.nodes} nodes · ${summary.meshes} meshes · ${summary.primitives} primitives`,
        ],
        ['Geometry', `${summary.vertices} vertices · ${summary.triangles} triangles`],
        ['Materials', `${summary.materials} materials · ${summary.textures} textures`],
        ['Animation', `${summary.animations} clips · live ${inspection.animations.length}`],
        ['Renderer', context?.renderer.selected || '—'],
        [
          'Viewport / DPR',
          context
            ? `${context.canvas.clientWidth} × ${context.canvas.clientHeight} · DPR ${(window.devicePixelRatio || 1).toFixed(2)}`
            : '—',
        ],
      ];
      dl.replaceChildren();
      for (const [label, value] of rows) {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        dl.append(dt, dd);
      }
    }
    const legend = metricsPanel?.querySelector<HTMLElement>('.metrics-legend');
    if (legend) legend.hidden = true;
    const note = metricsPanel?.querySelector<HTMLElement>('.metrics-note');
    if (note)
      note.textContent =
        '這是同一個 Laya Sprite3D model instance。拖曳畫面旋轉、滾輪縮放；點左側階層查看 mesh、材質、morph 與動畫。';
    modelPreview?.renderHierarchy(hierarchyTree!, modelSelectedPath, (path) => {
      modelSelectedPath = path;
      renderModelMetrics();
    });
  };

  const restore2DInspector = () => {
    const title = metricsPanel?.querySelector<HTMLElement>('.metrics-title');
    if (title) title.textContent = 'LAYOUT INSPECTOR';
    const legend = metricsPanel?.querySelector<HTMLElement>('.metrics-legend');
    if (legend) legend.hidden = false;
    const note = metricsPanel?.querySelector<HTMLElement>('.metrics-note');
    if (note)
      note.textContent =
        'Click a hierarchy node to inspect it. Click empty space around the Prefab to inspect the root. The outer frame is the fixed design box; the yellow frame is the Laya Image node. HTML controls are inspector chrome only.';
  };

  const renderHierarchy = () => {
    if (!hierarchyTree || !instance) return;
    hierarchyTree.replaceChildren();
    const append = (node: Laya.Node, depth: number) => {
      const branch = document.createElement('details');
      branch.open = depth === 0;
      const summary = document.createElement('summary');
      summary.textContent = node.name || 'Unnamed';
      const type = document.createElement('span');
      type.className = 'hierarchy-type';
      type.textContent = nodeType(node);
      summary.append(' ', type);
      hierarchySummaries.set(node, summary);
      summary.addEventListener('click', () => selectHierarchyNode(node, summary));
      branch.appendChild(summary);
      const children = Array.from(
        { length: node.numChildren },
        (_, index) => node.getChildAt(index) as Laya.Node,
      );
      if (children.length) {
        const childHost = document.createElement('div');
        childHost.className = 'hierarchy-children';
        for (const child of children) childHost.appendChild(append(child, depth + 1));
        branch.appendChild(childHost);
      }
      return branch;
    };
    hierarchyTree.appendChild(append(instance.root, 0));
    const selected = selectedNode
      ? hierarchySummaries.get(selectedNode)
      : hierarchyTree.querySelector<HTMLElement>('summary');
    if (selectedNode && selected) {
      for (const item of Array.from(hierarchyTree.querySelectorAll<HTMLElement>('summary')))
        item.classList.toggle('is-selected', item === selected);
      hierarchySelectionVisible = false;
      updateMetrics();
      updateHierarchyHighlight();
    }
  };

  const hierarchySnapshot = () => {
    const walk = (node: Laya.Node, path: string): Record<string, unknown> => {
      const value = node as LayoutNode;
      const width = Number(value.width) || 0;
      const height = Number(value.height) || 0;
      const anchorX = Number(value.anchorX) || 0;
      const anchorY = Number(value.anchorY) || 0;
      const pivotX = Number.isFinite(Number(value.pivotX)) ? Number(value.pivotX) : width * anchorX;
      const pivotY = Number.isFinite(Number(value.pivotY))
        ? Number(value.pivotY)
        : height * anchorY;
      return {
        path,
        name: node.name || 'Unnamed',
        type: nodeType(node),
        x: Number(value.x ?? 0),
        y: Number(value.y ?? 0),
        width,
        height,
        scaleX: Number(value.scaleX) || 1,
        scaleY: Number(value.scaleY) || 1,
        anchorX,
        anchorY,
        pivotX,
        pivotY,
        children: Array.from({ length: node.numChildren }, (_, index) => {
          const child = node.getChildAt(index) as Laya.Node;
          return walk(child, `${path}/${child.name || index}`);
        }),
      };
    };
    return {
      prefab: 'slot/symbol',
      designCanvas: { width: 480, height: 480 },
      selected: selectedNode
        ? { path: selectedNode.name || 'Unnamed', type: nodeType(selectedNode) }
        : null,
      hierarchy: instance ? walk(instance.root, instance.root.name || 'SlotSymbol') : null,
    };
  };

  hierarchyCopy?.addEventListener('click', async () => {
    if (activeMode === 'scene' && sceneHandle) {
      await sceneHandle.copyHierarchy();
      return;
    }
    if (activeMode === 'model' && modelPreview?.ready) {
      const payload = JSON.stringify(modelPreview.snapshot(), null, 2);
      try {
        await navigator.clipboard.writeText(payload);
        hierarchyCopy.textContent = 'COPIED';
      } catch {
        const fallback = document.createElement('textarea');
        fallback.value = payload;
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        document.execCommand('copy');
        fallback.remove();
        hierarchyCopy.textContent = 'COPIED';
      }
      window.setTimeout(() => {
        if (hierarchyCopy) hierarchyCopy.textContent = 'COPY';
      }, 1200);
      return;
    }
    const payload = JSON.stringify(hierarchySnapshot(), null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      hierarchyCopy.textContent = 'COPIED';
    } catch {
      const fallback = document.createElement('textarea');
      fallback.value = payload;
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand('copy');
      fallback.remove();
      hierarchyCopy.textContent = 'COPIED';
    }
    window.setTimeout(() => {
      if (hierarchyCopy) hierarchyCopy.textContent = 'COPY';
    }, 1200);
  });

  hierarchyToggle?.addEventListener('click', () => {
    const collapsed = hierarchyPanel?.classList.toggle('is-collapsed') ?? false;
    document.body.classList.toggle('left-panel-collapsed', collapsed);
    hierarchyToggle.setAttribute('aria-expanded', String(!collapsed));
    hierarchyToggle.setAttribute(
      'aria-label',
      collapsed ? 'Expand hierarchy' : 'Collapse hierarchy',
    );
    hierarchyToggle.textContent = collapsed ? '+' : '−';
  });
  metricsToggle?.addEventListener('click', () => {
    const collapsed = metricsPanel?.classList.toggle('is-collapsed') ?? false;
    document.body.classList.toggle('right-panel-collapsed', collapsed);
    metricsToggle.setAttribute('aria-expanded', String(!collapsed));
    metricsToggle.setAttribute('aria-label', collapsed ? 'Expand inspector' : 'Collapse inspector');
    metricsToggle.textContent = collapsed ? '+' : '−';
    requestAnimationFrame(() => context.resize());
  });
  const layout = (width: number, height: number) => {
    if (!instance || width < 1 || height < 1) return;
    const scale = Math.max(width / 960, height / 540);
    const visibleWidth = width / scale;
    const visibleHeight = height / scale;
    const cardScale = Math.min(
      1,
      Math.max(0.4, Math.min((visibleWidth - 24) / 480, (visibleHeight - 96) / 480)),
    );
    instance.root.scaleX = cardScale * logicalFactor;
    instance.root.scaleY = cardScale * logicalFactor;
    currentLayout = {
      x: Math.max(12, (visibleWidth - 480 * cardScale) / 2),
      y: Math.max(48, (visibleHeight - 480 * cardScale) / 2),
      scale: cardScale,
    };
    instance.root.pos(currentLayout.x * logicalFactor, currentLayout.y * logicalFactor);
    guideFrame?.setAttribute('x', currentLayout.x.toFixed(2));
    guideFrame?.setAttribute('y', currentLayout.y.toFixed(2));
    guideFrame?.setAttribute('width', (480 * cardScale).toFixed(2));
    guideFrame?.setAttribute('height', (480 * cardScale).toFixed(2));
    clipRect?.setAttribute('x', currentLayout.x.toFixed(2));
    clipRect?.setAttribute('y', currentLayout.y.toFixed(2));
    clipRect?.setAttribute('width', (480 * cardScale).toFixed(2));
    clipRect?.setAttribute('height', (480 * cardScale).toFixed(2));
    badgeFrame?.setAttribute('x', (currentLayout.x + 120 * cardScale).toFixed(2));
    badgeFrame?.setAttribute('y', (currentLayout.y + 426 * cardScale).toFixed(2));
    badgeFrame?.setAttribute('width', (240 * cardScale).toFixed(2));
    badgeFrame?.setAttribute('height', (30 * cardScale).toFixed(2));
    guideLabel?.setAttribute('x', (currentLayout.x + 10).toFixed(2));
    guideLabel?.setAttribute('y', (currentLayout.y + 18).toFixed(2));
    artLabel?.setAttribute('x', (currentLayout.x + 10).toFixed(2));
    artLabel?.setAttribute('y', (currentLayout.y + 36).toFixed(2));
    badgeLabel?.setAttribute('x', (currentLayout.x + 10).toFixed(2));
    badgeLabel?.setAttribute('y', (currentLayout.y + 480 * cardScale - 10).toFixed(2));
    const anchorX = Number(art?.x ?? 240);
    const anchorY = Number(art?.y ?? 240);
    artAnchorGuide?.setAttribute(
      'transform',
      `translate(${(currentLayout.x + anchorX * cardScale).toFixed(2)} ${(currentLayout.y + anchorY * cardScale).toFixed(2)})`,
    );
    particleRenderer?.setLayout(currentLayout);
    updateMetrics();
  };
  // One runtime is shared by Prefab and Scene assets. The preview surface is
  // still a 960×540 design view; the 1280×720 context is the Scene contract.
  const context = await ZhudaEngine.boot({
    container: '#game',
    width: 1280,
    height: 720,
    dprCap: 3,
    designSize: { width: 1280, height: 720 },
    scaleMode: 'noborder',
    features: ['core', '2d', '3d', 'ui', 'gltf', 'postProcess', 'particle2d'],
    preserveDrawingBuffer: true,
    bgColor: '#0b1224',
    onResize: ({ width, height }) => layout(width, height),
    beforeInit: () => {
      const laya = (globalThis as unknown as { Laya?: { Config?: { isAlpha?: boolean } } }).Laya;
      if (laya?.Config) laya.Config.isAlpha = true;
    },
  });
  (context.stage as unknown as { bgColor: string | null }).bgColor = null;
  context.canvas.style.background = 'transparent';
  if (surface) {
    fitPreviewViewport();
    surface.style.display = 'none';
    void surface.offsetWidth;
    surface.style.display = 'block';
    context.resize();
  }
  const resizePreview = () => {
    fitPreviewViewport();
    context.resize();
  };
  const previewObserver =
    typeof ResizeObserver === 'function' && surface ? new ResizeObserver(resizePreview) : undefined;
  if (previewObserver && surface) previewObserver.observe(surface);
  window.addEventListener('resize', resizePreview, { passive: true });
  const provider = createAssetProvider();
  const library = new ZhudaPrefabLibrary({ provider, definitions });
  instance = await library.instantiate('slot/symbol', { parent: context.rootScene });
  const canvasRect = context.canvas.getBoundingClientRect();
  layout(canvasRect.width || 960, canvasRect.height || 540);
  const effect = new SlotSymbolEffect(instance);
  art = instance.find('Art') as Laya.Image;
  if (selectedImage !== symbolId) {
    art.skin = new URL(`assets/${selectedImage}`, document.baseURI).href;
  }
  const badge = instance.find('Badge') as Laya.Label;
  if (!(badge instanceof Laya.Label))
    throw new Error('Badge must be a Laya.Label supplied by the vendor runtime.');
  selectedNode = art;
  renderHierarchy();
  const selectionMetric = document.querySelector<HTMLElement>('#metric-selection');
  const sourceMetric = document.querySelector<HTMLElement>('#metric-source');
  const nodeRectMetric = document.querySelector<HTMLElement>('#metric-node-rect');
  const nodePositionMetric = document.querySelector<HTMLElement>('#metric-node-pos');
  const nodeScaleMetric = document.querySelector<HTMLElement>('#metric-node-scale');
  const nodeAnchorMetric = document.querySelector<HTMLElement>('#metric-node-anchor');
  const nodeOwnerMetric = document.querySelector<HTMLElement>('#metric-node-owner');
  const screenMetric = document.querySelector<HTMLElement>('#metric-screen');
  const scaleMetric = document.querySelector<HTMLElement>('#metric-scale');
  const viewportMetric = document.querySelector<HTMLElement>('#metric-viewport');
  const loadSourceMetadata = (url: string, label: string) => {
    sourceName = label;
    sourceWidth = 0;
    sourceHeight = 0;
    if (sourceMetric) sourceMetric.textContent = 'loading…';
    const probe = new Image();
    probe.onload = () => {
      sourceWidth = probe.naturalWidth;
      sourceHeight = probe.naturalHeight;
      updateMetrics();
    };
    probe.onerror = () => updateMetrics();
    probe.src = url;
  };
  updateMetrics = () => {
    if (activeMode === 'model' && modelPreview?.ready) {
      renderModelMetrics();
      return;
    }
    const stageScale = Math.abs(Number(context.stage.scaleX) || 1);
    const artNode = art;
    const artWidth = Math.abs(Number(artNode?.width) || 400);
    const artHeight = Math.abs(Number(artNode?.height) || 400);
    const artScaleX = Number(artNode?.scaleX) || 1;
    const artScaleY = Number(artNode?.scaleY) || 1;
    const designWidth = artWidth * Math.abs(artScaleX) * currentLayout.scale;
    const designHeight = artHeight * Math.abs(artScaleY) * currentLayout.scale;
    const screenWidth = designWidth * stageScale;
    const screenHeight = designHeight * stageScale;
    const selected = selectedNode as LayoutNode | undefined;
    const selectedIsRoot = Boolean(selected && instance && selected === instance.root);
    const selectedWidth = Math.abs(Number(selected?.width) || 0);
    const selectedHeight = Math.abs(Number(selected?.height) || 0);
    const selectedScaleX = selectedIsRoot ? 1 : Number(selected?.scaleX) || 1;
    const selectedScaleY = selectedIsRoot ? 1 : Number(selected?.scaleY) || 1;
    const selectedAnchorX = Number(selected?.anchorX) || 0;
    const selectedAnchorY = Number(selected?.anchorY) || 0;
    const selectedPivotX = Number.isFinite(Number(selected?.pivotX))
      ? Number(selected?.pivotX)
      : selectedWidth * selectedAnchorX;
    const selectedPivotY = Number.isFinite(Number(selected?.pivotY))
      ? Number(selected?.pivotY)
      : selectedHeight * selectedAnchorY;
    const selectedBoundsX = selectedIsRoot
      ? 0
      : Number(selected?.x ?? 0) - selectedPivotX * selectedScaleX;
    const selectedBoundsY = selectedIsRoot
      ? 0
      : Number(selected?.y ?? 0) - selectedPivotY * selectedScaleY;
    const sourceReady = sourceWidth > 0 && sourceHeight > 0;
    if (selectionMetric)
      selectionMetric.textContent = selected
        ? `${selected.name || 'Unnamed'} · ${nodeType(selected)}`
        : '—';
    if (sourceMetric) {
      sourceMetric.textContent =
        selected === art && sourceReady ? `${sourceWidth} × ${sourceHeight} px` : '—';
      sourceMetric.title = selected === art ? sourceName : '';
    }
    if (nodeRectMetric)
      nodeRectMetric.textContent = selected
        ? `x ${selectedBoundsX.toFixed(0)} · y ${selectedBoundsY.toFixed(0)} · ${(selectedWidth * Math.abs(selectedScaleX)).toFixed(0)} × ${(selectedHeight * Math.abs(selectedScaleY)).toFixed(0)}`
        : '—';
    if (nodePositionMetric)
      nodePositionMetric.textContent = selected
        ? `${Number(selected.x ?? 0).toFixed(0)}, ${Number(selected.y ?? 0).toFixed(0)}`
        : '—';
    if (nodeScaleMetric)
      nodeScaleMetric.textContent = selected
        ? `${selectedScaleX.toFixed(2)} × ${selectedScaleY.toFixed(2)}${selected === art && (selectedScaleX !== 1 || selectedScaleY !== 1) ? ' · animated' : ''}`
        : '—';
    if (nodeAnchorMetric)
      nodeAnchorMetric.textContent = selected
        ? `${(selectedAnchorX * 100).toFixed(0)}% / ${(selectedAnchorY * 100).toFixed(0)}% · ${selectedPivotX.toFixed(0)}, ${selectedPivotY.toFixed(0)}`
        : '—';
    if (nodeOwnerMetric)
      nodeOwnerMetric.textContent = selected ? `Laya.${nodeType(selected)}` : '—';
    const selectedDesignWidth =
      selectedWidth * Math.abs(selectedScaleX) * (selectedIsRoot ? 1 : currentLayout.scale);
    const selectedDesignHeight =
      selectedHeight * Math.abs(selectedScaleY) * (selectedIsRoot ? 1 : currentLayout.scale);
    if (screenMetric)
      screenMetric.textContent = selected
        ? `${Math.round(selectedDesignWidth * stageScale)} × ${Math.round(selectedDesignHeight * stageScale)} CSS px`
        : '—';
    if (scaleMetric)
      scaleMetric.textContent =
        selected === art && sourceReady
          ? `${(screenWidth / sourceWidth).toFixed(2)}× source · ${(currentLayout.scale * Math.abs(artScaleX)).toFixed(2)}× design`
          : selected
            ? `${(selectedIsRoot ? 1 : currentLayout.scale * Math.abs(selectedScaleX)).toFixed(2)}× design`
            : '—';
    const artStageBounds = artNode
      ? boundsInStage(artNode as LayoutNode)
      : { x: 0, y: 0, width: 0, height: 0 };
    artFrame?.setAttribute('x', (artStageBounds.x * previewFactor).toFixed(2));
    artFrame?.setAttribute('y', (artStageBounds.y * previewFactor).toFixed(2));
    artFrame?.setAttribute('width', (artStageBounds.width * previewFactor).toFixed(2));
    artFrame?.setAttribute('height', (artStageBounds.height * previewFactor).toFixed(2));
    updateHierarchyHighlight();
    if (viewportMetric)
      viewportMetric.textContent = `${Math.round(surface?.clientWidth || 0)} × ${Math.round(surface?.clientHeight || 0)} · DPR ${(window.devicePixelRatio || 1).toFixed(2)}`;
  };
  surface?.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLCanvasElement) &&
      target !== surface &&
      !(target instanceof SVGElement)
    )
      return;
    if (activeMode === 'scene') {
      sceneHandle?.selectRoot();
      return;
    }
    if (activeMode === 'model') return;
    if (instance) setSelection(instance.root, hierarchySummaries.get(instance.root), true);
  });
  let modelDrag: { x: number; y: number } | undefined;
  surface?.addEventListener('pointerdown', (event) => {
    if (activeMode !== 'model' || !modelPreview) return;
    modelDrag = { x: event.clientX, y: event.clientY };
    surface.setPointerCapture?.(event.pointerId);
  });
  surface?.addEventListener('pointermove', (event) => {
    if (!modelDrag || activeMode !== 'model' || !modelPreview) return;
    modelPreview.orbit(event.clientX - modelDrag.x, event.clientY - modelDrag.y);
    modelDrag = { x: event.clientX, y: event.clientY };
  });
  surface?.addEventListener('pointerup', () => {
    modelDrag = undefined;
  });
  surface?.addEventListener('pointercancel', () => {
    modelDrag = undefined;
  });
  surface?.addEventListener(
    'wheel',
    (event) => {
      if (activeMode !== 'model' || !modelPreview) return;
      event.preventDefault();
      modelPreview.zoom(event.deltaY);
    },
    { passive: false },
  );
  loadSourceMetadata(new URL(`assets/${selectedImage}`, document.baseURI).href, selectedImage);
  const particleLayer = document.querySelector<SVGGElement>('#particle-layer');
  if (!particleLayer) throw new Error('Missing SVG particle layer.');
  particleRenderer = new SvgParticleRenderer(particleLayer);
  particleRenderer.setLayout(currentLayout);
  let objectUrl: string | undefined;
  let disposed = false;
  let currentAssetId = selectedImage;
  const setStateUI = (state: SlotSymbolState) => {
    const label = document.querySelector<HTMLElement>('#state-label');
    if (label) label.textContent = state;
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-state]'))) {
      const active = button.dataset.state === state;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  };
  const play = (state: SlotSymbolState) => {
    effect.play(state);
    particleRenderer?.play(state);
    setStateUI(state);
    ZhudaEngine.flushRenderFrames(3);
  };
  const replace = (file: File) => {
    if (!file.type.startsWith('image/') || file.size > 8_000_000)
      throw Error('Choose an image under 8 MB.');
    const next = URL.createObjectURL(file);
    art!.skin = next;
    loadSourceMetadata(next, file.name);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = next;
  };
  const updateActivePreview = (dt: number) => {
    if (activeMode === 'scene') sceneHandle?.update(dt);
    else if (activeMode === 'model') return;
    else {
      effect.update(dt);
      particleRenderer?.update(dt);
      updateMetrics();
    }
  };
  context.runtime.start(updateActivePreview);
  // Force the first transparent-canvas composite after the shared surface has
  // been measured. Some WebGL browsers defer an alpha canvas' initial draw
  // until the stage is explicitly invalidated.
  context.stage.repaint();
  const requestedState = new URLSearchParams(window.location.search).get('state');
  const initialState: SlotSymbolState =
    requestedState === 'selected' || requestedState === 'win' || requestedState === 'jackpot'
      ? requestedState
      : 'idle';
  play(initialState);
  ZhudaEngine.flushRenderFrames(4);
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-state]')))
    button.onclick = () => play(button.dataset.state as SlotSymbolState);
  document.querySelector<HTMLInputElement>('#symbol-file')!.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      try {
        replace(file);
      } catch (error) {
        window.alert(String(error));
      }
    }
  };
  window.addEventListener('keydown', (event) => {
    const state: Record<string, SlotSymbolState> = {
      '1': 'idle',
      '2': 'selected',
      '3': 'win',
      '4': 'jackpot',
    };
    if (state[event.key]) play(state[event.key]);
  });
  const updateAssetUrl = (entry: AssetManifestEntry) => {
    const next = new URL(window.location.href);
    next.search = '';
    if (entry.kind === 'scene' && entry.id === 'scenes/slot-machine.ls')
      next.searchParams.set('scene', 'slot-machine');
    if (entry.id !== 'prefabs/slot-symbol.lh') next.searchParams.set('asset', entry.id);
    history.replaceState(null, '', `${next.pathname}${next.search}`);
  };
  const setPreviewMode = (mode: 'prefab' | 'scene' | 'model') => {
    if (shouldReleaseHiddenPreview(resourcePolicy, activeMode, mode)) {
      // The 2D symbol is intentionally kept warm because it is the primary
      // showcase and its effect controls remain interactive. Large Scene and
      // GLB trees are released when hidden; selecting them again creates a
      // fresh provider-backed instance with the same public definition.
      if (activeMode === 'scene' && sceneHandle) {
        sceneHandle.dispose();
        sceneHandle = undefined;
      }
      if (activeMode === 'model' && modelPreview) {
        modelPreview.dispose();
        modelPreview = undefined;
      }
    }
    activeMode = mode;
    document.body.classList.toggle('scene-mode', mode === 'scene');
    document.body.classList.toggle('model-mode', mode === 'model');
    if (mode === 'scene') {
      instance!.root.visible = false;
      modelPreview?.setVisible(false);
      sceneHandle?.setVisible(true);
      surface?.setAttribute('data-preview-mode', 'scene');
    } else if (mode === 'model') {
      instance!.root.visible = false;
      sceneHandle?.setVisible(false);
      modelPreview?.setVisible(true);
      surface?.setAttribute('data-preview-mode', 'model');
      hierarchySelectionVisible = false;
      hierarchyHighlight?.setAttribute('visibility', 'hidden');
    } else {
      sceneHandle?.setVisible(false);
      modelPreview?.setVisible(false);
      instance!.root.visible = true;
      anchorOverlay?.setAttribute('viewBox', '0 0 960 540');
      surface?.setAttribute('data-preview-mode', 'prefab');
      restore2DInspector();
      renderHierarchy();
    }
    requestAnimationFrame(() => {
      fitPreviewViewport();
      context.resize();
    });
  };
  const switchAsset = async (entry: AssetManifestEntry) => {
    if (disposed) return;
    if (entry.kind === 'scene' && entry.id === 'scenes/slot-machine.ls') {
      setPreviewMode('scene');
      if (!sceneHandle) sceneHandle = await startSlotMachineScene({ context });
      sceneHandle.setVisible(true);
      instance!.root.visible = false;
      updateAssetUrl(entry);
      return;
    }
    if (entry.kind === 'model' && /\.(?:glb|gltf)$/i.test(entry.id)) {
      setPreviewMode('model');
      if (!modelPreview) {
        modelPreview = createModelPreview(context, manifest);
        modelPreview.setVisible(false);
      }
      await modelPreview.load(entry);
      modelSelectedPath = '$';
      modelPreview.setMode('raw');
      modelPreview.setVisible(true);
      renderModelMetrics();
      updateAssetUrl(entry);
      context.stage.repaint();
      return;
    }
    setPreviewMode('prefab');
    if (entry.kind === 'image') {
      const url = new URL(`assets/${entry.id}`, document.baseURI).href;
      currentAssetId = entry.id;
      art!.skin = url;
      loadSourceMetadata(url, entry.id);
      selectedNode = art;
      renderHierarchy();
      updateMetrics();
    }
    updateAssetUrl(entry);
  };
  openAsset = (entry) => {
    void switchAsset(entry).catch((error) =>
      console.error('[slot-symbol] asset switch failed', error),
    );
  };
  if (selectedManifestEntry?.kind === 'model') await switchAsset(selectedManifestEntry);
  else if (sceneMode) await switchAsset({ id: 'scenes/slot-machine.ls', kind: 'scene' });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    previewObserver?.disconnect();
    window.removeEventListener('resize', resizePreview);
    effect.dispose();
    particleRenderer?.dispose();
    particleRenderer = undefined;
    instance?.dispose();
    instance = undefined;
    modelPreview?.dispose();
    modelPreview = undefined;
    sceneHandle?.dispose();
    sceneHandle = undefined;
    library.dispose();
    provider.dispose?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    context.dispose();
  };
  window.addEventListener('pagehide', dispose, { once: true });
  window.slotSymbolDemo = {
    ready: true,
    play,
    replace,
    report: () =>
      activeMode === 'model'
        ? {
            ready: !disposed && Boolean(modelPreview?.ready),
            mode: 'model',
            resourcePolicy,
            model: modelPreview?.snapshot() ?? null,
          }
        : {
            ready: !disposed,
            mode: activeMode,
            resourcePolicy,
            state: effect.currentState,
            provenance: instance?.provenance ?? null,
            library: library.report(),
            source: { name: sourceName, width: sourceWidth, height: sourceHeight },
            design: { prefab: [480, 480], art: [400, 400] },
          },
  };
};

void main().catch((error) => {
  const detail = error instanceof Error && error.stack ? error.stack : String(error);
  console.error('[slot-symbol] boot failed', detail);
  window.slotSymbolDemo = {
    ready: false,
    play: () => {},
    replace: () => {},
    report: () => ({ ready: false, error: detail }),
  };
});
