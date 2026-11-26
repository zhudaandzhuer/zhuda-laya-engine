package matchrelay_test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"

	"zhudagamecenter/commonprefabs/server/matchrelay"
	"zhudagamecenter/commonprefabs/server/matchrelay/relayclient"
)

// Over a real WebSocket: two v2 clients with "p2p": true get "match" with
// p2p, exchange rtc messages up to MaxSignalBytes (6 KiB), get the direct-path
// delay in "go", and a 6 KiB + 1 rtc message closes the sender with 1009.
func TestSignalingOverWebSocket(t *testing.T) {
	_, url := startServer(t, func(c *matchrelay.Config) { c.Version, c.MinVersion = 2, 1 })
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var cs [2]*relayclient.Client
	var ms [2]relayclient.Msg
	for i := range cs {
		cs[i] = dial(t, url, relayclient.Options{})
		cs[i].SendRaw(fmt.Appendf(nil, `{"t":"hello","v":2,"id":"s%d","name":"n","char":"zhuda","p2p":true}`, i))
		if w, err := cs[i].Expect(ctx, "welcome"); err != nil || w.V != 2 {
			t.Fatalf("welcome %+v %v", w, err)
		}
		cs[i].SendRaw([]byte(`{"t":"ping","c":1,"rtt":150}`)) // a slow relay path: match delay 10
		cs[i].SendRaw([]byte(`{"t":"queue"}`))
	}
	for i := range cs {
		m, err := cs[i].Expect(ctx, "match")
		if err != nil {
			t.Fatal(err)
		}
		ms[i] = m
	}
	if ms[0].Side == 1 {
		cs[0], cs[1], ms[0], ms[1] = cs[1], cs[0], ms[1], ms[0]
	}
	id := ms[0].Match
	if ms[0].Delay != 10 {
		t.Fatalf("match delay %d", ms[0].Delay)
	}
	head := `{"t":"rtc","match":"` + id + `","d":{"sdp":"`
	fits := head + strings.Repeat("v", 6144-len(head)-3) + `"}}`
	if len(fits) != 6144 {
		t.Fatal(len(fits))
	}
	cs[0].SendRaw([]byte(fits))
	if m, err := cs[1].Expect(ctx, "rtc"); err != nil || m.Match != id {
		t.Fatalf("rtc %+v %v", m, err)
	}
	for i, c := range cs {
		c.SendRaw(fmt.Appendf(nil, `{"t":"ready","match":"%s","p2p":{"ok":true,"rtt":%d}}`, id, 10+10*i))
	}
	for _, c := range cs {
		if g, err := c.Expect(ctx, "go"); err != nil || g.Delay != 3 {
			t.Fatalf("go %+v %v (match delay %d)", g, err, ms[0].Delay)
		}
	}
	cs[1].SendRaw([]byte(fits[:len(fits)-2] + `v"}}`)) // 6145 bytes
	select {
	case <-cs[1].Done():
	case <-ctx.Done():
		t.Fatal("not closed")
	}
	if st := cs[1].CloseStatus(); st != websocket.StatusMessageTooBig {
		t.Fatalf("close status %v, want 1009", st)
	}
}
