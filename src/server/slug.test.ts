import { describe, it, expect } from "vitest";
import { slugFromText } from "./slug";

describe("slugFromText", () => {
  it("lowercases the input", () => {
    expect(slugFromText("Heavy Rotation")).toBe("heavy-rotation");
  });

  it("replaces runs of non-alphanumeric characters with a single hyphen", () => {
    expect(slugFromText("House & Techno: Night One")).toBe(
      "house-techno-night-one",
    );
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugFromText("  !!!Breakz!!!  ")).toBe("breakz");
  });

  it("truncates to 40 characters", () => {
    const long = "A".repeat(120);
    expect(slugFromText(long)).toHaveLength(40);
    expect(slugFromText(long)).toBe("a".repeat(40));
  });

  it("returns an empty string for input with no alphanumerics", () => {
    expect(slugFromText("!!!   ???")).toBe("");
  });

  it("returns an empty string for empty input", () => {
    expect(slugFromText("")).toBe("");
  });

  it("preserves digits", () => {
    expect(slugFromText("808 State 2026")).toBe("808-state-2026");
  });

  it("produces a stable key for a representative event title", () => {
    // Pinning the exact output used by refresh dedup / approval reconciliation.
    expect(slugFromText("Sound City Opening Night")).toBe(
      "sound-city-opening-night",
    );
  });
});
