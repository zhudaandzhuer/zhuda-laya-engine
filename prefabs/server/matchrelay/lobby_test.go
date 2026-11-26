package matchrelay

import (
	"strings"
	"testing"
	"time"
)

func TestQueueSameRegionMatchesAtOnce(t *testing.T) {
	h := newHarness(t, nil)
	a, b := h.hello("AS", "a"), h.hello("AS", "b")
	a.send(`{"t":"queue","char":"zhuda"}`)
	if q := a.all(); len(q) != 1 || q[0]["t"] != "queued" || q[0].int("waited") != 0 {
		t.Fatalf("first message after queue: %v", q)
	}
	b.send(`{"t":"queue","char":"zhuer"}`)
	ma, mb := a.expect("match"), b.expect("match")
	if ma.str("match") == "" || ma.str("match") != mb.str("match") {
		t.Fatalf("match ids %v %v", ma, mb)
	}
	if ma.int("side")+mb.int("side") != 1 || ma.int("seed") != mb.int("seed") || ma.str("stage") != mb.str("stage") ||
		ma.int("delay") != mb.int("delay") {
		t.Fatalf("sides/seed/stage/delay differ: %v %v", ma, mb)
	}
	if ma.int("delay") != 6 {
		t.Fatalf("unmeasured RTT delay %d, want 6", ma.int("delay"))
	}
	if st := ma.str("stage"); st != "livingroom" && st != "backyard" {
		t.Fatalf("stage %q", st)
	}
	you, opp := ma["you"].(map[string]any), ma["opp"].(map[string]any)
	if you["char"] != "zhuda" || opp["char"] != "zhuer" || opp["name"] != "p-b" || opp["region"] != "AS" {
		t.Fatalf("you %v opp %v", you, opp)
	}
	if len(ma.str("key")) != 32 || ma.str("key") == mb.str("key") {
		t.Fatalf("resume keys %q %q", ma.str("key"), mb.str("key"))
	}
	if hl := h.s.Health(); hl.Queued != 0 || hl.Matches != 1 || hl.Online != 2 {
		t.Fatalf("health %+v", hl)
	}
}

func TestQueueOtherRegionWaitsTenSeconds(t *testing.T) {
	h := newHarness(t, nil)
	a, b := h.hello("AS", "a"), h.hello("EU", "b")
	a.send(`{"t":"queue"}`)
	b.send(`{"t":"queue"}`)
	waited := 0
	for range 39 { // 9.75 s in 250 ms ticks
		h.tick(250 * time.Millisecond)
		for _, m := range a.all() {
			if m["t"] != "queued" {
				t.Fatalf("before 10 s: %v", m)
			}
			waited = int(m.int("waited"))
		}
		b.quiet()
	}
	if waited != 9 {
		t.Fatalf("last queued.waited %d, want 9", waited)
	}
	h.tick(250 * time.Millisecond) // 10.00 s
	ma, mb := a.expect("match"), b.expect("match")
	if ma["opp"].(map[string]any)["region"] != "EU" || mb["opp"].(map[string]any)["region"] != "AS" {
		t.Fatalf("opp regions %v %v", ma, mb)
	}
}

func TestQueuePrefersSameRegion(t *testing.T) {
	h := newHarness(t, nil)
	a, b, c := h.hello("AS", "a"), h.hello("EU", "b"), h.hello("AS", "c")
	a.send(`{"t":"queue"}`)
	h.tick(time.Second)
	b.send(`{"t":"queue"}`)
	h.tick(time.Second)
	b.quiet()
	c.send(`{"t":"queue"}`) // same continent as a: paired at once, b keeps waiting
	if a.expect("match")["opp"].(map[string]any)["name"] != "p-c" {
		t.Fatal("a was not paired with c")
	}
	c.expect("match")
	b.quiet()
	if h.s.Health().Queued != 1 {
		t.Fatal("b should still be queued")
	}
}

func TestQueueOlderPlayerWidens(t *testing.T) {
	// a (AS) has waited 10 s, b (EU) only 5 s: a now takes anyone, so they pair.
	h := newHarness(t, nil)
	a, b := h.hello("AS", "a"), h.hello("EU", "b")
	a.send(`{"t":"queue"}`)
	h.tick(5 * time.Second)
	b.send(`{"t":"queue"}`)
	h.tick(4900 * time.Millisecond)
	a.quiet()
	b.quiet()
	h.tick(100 * time.Millisecond)
	a.expect("match")
	b.expect("match")
}

func TestQueueTimeoutAtTwentySeconds(t *testing.T) {
	h := newHarness(t, nil)
	a := h.hello("OC", "a")
	a.send(`{"t":"queue"}`)
	var waits []int64
	for range 19 {
		h.tick(time.Second)
		for _, m := range a.all() {
			if m["t"] != "queued" {
				t.Fatalf("before 20 s: %v", m)
			}
			waits = append(waits, m.int("waited"))
		}
	}
	if len(waits) != 20 || waits[0] != 0 || waits[19] != 19 {
		t.Fatalf("queued notices %v, want 0..19", waits)
	}
	h.tick(999 * time.Millisecond)
	a.quiet()
	h.tick(time.Millisecond) // exactly 20 s
	a.expect("timeout")
	if hl := h.s.Health(); hl.Queued != 0 || hl.Totals.QueueTimeouts != 1 {
		t.Fatalf("health %+v", hl)
	}
	// Out of the queue: a later player does not get matched with a.
	b := h.hello("OC", "b")
	b.send(`{"t":"queue"}`)
	b.quiet()
	a.quiet()
	// a can queue again.
	a.send(`{"t":"queue"}`)
	a.expect("match")
	b.expect("match")
}

func TestQueueNeverPairsAPlayerWithThemselves(t *testing.T) {
	h := newHarness(t, nil)
	tab1, tab2 := h.hello("AS", "same-browser"), h.hello("AS", "same-browser")
	tab1.send(`{"t":"queue"}`)
	tab2.send(`{"t":"queue"}`)
	h.tick(12 * time.Second) // widened, still never with themselves
	tab1.quiet()
	tab2.quiet()
	other := h.hello("EU", "other")
	other.send(`{"t":"queue"}`)
	m := other.expect("match") // pairs with the oldest (tab1), widened
	if m["opp"].(map[string]any)["name"] != "p-same-browser" {
		t.Fatalf("opp %v", m)
	}
	tab1.expect("match")
	tab2.quiet()
	h.tick(8 * time.Second)
	tab2.expect("timeout")
}

func TestQueueCancel(t *testing.T) {
	h := newHarness(t, nil)
	a, b := h.hello("AS", "a"), h.hello("AS", "b")
	a.send(`{"t":"queue"}`)
	a.send(`{"t":"cancel"}`)
	b.send(`{"t":"queue"}`)
	a.quiet()
	b.quiet()
	if h.s.Health().Queued != 1 {
		t.Fatal("cancelled player still queued")
	}
	// A disconnect also leaves the queue.
	b.drop()
	if h.s.Health().Queued != 0 {
		t.Fatal("dropped player still queued")
	}
}

func TestRoomCreateJoin(t *testing.T) {
	h := newHarness(t, nil)
	host, guest := h.hello("AS", "host"), h.hello("NA", "guest")
	host.send(`{"t":"room_create","char":"zhuer"}`)
	code := host.expect("room").str("code")
	if len(code) != 4 {
		t.Fatalf("code %q", code)
	}
	for _, r := range code {
		if !strings.ContainsRune(RoomAlphabet, r) || strings.ContainsRune("IO01", r) {
			t.Fatalf("code %q has %q", code, r)
		}
	}
	guest.send(`{"t":"room_join","code":%q,"char":"zhuda"}`, strings.ToLower(code)) // case-insensitive
	mh, mg := host.expect("match"), guest.expect("match")
	if mh.str("match") != mg.str("match") || mh["you"].(map[string]any)["char"] != "zhuer" {
		t.Fatalf("%v %v", mh, mg)
	}
	third := h.hello("AS", "third")
	third.send(`{"t":"room_join","code":%q}`, code)
	third.expectError("room_full")
}

func TestRoomErrors(t *testing.T) {
	h := newHarness(t, nil)
	host := h.hello("AS", "host")
	host.send(`{"t":"room_create"}`)
	code := host.expect("room").str("code")

	other := h.hello("AS", "x")
	for _, bad := range []string{"", "ABC", "ABCDE", "AB1O", "ab c", "ÄBCD"} {
		other.send(`{"t":"room_join","code":%q}`, bad)
		other.expectError("bad_room")
	}
	other.send(`{"t":"room_join","code":"%s"}`, otherCode(code))
	other.expectError("bad_room")

	// Own room: same connection, or another tab with the same player id.
	host.send(`{"t":"room_join","code":%q}`, code)
	host.expectError("bad_room")
	tab := h.hello("AS", "host")
	tab.send(`{"t":"room_join","code":%q}`, code)
	tab.expectError("bad_room")

	// Bad char.
	other.send(`{"t":"room_create","char":"dragon"}`)
	other.expectError("bad_message")

	// Cancel closes the room.
	host.send(`{"t":"cancel"}`)
	other.send(`{"t":"room_join","code":%q}`, code)
	other.expectError("bad_room")

	// Host disconnect closes the room.
	host.send(`{"t":"room_create"}`)
	code = host.expect("room").str("code")
	host.drop()
	other.send(`{"t":"room_join","code":%q}`, code)
	other.expectError("bad_room")
	if h.s.Health().Rooms != 0 {
		t.Fatal("rooms left open")
	}
}

func otherCode(code string) string {
	b := []byte(code)
	if b[0] == 'A' {
		b[0] = 'B'
	} else {
		b[0] = 'A'
	}
	return string(b)
}

func TestRoomExpiresAfterFiveMinutes(t *testing.T) {
	h := newHarness(t, nil)
	host := h.hello("AS", "host")
	host.send(`{"t":"room_create"}`)
	code := host.expect("room").str("code")
	for range 29 { // keep the host's connection alive with pings, 10 s apart
		h.tick(10 * time.Second)
		host.send(`{"t":"ping","c":1}`)
	}
	h.tick(9 * time.Second) // 4:59
	host.quiet()
	h.tick(time.Second) // 5:00
	host.expectError("room_expired")
	g := h.hello("AS", "guest")
	g.send(`{"t":"room_join","code":%q}`, code)
	g.expectError("bad_room")
	if hl := h.s.Health(); hl.Rooms != 0 || hl.Totals.RoomsExpired != 1 {
		t.Fatalf("health %+v", hl)
	}
	// The host can open a new room afterwards.
	host.send(`{"t":"room_create"}`)
	host.expect("room")
}

func TestQueueOrRoomWhileInMatchIsRefused(t *testing.T) {
	h := newHarness(t, nil)
	p, _, _ := h.playing()
	p[0].send(`{"t":"queue"}`)
	p[0].expectError("bad_state")
	p[1].send(`{"t":"room_create"}`)
	p[1].expectError("bad_state")
}
