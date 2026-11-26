package slotmath_test

import (
	"fmt"

	"zhudagamecenter/commonprefabs/server/slotmath"
)

// One seeded round of the example config (README sample).
func Example() {
	cfg := slotmath.ExampleConfig() // a game builds its own *slotmath.Config
	engine, err := slotmath.New(cfg, slotmath.NewMulberry32(168))
	if err != nil {
		panic(err)
	}
	round := engine.Spin(slotmath.SpinRequest{BetAmount: 10}, "r1")
	waves := 0
	for _, s := range round.Steps {
		if s.Type == slotmath.StepPay {
			waves++
		}
	}
	fmt.Println(waves, round.BaseWin, round.TotalMultiplier, round.TotalWin)
	// Output: 4 51 4 204
}
