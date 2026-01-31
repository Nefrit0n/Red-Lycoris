import { describe, expect, it } from "vitest";
import { normalizeSeverityCounts } from "./normalizeSeverityCounts";

describe("normalizeSeverityCounts", () => {
  it("normalizes mixed-case severity keys", () => {
    const result = normalizeSeverityCounts({
      Critical: 2,
      HIGH: "5",
      Medium: 3,
      low: 4,
      Info: 1,
    });

    expect(result).toEqual({
      critical: 2,
      high: 5,
      medium: 3,
      low: 4,
      info: 1,
    });
  });

  it("coerces invalid values to 0", () => {
    const result = normalizeSeverityCounts({
      critical: "invalid",
      high: undefined,
      medium: null,
      low: "2",
      info: 0,
    });

    expect(result).toEqual({
      critical: 0,
      high: 0,
      medium: 0,
      low: 2,
      info: 0,
    });
  });

  it("returns zeros when input is missing", () => {
    expect(normalizeSeverityCounts()).toEqual({
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    });
  });
});
