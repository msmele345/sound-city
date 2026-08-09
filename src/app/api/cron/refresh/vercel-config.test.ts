import { readFileSync } from "node:fs";
import { join } from "node:path";

const vercelConfig = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
) as {
  crons?: Array<{ path: string; schedule: string }>;
};

describe("scheduled refresh deployment", () => {
  it("invokes the protected refresh route once daily in UTC", () => {
    expect(vercelConfig.crons).toEqual([
      {
        path: "/api/cron/refresh",
        schedule: "0 0 * * *",
      },
    ]);
  });
});
