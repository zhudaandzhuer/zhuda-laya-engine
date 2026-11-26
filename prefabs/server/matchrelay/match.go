package matchrelay

import (
	"crypto/subtle"
	"fmt"
	"time"

	"github.com/coder/websocket"
)

type matchState int

const (
	mWaitReady matchState = iota // "match" sent, waiting for both "ready"
	mPlaying                     // "go" sent, relaying inputs
	mEnded                       // result or desync sent; rematch possible
)

type hashReport struct {
	f int64
	h uint32
}

type endReport struct {
	f, winner int64
	at        time.Time
}

type match struct {
	id    string
	seed  uint32
	stage string
	delay int    // input delay; from go on the final one (go.delay)
	kind  string // queue, room, rematch

	// Direct path (extension): p2p when both said hello with "p2p": true;
	// relayDelay is the delay of the match message; ready reports whether a
	// direct path works and its round trip.
	p2p        bool
	relayDelay int
	signals    [2]int
	p2pOK      [2]bool
	p2pRTT     [2]time.Duration

	p    [2]*session // nil while disconnected (grace) or after leaving
	info [2]PlayerInfo
	key  [2]string // resume secrets

	state     matchState
	gone      bool // dissolved
	createdAt time.Time
	goAt      time.Time
	ready     [2]bool
	next      [2]int64     // next input frame expected from each side
	quietFrom [2]time.Time // silence is measured from here (last input or unblock)
	ring      [2][]byte    // last ResumeFrames inputs of each side
	lastHash  [2]int64
	pending   [2][]hashReport
	end       [2]*endReport
	goneAt    [2]time.Time
	rematch   [2]bool
}

func (s *Server) startMatchLocked(p [2]*session, now time.Time, kind string) {
	if s.randBytes(1)[0]&1 == 1 {
		p[0], p[1] = p[1], p[0]
	}
	id := s.randHex(8)
	for s.matches[id] != nil {
		id = s.randHex(8)
	}
	m := &match{
		id:        id,
		seed:      s.randUint32(),
		stage:     s.cfg.Stages[int(s.randUint32()%uint32(len(s.cfg.Stages)))],
		delay:     s.delayLocked(p[0], p[1]),
		kind:      kind,
		createdAt: now,
		p2p:       p[0].p2p && p[1].p2p,
	}
	m.relayDelay = m.delay
	for i, pl := range p {
		m.p[i] = pl
		m.info[i] = PlayerInfo{Name: pl.name, Char: pl.char, Region: pl.region}
		m.key[i] = s.randHex(16)
		pl.state = stMatch
		pl.match = m
		pl.side = i
		pl.room = nil
	}
	s.matches[id] = m
	s.totals.Matches++
	s.log.Info("match", "match", id, "kind", kind, "regions", [2]string{p[0].region, p[1].region},
		"delay", m.delay, "stage", m.stage, "p2p", m.p2p)
	for i, pl := range p {
		s.sendLocked(pl, mustJSON(msgMatch{T: "match", Match: id, Seed: m.seed, Side: i, Delay: m.delay,
			Stage: m.stage, You: m.info[i], Opp: m.info[1-i], Key: m.key[i], P2P: m.p2p}))
	}
}

// delayLocked: InputDelay of the larger measured RTT; DefaultDelay when
// nothing is measured, and at least DefaultDelay when only one side is.
func (s *Server) delayLocked(a, b *session) int {
	ra, okA := a.rtt()
	rb, okB := b.rtt()
	if !okA && !okB {
		return s.cfg.DefaultDelay
	}
	d := InputDelay(max(ra, rb), s.cfg.FrameRate, s.cfg.MinDelay, s.cfg.MaxDelay)
	if !okA || !okB {
		d = max(d, s.cfg.DefaultDelay)
	}
	return d
}

// dissolveLocked removes a match; its players go back to the lobby.
func (s *Server) dissolveLocked(m *match) {
	if m.gone {
		return
	}
	m.gone = true
	delete(s.matches, m.id)
	for i, pl := range m.p {
		if pl != nil && pl.match == m {
			pl.match = nil
			pl.state = stLobby
		}
		m.p[i] = nil
	}
}

// leaveMatchLocked: side leaves (cancel, disconnect past grace, silence,
// ready timeout). The other player gets opp_left and the match is gone.
func (s *Server) leaveMatchLocked(m *match, side int, why string, now time.Time) {
	other := m.p[1-side]
	if m.state != mEnded {
		s.totals.OppLeft++
		s.log.Info("match_end", "match", m.id, "outcome", "opp_left", "why", why,
			"frames", max(m.next[0], m.next[1]), "secs", int(now.Sub(m.createdAt).Seconds()))
	}
	s.dissolveLocked(m)
	s.sendLocked(other, simple("opp_left"))
}

// finishLocked ends a running match with a result or a desync (void).
func (s *Server) finishLocked(m *match, outcome string, f, winner int64, now time.Time) {
	m.state = mEnded
	m.rematch = [2]bool{}
	var msg []byte
	if outcome == "result" {
		s.totals.Results++
		msg = withInt("result", "winner", winner)
	} else {
		s.totals.Desyncs++
		msg = withInt("desync", "f", f)
	}
	s.log.Info("match_end", "match", m.id, "outcome", outcome, "f", f,
		"secs", int(now.Sub(m.createdAt).Seconds()))
	ps := m.p
	for _, pl := range ps {
		s.sendLocked(pl, msg)
	}
	for side, pl := range m.p {
		if pl == nil && !m.gone {
			s.leaveMatchLocked(m, side, "disconnected", now)
			break
		}
	}
}

// goLocked starts the match. When both sides reported a working direct path,
// the input delay comes from the larger direct round trip (same formula, never
// above the match delay); inputs are validated against this final delay.
func (s *Server) goLocked(m *match, now time.Time) {
	m.state = mPlaying
	m.goAt = now
	if m.p2p && m.p2pOK[0] && m.p2pOK[1] {
		d := InputDelay(max(m.p2pRTT[0], m.p2pRTT[1]), s.cfg.FrameRate, s.cfg.MinDelay, s.cfg.MaxDelay)
		m.delay = min(m.relayDelay, d)
		s.totals.Direct++
	}
	for i := range 2 {
		m.next[i] = int64(m.delay)
		m.quietFrom[i] = now
		m.ring[i] = make([]byte, s.cfg.ResumeFrames)
	}
	s.log.Info("go", "match", m.id, "delay", m.delay, "relayDelay", m.relayDelay, "p2p", m.p2pOK)
	msg := mustJSON(msgGo{T: "go", Match: m.id, Delay: m.delay})
	for _, pl := range m.p {
		s.sendLocked(pl, msg)
	}
}

func (s *Server) onReady(sess *session, cm *clientMsg, now time.Time) {
	m := sess.match
	if sess.state != stMatch || m == nil || cm.matchID() != m.id {
		s.errorLocked(sess, "bad_state", "not in that match")
		return
	}
	switch m.state {
	case mWaitReady:
		m.ready[sess.side] = true
		if m.p2p {
			ok, rtt := cm.readyP2P()
			m.p2pOK[sess.side] = ok
			m.p2pRTT[sess.side] = time.Duration(rtt * float64(time.Millisecond))
		}
		if m.ready[0] && m.ready[1] && m.p[0] != nil && m.p[1] != nil {
			s.goLocked(m, now)
		}
	case mPlaying: // repeated ready (e.g. after a resume): nothing to do
	default:
		s.errorLocked(sess, "bad_state", "match is over")
	}
}

func (s *Server) onInput(sess *session, cm *clientMsg, now time.Time) {
	m := sess.match
	if m == nil {
		return // late message after the match was dissolved (opp_left, cancel)
	}
	side, opp := sess.side, 1-sess.side
	if m.state == mEnded || (m.state == mPlaying && m.end[side] != nil) {
		return // late inputs after the end are dropped quietly
	}
	if m.state != mPlaying {
		s.errorLocked(sess, "bad_state", "wait for go")
		return
	}
	if cm.F == nil || cm.B == nil {
		s.errorLocked(sess, "bad_input", "f and b are required")
		return
	}
	f, b := *cm.F, *cm.B
	if b < 0 || b > 63 {
		s.errorLocked(sess, "bad_input", "b must be 0-63")
		return
	}
	if want := m.next[side]; f != want {
		if f < want {
			s.errorLocked(sess, "bad_input", fmt.Sprintf("frame %d already sent; next is %d", f, want))
		} else {
			s.errorLocked(sess, "bad_input", fmt.Sprintf("gap: next frame is %d", want))
		}
		return
	}
	if f >= m.next[opp]+int64(s.cfg.MaxLeadFrames) {
		s.errorLocked(sess, "bad_input", "too far ahead of the opponent")
		return
	}
	if f >= int64(s.cfg.MaxFrames) {
		s.finishLocked(m, "void", f, 0, now)
		return
	}
	oppWasBlocked := m.next[opp] >= m.next[side]+int64(m.delay)
	m.next[side] = f + 1
	m.quietFrom[side] = now
	if oppWasBlocked {
		m.quietFrom[opp] = now
	}
	m.ring[side][f%int64(len(m.ring[side]))] = byte(b)
	s.sendLocked(m.p[opp], inputMsg(f, byte(b)))
}

func (s *Server) onHash(sess *session, cm *clientMsg) {
	m := sess.match
	if m == nil {
		return // late message after the match was dissolved (opp_left, cancel)
	}
	if m.state == mEnded {
		return
	}
	if m.state != mPlaying {
		s.errorLocked(sess, "bad_state", "wait for go")
		return
	}
	side, opp := sess.side, 1-sess.side
	if cm.F == nil || cm.H == nil {
		s.errorLocked(sess, "bad_input", "f and h are required")
		return
	}
	f, h := *cm.F, *cm.H
	if h < -(1<<31) || h > 0xFFFFFFFF {
		s.errorLocked(sess, "bad_input", "h must be a uint32")
		return
	}
	if want := m.lastHash[side] + int64(s.cfg.HashInterval); f != want {
		s.errorLocked(sess, "bad_input", fmt.Sprintf("next hash is for frame %d", want))
		return
	}
	if f >= m.next[side] {
		s.errorLocked(sess, "bad_input", "hash for a frame you have not sent input for")
		return
	}
	hv := uint32(h) // a signed 32-bit value from JS (h|0) maps to the same uint32
	for i, r := range m.pending[opp] {
		if r.f == f {
			m.pending[opp] = append(m.pending[opp][:i], m.pending[opp][i+1:]...)
			m.lastHash[side] = f
			if r.h != hv {
				s.finishLocked(m, "desync", f, 0, s.cfg.Clock.Now())
			}
			return
		}
	}
	if len(m.pending[side]) >= 16 {
		// The opponent sends no hashes (the lead bound keeps an honest one
		// within a few): forget the oldest instead of growing.
		m.pending[side] = m.pending[side][1:]
	}
	m.lastHash[side] = f
	m.pending[side] = append(m.pending[side], hashReport{f, hv})
}

func (s *Server) onEnd(sess *session, cm *clientMsg, now time.Time) {
	m := sess.match
	if m == nil {
		return // late message after the match was dissolved (opp_left, cancel)
	}
	if m.state == mEnded {
		return
	}
	if m.state != mPlaying {
		s.errorLocked(sess, "bad_state", "wait for go")
		return
	}
	side, opp := sess.side, 1-sess.side
	if m.end[side] != nil {
		return
	}
	if cm.F == nil || cm.Winner == nil || *cm.Winner < -1 || *cm.Winner > 1 {
		s.errorLocked(sess, "bad_input", "end needs f and winner -1, 0 or 1")
		return
	}
	f, w := *cm.F, *cm.Winner
	if f < 0 || f >= m.next[side] || f < m.lastHash[side] {
		s.errorLocked(sess, "bad_input", "end frame out of range")
		return
	}
	m.end[side] = &endReport{f: f, winner: w, at: now}
	if e := m.end[opp]; e != nil {
		if e.f == f && e.winner == w {
			s.finishLocked(m, "result", f, w, now)
		} else {
			s.finishLocked(m, "desync", min(e.f, f), 0, now)
		}
	}
}

// onRTC forwards a WebRTC signaling payload (SDP or one ICE candidate) to the
// opponent of the same match, from "match" until the match ends, when both
// players said hello with "p2p": true (extension). The payload must be a JSON
// object; it is forwarded as is: {"t":"rtc","match":id,"d":{...}}.
func (s *Server) onRTC(sess *session, cm *clientMsg) {
	m := sess.match
	if sess.state != stMatch || m == nil || cm.matchID() != m.id {
		s.errorLocked(sess, "bad_state", "not in that match")
		return
	}
	if !m.p2p {
		s.errorLocked(sess, "bad_state", "no direct path in this match")
		return
	}
	if m.state == mEnded {
		return // late candidates after the end are dropped quietly
	}
	d := compactObject(cm.D)
	if d == nil {
		s.errorLocked(sess, "bad_message", "rtc needs an object d")
		return
	}
	if m.signals[sess.side] >= s.cfg.MaxSignalsPerMatch {
		s.errorLocked(sess, "rtc_limit", "too many rtc messages in this match")
		return
	}
	m.signals[sess.side]++
	if opp := m.p[1-sess.side]; opp != nil {
		s.totals.Signals++
		s.sendLocked(opp, rtcMsg(m.id, d))
	}
}

func (s *Server) onRematch(sess *session, now time.Time) {
	m := sess.match
	if m == nil || m.state != mEnded {
		s.errorLocked(sess, "bad_state", "no finished match to replay")
		return
	}
	m.rematch[sess.side] = true
	if m.rematch[0] && m.rematch[1] && m.p[0] != nil && m.p[1] != nil {
		p := m.p
		s.dissolveLocked(m)
		s.startMatchLocked(p, now, "rematch")
	}
}

// onResume re-attaches a reconnected player to its match (protocol extension):
// {"t":"resume","match":id,"key":key,"f":next opponent frame it needs}.
// Reply: {"t":"resumed","match","side","next","started"} and the opponent's
// inputs from f; the client resends its own inputs from "next".
func (s *Server) onResume(sess *session, cm *clientMsg, now time.Time) {
	if sess.state == stMatch {
		s.errorLocked(sess, "bad_state", "already in a match")
		return
	}
	m := s.matches[cm.matchID()]
	side := -1
	if m != nil && m.state != mEnded {
		for i := range 2 {
			if len(cm.Key) == len(m.key[i]) && subtle.ConstantTimeCompare([]byte(cm.Key), []byte(m.key[i])) == 1 {
				side = i
			}
		}
	}
	if side < 0 {
		s.errorLocked(sess, "resume_failed", "no such match or wrong key")
		return
	}
	opp := 1 - side
	from := int64(m.delay)
	if cm.F != nil && *cm.F > from {
		from = *cm.F
	}
	if m.state == mPlaying && (from > m.next[opp] || m.next[opp]-from > int64(len(m.ring[opp]))) {
		s.errorLocked(sess, "resume_failed", "those inputs are no longer kept")
		return
	}
	s.detachLocked(sess, true, now)
	if old := m.p[side]; old != nil && old != sess {
		old.match = nil
		old.state = stLobby
		s.dropLocked(old, websocket.StatusPolicyViolation, "replaced by resume", now)
	}
	m.p[side] = sess
	m.goneAt[side] = time.Time{}
	sess.state = stMatch
	sess.match = m
	sess.side = side
	s.totals.Resumed++
	s.log.Info("resume", "match", m.id, "conn", sess.num)
	started := m.state == mPlaying
	next := int64(m.delay)
	if started {
		next = m.next[side]
		m.quietFrom[side] = now
		m.quietFrom[opp] = now
	}
	s.sendLocked(sess, mustJSON(msgResumed{T: "resumed", Match: m.id, Side: side, Next: next, Started: started}))
	if started {
		ring := m.ring[opp]
		for f := from; f < m.next[opp]; f++ {
			s.sendLocked(sess, inputMsg(f, ring[f%int64(len(ring))]))
		}
	}
}

// checkMatchLocked runs a match's timers.
func (s *Server) checkMatchLocked(m *match, now time.Time) {
	if m.gone {
		return
	}
	if m.p[0] == nil && m.p[1] == nil {
		if now.Sub(m.goneAt[0]) >= s.cfg.Grace && now.Sub(m.goneAt[1]) >= s.cfg.Grace {
			s.log.Info("match_end", "match", m.id, "outcome", "abandoned")
			s.dissolveLocked(m)
		}
		return
	}
	for side := range 2 {
		if m.p[side] == nil && now.Sub(m.goneAt[side]) >= s.cfg.Grace {
			s.leaveMatchLocked(m, side, "disconnected", now)
			return
		}
	}
	switch m.state {
	case mWaitReady:
		if now.Sub(m.createdAt) < s.cfg.ReadyTimeout {
			return
		}
		if !m.ready[0] && !m.ready[1] {
			ps := m.p
			s.log.Info("match_end", "match", m.id, "outcome", "ready_timeout")
			s.dissolveLocked(m)
			for _, pl := range ps {
				s.sendLocked(pl, errMsg("ready_timeout", "the match did not start"))
			}
			return
		}
		late := 0
		if m.ready[0] {
			late = 1
		}
		s.sendLocked(m.p[late], errMsg("ready_timeout", "you did not get ready in time"))
		if !m.gone {
			s.leaveMatchLocked(m, late, "ready_timeout", now)
		}
	case mPlaying:
		for side := range 2 {
			if e := m.end[side]; e != nil && m.end[1-side] == nil && now.Sub(e.at) >= s.cfg.EndWait {
				s.finishLocked(m, "desync", e.f, 0, now)
				return
			}
		}
		for side := range 2 {
			pl := m.p[side]
			if pl == nil || m.end[side] != nil {
				continue
			}
			if m.next[side] >= m.next[1-side]+int64(m.delay) {
				m.quietFrom[side] = now // waiting for the opponent is not silence
				continue
			}
			if now.Sub(m.quietFrom[side]) >= s.cfg.InputSilence {
				s.sendLocked(pl, errMsg("idle", "no input for too long"))
				if !m.gone {
					s.leaveMatchLocked(m, side, "silent", now)
				}
				return
			}
		}
	}
}
