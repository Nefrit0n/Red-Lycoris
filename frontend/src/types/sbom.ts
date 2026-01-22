export interface SbomItem {
  id: string;
  format: string;
  sha256: string;
  originalFilename: string;
  sizeBytes: number;
  createdAt?: string | null;
}
