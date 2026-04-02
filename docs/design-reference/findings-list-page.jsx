import { useState, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════
   FINDINGS LIST — Red Lycoris
   ═══════════════════════════════════════════════════════════ */

const SEV = {
  critical: { color: "#a855f7", bg: "#3b0764", label: "КРИТ", full: "Критический", order: 0 },
  high:     { color: "#ef4444", bg: "#450a0a", label: "ВЫС",  full: "Высокий", order: 1 },
  medium:   { color: "#f97316", bg: "#431407", label: "СР",   full: "Средний", order: 2 },
  low:      { color: "#22c55e", bg: "#052e16", label: "НИЗ",  full: "Низкий", order: 3 },
  info:     { color: "#64748b", bg: "#1e293b", label: "ИНФ",  full: "Информ.", order: 4 },
};

const STATUS = {
  new:            { color: "#3b82f6", label: "Новая" },
  open:           { color: "#f59e0b", label: "Открыта" },
  in_progress:    { color: "#06b6d4", label: "В работе" },
  fixed:          { color: "#22c55e", label: "Исправлена" },
  false_positive: { color: "#64748b", label: "Лож. сраб." },
};

const TYPES = {
  SAST:    { color: "#a855f7", icon: "◈" },
  DAST:    { color: "#3b82f6", icon: "⚡" },
  SCA:     { color: "#06b6d4", icon: "🔍" },
  SECRETS: { color: "#f59e0b", icon: "🔑" },
  IAC:     { color: "#f472b6", icon: "⊞" },
};

/* ── Mock Data ── */
const FINDINGS_RAW = [
  { id: "f001", title: "Ensure top-level permissions are not set to write-all", severity: "high", status: "new", type: "IAC", product: "cassandra-backend", tool: "checkov", firstSeen: "01.04.2026" },
  { id: "f002", title: "Base64 High Entropy String", severity: "high", status: "new", type: "SECRETS", product: "cassandra-backend", tool: "trufflehog", firstSeen: "01.04.2026" },
  { id: "f003", title: "Content Security Policy (CSP) Header Not Set", severity: "medium", status: "new", type: "DAST", product: "cassandra-backend", tool: "zap", firstSeen: "28.03.2026" },
  { id: "f004", title: "Missing anti-clickjacking header", severity: "high", status: "open", type: "DAST", product: "cassandra-backend", tool: "zap", firstSeen: "28.03.2026" },
  { id: "f005", title: "Slack Bot Token", severity: "critical", status: "new", type: "SECRETS", product: "cassandra-backend", tool: "trufflehog", firstSeen: "01.04.2026" },
  { id: "f006", title: "AWS API Key", severity: "critical", status: "new", type: "SECRETS", product: "cassandra-backend", tool: "trufflehog", firstSeen: "01.04.2026" },
  { id: "f007", title: "audit: express-libxml-vm-noent", severity: "medium", status: "new", type: "SAST", product: "cassandra-backend", tool: "semgrep", firstSeen: "01.04.2026" },
  { id: "f008", title: "Ensure that HEALTHCHECK instructions have been added", severity: "high", status: "new", type: "IAC", product: "cassandra-backend", tool: "checkov", firstSeen: "01.04.2026" },
  { id: "f009", title: "Timestamp Disclosure – Unix", severity: "low", status: "new", type: "DAST", product: "cassandra-backend", tool: "zap", firstSeen: "28.03.2026" },
  { id: "f010", title: "Password in URL", severity: "low", status: "new", type: "DAST", product: "cassandra-backend", tool: "zap", firstSeen: "28.03.2026" },
  { id: "f011", title: "S3 bucket is publicly readable", severity: "high", status: "new", type: "SCA", product: "cassandra-backend", tool: "trivy", firstSeen: "01.04.2026" },
  { id: "f012", title: "libssl3@3.3.2-r0 — CVE-2024-12797", severity: "low", status: "new", type: "SCA", product: "cassandra-backend", tool: "trivy", firstSeen: "01.04.2026" },
  { id: "f013", title: "libcrypto3@3.3.2-r0 — CVE-2024-13176", severity: "low", status: "new", type: "SCA", product: "cassandra-backend", tool: "trivy", firstSeen: "01.04.2026" },
  { id: "f014", title: "Ensure the base image uses a non latest version tag", severity: "high", status: "new", type: "IAC", product: "cassandra-backend", tool: "checkov", firstSeen: "01.04.2026" },
  { id: "f015", title: "Ensure a user for the container has been created", severity: "high", status: "new", type: "IAC", product: "cassandra-backend", tool: "checkov", firstSeen: "01.04.2026" },
  { id: "f016", title: "jackson-databind deserialization RCE", severity: "critical", status: "open", type: "SCA", product: "api-gateway", tool: "trivy", firstSeen: "15.03.2026" },
  { id: "f017", title: "Spring4Shell RCE", severity: "high", status: "in_progress", type: "SCA", product: "api-gateway", tool: "trivy", firstSeen: "10.03.2026" },
  { id: "f018", title: "Hardcoded JWT secret in config", severity: "medium", status: "fixed", type: "SECRETS", product: "auth-service", tool: "trufflehog", firstSeen: "05.03.2026" },
];

/* ═══════════════════════════════════════════════════════════
   Stats Mini Bar
   ═══════════════════════════════════════════════════════════ */
function StatsBar({ data }) {
  const total = data.length;
  const bySev = {};
  data.forEach(f => { bySev[f.severity] = (bySev[f.severity] || 0) + 1; });
  const sevOrder = ["critical","high","medium","low","info"];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, borderRadius: 6, overflow: "hidden", border: "1px solid #1e293b", height: 36, marginBottom: 12 }}>
      {/* Count */}
      <div style={{ padding: "0 16px", display: "flex", alignItems: "center", gap: 6, borderRight: "1px solid #1e293b30", height: "100%", background: "#0c1220" }}>
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--mono)", color: "#e2e8f0" }}>{total}</span>
        <span style={{ fontSize: 10, color: "#4b5563", fontWeight: 600 }}>находок</span>
      </div>
      {/* Severity breakdown as mini bar segments */}
      <div style={{ flex: 1, display: "flex", height: "100%", background: "#0c1220" }}>
        {sevOrder.filter(s => bySev[s]).map(s => {
          const sv = SEV[s];
          const pct = (bySev[s] / total) * 100;
          return (
            <div key={s} title={`${sv.full}: ${bySev[s]}`} style={{
              width: `${pct}%`, height: "100%",
              background: `linear-gradient(180deg, ${sv.color}30 0%, ${sv.color}10 100%)`,
              borderRight: "1px solid #080d1940",
              display: "flex", alignItems: "center", justifyContent: "center",
              minWidth: pct > 5 ? 0 : 0,
              position: "relative",
            }}>
              {pct > 8 && (
                <span style={{ fontSize: 9, fontWeight: 700, color: sv.color, fontFamily: "var(--mono)" }}>{bySev[s]}</span>
              )}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: sv.color }} />
            </div>
          );
        })}
      </div>
      {/* Severity legend pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "0 12px", height: "100%", background: "#0c1220", borderLeft: "1px solid #1e293b30" }}>
        {sevOrder.filter(s => bySev[s]).map(s => {
          const sv = SEV[s];
          return (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 3, background: sv.bg, fontSize: 9, fontWeight: 700, color: sv.color }}>
              {bySev[s]} {sv.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Filter Pill
   ═══════════════════════════════════════════════════════════ */
function Pill({ children, active, color = "#64748b", onClick, count }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "4px 9px", borderRadius: 5, fontSize: 10, fontWeight: 600,
      fontFamily: "var(--body)",
      color: active ? (color === "#64748b" ? "#e2e8f0" : color) : "#2d3548",
      background: active ? (color === "#64748b" ? "#1e293b" : color + "15") : "transparent",
      border: `1px solid ${active ? (color === "#64748b" ? "#334155" : color + "25") : "#1e293b30"}`,
      cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
    }}>
      {children}
      {count !== undefined && (
        <span style={{ fontSize: 9, fontFamily: "var(--mono)", opacity: 0.6 }}>{count}</span>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   Finding Row
   ═══════════════════════════════════════════════════════════ */
function FindingRow({ finding, selected, onSelect }) {
  const sev = SEV[finding.severity];
  const st = STATUS[finding.status];
  const tp = TYPES[finding.type] || { color: "#64748b", icon: "?" };
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "32px 3px 1fr 62px 80px 56px 100px 80px",
        alignItems: "center",
        minHeight: 44,
        background: selected ? "#111d2e" : hovered ? "#0f172a" : "#0c1220",
        borderBottom: "1px solid #1e293b15",
        borderLeft: selected ? `2px solid #3b82f6` : `2px solid transparent`,
        transition: "background 0.12s",
        cursor: "pointer",
      }}
    >
      {/* Checkbox */}
      <div style={{ display: "flex", justifyContent: "center" }} onClick={e => { e.stopPropagation(); onSelect(); }}>
        <div style={{
          width: 15, height: 15, borderRadius: 3,
          border: `1.5px solid ${selected ? "#3b82f6" : "#334155"}`,
          background: selected ? "#3b82f6" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}>
          {selected && <svg width="9" height="9" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
        </div>
      </div>

      {/* Severity bar */}
      <div style={{ width: 3, height: "60%", borderRadius: 2, background: sev.color, boxShadow: `0 0 4px ${sev.color}40` }} />

      {/* Title + tool */}
      <div style={{ padding: "8px 10px", overflow: "hidden" }}>
        <div style={{
          fontSize: 12.5, fontWeight: 500, color: "#e2e8f0",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.3,
        }}>{finding.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "#2d3548" }}>{finding.id}</span>
          <span style={{ fontSize: 9, color: "#334155" }}>•</span>
          <span style={{ fontSize: 9, color: "#334155" }}>{finding.tool}</span>
        </div>
      </div>

      {/* Severity */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
          padding: "3px 7px", borderRadius: 4,
          color: sev.color, background: sev.bg,
          border: `1px solid ${sev.color}30`,
        }}>{sev.label}</span>
      </div>

      {/* Status */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span style={{
          display: "flex", alignItems: "center", gap: 4,
          fontSize: 10, fontWeight: 600,
          color: st.color,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: st.color,
            boxShadow: `0 0 4px ${st.color}50`,
          }} />
          {st.label}
        </span>
      </div>

      {/* Type */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span style={{
          display: "flex", alignItems: "center", gap: 3,
          fontSize: 9, fontWeight: 700,
          padding: "2px 7px", borderRadius: 4,
          color: tp.color, background: tp.color + "14",
          border: `1px solid ${tp.color}20`,
          letterSpacing: "0.04em",
        }}>
          <span style={{ fontSize: 8 }}>{tp.icon}</span>
          {finding.type}
        </span>
      </div>

      {/* Product */}
      <div style={{
        fontSize: 11, color: "#4b5563", fontWeight: 500,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        padding: "0 8px",
      }}>{finding.product}</div>

      {/* Date */}
      <div style={{
        fontSize: 10, fontFamily: "var(--mono)", color: "#2d3548",
        padding: "0 10px",
      }}>{finding.firstSeen}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════ */
export default function FindingsList() {
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("severity");
  const [sortDir, setSortDir] = useState(1);
  const [selected, setSelected] = useState(new Set());

  const allTypes = useMemo(() => [...new Set(FINDINGS_RAW.map(f => f.type))], []);
  const allStatuses = useMemo(() => [...new Set(FINDINGS_RAW.map(f => f.status))], []);

  const filtered = useMemo(() => {
    let r = FINDINGS_RAW.filter(f => {
      if (search) {
        const q = search.toLowerCase();
        if (!f.title.toLowerCase().includes(q) && !f.tool.toLowerCase().includes(q) && !f.id.toLowerCase().includes(q)) return false;
      }
      if (sevFilter !== "all" && f.severity !== sevFilter) return false;
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (typeFilter !== "all" && f.type !== typeFilter) return false;
      return true;
    });
    r.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "severity") cmp = SEV[a.severity].order - SEV[b.severity].order;
      else if (sortBy === "title") cmp = a.title.localeCompare(b.title);
      else if (sortBy === "status") cmp = a.status.localeCompare(b.status);
      else if (sortBy === "type") cmp = a.type.localeCompare(b.type);
      else if (sortBy === "date") cmp = a.firstSeen.localeCompare(b.firstSeen);
      return cmp * sortDir;
    });
    return r;
  }, [search, sevFilter, statusFilter, typeFilter, sortBy, sortDir]);

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d * -1);
    else { setSortBy(col); setSortDir(1); }
  }

  const allSelected = filtered.length > 0 && filtered.every(f => selected.has(f.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map(f => f.id)));
  };
  const toggleOne = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  function SA({ col }) {
    const a = sortBy === col;
    return (
      <svg width="8" height="10" viewBox="0 0 8 10" style={{ marginLeft: 2, opacity: a ? 1 : 0.2, flexShrink: 0 }}>
        <path d="M4 0l3 4H1z" fill={a && sortDir === 1 ? "#60a5fa" : "#475569"} />
        <path d="M4 10l3-4H1z" fill={a && sortDir === -1 ? "#60a5fa" : "#475569"} />
      </svg>
    );
  }

  const CH = { padding: "0 8px", fontSize: 9, fontWeight: 700, color: "#1e293b", letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 2, userSelect: "none", height: 32 };

  return (
    <div style={{ fontFamily: "var(--body)", background: "#080d19", color: "#e2e8f0", minHeight: "100vh", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        :root { --body: 'IBM Plex Sans', -apple-system, sans-serif; --mono: 'JetBrains Mono', 'Fira Code', monospace; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Находки</h1>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--mono)", color: "#334155" }}>{filtered.length}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selected.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, background: "#172554", border: "1px solid #1e3a5f", fontSize: 11, fontWeight: 600, color: "#60a5fa" }}>
              Выбрано: {selected.size}
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#60a5fa", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>Изм. статус</button>
              <span style={{ color: "#1e3a5f" }}>|</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 10, fontWeight: 700 }}>Удалить</button>
            </div>
          )}
          <button style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 14px", borderRadius: 6,
            background: "transparent", border: "1px solid #dc266240",
            color: "#dc2662", fontSize: 11, fontWeight: 600,
            fontFamily: "var(--body)", cursor: "pointer",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Экспорт
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <StatsBar data={filtered} />

      {/* ── Filters ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "#0c1220", borderRadius: 6, border: "1px solid #1e293b",
          padding: "6px 12px", flex: "0 1 240px",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2d3548" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Название, ID, инструмент..."
            style={{ background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 12, fontFamily: "var(--body)", width: "100%" }}
          />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", fontSize: 14, padding: 0 }}>×</button>}
        </div>

        <div style={{ width: 1, height: 20, background: "#1e293b" }} />

        {/* Severity */}
        <div style={{ display: "flex", gap: 3 }}>
          <Pill active={sevFilter === "all"} onClick={() => setSevFilter("all")}>Все</Pill>
          {Object.entries(SEV).map(([k, v]) => {
            const c = FINDINGS_RAW.filter(f => f.severity === k).length;
            return c > 0 ? <Pill key={k} active={sevFilter === k} color={v.color} onClick={() => setSevFilter(sevFilter === k ? "all" : k)} count={c}>{v.label}</Pill> : null;
          })}
        </div>

        <div style={{ width: 1, height: 20, background: "#1e293b" }} />

        {/* Type */}
        <div style={{ display: "flex", gap: 3 }}>
          <Pill active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>Все</Pill>
          {allTypes.map(t => {
            const tc = TYPES[t] || { color: "#64748b" };
            const c = FINDINGS_RAW.filter(f => f.type === t).length;
            return <Pill key={t} active={typeFilter === t} color={tc.color} onClick={() => setTypeFilter(typeFilter === t ? "all" : t)} count={c}>{t}</Pill>;
          })}
        </div>

        <div style={{ width: 1, height: 20, background: "#1e293b" }} />

        {/* Status */}
        <div style={{ display: "flex", gap: 3 }}>
          <Pill active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Все</Pill>
          {allStatuses.map(s => {
            const sc = STATUS[s] || { color: "#64748b", label: s };
            const c = FINDINGS_RAW.filter(f => f.status === s).length;
            return <Pill key={s} active={statusFilter === s} color={sc.color} onClick={() => setStatusFilter(statusFilter === s ? "all" : s)} count={c}>{sc.label}</Pill>;
          })}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #1e293b" }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "32px 3px 1fr 62px 80px 56px 100px 80px",
          alignItems: "center",
          background: "#0a0e18",
          borderBottom: "1px solid #1e293b",
        }}>
          <div style={{ display: "flex", justifyContent: "center" }} onClick={toggleAll}>
            <div style={{
              width: 15, height: 15, borderRadius: 3,
              border: `1.5px solid ${allSelected ? "#3b82f6" : "#334155"}`,
              background: allSelected ? "#3b82f6" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}>
              {allSelected && <svg width="9" height="9" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
            </div>
          </div>
          <div />
          <div style={CH} onClick={() => toggleSort("title")}>Название <SA col="title" /></div>
          <div style={{ ...CH, justifyContent: "center" }} onClick={() => toggleSort("severity")}>Критич. <SA col="severity" /></div>
          <div style={{ ...CH, justifyContent: "center" }} onClick={() => toggleSort("status")}>Статус <SA col="status" /></div>
          <div style={{ ...CH, justifyContent: "center" }} onClick={() => toggleSort("type")}>Тип <SA col="type" /></div>
          <div style={CH}>Продукт</div>
          <div style={CH} onClick={() => toggleSort("date")}>Дата <SA col="date" /></div>
        </div>

        {/* Rows */}
        <div>
          {filtered.map(f => (
            <FindingRow
              key={f.id}
              finding={f}
              selected={selected.has(f.id)}
              onSelect={() => toggleOne(f.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#1e293b", fontSize: 13 }}>Находки не найдены</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#1e293b" }}>Показано {filtered.length} из {FINDINGS_RAW.length}</span>
        {selected.size > 0 && <span style={{ fontSize: 10, color: "#3b82f6" }}>Выбрано: {selected.size}</span>}
      </div>
    </div>
  );
}
