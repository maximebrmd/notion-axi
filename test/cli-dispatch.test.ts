import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main } from "../src/cli.js";

// Exercises each command arrow in src/cli.ts's COMMANDS map. Without a token the
// data commands surface AUTH_REQUIRED; `setup` (no subcommand) fails validation
// before touching the filesystem — both prove the arrow was dispatched.
describe("command dispatch", () => {
  let token: string | undefined;
  let apiKey: string | undefined;

  beforeEach(() => {
    token = process.env.NOTION_TOKEN;
    apiKey = process.env.NOTION_API_KEY;
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_API_KEY;
    process.exitCode = undefined;
  });
  afterEach(() => {
    if (token !== undefined) process.env.NOTION_TOKEN = token;
    if (apiKey !== undefined) process.env.NOTION_API_KEY = apiKey;
    process.exitCode = undefined;
  });

  async function run(argv: string[]) {
    let out = "";
    await main({ argv, stdout: { write: (c: string) => ((out += c), true) } });
    return out;
  }

  it("routes page/db/users to their handlers (auth required without a token)", async () => {
    expect(await run(["page", "view", "x"])).toContain("AUTH_REQUIRED");
    expect(await run(["db", "query", "x"])).toContain("AUTH_REQUIRED");
    expect(await run(["users"])).toContain("AUTH_REQUIRED");
    expect(await run(["api", "users/me"])).toContain("AUTH_REQUIRED");
    expect(await run(["comments", "list", "x"])).toContain("AUTH_REQUIRED");
    expect(await run(["whoami"])).toContain("AUTH_REQUIRED");
  });

  it("routes setup to its handler (validation error, no filesystem writes)", async () => {
    expect(await run(["setup"])).toContain("Unknown setup command");
  });
});
