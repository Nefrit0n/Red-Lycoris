import { describe, expect, it } from "vitest";
import { resolveFindingDetails } from "./findingDetails";
import { FindingDetailDTO } from "../types/findings";

describe("resolveFindingDetails", () => {
  it("returns SCA details when category is SCA and fields exist", () => {
    const finding: FindingDetailDTO = {
      id: "f-1",
      title: "SCA finding",
      severity: "high",
      status: "new",
      category: "SCA",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      details: {
        pkgName: "lodash",
        installedVersion: "4.17.21",
        vulnerabilityId: "CVE-2024-0001",
      },
      comments: [],
      events: [],
    };

    const resolved = resolveFindingDetails(finding);
    expect(resolved.category).toBe("SCA");
    expect(resolved.details?.pkgName).toBe("lodash");
  });

  it("returns UNKNOWN when category is unsupported", () => {
    const finding: FindingDetailDTO = {
      id: "f-2",
      title: "Unknown finding",
      severity: "low",
      status: "new",
      category: "UNKNOWN",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      details: { foo: "bar" },
      comments: [],
      events: [],
    };

    const resolved = resolveFindingDetails(finding);
    expect(resolved.category).toBe("UNKNOWN");
    expect(resolved.details).toBeNull();
  });
});
