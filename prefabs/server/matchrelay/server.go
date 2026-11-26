package matchrelay

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// Totals are cumulative counters since start (memory only).
type Totals struct {
	Connections   uint64 `json:"connections"`
	Matches       uint64 `json:"matches"`
	Results       uint64 `json:"results"`
	Desyncs       uint64 `json:"desyncs"`
	OppLeft       uint64 `json:"oppLeft"`
	QueueTimeouts uint64 `json:"queueTimeouts"`
	Rooms         uint64 `json:"rooms"`
	RoomsExpired  uint64 `json:"roomsExpired"`
	Resumed       uint64 `json:"resumed"`
	Rejected      uint64 `json:"rejected"` // handshakes refused (origin, capacity)
	RateLimited   uint64 `json:"rateLimited"`
	BadMessages   uint64 `json:"badMessages"`
	Signals       uint64 `json:"signals"` // "rtc" messages forwarded
	Direct        uint64 `json:"direct"`  // matches started on both players' direct path
}

// Health is the /healthz body: the contract's fields plus rooms and totals.
type Health struct {
	OK      bool   `json:"ok"`
	Service string `json:"service"`
	V       int    `json:"v"`
	Online  int    `json:"online"`  // connections that said hello
	Queued  int    `json:"queued"`  // in the quick-match queue
	Matches int    `json:"matches"` // waiting for ready or playing
	Rooms   int    `json:"rooms"`   // open rooms
	Totals  Totals `json:"totals"`
}

var errBusy = errors.New("matchrelay: server full")

// Server holds every connection, the queue, the rooms and the matches behind
// one mutex. Handlers enqueue outgoing messages without blocking; each
// connection's writer drains its own queue, so one slow client cannot stall
// others (it is closed when its queue fills).
type Server struct {
	cfg Config
	log *slog.Logger

	mu        sync.Mutex
	sessions  map[*session]struct{}
	perIP     map[string]int
	online    int
	queue     []*session
	rooms     map[string]*room
	fullRooms map[string]time.Time
	matches   map[string]*match
	nextNum   uint64
	totals    Totals
}

// New checks cfg and returns a server. Call Run to drive its timers.
func New(cfg Config) (*Server, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	cfg = cfg.withDefaults()
	return &Server{
		cfg:       cfg,
		log:       cfg.Logger,
		sessions:  map[*session]struct{}{},
		perIP:     map[string]int{},
		rooms:     map[string]*room{},
		fullRooms: map[string]time.Time{},
		matches:   map[string]*match{},
	}, nil
}

// Config returns the effective configuration (with defaults).
func (s *Server) Config() Config { return s.cfg }

// Run calls Tick every TickInterval until ctx ends.
func (s *Server) Run(ctx context.Context) {
	t := time.NewTicker(s.cfg.TickInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.Tick()
		}
	}
}

// CloseAll closes every connection (StatusGoingAway), e.g. before exiting.
func (s *Server) CloseAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.cfg.Clock.Now()
	for sess := range s.sessions {
		if sess.match != nil {
			sess.match.p[sess.side] = nil
			sess.match = nil
		}
		s.dropLocked(sess, websocket.StatusGoingAway, "server restarting", now)
	}
	for _, m := range s.matches {
		s.dissolveLocked(m)
	}
}

// Health returns the current counts.
func (s *Server) Health() Health {
	s.mu.Lock()
	defer s.mu.Unlock()
	active := 0
	for _, m := range s.matches {
		if m.state != mEnded {
			active++
		}
	}
	return Health{OK: true, Service: s.cfg.Service, V: s.cfg.Version, Online: s.online,
		Queued: len(s.queue), Matches: active, Rooms: len(s.rooms), Totals: s.totals}
}

// ---- sessions ----

type sessionState int

const (
	stNew sessionState = iota
	stLobby
	stQueued
	stRoom
	stMatch
)

type closeReq struct {
	code   websocket.StatusCode
	reason string
}

type session struct {
	num      uint64
	ip       string
	region   string
	openedAt time.Time
	lastMsg  time.Time

	out    chan []byte   // drained by the connection's writer
	kill   chan closeReq // one close request, after out is flushed
	closed bool

	state   sessionState
	helloed bool
	v       int  // hello.v
	p2p     bool // hello.p2p: can set up a direct WebRTC path
	id      string
	name    string
	char    string

	tokens   float64
	tokensAt time.Time
	errors   int

	queuedAt   time.Time
	queuedSent int
	room       *room
	match      *match
	side       int

	srvRTT rttWindow // WebSocket ping/pong measured by the server
	cliRTT rttWindow // "rtt" reported in the client's ping (extension)
}

// take is a token bucket: capacity burst, refilled rate per second.
func (c *session) take(now time.Time, rate, burst float64) bool {
	if el := now.Sub(c.tokensAt).Seconds(); el > 0 {
		c.tokens = min(burst, c.tokens+el*rate)
		c.tokensAt = now
	}
	if c.tokens < 1 {
		return false
	}
	c.tokens--
	return true
}

type rttWindow struct {
	s    [5]time.Duration
	n, i int
}

func (w *rttWindow) add(d time.Duration) {
	w.s[w.i] = d
	w.i = (w.i + 1) % len(w.s)
	w.n = min(w.n+1, len(w.s))
}

func (w *rttWindow) median() (time.Duration, bool) {
	if w.n == 0 {
		return 0, false
	}
	v := slices.Clone(w.s[:w.n])
	slices.Sort(v)
	return v[w.n/2], true
}

// rtt is the larger of the server-measured and client-reported medians.
func (c *session) rtt() (time.Duration, bool) {
	a, okA := c.srvRTT.median()
	b, okB := c.cliRTT.median()
	return max(a, b), okA || okB
}

// open registers a connection before the WebSocket upgrade.
func (s *Server) open(ip, region string) (*session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.sessions) >= s.cfg.MaxConnections || s.perIP[ip] >= s.cfg.MaxConnsPerIP {
		s.totals.Rejected++
		return nil, errBusy
	}
	now := s.cfg.Clock.Now()
	s.nextNum++
	sess := &session{
		num: s.nextNum, ip: ip, region: region, openedAt: now, lastMsg: now,
		out: make(chan []byte, s.cfg.SendBuffer), kill: make(chan closeReq, 1),
		tokens: float64(s.cfg.MaxBurstMessages), tokensAt: now,
	}
	s.sessions[sess] = struct{}{}
	s.perIP[ip]++
	s.totals.Connections++
	s.log.Info("open", "conn", sess.num, "region", region)
	return sess, nil
}

// peerClosed is called by the transport when the connection is gone.
func (s *Server) peerClosed(sess *session, why string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.dropLocked(sess, websocket.StatusNormalClosure, why, s.cfg.Clock.Now())
}

func (s *Server) recordRTT(sess *session, d time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !sess.closed {
		sess.srvRTT.add(d)
	}
}

func (s *Server) sendLocked(sess *session, b []byte) {
	if sess == nil || sess.closed {
		return
	}
	select {
	case sess.out <- b:
	default:
		s.dropLocked(sess, websocket.StatusPolicyViolation, "slow reader", s.cfg.Clock.Now())
	}
}

func (s *Server) errorLocked(sess *session, code, msg string) {
	s.totals.BadMessages++
	if sess.errors++; sess.errors <= 5 { // enough to diagnose a client, bounded under a flood
		s.log.Info("error", "conn", sess.num, "code", code, "msg", msg)
	}
	s.sendLocked(sess, errMsg(code, msg))
}

// dropLocked closes a connection: it leaves the queue or room, and a match
// starts its grace period (see detachLocked).
func (s *Server) dropLocked(sess *session, code websocket.StatusCode, reason string, now time.Time) {
	if sess.closed {
		return
	}
	s.detachLocked(sess, false, now)
	sess.closed = true
	delete(s.sessions, sess)
	if s.perIP[sess.ip]--; s.perIP[sess.ip] <= 0 {
		delete(s.perIP, sess.ip)
	}
	if sess.helloed {
		s.online--
	}
	select {
	case sess.kill <- closeReq{code, reason}:
	default:
	}
	s.log.Info("close", "conn", sess.num, "reason", reason, "secs", int(now.Sub(sess.openedAt).Seconds()))
}

// detachLocked takes a session out of the queue, its room or its match.
// Leaving a match on purpose (explicit) ends it at once; losing the connection
// during a match keeps the seat for Grace so the player can resume.
func (s *Server) detachLocked(sess *session, explicit bool, now time.Time) {
	switch sess.state {
	case stQueued:
		s.unqueueLocked(sess)
	case stRoom:
		if sess.room != nil {
			delete(s.rooms, sess.room.code)
			sess.room = nil
		}
	case stMatch:
		m := sess.match
		if m == nil {
			break
		}
		if explicit || m.state == mEnded {
			s.leaveMatchLocked(m, sess.side, "left", now)
		} else {
			m.p[sess.side] = nil
			m.goneAt[sess.side] = now
			sess.match = nil
		}
	}
	if sess.state != stNew {
		sess.state = stLobby
	}
}

// Tick runs every timer: hello and idle timeouts, the queue (matching,
// widening, timeouts, "queued" notices), room expiry, and the match timers
// (grace, ready, input silence, end wait).
func (s *Server) Tick() {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.cfg.Clock.Now()

	for sess := range s.sessions {
		switch {
		case sess.state == stNew && now.Sub(sess.openedAt) >= s.cfg.HelloTimeout:
			s.dropLocked(sess, websocket.StatusPolicyViolation, "no hello", now)
		case now.Sub(sess.lastMsg) >= s.cfg.IdleTimeout:
			s.dropLocked(sess, websocket.StatusNormalClosure, "idle", now)
		}
	}

	s.matchQueueLocked(now)
	for _, sess := range slices.Clone(s.queue) {
		if sess.state != stQueued {
			continue
		}
		waited := now.Sub(sess.queuedAt)
		if waited >= s.cfg.QueueTimeout {
			s.unqueueLocked(sess)
			sess.state = stLobby
			s.totals.QueueTimeouts++
			s.log.Info("queue_timeout", "conn", sess.num, "region", sess.region)
			s.sendLocked(sess, simple("timeout"))
			continue
		}
		if secs := int(waited / time.Second); secs > sess.queuedSent {
			sess.queuedSent = secs
			s.sendLocked(sess, withInt("queued", "waited", int64(secs)))
		}
	}

	for code, r := range s.rooms {
		if now.Sub(r.createdAt) >= s.cfg.RoomTTL {
			s.expireRoomLocked(code, r)
		}
	}
	for code, at := range s.fullRooms {
		if now.Sub(at) >= s.cfg.RoomTTL {
			delete(s.fullRooms, code)
		}
	}

	ms := make([]*match, 0, len(s.matches))
	for _, m := range s.matches {
		ms = append(ms, m)
	}
	for _, m := range ms {
		s.checkMatchLocked(m, now)
	}
}

// ---- randomness ----

func (s *Server) randBytes(n int) []byte {
	b := make([]byte, n)
	if _, err := io.ReadFull(s.cfg.Rand, b); err != nil {
		panic("matchrelay: random source failed: " + err.Error())
	}
	return b
}

func (s *Server) randUint32() uint32 { return binary.BigEndian.Uint32(s.randBytes(4)) }

func (s *Server) randHex(n int) string { return hex.EncodeToString(s.randBytes(n)) }

// ---- dispatch ----

// receive handles one client message.
func (s *Server) receive(sess *session, data []byte) {
	var m clientMsg
	perr := json.Unmarshal(data, &m)

	s.mu.Lock()
	defer s.mu.Unlock()
	if sess.closed {
		return
	}
	now := s.cfg.Clock.Now()
	sess.lastMsg = now
	if !sess.take(now, float64(s.cfg.MaxMessagesPerSecond), float64(s.cfg.MaxBurstMessages)) {
		s.totals.RateLimited++
		s.sendLocked(sess, errMsg("rate_limited", "too many messages"))
		s.dropLocked(sess, websocket.StatusPolicyViolation, "rate limited", now)
		return
	}
	if len(data) > s.cfg.MaxMessageBytes && (perr != nil || m.T != "rtc") {
		// Only "rtc" may use the larger MaxSignalBytes (the read limit).
		s.totals.BadMessages++
		s.dropLocked(sess, websocket.StatusMessageTooBig, "message too big", now)
		return
	}
	if perr != nil || m.T == "" {
		s.errorLocked(sess, "bad_message", "not a JSON message with t")
		return
	}
	if sess.state == stNew && m.T != "hello" && m.T != "ping" {
		s.errorLocked(sess, "bad_message", "hello first")
		s.dropLocked(sess, websocket.StatusPolicyViolation, "no hello", now)
		return
	}
	switch m.T {
	case "hello":
		s.onHello(sess, &m, now)
	case "queue":
		s.onQueue(sess, &m, now)
	case "room_create":
		s.onRoomCreate(sess, &m, now)
	case "room_join":
		s.onRoomJoin(sess, &m, now)
	case "cancel":
		s.onCancel(sess, now)
	case "ready":
		s.onReady(sess, &m, now)
	case "in":
		s.onInput(sess, &m, now)
	case "hash":
		s.onHash(sess, &m)
	case "end":
		s.onEnd(sess, &m, now)
	case "rematch":
		s.onRematch(sess, now)
	case "ping":
		s.onPing(sess, &m, now)
	case "resume":
		s.onResume(sess, &m, now)
	case "rtc":
		s.onRTC(sess, &m)
	default:
		s.errorLocked(sess, "bad_message", "unknown t")
	}
}

func (s *Server) onHello(sess *session, m *clientMsg, now time.Time) {
	if sess.state != stNew {
		s.errorLocked(sess, "bad_state", "hello was already sent")
		return
	}
	if m.V == nil || *m.V < s.cfg.MinVersion || *m.V > s.cfg.Version {
		speaks := "v" + strconv.Itoa(s.cfg.Version)
		if s.cfg.MinVersion < s.cfg.Version {
			speaks = "v" + strconv.Itoa(s.cfg.MinVersion) + "-" + speaks
		}
		s.errorLocked(sess, "version", "this server speaks "+speaks)
		s.dropLocked(sess, websocket.StatusPolicyViolation, "version", now)
		return
	}
	if !validID(m.ID) {
		s.errorLocked(sess, "bad_message", "id must be 1-40 printable ASCII characters")
		s.dropLocked(sess, websocket.StatusPolicyViolation, "bad hello", now)
		return
	}
	char := ""
	if m.Char != nil {
		if !s.validChar(*m.Char) {
			s.errorLocked(sess, "bad_message", "unknown char")
			s.dropLocked(sess, websocket.StatusPolicyViolation, "bad hello", now)
			return
		}
		char = *m.Char
	} else if len(s.cfg.Chars) > 0 {
		char = s.cfg.Chars[0]
	}
	name := cleanName(m.Name, 16)
	if name == "" {
		name = s.cfg.DefaultName
	}
	sess.id, sess.name, sess.char = m.ID, name, char
	sess.v, sess.p2p = *m.V, m.helloP2P()
	sess.state = stLobby
	sess.helloed = true
	s.online++
	s.sendLocked(sess, mustJSON(msgWelcome{T: "welcome", V: sess.v, Region: sess.region, Online: s.online}))
}

func (s *Server) validChar(c string) bool {
	if len(s.cfg.Chars) == 0 {
		return validCharToken(c)
	}
	return slices.Contains(s.cfg.Chars, c)
}

// charOf is the message's char, or the one from hello.
func (s *Server) charOf(sess *session, m *clientMsg) (string, bool) {
	if m.Char == nil {
		return sess.char, true
	}
	return *m.Char, s.validChar(*m.Char)
}

func (s *Server) onPing(sess *session, m *clientMsg, now time.Time) {
	c := json.RawMessage("0")
	if validNumber(m.C) {
		c = m.C
	}
	if m.RTT != nil && *m.RTT > 0 && *m.RTT <= 10000 {
		sess.cliRTT.add(time.Duration(*m.RTT * float64(time.Millisecond)))
	}
	s.sendLocked(sess, pongMsg(c, now.UnixMilli()))
}

func (s *Server) onCancel(sess *session, now time.Time) {
	switch sess.state {
	case stQueued, stRoom:
		s.detachLocked(sess, true, now)
	case stMatch:
		if sess.match != nil {
			s.leaveMatchLocked(sess.match, sess.side, "cancel", now)
		}
	}
}

// leaveLobbyLocked clears the queue, room or finished match before a new
// queue/room request. It refuses while a match is starting or running.
func (s *Server) leaveLobbyLocked(sess *session, now time.Time) bool {
	if sess.state == stMatch && sess.match != nil && sess.match.state != mEnded {
		return false
	}
	s.detachLocked(sess, true, now)
	return true
}
