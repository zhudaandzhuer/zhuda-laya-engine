package slotmath

import (
	"fmt"
	"sort"
	"time"
)

// Step types, in the order a spin produces them.
const (
	StepInitial = "INITIAL_GRID"      // the grid cut from the strips
	StepPay     = "PAY_ANYWHERE_EVAL" // a cascade wave that pays (grid before removal)
	StepDrop    = "TUMBLE_DROP"       // the grid after removal, fall and refill
	StepCap     = "MAX_WIN_CAP"       // the round hit the cap and stopped
)

// Award is one paying group (a symbol's count anywhere, or the scatters).
type Award struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"` // "scatter-pay"
	Symbol      int    `json:"symbol"`
	Count       int    `json:"count"`
	Amount      int    `json:"amount"`
	Label       string `json:"label"`
	GridIndices []int  `json:"gridIndices"`
}

// Orb is a multiplier symbol on the grid and its drawn value.
type Orb struct {
	Cell  int `json:"cell"`
	Value int `json:"value"`
}

// Step is one beat of a spin for the client to play.
type Step struct {
	Index   int     `json:"stepIndex"`
	Type    string  `json:"type"`
	Cascade int     `json:"cascade"` // the wave number (0 on the initial grid)
	Grid    []int   `json:"grid"`    // row-major, Cols × Rows
	Awards  []Award `json:"awards"`
	StepWin int     `json:"stepWin"`
	// Orbs on the grid at this step, ordered by cell.
	Orbs                 []Orb `json:"orbs"`
	CumulativeMultiplier int   `json:"cumulativeMultiplier"`
	IsTerminated         bool  `json:"isTerminated,omitempty"`
}

// Round is one spin's whole result (a base spin carries its free spins).
type Round struct {
	RoundID           string   `json:"roundId"`
	GameID            string   `json:"gameId"`
	SingleBet         int      `json:"singleBet"`
	TotalBet          int      `json:"totalBet"`
	InitialStops      []int    `json:"initialStops"`
	Grid              []int    `json:"grid"` // the final grid
	Steps             []Step   `json:"steps"`
	Awards            []Award  `json:"awards"`
	TotalMultiplier   int      `json:"totalMultiplier"`
	BaseWin           int      `json:"baseWin"`
	TotalWin          int      `json:"totalWin"`
	FreeSpinTriggered bool     `json:"freeSpinTriggered"`
	ScatterCount      int      `json:"scatterCount"`
	FreeSpinsCount    int      `json:"freeSpinsCount,omitempty"`
	FreeSpinsTotalWin int      `json:"freeSpinsTotalWin,omitempty"`
	FreeSpins         []*Round `json:"freeSpins,omitempty"`
	GlobalMultiplier  int      `json:"globalMultiplier,omitempty"`
	IsMaxWinCapped    bool     `json:"isMaxWinCapped"`
	Timestamp         int64    `json:"timestamp"`
}

// SpinRequest is what a player asks for.
type SpinRequest struct {
	BetAmount  int  `json:"betAmount"`
	AnteBet    bool `json:"anteBet"`
	BuyFeature bool `json:"buyFeature"`
}

// Engine runs rounds of one Config with one RNG. It is not safe for
// concurrent use when the RNG is not (Mulberry32 is not; CryptoRNG is).
type Engine struct {
	Config *Config
	RNG    RNG
	// Now stamps Round.Timestamp; nil uses time.Now.
	Now func() time.Time
}

// New checks cfg and returns an engine.
func New(cfg *Config, rng RNG) (*Engine, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	if rng == nil {
		rng = CryptoRNG{}
	}
	return &Engine{Config: cfg, RNG: rng}, nil
}

func (e *Engine) now() int64 {
	if e.Now != nil {
		return e.Now().UnixMilli()
	}
	return time.Now().UnixMilli()
}

// Draw picks a weighted value.
func (e *Engine) Draw(weights []Weighted) int {
	total := 0
	for _, w := range weights {
		total += w.Weight
	}
	r := e.RNG.IntN(total)
	cur := 0
	for _, w := range weights {
		cur += w.Weight
		if r < cur {
			return w.Value
		}
	}
	return weights[0].Value
}

func (e *Engine) drawMultiplier(free bool) int {
	if free {
		return e.Draw(e.Config.FreeMultiplierWeights)
	}
	return e.Draw(e.Config.MultiplierWeights)
}

func (e *Engine) drawRefillMultiplier() int {
	if len(e.Config.RefillMultiplierWeights) > 0 {
		return e.Draw(e.Config.RefillMultiplierWeights)
	}
	return e.Draw(e.Config.MultiplierWeights)
}

// Slice cuts a grid from the strips: one uniform stop per column, Rows symbols
// down from it (wrapping). It returns the grid and the stops.
func (e *Engine) Slice(reels [][]int) ([]int, []int) {
	cols, rows := e.Config.Cols, e.Config.Rows
	grid := make([]int, cols*rows)
	stops := make([]int, cols)
	for c := 0; c < cols; c++ {
		strip := reels[c]
		stop := e.RNG.IntN(len(strip))
		stops[c] = stop
		for r := 0; r < rows; r++ {
			grid[r*cols+c] = strip[(stop+r)%len(strip)]
		}
	}
	return grid, stops
}

// Evaluate finds every paying symbol with MinMatch or more anywhere on grid.
// Scatters and multipliers never count. It returns the awards (in PaySymbols
// order) and the set of winning cells.
func (c *Config) Evaluate(grid []int, singleBet int) ([]Award, map[int]bool) {
	positions := make(map[int][]int)
	for idx, sym := range grid {
		if sym == c.ScatterSymbol || sym == c.MultiplierSymbol {
			continue
		}
		positions[sym] = append(positions[sym], idx)
	}
	awards := make([]Award, 0)
	winning := make(map[int]bool)
	for _, sym := range c.PaySymbols {
		cells := positions[sym]
		if len(cells) < c.MinMatch {
			continue
		}
		amount := c.Pay(sym, len(cells), singleBet)
		if amount <= 0 {
			continue
		}
		for _, idx := range cells {
			winning[idx] = true
		}
		awards = append(awards, Award{
			ID:          fmt.Sprintf("win-sym%d-%d", sym, len(cells)),
			Kind:        "scatter-pay",
			Symbol:      sym,
			Count:       len(cells),
			Amount:      amount,
			Label:       c.winLabel(sym, len(cells)),
			GridIndices: cells,
		})
	}
	return awards, winning
}

// Tumble removes the winning cells, lets each column's survivors fall in
// order, and fills the top from the refill strips (one uniform draw per empty
// cell, bottom-most new symbol drawn first). Multiplier values move with their
// symbols; new multipliers get a value.
func (e *Engine) Tumble(grid []int, winning map[int]bool, orbs map[int]int, refill [][]int) ([]int, map[int]int) {
	cfg := e.Config
	cols, rows := cfg.Cols, cfg.Rows
	next := make([]int, cols*rows)
	nextOrbs := make(map[int]int)
	type item struct{ symbol, orb int }
	for c := 0; c < cols; c++ {
		survivors := make([]item, 0, rows)
		for r := rows - 1; r >= 0; r-- {
			idx := r*cols + c
			if winning[idx] {
				continue
			}
			sym := grid[idx]
			v := 0
			if sym == cfg.MultiplierSymbol {
				v = orbs[idx]
				if v == 0 {
					v = e.drawRefillMultiplier()
				}
			}
			survivors = append(survivors, item{sym, v})
		}
		needed := rows - len(survivors)
		strip := refill[c]
		fresh := make([]item, 0, needed)
		for i := 0; i < needed; i++ {
			sym := strip[e.RNG.IntN(len(strip))]
			v := 0
			if sym == cfg.MultiplierSymbol {
				v = e.drawRefillMultiplier()
			}
			fresh = append(fresh, item{sym, v})
		}
		for r := 0; r < needed; r++ {
			it := fresh[needed-1-r]
			idx := r*cols + c
			next[idx] = it.symbol
			if it.symbol == cfg.MultiplierSymbol {
				nextOrbs[idx] = it.orb
			}
		}
		for r := needed; r < rows; r++ {
			it := survivors[len(survivors)-1-(r-needed)]
			idx := r*cols + c
			next[idx] = it.symbol
			if it.symbol == cfg.MultiplierSymbol {
				nextOrbs[idx] = it.orb
			}
		}
	}
	return next, nextOrbs
}

// OrbList returns the values on the grid ordered by cell (values of 0 left out).
func OrbList(orbs map[int]int) []Orb {
	out := make([]Orb, 0, len(orbs))
	for cell, v := range orbs {
		if v > 0 {
			out = append(out, Orb{Cell: cell, Value: v})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Cell < out[j].Cell })
	return out
}

func cloneInts(src []int) []int {
	out := make([]int, len(src))
	copy(out, src)
	return out
}

// Cascade plays one spin on reels: cut, cascade until nothing pays, then
// multipliers, scatter pay and the cap. In free spins (free=true) the spin's
// multipliers add to incomingGlobal when the spin won anything; in the base
// game the sum of the final grid's multipliers is the round multiplier.
func (e *Engine) Cascade(singleBet int, reels [][]int, forceScatters bool, roundID string, incomingGlobal int, free bool) *Round {
	cfg := e.Config
	grid, stops := e.Slice(reels)
	if forceScatters {
		for _, idx := range cfg.BuyScatterCells {
			grid[idx] = cfg.ScatterSymbol
		}
	}
	orbs := make(map[int]int)
	for idx, sym := range grid {
		if sym == cfg.MultiplierSymbol {
			orbs[idx] = e.drawMultiplier(free)
		}
	}
	steps := make([]Step, 0, 8)
	awards := make([]Award, 0, 8)
	baseWin := 0
	steps = append(steps, Step{Index: 0, Type: StepInitial, Grid: cloneInts(grid), Awards: []Award{}, Orbs: OrbList(orbs), CumulativeMultiplier: incomingGlobal})

	wave := 0
	for {
		wins, winning := cfg.Evaluate(grid, singleBet)
		if len(wins) == 0 {
			break
		}
		wave++
		stepWin := 0
		for _, w := range wins {
			stepWin += w.Amount
			awards = append(awards, w)
		}
		baseWin += stepWin
		steps = append(steps, Step{Index: len(steps), Type: StepPay, Cascade: wave, Grid: cloneInts(grid), Awards: wins, StepWin: stepWin, Orbs: OrbList(orbs), CumulativeMultiplier: incomingGlobal})
		grid, orbs = e.Tumble(grid, winning, orbs, cfg.RefillReels)
		steps = append(steps, Step{Index: len(steps), Type: StepDrop, Cascade: wave, Grid: cloneInts(grid), Awards: []Award{}, Orbs: OrbList(orbs), CumulativeMultiplier: incomingGlobal})
	}

	scatters := 0
	for _, sym := range grid {
		if sym == cfg.ScatterSymbol {
			scatters++
		}
	}
	triggered := !free && scatters >= cfg.FreeSpinsTrigger

	orbSum := 0
	for idx, sym := range grid {
		if sym != cfg.MultiplierSymbol {
			continue
		}
		if v, ok := orbs[idx]; ok && v > 0 {
			orbSum += v
		} else {
			v := e.drawMultiplier(free)
			orbs[idx] = v
			orbSum += v
		}
	}

	applied := 1
	global := incomingGlobal
	if free {
		if baseWin > 0 && orbSum > 0 {
			global += orbSum
		}
		if global > 0 {
			applied = global
		}
	} else if orbSum > 0 {
		applied = orbSum
	}

	totalWin := 0
	if baseWin > 0 {
		totalWin = baseWin * applied
	}
	if pay := cfg.ScatterPay(scatters, singleBet); pay > 0 {
		totalWin += pay
		awards = append(awards, Award{
			ID:     fmt.Sprintf("scatter-%d", scatters),
			Kind:   "scatter-pay",
			Symbol: cfg.ScatterSymbol,
			Count:  scatters,
			Amount: pay,
			Label:  cfg.scatterLabel(scatters),
		})
	}

	capped := false
	if limit := singleBet * cfg.MaxWinMultiplier; totalWin > limit {
		totalWin = limit
		capped = true
		steps = append(steps, Step{Index: len(steps), Type: StepCap, Cascade: wave, Grid: cloneInts(grid), StepWin: totalWin, CumulativeMultiplier: cfg.MaxWinMultiplier, IsTerminated: true})
	}

	return &Round{
		RoundID:           roundID,
		GameID:            cfg.GameID,
		SingleBet:         singleBet,
		TotalBet:          singleBet,
		InitialStops:      stops,
		Grid:              grid,
		Steps:             steps,
		Awards:            awards,
		TotalMultiplier:   applied,
		GlobalMultiplier:  global,
		BaseWin:           baseWin,
		TotalWin:          totalWin,
		FreeSpinTriggered: triggered,
		ScatterCount:      scatters,
		IsMaxWinCapped:    capped,
		Timestamp:         e.now(),
	}
}

// FreeSpins plays the free-spin feature: FreeSpinsAward spins on FreeReels
// with a multiplier that only grows, RetriggerAward more for
// RetriggerScatters, stopping at the cap. It returns the total, the spins
// played and each spin.
func (e *Engine) FreeSpins(singleBet int, parentRoundID string) (int, int, []*Round) {
	cfg := e.Config
	total, played, global := 0, 0, 0
	remaining := cfg.FreeSpinsAward
	rounds := make([]*Round, 0, remaining)
	limit := singleBet * cfg.MaxWinMultiplier
	for remaining > 0 {
		remaining--
		played++
		r := e.Cascade(singleBet, cfg.FreeReels, false, fmt.Sprintf("%s_fs_%d", parentRoundID, played), global, true)
		global = r.GlobalMultiplier
		total += r.TotalWin
		rounds = append(rounds, r)
		if r.ScatterCount >= cfg.RetriggerScatters {
			remaining += cfg.RetriggerAward
		}
		if total >= limit {
			total = limit
			break
		}
	}
	return total, played, rounds
}

// Spin plays a whole round: the base spin (scatters forced in when bought),
// then free spins if triggered, capped at bet unit × MaxWinMultiplier.
func (e *Engine) Spin(req SpinRequest, roundID string) *Round {
	cfg := e.Config
	singleBet, totalBet := cfg.Cost(req)
	round := e.Cascade(singleBet, cfg.BaseReels, req.BuyFeature, roundID, 0, false)
	round.SingleBet = singleBet
	round.TotalBet = totalBet
	if round.FreeSpinTriggered {
		win, count, spins := e.FreeSpins(singleBet, roundID)
		round.FreeSpinsCount = count
		round.FreeSpinsTotalWin = win
		round.FreeSpins = spins
		round.TotalWin += win
		if limit := singleBet * cfg.MaxWinMultiplier; round.TotalWin >= limit {
			round.TotalWin = limit
			round.IsMaxWinCapped = true
		}
	}
	return round
}
