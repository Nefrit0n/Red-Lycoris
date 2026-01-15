import { useEffect } from "react";
import { useAppStore } from "../store/useAppStore";

const Findings = () => {
  const findings = useAppStore((state) => state.findings);
  const setFindings = useAppStore((state) => state.setFindings);

  useEffect(() => {
    setFindings([
      { id: "f-1", title: "SQL Injection", severity: "high", status: "open" },
      { id: "f-2", title: "Outdated Library", severity: "medium", status: "triage" },
    ]);
  }, [setFindings]);

  return (
    <section>
      <h1>Findings</h1>
      <p>Сводка нормализованных находок.</p>
      <table style={{ width: "100%", background: "white", borderRadius: "8px" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px" }}>Title</th>
            <th style={{ textAlign: "left", padding: "8px" }}>Severity</th>
            <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {findings.map((finding) => (
            <tr key={finding.id}>
              <td style={{ padding: "8px" }}>{finding.title}</td>
              <td style={{ padding: "8px" }}>{finding.severity}</td>
              <td style={{ padding: "8px" }}>{finding.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export default Findings;
