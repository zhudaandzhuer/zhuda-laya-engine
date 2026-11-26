// Package slotmath is an authoritative scatter-pays cascade ("tumble") slot
// engine: a grid is cut from reel strips, every paying symbol seen MinMatch or
// more times anywhere pays by its count tier, winners are removed, the column
// survivors fall, new symbols drop in from refill strips, and that repeats until
// nothing pays. Multiplier symbols carry drawn values that multiply the
// round's cascade win (summed in the base game, accumulated across free spins).
// Scatters pay by count and trigger free spins.
//
// Everything game-specific is in Config: grid size, symbols, paytable tiers,
// strips, multiplier weights, free-spin rules, costs, caps and labels. The
// engine holds no theme. All money is integer units of the bet ("cents").
//
// Split from <original-cascade-slot>/server (internal/math, internal/engine);
// the algorithm and its draw order are unchanged, so the same RNG gives the same
// rounds (see README "驗證").
package slotmath

import (
	"errors"
	"fmt"
	"sort"
)

// Tier is one count tier of a paytable: a count of Min or more pays Pay
// hundredths of the bet unit (Pay 250 with bet 10 pays 10*250/100 = 25).
type Tier struct {
	Min int `json:"min"`
	Pay int `json:"pay"`
}

// Weighted is one value of a weighted draw.
type Weighted struct {
	Value  int `json:"value"`
	Weight int `json:"weight"`
}

// Config is a whole game's math.
type Config struct {
	GameID string `json:"gameId"`
	Cols   int    `json:"cols"`
	Rows   int    `json:"rows"`

	// PaySymbols are evaluated in this order (awards come out in this order).
	PaySymbols []int `json:"paySymbols"`
	// Paytable gives each paying symbol its tiers, ascending by Min.
	Paytable map[int][]Tier `json:"paytable"`
	// MinMatch is the smallest count anywhere on the grid that pays.
	MinMatch int `json:"minMatch"`

	ScatterSymbol    int `json:"scatterSymbol"`
	MultiplierSymbol int `json:"multiplierSymbol"`
	// ScatterPays are count tiers paid on the final grid of a spin.
	ScatterPays []Tier `json:"scatterPays"`

	FreeSpinsTrigger  int `json:"freeSpinsTrigger"`  // scatters on a base spin's final grid that start free spins
	FreeSpinsAward    int `json:"freeSpinsAward"`    // free spins given
	RetriggerScatters int `json:"retriggerScatters"` // scatters in a free spin that add spins
	RetriggerAward    int `json:"retriggerAward"`    // spins added

	// MaxWinMultiplier caps a round at bet unit × this.
	MaxWinMultiplier int `json:"maxWinMultiplier"`
	// DefaultBet replaces a bet of zero or less.
	DefaultBet int `json:"defaultBet"`
	// AnteCostPercent: an ante bet costs bet × this / 100 (it changes nothing else).
	AnteCostPercent int `json:"anteCostPercent"`
	// BuyCostMultiplier: buying free spins costs bet × this.
	BuyCostMultiplier int `json:"buyCostMultiplier"`
	// BuyScatterCells are overwritten with scatters on a bought spin's first grid.
	BuyScatterCells []int `json:"buyScatterCells"`

	BaseReels   [][]int `json:"baseReels"`
	FreeReels   [][]int `json:"freeReels"`
	RefillReels [][]int `json:"refillReels"`

	MultiplierWeights     []Weighted `json:"multiplierWeights"`
	FreeMultiplierWeights []Weighted `json:"freeMultiplierWeights"`
	// RefillMultiplierWeights are used for multipliers that drop in during a
	// cascade, in the base game and in free spins. Empty: MultiplierWeights
	// (that is what the source game did, free spins included).
	RefillMultiplierWeights []Weighted `json:"refillMultiplierWeights,omitempty"`

	// Names are display names by symbol (labels, simulator report).
	Names map[int]string `json:"names"`
	// WinLabel and ScatterLabel write award labels; nil uses neutral defaults.
	WinLabel     func(symbol, count int, name string) string `json:"-"`
	ScatterLabel func(count int, name string) string         `json:"-"`
}

// Cells is Cols × Rows.
func (c *Config) Cells() int { return c.Cols * c.Rows }

// Name returns the symbol's display name, or "#<id>".
func (c *Config) Name(symbol int) string {
	if n, ok := c.Names[symbol]; ok {
		return n
	}
	return fmt.Sprintf("#%d", symbol)
}

func tierPay(tiers []Tier, count, unit int) int {
	pay := -1
	for _, t := range tiers {
		if count >= t.Min {
			pay = t.Pay
		}
	}
	if pay < 0 {
		return 0
	}
	return (unit * pay) / 100
}

// Pay returns what count of symbol anywhere pays at bet unit singleBet (0 below
// the first tier or for a symbol without a paytable).
func (c *Config) Pay(symbol, count, singleBet int) int {
	tiers, ok := c.Paytable[symbol]
	if !ok || count < c.MinMatch {
		return 0
	}
	return tierPay(tiers, count, singleBet)
}

// ScatterPay returns what count scatters on a final grid pay.
func (c *Config) ScatterPay(count, singleBet int) int {
	return tierPay(c.ScatterPays, count, singleBet)
}

// Cost is what a request costs: ante first, then buy, else the bet.
func (c *Config) Cost(req SpinRequest) (singleBet, totalBet int) {
	singleBet = req.BetAmount
	if singleBet <= 0 {
		singleBet = c.DefaultBet
	}
	totalBet = singleBet
	if req.AnteBet {
		totalBet = (singleBet * c.AnteCostPercent) / 100
	} else if req.BuyFeature {
		totalBet = singleBet * c.BuyCostMultiplier
	}
	return singleBet, totalBet
}

func (c *Config) winLabel(symbol, count int) string {
	if c.WinLabel != nil {
		return c.WinLabel(symbol, count, c.Name(symbol))
	}
	return fmt.Sprintf("%s ×%d", c.Name(symbol), count)
}

func (c *Config) scatterLabel(count int) string {
	if c.ScatterLabel != nil {
		return c.ScatterLabel(count, c.Name(c.ScatterSymbol))
	}
	return fmt.Sprintf("%s ×%d", c.Name(c.ScatterSymbol), count)
}

// Validate reports the first thing that would make the engine misbehave.
func (c *Config) Validate() error {
	if c.Cols <= 0 || c.Rows <= 0 {
		return errors.New("slotmath: cols and rows must be positive")
	}
	if c.MinMatch <= 0 {
		return errors.New("slotmath: minMatch must be positive")
	}
	if c.DefaultBet <= 0 {
		return errors.New("slotmath: defaultBet must be positive")
	}
	if c.MaxWinMultiplier <= 0 {
		return errors.New("slotmath: maxWinMultiplier must be positive")
	}
	for name, reels := range map[string][][]int{"baseReels": c.BaseReels, "freeReels": c.FreeReels, "refillReels": c.RefillReels} {
		if len(reels) != c.Cols {
			return fmt.Errorf("slotmath: %s has %d strips, want %d", name, len(reels), c.Cols)
		}
		for i, strip := range reels {
			if len(strip) < c.Rows {
				return fmt.Errorf("slotmath: %s[%d] is shorter than a column", name, i)
			}
		}
	}
	for _, s := range c.PaySymbols {
		tiers, ok := c.Paytable[s]
		if !ok || len(tiers) == 0 {
			return fmt.Errorf("slotmath: symbol %d has no paytable", s)
		}
		if !sort.SliceIsSorted(tiers, func(i, j int) bool { return tiers[i].Min < tiers[j].Min }) {
			return fmt.Errorf("slotmath: symbol %d tiers are not ascending", s)
		}
		if s == c.ScatterSymbol || s == c.MultiplierSymbol {
			return fmt.Errorf("slotmath: symbol %d cannot both pay and be scatter/multiplier", s)
		}
	}
	for _, w := range [][]Weighted{c.MultiplierWeights, c.FreeMultiplierWeights} {
		total := 0
		for _, x := range w {
			if x.Weight < 0 {
				return errors.New("slotmath: negative multiplier weight")
			}
			total += x.Weight
		}
		if total <= 0 {
			return errors.New("slotmath: multiplier weights must add up to more than 0")
		}
	}
	for _, cell := range c.BuyScatterCells {
		if cell < 0 || cell >= c.Cells() {
			return fmt.Errorf("slotmath: buy scatter cell %d is off the grid", cell)
		}
	}
	return nil
}
