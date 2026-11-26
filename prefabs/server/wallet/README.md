# server/wallet：無縫錢包接縫（記憶體版）

每位玩家一個餘額（整數單位）、下注／派彩／退注三種交易（同一個交易 id 重送不會重複扣或加，回當時的餘額）、每位玩家一把「正在轉」的鎖（防連點）。全部在記憶體：正式環境用營運商錢包 API 實作同一組方法。

拆自 <original-cascade-slot>（主題與美術未收）：`server/internal/wallet`。改了：`NewManager(initial)` 真的用這個起始餘額（原本忽略參數、一律 100000）；`Rollback(betTxID)` 只能退一筆**已記錄的下注**、退它記錄的金額、只退一次（原本任何金額都能「退」）；負數金額拒絕。

```go
w := wallet.NewManager(100000)
if !w.TryLockUser("p1") { /* 429 */ }
defer w.UnlockUser("p1")
after, err := w.Bet("p1", "r1", "tx_bet_r1", 10)   // wallet.ErrInsufficient
after, _ = w.Win("p1", "r1", "tx_win_r1", 204)
refund, _ := w.Rollback("tx_bet_r1")               // 一局失敗時；交易 id "rb_tx_bet_r1"
tx, ok := w.Tx("tx_bet_r1")
```

驗證：`wallet_test.go`——原遊戲的四個測試（基本、冪等、餘額不足、50 個 goroutine 同時下注派彩後餘額不變）照搬，加上起始餘額、退注、鎖。

限制：沒有持久化、沒有對帳報表、沒有幣別；交易紀錄只增不減（長時間執行會一直長大）。
