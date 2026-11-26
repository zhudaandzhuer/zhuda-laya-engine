package authjwt_test

import (
	"strings"
	"testing"
	"time"

	"zhudagamecenter/commonprefabs/server/authjwt"
)

func TestSignVerify(t *testing.T) {
	claims := authjwt.Claims{UserID: "p1", OperatorID: "op", Currency: "DEMO", ExpiresAt: 2000}
	token, err := authjwt.Sign(claims, "s3cret")
	if err != nil || strings.Count(token, ".") != 2 {
		t.Fatalf("token %q %v", token, err)
	}
	got, err := authjwt.VerifyAt(token, "s3cret", time.Unix(1999, 0))
	if err != nil || *got != claims {
		t.Fatalf("verify: %+v %v", got, err)
	}
	if _, err := authjwt.VerifyAt(token, "s3cret", time.Unix(2001, 0)); err != authjwt.ErrExpired {
		t.Fatalf("expired: %v", err)
	}
	if _, err := authjwt.VerifyAt(token, "other", time.Unix(1, 0)); err != authjwt.ErrSignature {
		t.Fatalf("wrong secret: %v", err)
	}
	parts := strings.Split(token, ".")
	forged, _ := authjwt.Sign(authjwt.Claims{UserID: "admin"}, "x")
	tampered := parts[0] + "." + strings.Split(forged, ".")[1] + "." + parts[2]
	if _, err := authjwt.VerifyAt(tampered, "s3cret", time.Unix(1, 0)); err != authjwt.ErrSignature {
		t.Fatalf("tampered claims: %v", err)
	}
	for _, bad := range []string{"", "a.b", "a.b.c.d", "a.b.!!"} {
		if _, err := authjwt.Verify(bad, "s3cret"); err == nil {
			t.Fatalf("accepted %q", bad)
		}
	}
	never, _ := authjwt.Sign(authjwt.Claims{UserID: "p"}, "k")
	if _, err := authjwt.VerifyAt(never, "k", time.Unix(1<<40, 0)); err != nil {
		t.Fatalf("exp 0 never expires: %v", err)
	}
	if _, err := authjwt.Sign(claims, ""); err != authjwt.ErrSecret {
		t.Fatal("empty secret accepted")
	}
}
