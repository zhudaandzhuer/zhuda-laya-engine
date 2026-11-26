// Package dungeonmath resolves Dungeon Spin's ten fixed rounds (three, empty, multi, five,
// four, full, group, word, boss, allzero) at a single bet of 10, 20 or 50: board, total bet
// (×9), main and bonus win, awards and bonus beats. The same table as the client's
// prefabs/2d/dungeon-spin/math.ts, with differences kept from the original (see
// README: award amounts truncate here and round there; "three" has no symbol here).
// From games/dungeon-spin/server/internal/math, unchanged but for the package name.
package dungeonmath

import "fmt"

type Award struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"`
	Symbol *int   `json:"symbol,omitempty"`
	Count  int    `json:"count"`
	Label  string `json:"label"`
	Amount int64  `json:"amount"`
}

type BonusBeat struct {
	ID         string `json:"id"`
	Target     int    `json:"target"`
	Slots      []int  `json:"slots"`
	Amount     int64  `json:"amount"`
	IsFull     bool   `json:"isFull"`
	HitIndices []int  `json:"hitIndices"`
	Before     int    `json:"before"`
	Remaining  int    `json:"remaining"`
	Cumulative int64  `json:"cumulative"`
}

type ResolvedRound struct {
	Board         []int       `json:"board"`
	SingleBet     int64       `json:"singleBet"`
	TotalBet      int64       `json:"totalBet"`
	MainWin       int64       `json:"mainWin"`
	BonusWin      int64       `json:"bonusWin"`
	Opportunities int         `json:"opportunities"`
	Awards        []Award     `json:"awards"`
	Beats         []BonusBeat `json:"beats"`
	Attack        string      `json:"attack"`
}

type fixture struct {
	board         []int
	mainWin       int64
	opportunities int
	bonusWin      int64
	attack        string
	awards        []Award
	beats         func(int64) []BonusBeat
}

var fixtures = map[string]fixture{
	"three":   {board: []int{3, 1, 2, 4, 1, 7, 8, 3, 4, 2, 5, 4, 1, 4, 6}, mainWin: 100, attack: "迅劍", awards: []Award{{ID: "line-17", Kind: "line", Count: 3, Label: "線 18 · 3連"}}},
	"empty":   {board: []int{3, 3, 7, 5, 7, 4, 1, 8, 7, 8, 1, 4, 2, 8, 4}, attack: "未遇敵"},
	"multi":   {board: []int{0, 8, 2, 8, 8, 5, 8, 4, 1, 8, 8, 6, 8, 3, 7}, mainWin: 12030, attack: "召喚・萬刃橫掃", awards: []Award{{ID: "line-0", Kind: "line", Symbol: intPtr(8), Count: 4, Label: "線 1 · 4連"}, {ID: "line-4", Kind: "line", Symbol: intPtr(8), Count: 3, Label: "線 5 · 3連"}, {ID: "line-8", Kind: "line", Symbol: intPtr(8), Count: 5, Label: "線 9 · 5連"}, {ID: "line-14", Kind: "line", Symbol: intPtr(8), Count: 4, Label: "線 15 · 4連"}}},
	"five":    {board: []int{8, 1, 2, 8, 3, 4, 8, 5, 6, 8, 7, 1, 8, 2, 3}, mainWin: 200, attack: "拔刀一閃", awards: []Award{{ID: "line-0", Kind: "line", Symbol: intPtr(8), Count: 5, Label: "線 1 · 5連"}}},
	"four":    {board: []int{4, 1, 2, 4, 3, 5, 4, 6, 7, 4, 8, 1, 2, 3, 4}, mainWin: 200, attack: "蒼刃劍氣", awards: []Award{{ID: "line-0", Kind: "line", Symbol: intPtr(4), Count: 4, Label: "線 1 · 4連"}}},
	"full":    {board: []int{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1}, mainWin: 4500, attack: "領域斬", awards: []Award{{ID: "full", Kind: "full", Symbol: intPtr(1), Count: 15, Label: "同符號全盤"}}},
	"group":   {board: []int{1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3}, mainWin: 6000, attack: "破封聖劍", awards: []Award{{ID: "group", Kind: "group", Count: 15, Label: "古代守衛討伐"}}},
	"word":    {board: []int{2, 1, 4, 3, 4, 1, 4, 2, 5, 1, 4, 6, 4, 3, 2}, mainWin: 370, attack: "迅劍", awards: []Award{{ID: "line-18", Kind: "line", Symbol: intPtr(4), Count: 3, Label: "線 19 · 3連"}}},
	"boss":    {board: []int{0, 1, 2, 0, 3, 4, 0, 5, 6, 1, 2, 3, 4, 5, 6}, mainWin: 850, opportunities: 1, bonusWin: 45360, attack: "藏寶怪現身", awards: []Award{{ID: "line-0", Kind: "line", Symbol: intPtr(0), Count: 3, Label: "線 1 · 3連"}}, beats: bossBeats},
	"allzero": {board: []int{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, mainWin: 450000, opportunities: 27, bonusWin: 57060, attack: "星紋開門", awards: []Award{{ID: "full", Kind: "full", Symbol: intPtr(0), Count: 15, Label: "星紋開門"}}, beats: allZeroBeats},
}

func intPtr(value int) *int { return &value }

func bossBeats(totalBet int64) []BonusBeat {
	scale := float64(totalBet) / 90
	return []BonusBeat{{ID: "bonus-0", Target: 8, Slots: []int{8, 8, 8, 8}, Amount: int64(45360 * scale), IsFull: true, HitIndices: []int{0, 1, 2, 3}, Before: 1, Remaining: 1, Cumulative: int64(45360 * scale)}, {ID: "bonus-1", Target: 0, Slots: []int{1, 2, 3, 4}, Before: 1, Cumulative: int64(45360 * scale)}}
}

func allZeroBeats(totalBet int64) []BonusBeat {
	scale := float64(totalBet) / 90
	return []BonusBeat{{ID: "bonus-0", Target: 1, Slots: []int{1, 1, 1, 1}, Amount: int64(45000 * scale), IsFull: true, HitIndices: []int{0, 1, 2, 3}, Before: 27, Remaining: 27, Cumulative: int64(45000 * scale)}, {ID: "bonus-1", Target: 2, Slots: []int{2, 2, 1, 3}, Amount: int64(12060 * scale), HitIndices: []int{0, 1}, Before: 27, Remaining: 27, Cumulative: int64(57060 * scale)}}
}

func Resolve(fixtureKey string, singleBet int64) (ResolvedRound, error) {
	if singleBet != 10 && singleBet != 20 && singleBet != 50 {
		return ResolvedRound{}, fmt.Errorf("singleBet must be 10, 20, or 50")
	}
	f, ok := fixtures[fixtureKey]
	if !ok {
		return ResolvedRound{}, fmt.Errorf("unknown fixture: %s", fixtureKey)
	}
	scale := float64(singleBet) / 10
	totalBet := singleBet * 9
	awards := make([]Award, len(f.awards))
	for i, award := range f.awards {
		awards[i] = award
		awards[i].Amount = int64(float64(f.mainWin) * scale / float64(len(f.awards)))
	}
	beats := []BonusBeat{}
	if f.beats != nil {
		beats = f.beats(totalBet)
	}
	return ResolvedRound{Board: append([]int(nil), f.board...), SingleBet: singleBet, TotalBet: totalBet, MainWin: int64(float64(f.mainWin) * scale), BonusWin: int64(float64(f.bonusWin) * scale), Opportunities: f.opportunities, Awards: awards, Beats: beats, Attack: f.attack}, nil
}
