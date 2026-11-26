package slotgateway_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"zhudagamecenter/commonprefabs/server/authjwt"
	"zhudagamecenter/commonprefabs/server/replay"
	"zhudagamecenter/commonprefabs/server/slotgateway"
	"zhudagamecenter/commonprefabs/server/slotmath"
	"zhudagamecenter/commonprefabs/server/wallet"
)

const secret = "test_secret_key_12345"

func setup(t *testing.T, opts slotgateway.Options) (http.Handler, *wallet.Manager) {
	t.Helper()
	e, err := slotmath.New(slotmath.ExampleConfig(), slotmath.NewMulberry32(5))
	if err != nil {
		t.Fatal(err)
	}
	opts.JWTSecret = secret
	w := wallet.NewManager(100000)
	return slotgateway.New(e, w, replay.NewStore[*slotmath.Round](100), opts).Handler(), w
}

func do(h http.Handler, method, url, body string, header map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, url, strings.NewReader(body))
	for k, v := range header {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// Ported from the source's TestGateway_Health.
func TestHealth(t *testing.T) {
	h, _ := setup(t, slotgateway.Options{})
	rec := do(h, "GET", "/api/health", "", nil)
	var res map[string]any
	if rec.Code != 200 || json.NewDecoder(rec.Body).Decode(&res) != nil || res["status"] != "UP" || res["service"] != "cascade-example" {
		t.Fatalf("health %d %v", rec.Code, res)
	}
	if do(h, "POST", "/api/health", "", nil).Code != http.StatusMethodNotAllowed {
		t.Fatal("POST /api/health accepted")
	}
}

// Ported from TestGateway_SpinFlowAndReplay (the source let ?userId= play; here that is AllowGuest).
func TestSpinFlowAndReplay(t *testing.T) {
	h, w := setup(t, slotgateway.Options{AllowGuest: true})
	body, _ := json.Marshal(slotmath.SpinRequest{BetAmount: 20})
	rec := do(h, "POST", "/api/spin?userId=player_test_gw", string(body), map[string]string{"Content-Type": "application/json"})
	var spin slotgateway.SpinResponse
	if rec.Code != 200 || json.NewDecoder(rec.Body).Decode(&spin) != nil || !spin.Success || spin.Data == nil {
		t.Fatalf("spin %d %s", rec.Code, rec.Body.String())
	}
	if len(spin.Data.Grid) != 30 || len(spin.Data.Steps) == 0 || spin.Data.RoundID == "" {
		t.Fatalf("round %+v", spin.Data)
	}
	if spin.Balance != 100000-20+spin.Data.TotalWin || w.Balance("player_test_gw") != spin.Balance {
		t.Fatalf("balance %d, round won %d", spin.Balance, spin.Data.TotalWin)
	}
	rep := do(h, "GET", "/api/replay?id="+spin.Data.RoundID, "", nil)
	var again slotmath.Round
	if rep.Code != 200 || json.NewDecoder(rep.Body).Decode(&again) != nil || again.RoundID != spin.Data.RoundID || again.TotalWin != spin.Data.TotalWin {
		t.Fatalf("replay %d", rep.Code)
	}
	if do(h, "GET", "/api/replay?id=nope", "", nil).Code != 404 || do(h, "GET", "/api/replay", "", nil).Code != 400 {
		t.Fatal("bad replay ids")
	}
}

func TestPlayersNeedATokenUnlessGuestsAreAllowed(t *testing.T) {
	h, w := setup(t, slotgateway.Options{})
	if rec := do(h, "POST", "/api/spin?userId=p", `{"betAmount":10}`, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("no token: %d", rec.Code)
	}
	if do(h, "GET", "/api/auth/token", "", nil).Code != 404 {
		t.Fatal("token issuing is on by default")
	}
	token, _ := authjwt.Sign(authjwt.Claims{UserID: "p9"}, secret)
	var spin slotgateway.SpinResponse
	rec := do(h, "POST", "/api/spin", `{"betAmount":10}`, map[string]string{"Authorization": "Bearer " + token})
	if rec.Code != 200 || json.NewDecoder(rec.Body).Decode(&spin) != nil || spin.Balance != 100000-10+spin.Data.TotalWin || w.Balance("p9") != spin.Balance {
		t.Fatalf("token spin %d %+v", rec.Code, spin)
	}
	bad, _ := authjwt.Sign(authjwt.Claims{UserID: "p9"}, "another")
	if do(h, "GET", "/api/user/balance", "", map[string]string{"Authorization": "Bearer " + bad}).Code != 401 {
		t.Fatal("a token of another secret was accepted")
	}
}

func TestDevTokensAndBalance(t *testing.T) {
	h, _ := setup(t, slotgateway.Options{IssueTokens: true})
	var tok map[string]string
	json.NewDecoder(do(h, "GET", "/api/auth/token?userId=dev1", "", nil).Body).Decode(&tok)
	rec := do(h, "GET", "/api/user/balance", "", map[string]string{"Authorization": "Bearer " + tok["token"]})
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"userId":"dev1"`) || !strings.Contains(rec.Body.String(), `"balance":100000`) {
		t.Fatalf("balance %d %s", rec.Code, rec.Body.String())
	}
}

func TestBetsCostsAndRefusals(t *testing.T) {
	h, w := setup(t, slotgateway.Options{AllowGuest: true, Bets: []int{10, 20}})
	if rec := do(h, "POST", "/api/spin?userId=a", `{"betAmount":15}`, nil); rec.Code != 400 || w.Balance("a") != 100000 {
		t.Fatalf("bet 15: %d", rec.Code)
	}
	if rec := do(h, "POST", "/api/spin?userId=a", `{bad json`, nil); rec.Code != 400 {
		t.Fatalf("bad json: %d", rec.Code)
	}
	if rec := do(h, "GET", "/api/spin?userId=a", "", nil); rec.Code != 405 {
		t.Fatalf("GET spin: %d", rec.Code)
	}
	var spin slotgateway.SpinResponse
	json.NewDecoder(do(h, "POST", "/api/spin?userId=b", `{"betAmount":10,"buyFeature":true}`, nil).Body).Decode(&spin)
	if !spin.Success || spin.Data.TotalBet != 800 || !spin.Data.FreeSpinTriggered || spin.Balance != 100000-800+spin.Data.TotalWin {
		t.Fatalf("buy: %+v", spin)
	}
	poor := wallet.NewManager(5)
	e, _ := slotmath.New(slotmath.ExampleConfig(), slotmath.NewMulberry32(1))
	h2 := slotgateway.New(e, poor, replay.NewStore[*slotmath.Round](0), slotgateway.Options{JWTSecret: secret, AllowGuest: true}).Handler()
	if rec := do(h2, "POST", "/api/spin?userId=c", `{"betAmount":10}`, nil); rec.Code != http.StatusPaymentRequired || poor.Balance("c") != 5 {
		t.Fatalf("insufficient: %d", rec.Code)
	}
}

func TestCORSIsClosedUnlessListed(t *testing.T) {
	h, _ := setup(t, slotgateway.Options{})
	if got := do(h, "GET", "/api/health", "", map[string]string{"Origin": "https://evil.example"}).Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("closed server answered CORS %q", got)
	}
	h2, _ := setup(t, slotgateway.Options{AllowedOrigins: []string{"https://shell.example"}})
	if got := do(h2, "GET", "/api/health", "", map[string]string{"Origin": "https://shell.example"}).Header().Get("Access-Control-Allow-Origin"); got != "https://shell.example" {
		t.Fatalf("listed origin got %q", got)
	}
	if got := do(h2, "OPTIONS", "/api/spin", "", map[string]string{"Origin": "https://other.example"}); got.Code != 204 || got.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("preflight of an unlisted origin")
	}
}

func TestASpinInProgressBlocksTheSamePlayer(t *testing.T) {
	e, _ := slotmath.New(slotmath.ExampleConfig(), slotmath.NewMulberry32(1))
	w := wallet.NewManager(1000)
	h := slotgateway.New(e, w, replay.NewStore[*slotmath.Round](0), slotgateway.Options{JWTSecret: secret, AllowGuest: true}).Handler()
	w.TryLockUser("busy")
	req := httptest.NewRequest("POST", "/api/spin?userId=busy", bytes.NewReader([]byte(`{"betAmount":10}`)))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests || w.Balance("busy") != 1000 {
		t.Fatalf("locked player: %d", rec.Code)
	}
}

func TestAFailedRoundIsRolledBack(t *testing.T) {
	e, _ := slotmath.New(slotmath.ExampleConfig(), slotmath.NewMulberry32(1))
	for c := range e.Config.BaseReels {
		e.Config.BaseReels[c] = []int{1, 1, 1, 1, 1} // every spin pays and cascades
	}
	e.Config.RefillReels[0] = nil // and the refill of column 0 then fails
	w := wallet.NewManager(1000)
	opts := slotgateway.Options{JWTSecret: secret, AllowGuest: true, NewRoundID: func(string) string { return "R1" }}
	h := slotgateway.New(e, w, replay.NewStore[*slotmath.Round](0), opts).Handler()
	rec := do(h, "POST", "/api/spin?userId=x", `{"betAmount":10}`, nil)
	if rec.Code != 500 || w.Balance("x") != 1000 {
		t.Fatalf("failed round: %d, balance %d", rec.Code, w.Balance("x"))
	}
	if tx, ok := w.Tx("rb_tx_bet_R1"); !ok || tx.Amount != 10 {
		t.Fatalf("rollback record %+v", tx)
	}
	if !w.TryLockUser("x") {
		t.Fatal("the spin lock was not released")
	}
}
