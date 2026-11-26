package matchrelay

import (
	"bytes"
	"encoding/json"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

// clientMsg is every client → server message; unused fields stay nil.
type clientMsg struct {
	T      string          `json:"t"`
	V      *int            `json:"v"`
	ID     string          `json:"id"`
	Name   string          `json:"name"`
	Char   *string         `json:"char"`
	Code   string          `json:"code"`
	Match  json.RawMessage `json:"match"`
	Key    string          `json:"key"`
	F      *int64          `json:"f"`
	B      *int64          `json:"b"`
	H      *int64          `json:"h"`
	Winner *int64          `json:"winner"`
	C      json.RawMessage `json:"c"`
	RTT    *float64        `json:"rtt"`
	// P2P is hello's "p2p": true (the client can open a direct WebRTC path)
	// or ready's "p2p": {"ok": true, "rtt": ms} (it did, measured so).
	P2P json.RawMessage `json:"p2p"`
	D   json.RawMessage `json:"d"` // rtc payload, forwarded as is
}

// helloP2P reports whether hello said "p2p": true.
func (m *clientMsg) helloP2P() bool { return string(bytes.TrimSpace(m.P2P)) == "true" }

// readyP2P reads ready's {"ok": true, "rtt": ms}; anything else is "not ok".
func (m *clientMsg) readyP2P() (ok bool, rtt float64) {
	var r struct {
		OK  bool     `json:"ok"`
		RTT *float64 `json:"rtt"`
	}
	if len(m.P2P) == 0 || json.Unmarshal(m.P2P, &r) != nil || !r.OK || r.RTT == nil || *r.RTT < 0 || *r.RTT > 10000 {
		return false, 0
	}
	return true, *r.RTT
}

// matchID returns the "match" field as a string (a JSON string or a bare scalar).
func (m *clientMsg) matchID() string {
	var s string
	if json.Unmarshal(m.Match, &s) == nil {
		return s
	}
	return strings.TrimSpace(string(m.Match))
}

// PlayerInfo is what a player sees of themselves and of the opponent.
type PlayerInfo struct {
	Name   string `json:"name"`
	Char   string `json:"char"`
	Region string `json:"region"`
}

type msgWelcome struct {
	T      string `json:"t"`
	V      int    `json:"v"`
	Region string `json:"region"`
	Online int    `json:"online"`
}

type msgMatch struct {
	T     string     `json:"t"`
	Match string     `json:"match"`
	Seed  uint32     `json:"seed"`
	Side  int        `json:"side"`
	Delay int        `json:"delay"`
	Stage string     `json:"stage"`
	You   PlayerInfo `json:"you"`
	Opp   PlayerInfo `json:"opp"`
	// Key is the resume secret of this side (extension; ignore if unused).
	Key string `json:"key"`
	// P2P: both players said hello with "p2p": true, so they may set up a
	// direct path with "rtc" messages (extension; absent otherwise).
	P2P bool `json:"p2p,omitempty"`
}

// msgGo starts the match; Delay is the input delay to play with: the match
// delay, or a smaller one when both sides reported a direct path in ready.
type msgGo struct {
	T     string `json:"t"`
	Match string `json:"match"`
	Delay int    `json:"delay"`
}

type msgResumed struct {
	T       string `json:"t"`
	Match   string `json:"match"`
	Side    int    `json:"side"`
	Next    int64  `json:"next"`
	Started bool   `json:"started"`
}

type msgError struct {
	T    string `json:"t"`
	Code string `json:"code"`
	Msg  string `json:"msg"`
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err) // only fixed structs of strings and numbers are marshalled
	}
	return b
}

func errMsg(code, msg string) []byte { return mustJSON(msgError{T: "error", Code: code, Msg: msg}) }

func simple(t string) []byte { return []byte(`{"t":"` + t + `"}`) }

func withInt(t, key string, v int64) []byte {
	b := append([]byte(`{"t":"`), t...)
	b = append(b, `","`...)
	b = append(b, key...)
	b = append(b, `":`...)
	b = strconv.AppendInt(b, v, 10)
	return append(b, '}')
}

func inputMsg(f int64, b byte) []byte {
	out := make([]byte, 0, 32)
	out = append(out, `{"t":"in","f":`...)
	out = strconv.AppendInt(out, f, 10)
	out = append(out, `,"b":`...)
	out = strconv.AppendInt(out, int64(b), 10)
	return append(out, '}')
}

// rtcMsg forwards a signaling payload (already checked to be a JSON object).
func rtcMsg(id string, d []byte) []byte {
	out := make([]byte, 0, len(d)+48)
	out = append(out, `{"t":"rtc","match":`...)
	out = append(out, mustJSON(id)...)
	out = append(out, `,"d":`...)
	out = append(out, d...)
	return append(out, '}')
}

// compactObject returns raw compacted when it is a JSON object, else nil.
func compactObject(raw json.RawMessage) []byte {
	raw = bytes.TrimSpace(raw)
	if len(raw) < 2 || raw[0] != '{' {
		return nil
	}
	var b bytes.Buffer
	if json.Compact(&b, raw) != nil {
		return nil
	}
	return b.Bytes()
}

func pongMsg(c json.RawMessage, serverMillis int64) []byte {
	out := append([]byte(`{"t":"pong","c":`), c...)
	out = append(out, `,"s":`...)
	out = strconv.AppendInt(out, serverMillis, 10)
	return append(out, '}')
}

// validNumber reports whether raw is a single JSON number (used to echo ping.c).
func validNumber(raw json.RawMessage) bool {
	if len(raw) == 0 || len(raw) > 32 {
		return false
	}
	var f float64
	return json.Unmarshal(raw, &f) == nil && raw[0] != '"'
}

// cleanName keeps at most max characters, dropping control and format
// characters (bidi overrides, zero-width) and folding other spaces to ' '.
func cleanName(s string, max int) string {
	var b strings.Builder
	n := 0
	for _, r := range strings.TrimSpace(s) {
		if n == max {
			break
		}
		if r == utf8.RuneError || unicode.IsControl(r) || unicode.Is(unicode.Cf, r) {
			continue
		}
		if unicode.IsSpace(r) {
			r = ' '
		}
		b.WriteRune(r)
		n++
	}
	return strings.TrimSpace(b.String())
}

// validID: 1–40 printable ASCII characters (the anonymous browser id).
func validID(s string) bool {
	if len(s) == 0 || len(s) > 40 {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < 0x21 || s[i] > 0x7e {
			return false
		}
	}
	return true
}

func validCharToken(s string) bool {
	if len(s) == 0 || len(s) > 16 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '_' || c == '-') {
			return false
		}
	}
	return true
}
