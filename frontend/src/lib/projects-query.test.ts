import { describe, expect, it } from "vitest";
import { parseProjectsUrlParams, serializeProjectsUrlParams } from "@/lib/projects-query";

describe("projects query serialization", () => {
  it("serializes and parses list filters", () => {
    const params = serializeProjectsUrlParams({
      view: "list",
      status: ["active", "paused"],
      coverage: ["no-sast"],
      team: "backend",
      sla: "breached",
      tag: ["api", "go"],
      q: "payment",
      sort: "critical-desc",
      owner: "user_1",
      cursor: "1|abc",
    });

    const parsed = parseProjectsUrlParams(params);

    expect(parsed.view).toBe("list");
    expect(parsed.status).toEqual(["active", "paused"]);
    expect(parsed.coverage).toEqual(["no-sast"]);
    expect(parsed.team).toBe("backend");
    expect(parsed.sla).toBe("breached");
    expect(parsed.tag).toEqual(["api", "go"]);
    expect(parsed.q).toBe("payment");
    expect(parsed.owner).toBe("user_1");
    expect(parsed.cursor).toBe("1|abc");
    expect(parsed.sort).toBe("critical-desc");
  });
});
