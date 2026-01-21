package storage

import (
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// pqUUIDArray packs []uuid.UUID into a driver value understood by lib/pq.
// We use []string + ::uuid[] cast in SQL for reliability.
func pqUUIDArray(ids []uuid.UUID) any {
	ss := make([]string, len(ids))
	for i, id := range ids {
		ss[i] = id.String()
	}
	return pq.Array(ss)
}
