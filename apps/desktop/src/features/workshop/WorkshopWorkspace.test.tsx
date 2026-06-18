// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub the child components so the pane shells render without a live backend.
vi.mock("../workshop", () => ({
  WorkshopInstalled: () => <div data-testid="stub-workshop-installed" />,
}));

// Stub WorkerRail so the three-region layout test stays pane-level only.
vi.mock("./WorkerRail", () => ({
  WorkerRail: () => <div data-testid="stub-worker-rail" />,
}));

// Stub AtelierPreview so WorkshopWorkspace test stays pane-level only.
vi.mock("./AtelierPreview", () => ({
  AtelierPreview: () => <div data-testid="stub-atelier-preview" />,
}));

// Stub runtimeStore so WorkshopWorkspace's own useRuntimeStore call doesn't throw.
vi.mock("../../stores/runtimeStore", () => ({
  useRuntimeStore: () => ({
    agentProfiles: [],
    liveAgents: [],
    activeProjectId: null,
    officeState: null,
    loadAgentProfiles: vi.fn(),
    loadOfficeState: vi.fn(),
    createAgentProfile: vi.fn(),
  }),
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
