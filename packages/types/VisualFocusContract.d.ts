// Generated from TypeScript source; run npm run types:generate.
/**
 * Runtime visual focus contract shared by Unity -> Laya presentations.
 *
 * A focus operation always has an explicit mode. `clear` restores every
 * target, while `focus` dims every target whose id is absent from the
 * winning set. An empty winning set is therefore meaningful: it dims the
 * whole target scope. This keeps board/reel/cell scope decisions out of
 * nullable ad-hoc arguments.
 */
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
