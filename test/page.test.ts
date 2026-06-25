import { afterEach, describe, expect, it, vi } from "vitest";
import { pageCommand } from "../src/commands/page.js";
import * as notion from "../src/notion.js";
import { AxiError } from "../src/errors.js";

vi.mock("../src/notion.js", async (orig) => {
  const actual = await orig<typeof import("../src/notion.js")>();
  return { ...actual, getClient: vi.fn() };
});

function setClient(client: Record<string, unknown>) {
  vi.mocked(notion.getClient).mockReturnValue(client as never);
  return client;
}

afterEach(() => vi.clearAllMocks());

describe("page routing", () => {
  it("throws on a missing or unknown subcommand", async () => {
    await expect(pageCommand([])).rejects.toBeInstanceOf(AxiError);
    await expect(pageCommand(["frob"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("page view", () => {
  it("requires an id", async () => {
    await expect(pageCommand(["view"])).rejects.toBeInstanceOf(AxiError);
  });

  it("shows properties (dropping empties) and truncates a long body", async () => {
    const long = "x".repeat(2000);
    setClient({
      pages: {
        retrieve: vi.fn().mockResolvedValue({
          id: "p1",
          url: "https://n/p1",
          last_edited_time: "2026-06-20T0:0:0Z",
          properties: {
            Title: { type: "title", title: [{ plain_text: "Hi" }] },
            Status: { type: "select", select: { name: "Active" } },
            Empty: { type: "rich_text", rich_text: [] },
          },
        }),
        retrieveMarkdown: vi
          .fn()
          .mockResolvedValue({ markdown: long, truncated: false }),
      },
    });
    const out: any = await pageCommand(["view", "p1"]);
    expect(out.page).toEqual({
      id: "p1",
      title: "Hi",
      url: "https://n/p1",
      edited: "2026-06-20",
    });
    expect(out.properties.map((p: any) => p.name)).toEqual(["Title", "Status"]);
    expect(out.body_truncated).toBe(true);
    expect(out.body_chars_shown).toBe(1500);
    expect(out.body_chars_total).toBe(2000);
    expect(out.help[0]).toContain("--full");
  });

  it("returns the whole body with --full and no help", async () => {
    setClient({
      pages: {
        retrieve: vi.fn().mockResolvedValue({ id: "p1", properties: {} }),
        retrieveMarkdown: vi
          .fn()
          .mockResolvedValue({ markdown: "short", truncated: false }),
      },
    });
    const out: any = await pageCommand(["view", "p1", "--full"]);
    expect(out.body).toBe("short");
    expect(out.body_truncated).toBeUndefined();
    expect(out.help).toBeUndefined();
  });

  it("handles an empty body and an API-truncated flag", async () => {
    setClient({
      pages: {
        retrieve: vi.fn().mockResolvedValue({ id: "p1", properties: {} }),
        retrieveMarkdown: vi
          .fn()
          .mockResolvedValue({ markdown: "", truncated: true }),
      },
    });
    const out: any = await pageCommand(["view", "p1"]);
    expect(out.body).toBe("(no text content)");
    expect(out.body_truncated).toBe(true);
  });
});

describe("page create", () => {
  it("requires --parent and --title", async () => {
    setClient({});
    await expect(
      pageCommand(["create", "--title", "t"]),
    ).rejects.toBeInstanceOf(AxiError);
    await expect(
      pageCommand(["create", "--parent", "p"]),
    ).rejects.toBeInstanceOf(AxiError);
  });

  it("creates under a page parent and appends content", async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ id: "new1", url: "https://n/new1" });
    const updateMarkdown = vi.fn().mockResolvedValue({});
    setClient({ pages: { create, updateMarkdown } });
    const out: any = await pageCommand([
      "create",
      "--parent",
      "par1",
      "--title",
      "Notes",
      "--content",
      "# Agenda",
    ]);
    expect(create.mock.calls[0][0].parent).toEqual({ page_id: "par1" });
    expect(create.mock.calls[0][0].properties.title.title[0].text.content).toBe(
      "Notes",
    );
    expect(updateMarkdown).toHaveBeenCalledOnce();
    expect(out.created).toBe("new1");
  });

  it("creates a row in a database using its title property", async () => {
    const create = vi.fn().mockResolvedValue({ id: "row1", url: "u" });
    setClient({
      dataSources: {
        retrieve: vi.fn().mockResolvedValue({
          properties: { Task: { type: "title" }, Done: { type: "checkbox" } },
        }),
      },
      pages: { create },
    });
    await pageCommand(["create", "--parent", "ds1", "--title", "Ship", "--db"]);
    expect(create.mock.calls[0][0].parent).toEqual({ data_source_id: "ds1" });
    expect(create.mock.calls[0][0].properties.Task.title[0].text.content).toBe(
      "Ship",
    );
  });

  it("falls back to a 'Name' title property when the schema has none", async () => {
    const create = vi.fn().mockResolvedValue({ id: "row2", url: "u" });
    setClient({
      dataSources: { retrieve: vi.fn().mockResolvedValue({ properties: {} }) },
      pages: { create },
    });
    await pageCommand(["create", "--parent", "ds2", "--title", "X", "--db"]);
    expect(create.mock.calls[0][0].properties.Name).toBeDefined();
  });
});

describe("page update", () => {
  it("requires an id and an action", async () => {
    setClient({});
    await expect(pageCommand(["update"])).rejects.toBeInstanceOf(AxiError);
    await expect(pageCommand(["update", "p1"])).rejects.toBeInstanceOf(
      AxiError,
    );
  });

  it("appends markdown", async () => {
    const updateMarkdown = vi.fn().mockResolvedValue({});
    setClient({ pages: { updateMarkdown } });
    const out: any = await pageCommand(["update", "p1", "--append", "more"]);
    expect(updateMarkdown.mock.calls[0][0].type).toBe("insert_content");
    expect(out.mode).toBe("append");
  });

  it("replaces content", async () => {
    const updateMarkdown = vi.fn().mockResolvedValue({});
    setClient({ pages: { updateMarkdown } });
    const out: any = await pageCommand(["update", "p1", "--replace", "fresh"]);
    expect(updateMarkdown.mock.calls[0][0].type).toBe("replace_content");
    expect(out.mode).toBe("replace");
  });
});
