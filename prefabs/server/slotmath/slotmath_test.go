package slotmath_test

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"zhudagamecenter/commonprefabs/server/slotmath"
)

func engine(t *testing.T, seed uint32) *slotmath.Engine {
	t.Helper()
	e, err := slotmath.New(slotmath.ExampleConfig(), slotmath.NewMulberry32(seed))
	if err != nil {
		t.Fatal(err)
	}
	e.Now = func() time.Time { return time.UnixMilli(1) } // free spins carry timestamps too
	return e
}

// fill returns a 6×5 grid of a filler symbol with symbol placed at cells.
func fill(filler int, symbol int, cells ...int) []int {
	g := make([]int, 30)
	for i := range g {
		g[i] = filler
	}
	for _, c := range cells {
		g[c] = symbol
	}
	return g
}

// The same values as createSeededRng / randInt in 2d/cascade-math (checked in node).
func TestMulberry32MatchesTheTypeScriptGenerator(t *testing.T) {
	for seed, want := range map[uint32][]uint32{
		1:        {2693262067, 11749833, 2265367787, 4213581821, 4159151403},
		20261101: {2894595015, 3849201826, 3232460265, 1803126279, 2107286910},
	} {
		m := slotmath.NewMulberry32(seed)
		for i, w := range want {
			if got := m.Next(); got != w {
				t.Fatalf("seed %d draw %d = %d, want %d", seed, i, got, w)
			}
		}
	}
	m := slotmath.NewMulberry32(1)
	var got []int
	for i := 0; i < 8; i++ {
		got = append(got, m.IntN(171))
	}
	if want := []int{107, 0, 90, 167, 165, 48, 104, 123}; !reflect.DeepEqual(got, want) {
		t.Fatalf("IntN(171) = %v, want %v", got, want)
	}
	if m.IntN(0) != 0 || (slotmath.CryptoRNG{}).IntN(-3) != 0 {
		t.Fatal("IntN of n <= 0 must be 0")
	}
}

// Ported from the source's TestCalculatePay_AllTiers / TestCalculateScatterPay,
// with the example paytable (tiers at 8, 11, 14).
func TestPayTiers(t *testing.T) {
	cfg := slotmath.ExampleConfig()
	cases := []struct{ symbol, count, want int }{
		{1, 7, 0}, {1, 8, 60}, {1, 10, 60}, {1, 11, 150}, {1, 13, 150}, {1, 14, 300}, {1, 30, 300},
		{8, 8, 4}, {8, 11, 10}, {8, 14, 25},
		{cfg.ScatterSymbol, 8, 0}, {cfg.MultiplierSymbol, 8, 0}, {99, 8, 0},
	}
	for _, c := range cases {
		if got := cfg.Pay(c.symbol, c.count, 10); got != c.want {
			t.Errorf("Pay(%d, %d, 10) = %d, want %d", c.symbol, c.count, got, c.want)
		}
	}
	for count, want := range map[int]int{0: 0, 3: 0, 4: 20, 5: 50, 6: 200, 9: 200} {
		if got := cfg.ScatterPay(count, 10); got != want {
			t.Errorf("ScatterPay(%d, 10) = %d, want %d", count, got, want)
		}
	}
	if got := cfg.Pay(8, 8, 15); got != 6 { // 15*40/100 = 6: integer units, rounded down
		t.Errorf("Pay rounds down: got %d", got)
	}
}

func TestCosts(t *testing.T) {
	cfg := slotmath.ExampleConfig()
	for _, c := range []struct {
		req           slotmath.SpinRequest
		single, total int
	}{
		{slotmath.SpinRequest{BetAmount: 20}, 20, 20},
		{slotmath.SpinRequest{BetAmount: 0}, 10, 10},
		{slotmath.SpinRequest{BetAmount: 20, AnteBet: true}, 20, 30},
		{slotmath.SpinRequest{BetAmount: 20, BuyFeature: true}, 20, 1600},
		{slotmath.SpinRequest{BetAmount: 20, AnteBet: true, BuyFeature: true}, 20, 30},
	} {
		if s, tot := cfg.Cost(c.req); s != c.single || tot != c.total {
			t.Errorf("Cost(%+v) = %d, %d; want %d, %d", c.req, s, tot, c.single, c.total)
		}
	}
}

// Ported from TestDrawMultiplierOrb_Bounds.
func TestMultiplierDrawsStayInTheTable(t *testing.T) {
	e := engine(t, 7)
	seen := map[int]bool{}
	for i := 0; i < 5000; i++ {
		v := e.Draw(e.Config.MultiplierWeights)
		if v < 2 || v > 100 {
			t.Fatalf("draw %d out of the table", v)
		}
		seen[v] = true
	}
	if !seen[2] || !seen[3] || !seen[5] {
		t.Errorf("common values missing: %v", seen)
	}
}

// Ported from the source evaluate tests (empty grid, eight of one symbol, two symbols at once).
func TestEvaluate(t *testing.T) {
	cfg := slotmath.ExampleConfig()
	empty := []int{
		1, 2, 3, 4, 5, 6,
		7, 8, 1, 2, 3, 4,
		5, 6, 7, 8, 1, 2,
		3, 4, 5, 6, 7, 8,
		1, 2, 3, 4, 5, 6,
	}
	if a, w := cfg.Evaluate(empty, 10); len(a) != 0 || len(w) != 0 {
		t.Fatalf("empty grid paid %v", a)
	}
	eight := make([]int, 30)
	for i := range eight {
		eight[i] = 3 + i%5 // symbols 3..7, six of each at most
	}
	for _, c := range []int{0, 3, 7, 10, 14, 17, 21, 23} {
		eight[c] = 8
	}
	a, w := cfg.Evaluate(eight, 10)
	if len(a) != 1 || a[0].Symbol != 8 || a[0].Count != 8 || a[0].Amount != 4 || len(w) != 8 {
		t.Fatalf("eight of symbol 8: %+v", a)
	}
	if a[0].ID != "win-sym8-8" || a[0].Kind != "scatter-pay" || len(a[0].GridIndices) != 8 {
		t.Fatalf("award shape: %+v", a[0])
	}
	two := []int{
		1, 1, 1, 1, 2, 2,
		1, 1, 1, 1, 2, 2,
		2, 2, 2, 2, 3, 4,
		5, 6, 7, 8, 3, 4,
		5, 6, 7, 8, 3, 4,
	}
	a, w = cfg.Evaluate(two, 10)
	if len(a) != 2 || len(w) != 16 || a[0].Amount+a[1].Amount != 60+30 {
		t.Fatalf("two at once: %+v", a)
	}
	// scatters and multipliers never count, even when there are many
	if a, _ := cfg.Evaluate(fill(cfg.ScatterSymbol, cfg.MultiplierSymbol, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9), 10); len(a) != 0 {
		t.Fatalf("scatter/multiplier paid: %+v", a)
	}
}

// Ported from TestApplyGravityAndRefill_OrderConservation.
func TestTumbleKeepsColumnOrderAndRefillsTheTop(t *testing.T) {
	e := engine(t, 1)
	grid := fill(7, 7)
	grid[0], grid[6], grid[12], grid[18], grid[24] = 1, 2, 1, 3, 4
	refill := [][]int{{8, 8, 8, 8, 8}, {8, 8, 8, 8, 8}, {8, 8, 8, 8, 8}, {8, 8, 8, 8, 8}, {8, 8, 8, 8, 8}, {8, 8, 8, 8, 8}}
	next, _ := e.Tumble(grid, map[int]bool{0: true, 12: true}, map[int]int{}, refill)
	if next[0] != 8 || next[6] != 8 || next[12] != 2 || next[18] != 3 || next[24] != 4 {
		t.Fatalf("column 0 after tumble: %v %v %v %v %v", next[0], next[6], next[12], next[18], next[24])
	}
	for c := 1; c < 6; c++ {
		if next[c] != 7 {
			t.Fatalf("untouched column %d changed", c)
		}
	}
}

// Ported from TestApplyGravityAndRefill_OrbValueTracking.
func TestTumbleCarriesMultiplierValues(t *testing.T) {
	e := engine(t, 1)
	cfg := e.Config
	grid := fill(7, 7)
	grid[1], grid[7], grid[13], grid[19], grid[25] = cfg.MultiplierSymbol, 8, 8, 8, 8
	refill := [][]int{{5, 5, 5, 5, 5}, {5, 5, 5, 5, 5}, {5, 5, 5, 5, 5}, {5, 5, 5, 5, 5}, {5, 5, 5, 5, 5}, {5, 5, 5, 5, 5}}
	next, orbs := e.Tumble(grid, map[int]bool{7: true, 13: true, 19: true, 25: true}, map[int]int{1: 25}, refill)
	if next[25] != cfg.MultiplierSymbol || orbs[25] != 25 || len(orbs) != 1 {
		t.Fatalf("multiplier fell to %v with %v", next[25], orbs)
	}
}

func TestSpinIsReplayableAndConsistent(t *testing.T) {
	for seed := uint32(1); seed <= 300; seed++ {
		a := engine(t, seed).Spin(slotmath.SpinRequest{BetAmount: 10}, "r")
		b := engine(t, seed).Spin(slotmath.SpinRequest{BetAmount: 10}, "r")
		ja, _ := json.Marshal(a)
		jb, _ := json.Marshal(b)
		if string(ja) != string(jb) {
			t.Fatalf("seed %d: two plays differ", seed)
		}
		// steps: initial, then pay/drop pairs, maybe the cap; wins add up
		if a.Steps[0].Type != slotmath.StepInitial {
			t.Fatal("first step is not the initial grid")
		}
		sum := 0
		for i, s := range a.Steps {
			if s.Index != i {
				t.Fatalf("seed %d: step %d has index %d", seed, i, s.Index)
			}
			if s.Type == slotmath.StepPay {
				sum += s.StepWin
				if a.Steps[i+1].Type != slotmath.StepDrop {
					t.Fatalf("seed %d: a pay step is not followed by a drop", seed)
				}
			}
		}
		if sum != a.BaseWin {
			t.Fatalf("seed %d: steps pay %d, base win %d", seed, sum, a.BaseWin)
		}
		if len(a.Grid) != 30 || a.TotalWin < 0 || a.TotalWin > a.SingleBet*5000 {
			t.Fatalf("seed %d: bad round %+v", seed, a)
		}
	}
}

// Ported from TestExecuteSpinRound_BuyFeatureGuaranteedScatters.
func TestBuyingTheFeatureAlwaysTriggersFreeSpins(t *testing.T) {
	e := engine(t, 99)
	for i := 0; i < 50; i++ {
		res := e.Spin(slotmath.SpinRequest{BetAmount: 10, BuyFeature: true}, "buy")
		if res.TotalBet != 800 || !res.FreeSpinTriggered || res.FreeSpinsCount < 12 || len(res.FreeSpins) != res.FreeSpinsCount {
			t.Fatalf("bought round: bet %d triggered %v count %d", res.TotalBet, res.FreeSpinTriggered, res.FreeSpinsCount)
		}
		for _, cell := range e.Config.BuyScatterCells {
			if res.Steps[0].Grid[cell] != e.Config.ScatterSymbol {
				t.Fatalf("cell %d is not a scatter", cell)
			}
		}
		// the free-spin multiplier never goes down
		last := 0
		for _, fs := range res.FreeSpins {
			if fs.GlobalMultiplier < last {
				t.Fatal("free-spin multiplier went down")
			}
			last = fs.GlobalMultiplier
		}
	}
}

func TestTheCapStopsTheRound(t *testing.T) {
	cfg := slotmath.ExampleConfig()
	cfg.MaxWinMultiplier = 1 // any win over one bet is capped
	e, _ := slotmath.New(cfg, slotmath.NewMulberry32(3))
	capped := 0
	for i := 0; i < 400; i++ {
		res := e.Spin(slotmath.SpinRequest{BetAmount: 10}, "c")
		if res.TotalWin > 10 {
			t.Fatalf("won %d over the cap", res.TotalWin)
		}
		if res.IsMaxWinCapped {
			capped++
			if s := res.Steps[len(res.Steps)-1]; !res.FreeSpinTriggered && (s.Type != slotmath.StepCap || !s.IsTerminated) {
				t.Fatalf("capped round without a cap step: %+v", s)
			}
		}
	}
	if capped == 0 {
		t.Fatal("no round reached a cap of one bet")
	}
}

func TestBuildStripKeepsTheCounts(t *testing.T) {
	strip := slotmath.BuildStrip(map[int]int{3: 2, 1: 4, 9: 1}, 5)
	counts := map[int]int{}
	for _, s := range strip {
		counts[s]++
	}
	if len(strip) != 7 || counts[1] != 4 || counts[3] != 2 || counts[9] != 1 {
		t.Fatalf("strip %v", strip)
	}
	if !reflect.DeepEqual(strip, slotmath.BuildStrip(map[int]int{1: 4, 3: 2, 9: 1}, 5)) {
		t.Fatal("same counts and seed must give the same strip")
	}
}

func TestValidate(t *testing.T) {
	bad := []func(c *slotmath.Config){
		func(c *slotmath.Config) { c.Cols = 0 },
		func(c *slotmath.Config) { c.BaseReels = c.BaseReels[:3] },
		func(c *slotmath.Config) { c.Paytable[1] = []slotmath.Tier{{11, 1}, {8, 2}} },
		func(c *slotmath.Config) {
			c.PaySymbols = append(c.PaySymbols, c.ScatterSymbol)
			c.Paytable[c.ScatterSymbol] = []slotmath.Tier{{8, 1}}
		},
		func(c *slotmath.Config) { c.MultiplierWeights = nil },
		func(c *slotmath.Config) { c.BuyScatterCells = []int{30} },
		func(c *slotmath.Config) { c.DefaultBet = 0 },
	}
	for i, f := range bad {
		cfg := slotmath.ExampleConfig()
		f(cfg)
		if _, err := slotmath.New(cfg, nil); err == nil {
			t.Errorf("bad config %d accepted", i)
		}
	}
	if err := slotmath.ExampleConfig().Validate(); err != nil {
		t.Fatal(err)
	}
}
