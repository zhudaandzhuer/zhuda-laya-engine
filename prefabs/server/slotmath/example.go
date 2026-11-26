package slotmath

import "sort"

// BuildStrip lays out a reel strip from symbol counts: the symbols in
// ascending id order, each repeated by its count, then a Fisher–Yates shuffle
// driven by Mulberry32(seed). buildStrip in 2d/cascade-math does the same, so a
// client and a server build the same strips from the same counts.
func BuildStrip(counts map[int]int, seed uint32) []int {
	ids := make([]int, 0, len(counts))
	for id := range counts {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	strip := make([]int, 0)
	for _, id := range ids {
		for i := 0; i < counts[id]; i++ {
			strip = append(strip, id)
		}
	}
	rng := NewMulberry32(seed)
	for i := len(strip) - 1; i > 0; i-- {
		j := rng.IntN(i + 1)
		strip[i], strip[j] = strip[j], strip[i]
	}
	return strip
}

// Symbol ids of ExampleConfig.
const (
	ExampleScatter    = 0
	ExampleMultiplier = 9
)

func exampleStrips(base map[int]int, extra []map[int]int, seed uint32) [][]int {
	out := make([][]int, len(extra))
	for c, more := range extra {
		counts := map[int]int{}
		for k, v := range base {
			counts[k] = v
		}
		for k, v := range more {
			counts[k] += v
		}
		out[c] = BuildStrip(counts, seed+uint32(c)*101)
	}
	return out
}

// ExampleConfig is a neutral, made-up configuration: a 6×5 grid, eight shape
// symbols that pay from 8 anywhere, a scatter ring, a multiplier ball (×2–×100)
// and 12 free spins. Its numbers belong to no real game; the simulator
// measures what they give (see README). Use it for demos and tests, and as a
// template for a game's own Config.
func ExampleConfig() *Config {
	pay := []int{1, 2, 3, 4, 5, 6, 7, 8}
	baseCounts := map[int]int{1: 10, 2: 11, 3: 12, 4: 13, 5: 14, 6: 15, 7: 16, 8: 17}
	freeCounts := map[int]int{1: 10, 2: 11, 3: 12, 4: 13, 5: 14, 6: 15, 7: 16, 8: 17}
	refillCounts := map[int]int{1: 8, 2: 8, 3: 9, 4: 9, 5: 10, 6: 10, 7: 11, 8: 11}
	return &Config{
		GameID:     "cascade-example",
		Cols:       6,
		Rows:       5,
		PaySymbols: pay,
		Paytable: map[int][]Tier{
			1: {{8, 600}, {11, 1500}, {14, 3000}},
			2: {{8, 300}, {11, 800}, {14, 2000}},
			3: {{8, 250}, {11, 600}, {14, 1200}},
			4: {{8, 160}, {11, 400}, {14, 900}},
			5: {{8, 120}, {11, 250}, {14, 600}},
			6: {{8, 80}, {11, 200}, {14, 500}},
			7: {{8, 60}, {11, 150}, {14, 300}},
			8: {{8, 40}, {11, 100}, {14, 250}},
		},
		MinMatch:          8,
		ScatterSymbol:     ExampleScatter,
		MultiplierSymbol:  ExampleMultiplier,
		ScatterPays:       []Tier{{4, 200}, {5, 500}, {6, 2000}},
		FreeSpinsTrigger:  4,
		FreeSpinsAward:    12,
		RetriggerScatters: 3,
		RetriggerAward:    4,
		MaxWinMultiplier:  5000,
		DefaultBet:        10,
		AnteCostPercent:   150,
		BuyCostMultiplier: 80,
		BuyScatterCells:   []int{2, 9, 16, 23},
		BaseReels: exampleStrips(baseCounts, []map[int]int{
			{0: 3}, {0: 3, 9: 1}, {0: 3}, {0: 3, 9: 1}, {0: 3}, {0: 3, 9: 1},
		}, 1001),
		FreeReels: exampleStrips(freeCounts, []map[int]int{
			{0: 2, 9: 2}, {0: 2, 9: 2}, {0: 2, 9: 2}, {0: 2, 9: 2}, {0: 2, 9: 2}, {0: 2, 9: 2},
		}, 2002),
		RefillReels: exampleStrips(refillCounts, []map[int]int{
			{0: 1}, {9: 1}, {0: 1}, {9: 1}, {0: 1}, {9: 1},
		}, 3003),
		MultiplierWeights: []Weighted{
			{2, 400}, {3, 250}, {5, 150}, {10, 60}, {25, 20}, {50, 6}, {100, 2},
		},
		FreeMultiplierWeights: []Weighted{
			{2, 300}, {3, 220}, {5, 170}, {10, 90}, {25, 40}, {50, 15}, {100, 5},
		},
		Names: map[int]string{
			0: "金環", 1: "紅圓", 2: "橙方", 3: "黃三角", 4: "綠菱",
			5: "青六角", 6: "藍水滴", 7: "紫月", 8: "灰十字", 9: "倍數球",
		},
	}
}
