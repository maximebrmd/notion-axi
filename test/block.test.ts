import { afterEach, describe, expect, it, vi } from "vitest";
import { blockCommand } from "../src/commands/block.js";
import * as notion from "../src/notion.js";
import { AxiError } from "../src/errors.js";

vi.mock("../src/notion.js", async (orig) => {
  const actual = await orig<typeof import("../src/notion.js")>();
  return { ...actual, getClient: vi.fn() };
});

function setClient(client: Record<string, unknown>) {
  vi.mocked(notion.getClient).mockReturnValue(client as never);
}

afterEach(() => vi.clearAllMocks());

describe("block routing", () => {
  it("throws on a missing or unknown subcommand", async () => {
    setClient({});
    await expect(blockCommand([])).rejects.toBeInstanceOf(AxiError);
    await expect(blockCommand(["frob"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("block list", () => {
  it("lists child blocks with a text preview per type", async () => {
    setClient({
      blocks: {
        children: {
          list: vi.fn().mockResolvedValue({
            results: [
              {
                id: "b1",
                type: "paragraph",
                paragraph: { rich_text: [{ plain_text: "hello" }] },
              },
              { id: "b2", type: "bookmark", bookmark: { url: "https://x" } },
              { id: "b3", type: "divider", divider: {} },
            ],
          }),
        },
      },
    });
    const out: any = await blockCommand(["list", "p1"]);
    expect(out.blocks).toEqual([
      { id: "b1", type: "paragraph", text: "hello" },
      { id: "b2", type: "bookmark", text: "https://x" },
      { id: "b3", type: "divider", text: "" },
    ]);
    expect(out.count).toBe(3);
  });

  it("gives a definitive empty state and requires an id", async () => {
    setClient({
      blocks: { children: { list: vi.fn().mockResolvedValue({}) } },
    });
    expect((await blockCommand(["list", "p1"])).result).toContain(
      "0 child blocks",
    );
    setClient({});
    await expect(blockCommand(["list"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("block delete", () => {
  it("deletes a block", async () => {
    const del = vi.fn().mockResolvedValue({});
    setClient({ blocks: { delete: del } });
    const out: any = await blockCommand(["delete", "b1"]);
    expect(del.mock.calls[0][0]).toEqual({ block_id: "b1" });
    expect(out.deleted).toBe("b1");
  });

  it("requires an id", async () => {
    setClient({});
    await expect(blockCommand(["delete"])).rejects.toBeInstanceOf(AxiError);
  });
});
