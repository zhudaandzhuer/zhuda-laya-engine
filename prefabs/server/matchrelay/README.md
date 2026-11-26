# server/matchrelay：兩人 lockstep 對戰的配對＋輸入轉送伺服器

和遊戲無關的 Go 套件：用 WebSocket 幫兩個玩家配對，比賽中把每一格的輸入照順序轉給對手。
**伺服器不跑遊戲**：兩邊瀏覽器用同一套確定性模擬各自算同一場比賽（lockstep＋輸入延遲）；
伺服器只比對雙方回報的狀態雜湊和結束格，一致才宣布結果，不一致就作廢（`desync`）。
它不開埠，遊戲把 `Handler`、`HealthHandler` 掛到自己的 mux 上，再呼叫 `Run`。

第一個使用者：`games/zhuda-whirlwind-1/server`（豬大旋風1，協定 `games/zhuda-whirlwind-1/design/PROTOCOL.md`）。
另附 `relayclient/`：Go 版的用戶端與 lockstep 迴圈（機器人、冒煙測試、整合測試用）。

## 怎麼用

```go
srv, err := matchrelay.New(matchrelay.Config{
	Service:        "zhuda-whirlwind",
	Stages:         []string{"livingroom", "backyard"},
	Chars:          []string{"zhuda", "zhuer"},
	AllowedOrigins: []string{"https://game.qianlongxundao.com", "http://127.0.0.1:*", "http://localhost:*"},
})
if err != nil {
	log.Fatal(err)
}
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
defer stop()
go srv.Run(ctx) // 計時：配對放寬、逾時、房間過期、斷線寬限……

mux := http.NewServeMux()
mux.Handle("/games/zhuda-whirlwind/ws", srv.Handler())
mux.Handle("/games/zhuda-whirlwind/healthz", srv.HealthHandler())
log.Fatal(http.ListenAndServe("127.0.0.1:8796", mux))
```

同一段接線在 `example_test.go` 的 `Example()` 裡編譯並核對輸出。完整的程式（旗標、日誌檔、關機）見 `games/zhuda-whirlwind-1/server/cmd/server`。

## 協定摘要（v1，加上可選的直連擴充）

每則訊息一個 JSON 文字框，上限 1 KiB（只有 `rtc` 可到 `MaxSignalBytes`，預設 6 KiB）。

| 客戶端 → 伺服器 | 伺服器 → 客戶端 |
|---|---|
| `hello {v, id, name, char}`（第一則）→ | `welcome {v, region, online}` |
| `queue {char}` → | 每秒 `queued {waited}`；配到 `match`；20 秒 `timeout` |
| `room_create {char}` → | `room {code}`；5 分鐘沒人來 `error room_expired` |
| `room_join {code, char}` → | 雙方 `match`；`error bad_room／room_full` |
| `cancel` | 離開佇列、房間或比賽（比賽中＝對手立刻收到 `opp_left`） |
| `ready {match}` → | 雙方都好了 → `go {match}` |
| `in {f, b}` → | 對手收到 `in {f, b}`（照順序） |
| `hash {f, h}`（f = 60, 120, …）→ | 不一致：雙方 `desync {f}` |
| `end {f, winner}` → | 一致：雙方 `result {winner}`；不一致：`desync {f}` |
| `rematch` → | 雙方都送 → 新的 `match` |
| `ping {c}` → | `pong {c, s}` |
| | `opp_left`：對手離開，或斷線 10 秒沒回來 |
| | `error {code, msg}` |
| `rtc {match, d}`（直連擴充）→ | 對手收到 `rtc {match, d}` |

`match` = `{match, seed, side, delay, stage, you, opp, key}`：`seed` 是 crypto/rand 的 uint32、`stage` 從 `Stages` 隨機挑、`side` 隨機、`you`／`opp` 是 `{name, char, region}`。

配對：`CF-IPCountry` → 洲（`AS EU NA SA OC AF`，其他 `??`）。佇列由最久的人開始配：先找同一洲最久的；**兩人中較久的那位**等滿 10 秒後，配任何洲；同一個玩家 `id`（同一個瀏覽器的兩個分頁）永遠不會配在一起；20 秒 `timeout` 並移出佇列。房間碼 4 碼，字母表 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（去掉 I、O、0、1，大小寫都收）。

輸入延遲：`delay = clamp(ceil(較大的 RTT ÷ 16.7 ms) + 1, 2, 10)`（量不到用 6；用整個 RTT：輸入經過伺服器兩段路，約等於一個來回，2026-11-25 由 RTT÷2 改來）（整數微秒算，邊界精確，`InputDelay()`）。RTT 是伺服器每 2 秒送 WebSocket ping 量的（瀏覽器自動回 pong，不用寫程式），加上客戶端在 `ping` 裡自報的 `rtt`（擴充，見下），各取最近 5 次的中位數、兩者取大。兩邊都量不到用 4；只量到一邊時至少 4。

### 驗證規則

- `in`：只在 `go` 之後；`f` 必須從 `delay` 開始逐格連號（跳號、重送都拒絕，不轉送，回 `error bad_input`）；`b` 是 0–63 的整數；不能領先對手超過 `MaxLeadFrames`（預設 120 格，lockstep 本身最多領先 delay＋1）；超過 `MaxFrames`（15 分鐘）這場作廢。
- `hash`：`f` 必須是上一次＋60、而且已送過那一格的輸入；`h` 收 uint32，也收 JS `h|0` 的負數（換成同一個 uint32 比）。
- `end`：`winner` 是 -1／0／1；兩邊 `f` 和 `winner` 都一樣才 `result`。對手 10 秒內沒送 `end` → `desync`。
- 比賽結束或解散後才到的 `in`／`hash`／`end`（網路上還在路上的）安靜丟掉，不回錯誤。

### 直連（WebRTC 信令）擴充

讓同一場的兩個玩家自己開 WebRTC DataChannel、直接互送輸入；**伺服器仍是權威**（輸入照舊每格都經它轉送、驗證、比雜湊），它只多做：

| 項目 | 做法 |
|---|---|
| 版本 | `Config.Version`／`MinVersion`：`hello.v` 在這個範圍內就收（豬大旋風1：2／1），`welcome.v` 回客戶端自己的版本，healthz 的 `v` 是 `Version` |
| 誰能直連 | `hello` 帶 `"p2p": true` 的兩個人配到同一場 → `match` 多 `"p2p": true`（`omitempty`：其他情況欄位不出現，舊客戶端看到的 `match` 一模一樣） |
| `rtc {match, d}` | 原樣（壓縮空白）轉給**同一場的對手**：`{"t":"rtc","match":id,"d":{…}}`。只在 `match.p2p` 的比賽、`match` 之後到比賽結束；沒比賽、錯的 `match`、這場沒直連 → `bad_state`；`d` 不是 JSON 物件 → `bad_message`；比賽結束後才到 → 安靜丟掉；對手斷線中 → 不轉送 |
| 大小 | WebSocket 讀取上限改成 `max(MaxMessageBytes, MaxSignalBytes)`（6144）；`rtc` 以外的訊息超過 `MaxMessageBytes`（1024）仍以 1009 關閉，和以前一樣 |
| 次數 | 每邊每場 `MaxSignalsPerMatch`（40）則，超過回 `error rtc_limit`（不斷線、不轉送）；也算在每秒 90 則的令牌桶裡 |
| 延遲 | `ready` 可帶 `"p2p": {"ok": true, "rtt": 毫秒}`（0–10000；格式不對就當 `ok:false`）。雙方都 `ok` 時 `go.delay = min(match 的 delay, InputDelay(較大的直連 RTT))`，否則等於 `match` 的 delay；`go` 一律帶 `delay`。從 `go` 起輸入驗證、「卡著等」、`resume` 的 `next` 都用這個最終延遲 |
| 監看 | healthz `totals.signals`（轉送的 `rtc`）、`totals.direct`（用直連延遲開始的場數）；日誌 `go` 一行：`delay`、`relayDelay`、雙方 `p2p`。不記 `rtc` 內容（裡面有玩家的 IP） |

客戶端的做法（STUN、DataChannel 設定、封包、先到先用、衝突處理、不超前中繼 90 格）在 `games/zhuda-whirlwind-1/design/PROTOCOL.md` 的「v2」。

### 擴充（協定沒寫、加了不影響照協定做的客戶端）

| 擴充 | 為什麼 |
|---|---|
| `match.key`（32 個十六進位字）＋ `resume {match, key, f}` → `resumed {match, side, next, started}`，再補送對手第 `f` 格起的輸入 | 協定說「斷線 10 秒沒回來判對方贏」，但沒有回來的訊息。斷線後在 10 秒內重連、`hello` 後送 `resume`：`f` 是自己還缺的對手第一格；回覆的 `next` 是伺服器要的自己下一格（從那裡重送）。`started:false` 表示還沒 `go`，要再送 `ready`。key 是伺服器發的祕密，猜 `id` 搶不走座位 |
| `ping` 可帶 `rtt`（毫秒，客戶端自己從 `pong` 量的） | Cloudflare 前面那一段會不會把 WebSocket ping 原樣轉到瀏覽器沒有驗證過；萬一 ping 只量到 Tunnel 這一段，延遲會被低估。自報值只能把延遲調大（上限 8），作弊沒有好處 |
| 錯誤碼 `bad_state`、`bad_input`、`room_expired`、`ready_timeout`、`idle`、`resume_failed`、`server_busy` | 協定的錯誤碼只列了例子 |
| `healthz` 多 `rooms` 與 `totals`（累計：連線、比賽、結果、desync、opp_left、佇列逾時、房間、拒絕、限速、錯誤） | 監看用；協定要的欄位都在 |

### 時間與上限（`Config`，括號是預設）

| 項目 | |
|---|---|
| 同洲 `SameRegionFor`（10 s）、佇列 `QueueTimeout`（20 s）、房間 `RoomTTL`（5 min） | |
| `ReadyTimeout`（30 s） | `match` 後 30 秒還沒雙方 `ready`：沒準備好的一方算離開 |
| 斷線寬限 `Grace`（10 s） | 比賽中斷線，10 秒內可 `resume`；過了對手收到 `opp_left` |
| `InputSilence`（10 s） | 比賽中「能送卻不送」10 秒＝離開。**卡在等對手輸入的那一方不算**（否則對手斷線時兩邊都會被判離開） |
| `EndWait`（10 s）、`IdleTimeout`（60 s，任何訊息都算）、`HelloTimeout`（10 s） | |
| `MaxMessageBytes`（1024） | 超過就關閉，代碼 1009（`rtc` 例外） |
| `MaxSignalBytes`（6144）、`MaxSignalsPerMatch`（40） | 直連擴充的 `rtc`：單則上限（也是 WebSocket 層的讀取上限）、每邊每場則數 |
| `Version`（1）、`MinVersion`（= `Version`） | 收的 `hello.v` 範圍 |
| `MaxMessagesPerSecond`（90） | 令牌桶：每秒補 90；空了回 `error rate_limited` 後關閉（1008） |
| `MaxBurstMessages`（= `MaxMessagesPerSecond`） | 令牌桶容量：一次能湧進幾則。網路卡一下（TCP 重傳、忙碌的代理）會把一兩秒的輸入一次送到；豬大旋風1 設 240（4 秒的輸入），持續速率仍是 90 |
| `MaxConnections`（2000）、`MaxConnsPerIP`（16，IP 取 `CF-Connecting-IP`，只在記憶體、不寫日誌）、`MaxRooms`（1000）、`SendBuffer`（每連線 256 則，塞滿＝讀太慢，關閉） | 記憶體有上限 |
| `AllowedOrigins` | 完全相同的 origin，或 `http://127.0.0.1:*` 這種任何埠；比對含 scheme；不在名單回 403（升級前）；沒有 `Origin` 也 403（`AllowNoOrigin` 可開） |

日誌（`log/slog`）：連線編號、洲、比賽 id、結果、延遲、關閉原因、每個連線前 5 個錯誤碼。**不記** IP、國家、玩家 id、暱稱、房間碼。暱稱最多 16 字，去掉控制字元與方向覆寫等格式字元。

## 架構

- 一把鎖管全部狀態（連線、佇列、房間、比賽）；JSON 解析在鎖外。送出只是放進每個連線自己的佇列，由那條連線的 writer goroutine 寫出，慢的客戶端不會卡住別人。
- 每條連線三個 goroutine：讀、寫、ping。
- 所有計時都在 `Tick()`，時間來自 `Config.Clock`：測試用假時鐘＋手動 `Tick()`，配對、逾時、寬限都能精確測到邊界。

## 測試（`go test ./matchrelay/...`，2026-11-25 全過，`-race` 也過）

假時鐘的單元測試：同洲立即配、異洲 9.75 秒不配 10 秒配、優先同洲、較久的一方放寬、20 秒逾時（`queued` 0..19 剛好 20 則，19.999 秒不逾時）、同一 `id` 永不自配、取消、斷線離開佇列；房間建立／加入（小寫也行）／滿／錯碼／自己的房／取消／房主斷線／5 分鐘過期；`InputDelay` 邊界表、量到的 RTT 與自報 RTT 算出的延遲；`ready`→`go`、轉送順序、跳號／重送／超範圍／缺欄位被拒且不轉送、領先上限；雜湊一致與不一致、雜湊驗證、負數雜湊；`end` 一致→`result`、勝者或格數不同→`desync`、對手不送 `end`→10 秒 `desync`；斷線 9.9 秒沒事、10 秒 `opp_left`；比賽中取消；「能送不送」與「卡著等」的區分；`ready` 逾時；`rematch`；結果後離開；`resume`（錯 key、補送對手輸入、之後雙向照常）；限速（第 91 則、每秒 61 則持續 10 秒不被擋）；閒置與 hello 逾時；hello 驗證；暱稱清理；ping／pong；連線上限；讀太慢被關；Origin 比對表；設定檢查；healthz；洲對照。

直連擴充（`p2p_test.go`，假時鐘）：`rtc` 只轉給同一場的對手（另一場、寄件人自己都收不到；別場的 id → `bad_state`）；`match` 前（大廳、佇列）→ `bad_state`、`match` 後到 `go` 前與比賽中轉送、`result` 後安靜丟掉、對手離開後 `bad_state`；一邊 `p2p:false` 或是 v1 → `match` 沒有 `p2p`、`rtc` 被拒、`ready` 帶直連也不改延遲；`d` 不是物件（沒有、字串、陣列、數字、null）→ `bad_message`；第 41 則 `rtc_limit` 不斷線、對手另有 40 則；5000 字的 `rtc` 照轉、1100 位元組的 `ping` 以 1009 關閉；`go.delay` 表（雙方 ok 取較大直連 RTT、極小 RTT → 2、只有一邊 ok、一邊沒帶、`ok` 是字串、沒 `rtt`、負的、不是物件 → 不變）、輸入從最終延遲開始驗證（舊延遲那格 `bad_input`）、續玩的 `next` 與補送也用最終延遲；直連 RTT 比中繼大時不超過 `match` 的延遲；v1 客戶端在 v2 伺服器上整場照舊（`welcome.v` 1、`match` 沒 `p2p`、`go.delay` 等於 `match.delay`、0 錯誤），v0／v3 被拒。

真 WebSocket（`httptest`）：Origin 403（壞的、http 版、沒帶）；1024 位元組可以、1025 被以 1009 關閉；直連擴充：剛好 6144 位元組的 `rtc` 轉送成功、`go.delay` 3（中繼 10）、6145 位元組以 1009 關閉；連發 120 則被 `rate_limited`＋1008；**兩個真用戶端**各自在每則訊息、每個方向加 0–40 ms 隨機延遲（不亂序），佇列→配對→ready→go→60 fps 打 600 格（每 60 格雜湊）→end→result，檢查兩邊收到的輸入和對方送的**逐筆相同、同順序**（600＋600 筆，延遲 3 格，約 10.1 秒，伺服器 0 錯誤 0 限速）；從房間進、一邊模擬一開始就不同 → 第 60 格 `desync`。

## 已知限制

- 只支援兩人（`PlayersPerMatch` 不是 2 會被拒）。
- 全部在記憶體：重啟伺服器，進行中的比賽、房間、佇列全部消失（客戶端會看到連線中斷）。
- 伺服器只有一台、在台灣：轉送繞經台灣，兩個離台灣都遠的玩家延遲大；延遲上限 10 格，RTT 超過約 150 ms 延遲就封頂，再大會開始卡（lockstep 等輸入）。直連擴充讓打得通的兩個人用直連的 RTT 定延遲；這個套件只做信令轉送與延遲，WebRTC 本身（STUN、DataChannel）在客戶端；沒有 TURN，打不通的照舊走伺服器。
- 直連擴充的 `ready.p2p.rtt` 是客戶端自報的，伺服器無法驗證：亂報只會讓那一場更卡，雙方延遲仍相同。
- 防作弊只到「兩邊要一致」：被改過的客戶端可以亂按，但改不了對手畫面上的結果；兩邊不一致時這場作廢，不判輸贏。沒有帳號、沒有排名。
- 斷線續玩（`resume`）只在頁面沒重新整理時有用：用戶端要保有自己的模擬狀態。
- 一把全域鎖：本機只跑過幾場（真的連線同時最多 2 個）；沒有做過大量連線的壓力測試。
