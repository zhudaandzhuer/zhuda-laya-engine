package slotmath_test

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"
	"time"

	"zhudagamecenter/commonprefabs/server/slotmath"
)

// ParityRound is one line of testdata/parity.json: a seeded round of ExampleConfig and
// the SHA-256 of its canonical JSON (keys sorted, as encoding/json writes a map).
// tests/cascade-math.test.mjs plays the same rounds with 2d/cascade-math and must get
// the same digests, so the client engine and this server stay one algorithm.
type ParityRound struct {
	Seed     uint32               `json:"seed"`
	Request  slotmath.SpinRequest `json:"request"`
	TotalWin int                  `json:"totalWin"`
	Steps    int                  `json:"steps"`
	Free     int                  `json:"freeSpins"`
	Digest   string               `json:"sha256"`
}

func canonical(v any) []byte {
	raw, _ := json.Marshal(v)
	var generic any
	_ = json.Unmarshal(raw, &generic)
	out, _ := json.Marshal(generic) // maps marshal with sorted keys
	return out
}

func parityRounds() []ParityRound {
	var out []ParityRound
	for seed := uint32(1); seed <= 30; seed++ {
		for _, req := range []slotmath.SpinRequest{{BetAmount: 10}, {BetAmount: 20, AnteBet: true}, {BetAmount: 10, BuyFeature: true}} {
			e, _ := slotmath.New(slotmath.ExampleConfig(), slotmath.NewMulberry32(seed))
			e.Now = func() time.Time { return time.UnixMilli(0) }
			r := e.Spin(req, "parity")
			sum := sha256.Sum256(canonical(r))
			out = append(out, ParityRound{seed, req, r.TotalWin, len(r.Steps), r.FreeSpinsCount, hex.EncodeToString(sum[:])})
		}
	}
	return out
}

// SLOTMATH_UPDATE_PARITY=1 go test ./slotmath -run Parity rewrites the file after a deliberate change.
func TestParityFixture(t *testing.T) {
	got := parityRounds()
	data, _ := json.MarshalIndent(got, "", " ")
	if os.Getenv("SLOTMATH_UPDATE_PARITY") == "1" {
		if err := os.WriteFile("testdata/parity.json", append(data, '\n'), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	want, err := os.ReadFile("testdata/parity.json")
	if err != nil {
		t.Fatal(err)
	}
	if string(want) != string(append(data, '\n')) {
		t.Fatal("ExampleConfig rounds changed; if deliberate, update testdata/parity.json and check the TypeScript engine")
	}
}
