import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { request } from "../api/client";
import styles from "./Dashboard.module.css";

const API = import.meta.env.VITE_API_URL ?? "";

type TrendPoint = { date: string; value: number };
type SeverityKey = "critical" | "high" | "medium" | "low" | "info";
type SeverityBucket = { severity: SeverityKey; count: number };
type ProductItem = {
  id: string;
  name: string;
  version?: string;
  score: number;
  findings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};
type ActivityItem = {
  id: string;
  title: string;
  product: string;
  severity: SeverityKey;
  tool: "zap" | "trufflehog" | "trivy";
  time?: string;
  timestamp?: string;
};

type DashboardState = {
  trend: TrendPoint[];
  severity: SeverityBucket[];
  products: ProductItem[];
  activity: ActivityItem[];
};

const SEVERITY_COLORS: Record<SeverityKey, string> = {
  critical: "#a855f7",
  high: "#ef4444",
  medium: "#f97316",
  low: "#22c55e",
  info: "#64748b",
};

const TOOL_CONFIG = {
  zap: { label: "ZAP", color: "#3b82f6" },
  trufflehog: { label: "TruffleHog", color: "#f59e0b" },
  trivy: { label: "Trivy", color: "#06b6d4" },
} as const;

const fmtDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
};

const formatAgo = (value: string) => {
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "только что";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}м назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}ч назад`;
  return `${Math.floor(hours / 24)}д назад`;
};

function Sparkline({ data, color }: { data: TrendPoint[]; color: string }) {
  const width = 200;
  const height = 32;
  const max = Math.max(...data.map((x) => x.value), 1);
  const points = data
    .map((d, i) => {
      const x = data.length > 1 ? (i / (data.length - 1)) * width : width / 2;
      const y = height - (d.value / max) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const area = `0,${height} ${points} ${width},${height}`;
  const gradId = `spark-${color.replace("#", "")}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FindingsTrendChart({ data }: { data: TrendPoint[] }) {
  const W = 680;
  const H = 200;
  const PAD = { top: 10, right: 10, bottom: 28, left: 36 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const gridLines = 4;

  const points = data.map((d, i) => ({
    x: PAD.left + (data.length > 1 ? (i / (data.length - 1)) * cw : cw / 2),
    y: PAD.top + ch - (d.value / max) * ch,
    date: d.date,
    value: d.value,
  }));

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${PAD.left},${PAD.top + ch} ${line} ${PAD.left + cw},${PAD.top + ch}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = PAD.top + (i / gridLines) * ch;
        const val = Math.round(max - (i / gridLines) * max);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1e293b" strokeWidth="1" />
            <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="9" className={styles.mono} fill="#64748b">
              {val}
            </text>
          </g>
        );
      })}

      {points.filter((_, i) => i % 2 === 0).map((p) => (
        <text key={p.date} x={p.x} y={H - 6} textAnchor="middle" fontSize="8" className={styles.mono} fill="#64748b">
          {fmtDate(p.date)}
        </text>
      ))}

      <polygon points={area} fill="url(#trendGrad)" />
      <polyline points={line} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      {points.length > 0 && (
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="4" fill="#3b82f6" stroke="#0c1220" strokeWidth="2">
          <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

function SeverityDonut({ items }: { items: SeverityBucket[] }) {
  const total = items.reduce((s, d) => s + d.count, 0);
  const r = 50;
  const stroke = 12;
  const size = 130;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  const maxVal = Math.max(...items.map((d) => d.count), 1);

  return (
    <>
      <div className={styles.donutWrap}>
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#111827" strokeWidth={stroke} />
            {items.filter((d) => d.count > 0).map((d) => {
              const pct = total > 0 ? d.count / total : 0;
              const dash = pct * circ;
              const gap = circ - dash;
              const off = -acc * circ;
              acc += pct;
              return (
                <circle
                  key={d.severity}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={SEVERITY_COLORS[d.severity]}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={off}
                />
              );
            })}
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div className={`${styles.mono}`} style={{ fontSize: 22, fontWeight: 700 }}>{total}</div>
              <div style={{ fontSize: 8, color: "#64748b", fontWeight: 700 }}>НАХОДОК</div>
            </div>
          </div>
        </div>
        <div className={styles.legend}>
          {items.map((d) => (
            <div key={d.severity} className={styles.legendRow}>
              <span className={styles.legendDot} style={{ background: SEVERITY_COLORS[d.severity] }} />
              <span style={{ minWidth: 88, color: "#64748b" }}>{sevLabel(d.severity)}</span>
              <span className={styles.mono} style={{ color: SEVERITY_COLORS[d.severity], fontWeight: 700 }}>
                {d.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.severityBars}>
        {items.map((d) => (
          <div key={d.severity} className={styles.barRow}>
            <span className={styles.shortLabel}>{sevShort(d.severity)}</span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{
                  width: `${(d.count / maxVal) * 100}%`,
                  background: `linear-gradient(90deg, ${SEVERITY_COLORS[d.severity]}, ${SEVERITY_COLORS[d.severity]}b0)`,
                }}
              />
            </div>
            <span className={styles.mono} style={{ color: SEVERITY_COLORS[d.severity], fontWeight: 700, minWidth: 22, textAlign: "right" }}>
              {d.count}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

const sevLabel = (s: SeverityKey) => ({
  critical: "Критический",
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
  info: "Информ.",
}[s]);

const sevShort = (s: SeverityKey) => ({
  critical: "КРИТ",
  high: "ВЫС",
  medium: "СР",
  low: "НИЗ",
  info: "ИНФ",
}[s]);

const scoreColor = (score: number) => {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
};

const statTrend = (items: TrendPoint[]) => {
  if (items.length < 2) return 0;
  return items[items.length - 1].value - items[Math.max(0, items.length - 8)].value;
};

const orderSeverity = (list: SeverityBucket[]) => {
  const order: SeverityKey[] = ["critical", "high", "medium", "low", "info"];
  return order.map((sev) => list.find((x) => x.severity === sev) ?? { severity: sev, count: 0 });
};

const initialState: DashboardState = {
  trend: [],
  severity: orderSeverity([]),
  products: [],
  activity: [],
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardState>(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [trend, severity, products, activity] = await Promise.all([
          request<TrendPoint[]>(`${API}/api/dashboard/findings-trend`, { signal: controller.signal }),
          request<SeverityBucket[]>(`${API}/api/dashboard/severity-distribution`, { signal: controller.signal }),
          request<ProductItem[]>(`${API}/api/dashboard/top-products`, { signal: controller.signal }),
          request<ActivityItem[]>(`${API}/api/dashboard/recent-activity`, { signal: controller.signal }),
        ]);

        setData({
          trend: trend ?? [],
          severity: orderSeverity(severity ?? []),
          products: [...(products ?? [])].sort((a, b) => b.findings - a.findings),
          activity: activity ?? [],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Ошибка загрузки дашборда";
        setError(message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  const totalOpen = useMemo(() => data.severity.reduce((s, item) => s + item.count, 0), [data.severity]);
  const criticalHigh = useMemo(
    () => data.severity.filter((x) => x.severity === "critical" || x.severity === "high").reduce((s, x) => s + x.count, 0),
    [data.severity]
  );
  const fixedWeek = 0;
  const atRisk = data.products.filter((x) => x.findings > 0).length;
  const trendDelta = statTrend(data.trend);

  const criticalTrendData = data.trend.map((d) => ({ ...d, value: Math.round(d.value * 0.5) }));
  const fixedTrendData = data.trend.map((d) => ({ ...d, value: 0 }));

  const lastUpdated = new Date().toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const maxFindings = Math.max(...data.products.map((p) => p.findings), 1);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Дашборд</h1>
          <p className={styles.subtitle}>Обзор состояния безопасности • обновлено {lastUpdated}</p>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.cardGrid}>
        <StatCard label="Открытые находки" value={totalOpen} color="#f59e0b" trend={trendDelta} alert={totalOpen > 0} sparkData={data.trend} icon="⚑" />
        <StatCard label="Критич. / Высокий" value={criticalHigh} color="#ef4444" trend={criticalHigh} alert={criticalHigh > 0} sparkData={criticalTrendData} icon="▲" />
        <StatCard label="Исправлено за неделю" value={fixedWeek} color="#22c55e" trend={0} alert={false} sparkData={fixedTrendData} icon="✓" />
        <StatCard label="Продуктов под угрозой" value={atRisk} color="#dc2662" alert={atRisk > 0} sparkData={data.trend} icon="🛡" />
      </div>

      <div className={styles.gridTwo}>
        <section className={styles.section}>
          <SectionHeader title="Тренд находок (30 дней)" subtitle="Динамика появления новых находок" />
          <div className={styles.chartPad}>{loading ? <div className={styles.empty}>Загрузка графика…</div> : <FindingsTrendChart data={data.trend} />}</div>
        </section>

        <section className={styles.section}>
          <SectionHeader title="Распределение по критичности" subtitle="Открытые находки" />
          <div className={styles.severityBody}>{loading ? <div className={styles.empty}>Загрузка распределения…</div> : <SeverityDonut items={data.severity} />}</div>
        </section>
      </div>

      <div className={styles.gridBottom}>
        <section className={styles.section}>
          <SectionHeader title="Продукты по риску" subtitle="Ранжирование по количеству находок" />
          <div className={styles.tableHead}>
            <span>ПРОДУКТ</span>
            <span style={{ textAlign: "center" }}>ОЦЕНКА</span>
            <span>РАСПРЕДЕЛЕНИЕ</span>
            <span style={{ textAlign: "right" }}>ВСЕГО</span>
          </div>
          {loading && <div className={styles.empty}>Загрузка продуктов…</div>}
          {!loading && data.products.map((product) => {
            const segments = [
              { value: product.critical, color: SEVERITY_COLORS.critical },
              { value: product.high, color: SEVERITY_COLORS.high },
              { value: product.medium, color: SEVERITY_COLORS.medium },
              { value: product.low, color: SEVERITY_COLORS.low },
            ].filter((s) => s.value > 0);

            const scoreCol = scoreColor(product.score);

            return (
              <div key={product.id} className={styles.productRow}>
                <div className={styles.productInfo}>
                  <div className={styles.avatar}>{product.name.charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.name}>{product.name}</div>
                    <div className={`${styles.version} ${styles.mono}`}>{product.version ?? "—"}</div>
                  </div>
                </div>
                <div className={styles.scoreWrap}>
                  <span className={styles.scoreDot} style={{ background: scoreCol, boxShadow: `0 0 8px ${scoreCol}66` }} />
                  <span className={`${styles.scoreValue} ${styles.mono}`} style={{ color: scoreCol }}>{product.score}</span>
                </div>
                <div className={styles.stackBar}>
                  {segments.map((segment) => (
                    <span
                      key={`${product.id}-${segment.color}`}
                      className={styles.stackSeg}
                      style={{ width: `${((segment.value / Math.max(product.findings, 1)) * 100 * (product.findings / maxFindings)).toFixed(2)}%`, background: segment.color }}
                    />
                  ))}
                </div>
                <span className={`${styles.total} ${styles.mono}`} style={{ color: product.findings > 10 ? "#fca5a5" : "#64748b" }}>
                  {product.findings}
                </span>
              </div>
            );
          })}
        </section>

        <section className={styles.section}>
          <SectionHeader
            title="Последняя активность"
            subtitle="Недавно обнаруженные находки"
            right={<span className={styles.mono} style={{ color: "#60a5fa", fontSize: 11 }}>{data.activity.length} записей</span>}
          />
          <div className={styles.activityList}>
            {loading && <div className={styles.empty}>Загрузка активности…</div>}
            {!loading && data.activity.map((item) => {
              const toolCfg = TOOL_CONFIG[item.tool];
              return (
                <div key={item.id} className={styles.activityItem}>
                  <span className={styles.sevDot} style={{ background: SEVERITY_COLORS[item.severity], boxShadow: `0 0 6px ${SEVERITY_COLORS[item.severity]}80` }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className={styles.activityTitle}>{item.title}</div>
                    <div className={styles.activityMeta}>
                      <span className={styles.activityProduct}>{item.product}</span>
                      {toolCfg && (
                        <span className={styles.toolBadge} style={{ background: `${toolCfg.color}22`, color: toolCfg.color }}>
                          {toolCfg.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={styles.activityTime}>{item.time ?? formatAgo(item.timestamp ?? "")}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  trend,
  alert,
  sparkData,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  trend?: number;
  alert: boolean;
  sparkData: TrendPoint[];
}) {
  return (
    <article
      className={`${styles.card} ${alert ? styles.cardAlert : ""}`}
      style={{
        ["--accent" as string]: color,
        ["--accent-soft" as string]: `${color}18`,
        ["--accent-faint" as string]: `${color}08`,
        ["--accent-weak" as string]: `${color}40`,
      }}
    >
      <div className={styles.cardHead}>
        <div className={styles.iconWrap}>{icon}</div>
        {typeof trend === "number" && (
          <div className={`${styles.trend} ${trend > 0 ? styles.trendUp : trend < 0 ? styles.trendDown : ""}`}>
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}
            {Math.abs(trend)} <span style={{ color: "#64748b" }}>за нед.</span>
          </div>
        )}
      </div>

      <div>
        <div className={`${styles.value} ${alert && value > 0 ? styles.valueAlert : ""}`}>{value}</div>
        <div className={styles.label}>{label}</div>
      </div>

      <div className={styles.spark}>{sparkData.length > 0 ? <Sparkline data={sparkData} color={color} /> : null}</div>
    </article>
  );
}

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        <p className={styles.sectionTitle}>{title}</p>
        {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
