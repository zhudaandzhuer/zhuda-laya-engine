// Command dungeonserver runs the Dungeon Spin API on HOST:PORT (default 127.0.0.1:8790):
//
//	cd prefabs/server && go run ./dungeonserver
//
// From games/dungeon-spin/server/cmd/server, unchanged but for the imports.
package main

import (
	"log"
	"net/http"
	"os"

	authority "zhudagamecenter/commonprefabs/server/dungeonauthority"
	gateway "zhudagamecenter/commonprefabs/server/dungeongateway"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8790"
	}
	host := os.Getenv("HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	server := gateway.New(authority.NewService())
	log.Printf("Dungeon Spin server listening on %s:%s", host, port)
	log.Fatal(http.ListenAndServe(host+":"+port, server.Handler()))
}
