// Package matchrelay is a game-agnostic matchmaking and input-relay server for
// two-player lockstep games over WebSocket. It only matches players and
// forwards their per-frame inputs; both browsers run the same deterministic
// simulation. It never decides an outcome: it compares the state hashes and
// the end frames both sides report and announces a result only when they
// agree.
//
// What it does: hello/welcome with a continent from CF-IPCountry; a quick-match
// queue (same continent first, anyone after SameRegionFor, timeout after
// QueueTimeout); 4-character room codes; match (crypto-random seed and stage,
// input delay from measured RTT); ready → go; ordered relay of validated
// inputs; hash and end comparison; rematch; disconnect grace with an optional
// resume; optional WebRTC signaling between the two players of a match ("rtc",
// with a smaller input delay in "go" when both report a working direct path);
// and the protections (Origin allow-list, rate and size limits, idle timeouts,
// bounded memory). See README.md for the protocol.
//
// The package opens no port: a game mounts Handler and HealthHandler on its own
// mux and calls Run.
package matchrelay

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
)

// Clock is the time source. Production uses the system clock; tests pass a fake
// clock and call Server.Tick after moving it.
type Clock interface{ Now() time.Time }

type systemClock struct{}

func (systemClock) Now() time.Time { return time.Now() }

// Config of a Server. Zero fields take the defaults listed on each field;
// Stages and AllowedOrigins are required.
type Config struct {
	Service string // name in /healthz (default "matchrelay")
	// Version is the newest protocol version (hello.v); MinVersion the oldest
	// one still accepted (defaults 1 and Version). welcome.v echoes the
	// client's version.
	Version         int
	MinVersion      int
	PlayersPerMatch int      // only 2 is supported (default 2)
	FrameRate       int      // frames per second of the simulation (default 60)
	Stages          []string // required; one is picked at random per match
	// Chars are the allowed "char" values; empty allows any 1–16 characters of
	// [a-z0-9_-].
	Chars []string
	// DefaultName replaces an empty nickname (default "Player").
	DefaultName string

	// AllowedOrigins are exact origins ("https://game.example.com") or
	// any-port patterns ("http://127.0.0.1:*"). Required.
	AllowedOrigins []string
	// AllowNoOrigin accepts handshakes without an Origin header (non-browser
	// clients). Default false: browsers always send one.
	AllowNoOrigin bool

	SameRegionFor time.Duration // only the same continent before this (default 10 s)
	QueueTimeout  time.Duration // "timeout" after this in the queue (default 20 s)
	RoomTTL       time.Duration // an unjoined room expires (default 5 min)
	ReadyTimeout  time.Duration // both must send ready within (default 30 s)
	Grace         time.Duration // a disconnected player may resume within (default 10 s)
	InputSilence  time.Duration // no input while able to send = left (default 10 s)
	EndWait       time.Duration // the other side must report end within (default 10 s)
	IdleTimeout   time.Duration // no message at all → close (default 60 s)
	HelloTimeout  time.Duration // hello must arrive within (default 10 s)
	PingInterval  time.Duration // WebSocket ping for RTT (default 2 s)
	TickInterval  time.Duration // timer resolution of Run (default 250 ms)

	MinDelay     int // input delay bounds and the value when RTT is unknown
	MaxDelay     int // (defaults 2, 10, 6)
	DefaultDelay int
	HashInterval int // hash every N frames (default 60)
	// MaxLeadFrames bounds how far one side's inputs may run ahead of the
	// other's (default 2 s of frames; lockstep itself keeps it ≤ delay+1).
	MaxLeadFrames int
	MaxFrames     int // longest match; beyond it the match is void (default 15 min)
	ResumeFrames  int // inputs kept per side for a resume (default 1024)

	MaxMessageBytes int // per message (default 1024)
	// MaxSignalBytes is the size limit of one "rtc" message (WebRTC
	// signaling, default 6144); every other message keeps MaxMessageBytes.
	MaxSignalBytes int
	// MaxSignalsPerMatch caps the "rtc" messages one side may send in one
	// match (default 40); more are answered with error rtc_limit.
	MaxSignalsPerMatch   int
	MaxMessagesPerSecond int // per connection, token bucket (default 90)
	// MaxBurstMessages is the token bucket's capacity: how many messages may
	// arrive at once (default MaxMessagesPerSecond). Networks deliver a stalled
	// stream in one go (TCP retransmission, a busy proxy), so a game may allow
	// a few seconds of inputs here while keeping the sustained rate.
	MaxBurstMessages int
	MaxConnections   int // default 2000
	MaxConnsPerIP    int // default 16
	MaxRooms         int // open rooms (default 1000)
	SendBuffer       int // queued outgoing messages per connection (default 256)

	Clock  Clock        // default system clock
	Rand   io.Reader    // default crypto/rand.Reader
	Logger *slog.Logger // default slog.Default()
	// Country returns the ISO country of a request (default: CF-IPCountry).
	Country func(*http.Request) string
	// Region maps a country to a region code (default ContinentOf).
	Region func(country string) string
	// ClientIP keys the per-IP connection limit; it is kept in memory only and
	// never logged (default: CF-Connecting-IP, else the remote address).
	ClientIP func(*http.Request) string
}

func (c Config) withDefaults() Config {
	def := func(p *time.Duration, d time.Duration) {
		if *p <= 0 {
			*p = d
		}
	}
	defi := func(p *int, d int) {
		if *p <= 0 {
			*p = d
		}
	}
	if c.Service == "" {
		c.Service = "matchrelay"
	}
	defi(&c.Version, 1)
	defi(&c.MinVersion, c.Version)
	defi(&c.PlayersPerMatch, 2)
	defi(&c.FrameRate, 60)
	if c.DefaultName == "" {
		c.DefaultName = "Player"
	}
	def(&c.SameRegionFor, 10*time.Second)
	def(&c.QueueTimeout, 20*time.Second)
	def(&c.RoomTTL, 5*time.Minute)
	def(&c.ReadyTimeout, 30*time.Second)
	def(&c.Grace, 10*time.Second)
	def(&c.InputSilence, 10*time.Second)
	def(&c.EndWait, 10*time.Second)
	def(&c.IdleTimeout, 60*time.Second)
	def(&c.HelloTimeout, 10*time.Second)
	def(&c.PingInterval, 2*time.Second)
	def(&c.TickInterval, 250*time.Millisecond)
	defi(&c.MinDelay, 2)
	defi(&c.MaxDelay, 10)
	defi(&c.DefaultDelay, 6)
	defi(&c.HashInterval, 60)
	defi(&c.MaxLeadFrames, 2*c.FrameRate)
	defi(&c.MaxFrames, 15*60*c.FrameRate)
	defi(&c.ResumeFrames, 1024)
	defi(&c.MaxMessageBytes, 1024)
	defi(&c.MaxSignalBytes, 6144)
	defi(&c.MaxSignalsPerMatch, 40)
	defi(&c.MaxMessagesPerSecond, 90)
	defi(&c.MaxBurstMessages, c.MaxMessagesPerSecond)
	defi(&c.MaxConnections, 2000)
	defi(&c.MaxConnsPerIP, 16)
	defi(&c.MaxRooms, 1000)
	defi(&c.SendBuffer, 256)
	if c.Clock == nil {
		c.Clock = systemClock{}
	}
	if c.Rand == nil {
		c.Rand = rand.Reader
	}
	if c.Logger == nil {
		c.Logger = slog.Default()
	}
	if c.Country == nil {
		c.Country = func(r *http.Request) string { return r.Header.Get("CF-IPCountry") }
	}
	if c.Region == nil {
		c.Region = ContinentOf
	}
	if c.ClientIP == nil {
		c.ClientIP = defaultClientIP
	}
	return c
}

func defaultClientIP(r *http.Request) string {
	if ip := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// Validate reports the first problem of a config after defaults.
func (c Config) Validate() error {
	c = c.withDefaults()
	switch {
	case c.PlayersPerMatch != 2:
		return fmt.Errorf("matchrelay: PlayersPerMatch %d: only 2 is supported", c.PlayersPerMatch)
	case len(c.Stages) == 0:
		return errors.New("matchrelay: Stages is empty")
	case len(c.AllowedOrigins) == 0 && !c.AllowNoOrigin:
		return errors.New("matchrelay: AllowedOrigins is empty")
	case c.MinDelay > c.MaxDelay || c.DefaultDelay < c.MinDelay || c.DefaultDelay > c.MaxDelay:
		return fmt.Errorf("matchrelay: delays min %d default %d max %d", c.MinDelay, c.DefaultDelay, c.MaxDelay)
	case c.SameRegionFor >= c.QueueTimeout:
		return errors.New("matchrelay: SameRegionFor must be shorter than QueueTimeout")
	case c.MaxMessageBytes < 128:
		return errors.New("matchrelay: MaxMessageBytes below 128")
	case c.MaxSignalBytes < c.MaxMessageBytes:
		return errors.New("matchrelay: MaxSignalBytes below MaxMessageBytes")
	case c.MinVersion > c.Version:
		return fmt.Errorf("matchrelay: MinVersion %d above Version %d", c.MinVersion, c.Version)
	case c.MaxMessagesPerSecond < c.FrameRate+2:
		return errors.New("matchrelay: MaxMessagesPerSecond must leave room for one input per frame plus control")
	case c.ResumeFrames < 4*c.MaxDelay:
		return errors.New("matchrelay: ResumeFrames too small")
	}
	for _, s := range c.Stages {
		if s == "" {
			return errors.New("matchrelay: empty stage name")
		}
	}
	for _, o := range c.AllowedOrigins {
		if o == "*" || !strings.Contains(o, "://") {
			return fmt.Errorf("matchrelay: origin %q must be scheme://host[:port|:*]", o)
		}
	}
	return nil
}
