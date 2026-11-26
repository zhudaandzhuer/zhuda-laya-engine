package matchrelay

import (
	"slices"
	"strings"
	"time"
)

// RoomAlphabet is the room-code alphabet: upper-case letters and digits
// without I, O, 0 and 1. 32 symbols, so a random byte maps without bias.
const RoomAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// RoomCodeLength is the number of characters of a room code.
const RoomCodeLength = 4

type room struct {
	code      string
	host      *session
	createdAt time.Time
}

func (s *Server) onQueue(sess *session, m *clientMsg, now time.Time) {
	char, ok := s.charOf(sess, m)
	if !ok {
		s.errorLocked(sess, "bad_message", "unknown char")
		return
	}
	if !s.leaveLobbyLocked(sess, now) {
		s.errorLocked(sess, "bad_state", "already in a match")
		return
	}
	sess.char = char
	sess.state = stQueued
	sess.queuedAt = now
	sess.queuedSent = 0
	s.queue = append(s.queue, sess)
	s.sendLocked(sess, withInt("queued", "waited", 0))
	s.matchQueueLocked(now)
}

func (s *Server) unqueueLocked(sess *session) {
	if i := slices.Index(s.queue, sess); i >= 0 {
		s.queue = slices.Delete(s.queue, i, i+1)
	}
}

// matchQueueLocked pairs waiting players, oldest first. A player is paired
// with the oldest player of the same region; once the older of the two has
// waited SameRegionFor, with the oldest player of any region. Two connections
// with the same player id are never paired.
func (s *Server) matchQueueLocked(now time.Time) {
	for i := 0; i < len(s.queue); i++ {
		a := s.queue[i]
		widened := now.Sub(a.queuedAt) >= s.cfg.SameRegionFor
		pick := -1
		for j := i + 1; j < len(s.queue); j++ {
			b := s.queue[j]
			if b.id == a.id {
				continue
			}
			if b.region == a.region {
				pick = j
				break
			}
			if widened && pick < 0 {
				pick = j
			}
		}
		if pick < 0 {
			continue
		}
		b := s.queue[pick]
		s.queue = slices.Delete(s.queue, pick, pick+1)
		s.queue = slices.Delete(s.queue, i, i+1)
		i--
		s.startMatchLocked([2]*session{a, b}, now, "queue")
	}
}

func (s *Server) onRoomCreate(sess *session, m *clientMsg, now time.Time) {
	char, ok := s.charOf(sess, m)
	if !ok {
		s.errorLocked(sess, "bad_message", "unknown char")
		return
	}
	if !s.leaveLobbyLocked(sess, now) {
		s.errorLocked(sess, "bad_state", "already in a match")
		return
	}
	if len(s.rooms) >= s.cfg.MaxRooms {
		s.errorLocked(sess, "server_busy", "too many rooms")
		return
	}
	code := s.newRoomCodeLocked()
	if code == "" {
		s.errorLocked(sess, "server_busy", "no free room code")
		return
	}
	r := &room{code: code, host: sess, createdAt: now}
	s.rooms[code] = r
	sess.char = char
	sess.state = stRoom
	sess.room = r
	s.totals.Rooms++
	s.sendLocked(sess, mustJSON(map[string]string{"t": "room", "code": code}))
}

func (s *Server) newRoomCodeLocked() string {
	for range 32 {
		b := s.randBytes(RoomCodeLength)
		for i := range b {
			b[i] = RoomAlphabet[int(b[i])%len(RoomAlphabet)]
		}
		code := string(b)
		_, open := s.rooms[code]
		_, full := s.fullRooms[code]
		if !open && !full {
			return code
		}
	}
	return ""
}

// NormalizeRoomCode upper-cases and trims a typed code; ok is false when it
// cannot be a room code.
func NormalizeRoomCode(code string) (string, bool) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if len(code) != RoomCodeLength {
		return code, false
	}
	for i := 0; i < len(code); i++ {
		if strings.IndexByte(RoomAlphabet, code[i]) < 0 {
			return code, false
		}
	}
	return code, true
}

func (s *Server) onRoomJoin(sess *session, m *clientMsg, now time.Time) {
	char, ok := s.charOf(sess, m)
	if !ok {
		s.errorLocked(sess, "bad_message", "unknown char")
		return
	}
	code, ok := NormalizeRoomCode(m.Code)
	if !ok {
		s.errorLocked(sess, "bad_room", "not a room code")
		return
	}
	r := s.rooms[code]
	if r != nil && now.Sub(r.createdAt) >= s.cfg.RoomTTL {
		s.expireRoomLocked(code, r)
		r = nil
	}
	if r == nil {
		if _, full := s.fullRooms[code]; full {
			s.errorLocked(sess, "room_full", "this room already has two players")
		} else {
			s.errorLocked(sess, "bad_room", "no such room")
		}
		return
	}
	if r.host == sess || r.host.id == sess.id {
		s.errorLocked(sess, "bad_room", "this is your own room")
		return
	}
	if !s.leaveLobbyLocked(sess, now) {
		s.errorLocked(sess, "bad_state", "already in a match")
		return
	}
	delete(s.rooms, code)
	if len(s.fullRooms) < 4*s.cfg.MaxRooms {
		s.fullRooms[code] = r.createdAt
	}
	host := r.host
	host.room = nil
	sess.char = char
	s.startMatchLocked([2]*session{host, sess}, now, "room")
}

func (s *Server) expireRoomLocked(code string, r *room) {
	delete(s.rooms, code)
	s.totals.RoomsExpired++
	if h := r.host; h != nil && h.room == r {
		h.room = nil
		h.state = stLobby
		s.sendLocked(h, errMsg("room_expired", "nobody joined in time"))
	}
}
