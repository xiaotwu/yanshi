// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub i18n so t() returns the key as a plain string.
vi.mock("../../../i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

// Stub the store — MindSection calls saveAgentProfile.
const mockSaveAgentProfile = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../stores/runtimeStore", () => ({
  useRuntimeStore: () => ({
    saveAgentProfile: mockSaveAgentProfile,
  }),
}));

// Stub the API client so no real network calls are made.
vi.mock("../../../api/client", () => ({
  runtimeApi: {
    providerModels: vi.fn().mockResolvedValue({ models: ["gpt-x", "claude-y"] }),
  },
}));

import { MindSection } from "./MindSection";
import type { AgentProfileSummary } from "@yanshi/shared";

const fakeProfile: AgentProfileSummary = {
  id: "p1",
  name: "Test Worker",
  station: "worker",
  role: "worker",
  accent: "#277f71",
  behaviorMode: "balanced",
  taskPriority: 5,
  personality: "calm",
  prompt: "You are a worker agent.",
  defaultTools: [],
  defaultPermissions: [],
  motionPack: "default",
  model: "gpt-4o",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("MindSection", () => {
  afterEach(() => {
    cleanup();
    mockSaveAgentProfile.mockClear();
  });

  it("renders the model input with a list attribute pointing to the datalist", async () => {
    render(<MindSection profile={fakeProfile} />);

    // An <input type="text" list="..."> with a connected <datalist> gets role "combobox".
    const input = screen.getByRole("combobox", { name: "workshop.modelLabel" });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("list", "worker-model-options");
  });

  it("renders a datalist with options from providerModels after fetch resolves", async () => {
    render(<MindSection profile={fakeProfile} />);

    await waitFor(() => {
      const datalist = document.getElementById("worker-model-options");
      expect(datalist).not.toBeNull();
      const options = datalist!.querySelectorAll("option");
      const values = Array.from(options).map((o) => o.getAttribute("value"));
      expect(values).toContain("gpt-x");
      expect(values).toContain("claude-y");
    });
  });

  it("shows the profile model as the input value", () => {
    render(<MindSection profile={fakeProfile} />);
    expect(screen.getByDisplayValue("gpt-4o")).toBeInTheDocument();
  });
});
