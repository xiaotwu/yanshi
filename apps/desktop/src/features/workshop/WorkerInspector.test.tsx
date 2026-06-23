// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub i18n so t() returns the key as a plain string.
vi.mock("../../i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

// Stub the store — WorkerInspector / sections call saveAgentProfile and read appSettings.
const mockSaveAgentProfile = vi.fn().mockResolvedValue(undefined);

vi.mock("../../stores/runtimeStore", () => ({
  useRuntimeStore: () => ({
    saveAgentProfile: mockSaveAgentProfile,
    appSettings: {
      browserToolEnabled: true,
      computerToolEnabled: false, // globally OFF — toggle must be disabled
      terminalToolEnabled: true,
    },
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
  defaultTools: ["browser"],
  defaultPermissions: [],
  motionPack: "default",
  model: "claude-3-5-sonnet-20241022",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("WorkerInspector", () => {
  afterEach(() => {
    cleanup();
    mockSaveAgentProfile.mockClear();
  });

  it("renders an editable name input in the identity header", () => {
    render(<WorkerInspector profile={fakeProfile} />);
    const nameInput = screen.getByDisplayValue("Overseer");
    expect(nameInput).toBeInTheDocument();
    expect(nameInput.tagName).toBe("INPUT");
  });

  it("renders the selected worker identity as the shared mascot rig", () => {
    render(<WorkerInspector profile={fakeProfile} />);

    expect(screen.getByRole("img", { name: "mascot.accessibleName" })).toBeInTheDocument();
    expect(screen.getByTestId("mascot-role-prop-manager")).toBeInTheDocument();
  });

  it("renders the four icon tab controls by aria-label", () => {
    render(<WorkerInspector profile={fakeProfile} />);
    expect(screen.getByRole("button", { name: "workshop.temperament" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "workshop.mind" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "workshop.abilities" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "workshop.incantation" })).toBeInTheDocument();
  });

  it("clicking the 本事 (abilities) tab shows interactive switches, NOT static chips", () => {
    render(<WorkerInspector profile={fakeProfile} />);
    fireEvent.click(screen.getByRole("button", { name: "workshop.abilities" }));

    // Each capability tool now has a role="switch" — runtime-enforced capabilities are togglable.
    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBeGreaterThanOrEqual(4);

    // The "computer" switch is globally OFF, so it must be disabled (honesty cap).
    const computerSwitch = screen.getByRole("switch", { name: "computer" });
    expect(computerSwitch).toBeDisabled();

    // The "browser" switch is globally ON and is in defaultTools — should be checked.
    const browserSwitch = screen.getByRole("switch", { name: "browser" });
    expect(browserSwitch).not.toBeDisabled();
    expect(browserSwitch).toHaveAttribute("aria-checked", "true");
  });

  it("toggling a globally-enabled ability calls saveAgentProfile with updated defaultTools", async () => {
    render(<WorkerInspector profile={fakeProfile} />);
    fireEvent.click(screen.getByRole("button", { name: "workshop.abilities" }));

    // "terminal" is globally enabled and not in defaultTools (fakeProfile.defaultTools = ["browser"]).
    const terminalSwitch = screen.getByRole("switch", { name: "terminal" });
    expect(terminalSwitch).not.toBeDisabled();
    fireEvent.click(terminalSwitch);

    // saveAgentProfile should have been called with defaultTools including "terminal"
    expect(mockSaveAgentProfile).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ defaultTools: expect.arrayContaining(["browser", "terminal"]) }),
    );
  });

  it("clicking the 心智 (mind) tab shows an editable model input — no pendingRuntime note", () => {
    render(<WorkerInspector profile={fakeProfile} />);
    fireEvent.click(screen.getByRole("button", { name: "workshop.mind" }));

    // An input bound to the model value must exist.
    const modelInput = screen.getByDisplayValue("claude-3-5-sonnet-20241022");
    expect(modelInput).toBeInTheDocument();
    expect(modelInput.tagName).toBe("INPUT");

    // The old read-only note must be gone.
    expect(screen.queryByText("workshop.pendingRuntime")).toBeNull();
  });
});
