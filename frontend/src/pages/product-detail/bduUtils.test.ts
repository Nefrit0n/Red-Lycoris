import { describe, expect, it } from "vitest";
import {
  formatOptionalText,
  getBestCvssScore,
  hasMeaningfulValue,
  normalizeBduMatch,
  normalizeExternalIds,
  normalizeReferences,
} from "./bduUtils";

describe("bduUtils", () => {
  it("normalizes nullish values and mixed payload shapes", () => {
    const normalized = normalizeBduMatch({
      bduId: "BDU:2024-0001",
      cvssV3: "7.5 AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      sourceUrls: "https://example.com/a, https://example.com/b",
      otherIds: ["CVE-2024-1234", " CWE-79 "],
      severity: "Высокий",
    });

    expect(normalized.bduId).toBe("BDU:2024-0001");
    expect(normalized.cvssV3.score).toBe(7.5);
    expect(normalized.sourceUrls).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(normalized.otherIds).toEqual(["CVE-2024-1234", "CWE-79"]);
  });

  it("selects best cvss score by priority 4.0 -> 3.x -> 2.0", () => {
    const normalized = normalizeBduMatch({
      bduId: "BDU:1",
      cvssV2: "4.3",
      cvssV3: "7.1",
      cvssV4: "9.8",
    });
    expect(getBestCvssScore(normalized).score).toBe(9.8);
  });

  it("provides stable fallbacks for empty values", () => {
    expect(formatOptionalText(null)).toBe("Нет данных");
    expect(formatOptionalText("")).toBe("Нет данных");
    expect(hasMeaningfulValue(undefined)).toBe(false);
    expect(hasMeaningfulValue("x")).toBe(true);
  });

  it("normalizes references and external IDs from noisy payloads", () => {
    expect(normalizeReferences(["https://valid.local", "not-a-url"])).toEqual(["https://valid.local"]);
    expect(normalizeExternalIds("CVE-1; CWE-2\nGHSA-3")).toEqual(["CVE-1", "CWE-2", "GHSA-3"]);
  });
});
