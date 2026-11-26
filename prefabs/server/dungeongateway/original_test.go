// The extracted packages answer exactly as the original games/dungeon-spin server did:
// testdata/original-dump.txt was written by this same program against the original
// internal/math, internal/authority and internal/gateway (2026-11-25, 316 lines, sha256
// 8f62167f…): every fixture at bets 10/20/50/11/0, a scripted play sequence with rejections
// and an empty wallet, balances, stored rounds and fifteen HTTP requests.
package dungeongateway_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"strings"
	"testing"

	authority "zhudagamecenter/commonprefabs/server/dungeonauthority"
	gateway "zhudagamecenter/commonprefabs/server/dungeongateway"
	gameMath "zhudagamecenter/commonprefabs/server/dungeonmath"
)

func show(v any, err error) string {
	if err != nil {
		return "ERR " + err.Error()
	}
	b, _ := json.Marshal(v)
	return string(b)
}

func dump(out *bytes.Buffer) {
	keys := []string{"three", "empty", "multi", "five", "four", "full", "group", "word", "boss", "allzero", "missing"}
	sort.Strings(keys)
	for _, k := range keys {
		for _, bet := range []int64{10, 20, 50, 11, 0} {
			r, err := gameMath.Resolve(k, bet)
			fmt.Fprintf(out, "resolve %s %d %s\n", k, bet, show(r, err))
		}
	}
	s := authority.NewService()
	script := []struct {
		p, f string
		b    int64
	}{{"p1", "three", 10}, {"p1", "multi", 20}, {"p2", "boss", 50}, {"p1", "allzero", 50}, {"", "three", 10}, {"p2", "nope", 10}, {"p2", "empty", 30}}
	for i := 0; i < 230; i++ {
		script = append(script, struct {
			p, f string
			b    int64
		}{"p3", "empty", 50})
	}
	for i, st := range script {
		r, err := s.Play(st.p, st.f, st.b)
		fmt.Fprintf(out, "play %d %s\n", i, show(r, err))
	}
	for _, p := range []string{"p1", "p2", "p3", "p4"} {
		fmt.Fprintf(out, "balance %s %s\n", p, show(s.Balance(p), nil))
	}
	for _, id := range []string{"p1-1", "p1-3", "p2-1", "p3-222", "p3-223", "zz"} {
		r, ok := s.Round(id)
		fmt.Fprintf(out, "round %s %v %s\n", id, ok, show(r, nil))
	}
	h := gateway.New(authority.NewService()).Handler()
	reqs := []struct{ m, u, body string }{
		{"GET", "/api/health", ""}, {"POST", "/api/health", ""}, {"GET", "/api/wallet", ""}, {"GET", "/api/wallet?playerId=a", ""},
		{"POST", "/api/round", `{"playerId":"a","fixture":"boss","singleBet":20}`}, {"POST", "/api/round", `{"singleBet":10}`},
		{"POST", "/api/round", `{"playerId":"a","fixture":"three","singleBet":7}`}, {"POST", "/api/round", `{nope`},
		{"GET", "/api/round", ""}, {"GET", "/api/round/a-1", ""}, {"GET", "/api/round/guest-1", ""}, {"GET", "/api/round/x", ""},
		{"OPTIONS", "/api/round", ""}, {"GET", "/api/wallet?playerId=a", ""}, {"GET", "/nope", ""},
	}
	for _, q := range reqs {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(q.m, q.u, strings.NewReader(q.body)))
		fmt.Fprintf(out, "http %s %s %d %q %q %s", q.m, q.u, w.Code, w.Header().Get("Content-Type"), w.Header().Get("Access-Control-Allow-Origin"), w.Body.String())
		_ = http.MethodGet
	}
}

func TestSameAnswersAsTheOriginalServer(t *testing.T) {
	var got bytes.Buffer
	dump(&got)
	want, err := os.ReadFile("testdata/original-dump.txt")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got.Bytes(), want) {
		gl, wl := bytes.Split(got.Bytes(), []byte("\n")), bytes.Split(want, []byte("\n"))
		for i := range wl {
			if i >= len(gl) || !bytes.Equal(gl[i], wl[i]) {
				t.Fatalf("line %d differs:\n got  %s\n want %s", i+1, line(gl, i), wl[i])
			}
		}
		t.Fatalf("output has %d lines, want %d", len(gl), len(wl))
	}
}

func line(lines [][]byte, i int) []byte {
	if i < len(lines) {
		return lines[i]
	}
	return nil
}
