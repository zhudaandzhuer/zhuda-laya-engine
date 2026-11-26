// One round: the session accepts (and saves) it first, then it is shown, then it is marked
// presented. A presentation failure never undoes an accepted round: recover() shows the
// result instead. From games/dungeon-spin (RoundRunner.ts), unchanged.

export interface RunRoundOptions {
  session: any;
  replay?: boolean;
  replayRound?: any;
  fixture: string;
  singleBet: number;
  burst?: boolean;
  present: (snapshot: any) => Promise<void> | void;
  complete?: (snapshot: any, context?: any) => Promise<void> | void;
  onAccepted?: (snapshot: any, context?: any) => Promise<void> | void;
  recover?: (snapshot: any, error: Error, context?: any) => Promise<void> | void;
}

export async function runRound({
  session,
  replay = false,
  replayRound,
  fixture,
  singleBet,
  burst = false,
  present,
  complete = () => {},
  onAccepted = () => {},
  recover = () => {}
}: RunRoundOptions): Promise<{
  id: string;
  bet: number;
  win: number;
  replay: boolean;
  presentationError: Error | null;
}> {
  const generation = session.state?.generation;
  if (replay) session.refresh();
  const snapshot = replay
    ? session.replay(replayRound)
    : await session.accept(fixture, singleBet, { burst });

  let presentationError: Error | null = null;
  try {
    await onAccepted(snapshot, { replay });
    await present(snapshot);
    await complete(snapshot, { replay });
    await session.markPresented(snapshot.id, generation);
  } catch (err: any) {
    presentationError = err instanceof Error ? err : new Error(String(err));
    try {
      await recover(snapshot, presentationError, { replay });
    } catch (recErr) {
      console.error('[RoundRunner] 無法更新回合顯示:', recErr);
    }
  }
  return {
    id: snapshot.id,
    bet: snapshot.bet,
    win: snapshot.win,
    replay,
    presentationError
  };
}
