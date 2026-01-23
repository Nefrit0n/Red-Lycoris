package policies

import (
	"context"
	"fmt"
	"sync"

	"github.com/open-policy-agent/opa/v1/rego"
)

type moduleCache struct {
	mu    sync.RWMutex
	cache map[string]rego.PreparedEvalQuery
}

func newModuleCache() *moduleCache {
	return &moduleCache{cache: make(map[string]rego.PreparedEvalQuery)}
}

func (c *moduleCache) getOrCompile(ctx context.Context, rule PolicyRule) (rego.PreparedEvalQuery, error) {
	entrypoint := defaultEntrypoint
	if rule.Entrypoint != nil && *rule.Entrypoint != "" {
		entrypoint = *rule.Entrypoint
	}
	key := fmt.Sprintf("%s:%s", rule.Sha256, entrypoint)

	c.mu.RLock()
	prepared, ok := c.cache[key]
	c.mu.RUnlock()
	if ok {
		return prepared, nil
	}

	r := rego.New(
		rego.Query(entrypoint),
		rego.Module("policy.rego", rule.Content),
	)

	prepared, err := r.PrepareForEval(ctx)
	if err != nil {
		return rego.PreparedEvalQuery{}, err
	}

	c.mu.Lock()
	c.cache[key] = prepared
	c.mu.Unlock()
	return prepared, nil
}
