import type { LayaHierarchyNodeData, LayaGraphicsCmdData } from '../types/index.ts';

export class ZhudaPrefab {
  public static instantiate(
    lhData: LayaHierarchyNodeData,
    parent?: Laya.Node,
    positionOverride?: { x: number; y: number }
  ): Laya.Sprite {
    const clonedData: LayaHierarchyNodeData = JSON.parse(JSON.stringify(lhData));
    const g = globalThis as unknown as {
      Laya?: {
        LayaEnv?: { isPlaying?: boolean };
        HierarchyParser?: { parse: (data: unknown) => unknown };
        ClassUtils?: { getClass: (name: string) => any };
        Sprite?: new () => Laya.Sprite;
        Text?: new () => Laya.Text;
        Graphics?: new () => Laya.Graphics;
      };
    };

    const L = g.Laya;
    if (!L || !L.Sprite) {
      throw new Error('[ZhudaPrefab] Laya runtime 尚未初始化，請先執行 await ZhudaEngine.boot()');
    }

    if (L.LayaEnv) {
      L.LayaEnv.isPlaying = true;
    }

    let rootSprite: Laya.Sprite | null = null;

    // 優先使用 LayaAir 3.4.2 原生 HierarchyParser.parse
    if (L.HierarchyParser && typeof L.HierarchyParser.parse === 'function') {
      try {
        const parsed = L.HierarchyParser.parse(clonedData);
        const first = Array.isArray(parsed) ? parsed[0] : parsed;
        if (first) {
          rootSprite = first as Laya.Sprite;
        }
      } catch (_err) {
        rootSprite = null;
      }
    }

    // 保底與精準繪圖水合：確保所有 _gcmds 向量指令與自定義屬性 100% 就緒
    if (!rootSprite) {
      rootSprite = this.hydrateNodeRecursive(clonedData) as Laya.Sprite;
    } else {
      this.ensureGraphicsHydrated(rootSprite, clonedData);
    }

    if (positionOverride) {
      rootSprite.pos(positionOverride.x, positionOverride.y);
    }

    if (parent) {
      parent.addChild(rootSprite);
    }

    return rootSprite;
  }

  private static hydrateNodeRecursive(data: LayaHierarchyNodeData): Laya.Node {
    const L = (globalThis as unknown as { Laya: any }).Laya;
    let node: any;

    if (data._$type === 'Text' || data._$type === 'Label') {
      node = data._$type === 'Label' && L.Label ? new L.Label() : new L.Text();
      node.text = data.text ?? '';
      if (data.font) node.font = data.font;
      if (typeof data.fontSize === 'number') node.fontSize = data.fontSize;
      if (data.color) node.color = data.color;
      if (typeof data.bold === 'boolean') node.bold = data.bold;
      if (data.align) node.align = data.align;
      if (data.valign) node.valign = data.valign;
      if (typeof data.wordWrap === 'boolean') node.wordWrap = data.wordWrap;
      if (data.overflow) node.overflow = data.overflow;
      if (typeof data.leading === 'number') node.leading = data.leading;
      if (typeof data.letterSpacing === 'number') node.letterSpacing = data.letterSpacing;
      if (typeof data.stroke === 'number') node.stroke = data.stroke;
      if (data.strokeColor) node.strokeColor = data.strokeColor;
      if (typeof data.underline === 'boolean') node.underline = data.underline;
      if (data.underlineColor) node.underlineColor = data.underlineColor;
      if (typeof data.strikethrough === 'boolean') node.strikethrough = data.strikethrough;
      if (data.padding) node.padding = data._$type === 'Label' && L.Label ? data.padding.join(",") : data.padding;
    } else if (data._$type === 'Scene' && L.Scene) {
      node = new L.Scene();
    } else if (data._$type === 'Image' && L.Image) {
      node = new L.Image();
    } else if (data._$type === 'Box' && L.Box) {
      node = new L.Box();
    } else {
      node = new L.Sprite();
    }

    node.name = data.name || data._$id;
    if (typeof data.x === 'number') node.x = data.x;
    if (typeof data.y === 'number') node.y = data.y;
    if (typeof data.width === 'number') node.width = data.width;
    if (typeof data.height === 'number') node.height = data.height;
    if (typeof data.anchorX === 'number') node.anchorX = data.anchorX;
    if (typeof data.anchorY === 'number') node.anchorY = data.anchorY;
    if (typeof data.pivotX === 'number') node.pivotX = data.pivotX;
    if (typeof data.pivotY === 'number') node.pivotY = data.pivotY;
    if (typeof data.scaleX === 'number') node.scaleX = data.scaleX;
    if (typeof data.scaleY === 'number') node.scaleY = data.scaleY;
    if (typeof data.rotation === 'number') node.rotation = data.rotation;
    if (typeof data.anchorX === 'number') node.anchorX = data.anchorX;
    if (typeof data.anchorY === 'number') node.anchorY = data.anchorY;
    if (typeof data.pivotX === 'number') node.pivotX = data.pivotX;
    if (typeof data.pivotY === 'number') node.pivotY = data.pivotY;
    if (typeof data.skewX === 'number') node.skewX = data.skewX;
    if (typeof data.skewY === 'number') node.skewY = data.skewY;
    if (typeof data.alpha === 'number') node.alpha = data.alpha;
    if (typeof data.visible === 'boolean') node.visible = data.visible;
    if (typeof data.mouseEnabled === 'boolean') node.mouseEnabled = data.mouseEnabled;
    if (typeof data.skin === 'string') node.skin = data.skin;
    if (typeof data.sizeGrid === 'string') node.sizeGrid = data.sizeGrid;

    if (Array.isArray(data._gcmds) && data._gcmds.length > 0 && node.graphics) {
      this.applyGraphicsCommands(node.graphics, data._gcmds);
    }

    if (Array.isArray(data._$comp) && L.ClassUtils) {
      for (const compDef of data._$comp) {
        const CompCtor = L.ClassUtils.getClass(compDef._$type);
        if (CompCtor && typeof node.addComponent === 'function') {
          try {
            const instance = node.addComponent(CompCtor);
            if (instance) {
              for (const [k, v] of Object.entries(compDef)) {
                if (!k.startsWith('_$')) {
                  instance[k] = v;
                }
              }
            }
          } catch (_e) {
            // Ignore component attach issues in non-full mode
          }
        }
      }
    }

    if (Array.isArray(data._$child)) {
      for (const childData of data._$child) {
        const childNode = this.hydrateNodeRecursive(childData);
        node.addChild(childNode);
      }
    }

    return node;
  }

  private static ensureGraphicsHydrated(node: any, data: LayaHierarchyNodeData): void {
    if (Array.isArray(data._gcmds) && data._gcmds.length > 0 && node?.graphics) {
      const existingCmds = node.graphics.cmds || node.graphics._cmds || [];
      if (existingCmds.length === 0) {
        this.applyGraphicsCommands(node.graphics, data._gcmds);
      }
    }
    if (Array.isArray(data._$child) && typeof node?.numChildren === 'number') {
      for (const childData of data._$child) {
        let child: any = undefined;
        for (let i = 0; i < node.numChildren; i++) {
          const candidate = node.getChildAt(i);
          if (candidate?.name === (childData.name || childData._$id)) {
            child = candidate;
            break;
          }
        }
        // Laya's native parser can omit children of Image/Box nodes. Add the
        // missing serialized child so named Prefab paths remain stable.
        if (!child && typeof node.addChild === 'function') {
          child = this.hydrateNodeRecursive(childData);
          node.addChild(child);
        }
        if (child) this.ensureGraphicsHydrated(child, childData);
      }
    }
  }

  public static applyGraphicsCommands(graphics: Laya.Graphics, cmds: LayaGraphicsCmdData[]): void {
    graphics.clear();
    for (const cmd of cmds) {
      switch (cmd._$type) {
        case 'DrawRoundRectCmd':
          graphics.drawRoundRect(
            cmd.x ?? 0,
            cmd.y ?? 0,
            cmd.width ?? 100,
            cmd.height ?? 40,
            cmd.lt ?? 6,
            cmd.rt ?? 6,
            cmd.lb ?? 6,
            cmd.rb ?? 6,
            cmd.fillColor ?? null,
            cmd.lineColor ?? null,
            cmd.lineWidth ?? 1
          );
          break;
        case 'DrawRectCmd':
          graphics.drawRect(
            cmd.x ?? 0,
            cmd.y ?? 0,
            cmd.width ?? 100,
            cmd.height ?? 40,
            cmd.fillColor ?? null,
            cmd.lineColor ?? null,
            cmd.lineWidth ?? 1
          );
          break;
        case 'DrawCircleCmd':
          graphics.drawCircle(
            cmd.x ?? 0,
            cmd.y ?? 0,
            cmd.radius ?? 10,
            cmd.fillColor ?? null,
            cmd.lineColor ?? null,
            cmd.lineWidth ?? 1
          );
          break;
        case 'DrawEllipseCmd':
          if (typeof (graphics as any).drawEllipse === 'function') {
            (graphics as any).drawEllipse(
              cmd.x ?? 0,
              cmd.y ?? 0,
              cmd.width ?? 20,
              cmd.height ?? 10,
              cmd.fillColor ?? null,
              cmd.lineColor ?? null,
              cmd.lineWidth ?? 1
            );
          } else {
            graphics.drawCircle(
              cmd.x ?? 0,
              cmd.y ?? 0,
              cmd.width ?? 15,
              cmd.fillColor ?? null,
              cmd.lineColor ?? null,
              cmd.lineWidth ?? 1
            );
          }
          break;
        case 'DrawLineCmd':
          graphics.drawLine(
            cmd.fromX ?? 0,
            cmd.fromY ?? 0,
            cmd.toX ?? 10,
            cmd.toY ?? 10,
            cmd.lineColor ?? '#ffffff',
            cmd.lineWidth ?? 1
          );
          break;
        case 'DrawPolyCmd':
          if (Array.isArray(cmd.points) && cmd.points.length >= 6) {
            graphics.drawPoly(
              cmd.x ?? 0,
              cmd.y ?? 0,
              cmd.points,
              cmd.fillColor ?? null,
              cmd.lineColor ?? null,
              cmd.lineWidth ?? 1
            );
          }
          break;
        case 'DrawPieCmd':
          graphics.drawPie(
            cmd.x ?? 0,
            cmd.y ?? 0,
            cmd.radius ?? 10,
            cmd.startAngle ?? 0,
            cmd.endAngle ?? 90,
            cmd.fillColor ?? null,
            cmd.lineColor ?? null,
            cmd.lineWidth ?? 1
          );
          break;
        case 'DrawTextureCmd': {
          const textureId = cmd.textureId;
          const runtime = (globalThis as unknown as { Laya?: any }).Laya;
          const texture = textureId && runtime?.loader?.getRes?.(textureId);
          if (!texture) {
            throw Error(`DrawTextureCmd texture is not loaded: ${textureId || '<missing textureId>'}`);
          }
          if (typeof graphics.drawTexture !== 'function') {
            throw Error('DrawTextureCmd requires Graphics.drawTexture');
          }
          const matrix =
            Array.isArray(cmd.matrix) && cmd.matrix.length === 6 && runtime?.Matrix
              ? new runtime.Matrix(...cmd.matrix)
              : null;
          graphics.drawTexture(
            texture,
            cmd.x ?? 0,
            cmd.y ?? 0,
            cmd.width,
            cmd.height,
            matrix,
            cmd.alpha,
            cmd.color ?? null,
            cmd.blendMode ?? null,
            cmd.uv
          );
          break;
        }
        default:
          break;
      }
    }
  }
}
