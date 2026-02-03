import {
  appsecKpis,
  coverageSnapshot,
  coverageFreshness,
  devDeliveryMetrics,
  developerHotspots,
  executiveKpis,
  executiveRiskTrend,
  developerKpis,
  developerQueue,
  developerRecentIntroduced,
  developerRemediation,
  findingsFlow,
  pipelineHealth,
  policyGateSummary,
  recentCriticalActivity,
  slaBreaches,
  severityStatusMatrix,
  topNoisyRules,
  topRiskyProducts,
  workloadFlow,
} from "../fixtures/mockData";

// TODO: Connect to real dashboard API when fields are finalized.
// This selector layer keeps Executive widgets decoupled from API shapes.

export const selectExecutiveKpis = () => executiveKpis;

export const selectExecutiveRiskTrend = () => executiveRiskTrend;

export const selectTopRiskyProducts = () => topRiskyProducts;

export const selectSlaBreaches = () => slaBreaches;

export const selectRecentCriticalActivity = () => recentCriticalActivity;

export const selectCoverageSnapshot = () => coverageSnapshot;

export const selectAppsecKpis = () => appsecKpis;

export const selectFindingsFlow = () => findingsFlow;

export const selectSeverityStatusMatrix = () => severityStatusMatrix;

export const selectCoverageFreshness = () => coverageFreshness;

export const selectPolicyGateSummary = () => policyGateSummary;

export const selectTopNoisyRules = () => topNoisyRules;

export const selectPipelineHealth = () => pipelineHealth;

export const selectWorkloadFlow = () => workloadFlow;

export const selectDevDeliveryMetrics = () => devDeliveryMetrics;

export const selectDeveloperKpis = () => developerKpis;

export const selectDeveloperQueue = () => developerQueue;

export const selectDeveloperRemediation = () => developerRemediation;

export const selectDeveloperHotspots = () => developerHotspots;

export const selectDeveloperRecentIntroduced = () => developerRecentIntroduced;
