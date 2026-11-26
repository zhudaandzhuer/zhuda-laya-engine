// Package wallet is a seamless-wallet seam for a game server: per-player
// balances in integer units, bet/win/rollback transactions that are idempotent
// by transaction id, and a per-player lock so one player cannot run two rounds
// at once. It keeps everything in memory: a real deployment replaces it with
// the operator's wallet API behind the same methods.
//
// Split from <original-cascade-slot>/server/internal/wallet. Changes: the
// initial balance argument is used (the source ignored it and always gave
// 100000), and Rollback refunds a recorded bet instead of any amount.
package wallet

import (
	"errors"
	"sync"
	"time"
)

// Transaction kinds.
const (
	KindBet      = "BET"
	KindWin      = "WIN"
	KindRollback = "ROLLBACK"
)

// ErrInsufficient is returned by Bet when the balance is lower than the amount.
var ErrInsufficient = errors.New("insufficient balance")

// ErrUnknownBet is returned by Rollback for a transaction that is not a recorded bet.
var ErrUnknownBet = errors.New("no such bet to roll back")

// Transaction is one recorded balance change; Balance is the balance after it.
type Transaction struct {
	TxID      string    `json:"txId"`
	RoundID   string    `json:"roundId"`
	UserID    string    `json:"userId"`
	Kind      string    `json:"kind"`
	Amount    int       `json:"amount"`
	Balance   int       `json:"balance"`
	CreatedAt time.Time `json:"createdAt"`
}

// Manager holds balances, transactions and spin locks. Safe for concurrent use.
type Manager struct {
	mu       sync.Mutex
	initial  int
	balances map[string]int
	locks    map[string]bool
	txs      map[string]Transaction
	// Now stamps transactions; nil uses time.Now.
	Now func() time.Time
}

// NewManager gives every new player initialBalance.
func NewManager(initialBalance int) *Manager {
	return &Manager{initial: initialBalance, balances: map[string]int{}, locks: map[string]bool{}, txs: map[string]Transaction{}}
}

func (w *Manager) now() time.Time {
	if w.Now != nil {
		return w.Now()
	}
	return time.Now()
}

func (w *Manager) balance(userID string) int {
	bal, ok := w.balances[userID]
	if !ok {
		bal = w.initial
		w.balances[userID] = bal
	}
	return bal
}

// TryLockUser takes the player's spin lock; false when a round is running.
func (w *Manager) TryLockUser(userID string) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.locks[userID] {
		return false
	}
	w.locks[userID] = true
	return true
}

// UnlockUser releases the spin lock.
func (w *Manager) UnlockUser(userID string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	delete(w.locks, userID)
}

// Balance returns the player's balance (a new player gets the initial balance).
func (w *Manager) Balance(userID string) int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.balance(userID)
}

func (w *Manager) record(tx Transaction) {
	tx.CreatedAt = w.now()
	w.txs[tx.TxID] = tx
}

// Bet takes amount. Replaying a txID returns the balance recorded then and
// changes nothing.
func (w *Manager) Bet(userID, roundID, txID string, amount int) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if tx, ok := w.txs[txID]; ok {
		return tx.Balance, nil
	}
	if amount < 0 {
		return w.balance(userID), errors.New("negative bet")
	}
	bal := w.balance(userID)
	if bal < amount {
		return bal, ErrInsufficient
	}
	bal -= amount
	w.balances[userID] = bal
	w.record(Transaction{TxID: txID, RoundID: roundID, UserID: userID, Kind: KindBet, Amount: amount, Balance: bal})
	return bal, nil
}

// Win pays amount. Replaying a txID returns the balance recorded then.
func (w *Manager) Win(userID, roundID, txID string, amount int) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if tx, ok := w.txs[txID]; ok {
		return tx.Balance, nil
	}
	if amount < 0 {
		return w.balance(userID), errors.New("negative win")
	}
	bal := w.balance(userID) + amount
	w.balances[userID] = bal
	w.record(Transaction{TxID: txID, RoundID: roundID, UserID: userID, Kind: KindWin, Amount: amount, Balance: bal})
	return bal, nil
}

// Rollback refunds the bet betTxID once (its rollback id is "rb_"+betTxID).
func (w *Manager) Rollback(betTxID string) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	bet, ok := w.txs[betTxID]
	if !ok || bet.Kind != KindBet {
		return 0, ErrUnknownBet
	}
	id := "rb_" + betTxID
	if tx, ok := w.txs[id]; ok {
		return tx.Balance, nil
	}
	bal := w.balance(bet.UserID) + bet.Amount
	w.balances[bet.UserID] = bal
	w.record(Transaction{TxID: id, RoundID: bet.RoundID, UserID: bet.UserID, Kind: KindRollback, Amount: bet.Amount, Balance: bal})
	return bal, nil
}

// Tx returns a recorded transaction.
func (w *Manager) Tx(txID string) (Transaction, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()
	tx, ok := w.txs[txID]
	return tx, ok
}
