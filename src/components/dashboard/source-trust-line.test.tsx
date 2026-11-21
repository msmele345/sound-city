import { render, screen } from "@testing-library/react";

import { SourceTrustLine } from "./source-trust-line";

const source = {
  title: "Resident Advisor listing",
  url: "https://ra.co/events/1",
  lastVerifiedAt: "2026-05-15",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-15T16:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("source trust line", () => {
  it("shows the verified year when it is not the current year", () => {
    render(
      <SourceTrustLine source={{ ...source, lastVerifiedAt: "2024-05-15" }} />,
    );

    expect(screen.getByText(/^verified may 15, 2024$/i)).toBeInTheDocument();
  });

  it("does not render an unnamed link for a blank title", () => {
    const { rerender } = render(
      <SourceTrustLine
        source={{ ...source, title: "   ", url: "https://www.example.com/events/1" }}
      />,
    );

    expect(screen.getByRole("link", { name: "example.com" })).toHaveAttribute(
      "href",
      "https://www.example.com/events/1",
    );
    expect(screen.queryByRole("link", { name: /^$/ })).not.toBeInTheDocument();

    rerender(
      <SourceTrustLine
        source={{ ...source, title: "   ", url: "javascript:alert(1)" }}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/^verified may 15$/i)).toBeInTheDocument();
  });

  it("renders a non-http source name as text", () => {
    render(
      <SourceTrustLine
        source={{ ...source, url: "javascript:alert(1)" }}
      />,
    );

    expect(screen.getByText("Resident Advisor")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /resident advisor/i })).not.toBeInTheDocument();
    expect(screen.getByText(/^verified may 15$/i)).toBeInTheDocument();
  });
});
