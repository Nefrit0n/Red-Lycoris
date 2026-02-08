import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { TrendingUp, AccountTree } from "@mui/icons-material";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { glass, primitives, textStyles } from "../../design-system/tokens";
import type { WidgetDefinition } from "../types";
import {
  appsecKpis,
  coverageByDomain,
  coverageFreshness,
  coverageSnapshot,
  devDeliveryMetrics,
  developerHotspots,
  developerKpis,
  developerQueue,
  developerRecentIntroduced,
  developerRemediation,
  executiveKpis,
  executiveRiskTrend,
  findingsFlow,
  pipelineGates,
  pipelineHealth,
  policyGateSummary,
  policyHealth,
  recentActivity,
  recentCriticalActivity,
  riskTrend,
  severityStatusMatrix,
  slaBreaches,
  topNoisyRules,
  topRiskyProducts,
  topRisks,
  workloadFlow,
} from "../fixtures/mockData";
import {
  selectAppsecKpis,
  selectCoverageSnapshot,
  selectCoverageFreshness,
  selectDevDeliveryMetrics,
  selectDeveloperHotspots,
  selectDeveloperKpis,
  selectDeveloperQueue,
  selectDeveloperRecentIntroduced,
  selectDeveloperRemediation,
  selectExecutiveKpis,
  selectExecutiveRiskTrend,
  selectFindingsFlow,
  selectPipelineHealth,
  selectPolicyGateSummary,
  selectRecentCriticalActivity,
  selectSlaBreaches,
  selectSeverityStatusMatrix,
  selectTopNoisyRules,
  selectTopRiskyProducts,
  selectWorkloadFlow,
} from "../data/selectors";
import RemediationGuidance from "../../components/RemediationGuidance";
import CodeBlock from "../../components/CodeBlock";
import { Link } from "react-router-dom";

const createStaticData = <T,>(data: T) => ({
  data,
  loading: false,
  error: null,
});

const findingsLink = (params: Record<string, string>) => {
  const query = new URLSearchParams(params);
  return `/findings?${query.toString()}`;
};

const RiskTrendWidget = ({ data }: { data: typeof riskTrend | null }) => {
  const theme = useTheme();
  if (!data?.length) return null;
  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primitives.lotus[500]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={primitives.lotus[500]} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{ stroke: theme.palette.divider, strokeDasharray: "3 3" }}
            contentStyle={{
              ...glass.light,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              color: theme.palette.text.primary,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={primitives.lotus[400]}
            fill="url(#riskGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

const ExecutiveRiskTrendWidget = ({ data }: { data: typeof executiveRiskTrend | null }) => {
  const theme = useTheme();
  if (!data?.length) return null;
  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 16, left: -12, bottom: 0 }}
        >
          <defs>
            <linearGradient id="executiveRiskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primitives.lotus[500]} stopOpacity={0.25} />
              <stop offset="100%" stopColor={primitives.lotus[500]} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
          <YAxis hide domain={[40, 100]} />
          <Tooltip
            cursor={{ stroke: theme.palette.divider, strokeDasharray: "3 3" }}
            contentStyle={{
              ...glass.light,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              color: theme.palette.text.primary,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={primitives.lotus[400]}
            fill="url(#executiveRiskGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

const FindingsFlowWidget = ({ data }: { data: typeof findingsFlow | null }) => {
  const theme = useTheme();
  if (!data?.length) return null;
  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="flowOpened" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primitives.lotus[500]} stopOpacity={0.25} />
              <stop offset="100%" stopColor={primitives.lotus[500]} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="flowTriaged" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primitives.petal[500]} stopOpacity={0.2} />
              <stop offset="100%" stopColor={primitives.petal[500]} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="flowFixed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primitives.jade[500]} stopOpacity={0.2} />
              <stop offset="100%" stopColor={primitives.jade[500]} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
          <YAxis hide />
          <Tooltip
            cursor={{ stroke: theme.palette.divider, strokeDasharray: "3 3" }}
            contentStyle={{
              ...glass.light,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              color: theme.palette.text.primary,
            }}
          />
          <Area type="monotone" dataKey="opened" stroke={primitives.lotus[400]} fill="url(#flowOpened)" strokeWidth={2} />
          <Area type="monotone" dataKey="triaged" stroke={primitives.petal[400]} fill="url(#flowTriaged)" strokeWidth={2} />
          <Area type="monotone" dataKey="fixed" stroke={primitives.jade[400]} fill="url(#flowFixed)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

const SeverityStatusMatrixWidget = ({ data }: { data: typeof severityStatusMatrix | null }) => {
  if (!data?.length) return null;
  const severities = [
    { key: "Critical", label: "Критические" },
    { key: "High", label: "Высокие" },
    { key: "Medium", label: "Средние" },
    { key: "Low", label: "Низкие" },
  ];
  const statuses = [
    { key: "New", label: "Новые" },
    { key: "Triaged", label: "Триаж" },
    { key: "In progress", label: "В работе" },
    { key: "Fixed", label: "Исправлено" },
  ];
  const maxValue = Math.max(...data.map((entry) => entry.value));

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${statuses.length + 1}, 1fr)`, gap: 1 }}>
      <Box />
      {statuses.map((status) => (
        <Typography key={status.key} variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
          {status.label}
        </Typography>
      ))}
      {severities.map((severity) => (
        <Box key={severity.key} sx={{ display: "contents" }}>
          <Typography variant="caption" color="text.secondary">
            {severity.label}
          </Typography>
          {statuses.map((status) => {
            const entry = data.find(
              (item) => item.severity === severity.key && item.status === status.key
            );
            const intensity = entry ? entry.value / maxValue : 0;
            return (
              <Box
                key={`${severity.key}-${status.key}`}
                sx={{
                  height: 28,
                  borderRadius: 1,
                  bgcolor: `rgba(225, 29, 72, ${0.12 + intensity * 0.5})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "text.primary",
                  fontSize: "0.75rem",
                }}
              >
                {entry?.value ?? 0}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};

const SeverityStatusDistributionWidget = ({ data }: { data: typeof severityStatusMatrix | null }) => {
  const theme = useTheme();
  if (!data?.length) return null;
  const distribution = [
    { key: "Critical", label: "Критические" },
    { key: "High", label: "Высокие" },
    { key: "Medium", label: "Средние" },
    { key: "Low", label: "Низкие" },
  ].map((severity) => {
    const entries = data.filter((entry) => entry.severity === severity.key);
    return {
      severity: severity.label,
      Новые: entries.find((entry) => entry.status === "New")?.value ?? 0,
      "Триаж": entries.find((entry) => entry.status === "Triaged")?.value ?? 0,
      "В работе": entries.find((entry) => entry.status === "In progress")?.value ?? 0,
      Исправлено: entries.find((entry) => entry.status === "Fixed")?.value ?? 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={distribution} margin={{ left: -16 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="severity" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
        <YAxis hide />
        <Tooltip
          cursor={{ stroke: theme.palette.divider, strokeDasharray: "3 3" }}
          contentStyle={{
            ...glass.light,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            color: theme.palette.text.primary,
          }}
        />
        <Bar dataKey="Новые" stackId="a" fill={primitives.lotus[400]} />
        <Bar dataKey="Триаж" stackId="a" fill={primitives.petal[400]} />
        <Bar dataKey="В работе" stackId="a" fill={primitives.gold[400]} />
        <Bar dataKey="Исправлено" stackId="a" fill={primitives.jade[400]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const CoverageFreshnessWidget = ({ data }: { data: typeof coverageFreshness | null }) => {
  if (!data?.length) return null;
  return (
    <Stack spacing={2} sx={{ maxHeight: 240, overflowY: "auto", pr: 1 }}>
      {data.map((item) => (
        <Box key={item.product}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">{item.product}</Typography>
            <Typography variant="caption" color="text.secondary">
              {item.lastScan}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={item.freshnessScore}
            sx={{
              height: 6,
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.06)",
              "& .MuiLinearProgress-bar": {
                bgcolor: item.freshnessScore > 70 ? primitives.jade[400] : primitives.petal[400],
                borderRadius: 999,
              },
            }}
          />
        </Box>
      ))}
    </Stack>
  );
};

const PolicyGatesSummaryWidget = ({ data }: { data: typeof policyGateSummary | null }) => {
  if (!data) return null;
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={3}>
        <Stack>
          <Typography variant="caption" color="text.secondary">
            Проходят
          </Typography>
          <Typography sx={textStyles.heading.h4} color={primitives.jade[300]}>
            {data.passRate}%
          </Typography>
        </Stack>
        <Stack>
          <Typography variant="caption" color="text.secondary">
            Падают
          </Typography>
          <Typography sx={textStyles.heading.h4} color={primitives.lotus[300]}>
            {data.failRate}%
          </Typography>
        </Stack>
      </Stack>
      <Stack spacing={1}>
        {data.topFailures.map((item) => (
          <Stack key={item.label} direction="row" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="caption" color="text.primary">
              {item.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};

const TopNoisyRulesWidget = ({ data }: { data: typeof topNoisyRules | null }) => {
  if (!data?.length) return null;
  return (
    <Stack spacing={1.5} sx={{ maxHeight: 240, overflowY: "auto", pr: 1 }}>
      {data.map((rule) => (
        <Stack key={rule.ruleId} direction="row" alignItems="center" spacing={2}>
          <Box flex={1}>
            <Typography variant="subtitle2">{rule.ruleId}</Typography>
            <Typography variant="caption" color="text.secondary">
              Медиана: {rule.medianSeverity}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.primary">
            {rule.count}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
};

const PipelineHealthWidget = ({ data }: { data: typeof pipelineHealth | null }) => {
  if (!data?.length) return null;
  const statusLabels: Record<string, string> = {
    Passing: "Проходит",
    "At risk": "Риск",
    Unknown: "Неизвестно",
  };
  return (
    <Stack spacing={1.5} sx={{ maxHeight: 240, overflowY: "auto", pr: 1 }}>
      {data.map((item) => (
        <Stack key={item.source} direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="subtitle2">{item.source}</Typography>
            <Typography variant="caption" color="text.secondary">
              {item.lastRun}
            </Typography>
          </Box>
          <Chip
            label={statusLabels[item.status] ?? item.status}
            size="small"
            sx={{
              bgcolor:
                item.status === "Passing"
                  ? "rgba(16, 185, 129, 0.16)"
                  : item.status === "At risk"
                  ? "rgba(245, 158, 11, 0.2)"
                  : "rgba(148, 163, 184, 0.2)",
              color:
                item.status === "Passing"
                  ? "#10b981"
                  : item.status === "At risk"
                  ? "#f59e0b"
                  : "#94a3b8",
              fontWeight: 600,
            }}
          />
        </Stack>
      ))}
    </Stack>
  );
};

const WorkloadFlowWidget = ({ data }: { data: typeof workloadFlow | null }) => {
  const theme = useTheme();
  if (!data) return null;
  return (
    <Stack spacing={2}>
      <Stack spacing={1.5}>
        {data.backlog.map((item) => (
          <Box key={item.label}>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">
                {item.label}
              </Typography>
              <Typography variant="caption" color="text.primary">
                {item.value}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(item.value / 50) * 100}
              sx={{
                height: 6,
                borderRadius: 999,
                bgcolor: "rgba(255,255,255,0.06)",
                "& .MuiLinearProgress-bar": {
                  bgcolor: primitives.lotus[400],
                  borderRadius: 999,
                },
              }}
            />
          </Box>
        ))}
      </Stack>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data.trend} margin={{ left: -12 }}>
          <defs>
            <linearGradient id="workloadTrend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={primitives.petal[400]} stopOpacity={0.2} />
              <stop offset="100%" stopColor={primitives.petal[400]} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
          <YAxis hide />
          <Tooltip
            cursor={{ stroke: theme.palette.divider, strokeDasharray: "3 3" }}
            contentStyle={{
              ...glass.light,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              color: theme.palette.text.primary,
            }}
          />
          <Area type="monotone" dataKey="value" stroke={primitives.petal[400]} fill="url(#workloadTrend)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </Stack>
  );
};

const DevDeliveryMetricsWidget = ({ data }: { data: typeof devDeliveryMetrics | null }) => {
  if (!data) return null;
  if (!data.configured) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px dashed rgba(255,255,255,0.12)",
          textAlign: "center",
          color: "text.secondary",
        }}
      >
        Метрики DORA ещё не настроены.
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={3}>
        <Stack>
          <Typography variant="caption" color="text.secondary">
            Время цикла
          </Typography>
          <Typography sx={textStyles.heading.h5}>{data.leadTimeDays}d</Typography>
        </Stack>
        <Stack>
          <Typography variant="caption" color="text.secondary">
            Частота деплоя
          </Typography>
          <Typography sx={textStyles.heading.h5}>{data.deploymentFrequency}</Typography>
        </Stack>
      </Stack>
      <Stack direction="row" spacing={3}>
        <Stack>
          <Typography variant="caption" color="text.secondary">
            Доля неудачных изменений
          </Typography>
          <Typography sx={textStyles.heading.h5}>{data.changeFailureRate}%</Typography>
        </Stack>
        <Stack>
          <Typography variant="caption" color="text.secondary">
            MTTR
          </Typography>
          <Typography sx={textStyles.heading.h5}>{data.mttrHours}h</Typography>
        </Stack>
      </Stack>
    </Stack>
  );
};

const DeveloperQuickFiltersWidget = () => (
  <Stack direction="row" spacing={1} flexWrap="wrap">
    {["Критические", "Секреты", "SCA", "SAST", "Новые"].map((label) => (
      <Chip
        key={label}
        label={label}
        size="small"
        variant="outlined"
        clickable
        sx={{ borderColor: "rgba(255,255,255,0.16)", color: "text.secondary" }}
      />
    ))}
  </Stack>
);

const DeveloperQueueWidget = ({ data }: { data: typeof developerQueue | null }) => {
  if (!data?.length) return null;
  const severityStyles: Record<string, { color: string; bg: string }> = {
    Critical: { color: primitives.lotus[400], bg: "rgba(225, 29, 72, 0.18)" },
    High: { color: primitives.petal[400], bg: "rgba(233, 69, 50, 0.18)" },
    Medium: { color: primitives.gold[400], bg: "rgba(245, 158, 11, 0.2)" },
    Low: { color: primitives.jade[400], bg: "rgba(16, 185, 129, 0.18)" },
  };

  return (
    <Stack spacing={2} sx={{ maxHeight: 320, overflowY: "auto", pr: 1 }}>
      {data.map((item) => {
        const style = severityStyles[item.severity] ?? severityStyles.Medium;
        return (
          <Box
            key={item.id}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle2">{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.product} • {item.status}
                  </Typography>
                </Box>
                <Chip
                  label={item.severity}
                  size="small"
                  sx={{ bgcolor: style.bg, color: style.color, fontWeight: 600 }}
                />
              </Stack>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Возраст: {item.age}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="text" color="inherit">
                    Отметить FP
                  </Button>
                  <Button size="small" variant="text" color="inherit">
                    Статус
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    component={Link}
                    to={`/findings/${item.id}`}
                  >
                    Открыть детали
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
};

const DeveloperGuidanceWidget = ({ data }: { data: typeof developerRemediation | null }) => {
  if (!data) return null;
  return (
    <Stack spacing={2}>
      <RemediationGuidance
        evidence={data.evidence}
        title={data.title}
        severity={data.severity}
      />
      <CodeBlock code={data.snippet} language="typescript" maxHeight={220} />
      <Button variant="contained" size="small">
        Исправить сейчас
      </Button>
    </Stack>
  );
};

const DeveloperHotspotsWidget = ({ data }: { data: typeof developerHotspots | null }) => {
  if (!data || !data.configured || data.items.length === 0) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: "1px dashed rgba(255,255,255,0.12)",
          color: "text.secondary",
        }}
      >
        Подключите репозиторий, чтобы включить горячие зоны.
      </Box>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ maxHeight: 220, overflowY: "auto", pr: 1 }}>
      {data.items.map((item) => (
        <Stack key={item.label} direction="row" justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            {item.label}
          </Typography>
          <Typography variant="caption" color="text.primary">
            {item.count}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
};

const DeveloperRecentlyIntroducedWidget = ({
  data,
}: {
  data: typeof developerRecentIntroduced | null;
}) => {
  if (!data?.length) return null;
  return (
    <Stack spacing={1.5} sx={{ maxHeight: 240, overflowY: "auto", pr: 1 }}>
      {data.map((item) => (
        <Stack key={item.title} direction="row" spacing={2} alignItems="center">
          <Box flex={1}>
            <Typography variant="subtitle2">{item.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {item.product} • {item.time}
            </Typography>
          </Box>
          <Chip
            label={item.severity}
            size="small"
            sx={{
              bgcolor: item.severity === "Critical" ? "rgba(225, 29, 72, 0.18)" : "rgba(233, 69, 50, 0.18)",
              color: item.severity === "Critical" ? primitives.lotus[400] : primitives.petal[400],
              fontWeight: 600,
            }}
          />
        </Stack>
      ))}
    </Stack>
  );
};

const TopRiskyProductsWidget = ({ data }: { data: typeof topRiskyProducts | null }) => {
  const theme = useTheme();
  if (!data?.length) return null;
  return (
    <Stack spacing={2} sx={{ maxHeight: 260, overflowY: "auto", pr: 1 }}>
      {data.map((product) => (
        <Box key={product.name}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">{product.name}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {product.risk}
              </Typography>
              <Typography
                variant="caption"
                color={product.delta >= 0 ? primitives.lotus[400] : primitives.jade[400]}
              >
                {product.delta >= 0 ? `+${product.delta}` : product.delta}
              </Typography>
            </Stack>
          </Stack>
          <Box
            sx={{
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                width: `${product.risk}%`,
                height: "100%",
                borderRadius: 999,
                background: theme.palette.mode === "dark" ? primitives.lotus[500] : primitives.lotus[400],
              }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
};

const SlaBreachesWidget = ({ data }: { data: typeof slaBreaches | null }) => {
  const theme = useTheme();
  if (!data) return null;
  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="baseline" spacing={1}>
        <Typography sx={textStyles.heading.h3} color={primitives.lotus[300]}>
          {data.total}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Нарушения SLA за месяц
        </Typography>
      </Stack>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data.breakdown} layout="vertical" margin={{ left: -12 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            width={90}
          />
          <Bar dataKey="value" fill={primitives.lotus[400]} radius={[6, 6, 6, 6]} />
        </BarChart>
      </ResponsiveContainer>
    </Stack>
  );
};

const RecentCriticalActivityWidget = ({ data }: { data: typeof recentCriticalActivity | null }) => {
  if (!data?.length) return null;
  return (
    <Stack spacing={2} sx={{ maxHeight: 260, overflowY: "auto", pr: 1 }}>
      {data.map((item) => (
        <Stack key={item.title} direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: item.severity === "Critical" ? primitives.lotus[500] : primitives.petal[500],
            }}
          />
          <Box flex={1}>
            <Typography variant="subtitle2">{item.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {item.product}
            </Typography>
          </Box>
          <Chip
            label={item.severity}
            size="small"
            sx={{
              bgcolor: item.severity === "Critical" ? "rgba(225, 29, 72, 0.18)" : "rgba(233, 69, 50, 0.18)",
              color: item.severity === "Critical" ? primitives.lotus[400] : primitives.petal[400],
              fontWeight: 600,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {item.time}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
};

const CoverageSnapshotWidget = ({ data }: { data: typeof coverageSnapshot | null }) => {
  if (!data?.length) return null;
  return (
    <Stack spacing={2.5}>
      {data.map((item) => (
        <Box key={item.label}>
          <Stack direction="row" justifyContent="space-between" mb={1}>
            <Typography variant="caption" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="caption" color="text.primary">
              {item.value}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={item.value}
            sx={{
              height: 6,
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.06)",
              "& .MuiLinearProgress-bar": {
                bgcolor: primitives.jade[400],
                borderRadius: 999,
              },
            }}
          />
        </Box>
      ))}
    </Stack>
  );
};

const TopRisksWidget = ({ data }: { data: typeof topRisks | null }) => {
  if (!data?.length) return null;
  return (
    <Stack spacing={2} sx={{ maxHeight: 260, overflowY: "auto", pr: 1 }}>
      {data.map((risk) => (
        <Stack key={risk.title} direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: risk.severity === "High" ? primitives.lotus[500] : primitives.petal[500],
            }}
          />
          <Box flex={1}>
            <Typography variant="subtitle2">{risk.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {risk.owner}
            </Typography>
          </Box>
          <Chip
            label={risk.severity}
            size="small"
            sx={{
              bgcolor: "rgba(225, 29, 72, 0.12)",
              color: primitives.lotus[400],
              fontWeight: 600,
            }}
          />
        </Stack>
      ))}
    </Stack>
  );
};

const CoverageWidget = ({ data }: { data: typeof coverageByDomain | null }) => {
  if (!data?.length) return null;
  return (
    <Stack spacing={2.5} sx={{ maxHeight: 260, overflowY: "auto", pr: 1 }}>
      {data.map((item) => (
        <Box key={item.label}>
          <Stack direction="row" justifyContent="space-between" mb={1}>
            <Typography variant="caption" color="text.secondary">
              {item.label}
            </Typography>
            <Typography variant="caption" color="text.primary">
              {item.value}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={item.value}
            sx={{
              height: 6,
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.06)",
              "& .MuiLinearProgress-bar": {
                bgcolor: primitives.jade[400],
                borderRadius: 999,
              },
            }}
          />
        </Box>
      ))}
    </Stack>
  );
};

const PipelineGatesWidget = ({ data }: { data: typeof pipelineGates | null }) => {
  if (!data?.length) return null;
  const statusLabels: Record<string, string> = {
    Passing: "Проходит",
    "At risk": "Риск",
  };
  return (
    <Stack spacing={2.5} sx={{ maxHeight: 260, overflowY: "auto", pr: 1 }}>
      {data.map((gate) => (
        <Box key={gate.label}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">{gate.label}</Typography>
            <Chip
              label={statusLabels[gate.status] ?? gate.status}
              size="small"
              sx={{
                bgcolor: gate.status === "Passing" ? "rgba(16, 185, 129, 0.16)" : "rgba(245, 158, 11, 0.2)",
                color: gate.status === "Passing" ? "#10b981" : "#f59e0b",
                fontWeight: 600,
              }}
            />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={gate.rate}
            sx={{
              height: 6,
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.06)",
              "& .MuiLinearProgress-bar": {
                bgcolor: gate.status === "Passing" ? "#10b981" : "#f59e0b",
                borderRadius: 999,
              },
            }}
          />
        </Box>
      ))}
    </Stack>
  );
};

const PolicyHealthWidget = ({ data }: { data: typeof policyHealth | null }) => {
  if (!data?.length) return null;
  return (
    <Stack spacing={2.5} sx={{ maxHeight: 260, overflowY: "auto", pr: 1 }}>
      {data.map((policy) => (
        <Box key={policy.label}>
          <Stack direction="row" justifyContent="space-between" mb={1}>
            <Typography variant="caption" color="text.secondary">
              {policy.label}
            </Typography>
            <Typography variant="caption" color="text.primary">
              {policy.value}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={policy.value}
            sx={{
              height: 6,
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.06)",
              "& .MuiLinearProgress-bar": {
                bgcolor: primitives.petal[400],
                borderRadius: 999,
              },
            }}
          />
        </Box>
      ))}
    </Stack>
  );
};

const RecentActivityWidget = ({ data }: { data: typeof recentActivity | null }) => {
  if (!data?.length) return null;
  return (
    <Stack spacing={2} sx={{ maxHeight: 260, overflowY: "auto", pr: 1 }}>
      {data.map((item) => (
        <Box key={item.title}>
          <Typography variant="subtitle2">{item.title}</Typography>
          <Typography variant="caption" color="text.secondary">
            {item.meta}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
};

export const widgetRegistry: WidgetDefinition[] = [
  {
    id: "kpi-open-findings",
    title: "Открытые находки",
    description: "Всего открытых находок по программе",
    category: "Executive",
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    getData: () => createStaticData(selectExecutiveKpis()),
    render: (data: typeof executiveKpis | null) => {
      if (!data) return null;
      return (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Открытые находки</Typography>
          <Typography sx={textStyles.heading.h3} color={primitives.night[50]}>
            {data.openFindings}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Активный бэклог
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ status: "open" }),
  },
  {
    id: "kpi-critical-high",
    title: "Критические + высокие",
    description: "Критические и высокие по серьёзности",
    category: "Executive",
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    getData: () => createStaticData(selectExecutiveKpis()),
    render: (data: typeof executiveKpis | null) => {
      if (!data) return null;
      return (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Критические + высокие</Typography>
          <Typography sx={textStyles.heading.h3} color={primitives.lotus[300]}>
            {data.criticalHigh}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Самые срочные
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ severity: "critical,high" }),
  },
  {
    id: "kpi-products-risk",
    title: "Продукты в риске",
    description: "Продукты с повышенным риском",
    category: "Executive",
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    getData: () => createStaticData(selectExecutiveKpis()),
    render: (data: typeof executiveKpis | null) => {
      if (!data || data.productsAtRisk === null) return null;
      return (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Продукты в риске</Typography>
          <Typography sx={textStyles.heading.h3} color={primitives.petal[300]}>
            {data.productsAtRisk}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Требуют внимания
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ view: "products-risk" }),
  },
  {
    id: "kpi-scan-freshness",
    title: "Свежесть сканов",
    description: "Давность последнего скана",
    category: "Executive",
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    getData: () => createStaticData(selectExecutiveKpis()),
    render: (data: typeof executiveKpis | null) => {
      if (!data || data.scanFreshnessMinutes === null) return null;
      return (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Свежесть сканов</Typography>
          <Typography sx={textStyles.heading.h3} color={primitives.jade[300]}>
            {data.scanFreshnessMinutes}м
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {data.scanFreshnessLabel}
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ view: "freshness" }),
  },
  {
    id: "exec-risk-trend",
    title: "Тренд риска",
    description: "Динамика риска за 30/90 дней",
    category: "Executive",
    defaultSize: { w: 7, h: 4 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(selectExecutiveRiskTrend()),
    render: (data: typeof executiveRiskTrend | null) => <ExecutiveRiskTrendWidget data={data} />,
    linkTo: findingsLink({ view: "risk-trend" }),
  },
  {
    id: "exec-top-risky-products",
    title: "Топ рискованных продуктов",
    description: "Самый высокий риск по продуктам",
    category: "Executive",
    defaultSize: { w: 5, h: 4 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(selectTopRiskyProducts()),
    render: (data: typeof topRiskyProducts | null) => <TopRiskyProductsWidget data={data} />,
    linkTo: findingsLink({ view: "top-risky-products" }),
  },
  {
    id: "exec-sla-breaches",
    title: "Нарушения SLA",
    description: "Нарушения SLA или гейтов",
    category: "Executive",
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(selectSlaBreaches()),
    render: (data: typeof slaBreaches | null) => <SlaBreachesWidget data={data} />,
    linkTo: findingsLink({ view: "sla" }),
    pinnable: true,
  },
  {
    id: "exec-critical-activity",
    title: "Критическая активность",
    description: "Горячие проблемы, требующие внимания",
    category: "Executive",
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(selectRecentCriticalActivity()),
    render: (data: typeof recentCriticalActivity | null) => <RecentCriticalActivityWidget data={data} />,
    linkTo: findingsLink({ severity: "critical" }),
    pinnable: true,
  },
  {
    id: "exec-coverage-snapshot",
    title: "Снимок покрытия",
    description: "Покрытие сканами и политиками",
    category: "Executive",
    defaultSize: { w: 12, h: 3 },
    minSize: { w: 6, h: 3 },
    getData: () => createStaticData(selectCoverageSnapshot()),
    render: (data: typeof coverageSnapshot | null) => <CoverageSnapshotWidget data={data} />,
    linkTo: findingsLink({ view: "coverage" }),
  },
  {
    id: "kpi-new-findings",
    title: "Новые находки",
    description: "Новые находки за последние 7 дней",
    category: "AppSec",
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    getData: () => createStaticData(selectAppsecKpis()),
    render: (data: typeof appsecKpis | null) => {
      if (!data || data.newFindings === null || data.newFindingsDelta === null) return null;
      return (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Новые находки</Typography>
          <Typography sx={textStyles.heading.h3} color={primitives.petal[300]}>
            {data.newFindings}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {data.newFindingsDelta >= 0 ? "+" : ""}
            {data.newFindingsDelta} к прошлой неделе
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ status: "new", window: "7d" }),
  },
  {
    id: "kpi-mttr",
    title: "MTTR / старение",
    description: "Медианное время до исправления",
    category: "AppSec",
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    getData: () => createStaticData(selectAppsecKpis()),
    render: (data: typeof appsecKpis | null) => {
      if (!data || data.mttrDays === null) return null;
      return (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">MTTR</Typography>
          <Typography sx={textStyles.heading.h3} color={primitives.gold[300]}>
            {data.mttrDays ? `${data.mttrDays}д` : "Не задано"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {data.mttrLabel}
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ sort: "age" }),
  },
  {
    id: "kpi-coverage",
    title: "Покрытие",
    description: "Продукты со свежими сканами",
    category: "DevSecOps",
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    getData: () => createStaticData(selectAppsecKpis()),
    render: (data: typeof appsecKpis | null) => {
      if (!data || data.coveragePercent === null) return null;
      return (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Покрытие</Typography>
          <Typography sx={textStyles.heading.h3} color={primitives.jade[300]}>
            {data.coveragePercent}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Продукты со сканами за 7 дней
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ view: "coverage", window: "7d" }),
  },
  {
    id: "kpi-policy-pass",
    title: "Прохождение гейтов",
    description: "Доля прохождения политик",
    category: "DevSecOps",
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    getData: () => createStaticData(selectAppsecKpis()),
    render: (data: typeof appsecKpis | null) => {
      if (!data || data.policyPassRate === null) return null;
      return (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Прохождение политик</Typography>
          <Typography sx={textStyles.heading.h3} color={primitives.jade[300]}>
            {data.policyPassRate}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Доля прохождения гейтов
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ status: "failed", view: "gates" }),
  },
  {
    id: "findings-flow",
    title: "Поток находок",
    description: "Открыто, триаж, исправлено",
    category: "AppSec",
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(selectFindingsFlow()),
    render: (data: typeof findingsFlow | null) => <FindingsFlowWidget data={data} />,
    linkTo: findingsLink({ view: "flow" }),
    pinnable: true,
  },
  {
    id: "severity-status-matrix",
    title: "Серьёзность × статус",
    description: "Тепловая карта распределения нагрузки",
    category: "AppSec",
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(selectSeverityStatusMatrix()),
    render: (data: typeof severityStatusMatrix | null) => <SeverityStatusMatrixWidget data={data} />,
    linkTo: findingsLink({ view: "matrix" }),
    pinnable: true,
  },
  {
    id: "severity-status-distribution",
    title: "Распределение серьёзности/статуса",
    description: "Стек по серьёзности и статусу",
    category: "AppSec",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    getData: () => createStaticData(selectSeverityStatusMatrix()),
    render: (data: typeof severityStatusMatrix | null) => <SeverityStatusDistributionWidget data={data} />,
    linkTo: findingsLink({ view: "distribution" }),
    pinnable: true,
  },
  {
    id: "coverage-freshness",
    title: "Покрытие и свежесть",
    description: "Продукты с давностью последнего скана",
    category: "DevSecOps",
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(selectCoverageFreshness()),
    render: (data: typeof coverageFreshness | null) => <CoverageFreshnessWidget data={data} />,
    linkTo: findingsLink({ view: "freshness" }),
  },
  {
    id: "policy-gates-summary",
    title: "Сводка по политикам и гейтам",
    description: "Проходят/падают и основные причины",
    category: "DevSecOps",
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(selectPolicyGateSummary()),
    render: (data: typeof policyGateSummary | null) => <PolicyGatesSummaryWidget data={data} />,
    linkTo: findingsLink({ status: "failed", view: "policy" }),
    pinnable: true,
  },
  {
    id: "top-noisy-rules",
    title: "Самые шумные правила",
    description: "Частые правила и семейства",
    category: "AppSec",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    getData: () => createStaticData(selectTopNoisyRules()),
    render: (data: typeof topNoisyRules | null) => <TopNoisyRulesWidget data={data} />,
    linkTo: findingsLink({ view: "rules" }),
  },
  {
    id: "pipeline-health",
    title: "Состояние пайплайна",
    description: "Последние сканы и статус пайплайна",
    category: "DevSecOps",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    getData: () => createStaticData(selectPipelineHealth()),
    render: (data: typeof pipelineHealth | null) => <PipelineHealthWidget data={data} />,
    linkTo: findingsLink({ view: "pipeline" }),
    pinnable: true,
  },
  {
    id: "workload-flow",
    title: "Нагрузка и поток",
    description: "Бэклог по статусам и тренд",
    category: "AppSec",
    defaultSize: { w: 12, h: 3 },
    minSize: { w: 6, h: 3 },
    getData: () => createStaticData(selectWorkloadFlow()),
    render: (data: typeof workloadFlow | null) => <WorkloadFlowWidget data={data} />,
    linkTo: findingsLink({ view: "backlog" }),
    pinnable: true,
  },
  {
    id: "dev-delivery-metrics",
    title: "Метрики поставки",
    description: "Снимок DORA Four Keys",
    category: "DevSecOps",
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(selectDevDeliveryMetrics()),
    render: (data: typeof devDeliveryMetrics | null) => <DevDeliveryMetricsWidget data={data} />,
    linkTo: findingsLink({ view: "dora" }),
  },
  {
    id: "kpi-assigned",
    title: "Назначено мне",
    description: "Находки, назначенные вам",
    category: "Engineering",
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    getData: () => createStaticData(selectDeveloperKpis()),
    render: (data: typeof developerKpis | null) => {
      if (!data) return null;
      return (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Назначено мне</Typography>
          <Typography sx={textStyles.heading.h3} color={primitives.night[50]}>
            {data.assignedToMe}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            В вашей очереди
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ assignee: "me" }),
  },
  {
    id: "kpi-needs-attention",
    title: "Требуют внимания",
    description: "Критические и высокие по серьёзности",
    category: "Engineering",
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    getData: () => createStaticData(selectDeveloperKpis()),
    render: (data: typeof developerKpis | null) => {
      if (!data) return null;
      return (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Требуют внимания</Typography>
          <Typography sx={textStyles.heading.h3} color={primitives.lotus[300]}>
            {data.needsAttention}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Критические и высокие
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ severity: "critical,high", assignee: "me" }),
  },
  {
    id: "kpi-new-since",
    title: "Новые с прошлого визита",
    description: "Добавленные свежие находки",
    category: "Engineering",
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    getData: () => createStaticData(selectDeveloperKpis()),
    render: (data: typeof developerKpis | null) => {
      if (!data) return null;
      return (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Новые с прошлого визита</Typography>
          <Typography sx={textStyles.heading.h3} color={primitives.petal[300]}>
            {data.newSinceLastVisit}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Требуют просмотра
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ status: "new", assignee: "me" }),
  },
  {
    id: "dev-quick-filters",
    title: "Быстрые фильтры",
    description: "Переход к ключевым срезам",
    category: "Engineering",
    defaultSize: { w: 12, h: 2 },
    minSize: { w: 6, h: 2 },
    getData: () => createStaticData({}),
    render: () => <DeveloperQuickFiltersWidget />,
    linkTo: findingsLink({ view: "filters" }),
  },
  {
    id: "dev-my-queue",
    title: "Моя очередь",
    description: "Находки, назначенные вам",
    category: "Engineering",
    defaultSize: { w: 7, h: 7 },
    minSize: { w: 6, h: 4 },
    getData: () => createStaticData(selectDeveloperQueue()),
    render: (data: typeof developerQueue | null) => <DeveloperQueueWidget data={data} />,
    linkTo: findingsLink({ assignee: "me" }),
    pinnable: true,
  },
  {
    id: "dev-fix-guidance",
    title: "Рекомендации по исправлению",
    description: "Предлагаемое исправление",
    category: "Engineering",
    defaultSize: { w: 5, h: 3 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(selectDeveloperRemediation()),
    render: (data: typeof developerRemediation | null) => <DeveloperGuidanceWidget data={data} />,
    linkTo: findingsLink({ view: "guidance" }),
    pinnable: true,
  },
  {
    id: "dev-hotspots",
    title: "Горячие зоны",
    description: "Модули с повторяющимися проблемами",
    category: "Engineering",
    defaultSize: { w: 5, h: 2 },
    minSize: { w: 4, h: 2 },
    getData: () => createStaticData(selectDeveloperHotspots()),
    render: (data: typeof developerHotspots | null) => <DeveloperHotspotsWidget data={data} />,
    linkTo: findingsLink({ view: "hotspots" }),
  },
  {
    id: "dev-recently-introduced",
    title: "Недавно появившиеся",
    description: "Последние события в вашей области",
    category: "Engineering",
    defaultSize: { w: 5, h: 2 },
    minSize: { w: 4, h: 2 },
    getData: () => createStaticData(selectDeveloperRecentIntroduced()),
    render: (data: typeof developerRecentIntroduced | null) => (
      <DeveloperRecentlyIntroducedWidget data={data} />
    ),
    linkTo: findingsLink({ view: "recent" }),
    pinnable: true,
  },
  {
    id: "risk-trend",
    title: "Тренд риска",
    description: "Динамика устойчивости",
    category: "Risk",
    defaultSize: { w: 8, h: 4 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(riskTrend),
    render: (data: typeof riskTrend | null) => <RiskTrendWidget data={data} />,
    linkTo: findingsLink({ view: "risk-trend" }),
  },
  {
    id: "top-risks",
    title: "Главные драйверы риска",
    description: "Самые влияющие элементы",
    category: "Risk",
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    getData: () => createStaticData(topRisks),
    render: (data: typeof topRisks | null) => <TopRisksWidget data={data} />,
    linkTo: findingsLink({ view: "top-risks" }),
  },
  {
    id: "coverage-domains",
    title: "Покрытие по доменам",
    description: "Прогресс покрытия",
    category: "DevSecOps",
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(coverageByDomain),
    render: (data: typeof coverageByDomain | null) => <CoverageWidget data={data} />,
    linkTo: findingsLink({ view: "coverage" }),
  },
  {
    id: "pipeline-gates",
    title: "Гейты пайплайна",
    description: "Контроль поставки",
    category: "DevSecOps",
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(pipelineGates),
    render: (data: typeof pipelineGates | null) => <PipelineGatesWidget data={data} />,
    linkTo: findingsLink({ view: "gates" }),
  },
  {
    id: "policy-health",
    title: "Здоровье политик",
    description: "Соблюдение гардрейлов",
    category: "AppSec",
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 3 },
    getData: () => createStaticData(policyHealth),
    render: (data: typeof policyHealth | null) => <PolicyHealthWidget data={data} />,
    linkTo: findingsLink({ view: "policy" }),
  },
  {
    id: "recent-activity",
    title: "Недавняя активность",
    description: "Последние обновления",
    category: "Operations",
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 3 },
    getData: () => createStaticData(recentActivity),
    render: (data: typeof recentActivity | null) => <RecentActivityWidget data={data} />,
    linkTo: findingsLink({ view: "activity" }),
  },
  {
    id: "risk-focus",
    title: "Фокус по рискам",
    description: "Зоны фокуса на неделю",
    category: "Risk",
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    getData: () =>
      createStaticData({
        message: "3 критических направления требуют внимания",
      }),
    render: (data: { message: string } | null) => {
      if (!data) return null;
      return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          height: "100%",
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            bgcolor: "rgba(225, 29, 72, 0.12)",
            color: primitives.lotus[400],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TrendingUp />
        </Box>
        <Box>
          <Typography sx={textStyles.heading.h6}>Приоритет сейчас</Typography>
          <Typography variant="body2" color="text.secondary">
            {data.message}
          </Typography>
        </Box>
      </Box>
      );
    },
    linkTo: findingsLink({ view: "focus" }),
  },
  {
    id: "engineering-health",
    title: "Сигнал инженерии",
    description: "SLA, исправление и качество",
    category: "Engineering",
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 3, h: 2 },
    getData: () => createStaticData({ rate: 91, label: "Remediation SLA" }),
    render: (data: { rate: number; label: string } | null) => {
      if (!data) return null;
      return (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AccountTree fontSize="small" />
            <Typography variant="subtitle2">{data.label}</Typography>
          </Stack>
          <Typography sx={{ ...textStyles.heading.h3, color: primitives.night[50] }}>
            {data.rate}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Команды соблюдают SLA по критическим исправлениям.
          </Typography>
        </Stack>
      );
    },
    linkTo: findingsLink({ view: "engineering" }),
  },
];
