export const executiveKpis = {
  openFindings: 248,
  criticalHigh: 72,
  productsAtRisk: 14,
  scanFreshnessMinutes: 18,
  scanFreshnessLabel: "Обновлено 18 мин назад",
};

export const executiveRiskTrend = [
  { label: "Неделя 1", value: 62 },
  { label: "Неделя 2", value: 58 },
  { label: "Неделя 3", value: 64 },
  { label: "Неделя 4", value: 69 },
  { label: "Неделя 5", value: 65 },
  { label: "Неделя 6", value: 72 },
  { label: "Неделя 7", value: 68 },
  { label: "Неделя 8", value: 70 },
];

export const riskTrend = [
  { label: "Янв", value: 60 },
  { label: "Фев", value: 58 },
  { label: "Мар", value: 63 },
  { label: "Апр", value: 67 },
  { label: "Май", value: 64 },
  { label: "Июн", value: 71 },
];

export const topRiskyProducts = [
  { name: "Payments API", risk: 92, delta: 6 },
  { name: "Identity Gateway", risk: 88, delta: 3 },
  { name: "Core Platform", risk: 84, delta: -2 },
  { name: "Mobile Wallet", risk: 81, delta: 4 },
];

export const topRisks = [
  { title: "Утечка учётных данных в CI", severity: "High", owner: "Platform" },
  { title: "Пробел в legacy auth flow", severity: "High", owner: "Identity" },
  { title: "Неверная настройка S3", severity: "Medium", owner: "Infra" },
  { title: "Неподписанные контейнеры", severity: "Medium", owner: "DevSecOps" },
];

export const slaBreaches = {
  total: 6,
  breakdown: [
    { label: "Критический SLA", value: 2 },
    { label: "Высокий SLA", value: 4 },
  ],
};

export const recentCriticalActivity = [
  { title: "Обнаружена утечка учётных данных", product: "Payments API", severity: "Critical", time: "18 мин назад" },
  { title: "Путь эскалации привилегий", product: "Identity Gateway", severity: "High", time: "2 ч назад" },
  { title: "Публичное хранилище", product: "Core Platform", severity: "High", time: "5 ч назад" },
  { title: "Развернут неподписанный образ", product: "Mobile Wallet", severity: "Critical", time: "1 дн назад" },
];

export const coverageSnapshot = [
  { label: "Свежие сканы", value: 78 },
  { label: "Покрытие SBOM", value: 64 },
  { label: "Применение политик", value: 71 },
];

export const appsecKpis = {
  newFindings: 34,
  newFindingsDelta: 8,
  mttrDays: 12.6,
  mttrLabel: "Медианное время до исправления",
  coveragePercent: 83,
  policyPassRate: 91,
};

export const findingsFlow = [
  { label: "Пн", opened: 12, triaged: 8, fixed: 5 },
  { label: "Вт", opened: 18, triaged: 14, fixed: 9 },
  { label: "Ср", opened: 22, triaged: 16, fixed: 12 },
  { label: "Чт", opened: 15, triaged: 12, fixed: 10 },
  { label: "Пт", opened: 19, triaged: 15, fixed: 11 },
  { label: "Сб", opened: 10, triaged: 9, fixed: 8 },
  { label: "Вс", opened: 8, triaged: 7, fixed: 6 },
];

export const severityStatusMatrix = [
  { severity: "Critical", status: "New", value: 6 },
  { severity: "Critical", status: "Triaged", value: 3 },
  { severity: "Critical", status: "In progress", value: 4 },
  { severity: "Critical", status: "Fixed", value: 2 },
  { severity: "High", status: "New", value: 14 },
  { severity: "High", status: "Triaged", value: 10 },
  { severity: "High", status: "In progress", value: 9 },
  { severity: "High", status: "Fixed", value: 7 },
  { severity: "Medium", status: "New", value: 18 },
  { severity: "Medium", status: "Triaged", value: 12 },
  { severity: "Medium", status: "In progress", value: 8 },
  { severity: "Medium", status: "Fixed", value: 6 },
  { severity: "Low", status: "New", value: 10 },
  { severity: "Low", status: "Triaged", value: 9 },
  { severity: "Low", status: "In progress", value: 4 },
  { severity: "Low", status: "Fixed", value: 5 },
];

export const coverageFreshness = [
  { product: "Payments API", lastScan: "2 ч назад", freshnessScore: 92 },
  { product: "Identity Gateway", lastScan: "6 ч назад", freshnessScore: 84 },
  { product: "Core Platform", lastScan: "1 дн назад", freshnessScore: 68 },
  { product: "Mobile Wallet", lastScan: "3 дн назад", freshnessScore: 54 },
];

export const policyGateSummary = {
  passRate: 91,
  failRate: 9,
  topFailures: [
    { label: "Обнаружены секреты", value: 12 },
    { label: "Ошибки IaC", value: 9 },
    { label: "SAST критические", value: 7 },
  ],
};

export const topNoisyRules = [
  { ruleId: "SAST-214", count: 28, medianSeverity: "High" },
  { ruleId: "SECRETS-09", count: 22, medianSeverity: "Critical" },
  { ruleId: "SCA-117", count: 19, medianSeverity: "Medium" },
  { ruleId: "IAAC-31", count: 17, medianSeverity: "High" },
  { ruleId: "SAST-88", count: 15, medianSeverity: "Medium" },
  { ruleId: "SECRETS-22", count: 14, medianSeverity: "High" },
  { ruleId: "SAST-305", count: 12, medianSeverity: "Low" },
  { ruleId: "SCA-74", count: 11, medianSeverity: "Medium" },
  { ruleId: "IAAC-08", count: 10, medianSeverity: "Low" },
  { ruleId: "SAST-19", count: 9, medianSeverity: "Medium" },
];

export const pipelineHealth = [
  { source: "CI Pipeline", lastRun: "45 мин назад", status: "Passing" },
  { source: "Container Scan", lastRun: "2 ч назад", status: "At risk" },
  { source: "IaC Scan", lastRun: "6 ч назад", status: "Passing" },
  { source: "DAST Weekly", lastRun: "2 дн назад", status: "Delayed" },
];

export const workloadFlow = {
  backlog: [
    { label: "Новые", value: 42 },
    { label: "Триаж", value: 31 },
    { label: "В работе", value: 24 },
    { label: "Исправлено", value: 18 },
  ],
  trend: [
    { label: "Неделя 1", value: 110 },
    { label: "Неделя 2", value: 104 },
    { label: "Неделя 3", value: 98 },
    { label: "Неделя 4", value: 92 },
  ],
};

export const devDeliveryMetrics = {
  configured: false,
  leadTimeDays: 4.2,
  deploymentFrequency: "Еженедельно",
  changeFailureRate: 12,
  mttrHours: 6.4,
};

export const developerKpis = {
  assignedToMe: 12,
  needsAttention: 5,
  newSinceLastVisit: 7,
};

export const developerQueue = [
  {
    id: "find-101",
    title: "Жёстко заданный токен в адаптере платежей",
    product: "Payments API",
    severity: "Critical",
    age: "2d",
    status: "Новые",
  },
  {
    id: "find-102",
    title: "Неочищенный ввод пользователя в поиске",
    product: "Core Platform",
    severity: "High",
    age: "4d",
    status: "Триаж",
  },
  {
    id: "find-103",
    title: "Использование слабого хэша",
    product: "Identity Gateway",
    severity: "Medium",
    age: "5d",
    status: "В работе",
  },
  {
    id: "find-104",
    title: "Устаревшая зависимость с CVE",
    product: "Mobile Wallet",
    severity: "High",
    age: "6d",
    status: "Новые",
  },
  {
    id: "find-105",
    title: "Отсутствует проверка авторизации на эндпоинте",
    product: "Payments API",
    severity: "Critical",
    age: "7d",
    status: "Триаж",
  },
  {
    id: "find-106",
    title: "Секреты в конфиге",
    product: "Core Platform",
    severity: "High",
    age: "9d",
    status: "Новые",
  },
  {
    id: "find-107",
    title: "S3 bucket logging disabled",
    product: "Cloud Ops",
    severity: "Medium",
    age: "12d",
    status: "In progress",
  },
  {
    id: "find-108",
    title: "Missing rate limit",
    product: "Identity Gateway",
    severity: "Medium",
    age: "13d",
    status: "New",
  },
  {
    id: "find-109",
    title: "Insecure TLS config",
    product: "Payments API",
    severity: "High",
    age: "15d",
    status: "Triaged",
  },
  {
    id: "find-110",
    title: "Debug logging left enabled",
    product: "Mobile Wallet",
    severity: "Low",
    age: "16d",
    status: "New",
  },
];

export const developerRemediation = {
  title: "Reflected XSS in search results",
  severity: "high",
  evidence: {
    ruleId: "SAST-214",
    metadata: {
      cwe: ["CWE-79"],
      owasp: "injection",
      references: ["https://cheatsheetseries.owasp.org/cheatsheets/XSS_Prevention_Cheat_Sheet.html"],
    },
  },
  snippet: `const query = req.query.q;\nres.send('<div>' + query + '</div>');\n\n// Fix: escape user input\nres.send('<div>' + escapeHtml(query) + '</div>');`,
};

export const developerHotspots = {
  configured: true,
  items: [
    { label: "payments/controller.ts", count: 12 },
    { label: "identity/auth.ts", count: 9 },
    { label: "checkout/validators.ts", count: 8 },
    { label: "wallet/transfer.ts", count: 7 },
  ],
};

export const developerRecentIntroduced = [
  { title: "New secrets rule triggered", product: "Payments API", severity: "Critical", time: "3h ago" },
  { title: "SCA risk added", product: "Mobile Wallet", severity: "High", time: "6h ago" },
  { title: "New SAST violation", product: "Core Platform", severity: "Medium", time: "12h ago" },
  { title: "DAST finding added", product: "Identity Gateway", severity: "High", time: "1d ago" },
];

export const coverageByDomain = [
  { label: "Cloud", value: 92 },
  { label: "Apps", value: 84 },
  { label: "Pipelines", value: 76 },
  { label: "Endpoints", value: 88 },
];

export const pipelineGates = [
  { label: "Build", status: "Passing", rate: 96 },
  { label: "Deploy", status: "At risk", rate: 81 },
  { label: "Release", status: "Passing", rate: 93 },
];

export const policyHealth = [
  { label: "Runtime policies", value: 89 },
  { label: "IaC guardrails", value: 76 },
  { label: "Secrets hygiene", value: 83 },
  { label: "Identity posture", value: 72 },
];

export const recentActivity = [
  { title: "Critical misconfig resolved", meta: "Payments • 2h ago" },
  { title: "New threat model added", meta: "Identity • 6h ago" },
  { title: "Pipeline gate failed", meta: "Platform • 1d ago" },
  { title: "New Jira sync rule", meta: "AppSec • 2d ago" },
];
