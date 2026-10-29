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

export class VisualFocusContract {
  public static clear<TId>(): VisualFocusRequest<TId> {
    return { mode: 'clear' };
  }

  public static focus<TId>(winningIds: Iterable<TId> = []): VisualFocusRequest<TId> {
    return { mode: 'focus', winningIds: [...winningIds] };
  }

  public static apply<TId>(
    targets: readonly VisualFocusTarget<TId>[],
    request: VisualFocusRequest<TId>
  ): VisualFocusReport<TId> {
    const winningIds = request.mode === 'focus'
      ? [...new Set(request.winningIds || [])]
      : [];
    const winningSet = new Set(winningIds);
    const dimmedIds: TId[] = [];

    for (const target of targets) {
      const dimmed = request.mode === 'focus' && !winningSet.has(target.id);
      target.setDimmed(dimmed);
      if (dimmed) dimmedIds.push(target.id);
    }

    return {
      mode: request.mode,
      active: request.mode === 'focus' && winningIds.length > 0,
      targetCount: targets.length,
      winningIds,
      dimmedIds
    };
  }

  public static assert<TId>(
    targets: readonly VisualFocusTarget<TId>[],
    request: VisualFocusRequest<TId>,
    expectedDimmedCount?: number
  ): VisualFocusReport<TId> {
    const report = this.apply(targets, request);
    if (expectedDimmedCount !== undefined && report.dimmedIds.length !== expectedDimmedCount) {
      throw new Error(
        `[VisualFocusContract] Expected ${expectedDimmedCount} dimmed targets, got ${report.dimmedIds.length}.`
      );
    }
    return report;
  }
}
