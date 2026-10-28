import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));
import { ntnApi } from "../src/ntn.js";
import { pageCommand } from "../src/commands/page.js";
const api = vi.mocked(ntnApi);
afterEach(() => vi.resetAllMocks());

describe("child-content deletion permission", () => {
  it("preserves children by default and forwards an explicit opt-in", async () => {
    api.mockResolvedValue({});
    await pageCommand(["update", "p", "--replace", "fresh"]);
    expect(api).toHaveBeenLastCalledWith("v1/pages/p/markdown", {
      method: "PATCH",
      body: {
        type: "replace_content",
        replace_content: { new_str: "fresh", allow_deleting_content: false },
      },
    });
    await pageCommand([
      "update",
      "p",
      "--allow-deleting-content",
      "--replace",
      "",
    ]);
    expect(api).toHaveBeenLastCalledWith("v1/pages/p/markdown", {
      method: "PATCH",
      body: {
        type: "replace_content",
        replace_content: { new_str: "", allow_deleting_content: true },
      },
    });
  });

  it("rejects conflicting actions, misspelled flags, and ineffective or valued permission before mutation", async () => {
    for (const args of [
      ["--replace", "x", "--append", "y"],
      ["--replace-file", "-", "--append-file", "-"],
      ["--replace", "x", "--allow-deleting-content=false"],
      ["--replace", "x", "--allow-deleting-contents"],
      ["--append", "x", "--allow-deleting-content"],
    ])
      await expect(pageCommand(["update", "p", ...args])).rejects.toThrow();
    expect(api).not.toHaveBeenCalled();
  });

  it("validates create content before creating a remote page", async () => {
    await expect(
      pageCommand([
        "create",
        "--parent",
        "p",
        "--title",
        "T",
        "--content-file",
        "/missing/body.md",
      ]),
    ).rejects.toThrow(/Cannot read/);
    expect(api).not.toHaveBeenCalled();
  });
});

describe("Markdown export", () => {
  it("writes exact Unicode Markdown, reports bytes, and protects existing files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "naxi-export-"));
    const path = join(dir, "notes.md");
    try {
      api.mockResolvedValue({ markdown: "# Héllo\n" });
      const out = await pageCommand(["export", "p", "--output", path]);
      expect(out).toMatchObject({
        exported: "p",
        output: path,
        bytes: Buffer.byteLength("# Héllo\n"),
        partial: false,
        unknown_block_ids: [],
      });
      expect(readFileSync(path, "utf8")).toBe("# Héllo\n");
      await expect(
        pageCommand(["export", "p", "--output", path]),
      ).rejects.toThrow(/Cannot write/);
      expect(readFileSync(path, "utf8")).toBe("# Héllo\n");
      api.mockResolvedValue({});
      await pageCommand(["export", "p", "--output", path, "--force"]);
      expect(readFileSync(path, "utf8")).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("discloses partial and unsupported blocks in export and view", async () => {
    const dir = mkdtempSync(join(tmpdir(), "naxi-partial-"));
    const path = join(dir, "partial.md");
    try {
      api.mockResolvedValue({
        markdown: "partial",
        truncated: true,
        unknown_block_ids: ["b1"],
      });
      const partial = await pageCommand(["export", "p", "--output", path]);
      expect(partial).toMatchObject({
        partial: true,
        unknown_block_ids: ["b1"],
      });
      expect(partial.help[0]).toContain("block list");
      const view: any = await pageCommand(["view", "p", "--full"]);
      expect(view.unknown_block_ids).toEqual(["b1"]);
      expect(view.help[0]).toContain("partial Markdown");
      api.mockResolvedValue({
        markdown: "unsupported",
        unknown_block_ids: ["b2"],
      });
      expect(
        await pageCommand(["export", "p", "--output", path, "--force"]),
      ).toMatchObject({ partial: true });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("requires an id and a destination", async () => {
    await expect(pageCommand(["export"])).rejects.toThrow(/required/);
    await expect(pageCommand(["export", "p"])).rejects.toThrow(/required/);
    await expect(pageCommand(["export", "--output", "out.md"])).rejects.toThrow(
      /required/,
    );
    expect(api).not.toHaveBeenCalled();
  });
});
