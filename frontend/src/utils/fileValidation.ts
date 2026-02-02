// File validation and content analysis utilities for scan upload

import JSZip from "jszip";

// Validation result types
export interface ValidationResult {
  valid: boolean;
  format: "json" | "sarif" | "csv" | "xml" | "jsonl" | "unknown";
  errors: ValidationError[];
  warnings: ValidationWarning[];
  preview?: FilePreview;
}

export interface ValidationError {
  type: "parse" | "format" | "structure" | "size";
  message: string;
  line?: number;
  column?: number;
  details?: string;
}

export interface ValidationWarning {
  type: "compatibility" | "missing_field" | "deprecated";
  message: string;
  field?: string;
}

export interface FilePreview {
  findingsCount: number;
  severityCounts: Record<string, number>;
  toolName?: string;
  toolVersion?: string;
  sampleFindings: PreviewFinding[];
}

export interface PreviewFinding {
  title: string;
  severity: string;
  location?: string;
  ruleId?: string;
}

// SARIF structure types
interface SarifReport {
  $schema?: string;
  version?: string;
  runs?: SarifRun[];
}

interface SarifRun {
  tool?: {
    driver?: {
      name?: string;
      version?: string;
      rules?: SarifRule[];
    };
  };
  results?: SarifResult[];
}

interface SarifRule {
  id: string;
  name?: string;
  shortDescription?: { text?: string };
  defaultConfiguration?: { level?: string };
}

interface SarifResult {
  ruleId?: string;
  message?: { text?: string };
  level?: string;
  locations?: SarifLocation[];
}

interface SarifLocation {
  physicalLocation?: {
    artifactLocation?: { uri?: string };
    region?: { startLine?: number };
  };
}

// Scanner detection patterns for content analysis
interface ScannerPattern {
  scannerId: string;
  patterns: {
    field: string;
    value: string | RegExp;
  }[];
  priority: number;
}

const SCANNER_CONTENT_PATTERNS: ScannerPattern[] = [
  // SARIF-based scanners (detected via tool.driver.name)
  { scannerId: "semgrep", patterns: [{ field: "tool.driver.name", value: /semgrep/i }], priority: 10 },
  { scannerId: "codeql", patterns: [{ field: "tool.driver.name", value: /codeql/i }], priority: 10 },
  { scannerId: "trivy", patterns: [{ field: "tool.driver.name", value: /trivy/i }], priority: 10 },
  { scannerId: "bandit", patterns: [{ field: "tool.driver.name", value: /bandit/i }], priority: 10 },
  { scannerId: "gosec", patterns: [{ field: "tool.driver.name", value: /gosec/i }], priority: 10 },
  { scannerId: "gitleaks", patterns: [{ field: "tool.driver.name", value: /gitleaks/i }], priority: 10 },
  { scannerId: "checkov", patterns: [{ field: "tool.driver.name", value: /checkov/i }], priority: 10 },
  { scannerId: "kics", patterns: [{ field: "tool.driver.name", value: /kics/i }], priority: 10 },
  { scannerId: "tfsec", patterns: [{ field: "tool.driver.name", value: /tfsec/i }], priority: 10 },
  { scannerId: "terrascan", patterns: [{ field: "tool.driver.name", value: /terrascan/i }], priority: 10 },
  { scannerId: "snyk", patterns: [{ field: "tool.driver.name", value: /snyk/i }], priority: 10 },
  { scannerId: "grype", patterns: [{ field: "tool.driver.name", value: /grype/i }], priority: 10 },
  { scannerId: "zap", patterns: [{ field: "tool.driver.name", value: /zap|zaproxy/i }], priority: 10 },

  // JSON-based scanners (detected via structure)
  { scannerId: "trivy", patterns: [{ field: "SchemaVersion", value: /\d+/ }, { field: "Results", value: "array" }], priority: 8 },
  { scannerId: "semgrep", patterns: [{ field: "results", value: "array" }, { field: "version", value: /semgrep/i }], priority: 8 },
  { scannerId: "bandit", patterns: [{ field: "results", value: "array" }, { field: "metrics", value: "object" }], priority: 7 },
  { scannerId: "gitleaks", patterns: [{ field: "[0].RuleID", value: /^[\w-]+$/ }, { field: "[0].Secret", value: "string" }], priority: 8 },
  { scannerId: "trufflehog", patterns: [{ field: "[0].SourceMetadata", value: "object" }, { field: "[0].DetectorType", value: /\d+/ }], priority: 8 },
  { scannerId: "nuclei", patterns: [{ field: "template-id", value: "string" }, { field: "matched-at", value: "string" }], priority: 8 },
  { scannerId: "npm-audit", patterns: [{ field: "vulnerabilities", value: "object" }, { field: "metadata", value: "object" }], priority: 8 },
  { scannerId: "pip-audit", patterns: [{ field: "[0].name", value: "string" }, { field: "[0].vulns", value: "array" }], priority: 8 },
  { scannerId: "dependency-check", patterns: [{ field: "dependencies", value: "array" }, { field: "projectInfo", value: "object" }], priority: 7 },
  { scannerId: "grype", patterns: [{ field: "matches", value: "array" }, { field: "source", value: "object" }], priority: 8 },
  { scannerId: "detect-secrets", patterns: [{ field: "results", value: "object" }, { field: "version", value: "string" }], priority: 7 },
];

// Max file size for client-side processing (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Read file as text
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
};

// Read file as ArrayBuffer (for archives)
export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

// Detect file format from content
export const detectFileFormat = (content: string, fileName: string): ValidationResult["format"] => {
  const trimmed = content.trim();
  const ext = fileName.toLowerCase().split(".").pop() || "";

  // Check extension first
  if (ext === "sarif") return "sarif";
  if (ext === "csv") return "csv";
  if (ext === "xml") return "xml";
  if (ext === "jsonl") return "jsonl";

  // Try to detect from content
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      // Check if it's SARIF
      if (parsed.$schema?.includes("sarif") || parsed.version?.startsWith("2.")) {
        return "sarif";
      }
      return "json";
    } catch {
      // Could be JSONL
      const firstLine = trimmed.split("\n")[0];
      try {
        JSON.parse(firstLine);
        return "jsonl";
      } catch {
        return "unknown";
      }
    }
  }

  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) {
    return "xml";
  }

  // Check for CSV-like content
  if (trimmed.includes(",") && trimmed.split("\n").length > 1) {
    const lines = trimmed.split("\n").slice(0, 5);
    const commaCount = lines[0].split(",").length;
    if (commaCount >= 2 && lines.every((l) => l.split(",").length >= commaCount - 1)) {
      return "csv";
    }
  }

  return "unknown";
};

// Parse JSON with detailed error info
export const parseJSONWithErrors = (
  content: string
): { data: unknown; errors: ValidationError[] } => {
  const errors: ValidationError[] = [];

  try {
    const data = JSON.parse(content);
    return { data, errors };
  } catch (e) {
    const error = e as SyntaxError;
    const match = error.message.match(/at position (\d+)/);
    let line = 1;
    let column = 1;

    if (match) {
      const position = parseInt(match[1], 10);
      const lines = content.slice(0, position).split("\n");
      line = lines.length;
      column = lines[lines.length - 1].length + 1;
    }

    // Try to find the specific issue
    let details = "";
    const lines = content.split("\n");
    if (line <= lines.length) {
      const problemLine = lines[line - 1];
      details = `Line ${line}: ${problemLine.slice(0, 100)}${problemLine.length > 100 ? "..." : ""}`;
    }

    errors.push({
      type: "parse",
      message: `JSON parsing error: ${error.message}`,
      line,
      column,
      details,
    });

    return { data: null, errors };
  }
};

// Validate SARIF structure
export const validateSarifStructure = (data: unknown): ValidationError[] => {
  const errors: ValidationError[] = [];
  const sarif = data as SarifReport;

  if (!sarif || typeof sarif !== "object") {
    errors.push({
      type: "structure",
      message: "SARIF file must be a JSON object",
    });
    return errors;
  }

  // Check schema version
  if (!sarif.version) {
    errors.push({
      type: "structure",
      message: "Missing required 'version' field in SARIF",
      details: "SARIF files must have a 'version' field (e.g., '2.1.0')",
    });
  } else if (!sarif.version.startsWith("2.")) {
    errors.push({
      type: "structure",
      message: `Unsupported SARIF version: ${sarif.version}`,
      details: "Only SARIF 2.x is supported",
    });
  }

  // Check runs array
  if (!sarif.runs) {
    errors.push({
      type: "structure",
      message: "Missing required 'runs' array in SARIF",
      details: "SARIF files must contain a 'runs' array",
    });
  } else if (!Array.isArray(sarif.runs)) {
    errors.push({
      type: "structure",
      message: "'runs' field must be an array",
    });
  } else if (sarif.runs.length === 0) {
    errors.push({
      type: "structure",
      message: "SARIF file has no runs",
      details: "The 'runs' array is empty",
    });
  } else {
    // Validate each run
    sarif.runs.forEach((run, index) => {
      if (!run.tool?.driver) {
        errors.push({
          type: "structure",
          message: `Run ${index + 1}: Missing 'tool.driver' information`,
        });
      }
      if (!run.results) {
        errors.push({
          type: "structure",
          message: `Run ${index + 1}: Missing 'results' array`,
        });
      }
    });
  }

  return errors;
};

// Generate warnings for SARIF
export const getSarifWarnings = (data: SarifReport): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  if (data.runs) {
    data.runs.forEach((run, index) => {
      if (!run.tool?.driver?.name) {
        warnings.push({
          type: "missing_field",
          message: `Run ${index + 1}: No tool name specified`,
          field: "tool.driver.name",
        });
      }
      if (!run.tool?.driver?.rules || run.tool.driver.rules.length === 0) {
        warnings.push({
          type: "missing_field",
          message: `Run ${index + 1}: No rule definitions found`,
          field: "tool.driver.rules",
        });
      }
    });
  }

  return warnings;
};

// Extract preview from SARIF
export const extractSarifPreview = (data: SarifReport): FilePreview => {
  const severityCounts: Record<string, number> = {};
  const sampleFindings: PreviewFinding[] = [];
  let toolName: string | undefined;
  let toolVersion: string | undefined;
  let totalFindings = 0;

  if (data.runs) {
    for (const run of data.runs) {
      if (!toolName && run.tool?.driver?.name) {
        toolName = run.tool.driver.name;
        toolVersion = run.tool.driver.version;
      }

      const rulesMap = new Map<string, SarifRule>();
      if (run.tool?.driver?.rules) {
        for (const rule of run.tool.driver.rules) {
          rulesMap.set(rule.id, rule);
        }
      }

      if (run.results) {
        totalFindings += run.results.length;

        for (const result of run.results) {
          // Map SARIF level to severity
          const level = result.level || "warning";
          const severity = mapSarifLevelToSeverity(level);
          severityCounts[severity] = (severityCounts[severity] || 0) + 1;

          // Add to samples (max 5)
          if (sampleFindings.length < 5) {
            const rule = result.ruleId ? rulesMap.get(result.ruleId) : undefined;
            const location = result.locations?.[0]?.physicalLocation;
            const uri = location?.artifactLocation?.uri;
            const line = location?.region?.startLine;

            sampleFindings.push({
              title:
                result.message?.text ||
                rule?.shortDescription?.text ||
                rule?.name ||
                result.ruleId ||
                "Unknown finding",
              severity,
              location: uri ? `${uri}${line ? `:${line}` : ""}` : undefined,
              ruleId: result.ruleId,
            });
          }
        }
      }
    }
  }

  return {
    findingsCount: totalFindings,
    severityCounts,
    toolName,
    toolVersion,
    sampleFindings,
  };
};

// Map SARIF level to common severity
const mapSarifLevelToSeverity = (level: string): string => {
  switch (level.toLowerCase()) {
    case "error":
      return "high";
    case "warning":
      return "medium";
    case "note":
    case "none":
      return "low";
    default:
      return "info";
  }
};

// Extract preview from various JSON formats
export const extractJSONPreview = (data: unknown, scannerId?: string): FilePreview | null => {
  // Try Trivy format
  if (isTrivyFormat(data)) {
    return extractTrivyPreview(data as TrivyReport);
  }

  // Try Bandit format
  if (isBanditFormat(data)) {
    return extractBanditPreview(data as BanditReport);
  }

  // Try Gitleaks format
  if (isGitleaksFormat(data)) {
    return extractGitleaksPreview(data as GitleaksResult[]);
  }

  // Try npm audit format
  if (isNpmAuditFormat(data)) {
    return extractNpmAuditPreview(data as NpmAuditReport);
  }

  // Try Grype format
  if (isGrypeFormat(data)) {
    return extractGrypePreview(data as GrypeReport);
  }

  // Try Semgrep JSON format
  if (isSemgrepFormat(data)) {
    return extractSemgrepPreview(data as SemgrepReport);
  }

  return null;
};

// Type guards and preview extractors for various formats

interface TrivyReport {
  SchemaVersion?: number;
  Results?: TrivyResult[];
}

interface TrivyResult {
  Target: string;
  Vulnerabilities?: TrivyVulnerability[];
}

interface TrivyVulnerability {
  VulnerabilityID: string;
  Title?: string;
  Severity: string;
  PkgName?: string;
}

const isTrivyFormat = (data: unknown): data is TrivyReport => {
  const d = data as TrivyReport;
  return typeof d === "object" && d !== null && "SchemaVersion" in d && "Results" in d;
};

const extractTrivyPreview = (data: TrivyReport): FilePreview => {
  const severityCounts: Record<string, number> = {};
  const sampleFindings: PreviewFinding[] = [];
  let totalFindings = 0;

  for (const result of data.Results || []) {
    for (const vuln of result.Vulnerabilities || []) {
      totalFindings++;
      const severity = vuln.Severity?.toLowerCase() || "unknown";
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;

      if (sampleFindings.length < 5) {
        sampleFindings.push({
          title: vuln.Title || vuln.VulnerabilityID,
          severity,
          location: `${result.Target}:${vuln.PkgName || "unknown"}`,
          ruleId: vuln.VulnerabilityID,
        });
      }
    }
  }

  return {
    findingsCount: totalFindings,
    severityCounts,
    toolName: "Trivy",
    sampleFindings,
  };
};

interface BanditReport {
  results?: BanditResult[];
  metrics?: Record<string, unknown>;
}

interface BanditResult {
  issue_text?: string;
  issue_severity?: string;
  filename?: string;
  line_number?: number;
  test_id?: string;
}

const isBanditFormat = (data: unknown): data is BanditReport => {
  const d = data as BanditReport;
  return typeof d === "object" && d !== null && "results" in d && "metrics" in d;
};

const extractBanditPreview = (data: BanditReport): FilePreview => {
  const severityCounts: Record<string, number> = {};
  const sampleFindings: PreviewFinding[] = [];
  const results = data.results || [];

  for (const result of results) {
    const severity = result.issue_severity?.toLowerCase() || "unknown";
    severityCounts[severity] = (severityCounts[severity] || 0) + 1;

    if (sampleFindings.length < 5) {
      sampleFindings.push({
        title: result.issue_text || "Unknown issue",
        severity,
        location: result.filename
          ? `${result.filename}${result.line_number ? `:${result.line_number}` : ""}`
          : undefined,
        ruleId: result.test_id,
      });
    }
  }

  return {
    findingsCount: results.length,
    severityCounts,
    toolName: "Bandit",
    sampleFindings,
  };
};

interface GitleaksResult {
  RuleID?: string;
  Secret?: string;
  File?: string;
  StartLine?: number;
}

const isGitleaksFormat = (data: unknown): data is GitleaksResult[] => {
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;
  const first = data[0] as Record<string, unknown>;
  return "RuleID" in first && "Secret" in first;
};

const extractGitleaksPreview = (data: GitleaksResult[]): FilePreview => {
  const sampleFindings: PreviewFinding[] = [];

  for (const result of data.slice(0, 5)) {
    sampleFindings.push({
      title: result.RuleID || "Secret detected",
      severity: "high",
      location: result.File
        ? `${result.File}${result.StartLine ? `:${result.StartLine}` : ""}`
        : undefined,
      ruleId: result.RuleID,
    });
  }

  return {
    findingsCount: data.length,
    severityCounts: { high: data.length },
    toolName: "Gitleaks",
    sampleFindings,
  };
};

interface NpmAuditReport {
  vulnerabilities?: Record<string, NpmVulnerability>;
  metadata?: Record<string, unknown>;
}

interface NpmVulnerability {
  name?: string;
  severity?: string;
  via?: unknown[];
}

const isNpmAuditFormat = (data: unknown): data is NpmAuditReport => {
  const d = data as NpmAuditReport;
  return typeof d === "object" && d !== null && "vulnerabilities" in d && "metadata" in d;
};

const extractNpmAuditPreview = (data: NpmAuditReport): FilePreview => {
  const severityCounts: Record<string, number> = {};
  const sampleFindings: PreviewFinding[] = [];
  const vulns = Object.values(data.vulnerabilities || {});

  for (const vuln of vulns) {
    const severity = vuln.severity?.toLowerCase() || "unknown";
    severityCounts[severity] = (severityCounts[severity] || 0) + 1;

    if (sampleFindings.length < 5) {
      sampleFindings.push({
        title: vuln.name || "Unknown vulnerability",
        severity,
      });
    }
  }

  return {
    findingsCount: vulns.length,
    severityCounts,
    toolName: "npm audit",
    sampleFindings,
  };
};

interface GrypeReport {
  matches?: GrypeMatch[];
  source?: Record<string, unknown>;
}

interface GrypeMatch {
  vulnerability?: {
    id?: string;
    severity?: string;
    description?: string;
  };
  artifact?: {
    name?: string;
    version?: string;
  };
}

const isGrypeFormat = (data: unknown): data is GrypeReport => {
  const d = data as GrypeReport;
  return typeof d === "object" && d !== null && "matches" in d && "source" in d;
};

const extractGrypePreview = (data: GrypeReport): FilePreview => {
  const severityCounts: Record<string, number> = {};
  const sampleFindings: PreviewFinding[] = [];
  const matches = data.matches || [];

  for (const match of matches) {
    const severity = match.vulnerability?.severity?.toLowerCase() || "unknown";
    severityCounts[severity] = (severityCounts[severity] || 0) + 1;

    if (sampleFindings.length < 5) {
      sampleFindings.push({
        title:
          match.vulnerability?.description ||
          match.vulnerability?.id ||
          "Unknown vulnerability",
        severity,
        location: match.artifact
          ? `${match.artifact.name}@${match.artifact.version}`
          : undefined,
        ruleId: match.vulnerability?.id,
      });
    }
  }

  return {
    findingsCount: matches.length,
    severityCounts,
    toolName: "Grype",
    sampleFindings,
  };
};

interface SemgrepReport {
  results?: SemgrepResult[];
  version?: string;
}

interface SemgrepResult {
  check_id?: string;
  extra?: {
    message?: string;
    severity?: string;
  };
  path?: string;
  start?: { line?: number };
}

const isSemgrepFormat = (data: unknown): data is SemgrepReport => {
  const d = data as SemgrepReport;
  return typeof d === "object" && d !== null && "results" in d && Array.isArray(d.results);
};

const extractSemgrepPreview = (data: SemgrepReport): FilePreview => {
  const severityCounts: Record<string, number> = {};
  const sampleFindings: PreviewFinding[] = [];
  const results = data.results || [];

  for (const result of results) {
    const severity = result.extra?.severity?.toLowerCase() || "info";
    severityCounts[severity] = (severityCounts[severity] || 0) + 1;

    if (sampleFindings.length < 5) {
      sampleFindings.push({
        title: result.extra?.message || result.check_id || "Unknown finding",
        severity,
        location: result.path
          ? `${result.path}${result.start?.line ? `:${result.start.line}` : ""}`
          : undefined,
        ruleId: result.check_id,
      });
    }
  }

  return {
    findingsCount: results.length,
    severityCounts,
    toolName: "Semgrep",
    sampleFindings,
  };
};

// Detect scanner from content
export const detectScannerFromContent = (
  data: unknown,
  format: ValidationResult["format"]
): string | null => {
  if (format === "sarif") {
    const sarif = data as SarifReport;
    if (sarif.runs?.[0]?.tool?.driver?.name) {
      const toolName = sarif.runs[0].tool.driver.name.toLowerCase();

      // Match against known scanners
      for (const pattern of SCANNER_CONTENT_PATTERNS) {
        if (pattern.patterns.some((p) => p.field === "tool.driver.name")) {
          const valuePattern = pattern.patterns.find(
            (p) => p.field === "tool.driver.name"
          )?.value;
          if (valuePattern instanceof RegExp && valuePattern.test(toolName)) {
            return pattern.scannerId;
          }
          if (typeof valuePattern === "string" && toolName.includes(valuePattern)) {
            return pattern.scannerId;
          }
        }
      }
    }
    // Default to generic SARIF if no specific scanner detected
    return "sarif";
  }

  // For JSON, check structure patterns
  if (format === "json") {
    if (isTrivyFormat(data)) return "trivy";
    if (isBanditFormat(data)) return "bandit";
    if (isGitleaksFormat(data)) return "gitleaks";
    if (isNpmAuditFormat(data)) return "npm-audit";
    if (isGrypeFormat(data)) return "grype";
    if (isSemgrepFormat(data)) return "semgrep";
  }

  return null;
};

// Main validation function
export const validateFile = async (file: File): Promise<ValidationResult> => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      format: "unknown",
      errors: [
        {
          type: "size",
          message: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
          details: `Maximum allowed size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
      ],
      warnings: [],
    };
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      valid: false,
      format: "unknown",
      errors: [
        {
          type: "size",
          message: "File is empty",
        },
      ],
      warnings: [],
    };
  }

  let content: string;
  try {
    content = await readFileAsText(file);
  } catch (e) {
    return {
      valid: false,
      format: "unknown",
      errors: [
        {
          type: "parse",
          message: "Failed to read file",
          details: e instanceof Error ? e.message : "Unknown error",
        },
      ],
      warnings: [],
    };
  }

  // Detect format
  const format = detectFileFormat(content, file.name);

  if (format === "unknown") {
    return {
      valid: false,
      format,
      errors: [
        {
          type: "format",
          message: "Unknown file format",
          details: "Expected JSON, SARIF, CSV, XML, or JSONL",
        },
      ],
      warnings: [],
    };
  }

  // Validate based on format
  let preview: FilePreview | undefined;

  if (format === "json" || format === "sarif") {
    const { data, errors: parseErrors } = parseJSONWithErrors(content);
    errors.push(...parseErrors);

    if (data && errors.length === 0) {
      if (format === "sarif") {
        const structureErrors = validateSarifStructure(data);
        errors.push(...structureErrors);

        if (structureErrors.length === 0) {
          const sarifWarnings = getSarifWarnings(data as SarifReport);
          warnings.push(...sarifWarnings);
          preview = extractSarifPreview(data as SarifReport);
        }
      } else {
        preview = extractJSONPreview(data) || undefined;
      }
    }
  } else if (format === "jsonl") {
    // Validate JSONL - check each line
    const lines = content.trim().split("\n");
    let validLines = 0;
    for (let i = 0; i < Math.min(lines.length, 100); i++) {
      try {
        JSON.parse(lines[i]);
        validLines++;
      } catch {
        errors.push({
          type: "parse",
          message: `Invalid JSON on line ${i + 1}`,
          line: i + 1,
        });
      }
    }
    if (validLines > 0 && errors.length > 0) {
      warnings.push({
        type: "compatibility",
        message: `${validLines} of ${lines.length} lines are valid JSON`,
      });
    }
  } else if (format === "xml") {
    // Basic XML validation
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "application/xml");
      const parseError = doc.querySelector("parsererror");
      if (parseError) {
        errors.push({
          type: "parse",
          message: "Invalid XML",
          details: parseError.textContent || undefined,
        });
      }
    } catch (e) {
      errors.push({
        type: "parse",
        message: "Failed to parse XML",
        details: e instanceof Error ? e.message : undefined,
      });
    }
  } else if (format === "csv") {
    // Basic CSV validation - check for consistent columns
    const lines = content.trim().split("\n");
    if (lines.length > 0) {
      const headerCols = lines[0].split(",").length;
      for (let i = 1; i < Math.min(lines.length, 10); i++) {
        const cols = lines[i].split(",").length;
        if (Math.abs(cols - headerCols) > 1) {
          warnings.push({
            type: "compatibility",
            message: `Line ${i + 1} has inconsistent column count`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    format,
    errors,
    warnings,
    preview,
  };
};

// Archive handling
export interface ArchiveFile {
  name: string;
  file: File;
}

export const isArchive = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".zip") ||
    name.endsWith(".tar.gz") ||
    name.endsWith(".tgz") ||
    file.type === "application/zip" ||
    file.type === "application/gzip"
  );
};

export const extractArchive = async (file: File): Promise<ArchiveFile[]> => {
  const name = file.name.toLowerCase();

  if (name.endsWith(".zip") || file.type === "application/zip") {
    return extractZip(file);
  }

  // For tar.gz, we'd need pako and a tar library
  // For now, return empty array with a note
  throw new Error(
    "tar.gz extraction requires additional libraries. Please upload individual files or a .zip archive."
  );
};

const extractZip = async (file: File): Promise<ArchiveFile[]> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const zip = await JSZip.loadAsync(arrayBuffer);
  const results: ArchiveFile[] = [];

  const validExtensions = [".json", ".sarif", ".csv", ".xml", ".jsonl"];

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;

    const ext = path.toLowerCase().split(".").pop();
    if (!ext || !validExtensions.some((e) => path.toLowerCase().endsWith(e))) {
      continue;
    }

    const content = await zipEntry.async("blob");
    const fileName = path.split("/").pop() || path;
    const extractedFile = new File([content], fileName, {
      type: getFileMimeType(fileName),
    });
    results.push({ name: path, file: extractedFile });
  }

  return results;
};

const getFileMimeType = (fileName: string): string => {
  const ext = fileName.toLowerCase().split(".").pop();
  switch (ext) {
    case "json":
    case "sarif":
      return "application/json";
    case "xml":
      return "application/xml";
    case "csv":
      return "text/csv";
    default:
      return "text/plain";
  }
};

// Clipboard handling
export const readFromClipboard = async (): Promise<File | null> => {
  try {
    const clipboardItems = await navigator.clipboard.read();

    for (const item of clipboardItems) {
      // Check for text content
      if (item.types.includes("text/plain")) {
        const blob = await item.getType("text/plain");
        const text = await blob.text();

        // Try to detect if it's JSON/SARIF
        const trimmed = text.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            JSON.parse(trimmed);
            // It's valid JSON, create a file
            return new File([text], "clipboard-paste.json", {
              type: "application/json",
            });
          } catch {
            // Not valid JSON
          }
        }
      }
    }
  } catch (e) {
    // Clipboard API not available or permission denied
    console.warn("Clipboard read failed:", e);
  }

  return null;
};
