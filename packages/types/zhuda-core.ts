/**
 * @zhuda-laya/types — Layer 1: Core Runtime & Reflection Contracts
 * 剝離 LayaAir IDE 私有型別 (editor.d.ts / editor-ui.d.ts)，提供純淨的 AI-Native 核心契約
 */

export interface ZhudaCoreDiagnostics {
  version: string;
  stageReady: boolean;
  registeredClassesCount: number;
  activeTimersCount: number;
}

export interface ZhudaClassMetadata {
  className: string;
  assetId?: string;
  category?: '2d' | '3d' | 'ui' | 'spine' | 'physics' | 'gameplay';
  description?: string;
}
