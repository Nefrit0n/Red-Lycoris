import { ProductWithStats } from "../types/products";

export const calculateHealthScore = (
  breakdown?: ProductWithStats["severityBreakdown"]
): number => {
  if (!breakdown) return 100;
  const total =
    breakdown.critical + breakdown.high + breakdown.medium + breakdown.low + breakdown.info;
  if (total === 0) return 100;
  const weighted =
    breakdown.critical * 10 +
    breakdown.high * 5 +
    breakdown.medium * 2 +
    breakdown.low * 1 +
    breakdown.info * 0.5;
  return Math.max(0, Math.round(100 - (weighted / (total * 10)) * 100));
};
