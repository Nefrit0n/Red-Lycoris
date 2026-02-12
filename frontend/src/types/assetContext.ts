export interface ProductAssetContext {
  productId: string;
  tenantId?: string | null;
  environment?: string | null;
  internetExposed?: boolean | null;
  dataClassification?: string | null;
  businessImpact?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}
