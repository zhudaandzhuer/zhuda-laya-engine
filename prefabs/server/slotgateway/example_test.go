package slotgateway_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"

	"zhudagamecenter/commonprefabs/server/authjwt"
	"zhudagamecenter/commonprefabs/server/replay"
	"zhudagamecenter/commonprefabs/server/slotgateway"
	"zhudagamecenter/commonprefabs/server/slotmath"
	"zhudagamecenter/commonprefabs/server/wallet"
)

// The whole server: engine + wallet + replay store behind the gateway (README sample).
func Example() {
	engine, err := slotmath.New(slotmath.ExampleConfig(), slotmath.NewMulberry32(168)) // production: slotmath.CryptoRNG{}
	if err != nil {
		panic(err)
	}
	server := slotgateway.New(engine, wallet.NewManager(100000), replay.NewStore[*slotmath.Round](10000),
		slotgateway.Options{JWTSecret: "from-your-secret-store", Bets: []int{10, 20, 50, 100}})
	mux := http.NewServeMux()
	server.Register(mux) // or http.ListenAndServe("127.0.0.1:8088", server.Handler())

	token, _ := authjwt.Sign(authjwt.Claims{UserID: "p1", ExpiresAt: 0}, "from-your-secret-store")
	req := httptest.NewRequest("POST", "/api/spin", strings.NewReader(`{"betAmount":10}`))
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	fmt.Println(rec.Code, strings.Contains(rec.Body.String(), `"success":true`))
	// Output: 200 true
}
