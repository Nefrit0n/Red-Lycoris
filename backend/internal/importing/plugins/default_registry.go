package plugins

import "lotus-warden/backend/internal/parser"

var defaultRegistry = func() *Registry {
	registry := NewRegistry()

	// Existing parsers with normalizers
	registry.Register(newParserPlugin(&parser.TrivyParser{}, detectSarifVersion, 100, normalizeTrivyFindings))
	registry.Register(newParserPlugin(&parser.SemgrepParser{}, detectSemgrepVersion, 100, normalizeSemgrepFindings))

	// OpenGrep produces Semgrep-compatible JSON — reuse the same parser/normalizer under alias
	registry.Register(newParserPluginWithAlias("opengrep", &parser.SemgrepParser{}, detectSemgrepVersion, 100, normalizeSemgrepFindings))
	registry.Register(newParserPlugin(&parser.ZapParser{}, detectSarifVersion, 100, normalizeZapFindings))
	registry.Register(newParserPlugin(&parser.SarifParser{}, detectSarifVersion, 90, normalizeSASTFindings))

	// SAST parsers
	registry.Register(newParserPlugin(&parser.BanditParser{}, detectSarifVersion, 100, normalizeSASTFindings))
	registry.Register(newParserPlugin(&parser.CodeQLParser{}, detectSarifVersion, 100, normalizeSASTFindings))
	registry.Register(newParserPlugin(&parser.GosecParser{}, detectSarifVersion, 100, normalizeSASTFindings))

	// SCA parsers
	registry.Register(newParserPlugin(&parser.SnykParser{}, detectSarifVersion, 100, normalizeSCAFindings))
	registry.Register(newParserPlugin(&parser.NpmAuditParser{}, nil, 100, normalizeSCAFindings))
	registry.Register(newParserPlugin(&parser.PipAuditParser{}, nil, 100, normalizeSCAFindings))

	// DAST parsers
	registry.Register(newParserPlugin(&parser.NucleiParser{}, nil, 100, normalizeDASTFindings))

	// Secrets parsers
	registry.Register(newParserPlugin(&parser.GitleaksParser{}, detectSarifVersion, 100, normalizeSecretsFindings))
	registry.Register(newParserPlugin(&parser.TruffleHogParser{}, nil, 100, normalizeSecretsFindings))
	registry.Register(newParserPlugin(&parser.DetectSecretsParser{}, nil, 100, normalizeSecretsFindings))

	// Container parsers
	registry.Register(newParserPlugin(&parser.GrypeParser{}, detectSarifVersion, 100, normalizeContainerFindings))

	// IaC parsers
	registry.Register(newParserPlugin(&parser.CheckovParser{}, detectSarifVersion, 100, normalizeIACFindings))
	registry.Register(newParserPlugin(&parser.KICSParser{}, detectSarifVersion, 100, normalizeIACFindings))
	registry.Register(newParserPlugin(&parser.TfsecParser{}, detectSarifVersion, 100, normalizeIACFindings))
	registry.Register(newParserPlugin(&parser.TerrascanParser{}, detectSarifVersion, 100, normalizeIACFindings))

	// Text fallback parsers
	registry.Register(newParserPlugin(parser.NewTextParser("trivy"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("semgrep"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("opengrep"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("zap"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("bandit"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("codeql"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("gosec"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("snyk"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("npm-audit"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("pip-audit"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("nuclei"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("gitleaks"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("trufflehog"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("detect-secrets"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("grype"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("checkov"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("kics"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("tfsec"), nil, 10, nil))
	registry.Register(newParserPlugin(parser.NewTextParser("terrascan"), nil, 10, nil))

	return registry
}()

func DefaultRegistry() *Registry {
	return defaultRegistry
}
