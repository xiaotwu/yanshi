// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub i18n so t() returns the key as a plain string.
vi.mock("../../i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

// Stub modal-stack so Modal's pushModal/releaseModal/isTopModal work in jsdom.
vi.mock("../../lib/modal-stack", () => {
  let stack: symbol[] = [];
  return {
    pushModal: () => {
      const token = Symbol("modal");
      stack.push(token);
      return token;
    },
    releaseModal: (token: symbol) => {
      stack = stack.filter((t) => t !== token);
    },
    isTopModal: (token: symbol) => stack.length > 0 && stack[stack.length - 1] === token,
  };
});

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

  it("pressing Escape calls onClose", () => {
    const onClose = vi.fn();
    render(<ForgeWorkerFlow onCreate={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the backdrop (modal-overlay) calls onClose", () => {
    const onClose = vi.fn();
    const { container } = render(<ForgeWorkerFlow onCreate={vi.fn()} onClose={onClose} />);
    const overlay = container.querySelector(".modal-overlay");
    expect(overlay).not.toBeNull();
    fireEvent.mouseDown(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking inside the dialog does NOT call onClose", () => {
    const onClose = vi.fn();
    render(<ForgeWorkerFlow onCreate={vi.fn()} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });
});
