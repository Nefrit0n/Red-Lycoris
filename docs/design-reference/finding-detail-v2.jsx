import { useState } from "react";

/* ═══════════════════════════════════════════════════════════
   FINDING DETAIL PAGE v2 — Red Lycoris
   - Source merged into SAST tab
   - Full BDU FSTEC detail cards
   ═══════════════════════════════════════════════════════════ */

const SEV = {
  critical: { color: "#a855f7", bg: "#3b0764", label: "CRITICAL", border: "#7c3aed" },
  high:     { color: "#ef4444", bg: "#450a0a", label: "HIGH", border: "#dc2626" },
  medium:   { color: "#f97316", bg: "#431407", label: "MEDIUM", border: "#ea580c" },
  low:      { color: "#22c55e", bg: "#052e16", label: "LOW", border: "#16a34a" },
  info:     { color: "#64748b", bg: "#1e293b", label: "INFO", border: "#475569" },
};

const STATUS_CFG = {
  new:            { color: "#3b82f6", label: "Новая", icon: "◉" },
  open:           { color: "#f59e0b", label: "Открыта", icon: "◔" },
  in_progress:    { color: "#06b6d4", label: "В работе", icon: "↻" },
  fixed:          { color: "#22c55e", label: "Исправлена", icon: "✓" },
  false_positive: { color: "#64748b", label: "Лож. срабатывание", icon: "✕" },
  accepted_risk:  { color: "#a855f7", label: "Принятый риск", icon: "⊘" },
};

/* ── Mock Finding ── */
const FINDING = {
  id: "fff4ef39-732f-413f-9241-ca85b68dc564",
  title: "audit: express-libxml-vm-noent",
  severity: "medium",
  status: "new",
  category: "SAST",
  tool: "semgrep",
  product: "cassandra-backend",
  productId: 123,
  productVersion: "v2.4.1",
  riskScore: 42,
  slaLeft: 30,
  firstSeen: "01.04.2026, 18:05:58",
  lastSeen: "01.04.2026, 18:05:58",
  occurrences: 1,
  comments: 0,
  duplicates: 0,
  historyCount: 1,
  tags: ["xml", "xxe", "sast"],
  description: "Detected use of parseXml() function with the `noent` field set to `true`. This can lead to an XML External Entities (XXE) attack if untrusted data is passed into it.",

  sast: {
    rule: "javascript.express.security.audit.express-libxml-vm-noent.express-libxml-vm-noent",
    file: "/tmp/red-lycoris-analysis/74637452-aaa1-4b10-a6c1-0d44b6edd498/src/juice-shop-master/routes/fileUpload.ts",
    range: "83:24 → 83:140",
    lineNum: 83,
    snippet: `const xmlDoc = vm.runInContext('libxml.parseXml(data, { noblanks: true, noent: true, nocdata: true })', sandbox, { timeout: 2000 })`,
    severityRaw: "WARNING",
    message: "Detected use of parseXml() function with the `noent` field set to `true`. This can lead to an XML External Entities (XXE) attack if untrusted data is passed into it.",
    metadata: {
      "owasp": "A04:2021 – Insecure Design",
      "cwe": "CWE-611",
      "confidence": "HIGH",
      "impact": "MEDIUM",
      "technology": "express",
      "category": "security",
    },
  },

  remediation: {
    cwe: "CWE-611",
    cweName: "Improper Restriction of XML External Entity Reference",
    howToFix: [
      "Проверьте уязвимый код и примените лучшие практики безопасности",
      "Ознакомьтесь с рекомендациями OWASP по данному типу уязвимости",
      "Отключите обработку внешних сущностей (noent: false) в XML-парсере",
    ],
    references: [
      "https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html",
    ],
  },

  bduMatches: [
    {
      id: "BDU:2015-11393", severity: "medium",
      cvss2: { vector: "AV:N/AC:M/Au:N/C:P/I:P/A:P", score: 6.8 },
      cvss3: null, cvss4: null,
      status: "Подтверждена производителем",
      vulnState: "Опубликована",
      exploit: true,
      vulnClass: "Уязвимость кода",
      cweId: "CWE-611",
      cweDesc: "Неверное ограничение XML-ссылок на внешние объекты (CWE-611)",
      exploitMethod: "Данные уточняются",
      name: "Уязвимость программной интеграционной платформы SAP NetWeaver, позволяющая нарушителю вызвать отказ в обслуживании или спровоцировать обращение к внешнему ресурсу",
      description: "Уязвимость программной интеграционной платформы SAP NetWeaver существует из-за отсутствия ограничений доступа к внешним объектам, содержащимся в ссылках внутри обрабатываемого XML-файла. Эксплуатация уязвимости может позволить нарушителю, действующему удалённо, вызвать отказ в обслуживании или спровоцировать обращение к внешнему ресурсу при помощи специально сформированного XML-файла",
      software: {
        vendor: "SAP",
        name: "SAP NetWeaver Portal",
        version: "7.4 (SAP NetWeaver Portal)",
        type: "Сетевое программное средство",
        os: "Microsoft Corp Windows - 64-bit, Microsoft Corp Windows - 32-bit",
      },
      fix: {
        info: "Уязвимость устранена",
        method: "Данные уточняются",
        detail: "Использование рекомендаций разработчика, доступных зарегистрированным пользователям по адресу: https://service.sap.com/sap/support/notes/2168485",
      },
      otherIds: ["CVE-2015-6662", "SAP Note:2168485"],
      references: [
        "http://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2015-6662",
        "http://erpscan.com/advisories/erpscan-15-007-sap-management-console-readprofile-...",
        "https://service.sap.com/sap/support/notes/2168485",
      ],
      dateDiscovered: "13.05.2015",
      datePublished: "01.10.2015",
      dateUpdated: "23.03.2021",
    },
    {
      id: "BDU:2016-00342", severity: "medium",
      cvss2: { vector: "AV:N/AC:L/Au:N/C:P/I:N/A:N", score: 5.0 },
      cvss3: null, cvss4: null,
      status: "Подтверждена производителем",
      vulnState: "Опубликована",
      exploit: false,
      vulnClass: "Уязвимость кода",
      cweId: "CWE-611",
      cweDesc: "Неверное ограничение XML-ссылок на внешние объекты (CWE-611)",
      exploitMethod: "Данные уточняются",
      name: "Уязвимость операционных систем Mac OS X и iOS, позволяющая нарушителю читать произвольные файлы",
      description: "Уязвимость операционных систем Mac OS X и iOS связана с неверным ограничением XML-ссылок на внешние объекты. Эксплуатация уязвимости может позволить нарушителю, действующему удалённо, читать произвольные файлы с помощью специально сформированного файла iBook, содержащего ссылки на внешние XML-объекты",
      software: {
        vendor: "Apple Inc.",
        name: "iOS, MacOS",
        version: "до 9.2 (iOS), до 10.11.2 (MacOS)",
        type: "Операционная система",
        os: "",
      },
      fix: {
        info: "Уязвимость устранена",
        method: "Данные уточняются",
        detail: "Обновление программного обеспечения до версии 9.2",
      },
      otherIds: ["CVE-2015-7081", "APPLE-SA-2015-12-08-1", "APPLE-SA-2015-12-08-3"],
      references: [
        "https://support.apple.com/HT205637",
        "https://support.apple.com/HT205635",
        "http://lists.apple.com/archives/security-announce/2015/Dec/msg00005.html",
        "http://lists.apple.com/archives/security-announce/2015/Dec/msg00000.html",
      ],
      dateDiscovered: "11.12.2015",
      datePublished: "12.02.2016",
      dateUpdated: "23.03.2021",
    },
  ],

  history: [
    { date: "01.04.2026, 18:05:58", action: "Находка создана", user: "system", detail: "Импорт из Semgrep скана SCN-00193" },
  ],
};

/* ═══════════════════════════════════════════════════════════
   Tab Themes (no more "source" tab)
   ═══════════════════════════════════════════════════════════ */
const TAB_THEMES = {
  desc:    { accent: "#60a5fa", bg: "#0c1a2e", border: "#1e3a5f", label: "Описание" },
  sast:    { accent: "#a855f7", bg: "#150e2e", border: "#3b2070", label: FINDING.category },
  bdu:     { accent: "#f472b6", bg: "#1f0a1a", border: "#831843", label: `БДУ ФСТЭК (${FINDING.bduMatches.length})` },
  occur:   { accent: "#f59e0b", bg: "#1a1508", border: "#713f12", label: `Occurrences (${FINDING.occurrences})` },
  comments:{ accent: "#34d399", bg: "#0a1f17", border: "#065f46", label: `Комментарии (${FINDING.comments})` },
  history: { accent: "#fb923c", bg: "#1c1008", border: "#7c2d12", label: `История (${FINDING.historyCount})` },
  dupes:   { accent: "#64748b", bg: "#0f1219", border: "#334155", label: "Дубликаты" },
};

/* ═══════════════════════════════════════════════════════════
   Micro Components
   ═══════════════════════════════════════════════════════════ */
function SevBadge({ severity }) {
  const s = SEV[severity];
  return <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 4, color: s.color, background: s.bg, border: `1px solid ${s.border}40` }}>{s.label}</span>;
}

function Tag({ children, color = "#60a5fa" }) {
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, color, background: color + "14", border: `1px solid ${color}20` }}>{children}</span>;
}

function MetaField({ label, children, mono }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#2d3548", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 500, fontFamily: mono ? "var(--mono)" : "var(--body)", lineHeight: 1.4 }}>{children}</div>
    </div>
  );
}

function FC({ label, value, mono, accent = "#64748b", wide }) {
  return (
    <div style={{ ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: accent, opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
      <div style={{ padding: "6px 10px", borderRadius: 4, background: "#080d19", border: "1px solid #1e293b25", fontSize: 11, color: "#94a3b8", lineHeight: 1.5, fontFamily: mono ? "var(--mono)" : "var(--body)", wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}

function Section({ children, s }) {
  return <div style={{ background: "#0c1220", border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden", ...s }}>{children}</div>;
}

function STitle({ icon, title, accent, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#0a0f1a", borderBottom: "1px solid #1e293b50" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, background: accent + "18", fontSize: 12 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: "0.04em" }}>{title}</span>
      </div>
      {right}
    </div>
  );
}

function StatusSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const cur = STATUS_CFG[value];
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: "#111827", border: "1px solid #1e293b", color: cur.color, fontSize: 12, fontWeight: 600, fontFamily: "var(--body)", cursor: "pointer" }}>
        <span style={{ fontSize: 11 }}>{cur.icon}</span>{cur.label}
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 4, opacity: 0.4 }}><path d="M2 3.5l3 3 3-3" stroke="#94a3b8" strokeWidth="1.5" fill="none" /></svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#111827", border: "1px solid #1e293b", borderRadius: 8, overflow: "hidden", zIndex: 50, boxShadow: "0 8px 24px #00000060", minWidth: 180 }}>
          {Object.entries(STATUS_CFG).map(([k, cfg]) => (
            <button key={k} onClick={() => { onChange(k); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: value === k ? "#1e293b" : "transparent", border: "none", cursor: "pointer", color: cfg.color, fontSize: 12, fontWeight: 500, fontFamily: "var(--body)", textAlign: "left" }}>
              <span>{cfg.icon}</span>{cfg.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ file, lineNum, code, accent }) {
  return (
    <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${accent}25`, background: "#06080f" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "#0a0e18", borderBottom: "1px solid #1e293b30" }}>
        <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file}</span>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "#334155", fontSize: 11, padding: "2px 6px" }}>📋</button>
      </div>
      <div style={{ display: "flex", fontSize: 12, fontFamily: "var(--mono)", lineHeight: 1.7 }}>
        <div style={{ padding: "10px 12px", textAlign: "right", minWidth: 44, color: accent, fontWeight: 600, background: accent + "10", borderRight: `1px solid ${accent}20`, userSelect: "none" }}>{lineNum}</div>
        <div style={{ flex: 1, padding: "10px 14px", color: "#e2e8f0", overflowX: "auto", background: `linear-gradient(90deg, ${accent}06, transparent 30%)`, whiteSpace: "pre" }}>{hlCode(code)}</div>
      </div>
    </div>
  );
}

function hlCode(code) {
  const kw = ["const","true","false","return","function","let","var","new"];
  return code.split(/(\b(?:const|true|false|return|function|let|var|new)\b|'[^']*'|\{|\}|\(|\)|,)/g).map((p,i) => {
    if (kw.includes(p)) return <span key={i} style={{color:"#c084fc"}}>{p}</span>;
    if (p.startsWith("'")) return <span key={i} style={{color:"#34d399"}}>{p}</span>;
    if (["{","}","(",")",","].includes(p)) return <span key={i} style={{color:"#64748b"}}>{p}</span>;
    return <span key={i}>{p}</span>;
  });
}

/* ═══════════════════════════════════════════════════════════
   BDU Full Card — all fields
   ═══════════════════════════════════════════════════════════ */
function BDUFullCard({ bdu, theme }) {
  const sev = SEV[bdu.severity] || SEV.info;
  const [sections, setSections] = useState({ desc: false, cvss: false, soft: true, fix: false, ids: false, refs: false });
  const toggle = k => setSections(p => ({ ...p, [k]: !p[k] }));

  return (
    <div style={{ border: `1px solid ${theme.border}30`, borderLeft: `3px solid ${sev.color}`, borderRadius: 10, overflow: "hidden", background: "#0a0f1a", marginBottom: 12 }}>

      {/* Header row */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #1e293b30" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--mono)", color: theme.accent }}>{bdu.id}</span>
          <SevBadge severity={bdu.severity} />
          <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "#4b5563" }}>CVSS 2: {bdu.cvss2.vector}</span>
          {bdu.exploit && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "#7f1d1d50", color: "#fca5a5" }}>Существует</span>}
          <Tag color="#64748b">{bdu.vulnState}</Tag>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "#334155", fontFamily: "var(--mono)" }}>{bdu.datePublished}</span>
        </div>
        <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{bdu.name}</p>

        {/* Quick meta */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px 16px", marginTop: 12 }}>
          <div><span style={lbl}>Статус</span><span style={val}>{bdu.status}</span></div>
          <div><span style={lbl}>Класс</span><span style={val}>{bdu.vulnClass}</span></div>
          <div><span style={lbl}>CWE</span><span style={{ ...val, color: theme.accent, fontFamily: "var(--mono)" }}>{bdu.cweDesc}</span></div>
          <div><span style={lbl}>Способ эксплуатации</span><span style={val}>{bdu.exploitMethod}</span></div>
        </div>
      </div>

      {/* Collapsible sections */}
      <Collapse title="Описание" open={sections.desc} onToggle={() => toggle("desc")} accent={theme.accent}>
        <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>{bdu.description}</p>
      </Collapse>

      <Collapse title={`CVSS  v2: ${bdu.cvss2.vector}`} open={sections.cvss} onToggle={() => toggle("cvss")} accent={theme.accent}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ padding: "10px 16px", borderRadius: 8, background: sev.bg, border: `1px solid ${sev.border}40`, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: sev.color }}>{bdu.cvss2.score.toFixed(1)}</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: sev.color, opacity: 0.7, letterSpacing: "0.1em" }}>CVSS 2.0</div>
          </div>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#64748b", wordBreak: "break-all" }}>{bdu.cvss2.vector}</div>
        </div>
      </Collapse>

      <Collapse title={`ПО и окружение  ${bdu.software.vendor} / ${bdu.software.name}`} open={sections.soft} onToggle={() => toggle("soft")} accent={theme.accent}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 0 }}>
          {[
            ["Вендор", bdu.software.vendor],
            ["ПО", bdu.software.name],
            ["Версия", bdu.software.version],
            ["Тип", bdu.software.type],
            ...(bdu.software.os ? [["ОС / Оборудование", bdu.software.os]] : []),
          ].map(([l, v], i) => (
            <div key={i} style={{ display: "contents" }}>
              <div style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600, color: "#4b5563", borderBottom: "1px solid #1e293b15" }}>{l}</div>
              <div style={{ padding: "8px 10px", fontSize: 12, color: "#cbd5e1", fontFamily: "var(--mono)", borderBottom: "1px solid #1e293b15", wordBreak: "break-all" }}>{v || "—"}</div>
            </div>
          ))}
        </div>
      </Collapse>

      <Collapse title="Устранение" open={sections.fix} onToggle={() => toggle("fix")} accent={theme.accent}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 0, marginBottom: 10 }}>
          <div style={tdLbl}>Информация</div><div style={tdVal}>{bdu.fix.info}</div>
          <div style={tdLbl}>Способ устранения</div><div style={tdVal}>{bdu.fix.method}</div>
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{bdu.fix.detail}</p>
      </Collapse>

      <Collapse title={`Идентификаторы  ${bdu.otherIds.length}`} open={sections.ids} onToggle={() => toggle("ids")} accent={theme.accent}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {bdu.otherIds.map((oid, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)", padding: "4px 10px", borderRadius: 5, background: theme.accent + "12", color: theme.accent, border: `1px solid ${theme.accent}20` }}>{oid}</span>
          ))}
        </div>
      </Collapse>

      <Collapse title={`Источники  ${bdu.references.length}`} open={sections.refs} onToggle={() => toggle("refs")} accent={theme.accent}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {bdu.references.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 4, background: "#080d19", border: "1px solid #1e293b20" }}>
              <span style={{ color: theme.accent, fontSize: 10, flexShrink: 0 }}>↗</span>
              <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: theme.accent, opacity: 0.8, wordBreak: "break-all" }}>{r}</span>
            </div>
          ))}
        </div>
      </Collapse>

      {/* Dates footer */}
      <div style={{ display: "flex", gap: 0, borderTop: "1px solid #1e293b20" }}>
        {[
          ["Выявлена", bdu.dateDiscovered],
          ["Опубликована", bdu.datePublished],
          ["Обновлена", bdu.dateUpdated],
        ].map(([l, v], i) => (
          <div key={i} style={{ flex: 1, padding: "8px 12px", borderRight: i < 2 ? "1px solid #1e293b15" : "none" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: theme.accent, opacity: 0.4, letterSpacing: "0.06em" }}>{l}</div>
            <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#94a3b8", marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Collapsible section inside BDU card */
function Collapse({ title, open, onToggle, accent, children }) {
  return (
    <div style={{ borderBottom: "1px solid #1e293b15" }}>
      <button onClick={onToggle} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "10px 16px",
        background: open ? accent + "06" : "transparent",
        border: "none", cursor: "pointer",
        textAlign: "left", transition: "background 0.15s",
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: open ? accent : "#4b5563" }}>{title}</span>
        <span style={{ fontSize: 12, color: "#334155", transition: "transform 0.2s", transform: open ? "rotate(0)" : "rotate(-90deg)" }}>−</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 14px 16px", animation: "fadeSlide 0.2s ease" }}>
          {children}
        </div>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: 9, fontWeight: 700, color: "#334155", letterSpacing: "0.06em", marginBottom: 2 };
const val = { display: "block", fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 };
const tdLbl = { padding: "8px 10px", fontSize: 11, fontWeight: 600, color: "#4b5563", borderBottom: "1px solid #1e293b15" };
const tdVal = { padding: "8px 10px", fontSize: 12, color: "#cbd5e1", borderBottom: "1px solid #1e293b15" };

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function FindingDetail() {
  const f = FINDING;
  const sev = SEV[f.severity];
  const [status, setStatus] = useState(f.status);
  const [tab, setTab] = useState("desc");
  const theme = TAB_THEMES[tab];

  return (
    <div style={{ fontFamily: "var(--body)", background: "#080d19", color: "#e2e8f0", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        :root { --body: 'IBM Plex Sans', -apple-system, sans-serif; --mono: 'JetBrains Mono', 'Fira Code', monospace; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        @keyframes fadeSlide { from { opacity:0; transform:translateY(-3px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderBottom: "1px solid #1e293b", background: "#0a0f1a" }}>
        <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#dc2662", fontSize: 12, fontWeight: 600, fontFamily: "var(--body)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          К результатам
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {["Предыдущая", "Следующая"].map(l => (
            <button key={l} style={{ padding: "5px 12px", borderRadius: 6, background: "transparent", border: "1px solid #1e293b", color: "#dc2662", fontSize: 11, fontWeight: 600, fontFamily: "var(--body)", cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 24px 40px 24px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Hero */}
        <div style={{ padding: "20px 0 16px 0", borderBottom: `2px solid ${sev.color}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <SevBadge severity={f.severity} />
            <Tag color="#64748b">{f.category}</Tag>
            {f.tags.map(t => <Tag key={t} color="#334155">{t}</Tag>)}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3, marginBottom: 6 }}>{f.title}</h1>
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "#2d3548", marginBottom: 14 }}>{f.id}</div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "12px 20px", flex: 1 }}>
              <MetaField label="ПРОДУКТ"><span style={{ fontWeight: 600 }}>{f.product}</span> <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "#334155" }}>{f.productVersion}</span></MetaField>
              <MetaField label="РИСК"><span style={{ color: sev.color, fontWeight: 700, fontFamily: "var(--mono)" }}>{SEV[f.severity].label} {f.riskScore}</span></MetaField>
              <MetaField label="SLA"><span style={{ fontWeight: 700, fontFamily: "var(--mono)", color: f.slaLeft <= 7 ? "#ef4444" : f.slaLeft <= 14 ? "#f59e0b" : "#22c55e" }}>{f.slaLeft}д осталось</span></MetaField>
              <MetaField label="ПЕРВОЕ ОБНАРУЖЕНИЕ" mono>{f.firstSeen}</MetaField>
              <MetaField label="ПОСЛЕДНЕЕ ОБНАРУЖЕНИЕ" mono>{f.lastSeen}</MetaField>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusSelect value={status} onChange={setStatus} />
              <button style={{ padding: "6px 14px", borderRadius: 6, background: "linear-gradient(135deg, #dc2662 0%, #be185d 100%)", border: "none", cursor: "pointer", color: "white", fontSize: 11, fontWeight: 600, fontFamily: "var(--body)" }}>Сохранить</button>
              <button style={{ padding: "6px 8px", borderRadius: 6, background: "#111827", border: "1px solid #1e293b", cursor: "pointer", color: "#4b5563", fontSize: 13 }} title="Скопировать ссылку">🔗</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${theme.accent}18`, background: "#0a0f1a", overflowX: "auto", position: "sticky", top: 0, zIndex: 10 }}>
          {Object.keys(TAB_THEMES).map(key => {
            const t = TAB_THEMES[key];
            const active = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: "11px 16px", fontSize: 12, fontWeight: 600, fontFamily: "var(--body)",
                color: active ? t.accent : "#2d3548",
                background: active ? t.accent + "0c" : "transparent",
                border: "none", borderBottom: active ? `2px solid ${t.accent}` : "2px solid transparent",
                borderRadius: active ? "6px 6px 0 0" : 0,
                cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
              }}>{t.label}</button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ background: `linear-gradient(180deg, ${theme.bg} 0%, #080d19 100%)`, borderLeft: `2px solid ${theme.accent}15`, padding: "20px 0", minHeight: 300, transition: "background 0.35s", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, ${theme.accent}50, transparent 60%)` }} />

          {/* ── Описание ── */}
          {tab === "desc" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.75, paddingLeft: 14, borderLeft: `2px solid ${theme.accent}30` }}>{f.description}</p>
              <Section>
                <STitle icon="💡" title="Рекомендации по устранению" accent={theme.accent} />
                <div style={{ padding: 16 }}>
                  <div style={{ marginBottom: 12 }}><Tag color="#ef4444">{f.remediation.cwe}: {f.remediation.cweName}</Tag></div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: "0.06em", marginBottom: 8 }}>КАК ИСПРАВИТЬ</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {f.remediation.howToFix.map((step, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: theme.accent + "15", color: theme.accent, fontSize: 9, fontWeight: 700, marginTop: 1 }}>{i + 1}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                  {f.remediation.references.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: "0.06em", marginBottom: 6 }}>ССЫЛКИ</div>
                      {f.remediation.references.map((ref, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 5, background: "#080d19", border: "1px solid #1e293b30" }}>
                          <span style={{ color: theme.accent, fontSize: 11, flexShrink: 0 }}>↗</span>
                          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: theme.accent, wordBreak: "break-all", opacity: 0.8 }}>{ref}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            </div>
          )}

          {/* ── SAST (merged with Source) ── */}
          {tab === "sast" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Tool info + raw fields */}
              <Section>
                <STitle icon="◈" title={`${f.category} (${f.tool === "semgrep" ? "Semgrep" : f.tool})`} accent={theme.accent} />
                <div style={{ padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 0, marginBottom: 16, borderRadius: 6, overflow: "hidden", border: "1px solid #1e293b25" }}>
                    {[
                      ["Rule ID", f.sast.rule],
                      ["Path", f.sast.file],
                      ["Range", f.sast.range],
                      ["Message", f.sast.message],
                      ["Severity (raw)", f.sast.severityRaw],
                    ].map(([l, v], i) => (
                      <div key={i} style={{ display: "contents" }}>
                        <div style={{ padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "#4b5563", borderBottom: "1px solid #1e293b15", background: "#080d1940" }}>{l}</div>
                        <div style={{ padding: "9px 12px", fontSize: 12, color: "#cbd5e1", fontFamily: "var(--mono)", lineHeight: 1.5, borderBottom: "1px solid #1e293b15", wordBreak: "break-all" }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Snippet */}
                  <CodeBlock file={f.sast.file} lineNum={f.sast.lineNum} code={f.sast.snippet} accent={theme.accent} />

                  {/* Metadata */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: theme.accent, opacity: 0.6, letterSpacing: "0.08em", marginBottom: 8 }}>METADATA</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
                      {Object.entries(f.sast.metadata).map(([k, v]) => (
                        <FC key={k} label={k} value={v} mono accent={theme.accent} />
                      ))}
                    </div>
                  </div>
                </div>
              </Section>
            </div>
          )}

          {/* ── БДУ ФСТЭК ── */}
          {tab === "bdu" && (
            <div>
              <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 14 }}>
                Найдено записей: <span style={{ color: "#e2e8f0", fontFamily: "var(--mono)", fontWeight: 600 }}>{f.bduMatches.length}</span>
              </div>
              {f.bduMatches.map((bdu, i) => (
                <BDUFullCard key={i} bdu={bdu} theme={theme} />
              ))}
            </div>
          )}

          {/* ── Occurrences ── */}
          {tab === "occur" && (
            <Section>
              <STitle icon="📍" title={`Occurrences (${f.occurrences})`} accent={theme.accent} />
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 6, background: "#080d19", border: "1px solid #1e293b30" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: theme.accent + "15", color: theme.accent }}>#1</span>
                  <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#94a3b8", wordBreak: "break-all" }}>{f.sast.file}:{f.sast.range}</span>
                </div>
              </div>
            </Section>
          )}

          {/* ── Комментарии ── */}
          {tab === "comments" && (
            <Section>
              <STitle icon="💬" title="Комментарии" accent={theme.accent} />
              <div style={{ padding: 24, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#2d3548", marginBottom: 12 }}>Комментариев пока нет</div>
                <div style={{ display: "flex", gap: 8, maxWidth: 400, margin: "0 auto" }}>
                  <input placeholder="Написать комментарий..." style={{ flex: 1, padding: "8px 12px", borderRadius: 6, background: "#111827", border: "1px solid #1e293b", color: "#e2e8f0", fontSize: 12, fontFamily: "var(--body)", outline: "none" }} />
                  <button style={{ padding: "8px 14px", borderRadius: 6, background: theme.accent + "20", border: `1px solid ${theme.accent}30`, color: theme.accent, fontSize: 11, fontWeight: 600, fontFamily: "var(--body)", cursor: "pointer" }}>Отправить</button>
                </div>
              </div>
            </Section>
          )}

          {/* ── История ── */}
          {tab === "history" && (
            <Section>
              <STitle icon="📜" title="История изменений" accent={theme.accent} />
              <div style={{ padding: "8px 0" }}>
                {f.history.map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderBottom: "1px solid #1e293b18" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.accent, marginTop: 5, boxShadow: `0 0 6px ${theme.accent}40`, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{h.action}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: "#111827", color: "#4b5563" }}>{h.user}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{h.detail}</div>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "#2d3548", flexShrink: 0 }}>{h.date}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── Дубликаты ── */}
          {tab === "dupes" && (
            <Section>
              <STitle icon="◫" title="Дубликаты" accent={theme.accent} />
              <div style={{ padding: 24, textAlign: "center", color: "#2d3548", fontSize: 13 }}>Дубликатов не обнаружено</div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
