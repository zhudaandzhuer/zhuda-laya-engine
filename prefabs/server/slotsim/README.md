# server/slotsim：連消老虎機的蒙地卡羅審計

`slotsim.Run(engine, Options{Spins, Bet, Request}, w)` 跑 N 局，回傳並（`w` 不是 nil 時）印出：整體 RTP 與主遊戲／免費遊戲兩部分、95% 信賴區間、命中率、波動率與變異數、最高單局與最高倍數、封頂次數、連消深度分佈（0–9、10+ 波）、各符號命中次數與 RTP 佔比、免費遊戲觸發率與平均收益。

拆自 <original-cascade-slot>（主題與美術未收）：`server/cmd/simulator`。統計方法與公式沒改；報表的標題與符號名來自 `Config`。

```go
engine, _ := slotmath.New(slotmath.ExampleConfig(), slotmath.NewMulberry32(1))
report := slotsim.Run(engine, slotsim.Options{Spins: 20000, Bet: 10}, nil) // os.Stdout 就印報表
fmt.Println(report.RTP, report.HitRate)
```

（`example_test.go` 的 `Example()`。）命令列版：`go run ./cmd/slotsim -n 100000 -bet 10 -seed 1`（`-seed 0` 用 crypto/rand、`-ante`、`-buy`）。

## 驗證（2026-11-25）

- 原遊戲的模擬器（原伺服器的複本，只換成可設種子的 Mulberry32）和本套件（餵原遊戲的設定）各跑 `-n 100000`，種子 20261125 與 7：報表 41 行、104 個數字逐一相同（只略過耗時那行）。種子 20261125 時 RTP 84.01%、命中率 30.55%。
- `slotsim_test.go`：同種子同報表、各項加總（下注、主遊戲＋免費＝總贏分、深度分佈總和＝局數、信賴區間包住 RTP）。

## 已知限制

- 10 萬局不夠判斷 RTP：原遊戲設定 100 萬局、三個種子量到 94.41%／96.14%／89.34%，95% 信賴區間寬約 ±6 個百分點（免費遊戲的大獎主導變異）。原遊戲宣稱 96.5%，沒有任何一次量測支持或否定到那個精度。
- 「各符號 RTP 佔比」用的是乘倍數前的金額（和原工具相同），加起來不等於主遊戲 RTP。
