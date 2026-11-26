// Scores of two players over 40 boards per level: one takes the first move it sees (a careless
// player), one takes the move that scores most at once (a careful one).   node tools/balance.ts
import { Board, LEVELS, bestMove } from '../src/core/board.ts';
const q = (s: number[], k: number) => s[Math.floor(s.length * k)];
for (const level of LEVELS) {
  const out: string[] = [];
  for (const [name, pick] of [['first', (b: Board) => b.hint()!], ['best', (b: Board) => bestMove(b)!]] as const) {
    const scores: number[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const b = new Board({ ...level, target: 1e9 }, seed);
      while (b.state === 'play') b.move(...pick(b));
      scores.push(b.score);
    }
    scores.sort((a, b) => a - b);
    out.push(`${name}: p25 ${q(scores, 0.25)} p50 ${q(scores, 0.5)} p75 ${q(scores, 0.75)} wins ${scores.filter((s) => s >= level.target).length}/40`);
  }
  console.log(level.id, `moves ${level.moves} kinds ${level.kinds} target ${level.target} |`, out.join(' | '));
}
