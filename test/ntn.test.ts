import { afterEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

import {
  buildApiArgs,
  mapNtnError,
  ntnApi,
  ntnNotInstalledError,
} from "../src/ntn.js";
import { AxiError } from "../src/errors.js";

interface ExecResult {
  error?: (Error & { code?: string | number }) | null;
  stdout?: string;
  stderr?: string;
}

/** Make the mocked execFile invoke its callback with a controlled result. */
function mockExec({ error = null, stdout = "", stderr = "" }: ExecResult) {
  const end = vi.fn();
  execFileMock.mockImplementation(
    (
      _file: string,
      _args: string[],
      _opts: unknown,
      cb: (e: unknown, o: string, s: string) => void,
    ) => {
      cb(error, stdout, stderr);
      return { stdin: { end } };
    },
  );
  return { end };
}

afterEach(() => vi.clearAllMocks());

describe("buildApiArgs", () => {
  it("builds a bare GET and strips a leading slash", () => {
    expect(buildApiArgs("/v1/users/me")).toEqual(["api", "v1/users/me"]);
  });

  it("adds method, query, file, and body in order", () => {
    expect(
      buildApiArgs("v1/blocks/b/children", {
        method: "patch",
        query: { page_size: 5, cursor: "c" },
        file: "/tmp/x.png",
        body: { a: 1 },
      }),
    ).toEqual([
      "api",
      "v1/blocks/b/children",
      "-X",
      "PATCH",
      "page_size==5",
      "cursor==c",
      "--file",
      "/tmp/x.png",
      "-d",
      '{"a":1}',
    ]);
  });
});

describe("ntnApi", () => {
  it("returns parsed JSON on success and passes built args to ntn", async () => {
    mockExec({ stdout: '{"id":"p1"}' });
    const out = await ntnApi("v1/pages/p1");
    expect(out).toEqual({ id: "p1" });
    expect(execFileMock.mock.calls[0][0]).toBe("ntn");
    expect(execFileMock.mock.calls[0][1]).toEqual(["api", "v1/pages/p1"]);
  });

  it("returns an empty object when stdout is blank", async () => {
    mockExec({ stdout: "   \n" });
    expect(await ntnApi("v1/blocks/b", { method: "DELETE" })).toEqual({});
  });

  it("throws NTN_NOT_INSTALLED when the binary is missing", async () => {
    mockExec({ error: Object.assign(new Error("nope"), { code: "ENOENT" }) });
    const err = await ntnApi("v1/search").catch((e) => e);
    expect(err).toBeInstanceOf(AxiError);
    expect(err.code).toBe("NTN_NOT_INSTALLED");
  });

  it("maps a non-zero exit through stderr", async () => {
    mockExec({
      error: Object.assign(new Error("x"), { code: 5 }),
      stderr: "error: Public API request failed (404 object_not_found)",
    });
    const err = await ntnApi("v1/pages/missing").catch((e) => e);
    expect(err.code).toBe("OBJECT_NOT_FOUND");
  });

  it("treats a non-numeric exit code as a generic failure", async () => {
    mockExec({
      error: Object.assign(new Error("killed"), { code: "SIGTERM" }),
      stderr: "error: something broke",
    });
    const err = await ntnApi("v1/search").catch((e) => e);
    expect(err).toBeInstanceOf(AxiError);
    expect(err.code).toBe("NTN_ERROR");
  });

  it("throws on unparseable output", async () => {
    mockExec({ stdout: "not json at all" });
    const err = await ntnApi("v1/search").catch((e) => e);
    expect(err.code).toBe("NTN_ERROR");
    expect(err.message).toMatch(/Unexpected ntn output/);
  });

  it("tolerates a child process with no stdin handle", async () => {
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _opts: unknown,
        cb: (e: unknown, o: string, s: string) => void,
      ) => {
        cb(null, "{}", "");
        return {};
      },
    );
    expect(await ntnApi("v1/search")).toEqual({});
  });

  it("defaults missing stdout/stderr to empty strings", async () => {
    execFileMock.mockImplementation(
      (
        _file: string,
        _args: string[],
        _opts: unknown,
        cb: (e: unknown, o?: string, s?: string) => void,
      ) => {
        cb(null, undefined, undefined);
        return { stdin: { end: vi.fn() } };
      },
    );
    expect(await ntnApi("v1/search")).toEqual({});
  });
});

describe("mapNtnError", () => {
  it("flags auth failures with login guidance", () => {
    const e = mapNtnError("error: API token is invalid.", 4);
    expect(e.code).toBe("AUTH_REQUIRED");
    expect(e.suggestions.join(" ")).toMatch(/ntn login/);
  });

  it("flags restricted resources", () => {
    expect(mapNtnError("error: restricted_resource", 3).code).toBe(
      "RESTRICTED_RESOURCE",
    );
  });

  it("flags not-found and validation errors", () => {
    expect(mapNtnError("error: object_not_found", 1).code).toBe(
      "OBJECT_NOT_FOUND",
    );
    expect(mapNtnError("error: validation_error: bad", 1).code).toBe(
      "VALIDATION_ERROR",
    );
  });

  it("uses the first non-error line when no error: prefix exists", () => {
    const e = mapNtnError("plain failure text", 2);
    expect(e.code).toBe("NTN_ERROR");
    expect(e.message).toBe("plain failure text");
    expect(e.suggestions).toEqual([]);
  });

  it("falls back to the exit code when stderr is empty", () => {
    const e = mapNtnError("", 7);
    expect(e.message).toBe("ntn exited with code 7");
  });
});

describe("ntnNotInstalledError", () => {
  it("carries install + login suggestions", () => {
    const e = ntnNotInstalledError();
    expect(e.code).toBe("NTN_NOT_INSTALLED");
    expect(e.suggestions.join(" ")).toMatch(/ntn\.dev/);
  });
});
