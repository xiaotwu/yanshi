// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub i18n so t() returns the key as a plain string.
vi.mock("../../i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

import { WorkerRail } from "./WorkerRail";
import type { AgentProfileSummary } from "@yanshi/shared";

const fakeProfiles = [
  { id: "p1", name: "Overseer", station: "manager", role: "manager", accent: "#277f71", behaviorMode: "balanced" },
  { id: "p2", name: "Scout",    station: "browser",  role: "browser",  accent: "#3f7fb0", behaviorMode: "balanced" },
] as AgentProfileSummary[];

describe("WorkerRail", () => {
  afterEach(() => cleanup());
  it("renders one button per profile with the worker name as accessible name", () => {
    render(
      <WorkerRail
        profiles={fakeProfiles}
        liveAgents={[]}
        selectedId="p1"
        onSelect={vi.fn()}
        onForge={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Overseer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scout" })).toBeInTheDocument();
  });

  it("marks the selected profile button aria-pressed=true", () => {
    render(
      <WorkerRail
        profiles={fakeProfiles}
        liveAgents={[]}
        selectedId="p1"
        onSelect={vi.fn()}
        onForge={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Overseer" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Scout" })).toHaveAttribute("aria-pressed", "false");
  });

  it("renders a forge button with the i18n key as accessible name", () => {
    render(
      <WorkerRail
        profiles={fakeProfiles}
        liveAgents={[]}
        selectedId={null}
        onSelect={vi.fn()}
        onForge={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "workshop.forgeWorker" })).toBeInTheDocument();
  });

  it("renders each worker as a role-skinned mascot rig, not a plain icon", () => {
    render(
      <WorkerRail
        profiles={fakeProfiles}
        liveAgents={[]}
        selectedId="p1"
        onSelect={vi.fn()}
        onForge={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("img", { name: "mascot.accessibleName" })).toHaveLength(2);
    expect(screen.getByTestId("mascot-role-prop-manager")).toBeInTheDocument();
    expect(screen.getByTestId("mascot-role-prop-browser")).toBeInTheDocument();
  });
});
