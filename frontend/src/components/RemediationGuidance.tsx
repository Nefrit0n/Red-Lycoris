import { Box, Chip, Link, Stack, Typography } from "@mui/material";
import {
  Lightbulb as TipIcon,
  MenuBook as DocsIcon,
  Warning as WarningIcon,
  Security as SecurityIcon,
} from "@mui/icons-material";
import { SemgrepEvidence } from "../types/findings";

interface RemediationGuidanceProps {
  evidence: SemgrepEvidence | null;
  title: string;
  severity: string;
}

// CWE information database
const cweInfo: Record<string, { name: string; link: string }> = {
  "CWE-89": { name: "SQL Injection", link: "https://cwe.mitre.org/data/definitions/89.html" },
  "CWE-79": { name: "Cross-site Scripting (XSS)", link: "https://cwe.mitre.org/data/definitions/79.html" },
  "CWE-78": { name: "OS Command Injection", link: "https://cwe.mitre.org/data/definitions/78.html" },
  "CWE-22": { name: "Path Traversal", link: "https://cwe.mitre.org/data/definitions/22.html" },
  "CWE-94": { name: "Code Injection", link: "https://cwe.mitre.org/data/definitions/94.html" },
  "CWE-502": { name: "Deserialization of Untrusted Data", link: "https://cwe.mitre.org/data/definitions/502.html" },
  "CWE-611": { name: "XXE", link: "https://cwe.mitre.org/data/definitions/611.html" },
  "CWE-352": { name: "CSRF", link: "https://cwe.mitre.org/data/definitions/352.html" },
  "CWE-918": { name: "SSRF", link: "https://cwe.mitre.org/data/definitions/918.html" },
  "CWE-287": { name: "Improper Authentication", link: "https://cwe.mitre.org/data/definitions/287.html" },
  "CWE-798": { name: "Hardcoded Credentials", link: "https://cwe.mitre.org/data/definitions/798.html" },
};

// OWASP Top 10 categories
const owaspCategories: Record<string, { name: string; link: string }> = {
  injection: { name: "A03:2021 - Injection", link: "https://owasp.org/Top10/A03_2021-Injection/" },
  "broken-access-control": { name: "A01:2021 - Broken Access Control", link: "https://owasp.org/Top10/A01_2021-Broken_Access_Control/" },
  "cryptographic-failures": { name: "A02:2021 - Cryptographic Failures", link: "https://owasp.org/Top10/A02_2021-Cryptographic_Failures/" },
  "insecure-design": { name: "A04:2021 - Insecure Design", link: "https://owasp.org/Top10/A04_2021-Insecure_Design/" },
  "security-misconfiguration": { name: "A05:2021 - Security Misconfiguration", link: "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/" },
  "vulnerable-components": { name: "A06:2021 - Vulnerable Components", link: "https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/" },
  "identification-failures": { name: "A07:2021 - Auth Failures", link: "https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/" },
  "software-integrity-failures": { name: "A08:2021 - Integrity Failures", link: "https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/" },
  "logging-monitoring-failures": { name: "A09:2021 - Logging Failures", link: "https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/" },
  ssrf: { name: "A10:2021 - SSRF", link: "https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/" },
};

// Extract CWE from metadata
const extractCWEs = (metadata?: Record<string, unknown> | null): string[] => {
  if (!metadata) return [];

  const cwes: string[] = [];

  // Check various metadata formats
  if (metadata.cwe) {
    const cweVal = metadata.cwe;
    if (Array.isArray(cweVal)) {
      cwes.push(...cweVal.map(String));
    } else if (typeof cweVal === "string") {
      cwes.push(cweVal);
    }
  }

  if (metadata.CWE) {
    const cweVal = metadata.CWE;
    if (Array.isArray(cweVal)) {
      cwes.push(...cweVal.map(String));
    } else if (typeof cweVal === "string") {
      cwes.push(cweVal);
    }
  }

  return [...new Set(cwes)];
};

// Extract OWASP category from metadata or rule ID
const extractOWASP = (ruleId?: string | null, metadata?: Record<string, unknown> | null): string | null => {
  if (metadata?.owasp) return String(metadata.owasp);
  if (metadata?.OWASP) return String(metadata.OWASP);

  // Try to infer from rule ID
  if (ruleId) {
    const lower = ruleId.toLowerCase();
    if (lower.includes("sql") || lower.includes("injection")) return "injection";
    if (lower.includes("xss") || lower.includes("innerhtml")) return "injection";
    if (lower.includes("xxe")) return "injection";
    if (lower.includes("csrf")) return "broken-access-control";
    if (lower.includes("ssrf")) return "ssrf";
    if (lower.includes("auth")) return "identification-failures";
    if (lower.includes("crypto") || lower.includes("password") || lower.includes("secret")) return "cryptographic-failures";
  }

  return null;
};

// Generate remediation tips based on rule patterns
const getRemediationTips = (ruleId?: string | null, title?: string): string[] => {
  const tips: string[] = [];
  const searchText = `${ruleId || ""} ${title || ""}`.toLowerCase();

  if (searchText.includes("sql") || searchText.includes("tainted")) {
    tips.push("Use parameterized queries or prepared statements instead of string concatenation");
    tips.push("Implement input validation and sanitization");
    tips.push("Consider using an ORM like Sequelize, TypeORM, or Prisma");
  }

  if (searchText.includes("xss") || searchText.includes("innerhtml") || searchText.includes("document.write")) {
    tips.push("Use textContent instead of innerHTML when inserting user data");
    tips.push("Implement Content Security Policy (CSP) headers");
    tips.push("Sanitize user input with a library like DOMPurify");
  }

  if (searchText.includes("eval") || searchText.includes("dynamic")) {
    tips.push("Avoid using eval() and similar dynamic code execution");
    tips.push("Use safer alternatives like JSON.parse() for data parsing");
  }

  if (searchText.includes("command") || searchText.includes("exec") || searchText.includes("shell")) {
    tips.push("Avoid executing shell commands with user input");
    tips.push("Use parameterized APIs instead of shell commands");
    tips.push("Implement strict input validation with allowlists");
  }

  if (searchText.includes("path") || searchText.includes("traversal") || searchText.includes("..")) {
    tips.push("Validate and sanitize file paths");
    tips.push("Use path.resolve() and verify the result is within allowed directories");
    tips.push("Never trust user input for file operations");
  }

  if (searchText.includes("crypto") || searchText.includes("password") || searchText.includes("secret") || searchText.includes("key")) {
    tips.push("Use strong, modern cryptographic algorithms (e.g., AES-256, bcrypt)");
    tips.push("Store secrets in environment variables or secure vaults");
    tips.push("Never hardcode credentials in source code");
  }

  if (searchText.includes("redirect") || searchText.includes("open-redirect")) {
    tips.push("Validate redirect URLs against an allowlist");
    tips.push("Use relative URLs when possible");
    tips.push("Implement URL validation before redirecting");
  }

  if (tips.length === 0) {
    tips.push("Review the vulnerable code and apply security best practices");
    tips.push("Consult the OWASP guidelines for this vulnerability type");
  }

  return tips;
};

const RemediationGuidance = ({ evidence, title, severity }: RemediationGuidanceProps) => {
  const ruleId = evidence?.ruleId;
  const metadata = evidence?.metadata;

  const cwes = extractCWEs(metadata);
  const owaspCategory = extractOWASP(ruleId, metadata);
  const tips = getRemediationTips(ruleId, title);

  // Get references from metadata
  const references: string[] = [];
  if (metadata?.references && Array.isArray(metadata.references)) {
    references.push(...metadata.references.map(String));
  }
  if (metadata?.reference) {
    references.push(String(metadata.reference));
  }

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: severity === "critical" || severity === "high" ? "error.main" : "divider",
        bgcolor: severity === "critical" || severity === "high"
          ? "rgba(211, 47, 47, 0.05)"
          : "rgba(255, 255, 255, 0.02)",
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} mb={2}>
        <TipIcon sx={{ color: "warning.main" }} />
        <Typography variant="subtitle2" fontWeight={600}>
          Remediation Guidance
        </Typography>
      </Stack>

      {/* Security Standards */}
      <Stack direction="row" gap={1} flexWrap="wrap" mb={2}>
        {cwes.map((cwe) => {
          const info = cweInfo[cwe];
          return (
            <Chip
              key={cwe}
              icon={<SecurityIcon sx={{ fontSize: 16 }} />}
              label={info ? `${cwe}: ${info.name}` : cwe}
              size="small"
              variant="outlined"
              component={info ? "a" : "span"}
              href={info?.link}
              target="_blank"
              clickable={!!info}
              sx={{
                borderColor: "error.main",
                color: "error.main",
                "& .MuiChip-icon": { color: "error.main" },
              }}
            />
          );
        })}

        {owaspCategory && owaspCategories[owaspCategory] && (
          <Chip
            icon={<WarningIcon sx={{ fontSize: 16 }} />}
            label={owaspCategories[owaspCategory].name}
            size="small"
            variant="outlined"
            component="a"
            href={owaspCategories[owaspCategory].link}
            target="_blank"
            clickable
            sx={{
              borderColor: "warning.main",
              color: "warning.main",
              "& .MuiChip-icon": { color: "warning.main" },
            }}
          />
        )}
      </Stack>

      {/* Tips */}
      <Box mb={2}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} gutterBottom>
          How to Fix
        </Typography>
        <Stack spacing={1} mt={0.5}>
          {tips.map((tip, idx) => (
            <Stack key={idx} direction="row" spacing={1} alignItems="flex-start">
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: "success.main",
                  mt: 0.75,
                  flexShrink: 0,
                }}
              />
              <Typography variant="body2">{tip}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      {/* References */}
      {references.length > 0 && (
        <Box>
          <Stack direction="row" alignItems="center" gap={0.5} mb={0.5}>
            <DocsIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              References
            </Typography>
          </Stack>
          <Stack spacing={0.5}>
            {references.slice(0, 5).map((ref, idx) => (
              <Link
                key={idx}
                href={ref}
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                sx={{
                  color: "primary.main",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                  wordBreak: "break-all",
                }}
              >
                {ref}
              </Link>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
};

export default RemediationGuidance;
