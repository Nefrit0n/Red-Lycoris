import { useState } from "react";

/* ── Mock Data ── */
const vulns = [
  {
    id: "BDU:2014-00001",
    name: "Уязвимость микропрограммного обеспечения ПЛК Schneider Electric Modicon Quantum, позволяющая получить авторизованный доступ к устройству",
    description: "Микропрограммное обеспечение модуля 140NOE77111 контроллера Schneider Electric Modicon Quantum содержит множество пар логин: пароль, предустановленных по умолчанию. Это позволяет любому пользователю, имеющему доступ к устройству по протоколу FTP, получить авторизованный доступ к устройству.",
    vendor: "Schneider Electric", softwareName: "Modicon Quantum", softwareVersion: "4.6",
    softwareType: "ПО программно-аппаратного средства АСУ ТП",
    osPlatform: "Schneider Electric Modicon Quantum 4.6 PowerPC",
    vulnClass: "Уязвимость архитектуры",
    dateDiscovered: "17.12.2011", datePublished: "07.07.2016", dateUpdated: "28.11.2016",
    cvss2: { vector: "AV:N/AC:L/Au:N/C:C/I:C/A:C", score: 10.0 }, cvss3: null, cvss4: null,
    remediation: "Ограничение доступа к устройству по протоколу FTP",
    status: "Подтверждена производителем", exploitExists: true,
    fixInfo: "Информация об устранении отсутствует",
    references: ["http://ics-cert.us-cert.gov/alerts/ICS-ALERT-12-020-03"],
    otherIds: ["CVE-2011-4859"],
    vulnState: "Опубликована",
    cweId: "CWE-259", cweDesc: "Жесткое кодирование паролей",
    exploitMethod: "Сетевой", fixMethod: "Данные уточняются",
    incidentRelation: "Данные уточняются", additionalInfo: "Язык разработки ПО – С",
    component: "lz4-java 1.8.0",
  },
  {
    id: "BDU:2025-15118",
    name: "Уязвимость функции LZ4_decompress_fast() библиотеки для сжатия данных lz4-java, позволяющая нарушить конфиденциальность и целостность данных",
    description: "Уязвимость функции LZ4_decompress_fast() библиотеки для сжатия данных lz4-java связана с записью за границами буфера. Эксплуатация уязвимости может позволить нарушителю, действующему удалённо, вызвать отказ в обслуживании или выполнить произвольный код.",
    vendor: "lz4", softwareName: "lz4-java", softwareVersion: "1.8.0",
    softwareType: "Библиотека",
    osPlatform: "Кроссплатформенное",
    vulnClass: "Уязвимость кода",
    dateDiscovered: "15.01.2025", datePublished: "20.01.2025", dateUpdated: "10.03.2025",
    cvss2: { vector: "AV:N/AC:L/Au:N/C:C/I:C/A:C", score: 9.4 },
    cvss3: { vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", score: 9.1 },
    cvss4: { vector: "AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N", score: 8.8 },
    remediation: "Обновление до версии 1.8.1 или выше",
    status: "Подтверждена производителем", exploitExists: false,
    fixInfo: "Обновление ПО",
    references: ["https://github.com/lz4/lz4-java/security/advisories"],
    otherIds: ["CVE-2025-12345"],
    vulnState: "Опубликована",
    cweId: "CWE-787", cweDesc: "Запись за границами буфера",
    exploitMethod: "Сетевой", fixMethod: "Обновление ПО",
    incidentRelation: "Данные уточняются", additionalInfo: "—",
    component: "lz4-java 1.8.0",
  },
  {
    id: "BDU:2024-08744",
    name: "Уязвимость компонента обработки JSON библиотеки Jackson Databind, позволяющая выполнить произвольный код",
    description: "Уязвимость связана с некорректной десериализацией данных в формате JSON. Атакующий может отправить специально сформированный JSON-запрос для выполнения произвольного кода на сервере.",
    vendor: "FasterXML", softwareName: "jackson-databind", softwareVersion: "2.13.4",
    softwareType: "Библиотека",
    osPlatform: "Кроссплатформенное",
    vulnClass: "Уязвимость кода",
    dateDiscovered: "05.03.2024", datePublished: "12.03.2024", dateUpdated: "01.06.2024",
    cvss2: null,
    cvss3: { vector: "AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H", score: 7.4 },
    cvss4: null,
    remediation: "Обновление до jackson-databind 2.15.0+",
    status: "Подтверждена производителем", exploitExists: true,
    fixInfo: "Патч доступен",
    references: ["https://nvd.nist.gov/vuln/detail/CVE-2024-29132"],
    otherIds: ["CVE-2024-29132"],
    vulnState: "Опубликована",
    cweId: "CWE-502", cweDesc: "Десериализация ненадёжных данных",
    exploitMethod: "Сетевой", fixMethod: "Обновление ПО",
    incidentRelation: "Нет данных", additionalInfo: "—",
    component: "jackson-databind 2.13.4",
  },
];

/* ── Tab Theme Config ── */
const TAB_THEMES = {
  desc: {
    accent: "#60a5fa",
    accentMuted: "#60a5fa18",
    gradient: "linear-gradient(180deg, #0c1a2e 0%, #0a0f1a 100%)",
    borderAccent: "#1e3a5f",
    iconBg: "#172554",
    label: "Описание",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  tech: {
    accent: "#a78bfa",
    accentMuted: "#a78bfa18",
    gradient: "linear-gradient(180deg, #150e2e 0%, #0a0f1a 100%)",
    borderAccent: "#3b2070",
    iconBg: "#2e1065",
    label: "ПО и платформа",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  scores: {
    accent: "#f59e0b",
    accentMuted: "#f59e0b18",
    gradient: "linear-gradient(180deg, #1a1508 0%, #0a0f1a 100%)",
    borderAccent: "#713f12",
    iconBg: "#451a03",
    label: "CVSS",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  fix: {
    accent: "#34d399",
    accentMuted: "#34d39918",
    gradient: "linear-gradient(180deg, #0a1f17 0%, #0a0f1a 100%)",
    borderAccent: "#065f46",
    iconBg: "#064e3b",
    label: "Устранение",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  refs: {
    accent: "#f472b6",
    accentMuted: "#f472b618",
    gradient: "linear-gradient(180deg, #1f0a1a 0%, #0a0f1a 100%)",
    borderAccent: "#831843",
    iconBg: "#500724",
    label: "Ссылки",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
};

/* ── Helpers ── */
function sevColor(score) {
  if (!score) return { bg: "#1e293b", border: "#334155", text: "#64748b", label: "—", glow: "transparent" };
  if (score >= 9) return { bg: "#450a0a", border: "#dc2626", text: "#fca5a5", label: "КРИТ", glow: "#dc262640" };
  if (score >= 7) return { bg: "#431407", border: "#ea580c", text: "#fdba74", label: "ВЫС", glow: "#ea580c40" };
  if (score >= 4) return { bg: "#422006", border: "#ca8a04", text: "#fde047", label: "СР", glow: "#ca8a0440" };
  return { bg: "#052e16", border: "#16a34a", text: "#86efac", label: "НИЗ", glow: "#16a34a40" };
}

function bestScore(v) {
  return v.cvss4?.score ?? v.cvss3?.score ?? v.cvss2?.score ?? null;
}

/* ── Compact Row ── */
function VulnRow({ vuln, isOpen, onToggle }) {
  const score = bestScore(vuln);
  const sev = sevColor(score);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        background: isOpen ? "#111827" : hovered ? "#0f172a" : "#0c1220",
        borderLeft: `3px solid ${sev.border}`,
        transition: "all 0.2s ease",
        cursor: "pointer",
        borderBottom: "1px solid #1e293b40",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
    >
      <div style={{
        display: "grid",
        gridTemplateColumns: "54px 1fr auto",
        alignItems: "center",
        minHeight: 52,
      }}>
        {/* Score */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "100%", minHeight: 52,
          background: sev.bg,
          boxShadow: `inset 0 0 20px ${sev.glow}`,
        }}>
          <div style={{ textAlign: "center", lineHeight: 1 }}>
            <div style={{
              fontSize: 16, fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              color: sev.text,
            }}>{score?.toFixed(1) ?? "—"}</div>
            <div style={{
              fontSize: 8, fontWeight: 700, letterSpacing: "0.1em",
              color: sev.text, opacity: 0.7, marginTop: 2,
            }}>{sev.label}</div>
          </div>
        </div>

        {/* Main info */}
        <div style={{ padding: "10px 14px", overflow: "hidden", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600,
              color: "#60a5fa", flexShrink: 0,
            }}>{vuln.id}</span>
            <span style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 3,
              background: "#1e293b", color: "#64748b", fontWeight: 500,
              fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
            }}>{vuln.component}</span>
            {vuln.exploitExists && (
              <span style={{
                fontSize: 9, padding: "1px 6px", borderRadius: 3,
                background: "#7f1d1d50", color: "#fca5a5", fontWeight: 600,
                letterSpacing: "0.04em", flexShrink: 0,
              }}>EXPLOIT</span>
            )}
          </div>
          <div style={{
            fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{vuln.name}</div>
        </div>

        {/* CVSS mini pills + chevron */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "0 14px 0 0", flexShrink: 0,
        }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { v: "2.0", s: vuln.cvss2?.score },
              { v: "3.x", s: vuln.cvss3?.score },
              { v: "4.0", s: vuln.cvss4?.score },
            ].map(c => (
              <div key={c.v} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "4px 6px", borderRadius: 4, minWidth: 36,
                background: c.s ? sevColor(c.s).bg : "#0f172a",
                border: `1px solid ${c.s ? sevColor(c.s).border + "40" : "#1e293b"}`,
              }}>
                <span style={{ fontSize: 8, color: "#64748b", fontWeight: 600, lineHeight: 1 }}>{c.v}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, lineHeight: 1.3,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: c.s ? sevColor(c.s).text : "#334155",
                }}>{c.s?.toFixed(1) ?? "—"}</span>
              </div>
            ))}
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s ease", opacity: 0.4,
          }}>
            <path d="M2 4l4 4 4-4" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {isOpen && <DetailPanel vuln={vuln} />}
    </div>
  );
}

/* ── Detail Panel ── */
function DetailPanel({ vuln }) {
  const [tab, setTab] = useState("desc");
  const theme = TAB_THEMES[tab];
  const tabKeys = Object.keys(TAB_THEMES);

  return (
    <div style={{ borderTop: "1px solid #1e293b", animation: "slideDown 0.25s ease" }}>
      {/* Tab strip */}
      <div style={{
        display: "flex", gap: 0,
        borderBottom: `1px solid ${theme.borderAccent}50`,
        background: "#0a0e18",
        padding: "0 8px",
        overflowX: "auto",
        transition: "border-color 0.3s ease",
      }}>
        {tabKeys.map(key => {
          const t = TAB_THEMES[key];
          const active = tab === key;
          return (
            <button key={key} onClick={e => { e.stopPropagation(); setTab(key); }} style={{
              padding: "10px 14px", fontSize: 11, fontWeight: 600,
              fontFamily: "'IBM Plex Sans', sans-serif",
              color: active ? t.accent : "#3b4252",
              background: active ? t.accentMuted : "transparent",
              border: "none",
              borderBottom: active ? `2px solid ${t.accent}` : "2px solid transparent",
              borderRadius: active ? "6px 6px 0 0" : 0,
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
              letterSpacing: "0.03em",
              position: "relative",
            }}>
              <span style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 22, height: 22, borderRadius: 5,
                background: active ? t.iconBg : "transparent",
                color: active ? t.accent : "#3b4252",
                transition: "all 0.2s ease",
              }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content area with per-tab theming */}
      <div style={{
        background: theme.gradient,
        borderLeft: `2px solid ${theme.accent}20`,
        transition: "all 0.35s ease",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative accent glow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, ${theme.accent}60, transparent 70%)`,
          transition: "background 0.35s ease",
        }} />

        <div style={{ padding: "16px 18px", position: "relative" }} onClick={e => e.stopPropagation()}>
          {/* Tab-specific mini header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
            paddingBottom: 10, borderBottom: `1px solid ${theme.borderAccent}30`,
          }}>
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 7,
              background: theme.iconBg, color: theme.accent,
              border: `1px solid ${theme.borderAccent}`,
            }}>{theme.icon}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, color: theme.accent,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>{theme.label}</span>
            <div style={{
              flex: 1, height: 1,
              background: `linear-gradient(90deg, ${theme.borderAccent}60, transparent)`,
            }} />
          </div>

          {/* ─── DESC TAB ─── */}
          {tab === "desc" && (
            <div>
              <p style={{
                fontSize: 13, color: "#cbd5e1", lineHeight: 1.75, marginBottom: 14,
                paddingLeft: 12, borderLeft: `2px solid ${theme.accent}30`,
              }}>{vuln.description}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                <Chip label={vuln.vulnClass} color={theme.accent} />
                <Chip label={vuln.cweId} color="#f472b6" />
                <Chip label={vuln.cweDesc} color="#c084fc" />
                <Chip label={vuln.vulnState} color="#60a5fa" />
                <Chip label={vuln.status} color="#34d399" />
              </div>
              <div style={{
                display: "flex", gap: 0, borderRadius: 8, overflow: "hidden",
                border: `1px solid ${theme.borderAccent}40`,
              }}>
                <DateCell label="Выявлена" value={vuln.dateDiscovered} accent={theme.accent} />
                <DateCell label="Опубликована" value={vuln.datePublished} accent={theme.accent} />
                <DateCell label="Обновлена" value={vuln.dateUpdated} accent={theme.accent} last />
              </div>
            </div>
          )}

          {/* ─── TECH TAB ─── */}
          {tab === "tech" && (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8,
            }}>
              <FieldCard label="Вендор" value={vuln.vendor} accent={theme.accent} borderColor={theme.borderAccent} />
              <FieldCard label="Продукт" value={vuln.softwareName} accent={theme.accent} borderColor={theme.borderAccent} />
              <FieldCard label="Версия" value={vuln.softwareVersion} mono accent={theme.accent} borderColor={theme.borderAccent} />
              <FieldCard label="Тип ПО" value={vuln.softwareType} accent={theme.accent} borderColor={theme.borderAccent} />
              <FieldCard label="ОС / Платформа" value={vuln.osPlatform} accent={theme.accent} borderColor={theme.borderAccent} />
              <FieldCard label="Способ эксплуатации" value={vuln.exploitMethod} accent={theme.accent} borderColor={theme.borderAccent} />
              <FieldCard label="Доп. информация" value={vuln.additionalInfo} accent={theme.accent} borderColor={theme.borderAccent} />
              <FieldCard label="Связь с инцидентами" value={vuln.incidentRelation} accent={theme.accent} borderColor={theme.borderAccent} />
            </div>
          )}

          {/* ─── SCORES TAB ─── */}
          {tab === "scores" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { v: "2.0", data: vuln.cvss2 },
                { v: "3.x", data: vuln.cvss3 },
                { v: "4.0", data: vuln.cvss4 },
              ].map(c => {
                const s = c.data?.score;
                const sv = sevColor(s);
                return (
                  <div key={c.v} style={{
                    padding: 14, borderRadius: 8,
                    background: s
                      ? `linear-gradient(135deg, ${sv.bg} 0%, #0a0f1a 100%)`
                      : "#0c1220",
                    border: `1px solid ${s ? sv.border + "40" : "#1e293b"}`,
                    position: "relative", overflow: "hidden",
                  }}>
                    {s && <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 2,
                      background: `linear-gradient(90deg, ${sv.border}, transparent)`,
                    }} />}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: s ? theme.accent : "#334155",
                        letterSpacing: "0.08em",
                        padding: "2px 6px", borderRadius: 4,
                        background: s ? theme.accentMuted : "transparent",
                      }}>CVSS {c.v}</span>
                      <span style={{
                        fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                        color: s ? sv.text : "#1e293b",
                      }}>{s?.toFixed(1) ?? "N/A"}</span>
                    </div>
                    {s && (
                      <>
                        <div style={{
                          height: 4, background: "#0c1220", borderRadius: 2,
                          overflow: "hidden", marginBottom: 10,
                        }}>
                          <div style={{
                            height: "100%", width: `${s * 10}%`,
                            background: `linear-gradient(90deg, ${sv.border}, ${sv.border}90)`,
                            borderRadius: 2,
                            boxShadow: `0 0 8px ${sv.border}40`,
                          }} />
                        </div>
                        <div style={{
                          fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
                          color: "#4b5563", wordBreak: "break-all", lineHeight: 1.6,
                          padding: "6px 8px", background: "#06080f",
                          borderRadius: 4, border: "1px solid #1e293b30",
                        }}>{c.data.vector}</div>
                      </>
                    )}
                    {!s && (
                      <div style={{
                        textAlign: "center", padding: "12px 0", fontSize: 11, color: "#1e293b",
                        fontWeight: 600,
                      }}>Не применимо</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── FIX TAB ─── */}
          {tab === "fix" && (
            <div>
              <div style={{
                display: "flex", gap: 12, padding: 14,
                background: `linear-gradient(135deg, ${theme.iconBg} 0%, #0a0f1a 100%)`,
                borderRadius: 8, border: `1px solid ${theme.borderAccent}50`,
                marginBottom: 14,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: theme.accentMuted, border: `1px solid ${theme.borderAccent}`,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                </div>
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: theme.accent,
                    marginBottom: 4, letterSpacing: "0.04em",
                  }}>РЕКОМЕНДУЕМЫЕ МЕРЫ</div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{vuln.remediation}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <FieldCard label="Способ устранения" value={vuln.fixMethod} accent={theme.accent} borderColor={theme.borderAccent} />
                <FieldCard label="Информация" value={vuln.fixInfo} accent={theme.accent} borderColor={theme.borderAccent} />
              </div>
              <div style={{
                marginTop: 12, display: "flex", gap: 12,
                padding: "10px 14px", borderRadius: 6,
                background: "#0c1220", border: `1px solid ${theme.borderAccent}30`,
              }}>
                <span style={{ fontSize: 11, color: "#4b5563", fontWeight: 500 }}>Наличие эксплойта:</span>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: vuln.exploitExists ? "#fca5a5" : "#34d399",
                }}>{vuln.exploitExists ? "⚠ Существует" : "✓ Не обнаружен"}</span>
              </div>
            </div>
          )}

          {/* ─── REFS TAB ─── */}
          {tab === "refs" && (
            <div>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14,
              }}>
                {vuln.otherIds.map((oid, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 14px", borderRadius: 8,
                    background: `linear-gradient(135deg, ${theme.iconBg} 0%, #0c1220 100%)`,
                    border: `1px solid ${theme.borderAccent}50`,
                  }}>
                    <span style={{
                      fontSize: 8, fontWeight: 800, color: theme.accent, letterSpacing: "0.12em",
                      padding: "2px 5px", borderRadius: 3, background: theme.accentMuted,
                    }}>{oid.startsWith("CVE") ? "CVE" : "ID"}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: theme.accent,
                    }}>{oid}</span>
                  </div>
                ))}
              </div>
              {vuln.references.map((ref, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 6,
                  background: "#0c1220",
                  border: `1px solid ${theme.borderAccent}30`,
                  marginBottom: 6,
                }}>
                  <span style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 24, height: 24, borderRadius: 6,
                    background: theme.accentMuted, color: theme.accent, fontSize: 12, flexShrink: 0,
                  }}>↗</span>
                  <span style={{
                    fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                    color: theme.accent, wordBreak: "break-all", opacity: 0.85,
                  }}>{ref}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Shared Components ── */
function Chip({ label, color = "#94a3b8" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 5,
      fontSize: 11, fontWeight: 500, color,
      background: color + "12", border: `1px solid ${color}20`,
    }}>{label}</span>
  );
}

function DateCell({ label, value, accent, last }) {
  return (
    <div style={{
      flex: 1, padding: "8px 12px",
      borderRight: last ? "none" : "1px solid #1e293b30",
      background: "#0c1220",
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: accent, opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function FieldCard({ label, value, mono, accent, borderColor }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 6,
      background: "#0c1220",
      border: `1px solid ${borderColor}30`,
      transition: "border-color 0.3s ease",
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: accent, opacity: 0.5,
        letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.4,
        ...(mono ? { fontFamily: "'JetBrains Mono', monospace", fontSize: 12 } : {}),
      }}>{value || "—"}</div>
    </div>
  );
}

/* ── Main ── */
export default function BDUList() {
  const [openId, setOpenId] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = vulns.filter(v =>
    !search || v.id.toLowerCase().includes(search.toLowerCase()) ||
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.component.toLowerCase().includes(search.toLowerCase()) ||
    v.otherIds.some(oid => oid.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      background: "#080d19", color: "#e2e8f0", minHeight: "100vh",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        button:hover { filter: brightness(1.15); }
      `}</style>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid #1e293b",
        background: "#0c1220",
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
          Matched: <span style={{ color: "#f1f5f9" }}>{filtered.length}</span>
        </span>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#111827", borderRadius: 6, border: "1px solid #1e293b",
          padding: "6px 12px",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="BDU ID, CVE, component..."
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "#e2e8f0", fontSize: 12,
              fontFamily: "'IBM Plex Sans', sans-serif", width: 220,
            }}
          />
        </div>
      </div>

      {/* Column header */}
      <div style={{
        display: "grid", gridTemplateColumns: "54px 1fr auto",
        alignItems: "center", padding: "6px 0",
        borderBottom: "1px solid #1e293b60", background: "#0a0f1a",
      }}>
        <div style={{ textAlign: "center", fontSize: 8, fontWeight: 700, color: "#334155", letterSpacing: "0.1em" }}>CVSS</div>
        <div style={{ padding: "0 14px", fontSize: 9, fontWeight: 700, color: "#334155", letterSpacing: "0.1em" }}>ИДЕНТИФИКАТОР / НАИМЕНОВАНИЕ</div>
        <div style={{ padding: "0 34px 0 0", display: "flex", gap: 4 }}>
          {["2.0", "3.x", "4.0"].map(v => (
            <div key={v} style={{ width: 36, textAlign: "center", fontSize: 8, fontWeight: 700, color: "#334155", letterSpacing: "0.05em" }}>{v}</div>
          ))}
        </div>
      </div>

      {/* List */}
      <div>
        {filtered.map(v => (
          <VulnRow key={v.id} vuln={v} isOpen={openId === v.id} onToggle={() => setOpenId(openId === v.id ? null : v.id)} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#334155", fontSize: 13 }}>Уязвимости не найдены</div>
        )}
      </div>
    </div>
  );
}
