export interface BDUMatchItemDTO {
  componentName?: unknown;
  componentVersion?: unknown;
  packageName?: unknown;
  packageVersion?: unknown;
  bduId?: unknown;
  identifier?: unknown;
  name?: unknown;
  description?: unknown;
  severity?: unknown;
  cvssV2?: unknown;
  cvssV3?: unknown;
  cvssV4?: unknown;
  softwareName?: unknown;
  softwareVersion?: unknown;
  softwareType?: unknown;
  osHardware?: unknown;
  exploitExists?: unknown;
  cweId?: unknown;
  cweDescription?: unknown;
  cweType?: unknown;
  status?: unknown;
  vulnState?: unknown;
  vulnClass?: unknown;
  vendor?: unknown;
  remediation?: unknown;
  fixInfo?: unknown;
  fixMethod?: unknown;
  sourceUrls?: unknown;
  otherIds?: unknown;
  otherInfo?: unknown;
  incidentInfo?: unknown;
  exploitationMethod?: unknown;
  publishedDate?: unknown;
  updatedDate?: unknown;
  detectionDate?: unknown;
  consequences?: unknown;
}

export interface CVSSMetric {
  version: "2.0" | "3.x" | "4.0";
  score: number | null;
  vector: string | null;
  raw: string | null;
}

export interface BDUMatchItem {
  componentName: string | null;
  componentVersion: string | null;
  packageName: string | null;
  packageVersion: string | null;
  bduId: string;
  name: string | null;
  description: string | null;
  severity: string | null;
  cvssV2: CVSSMetric;
  cvssV3: CVSSMetric;
  cvssV4: CVSSMetric;
  softwareName: string | null;
  softwareVersion: string | null;
  softwareType: string | null;
  osHardware: string | null;
  exploitExists: string | null;
  cweId: string | null;
  cweDescription: string | null;
  cweType: string | null;
  status: string | null;
  vulnState: string | null;
  vulnClass: string | null;
  vendor: string | null;
  remediation: string | null;
  fixInfo: string | null;
  fixMethod: string | null;
  sourceUrls: string[];
  otherIds: string[];
  otherInfo: string | null;
  incidentInfo: string | null;
  exploitationMethod: string | null;
  publishedDate: string | null;
  updatedDate: string | null;
  detectionDate: string | null;
  consequences: string | null;
}
