// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub AtelierStage so we don't pull in WebGL / three.js in jsdom.
const mockAtelierStage = vi.fn();
vi.mock("../live-office", () => ({
  AtelierStage: (props: { compact: boolean; showWorkers?: boolean }) => {
    mockAtelierStage(props);
    return <div data-testid="stub-stage" />;
  },
}));

// Stub i18n so t() returns the key as a plain string.
vi.mock("../../i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

// Stub runtimeStore — component reads officeState and saveOfficeState from a prop-based API,
// but the store is still imported for activeProjectId.
vi.mock("../../stores/runtimeStore", () => ({
  useRuntimeStore: () => ({
    officeState: null,
    saveOfficeState: vi.fn(),
    loadOfficeState: vi.fn(),
    activeProjectId: "proj-1",
  }),
}));

import type { LiveOfficeStateSummary } from "@yanshi/shared";
import { AtelierPreview } from "./AtelierPreview";

const fakeOfficeState: LiveOfficeStateSummary = {
  id: "os-1",
  theme: "default",
  updatedAt: "2024-01-01T00:00:00Z",
  stationLayout: {
    manager: [-2.4, -0.6],
    browser: [-0.9, -1.3],
  },
  furniture: [{ id: "f_001", type: "desk", x: 0, z: 0 }],
  cameraMode: "rear",
  behaviorMode: "balanced",
};

describe("AtelierPreview", () => {
  afterEach(() => {
    cleanup();
    mockAtelierStage.mockClear();
  });

  it("renders the four toolbar controls by accessible name", () => {
    render(
      <AtelierPreview
        officeState={fakeOfficeState}
        activeProjectId="proj-1"
        selectedId="manager"
      />,
    );

    expect(screen.getByRole("button", { name: "workshop.addFurniture" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "workshop.camera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "workshop.snap" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "workshop.resetLayout" })).toBeInTheDocument();
  });

  it("renders a station marker for the selected worker", () => {
    render(
      <AtelierPreview
        officeState={fakeOfficeState}
        activeProjectId="proj-1"
        selectedId="manager"
      />,
    );

    // The selected station should be highlighted — it gets a data attribute.
    // getAllByTestId handles potential StrictMode double-render.
    const markers = screen.getAllByTestId("station-marker-manager");
    expect(markers.length).toBeGreaterThan(0);
    // At least one should have aria-selected="true"
    expect(markers.some((m) => m.getAttribute("aria-selected") === "true")).toBe(true);
  });

  it("renders station markers as mascot rigs with role props", () => {
    render(
      <AtelierPreview
        officeState={fakeOfficeState}
        activeProjectId="proj-1"
        selectedId="manager"
      />,
    );

    expect(screen.getAllByRole("img", { name: "mascot.stationAccessibleName" }).length).toBeGreaterThanOrEqual(6);
    expect(screen.getByTestId("mascot-role-prop-manager")).toBeInTheDocument();
    expect(screen.getByTestId("mascot-role-prop-terminal")).toBeInTheDocument();
  });

  it("renders the AtelierStage backdrop", () => {
    render(
      <AtelierPreview
        officeState={fakeOfficeState}
        activeProjectId="proj-1"
        selectedId={null}
      />,
    );
    const stages = screen.getAllByTestId("stub-stage");
    expect(stages.length).toBeGreaterThan(0);
  });

  it("uses the 3D stage as room backdrop only so mascot workers are not duplicated", () => {
    render(
      <AtelierPreview
        officeState={fakeOfficeState}
        activeProjectId="proj-1"
        selectedId={null}
      />,
    );

    expect(mockAtelierStage).toHaveBeenCalledWith(expect.objectContaining({ compact: false, showWorkers: false }));
  });

  it("renders without crashing when officeState is null (no render loop)", () => {
    // Without stable EMPTY_FURNITURE / EMPTY_LAYOUT constants the ?? fallbacks
    // create new array/object references on every render, causing the useEffect
    // deps [layout, furniture] to change each render → setPositions re-renders →
    // infinite loop → React throws "Maximum update depth exceeded".
    // With the fix the refs are stable and this render completes cleanly.
    render(
      <AtelierPreview
        officeState={null}
        activeProjectId="proj-1"
        selectedId={null}
      />,
    );

    // Use getAllByRole to handle StrictMode double-render; just assert at least one exists.
    expect(screen.getAllByRole("button", { name: "workshop.addFurniture" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "workshop.camera" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "workshop.snap" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "workshop.resetLayout" }).length).toBeGreaterThan(0);
  });
});
