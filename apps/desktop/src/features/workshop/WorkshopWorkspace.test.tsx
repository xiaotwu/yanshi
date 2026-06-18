// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub the child components so the pane shells render without a live backend.
vi.mock("../workshop", () => ({
  AgentEditor: () => <div data-testid="stub-agent-editor" />,
  OfficeEditor: () => <div data-testid="stub-office-editor" />,
  WorkshopInstalled: () => <div data-testid="stub-workshop-installed" />,
}));

// Stub runtimeStore so WorkshopWorkspace's own useRuntimeStore call doesn't throw.
vi.mock("../../stores/runtimeStore", () => ({
  useRuntimeStore: () => ({ agentProfiles: [], activeProjectId: null, loadAgentProfiles: vi.fn() }),
}));

// Stub i18n so t() returns the key as a plain string.
vi.mock("../../i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

import { WorkshopWorkspace } from "./WorkshopWorkspace";

describe("WorkshopWorkspace", () => {
  it("renders the three crafting-bench regions", () => {
    render(<WorkshopWorkspace />);
    expect(screen.getByTestId("workshop-rail")).toBeInTheDocument();
    expect(screen.getByTestId("workshop-preview")).toBeInTheDocument();
    expect(screen.getByTestId("workshop-inspector")).toBeInTheDocument();
  });
});
