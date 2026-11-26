// Package dungeongateway is Dungeon Spin's HTTP API over dungeonauthority:
// GET /api/health, GET /api/wallet?playerId=, POST /api/round {playerId, fixture, singleBet},
// GET /api/round/<id>; JSON everywhere, CORS *, no authentication.
// From games/dungeon-spin/server/internal/gateway, unchanged but for the package name.
package dungeongateway

import (
	"encoding/json"
	"net/http"
	"strings"

	authority "zhudagamecenter/commonprefabs/server/dungeonauthority"
)

type Server struct{ service *authority.Service }

func New(service *authority.Service) *Server { return &Server{service: service} }

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", s.health)
	mux.HandleFunc("/api/wallet", s.wallet)
	mux.HandleFunc("/api/round", s.round)
	mux.HandleFunc("/api/round/", s.getRound)
	return withJSON(mux)
}

func withJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func write(w http.ResponseWriter, status int, value any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		write(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	write(w, http.StatusOK, map[string]string{"status": "ok", "service": "dungeon-spin"})
}

func (s *Server) wallet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		write(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	player := r.URL.Query().Get("playerId")
	if player == "" {
		player = "guest"
	}
	write(w, http.StatusOK, s.service.Balance(player))
}

type roundRequest struct {
	PlayerID  string `json:"playerId"`
	Fixture   string `json:"fixture"`
	SingleBet int64  `json:"singleBet"`
}

func (s *Server) round(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		write(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req roundRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		write(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if req.PlayerID == "" {
		req.PlayerID = "guest"
	}
	if req.Fixture == "" {
		req.Fixture = "multi"
	}
	round, err := s.service.Play(req.PlayerID, req.Fixture, req.SingleBet)
	if err != nil {
		write(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	write(w, http.StatusOK, round)
}

func (s *Server) getRound(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		write(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/round/")
	round, ok := s.service.Round(id)
	if !ok {
		write(w, http.StatusNotFound, map[string]string{"error": "round not found"})
		return
	}
	write(w, http.StatusOK, round)
}
