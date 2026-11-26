// Package replay keeps finished rounds by id so a client or an auditor can read
// one back exactly as it was played. The store is in memory and, with a limit,
// forgets the oldest rounds first; a real deployment writes rounds to durable
// storage behind the same two methods.
//
// Split from <original-cascade-slot>/server/internal/store (made generic;
// the source kept every round forever).
package replay

import (
	"errors"
	"sync"
)

// ErrNotFound is returned for an unknown (or forgotten) round id.
var ErrNotFound = errors.New("round not found")

// Store keeps values of type T by id. Safe for concurrent use.
type Store[T any] struct {
	mu    sync.RWMutex
	limit int
	order []string
	items map[string]T
}

// NewStore keeps at most limit rounds (0: no limit).
func NewStore[T any](limit int) *Store[T] {
	return &Store[T]{limit: limit, items: map[string]T{}}
}

// Save stores value under id; saving an id again replaces it.
func (s *Store[T]) Save(id string, value T) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[id]; !ok {
		s.order = append(s.order, id)
	}
	s.items[id] = value
	for s.limit > 0 && len(s.order) > s.limit {
		delete(s.items, s.order[0])
		s.order = s.order[1:]
	}
}

// Get returns the value stored under id.
func (s *Store[T]) Get(id string) (T, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.items[id]
	if !ok {
		var zero T
		return zero, ErrNotFound
	}
	return v, nil
}

// Len is how many rounds are kept.
func (s *Store[T]) Len() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.items)
}
