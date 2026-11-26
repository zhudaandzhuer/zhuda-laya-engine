// Package slotsim is a Monte Carlo audit of a slotmath engine: it plays N
// rounds and reports RTP (with base and free-spin parts and a 95% interval),
// hit rate, volatility, the largest win and multiplier, cap hits, the cascade
// depth distribution, each symbol's share and the free-spin trigger rate.
//
// Split from <original-cascade-slot>/server/cmd/simulator; the statistics
// and their formulas are unchanged (see README "驗證").
package slotsim

import (
	"fmt"
	"io"
	"math"
	"strings"
	"time"

	"zhudagamecenter/commonprefabs/server/slotmath"
)

// Options of a run.
type Options struct {
	Spins int // rounds to play
	Bet   int // bet unit per round
	// Request is sent every round (BetAmount is overwritten by Bet).
	Request slotmath.SpinRequest
	// Progress prints a progress line every this many rounds (0: 25000).
	Progress int
	// Title is the report's first line.
	Title string
}

// Report is what a run measured.
type Report struct {
	Spins, Bet                    int
	TotalBet, TotalWin            int64
	BaseWin, FreeWin              int64
	RTP, BaseRTP, FreeRTP         float64 // percent
	CI95Low, CI95High             float64 // percent
	HitRate                       float64 // percent of rounds that won anything
	StdDev, Variance              float64 // of win/bet per round
	MaxWin, MaxMultiplier, Capped int
	TumbleDist                    [11]int // rounds by paying waves: 0..9, 10 = ten or more
	MaxTumbleChain                int
	SymbolHits                    map[int]int
	SymbolWins                    map[int]int64
	FreeSpinTriggers, FreeSpins   int
	Elapsed                       time.Duration
}

// Run plays opts.Spins rounds and writes the report to w (nil: no output).
func Run(e *slotmath.Engine, opts Options, w io.Writer) Report {
	if w == nil {
		w = io.Discard
	}
	if opts.Progress <= 0 {
		opts.Progress = 25000
	}
	if opts.Title == "" {
		opts.Title = "slotsim：" + e.Config.GameID + " 蒙地卡羅數值模擬"
	}
	n, bet := opts.Spins, opts.Bet
	rep := Report{Spins: n, Bet: bet, SymbolHits: map[int]int{}, SymbolWins: map[int]int64{}}
	rule := strings.Repeat("=", 72)
	fmt.Fprintf(w, "%s\n%s\n", rule, opts.Title)
	fmt.Fprintf(w, "模擬局數: %d 局 | 單注: %d 分幣 (%.2f 元) | 審計置信度: 95.0%%\n%s\n", n, bet, float64(bet)/100.0, rule)

	start := time.Now()
	var sumReturn, sumReturnSq float64
	hits := 0
	req := opts.Request
	req.BetAmount = bet
	for i := 1; i <= n; i++ {
		res := e.Spin(req, fmt.Sprintf("sim_%d", i))
		b, win := int64(res.TotalBet), int64(res.TotalWin)
		rep.TotalBet += b
		rep.TotalWin += win
		ret := float64(win) / float64(b)
		sumReturn += ret
		sumReturnSq += ret * ret
		if res.TotalWin > 0 {
			hits++
		}
		if res.IsMaxWinCapped {
			rep.Capped++
		}
		rep.BaseWin += int64(res.TotalWin - res.FreeSpinsTotalWin)
		rep.FreeWin += int64(res.FreeSpinsTotalWin)
		if res.FreeSpinTriggered {
			rep.FreeSpinTriggers++
			rep.FreeSpins += res.FreeSpinsCount
		}
		if res.TotalWin > rep.MaxWin {
			rep.MaxWin = res.TotalWin
		}
		if res.TotalMultiplier > rep.MaxMultiplier {
			rep.MaxMultiplier = res.TotalMultiplier
		}
		waves := 0
		for _, s := range res.Steps {
			if s.Type == slotmath.StepPay {
				waves++
			}
		}
		if waves > rep.MaxTumbleChain {
			rep.MaxTumbleChain = waves
		}
		rep.TumbleDist[min(waves, 10)]++
		for _, a := range res.Awards {
			if a.Symbol != e.Config.ScatterSymbol && a.Symbol != e.Config.MultiplierSymbol {
				rep.SymbolHits[a.Symbol]++
				rep.SymbolWins[a.Symbol] += int64(a.Amount)
			}
		}
		if i%opts.Progress == 0 || i == n {
			fmt.Fprintf(w, "進度: %7d / %7d (%5.1f%%) | 當前整體 RTP: %6.2f%% | 基礎命中率: %5.2f%%\n",
				i, n, float64(i)/float64(n)*100.0, float64(rep.TotalWin)/float64(rep.TotalBet)*100.0, float64(hits)/float64(i)*100.0)
		}
	}
	rep.Elapsed = time.Since(start)
	nf := float64(n)
	rep.RTP = float64(rep.TotalWin) / float64(rep.TotalBet) * 100.0
	rep.BaseRTP = float64(rep.BaseWin) / float64(rep.TotalBet) * 100.0
	rep.FreeRTP = float64(rep.FreeWin) / float64(rep.TotalBet) * 100.0
	rep.HitRate = float64(hits) / nf * 100.0
	mean := sumReturn / nf
	rep.Variance = sumReturnSq/nf - mean*mean
	if rep.Variance < 0 {
		rep.Variance = 0
	}
	rep.StdDev = math.Sqrt(rep.Variance)
	se := rep.StdDev / math.Sqrt(nf)
	rep.CI95Low = (mean - 1.96*se) * 100.0
	rep.CI95High = (mean + 1.96*se) * 100.0

	fmt.Fprintf(w, "\n==================== 1. 回報率 ====================\n")
	fmt.Fprintf(w, "總運算耗時:         %v (吞吐量: %.0f Spins/sec)\n", rep.Elapsed, nf/rep.Elapsed.Seconds())
	fmt.Fprintf(w, "總投入下注額:       %d 分幣\n", rep.TotalBet)
	fmt.Fprintf(w, "總派彩中獎額:       %d 分幣\n", rep.TotalWin)
	fmt.Fprintf(w, "實測整體 RTP:       %6.2f%% (95%% 置信區間: [%.2f%%, %.2f%%])\n", rep.RTP, rep.CI95Low, rep.CI95High)
	fmt.Fprintf(w, "   ├─ 主遊戲 Base RTP: %6.2f%%\n", rep.BaseRTP)
	fmt.Fprintf(w, "   └─ 免費遊戲 Free RTP:%6.2f%%\n", rep.FreeRTP)
	fmt.Fprintf(w, "基礎遊戲命中率:     %6.2f%% (平均每 %.1f 轉中獎一次)\n", rep.HitRate, 100.0/rep.HitRate)
	fmt.Fprintf(w, "收益統計波動率 (σ): %.2f | 方差 (σ²): %.2f\n", rep.StdDev, rep.Variance)
	fmt.Fprintf(w, "單局最高中獎:       %d 分幣 (倍數: %.1fx)\n", rep.MaxWin, float64(rep.MaxWin)/float64(bet))
	fmt.Fprintf(w, "單局最高累計倍數:   %dx\n", rep.MaxMultiplier)
	fmt.Fprintf(w, "觸發 %dx 截頂:  %d 次\n", e.Config.MaxWinMultiplier, rep.Capped)

	fmt.Fprintf(w, "\n==================== 2. 級聯消除深度分佈 ====================\n")
	fmt.Fprintf(w, "波數深度 (Tumble)      局數 (Spins)         佔比 (%%)        視覺分佈\n%s\n", strings.Repeat("-", 72))
	for wave := 0; wave <= 10; wave++ {
		cnt := rep.TumbleDist[wave]
		pct := float64(cnt) / nf * 100.0
		label := fmt.Sprintf("%d 波消除", wave)
		if wave == 0 {
			label = "0 波 (未中獎)"
		} else if wave == 10 {
			label = "10+ 波消除"
		}
		fmt.Fprintf(w, "%-18s %12d %15.2f%%    %s\n", label, cnt, pct, strings.Repeat("█", int(pct/2.0)))
	}
	fmt.Fprintf(w, "單局最高連續級聯:    %d 波連消\n", rep.MaxTumbleChain)

	fmt.Fprintf(w, "\n==================== 3. 各符號貢獻 ====================\n")
	fmt.Fprintf(w, "符號名稱               消除命中次數         總派彩 (分幣)     RTP 貢獻佔比\n%s\n", strings.Repeat("-", 72))
	for _, sym := range e.Config.PaySymbols {
		wins := rep.SymbolWins[sym]
		fmt.Fprintf(w, "%-18s %14d %18d %15.2f%%\n", e.Config.Name(sym), rep.SymbolHits[sym], wins, float64(wins)/float64(rep.TotalBet)*100.0)
	}

	fmt.Fprintf(w, "\n==================== 4. 免費遊戲 ====================\n")
	avgFree := 0.0
	if rep.FreeSpinTriggers > 0 {
		avgFree = float64(rep.FreeWin) / float64(rep.FreeSpinTriggers*bet)
	}
	fmt.Fprintf(w, "免費遊戲觸發次數:   %d 次 (觸發率: %.2f%%，平均每 %.0f 轉進入一次)\n",
		rep.FreeSpinTriggers, float64(rep.FreeSpinTriggers)/nf*100.0, nf/float64(rep.FreeSpinTriggers))
	fmt.Fprintf(w, "累計進行免費旋轉:   %d 轉\n", rep.FreeSpins)
	fmt.Fprintf(w, "平均每次獎勵局收益: %.1fx 單注\n%s\n", avgFree, rule)
	return rep
}
