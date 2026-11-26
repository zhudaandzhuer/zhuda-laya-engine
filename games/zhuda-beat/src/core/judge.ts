// The judging of a play: taps against the chart, in song time (seconds). Pure.
import type { ChartNote } from './song.ts';

export const PERFECT = 0.05, GOOD = 0.1, REACH = 0.14;
export type Grade = 'perfect' | 'good' | 'late' | 'miss';
export interface Judged { index: number; lane: number; grade: Grade; offset: number }

export class Play {
  readonly notes: readonly ChartNote[];
  /** Per note: undefined until judged. */
  readonly grades: (Grade | undefined)[];
  score = 0;
  combo = 0;
  bestCombo = 0;
  counts = { perfect: 0, good: 0, late: 0, miss: 0, empty: 0 };
  /** Sum of signed offsets of the hits, to tell the player whether they tap early or late. */
  private offsetSum = 0;
  private cursor = 0;

  constructor(notes: readonly ChartNote[]) {
    this.notes = notes;
    this.grades = new Array(notes.length);
  }
  /** A tap in a lane at a time: judges the earliest open note of that lane within reach, or nothing (a tap on air). */
  tap(lane: number, time: number): Judged | null {
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.time > time + REACH) break;
      if (this.grades[i] || n.lane !== lane || Math.abs(n.time - time) > REACH) continue;
      const offset = time - n.time, a = Math.abs(offset);
      return this.judge(i, a <= PERFECT ? 'perfect' : a <= GOOD ? 'good' : 'late', offset);
    }
    this.counts.empty++;
    return null;
  }
  /** Time passing: every open note now out of reach is a miss. */
  advance(time: number): Judged[] {
    const out: Judged[] = [];
    for (let i = this.cursor; i < this.notes.length && this.notes[i].time < time - REACH; i++) if (!this.grades[i]) out.push(this.judge(i, 'miss', REACH));
    while (this.cursor < this.notes.length && this.grades[this.cursor]) this.cursor++;
    return out;
  }
  private judge(index: number, grade: Grade, offset: number): Judged {
    this.grades[index] = grade;
    this.counts[grade]++;
    if (grade === 'miss') this.combo = 0;
    else {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.offsetSum += offset;
      this.score += (grade === 'perfect' ? 100 : grade === 'good' ? 60 : 20) + Math.min(50, this.combo);
    }
    return { index, lane: this.notes[index].lane, grade, offset };
  }
  get judged(): number {
    return this.counts.perfect + this.counts.good + this.counts.late + this.counts.miss;
  }
  get done(): boolean {
    return this.judged === this.notes.length;
  }
  /** 0..1: perfect counts whole, good 0.6, late 0.2. */
  get accuracy(): number {
    return this.judged ? (this.counts.perfect + this.counts.good * 0.6 + this.counts.late * 0.2) / this.judged : 0;
  }
  /** Mean signed offset of the hits in seconds (positive: tapping late). */
  get lean(): number {
    const hits = this.counts.perfect + this.counts.good + this.counts.late;
    return hits ? this.offsetSum / hits : 0;
  }
  get rank(): 'S' | 'A' | 'B' | 'C' | 'D' {
    const a = this.accuracy;
    return a >= 0.95 ? 'S' : a >= 0.85 ? 'A' : a >= 0.7 ? 'B' : a >= 0.5 ? 'C' : 'D';
  }
}
