# server/authjwt：只用標準庫的 HS256 JWT

玩家 token：`sub`（玩家）、`op`（營運商）、`cur`（幣別）、`exp`（Unix 秒，0 表示不過期）。`Sign(claims, secret)`、`Verify(token, secret)`、`VerifyAt(token, secret, now)`。

拆自 <original-cascade-slot>（主題與美術未收）：`server/pkg/jwt`（token 格式相同）。加了：可指定時間的 `VerifyAt`（測過期）、檢查標頭 `alg` 是 HS256、空密鑰拒絕、錯誤值可比對（`ErrFormat`、`ErrSignature`、`ErrExpired`、`ErrSecret`）。簽章比對用 `hmac.Equal`（常數時間）。

```go
token, _ := authjwt.Sign(authjwt.Claims{UserID: "p1", OperatorID: "op", Currency: "DEMO", ExpiresAt: time.Now().Add(24 * time.Hour).Unix()}, secret)
claims, err := authjwt.Verify(token, secret)
```

驗證：`authjwt_test.go`（原遊戲沒有這個套件的測試）：往返、過期、錯密鑰、換掉內容、壞格式、不過期、空密鑰。

限制：只有 HS256（共用密鑰）；沒有 `iat`／`nbf`／`aud`、沒有撤銷清單；密鑰的保管與輪替是部署的事。
