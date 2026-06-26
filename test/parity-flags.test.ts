import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("@notionhq/client", () => ({
  isNotionClientError: vi.fn(() => false),
  APIErrorCode: {
    Unauthorized: "unauthorized",
    ObjectNotFound: "object_not_found",
    RestrictedResource: "restricted_resource",
  },
  Client: class {},
}));
vi.mock("../src/notion.js", async (orig) => {
  const actual = await orig<typeof import("../src/notion.js")>();
  return { ...actual, getClient: vi.fn() };
});

import * as notion from "../src/notion.js";
import { searchCommand } from "../src/commands/search.js";
import { dbCommand } from "../src/commands/db.js";
import { pageCommand } from "../src/commands/page.js";
import { AxiError } from "../src/errors.js";

const client = (c: Record<string, unknown>) =>
  vi.mocked(notion.getClient).mockReturnValue(c as never);
afterEach(() => vi.clearAllMocks());

describe("search --fields", () => {
  it("adds url to each result when requested", async () => {
    client({
      search: vi.fn().mockResolvedValue({
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
      }),
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

  it("selects only the requested columns, ignoring the title", async () => {
    client({
      dataSources: {
        retrieve: vi.fn().mockResolvedValue({ properties: schema }),
        query: vi.fn().mockResolvedValue({ results: [row], has_more: false }),
      },
    });
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
    client({
      dataSources: {
        retrieve: vi.fn().mockResolvedValue({ properties: schema }),
        query: vi.fn().mockResolvedValue({ results: [row], has_more: false }),
      },
    });
    await expect(
      dbCommand(["query", "x", "--source", "ds", "--fields", "Stage,Nope"]),
    ).rejects.toBeInstanceOf(AxiError);
  });

  it("pluralizes the error when several columns are unknown", async () => {
    client({
      dataSources: {
        retrieve: vi.fn().mockResolvedValue({ properties: schema }),
        query: vi.fn().mockResolvedValue({ results: [row], has_more: false }),
      },
    });
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
    const create = vi.fn().mockResolvedValue({ id: "n", url: "u" });
    const updateMarkdown = vi.fn().mockResolvedValue({});
    client({ pages: { create, updateMarkdown } });
    await pageCommand([
      "create",
      "--parent",
      "p",
      "--title",
      "T",
      "--content-file",
      file,
    ]);
    expect(updateMarkdown.mock.calls[0][0].insert_content.content).toBe(
      "# From file",
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it("update --append-file reads the body from disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "naxi-"));
    const file = join(dir, "x.md");
    writeFileSync(file, "appended");
    const updateMarkdown = vi.fn().mockResolvedValue({});
    client({ pages: { updateMarkdown } });
    const out: any = await pageCommand(["update", "p", "--append-file", file]);
    expect(updateMarkdown.mock.calls[0][0].insert_content.content).toBe(
      "appended",
    );
    expect(out.body).toBe("appended");
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects passing both inline and file", async () => {
    client({});
    await expect(
      pageCommand(["update", "p", "--append", "a", "--append-file", "f"]),
    ).rejects.toBeInstanceOf(AxiError);
  });

  it("rejects an unreadable file", async () => {
    client({});
    await expect(
      pageCommand(["update", "p", "--append-file", "/no/such/file.md"]),
    ).rejects.toBeInstanceOf(AxiError);
  });
});
