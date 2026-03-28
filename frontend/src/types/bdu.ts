export interface BDUMatchItem {
  componentName: string;
  componentVersion: string;
  bduId: string;
  name: string;
  severity: string;
  cvssV3: string;
  softwareName: string;
  softwareVersion: string;
  exploitExists: string;
  cweId: string;
  status: string;
  vulnClass: string;
  vendor: string;
  remediation: string;
  publishedDate: string;
}

export type BDUCvss = {
  vector: string;
  score: number;
};

export interface BDUVulnerabilityItem {
  id: string;
  name: string;
  description: string;
  vendor: string;
  softwareName: string;
  softwareVersion: string;
  softwareType: string;
  osPlatform: string;
  vulnClass: string;
  dateDiscovered: string;
  datePublished: string;
  dateUpdated: string;
  cvss2: BDUCvss | null;
  cvss3: BDUCvss | null;
  cvss4: BDUCvss | null;
  remediation: string;
  status: string;
  exploitExists: boolean;
  fixInfo: string;
  references: string[];
  otherIds: string[];
  vulnState: string;
  cweId: string;
  cweDesc: string;
  exploitMethod: string;
  fixMethod: string;
  incidentRelation: string;
  additionalInfo: string;
  component: string;
}
