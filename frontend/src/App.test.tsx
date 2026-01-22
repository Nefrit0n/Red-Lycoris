import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders login screen", () => {
    render(<App />);
    expect(screen.getByText(/вход в систему/i)).toBeInTheDocument();
  });
});
