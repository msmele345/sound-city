import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  loadEnvFile(".env.local");
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
