import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders findings list", () => {
    render(<App />);
    expect(screen.getByText(/список находок/i)).toBeInTheDocument();
  });
});
