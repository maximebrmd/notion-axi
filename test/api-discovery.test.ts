import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/ntn.js", () => ({
  ntnApi: vi.fn(),
  ntnJson: vi.fn(),
  ntnText: vi.fn(),
}));
vi.mock("../src/input.js", () => ({ textInput: vi.fn() }));
import { ntnApi, ntnJson, ntnText } from "../src/ntn.js";
import { textInput } from "../src/input.js";
import { apiCommand } from "../src/commands/api.js";
afterEach(() => vi.resetAllMocks());
const catalog = [
  {
    method: "GET",
    path: "/v1/pages/{id}",
    summary: "Read a page",
    tags: ["Pages"],
    operation_id: "read-page",
  },
  { method: "POST", path: "/v1/pages", summary: "Create a page" },
  { method: "GET", path: "/v1/users", summary: "List users" },
];

describe("official API discovery", () => {
  it("lists a bounded minimal catalog and filters by method and search", async () => {
    vi.mocked(ntnJson).mockResolvedValue(catalog);
    const all: any = await apiCommand(["endpoints", "--limit", "1"]);
    expect(all).toMatchObject({
      total: 3,
      shown: 1,
      endpoints: [
        { method: "GET", path: "/v1/pages/{id}", summary: "Read a page" },
      ],
    });
    const filtered: any = await apiCommand([
      "endpoints",
      "PAGES",
      "--method",
      "get",
      "--full",
      "--notion-version",
      "2026-03-11",
    ]);
    expect(filtered.endpoints).toEqual([catalog[0]]);
    expect(ntnJson).toHaveBeenLastCalledWith([
      "api",
      "--notion-version",
      "2026-03-11",
      "ls",
      "--json",
    ]);
    expect(ntnApi).not.toHaveBeenCalled();
  });

  it("retrieves Markdown docs and OpenAPI fragments without executing requests", async () => {
    vi.mocked(ntnText).mockResolvedValue("# Official docs\n");
    vi.mocked(ntnJson).mockResolvedValue({ paths: { "/v1/pages": {} } });
    expect(
      await apiCommand([
        "docs",
        "/v1/pages",
        "--method",
        "post",
        "--notion-version",
        "2026-03-11",
      ]),
    ).toEqual({ path: "/v1/pages", docs: "# Official docs\n" });
    expect(ntnText).toHaveBeenCalledWith([
      "api",
      "v1/pages",
      "--docs",
      "-X",
      "POST",
      "--notion-version",
      "2026-03-11",
    ]);
    expect(await apiCommand(["schema", "v1/pages"])).toEqual({
      path: "v1/pages",
      schema: { paths: { "/v1/pages": {} } },
    });
    expect(ntnJson).toHaveBeenCalledWith(["api", "v1/pages", "--spec"]);
    expect(ntnApi).not.toHaveBeenCalled();
  });

  it("discloses truncated documentation and supports complete output", async () => {
    vi.mocked(ntnText).mockResolvedValue("x".repeat(7000));
    const preview: any = await apiCommand(["docs", "v1/pages"]);
    expect(preview.truncated).toBe(true);
    expect(preview.help[0]).toContain("--full");
    const full: any = await apiCommand(["docs", "v1/pages", "--full"]);
    expect(full.docs).toHaveLength(7000);
    vi.mocked(ntnJson).mockResolvedValue({ description: "x".repeat(7000) });
    expect(
      await apiCommand([
        "schema",
        "v1/pages",
        "--method",
        "post",
        "--notion-version",
        "2026-03-11",
      ]),
    ).toMatchObject({ truncated: true });
  });

  it("validates discovery paths, methods and flags", async () => {
    for (const args of [
      ["docs"],
      ["schema"],
      ["endpoints", "--method"],
      ["docs", "v1/pages", "--method", "fetch"],
      ["endpoints", "--notion-version"],
      ["schema", "v1/pages", "--typo"],
    ]) {
      await expect(apiCommand(args)).rejects.toThrow();
    }
    expect(ntnJson).not.toHaveBeenCalled();
    expect(ntnText).not.toHaveBeenCalled();
  });

  it("does not treat ls as endpoint discovery", async () => {
    vi.mocked(ntnApi).mockResolvedValue({ results: [] });
    expect(await apiCommand(["ls"])).toEqual({ result: { results: [] } });
    expect(ntnApi).toHaveBeenCalledWith("ls", { method: "get" });
    expect(ntnJson).not.toHaveBeenCalled();
  });

  it("leads schema previews with the selected operation and preserves complete fragments", async () => {
    const fragment = {
      components: { schemas: { example: { description: "x".repeat(7000) } } },
      paths: { "/v1/pages": { post: { summary: "Create page" } } },
    };
    vi.mocked(ntnJson).mockResolvedValue(fragment);
    const preview: any = await apiCommand([
      "schema",
      "v1/pages",
      "--method",
      "post",
    ]);
    expect(preview.schema).toMatch(/^\{\n {2}"paths":/);
    expect(preview.schema).toContain("Create page");
    expect(preview.truncated).toBe(true);
    const full: any = await apiCommand([
      "schema",
      "v1/pages",
      "--method",
      "post",
      "--full",
    ]);
    expect(full.schema).toEqual(fragment);
  });
});

describe("API file input and version controls", () => {
  it("passes JSON from a file or stdin through the existing transport", async () => {
    vi.mocked(textInput).mockReturnValue('{"query":"roadmap"}');
    vi.mocked(ntnApi).mockResolvedValue({});
    await apiCommand([
      "post",
      "v1/search",
      "--body-file",
      "-",
      "--notion-version",
      "2026-03-11",
    ]);
    expect(textInput).toHaveBeenCalledWith(
      { "body-file": "-", "notion-version": "2026-03-11" },
      "body",
    );
    expect(ntnApi).toHaveBeenCalledWith("v1/search", {
      method: "post",
      body: { query: "roadmap" },
      notionVersion: "2026-03-11",
    });
  });

  it("rejects malformed query values and missing flags before requests", async () => {
    for (const query of ["null", "[]", '"value"', "1", "false", "{no"])
      await expect(
        apiCommand(["v1/users", "--query", query]),
      ).rejects.toThrow();
    await expect(apiCommand(["v1/users", "--query"])).rejects.toThrow(
      /Missing value/,
    );
    await expect(apiCommand(["v1/users", "--method"])).rejects.toThrow(
      /Missing value/,
    );
    await expect(apiCommand(["v1/users", "--notion-version"])).rejects.toThrow(
      /Missing value/,
    );
    expect(ntnApi).not.toHaveBeenCalled();
  });
});
