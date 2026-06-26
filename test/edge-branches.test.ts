import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { searchCommand } from "../src/commands/search.js";
import { dbCommand } from "../src/commands/db.js";
import { pageCommand } from "../src/commands/page.js";
import { usersCommand } from "../src/commands/users.js";
import { homeCommand } from "../src/commands/home.js";
import { ntnApi } from "../src/ntn.js";
import { propertyValue } from "../src/format.js";
import { AxiError } from "../src/errors.js";
import { apiCall, routeNtn } from "./support.js";

const api = vi.mocked(ntnApi);
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
    api.mockResolvedValue({ results: [{ id: "p", object: "page" }] });
    const out: any = await searchCommand([]);
    expect(out.has_more).toBe(false);
  });

  it("users: results undefined → empty, and non-empty without has_more", async () => {
    api.mockResolvedValueOnce({});
    expect((await usersCommand([])).result).toContain("0 users");
    api.mockResolvedValueOnce({ results: [{ id: "u" }] });
    expect((await usersCommand([])).has_more).toBe(false);
  });

  it("home: results undefined → empty state", async () => {
    api.mockResolvedValue({});
    expect((await homeCommand()).result).toContain("Nothing in this workspace");
  });

  it("search: empty with a query but no type filter", async () => {
    api.mockResolvedValue({ results: [] });
    const out: any = await searchCommand(["nothing"]);
    expect(out.result).toBe('0 items match "nothing"');
  });
});

describe("page with bare responses", () => {
  it("view tolerates missing properties and markdown", async () => {
    routeNtn(api, [
      { path: /\/markdown$/, res: {} },
      { path: /^v1\/pages\//, res: { id: "p" } },
    ]);
    const out: any = await pageCommand(["view", "p"]);
    expect(out.properties).toEqual([]);
    expect(out.body).toBe("(no text content)");
  });

  it("create --db tolerates a data source with no properties", async () => {
    routeNtn(api, [
      { path: /^v1\/data_sources\//, res: {} },
      { path: "v1/pages", method: "POST", res: { id: "row", url: "u" } },
    ]);
    await pageCommand(["create", "--parent", "ds", "--title", "X", "--db"]);
    expect(
      apiCall(api, "v1/pages", "POST")?.[1].body.properties.Name,
    ).toBeDefined();
  });
});

describe("db with bare responses", () => {
  it("view: id with no data_sources field rejects", async () => {
    routeNtn(api, [{ path: /^v1\/databases\//, res: { id: "db" } }]);
    await expect(dbCommand(["view", "db"])).rejects.toBeInstanceOf(AxiError);
  });

  it("view: data source with no properties/title/url → untitled", async () => {
    routeNtn(api, [{ path: /^v1\/data_sources\//, res: {} }]);
    const out: any = await dbCommand(["view", "x", "--source", "ds"]);
    expect(out.database.title).toBe("(untitled)");
    expect(out.schema).toEqual([]);
  });

  it("query: undefined properties and results → empty", async () => {
    routeNtn(api, [
      { path: /^v1\/data_sources\/[^/]+$/, res: {} },
      { path: /\/query$/, method: "POST", res: {} },
    ]);
    expect(
      (await dbCommand(["query", "x", "--source", "ds"])).result,
    ).toContain("0 rows");
  });

  it("query: non-empty result without has_more", async () => {
    routeNtn(api, [
      {
        path: /^v1\/data_sources\/[^/]+$/,
        res: { properties: { Name: { type: "title" } } },
      },
      {
        path: /\/query$/,
        method: "POST",
        res: {
          results: [
            { id: "r", properties: { Name: { type: "title", title: [] } } },
          ],
        },
      },
    ]);
    const out: any = await dbCommand(["query", "x", "--source", "ds"]);
    expect(out.has_more).toBe(false);
    expect(out.rows[0]).toEqual({ id: "r", title: "" });
  });
});
