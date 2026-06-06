import type { ParserStrategy } from "./types";

export function validateParserStrategy(strategy: ParserStrategy): void {
  if (
    strategy === "dev-static" &&
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error(
      "dev-static parser strategy is not allowed in production",
    );
  }
}
