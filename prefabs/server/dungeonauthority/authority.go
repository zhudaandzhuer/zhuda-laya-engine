// Package dungeonauthority is Dungeon Spin's in-memory authority: a wallet per player
// (100000 points to start), atomic play (bet and win applied together, nothing on a
// rejection), and every round kept by id for replay. A development seam, not a ledger:
// nothing survives a restart. From games/dungeon-spin/server/internal/authority, unchanged
// but for the package name.
package dungeonauthority

import (
	"fmt"
	"sync"

	gameMath "zhudagamecenter/commonprefabs/server/dungeonmath"
)

type Round struct {
	ID          string                 `json:"id"`
	Sequence    int64                  `json:"sequence"`
	PlayerID    string                 `json:"playerId"`
	Fixture     string                 `json:"fixture"`
	Result      gameMath.ResolvedRound `json:"result"`
	PointsAfter int64                  `json:"pointsAfter"`
}

type Wallet struct {
	Points   int64 `json:"points"`
	Sequence int64 `json:"sequence"`
}

type Service struct {
	mu      sync.Mutex
	wallets map[string]Wallet
	rounds  map[string]Round
}

func NewService() *Service { return &Service{wallets: map[string]Wallet{}, rounds: map[string]Round{}} }

func (s *Service) Balance(playerID string) Wallet {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.wallet(playerID)
}

func (s *Service) Play(playerID, fixture string, singleBet int64) (Round, error) {
	if playerID == "" {
		return Round{}, fmt.Errorf("playerId is required")
	}
	result, err := gameMath.Resolve(fixture, singleBet)
	if err != nil {
		return Round{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	wallet := s.wallet(playerID)
	if wallet.Points < result.TotalBet {
		return Round{}, fmt.Errorf("insufficient points")
	}
	wallet.Sequence++
	wallet.Points -= result.TotalBet
	wallet.Points += result.MainWin + result.BonusWin
	s.wallets[playerID] = wallet
	round := Round{ID: fmt.Sprintf("%s-%d", playerID, wallet.Sequence), Sequence: wallet.Sequence, PlayerID: playerID, Fixture: fixture, Result: result, PointsAfter: wallet.Points}
	s.rounds[round.ID] = round
	return round, nil
}

func (s *Service) Round(id string) (Round, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	round, ok := s.rounds[id]
	return round, ok
}

func (s *Service) wallet(playerID string) Wallet {
	wallet, ok := s.wallets[playerID]
	if !ok {
		wallet = Wallet{Points: 100000}
		s.wallets[playerID] = wallet
	}
	return wallet
}
