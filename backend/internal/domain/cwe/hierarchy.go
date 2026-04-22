package cwe

// ParentChainEntry — один узел в цепочке родителей.
type ParentChainEntry struct {
	CWEID    int    `json:"cwe_id"`
	Name     string `json:"name"`
	Category string `json:"category,omitempty"` // Base/Variant/Class/Compound
}

// ResolveParentChain идёт вверх по parent_ids от заданного CWE,
// возвращая цепочку до корня (или до maxDepth).
// lookup — функция для получения данных CWE по ID (из БД).
//
// Пример: CWE-61 → [CWE-59, CWE-706, CWE-664]
//
// maxDepth = 5 — в реальности цепочка редко длиннее 4.
func ResolveParentChain(
	startParentIDs []int,
	maxDepth int,
	lookup func(cweID int) (name string, parentIDs []int, category string, found bool),
) []ParentChainEntry {
	if len(startParentIDs) == 0 || maxDepth <= 0 {
		return nil
	}

	var chain []ParentChainEntry
	visited := make(map[int]struct{})
	queue := make([]int, len(startParentIDs))
	copy(queue, startParentIDs)

	for depth := 0; depth < maxDepth && len(queue) > 0; depth++ {
		nextQueue := make([]int, 0)
		for _, id := range queue {
			if _, seen := visited[id]; seen {
				continue
			}
			visited[id] = struct{}{}

			name, parentIDs, category, found := lookup(id)
			if !found {
				continue
			}

			chain = append(chain, ParentChainEntry{
				CWEID:    id,
				Name:     name,
				Category: category,
			})

			for _, pid := range parentIDs {
				if _, seen := visited[pid]; !seen {
					nextQueue = append(nextQueue, pid)
				}
			}
		}
		queue = nextQueue
	}

	return chain
}
