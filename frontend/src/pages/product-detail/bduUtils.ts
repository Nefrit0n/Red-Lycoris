import type { BDUMatchItem, BDUMatchItemDTO, CVSSMetric } from "../../types/bdu";

const EMPTY_LABEL = "Нет данных";

const asText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((entry) => asText(entry))
      .filter((entry): entry is string => Boolean(entry))
      .join(", ");
    return joined.length > 0 ? joined : null;
  }
  return null;
};

const splitMultivalueText = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => splitMultivalueText(entry))
      .filter((entry, index, arr) => arr.indexOf(entry) === index);
  }
  const text = asText(value);
  if (!text) return [];
  return text
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((entry, index, arr) => arr.indexOf(entry) === index);
};

const parseCvss = (value: unknown, version: CVSSMetric["version"]): CVSSMetric => {
  const raw = asText(value);
  if (!raw) return { version, score: null, vector: null, raw: null };
  const scoreMatch = raw.match(/([0-9]+(?:\.[0-9]+)?)/);
  const vectorMatch = raw.match(/((?:CVSS:\d\.\d\/)?[A-Z]{1,4}:[^,\s;]+(?:\/[A-Z]{1,4}:[^,\s;]+)+)/i);
  return {
    version,
    score: scoreMatch ? Number(scoreMatch[1]) : null,
    vector: vectorMatch ? vectorMatch[1] : null,
    raw,
  };
};

export const hasMeaningfulValue = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  return asText(value) !== null;
};

export const formatOptionalText = (value: unknown, fallback = EMPTY_LABEL): string => {
  return asText(value) ?? fallback;
};

export const normalizeReferences = (value: unknown): string[] =>
  splitMultivalueText(value).filter((entry) => /^https?:\/\//i.test(entry));

export const normalizeExternalIds = (value: unknown): string[] => splitMultivalueText(value);

export const normalizeBduMatch = (raw: BDUMatchItemDTO): BDUMatchItem => {
  const bduId = asText(raw.bduId) ?? asText(raw.identifier) ?? "BDU:UNKNOWN";
  return {
    componentName: asText(raw.componentName),
    componentVersion: asText(raw.componentVersion),
    packageName: asText(raw.packageName),
    packageVersion: asText(raw.packageVersion),
    bduId,
    name: asText(raw.name),
    description: asText(raw.description),
    severity: asText(raw.severity),
    cvssV2: parseCvss(raw.cvssV2, "2.0"),
    cvssV3: parseCvss(raw.cvssV3, "3.x"),
    cvssV4: parseCvss(raw.cvssV4, "4.0"),
    softwareName: asText(raw.softwareName),
    softwareVersion: asText(raw.softwareVersion),
    softwareType: asText(raw.softwareType),
    osHardware: asText(raw.osHardware),
    exploitExists: asText(raw.exploitExists),
    cweId: asText(raw.cweId),
    cweDescription: asText(raw.cweDescription),
    cweType: asText(raw.cweType),
    status: asText(raw.status),
    vulnState: asText(raw.vulnState),
    vulnClass: asText(raw.vulnClass),
    vendor: asText(raw.vendor),
    remediation: asText(raw.remediation),
    fixInfo: asText(raw.fixInfo),
    fixMethod: asText(raw.fixMethod),
    sourceUrls: normalizeReferences(raw.sourceUrls),
    otherIds: normalizeExternalIds(raw.otherIds),
    otherInfo: asText(raw.otherInfo),
    incidentInfo: asText(raw.incidentInfo),
    exploitationMethod: asText(raw.exploitationMethod),
    publishedDate: asText(raw.publishedDate),
    updatedDate: asText(raw.updatedDate),
    detectionDate: asText(raw.detectionDate),
    consequences: asText(raw.consequences),
  };
};

export const getBestCvssScore = (item: Pick<BDUMatchItem, "cvssV2" | "cvssV3" | "cvssV4">): CVSSMetric => {
  if (item.cvssV4.score !== null) return item.cvssV4;
  if (item.cvssV3.score !== null) return item.cvssV3;
  if (item.cvssV2.score !== null) return item.cvssV2;
  return { version: "4.0", score: null, vector: null, raw: null };
};

export type SeverityTone = "critical" | "high" | "medium" | "low" | "info";

export const getSeverity = (item: Pick<BDUMatchItem, "severity" | "cvssV2" | "cvssV3" | "cvssV4">): SeverityTone => {
  const severityText = (item.severity ?? "").toLowerCase();
  if (severityText.includes("крит") || severityText.includes("critical")) return "critical";
  if (severityText.includes("высок") || severityText.includes("high")) return "high";
  if (severityText.includes("средн") || severityText.includes("medium")) return "medium";
  if (severityText.includes("низ") || severityText.includes("low")) return "low";

  const score = getBestCvssScore(item).score;
  if (score === null) return "info";
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "info";
};

export const hasAnyBduDetails = (item: BDUMatchItem): boolean => {
  return [
    item.description,
    item.vendor,
    item.softwareName,
    item.softwareVersion,
    item.softwareType,
    item.osHardware,
    item.vulnClass,
    item.remediation,
    item.fixInfo,
    item.fixMethod,
    item.incidentInfo,
    item.exploitationMethod,
    item.status,
    item.vulnState,
    item.cweId,
    item.cweType,
    item.cweDescription,
    item.otherInfo,
    item.consequences,
    item.publishedDate,
    item.updatedDate,
    item.detectionDate,
    item.sourceUrls,
    item.otherIds,
  ].some((value) => hasMeaningfulValue(value));
};
