import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));
import { ntnApi } from "../src/ntn.js";
import { fileCommand } from "../src/commands/file.js";
const api = vi.mocked(ntnApi);
afterEach(() => vi.resetAllMocks());
const upload = {
  id: "f1",
  filename: "report.pdf",
  status: "pending",
  expiry_time: "2026-10-28T12:00:00Z",
  content_type: "application/pdf",
  content_length: 42,
  extra: "raw",
};

describe("file listing and inspection", () => {
  it("filters and paginates server-side, returning a minimal schema and usable continuation", async () => {
    api.mockResolvedValue({
      results: [upload],
      has_more: true,
      next_cursor: "c2",
    });
    const out: any = await fileCommand([
      "list",
      "--limit",
      "5",
      "--cursor",
      "c1",
      "--status",
      "pending",
    ]);
    expect(api).toHaveBeenCalledWith("v1/file_uploads", {
      query: { page_size: 5, start_cursor: "c1", status: "pending" },
    });
    expect(out.files).toEqual([
      {
        id: "f1",
        filename: "report.pdf",
        status: "pending",
        expires: upload.expiry_time,
      },
    ]);
    expect(out.next_cursor).toBe("c2");
    expect(out.help[0]).toContain("--status pending --cursor c2");
    api.mockResolvedValue({
      results: [upload],
      has_more: true,
      next_cursor: "c3",
    });
    expect((await fileCommand(["list"])).help[0]).toContain(
      "--limit 10 --cursor c3",
    );
  });

  it("provides a definitive empty state and full upload fields", async () => {
    api.mockResolvedValue({});
    expect(await fileCommand(["list"])).toMatchObject({
      total: 0,
      files: [],
      has_more: false,
      next_cursor: null,
    });
    api.mockResolvedValue({ results: [upload], has_more: false });
    expect((await fileCommand(["list", "--full"])).files).toEqual([upload]);
  });

  it("shows status, expiry and import failures with appropriate next steps", async () => {
    for (const status of ["pending", "uploaded", "failed", "expired"]) {
      api.mockResolvedValue({
        ...upload,
        status,
        file_import_result: { error: "details" },
      });
      const out: any = await fileCommand(["view", "f1"]);
      expect(out.file.status).toBe(status);
      expect(out.file.file_import_result).toEqual({ error: "details" });
      expect(out.file.extra).toBeUndefined();
      expect(out.help.length).toBe(1);
      if (status === "uploaded")
        expect(out.help[0]).toContain("file attach f1");
    }
    api.mockResolvedValue(upload);
    expect((await fileCommand(["view", "f1", "--full"])).file).toEqual(upload);
  });

  it("rejects malformed list flags and missing ids without requests", async () => {
    for (const args of [
      ["list", "--status", "no"],
      ["list", "--status"],
      ["list", "--cursor"],
      ["list", "--limit", "0"],
      ["view"],
      ["get", "f1"],
      ["status", "f1"],
      ["list", "--typo"],
    ]) {
      await expect(fileCommand(args)).rejects.toThrow();
    }
    expect(api).not.toHaveBeenCalled();
  });
});

describe("asynchronous URL imports", () => {
  it("imports a public URL without prematurely attaching it", async () => {
    api.mockResolvedValue(upload);
    const out: any = await fileCommand([
      "import",
      "https://example.com/report%20one.pdf?download=1",
    ]);
    expect(api).toHaveBeenCalledExactlyOnceWith("v1/file_uploads", {
      method: "POST",
      body: {
        mode: "external_url",
        external_url: "https://example.com/report%20one.pdf?download=1",
        filename: "report one.pdf",
      },
    });
    expect(out).toMatchObject({ imported: "f1", status: "pending" });
    expect(out.help[0]).toContain("file view f1");
    await fileCommand([
      "import",
      "https://example.com/",
      "--name",
      "custom.pdf",
    ]);
    expect(api).toHaveBeenLastCalledWith("v1/file_uploads", {
      method: "POST",
      body: {
        mode: "external_url",
        external_url: "https://example.com/",
        filename: "custom.pdf",
      },
    });
  });

  it("validates URLs and filenames before creating an upload", async () => {
    for (const args of [
      [],
      ["http://example.com/f.pdf"],
      ["https://user:pass@example.com/f.pdf"],
      ["https://user@example.com/f.pdf"],
      ["bad"],
      ["https://example.com/%zz"],
      ["https://example.com/"],
      ["https://example.com/f", "--name"],
    ]) {
      await expect(fileCommand(["import", ...args])).rejects.toThrow();
    }
    expect(api).not.toHaveBeenCalled();
  });
});

describe("attaching existing uploads", () => {
  it("checks readiness before appending a file block", async () => {
    api.mockResolvedValue({ ...upload, status: "uploaded" });
    const out: any = await fileCommand(["attach", "f1", "--to", "p1"]);
    expect(api).toHaveBeenLastCalledWith("v1/blocks/p1/children", {
      method: "PATCH",
      body: {
        children: [
          {
            type: "file",
            file: { type: "file_upload", file_upload: { id: "f1" } },
          },
        ],
      },
    });
    expect(out).toMatchObject({ attached: "f1", page: "p1" });
  });

  it("rejects an unfinished upload or a missing target", async () => {
    for (const args of [["attach"], ["attach", "f1"], ["attach", "--to", "p1"]])
      await expect(fileCommand(args)).rejects.toThrow(/required/);
    expect(api).not.toHaveBeenCalled();
    api.mockResolvedValue(upload);
    await expect(
      fileCommand(["attach", "f1", "--to", "p1"]),
    ).rejects.toMatchObject({ code: "UPLOAD_NOT_READY" });
    expect(api).toHaveBeenCalledTimes(1);
  });
});
