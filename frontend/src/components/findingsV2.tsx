import { ReactNode, useMemo, useState } from "react";
import styles from "./findingsV2.module.css";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type FindingType = "SAST" | "DAST" | "SCA" | "SECRETS" | "IAC";

export const severityMeta: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: "КРИТ", color: "#a855f7", bg: "rgba(168,85,247,0.14)" },
  high: { label: "ВЫС", color: "#ef4444", bg: "rgba(239,68,68,0.14)" },
  medium: { label: "СР", color: "#f97316", bg: "rgba(249,115,22,0.14)" },
  low: { label: "НИЗ", color: "#22c55e", bg: "rgba(34,197,94,0.14)" },
  info: { label: "ИНФ", color: "#64748b", bg: "rgba(100,116,139,0.2)" },
};

export const typeMeta: Record<FindingType, { icon: string; color: string }> = {
  SAST: { icon: "◈", color: "#a855f7" },
  DAST: { icon: "⚡", color: "#3b82f6" },
  SCA: { icon: "🔍", color: "#06b6d4" },
  SECRETS: { icon: "🔑", color: "#f59e0b" },
  IAC: { icon: "⊞", color: "#f472b6" },
};

export const statusMeta: Record<string, { label: string; color: string }> = {
  new: { label: "Новая", color: "#3b82f6" },
  open: { label: "Открыта", color: "#f59e0b" },
  in_progress: { label: "В работе", color: "#06b6d4" },
  fixed: { label: "Исправлена", color: "#22c55e" },
  false_positive: { label: "Лож. сраб.", color: "#64748b" },
  accepted_risk: { label: "Принятый риск", color: "#a855f7" },
};

export function SevBadge({ severity }: { severity: Severity }) {
  const meta = severityMeta[severity];
  return (
    <span className={styles.sevBadge} style={{ color: meta.color, background: meta.bg, borderColor: `${meta.color}55` }}>
      {meta.label}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, color: "#94a3b8" };
  return (
    <span className={styles.statusPill} style={{ color: meta.color }}>
      <span className={styles.statusDot} style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}66` }} />
      {meta.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: FindingType }) {
  const meta = typeMeta[type] ?? { icon: "?", color: "#94a3b8" };
  return (
    <span className={styles.typeBadge} style={{ color: meta.color, background: `${meta.color}1c`, borderColor: `${meta.color}44` }}>
      <span>{meta.icon}</span>
      {type}
    </span>
  );
}

export function Tag({ children, color = "#60a5fa" }: { children: ReactNode; color?: string }) {
  return (
    <span className={styles.tag} style={{ color, background: `${color}18`, borderColor: `${color}44` }}>
      {children}
    </span>
  );
}

export function Pill({
  children,
  active,
  count,
  color = "#64748b",
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  count?: number;
  color?: string;
  onClick: () => void;
}) {
  const style = active
    ? { color: color === "#64748b" ? "#e2e8f0" : color, background: `${color}22`, borderColor: `${color}66` }
    : undefined;
  return (
    <button className={styles.pill} style={style} onClick={onClick}>
      {children}
      {typeof count === "number" ? <span className={styles.pillCount}>{count}</span> : null}
    </button>
  );
}

export function CodeBlock({ file, lineNum, code, accent = "#a855f7" }: { file: string; lineNum: number; code: string; accent?: string }) {
  return (
    <div className={styles.codeWrap} style={{ borderColor: `${accent}55` }}>
      <div className={styles.codeHead}>
        <span className={styles.monoMuted}>{file}</span>
        <button className={styles.iconBtn} onClick={() => navigator.clipboard.writeText(code)}>
          📋
        </button>
      </div>
      <div className={styles.codeBody}>
        <div className={styles.codeLine} style={{ background: `${accent}22`, color: accent }}>{lineNum}</div>
        <pre className={styles.codeText}>{highlightCode(code)}</pre>
      </div>
    </div>
  );
}

function highlightCode(code: string) {
  const parts = code.split(/(\b(?:const|let|var|true|false|return|function|new)\b|"[^"]*"|'[^']*')/g);
  return parts.map((p, i) => {
    if (/^(const|let|var|true|false|return|function|new)$/.test(p)) return <span key={i} style={{ color: "#c084fc" }}>{p}</span>;
    if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) return <span key={i} style={{ color: "#34d399" }}>{p}</span>;
    return <span key={i}>{p}</span>;
  });
}

export function Collapse({ title, accent, defaultOpen = false, children }: { title: string; accent: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.collapseItem}>
      <button className={styles.collapseBtn} style={open ? { background: `${accent}1a` } : undefined} onClick={() => setOpen((p) => !p)}>
        <span>{title}</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open ? <div className={styles.collapseBody}>{children}</div> : null}
    </div>
  );
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <h3>{title}</h3>
        {right}
      </header>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function StackedSeverityBar({ counts }: { counts: Record<Severity, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const ordered: Severity[] = ["critical", "high", "medium", "low", "info"];
  const segments = useMemo(() => ordered.filter((k) => counts[k] > 0), [counts]);
  return (
    <div className={styles.stackedWrap}>
      {segments.map((s) => {
        const pct = total ? (counts[s] / total) * 100 : 0;
        return <div key={s} className={styles.segment} style={{ width: `${pct}%`, background: `linear-gradient(180deg, ${severityMeta[s].color}44, ${severityMeta[s].color}22)` }} />;
      })}
    </div>
  );
}
