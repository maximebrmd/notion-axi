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
  return { ...actual, getClient: vi.fn() };
});

import { isNotionClientError } from "@notionhq/client";
import { dbCommand } from "../src/commands/db.js";
import * as notion from "../src/notion.js";
import { AxiError } from "../src/errors.js";

function setClient(client: Record<string, unknown>) {
  vi.mocked(notion.getClient).mockReturnValue(client as never);
}

const schema = {
  Name: { type: "title" },
  A: { type: "rich_text" },
  B: { type: "number" },
  C: { type: "select" },
  D: { type: "checkbox" },
};

const row = (id: string) => ({
  id,
  properties: {
    Name: { type: "title", title: [{ plain_text: id }] },
    A: { type: "rich_text", rich_text: [{ plain_text: "a" }] },
    B: { type: "number", number: 1 },
    C: { type: "select", select: { name: "c" } },
    D: { type: "checkbox", checkbox: true },
  },
});

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(isNotionClientError).mockReturnValue(false);
});

describe("db routing", () => {
  it("throws on missing or unknown subcommand", async () => {
    await expect(dbCommand([])).rejects.toBeInstanceOf(AxiError);
    await expect(dbCommand(["frob"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("db view", () => {
  it("requires an id", async () => {
    await expect(dbCommand(["view"])).rejects.toBeInstanceOf(AxiError);
  });

  it("resolves a database to its first data source and lists the schema", async () => {
    setClient({
      databases: {
        retrieve: vi.fn().mockResolvedValue({
          id: "db1",
          url: "https://n/db1",
          data_sources: [{ id: "ds1", name: "Default" }],
          properties: {
            Title: { type: "title", title: [{ plain_text: "Tasks" }] },
          },
        }),
      },
      dataSources: {
        retrieve: vi.fn().mockResolvedValue({ properties: schema }),
      },
    });
    const out: any = await dbCommand(["view", "db1"]);
    expect(out.database).toEqual({
      id: "db1",
      title: "Tasks",
      url: "https://n/db1",
    });
    expect(out.data_sources).toEqual([{ id: "ds1", name: "Default" }]);
    expect(out.properties).toBe(5);
  });

  it("accepts an explicit --source and labels it default", async () => {
    setClient({
      dataSources: {
        retrieve: vi.fn().mockResolvedValue({
          properties: schema,
          title: [{ plain_text: "T" }],
        }),
      },
    });
    const out: any = await dbCommand(["view", "anything", "--source", "ds9"]);
    expect(out.data_sources).toEqual([{ id: "ds9", name: "(default)" }]);
    expect(out.database.title).toBe("T");
  });

  it("falls back to treating the id as a data source on a Notion error", async () => {
    vi.mocked(isNotionClientError).mockReturnValue(true);
    setClient({
      databases: { retrieve: vi.fn().mockRejectedValue(new Error("not a db")) },
      dataSources: {
        retrieve: vi.fn().mockResolvedValue({ properties: schema }),
      },
    });
    const out: any = await dbCommand(["view", "ds-direct"]);
    expect(out.data_sources).toEqual([{ id: "ds-direct", name: "(default)" }]);
  });

  it("propagates a non-Notion error from resolve (e.g. no data sources)", async () => {
    setClient({
      databases: {
        retrieve: vi.fn().mockResolvedValue({ id: "db", data_sources: [] }),
      },
    });
    await expect(dbCommand(["view", "db"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("db query", () => {
  it("requires an id", async () => {
    await expect(dbCommand(["query"])).rejects.toBeInstanceOf(AxiError);
  });

  it("returns rows with title + first 3 columns by default", async () => {
    setClient({
      databases: {
        retrieve: vi.fn().mockResolvedValue({
          id: "db1",
          data_sources: [{ id: "ds1", name: "d" }],
        }),
      },
      dataSources: {
        retrieve: vi.fn().mockResolvedValue({ properties: schema }),
        query: vi.fn().mockResolvedValue({
          results: [row("r1"), row("r2")],
          has_more: true,
        }),
      },
    });
    const out: any = await dbCommand(["query", "db1", "--limit", "10"]);
    expect(out.count).toBe(2);
    expect(Object.keys(out.rows[0])).toEqual(["id", "title", "A", "B", "C"]);
    expect(out.columns_shown).toBe(4);
    expect(out.help.some((h: string) => h.includes("--full"))).toBe(true);
    expect(out.help.some((h: string) => h.includes("--limit"))).toBe(true);
  });

  it("includes every column with --full", async () => {
    setClient({
      databases: {
        retrieve: vi.fn().mockResolvedValue({
          id: "db1",
          data_sources: [{ id: "ds1", name: "d" }],
        }),
      },
      dataSources: {
        retrieve: vi.fn().mockResolvedValue({ properties: schema }),
        query: vi
          .fn()
          .mockResolvedValue({ results: [row("r1")], has_more: false }),
      },
    });
    const out: any = await dbCommand(["query", "db1", "--full"]);
    expect(Object.keys(out.rows[0])).toEqual([
      "id",
      "title",
      "A",
      "B",
      "C",
      "D",
    ]);
    expect(out.help.some((h: string) => h.includes("--full"))).toBe(false);
  });

  it("gives a definitive empty state", async () => {
    setClient({
      databases: {
        retrieve: vi.fn().mockResolvedValue({
          id: "db1",
          data_sources: [{ id: "ds1", name: "d" }],
        }),
      },
      dataSources: {
        retrieve: vi.fn().mockResolvedValue({ properties: schema }),
        query: vi.fn().mockResolvedValue({ results: [], has_more: false }),
      },
    });
    const out: any = await dbCommand(["query", "db1"]);
    expect(out.rows).toEqual([]);
    expect(out.result).toContain("0 rows");
  });

  it("handles a schema with no title property", async () => {
    setClient({
      dataSources: {
        retrieve: vi
          .fn()
          .mockResolvedValue({ properties: { A: { type: "number" } } }),
        query: vi.fn().mockResolvedValue({
          results: [
            { id: "r1", properties: { A: { type: "number", number: 9 } } },
          ],
          has_more: false,
        }),
      },
    });
    const out: any = await dbCommand(["query", "ds1", "--source", "ds1"]);
    expect(out.rows[0]).toEqual({ id: "r1", A: 9 });
    expect(out.columns_shown).toBe(1);
  });
});

describe("db create", () => {
  it("builds a schema and auto-adds a title property", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "db1",
      url: "u",
      data_sources: [{ id: "ds1" }],
    });
    setClient({ databases: { create } });
    const out: any = await dbCommand([
      "create",
      "--parent",
      "pg",
      "--title",
      "Tasks",
      "--prop",
      "Stage:select",
    ]);
    const props = create.mock.calls[0][0].initial_data_source.properties;
    expect(props.Stage).toEqual({ select: {} });
    expect(props.Name).toEqual({ title: {} });
    expect(out.created).toBe("db1");
    expect(out.data_source).toBe("ds1");
  });

  it("uses a provided title prop instead of auto-adding one", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ id: "db1", data_sources: [{ id: "ds1" }] });
    setClient({ databases: { create } });
    await dbCommand([
      "create",
      "--parent",
      "pg",
      "--title",
      "T",
      "--prop",
      "Heading:title",
    ]);
    const props = create.mock.calls[0][0].initial_data_source.properties;
    expect(props.Heading).toEqual({ title: {} });
    expect(props.Name).toBeUndefined();
  });

  it("validates parent, title, prop format, and prop type", async () => {
    setClient({});
    await expect(dbCommand(["create", "--title", "T"])).rejects.toBeInstanceOf(
      AxiError,
    );
    await expect(
      dbCommand(["create", "--parent", "pg"]),
    ).rejects.toBeInstanceOf(AxiError);
    await expect(
      dbCommand(["create", "--parent", "pg", "--title", "T", "--prop", "bad"]),
    ).rejects.toBeInstanceOf(AxiError);
    await expect(
      dbCommand([
        "create",
        "--parent",
        "pg",
        "--title",
        "T",
        "--prop",
        "X:formula",
      ]),
    ).rejects.toBeInstanceOf(AxiError);
  });
});

describe("db edit", () => {
  it("adds and removes data-source properties", async () => {
    const update = vi.fn().mockResolvedValue({});
    setClient({
      databases: {
        retrieve: vi.fn().mockResolvedValue({
          id: "db1",
          data_sources: [{ id: "ds1", name: "d" }],
        }),
      },
      dataSources: { update },
    });
    const out: any = await dbCommand([
      "edit",
      "db1",
      "--add",
      "Priority:select",
      "--remove",
      "Old",
    ]);
    const props = update.mock.calls[0][0].properties;
    expect(props.Priority).toEqual({ select: {} });
    expect(props.Old).toBeNull();
    expect(out.added).toEqual(["Priority"]);
    expect(out.removed).toEqual(["Old"]);
  });

  it("requires an id and at least one change", async () => {
    setClient({});
    await expect(dbCommand(["edit"])).rejects.toBeInstanceOf(AxiError);
    await expect(dbCommand(["edit", "db1"])).rejects.toBeInstanceOf(AxiError);
  });
});
