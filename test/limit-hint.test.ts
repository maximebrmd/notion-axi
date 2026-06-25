import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Notion network layer so we can drive `has_more` / `limit`
// combinations through the real command + render path without a token.
const search = vi.fn();
vi.mock("../src/notion.js", () => ({
  getClient: () => ({ search }),
  call: <T>(fn: () => Promise<T>) => fn(),
  hasToken: () => true,
}));

import { main } from "../src/cli.js";

function capture() {
  let out = "";
  return {
    stdout: { write: (c: string) => ((out += c), true) },
    read: () => out,
  };
}

const HINT = "Raise the cap with";

async function runSearch(limit: number, has_more: boolean) {
  search.mockResolvedValueOnce({
    results: [
      {
        id: "p1",
        object: "page",
        last_edited_time: "2026-06-25T00:00:00.000Z",
      },
    ],
    has_more,
  });
  const c = capture();
  await main({
    argv: ["search", "roadmap", "--limit", String(limit)],
    stdout: c.stdout,
  });
  return c.read();
}

describe("--limit hint off-by-one (search)", () => {
  beforeEach(() => {
    process.env.NOTION_TOKEN = "ntn_test";
    process.exitCode = undefined;
    search.mockReset();
  });
  afterEach(() => {
    delete process.env.NOTION_TOKEN;
    process.exitCode = undefined;
  });

  it("offers the hint below the 100-item page cap when more remain", async () => {
    expect(await runSearch(99, true)).toContain(HINT);
  });

  it("suppresses the hint at the 100-item cap (raising --limit wouldn't fetch more)", async () => {
    expect(await runSearch(100, true)).not.toContain(HINT);
  });

  it("never offers the hint when there is nothing more to fetch", async () => {
    expect(await runSearch(25, false)).not.toContain(HINT);
  });
});
