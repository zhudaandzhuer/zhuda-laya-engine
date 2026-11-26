package matchrelay

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/coder/websocket"
)

// OriginAllowed reports whether origin matches one of the patterns: an exact
// origin ("https://game.example.com") or an any-port pattern
// ("http://127.0.0.1:*", which also matches no port). Case-insensitive.
func OriginAllowed(patterns []string, origin string) bool {
	o := strings.ToLower(strings.TrimSpace(origin))
	if o == "" {
		return false
	}
	for _, p := range patterns {
		p = strings.ToLower(strings.TrimSpace(p))
		base, anyPort := strings.CutSuffix(p, ":*")
		if !anyPort {
			if o == p {
				return true
			}
			continue
		}
		if o == base {
			return true
		}
		if port, ok := strings.CutPrefix(o, base+":"); ok && len(port) >= 1 && len(port) <= 5 && strings.Trim(port, "0123456789") == "" {
			return true
		}
	}
	return false
}

func (s *Server) originOK(origin string) bool {
	if origin == "" {
		return s.cfg.AllowNoOrigin
	}
	return OriginAllowed(s.cfg.AllowedOrigins, origin)
}

// Handler is the WebSocket endpoint (mount it at e.g. /games/<game>/ws).
// It refuses other origins (403) and a full server (503) before upgrading.
func (s *Server) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", "GET")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		origin := r.Header.Get("Origin")
		if !s.originOK(origin) {
			s.mu.Lock()
			s.totals.Rejected++
			s.mu.Unlock()
			s.log.Info("reject", "why", "origin", "origin", truncate(origin, 80))
			http.Error(w, "origin not allowed", http.StatusForbidden)
			return
		}
		region := s.cfg.Region(s.cfg.Country(r))
		sess, err := s.open(s.cfg.ClientIP(r), region)
		if err != nil {
			s.log.Info("reject", "why", "capacity")
			w.Header().Set("Retry-After", "10")
			http.Error(w, "server busy", http.StatusServiceUnavailable)
			return
		}
		c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			InsecureSkipVerify: true, // the origin was checked above, with schemes
			CompressionMode:    websocket.CompressionDisabled,
		})
		if err != nil {
			s.peerClosed(sess, "handshake failed")
			return
		}
		// "rtc" may be up to MaxSignalBytes; receive closes anything else over
		// MaxMessageBytes with the same 1009.
		c.SetReadLimit(int64(max(s.cfg.MaxMessageBytes, s.cfg.MaxSignalBytes)))
		s.serve(sess, c)
	})
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

// serve runs one connection: this goroutine reads, one writes, one pings.
func (s *Server) serve(sess *session, c *websocket.Conn) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		s.writeLoop(ctx, sess, c)
	}()
	go s.pingLoop(ctx, sess, c)
	why := "closed by client"
	for {
		_, data, err := c.Read(ctx) // binary frames go through the same limits and JSON parsing
		if err != nil {
			if errors.Is(err, websocket.ErrMessageTooBig) {
				why = "message too big"
				s.mu.Lock()
				s.totals.BadMessages++
				s.mu.Unlock()
			}
			break
		}
		s.receive(sess, data)
	}
	s.peerClosed(sess, why)
	select {
	case <-done:
	case <-time.After(6 * time.Second):
	}
	cancel()
	c.CloseNow()
}

func (s *Server) writeLoop(ctx context.Context, sess *session, c *websocket.Conn) {
	write := func(b []byte) bool {
		wctx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		return c.Write(wctx, websocket.MessageText, b) == nil
	}
	for {
		select {
		case b := <-sess.out:
			if !write(b) {
				c.CloseNow()
				s.peerClosed(sess, "write failed")
				return
			}
		case req := <-sess.kill:
		flush:
			for {
				select {
				case b := <-sess.out:
					if !write(b) {
						c.CloseNow()
						return
					}
				default:
					break flush
				}
			}
			c.Close(req.code, req.reason)
			return
		case <-ctx.Done():
			return
		}
	}
}

// pingLoop measures the round trip with WebSocket ping frames (browsers answer
// them without any page code), right away and then every PingInterval.
func (s *Server) pingLoop(ctx context.Context, sess *session, c *websocket.Conn) {
	t := time.NewTicker(s.cfg.PingInterval)
	defer t.Stop()
	for {
		pctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		start := time.Now()
		err := c.Ping(pctx)
		cancel()
		if err == nil {
			s.recordRTT(sess, time.Since(start))
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// HealthHandler serves the /healthz JSON (GET or HEAD). Allowed origins get
// CORS headers so a game page can show the online count.
func (s *Server) HealthHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if o := r.Header.Get("Origin"); o != "" && OriginAllowed(s.cfg.AllowedOrigins, o) {
			w.Header().Set("Access-Control-Allow-Origin", o)
			w.Header().Add("Vary", "Origin")
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(s.Health())
	})
}
