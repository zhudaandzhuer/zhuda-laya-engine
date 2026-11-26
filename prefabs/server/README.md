# server/：遊戲伺服器共用的 Go 套件

遊戲的 `server/`（Go）共用的權威邏輯：數學、錢包接縫、閘道、簽章、重播、模擬器，以及線上對戰的配對＋輸入轉送（`matchrelay`）。這裡的程式**不會**被 `scripts/sync.mjs` 複製
（那是給前端用的）。遊戲伺服器用 Go module 的 `replace` 指過來，或整個套件複製過去：

```go
// games/<遊戲>/server/go.mod
require zhudagamecenter/commonprefabs/server v0.0.0
replace zhudagamecenter/commonprefabs/server => ../../../prefabs/server
```

檢查：`cd prefabs && npm run verify:go`（`go vet ./...` 與 `go test ./...`）。

## 迷宮一閃（dungeon*）

拆自 `games/dungeon-spin/server`（原 module `zhuda-dungeon-spin-server`，`internal/math`、`internal/authority`、`internal/gateway`、`cmd/server`），只改套件名與 import。
前端在 `2d/dungeon-spin`（它自己用本機帳本，沒有接這個伺服器）。

| 套件 | 內容 |
|---|---|
| `dungeonmath` | `Resolve(fixture, singleBet)`：十組固定情境 × 單注 10／20／50（總注 ×9），盤面、主局、Bonus、獎項、Bonus 節拍；其他下注、未知情境回錯 |
| `dungeonauthority` | `NewService()`、`Play(playerID, fixture, singleBet)`（原子：扣注與加獎一起，拒絕時什麼都不動）、`Balance`、`Round(id)`；每位玩家 100000 點起，全在記憶體 |
| `dungeongateway` | `New(service).Handler()`：`GET /api/health`、`GET /api/wallet?playerId=`、`POST /api/round`、`GET /api/round/<id>`，JSON、CORS `*`、無驗證 |
| `dungeonserver` | `go run ./dungeonserver`：在 `HOST:PORT`（預設 127.0.0.1:8790）提供上面的 API |

`dungeongateway/original_test.go` 拿同一支程式的輸出和原伺服器當時的輸出（`testdata/original-dump.txt`，316 行）逐位元組比：
全部情境 × 5 種下注、一段含拒絕與扣光的遊玩序列、餘額、存下的局、15 個 HTTP 請求。和前端 `math.ts` 不一樣的地方照原樣保留：
`multi` 每筆獎金截斷（3007，前端四捨五入 3008）、`three` 的獎項沒有 `symbol`、沒有 `lineIndex`、Bonus 沒命中時 `hitIndices` 是 `null`。

## 套件

| 套件 | 做什麼 |
|---|---|
| `slotmath` | 隨處消除連消老虎機的權威數學：設定檔（盤面、賠率級距、輪帶、倍數權重、免費遊戲、ante／購買、封頂）＋可換亂數的引擎；附中性範例設定。和 `2d/cascade-math` 同演算法，同種子同結果 |
| `slotsim` | 蒙地卡羅審計：RTP（主遊戲／免費遊戲、95% 區間）、命中率、波動、連消深度、各符號貢獻、免費遊戲觸發率 |
| `slotgateway` | HTTP API：health、balance、spin（鎖→扣注→一局→派彩→存重播，失敗退注）、replay；JWT 身分、CORS 白名單、注額限制 |
| `wallet` | 無縫錢包接縫（記憶體版）：冪等的下注／派彩／退注、每位玩家一把轉動中的鎖 |
| `authjwt` | 只用標準庫的 HS256 JWT（玩家、營運商、幣別、到期） |
| `replay` | 已完成回合的存放（泛型、可設上限） |
| `cmd/slotsim`、`cmd/slotserver` | 範例設定的模擬器與最小伺服器（遊戲複製後換成自己的設定） |

前六個拆自 `<original-cascade-slot>/server`（主題與美術未收），每個資料夾有 README。怎麼從零做一個遊戲的 Go 權威伺服器：`docs/routes/go-game-server.md`。

## 線上對戰配對（matchrelay）

| 套件 | 做什麼 |
|---|---|
| `matchrelay` | 兩人 lockstep 對戰的配對＋輸入轉送（WebSocket）：洲別快速配對、房間碼、輸入延遲、照順序轉送並驗證輸入、雜湊與結束比對、再戰、斷線寬限與續玩、Origin 白名單、限速與大小上限、閒置逾時、有上限的記憶體、healthz；假時鐘可測 |
| `matchrelay/relayclient` | Go 用戶端＋lockstep 迴圈（機器人、冒煙與整合測試） |

第一個使用者是 `games/zhuda-whirlwind-1/server`（豬大旋風1）。做法寫成路線 `docs/routes/online-lockstep-match.md`。

## 外部依賴

這個 module 原本只用標準庫；標準庫沒有 WebSocket 伺服器，所以加了**一個**依賴：

| 模組 | 版本 | 為什麼 |
|---|---|---|
| `github.com/coder/websocket` | v1.8.15（2026-06-15，ISC 授權） | `matchrelay` 的 WebSocket。原 `nhooyr.io/websocket`，Coder 維護；本身沒有任何依賴（只用標準庫）、支援 `context`、可設單則訊息上限（超過自動以 1009 關閉）、有送 ping 等 pong 的 API（量 RTT）、可併發寫入。`golang.org/x/net/websocket` 的文件自己建議改用維護較積極的套件（列了這個），也沒有量 RTT 的 ping API，所以不用 |

`go.sum` 已記錄雜湊。其他套件（slot*、dungeon*、wallet、authjwt、replay）不 import 它，編譯它們不會拉進這個依賴。不要再加別的依賴；要加先寫明理由。
