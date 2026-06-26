import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { searchCommand } from "../src/commands/search.js";
import { ntnApi } from "../src/ntn.js";
import { AxiError } from "../src/errors.js";
import { apiCall } from "./support.js";

const api = vi.mocked(ntnApi);
function setSearch(result: unknown) {
  api.mockResolvedValue(result as never);
}
afterEach(() => vi.clearAllMocks());

const page = (id: string) => ({
  id,
  object: "page",
  last_edited_time: "2026-06-20T0:0:0Z",
  properties: { Name: { type: "title", title: [{ plain_text: id }] } },
});
const ds = (id: string) => ({
  id,
  object: "data_source",
  last_edited_time: "2026-06-21T0:0:0Z",
  title: [{ plain_text: id }],
});

describe("searchCommand", () => {
  it("maps results and renames data_source → database", async () => {
    setSearch({ results: [page("p1"), ds("d1")], has_more: false });
    const out: any = await searchCommand(["roadmap"]);
    expect(out.results).toEqual([
      { id: "p1", title: "p1", type: "page", edited: "2026-06-20" },
      { id: "d1", title: "d1", type: "database", edited: "2026-06-21" },
    ]);
    expect(out.count).toBe(2);
    expect(out.help.some((h: string) => h.includes("--limit"))).toBe(false);
  });

  it("adds the raise-limit hint only when more pages exist and limit < 100", async () => {
    setSearch({ results: [page("p1")], has_more: true });
    const out: any = await searchCommand(["q", "--limit", "10"]);
    expect(out.help.some((h: string) => h.includes("--limit"))).toBe(true);
  });

  it("passes a page type filter", async () => {
    setSearch({ results: [], has_more: false });
    await searchCommand(["x", "--type", "page"]);
    expect(apiCall(api, "v1/search")?.[1].body).toMatchObject({
      filter: { property: "object", value: "page" },
    });
  });

  it("passes a database type filter via the db alias", async () => {
    setSearch({ results: [], has_more: false });
    await searchCommand(["x", "--type", "db"]);
    expect(apiCall(api, "v1/search")?.[1].body).toMatchObject({
      filter: { property: "object", value: "data_source" },
    });
  });

  it("rejects an unknown type", async () => {
    setSearch({ results: [], has_more: false });
    await expect(
      searchCommand(["x", "--type", "bogus"]),
    ).rejects.toBeInstanceOf(AxiError);
  });

  it("gives a definitive empty state with a query", async () => {
    setSearch({ results: [], has_more: false });
    const out: any = await searchCommand(["nothing", "--type", "page"]);
    expect(out.results).toEqual([]);
    expect(out.result).toContain('0 items match "nothing"');
  });

  it("gives a definitive empty state without a query", async () => {
    setSearch({ results: undefined, has_more: undefined });
    const out: any = await searchCommand([]);
    expect(out.result).toContain("0 items in this workspace");
  });
});
