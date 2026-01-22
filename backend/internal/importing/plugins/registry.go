package plugins

import (
	"fmt"
	"strings"

	"lotus-warden/backend/internal/parser"
)

// ErrUnsupportedFormat mirrors parser.ErrUnsupportedFormat for compatibility.
var ErrUnsupportedFormat = parser.ErrUnsupportedFormat

type Registry struct {
	plugins map[string][]ImportPlugin
}

func NewRegistry() *Registry {
	return &Registry{plugins: make(map[string][]ImportPlugin)}
}

func (r *Registry) Register(plugin ImportPlugin) {
	if plugin == nil {
		return
	}
	key := strings.ToLower(strings.TrimSpace(plugin.ScannerType()))
	if key == "" {
		return
	}
	r.plugins[key] = append(r.plugins[key], plugin)
}

func (r *Registry) GetBestMatch(scannerType string, data []byte) (ImportPlugin, string, error) {
	key := strings.ToLower(strings.TrimSpace(scannerType))
	if key == "" {
		return nil, "", fmt.Errorf("scanner_type is required")
	}
	plugins := r.plugins[key]
	if len(plugins) == 0 {
		return nil, "", fmt.Errorf("unknown scanner_type: %s", scannerType)
	}

	var best ImportPlugin
	bestScore := -1
	bestVersion := ""
	for _, plugin := range plugins {
		ok, version, score := plugin.DetectReport(data)
		if !ok {
			continue
		}
		if score > bestScore {
			best = plugin
			bestScore = score
			bestVersion = version
		}
	}

	if best == nil {
		return nil, "", ErrUnsupportedFormat
	}
	return best, bestVersion, nil
}
