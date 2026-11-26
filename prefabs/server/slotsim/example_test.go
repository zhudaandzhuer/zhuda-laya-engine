package slotsim_test

import (
	"fmt"

	"zhudagamecenter/commonprefabs/server/slotmath"
	"zhudagamecenter/commonprefabs/server/slotsim"
)

// RTP of a seeded run, without printing the report (README sample).
func Example() {
	engine, _ := slotmath.New(slotmath.ExampleConfig(), slotmath.NewMulberry32(1))
	report := slotsim.Run(engine, slotsim.Options{Spins: 20000, Bet: 10}, nil) // pass os.Stdout for the report
	fmt.Println(report.TotalBet, report.RTP > 50, report.HitRate > 10)
	// Output: 200000 true true
}
