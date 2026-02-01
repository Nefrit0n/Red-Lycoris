// Scanner categories and types for the upload page

export type ScannerCategory =
  | "SAST"
  | "SCA"
  | "DAST"
  | "SECRETS"
  | "CONTAINER"
  | "IAC"
  | "API"
  | "OTHER";

export interface ScannerInfo {
  id: string;
  name: string;
  description: string;
  formats: string[];
  category: ScannerCategory;
  icon?: string;
  docsUrl?: string;
}

export interface ScannerCategoryInfo {
  id: ScannerCategory;
  name: string;
  description: string;
  scanners: ScannerInfo[];
}

export const SCANNER_CATEGORIES: Record<ScannerCategory, Omit<ScannerCategoryInfo, "scanners">> = {
  SAST: {
    id: "SAST",
    name: "SAST",
    description: "Static Application Security Testing",
  },
  SCA: {
    id: "SCA",
    name: "SCA",
    description: "Software Composition Analysis",
  },
  DAST: {
    id: "DAST",
    name: "DAST",
    description: "Dynamic Application Security Testing",
  },
  SECRETS: {
    id: "SECRETS",
    name: "Secrets",
    description: "Secret Detection",
  },
  CONTAINER: {
    id: "CONTAINER",
    name: "Container",
    description: "Container Security Scanning",
  },
  IAC: {
    id: "IAC",
    name: "IaC",
    description: "Infrastructure as Code Security",
  },
  API: {
    id: "API",
    name: "API Security",
    description: "API Security Testing",
  },
  OTHER: {
    id: "OTHER",
    name: "Other",
    description: "Other security tools and custom SARIF",
  },
};

export const SCANNERS: ScannerInfo[] = [
  // SAST
  {
    id: "semgrep",
    name: "Semgrep",
    description: "Lightweight static analysis for many languages",
    formats: ["json", "sarif"],
    category: "SAST",
    docsUrl: "https://semgrep.dev/docs/",
  },
  {
    id: "bandit",
    name: "Bandit",
    description: "Python security linter",
    formats: ["json", "sarif", "csv"],
    category: "SAST",
    docsUrl: "https://bandit.readthedocs.io/",
  },
  {
    id: "codeql",
    name: "CodeQL",
    description: "GitHub's semantic code analysis engine",
    formats: ["sarif"],
    category: "SAST",
    docsUrl: "https://codeql.github.com/docs/",
  },
  {
    id: "gosec",
    name: "Gosec",
    description: "Go security checker",
    formats: ["json", "sarif"],
    category: "SAST",
    docsUrl: "https://github.com/securego/gosec",
  },
  {
    id: "eslint-security",
    name: "ESLint Security",
    description: "Security rules for JavaScript/TypeScript",
    formats: ["json"],
    category: "SAST",
    docsUrl: "https://github.com/eslint-community/eslint-plugin-security",
  },

  // SCA
  {
    id: "trivy",
    name: "Trivy",
    description: "Comprehensive vulnerability scanner",
    formats: ["json", "sarif"],
    category: "SCA",
    docsUrl: "https://trivy.dev/",
  },
  {
    id: "snyk",
    name: "Snyk",
    description: "Developer security platform",
    formats: ["json", "sarif"],
    category: "SCA",
    docsUrl: "https://docs.snyk.io/",
  },
  {
    id: "dependency-check",
    name: "OWASP Dependency-Check",
    description: "Dependency vulnerability scanner",
    formats: ["json", "xml", "sarif"],
    category: "SCA",
    docsUrl: "https://owasp.org/www-project-dependency-check/",
  },
  {
    id: "npm-audit",
    name: "npm audit",
    description: "npm built-in security audit",
    formats: ["json"],
    category: "SCA",
    docsUrl: "https://docs.npmjs.com/cli/audit",
  },
  {
    id: "pip-audit",
    name: "pip-audit",
    description: "Python dependency vulnerability scanner",
    formats: ["json"],
    category: "SCA",
    docsUrl: "https://github.com/pypa/pip-audit",
  },

  // DAST
  {
    id: "zap",
    name: "OWASP ZAP",
    description: "Web application security scanner",
    formats: ["json", "sarif"],
    category: "DAST",
    docsUrl: "https://www.zaproxy.org/docs/",
  },
  {
    id: "nuclei",
    name: "Nuclei",
    description: "Fast vulnerability scanner based on templates",
    formats: ["json", "jsonl"],
    category: "DAST",
    docsUrl: "https://docs.projectdiscovery.io/tools/nuclei/",
  },

  // SECRETS
  {
    id: "gitleaks",
    name: "Gitleaks",
    description: "Git secret scanner",
    formats: ["json", "sarif", "csv"],
    category: "SECRETS",
    docsUrl: "https://github.com/gitleaks/gitleaks",
  },
  {
    id: "trufflehog",
    name: "TruffleHog",
    description: "Secret scanner for git repositories",
    formats: ["json"],
    category: "SECRETS",
    docsUrl: "https://github.com/trufflesecurity/trufflehog",
  },
  {
    id: "detect-secrets",
    name: "detect-secrets",
    description: "Yelp's secret detection tool",
    formats: ["json"],
    category: "SECRETS",
    docsUrl: "https://github.com/Yelp/detect-secrets",
  },

  // CONTAINER
  {
    id: "grype",
    name: "Grype",
    description: "Anchore's container vulnerability scanner",
    formats: ["json", "sarif"],
    category: "CONTAINER",
    docsUrl: "https://github.com/anchore/grype",
  },

  // IAC
  {
    id: "checkov",
    name: "Checkov",
    description: "Policy-as-code for IaC",
    formats: ["json", "sarif"],
    category: "IAC",
    docsUrl: "https://www.checkov.io/",
  },
  {
    id: "kics",
    name: "KICS",
    description: "Checkmarx IaC security scanner",
    formats: ["json", "sarif"],
    category: "IAC",
    docsUrl: "https://kics.io/",
  },
  {
    id: "tfsec",
    name: "tfsec",
    description: "Terraform security scanner",
    formats: ["json", "sarif"],
    category: "IAC",
    docsUrl: "https://aquasecurity.github.io/tfsec/",
  },
  {
    id: "terrascan",
    name: "Terrascan",
    description: "Static code analyzer for IaC",
    formats: ["json", "sarif"],
    category: "IAC",
    docsUrl: "https://runterrascan.io/",
  },

  // OTHER
  {
    id: "sarif",
    name: "Generic SARIF",
    description: "Upload SARIF from any security tool. You can specify a custom tool name.",
    formats: ["sarif"],
    category: "OTHER",
    docsUrl: "https://sarifweb.azurewebsites.net/",
  },
];

export const getScannersByCategory = (category: ScannerCategory): ScannerInfo[] => {
  return SCANNERS.filter((s) => s.category === category);
};

export const getScannerById = (id: string): ScannerInfo | undefined => {
  return SCANNERS.find((s) => s.id === id);
};

export const getAllCategories = (): ScannerCategoryInfo[] => {
  return Object.values(SCANNER_CATEGORIES).map((cat) => ({
    ...cat,
    scanners: getScannersByCategory(cat.id),
  }));
};

export const detectScannerFromFile = (fileName: string): string | null => {
  const lowerName = fileName.toLowerCase();

  // Try to detect by filename patterns
  if (lowerName.includes("trivy")) return "trivy";
  if (lowerName.includes("semgrep")) return "semgrep";
  if (lowerName.includes("bandit")) return "bandit";
  if (lowerName.includes("gitleaks")) return "gitleaks";
  if (lowerName.includes("trufflehog")) return "trufflehog";
  if (lowerName.includes("codeql")) return "codeql";
  if (lowerName.includes("gosec")) return "gosec";
  if (lowerName.includes("zap")) return "zap";
  if (lowerName.includes("nuclei")) return "nuclei";
  if (lowerName.includes("snyk")) return "snyk";
  if (lowerName.includes("dependency-check") || lowerName.includes("dependencycheck"))
    return "dependency-check";
  if (lowerName.includes("npm-audit") || lowerName.includes("npm_audit")) return "npm-audit";
  if (lowerName.includes("pip-audit") || lowerName.includes("pip_audit")) return "pip-audit";
  if (lowerName.includes("grype")) return "grype";
  if (lowerName.includes("checkov")) return "checkov";
  if (lowerName.includes("kics")) return "kics";
  if (lowerName.includes("tfsec")) return "tfsec";
  if (lowerName.includes("terrascan")) return "terrascan";
  if (lowerName.includes("detect-secrets") || lowerName.includes("detect_secrets"))
    return "detect-secrets";

  return null;
};
