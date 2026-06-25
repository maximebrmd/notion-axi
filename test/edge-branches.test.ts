import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@notionhq/client", () => ({
  isNotionClientError: vi.fn(() => false),
  APIErrorCode: {
    Unauthorized: "unauthorized",
    ObjectNotFound: "object_not_found",
  },
  Client: class {},
}));
vi.mock("../src/notion.js", async (orig) => {
  const actual = await orig<typeof import("../src/notion.js")>();
  return { ...actual, getClient: vi.fn(), hasToken: vi.fn(() => true) };
});

import * as notion from "../src/notion.js";
import { searchCommand } from "../src/commands/search.js";
import { dbCommand } from "../src/commands/db.js";
import { pageCommand } from "../src/commands/page.js";
import { usersCommand } from "../src/commands/users.js";
import { homeCommand } from "../src/commands/home.js";
import { propertyValue } from "../src/format.js";
import { AxiError } from "../src/errors.js";

const client = (c: Record<string, unknown>) =>
  vi.mocked(notion.getClient).mockReturnValue(c as never);
afterEach(() => vi.clearAllMocks());

describe("propertyValue nullish fallbacks", () => {
  it("falls back when collection fields are absent", () => {
    expect(propertyValue({ type: "multi_select" })).toBe("");
    expect(propertyValue({ type: "people" })).toBe("");
    expect(propertyValue({ type: "rollup", rollup: {} })).toBeNull();
    expect(propertyValue({ type: "created_by", created_by: {} })).toBeNull();
    expect(
      propertyValue({ type: "last_edited_by", last_edited_by: {} }),
    ).toBeNull();
  });
});

describe("list commands with bare API responses", () => {
  it("search: non-empty result without has_more", async () => {
    client({
      search: vi
        .fn()
        .mockResolvedValue({ results: [{ id: "p", object: "page" }] }),
    });
    const out: any = await searchCommand([]);
    expect(out.has_more).toBe(false);
  });

  it("users: results undefined → empty, and non-empty without has_more", async () => {
    client({ users: { list: vi.fn().mockResolvedValue({}) } });
    expect((await usersCommand([])).result).toContain("0 users");
    client({
      users: { list: vi.fn().mockResolvedValue({ results: [{ id: "u" }] }) },
    });
    expect((await usersCommand([])).has_more).toBe(false);
  });

  it("home: results undefined → empty state", async () => {
    client({ search: vi.fn().mockResolvedValue({}) });
    expect((await homeCommand()).result).toContain("Nothing shared");
  });

  it("search: empty with a query but no type filter", async () => {
    client({ search: vi.fn().mockResolvedValue({ results: [] }) });
    const out: any = await searchCommand(["nothing"]);
    expect(out.result).toBe('0 items match "nothing"');
  });
});

describe("page with bare responses", () => {
  it("view tolerates missing properties and markdown", async () => {
    client({
      pages: {
        retrieve: vi.fn().mockResolvedValue({ id: "p" }),
        retrieveMarkdown: vi.fn().mockResolvedValue({}),
      },
    });
    const out: any = await pageCommand(["view", "p"]);
    expect(out.properties).toEqual([]);
    expect(out.body).toBe("(no text content)");
  });

  it("create --db tolerates a data source with no properties", async () => {
    const create = vi.fn().mockResolvedValue({ id: "row", url: "u" });
    client({
      dataSources: { retrieve: vi.fn().mockResolvedValue({}) },
      pages: { create },
    });
    await pageCommand(["create", "--parent", "ds", "--title", "X", "--db"]);
    expect(create.mock.calls[0][0].properties.Name).toBeDefined();
  });
});

describe("db with bare responses", () => {
  it("view: id with no data_sources field rejects", async () => {
    client({
      databases: { retrieve: vi.fn().mockResolvedValue({ id: "db" }) },
    });
    await expect(dbCommand(["view", "db"])).rejects.toBeInstanceOf(AxiError);
  });

  it("view: data source with no properties/title/url → untitled", async () => {
    client({ dataSources: { retrieve: vi.fn().mockResolvedValue({}) } });
    const out: any = await dbCommand(["view", "x", "--source", "ds"]);
    expect(out.database.title).toBe("(untitled)");
    expect(out.schema).toEqual([]);
  });

  it("query: undefined properties and results → empty", async () => {
    client({
      dataSources: {
        retrieve: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockResolvedValue({}),
      },
    });
    expect(
      (await dbCommand(["query", "x", "--source", "ds"])).result,
    ).toContain("0 rows");
  });

  it("query: non-empty result without has_more", async () => {
    client({
      dataSources: {
        retrieve: vi
          .fn()
          .mockResolvedValue({ properties: { Name: { type: "title" } } }),
        query: vi.fn().mockResolvedValue({
          results: [
            { id: "r", properties: { Name: { type: "title", title: [] } } },
          ],
        }),
      },
    });
    const out: any = await dbCommand(["query", "x", "--source", "ds"]);
    expect(out.has_more).toBe(false);
    expect(out.rows[0]).toEqual({ id: "r", title: "" });
  });
});
