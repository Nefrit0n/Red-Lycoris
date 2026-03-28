import { useState, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════
   DASHBOARD — Red Lycoris
   Redesigned with unified design system
   ═══════════════════════════════════════════════════════════ */

/* ── Mock Data ── */
const STATS = {
  openFindings: 38,
  criticalHigh: 21,
  fixedThisWeek: 0,
  productsAtRisk: 1,
  totalProducts: 3,
  totalScans: 33,
  avgHealthScore: 63,
};

const TREND_DATA = [
  { date: "28.02", value: 0 }, { date: "02.03", value: 1 }, { date: "04.03", value: 1 },
  { date: "06.03", value: 1 }, { date: "08.03", value: 2 }, { date: "10.03", value: 2 },
  { date: "12.03", value: 2 }, { date: "14.03", value: 2 }, { date: "16.03", value: 3 },
  { date: "18.03", value: 3 }, { date: "20.03", value: 3 }, { date: "22.03", value: 5 },
  { date: "24.03", value: 12 }, { date: "26.03", value: 28 }, { date: "28.03", value: 38 },
];

const SEVERITY_DATA = [
  { label: "Критический", short: "КРИТ", value: 2, color: "#a855f7", bg: "#3b076420" },
  { label: "Высокий", short: "ВЫС", value: 19, color: "#ef4444", bg: "#450a0a20" },
  { label: "Средний", short: "СР", value: 11, color: "#f97316", bg: "#43140720" },
  { label: "Низкий", short: "НИЗ", value: 4, color: "#22c55e", bg: "#05291620" },
  { label: "Информ.", short: "ИНФ", value: 2, color: "#64748b", bg: "#1e293b20" },
];

const PRODUCTS = [
  { name: "cassandra-backend", score: 63, findings: 38, critical: 2, high: 19, medium: 11, low: 4, info: 2, version: "v2.4.1" },
  { name: "api-gateway", score: 87, findings: 5, critical: 0, high: 1, medium: 2, low: 2, info: 0, version: "v1.12.0" },
  { name: "auth-service", score: 92, findings: 2, critical: 0, high: 0, medium: 1, low: 1, info: 0, version: "v3.1.4" },
];

const ACTIVITY = [
  { title: "Missing anti-clickjacking header", product: "cassandra-backend", severity: "high", time: "3ч назад", tool: "zap" },
  { title: "Timestamp Disclosure – Unix", product: "cassandra-backend", severity: "low", time: "3ч назад", tool: "zap" },
  { title: "Content Security Policy (CSP) Header Not Set", product: "cassandra-backend", severity: "medium", time: "3ч назад", tool: "zap" },
  { title: "Password in URL", product: "cassandra-backend", severity: "low", time: "3ч назад", tool: "zap" },
  { title: "Slack Bot Token", product: "cassandra-backend", severity: "critical", time: "3ч назад", tool: "trufflehog" },
  { title: "High Entropy String", product: "cassandra-backend", severity: "high", time: "3ч назад", tool: "trufflehog" },
  { title: "AWS API Key", product: "cassandra-backend", severity: "critical", time: "3ч назад", tool: "trufflehog" },
  { title: "libssl3@3.3.2-r0", product: "cassandra-backend", severity: "low", time: "3ч назад", tool: "trivy" },
  { title: "libcrypto3@3.3.2-r0", product: "cassandra-backend", severity: "low", time: "3ч назад", tool: "trivy" },
  { title: "S3 bucket is publicly readable", product: "cassandra-backend", severity: "high", time: "3ч назад", tool: "trivy" },
];

const SEV_COLOR = {
  critical: "#a855f7",
  high: "#ef4444",
  medium: "#f97316",
  low: "#22c55e",
  info: "#64748b",
};

const TOOL_CFG = {
  zap:        { color: "#3b82f6", icon: "⚡", label: "ZAP" },
  trufflehog: { color: "#f59e0b", icon: "🐽", label: "TruffleHog" },
  trivy:      { color: "#06b6d4", icon: "🔍", label: "Trivy" },
};

/* ═══════════════════════════════════════════════════════════
   Sparkline SVG
   ═══════════════════════════════════════════════════════════ */
function Sparkline({ data, width = 240, height = 48, color = "#60a5fa" }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (d.value / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`spark-grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-grad-${color.replace("#","")})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}40)` }} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Big Trend Chart
   ═══════════════════════════════════════════════════════════ */
function TrendChart({ data }) {
  const W = 680, H = 200, PAD = { top: 10, right: 10, bottom: 28, left: 36 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const max = Math.max(...data.map(d => d.value), 1);
  const gridLines = 4;

  const points = data.map((d, i) => {
    const x = PAD.left + (i / (data.length - 1)) * cw;
    const y = PAD.top + ch - (d.value / max) * ch;
    return { x, y, ...d };
  });
  const line = points.map(p => `${p.x},${p.y}`).join(" ");
  const area = `${PAD.left},${PAD.top + ch} ${line} ${PAD.left + cw},${PAD.top + ch}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = PAD.top + (i / gridLines) * ch;
        const val = Math.round(max - (i / gridLines) * max);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1e293b" strokeWidth="1" />
            <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="9" fontFamily="var(--mono)" fill="#2d3548">{val}</text>
          </g>
        );
      })}
      {/* X labels */}
      {points.filter((_, i) => i % 2 === 0).map((p, i) => (
        <text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize="8" fontFamily="var(--mono)" fill="#2d3548">{p.date}</text>
      ))}
      {/* Area + Line */}
      <polygon points={area} fill="url(#trendGrad)" />
      <polyline points={line} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 6px #3b82f640)" }} />
      {/* End dot */}
      {points.length > 0 && (
        <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="4" fill="#3b82f6" stroke="#0c1220" strokeWidth="2">
          <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Severity Donut (small)
   ═══════════════════════════════════════════════════════════ */
function SeverityDonut({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 50, stroke = 12, size = 130;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#111827" strokeWidth={stroke} />
          {data.filter(d => d.value > 0).map((d, i) => {
            const pct = d.value / total;
            const dash = pct * circ;
            const gap = circ - dash;
            const off = -acc * circ;
            acc += pct;
            return (
              <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
                stroke={d.color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`} strokeDashoffset={off}
                style={{ filter: `drop-shadow(0 0 3px ${d.color}30)` }}
              />
            );
          })}
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: "#e2e8f0" }}>{total}</span>
          <span style={{ fontSize: 7, fontWeight: 700, color: "#334155", letterSpacing: "0.1em" }}>НАХОДОК</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#64748b", minWidth: 75 }}>{d.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)", color: d.color }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Stat Card (top row)
   ═══════════════════════════════════════════════════════════ */
function StatCard({ label, value, icon, color, trend, sparkData, alert }) {
  return (
    <div style={{
      flex: 1, padding: "16px 18px",
      background: alert ? `linear-gradient(135deg, ${color}06 0%, #0c1220 100%)` : "#0c1220",
      border: `1px solid ${alert ? color + "25" : "#1e293b"}`,
      borderRadius: 10,
      display: "flex", flexDirection: "column", gap: 10,
      position: "relative", overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: color + "18", fontSize: 15,
        }}>{icon}</div>
        {trend !== undefined && (
          <div style={{
            display: "flex", alignItems: "center", gap: 3,
            fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)",
            color: trend > 0 ? "#ef4444" : trend < 0 ? "#22c55e" : "#334155",
          }}>
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}{Math.abs(trend)}
            <span style={{ fontSize: 9, fontWeight: 500, color: "#334155", marginLeft: 2 }}>за нед.</span>
          </div>
        )}
      </div>
      {/* Value */}
      <div>
        <div style={{
          fontSize: 28, fontWeight: 700, fontFamily: "var(--mono)",
          color: value > 0 && alert ? color : value > 0 ? "#e2e8f0" : "#1e293b",
          lineHeight: 1,
        }}>{value}</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#4b5563", letterSpacing: "0.04em", marginTop: 4 }}>{label}</div>
      </div>
      {/* Sparkline */}
      {sparkData && (
        <div style={{ marginTop: "auto", marginLeft: -4, marginRight: -4, opacity: 0.7 }}>
          <Sparkline data={sparkData} width={200} height={32} color={color} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Product Risk Row
   ═══════════════════════════════════════════════════════════ */
function ProductRiskRow({ product, maxFindings }) {
  const healthCol = product.score >= 80 ? "#22c55e" : product.score >= 60 ? "#f59e0b" : product.score >= 40 ? "#f97316" : "#ef4444";
  const pct = maxFindings > 0 ? (product.findings / maxFindings) * 100 : 0;
  const [hovered, setHovered] = useState(false);

  const segments = [
    { value: product.critical, color: "#a855f7" },
    { value: product.high, color: "#ef4444" },
    { value: product.medium, color: "#f97316" },
    { value: product.low, color: "#22c55e" },
    { value: product.info, color: "#64748b" },
  ];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid", gridTemplateColumns: "1fr 60px auto 50px",
        alignItems: "center", gap: 12,
        padding: "12px 16px",
        background: hovered ? "#0f172a" : "transparent",
        borderBottom: "1px solid #1e293b18",
        transition: "background 0.15s",
        cursor: "pointer",
      }}
    >
      {/* Name + version */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: "linear-gradient(135deg, #dc2662 0%, #9333ea 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color: "white", fontFamily: "var(--mono)",
          flexShrink: 0,
        }}>{product.name.charAt(0).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 12.5, fontWeight: 600, color: "#e2e8f0",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{product.name}</div>
          <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "#334155" }}>{product.version}</span>
        </div>
      </div>

      {/* Health score */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%", background: healthCol,
          boxShadow: `0 0 6px ${healthCol}60`,
        }} />
        <span style={{
          fontSize: 13, fontWeight: 700, fontFamily: "var(--mono)", color: healthCol,
        }}>{product.score}</span>
      </div>

      {/* Stacked severity bar */}
      <div style={{
        height: 16, borderRadius: 3, overflow: "hidden",
        display: "flex", background: "#111827", minWidth: 180,
      }}>
        {segments.filter(s => s.value > 0).map((s, i) => (
          <div key={i} style={{
            height: "100%",
            width: `${(s.value / product.findings) * pct}%`,
            background: s.color,
            transition: "width 0.4s ease",
          }} />
        ))}
      </div>

      {/* Total */}
      <span style={{
        fontSize: 13, fontWeight: 700, fontFamily: "var(--mono)",
        color: product.findings > 10 ? "#fca5a5" : "#64748b",
        textAlign: "right",
      }}>{product.findings}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Activity Feed Item
   ═══════════════════════════════════════════════════════════ */
function ActivityItem({ item }) {
  const col = SEV_COLOR[item.severity] || "#64748b";
  const tool = TOOL_CFG[item.tool];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "10px 14px",
        background: hovered ? "#0f172a" : "transparent",
        borderBottom: "1px solid #1e293b18",
        transition: "background 0.15s",
        cursor: "pointer",
      }}
    >
      {/* Severity dot */}
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: col, marginTop: 5, flexShrink: 0,
        boxShadow: `0 0 6px ${col}50`,
      }} />
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: "#e2e8f0",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.3,
        }}>{item.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 10, color: "#334155" }}>{item.product}</span>
          {tool && (
            <>
              <span style={{ color: "#1e293b", fontSize: 8 }}>•</span>
              <span style={{
                fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                background: tool.color + "14", color: tool.color,
              }}>{tool.label}</span>
            </>
          )}
        </div>
      </div>
      {/* Time */}
      <span style={{ fontSize: 10, color: "#2d3548", flexShrink: 0, marginTop: 3 }}>{item.time}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Section wrapper
   ═══════════════════════════════════════════════════════════ */
function Section({ children, style: s }) {
  return (
    <div style={{
      background: "#0c1220", border: "1px solid #1e293b",
      borderRadius: 10, overflow: "hidden", ...s,
    }}>{children}</div>
  );
}

function SectionHeader({ title, subtitle, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "13px 16px",
      borderBottom: "1px solid #1e293b50",
      background: "#0a0f1a",
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: "#2d3548", marginTop: 1 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const maxFindings = Math.max(...PRODUCTS.map(p => p.findings), 1);

  const trendSpark = TREND_DATA;
  const critSpark = TREND_DATA.map(d => ({ ...d, value: Math.round(d.value * 0.55) }));
  const fixedSpark = TREND_DATA.map(d => ({ ...d, value: 0 }));

  return (
    <div style={{
      fontFamily: "var(--body)", background: "#080d19",
      color: "#e2e8f0", minHeight: "100vh", padding: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        :root { --body: 'IBM Plex Sans', -apple-system, sans-serif; --mono: 'JetBrains Mono', 'Fira Code', monospace; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .anim { animation: fadeIn 0.4s ease both; }
      `}</style>

      {/* ───── Page Title ───── */}
      <div className="anim" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 18,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.01em" }}>Дашборд</h1>
          <p style={{ fontSize: 11, color: "#2d3548", marginTop: 2 }}>Обзор состояния безопасности • обновлено 28 мар 2026</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 14px", borderRadius: 7,
            background: "linear-gradient(135deg, #dc2662 0%, #be185d 100%)",
            border: "none", cursor: "pointer",
            color: "white", fontSize: 11, fontWeight: 600,
            fontFamily: "var(--body)",
            boxShadow: "0 2px 12px #dc266230",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Загрузить скан
          </button>
        </div>
      </div>

      {/* ───── Stat Cards ───── */}
      <div className="anim" style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10, marginBottom: 16, animationDelay: "0.05s",
      }}>
        <StatCard
          icon="⚑" label="Открытые находки" value={STATS.openFindings}
          color="#f59e0b" alert trend={38} sparkData={trendSpark}
        />
        <StatCard
          icon="▲" label="Критич. / Высокий" value={STATS.criticalHigh}
          color="#ef4444" alert={STATS.criticalHigh > 0} trend={21} sparkData={critSpark}
        />
        <StatCard
          icon="✓" label="Исправлено за неделю" value={STATS.fixedThisWeek}
          color="#22c55e" alert={false} trend={0}
        />
        <StatCard
          icon="🛡" label="Продуктов под угрозой" value={STATS.productsAtRisk}
          color="#dc2662" alert={STATS.productsAtRisk > 0}
        />
      </div>

      {/* ───── Charts Row ───── */}
      <div className="anim" style={{
        display: "grid", gridTemplateColumns: "1.4fr 1fr",
        gap: 12, marginBottom: 16, animationDelay: "0.1s",
      }}>
        {/* Trend */}
        <Section>
          <SectionHeader title="Тренд находок (30 дней)" subtitle="Динамика появления новых находок" />
          <div style={{ padding: "16px 16px 8px 4px" }}>
            <TrendChart data={TREND_DATA} />
          </div>
        </Section>

        {/* Severity */}
        <Section>
          <SectionHeader title="Распределение по критичности" subtitle="Открытые находки" />
          <div style={{ padding: "20px 18px" }}>
            <SeverityDonut data={SEVERITY_DATA} />
            {/* Severity bars below */}
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {SEVERITY_DATA.map((d, i) => {
                const maxVal = Math.max(...SEVERITY_DATA.map(s => s.value), 1);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#334155", minWidth: 30, textAlign: "right", letterSpacing: "0.04em" }}>{d.short}</span>
                    <div style={{ flex: 1, height: 10, background: "#111827", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${(d.value / maxVal) * 100}%`,
                        background: `linear-gradient(90deg, ${d.color}, ${d.color}b0)`,
                        borderRadius: 2,
                        boxShadow: `0 0 6px ${d.color}20`,
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)", color: d.color, minWidth: 20, textAlign: "right" }}>{d.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      </div>

      {/* ───── Bottom Row ───── */}
      <div className="anim" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 12, animationDelay: "0.15s",
      }}>
        {/* Top Products by Risk */}
        <Section>
          <SectionHeader
            title="Продукты по риску"
            subtitle="Ранжирование по количеству находок"
            right={
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {SEVERITY_DATA.slice(0, 4).map((d, i) => (
                  <span key={i} style={{
                    width: 8, height: 8, borderRadius: 2, background: d.color,
                  }} title={d.label} />
                ))}
              </div>
            }
          />
          {/* Column labels */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 60px auto 50px",
            gap: 12, padding: "6px 16px",
            borderBottom: "1px solid #1e293b30",
          }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: "#1e293b", letterSpacing: "0.08em" }}>ПРОДУКТ</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: "#1e293b", letterSpacing: "0.08em", textAlign: "center" }}>ОЦЕНКА</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: "#1e293b", letterSpacing: "0.08em", minWidth: 180 }}>РАСПРЕДЕЛЕНИЕ</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: "#1e293b", letterSpacing: "0.08em", textAlign: "right" }}>ВСЕГО</span>
          </div>
          <div>
            {PRODUCTS.sort((a, b) => b.findings - a.findings).map((p, i) => (
              <ProductRiskRow key={i} product={p} maxFindings={maxFindings} />
            ))}
          </div>
          <div style={{ padding: "10px 16px", borderTop: "1px solid #1e293b20" }}>
            <button style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#dc2662", fontSize: 11, fontWeight: 600, fontFamily: "var(--body)",
            }}>Все продукты ({STATS.totalProducts}) →</button>
          </div>
        </Section>

        {/* Recent Activity */}
        <Section>
          <SectionHeader
            title="Последняя активность"
            subtitle="Недавно обнаруженные находки"
            right={
              <span style={{
                fontSize: 10, fontWeight: 600, fontFamily: "var(--mono)",
                padding: "3px 8px", borderRadius: 5,
                background: "#172554", color: "#60a5fa", border: "1px solid #1e3a5f30",
              }}>{ACTIVITY.length} записей</span>
            }
          />
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {ACTIVITY.map((item, i) => (
              <ActivityItem key={i} item={item} />
            ))}
          </div>
          <div style={{ padding: "10px 16px", borderTop: "1px solid #1e293b20" }}>
            <button style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#dc2662", fontSize: 11, fontWeight: 600, fontFamily: "var(--body)",
            }}>Все находки →</button>
          </div>
        </Section>
      </div>
    </div>
  );
}
