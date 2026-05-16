import { render, screen, within } from "@testing-library/react";

import { DashboardShell } from "./dashboard-shell";

describe("DashboardShell", () => {
  it("presents the launch dashboard regions for discovery", () => {
    render(<DashboardShell />);

    expect(
      screen.getByRole("heading", { name: /sound city/i }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    expect(
      within(main).getByRole("heading", { name: /recommended tonight/i }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", { name: /latest events/i }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", { name: /artist showcase/i }),
    ).toBeInTheDocument();
    expect(
      within(main).getByRole("heading", { name: /venue signals/i }),
    ).toBeInTheDocument();
  });
});
