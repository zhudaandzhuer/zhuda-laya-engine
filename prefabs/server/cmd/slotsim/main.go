// Command slotsim runs the Monte Carlo audit on slotmath.ExampleConfig.
//
//	go run ./cmd/slotsim -n 100000 -bet 10 -seed 1
//
// A game copies this file and passes its own Config. -seed 0 draws from
// crypto/rand (every run differs); any other seed replays exactly.
package main

import (
	"flag"
	"os"

	"zhudagamecenter/commonprefabs/server/slotmath"
	"zhudagamecenter/commonprefabs/server/slotsim"
)

func main() {
	n := flag.Int("n", 100000, "rounds to play")
	bet := flag.Int("bet", 10, "bet unit per round")
	seed := flag.Uint("seed", 1, "Mulberry32 seed; 0 uses crypto/rand")
	ante := flag.Bool("ante", false, "ante bet every round")
	buy := flag.Bool("buy", false, "buy the feature every round")
	flag.Parse()

	var rng slotmath.RNG = slotmath.CryptoRNG{}
	if *seed != 0 {
		rng = slotmath.NewMulberry32(uint32(*seed))
	}
	engine, err := slotmath.New(slotmath.ExampleConfig(), rng)
	if err != nil {
		panic(err)
	}
	slotsim.Run(engine, slotsim.Options{Spins: *n, Bet: *bet, Request: slotmath.SpinRequest{AnteBet: *ante, BuyFeature: *buy}}, os.Stdout)
}
