import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import IntegrationTokensPage from "./IntegrationTokensPage";

vi.mock("../../api/integrationTokens", () => ({
  listIntegrationTokens: vi.fn(async () => ({
    items: [
      {
        id: "t1",
        name: "gitlab-ci",
        revision: 1,
        tenant: { org_id: "org1", project_id: "prj1" },
        scopes: ["ingest:run:init"],
        state: "ACTIVE",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    total: 1,
  })),
  createIntegrationToken: vi.fn(),
  patchIntegrationToken: vi.fn(),
  revokeIntegrationToken: vi.fn(),
  rotateIntegrationToken: vi.fn(),
  getIntegrationTokenAudit: vi.fn(async () => ({ items: [] })),
}));

describe("IntegrationTokensPage", () => {
  it("renders page and warning banner", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/integrations/tokens"]}>
        <IntegrationTokensPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Integration Tokens" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/expire in 7 days/i)).toBeInTheDocument();
    });
  });
});
