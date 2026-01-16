export interface Product {
  id: string;
  name: string;
  identifier?: string | null;
  version?: string | null;
  lastScanAt?: string | null;
  findingsOpenCount: number;
}
