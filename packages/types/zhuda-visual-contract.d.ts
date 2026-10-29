export interface SpineVisualContractSpec {
  assetId: string;
  runtimeVersion?: string;
  requiredAnimations?: string[];
  requiredSkins?: string[];
  requiredSlots?: string[];
  requiredEvents?: string[];
  requiredPhysicsConstraints?: number;
  expectedBounds?: { width: number; height: number; tolerancePx?: number };
}

export interface SpineVisualContractReport {
  assetId: string;
  passed: boolean;
  snapshot: unknown;
  missingAnimations: string[];
  missingSkins: string[];
  missingSlots: string[];
  missingEvents: string[];
  issues: string[];
}

export declare class SpineVisualContract {
  static inspect(templet: unknown): unknown;
  static validate(templet: unknown, spec: SpineVisualContractSpec): SpineVisualContractReport;
  static assert(templet: unknown, spec: SpineVisualContractSpec): SpineVisualContractReport;
}

export type VisualFocusMode = 'clear' | 'focus';

export interface VisualFocusRequest<TId> {
  mode: VisualFocusMode;
  winningIds?: Iterable<TId>;
}

export interface VisualFocusTarget<TId> {
  id: TId;
  setDimmed: (dimmed: boolean) => void;
}

export interface VisualFocusReport<TId> {
  mode: VisualFocusMode;
  active: boolean;
  targetCount: number;
  winningIds: TId[];
  dimmedIds: TId[];
}

export declare class VisualFocusContract {
  static clear<TId>(): VisualFocusRequest<TId>;
  static focus<TId>(winningIds?: Iterable<TId>): VisualFocusRequest<TId>;
  static apply<TId>(targets: readonly VisualFocusTarget<TId>[], request: VisualFocusRequest<TId>): VisualFocusReport<TId>;
  static assert<TId>(targets: readonly VisualFocusTarget<TId>[], request: VisualFocusRequest<TId>, expectedDimmedCount?: number): VisualFocusReport<TId>;
}
