/**
 * @zhuda-laya/core — 基建六：動態轉靜態資產序列化器與預製體組裝管線 (StaticAssetPipeline)
 *
 * 實踐「先設計、轉靜態資產 (.lh / .ls)、孤立微預覽、像素/色差校準，最後再組裝」的 AI-Native 工作流：
 * 1. ZhudaAssetSerializer：支援將運行期動態建立的 Laya 節點樹反向序列化為標準 LayaAir 3.4.2 .lh / .ls JSON
 *    （自動顯式標註 Draw*Cmd 的 percent: false，避免 Laya 3.4.2 預設 percent: true 導致座標放大百倍的陷阱）
 * 2. 內建 UI Prefab、Spine 4.2 PhysicsConstraint 靜態骨骼資產、Particle 決定性粒子爆發資產藍圖
 * 3. ZhudaPrefab：基於 Laya.HierarchyParser.parse 毫秒級實例化靜態資產並掛載 @zhudaComponent 腳本
 */

import type {
  AutoFixPatch,
  LayaComponentData,
  LayaGraphicsCmdData,
  LayaHierarchyNodeData,
  ParticleEmitterStaticConfig,
  PixelCalibrationSpec,
  Spine42StaticRigConfig,
  StaticAssetCategory
} from '../types/index.ts';
import { UnityBridgePipeline } from './UnityBridgePipeline.ts';

export class ZhudaAssetSerializer {
  private static idCounter = 1;

  private static nextId(prefix: string = 'node'): string {
    const id = `${prefix}_${String(this.idCounter++).padStart(3, '0')}`;
    return id;
  }

  /**
   * 將運行期動態建立的 Laya.Node / Laya.Sprite 節點樹，無損反向序列化為標準 LayaAir 3.4.2 .lh JSON 結構
   */
  public static serializeNodeToHierarchy(
    node: any,
    options: {
      assetId?: string;
      category?: StaticAssetCategory;
      designCanvas?: { width: number; height: number; padding: number };
      targetSpec?: PixelCalibrationSpec;
      isRoot?: boolean;
    } = {}
  ): LayaHierarchyNodeData {
    const isRoot = options.isRoot ?? true;
    if (isRoot) {
      this.idCounter = 1;
    }

    const nodeType = this.detectLayaNodeType(node);
    const data: LayaHierarchyNodeData = {
      ...(isRoot ? { _$ver: 1 } : {}),
      _$id: node?._$id || this.nextId(nodeType.toLowerCase()),
      _$type: nodeType,
      name: node?.name || nodeType
    };

    if (typeof node?.x === 'number' && node.x !== 0) data.x = Number(node.x.toFixed(2));
    else if (typeof node?.x === 'number' && isRoot) data.x = 0;

    if (typeof node?.y === 'number' && node.y !== 0) data.y = Number(node.y.toFixed(2));
    else if (typeof node?.y === 'number' && isRoot) data.y = 0;

    if (typeof node?.width === 'number' && node.width > 0) data.width = Number(node.width.toFixed(2));
    if (typeof node?.height === 'number' && node.height > 0) data.height = Number(node.height.toFixed(2));
    if (typeof node?.scaleX === 'number' && node.scaleX !== 1) data.scaleX = node.scaleX;
    if (typeof node?.scaleY === 'number' && node.scaleY !== 1) data.scaleY = node.scaleY;
    if (typeof node?.rotation === 'number' && node.rotation !== 0) data.rotation = node.rotation;
    if (typeof node?.alpha === 'number' && node.alpha !== 1) data.alpha = node.alpha;
    if (typeof node?.visible === 'boolean' && !node.visible) data.visible = false;
    if (typeof node?.mouseEnabled === 'boolean' && node.mouseEnabled) data.mouseEnabled = true;
    if (typeof node?.skin === 'string' && node.skin) data.skin = node.skin;
    if (typeof node?.sizeGrid === 'string' && node.sizeGrid) data.sizeGrid = node.sizeGrid;
    else if (Array.isArray(node?.sizeGrid)) data.sizeGrid = node.sizeGrid.join(',');

    // 序列化 Text / Label 屬性
    if (nodeType === 'Text' || nodeType === 'Label' || typeof node?.text === 'string') {
      data.text = String(node.text ?? '');
      if (node.font) data.font = node.font;
      if (typeof node.fontSize === 'number') data.fontSize = node.fontSize;
      if (node.color) data.color = node.color;
      if (typeof node.bold === 'boolean') data.bold = node.bold;
      if (node.align) data.align = node.align;
      if (node.valign) data.valign = node.valign;
      if (typeof node.leading === 'number' && node.leading !== 0) data.leading = node.leading;
    }

    // 序列化 Laya.Graphics 向量繪圖指令 (_gcmds)
    const rawCmds = node?.graphics?.cmds || node?.graphics?._cmds || node?._gcmds;
    if (Array.isArray(rawCmds) && rawCmds.length > 0) {
      const serializedCmds: LayaGraphicsCmdData[] = [];
      for (const cmd of rawCmds) {
        const sCmd = this.serializeGraphicsCmd(cmd);
        if (sCmd) serializedCmds.push(sCmd);
      }
      if (serializedCmds.length > 0) {
        data._gcmds = serializedCmds;
      }
    }

    // 序列化掛載的組件 (_$comp)
    const rawComps = node?.components || node?._components || node?._$comp;
    if (Array.isArray(rawComps) && rawComps.length > 0) {
      const comps: LayaComponentData[] = [];
      for (const comp of rawComps) {
        if (!comp) continue;
        const compType = comp._$type || comp.constructor?.name || 'Script';
        const compObj: LayaComponentData = {
          _$type: compType
        };
        for (const [k, v] of Object.entries(comp)) {
          if (
            k.startsWith('_') ||
            k === 'owner' ||
            k === 'enabled' ||
            typeof v === 'function'
          ) {
            continue;
          }
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            compObj[k] = v;
          }
        }
        comps.push(compObj);
      }
      if (comps.length > 0) {
        data._$comp = comps;
      }
    }

    // 遞迴序列化子節點 (_$child)
    const children: any[] = [];
    if (Array.isArray(node?._children)) {
      children.push(...node._children);
    } else if (typeof node?.numChildren === 'number' && typeof node?.getChildAt === 'function') {
      for (let i = 0; i < node.numChildren; i++) {
        children.push(node.getChildAt(i));
      }
    } else if (Array.isArray(node?._$child)) {
      children.push(...node._$child);
    }

    if (children.length > 0) {
      data._$child = children.map((child) =>
        this.serializeNodeToHierarchy(child, { isRoot: false })
      );
    }

    if (isRoot && options.assetId) {
      data._zhudaMeta = {
        assetId: options.assetId,
        category: options.category ?? 'ui-prefab',
        version: '3.4.2-zhuda-static-v1',
        designCanvas: options.designCanvas ?? {
          width: (data.width ?? 160) + 20,
          height: (data.height ?? 48) + 20,
          padding: 10
        },
        ...(options.targetSpec ? { targetSpec: options.targetSpec } : {})
      };
    }

    return data;
  }

  private static detectLayaNodeType(node: any): string {
    if (!node) return 'Sprite';
    if (typeof node._$type === 'string') return node._$type;
    const g = globalThis as unknown as { Laya?: Record<string, any> };
    const L = g.Laya;
    if (L) {
      if (L.Text && node instanceof L.Text) return 'Text';
      if (L.Label && node instanceof L.Label) return 'Label';
      if (L.Button && node instanceof L.Button) return 'Button';
      if (L.Box && node instanceof L.Box) return 'Box';
      if (L.Image && node instanceof L.Image) return 'Image';
      if (L.Scene && node instanceof L.Scene) return 'Scene';
      if (L.Scene3D && node instanceof L.Scene3D) return 'Scene3D';
      if (L.MeshSprite3D && node instanceof L.MeshSprite3D) return 'MeshSprite3D';
      if (L.Sprite3D && node instanceof L.Sprite3D) return 'Sprite3D';
    }
    if (typeof node.text === 'string' && typeof node.fontSize === 'number') return 'Text';
    return node.constructor?.name && node.constructor.name !== 'Object'
      ? node.constructor.name
      : 'Sprite';
  }

  private static serializeGraphicsCmd(cmd: any): LayaGraphicsCmdData | null {
    if (!cmd) return null;
    const cmdType = cmd._$type || cmd.cmdID;
    if (!cmdType) return null;

    // 關鍵防坑：Laya 3.4.2 的 DrawRoundRectCmd / DrawRectCmd 建構子預設 this.percent = true，
    // 序列化時必須明確寫入 percent: false，否則反序列化後長寬會被乘上父節點尺寸！
    const percent = typeof cmd.percent === 'boolean' ? cmd.percent : false;

    switch (cmdType) {
      case 'DrawRoundRectCmd':
        return {
          _$type: 'DrawRoundRectCmd',
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          width: cmd.width ?? 100,
          height: cmd.height ?? 40,
          lt: cmd.lt ?? 6,
          rt: cmd.rt ?? 6,
          lb: cmd.lb ?? 6,
          rb: cmd.rb ?? 6,
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0,
          percent
        };
      case 'DrawRectCmd':
        return {
          _$type: 'DrawRectCmd',
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          width: cmd.width ?? 100,
          height: cmd.height ?? 40,
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0,
          percent
        };
      case 'DrawCircleCmd':
        return {
          _$type: 'DrawCircleCmd',
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          radius: cmd.radius ?? 10,
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0,
          percent
        };
      case 'DrawEllipseCmd':
        return {
          _$type: 'DrawEllipseCmd',
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          width: cmd.width ?? 20,
          height: cmd.height ?? 10,
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0,
          percent
        };
      case 'DrawLineCmd':
        return {
          _$type: 'DrawLineCmd',
          fromX: cmd.fromX ?? 0,
          fromY: cmd.fromY ?? 0,
          toX: cmd.toX ?? 10,
          toY: cmd.toY ?? 10,
          lineColor: cmd.lineColor ?? '#ffffff',
          lineWidth: cmd.lineWidth ?? 1,
          percent
        };
      case 'DrawPolyCmd':
        return {
          _$type: 'DrawPolyCmd',
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          points: Array.isArray(cmd.points) ? [...cmd.points] : [],
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0
        };
      case 'DrawPieCmd':
        return {
          _$type: 'DrawPieCmd',
          x: cmd.x ?? 0,
          y: cmd.y ?? 0,
          radius: cmd.radius ?? 10,
          startAngle: cmd.startAngle ?? 0,
          endAngle: cmd.endAngle ?? 90,
          fillColor: cmd.fillColor ?? null,
          lineColor: cmd.lineColor ?? null,
          lineWidth: cmd.lineWidth ?? 0
        };
      default:
        return null;
    }
  }

  /**
   * 建構「戰術確認按鈕」靜態 Prefab (.lh)
   * 支援產出 'uncalibrated-drift' (含 +3px 寬度偏差與色差 ΔE=6.1) 與 'calibrated' (0px 誤差 / ΔE=0.00)
   */
  public static buildConfirmButtonPrefab(
    variant: 'calibrated' | 'uncalibrated-drift' = 'calibrated'
  ): LayaHierarchyNodeData {
    const isDrift = variant === 'uncalibrated-drift';
    const x = isDrift ? 12 : 10;
    const y = 10;
    const width = isDrift ? 163 : 160;
    const height = 48;
    const fillColor = isDrift ? '#2c4c7e' : '#1e3a5f';
    const borderColor = isDrift ? '#5278a8' : '#3b82f6';
    const textColor = isDrift ? '#b8d0eb' : '#e2f1ff';

    const targetSpec: PixelCalibrationSpec = {
      assetName: 'ConfirmActionButton.lh',
      expectedBox: { x: 10, y: 10, width: 160, height: 48 },
      expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
      targetColors: {
        primaryFill: '#1e3a5f',
        borderStroke: '#3b82f6',
        accentOrText: '#e2f1ff'
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };

    return {
      _$ver: 1,
      _$id: 'confirm_btn_root',
      _$type: 'Sprite',
      name: 'ConfirmActionButton',
      x,
      y,
      width,
      height,
      mouseEnabled: true,
      _gcmds: [
        {
          _$type: 'DrawRoundRectCmd',
          x: 0,
          y: 0,
          width,
          height,
          lt: 10,
          rt: 10,
          lb: 10,
          rb: 10,
          fillColor,
          lineColor: borderColor,
          lineWidth: 2,
          percent: false
        },
        {
          _$type: 'DrawCircleCmd',
          x: 24,
          y: 24,
          radius: 5,
          fillColor: '#64ffda',
          lineColor: null,
          lineWidth: 0,
          percent: false
        }
      ],
      _$child: [
        {
          _$id: 'confirm_btn_label',
          _$type: 'Text',
          name: 'ActionLabel',
          x: 12,
          y: 0,
          width: width - 12,
          height,
          text: '⚡ DEPLOY PREFAB',
          fontSize: 14,
          bold: true,
          color: textColor,
          align: 'center',
          valign: 'middle'
        }
      ],
      _zhudaMeta: {
        assetId: 'assets/prefabs/ConfirmActionButton.lh',
        category: 'ui-prefab',
        version: '3.4.2-zhuda-static-v1',
        designCanvas: { width: 180, height: 68, padding: 10 },
        targetSpec
      }
    };
  }

  /**
   * 建構「戰術 LED 頂部狀態列」靜態 UI Prefab (.lh)
   */
  public static buildTacticalHudBarPrefab(): LayaHierarchyNodeData {
    const targetSpec: PixelCalibrationSpec = {
      assetName: 'TacticalHudBar.lh',
      expectedBox: { x: 10, y: 10, width: 310, height: 64 },
      expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
      targetColors: {
        primaryFill: '#141d2c',
        borderStroke: '#304565',
        accentOrText: '#ff3366'
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };

    return {
      _$ver: 1,
      _$id: 'hud_bar_root',
      _$type: 'Sprite',
      name: 'TacticalHudBar',
      x: 10,
      y: 10,
      width: 310,
      height: 64,
      _gcmds: [
        {
          _$type: 'DrawRoundRectCmd',
          x: 0,
          y: 0,
          width: 310,
          height: 64,
          lt: 12,
          rt: 12,
          lb: 12,
          rb: 12,
          fillColor: '#141d2c',
          lineColor: '#304565',
          lineWidth: 2,
          percent: false
        },
        {
          _$type: 'DrawRoundRectCmd',
          x: 14,
          y: 10,
          width: 96,
          height: 44,
          lt: 6,
          rt: 6,
          lb: 6,
          rb: 6,
          fillColor: '#0b0f17',
          lineColor: '#ff3366',
          lineWidth: 1.5,
          percent: false
        },
        {
          _$type: 'DrawRoundRectCmd',
          x: 200,
          y: 10,
          width: 96,
          height: 44,
          lt: 6,
          rt: 6,
          lb: 6,
          rb: 6,
          fillColor: '#0b0f17',
          lineColor: '#00ff88',
          lineWidth: 1.5,
          percent: false
        }
      ],
      _$child: [
        {
          _$id: 'hud_mine_led',
          _$type: 'Text',
          name: 'MineCounterLED',
          x: 14,
          y: 17,
          width: 96,
          height: 32,
          text: '010',
          font: 'Courier New, monospace',
          fontSize: 25,
          bold: true,
          color: '#ff3366',
          align: 'center'
        },
        {
          _$id: 'hud_face_badge',
          _$type: 'Text',
          name: 'CenterFaceIcon',
          x: 126,
          y: 16,
          width: 58,
          height: 36,
          text: '🙂',
          fontSize: 24,
          color: '#e2f1ff',
          align: 'center'
        },
        {
          _$id: 'hud_timer_led',
          _$type: 'Text',
          name: 'TimerCounterLED',
          x: 200,
          y: 17,
          width: 96,
          height: 32,
          text: '042',
          font: 'Courier New, monospace',
          fontSize: 25,
          bold: true,
          color: '#00ff88',
          align: 'center'
        }
      ],
      _zhudaMeta: {
        assetId: 'assets/prefabs/TacticalHudBar.lh',
        category: 'ui-prefab',
        version: '3.4.2-zhuda-static-v1',
        designCanvas: { width: 330, height: 84, padding: 10 },
        targetSpec
      }
    };
  }

  /**
   * 建構「Spine 4.2 PhysicsConstraint 豬大守護精靈」靜態骨骼資產 (.lh)
   * 先在靜態層校準各部位骨骼座標與配色，再於組裝階段由 Spine42PhysicsRigComponent 驅動二階彈簧擺
   */
  public static buildSpine42MascotPrefab(
    overrides: Partial<Spine42StaticRigConfig> = {}
  ): LayaHierarchyNodeData {
    const cfg: Spine42StaticRigConfig = {
      rigName: 'ZhudaGuardianPig_v4.2',
      defaultPose: 'idle',
      stiffness: 95.0,
      damping: 0.88,
      windAmplitude: 1.8,
      earAngleRad: 0.0,
      skinPrimaryColor: '#ff9ebb',
      skinBorderColor: '#ff6b98',
      bellyHighlightColor: '#ffd0df',
      snoutColor: '#ffa6c2',
      ...overrides
    };

    const targetSpec: PixelCalibrationSpec = {
      assetName: 'ZhudaSpine42Mascot.lh',
      expectedBox: { x: 10, y: 10, width: 210, height: 172 },
      expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
      targetColors: {
        primaryFill: '#141d2b',
        borderStroke: '#2c415e',
        accentOrText: '#ff9ebb'
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };

    const cx = 105;
    const cy = 66;

    return {
      _$ver: 1,
      _$id: 'spine42_mascot_root',
      _$type: 'Sprite',
      name: 'ZhudaSpine42Mascot',
      x: 10,
      y: 10,
      width: 210,
      height: 172,
      _gcmds: [
        {
          _$type: 'DrawRoundRectCmd',
          x: 0,
          y: 0,
          width: 210,
          height: 172,
          lt: 12,
          rt: 12,
          lb: 12,
          rb: 12,
          fillColor: '#141d2b',
          lineColor: '#2c415e',
          lineWidth: 2,
          percent: false
        },
        {
          _$type: 'DrawCircleCmd',
          x: cx,
          y: 114,
          radius: 34,
          fillColor: '#090d14',
          lineColor: null,
          lineWidth: 0,
          percent: false
        },
        {
          _$type: 'DrawCircleCmd',
          x: cx,
          y: cy,
          radius: 36,
          fillColor: cfg.skinPrimaryColor,
          lineColor: cfg.skinBorderColor,
          lineWidth: 2,
          percent: false
        },
        {
          _$type: 'DrawCircleCmd',
          x: cx,
          y: cy + 9,
          radius: 20,
          fillColor: cfg.bellyHighlightColor,
          lineColor: null,
          lineWidth: 0,
          percent: false
        },
        {
          _$type: 'DrawCircleCmd',
          x: cx - 23,
          y: cy - 32,
          radius: 11,
          fillColor: cfg.skinBorderColor,
          lineColor: null,
          lineWidth: 0,
          percent: false
        },
        {
          _$type: 'DrawCircleCmd',
          x: cx + 23,
          y: cy - 32,
          radius: 11,
          fillColor: cfg.skinBorderColor,
          lineColor: null,
          lineWidth: 0,
          percent: false
        },
        {
          _$type: 'DrawCircleCmd',
          x: cx,
          y: cy + 3,
          radius: 13,
          fillColor: cfg.snoutColor,
          lineColor: '#e05882',
          lineWidth: 1.5,
          percent: false
        },
        {
          _$type: 'DrawCircleCmd',
          x: cx - 14,
          y: cy - 10,
          radius: 4.2,
          fillColor: '#222222',
          lineColor: null,
          lineWidth: 0,
          percent: false
        },
        {
          _$type: 'DrawCircleCmd',
          x: cx + 14,
          y: cy - 10,
          radius: 4.2,
          fillColor: '#222222',
          lineColor: null,
          lineWidth: 0,
          percent: false
        }
      ],
      _$comp: [
        {
          _$type: 'Spine42PhysicsRigComponent',
          ...cfg
        }
      ],
      _$child: [
        {
          _$id: 'spine42_status_label',
          _$type: 'Text',
          name: 'StatusLabel',
          x: 0,
          y: 128,
          width: 210,
          height: 18,
          text: 'Spine 4.2 豬大精靈 · [靜態預製體]',
          fontSize: 13,
          bold: true,
          color: '#7df9ff',
          align: 'center'
        },
        {
          _$id: 'spine42_physics_badge',
          _$type: 'Text',
          name: 'PhysicsBadge',
          x: 0,
          y: 148,
          width: 210,
          height: 16,
          text: '✔ PhysicsConstraint (k=95, d=0.88)',
          fontSize: 11,
          color: '#64ffda',
          align: 'center'
        }
      ],
      _zhudaMeta: {
        assetId: 'assets/prefabs/ZhudaSpine42Mascot.lh',
        category: 'spine42-rig',
        version: '3.4.2-zhuda-static-v1',
        designCanvas: { width: 230, height: 192, padding: 10 },
        targetSpec
      }
    };
  }

  /**
   * 建構「戰術爆破粒子發射器」靜態資產 (.lh)
   * 以決定性種子 (seed=20261028) 烘焙 t=240ms 的快照供微預覽與像素/色差校準，並附帶運行期發射器組件
   */
  public static buildParticleExplosionPrefab(
    overrides: Partial<ParticleEmitterStaticConfig> = {}
  ): LayaHierarchyNodeData {
    const cfg: ParticleEmitterStaticConfig = {
      emitterName: 'TacticalMineBurst_v1',
      burstCount: 24,
      emissionRate: 36,
      lifetimeMs: 850,
      startSpeed: 165,
      gravityY: 220,
      seed: 20261028,
      previewTimestampMs: 240,
      primaryColor: '#ff5533',
      secondaryColor: '#ffaa00',
      sparkColor: '#64ffda',
      coreGlowColor: '#231424',
      ...overrides
    };

    const targetSpec: PixelCalibrationSpec = {
      assetName: 'MineExplosionParticle.lh',
      expectedBox: { x: 12, y: 12, width: 176, height: 176 },
      expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
      targetColors: {
        primaryFill: '#231424',
        borderStroke: '#ff5533',
        accentOrText: '#ffaa00'
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };

    const cmds: LayaGraphicsCmdData[] = [
      // 決定性邊界底盤與衝擊波外環 (176x176)
      {
        _$type: 'DrawRoundRectCmd',
        x: 0,
        y: 0,
        width: 176,
        height: 176,
        lt: 16,
        rt: 16,
        lb: 16,
        rb: 16,
        fillColor: cfg.coreGlowColor,
        lineColor: cfg.primaryColor,
        lineWidth: 2,
        percent: false
      },
      // 外層震波光圈
      {
        _$type: 'DrawCircleCmd',
        x: 88,
        y: 88,
        radius: 68,
        fillColor: null,
        lineColor: cfg.secondaryColor,
        lineWidth: 2,
        percent: false
      },
      // 內層高溫火球核心
      {
        _$type: 'DrawCircleCmd',
        x: 88,
        y: 88,
        radius: 26,
        fillColor: cfg.primaryColor,
        lineColor: cfg.secondaryColor,
        lineWidth: 3,
        percent: false
      }
    ];

    // 決定性粒子位置烘焙 (t = previewTimestampMs)
    let rngState = cfg.seed;
    const nextRand = () => {
      rngState = (rngState * 1664525 + 1013904223) >>> 0;
      return rngState / 0xffffffff;
    };

    const tSec = cfg.previewTimestampMs / 1000;
    for (let i = 0; i < cfg.burstCount; i++) {
      const angle = (i / cfg.burstCount) * Math.PI * 2 + (nextRand() - 0.5) * 0.18;
      const speed = cfg.startSpeed * (0.65 + nextRand() * 0.45);
      const dist = Math.min(64, speed * tSec);
      const px = Number((88 + Math.cos(angle) * dist).toFixed(1));
      const py = Number((88 + Math.sin(angle) * dist).toFixed(1));
      const radius = Number((3.2 + (i % 3) * 1.6).toFixed(1));
      const color =
        i % 3 === 0 ? cfg.secondaryColor : i % 3 === 1 ? cfg.primaryColor : cfg.sparkColor;

      cmds.push({
        _$type: 'DrawCircleCmd',
        x: px,
        y: py,
        radius,
        fillColor: color,
        lineColor: null,
        lineWidth: 0,
        percent: false
      });
    }

    return {
      _$ver: 1,
      _$id: 'particle_explosion_root',
      _$type: 'Sprite',
      name: 'MineExplosionParticle',
      x: 12,
      y: 12,
      width: 176,
      height: 176,
      _gcmds: cmds,
      _$comp: [
        {
          _$type: 'ZhudaParticleEmitterComponent',
          ...cfg
        }
      ],
      _$child: [
        {
          _$id: 'particle_badge_txt',
          _$type: 'Text',
          name: 'ParticleSnapshotLabel',
          x: 0,
          y: 152,
          width: 176,
          height: 18,
          text: `Particle Snapshot @ ${cfg.previewTimestampMs}ms`,
          fontSize: 11,
          bold: true,
          color: cfg.secondaryColor,
          align: 'center'
        }
      ],
      _zhudaMeta: {
        assetId: 'assets/prefabs/MineExplosionParticle.lh',
        category: 'particle-emitter',
        version: '3.4.2-zhuda-static-v1',
        designCanvas: { width: 200, height: 200, padding: 12 },
        targetSpec
      }
    };
  }

  /**
   * 建構「6 大基建遙測儀表板」靜態 UI Prefab (.lh)
   */
  public static buildTelemetryDashboardPrefab(): LayaHierarchyNodeData {
    const targetSpec: PixelCalibrationSpec = {
      assetName: 'TelemetryDashboard.lh',
      expectedBox: { x: 10, y: 10, width: 225, height: 392 },
      expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
      targetColors: {
        primaryFill: '#121a28',
        borderStroke: '#2d4464',
        accentOrText: '#64ffda'
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };

    return {
      _$ver: 1,
      _$id: 'telemetry_dash_root',
      _$type: 'Sprite',
      name: 'TelemetryDashboard',
      x: 10,
      y: 10,
      width: 225,
      height: 392,
      _gcmds: [
        {
          _$type: 'DrawRoundRectCmd',
          x: 0,
          y: 0,
          width: 225,
          height: 392,
          lt: 12,
          rt: 12,
          lb: 12,
          rb: 12,
          fillColor: '#121a28',
          lineColor: '#2d4464',
          lineWidth: 2,
          percent: false
        }
      ],
      _$child: [
        {
          _$id: 'telemetry_header_txt',
          _$type: 'Text',
          name: 'HeaderTitle',
          x: 14,
          y: 12,
          width: 198,
          height: 20,
          text: '🛡️ 豬大引擎 · 6 大基建遙測',
          fontSize: 13,
          bold: true,
          color: '#64ffda'
        },
        {
          _$id: 'telemetry_body_txt',
          _$type: 'Text',
          name: 'TelemetryBody',
          x: 14,
          y: 36,
          width: 198,
          height: 340,
          text: '[1] 拓撲載入器 (29/29 庫)\n[2] AST 自動類別反射\n[3] 原型解毒與準備守衛\n[4] Spine 4.2 PhysicsConstraint\n[5] 合批 DrawCall 對標 Three.js\n[6] 靜態資產 (.lh) & ΔE 校準',
          fontSize: 12,
          leading: 5,
          color: '#cbd5e1'
        }
      ],
      _zhudaMeta: {
        assetId: 'assets/prefabs/TelemetryDashboard.lh',
        category: 'ui-prefab',
        version: '3.4.2-zhuda-static-v1',
        designCanvas: { width: 245, height: 412, padding: 10 },
        targetSpec
      }
    };
  }

  /**
   * 建構「M1 九宮格 (9-Slice / sizeGrid) 無失真戰術對話框」靜態 Prefab (.lh)
   * 基準尺寸 160×80，拉伸至 320×140 (2.0x 寬, 1.75x 高)，四角錨塊恆定鎖死為 16×16px 零變形
   */
  public static buildNineSliceDialogPrefab(
    stretchedWidth: number = 320,
    stretchedHeight: number = 140
  ): LayaHierarchyNodeData {
    const top = 16;
    const right = 16;
    const bottom = 16;
    const left = 16;
    const cw = Math.max(8, stretchedWidth - left - right);
    const ch = Math.max(8, stretchedHeight - top - bottom);

    const targetSpec: PixelCalibrationSpec = {
      assetName: 'NineSliceDialogFrame.lh',
      expectedBox: { x: 10, y: 10, width: stretchedWidth, height: stretchedHeight },
      expectedPadding: { left: 10, top: 10, right: 10, bottom: 10 },
      targetColors: {
        primaryFill: '#132036',
        borderStroke: '#38bdf8',
        accentOrText: '#2dd4bf'
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };

    return {
      _$ver: 1,
      _$id: 'nine_slice_dialog_root',
      _$type: 'Image',
      name: 'NineSliceDialogFrame',
      x: 10,
      y: 10,
      width: stretchedWidth,
      height: stretchedHeight,
      sizeGrid: `${top},${right},${bottom},${left},0`,
      _gcmds: [
        // 1. 外框底圖
        {
          _$type: 'DrawRoundRectCmd',
          x: 0,
          y: 0,
          width: stretchedWidth,
          height: stretchedHeight,
          lt: 10,
          rt: 10,
          lb: 10,
          rb: 10,
          fillColor: '#132036',
          lineColor: '#38bdf8',
          lineWidth: 2,
          percent: false
        },
        // 2. 中央雙向拉伸區 (Center Slice #5)
        {
          _$type: 'DrawRectCmd',
          x: left,
          y: top,
          width: cw,
          height: ch,
          fillColor: '#0c1524',
          lineColor: '#233858',
          lineWidth: 1,
          percent: false
        },
        // 3. 四角 1:1 鎖定保護錨塊 (Slices #1, #3, #7, #9 — 尺寸恆定 16×16px)
        {
          _$type: 'DrawRoundRectCmd',
          x: 0,
          y: 0,
          width: left,
          height: top,
          lt: 8,
          rt: 2,
          lb: 2,
          rb: 2,
          fillColor: '#2dd4bf',
          lineColor: '#38bdf8',
          lineWidth: 1.5,
          percent: false
        },
        {
          _$type: 'DrawRoundRectCmd',
          x: stretchedWidth - right,
          y: 0,
          width: right,
          height: top,
          lt: 2,
          rt: 8,
          lb: 2,
          rb: 2,
          fillColor: '#2dd4bf',
          lineColor: '#38bdf8',
          lineWidth: 1.5,
          percent: false
        },
        {
          _$type: 'DrawRoundRectCmd',
          x: 0,
          y: stretchedHeight - bottom,
          width: left,
          height: bottom,
          lt: 2,
          rt: 2,
          lb: 8,
          rb: 2,
          fillColor: '#2dd4bf',
          lineColor: '#38bdf8',
          lineWidth: 1.5,
          percent: false
        },
        {
          _$type: 'DrawRoundRectCmd',
          x: stretchedWidth - right,
          y: stretchedHeight - bottom,
          width: right,
          height: bottom,
          lt: 2,
          rt: 2,
          lb: 2,
          rb: 8,
          fillColor: '#2dd4bf',
          lineColor: '#38bdf8',
          lineWidth: 1.5,
          percent: false
        }
      ],
      _$child: [
        {
          _$id: 'nine_slice_title_txt',
          _$type: 'Text',
          name: 'NineSliceHeader',
          x: left,
          y: 36,
          width: cw,
          height: 24,
          text: '9-SLICE (sizeGrid: 16,16,16,16,0)',
          fontSize: 14,
          bold: true,
          color: '#2dd4bf',
          align: 'center'
        },
        {
          _$id: 'nine_slice_sub_txt',
          _$type: 'Text',
          name: 'NineSliceSubtitle',
          x: left,
          y: 70,
          width: cw,
          height: 22,
          text: `Stretched ${stretchedWidth}×${stretchedHeight}px · 4 Corners Locked 16×16px`,
          fontSize: 12,
          color: '#e2f1ff',
          align: 'center'
        }
      ],
      _zhudaMeta: {
        assetId: 'assets/prefabs/NineSliceDialogFrame.lh',
        category: 'nine-slice-ui',
        version: '3.4.2-zhuda-static-v1',
        designCanvas: { width: stretchedWidth + 20, height: stretchedHeight + 20, padding: 10 },
        targetSpec,
        nineSliceSpec: {
          sizeGrid: [top, right, bottom, left, 0],
          baseWidth: 160,
          baseHeight: 80
        }
      }
    };
  }

  /**
   * 建構「M4 特效藍圖庫：勝利金幣噴泉 (CoinFountainVfx.lh)」決定性靜態資產 (@ t=280ms)
   */
  public static buildCoinFountainVfxPrefab(): LayaHierarchyNodeData {
    const targetSpec: PixelCalibrationSpec = {
      assetName: 'CoinFountainVfx.lh',
      expectedBox: { x: 12, y: 12, width: 176, height: 176 },
      expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
      targetColors: {
        primaryFill: '#1f1a10',
        borderStroke: '#fbbf24',
        accentOrText: '#fef08a'
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };

    const cmds: LayaGraphicsCmdData[] = [
      {
        _$type: 'DrawRoundRectCmd',
        x: 0,
        y: 0,
        width: 176,
        height: 176,
        lt: 16,
        rt: 16,
        lb: 16,
        rb: 16,
        fillColor: '#1f1a10',
        lineColor: '#fbbf24',
        lineWidth: 2,
        percent: false
      },
      // 聚寶盆底座金光
      {
        _$type: 'DrawEllipseCmd',
        x: 88,
        y: 138,
        width: 54,
        height: 14,
        fillColor: '#f59e0b',
        lineColor: '#fef08a',
        lineWidth: 2,
        percent: false
      }
    ];

    // 決定性拋物線金幣粒子軌跡
    const coinPositions: Array<[number, number, number]> = [
      [88, 42, 11],
      [62, 54, 9.5],
      [114, 54, 9.5],
      [44, 78, 8.5],
      [132, 78, 8.5],
      [74, 82, 10],
      [102, 82, 10],
      [54, 110, 7.5],
      [122, 110, 7.5],
      [88, 112, 9]
    ];

    for (const [cx, cy, r] of coinPositions) {
      cmds.push({
        _$type: 'DrawCircleCmd',
        x: cx,
        y: cy,
        radius: r,
        fillColor: '#fbbf24',
        lineColor: '#fef08a',
        lineWidth: 1.5,
        percent: false
      });
    }

    return {
      _$ver: 1,
      _$id: 'vfx_coin_fountain_root',
      _$type: 'Sprite',
      name: 'CoinFountainVfx',
      x: 12,
      y: 12,
      width: 176,
      height: 176,
      _gcmds: cmds,
      _$comp: [
        {
          _$type: 'ZhudaParticleEmitterComponent',
          emitterName: 'GoldenCoinFountain_v1',
          burstCount: 20,
          previewTimestampMs: 280,
          primaryColor: '#fbbf24',
          secondaryColor: '#fef08a',
          sparkColor: '#38bdf8'
        }
      ],
      _$child: [
        {
          _$id: 'vfx_coin_label',
          _$type: 'Text',
          name: 'VfxCoinTitle',
          x: 0,
          y: 152,
          width: 176,
          height: 18,
          text: 'VFX: CoinFountain @ 280ms',
          fontSize: 11,
          bold: true,
          color: '#fef08a',
          align: 'center'
        }
      ],
      _zhudaMeta: {
        assetId: 'assets/prefabs/CoinFountainVfx.lh',
        category: 'vfx-blueprint',
        version: '3.4.2-zhuda-static-v1',
        designCanvas: { width: 200, height: 200, padding: 12 },
        targetSpec
      }
    };
  }

  /**
   * 建構「M4 特效藍圖庫：戰術刀光劍氣拖尾 (SwordSlashTrailVfx.lh)」決定性靜態資產 (@ t=120ms)
   */
  public static buildSwordSlashVfxPrefab(): LayaHierarchyNodeData {
    const targetSpec: PixelCalibrationSpec = {
      assetName: 'SwordSlashTrailVfx.lh',
      expectedBox: { x: 12, y: 12, width: 176, height: 176 },
      expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
      targetColors: {
        primaryFill: '#0d1b2a',
        borderStroke: '#00e5ff',
        accentOrText: '#7df9ff'
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };

    return {
      _$ver: 1,
      _$id: 'vfx_sword_slash_root',
      _$type: 'Sprite',
      name: 'SwordSlashTrailVfx',
      x: 12,
      y: 12,
      width: 176,
      height: 176,
      _gcmds: [
        {
          _$type: 'DrawRoundRectCmd',
          x: 0,
          y: 0,
          width: 176,
          height: 176,
          lt: 16,
          rt: 16,
          lb: 16,
          rb: 16,
          fillColor: '#0d1b2a',
          lineColor: '#00e5ff',
          lineWidth: 2,
          percent: false
        },
        // 弧形半月刀氣主軌跡
        {
          _$type: 'DrawPieCmd',
          x: 88,
          y: 88,
          radius: 66,
          startAngle: -55,
          endAngle: 75,
          fillColor: '#00e5ff',
          lineColor: '#ffffff',
          lineWidth: 2
        },
        // 內層遮罩形成新月刃弧
        {
          _$type: 'DrawCircleCmd',
          x: 74,
          y: 88,
          radius: 48,
          fillColor: '#0d1b2a',
          lineColor: '#38bdf8',
          lineWidth: 1.5,
          percent: false
        },
        // 破空十字星芒
        {
          _$type: 'DrawLineCmd',
          fromX: 28,
          fromY: 132,
          toX: 148,
          toY: 36,
          lineColor: '#ffffff',
          lineWidth: 3,
          percent: false
        }
      ],
      _$comp: [
        {
          _$type: 'ZhudaParticleEmitterComponent',
          emitterName: 'CyberBladeSlash_v1',
          burstCount: 16,
          previewTimestampMs: 120,
          primaryColor: '#00e5ff',
          secondaryColor: '#7df9ff',
          sparkColor: '#ffffff'
        }
      ],
      _$child: [
        {
          _$id: 'vfx_slash_label',
          _$type: 'Text',
          name: 'VfxSlashTitle',
          x: 0,
          y: 152,
          width: 176,
          height: 18,
          text: 'VFX: SwordSlashTrail @ 120ms',
          fontSize: 11,
          bold: true,
          color: '#7df9ff',
          align: 'center'
        }
      ],
      _zhudaMeta: {
        assetId: 'assets/prefabs/SwordSlashTrailVfx.lh',
        category: 'vfx-blueprint',
        version: '3.4.2-zhuda-static-v1',
        designCanvas: { width: 200, height: 200, padding: 12 },
        targetSpec
      }
    };
  }

  /**
   * 建構「M4 特效藍圖庫：升級覺醒法陣光環 (LevelUpAuraVfx.lh)」決定性靜態資產 (@ t=320ms)
   */
  public static buildLevelUpAuraVfxPrefab(): LayaHierarchyNodeData {
    const targetSpec: PixelCalibrationSpec = {
      assetName: 'LevelUpAuraVfx.lh',
      expectedBox: { x: 12, y: 12, width: 176, height: 176 },
      expectedPadding: { left: 12, top: 12, right: 12, bottom: 12 },
      targetColors: {
        primaryFill: '#13162b',
        borderStroke: '#a855f7',
        accentOrText: '#e9d5ff'
      },
      tolerancePx: 0,
      toleranceDeltaE: 1.5
    };

    return {
      _$ver: 1,
      _$id: 'vfx_levelup_aura_root',
      _$type: 'Sprite',
      name: 'LevelUpAuraVfx',
      x: 12,
      y: 12,
      width: 176,
      height: 176,
      _gcmds: [
        {
          _$type: 'DrawRoundRectCmd',
          x: 0,
          y: 0,
          width: 176,
          height: 176,
          lt: 16,
          rt: 16,
          lb: 16,
          rb: 16,
          fillColor: '#13162b',
          lineColor: '#a855f7',
          lineWidth: 2,
          percent: false
        },
        // 外層覺醒法陣環
        {
          _$type: 'DrawCircleCmd',
          x: 88,
          y: 88,
          radius: 62,
          fillColor: null,
          lineColor: '#c084fc',
          lineWidth: 2.5,
          percent: false
        },
        // 內層能量核心
        {
          _$type: 'DrawCircleCmd',
          x: 88,
          y: 88,
          radius: 34,
          fillColor: '#581c87',
          lineColor: '#e9d5ff',
          lineWidth: 2,
          percent: false
        },
        // 上升光柱粒子
        {
          _$type: 'DrawLineCmd',
          fromX: 52,
          fromY: 132,
          toX: 52,
          toY: 36,
          lineColor: '#64ffda',
          lineWidth: 2.5,
          percent: false
        },
        {
          _$type: 'DrawLineCmd',
          fromX: 88,
          fromY: 140,
          toX: 88,
          toY: 24,
          lineColor: '#e9d5ff',
          lineWidth: 3,
          percent: false
        },
        {
          _$type: 'DrawLineCmd',
          fromX: 124,
          fromY: 132,
          toX: 124,
          toY: 36,
          lineColor: '#64ffda',
          lineWidth: 2.5,
          percent: false
        }
      ],
      _$comp: [
        {
          _$type: 'ZhudaParticleEmitterComponent',
          emitterName: 'AscensionHaloAura_v1',
          burstCount: 18,
          previewTimestampMs: 320,
          primaryColor: '#a855f7',
          secondaryColor: '#e9d5ff',
          sparkColor: '#64ffda'
        }
      ],
      _$child: [
        {
          _$id: 'vfx_aura_label',
          _$type: 'Text',
          name: 'VfxAuraTitle',
          x: 0,
          y: 152,
          width: 176,
          height: 18,
          text: 'VFX: LevelUpAura @ 320ms',
          fontSize: 11,
          bold: true,
          color: '#e9d5ff',
          align: 'center'
        }
      ],
      _zhudaMeta: {
        assetId: 'assets/prefabs/LevelUpAuraVfx.lh',
        category: 'vfx-blueprint',
        version: '3.4.2-zhuda-static-v1',
        designCanvas: { width: 200, height: 200, padding: 12 },
        targetSpec
      }
    };
  }

  /**
   * 建構組裝後的主場景靜態階層樹 (MinesweeperStage.ls)
   */
  public static buildMinesweeperSceneAsset(): LayaHierarchyNodeData {
    const hud = this.buildTacticalHudBarPrefab();
    const mascot = this.buildSpine42MascotPrefab();
    const telemetry = this.buildTelemetryDashboardPrefab();
    const confirmBtn = this.buildConfirmButtonPrefab('calibrated');
    const nineSliceDialog = this.buildNineSliceDialogPrefab(320, 140);
    const particle = this.buildParticleExplosionPrefab();
    const unityGuardian = UnityBridgePipeline.buildUnityCrystalGuardianPrefab();

    hud.x = 20;
    hud.y = 16;
    mascot.x = 1035;
    mascot.y = 118;
    telemetry.x = 1035;
    telemetry.y = 302;
    confirmBtn.x = 20;
    confirmBtn.y = 630;
    nineSliceDialog.x = 200;
    nineSliceDialog.y = 540;
    particle.x = 550;
    particle.y = 270;
    unityGuardian.x = 760;
    unityGuardian.y = 510;

    return {
      _$ver: 1,
      _$id: 'minesweeper_stage_scene',
      _$type: 'Scene',
      name: 'MinesweeperStage',
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      _$child: [hud, mascot, telemetry, confirmBtn, nineSliceDialog, particle, unityGuardian],
      _zhudaMeta: {
        assetId: 'assets/scenes/MinesweeperStage.ls',
        category: 'scene-lh',
        version: '3.4.2-zhuda-static-v1',
        designCanvas: { width: 1280, height: 720, padding: 0 }
      }
    };
  }

  /**
   * 取得所有內建預先設計之靜態資產清單 (涵蓋 UI、9-Slice、Spine 4.2、VFX 特效藍圖與 Unity 移植預製體)
   */
  public static getAllBuiltinStaticAssets(): Record<string, LayaHierarchyNodeData> {
    return {
      'ConfirmActionButton.lh': this.buildConfirmButtonPrefab('calibrated'),
      'NineSliceDialogFrame.lh': this.buildNineSliceDialogPrefab(320, 140),
      'TacticalHudBar.lh': this.buildTacticalHudBarPrefab(),
      'ZhudaSpine42Mascot.lh': this.buildSpine42MascotPrefab(),
      'MineExplosionParticle.lh': this.buildParticleExplosionPrefab(),
      'CoinFountainVfx.lh': this.buildCoinFountainVfxPrefab(),
      'SwordSlashTrailVfx.lh': this.buildSwordSlashVfxPrefab(),
      'LevelUpAuraVfx.lh': this.buildLevelUpAuraVfxPrefab(),
      'UnityCrystalGuardian.lh': UnityBridgePipeline.buildUnityCrystalGuardianPrefab(),
      'TelemetryDashboard.lh': this.buildTelemetryDashboardPrefab(),
      'MinesweeperStage.ls': this.buildMinesweeperSceneAsset()
    };
  }

  /**
   * 依據 PixelCalibrationEngine 產出的 AutoFixPatch 自動修正靜態 .lh 資產數值
   */
  public static applyCalibrationPatches(
    sourceData: LayaHierarchyNodeData,
    patches: AutoFixPatch[]
  ): LayaHierarchyNodeData {
    const cloned: LayaHierarchyNodeData = JSON.parse(JSON.stringify(sourceData));

    for (const patch of patches) {
      if (patch.targetPath === 'root') {
        (cloned as any)[patch.property] = patch.suggestedValue;
        // 同步更新子文字寬度以保持置中
        if (patch.property === 'width' && Array.isArray(cloned._$child)) {
          for (const ch of cloned._$child) {
            if (ch._$type === 'Text' && typeof ch.x === 'number') {
              ch.width = Number(patch.suggestedValue) - ch.x;
            }
          }
        }
      } else if (patch.targetPath.startsWith('_gcmds[')) {
        const m = patch.targetPath.match(/^_gcmds\[(\d+)\]$/);
        if (m && Array.isArray(cloned._gcmds)) {
          const idx = Number(m[1]);
          if (cloned._gcmds[idx]) {
            (cloned._gcmds[idx] as any)[patch.property] = patch.suggestedValue;
          }
        }
      } else if (patch.targetPath.startsWith('_$child[')) {
        const m = patch.targetPath.match(/^_\$child\[(\d+)\]$/);
        if (m && Array.isArray(cloned._$child)) {
          const idx = Number(m[1]);
          if (cloned._$child[idx]) {
            (cloned._$child[idx] as any)[patch.property] = patch.suggestedValue;
          }
        }
      }
    }

    return cloned;
  }
}

/**
 * ZhudaPrefab：後組裝階段 (Assembly Phase) 實例化器
 * 結合 Laya.HierarchyParser.parse 與安全指令水合 (Hydration)，確保任何 .lh 資產在 1ms 內精準掛載
 */
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
      node = new L.Text();
      node.text = data.text ?? '';
      if (data.font) node.font = data.font;
      if (typeof data.fontSize === 'number') node.fontSize = data.fontSize;
      if (data.color) node.color = data.color;
      if (typeof data.bold === 'boolean') node.bold = data.bold;
      if (data.align) node.align = data.align;
      if (data.valign) node.valign = data.valign;
      if (typeof data.leading === 'number') node.leading = data.leading;
    } else if (data._$type === 'Scene' && L.Scene) {
      node = new L.Scene();
    } else {
      node = new L.Sprite();
    }

    node.name = data.name || data._$id;
    if (typeof data.x === 'number') node.x = data.x;
    if (typeof data.y === 'number') node.y = data.y;
    if (typeof data.width === 'number') node.width = data.width;
    if (typeof data.height === 'number') node.height = data.height;
    if (typeof data.scaleX === 'number') node.scaleX = data.scaleX;
    if (typeof data.scaleY === 'number') node.scaleY = data.scaleY;
    if (typeof data.rotation === 'number') node.rotation = data.rotation;
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
      for (let i = 0; i < Math.min(data._$child.length, node.numChildren); i++) {
        this.ensureGraphicsHydrated(node.getChildAt(i), data._$child[i]);
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
        default:
          break;
      }
    }
  }
}
