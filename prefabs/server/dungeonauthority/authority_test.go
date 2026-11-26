package dungeonauthority_test

import (
	"testing"
	authority "zhudagamecenter/commonprefabs/server/dungeonauthority"
)

func TestPlayIsAtomicAndReplayable(t *testing.T) {
	service := authority.NewService()
	round, err := service.Play("p1", "three", 10)
	if err != nil {
		t.Fatal(err)
	}
	if round.PointsAfter != 100010 || round.Sequence != 1 {
		t.Fatalf("unexpected wallet: %+v", round)
	}
	replayed, ok := service.Round(round.ID)
	if !ok || replayed.PointsAfter != round.PointsAfter {
		t.Fatalf("round was not retained: %+v", replayed)
	}
}

func TestInsufficientPointsDoesNotAdvance(t *testing.T) {
	service := authority.NewService()
	for i := 0; i < 1112; i++ {
		if _, err := service.Play("p1", "empty", 50); err != nil {
			break
		}
	}
	wallet := service.Balance("p1")
	if wallet.Points >= 450 {
		t.Fatalf("wallet should be below one bet: %+v", wallet)
	}
	if _, err := service.Play("p1", "empty", 50); err == nil {
		t.Fatal("insufficient points accepted")
	}
	if got := service.Balance("p1").Sequence; got != wallet.Sequence {
		t.Fatalf("sequence advanced on rejection: %d -> %d", wallet.Sequence, got)
	}
}
