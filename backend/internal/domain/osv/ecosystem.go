package osv

import "strings"

// DetectEcosystem определяет OSV ecosystem на основе данных находки.
//
// Приоритет источников сигнала:
//  1. Явный маппинг по source_type/kind находки (самый надёжный)
//  2. Синтаксис имени компонента (fallback)
//
// Возвращает пустую строку если определить не удалось — тогда
// в enrich.go fallback на матч по CVE без ecosystem.
func DetectEcosystem(sourceType, kind, component string) string {
	// kind зарезервирован для последующего уточнения логики, сейчас
	// полагаемся на sourceType + component.
	_ = kind

	// Шаг 1: по source_type/kind — самый точный путь.
	// source_type приходит из SARIF/Trivy/generic
	if eco := ecosystemFromSource(sourceType); eco != "" {
		return eco
	}

	// Шаг 2: по синтаксису component string
	return ecosystemFromComponent(component)
}

func ecosystemFromSource(sourceType string) string {
	s := strings.ToLower(strings.TrimSpace(sourceType))
	// Маппинг известных источников SCA-сканеров на OSV ecosystem.
	// Если встретится новый source_type — не маппим, это ок.
	switch {
	case strings.Contains(s, "trivy"):
		// Trivy сам разный — не угадываем по source_type, даём
		// fallback на component syntax. Возвращаем пусто.
		return ""
	case strings.Contains(s, "npm"):
		return "npm"
	case strings.Contains(s, "pip"), strings.Contains(s, "pypi"), strings.Contains(s, "poetry"):
		return "PyPI"
	case strings.Contains(s, "cargo"):
		return "crates.io"
	case strings.Contains(s, "gem"):
		return "RubyGems"
	case strings.Contains(s, "maven"), strings.Contains(s, "gradle"):
		return "Maven"
	case strings.Contains(s, "nuget"):
		return "NuGet"
	case strings.Contains(s, "go-"), strings.Contains(s, "gomod"):
		return "Go"
	case strings.Contains(s, "composer"):
		return "Packagist"
	case strings.Contains(s, "hex"):
		return "Hex"
	case strings.Contains(s, "pub"):
		return "Pub"
	}
	return ""
}

func ecosystemFromComponent(component string) string {
	c := strings.TrimSpace(component)
	if c == "" {
		return ""
	}

	// npm scoped package: "@scope/package"
	if strings.HasPrefix(c, "@") && strings.Contains(c, "/") {
		return "npm"
	}

	// Maven: "groupId:artifactId"
	if strings.Count(c, ":") == 1 && !strings.Contains(c, "/") {
		return "Maven"
	}

	// Go modules: "github.com/owner/repo" или "golang.org/x/xxx"
	if strings.Contains(c, "/") {
		parts := strings.Split(c, "/")
		first := parts[0]
		// Go module patterns
		if strings.Contains(first, ".") &&
			(strings.Contains(first, "github.com") ||
				strings.Contains(first, "gitlab.com") ||
				strings.Contains(first, "golang.org") ||
				strings.Contains(first, ".io") ||
				strings.Contains(first, ".dev") ||
				strings.Contains(first, ".com") ||
				strings.Contains(first, ".org")) {
			return "Go"
		}
		// Иначе это скорее npm unscoped с косой чертой — редко, но
		// например Docker images так именуются в Trivy
		return "npm"
	}

	// Python-like: "django", "requests", "flask" — одно слово lowercase.
	// Очень приблизительно: если нет ни /, ни :, ни @ — считаем PyPI.
	// Это самый слабый сигнал, но лучше чем ничего.
	if !strings.ContainsAny(c, "/@:") {
		return "PyPI"
	}

	return ""
}
