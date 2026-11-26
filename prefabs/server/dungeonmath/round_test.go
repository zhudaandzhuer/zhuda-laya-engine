package dungeonmath_test

import (
	"testing"
	gameMath "zhudagamecenter/commonprefabs/server/dungeonmath"
)

func TestResolveScalesAndRejectsInvalidBets(t *testing.T) {
	result, err := gameMath.Resolve("boss", 20)
	if err != nil {
		t.Fatal(err)
	}
	if result.TotalBet != 180 || result.MainWin != 1700 || result.BonusWin != 90720 {
		t.Fatalf("unexpected scaled result: %+v", result)
	}
	if _, err := gameMath.Resolve("boss", 11); err == nil {
		t.Fatal("invalid bet accepted")
	}
}

func TestResolveUnknownFixture(t *testing.T) {
	if _, err := gameMath.Resolve("missing", 10); err == nil {
		t.Fatal("unknown fixture accepted")
	}
}
