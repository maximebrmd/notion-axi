import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { blockCommand } from "../src/commands/block.js";
import { ntnApi } from "../src/ntn.js";
import { AxiError } from "../src/errors.js";
import { apiCall } from "./support.js";

const api = vi.mocked(ntnApi);
afterEach(() => vi.clearAllMocks());

describe("block routing", () => {
  it("throws on a missing or unknown subcommand", async () => {
    await expect(blockCommand([])).rejects.toBeInstanceOf(AxiError);
    await expect(blockCommand(["frob"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("block list", () => {
  it("lists child blocks with a text preview per type", async () => {
    api.mockResolvedValue({
      results: [
        {
          id: "b1",
          type: "paragraph",
          paragraph: { rich_text: [{ plain_text: "hello" }] },
        },
        { id: "b2", type: "bookmark", bookmark: { url: "https://x" } },
        { id: "b3", type: "divider", divider: {} },
      ],
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
    api.mockResolvedValue({});
    expect((await blockCommand(["list", "p1"])).result).toContain(
      "0 child blocks",
    );
    await expect(blockCommand(["list"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("block delete", () => {
  it("deletes a block", async () => {
    api.mockResolvedValue({});
    const out: any = await blockCommand(["delete", "b1"]);
    expect(apiCall(api, "v1/blocks/b1", "DELETE")).toBeDefined();
    expect(out.deleted).toBe("b1");
  });

  it("requires an id", async () => {
    await expect(blockCommand(["delete"])).rejects.toBeInstanceOf(AxiError);
  });
});
