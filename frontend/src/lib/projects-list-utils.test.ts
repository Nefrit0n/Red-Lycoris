import { describe, expect, it } from "vitest";
import { groupPinnedFirst, hasProjectsFilters } from "@/lib/projects-list-utils";
import type { Project } from "@/types";

function project(id: string, pinned: boolean, updatedAt: string): Project {
  return {
    id,
    slug: id,
    name: id,
    icon_color: "#000",
    source_kind: "manual",
    autoscan_on_push: false,
    tags: [],
    status: "active",
    setup_completed: true,
    visibility: "workspace",
    owner: { id: "u", email: "u@x", display_name: "U" },
    pinned,
    findings_by_severity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    sla_breached_count: 0,
    sla_notify_before_days: 3,
    scanners: { sast: "off", dast: "off", sca: "off", secrets: "off" },
    health: "healthy",
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

describe("projects list utils", () => {
  it("groups pinned projects first", () => {
    const sorted = groupPinnedFirst([
      project("a", false, "2026-01-01T00:00:00Z"),
      project("b", true, "2026-01-01T00:00:00Z"),
      project("c", false, "2026-02-01T00:00:00Z"),
    ]);

    expect(sorted.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("detects active filters", () => {
    expect(
      hasProjectsFilters({
        view: "list",
        status: [],
        coverage: [],
        tag: [],
        sort: "critical-desc",
      }),
    ).toBe(false);

    expect(
      hasProjectsFilters({
        view: "list",
        status: ["active"],
        coverage: [],
        tag: [],
        sort: "critical-desc",
      }),
    ).toBe(true);
  });
});
