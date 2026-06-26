import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { fileCommand } from "../src/commands/file.js";
import { ntnApi } from "../src/ntn.js";
import { AxiError } from "../src/errors.js";
import { apiCall, routeNtn } from "./support.js";

const api = vi.mocked(ntnApi);

function tmpFile(name: string, contents = "hello") {
  const dir = mkdtempSync(join(tmpdir(), "naxi-"));
  const path = join(dir, name);
  writeFileSync(path, contents);
  return { dir, path };
}

afterEach(() => vi.clearAllMocks());

describe("file routing", () => {
  it("throws on a missing or unknown subcommand", async () => {
    await expect(fileCommand([])).rejects.toBeInstanceOf(AxiError);
    await expect(fileCommand(["frob"])).rejects.toBeInstanceOf(AxiError);
  });
});

describe("file upload", () => {
  it("creates an upload, sends the bytes, and reports the result", async () => {
    const { dir, path } = tmpFile("note.txt", "hello world");
    routeNtn(api, [
      { path: "v1/file_uploads", method: "POST", res: { id: "fu1" } },
      { path: /\/send$/, method: "POST", res: {} },
    ]);
    const out: any = await fileCommand(["upload", path]);
    expect(apiCall(api, "v1/file_uploads", "POST")?.[1].body).toMatchObject({
      mode: "single_part",
      filename: "note.txt",
    });
    expect(apiCall(api, /\/send$/, "POST")?.[1].file).toBe(path);
    expect(out).toMatchObject({
      uploaded: "fu1",
      filename: "note.txt",
      bytes: 11,
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it("attaches the upload as a file block when --attach is given", async () => {
    const { dir, path } = tmpFile("d.png");
    routeNtn(api, [
      { path: "v1/file_uploads", method: "POST", res: { id: "fu2" } },
      { path: /\/send$/, method: "POST", res: {} },
      { path: /\/children$/, method: "PATCH", res: {} },
    ]);
    const out: any = await fileCommand(["upload", path, "--attach", "pg1"]);
    const block: any = apiCall(api, /\/children$/, "PATCH")?.[1].body
      .children[0];
    expect(block).toEqual({
      type: "file",
      file: { type: "file_upload", file_upload: { id: "fu2" } },
    });
    expect(out.attached_to).toBe("pg1");
    rmSync(dir, { recursive: true, force: true });
  });

  it("honours --name override", async () => {
    const { dir, path } = tmpFile("orig.txt");
    routeNtn(api, [
      { path: "v1/file_uploads", method: "POST", res: { id: "fu3" } },
      { path: /\/send$/, method: "POST", res: {} },
    ]);
    await fileCommand(["upload", path, "--name", "renamed.txt"]);
    expect(apiCall(api, "v1/file_uploads", "POST")?.[1].body).toMatchObject({
      filename: "renamed.txt",
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects --attach and --name without a value", async () => {
    const { dir, path } = tmpFile("d.png");
    await expect(
      fileCommand(["upload", path, "--attach"]),
    ).rejects.toBeInstanceOf(AxiError);
    await expect(
      fileCommand(["upload", path, "--name"]),
    ).rejects.toBeInstanceOf(AxiError);
    rmSync(dir, { recursive: true, force: true });
  });

  it("requires a path and rejects an unreadable file", async () => {
    await expect(fileCommand(["upload"])).rejects.toBeInstanceOf(AxiError);
    await expect(
      fileCommand(["upload", "/no/such/file.bin"]),
    ).rejects.toBeInstanceOf(AxiError);
  });
});
