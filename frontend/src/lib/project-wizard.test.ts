import { describe, expect, it } from "vitest";
import {
  createInitialWizardState,
  normalizeTag,
  projectWizardReducer,
  slugifyProjectName,
  isProjectNameFormatValid,
  PROJECT_COLOR_PALETTE,
} from "@/lib/project-wizard";

describe("project wizard slugify", () => {
  it("transliterates cyrillic and normalizes separators", () => {
    expect(slugifyProjectName("Тестовый Проект API")).toBe("testovyy-proekt-api");
    expect(slugifyProjectName("  hello___world  ")).toBe("hello-world");
  });
});

describe("project wizard tag normalization", () => {
  it("normalizes spacing and case", () => {
    expect(normalizeTag("  Production Team ")).toBe("production-team");
  });
});

describe("project wizard name validation", () => {
  it("validates ranges and regex", () => {
    expect(isProjectNameFormatValid("ab")).toBe(false);
    expect(isProjectNameFormatValid("valid_name 123")).toBe(true);
    expect(isProjectNameFormatValid("bad/name")).toBe(false);
  });
});

describe("project wizard reducer", () => {
  it("derives slug and deterministic icon color from name", () => {
    const initial = createInitialWizardState("owner-1");
    const next = projectWizardReducer(initial, { type: "SET_NAME", name: "Alpha API" });
    expect(next.slug).toBe("alpha-api");
    expect(PROJECT_COLOR_PALETTE).toContain(next.icon_color);
  });

  it("prevents duplicate tags case-insensitively", () => {
    const initial = createInitialWizardState("owner-1");
    const withTag = projectWizardReducer(initial, { type: "ADD_TAG", tag: "Prod" });
    const duplicate = projectWizardReducer(withTag, { type: "ADD_TAG", tag: " prod " });
    expect(duplicate.tags).toEqual(["prod"]);
  });
});
