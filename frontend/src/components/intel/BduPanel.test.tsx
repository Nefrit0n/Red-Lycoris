import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BduPanel from "./BduPanel";

describe("BduPanel", () => {
  it("renders empty fields fallback", () => {
    const { container } = render(<BduPanel bdu={{ "CVE-1": {} }} />);
    expect(screen.getByText("CVE-1")).toBeInTheDocument();
    expect(container.textContent).toContain("Описание уязвимости");
    expect(container).toMatchSnapshot();
  });

  it("renders long remediation list and pre-line content", () => {
    const { container } = render(
      <BduPanel
        bdu={{
          "CVE-2": {
            description: "line1\nline2\nline3",
            remediation_steps: ["step one", "step two", "step three", "step four"],
            external_ids: { cve: ["CVE-2"], "fg-ir": ["FG-IR-2"] },
          },
        }}
      />
    );
    expect(screen.getByText(/line1/)).toBeInTheDocument();
    expect(screen.getByText(/1\. step one/)).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it("renders multiple CVSS versions and software rows", () => {
    const { container } = render(
      <BduPanel
        bdu={{
          "CVE-3": {
            affected_software: [
              { vendor: "Acme", product: "GW", version: "1.2", type: "library", platform: "linux" },
            ],
            cvss: {
              v2: { score: 5.0, vector: "AV:N" },
              v3: { score: 8.8, vector: "CVSS:3.1/AV:N" },
              v4: { score: 9.1, vector: "CVSS:4.0/AV:N" },
            },
            references: [{ title: "BDU", url: "https://bdu.example/item/3" }],
          },
        }}
      />
    );

    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText(/v2: score: 5/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "BDU" })).toHaveAttribute("target", "_blank");
    expect(container).toMatchSnapshot();
  });
});
