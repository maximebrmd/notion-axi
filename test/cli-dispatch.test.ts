import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { main } from "../src/cli.js";
import { ntnApi } from "../src/ntn.js";
import { AxiError } from "../src/errors.js";

// Exercises each command arrow in src/cli.ts's COMMANDS map. With ntn rejecting,
// the data commands surface AUTH_REQUIRED; `setup` (no subcommand) fails
// validation before touching the filesystem — both prove the arrow was dispatched.
describe("command dispatch", () => {
  beforeEach(() => {
    process.exitCode = undefined;
    vi.mocked(ntnApi).mockRejectedValue(new AxiError("nope", "AUTH_REQUIRED"));
  });
  afterEach(() => {
    process.exitCode = undefined;
    vi.clearAllMocks();
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
    expect(await run(["block", "list", "x"])).toContain("AUTH_REQUIRED");
  });

  it("routes setup and file to their handlers (validation errors, no side effects)", async () => {
    expect(await run(["setup"])).toContain("Unknown setup command");
    expect(await run(["file"])).toContain("Missing file subcommand");
  });
});
