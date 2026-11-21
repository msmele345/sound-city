import { render, screen } from "@testing-library/react";

import { SourceTrustLine } from "./source-trust-line";

const source = {
  title: "Resident Advisor listing",
  url: "https://ra.co/events/1",
  lastVerifiedAt: "2026-05-15",
};

describe("source trust line", () => {
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
