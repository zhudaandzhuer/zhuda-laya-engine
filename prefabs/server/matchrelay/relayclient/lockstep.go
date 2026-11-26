package relayclient

import (
	"context"
	"time"
)

// Game is the deterministic simulation a bot plays. Both sides must compute
// the same state from the same [side0, side1] inputs.
type Game interface {
	// Input is this side's keys (0–63) sampled at local frame f; they are sent
	// for frame f+delay.
	Input(f int) byte
	// Step advances frame f with the inputs of side 0 and side 1.
	Step(f int, in [2]byte)
	// Hash is the state after the last Step.
	Hash() uint32
	// Over reports, after Step(f), whether the match ended at f and who won
	// (0, 1, or -1 for a draw).
	Over(f int) (bool, int)
}

// PlayOptions of one lockstep match.
type PlayOptions struct {
	FrameRate    int  // frames per second; 0 runs as fast as lockstep allows
	HashInterval int  // send a hash every N frames (default 60)
	ReportRTT    bool // add the measured "rtt" (ms) to pings (protocol extension)
	NoHash       bool // send no hashes (to play against a different simulation)
	Record       bool // keep every sent and received input in the Result
}

// Input is one relayed input.
type Input struct {
	F int64
	B byte
}

// Result of Play.
type Result struct {
	Match    string
	Side     int
	Delay    int
	Stage    string
	Seed     uint32
	Frames   int           // frames simulated
	Stalls   int           // frames whose opponent input had not arrived yet
	Waited   time.Duration // total time spent waiting for opponent inputs
	Outcome  string        // result, desync, opp_left, closed
	Winner   int           // with result
	DesyncAt int64         // with desync
	Errors   []string
	Sent     []Input // with Record
	Received []Input // with Record, in arrival order
	RTT      time.Duration
	Elapsed  time.Duration // from go to the outcome
}

// Play sends ready for the match message m, waits for go, and runs the
// lockstep loop until the server sends result, desync or opp_left.
func (c *Client) Play(ctx context.Context, m Msg, g Game, o PlayOptions) (Result, error) {
	if o.HashInterval <= 0 {
		o.HashInterval = 60
	}
	res := Result{Match: m.Match, Side: m.Side, Delay: m.Delay, Stage: m.Stage, Seed: m.Seed}
	side, delay := m.Side, m.Delay
	opp := make(map[int64]byte)
	own := make(map[int64]byte)
	var start time.Time
	ms := func() float64 { return float64(time.Since(start).Microseconds()) / 1000 }

	// handle returns true when the match is over for this client.
	handle := func(x Msg) bool {
		switch x.T {
		case "in":
			opp[x.F] = byte(x.B)
			if o.Record {
				res.Received = append(res.Received, Input{x.F, byte(x.B)})
			}
		case "pong":
			if !start.IsZero() {
				res.RTT = time.Duration((ms() - x.C) * float64(time.Millisecond))
			}
		case "result":
			res.Outcome, res.Winner = "result", x.Winner
			return true
		case "desync":
			res.Outcome, res.DesyncAt = "desync", x.F
			return true
		case "opp_left":
			res.Outcome = "opp_left"
			return true
		case "error":
			res.Errors = append(res.Errors, x.Code+": "+x.Msg)
			if x.Code != "bad_input" {
				res.Outcome = "error " + x.Code
				return true
			}
		}
		return false
	}
	finish := func(err error) (Result, error) {
		if !start.IsZero() {
			res.Elapsed = time.Since(start)
		}
		if err != nil && res.Outcome == "" {
			res.Outcome = "closed"
		}
		return res, err
	}

	if err := c.Send(map[string]any{"t": "ready", "match": m.Match}); err != nil {
		return finish(err)
	}
	for {
		x, err := c.Recv(ctx)
		if err != nil {
			return finish(err)
		}
		if x.T == "go" {
			break
		}
		if handle(x) {
			return finish(nil)
		}
	}
	start = time.Now()

	var tick <-chan time.Time
	if o.FrameRate > 0 {
		t := time.NewTicker(time.Second / time.Duration(o.FrameRate))
		defer t.Stop()
		tick = t.C
	}
	nextPing := time.Now()
	for f := 0; ; f++ {
		if tick != nil {
			select {
			case <-tick:
			case <-ctx.Done():
				return finish(ctx.Err())
			}
		}
		b := g.Input(f) & 63
		own[int64(f+delay)] = b
		if err := c.Send(map[string]any{"t": "in", "f": f + delay, "b": b}); err != nil {
			return finish(err)
		}
		if o.Record {
			res.Sent = append(res.Sent, Input{int64(f + delay), b})
		}
		var ob byte
		if f >= delay {
			v, ok := opp[int64(f)]
			if !ok {
				res.Stalls++
				t0 := time.Now()
				for !ok {
					x, err := c.Recv(ctx)
					if err != nil {
						return finish(err)
					}
					if handle(x) {
						return finish(nil)
					}
					v, ok = opp[int64(f)]
				}
				res.Waited += time.Since(t0)
			}
			ob = v
		}
	drain:
		for {
			select {
			case x, ok := <-c.inbox:
				if !ok {
					return finish(c.Err())
				}
				if handle(x) {
					return finish(nil)
				}
			default:
				break drain
			}
		}
		var in [2]byte
		in[side] = own[int64(f)]
		in[1-side] = ob
		delete(own, int64(f))
		delete(opp, int64(f))
		g.Step(f, in)
		res.Frames = f + 1
		if !o.NoHash && f > 0 && f%o.HashInterval == 0 {
			if err := c.Send(map[string]any{"t": "hash", "f": f, "h": g.Hash()}); err != nil {
				return finish(err)
			}
		}
		if over, w := g.Over(f); over {
			if err := c.Send(map[string]any{"t": "end", "f": f, "winner": w}); err != nil {
				return finish(err)
			}
			break
		}
		if time.Now().After(nextPing) {
			p := map[string]any{"t": "ping", "c": ms()}
			if o.ReportRTT && res.RTT > 0 {
				p["rtt"] = float64(res.RTT.Microseconds()) / 1000
			}
			if err := c.Send(p); err != nil {
				return finish(err)
			}
			nextPing = time.Now().Add(2 * time.Second)
		}
	}
	for {
		x, err := c.Recv(ctx)
		if err != nil {
			return finish(err)
		}
		if handle(x) {
			return finish(nil)
		}
	}
}
