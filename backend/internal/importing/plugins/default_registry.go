package plugins

import "lotus-warden/backend/internal/parser"

var defaultRegistry = func() *Registry {
	registry := NewRegistry()

	registry.Register(newParserPlugin(&parser.TrivyParser{}, detectSarifVersion, 100, normalizeTrivyFindings))
	registry.Register(newParserPlugin(&parser.SemgrepParser{}, detectSemgrepVersion, 100, normalizeSemgrepFindings))
	registry.Register(newParserPlugin(&parser.ZapParser{}, detectSarifVersion, 100, normalizeZapFindings))
	registry.Register(newParserPlugin(&parser.SarifParser{}, detectSarifVersion, 90, nil))

	registry.Register(newParserPlugin(parser.NewTextParser("trivy"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("semgrep"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("zap"), nil, 10, nil))

	return registry
}()

func DefaultRegistry() *Registry {
	return defaultRegistry
}
