// Package slotgateway is the HTTP API of a slot server: health, a player's
// balance, a spin (lock the player → take the bet → play the round → pay the
// win → keep it for replay → answer with the round and the new balance) and a
// read-only replay. Players are identified by an HS256 bearer token
// (authjwt); a guest fallback and a token-issuing route exist for development
// only and are off by default.
//
// Split from <original-cascade-slot>/server/internal/gateway. Changes: the
// JWT secret, CORS origins, guest access and token issuing are options (the
// source hard-coded the secret, answered every origin with "*" and accepted
// any ?userId=); a failed round is rolled back; request bodies are limited;
// GET routes reject other methods.
package slotgateway

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"zhudagamecenter/commonprefabs/server/authjwt"
	"zhudagamecenter/commonprefabs/server/replay"
	"zhudagamecenter/commonprefabs/server/slotmath"
	"zhudagamecenter/commonprefabs/server/wallet"
)

// Options of a gateway. The zero value is a closed server: bearer tokens only
// (and none verify without a secret), no CORS headers, no token issuing.
type Options struct {
	JWTSecret string
	// AllowGuest lets a request without a valid token play as ?userId= or
	// "guest_player". Development only.
	AllowGuest bool
	// IssueTokens serves GET /api/auth/token?userId=. Development only.
	IssueTokens bool
	TokenTTL    time.Duration // default 24 h
	OperatorID  string
	Currency    string
	// AllowedOrigins get CORS headers ("*" is allowed only when listed).
	AllowedOrigins []string
	// Bets are the allowed bet units; empty allows any positive bet.
	Bets         []int
	MaxBodyBytes int64 // default 1 MiB
	// NewRoundID names a round; default rnd_<unix nano>_<user>.
	NewRoundID func(userID string) string
}

// SpinResponse is the answer to POST /api/spin.
type SpinResponse struct {
	Success bool            `json:"success"`
	Data    *slotmath.Round `json:"data,omitempty"`
	Balance int             `json:"balance"`
	Error   string          `json:"error,omitempty"`
}

// Server serves one engine.
type Server struct {
	engine   *slotmath.Engine
	engineMu sync.Mutex
	wallet   *wallet.Manager
	rounds   *replay.Store[*slotmath.Round]
	opts     Options
}

// New wires an engine, a wallet and a replay store.
func New(engine *slotmath.Engine, w *wallet.Manager, rounds *replay.Store[*slotmath.Round], opts Options) *Server {
	if opts.TokenTTL <= 0 {
		opts.TokenTTL = 24 * time.Hour
	}
	if opts.MaxBodyBytes <= 0 {
		opts.MaxBodyBytes = 1 << 20
	}
	if opts.NewRoundID == nil {
		opts.NewRoundID = func(user string) string { return fmt.Sprintf("rnd_%d_%s", time.Now().UnixNano(), user) }
	}
	return &Server{engine: engine, wallet: w, rounds: rounds, opts: opts}
}

// Register adds the routes to mux.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("/api/health", s.cors(s.get(s.health)))
	if s.opts.IssueTokens {
		mux.HandleFunc("/api/auth/token", s.cors(s.get(s.issueToken)))
	}
	mux.HandleFunc("/api/user/balance", s.cors(s.get(s.balance)))
	mux.HandleFunc("/api/spin", s.cors(s.spin))
	mux.HandleFunc("/api/replay", s.cors(s.get(s.replay)))
}

// Handler is a mux with only this server's routes.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	s.Register(mux)
	return mux
}

func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, status int, msg string, balance int) {
	write(w, status, SpinResponse{Success: false, Error: msg, Balance: balance})
}

func (s *Server) cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowed := ""
		if slices.Contains(s.opts.AllowedOrigins, "*") {
			allowed = "*"
		} else if origin != "" && slices.Contains(s.opts.AllowedOrigins, origin) {
			allowed = origin
			w.Header().Add("Vary", "Origin")
		}
		if allowed != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowed)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func (s *Server) get(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			fail(w, http.StatusMethodNotAllowed, "method not allowed", 0)
			return
		}
		next(w, r)
	}
}

// player returns the token's user, or the guest fallback when allowed.
func (s *Server) player(r *http.Request) (string, bool) {
	if token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer "); ok && s.opts.JWTSecret != "" {
		if claims, err := authjwt.Verify(token, s.opts.JWTSecret); err == nil && claims.UserID != "" {
			return claims.UserID, true
		}
	}
	if !s.opts.AllowGuest {
		return "", false
	}
	if q := r.URL.Query().Get("userId"); q != "" {
		return q, true
	}
	return "guest_player", true
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	write(w, http.StatusOK, map[string]any{"status": "UP", "service": s.engine.Config.GameID, "time": time.Now().Unix()})
}

func (s *Server) issueToken(w http.ResponseWriter, r *http.Request) {
	user := r.URL.Query().Get("userId")
	if user == "" {
		user = "test_player_01"
	}
	token, err := authjwt.Sign(authjwt.Claims{UserID: user, OperatorID: s.opts.OperatorID, Currency: s.opts.Currency, ExpiresAt: time.Now().Add(s.opts.TokenTTL).Unix()}, s.opts.JWTSecret)
	if err != nil {
		fail(w, http.StatusInternalServerError, err.Error(), 0)
		return
	}
	write(w, http.StatusOK, map[string]string{"token": token, "userId": user})
}

func (s *Server) balance(w http.ResponseWriter, r *http.Request) {
	user, ok := s.player(r)
	if !ok {
		fail(w, http.StatusUnauthorized, "unauthorized", 0)
		return
	}
	write(w, http.StatusOK, map[string]any{"userId": user, "balance": s.wallet.Balance(user)})
}

func (s *Server) play(req slotmath.SpinRequest, roundID string) (round *slotmath.Round, err error) {
	s.engineMu.Lock()
	defer s.engineMu.Unlock()
	defer func() {
		if p := recover(); p != nil {
			err = fmt.Errorf("round failed: %v", p)
		}
	}()
	return s.engine.Spin(req, roundID), nil
}

func (s *Server) spin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		fail(w, http.StatusMethodNotAllowed, "method not allowed", 0)
		return
	}
	user, ok := s.player(r)
	if !ok {
		fail(w, http.StatusUnauthorized, "unauthorized", 0)
		return
	}
	if !s.wallet.TryLockUser(user) {
		fail(w, http.StatusTooManyRequests, "Spin in progress, please wait", s.wallet.Balance(user))
		return
	}
	defer s.wallet.UnlockUser(user)

	var req slotmath.SpinRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, s.opts.MaxBodyBytes)).Decode(&req); err != nil {
		fail(w, http.StatusBadRequest, "invalid payload", s.wallet.Balance(user))
		return
	}
	singleBet, totalBet := s.engine.Config.Cost(req)
	if len(s.opts.Bets) > 0 && !slices.Contains(s.opts.Bets, singleBet) {
		fail(w, http.StatusBadRequest, "bet not allowed", s.wallet.Balance(user))
		return
	}
	req.BetAmount = singleBet

	roundID := s.opts.NewRoundID(user)
	betTx := "tx_bet_" + roundID
	after, err := s.wallet.Bet(user, roundID, betTx, totalBet)
	if err != nil {
		fail(w, http.StatusPaymentRequired, err.Error(), s.wallet.Balance(user))
		return
	}
	round, err := s.play(req, roundID)
	if err != nil {
		refunded, _ := s.wallet.Rollback(betTx)
		fail(w, http.StatusInternalServerError, err.Error(), refunded)
		return
	}
	if round.TotalWin > 0 {
		if after, err = s.wallet.Win(user, roundID, "tx_win_"+roundID, round.TotalWin); err != nil {
			fail(w, http.StatusInternalServerError, err.Error(), s.wallet.Balance(user))
			return
		}
	}
	s.rounds.Save(roundID, round)
	write(w, http.StatusOK, SpinResponse{Success: true, Data: round, Balance: after})
}

func (s *Server) replay(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		fail(w, http.StatusBadRequest, "missing round id", 0)
		return
	}
	round, err := s.rounds.Get(id)
	if err != nil {
		fail(w, http.StatusNotFound, "round not found", 0)
		return
	}
	write(w, http.StatusOK, round)
}
