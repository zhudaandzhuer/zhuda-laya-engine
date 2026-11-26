// Package relayclient is a Go client of the matchrelay protocol, for bots,
// smoke tests and integration tests: dial, send and receive JSON messages
// (optionally through a simulated network delay that keeps message order, like
// a real TCP path), and play one lockstep match with a pluggable simulation.
package relayclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// Options of a connection.
type Options struct {
	URL    string      // ws://127.0.0.1:8796/games/<game>/ws
	Origin string      // sent as the Origin header (the server checks it)
	Header http.Header // extra handshake headers (e.g. CF-IPCountry in tests)
	// Latency, when set, delays every outgoing and every incoming message by
	// its result, never reordering them.
	Latency func() time.Duration
}

// Player is the "you"/"opp" object of a match message.
type Player struct {
	Name   string `json:"name"`
	Char   string `json:"char"`
	Region string `json:"region"`
}

// Msg is any server → client message; fields not in a type stay zero.
type Msg struct {
	T       string  `json:"t"`
	V       int     `json:"v"`
	Region  string  `json:"region"`
	Online  int     `json:"online"`
	Waited  int     `json:"waited"`
	Code    string  `json:"code"`
	Msg     string  `json:"msg"`
	Match   string  `json:"match"`
	Seed    uint32  `json:"seed"`
	Side    int     `json:"side"`
	Delay   int     `json:"delay"`
	Stage   string  `json:"stage"`
	You     Player  `json:"you"`
	Opp     Player  `json:"opp"`
	Key     string  `json:"key"`
	F       int64   `json:"f"`
	B       int     `json:"b"`
	Winner  int     `json:"winner"`
	C       float64 `json:"c"`
	S       int64   `json:"s"`
	Next    int64   `json:"next"`
	Started bool    `json:"started"`
}

type timed struct {
	due  time.Time
	data []byte
}

// Client is one connection.
type Client struct {
	conn   *websocket.Conn
	opts   Options
	ctx    context.Context
	cancel context.CancelFunc

	outbox  chan timed
	inbox   chan Msg
	sendMu  sync.Mutex
	sendDue time.Time

	errMu    sync.Mutex
	readErr  error
	closedCh chan struct{}
}

// Dial connects. The returned response is set when the handshake was refused.
func Dial(ctx context.Context, o Options) (*Client, *http.Response, error) {
	h := http.Header{}
	for k, v := range o.Header {
		h[k] = v
	}
	if o.Origin != "" {
		h.Set("Origin", o.Origin)
	}
	conn, resp, err := websocket.Dial(ctx, o.URL, &websocket.DialOptions{HTTPHeader: h})
	if err != nil {
		return nil, resp, err
	}
	conn.SetReadLimit(1 << 16)
	cctx, cancel := context.WithCancel(context.Background())
	c := &Client{conn: conn, opts: o, ctx: cctx, cancel: cancel,
		outbox: make(chan timed, 4096), inbox: make(chan Msg, 4096), closedCh: make(chan struct{})}
	go c.writeLoop()
	go c.readLoop()
	return c, resp, nil
}

func (c *Client) latency() time.Duration {
	if c.opts.Latency == nil {
		return 0
	}
	return c.opts.Latency()
}

func sleepUntil(ctx context.Context, t time.Time) bool {
	d := time.Until(t)
	if d <= 0 {
		return ctx.Err() == nil
	}
	tm := time.NewTimer(d)
	defer tm.Stop()
	select {
	case <-tm.C:
		return true
	case <-ctx.Done():
		return false
	}
}

func (c *Client) writeLoop() {
	for {
		select {
		case <-c.ctx.Done():
			return
		case m := <-c.outbox:
			if !sleepUntil(c.ctx, m.due) {
				return
			}
			if err := c.conn.Write(c.ctx, websocket.MessageText, m.data); err != nil {
				return
			}
		}
	}
}

func (c *Client) readLoop() {
	arrivals := make(chan timed, 4096)
	go func() {
		defer close(c.inbox)
		for a := range arrivals {
			if !sleepUntil(c.ctx, a.due) {
				return
			}
			var m Msg
			if json.Unmarshal(a.data, &m) == nil {
				select {
				case c.inbox <- m:
				case <-c.ctx.Done():
					return
				}
			}
		}
	}()
	var last time.Time
	for {
		_, data, err := c.conn.Read(c.ctx)
		if err != nil {
			c.errMu.Lock()
			c.readErr = err
			c.errMu.Unlock()
			close(arrivals)
			close(c.closedCh)
			return
		}
		due := time.Now().Add(c.latency())
		if due.Before(last) {
			due = last
		}
		last = due
		arrivals <- timed{due, data}
	}
}

// Send marshals v and queues it (after the simulated latency).
func (c *Client) Send(v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.SendRaw(b)
}

// SendRaw queues raw bytes as one text message.
func (c *Client) SendRaw(b []byte) error {
	c.sendMu.Lock()
	due := time.Now().Add(c.latency())
	if due.Before(c.sendDue) {
		due = c.sendDue
	}
	c.sendDue = due
	c.sendMu.Unlock()
	select {
	case c.outbox <- timed{due, b}:
		return nil
	case <-c.closedCh:
		return c.Err()
	case <-c.ctx.Done():
		return errors.New("relayclient: closed")
	}
}

// Recv returns the next message.
func (c *Client) Recv(ctx context.Context) (Msg, error) {
	select {
	case m, ok := <-c.inbox:
		if !ok {
			return Msg{}, c.Err()
		}
		return m, nil
	case <-ctx.Done():
		return Msg{}, ctx.Err()
	}
}

// Expect returns the next message that is not "queued" or "pong"; it fails if
// its type is not one of want.
func (c *Client) Expect(ctx context.Context, want ...string) (Msg, error) {
	for {
		m, err := c.Recv(ctx)
		if err != nil {
			return m, err
		}
		if m.T == "queued" || m.T == "pong" {
			continue
		}
		for _, w := range want {
			if m.T == w {
				return m, nil
			}
		}
		if m.T == "error" {
			return m, fmt.Errorf("relayclient: got error %s (%s), want %v", m.Code, m.Msg, want)
		}
		return m, fmt.Errorf("relayclient: got %q, want %v", m.T, want)
	}
}

// Err is why the connection ended (nil while open).
func (c *Client) Err() error {
	c.errMu.Lock()
	defer c.errMu.Unlock()
	return c.readErr
}

// CloseStatus is the WebSocket close code the server sent (-1 if none yet).
func (c *Client) CloseStatus() websocket.StatusCode { return websocket.CloseStatus(c.Err()) }

// Done is closed when the connection has ended.
func (c *Client) Done() <-chan struct{} { return c.closedCh }

// Close ends the connection normally.
func (c *Client) Close() error {
	defer c.cancel()
	return c.conn.Close(websocket.StatusNormalClosure, "bye")
}

// Drop ends the connection without a close handshake (like a lost network).
func (c *Client) Drop() {
	c.cancel()
	c.conn.CloseNow()
}

// Hello sends the first message.
func (c *Client) Hello(id, name, char string) error {
	return c.Send(map[string]any{"t": "hello", "v": 1, "id": id, "name": name, "char": char})
}

// MeasureRTT sends n pings one after another and returns the median round
// trip. With report, each ping after the first carries the last measurement
// as "rtt" (ms), so the server can use it for the input delay (extension).
// Call it after Hello and before queueing.
func (c *Client) MeasureRTT(ctx context.Context, n int, report bool) (time.Duration, error) {
	var samples []time.Duration
	start := time.Now()
	for i := range n {
		p := map[string]any{"t": "ping", "c": float64(time.Since(start).Microseconds()) / 1000}
		if report && i > 0 {
			p["rtt"] = float64(samples[len(samples)-1].Microseconds()) / 1000
		}
		if err := c.Send(p); err != nil {
			return 0, err
		}
		for {
			m, err := c.Recv(ctx)
			if err != nil {
				return 0, err
			}
			if m.T == "pong" {
				now := float64(time.Since(start).Microseconds()) / 1000
				samples = append(samples, time.Duration((now-m.C)*float64(time.Millisecond)))
				break
			}
		}
	}
	if report && len(samples) > 0 {
		if err := c.Send(map[string]any{"t": "ping", "c": 0, "rtt": float64(samples[len(samples)-1].Microseconds()) / 1000}); err != nil {
			return 0, err
		}
	}
	slices.Sort(samples)
	return samples[len(samples)/2], nil
}
