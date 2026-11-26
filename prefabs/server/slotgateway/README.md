# server/slotgateway：老虎機伺服器的 HTTP API

| 方法 | 路徑 | 做什麼 |
|---|---|---|
| GET | `/api/health` | `{"status":"UP","service":<gameId>,"time":…}` |
| GET | `/api/user/balance` | 玩家餘額 |
| POST | `/api/spin` | `{"betAmount":10,"anteBet":false,"buyFeature":false}` → 鎖玩家 → 扣注 → 跑一局 → 派彩 → 存重播 → `{"success":true,"data":<Round>,"balance":…}` |
| GET | `/api/replay?id=<roundId>` | 唯讀重播 |
| GET | `/api/auth/token?userId=` | 只有 `IssueTokens` 時有（開發用） |

玩家身分來自 `Authorization: Bearer <HS256 JWT>`（`authjwt`）。錯誤：401 沒有有效 token、402 餘額不足、429 同一玩家還在轉、400 JSON 壞或注額不允許、405 方法錯、500 這局失敗（**已退回下注**）。

拆自 <original-cascade-slot>（主題與美術未收）：`server/internal/gateway`。流程順序沒改；改了的地方（都是原本的安全問題）：

- JWT 密鑰是選項（原本寫死在 `main.go`）；預設不接受 `?userId=`（原本任何人帶 `?userId=別人` 就能用別人的錢包下注），要開發時才開 `AllowGuest`。
- CORS 預設不回應任何來源（原本一律 `*`），`AllowedOrigins` 列出才回。
- 一局 panic 會 `Rollback` 退注並回 500（原本扣了注就沒有退）；`Win` 失敗會回 500（原本忽略錯誤）。
- 請求內容限制 1 MiB；GET 路徑拒絕其他方法；`Bets` 限制注額（原本任何正整數）。

## 用法

```go
engine, _ := slotmath.New(cfg, slotmath.CryptoRNG{})
server := slotgateway.New(engine, wallet.NewManager(100000), replay.NewStore[*slotmath.Round](10000),
	slotgateway.Options{JWTSecret: os.Getenv("SLOT_JWT_SECRET"), Bets: []int{10, 20, 50, 100}})
log.Fatal(http.ListenAndServe("127.0.0.1:8088", server.Handler()))
```

完整可跑的是 `cmd/slotserver`（`SLOT_JWT_SECRET=… SLOT_DEV=1 go run ./cmd/slotserver`；`SLOT_DEV=1` 才開訪客、發 token、CORS `*`）；`example_test.go` 的 `Example()` 是同一段接線加一次 token 下注。用戶端是 `2d/slot-client/vendor.ts` 的 `RemoteSlotClient`，回合 JSON 用 `server-round.ts` 的 `toResolvedRound()` 轉成畫面資料。

| 選項 | 預設 | |
|---|---|---|
| `JWTSecret` | 空（沒有 token 能驗過） | |
| `AllowGuest` | false | 沒 token 時用 `?userId=` 或 `guest_player` |
| `IssueTokens`、`TokenTTL`、`OperatorID`、`Currency` | false、24 h | 開發用的發 token 路徑 |
| `AllowedOrigins` | 無 | `"*"` 要明寫 |
| `Bets` | 任何正數 | |
| `MaxBodyBytes` | 1 MiB | |
| `NewRoundID` | `rnd_<ns>_<user>` | |

## 驗證（2026-11-25）

`slotgateway_test.go`：健康檢查（原 `TestGateway_Health`）、下注→重播→餘額一致（原 `TestGateway_SpinFlowAndReplay`，改成開 `AllowGuest`）、沒 token 401、別的密鑰簽的 token 401、開發 token、注額限制、壞 JSON、購買 800、餘額不足 402 不扣、CORS 預設關、轉的中途同玩家 429、一局失敗退注且釋放鎖。

## 已知限制

- 錢包和重播都在記憶體（`wallet`、`replay`）；正式環境換成營運商的錢包 API 與持久儲存。
- 重播 API 任何人知道 id 就能讀（和原本一樣）；要限制請在外層驗證。
- 沒有速率限制、沒有 TLS、沒有冪等的「同一請求重送」（扣注用 round id 當交易 id；重送會開新的一局）。
- 沒有接過真的前端：用戶端的對應只用測試裡的假 fetch 和同一份 JSON 驗過。
