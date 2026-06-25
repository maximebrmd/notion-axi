import { afterEach, describe, expect, it, vi } from "vitest";
import { apiCommand } from "../src/commands/api.js";
import * as notion from "../src/notion.js";
import { AxiError } from "../src/errors.js";

vi.mock("../src/notion.js", async (orig) => {
  const actual = await orig<typeof import("../src/notion.js")>();
  return { ...actual, getClient: vi.fn() };
});

function setRequest(result: unknown = { ok: true }) {
  const request = vi.fn().mockResolvedValue(result);
  vi.mocked(notion.getClient).mockReturnValue({ request } as never);
  return request;
}

afterEach(() => vi.clearAllMocks());

describe("apiCommand", () => {
  it("defaults to GET and strips a leading slash", async () => {
    const request = setRequest({ object: "user" });
    const out: any = await apiCommand(["/users/me"]);
    expect(request.mock.calls[0][0]).toMatchObject({
      path: "users/me",
      method: "get",
    });
    expect(out.result).toEqual({ object: "user" });
  });

  it("accepts `<method> <path>` form with a JSON body", async () => {
    const request = setRequest();
    await apiCommand(["post", "search", "--body", '{"query":"x"}']);
    expect(request.mock.calls[0][0]).toMatchObject({
      path: "search",
      method: "post",
      body: { query: "x" },
    });
  });

  it("accepts --method and --query", async () => {
    const request = setRequest();
    await apiCommand([
      "comments",
      "--method",
      "GET",
      "--query",
      '{"block_id":"b"}',
    ]);
    expect(request.mock.calls[0][0]).toMatchObject({
      method: "get",
      query: { block_id: "b" },
    });
  });

  it("treats a non-method first positional as the path", async () => {
    const request = setRequest();
    await apiCommand(["databases", "ignored"]);
    expect(request.mock.calls[0][0]).toMatchObject({
      path: "databases",
      method: "get",
    });
  });

  it("requires a path", async () => {
    setRequest();
    await expect(apiCommand([])).rejects.toBeInstanceOf(AxiError);
  });

  it("rejects an unknown method", async () => {
    setRequest();
    await expect(
      apiCommand(["page", "--method", "fetch"]),
    ).rejects.toBeInstanceOf(AxiError);
  });

  it("rejects invalid JSON in --body", async () => {
    setRequest();
    await expect(
      apiCommand(["post", "search", "--body", "{nope"]),
    ).rejects.toBeInstanceOf(AxiError);
  });
});
