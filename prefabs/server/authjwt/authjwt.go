// Package authjwt signs and verifies HS256 JSON Web Tokens with the standard
// library only: a player token carries the player (sub), the operator (op), the
// currency (cur) and an expiry (exp, Unix seconds; 0 = none).
//
// Split from <original-cascade-slot>/server/pkg/jwt (same token format).
// Added: VerifyAt with an explicit clock, a header check, and an empty-secret guard.
package authjwt

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Claims of a player token.
type Claims struct {
	UserID     string `json:"sub"`
	OperatorID string `json:"op"`
	Currency   string `json:"cur"`
	ExpiresAt  int64  `json:"exp"`
}

var (
	ErrFormat    = errors.New("invalid jwt format")
	ErrSignature = errors.New("signature mismatch or tampering detected")
	ErrExpired   = errors.New("token expired")
	ErrSecret    = errors.New("empty secret")
)

var enc = base64.RawURLEncoding

func sign(input, secret string) []byte {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(input))
	return mac.Sum(nil)
}

// Sign returns header.claims.signature.
func Sign(claims Claims, secret string) (string, error) {
	if secret == "" {
		return "", ErrSecret
	}
	header, _ := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	body, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	input := enc.EncodeToString(header) + "." + enc.EncodeToString(body)
	return input + "." + enc.EncodeToString(sign(input, secret)), nil
}

// Verify checks a token against secret at the current time.
func Verify(token, secret string) (*Claims, error) {
	return VerifyAt(token, secret, time.Now())
}

// VerifyAt checks the signature (constant-time), the header's alg and the expiry at now.
func VerifyAt(token, secret string, now time.Time) (*Claims, error) {
	if secret == "" {
		return nil, ErrSecret
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, ErrFormat
	}
	got, err := enc.DecodeString(parts[2])
	if err != nil || !hmac.Equal(sign(parts[0]+"."+parts[1], secret), got) {
		return nil, ErrSignature
	}
	headerBytes, err := enc.DecodeString(parts[0])
	if err != nil {
		return nil, ErrFormat
	}
	var header struct {
		Alg string `json:"alg"`
	}
	if json.Unmarshal(headerBytes, &header) != nil || header.Alg != "HS256" {
		return nil, ErrFormat
	}
	body, err := enc.DecodeString(parts[1])
	if err != nil {
		return nil, ErrFormat
	}
	var claims Claims
	if err := json.Unmarshal(body, &claims); err != nil {
		return nil, ErrFormat
	}
	if claims.ExpiresAt > 0 && now.Unix() > claims.ExpiresAt {
		return nil, ErrExpired
	}
	return &claims, nil
}
