package wallet_test

import (
	"fmt"
	"sync"
	"testing"

	"zhudagamecenter/commonprefabs/server/wallet"
)

// Ported from the source's TestSeamlessWallet_Basic.
func TestBetAndWin(t *testing.T) {
	w := wallet.NewManager(100000)
	if b := w.Balance("p1"); b != 100000 {
		t.Fatalf("initial balance %d", b)
	}
	if b, err := w.Bet("p1", "r1", "tx_bet_1", 50); err != nil || b != 99950 {
		t.Fatalf("bet: %d %v", b, err)
	}
	if b, err := w.Win("p1", "r1", "tx_win_1", 150); err != nil || b != 100100 {
		t.Fatalf("win: %d %v", b, err)
	}
}

// The source ignored this argument and always gave 100000.
func TestInitialBalanceIsUsed(t *testing.T) {
	if b := wallet.NewManager(500).Balance("new"); b != 500 {
		t.Fatalf("initial balance %d, want 500", b)
	}
}

// Ported from TestSeamlessWallet_Idempotency.
func TestReplayedTransactionsChangeNothing(t *testing.T) {
	w := wallet.NewManager(100000)
	for i := 0; i < 2; i++ {
		if b, err := w.Bet("p", "r", "tx_unique_01", 100); err != nil || b != 99900 {
			t.Fatalf("bet %d: %d %v", i, b, err)
		}
	}
	for i := 0; i < 2; i++ {
		if b, err := w.Win("p", "r", "tx_unique_win_01", 500); err != nil || b != 100400 {
			t.Fatalf("win %d: %d %v", i, b, err)
		}
	}
}

// Ported from TestSeamlessWallet_InsufficientBalance.
func TestInsufficientBalance(t *testing.T) {
	w := wallet.NewManager(100000)
	if _, err := w.Bet("poor", "r", "tx", 200000); err != wallet.ErrInsufficient {
		t.Fatalf("got %v", err)
	}
	if _, ok := w.Tx("tx"); ok {
		t.Fatal("a refused bet was recorded")
	}
	if w.Balance("poor") != 100000 {
		t.Fatal("a refused bet changed the balance")
	}
}

// Ported from TestSeamlessWallet_ConcurrentTransactions.
func TestConcurrentBetsAndWins(t *testing.T) {
	w := wallet.NewManager(100000)
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			r := fmt.Sprintf("r%d", i)
			if _, err := w.Bet("c", r, "bet_"+r, 10); err != nil {
				t.Error(err)
			}
			if _, err := w.Win("c", r, "win_"+r, 10); err != nil {
				t.Error(err)
			}
		}(i)
	}
	wg.Wait()
	if b := w.Balance("c"); b != 100000 {
		t.Fatalf("balance %d after 50 even rounds", b)
	}
}

func TestRollbackRefundsARecordedBetOnce(t *testing.T) {
	w := wallet.NewManager(1000)
	if _, err := w.Rollback("nope"); err != wallet.ErrUnknownBet {
		t.Fatalf("rollback of nothing: %v", err)
	}
	w.Bet("p", "r", "tx_bet_r", 300)
	w.Win("p", "r", "tx_win_r", 50)
	if _, err := w.Rollback("tx_win_r"); err != wallet.ErrUnknownBet {
		t.Fatal("a win was rolled back")
	}
	for i := 0; i < 3; i++ {
		if b, err := w.Rollback("tx_bet_r"); err != nil || b != 1050 {
			t.Fatalf("rollback %d: %d %v", i, b, err)
		}
	}
	if tx, ok := w.Tx("rb_tx_bet_r"); !ok || tx.Kind != wallet.KindRollback || tx.Amount != 300 {
		t.Fatalf("rollback record %+v", tx)
	}
}

func TestSpinLock(t *testing.T) {
	w := wallet.NewManager(0)
	if !w.TryLockUser("p") || w.TryLockUser("p") {
		t.Fatal("second lock must fail")
	}
	if !w.TryLockUser("q") {
		t.Fatal("another player is independent")
	}
	w.UnlockUser("p")
	if !w.TryLockUser("p") {
		t.Fatal("lock not released")
	}
}
