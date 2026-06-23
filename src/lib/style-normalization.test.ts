import { normalizeStyleTags } from "./style-normalization";

describe("normalizeStyleTags", () => {
  it("maps common techno sub-genre variants to canonical tags", () => {
    expect(
      normalizeStyleTags([
        "Melodic Techno",
        "groovy-techno",
        "hard techno",
        "Trance",
        "techno trance",
      ]),
    ).toEqual(["melodic", "groovy", "hard", "trance"]);
  });

  it("preserves unknown styles and removes canonical duplicates without broad matching", () => {
    expect(
      normalizeStyleTags([
        "hard house",
        "Hard Techno",
        "hard",
        "  leftfield bass  ",
        "LEFTFIELD BASS",
      ]),
    ).toEqual(["hard house", "hard", "leftfield bass"]);
  });
});
