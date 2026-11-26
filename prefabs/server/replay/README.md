# server/replay：已完成回合的重播存放

`replay.NewStore[T](limit)`：用回合 id 存、取（`Save`、`Get`、`Len`），`limit > 0` 時超過就忘掉最舊的。記憶體版；正式環境用持久儲存實作同樣兩個方法。

拆自 <original-cascade-slot>（主題與美術未收）：`server/internal/store`。改成泛型（任何回合型別），加了上限（原本永遠不刪，會一直長大）。

```go
rounds := replay.NewStore[*slotmath.Round](10000)
rounds.Save(round.RoundID, round)
r, err := rounds.Get(id) // replay.ErrNotFound
```

驗證：`replay_test.go`：取回、同 id 覆蓋保留位置、超過上限忘掉最舊、無上限。

限制：重啟就沒了；沒有依玩家查詢。
