// Command slotserver is the smallest complete slot server: slotmath's example
// config behind slotgateway, with the in-memory wallet and replay store.
//
//	SLOT_JWT_SECRET=dev-only-secret SLOT_DEV=1 go run ./cmd/slotserver
//	curl -s 'http://127.0.0.1:8088/api/auth/token?userId=p1'          # dev only
//	curl -s -X POST -H "Authorization: Bearer <token>" -d '{"betAmount":10}' http://127.0.0.1:8088/api/spin
//
// A game copies this file and passes its own Config. HOST defaults to
// 127.0.0.1 (not every interface); SLOT_DEV=1 turns on guest play, token
// issuing and CORS for any origin, which a real deployment never does.
package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"zhudagamecenter/commonprefabs/server/replay"
	"zhudagamecenter/commonprefabs/server/slotgateway"
	"zhudagamecenter/commonprefabs/server/slotmath"
	"zhudagamecenter/commonprefabs/server/wallet"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	secret := os.Getenv("SLOT_JWT_SECRET")
	if secret == "" {
		log.Fatal("SLOT_JWT_SECRET is required")
	}
	dev := os.Getenv("SLOT_DEV") == "1"
	engine, err := slotmath.New(slotmath.ExampleConfig(), slotmath.CryptoRNG{})
	if err != nil {
		log.Fatal(err)
	}
	opts := slotgateway.Options{JWTSecret: secret, Bets: []int{10, 20, 50, 100}, OperatorID: "local", Currency: "DEMO"}
	if dev {
		opts.AllowGuest, opts.IssueTokens, opts.AllowedOrigins = true, true, []string{"*"}
	} else if origins := os.Getenv("SLOT_ORIGINS"); origins != "" {
		opts.AllowedOrigins = strings.Split(origins, ",")
	}
	server := slotgateway.New(engine, wallet.NewManager(100000), replay.NewStore[*slotmath.Round](10000), opts)
	addr := env("HOST", "127.0.0.1") + ":" + env("PORT", "8088")
	log.Printf("slotserver %s on http://%s (dev=%v)", engine.Config.GameID, addr, dev)
	log.Fatal(http.ListenAndServe(addr, server.Handler()))
}
