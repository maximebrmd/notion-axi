import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/ntn.js", () => ({ ntnApi: vi.fn() }));

import { apiCommand } from "../src/commands/api.js";
import { ntnApi } from "../src/ntn.js";
import { AxiError } from "../src/errors.js";

const api = vi.mocked(ntnApi);
afterEach(() => vi.clearAllMocks());

describe("apiCommand", () => {
  it("defaults to GET and forwards the path", async () => {
    api.mockResolvedValue({ object: "user" });
    const out: any = await apiCommand(["/users/me"]);
    expect(api.mock.calls[0][0]).toBe("/users/me");
    expect(api.mock.calls[0][1]).toMatchObject({ method: "get" });
    expect(out.result).toEqual({ object: "user" });
  });

  it("accepts `<method> <path>` form with a JSON body", async () => {
    api.mockResolvedValue({});
    await apiCommand(["post", "search", "--body", '{"query":"x"}']);
    expect(api.mock.calls[0][0]).toBe("search");
    expect(api.mock.calls[0][1]).toMatchObject({
      method: "post",
      body: { query: "x" },
    });
  });

  it("accepts --method and --query (scalarized)", async () => {
    api.mockResolvedValue({});
    await apiCommand([
      "comments",
      "--method",
      "GET",
      "--query",
      '{"block_id":"b"}',
    ]);
    expect(api.mock.calls[0][1]).toMatchObject({
      method: "get",
      query: { block_id: "b" },
    });
  });

  it("stringifies nested query values", async () => {
    api.mockResolvedValue({});
    await apiCommand(["x", "--query", '{"filter":{"a":1}}']);
    expect(api.mock.calls[0][1].query).toEqual({ filter: '{"a":1}' });
  });

  it("treats a non-method first positional as the path", async () => {
    api.mockResolvedValue({});
    await apiCommand(["databases", "ignored"]);
    expect(api.mock.calls[0][0]).toBe("databases");
    expect(api.mock.calls[0][1]).toMatchObject({ method: "get" });
  });

  it("requires a path", async () => {
    await expect(apiCommand([])).rejects.toBeInstanceOf(AxiError);
  });

  it("rejects an unknown method", async () => {
    await expect(
      apiCommand(["page", "--method", "fetch"]),
    ).rejects.toBeInstanceOf(AxiError);
  });

  it("rejects invalid JSON in --body", async () => {
    await expect(
      apiCommand(["post", "search", "--body", "{nope"]),
    ).rejects.toBeInstanceOf(AxiError);
  });
});
