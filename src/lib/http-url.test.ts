import { isHttpUrl, parseHttpUrl } from "./http-url";

describe("http urls", () => {
  it("parses http and https and rejects anything else", () => {
    expect(parseHttpUrl("https://www.example.com/a")?.hostname).toBe("www.example.com");
    expect(parseHttpUrl("http://example.com")?.protocol).toBe("http:");
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("not a url")).toBeNull();
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});
