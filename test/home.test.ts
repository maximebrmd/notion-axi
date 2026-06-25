import { afterEach, describe, expect, it, vi } from "vitest";
import { homeCommand } from "../src/commands/home.js";
import * as notion from "../src/notion.js";

vi.mock("../src/notion.js", async (orig) => {
  const actual = await orig<typeof import("../src/notion.js")>();
  return { ...actual, getClient: vi.fn(), hasToken: vi.fn() };
});

afterEach(() => vi.clearAllMocks());

describe("homeCommand", () => {
  it("returns setup guidance when no token is present", async () => {
    vi.mocked(notion.hasToken).mockReturnValue(false);
    const out: any = await homeCommand();
    expect(out.status).toContain("NOTION_TOKEN is not set");
    expect(out.setup.length).toBe(3);
  });

  it("lists recently edited items when authenticated", async () => {
    vi.mocked(notion.hasToken).mockReturnValue(true);
    vi.mocked(notion.getClient).mockReturnValue({
      search: vi.fn().mockResolvedValue({
        results: [
          {
            id: "p1",
            object: "page",
            last_edited_time: "2026-06-20T0:0:0Z",
            properties: { N: { type: "title", title: [{ plain_text: "Pg" }] } },
          },
          {
            id: "d1",
            object: "data_source",
            last_edited_time: "2026-06-19T0:0:0Z",
            title: [{ plain_text: "DB" }],
          },
        ],
      }),
    } as never);
    const out: any = await homeCommand();
    expect(out.recent).toEqual([
      { id: "p1", title: "Pg", type: "page", edited: "2026-06-20" },
      { id: "d1", title: "DB", type: "database", edited: "2026-06-19" },
    ]);
    expect(out.count).toBe(2);
  });

  it("gives a definitive empty state when nothing is shared", async () => {
    vi.mocked(notion.hasToken).mockReturnValue(true);
    vi.mocked(notion.getClient).mockReturnValue({
      search: vi.fn().mockResolvedValue({ results: [] }),
    } as never);
    const out: any = await homeCommand();
    expect(out.recent).toEqual([]);
    expect(out.result).toContain("Nothing shared");
  });
});
