// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub i18n so t() returns the key as a plain string.
vi.mock("../../i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

// Stub the store — WorkerInspector calls saveAgentProfile.
vi.mock("../../stores/runtimeStore", () => ({
  useRuntimeStore: () => ({
    saveAgentProfile: vi.fn(),
  }),
}));

import { WorkerInspector } from "./WorkerInspector";
import type { AgentProfileSummary } from "@yanshi/shared";

const fakeProfile: AgentProfileSummary = {
  id: "p1",
  name: "Overseer",
  station: "manager",
  role: "manager",
  accent: "#277f71",
  behaviorMode: "balanced",
  taskPriority: 5,
  personality: "calm",
  prompt: "You are a manager agent.",
  defaultTools: ["bash", "browser"],
  defaultPermissions: [],
  motionPack: "default",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("WorkerInspector", () => {
  afterEach(() => cleanup());

  it("renders an editable name input in the identity header", () => {
    render(<WorkerInspector profile={fakeProfile} />);
    const nameInput = screen.getByDisplayValue("Overseer");
    expect(nameInput).toBeInTheDocument();
    expect(nameInput.tagName).toBe("INPUT");
  });

  it("renders the four icon tab controls by aria-label", () => {
    render(<WorkerInspector profile={fakeProfile} />);
    expect(screen.getByRole("button", { name: "workshop.temperament" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "workshop.mind" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "workshop.abilities" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "workshop.incantation" })).toBeInTheDocument();
  });

  it("clicking the 本事 (abilities) tab shows tool chips but NO checkbox or switch", () => {
    render(<WorkerInspector profile={fakeProfile} />);
    fireEvent.click(screen.getByRole("button", { name: "workshop.abilities" }));
    // A tool chip should appear (one of the defaultTools)
    expect(screen.getByText("bash")).toBeInTheDocument();
    // Absolutely NO interactive toggles — the runtime doesn't support per-worker tools yet
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("clicking the 心智 (mind) tab shows the pending runtime note", () => {
    render(<WorkerInspector profile={fakeProfile} />);
    fireEvent.click(screen.getByRole("button", { name: "workshop.mind" }));
    expect(screen.getByText("workshop.pendingRuntime")).toBeInTheDocument();
  });
});
