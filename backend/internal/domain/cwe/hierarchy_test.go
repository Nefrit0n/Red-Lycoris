package cwe

import (
	"testing"
)

func TestResolveParentChain_Empty(t *testing.T) {
	lookup := func(int) (string, []int, string, bool) { return "", nil, "", false }

	if got := ResolveParentChain(nil, 5, lookup); got != nil {
		t.Errorf("expected nil for empty parentIDs, got %v", got)
	}
	if got := ResolveParentChain([]int{}, 5, lookup); got != nil {
		t.Errorf("expected nil for empty parentIDs slice, got %v", got)
	}
	if got := ResolveParentChain([]int{59}, 0, lookup); got != nil {
		t.Errorf("expected nil for maxDepth=0, got %v", got)
	}
}

func TestResolveParentChain_SingleLevel(t *testing.T) {
	// maxDepth=1 должен вернуть только первый уровень
	db := map[int]struct {
		name     string
		parents  []int
		category string
	}{
		59:  {name: "Link Resolution", parents: []int{706}, category: "Base"},
		706: {name: "Incorrect Use of Privileged APIs", parents: nil, category: "Class"},
	}

	lookup := func(id int) (string, []int, string, bool) {
		if e, ok := db[id]; ok {
			return e.name, e.parents, e.category, true
		}
		return "", nil, "", false
	}

	chain := ResolveParentChain([]int{59}, 1, lookup)
	if len(chain) != 1 {
		t.Fatalf("expected 1 entry, got %d: %v", len(chain), chain)
	}
	if chain[0].CWEID != 59 || chain[0].Name != "Link Resolution" {
		t.Errorf("unexpected chain[0]: %+v", chain[0])
	}
}

func TestResolveParentChain_TwoLevels(t *testing.T) {
	db := map[int]struct {
		name     string
		parents  []int
		category string
	}{
		59:  {name: "Link Resolution", parents: []int{706}, category: "Base"},
		706: {name: "Incorrect Use of Privileged APIs", parents: nil, category: "Class"},
	}

	lookup := func(id int) (string, []int, string, bool) {
		if e, ok := db[id]; ok {
			return e.name, e.parents, e.category, true
		}
		return "", nil, "", false
	}

	chain := ResolveParentChain([]int{59}, 5, lookup)
	if len(chain) != 2 {
		t.Fatalf("expected 2 entries, got %d: %v", len(chain), chain)
	}
	if chain[0].CWEID != 59 {
		t.Errorf("expected chain[0].CWEID=59, got %d", chain[0].CWEID)
	}
	if chain[1].CWEID != 706 {
		t.Errorf("expected chain[1].CWEID=706, got %d", chain[1].CWEID)
	}
}

func TestResolveParentChain_NoCycle(t *testing.T) {
	// CWE-A parent=[B], CWE-B parent=[A] → не должно зацикливаться
	lookup := func(id int) (string, []int, string, bool) {
		switch id {
		case 100:
			return "CWE-A", []int{200}, "Base", true
		case 200:
			return "CWE-B", []int{100}, "Base", true
		}
		return "", nil, "", false
	}

	chain := ResolveParentChain([]int{100}, 10, lookup)
	// Должно вернуться ровно 2 записи (100 и 200), без зацикливания
	if len(chain) != 2 {
		t.Fatalf("expected 2 entries for cycle, got %d: %v", len(chain), chain)
	}
}

func TestResolveParentChain_UnknownParentSkipped(t *testing.T) {
	lookup := func(id int) (string, []int, string, bool) {
		if id == 59 {
			return "Link Resolution", []int{9999}, "Base", true
		}
		return "", nil, "", false
	}

	chain := ResolveParentChain([]int{59}, 5, lookup)
	if len(chain) != 1 {
		t.Fatalf("expected 1 entry (unknown parent skipped), got %d: %v", len(chain), chain)
	}
	if chain[0].CWEID != 59 {
		t.Errorf("expected CWEID=59, got %d", chain[0].CWEID)
	}
}
