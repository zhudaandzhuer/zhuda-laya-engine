# server/slotmath：隨處消除連消老虎機的權威數學

`package slotmath`：一局 = 從輪帶切出盤面 → 任何位置同符號達 `MinMatch` 個就依數量級距派彩 → 中獎格消除、同欄存活符號往下掉、上方從補充輪帶補進 → 重複到不再中獎；
倍數符號抽到的值在主遊戲加總乘上連消贏分、在免費遊戲累加且只增不減；分散符號依數量派彩並觸發免費遊戲；整局封頂在 `下注 × MaxWinMultiplier`。
所有遊戲特有的東西都在 `Config`（盤面大小、符號、賠率級距、輪帶、倍數權重、免費遊戲規則、ante／購買價格、封頂、名稱與標籤）；引擎沒有主題。金額一律是下注單位的整數。

拆自 <original-cascade-slot>（主題與美術未收）：`server/internal/math`、`internal/engine`。演算法和抽籤順序沒改；那款遊戲的符號、賠率、輪帶、倍數權重**沒有**收進來，這裡附的是自己編的中性範例 `ExampleConfig()`。

## 用法

```go
import "zhudagamecenter/commonprefabs/server/slotmath"

cfg := slotmath.ExampleConfig() // 遊戲自己組一個 *slotmath.Config
engine, err := slotmath.New(cfg, slotmath.NewMulberry32(168)) // 正式上線用 slotmath.CryptoRNG{}
if err != nil { panic(err) }
round := engine.Spin(slotmath.SpinRequest{BetAmount: 10}, "r1")
// round.Steps：INITIAL_GRID → (PAY_ANYWHERE_EVAL → TUMBLE_DROP)… → [MAX_WIN_CAP]
// seed 168：4 波連消、BaseWin 51、TotalMultiplier 4、TotalWin 204
```

這段就是 `example_test.go` 的 `Example()`，`go test` 會編譯並核對輸出。

| 名稱 | 內容 |
|---|---|
| `Config`、`Tier{Min, Pay}`（Pay 是下注的百分之幾）、`Weighted{Value, Weight}` | 一款遊戲的全部數學；`Validate()` 檢查輪帶數、級距遞增、權重 |
| `Engine{Config, RNG, Now}`、`New(cfg, rng)` | `Spin(req, id)` 一整局（含免費遊戲）、`Cascade(…)` 一轉、`FreeSpins(bet, id)`、`Slice`、`Tumble`、`Draw` |
| `Config.Evaluate(grid, bet)`、`Pay`、`ScatterPay`、`Cost` | 判獎與價格（ante 先於購買，`BetAmount ≤ 0` 用 `DefaultBet`） |
| `RNG`、`CryptoRNG`、`Mulberry32` | 唯一的亂數來源。`Mulberry32` 和 `2d/cascade-math` 的同一個演算法、同一個 `IntN` 換算 → 用戶端用同一個種子重播同一局 |
| `BuildStrip(counts, seed)` | 由「每種符號幾個」排出一條輪帶（洗牌用 Mulberry32，用戶端同結果） |
| `Round`、`Step`、`Award`、`Orb{Cell, Value}` | 回傳的 JSON（欄位名見 `2d/slot-client/server-round.ts`） |
| `ExampleConfig()` | 中性範例：6×5、八種形狀符號 8／11／14 個三級、金環分散（4 個起 12 次免費遊戲，免費中 3 個 +4）、倍數球 ×2–×100、封頂 5000×、ante 150%、購買 80× |

### 可以設定的

`MinMatch`、各符號級距、`ScatterPays`、`FreeSpinsTrigger`／`FreeSpinsAward`／`RetriggerScatters`／`RetriggerAward`、`MaxWinMultiplier`、`DefaultBet`、`AnteCostPercent`、`BuyCostMultiplier`、`BuyScatterCells`（購買時強制放分散的格子）、三組輪帶、`MultiplierWeights`／`FreeMultiplierWeights`／`RefillMultiplierWeights`（連消中掉進來的倍數用哪組；空的話用主遊戲那組，免費遊戲也是——原遊戲就是這樣）、`Names`、`WinLabel`／`ScatterLabel`。

## 驗證（2026-11-25）

- **和原遊戲逐局相同**：在工作區把原伺服器複製一份，只把 `pkg/crypto` 的 crypto/rand 換成同一個 Mulberry32（可設種子），把原遊戲自己的表（從它的 `internal/math` 讀，不重打）組成 `Config` 餵給本套件。5,000 個種子 × 5 種請求（10、20、50＋ante、10＋購買、0）＝ 111,010 局（其中 86,010 局免費遊戲）、187,020 步、38,005 波連消、93,567 顆倍數、44,751 個獎項、5,051 次觸發，每一局的盤面、停止點、每一步、每個獎項、倍數、贏分、免費遊戲全部相同，兩邊的亂數也正好用掉一樣多。把兩邊的封頂都改成 50×，3,000 個種子再比一次（60,785 局、1,548 局封頂）也相同。
- 和原遊戲**刻意不同**的只有：JSON 欄位名（`grid6x5`→`grid`、`orbMultipliers`→`orbs`（帶格子位置）、`freeSpinsRounds`→`freeSpins`）；`stepIndex` 一律是第幾步（原碼的中獎步用「第幾波」，會和下一步重號；波數改放 `cascade`）；倍數依格子排序（原碼走訪 Go map，順序每次執行不同；比對時當成多重集合比）。
- `parity_test.go`：範例設定 30 個種子 × 3 種請求（含購買）的每局 SHA-256 存在 `testdata/parity.json`，`tests/cascade-math.test.mjs` 用 TypeScript 引擎算出同樣的 90 個值。
- `slotmath_test.go`（從原遊戲的 `paytable_test.go`、`cascade_test.go` 改成範例設定）：級距邊界、分散派彩、價格、倍數抽籤範圍、判獎（無獎、8 個、兩種同時）、掉落保持欄內順序、倍數值跟著符號掉、同種子同結果且每步加總等於 BaseWin、購買必進免費遊戲且免費倍數只增不減、封頂、`BuildStrip`、`Validate`、Mulberry32 對 JS 的值。

範例設定的 RTP（`go run ./cmd/slotsim -n 1000000 -seed N`）：種子 1／2／3 → 92.98%／94.44%／91.67%，命中率約 23.5%，免費遊戲約每 143 轉一次，三次的最高單局在 1,900–2,560× 之間。這是量出來的，不是調好、認證過的數字。

## 已知限制

- 範例設定只是示範，沒有經過數學認證；真的上線要自己的設定、自己的模擬與第三方檢驗。
- `Mulberry32` 不是密碼學亂數：只能用在模擬、測試、重播；真錢局用 `CryptoRNG`。
- 引擎不是並行安全（共用一個 RNG）；`slotgateway` 用一把鎖串起來。
- 原遊戲的 ante（多付 25%）在數學裡什麼都沒變（註解說會多出分散符號，程式沒做）；這裡照原樣保留「只改價格」，要真的提高機率得另外給 ante 用的輪帶。
