import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateParserStrategy } from "../operations";

describe("dev-static parser strategy gate", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows dev-static when VERCEL_ENV is not production", () => {
    delete process.env.VERCEL_ENV;
    expect(() => validateParserStrategy("dev-static")).not.toThrow();
  });

  it("allows dev-static when VERCEL_ENV is development", () => {
    process.env.VERCEL_ENV = "development";
    expect(() => validateParserStrategy("dev-static")).not.toThrow();
  });

  it("allows dev-static when VERCEL_ENV is preview", () => {
    process.env.VERCEL_ENV = "preview";
    expect(() => validateParserStrategy("dev-static")).not.toThrow();
  });

  it("rejects dev-static when VERCEL_ENV is production", () => {
    process.env.VERCEL_ENV = "production";
    expect(() => validateParserStrategy("dev-static")).toThrow(
      "dev-static parser strategy is not allowed in production",
    );
  });

  it("allows real parser strategies in production", () => {
    process.env.VERCEL_ENV = "production";
    expect(() => validateParserStrategy("venue-calendar")).not.toThrow();
    expect(() => validateParserStrategy("artist-social")).not.toThrow();
    expect(() => validateParserStrategy("resident-advisor")).not.toThrow();
  });
});
