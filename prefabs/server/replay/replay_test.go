package replay_test

import (
	"testing"

	"zhudagamecenter/commonprefabs/server/replay"
)

func TestStore(t *testing.T) {
	s := replay.NewStore[int](2)
	s.Save("a", 1)
	s.Save("b", 2)
	s.Save("a", 10) // replace keeps its place
	if v, err := s.Get("a"); err != nil || v != 10 {
		t.Fatalf("a = %d %v", v, err)
	}
	s.Save("c", 3) // forgets the oldest: a
	if _, err := s.Get("a"); err != replay.ErrNotFound {
		t.Fatal("oldest not forgotten")
	}
	if v, _ := s.Get("c"); v != 3 || s.Len() != 2 {
		t.Fatal("c missing")
	}
	u := replay.NewStore[string](0)
	for i := 0; i < 1000; i++ {
		u.Save(string(rune('a'+i%26))+string(rune(i)), "x")
	}
	if u.Len() != 1000 {
		t.Fatalf("unlimited store kept %d", u.Len())
	}
}
