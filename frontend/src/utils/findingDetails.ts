import {
  FindingDetailDTO,
  FindingDetailsConfig,
  FindingDetailsSAST,
  FindingDetailsSCA,
  FindingDetailsSecrets,
} from "../types/findings";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isScaDetails = (details: unknown): details is FindingDetailsSCA => {
  if (!isRecord(details)) return false;
  return (
    typeof details.pkgName === "string" &&
    typeof details.installedVersion === "string" &&
    typeof details.vulnerabilityId === "string"
  );
};

export const isSastDetails = (details: unknown): details is FindingDetailsSAST => {
  if (!isRecord(details)) return false;
  return (
    "filePath" in details ||
    "ruleId" in details ||
    "startLine" in details ||
    "endLine" in details ||
    "snippet" in details
  );
};

export const isSecretsDetails = (details: unknown): details is FindingDetailsSecrets =>
  isRecord(details) && ("filePath" in details || "ruleId" in details || "snippet" in details);

export const isConfigDetails = (details: unknown): details is FindingDetailsConfig =>
  isRecord(details) && ("filePath" in details || "ruleId" in details || "message" in details);

export type ResolvedFindingDetails =
  | { category: "SCA"; details: FindingDetailsSCA | null }
  | { category: "SAST"; details: FindingDetailsSAST | null }
  | { category: "SECRETS"; details: FindingDetailsSecrets | null }
  | { category: "CONFIG"; details: FindingDetailsConfig | null }
  | { category: "UNKNOWN"; details: null };

export const resolveFindingDetails = (finding: FindingDetailDTO): ResolvedFindingDetails => {
  switch (finding.category) {
    case "SCA":
      return { category: "SCA", details: isScaDetails(finding.details) ? finding.details : null };
    case "SAST":
      return { category: "SAST", details: isSastDetails(finding.details) ? finding.details : null };
    case "SECRETS":
      return {
        category: "SECRETS",
        details: isSecretsDetails(finding.details) ? finding.details : null,
      };
    case "CONFIG":
      return {
        category: "CONFIG",
        details: isConfigDetails(finding.details) ? finding.details : null,
      };
    default:
      return { category: "UNKNOWN", details: null };
  }
};
