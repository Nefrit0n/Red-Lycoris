package plugins

import "lotus-warden/backend/internal/parser"

var defaultRegistry = func() *Registry {
	registry := NewRegistry()

	registry.Register(newParserPlugin(&parser.TrivyParser{}, detectSarifVersion, 100))
	registry.Register(newParserPlugin(&parser.SemgrepParser{}, detectSemgrepVersion, 100))
	registry.Register(newParserPlugin(&parser.ZapParser{}, detectSarifVersion, 100))
	registry.Register(newParserPlugin(&parser.SarifParser{}, detectSarifVersion, 90))

	registry.Register(newParserPlugin(parser.NewTextParser("trivy"), nil, 10))
	registry.Register(newParserPlugin(parser.NewTextParser("semgrep"), nil, 10))
	registry.Register(newParserPlugin(parser.NewTextParser("zap"), nil, 10))

	return registry
}()

func DefaultRegistry() *Registry {
	return defaultRegistry
}
