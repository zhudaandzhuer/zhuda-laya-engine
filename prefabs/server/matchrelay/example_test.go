package matchrelay_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"

	"zhudagamecenter/commonprefabs/server/matchrelay"
)

// A game's server: one Config, two routes, Run for the timers (README sample).
func Example() {
	srv, err := matchrelay.New(matchrelay.Config{
		Service:        "zhuda-whirlwind",
		Stages:         []string{"livingroom", "backyard"},
		Chars:          []string{"zhuda", "zhuer"},
		AllowedOrigins: []string{"https://game.qianlongxundao.com", "http://127.0.0.1:*", "http://localhost:*"},
	})
	if err != nil {
		panic(err)
	}
	ctx, stop := context.WithCancel(context.Background()) // main: signal.NotifyContext
	defer stop()
	go srv.Run(ctx)

	mux := http.NewServeMux()
	mux.Handle("/games/zhuda-whirlwind/ws", srv.Handler())
	mux.Handle("/games/zhuda-whirlwind/healthz", srv.HealthHandler())
	// main: http.ListenAndServe("127.0.0.1:8796", mux)

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/games/zhuda-whirlwind/healthz", nil))
	var h matchrelay.Health
	_ = json.Unmarshal(rec.Body.Bytes(), &h)
	fmt.Println(rec.Code, h.OK, h.Service, h.V, h.Online, h.Queued, h.Matches)
	// Output: 200 true zhuda-whirlwind 1 0 0 0
}
