package slotsim_test

import (
	"bytes"
	"strings"
	"testing"

	"zhudagamecenter/commonprefabs/server/slotmath"
	"zhudagamecenter/commonprefabs/server/slotsim"
)

func run(seed uint32, n int) (slotsim.Report, string) {
	e, _ := slotmath.New(slotmath.ExampleConfig(), slotmath.NewMulberry32(seed))
	var out bytes.Buffer
	return slotsim.Run(e, slotsim.Options{Spins: n, Bet: 10}, &out), out.String()
}

func TestASeedReplaysTheSameReport(t *testing.T) {
	a, textA := run(42, 3000)
	b, textB := run(42, 3000)
	a.Elapsed, b.Elapsed = 0, 0
	if a.TotalWin != b.TotalWin || a.HitRate != b.HitRate || a.TumbleDist != b.TumbleDist {
		t.Fatal("same seed, different report")
	}
	strip := func(s string) string { // the timing line differs
		var keep []string
		for _, l := range strings.Split(s, "\n") {
			if !strings.Contains(l, "Spins/sec") {
				keep = append(keep, l)
			}
		}
		return strings.Join(keep, "\n")
	}
	if strip(textA) != strip(textB) {
		t.Fatal("same seed, different text")
	}
}

func TestTheReportAddsUp(t *testing.T) {
	r, text := run(7, 5000)
	if r.TotalBet != 5000*10 || r.BaseWin+r.FreeWin != r.TotalWin {
		t.Fatalf("totals %+v", r)
	}
	sum := 0
	for _, c := range r.TumbleDist {
		sum += c
	}
	if sum != 5000 {
		t.Fatalf("depths add up to %d", sum)
	}
	if r.RTP <= 0 || r.HitRate <= 0 || r.HitRate >= 100 || r.CI95Low > r.RTP || r.CI95High < r.RTP {
		t.Fatalf("rates %+v", r)
	}
	for _, want := range []string{"實測整體 RTP", "級聯消除深度分佈", "紅圓", "免費遊戲觸發次數"} {
		if !strings.Contains(text, want) {
			t.Fatalf("report lacks %q", want)
		}
	}
}
