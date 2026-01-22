import { describe, expect, it } from "vitest";

import { normalizeDateFrom, normalizeDateTo } from "./urlHelpers";

describe("normalizeDateFrom", () => {
  it("normalizes yyyy-MM-dd input to ISO start of day", () => {
    expect(normalizeDateFrom("2024-04-10")).toBe("2024-04-10T00:00:00.000Z");
  });

  it("normalizes dd-MM-yyyy input to ISO start of day", () => {
    expect(normalizeDateFrom("10-04-2024")).toBe("2024-04-10T00:00:00.000Z");
  });

  it("returns undefined for invalid input", () => {
    expect(normalizeDateFrom("2024/04/10")).toBeUndefined();
  });
});

describe("normalizeDateTo", () => {
  it("normalizes dd-MM-yyyy input to ISO end of day", () => {
    expect(normalizeDateTo("10-04-2024")).toBe("2024-04-10T23:59:59.000Z");
  });
});
