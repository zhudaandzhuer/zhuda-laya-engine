// Dungeon Spin's round results: ten fixed scenarios ("fixtures") scaled by the single bet,
// and the 18 two-way paylines of its 5×3 board. No engine: node runs and tests it.
//
//   const { p, b } = MathEngine.resolve('boss', 20);   // p: main game (board, bets, awards), b: bonus beats
//
// These are presentation fixtures, not the paytable: the real line and rate tables are in
// source/math/runtime-lines.tsv and runtime-rates.tsv (PAYLINES equals the first; the
// awards here are the round's win split evenly, not per-line pays). The Go authority
// (prefabs/server/dungeonmath) resolves the same ten fixtures.
// From games/dungeon-spin (src/domain/dungeon-slot/MathEngine.ts), unchanged.

export interface MathResult {
  p: {
    board: number[];
    singleBet: number;
    totalBet: number;
    mainWin: number;
    opportunities: number;
    awards: any[];
    attack: string;
  };
  b: {
    beats: any[];
    total: number;
  };
}

// 18 條有效連線座標幾何（9 組左右正反方向）
export const PAYLINES: number[][] = [
  [0, 3, 6, 9, 12], [12, 9, 6, 3, 0],
  [1, 4, 7, 10, 13], [13, 10, 7, 4, 1],
  [2, 5, 8, 11, 14], [14, 11, 8, 5, 2],
  [2, 4, 6, 10, 14], [14, 10, 6, 4, 2],
  [0, 4, 8, 10, 12], [12, 10, 8, 4, 0],
  [0, 3, 7, 9, 12], [12, 9, 7, 3, 0],
  [2, 5, 7, 11, 14], [14, 11, 7, 5, 2],
  [1, 3, 6, 9, 13], [13, 9, 6, 3, 1],
  [1, 5, 8, 11, 13], [13, 11, 8, 5, 1]
];

// 10 組基準情境靜態真值表
export const FIXTURE_TRUTHS: Record<string, {
  board: number[];
  title: string;
  baseMainWin: number; // 單注 10 時的主局獎金
  opportunities: number;
  baseBonusWin: number; // 單注 10 時的 Bonus 獎金
  awards: any[];
  attack: string;
  bonusBeats: (totalBet: number) => any[];
}> = {
  three: {
    board: [3, 1, 2, 4, 1, 7, 8, 3, 4, 2, 5, 4, 1, 4, 6],
    title: "三連・迅劍",
    baseMainWin: 100,
    opportunities: 0,
    baseBonusWin: 0,
    awards: [{ id: "line-17", kind: "line", lineIndex: 17, count: 3, symbol: 4, label: "線 18 · 3連" }],
    attack: "迅劍",
    bonusBeats: () => []
  },
  empty: {
    board: [3, 3, 7, 5, 7, 4, 1, 8, 7, 8, 1, 4, 2, 8, 4],
    title: "未遇敵・空盤",
    baseMainWin: 0,
    opportunities: 0,
    baseBonusWin: 0,
    awards: [],
    attack: "未遇敵",
    bonusBeats: () => []
  },
  multi: {
    board: [0, 8, 2, 8, 8, 5, 8, 4, 1, 8, 8, 6, 8, 3, 7],
    title: "多線並發・召喚",
    baseMainWin: 12030,
    opportunities: 0,
    baseBonusWin: 0,
    awards: [
      { id: "line-0", kind: "line", lineIndex: 0, count: 4, symbol: 8, label: "線 1 · 4連" },
      { id: "line-4", kind: "line", lineIndex: 4, count: 3, symbol: 8, label: "線 5 · 3連" },
      { id: "line-8", kind: "line", lineIndex: 8, count: 5, symbol: 8, label: "線 9 · 5連" },
      { id: "line-14", kind: "line", lineIndex: 14, count: 4, symbol: 8, label: "線 15 · 4連" }
    ],
    attack: "召喚・萬刃橫掃",
    bonusBeats: () => []
  },
  five: {
    board: [8, 1, 2, 8, 3, 4, 8, 5, 6, 8, 7, 1, 8, 2, 3],
    title: "五連・拔刀一閃",
    baseMainWin: 200,
    opportunities: 0,
    baseBonusWin: 0,
    awards: [{ id: "line-0", kind: "line", lineIndex: 0, count: 5, symbol: 8, label: "線 1 · 5連" }],
    attack: "拔刀一閃",
    bonusBeats: () => []
  },
  four: {
    board: [4, 1, 2, 4, 3, 5, 4, 6, 7, 4, 8, 1, 2, 3, 4],
    title: "四連・蒼刃劍氣",
    baseMainWin: 200,
    opportunities: 0,
    baseBonusWin: 0,
    awards: [{ id: "line-0", kind: "line", lineIndex: 0, count: 4, symbol: 4, label: "線 1 · 4連" }],
    attack: "蒼刃劍氣",
    bonusBeats: () => []
  },
  full: {
    board: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    title: "全盤神使・領域斬",
    baseMainWin: 4500,
    opportunities: 0,
    baseBonusWin: 0,
    awards: [{ id: "full", kind: "full", symbol: 1, count: 15, label: "同符號全盤" }],
    attack: "領域斬",
    bonusBeats: () => []
  },
  group: {
    board: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
    title: "分組討伐・破封聖劍",
    baseMainWin: 6000,
    opportunities: 0,
    baseBonusWin: 0,
    awards: [{ id: "group", kind: "group", symbol: null, count: 15, label: "古代守衛討伐" }],
    attack: "破封聖劍",
    bonusBeats: () => []
  },
  word: {
    board: [2, 1, 4, 3, 4, 1, 4, 2, 5, 1, 4, 6, 4, 3, 2],
    title: "鋸齒交錯・迅劍",
    baseMainWin: 370,
    opportunities: 0,
    baseBonusWin: 0,
    awards: [{ id: "line-18", kind: "line", lineIndex: 18, count: 3, symbol: 4, label: "線 19 · 3連" }],
    attack: "迅劍",
    bonusBeats: () => []
  },
  boss: {
    board: [0, 1, 2, 0, 3, 4, 0, 5, 6, 1, 2, 3, 4, 5, 6],
    title: "巨袋遭遇・斬袋追擊",
    baseMainWin: 850,
    opportunities: 1,
    baseBonusWin: 45360,
    awards: [{ id: "line-0", kind: "line", lineIndex: 0, count: 3, symbol: 0, label: "線 1 · 3連" }],
    attack: "藏寶怪現身",
    bonusBeats: (totalBet: number) => {
      const scale = totalBet / 90;
      return [
        { id: "bonus-0", target: 8, slots: [8, 8, 8, 8], amount: 45360 * scale, isFull: true, hitIndices: [0, 1, 2, 3], before: 1, remaining: 1, cumulative: 45360 * scale },
        { id: "bonus-1", target: 0, slots: [1, 2, 3, 4], amount: 0, isFull: false, hitIndices: [], before: 1, remaining: 0, cumulative: 45360 * scale }
      ];
    }
  },
  allzero: {
    board: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    title: "全星開門・極限追擊",
    baseMainWin: 450000,
    opportunities: 27,
    baseBonusWin: 57060,
    awards: [{ id: "full", kind: "full", symbol: 0, count: 15, label: "星紋開門" }],
    attack: "星紋開門",
    bonusBeats: (totalBet: number) => {
      const scale = totalBet / 90;
      return [
        { id: "bonus-0", target: 1, slots: [1, 1, 1, 1], amount: 45000 * scale, isFull: true, hitIndices: [0, 1, 2, 3], before: 27, remaining: 27, cumulative: 45000 * scale },
        { id: "bonus-1", target: 2, slots: [2, 2, 1, 3], amount: 12060 * scale, isFull: false, hitIndices: [0, 1], before: 27, remaining: 27, cumulative: 57060 * scale }
      ];
    }
  }
};

export class MathEngine {
  /**
   * 依據 fixtureKey 與 singleBet 解析出主局結算 p 與 Bonus 結算 b
   */
  public static resolve(fixtureKey: string, singleBet: number): MathResult {
    const fixture = FIXTURE_TRUTHS[fixtureKey] || FIXTURE_TRUTHS.multi;
    const scale = singleBet / 10;
    const totalBet = singleBet * 9;
    const mainWin = fixture.baseMainWin * scale;
    const bonusWin = fixture.baseBonusWin * scale;

    const scaledAwards = fixture.awards.map((a, idx) => ({
      ...a,
      id: a.id || `award-${idx}`,
      amount: a.amount !== undefined ? a.amount * scale : Math.round(mainWin / (fixture.awards.length || 1))
    }));

    const beats = fixture.bonusBeats(totalBet);

    return {
      p: {
        board: fixture.board.slice(),
        singleBet,
        totalBet,
        mainWin,
        opportunities: fixture.opportunities,
        awards: scaledAwards,
        attack: fixture.attack
      },
      b: {
        beats,
        total: bonusWin
      }
    };
  }
}
