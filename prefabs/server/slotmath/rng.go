package slotmath

import (
	crand "crypto/rand"
	"math/big"
)

// RNG is the engine's only source of chance. IntN returns a uniform integer in
// [0, n); for n <= 0 it returns 0 (the same contract as the source game's
// SecureRandomInt). Every draw the engine makes goes through it, in a fixed
// order, so a seeded RNG replays a round exactly.
type RNG interface {
	IntN(n int) int
}

// CryptoRNG draws from crypto/rand. Use it in production.
type CryptoRNG struct{}

// IntN implements RNG. On a crypto/rand failure it returns 0, as the source did.
func (CryptoRNG) IntN(n int) int {
	if n <= 0 {
		return 0
	}
	v, err := crand.Int(crand.Reader, big.NewInt(int64(n)))
	if err != nil {
		return 0
	}
	return int(v.Int64())
}

// Mulberry32 is a small seeded generator. It is the same algorithm as
// createSeededRng in 2d/cascade-math/rng.ts, and IntN maps a draw to [0, n)
// the same way as randInt there (floor(x / 2^32 * n)), so a TypeScript client
// and this server replay the same round from the same seed. Use it for
// simulations, tests and replays, never for real-money rounds.
type Mulberry32 struct {
	state uint32
}

// NewMulberry32 returns a generator seeded with seed.
func NewMulberry32(seed uint32) *Mulberry32 {
	return &Mulberry32{state: seed}
}

// Next returns the next 32-bit output.
func (m *Mulberry32) Next() uint32 {
	m.state += 0x6d2b79f5
	t := m.state
	t = (t ^ (t >> 15)) * (t | 1)
	t ^= t + (t^(t>>7))*(t|61)
	return t ^ (t >> 14)
}

// IntN implements RNG: floor(Next() * n / 2^32), exact for n < 2^21.
func (m *Mulberry32) IntN(n int) int {
	if n <= 0 {
		return 0
	}
	return int((uint64(m.Next()) * uint64(n)) >> 32)
}
