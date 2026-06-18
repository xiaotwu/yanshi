// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub i18n so t() returns the key as a plain string.
vi.mock("../../i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

import { ForgeWorkerFlow } from "./ForgeWorkerFlow";

describe("ForgeWorkerFlow", () => {
  afterEach(() => cleanup());

  it("create button is disabled when name is empty", () => {
    render(<ForgeWorkerFlow onCreate={vi.fn()} onClose={vi.fn()} />);
    const createBtn = screen.getByRole("button", { name: "workshop.forgeCreate" });
    expect(createBtn).toBeDisabled();
  });

  it("create button is enabled after typing a name", () => {
    render(<ForgeWorkerFlow onCreate={vi.fn()} onClose={vi.fn()} />);
    const nameInput = screen.getByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Scribe" } });
    const createBtn = screen.getByRole("button", { name: "workshop.forgeCreate" });
    expect(createBtn).not.toBeDisabled();
  });

  it("calls onCreate with the selected station and typed name on submit", () => {
    const onCreate = vi.fn();
    render(<ForgeWorkerFlow onCreate={onCreate} onClose={vi.fn()} />);

    // Choose the 'browser' station (second option in STATION_OPTIONS)
    const browserBtn = screen.getByRole("button", { name: "browser" });
    fireEvent.click(browserBtn);

    // Type a name
    const nameInput = screen.getByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Scout" } });

    // Click create
    const createBtn = screen.getByRole("button", { name: "workshop.forgeCreate" });
    fireEvent.click(createBtn);

    expect(onCreate).toHaveBeenCalledWith({ name: "Scout", station: "browser" });
  });

  it("calls onClose when cancel is clicked", () => {
    const onClose = vi.fn();
    render(<ForgeWorkerFlow onCreate={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "workshop.forgeCancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onCreate when name is empty and create is clicked", () => {
    const onCreate = vi.fn();
    render(<ForgeWorkerFlow onCreate={onCreate} onClose={vi.fn()} />);
    // The button is disabled so clicking won't do anything
    const createBtn = screen.getByRole("button", { name: "workshop.forgeCreate" });
    expect(createBtn).toBeDisabled();
    // Attempt fire anyway (disabled buttons don't fire click handlers)
    fireEvent.click(createBtn);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
