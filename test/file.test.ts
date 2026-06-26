import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileCommand } from "../src/commands/file.js";
import * as notion from "../src/notion.js";
import { AxiError } from "../src/errors.js";

vi.mock("../src/notion.js", async (orig) => {
  const actual = await orig<typeof import("../src/notion.js")>();
  return { ...actual, getClient: vi.fn() };
});

function setClient(client: Record<string, unknown>) {
  vi.mocked(notion.getClient).mockReturnValue(client as never);
}

function tmpFile(name: string, contents = "hello") {
  const dir = mkdtempSync(join(tmpdir(), "naxi-"));
  const path = join(dir, name);
  writeFileSync(path, contents);
  return { dir, path };
}

afterEach(() => vi.clearAllMocks());

describe("file routing", () => {
  it("throws on a missing or unknown subcommand", async () => {
    setClient({});
    await expect(fileCommand([])).rejects.toBeInstanceOf(AxiError);
    await expect(fileCommand(["frob"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("file upload", () => {
  it("creates an upload, sends the bytes, and reports the result", async () => {
    const { dir, path } = tmpFile("note.txt", "hello world");
    const create = vi
      .fn()
      .mockResolvedValue({ id: "fu1", content_type: "text/plain" });
    const send = vi.fn().mockResolvedValue({});
    setClient({ fileUploads: { create, send } });
    const out: any = await fileCommand(["upload", path]);
    expect(create.mock.calls[0][0]).toMatchObject({
      mode: "single_part",
      filename: "note.txt",
    });
    expect(send.mock.calls[0][0].file_upload_id).toBe("fu1");
    // the sent blob carries the content type Notion recorded at create
    expect(send.mock.calls[0][0].file.data.type).toBe("text/plain");
    expect(out).toMatchObject({
      uploaded: "fu1",
      filename: "note.txt",
      bytes: 11,
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it("attaches the upload as a file block when --attach is given", async () => {
    const { dir, path } = tmpFile("d.png");
    const append = vi.fn().mockResolvedValue({});
    setClient({
      fileUploads: {
        create: vi.fn().mockResolvedValue({ id: "fu2" }),
        send: vi.fn().mockResolvedValue({}),
      },
      blocks: { children: { append } },
    });
    const out: any = await fileCommand(["upload", path, "--attach", "pg1"]);
    const block = append.mock.calls[0][0].children[0];
    expect(block).toEqual({
      type: "file",
      file: { type: "file_upload", file_upload: { id: "fu2" } },
    });
    expect(out.attached_to).toBe("pg1");
    rmSync(dir, { recursive: true, force: true });
  });

  it("honours --name override", async () => {
    const { dir, path } = tmpFile("orig.txt");
    const create = vi.fn().mockResolvedValue({ id: "fu3" });
    setClient({ fileUploads: { create, send: vi.fn().mockResolvedValue({}) } });
    await fileCommand(["upload", path, "--name", "renamed.txt"]);
    expect(create.mock.calls[0][0].filename).toBe("renamed.txt");
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects --attach and --name without a value", async () => {
    const { dir, path } = tmpFile("d.png");
    setClient({});
    await expect(
      fileCommand(["upload", path, "--attach"]),
    ).rejects.toBeInstanceOf(AxiError);
    await expect(
      fileCommand(["upload", path, "--name"]),
    ).rejects.toBeInstanceOf(AxiError);
    rmSync(dir, { recursive: true, force: true });
  });

  it("requires a path and rejects an unreadable file", async () => {
    setClient({});
    await expect(fileCommand(["upload"])).rejects.toBeInstanceOf(AxiError);
    await expect(
      fileCommand(["upload", "/no/such/file.bin"]),
    ).rejects.toBeInstanceOf(AxiError);
  });
});
