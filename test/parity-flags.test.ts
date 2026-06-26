import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { searchCommand } from "../src/commands/search.js";
import { dbCommand } from "../src/commands/db.js";
import { pageCommand } from "../src/commands/page.js";
import { ntnApi } from "../src/ntn.js";
import { AxiError } from "../src/errors.js";
import { apiCall, routeNtn } from "./support.js";

const api = vi.mocked(ntnApi);
afterEach(() => vi.clearAllMocks());

describe("search --fields", () => {
  it("adds url to each result when requested", async () => {
    api.mockResolvedValue({
      results: [
        {
          id: "p",
          object: "page",
          url: "u",
          last_edited_time: "2026-06-20T0:0:0Z",
          properties: {},
        },
      ],
      has_more: false,
    });
    const out: any = await searchCommand(["x", "--fields", "url"]);
    expect(out.results[0].url).toBe("u");
  });
});

describe("db query --fields", () => {
  const schema = {
    Name: { type: "title" },
    Stage: { type: "status" },
    City: { type: "rich_text" },
  };
  const row = {
    id: "r",
    properties: {
      Name: { type: "title", title: [{ plain_text: "R" }] },
      Stage: { type: "status", status: { name: "Open" } },
      City: { type: "rich_text", rich_text: [] },
    },
  };
  const routes = [
    { path: /^v1\/data_sources\/[^/]+$/, res: { properties: schema } },
    {
      path: /\/query$/,
      method: "POST",
      res: { results: [row], has_more: false },
    },
  ];

  it("selects only the requested columns, ignoring the title", async () => {
    routeNtn(api, routes);
    const out: any = await dbCommand([
      "query",
      "x",
      "--source",
      "ds",
      "--fields",
      "Stage,Name",
    ]);
    expect(Object.keys(out.rows[0])).toEqual(["id", "title", "Stage"]);
    expect(out.help.some((h: string) => h.includes("--full"))).toBe(false);
  });

  it("errors when a requested column does not exist", async () => {
    routeNtn(api, routes);
    await expect(
      dbCommand(["query", "x", "--source", "ds", "--fields", "Stage,Nope"]),
    ).rejects.toBeInstanceOf(AxiError);
  });

  it("pluralizes the error when several columns are unknown", async () => {
    routeNtn(api, routes);
    await expect(
      dbCommand(["query", "x", "--source", "ds", "--fields", "Nope,Nada"]),
    ).rejects.toThrow(/Unknown columns: Nope, Nada/);
  });
});

describe("page content from a file", () => {
  it("create --content-file reads the body from disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "naxi-"));
    const file = join(dir, "body.md");
    writeFileSync(file, "# From file");
    routeNtn(api, [
      { path: "v1/pages", method: "POST", res: { id: "n", url: "u" } },
      { path: /\/markdown$/, method: "PATCH", res: {} },
    ]);
    await pageCommand([
      "create",
      "--parent",
      "p",
      "--title",
      "T",
      "--content-file",
      file,
    ]);
    expect(apiCall(api, /\/markdown$/, "PATCH")?.[1].body).toMatchObject({
      insert_content: { content: "# From file" },
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it("update --append-file reads the body from disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "naxi-"));
    const file = join(dir, "x.md");
    writeFileSync(file, "appended");
    routeNtn(api, [{ path: /\/markdown$/, method: "PATCH", res: {} }]);
    const out: any = await pageCommand(["update", "p", "--append-file", file]);
    expect(apiCall(api, /\/markdown$/, "PATCH")?.[1].body).toMatchObject({
      insert_content: { content: "appended" },
    });
    expect(out.body).toBe("appended");
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects passing both inline and file", async () => {
    await expect(
      pageCommand(["update", "p", "--append", "a", "--append-file", "f"]),
    ).rejects.toBeInstanceOf(AxiError);
  });

  it("rejects an unreadable file", async () => {
    await expect(
      pageCommand(["update", "p", "--append-file", "/no/such/file.md"]),
    ).rejects.toBeInstanceOf(AxiError);
  });
});
