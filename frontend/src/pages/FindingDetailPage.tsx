import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { request } from "../api/client";
import { CodeBlock, Collapse, Section, SevBadge, StatusPill, Tag, TypeBadge, severityMeta } from "../components/findingsV2";
import styles from "./FindingDetailPage.module.css";

type Severity = "critical" | "high" | "medium" | "low" | "info";
type FindingStatus = "new" | "open" | "in_progress" | "fixed" | "false_positive" | "accepted_risk";
type FindingType = "SAST" | "DAST" | "SCA" | "SECRETS" | "IAC";

interface FindingDetail {
  id: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  type: FindingType;
  product: string;
  productId: number;
  tool: string;
  firstSeen: string;
  lastSeen: string;
  description: string;
  riskScore: number;
  slaLeft: number;
  tags: string[];
  occurrences: number;
  comments: number;
  duplicates: number;
  historyCount: number;
  sast?: {
    rule: string;
    file: string;
    range: string;
    lineNum: number;
    snippet: string;
    severityRaw: string;
    message: string;
    metadata: Record<string, string>;
  };
  remediation: {
    cwe: string;
    cweName: string;
    howToFix: string[];
    references: string[];
  };
}

interface BDUMatch {
  id: string;
  severity: string;
  cvss2: { vector: string; score: number } | null;
  cvss3: { vector: string; score: number } | null;
  cvss4: { vector: string; score: number } | null;
  status: string;
  vulnState: string;
  exploit: boolean;
  vulnClass: string;
  cweId: string;
  cweDesc: string;
  exploitMethod: string;
  name: string;
  description: string;
  software: { vendor: string; name: string; version: string; type: string; os: string };
  fix: { info: string; method: string; detail: string };
  otherIds: string[];
  references: string[];
  dateDiscovered: string;
  datePublished: string;
  dateUpdated: string;
}

interface HistoryEntry { date: string; action: string; user: string; detail: string }
interface Occurrence { id: string; path: string; range: string }
interface Comment { id: string; author: string; date: string; text: string }

const tabs = ["desc", "tool", "bdu", "occ", "comments", "history", "dup"] as const;
type TabKey = (typeof tabs)[number];

const tabTheme: Record<TabKey, { label: string; accent: string; bg: string }> = {
  desc: { label: "Описание", accent: "#60a5fa", bg: "linear-gradient(160deg,#0c1a2e,#080d19)" },
  tool: { label: "Инструмент", accent: "#a855f7", bg: "linear-gradient(160deg,#150e2e,#080d19)" },
  bdu: { label: "БДУ ФСТЭК", accent: "#f472b6", bg: "linear-gradient(160deg,#1f0a1a,#080d19)" },
  occ: { label: "Occurrences", accent: "#f59e0b", bg: "linear-gradient(160deg,#1a1508,#080d19)" },
  comments: { label: "Комментарии", accent: "#34d399", bg: "linear-gradient(160deg,#0a1f17,#080d19)" },
  history: { label: "История", accent: "#fb923c", bg: "linear-gradient(160deg,#1c1008,#080d19)" },
  dup: { label: "Дубликаты", accent: "#64748b", bg: "linear-gradient(160deg,#0f1219,#080d19)" },
};

const FindingDetailPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("desc");
  const [detail, setDetail] = useState<FindingDetail | null>(null);
  const [status, setStatus] = useState<FindingStatus>("new");
  const [bdu, setBdu] = useState<BDUMatch[]>([]);
  const [occ, setOcc] = useState<Occurrence[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [duplicates, setDuplicates] = useState<Array<{ id: string; title: string }>>([]);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    request<unknown>(`/api/v1/findings/${id}`).then((payload) => {
      const data = mapFindingDetail(payload);
      setDetail(data);
      setStatus(data.status);
    }).catch(() => null);
    request<BDUMatch[]>(`/api/v1/findings/${id}/bdu`).then(setBdu).catch(() => setBdu([]));
    request<Occurrence[]>(`/api/v1/findings/${id}/occurrences`).then(setOcc).catch(() => setOcc([]));
    request<Comment[]>(`/api/v1/findings/${id}/comments`).then(setComments).catch(() => setComments([]));
    request<HistoryEntry[]>(`/api/v1/findings/${id}/history`).then(setHistory).catch(() => setHistory([]));
    request<Array<{ id: string; title: string }>>(`/api/v1/findings/${id}/duplicates`).then(setDuplicates).catch(() => setDuplicates([]));
  }, [id]);

  const activeTheme = tabTheme[tab];
  const riskColor = useMemo(() => detail ? (detail.riskScore > 80 ? "#ef4444" : detail.riskScore > 50 ? "#f59e0b" : "#22c55e") : "#64748b", [detail]);

  const saveStatus = async () => {
    await request(`/api/v1/findings/${id}`, { method: "PATCH", json: true, body: { status } });
  };

  if (!detail) return <div className={styles.page}>Загрузка...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button onClick={() => navigate(-1)}>← К результатам</button>
        <div>
          <button>Предыдущая</button>
          <button>Следующая</button>
        </div>
      </div>

      <div className={styles.hero} style={{ borderBottomColor: severityMeta[detail.severity].color }}>
        <div className={styles.badges}><SevBadge severity={detail.severity} /> <TypeBadge type={detail.type} /> {detail.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
        <h1>{detail.title}</h1>
        <div className={styles.uuid}>{detail.id}</div>
        <div className={styles.metaGrid}>
          <Meta label="Продукт" value={detail.product} />
          <Meta label="Риск" value={String(detail.riskScore)} color={riskColor} mono />
          <Meta label="SLA" value={`${detail.slaLeft} дн.`} color={detail.slaLeft < 7 ? "#ef4444" : "#22c55e"} mono />
          <Meta label="Первое обнаружение" value={detail.firstSeen} mono />
          <Meta label="Последнее обнаружение" value={detail.lastSeen} mono />
        </div>
        <div className={styles.controls}>
          <select value={status} onChange={(e) => setStatus(e.target.value as FindingStatus)}>
            <option value="new">Новая</option><option value="open">Открыта</option><option value="in_progress">В работе</option><option value="fixed">Исправлена</option><option value="false_positive">Лож. сраб.</option><option value="accepted_risk">Принятый риск</option>
          </select>
          <button onClick={saveStatus}>Сохранить</button>
          <button onClick={() => navigator.clipboard.writeText(window.location.href)}>Скопировать ссылку</button>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map((k) => (
          <button key={k} className={tab === k ? styles.tabActive : styles.tab} style={tab === k ? { borderBottomColor: tabTheme[k].accent, background: `${tabTheme[k].accent}12`, color: tabTheme[k].accent } : undefined} onClick={() => setTab(k)}>
            {tabTheme[k].label}
            {k === "bdu" ? ` (${bdu.length})` : ""}
            {k === "occ" ? ` (${occ.length})` : ""}
            {k === "comments" ? ` (${comments.length})` : ""}
            {k === "history" ? ` (${history.length})` : ""}
          </button>
        ))}
      </div>

      <div className={styles.content} style={{ background: activeTheme.bg, borderLeftColor: `${activeTheme.accent}55` }}>
        <div className={styles.accentLine} style={{ background: `linear-gradient(90deg, ${activeTheme.accent}, transparent)` }} />

        {tab === "desc" ? (
          <div className={styles.stack}>
            <Section title="Описание">
              <div className={styles.desc} style={{ borderLeftColor: activeTheme.accent }}>{detail.description}</div>
            </Section>
            <Section title="Рекомендации по устранению">
              <Tag color="#ef4444">{detail.remediation.cwe} · {detail.remediation.cweName}</Tag>
              <ol className={styles.fixList}>{detail.remediation.howToFix.map((s, i) => <li key={s}><span style={{ background: `${activeTheme.accent}22`, color: activeTheme.accent }}>{i + 1}</span>{s}</li>)}</ol>
              {detail.remediation.references.map((r) => <a key={r} href={r} target="_blank" rel="noreferrer">{r}</a>)}
            </Section>
          </div>
        ) : null}

        {tab === "tool" && detail.sast ? (
          <div className={styles.stack}>
            <Section title={`${detail.type} данные`}>
              <table className={styles.table}><tbody>
                <Row label="Rule ID" value={detail.sast.rule} />
                <Row label="Path" value={detail.sast.file} />
                <Row label="Range" value={detail.sast.range} />
                <Row label="Message" value={detail.sast.message} />
                <Row label="Severity raw" value={detail.sast.severityRaw} />
              </tbody></table>
            </Section>
            <CodeBlock file={detail.sast.file} lineNum={detail.sast.lineNum} code={detail.sast.snippet} accent={activeTheme.accent} />
            <Section title="Metadata"><div className={styles.metaCards}>{Object.entries(detail.sast.metadata).map(([k, v]) => <div key={k}><small>{k}</small><span>{v}</span></div>)}</div></Section>
          </div>
        ) : null}

        {tab === "bdu" ? <div>{bdu.map((card) => <BDUFullCard key={card.id} bdu={card} accent={activeTheme.accent} />)}</div> : null}

        {tab === "occ" ? <Section title="Occurrences">{occ.length ? occ.map((o, i) => <div key={o.id} className={styles.occ}>{i + 1}. {o.path} <span>{o.range}</span></div>) : <p>Нет вхождений.</p>}</Section> : null}

        {tab === "comments" ? (
          <Section title="Комментарии">
            {comments.length ? comments.map((c) => <div key={c.id} className={styles.comment}><div>👤</div><div><strong>{c.author}</strong><small>{c.date}</small><p>{c.text}</p></div></div>) : <p>Пока нет комментариев.</p>}
            <div className={styles.commentInput}><input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Добавить комментарий" /><button onClick={async () => { await request(`/api/v1/findings/${id}/comments`, { method: "POST", json: true, body: { text: commentText } }); setCommentText(""); }}>Отправить</button></div>
          </Section>
        ) : null}

        {tab === "history" ? <Section title="История">{history.map((h) => <div key={`${h.date}-${h.action}`} className={styles.timeline}><span /> <div><strong>{h.action}</strong><StatusPill status={h.user} /><p>{h.detail}</p><small>{h.date}</small></div></div>)}</Section> : null}

        {tab === "dup" ? <Section title="Дубликаты">{duplicates.length ? duplicates.map((d) => <div key={d.id}><a href={`/findings/${d.id}`}>{d.title}</a></div>) : <p>Связанных находок нет.</p>}</Section> : null}
      </div>
    </div>
  );
};

function Meta({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return <div><div className={styles.metaLabel}>{label}</div><div className={mono ? styles.mono : ""} style={color ? { color } : undefined}>{value}</div></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <tr><td>{label}</td><td>{value}</td></tr>;
}

function BDUFullCard({ bdu, accent }: { bdu: BDUMatch; accent: string }) {
  const severity = (bdu.severity in severityMeta ? bdu.severity : "info") as Severity;
  return (
    <article className={styles.bduCard} style={{ borderLeftColor: severityMeta[severity].color }}>
      <div className={styles.bduHead}>
        <div><strong className={styles.mono} style={{ color: accent }}>{bdu.id}</strong> <SevBadge severity={severity} /> <Tag>{(bdu.cvss4 || bdu.cvss3 || bdu.cvss2)?.vector ?? "CVSS n/a"}</Tag> <Tag color={bdu.exploit ? "#ef4444" : "#64748b"}>{bdu.exploit ? "Exploit" : "No exploit"}</Tag></div>
        <h4>{bdu.name}</h4>
        <div className={styles.metaCards}><div><small>Статус</small><span>{bdu.status}</span></div><div><small>Класс</small><span>{bdu.vulnClass}</span></div><div><small>CWE</small><span>{bdu.cweId}</span></div><div><small>Эксплуатация</small><span>{bdu.exploitMethod}</span></div></div>
      </div>
      <Collapse title="Описание" accent={accent}><p>{bdu.description}</p></Collapse>
      <Collapse title="CVSS" accent={accent}><p>{JSON.stringify({ cvss2: bdu.cvss2, cvss3: bdu.cvss3, cvss4: bdu.cvss4 })}</p></Collapse>
      <Collapse title="ПО и окружение" accent={accent} defaultOpen><table className={styles.table}><tbody><Row label="Вендор" value={bdu.software.vendor} /><Row label="ПО" value={bdu.software.name} /><Row label="Версия" value={bdu.software.version} /><Row label="Тип" value={bdu.software.type} /><Row label="ОС" value={bdu.software.os} /></tbody></table></Collapse>
      <Collapse title="Устранение" accent={accent}><p>{bdu.fix.info}</p><p>{bdu.fix.method}</p><p>{bdu.fix.detail}</p></Collapse>
      <Collapse title={`Идентификаторы (${bdu.otherIds.length})`} accent={accent}><div className={styles.tags}>{bdu.otherIds.map((x) => <Tag key={x}>{x}</Tag>)}</div></Collapse>
      <Collapse title={`Источники (${bdu.references.length})`} accent={accent}>{bdu.references.map((r) => <a key={r} href={r} target="_blank" rel="noreferrer">↗ {r}</a>)}</Collapse>
      <footer className={styles.bduFoot}><div><small>Выявлена</small><span className={styles.mono}>{bdu.dateDiscovered}</span></div><div><small>Опубликована</small><span className={styles.mono}>{bdu.datePublished}</span></div><div><small>Обновлена</small><span className={styles.mono}>{bdu.dateUpdated}</span></div></footer>
    </article>
  );
}

export default FindingDetailPage;

function mapFindingDetail(raw: unknown): FindingDetail {
  const row = raw as Record<string, unknown>;
  const details = ((row.sast as Record<string, unknown> | undefined) ??
    (row.details as Record<string, unknown> | undefined) ??
    {}) as Record<string, unknown>;
  const remediation = (row.remediation as Record<string, unknown> | undefined) ?? {};
  const tags = Array.isArray(row.tags) ? row.tags.map((t) => String(t)) : [];

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? "Без названия"),
    severity: normalizeSeverity(row.severity),
    status: normalizeStatus(row.status),
    type: normalizeType(row.type ?? row.category),
    product: String(row.product ?? row.productName ?? "—"),
    productId: Number(row.productId ?? 0),
    tool: String(row.tool ?? row.scannerType ?? "unknown"),
    firstSeen: String(row.firstSeen ?? row.firstSeenAt ?? row.createdAt ?? "—"),
    lastSeen: String(row.lastSeen ?? row.lastSeenAt ?? row.updatedAt ?? "—"),
    description: String(row.description ?? ""),
    riskScore: Number(row.riskScore ?? 0),
    slaLeft: Number(row.slaLeft ?? row.slaDaysRemaining ?? 0),
    tags,
    occurrences: Number(row.occurrences ?? 0),
    comments: Number(row.comments ?? 0),
    duplicates: Number(row.duplicates ?? 0),
    historyCount: Number(row.historyCount ?? 0),
    sast: {
      rule: String(details.rule ?? details.ruleId ?? ""),
      file: String(details.file ?? details.filePath ?? ""),
      range: String(details.range ?? `${details.startLine ?? "?"}:${details.endLine ?? "?"}`),
      lineNum: Number(details.lineNum ?? details.startLine ?? 1),
      snippet: String(details.snippet ?? ""),
      severityRaw: String(details.severityRaw ?? row.severity ?? ""),
      message: String(details.message ?? ""),
      metadata: (details.metadata as Record<string, string> | undefined) ?? {},
    },
    remediation: {
      cwe: String(remediation.cwe ?? ""),
      cweName: String(remediation.cweName ?? ""),
      howToFix: Array.isArray(remediation.howToFix) ? remediation.howToFix.map((x) => String(x)) : [],
      references: Array.isArray(remediation.references)
        ? remediation.references.map((x) => String(x))
        : [],
    },
  };
}

function normalizeSeverity(value: unknown): Severity {
  const v = String(value ?? "info").toLowerCase();
  if (v === "critical" || v === "high" || v === "medium" || v === "low") return v;
  return "info";
}

function normalizeStatus(value: unknown): FindingStatus {
  const v = String(value ?? "new").toLowerCase();
  if (
    v === "new" ||
    v === "open" ||
    v === "in_progress" ||
    v === "fixed" ||
    v === "false_positive" ||
    v === "accepted_risk"
  ) {
    return v;
  }
  if (v === "under_review") return "open";
  if (v === "confirmed") return "in_progress";
  if (v === "mitigated") return "fixed";
  if (v === "risk_accepted") return "accepted_risk";
  return "new";
}

function normalizeType(value: unknown): FindingType {
  const v = String(value ?? "SAST").toUpperCase();
  if (v === "SAST" || v === "DAST" || v === "SCA" || v === "SECRETS" || v === "IAC") return v;
  if (v === "CONFIG" || v === "CONTAINER") return "IAC";
  return "SAST";
}
