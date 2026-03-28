import { useState, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════
   PRODUCT DETAIL PAGE — Red Lycoris
   Full redesign with unified design language
   ═══════════════════════════════════════════════════════════ */

/* ── Mock Data ── */
const PRODUCT = {
  id: 123,
  name: "cassandra-backend",
  version: "v2.4.1",
  description: "Сервис Apache Cassandra — продуктивный кластер",
  lastScan: "28 мар 2026",
  totalScans: 33,
  openFindings: 38,
  criticalHigh: 21,
  medium: 11,
  low: 4,
  info: 2,
  fixed: 0,
  falsePositives: 0,
  healthScore: 63,
};

const SCANS = [
  { tool: "zap", date: "28 мар 2026, 16:12", newFindings: 1, type: "dast" },
  { tool: "zap", date: "28 мар 2026, 16:12", newFindings: 2, type: "dast" },
  { tool: "trufflehog", date: "28 мар 2026, 16:12", newFindings: 0, type: "secret" },
  { tool: "trufflehog", date: "28 мар 2026, 16:12", newFindings: 4, type: "secret" },
  { tool: "trivy", date: "28 мар 2026, 16:12", newFindings: 0, type: "sca" },
];

const TOOL_CFG = {
  zap: { color: "#3b82f6", icon: "⚡", label: "ZAP", category: "DAST" },
  trufflehog: { color: "#f59e0b", icon: "🐽", label: "TruffleHog", category: "Секреты" },
  trivy: { color: "#06b6d4", icon: "🔍", label: "Trivy", category: "SCA" },
  semgrep: { color: "#a855f7", icon: "◈", label: "Semgrep", category: "SAST" },
  syft: { color: "#f97316", icon: "📦", label: "Syft", category: "SBOM" },
};

/* ═══════════════════════════════════════════════════════════
   Health Score Ring
   ═══════════════════════════════════════════════════════════ */
function HealthRing({ score }) {
  const r = 52, stroke = 7;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const col = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div style={{ position: "relative", width: 130, height: 130 }}>
      <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
        <circle cx="65" cy="65" r={r} fill="none" stroke={col} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s ease", filter: `drop-shadow(0 0 8px ${col}40)` }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontSize: 32, fontWeight: 700, fontFamily: "var(--mono)",
          color: col, lineHeight: 1, letterSpacing: "-0.02em",
        }}>{score}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, color: "#4b5563",
          letterSpacing: "0.12em", marginTop: 2,
        }}>ЗДОРОВЬЕ</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Severity Donut
   ═══════════════════════════════════════════════════════════ */
function SeverityDonut({ critical, high, medium, low, info }) {
  const data = [
    { label: "Критич", value: critical, color: "#a855f7" },
    { label: "Высокий", value: high, color: "#ef4444" },
    { label: "Средний", value: medium, color: "#f59e0b" },
    { label: "Низкий", value: low, color: "#22c55e" },
    { label: "Информ.", value: info, color: "#64748b" },
  ].filter(d => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 56, stroke = 14;
  const circ = 2 * Math.PI * r;
  let accumulated = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#111827" strokeWidth={stroke} />
          {data.map((d, i) => {
            const pct = d.value / total;
            const dashLen = pct * circ;
            const gap = circ - dashLen;
            const off = -accumulated * circ;
            accumulated += pct;
            return (
              <circle key={i} cx="70" cy="70" r={r} fill="none"
                stroke={d.color} strokeWidth={stroke}
                strokeDasharray={`${dashLen} ${gap}`}
                strokeDashoffset={off}
                strokeLinecap="butt"
                style={{ filter: `drop-shadow(0 0 4px ${d.color}30)` }}
              />
            );
          })}
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--mono)", color: "#e2e8f0" }}>{total}</span>
          <span style={{ fontSize: 8, fontWeight: 700, color: "#334155", letterSpacing: "0.1em" }}>НАХОДОК</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 105 }}>{d.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)", color: d.color }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Status Bar Chart
   ═══════════════════════════════════════════════════════════ */
function StatusBars({ open, fixed, fp }) {
  const max = Math.max(open, fixed, fp, 1);
  const items = [
    { label: "Открытые", value: open, color: "#3b82f6" },
    { label: "Исправлено", value: fixed, color: "#22c55e" },
    { label: "Лож. срабат.", value: fp, color: "#64748b" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#64748b", minWidth: 90, textAlign: "right", fontWeight: 500 }}>{it.label}</span>
          <div style={{ flex: 1, height: 18, background: "#111827", borderRadius: 3, overflow: "hidden", position: "relative" }}>
            <div style={{
              height: "100%", width: `${max ? (it.value / max) * 100 : 0}%`,
              background: `linear-gradient(90deg, ${it.color}, ${it.color}b0)`,
              borderRadius: 3, minWidth: it.value > 0 ? 2 : 0,
              transition: "width 0.6s ease",
              boxShadow: it.value > 0 ? `0 0 10px ${it.color}30` : "none",
            }} />
          </div>
          <span style={{
            fontSize: 12, fontWeight: 700, fontFamily: "var(--mono)",
            color: it.value > 0 ? it.color : "#1e293b", minWidth: 24, textAlign: "right",
          }}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Recent Scans List
   ═══════════════════════════════════════════════════════════ */
function ScanRow({ scan }) {
  const cfg = TOOL_CFG[scan.tool] || { color: "#64748b", icon: "?", label: scan.tool, category: "Прочее" };
  const [hovered, setHovered] = useState(false);
  const hasNew = scan.newFindings > 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 14px",
        background: hovered ? "#0f172a" : "transparent",
        borderBottom: "1px solid #1e293b20",
        transition: "background 0.15s",
        cursor: "pointer",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: cfg.color + "14", border: `1px solid ${cfg.color}20`,
        fontSize: 15,
      }}>{cfg.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{cfg.label}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
            background: cfg.color + "14", color: cfg.color, letterSpacing: "0.06em",
          }}>{cfg.category}</span>
        </div>
        <span style={{ fontSize: 11, color: "#334155" }}>{scan.date}</span>
      </div>
      {hasNew ? (
        <span style={{
          fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)",
          padding: "3px 10px", borderRadius: 10,
          background: "#172554", color: "#60a5fa", border: "1px solid #1e3a5f",
        }}>{scan.newFindings} нов.</span>
      ) : (
        <span style={{
          fontSize: 10, fontWeight: 500, padding: "3px 10px", borderRadius: 10,
          background: "#111827", color: "#2d3548", border: "1px solid #1e293b40",
        }}>Нет новых находок</span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Posture Card
   ═══════════════════════════════════════════════════════════ */
function PostureCard({ icon, label, value, color, alert }) {
  return (
    <div style={{
      flex: 1, padding: "14px 18px",
      background: alert ? `linear-gradient(135deg, ${color}08 0%, #0c1220 100%)` : "#0c1220",
      border: `1px solid ${alert ? color + "20" : "#1e293b"}`,
      borderRadius: 8,
      display: "flex", alignItems: "center", gap: 12,
      transition: "border-color 0.2s",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: color + "18", fontSize: 16,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#4b5563", letterSpacing: "0.08em" }}>{label}</div>
        <div style={{
          fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)",
          color: value > 0 && alert ? color : value > 0 ? "#e2e8f0" : "#1e293b",
          lineHeight: 1.1,
        }}>{value}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Section wrapper
   ═══════════════════════════════════════════════════════════ */
function Section({ children, style: s }) {
  return (
    <div style={{
      background: "#0c1220",
      border: "1px solid #1e293b",
      borderRadius: 10,
      overflow: "hidden",
      ...s,
    }}>{children}</div>
  );
}

function SectionHeader({ title, subtitle, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 18px",
      borderBottom: "1px solid #1e293b60",
      background: "#0a0f1a",
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#334155", marginTop: 1 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SBOM Tabs Placeholder
   ═══════════════════════════════════════════════════════════ */
function SBOMSection() {
  const [tab, setTab] = useState("sbom");
  const tabs = [
    { id: "sbom", label: "SBOM", accent: "#60a5fa" },
    { id: "components", label: "Компоненты", accent: "#a78bfa" },
    { id: "bdu", label: "БДУ ФСТЭК", accent: "#f472b6" },
  ];
  const active = tabs.find(t => t.id === tab);

  return (
    <Section>
      <SectionHeader title="SBOM и компоненты" subtitle="Управление SBOM и индексированными компонентами" />
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0, padding: "0 18px",
        borderBottom: `1px solid ${active.accent}18`,
        background: "#0a0f1a",
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 18px", fontSize: 12, fontWeight: 600,
            fontFamily: "var(--body)",
            color: tab === t.id ? t.accent : "#2d3548",
            background: tab === t.id ? t.accent + "0c" : "transparent",
            border: "none",
            borderBottom: tab === t.id ? `2px solid ${t.accent}` : "2px solid transparent",
            borderRadius: tab === t.id ? "6px 6px 0 0" : 0,
            cursor: "pointer", transition: "all 0.2s",
            letterSpacing: "0.02em",
          }}>{t.label}</button>
        ))}
      </div>
      {/* Tab content placeholder */}
      <div style={{
        padding: 24,
        background: `linear-gradient(180deg, ${active.accent}06 0%, #0c1220 100%)`,
        minHeight: 120,
        transition: "background 0.35s",
      }}>
        {tab === "sbom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              padding: "12px 18px", borderRadius: 8,
              background: "#111827", border: "1px solid #1e293b",
              flex: 1,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", letterSpacing: "0.08em", marginBottom: 4 }}>ФОРМАТ</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>CycloneDX 1.6</div>
            </div>
            <div style={{
              padding: "12px 18px", borderRadius: 8,
              background: "#111827", border: "1px solid #1e293b",
              flex: 1,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", letterSpacing: "0.08em", marginBottom: 4 }}>ИНСТРУМЕНТ</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>Syft 1.14.0</div>
            </div>
            <div style={{
              padding: "12px 18px", borderRadius: 8,
              background: "#111827", border: "1px solid #1e293b",
              flex: 1,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", letterSpacing: "0.08em", marginBottom: 4 }}>КОМПОНЕНТЫ</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>251</div>
            </div>
            <div style={{
              padding: "12px 18px", borderRadius: 8,
              background: "#111827", border: "1px solid #1e293b",
              flex: 1,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#334155", letterSpacing: "0.08em", marginBottom: 4 }}>СГЕНЕРИРОВАН</div>
              <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>2024-10-09</div>
            </div>
          </div>
        )}
        {tab === "components" && (
          <div style={{ textAlign: "center", padding: 20, color: "#2d3548", fontSize: 12 }}>
            → Здесь подключается компонент <span style={{ fontFamily: "var(--mono)", color: "#60a5fa" }}>ComponentsList</span> из sbom-components-cyclonedx.jsx
          </div>
        )}
        {tab === "bdu" && (
          <div style={{ textAlign: "center", padding: 20, color: "#2d3548", fontSize: 12 }}>
            → Здесь подключается компонент <span style={{ fontFamily: "var(--mono)", color: "#f472b6" }}>BDUList</span> из bdu-fstec-themed-tabs.jsx
          </div>
        )}
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function ProductDetail() {
  const p = PRODUCT;
  const healthCol = p.healthScore >= 80 ? "#22c55e" : p.healthScore >= 60 ? "#f59e0b" : p.healthScore >= 40 ? "#f97316" : "#ef4444";

  return (
    <div style={{
      fontFamily: "var(--body)", background: "#080d19",
      color: "#e2e8f0", minHeight: "100vh", padding: "0 0 40px 0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        :root {
          --body: 'IBM Plex Sans', -apple-system, sans-serif;
          --mono: 'JetBrains Mono', 'Fira Code', monospace;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .anim-in { animation: fadeIn 0.4s ease both; }
      `}</style>

      {/* ───── Breadcrumb ───── */}
      <div style={{ padding: "16px 28px" }}>
        <button style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
          color: "#dc2662", fontSize: 12, fontWeight: 600,
          fontFamily: "var(--body)", letterSpacing: "0.02em",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Назад к продуктам
        </button>
      </div>

      <div style={{ padding: "0 28px", maxWidth: 1380, margin: "0 auto" }}>

        {/* ───── Hero Header ───── */}
        <div className="anim-in" style={{
          display: "grid", gridTemplateColumns: "1fr auto",
          gap: 24, padding: "24px 28px",
          background: "linear-gradient(135deg, #0f1729 0%, #0c1220 50%, #10131f 100%)",
          border: "1px solid #1e293b",
          borderRadius: 14,
          marginBottom: 16,
          position: "relative", overflow: "hidden",
        }}>
          {/* Decorative */}
          <div style={{
            position: "absolute", top: -60, right: -60, width: 200, height: 200,
            borderRadius: "50%", background: `radial-gradient(circle, ${healthCol}08, transparent 70%)`,
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "linear-gradient(135deg, #dc2662 0%, #9333ea 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 800, color: "white",
                fontFamily: "var(--mono)",
              }}>{p.name.charAt(0).toUpperCase()}</div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2, letterSpacing: "-0.01em" }}>{p.name}</h1>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <span style={{
                    fontSize: 11, fontFamily: "var(--mono)", color: "#4b5563",
                  }}>ID: {p.id}</span>
                  <span style={{ color: "#1e293b" }}>·</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
                    background: "#172554", color: "#60a5fa", fontFamily: "var(--mono)",
                    border: "1px solid #1e3a5f30",
                  }}>{p.version}</span>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.5, maxWidth: 500 }}>{p.description}</p>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 7,
                background: "linear-gradient(135deg, #dc2662 0%, #be185d 100%)",
                border: "none", cursor: "pointer",
                color: "white", fontSize: 12, fontWeight: 600,
                fontFamily: "var(--body)", letterSpacing: "0.02em",
                boxShadow: "0 2px 12px #dc266230",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                Просмотр находок ({p.openFindings})
              </button>
              <button style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 7,
                background: "transparent",
                border: "1px solid #dc266240",
                cursor: "pointer",
                color: "#dc2662", fontSize: 12, fontWeight: 600,
                fontFamily: "var(--body)", letterSpacing: "0.02em",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                Загрузить скан
              </button>
            </div>
          </div>

          {/* Health Ring */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 0,
          }}>
            <HealthRing score={p.healthScore} />
          </div>
        </div>

        {/* ───── Quick Stats Strip ───── */}
        <div className="anim-in" style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 0, borderRadius: 8, overflow: "hidden",
          border: "1px solid #1e293b",
          marginBottom: 16,
          animationDelay: "0.05s",
        }}>
          {[
            { icon: "📅", label: "ПОСЛЕДНИЙ СКАН", value: p.lastScan, color: "#e2e8f0" },
            { icon: "⊙", label: "ВСЕГО СКАНОВ", value: p.totalScans, color: "#e2e8f0" },
            { icon: "⚑", label: "ОТКРЫТЫХ НАХОДОК", value: p.openFindings, color: p.openFindings > 0 ? "#fca5a5" : "#334155" },
            { icon: "#", label: "ВЕРСИЯ", value: p.version, color: "#60a5fa" },
          ].map((s, i) => (
            <div key={i} style={{
              padding: "12px 18px", background: "#0c1220",
              borderRight: i < 3 ? "1px solid #1e293b30" : "none",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 15, opacity: 0.5 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#1e293b", letterSpacing: "0.08em" }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--mono)", color: s.color, lineHeight: 1.2 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ───── Security Posture ───── */}
        <div className="anim-in" style={{ marginBottom: 16, animationDelay: "0.1s" }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "#2d3548",
            letterSpacing: "0.12em", marginBottom: 8, paddingLeft: 2,
          }}>СОСТОЯНИЕ БЕЗОПАСНОСТИ</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <PostureCard icon="⚑" label="ОТКРЫТЫЕ НАХОДКИ" value={p.openFindings} color="#f59e0b" alert />
            <PostureCard icon="▲" label="КРИТИЧ. / ВЫСОКИЙ" value={p.criticalHigh} color="#ef4444" alert={p.criticalHigh > 0} />
            <PostureCard icon="✓" label="ИСПРАВЛЕНО" value={p.fixed} color="#22c55e" alert={false} />
            <PostureCard icon="◇" label="ЛОЖ. СРАБАТЫВАНИЯ" value={p.falsePositives} color="#64748b" alert={false} />
          </div>
        </div>

        {/* ───── Charts Row ───── */}
        <div className="anim-in" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
          marginBottom: 16, animationDelay: "0.15s",
        }}>
          {/* Severity Distribution */}
          <Section>
            <SectionHeader title="Распределение по критичности" subtitle="Разбивка открытых находок" />
            <div style={{ padding: "20px 24px" }}>
              <SeverityDonut
                critical={12} high={9}
                medium={p.medium} low={p.low} info={p.info}
              />
            </div>
          </Section>

          {/* Findings by Status */}
          <Section>
            <SectionHeader title="Находки по статусу" subtitle="Открытые / Исправленные / Ложные срабатывания" />
            <div style={{ padding: "24px 24px" }}>
              <StatusBars open={p.openFindings} fixed={p.fixed} fp={p.falsePositives} />
            </div>
          </Section>
        </div>

        {/* ───── Recent Scans ───── */}
        <div className="anim-in" style={{ marginBottom: 16, animationDelay: "0.2s" }}>
          <Section>
            <SectionHeader
              title="Последние сканирования"
              subtitle="Активность по импорту результатов"
              right={
                <button style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 6,
                  background: "transparent", border: "1px solid #dc266240",
                  color: "#dc2662", fontSize: 11, fontWeight: 600,
                  fontFamily: "var(--body)", cursor: "pointer",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  Загрузить скан
                </button>
              }
            />
            <div>
              {SCANS.map((s, i) => <ScanRow key={i} scan={s} />)}
            </div>
            <div style={{ padding: "12px 18px", borderTop: "1px solid #1e293b20" }}>
              <button style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#dc2662", fontSize: 12, fontWeight: 600,
                fontFamily: "var(--body)",
              }}>Показать все {p.totalScans} сканирования →</button>
            </div>
          </Section>
        </div>

        {/* ───── SBOM & Components ───── */}
        <div className="anim-in" style={{ animationDelay: "0.25s" }}>
          <SBOMSection />
        </div>

      </div>
    </div>
  );
}
