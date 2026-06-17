// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function Hello() {
  return <div data-testid="hello">偃师</div>;
}

describe("DOM test harness", () => {
  it("renders a component into jsdom", () => {
    render(<Hello />);
    expect(screen.getByTestId("hello")).toBeInTheDocument();
    expect(screen.getByTestId("hello")).toHaveTextContent("偃师");
  });
});
